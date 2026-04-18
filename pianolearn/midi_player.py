from pianolearn.midi_parser import NoteEvent


class MidiPlayer:
    """Playback engine for MIDI note events. Supports karaoke and learning modes."""

    def __init__(self, events: list[NoteEvent], mode: str = "karaoke", speed: float = 1.0):
        self.events = events
        self.mode = mode
        self.speed = speed
        self._learning_index = 0
        self._played_notes: set[int] = set()

    def get_active_notes(self, current_time: float) -> list[NoteEvent]:
        """Return notes that should be sounding at the given time (karaoke mode)."""
        scaled_time = current_time * self.speed
        return [
            e for e in self.events
            if e.start_time <= scaled_time < e.start_time + e.duration
        ]

    def get_upcoming_notes(self, current_time: float, window: float = 3.0) -> list[NoteEvent]:
        """Return notes in a future time window (for falling note display)."""
        scaled_time = current_time * self.speed
        end_time = scaled_time + window
        return [
            e for e in self.events
            if e.start_time < end_time and e.start_time + e.duration > scaled_time
        ]

    def get_waiting_notes(self) -> list[NoteEvent]:
        """Return notes waiting to be played (learning mode)."""
        if self._learning_index >= len(self.events):
            return []

        current_time = self.events[self._learning_index].start_time
        waiting = []
        for i in range(self._learning_index, len(self.events)):
            e = self.events[i]
            if abs(e.start_time - current_time) < 0.05:
                if e.note not in self._played_notes:
                    waiting.append(e)
            else:
                break
        return waiting

    def note_played(self, note: int):
        """Register that a note was played (learning mode)."""
        self._played_notes.add(note)

        if not self.get_waiting_notes():
            current_time = self.events[self._learning_index].start_time
            while self._learning_index < len(self.events):
                if abs(self.events[self._learning_index].start_time - current_time) < 0.05:
                    self._learning_index += 1
                else:
                    break
            self._played_notes.clear()

    def is_correct_note(self, note: int) -> bool:
        """Check if a played note is one of the expected notes."""
        waiting = self.get_waiting_notes()
        return note in [n.note for n in waiting]

    def is_finished(self) -> bool:
        """Check if the song is complete."""
        if self.mode == "learning":
            return self._learning_index >= len(self.events)
        return False
