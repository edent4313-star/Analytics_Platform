"""
IdentityResolver — loads the full AuthenticatedIdentity from the application DB.
Called by BOTH MockADProvider and CBEADProvider after they verify credentials.
This is the single source of truth for roles, permissions, and org scope.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.security.auth_provider import AuthenticatedIdentity


def resolve(employee_id: str, db: Session, provider: str = "mock") -> AuthenticatedIdentity:
    """
    Given a verified employee_id, load the complete identity from the app DB.
    Raises 401 if the user does not exist or is inactive.
    """
    from app.models.user import User
    from app.models.role import UserRole, RolePermission
    from app.models.permission import Permission

    # Look up by employee_id first, fall back to username for legacy mock users
    user = (
        db.query(User).filter(User.employee_id == employee_id).first()
        or db.query(User).filter(User.username == employee_id).first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Employee not found in system. Contact your administrator.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is inactive. Contact your administrator.",
        )

    # Role
    role_name = user.primary_role_name or "VIEWER"

    # Permissions — all codes for this user's role(s)
    perm_rows = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .filter(UserRole.user_id == user.id, Permission.is_active == True)
        .distinct()
        .all()
    )
    permissions = [r.code for r in perm_rows]
    if role_name == "SYSTEM_ADMIN":
        all_codes = [r.code for r in db.query(Permission.code).filter(Permission.is_active == True).all()]
        permissions = all_codes

    # Org names
    region_name = user.region.name if user.region else None
    district_name = user.district.name if user.district else None
    branch_name = user.branch.name if user.branch else None

    # Position + department from user_positions / mock_ad_users
    position_title = _get_position(user.id, db)
    department_name = _get_department(user.id, db)
    department_scope = _get_dept_scope(user.id, db)

    # Update last login + employee_id if not set
    if not user.employee_id:
        user.employee_id = employee_id
    user.last_login = datetime.now(timezone.utc)
    try:
        db.commit()
    except Exception:
        db.rollback()

    return AuthenticatedIdentity(
        employee_id=employee_id,
        user_id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        provider=provider,
        role=role_name,
        access_level=user.access_level,
        permissions=permissions,
        region_id=user.region_id,
        region_name=region_name,
        district_id=user.district_id,
        district_name=district_name,
        branch_id=user.branch_id,
        branch_name=branch_name,
        position=position_title,
        department=department_name,
        department_scope=department_scope,
        is_active=user.is_active,
        last_login=str(user.last_login) if user.last_login else None,
    )


def _get_position(user_id: int, db: Session) -> Optional[str]:
    try:
        from sqlalchemy import text
        row = db.execute(
            text("SELECT p.name FROM user_positions up JOIN positions p ON p.id = up.position_id WHERE up.user_id = :uid AND up.is_primary = TRUE LIMIT 1"),
            {"uid": user_id}
        ).first()
        return row[0] if row else None
    except Exception:
        return None


def _get_department(user_id: int, db: Session) -> Optional[str]:
    try:
        from sqlalchemy import text
        # Try mock_ad_users first for dev
        row = db.execute(
            text("SELECT department FROM mock_ad_users WHERE employee_id = (SELECT employee_id FROM users WHERE id = :uid LIMIT 1) LIMIT 1"),
            {"uid": user_id}
        ).first()
        return row[0] if row else None
    except Exception:
        return None


def _get_dept_scope(user_id: int, db: Session) -> list[str]:
    try:
        from sqlalchemy import text
        rows = db.execute(
            text("SELECT d.code FROM user_department_scope uds JOIN departments d ON d.id = uds.department_id WHERE uds.user_id = :uid"),
            {"uid": user_id}
        ).all()
        return [r[0] for r in rows] if rows else ["ALL"]
    except Exception:
        return ["ALL"]
