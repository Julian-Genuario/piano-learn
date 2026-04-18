import pytest
from unittest.mock import patch, MagicMock
from pianolearn.midi_parser import parse_midi, NoteEvent


def test_note_event_has_required_fields():
    """NoteEvent should have note, start_time, duration, velocity, hand."""
    event = NoteEvent(note=60, start_time=0.0, duration=0.5, velocity=100, hand="right")
    assert event.note == 60
    assert event.start_time == 0.0
    assert event.duration == 0.5
    assert event.velocity == 100
    assert event.hand == "right"


def test_parse_midi_returns_note_events():
    """parse_midi should return a list of NoteEvent with timing and hand info."""
    mock_mid = MagicMock()
    track_right = MagicMock()
    track_right.name = "Right"
    track_left = MagicMock()
    track_left.name = "Left"

    msg_on_r = MagicMock(type="note_on", note=60, velocity=100, time=0)
    msg_off_r = MagicMock(type="note_off", note=60, velocity=0, time=480)
    msg_on_l = MagicMock(type="note_on", note=48, velocity=80, time=0)
    msg_off_l = MagicMock(type="note_off", note=48, velocity=0, time=960)

    track_right.__iter__ = lambda self: iter([msg_on_r, msg_off_r])
    track_left.__iter__ = lambda self: iter([msg_on_l, msg_off_l])

    mock_mid.tracks = [track_right, track_left]
    mock_mid.ticks_per_beat = 480

    with patch("pianolearn.midi_parser.mido.MidiFile", return_value=mock_mid):
        events = parse_midi("test.mid")
        assert len(events) == 2
        assert all(isinstance(e, NoteEvent) for e in events)

        right_notes = [e for e in events if e.hand == "right"]
        left_notes = [e for e in events if e.hand == "left"]
        assert len(right_notes) == 1
        assert len(left_notes) == 1
        assert right_notes[0].note == 60
        assert left_notes[0].note == 48
