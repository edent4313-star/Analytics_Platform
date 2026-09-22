-- Create application database and user
-- Run as the postgres superuser:
--   psql -U postgres -f scripts/create_db.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_catalog.pg_roles WHERE rolname = 'analytics_user'
  ) THEN
    CREATE USER analytics_user WITH PASSWORD 'analytics_pass';
    RAISE NOTICE 'User analytics_user created.';
  ELSE
    RAISE NOTICE 'User analytics_user already exists.';
  END IF;
END
$$;

-- Create database if it does not exist (cannot use IF NOT EXISTS in older PG,
-- but PG 18 supports it for CREATE DATABASE too)
SELECT 'CREATE DATABASE analytics_platform OWNER analytics_user'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'analytics_platform'
)\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE analytics_platform TO analytics_user;

\echo 'Database setup complete.'
