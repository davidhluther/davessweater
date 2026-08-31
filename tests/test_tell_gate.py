"""Tell-scorer pre-publish gate over the native posts.

Scores every markdown post in src/content/posts/ with the shared tell-scorer
engine (~/Projects/shared-skills/seo/tell-scorer — client-generic, lives once,
never vendored here) and fails the suite when a post breaches the DS language
ceilings in guidelines/seo/tell-gate-thresholds.json. Formatting tells
(em-dash, internal colons, bold stats) are warn-only by design — see the
"_notes" field in that file — so they print but never fail.

The engine is a local shared checkout, not a dependency of this public repo:
when it (or python3) is absent, the whole module skips. That keeps CI and
outside contributors green; the gate binds on the owner's machine, same
posture as the copy lint's shared word lists.
"""

import csv
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
THRESHOLDS = REPO_ROOT / "guidelines" / "seo" / "tell-gate-thresholds.json"
ENGINE = (
    Path.home()
    / "Projects"
    / "shared-skills"
    / "seo"
    / "tell-scorer"
    / "scripts"
    / "score_batch.py"
)

pytestmark = pytest.mark.skipif(
    not ENGINE.exists() or shutil.which("python3") is None,
    reason="shared tell-scorer engine not present (owner-machine gate)",
)


def score_posts(tmp_path: Path) -> list[dict]:
    out = tmp_path / "scores.csv"
    proc = subprocess.run(
        [
            "python3",
            str(ENGINE),
            "--md-glob",
            str(REPO_ROOT / "src" / "content" / "posts" / "*.md"),
            "--out",
            str(out),
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert proc.returncode == 0, f"score_batch failed:\n{proc.stderr}"
    assert "EXTRACTION PROBLEM" not in proc.stderr, proc.stderr
    with out.open() as fh:
        return list(csv.DictReader(fh))


def test_posts_pass_the_language_gate(tmp_path):
    limits = json.loads(THRESHOLDS.read_text())
    gates = {k: v for k, v in limits.items() if not k.startswith("_")}
    warns = {
        k.removeprefix("_warn_"): v
        for k, v in limits.items()
        if k.startswith("_warn_")
    }
    rows = score_posts(tmp_path)
    assert rows, "no posts scored — src/content/posts empty or glob broken"

    failures, warnings = [], []
    for row in rows:
        for feat, ceiling in gates.items():
            val = float(row.get(feat) or 0)
            if val > float(ceiling):
                failures.append(f"{row['id']}: {feat} = {val} (ceiling {ceiling})")
        for feat, ceiling in warns.items():
            val = float(row.get(feat) or 0)
            if val > float(ceiling):
                warnings.append(f"{row['id']}: {feat} = {val} (warn ceiling {ceiling})")

    for line in warnings:
        print(f"TELL WARN (formatting, non-blocking) {line}", file=sys.stderr)
    assert not failures, "tell-scorer language gate breaches:\n" + "\n".join(
        f"  {f}" for f in failures
    )
