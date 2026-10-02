# CBE Enterprise Dashboard — Current Architecture
## As-Built Reference (September 2026)

---

## 1. TOP-LEVEL STRUCTURE

```
c:\Projects\analytics-platform\
├── backend\              Python FastAPI application
├── frontend\             React TypeScript SPA
├── nginx\                Nginx reverse proxy config
├── deployment\           systemd service + setup script
├── docs\                 All documentation
├── tests\                Integration tests (placeholder)
├── .gitignore
└── README.md
```

---

## 2. COMPLETE FOLDER STRUCTURE

### 2.1 Backend

```
backend\
├── .env                        ← Real credentials (never commit)
├── .env.example                ← Template for new deployments
├── alembic.ini                 ← Migration config (reads .env for DB URL)
├── requirements.txt            ← All Python dependencies (pinned versions)
│
├── app\
│   ├── main.py                 ← FastAPI app entry point, startup, health check
│   │
│   ├── config\
│   │   └── settings.py         ← Pydantic Settings. Reads .env. Single source of config.
│   │
│   ├── database\
│   │   ├── base.py             ← SQLAlchemy DeclarativeBase (parent of all models)
│   │   ├── session.py          ← Engine + SessionLocal + get_db() dependency
│   │   └── data_access.py      ← DataScope, QueryDefinition, connectors:
│   │                               PostgreSQLConnector, OracleConnector, InternalAPIConnector
│   │
│   ├── models\                 ← SQLAlchemy ORM (each file = one or more DB tables)
│   │   ├── user.py             → users table
│   │   ├── role.py             → roles, user_roles, role_permissions tables
│   │   ├── permission.py       → permissions table
│   │   ├── organization.py     → regions, districts, branches tables
│   │   ├── dashboard.py        → dashboards, dashboard_versions, dashboard_widgets,
│   │   │                           dashboard_filters, dashboard_permissions tables
│   │   ├── data_source.py      → data_sources table
│   │   ├── dataset.py          → datasets, dataset_fields tables
│   │   ├── audit_log.py        → audit_logs table
│   │   └── __init__.py         ← Imports all models so Alembic finds them
│   │
│   ├── api\
│   │   └── v1\
│   │       ├── router.py       ← Master router: aggregates all sub-routers
│   │       ├── auth.py         ← /auth/* endpoints
│   │       ├── users.py        ← /users/* endpoints
│   │       ├── organization.py ← /regions, /districts, /branches
│   │       ├── roles.py        ← /roles/* endpoints
│   │       ├── permissions.py  ← /permissions endpoint
│   │       ├── dashboards.py   ← /dashboards/* CRUD + workflow
│   │       ├── dashboard_data.py ← /dashboard/{code}/* runtime data
│   │       ├── data_sources.py ← /data-sources/* endpoints
│   │       ├── datasets.py     ← /datasets/* endpoints
│   │       ├── audit.py        ← /audit/* endpoints
│   │       └── admin.py        ← /admin/* comprehensive admin API
│   │
│   ├── security\
│   │   ├── auth_provider.py    ← Abstract base: AuthenticationProvider + AuthenticatedIdentity
│   │   ├── auth_provider_factory.py ← Returns correct provider based on AUTH_PROVIDER env
│   │   ├── mock_ad_provider.py ← Development: validates against mock_ad_users table
│   │   ├── cbe_ad_provider.py  ← Production: OAuth 2.0/OIDC with CBE Identity Provider
│   │   ├── identity_resolver.py ← Loads role/permissions/scope from DB by employee_id
│   │   ├── data_scope.py       ← Converts access_level → DataScope (enforces org restriction)
│   │   ├── dependencies.py     ← get_current_user(), require_permission(), get_user_permissions()
│   │   ├── jwt.py              ← create_access_token(), create_refresh_token(), decode_token()
│   │   └── password.py         ← hash_password(), verify_password() via bcrypt
│   │
│   ├── services\
│   │   ├── audit_service.py    ← log_audit_event() called by all endpoints
│   │   └── query_engine.py     ← execute_widget_query(): builds SQL from widget config + scope
│   │
│   ├── middleware\
│   │   └── cors_middleware.py  ← CORS configuration
│   │
│   ├── repositories\           ← (placeholder, logic currently in routers)
│   ├── schemas\                ← (placeholder, schemas defined inline in routers)
│   └── utils\
│       ├── pagination.py       ← PaginationParams, PagedResponse helpers
│       └── response.py         ← success_response(), error_response() helpers
│
├── migrations\
│   ├── env.py                  ← Alembic env: reads .env, imports all models
│   ├── script.py.mako          ← Migration file template
│   └── versions\
│       └── 20260916_*.py       ← Initial schema migration
│
├── scripts\
│   ├── setup_database.py       ← Creates DB + user (run once)
│   ├── seed_data.py            ← Seeds: roles, permissions, org hierarchy, demo users, dashboards
│   ├── seed_fcy_demo.py        ← Creates fcy_lead_results table + 1000 demo rows + widgets
│   ├── seed_spec02.py          ← Seeds: positions, departments, mock_ad_users, employee_ids
│   ├── migrate_spec02.py       ← Adds auth tables: positions, departments, mock_ad_users, etc.
│   ├── add_auth_columns.py     ← Adds failed_login_attempts, locked_until to users
│   └── show_tables.py          ← Utility: lists all DB tables and columns
│
└── tests\
    ├── test_auth.py            ← Auth endpoint tests (login, /me, token, refresh)
    ├── test_data_scope.py      ← Org scope enforcement tests
    ├── test_spec02_auth.py     ← Mock AD, identity, scope, permissions (18 tests, all pass)
    └── test_spec08_admin.py    ← Admin API, audit, dashboard permissions
```

