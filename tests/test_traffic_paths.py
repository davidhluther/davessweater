"""Where the traffic dataset lives, and why it is not here.

The TomTom-derived traffic tree left this public repo on 2026-08-13: TomTom's
Portal Terms permit caching Results only in clients per the cache-control
headers (11.4) and forbid building a secondary or derived database from them
(11.6.1), and this repo publishes data/ under CC BY 4.0, which would hand
everyone else a licence we do not hold. These tests pin the two properties that
keep that true — the dataset resolves outside data/, and the location is
overridable so CI can mount a private checkout.
"""
import os

import traffic_paths as tp


def test_default_store_is_outside_the_data_directory():
    traffic = tp.traffic_dir()
    assert tp.DEFAULT_PRIVATE_DIR.name == "private-data"
    assert traffic == tp.DEFAULT_PRIVATE_DIR / "traffic"
    assert (tp.REPO_ROOT / "data") not in traffic.parents


def test_env_override_relocates_the_whole_store(monkeypatch, tmp_path):
    monkeypatch.setenv(tp.ENV_VAR, str(tmp_path / "elsewhere"))
    assert tp.private_data_dir() == tmp_path / "elsewhere"
    assert tp.traffic_dir() == tmp_path / "elsewhere" / "traffic"
    assert tp.traffic_subdir("actuals") == tmp_path / "elsewhere" / "traffic" / "actuals"


def test_blank_env_falls_back_to_the_default(monkeypatch):
    monkeypatch.setenv(tp.ENV_VAR, "   ")
    assert tp.private_data_dir() == tp.DEFAULT_PRIVATE_DIR


def test_store_presence_is_reported_not_created(monkeypatch, tmp_path):
    """Resolving a path must never create it — a missing store is a normal state
    that consumers degrade on, and a directory created by accident would make an
    unmounted CI run look mounted."""
    target = tmp_path / "nothing-here"
    monkeypatch.setenv(tp.ENV_VAR, str(target))
    assert tp.traffic_store_present() is False
    assert not target.exists()
    (target / "traffic").mkdir(parents=True)
    assert tp.traffic_store_present() is True


def test_capture_writes_into_the_private_store(monkeypatch, tmp_path):
    """The capture script's output directory follows the override, so the
    workflow's mounted checkout is where samples land."""
    monkeypatch.setenv(tp.ENV_VAR, str(tmp_path / "mounted"))
    assert tp.traffic_subdir("actuals").is_relative_to(tmp_path / "mounted")
    assert os.environ[tp.ENV_VAR] == str(tmp_path / "mounted")
