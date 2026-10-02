# CBE Enterprise Analytics Platform
## Complete Technical Explanation — 12 Sections
## For Team Presentation, CBE IT Integration, and Future Reference

---

## SECTION 1: WHAT IS THIS PLATFORM?

A single internal web application where any CBE analytics team can:
1. Connect their data (Oracle, PostgreSQL, internal API)
2. Build dashboards visually — no coding required
3. Control who sees what based on role and organizational level
4. All through a browser on the CBE internal network

**The core innovation:** Instead of building a separate app for every project
(FCY Leads, Deposit Attrition, Branch Performance), one platform serves all of them.
A data team registers their table, designs the dashboard, and publishes it.
No developer needed for each new project.

---

## SECTION 2: SYSTEM ARCHITECTURE

```
CBE Employee Browser
        |
        |  http://analytics.cbe.com.et
        v
+-----------------------------------+
|  NGINX (port 80/443)              |
|  /        → React static files   |
|  /api/*   → FastAPI :8000         |
+-----------------------------------+
        |                |
        v                v
 React Frontend     FastAPI Backend (Python)
 (runs in browser)       |
                 +-------+--------+
                 v       v        v
           PostgreSQL  Oracle  Internal
           (app DB)   (data)   APIs
```

| Layer | Technology | Role |
|---|---|---|
| Frontend | React + TypeScript + Vite | What users see and interact with |
| Backend | Python + FastAPI | Business logic and security |
| App Database | PostgreSQL 18 | Users, dashboards, config, audit logs |
| Analytical Data | Oracle / PostgreSQL | Project data (FCY results, attrition, etc.) |
| Reverse Proxy | Nginx | Routes traffic, serves static files |

---

## SECTION 3: THE BACKEND

### What it does
The backend is the brain of the system. It:
- Receives requests from the browser
- Verifies who is making the request (authentication)
- Checks what they are allowed to do (authorization)
- Queries the database
- Returns data as JSON

### Folder structure
```
backend/app/
  main.py                   <- Starts the FastAPI application
  config/
    settings.py             <- Reads .env file. All config in one place.
  database/
    session.py              <- PostgreSQL connection pool
    data_access.py          <- Abstraction layer: Oracle / PostgreSQL / API
  models/                   <- Python classes that map to database tables
    user.py                 <- users table
    role.py                 <- roles, user_roles, role_permissions tables
    dashboard.py            <- dashboards, widgets, filters, permissions
    organization.py         <- regions, districts, branches
    audit_log.py            <- audit_logs table
  api/v1/                   <- All API endpoints (URLs)
    auth.py                 <- Login, logout, /me, permissions
    users.py                <- User management
    admin.py                <- Admin operations
    dashboards.py           <- Dashboard CRUD + workflow
    dashboard_data.py       <- Runtime data queries for widgets
    organization.py         <- Regions, districts, branches
    audit.py                <- Audit log endpoints
  security/
    auth_provider.py        <- Abstract interface for all auth providers
    mock_ad_provider.py     <- Development: fake CBE AD
    cbe_ad_provider.py      <- Production: real CBE AD via OIDC
    identity_resolver.py    <- Loads role/permissions/scope from DB
    data_scope.py           <- Enforces org-level data restrictions
    dependencies.py         <- FastAPI auth guards (get_current_user etc.)
    jwt.py                  <- Creates and validates JWT tokens
    password.py             <- bcrypt password hashing
  services/
    query_engine.py         <- Builds and executes widget data queries
    audit_service.py        <- Writes events to audit_logs table
```

### How a request flows through the backend

Example: GET /api/v1/auth/me

```
Browser sends: GET /api/v1/auth/me
               Header: Authorization: Bearer eyJ...
    |
    v
router.py matches URL -> routes to auth.py -> get_me() function
    |
    v
dependencies.py -> get_current_user()
    reads Authorization header
    decodes JWT token -> gets user_id = 3
    loads User from PostgreSQL
    checks is_active = true
    returns User object
    |
    v
get_me() builds response:
    {
        "employee_id": "CBE003",
        "full_name": "Bekele Alemu",
        "role": "REGIONAL_MANAGER",
        "access_level": "REGION",
        "region_name": "Addis Ababa Region"
    }
    |
    v
Returns JSON to browser
```

