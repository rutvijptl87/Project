from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional
from datetime import datetime, timezone, date
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

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
    architect_id: Optional[str] = None
    architect_name: Optional[str] = ""
    site_location: str = ""
    quoted_amount: float = 0.0
    received_amount: float = 0.0
    outstanding_amount: float = 0.0
    status: str = "Outstanding"
    notes: str = ""
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


async def _enrich_project(p: dict) -> dict:
    """Attach client and architect names, compute outstanding."""
    if p.get("client_id"):
        c = await db.clients.find_one({"id": p["client_id"]}, {"_id": 0})
        p["client_name"] = c["name"] if c else ""
    else:
        p["client_name"] = ""
    if p.get("architect_id"):
        a = await db.architects.find_one({"id": p["architect_id"]}, {"_id": 0})
        p["architect_name"] = a["name"] if a else ""
    else:
        p["architect_name"] = ""
    p["quoted_amount"] = float(p.get("quoted_amount", 0) or 0)
    p["received_amount"] = float(p.get("received_amount", 0) or 0)
    p["outstanding_amount"] = round(p["quoted_amount"] - p["received_amount"], 2)
    # auto-update status
    if p["outstanding_amount"] <= 0 and p["quoted_amount"] > 0:
        p["status"] = "Settled"
    elif p.get("status") not in ("Settled", "Outstanding"):
        p["status"] = "Outstanding"
    return p


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
async def list_projects(search: Optional[str] = None):
    query = {}
    if search:
        s = search.strip()
        query = {
            "$or": [
                {"project_code": {"$regex": s, "$options": "i"}},
                {"name": {"$regex": s, "$options": "i"}},
                {"client_name": {"$regex": s, "$options": "i"}},
                {"architect_name": {"$regex": s, "$options": "i"}},
                {"site_location": {"$regex": s, "$options": "i"}},
            ]
        }
    items = await db.projects.find(query, {"_id": 0}).sort("created_at", -1).to_list(5000)
    for p in items:
        await _enrich_project(p)
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


# ---------------------- DASHBOARD ----------------------
@api_router.get("/dashboard/stats")
async def dashboard_stats():
    projects = await db.projects.find({}, {"_id": 0}).to_list(10000)
    total_quoted = 0.0
    total_received = 0.0
    outstanding_count = 0
    settled_count = 0
    for p in projects:
        await _enrich_project(p)
        total_quoted += p["quoted_amount"]
        total_received += p["received_amount"]
        if p["status"] == "Settled":
            settled_count += 1
        else:
            outstanding_count += 1
    return {
        "total_projects": len(projects),
        "total_clients": await db.clients.count_documents({}),
        "total_architects": await db.architects.count_documents({}),
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
    for p in projects:
        await _enrich_project(p)

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
    except Exception as e:
        logger.error(f"Seed error: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
