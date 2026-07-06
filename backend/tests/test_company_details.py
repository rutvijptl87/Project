import os
import pytest
import requests
import io
from pathlib import Path

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        env_file = Path("/app/frontend/.env")
        if not env_file.exists():
            env_file = Path(__file__).parent.parent.parent / "frontend" / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip()
                    break
    assert url, "REACT_APP_BACKEND_URL not set"
    return url.rstrip("/")

BASE_URL = _load_backend_url()
ADMIN = {"username": "admin", "password": "Admin@123"}

def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]

@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)

def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

class TestCompanyDetails:
    def test_get_company_details(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/company-details", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "name" in data
        assert "address" in data
        assert "gstin" in data
        assert "bank_name" in data
        assert "bank_account_no" in data
        assert "upi_id" in data

    def test_update_company_details(self, admin_token):
        # 1. Get original details
        r = requests.get(f"{BASE_URL}/api/company-details", headers=_h(admin_token), timeout=20)
        original = r.json()

        # 2. Update with modified details
        updated_payload = original.copy()
        updated_payload["name"] = "UPDATED CREATOR CONSULTANT LLP"
        updated_payload["gstin"] = "27AASFC7539E1Z9"
        updated_payload["upi_id"] = "updated_creator@upi"

        r_put = requests.put(
            f"{BASE_URL}/api/company-details",
            json=updated_payload,
            headers=_h(admin_token),
            timeout=20
        )
        assert r_put.status_code == 200, r_put.text
        put_data = r_put.json()
        assert put_data["name"] == "UPDATED CREATOR CONSULTANT LLP"
        assert put_data["gstin"] == "27AASFC7539E1Z9"
        assert put_data["upi_id"] == "updated_creator@upi"

        # 3. Verify GET returns the updated details
        r_get = requests.get(f"{BASE_URL}/api/company-details", headers=_h(admin_token), timeout=20)
        get_data = r_get.json()
        assert get_data["name"] == "UPDATED CREATOR CONSULTANT LLP"
        assert get_data["gstin"] == "27AASFC7539E1Z9"

        # 4. Restore original to clean up
        requests.put(
            f"{BASE_URL}/api/company-details",
            json=original,
            headers=_h(admin_token),
            timeout=20
        )

    def test_upload_and_serve_company_qr(self, admin_token):
        # 1. Upload a dummy PNG file
        file_content = b"fake-png-content-for-testing"
        files = {
            "file": ("test_qr.png", io.BytesIO(file_content), "image/png")
        }
        
        headers = {"Authorization": f"Bearer {admin_token}"}
        r_upload = requests.post(
            f"{BASE_URL}/api/company-details/uploads",
            files=files,
            headers=headers,
            timeout=20
        )
        assert r_upload.status_code == 200, r_upload.text
        upload_res = r_upload.json()
        assert "url" in upload_res
        assert "filename" in upload_res
        assert upload_res["url"].startswith("/api/uploads/company/")

        # 2. Retrieve/serve the uploaded file
        relative_url = upload_res["url"]
        r_serve = requests.get(f"{BASE_URL}{relative_url}", timeout=20)
        assert r_serve.status_code == 200
        assert r_serve.content == file_content

    def test_company_logo_upload_and_pdf_generation(self, admin_token):
        # 1. Upload a dummy PDF logo
        logo_pdf_content = b"%PDF-1.4 ... fake-pdf-logo-data ..."
        files = {
            "file": ("test_logo.pdf", io.BytesIO(logo_pdf_content), "application/pdf")
        }
        headers = {"Authorization": f"Bearer {admin_token}"}
        r_upload = requests.post(
            f"{BASE_URL}/api/company-details/uploads",
            files=files,
            headers=headers,
            timeout=20
        )
        assert r_upload.status_code == 200, r_upload.text
        upload_res = r_upload.json()
        assert "url" in upload_res
        logo_url = upload_res["url"]
        
        # 2. Update company details with the new logo URL
        r_get = requests.get(f"{BASE_URL}/api/company-details", headers=_h(admin_token), timeout=20)
        original = r_get.json()
        
        updated_payload = original.copy()
        updated_payload["company_logo_url"] = logo_url
        
        r_put = requests.put(
            f"{BASE_URL}/api/company-details",
            json=updated_payload,
            headers=_h(admin_token),
            timeout=20
        )
        assert r_put.status_code == 200, r_put.text
        
        # 3. Create a dummy invoice and fetch its PDF to verify it builds successfully with the PDF logo
        client_payload = {
            "name": "TEST LOGO CLIENT",
            "phone": "1234567890",
            "email": "logo-client@test.com",
            "company": "Logo Test Co.",
            "address": "Logo Street, Maharashtra"
        }
        r_client = requests.post(f"{BASE_URL}/api/clients", json=client_payload, headers=_h(admin_token), timeout=20)
        assert r_client.status_code == 200
        client = r_client.json()
        
        invoice_payload = {
            "type": "tax",
            "invoice_date": "2026-06-22",
            "hsn_code": "998332",
            "client_id": client["id"],
            "client_name": client["name"],
            "client_address": client["address"],
            "client_gstin": "27AAOPV1111A1Z1",
            "client_mobile": "9999988888",
            "client_pan": "AAOPV1111A",
            "place_of_supply": "Maharashtra",
            "service_description": "Logo Test Service",
            "qty": 1.0,
            "rate": 50000.0,
            "gst_percent": 18.0,
            "tds_percent": 10.0,
            "tds_section": "194J",
            "received_amount": 0.0
        }
        r_inv = requests.post(f"{BASE_URL}/api/invoices", json=invoice_payload, headers=_h(admin_token), timeout=20)
        assert r_inv.status_code == 200
        invoice = r_inv.json()
        
        # Download PDF and verify it doesn't crash
        r_pdf = requests.get(f"{BASE_URL}/api/invoices/{invoice['id']}/pdf", headers=_h(admin_token), timeout=20)
        assert r_pdf.status_code == 200
        assert r_pdf.headers.get("content-type") == "application/pdf"
        assert len(r_pdf.content) > 1000
        
        # Clean up
        requests.delete(f"{BASE_URL}/api/invoices/{invoice['id']}", headers=_h(admin_token), timeout=20)
        requests.delete(f"{BASE_URL}/api/clients/{client['id']}", headers=_h(admin_token), timeout=20)
        requests.put(
            f"{BASE_URL}/api/company-details",
            json=original,
            headers=_h(admin_token),
            timeout=20
        )

