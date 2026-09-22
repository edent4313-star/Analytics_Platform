"""
Dashboard runtime data API — Phase 8 complete implementation.
auth → dashboard permission → org scope → query engine → response
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io, csv

from app.database.session import get_db
from app.security.dependencies import get_current_user
from app.security.data_scope import get_data_scope, validate_org_filter_request

router = APIRouter()


def _check_dashboard_permission(code: str, user, db: Session, need_export=False):
    from app.models.dashboard import Dashboard, DashboardPermission
    from app.models.role import UserRole
    d = db.query(Dashboard).filter_by(code=code, is_active=True).first()
    if not d:
        raise HTTPException(404, f"Dashboard '{code}' not found")
    if user.primary_role_name == "ADMIN":
        return d
    role_ids = [r.role_id for r in db.query(UserRole).filter_by(user_id=user.id).all()]
    q = db.query(DashboardPermission).filter(
        DashboardPermission.dashboard_id == d.id,
        DashboardPermission.role_id.in_(role_ids),
        DashboardPermission.can_view == True,
    )
    if need_export:
        q = db.query(DashboardPermission).filter(
            DashboardPermission.dashboard_id == d.id,
            DashboardPermission.role_id.in_(role_ids),
            DashboardPermission.can_export == True,
        )
    if not q.first():
        raise HTTPException(403, "You do not have permission to access this dashboard")
    return d


@router.get("/{code}")
def get_dashboard_config(code: str, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    from app.models.dashboard import DashboardVersion
    dashboard = _check_dashboard_permission(code, current_user, db)
    version = (db.query(DashboardVersion)
               .filter_by(dashboard_id=dashboard.id, status="PUBLISHED")
               .first()
               or db.query(DashboardVersion)
               .filter_by(dashboard_id=dashboard.id)
               .order_by(DashboardVersion.version_number.desc()).first())
    widgets = filters = []
    if version:
        widgets = [{"id": w.id, "widget_type": w.widget_type, "title": w.title,
                    "position_x": w.position_x, "position_y": w.position_y,
                    "width": w.width, "height": w.height,
                    "config_json": w.config_json, "dataset_id": w.dataset_id,
                    "sort_order": w.sort_order} for w in version.widgets]
        filters = [{"id": f.id, "filter_type": f.filter_type, "field_name": f.field_name,
                    "display_name": f.display_name, "is_global": f.is_global,
                    "default_value": f.default_value, "sort_order": f.sort_order,
                    "config_json": f.config_json} for f in version.filters]
    return {
        "id": dashboard.id, "code": dashboard.code, "name": dashboard.name,
        "description": dashboard.description,
        "version_id": version.id if version else None,
        "version_number": version.version_number if version else None,
        "version_status": version.status if version else None,
        "layout_config": version.layout_config if version else [],
        "widgets": widgets, "filters": filters,
        "user_scope": {"access_level": current_user.access_level,
                       "region_id": current_user.region_id,
                       "district_id": current_user.district_id,
                       "branch_id": current_user.branch_id},
    }


@router.get("/{code}/widgets/{widget_id}/data")
def get_widget_data(
    code: str, widget_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=500),
    region_id: Optional[int] = Query(None),
    district_id: Optional[int] = Query(None),
    branch_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.dashboard import DashboardWidget
    from app.services.query_engine import execute_widget_query

    _check_dashboard_permission(code, current_user, db)
    scope = get_data_scope(current_user)

    eff_branch, eff_district, eff_region = validate_org_filter_request(
        branch_id, district_id, region_id, scope)

    if not scope.is_unrestricted and branch_id and eff_branch is None:
        raise HTTPException(403, "Requested org unit is outside your authorized scope")

    widget = db.query(DashboardWidget).filter_by(id=widget_id).first()
    if not widget:
        raise HTTPException(404, "Widget not found")
    if not widget.dataset_id:
        return {"data": [], "total": 0, "page": page, "page_size": page_size,
                "columns": [], "widget_type": widget.widget_type}

    config = widget.config_json or {}
    config["widget_type"] = widget.widget_type
    user_filters = {
        "region_id": eff_region, "district_id": eff_district, "branch_id": eff_branch,
        "date_from": date_from, "date_to": date_to,
    }
    user_filters = {k: v for k, v in user_filters.items() if v is not None}

    try:
        result = execute_widget_query(config, widget.dataset_id, scope, user_filters, page, page_size, db)
        return {"data": result.rows, "total": result.total_count,
                "page": result.page, "page_size": result.page_size,
                "columns": result.columns, "widget_type": widget.widget_type}
    except Exception as e:
        raise HTTPException(500, f"Query failed: {str(e)}")


@router.get("/{code}/widgets/{widget_id}/export")
def export_widget_data(
    code: str, widget_id: int,
    format: str = Query("csv", pattern="^(csv|excel|pdf)$"),
    region_id: Optional[int] = Query(None),
    district_id: Optional[int] = Query(None),
    branch_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.dashboard import DashboardWidget
    from app.services.query_engine import execute_widget_query

    dashboard = _check_dashboard_permission(code, current_user, db, need_export=True)
    scope = get_data_scope(current_user)
    eff_branch, eff_district, eff_region = validate_org_filter_request(
        branch_id, district_id, region_id, scope)

    widget = db.query(DashboardWidget).filter_by(id=widget_id).first()
    if not widget:
        raise HTTPException(404, "Widget not found")

    config = widget.config_json or {}
    config["widget_type"] = widget.widget_type
    user_filters = {k: v for k, v in {
        "region_id": eff_region, "district_id": eff_district,
        "branch_id": eff_branch, "date_from": date_from, "date_to": date_to
    }.items() if v is not None}

    try:
        result = execute_widget_query(config, widget.dataset_id, scope, user_filters, 1, 10000, db)
    except Exception as e:
        raise HTTPException(500, f"Export query failed: {str(e)}")

    if format == "csv":
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=result.columns)
        writer.writeheader()
        writer.writerows(result.rows)
        output.seek(0)
        return StreamingResponse(output, media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={code}_{widget_id}.csv"})

    elif format == "excel":
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(result.columns)
        for row in result.rows:
            ws.append([row.get(c) for c in result.columns])
        buf = io.BytesIO()
        wb.save(buf); buf.seek(0)
        return StreamingResponse(buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={code}_{widget_id}.xlsx"})

    else:  # pdf
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
        from reportlab.lib import colors
        buf = io.BytesIO()
        doc = SimpleDocTemplate(buf, pagesize=landscape(A4))
        data_rows = [result.columns] + [[str(r.get(c, "")) for c in result.columns] for r in result.rows[:500]]
        t = Table(data_rows)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.25, colors.black),
        ]))
        doc.build([t]); buf.seek(0)
        return StreamingResponse(buf, media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={code}_{widget_id}.pdf"})
