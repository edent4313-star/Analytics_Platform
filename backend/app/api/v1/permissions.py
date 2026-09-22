"""Permissions API — list all permissions by category."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.security.dependencies import require_permission

router = APIRouter()

@router.get("")
def list_permissions(current_user=Depends(require_permission("permission.view")), db: Session = Depends(get_db)):
    from app.models.permission import Permission
    perms = (db.query(Permission)
             .filter(Permission.is_active == True)
             .order_by(Permission.category, Permission.code).all())
    return [{"id": p.id, "code": p.code, "name": p.name,
             "description": p.description, "category": p.category} for p in perms]
