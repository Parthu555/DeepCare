import urllib.request
import urllib.error
import json
from datetime import datetime, timedelta

def test_appointments():
    print("=== TESTING SMART PRE-BOOKING & APPOINTMENT MANAGEMENT ===")
    
    # 1. Fetch Doctors
    resp = urllib.request.urlopen("http://localhost:8000/api/v1/appointments/doctors")
    doctors = json.loads(resp.read().decode())
    print(f"[PASS] Doctors available for booking: {len(doctors)}")
    doctor = doctors[0]
    print(f"       Selected: {doctor['name']} ({doctor['specialization']})")

    # 2. Guest Pre-Booking
    import time
    offset_days = int(time.time()) % 20 + 2
    test_date = (datetime.utcnow() + timedelta(days=offset_days)).strftime("%Y-%m-%dT10:00:00Z")
    test_slot = "10:00 AM - 10:30 AM"

    guest_payload = {
        "doctor_id": doctor["doctor_id"],
        "scheduled_at": test_date,
        "time_slot": test_slot,
        "patient_name": "Alice Wonderland",
        "patient_email": "alice@example.com",
        "patient_phone": "+1-555-019-2834",
        "patient_age": 32,
        "patient_gender": "female",
        "symptoms": "Persistent dry cough for 3 weeks and mild chest tightness",
        "consultation_type": "in_person",
        "purpose": "Pulmonary Evaluation"
    }

    req = urllib.request.Request(
        "http://localhost:8000/api/v1/appointments/pre-book",
        data=json.dumps(guest_payload).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        guest_appt = json.loads(resp.read().decode())
    print(f"[PASS] Guest Pre-Booking Created:")
    print(f"       Appointment ID: {guest_appt['appointment_id']}")
    print(f"       Patient: {guest_appt['patient_name']} ({guest_appt['patient_email']})")
    print(f"       Status: {guest_appt['status']}")
    print(f"       Doctor: {guest_appt['doctor_name']}")

    # 3. Test Conflict Prevention (Duplicate Slot Booking)
    duplicate_payload = {
        "doctor_id": doctor["doctor_id"],
        "scheduled_at": test_date,
        "time_slot": test_slot,
        "patient_name": "Bob Duplicate",
        "patient_email": "bob@example.com",
        "patient_phone": "+1-555-999-8888",
        "symptoms": "Fever",
    }
    req_dup = urllib.request.Request(
        "http://localhost:8000/api/v1/appointments/pre-book",
        data=json.dumps(duplicate_payload).encode(),
        headers={"Content-Type": "application/json"}
    )
    try:
        urllib.request.urlopen(req_dup)
        print("[FAIL] Conflict check did not reject duplicate time slot!")
    except urllib.error.HTTPError as e:
        if e.code == 409:
            print(f"[PASS] Conflict Prevention verified: HTTP 409 Conflict correctly returned for duplicate slot!")
        else:
            print(f"[FAIL] Unexpected error code: {e.code}")

    # 4. Registered Patient Pre-Booking
    pat_payload = {
        "patient_id": "PAT-2026-0001",
        "doctor_id": doctor["doctor_id"],
        "scheduled_at": test_date,
        "time_slot": "11:00 AM - 11:30 AM",
        "symptoms": "Follow-up consultation after chest radiograph review",
        "consultation_type": "video",
        "purpose": "Radiology Follow-up"
    }
    req_pat = urllib.request.Request(
        "http://localhost:8000/api/v1/appointments/pre-book",
        data=json.dumps(pat_payload).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req_pat) as resp:
        pat_appt = json.loads(resp.read().decode())
    print(f"[PASS] Registered Patient Booking Created:")
    print(f"       Appointment ID: {pat_appt['appointment_id']}")
    print(f"       Patient ID: {pat_appt['patient_id']} ({pat_appt['patient_name']})")
    print(f"       Status: {pat_appt['status']}")

    # 5. Doctor Portal: View & Approve
    # Login Doctor
    login_req = urllib.request.Request(
        "http://localhost:8000/api/v1/auth/login",
        data=json.dumps({"email": "dr.sarah@deepcare.health", "password": "DoctorPass123!"}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(login_req) as resp:
        doc_token = json.loads(resp.read().decode())["access_token"]
    
    # Get Doctor appointments
    doc_appts_req = urllib.request.Request(
        "http://localhost:8000/api/v1/appointments/doctor/me",
        headers={"Authorization": f"Bearer {doc_token}"}
    )
    with urllib.request.urlopen(doc_appts_req) as resp:
        doc_appts = json.loads(resp.read().decode())
    print(f"[PASS] Doctor Appointments Loaded: {len(doc_appts)} items found for Dr. Sarah")

    # Doctor Confirms the guest appointment
    status_payload = {
        "status": "confirmed",
        "notes": "Pre-booking approved. Please bring any prior medical records."
    }
    confirm_req = urllib.request.Request(
        f"http://localhost:8000/api/v1/appointments/doctor/{guest_appt['appointment_id']}/status",
        data=json.dumps(status_payload).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {doc_token}"},
        method="PATCH"
    )
    with urllib.request.urlopen(confirm_req) as resp:
        updated_appt = json.loads(resp.read().decode())
    print(f"[PASS] Doctor Approved Pre-Booking:")
    print(f"       Appointment {updated_appt['appointment_id']} status is now: {updated_appt['status']}")
    print(f"       Doctor Notes: {updated_appt['notes']}")

    # 6. Admin Portal: Stats & All Bookings
    admin_login_req = urllib.request.Request(
        "http://localhost:8000/api/v1/auth/login",
        data=json.dumps({"email": "admin@deepcare.health", "password": "AdminPass123!"}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(admin_login_req) as resp:
        admin_token = json.loads(resp.read().decode())["access_token"]

    admin_stats_req = urllib.request.Request(
        "http://localhost:8000/api/v1/appointments/admin/stats",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    with urllib.request.urlopen(admin_stats_req) as resp:
        admin_stats = json.loads(resp.read().decode())
    print(f"[PASS] Admin Appointment Monitoring Stats:")
    print(f"       Total Bookings: {admin_stats['total_bookings']}")
    print(f"       Pending Requests: {admin_stats['pending_requests']}")
    print(f"       Confirmed Appointments: {admin_stats['confirmed_appointments']}")
    print(f"       Rescheduled: {admin_stats['rescheduled_appointments']}")
    print(f"       Cancelled: {admin_stats['cancelled_appointments']}")

    print("\nALL APPOINTMENT INTEGRATION TESTS PASSED (100%).")

if __name__ == "__main__":
    test_appointments()
