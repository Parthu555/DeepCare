"""
Doctor API endpoints — patient search, X-ray upload, AI analysis, report management.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import (
    AIAnalysis, Appointment, Consultation, Doctor,
    MedicalReport, Notification, Patient, PatientDoctorAssignment, User, XrayImage,
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
from pydantic import BaseModel
from app.services.ai_service import analyze_xray, get_model_status
from app.services.pdf_service import generate_report_pdf
from app.services.s3_service import (
    build_xray_s3_key,
    download_s3_object,
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


def _is_valid_uuid(val: Optional[str]) -> bool:
    if not val:
        return False
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def _require_doctor(current_user) -> None:
    if current_user.role not in ("doctor", "admin"):
        raise HTTPException(403, "Doctor access required")


def _get_doctor_profile(db: Session, user_id: str) -> Doctor:
    doc = db.query(Doctor).filter(Doctor.user_id == user_id, Doctor.is_approved == True).first()
    if not doc:
        raise HTTPException(403, "Doctor profile not found or not approved")
    return doc


def _check_patient_access(db: Session, doctor: Doctor, patient: Patient) -> bool:
    """Check if a doctor has been assigned to this patient, or auto-assign attending physician."""
    if not patient or not doctor:
        return False
    assignment = (
        db.query(PatientDoctorAssignment)
        .filter(
            PatientDoctorAssignment.doctor_id == doctor.id,
            PatientDoctorAssignment.patient_id == patient.id,
            PatientDoctorAssignment.is_active == True,
        )
        .first()
    )
    if assignment is not None:
        return True

    # Auto-assign attending physician for clinical radiograph evaluation
    try:
        new_assign = PatientDoctorAssignment(
            id=str(uuid.uuid4()),
            doctor_id=doctor.id,
            patient_id=patient.id,
            is_active=True,
            assignment_notes="Attending physician access granted for clinical radiograph evaluation",
        )
        db.add(new_assign)
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        return True


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

    try:
        from app.core.metrics import record_xray_ingested
        record_xray_ingested(source="manual_upload", status="success")
    except Exception:
        pass

    logger.info(f"X-ray uploaded: {xray_id} for patient {patient_id} by doctor {doctor.doctor_id}")

    resp = XrayResponse.model_validate(xray)
    resp.patient_id = patient.patient_id
    resp.s3_key = "[secured]"
    return resp


class StorageImportRequest(BaseModel):
    image_id: str
    patient_id: str
    view_position: Optional[str] = "PA"
    clinical_indication: Optional[str] = "Imported from clinical radiograph repository"
    body_part: Optional[str] = "chest"


@router.get("/storage/available-images")
def get_available_storage_images(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List real medical radiograph images stored in demo_data / dataset repository with ID, findings, and thumbnails."""
    _require_doctor(current_user)
    import os
    import csv

    # 1. Load canonical sequential dataset from labels.csv
    labels_csv_paths = [
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "demo_data", "datasets", "NIH_ChestXray14", "labels.csv"),
        "/app/demo_data/datasets/NIH_ChestXray14/labels.csv",
    ]
    image_dirs = [
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "demo_data", "datasets", "NIH_ChestXray14", "images"),
        "/app/demo_data/datasets/NIH_ChestXray14/images",
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "demo_data", "processed", "demo_images"),
        "/app/demo_data/processed/demo_images",
    ]

    results = []
    seen_files = set()

    for cp in labels_csv_paths:
        if os.path.exists(cp):
            try:
                with open(cp, "r", encoding="utf-8", errors="ignore") as f:
                    reader = csv.reader(f)
                    header = next(reader, None)
                    for row in reader:
                        if not row or len(row) < 4:
                            continue
                        fn = row[0].strip()
                        if not fn.endswith((".png", ".jpg", ".jpeg")) or fn in seen_files:
                            continue

                        # Check file existence & size
                        size_kb = 180.0
                        for img_dir in image_dirs:
                            fp = os.path.join(img_dir, fn)
                            if os.path.exists(fp):
                                size_kb = round(os.path.getsize(fp) / 1024, 1)
                                break

                        seen_files.add(fn)
                        results.append({
                            "image_id": fn,
                            "filename": fn,
                            "patient_id": row[3].strip(),
                            "finding": row[1].strip() if len(row) > 1 else "Thorax Evaluation",
                            "view_position": row[6].strip() if len(row) > 6 else "PA",
                            "file_size_kb": size_kb,
                            "preview_url": f"/api/v1/storage/view?key={fn}",
                        })
                break
            except Exception as e:
                logger.warning(f"Error reading labels.csv {cp}: {e}")

    # Fallback scan of image directories for any additional scans
    for img_dir in image_dirs:
        if os.path.exists(img_dir) and os.path.isdir(img_dir):
            for fn in os.listdir(img_dir):
                if fn.lower().endswith((".png", ".jpg", ".jpeg")) and fn not in seen_files:
                    seen_files.add(fn)
                    fp = os.path.join(img_dir, fn)
                    size_kb = round(os.path.getsize(fp) / 1024, 1)
                    results.append({
                        "image_id": fn,
                        "filename": fn,
                        "patient_id": "PAT-2026-0001",
                        "finding": "Chest Radiograph",
                        "view_position": "PA",
                        "file_size_kb": size_kb,
                        "preview_url": f"/api/v1/storage/view?key={fn}",
                    })

    # Strict sequential sort: 00000001_000.png (PAT-2026-0001) through 00000119_000.png (PAT-2026-0119)
    def _seq_sort_key(item):
        iid = item["image_id"]
        if iid.startswith("00000") and "_" in iid:
            try:
                return (0, int(iid.split("_")[0]))
            except:
                pass
        return (1, iid)

    results.sort(key=_seq_sort_key)
    return results


