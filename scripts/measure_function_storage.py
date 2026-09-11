#!/usr/bin/env python3
"""Measure retained Function Storage for this Vercel project, and list what to prune.

Why this exists
---------------
Vercel bills Function Storage against *retained deployments*, not against the live
site: every deployment you keep holds its Lambda bundles forever. On 2026-09-04 the
account hit 100% of its included Function Storage while production was perfectly
healthy — the 44 deployments built before the 2026-08-21 payload fix were each
carrying 29 Lambdas at ~202 MiB (5.3 GiB per deployment), and nothing had ever
cleaned them up. See CHECKLIST.md, "FUNCTION STORAGE at quota".

The counting trap
-----------------
`/v11/deployments/{id}/builds` returns one output entry per *route*, and each entry
reports the size of the whole Lambda that route belongs to. Summing them naively
double-counts enormously — a deployment with 641 routes over 29 Lambdas reads as
123 GiB instead of 5.3 GiB. Group by `lambda.functionName` first. That is the same
class of mistake as counting `.func` directories to get a function count (see
`check_function_budget.py`): the obvious number is not the real one.

Usage
-----
    python3 scripts/measure_function_storage.py              # summary
    python3 scripts/measure_function_storage.py --list-fat   # ids over the threshold
    python3 scripts/measure_function_storage.py --fat-mib 300

Reads project/team ids from .vercel/project.json. Needs an authenticated `vercel`
CLI on PATH; it only ever issues GETs. Deletion is deliberately NOT implemented here
— pruning is irreversible and is an owner decision, so this script tells you what to
delete and you delete it.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

MIB = 1024 ** 2
GIB = 1024 ** 3
REPO = pathlib.Path(__file__).resolve().parent.parent


def load_ids() -> tuple[str, str]:
    cfg = json.loads((REPO / ".vercel" / "project.json").read_text())
    return cfg["projectId"], cfg["orgId"]


def api(path: str) -> dict:
    """GET a Vercel API path through the CLI. Returns {} on anything unparseable."""
    res = subprocess.run(["vercel", "api", path], capture_output=True, text=True)
    start = res.stdout.find("{")
    if start < 0:
        return {}
    try:
        return json.loads(res.stdout[start:])
    except json.JSONDecodeError:
        return {}


def all_deployments(project: str, team: str) -> list[dict]:
    out: list[dict] = []
    until = None
    while True:
        path = f"/v6/deployments?projectId={project}&teamId={team}&limit=100"
        if until:
            path += f"&until={until}"
        page = api(path)
        chunk = page.get("deployments") or []
        if not chunk:
            break
        out += chunk
        until = (page.get("pagination") or {}).get("next")
        if not until:
            break
    return out


def function_bytes(uid: str, team: str) -> tuple[int, int]:
    """(total bytes, distinct Lambda count) for one deployment."""
    builds = api(f"/v11/deployments/{uid}/builds?teamId={team}").get("builds") or [{}]
    lambdas: dict[str, int] = {}
    for entry in builds[0].get("output") or []:
        name = (entry.get("lambda") or {}).get("functionName")
        if name is None:
            continue
        lambdas[name] = entry.get("size") or 0
    return sum(lambdas.values()), len(lambdas)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fat-mib", type=float, default=300.0,
                    help="deployments above this many MiB of Lambdas are 'fat' (default 300)")
    ap.add_argument("--list-fat", action="store_true",
                    help="print only the fat deployment ids, one per line")
    args = ap.parse_args()

    project, team = load_ids()
    deployments = all_deployments(project, team)
    if not deployments:
        print("No deployments returned — is the vercel CLI authenticated?", file=sys.stderr)
        return 1

    with ThreadPoolExecutor(8) as pool:
        sizes = list(pool.map(lambda d: function_bytes(d["uid"], team), deployments))

    rows = sorted(zip(deployments, sizes), key=lambda r: r[0]["created"])
    live = api(f"/v6/deployments?projectId={project}&teamId={team}"
               f"&limit=1&target=production&state=READY")
    live_uid = ((live.get("deployments") or [{}])[0]).get("uid")

    threshold = args.fat_mib * MIB
    fat = [(d, s) for d, s in rows if s[0] > threshold]

    if args.list_fat:
        for d, _ in fat:
            if d["uid"] != live_uid:
                print(d["uid"])
        return 0

    total = sum(s[0] for _, s in rows)
    fat_total = sum(s[0] for _, s in fat)
    when = lambda ms: dt.datetime.fromtimestamp(ms / 1000).strftime("%Y-%m-%d")

    print(f"retained deployments : {len(rows)}")
    print(f"function storage     : {total / GIB:.2f} GiB")
    print(f"current production   : {live_uid}")
    print()
    print(f"fat (> {args.fat_mib:.0f} MiB)      : {len(fat)} deployments, {fat_total / GIB:.2f} GiB")
    if fat:
        print(f"  date range         : {when(fat[0][0]['created'])} -> {when(fat[-1][0]['created'])}")
        print(f"  includes live prod : {any(d['uid'] == live_uid for d, _ in fat)}")
        print(f"  storage after prune: {(total - fat_total) / GIB:.2f} GiB")
    print()
    print("recent deployments:")
    for d, (size, count) in rows[-8:]:
        stamp = dt.datetime.fromtimestamp(d["created"] / 1000).strftime("%m-%d %H:%M")
        target = d.get("target") or "preview"
        print(f"  {stamp}  {size / MIB:8.1f} MiB  {count:3d} fn  {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
