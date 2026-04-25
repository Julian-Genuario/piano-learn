import os
import json
from datetime import datetime


class SongLibrary:
    """Manages MIDI files in the songs directory."""

    def __init__(self, songs_dir: str = "songs"):
        self.songs_dir = songs_dir
        os.makedirs(songs_dir, exist_ok=True)
        self._meta_path = os.path.join(songs_dir, "_metadata.json")
        self._meta = self._load_meta()

    def _load_meta(self) -> dict:
        if os.path.exists(self._meta_path):
            with open(self._meta_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def _save_meta(self):
        with open(self._meta_path, "w", encoding="utf-8") as f:
            json.dump(self._meta, f, indent=2, ensure_ascii=False)

    def _get_song_meta(self, name: str) -> dict:
        return self._meta.get(name, {})

    def set_song_meta(self, name: str, **kwargs):
        if name not in self._meta:
            self._meta[name] = {}
        self._meta[name].update(kwargs)
        self._save_meta()

    def list_songs(self) -> list[dict]:
        songs = []
        for filename in sorted(os.listdir(self.songs_dir)):
            if filename.lower().endswith((".mid", ".midi")):
                filepath = os.path.join(self.songs_dir, filename)
                name = os.path.splitext(filename)[0]
                stat = os.stat(filepath)
                meta = self._get_song_meta(name)
                songs.append({
                    "name": name,
                    "filename": filename,
                    "size": stat.st_size,
                    "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "difficulty": meta.get("difficulty", ""),
                    "practice_count": meta.get("practice_count", 0),
                    "last_practiced": meta.get("last_practiced", ""),
                })
        return songs

    def get_song(self, name: str) -> dict | None:
        for song in self.list_songs():
            if song["name"] == name:
                return song
        return None

    def get_song_path(self, name: str) -> str | None:
        song = self.get_song(name)
        if song:
            return os.path.join(self.songs_dir, song["filename"])
        return None

    def save_song(self, filename: str, data: bytes) -> str:
        filepath = os.path.join(self.songs_dir, filename)
        with open(filepath, "wb") as f:
            f.write(data)
        return filepath

    def delete_song(self, name: str) -> bool:
        path = self.get_song_path(name)
        if path and os.path.exists(path):
            os.remove(path)
            if name in self._meta:
                del self._meta[name]
                self._save_meta()
            return True
        return False

    def record_practice(self, name: str):
        meta = self._get_song_meta(name)
        count = meta.get("practice_count", 0) + 1
        self.set_song_meta(name,
                           practice_count=count,
                           last_practiced=datetime.now().isoformat())
