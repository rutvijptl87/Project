from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
import bcrypt
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, date
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, Frame, KeepInFrame

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Creator Consultant API")
api_router = APIRouter(prefix="/api")


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
    created_at: str


class ArchitectIn(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    firm: Optional[str] = ""


class Architect(ArchitectIn):
    model_config = ConfigDict(extra="ignore")
    id: str
    created_at: str


class ProjectIn(BaseModel):
    name: str
    client_id: Optional[str] = None
    architect_id: Optional[str] = None
    site_location: Optional[str] = ""
    quoted_amount: float = 0.0
    status: Optional[str] = "Outstanding"  # Outstanding / Settled
    notes: Optional[str] = ""


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    project_code: str  # e.g. CC-0001
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
    quoted_amount: float = 0.0
    received_amount: float = 0.0
    outstanding_amount: float = 0.0
    status: str = "Outstanding"
    notes: str = ""
    archived: bool = False
    # Offer linkage (optional — filled when a project is created from an offer)
    offer_id: Optional[str] = None
    offer_code: Optional[str] = ""
    offer_type: Optional[str] = ""
    offer_file_path: Optional[str] = ""
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


@api_router.post("/clients", response_model=Client)
async def create_client(data: ClientIn):
    doc = data.model_dump()
    doc["id"] = _new_id()
    doc["created_at"] = _now()
    await db.clients.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api_router.put("/clients/{client_id}", response_model=Client)
async def update_client(client_id: str, data: ClientIn):
    result = await db.clients.find_one_and_update(
        {"id": client_id},
        {"$set": data.model_dump()},
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
    total_quoted = sum(p.get("quoted_amount", 0) for p in projects)
    total_received = sum(p.get("received_amount", 0) for p in projects)
    total_outstanding = round(total_quoted - total_received, 2)
    outstanding_count = sum(1 for p in projects if p.get("status") != "Settled")
    settled_count = sum(1 for p in projects if p.get("status") == "Settled")
    return {
        "architect": architect,
        "projects": projects,
        "stats": {
            "total_projects": len(projects),
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
    total_quoted = sum(p.get("quoted_amount", 0) for p in projects)
    total_received = sum(p.get("received_amount", 0) for p in projects)
    total_outstanding = round(total_quoted - total_received, 2)
    outstanding_count = sum(1 for p in projects if p.get("status") != "Settled")
    settled_count = sum(1 for p in projects if p.get("status") == "Settled")
    return {
        "client": client_doc,
        "projects": projects,
        "stats": {
            "total_projects": len(projects),
            "total_quoted": round(total_quoted, 2),
            "total_received": round(total_received, 2),
            "total_outstanding": total_outstanding,
            "outstanding_count": outstanding_count,
            "settled_count": settled_count,
        },
    }


@api_router.post("/architects", response_model=Architect)
async def create_architect(data: ArchitectIn):
    doc = data.model_dump()
    doc["id"] = _new_id()
    doc["created_at"] = _now()
    await db.architects.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api_router.put("/architects/{architect_id}", response_model=Architect)
async def update_architect(architect_id: str, data: ArchitectIn):
    result = await db.architects.find_one_and_update(
        {"id": architect_id},
        {"$set": data.model_dump()},
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


# ---------------------- PROJECTS ----------------------
@api_router.get("/projects", response_model=List[Project])
async def list_projects(search: Optional[str] = None, include_archived: bool = False, archived_only: bool = False):
    query = {}
    if archived_only:
        query["archived"] = True
    elif not include_archived:
        query["archived"] = {"$ne": True}
    if search:
        s = search.strip()
        query["$or"] = [
            {"project_code": {"$regex": s, "$options": "i"}},
            {"name": {"$regex": s, "$options": "i"}},
            {"client_name": {"$regex": s, "$options": "i"}},
            {"architect_name": {"$regex": s, "$options": "i"}},
            {"site_location": {"$regex": s, "$options": "i"}},
        ]
    items = await db.projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    await _enrich_projects_batch(items)
    return items


@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    p = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Project not found")
    await _enrich_project(p)
    return p


@api_router.post("/projects", response_model=Project)
async def create_project(data: ProjectIn):
    doc = data.model_dump()
    doc["id"] = _new_id()
    doc["project_code"] = await _next_project_code()
    doc["received_amount"] = 0.0
    doc["created_at"] = _now()
    await _enrich_project(doc)
    await db.projects.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@api_router.put("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, data: ProjectIn):
    existing = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Project not found")
    update = data.model_dump()
    existing.update(update)
    await _enrich_project(existing)
    await db.projects.update_one({"id": project_id}, {"$set": existing})
    existing.pop("_id", None)
    return existing


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    res = await db.projects.delete_one({"id": project_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Project not found")
    await db.payments.delete_many({"project_id": project_id})
    return {"ok": True}


@api_router.post("/projects/{project_id}/archive")
async def archive_project(project_id: str):
    res = await db.projects.update_one({"id": project_id}, {"$set": {"archived": True}})
    if res.matched_count == 0:
        raise HTTPException(404, "Project not found")
    return {"ok": True, "archived": True}


@api_router.post("/projects/{project_id}/unarchive")
async def unarchive_project(project_id: str):
    res = await db.projects.update_one({"id": project_id}, {"$set": {"archived": False}})
    if res.matched_count == 0:
        raise HTTPException(404, "Project not found")
    return {"ok": True, "archived": False}


# ---------------------- PAYMENTS ----------------------
@api_router.get("/payments", response_model=List[Payment])
async def list_payments(project_id: Optional[str] = None):
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
    doc.pop("_id", None)
    return doc


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
    """Generate Creator RCC Consultant LLP branded offer PDF."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    width, height = A4
    styles = getSampleStyleSheet()
    body_style = ParagraphStyle("body", parent=styles["Normal"], fontSize=10, leading=14, fontName="Helvetica")

    # Header band
    c.setFillColor(BRAND_GREEN)
    c.rect(0, height - 32 * mm, width, 32 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 20)
    c.drawString(18 * mm, height - 15 * mm, "CREATOR RCC CONSULTANT LLP")
    c.setFillColor(BRAND_ACCENT)
    c.setFont("Helvetica", 9)
    c.drawString(18 * mm, height - 21 * mm, "Leading Project Management Consultant  |  Structural Engineer")
    c.setFillColor(colors.white)
    c.setFont("Helvetica", 8)
    c.drawString(18 * mm, height - 27 * mm,
                 "A-001, Siddhivinayak Park, Sector 8A, Plot No. 21, Airoli, Navi Mumbai - 400 708  |  Ph: 9987076241  |  project@creatorconsultant.net")

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
    # Date formatting
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
    subject = f"SUBJECT: Proposal for {offer.get('effective_type', '')} — {offer.get('description', '')[:80]}".strip().rstrip(" —")
    c.drawString(18 * mm, y, subject[:100])
    c.setFillColor(colors.black)

    # Intro
    y -= 9 * mm
    intro = (
        "We, Creator RCC Consultant LLP, are a leading structural engineering and project management "
        "consultancy authorized by BMC, NMMC and TMC. We thank you for the opportunity and are pleased "
        "to submit our offer for the captioned work as detailed below."
    )
    p = Paragraph(intro, body_style)
    w_para, h_para = p.wrap(width - 36 * mm, 40 * mm)
    p.drawOn(c, 18 * mm, y - h_para)
    y -= h_para + 6 * mm

    # Scope / description block
    c.setFillColor(BRAND_GREEN)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(18 * mm, y, "SCOPE OF WORK")
    c.setStrokeColor(BRAND_GREEN)
    c.line(18 * mm, y - 1.5 * mm, width - 18 * mm, y - 1.5 * mm)
    y -= 8 * mm

    scope_text = offer.get("description") or f"{offer.get('effective_type', '')} consultancy services as per industry standard practices."
    if offer.get("notes"):
        scope_text += f"\n\nInclusions / Methodology: {offer['notes']}"
    p = Paragraph(scope_text.replace("\n", "<br/>"), body_style)
    w_para, h_para = p.wrap(width - 36 * mm, 60 * mm)
    p.drawOn(c, 18 * mm, y - h_para)
    y -= h_para + 8 * mm
    c.setFillColor(colors.black)

    # Fees table
    c.setFillColor(BRAND_GREEN)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(18 * mm, y, "PROFESSIONAL FEES")
    c.line(18 * mm, y - 1.5 * mm, width - 18 * mm, y - 1.5 * mm)
    y -= 6 * mm

    # Header row
    c.setFillColor(BRAND_GREEN)
    c.rect(18 * mm, y - 7 * mm, width - 36 * mm, 7 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(22 * mm, y - 5 * mm, "DESCRIPTION")
    c.drawRightString(width - 22 * mm, y - 5 * mm, "AMOUNT (INR)")
    y -= 7 * mm

    base = float(offer.get("base_amount", 0) or 0)
    gst_pct = float(offer.get("gst_percent", 18) or 0)
    gst_amt = round(base * gst_pct / 100.0, 2)
    grand = round(base + gst_amt, 2)

    # Rows
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
        c.drawString(22 * mm, y + 1.5 * mm, label)
        c.drawRightString(width - 22 * mm, y + 1.5 * mm, f"Rs. {_format_inr(amount)}")
        c.setFillColor(colors.black)

    _row(f"{offer.get('effective_type', 'Consultancy')} charges as per scope above", base)
    _row(f"GST @ {gst_pct:.0f}%", gst_amt)
    _row("GRAND TOTAL (Inclusive of GST)", grand, bold=True, highlight=True)

    y -= 12 * mm

    # Payment Terms
    c.setFillColor(BRAND_GREEN)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(18 * mm, y, "PAYMENT TERMS")
    c.line(18 * mm, y - 1.5 * mm, width - 18 * mm, y - 1.5 * mm)
    y -= 6 * mm
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 10)
    half = round(grand / 2, 2)
    terms = [
        f"• 50% Advance on confirmation / appointment letter:  Rs. {_format_inr(half)}",
        f"• 50% on completion of final work / submission of report:  Rs. {_format_inr(grand - half)}",
    ]
    for t in terms:
        y -= 5 * mm
        c.drawString(20 * mm, y, t)

    # T&C
    y -= 10 * mm
    c.setFillColor(BRAND_GREEN)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(18 * mm, y, "TERMS & CONDITIONS")
    c.line(18 * mm, y - 1.5 * mm, width - 18 * mm, y - 1.5 * mm)
    y -= 6 * mm
    c.setFillColor(colors.black)
    c.setFont("Helvetica", 9)
    tcs = [
        "Taxes (GST and any other applicable levies) to be paid by the Client.",
        "Any drill-holes / chipping and their filling during testing are the responsibility of the Owner.",
        "Scope excludes any additional tests/phases not listed above; these will be charged extra by mutual agreement.",
        "Payments to be made in favour of 'CREATOR RCC CONSULTANT LLP'.",
    ]
    for t in tcs:
        y -= 5 * mm
        c.drawString(20 * mm, y, f"• {t}")

    # Bank details
    y -= 10 * mm
    c.setFillColor(BRAND_GREEN)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(18 * mm, y, "BANK DETAILS  |  Kotak Bank  |  A/C: Creator RCC Consultant LLP  |  A/C No: 9987076241  |  IFSC: KKBK0001360  |  Branch: Airoli, Sector 6")
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
    c.drawString(width - 70 * mm, 22 * mm, "Mr. Rutvij Patel — Consulting Structural Engineer")

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


@api_router.get("/")
async def root():
    return {"message": "Creator Consultant API", "status": "ok"}


# Include the router
app.include_router(api_router)

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


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
