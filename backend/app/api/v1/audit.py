"""Audit logs API — full implementation in Phase 12."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.database.session import get_db
from app.security.dependencies import require_permission

router = APIRouter()


@router.get("")
def list_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    user_id: Optional[int] = None,
    action: Optional[str] = None,
    current_user=Depends(require_permission("audit.view")),
    db: Session = Depends(get_db),
):
    from app.models.audit_log import AuditLog
    query = db.query(AuditLog)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action:
        query = query.filter(AuditLog.action == action)
    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {
        "items": [
            {
                "id": l.id,
                "user_id": l.user_id,
                "action": l.action,
                "resource_type": l.resource_type,
                "resource_id": l.resource_id,
                "status": l.status,
                "ip_address": l.ip_address,
                "created_at": l.created_at,
            }
            for l in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
