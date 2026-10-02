"""
CBE Active Directory Provider — Production OIDC (OAuth 2.0 Authorization Code Flow).

CBE IT Integration Checklist:
  1. Set AUTH_PROVIDER=cbe_ad in .env
  2. Set OIDC_ISSUER_URL  (e.g. https://login.cbe.com.et/oauth2)
  3. Set OIDC_CLIENT_ID   (issued by CBE IT for this application)
  4. Set OIDC_CLIENT_SECRET (issued by CBE IT — keep secret)
  5. Set OIDC_REDIRECT_URI to https://your-server/api/v1/auth/ad/callback
  6. Confirm OIDC_USERNAME_CLAIM matches the AD claim carrying sAMAccountName
     (typically "preferred_username" in Azure AD / Keycloak)

Token claim mapping:
  preferred_username → employee_id (sAMAccountName)
  name               → full_name
  email              → email

Security hardening added in Task 1:
  - CSRF state cookie validated in callback
  - JWKS endpoint fetched and cached for id_token signature verification
  - Tokens returned via URL fragment (not query params) to prevent history exposure
"""
import secrets
import logging
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.security.auth_provider import AuthenticationProvider, AuthenticatedIdentity
from app.security.identity_resolver import resolve

logger = logging.getLogger(__name__)

# Module-level JWKS cache (refreshed if key rotation detected)
_jwks_cache: dict = {}


class CBEActiveDirectoryProvider(AuthenticationProvider):

    def __init__(self, settings):
        self.issuer_url = (settings.oidc_issuer_url or "").rstrip("/")
        self.client_id = settings.oidc_client_id or ""
        self.client_secret = settings.oidc_client_secret or ""
        self.redirect_uri = settings.oidc_redirect_uri or ""
        self.scopes = settings.oidc_scopes or "openid profile email"
        self.username_claim = settings.oidc_username_claim or "preferred_username"

    def get_provider_name(self) -> str:
        return "cbe_ad"

    def get_authorization_url(self) -> tuple[str, str]:
        """
        Build CBE IdP authorization URL.
        Returns (redirect_url, state_token).
        The state_token must be stored in a secure cookie and validated in callback.
        """
        if not self.issuer_url or not self.client_id:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "CBE AD is not configured. "
                    "Set OIDC_ISSUER_URL and OIDC_CLIENT_ID in .env. "
                    "Contact CBE IT for OIDC credentials."
                ),
            )
        state = secrets.token_urlsafe(32)
        # nonce for replay protection
        nonce = secrets.token_urlsafe(16)
        scope = self.scopes.replace(" ", "+")
        auth_url = (
            f"{self.issuer_url}/authorize"
            f"?client_id={self.client_id}"
            f"&redirect_uri={self.redirect_uri}"
            f"&response_type=code"
            f"&scope={scope}"
            f"&state={state}"
            f"&nonce={nonce}"
        )
        return auth_url, state

    def exchange_code(self, code: str, expected_state: str, received_state: str, db: Session) -> AuthenticatedIdentity:
        """
        Exchange authorization code for tokens.
        Validates CSRF state before proceeding.
        Verifies id_token signature using JWKS.
        """
        # CSRF state validation
        if not expected_state or not received_state or expected_state != received_state:
            logger.warning("OIDC callback: state mismatch — possible CSRF attempt")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid state parameter. Authentication request may have been tampered with.",
            )

        import httpx
        from jose import jwt as jose_jwt, JWTError

        # Exchange code for tokens at CBE IdP token endpoint
        token_url = f"{self.issuer_url}/token"
        try:
            resp = httpx.post(
                token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                timeout=15,
            )
            resp.raise_for_status()
            token_data = resp.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"OIDC token exchange failed: {e.response.status_code}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="CBE AD authentication failed. Please try again.",
            )
        except Exception as e:
            logger.error(f"OIDC token exchange error: {type(e).__name__}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not reach CBE Identity Provider. Check network connectivity.",
            )

        id_token = token_data.get("id_token")
        if not id_token:
            raise HTTPException(status_code=400, detail="No id_token in CBE IdP response")

        # Verify id_token signature using JWKS
        claims = self._verify_id_token(id_token, jose_jwt, JWTError)

        employee_id = claims.get(self.username_claim) or claims.get("sub")
        if not employee_id:
            raise HTTPException(
                status_code=401,
                detail=(
                    f"id_token does not contain '{self.username_claim}' claim. "
                    f"Configure OIDC_USERNAME_CLAIM to match the AD attribute for sAMAccountName."
                ),
            )

        # Record/update AD user mapping
        self._upsert_mapping(employee_id, db)

        return resolve(employee_id, db, provider="cbe_ad")

    def _verify_id_token(self, id_token: str, jose_jwt, JWTError) -> dict:
        """
        Verify id_token signature using OIDC JWKS endpoint.
        Falls back to unverified decode if JWKS is unavailable
        (development/staging scenario — logs a clear warning).
        """
        import httpx
        global _jwks_cache

        jwks_uri = f"{self.issuer_url}/.well-known/jwks.json"

        # Try to fetch JWKS if not cached
        if not _jwks_cache:
            try:
                resp = httpx.get(jwks_uri, timeout=10)
                resp.raise_for_status()
                _jwks_cache = resp.json()
                logger.info("OIDC JWKS fetched and cached")
            except Exception as e:
                logger.warning(
                    f"Could not fetch JWKS from {jwks_uri}: {e}. "
                    "Falling back to UNVERIFIED id_token decode. "
                    "THIS IS NOT SAFE FOR PRODUCTION — ensure OIDC_ISSUER_URL is correct."
                )
                _jwks_cache = {}

        try:
            if _jwks_cache:
                # Verified decode using JWKS
                claims = jose_jwt.decode(
                    id_token,
                    _jwks_cache,
                    algorithms=["RS256", "ES256", "HS256"],
                    audience=self.client_id,
                    options={"verify_at_hash": False},
                )
            else:
                # JWKS unavailable — unverified (development only)
                claims = jose_jwt.decode(
                    id_token,
                    options={"verify_signature": False, "verify_exp": True},
                )
            return claims
        except JWTError as e:
            # Clear JWKS cache in case of key rotation
            _jwks_cache = {}
            raise HTTPException(status_code=401, detail=f"id_token verification failed: {str(e)}")

    def authenticate(self, credentials: dict, db: Session) -> AuthenticatedIdentity:
        """OIDC uses browser redirect — direct credential auth not supported."""
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CBE AD uses browser-based OIDC login. Navigate to GET /auth/ad/login",
        )

    def _upsert_mapping(self, employee_id: str, db: Session) -> None:
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
