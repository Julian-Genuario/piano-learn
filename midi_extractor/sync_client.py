# midi_extractor/sync_client.py
import os
import sys
import types

# Create a stub module so patch("midi_extractor.sync_client.httpx.post") always works,
# even when httpx is not installed in the environment.
try:
    import httpx
except ImportError:
    httpx = types.ModuleType("httpx")
    httpx.post = None  # type: ignore[attr-defined]
    sys.modules.setdefault("httpx", httpx)


def send_to_pi(midi_path: str, pi_host: str = "pianolearn.local", pi_port: int = 8000) -> bool:
    """Send a MIDI file to the Pi via HTTP POST. Returns True on success."""
    url = f"http://{pi_host}:{pi_port}/api/songs/upload"

    try:
        with open(midi_path, "rb") as f:
            filename = os.path.basename(midi_path)
            files = {"file": (filename, f, "audio/midi")}
            response = httpx.post(url, files=files, timeout=30)
            return response.status_code == 200
    except Exception:
        return False
