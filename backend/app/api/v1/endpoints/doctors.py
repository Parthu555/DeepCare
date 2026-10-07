"""
Doctor API endpoints — patient search, X-ray upload, AI analysis, report management.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import (
    AIAnalysis, Appointment, Consultation, Doctor,
    MedicalReport, Notification, Patient, PatientDoctorAssignment, XrayImage,
)
from app.schemas.schemas import (
    AnalysisReviewRequest,
    AnalysisResponse,
    AppointmentCreate,
    AppointmentResponse,
    ConsultationCreate,
    ConsultationResponse,
    MessageResponse,
    ReportCreate,
    ReportApprove,
    ReportResponse,
    XrayDetailResponse,
    XrayResponse,
)
from app.services.ai_service import analyze_xray, get_model_status
from app.services.pdf_service import generate_report_pdf
from app.services.s3_service import (
    build_xray_s3_key,
    generate_presigned_url,
    upload_file_to_s3,
    validate_image_file,
)
from app.services.cloudwatch_service import record_xray_upload
from app.utils.id_generator import (
    generate_analysis_id,
    generate_appointment_id,
    generate_consultation_id,
    generate_report_id,
    generate_xray_id,
)

router = APIRouter(prefix="/doctors", tags=["Doctors"])
logger = logging.getLogger(__name__)


def _require_doctor(current_user) -> None:
    if current_user.role not in ("doctor", "admin"):
        raise HTTPException(403, "Doctor access required")


def _get_doctor_profile(db: Session, user_id: str) -> Doctor:
    doc = db.query(Doctor).filter(Doctor.user_id == user_id, Doctor.is_approved == True).first()
    if not doc:
        raise HTTPException(403, "Doctor profile not found or not approved")
    return doc


def _check_patient_access(db: Session, doctor: Doctor, patient: Patient) -> bool:
    """Check if a doctor has been assigned to this patient."""
    assignment = (
        db.query(PatientDoctorAssignment)
        .filter(
            PatientDoctorAssignment.doctor_id == doctor.id,
            PatientDoctorAssignment.patient_id == patient.id,
            PatientDoctorAssignment.is_active == True,
        )
        .first()
    )
    return assignment is not None


# ─────────────────────────────── Patient Search ───────────────────────────────

@router.get("/patients/search")
def search_patient(
    patient_id: str = Query(..., description="Patient ID like DC-12345678"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search for a patient by patient ID. Returns summary only."""
    _require_doctor(current_user)
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    return {
        "found": True,
        "patient_id": patient.patient_id,
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "gender": patient.gender,
        "internal_id": patient.id,
    }


@router.post("/patients/{patient_id}/assign")
def assign_patient(
    patient_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Assign a patient to this doctor for authorized access."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    existing = (
        db.query(PatientDoctorAssignment)
        .filter(
            PatientDoctorAssignment.doctor_id == doctor.id,
            PatientDoctorAssignment.patient_id == patient.id,
        )
        .first()
    )
    if existing:
        existing.is_active = True
        db.commit()
        return MessageResponse(message="Patient already assigned. Access restored.")

    assignment = PatientDoctorAssignment(
        patient_id=patient.id,
        doctor_id=doctor.id,
        assigned_by=current_user.id,
    )
    db.add(assignment)
    db.commit()
    return MessageResponse(message=f"Patient {patient_id} assigned successfully")


