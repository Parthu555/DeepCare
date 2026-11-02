import urllib.request
import json
import sys

def run_verification():
    print("=== DEEPCARE END-TO-END VERIFICATION ===")
    
    # 1. Doctor Login
    req = urllib.request.Request(
        'http://localhost:8000/api/v1/auth/login',
        data=json.dumps({'email': 'dr.sarah@deepcare.health', 'password': 'DoctorPass123!'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        doc_token = json.loads(resp.read().decode())['access_token']
    print("[PASS] Doctor Authentication (dr.sarah@deepcare.health)")

    # 2. Patient Login
    req = urllib.request.Request(
        'http://localhost:8000/api/v1/auth/login',
        data=json.dumps({'email': 'john.doe@patient.deepcare.health', 'password': 'PatientPass123!'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        pat_token = json.loads(resp.read().decode())['access_token']
    print("[PASS] Patient Authentication (john.doe@patient.deepcare.health)")

    # 3. Patient X-rays & Image Streaming
    req = urllib.request.Request(
        'http://localhost:8000/api/v1/patients/me/xrays',
        headers={'Authorization': f'Bearer {pat_token}'}
    )
    with urllib.request.urlopen(req) as resp:
        xray_data = json.loads(resp.read().decode())
        xrays = xray_data.get('items', [])
    print(f"[PASS] Patient X-Ray Retrieval: {len(xrays)} records found")
    for x in xrays:
        img_url = x.get('presigned_url')
        if img_url.startswith('/'):
            img_url = 'http://localhost:8000' + img_url
        with urllib.request.urlopen(img_url) as img_resp:
            content = img_resp.read()
            print(f"  -> {x['xray_id']} ({x['body_part']}): HTTP {img_resp.status}, Content-Type: {img_resp.headers.get('Content-Type')}, Size: {len(content)} bytes")

    # 4. Patient Medical Reports
    req = urllib.request.Request(
        'http://localhost:8000/api/v1/patients/me/reports',
        headers={'Authorization': f'Bearer {pat_token}'}
    )
    with urllib.request.urlopen(req) as resp:
        report_data = json.loads(resp.read().decode())
        reports = report_data.get('items', [])
    print(f"[PASS] Patient Medical Reports: {len(reports)} reports found")
    for r in reports:
        print(f"  -> {r.get('report_id')} ({r.get('report_type')}) - Status: {r.get('status')}")

    # 5. Admin Portal Stats & Audit
    req = urllib.request.Request(
        'http://localhost:8000/api/v1/auth/login',
        data=json.dumps({'email': 'admin@deepcare.health', 'password': 'AdminPass123!'}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        admin_token = json.loads(resp.read().decode())['access_token']
    
    req = urllib.request.Request(
        'http://localhost:8000/api/v1/admin/stats',
        headers={'Authorization': f'Bearer {admin_token}'}
    )
    with urllib.request.urlopen(req) as resp:
        stats = json.loads(resp.read().decode())
    print(f"[PASS] Admin System Stats:")
    print(f"  Total Patients: {stats.get('total_patients')}")
    print(f"  Total Doctors: {stats.get('total_doctors')}")
    print(f"  Total X-rays: {stats.get('total_xrays')}")
    print(f"  Total AI Analyses: {stats.get('total_analyses')}")
    print(f"  Total Reports: {stats.get('total_reports')}")

    print("\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY (100%).")

if __name__ == '__main__':
    run_verification()
