"""Worker script for MIDI transcription. Runs in a subprocess to avoid
threading issues with the main server.

Supports two backends:
  - piano_transcription_inference (ByteDance) - best quality for piano
  - basic_pitch (Spotify) - fallback
"""
import sys
import os

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"


def _load_audio(path, sr=16000):
    """Load audio file resampled to target sample rate, mono."""
    import librosa
    audio, _ = librosa.load(path, sr=sr, mono=True)
    return audio


def transcribe_bytedance(wav_path, output_path):
    """High-quality piano transcription using ByteDance model."""
    import torch
    from piano_transcription_inference import PianoTranscription, sample_rate

    audio = _load_audio(wav_path, sr=sample_rate)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    transcriptor = PianoTranscription(device=device)
    transcriptor.transcribe(audio, output_path)

    # Post-process
    import pretty_midi
    midi_data = pretty_midi.PrettyMIDI(output_path)
    for instrument in midi_data.instruments:
        notes = instrument.notes
        # Remove very quiet notes
        notes = [n for n in notes if n.velocity > 20]
        # Remove extremely short notes (< 25ms)
        notes = [n for n in notes if (n.end - n.start) > 0.025]
        instrument.notes = notes
    midi_data.write(output_path)

    total = sum(len(i.notes) for i in midi_data.instruments)
    print(f"OK: {total} notes (bytedance)")


def transcribe_basic_pitch(wav_path, output_path, onset_threshold, frame_threshold, min_note_length_ms):
    """Fallback transcription using basic-pitch."""
    from basic_pitch.inference import predict
    _, midi_data, _ = predict(
        wav_path,
        onset_threshold=onset_threshold,
        frame_threshold=frame_threshold,
        minimum_note_length=min_note_length_ms,
        melodia_trick=True,
    )
    for instrument in midi_data.instruments:
        notes = instrument.notes
        notes = [n for n in notes if n.velocity > 15]
        notes = [n for n in notes if (n.end - n.start) > 0.030]
        for n in notes:
            n.start = round(n.start * 50) / 50
            if n.end <= n.start:
                n.end = n.start + 0.05
        notes.sort(key=lambda n: (n.pitch, n.start))
        cleaned = []
        for n in notes:
            if cleaned and cleaned[-1].pitch == n.pitch and n.start < cleaned[-1].end - 0.01:
                if n.velocity > cleaned[-1].velocity:
                    cleaned[-1] = n
                continue
            cleaned.append(n)
        instrument.notes = cleaned
    midi_data.write(output_path)
    total = sum(len(i.notes) for i in midi_data.instruments)
    print(f"OK: {total} notes (basic_pitch)")


def main():
    wav_path = sys.argv[1]
    output_path = sys.argv[2]
    backend = sys.argv[3] if len(sys.argv) > 3 else "bytedance"

    if backend == "bytedance":
        try:
            transcribe_bytedance(wav_path, output_path)
        except Exception as e:
            print(f"WARN: bytedance failed ({e}), falling back to basic_pitch", file=sys.stderr)
            transcribe_basic_pitch(wav_path, output_path, 0.45, 0.25, 58)
    else:
        onset = float(sys.argv[4]) if len(sys.argv) > 4 else 0.45
        frame = float(sys.argv[5]) if len(sys.argv) > 5 else 0.25
        minlen = float(sys.argv[6]) if len(sys.argv) > 6 else 58
        transcribe_basic_pitch(wav_path, output_path, onset, frame, minlen)


if __name__ == "__main__":
    main()
