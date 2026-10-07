"""
Patient API endpoints — profile, medical history, X-ray gallery, reports, appointments.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import (
    AIAnalysis, Appointment, Consultation, MedicalReport,
    Notification, Patient, XrayImage,
)
from app.schemas.schemas import (
    AppointmentResponse,
    ConsultationResponse,
    MessageResponse,
    PatientProfileUpdate,
    PatientResponse,
    ReportResponse,
    XrayResponse,
)
from app.services.s3_service import generate_presigned_url

router = APIRouter(prefix="/patients", tags=["Patients"])
logger = logging.getLogger(__name__)


def _get_patient_or_403(db: Session, user_id: str) -> Patient:
    p = db.query(Patient).filter(Patient.user_id == user_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    return p


@router.get("/me", response_model=PatientResponse)
def get_my_profile(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the authenticated patient's full profile."""
    if current_user.role != "patient":
        raise HTTPException(403, "Only patients can access this endpoint")
    p = _get_patient_or_403(db, current_user.id)
    resp = PatientResponse.model_validate(p)
    resp.email = current_user.email
    return resp


@router.put("/me", response_model=PatientResponse)
def update_my_profile(
    payload: PatientProfileUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the authenticated patient's profile."""
    if current_user.role != "patient":
        raise HTTPException(403, "Only patients can access this endpoint")
    p = _get_patient_or_403(db, current_user.id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    resp = PatientResponse.model_validate(p)
    resp.email = current_user.email
    return resp


@router.get("/me/xrays")
def get_my_xrays(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Get all X-rays for the authenticated patient."""
    if current_user.role != "patient":
        raise HTTPException(403, "Only patients can access this endpoint")
    p = _get_patient_or_403(db, current_user.id)
    offset = (page - 1) * page_size
    q = (
        db.query(XrayImage)
        .filter(XrayImage.patient_id == p.id, XrayImage.is_deleted == False)
        .order_by(XrayImage.created_at.desc())
    )
    total = q.count()
    xrays = q.offset(offset).limit(page_size).all()

    items = []
    for x in xrays:
        item = XrayResponse.model_validate(x)
        item.patient_id = p.patient_id  # Return human-readable patient_id
        # Don't expose raw S3 key; generate presigned URL
        item.s3_key = "[secured]"
        items.append(item)

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/me/xrays/{xray_id}/view")
def get_xray_presigned_url(
    xray_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a short-lived presigned URL for viewing an X-ray. Patient-only access."""
    if current_user.role != "patient":
        raise HTTPException(403, "Only patients can access this endpoint")
    p = _get_patient_or_403(db, current_user.id)
    xray = (
        db.query(XrayImage)
        .filter(XrayImage.xray_id == xray_id, XrayImage.patient_id == p.id, XrayImage.is_deleted == False)
        .first()
    )
    if not xray:
        raise HTTPException(404, "X-ray not found")
    url = generate_presigned_url(xray.s3_key, expiry_seconds=900)
    if not url:
        raise HTTPException(503, "Could not generate secure URL. Please try again.")
    return {"xray_id": xray_id, "presigned_url": url, "expires_in": 900}


@router.get("/me/reports")
def get_my_reports(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Get all doctor-approved reports visible to this patient."""
    if current_user.role != "patient":
        raise HTTPException(403, "Only patients can access this endpoint")
    p = _get_patient_or_403(db, current_user.id)
    offset = (page - 1) * page_size
    q = (
        db.query(MedicalReport)
        .filter(
            MedicalReport.patient_id == p.id,
            MedicalReport.status == "approved",
            MedicalReport.is_patient_viewable == True,
        )
        .order_by(MedicalReport.created_at.desc())
    )
    total = q.count()
    reports = q.offset(offset).limit(page_size).all()
    return {
        "items": [ReportResponse.model_validate(r) for r in reports],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/me/reports/{report_id}/download")
def download_report_pdf(
    report_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a presigned URL for downloading an approved PDF report."""
    if current_user.role != "patient":
        raise HTTPException(403, "Only patients can access this endpoint")
    p = _get_patient_or_403(db, current_user.id)
    report = (
        db.query(MedicalReport)
        .filter(
            MedicalReport.report_id == report_id,
            MedicalReport.patient_id == p.id,
            MedicalReport.status == "approved",
            MedicalReport.is_patient_viewable == True,
        )
        .first()
    )
    if not report:
        raise HTTPException(404, "Report not found or not accessible")
    if not report.pdf_s3_key:
        raise HTTPException(404, "PDF not yet generated for this report")
    url = generate_presigned_url(report.pdf_s3_key, expiry_seconds=300)
    if not url:
        raise HTTPException(503, "Could not generate download URL")
    return {"report_id": report_id, "download_url": url, "expires_in": 300}


@router.get("/me/consultations")
def get_my_consultations(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """Get all consultations for the authenticated patient."""
    if current_user.role != "patient":
        raise HTTPException(403, "Only patients can access this endpoint")
    p = _get_patient_or_403(db, current_user.id)
    offset = (page - 1) * page_size
    q = (
        db.query(Consultation)
        .filter(Consultation.patient_id == p.id)
        .order_by(Consultation.consultation_date.desc())
    )
    total = q.count()
    consultations = q.offset(offset).limit(page_size).all()
    return {
        "items": [ConsultationResponse.model_validate(c) for c in consultations],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/me/appointments")
def get_my_appointments(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all appointments for the authenticated patient."""
    if current_user.role != "patient":
        raise HTTPException(403, "Only patients can access this endpoint")
    p = _get_patient_or_403(db, current_user.id)
    appointments = (
        db.query(Appointment)
        .filter(Appointment.patient_id == p.id)
        .order_by(Appointment.scheduled_at.desc())
        .all()
    )
    return [AppointmentResponse.model_validate(a) for a in appointments]


@router.get("/me/notifications")
def get_my_notifications(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all notifications for the authenticated patient."""
    if current_user.role != "patient":
        raise HTTPException(403, "Only patients can access this endpoint")
    p = _get_patient_or_403(db, current_user.id)
    notifications = (
        db.query(Notification)
        .filter(Notification.patient_id == p.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "type": n.notification_type,
            "is_read": n.is_read,
            "created_at": n.created_at,
        }
        for n in notifications
    ]


@router.get("/me/history")
def get_medical_history(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a full chronological medical history timeline for this patient."""
    if current_user.role != "patient":
        raise HTTPException(403, "Only patients can access this endpoint")
    p = _get_patient_or_403(db, current_user.id)

    events = []

    # X-ray events
    xrays = db.query(XrayImage).filter(
        XrayImage.patient_id == p.id, XrayImage.is_deleted == False
    ).all()
    for x in xrays:
        events.append({
            "type": "xray",
            "id": x.xray_id,
            "title": f"X-ray — {x.body_part or 'Unknown'} ({x.view_position or 'N/A'})",
            "date": x.created_at,
            "detail": x.clinical_indication,
        })

    # Consultations
    consults = db.query(Consultation).filter(
        Consultation.patient_id == p.id
    ).all()
    for c in consults:
        events.append({
            "type": "consultation",
            "id": c.consultation_id,
            "title": f"Consultation — {c.chief_complaint or 'General'}",
            "date": c.consultation_date,
            "detail": c.assessment,
        })

    # Reports
    reports = db.query(MedicalReport).filter(
        MedicalReport.patient_id == p.id,
        MedicalReport.status == "approved",
        MedicalReport.is_patient_viewable == True,
    ).all()
    for r in reports:
        events.append({
            "type": "report",
            "id": r.report_id,
            "title": r.title,
            "date": r.approved_at or r.created_at,
            "detail": r.summary,
        })

    # Appointments
    apts = db.query(Appointment).filter(
        Appointment.patient_id == p.id
    ).all()
    for a in apts:
        events.append({
            "type": "appointment",
            "id": a.appointment_id,
            "title": f"Appointment — {a.purpose or 'Scheduled'}",
            "date": a.scheduled_at,
            "detail": a.notes,
        })

    events.sort(key=lambda e: e["date"], reverse=True)
    return {"patient_id": p.patient_id, "events": events}
