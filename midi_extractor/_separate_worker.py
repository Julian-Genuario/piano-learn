"""Worker script for source separation with demucs.
Saves output with soundfile to avoid torchcodec issues on Windows."""
import sys
import os

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"


def main():
    wav_path = sys.argv[1]
    output_dir = sys.argv[2]

    import torch
    from demucs.pretrained import get_model
    from demucs.apply import apply_model
    import soundfile as sf
    import numpy as np
    import librosa

    model = get_model("htdemucs")
    model.eval()

    # Load with librosa (avoids torchaudio/torchcodec issues)
    audio, sr_orig = librosa.load(wav_path, sr=model.samplerate, mono=False)
    if audio.ndim == 1:
        audio = np.stack([audio, audio])
    wav = torch.from_numpy(audio).float()
    sr = model.samplerate

    # Resample to model's sample rate if needed
    if sr != model.samplerate:
        wav = torchaudio.functional.resample(wav, sr, model.samplerate)
        sr = model.samplerate

    # Make stereo if mono
    if wav.shape[0] == 1:
        wav = wav.repeat(2, 1)

    ref = wav.mean(0)
    wav = (wav - ref.mean()) / ref.std()

    with torch.no_grad():
        sources = apply_model(model, wav[None], device="cpu")[0]

    sources = sources * ref.std() + ref.mean()

    # Find vocals index and create no_vocals
    src_names = model.sources  # e.g. ['drums', 'bass', 'other', 'vocals']
    vocals_idx = src_names.index("vocals") if "vocals" in src_names else -1

    stem_name = os.path.splitext(os.path.basename(wav_path))[0]
    out_path = os.path.join(output_dir, stem_name)
    os.makedirs(out_path, exist_ok=True)

    if vocals_idx >= 0:
        # Sum everything except vocals
        no_vocals = torch.zeros_like(sources[0])
        for i, name in enumerate(src_names):
            if name != "vocals":
                no_vocals += sources[i]
        audio = no_vocals.numpy().T
        out_file = os.path.join(out_path, "no_vocals.wav")
    else:
        # Just use 'other' source
        audio = sources[0].numpy().T
        out_file = os.path.join(out_path, "other.wav")

    # Normalize to prevent clipping
    peak = np.abs(audio).max()
    if peak > 0.95:
        audio = audio * 0.95 / peak

    sf.write(out_file, audio, sr)
    print(f"OK: {out_file}")


if __name__ == "__main__":
    main()
