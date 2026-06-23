"""Capture every available forecaster's daily forecast into data/predictions/{today}/.
Keyless sources always run; keyed sources run only when their env key is set."""
import importlib
import json
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))  # so `import sources` works when run directly
from sources import available_sources, SOURCES

EST = ZoneInfo("America/New_York")
DATA = Path(__file__).resolve().parent.parent / "data"


def main():
    today = datetime.now(EST).strftime("%Y-%m-%d")
    out = DATA / "predictions" / today
    out.mkdir(parents=True, exist_ok=True)
    avail = {s["key"] for s in available_sources()}
    for s in SOURCES:
        if s["key"] not in avail:
            print(f"  SKIP {s['key']} (no creds)")
            continue
        try:
            mod = importlib.import_module(s["module"])
            daily = mod.fetch()
            payload = {"source": s["key"], "label": s["label"],
                       "captured_at": datetime.now(EST).isoformat(), "location": "Boone", "daily": daily}
            (out / f"{s['key']}_forecast.json").write_text(json.dumps(payload, indent=2))
            print(f"  OK   {s['key']} ({len(daily)} days)")
        except Exception as e:  # noqa: BLE001
            print(f"  FAIL {s['key']}: {type(e).__name__}: {e}")


if __name__ == "__main__":
    main()
