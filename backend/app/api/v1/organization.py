"""
Organization hierarchy API — Regions, Districts, Branches.
GET endpoints: filtered by user's data scope (Phase 6 enforcement).
POST/PUT: admin only.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.security.dependencies import get_current_user, require_permission
from app.security.data_scope import get_data_scope

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────────────────────

class RegionCreate(BaseModel):
    code: str
    name: str
    status: str = "ACTIVE"

class DistrictCreate(BaseModel):
    code: str
    name: str
    region_id: int
    status: str = "ACTIVE"

class BranchCreate(BaseModel):
    code: str
    name: str
    region_id: int
    district_id: int
    status: str = "ACTIVE"

class StatusUpdate(BaseModel):
    status: str  # ACTIVE | INACTIVE

# ── Regions ───────────────────────────────────────────────────────────────────

@router.get("/regions")
def list_regions(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.organization import Region
    scope = get_data_scope(current_user)
    q = db.query(Region).filter(Region.status == "ACTIVE")
    if not scope.is_unrestricted and scope.region_ids:
        q = q.filter(Region.id.in_(scope.region_ids))
    regions = q.order_by(Region.name).all()
    return [{"id": r.id, "code": r.code, "name": r.name, "status": r.status} for r in regions]

@router.get("/regions/all")
def list_all_regions(current_user=Depends(require_permission("user.view")), db: Session = Depends(get_db)):
    """Admin view — all regions regardless of status."""
    from app.models.organization import Region
    regions = db.query(Region).order_by(Region.name).all()
    return [{"id": r.id, "code": r.code, "name": r.name, "status": r.status} for r in regions]

@router.post("/regions", status_code=201)
def create_region(body: RegionCreate, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from app.models.organization import Region
    if db.query(Region).filter_by(code=body.code).first():
        raise HTTPException(400, "Region code already exists")
    r = Region(code=body.code, name=body.name, status=body.status)
    db.add(r); db.commit(); db.refresh(r)
    return {"id": r.id, "code": r.code, "name": r.name, "status": r.status}

@router.put("/regions/{region_id}")
def update_region(region_id: int, body: RegionCreate, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from app.models.organization import Region
    r = db.query(Region).filter_by(id=region_id).first()
    if not r: raise HTTPException(404, "Region not found")
    r.code = body.code; r.name = body.name; r.status = body.status
    db.commit(); db.refresh(r)
    return {"id": r.id, "code": r.code, "name": r.name, "status": r.status}

# ── Districts ─────────────────────────────────────────────────────────────────

@router.get("/regions/{region_id}/districts")
def list_districts(region_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.organization import District
    scope = get_data_scope(current_user)
    if not scope.is_unrestricted and scope.region_ids and region_id not in scope.region_ids:
        raise HTTPException(403, "Not authorized for this region")
    q = db.query(District).filter(District.region_id == region_id, District.status == "ACTIVE")
    if not scope.is_unrestricted and scope.district_ids:
        q = q.filter(District.id.in_(scope.district_ids))
    districts = q.order_by(District.name).all()
    return [{"id": d.id, "code": d.code, "name": d.name, "region_id": d.region_id, "status": d.status} for d in districts]

@router.get("/districts/all")
def list_all_districts(region_id: Optional[int] = None, current_user=Depends(require_permission("user.view")), db: Session = Depends(get_db)):
    from app.models.organization import District
    q = db.query(District)
    if region_id: q = q.filter(District.region_id == region_id)
    return [{"id": d.id, "code": d.code, "name": d.name, "region_id": d.region_id, "status": d.status} for d in q.order_by(District.name).all()]

@router.post("/districts", status_code=201)
def create_district(body: DistrictCreate, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from app.models.organization import District, Region
    if not db.query(Region).filter_by(id=body.region_id).first():
        raise HTTPException(400, "region_id not found")
    if db.query(District).filter_by(code=body.code).first():
        raise HTTPException(400, "District code already exists")
    d = District(code=body.code, name=body.name, region_id=body.region_id, status=body.status)
    db.add(d); db.commit(); db.refresh(d)
    return {"id": d.id, "code": d.code, "name": d.name, "region_id": d.region_id, "status": d.status}

@router.put("/districts/{district_id}")
def update_district(district_id: int, body: DistrictCreate, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from app.models.organization import District
    d = db.query(District).filter_by(id=district_id).first()
    if not d: raise HTTPException(404, "District not found")
    d.code = body.code; d.name = body.name; d.region_id = body.region_id; d.status = body.status
    db.commit(); db.refresh(d)
    return {"id": d.id, "code": d.code, "name": d.name, "region_id": d.region_id, "status": d.status}

# ── Branches ──────────────────────────────────────────────────────────────────

@router.get("/districts/{district_id}/branches")
def list_branches(district_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.organization import Branch, District
    scope = get_data_scope(current_user)
    district = db.query(District).filter_by(id=district_id).first()
    if not district: raise HTTPException(404, "District not found")
    if not scope.is_unrestricted:
        if scope.district_ids and district_id not in scope.district_ids:
            raise HTTPException(403, "Not authorized for this district")
        if scope.region_ids and district.region_id not in scope.region_ids:
            raise HTTPException(403, "Not authorized for this region")
    q = db.query(Branch).filter(Branch.district_id == district_id, Branch.status == "ACTIVE")
    if not scope.is_unrestricted and scope.branch_ids:
        q = q.filter(Branch.id.in_(scope.branch_ids))
    branches = q.order_by(Branch.name).all()
    return [{"id": b.id, "code": b.code, "name": b.name, "district_id": b.district_id, "region_id": b.region_id, "status": b.status} for b in branches]

@router.get("/branches/all")
def list_all_branches(district_id: Optional[int] = None, region_id: Optional[int] = None, current_user=Depends(require_permission("user.view")), db: Session = Depends(get_db)):
    from app.models.organization import Branch
    q = db.query(Branch)
    if district_id: q = q.filter(Branch.district_id == district_id)
    if region_id: q = q.filter(Branch.region_id == region_id)
    return [{"id": b.id, "code": b.code, "name": b.name, "district_id": b.district_id, "region_id": b.region_id, "status": b.status} for b in q.order_by(Branch.name).all()]

@router.post("/branches", status_code=201)
def create_branch(body: BranchCreate, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from app.models.organization import Branch, District
    district = db.query(District).filter_by(id=body.district_id).first()
    if not district: raise HTTPException(400, "district_id not found")
    if district.region_id != body.region_id: raise HTTPException(400, "district does not belong to region")
    if db.query(Branch).filter_by(code=body.code).first(): raise HTTPException(400, "Branch code exists")
    b = Branch(code=body.code, name=body.name, region_id=body.region_id, district_id=body.district_id, status=body.status)
    db.add(b); db.commit(); db.refresh(b)
    return {"id": b.id, "code": b.code, "name": b.name, "district_id": b.district_id, "region_id": b.region_id, "status": b.status}

@router.put("/branches/{branch_id}")
def update_branch(branch_id: int, body: BranchCreate, current_user=Depends(require_permission("role.manage")), db: Session = Depends(get_db)):
    from app.models.organization import Branch
    b = db.query(Branch).filter_by(id=branch_id).first()
    if not b: raise HTTPException(404, "Branch not found")
    b.code = body.code; b.name = body.name; b.region_id = body.region_id; b.district_id = body.district_id; b.status = body.status
    db.commit(); db.refresh(b)
    return {"id": b.id, "code": b.code, "name": b.name, "district_id": b.district_id, "region_id": b.region_id, "status": b.status}
