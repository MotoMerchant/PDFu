"""
``PDFu.exe --selftest REPORT`` checks a finished build without showing a window.

build.bat runs it right after packaging. It proves that the bundled qpdf
engine really unlocks a PDF, that the UI files were packaged, and (on Windows)
that pywebview's .NET bridge loads. The report's first line is ``OK`` or
``FAIL``; details follow.
"""

from __future__ import annotations

import sys
import tempfile
import traceback
from pathlib import Path


def _check_engine(lines: list[str]) -> None:
    import pikepdf

    from . import engine

    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "Selftest Drawing.pdf"
        pdf = pikepdf.new()
        pdf.add_blank_page(page_size=(612, 792))
        locked = pikepdf.Permissions(extract=False, modify_other=False, print_highres=False, print_lowres=False)
        pdf.save(src, encryption=pikepdf.Encryption(owner="selftest-owner", user="", allow=locked))
        before = src.read_bytes()

        info, _ = engine.inspect_pdf(src)
        assert info.status == engine.LOCKED and not info.can_print, "inspect did not see the restrictions"
        result = engine.unlock_pdf(src)
        assert result.outcome == engine.UNLOCKED and result.output is not None, "no copy written"
        assert result.output.name == "Selftest Drawing_Unlocked.pdf", result.output.name
        with pikepdf.open(result.output) as out:
            assert not out.is_encrypted, "copy is still encrypted"
            assert len(out.pages) == 1, "page count changed"
        assert src.read_bytes() == before, "original was modified"
    lines.append(f"engine: pikepdf {engine.pikepdf_version()}, qpdf {engine.qpdf_version()} - unlock OK")


def _check_ui(lines: list[str]) -> None:
    from .app import resource_dir

    ui = resource_dir() / "ui"
    needed = ["index.html", "css/pdfu.css", "js/app.js", "js/drive.js", "js/screens.js", "js/bridge.js",
              "fonts/permanent-marker-latin-400-normal.woff2"]
    missing = [n for n in needed if not (ui / n).is_file()]
    assert not missing, f"UI files missing from the build: {missing}"
    lines.append(f"ui: {len(needed)} key files present")


def _check_webview(lines: list[str]) -> None:
    import webview  # noqa: F401

    lines.append(f"pywebview: {getattr(webview, '__version__', 'imported')}")
    if sys.platform.startswith("win"):
        import clr  # noqa: F401  - pythonnet, the .NET bridge WinForms/WebView2 needs

        from webview.platforms import winforms

        lines.append(f"webview renderer on this PC: {winforms.renderer}")


def run(report_path: str) -> int:
    lines: list[str] = []
    ok = True
    for check in (_check_engine, _check_ui, _check_webview):
        try:
            check(lines)
        except Exception:
            ok = False
            lines.append(f"{check.__name__} FAILED:\n{traceback.format_exc()}")
    text = ("OK" if ok else "FAIL") + "\n" + "\n".join(lines) + "\n"
    try:
        Path(report_path).write_text(text, encoding="utf-8")
    except OSError:
        pass
    try:
        print(text)
    except Exception:
        pass
    return 0 if ok else 1
