# tests/test_downloader.py
import os
import pytest
from unittest.mock import patch, MagicMock
from midi_extractor.downloader import download_audio


def test_download_audio_returns_wav_path():
    """download_audio should call yt-dlp and return the path to the WAV file."""
    with patch("midi_extractor.downloader.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        result = download_audio(
            url="https://youtube.com/watch?v=test123",
            output_dir="songs"
        )
        assert result.endswith(".wav")
        assert "songs" in result
        mock_run.assert_called_once()
        cmd = mock_run.call_args[0][0]
        assert "yt-dlp" in cmd[0]


def test_download_audio_raises_on_failure():
    """download_audio should raise RuntimeError if yt-dlp fails."""
    with patch("midi_extractor.downloader.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stderr="error")
        with pytest.raises(RuntimeError, match="yt-dlp failed"):
            download_audio(
                url="https://youtube.com/watch?v=fail",
                output_dir="songs"
            )