### 2.2 Frontend

```
frontend\
├── index.html                  ← Entry HTML. Title: "CBE Enterprise Dashboard"
├── package.json                ← Dependencies (React 18, MUI, Recharts, etc.)
├── vite.config.ts              ← Vite build config, path aliases, dev proxy
├── tsconfig.json               ← TypeScript project references
├── tsconfig.app.json           ← App TypeScript config (strict mode)
├── tsconfig.node.json          ← Node/Vite TypeScript config
├── .env.development            ← VITE_APP_ENV=development
├── .env.production             ← VITE_APP_ENV=production
│
├── public\
│   ├── favicon.svg             ← Bar chart icon
│   └── portal-embed.html       ← CBE intranet tile (iframe or HTML embed)
│
└── src\
    ├── main.tsx                ← React entry: createRoot → <App />
    ├── App.tsx                 ← Providers: QueryClient, Theme, Router, AuthProvider
    │                               Also renders: <SecurityDebugPanel /> (dev only)
    │
    ├── config\
    │   └── app.config.ts       ← APP_CONFIG: apiBaseUrl, tokenKey, pagination defaults
    │
    ├── api\                    ← All HTTP calls. Every file = one backend section.
    │   ├── client.ts           ← Axios instance: auto-attaches JWT, handles 401 refresh
    │   ├── authApi.ts          ← login, logout, getCurrentUser, getPermissions, getDataScope
    │   ├── auth.api.ts         ← Legacy alias (kept for backward compat)
    │   ├── adminApi.ts         ← All /admin/* operations
    │   ├── dashboards.api.ts   ← Dashboard config, widget data, export
    │   ├── organization.api.ts ← Regions, districts, branches
    │   ├── roles.api.ts        ← Roles + permissions
    │   ├── users.api.ts        ← User CRUD
    │   ├── datasets.api.ts     ← Datasets + fields
    │   └── audit.api.ts        ← Audit logs
    │
    ├── auth\                   ← Authentication state + route protection
    │   ├── AuthContext.tsx     ← Context: user, permissions, dataScope, login, logout
    │   ├── useAuth.ts          ← Hook: const { user, hasPermission } = useAuth()
    │   ├── ProtectedRoute.tsx  ← Redirects to /login if not authenticated
    │   └── PermissionGuard.tsx ← Hides children if permission missing
    │
    ├── layouts\
    │   ├── AppLayout.tsx       ← Authenticated shell: Header + Sidebar + main content
    │   └── AuthLayout.tsx      ← Unauthenticated shell: centered card
    │
    ├── components\
    │   ├── common\
    │   │   ├── Header.tsx          ← Top bar: logo, "CBE Enterprise Dashboard", user menu
    │   │   ├── Sidebar.tsx         ← Left nav: Dashboards + Administration sections
    │   │   ├── LoadingState.tsx    ← Spinner
    │   │   ├── ErrorState.tsx      ← Error with retry button
    │   │   ├── EmptyState.tsx      ← Empty list state
    │   │   └── ConfirmDialog.tsx   ← Reusable yes/no dialog
    │   │
    │   ├── widgets\                ← Dashboard runtime renderers
    │   │   ├── WidgetRenderer.tsx  ← Dispatcher: reads widget_type → picks component
    │   │   ├── KpiWidget.tsx       ← KPI card with formatted number
    │   │   ├── ChartWidget.tsx     ← Bar/Line/Pie/Donut/Area/HBar charts (Recharts)
    │   │   └── TableWidget.tsx     ← Server-side paginated table with search + export
    │   │
    │   ├── filters\
    │   │   └── GlobalFilterBar.tsx ← Region/District/Branch/Date/Category filter row
    │   │
    │   ├── charts\                 ← (placeholder for future standalone chart components)
    │   ├── designer\               ← (placeholder for future designer sub-components)
    │   └── dev\
    │       └── SecurityDebugPanel.tsx ← Dev-only: shows employee_id, role, scope, permissions
    │
    ├── pages\
    │   ├── auth\
    │   │   ├── LoginPage.tsx       ← CBE mock AD login: Employee ID + password + demo users list
    │   │   ├── ChangePasswordPage.tsx ← Self-service password change
    │   │   └── OidcCallbackPage.tsx   ← Handles redirect from CBE AD (/auth/callback)
    │   │
    │   ├── dashboard\
    │   │   ├── DashboardHome.tsx       ← User's authorized dashboard grid
    │   │   └── DashboardRenderer.tsx   ← GENERIC: renders any dashboard from backend config
    │   │
    │   ├── profile\
    │   │   └── ProfilePage.tsx         ← User profile + inline change-password form
    │   │
    │   ├── errors\
    │   │   ├── NotFoundPage.tsx
    │   │   ├── ForbiddenPage.tsx
    │   │   └── UnauthorizedPage.tsx
    │   │
    │   └── admin\
    │       ├── AdminHome.tsx
    │       ├── users\
    │       │   ├── UserListPage.tsx        ← Search/filter users, toggle status, unlock, reset password
    │       │   ├── UserFormPage.tsx        ← Create/edit user with dependent org dropdowns
    │       │   └── ResetPasswordDialog.tsx ← Admin password reset dialog
    │       ├── roles\
    │       │   └── RolesPage.tsx           ← Role list + permission assignment dialog
    │       ├── permissions\
    │       │   └── PermissionsPage.tsx     ← All permissions grouped by category
    │       ├── organization\
    │       │   └── OrgPage.tsx             ← Region→District→Branch accordion tree
    │       ├── datasources\
    │       │   └── DataSourcesPage.tsx     ← Add/edit data sources, test connection
    │       ├── datasets\
    │       │   └── DatasetsPage.tsx        ← Register datasets, view fields
    │       ├── designer\
    │       │   └── DashboardDesignerPage.tsx ← Three-panel drag-and-drop designer
    │       ├── dashboards\
    │       │   └── DashboardsAdminPage.tsx   ← Dashboard list + manage access dialog
    │       ├── approvals\
    │       │   └── ApprovalsPage.tsx         ← Approve/reject/publish submitted dashboards
    │       └── audit\
    │           └── AuditLogsPage.tsx         ← Audit log viewer with action filter + security events
    │
    ├── routes\
    │   └── AppRoutes.tsx       ← All React Router routes, ProtectedRoute wrapping
    │
    ├── types\
    │   ├── auth.types.ts       ← CurrentUser, LoginRequest, TokenResponse, AccessLevel
    │   ├── dashboard.types.ts  ← Dashboard, DashboardVersion, DashboardWidget, ActiveFilters
    │   ├── dataset.types.ts    ← Dataset, DatasetField, Aggregation enums
    │   ├── organization.types.ts ← Region, District, Branch (with status)
    │   └── user.types.ts       ← User, CreateUserRequest, UpdateUserRequest
    │
    └── utils\
        ├── formatters.ts       ← formatNumber, formatCurrency, formatDate, formatDateTime
        └── permissions.ts      ← PERMISSIONS constants object (avoids magic strings)
```

