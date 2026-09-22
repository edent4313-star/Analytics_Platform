"""
FastAPI security dependencies.

get_current_user    — validate JWT, return User ORM object
require_permission  — factory that adds permission check on top
"""
from typing import Callable
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.security.jwt import decode_token

bearer_scheme = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """Validate JWT and return the full User ORM object. Raises 401 if invalid."""
    from app.models.user import User

    payload = decode_token(credentials.credentials)
    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account is inactive")
    return user


def require_permission(permission_code: str) -> Callable:
    """
    Dependency factory: require a specific permission code.
    ADMIN role bypasses all permission checks.

    Usage:
        current_user = Depends(require_permission("dashboard.publish"))
    """
    def _check(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        from app.models.role import UserRole, RolePermission
        from app.models.permission import Permission

        # ADMIN bypasses all checks
        if current_user.primary_role_name == "ADMIN":
            return current_user

        # Check via: user → user_roles → role_permissions → permissions
        result = (
            db.query(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(UserRole, UserRole.role_id == RolePermission.role_id)
            .filter(
                UserRole.user_id == current_user.id,
                Permission.code == permission_code,
                Permission.is_active == True,
            )
            .first()
        )
        if not result:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied: '{permission_code}' required",
            )
        return current_user

    return _check


def get_user_permissions(user_id: int, db: Session) -> list[str]:
    """Return list of all permission codes for a user (used for frontend context)."""
    from app.models.role import UserRole, RolePermission
    from app.models.permission import Permission

    rows = (
        db.query(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .join(UserRole, UserRole.role_id == RolePermission.role_id)
        .filter(UserRole.user_id == user_id, Permission.is_active == True)
        .distinct()
        .all()
    )
    return [r.code for r in rows]
