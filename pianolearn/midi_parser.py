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

    Hand detection: track 0 or tracks named with 'right'/'treble' -> right hand.
    Track 1 or tracks named with 'left'/'bass' -> left hand.
    If only one track, split at middle C (note 60): >= 60 is right, < 60 is left.
    """
    mid = mido.MidiFile(midi_path)
    events = []

    for track_idx, track in enumerate(mid.tracks):
        hand = _detect_hand(track_idx, track.name, len(mid.tracks))
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


def _detect_hand(track_idx: int, track_name: str, total_tracks: int) -> str | None:
    """Detect which hand a track belongs to. Returns None if ambiguous."""
    name = track_name.lower()
    if any(kw in name for kw in ("right", "treble", "melody", "upper")):
        return "right"
    if any(kw in name for kw in ("left", "bass", "accomp", "lower")):
        return "left"
    if total_tracks == 2:
        return "right" if track_idx == 0 else "left"
    return None
