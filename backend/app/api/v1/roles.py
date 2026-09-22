"""Roles API — full CRUD + permission assignment."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.security.dependencies import require_permission

router = APIRouter()

class RoleCreate(BaseModel):
    name: str
    display_name: str
    description: Optional[str] = None

class PermissionAssign(BaseModel):
    permission_ids: list[int]

def _role_dict(r) -> dict:
    return {"id": r.id, "name": r.name, "display_name": r.display_name,
            "description": r.description, "is_system": r.is_system, "is_active": r.is_active}

@router.get("")
def list_roles(current_user=Depends(require_permission("role.view")), db: Session = Depends(get_db)):
    from app.models.role import Role
    return [_role_dict(r) for r in db.query(Role).filter(Role.is_active == True).order_by(Role.display_name).all()]

@router.post("", status_code=201)
def create_role(body: RoleCreate, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from app.models.role import Role
    if db.query(Role).filter_by(name=body.name).first():
        raise HTTPException(400, "Role name already exists")
    r = Role(name=body.name, display_name=body.display_name, description=body.description, is_system=False, is_active=True)
    db.add(r); db.commit(); db.refresh(r)
    return _role_dict(r)

@router.put("/{role_id}")
def update_role(role_id: int, body: RoleCreate, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from app.models.role import Role
    r = db.query(Role).filter_by(id=role_id).first()
    if not r: raise HTTPException(404, "Role not found")
    if r.is_system: raise HTTPException(400, "Cannot modify system roles")
    r.name = body.name; r.display_name = body.display_name; r.description = body.description
    db.commit(); db.refresh(r)
    return _role_dict(r)

@router.get("/{role_id}/permissions")
def get_role_permissions(role_id: int, current_user=Depends(require_permission("role.view")), db: Session = Depends(get_db)):
    from app.models.role import RolePermission
    from app.models.permission import Permission
    perms = (db.query(Permission)
             .join(RolePermission, Permission.id == RolePermission.permission_id)
             .filter(RolePermission.role_id == role_id).all())
    return [{"id": p.id, "code": p.code, "name": p.name, "category": p.category} for p in perms]

@router.put("/{role_id}/permissions")
def set_role_permissions(role_id: int, body: PermissionAssign, current_user=Depends(require_permission("permission.manage")), db: Session = Depends(get_db)):
    from app.models.role import Role, RolePermission
    from app.models.permission import Permission
    role = db.query(Role).filter_by(id=role_id).first()
    if not role: raise HTTPException(404, "Role not found")
    if role.is_system: raise HTTPException(400, "Cannot modify system role permissions")
    # Validate all permission IDs exist
    for pid in body.permission_ids:
        if not db.query(Permission).filter_by(id=pid).first():
            raise HTTPException(400, f"Permission id {pid} not found")
    db.query(RolePermission).filter_by(role_id=role_id).delete()
    for pid in body.permission_ids:
        db.add(RolePermission(role_id=role_id, permission_id=pid, granted_by=current_user.id))
    db.commit()
    return {"message": "Permissions updated", "count": len(body.permission_ids)}
