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

## What's Been Implemented — 2026-02 (Session continuation)
- ✅ PDF Invoice & Receipt generation via ReportLab (dynamic per project/payment)
- ✅ Sortable columns + Archive / Restore (soft-delete) for Projects
- ✅ Offers module: custom type codes (CC-QTxx), status pipeline, conversion to Project, fully editable Offer PDFs
- ✅ SQLite legacy data import (70 projects + clients + payments + activity logs)
- ✅ Global password protection (bcrypt) — blocks write ops via axios interceptor; Settings page to change password
- ✅ Project Detail redesign: quote revisions, activity timeline, Excel export per project, clickable architect/client links
- ✅ Widened UI to 1600px; contact shortcuts (Call/Email/WhatsApp) in Projects list
- ✅ **Delete confirmation + forced password re-verification** (2026-02) — every delete action (Projects, Clients, Architects, Offers, Project Detail, Payments) requires BOTH a `window.confirm("Are you sure...")` and a red "Confirm Delete — Enter Password" modal that prompts even when the session is already unlocked. Verified via testing agent iteration_7 (8/8 assertions passed).
- ✅ **Google Drive Auto-Backup** (2026-02) — personal OAuth connect, scheduled full-DB JSON dump every 6 hours via APScheduler, local server copy + upload to "Creator Consultant Backups" Drive folder, retention = last 30, manual "Run Backup Now" button, "Download Latest Backup", history view. New files: `/app/backend/backup.py`, `/app/frontend/src/components/BackupCard.jsx`. New env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_DRIVE_REDIRECT_URI`, `FRONTEND_URL`, `BACKUP_FOLDER_NAME`, `BACKUP_INTERVAL_HOURS=6`, `BACKUP_RETENTION_COUNT=30`. New Mongo collections: `google_drive_config`, `backup_log`.
- ✅ **Audits module + Offers removed** (2026-02) — new "Audits" tab replaces "Offers" in the navbar with columns matching user's screenshot: Audit ID (auto AUD-0001, editable), Audit Offer (free text like "Structural Audit"), Report ID (auto RPT-YYYY-001, editable), Name (linked to Clients), Total/Received/Outstanding, Status, Notes, Actions (Invoice/Pay/Edit/Archive/Restore/Delete). Separate `audit_payments` collection. Reuses existing invoice + receipt PDF builders via `_audit_to_project_shape` adapter. Offers tab, page file and all 3 demo offers deleted. Tested via iteration_8: 12/12 backend + 22/22 frontend assertions passed.
- ✅ **Password gate removed + Undo delete (60s)** (2026-02) — per user request, all password protection has been removed (navbar lock indicator, Settings security card, axios interceptor). Every delete now shows "Are you sure?" confirm → optimistically hides the row → displays a green "Undo" toast at the bottom-center with a 60-second countdown. User can undo (no API call made) or wait for auto-commit. Implemented in `/app/frontend/src/lib/undo.jsx` (UndoProvider + UndoBar); applied to ProjectsPage, AuditsPage, ClientsPage, ArchitectsPage, and ProjectDetailPage (both project and payment deletes).
- ✅ **Inline Client/Architect creation** (2026-02) — while filling a Project form or Audit form, user can click "+ New Client" or "+ New Architect" next to the dropdown to open a small modal that creates the entity on the fly and auto-selects it. No navigation to Clients/Architects pages needed. New file: `/app/frontend/src/components/InlinePicker.jsx`. Modal now uses React portal (`createPortal` to `document.body`) to avoid invalid nested-form HTML issue where the child form was bubbling its submit to the outer form.
- ✅ **Backup 404 fix + Restore-from-Backup** (2026-02) — replaced `window.open` with a hidden `<a download>` anchor (`/app/frontend/src/lib/download.js`) across all PDF/Excel/JSON download buttons to eliminate Cloudflare 404 blank-tab issue. New "Restore from Backup" card in Settings lets user upload a JSON backup OR pick from Drive, shows a preview (per-collection "will add" vs "already exists" counts), requires typing `RESTORE` to confirm, auto-takes a safety snapshot, then merge-adds only records that don't already exist. Backend endpoints: `POST /api/backup/restore/preview`, `POST /api/backup/restore` (multipart), `GET /api/backup/drive/backups`, `POST /api/backup/restore/drive`. Idempotency keyed on `id` for every collection (and `_id` for `counters`).
- ✅ **Audit Detail page wired up** (2026-02) — `/audits/:id` route registered in `App.js`. Audit ID code in the Audits table and new "Eye" View button both link to the detail page. AuditDetailPage already had full feature parity with ProjectDetail: KPI cards, contact bar, inline Notes editor, Payment Records w/ delete & receipt PDF, Quote Revisions form + table, Activity History with initials badges, Export Excel / Invoice PDF / Archive / Delete actions. Verified via Playwright smoke test.

- ✅ **Searchable Project/Audit picker in Record Payment modal** (2026-02) — replaced the native `<select>` with a typeahead combobox in `RecordPaymentModal.jsx`. Type to filter all 88+ projects by code/name/client/architect/location with token-prefix matching ("CC" finds CC-0001). Keyboard nav (↑/↓/Enter/Esc), inline clear "X", chip showing selected entity with outstanding amount. Also resolves the prior React `<span>-in-<option>` hydration warning. Works identically for the Audit version.

- ✅ **Documents module** (2026-02) — new "Documents" tab for generating numbered certificates, letters, quotations and reports. Each document type has its own auto-incrementing counter that resets every calendar year. Number format: `CC/{PREFIX}/{YYYY}/{counter:03}` (e.g. `CC/QT/2026/001`, `CC/STAB/2026/047`). 20 default types seeded (Audit Offer, Quotation, PMC Quotation, Inspection Report Letter, Acceptance Letter, Demolition Letter, Supervision/Stability/Earthquake/Commencement/MCGM/Plinth Completion/Column Location/Audit Report/RERA/Lift/General/Scaffolding/Declaration Certificates, To Whomsoever It May Concern). Common form: Document Type, Date, Client (typeahead via InlinePicker), Plot/Place, Phase, Number (free text), Remark, Contact Person, Mobile, Update Date, Other Comments. Per-document branded PDF download. Filter list by type, search by number/client/plot/contact, archive/restore, delete with 60s Undo. Settings → "Document Number Series" card lets owner add/edit/delete types, change prefix/name, toggle yearly reset, reset counter, and preview live next-number. New files: `/app/backend/server.py` (added ~280 lines of routes), `/app/frontend/src/pages/DocumentsPage.jsx`, `/app/frontend/src/components/DocumentTypesCard.jsx`. New Mongo collections: `documents`, `document_types` (both auto-included in Google Drive backups). Verified end-to-end via Playwright smoke test (modal preview shows next number, PDF returns 200, settings card lists all 20 types).

- ✅ **Project Detail WhatsApp shortcut + Monthly Revenue chart** (2026-02) — Client/Architect contact bar on `/projects/:id` now shows Call + Email + **WhatsApp** (auto-pre-fills `Hi {name}, regarding {project name} ({code}) — outstanding is ₹X.XX.`). New `GET /api/dashboard/monthly-revenue?months=12` aggregates `payments` + `audit_payments` into per-month buckets (last 6/12/24 months). New `MonthlyRevenueChart` component (recharts stacked bar — Projects green / Audits dark green) added to Projects dashboard right below the KPI row. Header shows total received in that period + a range selector.

- ✅ **Site Visit Inspection module + Site Engineer role + PWA** (2026-02-28) — major feature for on-site engineers.
  - New `engineer` role added to auth (alongside `admin` / `staff`). Engineer login lands on `/site-visits`; navbar shows only "Site Visits + Projects"; `/audits /documents /clients /architects /settings` all redirect to `/site-visits`.
  - Backend: `site_visits` + `site_visit_templates` Mongo collections. 5 default templates seeded on startup (Column / Slab / Beam / Foundation / Waterproofing). 12 endpoints under `/api/site-visits` and `/api/site-visit-templates` covering full CRUD + photo upload + PDF.
  - Photos uploaded as separate files on disk under `/app/backend/uploads/site-visits/<random>.{jpg|png|webp|heic}` and served via mounted `StaticFiles` at `/api/uploads/`. Random-token filenames so URLs are unguessable. Multipart upload endpoint: `POST /api/site-visits/uploads`.
  - PDF generation via ReportLab — branded Creator RCC Consultant LLP header, checklist table with Yes/No/N/A compliance pills, observations list, photo grid (2-up), and two signature blocks. Endpoint: `GET /api/site-visits/{id}/pdf` (JWT).
  - **WhatsApp sharing**: each visit gets a random `public_token` on create. Public PDF endpoint `GET /api/site-visits/public/{token}/pdf` (mounted on the unauth public router) lets the receiver open the PDF without logging in. Detail page opens `https://wa.me/<phone>?text=...` with a pre-filled message containing the visit code, project info and the public PDF URL.
  - Frontend: 3 new pages — `SiteVisitsPage` (mobile cards + desktop table + floating "+" FAB), `SiteVisitFormPage` (mobile-first: template picker, checklist with Yes/No/N/A + remark, observations, multi-photo upload with caption + delete, two signature pads, sticky save-bar at bottom), `SiteVisitDetailPage` (KPI grid + checklist table + photos + signature view + WhatsApp share modal). New `SignaturePad` canvas component supporting touch + mouse. New `SiteVisitTemplatesCard` in Settings to add/edit/delete checklist templates.
  - **PWA**: `manifest.json` with green theme, `sw.js` minimal service worker (network-first for navigations, no API caching), `<link rel="manifest">` + iOS apple-touch-icon meta tags. Service worker auto-registered in `src/index.js`. App is installable on phone home screen.
  - Tested via iteration_9: 13/13 pytest backend tests pass; frontend ~90% — fixed the single RBAC gap (engineer was able to reach `/settings`).

