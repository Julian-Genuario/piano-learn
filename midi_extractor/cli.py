# midi_extractor/cli.py
import argparse
import sys
from midi_extractor.pipeline import extract_midi
from midi_extractor.sync_client import send_to_pi


def main(argv: list[str] | None = None):
    parser = argparse.ArgumentParser(description="Extract MIDI from YouTube videos")
    parser.add_argument("url", help="YouTube video URL")
    parser.add_argument("--name", help="Song name for the output file")
    parser.add_argument("--separate", action="store_true", help="Separate piano from other instruments")
    parser.add_argument("--no-sync", action="store_true", help="Don't sync to Pi")
    parser.add_argument("--pi-host", default="pianolearn.local", help="Pi hostname or IP")

    args = parser.parse_args(argv)

    def on_progress(msg: str):
        print(f"  {msg}")

    print(f"Extracting MIDI from: {args.url}")
    midi_path = extract_midi(
        url=args.url,
        name=args.name,
        separate=args.separate,
        on_progress=on_progress
    )
    print(f"MIDI saved to: {midi_path}")

    if not args.no_sync:
        print(f"Syncing to Pi ({args.pi_host})...")
        if send_to_pi(midi_path, pi_host=args.pi_host):
            print("Synced successfully!")
        else:
            print("Could not reach Pi - MIDI saved locally only.")


if __name__ == "__main__":
    main()
