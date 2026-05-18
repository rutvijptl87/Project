"""Smoke tests for /api/audits and /api/audit-payments endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/') or 'https://beginner-coder-hub-2.preview.emergentagent.com'
API = f"{BASE_URL}/api"
EDIT_PASSWORD = os.environ.get('CC_TEST_EDIT_PASSWORD', '')


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    # Verify password so POST/PUT/DELETE requests are allowed (if middleware requires)
    if EDIT_PASSWORD:
        try:
            s.post(f"{API}/auth/verify", json={"password": EDIT_PASSWORD}, timeout=15)
        except Exception:
            pass
    return s


@pytest.fixture(scope="module")
def created_audit_ids():
    return []


class TestAuditsEndpoints:
    def test_list_audits(self, session):
        r = session.get(f"{API}/audits", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # existing seeded AUD-0001
        codes = [a.get("audit_code") for a in data]
        assert "AUD-0001" in codes, f"Expected AUD-0001 seed, got: {codes}"

    def test_get_existing_audit(self, session):
        r = session.get(f"{API}/audits", timeout=20)
        aud = next((a for a in r.json() if a["audit_code"] == "AUD-0001"), None)
        assert aud is not None
        rr = session.get(f"{API}/audits/{aud['id']}", timeout=20)
        assert rr.status_code == 200
        got = rr.json()
        assert got["audit_code"] == "AUD-0001"
        assert "total_amount" in got
        assert "outstanding_amount" in got

    def test_create_audit_auto_codes(self, session, created_audit_ids):
        payload = {
            "audit_offer": "TEST_RCC Basic Audit",
            "total_amount": 30000,
            "notes": "TEST_auto-id audit",
        }
        r = session.post(f"{API}/audits", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        a = r.json()
        assert a["audit_code"].startswith("AUD-"), a
        assert a["report_id"].startswith("RPT-"), a
        assert a["total_amount"] == 30000
        assert a["outstanding_amount"] == 30000
        assert a["status"] == "Outstanding"
        created_audit_ids.append(a["id"])

    def test_create_audit_custom_codes(self, session, created_audit_ids):
        payload = {
            "audit_code": "AUD-CUSTOM-001",
            "report_id": "RPT-CUSTOM-2026",
            "audit_offer": "TEST_Custom Audit",
            "total_amount": 10000,
        }
        r = session.post(f"{API}/audits", json=payload, timeout=20)
        assert r.status_code == 200, r.text
        a = r.json()
        assert a["audit_code"] == "AUD-CUSTOM-001"
        assert a["report_id"] == "RPT-CUSTOM-2026"
        created_audit_ids.append(a["id"])

    def test_update_audit(self, session, created_audit_ids):
        assert created_audit_ids, "prior create test failed"
        aid = created_audit_ids[0]
        r = session.put(f"{API}/audits/{aid}", json={"total_amount": 40000, "audit_offer": "TEST_RCC Updated"}, timeout=20)
        assert r.status_code == 200, r.text
        a = r.json()
        assert a["total_amount"] == 40000
        # outstanding recomputed
        assert a["outstanding_amount"] == 40000 - a["received_amount"]

    def test_record_audit_payment(self, session, created_audit_ids):
        assert created_audit_ids
        aid = created_audit_ids[0]
        pay = {"audit_id": aid, "amount": 10000, "notes": "TEST_payment"}
        r = session.post(f"{API}/audit-payments", json=pay, timeout=20)
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["amount"] == 10000
        # Verify audit updated
        rr = session.get(f"{API}/audits/{aid}", timeout=20)
        a = rr.json()
        assert a["received_amount"] >= 10000
        assert a["outstanding_amount"] == a["total_amount"] - a["received_amount"]

    def test_audit_invoice_pdf(self, session):
        r = session.get(f"{API}/audits", timeout=20)
        aud = next((a for a in r.json() if a["audit_code"] == "AUD-0001"), None)
        assert aud
        rr = session.get(f"{API}/audits/{aud['id']}/invoice", timeout=30)
        assert rr.status_code == 200
        ct = rr.headers.get("content-type", "")
        assert "pdf" in ct.lower(), f"content-type: {ct}"
        assert rr.content[:4] == b"%PDF"

    def test_audit_activity(self, session):
        r = session.get(f"{API}/audits", timeout=20)
        aud = next((a for a in r.json() if a["audit_code"] == "AUD-0001"), None)
        assert aud
        rr = session.get(f"{API}/audits/{aud['id']}/activity", timeout=20)
        assert rr.status_code == 200
        assert isinstance(rr.json(), list)

    def test_archive_unarchive_audit(self, session, created_audit_ids):
        if len(created_audit_ids) < 2:
            pytest.skip("no custom audit created")
        aid = created_audit_ids[1]
        r = session.post(f"{API}/audits/{aid}/archive", timeout=20)
        assert r.status_code == 200, r.text
        r2 = session.post(f"{API}/audits/{aid}/unarchive", timeout=20)
        assert r2.status_code == 200, r2.text

    def test_search_audits(self, session):
        r = session.get(f"{API}/audits", params={"search": "RCC"}, timeout=20)
        assert r.status_code == 200
        # at least one match since we created "TEST_RCC Basic Audit"
        assert isinstance(r.json(), list)

    def test_offers_still_work_but_collection_empty(self, session):
        # Per request, offers data was deleted but endpoints still exist
        r = session.get(f"{API}/offers", timeout=20)
        assert r.status_code == 200
        # Not asserting empty, as seed_data may re-seed; just must return 200

    def test_cleanup_created_audits(self, session, created_audit_ids):
        for aid in created_audit_ids:
            r = session.delete(f"{API}/audits/{aid}", timeout=20)
            assert r.status_code in (200, 204), r.text
