#!/usr/bin/env python3
"""Function budget guard - keep the deploy under Vercel Hobby's 12-function cap.

WHY THIS EXISTS
---------------
Vercel Hobby refuses a deployment carrying more than 12 Serverless Functions.
The refusal happens at the `patchBuild` step, which runs AFTER the build has
already reported "Build Completed" - so `next build` is green, CI is green, the
data pipeline keeps committing, and production silently freezes on the last good
build. That is exactly what happened between 2026-08-06 and 2026-08-16: ten days
of invisible outage that nothing red ever announced. See the "DEPLOY OUTAGE
2026-08-06 -> 08-16" section of CHECKLIST.md.

It happened again on 2026-08-21, from the other direction: no source changed at
all, but the builder stopped grouping the /api/v1/* handlers into one Lambda and
the count went 9 -> 14 on a pure-data commit. Three days of pipeline commits
failed to deploy. The lesson is in rule 3 below - grouping is the builder's
decision and can change under you, so the routes that matter now buy their own
function outright (the v1 API is one catch-all route file, not five siblings).

This script turns that ceiling into a check that can fail a pull request.

TWO WAYS TO COUNT, AND WHY BOTH SHIP
------------------------------------
`--build-output` is the GROUND TRUTH: it counts the function bundles the Vercel
builder actually emitted, from a real `vercel build`. Nothing beats it, and CI
runs it (see .github/workflows/function_budget.yml).

The default mode is a STATIC MODEL: it reads the route tree under src/app and
predicts the count without a build. It runs in a second, needs no toolchain, and
is what pytest gates on, so the budget still bites when the build job is
unavailable. It is a model, not a measurement - see LIMITS below.

THE COUNTING RULE (derived by measuring, not by reading docs)
------------------------------------------------------------
What Vercel counts is the number of DISTINCT function bundles under
.vercel/output/functions - real directories only. The tree is full of decoys:

  *.func symlinks      One bundle serves many routes. Every prerendered town
                       page (weather/boone.func -> [slug].func) and every API
                       handler (api/v1/scores.func -> ../geocode.func) is a
                       symlink into a shared bundle. `find -type d` skips them,
                       which is why the documented command uses it.
  *.rsc.func           The React-payload side of a prerendered page. Excluded.
  *.segments/          Per-segment payload functions. Excluded.

That leaves the real bundles. Today there are 9 of them, and the static model
below reproduces the same 9 from the source tree:

  1. Every route-emitting file whose path contains a DYNAMIC SEGMENT costs a
     function - [slug], [...params], [[...params]] alike. Prerendering does not
     buy it back: `generateStaticParams`, `dynamicParams = false` and
     `dynamic = "force-static"` were each measured during the outage and none of
     them removes the Lambda. The only way to not pay is to not have the route.
  2. Metadata image routes count as routes. `opengraph-image.tsx`,
     `twitter-image.tsx` and `icon.tsx` in a dynamic directory each cost their
     own function on top of the page beside them. Forgetting this is what put
     the deployment 6 over the ceiling; retiring those files is what fixed it.
  3. Route handlers under src/app/api MOSTLY share one bundle, and a handler
     that opts out of prerendering does not. Measured 2026-08-22: api/geocode
     is a real directory and api/keystatic/[...params] is a symlink to it, but
     the force-dynamic handlers each got their own bundle. Before 2026-08-21 the
     builder grouped those too - same source, same CLI version, different
     answer. So this rule is a description of current behavior, never a
     guarantee. Do not add a family of sibling API routes and expect grouping to
     pay for it; a catch-all route file costs one function by construction,
     which is why /api/v1/[endpoint] serves all five v1 endpoints.
  4. A route with no dynamic segment still costs a function when it opts out of
     prerendering (`export const dynamic = "force-dynamic"`). /widget is the
     site's only one: it reads query params on every request.
  5. Everything else - a plain prerendered page like /about or /methodology -
     costs nothing. It ships as static output.

LIMITS OF THE STATIC MODEL (read before trusting it alone)
----------------------------------------------------------
* Bundle grouping is the builder's call and it changes. It is size-bounded (a
  large enough new API route splits /api into two bundles this model counts as
  one), and on 2026-08-21 it changed with no input from this repo at all. Any
  route this model scores as shared may stop being shared without warning.
* A page can become dynamic without saying so, by reading `searchParams`,
  `cookies()` or `headers()` at request time. The model cannot see that.
* Both errors are UNDER-counts, which is the dangerous direction. That is why
  the ground-truth job exists and why the budget is 10, not 12: two functions of
  headroom absorb a model that is wrong by a little.

Usage:
    python3 scripts/check_function_budget.py                    # static model
    python3 scripts/check_function_budget.py --build-output .vercel/output
    python3 scripts/check_function_budget.py --json
    python3 scripts/check_function_budget.py --budget 10 --app-dir src/app

Exit status: 0 within budget, 1 over budget, 2 the check could not run.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Vercel Hobby's hard ceiling. Exceeding it fails the deployment after a
# successful build.
HOBBY_CAP = 12

# What we actually enforce. Two below the cap, so a static model that
# under-counts by one still fails the check before a deployment does.
BUDGET = 10

# Files that define a route. Metadata images are routes too - that is the
# expensive thing people forget.
PAGE_FILES = {"page", "route", "default"}
METADATA_ROUTE_FILES = {
    "opengraph-image",
    "twitter-image",
    "icon",
    "apple-icon",
    "sitemap",
    "robots",
    "manifest",
}
ROUTE_FILE_STEMS = PAGE_FILES | METADATA_ROUTE_FILES
ROUTE_FILE_SUFFIXES = {".tsx", ".ts", ".jsx", ".js", ".mjs"}

DYNAMIC_SEGMENT = re.compile(r"^\[.+\]$")
FORCE_DYNAMIC = re.compile(
    r"""export\s+const\s+dynamic\s*(?::[^=]+)?=\s*["']force-dynamic["']"""
)
REVALIDATE_ZERO = re.compile(r"""export\s+const\s+revalidate\s*(?::[^=]+)?=\s*0\b""")


