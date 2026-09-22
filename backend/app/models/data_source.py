"""Data source ORM model. Credentials are encrypted at rest."""
from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, String, Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.base import Base

SOURCE_TYPES = ("POSTGRESQL", "ORACLE", "INTERNAL_API")


class DataSource(Base):
    __tablename__ = "data_sources"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)  # POSTGRESQL | ORACLE | INTERNAL_API
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Connection config (non-sensitive)
    host: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    database_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    service_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    schema_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    api_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Sensitive — stored encrypted using Fernet symmetric encryption
    # Format: "encrypted:<base64-fernet-token>"
    username_enc: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    password_enc: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    api_auth_config_enc: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    datasets = relationship("Dataset", back_populates="data_source", lazy="select")

    def __repr__(self) -> str:
        return f"<DataSource id={self.id} name={self.name} type={self.source_type}>"
