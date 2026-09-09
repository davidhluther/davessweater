# DavesSweater experiments RUNBOOK — one reversible experiment a week, as a closed loop (Refactor 2 Lane 4)

You are the scheduled executor of the DavesSweater experiments lane. No conversation context exists.
Everything you need is in this file, `experiments/STATE.json`, `experiments/LEDGER.md`, and the repo's
`CLAUDE.md` + `CHECKLIST.md`. Working directory: `~/Projects/worktrees/ds-experiments` (this repo's
lane worktree, on `main` — the main checkout under `~/Projects/DavesSweater` belongs to other sessions
and is never touched). Committed allowlist only (`.claude/settings.json`), no permission bypass: a tool the
allowlist refuses is a FAILED step with the tool's name, never a workaround. Owner: DS IA. Builder: the
Refactor 2 session (brief: `shared-skills/refactor-2/PHASE-4-LANE-4-EXPERIMENTS-BRIEF.md`).
**This repository is PUBLIC.** Everything you write here is public: no private context, no personal,
political, third-party, or infrastructure detail (see `CLAUDE.md`).

Every helper call goes through the wrapper — never type the environment variables by hand:
`bash experiments/lane.sh state <args>` (below, `<state>`), `bash experiments/lane.sh digest`,
`bash experiments/lane.sh notify <run_id>`. Every step ends with `<state> step <name> ok|fail|skip "<note>"`;
a failed step never stops the run; steps 8 and 10 run no matter what.

**Hard limits.** Cash $0 — no purchases, paid APIs, or ads; anything that would cost money is a decision
for David, never an action. Ahrefs/Semrush units 0 — those tools are denied; Search Console (+ GA4 when a
read path exists) and the repo's own data are the instruments; a run that would need units records a
decision instead. One experiment at a time; one per week. Sandbox = this site only. An experiment MAY be:
a title/meta change, internal linking, schema, IndexNow on publish, a content refresh of an existing
page, a technical change (headers, sitemap). It may NEVER be: new content at scale, anything touching
user data or forms (`data/`, `src/app/api/`), any change to deploy config or the traced payload
(`next.config.ts`, `vercel.json`, `.github/`, `package.json` — the 08-21 outage, CHECKLIST), a new
dynamic route family (the function budget is AT its limit: 10 of 10), anything irreversible, anything
on another site. Every change records a ONE-COMMAND revert (`git revert <sha>`) before it is applied.
Applying needs a completed Todoist decision while `STATE.apply_without_approval` is false (David lifts
it in writing after four clean experiments). Proposing, measuring, and reporting need no approval.

## 0. Start — state, lock, guard
```bash
cd ~/Projects/worktrees/ds-experiments && git rev-parse --abbrev-ref HEAD && git status --porcelain | head
git fetch -q origin main && git pull -q --rebase origin main   # the pipeline bot commits to main several times a day
bash experiments/lane.sh state start
```
`LOCKED …` → one transcript line and stop (the dead-man reports it). Not on `main`, rebase failed, or
tracked files modified other than `STATUS.md` → `step preflight fail "<what>"`, continue read-only.
`<state> show`: note `dry_run`, `push_enabled`, `apply_without_approval`, `active_experiment`.
`step preflight ok`.

