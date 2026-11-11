"""Small JSON settings file: save mode, window size, theme, recent folders.

Stored in %APPDATA%\\PDFu\\settings.json on Windows (~/.config/pdfu elsewhere).
Passwords are never stored here or anywhere else.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

DEFAULTS = {
    "save_mode": "same",      # "same" = next to the original, "ask" = pick a folder each time
    "size": "small",          # "small" (820 x 860) or "normal" (2x, true-scale deck)
    "theme": "auto",          # "auto" follows Windows, or "light" / "dark"
    "recent_folders": [],     # folders chosen in ASK EACH TIME mode, newest first
}
ALLOWED = {
    "save_mode": {"same", "ask"},
    "size": {"small", "normal"},
    "theme": {"auto", "light", "dark"},
}
MAX_RECENT = 5


def settings_dir() -> Path:
    if sys.platform.startswith("win"):
        base = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
        return Path(base) / "PDFu"
    base = os.environ.get("XDG_CONFIG_HOME") or str(Path.home() / ".config")
    return Path(base) / "pdfu"


class Settings:
    def __init__(self, path: Path | None = None):
        self.path = path or (settings_dir() / "settings.json")
        self.data: dict = {k: (list(v) if isinstance(v, list) else v) for k, v in DEFAULTS.items()}
        self.load()

    def load(self) -> None:
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            return
        if not isinstance(raw, dict):
            return
        for key, allowed in ALLOWED.items():
            if raw.get(key) in allowed:
                self.data[key] = raw[key]
        recent = raw.get("recent_folders")
        if isinstance(recent, list):
            self.data["recent_folders"] = [str(p) for p in recent if isinstance(p, str)][:MAX_RECENT]

    def save(self) -> None:
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=self.path.parent, prefix=".settings-", suffix=".tmp")
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(self.data, f, indent=2)
            os.replace(tmp, self.path)
        except OSError:
            pass  # settings are a convenience; never let them break the app

    def get(self, key: str):
        return self.data.get(key, DEFAULTS.get(key))

    def set(self, key: str, value) -> bool:
        if key not in ALLOWED or value not in ALLOWED[key]:
            return False
        if self.data.get(key) != value:
            self.data[key] = value
            self.save()
        return True

    def add_recent_folder(self, folder: str) -> None:
        norm = os.path.normcase(os.path.normpath(folder))
        recent = [p for p in self.data["recent_folders"] if os.path.normcase(os.path.normpath(p)) != norm]
        recent.insert(0, folder)
        self.data["recent_folders"] = recent[:MAX_RECENT]
        self.save()

    def recent_folders(self) -> list[str]:
        return [p for p in self.data["recent_folders"] if os.path.isdir(p)]
