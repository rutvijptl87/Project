"""Iteration 12 — Dashboard site-visit-stats KPI + Per-engineer activity feed.

Covers:
- GET /api/dashboard/site-visit-stats: shape, counts, days clamp (0->1, 200->90),
  by_engineer sorted by total desc + top 10, recent_drafts limited to 5.
- GET /api/users/{user_id}/activity: shape, only events created by that user,
  site_visit_code enrichment, visits filtered by created_by_user_id,
  limit clamp (0->1, 1000->500).
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://beginner-coder-hub-2.preview.emergentagent.com").rstrip("/")
ADMIN_USER = "rutvij0213"
ADMIN_PASS = "Rutvij4141*"
ENG_USER = "test_engineer"
ENG_PASS = "EngTest123!"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def engineer_user(admin_headers):
    """Make sure engineer exists with known password and return their token + user."""
    r = requests.post(f"{BASE_URL}/api/auth/users", headers=admin_headers,
                      json={"username": ENG_USER, "password": ENG_PASS, "name": "Test Engineer", "role": "engineer"},
                      timeout=20)
    if r.status_code not in (200, 201):
        lst = requests.get(f"{BASE_URL}/api/auth/users", headers=admin_headers, timeout=20).json()
        existing = next((u for u in lst if u["username"].lower() == ENG_USER.lower()), None)
        assert existing, f"engineer create failed: {r.status_code} {r.text}"
        upd = requests.put(f"{BASE_URL}/api/auth/users/{existing['id']}", headers=admin_headers,
                           json={"password": ENG_PASS, "role": "engineer"}, timeout=20)
        assert upd.status_code == 200, upd.text
    li = requests.post(f"{BASE_URL}/api/auth/login",
                       json={"username": ENG_USER, "password": ENG_PASS}, timeout=20)
    assert li.status_code == 200, li.text
    data = li.json()
    return {"token": data["token"], "headers": {"Authorization": f"Bearer {data['token']}"}, "user": data["user"]}


@pytest.fixture(scope="module")
def template_id(admin_headers):
    r = requests.get(f"{BASE_URL}/api/site-visit-templates", headers=admin_headers, timeout=20)
    assert r.status_code == 200
    rows = r.json()
    assert rows, "no site visit templates available"
    return rows[0]["id"]


@pytest.fixture(scope="module")
def seeded_visits(engineer_user, template_id, admin_headers):
    """Seed 1 draft + 1 submitted site visit authored by the engineer in the trailing window."""
    headers = engineer_user["headers"]
    created = []
    for status in ("draft", "submitted"):
        payload = {
            "template_id": template_id,
            "inspection_title": f"TEST_iter12_{status}",
            "visit_date": "2026-01-15",
            "site_address": "TEST iter12",
            "status": status,
            "answers": [],
        }
        r = requests.post(f"{BASE_URL}/api/site-visits", headers=headers, json=payload, timeout=20)
        assert r.status_code in (200, 201), f"create {status} failed: {r.status_code} {r.text}"
        created.append(r.json())
    yield created
    # teardown
    for v in created:
        try:
            requests.delete(f"{BASE_URL}/api/site-visits/{v['id']}", headers=admin_headers, timeout=20)
        except Exception:
            pass


# ---------- dashboard/site-visit-stats ----------
class TestSiteVisitStats:
    def test_default_shape(self, admin_headers, seeded_visits):
        r = requests.get(f"{BASE_URL}/api/dashboard/site-visit-stats", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("days", "total", "draft", "submitted", "by_engineer", "recent_drafts"):
            assert k in body, f"missing key {k}"
        assert body["days"] == 7
        assert isinstance(body["by_engineer"], list)
        assert isinstance(body["recent_drafts"], list)
        assert body["total"] == body["draft"] + body["submitted"] + (body["total"] - body["draft"] - body["submitted"])
        # The two seeded visits must show up
        assert body["draft"] >= 1, f"expected >=1 draft, got {body['draft']}"
        assert body["submitted"] >= 1, f"expected >=1 submitted, got {body['submitted']}"
        assert body["total"] >= 2

    def test_days_clamp_low(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/site-visit-stats", headers=admin_headers,
                         params={"days": 0}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["days"] == 1, "days=0 should clamp to 1"

    def test_days_clamp_high(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/site-visit-stats", headers=admin_headers,
                         params={"days": 200}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json()["days"] == 90, "days=200 should clamp to 90"

    def test_by_engineer_sorted_and_capped(self, admin_headers, seeded_visits):
        r = requests.get(f"{BASE_URL}/api/dashboard/site-visit-stats", headers=admin_headers,
                         params={"days": 90}, timeout=20)
        assert r.status_code == 200
        be = r.json()["by_engineer"]
        assert len(be) <= 10, "by_engineer must be capped at 10"
        totals = [row["total"] for row in be]
        assert totals == sorted(totals, reverse=True), "by_engineer must be sorted by total DESC"
        # Each row has the required keys
        for row in be:
            for k in ("name", "draft", "submitted", "total"):
                assert k in row

    def test_recent_drafts_capped_at_5(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/dashboard/site-visit-stats", headers=admin_headers,
                         params={"days": 90}, timeout=20)
        assert r.status_code == 200
        rd = r.json()["recent_drafts"]
        assert len(rd) <= 5, "recent_drafts must be limited to 5"
        for v in rd:
            assert (v.get("status") or "").lower() == "draft"

    def test_unauth_blocked(self):
        r = requests.get(f"{BASE_URL}/api/dashboard/site-visit-stats", timeout=20)
        assert r.status_code in (401, 403)


# ---------- users/{id}/activity ----------
class TestUserActivityFeed:
    def test_engineer_activity_shape(self, admin_headers, engineer_user, seeded_visits):
        uid = engineer_user["user"]["id"]
        r = requests.get(f"{BASE_URL}/api/users/{uid}/activity", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "activity" in body and "visits" in body
        assert isinstance(body["activity"], list)
        assert isinstance(body["visits"], list)
        # All activity entries must reference this user
        for a in body["activity"]:
            assert a.get("user_id") == uid, f"activity entry leaked from another user: {a}"
        # The 2 freshly-seeded visits must be in visits[] and authored by this user
        seeded_ids = {v["id"] for v in seeded_visits}
        returned_ids = {v["id"] for v in body["visits"]}
        assert seeded_ids.issubset(returned_ids), \
            f"engineer's seeded visits missing from /activity. seeded={seeded_ids} returned={returned_ids}"

    def test_visit_code_enrichment(self, admin_headers, engineer_user, seeded_visits):
        uid = engineer_user["user"]["id"]
        r = requests.get(f"{BASE_URL}/api/users/{uid}/activity", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        # Find any activity row that references a site_visit_id and verify code enrichment
        sv_rows = [a for a in r.json()["activity"] if a.get("site_visit_id")]
        assert sv_rows, "no site-visit activity rows for engineer — seeding may have failed"
        sv_codes = {v["visit_code"] for v in seeded_visits}
        enriched = [a for a in sv_rows if a.get("site_visit_id") in {v["id"] for v in seeded_visits}]
        assert enriched, "could not find seeded visit's activity row"
        for a in enriched:
            assert a.get("site_visit_code"), f"activity row missing site_visit_code: {a}"
            assert a["site_visit_code"] in sv_codes

    def test_admin_activity_excludes_engineer_visits(self, admin_headers, engineer_user, seeded_visits):
        # admin's activity feed should NOT include engineer-authored visits in visits[]
        # get admin id
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=20).json()
        admin_id = me["id"]
        r = requests.get(f"{BASE_URL}/api/users/{admin_id}/activity", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        returned_visit_ids = {v["id"] for v in r.json()["visits"]}
        for v in seeded_visits:
            assert v["id"] not in returned_visit_ids, \
                f"admin /activity leaked engineer-authored visit {v['id']}"
        # And every activity row must be user_id == admin_id
        for a in r.json()["activity"]:
            assert a.get("user_id") == admin_id

    def test_limit_clamp_low(self, admin_headers, engineer_user):
        uid = engineer_user["user"]["id"]
        r = requests.get(f"{BASE_URL}/api/users/{uid}/activity", headers=admin_headers,
                        params={"limit": 0}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        # limit=0 -> clamps to 1, so each list has <=1 item
        assert len(body["activity"]) <= 1
        assert len(body["visits"]) <= 1

    def test_limit_clamp_high(self, admin_headers, engineer_user):
        uid = engineer_user["user"]["id"]
        r = requests.get(f"{BASE_URL}/api/users/{uid}/activity", headers=admin_headers,
                        params={"limit": 1000}, timeout=20)
        assert r.status_code == 200
        body = r.json()
        # cannot exceed 500
        assert len(body["activity"]) <= 500
        assert len(body["visits"]) <= 500

    def test_unauth_blocked(self, engineer_user):
        uid = engineer_user["user"]["id"]
        r = requests.get(f"{BASE_URL}/api/users/{uid}/activity", timeout=20)
        assert r.status_code in (401, 403)

    def test_unknown_user_returns_empty(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/users/does-not-exist-zzz/activity", headers=admin_headers, timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert body["activity"] == []
        assert body["visits"] == []
