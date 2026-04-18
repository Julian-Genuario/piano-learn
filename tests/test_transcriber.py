# tests/test_transcriber.py
import pytest
from unittest.mock import patch, MagicMock
from midi_extractor.transcriber import transcribe_to_midi


def test_transcribe_returns_midi_path():
    """transcribe_to_midi should convert WAV to MIDI and return the path."""
    mock_midi_data = MagicMock()
    mock_note_events = [MagicMock()]
    with patch("midi_extractor.transcriber.predict") as mock_predict:
        mock_predict.return_value = (None, mock_midi_data, mock_note_events)
        with patch.object(mock_midi_data, "write"):
            result = transcribe_to_midi("songs/piano.wav", "songs/output.mid")
            assert result == "songs/output.mid"
            mock_predict.assert_called_once_with("songs/piano.wav")
            mock_midi_data.write.assert_called_once_with("songs/output.mid")


def test_transcribe_generates_output_name_from_input():
    """If no output_path given, should derive name from input WAV."""
    mock_midi_data = MagicMock()
    with patch("midi_extractor.transcriber.predict") as mock_predict:
        mock_predict.return_value = (None, mock_midi_data, [])
        with patch.object(mock_midi_data, "write"):
            result = transcribe_to_midi("songs/my_song.wav")
            assert result == "songs/my_song.mid"
