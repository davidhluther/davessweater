# iPhone Shortcut — capture real Apple Weather data daily

**Goal:** make the homepage "Apple Weather" column real, complete data going forward. The Shortcut
already screenshots Weather and POSTs `{screenshot, date}` to GitHub; this adds **4 weather readings**
(high, low, sustained wind, conditions) to that same POST. The `upload_screenshot.yml` workflow already
turns them into `data/predictions/<date>/iphone_forecast_apple.json` — **no repo changes needed.**

Background: the Shortcut wrote this structured data on 2026-03-05/06, then silently regressed to
screenshot-only — which is why most of the season's "Apple" column fell back to Open-Meteo. Restoring
the data write fixes it for good, with real sustained wind (no screenshot/gust approximation).

---

## 1. Add the weather actions (place BEFORE your "Get Contents of URL" POST)

**Get Current Weather** — leave on *Current Location*. Outputs a "Weather Conditions" item.

Then **Get Details of Weather Conditions** ×4 — each takes that Weather Conditions item, picks one
detail, and you save it as a variable (tap the result → *Add to Variable*):

| Detail to pick      | Save as variable |
|---------------------|------------------|
| **High Temperature**| `High`           |
| **Low Temperature** | `Low`            |
| **Wind Speed**      | `Wind` ← sustained wind (the "2–5"), NOT the gust ceiling |
| **Conditions**      | `Cond`           |

> If your iOS version's *Get Current Weather* doesn't expose High/Low: use **Get Weather Forecast → Daily**,
> then **Get Item from List → First Item**, then **Get Details** for High/Low Temperature on that item.

## 2. Add the fields to your POST body

Find the **Dictionary** you pass as the request body (it has `event_type` + `client_payload`). Inside
`client_payload`, add four keys beside the existing `screenshot` and `date`:

| Key             | Value  |
|-----------------|--------|
| `today_high_f`  | `High` |
| `tonight_low_f` | `Low`  |
| `wind_mph`      | `Wind` |
| `conditions`    | `Cond` |

## 3. Confirm the request ("Get Contents of URL")

- **URL:** `https://api.github.com/repos/davidhluther/davessweater/dispatches`
- **Method:** `POST`
- **Headers:** `Authorization: Bearer <your token>` · `Accept: application/vnd.github+json`
- **Request Body:** JSON → your Dictionary

Exact shape the API expects (units like "74° F" / "3 mph" are fine — the workflow strips them to numbers;
`date` is optional, defaults to today Eastern):

```json
{
  "event_type": "iphone-screenshot",
  "client_payload": {
    "screenshot": "BASE64_PNG",
    "date": "2026-06-25",
    "today_high_f": "74",
    "tonight_low_f": "52",
    "wind_mph": "3",
    "conditions": "Cloudy"
  }
}
```

## 4. Test

1. Run the Shortcut once manually.
2. In the repo, open `data/predictions/<today>/` — you should see **both** `iphone_screenshot.png` **and**
   a new `iphone_forecast_apple.json` containing your four fields.
3. The next Daily Compare scores that day as real Apple (`source: "iPhone Shortcut"`); the Apple column
   climbs toward its true ~90 on real sustained wind.

## Troubleshooting

- **No `iphone_forecast_apple.json` appears** → the payload is missing `today_high_f`/`tonight_low_f`
  (the workflow only writes the file when at least one is present). Check the key spelling.
- **`wind_mph` empty some days** → that day scores on temps + conditions (caps ~80); still real, harmless.
- **Token** → reuse whatever GitHub token your screenshot upload already uses (fine-grained PAT,
  Contents: read/write on the repo).
- **Conditions text** → Apple returns "Mostly Cloudy", "Partly Cloudy", "Rain", "Clear", etc. — all map
  correctly in `compare.py`'s condition→category logic.

---

*Once this is live, the per-day `source` field is `"iPhone Shortcut"` for real captures vs `"Open-Meteo"`
for fallback days — see `scripts/backfill_apple_screenshots.py` and `CLAUDE.md` "Apple Weather Data".*
