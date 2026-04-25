# midi_extractor/downloader.py
import subprocess
import os
import sys
import shutil
import uuid

# Extra paths to search for executables (yt-dlp, ffmpeg, etc.)
_EXTRA_PATHS = [
    os.path.join(os.path.expanduser("~"), ".deno", "bin"),
    os.path.dirname(sys.executable),
    os.path.join(os.path.dirname(sys.executable), "Scripts"),
]


def _get_env():
    """Get environment with extra paths for subprocess calls."""
    env = os.environ.copy()
    extra = os.pathsep.join(p for p in _EXTRA_PATHS if os.path.isdir(p))
    env["PATH"] = extra + os.pathsep + env.get("PATH", "")
    return env


def _find_executable(name: str) -> str:
    """Find executable in virtualenv Scripts dir first, then PATH."""
    for d in _EXTRA_PATHS:
        path = os.path.join(d, f"{name}.exe")
        if os.path.isfile(path):
            return path
        path = os.path.join(d, name)
        if os.path.isfile(path):
            return path
    found = shutil.which(name)
    if found:
        return found
    raise FileNotFoundError(f"{name} not found in virtualenv or PATH")


def download_audio(url: str, output_dir: str = "songs") -> tuple[str, str]:
    """Download audio from a YouTube URL as WAV. Returns (wav_path, title)."""
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

    result = subprocess.run(cmd, capture_output=True, text=True, env=_get_env(), timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {result.stderr}")

    wav_path = f"{output_path}.wav"
    if not os.path.isfile(wav_path):
        raise RuntimeError(f"yt-dlp did not produce WAV file: {wav_path}")

    # Get title from yt-dlp
    cmd_title = [
        ytdlp,
        "-e",
        url
    ]
    result_title = subprocess.run(cmd_title, capture_output=True, text=True, env=_get_env(), timeout=30)
    title = result_title.stdout.strip() if result_title.returncode == 0 else "Extracted"

    return wav_path, title
