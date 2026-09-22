"""
Password hashing using bcrypt via passlib.
bcrypt is industry-standard for password storage.
Never store plain-text passwords.
"""
from passlib.context import CryptContext

# bcrypt with cost factor 12 (good balance of security/performance)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password. Returns the bcrypt hash string."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain-text password against a stored hash.
    Returns True if they match, False otherwise.
    Timing-safe comparison is handled internally by passlib.
    """
    return pwd_context.verify(plain_password, hashed_password)
