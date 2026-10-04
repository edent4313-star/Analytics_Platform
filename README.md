# Enterprise Analytics Platform

A production-ready, reusable internal Enterprise Analytics Dashboard Platform.

## Overview

This platform enables different analytics, data science, reporting, and business
project teams to publish data and create dashboards without requiring a developer
to build a new React page for each project.

Any project team can:
1. Develop their analysis / model
2. Publish the resulting data to an approved data source
3. Register the dataset
4. Use the **Dashboard Designer** to create a dashboard
5. Submit → Approve → Publish the dashboard
6. Users access it at `/dashboard/{code}`

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Material UI, TanStack Query/Table, Recharts, React Grid Layout |
| Backend | Python 3.11, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 |
| App Database | PostgreSQL 18 |
| Analytical Sources | PostgreSQL, Oracle (thin mode), Internal REST APIs |
| Reverse Proxy | Nginx |

## Project Structure

```
analytics-platform/
├── frontend/          React + TypeScript SPA
├── backend/           FastAPI application
│   ├── app/           Application code
│   ├── migrations/    Alembic database migrations
│   └── scripts/       Seed and utility scripts
├── nginx/             Nginx reverse proxy configuration
├── deployment/        systemd service and deployment scripts
├── docs/              Architecture and operational documentation
└── tests/             Integration and end-to-end tests
```

## Quick Start (Development)

### Prerequisites
- Python 3.11
- Node.js 24 / npm 11
- PostgreSQL 18

### Backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env with your PostgreSQL credentials and JWT secret

# Create database (see below)
# Run migrations
alembic upgrade head

# Seed demo data
python scripts/seed_data.py

# Start development server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server (proxies /api to localhost:8000)
npm run dev
```

Open http://localhost:5173

### PostgreSQL Setup

```sql
-- Run as postgres superuser
CREATE USER analytics_user WITH PASSWORD 'analytics_pass';
CREATE DATABASE analytics_platform OWNER analytics_user;
GRANT ALL PRIVILEGES ON DATABASE analytics_platform TO analytics_user;
```

## Demo Users (after seeding)

**Roles:** System Admin, Designer, Viewer

| Username | Employee ID | Password | Role | Access Level |
|---|---|---|---|---|
| `admin` | CBE001 | Demo@1234 | SYSTEM_ADMIN | HEAD_OFFICE |
| `designer1` | CBE002 | Demo@1234 | DESIGNER | HEAD_OFFICE |
| `designer2` | CBE003 | Demo@1234 | DESIGNER | REGION (Region A) |
| `designer3` | CBE006 | Demo@1234 | DESIGNER | HEAD_OFFICE |
| `viewer1` | CBE007 | Demo@1234 | VIEWER | BRANCH (Branch 001) |
| `viewer2` | CBE008 | Demo@1234 | VIEWER | REGION (Region B) |
| `viewer3` | CBE004 | Demo@1234 | VIEWER | DISTRICT (District A1) |
| `viewer4` | CBE005 | Demo@1234 | VIEWER | BRANCH (Branch 002) |
| `viewer5` | CBE009 | Demo@1234 | VIEWER | BRANCH (Branch 001) |

**Note:** You can login with either username or employee_id.

## Implementation Phases

| Phase | Status | Description |
|---|---|---|
| 1 | ✅ Complete | Project foundation, folder structure, skeleton |
| 2 | Pending | Database schema + Alembic migrations + seed data |
| 3 | Pending | Full authentication (login/logout/JWT/refresh) |
| 4 | Pending | Organization hierarchy + user profile |
| 5 | Pending | Full RBAC |
| 6 | Pending | Data-level security enforcement |
| 7 | Pending | Data source management |
| 8 | Pending | Dashboard engine + generic renderer |
| 9 | Pending | Dashboard Designer (drag-and-drop) |
| 10 | Pending | Dashboard approval workflow |
| 11 | Pending | Dashboard versioning |
| 12 | Pending | Full administration UI |
| 13 | Pending | FCY Lead demo dashboard |
| 14 | Pending | Testing |
| 15 | Pending | Production deployment |

## Security Architecture

- **Authentication**: JWT (access + refresh tokens), bcrypt password hashing
- **Authorization**: Role-based permissions enforced on every API endpoint
- **Data Security**: Organizational scope (HEAD_OFFICE / REGION / DISTRICT / BRANCH) enforced server-side. URL/query parameters cannot bypass scope.
- **Export Security**: CSV, Excel, and PDF exports enforce the same scope as the dashboard.
- **No secrets in frontend**: Database credentials and API keys never leave the backend.

## Documentation

See `docs/` for detailed documentation:
- `architecture.md` — system architecture
- `database.md` — database schema and ERD
- `authentication.md` — auth and JWT flow
- `authorization.md` — RBAC and data-level security
- `dashboard-designer.md` — using the Dashboard Designer
- `data-sources.md` — configuring data sources
- `oracle-integration.md` — Oracle connectivity
- `deployment.md` — production deployment guide

## Deployment (No Docker)

See `docs/deployment.md` for complete production deployment instructions using:
- Python virtualenv + Uvicorn
- Nginx reverse proxy
- systemd service for auto-start
- Internal network URL configuration