## 1. Read decisions back from Todoist
For each `STATE.open_decisions` entry with `status: open` and a `todoist_id`: `find-tasks` /
`find-completed-tasks` (label `ds-experiments`) + `find-comments`. Completed → `<state> resolved <id>
"David completed the task: <comment or 'default accepted'>"`. A completed **"Run experiment <name>?"**
task with no refusing comment = APPROVAL to apply that experiment in step 4 (also honoured: David
setting `approved: true` in the experiment's file under `experiments/proposals/`). A comment that says
no, or changes the design → do not apply; record and re-propose. `step read-decisions ok|fail`.

## 2. Measure — the active experiment, if any (Search Console; 0 units)
If `STATE.active_experiment` exists with status `measuring`: pull the metric for its pages via
`query_search_analytics` (`siteUrl: "sc-domain:davessweater.com"`, dimensions `page` and `date`,
the baseline window vs. applied-to-now; Search Console data lags ~2 days — say so). If `window_end`
has passed: decide **kept / reverted / inconclusive** against the pre-registered metric and threshold;
`reverted` → run the recorded `revert_cmd` (a `git revert`), commit, and push only if `push_enabled`;
`<state> note results "<name> · <metric> · <baseline> → <now> · <verdict> · <one-line why>"`,
`<state> append completed_experiments '<json of the experiment with verdict>'`, `<state> set active_experiment 'null'`,
update the LEDGER row. If the window is still open: `<state> note this_week "measuring <name> — day
<n> of <window>, <metric> so far <value> (baseline <b>)"`. Nothing active → `step measure skip`.
`step measure ok|fail|skip`.

## 3. Propose — exactly one experiment when none is active
Sources, in order: Lane 2's proposed experiments (`~/Projects/shared-skills/seo/industry-intel/runs/*.json`
`experiments`), this repo's `CHECKLIST.md` open items, your own observation from Search Console (e.g. a page
with impressions and a weak CTR, a query cluster with no matching title). Write
`experiments/proposals/<date>-<slug>.md` with front matter: `name`, `hypothesis` (one falsifiable
sentence), `metric` + `instrument` + `threshold` (what counts as a win), `baseline_window` (28 days,
measured now: record the numbers), `measurement_window_days` (14 minimum; 28 for ranking effects),
`change` (the exact file(s) and text), `revert_cmd` (`git revert <sha>` of the commit you will make),
`cost_usd: 0`, `ahrefs_units: 0`, `approved: false`, `risk` (what could go wrong, and why it is
reversible). Then ONE decision (the approval gate): `<state> decision "Run experiment <name>?"
"<hypothesis> · metric <metric> · window <n> days · revert: git revert of the applying commit — file:
experiments/proposals/<file>" "approve if reversible and $0 (it applies only after this task is
completed)"`. `<state> note next_proposal "<name> — <hypothesis> · metric <metric> · window <n>d · revert git revert"`.
`step propose ok|fail|skip`.

## 4. Apply — only with approval, never in a dry run
Conditions, ALL required: `dry_run` false · the experiment's decision is resolved as approved (or
`apply_without_approval` is true) · `push_enabled` true (an unpushed change never reaches production —
without push, record `step apply skip "push disabled"`) · the change is inside the allowed classes.
Then: `git pull --rebase origin main`; make the change (edits under `src/` or `public/` only);
run the pre-apply checks — `python3 scripts/check_function_budget.py` (must not exceed budget),
`npx vitest run` (must pass), `npm run lint`; commit on `main` with message `experiment: <name>`;
record the sha; `<state> set active_experiment '{"name":…,"status":"measuring","applied_at":…,
"applied_sha":"<sha>","window_end":"<date>","metric":…,"baseline":…,"revert_cmd":"git revert <sha>"}'`;
`git push origin main`; after ~5 minutes `WebFetch` the changed page on davessweater.com and confirm the
change is live (if not, say so — Vercel builds can fail silently, CHECKLIST). Update the LEDGER row.
`<state> note this_week "applied <name> (<sha>) — window ends <date>"`. `step apply ok|fail|skip`.

## 5. Decisions (≤3)
Besides the approval-gate decision: anything that would cost money or units, anything outside the
allowed classes that seems worth it, a revert David should confirm. `<state> decision …`.
`step queue-decisions ok "<n>"`.

