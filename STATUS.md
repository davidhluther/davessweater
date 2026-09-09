# DavesSweater — STATUS

Schema (Refactor 2): Live / Parked / Decisions for David / Done (dated). Task-level detail stays in
`CHECKLIST.md` (the shipped-capability and task ledger); this file is the week's state. Public repository.

## Live

- **Experiments lane (Refactor 2 Lane 4) — DRY RUN, exit test B ran 2026-09-08 (run `2026-09-08-5a548a`,
  status PARTIAL: preflight and notify FAILED as designed by the exit-test injections; every other step
  completed).** Routine `ds-experiments-weekly` Wednesdays 08:00 runs `experiments/RUNBOOK.md` in the lane
  worktree (`~/Projects/worktrees/ds-experiments`, on `main`); dead-man `ds-experiments-deadman` Thursdays
  08:00. Active experiment: none — `foscoe-title-meta-ctr` PROPOSED, still awaiting David's Todoist approval
  (`d-20260908-5ef7`); nothing applied (dry run). $0 cash, 0 Ahrefs units. Digest:
  `experiments/digests/2026-09-08-5a548a-dry-run.md`. State `experiments/STATE.json`; record `experiments/LEDGER.md`.

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
