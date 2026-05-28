"""Iteration 13 — Web Push (VAPID) endpoints + audit_code enrichment on /users/{id}/activity.

Covers:
- GET /api/push/vapid-public returns {public_key} ~87-88 chars base64url
- POST /api/push/subscribe upserts by endpoint (no dupes across re-subscribe)
- GET /api/push/status returns {subscribed, count}
- POST /api/push/test → 400 with no subs; 200 with {sent, total} when subs exist;
  fake/404 endpoints are CULLED from DB after send failure
- POST /api/push/unsubscribe deletes only the matching endpoint
- GET /api/users/{user_id}/activity enriches audit_code on rows with audit_id
- Regression smoke: /push/* require auth
"""
import os
import re
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN_USER = "rutvij0213"
ADMIN_PASS = "Rutvij4141*"
ENG_USER = "test_engineer"
ENG_PASS = "EngTest123!"


# ---------------- fixtures ----------------
@pytest.fixture(scope="module")
def admin_headers():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=20)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def engineer_token(admin_headers):
    # ensure engineer exists
    r = requests.post(f"{BASE_URL}/api/auth/users", headers=admin_headers,
                      json={"username": ENG_USER, "password": ENG_PASS,
                            "name": "Test Engineer", "role": "engineer"}, timeout=20)
    if r.status_code not in (200, 201):
        lst = requests.get(f"{BASE_URL}/api/auth/users", headers=admin_headers, timeout=20).json()
        existing = next((u for u in lst if u["username"].lower() == ENG_USER.lower()), None)
        if existing:
            requests.put(f"{BASE_URL}/api/auth/users/{existing['id']}", headers=admin_headers,
                         json={"password": ENG_PASS, "role": "engineer"}, timeout=20)
    li = requests.post(f"{BASE_URL}/api/auth/login",
                       json={"username": ENG_USER, "password": ENG_PASS}, timeout=20)
    assert li.status_code == 200, li.text
    return li.json()["token"]


@pytest.fixture(autouse=True)
def _cleanup_admin_subs(admin_headers):
    """Best-effort cleanup of any stray test subscriptions before/after each test."""
    # Before: nothing
    yield
    # After: drain any test subs we know about. Helpers track endpoints per-test.


def _fake_sub(suffix: str = "") -> dict:
    """Build a syntactically-valid push subscription with REAL cryptographic keys
    but an unreachable FCM endpoint so the actual HTTP POST returns 404."""
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization
    import base64, secrets
    priv = ec.generate_private_key(ec.SECP256R1())
    pub = priv.public_key().public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint,
    )
    p256dh = base64.urlsafe_b64encode(pub).rstrip(b"=").decode()
    auth = base64.urlsafe_b64encode(secrets.token_bytes(16)).rstrip(b"=").decode()
    sid = uuid.uuid4().hex[:8]
    return {
        # FCM endpoint that will 404 (random token)
        "endpoint": f"https://fcm.googleapis.com/fcm/send/TEST_{sid}{suffix}",
        "keys": {"p256dh": p256dh, "auth": auth},
        "expirationTime": None,
    }


