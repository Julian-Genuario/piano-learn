# midi_extractor/pipeline.py
import os
from midi_extractor.downloader import download_audio
from midi_extractor.separator import separate_piano
from midi_extractor.transcriber import transcribe_to_midi


def extract_midi(
    url: str,
    name: str | None = None,
    separate: bool = False,
    output_dir: str = "songs",
    on_progress: callable = None
) -> str:
    """Full pipeline: YouTube URL → MIDI file. Returns path to MIDI."""

    def report(msg: str):
        if on_progress:
            on_progress(msg)

    # Step 1: Download
    report("Downloading audio...")
    wav_path = download_audio(url, output_dir=output_dir)

    # Step 2: Separate piano (optional)
    audio_path = wav_path
    if separate:
        report("Separating piano with demucs...")
        audio_path = separate_piano(wav_path)

    # Step 3: Transcribe to MIDI
    report("Transcribing to MIDI...")
    if name is None:
        name = os.path.splitext(os.path.basename(wav_path))[0]
    midi_path = f"{output_dir}/{name}.mid"
    result = transcribe_to_midi(audio_path, midi_path)

    # Cleanup intermediate files
    report("Cleaning up...")
    os.remove(wav_path)
    if separate and audio_path != wav_path:
        os.remove(audio_path)

    report("Done!")
    return result
