"""
Dashboards admin API — Phases 9, 10, 11.
Covers: create, edit, versioning, submit/approve/reject/publish/unpublish/archive.
"""
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.security.dependencies import get_current_user, require_permission

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────────────────────

class DashboardCreate(BaseModel):
    code: str
    name: str
    description: Optional[str] = None

class WidgetUpsert(BaseModel):
    id: Optional[int] = None
    widget_type: str
    title: Optional[str] = None
    position_x: int = 0
    position_y: int = 0
    width: int = 4
    height: int = 3
    config_json: Optional[dict] = None
    dataset_id: Optional[int] = None
    sort_order: int = 0

class FilterUpsert(BaseModel):
    id: Optional[int] = None
    filter_type: str
    field_name: Optional[str] = None
    display_name: str
    is_global: bool = True
    default_value: Optional[str] = None
    config_json: Optional[dict] = None
    sort_order: int = 0

class VersionSave(BaseModel):
    layout_config: Optional[list] = None
    widgets: List[WidgetUpsert] = []
    filters: List[FilterUpsert] = []

class ApprovalAction(BaseModel):
    rejection_reason: Optional[str] = None

class PermissionSet(BaseModel):
    role_id: int
    can_view: bool = True
    can_export: bool = False

# ── Helpers ───────────────────────────────────────────────────────────────────

def _dash_dict(d, version=None) -> dict:
    return {
        "id": d.id, "code": d.code, "name": d.name, "description": d.description,
        "is_active": d.is_active, "created_at": d.created_at, "updated_at": d.updated_at,
        "published_version": version.version_number if version else None,
        "published_version_id": version.id if version else None,
    }

def _version_dict(v) -> dict:
    return {
        "id": v.id, "dashboard_id": v.dashboard_id, "version_number": v.version_number,
        "status": v.status, "layout_config": v.layout_config,
        "submitted_by": v.submitted_by, "submitted_at": v.submitted_at,
        "approved_by": v.approved_by, "approved_at": v.approved_at,
        "published_at": v.published_at, "rejection_reason": v.rejection_reason,
        "created_at": v.created_at,
    }

# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
def list_dashboards(
    page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=100),
    search: Optional[str] = None,
    current_user=Depends(get_current_user), db: Session = Depends(get_db),
):
    from app.models.dashboard import Dashboard, DashboardPermission, DashboardVersion
    from app.models.role import UserRole
    if current_user.primary_role_name == "ADMIN":
        q = db.query(Dashboard).filter_by(is_active=True)
    else:
        role_ids = [r.role_id for r in db.query(UserRole).filter_by(user_id=current_user.id).all()]
        accessible = db.query(DashboardPermission.dashboard_id).filter(
            DashboardPermission.role_id.in_(role_ids), DashboardPermission.can_view == True).subquery()
        q = db.query(Dashboard).filter(Dashboard.id.in_(accessible), Dashboard.is_active == True)
    if search:
        q = q.filter(Dashboard.name.ilike(f"%{search}%"))
    total = q.count()
    dashboards = q.order_by(Dashboard.name).offset((page-1)*page_size).limit(page_size).all()
    result = []
    for d in dashboards:
        pub = db.query(DashboardVersion).filter_by(dashboard_id=d.id, status="PUBLISHED").first()
        result.append(_dash_dict(d, pub))
    return {"items": result, "total": total, "page": page, "page_size": page_size}


@router.post("", status_code=201)
def create_dashboard(
    body: DashboardCreate,
    current_user=Depends(require_permission("dashboard.create")), db: Session = Depends(get_db),
):
    from app.models.dashboard import Dashboard, DashboardVersion
    if db.query(Dashboard).filter_by(code=body.code).first():
        raise HTTPException(400, "Dashboard code already exists")
    d = Dashboard(code=body.code, name=body.name, description=body.description,
                  owner_id=current_user.id, created_by=current_user.id, is_active=True)
    db.add(d); db.flush()
    v = DashboardVersion(dashboard_id=d.id, version_number=1, status="DRAFT",
                         created_by=current_user.id, layout_config=[])
    db.add(v); db.commit(); db.refresh(d)
    return _dash_dict(d)