@router.get("/patients/{patient_id}/profile")
def get_patient_profile(
    patient_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get full patient profile. Requires prior assignment."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    if not _check_patient_access(db, doctor, patient):
        raise HTTPException(403, "You are not authorized to view this patient's records")
    user = patient.user
    return {
        "id": patient.id,
        "patient_id": patient.patient_id,
        "first_name": patient.first_name,
        "last_name": patient.last_name,
        "email": user.email if user else None,
        "date_of_birth": patient.date_of_birth,
        "gender": patient.gender,
        "blood_group": patient.blood_group,
        "phone": patient.phone,
        "allergies": patient.allergies,
        "chronic_conditions": patient.chronic_conditions,
        "created_at": patient.created_at,
    }


# ─────────────────────────────── X-ray Upload ────────────────────────────────

@router.post("/xrays/upload", response_model=XrayResponse)
async def upload_xray(
    file: UploadFile = File(...),
    patient_id: str = Form(...),
    body_part: str = Form("chest"),
    view_position: str = Form("PA"),
    clinical_indication: Optional[str] = Form(None),
    upload_notes: Optional[str] = Form(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload an X-ray image. Validates, stores in S3, records metadata in RDS."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)

    # Resolve patient
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(404, f"Patient {patient_id} not found")

    # Ensure doctor has access
    if not _check_patient_access(db, doctor, patient):
        raise HTTPException(403, "You are not authorized to upload records for this patient")

    # Read file
    file_bytes = await file.read()
    file_size = len(file_bytes)
    content_type = file.content_type or "image/jpeg"

    # Validate
    valid, msg = validate_image_file(file.filename or "upload.jpg", content_type, file_size)
    if not valid:
        raise HTTPException(400, msg)

    # Build IDs and S3 key
    xray_uuid = str(uuid.uuid4())
    xray_id = generate_xray_id(db)
    s3_key = build_xray_s3_key(patient.patient_id, xray_uuid, file.filename or "xray.jpg")

    # Upload to S3
    uploaded = upload_file_to_s3(
        file_bytes,
        s3_key,
        content_type=content_type,
        metadata={
            "patient_id": patient.patient_id,
            "doctor_id": doctor.doctor_id,
            "xray_id": xray_id,
            "body_part": body_part,
            "uploaded_by": "doctor",
        },
    )
    record_xray_upload(success=uploaded)

    if not uploaded:
        raise HTTPException(503, "Failed to store image in cloud storage. Please retry.")

    from app.core.config import settings as cfg

    # Save metadata to RDS
    xray = XrayImage(
        id=xray_uuid,
        xray_id=xray_id,
        patient_id=patient.id,
        doctor_id=doctor.id,
        s3_key=s3_key,
        s3_bucket=cfg.S3_BUCKET_NAME,
        original_filename=file.filename,
        file_size_bytes=file_size,
        content_type=content_type,
        body_part=body_part,
        view_position=view_position,
        clinical_indication=clinical_indication,
        upload_notes=upload_notes,
        analysis_status="not_requested",
    )
    db.add(xray)
    db.commit()
    db.refresh(xray)

    logger.info(f"X-ray uploaded: {xray_id} for patient {patient_id} by doctor {doctor.doctor_id}")

    resp = XrayResponse.model_validate(xray)
    resp.patient_id = patient.patient_id
    resp.s3_key = "[secured]"
    return resp


# ─────────────────────────────── AI Analysis ─────────────────────────────────

@router.post("/xrays/{xray_id}/analyze", response_model=AnalysisResponse)
def request_ai_analysis(
    xray_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Request AI analysis for an uploaded X-ray."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)

    xray = db.query(XrayImage).filter(XrayImage.xray_id == xray_id).first()
    if not xray:
        raise HTTPException(404, "X-ray not found")

    # Check authorization
    patient = db.query(Patient).filter(Patient.id == xray.patient_id).first()
    if not _check_patient_access(db, doctor, patient):
        raise HTTPException(403, "Not authorized for this patient's records")

    # Check model availability
    model_status = get_model_status()
    analysis_id = generate_analysis_id(db)

    # Create analysis record
    analysis = AIAnalysis(
        analysis_id=analysis_id,
        xray_id=xray.id,
        doctor_id=doctor.id,
        model_name=model_status["model_name"],
        model_version=model_status["model_version"],
        status="pending" if not model_status["model_available"] else "running",
    )
    db.add(analysis)
    xray.analysis_status = "processing"
    db.commit()

    if not model_status["model_available"]:
        analysis.status = "failed"
        analysis.error_message = "AI model is not currently loaded. Analysis unavailable."
        xray.analysis_status = "failed"
        db.commit()
        return AnalysisResponse.model_validate(analysis)

    # Download image from S3
    from app.services.s3_service import download_s3_object
    image_bytes = download_s3_object(xray.s3_key)
    if not image_bytes:
        analysis.status = "failed"
        analysis.error_message = "Could not retrieve image from storage."
        xray.analysis_status = "failed"
        db.commit()
        raise HTTPException(503, "Could not retrieve X-ray image for analysis")

    # Run inference
    result = analyze_xray(image_bytes, patient.patient_id, analysis_id)

    # Update analysis record
    analysis.status = result["status"]
    analysis.predictions = result["predictions"]
    analysis.confidence_scores = result["confidence_scores"]
    analysis.top_prediction = result["top_prediction"]
    analysis.top_confidence = result["top_confidence"]
    analysis.gradcam_s3_key = result.get("gradcam_s3_key")
    analysis.inference_duration_ms = result.get("inference_duration_ms")
    analysis.error_message = result.get("error_message")
    xray.analysis_status = "completed" if result["status"] == "completed" else "failed"
    db.commit()
    db.refresh(analysis)

    resp = AnalysisResponse.model_validate(analysis)
    resp.xray_id = xray.xray_id

    # Generate presigned URL for GradCAM if available
    if analysis.gradcam_s3_key:
        resp.gradcam_presigned_url = generate_presigned_url(analysis.gradcam_s3_key, 900)

    return resp


@router.put("/analyses/{analysis_id}/review")
def review_analysis(
    analysis_id: str,
    payload: AnalysisReviewRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Doctor adds clinical notes to an AI analysis."""
    _require_doctor(current_user)
    analysis = db.query(AIAnalysis).filter(AIAnalysis.analysis_id == analysis_id).first()
    if not analysis:
        raise HTTPException(404, "Analysis not found")
    analysis.doctor_reviewed = payload.doctor_reviewed
    analysis.doctor_review_notes = payload.doctor_review_notes
    analysis.doctor_reviewed_at = datetime.now(timezone.utc)
    db.commit()
    return MessageResponse(message="Analysis review saved")


# ─────────────────────────────── Consultations ───────────────────────────────

@router.post("/consultations", response_model=ConsultationResponse)
def create_consultation(
    payload: ConsultationCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a consultation record for a patient."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)
    patient = db.query(Patient).filter(Patient.patient_id == payload.patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    if not _check_patient_access(db, doctor, patient):
        raise HTTPException(403, "Not authorized for this patient")
    c = Consultation(
        consultation_id=generate_consultation_id(db),
        patient_id=patient.id,
        doctor_id=doctor.id,
        consultation_date=payload.consultation_date,
        chief_complaint=payload.chief_complaint,
        history_of_present_illness=payload.history_of_present_illness,
        examination_findings=payload.examination_findings,
        assessment=payload.assessment,
        plan=payload.plan,
        follow_up_required=payload.follow_up_required,
        follow_up_date=payload.follow_up_date,
        status="completed",
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    resp = ConsultationResponse.model_validate(c)
    resp.patient_id = patient.patient_id
    return resp


# ─────────────────────────────── Reports ─────────────────────────────────────

@router.post("/reports", response_model=ReportResponse)
def create_report(
    payload: ReportCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a draft medical report for a patient."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)
    patient = db.query(Patient).filter(Patient.patient_id == payload.patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    if not _check_patient_access(db, doctor, patient):
        raise HTTPException(403, "Not authorized for this patient")

    report = MedicalReport(
        report_id=generate_report_id(db),
        patient_id=patient.id,
        doctor_id=doctor.id,
        title=payload.title,
        report_type=payload.report_type,
        summary=payload.summary,
        clinical_findings=payload.clinical_findings,
        recommendations=payload.recommendations,
        ai_analysis_included=payload.ai_analysis_included,
        status="draft",
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    resp = ReportResponse.model_validate(report)
    resp.patient_id = patient.patient_id
    return resp


@router.post("/reports/{report_id}/approve", response_model=ReportResponse)
def approve_report(
    report_id: str,
    payload: ReportApprove,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve a draft report and generate a PDF."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)
    report = (
        db.query(MedicalReport)
        .filter(
            MedicalReport.report_id == report_id,
            MedicalReport.doctor_id == doctor.id,
        )
        .first()
    )
    if not report:
        raise HTTPException(404, "Report not found or access denied")

    patient = db.query(Patient).filter(Patient.id == report.patient_id).first()

    # Generate PDF and upload to S3
    pdf_bytes = generate_report_pdf(report, doctor, patient)
    if pdf_bytes:
        from app.services.s3_service import build_report_s3_key, upload_file_to_s3
        from app.core.config import settings as cfg
        pdf_key = build_report_s3_key(patient.patient_id, report.report_id)
        uploaded = upload_file_to_s3(pdf_bytes, pdf_key, content_type="application/pdf")
        if uploaded:
            report.pdf_s3_key = pdf_key
            report.pdf_s3_bucket = cfg.S3_BUCKET_NAME

    report.status = "approved"
    report.is_patient_viewable = payload.is_patient_viewable
    report.approved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(report)

    # Notify patient
    if patient and payload.is_patient_viewable:
        notif = Notification(
            patient_id=patient.id,
            title="Medical Report Ready",
            message=f"Your report '{report.title}' has been approved by your doctor.",
            notification_type="report_ready",
            related_entity_type="report",
            related_entity_id=report.report_id,
        )
        db.add(notif)
        db.commit()

    resp = ReportResponse.model_validate(report)
    resp.patient_id = patient.patient_id if patient else ""
    if report.pdf_s3_key:
        resp.pdf_presigned_url = generate_presigned_url(report.pdf_s3_key, 300)
    return resp


# ─────────────────────────────── Appointments ────────────────────────────────

@router.post("/appointments", response_model=AppointmentResponse)
def schedule_appointment(
    payload: AppointmentCreate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Schedule a follow-up appointment."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)
    patient = db.query(Patient).filter(Patient.patient_id == payload.patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    appt = Appointment(
        appointment_id=generate_appointment_id(db),
        patient_id=patient.id,
        doctor_id=doctor.id,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes,
        purpose=payload.purpose,
        status="scheduled",
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    resp = AppointmentResponse.model_validate(appt)
    resp.patient_id = patient.patient_id
    return resp


@router.get("/me/profile")
def get_doctor_profile(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the authenticated doctor's profile."""
    _require_doctor(current_user)
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(404, "Doctor profile not found")
    return {
        "id": doctor.id,
        "doctor_id": doctor.doctor_id,
        "first_name": doctor.first_name,
        "last_name": doctor.last_name,
        "specialization": doctor.specialization,
        "license_number": doctor.license_number,
        "phone": doctor.phone,
        "bio": doctor.bio,
        "years_experience": doctor.years_experience,
        "is_approved": doctor.is_approved,
        "email": current_user.email,
    }
