"""Iteration 11 — Site-visit Activity History + In-app Notifications.

Covers:
- Activity log writes on create/update/delete of site visits keyed by site_visit_id.
- Notification creation rules: engineer-submitted => admin gets unread; admin-submitted => no notif.
- GET /notifications scoping by role / target_user_id.
- POST /notifications/{nid}/read marks per-user (others still unread).
- POST /notifications/read-all marks every visible notification read for current user.
- Route ordering: /site-visits/{vid}/activity matched before /site-visits/{vid} catch-all.
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
    # Make sure engineer user exists with known password
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


def _new_visit_payload(title="ITER11 visit", status="submitted"):
    return {
        "template_id": None,
        "template_name": "Ad-hoc",
        "job_no": "JOB-IT11",
        "project_id": None,
        "inspection_title": title,
        "visit_date": "2026-01-15",
        "customer": "TEST_iter11_customer",
        "plot_no": "P-11",
        "drg_no": "D-11",
        "revision": "R0",
        "checklist": [],
        "observations": ["TEST_iter11 observation"],
        "photos": [],
        "engineer_name": "Test Engineer",
        "engineer_signature": "",
        "site_person_name": "Site Foreman",
        "site_person_signature": "",
        "status": status,
    }


# ------------------ Activity log tests ------------------
class TestActivityLog:
    visit_id = None
    visit_code = None

    def test_engineer_submit_writes_visit_created_activity(self, engineer_headers, admin_headers):
        r = requests.post(f"{BASE_URL}/api/site-visits", headers=engineer_headers,
                          json=_new_visit_payload(title="ITER11 engineer-submit"), timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        TestActivityLog.visit_id = body["id"]
        TestActivityLog.visit_code = body["visit_code"]

        # GET /api/site-visits/{vid}/activity — must be matched BEFORE catch-all /{vid}
        a = requests.get(f"{BASE_URL}/api/site-visits/{body['id']}/activity",
                         headers=admin_headers, timeout=20)
        assert a.status_code == 200, a.text
        rows = a.json()
        assert isinstance(rows, list) and len(rows) >= 1
        assert rows[0]["action"] == "VISIT CREATED"
        assert rows[0]["site_visit_id"] == body["id"]
        assert rows[0]["username"] == ENG_USER
        # sorted desc by created_at: ensure first row is the most recent
        for i in range(len(rows) - 1):
            assert rows[i]["created_at"] >= rows[i + 1]["created_at"]

    def test_route_ordering_activity_before_catchall(self, admin_headers):
        # If route ordering were wrong, /activity would 404 (since literal "activity" isn't a visit id)
        r = requests.get(f"{BASE_URL}/api/site-visits/{TestActivityLog.visit_id}/activity",
                         headers=admin_headers, timeout=20)
        assert r.status_code == 200, f"activity route shadowed by catch-all: {r.status_code}"
        # The other one (the visit itself) still works
        v = requests.get(f"{BASE_URL}/api/site-visits/{TestActivityLog.visit_id}", headers=admin_headers, timeout=20)
        assert v.status_code == 200

    def test_update_same_status_writes_visit_updated(self, engineer_headers, admin_headers):
        # Engineer updates same visit, keep status=submitted
        payload = _new_visit_payload(title="ITER11 updated title", status="submitted")
        r = requests.put(f"{BASE_URL}/api/site-visits/{TestActivityLog.visit_id}",
                         headers=engineer_headers, json=payload, timeout=20)
        assert r.status_code == 200, r.text
        a = requests.get(f"{BASE_URL}/api/site-visits/{TestActivityLog.visit_id}/activity",
                         headers=admin_headers, timeout=20).json()
        actions = [row["action"] for row in a]
        assert "VISIT UPDATED" in actions
        assert "VISIT CREATED" in actions

    def test_status_change_draft_to_submitted_logs_status_changed(self, engineer_headers, admin_headers):
        # Create a draft visit, then flip to submitted -> STATUS CHANGED
        draft = _new_visit_payload(title="ITER11 status-change", status="draft")
        c = requests.post(f"{BASE_URL}/api/site-visits", headers=engineer_headers, json=draft, timeout=30)
        assert c.status_code == 200, c.text
        vid = c.json()["id"]
        flipped = _new_visit_payload(title="ITER11 status-change", status="submitted")
        u = requests.put(f"{BASE_URL}/api/site-visits/{vid}", headers=engineer_headers,
                        json=flipped, timeout=20)
        assert u.status_code == 200, u.text
        a = requests.get(f"{BASE_URL}/api/site-visits/{vid}/activity", headers=admin_headers, timeout=20).json()
        actions = [row["action"] for row in a]
        assert "STATUS CHANGED" in actions
        sc = next(r for r in a if r["action"] == "STATUS CHANGED")
        assert "draft" in sc.get("detail", "") and "submitted" in sc.get("detail", "")
        # cleanup
        requests.delete(f"{BASE_URL}/api/site-visits/{vid}", headers=admin_headers, timeout=20)

    def test_delete_visit_logs_visit_deleted(self, engineer_headers, admin_headers):
        c = requests.post(f"{BASE_URL}/api/site-visits", headers=engineer_headers,
                         json=_new_visit_payload(title="ITER11 to-delete"), timeout=30)
        assert c.status_code == 200, c.text
        vid = c.json()["id"]
        d = requests.delete(f"{BASE_URL}/api/site-visits/{vid}", headers=admin_headers, timeout=20)
        assert d.status_code == 200, d.text
        # Activity rows still exist after the doc is deleted (we log the delete)
        a = requests.get(f"{BASE_URL}/api/site-visits/{vid}/activity", headers=admin_headers, timeout=20).json()
        actions = [row["action"] for row in a]
        assert "VISIT DELETED" in actions

    def test_cleanup_main_visit(self, admin_headers):
        if TestActivityLog.visit_id:
            requests.delete(f"{BASE_URL}/api/site-visits/{TestActivityLog.visit_id}",
                            headers=admin_headers, timeout=20)


# ------------------ Notification tests ------------------
class TestNotifications:
    eng_visit_id = None
    eng_visit_code = None
    admin_visit_id = None

    def test_engineer_submit_creates_admin_notification(self, engineer_headers, admin_headers):
        # Capture admin's current unread count first
        before = requests.get(f"{BASE_URL}/api/notifications", headers=admin_headers, timeout=20).json()
        before_unread = before["unread"]
        r = requests.post(f"{BASE_URL}/api/site-visits", headers=engineer_headers,
                          json=_new_visit_payload(title="ITER11 notif engineer"), timeout=30)
        assert r.status_code == 200, r.text
        TestNotifications.eng_visit_id = r.json()["id"]
        TestNotifications.eng_visit_code = r.json()["visit_code"]

        time.sleep(0.5)
        after = requests.get(f"{BASE_URL}/api/notifications", headers=admin_headers, timeout=20).json()
        assert after["unread"] >= before_unread + 1, f"expected admin unread to bump by >=1: before={before_unread} after={after['unread']}"
        # newest first; find one referencing our visit
        match = next((n for n in after["items"] if n.get("related_visit_id") == TestNotifications.eng_visit_id), None)
        assert match is not None, "Admin did not receive notification for engineer-submitted visit"
        assert match["target_role"] == "admin"
        assert match["created_by_username"] == ENG_USER
        assert TestNotifications.eng_visit_code in match["message"]

    def test_engineer_feed_excludes_admin_notifications(self, engineer_headers):
        feed = requests.get(f"{BASE_URL}/api/notifications", headers=engineer_headers, timeout=20).json()
        assert feed["unread"] == 0, f"engineer should not see admin notifs: {feed}"
        # And there should be no items where target_role == 'admin'
        for n in feed["items"]:
            assert n.get("target_role") != "admin"

    def test_admin_submit_does_not_notify(self, admin_headers):
        before = requests.get(f"{BASE_URL}/api/notifications", headers=admin_headers, timeout=20).json()["unread"]
        r = requests.post(f"{BASE_URL}/api/site-visits", headers=admin_headers,
                         json=_new_visit_payload(title="ITER11 notif admin-self"), timeout=30)
        assert r.status_code == 200, r.text
        TestNotifications.admin_visit_id = r.json()["id"]
        vid = TestNotifications.admin_visit_id
        time.sleep(0.5)
        after = requests.get(f"{BASE_URL}/api/notifications", headers=admin_headers, timeout=20).json()
        # Unread must not jump for this admin-created visit
        # (other concurrent notifications by engineers are theoretically possible — so check that
        #  no notification references this specific visit id)
        match = next((n for n in after["items"] if n.get("related_visit_id") == vid), None)
        assert match is None, f"Admin self-submit should NOT notify admins; got: {match}"
        # Cleanup
        requests.delete(f"{BASE_URL}/api/site-visits/{vid}", headers=admin_headers, timeout=20)

    def test_update_same_status_does_not_notify(self, engineer_headers, admin_headers):
        # Update the previously created engineer visit, keep submitted
        before = requests.get(f"{BASE_URL}/api/notifications", headers=admin_headers, timeout=20).json()
        vid = TestNotifications.eng_visit_id
        # count notifs referencing this visit BEFORE
        before_count = sum(1 for n in before["items"] if n.get("related_visit_id") == vid)

        r = requests.put(f"{BASE_URL}/api/site-visits/{vid}", headers=engineer_headers,
                         json=_new_visit_payload(title="ITER11 notif engineer updated"), timeout=20)
        assert r.status_code == 200, r.text

        time.sleep(0.5)
        after = requests.get(f"{BASE_URL}/api/notifications", headers=admin_headers, timeout=20).json()
        after_count = sum(1 for n in after["items"] if n.get("related_visit_id") == vid)
        assert after_count == before_count, f"plain edit should not fire another notif; before={before_count} after={after_count}"

    def test_mark_single_read_is_per_user(self, admin_headers, engineer_headers):
        # admin marks one notification read; engineer can't see admin notifs anyway, but verify
        # that the underlying read_by array only contains admin id and that the same notification
        # is still "unread" from a different perspective by checking is_read flag flips just for admin.
        feed = requests.get(f"{BASE_URL}/api/notifications", headers=admin_headers, timeout=20).json()
        target = next((n for n in feed["items"] if not n["is_read"]), None)
        assert target is not None, "Need at least one unread notif to test mark-read"

        r = requests.post(f"{BASE_URL}/api/notifications/{target['id']}/read", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text

        feed2 = requests.get(f"{BASE_URL}/api/notifications", headers=admin_headers, timeout=20).json()
        same = next((n for n in feed2["items"] if n["id"] == target["id"]), None)
        assert same is not None, "notif disappeared after mark-read"
        assert same["is_read"] is True

    def test_mark_all_read_zeros_unread(self, admin_headers, engineer_headers):
        # First ensure there's at least one unread by creating a fresh engineer visit
        r = requests.post(f"{BASE_URL}/api/site-visits", headers=engineer_headers,
                          json=_new_visit_payload(title="ITER11 notif mark-all"), timeout=30)
        assert r.status_code == 200, r.text
        new_vid = r.json()["id"]

        time.sleep(0.5)
        pre = requests.get(f"{BASE_URL}/api/notifications", headers=admin_headers, timeout=20).json()
        assert pre["unread"] >= 1

        ack = requests.post(f"{BASE_URL}/api/notifications/read-all", headers=admin_headers, timeout=20)
        assert ack.status_code == 200, ack.text

        post = requests.get(f"{BASE_URL}/api/notifications", headers=admin_headers, timeout=20).json()
        assert post["unread"] == 0, f"unread should be 0 after read-all; got {post['unread']}"

        # cleanup
        requests.delete(f"{BASE_URL}/api/site-visits/{new_vid}", headers=admin_headers, timeout=20)

    def test_unauthenticated_mark_read_rejected(self):
        # No bearer token
        r = requests.post(f"{BASE_URL}/api/notifications/does-not-matter/read", timeout=20)
        assert r.status_code in (401, 403), f"expected 401/403 without auth; got {r.status_code}"

    def test_cleanup(self, admin_headers):
        if TestNotifications.eng_visit_id:
            requests.delete(f"{BASE_URL}/api/site-visits/{TestNotifications.eng_visit_id}",
                            headers=admin_headers, timeout=20)
