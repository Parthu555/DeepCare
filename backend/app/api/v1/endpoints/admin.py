"""
Admin API endpoints — doctor approval, patient/doctor management, stats, audit logs.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import (
    AIAnalysis, AuditLog, Consultation, Department, Doctor,
    MedicalReport, Patient, PatientDoctorAssignment, User, XrayImage,
)
from app.schemas.schemas import (
    AdminStatsResponse,
    DepartmentCreate,
    DepartmentResponse,
    DoctorApproval,
    MessageResponse,
)

router = APIRouter(prefix="/admin", tags=["Administration"])
logger = logging.getLogger(__name__)


def _require_admin(current_user):
    if current_user.role != "admin":
        raise HTTPException(403, "Admin access required")


# ─────────────────────────────── Dashboard Stats ──────────────────────────────

@router.get("/stats", response_model=AdminStatsResponse)
def get_admin_stats(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return aggregate system statistics for the admin dashboard."""
    _require_admin(current_user)

    total_patients = db.query(func.count(Patient.id)).scalar()
    total_doctors = db.query(func.count(Doctor.id)).scalar()
    approved_doctors = db.query(func.count(Doctor.id)).filter(Doctor.is_approved == True).scalar()
    total_xrays = db.query(func.count(XrayImage.id)).filter(XrayImage.is_deleted == False).scalar()
    total_analyses = db.query(func.count(AIAnalysis.id)).scalar()
    total_reports = db.query(func.count(MedicalReport.id)).scalar()
    approved_reports = db.query(func.count(MedicalReport.id)).filter(
        MedicalReport.status == "approved"
    ).scalar()
    total_consultations = db.query(func.count(Consultation.id)).scalar()

    # Recent audit activity (last 10 events)
    recent = (
        db.query(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .limit(10)
        .all()
    )
    recent_activity = [
        {
            "action": r.action,
            "resource_type": r.resource_type,
            "status": r.status,
            "created_at": r.created_at,
        }
        for r in recent
    ]

    return AdminStatsResponse(
        total_patients=total_patients or 0,
        total_doctors=total_doctors or 0,
        approved_doctors=approved_doctors or 0,
        pending_doctors=(total_doctors or 0) - (approved_doctors or 0),
        total_xrays=total_xrays or 0,
        total_analyses=total_analyses or 0,
        total_reports=total_reports or 0,
        approved_reports=approved_reports or 0,
        total_consultations=total_consultations or 0,
        recent_activity=recent_activity,
    )


# ─────────────────────────────── Doctor Management ───────────────────────────

@router.get("/doctors")
def list_doctors(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    approved: Optional[bool] = None,
):
    """List all doctors with optional filtering by approval status."""
    _require_admin(current_user)
    q = db.query(Doctor)
    if approved is not None:
        q = q.filter(Doctor.is_approved == approved)
    total = q.count()
    doctors = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": d.id,
                "doctor_id": d.doctor_id,
                "name": f"Dr. {d.first_name} {d.last_name}",
                "specialization": d.specialization,
                "is_approved": d.is_approved,
                "created_at": d.created_at,
            }
            for d in doctors
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/doctors/{doctor_id}/approval")
def approve_or_reject_doctor(
    doctor_id: str,
    payload: DoctorApproval,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve or reject a doctor's registration."""
    _require_admin(current_user)
    doctor = (
        db.query(Doctor)
        .filter((Doctor.doctor_id == doctor_id) | (Doctor.id == doctor_id))
        .first()
    )
    if not doctor:
        raise HTTPException(404, "Doctor not found")
    doctor.is_approved = payload.approved
    doctor.approved_by = current_user.id
    doctor.approved_at = datetime.now(timezone.utc) if payload.approved else None

    # Update user active status accordingly
    user = db.query(User).filter(User.id == doctor.user_id).first()
    if user:
        user.is_active = payload.approved

    db.commit()
    action = "approved" if payload.approved else "rejected"
    logger.info(f"Doctor {doctor_id} {action} by admin {current_user.id}")
    return MessageResponse(message=f"Doctor {doctor_id} {action} successfully")


@router.delete("/doctors/{doctor_id}")
def deactivate_doctor(
    doctor_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deactivate a doctor account."""
    _require_admin(current_user)
    doctor = db.query(Doctor).filter(Doctor.doctor_id == doctor_id).first()
    if not doctor:
        raise HTTPException(404, "Doctor not found")
    doctor.is_approved = False
    user = db.query(User).filter(User.id == doctor.user_id).first()
    if user:
        user.is_active = False
    db.commit()
    return MessageResponse(message=f"Doctor {doctor_id} deactivated")


# ─────────────────────────────── Patient Management ──────────────────────────

@router.get("/patients")
def list_patients(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
):
    """List all patients with optional name/ID search."""
    _require_admin(current_user)
    q = db.query(Patient)
    if search:
        q = q.filter(
            (Patient.patient_id.ilike(f"%{search}%")) |
            (Patient.first_name.ilike(f"%{search}%")) |
            (Patient.last_name.ilike(f"%{search}%"))
        )
    total = q.count()
    patients = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": p.id,
                "patient_id": p.patient_id,
                "name": f"{p.first_name} {p.last_name}",
                "gender": p.gender,
                "created_at": p.created_at,
            }
            for p in patients
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/patients/{patient_id}/assign-doctor")
def admin_assign_doctor(
    patient_id: str,
    doctor_id: str = Query(...),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Assign a doctor to a patient (admin action)."""
    _require_admin(current_user)
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    doctor = db.query(Doctor).filter(Doctor.doctor_id == doctor_id).first()
    if not doctor:
        raise HTTPException(404, "Doctor not found")
    existing = (
        db.query(PatientDoctorAssignment)
        .filter(
            PatientDoctorAssignment.patient_id == patient.id,
            PatientDoctorAssignment.doctor_id == doctor.id,
        )
        .first()
    )
    if existing:
        existing.is_active = True
    else:
        db.add(PatientDoctorAssignment(
            patient_id=patient.id,
            doctor_id=doctor.id,
            assigned_by=current_user.id,
        ))
    db.commit()
    return MessageResponse(message=f"Doctor {doctor_id} assigned to patient {patient_id}")


# ─────────────────────────────── Departments ─────────────────────────────────

@router.get("/departments")
def list_departments(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    depts = db.query(Department).filter(Department.is_active == True).all()
    return [DepartmentResponse.model_validate(d) for d in depts]


@router.post("/departments", response_model=DepartmentResponse, status_code=201)
def create_department(
    payload: DepartmentCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    existing = db.query(Department).filter(Department.name == payload.name).first()
    if existing:
        raise HTTPException(409, "Department already exists")
    dept = Department(name=payload.name, description=payload.description)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return DepartmentResponse.model_validate(dept)


@router.put("/departments/{dept_id}/deactivate")
def deactivate_department(
    dept_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(404, "Department not found")
    dept.is_active = False
    db.commit()
    return MessageResponse(message="Department deactivated")


# ─────────────────────────────── Audit Logs ──────────────────────────────────

@router.get("/audit-logs")
def get_audit_logs(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    action: Optional[str] = None,
):
    """Retrieve paginated application-level audit logs."""
    _require_admin(current_user)
    q = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    if action:
        q = q.filter(AuditLog.action.ilike(f"%{action}%"))
    total = q.count()
    logs = q.offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": log.id,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "ip_address": log.ip_address,
                "status": log.status,
                "created_at": log.created_at,
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