@router.get("/{dashboard_id}")
def get_dashboard(dashboard_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.dashboard import Dashboard, DashboardVersion
    d = db.query(Dashboard).filter_by(id=dashboard_id).first()
    if not d: raise HTTPException(404, "Dashboard not found")
    pub = db.query(DashboardVersion).filter_by(dashboard_id=d.id, status="PUBLISHED").first()
    return _dash_dict(d, pub)


@router.get("/{dashboard_id}/versions")
def list_versions(dashboard_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.dashboard import DashboardVersion
    versions = db.query(DashboardVersion).filter_by(dashboard_id=dashboard_id).order_by(DashboardVersion.version_number.desc()).all()
    return [_version_dict(v) for v in versions]


@router.get("/{dashboard_id}/versions/{version_id}")
def get_version(dashboard_id: int, version_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.dashboard import DashboardVersion
    v = db.query(DashboardVersion).filter_by(id=version_id, dashboard_id=dashboard_id).first()
    if not v: raise HTTPException(404, "Version not found")
    vd = _version_dict(v)
    vd["widgets"] = [{"id": w.id, "widget_type": w.widget_type, "title": w.title,
                      "position_x": w.position_x, "position_y": w.position_y,
                      "width": w.width, "height": w.height, "config_json": w.config_json,
                      "dataset_id": w.dataset_id, "sort_order": w.sort_order} for w in v.widgets]
    vd["filters"] = [{"id": f.id, "filter_type": f.filter_type, "field_name": f.field_name,
                      "display_name": f.display_name, "is_global": f.is_global,
                      "default_value": f.default_value, "sort_order": f.sort_order} for f in v.filters]
    return vd


@router.put("/{dashboard_id}/versions/{version_id}")
def save_version(
    dashboard_id: int, version_id: int, body: VersionSave,
    current_user=Depends(require_permission("dashboard.edit")), db: Session = Depends(get_db),
):
    from app.models.dashboard import DashboardVersion, DashboardWidget, DashboardFilter, Dashboard
    v = db.query(DashboardVersion).filter_by(id=version_id, dashboard_id=dashboard_id).first()
    if not v: raise HTTPException(404, "Version not found")
    if v.status == "PUBLISHED":
        # Editing a published version creates a new draft version
        latest_num = db.query(DashboardVersion).filter_by(dashboard_id=dashboard_id).count()
        v = DashboardVersion(dashboard_id=dashboard_id, version_number=latest_num+1,
                             status="DRAFT", created_by=current_user.id, layout_config=[])
        db.add(v); db.flush()

    v.layout_config = body.layout_config or []
    # Replace widgets
    db.query(DashboardWidget).filter_by(version_id=v.id).delete()
    for w in body.widgets:
        db.add(DashboardWidget(version_id=v.id, widget_type=w.widget_type, title=w.title,
                               position_x=w.position_x, position_y=w.position_y,
                               width=w.width, height=w.height, config_json=w.config_json,
                               dataset_id=w.dataset_id, sort_order=w.sort_order))
    # Replace filters
    db.query(DashboardFilter).filter_by(version_id=v.id).delete()
    for f in body.filters:
        db.add(DashboardFilter(version_id=v.id, filter_type=f.filter_type,
                               field_name=f.field_name, display_name=f.display_name,
                               is_global=f.is_global, default_value=f.default_value,
                               config_json=f.config_json, sort_order=f.sort_order))
    db.commit(); db.refresh(v)
    return _version_dict(v)


@router.post("/{dashboard_id}/submit")
def submit_for_approval(
    dashboard_id: int,
    current_user=Depends(require_permission("dashboard.edit")), db: Session = Depends(get_db),
):
    from app.models.dashboard import DashboardVersion
    now = datetime.now(timezone.utc)
    v = (db.query(DashboardVersion)
         .filter_by(dashboard_id=dashboard_id, status="DRAFT")
         .order_by(DashboardVersion.version_number.desc()).first())
    if not v: raise HTTPException(400, "No draft version to submit")
    v.status = "SUBMITTED"; v.submitted_by = current_user.id; v.submitted_at = now
    db.commit()
    return {"message": "Submitted for approval", "version_id": v.id}


@router.post("/{dashboard_id}/approve")
def approve_dashboard(
    dashboard_id: int,
    current_user=Depends(require_permission("dashboard.publish")), db: Session = Depends(get_db),
):
    from app.models.dashboard import DashboardVersion
    now = datetime.now(timezone.utc)
    v = (db.query(DashboardVersion)
         .filter_by(dashboard_id=dashboard_id, status="SUBMITTED")
         .order_by(DashboardVersion.version_number.desc()).first())
    if not v: raise HTTPException(400, "No submitted version to approve")
    v.status = "APPROVED"; v.approved_by = current_user.id; v.approved_at = now
    db.commit()
    return {"message": "Approved", "version_id": v.id}


@router.post("/{dashboard_id}/reject")
def reject_dashboard(
    dashboard_id: int, body: ApprovalAction,
    current_user=Depends(require_permission("dashboard.publish")), db: Session = Depends(get_db),
):
    from app.models.dashboard import DashboardVersion
    v = (db.query(DashboardVersion)
         .filter_by(dashboard_id=dashboard_id, status="SUBMITTED")
         .order_by(DashboardVersion.version_number.desc()).first())
    if not v: raise HTTPException(400, "No submitted version to reject")
    v.status = "DRAFT"; v.rejection_reason = body.rejection_reason
    db.commit()
    return {"message": "Rejected — returned to draft", "version_id": v.id}


@router.post("/{dashboard_id}/publish")
def publish_dashboard(
    dashboard_id: int,
    current_user=Depends(require_permission("dashboard.publish")), db: Session = Depends(get_db),
):
    from app.models.dashboard import DashboardVersion
    now = datetime.now(timezone.utc)
    v = (db.query(DashboardVersion)
         .filter_by(dashboard_id=dashboard_id, status="APPROVED")
         .order_by(DashboardVersion.version_number.desc()).first())
    if not v: raise HTTPException(400, "No approved version to publish")
    # Unpublish any currently published version
    db.query(DashboardVersion).filter_by(dashboard_id=dashboard_id, status="PUBLISHED").update({"status": "ARCHIVED"})
    v.status = "PUBLISHED"; v.published_at = now
    db.commit()
    return {"message": "Published", "version_id": v.id}


@router.post("/{dashboard_id}/unpublish")
def unpublish_dashboard(
    dashboard_id: int,
    current_user=Depends(require_permission("dashboard.publish")), db: Session = Depends(get_db),
):
    from app.models.dashboard import DashboardVersion
    v = db.query(DashboardVersion).filter_by(dashboard_id=dashboard_id, status="PUBLISHED").first()
    if not v: raise HTTPException(400, "No published version")
    v.status = "ARCHIVED"; db.commit()
    return {"message": "Unpublished"}


@router.post("/{dashboard_id}/duplicate")
def duplicate_dashboard(
    dashboard_id: int,
    current_user=Depends(require_permission("dashboard.create")), db: Session = Depends(get_db),
):
    from app.models.dashboard import Dashboard, DashboardVersion, DashboardWidget, DashboardFilter
    import uuid
    src = db.query(Dashboard).filter_by(id=dashboard_id).first()
    if not src: raise HTTPException(404, "Dashboard not found")
    new_code = f"{src.code}-copy-{str(uuid.uuid4())[:6]}"
    d = Dashboard(code=new_code, name=f"{src.name} (Copy)", description=src.description,
                  owner_id=current_user.id, created_by=current_user.id, is_active=True)
    db.add(d); db.flush()
    src_ver = (db.query(DashboardVersion).filter_by(dashboard_id=dashboard_id, status="PUBLISHED").first()
               or db.query(DashboardVersion).filter_by(dashboard_id=dashboard_id).order_by(DashboardVersion.version_number.desc()).first())
    new_ver = DashboardVersion(dashboard_id=d.id, version_number=1, status="DRAFT",
                               created_by=current_user.id,
                               layout_config=src_ver.layout_config if src_ver else [])
    db.add(new_ver); db.flush()
    if src_ver:
        for w in src_ver.widgets:
            db.add(DashboardWidget(version_id=new_ver.id, widget_type=w.widget_type, title=w.title,
                                   position_x=w.position_x, position_y=w.position_y,
                                   width=w.width, height=w.height, config_json=w.config_json,
                                   dataset_id=w.dataset_id, sort_order=w.sort_order))
        for f in src_ver.filters:
            db.add(DashboardFilter(version_id=new_ver.id, filter_type=f.filter_type,
                                   field_name=f.field_name, display_name=f.display_name,
                                   is_global=f.is_global, default_value=f.default_value,
                                   sort_order=f.sort_order))
    db.commit()
    return {"id": d.id, "code": d.code, "name": d.name}


@router.put("/{dashboard_id}/permissions")
def set_permissions(
    dashboard_id: int, body: list[PermissionSet],
    current_user=Depends(require_permission("dashboard.publish")), db: Session = Depends(get_db),
):
    from app.models.dashboard import DashboardPermission
    db.query(DashboardPermission).filter_by(dashboard_id=dashboard_id).delete()
    for p in body:
        db.add(DashboardPermission(dashboard_id=dashboard_id, role_id=p.role_id,
                                   can_view=p.can_view, can_export=p.can_export,
                                   granted_by=current_user.id))
    db.commit()
    return {"message": "Permissions updated"}
