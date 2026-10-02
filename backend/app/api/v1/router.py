"""
Master API router for v1.
All sub-routers are registered here and included in main.py.
"""
from fastapi import APIRouter
from app.api.v1 import (
    auth, users, organization, roles, permissions,
    dashboards, dashboard_data, data_sources, datasets,
    audit, admin, bulk_import,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(organization.router, prefix="", tags=["Organization"])
api_router.include_router(roles.router, prefix="/roles", tags=["Roles"])
api_router.include_router(permissions.router, prefix="/permissions", tags=["Permissions"])
api_router.include_router(dashboards.router, prefix="/dashboards", tags=["Dashboards"])
api_router.include_router(dashboard_data.router, prefix="/dashboard", tags=["Dashboard Data"])
api_router.include_router(data_sources.router, prefix="/data-sources", tags=["Data Sources"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["Datasets"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit"])
api_router.include_router(admin.router, prefix="/admin", tags=["Administration"])
api_router.include_router(bulk_import.router, prefix="/import", tags=["Bulk Import"])
