"""
Factory — returns the correct AuthenticationProvider based on AUTH_PROVIDER in .env.
Change AUTH_PROVIDER=cbe_ad to switch to production without any other code changes.
"""
from functools import lru_cache
from app.security.auth_provider import AuthenticationProvider


def get_auth_provider(settings=None) -> AuthenticationProvider:
    if settings is None:
        from app.config.settings import get_settings
        settings = get_settings()

    provider_name = (settings.auth_provider or "mock").lower()

    if provider_name == "cbe_ad":
        from app.security.cbe_ad_provider import CBEActiveDirectoryProvider
        return CBEActiveDirectoryProvider(settings)

    # Default: mock (development)
    from app.security.mock_ad_provider import MockADAuthenticationProvider
    return MockADAuthenticationProvider()