- ✅ **Site Visit follow-ups — engineer assignment, Excel export, compression, project-detail shortcut, drive backup** (2026-02-28, iteration 10) — five P1/P2/P3 enhancements after the initial SV ship.
  - `projects.assigned_engineer_ids: List[str]` field added (ProjectIn/Project models + multi-select chip UI on ProjectFormPage). The `GET /api/projects` endpoint now scopes by `assigned_engineer_ids: $in user.id` for engineer role — engineers see ONLY their assigned projects.
  - **"+ New Site Visit"** button on Project Detail page action bar → routes to `/site-visits/new?project_id=<id>` with the project dropdown pre-filled. One-tap inspection start.
  - **Excel export** for site visits: `GET /api/site-visits/export/excel?month=YYYY-MM&engineer_id=&project_id=` — 2-sheet workbook (Visits + By Engineer summary). Month picker + Export button on the Site Visits page (admin-only). Engineers are auto-scoped to their own visits.
  - **Image compression** before upload: a canvas resizes to max 1280px on the longest edge, JPEG q=0.82. Big 5-8 MB phone photos become 200-400 KB → much faster site Wi-Fi uploads.
  - **Drive backup** now includes `site_visits`, `site_visit_templates`, and `users` collections.
  - PDF download buttons (in SV row + detail page) switched from `<a href>` to `downloadFile()` helper so axios's bearer token actually rides along.
  - Tested via iteration_10: 23/23 pytest backend (10 new + 13 regression), 100% frontend flows green.

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

