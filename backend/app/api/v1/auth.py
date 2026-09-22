"""
Authentication API — Phase 3 complete implementation.

Endpoints:
  POST /auth/login          — username/password → JWT tokens
  POST /auth/logout         — invalidate session (client-side + audit log)
  GET  /auth/me             — current user profile
  POST /auth/refresh        — issue new access token from refresh token
  POST /auth/change-password — authenticated user changes their own password
  POST /auth/reset-password  — admin resets another user's password
"""
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.security.dependencies import get_current_user, require_permission
from app.security.password import verify_password, hash_password
from app.security.jwt import create_access_token, create_refresh_token, decode_refresh_token
from app.config.settings import get_settings

router = APIRouter()
settings = get_settings()

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class ResetPasswordRequest(BaseModel):
    user_id: int
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class AdminSetPasswordRequest(BaseModel):
    """Used by admin to set any user's password directly."""
    new_password: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _audit(db, action: str, user_id: Optional[int], ip: str,
           ua: str, status_: str, details: Optional[dict] = None):
    """Fire-and-forget audit log — never raises."""
    try:
        from app.models.audit_log import AuditLog
        db.add(AuditLog(
            user_id=user_id, action=action,
            resource_type="auth", ip_address=ip,
            user_agent=ua[:500] if ua else None,
            status=status_, details=details,
        ))
        db.flush()
    except Exception:
        pass


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Authenticate with username + password.
    - Tracks failed attempts and locks the account after MAX_FAILED_ATTEMPTS.
    - Logs every attempt (success and failure) to audit_logs.
    """
    from app.models.user import User

    ip = _get_client_ip(request)
    ua = request.headers.get("User-Agent", "")
    now = datetime.now(timezone.utc)

    user = db.query(User).filter(User.username == body.username).first()

    # --- Account not found — generic error to prevent username enumeration ---
    if not user:
        _audit(db, "LOGIN_FAILED", None, ip, ua, "FAILURE",
               {"reason": "user_not_found", "username": body.username})
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Incorrect username or password")

    # --- Account locked ---
    if user.locked_until and user.locked_until > now:
        remaining = int((user.locked_until - now).total_seconds() / 60) + 1
        _audit(db, "LOGIN_FAILED", user.id, ip, ua, "FAILURE",
               {"reason": "account_locked"})
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Account locked. Try again in {remaining} minute(s).",
        )

    # --- Wrong password ---
    if not verify_password(body.password, user.password_hash):
        user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
        if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
            msg = f"Too many failed attempts. Account locked for {LOCKOUT_MINUTES} minutes."
        else:
            remaining_attempts = MAX_FAILED_ATTEMPTS - user.failed_login_attempts
            msg = f"Incorrect username or password. {remaining_attempts} attempt(s) remaining."
        _audit(db, "LOGIN_FAILED", user.id, ip, ua, "FAILURE",
               {"reason": "wrong_password", "attempts": user.failed_login_attempts})
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=msg)

    # --- Inactive account ---
    if not user.is_active:
        _audit(db, "LOGIN_FAILED", user.id, ip, ua, "FAILURE",
               {"reason": "account_inactive"})
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Account is inactive. Contact your administrator.")

    # --- Success ---
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login = now

    role_name = user.primary_role_name or "VIEWER"

    access_token = create_access_token(
        user_id=user.id, username=user.username, role=role_name,
        access_level=user.access_level,
        region_id=user.region_id,
        district_id=user.district_id,
        branch_id=user.branch_id,
    )
    refresh_token = create_refresh_token(user_id=user.id, username=user.username)

    _audit(db, "LOGIN", user.id, ip, ua, "SUCCESS")
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/logout")
def logout(request: Request,
           current_user=Depends(get_current_user),
           db: Session = Depends(get_db)):
    """Log the logout event. Token invalidation is client-side (remove from storage)."""
    ip = _get_client_ip(request)
    ua = request.headers.get("User-Agent", "")
    _audit(db, "LOGOUT", current_user.id, ip, ua, "SUCCESS")
    db.commit()
    return {"message": "Logged out successfully"}


@router.get("/me")
def get_me(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Return the authenticated user's full profile including org names."""
    region_name = current_user.region.name if current_user.region else None
    district_name = current_user.district.name if current_user.district else None
    branch_name = current_user.branch.name if current_user.branch else None

    return {
        "id": current_user.id,
        "username": current_user.username,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "access_level": current_user.access_level,
        "region_id": current_user.region_id,
        "region_name": region_name,
        "district_id": current_user.district_id,
        "district_name": district_name,
        "branch_id": current_user.branch_id,
        "branch_name": branch_name,
        "is_active": current_user.is_active,
        "last_login": current_user.last_login,
        "role": current_user.primary_role_name,
    }


