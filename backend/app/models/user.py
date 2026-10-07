"""
SQLAlchemy ORM Models — DeepCare Database Schema
All tables for users, patients, doctors, xrays, AI analyses, reports, etc.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey,
    Index, Integer, JSON, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


def new_uuid():
    return str(uuid.uuid4())


# ─────────────────────────────── users ───────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum("patient", "doctor", "admin", name="user_role_enum"), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    failed_login_attempts = Column(Integer, default=0)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    patient_profile = relationship("Patient", back_populates="user", uselist=False)
    doctor_profile = relationship("Doctor", back_populates="user", uselist=False, foreign_keys="Doctor.user_id")
    audit_logs = relationship("AuditLog", back_populates="user")

    def __repr__(self):
        return f"<User {self.email} [{self.role}]>"


# ─────────────────────────────── departments ─────────────────────────────────

class Department(Base):
    __tablename__ = "departments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    head_doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id", use_alter=True, name="fk_dept_head_doc"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    doctors = relationship("Doctor", back_populates="department", foreign_keys="Doctor.department_id")

    def __repr__(self):
        return f"<Department {self.name}>"


# ─────────────────────────────── doctors ─────────────────────────────────────

class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), unique=True, nullable=False)
    doctor_id = Column(String(20), unique=True, nullable=False, index=True)  # e.g. DOC-000001
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    specialization = Column(String(150), nullable=False)
    license_number = Column(String(50), unique=True, nullable=True)
    phone = Column(String(20), nullable=True)
    department_id = Column(UUID(as_uuid=False), ForeignKey("departments.id"), nullable=True)
    bio = Column(Text, nullable=True)
    years_experience = Column(Integer, nullable=True)
    is_approved = Column(Boolean, default=False)  # Admin must approve
    approved_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    avatar_s3_key = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="doctor_profile", foreign_keys=[user_id])
    department = relationship("Department", back_populates="doctors", foreign_keys=[department_id])
    xray_uploads = relationship("XrayImage", back_populates="doctor")
    consultations = relationship("Consultation", back_populates="doctor")
    reports = relationship("MedicalReport", back_populates="doctor")
    patient_assignments = relationship("PatientDoctorAssignment", back_populates="doctor")
    appointments = relationship("Appointment", back_populates="doctor")
    ai_analyses = relationship("AIAnalysis", back_populates="doctor")

    def full_name(self) -> str:
        return f"Dr. {self.first_name} {self.last_name}"

    def __repr__(self):
        return f"<Doctor {self.doctor_id} {self.full_name()}>"


# ─────────────────────────────── patients ────────────────────────────────────

class Patient(Base):
    __tablename__ = "patients"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), unique=True, nullable=False)
    patient_id = Column(String(20), unique=True, nullable=False, index=True)  # e.g. DC-12345678
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    date_of_birth = Column(DateTime(timezone=True), nullable=True)
    gender = Column(Enum("male", "female", "other", "prefer_not_to_say", name="gender_enum"), nullable=True)
    blood_group = Column(String(10), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    emergency_contact_name = Column(String(200), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    allergies = Column(Text, nullable=True)
    chronic_conditions = Column(Text, nullable=True)
    avatar_s3_key = Column(String(500), nullable=True)
    s3_prefix = Column(String(500), nullable=True)  # patients/{patient_id}/
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="patient_profile")
    xray_images = relationship("XrayImage", back_populates="patient")
    consultations = relationship("Consultation", back_populates="patient")
    reports = relationship("MedicalReport", back_populates="patient")
    doctor_assignments = relationship("PatientDoctorAssignment", back_populates="patient")
    appointments = relationship("Appointment", back_populates="patient")
    notifications = relationship("Notification", back_populates="patient")

    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    def __repr__(self):
        return f"<Patient {self.patient_id} {self.full_name()}>"


# ──────────────────────── patient-doctor assignments ─────────────────────────

class PatientDoctorAssignment(Base):
    __tablename__ = "patient_doctor_assignments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    assigned_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    assigned_at = Column(DateTime(timezone=True), default=utcnow)
    revoked_at = Column(DateTime(timezone=True), nullable=True)

    patient = relationship("Patient", back_populates="doctor_assignments")
    doctor = relationship("Doctor", back_populates="patient_assignments")

    __table_args__ = (
        UniqueConstraint("patient_id", "doctor_id", name="uq_patient_doctor"),
        Index("ix_patient_doctor", "patient_id", "doctor_id"),
    )


# ─────────────────────────────── xray images ─────────────────────────────────

class XrayImage(Base):
    __tablename__ = "xray_images"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    xray_id = Column(String(20), unique=True, nullable=False, index=True)  # e.g. XR-20240101-001
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    s3_key = Column(String(1000), nullable=False)  # Full S3 object key
    s3_bucket = Column(String(255), nullable=False)
    original_filename = Column(String(500), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    content_type = Column(String(100), nullable=True)
    body_part = Column(String(100), nullable=True)  # "chest", "hand", etc.
    view_position = Column(String(50), nullable=True)  # "PA", "AP", "lateral"
    clinical_indication = Column(Text, nullable=True)
    upload_notes = Column(Text, nullable=True)
    analysis_status = Column(
        Enum("pending", "processing", "completed", "failed", "not_requested", name="analysis_status_enum"),
        default="not_requested"
    )
    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    patient = relationship("Patient", back_populates="xray_images")
    doctor = relationship("Doctor", back_populates="xray_uploads")
    analyses = relationship("AIAnalysis", back_populates="xray")

    __table_args__ = (Index("ix_xray_patient", "patient_id"),)


# ─────────────────────────────── AI analyses ─────────────────────────────────

class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    analysis_id = Column(String(30), unique=True, nullable=False, index=True)
    xray_id = Column(UUID(as_uuid=False), ForeignKey("xray_images.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    model_name = Column(String(100), nullable=False)
    model_version = Column(String(50), nullable=False)
    predictions = Column(JSON, nullable=True)  # {condition: probability}
    confidence_scores = Column(JSON, nullable=True)
    top_prediction = Column(String(200), nullable=True)
    top_confidence = Column(Float, nullable=True)
    gradcam_s3_key = Column(String(1000), nullable=True)  # GradCAM heatmap stored in S3
    inference_duration_ms = Column(Float, nullable=True)
    status = Column(
        Enum("pending", "running", "completed", "failed", name="ai_status_enum"),
        default="pending"
    )
    error_message = Column(Text, nullable=True)
    doctor_reviewed = Column(Boolean, default=False)
    doctor_review_notes = Column(Text, nullable=True)
    doctor_reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    xray = relationship("XrayImage", back_populates="analyses")
    doctor = relationship("Doctor", back_populates="ai_analyses")

    __table_args__ = (Index("ix_analysis_xray", "xray_id"),)


# ─────────────────────────────── consultations ───────────────────────────────

class Consultation(Base):
    __tablename__ = "consultations"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    consultation_id = Column(String(20), unique=True, nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    consultation_date = Column(DateTime(timezone=True), nullable=False)
    chief_complaint = Column(Text, nullable=True)
    history_of_present_illness = Column(Text, nullable=True)
    examination_findings = Column(Text, nullable=True)
    assessment = Column(Text, nullable=True)
    plan = Column(Text, nullable=True)
    diagnosis_codes = Column(JSON, nullable=True)  # ICD-10 codes
    follow_up_required = Column(Boolean, default=False)
    follow_up_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(
        Enum("scheduled", "in_progress", "completed", "cancelled", name="consultation_status_enum"),
        default="scheduled"
    )
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    patient = relationship("Patient", back_populates="consultations")
    doctor = relationship("Doctor", back_populates="consultations")
    prescriptions = relationship("Prescription", back_populates="consultation")


# ─────────────────────────────── prescriptions ───────────────────────────────

class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    consultation_id = Column(UUID(as_uuid=False), ForeignKey("consultations.id"), nullable=False)
    medication_name = Column(String(200), nullable=False)
    dosage = Column(String(100), nullable=True)
    frequency = Column(String(100), nullable=True)
    duration = Column(String(100), nullable=True)
    instructions = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    consultation = relationship("Consultation", back_populates="prescriptions")


# ─────────────────────────────── medical reports ─────────────────────────────

class MedicalReport(Base):
    __tablename__ = "medical_reports"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    report_id = Column(String(20), unique=True, nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    xray_id = Column(UUID(as_uuid=False), ForeignKey("xray_images.id"), nullable=True)
    analysis_id = Column(UUID(as_uuid=False), ForeignKey("ai_analyses.id"), nullable=True)
    consultation_id = Column(UUID(as_uuid=False), ForeignKey("consultations.id"), nullable=True)
    title = Column(String(300), nullable=False)
    report_type = Column(
        Enum("radiology", "consultation", "lab", "discharge", "general", name="report_type_enum"),
        default="radiology"
    )
    summary = Column(Text, nullable=True)
    clinical_findings = Column(Text, nullable=True)
    recommendations = Column(Text, nullable=True)
    ai_analysis_included = Column(Boolean, default=False)
    status = Column(
        Enum("draft", "pending_approval", "approved", "rejected", name="report_status_enum"),
        default="draft"
    )
    pdf_s3_key = Column(String(1000), nullable=True)
    pdf_s3_bucket = Column(String(255), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    is_patient_viewable = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    patient = relationship("Patient", back_populates="reports")
    doctor = relationship("Doctor", back_populates="reports")

    __table_args__ = (Index("ix_report_patient", "patient_id"),)


# ─────────────────────────────── appointments ────────────────────────────────

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    appointment_id = Column(String(20), unique=True, nullable=False, index=True)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=False)
    doctor_id = Column(UUID(as_uuid=False), ForeignKey("doctors.id"), nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=False)
    duration_minutes = Column(Integer, default=30)
    purpose = Column(Text, nullable=True)
    status = Column(
        Enum("scheduled", "confirmed", "completed", "cancelled", "no_show", name="appt_status_enum"),
        default="scheduled"
    )
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    patient = relationship("Patient", back_populates="appointments")
    doctor = relationship("Doctor", back_populates="appointments")


# ─────────────────────────────── notifications ───────────────────────────────

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    patient_id = Column(UUID(as_uuid=False), ForeignKey("patients.id"), nullable=True)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    title = Column(String(300), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), default="info")  # info, alert, report_ready
    is_read = Column(Boolean, default=False)
    related_entity_type = Column(String(50), nullable=True)  # xray, report, appointment
    related_entity_id = Column(String(50), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    patient = relationship("Patient", back_populates="notifications")


# ─────────────────────────────── audit logs ──────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=new_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False)  # e.g. "patient.view", "xray.upload"
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(String(100), nullable=True)
    patient_id = Column(String(100), nullable=True)  # patient_id string, not FK
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(500), nullable=True)
    status = Column(String(20), default="success")  # success, denied, error
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    user = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_user", "user_id"),
        Index("ix_audit_patient", "patient_id"),
        Index("ix_audit_created", "created_at"),
    )
