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
  - New `engineer` role added to auth (alongside `admin` / `draftsman`). Engineer login lands on `/site-visits`; navbar shows only "Site Visits + Projects"; `/audits /documents /clients /architects /settings` all redirect to `/site-visits`.
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

- ✅ **Notifications + Activity log for Site Visits** (2026-02-28, iteration 11) — closes the "who edited what" + admin-alerting loop.
  - **In-app notification bell** in the navbar (admin-only). Polls `GET /api/notifications` every 30 s, shows unread red badge with count, dropdown lists recent submissions, click navigates to the visit and marks the item read. Bulk "Mark all read" action included. Engineer's role-scoped `target_role='admin'` filter means engineers never see admin-bound notifications.
  - **Notification generated automatically** when an engineer (or any non-admin) creates a visit with `status='submitted'` OR flips an existing visit from `draft → submitted`. Admin self-actions are NOT notified.
  - **Activity log entries** wired into `create_site_visit / update_site_visit / delete_site_visit` (parallels the project/audit activity_log pattern). Events: `VISIT CREATED / VISIT UPDATED / STATUS CHANGED / VISIT DELETED`.
  - **Activity History card** on the SiteVisitDetailPage shows chronological events with color-coded action badges + user + timestamp.
  - **Cascading cleanup** — deleting a site visit also removes any pending notifications referencing it (no dead links).
  - Endpoints: `GET /api/site-visits/{vid}/activity`, `GET /api/notifications`, `POST /api/notifications/{nid}/read`, `POST /api/notifications/read-all`. New Mongo collection: `notifications` (auto-included in Drive backups in the next session).
  - Tested via iteration_11: 27/27 pytest backend (14 new + 13 regression), 100% frontend flows green.

- ✅ **Dashboard SV-stats KPI + Per-Engineer Activity feed in Settings** (2026-02-28, iteration 12) — visibility for admins.
  - New KPI card on the Projects dashboard: **"Site Visits (7d) — <draft> / <submitted>"** with subline "(N draft · N submitted, last 7 days)". Card is wrapped in a `<Link>` to `/site-visits` so it doubles as a shortcut.
  - New endpoint `GET /api/dashboard/site-visit-stats?days=7` returns `{days, total, draft, submitted, by_engineer[10], recent_drafts[5]}`. `days` is clamped 1-90.
  - New endpoint `GET /api/users/{user_id}/activity?limit=100` returns `{activity: [activity_log rows], visits: [site_visits owned by user]}`. Enriches missing `site_visit_code` and `project_code` on the fly. `limit` clamped 1-500.
  - `UserActivityCard` mounted in Settings — user picker dropdown (engineers sorted to top), default-selects the first engineer, two side-by-side panels: "Recent Events" (color-coded action badges, click code to jump to visit) and "Site Visits Created By This User" (status-tagged, click to open). Both panels scroll independently capped at 380px.
  - Tested via iteration_12: 40/40 pytest backend (13 new + 27 regression) — fixed 2 HIGH-priority clamp bugs (the `int(x or N)` short-circuit was treating 0 as None) before close. 100% frontend pass.

