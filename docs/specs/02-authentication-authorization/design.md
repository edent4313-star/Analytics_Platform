# DESIGN — Authentication and Authorization
# CBE Enterprise Dashboard Platform
# Spec: 02-AUTHENTICATION-AND-AUTHORIZATION

Version: 1.0
Status: DRAFT — Awaiting Approval
Date: 2026-09-17

---

## 1. Design Principles

1. **No password storage** — CBE employee credentials never touch the application database.
2. **Provider swap = config change** — switching from Mock AD to CBE AD requires only `AUTH_PROVIDER=cbe_ad` in `.env` and OIDC server coordinates. No code changes anywhere else.
3. **Additive only** — all changes to existing models, APIs, and frontend are backward-compatible. Nothing in Phases 1–15 breaks.
4. **Backend is the authority** — the frontend receives identity and permissions as read-only display data. All enforcement is server-side.
5. **Minimal new dependencies** — use `python-jose` (already installed) for JWT, `httpx` (already installed) for OIDC token exchange. No new Python packages needed.

---

## 2. Authentication Flow Architecture

### 2.1 Mock AD Flow (Development)

```
Browser
  │
  │  POST /api/v1/auth/login
  │  { employee_id: "CBE003", password: "Demo@1234" }
  │
  ▼
FastAPI Auth Router
  │
  ▼
AuthProviderFactory.get_provider()  ← reads AUTH_PROVIDER from .env
  │
  ▼
MockADAuthenticationProvider
  ├── validate employee_id + password against seeded mock_ad_users table
  ├── resolve AuthenticatedIdentity from app DB (role, scope, permissions)
  └── return AuthenticatedIdentity
  │
  ▼
JWTService.create_tokens(identity)
  ├── access_token  (30 min)
  └── refresh_token (8 hr)
  │
  ▼
AuditService.log("LOGIN", user_id, provider="mock")
  │
  ▼
Response: { access_token, refresh_token, expires_in }
```

### 2.2 CBE AD / OIDC Flow (Production)

```
Browser
  │
  │  GET /api/v1/auth/ad/login
  │
  ▼
FastAPI → redirect to CBE IdP Authorization Endpoint
  │        (Azure AD / Keycloak / CBE SSO)
  │        with: client_id, redirect_uri, scope=openid+profile+email
  │
  ▼
CBE IdP Login Page
  │  (CBE employee authenticates with their AD credentials)
  │
  ▼
CBE IdP → redirect back to:
  GET /api/v1/auth/ad/callback?code=AUTH_CODE
  │
  ▼
FastAPI
  ├── exchange code for id_token + access_token via CBE IdP token endpoint
  ├── verify id_token signature (OIDC JWT verification)
  ├── extract: sub, email, name, preferred_username (sAMAccountName)
  │
  ▼
CBEActiveDirectoryProvider
  ├── look up employee_id = preferred_username in ad_user_mapping
  ├── resolve full AuthenticatedIdentity from app DB
  └── return AuthenticatedIdentity
  │
  ▼
JWTService.create_tokens(identity)
  │
  ▼
redirect to Frontend: /auth/callback?token=...
  │
  ▼
Frontend stores tokens → redirect to /dashboards
```

### 2.3 Identity Resolution (Both Providers)

After provider-specific authentication, both paths call the same `IdentityResolver`:

```
IdentityResolver.resolve(employee_id: str) → AuthenticatedIdentity
  │
  ├── load User from DB by employee_id (or username for mock)
  ├── check is_active
  ├── load UserRole → Role
  ├── load RolePermissions → Permission codes
  ├── load DataScope (access_level, region_id, district_id, branch_id)
  ├── load UserPosition → Position
  ├── load UserDepartmentScope → Department codes
  └── return AuthenticatedIdentity
```

This is the SINGLE source of truth for identity. Both providers call it.

---

## 3. Component Design

### 3.1 Backend: Provider Abstraction

**File:** `backend/app/security/auth_provider.py`