---

## SECTION 4: THE DATABASE

### Two types of data

**Application Database (PostgreSQL — we manage this):**
- Users, passwords, roles, permissions
- Dashboard configurations (layout, widgets, filters)
- Organization hierarchy (regions, districts, branches)
- Audit logs, authentication sessions

**Analytical Data Sources (Oracle/PostgreSQL — project teams own this):**
- Actual business data: FCY results, attrition predictions, etc.
- We NEVER copy this data into our database
- We only query it at runtime when a widget requests data

### Key tables explained

```
users                  <- CBE employees registered in the platform
roles                  <- ADMIN, REGIONAL_MANAGER, BRANCH_MANAGER, VIEWER...
permissions            <- dashboard.view, user.create, audit.view...
user_roles             <- which user has which role
role_permissions       <- which role has which permissions

regions                <- Addis Ababa Region, Oromia Region, Amhara Region
districts              <- Bole District, Kirkos District, Adama District...
branches               <- Bole Main Branch, Bole Airport Branch...

dashboards             <- FCY Lead Dashboard, Branch Performance...
dashboard_versions     <- v1 PUBLISHED, v2 DRAFT (multiple versions per dashboard)
dashboard_widgets      <- KPI "Total Leads", Bar Chart "Leads by Region"
dashboard_filters      <- Region filter, Date Range filter, Status filter
dashboard_permissions  <- REGIONAL_MANAGER can VIEW FCY dashboard

datasets               <- Registered data tables/views from external sources
dataset_fields         <- Field metadata: type (NUMERIC, DATE), aggregation rules
data_sources           <- Oracle/PostgreSQL connections (credentials encrypted)

audit_logs             <- Every significant action logged with timestamp + user
mock_ad_users          <- Development-only fake CBE AD users (CBE001-CBE007)
authentication_sessions <- Login/logout history with IP address
```

### How dashboard configuration is stored

The dashboard designer saves widget configuration as JSON.
The query engine reads this JSON and builds SQL queries.

```
Widget: "Total Leads" KPI
Config stored in DB:
{
    "field": "customer_id",
    "aggregation": "COUNT",
    "number_format": "number"
}
Query engine builds: SELECT COUNT(customer_id) FROM fcy_lead_results WHERE region_id IN (1)

Widget: "Leads by Lead Type" Bar Chart
Config stored in DB:
{
    "dimension": "lead_type",
    "metric": "customer_id",
    "aggregation": "COUNT",
    "sort_order": "DESC"
}
Query engine builds:
    SELECT lead_type, COUNT(customer_id)
    FROM fcy_lead_results
    WHERE region_id IN (1)
    GROUP BY lead_type
    ORDER BY 2 DESC
```

---

## SECTION 5: THE API LAYER

### What is an API?
An API (Application Programming Interface) is a set of URLs the browser calls
to get or send data. Each URL does one specific thing.

All our APIs start with: /api/v1/
The "v1" means version 1. Future versions (v2) can be added without breaking existing clients.

### Complete list of APIs

