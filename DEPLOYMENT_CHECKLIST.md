# CBE Enterprise Analytics Platform - Production Deployment Checklist

**Purpose:** Ensure all steps are completed before go-live. Use this checklist during deployment and handover.

---

## PRE-DEPLOYMENT PREPARATIONS

### Infrastructure Verification
- [ ] PostgreSQL 18 server is installed and running
- [ ] Python 3.11 is installed on target server
- [ ] Node.js 24+ is available on build machine (for frontend build)
- [ ] Nginx 1.18+ is installed
- [ ] systemd service manager is available
- [ ] Network connectivity between application server and database
- [ ] Network connectivity from CBE internal network to application server
- [ ] Disk space: At least 20GB for application, logs, and database growth
- [ ] RAM: At least 4GB recommended for production

### Security Preparations
- [ ] Generated secure JWT_SECRET_KEY (64+ character hex string)
- [ ] Generated secure CREDENTIAL_ENCRYPTION_KEY (Fernet key)
- [ ] Strong PostgreSQL password for analytics_user
- [ ] SSL/TLS certificate procured (or internal CA certificate planned)
- [ ] Network firewall rules configured (port 80/443 allowed from internal network)
- [ ] Database firewall rules configured (only application server can connect)
- [ ] Backup strategy defined (PostgreSQL backups, application config backups)

### Configuration Files
- [ ] backend/.env created from backend/.env.example
- [ ] DATABASE_URL configured with production PostgreSQL connection
- [ ] JWT_SECRET_KEY set to secure 64-char hex string
- [ ] CREDENTIAL_ENCRYPTION_KEY set to secure Fernet key
- [ ] APP_ENV=production
- [ ] DEBUG=false
- [ ] CORS_ORIGINS set to production URL only (no wildcards)
- [ ] FRONTEND_URL set to production URL
- [ ] AUTH_PROVIDER set to "mock" (CBE AD not yet available - will switch to cbe_ad when AD is ready)
- [ ] When CBE AD becomes available: Configure OIDC settings (issuer_url, client_id, client_secret, redirect_uri)

---

## DATABASE SETUP

### Database Creation
- [ ] PostgreSQL user `analytics_user` created with strong password
- [ ] Database `analytics_platform` created with owner `analytics_user`
- [ ] Permissions granted: `GRANT ALL PRIVILEGES ON DATABASE analytics_platform TO analytics_user`
- [ ] Connection tested from application server to PostgreSQL
- [ ] pg_hba.conf configured for scram-sha-256 authentication
- [ ] Database backup procedure tested

### Database Migrations
- [ ] Run: `cd /opt/analytics-platform/backend && /opt/analytics-platform/venv/bin/alembic upgrade head`
- [ ] Verify: `/opt/analytics-platform/venv/bin/alembic current` shows latest revision
- [ ] Check all tables created: users, roles, permissions, dashboards, datasets, etc.
- [ ] Verify foreign key constraints are in place
- [ ] Verify indexes are created

### Seed Data
- [ ] Run: `/opt/analytics-platform/venv/bin/python scripts/seed_data.py`
- [ ] Verify roles created: ADMIN, HEAD_OFFICE_USER, REGIONAL_MANAGER, etc.
- [ ] Verify permissions created and assigned to roles
- [ ] Verify organization hierarchy: regions, districts, branches
- [ ] Verify demo users created
- [ ] **CRITICAL:** Change default admin password immediately after first login

---

## APPLICATION DEPLOYMENT

### Backend Setup
- [ ] Application directory created: `/opt/analytics-platform/`
- [ ] Service user created: `useradd --system --home /opt/analytics-platform --shell /bin/false analytics`
- [ ] Backend files copied to `/opt/analytics-platform/backend/`
- [ ] Python virtual environment created: `python3.11 -m venv /opt/analytics-platform/venv`
- [ ] Dependencies installed: `/opt/analytics-platform/venv/bin/pip install -r requirements.txt`
- [ ] Dependencies version-pinned (requirements.txt used)
- [ ] .env file placed in `/opt/analytics-platform/backend/.env`
- [ ] .env file permissions set: `chmod 600 /opt/analytics-platform/backend/.env`
- [ ] Log directory created: `/var/log/analytics-platform/`
- [ ] Log directory permissions set: `chown analytics:analytics /var/log/analytics-platform/`

### Frontend Build
- [ ] Frontend dependencies installed: `npm install`
- [ ] Production build completed: `npm run build`
- [ ] Build output verified in `frontend/dist/`
- [ ] frontend/dist/ copied to `/opt/analytics-platform/frontend/dist/`
- [ ] Static assets are accessible
- [ ] index.html loads correctly

