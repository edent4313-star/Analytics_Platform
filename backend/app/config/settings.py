"""
Application settings loaded from environment variables via Pydantic Settings.
Never hard-code secrets. Always use .env file or environment variables.
"""
from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    app_name: str = "Enterprise Analytics Platform"
    app_env: str = "development"  # development | production
    app_version: str = "1.0.0"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # ── Security ─────────────────────────────────────────────────────────────
    jwt_secret_key: str = "CHANGE_ME_IN_PRODUCTION_USE_LONG_RANDOM_STRING"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_hours: int = 8
    # Fernet key for encrypting data source credentials (32-byte base64)
    credential_encryption_key: str = "CHANGE_ME_IN_PRODUCTION_FERNET_KEY"

    # ── PostgreSQL Application Database ──────────────────────────────────────
    database_url: str = "postgresql://analytics_user:analytics_pass@localhost:5432/analytics_platform"
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30

    # ── Oracle (analytical data source — optional) ───────────────────────────
    oracle_host: Optional[str] = None
    oracle_port: int = 1521
    oracle_service: Optional[str] = None
    oracle_username: Optional[str] = None
    oracle_password: Optional[str] = None

    # ── CORS ─────────────────────────────────────────────────────────────────
    # In production this should be your internal server URL only
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    # ── Frontend ─────────────────────────────────────────────────────────────
    frontend_url: str = "http://localhost:5173"

    # ── Rate limiting ─────────────────────────────────────────────────────────
    login_rate_limit_attempts: int = 5
    login_rate_limit_window_seconds: int = 300

    # ── Authentication Provider ───────────────────────────────────────────────
    # "mock" = Mock AD (development/demo)
    # "cbe_ad" = Real CBE AD via OIDC (production)
    auth_provider: str = "mock"

    # ── CBE OIDC (required when auth_provider=cbe_ad) ────────────────────────
    oidc_issuer_url: str = ""
    oidc_client_id: str = ""
    oidc_client_secret: str = ""
    oidc_redirect_uri: str = ""
    oidc_scopes: str = "openid profile email"
    oidc_username_claim: str = "preferred_username"  # AD sAMAccountName claim


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance. Use as FastAPI dependency."""
    return Settings()
