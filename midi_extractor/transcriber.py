# midi_extractor/transcriber.py
import os

try:
    from basic_pitch.inference import predict
except ImportError:  # pragma: no cover
    predict = None  # type: ignore[assignment]


def transcribe_to_midi(wav_path: str, output_path: str | None = None) -> str:
    """Convert a WAV file to MIDI using basic-pitch. Returns path to MIDI file."""
    if output_path is None:
        base = os.path.splitext(wav_path)[0]
        output_path = f"{base}.mid"

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    _model_output, midi_data, _note_events = predict(wav_path)
    midi_data.write(output_path)

    return output_path
