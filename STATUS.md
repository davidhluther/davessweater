# DavesSweater — STATUS

Schema (Refactor 2): Live / Parked / Decisions for David / Done (dated). Task-level detail stays in
`CHECKLIST.md` (the shipped-capability and task ledger); this file is the week's state. Public repository.

## Live

- **Experiments lane (Refactor 2 Lane 4) — run `2026-09-16-f3945d` 2026-09-16, status PARTIAL (preflight
  and apply FAILED; digest, ledger and delivery ran).** Routine `ds-experiments-weekly` Wednesdays 08:00
  runs `experiments/RUNBOOK.md` in the lane worktree (`~/Projects/worktrees/ds-experiments`, on `main`);
  dead-man `ds-experiments-deadman` Thursdays 08:00. Active experiment: none.
  `foscoe-title-meta-ctr` is **APPROVED and still not applied, now for the second run** — the gate is
  satisfied (`d-20260908-5ef7`, 2026-09-09) and the lane is live (`dry_run` false, `push_enabled` true
  since 2026-09-09 08:50), but step 0 preflight failed: `.claude/settings.json` and
  `experiments/deadman-log.md` are modified and uncommitted by other sessions, `git pull --rebase origin
  main` refuses, and the worktree sat 3 commits behind `origin/main`. Neither file is one this lane may
  stage, so it cannot clear them itself. One decision open: `d-20260916-d245`, clear the worktree so the
  experiment applies on 2026-09-22. Baseline re-verified from Search Console (0 units, 2026-08-18..09-14):
  foscoe-named queries 403 impressions, 0 clicks, 0.00% CTR, position ~10.4 — the hypothesis is
  undiminished. $0 cash, 0 Ahrefs units. Digest: `experiments/digests/2026-09-16-f3945d.md`. State
  `experiments/STATE.json`; record `experiments/LEDGER.md`.

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
