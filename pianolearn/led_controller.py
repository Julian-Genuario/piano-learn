class LEDController:
    """Controls WS2812B LED strip. Use mock=True for development without hardware."""

    def __init__(self, num_leds: int = 144, first_note: int = 36, pin: int = 18,
                 brightness: int = 50, mock: bool = False):
        self.num_leds = num_leds
        self.first_note = first_note
        self.last_note = first_note + num_leds - 1
        self.pin = pin
        self.brightness = brightness
        self.mock = mock
        self.leds: list[tuple[int, int, int]] = [(0, 0, 0)] * num_leds
        self._strip = None

        if not mock:
            self._init_hardware()

    def _init_hardware(self):
        """Initialize the real WS2812B strip via rpi_ws281x."""
        from rpi_ws281x import PixelStrip
        self._strip = PixelStrip(self.num_leds, self.pin, brightness=self.brightness)
        self._strip.begin()

    def set_note(self, midi_note: int, color: tuple[int, int, int]):
        """Light up the LED for a given MIDI note."""
        idx = midi_note - self.first_note
        if idx < 0 or idx >= self.num_leds:
            return
        self.leds[idx] = color
        self._update_led(idx, color)

    def clear_note(self, midi_note: int):
        """Turn off the LED for a given MIDI note."""
        self.set_note(midi_note, (0, 0, 0))

    def clear_all(self):
        """Turn off all LEDs."""
        self.leds = [(0, 0, 0)] * self.num_leds
        if not self.mock and self._strip:
            from rpi_ws281x import Color
            for i in range(self.num_leds):
                self._strip.setPixelColor(i, Color(0, 0, 0))
            self._strip.show()

    def set_brightness(self, brightness: int):
        """Set LED brightness (0-255)."""
        self.brightness = max(0, min(255, brightness))
        if not self.mock and self._strip:
            self._strip.setBrightness(self.brightness)
            self._strip.show()

    def show(self):
        """Push current LED state to hardware."""
        if not self.mock and self._strip:
            self._strip.show()

    def _update_led(self, idx: int, color: tuple[int, int, int]):
        """Update a single LED on the hardware."""
        if not self.mock and self._strip:
            from rpi_ws281x import Color
            r, g, b = color
            self._strip.setPixelColor(idx, Color(r, g, b))
            self._strip.show()