### 2.3 Other Directories

```
nginx\
└── analytics-platform.conf     ← Nginx site config: / → dist/, /api/ → :8000

deployment\
├── analytics-platform.service  ← systemd unit (auto-start, auto-restart)
└── setup.sh                    ← Full deployment automation script

docs\
├── CBE-Platform-Complete-Guide.md  ← 12-section team guide
├── current-architecture.md         ← This file
├── intranet-integration.md         ← How to add to CBE intranet
├── deployment.md                   ← Production deployment steps
├── api\
│   └── authentication-api.md       ← All auth API reference
└── specs\
    └── 02-authentication-authorization\
        ├── requirements.md
        ├── design.md
        └── tasks.md
```

---

## 3. POSTGRESQL DATABASE — ALL TABLES

### Application Database: `analytics_platform`
**User:** `analytics_user` | **Port:** 5432

```
TABLE                     PURPOSE
─────────────────────────────────────────────────────────────────────
IDENTITY & ACCESS
  users                   CBE employees. Columns: id, username, full_name,
                          email, phone, password_hash, access_level,
                          region_id, district_id, branch_id, is_active,
                          last_login, failed_login_attempts, locked_until,
                          employee_id, ad_provider, last_ad_sync,
                          created_at, updated_at, created_by

  roles                   ADMIN, REGIONAL_MANAGER, etc. Columns: id, name,
                          display_name, description, is_system, is_active

  permissions             Permission codes. Columns: id, code, name,
                          description, category, is_active
                          Examples: dashboard.view, user.create, audit.view

  user_roles              Many-to-many: user ↔ role
                          Columns: id, user_id, role_id, assigned_at, assigned_by

  role_permissions        Many-to-many: role ↔ permission
                          Columns: id, role_id, permission_id, granted_at, granted_by

ORGANIZATION HIERARCHY
  regions                 Addis Ababa, Oromia, Amhara
                          Columns: id, code, name, status, created_at, updated_at

  districts               Bole, Kirkos, Yeka, Adama, Jimma, etc.
                          Columns: id, code, name, region_id(FK), status, created_at, updated_at

  branches                Bole Main, Bole Airport, Kirkos, etc.
                          Columns: id, code, name, region_id(FK), district_id(FK),
                          status, created_at, updated_at

DASHBOARD PLATFORM
  dashboards              FCY Lead Dashboard, Branch Performance, etc.
                          Columns: id, code(unique), name, description,
                          owner_id, is_active, created_by, updated_by,
                          created_at, updated_at

  dashboard_versions      Each dashboard can have multiple versions (DRAFT→PUBLISHED)
                          Columns: id, dashboard_id(FK), version_number, status,
                          layout_config(JSON), submitted_by, submitted_at,
                          approved_by, approved_at, published_at, rejection_reason,
                          created_by, created_at, updated_at
                          Status values: DRAFT | PREVIEW | SUBMITTED | APPROVED | PUBLISHED | ARCHIVED

  dashboard_widgets       Widget inside a version. Config stored as JSON.
                          Columns: id, version_id(FK), widget_type, title,
                          position_x, position_y, width, height,
                          config_json(JSON), dataset_id(FK), sort_order
                          Widget types: KPI | BAR_CHART | LINE_CHART | PIE_CHART |
                                        DONUT_CHART | AREA_CHART | H_BAR_CHART |
                                        TABLE | TEXT | IMAGE | FILTER | DIVIDER

  dashboard_filters       Filter definitions for a dashboard version
                          Columns: id, version_id(FK), filter_type, field_name,
                          display_name, is_global, default_value, config_json, sort_order
                          Filter types: REGION | DISTRICT | BRANCH | DATE_RANGE |
                                        CATEGORY | NUMERIC_RANGE | STATUS | CUSTOM

  dashboard_permissions   Which roles can access which dashboard
                          Columns: id, dashboard_id(FK), role_id(FK),
                          can_view, can_export, granted_by, granted_at

DATA SOURCES & DATASETS
  data_sources            External analytical DB connections (credentials encrypted)
                          Columns: id, name, source_type(POSTGRESQL|ORACLE|INTERNAL_API),
                          host, port, database_name, service_name, schema_name, api_url,
                          username_enc, password_enc, api_auth_config_enc,
                          is_active, created_by, created_at, updated_at

  datasets                Approved tables/views for use in dashboards
                          Columns: id, name, description, source_id(FK), schema_name,
                          object_name, region_column, district_column, branch_column,
                          owner_id, status(DRAFT|ACTIVE|INACTIVE),
                          created_by, updated_by, created_at, updated_at

  dataset_fields          Metadata for each column in a dataset
                          Columns: id, dataset_id(FK), field_name, display_name,
                          data_type(TEXT|NUMERIC|DATE|DATETIME|BOOLEAN|ID|CATEGORY),
                          field_category(DIMENSION|METRIC|DATE|IDENTIFIER|STATUS|OTHER),
                          is_filterable, is_aggregatable, allowed_aggregations, sort_order

AUDIT & SESSIONS
  audit_logs              Every significant action logged here
                          Columns: id, user_id(FK), action, resource_type,
                          resource_id, dashboard_id(FK), ip_address, user_agent,
                          status(SUCCESS|FAILURE|DENIED), details(JSON), created_at

  authentication_sessions Login/logout history with IP
                          Columns: id, user_id(FK), employee_id, provider,
                          ip_address, user_agent, issued_at, expires_at,
                          revoked_at, revoke_reason

SPEC 02 (AUTH EXTENSION)
  mock_ad_users           Development-only fake CBE AD users
                          Columns: id, employee_id(unique), password_hash,
                          full_name, email, department, position_title, is_active, note

  ad_user_mapping         Maps AD sAMAccountName → internal user_id (production)
                          Columns: id, employee_id(unique), user_id(FK),
                          provider, created_at, last_seen_at

  positions               Job positions: System Admin, Regional Director, etc.
                          Columns: id, code(unique), name, level, is_active, created_at

  departments             Retail Banking, Corporate, Digital Banking, etc.
                          Columns: id, code(unique), name, is_active, created_at

  user_positions          Which position a user holds
                          Columns: id, user_id(FK), position_id(FK), is_primary, assigned_at

  user_department_scope   Which departments a user can see data for
                          Columns: id, user_id(FK), department_id(FK), created_at

ANALYTICAL DATA (not in our DB — queried at runtime)
  fcy_lead_results        Created by seed_fcy_demo.py for demo purposes
                          Columns: id, customer_id, region_id, district_id, branch_id,
                          lead_date, lead_type, status, is_converted, fcy_amount,
                          lead_score, currency_type, created_at
                          Contains: 1000 fictional demo rows
```

