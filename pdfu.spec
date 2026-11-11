# -*- mode: python ; coding: utf-8 -*-
r"""
PyInstaller recipe for PDFu (Windows).

    build.bat                       -> dist\PDFu.exe          (single file)
    set PDFU_ONEDIR=1 & build.bat   -> dist\PDFu\PDFu.exe     (folder; starts faster)

build.bat sets PDFU_ONEDIR for you when you run "build.bat onedir".
"""
import glob
import importlib.util
import os

from PyInstaller.utils.hooks import collect_all, collect_data_files

ONEDIR = os.environ.get("PDFU_ONEDIR") == "1"
ROOT = os.path.abspath(SPECPATH)  # noqa: F821  (SPECPATH is provided by PyInstaller)
SRC = os.path.join(ROOT, "src")

datas = [
    (os.path.join(SRC, "pdfu", "ui"), os.path.join("pdfu", "ui")),            # the device UI
    (os.path.join(ROOT, "assets", "pdfu.ico"), os.path.join("pdfu", "assets")),
]
binaries = []
hiddenimports = ["clr", "webview.platforms.winforms", "webview.platforms.edgechromium"]

# pikepdf + its bundled qpdf engine. The qpdf DLL lives in "pikepdf.libs" next to
# the package (a delvewheel layout); include it by name so it can never be left out.
d, b, h = collect_all("pikepdf")
datas += d
binaries += b
hiddenimports += h
pikepdf_dir = os.path.dirname(importlib.util.find_spec("pikepdf").origin)
for dll in glob.glob(os.path.join(pikepdf_dir, os.pardir, "pikepdf.libs", "*.dll")):
    binaries.append((dll, "pikepdf.libs"))

# pywebview reads its own js/ files at runtime; its hook only collects lib/.
datas += collect_data_files("webview", excludes=["**/*.jar"])

a = Analysis(
    [os.path.join(SRC, "pdfu_main.py")],
    pathex=[SRC],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=["tkinter", "PyQt5", "PyQt6", "PySide2", "PySide6", "qtpy", "gi", "cefpython3", "pytest"],
    noarchive=False,
)
pyz = PYZ(a.pure)

common = dict(
    name="PDFu",
    icon=os.path.join(ROOT, "assets", "pdfu.ico"),
    version=os.path.join(ROOT, "version_info.txt"),
    console=False,
    upx=False,
    debug=False,
    strip=False,
)

if ONEDIR:
    exe = EXE(pyz, a.scripts, [], exclude_binaries=True, **common)
    coll = COLLECT(exe, a.binaries, a.datas, name="PDFu", upx=False, strip=False)
else:
    exe = EXE(pyz, a.scripts, a.binaries, a.datas, [], runtime_tmpdir=None, **common)
