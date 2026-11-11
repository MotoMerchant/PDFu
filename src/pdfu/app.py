"""
PDFu desktop shell.

The window is a borderless pywebview window (Microsoft Edge WebView2 on
Windows) showing the retro device UI in ``ui/``. The UI talks to Python
through ``window.pywebview.api`` (the :class:`Api` class below); Python pushes
progress and dropped files back with ``window.PDFu.*`` calls.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import threading
from pathlib import Path

from . import __version__, engine, winutil
from .settings import Settings, settings_dir

log = logging.getLogger("pdfu")

BASE_WIDTH = 820
# Window heights include the 13 px plastic edge under the case (+1 px slack).
LAYOUT = {
    "small": {"case": 830, "height": 844, "zoom": 1.0},
    "normal": {"case": 864, "height": 878, "zoom": 2.0},
}
CASE_COLORS = {"light": "#DFDDD8", "dark": "#2B2926"}
SCREEN_MARGIN = 24          # keep the window this far inside the work area (logical px)
MIN_NORMAL_ZOOM = 1.2       # below this, Normal is not offered (no real gain over Small)


def resource_dir() -> Path:
    """Folder holding ui/ and assets, both from source and from the PyInstaller build."""
    frozen = getattr(sys, "_MEIPASS", None)
    if frozen:
        return Path(frozen) / "pdfu"
    return Path(__file__).resolve().parent


def icon_path() -> str | None:
    for candidate in (resource_dir() / "assets" / "pdfu.ico",
                      resource_dir().parents[1] / "assets" / "pdfu.ico"):
        if candidate.is_file():
            return str(candidate)
    return None


def fit_zoom(size: str) -> float:
    """The size's zoom (1x or 2x), reduced if needed so the window fits the screen."""
    layout = LAYOUT[size]
    _, _, width, height = winutil.work_area()
    fit = min((width - SCREEN_MARGIN) / BASE_WIDTH, (height - SCREEN_MARGIN) / layout["height"])
    zoom = max(0.5, min(layout["zoom"], fit))
    return int(BASE_WIDTH * zoom) / BASE_WIDTH  # whole-pixel window width


def window_size(size: str, zoom: float) -> tuple[int, int]:
    return int(round(BASE_WIDTH * zoom)), int(round(LAYOUT[size]["height"] * zoom))


def _key(path: str) -> str:
    return os.path.normcase(os.path.abspath(path))


