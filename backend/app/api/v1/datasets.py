"""Datasets API — full CRUD + field management."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.security.dependencies import require_permission

router = APIRouter()

class DatasetCreate(BaseModel):
    name: str; description: Optional[str] = None; source_id: int
    schema_name: Optional[str] = None; object_name: str
    region_column: Optional[str] = None; district_column: Optional[str] = None
    branch_column: Optional[str] = None; status: str = "DRAFT"

class FieldCreate(BaseModel):
    field_name: str; display_name: str; data_type: str = "TEXT"
    field_category: str = "DIMENSION"; is_filterable: bool = True
    is_aggregatable: bool = False; allowed_aggregations: Optional[str] = None
    sort_order: int = 0

def _ds_dict(d) -> dict:
    return {"id": d.id, "name": d.name, "description": d.description, "status": d.status,
            "source_id": d.source_id, "schema_name": d.schema_name, "object_name": d.object_name,
            "region_column": d.region_column, "district_column": d.district_column,
            "branch_column": d.branch_column, "created_at": d.created_at}

@router.get("")
def list_datasets(status: Optional[str] = None, current_user=Depends(require_permission("dataset.view")), db: Session = Depends(get_db)):
    from app.models.dataset import Dataset
    q = db.query(Dataset)
    if status: q = q.filter_by(status=status)
    return [_ds_dict(d) for d in q.order_by(Dataset.name).all()]

@router.post("", status_code=201)
def create_dataset(body: DatasetCreate, current_user=Depends(require_permission("dataset.manage")), db: Session = Depends(get_db)):
    from app.models.dataset import Dataset
    if db.query(Dataset).filter_by(name=body.name).first():
        raise HTTPException(400, "Dataset name already exists")
    d = Dataset(**body.model_dump(), owner_id=current_user.id, created_by=current_user.id)
    db.add(d); db.commit(); db.refresh(d)
    return _ds_dict(d)

@router.get("/{dataset_id}")
def get_dataset(dataset_id: int, current_user=Depends(require_permission("dataset.view")), db: Session = Depends(get_db)):
    from app.models.dataset import Dataset
    d = db.query(Dataset).filter_by(id=dataset_id).first()
    if not d: raise HTTPException(404, "Dataset not found")
    return _ds_dict(d)

@router.put("/{dataset_id}")
def update_dataset(dataset_id: int, body: DatasetCreate, current_user=Depends(require_permission("dataset.manage")), db: Session = Depends(get_db)):
    from app.models.dataset import Dataset
    d = db.query(Dataset).filter_by(id=dataset_id).first()
    if not d: raise HTTPException(404, "Dataset not found")
    for k, v in body.model_dump().items():
        setattr(d, k, v)
    db.commit(); db.refresh(d)
    return _ds_dict(d)

@router.get("/{dataset_id}/fields")
def get_fields(dataset_id: int, current_user=Depends(require_permission("dataset.view")), db: Session = Depends(get_db)):
    from app.models.dataset import DatasetField
    fields = db.query(DatasetField).filter_by(dataset_id=dataset_id).order_by(DatasetField.sort_order).all()
    return [{"id": f.id, "field_name": f.field_name, "display_name": f.display_name,
             "data_type": f.data_type, "field_category": f.field_category,
             "is_filterable": f.is_filterable, "is_aggregatable": f.is_aggregatable,
             "allowed_aggregations": f.allowed_aggregations, "sort_order": f.sort_order} for f in fields]

@router.post("/{dataset_id}/fields", status_code=201)
def add_field(dataset_id: int, body: FieldCreate, current_user=Depends(require_permission("dataset.manage")), db: Session = Depends(get_db)):
    from app.models.dataset import DatasetField
    f = DatasetField(dataset_id=dataset_id, **body.model_dump())
    db.add(f); db.commit(); db.refresh(f)
    return {"id": f.id, "field_name": f.field_name, "display_name": f.display_name,
            "data_type": f.data_type, "field_category": f.field_category}

@router.put("/{dataset_id}/fields")
def replace_fields(dataset_id: int, fields: list[FieldCreate], current_user=Depends(require_permission("dataset.manage")), db: Session = Depends(get_db)):
    from app.models.dataset import DatasetField
    db.query(DatasetField).filter_by(dataset_id=dataset_id).delete()
    for f in fields:
        db.add(DatasetField(dataset_id=dataset_id, **f.model_dump()))
    db.commit()
    return {"message": f"{len(fields)} fields saved"}

@router.post("/{dataset_id}/preview")
def preview_dataset(dataset_id: int, current_user=Depends(require_permission("dataset.view")), db: Session = Depends(get_db)):
    from app.models.dataset import Dataset, DatasetField
    from app.models.data_source import DataSource
    from app.database.data_access import get_connector, DataScope, QueryDefinition, FieldRef
    from app.services.query_engine import _decrypt_credentials
    d = db.query(Dataset).filter_by(id=dataset_id).first()
    if not d: raise HTTPException(404, "Dataset not found")
    s = db.query(DataSource).filter_by(id=d.source_id).first()
    config = _decrypt_credentials(s)
    # HEAD_OFFICE scope for preview
    scope = DataScope(access_level="HEAD_OFFICE")
    fields = db.query(DatasetField).filter_by(dataset_id=dataset_id).limit(10).all()
    qd = QueryDefinition(dataset_id=dataset_id, source_type=s.source_type,
                         connection_config=config, schema_name=d.schema_name,
                         object_name=d.object_name,
                         dimensions=[FieldRef(f.field_name) for f in fields[:5]])
    try:
        connector = get_connector(s.source_type, config)
        result = connector.execute_query(qd, scope, page=1, page_size=10)
        return {"columns": result.columns, "rows": result.rows, "total": result.total_count}
    except Exception as e:
        raise HTTPException(500, f"Preview failed: {str(e)}")
