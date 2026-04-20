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

from fastapi import APIRouter, HTTPException, Query
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

def _client_config():
    return {
        "web": {
            "client_id": os.environ["GOOGLE_CLIENT_ID"],
            "client_secret": os.environ["GOOGLE_CLIENT_SECRET"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [os.environ["GOOGLE_DRIVE_REDIRECT_URI"]],
        }
    }


def _make_flow(scopes=None):
    return Flow.from_client_config(
        _client_config(),
        scopes=scopes,
        redirect_uri=os.environ["GOOGLE_DRIVE_REDIRECT_URI"],
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
async def google_connect():
    """Returns an authorization URL the frontend opens in a new tab / redirect."""
    flow = _make_flow(scopes=SCOPES)
    auth_url, state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # required to always get refresh_token
    )
    # Persist PKCE code_verifier + state so the callback can complete the exchange.
    await _db.google_drive_config.update_one(
        {"_key": CONFIG_DOC_ID},
        {"$set": {
            "_key": CONFIG_DOC_ID,
            "pending_code_verifier": flow.code_verifier,
            "pending_state": state,
            "pending_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    return {"authorization_url": auth_url}


@router.get("/google/callback")
async def google_callback(code: str = Query(...), state: Optional[str] = Query(None), error: Optional[str] = Query(None)):
    """Google redirects here with ?code=... We exchange and store credentials, then redirect to frontend."""
    frontend = os.environ.get("FRONTEND_URL", "/")
    if error:
        return RedirectResponse(f"{frontend}/settings?drive=error&reason={error}")

    # Retrieve pending PKCE code_verifier saved in /connect
    pending = await _db.google_drive_config.find_one({"_key": CONFIG_DOC_ID}, {"_id": 0}) or {}
    code_verifier = pending.get("pending_code_verifier")

    flow = _make_flow(scopes=None)  # accept all granted scopes
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
        {
            "$set": {
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
            },
            "$unset": {"pending_code_verifier": "", "pending_state": "", "pending_at": ""},
        },
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
