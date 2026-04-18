from typing import Callable
import mido


class MidiInput:
    """Reads MIDI input from a USB-connected piano."""

    def __init__(self, on_note: Callable[[int, int, bool], None],
                 port_name: str | None = None, mock: bool = False):
        self.on_note = on_note
        self.mock = mock
        self._port = None

        if not mock and port_name:
            self._port = mido.open_input(port_name, callback=self._handle_message)

    @staticmethod
    def list_ports() -> list[str]:
        """List available MIDI input ports."""
        return mido.get_input_names()

    def _handle_message(self, msg):
        """Process incoming MIDI message."""
        if msg.type == "note_on" and msg.velocity > 0:
            self.on_note(msg.note, msg.velocity, True)
        elif msg.type == "note_off" or (msg.type == "note_on" and msg.velocity == 0):
            self.on_note(msg.note, msg.velocity, False)

    def start(self, port_name: str):
        """Start listening on a MIDI port."""
        if self.mock:
            return
        self._port = mido.open_input(port_name, callback=self._handle_message)

    def stop(self):
        """Stop listening."""
        if self._port:
            self._port.close()
            self._port = None
