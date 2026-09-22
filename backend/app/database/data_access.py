"""
Data Access Layer abstraction.
Provides a unified interface over PostgreSQL, Oracle, and Internal REST API
data sources. All analytical query execution goes through here.

This keeps the connector logic isolated — adding Oracle or a new API source
requires only a new connector class, not changes to the query engine.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from typing import Any, Optional
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


# ── Query abstraction ─────────────────────────────────────────────────────────

@dataclass
class FieldRef:
    """Reference to a field within a dataset."""
    field_name: str
    display_name: str = ""
    aggregation: Optional[str] = None  # SUM, COUNT, AVG, MIN, MAX, COUNT_DISTINCT


@dataclass
class DataScope:
    """
    Represents the organizational data scope for a user.
    Built by security/data_scope.py from the authenticated user's profile.
    NEVER constructed from user-supplied request parameters.
    """
    access_level: str  # HEAD_OFFICE | REGION | DISTRICT | BRANCH
    region_ids: Optional[list[int]] = None      # None = unrestricted
    district_ids: Optional[list[int]] = None    # None = unrestricted
    branch_ids: Optional[list[int]] = None      # None = unrestricted

    @property
    def is_unrestricted(self) -> bool:
        return self.access_level == "HEAD_OFFICE"


@dataclass
class QueryDefinition:
    """
    Defines what data a widget needs. Built by the query engine from
    the widget's config_json. All field references are validated against
    dataset_fields before execution.
    """
    dataset_id: int
    source_type: str                  # POSTGRESQL | ORACLE | INTERNAL_API
    connection_config: dict           # decrypted at query-engine level
    schema_name: Optional[str]
    object_name: str                  # table or view name
    dimensions: list[FieldRef] = field(default_factory=list)
    metrics: list[FieldRef] = field(default_factory=list)
    filters: list[dict] = field(default_factory=list)
    sort_by: Optional[str] = None
    sort_order: str = "DESC"
    limit: Optional[int] = None
    offset: int = 0
    # Org-scope column names in the target table
    region_column: Optional[str] = None
    district_column: Optional[str] = None
    branch_column: Optional[str] = None


@dataclass
class QueryResult:
    columns: list[str]
    rows: list[dict]
    total_count: int
    page: int = 1
    page_size: int = 25


# ── Connector interface ───────────────────────────────────────────────────────

class BaseConnector(ABC):
    """Abstract base for all data source connectors."""

    @abstractmethod
    def test_connection(self) -> bool:
        """Verify connectivity to the data source."""

    @abstractmethod
    def get_schema_objects(self, schema: str) -> list[str]:
        """Return list of tables/views available in the schema."""

    @abstractmethod
    def get_field_metadata(self, schema: str, object_name: str) -> list[dict]:
        """Return column metadata for a table/view."""

    @abstractmethod
    def execute_query(
        self,
        query_def: QueryDefinition,
        scope: DataScope,
        page: int = 1,
        page_size: int = 25,
    ) -> QueryResult:
        """Execute a query, applying organizational scope filters."""


# ── PostgreSQL connector ──────────────────────────────────────────────────────

class PostgreSQLConnector(BaseConnector):
    """
    Connects to an external analytical PostgreSQL database/schema.
    (Not the application DB — that uses SQLAlchemy ORM directly.)
    """

    def __init__(self, host: str, port: int, database: str,
                 username: str, password: str, schema: str = "public"):
        self.host = host
        self.port = port
        self.database = database
        self.username = username
        self.password = password
        self.schema = schema
        self._engine = None

    def _get_engine(self):
        if self._engine is None:
            from sqlalchemy import create_engine
            url = (
                f"postgresql://{self.username}:{self.password}"
                f"@{self.host}:{self.port}/{self.database}"
            )
            self._engine = create_engine(url, pool_pre_ping=True, pool_size=2)
        return self._engine

    def test_connection(self) -> bool:
        try:
            from sqlalchemy import text
            with self._get_engine().connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            logger.error(f"PostgreSQL connection test failed: {e}")
            return False

    def get_schema_objects(self, schema: str) -> list[str]:
        from sqlalchemy import text, inspect
        try:
            insp = inspect(self._get_engine())
            return insp.get_table_names(schema=schema) + insp.get_view_names(schema=schema)
        except Exception as e:
            logger.error(f"Failed to get schema objects: {e}")
            return []

    def get_field_metadata(self, schema: str, object_name: str) -> list[dict]:
        from sqlalchemy import text, inspect
        try:
            insp = inspect(self._get_engine())
            columns = insp.get_columns(object_name, schema=schema)
            return [
                {
                    "field_name": col["name"],
                    "data_type": str(col["type"]),
                    "nullable": col.get("nullable", True),
                }
                for col in columns
            ]
        except Exception as e:
            logger.error(f"Failed to get field metadata: {e}")
            return []

    def execute_query(
        self,
        query_def: QueryDefinition,
        scope: DataScope,
        page: int = 1,
        page_size: int = 25,
    ) -> QueryResult:
        from sqlalchemy import text
        sql, params = self._build_sql(query_def, scope, page, page_size)
        count_sql, count_params = self._build_count_sql(query_def, scope)
        try:
            with self._get_engine().connect() as conn:
                total = conn.execute(text(count_sql), count_params).scalar() or 0
                result = conn.execute(text(sql), params)
                rows = [dict(row._mapping) for row in result]
            return QueryResult(
                columns=list(rows[0].keys()) if rows else [],
                rows=rows,
                total_count=total,
                page=page,
                page_size=page_size,
            )
        except Exception as e:
            logger.error(f"Query execution failed: {e}")
            raise

    def _build_sql(
        self,
        qd: QueryDefinition,
        scope: DataScope,
        page: int,
        page_size: int,
    ) -> tuple[str, dict]:
        """
        Build a parameterized SELECT statement from QueryDefinition.
        Scope filters are injected as WHERE conditions — never trusted from
        user-supplied parameters.
        """
        table = f"{qd.schema_name}.{qd.object_name}" if qd.schema_name else qd.object_name
        select_parts = []
        params: dict = {}

        # Dimensions
        for dim in qd.dimensions:
            select_parts.append(f'"{dim.field_name}"')

        # Metrics with aggregation
        for i, metric in enumerate(qd.metrics):
            agg = metric.aggregation or "SUM"
            if agg == "COUNT_DISTINCT":
                select_parts.append(f'COUNT(DISTINCT "{metric.field_name}") AS "{metric.field_name}"')
            else:
                select_parts.append(f'{agg}("{metric.field_name}") AS "{metric.field_name}"')

        if not select_parts:
            select_parts = ["*"]

        select_clause = ", ".join(select_parts)
        where_clauses = []

        # ── Organizational scope (CRITICAL — injected from authenticated user) ──
        if not scope.is_unrestricted:
            if scope.branch_ids and qd.branch_column:
                placeholders = ", ".join(f":branch_id_{i}" for i, _ in enumerate(scope.branch_ids))
                where_clauses.append(f'"{qd.branch_column}" IN ({placeholders})')
                for i, bid in enumerate(scope.branch_ids):
                    params[f"branch_id_{i}"] = bid
            elif scope.district_ids and qd.district_column:
                placeholders = ", ".join(f":district_id_{i}" for i, _ in enumerate(scope.district_ids))
                where_clauses.append(f'"{qd.district_column}" IN ({placeholders})')
                for i, did in enumerate(scope.district_ids):
                    params[f"district_id_{i}"] = did
            elif scope.region_ids and qd.region_column:
                placeholders = ", ".join(f":region_id_{i}" for i, _ in enumerate(scope.region_ids))
                where_clauses.append(f'"{qd.region_column}" IN ({placeholders})')
                for i, rid in enumerate(scope.region_ids):
                    params[f"region_id_{i}"] = rid

        # User-applied filters (already validated against dataset fields)
        for j, f in enumerate(qd.filters):
            col = f.get("field")
            op = f.get("operator", "eq")
            val = f.get("value")
            if col and val is not None:
                key = f"filter_{j}"
                if op == "eq":
                    where_clauses.append(f'"{col}" = :{key}')
                elif op == "gte":
                    where_clauses.append(f'"{col}" >= :{key}')
                elif op == "lte":
                    where_clauses.append(f'"{col}" <= :{key}')
                elif op == "like":
                    where_clauses.append(f'"{col}" ILIKE :{key}')
                    val = f"%{val}%"
                elif op == "in":
                    keys = [f"{key}_{k}" for k in range(len(val))]
                    where_clauses.append(f'"{col}" IN ({", ".join(":" + k for k in keys)})')
                    for k, v in zip(keys, val):
                        params[k] = v
                    continue
                params[key] = val

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        group_by = ""
        if qd.dimensions and qd.metrics:
            dims = ", ".join(f'"{d.field_name}"' for d in qd.dimensions)
            group_by = f"GROUP BY {dims}"

        order_by = ""
        if qd.sort_by:
            direction = "DESC" if qd.sort_order.upper() == "DESC" else "ASC"
            order_by = f'ORDER BY "{qd.sort_by}" {direction}'

        offset = (page - 1) * page_size
        sql = (
            f"SELECT {select_clause} FROM {table} "
            f"{where_sql} {group_by} {order_by} "
            f"LIMIT :limit OFFSET :offset"
        )
        params["limit"] = page_size
        params["offset"] = offset
        return sql.strip(), params

    def _build_count_sql(self, qd: QueryDefinition, scope: DataScope) -> tuple[str, dict]:
        table = f"{qd.schema_name}.{qd.object_name}" if qd.schema_name else qd.object_name
        # Build a simplified count query reusing the same where logic
        # For now wrap in subquery approach
        inner_sql, params = self._build_sql(qd, scope, page=1, page_size=1_000_000)
        # Remove LIMIT/OFFSET for counting
        base = inner_sql.rsplit("LIMIT", 1)[0].strip()
        count_sql = f"SELECT COUNT(*) FROM ({base}) AS _count_subquery"
        # Remove limit/offset from params
        params.pop("limit", None)
        params.pop("offset", None)
        return count_sql, params


# ── Oracle connector ──────────────────────────────────────────────────────────

class OracleConnector(BaseConnector):
    """
    Connects to an Oracle analytical database using python-oracledb thin mode.
    Thin mode requires no Oracle Instant Client installation.
    oracledb v26.0.0 is already installed in this environment.
    """

    def __init__(self, host: str, port: int, service_name: str,
                 username: str, password: str):
        self.host = host
        self.port = port
        self.service_name = service_name
        self.username = username
        self.password = password

    def _get_connection(self):
        import oracledb
        return oracledb.connect(
            user=self.username,
            password=self.password,
            dsn=f"{self.host}:{self.port}/{self.service_name}",
        )

    def test_connection(self) -> bool:
        try:
            conn = self._get_connection()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Oracle connection test failed: {e}")
            return False

    def get_schema_objects(self, schema: str) -> list[str]:
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT object_name FROM all_objects "
                    "WHERE owner = :schema AND object_type IN ('TABLE','VIEW')",
                    schema=schema.upper(),
                )
                return [row[0] for row in cursor.fetchall()]
        except Exception as e:
            logger.error(f"Oracle get_schema_objects failed: {e}")
            return []

    def get_field_metadata(self, schema: str, object_name: str) -> list[dict]:
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    "SELECT column_name, data_type, nullable "
                    "FROM all_tab_columns "
                    "WHERE owner = :schema AND table_name = :obj "
                    "ORDER BY column_id",
                    schema=schema.upper(),
                    obj=object_name.upper(),
                )
                return [
                    {"field_name": r[0], "data_type": r[1], "nullable": r[2] == "Y"}
                    for r in cursor.fetchall()
                ]
        except Exception as e:
            logger.error(f"Oracle get_field_metadata failed: {e}")
            return []

    def execute_query(
        self,
        query_def: QueryDefinition,
        scope: DataScope,
        page: int = 1,
        page_size: int = 25,
    ) -> QueryResult:
        """
        Oracle uses bind variables with :name syntax — same as SQLAlchemy text().
        Pagination uses OFFSET/FETCH (Oracle 12c+).
        """
        sql, params = self._build_oracle_sql(query_def, scope, page, page_size)
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                # Count query
                base_sql, base_params = self._build_oracle_sql(
                    query_def, scope, page=1, page_size=1_000_000
                )
                count_sql = f"SELECT COUNT(*) FROM ({base_sql.rsplit('OFFSET', 1)[0]}) t"
                cursor.execute(count_sql, base_params)
                total = cursor.fetchone()[0]

                cursor.execute(sql, params)
                columns = [col[0].lower() for col in cursor.description]
                rows = [dict(zip(columns, row)) for row in cursor.fetchall()]

            return QueryResult(
                columns=columns,
                rows=rows,
                total_count=total,
                page=page,
                page_size=page_size,
            )
        except Exception as e:
            logger.error(f"Oracle query execution failed: {e}")
            raise

    def _build_oracle_sql(
        self,
        qd: QueryDefinition,
        scope: DataScope,
        page: int,
        page_size: int,
    ) -> tuple[str, dict]:
        table = f'"{qd.schema_name}"."{qd.object_name}"' if qd.schema_name else f'"{qd.object_name}"'
        select_parts = []
        params: dict = {}

        for dim in qd.dimensions:
            select_parts.append(f'"{dim.field_name}"')
        for metric in qd.metrics:
            agg = metric.aggregation or "SUM"
            if agg == "COUNT_DISTINCT":
                select_parts.append(f'COUNT(DISTINCT "{metric.field_name}") "{metric.field_name}"')
            else:
                select_parts.append(f'{agg}("{metric.field_name}") "{metric.field_name}"')
        if not select_parts:
            select_parts = ["*"]

        select_clause = ", ".join(select_parts)
        where_clauses = []

        if not scope.is_unrestricted:
            if scope.branch_ids and qd.branch_column:
                placeholders = ", ".join(f":branch_{i}" for i, _ in enumerate(scope.branch_ids))
                where_clauses.append(f'"{qd.branch_column}" IN ({placeholders})')
                for i, bid in enumerate(scope.branch_ids):
                    params[f"branch_{i}"] = bid
            elif scope.district_ids and qd.district_column:
                placeholders = ", ".join(f":district_{i}" for i, _ in enumerate(scope.district_ids))
                where_clauses.append(f'"{qd.district_column}" IN ({placeholders})')
                for i, did in enumerate(scope.district_ids):
                    params[f"district_{i}"] = did
            elif scope.region_ids and qd.region_column:
                placeholders = ", ".join(f":region_{i}" for i, _ in enumerate(scope.region_ids))
                where_clauses.append(f'"{qd.region_column}" IN ({placeholders})')
                for i, rid in enumerate(scope.region_ids):
                    params[f"region_{i}"] = rid

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        group_by = ""
        if qd.dimensions and qd.metrics:
            dims = ", ".join(f'"{d.field_name}"' for d in qd.dimensions)
            group_by = f"GROUP BY {dims}"

        order_by = ""
        if qd.sort_by:
            direction = "DESC" if qd.sort_order.upper() == "DESC" else "ASC"
            order_by = f'ORDER BY "{qd.sort_by}" {direction}'

        offset = (page - 1) * page_size
        sql = (
            f"SELECT {select_clause} FROM {table} "
            f"{where_sql} {group_by} {order_by} "
            f"OFFSET :offset ROWS FETCH NEXT :fetch_rows ROWS ONLY"
        )
        params["offset"] = offset
        params["fetch_rows"] = page_size
        return sql.strip(), params


# ── Internal API connector ────────────────────────────────────────────────────

class InternalAPIConnector(BaseConnector):
    """
    Fetches data from an internal REST API endpoint.
    Credentials remain on the backend; never exposed to the frontend.
    """

    def __init__(self, base_url: str, auth_config: dict):
        self.base_url = base_url
        self.auth_config = auth_config  # {"type": "bearer", "token": "..."} etc.

    def _get_headers(self) -> dict:
        auth_type = self.auth_config.get("type", "none")
        if auth_type == "bearer":
            return {"Authorization": f"Bearer {self.auth_config['token']}"}
        elif auth_type == "basic":
            import base64
            creds = base64.b64encode(
                f"{self.auth_config['username']}:{self.auth_config['password']}".encode()
            ).decode()
            return {"Authorization": f"Basic {creds}"}
        return {}

    def test_connection(self) -> bool:
        try:
            import httpx
            resp = httpx.get(self.base_url, headers=self._get_headers(), timeout=5)
            return resp.status_code < 500
        except Exception as e:
            logger.error(f"Internal API connection test failed: {e}")
            return False

    def get_schema_objects(self, schema: str) -> list[str]:
        # For API sources, endpoints are configured in the dataset
        return []

    def get_field_metadata(self, schema: str, object_name: str) -> list[dict]:
        # Field metadata is manually defined for API sources
        return []

    def execute_query(
        self,
        query_def: QueryDefinition,
        scope: DataScope,
        page: int = 1,
        page_size: int = 25,
    ) -> QueryResult:
        """
        Calls the configured endpoint, injects org-scope params as query params.
        Response is expected to be JSON array or {data: [...], total: N}.
        """
        import httpx
        params: dict = {"page": page, "page_size": page_size}

        # Inject scope as query parameters the internal API understands
        if not scope.is_unrestricted:
            if scope.branch_ids:
                params["branch_ids"] = ",".join(str(b) for b in scope.branch_ids)
            elif scope.district_ids:
                params["district_ids"] = ",".join(str(d) for d in scope.district_ids)
            elif scope.region_ids:
                params["region_ids"] = ",".join(str(r) for r in scope.region_ids)

        endpoint = query_def.object_name  # endpoint path for API sources
        url = f"{self.base_url.rstrip('/')}/{endpoint.lstrip('/')}"

        try:
            resp = httpx.get(url, headers=self._get_headers(), params=params, timeout=30)
            resp.raise_for_status()
            data = resp.json()

            if isinstance(data, list):
                rows = data
                total = len(data)
            else:
                rows = data.get("data", [])
                total = data.get("total", len(rows))

            columns = list(rows[0].keys()) if rows else []
            return QueryResult(columns=columns, rows=rows, total_count=total, page=page, page_size=page_size)
        except Exception as e:
            logger.error(f"Internal API query failed: {e}")
            raise


# ── Factory ───────────────────────────────────────────────────────────────────

def get_connector(source_type: str, config: dict) -> BaseConnector:
    """
    Factory function — returns the correct connector for a data source type.
    config dict contains decrypted connection parameters.
    """
    if source_type == "POSTGRESQL":
        return PostgreSQLConnector(
            host=config["host"],
            port=int(config.get("port", 5432)),
            database=config["database"],
            username=config["username"],
            password=config["password"],
            schema=config.get("schema", "public"),
        )
    elif source_type == "ORACLE":
        return OracleConnector(
            host=config["host"],
            port=int(config.get("port", 1521)),
            service_name=config["service_name"],
            username=config["username"],
            password=config["password"],
        )
    elif source_type == "INTERNAL_API":
        return InternalAPIConnector(
            base_url=config["api_url"],
            auth_config=config.get("auth_config", {}),
        )
    else:
        raise ValueError(f"Unknown data source type: {source_type}")
