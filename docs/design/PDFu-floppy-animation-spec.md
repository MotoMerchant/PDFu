# PDFu — Floppy drive insert animation: integration spec

Hand-off from the UI design chat to the coding chat. Covers the animated 3.5" floppy disk in the control deck's drive slot. The disk is labeled with the selected PDF's file name. It is used in both themes: **Light = A1 Studio Gray** and **Dark = A4 Woodgrain**. Both use A1's illuminated rocker for the save-location switch.

> Kept here as the design record. The implementation is `src/pdfu/ui/js/drive.js` (the `FloppyDrive` class) and the `.pk-*` rules in `src/pdfu/ui/css/pdfu.css`. The one deliberate change, the Small size's popped-out "done" position, is explained in the README under **Design notes**.

---

## 1. What the user sees

1. **A PDF is chosen.** The user clicks the disk slot or the INSERT PDF panel, or drops a file. A 3.5" disk in the theme's colors rises from below into the slot. The drive faceplate sits in front of the disk, so the top of the disk disappears into the slot.
2. **Open position.** The disk slides straight to the open position, where **only the label shows**, with a small settle. It **stays there until UNLOCK** and doesn't push in any further on its own.
3. **Label.** While it sits there, the file name is written onto the paper label in marker, wiping left to right. Then the green BUSY LED flickers briefly and the eject button pops out.
4. **UNLOCK pressed.** The disk is pulled all the way into the drive. The LED flickers and the whole drive shakes slightly, like a seeking head, for as long as unlocking runs.
5. **Unlock succeeds.** The disk pops back out with a bounce, a little further than before so the top of the metal shutter shows. A red **UNLOCKED** rubber stamp lands on the label and the write-protect tab slides shut.
6. **Eject** (drive eject button, MAIN MENU, or picking a new file). The disk drops down and fades out. Picking a new file ejects the old disk first, then inserts the new one.

## 2. State machine

| Phase | Disk position (`ty`) | Duration | Easing (CSS cubic-bezier) | Also |
|---|---|---|---|---|
| `empty` | 0, opacity 0 | instant | none | label text hidden |
| `arrive` | −0.47 (open position), opacity 1 | 480 ms (opacity 200 ms) | `.2,.9,.3,1.1` (small settle) | |
| `label` | −0.47 (holds) | 700 ms | none | name wipes in over 620 ms, `.45,.05,.55,.95` |
| `seated` | −0.47 (no movement) | rests until UNLOCK | none | flap pushed in, eject pops out, LED on for 600 ms; screen → LOCKED |
| `reading` | −1.08 (fully in) | 460 ms, then until unlock ends | `.55,0,.85,.4` | LED on, drive shake: 0.12 s loop, ±0.8 px |
| `ejecting` → `done` | −0.36 | 360 ms | `.18,.9,.3,1.35` (overshoot) | stamp scales 1.9→1 over 360 ms (`.2,.7,.3,1.4`); WP tab slides 9 px after a 300 ms delay |
| `removing` | 0, opacity 0 | 520 ms (opacity 420 ms) | `.45,0,.9,.55` | then → `empty` |

`ty` is measured in **disk heights above the clip line**, so negative values mean further into the drive. At the device scale, one disk height is 199.5 px, which makes seated −94 px and done −72 px. Every duration is divided by a speed factor (default 1). With *reduced motion* switched on, use speed 4 and turn off the shake and flicker loops.

**Hooks to wire up:**
`insert(fileName)` runs when a PDF is selected. `startReading()` runs when unlocking begins. `finish()` runs when unlocking succeeds. `eject()` runs on eject, MAIN MENU, or before a new file is inserted. On failure, call `eject()` and show the error on the screen. Ignore inserts and ejects while unlocking or while the save-as dialog is open.

## 3. Geometry and the layering trick

- **Drive module:** 250 px wide, padding 13/16/11. Inside it, top to bottom:
  - the slot (24 px tall, dark recess, with an inner dust flap)
  - a row with the LED, "A:", `3.5" · 1.44 MB` and the eject button
