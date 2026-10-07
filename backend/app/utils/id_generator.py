"""
Utility: Unique ID generators for patients, doctors, xrays, analyses, reports, etc.
All IDs are sequential with prefix, making them human-readable.
"""
import random
import string
from datetime import datetime

from sqlalchemy.orm import Session


def _random_suffix(length: int) -> str:
    return "".join(random.choices(string.digits, k=length))


def generate_patient_id(db: Session) -> str:
    """Generate a unique DeepCare patient ID like DC-20241015-A3F2."""
    from app.models.user import Patient
    for _ in range(10):
        date_part = datetime.utcnow().strftime("%Y%m%d")
        rand_part = "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        pid = f"DC-{date_part}-{rand_part}"
        if not db.query(Patient).filter(Patient.patient_id == pid).first():
            return pid
    raise RuntimeError("Could not generate unique patient ID")


def generate_doctor_id(db: Session) -> str:
    """Generate a unique doctor ID like DOC-000042."""
    from app.models.user import Doctor
    for _ in range(10):
        count = db.query(Doctor).count() + 1
        did = f"DOC-{count:06d}"
        if not db.query(Doctor).filter(Doctor.doctor_id == did).first():
            return did
    raise RuntimeError("Could not generate unique doctor ID")


def generate_xray_id(db: Session) -> str:
    """Generate a unique X-ray ID like XR-20241015-1234."""
    from app.models.user import XrayImage
    for _ in range(10):
        date_part = datetime.utcnow().strftime("%Y%m%d")
        rand_part = _random_suffix(4)
        xid = f"XR-{date_part}-{rand_part}"
        if not db.query(XrayImage).filter(XrayImage.xray_id == xid).first():
            return xid
    raise RuntimeError("Could not generate unique xray ID")


def generate_analysis_id(db: Session) -> str:
    """Generate a unique analysis ID like AI-20241015-5678."""
    from app.models.user import AIAnalysis
    for _ in range(10):
        date_part = datetime.utcnow().strftime("%Y%m%d")
        rand_part = _random_suffix(6)
        aid = f"AI-{date_part}-{rand_part}"
        if not db.query(AIAnalysis).filter(AIAnalysis.analysis_id == aid).first():
            return aid
    raise RuntimeError("Could not generate unique analysis ID")


def generate_report_id(db: Session) -> str:
    """Generate a unique report ID like RPT-20241015-9012."""
    from app.models.user import MedicalReport
    for _ in range(10):
        date_part = datetime.utcnow().strftime("%Y%m%d")
        rand_part = _random_suffix(4)
        rid = f"RPT-{date_part}-{rand_part}"
        if not db.query(MedicalReport).filter(MedicalReport.report_id == rid).first():
            return rid
    raise RuntimeError("Could not generate unique report ID")


def generate_consultation_id(db: Session) -> str:
    """Generate a consultation ID like CON-20241015-3456."""
    from app.models.user import Consultation
    for _ in range(10):
        date_part = datetime.utcnow().strftime("%Y%m%d")
        rand_part = _random_suffix(4)
        cid = f"CON-{date_part}-{rand_part}"
        if not db.query(Consultation).filter(Consultation.consultation_id == cid).first():
            return cid
    raise RuntimeError("Could not generate unique consultation ID")


def generate_appointment_id(db: Session) -> str:
    """Generate an appointment ID like APT-20241015-7890."""
    from app.models.user import Appointment
    for _ in range(10):
        date_part = datetime.utcnow().strftime("%Y%m%d")
        rand_part = _random_suffix(4)
        aid = f"APT-{date_part}-{rand_part}"
        if not db.query(Appointment).filter(Appointment.appointment_id == aid).first():
            return aid
    raise RuntimeError("Could not generate unique appointment ID")