- ✅ **Web Push (VAPID) + activity-feed entity links + KPI drill-down** (2026-02-28, iteration 13) — out-of-tab alerts and feed/dashboard polish.
  - **Web Push (P2)**: real out-of-tab notifications via VAPID. On first startup the server auto-generates a P-256 keypair (stored in `app_settings` as `private_pem` + `private_raw_b64` + `public`) so no manual config is required. `pywebpush 2.3.0` is wired to use the *raw base64url* private (the SEC1 PEM that the library historically wanted is no longer accepted in v2.x — a tested-and-fixed gotcha). New endpoints: `GET /api/push/vapid-public`, `POST /api/push/subscribe` (upserts by endpoint), `POST /api/push/unsubscribe`, `GET /api/push/status`, `POST /api/push/test`. Dead subscriptions (HTTP 404/410 from FCM/Apple/Mozilla) are pruned automatically on every failed send. New `usePushSubscription` React hook + Enable/Disable/Test row in the notification bell. The service worker (`/sw.js`) now handles `push` + `notificationclick` events with a logo icon, vibration pattern, and focus-or-open behaviour. The existing `_notify_admins` flow fires both an in-app row AND a real Web Push — so admins get phone-style alerts when an engineer submits a visit, even with the app closed.
  - **Activity feed entity links (P3)**: per-engineer activity rows now link by entity type — `site_visit_id` → `/site-visits/<id>`, `project_id` → `/projects/<id>`, `audit_id` → `/audits/<id>`. Backend enriches `audit_code` on the fly (alongside the existing `project_code` and `site_visit_code` enrichers).
  - **KPI drill-down (P3)**: the SV-stats KPI sub-line ("N draft · N submitted") is now two clickable `<Link>`s that navigate to `/site-visits?status=<v>`. SiteVisitsPage reads the `?status=` query param and toggles a status filter pill bar (All / Draft / Submitted) with counts.
  - Tested via iteration_13: backend 40/40 regression + 12/13 new passing (the failing test exposed the pywebpush 2.x raw-key gotcha which was fixed inline). After fix, end-to-end verified: fake FCM subscription → /push/test → HTTP 410 → pruned (status count dropped 1→0). Frontend 100% pass on KPI drill-down, status pills, activity-feed entity links, NotificationBell push row.

- ✅ **Daily housekeeping + Project-detail SV history card** (2026-02-28, iteration 14) — bookkeeping polish.
  - **Notification auto-cleanup**: new APScheduler `cleanup_old_notifications` job runs daily at 03:15 UTC, deleting in-app notifications older than `NOTIFICATION_TTL_DAYS = 30` that have been read by at least one user. Unread items are NEVER deleted by the cleaner so nothing slips through. New endpoint `POST /api/notifications/cleanup` triggers the same job synchronously (admin-only, 403 for everyone else). Scheduler cleanly stops on supervisor restart.
  - **Site Visit History card on Project Detail**: renders the existing `GET /api/site-visits?project_id=<id>` as a table directly on the project page, with Open links and a "+ New Site Visit" button. Shows a friendly empty-state when no visits exist yet.
  - Tested via iteration_14: 46/46 pytest backend (6 new + 40 regression), 100% frontend pass, zero issues.

- ✅ **"My Visits This Month" chart + photo watermarking** (2026-02-28, iteration 15) — visibility for engineers + tamper-evident on-site photos.
  - **Weekly chart**: new `GET /api/dashboard/my-sv-weekly?month=YYYY-MM&engineer_id=` returns `{month, target_user_id, weeks:[W1..W5 {draft, submitted, total}], by_project[8], total}`. Days 1-7 → W1 … 29-31 → W5. Engineers are auto-scoped to themselves; admins can inspect anyone via `engineer_id`. Invalid month → 400.
  - **MySvWeeklyChart React component** mounted on the Site Visits page above the filter pills. Recharts stacked bar (draft = amber, submitted = green) + month dropdown (last 6 months) + sub-line with total count and top project. 140px-tall card so it doesn't push the table down on mobile.
  - **Photo watermarking**: the existing client-side `compressImage` canvas step now also burns a dark-green badge in the bottom-right corner with the engineer's name + ISO timestamp before the file is uploaded. Engineer name auto-defaults to the logged-in `user.username` so the watermark works even if the user never opens the Signatures section. Verified via PIL pixel inspection: ~8% of bottom-right ROI pixels match the watermark backdrop color (10, 46, 31). Original 5-8 MB phone JPEGs still come out ~200-400 KB.
  - Tested via iteration_15: **55/55 pytest backend** (9 new + 46 regression), **100% frontend** (chart + month re-fetch + engineer auto-fill + watermark file verification). Only findings are 2 cosmetic console warnings from the platform's injector + recharts initial layout tick — both non-blocking and not in our code.

