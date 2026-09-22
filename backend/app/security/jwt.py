"""
JWT token creation and validation.
Uses python-jose with HS256 algorithm.
Tokens contain minimal payload — sensitive profile data is loaded from DB.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from fastapi import HTTPException, status
from app.config.settings import get_settings

settings = get_settings()

ALGORITHM = settings.jwt_algorithm


def create_access_token(
    user_id: int,
    username: str,
    role: str,
    access_level: str,
    region_id: Optional[int] = None,
    district_id: Optional[int] = None,
    branch_id: Optional[int] = None,
) -> str:
    """
    Create a short-lived access token.
    Payload includes org scope so every request can be quickly scoped
    without a DB lookup — but critical operations re-verify from DB.
    """
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_access_token_expire_minutes
    )
    payload = {
        "sub": str(user_id),
        "username": username,
        "role": role,
        "access_level": access_level,
        "region_id": region_id,
        "district_id": district_id,
        "branch_id": branch_id,
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def create_refresh_token(user_id: int, username: str) -> str:
    """Create a longer-lived refresh token (minimal payload)."""
    expire = datetime.now(timezone.utc) + timedelta(
        hours=settings.jwt_refresh_token_expire_hours
    )
    payload = {
        "sub": str(user_id),
        "username": username,
        "type": "refresh",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT token.
    Raises HTTP 401 if the token is invalid or expired.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
        return payload
    except JWTError:
        raise credentials_exception


def decode_refresh_token(token: str) -> dict:
    """Decode refresh token, additionally validating the token type."""
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    return payload
