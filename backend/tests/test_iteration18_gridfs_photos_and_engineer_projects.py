"""Iteration 18 — production hotfix tests.

Covers:
1. Engineer can list ALL non-archived projects (engineer-scope filter removed).
2. POST /api/site-visits/uploads persists bytes in GridFS bucket `site_visit_photos`.
3. GET /api/uploads/site-visits/<fn> serves from GridFS (no auth) + disk fallback.
4. DELETE /api/site-visits/uploads/<fn> wipes both disk + GridFS.
5. GET /api/site-visits/<vid>/pdf embeds GridFS-only photos.
6. GET /api/site-visits/public/<token>/pdf same, unauth.
"""
import base64
import io
import os
import time
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://beginner-coder-hub-2.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

ADMIN = {"username": "rutvij0213", "password": "Rutvij4141*"}
ENG = {"username": "test_engineer", "password": "EngTest123!"}

# Tiny 1x1 PNG bytes
TINY_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
TINY_PNG = base64.b64decode(TINY_PNG_B64)


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def eng_token():
    return _login(ENG)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def eng_headers(eng_token):
    return {"Authorization": f"Bearer {eng_token}"}


# ------------------------------------------------------------------ projects
class TestEngineerProjectsList:
    def test_engineer_sees_all_projects(self, admin_headers, eng_headers):
        admin_r = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers, timeout=20)
        eng_r = requests.get(f"{BASE_URL}/api/projects", headers=eng_headers, timeout=20)
        assert admin_r.status_code == 200, admin_r.text
        assert eng_r.status_code == 200, eng_r.text
        admin_ids = {p["id"] for p in admin_r.json()}
        eng_ids = {p["id"] for p in eng_r.json()}
        assert admin_ids == eng_ids, f"Engineer missing {admin_ids - eng_ids}; extra {eng_ids - admin_ids}"
        assert len(eng_ids) > 0, "Engineer got an empty project list"


