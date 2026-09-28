"""Spec 08 — Administration & Audit API tests."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def login(eid="CBE001", pw="Demo@1234"):
    r = client.post("/api/v1/auth/login", json={"employee_id": eid, "password": pw})
    return r.json()["access_token"]

def auth(token): return {"Authorization": f"Bearer {token}"}

class TestAdminAccess:
    def test_admin_can_list_users(self):
        r = client.get("/api/v1/admin/users", headers=auth(login("CBE001")))
        assert r.status_code == 200
        assert "items" in r.json()

    def test_viewer_denied_admin_users(self):
        r = client.get("/api/v1/admin/users", headers=auth(login("CBE007")))
        assert r.status_code == 403

    def test_admin_can_list_roles(self):
        r = client.get("/api/v1/admin/roles", headers=auth(login("CBE001")))
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_viewer_denied_admin_roles(self):
        r = client.get("/api/v1/admin/roles", headers=auth(login("CBE007")))
        assert r.status_code == 403

    def test_admin_can_list_departments(self):
        r = client.get("/api/v1/admin/departments", headers=auth(login("CBE001")))
        assert r.status_code == 200

    def test_admin_can_list_positions(self):
        r = client.get("/api/v1/admin/positions", headers=auth(login("CBE001")))
        assert r.status_code == 200

    def test_admin_can_get_org_tree(self):
        r = client.get("/api/v1/admin/organizations", headers=auth(login("CBE001")))
        assert r.status_code == 200
        assert len(r.json()) == 3  # 3 regions seeded

class TestUserManagement:
    def test_create_and_get_user(self):
        token = login("CBE001")
        r = client.post("/api/v1/admin/users", headers=auth(token), json={
            "username": "test_admin_spec08",
            "full_name": "Test Spec08",
            "email": "spec08test@cbe.com.et",
            "password": "Test@1234",
            "access_level": "HEAD_OFFICE",
            "role_id": 1,
            "employee_id": "CBE_TEST08",
        })
        assert r.status_code == 201
        user_id = r.json()["id"]

        # Get by ID
        r2 = client.get(f"/api/v1/admin/users/{user_id}", headers=auth(token))
        assert r2.status_code == 200
        assert r2.json()["employee_id"] == "CBE_TEST08"

        # Deactivate
        r3 = client.patch(f"/api/v1/admin/users/{user_id}/status", headers=auth(token), json={"is_active": False})
        assert r3.status_code == 200
        assert r3.json()["is_active"] is False

    def test_get_user_scope(self):
        token = login("CBE001")
        r = client.get("/api/v1/admin/users/3/scope", headers=auth(token))  # CBE003 region_mgr
        assert r.status_code == 200
        assert r.json()["access_level"] == "REGION"

    def test_get_user_permissions(self):
        token = login("CBE001")
        r = client.get("/api/v1/admin/users/1/permissions", headers=auth(token))
        assert r.status_code == 200
        assert "permissions" in r.json()

class TestDashboardPermissions:
    def test_list_dashboard_permissions(self):
        token = login("CBE001")
        r = client.get("/api/v1/admin/dashboard-permissions", headers=auth(token))
        assert r.status_code == 200

    def test_create_dashboard_permission(self):
        token = login("CBE001")
        r = client.post("/api/v1/admin/dashboard-permissions", headers=auth(token), json={
            "dashboard_id": 1, "role_id": 7, "can_view": True, "can_export": False
        })
        assert r.status_code in (200, 201)

class TestAuditLogs:
    def test_admin_can_view_audit(self):
        token = login("CBE001")
        r = client.get("/api/v1/audit", headers=auth(token))
        assert r.status_code == 200
        assert "items" in r.json()

    def test_viewer_denied_audit(self):
        token = login("CBE007")
        r = client.get("/api/v1/audit", headers=auth(token))
        assert r.status_code == 403

    def test_security_events(self):
        token = login("CBE001")
        r = client.get("/api/v1/audit/security-events", headers=auth(token))
        assert r.status_code == 200

    def test_user_audit_trail(self):
        token = login("CBE001")
        r = client.get("/api/v1/audit/users/1", headers=auth(token))
        assert r.status_code == 200
        assert "items" in r.json()

    def test_audit_filtering_by_action(self):
        token = login("CBE001")
        r = client.get("/api/v1/audit?action=LOGIN", headers=auth(token))
        assert r.status_code == 200
        for item in r.json()["items"]:
            assert item["action"] == "LOGIN"

class TestOrgEndpoints:
    def test_list_regions(self):
        token = login("CBE001")
        r = client.get("/api/v1/admin/regions", headers=auth(token))
        assert r.status_code == 200
        assert len(r.json()) == 3

    def test_list_districts_filtered(self):
        token = login("CBE001")
        r = client.get("/api/v1/admin/districts?region_id=1", headers=auth(token))
        assert r.status_code == 200
        for d in r.json():
            assert d["region_id"] == 1

    def test_non_admin_denied_branches(self):
        token = login("CBE007")
        r = client.get("/api/v1/admin/branches", headers=auth(token))
        assert r.status_code == 403
