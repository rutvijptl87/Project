"""Iteration 14 — Daily housekeeping cleanup of old read notifications + Project SV history regression.

Covers:
- POST /notifications/cleanup as ADMIN -> {ok:true, deleted:int}
- POST /notifications/cleanup as ENGINEER -> 403
- Cleanup correctness: only notifications older than 30 days AND with at least one reader are deleted.
- Regression: GET /site-visits?project_id=<id> still scopes to that project.
- Scheduler log line "Housekeeping scheduler started — daily 03:15 UTC" appears in backend.err.log on startup.
"""
import os
import asyncio
from datetime import datetime, timezone, timedelta

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://beginner-coder-hub-2.preview.emergentagent.com").rstrip("/")
ADMIN_USER = "rutvij0213"
ADMIN_PASS = "Rutvij4141*"
ENG_USER = "test_engineer"
ENG_PASS = "EngTest123!"

# Mongo direct access (same container) — used only for seeding/cleanup of TEST_ notifications
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

TEST_TAG = "TEST_iter14_cleanup_"


# ------------------ fixtures ------------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def engineer_token(admin_headers):
    r = requests.post(f"{BASE_URL}/api/auth/users", headers=admin_headers,
                      json={"username": ENG_USER, "password": ENG_PASS, "name": "Test Engineer", "role": "engineer"}, timeout=20)
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
    return li.json()["token"]


@pytest.fixture(scope="module")
def engineer_headers(engineer_token):
    return {"Authorization": f"Bearer {engineer_token}"}


# ------------------ helpers ------------------
async def _seed_three_notifications():
    """Insert 3 notifications directly into Mongo with controlled created_at.
    Returns (mongo_client, ids_dict)."""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    old = (datetime.now(timezone.utc) - timedelta(days=31)).isoformat()
    recent = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    docs = [
        {
            "id": f"{TEST_TAG}old_read",
            "title": "old read",
            "body": "should be deleted",
            "kind": "system",
            "created_at": old,
            "read_by": ["someone"],
            "target_role": "admin",
        },
        {
            "id": f"{TEST_TAG}old_unread",
            "title": "old unread",
            "body": "should be KEPT (no readers)",
            "kind": "system",
            "created_at": old,
            "read_by": [],
            "target_role": "admin",
        },
        {
            "id": f"{TEST_TAG}recent_read",
            "title": "recent read",
            "body": "should be KEPT (not old enough)",
            "kind": "system",
            "created_at": recent,
            "read_by": ["someone"],
            "target_role": "admin",
        },
    ]
    # Wipe any leftovers from previous runs first
    await db.notifications.delete_many({"id": {"$regex": f"^{TEST_TAG}"}})
    await db.notifications.insert_many(docs)
    return client, db, [d["id"] for d in docs]


async def _final_cleanup():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    await db.notifications.delete_many({"id": {"$regex": f"^{TEST_TAG}"}})
    client.close()


# ------------------ tests ------------------
class TestCleanupRBAC:
    def test_admin_cleanup_returns_ok(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/notifications/cleanup", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert "deleted" in body
        assert isinstance(body["deleted"], int)
        assert body["deleted"] >= 0

    def test_engineer_cleanup_forbidden(self, engineer_headers):
        r = requests.post(f"{BASE_URL}/api/notifications/cleanup", headers=engineer_headers, timeout=20)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"


class TestCleanupCorrectness:
    def test_only_old_read_notifications_pruned(self, admin_headers):
        loop = asyncio.new_event_loop()
        try:
            client, db, ids = loop.run_until_complete(_seed_three_notifications())

            # Sanity check: 3 docs present
            before = loop.run_until_complete(
                db.notifications.count_documents({"id": {"$in": ids}})
            )
            assert before == 3, f"seed failed, expected 3 got {before}"

            # Trigger cleanup via admin endpoint
            r = requests.post(f"{BASE_URL}/api/notifications/cleanup", headers=admin_headers, timeout=20)
            assert r.status_code == 200, r.text
            deleted = r.json().get("deleted", 0)
            assert deleted >= 1, f"expected at least 1 deletion, got {deleted}"

            # Now verify:
            remaining = loop.run_until_complete(
                db.notifications.find({"id": {"$in": ids}}).to_list(length=10)
            )
            remaining_ids = {d["id"] for d in remaining}
            assert f"{TEST_TAG}old_read" not in remaining_ids, "old+read notification should be deleted"
            assert f"{TEST_TAG}old_unread" in remaining_ids, "old+unread notification should be KEPT"
            assert f"{TEST_TAG}recent_read" in remaining_ids, "recent+read notification should be KEPT"
        finally:
            loop.run_until_complete(_final_cleanup())
            loop.close()


class TestSiteVisitsProjectScope:
    """Regression — GET /site-visits?project_id=<id> still scopes to that project."""

    PROJECT_ID = "ac50a1a3-5096-45c6-a0fd-6d0ab0474fdf"

    def test_filter_by_project_id(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/site-visits", headers=admin_headers,
                         params={"project_id": self.PROJECT_ID}, timeout=20)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        # Every returned row must belong to the requested project
        for v in rows:
            assert v.get("project_id") == self.PROJECT_ID, \
                f"site-visit {v.get('visit_code')} has project_id {v.get('project_id')} (expected {self.PROJECT_ID})"

    def test_filter_unknown_project_returns_empty(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/site-visits", headers=admin_headers,
                         params={"project_id": "no-such-project-xyz"}, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json() == []


class TestSchedulerStartupLog:
    """Smoke check — the housekeeping scheduler boot line is present in the backend log."""

    def test_scheduler_log_line_present(self):
        log_path = "/var/log/supervisor/backend.err.log"
        if not os.path.exists(log_path):
            pytest.skip("backend.err.log not accessible from this test runner")
        with open(log_path, "r", errors="ignore") as f:
            txt = f.read()
        assert "Housekeeping scheduler started" in txt, \
            "expected 'Housekeeping scheduler started — daily 03:15 UTC' line in backend log"