### Table Relationships (Key Foreign Keys)
```
users.region_id          → regions.id
users.district_id        → districts.id
users.branch_id          → branches.id
districts.region_id      → regions.id
branches.region_id       → regions.id
branches.district_id     → districts.id
user_roles.user_id       → users.id
user_roles.role_id       → roles.id
role_permissions.role_id → roles.id
role_permissions.permission_id → permissions.id
dashboard_versions.dashboard_id → dashboards.id
dashboard_widgets.version_id → dashboard_versions.id
dashboard_widgets.dataset_id → datasets.id
dashboard_filters.version_id → dashboard_versions.id
dashboard_permissions.dashboard_id → dashboards.id
dashboard_permissions.role_id → roles.id
datasets.source_id       → data_sources.id
dataset_fields.dataset_id → datasets.id
audit_logs.user_id       → users.id
```

---

## 4. REST API STRUCTURE

**Base URL:** `http://localhost:8000/api/v1/` (dev) | `http://analytics.cbe.com.et/api/v1/` (prod)
**Auth:** Bearer JWT token in Authorization header
**Docs:** `http://localhost:8000/api/docs` (development only)

### AUTHENTICATION  →  auth.py
```
POST   /auth/login                  Mock AD login (development only)
GET    /auth/me                     Full identity: name, role, scope, position, dept
GET    /auth/permissions            All permission codes for current user
GET    /auth/session                Session metadata
POST   /auth/refresh                Issue new access token from refresh token
POST   /auth/logout                 Log out (+ audit entry)
POST   /auth/change-password        User changes own password
POST   /auth/reset-password/{id}    Admin resets user password (user.update required)
POST   /auth/unlock/{id}            Admin unlocks locked account
GET    /auth/ad/login               → Redirect to CBE OIDC (production)
GET    /auth/ad/callback            ← CBE OIDC returns here (production)
```

