"""
Update seed: adjust roles to SYSTEM_ADMIN, VIEWER, DESIGNER
and create admin test user.

Run: python scripts/seed_roles_update.py
Idempotent — safe to run multiple times.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv; load_dotenv()

from app.database.session import SessionLocal
from app.security.password import hash_password
from app.models.permission import Permission
from app.models.role import Role, UserRole, RolePermission
from app.models.user import User

db = SessionLocal()

def upsert(model, lookup, defaults):
    obj = db.query(model).filter_by(**lookup).first()
    if obj:
        return obj, False
    obj = model(**{**lookup, **defaults})
    db.add(obj); db.flush()
    return obj, True

# ── Step 1: Ensure SYSTEM_ADMIN, VIEWER, DESIGNER roles exist ────────────────

print("Updating roles...")

NEW_ROLES = [
    # code,            display_name,       description,                              is_system
    ("SYSTEM_ADMIN",   "System Admin",     "Full system administration access",      True),
    ("DESIGNER",       "Designer",         "Can create and publish dashboards",      True),
    ("VIEWER",         "Viewer",           "Read-only dashboard access",             True),
]

roles = {}
for name, display, desc, is_sys in NEW_ROLES:
    r, created = upsert(Role, {"name": name},
                        {"display_name": display, "description": desc,
                         "is_system": is_sys, "is_active": True})
    roles[name] = r
    status = "created" if created else "already exists"
    print(f"  {status}: {name}")

db.flush()

# ── Step 2: Assign permissions to new roles ───────────────────────────────────

print("\nAssigning permissions to roles...")

all_perms = {p.code: p for p in db.query(Permission).filter_by(is_active=True).all()}

ROLE_PERMISSIONS = {
    "SYSTEM_ADMIN": list(all_perms.keys()),  # all permissions
    "DESIGNER": [
        "dashboard.view", "dashboard.create", "dashboard.edit",
        "dashboard.publish", "dashboard.export",
        "dataset.view", "datasource.view",
    ],
    "VIEWER": [
        "dashboard.view",
    ],
}

for role_name, perm_codes in ROLE_PERMISSIONS.items():
    role = roles[role_name]
    # Remove existing permissions for this role first
    db.query(RolePermission).filter_by(role_id=role.id).delete()
    db.flush()
    # Add new permissions
    added = 0
    for code in perm_codes:
        perm = all_perms.get(code)
        if perm:
            db.add(RolePermission(role_id=role.id, permission_id=perm.id))
            added += 1
    print(f"  {role_name}: {added} permissions assigned")

db.flush()

# ── Step 3: Create admin test user ────────────────────────────────────────────

print("\nCreating admin test user...")

ADMIN_USER = {
    "username":      "sysadmin",
    "full_name":     "System Admin Test",
    "email":         "sysadmin@cbe.com.et",
    "password":      "SysAdmin@1234",
    "access_level":  "HEAD_OFFICE",
    "employee_id":   "CBE_ADMIN",
    "is_active":     True,
}

# Check if user already exists
existing = db.query(User).filter_by(username=ADMIN_USER["username"]).first()
if existing:
    # Update password in case it changed
    existing.password_hash = hash_password(ADMIN_USER["password"])
    existing.employee_id = ADMIN_USER["employee_id"]
    user = existing
    print(f"  Updated existing user: {ADMIN_USER['username']}")
else:
    user = User(
        username=ADMIN_USER["username"],
        full_name=ADMIN_USER["full_name"],
        email=ADMIN_USER["email"],
        password_hash=hash_password(ADMIN_USER["password"]),
        access_level=ADMIN_USER["access_level"],
        employee_id=ADMIN_USER["employee_id"],
        is_active=True,
    )
    db.add(user)
    db.flush()
    print(f"  Created user: {ADMIN_USER['username']}")

# Assign SYSTEM_ADMIN role to this user
existing_role = db.query(UserRole).filter_by(
    user_id=user.id, role_id=roles["SYSTEM_ADMIN"].id
).first()
if not existing_role:
    db.add(UserRole(user_id=user.id, role_id=roles["SYSTEM_ADMIN"].id))
    print(f"  Assigned SYSTEM_ADMIN role")
else:
    print(f"  SYSTEM_ADMIN role already assigned")

# Also update mock_ad_users for this user
from sqlalchemy import text
db.execute(text("""
    INSERT INTO mock_ad_users (employee_id, password_hash, full_name, email, department, position_title, note)
    VALUES (:eid, :ph, :fn, :em, 'IT', 'System Administrator', 'Admin test user')
    ON CONFLICT (employee_id) DO UPDATE
    SET password_hash = :ph, full_name = :fn
"""), {
    "eid": ADMIN_USER["employee_id"],
    "ph":  hash_password(ADMIN_USER["password"]),
    "fn":  ADMIN_USER["full_name"],
    "em":  ADMIN_USER["email"],
})

db.commit()

# ── Summary ───────────────────────────────────────────────────────────────────

print("\n" + "="*55)
print("DONE")
print("="*55)
print("\nRoles available:")
for r in db.query(Role).filter_by(is_active=True).order_by(Role.name).all():
    perm_count = db.query(RolePermission).filter_by(role_id=r.id).count()
    print(f"  {r.name:<25} ({perm_count} permissions)  {'[system]' if r.is_system else ''}")

print("\nAdmin test user:")
print(f"  Username:    sysadmin        (legacy login)")
print(f"  Employee ID: CBE_ADMIN       (mock AD login)")
print(f"  Password:    SysAdmin@1234")
print(f"  Role:        SYSTEM_ADMIN")
print(f"  Scope:       HEAD_OFFICE (sees all data)")
print(f"\nAdmin page URL: http://localhost:5173/admin")
print(f"API docs:       http://localhost:8000/api/docs")

db.close()
