# Task 1 API Contract
# CBE Enterprise Dashboard — For Task 2 Developer

All APIs are under: `BASE_URL/api/v1/`
Authentication: `Authorization: Bearer <access_token>`
Content-Type: `application/json`

---

## AUTHENTICATION APIS

### AUTH-001 — POST /auth/login
**Purpose:** Authenticate with Employee ID + password (development/mock AD only)
**Auth:** None required
**When active:** `AUTH_PROVIDER=mock` in .env only

**Request body:**
```json
{ "employee_id": "CBE003", "password": "Demo@1234" }
```
**Response 200:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 1800,
  "provider": "mock"
}
```
**Errors:** 401 wrong credentials | 401 account locked | 403 not available in production

---

### AUTH-002 — GET /auth/me  ⭐ PRIMARY TASK 2 DEPENDENCY
**Purpose:** Return the complete identity of the authenticated user
**Auth:** Bearer token required

**Response 200:**
```json
{
  "employee_id": "CBE003",
  "user_id": 3,
  "username": "bekele.alemu",
  "full_name": "Bekele Alemu",
  "email": "bekele.alemu@cbe.com.et",
  "phone": null,
  "role": "REGIONAL_MANAGER",
  "access_level": "REGION",
  "region_id": 1,
  "region_name": "Addis Ababa Region",
  "district_id": null,
  "district_name": null,
  "branch_id": null,
  "branch_name": null,
  "position": "Regional Director",
  "department": "Retail Banking",
  "is_active": true,
  "last_login": "2026-09-17T08:00:00Z",
  "provider": "mock"
}
```
**Errors:** 401 no/invalid token | 401 account inactive

---

### AUTH-003 — GET /auth/permissions  ⭐ TASK 2 DEPENDENCY
**Purpose:** Return all permission codes the current user has
**Auth:** Bearer token required

**Response 200:**
```json
{ "permissions": ["dashboard.view", "dashboard.export", "user.view"] }
```

**Known permission codes (all possible values):**
```
dashboard.view     dashboard.create    dashboard.edit
dashboard.delete   dashboard.publish   dashboard.export
user.view          user.create         user.update        user.disable
role.view          role.manage
permission.view    permission.manage
datasource.view    datasource.create   datasource.edit    datasource.delete
dataset.view       dataset.manage
audit.view
```

---

### AUTH-004 — GET /users/me/data-scope  ⭐ TASK 2 DEPENDENCY
**Purpose:** Return trusted organizational scope. Task 2 uses this to scope dashboard data queries.
**Auth:** Bearer token required
**Important:** This value is derived from the DB, NOT from any request parameter.

**Response 200:**
```json
{
  "access_level": "REGION",
  "region_id": 1,
  "region_name": "Addis Ababa Region",
  "district_id": null,
  "district_name": null,
  "branch_id": null,
  "branch_name": null,
  "department_scope": ["ALL"],
  "is_head_office": false
}
```

**access_level values and their meaning:**
```
HEAD_OFFICE → region_id/district_id/branch_id all null → unrestricted
REGION      → region_id set → can see all data within their region
DISTRICT    → district_id set → can see all data within their district
BRANCH      → branch_id set → can see only their branch data
```

---

### AUTH-005 — POST /auth/refresh
**Purpose:** Issue a new access token from a valid refresh token
**Auth:** None (uses refresh_token in body)

**Request body:** `{ "refresh_token": "eyJ..." }`
**Response 200:** Same as AUTH-001 response

---

### AUTH-006 — GET /auth/session
**Purpose:** Session metadata — provider type, active status
**Auth:** Bearer token required

**Response 200:**
```json
{
  "user_id": 3,
  "employee_id": "CBE003",
  "username": "bekele.alemu",
  "full_name": "Bekele Alemu",
  "role": "REGIONAL_MANAGER",
  "provider": "mock",
  "is_active": true,
  "last_login": "2026-09-17T08:00:00Z"
}
```

---

### AUTH-007 — GET /auth/ad/login
**Purpose:** Initiate CBE OIDC login (redirect to CBE IdP)
**Auth:** None required
**When active:** `AUTH_PROVIDER=cbe_ad` only
**Response:** 302 redirect to CBE Identity Provider

---

### AUTH-008 — GET /auth/ad/callback
**Purpose:** OIDC callback from CBE IdP. Validates state, exchanges code, issues JWT.
**Auth:** None (OIDC flow)
**Response:** 302 redirect to `{FRONTEND_URL}/auth/callback#access_token=...&refresh_token=...`
**Note:** Tokens in URL fragment (not query string) for security.

---

## USER APIS

### USER-001 — GET /admin/users
**Purpose:** List users with search and filters
**Auth:** Bearer token | Permission: `user.view`

**Query params:**
- `page` (int, default 1)
- `page_size` (int, default 25, max 100)
- `search` (string — searches username, full_name, email)
- `access_level` (HEAD_OFFICE | REGION | DISTRICT | BRANCH)
- `is_active` (bool)
- `role` (role name string)

