"""
Audit logging service.
All significant actions should be logged via this service.
Never log sensitive data (passwords, tokens, credentials).
"""
from typing import Optional, Any
from sqlalchemy.orm import Session


def log_audit_event(
    db: Session,
    action: str,
    user_id: Optional[int] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[str] = None,
    dashboard_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    status: str = "SUCCESS",
    details: Optional[dict] = None,
) -> None:
    """
    Create an audit log entry.
    This function is fire-and-forget — errors are swallowed to avoid
    breaking the main request flow. Use a dedicated logging system in
    high-volume production scenarios.
    """
    try:
        from app.models.audit_log import AuditLog
        log = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id) if resource_id is not None else None,
            dashboard_id=dashboard_id,
            ip_address=ip_address,
            user_agent=user_agent,
            status=status,
            details=details,
        )
        db.add(log)
        db.commit()
    except Exception:
        # Audit failures must not break the main request
        db.rollback()
