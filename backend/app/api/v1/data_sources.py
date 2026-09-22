"""Data Sources API — full CRUD with credential encryption."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.security.dependencies import require_permission

router = APIRouter()

class DataSourceCreate(BaseModel):
    name: str
    source_type: str  # POSTGRESQL | ORACLE | INTERNAL_API
    description: Optional[str] = None
    host: Optional[str] = None
    port: Optional[int] = None
    database_name: Optional[str] = None
    service_name: Optional[str] = None
    schema_name: Optional[str] = None
    api_url: Optional[str] = None
    username: Optional[str] = None  # will be encrypted
    password: Optional[str] = None  # will be encrypted

def _encrypt(val: Optional[str]) -> Optional[str]:
    if not val: return None
    from app.config.settings import get_settings
    from cryptography.fernet import Fernet
    try:
        f = Fernet(get_settings().credential_encryption_key.encode())
        return "encrypted:" + f.encrypt(val.encode()).decode()
    except Exception:
        return val

def _safe_dict(s) -> dict:
    return {"id": s.id, "name": s.name, "source_type": s.source_type,
            "description": s.description, "host": s.host, "port": s.port,
            "database_name": s.database_name, "service_name": s.service_name,
            "schema_name": s.schema_name, "api_url": s.api_url,
            "is_active": s.is_active, "created_at": s.created_at,
            "username": "***" if s.username_enc else None}  # never return credentials

@router.get("")
def list_sources(current_user=Depends(require_permission("datasource.view")), db: Session = Depends(get_db)):
    from app.models.data_source import DataSource
    return [_safe_dict(s) for s in db.query(DataSource).order_by(DataSource.name).all()]

@router.post("", status_code=201)
def create_source(body: DataSourceCreate, current_user=Depends(require_permission("datasource.create")), db: Session = Depends(get_db)):
    from app.models.data_source import DataSource
    if db.query(DataSource).filter_by(name=body.name).first():
        raise HTTPException(400, "Data source name already exists")
    s = DataSource(name=body.name, source_type=body.source_type, description=body.description,
                   host=body.host, port=body.port, database_name=body.database_name,
                   service_name=body.service_name, schema_name=body.schema_name,
                   api_url=body.api_url, username_enc=_encrypt(body.username),
                   password_enc=_encrypt(body.password), is_active=True, created_by=current_user.id)
    db.add(s); db.commit(); db.refresh(s)
    return _safe_dict(s)

@router.get("/{source_id}")
def get_source(source_id: int, current_user=Depends(require_permission("datasource.view")), db: Session = Depends(get_db)):
    from app.models.data_source import DataSource
    s = db.query(DataSource).filter_by(id=source_id).first()
    if not s: raise HTTPException(404, "Data source not found")
    return _safe_dict(s)

@router.put("/{source_id}")
def update_source(source_id: int, body: DataSourceCreate, current_user=Depends(require_permission("datasource.edit")), db: Session = Depends(get_db)):
    from app.models.data_source import DataSource
    s = db.query(DataSource).filter_by(id=source_id).first()
    if not s: raise HTTPException(404, "Data source not found")
    s.name=body.name; s.source_type=body.source_type; s.description=body.description
    s.host=body.host; s.port=body.port; s.database_name=body.database_name
    s.service_name=body.service_name; s.schema_name=body.schema_name; s.api_url=body.api_url
    if body.username: s.username_enc = _encrypt(body.username)
    if body.password: s.password_enc = _encrypt(body.password)
    db.commit(); db.refresh(s)
    return _safe_dict(s)

@router.delete("/{source_id}", status_code=204)
def delete_source(source_id: int, current_user=Depends(require_permission("datasource.delete")), db: Session = Depends(get_db)):
    from app.models.data_source import DataSource
    s = db.query(DataSource).filter_by(id=source_id).first()
    if not s: raise HTTPException(404, "Data source not found")
    s.is_active = False; db.commit()

@router.post("/{source_id}/test")
def test_connection(source_id: int, current_user=Depends(require_permission("datasource.view")), db: Session = Depends(get_db)):
    from app.models.data_source import DataSource
    from app.database.data_access import get_connector
    s = db.query(DataSource).filter_by(id=source_id).first()
    if not s: raise HTTPException(404, "Data source not found")
    from app.services.query_engine import _decrypt_credentials
    config = _decrypt_credentials(s)
    connector = get_connector(s.source_type, config)
    ok = connector.test_connection()
    return {"success": ok, "message": "Connection successful" if ok else "Connection failed"}

@router.get("/{source_id}/schema")
def get_schema(source_id: int, schema: str = "public", current_user=Depends(require_permission("datasource.view")), db: Session = Depends(get_db)):
    from app.models.data_source import DataSource
    from app.database.data_access import get_connector
    from app.services.query_engine import _decrypt_credentials
    s = db.query(DataSource).filter_by(id=source_id).first()
    if not s: raise HTTPException(404, "Data source not found")
    config = _decrypt_credentials(s)
    connector = get_connector(s.source_type, config)
    return {"objects": connector.get_schema_objects(schema)}

@router.get("/{source_id}/fields")
def get_fields(source_id: int, schema: str = "public", object_name: str = "", current_user=Depends(require_permission("datasource.view")), db: Session = Depends(get_db)):
    from app.models.data_source import DataSource
    from app.database.data_access import get_connector
    from app.services.query_engine import _decrypt_credentials
    s = db.query(DataSource).filter_by(id=source_id).first()
    if not s: raise HTTPException(404, "Data source not found")
    config = _decrypt_credentials(s)
    connector = get_connector(s.source_type, config)
    return {"fields": connector.get_field_metadata(schema, object_name)}