@dataclass
class Function:
    """One emitted function bundle, and the routes it serves."""

    name: str
    reason: str
    routes: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Ground truth: count what the builder emitted
# ---------------------------------------------------------------------------


def count_build_output(output_dir: Path) -> list[Function]:
    """Count real function bundles in a `vercel build` output directory.

    The Python equivalent of the documented shell command:

        find .vercel/output/functions -name '*.func' -type d \\
             ! -name '*.rsc.func' ! -path '*.segments*' | wc -l
    """
    functions_dir = output_dir / "functions"
    if not functions_dir.is_dir():
        raise FileNotFoundError(
            f"{functions_dir} does not exist - run `npx vercel build` first"
        )

    found: list[Function] = []
    for path in sorted(functions_dir.rglob("*.func")):
        if path.is_symlink() or not path.is_dir():
            continue  # a symlink shares another bundle; it is not its own function
        if path.name.endswith(".rsc.func"):
            continue  # the React-payload half of a prerendered page
        if any(part.endswith(".segments") for part in path.relative_to(functions_dir).parts):
            continue  # per-segment payload functions
        rel = path.relative_to(functions_dir).as_posix()
        found.append(Function(name="/" + rel[: -len(".func")], reason="emitted bundle"))
    return found


# ---------------------------------------------------------------------------
# Static model: predict the count from the route tree
# ---------------------------------------------------------------------------


def route_files(app_dir: Path) -> list[Path]:
    """Every file under src/app that defines a route."""
    out = []
    for path in sorted(app_dir.rglob("*")):
        if not path.is_file() or path.suffix not in ROUTE_FILE_SUFFIXES:
            continue
        if path.stem not in ROUTE_FILE_STEMS:
            continue
        rel = path.relative_to(app_dir)
        # Private folders (_foo) are not routable; nor is anything inside one.
        if any(part.startswith("_") for part in rel.parts[:-1]):
            continue
        out.append(path)
    return out


def route_path(app_dir: Path, path: Path) -> str:
    """URL-ish path for a route file, for humans reading the failure message.

    Route groups `(marketing)` and parallel routes `@slot` do not appear in the
    URL, so they are dropped - but they do not change the function count either
    way, so this is presentation only.
    """
    parts = [
        part
        for part in path.relative_to(app_dir).parts[:-1]
        if not (part.startswith("(") and part.endswith(")")) and not part.startswith("@")
    ]
    suffix = "" if path.stem in PAGE_FILES else f" ({path.stem})"
    return "/" + "/".join(parts) + suffix


def has_dynamic_segment(app_dir: Path, path: Path) -> bool:
    return any(
        DYNAMIC_SEGMENT.match(part) for part in path.relative_to(app_dir).parts[:-1]
    )


def is_force_dynamic(path: Path) -> bool:
    """Does the route opt out of prerendering outright?

    Only the explicit segment-config exports are detectable from source. A route
    that goes dynamic by reading `searchParams` or `cookies()` is invisible here
    - see LIMITS in the module docstring.
    """
    try:
        source = path.read_text(encoding="utf-8")
    except OSError:
        return False
    return bool(FORCE_DYNAMIC.search(source) or REVALIDATE_ZERO.search(source))


def is_api_route(app_dir: Path, path: Path) -> bool:
    parts = path.relative_to(app_dir).parts
    return len(parts) > 1 and parts[0] == "api" and path.stem == "route"


