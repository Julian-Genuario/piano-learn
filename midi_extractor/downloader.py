# midi_extractor/downloader.py
import subprocess
import os
import sys
import shutil
import uuid


def _find_executable(name: str) -> str:
    """Find executable in virtualenv Scripts dir first, then PATH."""
    venv_dir = os.path.join(os.path.dirname(sys.executable))
    venv_path = os.path.join(venv_dir, f"{name}.exe")
    if os.path.isfile(venv_path):
        return venv_path
    found = shutil.which(name)
    if found:
        return found
    raise FileNotFoundError(f"{name} not found in virtualenv or PATH")


def download_audio(url: str, output_dir: str = "songs") -> str:
    """Download audio from a YouTube URL as WAV. Returns path to the WAV file."""
    os.makedirs(output_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex[:12]}"
    output_path = os.path.join(output_dir, filename)
    output_template = f"{output_path}.%(ext)s"

    ytdlp = _find_executable("yt-dlp")
    cmd = [
        ytdlp,
        "-x",
        "--audio-format", "wav",
        "-o", output_template,
        url
    ]

    env = os.environ.copy()
    # Ensure virtualenv Scripts dir is in PATH for ffmpeg/ffprobe
    venv_dir = os.path.dirname(sys.executable)
    env["PATH"] = venv_dir + os.pathsep + env.get("PATH", "")

    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {result.stderr}")

    wav_path = f"{output_path}.wav"
    return wav_path
