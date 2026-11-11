import hashlib

import pikepdf
import pytest

from pdfu import engine


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_inspect_reports_restrictions(pdfs):
    info, pw = engine.inspect_pdf(pdfs["locked"])
    assert info.status == engine.LOCKED and pw == ""
    assert (info.can_print, info.can_copy, info.can_edit) == (False, False, False)
    assert info.pages == 3 and info.size_bytes > 0 and not info.needed_password


def test_unlock_writes_open_copy_and_leaves_original_alone(pdfs):
    src = pdfs["locked"]
    before = sha(src)
    result = engine.unlock_pdf(src)
    assert result.outcome == engine.UNLOCKED
    assert result.output == src.with_name("S-101 Foundation Plan_Unlocked.pdf")
    with pikepdf.open(result.output) as out:
        assert not out.is_encrypted
        assert len(out.pages) == 3
        assert b"Sheet S-102" in out.pages[1].Contents.read_bytes()   # content preserved
    assert sha(src) == before
    assert not list(pdfs["dir"].glob("*.part"))


def test_never_overwrites_an_existing_copy(pdfs):
    taken = pdfs["dir"] / "S-101 Foundation Plan_Unlocked.pdf"
    taken.write_bytes(b"keep me")
    second = engine.unlock_pdf(pdfs["locked"]).output
    third = engine.unlock_pdf(pdfs["locked"]).output
    assert second.name == "S-101 Foundation Plan_Unlocked_2.pdf"
    assert third.name == "S-101 Foundation Plan_Unlocked_3.pdf"
    assert taken.read_bytes() == b"keep me"


def test_custom_output_folder(pdfs, tmp_path):
    out_dir = tmp_path / "Unlocked Output"
    out_dir.mkdir()
    result = engine.unlock_pdf(pdfs["locked"], out_dir)
    assert result.output.parent == out_dir


def test_not_encrypted_makes_no_copy(pdfs):
    info, _ = engine.inspect_pdf(pdfs["clean"])
    assert info.status == engine.NOT_ENCRYPTED and info.can_edit
    result = engine.unlock_pdf(pdfs["clean"])
    assert result.outcome == engine.NOT_ENCRYPTED and result.output is None
    assert not (pdfs["dir"] / "A-101 Floor Plan_Unlocked.pdf").exists()


def test_open_password(pdfs):
    with pytest.raises(engine.PasswordNeeded):
        engine.inspect_pdf(pdfs["password"])
    with pytest.raises(engine.PasswordNeeded):
        engine.inspect_pdf(pdfs["password"], ["", "wrong"])
    info, pw = engine.inspect_pdf(pdfs["password"], ["", "wrong", "steel2026"])
    assert pw == "steel2026" and info.needed_password and info.status == engine.LOCKED
    result = engine.unlock_pdf(pdfs["password"], password="steel2026")
    with pikepdf.open(result.output) as out:          # opens with no password at all
        assert not out.is_encrypted
    with pytest.raises(engine.PasswordNeeded):
        engine.unlock_pdf(pdfs["password2"], password="wrong")


def test_damaged_file(pdfs):
    with pytest.raises(engine.PdfReadError):
        engine.inspect_pdf(pdfs["broken"])
    with pytest.raises(engine.PdfReadError):
        engine.unlock_pdf(pdfs["broken"])


def test_missing_file(pdfs):
    with pytest.raises(FileNotFoundError):
        engine.inspect_pdf(pdfs["dir"] / "gone.pdf")


def test_certification_signature_flags(pdfs):
    info, _ = engine.inspect_pdf(pdfs["sealed"])
    assert info.status == engine.NOT_ENCRYPTED and info.certified and info.signed
    result = engine.unlock_pdf(pdfs["sealed_locked"])
    assert result.outcome == engine.UNLOCKED and result.certified and result.signed


def test_progress_is_reported_in_order(pdfs):
    seen = []
    engine.unlock_pdf(pdfs["locked"], progress=lambda pct, step: seen.append((pct, step)))
    pcts = [p for p, _ in seen]
    steps = []
    for _, s in seen:
        if not steps or steps[-1] != s:
            steps.append(s)
    assert pcts == sorted(pcts) and pcts[-1] == 100
    assert steps == ["open", "restrictions", "clearing", "writing", "done"]


def test_password_step_reported(pdfs):
    seen = []
    engine.unlock_pdf(pdfs["password"], password="steel2026", progress=lambda pct, step: seen.append(step))
    assert "password" in seen and "restrictions" not in seen


def test_failed_write_leaves_nothing_behind(pdfs, tmp_path):
    with pytest.raises(OSError):
        engine.unlock_pdf(pdfs["locked"], tmp_path / "does-not-exist")
    assert not list(tmp_path.rglob("*.part"))


def test_names():
    assert engine.output_name(r"C:\Docs\Invoice_0412.pdf".replace("\\", "/")) == "Invoice_0412_Unlocked.pdf"
    assert engine.is_pdf_name("a.PDF") and not engine.is_pdf_name("a.txt")