def model_static(app_dir: Path) -> list[Function]:
    """Predict the emitted function bundles from the source tree."""
    if not app_dir.is_dir():
        raise FileNotFoundError(f"{app_dir} does not exist")

    api_bundle = Function(
        name="/api/** (shared bundle)",
        reason="prerenderable route handlers under /api share one Lambda",
    )
    dynamic_fns: list[Function] = []
    forced_fns: list[Function] = []

    for path in route_files(app_dir):
        route = route_path(app_dir, path)
        if is_api_route(app_dir, path):
            # A force-dynamic handler is measured to sit outside the shared
            # bundle (rule 3). Counting it separately is also the safe error:
            # if the builder does group it after all, the model over-counts,
            # and over-counting only costs a nagging check.
            if is_force_dynamic(path):
                forced_fns.append(
                    Function(
                        name=route,
                        reason="API handler that opts out of prerendering",
                        routes=[route],
                    )
                )
            else:
                api_bundle.routes.append(route)
        elif has_dynamic_segment(app_dir, path):
            dynamic_fns.append(
                Function(name=route, reason="dynamic segment in the route path", routes=[route])
            )
        elif is_force_dynamic(path):
            forced_fns.append(
                Function(name=route, reason="opts out of prerendering", routes=[route])
            )

    found = list(dynamic_fns) + list(forced_fns)
    if api_bundle.routes:
        found.append(api_bundle)
    return found


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------


def report(functions: list[Function], budget: int, source: str) -> str:
    count = len(functions)
    lines = [f"Vercel function budget - {source}", ""]
    for fn in sorted(functions, key=lambda f: f.name):
        detail = f"  {fn.name}"
        if len(fn.routes) > 1:
            detail += f"  [{len(fn.routes)} routes: {', '.join(sorted(fn.routes))}]"
        lines.append(detail)
    lines.append("")
    lines.append(f"{count} function bundle(s); budget {budget}; Vercel Hobby cap {HOBBY_CAP}")

    if count > budget:
        lines += [
            "",
            f"OVER BUDGET by {count - budget}.",
            "",
            f"Vercel Hobby refuses a deployment carrying more than {HOBBY_CAP} Serverless",
            "Functions, and it refuses it AFTER reporting a successful build - so production",
            "freezes on its last good build while every check stays green. That is the",
            "August 2026 outage. Do not merge this as-is.",
            "",
            "What costs a function: any route file whose path contains a dynamic segment",
            "([slug], [...params], [[...params]]), including opengraph-image / twitter-image /",
            "icon files, which are routes and not pages. Prerendering does not buy the",
            "function back - generateStaticParams, dynamicParams = false and",
            'dynamic = "force-static" were each measured and none of them removes it.',
            "",
            "Cheaper shapes: one catch-all route instead of N siblings; a file generated at",
            "build time instead of a route, whenever the output derives from committed data",
            "(that is what scripts/generate_og_images.mjs does for the share cards).",
            "",
            'See the "STANDING BUDGET" bullet under "DEPLOY OUTAGE 2026-08-06 -> 08-16" in',
            "CHECKLIST.md for the full budget and the reclaim options.",
        ]
    elif count == budget:
        lines += ["", "At budget. The next dynamic route family fails this check."]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--app-dir",
        type=Path,
        default=REPO_ROOT / "src" / "app",
        help="App Router directory to model (default: src/app)",
    )
    parser.add_argument(
        "--build-output",
        type=Path,
        default=None,
        help="Count a real `vercel build` output directory instead (ground truth)",
    )
    parser.add_argument("--budget", type=int, default=BUDGET, help=f"default {BUDGET}")
    parser.add_argument("--json", action="store_true", help="machine-readable output")
    args = parser.parse_args(argv)

    try:
        if args.build_output is not None:
            functions = count_build_output(args.build_output)
            source = f"ground truth from {args.build_output}"
        else:
            functions = model_static(args.app_dir)
            source = f"static model of {args.app_dir}"
    except FileNotFoundError as exc:
        print(f"function budget: cannot run - {exc}", file=sys.stderr)
        return 2

    over = len(functions) > args.budget
    if args.json:
        print(
            json.dumps(
                {
                    "source": source,
                    "count": len(functions),
                    "budget": args.budget,
                    "cap": HOBBY_CAP,
                    "over_budget": over,
                    "functions": [
                        {"name": f.name, "reason": f.reason, "routes": f.routes}
                        for f in sorted(functions, key=lambda f: f.name)
                    ],
                },
                indent=2,
            )
        )
    else:
        print(report(functions, args.budget, source))
    return 1 if over else 0


if __name__ == "__main__":
    raise SystemExit(main())
