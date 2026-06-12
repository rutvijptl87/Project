from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Depends, Form, Body
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
import copy
import pypdf
import os
import io
import base64
import logging
import bcrypt
import secrets
import shutil
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, date, timedelta
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph, Frame, KeepInFrame, Table, TableStyle
from auth import get_current_user_safe

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Creator Consultant API")

# Auth: /api/auth/* — public (login) + JWT-protected (others)
import auth as auth_module  # noqa: E402
auth_module.init(db)
auth_public_router = APIRouter(prefix="/api")
auth_public_router.include_router(auth_module.router)

# Main API router — every endpoint here requires a valid JWT
api_router = APIRouter(prefix="/api", dependencies=[Depends(auth_module.get_current_user)])


# ---------------------- MODELS ----------------------
class ClientIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    company: Optional[str] = ""
    address: Optional[str] = ""


class Client(ClientIn):
    model_config = ConfigDict(extra="ignore")
    id: str
    last_edited_by_user_id: Optional[str] = None
    last_edited_by_username: Optional[str] = ""
    last_edited_at: Optional[str] = ""
    created_at: str


class ArchitectIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    firm: Optional[str] = ""


class Architect(ArchitectIn):
    model_config = ConfigDict(extra="ignore")
    id: str
    last_edited_by_user_id: Optional[str] = None
    last_edited_by_username: Optional[str] = ""
    last_edited_at: Optional[str] = ""
    created_at: str


class ProjectIn(BaseModel):
    name: str
    job_no: Optional[str] = ""
    client_id: Optional[str] = None
    architect_id: Optional[str] = None
    site_location: Optional[str] = ""
    quoted_amount: float = 0.0
    status: Optional[str] = "Outstanding"  # Outstanding / Settled
    notes: Optional[str] = ""
    assigned_engineer_ids: List[str] = []


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_code: str  # e.g. CC-0001
    job_no: str = ""
    name: str
    client_id: Optional[str] = None
    client_name: Optional[str] = ""
    client_phone: Optional[str] = ""
    client_email: Optional[str] = ""
    architect_id: Optional[str] = None
    architect_name: Optional[str] = ""
    architect_phone: Optional[str] = ""
    architect_email: Optional[str] = ""
    site_location: str = ""
    quoted_amount: Optional[float] = 0.0
    received_amount: Optional[float] = 0.0
    outstanding_amount: Optional[float] = 0.0
    status: str = "Outstanding"
    notes: str = ""
    archived: bool = False
    assigned_engineer_ids: List[str] = []
    # Offer linkage (optional — filled when a project is created from an offer)
    offer_id: Optional[str] = None
    offer_code: Optional[str] = ""
    offer_type: Optional[str] = ""
    offer_file_path: Optional[str] = ""
    # Edit tracking
    last_edited_by_user_id: Optional[str] = None
    last_edited_by_username: Optional[str] = ""
    last_edited_at: Optional[str] = ""
    created_at: str


class OfferIn(BaseModel):
    offer_type: str  # RCC / Steel / Audit / Other
    custom_type: Optional[str] = ""  # when offer_type == "Other"
    client_id: Optional[str] = None
    description: Optional[str] = ""
    site_location: Optional[str] = ""
    base_amount: float = 0.0  # pre-GST
    gst_percent: float = 18.0
    file_path: Optional[str] = ""  # path on user's PC, e.g. D:\Offers\2026\audit.pdf
    status: Optional[str] = "Pending"  # Pending / Accepted / Rejected
    offer_date: Optional[str] = None  # ISO
    notes: Optional[str] = ""
    reference_no: Optional[str] = ""  # like STR/AUDIT/2026/023
    # Editable PDF content — all optional; defaults used when blank
    subject: Optional[str] = ""  # overrides auto-generated SUBJECT line
    scope_of_work: Optional[str] = ""  # multiline scope block (overrides description for PDF)
    payment_schedule: Optional[List[dict]] = None  # [{label, percent}] — if empty, 50/50 default
    terms_conditions: Optional[List[str]] = None  # list of T&C bullets — if empty, defaults
    bank_details: Optional[str] = ""  # overrides default bank line
    signature_name: Optional[str] = ""  # overrides "Mr. Rutvij Patel..."
    company_header: Optional[str] = ""  # overrides "CREATOR RCC CONSULTANT LLP"
    company_tagline: Optional[str] = ""
    company_address: Optional[str] = ""
    intro_paragraph: Optional[str] = ""  # overrides default intro


class Offer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    offer_code: str  # OFR-0001
    offer_type: str
    custom_type: str = ""
    effective_type: str = ""  # convenience: the type to display (custom_type if type == Other else offer_type)
    client_id: Optional[str] = None
    client_name: Optional[str] = ""
    client_phone: Optional[str] = ""
    client_email: Optional[str] = ""
    description: str = ""
    site_location: str = ""
    base_amount: float = 0.0
    gst_percent: float = 18.0
    gst_amount: float = 0.0
    total_amount: float = 0.0
    file_path: str = ""
    status: str = "Pending"
    offer_date: str = ""
    reference_no: str = ""
    notes: str = ""
    # Editable PDF content
    subject: str = ""
    scope_of_work: str = ""
    payment_schedule: List[dict] = Field(default_factory=list)
    terms_conditions: List[str] = Field(default_factory=list)
    bank_details: str = ""
    signature_name: str = ""
    company_header: str = ""
    company_tagline: str = ""
    company_address: str = ""
    intro_paragraph: str = ""
    linked_project_id: Optional[str] = None
    linked_project_code: Optional[str] = ""
    created_at: str


class PaymentIn(BaseModel):
    project_id: str
    amount: float
    payment_date: Optional[str] = None  # ISO string
    notes: Optional[str] = ""


class Payment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_id: str
    project_code: str
    amount: float
    payment_date: str
    notes: str = ""
    last_edited_by_user_id: Optional[str] = None
    last_edited_by_username: Optional[str] = ""
    last_edited_at: Optional[str] = ""
    created_at: str



# ---------------------- SITE VISIT (Engineer) MODELS ----------------------

class SiteVisitTemplateIn(BaseModel):
    name: str
    description: Optional[str] = ""
    checklist: List[str] = []  # e.g. ["Size of members as per drawing", "Reinforcement - Dia, No of bars", ...]


class SiteVisitTemplate(SiteVisitTemplateIn):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str


class ChecklistItem(BaseModel):
    label: str
    compliance: str = "yes"  # yes | no | na
    remark: Optional[str] = ""


class SiteVisitPhoto(BaseModel):
    data_url: Optional[str] = ""  # base64 image (legacy / inline use)
    url: Optional[str] = ""  # /api/uploads/site-visits/<filename> (preferred)
    caption: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geo_accuracy: Optional[float] = None
    captured_at: Optional[str] = ""  # ISO timestamp from the engineer's device


class SiteVisitIn(BaseModel):
    template_id: Optional[str] = None
    template_name: Optional[str] = ""
    job_no: Optional[str] = ""
    project_id: Optional[str] = None
    inspection_title: str
    visit_date: Optional[str] = None  # ISO date
    customer: Optional[str] = ""
    plot_no: Optional[str] = ""           # kept for backward-compat with older visits
    site_location: Optional[str] = ""     # NEW — auto-filled from linked project
    drg_no: Optional[str] = ""
    revision: Optional[str] = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geo_accuracy: Optional[float] = None
    checklist: List[ChecklistItem] = []
    observations: List[str] = []
    photos: List[SiteVisitPhoto] = []
    engineer_name: Optional[str] = ""
    engineer_signature: Optional[str] = ""  # base64 data URL of signature pad
    site_person_name: Optional[str] = ""
    site_person_phone: Optional[str] = ""
    site_person_signature: Optional[str] = ""
    status: str = "submitted"  # draft | submitted


class SiteVisit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    visit_code: str  # SV-0001
    template_id: Optional[str] = None
    template_name: str = ""
    job_no: str = ""
    project_id: Optional[str] = None
    project_code: Optional[str] = ""
    project_name: Optional[str] = ""
    inspection_title: str = ""
    visit_date: Optional[str] = None
    customer: str = ""
    plot_no: str = ""
    site_location: str = ""
    drg_no: str = ""
    revision: str = ""
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geo_accuracy: Optional[float] = None
    checklist: List[ChecklistItem] = []
    observations: List[str] = []
    photos: List[SiteVisitPhoto] = []
    engineer_name: str = ""
    engineer_signature: str = ""
    site_person_name: str = ""
    site_person_phone: str = ""
    site_person_signature: str = ""
    status: str = "submitted"
    is_pinned: bool = False
    public_token: Optional[str] = ""
    created_by_user_id: Optional[str] = None
    created_by_username: Optional[str] = ""
    last_edited_by_user_id: Optional[str] = None
    last_edited_by_username: Optional[str] = ""
    last_edited_at: Optional[str] = ""
    created_at: str



class DocumentTypeIn(BaseModel):
    name: str
    prefix: str  # e.g. "QT", "STAB" — used inside STR/{prefix}/{YYYY}/{counter:03}
    description: Optional[str] = ""
    year_reset: bool = True


class DocumentType(DocumentTypeIn):
    model_config = ConfigDict(extra="ignore")
    id: str
    counter: int = 0
    last_year: int = 0
    created_at: str


class DocumentIn(BaseModel):
    doc_type_id: str
    doc_number: Optional[str] = ""  # auto-generated if blank
    document_date: Optional[str] = None  # ISO date string
    client_id: Optional[str] = None
    architect_id: Optional[str] = None
    plot_place: Optional[str] = ""
    phase: Optional[str] = ""
    number_field: Optional[str] = ""  # the "Number" field on the form (free-text)
    remark: Optional[str] = ""
    contact_person: Optional[str] = ""
    mobile: Optional[str] = ""
    other_comments: Optional[str] = ""
    update_date: Optional[str] = None  # ISO date string


