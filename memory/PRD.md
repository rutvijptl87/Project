# Creator Consultant — Project & Payment Management System

## Original Problem Statement
> "i want to built such types of software, i am not from this field so dont have any knowledge regarding the coding. so guide me like a baby"

User shared a screenshot of an existing "Creator Consultant" app. Built a modern, polished replica + full functionality.

## User Choices (confirmed)
- **Authentication**: Open app (no login)
- **Features**: Projects CRUD, Clients CRUD, Architects CRUD, Record Payment, Export Excel, Import historic Excel, Dashboard totals, Client phone & email
- **Currency**: Indian Rupees (₹) with Indian number system (1,00,000)
- **Branding**: "Creator Consultant"
- **Design**: Green + white combination (designed as sophisticated deep green #0A2E1F + emerald accent #10B981 + white + IBM Plex/Cabinet Grotesk typography)
- **Demo data**: Seeded (7 projects, 4 clients, 3 architects)

## User Personas
- **Primary**: Consultancy firm owner / office admin tracking quotes, clients, architects, and outstanding payments per project
- **Non-technical user** — needs obvious navigation, one-click actions

## Architecture
- **Backend**: FastAPI (Python) + Motor async MongoDB
- **Frontend**: React 19 + React Router 7 + Tailwind + custom CSS tokens (no shadcn bloat, pure custom components)
- **Data**: MongoDB collections — `projects`, `clients`, `architects`, `payments`, `counters` (sequential CC-0001 IDs)
- **Excel**: `openpyxl` for export/import (multi-sheet workbooks)

## Core Requirements (static)
1. CRUD for Projects, Clients, Architects
2. Record Payment modal that auto-updates received/outstanding/status
3. Dashboard KPIs: Total Quoted, Received, Outstanding, Projects count
4. Indian rupee formatting everywhere
5. Excel export (3-sheet workbook) + import (resolves clients/architects by name)
6. Search across project code / name / client / architect / location
7. Auto-sequential project codes (CC-0001, CC-0002, …)

## What's Been Implemented — 2026-01 (Session 1)
- ✅ Full FastAPI backend at `/app/backend/server.py` with 25+ endpoints under `/api`
- ✅ Auto-seed demo data on first boot (7 projects, 4 clients, 3 architects)
- ✅ Sequential project code generator using MongoDB counters collection
- ✅ Record Payment endpoint that atomically updates `received_amount`, `outstanding_amount`, and auto-flips status to Settled
- ✅ Cascade: delete project → deletes payments; delete/update client/architect → syncs or nullifies in projects
- ✅ Multi-sheet Excel export (Projects + Clients + Architects) with styled headers
- ✅ Excel import that auto-creates missing clients/architects by name, skips duplicates
- ✅ Beautiful green+white UI — Cabinet Grotesk headings, IBM Plex Sans body, IBM Plex Mono for numbers
- ✅ All pages: Projects (dashboard+table), Clients, Architects, New/Edit Project form, Project Detail + payment history, Settings
- ✅ Tested by testing_agent_v3 → 28/28 backend tests pass, all frontend flows pass

## Session 2 — 2026-01 (Iteration 2)
- ✅ **PDF Invoice generation** per project — branded green header, client details, line item, totals box, outstanding highlight. Endpoint: `GET /api/projects/{id}/invoice`
- ✅ **PDF Receipt generation** per payment — received amount banner, running totals (quoted / total received / outstanding), notes, signature line. Endpoint: `GET /api/payments/{id}/receipt`
- ✅ **Sortable columns** on projects table — click any header to sort asc/desc (Project ID, Name, Client, Architect, Quoted, Received, Outstanding, Status)
- ✅ **Archive / soft-delete** — `POST /api/projects/{id}/archive` and `/unarchive`; list endpoint accepts `include_archived` and `archived_only` params; frontend has "View Archived" toggle with Restore and permanent Delete actions
- ✅ Invoice PDF button on each project row + project detail page; Receipt PDF button on each payment in history
- ✅ Tested → 41/41 backend tests pass, all frontend flows pass


## Prioritized Backlog
- **P1** — WhatsApp / SMS share of payment reminder (via Twilio) to clients with outstanding balance
- **P2** — Monthly revenue chart on dashboard (recharts already installed)
- **P2** — Multi-currency support (currently INR only)
- **P3** — Multi-user with roles (admin / staff) + Google Auth if needed
- **P3** — PWA/offline mode

## Next Tasks
- Collect user feedback on initial version
- Gather first real historic data for import testing
- Pick next feature from P1 backlog based on user priority

## File Map
```
/app/backend/
  server.py              (all API + models + seed)
  requirements.txt
/app/frontend/src/
  App.js                 (router)
  index.css              (all custom tokens + tailwind)
  lib/api.js             (axios)
  lib/format.js          (formatINR)
  components/
    Navbar.jsx
    Modal.jsx
    RecordPaymentModal.jsx
    DashboardKPI.jsx
  pages/
    ProjectsPage.jsx
    ProjectFormPage.jsx  (new + edit)
    ProjectDetailPage.jsx
    ClientsPage.jsx
    ArchitectsPage.jsx
    SettingsPage.jsx
```