```
AUTHENTICATION
  POST /api/v1/auth/login           <- Log in with Employee ID + password
  GET  /api/v1/auth/me              <- Who am I? (full profile)
  GET  /api/v1/auth/permissions     <- What can I do? (permission codes)
  GET  /api/v1/users/me/data-scope  <- What data scope do I have?
  POST /api/v1/auth/refresh         <- Get new access token silently
  POST /api/v1/auth/logout          <- Log out
  GET  /api/v1/auth/session         <- Session metadata
  GET  /api/v1/auth/ad/login        <- Production: start CBE OIDC flow
  GET  /api/v1/auth/ad/callback     <- Production: CBE AD redirects here

ORGANIZATION (filtered by user's own scope)
  GET  /api/v1/regions
  GET  /api/v1/regions/{id}/districts
  GET  /api/v1/districts/{id}/branches

DASHBOARDS — runtime (what users see)
  GET  /api/v1/dashboard/{code}                      <- Dashboard config + layout
  GET  /api/v1/dashboard/{code}/widgets/{id}/data   <- Widget data
  GET  /api/v1/dashboard/{code}/widgets/{id}/export <- CSV / Excel / PDF export

DASHBOARDS — designer/admin
  GET  /api/v1/dashboards                   <- List dashboards
  POST /api/v1/dashboards                   <- Create new dashboard
  PUT  /api/v1/dashboards/{id}/versions/{v} <- Save draft version
  POST /api/v1/dashboards/{id}/submit       <- Submit for approval
  POST /api/v1/dashboards/{id}/approve      <- Approve
  POST /api/v1/dashboards/{id}/publish      <- Publish (go live)
  POST /api/v1/dashboards/{id}/unpublish    <- Take offline
  POST /api/v1/dashboards/{id}/duplicate    <- Copy a dashboard

ADMINISTRATION
  GET/POST        /api/v1/admin/users
  GET/PUT/PATCH   /api/v1/admin/users/{id}
  PUT             /api/v1/admin/users/{id}/scope
  GET             /api/v1/admin/users/{id}/permissions
  GET/POST/PUT    /api/v1/admin/roles
  DELETE          /api/v1/admin/roles/{id}
  PUT             /api/v1/admin/roles/{id}/permissions
  GET/POST/PUT    /api/v1/admin/permissions
  GET/POST/PUT    /api/v1/admin/departments
  GET/POST/PUT    /api/v1/admin/positions
  GET             /api/v1/admin/organizations
  GET/POST/PUT/DELETE /api/v1/admin/dashboard-permissions

AUDIT
  GET /api/v1/audit                        <- All audit logs (filterable)
  GET /api/v1/audit/{id}                   <- Single audit event
  GET /api/v1/audit/users/{user_id}        <- Audit trail for a user
  GET /api/v1/audit/dashboards/{id}        <- Audit trail for a dashboard
  GET /api/v1/audit/security-events        <- Failed logins, scope violations
```

### How APIs call each other internally

APIs do not work in isolation. They call shared security services:

```
Any protected endpoint
    |
    v
get_current_user()         <- WHO is making this request? (from JWT)
    |
    v
require_permission("x.y") <- CAN they do this action? (from role_permissions)
    |
    v
get_data_scope()           <- WHAT data are they allowed to see? (from access_level)
    |
    v
query_engine.py            <- BUILD the SQL with scope enforced
    |
    v
data_access.py             <- EXECUTE against Oracle or PostgreSQL
    |
    v
Return data to frontend
```

---

## SECTION 6: THE AUTHENTICATION SYSTEM

### Development vs Production

| | Development (right now) | Production (after CBE IT) |
|---|---|---|
| How user logs in | Employee ID + Demo@1234 | Browser redirects to CBE AD |
| Password stored? | Hashed in mock_ad_users table | NEVER. CBE AD handles it. |
| What changes to switch | AUTH_PROVIDER=cbe_ad in .env | Nothing else |
| Code changes? | Zero | Zero |

### How JWT (JSON Web Token) works

```
Step 1: User logs in with CBE003 / Demo@1234

Step 2: Backend verifies password and creates a token:
{
    "sub": "CBE003",            <- employee ID
    "user_id": 3,
    "role": "REGIONAL_MANAGER",
    "access_level": "REGION",
    "region_id": 1,
    "exp": 1234567890           <- expires in 30 minutes
}
Signed with a secret key. Cannot be faked without the secret.

Step 3: Token looks like: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJDQkUwMDMifQ.xyz

Step 4: Frontend stores it in localStorage

Step 5: EVERY future API call includes:
        Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...

Step 6: Backend decodes it on every request -> knows who you are

Step 7: Token expires after 30 min -> frontend silently calls /auth/refresh
        -> gets new token -> user never notices -> session continues

Step 8: Refresh token also expires (8 hours) -> user must log in again
```

### Organizational data security (MOST CRITICAL)

This prevents a Branch Manager in Bole from seeing Gondar branch data.

