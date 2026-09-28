# REQUIREMENTS — Authentication and Authorization
# CBE Enterprise Dashboard Platform
# Spec: 02-AUTHENTICATION-AND-AUTHORIZATION

Version: 1.0
Status: DRAFT — Awaiting Approval
Date: 2026-09-17

---

## 1. Context: Existing Platform State

The current platform already has a working username/password authentication system built in Phases 1–3:

| Existing Component | File | Action Required |
|---|---|---|
| JWT auth (username + bcrypt) | `backend/app/api/v1/auth.py` | EXTEND — keep as MockAuthProvider |
| `get_current_user` dependency | `backend/app/security/dependencies.py` | EXTEND — inject provider abstraction |
| `DataScope` enforcement | `backend/app/security/data_scope.py` | KEEP — already correct |
| `AuthContext`, `useAuth` | `frontend/src/auth/` | EXTEND — add AD flow |
| Login page | `frontend/src/pages/auth/LoginPage.tsx` | REPLACE with AD-style simulation |
| User model | `backend/app/models/user.py` | EXTEND — add AD/position/dept fields |

**Nothing in the existing authorization, dashboard, or data-scope logic needs to change.** The abstraction layer is added around authentication only.

---

## 2. Functional Requirements

### REQ-AUTH-001 — Authentication Provider Abstraction
The system MUST implement an authentication provider interface that allows swapping the authentication backend without modifying any authorization, dashboard, or data logic.

```
AuthenticationProvider (abstract interface)
├── MockADAuthenticationProvider    ← used in development / demo
└── CBEActiveDirectoryProvider      ← used in production (implemented as stub)
```

Both providers MUST produce an identical `AuthenticatedIdentity` object that the rest of the system consumes.

### REQ-AUTH-002 — No CBE Employee Password Storage
The production system MUST NOT store CBE employee usernames or passwords in the application database. Authentication is delegated entirely to CBE AD/SSO.

### REQ-AUTH-003 — Mock AD Provider
A `MockADAuthenticationProvider` MUST be implemented for local development. It:
- Accepts Employee ID + demo password
- Returns a realistic `AuthenticatedIdentity` matching a seeded demo user
- Clearly labels itself as development/test only — never implies real CBE AD
- Is activated by setting `AUTH_PROVIDER=mock` in `.env`

### REQ-AUTH-004 — CBE AD Provider Stub
A `CBEActiveDirectoryProvider` MUST be implemented as a working stub:
- Defines the interface that the real CBE IT team will implement
- Supports SAML 2.0 / OAuth 2.0 / LDAP as integration patterns (configurable)
- Is activated by setting `AUTH_PROVIDER=cbe_ad` in `.env`
- Contains commented documentation for CBE IT integration

### REQ-AUTH-005 — Authenticated Identity Object
Every authentication provider MUST produce an `AuthenticatedIdentity` containing:

| Field | Source | Required |
|---|---|---|
| `employee_id` | AD | Yes |
| `username` | AD | Yes |
| `full_name` | AD | Yes |
| `email` | AD | Yes |
| `department` | AD or App DB | Yes |
| `position` | AD or App DB | Yes |
| `access_level` | App DB (by employee_id) | Yes |
| `region_id` | App DB | Conditional |
| `district_id` | App DB | Conditional |
| `branch_id` | App DB | Conditional |
| `role` | App DB | Yes |
| `permissions` | App DB | Yes |
| `is_active` | AD + App DB | Yes |

If AD does not provide `department`, `position`, or org scope, the system MUST look them up from the application database using `employee_id` as the key.

### REQ-AUTH-006 — Session Token
After successful authentication, the backend MUST issue a signed JWT containing:
- `employee_id` (sub)
- `access_level`
- `region_id`, `district_id`, `branch_id` (from trusted App DB — never from frontend)
- Token expiry
- Provider type (`mock` or `cbe_ad`)

The JWT secret MUST come from environment configuration. It MUST NOT be hard-coded.

