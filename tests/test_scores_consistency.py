"""Guards the invariant that scores.json's entries[] (per-day, powers the trend
chart + tracking stats) agrees with totals (powers the scoreboard average).

An append-only bug in _update_running_scores once let a re-score refresh totals
while freezing the old per-day entries, so the same page showed two different
Ray averages. entries[] is now rebuilt from the comparison files each run; this
test fails fast if that ever drifts again."""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SCORES = ROOT / "data" / "scores.json"
LOCATIONS = ROOT / "data" / "locations"
sys.path.insert(0, str(ROOT / "scripts"))


def _entries_match_totals(scores):
    for src, t in scores["totals"].items():
        evals = [e[src] for e in scores["entries"] if isinstance(e.get(src), (int, float))]
        assert len(evals) == t["days"], f"{src}: entries n={len(evals)} != totals days={t['days']}"
        assert abs(sum(evals) - t["total_score"]) < 0.5, (
            f"{src}: entries sum {sum(evals):.2f} != totals total_score {t['total_score']:.2f}"
        )


def test_entries_match_totals():
    _entries_match_totals(json.load(open(SCORES)))


def test_town_entries_match_totals():
    """Every town board's entries[] must agree with its totals, same invariant."""
    for sp in sorted(LOCATIONS.glob("*/scores.json")):
        _entries_match_totals(json.load(open(sp)))


def test_town_boards_are_a_rescore_fixed_point():
    """Every town's stored source score must equal a fresh re-score from its
    stored prediction + actuals under the current engine — so the boards are not
    stale (e.g. after the Ray sky-icon precip-credit backfill). Guards that
    rescore_history.py was actually run and left the towns consistent."""
    import compare
    for comp_file in sorted(LOCATIONS.glob("*/comparisons/*.json")):
        d = json.load(open(comp_file))
        actuals = d.get("actuals")
        if not actuals:
            continue
        norm = compare._normalize_actual(actuals)
        for src, sd in d.get("sources", {}).items():
            pred = sd.get("prediction")
            if pred is None or "score" not in sd:
                continue
            fresh = compare.score_prediction(compare._to_contract(pred), norm)
            assert fresh["score"] == sd["score"]["score"], (
                f"{comp_file.parent.parent.name}/{d.get('date')} {src}: stored "
                f"{sd['score']['score']} != fresh {fresh['score']} — run rescore_history.py"
            )


def test_ray_town_boards_credit_the_sky_icon():
    """After the backfill, at least one Ray town-day carries a mapped precip_type
    and earns precip points — proves the icon credit actually landed on the boards."""
    import compare
    credited = 0
    for comp_file in sorted(LOCATIONS.glob("*/comparisons/*.json")):
        d = json.load(open(comp_file))
        rw = d.get("sources", {}).get("raysweather")
        if not rw:
            continue
        pred = rw.get("prediction", {})
        if "precip_type" in pred.get("fields_provided", []):
            bd = rw["score"].get("breakdown", {}).get("precip", {})
            if bd.get("points"):
                credited += 1
    assert credited > 0, "no Ray town-day earned sky-icon precip credit"
