# midi_extractor/transcriber.py
import os
import sys
import subprocess
import shutil


def _find_basic_pitch() -> str:
    """Find basic-pitch executable."""
    venv_dir = os.path.dirname(sys.executable)
    for name in ("basic-pitch.exe", "basic-pitch"):
        path = os.path.join(venv_dir, name)
        if os.path.isfile(path):
            return path
    found = shutil.which("basic-pitch")
    if found:
        return found
    raise FileNotFoundError("basic-pitch not found")


def transcribe_to_midi(wav_path: str, output_path: str | None = None) -> str:
    """Convert a WAV file to MIDI using basic-pitch CLI. Returns path to MIDI file."""
    if output_path is None:
        base = os.path.splitext(wav_path)[0]
        output_path = f"{base}.mid"

    output_dir = os.path.dirname(output_path) or "."
    os.makedirs(output_dir, exist_ok=True)

    bp = _find_basic_pitch()
    cmd = [bp, output_dir, wav_path]
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600, env=env)
    if result.returncode != 0:
        raise RuntimeError(f"basic-pitch failed: {result.stderr[-500:]}")

    # basic-pitch CLI outputs <filename>_basic_pitch.mid
    base_name = os.path.splitext(os.path.basename(wav_path))[0]
    generated = os.path.join(output_dir, f"{base_name}_basic_pitch.mid")
    if os.path.exists(generated) and generated != output_path:
        os.rename(generated, output_path)
    elif not os.path.exists(output_path):
        raise RuntimeError(f"basic-pitch did not produce MIDI file in {output_dir}")

    return output_path
