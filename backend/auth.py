"""
Custom username + password JWT authentication for Creator Consultant.

- Single admin (seeded from .env) plus admin-created staff users.
- Login by username + password. Returns JWT (HS256, 24h).
- Frontend stores JWT in localStorage and sends as Authorization: Bearer <token>.
"""
import os
import logging
from contextvars import ContextVar
from datetime import datetime, timezone, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

JWT_ALGORITHM = "HS256"

# Per-request current user — set by get_current_user, read by other modules
# (e.g. server.py's activity logger) without having to thread it through args.
current_user_var: ContextVar[Optional[dict]] = ContextVar("current_user", default=None)


def get_current_user_safe() -> Optional[dict]:
    """Return the current request's user dict if any (None for anonymous calls)."""
    try:
        u = current_user_var.get()
    except LookupError:
        return None
    if u and u.get("id") and u["id"] != "anonymous":
        return u
    return None


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    import uuid
    return str(uuid.uuid4())


def _hash_password(password: str) -> str:
    # bcrypt has a 72-byte limit on the password input. Truncate to be safe.
    pw_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
    except Exception:
        return False


def _create_token(user_id: str, username: str, role: str) -> str:
    hours = int(os.environ.get("JWT_TOKEN_HOURS", "24"))
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "iat": int(_now().timestamp()),
        "exp": _now() + timedelta(hours=hours),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict:
    return jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])


# ---------- Database hookup ----------
_db = None


def init(db):
    global _db
    _db = db


# ---------- Models ----------
class LoginIn(BaseModel):
    username: str
    password: str


class UserPublic(BaseModel):
    id: str
    username: str
    name: str = ""
    role: str = "staff"
    color: str = "#0F3D2A"
    default_signature: Optional[str] = None
    created_at: Optional[str] = None
    last_login_at: Optional[str] = None


class UserCreateIn(BaseModel):
    username: str = Field(..., min_length=2, max_length=40)
    password: str = Field(..., min_length=4, max_length=128)
    name: Optional[str] = ""
    role: str = "staff"  # admin | staff
    color: Optional[str] = None


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=4, max_length=128)


class ChangeUsernameIn(BaseModel):
    new_username: str = Field(..., min_length=2, max_length=40)


class DefaultSignatureIn(BaseModel):
    signature: Optional[str] = None  # base64 data-URL, or None/empty to clear


# ---------- Dependencies ----------
# Paths that are allowed without a JWT even though they're mounted on the
# protected api_router (e.g. Google's OAuth callback — Google redirects the
# user's browser to it with no Authorization header).
_PUBLIC_PATHS = {
    "/api/backup/google/callback",
}


async def get_current_user(request: Request) -> dict:
    if request.url.path in _PUBLIC_PATHS:
        # Synthetic anonymous user — endpoint can ignore this
        u = {"id": "anonymous", "username": "anonymous", "role": "anonymous"}
        current_user_var.set(u)
        return u
    auth = request.headers.get("Authorization") or ""
    token = auth[7:] if auth.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = _decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired — please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await _db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    # Account role has near-admin access — only the Site Visits module is
    # blocked. All other GET/POST/PUT/DELETE are allowed.
    if user.get("role") == "account" and request.url.path.startswith("/api/site-visits"):
        raise HTTPException(status_code=403, detail="Site Visits module is not available for your role")
    current_user_var.set(user)
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# Default color palette for auto-assignment
_USER_COLORS = ["#0F3D2A", "#0E7490", "#7C3AED", "#D97706", "#BE185D", "#1D4ED8", "#15803D", "#92400E", "#0891B2", "#A21CAF"]


def _color_for_username(username: str) -> str:
    """Deterministic color from username so the same user always gets the same color."""
    if not username:
        return _USER_COLORS[0]
    h = sum(ord(c) for c in username)
    return _USER_COLORS[h % len(_USER_COLORS)]


# ---------- Seed ----------
async def seed_admin():
    """Create or update the admin user from .env on every startup. Idempotent."""
    if _db is None:
        return
    username = os.environ.get("ADMIN_USERNAME", "").strip().lower()
    password = os.environ.get("ADMIN_PASSWORD", "")
    if not username or not password:
        logger.warning("ADMIN_USERNAME / ADMIN_PASSWORD not set — skipping admin seed")
        return
    try:
        await _db.users.create_index("username", unique=True)
    except Exception as e:
        logger.warning(f"users index create failed: {e}")
    existing = await _db.users.find_one({"username": username})
    if existing is None:
        # Make sure there's at least one admin
        await _db.users.insert_one({
            "id": _new_id(),
            "username": username,
            "password_hash": _hash_password(password),
            "name": "Owner",
            "role": "admin",
            "color": _color_for_username(username),
            "created_at": _now().isoformat(),
            "last_login_at": None,
        })
        logger.info(f"Seeded admin user: {username}")
    elif not existing.get("color"):
        # Backfill color for users created before this update
        await _db.users.update_one(
            {"id": existing["id"]},
            {"$set": {"color": _color_for_username(existing["username"])}},
        )
    # Don't auto-update password if admin already exists — they may have changed it themselves


# Backfill colors for any user missing one (idempotent — runs once at startup)
async def backfill_user_colors():
    if _db is None:
        return
    async for u in _db.users.find({"$or": [{"color": {"$exists": False}}, {"color": None}, {"color": ""}]}, {"id": 1, "username": 1}):
        await _db.users.update_one(
            {"id": u["id"]},
            {"$set": {"color": _color_for_username(u.get("username", ""))}},
        )


