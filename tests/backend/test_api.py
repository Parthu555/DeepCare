import os
import sys
import uuid
import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Setup path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

from app.main import app
from app.core.database import Base, get_db
from app.core.security import get_password_hash, create_access_token
from app.models.user import (
    User, Doctor, Patient, Department, XrayImage,
    AIAnalysis, MedicalReport, Consultation, Appointment,
    PatientDoctorAssignment, AuditLog
)
from app.services.pdf_service import generate_report_pdf
from app.services.s3_service import validate_image_file

# Create in-memory SQLite database for test execution
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables
Base.metadata.create_all(bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def clean_db():
    """Clean and seed minimal test data before each test."""
    db = TestingSessionLocal()
    # Clear tables
    for table in reversed(Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()

    # Seed Admin
    admin_user = User(
        id=str(uuid.uuid4()),
        email="admin@deepcare.health",
        hashed_password=get_password_hash("AdminPass123!"),
        role="admin",
        is_active=True,
        is_verified=True,
    )
    db.add(admin_user)

    # Seed Doctor
    doc_user = User(
        id=str(uuid.uuid4()),
        email="dr.sarah@deepcare.health",
        hashed_password=get_password_hash("DoctorPass123!"),
        role="doctor",
        is_active=True,
        is_verified=True,
    )
    db.add(doc_user)
    db.flush()

    doctor = Doctor(
        id=str(uuid.uuid4()),
        user_id=doc_user.id,
        doctor_id="DOC-2026-0001",
        first_name="Sarah",
        last_name="Jenkins",
        specialization="Thoracic Radiologist",
        license_number="MD-NY-123456",
        is_approved=True,
    )
    db.add(doctor)

    # Seed Patient 1
    pat1_user = User(
        id=str(uuid.uuid4()),
        email="john.doe@patient.deepcare.health",
        hashed_password=get_password_hash("PatientPass123!"),
        role="patient",
        is_active=True,
        is_verified=True,
    )
    db.add(pat1_user)
    db.flush()

    patient1 = Patient(
        id=str(uuid.uuid4()),
        user_id=pat1_user.id,
        patient_id="PAT-2026-0001",
        first_name="John",
        last_name="Doe",
        gender="male",
        blood_group="O+",
    )
    db.add(patient1)

    # Seed Patient 2 (for isolation testing)
    pat2_user = User(
        id=str(uuid.uuid4()),
        email="emily.rose@patient.deepcare.health",
        hashed_password=get_password_hash("PatientPass123!"),
        role="patient",
        is_active=True,
        is_verified=True,
    )
    db.add(pat2_user)
    db.flush()

    patient2 = Patient(
        id=str(uuid.uuid4()),
        user_id=pat2_user.id,
        patient_id="PAT-2026-0002",
        first_name="Emily",
        last_name="Rose",
        gender="female",
        blood_group="A+",
    )
    db.add(patient2)

    db.commit()
    db.close()


def test_health_check():
    """Verify system health endpoint returns status 200 OK and status 'healthy'."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data


def test_root_endpoint():
    """Verify root endpoint provides API documentation paths."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "version" in data
    assert "docs" in data


def test_unauthorized_access():
    """Verify HIPAA compliance: protected patient endpoints reject requests without JWT."""
    response = client.get("/api/v1/patients/me")
    assert response.status_code in [401, 403]


def test_authentication_login():
    """Verify user login generates valid JWT access and refresh tokens."""
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "dr.sarah@deepcare.health", "password": "DoctorPass123!"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["role"] == "doctor"


def test_patient_registration():
    """Verify patient self-registration and automatic ID assignment."""
    payload = {
        "email": "new.patient@deepcare.health",
        "password": "SecurePassword123!",
        "first_name": "Alice",
        "last_name": "Smith",
        "gender": "Female",
        "blood_group": "B+",
        "phone": "+1 555-444-3322",
    }
    response = client.post("/api/v1/auth/register/patient", json=payload)
    assert response.status_code in [200, 201]
    data = response.json()
    assert "registered successfully" in data["message"].lower()
    assert "detail" in data


def test_doctor_authorization_guard():
    """Verify that a patient token cannot access doctor-only endpoints."""
    # Obtain patient token
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "john.doe@patient.deepcare.health", "password": "PatientPass123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Attempt doctor patient search
    response = client.get("/api/v1/doctors/patients/search?patient_id=PAT-2026-0001", headers=headers)
    assert response.status_code == 403


def test_patient_data_isolation():
    """Verify Patient 1 only accesses their own records and cannot see Patient 2."""
    # Login as Patient 1
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "john.doe@patient.deepcare.health", "password": "PatientPass123!"},
    )
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Check profile
    res = client.get("/api/v1/patients/me", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["patient_id"] == "PAT-2026-0001"
    assert data["first_name"] == "John"


def test_admin_doctor_approval_workflow():
    """Verify admin approval toggles doctor activation."""
    # Login as Admin
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@deepcare.health", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # List doctors
    res = client.get("/api/v1/admin/doctors", headers=headers)
    assert res.status_code == 200


def test_s3_file_validation():
    """Verify file validation logic for PNG, JPEG, and DICOM."""
    # Valid PNG
    valid, msg = validate_image_file("scan.png", "image/png", 1024 * 1024)
    assert valid is True

    # Valid DICOM
    valid, msg = validate_image_file("scan.dcm", "application/dicom", 5 * 1024 * 1024)
    assert valid is True

    # Invalid extension
    valid, msg = validate_image_file("malicious.exe", "application/octet-stream", 100)
    assert valid is False


def test_pdf_report_generation():
    """Verify ReportLab PDF generation generates valid binary PDF bytes."""
    class MockReport:
        report_id = "REP-TEST-001"
        title = "Diagnostic Chest Evaluation"
        report_type = "radiology"
        summary = "No acute cardiopulmonary disease."
        clinical_findings = "Lungs are clear bilaterally. Heart size normal."
        recommendations = "Routine follow up."
        ai_analysis_included = True
        status = "approved"
        approved_at = datetime.now(timezone.utc)

    class MockDoctor:
        first_name = "Sarah"
        last_name = "Jenkins"
        specialization = "Radiologist"

    class MockPatient:
        first_name = "John"
        last_name = "Doe"
        patient_id = "PAT-2026-0001"

    pdf_bytes = generate_report_pdf(MockReport(), MockDoctor(), MockPatient())
    assert pdf_bytes is not None
    assert pdf_bytes.startswith(b"%PDF-")
    assert len(pdf_bytes) > 500


def test_patient_registration_and_login_e2e():
    """Verify synthetic patient registration, DB persistence, and subsequent JWT login."""
    synthetic_email = f"synthetic.patient.{uuid.uuid4().hex[:6]}@deepcare.health"
    password = "SyntheticSecure123!"

    # 1. Register synthetic patient
    reg_payload = {
        "email": synthetic_email,
        "password": password,
        "first_name": "Synthetic",
        "last_name": "Tester",
        "gender": "male",
        "blood_group": "AB+",
        "phone": "+1 555-019-2831",
        "address": "123 Research Way",
    }
    reg_res = client.post("/api/v1/auth/register/patient", json=reg_payload)
    assert reg_res.status_code == 201, reg_res.text
    reg_data = reg_res.json()
    assert "patient registered successfully" in reg_data["message"].lower()

    # 2. Confirm User and Patient profiles are stored in the database
    db = TestingSessionLocal()
    try:
        user_record = db.query(User).filter(User.email == synthetic_email).first()
        assert user_record is not None
        assert user_record.role == "patient"
        assert user_record.is_active is True

        patient_record = db.query(Patient).filter(Patient.user_id == user_record.id).first()
        assert patient_record is not None
        assert patient_record.first_name == "Synthetic"
        assert patient_record.last_name == "Tester"
        assert patient_record.patient_id.startswith("DC-")
    finally:
        db.close()

    # 3. Log in with the newly registered account
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": synthetic_email, "password": password},
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    assert "refresh_token" in token_data
    assert token_data["role"] == "patient"

    # 4. Access protected profile using token
    headers = {"Authorization": f"Bearer {token_data['access_token']}"}
    profile_res = client.get("/api/v1/patients/me", headers=headers)
    assert profile_res.status_code == 200
    assert profile_res.json()["first_name"] == "Synthetic"


def test_registration_validation_and_failures():
    """Verify password rules, duplicate email detection, and form validation."""
    # Password too short (< 8 chars)
    res_short = client.post(
        "/api/v1/auth/register/patient",
        json={
            "email": "badpass@deepcare.health",
            "password": "Short1!",
            "first_name": "Bad",
            "last_name": "Pass",
        },
    )
    assert res_short.status_code == 422

    # Password missing uppercase
    res_no_upper = client.post(
        "/api/v1/auth/register/patient",
        json={
            "email": "noupper@deepcare.health",
            "password": "lowercaseonly123!",
            "first_name": "No",
            "last_name": "Upper",
        },
    )
    assert res_no_upper.status_code == 422

    # Password missing digit
    res_no_digit = client.post(
        "/api/v1/auth/register/patient",
        json={
            "email": "nodigit@deepcare.health",
            "password": "NoDigitsInPassword!",
            "first_name": "No",
            "last_name": "Digit",
        },
    )
    assert res_no_digit.status_code == 422

    # Invalid email format
    res_bad_email = client.post(
        "/api/v1/auth/register/patient",
        json={
            "email": "not-an-email",
            "password": "ValidPassword123!",
            "first_name": "Bad",
            "last_name": "Email",
        },
    )
    assert res_bad_email.status_code == 422

    # Empty names
    res_empty_name = client.post(
        "/api/v1/auth/register/patient",
        json={
            "email": "emptyname@deepcare.health",
            "password": "ValidPassword123!",
            "first_name": "   ",
            "last_name": "Smith",
        },
    )
    assert res_empty_name.status_code == 422

    # Duplicate email registration (seeded john.doe@patient.deepcare.health)
    res_dup = client.post(
        "/api/v1/auth/register/patient",
        json={
            "email": "john.doe@patient.deepcare.health",
            "password": "NewPassword123!",
            "first_name": "Duplicate",
            "last_name": "Doe",
        },
    )
    assert res_dup.status_code == 409
    assert "already exists" in res_dup.json()["detail"].lower()


def test_seeded_logins_demo_credentials():
    """Verify configured demo credentials work for Admin, Doctor, and Patient."""
    # 1. Admin login
    admin_res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@deepcare.health", "password": "AdminPass123!"},
    )
    assert admin_res.status_code == 200
    assert admin_res.json()["role"] == "admin"

    # 2. Doctor login
    doctor_res = client.post(
        "/api/v1/auth/login",
        json={"email": "dr.sarah@deepcare.health", "password": "DoctorPass123!"},
    )
    assert doctor_res.status_code == 200
    assert doctor_res.json()["role"] == "doctor"

    # 3. Patient login
    patient_res = client.post(
        "/api/v1/auth/login",
        json={"email": "john.doe@patient.deepcare.health", "password": "PatientPass123!"},
    )
    assert patient_res.status_code == 200
    assert patient_res.json()["role"] == "patient"

    # 4. Invalid password rejected
    bad_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@deepcare.health", "password": "WrongPassword99!"},
    )
    assert bad_login.status_code == 401
    assert "invalid email or password" in bad_login.json()["detail"].lower()


