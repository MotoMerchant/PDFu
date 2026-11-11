# PDFu: build brief (start here)

This is the single starting point for building the PDFu program from the finished UI design. It sums up every decision made in the design chat, and the companion files below have the detail.

> Kept here as the design record. The program in `src/` implements it; the answers to §9 "Still open" and the few deliberate deviations are listed in the README under **Design notes**.

| File | What it is |
|---|---|
| `PDFu-build-brief.md` | This brief: product, windows, themes, screens, controls, behavior |
| `PDFu-floppy-animation-spec.md` | Floppy-drive animation in detail: states, timing, easing, geometry, true-scale Normal size, porting notes |
| `src/pdfu/ui/` | The working UI built from this brief (the drive component is `js/drive.js` + the `.pk-*` rules in `css/pdfu.css`) |

**Visual source of truth:** the "Retro PDF Unlocker UI" design canvas. The *Light / Dark* page has the Small window. The *Normal size · 2×* page has the large window.

---

## 1. Product

- **PDFu**, labeled "MODEL PU-1 · DOCUMENT UNLOCKER" on the case. It's a Windows desktop program.
- Takes a PDF, removes its permission restrictions (print / copy / edit), and **saves an unlocked copy** without touching the original.
- Output name: `<original name>_Unlocked.pdf`.
- The save location is set by the **SAVE TO** rocker:
  - **SAME FOLDER:** the copy goes next to the original.
  - **ASK EACH TIME:** after UNLOCK, the user picks a folder.
- Style: retro skeuomorphic hardware. The window *is* the device: an off-white or woodgrain monitor with a CRT screen, a 3.5" floppy drive, an illuminated rocker and chunky keys. The screen UI is a DOS / Game Boy-style 1–2-bit display.

## 2. Windows (two sizes)

| | Small | Normal |
|---|---|---|
| Size | 820 × 860 | 1640 × 1780 (everything 2×, drawn sharp) |
| Deck | Compact controls (drive 250 px wide) | **True-scale** drive, rocker and keys, sized from a real 3.5" drive. See spec §5 |
| Canvas board | `Unlocker.dc.html` | `UnlockerXL.dc.html` |

**Small layout (px):**
- Case: 820 × 830, corner radius 30 on top and 22 on the bottom, padding 44 / 36 / 26 (the 44 px top band holds the window keys and is the drag area), 18 px gaps.
- Bezel: padding 28, radius 24.
- CRT screen: 500 px tall, radius 28 / 34.
- Chin: 30 px tall.
- Control deck: fills the remaining space (about 138 px), radius 16, side padding 24.

The Normal size follows the same structure at 2×, with a 172 px deck (1× units) and the true-scale parts.

## 3. Themes (follow Windows light / dark mode)

| Token | **Light: A1 Studio Gray** | **Dark: A4 Woodgrain** |
|---|---|---|
| Case | `#EEECE8 → #DFDDD8 → #CECBC4` (vertical), edges `#B5B1A9` / `#8C8881` | `#3B3834 → #2B2926 → #1D1B19`, edges `#141311` / `#080808` |
| Bezel | warm-gray diagonal gradient `#C2BFB8…#ECEAE6…#B7B3AC`, screen ring `#232426` | near-black gradient `#121110…#34312D`, ring `#050505` |
| Deck | `#D3D0CA → #E3E1DC`, recessed (inset shadow) | woodgrain `#82502B → #6B4223 → #58351B` with fine grain stripes |
| Text / soft text | `#3A3936` / `#55534E` | `#EDE3CD` / `#CFC4AC` (deck text `#F5ECD8`) |
| UNLOCK key | orange `#C9461A` (hi `#E0602F`, lo `#8A2B0C`), text `#FFF5EE` | `#B44E1A` (hi `#CF6630`, lo `#6E2C0C`), text `#FFF3E6` |
| OPEN key | black `#2B2B2D` (hi `#46464A`, lo `#0D0D0E`), text `#ECEAE5` | `#232120` (hi `#3B3835`, lo `#0B0A0A`), text `#EDE3CD` |
| Panel LEDs on / off | `#FF6A2A` / `#A29E96` | `#FFB547` / `#2A1C12` |
| CRT palette | **mint**: bg `#0E1C22`, glow `#D7EBC9`, mid `#8BA88E`, shade `#2E4A47`, empty `#1C3134` | **amber**: bg `#170E05`, glow `#FFC56A`, mid `#C08A3A`, shade `#4E3212`, empty `#2E1D0B` |
| Chin | orange square logo, **PDFu** (Michroma 17 px), model text, dotted speaker grille | three-stripe logo `#E39A3B` / `#C9631F` / `#9E3F14`, slatted grille |
| Floppy disk | warm-gray shell `#8A867F`, orange label header, black pinstripes | charcoal `#2A2724`, cream label, dark-brown header with amber text, amber/orange/rust stripes |

