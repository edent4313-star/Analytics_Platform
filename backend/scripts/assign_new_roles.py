"""
Assign SYSTEM_ADMIN / DESIGNER / VIEWER roles to appropriate existing demo users.
Run after seed_roles_update.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv; load_dotenv()
from app.database.session import SessionLocal
from app.models.role import Role, UserRole
from app.models.user import User

db = SessionLocal()

def get_role(name): return db.query(Role).filter_by(name=name).first()
def get_user(username): return db.query(User).filter_by(username=username).first()

def set_role(username, role_name):
    user = get_user(username)
    role = get_role(role_name)
    if not user or not role:
        print(f"  SKIP: {username} or {role_name} not found")
        return
    # Replace existing roles with new role
    db.query(UserRole).filter_by(user_id=user.id).delete()
    db.add(UserRole(user_id=user.id, role_id=role.id))
    print(f"  {username} → {role_name}")

print("Assigning roles to demo users...")

# SYSTEM_ADMIN: sysadmin (already done in seed_roles_update.py), admin
set_role("admin",        "SYSTEM_ADMIN")

# DESIGNER: analyst (can create dashboards)
set_role("analyst",      "DESIGNER")

# VIEWER: viewer, branch_mgr2
set_role("viewer",       "VIEWER")

# Keep existing roles for organizational users (region_mgr, district_mgr, branch_mgr)
# They keep REGIONAL_MANAGER, DISTRICT_MANAGER, BRANCH_MANAGER for org-scope demo
# CBE003 (region_mgr / Bekele) → DESIGNER (to demo the designer role)
set_role("region_mgr",   "DESIGNER")

db.commit()

print("\nFinal user → role mapping:")
for u in db.query(User).filter_by(is_active=True).order_by(User.username).all():
    role = u.primary_role_name or "—"
    print(f"  {u.username:<20} {u.employee_id or '':<12} → {role}")

db.close()
print("\nDone.")
