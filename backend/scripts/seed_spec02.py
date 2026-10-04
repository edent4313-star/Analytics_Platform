"""
Spec 02 seed — positions, departments, mock_ad_users, employee_ids.
Idempotent. Run: python scripts/seed_spec02.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv; load_dotenv()

from app.database.session import SessionLocal
from app.security.password import hash_password
from sqlalchemy import text

db = SessionLocal()

print("Seeding positions...")
POSITIONS = [
    ("SYS_ADMIN",       "System Administrator",      10),
    ("HO_DIRECTOR",     "Head Office Director",       9),
    ("VP_RETAIL",       "VP Retail Banking",          8),
    ("VP_CORPORATE",    "VP Corporate Banking",       8),
    ("VP_DIGITAL",      "VP Digital Banking",         8),
    ("REGIONAL_DIR",    "Regional Director",          7),
    ("DISTRICT_MGR",    "District Manager",           6),
    ("BRANCH_MGR",      "Branch Manager",             5),
    ("SR_ANALYST",      "Senior Analyst",             4),
    ("ANALYST",         "Analyst",                    3),
    ("REL_OFFICER",     "Relationship Officer",       2),
]
for code, name, level in POSITIONS:
    db.execute(text("""
        INSERT INTO positions (code, name, level)
        VALUES (:c, :n, :l)
        ON CONFLICT (code) DO UPDATE SET name=:n, level=:l
    """), {"c": code, "n": name, "l": level})

print("Seeding departments...")
DEPARTMENTS = [
    ("RETAIL",      "Retail Banking"),
    ("CORPORATE",   "Corporate Banking"),
    ("DIGITAL",     "Digital Banking"),
    ("TRADE",       "Trade Finance"),
    ("ANALYTICS",   "Analytics & Data Science"),
    ("CREDIT",      "Credit"),
    ("OPERATIONS",  "Operations"),
    ("IT",          "Information Technology"),
    ("FINANCE",     "Finance"),
    ("HR",          "Human Resources"),
]
for code, name in DEPARTMENTS:
    db.execute(text("""
        INSERT INTO departments (code, name)
        VALUES (:c, :n)
        ON CONFLICT (code) DO UPDATE SET name=:n
    """), {"c": code, "n": name})

db.commit()

print("Seeding mock_ad_users...")
MOCK_AD = [
    # employee_id, password,     full_name,           email,                           dept,      position,       username
    ("CBE001", "Demo@1234", "Abebe Girma",      "abebe.girma@cbe.com.et",       "IT",       "System Administrator",  "admin"),
    ("CBE002", "Demo@1234", "Hiwot Tadesse",    "hiwot.tadesse@cbe.com.et",     "ANALYTICS","Senior Designer",        "designer1"),
    ("CBE003", "Demo@1234", "Bekele Alemu",     "bekele.alemu@cbe.com.et",      "ANALYTICS","Senior Designer",        "designer2"),
    ("CBE006", "Demo@1234", "Sara Mulugeta",    "sara.mulugeta@cbe.com.et",    "ANALYTICS","Senior Designer",        "designer3"),
    ("CBE007", "Demo@1234", "Yonas Tesfaye",    "yonas.tesfaye@cbe.com.et",    "RETAIL",   "Relationship Officer",  "viewer1"),
    ("CBE008", "Demo@1234", "Tigist Alemu",    "tigist.alemu@cbe.com.et",     "RETAIL",   "Relationship Officer",  "viewer2"),
    ("CBE004", "Demo@1234", "Dawit Haile",     "dawit.haile@cbe.com.et",      "RETAIL",   "Relationship Officer",  "viewer3"),
    ("CBE005", "Demo@1234", "Meron Kebede",    "meron.kebede@cbe.com.et",     "RETAIL",   "Relationship Officer",  "viewer4"),
    ("CBE009", "Demo@1234", "Abebe Worku",     "abebe.worku@cbe.com.et",      "RETAIL",   "Relationship Officer",  "viewer5"),
]

for eid, pwd, fname, email, dept, pos, uname in MOCK_AD:
    ph = hash_password(pwd)
    db.execute(text("""
        INSERT INTO mock_ad_users (employee_id, password_hash, full_name, email, department, position_title, note)
        VALUES (:eid, :ph, :fn, :em, :dept, :pos, 'Development test user — not a real CBE employee')
        ON CONFLICT (employee_id) DO UPDATE SET password_hash=:ph, full_name=:fn, email=:em
    """), {"eid": eid, "ph": ph, "fn": fname, "em": email, "dept": dept, "pos": pos})

    # Update employee_id on existing user row if username exists
    # First clear any conflicting employee_ids from other users
    db.execute(text("""
        UPDATE users SET employee_id=NULL WHERE employee_id=:eid AND username!=:uname
    """), {"eid": eid, "uname": uname})
    # Then set the employee_id for the correct user
    db.execute(text("""
        UPDATE users SET employee_id=:eid, ad_provider='mock' WHERE username=:uname
    """), {"eid": eid, "uname": uname})

    print(f"  {eid} -> {uname} ({pos})")

db.commit()

# Seed user_positions
print("Seeding user_positions...")
POSITION_MAP = {
    "CBE001": "SYS_ADMIN", "CBE002": "SR_ANALYST", "CBE003": "SR_ANALYST",
    "CBE006": "SR_ANALYST", "CBE007": "REL_OFFICER", "CBE008": "REL_OFFICER",
    "CBE004": "REL_OFFICER", "CBE005": "REL_OFFICER", "CBE009": "REL_OFFICER",
}
for eid, pos_code in POSITION_MAP.items():
    db.execute(text("""
        INSERT INTO user_positions (user_id, position_id, is_primary)
        SELECT u.id, p.id, TRUE
        FROM users u, positions p
        WHERE u.employee_id = :eid AND p.code = :pc
        ON CONFLICT DO NOTHING
    """), {"eid": eid, "pc": pos_code})

db.commit()
print("Spec 02 seed complete.")
print("\nMock AD demo users (password: Demo@1234):")
for eid, _, fn, _, dept, pos, uname in MOCK_AD:
    print(f"  {eid}  {fn:<20} {pos:<25} ({uname})")
db.close()
