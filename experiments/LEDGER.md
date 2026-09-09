# DavesSweater experiments — LEDGER (Refactor 2 Lane 4)

The durable record of every experiment this lane proposes, applies, measures, and concludes. One row per
experiment, updated in place as it moves; the weekly digest is a view of this file plus the run record.
Rules: one experiment at a time · $0 cash · 0 Ahrefs units · every change carries a one-command revert
recorded BEFORE it is applied · applying needs a completed Todoist decision until David lifts the gate.
This repository is public; write every row accordingly.

| name | proposed | hypothesis | metric (instrument) | baseline | applied (sha) | window ends | revert | verdict |
|---|---|---|---|---|---|---|---|---|
| foscoe-title-meta-ctr | 2026-09-08 | A snippet that names the deliverable and fits in ~155 chars lifts CTR on foscoe-intent queries off 0.00% | CTR on foscoe-named queries (Search Console) | 535 impressions / 0 clicks / 0.00% / pos 10.3 (2026-08-10..09-06); re-verified 2026-09-09: 534 / 0 / 0.00% / pos 10.4 | — (proposed; dry run applied nothing) | — | git revert of the applying commit | APPROVED, not yet applied — `d-20260908-5ef7` completed 2026-09-09 07:43 EDT with no refusing comment; apply blocked by `dry_run: true` + `push_enabled: false`, not by the gate. Decision `d-20260909-1868` asks David to take the lane live. Baseline re-verified 2026-09-09 (run `2026-09-09-0d748b`, 2026-08-11..09-07): 534 impressions / 0 clicks / 0.00% / pos 10.4 — unchanged. |
