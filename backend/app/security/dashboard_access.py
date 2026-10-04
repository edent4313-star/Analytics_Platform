"""Dashboard permission checks (role + explicit user assignment)."""
from typing import Optional
from fastapi import HTTPException
from sqlalchemy.orm import Session

MANAGE_ROLES = ("ADMIN", "SYSTEM_ADMIN")


def _role_ids(user, db: Session) -> list[int]:
    from app.models.role import UserRole
    return [r.role_id for r in db.query(UserRole).filter_by(user_id=user.id).all()]


def user_can_manage_dashboards(user) -> bool:
    return (user.primary_role_name or "") in MANAGE_ROLES


def check_dashboard_access(code: str, user, db: Session, need_export: bool = False, allow_unpublished: bool = False):
    from app.models.dashboard import Dashboard, DashboardPermission, DashboardUserAssignment

    d = db.query(Dashboard).filter_by(code=code, is_active=True).first()
    if not d:
        raise HTTPException(404, f"Dashboard '{code}' not found")

    if user_can_manage_dashboards(user):
        return d

    assignment = (
        db.query(DashboardUserAssignment)
        .filter_by(user_id=user.id, dashboard_id=d.id)
        .first()
    )
    if assignment:
        if need_export and not assignment.can_export:
            raise HTTPException(403, "You do not have permission to export this dashboard")
        if not assignment.can_view:
            raise HTTPException(403, "You do not have permission to access this dashboard")
        return d

    role_ids = _role_ids(user, db)
    if role_ids:
        q = db.query(DashboardPermission).filter(
            DashboardPermission.dashboard_id == d.id,
            DashboardPermission.role_id.in_(role_ids),
        )
        if need_export:
            q = q.filter(DashboardPermission.can_export == True)  # noqa: E712
        else:
            q = q.filter(DashboardPermission.can_view == True)  # noqa: E712
        if q.first():
            return d

    if allow_unpublished and d.owner_id == user.id:
        return d

    raise HTTPException(403, "You do not have permission to access this dashboard")


def accessible_dashboard_ids(user, db: Session, for_export: bool = False) -> Optional[set[int]]:
    """
    Return dashboard ids the user may list, or None if the user may list all
    (system administrators only).
    """
    from app.models.dashboard import DashboardPermission, DashboardUserAssignment

    if user_can_manage_dashboards(user):
        return None

    ids: set[int] = set()
    role_ids = _role_ids(user, db)
    if role_ids:
        q = db.query(DashboardPermission.dashboard_id).filter(
            DashboardPermission.role_id.in_(role_ids),
        )
        if for_export:
            q = q.filter(DashboardPermission.can_export == True)  # noqa: E712
        else:
            q = q.filter(DashboardPermission.can_view == True)  # noqa: E712
        ids.update(r[0] for r in q.all())

    uq = db.query(DashboardUserAssignment.dashboard_id).filter(
        DashboardUserAssignment.user_id == user.id,
        DashboardUserAssignment.can_view == True,  # noqa: E712
    )
    if for_export:
        uq = uq.filter(DashboardUserAssignment.can_export == True)  # noqa: E712
    ids.update(r[0] for r in uq.all())

    if user.primary_role_name in ("DESIGNER", "ANALYST"):
        from app.models.dashboard import Dashboard
        owned = db.query(Dashboard.id).filter(
            Dashboard.owner_id == user.id, Dashboard.is_active == True  # noqa: E712
        ).all()
        ids.update(r[0] for r in owned)

    return ids
