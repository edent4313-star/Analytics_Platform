"""
Authentication Provider Abstraction — Spec 02.

AuthenticatedIdentity is the single object every part of the system
receives after authentication. It is identical regardless of provider.

To add a new provider (e.g., SAML):
  1. Subclass AuthenticationProvider
  2. Implement authenticate()
  3. Register in AuthProviderFactory
  4. Set AUTH_PROVIDER=your_provider in .env
  That is all. Nothing else changes.
"""
from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AuthenticatedIdentity:
    """
    The authoritative identity produced after authentication.
    This object is NEVER constructed from frontend-supplied data.
    It comes exclusively from the authentication provider + application DB.
    """
    # From provider (AD or Mock AD)
    employee_id: str
    username: str
    full_name: str
    email: str
    provider: str                        # "mock" | "cbe_ad"

    # From application DB (resolved by IdentityResolver)
    user_id: int
    role: str                            # e.g. "REGIONAL_MANAGER"
    access_level: str                    # HEAD_OFFICE | REGION | DISTRICT | BRANCH
    permissions: list[str] = field(default_factory=list)
    region_id: Optional[int] = None
    region_name: Optional[str] = None
    district_id: Optional[int] = None
    district_name: Optional[str] = None
    branch_id: Optional[int] = None
    branch_name: Optional[str] = None
    position: Optional[str] = None
    department: Optional[str] = None
    department_scope: list[str] = field(default_factory=lambda: ["ALL"])
    is_active: bool = True
    last_login: Optional[str] = None

    def to_jwt_payload(self) -> dict:
        """Minimal payload for JWT — keep small, sensitive fields stay in DB."""
        return {
            "sub": self.employee_id,
            "user_id": self.user_id,
            "username": self.username,
            "employee_id": self.employee_id,
            "role": self.role,
            "access_level": self.access_level,
            "region_id": self.region_id,
            "district_id": self.district_id,
            "branch_id": self.branch_id,
            "provider": self.provider,
        }


class AuthenticationProvider(ABC):
    """
    Abstract base class for all authentication providers.
    Every provider MUST implement authenticate() and return an AuthenticatedIdentity.
    """

    @abstractmethod
    def authenticate(self, credentials: dict) -> AuthenticatedIdentity:
        """
        Validate credentials and return a fully resolved AuthenticatedIdentity.
        Raises HTTPException 401 on failure.
        credentials: provider-specific dict (e.g. {"employee_id": ..., "password": ...})
        """
        ...

    @abstractmethod
    def get_provider_name(self) -> str:
        """Return provider identifier string: "mock" or "cbe_ad"."""
        ...
