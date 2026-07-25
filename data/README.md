# Dave's Sweater — open weather datasets

This directory holds the data behind [davessweater.com](https://davessweater.com):
daily forecast captures from a roster of free and paid weather services, the
verified actual conditions we score them against, and the running accuracy
scoreboard. Boone, NC is the flagship; other tracked towns live under
`locations/<slug>/`.

## What's here

- `scores.json` — the running season scoreboard (per-source average score and
  Right / Meh / Wrong record) for Boone. Per-town copies live at
  `locations/<slug>/scores.json`.
- `comparisons/<date>.json` — one scored day: every source's forecast, the
  verified actuals, and the point breakdown.
- `actuals/<date>.json` — the verified conditions for a date (Open-Meteo archive).
- `predictions/<date>/` — that morning's raw forecast captures, per source.
- `forecast_5day.json`, `latest_forecasts.json` — the upcoming Boone forecast,
  merged across sources (drives the site and the API).
- `locations/locations.json` — the multi-town registry (slugs, coordinates,
  provenance).

## License

All datasets in this directory are licensed **Creative Commons Attribution 4.0
International (CC BY 4.0)** — see [`LICENSE`](./LICENSE) or
<https://creativecommons.org/licenses/by/4.0/>. Use them anywhere, including
commercially. The one condition is credit:

> Data: Dave's Sweater (davessweater.com), CC BY 4.0

## Prefer an API or a feed?

The same data is served as a JSON API, prerendered RSS feeds, and an embeddable
widget — documented at <https://davessweater.com/api>.

Not affiliated with or endorsed by Ray's Weather. We just check the math.