```python
# User: CBE005, Branch Manager, branch_id = 1

scope = get_data_scope(user)
# Result: scope.branch_ids = [1]

# User sends request: GET /dashboard/fcy-lead/widgets/1/data?branch_id=999

# Backend:
validate_org_filter_request(requested_branch_id=999, scope)
# Result: 999 is NOT in [1] -> REJECTED -> 403 Forbidden

# Even if the request passes, the SQL always adds:
WHERE branch_id IN (1)
# No matter what the user sends, the scope overrides it.

# HEAD_OFFICE user sees everything:
scope.is_unrestricted = True -> no WHERE clause added
```

---

## SECTION 7: THE FRONTEND

### What React does
React runs in the browser. It builds the user interface, calls APIs,
and updates the screen without reloading the entire page.

### Folder structure
```
frontend/src/
  main.tsx / App.tsx      <- Entry points. Theme, routing, providers.
  api/                    <- All API call functions (one file per backend section)
    authApi.ts            <- login, logout, getCurrentUser, getPermissions
    adminApi.ts           <- all admin operations
    dashboards.api.ts     <- dashboard config and widget data
    organization.api.ts   <- regions, districts, branches
    client.ts             <- Axios: automatically adds JWT to every request
  auth/                   <- Authentication state for the whole app
    AuthContext.tsx        <- user, permissions, dataScope available everywhere
    useAuth.ts            <- const { user, login, logout } = useAuth()
    ProtectedRoute.tsx    <- redirects to /login if not authenticated
    PermissionGuard.tsx   <- hides UI elements user does not have permission for
  pages/
    auth/
      LoginPage.tsx       <- CBE Employee ID + password form
    dashboard/
      DashboardHome.tsx   <- Shows only dashboards this user can access
      DashboardRenderer.tsx <- GENERIC renderer. Works for ALL dashboards.
    admin/
      users/              <- Create, edit, manage users
      roles/              <- Role and permission management
      organization/       <- Region/District/Branch tree
      designer/           <- Dashboard Designer (drag and drop)
      audit/              <- Audit log viewer
    profile/
      ProfilePage.tsx     <- My profile + change password
  components/
    widgets/
      KpiWidget.tsx       <- Shows a number with optional trend
      ChartWidget.tsx     <- Bar, Line, Pie, Donut, Area charts
      TableWidget.tsx     <- Paginated server-side data table
      WidgetRenderer.tsx  <- Decides which widget component to use
    filters/
      GlobalFilterBar.tsx <- Region / District / Branch / Date filters
    dev/
      SecurityDebugPanel.tsx <- Dev-only panel showing auth state
```

### The generic dashboard renderer — the key innovation

One React component renders ANY dashboard. No new code per project.

```
DashboardRenderer.tsx receives URL: /dashboard/fcy-lead

Step 1: Calls GET /api/v1/dashboard/fcy-lead
        Receives: { widgets: [...8 widgets...], filters: [...6 filters...] }

Step 2: Renders filter bar from filter definitions

Step 3: For each widget, renders WidgetRenderer
        WidgetRenderer reads widget_type:
          "KPI"       -> KpiWidget
          "BAR_CHART" -> ChartWidget
          "TABLE"     -> TableWidget

Step 4: Each widget calls its own data API:
        GET /api/v1/dashboard/fcy-lead/widgets/5/data
        Backend enforces scope. Returns filtered rows.

Step 5: Widget renders the data.

To add Deposit Attrition Dashboard:
  -> Register data + design in designer + publish
  -> Accessible at /dashboard/deposit-attrition
  -> ZERO new React code written
```

---

## SECTION 8: HOW BACKEND AND FRONTEND CONNECT

### The Axios client (client.ts) — the bridge

Every API call goes through this file. It automatically:
1. Adds the base URL (/api/v1)
2. Adds the Authorization header with JWT
3. Handles token expiry (silent refresh)
4. Redirects to /login if refresh fails

```
Frontend code                    Axios (client.ts)           Backend
─────────────────────────────    ─────────────────────────   ─────────────────
dashboardsApi.getConfig("fcy")
calls: apiClient.get("/dashboard/fcy-lead")
                                 Adds: Authorization: Bearer eyJ...
                                 Sends: GET http://server:8000/api/v1/dashboard/fcy-lead
                                                             router.py matches URL
                                                             dashboard_data.py
                                                             get_current_user()
                                                             _check_permission()
                                                             return JSON
                                 Receives JSON response
returns data to component
```

