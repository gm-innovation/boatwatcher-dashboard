"""
Testes para o endpoint de health check
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client():
    """Fixture para criar um cliente de teste"""
    return TestClient(app)

def test_health_check(client):
    """Testa o endpoint de health check"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "ok"
    assert "version" in data
    assert "timestamp" in data

def test_health_check_with_details(client):
    """Testa o endpoint de health check com detalhes"""
    response = client.get("/health?details=true")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "ok"
    assert "version" in data
    assert "timestamp" in data
    assert "details" in data
    assert "environment" in data["details"]
    assert "inmeta_api" in data["details"]
    assert "use_mock" in data["details"]
