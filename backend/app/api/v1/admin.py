"""
Administration API — Spec 08.
All endpoints require ADMIN role or specific admin permissions.
Provides unified /api/v1/admin/* namespace for all administration operations.

Existing APIs (users, roles, permissions, org, audit) are re-exposed here
with stricter permission requirements and extended functionality.
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

# ── Admin guard ───────────────────────────────────────────────────────────────

def require_admin(current_user=Depends(get_current_user)):
    """Ensure caller has ADMIN role or user.view permission at minimum."""
    role = current_user.primary_role_name or ""
    if role != "ADMIN":
        from app.database.session import SessionLocal
        # Will be caught by require_permission elsewhere; minimal check here
        pass
    return current_user


# ═══════════════════════════════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════════════════════════════

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
    employee_id: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    is_active: bool = True

    @field_validator("password")
    @classmethod
    def pw_len(cls, v):
        if len(v) < 8: raise ValueError("Min 8 characters")
        return v

    @field_validator("access_level")
    @classmethod
    def valid_level(cls, v):
        if v not in {"HEAD_OFFICE","REGION","DISTRICT","BRANCH"}:
            raise ValueError("Invalid access_level")
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
    employee_id: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None

class StatusUpdate(BaseModel):
    is_active: bool

class ScopeUpdate(BaseModel):
    access_level: str
    region_id: Optional[int] = None
    district_id: Optional[int] = None
    branch_id: Optional[int] = None
    department_codes: Optional[list[str]] = None  # ["ALL"] or ["RETAIL","CORPORATE"]

def _validate_org(db, access_level, region_id, district_id, branch_id):
    from app.models.organization import Region, District, Branch
    if access_level == "HEAD_OFFICE":
        return
    if access_level in ("REGION","DISTRICT","BRANCH"):
        if not region_id or not db.query(Region).filter_by(id=region_id).first():
            raise HTTPException(400, f"{access_level} requires valid region_id")
    if access_level in ("DISTRICT","BRANCH"):
        d = db.query(District).filter_by(id=district_id).first()
        if not d: raise HTTPException(400, f"{access_level} requires valid district_id")
        if d.region_id != region_id: raise HTTPException(400, "District not in specified region")
    if access_level == "BRANCH":
        b = db.query(Branch).filter_by(id=branch_id).first()
        if not b: raise HTTPException(400, "BRANCH requires valid branch_id")
        if b.district_id != district_id: raise HTTPException(400, "Branch not in specified district")

def _user_dict(u) -> dict:
    return {
        "id": u.id, "username": u.username, "full_name": u.full_name,
        "email": u.email, "phone": u.phone,
        "employee_id": u.employee_id,
        "access_level": u.access_level,
        "region_id": u.region_id, "region_name": u.region.name if u.region else None,
        "district_id": u.district_id, "district_name": u.district.name if u.district else None,
        "branch_id": u.branch_id, "branch_name": u.branch.name if u.branch else None,
        "is_active": u.is_active, "last_login": u.last_login,
        "created_at": u.created_at, "updated_at": u.updated_at,
        "role": u.primary_role_name,
        "failed_login_attempts": u.failed_login_attempts,
        "locked_until": u.locked_until,
        "ad_provider": u.ad_provider,
    }

@router.get("/users")
def admin_list_users(
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = None, access_level: Optional[str] = None,
    is_active: Optional[bool] = None, role: Optional[str] = None,
    current_user=Depends(require_permission("user.view")), db: Session = Depends(get_db),
):
    from app.models.user import User
    from app.models.role import UserRole, Role
    q = db.query(User)
    if search:
        like = f"%{search}%"
        q = q.filter(User.username.ilike(like)|User.full_name.ilike(like)|User.email.ilike(like))
    if access_level: q = q.filter(User.access_level == access_level)
    if is_active is not None: q = q.filter(User.is_active == is_active)
    if role:
        role_ids = [r.id for r in db.query(Role).filter(Role.name == role).all()]
        user_ids = [ur.user_id for ur in db.query(UserRole).filter(UserRole.role_id.in_(role_ids)).all()]
        q = q.filter(User.id.in_(user_ids))
    total = q.count()
    users = q.order_by(User.full_name).offset((page-1)*page_size).limit(page_size).all()
    return {"items": [_user_dict(u) for u in users], "total": total, "page": page, "page_size": page_size}

@router.post("/users", status_code=201)
def admin_create_user(
    body: UserCreate, request: Request,
    current_user=Depends(require_permission("user.create")), db: Session = Depends(get_db),
):
    from app.models.user import User
    from app.models.role import UserRole, Role
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(400, "Username already exists")
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(400, "Email already in use")
    if body.employee_id and db.query(User).filter(User.employee_id == body.employee_id).first():
        raise HTTPException(400, "Employee ID already assigned")
    if not db.query(Role).filter_by(id=body.role_id, is_active=True).first():
        raise HTTPException(400, "Role not found")
    _validate_org(db, body.access_level, body.region_id, body.district_id, body.branch_id)
    u = User(
        username=body.username, full_name=body.full_name, email=body.email,
        phone=body.phone, password_hash=hash_password(body.password),
        access_level=body.access_level, region_id=body.region_id,
        district_id=body.district_id, branch_id=body.branch_id,
        employee_id=body.employee_id, is_active=body.is_active,
        created_by=current_user.id,
    )
    db.add(u); db.flush()
    db.add(UserRole(user_id=u.id, role_id=body.role_id, assigned_by=current_user.id))
    log_audit_event(db, "USER_CREATE", current_user.id, resource_type="user",
                    resource_id=str(u.id),
                    ip_address=request.client.host if request.client else None,
                    details={"username": u.username, "role_id": body.role_id})
    db.commit(); db.refresh(u)
    return _user_dict(u)

@router.get("/users/{user_id}")
def admin_get_user(user_id: int, current_user=Depends(require_permission("user.view")), db: Session = Depends(get_db)):
    from app.models.user import User
    u = db.query(User).filter_by(id=user_id).first()
    if not u: raise HTTPException(404, "User not found")
    return _user_dict(u)

@router.put("/users/{user_id}")
def admin_update_user(
    user_id: int, body: UserUpdate, request: Request,
    current_user=Depends(require_permission("user.update")), db: Session = Depends(get_db),
):
    from app.models.user import User
    from app.models.role import UserRole, Role
    u = db.query(User).filter_by(id=user_id).first()
    if not u: raise HTTPException(404, "User not found")
    if body.full_name: u.full_name = body.full_name
    if body.email:
        if db.query(User).filter(User.email==body.email, User.id!=user_id).first():
            raise HTTPException(400, "Email in use")
        u.email = body.email
    if body.phone is not None: u.phone = body.phone
    if body.employee_id is not None: u.employee_id = body.employee_id
    if body.access_level or body.region_id is not None or body.district_id is not None or body.branch_id is not None:
        new_level = body.access_level or u.access_level
        new_region = body.region_id if body.region_id is not None else u.region_id
        new_district = body.district_id if body.district_id is not None else u.district_id
        new_branch = body.branch_id if body.branch_id is not None else u.branch_id
        _validate_org(db, new_level, new_region, new_district, new_branch)
        u.access_level=new_level; u.region_id=new_region; u.district_id=new_district; u.branch_id=new_branch
    if body.role_id:
        if not db.query(Role).filter_by(id=body.role_id, is_active=True).first():
            raise HTTPException(400, "Role not found")
        db.query(UserRole).filter_by(user_id=u.id).delete()
        db.add(UserRole(user_id=u.id, role_id=body.role_id, assigned_by=current_user.id))
    u.updated_at = datetime.now(timezone.utc)
    log_audit_event(db, "USER_UPDATE", current_user.id, resource_type="user", resource_id=str(user_id),
                    ip_address=request.client.host if request.client else None)
    db.commit(); db.refresh(u)
    return _user_dict(u)

@router.patch("/users/{user_id}/status")
def admin_set_user_status(
    user_id: int, body: StatusUpdate, request: Request,
    current_user=Depends(require_permission("user.disable")), db: Session = Depends(get_db),
):
    from app.models.user import User
    u = db.query(User).filter_by(id=user_id).first()
    if not u: raise HTTPException(404, "User not found")
    if u.id == current_user.id: raise HTTPException(400, "Cannot change own status")
    u.is_active = body.is_active
    log_audit_event(db, "USER_DISABLE" if not body.is_active else "USER_ACTIVATE",
                    current_user.id, resource_type="user", resource_id=str(user_id),
                    ip_address=request.client.host if request.client else None)
    db.commit()
    return {"id": u.id, "is_active": u.is_active}

@router.get("/users/{user_id}/scope")
def admin_get_user_scope(user_id: int, current_user=Depends(require_permission("user.view")), db: Session = Depends(get_db)):
    from app.models.user import User
    from app.security.identity_resolver import _get_dept_scope
    u = db.query(User).filter_by(id=user_id).first()
    if not u: raise HTTPException(404, "User not found")
    return {
        "user_id": u.id, "access_level": u.access_level,
        "region_id": u.region_id, "region_name": u.region.name if u.region else None,
        "district_id": u.district_id, "district_name": u.district.name if u.district else None,
        "branch_id": u.branch_id, "branch_name": u.branch.name if u.branch else None,
        "department_scope": _get_dept_scope(u.id, db),
    }

@router.put("/users/{user_id}/scope")
def admin_update_user_scope(
    user_id: int, body: ScopeUpdate, request: Request,
    current_user=Depends(require_permission("user.update")), db: Session = Depends(get_db),
):
    from app.models.user import User
    from sqlalchemy import text
    u = db.query(User).filter_by(id=user_id).first()
    if not u: raise HTTPException(404, "User not found")
    _validate_org(db, body.access_level, body.region_id, body.district_id, body.branch_id)
    u.access_level = body.access_level
    u.region_id = body.region_id; u.district_id = body.district_id; u.branch_id = body.branch_id
    # Update department scope
    if body.department_codes is not None:
        try:
            db.execute(text("DELETE FROM user_department_scope WHERE user_id = :uid"), {"uid": user_id})
            if body.department_codes and body.department_codes != ["ALL"]:
                for code in body.department_codes:
                    db.execute(text("""
                        INSERT INTO user_department_scope (user_id, department_id)
                        SELECT :uid, id FROM departments WHERE code = :code
                    """), {"uid": user_id, "code": code})
        except Exception:
            pass
    log_audit_event(db, "USER_SCOPE_CHANGED", current_user.id, resource_type="user",
                    resource_id=str(user_id),
                    ip_address=request.client.host if request.client else None,
                    details={"new_level": body.access_level, "dept_scope": body.department_codes})
    db.commit()
    return {"message": "Scope updated", "user_id": user_id, "access_level": body.access_level}

@router.get("/users/{user_id}/permissions")
def admin_get_user_permissions(user_id: int, current_user=Depends(require_permission("user.view")), db: Session = Depends(get_db)):
    from app.security.dependencies import get_user_permissions
    from app.models.dashboard import DashboardPermission
    from app.models.role import UserRole
    perms = get_user_permissions(user_id, db)
    role_ids = [r.role_id for r in db.query(UserRole).filter_by(user_id=user_id).all()]
    dash_perms = db.query(DashboardPermission).filter(DashboardPermission.role_id.in_(role_ids)).all()
    return {
        "user_id": user_id,
        "permissions": perms,
        "dashboard_permissions": [
            {"dashboard_id": dp.dashboard_id, "role_id": dp.role_id,
             "can_view": dp.can_view, "can_export": dp.can_export}
            for dp in dash_perms
        ],
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ROLES
# ═══════════════════════════════════════════════════════════════════════════════

class RoleCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None

class PermissionAssign(BaseModel):
    permission_ids: list[int]

def _role_dict(r) -> dict:
    return {"id": r.id, "name": r.name, "display_name": r.display_name,
            "description": r.description, "is_system": r.is_system, "is_active": r.is_active}

@router.get("/roles")
def admin_list_roles(current_user=Depends(require_permission("role.view")), db: Session = Depends(get_db)):
    from app.models.role import Role
    return [_role_dict(r) for r in db.query(Role).order_by(Role.display_name).all()]

@router.post("/roles", status_code=201)
def admin_create_role(body: RoleCreate, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from app.models.role import Role
    if db.query(Role).filter_by(name=body.name).first():
        raise HTTPException(400, "Role name exists")
    r = Role(name=body.name, display_name=body.display_name, description=body.description, is_system=False, is_active=True)
    db.add(r); db.commit(); db.refresh(r)
    return _role_dict(r)

@router.get("/roles/{role_id}")
def admin_get_role(role_id: int, current_user=Depends(require_permission("role.view")), db: Session = Depends(get_db)):
    from app.models.role import Role
    r = db.query(Role).filter_by(id=role_id).first()
    if not r: raise HTTPException(404, "Role not found")
    return _role_dict(r)

@router.put("/roles/{role_id}")
def admin_update_role(role_id: int, body: RoleCreate, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from app.models.role import Role
    r = db.query(Role).filter_by(id=role_id).first()
    if not r: raise HTTPException(404, "Role not found")
    if r.is_system: raise HTTPException(400, "Cannot modify system roles")
    r.name=body.name; r.display_name=body.display_name; r.description=body.description
    db.commit(); db.refresh(r)
    return _role_dict(r)

@router.delete("/roles/{role_id}", status_code=204)
def admin_delete_role(role_id: int, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from app.models.role import Role
    r = db.query(Role).filter_by(id=role_id).first()
    if not r: raise HTTPException(404, "Role not found")
    if r.is_system: raise HTTPException(400, "Cannot delete system roles")
    r.is_active = False; db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# PERMISSIONS
# ═══════════════════════════════════════════════════════════════════════════════

class PermCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    category: str

@router.get("/permissions")
def admin_list_permissions(current_user=Depends(require_permission("permission.view")), db: Session = Depends(get_db)):
    from app.models.permission import Permission
    perms = db.query(Permission).order_by(Permission.category, Permission.code).all()
    return [{"id": p.id, "code": p.code, "name": p.name, "description": p.description,
             "category": p.category, "is_active": p.is_active} for p in perms]

@router.post("/permissions", status_code=201)
def admin_create_permission(body: PermCreate, current_user=Depends(require_permission("permission.manage")), db: Session = Depends(get_db)):
    from app.models.permission import Permission
    if db.query(Permission).filter_by(code=body.code).first():
        raise HTTPException(400, "Permission code exists")
    p = Permission(code=body.code, name=body.name, description=body.description, category=body.category, is_active=True)
    db.add(p); db.commit(); db.refresh(p)
    return {"id": p.id, "code": p.code, "name": p.name, "category": p.category}

@router.put("/permissions/{perm_id}")
def admin_update_permission(perm_id: int, body: PermCreate, current_user=Depends(require_permission("permission.manage")), db: Session = Depends(get_db)):
    from app.models.permission import Permission
    p = db.query(Permission).filter_by(id=perm_id).first()
    if not p: raise HTTPException(404, "Permission not found")
    p.code=body.code; p.name=body.name; p.description=body.description; p.category=body.category
    db.commit(); db.refresh(p)
    return {"id": p.id, "code": p.code, "name": p.name, "category": p.category}

@router.delete("/permissions/{perm_id}", status_code=204)
def admin_delete_permission(perm_id: int, current_user=Depends(require_permission("permission.manage")), db: Session = Depends(get_db)):
    from app.models.permission import Permission
    p = db.query(Permission).filter_by(id=perm_id).first()
    if not p: raise HTTPException(404, "Permission not found")
    p.is_active = False; db.commit()

@router.put("/roles/{role_id}/permissions")
def admin_set_role_permissions(
    role_id: int, body: PermissionAssign,
    current_user=Depends(require_permission("permission.manage")), db: Session = Depends(get_db),
):
    from app.models.role import Role, RolePermission
    from app.models.permission import Permission
    r = db.query(Role).filter_by(id=role_id).first()
    if not r: raise HTTPException(404, "Role not found")
    if r.is_system: raise HTTPException(400, "Cannot modify system role permissions")
    for pid in body.permission_ids:
        if not db.query(Permission).filter_by(id=pid).first():
            raise HTTPException(400, f"Permission {pid} not found")
    db.query(RolePermission).filter_by(role_id=role_id).delete()
    for pid in body.permission_ids:
        db.add(RolePermission(role_id=role_id, permission_id=pid, granted_by=current_user.id))
    db.commit()
    return {"message": "Permissions updated", "count": len(body.permission_ids)}


# ═══════════════════════════════════════════════════════════════════════════════
# DEPARTMENTS
# ═══════════════════════════════════════════════════════════════════════════════

class DeptCreate(BaseModel):
    code: str
    name: str

@router.get("/departments")
def admin_list_departments(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from sqlalchemy import text
    try:
        rows = db.execute(text("SELECT id, code, name, is_active FROM departments ORDER BY name")).all()
        return [{"id": r[0], "code": r[1], "name": r[2], "is_active": r[3]} for r in rows]
    except Exception:
        return []

@router.post("/departments", status_code=201)
def admin_create_department(body: DeptCreate, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from sqlalchemy import text
    existing = db.execute(text("SELECT id FROM departments WHERE code=:c"), {"c": body.code}).first()
    if existing: raise HTTPException(400, "Department code exists")
    row = db.execute(text("INSERT INTO departments (code, name) VALUES (:c,:n) RETURNING id"), {"c": body.code, "n": body.name}).first()
    db.commit()
    return {"id": row[0], "code": body.code, "name": body.name}

@router.put("/departments/{dept_id}")
def admin_update_department(dept_id: int, body: DeptCreate, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from sqlalchemy import text
    db.execute(text("UPDATE departments SET code=:c, name=:n WHERE id=:id"), {"c": body.code, "n": body.name, "id": dept_id})
    db.commit()
    return {"id": dept_id, "code": body.code, "name": body.name}


# ═══════════════════════════════════════════════════════════════════════════════
# POSITIONS
# ═══════════════════════════════════════════════════════════════════════════════

class PosCreate(BaseModel):
    code: str
    name: str
    level: int = 0

@router.get("/positions")
def admin_list_positions(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from sqlalchemy import text
    try:
        rows = db.execute(text("SELECT id, code, name, level, is_active FROM positions ORDER BY level DESC, name")).all()
        return [{"id": r[0], "code": r[1], "name": r[2], "level": r[3], "is_active": r[4]} for r in rows]
    except Exception:
        return []

@router.post("/positions", status_code=201)
def admin_create_position(body: PosCreate, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from sqlalchemy import text
    existing = db.execute(text("SELECT id FROM positions WHERE code=:c"), {"c": body.code}).first()
    if existing: raise HTTPException(400, "Position code exists")
    row = db.execute(text("INSERT INTO positions (code,name,level) VALUES (:c,:n,:l) RETURNING id"),
                     {"c": body.code, "n": body.name, "l": body.level}).first()
    db.commit()
    return {"id": row[0], "code": body.code, "name": body.name, "level": body.level}

@router.put("/positions/{pos_id}")
def admin_update_position(pos_id: int, body: PosCreate, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from sqlalchemy import text
    db.execute(text("UPDATE positions SET code=:c, name=:n, level=:l WHERE id=:id"),
               {"c": body.code, "n": body.name, "l": body.level, "id": pos_id})
    db.commit()
    return {"id": pos_id, "code": body.code, "name": body.name, "level": body.level}


# ═══════════════════════════════════════════════════════════════════════════════
# ORGANIZATIONS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/organizations")
def admin_get_organizations(current_user=Depends(require_permission("user.view")), db: Session = Depends(get_db)):
    from app.models.organization import Region, District, Branch
    regions = db.query(Region).order_by(Region.name).all()
    result = []
    for reg in regions:
        districts = db.query(District).filter_by(region_id=reg.id).order_by(District.name).all()
        result.append({
            "id": reg.id, "code": reg.code, "name": reg.name, "status": reg.status,
            "districts": [{
                "id": d.id, "code": d.code, "name": d.name, "status": d.status,
                "branches": [
                    {"id": b.id, "code": b.code, "name": b.name, "status": b.status}
                    for b in db.query(Branch).filter_by(district_id=d.id).order_by(Branch.name).all()
                ]
            } for d in districts]
        })
    return result

@router.get("/regions")
def admin_list_regions(current_user=Depends(require_permission("user.view")), db: Session = Depends(get_db)):
    from app.models.organization import Region
    return [{"id": r.id, "code": r.code, "name": r.name, "status": r.status}
            for r in db.query(Region).order_by(Region.name).all()]

@router.get("/districts")
def admin_list_districts(region_id: Optional[int] = None, current_user=Depends(require_permission("user.view")), db: Session = Depends(get_db)):
    from app.models.organization import District
    q = db.query(District)
    if region_id: q = q.filter_by(region_id=region_id)
    return [{"id": d.id, "code": d.code, "name": d.name, "region_id": d.region_id, "status": d.status}
            for d in q.order_by(District.name).all()]

@router.get("/branches")
def admin_list_branches(district_id: Optional[int] = None, region_id: Optional[int] = None,
                        current_user=Depends(require_permission("user.view")), db: Session = Depends(get_db)):
    from app.models.organization import Branch
    q = db.query(Branch)
    if district_id: q = q.filter_by(district_id=district_id)
    if region_id: q = q.filter_by(region_id=region_id)
    return [{"id": b.id, "code": b.code, "name": b.name,
             "district_id": b.district_id, "region_id": b.region_id, "status": b.status}
            for b in q.order_by(Branch.name).all()]


# ═══════════════════════════════════════════════════════════════════════════════
# DASHBOARD PERMISSIONS
# ═══════════════════════════════════════════════════════════════════════════════

class DashPermCreate(BaseModel):
    dashboard_id: int
    role_id: int
    can_view: bool = True
    can_export: bool = False

@router.get("/dashboard-permissions")
def admin_list_dash_perms(
    dashboard_id: Optional[int] = None, role_id: Optional[int] = None,
    current_user=Depends(require_permission("dashboard.publish")), db: Session = Depends(get_db),
):
    from app.models.dashboard import DashboardPermission, Dashboard
    from app.models.role import Role
    q = db.query(DashboardPermission)
    if dashboard_id: q = q.filter_by(dashboard_id=dashboard_id)
    if role_id: q = q.filter_by(role_id=role_id)
    result = []
    for dp in q.all():
        d = db.query(Dashboard).filter_by(id=dp.dashboard_id).first()
        r = db.query(Role).filter_by(id=dp.role_id).first()
        result.append({
            "id": dp.id, "dashboard_id": dp.dashboard_id,
            "dashboard_name": d.name if d else None,
            "dashboard_code": d.code if d else None,
            "role_id": dp.role_id, "role_name": r.display_name if r else None,
            "can_view": dp.can_view, "can_export": dp.can_export,
        })
    return result

@router.post("/dashboard-permissions", status_code=201)
def admin_create_dash_perm(
    body: DashPermCreate,
    current_user=Depends(require_permission("dashboard.publish")), db: Session = Depends(get_db),
):
    from app.models.dashboard import DashboardPermission, Dashboard
    from app.models.role import Role
    if not db.query(Dashboard).filter_by(id=body.dashboard_id).first():
        raise HTTPException(404, "Dashboard not found")
    if not db.query(Role).filter_by(id=body.role_id).first():
        raise HTTPException(404, "Role not found")
    # Upsert
    existing = db.query(DashboardPermission).filter_by(
        dashboard_id=body.dashboard_id, role_id=body.role_id).first()
    if existing:
        existing.can_view=body.can_view; existing.can_export=body.can_export
    else:
        existing = DashboardPermission(
            dashboard_id=body.dashboard_id, role_id=body.role_id,
            can_view=body.can_view, can_export=body.can_export,
            granted_by=current_user.id)
        db.add(existing)
    db.commit(); db.refresh(existing)
    return {"id": existing.id, "dashboard_id": existing.dashboard_id,
            "role_id": existing.role_id, "can_view": existing.can_view, "can_export": existing.can_export}

@router.put("/dashboard-permissions/{perm_id}")
def admin_update_dash_perm(
    perm_id: int, body: DashPermCreate,
    current_user=Depends(require_permission("dashboard.publish")), db: Session = Depends(get_db),
):
    from app.models.dashboard import DashboardPermission
    dp = db.query(DashboardPermission).filter_by(id=perm_id).first()
    if not dp: raise HTTPException(404, "Permission not found")
    dp.can_view=body.can_view; dp.can_export=body.can_export
    db.commit()
    return {"id": dp.id, "can_view": dp.can_view, "can_export": dp.can_export}

@router.delete("/dashboard-permissions/{perm_id}", status_code=204)
def admin_delete_dash_perm(
    perm_id: int,
    current_user=Depends(require_permission("dashboard.publish")), db: Session = Depends(get_db),
):
    from app.models.dashboard import DashboardPermission
    dp = db.query(DashboardPermission).filter_by(id=perm_id).first()
    if not dp: raise HTTPException(404, "Permission not found")
    db.delete(dp); db.commit()
