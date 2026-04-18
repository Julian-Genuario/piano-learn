import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from midi_extractor.web import app


client = TestClient(app)


def test_home_page_returns_html():
    """GET / should return the HTML form."""
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_extract_endpoint_starts_job():
    """POST /extract should start extraction and return job id."""
    with patch("midi_extractor.web.extract_midi_background"):
        response = client.post("/extract", json={
            "url": "https://youtube.com/watch?v=test",
            "name": "test_song",
            "separate": False
        })
        assert response.status_code == 200
        data = response.json()
        assert "job_id" in data


def test_status_endpoint_returns_not_found():
    """GET /status/{job_id} for unknown job should return not_found."""
    response = client.get("/status/nonexistent")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "not_found"