## 6. Hygiene — commit on main, by name
Stage only `experiments/STATE.json`, `experiments/runs/`, `experiments/digests/`, `experiments/proposals/`,
`experiments/LEDGER.md`, `STATUS.md`, `CHECKLIST.md` (only the lane's own section). Never `git add -A`.
Message `experiments <date>: <status>`; COMMIT FIRST, then `git pull --rebase origin main` (the rebase refuses a
dirty tree — exit test A finding), then push only if `push_enabled`: `git push origin main`.
`step commit ok|fail` · `step push ok|skip|fail`.
Record the run's cost line: `<state> cost "cash $0 · units 0 · <model tiers> · <n> tool calls"` and
`<state> meter 0` (the Ahrefs units field; it must read 0).

## 7. Ledger rows
`STATUS.md` → `## Live` ds-experiments bullet (run id, status, active experiment name/status, digest
path), one line, replace the previous. `experiments/LEDGER.md` row updated in place. `step ledger ok|fail`.

## 8. Digest — UNCONDITIONAL
`bash experiments/lane.sh digest` → `step digest ok "<path>"`. Never skip.

## 9. Deliver — email to self + Todoist (no information loss)
Gmail `send_message` to **davidhluther@gmail.com only**, subject `DS experiments digest — <date>`
(+ ` — DRY RUN`), body = the digest verbatim. `step email ok|fail`. `bash experiments/lane.sh notify <run_id>`.
**Todoist filing (David's ruling, 2026-09-09):** at run start resolve the project id of `Work` with
`find-projects` (`searchText: "Work"`, exact name match) and pass that `projectId` on EVERY `add-tasks`
call — parent tasks and sub-tasks alike (a sub-task carries `parentId` AND `projectId`); never rely on a
default project. Every task carries the label `ds-experiments`. After creating, `fetch-object` each task
and confirm `projectId` equals the Work id; anything elsewhere is moved with `update-tasks` (`projectId` = the Work id — a move; re-pass
`parentId` for a sub-task) and re-verified. Nothing lands in Inbox. Record the Work id in the step note.
Then Todoist, per the standard in `~/Projects/shared-skills/dev-env/lane/README.md` (David, 2026-09-09):
1. ONE parent task: content `DS experiments digest — <date>` (+ ` — DRY RUN`), due today as
   `YYYY-MM-DD`; description = summary tier ONLY: the digest's header line, the counts (proposed ·
   applied · measuring · concluded · decisions · units · cash), and "Full digest in the first comment;
   file: experiments/digests/<run_id>.md". `<state> note parent_task "<id>"`.
2. `add-comments` on the parent: the FULL digest verbatim, untruncated; over 12,000 characters → split
   at line boundaries into consecutive comments `(part n of N)`, never cut. The last part ends with
   `Sources:` + GitHub blob links (`https://github.com/davidhluther/davessweater/blob/main/<path>`) to the
   experiment's proposal file, `experiments/LEDGER.md`, the run record `experiments/runs/<run_id>.json`,
   and the digest file — "(links resolve once pushed)" when `push_enabled` is false.
3. One SUB-TASK per decision without a `todoist_id` (`parentId` = the parent): content = title (prefix
   `[DRY RUN]` when dry), description = ONE LINE `<question> · default: <default> · <decision id>`, due
   next Tuesday as `YYYY-MM-DD` (the day before the next fire); `<state> todoist <decision_id> <task_id>`.
   The approval-gate decision ("Run experiment <name>?") is one of these sub-tasks; completing it is the
   approval step 1 reads back.
`step todoist ok|fail|skip`.

## 10. Finish — always last
```bash
bash experiments/lane.sh state finish --sent yes|no --digest <path>
git add experiments/STATE.json experiments/runs/ experiments/digests/ && git commit -q -m "experiments <date>: state + digest" || true
```
`--sent yes` only if the email step succeeded. Then stop; one transcript line, the digest is the report.
The Thursday 08:00 dead-man (`ds-experiments-deadman`) emails David if `last_run` is older than 24 h
or no send was recorded. If you are about to die before step 10, run `finish --sent no` first.
