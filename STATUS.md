# DavesSweater — STATUS

Schema (Refactor 2): Live / Parked / Decisions for David / Done (dated). Task-level detail stays in
`CHECKLIST.md` (the shipped-capability and task ledger); this file is the week's state. Public repository.

## Live

- **Experiments lane (Refactor 2 Lane 4) — BUILT 2026-09-08, DRY RUN; exit tests pending.** Routine
  `ds-experiments-weekly` Wednesdays 08:00 runs `experiments/RUNBOOK.md` in the lane worktree
  (`~/Projects/worktrees/ds-experiments`, on `main`); dead-man `ds-experiments-deadman` Thursdays 08:00.
  State `experiments/STATE.json`; durable record `experiments/LEDGER.md`. $0 cash, 0 Ahrefs units, one
  reversible experiment at a time, applied only after a completed Todoist decision. Last run: none yet.

## Parked

- (none)

## Decisions for David

- (none open here — lane decisions arrive as Todoist tasks and in the weekly digest)

## Done (dated)

- 2026-09-08 — Experiments lane skeleton landed (RUNBOOK, STATE, LEDGER, wrapper, digest builder,
  committed allowlist + hooks). Builder: the Refactor 2 session.

## Run records

One row per session per day, written by the Stop hook (`shared-skills/dev-env/hooks/stop-run-record.sh`). Silence here means no session ran.