**Response 200:**
```json
{
  "items": [
    {
      "id": 3,
      "username": "bekele.alemu",
      "full_name": "Bekele Alemu",
      "email": "bekele.alemu@cbe.com.et",
      "employee_id": "CBE003",
      "access_level": "REGION",
      "region_id": 1, "region_name": "Addis Ababa Region",
      "district_id": null, "district_name": null,
      "branch_id": null, "branch_name": null,
      "is_active": true,
      "role": "REGIONAL_MANAGER",
      "failed_login_attempts": 0,
      "locked_until": null,
      "ad_provider": "mock",
      "last_login": "2026-09-17T08:00:00Z",
      "created_at": "2026-09-16T07:00:00Z"
    }
  ],
  "total": 9,
  "page": 1,
  "page_size": 25
}
```

---

### USER-002 — POST /admin/users
**Purpose:** Create a new user
**Auth:** Bearer token | Permission: `user.create`

**Request body:**
```json
{
  "username": "dawit.kebede",
  "full_name": "Dawit Kebede",
  "email": "dawit.kebede@cbe.com.et",
  "phone": "+251911000000",
  "employee_id": "CBE010",
  "password": "Pass@1234",
  "access_level": "DISTRICT",
  "region_id": 1,
  "district_id": 1,
  "branch_id": null,
  "role_id": 4,
  "is_active": true
}
```
**Response 201:** Full user object (same as items in USER-001)
**Errors:** 400 username/email/employee_id duplicate | 400 invalid org hierarchy | 422 validation

---

### USER-003 — GET /admin/users/{user_id}
**Auth:** `user.view`
**Response 200:** Single user object

---

### USER-004 — PUT /admin/users/{user_id}
**Auth:** `user.update`
**Request body:** Same fields as POST but all optional. Omit `username` and `password`.

---

### USER-005 — PATCH /admin/users/{user_id}/status
**Auth:** `user.disable`
**Request body:** `{ "is_active": false }`
**Response 200:** `{ "id": 3, "is_active": false }`

---

### USER-006 — GET /admin/users/{user_id}/scope
**Purpose:** Get a user's org scope (for Task 2 data-scoping logic)
**Auth:** `user.view`
**Response 200:**
```json
{
  "user_id": 3,
  "access_level": "REGION",
  "region_id": 1, "region_name": "Addis Ababa Region",
  "district_id": null, "district_name": null,
  "branch_id": null, "branch_name": null,
  "department_scope": ["ALL"]
}
```

---

### USER-007 — PUT /admin/users/{user_id}/scope
**Auth:** `user.update`
**Request body:**
```json
{
  "access_level": "DISTRICT",
  "region_id": 1,
  "district_id": 2,
  "branch_id": null,
  "department_codes": ["RETAIL", "CORPORATE"]
}
```
**Audit:** Logged as `USER_SCOPE_CHANGED`

---

### USER-008 — GET /admin/users/{user_id}/permissions
**Purpose:** Get all permissions and dashboard access for a user
**Auth:** `user.view`
**Response 200:**
```json
{
  "user_id": 3,
  "permissions": ["dashboard.view", "dashboard.export"],
  "dashboard_permissions": [
    { "dashboard_id": 1, "role_id": 3, "can_view": true, "can_export": false }
  ]
}
```

---

## BULK IMPORT APIS

### IMPORT-001 — GET /import/template
**Purpose:** Download the Excel template for bulk user import
**Auth:** Any authenticated user
**Response:** Excel file download (cbe_user_import_template.xlsx)

---

### IMPORT-002 — POST /import/users
**Purpose:** Import users from Excel file
**Auth:** `user.create`
**Content-Type:** `multipart/form-data`
**Query params:** `dry_run=true` (validate only) | `strict=true` (reject all on any error)

**Form field:** `file` — Excel .xlsx file

**Response 200:**
```json
{
  "summary": {
    "total_rows": 10,
    "created": 8,
    "skipped": 1,
    "errors": 1,
    "dry_run": false
  },
  "results": [
    { "row": 2, "username": "abebe.kebede", "email": "...", "status": "created", "role": "BRANCH_MANAGER", "access_level": "BRANCH" },
    { "row": 3, "username": "duplicate", "email": "...", "status": "skipped", "reason": "Username already exists" },
    { "row": 4, "username": "badrow", "email": "...", "status": "error", "reason": "District code 'X99' not found" }
  ]
}
```

**Excel columns:** username | full_name | email | phone | employee_id | access_level | region_code | district_code | branch_code | role_name | password

---

## ORGANIZATION APIS

### ORG-001 — GET /admin/organizations
**Purpose:** Full org tree (regions → districts → branches)
**Auth:** `user.view`

**Response 200:**
```json
[
  {
    "id": 1, "code": "R01", "name": "Addis Ababa Region", "status": "ACTIVE",
    "districts": [
      {
        "id": 1, "code": "D01", "name": "Bole District", "status": "ACTIVE",
        "branches": [
          { "id": 1, "code": "B001", "name": "Bole Main Branch", "status": "ACTIVE" }
        ]
      }
    ]
  }
]
```

