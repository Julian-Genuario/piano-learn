# midi_extractor/transcriber.py
import os
import subprocess

try:
    from basic_pitch.inference import predict
except ImportError:
    predict = None


def transcribe_to_midi(wav_path: str, output_path: str | None = None) -> str:
    """Convert a WAV file to MIDI using basic-pitch. Returns path to MIDI file."""
    if output_path is None:
        base = os.path.splitext(wav_path)[0]
        output_path = f"{base}.mid"

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    if predict is not None:
        # Use library directly if available
        _model_output, midi_data, _note_events = predict(wav_path)
        midi_data.write(output_path)
    else:
        # Fallback: use basic-pitch CLI
        output_dir = os.path.dirname(output_path) or "."
        cmd = [
            "basic-pitch",
            output_dir,
            wav_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"basic-pitch failed: {result.stderr}")

        # basic-pitch CLI outputs <filename>_basic_pitch.mid
        base_name = os.path.splitext(os.path.basename(wav_path))[0]
        generated = os.path.join(output_dir, f"{base_name}_basic_pitch.mid")
        if os.path.exists(generated) and generated != output_path:
            os.rename(generated, output_path)

    return output_path
