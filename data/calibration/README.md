# data/calibration/

Ground-truth series the demand models are calibrated and back-checked against —
official, published-after-the-fact numbers, as opposed to the forward-looking
signals under `data/demand/` and `data/events/`.

## Built captures

- **`nps_blri_visits.json`** — Blue Ridge Parkway monthly recreation visits from
  the NPS Stats API (`scripts/capture_nps_visits.py`, monthly cadence, keyless).
  History back to 1979. The single strongest demand-calibration series we have:
  BLRI is the most-visited unit in the National Park System and its monthly
  rhythm (October leaf-season peak, winter trough) is the exact curve the
  tourism + traffic forecasts try to anticipate.

## Documented-only (researched 2026-07-25, NOT built — why)

Two monthly economic series would make excellent calibration inputs but are
**not machine-readable within the stdlib-only constraint**, so they are recorded
here for a future capture rather than wired blind. Both publish as Excel
workbooks and/or PDFs behind per-period landing pages — no stable CSV endpoint,
and `.xlsx` parsing needs a third-party library this pipeline doesn't take on
(the build/capture layer is stdlib-only by rule; see CLAUDE.md). If either ever
exposes a CSV (or the pipeline gains an xlsx dependency), the ingest notes below
are the starting point.

### 1. NCDOR — local government sales & use tax distributions (Watauga County)

- **What it is:** monthly distribution of local sales-and-use tax back to
  counties. The Watauga County row is a direct proxy for taxable retail activity
  in the county — a lagging but authoritative demand actual.
- **Where it lives:** NCDOR › Reports and Statistics. Two relevant series:
  - *Sales & Use Distribution* (the per-county distribution) — one landing page
    per month, e.g. `https://www.ncdor.gov/sales-use-distribution-july-2022`,
    reachable from `https://www.ncdor.gov/local-government-distributions`.
  - *Monthly Sales and Use Tax Statistics* (gross collections / taxable sales) —
    `https://www.ncdor.gov/news/reports-and-statistics/monthly-sales-and-use-tax-statistics`,
    one dated child page per month.
- **Format:** each month's page links to an Excel workbook / PDF, **not** a CSV.
  Publication lags ~2–3 months. URLs are dated slugs, not a single stable file.
- **Future ingest:** resolve the current month's landing page from the index,
  follow the workbook link, read the sheet, pull the "Watauga" row. Needs an
  xlsx reader (e.g. `openpyxl`) — out of scope for the stdlib pipeline today.

### 2. NC ABC Commission — monthly spirituous-liquor sales reports

- **What it is:** monthly liquor sales by local ABC board. The Watauga County /
  Boone ABC board figures track visitor-and-resident consumption — another
  lagging demand actual, and one that moves hard with football weekends,
  festivals, and ski season.
- **Where it lives:** NC ABC Commission › Sales/Reports —
  `https://abc.nc.gov/Sales/Reports` (and `https://abc.nc.gov/Home/Statistics`).
- **Format:** monthly reports are published as Excel workbooks / PDFs, indexed by
  period; no stable CSV endpoint was found (2026-07-25). The report pages are
  rendered client-side, so the file links are not present in the raw HTML — a
  future capture would need the board-report file URL pattern confirmed first.
- **Future ingest:** same shape as NCDOR — resolve the month's report file, read
  the workbook, keep the Watauga/Boone board rows. Needs an xlsx reader.

_Verification date for all URLs/formats above: 2026-07-25._