class Api:
    """Everything the UI can ask Python to do. Public methods are exposed to JS."""

    def __init__(self, settings: Settings, startup_files: list[str], size: str, zoom: float):
        self._settings = settings
        self._startup_files = startup_files
        self._size = size
        self._zoom = zoom
        self._window = None
        self._passwords: list[str] = []      # typed this session; memory only, never saved
        self._password_for: dict[str, str] = {}
        self._lock = threading.Lock()
        self._busy = False
        self._close_pending = False
        self._drop_registered = False
        self._theme_seen = winutil.system_theme()

    # ------------------------------------------------------------------ JS API
    def init(self) -> dict:
        return {
            "version": __version__,
            "qpdf": engine.qpdf_version(),
            "native": True,
            "systemTheme": winutil.system_theme(),
            "theme": self._settings.get("theme"),
            "saveMode": self._settings.get("save_mode"),
            "size": self._size,
            "zoom": self._zoom,
            "normalAvailable": fit_zoom("normal") >= MIN_NORMAL_ZOOM,
            "startupFiles": self._startup_files,
        }

    def pick_files(self) -> list[str]:
        import webview

        try:
            result = self._window.create_file_dialog(
                webview.FileDialog.OPEN, allow_multiple=True, file_types=("PDF files (*.pdf)",)
            )
        except Exception:
            log.exception("file dialog failed")
            return []
        return [str(p) for p in (result or [])]

    def inspect(self, path: str) -> dict:
        path = str(path)
        basic = {"path": path, "name": os.path.basename(path), "folder": os.path.dirname(path)}
        if not engine.is_pdf_name(path):
            return {"ok": False, "kind": "not_pdf", **basic}
        try:
            basic["size_bytes"] = os.path.getsize(path)
        except OSError:
            basic["size_bytes"] = 0
        try:
            info, password = engine.inspect_pdf(path, [""] + self._passwords)
        except engine.PasswordNeeded:
            return {"ok": True, "status": "needs_password", "pages": 0, **basic}
        except FileNotFoundError:
            return {"ok": False, "kind": "missing", "message": "FILE NOT FOUND. WAS IT MOVED OR RENAMED?", **basic}
        except engine.PdfReadError as e:
            return {"ok": False, "kind": "unreadable", "detail": str(e),
                    "message": "COULDN'T READ THIS PDF. IT MAY BE DAMAGED OR NOT A REAL PDF.", **basic}
        except PermissionError:
            return {"ok": False, "kind": "denied", "message": "WINDOWS WON'T LET PDFU READ THIS FILE.", **basic}
        except OSError as e:
            return {"ok": False, "kind": "os", "message": f"FILE ERROR: {(e.strerror or str(e)).upper()}", **basic}
        except Exception as e:  # last-resort safety net
            log.exception("inspect failed")
            return {"ok": False, "kind": "unexpected", "message": f"UNEXPECTED ERROR: {e}", **basic}
        self._password_for[_key(path)] = password
        return {"ok": True, **info.to_dict()}

    def submit_password(self, path: str, password: str) -> dict:
        path, password = str(path), str(password or "")
        if not password:
            return {"ok": True, "status": "needs_password", "wrong": True}
        try:
            info, _ = engine.inspect_pdf(path, [password])
        except engine.PasswordNeeded:
            return {"ok": True, "status": "needs_password", "wrong": True}
        except Exception:
            return self.inspect(path)  # reports the real problem the same way as a fresh load
        if password not in self._passwords:
            self._passwords.append(password)  # tried automatically on the next locked files
        self._password_for[_key(path)] = password
        return {"ok": True, **info.to_dict()}

    def save_choices(self, path: str) -> list[dict]:
        original = os.path.dirname(str(path))
        choices = [{"path": original, "note": "ORIGINAL"}]
        for folder in self._settings.recent_folders():
            if _key(folder) != _key(original) and len(choices) < 3:
                choices.append({"path": folder, "note": "RECENT"})
        return choices

    def browse_folder(self, start: str = "") -> str | None:
        import webview

        try:
            result = self._window.create_file_dialog(webview.FileDialog.FOLDER, directory=start or "")
        except Exception:
            log.exception("folder dialog failed")
            return None
        if not result:
            return None
        return str(result[0] if isinstance(result, (list, tuple)) else result)

    def unlock(self, path: str, dest: str | None = None) -> dict:
        with self._lock:
            if self._busy:
                return {"ok": False, "kind": "busy", "message": "ALREADY UNLOCKING A FILE."}
            self._busy = True
        path = str(path)
        try:
            if dest and not os.path.isdir(dest):
                return {"ok": False, "kind": "dest", "message": "THAT FOLDER DOESN'T EXIST ANY MORE."}

            def progress(pct: int, step: str) -> None:
                self._js("onProgress", {"pct": int(pct), "step": step})

            result = engine.unlock_pdf(path, dest or None, self._password_for.get(_key(path), ""), progress)
            if result.outcome == engine.NOT_ENCRYPTED:
                return {"ok": False, "kind": "not_encrypted", "message": "THIS PDF ISN'T LOCKED. NO COPY NEEDED."}
            if dest:
                self._settings.add_recent_folder(dest)
            out = result.output
            return {"ok": True, "out_path": str(out), "out_dir": str(out.parent), "out_name": out.name,
                    "same_folder": not dest, "signed": result.signed, "certified": result.certified}
        except engine.PasswordNeeded:
            return {"ok": False, "kind": "password", "message": "THE PASSWORD NO LONGER OPENS THIS FILE."}
        except engine.PdfReadError:
            return {"ok": False, "kind": "unreadable",
                    "message": "COULDN'T READ THIS PDF. IT MAY BE DAMAGED OR NOT A REAL PDF."}
        except PermissionError:
            return {"ok": False, "kind": "denied",
                    "message": "CAN'T WRITE TO THAT FOLDER (PERMISSION DENIED). TRY ASK EACH TIME."}
        except OSError as e:
            return {"ok": False, "kind": "os", "message": f"FILE ERROR: {(e.strerror or str(e)).upper()}"}
        except Exception as e:  # last-resort safety net
            log.exception("unlock failed")
            return {"ok": False, "kind": "unexpected", "message": f"UNEXPECTED ERROR: {e}"}
        finally:
            with self._lock:
                self._busy = False
            if self._close_pending:
                threading.Timer(0.8, self._destroy).start()

    def open_folder(self, path: str) -> bool:
        winutil.reveal_in_explorer(str(path))
        return True

    def set_setting(self, key: str, value: str) -> bool:
        if key == "size":
            return False  # use set_size()
        return self._settings.set(key, value)

    def set_size(self, size: str) -> dict:
        if size not in LAYOUT:
            return {"size": self._size, "zoom": self._zoom}
        zoom = fit_zoom(size)
        if size == "normal" and zoom < MIN_NORMAL_ZOOM:
            return {"size": self._size, "zoom": self._zoom, "refused": True}
        self._size, self._zoom = size, zoom
        self._settings.set("size", size)
        width, height = window_size(size, zoom)
        try:
            self._window.resize(width, height)
            x0, y0, work_w, work_h = winutil.work_area()
            self._window.move(x0 + max(0, (work_w - width) // 2), y0 + max(0, (work_h - height) // 2))
        except Exception:
            log.exception("resize failed")
        self._shape()
        return {"size": size, "zoom": zoom}

    def minimize(self) -> None:
        try:
            self._window.minimize()
        except Exception:
            log.exception("minimize failed")

    def close(self) -> dict:
        if self._busy:
            self._close_pending = True
            return {"pending": True}
        threading.Timer(0.05, self._destroy).start()
        return {"pending": False}

    def log(self, message: str) -> None:
        log.warning("ui: %s", str(message)[:2000])

    # --------------------------------------------------------------- internals
    def _attach(self, window) -> None:
        self._window = window

    def _js(self, fn: str, payload) -> None:
        if not self._window:
            return
        try:
            self._window.run_js(f"window.PDFu && window.PDFu.{fn}({json.dumps(payload)})")
        except Exception:
            log.debug("run_js failed", exc_info=True)

    def _destroy(self) -> None:
        try:
            self._window.destroy()
        except Exception:
            pass

    def _shape(self) -> None:
        hwnd = winutil.hwnd_of(self._window)
        winutil.shape_window(hwnd, LAYOUT[self._size]["case"])
        winutil.enable_taskbar_minimize(hwnd)

    def _on_shown(self) -> None:
        self._shape()

    def _on_loaded(self) -> None:
        if self._drop_registered:
            return
        try:
            from webview.dom import DOMEventHandler

            self._window.dom.document.events.drop += DOMEventHandler(self._on_drop, True, True)
            self._drop_registered = True
        except Exception:
            log.exception("could not register file drop")

    def _on_drop(self, event: dict) -> None:
        files = (event.get("dataTransfer") or {}).get("files") or []
        paths = [f["pywebviewFullPath"] for f in files if f.get("pywebviewFullPath")]
        names = [f.get("name", "") for f in files]
        self._js("onFilesDropped", {"paths": paths, "names": names})

    def _on_closing(self):
        # pywebview runs this on the GUI thread (Alt+F4, taskbar Close), so never
        # call back into the page from here directly.
        if self._busy:
            self._close_pending = True
            threading.Thread(target=self._js, args=("onClosePending", {}), daemon=True).start()
            return False  # cancels the close; the window closes when unlocking ends
        return True

    def _watch_theme(self) -> None:
        """Follow Windows light/dark changes while the app is open."""
        import time

        while self._window is not None:
            time.sleep(3)
            theme = winutil.system_theme()
            if theme != self._theme_seen:
                self._theme_seen = theme
                self._js("onSystemTheme", theme)

    def _after_start(self) -> None:
        import webview

        if getattr(webview, "renderer", None) == "mshtml":
            winutil.message_box(
                "PDFu needs the Microsoft Edge WebView2 Runtime, which is missing on this PC.\n\n"
                "Install the free \"Evergreen\" runtime from\n"
                "https://developer.microsoft.com/microsoft-edge/webview2/\n"
                "and start PDFu again.",
                "PDFu",
            )
            self._destroy()
            return
        threading.Thread(target=self._watch_theme, daemon=True).start()


def _setup_logging() -> None:
    try:
        folder = settings_dir()
        folder.mkdir(parents=True, exist_ok=True)
        logging.basicConfig(filename=str(folder / "pdfu.log"), level=logging.WARNING,
                            format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    except OSError:
        logging.basicConfig(level=logging.WARNING)


def main(argv: list[str] | None = None) -> int:
    # A windowed (no console) build has no stdout/stderr; give them somewhere to go.
    if sys.stdout is None:
        sys.stdout = open(os.devnull, "w")
    if sys.stderr is None:
        sys.stderr = open(os.devnull, "w")

    parser = argparse.ArgumentParser(prog="PDFu", description="Unlock restricted PDFs.")
    parser.add_argument("files", nargs="*", help="PDF files to load (Send To / drop on the .exe)")
    parser.add_argument("--debug", action="store_true", help="enable WebView2 developer tools")
    parser.add_argument("--selftest", metavar="REPORT", help="check the build and write a report, then exit")
    args, _ = parser.parse_known_args(sys.argv[1:] if argv is None else argv)

    if args.selftest:
        from .selftest import run

        return run(args.selftest)

    _setup_logging()
    winutil.set_app_id()

    import webview

    files = [os.path.abspath(f) for f in args.files if f and not f.startswith("-")]
    window, api = create_window(files)
    webview.start(api._after_start, http_server=True, private_mode=True, debug=args.debug, icon=icon_path())
    api._window = None  # stops the theme watcher
    return 0


def create_window(files: list[str], settings: Settings | None = None):
    """Create the PDFu window and its API object (webview.start() runs them)."""
    import webview

    settings = settings or Settings()
    size = settings.get("size")
    zoom = fit_zoom(size)
    if size == "normal" and zoom < MIN_NORMAL_ZOOM:
        size, zoom = "small", fit_zoom("small")
    theme = settings.get("theme")
    if theme == "auto":
        theme = winutil.system_theme()

    api = Api(settings, files, size, zoom)
    width, height = window_size(size, zoom)
    window = webview.create_window(
        "PDFu",
        url=str(resource_dir() / "ui" / "index.html"),
        js_api=api,
        width=width,
        height=height,
        resizable=False,
        frameless=True,
        easy_drag=False,          # only the case's top band and chin move the window
        shadow=False,             # the window is shaped to the case instead
        background_color=CASE_COLORS.get(theme, CASE_COLORS["light"]),
        text_select=False,
    )
    api._attach(window)
    window.events.shown += api._on_shown
    window.events.loaded += api._on_loaded
    window.events.closing += api._on_closing
    return window, api
