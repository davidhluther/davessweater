# DavesSweater — STATUS

Schema (Refactor 2): Live / Parked / Decisions for David / Done (dated). Task-level detail stays in
`CHECKLIST.md` (the shipped-capability and task ledger); this file is the week's state. Public repository.

## Live

- **Experiments lane (Refactor 2 Lane 4) — run `2026-09-25-92578a` 2026-09-25, status OK (measure, hygiene,
  ledger ran clean; digest + delivery pending step 8/9 later this run).** Routine `ds-experiments-weekly`
  Wednesdays 08:00 runs `experiments/RUNBOOK.md` in the lane worktree
  (`~/Projects/worktrees/ds-experiments`, on `main`); dead-man `ds-experiments-deadman` Thursdays 08:00.
  Connector gap from the prior run (`d-20260925-f662`) did **not** recur — Search Console, Todoist, and
  Gmail (via `mcp__claude_ai_*`) all loaded and worked this run; decision resolved as overtaken by events.
  `foscoe-title-meta-ctr` remains **active**, applied `2026-09-25-4a1a29` at 10:57, sha
  `5c95c2423a72a46f3652eab7af479ba7da5f31bf`, status `measuring`, day 1 of 28, window ends 2026-10-23,
  revert `git revert 5c95c2423a72a46f3652eab7af479ba7da5f31bf`. No propose/apply this run (one experiment
  at a time). Pre-change SC baseline unchanged: foscoe-named queries 0 clicks / 83 impr (09-11..09-23) /
  0.00% CTR / pos 10.3 — too early to see effect. $0 cash, 0 Ahrefs units. State `experiments/STATE.json`;
  record `experiments/LEDGER.md`.

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
- 2026-09-25 10:47 · session a81825ec · ds-experiments (main) · HEAD 0d5f0328 · dirty 0
- 2026-09-25 11:01 · session 18270d6c · ds-experiments (main) · HEAD fc87057f · dirty 0
- 2026-09-25 11:15 · session f4990908 · ds-experiments (main) · HEAD 525da26b · dirty 1
