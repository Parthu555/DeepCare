"""
DeepCare Database Seeder — Populates mock clinical environment with doctors, patients,
admin, sample radiograph records, AI inference results, and consultation records.
Completely idempotent: safe to run multiple times.
"""
import sys
import os
import uuid
from datetime import datetime, timezone, timedelta

# Add backend directory to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.core.database import SessionLocal, init_db
from app.core.security import get_password_hash
from app.models.user import (
    User, Doctor, Patient, Department, XrayImage,
    AIAnalysis, MedicalReport, Consultation, Appointment,
    PatientDoctorAssignment, AuditLog
)

def utcnow():
    return datetime.now(timezone.utc)

def seed_database():
    print("Initiating DeepCare database seed...")
    init_db()
    db = SessionLocal()

    try:
        # ─── 1. Admin User ──────────────────────────────────────────────────
        from app.core.config import settings
        admin_email = getattr(settings, "ADMIN_EMAIL", "admin@deepcare.health")
        admin_password = getattr(settings, "ADMIN_PASSWORD", "AdminPass123!")

        admin_user = db.query(User).filter(User.email == admin_email).first()
        if not admin_user:
            admin_user = User(
                id=str(uuid.uuid4()),
                email=admin_email,
                hashed_password=get_password_hash(admin_password),
                role="admin",
                is_active=True,
                is_verified=True,
            )
            db.add(admin_user)
            db.commit()
            print(f"  [+] Admin user seeded: {admin_email}")
        else:
            print(f"  [*] Admin user already exists: {admin_email} (preserving credentials)")

        # ─── 2. Departments ─────────────────────────────────────────────────
        dept_pulm = db.query(Department).filter(Department.name == "Pulmonology").first()
        if not dept_pulm:
            dept_pulm = Department(
                id=str(uuid.uuid4()),
                name="Pulmonology",
                description="Specialized in respiratory disorders, pneumonia, and chest pathologies",
            )
            db.add(dept_pulm)

        dept_rad = db.query(Department).filter(Department.name == "Thoracic Radiology").first()
        if not dept_rad:
            dept_rad = Department(
                id=str(uuid.uuid4()),
                name="Thoracic Radiology",
                description="Chest radiograph and computed tomography diagnostic imaging",
            )
            db.add(dept_rad)
        db.commit()

        # ─── 3. Doctors ─────────────────────────────────────────────────────
        doc_sarah_user = db.query(User).filter(User.email == "dr.sarah@deepcare.health").first()
        if not doc_sarah_user:
            doc_sarah_user = User(
                id=str(uuid.uuid4()),
                email="dr.sarah@deepcare.health",
                hashed_password=get_password_hash("DoctorPass123!"),
                role="doctor",
                is_active=True,
                is_verified=True,
            )
            db.add(doc_sarah_user)
            db.flush()

            doc_sarah = Doctor(
                id=str(uuid.uuid4()),
                user_id=doc_sarah_user.id,
                doctor_id="DOC-2026-0001",
                first_name="Sarah",
                last_name="Jenkins",
                specialization="Thoracic Radiologist",
                license_number="MD-NY-849204",
                phone="+1 (555) 234-5678",
                department_id=dept_rad.id,
                years_experience=12,
                is_approved=True,
            )
            db.add(doc_sarah)
            db.commit()
            print("  [+] Doctor seeded: dr.sarah@deepcare.health")
        else:
            doc_sarah = db.query(Doctor).filter(Doctor.user_id == doc_sarah_user.id).first()

        doc_marcus_user = db.query(User).filter(User.email == "dr.marcus@deepcare.health").first()
        if not doc_marcus_user:
            doc_marcus_user = User(
                id=str(uuid.uuid4()),
                email="dr.marcus@deepcare.health",
                hashed_password=get_password_hash("DoctorPass123!"),
                role="doctor",
                is_active=True,
                is_verified=True,
            )
            db.add(doc_marcus_user)
            db.flush()

            doc_marcus = Doctor(
                id=str(uuid.uuid4()),
                user_id=doc_marcus_user.id,
                doctor_id="DOC-2026-0002",
                first_name="Marcus",
                last_name="Chen",
                specialization="Pulmonary Critical Care",
                license_number="MD-CA-918231",
                phone="+1 (555) 876-5432",
                department_id=dept_pulm.id,
                years_experience=8,
                is_approved=True,
            )
            db.add(doc_marcus)
            db.commit()
            print("  [+] Doctor seeded: dr.marcus@deepcare.health")
        else:
            doc_marcus = db.query(Doctor).filter(Doctor.user_id == doc_marcus_user.id).first()

        # ─── 4. Patients ────────────────────────────────────────────────────
        patient_john_user = db.query(User).filter(User.email == "john.doe@patient.deepcare.health").first()
        if not patient_john_user:
            patient_john_user = User(
                id=str(uuid.uuid4()),
                email="john.doe@patient.deepcare.health",
                hashed_password=get_password_hash("PatientPass123!"),
                role="patient",
                is_active=True,
                is_verified=True,
            )
            db.add(patient_john_user)
            db.flush()

            patient_john = Patient(
                id=str(uuid.uuid4()),
                user_id=patient_john_user.id,
                patient_id="PAT-2026-0001",
                first_name="John",
                last_name="Doe",
                gender="male",
                blood_group="O+",
                phone="+1 (555) 123-4567",
                allergies="Penicillin",
                chronic_conditions="Mild Asthma",
            )
            db.add(patient_john)
            db.commit()
            print("  [+] Patient seeded: john.doe@patient.deepcare.health (PAT-2026-0001)")
        else:
            patient_john = db.query(Patient).filter(Patient.user_id == patient_john_user.id).first()

        # Seed Emily Rose (Second Patient)
        patient_emily_user = db.query(User).filter(User.email == "emily.rose@patient.deepcare.health").first()
        if not patient_emily_user:
            patient_emily_user = User(
                id=str(uuid.uuid4()),
                email="emily.rose@patient.deepcare.health",
                hashed_password=get_password_hash("PatientPass123!"),
                role="patient",
                is_active=True,
                is_verified=True,
            )
            db.add(patient_emily_user)
            db.flush()

            patient_emily = Patient(
                id=str(uuid.uuid4()),
                user_id=patient_emily_user.id,
                patient_id="PAT-2026-0002",
                first_name="Emily",
                last_name="Rose",
                gender="female",
                blood_group="A+",
                phone="+1 (555) 987-6543",
                allergies="Sulfa drugs",
                chronic_conditions="None",
            )
            db.add(patient_emily)
            db.commit()
            print("  [+] Patient seeded: emily.rose@patient.deepcare.health (PAT-2026-0002)")
        else:
            patient_emily = db.query(Patient).filter(Patient.user_id == patient_emily_user.id).first()

        # ─── 5. Patient-Doctor Care Team Assignments ────────────────────────
        assignment = db.query(PatientDoctorAssignment).filter(
            PatientDoctorAssignment.patient_id == patient_john.id,
            PatientDoctorAssignment.doctor_id == doc_sarah.id
        ).first()
        if not assignment:
            assignment = PatientDoctorAssignment(
                id=str(uuid.uuid4()),
                patient_id=patient_john.id,
                doctor_id=doc_sarah.id,
                assigned_by=admin_user.id,
                is_active=True,
                notes="Primary thoracic radiology consult assignment",
            )
            db.add(assignment)
            db.commit()

        # ─── 6. Sample X-Ray Scan for John Doe ──────────────────────────────
        xray_1 = db.query(XrayImage).filter(XrayImage.xray_id == "XR-2026-0001").first()
        if not xray_1:
            xray_1 = XrayImage(
                id=str(uuid.uuid4()),
                xray_id="XR-2026-0001",
                patient_id=patient_john.id,
                doctor_id=doc_sarah.id,
                body_part="chest",
                view_position="PA",
                s3_bucket="deepcare-medical-vault-dev",
                s3_key=f"patients/{patient_john.patient_id}/xrays/2026/10/02/XR-2026-0001.png",
                analysis_status="completed",
                clinical_indication="Persistent productive cough, fever 38.5C, pleuritic right-sided chest pain",
            )
            db.add(xray_1)
            db.commit()
            print("  [+] Sample X-ray seeded: XR-2026-0001")

        # ─── 7. AI Analysis for X-Ray 1 ─────────────────────────────────────
        analysis_1 = db.query(AIAnalysis).filter(AIAnalysis.analysis_id == "AI-2026-0001").first()
        if not analysis_1:
            analysis_1 = AIAnalysis(
                id=str(uuid.uuid4()),
                analysis_id="AI-2026-0001",
                xray_id=xray_1.id,
                doctor_id=doc_sarah.id,
                model_name="DenseNet-121",
                model_version="v2.4-NIH14",
                predictions={
                    "Pneumonia": 0.884,
                    "Infiltration": 0.652,
                    "Consolidation": 0.412,
                    "Effusion": 0.320,
                    "Atelectasis": 0.185,
                    "Cardiomegaly": 0.082,
                    "Pneumothorax": 0.031,
                    "Nodule": 0.024,
                },
                top_prediction="Pneumonia",
                top_confidence=0.884,
                gradcam_s3_key=f"patients/{patient_john.patient_id}/gradcam/AI-2026-0001_heatmap.png",
                status="completed",
                doctor_reviewed=True,
                doctor_review_notes="Dense airspace consolidation verified in right lower lobe, confirming bacterial pneumonia diagnosis.",
                inference_duration_ms=246.0,
            )
            db.add(analysis_1)
            db.commit()
            print("  [+] AI analysis seeded: AI-2026-0001")

        # ─── 8. Certified Medical Report ────────────────────────────────────
        report_1 = db.query(MedicalReport).filter(MedicalReport.report_id == "REP-2026-0001").first()
        if not report_1:
            report_1 = MedicalReport(
                id=str(uuid.uuid4()),
                report_id="REP-2026-0001",
                patient_id=patient_john.id,
                doctor_id=doc_sarah.id,
                xray_id=xray_1.id,
                analysis_id=analysis_1.id,
                title="Chest Radiograph Diagnostic Evaluation",
                report_type="radiology",
                summary="Right lower lobe consolidation characteristic of acute bacterial pneumonia. AI confidence 88.4%.",
                clinical_findings="Opacity noted in the right lower lung zone. Costophrenic angles preserved. Cardiac silhouette within normal dimensions.",
                recommendations="Begin Amoxicillin-Clavulanate 875/125mg BID x 7 days. Repeat PA chest view in 3 weeks to ensure complete radiological clearance.",
                ai_analysis_included=True,
                status="approved",
                approved_at=utcnow(),
                is_patient_viewable=True,
                pdf_s3_key=f"patients/{patient_john.patient_id}/reports/REP-2026-0001.pdf",
            )
            db.add(report_1)
            db.commit()
            print("  [+] Certified Medical Report seeded: REP-2026-0001")

        # ─── 9. Clinical Consultation Encounter ─────────────────────────────
        consult_1 = db.query(Consultation).filter(Consultation.patient_id == patient_john.id).first()
        if not consult_1:
            consult_1 = Consultation(
                id=str(uuid.uuid4()),
                consultation_id="CON-2026-0001",
                patient_id=patient_john.id,
                doctor_id=doc_sarah.id,
                consultation_date=utcnow() - timedelta(days=2),
                chief_complaint="Severe cough and shortness of breath for past 4 days.",
                assessment="Community-Acquired Pneumonia (CAP), right lower lobe involvement.",
                plan="Oral antibiotic regimen prescribed, hydration, pulse oximetry self-monitoring.",
                follow_up_required=True,
            )
            db.add(consult_1)
            db.commit()
            print("  [+] Consultation encounter seeded: CON-2026-0001")

        # ─── 10. Follow-up Appointment ──────────────────────────────────────
        apt_1 = db.query(Appointment).filter(Appointment.patient_id == patient_john.id).first()
        if not apt_1:
            apt_1 = Appointment(
                id=str(uuid.uuid4()),
                appointment_id="APT-2026-0001",
                patient_id=patient_john.id,
                doctor_id=doc_sarah.id,
                scheduled_at=utcnow() + timedelta(days=5),
                duration_minutes=30,
                status="confirmed",
                purpose="Pneumonia 1-week recovery review and oxygen saturation check",
            )
            db.add(apt_1)
            db.commit()
            print("  [+] Appointment seeded: APT-2026-0001")

        print("\nAll DeepCare demonstration data seeded successfully and verified idempotent.")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
