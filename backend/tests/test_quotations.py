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

class TestQuotations:
    def test_quotation_endpoints(self, admin_token):
        # 1. Create a dummy client to link to the quotation
        import secrets
        import random
        rand_suffix = secrets.token_hex(4)
        rand_phone = "".join([str(random.randint(0, 9)) for _ in range(10)])
        client_payload = {
            "name": f"TEST QUOTATION CLIENT {rand_suffix}",
            "phone": rand_phone,
            "email": f"testclient-{rand_suffix}@quotation.com",
            "company": "Test Quotation Client Co.",
            "address": "456 Test Proposal Rd, Maharashtra, 400002"
        }
        r_client = requests.post(f"{BASE_URL}/api/clients", json=client_payload, headers=_h(admin_token), timeout=20)
        assert r_client.status_code == 200, r_client.text
        client = r_client.json()
        client_id = client["id"]

        # 2. Get list of existing quotations
        r_list_pre = requests.get(f"{BASE_URL}/api/quotations", headers=_h(admin_token), timeout=20)
        assert r_list_pre.status_code == 200
        quotations_pre = r_list_pre.json()

        # 3. Create a Quotation with valid till date
        quotation_payload = {
            "transaction_date": "2026-07-08",
            "valid_till": "2026-08-08",
            "client_id": client_id,
            "client_name": client["name"],
            "client_gstin": "27AAOPV1111A1Z1",
            "client_address": client["address"],
            "place_of_supply": "Maharashtra",
            "items": [
                {
                    "item_code": "CONSULTING-01",
                    "description": "General Structure Consultation",
                    "qty": 1.0,
                    "rate": 75000.0,
                    "is_alternative": False
                },
                {
                    "item_code": "CONSULTING-ALT",
                    "description": "Premium High-Rise Construction Consulting",
                    "qty": 1.0,
                    "rate": 120000.0,
                    "is_alternative": True
                }
            ],
            "discount_percentage": 5.0,
            "discount_amount": 0.0,
            "apply_discount_on": "Net Total",
            "gst_percent": 18.0,
            "status": "Draft",
            "order_lost_reason": "",
            
            # Custom ERPNext fields
            "series": "SAL-QTN-.YYYY.-",
            "quotation_to": "Customer",
            "job_type": "Structural Design",
            "job_sub_type": "Residential",
            "greetings": "Dear Sir, greetings details here.",

            # Address & Contact fields
            "customer_address": "Addr-12345",
            "address_display": "123 Billing Road, Mumbai",
            "contact_person": "Jane Doe",
            "contact_display": "Jane Doe\nPh: 9998887777",
            "contact_mobile": "9998887777",
            "contact_email": "jane@doe.com",
            
            # Terms & Milestones
            "payment_terms_template": "Standard Consulting",
            "payment_schedule": [
                {
                    "payment_term": "Milestone 1",
                    "description": "50% Advance Payment",
                    "due_date": "2026-07-15",
                    "invoice_portion": 50.0,
                    "value": 37500.0
                },
                {
                    "payment_term": "Milestone 2",
                    "description": "50% Delivery Payment",
                    "due_date": "2026-08-01",
                    "invoice_portion": 50.0,
                    "value": 37500.0
                }
            ],
            "tc_name": "Standard Consulting Terms",
            "terms": "Detailed term rules here.",
            
            # Print & Marketing metadata
            "utm_source": "Newsletter",
            "utm_medium": "Email",
            "utm_campaign": "SummerPromo",
            "utm_content": "StructuralOffer",
            "opportunity": "OPP-2026-042",
            "supplier_quotation": "SQ-001",
            "auto_repeat": "",
            "letter_head": "Default Letterhead",
            "group_same_items": True,
            "select_print_heading": "Quotation",
            "language": "English",
            "internal_notes": "Internal note text."
        }
        r_q = requests.post(f"{BASE_URL}/api/quotations", json=quotation_payload, headers=_h(admin_token), timeout=20)
        assert r_q.status_code == 200, r_q.text
        quotation = r_q.json()
        assert quotation["status"] == "Draft"
        assert quotation["quotation_no"].startswith("CC > QTN >")
        assert quotation["job_type"] == "Structural Design"
        assert quotation["job_sub_type"] == "Residential"
        assert quotation["greetings"] == "Dear Sir, greetings details here."
        assert quotation["customer_address"] == "Addr-12345"
        assert quotation["contact_email"] == "jane@doe.com"
        assert len(quotation["payment_schedule"]) == 2
        assert quotation["payment_schedule"][0]["payment_term"] == "Milestone 1"
        assert quotation["payment_schedule"][0]["invoice_portion"] == 50.0
        assert quotation["utm_source"] == "Newsletter"
        assert quotation["group_same_items"] is True
        assert len(quotation["items"]) == 2

        # 4. Check Date Validations (valid_till cannot be before transaction_date)
        invalid_date_payload = quotation_payload.copy()
        invalid_date_payload["valid_till"] = "2026-07-01"  # before 2026-07-08
        r_invalid = requests.post(f"{BASE_URL}/api/quotations", json=invalid_date_payload, headers=_h(admin_token), timeout=20)
        assert r_invalid.status_code == 400
        assert "Valid till date cannot be before transaction date" in r_invalid.text

        # 5. Verify GET quotations lists the new document
        r_list_post = requests.get(f"{BASE_URL}/api/quotations", headers=_h(admin_token), timeout=20)
        quotations_post = r_list_post.json()
        assert len(quotations_post) == len(quotations_pre) + 1

        # 6. Test PUT update
        updated_payload = quotation.copy()
        updated_payload["discount_percentage"] = 10.0
        r_update = requests.put(f"{BASE_URL}/api/quotations/{quotation['id']}", json=updated_payload, headers=_h(admin_token), timeout=20)
        assert r_update.status_code == 200
        assert r_update.json()["discount_percentage"] == 10.0

        # 7. Test status update to Open (Submit)
        r_status_open = requests.post(f"{BASE_URL}/api/quotations/{quotation['id']}/status", json={"status": "Open"}, headers=_h(admin_token), timeout=20)
        assert r_status_open.status_code == 200
        assert r_status_open.json()["status"] == "Open"

        # 8. Verify non-Draft quotation cannot be deleted
        r_delete_fail = requests.delete(f"{BASE_URL}/api/quotations/{quotation['id']}", headers=_h(admin_token), timeout=20)
        assert r_delete_fail.status_code == 400
        assert "Only Draft quotations can be deleted" in r_delete_fail.text

        # 9. Test status update to Lost (requires lost reason)
        r_status_lost = requests.post(f"{BASE_URL}/api/quotations/{quotation['id']}/status", json={"status": "Lost", "order_lost_reason": "Client chose competitor"}, headers=_h(admin_token), timeout=20)
        assert r_status_lost.status_code == 200
        assert r_status_lost.json()["status"] == "Lost"
        assert r_status_lost.json()["order_lost_reason"] == "Client chose competitor"

        # 10. Verify pagination
        r_paginated = requests.get(f"{BASE_URL}/api/quotations/paginated", params={"page": 1, "limit": 10}, headers=_h(admin_token), timeout=20)
        assert r_paginated.status_code == 200
        paginated_data = r_paginated.json()
        assert "data" in paginated_data
        assert "total" in paginated_data
        assert paginated_data["total"] >= 1
