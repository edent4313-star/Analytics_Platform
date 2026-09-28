# Authentication API Reference
# CBE Enterprise Analytics Platform — Spec 02

Base URL: `/api/v1`

---

## AUTH-API-001 — POST /auth/login

**Purpose:** Authenticate via Mock AD (development). Returns JWT tokens.
**Who calls it:** Login page (`LoginPage.tsx`) on form submit.
**Auth required:** No.
**Only active when:** `AUTH_PROVIDER=mock`

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

**Errors:**
- `401` — Invalid Employee ID or password
- `401` — Account locked (after 5 failed attempts)
- `401` — Account inactive
- `403` — Direct login disabled (`AUTH_PROVIDER=cbe_ad`)

**Security:** Password never logged. Lockout after 5 failed attempts (15 min).

---

## AUTH-API-002 — GET /auth/me

**Purpose:** Return full identity of authenticated user including position, department, and org names.
**Who calls it:** `AuthProvider.tsx` on mount and after login. `SecurityDebugPanel.tsx`.
**Auth required:** Bearer token.

**Response 200:**
```json
{
  "employee_id": "CBE003",
  "user_id": 3,
  "username": "bekele.alemu",
  "full_name": "Bekele Alemu",
  "email": "bekele.alemu@cbe.com.et",
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

---

## AUTH-API-003 — POST /auth/logout

**Purpose:** Log the logout event. Token invalidation is client-side.
**Auth required:** Bearer token.
**Response 200:** `{"message": "Logged out successfully"}`

---

## AUTH-API-004 — GET /auth/permissions

**Purpose:** Return all permission codes for the current user. Frontend uses this to show/hide UI elements.
**Auth required:** Bearer token.

**Response 200:**
```json
{ "permissions": ["dashboard.view", "dashboard.export", "user.view"] }
```

**Security note:** Frontend permission checks are UI hints only. Backend enforces all permissions independently.

---

## AUTH-API-005 — GET /users/me/data-scope

**Purpose:** Return trusted org + department scope. Frontend uses to lock filter dropdowns.
**Auth required:** Bearer token.

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

**Security note:** This value is derived from the authenticated user in the DB. It cannot be changed by the frontend. Passing a different `region_id` in a dashboard request will be rejected or ignored.

---

## AUTH-API-006 — GET /auth/session

**Purpose:** Return session metadata (no sensitive data).
**Auth required:** Bearer token.

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

## AUTH-API-007 — GET /auth/ad/login

**Purpose:** Initiate CBE OIDC login. Redirects browser to CBE Identity Provider.
**Auth required:** No.
**Only active when:** `AUTH_PROVIDER=cbe_ad`

**Response:** HTTP 302 → CBE IdP authorization URL.
**Development:** Returns 503 with instructions to use `/auth/login`.

---

## AUTH-API-008 — GET /auth/ad/callback

**Purpose:** OIDC callback. Exchanges code for tokens, resolves identity, redirects to frontend.
**Auth required:** No (state/code from CBE IdP).
**Only active when:** `AUTH_PROVIDER=cbe_ad`

**Query params:** `code` (required), `state`

**Response:** HTTP 302 → `{FRONTEND_URL}/auth/callback?access_token=...&refresh_token=...`

---

## AUTH-API-009 — POST /auth/refresh

**Purpose:** Issue new access token from a valid refresh token.
**Auth required:** No (uses refresh token in body).

**Request body:**
```json
{ "refresh_token": "eyJ..." }
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

---

## Additional Endpoints

### POST /auth/change-password
Authenticated user changes their own password.
Body: `{ "current_password": "...", "new_password": "..." }` (min 8 chars, 1 uppercase, 1 digit)

### POST /auth/reset-password/{user_id}
Admin resets another user's password. Requires `user.update` permission.
Body: `{ "new_password": "..." }`

### POST /auth/unlock/{user_id}
Admin unlocks a locked account. Requires `user.update` permission.

---

## Switching to Production (CBE AD)

1. Set `AUTH_PROVIDER=cbe_ad` in `.env`
2. Set `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URI`
3. Restart the backend service
4. Users click "Sign In with CBE AD" → redirected to CBE IdP → back to platform

No code changes required. The frontend, RBAC, data scope, and dashboard engine are unchanged.