# ------------------------------------------------------------------ uploads
class TestSiteVisitPhotoUploadGridFS:
    def _upload(self, headers):
        files = {"file": ("test_iter18.png", TINY_PNG, "image/png")}
        r = requests.post(f"{BASE_URL}/api/site-visits/uploads", files=files, headers=headers, timeout=30)
        assert r.status_code == 200, f"Upload failed: {r.status_code} {r.text}"
        body = r.json()
        assert "url" in body and "filename" in body
        assert body["url"] == f"/api/uploads/site-visits/{body['filename']}"
        return body

    def test_engineer_upload_returns_gridfs_url(self, eng_headers):
        body = self._upload(eng_headers)
        # Bytes should be retrievable
        r = requests.get(f"{BASE_URL}{body['url']}", timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("image/")
        assert r.content == TINY_PNG, "Served bytes do not match uploaded bytes"
        # Cleanup
        requests.delete(f"{BASE_URL}/api/site-visits/uploads/{body['filename']}", headers=eng_headers, timeout=20)

    @pytest.mark.asyncio
    async def test_upload_persists_in_gridfs_collection(self, eng_headers):
        body = self._upload(eng_headers)
        # Verify the file lives in the `site_visit_photos.files` collection
        client = AsyncIOMotorClient(MONGO_URL)
        try:
            db = client[DB_NAME]
            bucket = AsyncIOMotorGridFSBucket(db, bucket_name="site_visit_photos")
            found = None
            async for doc in bucket.find({"filename": body["filename"]}):
                found = doc
                break
            assert found is not None, f"GridFS doc for {body['filename']} not found in {DB_NAME}.site_visit_photos.files"
            # Read back stream
            stream = await bucket.open_download_stream_by_name(body["filename"])
            data = await stream.read()
            stream.close()
            assert data == TINY_PNG
        finally:
            client.close()
            requests.delete(f"{BASE_URL}/api/site-visits/uploads/{body['filename']}", headers=eng_headers, timeout=20)

    def test_serve_endpoint_no_auth_required(self, eng_headers):
        body = self._upload(eng_headers)
        # No Authorization header
        r = requests.get(f"{BASE_URL}{body['url']}", timeout=30)
        assert r.status_code == 200, f"Serve endpoint should not require auth: {r.status_code}"
        assert r.content == TINY_PNG
        requests.delete(f"{BASE_URL}/api/site-visits/uploads/{body['filename']}", headers=eng_headers, timeout=20)

    def test_serve_endpoint_404_for_missing(self):
        r = requests.get(f"{BASE_URL}/api/uploads/site-visits/does_not_exist_iter18.png", timeout=20)
        assert r.status_code == 404

    def test_delete_removes_disk_and_gridfs(self, eng_headers):
        body = self._upload(eng_headers)
        # Confirm exists
        r = requests.get(f"{BASE_URL}{body['url']}", timeout=20)
        assert r.status_code == 200
        # Delete
        d = requests.delete(f"{BASE_URL}/api/site-visits/uploads/{body['filename']}", headers=eng_headers, timeout=20)
        assert d.status_code == 200
        assert d.json().get("ok") is True
        # Should be gone
        r2 = requests.get(f"{BASE_URL}{body['url']}", timeout=20)
        assert r2.status_code == 404


# ------------------------------------------------------------------ pdf
class TestSiteVisitPdfEmbedsGridFSPhotos:
    @pytest.fixture(scope="class")
    def visit_with_gridfs_photo(self, eng_headers, admin_headers):
        # Upload via API → GridFS
        files = {"file": ("iter18_pdf.png", TINY_PNG, "image/png")}
        u = requests.post(f"{BASE_URL}/api/site-visits/uploads", files=files, headers=eng_headers, timeout=30)
        assert u.status_code == 200, u.text
        upl = u.json()
        # Need a project_id — use first available
        pr = requests.get(f"{BASE_URL}/api/projects", headers=admin_headers, timeout=20)
        proj_id = (pr.json() or [{}])[0].get("id")
        # Create visit with one photo (only url, no data_url)
        payload = {
            "site_name": "TEST_iter18_GridFS_PDF",
            "site_address": "Test Address",
            "inspection_title": "Iter18 GridFS PDF Test",
            "visit_date": "2026-01-15",
            "observations": ["iter18 gridfs pdf test"],
            "photos": [{"url": upl["url"], "caption": "g"}],
        }
        if proj_id:
            payload["project_id"] = proj_id
        r = requests.post(f"{BASE_URL}/api/site-visits", json=payload, headers=eng_headers, timeout=30)
        assert r.status_code in (200, 201), f"Create visit failed: {r.status_code} {r.text}"
        v = r.json()
        yield v, upl
        # Cleanup
        try:
            requests.delete(f"{BASE_URL}/api/site-visits/{v['id']}", headers=admin_headers, timeout=20)
        except Exception:
            pass
        try:
            requests.delete(f"{BASE_URL}/api/site-visits/uploads/{upl['filename']}", headers=admin_headers, timeout=20)
        except Exception:
            pass

    def test_authed_pdf_embeds_gridfs_photo(self, admin_headers, visit_with_gridfs_photo):
        v, _ = visit_with_gridfs_photo
        r = requests.get(f"{BASE_URL}/api/site-visits/{v['id']}/pdf", headers=admin_headers, timeout=60)
        assert r.status_code == 200, r.text
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF", "PDF header missing"
        assert len(r.content) > 2048, f"PDF too small to contain image: {len(r.content)} bytes"

    def test_public_pdf_embeds_gridfs_photo(self, admin_headers, visit_with_gridfs_photo):
        v, _ = visit_with_gridfs_photo
        # public_token is auto-set on visit creation
        token = v.get("public_token")
        if not token:
            g = requests.get(f"{BASE_URL}/api/site-visits/{v['id']}", headers=admin_headers, timeout=20)
            token = g.json().get("public_token")
        assert token, "Visit has no public_token"
        r = requests.get(f"{BASE_URL}/api/site-visits/public/{token}/pdf", timeout=60)
        assert r.status_code == 200, r.text
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 2048


# ------------------------------------------------------------------ supervisor-restart survival
class TestPersistenceAcrossBackendRestart:
    """Verify GridFS-stored photos survive a backend supervisor restart."""

    def test_photo_survives_backend_restart(self, eng_headers):
        files = {"file": ("iter18_restart.png", TINY_PNG, "image/png")}
        u = requests.post(f"{BASE_URL}/api/site-visits/uploads", files=files, headers=eng_headers, timeout=30)
        assert u.status_code == 200
        body = u.json()
        # Restart backend
        rc = os.system("sudo supervisorctl restart backend > /dev/null 2>&1")
        assert rc == 0
        # Wait for backend to come back
        for _ in range(30):
            time.sleep(1)
            try:
                p = requests.get(f"{BASE_URL}/api/auth/login", timeout=5)
                if p.status_code in (200, 405, 422):
                    break
            except Exception:
                continue
        # Fetch the photo — bytes must still be there
        r = requests.get(f"{BASE_URL}{body['url']}", timeout=30)
        assert r.status_code == 200, f"Photo lost after restart: {r.status_code}"
        assert r.content == TINY_PNG
        requests.delete(f"{BASE_URL}/api/site-visits/uploads/{body['filename']}", headers=eng_headers, timeout=20)