- ✅ **Pin Visit + Smart project picker + Auto-fill + GPS capture** (2026-02-29) — major Site Visit form UX upgrade based on user screenshot feedback.
  - **Pin this visit**: new `POST /api/site-visits/{vid}/pin` toggle and `is_pinned` field. Project Detail page surfaces pinned visits in an amber "Key Inspections" strip at the top so clients/admins see them front-and-center.
  - **Project picker** in Site Visit form is now a search box + dropdown (replaced the native `<select>`). Shows just the **4-digit project code tail** (no `CC-` prefix). Searches across job number, name, customer and site location.
  - **Smart Job No** — typing a 4-digit job number into the Job No field looks up the matching project and auto-fills the Customer and Site Location.
  - Renamed `Plot No` → `Site Location` throughout (form, detail page, table, mobile cards, Excel export, PDF). Old visits' `plot_no` value still appears as a fallback.
  - **GPS capture** via `navigator.geolocation` — new Fetch GPS button stamps lat/lng + accuracy onto the visit. Shown as a Google-Maps link on the detail page + included as an extra row in the PDF.
  - Backend `_enrich_site_visit` now auto-fills blank `customer` / `site_location` on read from the linked project too, so historical visits without those fields look right.

- ✅ **Per-photo GPS + Customer contact strip on Site Visit form** (2026-02-29) — two requested P3 enhancements.
  - **Per-photo GPS**: when an engineer adds a photo, we capture a one-shot lat/lng/accuracy at that moment and store it on the photo record (`SiteVisitPhoto.latitude/longitude/geo_accuracy/captured_at`). If the visit doesn't yet have a GPS fix, the first photo's location is auto-promoted to the visit-level GPS — saves the user a tap. Each photo card (form + detail page) shows a tiny "📍 GPS" badge linking to Google Maps at those coordinates. If the visit already has GPS, subsequent photos reuse it instead of asking for permission again.
  - **Customer contact strip**: below the Customer input on the form, when a project is linked we show clickable phone (`tel:`), WhatsApp (`wa.me/`), and email (`mailto:`) badges — so site engineers can call the customer directly without leaving the form. Phone/email come from the linked client via the existing project enrichment, so no extra DB work.

- ✅ **Site Walk-around Map (P3)** (2026-02-29) — small Leaflet + OpenStreetMap embed on the Site Visit detail page.
  - Plots all photos that have lat/lng as numbered pins (1, 2, 3 …) plus the visit-level GPS as a green star.
  - Auto-fits the map to the bounds of all markers with padding (max zoom 19).
  - Each pin opens a popup with the photo caption + 6-decimal coordinates.
  - Free / no API key — uses `tile.openstreetmap.org` directly. Bundle adds ~180KB (leaflet only, no react-leaflet wrapper).
  - Card hides itself entirely when there are zero geotagged photos AND no visit-level GPS, so old visits look clean.

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
- **P3** — Multi-user with roles (admin / draftsman) + Google Auth if needed
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


---

## Session 16 — 2026-02 (Regression Pass)
- ✅ Verified per-photo GPS exif capture end-to-end (lat/lng persisted in `site_visits.photos[]`)
- ✅ Verified Leaflet `PhotoMap` renders numbered photo markers + green visit-pin
- ✅ Verified Customer phone/email contact strip on `SiteVisitFormPage`
- ✅ Verified smart 4-digit Job No search auto-fills Site Location + Customer
- ✅ Verified Pin-this-visit-to-project on project header
- ✅ Verified web push (VAPID + pywebpush 2.3.0 raw base64url) subscribe & notify
- ✅ Verified engineer RBAC, PDF/Excel exports, dashboard `my-sv-weekly`, notifications, activity log, CRUD regression
- ✅ 27/27 backend pytest pass — `/app/backend/tests/test_iteration16_sv_enhancements.py`
- ✅ Cosmetic: PhotoMap wrapper now exposes `data-testid="photo-map"`

### Still Pending (Backlog)
- **P0 (carried over)**: Email Digest via Resend — 7 AM daily summary + instant admin alerts. Package installed; **user opted to SKIP for now** (no API key provided).
- **P2**: Per-project engineer assignment filtering (engineers currently see all projects; schema supports `assigned_engineer_ids`)
- **P3**: Refactor `/app/backend/server.py` (4624 lines) into routers (`projects.py`, `site_visits.py`, `push_service.py`, `pdf_builder.py`, `export_utils.py`)
- **P3**: Native mobile (Expo/React Native) — only if PWA proves insufficient
- **Known op-issue**: Google Drive Backup needs re-auth from production domain (`creatorconsultant.online`)

