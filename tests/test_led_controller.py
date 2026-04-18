import pytest
from pianolearn.led_controller import LEDController


def test_led_controller_creates_with_mock():
    ctrl = LEDController(num_leds=144, mock=True)
    assert ctrl.num_leds == 144
    assert ctrl.mock is True


def test_set_note_maps_midi_to_led():
    ctrl = LEDController(num_leds=144, first_note=36, mock=True)
    ctrl.set_note(60, (0, 0, 255))
    assert ctrl.leds[60 - 36] == (0, 0, 255)


def test_set_note_ignores_out_of_range():
    ctrl = LEDController(num_leds=72, first_note=36, mock=True)
    ctrl.set_note(200, (255, 0, 0))  # Should not raise


def test_clear_all():
    ctrl = LEDController(num_leds=72, first_note=36, mock=True)
    ctrl.set_note(60, (0, 0, 255))
    ctrl.clear_all()
    assert all(led == (0, 0, 0) for led in ctrl.leds)


def test_set_brightness():
    ctrl = LEDController(num_leds=72, first_note=36, mock=True)
    ctrl.set_brightness(128)
    assert ctrl.brightness == 128