---

### ORG-002 — GET /regions (scoped to user)
### ORG-003 — GET /regions/{id}/districts (scoped)
### ORG-004 — GET /districts/{id}/branches (scoped)

These return only org units within the authenticated user's scope.
A REGION user only sees their own region.
A BRANCH user only sees their own branch.

---

## ROLE APIS

### ROLE-001 — GET /admin/roles
**Auth:** `role.view`
**Response:** `[{ "id": 3, "name": "REGIONAL_MANAGER", "display_name": "Regional Manager", "is_system": true, "is_active": true }]`

### ROLE-002 — GET /admin/roles/{id}/permissions
**Auth:** `role.view`
**Response:** `[{ "id": 1, "code": "dashboard.view", "name": "View Dashboards", "category": "Dashboard" }]`

---

## AUDIT APIS

### AUDIT-001 — GET /audit
**Auth:** `audit.view`
**Query params:** `action`, `user_id`, `resource_type`, `date_from`, `date_to`, `page`, `page_size`

### AUDIT-002 — GET /audit/security-events
**Auth:** `audit.view`
Returns only: LOGIN_FAILED, UNAUTHORIZED_ACCESS_ATTEMPT, USER_SCOPE_CHANGED, PERMISSION_DELETED

### AUDIT-003 — GET /audit/users/{user_id}
### AUDIT-004 — GET /audit/dashboards/{dashboard_id}

---

## ERROR RESPONSE FORMAT

All errors return:
```json
{ "detail": "Human-readable error message" }
```

| Code | Meaning |
|------|---------|
| 400 | Bad request — invalid input or business rule violation |
| 401 | Authentication required or token invalid/expired |
| 403 | Authenticated but missing permission |
| 404 | Resource not found |
| 409 | Conflict (duplicate username/email) |
| 422 | Validation error (field-level) |
| 500 | Internal server error |
| 503 | External service unavailable (e.g. CBE AD not configured) |

---

## PORTAL INTEGRATION

The platform entry point for the CBE intranet portal:

```
http://analytics.cbe.com.et/
```

**Integration options (in order of preference):**
1. **Simple link** — `<a href="http://analytics.cbe.com.et/" target="_blank">CBE Enterprise Dashboard</a>`
2. **HTML tile** — see `docs/intranet-integration.md`
3. **iframe embed** — `<iframe src="http://analytics.cbe.com.et/portal-embed.html" width="320" height="220">`

**OIDC SSO integration (production):**
- User clicks link on intranet → lands on `http://analytics.cbe.com.et/login`
- Login page has "Sign in with CBE Active Directory" button (shown when `VITE_AUTH_PROVIDER=cbe_ad`)
- Button triggers `GET /api/v1/auth/ad/login` → browser redirect to CBE IdP
- After AD authentication → redirect back → user lands on `/dashboards`

---

## PRODUCTION AD/OIDC CONFIGURATION

Set these in `/opt/analytics-platform/backend/.env`:

```env
AUTH_PROVIDER=cbe_ad
OIDC_ISSUER_URL=https://login.cbe.com.et/oauth2   # from CBE IT
OIDC_CLIENT_ID=analytics-platform-prod             # from CBE IT
OIDC_CLIENT_SECRET=<secret from CBE IT>            # keep secret
OIDC_REDIRECT_URI=https://analytics.cbe.com.et/api/v1/auth/ad/callback
OIDC_SCOPES=openid profile email
OIDC_USERNAME_CLAIM=preferred_username             # or "employeeID" — confirm with CBE IT
```

Set in `frontend/.env.production`:
```env
VITE_AUTH_PROVIDER=cbe_ad
```

**What CBE IT must provide:**
- OIDC Issuer URL
- Client ID
- Client Secret
- Confirm which AD claim carries the employee sAMAccountName

**What to give CBE IT:**
- Application: CBE Enterprise Dashboard
- Redirect URI: `https://analytics.cbe.com.et/api/v1/auth/ad/callback`
- Flow: Authorization Code + OIDC
- Scopes: openid profile email

---

## WHAT TASK 2 CONSUMES FROM TASK 1

| API | Task 2 Purpose |
|-----|---------------|
| `GET /auth/me` | Load full user identity after login |
| `GET /auth/permissions` | Determine which UI elements to show/hide |
| `GET /users/me/data-scope` | Scope all dashboard data queries to user's org level |
| `GET /admin/users/{id}/scope` | Admin view of a user's data scope |
| `GET /admin/organizations` | Org tree for filter dropdowns |
| `GET /regions` / `/districts` / `/branches` | Scoped filter dropdown options |
| `GET /admin/roles` | Dashboard permission assignment UI |
| `GET /admin/dashboard-permissions` | Check who can view which dashboard |

**The data scope pattern Task 2 must follow:**
```
1. GET /users/me/data-scope → { access_level: "BRANCH", branch_id: 1 }
2. All analytical queries must add WHERE branch_id IN (1)
3. User cannot override this by passing branch_id=999 in request
4. Backend (data_scope.py → validate_org_filter_request) enforces this
```
