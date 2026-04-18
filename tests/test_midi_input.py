import pytest
from unittest.mock import patch, MagicMock
from pianolearn.midi_input import MidiInput


def test_midi_input_lists_ports():
    with patch("pianolearn.midi_input.mido.get_input_names", return_value=["Piano USB", "Other Device"]):
        ports = MidiInput.list_ports()
        assert "Piano USB" in ports


def test_midi_input_callback_on_note_on():
    received = []

    def on_note(note: int, velocity: int, is_on: bool):
        received.append((note, velocity, is_on))

    midi_in = MidiInput(on_note=on_note, mock=True)
    midi_in._handle_message(MagicMock(type="note_on", note=60, velocity=100))
    assert received == [(60, 100, True)]


def test_midi_input_callback_on_note_off():
    received = []

    def on_note(note: int, velocity: int, is_on: bool):
        received.append((note, velocity, is_on))

    midi_in = MidiInput(on_note=on_note, mock=True)
    midi_in._handle_message(MagicMock(type="note_off", note=60, velocity=0))
    assert received == [(60, 0, False)]
