"""
Iteration 17 — Backend tests for:
  - Project.job_no field (create/update/get/search)
  - PUT /api/auth/me/signature (set/clear/validation, engineer scope)
  - GET /api/auth/me returns default_signature
"""
import os
import pytest
import requests
from pathlib import Path


def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        env_file = Path("/app/frontend/.env")
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip()
                    break
    assert url, "REACT_APP_BACKEND_URL not set"
    return url.rstrip("/")


BASE_URL = _load_backend_url()
ADMIN = {"username": "rutvij0213", "password": "Rutvij4141*"}
ENG = {"username": "test_engineer", "password": "EngTest123!"}

# Tiny 1x1 transparent PNG data URL (valid)
TINY_PNG = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAen"
    "LSAAAAABJRU5ErkJggg=="
)


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def eng_token():
    return _login(ENG)


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ----------------------------- Project.job_no -----------------------------
class TestProjectJobNo:
    created_id = None
    job_no_unique = "TEST17JOBNO9911"

    def test_create_project_with_job_no(self, admin_token):
        payload = {
            "name": "TEST_iter17 JobNo Project",
            "job_no": self.job_no_unique,
            "quoted_amount": 10000,
        }
        r = requests.post(f"{BASE_URL}/api/projects", json=payload, headers=_h(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("job_no") == self.job_no_unique
        assert d.get("name") == payload["name"]
        assert "id" in d and "project_code" in d
        TestProjectJobNo.created_id = d["id"]

    def test_get_project_returns_job_no(self, admin_token):
        assert TestProjectJobNo.created_id, "previous test created id"
        r = requests.get(
            f"{BASE_URL}/api/projects/{TestProjectJobNo.created_id}",
            headers=_h(admin_token), timeout=20,
        )
        assert r.status_code == 200
        assert r.json().get("job_no") == self.job_no_unique

    def test_search_by_job_no(self, admin_token):
        r = requests.get(
            f"{BASE_URL}/api/projects?search={self.job_no_unique}",
            headers=_h(admin_token), timeout=20,
        )
        assert r.status_code == 200
        items = r.json()
        assert any(p.get("id") == TestProjectJobNo.created_id for p in items), \
            f"Project not found by job_no search; items={[p.get('job_no') for p in items]}"

    def test_update_project_job_no(self, admin_token):
        assert TestProjectJobNo.created_id
        new_jn = "TEST17JOBNO0002"
        r = requests.put(
            f"{BASE_URL}/api/projects/{TestProjectJobNo.created_id}",
            json={"name": "TEST_iter17 JobNo Project", "job_no": new_jn, "quoted_amount": 12000},
            headers=_h(admin_token), timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("job_no") == new_jn
        # GET verify persistence
        g = requests.get(
            f"{BASE_URL}/api/projects/{TestProjectJobNo.created_id}",
            headers=_h(admin_token), timeout=20,
        )
        assert g.status_code == 200
        assert g.json().get("job_no") == new_jn

    def test_create_project_without_job_no_backward_compat(self, admin_token):
        r = requests.post(
            f"{BASE_URL}/api/projects",
            json={"name": "TEST_iter17 NoJobNo Project", "quoted_amount": 0},
            headers=_h(admin_token), timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("job_no", "") == ""
        # cleanup
        requests.delete(f"{BASE_URL}/api/projects/{d['id']}", headers=_h(admin_token), timeout=20)

    def test_cleanup_project(self, admin_token):
        if TestProjectJobNo.created_id:
            requests.delete(
                f"{BASE_URL}/api/projects/{TestProjectJobNo.created_id}",
                headers=_h(admin_token), timeout=20,
            )


# ----------------------------- Default Signature -----------------------------
class TestDefaultSignature:
    def test_me_returns_default_signature_field(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200
        d = r.json()
        # field must exist (None or string)
        assert "default_signature" in d

    def test_set_signature_admin(self, admin_token):
        r = requests.put(
            f"{BASE_URL}/api/auth/me/signature",
            json={"signature": TINY_PNG},
            headers=_h(admin_token), timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("has_signature") is True

        # Verify persisted via /auth/me
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(admin_token), timeout=20).json()
        assert (me.get("default_signature") or "").startswith("data:image/")

    def test_clear_signature_admin(self, admin_token):
        r = requests.put(
            f"{BASE_URL}/api/auth/me/signature",
            json={"signature": ""},
            headers=_h(admin_token), timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("has_signature") is False
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(admin_token), timeout=20).json()
        assert me.get("default_signature") in (None, "")

    def test_reject_non_data_url(self, admin_token):
        r = requests.put(
            f"{BASE_URL}/api/auth/me/signature",
            json={"signature": "not-a-data-url"},
            headers=_h(admin_token), timeout=20,
        )
        assert r.status_code == 400
        assert "data-URL" in r.text or "data:image" in r.text

    def test_reject_too_large(self, admin_token):
        big = "data:image/png;base64," + ("A" * 410_000)
        r = requests.put(
            f"{BASE_URL}/api/auth/me/signature",
            json={"signature": big},
            headers=_h(admin_token), timeout=20,
        )
        assert r.status_code == 400
        assert "too large" in r.text.lower() or "300" in r.text

    def test_engineer_can_save_own_signature(self, eng_token):
        # Engineer must be allowed (auth required, but no admin gate)
        r = requests.put(
            f"{BASE_URL}/api/auth/me/signature",
            json={"signature": TINY_PNG},
            headers=_h(eng_token), timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("has_signature") is True

        me = requests.get(f"{BASE_URL}/api/auth/me", headers=_h(eng_token), timeout=20).json()
        assert (me.get("default_signature") or "").startswith("data:image/")

        # cleanup — clear it again
        requests.put(
            f"{BASE_URL}/api/auth/me/signature",
            json={"signature": ""},
            headers=_h(eng_token), timeout=20,
        )

    def test_signature_endpoint_requires_auth(self):
        r = requests.put(
            f"{BASE_URL}/api/auth/me/signature",
            json={"signature": TINY_PNG}, timeout=20,
        )
        assert r.status_code in (401, 403)