- **Both themes use the same illuminated rocker.** Lit, it glows orange through a crosshatch lens (SAME FOLDER). Unlit, it's dark smoked red (ASK EACH TIME).
- **CRT effects on both:**
  - scanlines (1 px dark line every 3 px, 55 %)
  - aperture-grille lines (3 px, 45 %)
  - a soft top-left glare and a vignette (inset shadows)
  - text glow `0 0 6px` in the glow color at 35 %
- **Fonts** (all free to bundle with the app; Permanent Marker is Apache 2.0, the rest are OFL):
  - Press Start 2P (headlines)
  - VT323 (body and log text)
  - Silkscreen (title bar and tags)
  - Michroma (logo)
  - Space Mono (hardware labels)
  - Permanent Marker (handwritten disk label)

## 4. Screen (CRT) states and copy

**Title bar** (inverted, Silkscreen): `PDFU.EXE  FILE  OPTIONS  HELP`, with a status on the right. The status reads `READY` / `READING` / `LOCKED` / `SAVE AS` / `BUSY` / `DONE`. Temporary messages: `NOT A PDF` for about 2 s, and `OPENING FOLDER...`.

**Footer:**
- left: `OUT: SAME FOLDER + _Unlocked` or `OUT: ASK EACH TIME`
- right: `DISK=LOAD  UNLOCK=RUN  OPEN=VIEW`

| State | What the screen shows |
|---|---|
| **Idle** | A pixel "INSERT PDF" window with an upload arrow, `DROP FILE OR INSERT DISK` and `CLICK TO BROWSE_`. Clicking it opens the file dialog. Dropping a file on the window works too. *(The canvas also has an "OR LOAD A SAMPLE DISK" button, which is for the demo only.)* |
| **Reading** | Floppy icon, `READING A:_`, and the file name. Shown while the disk animates in. |
| **Loaded** | "FILE LOADED" window: lock icon, file name, `IN <folder> · <size> · <pages>`, a `LOCKED` tag and `PRINT:NO COPY:NO EDIT:NO`. Then either `SAVES AS <name>_Unlocked.pdf` / `NEXT TO THE ORIGINAL IN <folder>`, or `YOU'LL PICK THE FOLDER AFTER [UNLOCK]`. Last line: `PRESS [UNLOCK] TO RUN_`. |
| **Save as** (ASK mode, after UNLOCK) | `WHERE SHOULD THE COPY GO?` with a close box. Shows `FILE NAME: …` and a list of folders: the original folder (`ORIGINAL`), a recent one (`RECENT`) and others. Picking one starts the unlock. |
| **Unlocking** | Hourglass, `UNLOCKING...`, a 20-segment progress bar with %, and log lines that appear as it progresses: `> READING ENCRYPTION DICTIONARY`, `> OWNER RESTRICTIONS FOUND`, `> CLEARING PERMISSION FLAGS`, `> WRITING <NAME>_UNLOCKED.PDF`. |
| **Done** | "COMPLETE" window: open-lock icon, `✓ UNLOCKED!`, then `SAVED NEXT TO THE ORIGINAL:` or `SAVED A COPY TO:` with the folder and file name. Buttons: `LOAD NEXT` (file dialog) and `MAIN MENU` (eject, back to idle). |

Screen windows use a 3 px glow-color border, an 8 px hard drop shadow in the shade color, and a dithered title strip.

## 5. Controls and their behavior

