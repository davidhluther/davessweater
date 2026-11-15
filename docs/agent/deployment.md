## Deployment

- **Hosting**: Vercel — `next build` on every push to `main` (Git integration). `vercel.json`: `framework: nextjs`, `outputDirectory: .next`. Domain davessweater.com (+ www); DNS via Squarespace.
- **Build**: Node/Next (`npm`). `prebuild` (`scripts/prepare_public.mjs`) copies the latest `data/predictions` screenshots → `public/screenshots/`.
- **Data pipeline**: Python stdlib; `capture_rays.py` needs Playwright. Runs only in GitHub Actions.
- **Stale config (inert)**: the Vercel project dashboard still has GitHub-Pages-era *overrides* (build cmd / output dir = `docs`); `vercel.json` overrides them. GitHub Pages is also still configured but vestigial (DNS → Vercel) — disable when convenient.

