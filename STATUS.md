# DavesSweater — STATUS

Schema (Refactor 2): Live / Parked / Decisions for David / Done (dated). Task-level detail stays in
`CHECKLIST.md` (the shipped-capability and task ledger); this file is the week's state. Public repository.

## Live

- **Experiments lane (Refactor 2 Lane 4) — run `2026-09-25-6caf8a` 2026-09-25, status PARTIAL (apply
  FAILED — infrastructure; preflight, commit, push, ledger and digest ran).** Routine
  `ds-experiments-weekly` Wednesdays 08:00 runs `experiments/RUNBOOK.md` in the lane worktree
  (`~/Projects/worktrees/ds-experiments`, on `main`); dead-man `ds-experiments-deadman` Thursdays 08:00.
  Two runs (2026-09-17, 2026-09-24 ×2) were MISSED entirely before this one — see dead-man log. Active
  experiment: none. `foscoe-title-meta-ctr` is **still APPROVED and still not applied, now for the third
  attempted run** — the approval gate is satisfied (`d-20260908-5ef7`, 2026-09-09) and the lane is live
  (`dry_run` false, `push_enabled` true since 2026-09-09 08:50), but the worktree has **no `node_modules`**:
  `npx vitest run` fails with `Cannot find module 'vitest/config'` and `npm run lint` can't run either;
  `npm install`/`npm ci` are denied by the committed allowlist, so the lane cannot fix this itself and
  never will under the current setup (`check_function_budget.py` passes, 10/10 bundles — that check alone
  is not enough gate to ship on). Standing decision `d-20260916-2e88` (raised 2026-09-16, open 9 days,
  never filed to Todoist until this run) asks David to run `npm ci` once in the worktree — cheapest fix,
  root cause confirmed unchanged this run. $0 cash, 0 Ahrefs units. Digest:
  `experiments/digests/2026-09-25-6caf8a.md`. State `experiments/STATE.json`; record
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
- 2026-09-24 08:01 · session 2b32c07c · ds-experiments (main) · HEAD b4b0a03b · dirty 0
- 2026-09-24 14:12 · session 401323fb · ds-experiments (main) · HEAD c4d2fb6b · dirty 1
