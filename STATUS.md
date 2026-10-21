# DavesSweater — STATUS

Schema (Refactor 2): Live / Parked / Decisions for David / Done (dated). Task-level detail stays in
`CHECKLIST.md` (the shipped-capability and task ledger); this file is the week's state. Public repository.

## Live

- **Experiments lane (Refactor 2 Lane 4) — run `2026-10-21-61b96e` 2026-10-21, status OK.** `foscoe-title-meta-ctr` remains **active**, day 26 of 28, window ends 2026-10-23, revert `git revert 5c95c2423a72a46f3652eab7af479ba7da5f31bf`. Query-level GSC 2026-09-26..10-19: 94 impr / 0 clicks / 0.00% CTR (baseline 403 impr / 0 clicks / 0.00%). No propose or apply (one experiment at a time). $0 cash, 0 Ahrefs units. State `experiments/STATE.json`; record `experiments/LEDGER.md`; digest `experiments/digests/2026-10-21-61b96e.md`.

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
- 2026-09-25 11:32 · session 324fcd08 · ds-experiments (main) · HEAD e86edeac · dirty 0
- 2026-10-03 18:47 · session 876d56de · ds-experiments (main) · HEAD 5bf9c918 · dirty 2
- 2026-10-03 18:51 · session 04d8773d · ds-experiments (main) · HEAD 4d401b12 · dirty 2
- 2026-10-03 19:47 · session 214fd6ca · ds-experiments (main) · HEAD 47e35de2 · dirty 2
- 2026-10-03 20:00 · session ae439178 · ds-experiments (main) · HEAD 53d241bf · dirty 1
- 2026-10-07 08:04 · session 756b234a · ds-experiments (main) · HEAD b13f7a74 · dirty 1
- 2026-10-14 08:02 · session d1bb07fb · ds-experiments (main) · HEAD 900e9754 · dirty 3
- 2026-10-14 09:39 · session 8ea9fea1 · ds-experiments (main) · HEAD 900e9754 · dirty 6
- 2026-10-14 09:44 · session 0f707890 · ds-experiments (main) · HEAD 2c2b5bb4 · dirty 2