- **Clip "well":** a 250 × 132 px box with `overflow: hidden`. Its top edge is 29 px from the top of the drive, which is 16 px into the slot. The disk lives in this box. Moving the disk up (negative `ty`) hides it above the well's top edge, so it looks like it's going *behind* the faceplate into the slot.
- The well paints **over** the drive's lower half and the deck below it. When seated, the disk hangs down over the LED row and the bottom edge of the case, as in the reference image. The well must not catch clicks.
From picking a file to the disk waiting at the open position with its name written takes about 1.2 s at speed 1.

- **Disk:** designed at 330 × 344 and scaled 0.58 from its top-center, so it shows at 191 × 200 px. It's centered on the slot (left −40 px inside the well).
- **Disk layers** (design units):
  - body in the theme's disk shell color (section 4) with a sheen gradient; top-right corner chamfered 18 px
  - molded insert arrow at top left
  - shutter recess 206 × 160
  - brushed-metal shutter 182 × 152 at x 64, with a 46 × 100 window showing brown media
  - label recess 284 × 170 at (20, 166)
  - paper label 272 × 158 at (26, 172): a 22 px header band with "PDFu" in Michroma and "2HD · 1.44 MB", then a 6 px pinstripe band at y 22, then three rules at y 62, 96 and 130 (all colors come from the theme, section 4)
  - write-protect window 14 × 22 at (6, 312), and HD hole 14 × 14 at (308, 318)
- **Label name:** Permanent Marker, starts at y 28, line-height 34, up to 3 lines, wrapping anywhere. Font size by name length: ≤13 characters → 32 px, ≤20 → 26, ≤30 → 21, longer → 19. Bundle the font with the app (Apache 2.0 license) rather than loading it from Google Fonts.
- **Stamp:** "UNLOCKED", Space Mono 700, 19 px, 3 px border, `rgba(201,58,22,.9)`, rotated −9°, multiply blend, bottom right of the label.

## 4. Theme tokens (drive only)

| Token | Light (A1) | Dark (A4) |
|---|---|---|
| Drive background | `#C8C5BE → #DFDDD8` (vertical) | `#1A1816 → #2B2825` |
| Drive shadow | inset 0 2 4 `rgba(70,60,44,.38)`, 0 1 0 white 85 % | inset 0 2 5 black 70 %, 0 1 0 white 14 % |
| Drive text | `#3A3936` | `#E9DFC8` |
| Eject face / edge | `#F3F1ED → #C6C3BC` / `#96928B` | `#55514C → #2B2926` / `#0A0A0A` |
| LED off / on | `#46623F` / `#7DFF6A` + green glow | `#2E3D29` / `#7DFF6A` |
| Disk shell | `#8A867F` warm gray | `#2A2724` charcoal |
| Label paper | `#FAF8F4 → #E6E3DC` | `#F2E9D6 → #DCCDAE` (cream) |
| Label header band / text | `#E0602F → #C9461A` (UNLOCK-key orange) / `#FFF5EE` | `#3E2412 → #24150B` (dark brown) / `#FFC56A` (amber CRT) |
| Label pinstripes (2 px each) | `#2B2B2D` / `#F1EFEA` / `#2B2B2D` (OPEN-key black) | `#E39A3B` / `#C9631F` / `#9E3F14` (the Dark logo stripes) |
| Label rules / name ink | `rgba(58,57,54,.28)` / `#1C1D22` | `rgba(110,66,35,.32)` / `#1E140C` |

## 5. Normal size (2×) with a true-scale deck

The Small window (820 × 860) stays exactly as described above. The **Normal** window renders the same UI at **2×** (1640 × 1780). Use CSS `zoom: 2`, a 2× layout scale or DPI-aware sizing, so text and graphics are redrawn sharp rather than stretched. The screen, case and chin are the Small layout doubled. The **deck is rebuilt at real-world proportions**, scaled to the floppy drive. All numbers below are in 1× units, so double them on screen.

