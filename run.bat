@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM ======================================================================
REM  run.bat  --  run PDFu from source, without building an .exe
REM
REM    run.bat                 start PDFu
REM    run.bat --debug         start with WebView2 developer tools (F12)
REM    run.bat "C:\a.pdf"      start with a PDF already inserted
REM
REM  Installs the two dependencies into a private ".venv" folder here on
REM  the first run. Needs 64-bit Python 3.10 - 3.14.
REM ======================================================================

if not exist ".venv\Scripts\python.exe" (
    echo Setting up .venv ^(first run only^) ...
    py -3 -m venv .venv 2>nul || python -m venv .venv
    if not exist ".venv\Scripts\python.exe" (
        echo Python 3.10 - 3.14 was not found. See README.md.
        pause
        exit /b 1
    )
    ".venv\Scripts\python.exe" -m pip install --quiet --disable-pip-version-check --prefer-binary -r requirements-dev.txt
)
start "" ".venv\Scripts\pythonw.exe" "src\pdfu_main.py" %*
