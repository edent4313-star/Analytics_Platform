"""
Authentication API — Spec 02 complete implementation.

Endpoints:
  POST /auth/login              Mock AD login (development)
  POST /auth/logout             End session
  GET  /auth/me                 Current user full identity
  GET  /auth/permissions        Current user permission codes
  GET  /auth/session            Session metadata
  POST /auth/refresh            Refresh access token
  POST /auth/change-password    User changes own password
  POST /auth/reset-password/:id Admin resets another user's password
  POST /auth/unlock/:id         Admin unlocks locked account
  GET  /auth/ad/login           Initiate CBE OIDC flow (production)
  GET  /auth/ad/callback        CBE OIDC callback (production)
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Query, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.security.dependencies import get_current_user, require_permission, get_user_permissions
from app.security.password import verify_password, hash_password
from app.security.jwt import create_access_token, create_refresh_token, decode_refresh_token
from app.security.auth_provider_factory import get_auth_provider
from app.config.settings import get_settings

router = APIRouter()
settings = get_settings()

MAX_FAILED = 5
LOCKOUT_MIN = 15

# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    employee_id: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    provider: str = "mock"

class RefreshRequest(BaseModel):
    refresh_token: str

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def strong(cls, v: str) -> str:
        if len(v) < 8: raise ValueError("Min 8 characters")
        if not any(c.isupper() for c in v): raise ValueError("Needs an uppercase letter")
        if not any(c.isdigit() for c in v): raise ValueError("Needs a number")
        return v

class ResetPasswordRequest(BaseModel):
    new_password: str

class AdminSetPasswordRequest(BaseModel):
    new_password: str

# ── Helpers ───────────────────────────────────────────────────────────────────

def _ip(request: Request) -> str:
    fwd = request.headers.get("X-Forwarded-For")
    return fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else "unknown")

def _audit(db, action, user_id, ip, ua, status_="SUCCESS", details=None):
    try:
        from app.models.audit_log import AuditLog
        db.add(AuditLog(user_id=user_id, action=action, resource_type="auth",
                        ip_address=ip, user_agent=ua[:500] if ua else None,
                        status=status_, details=details))
        db.flush()
    except Exception:
        pass

def _log_session(db, user_id, employee_id, provider, ip, ua, expires_at):
    try:
        from sqlalchemy import text
        db.execute(text("""
            INSERT INTO authentication_sessions
                (user_id, employee_id, provider, ip_address, user_agent, expires_at)
            VALUES (:uid, :eid, :prov, :ip, :ua, :exp)
        """), {"uid": user_id, "eid": employee_id, "prov": provider,
               "ip": ip, "ua": (ua or "")[:500], "exp": expires_at})
    except Exception:
        pass

# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Authenticate with Employee ID + password (Mock AD only).
    Returns JWT access + refresh tokens.
    In production (AUTH_PROVIDER=cbe_ad) this returns 403 — use GET /auth/ad/login.
    """
    ip = _ip(request)
    ua = request.headers.get("User-Agent", "")
    now = datetime.now(timezone.utc)

    # Block direct login in production
    if settings.auth_provider == "cbe_ad":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Direct login is disabled. Use CBE AD login at /auth/ad/login",
        )

    # Check lockout on the user before calling provider
    from app.models.user import User
    pre_user = (
        db.query(User).filter(User.employee_id == body.employee_id).first()
        or db.query(User).filter(User.username == body.employee_id).first()
    )
    if pre_user and pre_user.locked_until and pre_user.locked_until > now:
        remaining = int((pre_user.locked_until - now).total_seconds() / 60) + 1
        _audit(db, "LOGIN_FAILED", pre_user.id, ip, ua, "FAILURE", {"reason": "locked"})
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Account locked. Try again in {remaining} minute(s).",
        )

    try:
        provider = get_auth_provider(settings)
        identity = provider.authenticate({"employee_id": body.employee_id, "password": body.password}, db)
    except HTTPException as e:
        # Track failed attempts
        if pre_user:
            pre_user.failed_login_attempts = (pre_user.failed_login_attempts or 0) + 1
            if pre_user.failed_login_attempts >= MAX_FAILED:
                pre_user.locked_until = now + timedelta(minutes=LOCKOUT_MIN)
            _audit(db, "LOGIN_FAILED", pre_user.id, ip, ua, "FAILURE",
                   {"reason": "bad_credentials", "attempts": pre_user.failed_login_attempts})
        else:
            _audit(db, "LOGIN_FAILED", None, ip, ua, "FAILURE",
                   {"reason": "user_not_found", "employee_id": body.employee_id})
        db.commit()
        raise

    # Success — reset lockout
    if pre_user:
        pre_user.failed_login_attempts = 0
        pre_user.locked_until = None

    expires_at = now + timedelta(minutes=settings.jwt_access_token_expire_minutes)

    access_token = create_access_token(
        user_id=identity.user_id,
        username=identity.username,
        role=identity.role,
        access_level=identity.access_level,
        region_id=identity.region_id,
        district_id=identity.district_id,
        branch_id=identity.branch_id,
    )
    refresh_token = create_refresh_token(user_id=identity.user_id, username=identity.username)

    _audit(db, "LOGIN", identity.user_id, ip, ua, "SUCCESS", {"provider": identity.provider})
    _log_session(db, identity.user_id, identity.employee_id, identity.provider, ip, ua, expires_at)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
        provider=identity.provider,
    )


