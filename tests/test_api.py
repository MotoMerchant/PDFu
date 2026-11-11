"""The Python side of the UI bridge, exercised without opening a window."""

import pytest

from pdfu.app import Api, LAYOUT, fit_zoom, window_size
from pdfu.settings import Settings


@pytest.fixture
def api(tmp_path):
    return Api(Settings(tmp_path / "settings.json"), [], "small", 1.0)


def test_init_payload(api):
    cfg = api.init()
    assert cfg["native"] is True and cfg["size"] == "small" and cfg["saveMode"] == "same"
    assert cfg["qpdf"].count(".") >= 2


def test_inspect_kinds(api, pdfs):
    assert api.inspect(str(pdfs["text"]))["kind"] == "not_pdf"
    assert api.inspect(str(pdfs["broken"]))["kind"] == "unreadable"
    assert api.inspect(str(pdfs["dir"] / "gone.pdf"))["kind"] == "missing"
    assert api.inspect(str(pdfs["clean"]))["status"] == "not_encrypted"
    locked = api.inspect(str(pdfs["locked"]))
    assert locked["ok"] and locked["status"] == "locked" and locked["pages"] == 3


def test_password_is_remembered_for_the_session_only(api, pdfs, tmp_path):
    assert api.inspect(str(pdfs["password"]))["status"] == "needs_password"
    assert api.submit_password(str(pdfs["password"]), "nope")["wrong"] is True
    assert api.submit_password(str(pdfs["password"]), "")["wrong"] is True
    assert api.submit_password(str(pdfs["password"]), "steel2026")["status"] == "locked"
    # the next sheet of the same set opens without asking again
    assert api.inspect(str(pdfs["password2"]))["status"] == "locked"
    result = api.unlock(str(pdfs["password2"]))
    assert result["ok"] and result["out_name"] == "S-202 Roof Framing Plan_Unlocked.pdf"
    # and nothing about the password reached the settings file
    text = (tmp_path / "settings.json").read_text() if (tmp_path / "settings.json").exists() else ""
    assert "steel2026" not in text


def test_unlock_to_chosen_folder_records_recent(api, pdfs, tmp_path):
    out = tmp_path / "Unlocked"
    out.mkdir()
    api.inspect(str(pdfs["locked"]))
    result = api.unlock(str(pdfs["locked"]), str(out))
    assert result["ok"] and result["same_folder"] is False and result["out_dir"] == str(out)
    choices = api.save_choices(str(pdfs["sealed_locked"]))
    assert choices[0] == {"path": str(pdfs["dir"]), "note": "ORIGINAL"}
    assert {"path": str(out), "note": "RECENT"} in choices


def test_unlock_reports_problems(api, pdfs, tmp_path):
    assert api.unlock(str(pdfs["clean"]))["kind"] == "not_encrypted"
    assert api.unlock(str(pdfs["broken"]))["kind"] == "unreadable"
    assert api.unlock(str(pdfs["locked"]), str(tmp_path / "nope"))["kind"] == "dest"


def test_settings_validate_and_persist(tmp_path):
    s = Settings(tmp_path / "s.json")
    assert s.set("save_mode", "ask") and not s.set("save_mode", "sideways")
    assert not s.set("password", "x")
    for i in range(8):
        d = tmp_path / f"f{i}"
        d.mkdir()
        s.add_recent_folder(str(d))
    s.add_recent_folder(str(tmp_path / "f6"))
    again = Settings(tmp_path / "s.json")
    assert again.get("save_mode") == "ask"
    assert again.recent_folders()[0].endswith("f6") and len(again.recent_folders()) == 5


def test_window_geometry():
    assert window_size("small", 1.0) == (820, 844)
    assert window_size("normal", 2.0) == (1640, 1756)
    assert 0.5 <= fit_zoom("small") <= 1.0 and LAYOUT["normal"]["zoom"] == 2.0
