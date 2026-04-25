"""
Google Drive auto-backup module for Creator Consultant.

Single-user app: stores one set of Drive credentials in MongoDB collection `google_drive_config`.
Exports a FastAPI router to be mounted under /api/backup.
"""
import os
import io
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Form, Request
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
from googleapiclient.errors import HttpError

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# OAuth scopes — drive.file limits access to files the app creates (safer for personal accounts)
SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]

CONFIG_DOC_ID = "singleton"  # single-user: one config doc

router = APIRouter(prefix="/backup", tags=["backup"])

# Injected at startup
_db = None
_scheduler: Optional[AsyncIOScheduler] = None


def init(db, collections_to_backup: list[str]):
    """Called from server.py at import time to inject the Mongo DB handle and list of collections."""
    global _db, _COLLECTIONS
    _db = db
    _COLLECTIONS = collections_to_backup


# ---------- OAuth helpers ----------

def _client_config(redirect_uri: Optional[str] = None):
    return {
        "web": {
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri or os.environ["GOOGLE_DRIVE_REDIRECT_URI"]],
        }
    }


def _resolve_origin(request) -> str:
    """Detect the origin (scheme://host) the user is currently using.

    Lets the OAuth flow follow whichever domain they actually opened the app on
    (e.g. preview URL or custom domain), so the redirect URI matches.
    """
    fwd_proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
    fwd_host = request.headers.get("x-forwarded-host") or request.headers.get("host") or ""
    if fwd_host:
        return f"{fwd_proto}://{fwd_host}"
    return os.environ.get("FRONTEND_URL", "")


def _redirect_uri_for(request) -> str:
    origin = _resolve_origin(request)
    return f"{origin}/api/backup/google/callback" if origin else os.environ["GOOGLE_DRIVE_REDIRECT_URI"]


def _make_flow(scopes=None, redirect_uri=None):
    redirect = redirect_uri or os.environ["GOOGLE_DRIVE_REDIRECT_URI"]
    return Flow.from_client_config(
        _client_config(redirect_uri=redirect),
        scopes=scopes,
        redirect_uri=redirect,
    )


