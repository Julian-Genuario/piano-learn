# midi_extractor/transcriber.py
import os
import sys
import subprocess


def transcribe_to_midi(
    wav_path: str,
    output_path: str | None = None,
    backend: str = "bytedance",
) -> str:
    """Convert a WAV file to MIDI. Returns path to MIDI file.

    backend: "bytedance" (best for piano) or "basic_pitch" (fallback)
    """
    if output_path is None:
        base = os.path.splitext(wav_path)[0]
        output_path = f"{base}.mid"

    output_dir = os.path.dirname(output_path) or "."
    os.makedirs(output_dir, exist_ok=True)

    script = os.path.join(os.path.dirname(__file__), "_transcribe_worker.py")

    # Use venv-extractor python if available (has ML dependencies)
    project_root = os.path.dirname(os.path.dirname(__file__))
    venv_python = os.path.join(project_root, ".venv-extractor", "Scripts", "python.exe")
    if not os.path.isfile(venv_python):
        venv_python = os.path.join(project_root, ".venv-extractor", "bin", "python")
    python = venv_python if os.path.isfile(venv_python) else sys.executable

    cmd = [python, script, wav_path, output_path, backend]

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600, env=env)
    if result.returncode != 0:
        raise RuntimeError(f"Transcription failed: {result.stderr[-500:]}")

    if not os.path.exists(output_path):
        raise RuntimeError(f"Transcription did not produce MIDI file: {output_path}")

    return output_path
