"""
Dashboard ORM models.
Implements the configuration-driven dashboard architecture.
No dashboard layout is hard-coded in React — everything is stored here.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Integer, String, Boolean, DateTime, ForeignKey, Text, func, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

VERSION_STATUSES = ("DRAFT", "PREVIEW", "SUBMITTED", "APPROVED", "PUBLISHED", "ARCHIVED")


class Dashboard(Base):
    __tablename__ = "dashboards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    owner_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    versions = relationship("DashboardVersion", back_populates="dashboard", lazy="select",
                            order_by="DashboardVersion.version_number.desc()")
    permissions = relationship("DashboardPermission", back_populates="dashboard", lazy="select")
    owner = relationship("User", foreign_keys=[owner_id])
    creator = relationship("User", foreign_keys=[created_by])

    @property
    def published_version(self) -> Optional["DashboardVersion"]:
        return next((v for v in self.versions if v.status == "PUBLISHED"), None)

    def __repr__(self) -> str:
        return f"<Dashboard id={self.id} code={self.code}>"


class DashboardVersion(Base):
    __tablename__ = "dashboard_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dashboard_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", nullable=False, index=True)
    # layout_config stores the grid layout (positions, sizes) as JSON
    layout_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Approval workflow fields
    submitted_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    approved_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    dashboard = relationship("Dashboard", back_populates="versions")
    widgets = relationship("DashboardWidget", back_populates="version",
                           order_by="DashboardWidget.sort_order", lazy="select")
    filters = relationship("DashboardFilter", back_populates="version",
                           order_by="DashboardFilter.sort_order", lazy="select")

    def __repr__(self) -> str:
        return f"<DashboardVersion dashboard_id={self.dashboard_id} v={self.version_number} status={self.status}>"


class DashboardWidget(Base):
    """
    A widget within a dashboard version.
    config_json stores all widget-specific settings (dataset, fields, aggregation,
    chart type, formatting, etc.). This is the core of the configuration-driven approach.
    """
    __tablename__ = "dashboard_widgets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    version_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("dashboard_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    widget_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # widget_type values: KPI | LINE_CHART | BAR_CHART | H_BAR_CHART | PIE_CHART |
    #                     DONUT_CHART | AREA_CHART | SCATTER_CHART | TABLE | TEXT |
    #                     IMAGE | FILTER | DATE_FILTER | DIVIDER
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    # Grid position (react-grid-layout compatible)
    position_x: Mapped[int] = mapped_column(Integer, default=0)
    position_y: Mapped[int] = mapped_column(Integer, default=0)
    width: Mapped[int] = mapped_column(Integer, default=4)   # grid units (1-12)
    height: Mapped[int] = mapped_column(Integer, default=3)  # grid units
    # All configuration: dataset_id, fields, aggregation, chart config, formatting
    config_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    dataset_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("datasets.id", ondelete="SET NULL"), nullable=True, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    version = relationship("DashboardVersion", back_populates="widgets")
    dataset = relationship("Dataset", lazy="joined")

    def __repr__(self) -> str:
        return f"<DashboardWidget id={self.id} type={self.widget_type} version_id={self.version_id}>"


class DashboardFilter(Base):
    """A filter defined for a dashboard version (global or widget-specific)."""
    __tablename__ = "dashboard_filters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    version_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("dashboard_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filter_type: Mapped[str] = mapped_column(String(50), nullable=False)
    # filter_type: REGION | DISTRICT | BRANCH | DATE_RANGE | CATEGORY | NUMERIC_RANGE | STATUS | CUSTOM
    field_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_global: Mapped[bool] = mapped_column(Boolean, default=True)
    default_value: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    config_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    version = relationship("DashboardVersion", back_populates="filters")


class DashboardPermission(Base):
    """Maps dashboard access rights to roles."""
    __tablename__ = "dashboard_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dashboard_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("dashboards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    can_view: Mapped[bool] = mapped_column(Boolean, default=True)
    can_export: Mapped[bool] = mapped_column(Boolean, default=False)
    granted_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    dashboard = relationship("Dashboard", back_populates="permissions")
    role = relationship("Role")
