# Creator Consultant — Test Credentials

## Login (JWT-based, daily session)

The app now requires login. Visit `/` and you will be redirected to `/login`.

| Field | Value |
|-------|-------|
| URL | `https://beginner-coder-hub-2.preview.emergentagent.com/login` (or `https://creatorconsultant.online/login`) |
| Username | `rutvij0213` |
| Password | `Rutvij4141*` |
| Role | `admin` |

### Site engineer (for RBAC tests)

| Field | Value |
|-------|-------|
| Username | `test_engineer` |
| Password | `EngTest123!` |
| Role | `engineer` |

Engineer lands on `/site-visits` after login, sees only **Site Visits + Projects** in navbar, and `/settings /audits /documents /clients /architects` all redirect to `/site-visits`. Engineers CAN see the **Edit** button on submitted site visits (since 2026-02), but **never** the Delete button.

### Account (read-only viewer) — for RBAC tests

| Field | Value |
|-------|-------|
| Username | `test_account` |
| Password | `AccTest123!` |
| Role | `account` |

Account user has read-only access to Dashboard KPIs, Projects, Audits, Clients, Architects, Payments and Documents. The **Site Visits** module and **Monthly Revenue Bar Chart** are hidden, and all POST/PUT/DELETE requests return 403 (except `/auth/change-password` and `/auth/change-username`).

JWT tokens expire after **24 hours**, so users re-login each day.

## Auth endpoints

- `POST /api/auth/login` (public) — body: `{username, password}` → returns `{token, user}`
- `GET /api/auth/me` (auth) — returns current user
- `POST /api/auth/change-password` (auth) — body: `{current_password, new_password}`
- `POST /api/auth/change-username` (auth) — body: `{new_username}`
- `GET /api/auth/users` (admin) — list all users
- `POST /api/auth/users` (admin) — body: `{username, password, name?, role}`
- `PUT /api/auth/users/{id}` (admin) — body: `{name?, role?, password?}`
- `DELETE /api/auth/users/{id}` (admin) — cannot delete self or last admin

## Sample curl

```
TOKEN=$(curl -s -X POST $URL/api/auth/login -H "Content-Type: application/json" \
  -d '{"username":"rutvij0213","password":"Rutvij4141*"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -H "Authorization: Bearer $TOKEN" $URL/api/projects
```

## Other notes

- Google Drive auto-backup remains as before (connect via Settings).
- Delete still requires "Are you sure?" + 60-second Undo (no password gate).
- `/api/backup/google/callback` is intentionally unauthenticated (Google calls it).
