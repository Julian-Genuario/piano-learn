import pytest
from pianolearn.midi_parser import NoteEvent
from pianolearn.midi_player import MidiPlayer


def make_events():
    return [
        NoteEvent(note=60, start_time=0.0, duration=0.5, velocity=100, hand="right"),
        NoteEvent(note=48, start_time=0.0, duration=0.5, velocity=80, hand="left"),
        NoteEvent(note=62, start_time=0.5, duration=0.5, velocity=100, hand="right"),
    ]


def test_player_karaoke_get_active_notes():
    player = MidiPlayer(events=make_events(), mode="karaoke")
    active = player.get_active_notes(current_time=0.25)
    notes = [n.note for n in active]
    assert 60 in notes
    assert 48 in notes
    assert 62 not in notes


def test_player_karaoke_get_upcoming_notes():
    player = MidiPlayer(events=make_events(), mode="karaoke")
    upcoming = player.get_upcoming_notes(current_time=0.0, window=2.0)
    assert len(upcoming) == 3


def test_player_learning_mode_waits():
    player = MidiPlayer(events=make_events(), mode="learning")
    waiting = player.get_waiting_notes()
    notes = [n.note for n in waiting]
    assert 60 in notes
    assert 48 in notes

    player.note_played(60)
    waiting = player.get_waiting_notes()
    assert 60 not in [n.note for n in waiting]
    assert 48 in [n.note for n in waiting]

    player.note_played(48)
    waiting = player.get_waiting_notes()
    assert 62 in [n.note for n in waiting]


def test_player_speed():
    player = MidiPlayer(events=make_events(), mode="karaoke", speed=0.5)
    active = player.get_active_notes(current_time=0.9)
    assert 62 not in [n.note for n in active]
    active = player.get_active_notes(current_time=1.1)
    assert 62 in [n.note for n in active]
