"""
User ORM model.
Stores authentication credentials and organizational assignment.
Passwords are NEVER stored in plain text.
"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Integer, String, Boolean, DateTime, Enum, ForeignKey, Index, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

ACCESS_LEVELS = ("HEAD_OFFICE", "REGION", "DISTRICT", "BRANCH")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    # Organizational assignment
    access_level: Mapped[str] = mapped_column(
        Enum(*ACCESS_LEVELS, name="access_level_enum"),
        nullable=False,
        default="BRANCH",
        index=True,
    )
    region_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("regions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    district_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("districts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    branch_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("branches.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # Account status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Spec 02 — AD identity fields
    employee_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, unique=True, index=True)
    ad_provider: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, default="mock")
    last_ad_sync: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Audit fields
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    created_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    region = relationship("Region", foreign_keys=[region_id], lazy="joined")
    district = relationship("District", foreign_keys=[district_id], lazy="joined")
    branch = relationship("Branch", foreign_keys=[branch_id], lazy="joined")
    user_roles = relationship("UserRole", back_populates="user", lazy="select",
                              foreign_keys="[UserRole.user_id]", primaryjoin="User.id == UserRole.user_id")

    @property
    def primary_role_name(self) -> Optional[str]:
        """Return the name of the user's primary (first) role."""
        if self.user_roles:
            return self.user_roles[0].role.name if self.user_roles[0].role else None
        return None

    def __repr__(self) -> str:
        return f"<User id={self.id} username={self.username} access_level={self.access_level}>"