```python
class AuthenticatedIdentity:
    employee_id: str
    user_id: int
    username: str
    full_name: str
    email: str
    position: str | None
    department: str | None
    access_level: str           # HEAD_OFFICE | REGION | DISTRICT | BRANCH
    region_id: int | None
    district_id: int | None
    branch_id: int | None
    role: str
    permissions: list[str]      # ["dashboard.view", "dashboard.export", ...]
    department_scope: list[str] # ["ALL"] or ["RETAIL", "CORPORATE"]
    is_active: bool
    provider: str               # "mock" | "cbe_ad"

class AuthenticationProvider(ABC):
    @abstractmethod
    def authenticate(self, credentials: dict) -> AuthenticatedIdentity: ...

    @abstractmethod
    def get_provider_name(self) -> str: ...
```

**File:** `backend/app/security/mock_ad_provider.py`
- Validates `employee_id` + `password` against `mock_ad_users` table
- Calls `IdentityResolver.resolve(employee_id)`
- Returns `AuthenticatedIdentity`

**File:** `backend/app/security/cbe_ad_provider.py`
- OIDC Authorization Code Flow
- Config from `.env`: `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`
- Verifies `id_token` signature using OIDC JWKS endpoint
- Extracts `preferred_username` → `employee_id`
- Calls `IdentityResolver.resolve(employee_id)`
- Returns `AuthenticatedIdentity`

**File:** `backend/app/security/identity_resolver.py`
- Single function: `resolve(employee_id, db) → AuthenticatedIdentity`
- Called by both providers
- Contains all DB lookups for role, permissions, scope, position, department

**File:** `backend/app/security/auth_provider_factory.py`
```python
def get_provider(settings) -> AuthenticationProvider:
    if settings.auth_provider == "cbe_ad":
        return CBEActiveDirectoryProvider(settings)
    return MockADAuthenticationProvider()  # default
```

### 3.2 Backend: Extended Auth Router

The existing `/api/v1/auth/login` is extended — it now routes through the provider factory:

```python
# Existing endpoint — extended, not replaced
POST /api/v1/auth/login
  → provider = get_provider(settings)
  → identity = provider.authenticate({"employee_id": ..., "password": ...})
  → tokens = JWTService.create_tokens(identity)
  → return tokens

# New endpoints
GET  /api/v1/auth/ad/login       → redirect to CBE OIDC authorization URL
GET  /api/v1/auth/ad/callback    → exchange code, resolve identity, return tokens
GET  /api/v1/auth/permissions    → return current user's permission codes
GET  /api/v1/users/me/data-scope → return trusted org + dept scope
GET  /api/v1/auth/session        → return session metadata (provider, issued_at, exp)
```

### 3.3 Backend: New and Extended Models

**Extended: `users` table (additive columns)**
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ad_provider VARCHAR(20) DEFAULT 'mock';
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ad_sync TIMESTAMPTZ;
```

**New: `positions` table**
```sql
CREATE TABLE positions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    level INTEGER DEFAULT 0,   -- seniority ordering
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New: `departments` table**
```sql
CREATE TABLE departments (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New: `user_positions` table**
```sql
CREATE TABLE user_positions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    position_id INTEGER REFERENCES positions(id),
    is_primary BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New: `user_department_scope` table**
