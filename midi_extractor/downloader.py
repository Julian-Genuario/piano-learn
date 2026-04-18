# midi-extractor/downloader.py
import subprocess
import os
import uuid


def download_audio(url: str, output_dir: str = "songs") -> str:
    """Download audio from a YouTube URL as WAV. Returns path to the WAV file."""
    os.makedirs(output_dir, exist_ok=True)
    filename = f"{uuid.uuid4().hex[:12]}"
    output_path = os.path.join(output_dir, filename)
    output_template = f"{output_path}.%(ext)s"

    cmd = [
        "yt-dlp",
        "-x",
        "--audio-format", "wav",
        "-o", output_template,
        url
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {result.stderr}")

    wav_path = f"{output_path}.wav"
    return wav_path