class Document(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    doc_type_id: str
    doc_type_name: str
    doc_number: str
    document_date: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = ""
    architect_id: Optional[str] = None
    architect_name: Optional[str] = ""
    plot_place: str = ""
    phase: str = ""
    number_field: str = ""
    remark: str = ""
    contact_person: str = ""
    mobile: str = ""
    other_comments: str = ""
    update_date: Optional[str] = None
    archived: bool = False
    status: str = "pending"  # pending | confirmed | on_hold | cancelled
    confirmed: bool = False
    linked_project_id: Optional[str] = None
    linked_project_code: Optional[str] = ""
    linked_project_name: Optional[str] = ""
    linked_audit_id: Optional[str] = None
    linked_audit_code: Optional[str] = ""
    linked_audit_offer: Optional[str] = ""
    confirmed_at: Optional[str] = None
    last_edited_by_user_id: Optional[str] = None
    last_edited_by_username: Optional[str] = ""
    last_edited_at: Optional[str] = ""
    created_at: str




# ---------------------- HELPERS ----------------------
import uuid


def _new_id() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _next_project_code() -> str:
    """Get next sequential project code like CC-0001."""
    doc = await db.counters.find_one_and_update(
        {"_id": "project_code"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    # If just created, seq will be 1
    seq = doc.get("seq", 1) if doc else 1
    return f"CC-{seq:04d}"


async def _next_offer_code() -> str:
    """Get next sequential offer code like OFR-0001."""
    doc = await db.counters.find_one_and_update(
        {"_id": "offer_code"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = doc.get("seq", 1) if doc else 1
    return f"OFR-{seq:04d}"


async def _enrich_project(p: dict, client_map: Optional[dict] = None, architect_map: Optional[dict] = None) -> dict:
    """Attach client and architect names, compute outstanding.
    If client_map/architect_map are provided, use them (batch mode, no DB queries).
    Otherwise fall back to per-doc DB fetch (single-project mode).
    """
    cid = p.get("client_id")
    if cid:
        if client_map is not None:
            c = client_map.get(cid)
        else:
            c = await db.clients.find_one({"id": cid}, {"_id": 0})
        p["client_name"] = (c.get("name") if c else "") or ""
        p["client_phone"] = (c.get("phone") if c else "") or ""
        p["client_email"] = (c.get("email") if c else "") or ""
    else:
        p["client_name"] = ""
        p["client_phone"] = ""
        p["client_email"] = ""
    aid = p.get("architect_id")
    if aid:
        if architect_map is not None:
            a = architect_map.get(aid)
        else:
            a = await db.architects.find_one({"id": aid}, {"_id": 0})
        p["architect_name"] = (a.get("name") if a else "") or ""
        p["architect_phone"] = (a.get("phone") if a else "") or ""
        p["architect_email"] = (a.get("email") if a else "") or ""
    else:
        p["architect_name"] = ""
        p["architect_phone"] = ""
        p["architect_email"] = ""
    p["quoted_amount"] = float(p.get("quoted_amount", 0) or 0)
    p["received_amount"] = float(p.get("received_amount", 0) or 0)
    p["outstanding_amount"] = round(p["quoted_amount"] - p["received_amount"], 2)
    p["archived"] = bool(p.get("archived", False))
    # auto-update status
    if p["outstanding_amount"] <= 0 and p["quoted_amount"] > 0:
        p["status"] = "Settled"
    elif p.get("status") not in ("Settled", "Outstanding"):
        p["status"] = "Outstanding"
    return p


async def _enrich_projects_batch(projects: List[dict]) -> List[dict]:
    """Efficiently enrich a list of projects by batch-loading clients and architects.
    Avoids N+1 DB queries.
    """
    if not projects:
        return projects
    client_ids = {p["client_id"] for p in projects if p.get("client_id")}
    architect_ids = {p["architect_id"] for p in projects if p.get("architect_id")}
    client_map = {}
    architect_map = {}
    if client_ids:
        clients = await db.clients.find({"id": {"$in": list(client_ids)}}, {"_id": 0}).to_list(len(client_ids))
        client_map = {c["id"]: c for c in clients}
    if architect_ids:
        architects = await db.architects.find({"id": {"$in": list(architect_ids)}}, {"_id": 0}).to_list(len(architect_ids))
        architect_map = {a["id"]: a for a in architects}
    for p in projects:
        await _enrich_project(p, client_map=client_map, architect_map=architect_map)
    return projects


# ---------------------- CLIENTS ----------------------
@api_router.get("/clients", response_model=List[Client])
async def list_clients():
    items = await db.clients.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


def _norm(s: Optional[str]) -> str:
    """Normalise a string for duplicate comparison (trim, lowercase, collapse spaces)."""
    return " ".join((s or "").strip().lower().split())


def _digits(s: Optional[str]) -> str:
    """Keep only digits — used so '+91 98765-43210' matches '9876543210'."""
    return "".join(ch for ch in (s or "") if ch.isdigit())


async def _find_duplicate_contact(
    collection,
    name: Optional[str],
    phone: Optional[str],
    email: Optional[str],
    exclude_id: Optional[str] = None,
) -> Optional[dict]:
    """Return an existing row that matches by name, phone digits, or email."""
    name_n = _norm(name)
    phone_n = _digits(phone)
    email_n = _norm(email)
    if not (name_n or phone_n or email_n):
        return None
    # Fetch and compare in Python so we can do digits-only / case-insensitive match
    # without needing extra indexes. Collections are small (typically <1000 rows).
    rows = await collection.find({}, {"_id": 0}).to_list(5000)
    for r in rows:
        if exclude_id and r.get("id") == exclude_id:
            continue
        if name_n and _norm(r.get("name")) == name_n:
            return r
        if phone_n and len(phone_n) >= 6 and _digits(r.get("phone")) == phone_n:
            return r
        if email_n and _norm(r.get("email")) == email_n:
            return r
    return None


@api_router.post("/clients", response_model=Client)
async def create_client(data: ClientIn):
    dup = await _find_duplicate_contact(db.clients, data.name, data.phone, data.email)
    if dup:
        reason = (
            f"name '{dup.get('name')}'" if _norm(dup.get("name")) == _norm(data.name)
            else f"phone {dup.get('phone')}" if _digits(dup.get("phone")) == _digits(data.phone)
            else f"email {dup.get('email')}"
        )
        raise HTTPException(409, f"A client with this {reason} already exists. Open '{dup.get('name')}' instead, or change the details.")
    doc = data.model_dump()
    doc["id"] = _new_id()
    doc["created_at"] = _now()
    _stamp_edit(doc)
    await db.clients.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api_router.put("/clients/{client_id}", response_model=Client)
async def update_client(client_id: str, data: ClientIn):
    dup = await _find_duplicate_contact(db.clients, data.name, data.phone, data.email, exclude_id=client_id)
    if dup:
        reason = (
            f"name '{dup.get('name')}'" if _norm(dup.get("name")) == _norm(data.name)
            else f"phone {dup.get('phone')}" if _digits(dup.get("phone")) == _digits(data.phone)
            else f"email {dup.get('email')}"
        )
        raise HTTPException(409, f"Another client with this {reason} already exists.")
    update = data.model_dump()
    _stamp_edit(update)
    result = await db.clients.find_one_and_update(
        {"id": client_id},
        {"$set": update},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(404, "Client not found")
    # Keep cached client_name in projects in sync
    await db.projects.update_many(
        {"client_id": client_id}, {"$set": {"client_name": data.name}}
    )
    return result


@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str):
    res = await db.clients.delete_one({"id": client_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Client not found")
    await db.projects.update_many(
        {"client_id": client_id},
        {"$set": {"client_id": None, "client_name": ""}},
    )
    return {"ok": True}


# ---------------------- ARCHITECTS ----------------------
@api_router.get("/architects", response_model=List[Architect])
async def list_architects():
    items = await db.architects.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


@api_router.get("/architects/{architect_id}")
async def get_architect_detail(architect_id: str):
    architect = await db.architects.find_one({"id": architect_id}, {"_id": 0})
    if not architect:
        raise HTTPException(404, "Architect not found")
    projects = await db.projects.find({"architect_id": architect_id}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    await _enrich_projects_batch(projects)
    documents = await db.documents.find(
        {"architect_id": architect_id, "archived": {"$ne": True}}, {"_id": 0}
    ).sort("created_at", -1).to_list(2000)
    for d in documents:
        # client_name already enriched on write; architect_name fill so card is self-contained
        d.setdefault("architect_name", architect.get("name", ""))
    total_quoted = sum(p.get("quoted_amount", 0) for p in projects)
    total_received = sum(p.get("received_amount", 0) for p in projects)
    total_outstanding = round(total_quoted - total_received, 2)
    outstanding_count = sum(1 for p in projects if p.get("status") != "Settled")
    settled_count = sum(1 for p in projects if p.get("status") == "Settled")
    return {
        "architect": architect,
        "projects": projects,
        "documents": documents,
        "stats": {
            "total_projects": len(projects),
            "total_documents": len(documents),
            "total_quoted": round(total_quoted, 2),
            "total_received": round(total_received, 2),
            "total_outstanding": total_outstanding,
            "outstanding_count": outstanding_count,
            "settled_count": settled_count,
        },
    }


@api_router.get("/clients/{client_id}")
async def get_client_detail(client_id: str):
    client_doc = await db.clients.find_one({"id": client_id}, {"_id": 0})
    if not client_doc:
        raise HTTPException(404, "Client not found")
    projects = await db.projects.find({"client_id": client_id}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    await _enrich_projects_batch(projects)
    documents = await db.documents.find(
        {"client_id": client_id, "archived": {"$ne": True}}, {"_id": 0}
    ).sort("created_at", -1).to_list(2000)
    for d in documents:
        d.setdefault("client_name", client_doc.get("name", ""))
    total_quoted = sum(p.get("quoted_amount", 0) for p in projects)
    total_received = sum(p.get("received_amount", 0) for p in projects)
    total_outstanding = round(total_quoted - total_received, 2)
    outstanding_count = sum(1 for p in projects if p.get("status") != "Settled")
    settled_count = sum(1 for p in projects if p.get("status") == "Settled")
    return {
        "client": client_doc,
        "projects": projects,
        "documents": documents,
        "stats": {
            "total_projects": len(projects),
            "total_documents": len(documents),
            "total_quoted": round(total_quoted, 2),
            "total_received": round(total_received, 2),
            "total_outstanding": total_outstanding,
            "outstanding_count": outstanding_count,
            "settled_count": settled_count,
        },
    }


@api_router.post("/architects", response_model=Architect)
async def create_architect(data: ArchitectIn):
    dup = await _find_duplicate_contact(db.architects, data.name, data.phone, data.email)
    if dup:
        reason = (
            f"name '{dup.get('name')}'" if _norm(dup.get("name")) == _norm(data.name)
            else f"phone {dup.get('phone')}" if _digits(dup.get("phone")) == _digits(data.phone)
            else f"email {dup.get('email')}"
        )
        raise HTTPException(409, f"An architect with this {reason} already exists. Open '{dup.get('name')}' instead, or change the details.")
    doc = data.model_dump()
    doc["id"] = _new_id()
    doc["created_at"] = _now()
    _stamp_edit(doc)
    await db.architects.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api_router.put("/architects/{architect_id}", response_model=Architect)
async def update_architect(architect_id: str, data: ArchitectIn):
    dup = await _find_duplicate_contact(db.architects, data.name, data.phone, data.email, exclude_id=architect_id)
    if dup:
        reason = (
            f"name '{dup.get('name')}'" if _norm(dup.get("name")) == _norm(data.name)
            else f"phone {dup.get('phone')}" if _digits(dup.get("phone")) == _digits(data.phone)
            else f"email {dup.get('email')}"
        )
        raise HTTPException(409, f"Another architect with this {reason} already exists.")
    update = data.model_dump()
    _stamp_edit(update)
    result = await db.architects.find_one_and_update(
        {"id": architect_id},
        {"$set": update},
        return_document=True,
        projection={"_id": 0},
    )
    if not result:
        raise HTTPException(404, "Architect not found")
    await db.projects.update_many(
        {"architect_id": architect_id}, {"$set": {"architect_name": data.name}}
    )
    return result


@api_router.delete("/architects/{architect_id}")
async def delete_architect(architect_id: str):
    res = await db.architects.delete_one({"id": architect_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Architect not found")
    await db.projects.update_many(
        {"architect_id": architect_id},
        {"$set": {"architect_id": None, "architect_name": ""}},
    )
    return {"ok": True}


def _deny_engineer():
    """Raise 403 if the calling user is an engineer. Used to lock financial /
    accounting endpoints (payments, audits, monthly revenue, etc.) so engineers
    can never read amounts even via direct API access."""
    user = get_current_user_safe()
    if user and user.get("role") == "engineer":
        raise HTTPException(status_code=403, detail="Engineers are not allowed to view financial data")


def _require_admin():
    """Raise 403 unless the calling user is an admin. Used to gate destructive
    or counter-resetting endpoints (e.g. editing the Audit Offer numbering series)."""
    user = get_current_user_safe()
    if not user or user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")


# ---------------------- PROJECTS ----------------------
def _strip_financials_for_engineer(items):
    """If the caller is an engineer, blank out money fields on project payload(s).
    Engineers should never see quoted/received/outstanding amounts or payments.
    Accepts a single dict or a list and mutates in place."""
    user = get_current_user_safe()
    if not user or user.get("role") != "engineer":
        return items
    blanked = ["quoted_amount", "received_amount", "outstanding_amount"]
    targets = items if isinstance(items, list) else [items]
    for t in targets:
        if not isinstance(t, dict):
            continue
        for k in blanked:
            if k in t:
                t[k] = None
        # Status (Outstanding / Settled) is derived from money, so hide it too.
        if "status" in t:
            t["status"] = ""
    return items


@api_router.get("/projects", response_model=List[Project])
async def list_projects(search: Optional[str] = None, include_archived: bool = False, archived_only: bool = False):
    query = {}
    if archived_only:
        query["archived"] = True
    elif not include_archived:
        query["archived"] = {"$ne": True}
    # NOTE: Engineers can browse all projects (read-only). This makes the
    # "Linked Project" picker on the New Site Visit form work even when no
    # explicit per-engineer assignment exists yet. RBAC is still enforced on
    # write endpoints (admins manage projects; engineers only create visits).
    if search:
        s = search.strip()
        query["$or"] = [
            {"project_code": {"$regex": s, "$options": "i"}},
            {"job_no": {"$regex": s, "$options": "i"}},
            {"name": {"$regex": s, "$options": "i"}},
            {"client_name": {"$regex": s, "$options": "i"}},
            {"architect_name": {"$regex": s, "$options": "i"}},
            {"site_location": {"$regex": s, "$options": "i"}},
        ]
    items = await db.projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    await _enrich_projects_batch(items)
    return _strip_financials_for_engineer(items)


@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    p = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Project not found")
    await _enrich_project(p)
    return _strip_financials_for_engineer(p)


@api_router.post("/projects", response_model=Project)
async def create_project(data: ProjectIn):
    doc = data.model_dump()
    doc["id"] = _new_id()
    doc["project_code"] = await _next_project_code()
    doc["received_amount"] = 0.0
    doc["created_at"] = _now()
    _stamp_edit(doc)
    await _enrich_project(doc)
    await db.projects.insert_one(doc.copy())
    await _log_activity(
        doc["id"], doc["project_code"], "PROJECT CREATED",
        f"Name: {doc.get('name', '')} | Client: {doc.get('client_name', '-')} | Architect: {doc.get('architect_name', '-')} | Quoted: {doc.get('quoted_amount', 0)}",
    )
    doc.pop("_id", None)
    return doc


@api_router.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, data: ProjectIn):
    existing = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Project not found")
    old_name = existing.get("name", "")
    old_quoted = existing.get("quoted_amount", 0)
    update = data.model_dump()
    existing.update(update)
    _stamp_edit(existing)
    await _enrich_project(existing)
    await db.projects.update_one({"id": project_id}, {"$set": existing})
    await _log_activity(
        project_id, existing.get("project_code", ""), "PROJECT UPDATED",
        f"Name: '{old_name}' -> '{existing.get('name', '')}' | Quoted: {old_quoted} -> {existing.get('quoted_amount', 0)}",
    )
    existing.pop("_id", None)
    return existing


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    res = await db.projects.delete_one({"id": project_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Project not found")
    await db.payments.delete_many({"project_id": project_id})
    await db.quote_revisions.delete_many({"project_id": project_id})
    await db.activity_log.delete_many({"project_id": project_id})
    return {"ok": True}


@api_router.post("/projects/{project_id}/archive")
async def archive_project(project_id: str):
    res = await db.projects.update_one({"id": project_id}, {"$set": {"archived": True}})
    if res.matched_count == 0:
        raise HTTPException(404, "Project not found")
    proj = await db.projects.find_one({"id": project_id}, {"_id": 0, "project_code": 1})
    await _log_activity(project_id, (proj or {}).get("project_code", ""), "PROJECT ARCHIVED", "")
    return {"ok": True, "archived": True}


@api_router.post("/projects/{project_id}/unarchive")
async def unarchive_project(project_id: str):
    res = await db.projects.update_one({"id": project_id}, {"$set": {"archived": False}})
    if res.matched_count == 0:
        raise HTTPException(404, "Project not found")
    proj = await db.projects.find_one({"id": project_id}, {"_id": 0, "project_code": 1})
    await _log_activity(project_id, (proj or {}).get("project_code", ""), "PROJECT RESTORED", "")
    return {"ok": True, "archived": False}


# ---------------------- PAYMENTS ----------------------
@api_router.get("/payments", response_model=List[Payment])
async def list_payments(project_id: Optional[str] = None):
    _deny_engineer()
    q = {"project_id": project_id} if project_id else {}
    items = await db.payments.find(q, {"_id": 0}).sort("payment_date", -1).to_list(5000)
    return items


@api_router.post("/payments", response_model=Payment)
async def create_payment(data: PaymentIn):
    project = await db.projects.find_one({"id": data.project_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")
    if data.amount <= 0:
        raise HTTPException(400, "Amount must be > 0")
    doc = {
        "id": _new_id(),
        "project_id": data.project_id,
        "project_code": project.get("project_code", ""),
        "amount": float(data.amount),
        "payment_date": data.payment_date or _now(),
        "notes": data.notes or "",
        "created_at": _now(),
    }
    _stamp_edit(doc)
    await db.payments.insert_one(doc.copy())
    # Update project's received amount
    new_received = float(project.get("received_amount", 0)) + float(data.amount)
    project["received_amount"] = new_received
    await _enrich_project(project)
    await db.projects.update_one(
        {"id": data.project_id},
        {"$set": {
            "received_amount": new_received,
            "outstanding_amount": project["outstanding_amount"],
            "status": project["status"],
        }},
    )
    await _log_activity(
        data.project_id, project.get("project_code", ""),
        "PAYMENT ADDED",
        f"Amount: Rs. {float(data.amount):,.2f} | Note: {data.notes or '-'}",
    )
    doc.pop("_id", None)
    return doc


@api_router.delete("/payments/{payment_id}")
async def delete_payment(payment_id: str):
    pay = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not pay:
        raise HTTPException(404, "Payment not found")
    await db.payments.delete_one({"id": payment_id})
    # Recompute project totals
    project = await db.projects.find_one({"id": pay["project_id"]}, {"_id": 0})
    if project:
        new_received = max(0.0, float(project.get("received_amount", 0)) - float(pay["amount"]))
        project["received_amount"] = new_received
        await _enrich_project(project)
        await db.projects.update_one(
            {"id": pay["project_id"]},
            {"$set": {
                "received_amount": new_received,
                "outstanding_amount": project["outstanding_amount"],
                "status": project["status"],
            }},
        )
        await _log_activity(
            pay["project_id"], project.get("project_code", ""),
            "PAYMENT DELETED",
            f"Amount: Rs. {float(pay['amount']):,.2f} | Note: {pay.get('notes', '-')}",
        )
    return {"ok": True}


# ---------------------- QUOTE REVISIONS ----------------------
class QuoteRevisionIn(BaseModel):
    new_amount: float
    reason: Optional[str] = ""


@api_router.get("/projects/{project_id}/revisions")
async def list_revisions(project_id: str):
    _deny_engineer()
    items = await db.quote_revisions.find({"project_id": project_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


@api_router.post("/projects/{project_id}/revise-quote")
async def revise_quote(project_id: str, data: QuoteRevisionIn):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")
    old_amount = float(project.get("quoted_amount", 0) or 0)
    new_amount = float(data.new_amount)
    if new_amount < 0:
        raise HTTPException(400, "Amount must be >= 0")
    rev = {
        "id": _new_id(),
        "project_id": project_id,
        "project_code": project.get("project_code", ""),
        "old_amount": old_amount,
        "new_amount": new_amount,
        "reason": data.reason or "",
        "created_at": _now(),
    }
    await db.quote_revisions.insert_one(rev.copy())
    # Update project quoted amount, re-enrich
    project["quoted_amount"] = new_amount
    await _enrich_project(project)
    await db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "quoted_amount": new_amount,
            "outstanding_amount": project["outstanding_amount"],
            "status": project["status"],
        }},
    )
    await _log_activity(
        project_id, project.get("project_code", ""),
        "QUOTE REVISED",
        f"Old: Rs. {old_amount:,.2f} -> New: Rs. {new_amount:,.2f} | Reason: {data.reason or '-'}",
    )
    rev.pop("_id", None)
    return rev


# ---------------------- ACTIVITY LOG ----------------------
def _current_user_stamp() -> dict:
    """Returns user_id + username from the current request, or empty placeholders for system."""
    try:
        u = auth_module.get_current_user_safe()
    except Exception:
        u = None
    if u and u.get("id") and u["id"] != "anonymous":
        return {
            "user_id": u["id"],
            "username": u.get("username", ""),
        }
    return {"user_id": None, "username": "system"}


def _stamp_edit(doc: dict) -> dict:
    """Add last_edited_by + last_edited_at to a document. Mutates and returns it."""
    s = _current_user_stamp()
    doc["last_edited_by_user_id"] = s["user_id"]
    doc["last_edited_by_username"] = s["username"]
    doc["last_edited_at"] = _now().isoformat() if hasattr(_now(), "isoformat") else _now()
    return doc


async def _log_activity(project_id: str, project_code: str, action: str, detail: str = ""):
    try:
        s = _current_user_stamp()
        await db.activity_log.insert_one({
            "id": _new_id(),
            "project_id": project_id,
            "project_code": project_code,
            "action": action,
            "detail": detail,
            "user_id": s["user_id"],
            "username": s["username"],
            "created_at": _now(),
        })
    except Exception as e:
        logger.error(f"activity log error: {e}")


@api_router.get("/projects/{project_id}/activity")
async def list_activity(project_id: str):
    items = await db.activity_log.find({"project_id": project_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


# ---------------------- PER-PROJECT EXCEL EXPORT ----------------------
@api_router.get("/projects/{project_id}/export")
async def export_project_excel(project_id: str):
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")
    await _enrich_project(project)
    payments = await db.payments.find({"project_id": project_id}, {"_id": 0}).sort("payment_date", 1).to_list(5000)
    revisions = await db.quote_revisions.find({"project_id": project_id}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    activity = await db.activity_log.find({"project_id": project_id}, {"_id": 0}).sort("created_at", 1).to_list(5000)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Project Info"
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="061A11")

    info_rows = [
        ("Project ID", project.get("project_code", "")),
        ("Project Name", project.get("name", "")),
        ("Client", project.get("client_name", "")),
        ("Architect", project.get("architect_name", "")),
        ("Site Location", project.get("site_location", "")),
        ("Current Quoted (INR)", project.get("quoted_amount", 0)),
        ("Received (INR)", project.get("received_amount", 0)),
        ("Outstanding (INR)", project.get("outstanding_amount", 0)),
        ("Status", project.get("status", "")),
        ("Notes", project.get("notes", "")),
        ("Created", project.get("created_at", "")),
    ]
    for label, value in info_rows:
        ws.append([label, value])
    for r in range(1, len(info_rows) + 1):
        ws.cell(row=r, column=1).font = Font(bold=True)
    ws.column_dimensions["A"].width = 22
    ws.column_dimensions["B"].width = 50

    ws2 = wb.create_sheet("Payments")
    ws2.append(["#", "Date", "Amount (INR)", "Notes"])
    for col in range(1, 5):
        c = ws2.cell(row=1, column=col)
        c.font = header_font
        c.fill = header_fill
    for i, p in enumerate(payments, 1):
        ws2.append([i, p.get("payment_date", ""), float(p.get("amount", 0)), p.get("notes", "")])

    ws3 = wb.create_sheet("Quote Revisions")
    ws3.append(["#", "Old Amount (INR)", "New Amount (INR)", "Reason", "Date"])
    for col in range(1, 6):
        c = ws3.cell(row=1, column=col)
        c.font = header_font
        c.fill = header_fill
    for i, r in enumerate(revisions, 1):
        ws3.append([i, float(r.get("old_amount", 0)), float(r.get("new_amount", 0)), r.get("reason", ""), r.get("created_at", "")])

    ws4 = wb.create_sheet("Activity")
    ws4.append(["#", "Action", "Detail", "Date"])
    for col in range(1, 5):
        c = ws4.cell(row=1, column=col)
        c.font = header_font
        c.fill = header_fill
    for i, a in enumerate(activity, 1):
        ws4.append([i, a.get("action", ""), a.get("detail", ""), a.get("created_at", "")])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"project_{project.get('project_code', 'export')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------- PDF (Invoice / Receipt) ----------------------
BRAND_GREEN = colors.HexColor("#0A2E1F")
BRAND_ACCENT = colors.HexColor("#10B981")
BRAND_MUTED = colors.HexColor("#526B60")


def _format_inr(n: float) -> str:
    """Format number in Indian numbering system: 1,23,45,678.00"""
    try:
        neg = n < 0
        n = abs(float(n))
        whole = int(n)
        frac = round(n - whole, 2)
        s = str(whole)
        if len(s) > 3:
            last3 = s[-3:]
            rest = s[:-3]
            # Group rest by 2s
            parts = []
            while len(rest) > 2:
                parts.insert(0, rest[-2:])
                rest = rest[:-2]
            if rest:
                parts.insert(0, rest)
            s = ",".join(parts) + "," + last3
        result = f"{s}.{int(round(frac * 100)):02d}"
        return ("-" if neg else "") + result
    except Exception:
        return f"{n:.2f}"


def _draw_pdf_header(c: canvas.Canvas, title: str, sub_id: str):
    width, height = A4
    # Top green band
    c.setFillColor(BRAND_GREEN)
    c.rect(0, height - 28 * mm, width, 28 * mm, fill=1, stroke=0)
    # Brand
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(18 * mm, height - 14 * mm, "CREATOR CONSULTANT")
    c.setFillColor(BRAND_ACCENT)
    c.setFont("Helvetica", 9)
    c.drawString(18 * mm, height - 20 * mm, "Architecture • Engineering • Project Consultancy")
    # Title on right
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 22)
    c.drawRightString(width - 18 * mm, height - 14 * mm, title)
    c.setFont("Helvetica", 9)
    c.drawRightString(width - 18 * mm, height - 20 * mm, sub_id)
    # Reset
    c.setFillColor(colors.black)


def _draw_kv(c, x, y, key, value, key_w=40 * mm, bold_value=False):
    c.setFont("Helvetica", 9)
    c.setFillColor(BRAND_MUTED)
    c.drawString(x, y, key.upper())
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold" if bold_value else "Helvetica", 11)
    c.drawString(x + key_w, y, value or "—")


def _draw_footer(c: canvas.Canvas):
    width, _ = A4
    c.setFillColor(BRAND_MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(18 * mm, 12 * mm, "This is a computer generated document from Creator Consultant.")
    c.drawRightString(width - 18 * mm, 12 * mm, datetime.now().strftime("Generated %d %b %Y, %H:%M"))


async def _build_receipt_pdf(payment: dict, project: dict, client_doc: Optional[dict]) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    pay_date = payment.get("payment_date", "")
    try:
        pay_date_str = datetime.fromisoformat(pay_date.replace("Z", "+00:00")).strftime("%d %b %Y")
    except Exception:
        pay_date_str = pay_date[:10]

    _draw_pdf_header(c, "RECEIPT", f"Receipt ID: {payment['id'][:8].upper()}")

    y = height - 42 * mm
    # Meta
    _draw_kv(c, 18 * mm, y, "Project", f"{project.get('project_code', '')} — {project.get('name', '')}", bold_value=True)
    y -= 7 * mm
    _draw_kv(c, 18 * mm, y, "Payment Date", pay_date_str, bold_value=True)
    y -= 7 * mm
    if client_doc:
        _draw_kv(c, 18 * mm, y, "Received From", client_doc.get("name", ""), bold_value=True)
        y -= 7 * mm
        if client_doc.get("address"):
            _draw_kv(c, 18 * mm, y, "Address", client_doc.get("address", ""))
            y -= 7 * mm
        contact_bits = []
        if client_doc.get("phone"):
            contact_bits.append(client_doc["phone"])
        if client_doc.get("email"):
            contact_bits.append(client_doc["email"])
        if contact_bits:
            _draw_kv(c, 18 * mm, y, "Contact", " • ".join(contact_bits))
            y -= 7 * mm

    # Amount highlight box
    y -= 6 * mm
    box_h = 28 * mm
    c.setFillColor(BRAND_GREEN)
    c.roundRect(18 * mm, y - box_h, width - 36 * mm, box_h, 6, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 10)
    c.drawString(24 * mm, y - 10 * mm, "AMOUNT RECEIVED")
    c.setFont("Helvetica-Bold", 26)
    c.drawString(24 * mm, y - 20 * mm, f"Rs. {_format_inr(payment.get('amount', 0))}")
    c.setFillColor(BRAND_ACCENT)
    c.setFont("Helvetica", 9)
    c.drawRightString(width - 24 * mm, y - 20 * mm, "Indian Rupees")

    y = y - box_h - 10 * mm
    c.setFillColor(colors.black)

    # Summary
    _draw_kv(c, 18 * mm, y, "Project Quoted", f"Rs. {_format_inr(project.get('quoted_amount', 0))}")
    y -= 6 * mm
    _draw_kv(c, 18 * mm, y, "Total Received (incl. this)", f"Rs. {_format_inr(project.get('received_amount', 0))}")
    y -= 6 * mm
    _draw_kv(c, 18 * mm, y, "Outstanding Balance", f"Rs. {_format_inr(project.get('outstanding_amount', 0))}", bold_value=True)
    y -= 10 * mm

    if payment.get("notes"):
        c.setFillColor(BRAND_MUTED)
        c.setFont("Helvetica", 9)
        c.drawString(18 * mm, y, "NOTES")
        c.setFillColor(colors.black)
        c.setFont("Helvetica", 10)
        c.drawString(18 * mm, y - 5 * mm, payment["notes"][:110])
        y -= 12 * mm

    # Signature
    y = max(y, 40 * mm)
    c.setStrokeColor(BRAND_MUTED)
    c.line(width - 70 * mm, 32 * mm, width - 20 * mm, 32 * mm)
    c.setFillColor(BRAND_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(width - 70 * mm, 28 * mm, "Authorised Signatory")
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(BRAND_GREEN)
    c.drawString(width - 70 * mm, 35 * mm, "For Creator Consultant")

    _draw_footer(c)
    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()


async def _build_invoice_pdf(project: dict, client_doc: Optional[dict], architect_doc: Optional[dict]) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4

    _draw_pdf_header(c, "INVOICE", f"Project: {project.get('project_code', '')}")

    y = height - 42 * mm
    # Bill to
    c.setFillColor(BRAND_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(18 * mm, y, "BILL TO")
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 13)
    y -= 6 * mm
    c.drawString(18 * mm, y, (client_doc or {}).get("name", project.get("client_name", "")) or "—")
    c.setFont("Helvetica", 10)
    if client_doc:
        if client_doc.get("company"):
            y -= 5 * mm
            c.drawString(18 * mm, y, client_doc["company"])
        if client_doc.get("address"):
            y -= 5 * mm
            c.drawString(18 * mm, y, client_doc["address"][:80])
        line = " • ".join([x for x in [client_doc.get("phone"), client_doc.get("email")] if x])
        if line:
            y -= 5 * mm
            c.setFillColor(BRAND_MUTED)
            c.drawString(18 * mm, y, line)
            c.setFillColor(colors.black)

    # Meta on right
    ry = height - 42 * mm
    c.setFillColor(BRAND_MUTED)
    c.setFont("Helvetica", 9)
    c.drawRightString(width - 18 * mm, ry, "INVOICE DATE")
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(width - 18 * mm, ry - 5 * mm, datetime.now().strftime("%d %b %Y"))
    c.setFillColor(BRAND_MUTED)
    c.setFont("Helvetica", 9)
    c.drawRightString(width - 18 * mm, ry - 12 * mm, "PROJECT STATUS")
    c.setFillColor(BRAND_ACCENT if project.get("status") == "Settled" else colors.HexColor("#DC2626"))
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(width - 18 * mm, ry - 17 * mm, project.get("status", "Outstanding").upper())

    # Line items table
    y -= 18 * mm
    c.setFillColor(BRAND_GREEN)
    c.rect(18 * mm, y - 8 * mm, width - 36 * mm, 8 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(22 * mm, y - 5.5 * mm, "DESCRIPTION")
    c.drawRightString(width - 22 * mm, y - 5.5 * mm, "AMOUNT (INR)")

    y -= 8 * mm
    c.setFillColor(colors.black)

    # Project line
    y -= 8 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(22 * mm, y, project.get("name", ""))
    c.setFont("Helvetica", 9)
    c.setFillColor(BRAND_MUTED)
    y -= 5 * mm
    desc = project.get("site_location") or ""
    if desc:
        c.drawString(22 * mm, y, f"Location: {desc[:75]}")
        y -= 5 * mm
    if architect_doc and architect_doc.get("name"):
        c.drawString(22 * mm, y, f"Architect: {architect_doc['name']}")
        y -= 5 * mm

    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(width - 22 * mm, y + 10 * mm, f"Rs. {_format_inr(project.get('quoted_amount', 0))}")

    # Totals box
    y -= 8 * mm
    c.setStrokeColor(BRAND_MUTED)
    c.line(18 * mm, y, width - 18 * mm, y)

    y -= 8 * mm
    c.setFont("Helvetica", 10)
    c.setFillColor(BRAND_MUTED)
    c.drawRightString(width - 60 * mm, y, "Quoted Amount")
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 11)
    c.drawRightString(width - 22 * mm, y, f"Rs. {_format_inr(project.get('quoted_amount', 0))}")

    y -= 7 * mm
    c.setFillColor(BRAND_MUTED)
    c.setFont("Helvetica", 10)
    c.drawRightString(width - 60 * mm, y, "Received")
    c.setFillColor(BRAND_ACCENT)
    c.setFont("Helvetica", 11)
    c.drawRightString(width - 22 * mm, y, f"Rs. {_format_inr(project.get('received_amount', 0))}")

    y -= 10 * mm
    # Outstanding highlight
    c.setFillColor(BRAND_GREEN)
    c.roundRect(width - 90 * mm, y - 4 * mm, 72 * mm, 14 * mm, 4, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(width - 86 * mm, y + 3 * mm, "AMOUNT DUE")
    c.setFont("Helvetica-Bold", 14)
    c.drawRightString(width - 22 * mm, y + 3 * mm, f"Rs. {_format_inr(project.get('outstanding_amount', 0))}")

    # Footer notes
    c.setFillColor(BRAND_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(18 * mm, 40 * mm, "Payment Terms: Due on receipt. Kindly pay via bank transfer, cheque or UPI.")
    c.drawString(18 * mm, 35 * mm, "Thank you for your business.")

    _draw_footer(c)
    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()


@api_router.get("/payments/{payment_id}/receipt")
async def payment_receipt_pdf(payment_id: str):
    _deny_engineer()
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(404, "Payment not found")
    project = await db.projects.find_one({"id": payment["project_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")
    await _enrich_project(project)
    client_doc = None
    if project.get("client_id"):
        client_doc = await db.clients.find_one({"id": project["client_id"]}, {"_id": 0})
    pdf_bytes = await _build_receipt_pdf(payment, project, client_doc)
    filename = f"receipt_{project['project_code']}_{payment_id[:8]}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/projects/{project_id}/invoice")
async def project_invoice_pdf(project_id: str):
    _deny_engineer()
    project = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(404, "Project not found")
    await _enrich_project(project)
    client_doc = None
    architect_doc = None
    if project.get("client_id"):
        client_doc = await db.clients.find_one({"id": project["client_id"]}, {"_id": 0})
    if project.get("architect_id"):
        architect_doc = await db.architects.find_one({"id": project["architect_id"]}, {"_id": 0})
    pdf_bytes = await _build_invoice_pdf(project, client_doc, architect_doc)
    filename = f"invoice_{project['project_code']}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------- AUDITS ----------------------
class AuditIn(BaseModel):
    audit_code: Optional[str] = ""      # editable; auto-filled if blank
    audit_offer: str = ""                # e.g. "Structural Audit" (free text)
    report_id: Optional[str] = ""        # editable; auto-filled if blank
    client_id: Optional[str] = None
    # Free-text client contact fields. When set, override whatever would be
    # enriched from the linked Client record. Used for one-off audits where
    # the customer isn't a recurring client.
    client_name_override: Optional[str] = ""
    client_phone_override: Optional[str] = ""
    client_email_override: Optional[str] = ""
    total_amount: float = 0.0
    status: Optional[str] = "Outstanding"
    notes: Optional[str] = ""
    file_path: Optional[str] = ""        # path on user's PC, e.g. D:\Audits\2026\STR-AUDIT-006.pdf


class Audit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    audit_code: str
    audit_offer: str = ""
    report_id: str = ""
    client_id: Optional[str] = None
    client_name: Optional[str] = ""
    client_phone: Optional[str] = ""
    client_email: Optional[str] = ""
    client_name_override: Optional[str] = ""
    client_phone_override: Optional[str] = ""
    client_email_override: Optional[str] = ""
    total_amount: float = 0.0
    received_amount: float = 0.0
    outstanding_amount: float = 0.0
    status: str = "Outstanding"
    notes: str = ""
    file_path: str = ""
    archived: bool = False
    last_edited_by_user_id: Optional[str] = None
    last_edited_by_username: Optional[str] = ""
    last_edited_at: Optional[str] = ""
    created_at: str


async def _next_audit_code() -> str:
    doc = await db.counters.find_one_and_update(
        {"_id": "audit_code"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = doc.get("seq", 1) if doc else 1
    return f"AUD-{seq:04d}"


async def _next_report_id() -> str:
    year = datetime.now(timezone.utc).year
    doc = await db.counters.find_one_and_update(
        {"_id": f"report_id_{year}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = doc.get("seq", 1) if doc else 1
    return f"RPT-{year}-{seq:03d}"


async def _next_audit_offer_number() -> str:
    """Auto-generate STR/AUD-OFR/YYYY/NNN — year-resetting counter."""
    year = datetime.now(timezone.utc).year
    doc = await db.counters.find_one_and_update(
        {"_id": f"audit_offer_{year}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = doc.get("seq", 1) if doc else 1
    return f"STR/AUD-OFR/{year}/{seq:03d}"


async def _peek_next_audit_offer_number() -> str:
    """Return what the NEXT auto-generated audit_offer would be, without
    consuming the counter. Used for the form preview hint."""
    year = datetime.now(timezone.utc).year
    doc = await db.counters.find_one({"_id": f"audit_offer_{year}"})
    seq = (doc or {}).get("seq", 0) + 1
    return f"STR/AUD-OFR/{year}/{seq:03d}"



async def _enrich_audit(a: dict) -> dict:
    if a.get("client_id"):
        c = await db.clients.find_one({"id": a["client_id"]}, {"_id": 0})
        a["client_name"] = (c.get("name") if c else "") or ""
        a["client_phone"] = (c.get("phone") if c else "") or ""
        a["client_email"] = (c.get("email") if c else "") or ""
    else:
        a["client_name"] = a.get("client_name") or ""
        a["client_phone"] = a.get("client_phone") or ""
        a["client_email"] = a.get("client_email") or ""
    # Per-audit overrides win over the enriched client fields. Useful for
    # one-off audits where the customer isn't a recurring client, or where
    # the engineer wants to record a different point-of-contact for THIS audit.
    if a.get("client_name_override"):
        a["client_name"] = a["client_name_override"]
    if a.get("client_phone_override"):
        a["client_phone"] = a["client_phone_override"]
    if a.get("client_email_override"):
        a["client_email"] = a["client_email_override"]
    total = float(a.get("total_amount", 0) or 0)
    received = float(a.get("received_amount", 0) or 0)
    outstanding = max(0.0, total - received)
    a["outstanding_amount"] = outstanding
    if outstanding <= 0.009 and total > 0:
        a["status"] = "Settled"
    else:
        a["status"] = a.get("status") or "Outstanding"
        if a["status"] == "Settled":
            a["status"] = "Outstanding"
    return a


async def _log_audit_activity(audit_id: str, audit_code: str, action: str, detail: str = ""):
    try:
        s = _current_user_stamp()
        await db.activity_log.insert_one({
            "id": _new_id(),
            "audit_id": audit_id,
            "audit_code": audit_code,
            "project_id": None,
            "project_code": "",
            "action": action,
            "detail": detail,
            "user_id": s["user_id"],
            "username": s["username"],
            "created_at": _now(),
        })
    except Exception as e:
        logger.error(f"audit activity log error: {e}")


@api_router.get("/audits/next-offer-preview")
async def audits_next_offer_preview():
    """Returns the next Audit Offer Number that will be assigned (for form hint)."""
    _deny_engineer()
    return {"number": await _peek_next_audit_offer_number()}


@api_router.get("/audits/offer-series")
async def get_audit_offer_series():
    """Inspect the current Audit Offer year-counter for the Settings UI."""
    _deny_engineer()
    year = datetime.now(timezone.utc).year
    doc = await db.counters.find_one({"_id": f"audit_offer_{year}"})
    seq = (doc or {}).get("seq", 0)
    next_seq = seq + 1
    return {
        "year": year,
        "current_seq": seq,
        "next_seq": next_seq,
        "next_code": f"STR/AUD-OFR/{year}/{next_seq:03d}",
    }


@api_router.put("/audits/offer-series")
async def set_audit_offer_series(payload: dict = Body(...)):
    """Set the NEXT Audit Offer Number's serial (admin only). Won't allow a
    rewind that would collide with an existing `STR/AUD-OFR/YYYY/NNN` audit."""
    _require_admin()
    year = datetime.now(timezone.utc).year
    try:
        next_seq = int(payload.get("next_seq"))
    except (TypeError, ValueError):
        raise HTTPException(400, "next_seq must be a positive integer")
    if next_seq < 1:
        raise HTTPException(400, "next_seq must be at least 1")

    # Build the candidate code and refuse if an audit already uses it.
    candidate = f"STR/AUD-OFR/{year}/{next_seq:03d}"
    clash = await db.audits.find_one({"audit_offer": candidate}, {"_id": 0, "id": 1})
    if clash:
        raise HTTPException(400, f"An audit with offer number {candidate} already exists. Pick a different starting number.")

    # Set the counter so the NEXT auto-generate returns `next_seq`.
    # _next_audit_offer_number does {$inc: 1} then returns seq, so we need to
    # store next_seq - 1 here.
    await db.counters.update_one(
        {"_id": f"audit_offer_{year}"},
        {"$set": {"seq": next_seq - 1}},
        upsert=True,
    )
    return {"ok": True, "year": year, "next_seq": next_seq, "next_code": candidate}



@api_router.get("/audits", response_model=List[Audit])
async def list_audits(archived: Optional[bool] = False, search: Optional[str] = None):
    _deny_engineer()
    query = {"archived": bool(archived)}
    if search:
        s = search.strip()
        query["$or"] = [
            {"audit_code": {"$regex": s, "$options": "i"}},
            {"audit_offer": {"$regex": s, "$options": "i"}},
            {"report_id": {"$regex": s, "$options": "i"}},
            {"client_name": {"$regex": s, "$options": "i"}},
            {"notes": {"$regex": s, "$options": "i"}},
        ]
    items = await db.audits.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    for a in items:
        await _enrich_audit(a)
    return items


@api_router.get("/audits/{audit_id}", response_model=Audit)
async def get_audit(audit_id: str):
    _deny_engineer()
    a = await db.audits.find_one({"id": audit_id}, {"_id": 0})
    if not a:
        raise HTTPException(404, "Audit not found")
    await _enrich_audit(a)
    return a


@api_router.post("/audits", response_model=Audit)
async def create_audit(data: AuditIn):
    doc = data.model_dump()
    doc["id"] = _new_id()
    doc["audit_code"] = (doc.get("audit_code") or "").strip() or await _next_audit_code()
    doc["report_id"] = (doc.get("report_id") or "").strip() or await _next_report_id()
    # Audit Offer Number — auto-generate STR/AUD-OFR/YYYY/NNN if the engineer
    # didn't override it on the form.
    doc["audit_offer"] = (doc.get("audit_offer") or "").strip() or await _next_audit_offer_number()
    doc["received_amount"] = 0.0
    doc["archived"] = False
    doc["created_at"] = _now()
    _stamp_edit(doc)
    await _enrich_audit(doc)
    await db.audits.insert_one(doc.copy())
    await _log_audit_activity(
        doc["id"], doc["audit_code"], "AUDIT CREATED",
        f"Offer: {doc.get('audit_offer', '-')} | Client: {doc.get('client_name', '-')} | Total: {doc.get('total_amount', 0)}",
    )
    doc.pop("_id", None)
    return doc


@api_router.put("/audits/{audit_id}", response_model=Audit)
async def update_audit(audit_id: str, data: AuditIn):
    existing = await db.audits.find_one({"id": audit_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Audit not found")
    old_total = existing.get("total_amount", 0)
    update = data.model_dump()
    # Keep the existing code/report_id/audit_offer if new value is blank
    if not (update.get("audit_code") or "").strip():
        update["audit_code"] = existing.get("audit_code", "")
    if not (update.get("report_id") or "").strip():
        update["report_id"] = existing.get("report_id", "")
    if not (update.get("audit_offer") or "").strip():
        update["audit_offer"] = existing.get("audit_offer", "")
    existing.update(update)
    _stamp_edit(existing)
    await _enrich_audit(existing)
    await db.audits.update_one({"id": audit_id}, {"$set": existing})
    await _log_audit_activity(
        audit_id, existing.get("audit_code", ""), "AUDIT UPDATED",
        f"Total: {old_total} -> {existing.get('total_amount', 0)}",
    )
    existing.pop("_id", None)
    return existing


@api_router.delete("/audits/{audit_id}")
async def delete_audit(audit_id: str):
    res = await db.audits.delete_one({"id": audit_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Audit not found")
    await db.audit_payments.delete_many({"audit_id": audit_id})
    await db.audit_quote_revisions.delete_many({"audit_id": audit_id})
    await db.activity_log.delete_many({"audit_id": audit_id})
    return {"ok": True}


@api_router.post("/audits/{audit_id}/archive")
async def archive_audit(audit_id: str):
    res = await db.audits.update_one({"id": audit_id}, {"$set": {"archived": True}})
    if res.matched_count == 0:
        raise HTTPException(404, "Audit not found")
    a = await db.audits.find_one({"id": audit_id}, {"_id": 0, "audit_code": 1})
    await _log_audit_activity(audit_id, (a or {}).get("audit_code", ""), "AUDIT ARCHIVED", "")
    return {"ok": True, "archived": True}


@api_router.post("/audits/{audit_id}/unarchive")
async def unarchive_audit(audit_id: str):
    res = await db.audits.update_one({"id": audit_id}, {"$set": {"archived": False}})
    if res.matched_count == 0:
        raise HTTPException(404, "Audit not found")
    a = await db.audits.find_one({"id": audit_id}, {"_id": 0, "audit_code": 1})
    await _log_audit_activity(audit_id, (a or {}).get("audit_code", ""), "AUDIT RESTORED", "")
    return {"ok": True, "archived": False}


# ---------- Audit Payments (separate collection from project payments) ----------
class AuditPaymentIn(BaseModel):
    audit_id: str
    amount: float
    payment_date: Optional[str] = None
    notes: Optional[str] = ""


class AuditPayment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    audit_id: str
    audit_code: str
    amount: float
    payment_date: str
    notes: str = ""
    last_edited_by_user_id: Optional[str] = None
    last_edited_by_username: Optional[str] = ""
    last_edited_at: Optional[str] = ""
    created_at: str


@api_router.get("/audit-payments", response_model=List[AuditPayment])
async def list_audit_payments(audit_id: Optional[str] = None):
    q = {"audit_id": audit_id} if audit_id else {}
    items = await db.audit_payments.find(q, {"_id": 0}).sort("payment_date", -1).to_list(5000)
    return items


@api_router.post("/audit-payments", response_model=AuditPayment)
async def create_audit_payment(data: AuditPaymentIn):
    audit = await db.audits.find_one({"id": data.audit_id}, {"_id": 0})
    if not audit:
        raise HTTPException(404, "Audit not found")
    if data.amount <= 0:
        raise HTTPException(400, "Amount must be > 0")
    doc = {
        "id": _new_id(),
        "audit_id": data.audit_id,
        "audit_code": audit.get("audit_code", ""),
        "amount": float(data.amount),
        "payment_date": data.payment_date or _now(),
        "notes": data.notes or "",
        "created_at": _now(),
    }
    _stamp_edit(doc)
    await db.audit_payments.insert_one(doc.copy())
    new_received = float(audit.get("received_amount", 0)) + float(data.amount)
    audit["received_amount"] = new_received
    await _enrich_audit(audit)
    await db.audits.update_one(
        {"id": data.audit_id},
        {"$set": {
            "received_amount": new_received,
            "outstanding_amount": audit["outstanding_amount"],
            "status": audit["status"],
        }},
    )
    await _log_audit_activity(
        data.audit_id, audit.get("audit_code", ""), "PAYMENT ADDED",
        f"Amount: Rs. {float(data.amount):,.2f} | Note: {data.notes or '-'}",
    )
    doc.pop("_id", None)
    return doc


@api_router.delete("/audit-payments/{payment_id}")
async def delete_audit_payment(payment_id: str):
    pay = await db.audit_payments.find_one({"id": payment_id}, {"_id": 0})
    if not pay:
        raise HTTPException(404, "Audit payment not found")
    await db.audit_payments.delete_one({"id": payment_id})
    audit = await db.audits.find_one({"id": pay["audit_id"]}, {"_id": 0})
    if audit:
        new_received = max(0.0, float(audit.get("received_amount", 0)) - float(pay["amount"]))
        audit["received_amount"] = new_received
        await _enrich_audit(audit)
        await db.audits.update_one(
            {"id": pay["audit_id"]},
            {"$set": {
                "received_amount": new_received,
                "outstanding_amount": audit["outstanding_amount"],
                "status": audit["status"],
            }},
        )
        await _log_audit_activity(
            pay["audit_id"], audit.get("audit_code", ""), "PAYMENT DELETED",
            f"Amount: Rs. {float(pay['amount']):,.2f} | Note: {pay.get('notes', '-')}",
        )
    return {"ok": True}


@api_router.get("/audits/{audit_id}/activity")
async def list_audit_activity(audit_id: str):
    items = await db.activity_log.find({"audit_id": audit_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


def _audit_to_project_shape(a: dict) -> dict:
    """Adapt audit dict to the shape expected by _build_invoice_pdf / _build_receipt_pdf."""
    return {
        "id": a.get("id", ""),
        "project_code": a.get("audit_code", ""),
        "name": a.get("audit_offer", "") or "Structural Audit",
        "client_id": a.get("client_id"),
        "client_name": a.get("client_name", ""),
        "client_phone": a.get("client_phone", ""),
        "client_email": a.get("client_email", ""),
        "architect_id": None,
        "architect_name": "",
        "architect_phone": "",
        "architect_email": "",
        "site_location": "",
        "quoted_amount": float(a.get("total_amount", 0) or 0),
        "received_amount": float(a.get("received_amount", 0) or 0),
        "outstanding_amount": float(a.get("outstanding_amount", 0) or 0),
        "status": a.get("status", "Outstanding"),
        "notes": a.get("notes", "") or f"Report ID: {a.get('report_id', '')}",
        "created_at": a.get("created_at", _now()),
    }


@api_router.get("/audits/{audit_id}/invoice")
async def audit_invoice_pdf(audit_id: str):
    audit = await db.audits.find_one({"id": audit_id}, {"_id": 0})
    if not audit:
        raise HTTPException(404, "Audit not found")
    await _enrich_audit(audit)
    client_doc = None
    if audit.get("client_id"):
        client_doc = await db.clients.find_one({"id": audit["client_id"]}, {"_id": 0})
    proj_shape = _audit_to_project_shape(audit)
    pdf_bytes = await _build_invoice_pdf(proj_shape, client_doc, None)
    filename = f"invoice_{audit['audit_code']}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.get("/audit-payments/{payment_id}/receipt")
async def audit_payment_receipt_pdf(payment_id: str):
    payment = await db.audit_payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(404, "Audit payment not found")
    audit = await db.audits.find_one({"id": payment["audit_id"]}, {"_id": 0})
    if not audit:
        raise HTTPException(404, "Audit not found")
    await _enrich_audit(audit)
    client_doc = None
    if audit.get("client_id"):
        client_doc = await db.clients.find_one({"id": audit["client_id"]}, {"_id": 0})
    proj_shape = _audit_to_project_shape(audit)
    # The receipt builder reads payment["project_code"]; map audit_code -> project_code
    payment_shape = {**payment, "project_id": payment["audit_id"], "project_code": payment["audit_code"]}
    pdf_bytes = await _build_receipt_pdf(payment_shape, proj_shape, client_doc)
    filename = f"receipt_{audit['audit_code']}_{payment_id[:8]}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---- Audit quote revisions ----
class AuditQuoteRevisionIn(BaseModel):
    new_amount: float
    reason: Optional[str] = ""


@api_router.get("/audits/{audit_id}/revisions")
async def list_audit_revisions(audit_id: str):
    items = await db.audit_quote_revisions.find({"audit_id": audit_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


@api_router.post("/audits/{audit_id}/revise-quote")
async def revise_audit_quote(audit_id: str, data: AuditQuoteRevisionIn):
    audit = await db.audits.find_one({"id": audit_id}, {"_id": 0})
    if not audit:
        raise HTTPException(404, "Audit not found")
    old_amount = float(audit.get("total_amount", 0) or 0)
    new_amount = float(data.new_amount)
    if new_amount < 0:
        raise HTTPException(400, "Amount must be >= 0")
    rev = {
        "id": _new_id(),
        "audit_id": audit_id,
        "audit_code": audit.get("audit_code", ""),
        "old_amount": old_amount,
        "new_amount": new_amount,
        "reason": data.reason or "",
        "created_at": _now(),
    }
    await db.audit_quote_revisions.insert_one(rev.copy())
    audit["total_amount"] = new_amount
    await _enrich_audit(audit)
    await db.audits.update_one(
        {"id": audit_id},
        {"$set": {
            "total_amount": new_amount,
            "outstanding_amount": audit["outstanding_amount"],
            "status": audit["status"],
        }},
    )
    await _log_audit_activity(
        audit_id, audit.get("audit_code", ""),
        "QUOTE REVISED",
        f"Old: Rs. {old_amount:,.2f} -> New: Rs. {new_amount:,.2f} | Reason: {data.reason or '-'}",
    )
    rev.pop("_id", None)
    return rev


# ---- Per-audit Excel export ----
@api_router.get("/audits/{audit_id}/export")
async def export_audit_excel(audit_id: str):
    audit = await db.audits.find_one({"id": audit_id}, {"_id": 0})
    if not audit:
        raise HTTPException(404, "Audit not found")
    await _enrich_audit(audit)
    payments = await db.audit_payments.find({"audit_id": audit_id}, {"_id": 0}).sort("payment_date", 1).to_list(5000)
    revisions = await db.audit_quote_revisions.find({"audit_id": audit_id}, {"_id": 0}).sort("created_at", 1).to_list(5000)
    activity = await db.activity_log.find({"audit_id": audit_id}, {"_id": 0}).sort("created_at", 1).to_list(5000)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Audit Info"
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="061A11")

    info_rows = [
        ("Audit ID", audit.get("audit_code", "")),
        ("Audit Offer", audit.get("audit_offer", "")),
        ("Report ID", audit.get("report_id", "")),
        ("Client", audit.get("client_name", "")),
        ("Current Total (INR)", audit.get("total_amount", 0)),
        ("Received (INR)", audit.get("received_amount", 0)),
        ("Outstanding (INR)", audit.get("outstanding_amount", 0)),
        ("Status", audit.get("status", "")),
        ("Notes", audit.get("notes", "")),
        ("Created", audit.get("created_at", "")),
    ]
    for label, value in info_rows:
        ws.append([label, value])
    for r in range(1, len(info_rows) + 1):
        ws.cell(row=r, column=1).font = Font(bold=True)
    ws.column_dimensions["A"].width = 22
    ws.column_dimensions["B"].width = 50

    ws2 = wb.create_sheet("Payments")
    ws2.append(["#", "Date", "Amount (INR)", "Notes"])
    for col in range(1, 5):
        c = ws2.cell(row=1, column=col)
        c.font = header_font
        c.fill = header_fill
    for i, p in enumerate(payments, 1):
        ws2.append([i, p.get("payment_date", ""), float(p.get("amount", 0)), p.get("notes", "")])

    ws3 = wb.create_sheet("Quote Revisions")
    ws3.append(["#", "Old Amount (INR)", "New Amount (INR)", "Reason", "Date"])
    for col in range(1, 6):
        c = ws3.cell(row=1, column=col)
        c.font = header_font
        c.fill = header_fill
    for i, r in enumerate(revisions, 1):
        ws3.append([i, float(r.get("old_amount", 0)), float(r.get("new_amount", 0)), r.get("reason", ""), r.get("created_at", "")])

    ws4 = wb.create_sheet("Activity")
    ws4.append(["#", "Action", "Detail", "Date"])
    for col in range(1, 5):
        c = ws4.cell(row=1, column=col)
        c.font = header_font
        c.fill = header_fill
    for i, a in enumerate(activity, 1):
        ws4.append([i, a.get("action", ""), a.get("detail", ""), a.get("created_at", "")])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"audit_{audit.get('audit_code', 'export')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------- OFFERS ----------------------
def _effective_offer_type(offer_type: str, custom_type: str) -> str:
    if offer_type and offer_type.lower() == "other":
        return (custom_type or "Other").strip()
    return (offer_type or "").strip()


async def _enrich_offer(o: dict) -> dict:
    if o.get("client_id"):
        c = await db.clients.find_one({"id": o["client_id"]}, {"_id": 0})
        o["client_name"] = (c.get("name") if c else "") or ""
        o["client_phone"] = (c.get("phone") if c else "") or ""
        o["client_email"] = (c.get("email") if c else "") or ""
    else:
        o["client_name"] = ""
        o["client_phone"] = ""
        o["client_email"] = ""
    o["base_amount"] = float(o.get("base_amount", 0) or 0)
    o["gst_percent"] = float(o.get("gst_percent", 18) or 0)
    o["gst_amount"] = round(o["base_amount"] * o["gst_percent"] / 100.0, 2)
    o["total_amount"] = round(o["base_amount"] + o["gst_amount"], 2)
    o["effective_type"] = _effective_offer_type(o.get("offer_type", ""), o.get("custom_type", ""))
    o["custom_type"] = o.get("custom_type", "") or ""
    o["file_path"] = o.get("file_path", "") or ""
    o["description"] = o.get("description", "") or ""
    o["site_location"] = o.get("site_location", "") or ""
    o["status"] = o.get("status") or "Pending"
    o["offer_date"] = o.get("offer_date") or ""
    o["reference_no"] = o.get("reference_no") or ""
    o["notes"] = o.get("notes") or ""
    # Editable PDF content fields — normalize types
    o["subject"] = o.get("subject", "") or ""
    o["scope_of_work"] = o.get("scope_of_work", "") or ""
    ps = o.get("payment_schedule")
    o["payment_schedule"] = ps if isinstance(ps, list) else []
    tcs = o.get("terms_conditions")
    o["terms_conditions"] = tcs if isinstance(tcs, list) else []
    o["bank_details"] = o.get("bank_details", "") or ""
    o["signature_name"] = o.get("signature_name", "") or ""
    o["company_header"] = o.get("company_header", "") or ""
    o["company_tagline"] = o.get("company_tagline", "") or ""
    o["company_address"] = o.get("company_address", "") or ""
    o["intro_paragraph"] = o.get("intro_paragraph", "") or ""
    return o


@api_router.get("/offers", response_model=List[Offer])
async def list_offers(status: Optional[str] = None, search: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    if search:
        s = search.strip()
        query["$or"] = [
            {"offer_code": {"$regex": s, "$options": "i"}},
            {"description": {"$regex": s, "$options": "i"}},
            {"client_name": {"$regex": s, "$options": "i"}},
            {"site_location": {"$regex": s, "$options": "i"}},
            {"reference_no": {"$regex": s, "$options": "i"}},
        ]
    items = await db.offers.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    for o in items:
        await _enrich_offer(o)
    return items


@api_router.get("/offers/{offer_id}", response_model=Offer)
async def get_offer(offer_id: str):
    o = await db.offers.find_one({"id": offer_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Offer not found")
    await _enrich_offer(o)
    return o


@api_router.post("/offers", response_model=Offer)
async def create_offer(data: OfferIn):
    doc = data.model_dump()
    doc["id"] = _new_id()
    doc["offer_code"] = await _next_offer_code()
    doc["created_at"] = _now()
    doc["linked_project_id"] = None
    doc["linked_project_code"] = ""
    await _enrich_offer(doc)
    await db.offers.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api_router.put("/offers/{offer_id}", response_model=Offer)
async def update_offer(offer_id: str, data: OfferIn):
    existing = await db.offers.find_one({"id": offer_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Offer not found")
    update = data.model_dump()
    existing.update(update)
    await _enrich_offer(existing)
    await db.offers.update_one({"id": offer_id}, {"$set": existing})
    # If this offer is already linked to a project, sync offer metadata on the project
    if existing.get("linked_project_id"):
        await db.projects.update_one(
            {"id": existing["linked_project_id"]},
            {"$set": {
                "offer_type": existing["effective_type"],
                "offer_file_path": existing.get("file_path", ""),
            }},
        )
    existing.pop("_id", None)
    return existing


@api_router.delete("/offers/{offer_id}")
async def delete_offer(offer_id: str):
    res = await db.offers.delete_one({"id": offer_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Offer not found")
    # Clear offer linkage on any project pointing to it
    await db.projects.update_many(
        {"offer_id": offer_id},
        {"$set": {"offer_id": None, "offer_code": "", "offer_type": "", "offer_file_path": ""}},
    )
    return {"ok": True}


@api_router.post("/offers/{offer_id}/convert-to-project", response_model=Project)
async def convert_offer_to_project(offer_id: str):
    offer = await db.offers.find_one({"id": offer_id}, {"_id": 0})
    if not offer:
        raise HTTPException(404, "Offer not found")
    if offer.get("linked_project_id"):
        raise HTTPException(400, f"Offer already converted to project {offer.get('linked_project_code', '')}")
    await _enrich_offer(offer)
    # Create a project from this offer
    project_doc = {
        "id": _new_id(),
        "project_code": await _next_project_code(),
        "name": offer.get("description") or f"{offer.get('effective_type', 'Project')} for {offer.get('client_name', '')}".strip(),
        "client_id": offer.get("client_id"),
        "architect_id": None,
        "site_location": offer.get("site_location", ""),
        "quoted_amount": float(offer.get("total_amount", 0) or 0),  # use GST-inclusive total
        "received_amount": 0.0,
        "status": "Outstanding",
        "notes": offer.get("notes", ""),
        "offer_id": offer["id"],
        "offer_code": offer["offer_code"],
        "offer_type": offer["effective_type"],
        "offer_file_path": offer.get("file_path", ""),
        "created_at": _now(),
    }
    await _enrich_project(project_doc)
    await db.projects.insert_one(project_doc.copy())
    # Mark offer as Accepted and linked
    await db.offers.update_one(
        {"id": offer_id},
        {"$set": {
            "status": "Accepted",
            "linked_project_id": project_doc["id"],
            "linked_project_code": project_doc["project_code"],
        }},
    )
    project_doc.pop("_id", None)
    return project_doc


# ---------------------- AUTH (single shared password) ----------------------
class PasswordVerifyIn(BaseModel):
    password: str


class PasswordSetIn(BaseModel):
    current_password: Optional[str] = None  # required if password already set
    new_password: str


def _hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


@api_router.get("/auth/status")
async def auth_status():
    doc = await db.auth_config.find_one({"_id": "auth_config"})
    return {"password_set": bool(doc and doc.get("password_hash"))}


@api_router.post("/auth/verify")
async def auth_verify(data: PasswordVerifyIn):
    doc = await db.auth_config.find_one({"_id": "auth_config"})
    if not doc or not doc.get("password_hash"):
        # No password set yet — open app
        return {"ok": True, "password_set": False}
    if not _verify_password(data.password, doc["password_hash"]):
        raise HTTPException(401, "Incorrect password")
    return {"ok": True, "password_set": True}


@api_router.post("/auth/set-password")
async def auth_set_password(data: PasswordSetIn):
    if not data.new_password or len(data.new_password) < 4:
        raise HTTPException(400, "New password must be at least 4 characters")
    existing = await db.auth_config.find_one({"_id": "auth_config"})
    if existing and existing.get("password_hash"):
        if not data.current_password or not _verify_password(data.current_password, existing["password_hash"]):
            raise HTTPException(401, "Current password is incorrect")
    new_hash = _hash_password(data.new_password)
    await db.auth_config.update_one(
        {"_id": "auth_config"},
        {"$set": {"password_hash": new_hash, "updated_at": _now()}},
        upsert=True,
    )
    return {"ok": True}


# ---------------------- OFFER PDF GENERATION ----------------------
async def _build_offer_pdf(offer: dict, client_doc: Optional[dict]) -> bytes:
    """Generate Creator RCC Consultant LLP branded offer PDF.
    All content is editable per-offer with sensible defaults."""
    # Defaults
    DEFAULT_HEADER = "CREATOR RCC CONSULTANT LLP"
    DEFAULT_TAGLINE = "Leading Project Management Consultant  |  Structural Engineer"
    DEFAULT_ADDRESS = "A-001, Siddhivinayak Park, Sector 8A, Plot No. 21, Airoli, Navi Mumbai - 400 708  |  Ph: 9987076241  |  project@creatorconsultant.net"
    DEFAULT_INTRO = (
        "We, Creator RCC Consultant LLP, are a leading structural engineering and project management "
        "consultancy authorized by BMC, NMMC and TMC. We thank you for the opportunity and are pleased "
        "to submit our offer for the captioned work as detailed below."
    )
    DEFAULT_BANK = "BANK DETAILS  |  Kotak Bank  |  A/C: Creator RCC Consultant LLP  |  A/C No: 9987076241  |  IFSC: KKBK0001360  |  Branch: Airoli, Sector 6"
    DEFAULT_SIG = "Mr. Rutvij Patel — Consulting Structural Engineer"
    DEFAULT_TCS = [
        "Taxes (GST and any other applicable levies) to be paid by the Client.",
        "Any drill-holes / chipping and their filling during testing are the responsibility of the Owner.",
        "Scope excludes any additional tests/phases not listed above; these will be charged extra by mutual agreement.",
        "Payments to be made in favour of 'CREATOR RCC CONSULTANT LLP'.",
    ]

    company_header = offer.get("company_header") or DEFAULT_HEADER
    company_tagline = offer.get("company_tagline") or DEFAULT_TAGLINE
    company_address = offer.get("company_address") or DEFAULT_ADDRESS
    intro_paragraph = offer.get("intro_paragraph") or DEFAULT_INTRO
    bank_details = offer.get("bank_details") or DEFAULT_BANK
    signature_name = offer.get("signature_name") or DEFAULT_SIG
    tcs = offer.get("terms_conditions") or DEFAULT_TCS

    base = float(offer.get("base_amount", 0) or 0)
    gst_pct = float(offer.get("gst_percent", 18) or 0)
    gst_amt = round(base * gst_pct / 100.0, 2)
    grand = round(base + gst_amt, 2)

    # Payment schedule (fallback: 50/50)
    schedule = offer.get("payment_schedule") or []
    if not schedule:
        schedule = [
            {"label": "Advance on confirmation / appointment letter", "percent": 50.0},
            {"label": "On completion of final work / submission of report", "percent": 50.0},
        ]

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=10, leading=14, fontName="Helvetica")

    # Header band
    c.setFillColor(BRAND_GREEN)
    c.rect(0, height - 32 * mm, width, 32 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 18)
    c.drawString(18 * mm, height - 15 * mm, company_header[:60])
    c.setFillColor(BRAND_ACCENT)
    c.setFont("Helvetica", 9)
    c.drawString(18 * mm, height - 21 * mm, company_tagline[:110])
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 8)
    c.drawString(18 * mm, height - 27 * mm, company_address[:160])

    # Reference / date
    y = height - 40 * mm
    c.setFillColor(BRAND_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(18 * mm, y, "REF. NO.")
    c.drawRightString(width - 18 * mm, y, "DATE")
    y -= 5 * mm
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(18 * mm, y, offer.get("reference_no") or offer.get("offer_code", ""))
    odate = offer.get("offer_date") or ""
    try:
        dfmt = datetime.fromisoformat(odate.replace("Z", "+00:00")).strftime("%d-%m-%Y") if odate else datetime.now().strftime("%d-%m-%Y")
    except Exception:
        dfmt = datetime.now().strftime("%d-%m-%Y")
    c.drawRightString(width - 18 * mm, y, dfmt)

    # To
    y -= 12 * mm
    c.setFillColor(BRAND_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(18 * mm, y, "TO,")
    y -= 5 * mm
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(18 * mm, y, (client_doc or {}).get("name") or offer.get("client_name") or "Client Name")
    c.setFont("Helvetica", 10)
    if client_doc and client_doc.get("company"):
        y -= 5 * mm
        c.drawString(18 * mm, y, client_doc["company"])
    if client_doc and client_doc.get("address"):
        y -= 5 * mm
        c.drawString(18 * mm, y, client_doc["address"][:90])
    if offer.get("site_location"):
        y -= 5 * mm
        c.setFillColor(BRAND_MUTED)
        c.drawString(18 * mm, y, f"Site: {offer['site_location'][:90]}")
        c.setFillColor(colors.black)

    # Subject
    y -= 10 * mm
    c.setFillColor(BRAND_GREEN)
    c.setFont("Helvetica-Bold", 11)
    subject_override = (offer.get("subject") or "").strip()
    subject = subject_override or f"SUBJECT: Proposal for {offer.get('effective_type', '')} — {offer.get('description', '')[:80]}".strip().rstrip(" —")
    if not subject.upper().startswith("SUBJECT"):
        subject = "SUBJECT: " + subject
    c.drawString(18 * mm, y, subject[:110])
    c.setFillColor(colors.black)

    # Intro
    y -= 9 * mm
    p = Paragraph(intro_paragraph, body_style)
    w_para, h_para = p.wrap(width - 36 * mm, 40 * mm)
    p.drawOn(c, 18 * mm, y - h_para)
    y -= h_para + 6 * mm

    # Scope
    c.setFillColor(BRAND_GREEN)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(18 * mm, y, "SCOPE OF WORK")
    c.setStrokeColor(BRAND_GREEN)
    c.line(18 * mm, y - 1.5 * mm, width - 18 * mm, y - 1.5 * mm)
    y -= 8 * mm

    scope_text = (offer.get("scope_of_work") or "").strip()
    if not scope_text:
        scope_text = offer.get("description") or f"{offer.get('effective_type', '')} consultancy services as per industry standard practices."
        if offer.get("notes"):
            scope_text += f"\n\nInclusions / Methodology: {offer['notes']}"
    p = Paragraph(scope_text.replace("\n", "<br/>"), body_style)
    w_para, h_para = p.wrap(width - 36 * mm, 80 * mm)
    p.drawOn(c, 18 * mm, y - h_para)
    y -= h_para + 8 * mm
    c.setFillColor(colors.black)

    # Fees
    c.setFillColor(BRAND_GREEN)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(18 * mm, y, "PROFESSIONAL FEES")
    c.line(18 * mm, y - 1.5 * mm, width - 18 * mm, y - 1.5 * mm)
    y -= 6 * mm

    c.setFillColor(BRAND_GREEN)
    c.rect(18 * mm, y - 7 * mm, width - 36 * mm, 7 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(22 * mm, y - 5 * mm, "DESCRIPTION")
    c.drawRightString(width - 22 * mm, y - 5 * mm, "AMOUNT (INR)")
    y -= 7 * mm

    def _row(label, amount, bold=False, highlight=False):
        nonlocal y
        y -= 7 * mm
        if highlight:
            c.setFillColor(BRAND_GREEN)
            c.rect(18 * mm, y - 1 * mm, width - 36 * mm, 7 * mm, fill=1, stroke=0)
            c.setFillColor(colors.white)
        else:
            c.setFillColor(colors.black)
        c.setFont("Helvetica-Bold" if bold else "Helvetica", 10)
        c.drawString(22 * mm, y + 1.5 * mm, label[:75])
        c.drawRightString(width - 22 * mm, y + 1.5 * mm, f"Rs. {_format_inr(amount)}")
        c.setFillColor(colors.black)

    _row(f"{offer.get('effective_type', 'Consultancy')} charges as per scope above", base)
    _row(f"GST @ {gst_pct:.0f}%", gst_amt)
    _row("GRAND TOTAL (Inclusive of GST)", grand, bold=True, highlight=True)

    y -= 12 * mm

    # Payment Terms (editable list)
    c.setFillColor(BRAND_GREEN)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(18 * mm, y, "PAYMENT TERMS")
    c.line(18 * mm, y - 1.5 * mm, width - 18 * mm, y - 1.5 * mm)
    y -= 6 * mm
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    for entry in schedule:
        label = str(entry.get("label", "")).strip() or "—"
        pct = float(entry.get("percent", 0) or 0)
        amt = round(grand * pct / 100.0, 2)
        y -= 5 * mm
        c.drawString(20 * mm, y, f"• {pct:g}% {label}:  Rs. {_format_inr(amt)}")

    # T&C
    y -= 10 * mm
    c.setFillColor(BRAND_GREEN)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(18 * mm, y, "TERMS & CONDITIONS")
    c.line(18 * mm, y - 1.5 * mm, width - 18 * mm, y - 1.5 * mm)
    y -= 6 * mm
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 9)
    for t in tcs:
        y -= 5 * mm
        c.drawString(20 * mm, y, f"• {str(t)[:130]}")

    # Bank details
    y -= 10 * mm
    c.setFillColor(BRAND_GREEN)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(18 * mm, y, bank_details[:180])
    c.setFillColor(colors.black)

    # Signature
    c.setStrokeColor(BRAND_MUTED)
    c.line(width - 70 * mm, 30 * mm, width - 20 * mm, 30 * mm)
    c.setFillColor(BRAND_GREEN)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(width - 70 * mm, 35 * mm, "For Creator RCC Consultant LLP")
    c.setFillColor(BRAND_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(width - 70 * mm, 26 * mm, "Authorised Signatory")
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(width - 70 * mm, 22 * mm, signature_name[:60])

    _draw_footer(c)
    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()


@api_router.get("/offers/{offer_id}/pdf")
async def offer_pdf(offer_id: str):
    offer = await db.offers.find_one({"id": offer_id}, {"_id": 0})
    if not offer:
        raise HTTPException(404, "Offer not found")
    await _enrich_offer(offer)
    client_doc = None
    if offer.get("client_id"):
        client_doc = await db.clients.find_one({"id": offer["client_id"]}, {"_id": 0})
    pdf_bytes = await _build_offer_pdf(offer, client_doc)
    filename = f"offer_{offer['offer_code']}_{(offer.get('effective_type') or 'proposal').replace(' ', '_')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------- DASHBOARD ----------------------

@api_router.get("/dashboard/stats")
async def dashboard_stats():
    _deny_engineer()
    # Lightweight projection: we only need amounts + status for totals (no client/architect joins needed)
    projects = await db.projects.find(
        {},
        {"_id": 0, "quoted_amount": 1, "received_amount": 1, "status": 1},
    ).to_list(10000)
    total_quoted = 0.0
    total_received = 0.0
    outstanding_count = 0
    settled_count = 0
    for p in projects:
        q = float(p.get("quoted_amount", 0) or 0)
        r = float(p.get("received_amount", 0) or 0)
        total_quoted += q
        total_received += r
        # Derive effective status (same logic as _enrich_project)
        effective_status = "Settled" if (q > 0 and (q - r) <= 0) else (p.get("status") or "Outstanding")
        if effective_status == "Settled":
            settled_count += 1
        else:
            outstanding_count += 1
    return {
        "total_projects": len(projects),
        "total_clients": await db.clients.count_documents({}),
        "total_architects": await db.architects.count_documents({}),
        "total_offers": await db.offers.count_documents({}),
        "pending_offers": await db.offers.count_documents({"status": "Pending"}),
        "total_quoted": round(total_quoted, 2),
        "total_received": round(total_received, 2),
        "total_outstanding": round(total_quoted - total_received, 2),
        "outstanding_count": outstanding_count,
        "settled_count": settled_count,
    }


@api_router.get("/dashboard/monthly-revenue")
async def dashboard_monthly_revenue(months: int = 12):
    _deny_engineer()
    """Aggregate received payments (projects + audits) per month for the last `months` months."""
    months = max(1, min(int(months or 12), 36))
    from collections import OrderedDict
    now = datetime.now(timezone.utc)
    # Build 'YYYY-MM' buckets in chronological order
    buckets: "OrderedDict[str, dict]" = OrderedDict()
    year, month = now.year, now.month
    keys = []
    for _ in range(months):
        keys.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    for k in reversed(keys):
        buckets[k] = {"month": k, "project_amount": 0.0, "audit_amount": 0.0, "total": 0.0, "count": 0}

    def add(date_str: Optional[str], amount: float, kind: str):
        if not date_str:
            return
        try:
            # date_str is ISO string with tz "Z" or "+00:00"
            d = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
        except Exception:
            return
        k = f"{d.year:04d}-{d.month:02d}"
        if k not in buckets:
            return
        b = buckets[k]
        b[kind] += float(amount or 0)
        b["total"] = round(b["project_amount"] + b["audit_amount"], 2)
        b["count"] += 1

    project_pays = await db.payments.find({}, {"_id": 0, "amount": 1, "payment_date": 1}).to_list(100000)
    for p in project_pays:
        add(p.get("payment_date"), p.get("amount", 0), "project_amount")

    audit_pays = await db.audit_payments.find({}, {"_id": 0, "amount": 1, "payment_date": 1}).to_list(100000)
    for p in audit_pays:
        add(p.get("payment_date"), p.get("amount", 0), "audit_amount")

    rows = list(buckets.values())
    return {"months": rows, "total_received": round(sum(r["total"] for r in rows), 2)}


@api_router.get("/dashboard/site-visit-stats")
async def dashboard_site_visit_stats(days: int = 7):
    """Counts of site visits in the trailing `days` window, split by status, plus per-engineer breakdown.
    Used by the Projects dashboard 'Pending site visits this week' KPI card."""
    days = max(1, min(int(days) if days is not None else 7, 90))
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    q = {"created_at": {"$gte": cutoff}}
    rows = await db.site_visits.find(q, {"_id": 0, "id": 1, "visit_code": 1, "status": 1, "created_by_user_id": 1, "created_by_username": 1, "engineer_name": 1, "inspection_title": 1, "visit_date": 1, "project_code": 1}).sort("created_at", -1).to_list(2000)

    draft = sum(1 for r in rows if (r.get("status") or "").lower() == "draft")
    submitted = sum(1 for r in rows if (r.get("status") or "").lower() == "submitted")

    by_engineer: dict = {}
    for r in rows:
        name = r.get("engineer_name") or r.get("created_by_username") or "—"
        agg = by_engineer.setdefault(name, {"name": name, "draft": 0, "submitted": 0, "total": 0})
        s = (r.get("status") or "").lower()
        if s == "draft":
            agg["draft"] += 1
        elif s == "submitted":
            agg["submitted"] += 1
        agg["total"] += 1

    return {
        "days": days,
        "total": len(rows),
        "draft": draft,
        "submitted": submitted,
        "by_engineer": sorted(by_engineer.values(), key=lambda x: -x["total"])[:10],
        "recent_drafts": [r for r in rows if (r.get("status") or "").lower() == "draft"][:5],
    }


@api_router.get("/dashboard/my-sv-weekly")
async def dashboard_my_sv_weekly(month: Optional[str] = None, engineer_id: Optional[str] = None):
    """Per-user weekly site-visit counts for the given month (YYYY-MM, defaults to current month).
    Returns 5 buckets W1..W5 with draft+submitted counts. Engineers are auto-scoped to themselves;
    admins can pass ?engineer_id= to inspect anyone (omit for 'me')."""
    user = get_current_user_safe() or {}
    if not user.get("id"):
        raise HTTPException(401, "Not authenticated")

    target_id = user["id"]
    if engineer_id and user.get("role") == "admin":
        target_id = engineer_id

    now = datetime.now(timezone.utc)
    month_str = month or f"{now.year:04d}-{now.month:02d}"
    try:
        y, m = map(int, month_str.split("-"))
    except Exception:
        raise HTTPException(400, "month must be YYYY-MM")

    # Pull all visits this user created whose visit_date starts with the requested month
    rows = await db.site_visits.find(
        {"created_by_user_id": target_id},
        {"_id": 0, "visit_date": 0 if False else 1, "status": 1, "id": 1, "project_id": 1, "project_code": 1, "created_at": 1},
    ).to_list(2000)

    # Bucket by ISO-day-of-month / 7 (W1 = days 1-7, W2 = 8-14, ...)
    buckets = [{"week": f"W{i+1}", "draft": 0, "submitted": 0, "total": 0} for i in range(5)]
    by_project: dict = {}
    for r in rows:
        d_str = (r.get("visit_date") or r.get("created_at") or "")[:10]
        if not d_str.startswith(month_str):
            continue
        try:
            day = int(d_str.split("-")[2])
        except Exception:
            continue
        idx = min(4, max(0, (day - 1) // 7))
        s = (r.get("status") or "").lower()
        if s == "draft":
            buckets[idx]["draft"] += 1
        elif s == "submitted":
            buckets[idx]["submitted"] += 1
        buckets[idx]["total"] += 1
        # Per-project tally
        pcode = r.get("project_code") or "—"
        agg = by_project.setdefault(pcode, {"project_code": pcode, "count": 0})
        agg["count"] += 1

    return {
        "month": month_str,
        "target_user_id": target_id,
        "weeks": buckets,
        "by_project": sorted(by_project.values(), key=lambda x: -x["count"])[:8],
        "total": sum(b["total"] for b in buckets),
    }


@api_router.get("/users/{user_id}/activity")
async def user_activity_feed(user_id: str, limit: int = 100):
    """All activity_log events created by user_id, plus the user's own site visits.
    Used by the per-engineer activity feed in Settings."""
    limit = max(1, min(int(limit) if limit is not None else 100, 500))

    log_rows = await db.activity_log.find(
        {"user_id": user_id},
        {"_id": 0},
    ).sort("created_at", -1).to_list(limit)

    # Enrich with the visit_code / project_code / audit_code if missing
    for r in log_rows:
        if r.get("site_visit_id") and not r.get("site_visit_code"):
            sv = await db.site_visits.find_one({"id": r["site_visit_id"]}, {"_id": 0, "visit_code": 1})
            if sv:
                r["site_visit_code"] = sv.get("visit_code", "")
        if r.get("project_id") and not r.get("project_code"):
            p = await db.projects.find_one({"id": r["project_id"]}, {"_id": 0, "project_code": 1})
            if p:
                r["project_code"] = p.get("project_code", "")
        if r.get("audit_id") and not r.get("audit_code"):
            a = await db.audits.find_one({"id": r["audit_id"]}, {"_id": 0, "audit_code": 1})
            if a:
                r["audit_code"] = a.get("audit_code", "")

    # Also include their own site visits as a separate stream for quick scanning
    visits = await db.site_visits.find(
        {"created_by_user_id": user_id},
        {"_id": 0, "id": 1, "visit_code": 1, "inspection_title": 1, "status": 1, "visit_date": 1, "project_code": 1, "project_name": 1, "created_at": 1},
    ).sort("created_at", -1).to_list(limit)

    return {"activity": log_rows, "visits": visits}



# ---------------------- EXPORT / IMPORT ----------------------
@api_router.get("/export/excel")
async def export_excel():
    projects = await db.projects.find({}, {"_id": 0}).sort("project_code", 1).to_list(10000)
    await _enrich_projects_batch(projects)

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Projects"
    headers = [
        "Project ID", "Project Name", "Client", "Architect", "Site Location",
        "Quoted (INR)", "Received (INR)", "Outstanding (INR)", "Status", "Notes",
    ]
    ws.append(headers)
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="061A11")
    for col in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")

    for p in projects:
        ws.append([
            p.get("project_code", ""),
            p.get("name", ""),
            p.get("client_name", ""),
            p.get("architect_name", ""),
            p.get("site_location", ""),
            p.get("quoted_amount", 0),
            p.get("received_amount", 0),
            p.get("outstanding_amount", 0),
            p.get("status", ""),
            p.get("notes", ""),
        ])

    # Auto width
    for col_idx, col in enumerate(ws.columns, 1):
        max_len = max((len(str(c.value)) for c in col if c.value is not None), default=10)
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = min(max_len + 4, 40)

    # Clients sheet
    ws2 = wb.create_sheet("Clients")
    ws2.append(["Name", "Phone", "Email", "Company", "Address"])
    for col in range(1, 6):
        c = ws2.cell(row=1, column=col)
        c.font = header_font
        c.fill = header_fill
    clients = await db.clients.find({}, {"_id": 0}).to_list(5000)
    for c in clients:
        ws2.append([c.get("name", ""), c.get("phone", ""), c.get("email", ""), c.get("company", ""), c.get("address", "")])

    # Architects sheet
    ws3 = wb.create_sheet("Architects")
    ws3.append(["Name", "Phone", "Email", "Firm"])
    for col in range(1, 5):
        c = ws3.cell(row=1, column=col)
        c.font = header_font
        c.fill = header_fill
    architects = await db.architects.find({}, {"_id": 0}).to_list(5000)
    for a in architects:
        ws3.append([a.get("name", ""), a.get("phone", ""), a.get("email", ""), a.get("firm", "")])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"creator_consultant_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@api_router.post("/import/excel")
async def import_excel(file: UploadFile = File(...)):
    content = await file.read()
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    except Exception as e:
        raise HTTPException(400, f"Invalid Excel file: {e}")

    imported = {"projects": 0, "clients": 0, "architects": 0}

    # Clients
    if "Clients" in wb.sheetnames:
        ws = wb["Clients"]
        rows = list(ws.iter_rows(values_only=True))
        for row in rows[1:]:
            if not row or not row[0]:
                continue
            name = str(row[0]).strip()
            existing = await db.clients.find_one({"name": name}, {"_id": 0})
            if existing:
                continue
            doc = {
                "id": _new_id(),
                "name": name,
                "phone": str(row[1]) if len(row) > 1 and row[1] else "",
                "email": str(row[2]) if len(row) > 2 and row[2] else "",
                "company": str(row[3]) if len(row) > 3 and row[3] else "",
                "address": str(row[4]) if len(row) > 4 and row[4] else "",
                "created_at": _now(),
            }
            await db.clients.insert_one(doc)
            imported["clients"] += 1

    # Architects
    if "Architects" in wb.sheetnames:
        ws = wb["Architects"]
        rows = list(ws.iter_rows(values_only=True))
        for row in rows[1:]:
            if not row or not row[0]:
                continue
            name = str(row[0]).strip()
            existing = await db.architects.find_one({"name": name}, {"_id": 0})
            if existing:
                continue
            doc = {
                "id": _new_id(),
                "name": name,
                "phone": str(row[1]) if len(row) > 1 and row[1] else "",
                "email": str(row[2]) if len(row) > 2 and row[2] else "",
                "firm": str(row[3]) if len(row) > 3 and row[3] else "",
                "created_at": _now(),
            }
            await db.architects.insert_one(doc)
            imported["architects"] += 1

    # Projects — from first sheet or "Projects" sheet
    proj_sheet_name = "Projects" if "Projects" in wb.sheetnames else wb.sheetnames[0]
    ws = wb[proj_sheet_name]
    rows = list(ws.iter_rows(values_only=True))
    for row in rows[1:]:
        if not row or not row[1]:  # needs a name at least
            continue
        project_code = str(row[0]).strip() if row[0] else await _next_project_code()
        # Skip if already exists
        if await db.projects.find_one({"project_code": project_code}):
            continue

        client_name = str(row[2]).strip() if len(row) > 2 and row[2] else ""
        architect_name = str(row[3]).strip() if len(row) > 3 and row[3] else ""

        # Resolve/create client and architect
        client_id = None
        if client_name and client_name.lower() != "none":
            c = await db.clients.find_one({"name": client_name}, {"_id": 0})
            if not c:
                c = {"id": _new_id(), "name": client_name, "phone": "", "email": "", "company": "", "address": "", "created_at": _now()}
                await db.clients.insert_one(c.copy())
                imported["clients"] += 1
            client_id = c["id"]

        architect_id = None
        if architect_name and architect_name.lower() != "none":
            a = await db.architects.find_one({"name": architect_name}, {"_id": 0})
            if not a:
                a = {"id": _new_id(), "name": architect_name, "phone": "", "email": "", "firm": "", "created_at": _now()}
                await db.architects.insert_one(a.copy())
                imported["architects"] += 1
            architect_id = a["id"]

        def _num(v):
            try:
                return float(v) if v is not None and v != "" else 0.0
            except Exception:
                return 0.0

        quoted = _num(row[5] if len(row) > 5 else 0)
        received = _num(row[6] if len(row) > 6 else 0)
        status = str(row[8]).strip() if len(row) > 8 and row[8] else "Outstanding"
        notes = str(row[9]) if len(row) > 9 and row[9] else ""

        doc = {
            "id": _new_id(),
            "project_code": project_code,
            "name": str(row[1]).strip(),
            "client_id": client_id,
            "client_name": client_name,
            "architect_id": architect_id,
            "architect_name": architect_name,
            "site_location": str(row[4]) if len(row) > 4 and row[4] else "",
            "quoted_amount": quoted,
            "received_amount": received,
            "outstanding_amount": round(quoted - received, 2),
            "status": "Settled" if (quoted > 0 and received >= quoted) else (status or "Outstanding"),
            "notes": notes,
            "created_at": _now(),
        }
        await db.projects.insert_one(doc)
        imported["projects"] += 1

    return {"ok": True, "imported": imported}


@api_router.post("/import/sqlite")
async def import_sqlite(file: UploadFile = File(...), replace: bool = False):
    """Import data from an uploaded SQLite .db file (creator_consultant legacy format).
    Expects tables: clients(id, name), architects(id, name), projects(id, project_id, project_name,
    client_name, architect_name, site_location, quoted_amount, created_at), payments(id, project_id, amount, note, paid_at).
    If replace=True, clears existing data first.
    """
    import sqlite3
    import tempfile

    content = await file.read()
    if not content[:16].startswith(b"SQLite"):
        raise HTTPException(400, "Uploaded file is not a valid SQLite database")

    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tf:
        tf.write(content)
        tmp_path = tf.name
    try:
        if replace:
            await db.projects.delete_many({})
            await db.clients.delete_many({})
            await db.architects.delete_many({})
            await db.payments.delete_many({})
            await db.counters.delete_many({})

        conn = sqlite3.connect(tmp_path)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        def _parse_dt(s):
            if not s:
                return _now()
            try:
                return datetime.strptime(s, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc).isoformat()
            except Exception:
                return _now()

        imported = {"clients": 0, "architects": 0, "projects": 0, "payments": 0}

        # Clients (dedupe by name, keep existing)
        client_by_name = {}
        existing_clients = await db.clients.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(10000)
        for ec in existing_clients:
            client_by_name[ec["name"].strip().lower()] = ec["id"]
        try:
            cur.execute("SELECT name FROM clients")
            for r in cur.fetchall():
                nm = (r["name"] or "").strip()
                if not nm or nm.lower() == "none":
                    continue
                key = nm.lower()
                if key in client_by_name:
                    continue
                cid = _new_id()
                await db.clients.insert_one({
                    "id": cid, "name": nm, "phone": "", "email": "",
                    "company": "", "address": "", "created_at": _now(),
                })
                client_by_name[key] = cid
                imported["clients"] += 1
        except sqlite3.Error:
            pass

        # Architects
        arch_by_name = {}
        existing_arch = await db.architects.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(10000)
        for ea in existing_arch:
            arch_by_name[ea["name"].strip().lower()] = ea["id"]
        try:
            cur.execute("SELECT name FROM architects")
            for r in cur.fetchall():
                nm = (r["name"] or "").strip()
                if not nm or nm.lower() == "none":
                    continue
                key = nm.lower()
                if key in arch_by_name:
                    continue
                aid = _new_id()
                await db.architects.insert_one({
                    "id": aid, "name": nm, "phone": "", "email": "", "firm": "",
                    "created_at": _now(),
                })
                arch_by_name[key] = aid
                imported["architects"] += 1
        except sqlite3.Error:
            pass

        # Projects
        projects_by_code = {}
        existing_codes = {p["project_code"] async for p in db.projects.find({}, {"_id": 0, "project_code": 1})}
        max_seq = 0
        for code in existing_codes:
            try:
                s = int(str(code).split("-")[-1])
                if s > max_seq:
                    max_seq = s
            except Exception:
                pass
        try:
            cur.execute("SELECT * FROM projects ORDER BY id")
            for p in cur.fetchall():
                code = p["project_id"] or f"CC-{p['id']:04d}"
                if code in existing_codes:
                    projects_by_code[code] = None
                    continue
                try:
                    s = int(str(code).split("-")[-1])
                    if s > max_seq:
                        max_seq = s
                except Exception:
                    pass
                cl_name = (p["client_name"] or "").strip()
                ar_name = (p["architect_name"] or "").strip()
                pid = _new_id()
                doc = {
                    "id": pid,
                    "project_code": code,
                    "name": (p["project_name"] or "").strip() or "Untitled",
                    "client_id": client_by_name.get(cl_name.lower()),
                    "client_name": cl_name if cl_name.lower() != "none" else "",
                    "architect_id": arch_by_name.get(ar_name.lower()),
                    "architect_name": ar_name if ar_name.lower() != "none" else "",
                    "site_location": (p["site_location"] or "").strip(),
                    "quoted_amount": float(p["quoted_amount"] or 0),
                    "received_amount": 0.0,
                    "outstanding_amount": 0.0,
                    "status": "Outstanding",
                    "notes": "",
                    "archived": False,
                    "offer_id": None, "offer_code": "", "offer_type": "", "offer_file_path": "",
                    "created_at": _parse_dt(p["created_at"]),
                }
                await db.projects.insert_one(doc)
                projects_by_code[code] = pid
                imported["projects"] += 1
        except sqlite3.Error as e:
            raise HTTPException(400, f"Projects import failed: {e}")

        # Payments
        received_by_code = {}
        try:
            cur.execute("SELECT * FROM payments ORDER BY id")
            for pay in cur.fetchall():
                code = pay["project_id"]
                pid = projects_by_code.get(code)
                if not pid:
                    # project might exist from earlier — look up by code
                    existing = await db.projects.find_one({"project_code": code}, {"_id": 0, "id": 1})
                    if not existing:
                        continue
                    pid = existing["id"]
                amt = float(pay["amount"] or 0)
                if amt <= 0:
                    continue
                await db.payments.insert_one({
                    "id": _new_id(),
                    "project_id": pid,
                    "project_code": code,
                    "amount": amt,
                    "payment_date": _parse_dt(pay["paid_at"]),
                    "notes": (pay["note"] or "").strip(),
                    "created_at": _parse_dt(pay["paid_at"]),
                })
                received_by_code[code] = received_by_code.get(code, 0) + amt
                imported["payments"] += 1
        except sqlite3.Error:
            pass

        # Update totals on projects
        for code, tot in received_by_code.items():
            proj = await db.projects.find_one({"project_code": code}, {"_id": 0})
            if not proj:
                continue
            q = float(proj.get("quoted_amount", 0) or 0)
            new_received = float(proj.get("received_amount", 0) or 0) + tot
            out = round(q - new_received, 2)
            status = "Settled" if (q > 0 and out <= 0) else "Outstanding"
            await db.projects.update_one(
                {"project_code": code},
                {"$set": {"received_amount": new_received, "outstanding_amount": out, "status": status}},
            )

        # Update counter
        await db.counters.update_one(
            {"_id": "project_code"}, {"$max": {"seq": max_seq}}, upsert=True
        )
        conn.close()
        return {"ok": True, "imported": imported}
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


# ---------------------- SEED ----------------------
@api_router.post("/seed")
async def seed_demo():
    """Populate demo data if DB is empty."""
    if await db.projects.count_documents({}) > 0:
        return {"ok": True, "seeded": False, "message": "Data already exists"}

    # Clients
    clients_data = [
        {"name": "M/S. Kian Dines Pvt. Ltd.", "phone": "+91 98200 11111", "email": "info@kiandines.com", "company": "Kian Dines Pvt. Ltd.", "address": "Rabale MIDC, Navi Mumbai"},
        {"name": "Mrs. Husna Ara Sayed", "phone": "+91 98765 43210", "email": "husna.sayed@example.com", "company": "", "address": "Karanja Road, Rajapal Naka"},
        {"name": "Rohan Enterprises", "phone": "+91 90000 22222", "email": "contact@rohanent.in", "company": "Rohan Enterprises", "address": "Ambernath MIDC"},
        {"name": "Sunrise Developers", "phone": "+91 91234 56789", "email": "sales@sunrisedev.in", "company": "Sunrise Developers LLP", "address": "Novo Rabale MIDC"},
    ]
    client_ids = []
    for c in clients_data:
        doc = {**c, "id": _new_id(), "created_at": _now()}
        await db.clients.insert_one(doc.copy())
        client_ids.append(doc["id"])

    # Architects
    architects_data = [
        {"name": "Tanay Mehta", "phone": "+91 99999 00001", "email": "tanay@mehtaarch.in", "firm": "Mehta & Associates"},
        {"name": "Tstg Architect", "phone": "+91 88888 00002", "email": "studio@tstg.in", "firm": "TSTG Studio"},
        {"name": "Priya Shah", "phone": "+91 77777 00003", "email": "priya@shahdesigns.in", "firm": "Shah Designs"},
    ]
    arch_ids = []
    for a in architects_data:
        doc = {**a, "id": _new_id(), "created_at": _now()}
        await db.architects.insert_one(doc.copy())
        arch_ids.append(doc["id"])

    # Projects
    projects_data = [
        {"name": "Acceptance & Supervision", "client_id": client_ids[0], "architect_id": arch_ids[1], "site_location": "Plot No - Pap R 641 Rabale Midc, Navi Mumbai", "quoted_amount": 125000, "received_amount": 50000, "status": "Outstanding", "notes": "Phase 1 supervision"},
        {"name": "Residential Plan 3269", "client_id": client_ids[2], "architect_id": arch_ids[0], "site_location": "Plot No. RTC-91, Ambernath", "quoted_amount": 85000, "received_amount": 85000, "status": "Settled", "notes": ""},
        {"name": "Industrial Shed M-85", "client_id": client_ids[2], "architect_id": arch_ids[0], "site_location": "Plot No. M-85, Ambernath MIDC", "quoted_amount": 210000, "received_amount": 210000, "status": "Settled", "notes": "Full payment received"},
        {"name": "Commercial Design 3241", "client_id": client_ids[3], "architect_id": arch_ids[0], "site_location": "Plot No - Pap - 73 Ambernath Midc", "quoted_amount": 175000, "received_amount": 75000, "status": "Outstanding", "notes": ""},
        {"name": "Acceptance & Supervision (Karanja)", "client_id": client_ids[1], "architect_id": arch_ids[1], "site_location": "Cts No - 959+959/1, House No - 92, Karanja Road, Rajapal Naka", "quoted_amount": 95000, "received_amount": 95000, "status": "Settled", "notes": ""},
        {"name": "Novo Rabale Project 3240", "client_id": client_ids[3], "architect_id": arch_ids[0], "site_location": "Plot No - 374 Novo Rabale Midc", "quoted_amount": 150000, "received_amount": 0, "status": "Outstanding", "notes": "Kickoff pending"},
        {"name": "Villa Renovation", "client_id": client_ids[1], "architect_id": arch_ids[2], "site_location": "Bandra West, Mumbai", "quoted_amount": 320000, "received_amount": 120000, "status": "Outstanding", "notes": ""},
    ]
    for p in projects_data:
        code = await _next_project_code()
        doc = {
            "id": _new_id(),
            "project_code": code,
            "name": p["name"],
            "client_id": p["client_id"],
            "architect_id": p["architect_id"],
            "site_location": p["site_location"],
            "quoted_amount": float(p["quoted_amount"]),
            "received_amount": float(p["received_amount"]),
            "status": p["status"],
            "notes": p.get("notes", ""),
            "created_at": _now(),
        }
        await _enrich_project(doc)
        await db.projects.insert_one(doc.copy())

    # Offers (sample pending + accepted)
    offers_data = [
        {
            "offer_type": "Audit", "custom_type": "",
            "client_id": client_ids[1],
            "description": "RCC-Basic-Audit of Row House",
            "site_location": "Plot 44, Sector 4, Koparkhairane, Navi Mumbai",
            "base_amount": 28000, "gst_percent": 18.0,
            "file_path": "D:\\CreatorConsultant\\Offers\\2026\\STR-AUDIT-2026-023.pdf",
            "status": "Pending",
            "reference_no": "STR/AUDIT/2026/023",
            "offer_date": _now(),
            "notes": "Half cell + Rebound Hammer + Carbonation + UPV. 50% advance.",
        },
        {
            "offer_type": "Steel", "custom_type": "",
            "client_id": client_ids[2],
            "description": "MS Structural Design & Consultancy",
            "site_location": "TTC IND. Area, Rabale MIDC, Navi Mumbai",
            "base_amount": 200000, "gst_percent": 18.0,
            "file_path": "D:\\CreatorConsultant\\Offers\\2025\\STR-QUOT-2025-160.pdf",
            "status": "Pending",
            "reference_no": "STR/QUOT/2025/160",
            "offer_date": _now(),
            "notes": "20,000 sq.ft. @ Rs 10/sq.ft.",
        },
        {
            "offer_type": "Other", "custom_type": "PMC",
            "client_id": client_ids[3],
            "description": "Project Management Consultancy",
            "site_location": "Novo Rabale MIDC",
            "base_amount": 150000, "gst_percent": 18.0,
            "file_path": "D:\\CreatorConsultant\\Offers\\2026\\PMC-offer.pdf",
            "status": "Pending",
            "reference_no": "STR/PMC/2026/005",
            "offer_date": _now(),
            "notes": "Quarterly site visits + BOQ review",
        },
    ]
    for o in offers_data:
        od = {
            "id": _new_id(),
            "offer_code": await _next_offer_code(),
            "offer_type": o["offer_type"],
            "custom_type": o["custom_type"],
            "client_id": o["client_id"],
            "description": o["description"],
            "site_location": o["site_location"],
            "base_amount": float(o["base_amount"]),
            "gst_percent": float(o["gst_percent"]),
            "file_path": o["file_path"],
            "status": o["status"],
            "offer_date": o["offer_date"],
            "reference_no": o["reference_no"],
            "notes": o["notes"],
            "linked_project_id": None,
            "linked_project_code": "",
            "created_at": _now(),
        }
        await _enrich_offer(od)
        await db.offers.insert_one(od.copy())

    return {"ok": True, "seeded": True}


# ---------------------- DOCUMENTS MODULE ----------------------

DEFAULT_DOCUMENT_TYPES = [
    ("Quotation", "QT"),
    ("PMC Quotation", "PMC-QT"),
    ("Inspection Report Letter", "INSP"),
    ("Acceptance Letter", "ACC"),
    ("Demolition Letter", "DEM"),
    ("Supervision Certificate", "SUP"),
    ("Stability Certificate", "STAB"),
    ("To Whomsoever It May Concern", "TWMC"),
    ("Earthquake Certificate", "EQ"),
    ("Commencement Certificate", "COM"),
    ("MCGM Certificate", "MCGM"),
    ("Plinth Completion Certificate", "PLINTH"),
    ("Column Location Certificate", "COL"),
    ("RERA Certificate", "RERA"),
    ("Lift Certificate", "LIFT"),
    ("General Certificate", "GEN"),
    ("Scaffolding Certificate", "SCAF"),
    ("Declaration Certificate", "DEC"),
]


async def _seed_document_types_if_missing():
    if await db.document_types.count_documents({}) > 0:
        # One-shot migration: drop legacy "Audit Report" doc type if it exists
        # and hasn't yet been used to issue a number (counter ≤ 0).
        await db.document_types.delete_many({
            "prefix": "AUD-RPT",
            "$or": [{"counter": {"$lte": 0}}, {"counter": {"$exists": False}}],
        })
        # One-shot migration: drop "Audit Offer" doc type entirely. Audit offer
        # numbers are now entered manually on the Audit form (no auto-numbering).
        await db.document_types.delete_many({"prefix": "AUD-OFR"})
        return
    now = _now()
    docs = []
    for name, prefix in DEFAULT_DOCUMENT_TYPES:
        docs.append({
            "id": _new_id(),
            "name": name,
            "prefix": prefix,
            "description": "",
            "year_reset": True,
            "counter": 0,
            "last_year": 0,
            "created_at": now,
        })
    if docs:
        await db.document_types.insert_many(docs)


async def _next_document_number(doc_type: dict) -> str:
    """Generate `STR/{prefix}/{YYYY}/{counter:03}` and atomically increment counter on the type."""
    year = datetime.now(timezone.utc).year
    if doc_type.get("year_reset", True) and (doc_type.get("last_year") or 0) != year:
        await db.document_types.update_one(
            {"id": doc_type["id"]},
            {"$set": {"counter": 1, "last_year": year}},
        )
        counter = 1
    else:
        updated = await db.document_types.find_one_and_update(
            {"id": doc_type["id"]},
            {"$inc": {"counter": 1}, "$set": {"last_year": year}},
            return_document=True,
        )
        counter = (updated or {}).get("counter", 1)
    prefix = (doc_type.get("prefix") or "DOC").strip()
    return f"STR/{prefix}/{year}/{counter:03d}"


@api_router.get("/document-types", response_model=List[DocumentType])
async def list_document_types():
    rows = await db.document_types.find({}, {"_id": 0}).sort("name", 1).to_list(1000)
    return rows


@api_router.get("/document-types/by-prefix/{prefix}/preview")
async def preview_document_number_by_prefix(prefix: str):
    """Return what the next document number WILL be for the given prefix, without
    incrementing the counter. Used to pre-fill the Audit Offer Number on the
    New Audit form so the user sees the upcoming `STR/AUD-OFR/2026/007`."""
    dt = await db.document_types.find_one({"prefix": prefix.upper()}, {"_id": 0})
    if not dt:
        raise HTTPException(404, f"No document type with prefix '{prefix}'")
    year = datetime.now(timezone.utc).year
    if dt.get("year_reset", True) and (dt.get("last_year") or 0) != year:
        next_counter = 1
    else:
        next_counter = (dt.get("counter") or 0) + 1
    number = f"STR/{dt['prefix']}/{year}/{next_counter:03d}"
    return {"number": number, "year": year, "counter": next_counter, "prefix": dt["prefix"]}


@api_router.post("/document-types", response_model=DocumentType)
async def create_document_type(data: DocumentTypeIn):
    prefix = (data.prefix or "").strip().upper().replace(" ", "-")
    if not prefix:
        raise HTTPException(400, "Prefix is required")
    if await db.document_types.find_one({"prefix": prefix}):
        raise HTTPException(400, f"A document type with prefix '{prefix}' already exists")
    doc = {
        "id": _new_id(),
        "name": data.name.strip(),
        "prefix": prefix,
        "description": data.description or "",
        "year_reset": bool(data.year_reset),
        "counter": 0,
        "last_year": 0,
        "created_at": _now(),
    }
    await db.document_types.insert_one(doc.copy())
    return doc


@api_router.put("/document-types/{type_id}", response_model=DocumentType)
async def update_document_type(type_id: str, data: DocumentTypeIn):
    existing = await db.document_types.find_one({"id": type_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Document type not found")
    prefix = (data.prefix or "").strip().upper().replace(" ", "-")
    if not prefix:
        raise HTTPException(400, "Prefix is required")
    dup = await db.document_types.find_one({"prefix": prefix, "id": {"$ne": type_id}})
    if dup:
        raise HTTPException(400, f"A document type with prefix '{prefix}' already exists")
    update = {
        "name": data.name.strip(),
        "prefix": prefix,
        "description": data.description or "",
        "year_reset": bool(data.year_reset),
    }
    await db.document_types.update_one({"id": type_id}, {"$set": update})
    merged = {**existing, **update}
    return merged


@api_router.put("/document-types/{type_id}/counter")
async def reset_document_type_counter(type_id: str, counter: int = 0, last_year: Optional[int] = None):
    existing = await db.document_types.find_one({"id": type_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Document type not found")
    new_year = last_year if last_year is not None else (existing.get("last_year") or 0)
    await db.document_types.update_one(
        {"id": type_id},
        {"$set": {"counter": max(int(counter), 0), "last_year": int(new_year)}},
    )
    return {"ok": True, "counter": int(counter), "last_year": int(new_year)}


@api_router.delete("/document-types/{type_id}")
async def delete_document_type(type_id: str):
    count = await db.documents.count_documents({"doc_type_id": type_id})
    if count > 0:
        raise HTTPException(400, f"Cannot delete — {count} document(s) exist for this type. Delete them first or rename the type.")
    res = await db.document_types.delete_one({"id": type_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Document type not found")
    return {"ok": True}


async def _enrich_document(d: dict) -> dict:
    # Backfill status field for documents created before the status feature existed
    if not d.get("status"):
        d["status"] = "confirmed" if d.get("confirmed") else "pending"
    if d.get("client_id"):
        c = await db.clients.find_one({"id": d["client_id"]}, {"_id": 0, "name": 1, "phone": 1, "email": 1, "address": 1})
        if c:
            d["client_name"] = c.get("name", "")
            d["client_phone"] = c.get("phone", "")
            d["client_email"] = c.get("email", "")
            d["client_address"] = c.get("address", "")
    if d.get("architect_id"):
        a = await db.architects.find_one({"id": d["architect_id"]}, {"_id": 0, "name": 1, "phone": 1, "email": 1, "firm": 1})
        if a:
            d["architect_name"] = a.get("name", "")
            d["architect_phone"] = a.get("phone", "")
            d["architect_email"] = a.get("email", "")
            d["architect_firm"] = a.get("firm", "")
    return d


@api_router.get("/documents", response_model=List[Document])
async def list_documents(
    type_id: Optional[str] = None,
    client_id: Optional[str] = None,
    architect_id: Optional[str] = None,
    archived: Optional[bool] = False,
    search: Optional[str] = None,
):
    q: dict = {"archived": True} if archived else {"archived": {"$ne": True}}
    if type_id: q["doc_type_id"] = type_id
    if client_id: q["client_id"] = client_id
    if architect_id: q["architect_id"] = architect_id
    if search:
        rx = {"$regex": search, "$options": "i"}
        q["$or"] = [
            {"doc_number": rx}, {"doc_type_name": rx}, {"client_name": rx}, {"architect_name": rx},
            {"plot_place": rx}, {"contact_person": rx}, {"mobile": rx}, {"remark": rx},
        ]
    rows = await db.documents.find(q, {"_id": 0}).sort("created_at", -1).to_list(2000)
    for r in rows:
        await _enrich_document(r)
    return rows


@api_router.get("/documents/{doc_id}", response_model=Document)
async def get_document(doc_id: str):
    d = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Document not found")
    await _enrich_document(d)
    return d


@api_router.post("/documents", response_model=Document)
async def create_document(data: DocumentIn):
    dt = await db.document_types.find_one({"id": data.doc_type_id}, {"_id": 0})
    if not dt:
        raise HTTPException(400, "Invalid document type")
    doc_number = (data.doc_number or "").strip() or await _next_document_number(dt)
    doc = {
        "id": _new_id(),
        "doc_type_id": dt["id"],
        "doc_type_name": dt["name"],
        "doc_number": doc_number,
        "document_date": data.document_date or _now(),
        "client_id": data.client_id or None,
        "client_name": "",
        "architect_id": data.architect_id or None,
        "architect_name": "",
        "plot_place": data.plot_place or "",
        "phase": data.phase or "",
        "number_field": data.number_field or "",
        "remark": data.remark or "",
        "contact_person": data.contact_person or "",
        "mobile": data.mobile or "",
        "other_comments": data.other_comments or "",
        "update_date": data.update_date or None,
        "archived": False,
        "created_at": _now(),
    }
    _stamp_edit(doc)
    await _enrich_document(doc)
    await db.documents.insert_one(doc.copy())
    return doc


@api_router.put("/documents/{doc_id}", response_model=Document)
async def update_document(doc_id: str, data: DocumentIn):
    existing = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Document not found")
    dt = await db.document_types.find_one({"id": data.doc_type_id}, {"_id": 0})
    if not dt:
        raise HTTPException(400, "Invalid document type")
    update = {
        "doc_type_id": dt["id"],
        "doc_type_name": dt["name"],
        "doc_number": (data.doc_number or existing.get("doc_number") or "").strip(),
        "document_date": data.document_date or existing.get("document_date"),
        "client_id": data.client_id or None,
        "architect_id": data.architect_id or None,
        "plot_place": data.plot_place or "",
        "phase": data.phase or "",
        "number_field": data.number_field or "",
        "remark": data.remark or "",
        "contact_person": data.contact_person or "",
        "mobile": data.mobile or "",
        "other_comments": data.other_comments or "",
        "update_date": data.update_date or existing.get("update_date"),
    }
    _stamp_edit(update)
    await db.documents.update_one({"id": doc_id}, {"$set": update})
    merged = {**existing, **update}
    await _enrich_document(merged)
    return merged


@api_router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    res = await db.documents.delete_one({"id": doc_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Document not found")
    return {"ok": True}


@api_router.post("/documents/{doc_id}/archive")
async def archive_document(doc_id: str):
    res = await db.documents.update_one({"id": doc_id}, {"$set": {"archived": True}})
    if res.matched_count == 0:
        raise HTTPException(404, "Document not found")
    return {"ok": True}


class ConfirmDocumentIn(BaseModel):
    project_id: Optional[str] = None
    audit_id: Optional[str] = None


class DocumentStatusIn(BaseModel):
    status: str  # one of: pending | confirmed | on_hold | cancelled
    project_id: Optional[str] = None
    audit_id: Optional[str] = None


_DOC_STATUSES = {"pending", "confirmed", "on_hold", "cancelled"}


async def _apply_document_status(doc_id: str, status: str, project_id: Optional[str], audit_id: Optional[str]) -> dict:
    if status not in _DOC_STATUSES:
        raise HTTPException(400, f"Invalid status. Use one of: {sorted(_DOC_STATUSES)}")
    existing = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Document not found")
    if project_id and audit_id:
        raise HTTPException(400, "Link to either a project OR an audit, not both")

    update: dict = {"status": status}
    is_confirmed = status == "confirmed"
    update["confirmed"] = is_confirmed
    update["confirmed_at"] = _now() if is_confirmed else None

    if status in ("on_hold", "cancelled", "pending"):
        # Clear links when status is not 'confirmed'
        update.update({
            "linked_project_id": None, "linked_project_code": "", "linked_project_name": "",
            "linked_audit_id": None, "linked_audit_code": "", "linked_audit_offer": "",
        })
    elif is_confirmed:
        if project_id:
            proj = await db.projects.find_one({"id": project_id}, {"_id": 0, "project_code": 1, "name": 1})
            if not proj:
                raise HTTPException(404, "Project not found")
            update.update({
                "linked_project_id": project_id,
                "linked_project_code": proj.get("project_code", ""),
                "linked_project_name": proj.get("name", ""),
                "linked_audit_id": None, "linked_audit_code": "", "linked_audit_offer": "",
            })
        elif audit_id:
            audit = await db.audits.find_one({"id": audit_id}, {"_id": 0, "audit_code": 1, "audit_offer": 1})
            if not audit:
                raise HTTPException(404, "Audit not found")
            update.update({
                "linked_audit_id": audit_id,
                "linked_audit_code": audit.get("audit_code", ""),
                "linked_audit_offer": audit.get("audit_offer", ""),
                "linked_project_id": None, "linked_project_code": "", "linked_project_name": "",
            })
        else:
            # Confirmed without link → clear both
            update.update({
                "linked_project_id": None, "linked_project_code": "", "linked_project_name": "",
                "linked_audit_id": None, "linked_audit_code": "", "linked_audit_offer": "",
            })
    _stamp_edit(update)
    await db.documents.update_one({"id": doc_id}, {"$set": update})
    return update


@api_router.post("/documents/{doc_id}/status")
async def set_document_status(doc_id: str, data: DocumentStatusIn):
    update = await _apply_document_status(doc_id, data.status, data.project_id, data.audit_id)
    return {"ok": True, **update}


@api_router.post("/documents/{doc_id}/confirm")
async def confirm_document(doc_id: str, data: ConfirmDocumentIn):
    """Backward-compat: confirm + optional link. Equivalent to status='confirmed'."""
    update = await _apply_document_status(doc_id, "confirmed", data.project_id, data.audit_id)
    return {"ok": True, **update}


@api_router.post("/documents/{doc_id}/unconfirm")
async def unconfirm_document(doc_id: str):
    """Backward-compat: reset to pending."""
    update = await _apply_document_status(doc_id, "pending", None, None)
    return {"ok": True, **update}


@api_router.post("/documents/{doc_id}/unarchive")
async def unarchive_document(doc_id: str):
    res = await db.documents.update_one({"id": doc_id}, {"$set": {"archived": False}})
    if res.matched_count == 0:
        raise HTTPException(404, "Document not found")
    return {"ok": True}


@api_router.get("/documents/{doc_id}/pdf")
async def document_pdf(doc_id: str):
    d = await db.documents.find_one({"id": doc_id}, {"_id": 0})
    if not d:
        raise HTTPException(404, "Document not found")
    await _enrich_document(d)

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    margin = 18 * mm

    # Branded header
    c.setFillColor(colors.HexColor("#0A2E1F"))
    c.rect(0, height - 28 * mm, width, 28 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(margin, height - 14 * mm, "CREATOR RCC CONSULTANT LLP")
    c.setFont("Helvetica", 9)
    c.drawString(margin, height - 20 * mm, "Structural Audits • RCC / Steel Design • PMC • Retrofitting")
    c.drawString(margin, height - 25 * mm, "Navi Mumbai • info@creatorconsultant.online")
    c.setFillColor(colors.HexColor("#10B981"))
    c.setFont("Helvetica-Bold", 11)
    c.drawRightString(width - margin, height - 14 * mm, d.get("doc_type_name", "Document").upper())
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 10)
    c.drawRightString(width - margin, height - 20 * mm, d.get("doc_number", ""))

    y = height - 38 * mm
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    c.drawRightString(width - margin, y, f"Date: {(d.get('document_date') or _now())[:10]}")
    y -= 10 * mm

    # TO block
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "TO,")
    y -= 5 * mm
    c.setFont("Helvetica", 10)
    if d.get("client_name"):
        c.drawString(margin, y, d.get("client_name", "")); y -= 5 * mm
    if d.get("contact_person") and d.get("contact_person") != d.get("client_name"):
        c.drawString(margin, y, f"Kind Attn.: {d.get('contact_person')}"); y -= 5 * mm
    if d.get("plot_place"):
        c.drawString(margin, y, d.get("plot_place", "")); y -= 5 * mm
    if d.get("mobile"):
        c.drawString(margin, y, f"Mobile: {d.get('mobile')}"); y -= 5 * mm

    y -= 4 * mm
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(colors.HexColor("#0A2E1F"))
    c.drawString(margin, y, f"Subject: {d.get('doc_type_name', 'Document')}")
    c.setFillColor(colors.black)
    y -= 8 * mm

    rows = [
        ("Location", d.get("phase")),
        ("Path of Folder", d.get("remark")),
        ("Other Comments", d.get("other_comments")),
    ]
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontName="Helvetica", fontSize=10, leading=14)
    label_x = margin
    value_x = margin + 38 * mm
    for label, val in rows:
        if not val:
            continue
        c.setFont("Helvetica-Bold", 10)
        c.drawString(label_x, y, f"{label}:")
        para = Paragraph(str(val).replace("\n", "<br/>"), body_style)
        avail_w = width - value_x - margin
        w, h = para.wrap(avail_w, 100 * mm)
        para.drawOn(c, value_x, y - h + 11)
        y -= max(h + 3, 6 * mm)
        if y < 40 * mm:
            c.showPage(); y = height - margin

    y = max(y - 18 * mm, 40 * mm)
    c.setFont("Helvetica", 10)
    c.drawString(margin, y, "For Creator RCC Consultant LLP")
    y -= 14 * mm
    c.drawString(margin, y, "____________________________")
    y -= 5 * mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(margin, y, "Mr. Rutvij Patel")
    y -= 5 * mm
    c.setFont("Helvetica", 9)
    c.drawString(margin, y, "Consulting Structural Engineer")

    c.showPage(); c.save()
    pdf_bytes = buf.getvalue(); buf.close()
    fname = f"{d.get('doc_number','document').replace('/', '_')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )



# ---------------------- SITE VISIT (Engineer) ENDPOINTS ----------------------

DEFAULT_SV_TEMPLATES = [
    ("Column Inspection", "Column casting / reinforcement checks", [
        "Size of members as per drawing",
        "Reinforcement - Dia, No of bars",
        "Spacing between bars, LD, Alignment of bars",
        "Reinforcement - Rust free, dust free",
        "Clear cover to reinforcement",
        "Rods are tied properly with binding wire",
        "Ties spacing, alignment, hook bend 135°",
        "Concrete cube test result for last structural member",
    ]),
    ("Slab Inspection", "Slab casting / reinforcement checks", [
        "Size and thickness of slab as per drawing",
        "Reinforcement - Dia, No of bars",
        "Spacing between bars, Alignment",
        "Top & bottom bar cover",
        "Crank bar locations",
        "Chairs / spacers between layers",
        "Electrical conduit & plumbing sleeves in place",
        "Concrete cube test result for last structural member",
    ]),
    ("Beam Inspection", "Beam casting / reinforcement checks", [
        "Size of beam as per drawing",
        "Reinforcement - Dia, No of bars",
        "Stirrups spacing, alignment, hook bend 135°",
        "Clear cover to reinforcement",
        "Anchorage length (LD) at supports",
        "Lap length / position",
        "Concrete cube test result for last structural member",
    ]),
    ("Foundation Inspection", "Footing / raft / pile cap checks", [
        "Excavation level & soil bearing condition",
        "PCC laid and level checked",
        "Reinforcement - Dia, No, spacing as per drawing",
        "Clear cover all sides",
        "Dowel bars for columns properly tied",
        "Anti-termite treatment done",
        "Concrete cube test result for last structural member",
    ]),
    ("Waterproofing Inspection", "Waterproofing / membrane checks", [
        "Surface cleaned & primer applied",
        "Membrane laid as per spec",
        "Overlap and seam joints sealed",
        "Corners and outlets treated",
        "Protection screed laid",
        "Pond / water test done for 48 hours",
    ]),
]


async def _seed_sv_templates_if_missing():
    if await db.site_visit_templates.count_documents({}) > 0:
        return
    now = _now()
    docs = []
    for name, desc, items in DEFAULT_SV_TEMPLATES:
        docs.append({
            "id": _new_id(),
            "name": name,
            "description": desc,
            "checklist": items,
            "created_at": now,
        })
    if docs:
        await db.site_visit_templates.insert_many(docs)


async def _next_visit_code() -> str:
    counter = await db.counters.find_one_and_update(
        {"_id": "site_visit"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = (counter or {}).get("seq", 1)
    return f"SV-{seq:04d}"


# ----- Admin: edit the Site Visit number series (next visit code) -----
class SiteVisitSeqIn(BaseModel):
    next_seq: int = Field(..., ge=1, le=999999)


@api_router.get("/site-visits/series")
async def get_site_visit_series():
    """Return the next visit code that will be assigned. Admins only."""
    _deny_engineer()
    counter = await db.counters.find_one({"_id": "site_visit"}, {"_id": 0})
    current_seq = (counter or {}).get("seq", 0)
    next_seq = current_seq + 1
    return {
        "current_seq": current_seq,
        "next_seq": next_seq,
        "next_code": f"SV-{next_seq:04d}",
        "prefix": "SV",
    }


@api_router.put("/site-visits/series")
async def set_site_visit_series(body: SiteVisitSeqIn, user: dict = Depends(auth_module.get_current_user)):
    """Admin sets the NEXT visit code. e.g. next_seq=100 → next visit is SV-0100.
    Internally we set `counter.seq = next_seq - 1` so the next $inc returns
    `next_seq`. Refuses to overwrite if any existing visit already uses the
    proposed code (would collide)."""
    _deny_engineer()
    if user.get("role") != "admin":
        raise HTTPException(403, "Only admins can edit the visit number series")
    next_seq = int(body.next_seq)
    proposed = f"SV-{next_seq:04d}"
    if await db.site_visits.find_one({"visit_code": proposed}, {"_id": 1}):
        raise HTTPException(
            400,
            f"Cannot set next code to {proposed} — a site visit with this code already exists.",
        )
    await db.counters.update_one(
        {"_id": "site_visit"},
        {"$set": {"seq": next_seq - 1}},
        upsert=True,
    )
    return {"ok": True, "next_seq": next_seq, "next_code": proposed}


@api_router.get("/site-visit-templates", response_model=List[SiteVisitTemplate])
async def list_sv_templates():
    rows = await db.site_visit_templates.find({}, {"_id": 0}).sort("name", 1).to_list(500)
    return rows


@api_router.post("/site-visit-templates", response_model=SiteVisitTemplate)
async def create_sv_template(data: SiteVisitTemplateIn):
    doc = {
        "id": _new_id(),
        "name": data.name.strip(),
        "description": data.description or "",
        "checklist": [s.strip() for s in (data.checklist or []) if s.strip()],
        "created_at": _now(),
    }
    await db.site_visit_templates.insert_one(doc.copy())
    return doc


@api_router.put("/site-visit-templates/{tid}", response_model=SiteVisitTemplate)
async def update_sv_template(tid: str, data: SiteVisitTemplateIn):
    existing = await db.site_visit_templates.find_one({"id": tid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Template not found")
    update = {
        "name": data.name.strip(),
        "description": data.description or "",
        "checklist": [s.strip() for s in (data.checklist or []) if s.strip()],
    }
    await db.site_visit_templates.update_one({"id": tid}, {"$set": update})
    return {**existing, **update}


@api_router.delete("/site-visit-templates/{tid}")
async def delete_sv_template(tid: str):
    res = await db.site_visit_templates.delete_one({"id": tid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Template not found")
    return {"ok": True}


async def _enrich_site_visit(v: dict) -> dict:
    if v.get("project_id"):
        p = await db.projects.find_one({"id": v["project_id"]}, {"_id": 0, "project_code": 1, "name": 1, "site_location": 1, "client_name": 1})
        if p:
            v["project_code"] = p.get("project_code", "")
            v["project_name"] = p.get("name", "")
            # Auto-fill blanks from the linked project so historical visits also benefit
            if not v.get("customer"):
                v["customer"] = p.get("client_name", "")
            if not v.get("site_location"):
                v["site_location"] = p.get("site_location", "")
    return v


async def _log_sv_activity(visit_id: str, visit_code: str, action: str, detail: str = ""):
    """Append a site-visit activity event (parallel to project/audit activity)."""
    try:
        s = _current_user_stamp()
        await db.activity_log.insert_one({
            "id": _new_id(),
            "site_visit_id": visit_id,
            "site_visit_code": visit_code,
            "action": action,
            "detail": detail,
            "user_id": s["user_id"],
            "username": s["username"],
            "created_at": _now(),
        })
    except Exception as e:
        logger.error(f"sv activity log error: {e}")


async def _notify_admins(message: str, related_visit_id: str = "", related_visit_code: str = ""):
    """Create an in-app notification targeted at all users with role=admin
    AND fire a Web Push to any admins who've subscribed on this/another device."""
    try:
        s = _current_user_stamp()
        await db.notifications.insert_one({
            "id": _new_id(),
            "type": "site_visit",
            "message": message,
            "target_role": "admin",
            "target_user_id": None,
            "related_visit_id": related_visit_id,
            "related_visit_code": related_visit_code,
            "created_by_user_id": s["user_id"],
            "created_by_username": s["username"],
            "read_by": [],          # list of user_ids who have dismissed it
            "created_at": _now(),
        })
    except Exception as e:
        logger.error(f"notify error: {e}")

    # Fire-and-forget web push (subscribed admin devices)
    try:
        await _push_to_admins({
            "title": "New site visit submitted",
            "body": message[:160],
            "url": f"/site-visits/{related_visit_id}" if related_visit_id else "/site-visits",
            "tag": f"site-visit-{related_visit_id or 'general'}",
        })
    except Exception as e:
        logger.error(f"push to admins error: {e}")


@api_router.get("/site-visits/{vid}/activity")
async def list_sv_activity(vid: str):
    """Note: this declaration sits BEFORE the catch-all /site-visits/{vid} GET (further below)
    so FastAPI matches it first."""
    items = await db.activity_log.find({"site_visit_id": vid}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


@api_router.post("/site-visits/{vid}/pin")
async def pin_site_visit(vid: str, body: dict = None):
    """Toggle the 'pinned' flag on a site visit. A project can have multiple pinned visits;
    the project page surfaces them as a compact 'Key Inspections' strip at the top."""
    pin_val = bool((body or {}).get("pinned", True))
    existing = await db.site_visits.find_one({"id": vid}, {"_id": 0, "visit_code": 1})
    if not existing:
        raise HTTPException(404, "Site visit not found")
    await db.site_visits.update_one({"id": vid}, {"$set": {"is_pinned": pin_val}})
    await _log_sv_activity(vid, existing.get("visit_code", ""), "PINNED" if pin_val else "UNPINNED", "")
    return {"ok": True, "is_pinned": pin_val}


@api_router.get("/site-visits/export/excel")
async def export_site_visits_excel(
    month: Optional[str] = None,        # YYYY-MM
    engineer_id: Optional[str] = None,
    project_id: Optional[str] = None,
):
    """Excel export of site visits. Optional filters: month=YYYY-MM, engineer_id, project_id.
    Two sheets: 'Visits' (one row per visit) + 'By Engineer' (count + non-compliant items).
    Must be declared BEFORE /site-visits/{vid} GET so the static path takes precedence."""
    q: dict = {}
    if project_id:
        q["project_id"] = project_id
    if engineer_id:
        q["created_by_user_id"] = engineer_id
    # Scope engineer to their own visits
    user = get_current_user_safe()
    if user and user.get("role") == "engineer":
        q["created_by_user_id"] = user["id"]
    rows = await db.site_visits.find(q, {"_id": 0, "photos": 0, "engineer_signature": 0, "site_person_signature": 0}).sort("created_at", -1).to_list(5000)
    for r in rows:
        await _enrich_site_visit(r)

    if month:
        rows = [r for r in rows if (r.get("visit_date") or r.get("created_at") or "").startswith(month)]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Visits"
    headers = ["Code", "Date", "Inspection", "Template", "Project", "Customer", "Site Location", "Job No", "DRG No", "Rev", "Engineer", "Status", "GPS", "Yes", "No", "N/A", "Observations"]
    ws.append(headers)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="0A2E1F")
        c.alignment = Alignment(horizontal="center", vertical="center")

    per_eng: dict = {}  # engineer_name -> {count, non_compliant, last_date}
    for r in rows:
        cl = r.get("checklist") or []
        y = sum(1 for c in cl if (c.get("compliance") or "").lower() == "yes")
        n = sum(1 for c in cl if (c.get("compliance") or "").lower() == "no")
        na = sum(1 for c in cl if (c.get("compliance") or "").lower() == "na")
        eng = (r.get("engineer_name") or r.get("created_by_username") or "—")
        ws.append([
            r.get("visit_code", ""),
            (r.get("visit_date") or "")[:10],
            r.get("inspection_title", ""),
            r.get("template_name", ""),
            f"{r.get('project_code','')} {r.get('project_name','')}".strip(),
            r.get("customer", ""),
            r.get("site_location", "") or r.get("plot_no", ""),
            r.get("job_no", ""),
            r.get("drg_no", ""),
            r.get("revision", ""),
            eng,
            r.get("status", "submitted"),
            f"{r.get('latitude'):.6f}, {r.get('longitude'):.6f}" if (r.get("latitude") is not None and r.get("longitude") is not None) else "",
            y, n, na,
            "\n".join(r.get("observations") or []),
        ])
        agg = per_eng.setdefault(eng, {"count": 0, "non_compliant": 0, "last": ""})
        agg["count"] += 1
        agg["non_compliant"] += n
        d = (r.get("visit_date") or "")[:10]
        if d and (not agg["last"] or d > agg["last"]):
            agg["last"] = d

    for col_idx in range(1, len(headers) + 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = 18

    ws2 = wb.create_sheet("By Engineer")
    ws2.append(["Engineer", "Visits", "Non-compliant items", "Last visit date"])
    for c in ws2[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="0A2E1F")
    for eng, agg in sorted(per_eng.items(), key=lambda x: -x[1]["count"]):
        ws2.append([eng, agg["count"], agg["non_compliant"], agg["last"]])
    for col_idx in range(1, 5):
        ws2.column_dimensions[openpyxl.utils.get_column_letter(col_idx)].width = 24

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    fname = f"site-visits-{month or 'all'}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api_router.get("/site-visits", response_model=List[SiteVisit])
async def list_site_visits(project_id: Optional[str] = None, mine: Optional[bool] = False, search: Optional[str] = None):
    q: dict = {}
    if project_id: q["project_id"] = project_id
    if mine:
        user = get_current_user_safe()
        if user: q["created_by_user_id"] = user["id"]
    if search:
        rx = {"$regex": search, "$options": "i"}
        q["$or"] = [{"visit_code": rx}, {"inspection_title": rx}, {"job_no": rx}, {"customer": rx}, {"plot_no": rx}, {"project_code": rx}]
    rows = await db.site_visits.find(q, {"_id": 0, "photos": 0, "engineer_signature": 0, "site_person_signature": 0}).sort("created_at", -1).to_list(2000)
    for r in rows:
        await _enrich_site_visit(r)
    return rows


@api_router.get("/site-visits/{vid}", response_model=SiteVisit)
async def get_site_visit(vid: str):
    v = await db.site_visits.find_one({"id": vid}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Site visit not found")
    # Lazy-mint a public_token for legacy visits created before tokens existed.
    # This token powers the WhatsApp share + mobile-friendly PDF download.
    if not v.get("public_token"):
        tok = secrets.token_urlsafe(20)
        await db.site_visits.update_one({"id": vid}, {"$set": {"public_token": tok}})
        v["public_token"] = tok
    await _enrich_site_visit(v)
    return v


@api_router.post("/site-visits", response_model=SiteVisit)
async def create_site_visit(data: SiteVisitIn):
    user = get_current_user_safe() or {}
    doc = {
        "id": _new_id(),
        "visit_code": await _next_visit_code(),
        "template_id": data.template_id or None,
        "template_name": data.template_name or "",
        "job_no": data.job_no or "",
        "project_id": data.project_id or None,
        "project_code": "",
        "project_name": "",
        "inspection_title": data.inspection_title or "",
        "visit_date": data.visit_date or _now(),
        "customer": data.customer or "",
        "plot_no": data.plot_no or "",
        "site_location": data.site_location or "",
        "drg_no": data.drg_no or "",
        "revision": data.revision or "",
        "latitude": data.latitude,
        "longitude": data.longitude,
        "geo_accuracy": data.geo_accuracy,
        "checklist": [ci.model_dump() for ci in (data.checklist or [])],
        "observations": [o for o in (data.observations or []) if o.strip()],
        "photos": [p.model_dump() for p in (data.photos or [])],
        "engineer_name": data.engineer_name or user.get("username", ""),
        "engineer_signature": data.engineer_signature or "",
        "site_person_name": data.site_person_name or "",
        "site_person_phone": data.site_person_phone or "",
        "site_person_signature": data.site_person_signature or "",
        "status": data.status or "submitted",
        "public_token": secrets.token_urlsafe(20),
        "created_by_user_id": user.get("id"),
        "created_by_username": user.get("username", ""),
        "created_at": _now(),
    }
    _stamp_edit(doc)
    await _enrich_site_visit(doc)
    await db.site_visits.insert_one(doc.copy())
    await _log_sv_activity(doc["id"], doc["visit_code"], "VISIT CREATED", doc.get("inspection_title", ""))
    if doc.get("status") == "submitted" and (user.get("role") or "") != "admin":
        eng_name = user.get("username") or doc.get("engineer_name") or "engineer"
        proj = f" — {doc.get('project_code')}" if doc.get("project_code") else ""
        await _notify_admins(
            f"{eng_name} submitted site visit {doc['visit_code']}{proj}: {doc.get('inspection_title','')}",
            related_visit_id=doc["id"],
            related_visit_code=doc["visit_code"],
        )
    return doc


@api_router.put("/site-visits/{vid}", response_model=SiteVisit)
async def update_site_visit(vid: str, data: SiteVisitIn):
    existing = await db.site_visits.find_one({"id": vid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Site visit not found")
    update = {
        "template_id": data.template_id or existing.get("template_id"),
        "template_name": data.template_name or existing.get("template_name", ""),
        "job_no": data.job_no or "",
        "project_id": data.project_id or None,
        "inspection_title": data.inspection_title or existing.get("inspection_title", ""),
        "visit_date": data.visit_date or existing.get("visit_date"),
        "customer": data.customer or "",
        "plot_no": data.plot_no or "",
        "site_location": data.site_location or existing.get("site_location", ""),
        "drg_no": data.drg_no or "",
        "revision": data.revision or "",
        "latitude": data.latitude if data.latitude is not None else existing.get("latitude"),
        "longitude": data.longitude if data.longitude is not None else existing.get("longitude"),
        "geo_accuracy": data.geo_accuracy if data.geo_accuracy is not None else existing.get("geo_accuracy"),
        "checklist": [ci.model_dump() for ci in (data.checklist or [])],
        "observations": [o for o in (data.observations or []) if o.strip()],
        "photos": [p.model_dump() for p in (data.photos or [])],
        "engineer_name": data.engineer_name or existing.get("engineer_name", ""),
        "engineer_signature": data.engineer_signature or existing.get("engineer_signature", ""),
        "site_person_name": data.site_person_name or existing.get("site_person_name", ""),
        "site_person_phone": data.site_person_phone or existing.get("site_person_phone", ""),
        "site_person_signature": data.site_person_signature or existing.get("site_person_signature", ""),
        "status": data.status or existing.get("status", "submitted"),
    }
    _stamp_edit(update)
    await db.site_visits.update_one({"id": vid}, {"$set": update})
    merged = {**existing, **update}
    await _enrich_site_visit(merged)
    # Activity: distinguish a "status change" from a plain edit
    user = get_current_user_safe() or {}
    prev_status = existing.get("status", "submitted")
    new_status = update.get("status", prev_status)
    if prev_status != new_status:
        await _log_sv_activity(vid, merged.get("visit_code", ""), "STATUS CHANGED", f"{prev_status} → {new_status}")
        if new_status == "submitted" and (user.get("role") or "") != "admin":
            eng_name = user.get("username") or merged.get("engineer_name") or "engineer"
            proj = f" — {merged.get('project_code')}" if merged.get("project_code") else ""
            await _notify_admins(
                f"{eng_name} submitted site visit {merged.get('visit_code','')}{proj}: {merged.get('inspection_title','')}",
                related_visit_id=vid,
                related_visit_code=merged.get("visit_code", ""),
            )
    else:
        await _log_sv_activity(vid, merged.get("visit_code", ""), "VISIT UPDATED", "")
    return merged


@api_router.delete("/site-visits/{vid}")
async def delete_site_visit(vid: str):
    existing = await db.site_visits.find_one({"id": vid}, {"_id": 0, "visit_code": 1})
    if not existing:
        raise HTTPException(404, "Site visit not found")
    # Log activity BEFORE the delete so the audit trail mirrors what happened
    await _log_sv_activity(vid, existing.get("visit_code", ""), "VISIT DELETED", "")
    # Cascade: remove any notifications referencing this visit so admins
    # don't get dead links in their feed
    try:
        await db.notifications.delete_many({"related_visit_id": vid})
    except Exception:
        pass
    await db.site_visits.delete_one({"id": vid})
    return {"ok": True}


def _base64_image_from_data_url(data_url: str) -> Optional[io.BytesIO]:
    if not data_url or "," not in data_url:
        return None
    try:
        b64 = data_url.split(",", 1)[1]
        return io.BytesIO(base64.b64decode(b64))
    except Exception:
        return None


# Site-visit upload storage (mounted at /api/uploads)
UPLOAD_ROOT = Path(os.environ.get("UPLOAD_DIR", str(ROOT_DIR / "uploads")))
SITE_VISIT_UPLOAD_DIR = UPLOAD_ROOT / "site-visits"
SITE_VISIT_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# GridFS bucket for persistent photo storage. Container disk is ephemeral on
# Kubernetes (every redeploy wipes /app/backend/uploads), so we store photo
# bytes in MongoDB GridFS. The bucket name `site_visit_photos` becomes the
# `site_visit_photos.files` + `.chunks` collections inside the same DB.
_photo_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="site_visit_photos")

# ---------- Letterhead overlay (Creator Consultant branded PDF background) ----------
# The PDF at /app/backend/assets/letterhead.pdf is rendered as a background on
# every site-visit report page. Drawn body content sits on top.
LETTERHEAD_PATH = ROOT_DIR / "assets" / "letterhead.pdf"
_letterhead_reader: Optional[pypdf.PdfReader] = None
try:
    if LETTERHEAD_PATH.exists():
        _letterhead_reader = pypdf.PdfReader(str(LETTERHEAD_PATH))
        print(f"[startup] Letterhead loaded ({len(_letterhead_reader.pages)} page) from {LETTERHEAD_PATH}")
except Exception as _e:
    print(f"[startup] Could not load letterhead PDF: {_e}")
    _letterhead_reader = None


def _apply_letterhead(pdf_bytes: bytes) -> bytes:
    """Stamp the Creator Consultant letterhead UNDER every page of `pdf_bytes`.
    If the letterhead is missing or merging fails, returns the input unchanged.
    The letterhead page is scaled to match each content page's media box, so
    Letter-size letterhead works under A4 content (and vice versa).

    NOTE: We re-open the letterhead PDF fresh on every call and use
    `add_blank_page` + `merge_transformed_page` + `merge_page` instead of
    `deepcopy(template)`. PyPDF PageObjects share IndirectObject references
    with their parent reader; `copy.deepcopy` does NOT fully decouple them,
    so reusing a deepcopy across iterations causes content streams to bleed
    together into a single page in the output (every page's content stacked
    on top of each other under one letterhead).
    """
    if not LETTERHEAD_PATH.exists():
        return pdf_bytes
    try:
        from pypdf import PdfReader, PdfWriter, Transformation
        src = PdfReader(io.BytesIO(pdf_bytes))
        lh_reader = PdfReader(str(LETTERHEAD_PATH))
        if not lh_reader.pages:
            return pdf_bytes
        lh_template = lh_reader.pages[0]
        lh_w = float(lh_template.mediabox.width)
        lh_h = float(lh_template.mediabox.height)
        writer = PdfWriter()
        for page in src.pages:
            pw = float(page.mediabox.width)
            ph = float(page.mediabox.height)
            # Fresh, independent page for this iteration
            new_page = writer.add_blank_page(width=pw, height=ph)
            # Layer 1 — letterhead at the bottom (scaled to fit)
            sx = pw / lh_w
            sy = ph / lh_h
            new_page.merge_transformed_page(
                lh_template, Transformation().scale(sx=sx, sy=sy),
            )
            # Layer 2 — site visit content on top
            new_page.merge_page(page)
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()
    except Exception as e:
        print(f"[pdf] Letterhead overlay failed, returning unstamped PDF: {e}")
        return pdf_bytes


def _photo_to_image_reader(p: dict) -> Optional[ImageReader]:
    """Resolve a SiteVisitPhoto dict to a reportlab ImageReader.
    Supports base64 data_url, on-disk legacy file, or GridFS-stored bytes."""
    if p.get("data_url"):
        bio = _base64_image_from_data_url(p["data_url"])
        if bio:
            try:
                return ImageReader(bio)
            except Exception:
                return None
    url = p.get("url") or ""
    if url:
        # url is /api/uploads/site-visits/<fname>. Try disk first (legacy),
        # then fall back to GridFS using the filename as the GridFS filename.
        fname = url.rsplit("/", 1)[-1]
        fpath = SITE_VISIT_UPLOAD_DIR / fname
        if fpath.exists():
            try:
                return ImageReader(str(fpath))
            except Exception:
                pass
        # GridFS fallback — we have to read synchronously for ReportLab so we
        # spawn a small async helper from the surrounding (already-async) PDF
        # builder. This branch is exercised by `_render_visit_pdf` which calls
        # `await _load_photo_bytes(url)` upstream and stuffs the bytes back
        # into the photo dict before calling us. So here we just bail.
    return None


async def _load_photo_bytes(url: str) -> Optional[bytes]:
    """Download a site-visit photo's raw bytes for the PDF builder. Tries disk
    first (legacy files), then GridFS by filename."""
    if not url:
        return None
    fname = url.rsplit("/", 1)[-1]
    fpath = SITE_VISIT_UPLOAD_DIR / fname
    if fpath.exists():
        try:
            return fpath.read_bytes()
        except Exception:
            pass
    try:
        stream = await _photo_bucket.open_download_stream_by_name(fname)
        try:
            return await stream.read()
        finally:
            try:
                stream.close()
            except Exception:
                pass
    except Exception:
        return None


@api_router.post("/site-visits/uploads")
async def upload_site_visit_photo(file: UploadFile = File(...)):
    """Accept a single image file from the engineer's phone, store the bytes in
    MongoDB GridFS (so they survive container redeploys on Kubernetes), and
    return the canonical URL `/api/uploads/site-visits/<filename>` that the
    frontend can later <img src=...>."""
    if not file.filename:
        raise HTTPException(400, "Missing filename")
    ext = (file.filename.rsplit(".", 1)[-1] or "jpg").lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "heic", "heif", "gif"}:
        raise HTTPException(400, "Only image files are allowed")
    fname = f"{secrets.token_urlsafe(16)}.{ext}"
    content_type = file.content_type or f"image/{ 'jpeg' if ext == 'jpg' else ext }"
    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty upload")
    # Persist in GridFS keyed by filename. We always write a fresh doc per
    # upload so retries don't clobber each other.
    await _photo_bucket.upload_from_stream(
        fname, io.BytesIO(data), metadata={"content_type": content_type},
    )
    return {"url": f"/api/uploads/site-visits/{fname}", "filename": fname}


@auth_public_router.get("/uploads/site-visits/{filename}")
async def serve_site_visit_photo(filename: str):
    """Stream a site-visit photo back to the browser. Looks in GridFS first
    (where new uploads live), then falls back to the legacy on-disk path."""
    # GridFS lookup by filename — `open_download_stream_by_name` always picks
    # the most recently uploaded revision if duplicates exist.
    try:
        stream = await _photo_bucket.open_download_stream_by_name(filename)
        ct = (getattr(stream, "metadata", None) or {}).get("content_type") or "image/jpeg"

        async def gen():
            try:
                while True:
                    chunk = await stream.readchunk()
                    if not chunk:
                        break
                    yield chunk
            finally:
                try:
                    stream.close()
                except Exception:
                    pass

        return StreamingResponse(
            gen(),
            media_type=ct,
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )
    except Exception:
        pass
    # Legacy: file may still exist on disk (older preview uploads)
    fpath = SITE_VISIT_UPLOAD_DIR / filename
    if fpath.exists() and fpath.is_file():
        ext = filename.rsplit(".", 1)[-1].lower()
        ct = f"image/{ 'jpeg' if ext == 'jpg' else ext }"
        return StreamingResponse(
            iter([fpath.read_bytes()]),
            media_type=ct,
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )
    raise HTTPException(404, "Photo not found")


@api_router.delete("/site-visits/uploads/{filename}")
async def delete_site_visit_upload(filename: str):
    # Disk (legacy)
    fpath = SITE_VISIT_UPLOAD_DIR / filename
    if fpath.exists() and fpath.is_file():
        try:
            fpath.unlink()
        except Exception:
            pass
    # GridFS — delete all matching docs
    try:
        async for grid_doc in _photo_bucket.find({"filename": filename}):
            try:
                await _photo_bucket.delete(grid_doc._id)
            except Exception:
                pass
    except Exception:
        pass
    return {"ok": True}


# ---------------------- NOTIFICATIONS (in-app feed) ----------------------

def _user_can_see_notification(user: dict, n: dict) -> bool:
    if not user:
        return False
    if n.get("target_user_id") and n["target_user_id"] == user.get("id"):
        return True
    if n.get("target_role") and n["target_role"] == user.get("role"):
        return True
    return False


@api_router.get("/notifications")
async def list_notifications(limit: int = 25, unread_only: bool = False):
    user = get_current_user_safe() or {}
    # Pull anything targeted at this user OR their role; sort newest first
    q = {"$or": [
        {"target_user_id": user.get("id")},
        {"target_role": user.get("role")},
    ]}
    rows = await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit * 4)
    out = []
    for n in rows:
        if not _user_can_see_notification(user, n):
            continue
        n["is_read"] = user.get("id") in (n.get("read_by") or [])
        if unread_only and n["is_read"]:
            continue
        out.append(n)
        if len(out) >= limit:
            break
    unread = sum(1 for n in out if not n["is_read"])
    return {"items": out, "unread": unread}


@api_router.post("/notifications/{nid}/read")
async def mark_notification_read(nid: str):
    user = get_current_user_safe() or {}
    if not user.get("id"):
        raise HTTPException(401, "Not authenticated")
    await db.notifications.update_one(
        {"id": nid},
        {"$addToSet": {"read_by": user["id"]}},
    )
    return {"ok": True}


@api_router.post("/notifications/read-all")
async def mark_all_notifications_read():
    user = get_current_user_safe() or {}
    if not user.get("id"):
        raise HTTPException(401, "Not authenticated")
    q = {"$or": [
        {"target_user_id": user.get("id")},
        {"target_role": user.get("role")},
    ]}
    await db.notifications.update_many(q, {"$addToSet": {"read_by": user["id"]}})
    return {"ok": True}


# ---------------------- WEB PUSH (VAPID + service worker) ----------------------

_VAPID_CACHE: dict = {"public": "", "private_pem": "", "private_raw_b64": "", "claims_email": "mailto:admin@creatorconsultant.online"}


def _vapid_generate_keypair() -> tuple[str, str, str]:
    """Generate a fresh VAPID P-256 keypair. Returns (public_b64url, private_pem, private_raw_b64url).
    pywebpush 2.x wants the *raw 32-byte private* in base64url (not the PEM), so we cache both."""
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import serialization
    key = ec.generate_private_key(ec.SECP256R1())
    private_pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.TraditionalOpenSSL,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode()
    nums = key.public_key().public_numbers()
    raw_pub = b"\x04" + nums.x.to_bytes(32, "big") + nums.y.to_bytes(32, "big")
    public_b64 = base64.urlsafe_b64encode(raw_pub).decode().rstrip("=")
    raw_priv = key.private_numbers().private_value.to_bytes(32, "big")
    private_raw_b64 = base64.urlsafe_b64encode(raw_priv).decode().rstrip("=")
    return public_b64, private_pem, private_raw_b64


async def _ensure_vapid_keys():
    """Persist VAPID keys in app_settings; auto-generate once on first run."""
    doc = await db.app_settings.find_one({"id": "vapid"}, {"_id": 0})
    if doc and doc.get("public") and doc.get("private_pem") and doc.get("private_raw_b64"):
        _VAPID_CACHE.update(doc)
        logger.info("VAPID keys loaded from db")
        return
    public, private_pem, private_raw_b64 = _vapid_generate_keypair()
    doc = {
        "id": "vapid",
        "public": public,
        "private_pem": private_pem,
        "private_raw_b64": private_raw_b64,
        "claims_email": "mailto:admin@creatorconsultant.online",
        "created_at": _now(),
    }
    await db.app_settings.update_one({"id": "vapid"}, {"$set": doc}, upsert=True)
    _VAPID_CACHE.update(doc)
    logger.info("VAPID keypair generated and stored")


async def _send_web_push(subscription: dict, payload: dict) -> bool:
    """Send a single web push. Returns True on success, False otherwise.
    Deletes the subscription row if the endpoint returns 404/410 (subscription gone)."""
    priv = _VAPID_CACHE.get("private_raw_b64")
    if not priv:
        return False
    from pywebpush import webpush, WebPushException
    import json as _json
    try:
        webpush(
            subscription_info={
                "endpoint": subscription["endpoint"],
                "keys": subscription["keys"],
            },
            data=_json.dumps(payload),
            vapid_private_key=priv,
            vapid_claims={"sub": _VAPID_CACHE.get("claims_email", "mailto:admin@example.com")},
            ttl=86400,
        )
        return True
    except WebPushException as e:
        code = getattr(getattr(e, "response", None), "status_code", None)
        if code in (404, 410):
            try:
                await db.push_subscriptions.delete_one({"endpoint": subscription["endpoint"]})
                logger.info(f"Pruned dead push subscription (HTTP {code}): {subscription['endpoint'][:60]}…")
            except Exception as ce:
                logger.error(f"failed to prune dead sub: {ce}")
            return False
        logger.error(f"web push send failed (HTTP {code}): {e}")
        return False
    except Exception as e:
        logger.error(f"web push send failed: {e}")
        return False


async def _push_to_admins(payload: dict):
    """Broadcast a Web Push payload to every admin's active subscription(s)."""
    admin_ids = [u["id"] async for u in db.users.find({"role": "admin"}, {"_id": 0, "id": 1})]
    if not admin_ids:
        return 0
    subs = await db.push_subscriptions.find({"user_id": {"$in": admin_ids}}, {"_id": 0}).to_list(500)
    sent = 0
    for sub in subs:
        ok = await _send_web_push(sub, payload)
        if ok:
            sent += 1
    return sent


@api_router.get("/push/vapid-public")
async def get_vapid_public():
    if not _VAPID_CACHE.get("public"):
        await _ensure_vapid_keys()
    return {"public_key": _VAPID_CACHE.get("public", "")}


class PushSubscriptionIn(BaseModel):
    endpoint: str
    keys: dict  # {p256dh, auth}
    expirationTime: Optional[int] = None


@api_router.post("/push/subscribe")
async def push_subscribe(body: PushSubscriptionIn):
    user = get_current_user_safe() or {}
    if not user.get("id"):
        raise HTTPException(401, "Not authenticated")
    doc = {
        "id": _new_id(),
        "user_id": user["id"],
        "username": user.get("username", ""),
        "role": user.get("role", ""),
        "endpoint": body.endpoint,
        "keys": body.keys,
        "expiration_time": body.expirationTime,
        "user_agent": "",
        "created_at": _now(),
    }
    # Upsert by endpoint so the same browser doesn't pile up duplicates
    await db.push_subscriptions.update_one(
        {"endpoint": body.endpoint},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True}


@api_router.post("/push/unsubscribe")
async def push_unsubscribe(body: dict):
    endpoint = body.get("endpoint")
    if not endpoint:
        raise HTTPException(400, "Missing endpoint")
    await db.push_subscriptions.delete_one({"endpoint": endpoint})
    return {"ok": True}


@api_router.get("/push/status")
async def push_status():
    """Returns whether the current user has any active subscription on this account."""
    user = get_current_user_safe() or {}
    if not user.get("id"):
        raise HTTPException(401, "Not authenticated")
    count = await db.push_subscriptions.count_documents({"user_id": user["id"]})
    return {"subscribed": count > 0, "count": count}


@api_router.post("/push/test")
async def push_test():
    user = get_current_user_safe() or {}
    if not user.get("id"):
        raise HTTPException(401, "Not authenticated")
    subs = await db.push_subscriptions.find({"user_id": user["id"]}, {"_id": 0}).to_list(50)
    if not subs:
        raise HTTPException(400, "You have no active push subscriptions on this device")
    sent = 0
    for sub in subs:
        ok = await _send_web_push(sub, {
            "title": "Creator Consultant",
            "body": "Test push notification — you're all set!",
            "url": "/site-visits",
        })
        if ok:
            sent += 1
    return {"ok": True, "sent": sent, "total": len(subs)}


# ---------------------- HOUSEKEEPING (daily) ----------------------

NOTIFICATION_TTL_DAYS = 30
_housekeeping_scheduler = None


async def _cleanup_old_read_notifications() -> int:
    """Daily job: drop in-app notifications that are older than 30 days AND have been read
    by at least one user. We keep brand-new unread items even if old so nothing slips through."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=NOTIFICATION_TTL_DAYS)).isoformat()
    res = await db.notifications.delete_many({
        "created_at": {"$lt": cutoff},
        "read_by.0": {"$exists": True},   # has at least one reader
    })
    if res.deleted_count:
        logger.info(f"Housekeeping: pruned {res.deleted_count} read notifications older than {NOTIFICATION_TTL_DAYS}d")
    return res.deleted_count


@api_router.post("/notifications/cleanup")
async def notifications_cleanup_now():
    """Manual trigger for the housekeeping job (admin convenience)."""
    user = get_current_user_safe() or {}
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    deleted = await _cleanup_old_read_notifications()
    return {"ok": True, "deleted": deleted}


def _start_housekeeping_scheduler():
    """Run the cleanup once a day at 03:15 UTC."""
    global _housekeeping_scheduler
    if _housekeeping_scheduler is not None:
        return
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    from apscheduler.triggers.cron import CronTrigger
    sched = AsyncIOScheduler(timezone="UTC")
    sched.add_job(_cleanup_old_read_notifications, CronTrigger(hour=3, minute=15), id="cleanup_old_notifications", replace_existing=True)
    sched.start()
    _housekeeping_scheduler = sched
    logger.info("Housekeeping scheduler started — daily 03:15 UTC")


def _stop_housekeeping_scheduler():
    global _housekeeping_scheduler
    if _housekeeping_scheduler is not None:
        _housekeeping_scheduler.shutdown(wait=False)
        _housekeeping_scheduler = None


@api_router.get("/site-visits/{vid}/pdf")
async def site_visit_pdf(vid: str):
    v = await db.site_visits.find_one({"id": vid}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Site visit not found")
    await _enrich_site_visit(v)
    await _preload_visit_photo_bytes(v)
    return _render_site_visit_pdf_response(v)


# Public (no-auth) PDF endpoint — shared via WhatsApp link
@auth_public_router.get("/site-visits/public/{token}/pdf")
async def site_visit_public_pdf(token: str):
    v = await db.site_visits.find_one({"public_token": token}, {"_id": 0})
    if not v:
        raise HTTPException(404, "Site visit not found or link expired")
    await _enrich_site_visit(v)
    await _preload_visit_photo_bytes(v)
    return _render_site_visit_pdf_response(v)


async def _preload_visit_photo_bytes(v: dict) -> None:
    """Mutate v.photos[i] to add `_raw_bytes` for photos that only have a URL.
    This is needed because the PDF renderer is sync but photos now live in
    GridFS (async-only access)."""
    for p in (v.get("photos") or []):
        if p.get("data_url") or p.get("_raw_bytes"):
            continue
        if p.get("url"):
            try:
                p["_raw_bytes"] = await _load_photo_bytes(p["url"])
            except Exception:
                p["_raw_bytes"] = None


def _render_site_visit_pdf_response(v: dict) -> StreamingResponse:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    margin = 18 * mm
    # The Creator Consultant letterhead reserves the top ~5mm (clean white) and
    # the bottom ~32mm (green band + contact details). We keep our body well
    # inside those zones so nothing visually clashes.
    LH_TOP_RESERVE = 22 * mm   # space below top of page where our title sits
    LH_BOTTOM_RESERVE = 34 * mm  # space above the letterhead footer band
    page_bottom_limit = LH_BOTTOM_RESERVE

    def header():
        # Slim title row — no full-width green band (the letterhead already
        # carries the brand). We just print the report title in dark green
        # and the visit code in accent green on the right.
        c.setFillColor(colors.HexColor("#0A2E1F"))
        c.setFont("Helvetica-Bold", 14)
        c.drawString(margin, height - LH_TOP_RESERVE, "SITE VISIT REPORT")
        c.setFillColor(colors.HexColor("#10B981"))
        c.setFont("Helvetica-Bold", 11)
        c.drawRightString(width - margin, height - LH_TOP_RESERVE, v.get("visit_code", ""))
        # Thin underline
        c.setStrokeColor(colors.HexColor("#10B981"))
        c.setLineWidth(0.8)
        c.line(margin, height - LH_TOP_RESERVE - 2 * mm, width - margin, height - LH_TOP_RESERVE - 2 * mm)
        c.setFillColor(colors.black)
        c.setStrokeColor(colors.black)

    header()
    y = height - LH_TOP_RESERVE - 10 * mm
    c.setFont("Helvetica", 9)
    meta_rows = [
        ("Job No", v.get("job_no") or "—", "Date", (v.get("visit_date") or "")[:10]),
        ("Customer", v.get("customer") or "—", "Site Location", v.get("site_location") or v.get("plot_no") or "—"),
        ("DRG No", v.get("drg_no") or "—", "Revision", v.get("revision") or "—"),
    ]
    # Add GPS row if captured
    if v.get("latitude") is not None and v.get("longitude") is not None:
        meta_rows.append((
            "GPS",
            f"{v.get('latitude'):.6f}, {v.get('longitude'):.6f}",
            "Accuracy",
            f"±{v.get('geo_accuracy'):.0f} m" if v.get('geo_accuracy') is not None else "—",
        ))
    for r in meta_rows:
        c.setFont("Helvetica-Bold", 9); c.drawString(margin, y, r[0] + ":")
        c.setFont("Helvetica", 9); c.drawString(margin + 22 * mm, y, str(r[1]))
        c.setFont("Helvetica-Bold", 9); c.drawString(width / 2 + 5 * mm, y, r[2] + ":")
        c.setFont("Helvetica", 9); c.drawString(width / 2 + 25 * mm, y, str(r[3]))
        y -= 6 * mm

    y -= 2 * mm
    c.setFillColor(colors.HexColor("#0A2E1F"))
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin, y, f"Inspection of {v.get('inspection_title', '')}")
    c.setFillColor(colors.black); y -= 8 * mm

    styles = getSampleStyleSheet()
    body = ParagraphStyle("body", parent=styles["Normal"], fontName="Helvetica", fontSize=9, leading=12)
    data = [["Description", "Compliance", "Remark"]]
    for ci in (v.get("checklist") or []):
        comp = (ci.get("compliance") or "").upper()
        data.append([Paragraph(ci.get("label", ""), body), comp, Paragraph(ci.get("remark") or "—", body)])
    if len(data) > 1:
        tbl = Table(data, colWidths=[width - margin * 2 - 60 * mm, 28 * mm, 32 * mm])
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0A2E1F")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (1, 0), (1, -1), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        tw, th = tbl.wrapOn(c, width - margin * 2, height)
        tbl.drawOn(c, margin, y - th)
        y -= th + 6 * mm

    if v.get("observations"):
        if y < page_bottom_limit + 30 * mm:
            c.showPage(); header(); y = height - LH_TOP_RESERVE - 10 * mm
        c.setFont("Helvetica-Bold", 11); c.setFillColor(colors.HexColor("#0A2E1F"))
        c.drawString(margin, y, "Observations:"); c.setFillColor(colors.black)
        y -= 6 * mm
        for i, obs in enumerate(v.get("observations") or [], 1):
            para = Paragraph(f"{i}. {obs}", body)
            w, h = para.wrap(width - margin * 2 - 6 * mm, 100 * mm)
            para.drawOn(c, margin + 4 * mm, y - h + 9)
            y -= h + 2 * mm
            if y < page_bottom_limit + 10 * mm:
                c.showPage(); header(); y = height - LH_TOP_RESERVE - 10 * mm

    if y < page_bottom_limit + 40 * mm:
        c.showPage(); header(); y = height - LH_TOP_RESERVE - 10 * mm
    y -= 8 * mm
    sig_w = 70 * mm; sig_h = 18 * mm
    for label, name_key, sig_key, x_off, phone_key in [
        ("Structural Engineer", "engineer_name", "engineer_signature", margin, None),
        ("Site Person", "site_person_name", "site_person_signature", margin + (width - margin * 2) / 2 + 5 * mm, "site_person_phone"),
    ]:
        c.setFont("Helvetica-Bold", 9); c.setFillColor(colors.black)
        c.drawString(x_off, y, label + ":")
        sig_io = _base64_image_from_data_url(v.get(sig_key, ""))
        if sig_io:
            try:
                c.drawImage(ImageReader(sig_io), x_off, y - sig_h - 2 * mm, width=sig_w, height=sig_h, preserveAspectRatio=True, mask='auto')
            except Exception:
                pass
        c.setFont("Helvetica", 9)
        c.drawString(x_off, y - sig_h - 6 * mm, f"Name: {v.get(name_key) or '—'}")
        if phone_key and v.get(phone_key):
            c.drawString(x_off, y - sig_h - 10 * mm, f"Phone: {v.get(phone_key)}")
    y -= sig_h + 12 * mm

    photos = v.get("photos") or []
    if photos:
        c.showPage(); header(); y = height - LH_TOP_RESERVE - 10 * mm
        c.setFont("Helvetica-Bold", 12); c.setFillColor(colors.HexColor("#0A2E1F"))
        c.drawString(margin, y, "Site Visit Images & Remarks:"); c.setFillColor(colors.black)
        y -= 8 * mm
        img_w = (width - margin * 2 - 6 * mm) / 2; img_h = 55 * mm
        col = 0
        for p in photos:
            img_reader = _photo_to_image_reader(p)
            if not img_reader and p.get("_raw_bytes"):
                try:
                    img_reader = ImageReader(io.BytesIO(p["_raw_bytes"]))
                except Exception:
                    img_reader = None
            if not img_reader:
                continue
            x = margin + col * (img_w + 6 * mm)
            try:
                c.drawImage(img_reader, x, y - img_h, width=img_w, height=img_h, preserveAspectRatio=True, mask='auto')
            except Exception:
                pass
            cap = p.get("caption") or ""
            if cap:
                c.setFont("Helvetica", 8)
                c.drawString(x, y - img_h - 4 * mm, cap[:80])
            col += 1
            if col >= 2:
                col = 0
                y -= img_h + 12 * mm
                if y < page_bottom_limit + img_h + 8 * mm:
                    c.showPage(); header(); y = height - LH_TOP_RESERVE - 10 * mm

    c.showPage(); c.save()
    pdf_bytes = buf.getvalue(); buf.close()
    # Stamp the Creator Consultant letterhead under every page
    pdf_bytes = _apply_letterhead(pdf_bytes)
    fname = f"{v.get('visit_code', 'site_visit')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )





@api_router.get("/")
async def root():
    return {"message": "Creator Consultant API", "status": "ok"}


# Backup module — Google Drive auto-backup
import backup as backup_module
backup_module.init(
    db,
    collections_to_backup=[
        "projects", "clients", "architects", "payments",
        "audits", "audit_payments", "audit_quote_revisions",
        "offers", "activity_log", "quote_revisions", "counters",
        "documents", "document_types",
        "site_visits", "site_visit_templates", "users", "notifications",
        "push_subscriptions", "app_settings",
    ],
)
api_router.include_router(backup_module.router)

# Include the routers
app.include_router(auth_public_router)
app.include_router(api_router)

# Static file mount for uploaded site-visit photos. Served at /api/uploads/site-visits/<fname>
# (mounted AFTER the api_router so explicit endpoints take precedence)
app.mount("/api/uploads", StaticFiles(directory=str(UPLOAD_ROOT)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    # Auto-seed demo data on first run
    try:
        if await db.projects.count_documents({}) == 0:
            logger.info("Seeding demo data on startup...")
            await seed_demo()
        # Separately seed offers if missing (back-compat for existing DBs)
        if await db.offers.count_documents({}) == 0:
            logger.info("Seeding demo offers...")
            clients = await db.clients.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(10)
            if clients:
                sample_offers = [
                    {"offer_type": "Audit", "custom_type": "", "client_id": clients[min(1, len(clients)-1)]["id"],
                     "description": "RCC-Basic-Audit of Row House",
                     "site_location": "Plot 44, Sector 4, Koparkhairane, Navi Mumbai",
                     "base_amount": 28000.0, "gst_percent": 18.0,
                     "file_path": "D:\\CreatorConsultant\\Offers\\2026\\STR-AUDIT-2026-023.pdf",
                     "status": "Pending", "reference_no": "STR/AUDIT/2026/023",
                     "notes": "Half cell + Rebound Hammer + Carbonation + UPV. 50% advance."},
                    {"offer_type": "Steel", "custom_type": "", "client_id": clients[min(2, len(clients)-1)]["id"],
                     "description": "MS Structural Design & Consultancy",
                     "site_location": "TTC IND. Area, Rabale MIDC, Navi Mumbai",
                     "base_amount": 200000.0, "gst_percent": 18.0,
                     "file_path": "D:\\CreatorConsultant\\Offers\\2025\\STR-QUOT-2025-160.pdf",
                     "status": "Pending", "reference_no": "STR/QUOT/2025/160",
                     "notes": "20,000 sq.ft. @ Rs 10/sq.ft."},
                    {"offer_type": "Other", "custom_type": "PMC", "client_id": clients[min(3, len(clients)-1)]["id"],
                     "description": "Project Management Consultancy",
                     "site_location": "Novo Rabale MIDC",
                     "base_amount": 150000.0, "gst_percent": 18.0,
                     "file_path": "D:\\CreatorConsultant\\Offers\\2026\\PMC-offer.pdf",
                     "status": "Pending", "reference_no": "STR/PMC/2026/005",
                     "notes": "Quarterly site visits + BOQ review"},
                ]
                for o in sample_offers:
                    od = {**o, "id": _new_id(), "offer_code": await _next_offer_code(),
                          "offer_date": _now(), "linked_project_id": None, "linked_project_code": "",
                          "created_at": _now()}
                    await _enrich_offer(od)
                    await db.offers.insert_one(od.copy())
    except Exception as e:
        logger.error(f"Seed error: {e}")

    # Seed default document types if missing
    try:
        await _seed_document_types_if_missing()
    except Exception as e:
        logger.error(f"Document types seed error: {e}")

    # Seed default site-visit inspection templates if missing
    try:
        await _seed_sv_templates_if_missing()
    except Exception as e:
        logger.error(f"Site visit templates seed error: {e}")

    # Ensure VAPID keypair exists for Web Push (auto-generates on first run)
    try:
        await _ensure_vapid_keys()
    except Exception as e:
        logger.error(f"VAPID init error: {e}")

    # Start Google Drive auto-backup scheduler
    try:
        await backup_module.start_scheduler()
    except Exception as e:
        logger.error(f"Failed to start backup scheduler: {e}")

    # Start daily housekeeping (cleanup of old read notifications)
    try:
        _start_housekeeping_scheduler()
    except Exception as e:
        logger.error(f"Housekeeping scheduler init failed: {e}")

    # Seed/refresh the admin account from .env
    try:
        await auth_module.seed_admin()
        await auth_module.backfill_user_colors()
    except Exception as e:
        logger.error(f"Admin seed failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    try:
        await backup_module.stop_scheduler()
    except Exception:
        pass
    try:
        _stop_housekeeping_scheduler()
    except Exception:
        pass
    client.close()
