# Session handoff — 2026-07-02

Marathon session with the owner in the loop live. **Eight PRs merged (#95–#102); prod verified
after each; no open PRs.** Authoritative state lives in **`CHECKLIST.md`** + the memory files;
this handoff is orientation. The owner is separately building a **/fireworks feature** in their
own working tree (suncalc, venues/solar libs, capture script, nav/sitemap/workflow edits) — that
lane is theirs; Claude works from isolated worktrees off `origin/main` and must not touch their
modified files or kill their dev server (the permission classifier enforces both; it's right).

---

## What shipped today (all merged + live)

- **#95 mobile sun** — the hot-variant backdrop stretched into brown haze on tall phone heroes;
  under 768px it's now a fixed 640px corner sun disk + radially-masked ray fan (mask on the
  rotation origin so it can't drift with the sweep).
- **#96 one high per page** — the Sweater Index "High of X°F today" line reads the DSI composite
  server-side; the live fetch keeps current temp/verdict/outlook; outlook starts tomorrow.
- **#97 social card** — prod had NO og:image/twitter:image; now a build-time next/og card with
  live scoreboard numbers (Space Grotesk woff vendored in `src/assets`; satori can't read woff2).
- **#98 → #99 → #100 Right/Wrong Ray, three passes** — colors → brand redesign (header band,
  "what actually happened" reference card, leaderboard cards, "Show the math" disclosures) →
  **v2**: Season Scoreboard on top with ALL 10 sources, day cards for all 10 (best/worst chips),
  price chips ("Paid" placeholder on Ray's — owner owes the real figure), **gate 14→9 days**
  (`lib/gating.ts`), "rest of the field" retired.
- **#100 also set brand standards**: dates render "Month D, YYYY" via `lib/dates.ts` (short only
  in chart tooltips); data-line separators are pipes ("|"), swept site-wide.
- **#101 pipeline crons → 6:00/6:30 AM EDT** so mornings show today's forecasts. Physics note
  the owner accepted: "Latest scored day" can never be today itself.
- **#102 scoreboard polish** — verdict 1–5 icons are **Dave faces** everywhere
  (`public/assets/dave_face.png`, cropped from the wordmark with sharp; replaced the per-brand
  icons from #100 same-day); records reorder **W-M-L** site-wide (tests re-pinned); Season
  Scoreboard rank colors = winner emerald / **loser brand orange (owner's explicit call —
  overrides the "orange never data" rule for this one slot)** / middles slate, strokes included;
  sparklines = **7-day rolling means**; hero got mt-5 above the cards.

Earlier same session (previous handoff's era, still relevant): #90 a11y bundle (prod a11y 100),
#91 weather backdrop (LOUD + quiet-zone mask), #93 homepage visual pass, #94 lantern note.

## The two analyses (delivered, decisions pending)

- **DSI accuracy (8-day all-members sample):** the composite scores **84.2 — below its best
  members** (Google 95.1, MET.no 95.0). Averaging is lossy under banded scoring; majority-type
  votes eat 10-pt precip misses. Best subset (metno+visualcrossing+google, median, implied-zero
  construction) ≈ 89 — still under its members. Recommendation: ship a private daily tracker,
  decide membership cuts at ~30 days; owner may cut earlier with /methodology disclosure.
  Scripts: `scratchpad dsi_analysis{,2}.py` (session-local; rewrite as `scripts/` tooling when
  building the tracker — needs a workflow edit, so coordinate with the owner's WIP).
- **Lantern/PSI artifact:** simulated Lighthouse reports a false perf 70 / LCP 11.8s; observed
  throttling = 92 / 2.7s (best yet). Banked in CHECKLIST; matters because PSI uses simulation.

## Queued next (owner-flagged)

1. **Scoring recalibration — the big one.** Owner: clustered 90s = weak differentiation, and on
   trace days (0.071") a "none" forecast incoherently earned 10/10 amount after 0/10 type. Wants
   balance, explicitly NO double-penalty for missing trace rain. Model on FULL history before
   touching the scorer: trace-day partial type credit; type-gated amount cap; merged 20-pt
   precipitation score; tighter/steeper temp bands. Show per-source deltas + the wins-by-omission
   fairness check (as the R2 revert did); update /methodology + CLAUDE.md; rescore via
   `scripts/rescore_history.py`. Never ship a scoring change without proving it wasn't tuned
   against Ray.
2. **R/W Ray "heavy blue" break-up** — owner asked for PROPOSALS ONLY (see the 2026-07-02
   conversation): candidates = teal-900+dot-grid plane for the scoreboard section, dimmed aurora
   animation behind it (reuse `.wx` + quiet-zone mask), winner/loser row glows, emerald→orange
   gradient divider, top-5 + "show all" disclosure to shorten the slab. Await owner's pick.
3. **Open asks of the owner:** Ray's real price for the "Paid" chip; the truncated message
   ("Add them to the season Scoreboard, and let's…"); DSI membership decision.
4. Backlog: lantern investigation, font-loading perf, README rewrite, sweater-scale
   recalibration, iPhone-shot relocation (Today module owns the hero long-term).

## Gotchas (hard-won today)

- **Owner works live in the main checkout.** Use `git worktree add … origin/main` for every
  change; commit only your own files; never stash/rebase their WIP unless they ask ("put it in
  3000" = they ask). Their `daily_capture.yml`/`sitemap.ts`/`SiteHeader.tsx`/`data.ts`/
  `package.json` (suncalc) are mid-edit.
- **Turbopack `.next` cache poisons across git operations** (branch switches under a running dev
  server serve stale CSS; `rm -rf .next` + restart — but NEVER rm it under the owner's running
  server: it crashes the worker; the `next dev` watchdog respawns it).
- **The preview panel tab sleeps** when not visible: rAF/ResizeObserver suspend → visx
  ParentSize renders nothing and axe misreads backgrounds. Verify in the chrome-devtools MCP
  browser instead.
- **GitHub stacked PRs:** merging a base PR with `--delete-branch` auto-CLOSES stacked PRs
  (killed #92; recreated as #93). Merge order matters, or re-target first.
- **Squash-merge + stacked branch = conflicts** on the follow-up; resolve by merging origin/main
  into the branch (Hero import conflict was the only real one).
- **GHA security hook** still blocks workflow-file edits on first try; retry passes. The
  Vercel-plugin validators recommending "Vercel Crons" for the data pipeline are wrong — the
  pipeline needs Python/Playwright/git commits; GHA is correct.
- **Lighthouse numbers:** always distinguish simulated (lantern/PSI) from observed; both a11y
  claims (100) and perf (observed 92) were re-verified on prod after every merge today.
