# tests/test_cli.py
import pytest
from unittest.mock import patch
from midi_extractor.cli import main


def test_cli_basic_extraction():
    """CLI should call extract_midi with the URL."""
    with patch("midi_extractor.cli.extract_midi", return_value="songs/test.mid") as mock_extract:
        with patch("midi_extractor.cli.send_to_pi", return_value=True):
            main(["https://youtube.com/watch?v=test"])
            mock_extract.assert_called_once()
            call_kwargs = mock_extract.call_args[1]
            assert call_kwargs["url"] == "https://youtube.com/watch?v=test"
            assert call_kwargs["separate"] is False


def test_cli_with_separate_flag():
    """CLI --separate flag should enable piano separation."""
    with patch("midi_extractor.cli.extract_midi", return_value="songs/test.mid") as mock_extract:
        with patch("midi_extractor.cli.send_to_pi", return_value=True):
            main(["https://youtube.com/watch?v=test", "--separate"])
            call_kwargs = mock_extract.call_args[1]
            assert call_kwargs["separate"] is True


def test_cli_with_name_flag():
    """CLI --name flag should set the song name."""
    with patch("midi_extractor.cli.extract_midi", return_value="songs/fur_elise.mid") as mock_extract:
        with patch("midi_extractor.cli.send_to_pi", return_value=True):
            main(["https://youtube.com/watch?v=test", "--name", "fur_elise"])
            call_kwargs = mock_extract.call_args[1]
            assert call_kwargs["name"] == "fur_elise"


def test_cli_no_sync_flag():
    """CLI --no-sync flag should skip syncing to Pi."""
    with patch("midi_extractor.cli.extract_midi", return_value="songs/test.mid"):
        with patch("midi_extractor.cli.send_to_pi") as mock_sync:
            main(["https://youtube.com/watch?v=test", "--no-sync"])
            mock_sync.assert_not_called()
