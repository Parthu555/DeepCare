"""
Authentication endpoints — login, register (patient/doctor), refresh, logout.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    get_password_hash,
    verify_password,
)
from app.models.user import AuditLog, Doctor, Patient, User
from app.schemas.schemas import (
    DoctorRegistration,
    LoginRequest,
    MessageResponse,
    PatientRegistration,
    TokenResponse,
    RefreshTokenRequest,
)
from app.services.cloudwatch_service import record_auth_event
from app.utils.id_generator import generate_patient_id, generate_doctor_id

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = logging.getLogger(__name__)
security = HTTPBearer()


from sqlalchemy.exc import IntegrityError


def _log_audit(
    db: Session,
    user_id: str,
    action: str,
    ip: str,
    success: bool,
    details: dict = None,
):
    try:
        log = AuditLog(
            user_id=user_id,
            action=action,
            ip_address=ip,
            status="success" if success else "denied",
            details=details or {},
        )
        db.add(log)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.warning(f"Could not record audit log: {e}")


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Authenticate a user and return JWT tokens."""
    email_clean = payload.email.lower().strip()
    user = db.query(User).filter(User.email.ilike(email_clean)).first()
    ip = request.client.host if request.client else "unknown"

    if not user or not verify_password(payload.password, user.hashed_password):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            try:
                db.commit()
            except Exception:
                db.rollback()
        record_auth_event("login", success=False)
        _log_audit(db, user.id if user else None, "auth.login.failed", ip, False,
                   {"email": payload.email})
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    # For doctors, check approval
    if user.role == "doctor":
        doctor = db.query(Doctor).filter(Doctor.user_id == user.id).first()
        if not doctor or not doctor.is_approved:
            raise HTTPException(
                status_code=403,
                detail="Doctor account pending admin approval"
            )

    user.failed_login_attempts = 0
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    token_data = {"sub": user.id, "role": user.role, "email": user.email}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    record_auth_event("login", success=True)
    _log_audit(db, user.id, "auth.login.success", ip, True)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user.role,
        user_id=user.id,
    )


@router.post("/register/patient", response_model=MessageResponse, status_code=201)
def register_patient(
    payload: PatientRegistration,
    request: Request,
    db: Session = Depends(get_db),
):
    """Register a new patient. Generates a unique patient ID."""
    email_clean = payload.email.lower().strip()
    existing = db.query(User).filter(User.email.ilike(email_clean)).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    try:
        # Create User
        user = User(
            email=email_clean,
            hashed_password=get_password_hash(payload.password),
            role="patient",
            is_active=True,
            is_verified=False,
        )
        db.add(user)
        db.flush()

        # Generate unique patient ID
        patient_id = generate_patient_id(db)

        # Normalize gender if provided
        gender_val = payload.gender.lower().strip() if payload.gender else None
        if gender_val and gender_val not in ("male", "female", "other", "prefer_not_to_say"):
            gender_val = None

        # Create Patient profile
        patient = Patient(
            user_id=user.id,
            patient_id=patient_id,
            first_name=payload.first_name.strip(),
            last_name=payload.last_name.strip(),
            date_of_birth=payload.date_of_birth,
            gender=gender_val,
            blood_group=payload.blood_group,
            phone=payload.phone.strip() if payload.phone else None,
            address=payload.address.strip() if payload.address else None,
            s3_prefix=f"patients/{patient_id}/",
        )
        db.add(patient)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        logger.warning(f"Integrity error during patient registration: {e}")
        err_msg = str(e).lower()
        if "email" in err_msg or "users_email_key" in err_msg:
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        raise HTTPException(status_code=400, detail="Registration failed due to conflicting data.")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during patient registration: {e}")
        raise HTTPException(
            status_code=500,
            detail="Registration could not be completed. Please try again later."
        )

    logger.info(f"New patient registered: {patient_id}")
    record_auth_event("register_patient", success=True)

    return MessageResponse(
        message="Patient registered successfully",
        detail=f"Your Patient ID is {patient_id}. Please keep this for future reference.",
    )


@router.post("/register/doctor", response_model=MessageResponse, status_code=201)
def register_doctor(
    payload: DoctorRegistration,
    request: Request,
    db: Session = Depends(get_db),
):
    """Register a new doctor. Requires admin approval before login."""
    email_clean = payload.email.lower().strip()
    existing = db.query(User).filter(User.email.ilike(email_clean)).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    try:
        user = User(
            email=email_clean,
            hashed_password=get_password_hash(payload.password),
            role="doctor",
            is_active=True,
            is_verified=False,
        )
        db.add(user)
        db.flush()

        doctor_id = generate_doctor_id(db)
        doctor = Doctor(
            user_id=user.id,
            doctor_id=doctor_id,
            first_name=payload.first_name.strip(),
            last_name=payload.last_name.strip(),
            specialization=payload.specialization.strip(),
            license_number=payload.license_number.strip() if payload.license_number else None,
            phone=payload.phone.strip() if payload.phone else None,
            years_experience=payload.years_experience,
            bio=payload.bio.strip() if payload.bio else None,
            is_approved=False,
        )
        db.add(doctor)
        db.commit()
    except IntegrityError as e:
        db.rollback()
        logger.warning(f"Integrity error during doctor registration: {e}")
        err_msg = str(e).lower()
        if "email" in err_msg or "users_email_key" in err_msg:
            raise HTTPException(status_code=409, detail="An account with this email already exists")
        if "license_number" in err_msg:
            raise HTTPException(status_code=409, detail="A doctor with this license number is already registered")
        raise HTTPException(status_code=400, detail="Registration failed due to conflicting data.")
    except Exception as e:
        db.rollback()
        logger.error(f"Unexpected error during doctor registration: {e}")
        raise HTTPException(
            status_code=500,
            detail="Registration could not be completed. Please try again later."
        )

    logger.info(f"New doctor registered: {doctor_id} (pending approval)")
    record_auth_event("register_doctor", success=True)
    return MessageResponse(
        message="Doctor registration submitted",
        detail="Your account is pending administrator approval. You will be notified when approved.",
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Obtain a new access token using a refresh token."""
    token_data = decode_token(payload.refresh_token)
    if token_data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user_id = token_data.get("sub")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    new_data = {"sub": user.id, "role": user.role, "email": user.email}
    return TokenResponse(
        access_token=create_access_token(new_data),
        refresh_token=create_refresh_token(new_data),
        role=user.role,
        user_id=user.id,
    )


@router.get("/me")
def get_me(current_user=Depends(get_current_user)):
    """Return current user's basic profile."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "last_login": current_user.last_login,
    }
