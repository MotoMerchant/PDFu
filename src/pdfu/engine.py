"""
PDFu unlock engine.

Uses pikepdf, the Python binding to qpdf. Unlocking is the same operation as
``qpdf --decrypt``: the file is re-written without its encryption dictionary,
so print / copy / edit restrictions are gone. Nothing is re-rendered or
flattened; pages, form fields, bookmarks, layers and images are kept.

Rules this module guarantees:

* The original file is only ever read, never written.
* The copy is named ``<original name>_Unlocked.pdf``. An existing file is never
  overwritten: ``_Unlocked_2.pdf``, ``_Unlocked_3.pdf`` ... are used instead.
* The copy is written to a temporary ``.part`` file first and only renamed to
  its real name once it is complete, so a failure never leaves half a PDF.
* A file that is not encrypted is reported as such and no copy is made.
* A file that needs a password just to OPEN raises :class:`PasswordNeeded`.
  Passwords are only held in memory by the caller; this module never stores
  them.
"""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Callable, Iterable

import pikepdf

SUFFIX = "_Unlocked"

LOCKED = "locked"                  # encrypted with restrictions, opens without a password
NOT_ENCRYPTED = "not_encrypted"    # nothing to unlock
UNLOCKED = "unlocked"              # result: a copy was written

ProgressFn = Callable[[int, str], None]


class PdfReadError(Exception):
    """The file could not be read as a PDF (damaged, truncated, not a PDF)."""


class PasswordNeeded(Exception):
    """The PDF needs an open (user) password that was not supplied or was wrong."""


@dataclass
class PdfInfo:
    path: str
    name: str
    folder: str
    size_bytes: int
    pages: int
    status: str                 # LOCKED or NOT_ENCRYPTED
    can_print: bool
    can_copy: bool
    can_edit: bool
    certified: bool             # has a certification (DocMDP) signature
    signed: bool                # has one or more digital signatures
    needed_password: bool       # an open password had to be used

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class UnlockResult:
    outcome: str                # UNLOCKED or NOT_ENCRYPTED
    output: Path | None
    certified: bool
    signed: bool
    steps: list[str] = field(default_factory=list)


def is_pdf_name(path: str | os.PathLike) -> bool:
    return str(path).lower().endswith(".pdf")


def output_name(src: str | os.PathLike) -> str:
    return f"{Path(src).stem}{SUFFIX}.pdf"


def unique_path(path: Path) -> Path:
    """Never overwrite: name_Unlocked.pdf -> name_Unlocked_2.pdf -> _3 ..."""
    if not path.exists():
        return path
    n = 2
    while True:
        candidate = path.with_name(f"{path.stem}_{n}{path.suffix}")
        if not candidate.exists():
            return candidate
        n += 1


def _signature_flags(pdf: pikepdf.Pdf) -> tuple[bool, bool]:
    """Detect a certification (DocMDP) signature and ordinary digital signatures."""
    certified = signed = False
    try:
        perms = pdf.Root.get("/Perms")
        if perms is not None and "/DocMDP" in perms:
            certified = True
        acro = pdf.Root.get("/AcroForm")
        if acro is not None and int(acro.get("/SigFlags", 0)) & 1:
            signed = True
    except Exception:  # odd/malformed structures: just report "not signed"
        pass
    return certified, signed or certified


def _open(path: Path, passwords: Iterable[str]) -> tuple[pikepdf.Pdf, str]:
    """Open with the first password that works ("" = no password)."""
    tried_any = False
    for pw in passwords:
        tried_any = True
        try:
            return pikepdf.open(path, password=pw), pw
        except pikepdf.PasswordError:
            continue
        except pikepdf.PdfError as e:
            raise PdfReadError(_first_line(e)) from e
    if not tried_any:  # pragma: no cover - callers always pass at least ""
        raise ValueError("no passwords to try")
    raise PasswordNeeded(path.name)


def _first_line(e: Exception) -> str:
    text = str(e).strip()
    return text.splitlines()[0] if text else "unreadable PDF"


def inspect_pdf(path: str | os.PathLike, passwords: Iterable[str] = ("",)) -> tuple[PdfInfo, str]:
    """
    Read a PDF's lock state without changing anything.

    Returns ``(info, password_that_worked)``. Raises :class:`PasswordNeeded` if
    none of ``passwords`` opens it, :class:`PdfReadError` if it isn't a
    readable PDF, and ``OSError`` for file-system problems.
    """
    src = Path(path)
    if not src.is_file():
        raise FileNotFoundError(str(src))
    size = src.stat().st_size
    pdf, pw = _open(src, passwords)
    with pdf:
        certified, signed = _signature_flags(pdf)
        try:
            pages = len(pdf.pages)
        except Exception:
            pages = 0
        if pdf.is_encrypted:
            allow = pdf.allow
            status = LOCKED
            can_print = bool(allow.print_lowres or allow.print_highres)
            can_copy = bool(allow.extract)
            can_edit = bool(allow.modify_other)
        else:
            status = NOT_ENCRYPTED
            can_print = can_copy = can_edit = True
    info = PdfInfo(
        path=str(src),
        name=src.name,
        folder=str(src.parent),
        size_bytes=size,
        pages=pages,
        status=status,
        can_print=can_print,
        can_copy=can_copy,
        can_edit=can_edit,
        certified=certified,
        signed=signed,
        needed_password=pw != "",
    )
    return info, pw


def unlock_pdf(
    src: str | os.PathLike,
    out_dir: str | os.PathLike | None = None,
    password: str = "",
    progress: ProgressFn | None = None,
) -> UnlockResult:
    """
    Write an unrestricted copy of ``src`` into ``out_dir`` (default: next to it).

    ``progress(percent, step)`` is called as work advances; ``step`` is one of
    ``open``, ``restrictions``, ``password``, ``clearing``, ``writing``, ``done``.
    """
    src = Path(src)
    report = progress or (lambda pct, step: None)
    steps: list[str] = []

    def step(pct: int, name: str) -> None:
        if not steps or steps[-1] != name:
            steps.append(name)
        report(pct, name)

    step(2, "open")
    pdf, _ = _open(src, [password] if password else [""])
    with pdf:
        certified, signed = _signature_flags(pdf)
        if not pdf.is_encrypted:
            step(100, "done")
            return UnlockResult(NOT_ENCRYPTED, None, certified, signed, steps)

        step(25, "password" if password else "restrictions")
        step(45, "clearing")

        target_dir = Path(out_dir) if out_dir else src.parent
        out = unique_path(target_dir / output_name(src))
        tmp = out.with_name(out.name + ".part")

        def on_save(pct: int) -> None:  # pikepdf reports 0-100 while writing
            step(50 + int(max(0, min(100, pct)) * 0.49), "writing")

        step(50, "writing")
        try:
            # save() without `encryption=` drops all encryption and restrictions.
            pdf.save(tmp, progress=on_save)
        except BaseException:
            try:
                tmp.unlink()
            except OSError:
                pass
            raise
    os.replace(tmp, out)  # appears under its real name only once complete
    step(100, "done")
    return UnlockResult(UNLOCKED, out, certified, signed, steps)


def qpdf_version() -> str:
    return str(pikepdf.__libqpdf_version__)


def pikepdf_version() -> str:
    return str(pikepdf.__version__)
