"""
Database setup script.
Creates the analytics_platform database and analytics_user.

Usage:
    python scripts/setup_database.py --pg-password YOUR_POSTGRES_PASSWORD

The script is idempotent — safe to run multiple times.
"""
import argparse
import sys
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT


def setup_database(pg_password: str, pg_host: str = "localhost", pg_port: int = 5432):
    app_user = "analytics_user"
    app_password = "analytics_pass"
    app_db = "analytics_platform"

    print(f"Connecting to PostgreSQL at {pg_host}:{pg_port} as postgres...")

    # Connect to the default postgres database as superuser
    try:
        conn = psycopg2.connect(
            host=pg_host,
            port=pg_port,
            dbname="postgres",
            user="postgres",
            password=pg_password,
        )
    except psycopg2.OperationalError as e:
        print(f"ERROR: Could not connect to PostgreSQL: {e}")
        sys.exit(1)

    conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
    cur = conn.cursor()

    # Create user
    cur.execute("SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = %s", (app_user,))
    if cur.fetchone():
        print(f"User '{app_user}' already exists — skipping creation.")
    else:
        cur.execute(
            sql.SQL("CREATE USER {} WITH PASSWORD %s").format(sql.Identifier(app_user)),
            (app_password,),
        )
        print(f"User '{app_user}' created.")

    # Create database
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (app_db,))
    if cur.fetchone():
        print(f"Database '{app_db}' already exists — skipping creation.")
    else:
        cur.execute(
            sql.SQL("CREATE DATABASE {} OWNER {}").format(
                sql.Identifier(app_db), sql.Identifier(app_user)
            )
        )
        print(f"Database '{app_db}' created.")

    # Grant privileges
    cur.execute(
        sql.SQL("GRANT ALL PRIVILEGES ON DATABASE {} TO {}").format(
            sql.Identifier(app_db), sql.Identifier(app_user)
        )
    )
    print(f"Privileges granted to '{app_user}'.")

    cur.close()
    conn.close()

    # Verify the analytics_user can connect
    print(f"\nVerifying analytics_user can connect to {app_db}...")
    try:
        test_conn = psycopg2.connect(
            host=pg_host,
            port=pg_port,
            dbname=app_db,
            user=app_user,
            password=app_password,
        )
        test_conn.close()
        print(f"Connection verified: analytics_user -> {app_db}")
    except psycopg2.OperationalError as e:
        print(f"WARNING: Could not verify analytics_user connection: {e}")
        print("You may need to adjust pg_hba.conf if scram-sha-256 auth fails.")

    print("\nDatabase setup complete.")
    print(f"  Database URL: postgresql://{app_user}:{app_password}@{pg_host}:{pg_port}/{app_db}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Set up the analytics_platform database")
    parser.add_argument("--pg-password", required=True, help="PostgreSQL superuser (postgres) password")
    parser.add_argument("--pg-host", default="localhost", help="PostgreSQL host (default: localhost)")
    parser.add_argument("--pg-port", type=int, default=5432, help="PostgreSQL port (default: 5432)")
    args = parser.parse_args()

    setup_database(
        pg_password=args.pg_password,
        pg_host=args.pg_host,
        pg_port=args.pg_port,
    )