### REQ-AUTH-007 — Token Refresh
The system MUST support token refresh so users are not logged out while actively using the platform.

---

## 3. Authorization Requirements

### REQ-AUTHZ-001 — Role-Based Access Control
Authorization MUST be based on the combination of:
- Role (ADMIN, HEAD_OFFICE_USER, REGIONAL_MANAGER, DISTRICT_MANAGER, BRANCH_MANAGER, ANALYST, VIEWER)
- Position (optional refinement)
- Department scope (ALL or specific department codes)
- Organization scope (HEAD_OFFICE, REGION, DISTRICT, BRANCH)
- Dashboard-level permission
- Action permission (VIEW, CREATE, EDIT, DELETE, PUBLISH, ADMIN, EXPORT)

All of these MUST be stored in the application database and derived from the authenticated `employee_id`. None of them may be supplied or modified by the frontend.

### REQ-AUTHZ-002 — Organization Scope Enforcement
The data scope rules from the existing platform (Phases 1–6) are preserved and extended:

| Access Level | Data Visible |
|---|---|
| HEAD_OFFICE | All authorized organizational data |
| REGION | Only their assigned region |
| DISTRICT | Only their assigned district |
| BRANCH | Only their assigned branch |

This enforcement happens in `backend/app/security/data_scope.py` (already implemented) and MUST NOT be bypassable by any frontend parameter.

### REQ-AUTHZ-003 — Department Scope
In addition to organizational scope, department-level restrictions MUST be supported:

| Department Scope | Meaning |
|---|---|
| ALL | User sees all departments within their org scope |
| SPECIFIC | User sees only data tagged to their department(s) |

### REQ-AUTHZ-004 — Dashboard Permission Isolation
Dashboard access MUST be checked per-request on the backend. The URL `/d/DB-000125` identifies the dashboard only. The URL is NOT a security mechanism. Every request to load or query a dashboard MUST re-verify:
1. Is the user authenticated?
2. Does their role have VIEW permission for this dashboard?
3. Is the data within their org + department scope?

### REQ-AUTHZ-005 — URL Manipulation Prevention
The backend MUST ignore any `region_id`, `district_id`, `branch_id`, `department`, `role`, or `permission` values supplied in query parameters, URL paths, or request bodies for security decisions. Only the authenticated token context is trusted.

---

## 4. Database Requirements

### REQ-DB-001 — New and Extended Tables
The following tables must be added or extended (without breaking existing tables):

**New tables:**
- `positions` — job positions (Director, VP, Manager, Officer, etc.)
- `departments` — organizational departments (Retail, Corporate, Digital, etc.)
- `user_positions` — user ↔ position mapping
- `user_department_scope` — which departments a user can see data for
- `authentication_sessions` — audit trail of login/logout events (extends current `audit_logs`)
- `ad_user_mapping` — maps `employee_id` from AD to internal `user_id`

**Extended tables (additive columns only — no breaking changes):**
- `users` — add: `employee_id` (unique, nullable for backward compat), `ad_provider`, `last_ad_sync`
- `organizations` — add: `department_id` (optional FK)

### REQ-DB-002 — No Breaking Changes
All new columns MUST be nullable or have defaults so existing seeded data and running queries are unaffected.

---

## 5. API Requirements

The following endpoints MUST be implemented. Existing endpoints are extended, not replaced.

| API ID | Method | Endpoint | Status |
|---|---|---|---|
| AUTH-API-001 | POST | `/api/v1/auth/login` | EXTEND existing (add provider routing) |
| AUTH-API-002 | GET | `/api/v1/auth/me` | EXTEND existing (add position/dept) |
| AUTH-API-003 | POST | `/api/v1/auth/logout` | KEEP existing |
| AUTH-API-004 | GET | `/api/v1/auth/permissions` | NEW — return full permission set |
| AUTH-API-005 | GET | `/api/v1/users/me/data-scope` | NEW — return trusted org + dept scope |
| AUTH-API-006 | GET | `/api/v1/auth/session` | NEW — return session metadata |
| AUTH-API-007 | GET | `/api/v1/auth/ad/login` | NEW STUB — AD/SSO entry point |
| AUTH-API-008 | GET | `/api/v1/auth/ad/callback` | NEW STUB — AD/SSO callback |
| AUTH-API-009 | POST | `/api/v1/auth/refresh` | KEEP existing |