### USERS  →  users.py
```
GET    /users/me/data-scope         Trusted org + department scope for current user
GET    /users                       List users (paginated, searchable)
POST   /users                       Create user
GET    /users/{id}                  Get user by ID
PUT    /users/{id}                  Update user
PATCH  /users/{id}/status           Activate / deactivate
```

### ORGANIZATION  →  organization.py
```
GET    /regions                     Active regions (scoped to user's level)
GET    /regions/all                 All regions (admin)
POST   /regions                     Create region
PUT    /regions/{id}                Update region
GET    /regions/{id}/districts      Districts for a region (scoped)
GET    /districts/all               All districts (admin, optional ?region_id)
POST   /districts                   Create district
PUT    /districts/{id}              Update district
GET    /districts/{id}/branches     Branches for a district (scoped)
GET    /branches/all                All branches (admin)
POST   /branches                    Create branch
PUT    /branches/{id}               Update branch
```

### ROLES  →  roles.py
```
GET    /roles                       All active roles
POST   /roles                       Create role
PUT    /roles/{id}                  Update role
GET    /roles/{id}/permissions      Get permissions for a role
PUT    /roles/{id}/permissions      Assign permissions to a role
```

### PERMISSIONS  →  permissions.py
```
GET    /permissions                 All permissions grouped by category
```

