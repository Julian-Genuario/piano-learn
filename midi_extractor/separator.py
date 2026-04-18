# midi_extractor/separator.py
import subprocess
import glob
import os


def separate_piano(wav_path: str, output_dir: str = "separated") -> str:
    """Isolate piano from a WAV file using demucs. Returns path to piano stem."""
    cmd = [
        "python", "-m", "demucs",
        "--two-stems", "other",
        "-o", output_dir,
        wav_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"demucs failed: {result.stderr}")

    stem_name = os.path.splitext(os.path.basename(wav_path))[0]
    pattern = os.path.join(output_dir, "htdemucs", stem_name, "no_other.wav")
    matches = glob.glob(pattern)

    if not matches:
        pattern = os.path.join(output_dir, "htdemucs", stem_name, "*.wav")
        matches = glob.glob(pattern)
        if not matches:
            raise RuntimeError(f"No piano stem found in {output_dir}")

    return matches[0]
