# Third-party software and fonts

PDFu's own code is MIT-licensed (see `LICENSE`). The built `PDFu.exe` also
contains the components below, each under its own license.

## Libraries

| Component | Used for | License |
|---|---|---|
| [pikepdf](https://github.com/pikepdf/pikepdf) | Reading and re-writing PDFs | MPL-2.0. Its source is available from the link; PDFu uses it unmodified. |
| [qpdf](https://github.com/qpdf/qpdf) (inside pikepdf) | The PDF engine that removes the encryption | Apache-2.0 |
| [pywebview](https://github.com/r0x0r/pywebview) | The borderless window and the Python/JavaScript bridge | BSD-3-Clause |
| Microsoft WebView2 SDK DLLs (inside pywebview) | Hosting Microsoft Edge WebView2 | Microsoft WebView2 SDK license (redistributable) |
| [pythonnet](https://github.com/pythonnet/pythonnet) and [clr-loader](https://github.com/pythonnet/clr-loader) | .NET bridge used by pywebview on Windows | MIT |
| [bottle](https://github.com/bottlepy/bottle) | pywebview's local file server | MIT |
| proxy_tools, cffi, pycparser, typing_extensions | pywebview / pythonnet dependencies | MIT, MIT-0, BSD-3-Clause, PSF-2.0 |
| [lxml](https://lxml.de), [Pillow](https://python-pillow.org) | pikepdf dependencies | BSD-3-Clause, MIT-CMU |
| [PyInstaller](https://pyinstaller.org) bootloader | Packaging the .exe | GPL-2.0-or-later with the bootloader exception, which allows distributing programs built with it under any license |

The Microsoft Edge WebView2 Runtime itself is **not** bundled; Windows provides it.

## Fonts (bundled in `src/pdfu/ui/fonts/`)

Full license texts are in `src/pdfu/ui/fonts/licenses/`. The files come from the
[Fontsource](https://fontsource.org) packages of these Google Fonts families.

| Font | Used for | License |
|---|---|---|
| Press Start 2P | Screen headlines | SIL Open Font License 1.1 |
| VT323 | Screen body and log text | SIL Open Font License 1.1 |
| Silkscreen | Title bar and tags | SIL Open Font License 1.1 |
| Michroma | PDFu logo | SIL Open Font License 1.1 |
| Space Mono | Hardware labels | SIL Open Font License 1.1 |
| Permanent Marker | Handwritten disk label | Apache License 2.0 |