async def _load_credentials() -> Optional[Credentials]:
    if _db is None:
        return None
    doc = await _db.google_drive_config.find_one({"_key": CONFIG_DOC_ID}, {"_id": 0})
    if not doc or not doc.get("refresh_token"):
        return None
    creds = Credentials(
        token=doc.get("access_token"),
        refresh_token=doc["refresh_token"],
        token_uri=doc["token_uri"],
        client_id=doc["client_id"],
        client_secret=doc["client_secret"],
        scopes=None,  # omit on refresh — Google reuses originally-granted scopes
    )
    # Force a fresh access token on every load (simpler for a 6-hour cron)
    try:
        creds.refresh(GoogleRequest())
    except Exception as e:
        logger.error(f"Token refresh failed: {e}")
        return None
    # Persist the refreshed token
    await _db.google_drive_config.update_one(
        {"_key": CONFIG_DOC_ID},
        {"$set": {
            "access_token": creds.token,
            "expiry": creds.expiry.isoformat() if creds.expiry else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return creds


async def _get_drive_service():
    creds = await _load_credentials()
    if creds is None:
        return None
    return build("drive", "v3", credentials=creds, cache_discovery=False)


async def _get_or_create_folder(service) -> str:
    folder_name = os.environ.get("BACKUP_FOLDER_NAME", "Creator Consultant Backups")
    # Search within Drive (trashed=false) for a folder created by this app
    q = (
        f"name = '{folder_name}' and "
        f"mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    )
    resp = service.files().list(q=q, fields="files(id, name)", pageSize=10).execute()
    files = resp.get("files", [])
    if files:
        return files[0]["id"]
    # Create folder
    meta = {"name": folder_name, "mimeType": "application/vnd.google-apps.folder"}
    created = service.files().create(body=meta, fields="id").execute()
    return created["id"]


# ---------- Backup data assembly ----------

def _sanitize(doc):
    """Remove Mongo _id and coerce datetimes to ISO strings."""
    if isinstance(doc, dict):
        return {k: _sanitize(v) for k, v in doc.items() if k != "_id"}
    if isinstance(doc, list):
        return [_sanitize(x) for x in doc]
    if isinstance(doc, datetime):
        return doc.isoformat()
    return doc


async def _build_backup_payload() -> dict:
    payload = {
        "app": "Creator Consultant",
        "backup_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "collections": {},
    }
    for col in _COLLECTIONS:
        docs = await _db[col].find({}, {"_id": 0}).to_list(length=None)
        payload["collections"][col] = _sanitize(docs)
        payload.setdefault("counts", {})[col] = len(docs)
    return payload


LOCAL_BACKUP_DIR = Path("/app/backend/backups")
LOCAL_BACKUP_DIR.mkdir(parents=True, exist_ok=True)


async def _perform_backup(trigger: str = "manual") -> dict:
    """Generate JSON, upload to Drive, enforce retention. Returns status dict."""
    started = datetime.now(timezone.utc)
    payload = await _build_backup_payload()
    data = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
    ts = started.strftime("%Y-%m-%dT%H-%M-%SZ")
    filename = f"creator-consultant-backup-{ts}.json"

    # 1. Save a local copy (kept on the server — also used for "Download Latest" fallback)
    local_path = LOCAL_BACKUP_DIR / filename
    local_path.write_bytes(data)
    # Enforce local retention (same as Drive)
    retention = int(os.environ.get("BACKUP_RETENTION_COUNT", "30"))
    local_files = sorted(LOCAL_BACKUP_DIR.glob("creator-consultant-backup-*.json"), reverse=True)
    for old in local_files[retention:]:
        try:
            old.unlink()
        except Exception:
            pass

    status = {
        "ok": True,
        "filename": filename,
        "size_bytes": len(data),
        "trigger": trigger,
        "started_at": started.isoformat(),
        "finished_at": None,
        "drive_uploaded": False,
        "drive_file_id": None,
        "drive_web_link": None,
        "error": None,
    }

    service = await _get_drive_service()
    if service is None:
        status["error"] = "Google Drive not connected — saved local copy only."
        status["finished_at"] = datetime.now(timezone.utc).isoformat()
        await _log_backup(status)
        return status

    try:
        folder_id = await _get_or_create_folder(service)
        media = MediaIoBaseUpload(io.BytesIO(data), mimetype="application/json", resumable=False)
        body = {"name": filename, "parents": [folder_id]}
        created = service.files().create(
            body=body, media_body=media, fields="id, name, size, webViewLink, createdTime"
        ).execute()
        status["drive_uploaded"] = True
        status["drive_file_id"] = created["id"]
        status["drive_web_link"] = created.get("webViewLink")

        # Enforce retention on Drive
        q = f"'{folder_id}' in parents and trashed = false and mimeType = 'application/json'"
        existing = service.files().list(
            q=q, fields="files(id, name, createdTime)", orderBy="createdTime desc", pageSize=200
        ).execute().get("files", [])
        for old in existing[retention:]:
            try:
                service.files().delete(fileId=old["id"]).execute()
            except Exception as e:
                logger.warning(f"Failed to delete old backup {old.get('name')}: {e}")
    except HttpError as e:
        logger.error(f"Drive upload failed: {e}")
        status["error"] = f"Drive upload failed: {e}"
    except Exception as e:
        logger.error(f"Backup error: {e}")
        status["error"] = f"Backup error: {e}"

    status["finished_at"] = datetime.now(timezone.utc).isoformat()
    await _log_backup(status)
    return status


async def _log_backup(status: dict):
    """Persist backup run to MongoDB for history view."""
    try:
        await _db.backup_log.insert_one({**status, "created_at": datetime.now(timezone.utc)})
    except Exception as e:
        logger.error(f"Failed to log backup: {e}")


# ---------- Scheduler ----------

async def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        return
    hours = int(os.environ.get("BACKUP_INTERVAL_HOURS", "6"))
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        _perform_backup,
        IntervalTrigger(hours=hours),
        kwargs={"trigger": "scheduled"},
        id="auto_backup",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logger.info(f"Backup scheduler started — every {hours} hours")


async def stop_scheduler():
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None


# ---------- HTTP API ----------

class SetupStatus(BaseModel):
    connected: bool
    email: Optional[str] = None
    last_backup_at: Optional[str] = None
    last_backup_ok: Optional[bool] = None
    next_run_at: Optional[str] = None
    interval_hours: int
    retention_count: int


@router.get("/status", response_model=SetupStatus)
async def backup_status():
    doc = await _db.google_drive_config.find_one({"_key": CONFIG_DOC_ID}, {"_id": 0})
    connected = bool(doc and doc.get("refresh_token"))
    email = doc.get("email") if doc else None
    last = await _db.backup_log.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    next_run = None
    if _scheduler is not None:
        job = _scheduler.get_job("auto_backup")
        if job and job.next_run_time:
            next_run = job.next_run_time.astimezone(timezone.utc).isoformat()
    return SetupStatus(
        connected=connected,
        email=email,
        last_backup_at=last.get("finished_at") if last else None,
        last_backup_ok=bool(last and last.get("ok") and last.get("drive_uploaded")) if last else None,
        next_run_at=next_run,
        interval_hours=int(os.environ.get("BACKUP_INTERVAL_HOURS", "6")),
        retention_count=int(os.environ.get("BACKUP_RETENTION_COUNT", "30")),
    )


@router.get("/google/connect")
async def google_connect(request: Request):
    """Returns an authorization URL the frontend opens in a new tab / redirect."""
    redirect_uri = _redirect_uri_for(request)
    flow = _make_flow(scopes=SCOPES, redirect_uri=redirect_uri)
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # required to always get refresh_token
    )
    # Store the PKCE verifier + redirect_uri so the callback can complete the exchange.
    await _db.oauth_pending.insert_one({
        "state": state,
        "code_verifier": flow.code_verifier,
        "redirect_uri": redirect_uri,
        "origin": _resolve_origin(request),
        "created_at": datetime.now(timezone.utc),
    })
    # Sweep old pending docs (>30 min)
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=30)
    await _db.oauth_pending.delete_many({"created_at": {"$lt": cutoff}})
    return {"authorization_url": auth_url}


@router.get("/google/callback")
async def google_callback(request: Request, code: str = Query(...), state: Optional[str] = Query(None), error: Optional[str] = Query(None)):
    """Google redirects here with ?code=... We exchange and store credentials, then redirect to frontend."""
    # Default frontend = the same domain the callback was hit on
    frontend = _resolve_origin(request) or os.environ.get("FRONTEND_URL", "/")
    if error:
        return RedirectResponse(f"{frontend}/settings?drive=error&reason={error}")

    # Retrieve PKCE code_verifier + matching redirect URI for THIS state
    code_verifier = None
    redirect_uri_used = _redirect_uri_for(request)
    if state:
        pending_doc = await _db.oauth_pending.find_one_and_delete({"state": state})
        if pending_doc:
            code_verifier = pending_doc.get("code_verifier")
            if pending_doc.get("redirect_uri"):
                redirect_uri_used = pending_doc["redirect_uri"]
            if pending_doc.get("origin"):
                frontend = pending_doc["origin"]

    flow = _make_flow(scopes=None, redirect_uri=redirect_uri_used)
    if code_verifier:
        flow.code_verifier = code_verifier
    try:
        flow.fetch_token(code=code)
    except Exception as e:
        logger.error(f"Token exchange failed: {e}")
        return RedirectResponse(f"{frontend}/settings?drive=error&reason=token_exchange")

    creds = flow.credentials

    # Fetch user email for display (best-effort)
    email = None
    try:
        from googleapiclient.discovery import build as _b
        oauth2 = _b("oauth2", "v2", credentials=creds, cache_discovery=False)
        info = oauth2.userinfo().get().execute()
        email = info.get("email")
    except Exception as e:
        logger.warning(f"Failed to fetch Google user email: {e}")

    await _db.google_drive_config.update_one(
        {"_key": CONFIG_DOC_ID},
        {"$set": {
            "_key": CONFIG_DOC_ID,
            "access_token": creds.token,
            "refresh_token": creds.refresh_token,
            "token_uri": creds.token_uri,
            "client_id": creds.client_id,
            "client_secret": creds.client_secret,
            "scopes": list(creds.scopes) if creds.scopes else SCOPES,
            "expiry": creds.expiry.isoformat() if creds.expiry else None,
            "email": email,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return RedirectResponse(f"{frontend}/settings?drive=connected")


@router.post("/google/disconnect")
async def google_disconnect():
    await _db.google_drive_config.delete_many({})
    return {"ok": True}


@router.post("/run")
async def run_backup_now():
    """Manual trigger — runs a backup immediately."""
    result = await _perform_backup(trigger="manual")
    if not result["ok"] and result.get("error"):
        # Still return 200 with details — frontend displays error
        pass
    return result


@router.get("/history")
async def backup_history(limit: int = 50):
    logs = await _db.backup_log.find({}, {"_id": 0}).sort("created_at", -1).to_list(length=limit)
    # ISO-string any datetimes
    out = []
    for log_row in logs:
        if isinstance(log_row.get("created_at"), datetime):
            log_row["created_at"] = log_row["created_at"].isoformat()
        out.append(log_row)
    return out


@router.get("/download-latest")
async def download_latest():
    """Stream the most recent local backup file to the browser."""
    files = sorted(LOCAL_BACKUP_DIR.glob("creator-consultant-backup-*.json"), reverse=True)
    if not files:
        # On-demand: generate a fresh backup if none exist yet
        await _perform_backup(trigger="download")
        files = sorted(LOCAL_BACKUP_DIR.glob("creator-consultant-backup-*.json"), reverse=True)
        if not files:
            raise HTTPException(status_code=404, detail="No backup available")
    latest = files[0]
    data = latest.read_bytes()
    return Response(
        content=data,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{latest.name}"'},
    )


# ------------------------ RESTORE (merge, add-missing) ------------------------

# Keys used to decide whether a document already exists.
# Every collection is keyed by "id" except `counters` which uses "_id".
RESTORE_KEYS = {
    "projects": "id",
    "clients": "id",
    "architects": "id",
    "payments": "id",
    "audits": "id",
    "audit_payments": "id",
    "offers": "id",
    "activity_log": "id",
    "quote_revisions": "id",
    "counters": "_id",
}


async def _preview_payload(payload: dict) -> dict:
    """Return counts of how many records would be added vs already exist, per collection."""
    collections = payload.get("collections") or {}
    preview = {"total_would_add": 0, "total_already_exists": 0, "per_collection": {}}
    for col, docs in collections.items():
        if col not in RESTORE_KEYS or not isinstance(docs, list):
            continue
        key = RESTORE_KEYS[col]
        would_add = 0
        existing = 0
        for d in docs:
            kval = d.get(key)
            if kval is None:
                continue
            # In the counters collection the key field is `_id` (Mongo's natural key)
            query = {key: kval}
            found = await _db[col].find_one(query, {"_id": 1})
            if found:
                existing += 1
            else:
                would_add += 1
        preview["per_collection"][col] = {
            "in_backup": len(docs),
            "would_add": would_add,
            "already_exists": existing,
        }
        preview["total_would_add"] += would_add
        preview["total_already_exists"] += existing
    preview["generated_at"] = payload.get("generated_at")
    preview["app"] = payload.get("app")
    return preview


async def _merge_restore(payload: dict) -> dict:
    """Apply merge-restore: only insert documents whose key does not already exist."""
    collections = payload.get("collections") or {}
    result = {"added": {}, "skipped": {}, "errors": []}
    for col, docs in collections.items():
        if col not in RESTORE_KEYS or not isinstance(docs, list):
            continue
        key = RESTORE_KEYS[col]
        added = 0
        skipped = 0
        for d in docs:
            kval = d.get(key)
            if kval is None:
                skipped += 1
                continue
            exists = await _db[col].find_one({key: kval}, {"_id": 1})
            if exists:
                skipped += 1
                continue
            try:
                # Ensure no Mongo _id slips in from exported dump (it was excluded but be safe)
                d2 = {k: v for k, v in d.items() if k != "_id" or col == "counters"}
                await _db[col].insert_one(d2)
                added += 1
            except Exception as e:
                result["errors"].append(f"{col}: {e}")
        result["added"][col] = added
        result["skipped"][col] = skipped
    return result


@router.post("/restore/preview")
async def restore_preview(file: UploadFile = File(...)):
    """Parse an uploaded JSON backup and return what would be added on merge-restore."""
    if not file.filename.lower().endswith(".json"):
        raise HTTPException(400, "Please upload a .json backup file")
    raw = await file.read()
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception as e:
        raise HTTPException(400, f"Invalid JSON: {e}")
    if not isinstance(payload, dict) or "collections" not in payload:
        raise HTTPException(400, "Not a valid Creator Consultant backup (missing 'collections')")
    return await _preview_payload(payload)


@router.post("/restore")
async def restore_backup(
    file: UploadFile = File(...),
    confirm: str = Form(...),
):
    """Merge-restore from an uploaded JSON backup.

    Requires `confirm == 'RESTORE'` (case-insensitive) to guard against accidental calls.
    """
    if (confirm or "").strip().upper() != "RESTORE":
        raise HTTPException(400, "Confirmation missing or incorrect. Type RESTORE to confirm.")
    if not file.filename.lower().endswith(".json"):
        raise HTTPException(400, "Please upload a .json backup file")
    raw = await file.read()
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception as e:
        raise HTTPException(400, f"Invalid JSON: {e}")
    if not isinstance(payload, dict) or "collections" not in payload:
        raise HTTPException(400, "Not a valid Creator Consultant backup (missing 'collections')")

    # Safety snapshot — save a local copy of the current DB right before restore
    try:
        await _perform_backup(trigger="pre-restore")
    except Exception as e:
        logger.warning(f"Pre-restore safety snapshot failed: {e}")

    result = await _merge_restore(payload)
    total_added = sum(result.get("added", {}).values())
    total_skipped = sum(result.get("skipped", {}).values())
    logger.info(f"Restore done: added={total_added}, skipped={total_skipped}, errors={len(result.get('errors', []))}")
    return {
        "ok": True,
        "source": "upload",
        "filename": file.filename,
        "backup_generated_at": payload.get("generated_at"),
        "total_added": total_added,
        "total_skipped": total_skipped,
        "added_per_collection": result["added"],
        "skipped_per_collection": result["skipped"],
        "errors": result["errors"],
    }


@router.get("/drive/backups")
async def list_drive_backups():
    """List backup JSON files in the user's Drive 'Creator Consultant Backups' folder."""
    service = await _get_drive_service()
    if service is None:
        raise HTTPException(400, "Google Drive is not connected")
    try:
        folder_id = await _get_or_create_folder(service)
        q = f"'{folder_id}' in parents and trashed = false and mimeType = 'application/json'"
        resp = service.files().list(
            q=q,
            fields="files(id, name, size, createdTime, webViewLink)",
            orderBy="createdTime desc",
            pageSize=200,
        ).execute()
        files = resp.get("files", [])
        return [
            {
                "id": f.get("id"),
                "name": f.get("name"),
                "size": int(f.get("size") or 0),
                "created_time": f.get("createdTime"),
                "web_view_link": f.get("webViewLink"),
            }
            for f in files
        ]
    except HttpError as e:
        logger.error(f"Drive list failed: {e}")
        raise HTTPException(500, f"Drive list failed: {e}")


async def _download_drive_file_content(service, file_id: str) -> bytes:
    """Download a Drive file's raw bytes."""
    from googleapiclient.http import MediaIoBaseDownload  # noqa: F811
    req = service.files().get_media(fileId=file_id)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, req)
    done = False
    while not done:
        _status, done = downloader.next_chunk()
    return buf.getvalue()


class DriveRestoreBody(BaseModel):
    file_id: str
    confirm: str


@router.post("/restore/drive")
async def restore_from_drive(body: DriveRestoreBody):
    """Merge-restore from a Drive backup file. Requires confirm == 'RESTORE'."""
    if (body.confirm or "").strip().upper() != "RESTORE":
        raise HTTPException(400, "Confirmation missing or incorrect. Type RESTORE to confirm.")
    service = await _get_drive_service()
    if service is None:
        raise HTTPException(400, "Google Drive is not connected")
    try:
        raw = await _download_drive_file_content(service, body.file_id)
    except HttpError as e:
        raise HTTPException(500, f"Failed to download Drive file: {e}")
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception as e:
        raise HTTPException(400, f"Selected file is not valid JSON: {e}")
    if not isinstance(payload, dict) or "collections" not in payload:
        raise HTTPException(400, "Not a valid Creator Consultant backup (missing 'collections')")

    # Safety snapshot
    try:
        await _perform_backup(trigger="pre-restore")
    except Exception as e:
        logger.warning(f"Pre-restore safety snapshot failed: {e}")

    # Fetch file name from Drive for the response
    try:
        meta = service.files().get(fileId=body.file_id, fields="id, name").execute()
        fname = meta.get("name")
    except Exception:
        fname = body.file_id

    result = await _merge_restore(payload)
    total_added = sum(result.get("added", {}).values())
    total_skipped = sum(result.get("skipped", {}).values())
    return {
        "ok": True,
        "source": "drive",
        "filename": fname,
        "backup_generated_at": payload.get("generated_at"),
        "total_added": total_added,
        "total_skipped": total_skipped,
        "added_per_collection": result["added"],
        "skipped_per_collection": result["skipped"],
        "errors": result["errors"],
    }

