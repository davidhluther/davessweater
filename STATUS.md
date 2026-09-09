# DavesSweater — STATUS

Schema (Refactor 2): Live / Parked / Decisions for David / Done (dated). Task-level detail stays in
`CHECKLIST.md` (the shipped-capability and task ledger); this file is the week's state. Public repository.

## Live

- **Experiments lane (Refactor 2 Lane 4) — DRY RUN, run `2026-09-09-0d748b` 2026-09-09, status OK (all
  steps ran; measure/propose/apply skipped by design, see below).** Routine `ds-experiments-weekly`
  Wednesdays 08:00 runs `experiments/RUNBOOK.md` in the lane worktree
  (`~/Projects/worktrees/ds-experiments`, on `main`); dead-man `ds-experiments-deadman` Thursdays 08:00.
  Active experiment: none. `foscoe-title-meta-ctr` is now **APPROVED** — David completed
  `d-20260908-5ef7` on 2026-09-09 with no refusing comment — but it was **not applied**: `dry_run` is
  true and `push_enabled` false, and an unpushed change never reaches production. One decision open:
  `d-20260909-1868`, take the lane out of dry run and apply it. Baseline re-verified from Search Console
  (0 units): 534 foscoe-intent impressions, 0 clicks, position 10.4. $0 cash, 0 Ahrefs units. Digest:
  `experiments/digests/2026-09-09-0d748b-dry-run.md`. State `experiments/STATE.json`; record
  `experiments/LEDGER.md`.

## Parked

- (none)

## Decisions for David

- (none open here — lane decisions arrive as Todoist tasks and in the weekly digest)

## Done (dated)

- 2026-09-08 — Exit test A (dry run): proposed `foscoe-title-meta-ctr`, applied nothing, queued one
  approval decision, digest built and sent.
- 2026-09-08 — Experiments lane skeleton landed (RUNBOOK, STATE, LEDGER, wrapper, digest builder,
  committed allowlist + hooks). Builder: the Refactor 2 session.

## Run records

One row per session per day, written by the Stop hook (`shared-skills/dev-env/hooks/stop-run-record.sh`). Silence here means no session ran.
