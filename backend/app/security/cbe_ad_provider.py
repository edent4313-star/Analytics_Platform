"""
CBE Active Directory Provider — Production OIDC stub.
Implements OAuth 2.0 / OIDC Authorization Code Flow.

CBE IT integration checklist:
  1. Set AUTH_PROVIDER=cbe_ad in .env
  2. Set OIDC_ISSUER_URL to your CBE IdP (Azure AD / Keycloak / etc.)
  3. Set OIDC_CLIENT_ID and OIDC_CLIENT_SECRET from CBE IT
  4. Set OIDC_REDIRECT_URI to https://your-server/api/v1/auth/ad/callback
  5. Ensure the OIDC token includes 'preferred_username' = employee sAMAccountName

The attribute mapping assumes:
  id_token claim 'preferred_username' → employee_id (sAMAccountName)
  id_token claim 'name'              → full_name
  id_token claim 'email'             → email

If CBE AD uses different claim names, update OIDC_USERNAME_CLAIM in .env.
"""
import secrets
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.security.auth_provider import AuthenticationProvider, AuthenticatedIdentity
from app.security.identity_resolver import resolve


class CBEActiveDirectoryProvider(AuthenticationProvider):
    """
    Production OIDC provider for CBE AD.
    This provider does NOT handle username/password directly —
    that is done by the CBE IdP. This provider:
      1. Builds the authorization URL (redirect to CBE IdP)
      2. Exchanges the authorization code for tokens
      3. Verifies the id_token
      4. Extracts employee_id and calls IdentityResolver
    """

    def __init__(self, settings):
        self.issuer_url = settings.oidc_issuer_url or ""
        self.client_id = settings.oidc_client_id or ""
        self.client_secret = settings.oidc_client_secret or ""
        self.redirect_uri = settings.oidc_redirect_uri or ""
        self.scopes = settings.oidc_scopes or "openid profile email"
        self.username_claim = settings.oidc_username_claim or "preferred_username"

    def get_provider_name(self) -> str:
        return "cbe_ad"

    def get_authorization_url(self) -> tuple[str, str]:
        """
        Build the CBE IdP authorization URL.
        Returns (url, state) — state is stored in session for CSRF protection.
        """
        if not self.issuer_url or not self.client_id:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="CBE AD is not configured. Set OIDC_ISSUER_URL and OIDC_CLIENT_ID in .env",
            )
        state = secrets.token_urlsafe(32)
        auth_url = (
            f"{self.issuer_url}/authorize"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&response_type=code"
            f"&scope={self.scopes.replace(' ', '+')}"
            f"&state={state}"
        )
        return auth_url, state

    def exchange_code(self, code: str, db: Session) -> AuthenticatedIdentity:
        """
        Exchange authorization code for tokens, verify id_token, resolve identity.
        Called by the /auth/ad/callback endpoint.
        """
        import httpx
        from jose import jwt as jose_jwt, JWTError

        # Exchange code for tokens
        token_url = f"{self.issuer_url}/token"
        try:
            resp = httpx.post(token_url, data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.redirect_uri,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            }, timeout=10)
            resp.raise_for_status()
            token_data = resp.json()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to exchange code with CBE IdP: {str(e)}",
            )

        id_token = token_data.get("id_token")
        if not id_token:
            raise HTTPException(status_code=400, detail="No id_token in CBE IdP response")

        # Verify and decode id_token
        # For production: fetch JWKS from {issuer_url}/.well-known/jwks.json
        # For now decode without verification (stub — CBE IT must provide JWKS)
        try:
            claims = jose_jwt.decode(
                id_token,
                options={"verify_signature": False},  # STUB: replace with JWKS verification
            )
        except JWTError as e:
            raise HTTPException(status_code=401, detail=f"Invalid id_token: {str(e)}")

        employee_id = claims.get(self.username_claim) or claims.get("sub")
        if not employee_id:
            raise HTTPException(
                status_code=401,
                detail=f"id_token missing '{self.username_claim}' claim. Check OIDC_USERNAME_CLAIM.",
            )

        # Auto-create ad_user_mapping if first login
        self._upsert_mapping(employee_id, db)

        return resolve(employee_id, db, provider="cbe_ad")

    def authenticate(self, credentials: dict, db: Session) -> AuthenticatedIdentity:
        """Not used for OIDC — authentication is browser-based via get_authorization_url()."""
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CBE AD uses browser-based OIDC login. Use GET /auth/ad/login",
        )

    def _upsert_mapping(self, employee_id: str, db: Session):
        from sqlalchemy import text
        from datetime import datetime, timezone
        try:
            db.execute(text("""
                INSERT INTO ad_user_mapping (employee_id, provider, last_seen_at)
                VALUES (:eid, 'cbe_ad', :now)
                ON CONFLICT (employee_id) DO UPDATE SET last_seen_at = :now
            """), {"eid": employee_id, "now": datetime.now(timezone.utc)})
            db.commit()
        except Exception:
            db.rollback()
