"""Location registry loader for the multi-location pipeline (M5 P0).

Boone is deliberately NOT in the registry: its data stays at the legacy
top-level paths (data/predictions, data/comparisons, data/scores.json) so the
494-day history, every existing script, and the site keep working unchanged.
New towns live entirely under data/locations/{slug}/ with the same file shapes
inside.
"""
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
LOCATIONS_DIR = BASE_DIR / "data" / "locations"
REGISTRY_PATH = LOCATIONS_DIR / "locations.json"

REQUIRED_FIELDS = ("slug", "name", "lat", "lon", "provenance")


def load_locations(path=REGISTRY_PATH):
    data = json.loads(Path(path).read_text())
    locs = data.get("locations", [])
    seen = set()
    for loc in locs:
        missing = [k for k in REQUIRED_FIELDS if loc.get(k) in (None, "")]
        if missing:
            raise ValueError(f"location {loc.get('slug', '?')} missing {missing}")
        if loc["slug"] == "boone":
            raise ValueError("Boone must not enter the registry — it lives at the legacy paths")
        if loc["slug"] in seen:
            raise ValueError(f"duplicate slug {loc['slug']}")
        seen.add(loc["slug"])
    return locs


def location_dir(slug, base=LOCATIONS_DIR):
    return Path(base) / slug