Each endpoint MUST be documented in `docs/api/authentication-api.md` with the full specification described in Section 5 of the feature spec.

---

## 6. Frontend Requirements

### REQ-FE-001 — Typed API Client
A typed frontend API client MUST exist at `src/api/authApi.ts` with functions:
- `login(employeeId, password)` — Mock AD only
- `logout()`
- `getCurrentUser()` → `AuthenticatedIdentity`
- `getPermissions()` → `string[]`
- `getDataScope()` → `DataScope`
- `getSession()` → `SessionInfo`
- `refreshSession()`

The existing `src/api/auth.api.ts` MUST be unified with or replaced by this file.

### REQ-FE-002 — Auth Provider and Hooks
The following files MUST exist and be consistent with each other:
- `src/auth/AuthProvider.tsx` — provides full identity + permissions + data scope to the React tree
- `src/auth/useAuth.ts` — hook to consume auth context
- `src/auth/ProtectedRoute.tsx` — redirects unauthenticated users
- `src/auth/PermissionGuard.tsx` — conditionally renders UI by permission

All four already exist in the project. They MUST be extended to include `position`, `department`, and `dataScope` fields from the new identity object.

### REQ-FE-003 — Mock AD Login Page
A simulated CBE AD login page MUST be implemented, replacing the current generic login page. It MUST:
- Display "CBE Employee Login — Development Environment" or equivalent
- Accept Employee ID (not username) and demo password
- Show a clear notice that this is a simulated login, not the real CBE AD
- List available demo users with their Employee IDs and roles for convenience
- Behave like an AD flow: Employee ID → verify → redirect to portal

### REQ-FE-004 — Development Security Debug Panel
A collapsible dev-only panel MUST be shown when `APP_ENV=development`. It displays:
- Employee ID, Name, Role, Position, Department
- Organization Level, Region, District, Branch
- Active permissions list
- Current data scope
- Authentication provider type

This panel MUST NOT appear in production (`APP_ENV=production`).

### REQ-FE-005 — Frontend Authorization is UI Only
The frontend MUST NOT make final security decisions. It uses permissions and scope only to:
- Show/hide UI elements (buttons, menu items, nav links)
- Redirect to 403 page when a protected route is accessed without permission

The backend remains the authoritative security boundary for all data access.

---

## 7. Demo Users Requirements

### REQ-DEMO-001 — Seeded Demo Users for Mock AD
The following demo users MUST be seeded and functional with the Mock AD provider:

| Employee ID | Name | Role | Level | Scope |
|---|---|---|---|---|
| CBE001 | Abebe Girma | ADMIN | HEAD_OFFICE | All |
| CBE002 | Hiwot Tadesse | HEAD_OFFICE_USER | HEAD_OFFICE | All |
| CBE003 | Bekele Alemu | REGIONAL_MANAGER | REGION | Addis Ababa |
| CBE004 | Tigist Haile | DISTRICT_MANAGER | DISTRICT | Bole District |
| CBE005 | Dawit Kebede | BRANCH_MANAGER | BRANCH | Bole Main Branch |
| CBE006 | Sara Mulugeta | ANALYST | HEAD_OFFICE | All |
| CBE007 | Yonas Tesfaye | VIEWER | BRANCH | Bole Main Branch |

All demo passwords MUST be `Demo@1234` for consistency.

---

## 8. Security Requirements

### REQ-SEC-001 — Never Trust Frontend Scope
The backend MUST derive all of the following exclusively from the authenticated JWT + application database:
- `region_id`, `district_id`, `branch_id`
- `department`
- `role`, `position`
- `permissions`

