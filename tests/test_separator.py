# tests/test_separator.py
import pytest
from unittest.mock import patch, MagicMock
from midi_extractor.separator import separate_piano


def test_separate_piano_returns_piano_wav_path():
    """separate_piano should run demucs and return the piano stem path."""
    with patch("midi_extractor.separator.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0)
        with patch("midi_extractor.separator.glob.glob", return_value=["separated/htdemucs/audio/no_other.wav"]):
            result = separate_piano("songs/audio.wav")
            assert "no_other" in result
            assert result.endswith(".wav")
            mock_run.assert_called_once()


def test_separate_piano_raises_on_failure():
    """separate_piano should raise RuntimeError if demucs fails."""
    with patch("midi_extractor.separator.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stderr="error")
        with pytest.raises(RuntimeError, match="demucs failed"):
            separate_piano("songs/audio.wav")
