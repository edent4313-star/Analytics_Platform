"""
Seed FCY Lead demo analytical data.
Creates fcy_lead_results table with fictional data (NOT real customer data).
Also builds the full FCY Lead Dashboard with all widgets configured.
Run: python scripts/seed_fcy_demo.py
"""
import sys, os, random
from datetime import date, timedelta
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv; load_dotenv()

from app.database.session import SessionLocal, engine
from sqlalchemy import text

db = SessionLocal()

print("Creating fcy_lead_results table...")
with engine.connect() as conn:
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS fcy_lead_results (
            id SERIAL PRIMARY KEY,
            customer_id VARCHAR(20) NOT NULL,
            region_id INTEGER,
            district_id INTEGER,
            branch_id INTEGER,
            lead_date DATE,
            lead_type VARCHAR(50),
            status VARCHAR(30),
            is_converted BOOLEAN DEFAULT FALSE,
            fcy_amount NUMERIC(18,2),
            lead_score NUMERIC(5,2),
            currency_type VARCHAR(10),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    conn.execute(text("TRUNCATE TABLE fcy_lead_results"))

    # Generate fictional demo data
    LEAD_TYPES = ['IMPORT', 'EXPORT', 'REMITTANCE', 'TRADE_FINANCE', 'FX_SWAP']
    STATUSES = ['NEW', 'IN_PROGRESS', 'CONVERTED', 'LOST', 'FOLLOW_UP']
    CURRENCIES = ['USD', 'EUR', 'GBP', 'AED', 'SAR']

    # Org mapping: region_id, district_id, branch_id from seed data
    ORG_UNITS = [
        (1, 1, 1), (1, 1, 2), (1, 2, 3), (1, 2, 4), (1, 3, 5),
        (2, 4, 6), (2, 4, 7), (2, 5, 8), (3, 6, 9), (3, 7, 10),
    ]

    rows = []
    today = date.today()
    for i in range(1, 1001):
        org = random.choice(ORG_UNITS)
        ld = today - timedelta(days=random.randint(0, 365))
        lt = random.choice(LEAD_TYPES)
        st = random.choice(STATUSES)
        converted = st == 'CONVERTED'
        amount = round(random.uniform(5000, 500000), 2) if converted else round(random.uniform(0, 100000), 2)
        score = round(random.uniform(20, 100), 2)
        cid = f"C{str(i).zfill(6)}"
        rows.append(f"('{cid}', {org[0]}, {org[1]}, {org[2]}, '{ld}', '{lt}', '{st}', {str(converted).lower()}, {amount}, {score}, '{random.choice(CURRENCIES)}')")

    chunk = ",\n".join(rows)
    conn.execute(text(f"""
        INSERT INTO fcy_lead_results
            (customer_id, region_id, district_id, branch_id, lead_date, lead_type,
             status, is_converted, fcy_amount, lead_score, currency_type)
        VALUES {chunk}
    """))
    conn.commit()
print("1000 demo FCY lead records inserted.")

# Now build the full FCY dashboard with widgets
from app.models.dashboard import Dashboard, DashboardVersion, DashboardWidget, DashboardFilter

dashboard = db.query(Dashboard).filter_by(code="fcy-lead").first()
if dashboard:
    # Get or create version
    version = db.query(DashboardVersion).filter_by(dashboard_id=dashboard.id, status="PUBLISHED").first()
    if not version:
        version = db.query(DashboardVersion).filter_by(dashboard_id=dashboard.id).order_by(DashboardVersion.version_number.desc()).first()
    if not version:
        from app.models.user import User
        admin = db.query(User).filter_by(username="admin").first()
        version = DashboardVersion(dashboard_id=dashboard.id, version_number=1, status="DRAFT",
                                   created_by=admin.id if admin else None, layout_config=[])
        db.add(version); db.flush()

    from app.models.dataset import Dataset
    fcy_ds = db.query(Dataset).filter_by(name="FCY Lead Results").first()
    ds_id = fcy_ds.id if fcy_ds else None

    # Clear existing widgets
    from sqlalchemy import delete
    from app.models.dashboard import DashboardWidget, DashboardFilter
    db.query(DashboardWidget).filter_by(version_id=version.id).delete()
    db.query(DashboardFilter).filter_by(version_id=version.id).delete()

    widgets = [
        # KPIs row
        dict(widget_type="KPI", title="Total Leads", position_x=0, position_y=0, width=3, height=2, sort_order=1,
             config_json={"field": "customer_id", "aggregation": "COUNT", "number_format": "number"}),
        dict(widget_type="KPI", title="Converted Leads", position_x=3, position_y=0, width=3, height=2, sort_order=2,
             config_json={"field": "customer_id", "aggregation": "COUNT", "number_format": "number",
                          "filter_field": "is_converted", "filter_value": True}),
        dict(widget_type="KPI", title="Total FCY Amount", position_x=6, position_y=0, width=3, height=2, sort_order=3,
             config_json={"field": "fcy_amount", "aggregation": "SUM", "number_format": "currency", "decimal_precision": 2}),
        dict(widget_type="KPI", title="Avg Lead Score", position_x=9, position_y=0, width=3, height=2, sort_order=4,
             config_json={"field": "lead_score", "aggregation": "AVG", "number_format": "number", "decimal_precision": 1}),
        # Charts
        dict(widget_type="BAR_CHART", title="Leads by Lead Type", position_x=0, position_y=2, width=6, height=4, sort_order=5,
             config_json={"dimension": "lead_type", "metric": "customer_id", "aggregation": "COUNT", "sort_order": "DESC"}),
        dict(widget_type="PIE_CHART", title="Leads by Status", position_x=6, position_y=2, width=6, height=4, sort_order=6,
             config_json={"dimension": "status", "metric": "customer_id", "aggregation": "COUNT"}),
        dict(widget_type="BAR_CHART", title="Leads by Region", position_x=0, position_y=6, width=12, height=4, sort_order=7,
             config_json={"dimension": "region_id", "metric": "customer_id", "aggregation": "COUNT", "sort_order": "DESC"}),
        # Table
        dict(widget_type="TABLE", title="Customer Lead Details", position_x=0, position_y=10, width=12, height=5, sort_order=8,
             config_json={"columns": [
                 {"field": "customer_id", "display_name": "Customer ID"},
                 {"field": "lead_type", "display_name": "Lead Type"},
                 {"field": "status", "display_name": "Status"},
                 {"field": "is_converted", "display_name": "Converted"},
                 {"field": "fcy_amount", "display_name": "FCY Amount"},
                 {"field": "lead_score", "display_name": "Lead Score"},
                 {"field": "currency_type", "display_name": "Currency"},
             ], "enable_search": True, "enable_sort": True, "enable_export": True, "page_size": 25}),
    ]

    for w in widgets:
        db.add(DashboardWidget(version_id=version.id, dataset_id=ds_id, **w))

    # Filters
    filters = [
        dict(filter_type="REGION", field_name="region_id", display_name="Region", is_global=True, sort_order=1),
        dict(filter_type="DISTRICT", field_name="district_id", display_name="District", is_global=True, sort_order=2),
        dict(filter_type="BRANCH", field_name="branch_id", display_name="Branch", is_global=True, sort_order=3),
        dict(filter_type="DATE_RANGE", field_name="lead_date", display_name="Date Range", is_global=True, sort_order=4),
        dict(filter_type="CATEGORY", field_name="lead_type", display_name="Lead Type", is_global=True, sort_order=5),
        dict(filter_type="STATUS", field_name="status", display_name="Status", is_global=True, sort_order=6),
    ]
    for f in filters:
        db.add(DashboardFilter(version_id=version.id, **f))

    version.status = "PUBLISHED"
    version.layout_config = [
        {"i": str(i+1), "x": w["position_x"], "y": w["position_y"], "w": w["width"], "h": w["height"]}
        for i, w in enumerate(widgets)
    ]

    db.commit()
    print("FCY Lead Dashboard widgets and filters configured.")
else:
    print("FCY Lead Dashboard not found — run seed_data.py first.")

db.close()
print("Done.")