### Complete login sequence

```
1. User types CBE003 / Demo@1234 and clicks Sign In

2. LoginPage.tsx calls: authApi.login("CBE003", "Demo@1234")

3. Axios sends:
   POST http://server/api/v1/auth/login
   Body: { "employee_id": "CBE003", "password": "Demo@1234" }

4. FastAPI auth.py receives it:
   -> Checks account not locked
   -> MockADAuthenticationProvider verifies password
   -> IdentityResolver loads from PostgreSQL:
      user record, role, permissions, region, position, department
   -> Creates JWT access token (30 min) and refresh token (8 hr)
   -> Writes LOGIN event to audit_logs
   -> Returns: { access_token, refresh_token, expires_in: 1800 }

5. AuthContext.tsx stores tokens in localStorage

6. AuthContext immediately calls 3 more APIs:
   GET /auth/me           -> full user profile with org names
   GET /auth/permissions  -> ["dashboard.view", "user.create", ...]
   GET /users/me/data-scope -> { access_level: "REGION", region_id: 1 }

7. React app now has everything it needs:
   - User identity (name, role, employee ID)
   - Permission list (what to show/hide in UI)
   - Data scope (how to configure filter dropdowns)

8. User sees their authorized dashboards
```

---

## SECTION 9: ADDING A NEW DASHBOARD PROJECT

This is the workflow for any future analytics team.

```
STEP 1 — Data team creates their results table (in Oracle or PostgreSQL)
─────────────────────────────────────────────────────────────────────────
CREATE TABLE deposit_attrition_results (
    customer_id     VARCHAR(20),
    region_id       INTEGER,
    district_id     INTEGER,
    branch_id       INTEGER,
    prediction_date DATE,
    attrition_probability DECIMAL(5,2),
    risk_category   VARCHAR(20)
);

STEP 2 — Admin registers the Data Source
──────────────────────────────────────────
Admin -> Data Sources -> Add Data Source
Enter: host, port, database name, username, password
Click: Test Connection -> if green, Save
(Credentials are encrypted before storing in our database)

STEP 3 — Admin registers the Dataset
───────────────────────────────────────
Admin -> Datasets -> Register Dataset
Select: the Data Source from Step 2
Enter: schema name, table name = deposit_attrition_results
Map org columns:
    region_column   = region_id
    district_column = district_id
    branch_column   = branch_id
Add field metadata (each column: type, display name, aggregation rules)

STEP 4 — Dashboard Designer creates the dashboard
───────────────────────────────────────────────────
Admin -> Designer -> New Dashboard
Code: deposit-attrition
Name: Deposit Attrition Prediction Dashboard

Drag onto canvas:
  KPI: Total Customers (COUNT customer_id)
  KPI: High Risk Customers (COUNT where risk_category = HIGH)
  Bar Chart: Customers by Risk Category
  Line Chart: Monthly Prediction Trend
  Table: Customer Attrition Results

Add filters: Region, District, Branch, Prediction Date, Risk Category

STEP 5 — Approval workflow
────────────────────────────
Analyst submits draft
-> Approver reviews -> clicks Approve
-> Admin clicks Publish
Dashboard is live at: /dashboard/deposit-attrition

STEP 6 — Grant access to roles
────────────────────────────────
Admin -> Dashboards -> Manage Access
Assign: REGIONAL_MANAGER, DISTRICT_MANAGER, BRANCH_MANAGER -> VIEW
Assign: ANALYST, HEAD_OFFICE_USER -> VIEW + EXPORT

Result: Only authorized roles see this dashboard in their portal.

DEVELOPER EFFORT: Zero new React pages. Zero new API endpoints. Zero new Python code.
```

---

## SECTION 10: DEPLOYMENT

### What runs on the production server

```
3 processes always running:

1. PostgreSQL       -> port 5432 (database, managed by OS)
2. FastAPI/Uvicorn  -> port 8000 (backend, managed by systemd)
3. Nginx            -> port 80/443 (web server, managed by systemd)
```