## Session 3 — 2026-01 (Contact Shortcuts + Detail Pages + Offers)
- ✅ **Logo updated** to user-provided green building logo (navbar + favicon)
- ✅ **Contact shortcuts** (phone/email/WhatsApp) on Projects table under client and architect names
- ✅ **Architect Detail page** (`/architects/:id`) — click any architect to see their profile + all their projects with KPIs (total projects, quoted, received, outstanding)
- ✅ **Client Detail page** (`/clients/:id`) — same pattern; click client to see all their projects + contact shortcuts
- ✅ **Deployment health check PASS** — fixed N+1 query via `_enrich_projects_batch()` helper; optimized dashboard_stats projection
- ✅ **Offers module** (new) — track proposals before they become projects
  - Offer types: RCC, Steel, Audit, PMC, Retrofitting, **Other (custom)**
  - Fields: reference no., client, description, site location, base amount, GST %, **file path on PC**, status (Pending/Accepted/Rejected), date, notes
  - Auto-calc of GST amount + grand total (live preview in form)
  - **Convert to Project** — one-click creates project with GST-inclusive amount, inherits client/location/notes, stores offer linkage (offer_code, offer_type, file_path)
  - Filter tabs (All/Pending/Accepted/Rejected) + search
  - Copy file-path button on every row
- ✅ **Offer type badge** shown before project name in Projects table + Project Detail page (color-coded per type)
- ✅ **Linked Offer card** on Project Detail — shows offer ID, type, file path with Copy button
- ✅ 3 demo offers auto-seeded (OFR-0001 Audit, OFR-0002 Steel, OFR-0003 PMC)
- ✅ Tested → 69/69 backend tests pass, all frontend flows pass

## Session 6 — 2026-01 (Project Detail redesign: Quote Revisions + Activity Log + Per-project Excel)
- ✅ **Session 4 & 5 features** still working (branded Offer PDF, password gate, SQLite import, fully editable offer PDF)
- ✅ **Project Detail page redesigned** to match user's reference screenshot
  - Header with project name (+ offer type badge), code, **clickable client/architect** links, location, date, status badge
  - 3 color-coded KPI cards: Current Quoted | Total Received | Outstanding
  - Action bar: Export Excel | Invoice PDF | Edit | Archive | Delete
  - Contact bar showing client + architect phone/email