### Known Cosmetic (non-blocking)
- React hydration warning from a stray child node inside an `<option>` (could not reproduce in current code; likely cleared)
- Recharts `width(-1)/height(-1)` warning when chart mounts hidden — harmless

### Test Credentials
- Admin: `rutvij0213` / `Rutvij4141*`
- Engineer: `test_engineer` / `EngTest123!`


---

## Session 17 — 2026-02 (Job No + Default Signature + Mobile Notifications)
- ✅ **Project.job_no**: Added optional `job_no` field to `Project`/`ProjectIn` model. Surfaced as a "Job No" input on the Project form, shown as a badge on the Project detail header, and included in `/api/projects?search=` query.
- ✅ **Site Visit Job No auto-fill** now prefers `project.job_no` (e.g. "3324") over the project_code tail ("0126"). Fallback chain: `job_no → name → codeTail(project_code)`. Smart Job No typing also matches by `job_no`.
- ✅ **Default Signature**: New `default_signature` field on User, with `PUT /api/auth/me/signature` (set/clear with size + format validation). New `DefaultSignatureCard` lets the user draw and save it; SiteVisitFormPage auto-loads it on **new** visits (skipped on edit, never overwrites a user-drawn one).
- ✅ **Mobile Notifications**: New `MobileNotificationsCard` exposes a prominent Enable/Disable + Send Test for Web Push using the existing `usePushSubscription` hook. iOS detection shows "Add to Home Screen" hint when needed.
- ✅ **`/profile` route** accessible to every role (admin/draftsman/engineer). New "Profile" nav link in engineer's desktop nav + mobile bottom-nav. Admin's user-info chip in navbar is now a Link to `/profile`. Settings page also mounts both cards for admins.
- ✅ Tests: 13/13 new backend pytest cases pass (`/app/backend/tests/test_iteration17_jobno_signature_profile.py`); iter16 27/27 regression still green; frontend e2e confirms all flows.

### Files added / changed (iter17)
- Backend: `/app/backend/server.py` (Project.job_no + search), `/app/backend/auth.py` (UserPublic.default_signature, `DefaultSignatureIn`, `PUT /auth/me/signature`)
- Frontend new: `DefaultSignatureCard.jsx`, `MobileNotificationsCard.jsx`, `ProfilePage.jsx`
- Frontend edited: `App.js` (route), `Navbar.jsx` (Profile link), `SettingsPage.jsx` (mounts new cards), `SiteVisitFormPage.jsx` (job_no logic + signature pre-fill), `ProjectFormPage.jsx` (Job No input), `ProjectDetailPage.jsx` (Job No badge)

### Backlog (unchanged)
- P0: Email Digest via Resend (user-paused)
- P3: Split server.py into routers
- P3: Native mobile (Expo) if PWA proves insufficient
- Op: Google Drive re-auth from production domain


---

## Session 18 — 2026-02 (Production Hotfix: GridFS Photos + Engineer Projects + Linked Financials)
Four critical issues reported on production (`creatorconsultant.online`) after the first real engineer-submitted site visit. All fixed in preview, verified end-to-end, ready for redeploy.

### Fixes
- **(P0) Engineer's project picker was empty.** Removed `assigned_engineer_ids` filter on `list_projects`. Engineers now browse all non-archived projects (write endpoints still RBAC-locked).
- **(P0) Photos broke when admin viewed engineer's uploads.** Root cause: photos stored on the pod's ephemeral local disk. Fix: switched to **MongoDB GridFS** (bucket `site_visit_photos`). Upload writes to GridFS; new public `GET /api/uploads/site-visits/{filename}` streams from GridFS with disk fallback. PDF builder gets bytes pre-loaded asynchronously via `_preload_visit_photo_bytes`.
- **(P1) Accounting hidden from admin's site visit review.** SiteVisitDetailPage now fetches the linked project and renders a Linked Project card (admin/draftsman only) with Quoted/Received/Outstanding tiles.
- **(NEW) Visit code listings now show Job No.** Both card and table views show `SV-NNNN · Job NNNN`.

### Tests
- 22/22 backend pytest green (`test_iteration18_gridfs_photos_and_engineer_projects.py` + iter17 regression)
- 100% frontend e2e via testing_agent_v3_fork (`iteration_18.json`)
- Photo persistence verified across backend restart

