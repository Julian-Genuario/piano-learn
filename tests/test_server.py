import pytest
from fastapi.testclient import TestClient
from pianolearn.server import create_app


@pytest.fixture
def client(tmp_path):
    app = create_app(songs_dir=str(tmp_path), mock_leds=True)
    (tmp_path / "test_song.mid").write_bytes(b"MThd" + b"\x00" * 50)
    return TestClient(app)


def test_list_songs(client):
    response = client.get("/api/songs")
    assert response.status_code == 200
    songs = response.json()
    assert len(songs) == 1
    assert songs[0]["name"] == "test_song"


def test_upload_song(client):
    response = client.post(
        "/api/songs/upload",
        files={"file": ("new_song.mid", b"MThd" + b"\x00" * 50, "audio/midi")}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_delete_song(client):
    response = client.delete("/api/songs/test_song")
    assert response.status_code == 200
    response = client.get("/api/songs")
    assert len(response.json()) == 0


def test_player_state(client):
    response = client.get("/api/player/state")
    assert response.status_code == 200
    state = response.json()
    assert "mode" in state
    assert "playing" in state


def test_set_brightness(client):
    response = client.post("/api/leds/brightness", json={"brightness": 128})
    assert response.status_code == 200
