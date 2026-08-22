"""Vercel function budget: the gate over the real route tree, and the rules.

test_shipped_routes_are_within_budget is the point of the whole file. Vercel
Hobby refuses a deployment carrying more than 12 Serverless Functions, and it
refuses it AFTER the build reports success - so `next build` is green, CI is
green, and production silently freezes on its last good build. That is how
2026-08-06 -> 08-16 became a ten-day invisible outage. A red check on the pull
request is the thing that was missing; this is it.

Everything else here proves each counting rule catches its case, using synthetic
route trees so the rules are pinned independently of what src/app happens to
hold today.
"""

from pathlib import Path

import pytest

import check_function_budget as budget

REPO_ROOT = Path(__file__).resolve().parent.parent
APP_DIR = REPO_ROOT / "src" / "app"
BUILD_OUTPUT = REPO_ROOT / ".vercel" / "output"


def make_route(root: Path, route: str, body: str = "export default function P() {}\n") -> Path:
    """Write a route file at `route` (e.g. "weather/[slug]/page.tsx") under root."""
    path = root / route
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    return path


def names(functions):
    return sorted(f.name for f in functions)


# ---------------------------------------------------------------------------
# The gate
# ---------------------------------------------------------------------------


def test_shipped_routes_are_within_budget():
    """The real src/app tree stays under the budget. This is what blocks a bad ship."""
    functions = budget.model_static(APP_DIR)
    assert len(functions) <= budget.BUDGET, budget.report(
        functions, budget.BUDGET, f"static model of {APP_DIR}"
    )


def test_budget_leaves_headroom_under_the_hobby_cap():
    """The enforced number must sit below the ceiling, or it enforces nothing."""
    assert budget.BUDGET < budget.HOBBY_CAP


def test_static_model_matches_the_emitted_bundles():
    """Cross-check the model against a real `vercel build`, when one is present.

    Skipped in a clean checkout - .vercel/ is gitignored, and CI measures the
    ground truth in its own job (.github/workflows/function_budget.yml).
    """
    if not (BUILD_OUTPUT / "functions").is_dir():
        pytest.skip("no .vercel/output - run `npx vercel build` to cross-check")
    emitted = budget.count_build_output(BUILD_OUTPUT)
    modeled = budget.model_static(APP_DIR)
    assert len(modeled) == len(emitted), (
        "the static model disagrees with the emitted bundles - one of them is wrong, "
        "and the model is the one that is allowed to be:\n"
        f"  modeled:  {names(modeled)}\n"
        f"  emitted:  {names(emitted)}"
    )


# ---------------------------------------------------------------------------
# The rules
# ---------------------------------------------------------------------------


def test_dynamic_segment_costs_a_function(tmp_path):
    make_route(tmp_path, "weather/[slug]/page.tsx")
    assert names(budget.model_static(tmp_path)) == ["/weather/[slug]"]


def test_catch_all_and_optional_catch_all_count(tmp_path):
    make_route(tmp_path, "keystatic/[[...params]]/page.tsx")
    make_route(tmp_path, "docs/[...path]/page.tsx")
    assert names(budget.model_static(tmp_path)) == ["/docs/[...path]", "/keystatic/[[...params]]"]


def test_prerendering_does_not_buy_the_function_back(tmp_path):
    """generateStaticParams / dynamicParams / force-static were all measured. None helps."""
    make_route(
        tmp_path,
        "resources/[category]/page.tsx",
        'export const dynamic = "force-static";\n'
        "export const dynamicParams = false;\n"
        "export async function generateStaticParams() { return []; }\n"
        "export default function P() {}\n",
    )
    assert len(budget.model_static(tmp_path)) == 1


def test_metadata_image_route_costs_its_own_function(tmp_path):
    """The expensive thing people forget: og images in a dynamic dir are routes."""
    make_route(tmp_path, "weather/[slug]/page.tsx")
    make_route(tmp_path, "weather/[slug]/opengraph-image.tsx")
    make_route(tmp_path, "weather/[slug]/twitter-image.tsx")
    assert names(budget.model_static(tmp_path)) == [
        "/weather/[slug]",
        "/weather/[slug] (opengraph-image)",
        "/weather/[slug] (twitter-image)",
    ]


def test_static_page_costs_nothing(tmp_path):
    make_route(tmp_path, "about/page.tsx")
    make_route(tmp_path, "about/opengraph-image.tsx")
    make_route(tmp_path, "page.tsx")
    assert budget.model_static(tmp_path) == []


def test_force_dynamic_page_costs_a_function_without_a_dynamic_segment(tmp_path):
    """/widget's case: no [slug], but it reads query params on every request."""
    make_route(
        tmp_path,
        "widget/page.tsx",
        'export const dynamic = "force-dynamic";\nexport default function P() {}\n',
    )
    assert names(budget.model_static(tmp_path)) == ["/widget"]


