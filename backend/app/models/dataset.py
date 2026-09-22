"""Dataset and DatasetField ORM models."""
from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Text, func, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

DATASET_STATUSES = ("DRAFT", "ACTIVE", "INACTIVE")
FIELD_DATA_TYPES = ("TEXT", "NUMERIC", "DATE", "DATETIME", "BOOLEAN", "ID", "CATEGORY")
FIELD_CATEGORIES = ("DIMENSION", "METRIC", "DATE", "IDENTIFIER", "STATUS", "OTHER")


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("data_sources.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    schema_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    object_name: Mapped[str] = mapped_column(String(255), nullable=False)  # table or view name
    # Org-scope column mapping (which column to use for scope filtering)
    region_column: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    district_column: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    branch_column: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    owner_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", nullable=False, index=True)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    data_source = relationship("DataSource", back_populates="datasets", lazy="joined")
    fields = relationship("DatasetField", back_populates="dataset",
                          order_by="DatasetField.sort_order", lazy="select")
    owner = relationship("User", foreign_keys=[owner_id])

    def __repr__(self) -> str:
        return f"<Dataset id={self.id} name={self.name} status={self.status}>"


class DatasetField(Base):
    """Metadata for a field/column in a dataset."""
    __tablename__ = "dataset_fields"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    dataset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    field_name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    data_type: Mapped[str] = mapped_column(String(50), nullable=False, default="TEXT")
    field_category: Mapped[str] = mapped_column(String(50), nullable=False, default="DIMENSION")
    is_filterable: Mapped[bool] = mapped_column(Boolean, default=True)
    is_aggregatable: Mapped[bool] = mapped_column(Boolean, default=False)
    # Comma-separated list: "SUM,AVG,COUNT,COUNT_DISTINCT,MIN,MAX"
    allowed_aggregations: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    dataset = relationship("Dataset", back_populates="fields")

    def __repr__(self) -> str:
        return f"<DatasetField field={self.field_name} dataset_id={self.dataset_id}>"
