# CBE Enterprise Analytics Platform - Deployment Guide

**Version:** 1.0
**Last Updated:** 2026-10-04
**Target Environment:** CBE On-Premises Infrastructure

---

## QUICK START

For rapid deployment, use the following summary:

1. **Generate secure keys** and configure `backend/.env`
2. **Set up PostgreSQL** database and user
3. **Run migrations**: `alembic upgrade head`
4. **Seed data**: `python scripts/seed_data.py`
5. **Build frontend**: `npm run build`
6. **Configure Nginx** and copy files to `/opt/analytics-platform/`
7. **Start systemd service**: `systemctl start analytics-platform`
8. **Verify**: `curl http://analytics.internal/health`

For detailed step-by-step instructions, see the sections below.

---

## SYSTEM REQUIREMENTS

### Hardware
- CPU: 2 cores minimum, 4+ recommended
- RAM: 4 GB minimum, 8+ recommended
- Disk: 20 GB minimum, 50+ GB SSD recommended
- Network: 1 Gbps

### Software
- OS: Ubuntu 22.04 LTS / RHEL 8 / CentOS 8
- Python: 3.11+
- Node.js: 24+ (build machine only)
- PostgreSQL: 18+
- Nginx: 1.18+

---

## DATABASE SETUP

### Create Database and User

```bash
sudo -u postgres psql
```

```sql
CREATE USER analytics_user WITH PASSWORD 'STRONG_PASSWORD';
CREATE DATABASE analytics_platform OWNER analytics_user;
GRANT ALL PRIVILEGES ON DATABASE analytics_platform TO analytics_user;
\q
```

### Configure PostgreSQL

Edit `/etc/postgresql/18/main/pg_hba.conf`:

```
host    analytics_platform    analytics_user    127.0.0.1/32    scram-sha-256
```

Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

---

## APPLICATION DEPLOYMENT

### Create User and Directories

```bash
sudo useradd --system --home /opt/analytics-platform --shell /bin/false analytics
sudo mkdir -p /opt/analytics-platform/{backend,frontend,venv}
sudo chown -R analytics:analytics /opt/analytics-platform
```

### Copy Backend Files

```bash
sudo cp -r backend/* /opt/analytics-platform/backend/
sudo cp backend/.env /opt/analytics-platform/backend/.env
sudo chmod 600 /opt/analytics-platform/backend/.env
sudo chown analytics:analytics /opt/analytics-platform/backend/.env
```

### Create Virtual Environment

```bash
sudo -u analytics python3.11 -m venv /opt/analytics-platform/venv
sudo -u analytics /opt/analytics-platform/venv/bin/pip install -r /opt/analytics-platform/backend/requirements.txt
```

### Create Log Directory

```bash
sudo mkdir -p /var/log/analytics-platform
sudo chown analytics:analytics /var/log/analytics-platform
```

### Run Migrations

```bash
cd /opt/analytics-platform/backend
sudo -u analytics /opt/analytics-platform/venv/bin/alembic upgrade head
```

### Seed Data

```bash
sudo -u analytics /opt/analytics-platform/venv/bin/python scripts/seed_data.py
```

**IMPORTANT:** Change default admin password after first login.

---

## FRONTEND DEPLOYMENT

### Build Frontend

```bash
cd frontend
npm install
npm run build
```

### Copy to Production

```bash
sudo cp -r frontend/dist /opt/analytics-platform/frontend/
sudo chown -R analytics:analytics /opt/analytics-platform/frontend
```

---

## NGINX CONFIGURATION

### Copy Configuration

```bash
sudo cp nginx/analytics-platform.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/analytics-platform /etc/nginx/sites-enabled/
```

### Edit server_name

Edit `/etc/nginx/sites-available/analytics-platform.conf` and update `server_name` to your production hostname.

### Test and Reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## SYSTEMD SERVICE

### Copy Service File

```bash
sudo cp deployment/analytics-platform.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### Enable and Start

```bash
sudo systemctl enable analytics-platform
sudo systemctl start analytics-platform
sudo systemctl status analytics-platform
```

---

## VERIFICATION

### Health Check

```bash
curl http://analytics.internal/health
```

Expected: `{"status":"healthy","database":"connected",...}`

### Authentication Test

**Note:** Using mock AD (AUTH_PROVIDER=mock) since CBE AD is not yet available.

**Login Credentials:** You can use either username or employee_id. Password is `Demo@1234` for all users.

```bash
# Login with username
curl -X POST http://analytics.internal/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"admin","password":"Demo@1234"}'

# Or login with employee_id
curl -X POST http://analytics.internal/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"CBE001","password":"Demo@1234"}'
```

**Available Demo Users:**

**System Admin:**
- `admin` / `CBE001` - Full system access

**Designers:**
- `designer1` / `CBE002` - Can create and edit dashboards
- `designer2` / `CBE003` - Can create and edit dashboards
- `designer3` / `CBE006` - Can create and edit dashboards

**Viewers:**
- `viewer1` / `CBE007` - Read-only access
- `viewer2` / `CBE008` - Read-only access
- `viewer3` / `CBE004` - Read-only access
- `viewer4` / `CBE005` - Read-only access
- `viewer5` / `CBE009` - Read-only access

**Password for all users:** `Demo@1234`

**Note:** You can login with either username or employee_id.

---

## SECURITY CHECKLIST

- [ ] Set strong JWT_SECRET_KEY (64+ chars)
- [ ] Set strong CREDENTIAL_ENCRYPTION_KEY
- [ ] Set strong PostgreSQL password
- [ ] Set APP_ENV=production
- [ ] Set DEBUG=false
- [ ] Set AUTH_PROVIDER=mock (until CBE AD is available)
- [ ] Set CORS_ORIGINS to specific URL only
- [ ] Configure SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Restrict database access to application server only
- [ ] Set up database backups
- [ ] Change default admin password
- [ ] **Note:** When CBE AD becomes available, switch AUTH_PROVIDER to cbe_ad and configure OIDC

---

## MAINTENANCE

### Restart Service

```bash
sudo systemctl restart analytics-platform
```

### View Logs

```bash
sudo journalctl -u analytics-platform -f
sudo tail -f /var/log/analytics-platform/api.log
```

### Database Backup

```bash
pg_dump -U analytics_user analytics_platform > backup.sql
```

---

## TROUBLESHOOTING

### Service won't start
```bash
sudo systemctl status analytics-platform
sudo journalctl -u analytics-platform -n 50
```

### Database connection failed
```bash
psql -U analytics_user -d analytics_platform -h localhost
sudo systemctl status postgresql
```

### Nginx 502 error
```bash
curl http://127.0.0.1:8000/health
sudo tail -f /var/log/nginx/analytics-platform-error.log
```

---

For complete details, see [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) and [docs/deployment.md](docs/deployment.md).