### Server requirements

```
Operating System: Ubuntu 22.04 LTS or RHEL 8
RAM:              8GB minimum (16GB recommended)
CPU:              4 cores minimum
Disk:             100GB minimum
Network:          CBE internal network only

Software to install:
  Python 3.11+
  PostgreSQL 14+
  Nginx 1.18+
  Node.js 18+ (only needed to BUILD the frontend, not to run it)
```

### Deployment steps

```bash
# On the target server as root:

# 1. Create application user (never run as root)
useradd --system --home /opt/analytics-platform analytics

# 2. Copy source code
cp -r analytics-platform/ /opt/

# 3. Create Python virtual environment
python3.11 -m venv /opt/analytics-platform/venv
venv/bin/pip install -r backend/requirements.txt

# 4. Configure environment
cp backend/.env.example backend/.env
# Edit .env: real database password, real JWT secret, real OIDC credentials

# 5. Set up PostgreSQL database
sudo -u postgres psql -c "CREATE USER analytics_user WITH PASSWORD 'strong_password';"
sudo -u postgres psql -c "CREATE DATABASE analytics_platform OWNER analytics_user;"

# 6. Run database migrations
cd /opt/analytics-platform/backend
venv/bin/python -m alembic upgrade head

# 7. Load initial data
venv/bin/python scripts/seed_data.py

# 8. Build frontend (one-time, produces static files)
cd /opt/analytics-platform/frontend
npm install && npm run build
# Creates: frontend/dist/  (HTML, CSS, JS files)

# 9. Configure Nginx
cp nginx/analytics-platform.conf /etc/nginx/sites-available/
ln -s /etc/nginx/sites-available/analytics-platform /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 10. Install and start systemd service
cp deployment/analytics-platform.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable analytics-platform
systemctl start analytics-platform

# Done. Users access: http://analytics.cbe.com.et/
```

### systemd service (auto-restart on server reboot)

```ini
[Unit]
Description=CBE Analytics Platform API
After=network.target postgresql.service

[Service]
User=analytics
WorkingDirectory=/opt/analytics-platform/backend
ExecStart=/opt/analytics-platform/venv/bin/uvicorn app.main:app
          --host 127.0.0.1 --port 8000 --workers 4
Restart=on-failure
RestartSec=5s
EnvironmentFile=/opt/analytics-platform/backend/.env

[Install]
WantedBy=multi-user.target
```

---

## SECTION 11: CBE IT INTEGRATION (ACTIVE DIRECTORY / OIDC)

### What CBE IT must provide to you

| Item | Example | Notes |
|---|---|---|
| OIDC Issuer URL | https://login.cbe.com.et/oauth2 | The CBE Identity Provider URL |
| Client ID | analytics-platform-prod | Unique ID for our application |
| Client Secret | (keep secret, store in .env only) | Like a password for our app |
| AD attribute for Employee ID | sAMAccountName or employeeID | Which field = Employee ID |
| Available OIDC scopes | openid profile email | Confirm these are enabled |
| Test AD accounts | 3-4 accounts | For integration testing |

### What you must give CBE IT

| Item | Value |
|---|---|
| Application name | CBE Enterprise Analytics Platform |
| Redirect URI | https://analytics.cbe.com.et/api/v1/auth/ad/callback |
| Flow type | OAuth 2.0 Authorization Code with OIDC |
| Requested scopes | openid profile email |
| Server IP address | Your internal server IP (for whitelisting) |
| Contact person | Your name and email |

### The OIDC login flow (step by step)

