"""
Bulk User Import API — Task 1.
Accepts an Excel (.xlsx) file with user data and creates users in batch.
Excel template columns:
  username | full_name | email | phone | employee_id | access_level |
  region_code | district_code | branch_code | role_name | password

Rules:
- Requires user.create permission
- Validates every row before creating any user (all-or-nothing option via ?strict=true)
- Returns a detailed result per row (success/skip/error)
- Audits the import operation
"""
from typing import Optional
import io
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.security.dependencies import require_permission
from app.security.password import hash_password
from app.services.audit_service import log_audit_event

router = APIRouter()

REQUIRED_COLUMNS = {"username", "full_name", "email", "access_level", "role_name"}
TEMPLATE_COLUMNS = [
    "username", "full_name", "email", "phone", "employee_id",
    "access_level", "region_code", "district_code", "branch_code",
    "role_name", "password",
]


@router.get("/template")
def download_template():
    """Download the Excel template for bulk user import."""
    import openpyxl
    from fastapi.responses import StreamingResponse

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Users"

    # Headers
    ws.append(TEMPLATE_COLUMNS)

    # Style header row
    from openpyxl.styles import Font, PatternFill, Alignment
    header_fill = PatternFill(start_color="1A3A5C", end_color="1A3A5C", fill_type="solid")
    for cell in ws[1]:
        cell.font = Font(color="FFFFFF", bold=True)
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center")
        ws.column_dimensions[cell.column_letter].width = 18

    # Sample row
    ws.append([
        "abebe.kebede", "Abebe Kebede", "abebe@cbe.com.et", "+251911000000", "CBE010",
        "BRANCH", "R01", "D01", "B001", "BRANCH_MANAGER", "Pass@1234",
    ])

    # Instructions sheet
    ws2 = wb.create_sheet("Instructions")
    ws2.append(["Column", "Required", "Values / Notes"])
    instructions = [
        ("username", "Yes", "Unique, min 3 chars, letters/numbers/dots"),
        ("full_name", "Yes", "Employee full name"),
        ("email", "Yes", "Unique organizational email"),
        ("phone", "No", "Phone number"),
        ("employee_id", "No", "CBE AD employee ID (e.g. CBE010)"),
        ("access_level", "Yes", "HEAD_OFFICE | REGION | DISTRICT | BRANCH"),
        ("region_code", "If REGION/DISTRICT/BRANCH", "Region code (e.g. R01)"),
        ("district_code", "If DISTRICT/BRANCH", "District code (e.g. D01)"),
        ("branch_code", "If BRANCH", "Branch code (e.g. B001)"),
        ("role_name", "Yes", "ADMIN | HEAD_OFFICE_USER | REGIONAL_MANAGER | DISTRICT_MANAGER | BRANCH_MANAGER | ANALYST | VIEWER"),
        ("password", "No", "Default password. Min 8 chars. If empty, a temp password is generated."),
    ]
    for row in instructions:
        ws2.append(row)
    for col in ['A', 'B', 'C']:
        ws2.column_dimensions[col].width = 30

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=cbe_user_import_template.xlsx"},
    )


