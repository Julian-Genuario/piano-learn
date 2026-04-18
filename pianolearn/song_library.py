import os
from datetime import datetime


class SongLibrary:
    """Manages MIDI files in the songs directory."""

    def __init__(self, songs_dir: str = "songs"):
        self.songs_dir = songs_dir
        os.makedirs(songs_dir, exist_ok=True)

    def list_songs(self) -> list[dict]:
        """List all MIDI files in the library."""
        songs = []
        for filename in sorted(os.listdir(self.songs_dir)):
            if filename.lower().endswith((".mid", ".midi")):
                filepath = os.path.join(self.songs_dir, filename)
                name = os.path.splitext(filename)[0]
                stat = os.stat(filepath)
                songs.append({
                    "name": name,
                    "filename": filename,
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat()
                })
        return songs

    def get_song(self, name: str) -> dict | None:
        """Get song details by name."""
        for song in self.list_songs():
            if song["name"] == name:
                return song
        return None

    def get_song_path(self, name: str) -> str | None:
        """Get the full path to a song file."""
        song = self.get_song(name)
        if song:
            return os.path.join(self.songs_dir, song["filename"])
        return None

    def save_song(self, filename: str, data: bytes) -> str:
        """Save uploaded MIDI data to the library. Returns the file path."""
        filepath = os.path.join(self.songs_dir, filename)
        with open(filepath, "wb") as f:
            f.write(data)
        return filepath

    def delete_song(self, name: str) -> bool:
        """Delete a song by name. Returns True if deleted."""
        path = self.get_song_path(name)
        if path and os.path.exists(path):
            os.remove(path)
            return True
        return False
