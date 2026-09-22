"""
Query Engine — executes widget data queries against registered datasets.
Enforces organizational data scope on every query.
No raw SQL is exposed to users — queries are built from validated widget config.
"""
from __future__ import annotations
from typing import Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database.data_access import DataScope, QueryDefinition, FieldRef, QueryResult, get_connector
from app.security.data_scope import get_data_scope


def _decrypt_credentials(source) -> dict:
    """Decrypt data source credentials. Returns plain dict for connector factory."""
    from app.config.settings import get_settings
    from cryptography.fernet import Fernet, InvalidToken
    settings = get_settings()
    key = settings.credential_encryption_key.encode()
    try:
        f = Fernet(key)
    except Exception:
        return {}

    def _decrypt(val: Optional[str]) -> Optional[str]:
        if not val or not val.startswith("encrypted:"):
            return val
        try:
            return f.decrypt(val[len("encrypted:"):].encode()).decode()
        except InvalidToken:
            return None

    return {
        "host": source.host,
        "port": source.port,
        "database": source.database_name,
        "service_name": source.service_name,
        "schema": source.schema_name,
        "username": _decrypt(source.username_enc),
        "password": _decrypt(source.password_enc),
        "api_url": source.api_url,
        "auth_config": {},
    }


def execute_widget_query(
    widget_config: dict,
    dataset_id: int,
    scope: DataScope,
    user_filters: dict,
    page: int,
    page_size: int,
    db: Session,
) -> QueryResult:
    """
    Build and execute a query for a dashboard widget.
    widget_config: the config_json from dashboard_widgets row.
    scope: DataScope built from authenticated user — NEVER from request params.
    """
    from app.models.dataset import Dataset, DatasetField
    from app.models.data_source import DataSource

    dataset = db.query(Dataset).filter_by(id=dataset_id, status="ACTIVE").first()
    if not dataset:
        raise ValueError(f"Dataset {dataset_id} not found or inactive")

    source = db.query(DataSource).filter_by(id=dataset.source_id, is_active=True).first()
    if not source:
        raise ValueError("Data source not found or inactive")

    # Validate requested fields exist in the dataset
    valid_fields = {f.field_name for f in db.query(DatasetField).filter_by(dataset_id=dataset_id).all()}

    # Build dimensions and metrics from widget config
    dimensions: list[FieldRef] = []
    metrics: list[FieldRef] = []

    widget_type = widget_config.get("widget_type", "")

    if widget_type == "KPI" or "field" in widget_config:
        field = widget_config.get("field")
        agg = widget_config.get("aggregation", "COUNT")
        if field and field in valid_fields:
            metrics.append(FieldRef(field_name=field, aggregation=agg))

    elif "dimension" in widget_config or "metric" in widget_config:
        dim = widget_config.get("dimension")
        metric = widget_config.get("metric")
        agg = widget_config.get("aggregation", "COUNT")
        if dim and dim in valid_fields:
            dimensions.append(FieldRef(field_name=dim))
        if metric and metric in valid_fields:
            metrics.append(FieldRef(field_name=metric, aggregation=agg))

    elif "columns" in widget_config:
        # Table widget — treat each column as a dimension
        for col in widget_config.get("columns", []):
            field_name = col.get("field") if isinstance(col, dict) else col
            if field_name and field_name in valid_fields:
                dimensions.append(FieldRef(field_name=field_name))

    # User filters (already validated — cannot widen org scope)
    filters = []
    for key, val in user_filters.items():
        if key in valid_fields and val is not None:
            filters.append({"field": key, "operator": "eq", "value": val})

    # Date range
    date_field = widget_config.get("date_field") or dataset.object_name
    if user_filters.get("date_from") and widget_config.get("date_column"):
        filters.append({"field": widget_config["date_column"], "operator": "gte", "value": user_filters["date_from"]})
    if user_filters.get("date_to") and widget_config.get("date_column"):
        filters.append({"field": widget_config["date_column"], "operator": "lte", "value": user_filters["date_to"]})

    qd = QueryDefinition(
        dataset_id=dataset_id,
        source_type=source.source_type,
        connection_config=_decrypt_credentials(source),
        schema_name=dataset.schema_name,
        object_name=dataset.object_name,
        dimensions=dimensions,
        metrics=metrics,
        filters=filters,
        sort_by=widget_config.get("sort_by"),
        sort_order=widget_config.get("sort_order", "DESC"),
        limit=widget_config.get("top_n"),
        region_column=dataset.region_column,
        district_column=dataset.district_column,
        branch_column=dataset.branch_column,
    )

    connector = get_connector(source.source_type, qd.connection_config)
    return connector.execute_query(qd, scope, page=page, page_size=page_size)
