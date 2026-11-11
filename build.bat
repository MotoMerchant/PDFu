@echo off
setlocal EnableExtensions
title Build PDFu
cd /d "%~dp0"

REM ======================================================================
REM  build.bat  --  turns the PDFu source into a standalone Windows program
REM
REM    build.bat          -> dist\PDFu.exe               (single file)
REM    build.bat onedir   -> dist\PDFu\PDFu.exe          (folder; starts
REM                          faster, fewer antivirus false alarms)
REM
REM  Needs Python 3.10 - 3.14 (64-bit) ONLY to build. The finished .exe
REM  runs on Windows 10/11 with nothing else installed (it uses the
REM  Microsoft Edge WebView2 Runtime that ships with Windows 11 and with
REM  current Windows 10).
REM  Everything is installed into a private ".build-venv" folder here, so
REM  your normal Python setup is not touched.
REM ======================================================================

set "MODE=onefile"
set "PDFU_ONEDIR="
if /i "%~1"=="onedir" (
    set "MODE=onedir"
    set "PDFU_ONEDIR=1"
)

echo.
echo   ==========================================
echo    Building PDFu   [%MODE%]
echo   ==========================================
echo.

REM ---- 1. Find a suitable Python ---------------------------------------
echo   [1/6] Looking for Python 3.10 - 3.14 (64-bit) ...
set "PY="
for %%V in (3.13 3.12 3.14 3.11 3.10) do (
    if not defined PY (
        py -%%V -c "import struct,sys; sys.exit(0 if struct.calcsize('P')==8 else 1)" >nul 2>&1 && set "PY=py -%%V"
    )
)
if not defined PY python -c "import struct,sys; sys.exit(0 if (3,10)<=sys.version_info[:2]<=(3,14) and struct.calcsize('P')==8 else 1)" >nul 2>&1 && set "PY=python"
if not defined PY goto :nopython
for /f "delims=" %%v in ('%PY% -c "import sys,platform;print(sys.version.split()[0], platform.architecture()[0])"') do echo         found Python %%v  ^(%PY%^)
echo.

REM ---- 2. Private build environment ------------------------------------
echo   [2/6] Preparing the build environment (first run takes a few minutes) ...
if not exist ".build-venv\Scripts\python.exe" %PY% -m venv ".build-venv"
if not exist ".build-venv\Scripts\python.exe" goto :fail
set "VPY=.build-venv\Scripts\python.exe"
"%VPY%" -m pip install --quiet --disable-pip-version-check --upgrade pip
"%VPY%" -m pip install --quiet --disable-pip-version-check --prefer-binary ^
    --only-binary=pikepdf,pythonnet,clr_loader,cffi,lxml,pillow -r requirements-dev.txt
if errorlevel 1 goto :pipfail
"%VPY%" -c "import pikepdf, webview, PyInstaller; print('        pikepdf', pikepdf.__version__, '(qpdf ' + pikepdf.__libqpdf_version__ + ')   PyInstaller', PyInstaller.__version__)"
if errorlevel 1 goto :fail
echo.

REM ---- 3. Tests -----------------------------------------------------------
echo   [3/6] Running the tests ...
"%VPY%" -m pytest -q tests
if errorlevel 1 goto :testfail
echo.

REM ---- 4. Build -------------------------------------------------------------
echo   [4/6] Building the program (1-3 minutes) ...
if exist "build" rmdir /s /q "build"
"%VPY%" -m PyInstaller --noconfirm --clean --log-level WARN pdfu.spec
if errorlevel 1 goto :fail
if exist "build" rmdir /s /q "build"
set "EXE=dist\PDFu.exe"
if /i "%MODE%"=="onedir" set "EXE=dist\PDFu\PDFu.exe"
if not exist "%EXE%" goto :fail
echo.

REM ---- 5. Self-test the finished program --------------------------------
echo   [5/6] Checking the finished program ...
set "REPORT=%TEMP%\pdfu-selftest-%RANDOM%.txt"
if exist "%REPORT%" del /q "%REPORT%"
start "" /wait "%EXE%" --selftest "%REPORT%"
if not exist "%REPORT%" goto :selftestfail
type "%REPORT%" | findstr /v /b "OK"
findstr /b /c:"OK" "%REPORT%" >nul || goto :selftestfail
del /q "%REPORT%"
echo.

REM ---- 6. Done ----------------------------------------------------------
echo   [6/6] Done!
echo.
if /i "%MODE%"=="onedir" goto :done_onedir
echo   [OK] Your program:  dist\PDFu.exe
echo        It is fully standalone - copy it anywhere: the Desktop, a USB
echo        stick or a shared drive. Nothing else needs to be installed.
goto :done

:done_onedir
echo   [OK] Your program:  dist\PDFu\PDFu.exe
echo        Keep the whole "PDFu" folder together; make a desktop
echo        shortcut to the .exe inside it.

:done
echo.
start "" explorer "%~dp0dist"
pause
exit /b 0

REM ======================================================================
:nopython
echo.
echo   [X] 64-bit Python 3.10 - 3.14 was not found.
echo.
echo       Python is only needed ONCE, to build the .exe. Install it from
echo         https://www.python.org/downloads/windows/
echo       (a 3.13 "Windows installer (64-bit)"), and on the first screen
echo       tick "Add python.exe to PATH".
echo.
echo       Or, in a Command Prompt:   winget install Python.Python.3.13
echo.
echo       Then run build.bat again.
echo.
pause
exit /b 1

:pipfail
echo.
echo   [X] Downloading the build tools failed.
echo       - Check your internet connection.
echo       - On a company network a proxy or firewall can block pip. Try
echo         another network, or ask IT for the proxy address and run
echo           set HTTPS_PROXY=http://proxy.address:port
echo         in this window before running build.bat again.
echo.
pause
exit /b 1

:testfail
echo.
echo   [X] A test failed, so the build was stopped. See the messages above.
echo.
pause
exit /b 1

:selftestfail
echo.
echo   [X] The finished program failed its self-check:
if exist "%REPORT%" type "%REPORT%"
echo.
pause
exit /b 1

:fail
echo.
echo   [X] Build failed - see the messages above.
echo.
pause
exit /b 1
