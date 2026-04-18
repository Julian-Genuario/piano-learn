# tests/test_sync_client.py
import pytest
from unittest.mock import patch, MagicMock, mock_open
from midi_extractor.sync_client import send_to_pi


def test_send_to_pi_posts_file():
    """send_to_pi should POST the MIDI file to the Pi's upload endpoint."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"status": "ok"}

    with patch("midi_extractor.sync_client.httpx.post", return_value=mock_response) as mock_post:
        with patch("builtins.open", mock_open(read_data=b"midi data")):
            result = send_to_pi("songs/test.mid", pi_host="pianolearn.local")
            assert result is True
            mock_post.assert_called_once()
            assert "pianolearn.local" in mock_post.call_args[0][0]


def test_send_to_pi_returns_false_on_failure():
    """send_to_pi should return False if the Pi is unreachable."""
    with patch("midi_extractor.sync_client.httpx.post", side_effect=Exception("Connection refused")):
        with patch("builtins.open", mock_open(read_data=b"midi data")):
            result = send_to_pi("songs/test.mid", pi_host="pianolearn.local")
            assert result is False