@router.post("/logout")
def logout(request: Request, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    _audit(db, "LOGOUT", current_user.id, _ip(request), request.headers.get("User-Agent", ""), "SUCCESS")
    db.commit()
    return {"message": "Logged out successfully"}


@router.get("/me")
def get_me(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Full identity including position, department, org names."""
    from app.security.identity_resolver import _get_position, _get_department, _get_dept_scope
    return {
        "employee_id": current_user.employee_id or current_user.username,
        "user_id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "role": current_user.primary_role_name,
        "access_level": current_user.access_level,
        "region_id": current_user.region_id,
        "region_name": current_user.region.name if current_user.region else None,
        "district_id": current_user.district_id,
        "district_name": current_user.district.name if current_user.district else None,
        "branch_id": current_user.branch_id,
        "branch_name": current_user.branch.name if current_user.branch else None,
        "position": _get_position(current_user.id, db),
        "department": _get_department(current_user.id, db),
        "is_active": current_user.is_active,
        "last_login": current_user.last_login,
        "provider": current_user.ad_provider or "mock",
    }


@router.get("/me/permissions")
def get_my_permissions(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Return all permission codes for the current user."""
    if current_user.primary_role_name in ("ADMIN", "SYSTEM_ADMIN"):
        from app.models.permission import Permission
        codes = [p.code for p in db.query(Permission).filter(Permission.is_active == True).all()]
        return {"permissions": codes}
    return {"permissions": get_user_permissions(current_user.id, db)}


@router.get("/permissions")
def get_permissions(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Alias for /me/permissions — required by Spec 02 API list."""
    return get_my_permissions(current_user, db)


@router.get("/users/me/data-scope")
def get_data_scope_endpoint(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Return the trusted organizational + department scope for the current user.
    Frontend uses this to configure filter UIs (lock region dropdown, etc.).
    This value is authoritative — the frontend cannot override it.
    """
    from app.security.identity_resolver import _get_dept_scope
    return {
        "access_level": current_user.access_level,
        "region_id": current_user.region_id,
        "region_name": current_user.region.name if current_user.region else None,
        "district_id": current_user.district_id,
        "district_name": current_user.district.name if current_user.district else None,
        "branch_id": current_user.branch_id,
        "branch_name": current_user.branch.name if current_user.branch else None,
        "department_scope": _get_dept_scope(current_user.id, db),
        "is_head_office": current_user.access_level == "HEAD_OFFICE",
    }


@router.get("/session")
def get_session(current_user=Depends(get_current_user)):
    """Return session metadata (provider, user info, not the token itself)."""
    return {
        "user_id": current_user.id,
        "employee_id": current_user.employee_id or current_user.username,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.primary_role_name,
        "provider": current_user.ad_provider or "mock",
        "is_active": current_user.is_active,
        "last_login": current_user.last_login,
    }


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    from app.models.user import User
    payload = decode_refresh_token(body.refresh_token)
    user = db.query(User).filter(User.id == int(payload["sub"]), User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    access_token = create_access_token(
        user_id=user.id, username=user.username,
        role=user.primary_role_name or "VIEWER",
        access_level=user.access_level,
        region_id=user.region_id, district_id=user.district_id, branch_id=user.branch_id,
    )
    new_refresh = create_refresh_token(user_id=user.id, username=user.username)
    return TokenResponse(
        access_token=access_token, refresh_token=new_refresh,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
        provider=user.ad_provider or "mock",
    )


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, request: Request,
                    current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    ip = _ip(request); ua = request.headers.get("User-Agent", "")
    if not verify_password(body.current_password, current_user.password_hash):
        _audit(db, "PASSWORD_CHANGE_FAILED", current_user.id, ip, ua, "FAILURE")
        db.commit()
        raise HTTPException(400, "Current password is incorrect")
    if verify_password(body.new_password, current_user.password_hash):
        raise HTTPException(400, "New password must differ from current password")
    current_user.password_hash = hash_password(body.new_password)
    current_user.failed_login_attempts = 0
    current_user.locked_until = None
    _audit(db, "PASSWORD_CHANGED", current_user.id, ip, ua, "SUCCESS")
    db.commit()
    return {"message": "Password changed successfully"}


@router.post("/reset-password/{user_id}")
def reset_password(user_id: int, body: AdminSetPasswordRequest, request: Request,
                   current_user=Depends(require_permission("user.update")),
                   db: Session = Depends(get_db)):
    from app.models.user import User
    target = db.query(User).filter_by(id=user_id).first()
    if not target: raise HTTPException(404, "User not found")
    if len(body.new_password) < 8: raise HTTPException(422, "Min 8 characters")
    target.password_hash = hash_password(body.new_password)
    target.failed_login_attempts = 0; target.locked_until = None
    _audit(db, "PASSWORD_RESET", current_user.id, _ip(request), request.headers.get("User-Agent",""),
           "SUCCESS", {"target_user_id": user_id, "target_username": target.username})
    db.commit()
    return {"message": f"Password reset for {target.username}"}


@router.post("/unlock/{user_id}")
def unlock_user(user_id: int, request: Request,
                current_user=Depends(require_permission("user.update")),
                db: Session = Depends(get_db)):
    from app.models.user import User
    target = db.query(User).filter_by(id=user_id).first()
    if not target: raise HTTPException(404, "User not found")
    target.failed_login_attempts = 0; target.locked_until = None
    _audit(db, "USER_UNLOCKED", current_user.id, _ip(request), request.headers.get("User-Agent",""),
           "SUCCESS", {"target_user_id": user_id})
    db.commit()
    return {"message": f"Account unlocked for {target.username}"}


# ── OIDC Endpoints (production CBE AD) ───────────────────────────────────────

@router.get("/ad/login")
def ad_login(request: Request):
    """
    Initiate CBE OIDC login. Redirects browser to CBE Identity Provider.
    Only works when AUTH_PROVIDER=cbe_ad and OIDC settings are configured.
    """
    if settings.auth_provider != "cbe_ad":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "CBE AD is not active. Set AUTH_PROVIDER=cbe_ad in .env to enable. "
                "Use POST /auth/login with Employee ID + password for development."
            ),
        )
    provider = get_auth_provider(settings)
    auth_url, state = provider.get_authorization_url()
    response = RedirectResponse(url=auth_url)
    # Store state in HttpOnly cookie for CSRF validation in callback
    response.set_cookie(
        "oidc_state", state,
        max_age=300,
        httponly=True,
        samesite="lax",
        secure=settings.app_env == "production",
    )
    return response


@router.get("/ad/callback")
def ad_callback(
    code: str = Query(...),
    state: str = Query(""),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """
    CBE OIDC callback. Validates state, exchanges code for tokens,
    resolves identity, issues application JWT.
    Redirects to frontend using URL fragment (tokens NOT in query string
    to prevent browser history / server log exposure).
    """
    if settings.auth_provider != "cbe_ad":
        raise HTTPException(503, "CBE AD is not configured")

    # Retrieve expected state from cookie for CSRF validation
    expected_state = request.cookies.get("oidc_state", "") if request else ""

    provider = get_auth_provider(settings)
    identity = provider.exchange_code(code, expected_state, state, db)

    access_token = create_access_token(
        user_id=identity.user_id, username=identity.username,
        role=identity.role, access_level=identity.access_level,
        region_id=identity.region_id, district_id=identity.district_id,
        branch_id=identity.branch_id,
    )
    refresh_token_val = create_refresh_token(user_id=identity.user_id, username=identity.username)

    ip = _ip(request) if request else "unknown"
    ua = request.headers.get("User-Agent", "") if request else ""
    _audit(db, "LOGIN", identity.user_id, ip, ua, "SUCCESS", {"provider": "cbe_ad"})
    _log_session(db, identity.user_id, identity.employee_id, "cbe_ad", ip, ua,
                 datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_access_token_expire_minutes))
    db.commit()

    # Redirect using fragment (#) — tokens never appear in server logs or browser history
    frontend_url = settings.frontend_url.rstrip("/")
    fragment = f"access_token={access_token}&refresh_token={refresh_token_val}&provider=cbe_ad"
    redirect_url = f"{frontend_url}/auth/callback#{fragment}"

    response = RedirectResponse(url=redirect_url)
    # Clear OIDC state cookie
    response.delete_cookie("oidc_state")
    return response
