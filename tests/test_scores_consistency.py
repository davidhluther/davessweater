"""Guards the invariant that scores.json's entries[] (per-day, powers the trend
chart + tracking stats) agrees with totals (powers the scoreboard average).

An append-only bug in _update_running_scores once let a re-score refresh totals
while freezing the old per-day entries, so the same page showed two different
Ray averages. entries[] is now rebuilt from the comparison files each run; this
test fails fast if that ever drifts again."""
import json
import pathlib

SCORES = pathlib.Path(__file__).resolve().parent.parent / "data" / "scores.json"


def test_entries_match_totals():
    scores = json.load(open(SCORES))
    for src, t in scores["totals"].items():
        evals = [e[src] for e in scores["entries"] if isinstance(e.get(src), (int, float))]
        assert len(evals) == t["days"], f"{src}: entries n={len(evals)} != totals days={t['days']}"
        assert abs(sum(evals) - t["total_score"]) < 0.5, (
            f"{src}: entries sum {sum(evals):.2f} != totals total_score {t['total_score']:.2f}"
        )
