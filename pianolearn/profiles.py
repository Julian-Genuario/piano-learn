import os
import json
import uuid
from datetime import datetime


class ProfileManager:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        self._path = os.path.join(data_dir, "profiles.json")
        self._data = self._load()

    def _load(self) -> dict:
        if os.path.exists(self._path):
            with open(self._path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"profiles": {}}

    def _save(self):
        with open(self._path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, indent=2, ensure_ascii=False)

    def list_profiles(self) -> list[dict]:
        profiles = []
        for pid, p in self._data["profiles"].items():
            profiles.append({"id": pid, **p})
        return sorted(profiles, key=lambda p: p.get("name", ""))

    def create_profile(self, name: str, avatar: str = "", level: str = "principiante") -> dict:
        pid = uuid.uuid4().hex[:8]
        profile = {
            "name": name,
            "avatar": avatar or "🎹",
            "level": level,
            "created": datetime.now().isoformat(),
            "practice": {},  # song_name -> {count, last, best_speed}
            "preferences": {
                "color_right": "#0064ff",
                "color_left": "#00ff64",
                "volume": 50,
                "speed": 100,
            }
        }
        self._data["profiles"][pid] = profile
        self._save()
        return {"id": pid, **profile}

    def get_profile(self, pid: str) -> dict | None:
        p = self._data["profiles"].get(pid)
        if p:
            return {"id": pid, **p}
        return None

    def update_profile(self, pid: str, **kwargs) -> dict | None:
        if pid not in self._data["profiles"]:
            return None
        self._data["profiles"][pid].update(kwargs)
        self._save()
        return {"id": pid, **self._data["profiles"][pid]}

    def delete_profile(self, pid: str) -> bool:
        if pid in self._data["profiles"]:
            del self._data["profiles"][pid]
            self._save()
            return True
        return False

    def record_practice(self, pid: str, song_name: str, speed: int = 100):
        if pid not in self._data["profiles"]:
            return
        practice = self._data["profiles"][pid].setdefault("practice", {})
        entry = practice.get(song_name, {"count": 0, "last": "", "best_speed": 0})
        entry["count"] = entry.get("count", 0) + 1
        entry["last"] = datetime.now().isoformat()
        if speed > entry.get("best_speed", 0):
            entry["best_speed"] = speed
        practice[song_name] = entry
        self._save()

    def get_practice(self, pid: str) -> dict:
        p = self._data["profiles"].get(pid)
        if not p:
            return {}
        return p.get("practice", {})

    def save_preferences(self, pid: str, prefs: dict):
        if pid not in self._data["profiles"]:
            return
        self._data["profiles"][pid]["preferences"] = prefs
        self._save()