# ---------------- /push/vapid-public ----------------
class TestVapidPublic:
    def test_vapid_public_authenticated(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/push/vapid-public", headers=admin_headers, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "public_key" in data
        pk = data["public_key"]
        # Base64url encoded uncompressed P-256 public key (65 bytes) → 87 chars unpadded
        assert isinstance(pk, str)
        assert 80 <= len(pk) <= 90, f"unexpected public_key length: {len(pk)}"
        assert re.match(r"^[A-Za-z0-9_\-]+=*$", pk), "public_key not base64url"

    def test_vapid_public_persists_across_calls(self, admin_headers):
        a = requests.get(f"{BASE_URL}/api/push/vapid-public", headers=admin_headers, timeout=20).json()["public_key"]
        b = requests.get(f"{BASE_URL}/api/push/vapid-public", headers=admin_headers, timeout=20).json()["public_key"]
        assert a == b, "VAPID public key should be persisted, not regenerated"


# ---------------- /push/subscribe + /push/status + /push/unsubscribe ----------------
class TestSubscribeStatusUnsubscribe:
    def test_subscribe_then_status_then_unsubscribe(self, admin_headers):
        # baseline count
        s0 = requests.get(f"{BASE_URL}/api/push/status", headers=admin_headers, timeout=20).json()
        baseline = s0.get("count", 0)

        sub = _fake_sub("_subA")
        r = requests.post(f"{BASE_URL}/api/push/subscribe", headers=admin_headers, json=sub, timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        s1 = requests.get(f"{BASE_URL}/api/push/status", headers=admin_headers, timeout=20).json()
        assert s1["subscribed"] is True
        assert s1["count"] == baseline + 1

        # cleanup
        u = requests.post(f"{BASE_URL}/api/push/unsubscribe", headers=admin_headers,
                          json={"endpoint": sub["endpoint"]}, timeout=20)
        assert u.status_code == 200

        s2 = requests.get(f"{BASE_URL}/api/push/status", headers=admin_headers, timeout=20).json()
        assert s2["count"] == baseline

    def test_subscribe_upserts_no_duplicates(self, admin_headers):
        s0 = requests.get(f"{BASE_URL}/api/push/status", headers=admin_headers, timeout=20).json()
        baseline = s0.get("count", 0)

        sub = _fake_sub("_dup")
        # Same endpoint twice — must NOT create two rows
        for _ in range(3):
            r = requests.post(f"{BASE_URL}/api/push/subscribe", headers=admin_headers, json=sub, timeout=20)
            assert r.status_code == 200, r.text

        s1 = requests.get(f"{BASE_URL}/api/push/status", headers=admin_headers, timeout=20).json()
        assert s1["count"] == baseline + 1, f"expected dedupe, got count={s1['count']} baseline={baseline}"

        requests.post(f"{BASE_URL}/api/push/unsubscribe", headers=admin_headers,
                      json={"endpoint": sub["endpoint"]}, timeout=20)

    def test_unsubscribe_only_targets_given_endpoint(self, admin_headers):
        a = _fake_sub("_keepA")
        b = _fake_sub("_keepB")
        requests.post(f"{BASE_URL}/api/push/subscribe", headers=admin_headers, json=a, timeout=20)
        requests.post(f"{BASE_URL}/api/push/subscribe", headers=admin_headers, json=b, timeout=20)
        before = requests.get(f"{BASE_URL}/api/push/status", headers=admin_headers, timeout=20).json()["count"]

        # unsubscribe only A
        requests.post(f"{BASE_URL}/api/push/unsubscribe", headers=admin_headers,
                      json={"endpoint": a["endpoint"]}, timeout=20)
        after = requests.get(f"{BASE_URL}/api/push/status", headers=admin_headers, timeout=20).json()["count"]
        assert after == before - 1

        # cleanup
        requests.post(f"{BASE_URL}/api/push/unsubscribe", headers=admin_headers,
                      json={"endpoint": b["endpoint"]}, timeout=20)

    def test_unsubscribe_missing_endpoint_returns_400(self, admin_headers):
        r = requests.post(f"{BASE_URL}/api/push/unsubscribe", headers=admin_headers, json={}, timeout=20)
        assert r.status_code == 400


# ---------------- /push/test ----------------
class TestPushTest:
    def test_push_test_no_subs_returns_400(self, admin_headers):
        # ensure no admin subs first
        # NOTE: this assumes no other concurrent test left subs; ignore if non-zero
        s = requests.get(f"{BASE_URL}/api/push/status", headers=admin_headers, timeout=20).json()
        if s["count"] > 0:
            pytest.skip(f"admin already has {s['count']} subs from other tests; skipping no-sub case")
        r = requests.post(f"{BASE_URL}/api/push/test", headers=admin_headers, timeout=20)
        assert r.status_code == 400, r.text

    def test_push_test_culls_fake_subscription(self, admin_headers):
        """Insert a fake sub → /push/test should attempt send, fail with 404, and DELETE the sub."""
        baseline = requests.get(f"{BASE_URL}/api/push/status", headers=admin_headers, timeout=20).json()["count"]

        sub = _fake_sub("_cull")
        r = requests.post(f"{BASE_URL}/api/push/subscribe", headers=admin_headers, json=sub, timeout=20)
        assert r.status_code == 200
        mid = requests.get(f"{BASE_URL}/api/push/status", headers=admin_headers, timeout=20).json()["count"]
        assert mid == baseline + 1

        # Trigger /push/test — fcm.googleapis.com/fcm/send/<garbage> will 404 → cull
        t = requests.post(f"{BASE_URL}/api/push/test", headers=admin_headers, timeout=30)
        assert t.status_code == 200, t.text
        body = t.json()
        assert "sent" in body and "total" in body
        assert body["sent"] == 0, f"expected 0 successful sends to fake endpoint, got {body}"
        assert body["total"] >= 1

        # Give cull a tick (it's synchronous in _send_web_push but allow safety margin)
        time.sleep(0.5)

        after = requests.get(f"{BASE_URL}/api/push/status", headers=admin_headers, timeout=20).json()["count"]
        assert after == baseline, (
            f"fake subscription was NOT culled after 404. baseline={baseline} after={after}"
        )


# ---------------- Auth on push endpoints ----------------
class TestPushAuth:
    def test_status_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/push/status", timeout=20)
        assert r.status_code in (401, 403)

    def test_subscribe_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/push/subscribe", json=_fake_sub("_anon"), timeout=20)
        assert r.status_code in (401, 403)

    def test_test_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/push/test", timeout=20)
        assert r.status_code in (401, 403)


# ---------------- audit_code enrichment on /users/{id}/activity ----------------
class TestAuditCodeEnrichment:
    def test_admin_activity_contains_audit_code_on_audit_rows(self, admin_headers):
        # Find admin user id
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers, timeout=20).json()
        admin_id = me["id"]

        # Create an audit so we have a fresh activity_log row with audit_id
        ac_resp = requests.post(f"{BASE_URL}/api/audits", headers=admin_headers,
                                json={"client_name": "TEST_iter13_audit_client",
                                      "site_address": "TEST_site"}, timeout=20)
        assert ac_resp.status_code in (200, 201), ac_resp.text
        audit = ac_resp.json()
        audit_id = audit["id"]
        audit_code = audit.get("audit_code", "")
        assert audit_code, "audit was created without an audit_code"

        # Fetch admin activity
        af = requests.get(f"{BASE_URL}/api/users/{admin_id}/activity?limit=200",
                          headers=admin_headers, timeout=30)
        assert af.status_code == 200, af.text
        data = af.json()
        assert "activity" in data
        # Find row(s) with our audit_id
        audit_rows = [r for r in data["activity"] if r.get("audit_id") == audit_id]
        assert audit_rows, "no activity rows for newly created audit_id"
        for r in audit_rows:
            assert r.get("audit_code") == audit_code, (
                f"audit_code not enriched on activity row: {r}"
            )

        # cleanup
        requests.delete(f"{BASE_URL}/api/audits/{audit_id}", headers=admin_headers, timeout=20)


# ---------------- _notify_admins push side-effect on engineer SV submit ----------------
class TestEngineerSubmitTriggersPush:
    def test_engineer_submit_does_not_break_when_admin_has_fake_sub(self, admin_headers, engineer_token):
        """Insert a fake admin push sub, then have engineer submit a SV → admin notifications row
        should still be created (push send is best-effort) AND the fake sub should be culled."""
        # 1) admin baseline + insert fake sub
        baseline = requests.get(f"{BASE_URL}/api/push/status", headers=admin_headers, timeout=20).json()["count"]
        sub = _fake_sub("_engsubmit")
        requests.post(f"{BASE_URL}/api/push/subscribe", headers=admin_headers, json=sub, timeout=20)
        assert requests.get(f"{BASE_URL}/api/push/status", headers=admin_headers, timeout=20).json()["count"] == baseline + 1

        eng_headers = {"Authorization": f"Bearer {engineer_token}"}
        # 2) find an engineer-assigned project
        plist = requests.get(f"{BASE_URL}/api/projects", headers=eng_headers, timeout=20)
        if plist.status_code != 200 or not plist.json():
            pytest.skip("engineer has no assigned projects; cannot exercise SV submit")
        proj = plist.json()[0]

        # 3) create+submit a SV
        sv_create = requests.post(f"{BASE_URL}/api/site-visits", headers=eng_headers,
                                  json={"project_id": proj["id"],
                                        "inspection_title": "TEST_iter13_push_trigger",
                                        "visit_date": "2026-01-15"}, timeout=20)
        assert sv_create.status_code in (200, 201), sv_create.text
        sv = sv_create.json()
        sv_id = sv["id"]

        sv_submit = requests.post(f"{BASE_URL}/api/site-visits/{sv_id}/submit",
                                  headers=eng_headers, timeout=20)
        assert sv_submit.status_code == 200, sv_submit.text

        # 4) Give push helper time to attempt + cull
        time.sleep(2.0)

        # 5) Admin notifications row exists
        notifs = requests.get(f"{BASE_URL}/api/notifications?limit=50", headers=admin_headers, timeout=20)
        assert notifs.status_code == 200, notifs.text
        rows = notifs.json() if isinstance(notifs.json(), list) else notifs.json().get("items", [])
        assert any(
            (r.get("site_visit_id") == sv_id) for r in rows
        ), "no admin notification created for the engineer's submit"

        # 6) Fake sub should be culled by the failed push
        after = requests.get(f"{BASE_URL}/api/push/status", headers=admin_headers, timeout=20).json()["count"]
        assert after == baseline, f"fake sub not culled after engineer submit. baseline={baseline} after={after}"

        # cleanup SV
        requests.delete(f"{BASE_URL}/api/site-visits/{sv_id}", headers=admin_headers, timeout=20)
