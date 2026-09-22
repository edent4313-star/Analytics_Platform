"""
Enterprise Analytics Platform — FastAPI Application Entry Point

Architecture:
  Browser → Nginx → FastAPI (this file) → Services → PostgreSQL / Oracle / API

All routes are versioned under /api/v1.
Authentication is JWT Bearer token.
Every data endpoint enforces organizational scope from the authenticated user.
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from app.config.settings import get_settings
from app.middleware.cors_middleware import add_cors_middleware
from app.database.session import verify_db_connection
from app.api.v1.router import api_router

settings = get_settings()

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Application lifecycle ─────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    logger.info(f"Starting {settings.app_name} v{settings.app_version} [{settings.app_env}]")

    if verify_db_connection():
        logger.info("Database connection verified")
    else:
        logger.warning(
            "Database connection FAILED on startup. "
            "Check DATABASE_URL in .env and ensure PostgreSQL is running."
        )

    yield

    # Shutdown
    logger.info("Application shutting down")


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="Enterprise Analytics Dashboard Platform — Internal API",
    docs_url="/api/docs" if settings.app_env != "production" else None,
    redoc_url="/api/redoc" if settings.app_env != "production" else None,
    openapi_url="/api/openapi.json" if settings.app_env != "production" else None,
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────────────────
add_cors_middleware(app)

# ── Global exception handlers ─────────────────────────────────────────────────
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"success": False, "message": "Resource not found"},
    )


@app.exception_handler(500)
async def server_error_handler(request: Request, exc):
    logger.exception(f"Unhandled exception on {request.method} {request.url}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "message": "An internal server error occurred"},
    )


# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint for load balancer / monitoring."""
    db_ok = verify_db_connection()
    return {
        "status": "healthy" if db_ok else "degraded",
        "version": settings.app_version,
        "environment": settings.app_env,
        "database": "connected" if db_ok else "unavailable",
    }


@app.get("/", include_in_schema=False)
def root():
    return {"message": f"{settings.app_name} API is running. See /api/docs for documentation."}
