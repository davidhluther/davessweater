# DavesSweater — Disavow submission + GA4 verification (for the DS orchestrator)

Routed here by PG IA 2 on David's instruction (2026-07-20): the DS orchestrator
(DS IA 1) owns these two follow-ups. Context: David's 2026-07-18 rulings,
questions 5 and 6 in `~/Projects/pigasus-group/docs/content/marketing-baseline-log.md`.

## 1. Submit the disavow file
A disavow file was drafted 2026-07-07 — 250 spam referring domains, 100%
disavow — and NEVER submitted to Google Search Console.
- Refresh it against current GSC backlink data for `sc-domain:davessweater.com`
  (the GSC/Ahrefs tooling is connected this session).
- Prepare the submission. The disavow UPLOAD itself is an account action for
  David to click (or an approval-mode session) — do not submit silently.
- After it's submitted, record the submission date in the DS repo.

## 2. Confirm the live GA4 measurement ID
Confirm which GA4 measurement ID the live davessweater.com pages actually send
to (repo grep + a live page-source check).
- It MUST be the property in David's OWN GA4 account — NOT property 543003059
  in the Corpay account (214728489), which was added there by mistake, receives
  no data (verified 2026-07-18), and David is deleting.
- The DS records mention two historical IDs: `G-7XL0TZ4GSS` (March) and
  `G-F3TW73EZK1` (June). Record which is LIVE and which is RETIRED.

## Norms
Short-lived branch off the DS working branch, then PR. Never commit anything
gitignored (data/keys). No outward action (the disavow upload and any GA4
account change stay David's clicks). A task chip
("Submit DS disavow and confirm GA4 tag", cwd = this repo) also exists as a
one-click start if preferred.
