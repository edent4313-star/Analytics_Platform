"""
Spec 02 — Authentication & Authorization tests.
Tests Mock AD login, identity resolution, scope enforcement.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def login(employee_id="CBE001", password="Demo@1234"):
    r = client.post("/api/v1/auth/login", json={"employee_id": employee_id, "password": password})
    return r

def auth(token): return {"Authorization": f"Bearer {token}"}


class TestMockADLogin:
    def test_successful_login_admin(self):
        r = login("CBE001")
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d
        assert d["provider"] == "mock"

    def test_successful_login_regional_manager(self):
        r = login("CBE003")
        assert r.status_code == 200

    def test_wrong_password(self):
        r = login("CBE001", "wrongpassword")
        assert r.status_code == 401

    def test_nonexistent_employee(self):
        r = login("NOTEXIST", "Demo@1234")
        assert r.status_code == 401

    def test_all_demo_users_can_login(self):
        for eid in ["CBE001","CBE002","CBE003","CBE004","CBE005","CBE006","CBE007"]:
            r = login(eid)
            assert r.status_code == 200, f"{eid} failed: {r.json()}"


class TestIdentity:
    def test_me_returns_full_identity(self):
        token = login("CBE003").json()["access_token"]
        r = client.get("/api/v1/auth/me", headers=auth(token))
        assert r.status_code == 200
        d = r.json()
        assert d["employee_id"] == "CBE003"
        assert d["role"] == "REGIONAL_MANAGER"
        assert d["access_level"] == "REGION"
        assert d["region_id"] is not None

    def test_permissions_endpoint(self):
        token = login("CBE001").json()["access_token"]
        r = client.get("/api/v1/auth/permissions", headers=auth(token))
        assert r.status_code == 200
        assert "permissions" in r.json()
        assert len(r.json()["permissions"]) > 0

    def test_data_scope_endpoint(self):
        token = login("CBE005").json()["access_token"]  # Branch Manager
        r = client.get("/api/v1/users/me/data-scope", headers=auth(token))
        assert r.status_code == 200
        d = r.json()
        assert d["access_level"] == "BRANCH"
        assert d["branch_id"] is not None
        assert d["is_head_office"] is False

    def test_head_office_scope(self):
        token = login("CBE001").json()["access_token"]
        r = client.get("/api/v1/users/me/data-scope", headers=auth(token))
        assert r.status_code == 200
        assert r.json()["is_head_office"] is True

    def test_session_endpoint(self):
        token = login("CBE002").json()["access_token"]
        r = client.get("/api/v1/auth/session", headers=auth(token))
        assert r.status_code == 200
        assert r.json()["provider"] == "mock"


class TestScopeEnforcement:
    """Prove URL/parameter manipulation cannot bypass org scope."""

    def test_branch_manager_cannot_request_other_branch_data(self):
        token = login("CBE005").json()["access_token"]  # Branch id=1
        r = client.get(
            "/api/v1/dashboard/fcy-lead/widgets/1/data",
            headers=auth(token),
            params={"branch_id": 999},  # Attempting different branch
        )
        assert r.status_code in (200, 403, 404)
        if r.status_code == 200:
            scope = r.json().get("scope_applied", {})
            assert scope.get("effective_branch") != 999

    def test_region_manager_sees_only_own_region(self):
        token = login("CBE003").json()["access_token"]
        r = client.get("/api/v1/regions", headers=auth(token))
        assert r.status_code == 200
        regions = r.json()
        assert len(regions) == 1  # Only their region

    def test_region_manager_blocked_from_other_region_districts(self):
        token = login("CBE003").json()["access_token"]  # Region 1
        r = client.get("/api/v1/regions/2/districts", headers=auth(token))
        assert r.status_code == 403

    def test_viewer_cannot_view_users(self):
        token = login("CBE007").json()["access_token"]
        r = client.get("/api/v1/users", headers=auth(token))
        assert r.status_code == 403

    def test_viewer_cannot_create_users(self):
        token = login("CBE007").json()["access_token"]
        r = client.post("/api/v1/users", json={
            "username": "hack", "full_name": "Hack", "email": "h@h.com",
            "password": "Pass@1234", "access_level": "BRANCH", "role_id": 7
        }, headers=auth(token))
        assert r.status_code == 403


class TestTokenSecurity:
    def test_no_token_returns_403(self):
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 403

    def test_invalid_token_returns_401(self):
        r = client.get("/api/v1/auth/me", headers=auth("invalid.token.here"))
        assert r.status_code == 401

    def test_refresh_works(self):
        tokens = login("CBE001").json()
        r = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
        assert r.status_code == 200
        assert "access_token" in r.json()
