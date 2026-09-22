"""CORS middleware configuration for FastAPI."""
from fastapi.middleware.cors import CORSMiddleware
from app.config.settings import get_settings

settings = get_settings()


def add_cors_middleware(app) -> None:
    """
    Add CORS middleware to the FastAPI app.
    In production, cors_origins should be your internal server URL only.
    Never use wildcard (*) in production.
    """
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Accept", "X-Request-ID"],
        expose_headers=["X-Total-Count", "X-Page", "X-Page-Size"],
    )