def test_prerenderable_api_handlers_share_one_bundle(tmp_path):
    """Measured: those /api/** .func entries are symlinks into a single bundle."""
    for route in ("api/geocode", "api/keystatic/[...params]"):
        make_route(tmp_path, f"{route}/route.ts", "export function GET() {}\n")
    functions = budget.model_static(tmp_path)
    assert len(functions) == 1
    assert functions[0].name == "/api/** (shared bundle)"
    assert len(functions[0].routes) == 2


def test_force_dynamic_api_handler_leaves_the_shared_bundle(tmp_path):
    """The 2026-08-21 regression: the builder stopped grouping these.

    Five force-dynamic siblings counted as one shared bundle is exactly the
    under-count that let a green build freeze production, so each one is now
    counted on its own.
    """
    make_route(tmp_path, "api/geocode/route.ts", "export function GET() {}\n")
    for endpoint in ("forecast", "scores", "today"):
        make_route(
            tmp_path,
            f"api/v1/{endpoint}/route.ts",
            'export const dynamic = "force-dynamic";\nexport function GET() {}\n',
        )
    assert names(budget.model_static(tmp_path)) == [
        "/api/** (shared bundle)",
        "/api/v1/forecast",
        "/api/v1/scores",
        "/api/v1/today",
    ]


def test_one_catch_all_api_route_costs_one_function(tmp_path):
    """Why the v1 API is a single route file: the count stops depending on the
    builder's grouping mood."""
    make_route(
        tmp_path,
        "api/v1/[endpoint]/route.ts",
        'export const dynamic = "force-dynamic";\nexport function GET() {}\n',
    )
    assert names(budget.model_static(tmp_path)) == ["/api/v1/[endpoint]"]


def test_route_handler_outside_api_is_counted_on_its_own(tmp_path):
    make_route(tmp_path, "feed/[town]/[feed]/route.ts", "export function GET() {}\n")
    make_route(tmp_path, "api/geocode/route.ts", "export function GET() {}\n")
    assert names(budget.model_static(tmp_path)) == ["/api/** (shared bundle)", "/feed/[town]/[feed]"]


def test_private_folders_and_non_route_files_are_ignored(tmp_path):
    make_route(tmp_path, "weather/[slug]/_components/page.tsx")
    make_route(tmp_path, "weather/[slug]/HeightReporter.tsx")
    make_route(tmp_path, "weather/[slug]/page.tsx")
    assert names(budget.model_static(tmp_path)) == ["/weather/[slug]"]


def test_route_groups_do_not_appear_in_the_reported_path(tmp_path):
    make_route(tmp_path, "(marketing)/weather/[slug]/page.tsx")
    assert names(budget.model_static(tmp_path)) == ["/weather/[slug]"]


# ---------------------------------------------------------------------------
# Ground-truth counting
# ---------------------------------------------------------------------------


def test_build_output_counts_real_bundles_only(tmp_path):
    """Symlinks, .rsc.func and .segments/ are decoys, not functions."""
    functions_dir = tmp_path / "functions"
    (functions_dir / "weather" / "[slug].func").mkdir(parents=True)
    (functions_dir / "about.rsc.func").mkdir(parents=True)
    (functions_dir / "index.segments" / "_tree.segment.rsc.func").mkdir(parents=True)
    (functions_dir / "weather" / "boone.func").symlink_to(functions_dir / "weather" / "[slug].func")
    (functions_dir / "about.func").symlink_to(functions_dir / "about.rsc.func")

    assert names(budget.count_build_output(tmp_path)) == ["/weather/[slug]"]


def test_missing_build_output_is_an_error_not_a_pass(tmp_path):
    with pytest.raises(FileNotFoundError):
        budget.count_build_output(tmp_path / "nothing")


def test_over_budget_message_names_the_routes_and_points_at_the_checklist(tmp_path):
    for n in range(12):
        make_route(tmp_path, f"town{n}/[slug]/page.tsx")
    functions = budget.model_static(tmp_path)
    message = budget.report(functions, budget.BUDGET, "test")
    assert "OVER BUDGET" in message
    assert "/town7/[slug]" in message
    assert "CHECKLIST.md" in message


def test_exit_status_is_one_when_over_budget(tmp_path, capsys):
    for n in range(12):
        make_route(tmp_path, f"town{n}/[slug]/page.tsx")
    assert budget.main(["--app-dir", str(tmp_path)]) == 1
    assert budget.main(["--app-dir", str(tmp_path), "--budget", "20"]) == 0
    capsys.readouterr()


def test_missing_app_dir_exits_two(tmp_path, capsys):
    assert budget.main(["--app-dir", str(tmp_path / "nope")]) == 2
    capsys.readouterr()
