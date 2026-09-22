# Deployment Guide — Enterprise Analytics Platform

## Requirements

| Component | Version |
|---|---|
| OS | Ubuntu 22.04 / RHEL 8 / CentOS 8 |
| Python | 3.11+ |
| Node.js | 18+ (build machine only) |
| PostgreSQL | 14+ |
| Nginx | 1.18+ |

## Quick Deploy

```bash
# On the target server (as root):
bash deployment/setup.sh
```

## Manual Step-by-Step

### 1. Create service user
```bash
useradd --system --home /opt/analytics-platform --shell /bin/false analytics
```

### 2. Install system packages
```bash
# Ubuntu
apt-get install -y python3.11 python3.11-venv postgresql nginx

# RHEL/CentOS
dnf install -y python3.11 postgresql-server nginx
postgresql-setup --initdb
systemctl start postgresql
```

### 3. Copy files
```bash
mkdir -p /opt/analytics-platform/{backend,frontend,venv}
cp -r backend/* /opt/analytics-platform/backend/
# Copy pre-built frontend (npm run build output):
cp -r frontend/dist /opt/analytics-platform/frontend/
```

### 4. Python virtual environment
```bash
python3.11 -m venv /opt/analytics-platform/venv
/opt/analytics-platform/venv/bin/pip install -r /opt/analytics-platform/backend/requirements.txt
```

### 5. Configure environment
```bash
cp /opt/analytics-platform/backend/.env.example /opt/analytics-platform/backend/.env
# Edit .env — REQUIRED settings:
#   DATABASE_URL=postgresql://analytics_user:YOUR_PASS@localhost:5432/analytics_platform
#   JWT_SECRET_KEY=<64-char random hex>
#   CREDENTIAL_ENCRYPTION_KEY=<fernet key>
#   APP_ENV=production
#   CORS_ORIGINS=http://analytics.internal
```

### 6. Database setup
```bash
sudo -u postgres psql << 'EOF'
CREATE USER analytics_user WITH PASSWORD 'YOUR_STRONG_PASSWORD';
CREATE DATABASE analytics_platform OWNER analytics_user;
GRANT ALL PRIVILEGES ON DATABASE analytics_platform TO analytics_user;
EOF
```

### 7. Run migrations and seed
```bash
cd /opt/analytics-platform/backend
/opt/analytics-platform/venv/bin/python -m alembic upgrade head
/opt/analytics-platform/venv/bin/python scripts/seed_data.py
/opt/analytics-platform/venv/bin/python scripts/seed_fcy_demo.py
```

### 8. systemd service
```bash
cp deployment/analytics-platform.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable analytics-platform
systemctl start analytics-platform
systemctl status analytics-platform
```

### 9. Nginx
```bash
cp nginx/analytics-platform.conf /etc/nginx/sites-available/analytics-platform
ln -s /etc/nginx/sites-available/analytics-platform /etc/nginx/sites-enabled/
# Edit server_name in the config to match your hostname/IP
nginx -t
systemctl reload nginx
```

### 10. Verify
```bash
# From another machine on the internal network:
curl http://analytics.internal/health
# Expected: {"status":"healthy","database":"connected",...}
```

## Production Checklist

- [ ] Change `admin` password immediately after first login
- [ ] Set strong `JWT_SECRET_KEY` (64+ random chars)
- [ ] Set strong `CREDENTIAL_ENCRYPTION_KEY`
- [ ] Set `APP_ENV=production` in .env
- [ ] Set `CORS_ORIGINS` to your internal URL only (no wildcards)
- [ ] Set strong PostgreSQL password
- [ ] Configure HTTPS (internal CA certificate)
- [ ] Disable `/api/docs` (automatic in production APP_ENV)
- [ ] Configure PostgreSQL pg_hba.conf for scram-sha-256 only
- [ ] Set up log rotation for /var/log/analytics-platform/
- [ ] Set up PostgreSQL backups
- [ ] Test from a different machine before announcing go-live

## Accessing the Application

After deployment, users access:

```
http://analytics.internal/
```

or

```
http://10.x.x.x/
```

## Restart / Management

```bash
# Restart API
systemctl restart analytics-platform

# View logs
journalctl -u analytics-platform -f
tail -f /var/log/analytics-platform/api.log

# Check status
systemctl status analytics-platform

# Nginx
systemctl status nginx
tail -f /var/log/nginx/analytics-platform-error.log
```

## Oracle Integration

To enable Oracle data sources:
1. Add Oracle credentials in Admin → Data Sources
2. Credentials are encrypted with Fernet before storage
3. oracledb uses thin mode — no Oracle Instant Client required
4. Set `ORACLE_HOST`, `ORACLE_PORT`, `ORACLE_SERVICE` in .env if using a default Oracle source