```sql
CREATE TABLE user_department_scope (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    department_id INTEGER REFERENCES departments(id),
    -- NULL department_id means ALL departments
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**New: `mock_ad_users` table** (development only)
```sql
CREATE TABLE mock_ad_users (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    email VARCHAR(255),
    department VARCHAR(100),
    position VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    note VARCHAR(255)  -- "Development test user only"
);
```

**New: `ad_user_mapping` table** (production use)
```sql
CREATE TABLE ad_user_mapping (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,  -- AD sAMAccountName
    user_id INTEGER REFERENCES users(id),
    provider VARCHAR(20) DEFAULT 'cbe_ad',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ
);
```

**New: `authentication_sessions` table**
```sql
CREATE TABLE authentication_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    employee_id VARCHAR(50),
    provider VARCHAR(20),
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoke_reason VARCHAR(100)
);
```

### 3.4 Extended JWT Payload

```json
{
  "sub": "CBE003",
  "user_id": 3,
  "username": "bekele.alemu",
  "employee_id": "CBE003",
  "role": "REGIONAL_MANAGER",
  "access_level": "REGION",
  "region_id": 1,
  "district_id": null,
  "branch_id": null,
  "provider": "mock",
  "type": "access",
  "exp": 1234567890,
  "iat": 1234566090
}
```

Note: `permissions` and `department_scope` are NOT in the JWT (too large). They are loaded fresh from the DB on each `/auth/me` or `/auth/permissions` call.

### 3.5 Extended `get_current_user` Dependency

The existing `backend/app/security/dependencies.py` `get_current_user()` function is extended to:
1. Decode JWT → extract `employee_id` (sub) and `user_id`
2. Load User from DB by `user_id`
3. Verify `is_active`
4. Return user (unchanged behavior for all existing code)

No other changes needed to existing endpoints.

### 3.6 `DataScope` — No Changes

`backend/app/security/data_scope.py` is **unchanged**. It already reads `access_level`, `region_id`, `district_id`, `branch_id` from the User object loaded from DB. The provider abstraction feeds into that same User object.

---

## 4. Frontend Design

### 4.1 API Client

**File:** `frontend/src/api/authApi.ts`

Replaces/extends existing `src/api/auth.api.ts`. New functions:

```typescript
export const authApi = {
  // Mock AD (development)
  login(employeeId: string, password: string): Promise<TokenResponse>

  // OIDC (production) — redirects browser to CBE IdP
  initiateADLogin(): void   // calls GET /auth/ad/login → browser redirect

  // Common
  logout(): Promise<void>
  getCurrentUser(): Promise<AuthenticatedIdentity>
  getPermissions(): Promise<{ permissions: string[] }>
  getDataScope(): Promise<DataScopeResponse>
  getSession(): Promise<SessionInfo>
  refreshSession(): Promise<TokenResponse>
}
```

### 4.2 AuthProvider (Extended)

**File:** `frontend/src/auth/AuthProvider.tsx`

Extended context value:

```typescript
interface AuthContextValue {
  // Existing
  user: AuthenticatedIdentity | null
  isAuthenticated: boolean
  isLoading: boolean
  login(employeeId: string, password: string): Promise<void>
  logout(): Promise<void>
  hasPermission(code: string): boolean
  hasRole(roles: string | string[]): boolean