# ---------- Router ----------
router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(data: LoginIn, request: Request):
    username = (data.username or "").strip().lower()
    user = await _db.users.find_one({"username": username})
    if not user or not _verify_password(data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    await _db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login_at": _now().isoformat()}},
    )
    token = _create_token(user["id"], user["username"], user.get("role", "staff"))
    return {
        "token": token,
        "expires_in_hours": int(os.environ.get("JWT_TOKEN_HOURS", "24")),
        "user": {
            "id": user["id"],
            "username": user["username"],
            "name": user.get("name", ""),
            "role": user.get("role", "staff"),
        },
    }


@router.get("/me", response_model=UserPublic)
async def me(user: dict = Depends(get_current_user)):
    return UserPublic(**user)


@router.post("/change-password")
async def change_password(body: ChangePasswordIn, user: dict = Depends(get_current_user)):
    db_user = await _db.users.find_one({"id": user["id"]})
    if not db_user or not _verify_password(body.current_password, db_user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    await _db.users.update_one(
        {"id": user["id"]},
        {"$set": {"password_hash": _hash_password(body.new_password)}},
    )
    return {"ok": True}


@router.post("/change-username")
async def change_username(body: ChangeUsernameIn, user: dict = Depends(get_current_user)):
    new_u = (body.new_username or "").strip().lower()
    if not new_u:
        raise HTTPException(status_code=400, detail="Username is required")
    if new_u == user["username"]:
        return {"ok": True, "username": new_u}
    if await _db.users.find_one({"username": new_u, "id": {"$ne": user["id"]}}):
        raise HTTPException(status_code=400, detail="That username is already taken")
    await _db.users.update_one({"id": user["id"]}, {"$set": {"username": new_u}})
    return {"ok": True, "username": new_u}


@router.put("/me/signature")
async def set_default_signature(body: DefaultSignatureIn, user: dict = Depends(get_current_user)):
    """Save (or clear) the current user's pre-fitted default signature.

    The signature is stored as a base64 PNG data-URL. Site Visit forms read this
    via /auth/me and pre-fill the engineer signature pad on new visits.
    """
    sig = (body.signature or "").strip()
    if sig and not sig.startswith("data:image/"):
        raise HTTPException(400, "Signature must be a base64 data-URL (data:image/...).")
    if len(sig) > 400_000:
        raise HTTPException(400, "Signature image is too large (max ~300KB).")
    await _db.users.update_one(
        {"id": user["id"]},
        {"$set": {"default_signature": sig or None}},
    )
    return {"ok": True, "has_signature": bool(sig)}


@router.get("/users/directory")
async def users_directory(_: dict = Depends(get_current_user)):
    """Lightweight list of all users (id, username, name, color) — used for showing
    who edited what. Available to any logged-in user (not just admin)."""
    items = await _db.users.find({}, {"_id": 0, "id": 1, "username": 1, "name": 1, "color": 1, "role": 1}).to_list(500)
    return items


@router.get("/users")
async def list_users(_: dict = Depends(require_admin)):
    items = await _db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", 1).to_list(500)
    return items


@router.post("/users")
async def create_user(body: UserCreateIn, _: dict = Depends(require_admin)):
    username = body.username.strip().lower()
    if await _db.users.find_one({"username": username}):
        raise HTTPException(status_code=400, detail="Username already exists")
    if body.role not in ("admin", "staff", "engineer", "account"):
        raise HTTPException(status_code=400, detail="Role must be 'admin', 'staff', 'engineer' or 'account'")
    doc = {
        "id": _new_id(),
        "username": username,
        "password_hash": _hash_password(body.password),
        "name": body.name or "",
        "role": body.role,
        "color": body.color or _color_for_username(username),
        "created_at": _now().isoformat(),
        "last_login_at": None,
    }
    await _db.users.insert_one(doc.copy())
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return doc


class UserUpdateIn(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None  # admin can reset
    color: Optional[str] = None


@router.put("/users/{user_id}")
async def update_user(user_id: str, body: UserUpdateIn, current: dict = Depends(require_admin)):
    target = await _db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    update = {}
    if body.name is not None:
        update["name"] = body.name
    if body.role is not None:
        if body.role not in ("admin", "staff", "engineer", "account"):
            raise HTTPException(400, "Role must be 'admin', 'staff', 'engineer' or 'account'")
        # Prevent demoting the only remaining admin
        if target.get("role") == "admin" and body.role != "admin":
            admin_count = await _db.users.count_documents({"role": "admin"})
            if admin_count <= 1:
                raise HTTPException(400, "Cannot demote the only remaining admin")
        update["role"] = body.role
    if body.password:
        update["password_hash"] = _hash_password(body.password)
    if body.color is not None and body.color.strip():
        update["color"] = body.color.strip()
    if update:
        await _db.users.update_one({"id": user_id}, {"$set": update})
    return {"ok": True}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current: dict = Depends(require_admin)):
    target = await _db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(404, "User not found")
    if target["id"] == current["id"]:
        raise HTTPException(400, "You cannot delete your own account")
    if target.get("role") == "admin":
        admin_count = await _db.users.count_documents({"role": "admin"})
        if admin_count <= 1:
            raise HTTPException(400, "Cannot delete the only remaining admin")
    await _db.users.delete_one({"id": user_id})
    return {"ok": True}