### systemd Service
- [ ] Service file copied: `cp deployment/analytics-platform.service /etc/systemd/system/`
- [ ] Service file reviewed and customized if needed
- [ ] systemd reloaded: `systemctl daemon-reload`
- [ ] Service enabled: `systemctl enable analytics-platform`
- [ ] Service started: `systemctl start analytics-platform`
- [ ] Service status verified: `systemctl status analytics-platform` (should be active)
- [ ] Logs checked: `journalctl -u analytics-platform -f` (no errors)
- [ ] Application logs checked: `tail -f /var/log/analytics-platform/api.log`

---

## NGINX CONFIGURATION

### Nginx Setup
- [ ] Nginx config copied: `cp nginx/analytics-platform.conf /etc/nginx/sites-available/`
- [ ] Config symlinked: `ln -s /etc/nginx/sites-available/analytics-platform /etc/nginx/sites-enabled/`
- [ ] server_name updated to production hostname/IP
- [ ] Config tested: `nginx -t` (syntax OK)
- [ ] Nginx reloaded: `systemctl reload nginx`
- [ ] Nginx status verified: `systemctl status nginx` (active)
- [ ] Nginx error log checked: `tail -f /var/log/nginx/analytics-platform-error.log`

### SSL/TLS (if applicable)
- [ ] SSL certificate obtained and placed in `/etc/ssl/analytics/`
- [ ] SSL key placed in `/etc/ssl/analytics/`
- [ ] Certificate permissions set: `chmod 600 /etc/ssl/analytics/analytics.key`
- [ ] HTTPS server block uncommented in nginx config
- [ ] HTTP to HTTPS redirect enabled
- [ ] SSL configuration tested: `openssl s_client -connect analytics.internal:443`
- [ ] SSL certificate expiration date noted

---

## FUNCTIONAL VERIFICATION

### Health Check
- [ ] Health endpoint accessible: `curl http://analytics.internal/health`
- [ ] Health response: `{"status":"healthy","database":"connected",...}`
- [ ] Database connection verified in health response

### Authentication
- [ ] Login page loads: `http://analytics.internal/`
- [ ] Mock AD login tested (AUTH_PROVIDER=mock): POST /auth/login with employee_id + password
- [ ] JWT token generated successfully
- [ ] Refresh token flow tested: POST /auth/refresh
- [ ] User profile endpoint tested: GET /auth/me
- [ ] Permissions endpoint tested: GET /auth/permissions
- [ ] Logout tested: POST /auth/logout
- [ ] **NOTE:** CBE AD OIDC integration will be tested when CBE AD becomes available

### Authorization
- [ ] Admin user can access all endpoints
- [ ] Viewer user can only access permitted dashboards
- [ ] Unauthorized requests return 403
- [ ] Organizational scope enforced (Branch user cannot see other branch data)
- [ ] Dashboard permissions enforced (unassigned dashboards not visible)

### Dashboard Functionality
- [ ] Dashboard list loads for authenticated user
- [ ] Dashboard displays correctly
- [ ] Widgets render (charts, tables, filters)
- [ ] Filters work (date range, region selection, etc.)
- [ ] Data loads correctly
- [ ] Empty states display appropriately
- [ ] Error handling works (network errors, permission errors)

### Designer Workspace (if applicable)
- [ ] Data source configuration accessible
- [ ] Connection test works
- [ ] Schema discovery works
- [ ] Dataset creation works
- [ ] Dashboard designer loads
- [ ] Widget library available
- [ ] Dashboard save works
- [ ] Dashboard publish workflow works

### Administrator Interface
- [ ] User management accessible
- [ ] Role assignment works
- [ ] Dashboard permission assignment works
- [ ] Organization hierarchy management works
- [ ] Bulk import from Excel works
- [ ] Audit log viewing works

### Exports
- [ ] CSV export works with authorization
- [ ] Excel export works with authorization
- [ ] PDF export works with authorization
- [ ] Export audit logs are recorded
- [ ] Export size limits are enforced

---

## PRODUCTION SECURITY CHECKS

### Application Security
- [ ] /api/docs disabled in production (automatic when APP_ENV=production)
- [ ] /api/redoc disabled in production
- [ ] /api/openapi.json disabled in production
- [ ] DEBUG=false in .env
- [ ] CORS_ORIGINS set to specific production URL (no wildcards)
- [ ] No sensitive data in error messages
- [ ] Rate limiting configured for login endpoints
- [ ] SQL injection protection verified (parameterized queries used)