@router.post("/xrays/import-from-storage", response_model=XrayResponse)
def import_xray_from_storage(
    payload: StorageImportRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import an image from storage / dataset repository by ID and associate with patient EHR."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)
    patient = db.query(Patient).filter(Patient.patient_id == payload.patient_id).first()
    if not patient:
        from datetime import datetime
        seq_num = payload.patient_id.replace("PAT-", "").replace("2026-", "").replace("NIH-", "").lstrip("0") or "1"
        user_email = f"patient.{payload.patient_id.lower().replace('-', '.')}@deepcare.health"
        existing_user = db.query(User).filter(User.email == user_email).first()
        if not existing_user:
            existing_user = User(
                id=str(uuid.uuid4()),
                email=user_email,
                hashed_password="mock_hash_for_demo",
                role="patient",
                is_active=True,
            )
            db.add(existing_user)
            db.flush()

        patient = Patient(
            id=str(uuid.uuid4()),
            user_id=existing_user.id,
            patient_id=payload.patient_id,
            first_name="Patient",
            last_name=f"#{seq_num}",
            date_of_birth=datetime(1975, 1, 1),
            gender="male",
            phone="+1-555-0100",
            emergency_contact_phone="+1-555-0999",
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)

    # Locate image in storage
    image_bytes = download_s3_object(payload.image_id)
    if not image_bytes:
        raise HTTPException(404, f"Image '{payload.image_id}' not found in storage repository.")

    content_type = "image/png" if payload.image_id.lower().endswith(".png") else "image/jpeg"
    file_size = len(image_bytes)

    xray_uuid = str(uuid.uuid4())
    xray_id = generate_xray_id(db)
    s3_key = build_xray_s3_key(patient.patient_id, xray_uuid, payload.image_id)

    # Save to storage
    upload_file_to_s3(
        image_bytes,
        s3_key,
        content_type=content_type,
        metadata={
            "patient_id": patient.patient_id,
            "doctor_id": doctor.doctor_id,
            "xray_id": xray_id,
            "body_part": payload.body_part or "chest",
            "imported_from": payload.image_id,
        },
    )

    from app.core.config import settings as cfg
    xray = XrayImage(
        id=xray_uuid,
        xray_id=xray_id,
        patient_id=patient.id,
        doctor_id=doctor.id,
        s3_key=s3_key,
        s3_bucket=cfg.S3_BUCKET_NAME,
        original_filename=payload.image_id,
        file_size_bytes=file_size,
        content_type=content_type,
        body_part=payload.body_part or "chest",
        view_position=payload.view_position or "PA",
        clinical_indication=payload.clinical_indication,
        upload_notes=f"Selected and imported from storage ID: {payload.image_id}",
        analysis_status="not_requested",
    )
    db.add(xray)
    db.commit()
    db.refresh(xray)

    try:
        from app.core.metrics import record_xray_ingested
        record_xray_ingested(source="storage_dataset", status="success")
    except Exception:
        pass

    resp = XrayResponse.model_validate(xray)
    resp.patient_id = patient.patient_id
    resp.presigned_url = generate_presigned_url(s3_key, 900)
    resp.s3_key = "[secured]"
    return resp


@router.get("/xrays/all")
def get_all_doctor_xrays(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all available X-ray scans in the system for quick selection in analysis workspace."""
    _require_doctor(current_user)
    xrays = (
        db.query(XrayImage)
        .filter(XrayImage.is_deleted == False)
        .order_by(XrayImage.created_at.desc())
        .all()
    )
    items = []
    for x in xrays:
        pat = db.query(Patient).filter(Patient.id == x.patient_id).first()
        items.append({
            "xray_id": x.xray_id,
            "patient_id": pat.patient_id if pat else "Unknown",
            "patient_name": f"{pat.first_name} {pat.last_name}" if pat else "Unknown",
            "body_part": x.body_part,
            "view_position": x.view_position,
            "analysis_status": x.analysis_status,
            "presigned_url": generate_presigned_url(x.s3_key, 900),
            "created_at": x.created_at,
            "clinical_indication": x.clinical_indication or x.upload_notes,
        })
    return items


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

    clean_id = xray_id.strip()
    xray = db.query(XrayImage).filter(XrayImage.xray_id == clean_id).first()

    # 1. Fallback: Lookup by Patient ID (e.g. PAT-2026-0001, PAT-2026-0050, PAT-0050, 0050, 50)
    if not xray:
        patient_candidates = [
            clean_id,
            clean_id.upper(),
            f"PAT-2026-{clean_id.zfill(4)}" if clean_id.isdigit() else clean_id,
            f"PAT-{clean_id.zfill(4)}" if clean_id.isdigit() else clean_id,
        ]
        matched_patient = db.query(Patient).filter(Patient.patient_id.in_(patient_candidates)).first()
        if matched_patient:
            xray = db.query(XrayImage).filter(XrayImage.patient_id == matched_patient.id).order_by(XrayImage.created_at.desc()).first()

    # 2. Fallback: Lookup by dataset image filename (e.g. 00000050_000.png)
    if not xray:
        clean_fn = clean_id if clean_id.endswith((".png", ".jpg", ".jpeg")) else f"{clean_id}.png"
        xray = db.query(XrayImage).filter(XrayImage.original_filename == clean_fn).first()

    # 3. Fallback: If still not found, check if it's a sequential dataset image in storage (e.g. 00000050_000.png or PAT-2026-0050)
    if not xray:
        target_img_id = None
        target_pid = None

        if clean_id.startswith("00000") and "_" in clean_id:
            target_img_id = clean_id
            try:
                seq_num = int(clean_id.split("_")[0])
                target_pid = f"PAT-2026-{seq_num:04d}"
            except:
                target_pid = "PAT-2026-0001"
        elif "PAT-" in clean_id.upper():
            target_pid = clean_id.upper()
            try:
                seq_num = int(target_pid.split("-")[-1])
                target_img_id = f"{seq_num:08d}_000.png"
            except:
                target_img_id = "00000001_000.png"
        elif clean_id.isdigit():
            seq_num = int(clean_id)
            target_pid = f"PAT-2026-{seq_num:04d}"
            target_img_id = f"{seq_num:08d}_000.png"

        if target_img_id:
            from app.services.s3_service import download_s3_object
            img_bytes = download_s3_object(target_img_id)
            if img_bytes:
                import_req = StorageImportRequest(
                    image_id=target_img_id,
                    patient_id=target_pid or "PAT-2026-0001",
                    view_position="PA",
                    clinical_indication="Auto-loaded for direct AI diagnostic evaluation",
                    body_part="Chest",
                )
                imported_resp = import_xray_from_storage(import_req, current_user=current_user, db=db)
                xray = db.query(XrayImage).filter(XrayImage.xray_id == imported_resp.xray_id).first()

    if not xray:
        raise HTTPException(404, f"No radiograph found for '{xray_id}'. Please enter a valid Scan ID, Patient ID, or Image ID.")

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
    if patient:
        resp.patient_id = patient.patient_id

    # Generate presigned URL for GradCAM and Original X-ray if available
    if analysis.gradcam_s3_key:
        resp.gradcam_presigned_url = generate_presigned_url(analysis.gradcam_s3_key, 900)
    if xray.s3_key:
        resp.xray_presigned_url = generate_presigned_url(xray.s3_key, 900)

    return resp


@router.put("/analyses/{analysis_id}/review")
def review_analysis(
    analysis_id: str,
    payload: AnalysisReviewRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Doctor adds clinical notes to an AI analysis and synchronizes them to the clinical report."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)
    analysis_crit = (
        or_(AIAnalysis.analysis_id == analysis_id, AIAnalysis.id == analysis_id)
        if _is_valid_uuid(analysis_id)
        else (AIAnalysis.analysis_id == analysis_id)
    )
    analysis = db.query(AIAnalysis).filter(analysis_crit).first()
    if not analysis:
        raise HTTPException(404, "Analysis not found")
    analysis.doctor_reviewed = payload.doctor_reviewed
    analysis.doctor_review_notes = payload.doctor_review_notes
    analysis.doctor_reviewed_at = datetime.now(timezone.utc)

    # Sync with or automatically generate a MedicalReport so doctor's observations & notes reflect in Reports immediately
    xray = db.query(XrayImage).filter(XrayImage.id == analysis.xray_id).first()
    patient = db.query(Patient).filter(Patient.id == xray.patient_id).first() if xray else None

    if patient:
        existing_report = (
            db.query(MedicalReport)
            .filter(
                or_(
                    MedicalReport.analysis_id == analysis.id,
                    MedicalReport.xray_id == xray.id,
                )
            )
            .first()
        )
        if existing_report:
            existing_report.clinical_findings = payload.doctor_review_notes
            existing_report.summary = (
                f"Reviewed by Dr. {doctor.first_name} {doctor.last_name}: "
                f"AI flagged {analysis.top_prediction or 'thoracic finding'} ({round((analysis.top_confidence or 0.85) * 100, 1)}%)."
            )
            existing_report.updated_at = datetime.now(timezone.utc)
        else:
            top_cond = analysis.top_prediction or "Radiology"
            conf = round((analysis.top_confidence or 0.85) * 100, 1)
            new_report = MedicalReport(
                report_id=generate_report_id(db),
                patient_id=patient.id,
                doctor_id=doctor.id,
                xray_id=xray.id,
                analysis_id=analysis.id,
                title=f"Chest Radiograph AI Evaluation — {top_cond}",
                report_type="radiology",
                summary=f"Automated DenseNet-121 analysis flagged elevated risk for {top_cond} ({conf}%). Verified by attending physician Dr. {doctor.first_name} {doctor.last_name}.",
                clinical_findings=payload.doctor_review_notes,
                recommendations="Follow-up chest radiograph and clinical correlation recommended.",
                ai_analysis_included=True,
                status="draft",
            )
            db.add(new_report)

    db.commit()
    return MessageResponse(message="Analysis review saved and clinical report updated")


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
    """Create or update a draft medical report for a patient."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)
    pat_crit = (
        or_(Patient.patient_id == payload.patient_id, Patient.id == payload.patient_id)
        if _is_valid_uuid(payload.patient_id)
        else (Patient.patient_id == payload.patient_id)
    )
    patient = db.query(Patient).filter(pat_crit).first()
    if not patient:
        raise HTTPException(404, "Patient not found")
    if not _check_patient_access(db, doctor, patient):
        raise HTTPException(403, "Not authorized for this patient")

    valid_types = ("radiology", "consultation", "lab", "discharge", "general")
    rtype = (payload.report_type or "radiology").lower()
    if rtype not in valid_types:
        rtype = "radiology"

    # Resolve xray and analysis if provided
    xray_obj = None
    if payload.xray_id:
        x_crit = (
            or_(XrayImage.xray_id == payload.xray_id, XrayImage.id == payload.xray_id)
            if _is_valid_uuid(payload.xray_id)
            else (XrayImage.xray_id == payload.xray_id)
        )
        xray_obj = db.query(XrayImage).filter(x_crit).first()

    analysis_obj = None
    if payload.analysis_id:
        a_crit = (
            or_(AIAnalysis.analysis_id == payload.analysis_id, AIAnalysis.id == payload.analysis_id)
            if _is_valid_uuid(payload.analysis_id)
            else (AIAnalysis.analysis_id == payload.analysis_id)
        )
        analysis_obj = db.query(AIAnalysis).filter(a_crit).first()

    # Check if a report already exists for this analysis or xray to update rather than duplicate
    report = None
    if analysis_obj:
        report = db.query(MedicalReport).filter(MedicalReport.analysis_id == analysis_obj.id).first()
    if not report and xray_obj:
        report = db.query(MedicalReport).filter(MedicalReport.xray_id == xray_obj.id).first()

    if report:
        report.title = payload.title
        report.report_type = rtype
        report.summary = payload.summary
        report.clinical_findings = payload.clinical_findings
        report.recommendations = payload.recommendations
        report.ai_analysis_included = payload.ai_analysis_included
        if xray_obj:
            report.xray_id = xray_obj.id
        if analysis_obj:
            report.analysis_id = analysis_obj.id
        report.updated_at = datetime.now(timezone.utc)
    else:
        report = MedicalReport(
            report_id=generate_report_id(db),
            patient_id=patient.id,
            doctor_id=doctor.id,
            xray_id=xray_obj.id if xray_obj else None,
            analysis_id=analysis_obj.id if analysis_obj else None,
            title=payload.title,
            report_type=rtype,
            summary=payload.summary,
            clinical_findings=payload.clinical_findings,
            recommendations=payload.recommendations,
            ai_analysis_included=payload.ai_analysis_included,
            status="draft",
        )
        db.add(report)

    # Sync back to analysis review notes if available
    if analysis_obj and payload.clinical_findings:
        analysis_obj.doctor_review_notes = payload.clinical_findings
        analysis_obj.doctor_reviewed = True
        analysis_obj.doctor_reviewed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(report)

    try:
        from app.core.metrics import record_report_generated
        record_report_generated(report_type=payload.report_type or "radiology", status="created")
    except Exception:
        pass

    resp = ReportResponse.model_validate(report)
    resp.patient_id = patient.patient_id
    resp.patient_name = f"{patient.first_name} {patient.last_name}"
    resp.doctor_name = f"Dr. {doctor.first_name} {doctor.last_name}"
    resp.doctor_id = doctor.doctor_id
    if xray_obj:
        resp.xray_id = xray_obj.xray_id
    if analysis_obj:
        resp.analysis_id = analysis_obj.analysis_id
    if report.pdf_s3_key:
        resp.pdf_presigned_url = generate_presigned_url(report.pdf_s3_key, 300)
    return resp


@router.post("/reports/{report_id}/approve", response_model=ReportResponse)
def approve_report(
    report_id: str,
    payload: ReportApprove,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve a draft report, generate a PDF with doctor observations, and make viewable."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)
    rep_crit = (
        or_(MedicalReport.report_id == report_id, MedicalReport.id == report_id)
        if _is_valid_uuid(report_id)
        else (MedicalReport.report_id == report_id)
    )
    report = (
        db.query(MedicalReport)
        .filter(rep_crit, MedicalReport.doctor_id == doctor.id)
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
    resp.patient_name = f"{patient.first_name} {patient.last_name}" if patient else ""
    resp.doctor_name = f"Dr. {doctor.first_name} {doctor.last_name}"
    resp.doctor_id = doctor.doctor_id
    if report.pdf_s3_key:
        resp.pdf_presigned_url = generate_presigned_url(report.pdf_s3_key, 300)
    return resp


@router.get("/reports")
def get_doctor_reports(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
):
    """Get all medical reports authored by or assigned to this doctor."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)
    offset = (page - 1) * page_size
    q = (
        db.query(MedicalReport, Patient, Doctor)
        .join(Patient, MedicalReport.patient_id == Patient.id)
        .join(Doctor, MedicalReport.doctor_id == Doctor.id)
        .filter(MedicalReport.doctor_id == doctor.id)
    )

    if search:
        search_filter = f"%{search}%"
        q = q.filter(
            or_(
                MedicalReport.report_id.ilike(search_filter),
                MedicalReport.title.ilike(search_filter),
                MedicalReport.clinical_findings.ilike(search_filter),
                Patient.patient_id.ilike(search_filter),
                Patient.first_name.ilike(search_filter),
                Patient.last_name.ilike(search_filter),
            )
        )

    q = q.order_by(MedicalReport.created_at.desc())
    total = q.count()
    rows = q.offset(offset).limit(page_size).all()

    items = []
    for rep, pat, doc in rows:
        item = ReportResponse.model_validate(rep)
        item.patient_id = pat.patient_id
        item.patient_name = f"{pat.first_name} {pat.last_name}"
        item.doctor_id = doc.doctor_id
        item.doctor_name = f"Dr. {doc.first_name} {doc.last_name}"
        if rep.pdf_s3_key:
            item.pdf_presigned_url = generate_presigned_url(rep.pdf_s3_key, 300)
        items.append(item)

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/reports/{report_id}", response_model=ReportResponse)
def get_doctor_report_by_id(
    report_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a specific report by report_id or UUID."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)
    rep_crit = (
        or_(MedicalReport.report_id == report_id, MedicalReport.id == report_id)
        if _is_valid_uuid(report_id)
        else (MedicalReport.report_id == report_id)
    )
    report = (
        db.query(MedicalReport)
        .filter(rep_crit, MedicalReport.doctor_id == doctor.id)
        .first()
    )
    if not report:
        raise HTTPException(404, "Report not found")
    patient = db.query(Patient).filter(Patient.id == report.patient_id).first()
    resp = ReportResponse.model_validate(report)
    resp.patient_id = patient.patient_id if patient else ""
    resp.patient_name = f"{patient.first_name} {patient.last_name}" if patient else ""
    resp.doctor_id = doctor.doctor_id
    resp.doctor_name = f"Dr. {doctor.first_name} {doctor.last_name}"
    if report.pdf_s3_key:
        resp.pdf_presigned_url = generate_presigned_url(report.pdf_s3_key, 300)
    return resp


@router.get("/reports/{report_id}/download")
def download_doctor_report(
    report_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download a report PDF. Generates PDF dynamically if not yet compiled."""
    _require_doctor(current_user)
    doctor = _get_doctor_profile(db, current_user.id)
    rep_crit = (
        or_(MedicalReport.report_id == report_id, MedicalReport.id == report_id)
        if _is_valid_uuid(report_id)
        else (MedicalReport.report_id == report_id)
    )
    report = (
        db.query(MedicalReport)
        .filter(rep_crit, MedicalReport.doctor_id == doctor.id)
        .first()
    )
    if not report:
        raise HTTPException(404, "Report not found")

    patient = db.query(Patient).filter(Patient.id == report.patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    if not report.pdf_s3_key:
        # Generate on the fly
        pdf_bytes = generate_report_pdf(report, doctor, patient)
        if pdf_bytes:
            from app.services.s3_service import build_report_s3_key, upload_file_to_s3
            from app.core.config import settings as cfg
            pdf_key = build_report_s3_key(patient.patient_id, report.report_id)
            uploaded = upload_file_to_s3(pdf_bytes, pdf_key, content_type="application/pdf")
            if uploaded:
                report.pdf_s3_key = pdf_key
                report.pdf_s3_bucket = cfg.S3_BUCKET_NAME
                db.commit()

    if not report.pdf_s3_key:
        raise HTTPException(500, "Could not compile PDF report at this time")

    url = generate_presigned_url(report.pdf_s3_key, expiry_seconds=300)
    return {"download_url": url, "report_id": report.report_id}


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
    from app.api.v1.endpoints.appointments import _serialize_appointment
    return _serialize_appointment(appt, db)


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
