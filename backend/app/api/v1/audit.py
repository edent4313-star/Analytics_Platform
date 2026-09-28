"""Audit Logs API — Spec 08 extended."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.security.dependencies import require_permission

router = APIRouter()

SECURITY_EVENTS = {
    "LOGIN_FAILED", "UNAUTHORIZED_ACCESS_ATTEMPT",
    "USER_SCOPE_CHANGED", "PERMISSION_DELETED", "PERMISSION_CREATED",
}

def _log_dict(l) -> dict:
    return {
        "id": l.id, "user_id": l.user_id,
        "username": l.user.username if l.user else None,
        "full_name": l.user.full_name if l.user else None,
        "action": l.action, "resource_type": l.resource_type,
        "resource_id": l.resource_id, "status": l.status,
        "ip_address": l.ip_address, "details": l.details,
        "created_at": l.created_at,
    }

@router.get("")
def list_audit_logs(
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
    user_id: Optional[int] = None, action: Optional[str] = None,
    resource_type: Optional[str] = None, status: Optional[str] = None,
    date_from: Optional[str] = None, date_to: Optional[str] = None,
    current_user=Depends(require_permission("audit.view")), db: Session = Depends(get_db),
):
    from app.models.audit_log import AuditLog
    q = db.query(AuditLog)
    if user_id: q = q.filter(AuditLog.user_id == user_id)
    if action: q = q.filter(AuditLog.action == action)
    if resource_type: q = q.filter(AuditLog.resource_type == resource_type)
    if status: q = q.filter(AuditLog.status == status)
    if date_from:
        from datetime import datetime
        q = q.filter(AuditLog.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        from datetime import datetime
        q = q.filter(AuditLog.created_at <= datetime.fromisoformat(date_to))
    total = q.count()
    logs = q.order_by(AuditLog.created_at.desc()).offset((page-1)*page_size).limit(page_size).all()
    return {"items": [_log_dict(l) for l in logs], "total": total, "page": page, "page_size": page_size}

@router.get("/security-events")
def list_security_events(
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
    current_user=Depends(require_permission("audit.view")), db: Session = Depends(get_db),
):
    from app.models.audit_log import AuditLog
    q = db.query(AuditLog).filter(AuditLog.action.in_(list(SECURITY_EVENTS)))
    total = q.count()
    logs = q.order_by(AuditLog.created_at.desc()).offset((page-1)*page_size).limit(page_size).all()
    return {"items": [_log_dict(l) for l in logs], "total": total}

@router.get("/{audit_id}")
def get_audit_log(audit_id: int, current_user=Depends(require_permission("audit.view")), db: Session = Depends(get_db)):
    from app.models.audit_log import AuditLog
    l = db.query(AuditLog).filter_by(id=audit_id).first()
    if not l:
        from fastapi import HTTPException
        raise HTTPException(404, "Audit log not found")
    return _log_dict(l)

@router.get("/users/{user_id}")
def get_user_audit(
    user_id: int, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
    current_user=Depends(require_permission("audit.view")), db: Session = Depends(get_db),
):
    from app.models.audit_log import AuditLog
    q = db.query(AuditLog).filter_by(user_id=user_id)
    total = q.count()
    logs = q.order_by(AuditLog.created_at.desc()).offset((page-1)*page_size).limit(page_size).all()
    return {"items": [_log_dict(l) for l in logs], "total": total}

@router.get("/dashboards/{dashboard_id}")
def get_dashboard_audit(
    dashboard_id: int, page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
    current_user=Depends(require_permission("audit.view")), db: Session = Depends(get_db),
):
    from app.models.audit_log import AuditLog
    q = db.query(AuditLog).filter_by(dashboard_id=dashboard_id)
    total = q.count()
    logs = q.order_by(AuditLog.created_at.desc()).offset((page-1)*page_size).limit(page_size).all()
    return {"items": [_log_dict(l) for l in logs], "total": total}
