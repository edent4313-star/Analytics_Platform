import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv; load_dotenv()
from app.database.session import engine
from sqlalchemy import inspect as sa_inspect
insp = sa_inspect(engine)
tables = sorted(insp.get_table_names())
print(f"\nTotal tables: {len(tables)}\n")
for t in tables:
    cols = insp.get_columns(t)
    col_names = [c["name"] for c in cols]
    print(f"  {t}")
    for c in col_names:
        print(f"    - {c}")
    print()