### REQ-SEC-002 — Active User Check
Every authenticated request MUST verify the user is `is_active = true` in the application database. A deactivated user's token MUST be rejected even if it has not yet expired.

### REQ-SEC-003 — Audit Logging
The following events MUST be logged to `audit_logs`:
- Login (success and failure)
- Logout
- Token refresh
- Permission denied (403)
- Organization scope violation attempt

### REQ-SEC-004 — No Production Credentials in Source
CBE AD credentials, LDAP bind passwords, and SSO secrets MUST NOT appear in source code. They MUST come from environment variables only.

---

## 9. Testing Requirements

### REQ-TEST-001 — Backend Tests
Tests MUST cover:
- Successful Mock AD login for each demo user
- Invalid Employee ID / wrong password
- Inactive user rejection
- Token refresh
- Permission denied (403) for unauthorized action
- Org scope denial (branch manager cannot access another branch)
- Department scope denial
- Dashboard permission isolation
- URL parameter manipulation cannot widen scope

### REQ-TEST-002 — Security Regression Tests
Tests MUST prove:
- `GET /api/v1/dashboard/fcy-lead/widgets/1/data?branch_id=999` returns 403 or own-scope data for a branch manager
- `GET /api/v1/regions` returns only the user's region for a regional manager
- An inactive user's valid JWT returns 401

---

## 10. Out of Scope for This Spec

The following are NOT part of this requirements document:
- Actual CBE AD server configuration (CBE IT responsibility)
- LDAP topology or AD forest structure
- MFA implementation
- Password complexity for demo users beyond `Demo@1234`
- Email notification on login
- User self-registration

---

## 11. Assumptions and Constraints

| # | Assumption |
|---|---|
| A1 | The existing platform database, models, and APIs remain operational throughout this change |
| A2 | CBE AD attributes available over LDAP/SAML include at minimum: `sAMAccountName`, `displayName`, `mail`, `department`, `title` |
| A3 | `employee_id` in the application database maps to `sAMAccountName` or `employeeID` attribute in AD |
| A4 | The existing `DataScope` enforcement in `data_scope.py` is correct and needs no change |
| A5 | The platform runs on an internal network — no external OAuth providers are required |
| A6 | PostgreSQL 18, Python 3.11, FastAPI, React 18 remain the technology stack |

---

## 12. Deliverables for This Spec

On full approval and implementation:

| Deliverable | Path |
|---|---|
| Requirements | `docs/specs/02-authentication-authorization/requirements.md` ← this file |
| Design | `docs/specs/02-authentication-authorization/design.md` |
| Tasks | `docs/specs/02-authentication-authorization/tasks.md` |
| Auth provider abstraction | `backend/app/security/auth_provider.py` |
| Mock AD provider | `backend/app/security/mock_ad_provider.py` |
| CBE AD provider stub | `backend/app/security/cbe_ad_provider.py` |
| Extended models | `backend/app/models/` (additive changes) |
| New migrations | `backend/migrations/versions/` |
| Seed update | `backend/scripts/seed_data.py` (add employee_id, positions, depts) |
| API documentation | `docs/api/authentication-api.md` |
| Auth documentation | `docs/authentication.md` |
| Authorization documentation | `docs/authorization.md` |
| CBE AD integration guide | `docs/cbe-ad-integration.md` |
| Frontend integration guide | `docs/frontend-auth-integration.md` |
| Security model | `docs/security-model.md` |
| Frontend API client | `frontend/src/api/authApi.ts` |
| Auth provider | `frontend/src/auth/AuthProvider.tsx` |
| Mock AD login page | `frontend/src/pages/auth/LoginPage.tsx` (replaced) |
| Dev security panel | `frontend/src/components/dev/SecurityDebugPanel.tsx` |
| Backend tests | `backend/tests/test_auth_provider.py` |
| Security tests | `backend/tests/test_security_scope.py` |
