# DavesSweater — STATUS

Schema (Refactor 2): Live / Parked / Decisions for David / Done (dated). Task-level detail stays in
`CHECKLIST.md` (the shipped-capability and task ledger); this file is the week's state. Public repository.

## Live

- **Experiments lane (Refactor 2 Lane 4) — run `2026-09-25-4a1a29` 2026-09-25, status PARTIAL (apply OK;
  Todoist read-back and delivery FAILED — infrastructure; preflight, apply, commit, push, ledger and
  digest ran).** Routine `ds-experiments-weekly` Wednesdays 08:00 runs `experiments/RUNBOOK.md` in the
  lane worktree (`~/Projects/worktrees/ds-experiments`, on `main`); dead-man `ds-experiments-deadman`
  Thursdays 08:00. The `node_modules` blocker (`d-20260916-2e88`) is **resolved** — the worktree now has
  it (684 entries) and this run's `npx vitest run` (382/382) and `npm run lint` (clean) both passed.
  `foscoe-title-meta-ctr` **applied this run**, sha `5c95c2423a72a46f3652eab7af479ba7da5f31bf`, pushed to
  `origin/main`; active experiment status `measuring`, window ends 2026-10-23, revert
  `git revert 5c95c2423a72a46f3652eab7af479ba7da5f31bf`. New blocker found this run: the project-scoped
  MCP connectors the RUNBOOK requires — Search Console, the allowlisted Todoist workspace
  (`mcp__b6d489fe-…`), and the allowlisted Gmail account (`mcp__7456e8e6-…`) — were **all absent** from
  this session (not failed-to-connect, simply not present); only the generic claude.ai Todoist/Gmail
  connectors were available and were **not** substituted (wrong server IDs, no workaround per RUNBOOK).
  Effect: baseline used for `foscoe-title-meta-ctr` is the 2026-09-16 re-verification (9 days old, not a
  same-day pull), no Todoist decisions were read back or filed, and the digest could not be emailed or
  posted to Todoist this run — see new decision `d-20260925-f662`. $0 cash, 0 Ahrefs units. Digest:
  `experiments/digests/2026-09-25-4a1a29.md`. State `experiments/STATE.json`; record
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
- 2026-09-25 10:47 · session a81825ec · ds-experiments (main) · HEAD 0d5f0328 · dirty 0
- 2026-09-25 11:01 · session 18270d6c · ds-experiments (main) · HEAD fc87057f · dirty 0
- 2026-09-25 11:15 · session f4990908 · ds-experiments (main) · HEAD 525da26b · dirty 1