### Production redeploy notes
- Code-only changes — no manual migration
- GridFS bucket auto-creates on first upload
- **Legacy production photos uploaded BEFORE this fix are still lost** (pod disk wiped). Going forward all uploads persist.


---

## Session 19 — 2026-02 (Remove Audit Offer Numbering)

User requested removal of the "Audit Offer" entry from the Documents tab AND from the
Document Number Series in Settings. Audit Offer Numbers are now entered manually on
the Audit form (no auto-numbering).

### Changes
- **Backend** (`/app/backend/server.py`):
  - `_seed_document_types_if_missing` now deletes any existing `AUD-OFR` document type
    on startup (one-shot migration) and no longer back-fills it.
  - `create_audit` no longer auto-generates `audit_offer` from the AUD-OFR counter.
    The engineer types the number directly; blank values are accepted.
- **Frontend**:
  - `AuditsPage.jsx`: removed `offerPreview` state + `/document-types/by-prefix/AUD-OFR/preview`
    call. Placeholder/help text updated to "Type Audit Offer Number" with no auto-fill hint.
  - `DocumentsPage.jsx`: removed `AUD-OFR` from `auditPrefixes` auto-link detection list
    (only `AUD-RPT` remains for the Audit-picker default).

### Verified
- DB: `db.document_types.find({prefix:'AUD-OFR'})` returns nothing.

---

## Session 20 — 2026-02 (Engineer Edit + Compact Revenue Chart + 'Account' Role)

Three independent UI/UX requests delivered in one batch.

### 1. Engineer can now edit submitted site visits
- `SiteVisitDetailPage.jsx` — Edit button is shown for ALL roles (admin/draftsman/engineer) regardless of visit status (draft/submitted). Delete button stays admin/draftsman-only via new `canDelete` flag.

### 2. MonthlyRevenueChart compacted
- Card padding `p-5 → p-3`, `mb-6 → mb-4`
- Container height `280px → 160px`
- Title `text-lg → text-sm`, icon `18 → 14`
- Subtitle removed
- Axis ticks `11 → 9`, Y-axis width `70 → 48`, legend `11 → 10`
- Chart margins `{top:10,right:10,left:0,bottom:10} → {top:4,right:6,left:0,bottom:4}`
- Range dropdown width `130 → 110`, added `fontSize: 11`
- Label `Last {range} months → Last {range} mo`
- Verified card height collapses from ~400px to 245px in production.

### 3. New `account` (read-only) role
**Backend (`/app/backend/auth.py`):**
- `account` accepted by `POST /api/auth/users` and `PUT /api/auth/users/{id}` (validation expanded from 3 → 4 roles).
- `get_current_user` middleware rejects any non-GET request for `account` users (except `/auth/change-password`, `/auth/change-username`, `/auth/logout`) with **403 read-only**.
- `get_current_user` middleware blocks **all** `/api/site-visits*` access for the `account` role.

**Frontend:**
- `App.js` — `account` users have no `/site-visits/*`, `/projects/new`, `/projects/:id/edit`, `/settings` routes.
- `Navbar.jsx` — `account` users see Projects + Audits + Documents + Clients + Architects only (no Site Visits, no Settings). New Project / Record Payment buttons hidden. Purple "ACCOUNT" badge in user chip.
- `ProjectsPage.jsx` — `MonthlyRevenueChart` hidden, all row write-actions (Pay/Edit/Archive/Delete) hidden; only View + Invoice PDF shown. "New Project" and "Import Historic" hidden; "Export Excel" still allowed.
- `MonthlyRevenueChart.jsx` — defensive `useAuth` check renders `null` for `account` role.
- `SiteVisitsPage.jsx` & `SiteVisitDetailPage.jsx` — render `<Navigate to="/" replace />` if user is `account`.
- `UserManagementCard.jsx` — admin can pick "Account (Read-only)" in the new-user form and switch any existing user to the `account` role.

