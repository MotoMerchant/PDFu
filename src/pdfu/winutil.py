"""Windows helpers (all safe no-ops on other platforms).

* shape_window(): clips the borderless window to the device's rounded case,
  because pywebview does not support transparent windows on Windows.
* enable_taskbar_minimize(): a borderless WinForms window loses WS_MINIMIZEBOX,
  so clicking its taskbar button would not minimize it. This puts it back.
* system_theme(), work_area(), reveal_in_explorer(), message_box().
"""

from __future__ import annotations

import os
import subprocess
import sys

IS_WINDOWS = sys.platform.startswith("win")

if IS_WINDOWS:  # pragma: no cover - exercised on Windows only
    import ctypes
    from ctypes import wintypes

    user32 = ctypes.WinDLL("user32", use_last_error=True)
    gdi32 = ctypes.WinDLL("gdi32", use_last_error=True)

    HRGN = wintypes.HANDLE
    gdi32.CreateRoundRectRgn.restype = HRGN
    gdi32.CreateRoundRectRgn.argtypes = [ctypes.c_int] * 6
    gdi32.CreateRectRgn.restype = HRGN
    gdi32.CreateRectRgn.argtypes = [ctypes.c_int] * 4
    gdi32.CombineRgn.restype = ctypes.c_int
    gdi32.CombineRgn.argtypes = [HRGN, HRGN, HRGN, ctypes.c_int]
    gdi32.DeleteObject.restype = wintypes.BOOL
    gdi32.DeleteObject.argtypes = [wintypes.HGDIOBJ]
    user32.SetWindowRgn.restype = ctypes.c_int
    user32.SetWindowRgn.argtypes = [wintypes.HWND, HRGN, wintypes.BOOL]
    user32.GetWindowRect.restype = wintypes.BOOL
    user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.RECT)]
    user32.SetWindowPos.restype = wintypes.BOOL
    user32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND] + [ctypes.c_int] * 4 + [wintypes.UINT]
    user32.SystemParametersInfoW.restype = wintypes.BOOL
    user32.SystemParametersInfoW.argtypes = [wintypes.UINT, wintypes.UINT, ctypes.c_void_p, wintypes.UINT]
    user32.MessageBoxW.restype = ctypes.c_int
    user32.MessageBoxW.argtypes = [wintypes.HWND, wintypes.LPCWSTR, wintypes.LPCWSTR, wintypes.UINT]

    if ctypes.sizeof(ctypes.c_void_p) == 8:
        _GetWindowLong = user32.GetWindowLongPtrW
        _SetWindowLong = user32.SetWindowLongPtrW
        _GetWindowLong.restype = ctypes.c_ssize_t
        _SetWindowLong.restype = ctypes.c_ssize_t
        _GetWindowLong.argtypes = [wintypes.HWND, ctypes.c_int]
        _SetWindowLong.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_ssize_t]
    else:
        _GetWindowLong = user32.GetWindowLongW
        _SetWindowLong = user32.SetWindowLongW
        _GetWindowLong.restype = ctypes.c_long
        _SetWindowLong.restype = ctypes.c_long
        _GetWindowLong.argtypes = [wintypes.HWND, ctypes.c_int]
        _SetWindowLong.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_long]

RGN_AND, RGN_OR = 1, 2
GWL_STYLE = -16
WS_MINIMIZEBOX = 0x00020000
SWP_NOSIZE, SWP_NOMOVE, SWP_NOZORDER, SWP_NOACTIVATE, SWP_FRAMECHANGED = 0x1, 0x2, 0x4, 0x10, 0x20
SPI_GETWORKAREA = 0x0030


def set_app_id(app_id: str = "PDFu.DocumentUnlocker") -> None:
    """Groups the taskbar button under PDFu's own icon when run from source."""
    if not IS_WINDOWS:
        return
    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(app_id)
    except Exception:
        pass


def system_theme() -> str:
    """'dark' if Windows apps are set to dark mode, otherwise 'light'."""
    if not IS_WINDOWS:
        return "light"
    try:
        import winreg

        with winreg.OpenKey(
            winreg.HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize",
        ) as key:
            value, _ = winreg.QueryValueEx(key, "AppsUseLightTheme")
            return "light" if int(value) else "dark"
    except Exception:
        return "light"


