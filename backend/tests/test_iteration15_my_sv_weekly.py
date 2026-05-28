"""Iteration 15 — GET /api/dashboard/my-sv-weekly endpoint backend tests.

Covers:
- default month (current month) returns 5 buckets W1..W5 and target_user_id=current admin
- explicit month YYYY-MM filters correctly and uses day-of-month/7 bucketing
- admin can pass ?engineer_id=<id> to inspect another user
- engineer passing ?engineer_id is IGNORED (target stays themselves)
- invalid month returns HTTP 400 with 'month must be YYYY-MM'
- by_project sorted DESC and capped at 8 entries
- empty month returns zeroed buckets
"""
import os
import uuid
import datetime as dt
from typing import List

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://beginner-coder-hub-2.preview.emergentagent.com").rstrip("/")
ADMIN_USER = "rutvij0213"
ADMIN_PASS = "Rutvij4141*"


# -------- Fixtures --------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def admin_user(admin_token):
    r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"}, timeout=20)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def engineer_user(admin_headers):
    """Create (or reuse) an engineer TEST_iter15_eng / EngTest123!"""
    username = "TEST_iter15_eng"
    password = "EngTest123!"
    r = requests.post(f"{BASE_URL}/api/auth/users", headers=admin_headers,
                      json={"username": username, "password": password, "name": "Iter15 Eng", "role": "engineer"},
                      timeout=20)
    if r.status_code not in (200, 201):
        lst = requests.get(f"{BASE_URL}/api/auth/users", headers=admin_headers, timeout=20).json()
        existing = next((u for u in lst if u["username"].lower() == username.lower()), None)
        assert existing, f"engineer create failed: {r.status_code} {r.text}"
        upd = requests.put(f"{BASE_URL}/api/auth/users/{existing['id']}", headers=admin_headers,
                           json={"password": password, "role": "engineer"}, timeout=20)
        assert upd.status_code == 200, upd.text
    li = requests.post(f"{BASE_URL}/api/auth/login", json={"username": username, "password": password}, timeout=20)
    assert li.status_code == 200
    data = li.json()
    return {"username": username, "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="module")
def engineer_headers(engineer_user):
    return {"Authorization": f"Bearer {engineer_user['token']}"}


@pytest.fixture(scope="module")
def seeded_project(admin_headers):
    """Create a project we can attach visits to."""
    p = {
        "name": f"TEST_iter15_project_{uuid.uuid4().hex[:6]}",
        "client_name": "TEST_iter15_client",
        "architect_name": "TEST_iter15_arch",
        "site_location": "Pune",
    }
    r = requests.post(f"{BASE_URL}/api/projects", headers=admin_headers, json=p, timeout=20)
    assert r.status_code in (200, 201), r.text
    return r.json()


@pytest.fixture(scope="module")
def seeded_visits(admin_headers, seeded_project):
    """Create visits in April-2026 spread across W1, W2, W4 so we can validate bucketing.

    W1 (1-7):  Apr 03 — 1 draft
    W2 (8-14): Apr 10 — 1 submitted + 1 draft
    W4 (22-28): Apr 25 — 1 submitted
    """
    created: List[str] = []
    plan = [
        ("2026-04-03", "draft"),
        ("2026-04-10", "submitted"),
        ("2026-04-10", "draft"),
        ("2026-04-25", "submitted"),
    ]
    for vd, status in plan:
        body = {
            "project_id": seeded_project["id"],
            "inspection_title": f"TEST_iter15_visit_{uuid.uuid4().hex[:4]}",
            "visit_date": vd,
            "status": status,
            "checklist": [],
            "observations": [],
            "photos": [],
        }
        r = requests.post(f"{BASE_URL}/api/site-visits", headers=admin_headers, json=body, timeout=20)
        assert r.status_code in (200, 201), f"seed visit failed: {r.status_code} {r.text}"
        vid = r.json().get("id")
        # If created as submitted but API auto-saves as draft, force-update status
        if r.json().get("status") != status:
            upd = requests.put(f"{BASE_URL}/api/site-visits/{vid}", headers=admin_headers,
                               json={"status": status}, timeout=20)
            assert upd.status_code == 200, upd.text
        created.append(vid)
    yield created
    # teardown
    for vid in created:
        try:
            requests.delete(f"{BASE_URL}/api/site-visits/{vid}", headers=admin_headers, timeout=20)
        except Exception:
            pass
    # delete project
    try:
        requests.delete(f"{BASE_URL}/api/projects/{seeded_project['id']}", headers=admin_headers, timeout=20)
    except Exception:
        pass


# -------- Tests --------
class TestMySvWeekly:
    def test_default_month_admin(self, admin_headers, admin_user):
        """No params → current month, target_user_id = admin id, 5 weekly buckets."""
        r = requests.get(f"{BASE_URL}/api/dashboard/my-sv-weekly", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()

        # Shape
        assert "month" in body and "target_user_id" in body and "weeks" in body and "by_project" in body and "total" in body
        # Target is the admin themselves
        assert body["target_user_id"] == admin_user["id"]
        # Current month format YYYY-MM
        now = dt.datetime.now(dt.timezone.utc)
        assert body["month"] == f"{now.year:04d}-{now.month:02d}"
        # 5 buckets W1..W5
        weeks = body["weeks"]
        assert isinstance(weeks, list) and len(weeks) == 5
        assert [w["week"] for w in weeks] == ["W1", "W2", "W3", "W4", "W5"]
        for w in weeks:
            assert set(["week", "draft", "submitted", "total"]).issubset(w.keys())
            assert isinstance(w["draft"], int) and isinstance(w["submitted"], int) and isinstance(w["total"], int)
        # total is sum of all bucket totals
        assert body["total"] == sum(w["total"] for w in weeks)

    def test_explicit_month_april_2026_bucketing(self, admin_headers, admin_user, seeded_visits):
        """month=2026-04 → W1 has 1, W2 has 2, W4 has 1; W3+W5 empty; total=4."""
        r = requests.get(f"{BASE_URL}/api/dashboard/my-sv-weekly", headers=admin_headers,
                         params={"month": "2026-04"}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["month"] == "2026-04"
        assert body["target_user_id"] == admin_user["id"]

        weeks = {w["week"]: w for w in body["weeks"]}
        # W1 (day 3) — 1 draft
        assert weeks["W1"]["draft"] >= 1
        assert weeks["W1"]["total"] >= 1
        # W2 (day 10) — 1 draft + 1 submitted = 2 total
        assert weeks["W2"]["total"] >= 2
        assert weeks["W2"]["draft"] >= 1
        assert weeks["W2"]["submitted"] >= 1
        # W4 (day 25) — 1 submitted
        assert weeks["W4"]["submitted"] >= 1
        assert weeks["W4"]["total"] >= 1
        # Total at least 4 from our seeds
        assert body["total"] >= 4

    def test_invalid_month_returns_400(self, admin_headers):
        for bad in ["2026", "foo", "2026-13-01", "abcd-ef"]:
            r = requests.get(f"{BASE_URL}/api/dashboard/my-sv-weekly", headers=admin_headers,
                             params={"month": bad}, timeout=20)
            assert r.status_code == 400, f"month={bad} expected 400, got {r.status_code} {r.text}"
            msg = (r.json().get("detail") or "").lower()
            assert "month must be" in msg, f"detail missing canonical message: {msg}"

    def test_admin_can_inspect_engineer(self, admin_headers, admin_user, engineer_user):
        """Admin passing ?engineer_id=<engineer_id> → target_user_id flips to engineer."""
        r = requests.get(f"{BASE_URL}/api/dashboard/my-sv-weekly", headers=admin_headers,
                         params={"engineer_id": engineer_user["user"]["id"]}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["target_user_id"] == engineer_user["user"]["id"]
        assert body["target_user_id"] != admin_user["id"]

    def test_engineer_engineer_id_param_is_ignored(self, engineer_headers, engineer_user, admin_user):
        """Engineer passes ?engineer_id=<admin_id> → MUST be ignored, target stays as engineer."""
        r = requests.get(f"{BASE_URL}/api/dashboard/my-sv-weekly", headers=engineer_headers,
                         params={"engineer_id": admin_user["id"]}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["target_user_id"] == engineer_user["user"]["id"], \
            "engineer should NOT be able to escalate to view someone else's chart"
        assert body["target_user_id"] != admin_user["id"]

    def test_by_project_sorted_desc_and_capped(self, admin_headers, seeded_visits):
        """All 4 seeded visits share one project → by_project has 1 entry with count>=4, sorted DESC, max 8."""
        r = requests.get(f"{BASE_URL}/api/dashboard/my-sv-weekly", headers=admin_headers,
                         params={"month": "2026-04"}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        by_proj = body["by_project"]
        assert isinstance(by_proj, list)
        assert len(by_proj) <= 8, "by_project must be capped at 8 entries"
        if len(by_proj) >= 2:
            counts = [p["count"] for p in by_proj]
            assert counts == sorted(counts, reverse=True), "by_project must be sorted DESC by count"
        # Our seed project should be in the list with count >= 4
        assert by_proj[0]["count"] >= 4
        assert "project_code" in by_proj[0]

    def test_empty_month_returns_zero_buckets(self, admin_headers):
        """A far-future month nobody has visited → 5 zero buckets + total=0."""
        r = requests.get(f"{BASE_URL}/api/dashboard/my-sv-weekly", headers=admin_headers,
                         params={"month": "2099-12"}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["month"] == "2099-12"
        assert body["total"] == 0
        assert len(body["weeks"]) == 5
        for w in body["weeks"]:
            assert w["draft"] == 0 and w["submitted"] == 0 and w["total"] == 0
        assert body["by_project"] == []

    def test_requires_authentication(self):
        """No Authorization header → 401 (or 403)."""
        r = requests.get(f"{BASE_URL}/api/dashboard/my-sv-weekly", timeout=20)
        assert r.status_code in (401, 403), f"expected auth-failure, got {r.status_code}"


# -------- Module teardown — remove the seeded engineer user --------
def test_zz_cleanup(admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    lst = requests.get(f"{BASE_URL}/api/auth/users", headers=h, timeout=20).json()
    eng = next((u for u in lst if u["username"].lower() == "test_iter15_eng"), None)
    if eng:
        requests.delete(f"{BASE_URL}/api/auth/users/{eng['id']}", headers=h, timeout=20)