@router.post("/users")
async def bulk_import_users(
    file: UploadFile = File(...),
    strict: bool = Query(False, description="If true, reject entire file on any error"),
    dry_run: bool = Query(False, description="If true, validate only — do not create users"),
    request: Request = None,
    current_user=Depends(require_permission("user.create")),
    db: Session = Depends(get_db),
):
    """
    Import users from Excel file.
    Returns a row-by-row result: created | skipped | error.
    
    Use ?dry_run=true to validate the file without creating any users.
    Use ?strict=true to reject the entire file if any row has an error.
    """
    import openpyxl
    from app.models.user import User
    from app.models.role import Role, UserRole
    from app.models.organization import Region, District, Branch

    # Validate file type
    if not file.filename or not file.filename.lower().endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an Excel file (.xlsx or .xls)",
        )

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(400, "File too large. Maximum 5MB.")

    try:
        wb = openpyxl.load_workbook(io.BytesIO(content))
        ws = wb.active
    except Exception:
        raise HTTPException(400, "Could not read Excel file. Ensure it is a valid .xlsx file.")

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise HTTPException(400, "Excel file is empty.")

    # Parse header row
    headers = [str(h).strip().lower() if h else "" for h in rows[0]]
    missing = REQUIRED_COLUMNS - set(headers)
    if missing:
        raise HTTPException(
            400,
            f"Missing required columns: {', '.join(sorted(missing))}. "
            f"Download the template for the correct format.",
        )

    def get(row_dict: dict, col: str, default="") -> str:
        return str(row_dict.get(col) or "").strip()

    results = []
    created_count = 0
    error_count = 0

    data_rows = rows[1:]  # skip header

    # Pre-validate all rows if strict mode
    if strict:
        pre_errors = []
        for i, row in enumerate(data_rows, start=2):
            row_dict = dict(zip(headers, row))
            username = get(row_dict, "username")
            if not username:
                pre_errors.append(f"Row {i}: username is required")
            if not get(row_dict, "email"):
                pre_errors.append(f"Row {i}: email is required")
            if get(row_dict, "access_level") not in {"HEAD_OFFICE", "REGION", "DISTRICT", "BRANCH"}:
                pre_errors.append(f"Row {i}: invalid access_level")
        if pre_errors:
            raise HTTPException(422, f"Validation errors (strict mode): {'; '.join(pre_errors[:10])}")

    for i, row in enumerate(data_rows, start=2):
        row_dict = dict(zip(headers, row))
        username = get(row_dict, "username")
        full_name = get(row_dict, "full_name")
        email = get(row_dict, "email")
        phone = get(row_dict, "phone") or None
        employee_id = get(row_dict, "employee_id") or None
        access_level = get(row_dict, "access_level").upper() or "BRANCH"
        region_code = get(row_dict, "region_code") or None
        district_code = get(row_dict, "district_code") or None
        branch_code = get(row_dict, "branch_code") or None
        role_name = get(row_dict, "role_name").upper() or "VIEWER"
        password_raw = get(row_dict, "password") or None

        # Skip entirely empty rows
        if not username and not email:
            continue

        row_result = {"row": i, "username": username, "email": email}

        try:
            # Validate required fields
            if not username:
                raise ValueError("username is required")
            if not full_name:
                raise ValueError("full_name is required")
            if not email:
                raise ValueError("email is required")
            if access_level not in {"HEAD_OFFICE", "REGION", "DISTRICT", "BRANCH"}:
                raise ValueError(f"Invalid access_level: {access_level}")

            # Check uniqueness
            if db.query(User).filter(User.username == username).first():
                row_result["status"] = "skipped"
                row_result["reason"] = f"Username '{username}' already exists"
                results.append(row_result)
                continue
            if db.query(User).filter(User.email == email).first():
                row_result["status"] = "skipped"
                row_result["reason"] = f"Email '{email}' already exists"
                results.append(row_result)
                continue
            if employee_id and db.query(User).filter(User.employee_id == employee_id).first():
                row_result["status"] = "skipped"
                row_result["reason"] = f"Employee ID '{employee_id}' already assigned"
                results.append(row_result)
                continue

            # Resolve role
            role = db.query(Role).filter(Role.name == role_name, Role.is_active == True).first()
            if not role:
                raise ValueError(f"Role '{role_name}' not found")

            # Resolve org IDs from codes
            region_id = district_id = branch_id = None
            if region_code:
                reg = db.query(Region).filter(Region.code == region_code).first()
                if not reg:
                    raise ValueError(f"Region code '{region_code}' not found")
                region_id = reg.id
            if district_code:
                dist = db.query(District).filter(District.code == district_code).first()
                if not dist:
                    raise ValueError(f"District code '{district_code}' not found")
                district_id = dist.id
                if region_id and dist.region_id != region_id:
                    raise ValueError(f"District '{district_code}' does not belong to region '{region_code}'")
            if branch_code:
                branch = db.query(Branch).filter(Branch.code == branch_code).first()
                if not branch:
                    raise ValueError(f"Branch code '{branch_code}' not found")
                branch_id = branch.id

            # Validate org completeness
            if access_level in ("REGION", "DISTRICT", "BRANCH") and not region_id:
                raise ValueError(f"{access_level} requires region_code")
            if access_level in ("DISTRICT", "BRANCH") and not district_id:
                raise ValueError(f"{access_level} requires district_code")
            if access_level == "BRANCH" and not branch_id:
                raise ValueError("BRANCH requires branch_code")

            # Generate password if not provided
            import secrets as sec
            final_password = password_raw or (sec.token_urlsafe(10) + "A1!")

            if not dry_run:
                user = User(
                    username=username, full_name=full_name, email=email,
                    phone=phone, password_hash=hash_password(final_password),
                    access_level=access_level, region_id=region_id,
                    district_id=district_id, branch_id=branch_id,
                    employee_id=employee_id, is_active=True,
                    created_by=current_user.id,
                )
                db.add(user)
                db.flush()
                db.add(UserRole(user_id=user.id, role_id=role.id, assigned_by=current_user.id))

            row_result["status"] = "dry_run" if dry_run else "created"
            row_result["role"] = role_name
            row_result["access_level"] = access_level
            if dry_run:
                row_result["note"] = "Would be created"
            else:
                created_count += 1

        except ValueError as e:
            row_result["status"] = "error"
            row_result["reason"] = str(e)
            error_count += 1
            if not dry_run:
                db.rollback()

        results.append(row_result)

    if not dry_run and created_count > 0:
        log_audit_event(
            db, "USER_BULK_IMPORT", current_user.id,
            resource_type="user",
            ip_address=request.client.host if request and request.client else None,
            details={
                "created": created_count,
                "errors": error_count,
                "file": file.filename,
            },
        )
        db.commit()

    return {
        "summary": {
            "total_rows": len(data_rows),
            "created": created_count,
            "skipped": sum(1 for r in results if r.get("status") == "skipped"),
            "errors": error_count,
            "dry_run": dry_run,
        },
        "results": results,
    }