  // New
  permissions: string[]
  dataScope: DataScopeResponse | null
  position: string | null
  department: string | null
  departmentScope: string[]        // ["ALL"] or ["RETAIL"]
  providerType: "mock" | "cbe_ad"
  refreshUser(): Promise<void>
}
```

### 4.3 Mock AD Login Page

**File:** `frontend/src/pages/auth/LoginPage.tsx` (replaced)

Design:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   [CBE Logo placeholder]                            │
│                                                     │
│   CBE Enterprise Dashboard Platform                 │
│                                                     │
│   ┌─────────────────────────────────────────────┐   │
│   │  ⚠ DEVELOPMENT ENVIRONMENT                 │   │
│   │  Simulated CBE AD Login — Not Real CBE AD  │   │
│   └─────────────────────────────────────────────┘   │
│                                                     │
│   Employee ID  [________________]                   │
│   Password     [________________]  👁               │
│                                                     │
│   [  Sign In  ]                                     │
│                                                     │
│   ─── Demo Users ──────────────────────────────    │
│   CBE001  Admin               (Head Office)         │
│   CBE002  Hiwot Tadesse       (Head Office)         │
│   CBE003  Bekele Alemu        (Regional Manager)    │
│   CBE004  Tigist Haile        (District Manager)    │
│   CBE005  Dawit Kebede        (Branch Manager)      │
│   CBE006  Sara Mulugeta       (Analyst)             │
│   CBE007  Yonas Tesfaye       (Viewer)              │
│                                                     │
│   All demo passwords: Demo@1234                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 4.4 Development Security Debug Panel

**File:** `frontend/src/components/dev/SecurityDebugPanel.tsx`

- Renders only when `import.meta.env.VITE_APP_ENV === 'development'`
- Collapsible panel, fixed bottom-right corner
- Shows:

```
┌─────────────────────────────────────────┐
│  🔒 AUTH DEBUG  [collapse ▲]            │
├─────────────────────────────────────────┤
│ Employee ID   CBE003                    │
│ Name          Bekele Alemu              │
│ Role          REGIONAL_MANAGER          │
│ Position      Regional Director         │
│ Department    Retail Banking            │
│ Provider      mock                      │
├─────────────────────────────────────────┤
│ SCOPE                                   │
│ Level         REGION                    │
│ Region        Addis Ababa (id=1)        │
│ District      —                         │
│ Branch        —                         │
│ Dept Scope    ALL                       │
├─────────────────────────────────────────┤
│ PERMISSIONS (6)                         │
│ dashboard.view  dashboard.export        │
│ user.view       dataset.view            │
│ datasource.view audit.view              │
└─────────────────────────────────────────┘
```

---

## 5. API Design

### AUTH-API-001 — POST /api/v1/auth/login

**Purpose:** Authenticate via Mock AD (development). In production this endpoint is disabled; users go through `/auth/ad/login` instead.

**Request:**
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

**Errors:** 401 wrong credentials, 401 inactive account, 403 if `AUTH_PROVIDER=cbe_ad`

---

### AUTH-API-002 — GET /api/v1/auth/me

**Purpose:** Return full identity of authenticated user.

**Response 200:**
```json
{
  "employee_id": "CBE003",
  "user_id": 3,
  "username": "bekele.alemu",
  "full_name": "Bekele Alemu",
  "email": "bekele@cbe.com.et",
  "position": "Regional Director",
  "department": "Retail Banking",
  "role": "REGIONAL_MANAGER",
  "access_level": "REGION",
  "region_id": 1,
  "region_name": "Addis Ababa Region",
  "district_id": null,
  "district_name": null,
  "branch_id": null,
  "branch_name": null,
  "is_active": true,
  "provider": "mock",
  "last_login": "2026-09-17T07:00:00Z"
}
```

---

### AUTH-API-004 — GET /api/v1/auth/permissions

**Purpose:** Return the full list of permission codes for the current user.

**Response 200:**
```json
{
  "permissions": [
    "dashboard.view",
    "dashboard.export",
    "user.view",
    "dataset.view",
    "datasource.view",
    "audit.view"
  ]
}
```

---

### AUTH-API-005 — GET /api/v1/users/me/data-scope

**Purpose:** Return the trusted organizational and department scope. Used by the frontend to configure filter UI (e.g., lock the Region dropdown).

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

---

### AUTH-API-007 — GET /api/v1/auth/ad/login

**Purpose:** Initiate OIDC Authorization Code Flow. Redirects browser to CBE IdP.

**Response:** HTTP 302 redirect to:
```
https://login.cbe.com.et/oauth2/authorize
  ?client_id=OIDC_CLIENT_ID
  &redirect_uri=OIDC_REDIRECT_URI
  &response_type=code
  &scope=openid+profile+email
  &state=CSRF_STATE_TOKEN
```

**Development:** Returns 503 with message "CBE AD not configured — use /auth/login"

---

### AUTH-API-008 — GET /api/v1/auth/ad/callback

**Purpose:** Receive authorization code from CBE IdP, exchange for tokens, resolve identity.

**Query params:** `code`, `state`

**Response:** HTTP 302 redirect to frontend:
```
http://analytics.internal/auth/callback?access_token=...&refresh_token=...
```

---

## 6. `.env` Extensions

```env
# Authentication provider: "mock" (development) or "cbe_ad" (production)
AUTH_PROVIDER=mock

# CBE OIDC configuration (required when AUTH_PROVIDER=cbe_ad)
OIDC_ISSUER_URL=https://login.cbe.com.et/oauth2
OIDC_CLIENT_ID=analytics-platform
OIDC_CLIENT_SECRET=CHANGE_IN_PRODUCTION
OIDC_REDIRECT_URI=http://analytics.internal/api/v1/auth/ad/callback
OIDC_SCOPES=openid profile email