```
1. Employee visits analytics.cbe.com.et
2. Clicks "Sign In with CBE AD"
3. Browser redirects to CBE Identity Provider:
   https://login.cbe.com.et/oauth2/authorize
   ?client_id=analytics-platform-prod
   &redirect_uri=https://analytics.cbe.com.et/api/v1/auth/ad/callback
   &scope=openid+profile+email
   &response_type=code

4. CBE AD shows login page
5. Employee enters their Windows/AD credentials
6. CBE AD authenticates against Active Directory
7. CBE AD redirects back to our platform:
   https://analytics.cbe.com.et/api/v1/auth/ad/callback?code=AUTHCODE123

8. Our backend receives the code
9. Our backend exchanges code for tokens with CBE AD:
   POST https://login.cbe.com.et/oauth2/token
   {code, client_id, client_secret, redirect_uri}
   <- Returns: id_token containing employee info

10. Our backend reads id_token:
    {
        "preferred_username": "bekele.alemu",  <- maps to employee_id
        "name": "Bekele Alemu",
        "email": "bekele.alemu@cbe.com.et"
    }

11. Our backend looks up bekele.alemu in our PostgreSQL:
    -> Loads role: REGIONAL_MANAGER
    -> Loads permissions: [dashboard.view, dashboard.export, ...]
    -> Loads scope: access_level=REGION, region_id=1

12. Our backend creates our own JWT token
13. User is redirected to /dashboards
14. User sees their authorized dashboards
```

### To switch from development to production: 5 lines in .env

```env
AUTH_PROVIDER=cbe_ad
OIDC_ISSUER_URL=https://login.cbe.com.et/oauth2
OIDC_CLIENT_ID=analytics-platform-prod
OIDC_CLIENT_SECRET=secret_from_cbe_it
OIDC_REDIRECT_URI=https://analytics.cbe.com.et/api/v1/auth/ad/callback
```

Restart backend service. ZERO code changes required.

---

## SECTION 12: QUICK REFERENCE

### Demo login credentials (development only)

| Employee ID | Password | Role | Scope |
|---|---|---|---|
| CBE001 | Demo@1234 | Admin | Head Office — all data |
| CBE002 | Demo@1234 | Head Office User | Head Office — all data |
| CBE003 | Demo@1234 | Regional Manager | Addis Ababa Region only |
| CBE004 | Demo@1234 | District Manager | Bole District only |
| CBE005 | Demo@1234 | Branch Manager | Bole Main Branch only |
| CBE006 | Demo@1234 | Analyst | Head Office — all data |
| CBE007 | Demo@1234 | Viewer | Bole Main Branch only |

### Start commands (development)

```bash
# Start backend
cd c:\Projects\analytics-platform\backend
uvicorn app.main:app --reload --port 8000

# Start frontend
cd c:\Projects\analytics-platform\frontend
npm run dev
# Opens at: http://localhost:5173

# View interactive API documentation
http://localhost:8000/api/docs

# Run automated tests
cd c:\Projects\analytics-platform\backend
python -m pytest tests/ -v

# Build frontend for production
cd c:\Projects\analytics-platform\frontend
npm run build
# Output goes to: frontend/dist/
```

### Non-negotiable security rules

1. Branch Manager CANNOT see other branch data.
   Enforced in EVERY SQL query. Cannot be bypassed by URL manipulation.

2. Frontend permission checks are UI hints only.
   Backend independently verifies every permission on every request.

3. CBE employee passwords are NEVER stored in our database.
   In production, CBE AD handles all authentication.

4. JWT tokens expire in 30 minutes.
   Refresh tokens extend the session silently for up to 8 hours.

5. All data source credentials (Oracle passwords etc.) are encrypted at rest.
   They are never returned to the browser.

6. Every significant action is logged to audit_logs.
   Login, logout, data export, permission changes, scope violations.

### Summary table for management presentation

| Topic | Key Point |
|---|---|
| What it does | One internal platform for all CBE analytics dashboards |
| Who uses it | All CBE staff with appropriate roles |
| How login works now | Employee ID + Demo@1234 (Mock AD) |
| How login works in production | CBE AD credentials via OIDC (5 .env lines) |
| Data security | Org scope enforced server-side. URL manipulation fails. |
| Adding new dashboards | Register data + design + publish. No developer needed. |
| What CBE IT gives us | OIDC Issuer URL, Client ID, Client Secret |
| What we give CBE IT | Redirect URI, app name, server IP |
| Deployment | Python + Nginx on Linux. No Docker. Works offline. |
| Auto-restart | systemd service restarts automatically after server reboot |