### DATA SOURCES  →  data_sources.py
```
GET    /data-sources                List data sources (no credentials returned)
POST   /data-sources                Create (credentials encrypted before saving)
GET    /data-sources/{id}           Get by ID
PUT    /data-sources/{id}           Update
DELETE /data-sources/{id}           Soft-delete (is_active=false)
POST   /data-sources/{id}/test      Test connectivity
GET    /data-sources/{id}/schema    List tables/views in schema
GET    /data-sources/{id}/fields    Get column metadata for a table
```

### DATASETS  →  datasets.py
```
GET    /datasets                    List datasets (optional ?status=ACTIVE)
POST   /datasets                    Register dataset
GET    /datasets/{id}               Get by ID
PUT    /datasets/{id}               Update
GET    /datasets/{id}/fields        List field metadata
POST   /datasets/{id}/fields        Add a field
PUT    /datasets/{id}/fields        Replace all fields
POST   /datasets/{id}/preview       Get 10 sample rows
```

### DASHBOARDS (designer)  →  dashboards.py
```
GET    /dashboards                  List (filtered by user's permissions)
POST   /dashboards                  Create new dashboard
GET    /dashboards/{id}             Get by ID
GET    /dashboards/{id}/versions    All versions
GET    /dashboards/{id}/versions/{v} Get version with widgets + filters
PUT    /dashboards/{id}/versions/{v} Save version (widgets + filters + layout)
POST   /dashboards/{id}/submit      Submit draft for approval
POST   /dashboards/{id}/approve     Approve submitted version
POST   /dashboards/{id}/reject      Reject (returns to DRAFT)
POST   /dashboards/{id}/publish     Publish approved version (archives previous)
POST   /dashboards/{id}/unpublish   Archive published version
POST   /dashboards/{id}/duplicate   Copy dashboard
PUT    /dashboards/{id}/permissions  Set role access (view + export)
```