@router.get("/me/permissions")
def get_my_permissions(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Return all permission codes for the current user. Used by the frontend permission guard."""
    from app.security.dependencies import get_user_permissions
    if current_user.primary_role_name == "ADMIN":
        # Admin has all permissions
        from app.models.permission import Permission
        all_codes = [p.code for p in db.query(Permission.code).filter(Permission.is_active == True).all()]
        return {"permissions": all_codes}
    return {"permissions": get_user_permissions(current_user.id, db)}


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    """Issue a new access token + refresh token from a valid refresh token."""
    from app.models.user import User

    payload = decode_refresh_token(body.refresh_token)
    user_id = int(payload["sub"])

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="User not found or inactive")

    role_name = user.primary_role_name or "VIEWER"
    access_token = create_access_token(
        user_id=user.id, username=user.username, role=role_name,
        access_level=user.access_level,
        region_id=user.region_id,
        district_id=user.district_id,
        branch_id=user.branch_id,
    )
    new_refresh = create_refresh_token(user_id=user.id, username=user.username)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/change-password")
def change_password(body: ChangePasswordRequest,
                    request: Request,
                    current_user=Depends(get_current_user),
                    db: Session = Depends(get_db)):
    """Authenticated user changes their own password."""
    ip = _get_client_ip(request)
    ua = request.headers.get("User-Agent", "")

    if not verify_password(body.current_password, current_user.password_hash):
        _audit(db, "PASSWORD_CHANGE_FAILED", current_user.id, ip, ua, "FAILURE",
               {"reason": "wrong_current_password"})
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Current password is incorrect")

    if verify_password(body.new_password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="New password must be different from current password")

    current_user.password_hash = hash_password(body.new_password)
    current_user.failed_login_attempts = 0
    current_user.locked_until = None
    _audit(db, "PASSWORD_CHANGED", current_user.id, ip, ua, "SUCCESS")
    db.commit()
    return {"message": "Password changed successfully"}


@router.post("/reset-password/{user_id}")
def reset_password(user_id: int,
                   body: AdminSetPasswordRequest,
                   request: Request,
                   current_user=Depends(require_permission("user.update")),
                   db: Session = Depends(get_db)):
    """
    Admin resets any user's password.
    Requires user.update permission.
    """
    from app.models.user import User

    ip = _get_client_ip(request)
    ua = request.headers.get("User-Agent", "")

    if len(body.new_password) < 8:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail="Password must be at least 8 characters")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target.password_hash = hash_password(body.new_password)
    target.failed_login_attempts = 0
    target.locked_until = None

    _audit(db, "PASSWORD_RESET", current_user.id, ip, ua, "SUCCESS",
           {"target_user_id": user_id, "target_username": target.username})
    db.commit()
    return {"message": f"Password reset successfully for {target.username}"}


@router.post("/unlock/{user_id}")
def unlock_user(user_id: int,
                request: Request,
                current_user=Depends(require_permission("user.update")),
                db: Session = Depends(get_db)):
    """Admin unlocks a locked user account."""
    from app.models.user import User

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target.failed_login_attempts = 0
    target.locked_until = None
    ip = _get_client_ip(request)
    ua = request.headers.get("User-Agent", "")
    _audit(db, "USER_UNLOCKED", current_user.id, ip, ua, "SUCCESS",
           {"target_user_id": user_id})
    db.commit()
    return {"message": f"Account unlocked for {target.username}"}
