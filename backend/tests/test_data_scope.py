"""
CRITICAL: Tests for data-level security (Phase 6).
Verifies that users cannot access data outside their organizational scope.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def login(username, password):
    r = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    return r.json()["access_token"]

def auth(token):
    return {"Authorization": f"Bearer {token}"}

class TestOrgFilterScope:
    """
    CRITICAL TEST: branch_mgr is scoped to Branch 001 (branch_id=1).
    Requesting data for branch_id=2 must be rejected or return no data.
    """

    def test_branch_manager_sees_own_org(self):
        token = login("branch_mgr", "Pass@1234")
        r = client.get("/api/v1/regions", headers=auth(token))
        assert r.status_code == 200
        # Branch manager's region should be in results
        regions = r.json()
        assert len(regions) >= 1

    def test_branch_manager_cannot_request_other_branch(self):
        token = login("branch_mgr", "Pass@1234")
        # Request dashboard data for a different branch — must be 403 or return own branch data
        r = client.get("/api/v1/dashboard/fcy-lead/widgets/1/data",
                       headers=auth(token), params={"branch_id": 999})
        # Must either be 403 (out of scope) or 404 (widget not found)
        # Must NOT return data for branch 999
        assert r.status_code in (403, 404, 200)
        if r.status_code == 200:
            # If 200, scope must be enforced — effective_branch must be user's branch, not 999
            data = r.json()
            scope = data.get("scope_applied", {})
            assert scope.get("effective_branch") != 999

    def test_head_office_sees_all_regions(self):
        token = login("ho_user", "Pass@1234")
        r = client.get("/api/v1/regions", headers=auth(token))
        assert r.status_code == 200
        regions = r.json()
        assert len(regions) == 3  # All 3 seeded regions

    def test_region_manager_sees_own_region_only(self):
        token = login("region_mgr", "Pass@1234")
        r = client.get("/api/v1/regions", headers=auth(token))
        assert r.status_code == 200
        regions = r.json()
        assert len(regions) == 1  # Only their own region

    def test_region_manager_cannot_see_other_region_districts(self):
        token = login("region_mgr", "Pass@1234")
        # Region 2 districts — region_mgr is in region 1
        r = client.get("/api/v1/regions/2/districts", headers=auth(token))
        assert r.status_code == 403

    def test_district_manager_sees_own_districts(self):
        token = login("district_mgr", "Pass@1234")
        r = client.get("/api/v1/regions/1/districts", headers=auth(token))
        assert r.status_code == 200
        districts = r.json()
        assert len(districts) == 1  # Only their district

class TestPermissions:
    def test_viewer_cannot_create_user(self):
        token = login("viewer", "Pass@1234")
        r = client.post("/api/v1/users", json={
            "username": "newuser", "full_name": "New User", "email": "new@test.com",
            "password": "Pass@1234", "access_level": "BRANCH", "role_id": 7
        }, headers=auth(token))
        assert r.status_code == 403

    def test_admin_can_list_users(self):
        token = login("admin", "Admin@1234")
        r = client.get("/api/v1/users", headers=auth(token))
        assert r.status_code == 200
        assert "items" in r.json()

    def test_viewer_cannot_access_audit_logs(self):
        token = login("viewer", "Pass@1234")
        r = client.get("/api/v1/audit-logs", headers=auth(token))
        assert r.status_code == 403

class TestOrgHierarchyValidation:
    def test_create_user_wrong_district_for_region(self):
        token = login("admin", "Admin@1234")
        # District 4 belongs to region 2, not region 1 — should be rejected
        r = client.post("/api/v1/users", json={
            "username": "testbadorg", "full_name": "Bad Org", "email": "badorg@test.com",
            "password": "Pass@1234", "access_level": "DISTRICT",
            "region_id": 1, "district_id": 4, "role_id": 4
        }, headers=auth(token))
        assert r.status_code == 400  # district does not belong to region

    def test_create_branch_user_requires_branch(self):
        token = login("admin", "Admin@1234")
        r = client.post("/api/v1/users", json={
            "username": "testnobranch", "full_name": "No Branch", "email": "nobranch@test.com",
            "password": "Pass@1234", "access_level": "BRANCH",
            "region_id": 1, "district_id": 1, "role_id": 5
            # Missing branch_id
        }, headers=auth(token))
        assert r.status_code in (400, 422)