### DASHBOARD DATA (runtime)  →  dashboard_data.py
```
GET    /dashboard/{code}            Config + widgets + filters + user_scope
GET    /dashboard/{code}/widgets/{id}/data     Widget data (org scope enforced)
GET    /dashboard/{code}/widgets/{id}/export   CSV / Excel / PDF export
```

### ADMINISTRATION  →  admin.py
```
GET/POST        /admin/users
GET/PUT/PATCH   /admin/users/{id}
GET             /admin/users/{id}/scope
PUT             /admin/users/{id}/scope
GET             /admin/users/{id}/permissions
GET/POST/PUT    /admin/roles
DELETE          /admin/roles/{id}
PUT             /admin/roles/{id}/permissions
GET/POST/PUT    /admin/permissions
DELETE          /admin/permissions/{id}
GET/POST/PUT    /admin/departments
GET/POST/PUT    /admin/positions
GET             /admin/organizations        (full tree: regions→districts→branches)
GET             /admin/regions
GET             /admin/districts
GET             /admin/branches
GET/POST/PUT/DELETE /admin/dashboard-permissions
```

### AUDIT  →  audit.py
```
GET    /audit                         All logs (filterable: action, user, resource, date)
GET    /audit/security-events         Failed logins, scope violations, permission changes
GET    /audit/{id}                    Single audit event
GET    /audit/users/{user_id}         Audit trail for a specific user
GET    /audit/dashboards/{id}         Audit trail for a specific dashboard
```

---

## 5. SECURITY ARCHITECTURE

### Authentication Flow
```
Development:  Login → mock_ad_provider → identity_resolver → JWT
Production:   Login → CBE IdP (OIDC) → cbe_ad_provider → identity_resolver → JWT
```

### JWT Token
- Algorithm: HS256
- Access token expiry: 30 minutes
- Refresh token expiry: 8 hours
- Payload: employee_id, user_id, username, role, access_level, region_id, district_id, branch_id, provider
- Secret: from JWT_SECRET_KEY in .env (64-char hex)

### Request Authorization Chain
```
Every protected request:
  1. Bearer token extracted from Authorization header
  2. JWT decoded + signature verified
  3. User loaded from PostgreSQL by user_id
  4. is_active checked
  5. Permission checked (if endpoint uses require_permission)
  6. DataScope built from user.access_level + org IDs
  7. DataScope injected into any data query (cannot be overridden by request params)
```

### Org Data Scope Rules
```
HEAD_OFFICE  →  No restriction. Sees all authorized data.
REGION       →  WHERE region_id IN (user.region_id)
DISTRICT     →  WHERE district_id IN (user.district_id)
BRANCH       →  WHERE branch_id IN (user.branch_id)
```

### Password Security
- bcrypt with cost factor 12
- failed_login_attempts tracked per user
- Account locked after 5 failed attempts (15 minutes)
- Unlockable by admin via POST /auth/unlock/{id}
- Production: CBE AD handles all passwords (none stored here)

---

## 6. TECHNOLOGY STACK

