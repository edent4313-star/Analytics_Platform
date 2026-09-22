"""
Import all models so Alembic autogenerate can discover them.
Every model must be imported here.
"""
from app.models.user import User
from app.models.role import Role, UserRole, RolePermission
from app.models.permission import Permission
from app.models.organization import Region, District, Branch
from app.models.dashboard import Dashboard, DashboardVersion, DashboardWidget, DashboardFilter, DashboardPermission
from app.models.data_source import DataSource
from app.models.dataset import Dataset, DatasetField
from app.models.audit_log import AuditLog

__all__ = [
    "User", "Role", "UserRole", "RolePermission", "Permission",
    "Region", "District", "Branch",
    "Dashboard", "DashboardVersion", "DashboardWidget", "DashboardFilter", "DashboardPermission",
    "DataSource", "Dataset", "DatasetField",
    "AuditLog",
]
