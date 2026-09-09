#!/usr/bin/env python3
"""digest.py — the UNCONDITIONAL weekly DavesSweater experiments digest (Refactor 2 Lane 4).

Runs even when every earlier step failed, and says so. Reads experiments/STATE.json and the current run
file experiments/runs/<run_id>.json (written by the shared run_state.py through experiments/lane.sh) and
writes experiments/digests/<run_id>[-dry-run].md.

Sections, every week: THIS WEEK (proposed / applied / measuring / concluded) · RESULTS (metric,
baseline → now, verdict kept / reverted / inconclusive) · NEXT PROPOSAL · DECISIONS FOR DAVID (≤3,
each with a default) · RUN HEALTH (steps · wall · Ahrefs units, must be 0 · cash, must be $0).
    python3 experiments/scripts/digest.py [--run <id>]    prints the digest path; exit 0 always
"""
from __future__ import annotations
import json, sys, os, datetime, argparse

REPO = os.environ.get("LANE_REPO") or os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LANE = os.environ.get("LANE_ROOT", "experiments")
LANE_TITLE = os.environ.get("LANE_TITLE", "DAVESSWEATER EXPERIMENTS")
STATE = os.path.join(REPO, LANE, "STATE.json")
RUNS = os.path.join(REPO, LANE, "runs")
DIGESTS = os.path.join(REPO, LANE, "digests")