| Control | Behavior |
|---|---|
| **SAVE TO rocker** | Bold `SAVE TO:` sits to its left. `SAME FOLDER` is above it and `ASK EACH TIME` below, and the active option has a lit LED dot and bold text. Clicking toggles the mode. Ignored while unlocking or choosing a folder. |
| **Disk slot** | Click to open the file dialog (filter: PDF). |
| **Drive eject button** | Ejects the disk and returns to idle. It sticks out while a disk is in. Ignored while unlocking or choosing a folder. |
| **UNLOCK key** (orange) | Only works in Loaded. In SAME FOLDER mode it starts unlocking right away; in ASK mode it opens the Save-as screen first. Its LED is lit when ready and blinks while Loaded. |
| **OPEN key** (black) | Only works in Done. Opens the output folder in Explorer and shows `OPENING FOLDER...` in the title bar. Its LED is lit in Done. |
| **Drive BUSY LED** | Flickers when the disk seats and for the whole unlock. |
| **Minimize key** (black, –) | Top right of the case. Minimizes the window. |
| **Close key** (orange, ×) | Top right of the case, right of Minimize. Closes the program. If unlocking is running, finish or cancel it cleanly before closing. |

- Picking a new file while a disk is in ejects the old disk first, then inserts the new one.
- A non-PDF shows `NOT A PDF` and nothing else happens.

## 6. Borderless window

PDFu runs in a **borderless window**, so no standard Windows frame or title bar shows. The device itself is the window.

- **Window keys:** two small keys sit in a recessed well at the top right of the case, 34 px from the right edge and 9 px from the top (1× units). Each is 36 × 24 with a 6 px gap, using the theme's key styles:
  - **Minimize:** the black OPEN-key style, with a pixel underscore (–).
  - **Close:** the orange UNLOCK-key style, with a pixel ×.
  - Each has a tooltip and an accessible name ("Minimize", "Close").
- **Dragging:** the case's 44 px top band and the chin act as the drag area that moves the window. Buttons, the screen and the deck controls stay clickable.
- **Rounded corners:** the window background must be transparent outside the case, so the rounded corners and drop shadow show with no rectangle behind them.
- **How to do it per stack:**
  - **WPF:** `WindowStyle="None"`, `AllowsTransparency="True"`, `Background="Transparent"`; call `DragMove()` on mouse-down in the drag area.
  - **WinUI 3:** extend content into the title bar and hide the system caption buttons, then set the drag region.
  - **Electron:** `frame: false, transparent: true`, with `-webkit-app-region: drag` on the drag area and `no-drag` on every control.
  - **Qt:** `Qt::FramelessWindowHint` plus `WA_TranslucentBackground`; move the window from mouse events.
  - **WinForms:** `FormBorderStyle = None`; handle `WM_NCHITTEST` and return `HTCAPTION` over the drag area.
- Keep **Alt+F4** and the taskbar's minimize and close working, since a borderless window loses the system frame's own handling.

## 7. Floppy-drive animation (summary)

The full detail is in `PDFu-floppy-animation-spec.md`. The sequence:

1. A file is picked. The disk, in the theme's colors, slides up to the **open position**, where only its label shows.
2. The file name is written on the label in marker. The disk **waits there until UNLOCK** (about 1.2 s to get there).
3. UNLOCK pulls the disk fully into the drive, which shakes slightly while the work runs.
4. On success, the disk pops back out stamped **UNLOCKED**, and the write-protect tab slides shut.
5. Eject drops the disk down and fades it out.

Wire the app to four calls: `insert(fileName)`, `startReading()`, `finish()` and `eject()`. On a failed unlock, call `eject()` and show the error on screen.

## 8. Accessibility and polish

- Keyboard: every control is a real button. Use visible focus rings (3 px `#2F6FDB` outline).
- Reduced motion: speed the animations up by 4× and turn off the shake and flicker loops.
- Keep text at 4.5:1 contrast or better against its background when adjusting any of these colors.

## 9. Still open for the build chat

- Which UI stack: WPF / WinUI, a WebView2 or Electron (HTML) shell, or Qt. HTML-based shells can reuse the reference file as is, and the spec has porting notes for the others.
- How the unlock engine reports progress, so the progress bar and log lines can follow real steps.
- Where "recent" folders for the Save-as list come from (remembered from earlier saves?).
- Whether the window size (Small or Normal) is a setting, follows the screen size, or both.
