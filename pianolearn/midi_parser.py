from dataclasses import dataclass
import mido


@dataclass
class NoteEvent:
    note: int           # MIDI note number (21-108 for piano)
    start_time: float   # Start time in seconds
    duration: float     # Duration in seconds
    velocity: int       # 0-127
    hand: str           # "right" or "left"


def parse_midi(midi_path: str) -> list[NoteEvent]:
    """Parse a MIDI file and return a list of NoteEvents with hand assignment.

    Hand detection: tracks named with 'right'/'treble' -> right hand.
    Tracks named with 'left'/'bass' -> left hand.
    For unnamed tracks: if 2 tracks, assign first non-empty to right, second to left.
    For single track, split at middle C (note 60): >= 60 is right, < 60 is left.
    """
    mid = mido.MidiFile(midi_path)
    events = []

    # Find which tracks have notes
    tracks_with_notes = []
    for track_idx, track in enumerate(mid.tracks):
        has_notes = any(hasattr(msg, 'type') and msg.type in ('note_on', 'note_off') for msg in track)
        if has_notes:
            tracks_with_notes.append(track_idx)

    for track_idx, track in enumerate(mid.tracks):
        # Skip tracks with no notes
        has_notes = track_idx in tracks_with_notes
        if not has_notes:
            continue

        hand = _detect_hand(track_idx, track.name, len(mid.tracks), tracks_with_notes)
        active_notes: dict[int, tuple[float, int]] = {}
        current_time = 0.0
        tempo = 500000  # default 120 BPM

        for msg in track:
            current_time += mido.tick2second(msg.time, mid.ticks_per_beat, tempo)

            if hasattr(msg, 'type'):
                if msg.type == 'set_tempo':
                    tempo = msg.tempo
                elif msg.type == 'note_on' and msg.velocity > 0:
                    active_notes[msg.note] = (current_time, msg.velocity)
                elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
                    if msg.note in active_notes:
                        start, velocity = active_notes.pop(msg.note)
                        note_hand = hand if hand else ("right" if msg.note >= 60 else "left")
                        events.append(NoteEvent(
                            note=msg.note,
                            start_time=start,
                            duration=current_time - start,
                            velocity=velocity,
                            hand=note_hand
                        ))

    events.sort(key=lambda e: e.start_time)
    return events


def _detect_hand(track_idx: int, track_name: str, total_tracks: int, tracks_with_notes: list[int]) -> str | None:
    """Detect which hand a track belongs to. Returns None if ambiguous."""
    name = track_name.lower()
    if any(kw in name for kw in ("right", "treble", "melody", "upper")):
        return "right"
    if any(kw in name for kw in ("left", "bass", "accomp", "lower")):
        return "left"

    # For unnamed tracks with notes, assign based on position in tracks_with_notes
    if len(tracks_with_notes) == 2 and track_idx in tracks_with_notes:
        position = tracks_with_notes.index(track_idx)
        return "right" if position == 0 else "left"

    return None