### Backend
```
Python 3.11.9
FastAPI 0.111.0
SQLAlchemy 2.0.31        ORM + query builder
Alembic 1.18.5           Database migrations
psycopg2-binary 2.9.12   PostgreSQL driver
oracledb 26.0.0          Oracle driver (thin mode, no Instant Client needed)
python-jose 3.3.0        JWT creation + validation
passlib 1.7.4 + bcrypt   Password hashing
cryptography 42.0.8      Fernet encryption for data source credentials
pydantic 2.7.4           Request/response validation + settings
httpx 0.27.0             HTTP client for Internal API connector + OIDC
openpyxl 3.1.5           Excel export
reportlab 4.2.2          PDF export
pytest 8.2.2             Test runner
```

### Frontend
```
React 18.3.1             UI framework
TypeScript 5.6.3         Type safety
Vite 5.4.10              Build tool + dev server
Material UI 6.1.6        Component library (no CDN — local npm)
@fontsource/roboto       Fonts (local npm — no Google Fonts CDN)
TanStack Query 5.59.20   Server state management (caching, refetch)
TanStack Table 8.20.5    Headless table (for complex tables)
React Router 6.27.0      Client-side routing
Recharts 2.13.3          Charts (Bar, Line, Pie, Area)
react-grid-layout 1.4.4  Dashboard Designer drag-and-drop canvas
React Hook Form 7.53.2   Form state management
Zod 3.23.8               Schema validation
Axios 1.7.7              HTTP client
```

### Infrastructure
```
PostgreSQL 18.4          Application database (running as Windows service)
Nginx (production)       Reverse proxy + static file serving
systemd (production)     Process management + auto-restart
No Docker                Runs directly on OS
```

---

## 7. DEMO DATA

### Organizations
```
3 Regions:   Addis Ababa, Oromia, Amhara
7 Districts: Bole, Kirkos, Yeka (Addis), Adama, Jimma (Oromia),
             Bahir Dar, Gondar (Amhara)
10 Branches: Bole Main, Bole Airport, Kirkos, Mexico, Yeka,
             Adama Main, Adama East, Jimma, Bahir Dar, Gondar
```

### Demo Users (Mock AD password: Demo@1234)
```
CBE001  Abebe Girma      ADMIN              HEAD_OFFICE
CBE002  Hiwot Tadesse    HEAD_OFFICE_USER   HEAD_OFFICE
CBE003  Bekele Alemu     REGIONAL_MANAGER   Addis Ababa Region
CBE004  Tigist Haile     DISTRICT_MANAGER   Bole District
CBE005  Dawit Kebede     BRANCH_MANAGER     Bole Main Branch
CBE006  Sara Mulugeta    ANALYST            HEAD_OFFICE
CBE007  Yonas Tesfaye    VIEWER             Bole Main Branch
```

### Seeded Dashboards
```
fcy-lead            FCY Lead Dashboard       PUBLISHED  (8 widgets, 6 filters, 1000 demo rows)
customer-segment    Customer Segmentation    DRAFT
profitability       Customer Profitability   DRAFT
deposit-attrition   Deposit Attrition        DRAFT
branch-performance  Branch Performance       DRAFT
```

---

## 8. DEVELOPMENT QUICK REFERENCE

```bash
# Start backend
cd c:\Projects\analytics-platform\backend
uvicorn app.main:app --reload --port 8000

# Start frontend
cd c:\Projects\analytics-platform\frontend
npm run dev                         # → http://localhost:5173

# API documentation (interactive)
http://localhost:8000/api/docs

# Health check
http://localhost:8000/health        # → {"status":"healthy","database":"connected"}

# Run tests
cd backend
python -m pytest tests/test_spec02_auth.py -v   # 18 tests, all pass

# Build frontend for production
cd frontend
npm run build                       # → frontend/dist/ (zero errors)

# Re-seed database
cd backend
python scripts/seed_data.py
python scripts/seed_fcy_demo.py
python scripts/seed_spec02.py

# Login credentials
http://localhost:5173/login
Employee ID: CBE001   Password: Demo@1234  (Admin — sees everything)
Employee ID: CBE003   Password: Demo@1234  (Regional Manager)
Employee ID: CBE005   Password: Demo@1234  (Branch Manager — restricted to Bole Main)
```
