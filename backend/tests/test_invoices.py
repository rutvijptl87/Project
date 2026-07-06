import os
import pytest
import requests
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

class TestInvoices:
    def test_invoice_endpoints(self, admin_token):
        # 1. Create a dummy client to link to the invoice
        import secrets
        import random
        rand_suffix = secrets.token_hex(4)
        rand_phone = "".join([str(random.randint(0, 9)) for _ in range(10)])
        client_payload = {
            "name": f"TEST INVOICE CLIENT {rand_suffix}",
            "phone": rand_phone,
            "email": f"testclient-{rand_suffix}@invoice.com",
            "company": "Test Invoice Client Co.",
            "address": "123 Test Billing St, Maharashtra, 400001"
        }
        r_client = requests.post(f"{BASE_URL}/api/clients", json=client_payload, headers=_h(admin_token), timeout=20)
        assert r_client.status_code == 200, r_client.text
        client = r_client.json()
        client_id = client["id"]

        # 2. Get list of existing invoices
        r_list_pre = requests.get(f"{BASE_URL}/api/invoices", headers=_h(admin_token), timeout=20)
        assert r_list_pre.status_code == 200
        invoices_pre = r_list_pre.json()

        # 3. Create a Proforma Invoice
        proforma_payload = {
            "type": "proforma",
            "invoice_date": "2026-06-22",
            "expiry_date": "2026-07-22",
            "hsn_code": "998332",
            "client_id": client_id,
            "client_name": client["name"],
            "client_address": client["address"],
            "client_gstin": "27AAOPV1111A1Z1",
            "client_mobile": "9999988888",
            "client_pan": "AAOPV1111A",
            "place_of_supply": "Maharashtra",
            "service_description": "Structural Design & Consultation Charges",
            "qty": 1.0,
            "rate": 100000.0,
            "gst_percent": 18.0,
            "tds_percent": 10.0,
            "tds_section": "194J",
            "received_amount": 108000.0
        }
        r_prof = requests.post(f"{BASE_URL}/api/invoices", json=proforma_payload, headers=_h(admin_token), timeout=20)
        assert r_prof.status_code == 200, r_prof.text
        proforma = r_prof.json()
        assert proforma["type"] == "proforma"
        assert proforma["invoice_no"].startswith("CC > PIC >")
        # Check if counter started matching our seeded next sequence >= 047
        prof_seq_str = proforma["invoice_no"].split(">")[-1].strip()
        assert int(prof_seq_str) >= 47

        # 4. Check that client's GSTIN, PAN, and Place of Supply got auto-updated in DB
        r_client_get = requests.get(f"{BASE_URL}/api/clients/{client_id}", headers=_h(admin_token), timeout=20)
        assert r_client_get.status_code == 200
        client_updated = r_client_get.json()["client"]
        assert client_updated.get("gstin") == "27AAOPV1111A1Z1"
        assert client_updated.get("pan") == "AAOPV1111A"
        assert client_updated.get("place_of_supply") == "Maharashtra"

        # 5. Create a Tax Invoice
        tax_payload = {
            "type": "tax",
            "invoice_date": "2026-06-22",
            "hsn_code": "998332",
            "client_id": client_id,
            "client_name": client["name"],
            "client_address": client["address"],
            "client_gstin": "27AAOPV1111A1Z1",
            "client_mobile": "9999988888",
            "client_pan": "AAOPV1111A",
            "place_of_supply": "Maharashtra",
            "service_description": "Structural Design & Consultation Charges",
            "qty": 1.0,
            "rate": 150000.0,
            "gst_percent": 18.0,
            "tds_percent": 10.0,
            "tds_section": "194J",
            "received_amount": 0.0
        }
        r_tax = requests.post(f"{BASE_URL}/api/invoices", json=tax_payload, headers=_h(admin_token), timeout=20)
        assert r_tax.status_code == 200, r_tax.text
        tax = r_tax.json()
        assert tax["type"] == "tax"
        assert tax["invoice_no"].startswith("CC > ARL >")
        tax_seq_str = tax["invoice_no"].split(">")[-1].strip()
        assert int(tax_seq_str) >= 58

        # 6. Verify GET invoices lists both new documents
        r_list_post = requests.get(f"{BASE_URL}/api/invoices", headers=_h(admin_token), timeout=20)
        invoices_post = r_list_post.json()
        assert len(invoices_post) == len(invoices_pre) + 2

        # 6b. Test PUT updating the invoice details
        updated_payload = proforma.copy()
        updated_payload["rate"] = 120000.0
        updated_payload["service_description"] = "Updated Description text"
        r_update = requests.put(f"{BASE_URL}/api/invoices/{proforma['id']}", json=updated_payload, headers=_h(admin_token), timeout=20)
        assert r_update.status_code == 200, r_update.text
        updated_invoice = r_update.json()
        assert updated_invoice["rate"] == 120000.0
        assert updated_invoice["service_description"] == "Updated Description text"

        # 7. Test PDF Generation and Stream Content Type
        r_prof_pdf = requests.get(f"{BASE_URL}/api/invoices/{proforma['id']}/pdf", headers=_h(admin_token), timeout=20)
        assert r_prof_pdf.status_code == 200
        assert r_prof_pdf.headers.get("content-type") == "application/pdf"
        assert len(r_prof_pdf.content) > 1000 # Should be a valid PDF binary block

        r_tax_pdf = requests.get(f"{BASE_URL}/api/invoices/{tax['id']}/pdf", headers=_h(admin_token), timeout=20)
        assert r_tax_pdf.status_code == 200
        assert r_tax_pdf.headers.get("content-type") == "application/pdf"
        assert len(r_tax_pdf.content) > 1000

        # 8. Clean up
        r_del_prof = requests.delete(f"{BASE_URL}/api/invoices/{proforma['id']}", headers=_h(admin_token), timeout=20)
        assert r_del_prof.status_code == 200
        r_del_tax = requests.delete(f"{BASE_URL}/api/invoices/{tax['id']}", headers=_h(admin_token), timeout=20)
        assert r_del_tax.status_code == 200
        requests.delete(f"{BASE_URL}/api/clients/{client_id}", headers=_h(admin_token), timeout=20)

    def test_gst_exclusive_calculations(self, admin_token):
        # 1. Create a client
        client_payload = {
            "name": "TEST EXCLUSIVE CLIENT",
            "phone": "9898989898",
            "email": "testexclusive@invoice.com",
            "company": "Test exclusive Co."
        }
        r_client = requests.post(f"{BASE_URL}/api/clients", json=client_payload, headers=_h(admin_token), timeout=20)
        assert r_client.status_code == 200
        client = r_client.json()
        client_id = client["id"]

        # 2. Create a project
        proj_payload = {
            "name": "TEST EXCLUSIVE PROJECT",
            "quoted_amount": 200000.0,
            "client_id": client_id,
            "site_location": "Test Location"
        }
        r_proj = requests.post(f"{BASE_URL}/api/projects", json=proj_payload, headers=_h(admin_token), timeout=20)
        assert r_proj.status_code == 200
        project = r_proj.json()
        project_id = project["id"]

        # 3. Create a tax invoice linked to the project
        tax_payload = {
            "type": "tax",
            "invoice_date": "2026-06-22",
            "hsn_code": "998332",
            "client_id": client_id,
            "project_id": project_id,
            "client_name": client["name"],
            "client_address": "Some address",
            "client_gstin": "27AAOPV1111A1Z1",
            "place_of_supply": "Maharashtra",
            "service_description": "Structural Design Charges",
            "qty": 1.0,
            "rate": 100000.0,
            "gst_percent": 18.0,
            "tds_percent": 10.0,
            "tds_section": "194J",
            "received_amount": 0.0
        }
        r_tax = requests.post(f"{BASE_URL}/api/invoices", json=tax_payload, headers=_h(admin_token), timeout=20)
        assert r_tax.status_code == 200, r_tax.text
        tax_inv = r_tax.json()

        # 4. Fetch the auto-recorded payment for the project
        r_payments = requests.get(f"{BASE_URL}/api/payments?project_id={project_id}", headers=_h(admin_token), timeout=20)
        assert r_payments.status_code == 200
        payments = r_payments.json()
        assert len(payments) == 1
        payment = payments[0]
        
        # Payment amount should be net payable = 100000 (base) + 18000 (gst) - 10000 (tds) = 108000
        assert float(payment["amount"]) == 108000.0
        # Taxable amount should be exclusive of GST/TDS = 100000
        assert float(payment["taxable_amount"]) == 100000.0

        # 5. Fetch project details and check received and outstanding amounts
        r_proj_detail = requests.get(f"{BASE_URL}/api/projects/{project_id}", headers=_h(admin_token), timeout=20)
        assert r_proj_detail.status_code == 200
        proj_detail = r_proj_detail.json()
        # Received should be the taxable amount of payment = 100000
        assert float(proj_detail["received_amount"]) == 100000.0
        # Outstanding should be 200000 (quoted) - 100000 (received) = 100000
        assert float(proj_detail["outstanding_amount"]) == 100000.0

        # 6. Fetch client details and check stats received and outstanding amounts
        r_client_detail = requests.get(f"{BASE_URL}/api/clients/{client_id}", headers=_h(admin_token), timeout=20)
        assert r_client_detail.status_code == 200
        client_detail = r_client_detail.json()
        assert float(client_detail["stats"]["total_received"]) == 100000.0
        assert float(client_detail["stats"]["total_outstanding"]) == 100000.0

        # Cleanup
        requests.delete(f"{BASE_URL}/api/invoices/{tax_inv['id']}", headers=_h(admin_token), timeout=20)
        requests.delete(f"{BASE_URL}/api/payments/{payment['id']}", headers=_h(admin_token), timeout=20)
        requests.delete(f"{BASE_URL}/api/projects/{project_id}", headers=_h(admin_token), timeout=20)
        requests.delete(f"{BASE_URL}/api/clients/{client_id}", headers=_h(admin_token), timeout=20)