### Database Security
- [ ] PostgreSQL using scram-sha-256 authentication
- [ ] Database server not accessible from public internet
- [ ] Only application server IP allowed in pg_hba.conf
- [ ] Database credentials not hardcoded in application
- [ ] Database backups encrypted
- [ ] Database access logged

### Network Security
- [ ] Firewall rules restrict access to application server
- [ ] Only internal network can access HTTP/HTTPS
- [ ] Database server not accessible from external network
- [ ] unnecessary ports closed
- [ ] SSL/TLS enforced for all traffic (if configured)

### Logging and Monitoring
- [ ] Application logs stored in `/var/log/analytics-platform/`
- [ ] Nginx logs stored in `/var/log/nginx/`
- [ ] Log rotation configured (logrotate)
- [ ] Audit logs enabled and recording
- [ ] Error monitoring/alerting set up
- [ ] Performance monitoring set up (optional)

---

## BACKUP AND RECOVERY

### Database Backups
- [ ] Automated backup script in place
- [ ] Backup schedule defined (daily, weekly)
- [ ] Backup retention policy defined
- [ ] Backup restoration tested
- [ ] Backups stored in secure location
- [ ] Offsite backup copy maintained

### Application Backups
- [ ] .env file backed up securely
- [ ] Application code backed up (Git repository)
- [ ] Nginx configuration backed up
- [ ] systemd service file backed up
- [ ] Static assets backed up

### Recovery Procedure
- [ ] Recovery procedure documented
- [ ] Recovery procedure tested
- [ ] Recovery time objective (RTO) defined
- [ ] Recovery point objective (RPO) defined
- [ ] Contact information for support team documented

---

## DOCUMENTATION

### Operational Documentation
- [ ] Installation guide updated with production specifics
- [ ] Deployment guide reviewed and updated
- [ ] Configuration guide created (what each .env setting does)
- [ ] Troubleshooting guide created
- [ ] User guide created (for end users)
- [ ] Admin guide created (for administrators)

### Handover Documentation
- [ ] System architecture diagram updated
- [ ] Network diagram created
- [ ] Server inventory documented
- [ ] Access credentials documented and stored securely
- [ ] Support contact information provided
- [ ] Escalation procedure documented

---

## USER ACCEPTANCE TESTING

### Pre-Go-Live Testing
- [ ] Test users created with appropriate roles
- [ ] Test scenarios executed by business users
- [ ] All critical workflows tested end-to-end
- [ ] Performance tested under expected load
- [ ] Browser compatibility tested (Chrome, Firefox, Edge)
- [ ] Mobile responsiveness tested (if applicable)
- [ ] Accessibility tested (if required)

### Sign-Off
- [ ] Business stakeholder sign-off obtained
- [ ] IT security review completed
- [ ] Network team sign-off obtained
- [ ] Database team sign-off obtained
- [ ] Support team trained
- [ ] Go-live date and time confirmed

---

## GO-LIVE PROCEDURES

### Go-Live Day
- [ ] Change window approved
- [ ] Stakeholders notified of go-live
- [ ] Database backups taken immediately before go-live
- [ ] Application deployed to production
- [ ] Smoke tests executed
- [ ] Health checks verified
- [ ] Support team on standby
- [ ] Rollback plan ready if issues occur

### Post-Go-Live
- [ ] Monitor application logs for errors
- [ ] Monitor performance metrics
- [ ] Monitor database performance
- [ ] Collect user feedback
- [ ] Address any immediate issues
- [ ] Update documentation with any changes

---

## MAINTENANCE

### Routine Maintenance
- [ ] Database maintenance schedule defined (vacuum, analyze)
- [ ] Log rotation schedule defined
- [ ] Backup verification schedule defined
- [ ] Security patch schedule defined
- [ ] Dependency update schedule defined

### Monitoring
- [ ] Uptime monitoring configured
- [ ] Performance monitoring configured
- [ ] Error alerting configured
- [ ] Disk space monitoring configured
- [ ] Database connection monitoring configured

---

## CONTACT INFORMATION

| Role | Name | Email | Phone |
|------|------|-------|-------|
| Application Owner | | | |
| System Administrator | | | |
| Database Administrator | | | |
| Network Administrator | | | |
| Security Contact | | | |
| Support Contact | | | |

---

## SIGN-OFF

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Project Lead | | | |
| System Administrator | | | |
| Database Administrator | | | |
| Security Officer | | | |
| Business Stakeholder | | | |

---

**Last Updated:** 2026-10-04
**Version:** 1.0
