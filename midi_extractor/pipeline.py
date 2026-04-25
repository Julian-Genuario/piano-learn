# midi_extractor/pipeline.py
import os
import shutil
from midi_extractor.downloader import download_audio
from midi_extractor.separator import separate_piano
from midi_extractor.transcriber import transcribe_to_midi


def extract_midi(
    url: str,
    name: str | None = None,
    separate: bool = True,
    output_dir: str = "songs",
    on_progress: callable = None
) -> str:
    """Full pipeline: YouTube URL -> MIDI file. Returns path to MIDI.

    separate=True uses demucs to isolate piano before transcription (recommended).
    """

    def report(msg: str):
        if on_progress:
            on_progress(msg)

    # Step 1: Download
    report("Descargando audio...")
    wav_path = download_audio(url, output_dir=output_dir)

    # Step 2: Separate piano (removes vocals, drums, etc.)
    audio_path = wav_path
    if separate:
        try:
            report("Separando piano con demucs...")
            audio_path = separate_piano(wav_path)
        except Exception as e:
            report(f"Demucs fallo ({e}), usando audio original...")
            audio_path = wav_path

    # Step 3: Transcribe to MIDI
    report("Transcribiendo a MIDI (piano_transcription)...")
    if name is None:
        name = os.path.splitext(os.path.basename(wav_path))[0]
    midi_path = f"{output_dir}/{name}.mid"
    result = transcribe_to_midi(audio_path, midi_path, backend="bytedance")

    # Cleanup intermediate files
    report("Limpiando archivos temporales...")
    if os.path.exists(wav_path):
        os.remove(wav_path)
    if separate and audio_path != wav_path and os.path.exists(audio_path):
        # Remove demucs output directory
        separated_dir = os.path.dirname(audio_path)
        shutil.rmtree(separated_dir, ignore_errors=True)
        # Try to clean parent dirs if empty
        parent = os.path.dirname(separated_dir)
        try:
            os.removedirs(parent)
        except OSError:
            pass

    report("Listo!")
    return result
