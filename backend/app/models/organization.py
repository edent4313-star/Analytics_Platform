"""Organization hierarchy ORM models: Region → District → Branch."""
from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, func, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

STATUS_VALUES = ("ACTIVE", "INACTIVE")


class Region(Base):
    __tablename__ = "regions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    districts = relationship("District", back_populates="region", lazy="select")
    branches = relationship("Branch", back_populates="region", lazy="select")

    def __repr__(self) -> str:
        return f"<Region id={self.id} code={self.code} name={self.name}>"


class District(Base):
    __tablename__ = "districts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    region_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("regions.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    region = relationship("Region", back_populates="districts")
    branches = relationship("Branch", back_populates="district", lazy="select")

    def __repr__(self) -> str:
        return f"<District id={self.id} code={self.code} name={self.name}>"


class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    region_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("regions.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    district_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("districts.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    region = relationship("Region", back_populates="branches", foreign_keys=[region_id])
    district = relationship("District", back_populates="branches", foreign_keys=[district_id])

    def __repr__(self) -> str:
        return f"<Branch id={self.id} code={self.code} name={self.name}>"
