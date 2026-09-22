"""Audit log ORM model. Every significant action is logged here."""
from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, DateTime, ForeignKey, Text, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

AUDIT_ACTIONS = (
    "LOGIN", "LOGIN_FAILED", "LOGOUT",
    "DASHBOARD_VIEW", "DASHBOARD_CREATE", "DASHBOARD_EDIT",
    "DASHBOARD_PUBLISH", "DASHBOARD_UNPUBLISH", "DASHBOARD_ARCHIVE",
    "DASHBOARD_APPROVE", "DASHBOARD_REJECT", "DASHBOARD_SUBMIT",
    "DATASET_ACCESS", "EXPORT",
    "USER_CREATE", "USER_UPDATE", "USER_DISABLE",
    "ROLE_MODIFY", "PERMISSION_MODIFY",
    "DATASOURCE_CREATE", "DATASOURCE_UPDATE", "DATASOURCE_DELETE",
)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    resource_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    resource_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    dashboard_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("dashboards.id", ondelete="SET NULL"), nullable=True, index=True
    )
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="SUCCESS")  # SUCCESS | FAILURE | DENIED
    details: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    # Relationships
    user = relationship("User", foreign_keys=[user_id], lazy="joined")

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} action={self.action} user_id={self.user_id}>"