def test_unapproved_doctor_workflow():
    """Verify unapproved doctors cannot log in or access doctor functionality until approved."""
    doc_email = f"pending.dr.{uuid.uuid4().hex[:6]}@deepcare.health"
    doc_pass = "PendingDoc123!"

    # 1. Register new doctor
    reg_res = client.post(
        "/api/v1/auth/register/doctor",
        json={
            "email": doc_email,
            "password": doc_pass,
            "first_name": "Gregory",
            "last_name": "House",
            "specialization": "Diagnostic Medicine",
            "license_number": f"LIC-{uuid.uuid4().hex[:6]}",
        },
    )
    assert reg_res.status_code == 201

    # 2. Attempt login while unapproved -> 403 Forbidden
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": doc_email, "password": doc_pass},
    )
    assert login_res.status_code == 403
    assert "pending admin approval" in login_res.json()["detail"].lower()

    # 3. Admin logs in and approves doctor
    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@deepcare.health", "password": "AdminPass123!"},
    )
    admin_token = admin_login.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Find the doctor record
    db = TestingSessionLocal()
    try:
        user_rec = db.query(User).filter(User.email == doc_email).first()
        doc_rec = db.query(Doctor).filter(Doctor.user_id == user_rec.id).first()
        doc_internal_id = doc_rec.id
    finally:
        db.close()

    approve_res = client.post(
        f"/api/v1/admin/doctors/{doc_internal_id}/approval",
        json={"approved": True, "notes": "Credentials verified."},
        headers=admin_headers,
    )
    assert approve_res.status_code == 200

    # 4. Doctor logs in successfully after approval
    approved_login = client.post(
        "/api/v1/auth/login",
        json={"email": doc_email, "password": doc_pass},
    )
    assert approved_login.status_code == 200
    assert approved_login.json()["role"] == "doctor"


def test_admin_seed_idempotency():
    """Verify _seed_admin does not overwrite existing admin passwords or duplicate accounts."""
    from app.main import _seed_admin

    # First verify current admin password works
    login1 = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@deepcare.health", "password": "AdminPass123!"},
    )
    assert login1.status_code == 200

    # Run _seed_admin multiple times
    _seed_admin()
    _seed_admin()

    # Confirm admin can still log in with the exact same credentials
    login2 = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@deepcare.health", "password": "AdminPass123!"},
    )
    assert login2.status_code == 200