### Verification (curl on production preview)
| Endpoint | account user expectation | result |
|---|---|---|
| `GET /api/projects` | 200 | ✅ 200 |
| `GET /api/dashboard/stats` | 200 | ✅ 200 |
| `GET /api/audits / clients / documents / payments / monthly-revenue` | 200 each | ✅ all 200 |
| `GET /api/site-visits` | 403 | ✅ 403 |
| `POST /api/projects` | 403 | ✅ 403 |
| `DELETE /api/projects/x` | 403 | ✅ 403 |
| `POST /api/auth/users` with `role:"hacker"` | 400 | ✅ "Role must be 'admin', 'draftsman', 'engineer' or 'account'" |

Frontend visual verification — account user lands on `/`, sees correct nav and hidden chart; admin user still sees compact chart at 245px card height.

### Session 20b — Account role refinement
User asked for two follow-ups on the account role:
1. **Hide SITE VISITS (7D) KPI card** on the dashboard for account users → `DashboardKPI` now accepts a `hideSiteVisits` prop, drops the grid from `md:grid-cols-5` to `md:grid-cols-4`, and skips the SV card.
2. **Make Projects fully editable** for account users (Create/Edit/Delete). Everything else (audits/clients/architects/payments/site visits) stays read-only/blocked.

**Backend (`/app/backend/auth.py`)** — middleware now permits POST/PUT/DELETE on `/api/projects` and `/api/projects/{id}/*` for the account role.

**Frontend** — `App.js` re-enables `/projects/new` and `/projects/:id/edit` for account; `Navbar.jsx` shows "New Project" button (still no Record Payment); `ProjectsPage.jsx` shows Edit/Archive/Delete/Invoice row buttons (no Pay) and the New Project + Export Excel header buttons (Import Historic stays hidden).

**Verified:** account user can POST → 200 (created CC-0145), PUT → 200, DELETE → 200. Still blocked: POST /payments → 403, POST /audits → 403, POST /clients → 403, GET /site-visits → 403. UI screenshot confirms 4-column KPI grid and full project action buttons.


- `GET /api/document-types` lists 18 types (no AUD-OFR).
- `POST /api/audits` with `{audit_offer:"MANUAL/AUD/2026/001"}` stores value as-is.
- Settings → User Management page HTML contains no "AUD-OFR" / "Audit Offer" strings.


---

## Session 20c — Remove Invoice/Archive globally + Account = Admin minus Site Visits

**Final shape of the account role:**
- Same as admin in every way EXCEPT:
  - `/api/site-visits*` blocked (403) and no Site Visits nav/route
  - SITE VISITS (7D) KPI card hidden (`hideSiteVisits` prop on `DashboardKPI`)
  - Monthly Revenue Chart hidden

**Global UI cleanup (all roles):**
- Removed per-project-row **Invoice PDF** download button (`btn-invoice-*`)
- Removed per-project-row **Archive** button (`btn-archive-*`)
- Removed Project Detail page **Invoice PDF** + **Archive** buttons (`detail-btn-invoice`, `detail-btn-archive`)
- Header "View Archived" toggle kept so legacy archived projects can still be restored

**Backend (`auth.py`):** Account write-blocking middleware simplified — only blocks `/api/site-visits*`. All other POST/PUT/DELETE on projects, payments, audits, clients, architects, documents allowed.

**Frontend:** App.js / Navbar.jsx / ProjectsPage.jsx / ProjectDetailPage.jsx all collapsed the special-cased `isAccount` branches; account now uses the admin code paths everywhere else.

### Verified
| Account user request | Expected | Actual |
|---|---|---|
| POST /api/payments | not 403 | ✅ 422 (validation) |
| POST /api/audits | 200 | ✅ 200 |
| POST /api/clients | 200 | ✅ 200 |
| POST /api/site-visits | 403 | ✅ 403 |
| GET /api/site-visits | 403 | ✅ 403 |
| UI: Settings nav | VISIBLE | ✅ |
| UI: Record Payment btn | VISIBLE | ✅ |
| UI: SITE VISITS KPI | HIDDEN | ✅ |
| UI: Monthly Revenue Chart | HIDDEN | ✅ |
| UI: Site Visits nav | HIDDEN | ✅ |
| UI: Invoice/Archive row btns | 0 | ✅ (was 89 each) |
| Admin UI: Detail page Invoice/Archive | REMOVED | ✅ |
