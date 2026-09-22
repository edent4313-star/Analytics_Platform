import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv()
from app.database.session import engine
from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0 NOT NULL'))
    conn.execute(text('ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ'))
    conn.commit()
print('Auth columns added successfully')
