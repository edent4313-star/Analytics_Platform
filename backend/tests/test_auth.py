"""Tests for authentication endpoints."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] in ("healthy", "degraded")

def test_login_success():
    r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@1234"})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

def test_login_wrong_password():
    r = client.post("/api/v1/auth/login", json={"username": "admin", "password": "wrongpassword"})
    assert r.status_code == 401

def test_login_nonexistent_user():
    r = client.post("/api/v1/auth/login", json={"username": "nobody", "password": "pass"})
    assert r.status_code == 401

def test_get_me_without_token():
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 403  # No bearer token

def test_get_me_with_token():
    login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@1234"})
    token = login.json()["access_token"]
    r = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["username"] == "admin"
    assert r.json()["role"] == "ADMIN"

def test_refresh_token():
    login = client.post("/api/v1/auth/login", json={"username": "admin", "password": "Admin@1234"})
    refresh = login.json()["refresh_token"]
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert r.status_code == 200
    assert "access_token" in r.json()

def test_invalid_token():
    r = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalidtoken"})
    assert r.status_code == 401