- ✅ **Quote Revisions** feature
  - Inline form on detail page: New Amount + Reason → Revise button
  - History table with # / Old / New / Reason / Date
  - Endpoint `POST /api/projects/{id}/revise-quote` updates project & logs activity
  - Endpoint `GET /api/projects/{id}/revisions`
- ✅ **Activity History**
  - Color-coded action badges (PROJECT CREATED green, PAYMENT ADDED blue, PROJECT UPDATED yellow, PAYMENT DELETED red, QUOTE REVISED yellow, PROJECT ARCHIVED purple)
  - Auto-logged on create / update / delete / archive / unarchive / payment-add / payment-delete / revise-quote
  - 132 legacy activity entries imported from user's SQLite
  - Endpoint `GET /api/projects/{id}/activity`
- ✅ **Delete payment** — new `DELETE /api/payments/{id}` subtracts amount from project received, recomputes outstanding/status, logs activity
- ✅ **Per-project Excel export** — `GET /api/projects/{id}/export` returns 4-sheet workbook (Project Info, Payments, Quote Revisions, Activity)
- ✅ **Cascade delete** — deleting a project now also removes its payments, revisions, and activity
- ✅ Tested → **35/35 new backend tests pass** (iter-6), all frontend flows verified

- ✅ **Session 4 (Offer PDF + Password Gate)** features still fully working: branded Creator RCC Consultant LLP offer PDF + bcrypt password gate with Settings change flow
- ✅ **Imported user's real SQLite DB** — 70 projects, 37 clients, 2 architects, 27 payments (CC-0001 to CC-0072 codes preserved, received amounts + status auto-computed from payments)
- ✅ Total Quoted ₹44,47,492 / Received ₹10,12,500 / Outstanding ₹34,34,992
- ✅ New **POST /api/import/sqlite** endpoint — accepts `.db` file upload, merge or replace mode, validates magic bytes, auto-resolves client/architect by name
- ✅ **Settings → Import SQLite DB** button — upload historic DB files anytime
- ✅ **Offer PDF fully editable** per-offer — all content from header to signature can be overridden:
  - Subject line, Scope of Work (multi-line), **Payment Schedule** (dynamic list of `{label, percent}` rows with add/remove), **Terms & Conditions** (dynamic list with add/remove), Bank Details, Signatory Name, Intro Paragraph, Company Header/Tagline/Address
  - All fields optional; sensible defaults used when blank
  - Live percentage total indicator for payment schedule (warns if not 100%)
  - "Customize PDF Content" collapsible section in Offer modal
- ✅ Tested → **29/29 new backend tests pass** (iter-5), all frontend flows verified

- ✅ **Branded Offer PDF generation** matching Creator RCC Consultant LLP sample format
  - Header with company name + address + phone + email
  - TO section with client details
  - SUBJECT line
  - Intro paragraph (BMC/NMMC/TMC authorized)
  - SCOPE OF WORK block (rendered from offer description + notes)
  - PROFESSIONAL FEES table (Base + GST + Grand Total highlighted row)
  - PAYMENT TERMS (50% advance + 50% completion)
  - TERMS & CONDITIONS (GST responsibility, drill-hole filling clause, etc.)
  - Bank details footer
  - Signature line "For Creator RCC Consultant LLP — Mr. Rutvij Patel, Consulting Structural Engineer"
  - Endpoint: `GET /api/offers/{id}/pdf`
  - "PDF" Download button added to every offer row
- ✅ **Password gate for edit actions** (single shared password, bcrypt-hashed)
  - 3 auth endpoints: `GET /api/auth/status`, `POST /api/auth/verify`, `POST /api/auth/set-password`
  - Axios interceptor auto-prompts on any POST/PUT/DELETE (except /auth/* and GETs)
  - First-time setup flow: if no password set, first edit attempt prompts user to set one
  - Unlock persists in sessionStorage until tab closes
  - Navbar lock indicator (green Unlocked / yellow Locked)
  - Settings → Edit Password card with Set Password / Change Password / Lock Now UI
  - Current-password required when changing (not on first-time setup)
  - Min 4 characters enforced backend-side
- ✅ Tested → **90/90 backend tests pass**, all frontend flows pass
- ✅ `/app/memory/test_credentials.md` updated




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
