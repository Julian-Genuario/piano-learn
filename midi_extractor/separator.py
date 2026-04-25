# midi_extractor/separator.py
import subprocess
import os
import sys


def separate_piano(wav_path: str, output_dir: str = "separated") -> str:
    """Isolate non-vocal audio using demucs. Returns path to separated WAV."""
    # Use venv-extractor python (has demucs/torch)
    project_root = os.path.dirname(os.path.dirname(__file__))
    venv_python = os.path.join(project_root, ".venv-extractor", "Scripts", "python.exe")
    if not os.path.isfile(venv_python):
        venv_python = os.path.join(project_root, ".venv-extractor", "bin", "python")
    python = venv_python if os.path.isfile(venv_python) else sys.executable

    script = os.path.join(os.path.dirname(__file__), "_separate_worker.py")
    cmd = [python, script, wav_path, output_dir]

    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600, env=env)
    if result.returncode != 0:
        raise RuntimeError(f"demucs failed: {result.stderr[-500:]}")

    # Find the output file
    stem_name = os.path.splitext(os.path.basename(wav_path))[0]
    for name in ["no_vocals.wav", "other.wav"]:
        path = os.path.join(output_dir, stem_name, name)
        if os.path.isfile(path):
            return path

    raise RuntimeError(f"No separated stem found in {output_dir}/{stem_name}")
