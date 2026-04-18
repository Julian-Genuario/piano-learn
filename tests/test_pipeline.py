# tests/test_pipeline.py
import pytest
from unittest.mock import patch
from midi_extractor.pipeline import extract_midi


def test_extract_midi_without_separation():
    """Pipeline without separation: download → transcribe."""
    with patch("midi_extractor.pipeline.download_audio", return_value="songs/abc123.wav") as mock_dl:
        with patch("midi_extractor.pipeline.transcribe_to_midi", return_value="songs/test_song.mid") as mock_tr:
            with patch("midi_extractor.pipeline.os.remove"):
                result = extract_midi(
                    url="https://youtube.com/watch?v=test",
                    name="test_song",
                    separate=False
                )
                assert result == "songs/test_song.mid"
                mock_dl.assert_called_once()
                mock_tr.assert_called_once_with("songs/abc123.wav", "songs/test_song.mid")


def test_extract_midi_with_separation():
    """Pipeline with separation: download → separate → transcribe."""
    with patch("midi_extractor.pipeline.download_audio", return_value="songs/abc123.wav"):
        with patch("midi_extractor.pipeline.separate_piano", return_value="separated/piano.wav") as mock_sep:
            with patch("midi_extractor.pipeline.transcribe_to_midi", return_value="songs/test_song.mid") as mock_tr:
                with patch("midi_extractor.pipeline.os.remove"):
                    result = extract_midi(
                        url="https://youtube.com/watch?v=test",
                        name="test_song",
                        separate=True
                    )
                    assert result == "songs/test_song.mid"
                    mock_sep.assert_called_once_with("songs/abc123.wav")
                    mock_tr.assert_called_once_with("separated/piano.wav", "songs/test_song.mid")


def test_extract_midi_cleans_up_wav():
    """Pipeline should delete intermediate WAV files after conversion."""
    with patch("midi_extractor.pipeline.download_audio", return_value="songs/abc123.wav"):
        with patch("midi_extractor.pipeline.transcribe_to_midi", return_value="songs/song.mid"):
            with patch("midi_extractor.pipeline.os.remove") as mock_remove:
                extract_midi(url="https://youtube.com/watch?v=test", name="song")
                mock_remove.assert_called_with("songs/abc123.wav")
