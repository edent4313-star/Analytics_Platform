"""
Users API — Phase 4 complete implementation.
All mutations are admin-only (user.create / user.update / user.disable).
Org hierarchy validation enforced server-side.
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, EmailStr, field_validator
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.security.dependencies import get_current_user, require_permission
from app.security.password import hash_password
from app.services.audit_service import log_audit_event

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    access_level: str
    region_id: Optional[int] = None
    district_id: Optional[int] = None
    branch_id: Optional[int] = None
    role_id: int
    is_active: bool = True

    @field_validator("access_level")
    @classmethod
    def validate_access_level(cls, v: str) -> str:
        allowed = {"HEAD_OFFICE", "REGION", "DISTRICT", "BRANCH"}
        if v not in allowed:
            raise ValueError(f"access_level must be one of {allowed}")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    access_level: Optional[str] = None
    region_id: Optional[int] = None
    district_id: Optional[int] = None
    branch_id: Optional[int] = None
    role_id: Optional[int] = None


class StatusUpdate(BaseModel):
    is_active: bool


# ── Helpers ───────────────────────────────────────────────────────────────────

def _validate_org_hierarchy(db: Session, access_level: str,
                             region_id, district_id, branch_id):
    """Enforce: access_level must match the supplied org fields."""
    from app.models.organization import Region, District, Branch

    if access_level == "HEAD_OFFICE":
        if region_id or district_id or branch_id:
            raise HTTPException(400, "HEAD_OFFICE users must not have org unit assigned")
        return

    if access_level in ("REGION", "DISTRICT", "BRANCH"):
        if not region_id:
            raise HTTPException(400, f"{access_level} users require region_id")
        if not db.query(Region).filter_by(id=region_id).first():
            raise HTTPException(400, "region_id not found")

    if access_level in ("DISTRICT", "BRANCH"):
        if not district_id:
            raise HTTPException(400, f"{access_level} users require district_id")
        district = db.query(District).filter_by(id=district_id).first()
        if not district:
            raise HTTPException(400, "district_id not found")
        if district.region_id != region_id:
            raise HTTPException(400, "district does not belong to the specified region")

    if access_level == "BRANCH":
        if not branch_id:
            raise HTTPException(400, "BRANCH users require branch_id")
        branch = db.query(Branch).filter_by(id=branch_id).first()
        if not branch:
            raise HTTPException(400, "branch_id not found")
        if branch.district_id != district_id:
            raise HTTPException(400, "branch does not belong to the specified district")


def _user_to_dict(user) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "access_level": user.access_level,
        "region_id": user.region_id,
        "region_name": user.region.name if user.region else None,
        "district_id": user.district_id,
        "district_name": user.district.name if user.district else None,
        "branch_id": user.branch_id,
        "branch_name": user.branch.name if user.branch else None,
        "is_active": user.is_active,
        "last_login": user.last_login,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "role": user.primary_role_name,
        "failed_login_attempts": user.failed_login_attempts,
        "locked_until": user.locked_until,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    access_level: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user=Depends(require_permission("user.view")),
    db: Session = Depends(get_db),
):
    from app.models.user import User
    q = db.query(User)
    if search:
        like = f"%{search}%"
        q = q.filter(
            User.username.ilike(like) |
            User.full_name.ilike(like) |
            User.email.ilike(like)
        )
    if access_level:
        q = q.filter(User.access_level == access_level)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    total = q.count()
    users = q.order_by(User.full_name).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [_user_to_dict(u) for u in users],
        "total": total, "page": page, "page_size": page_size,
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_user(
    body: UserCreate,
    request: Request,
    current_user=Depends(require_permission("user.create")),
    db: Session = Depends(get_db),
):
    from app.models.user import User
    from app.models.role import UserRole, Role

    # Uniqueness checks
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(400, "Username already exists")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, "Email already in use")

    # Validate role exists
    role = db.query(Role).filter_by(id=body.role_id, is_active=True).first()
    if not role:
        raise HTTPException(400, "role_id not found")

    # Validate org hierarchy
    _validate_org_hierarchy(db, body.access_level,
                             body.region_id, body.district_id, body.branch_id)

    user = User(
        username=body.username,
        full_name=body.full_name,
        email=body.email,
        phone=body.phone,
        password_hash=hash_password(body.password),
        access_level=body.access_level,
        region_id=body.region_id,
        district_id=body.district_id,
        branch_id=body.branch_id,
        is_active=body.is_active,
        created_by=current_user.id,
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role_id=body.role_id,
                    assigned_by=current_user.id))
    log_audit_event(db, "USER_CREATE", current_user.id,
                    resource_type="user", resource_id=str(user.id),
                    ip_address=request.client.host if request.client else None,
                    details={"username": user.username})
    db.commit()
    db.refresh(user)
    return _user_to_dict(user)


@router.get("/{user_id}")
def get_user(
    user_id: int,
    current_user=Depends(require_permission("user.view")),
    db: Session = Depends(get_db),
):
    from app.models.user import User
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    return _user_to_dict(user)


@router.put("/{user_id}")
def update_user(
    user_id: int,
    body: UserUpdate,
    request: Request,
    current_user=Depends(require_permission("user.update")),
    db: Session = Depends(get_db),
):
    from app.models.user import User
    from app.models.role import UserRole, Role

    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    if body.full_name is not None: user.full_name = body.full_name
    if body.email is not None:
        exists = db.query(User).filter(User.email == body.email, User.id != user_id).first()
        if exists:
            raise HTTPException(400, "Email already in use")
        user.email = body.email
    if body.phone is not None: user.phone = body.phone

    # If access_level or org changed, re-validate
    new_level = body.access_level or user.access_level
    new_region = body.region_id if body.region_id is not None else user.region_id
    new_district = body.district_id if body.district_id is not None else user.district_id
    new_branch = body.branch_id if body.branch_id is not None else user.branch_id

    if any(x is not None for x in [body.access_level, body.region_id,
                                     body.district_id, body.branch_id]):
        _validate_org_hierarchy(db, new_level, new_region, new_district, new_branch)
        user.access_level = new_level
        user.region_id = new_region
        user.district_id = new_district
        user.branch_id = new_branch

    if body.role_id is not None:
        role = db.query(Role).filter_by(id=body.role_id, is_active=True).first()
        if not role:
            raise HTTPException(400, "role_id not found")
        # Replace user's primary role
        db.query(UserRole).filter_by(user_id=user.id).delete()
        db.add(UserRole(user_id=user.id, role_id=body.role_id, assigned_by=current_user.id))

    user.updated_at = datetime.now(timezone.utc)
    log_audit_event(db, "USER_UPDATE", current_user.id,
                    resource_type="user", resource_id=str(user_id),
                    ip_address=request.client.host if request.client else None)
    db.commit()
    db.refresh(user)
    return _user_to_dict(user)


@router.patch("/{user_id}/status")
def update_user_status(
    user_id: int,
    body: StatusUpdate,
    request: Request,
    current_user=Depends(require_permission("user.disable")),
    db: Session = Depends(get_db),
):
    from app.models.user import User
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == current_user.id:
        raise HTTPException(400, "Cannot change your own account status")
    user.is_active = body.is_active
    action = "USER_ACTIVATE" if body.is_active else "USER_DISABLE"
    log_audit_event(db, action, current_user.id, resource_type="user",
                    resource_id=str(user_id),
                    ip_address=request.client.host if request.client else None)
    db.commit()
    return {"id": user.id, "is_active": user.is_active}