# Frontend environment (used by SecurityDebugPanel visibility)
# Vite: set in .env.local
VITE_APP_ENV=development
```

---

## 7. Seed Data Design

The existing seed creates users with `username`. This is extended to add:

**`mock_ad_users` rows:**
| employee_id | password_hash | full_name | dept | position |
|---|---|---|---|---|
| CBE001 | bcrypt(Demo@1234) | Abebe Girma | IT | System Administrator |
| CBE002 | bcrypt(Demo@1234) | Hiwot Tadesse | Retail Banking | Head Office Director |
| CBE003 | bcrypt(Demo@1234) | Bekele Alemu | Retail Banking | Regional Director |
| CBE004 | bcrypt(Demo@1234) | Tigist Haile | Retail Banking | District Manager |
| CBE005 | bcrypt(Demo@1234) | Dawit Kebede | Retail Banking | Branch Manager |
| CBE006 | bcrypt(Demo@1234) | Sara Mulugeta | Analytics | Senior Analyst |
| CBE007 | bcrypt(Demo@1234) | Yonas Tesfaye | Retail Banking | Relationship Officer |

**`positions` rows:**
System Administrator, Head Office Director, Regional Director, District Manager, Branch Manager, Senior Analyst, Relationship Officer, VP Retail, VP Corporate, VP Digital Banking

**`departments` rows:**
Retail Banking, Corporate Banking, Digital Banking, Trade Finance, Analytics, Credit, Operations, IT, Finance, Human Resources

---

## 8. Migration Strategy

All changes use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS` — safe to run on a live database.

Migration order:
1. Add `employee_id`, `ad_provider`, `last_ad_sync` to `users`
2. Create `positions`, `departments`
3. Create `user_positions`, `user_department_scope`
4. Create `mock_ad_users`, `ad_user_mapping`
5. Create `authentication_sessions`
6. Seed `mock_ad_users` with demo users
7. Seed `positions` and `departments`
8. Update existing demo `users` rows with `employee_id` values

---

## 9. File Change Summary

| File | Change Type | Notes |
|---|---|---|
| `backend/app/security/auth_provider.py` | NEW | Abstract base + `AuthenticatedIdentity` |
| `backend/app/security/mock_ad_provider.py` | NEW | Dev authentication |
| `backend/app/security/cbe_ad_provider.py` | NEW | OIDC stub |
| `backend/app/security/identity_resolver.py` | NEW | DB lookups, called by both providers |
| `backend/app/security/auth_provider_factory.py` | NEW | Returns correct provider from config |
| `backend/app/security/dependencies.py` | EXTEND | Add `employee_id` to JWT extraction |
| `backend/app/api/v1/auth.py` | EXTEND | Route through provider factory, add 4 new endpoints |
| `backend/app/models/user.py` | EXTEND | Add `employee_id`, `ad_provider`, `last_ad_sync` |
| `backend/app/models/auth_models.py` | NEW | `Position`, `Department`, `UserPosition`, `UserDeptScope`, `MockADUser`, `ADUserMapping`, `AuthSession` |
| `backend/app/config/settings.py` | EXTEND | Add OIDC + `auth_provider` settings |
| `backend/scripts/seed_data.py` | EXTEND | Add positions, departments, mock_ad_users |
| `backend/migrations/versions/` | NEW | Single migration file for all new tables/columns |
| `frontend/src/api/authApi.ts` | NEW | Replaces `auth.api.ts` |
| `frontend/src/auth/AuthProvider.tsx` | EXTEND | Add position, department, dataScope |
| `frontend/src/auth/useAuth.ts` | EXTEND | Expose new context fields |
| `frontend/src/pages/auth/LoginPage.tsx` | REPLACE | Mock AD login UI |
| `frontend/src/components/dev/SecurityDebugPanel.tsx` | NEW | Dev-only debug panel |
| `backend/tests/test_auth_provider.py` | NEW | Provider + identity tests |
| `backend/tests/test_security_scope.py` | NEW | Scope isolation tests |
| `docs/api/authentication-api.md` | NEW | Full API reference |
| `docs/authentication.md` | NEW | |
| `docs/authorization.md` | NEW | |
| `docs/cbe-ad-integration.md` | NEW | OIDC integration guide for CBE IT |
| `docs/frontend-auth-integration.md` | NEW | |
| `docs/security-model.md` | NEW | |

---

## 10. What Does NOT Change

To be explicit — the following are untouched by this spec:

- `backend/app/security/data_scope.py` — already correct, no changes
- `backend/app/security/password.py` — still used for mock AD password hashing
- `backend/app/security/jwt.py` — extended payload fields only, logic unchanged
- All dashboard, widget, dataset, data_source APIs — no changes
- Organization hierarchy (regions/districts/branches) — no changes
- The existing RBAC permission check flow — no changes
- Frontend dashboard renderer, designer, all admin pages — no changes
