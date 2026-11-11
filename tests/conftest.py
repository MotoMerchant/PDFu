import sys
from pathlib import Path

import pikepdf
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

LOCKED = pikepdf.Permissions(extract=False, modify_other=False, modify_annotation=False,
                             modify_form=False, modify_assembly=False, print_highres=False, print_lowres=False)


def _base(pages: int = 3) -> pikepdf.Pdf:
    pdf = pikepdf.new()
    for i in range(pages):
        pdf.add_blank_page(page_size=(612, 792))
        page = pdf.pages[-1]
        font = pikepdf.Dictionary(Type=pikepdf.Name.Font, Subtype=pikepdf.Name.Type1, BaseFont=pikepdf.Name.Helvetica)
        page.Resources = pikepdf.Dictionary(Font=pikepdf.Dictionary(F1=font))
        page.Contents = pdf.make_stream(f"BT /F1 24 Tf 72 700 Td (Sheet S-{101 + i}) Tj ET".encode())
    return pdf


def _certify(pdf: pikepdf.Pdf) -> None:
    pdf.Root.Perms = pikepdf.Dictionary(DocMDP=pikepdf.Dictionary())
    pdf.Root.AcroForm = pikepdf.Dictionary(Fields=pikepdf.Array(), SigFlags=3)


@pytest.fixture
def pdfs(tmp_path: Path) -> dict:
    d = tmp_path / "2026 Warehouse Addition"
    d.mkdir()
    files = {}
    with _base() as p:
        files["locked"] = d / "S-101 Foundation Plan.pdf"
        p.save(files["locked"], encryption=pikepdf.Encryption(owner="x9", user="", allow=LOCKED))
    with _base() as p:
        files["password"] = d / "S-201 Framing Plan.pdf"
        p.save(files["password"], encryption=pikepdf.Encryption(owner="x9", user="steel2026", allow=LOCKED))
    with _base() as p:
        files["password2"] = d / "S-202 Roof Framing Plan.pdf"
        p.save(files["password2"], encryption=pikepdf.Encryption(owner="x9", user="steel2026", allow=LOCKED))
    with _base(1) as p:
        files["clean"] = d / "A-101 Floor Plan.pdf"
        p.save(files["clean"])
    with _base(1) as p:
        _certify(p)
        files["sealed"] = d / "S-001 General Notes (sealed).pdf"
        p.save(files["sealed"])
    with _base(2) as p:
        _certify(p)
        files["sealed_locked"] = d / "S-301 Connection Details (sealed).pdf"
        p.save(files["sealed_locked"], encryption=pikepdf.Encryption(owner="x9", user="", allow=LOCKED))
    files["broken"] = d / "Bad download.pdf"
    files["broken"].write_bytes(b"<html>Session expired</html>")
    files["text"] = d / "Transmittal.txt"
    files["text"].write_text("not a pdf")
    files["dir"] = d
    return files
