"""
Smart Pre-Booking & Appointment Management API endpoints.
Supports guest pre-booking, registered patient booking, doctor approval/reschedule, and admin monitoring.
"""
import logging
from datetime import datetime, timezone, date
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import (
    Appointment, Doctor, Patient, User, Notification
)
from app.schemas.schemas import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentStatusUpdate,
    AppointmentReschedule,
    MessageResponse
)
from app.utils.id_generator import generate_appointment_id

router = APIRouter(prefix="/appointments", tags=["Appointments & Pre-Booking"])
logger = logging.getLogger(__name__)

optional_bearer = HTTPBearer(auto_error=False)


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_bearer),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Extract user if bearer token is present, otherwise return None (guest)."""
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None
        return db.query(User).filter(User.id == user_id, User.is_active == True).first()
    except Exception:
        return None


def _serialize_appointment(appt: Appointment, db: Session) -> AppointmentResponse:
    """Helper to convert Appointment model into enriched AppointmentResponse."""
    doctor = db.query(Doctor).filter(Doctor.id == appt.doctor_id).first()
    doctor_name = f"Dr. {doctor.first_name} {doctor.last_name}" if doctor else "Unknown Doctor"
    doctor_spec = doctor.specialization if doctor else "General Practice"
    
    pat_id_str = None
    pat_name_str = appt.patient_name
    pat_email_str = appt.patient_email
    pat_phone_str = appt.patient_phone
    pat_age_int = appt.patient_age
    pat_gender_str = appt.patient_gender

    if appt.patient_id:
        patient = db.query(Patient).filter(Patient.id == appt.patient_id).first()
        if patient:
            pat_id_str = patient.patient_id
            if not pat_name_str:
                pat_name_str = f"{patient.first_name} {patient.last_name}"
            if not pat_phone_str:
                pat_phone_str = patient.phone
            if not pat_gender_str and patient.gender:
                pat_gender_str = str(patient.gender)
            if not pat_email_str and patient.user:
                pat_email_str = patient.user.email

    return AppointmentResponse(
        id=str(appt.id),
        appointment_id=appt.appointment_id,
        patient_id=pat_id_str,
        doctor_id=str(appt.doctor_id),
        doctor_name=doctor_name,
        doctor_specialization=doctor_spec,
        patient_name=pat_name_str,
        patient_email=pat_email_str,
        patient_phone=pat_phone_str,
        patient_age=pat_age_int,
        patient_gender=pat_gender_str,
        symptoms=appt.symptoms or appt.purpose,
        consultation_type=appt.consultation_type or "in_person",
        time_slot=appt.time_slot,
        scheduled_at=appt.scheduled_at,
        duration_minutes=appt.duration_minutes or 30,
        purpose=appt.purpose or appt.symptoms,
        status=str(appt.status) if appt.status else "pending",
        notes=appt.notes,
        created_at=appt.created_at or datetime.now(timezone.utc)
    )


import uuid

def _find_doctor(db: Session, doc_identifier: str) -> Optional[Doctor]:
    if not doc_identifier:
        return None
    try:
        val = uuid.UUID(str(doc_identifier))
        doc = db.query(Doctor).filter(Doctor.id == str(val)).first()
        if doc:
            return doc
    except (ValueError, AttributeError):
        pass
    return db.query(Doctor).filter(Doctor.doctor_id == doc_identifier).first()


def _find_patient(db: Session, pat_identifier: str) -> Optional[Patient]:
    if not pat_identifier:
        return None
    try:
        val = uuid.UUID(str(pat_identifier))
        p = db.query(Patient).filter(Patient.id == str(val)).first()
        if p:
            return p
    except (ValueError, AttributeError):
        pass
    return db.query(Patient).filter(Patient.patient_id == pat_identifier).first()


# ─────────────────────────────── Available Doctors ──────────────────────────────

@router.get("/doctors")
def list_available_doctors(db: Session = Depends(get_db)):
    """Public endpoint to fetch approved doctors and available time slots for booking."""
    doctors = db.query(Doctor).filter(Doctor.is_approved == True).all()
    
    standard_slots = [
        "09:00 AM - 09:30 AM",
        "10:00 AM - 10:30 AM",
        "11:00 AM - 11:30 AM",
        "02:00 PM - 02:30 PM",
        "03:00 PM - 03:30 PM",
        "04:00 PM - 04:30 PM"
    ]
    
    results = []
    for d in doctors:
        results.append({
            "id": str(d.id),
            "doctor_id": d.doctor_id,
            "name": f"Dr. {d.first_name} {d.last_name}",
            "first_name": d.first_name,
            "last_name": d.last_name,
            "specialization": d.specialization or "Radiology & Internal Medicine",
            "license_number": d.license_number,
            "consultation_types": ["in_person", "video", "teleconsultation"],
            "available_time_slots": standard_slots
        })
    return results


# ─────────────────────────────── Pre-Booking (Public & Patient) ─────────────────

@router.post("/pre-book", response_model=AppointmentResponse)
def pre_book_appointment(
    payload: AppointmentCreate,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Book an appointment. Supports both:
    1. Registered patients (authenticated or providing patient_id)
    2. New/Guest patients (providing name, email, phone, age, symptoms)
    """
    # 1. Resolve Doctor
    doctor = _find_doctor(db, payload.doctor_id)
    if not doctor:
        raise HTTPException(status_code=404, detail="Selected doctor was not found.")

    # 2. Check for time-slot conflict with the doctor
    if payload.time_slot:
        target_date = payload.scheduled_at.date()
        conflict = (
            db.query(Appointment)
            .filter(
                Appointment.doctor_id == doctor.id,
                Appointment.status.in_(["pending", "confirmed", "scheduled", "rescheduled"]),
                Appointment.time_slot == payload.time_slot,
                func.date(Appointment.scheduled_at) == target_date
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=409,
                detail=f"Time slot '{payload.time_slot}' on {target_date} is already reserved for Dr. {doctor.last_name}. Please choose another time slot."
            )

    # 3. Resolve Patient record if available
    db_patient_id = None
    patient_name = payload.patient_name
    patient_email = payload.patient_email
    patient_phone = payload.patient_phone
    patient_gender = payload.patient_gender
    patient_age = payload.patient_age

    # Case A: User is logged in as a patient
    if current_user and current_user.role == "patient":
        pat_profile = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if pat_profile:
            db_patient_id = pat_profile.id
            if not patient_name:
                patient_name = f"{pat_profile.first_name} {pat_profile.last_name}"
            if not patient_phone:
                patient_phone = pat_profile.phone
            if not patient_email:
                patient_email = current_user.email
            if not patient_gender and pat_profile.gender:
                patient_gender = str(pat_profile.gender)

    # Case B: Guest provided an existing patient ID
    elif payload.patient_id:
        pat_profile = db.query(Patient).filter(Patient.patient_id == payload.patient_id).first()
        if pat_profile:
            db_patient_id = pat_profile.id
            if not patient_name:
                patient_name = f"{pat_profile.first_name} {pat_profile.last_name}"
            if not patient_phone:
                patient_phone = pat_profile.phone
            if not patient_email and pat_profile.user:
                patient_email = pat_profile.user.email

    # If new patient, validate required contact info
    if not db_patient_id and not patient_name:
        raise HTTPException(
            status_code=422,
            detail="Patient name and contact information are required for pre-booking."
        )

    # 4. Generate unique ID and create Appointment record
    aid = generate_appointment_id(db)
    new_appt = Appointment(
        appointment_id=aid,
        patient_id=db_patient_id,
        doctor_id=doctor.id,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes or 30,
        purpose=payload.purpose or payload.symptoms or "Clinical Consultation",
        status="pending",
        patient_name=patient_name,
        patient_email=patient_email,
        patient_phone=patient_phone,
        patient_age=patient_age,
        patient_gender=patient_gender,
        symptoms=payload.symptoms or payload.purpose,
        consultation_type=payload.consultation_type or "in_person",
        time_slot=payload.time_slot,
        notes="Pre-booking request submitted by patient."
    )

    db.add(new_appt)
    db.commit()
    db.refresh(new_appt)

    try:
        from app.core.metrics import record_appointment_created
        dept = department.name if department else "Pulmonology"
        record_appointment_created(department=dept, status="scheduled")
    except Exception:
        pass

    # 5. Send notification to Doctor
    try:
        doctor_user = db.query(User).filter(User.id == doctor.user_id).first()
        if doctor_user:
            notif = Notification(
                user_id=doctor_user.id,
                patient_id=db_patient_id,
                title="New Appointment Pre-Booking Request",
                message=f"Patient {patient_name} requested an appointment on {payload.scheduled_at.strftime('%Y-%m-%d')} ({payload.time_slot or 'Standard Slot'}). Symptoms: {payload.symptoms or 'None specified'}.",
                type="appointment",
                related_entity_id=new_appt.appointment_id,
                related_entity_type="appointment",
            )
            db.add(notif)
            db.commit()
    except Exception as e:
        logger.warning(f"Failed to create doctor notification: {e}")

    logger.info(f"Pre-booking successful: {aid} for {patient_name} with Dr. {doctor.last_name}")
    return _serialize_appointment(new_appt, db)


# ─────────────────────────────── Patient Bookings Retrieval ─────────────────────

@router.get("/my-bookings")
def get_my_bookings(
    email: Optional[str] = Query(None),
    patient_id: Optional[str] = Query(None),
    appointment_id: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Retrieve appointments for authenticated patient or via guest search (email/appointment_id)."""
    q = db.query(Appointment)

    if current_user and current_user.role == "patient":
        pat_profile = db.query(Patient).filter(Patient.user_id == current_user.id).first()
        if pat_profile:
            q = q.filter(
                or_(
                    Appointment.patient_id == pat_profile.id,
                    Appointment.patient_email == current_user.email,
                    Appointment.patient_name == f"{pat_profile.first_name} {pat_profile.last_name}"
                )
            )
    elif appointment_id:
        q = q.filter(Appointment.appointment_id == appointment_id)
    elif email:
        q = q.filter(Appointment.patient_email.ilike(email.strip()))
    elif patient_id:
        pat_profile = db.query(Patient).filter(Patient.patient_id == patient_id).first()
        if pat_profile:
            q = q.filter(Appointment.patient_id == pat_profile.id)
        else:
            return []
    else:
        raise HTTPException(
            status_code=400,
            detail="Authentication or lookup parameter (email / appointment_id / patient_id) required."
        )

    appointments = q.order_by(Appointment.scheduled_at.desc()).all()
    return [_serialize_appointment(a, db) for a in appointments]


@router.get("/{appointment_id}", response_model=AppointmentResponse)
def get_appointment_by_id(appointment_id: str, db: Session = Depends(get_db)):
    """Fetch single appointment details by appointment_id."""
    appt = db.query(Appointment).filter(Appointment.appointment_id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")
    return _serialize_appointment(appt, db)


@router.patch("/{appointment_id}/cancel", response_model=AppointmentResponse)
def cancel_appointment(
    appointment_id: str,
    reason: Optional[str] = Query(None),
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Cancel an appointment (patient, doctor, or admin)."""
    appt = db.query(Appointment).filter(Appointment.appointment_id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    appt.status = "cancelled"
    cancel_note = f"Cancelled by user. Reason: {reason}" if reason else "Cancelled by user."
    appt.notes = f"{appt.notes}\n{cancel_note}" if appt.notes else cancel_note
    appt.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(appt)
    return _serialize_appointment(appt, db)


@router.patch("/{appointment_id}/reschedule", response_model=AppointmentResponse)
def reschedule_appointment(
    appointment_id: str,
    payload: AppointmentReschedule,
    current_user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db)
):
    """Reschedule an existing appointment to a new date/time slot."""
    appt = db.query(Appointment).filter(Appointment.appointment_id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    # Check slot conflict for the doctor
    if payload.time_slot:
        target_date = payload.scheduled_at.date()
        conflict = (
            db.query(Appointment)
            .filter(
                Appointment.doctor_id == appt.doctor_id,
                Appointment.id != appt.id,
                Appointment.status.in_(["pending", "confirmed", "scheduled", "rescheduled"]),
                Appointment.time_slot == payload.time_slot,
                func.date(Appointment.scheduled_at) == target_date
            )
            .first()
        )
        if conflict:
            raise HTTPException(
                status_code=409,
                detail=f"Time slot '{payload.time_slot}' on {target_date} is already reserved. Please choose another time."
            )

    appt.scheduled_at = payload.scheduled_at
    if payload.time_slot:
        appt.time_slot = payload.time_slot
    appt.status = "rescheduled"
    reschedule_note = f"Rescheduled: {payload.reason}" if payload.reason else "Rescheduled by patient/doctor."
    appt.notes = f"{appt.notes}\n{reschedule_note}" if appt.notes else reschedule_note
    appt.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(appt)
    return _serialize_appointment(appt, db)


# ─────────────────────────────── Doctor Management ───────────────────────────

@router.get("/doctor/me")
def get_doctor_appointments(
    status_filter: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all appointments assigned to the authenticated doctor."""
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access required.")
    
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found.")

    q = db.query(Appointment).filter(Appointment.doctor_id == doctor.id)
    if status_filter:
        q = q.filter(Appointment.status == status_filter)
    
    appointments = q.order_by(Appointment.scheduled_at.asc()).all()
    return [_serialize_appointment(a, db) for a in appointments]


@router.patch("/doctor/{appointment_id}/status", response_model=AppointmentResponse)
def update_appointment_status(
    appointment_id: str,
    payload: AppointmentStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Doctor accepts (confirmed), rejects, reschedules, or completes an appointment request.
    """
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Doctor access required.")

    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    appt = (
        db.query(Appointment)
        .filter(Appointment.appointment_id == appointment_id, Appointment.doctor_id == doctor.id)
        .first()
    )
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found or not assigned to you.")

    valid_statuses = ["confirmed", "rejected", "rescheduled", "cancelled", "completed", "scheduled"]
    if payload.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    appt.status = payload.status
    if payload.notes:
        appt.notes = f"{appt.notes}\nDoctor note: {payload.notes}" if appt.notes else payload.notes
    if payload.scheduled_at:
        appt.scheduled_at = payload.scheduled_at
    if payload.time_slot:
        appt.time_slot = payload.time_slot

    appt.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(appt)

    # Notify patient if patient record exists
    if appt.patient_id:
        try:
            pat = db.query(Patient).filter(Patient.id == appt.patient_id).first()
            if pat and pat.user_id:
                notif = Notification(
                    user_id=pat.user_id,
                    patient_id=pat.id,
                    title=f"Appointment {payload.status.capitalize()}",
                    message=f"Dr. {doctor.last_name} has {payload.status} your appointment for {appt.scheduled_at.strftime('%Y-%m-%d')} ({appt.time_slot or 'Standard Slot'}). Notes: {payload.notes or 'None'}",
                    type="appointment",
                    related_entity_id=appt.appointment_id,
                    related_entity_type="appointment",
                )
                db.add(notif)
                db.commit()
        except Exception as e:
            logger.warning(f"Could not notify patient: {e}")

    return _serialize_appointment(appt, db)


# ─────────────────────────────── Admin Management & Monitoring ────────────────

@router.get("/admin/all")
def get_all_appointments_admin(
    status_filter: Optional[str] = Query(None),
    doctor_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin endpoint to monitor and manage all appointments."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

    q = db.query(Appointment)
    if status_filter:
        q = q.filter(Appointment.status == status_filter)
    if doctor_id:
        doc = _find_doctor(db, doctor_id)
        if doc:
            q = q.filter(Appointment.doctor_id == doc.id)
    if search:
        search_term = f"%{search}%"
        q = q.filter(
            or_(
                Appointment.appointment_id.ilike(search_term),
                Appointment.patient_name.ilike(search_term),
                Appointment.patient_email.ilike(search_term),
                Appointment.symptoms.ilike(search_term)
            )
        )

    total = q.count()
    offset = (page - 1) * page_size
    appointments = q.order_by(Appointment.created_at.desc()).offset(offset).limit(page_size).all()

    return {
        "items": [_serialize_appointment(a, db) for a in appointments],
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/admin/stats")
def get_appointment_admin_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin statistics for appointments."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

    total_bookings = db.query(func.count(Appointment.id)).scalar() or 0
    pending_requests = (
        db.query(func.count(Appointment.id))
        .filter(Appointment.status == "pending")
        .scalar() or 0
    )
    confirmed_appointments = (
        db.query(func.count(Appointment.id))
        .filter(Appointment.status.in_(["confirmed", "scheduled"]))
        .scalar() or 0
    )
    rescheduled_appointments = (
        db.query(func.count(Appointment.id))
        .filter(Appointment.status == "rescheduled")
        .scalar() or 0
    )
    cancelled_appointments = (
        db.query(func.count(Appointment.id))
        .filter(Appointment.status.in_(["cancelled", "rejected"]))
        .scalar() or 0
    )
    completed_appointments = (
        db.query(func.count(Appointment.id))
        .filter(Appointment.status == "completed")
        .scalar() or 0
    )
    today = date.today()
    today_appointments = (
        db.query(func.count(Appointment.id))
        .filter(func.date(Appointment.scheduled_at) == today)
        .scalar() or 0
    )

    return {
        "total_bookings": total_bookings,
        "pending_requests": pending_requests,
        "confirmed_appointments": confirmed_appointments,
        "rescheduled_appointments": rescheduled_appointments,
        "cancelled_appointments": cancelled_appointments,
        "completed_appointments": completed_appointments,
        "today_appointments": today_appointments,
    }


@router.patch("/admin/{appointment_id}")
def admin_update_appointment(
    appointment_id: str,
    payload: AppointmentStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin override to update status, notes, or schedule of any appointment."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")

    appt = db.query(Appointment).filter(Appointment.appointment_id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found.")

    if payload.status:
        appt.status = payload.status
    if payload.notes:
        appt.notes = f"{appt.notes}\nAdmin override: {payload.notes}" if appt.notes else payload.notes
    if payload.scheduled_at:
        appt.scheduled_at = payload.scheduled_at
    if payload.time_slot:
        appt.time_slot = payload.time_slot

    appt.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(appt)
    return _serialize_appointment(appt, db)
