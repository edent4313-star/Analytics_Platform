"""
Spec 02 — Authentication & Authorization migration.
Adds new tables and columns. Safe to run on existing database (idempotent).
Run: python scripts/migrate_spec02.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv; load_dotenv()
from app.database.session import engine
from sqlalchemy import text

DDL = [
    # Extend users table
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS ad_provider VARCHAR(20) DEFAULT 'mock'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ad_sync TIMESTAMPTZ",
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_employee_id ON users(employee_id) WHERE employee_id IS NOT NULL",

    # Positions
    """CREATE TABLE IF NOT EXISTS positions (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        level INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )""",

    # Departments
    """CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
    )""",

    # User → position mapping
    """CREATE TABLE IF NOT EXISTS user_positions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        position_id INTEGER REFERENCES positions(id),
        is_primary BOOLEAN DEFAULT TRUE,
        assigned_at TIMESTAMPTZ DEFAULT NOW()
    )""",

    # User → department scope
    """CREATE TABLE IF NOT EXISTS user_department_scope (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        department_id INTEGER REFERENCES departments(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
    )""",

    # Mock AD users (development only)
    """CREATE TABLE IF NOT EXISTS mock_ad_users (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255),
        email VARCHAR(255),
        department VARCHAR(100),
        position_title VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        note VARCHAR(255)
    )""",

    # AD user mapping (production)
    """CREATE TABLE IF NOT EXISTS ad_user_mapping (
        id SERIAL PRIMARY KEY,
        employee_id VARCHAR(50) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id),
        provider VARCHAR(20) DEFAULT 'cbe_ad',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ
    )""",

    # Authentication sessions audit
    """CREATE TABLE IF NOT EXISTS authentication_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        employee_id VARCHAR(50),
        provider VARCHAR(20),
        ip_address VARCHAR(45),
        user_agent VARCHAR(500),
        issued_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        revoke_reason VARCHAR(100)
    )""",

    # Indexes
    "CREATE INDEX IF NOT EXISTS ix_mock_ad_users_employee_id ON mock_ad_users(employee_id)",
    "CREATE INDEX IF NOT EXISTS ix_auth_sessions_user_id ON authentication_sessions(user_id)",
    "CREATE INDEX IF NOT EXISTS ix_auth_sessions_issued_at ON authentication_sessions(issued_at)",
]

with engine.connect() as conn:
    for stmt in DDL:
        conn.execute(text(stmt))
    conn.commit()

print("Spec 02 migration complete.")
