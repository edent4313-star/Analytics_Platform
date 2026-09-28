"""
Mock AD Authentication Provider — Development only.
Simulates CBE Active Directory login using seeded demo users.
Activated when AUTH_PROVIDER=mock in .env (the default).

NEVER use this in production. It does not connect to real CBE AD.
"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.security.auth_provider import AuthenticationProvider, AuthenticatedIdentity
from app.security.password import verify_password
from app.security.identity_resolver import resolve


class MockADAuthenticationProvider(AuthenticationProvider):
    """
    Authenticates against the mock_ad_users table.
    After password verification, calls IdentityResolver to load
    the full identity (roles, permissions, org scope) from the app DB.
    """

    def get_provider_name(self) -> str:
        return "mock"

    def authenticate(self, credentials: dict, db: Session) -> AuthenticatedIdentity:
        employee_id = credentials.get("employee_id", "").strip()
        password = credentials.get("password", "")

        if not employee_id or not password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Employee ID and password are required",
            )

        # Look up in mock_ad_users table
        mock_user = self._find_mock_user(employee_id, db)

        if not mock_user:
            # Constant-time-ish response to prevent user enumeration
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Employee ID or password",
            )

        if not mock_user["is_active"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account is inactive. Contact your administrator.",
            )

        if not verify_password(password, mock_user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid Employee ID or password",
            )

        # Credentials valid — resolve full identity from app DB
        return resolve(employee_id, db, provider="mock")

    def _find_mock_user(self, employee_id: str, db: Session) -> dict | None:
        from sqlalchemy import text
        try:
            row = db.execute(
                text("SELECT employee_id, password_hash, is_active FROM mock_ad_users WHERE employee_id = :eid LIMIT 1"),
                {"eid": employee_id},
            ).first()
            return dict(row._mapping) if row else None
        except Exception:
            return None