def load(p, default):
    try:
        return json.load(open(p, encoding="utf-8"))
    except Exception:
        return default


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--run", default=None); a = ap.parse_args()
    state = load(STATE, {})
    run_id = a.run or state.get("run_id")
    run = load(os.path.join(RUNS, f"{run_id}.json"), {}) if run_id else {}
    tstr = datetime.date.today().isoformat()
    dry = bool(state.get("dry_run", True))
    steps = run.get("steps", [])
    failed = [s for s in steps if s.get("status") == "fail"]
    ok = [s for s in steps if s.get("status") == "ok"]
    skipped = [s for s in steps if s.get("status") == "skip"]
    verdict = "FAILED" if (not steps or (failed and not ok)) else ("PARTIAL" if failed else "OK")
    if run.get("minutes") is None and run.get("started"):
        try:
            run["minutes"] = round((datetime.datetime.now().astimezone() - datetime.datetime.fromisoformat(run["started"])).total_seconds() / 60, 1)
        except Exception:
            pass
    open_dec = [d for d in state.get("open_decisions", []) if d.get("status", "open") == "open"]
    decisions, overflow = open_dec[:3], max(0, len(open_dec) - 3)
    active = state.get("active_experiment") or {}
    units = run.get("ahrefs_units")
    units = 0 if units is None else units
    cash = run.get("cash_usd", 0)

    L = [f"# {LANE_TITLE} — week of {tstr}    run: {verdict}" + ("    [DRY RUN — nothing applied]" if dry else ""), ""]
    L.append(f"Run `{run_id or '(no run id — the run never started)'}` · started {run.get('started','?')} · mode {'DRY RUN (propose + measure only)' if dry else 'live'} · "
             f"approval gate {'LIFTED' if state.get('apply_without_approval') else 'ON (a completed Todoist decision is required before any change is applied)'}")
    L += ["", "## THIS WEEK  (proposed / applied / measuring / concluded)", ""]
    if not steps:
        L.append("**The run recorded no steps** — it never started or died before the first step. Treat as a missed run; the Thursday dead-man will say the same.")
    elif failed and not ok:
        L.append("**Every step failed** — nothing was proposed, applied, or measured. Failed steps are named under RUN HEALTH.")
    else:
        tw = run.get("this_week") or []
        L += [f"- {x}" for x in tw] or ["- Nothing changed state this week."]
        if active:
            L.append(f"- Active experiment: **{active.get('name','?')}** — status {active.get('status','?')}; applied {active.get('applied_at') or 'not yet'}"
                     + (f" (`{active.get('applied_sha')}`)" if active.get('applied_sha') else "") + f"; window ends {active.get('window_end') or 'n/a'}; revert: `{active.get('revert_cmd') or 'NOT RECORDED'}`")
        else:
            L.append("- No active experiment.")
    L += ["", "## RESULTS  (metric · baseline → now · verdict: kept / reverted / inconclusive)", ""]
    res = run.get("results") or []
    L += [f"- {x}" for x in res] or ["- No measurement window closed this week."]
    L += ["", "## NEXT PROPOSAL", ""]
    nxt = run.get("next_proposal") or []
    L += [f"- {x}" for x in nxt] or ["- None proposed this week (see RUN HEALTH if that is a failure)."]
    L += ["", "## DECISIONS FOR DAVID [≤3, each with a default]", ""]
    if not decisions:
        L.append("None this week. (Completed Todoist tasks are read back at the start of the next run.)")
    else:
        for d in decisions:
            L.append(f"- [ ] **{d.get('title','(untitled)')}** — {d.get('question','')}")
            L.append(f"      default: {d.get('default','(none stated)')}" + (f" · Todoist: {d['todoist_id']}" if d.get('todoist_id') else " · Todoist task created by the run"))
        if overflow:
            L.append(f"   ({overflow} more held back — the cap is 3 per digest; they roll forward.)")
    L += ["", "## RUN HEALTH", ""]
    L.append(f"steps {len(ok)} ok · {len(failed)} failed · {len(skipped)} skipped · {run.get('minutes','?')} min wall · "
             f"Ahrefs units {units} (must be 0{' — VIOLATION' if units else ''}) · cash ${cash} (must be $0{' — VIOLATION' if cash else ''}) · "
             f"steps failed: " + (", ".join(f"{s.get('name')}: {s.get('note','')[:60]}" for s in failed) if failed else "none"))
    for s in failed:
        L.append(f"  - **FAILED** `{s.get('name')}`: {s.get('note','(no note)')}")
    for s in skipped:
        L.append(f"  - skipped `{s.get('name')}`: {s.get('note','')}")
    if run.get("cost"):
        L.append(f"- cost line: {run['cost']}")
    resolved = run.get("decisions_resolved") or []
    if resolved:
        L.append("- Decisions read back from Todoist as completed: " + "; ".join(resolved))
    L.append(f"- State: last_run {state.get('last_run')} → this run; completed experiments {len(state.get('completed_experiments') or [])}; "
             f"push {'enabled' if state.get('push_enabled') else 'disabled (an applied change cannot reach production until it is)'}; "
             f"lock {'present at digest time (the run removes it at finish)' if os.path.exists(os.path.join(REPO,'EXECUTING.lock')) else 'absent'}")
    L.append(os.environ.get("LANE_NEXT", "- Next fire: Wednesday 08:00 (routine ds-experiments-weekly); dead-man check Thursday 08:00."))
    L += ["", f"_Delivered by the {os.environ.get('LANE_NAME','ds-experiments')} lane wrapper (Refactor 2 skeleton). $0 cash, 0 Ahrefs units, one reversible experiment at a time, applied only after a completed decision. Silence is never a state: if this digest did not arrive on a Wednesday, the Thursday dead-man email says so._"]
    os.makedirs(DIGESTS, exist_ok=True)
    out = os.path.join(DIGESTS, f"{run_id or tstr}{'-dry-run' if dry else ''}.md")
    open(out, "w", encoding="utf-8").write("\n".join(L) + "\n"); print(out); return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:  # a digest must never be the failing step
        os.makedirs(DIGESTS, exist_ok=True)
        out = os.path.join(DIGESTS, f"{datetime.date.today().isoformat()}-digest-builder-crashed.md")
        open(out, "w", encoding="utf-8").write(f"# DavesSweater experiments digest — builder crashed\n\n## THIS WEEK\n\nUnknown — the digest builder itself raised: `{type(e).__name__}: {e}`\n\n## RUN HEALTH\n\n- digest.py crashed; the run's other artifacts may still exist under experiments/runs/.\n")
        print(out); sys.exit(0)
