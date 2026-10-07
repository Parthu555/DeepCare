"""
Pydantic schemas for all DeepCare API request/response models.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, EmailStr, field_validator, model_validator
import re


# ─────────────────────────────── Auth ────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    user_id: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ─────────────────────────────── User ────────────────────────────────────────

class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str
    role: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("patient", "doctor", "admin"):
            raise ValueError("Role must be patient, doctor, or admin")
        return v


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────── Patient ─────────────────────────────────────

class PatientRegistration(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_names(cls, v: str) -> str:
        v_stripped = v.strip()
        if not v_stripped:
            raise ValueError("Name cannot be empty")
        return v_stripped


class PatientProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None


class PatientResponse(BaseModel):
    id: str
    patient_id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    date_of_birth: Optional[datetime] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PatientSummary(BaseModel):
    id: str
    patient_id: str
    first_name: str
    last_name: str
    gender: Optional[str] = None
    date_of_birth: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─────────────────────────────── Doctor ──────────────────────────────────────

class DoctorRegistration(BaseModel):
    email: EmailStr
    password: str
    first_name: str
    last_name: str
    specialization: str
    license_number: Optional[str] = None
    phone: Optional[str] = None
    years_experience: Optional[int] = None
    bio: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one digit")
        return v

    @field_validator("first_name", "last_name", "specialization")
    @classmethod
    def validate_strings(cls, v: str) -> str:
        v_stripped = v.strip()
        if not v_stripped:
            raise ValueError("Field cannot be empty")
        return v_stripped


class DoctorProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    specialization: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    years_experience: Optional[int] = None


class DoctorResponse(BaseModel):
    id: str
    doctor_id: str
    first_name: str
    last_name: str
    specialization: str
    license_number: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    years_experience: Optional[int] = None
    is_approved: bool
    department_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────── X-ray ───────────────────────────────────────

class XrayUploadMetadata(BaseModel):
    patient_id: str  # Patient's patient_id string like "DC-12345678"
    body_part: Optional[str] = "chest"
    view_position: Optional[str] = "PA"
    clinical_indication: Optional[str] = None
    upload_notes: Optional[str] = None


class XrayResponse(BaseModel):
    id: str
    xray_id: str
    patient_id: str
    doctor_id: str
    s3_key: str
    original_filename: Optional[str] = None
    body_part: Optional[str] = None
    view_position: Optional[str] = None
    clinical_indication: Optional[str] = None
    analysis_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class XrayDetailResponse(XrayResponse):
    presigned_url: Optional[str] = None
    analyses: List[Dict[str, Any]] = []


class XrayPresignedResponse(BaseModel):
    xray_id: str
    presigned_url: str
    expires_in: int


# ─────────────────────────────── AI Analysis ─────────────────────────────────

class AnalysisRequest(BaseModel):
    xray_id: str  # Internal UUID or xray_id string


class AnalysisResponse(BaseModel):
    id: str
    analysis_id: str
    xray_id: str
    model_name: str
    model_version: str
    predictions: Optional[Dict[str, float]] = None
    confidence_scores: Optional[Dict[str, float]] = None
    top_prediction: Optional[str] = None
    top_confidence: Optional[float] = None
    gradcam_presigned_url: Optional[str] = None
    status: str
    inference_duration_ms: Optional[float] = None
    doctor_reviewed: bool
    doctor_review_notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AnalysisReviewRequest(BaseModel):
    doctor_review_notes: str
    doctor_reviewed: bool = True


# ─────────────────────────────── Medical Report ──────────────────────────────

class ReportCreate(BaseModel):
    patient_id: str
    xray_id: Optional[str] = None
    analysis_id: Optional[str] = None
    consultation_id: Optional[str] = None
    title: str
    report_type: str = "radiology"
    summary: Optional[str] = None
    clinical_findings: Optional[str] = None
    recommendations: Optional[str] = None
    ai_analysis_included: bool = False


class ReportApprove(BaseModel):
    is_patient_viewable: bool = True


class ReportResponse(BaseModel):
    id: str
    report_id: str
    patient_id: str
    doctor_id: str
    title: str
    report_type: str
    summary: Optional[str] = None
    clinical_findings: Optional[str] = None
    recommendations: Optional[str] = None
    status: str
    is_patient_viewable: bool
    pdf_presigned_url: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────── Consultation ────────────────────────────────

class ConsultationCreate(BaseModel):
    patient_id: str
    consultation_date: datetime
    chief_complaint: Optional[str] = None
    history_of_present_illness: Optional[str] = None
    examination_findings: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    follow_up_required: bool = False
    follow_up_date: Optional[datetime] = None


class ConsultationResponse(BaseModel):
    id: str
    consultation_id: str
    patient_id: str
    doctor_id: str
    consultation_date: datetime
    chief_complaint: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────── Appointment ─────────────────────────────────

class AppointmentCreate(BaseModel):
    patient_id: str
    scheduled_at: datetime
    duration_minutes: int = 30
    purpose: Optional[str] = None


class AppointmentResponse(BaseModel):
    id: str
    appointment_id: str
    patient_id: str
    doctor_id: str
    scheduled_at: datetime
    duration_minutes: int
    purpose: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─────────────────────────────── Admin ───────────────────────────────────────

class DoctorApproval(BaseModel):
    approved: bool
    notes: Optional[str] = None


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = None


class DepartmentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AdminStatsResponse(BaseModel):
    total_patients: int
    total_doctors: int
    approved_doctors: int
    pending_doctors: int
    total_xrays: int
    total_analyses: int
    total_reports: int
    approved_reports: int
    total_consultations: int
    recent_activity: List[Dict[str, Any]]


# ─────────────────────────────── Pagination ──────────────────────────────────

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    page_size: int
    pages: int


# ─────────────────────────────── Common ──────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    detail: Optional[str] = None


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None