def work_area() -> tuple[int, int, int, int]:
    """Primary monitor's work area (screen minus taskbar) as (x, y, width, height) in logical px."""
    if not IS_WINDOWS:
        return (0, 0, 1920, 1040)
    try:
        rect = wintypes.RECT()
        user32.SystemParametersInfoW(SPI_GETWORKAREA, 0, ctypes.byref(rect), 0)
        try:
            scale = user32.GetDpiForSystem() / 96.0
        except Exception:
            scale = 1.0
        scale = scale or 1.0
        return (int(rect.left / scale), int(rect.top / scale),
                int((rect.right - rect.left) / scale), int((rect.bottom - rect.top) / scale))
    except Exception:
        return (0, 0, 1920, 1040)


def hwnd_of(window) -> int | None:
    """Native window handle of a pywebview window (WinForms backend)."""
    try:
        return int(window.native.Handle.ToInt64())
    except Exception:
        return None


def shape_window(hwnd: int | None, case_height: int, design_width: int = 820,
                 top_radius: int = 30, bottom_radius: int = 22, edge: int = 13) -> bool:
    """
    Clip the window to the case outline: rounded top corners, rounded bottom
    corners, plus the 13 px plastic "edge" drawn under the case.

    Sizes are in design px (the 1x layout). They are scaled to the window's
    real size, so this works at any zoom and any Windows display scaling.
    """
    if not IS_WINDOWS or not hwnd:
        return False
    try:
        rect = wintypes.RECT()
        if not user32.GetWindowRect(hwnd, ctypes.byref(rect)):
            return False
        width = rect.right - rect.left
        s = width / float(design_width)

        def px(v: float) -> int:
            return int(round(v * s))

        w, hc, e = width, px(case_height), px(edge)
        mid = hc // 2
        created = []

        def rnd(x1, y1, x2, y2, r):
            h = gdi32.CreateRoundRectRgn(x1, y1, x2 + 1, y2 + 1, 2 * r, 2 * r)
            created.append(h)
            return h

        def box(x1, y1, x2, y2):
            h = gdi32.CreateRectRgn(x1, y1, x2, y2)
            created.append(h)
            return h

        total = box(0, 0, 0, 0)
        top = rnd(0, 0, w, hc, px(top_radius))
        gdi32.CombineRgn(top, top, box(0, 0, w, mid), RGN_AND)
        bottom = rnd(0, 0, w, hc, px(bottom_radius))
        gdi32.CombineRgn(bottom, bottom, box(0, mid, w, hc), RGN_AND)
        lip = rnd(0, e, w, hc + e, px(bottom_radius))
        gdi32.CombineRgn(lip, lip, box(0, mid, w, hc + e), RGN_AND)
        for part in (top, bottom, lip):
            gdi32.CombineRgn(total, total, part, RGN_OR)

        ok = bool(user32.SetWindowRgn(hwnd, total, True))  # Windows now owns `total`
        for h in created:
            if h != total or not ok:
                gdi32.DeleteObject(h)
        return ok
    except Exception:
        return False


def enable_taskbar_minimize(hwnd: int | None) -> None:
    """Let the taskbar button minimize/restore the borderless window."""
    if not IS_WINDOWS or not hwnd:
        return
    try:
        style = _GetWindowLong(hwnd, GWL_STYLE)
        if not style & WS_MINIMIZEBOX:
            _SetWindowLong(hwnd, GWL_STYLE, style | WS_MINIMIZEBOX)
            user32.SetWindowPos(hwnd, None, 0, 0, 0, 0,
                                SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED)
    except Exception:
        pass


def reveal_in_explorer(path: str) -> None:
    """Open the folder that holds `path`, with the file selected."""
    try:
        if IS_WINDOWS:
            if os.path.isfile(path):
                subprocess.Popen(f'explorer /select,"{os.path.normpath(path)}"')
            else:
                os.startfile(os.path.dirname(path) if not os.path.isdir(path) else path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", "-R", path])
        else:
            subprocess.Popen(["xdg-open", os.path.dirname(path) if os.path.isfile(path) else path])
    except Exception:
        pass


def message_box(text: str, title: str = "PDFu", error: bool = True) -> None:
    if IS_WINDOWS:
        try:
            user32.MessageBoxW(None, text, title, 0x10 if error else 0x40)
            return
        except Exception:
            pass
    print(f"{title}: {text}", file=sys.stderr)
