"""
Demo seed data for the Enterprise Analytics Platform.
Creates all roles, permissions, demo org hierarchy, users, and dashboard stubs.

Usage (from backend/ directory):
    python scripts/seed_data.py

Idempotent — safe to run multiple times.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app.database.session import SessionLocal
from app.security.password import hash_password
from app.models.permission import Permission
from app.models.role import Role, UserRole, RolePermission
from app.models.user import User
from app.models.organization import Region, District, Branch
from app.models.dashboard import Dashboard, DashboardVersion, DashboardPermission
from app.models.data_source import DataSource
from app.models.dataset import Dataset, DatasetField

db = SessionLocal()

def upsert(model_class, lookup: dict, defaults: dict):
    """Get or create a record. Returns (instance, created)."""
    obj = db.query(model_class).filter_by(**lookup).first()
    if obj:
        return obj, False
    obj = model_class(**{**lookup, **defaults})
    db.add(obj)
    db.flush()
    return obj, True

print("Seeding permissions...")
PERMISSION_DEFS = [
    # Dashboard
    ("dashboard.view",    "View Dashboards",        "Can view published dashboards",          "Dashboard"),
    ("dashboard.create",  "Create Dashboards",      "Can create new dashboards",              "Dashboard"),
    ("dashboard.edit",    "Edit Dashboards",         "Can edit dashboard configurations",      "Dashboard"),
    ("dashboard.delete",  "Delete Dashboards",       "Can delete dashboards",                  "Dashboard"),
    ("dashboard.publish", "Publish Dashboards",      "Can approve and publish dashboards",     "Dashboard"),
    ("dashboard.export",  "Export Dashboard Data",   "Can export dashboard data",              "Dashboard"),
    # Users
    ("user.view",         "View Users",              "Can view user list and details",         "Users"),
    ("user.create",       "Create Users",            "Can create new user accounts",           "Users"),
    ("user.update",       "Update Users",            "Can update user details",                "Users"),
    ("user.disable",      "Disable Users",           "Can activate/deactivate users",          "Users"),
    # Roles
    ("role.view",         "View Roles",              "Can view role definitions",              "Roles"),
    ("role.manage",       "Manage Roles",            "Can create and modify roles",            "Roles"),
    # Permissions
    ("permission.view",   "View Permissions",        "Can view permission definitions",        "Permissions"),
    ("permission.manage", "Manage Permissions",      "Can assign permissions to roles",        "Permissions"),
    # Data Sources
    ("datasource.view",   "View Data Sources",       "Can view data source configurations",   "DataSources"),
    ("datasource.create", "Create Data Sources",     "Can add new data sources",              "DataSources"),
    ("datasource.edit",   "Edit Data Sources",       "Can edit data source configurations",   "DataSources"),
    ("datasource.delete", "Delete Data Sources",     "Can remove data sources",               "DataSources"),
    # Datasets
    ("dataset.view",      "View Datasets",           "Can view registered datasets",          "Datasets"),
    ("dataset.manage",    "Manage Datasets",         "Can create and edit datasets",          "Datasets"),
    # Audit
    ("audit.view",        "View Audit Logs",         "Can view system audit logs",            "Audit"),
]
perms = {}
for code, name, desc, cat in PERMISSION_DEFS:
    p, created = upsert(Permission, {"code": code}, {"name": name, "description": desc, "category": cat, "is_active": True})
    perms[code] = p
    if created: print(f"  + Permission: {code}")
db.flush()

print("Seeding roles...")
ROLE_DEFS = [
    ("SYSTEM_ADMIN",  "System Administrator",  "Full system access", True),
    ("DESIGNER",      "Designer",              "Can create and edit dashboards", True),
    ("VIEWER",        "Viewer",                "Read-only dashboard access", True),
]
roles = {}
for name, display, desc, is_sys in ROLE_DEFS:
    r, created = upsert(Role, {"name": name}, {"display_name": display, "description": desc, "is_system": is_sys, "is_active": True})
    roles[name] = r
    if created: print(f"  + Role: {name}")
db.flush()

print("Seeding role permissions...")
ROLE_PERMISSIONS = {
    "SYSTEM_ADMIN": list(perms.keys()),  # all permissions
    "DESIGNER":     ["dashboard.view","dashboard.create","dashboard.edit","dashboard.publish","dashboard.export","dataset.view","dataset.manage","datasource.view","datasource.create","datasource.edit"],
    "VIEWER":       ["dashboard.view"],
}
for role_name, perm_codes in ROLE_PERMISSIONS.items():
    role = roles[role_name]
    for code in perm_codes:
        perm = perms[code]
        existing = db.query(RolePermission).filter_by(role_id=role.id, permission_id=perm.id).first()
        if not existing:
            db.add(RolePermission(role_id=role.id, permission_id=perm.id))
db.flush()

print("Seeding organization hierarchy...")
# Regions
reg_data = [
    ("R01", "Addis Ababa Region"),
    ("R02", "Oromia Region"),
    ("R03", "Amhara Region"),
]
regions = {}
for code, name in reg_data:
    r, created = upsert(Region, {"code": code}, {"name": name, "status": "ACTIVE"})
    regions[code] = r
    if created: print(f"  + Region: {name}")
db.flush()

# Districts
dist_data = [
    ("D01", "Bole District",        "R01"),
    ("D02", "Kirkos District",      "R01"),
    ("D03", "Yeka District",        "R01"),
    ("D04", "Adama District",       "R02"),
    ("D05", "Jimma District",       "R02"),
    ("D06", "Bahir Dar District",   "R03"),
    ("D07", "Gondar District",      "R03"),
]
districts = {}
for code, name, reg_code in dist_data:
    d, created = upsert(District, {"code": code}, {"name": name, "region_id": regions[reg_code].id, "status": "ACTIVE"})
    districts[code] = d
    if created: print(f"  + District: {name}")
db.flush()

# Branches
branch_data = [
    ("B001", "Bole Main Branch",     "R01", "D01"),
    ("B002", "Bole Airport Branch",  "R01", "D01"),
    ("B003", "Kirkos Branch",        "R01", "D02"),
    ("B004", "Mexico Branch",        "R01", "D02"),
    ("B005", "Yeka Branch",          "R01", "D03"),
    ("B006", "Adama Main Branch",    "R02", "D04"),
    ("B007", "Adama East Branch",    "R02", "D04"),
    ("B008", "Jimma Branch",         "R02", "D05"),
    ("B009", "Bahir Dar Branch",     "R03", "D06"),
    ("B010", "Gondar Branch",        "R03", "D07"),
]
branches = {}
for code, name, reg_code, dist_code in branch_data:
    b, created = upsert(Branch, {"code": code}, {
        "name": name,
        "region_id": regions[reg_code].id,
        "district_id": districts[dist_code].id,
        "status": "ACTIVE"
    })
    branches[code] = b
    if created: print(f"  + Branch: {name}")
db.flush()

print("Seeding demo users...")
USER_DEFS = [
    # (username, full_name, email, password, access_level, region, district, branch, role)
    ("admin",        "System Administrator",    "admin@analytics.internal",           "Admin@1234",  "HEAD_OFFICE", None,  None,  None,  "SYSTEM_ADMIN"),
    ("designer1",   "Hiwot Tadesse",           "designer1@analytics.internal",       "Pass@1234",   "HEAD_OFFICE", None,  None,  None,  "DESIGNER"),
    ("designer2",   "Bekele Girma",            "designer2@analytics.internal",      "Pass@1234",   "REGION",      "R01", None,  None,  "DESIGNER"),
    ("designer3",   "Sara Mulugeta",           "designer3@analytics.internal",       "Pass@1234",   "HEAD_OFFICE", None,  None,  None,  "DESIGNER"),
    ("viewer1",     "Abebe Worku",             "viewer1@analytics.internal",         "Pass@1234",   "BRANCH",      "R01", "D01", "B001","VIEWER"),
    ("viewer2",     "Tigist Alemu",            "viewer2@analytics.internal",        "Pass@1234",   "REGION",      "R02", None,  None,  "VIEWER"),
    ("viewer3",     "Dawit Haile",             "viewer3@analytics.internal",        "Pass@1234",   "DISTRICT",    "R01", "D01", None,  "VIEWER"),
    ("viewer4",     "Meron Kebede",            "viewer4@analytics.internal",        "Pass@1234",   "BRANCH",      "R01", "D01", "B002","VIEWER"),
    ("viewer5",     "Yonas Tesfaye",           "viewer5@analytics.internal",        "Pass@1234",   "BRANCH",      "R01", "D01", "B001","VIEWER"),
]
users = {}
for uname, fname, email, pwd, access, reg, dist, branch, role_name in USER_DEFS:
    region_id   = regions[reg].id   if reg    else None
    district_id = districts[dist].id if dist  else None
    branch_id   = branches[branch].id if branch else None

    u, created = upsert(User, {"username": uname}, {
        "full_name": fname,
        "email": email,
        "password_hash": hash_password(pwd),
        "access_level": access,
        "region_id": region_id,
        "district_id": district_id,
        "branch_id": branch_id,
        "is_active": True,
    })
    users[uname] = u
    if created: print(f"  + User: {uname} ({role_name})")

    # Assign role
    role = roles[role_name]
    existing_ur = db.query(UserRole).filter_by(user_id=u.id, role_id=role.id).first()
    if not existing_ur:
        db.add(UserRole(user_id=u.id, role_id=role.id))
db.flush()

print("Seeding demo data source (PostgreSQL — application DB as demo analytical source)...")
ds, created = upsert(DataSource, {"name": "Analytics Application DB"}, {
    "source_type": "POSTGRESQL",
    "description": "Demo analytical data source using the application database",
    "host": "localhost",
    "port": 5432,
    "database_name": "analytics_platform",
    "schema_name": "public",
    "is_active": True,
    "created_by": users["admin"].id,
})
if created: print("  + DataSource: Analytics Application DB")
db.flush()

print("Seeding FCY Lead dataset...")
fcy_ds, created = upsert(Dataset, {"name": "FCY Lead Results"}, {
    "description": "FCY Lead Generation analysis results",
    "source_id": ds.id,
    "schema_name": "public",
    "object_name": "fcy_lead_results",
    "region_column": "region_id",
    "district_column": "district_id",
    "branch_column": "branch_id",
    "status": "ACTIVE",
    "created_by": users["admin"].id,
})
if created:
    print("  + Dataset: FCY Lead Results")
    fcy_fields = [
        ("customer_id",          "Customer ID",          "ID",       "IDENTIFIER", False, False, None,              0),
        ("region_id",            "Region ID",            "ID",       "IDENTIFIER", True,  False, None,              1),
        ("district_id",          "District ID",          "ID",       "IDENTIFIER", True,  False, None,              2),
        ("branch_id",            "Branch ID",            "ID",       "IDENTIFIER", True,  False, None,              3),
        ("lead_date",            "Lead Date",            "DATE",     "DATE",        True,  False, None,              4),
        ("lead_type",            "Lead Type",            "CATEGORY", "DIMENSION",   True,  False, None,              5),
        ("status",               "Status",               "CATEGORY", "DIMENSION",   True,  False, None,              6),
        ("is_converted",         "Is Converted",         "BOOLEAN",  "DIMENSION",   True,  False, None,              7),
        ("fcy_amount",           "FCY Amount",           "NUMERIC",  "METRIC",      False, True,  "SUM,AVG,MIN,MAX", 8),
        ("lead_score",           "Lead Score",           "NUMERIC",  "METRIC",      False, True,  "AVG,MIN,MAX",     9),
    ]
    for fn, dn, dt, cat, filt, agg, allowed_agg, sort in fcy_fields:
        db.add(DatasetField(
            dataset_id=fcy_ds.id, field_name=fn, display_name=dn,
            data_type=dt, field_category=cat, is_filterable=filt,
            is_aggregatable=agg, allowed_aggregations=allowed_agg, sort_order=sort
        ))
db.flush()

print("Seeding FCY Lead Dashboard...")
fcy_dash, created = upsert(Dashboard, {"code": "fcy-lead"}, {
    "name": "FCY Lead Dashboard",
    "description": "Foreign Currency Lead Generation performance dashboard",
    "owner_id": users["designer1"].id,
    "created_by": users["admin"].id,
    "is_active": True,
})
if created:
    print("  + Dashboard: FCY Lead Dashboard")
    # Create a published version stub (Phase 8 will fill in full widget configs)
    ver = DashboardVersion(
        dashboard_id=fcy_dash.id,
        version_number=1,
        status="PUBLISHED",
        layout_config=[],
        created_by=users["admin"].id,
    )
    db.add(ver)
    db.flush()

    # Grant access to relevant roles
    for role_name in ["SYSTEM_ADMIN", "DESIGNER", "VIEWER"]:
        db.add(DashboardPermission(
            dashboard_id=fcy_dash.id,
            role_id=roles[role_name].id,
            can_view=True,
            can_export=(role_name in ["SYSTEM_ADMIN", "DESIGNER"]),
            granted_by=users["admin"].id,
        ))
db.flush()

# Seed additional placeholder dashboards
other_dashboards = [
    ("customer-segmentation", "Customer Segmentation",     "Customer segmentation analysis dashboard"),
    ("profitability",         "Customer Profitability",     "Customer and branch profitability dashboard"),
    ("deposit-attrition",     "Deposit Attrition",          "Deposit attrition prediction dashboard"),
    ("branch-performance",    "Branch Performance",         "Branch-level performance metrics"),
]
for code, name, desc in other_dashboards:
    d, created = upsert(Dashboard, {"code": code}, {
        "name": name, "description": desc,
        "owner_id": users["designer1"].id,
        "created_by": users["admin"].id,
        "is_active": True,
    })
    if created:
        print(f"  + Dashboard: {name}")
        ver = DashboardVersion(
            dashboard_id=d.id, version_number=1, status="DRAFT",
            layout_config=[], created_by=users["admin"].id,
        )
        db.add(ver)
        db.flush()
        for role_name in ["SYSTEM_ADMIN", "DESIGNER"]:
            db.add(DashboardPermission(
                dashboard_id=d.id, role_id=roles[role_name].id,
                can_view=True, can_export=True, granted_by=users["admin"].id,
            ))
db.flush()

db.commit()
print("\nSeed data complete.")
print("\nNOTE: After running seed_spec02.py, use password 'Demo@1234' for all users.")
print("\nDemo login credentials (username or employee_id):")
print("  admin  / CBE001  - Demo@1234  (SYSTEM_ADMIN, HEAD_OFFICE)")
print("  designer1  / CBE002  - Demo@1234  (DESIGNER, HEAD_OFFICE)")
print("  designer2  / CBE003  - Demo@1234  (DESIGNER, REGION)")
print("  designer3  / CBE006  - Demo@1234  (DESIGNER, HEAD_OFFICE)")
print("  viewer1  / CBE007  - Demo@1234  (VIEWER, BRANCH)")
print("  viewer2  / CBE008  - Demo@1234  (VIEWER, REGION)")
print("  viewer3  / CBE004  - Demo@1234  (VIEWER, DISTRICT)")
print("  viewer4  / CBE005  - Demo@1234  (VIEWER, BRANCH)")
print("  viewer5  / CBE009  - Demo@1234  (VIEWER, BRANCH)")
db.close()
