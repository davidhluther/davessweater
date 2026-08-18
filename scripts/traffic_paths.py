#!/usr/bin/env python3
"""
traffic_paths.py — where the TomTom-derived traffic dataset lives.

It does NOT live in this repo. This repo is public, and TomTom's Portal Terms
& Conditions (clause 11.4, caching only in clients per the cache-control
headers; clause 11.6.1, no secondary or derived database) do not cover
persistent server-side storage of Results, let alone republishing them. The
`data/` tree also carries a CC BY 4.0 licence offering everything in it for
reuse including commercially, which is a licence we cannot grant over another
party's Results. So the whole `traffic/` tree — the raw flow samples and every
layer derived from them — was moved out of the public tree on 2026-08-13.
See CHECKLIST.md, "TomTom storage exposure," for the full finding.

Use continues privately; publication stops. Every traffic script resolves its
paths through here, so there is one place that says where the dataset is.

Resolution order:
  1. $DS_PRIVATE_DATA_DIR — set this in CI (the workflow points it at the
     private data checkout) or locally to keep the dataset off this disk.
  2. <repo>/private-data — the default, .gitignore'd, which is where the
     working copy sits on the owner's machine.

Nothing here creates directories or reads files; callers decide that. A
missing traffic directory is a normal state (a fresh public checkout has no
private data), and consumers are expected to degrade gracefully rather than
fail.
"""

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PRIVATE_DIR = REPO_ROOT / "private-data"
ENV_VAR = "DS_PRIVATE_DATA_DIR"


def private_data_dir() -> Path:
    """Root of the private (never-committed-here) data store."""
    raw = os.environ.get(ENV_VAR, "").strip()
    if raw:
        return Path(raw).expanduser()
    return DEFAULT_PRIVATE_DIR


def traffic_dir() -> Path:
    """Root of the traffic dataset: actuals/, forecast/, comparisons/, scores.json."""
    return private_data_dir() / "traffic"


def traffic_subdir(name: str) -> Path:
    """One traffic subdirectory, e.g. traffic_subdir("actuals")."""
    return traffic_dir() / name


def traffic_store_present() -> bool:
    """True when the private traffic store is mounted in this checkout."""
    return traffic_dir().is_dir()