| Part | Real size | 1× px (2.5 px/mm) | On screen at 2× |
|---|---|---|---|
| Drive face | 101.6 × 25.4 mm | 254 × 64, radius 6 | 508 × 128 |
| Slot (opening) | 92 × 5.6 mm | 230 × 14 at (12, 12) | 460 × 28 |
| Activity LED | 7 × 2.4 mm | 17 × 6 at (14, 41) | 34 × 12 |
| Eject button | 14 × 5.6 mm | 35 × 14, right 14, top 37 | 70 × 28 |
| Disk | 90 × 94 mm | scale 0.682 → 225 × 235, left −38 | 450 × 470 |
| Rocker (illuminated) | 18 × 26 mm bezel | lens 35 × 55 + 5 px bezel padding; strip 12 px | 90 × 130 |
| UNLOCK / OPEN keycaps | ~22 × 15 mm | 55 × 38 in a well (5 + 2 px) | 110 × 76 |

- **Clip line:** 22 px below the drive top, 10 px into the 14 px slot. The well is 254 × 152, which leaves room for the popped-out "done" position.
- **Disk positions:** the `ty` values in the state table are unchanged. One disk height is 234.6 px at 1×, so the open position is −110 px and done is −84 px.
- **Deck:** 172 px tall, with 30 px side padding. The rocker group, drive and keys are top-aligned at 10, 24 and 14 px from the deck top. Vent grilles (172 × 16) sit bottom-left and bottom-right, 18 px from the bottom. The case is 820 × 864.
- **Text (1×):** SAVE TO: 11 px bold; option legends 8.5 px with a 5 px LED dot; PROCESS 8.5 px; key labels 7.5 px with 9 px icons; drive labels 7.5–8 px.

## 6. Save-location rocker (next to the drive)

- Bold **SAVE TO:** sits to the left of the rocker: Space Mono 700, 13 px, letter-spacing .16em, deck text color, with the theme's emboss shadow. It's vertically centered on the rocker.
- The two options are legends on the rocker's ends: **SAME FOLDER** above it and **ASK EACH TIME** below it. Each is 10 px with a 7 px LED dot. The active option gets a lit LED and bold text.
- Layout is a 2-column grid with areas `'title same' 'title rocker' 'title ask'`, a 14 px column gap and a 5 px row gap. The rocker itself (illuminated, 44 × 76 lens) is unchanged and lit when SAME FOLDER is selected.

## 7. Porting notes by UI stack

- **WebView2 / Electron / Tauri / any HTML UI:** use the reference file as it is. Copy the markup, the CSS and `FloppyDrive`, then call the four hooks. *(PDFu uses this route: pywebview + WebView2.)*
- **WPF:** put the disk in a `Canvas` inside a `Border` with `ClipToBounds="True"` positioned at the slot (that's the well). Animate a `TranslateTransform.Y` with `DoubleAnimationUsingKeyFrames` and `SplineDoubleKeyFrame`: KeySpline equals the bezier control points above, but y values above 1 aren't allowed, so do the overshoot as an extra keyframe. For the name wipe, animate a `RectangleGeometry` clip's width. The shake is a short `RepeatBehavior="Forever"` translate on the drive.
- **Qt (PySide/PyQt):** make the well a child `QWidget`. A parent clips its children, so the disk widget inside it clips at the slot automatically. Animate `pos` with `QPropertyAnimation` and `QEasingCurve.BezierSpline` (`addCubicBezierSegment`). Chain the phases with `QSequentialAnimationGroup`. For the name wipe, animate a clip rect in `paintEvent`.
- **WinForms / Tkinter:** draw the disk and drive layers as pre-rendered images, either exported from the canvas or drawn once. Composite them on a double-buffered surface every 16 ms, applying the eased `ty`. Clipping is simply not drawing above the slot line.
