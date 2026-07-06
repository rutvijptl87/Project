"""Iteration 9 — Site Visit Inspection module backend tests."""
import io
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://beginner-coder-hub-2.preview.emergentagent.com").rstrip("/")
ADMIN_USER = "rutvij0213"
ADMIN_PASS = "Rutvij4141*"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def engineer_user(admin_headers):
    """Create (or reuse) an engineer user TEST_engineer / EngTest123!"""
    username = "TEST_engineer"
    password = os.environ.get("TEST_ENG_PASS", "")
    assert password, "Set TEST_ENG_PASS env var (see memory/test_credentials.md)"
    # try create
    r = requests.post(f"{BASE_URL}/api/auth/users", headers=admin_headers,
                      json={"username": username, "password": password, "name": "Test Engineer", "role": "engineer"}, timeout=20)
    if r.status_code not in (200, 201):
        # maybe exists; verify by listing
        lst = requests.get(f"{BASE_URL}/api/auth/users", headers=admin_headers, timeout=20).json()
        existing = next((u for u in lst if u["username"].lower() == username.lower()), None)
        assert existing, f"engineer create failed: {r.status_code} {r.text}"
        # reset password to known value via update
        upd = requests.put(f"{BASE_URL}/api/auth/users/{existing['id']}", headers=admin_headers,
                          json={"password": password, "role": "engineer"}, timeout=20)
        assert upd.status_code == 200, upd.text
    # login
    li = requests.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": password}, timeout=20)
    assert li.status_code == 200, li.text
    data = li.json()
    assert data["user"]["role"] == "engineer"
    return {"username": username, "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def engineer_headers(engineer_user):
    return {"Authorization": f"Bearer {engineer_user['token']}"}


# ---------- Templates ----------
class TestTemplates:
    def test_list_default_templates(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/site-visit-templates", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        rows = r.json()
        names = {t["name"] for t in rows}
        # default seeded 5
        for expected in {"Column Inspection", "Slab Inspection", "Beam Inspection",
                         "Foundation Inspection", "Waterproofing Inspection"}:
            assert expected in names, f"Missing default template {expected}; got {names}"

    def test_template_crud(self, admin_headers):
        # create
        payload = {"name": "TEST_Custom Template", "description": "x", "checklist": ["a", "b", "c"]}
        r = requests.post(f"{BASE_URL}/api/site-visit-templates", headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        assert r.json()["checklist"] == ["a", "b", "c"]

        # update
        upd = {"name": "TEST_Custom Template v2", "description": "y", "checklist": ["x", "y"]}
        r2 = requests.put(f"{BASE_URL}/api/site-visit-templates/{tid}", headers=admin_headers, json=upd, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST_Custom Template v2"
        assert r2.json()["checklist"] == ["x", "y"]

        # verify via list
        rl = requests.get(f"{BASE_URL}/api/site-visit-templates", headers=admin_headers, timeout=20).json()
        assert any(t["id"] == tid and t["name"] == "TEST_Custom Template v2" for t in rl)

        # delete
        rd = requests.delete(f"{BASE_URL}/api/site-visit-templates/{tid}", headers=admin_headers, timeout=20)
        assert rd.status_code == 200


# ---------- Site Visits CRUD + PDF + Upload ----------
class TestSiteVisits:
    visit_id = None
    public_token = None
    visit_code = None
    photo_url = None

    def test_upload_photo(self, admin_headers):
        # minimal PNG (1x1 transparent)
        png_bytes = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
                     b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\x00"
                     b"\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82")
        files = {"file": ("test.png", io.BytesIO(png_bytes), "image/png")}
        r = requests.post(f"{BASE_URL}/api/site-visits/uploads", headers=admin_headers, files=files, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "url" in body and body["url"].startswith("/api/uploads/site-visits/")
        assert "filename" in body
        TestSiteVisits.photo_url = body["url"]

        # Fetch via /api/uploads (no auth required - static mount)
        full_url = f"{BASE_URL}{body['url']}"
        g = requests.get(full_url, timeout=20)
        assert g.status_code == 200, f"static upload not retrievable: {g.status_code}"
        assert g.content == png_bytes or len(g.content) > 0

    def test_create_site_visit(self, admin_headers):
        payload = {
            "template_name": "Beam Inspection",
            "inspection_title": "TEST Beam Inspection",
            "job_no": "JOB-TEST-9",
            "customer": "TEST Customer",
            "plot_no": "TEST PLOT",
            "drg_no": "DRG-1",
            "revision": "A",
            "checklist": [
                {"label": "Beam dimensions correct", "compliance": "yes", "remark": "ok"},
                {"label": "Reinforcement OK", "compliance": "na", "remark": ""},
            ],
            "observations": ["All good", "Minor crack noted"],
            "photos": [{"url": TestSiteVisits.photo_url or "", "caption": "Site photo"}],
            "engineer_name": "Admin Engineer",
            "engineer_signature": "data:image/png;base64,iVBORw0KGgo=",
            "site_person_name": "Site Manager",
            "site_person_signature": "",
            "status": "submitted",
        }
        r = requests.post(f"{BASE_URL}/api/site-visits", headers=admin_headers, json=payload, timeout=30)
        assert r.status_code == 200, r.text
        doc = r.json()
        assert doc["visit_code"].startswith("SV-")
        assert doc["public_token"] and len(doc["public_token"]) > 8
        assert doc["inspection_title"] == "TEST Beam Inspection"
        assert len(doc["checklist"]) == 2
        TestSiteVisits.visit_id = doc["id"]
        TestSiteVisits.public_token = doc["public_token"]
        TestSiteVisits.visit_code = doc["visit_code"]

    def test_get_site_visit(self, admin_headers):
        assert TestSiteVisits.visit_id
        r = requests.get(f"{BASE_URL}/api/site-visits/{TestSiteVisits.visit_id}", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["visit_code"] == TestSiteVisits.visit_code
        assert d["photos"] and d["photos"][0]["caption"] == "Site photo"
        assert d["engineer_signature"]

    def test_list_site_visits_all(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/site-visits", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        rows = r.json()
        assert any(v["id"] == TestSiteVisits.visit_id for v in rows)

    def test_update_site_visit(self, admin_headers):
        payload = {
            "template_name": "Beam Inspection",
            "inspection_title": "TEST Beam Inspection UPDATED",
            "job_no": "JOB-TEST-9",
            "checklist": [{"label": "Beam dimensions correct", "compliance": "no", "remark": "needs rework"}],
            "observations": ["Updated obs"],
            "photos": [],
            "engineer_name": "Admin Engineer",
            "site_person_name": "Site Manager",
            "status": "submitted",
        }
        r = requests.put(f"{BASE_URL}/api/site-visits/{TestSiteVisits.visit_id}", headers=admin_headers, json=payload, timeout=20)
        assert r.status_code == 200
        # verify via GET
        g = requests.get(f"{BASE_URL}/api/site-visits/{TestSiteVisits.visit_id}", headers=admin_headers, timeout=20).json()
        assert g["inspection_title"] == "TEST Beam Inspection UPDATED"
        assert g["checklist"][0]["compliance"] == "no"

    def test_pdf_with_auth(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/site-visits/{TestSiteVisits.visit_id}/pdf", headers=admin_headers, timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF")

    def test_public_pdf_no_auth(self):
        """Public PDF endpoint must work WITHOUT Authorization header."""
        url = f"{BASE_URL}/api/site-visits/public/{TestSiteVisits.public_token}/pdf"
        r = requests.get(url, timeout=30)  # no auth headers
        assert r.status_code == 200, f"public pdf failed: {r.status_code} {r.text[:200]}"
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content.startswith(b"%PDF")

    def test_public_pdf_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/site-visits/public/invalid-bad-token/pdf", timeout=20)
        assert r.status_code == 404


# ---------- Engineer RBAC ----------
class TestEngineerRBAC:
    def test_create_engineer_via_post(self, admin_headers):
        """POST /api/auth/users with role=engineer should succeed."""
        username = "TEST_eng_rbac"
        # cleanup if exists
        lst = requests.get(f"{BASE_URL}/api/auth/users", headers=admin_headers, timeout=20).json()
        existing = next((u for u in lst if u["username"].lower() == username.lower()), None)
        if existing:
            requests.delete(f"{BASE_URL}/api/auth/users/{existing['id']}", headers=admin_headers, timeout=20)
        r = requests.post(f"{BASE_URL}/api/auth/users", headers=admin_headers,
                          json={"username": username, "password": "PwdTest123!", "name": "RBAC Eng", "role": "engineer"}, timeout=20)
        assert r.status_code in (200, 201), f"engineer-role create failed: {r.status_code} {r.text}"
        new_id = r.json()["id"]
        assert r.json()["role"] == "engineer"

        # PUT role update — flip to draftsman then back to engineer
        u1 = requests.put(f"{BASE_URL}/api/auth/users/{new_id}", headers=admin_headers, json={"role": "draftsman"}, timeout=20)
        assert u1.status_code == 200
        u2 = requests.put(f"{BASE_URL}/api/auth/users/{new_id}", headers=admin_headers, json={"role": "engineer"}, timeout=20)
        assert u2.status_code == 200, u2.text
        # PUT returns {"ok": True}; verify via list
        lst2 = requests.get(f"{BASE_URL}/api/auth/users", headers=admin_headers, timeout=20).json()
        updated = next((u for u in lst2 if u["id"] == new_id), None)
        assert updated and updated["role"] == "engineer"

        # cleanup
        requests.delete(f"{BASE_URL}/api/auth/users/{new_id}", headers=admin_headers, timeout=20)

    def test_engineer_mine_filter(self, engineer_headers, admin_headers):
        """Engineer creates a visit -> mine=true returns only it; admin-created visits not in engineer's mine list."""
        # engineer creates a visit
        payload = {
            "template_name": "Column Inspection",
            "inspection_title": "TEST Eng-Owned Visit",
            "checklist": [{"label": "Column verticality", "compliance": "yes", "remark": ""}],
            "observations": ["mine"],
            "photos": [],
            "engineer_name": "TEST_engineer",
        }
        rc = requests.post(f"{BASE_URL}/api/site-visits", headers=engineer_headers, json=payload, timeout=20)
        assert rc.status_code == 200, rc.text
        my_visit_id = rc.json()["id"]

        # mine=true as engineer
        r_mine = requests.get(f"{BASE_URL}/api/site-visits?mine=true", headers=engineer_headers, timeout=20)
        assert r_mine.status_code == 200
        mine_rows = r_mine.json()
        assert any(v["id"] == my_visit_id for v in mine_rows), "Engineer's own visit not in mine=true"
        # admin's visit (TestSiteVisits.visit_id) should NOT be in engineer's mine
        if TestSiteVisits.visit_id:
            assert not any(v["id"] == TestSiteVisits.visit_id for v in mine_rows), "Admin visit leaked to engineer mine=true"

        # mine=false (or omitted) as engineer should return all visits (including admin's)
        r_all = requests.get(f"{BASE_URL}/api/site-visits", headers=engineer_headers, timeout=20)
        assert r_all.status_code == 200
        all_ids = {v["id"] for v in r_all.json()}
        assert my_visit_id in all_ids
        if TestSiteVisits.visit_id:
            assert TestSiteVisits.visit_id in all_ids, "mine=false should include all visits"

        # cleanup engineer's visit
        requests.delete(f"{BASE_URL}/api/site-visits/{my_visit_id}", headers=admin_headers, timeout=20)


# ---------- Cleanup ----------
def test_zz_cleanup(admin_token):
    """Delete the site visit we created in TestSiteVisits."""
    h = {"Authorization": f"Bearer {admin_token}"}
    if TestSiteVisits.visit_id:
        r = requests.delete(f"{BASE_URL}/api/site-visits/{TestSiteVisits.visit_id}", headers=h, timeout=20)
        assert r.status_code == 200
        # verify 404 after delete
        g = requests.get(f"{BASE_URL}/api/site-visits/{TestSiteVisits.visit_id}", headers=h, timeout=20)
        assert g.status_code == 404
    # delete TEST_engineer user
    lst = requests.get(f"{BASE_URL}/api/auth/users", headers=h, timeout=20).json()
    eng = next((u for u in lst if u["username"].lower() == "test_engineer"), None)
    if eng:
        requests.delete(f"{BASE_URL}/api/auth/users/{eng['id']}", headers=h, timeout=20)
