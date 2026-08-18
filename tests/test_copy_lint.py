"""Copy lint: the rules, and the gate over the real tree.

test_shipped_copy_is_clean is the point of the whole file. It runs the linter
over the copy the site actually ships and FAILS the suite on any error, so a
styleguide violation cannot reach production by being unnoticed in review.
Everything else here proves each rule catches its violation and leaves clean
copy alone.
"""

from pathlib import Path

import pytest

import copy_lint

REPO_ROOT = Path(__file__).resolve().parent.parent

# Minimal stand-in for the shared word lists, so rule tests don't depend on the
# shared checkout being present. The integration test below uses the real file.
FAKE_RULES = {
    "tier1_vocab": {
        "_severity": "error",
        "_category": "VOCAB",
        "words": ["delve", "seamless", "utilize"],
    },
    "tier2_overuse": {"_severity": "warn", "_category": "T2", "words": ["key"]},
}


def lint(tmp_path, name, body):
    path = tmp_path / name
    path.write_text(body, encoding="utf-8")
    return copy_lint.lint([path], rules=FAKE_RULES)


def codes(findings, severity=None):
    return [f.code for f in findings if severity is None or f.severity == severity]


def page(*body: str) -> str:
    """Wrap JSX body lines in a plausible page component."""
    return "export default function Page() {\n  return (\n" + "\n".join(body) + "\n  );\n}\n"


# ---------------------------------------------------------------------------
# The gate
# ---------------------------------------------------------------------------


def test_shipped_copy_is_clean():
    """The real src/ tree passes. This is what blocks a bad ship."""
    findings = copy_lint.lint(copy_lint.default_targets())
    errors = [f for f in findings if f.severity == "error"]
    assert not errors, "copy lint errors:\n" + "\n".join(
        f"  {f.path}:{f.line} [{f.code}] {f.message}" for f in errors
    )


def test_default_targets_cover_the_shipped_surface():
    files = {copy_lint._rel(p) for p in copy_lint.iter_files(copy_lint.default_targets())}
    assert "src/content/copy.ts" in files
    assert "src/content/resources.ts" in files
    assert "src/app/methodology/page.tsx" in files
    assert "src/components/SiteHeader.tsx" in files
    assert any(f.startswith("src/content/posts/") for f in files)
    # deliberately out of scope
    assert not any(f.startswith("src/lib/") for f in files)
    assert not any(f.startswith("src/components/ui/") for f in files)


def test_unapproved_draft_is_never_linted(tmp_path):
    draft = tmp_path / "17-high-country-towns.md"
    draft.write_text("# Draft\n\nA sentence with an em-dash — and a colon: it is wrong.\n")
    assert copy_lint.iter_files([tmp_path]) == []


# ---------------------------------------------------------------------------
# Shared word lists
# ---------------------------------------------------------------------------


def test_missing_shared_rules_fails_loudly(tmp_path):
    with pytest.raises(SystemExit) as exc:
        copy_lint.load_style_rules(tmp_path / "nope.json")
    assert "style rules" in str(exc.value)


def test_reads_the_canonical_shared_word_lists():
    """No forked copy: the terms come from shared-skills' style_rules.json."""
    rules = copy_lint.load_style_rules()
    terms = dict(copy_lint.banned_terms(rules))
    assert "delve" in terms and "utilize" in terms and "seamless" in terms
    assert copy_lint.DEFAULT_STYLE_RULES_PATH.name == "style_rules.json"


# ---------------------------------------------------------------------------
# Colons
# ---------------------------------------------------------------------------


def test_colon_sentence_lowercase_is_an_error(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <p>A plain majority vote is the wrong tool here: rain days are the minority.</p>'))
    assert "COLON_SENTENCE" in codes(found, "error")


def test_colon_sentence_capitalized_is_clean(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <p>A plain majority vote is the wrong tool here. Rain days are the minority.</p>'))
    assert codes(found, "error") == []


def test_colon_imperative_needs_a_capital(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <p>The sure thing: head to the ridge, which has a clear line.</p>'))
    assert "COLON_SENTENCE" in codes(found, "error")


def test_colon_enumeration_stays_lowercase(tmp_path):
    """AP keeps a genuine enumeration lowercase; it is a warning, not an error."""
    found = lint(tmp_path, "a.tsx", page(
        '    <p>The tracker hands back every field: slugs, names, coordinates, elevation.</p>'))
    assert codes(found, "error") == []
    assert "COLON_FRAGMENT" in codes(found, "warn")


def test_colon_appositive_fragment_is_only_a_warning(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <p>Each town is graded against its own actuals: the archive read at that'
        ' town&apos;s own coordinates.</p>'))
    assert codes(found, "error") == []


def test_lowercase_list_label_is_an_error(tmp_path):
    """The owner-caught wind scale: `calm: 0-1 mph`."""
    found = lint(tmp_path, "a.tsx", page(
        '    <ul><li>calm: 0&ndash;1 mph</li><li>windy or gusty: 18&ndash;30 mph</li></ul>'))
    assert codes(found, "error").count("COLON_LABEL") == 2


def test_restructured_list_label_is_clean(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <ul><li><strong>Calm</strong> is 0&ndash;1 mph</li>'
        '<li><strong>Windy or gusty</strong> is 18&ndash;30 mph</li></ul>'))
    assert codes(found, "error") == []


def test_colon_budget_warns_but_never_blocks(tmp_path):
    body = " ".join(
        f"Sentence number {n} says this: a small trailing fragment." for n in range(6)
    )
    found = lint(tmp_path, "a.tsx", page(f"    <p>{body}</p>"))
    assert "COLON_BUDGET" in codes(found, "warn")
    assert "COLON_BUDGET" not in codes(found, "error")


# ---------------------------------------------------------------------------
# Em-dashes
# ---------------------------------------------------------------------------


def test_emdash_in_ui_copy_is_an_error(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <p>No source is weighted above another &mdash; the point of a consensus.</p>'))
    assert "EMDASH" in codes(found, "error")


def test_emdash_entity_and_literal_both_caught(tmp_path):
    found = lint(tmp_path, "a.ts", 'export const metadata = { title: "Videos — Dave\'s Sweater" };\n')
    assert "EMDASH" in codes(found, "error")


def test_emdash_free_copy_is_clean(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <p>No source is weighted above another. That is the point of a consensus.</p>'))
    assert codes(found, "error") == []


def test_empty_cell_placeholder_is_allowed(tmp_path):
    found = lint(tmp_path, "a.tsx",
                 'const cell = (hi: number | null) => `${hi ?? "—"}°`;\n' + page("    <p>Fine copy here.</p>"))
    assert codes(found, "error") == []


def test_markdown_emdash_is_a_density_warning_not_a_ban(tmp_path):
    body = "---\ntitle: \"A Post\"\n---\n\n" + ("Words repeated for length. " * 60) + "\n\nOne aside — like this.\n"
    found = lint(tmp_path, "post.md", body)
    assert codes(found, "error") == []


# ---------------------------------------------------------------------------
# Nav / category label case
# ---------------------------------------------------------------------------


def test_nav_case_flags_a_sentence_case_outlier(tmp_path):
    src = (
        'const resources = [\n'
        '  { href: "/resources/articles", label: "Articles" },\n'
        '  { href: "/api", label: "Free data and API" },\n'
        '];\n'
    )
    path = tmp_path / "SiteHeader.tsx"
    path.write_text(src, encoding="utf-8")
    findings = copy_lint.rule_nav_case([path])
    # the check is wired by repo-relative path, so point it at the fixture
    copy_lint.NAV_LABEL_SETS.append((copy_lint._rel(path), "resources"))
    try:
        findings = copy_lint.rule_nav_case([path])
    finally:
        copy_lint.NAV_LABEL_SETS.pop()
    assert [f.code for f in findings] == ["NAV_CASE"]
    assert "Free data and API" in findings[0].message


def test_nav_case_accepts_title_case_with_small_words(tmp_path):
    src = (
        'const resources = [\n'
        '  { href: "/resources/news", label: "News & Updates" },\n'
        '  { href: "/api", label: "Free Data and API" },\n'
        '  { href: "/right-wrong-ray", label: "Right/Wrong Ray" },\n'
        '];\n'
    )
    path = tmp_path / "SiteHeader.tsx"
    path.write_text(src, encoding="utf-8")
    copy_lint.NAV_LABEL_SETS.append((copy_lint._rel(path), "resources"))
    try:
        findings = copy_lint.rule_nav_case([path])
    finally:
        copy_lint.NAV_LABEL_SETS.pop()
    assert findings == []


def test_nav_check_fails_loudly_if_the_array_is_renamed(tmp_path):
    path = tmp_path / "SiteHeader.tsx"
    path.write_text('const links = [{ href: "/", label: "Today" }];\n', encoding="utf-8")
    copy_lint.NAV_LABEL_SETS.append((copy_lint._rel(path), "resources"))
    try:
        findings = copy_lint.rule_nav_case([path])
    finally:
        copy_lint.NAV_LABEL_SETS.pop()
    assert [f.code for f in findings] == ["NAV_CASE"]
    assert "not found" in findings[0].message


# ---------------------------------------------------------------------------
# Banned vocabulary
# ---------------------------------------------------------------------------


def test_banned_vocabulary_in_ui_copy_is_an_error(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <p>We utilize a seamless rubric to delve into the numbers.</p>'))
    assert codes(found, "error").count("VOCAB") == 3


def test_plain_vocabulary_is_clean(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <p>We use one rubric and publish the numbers.</p>'))
    assert codes(found, "error") == []


# ---------------------------------------------------------------------------
# Label, cell, and caption capitalization
# ---------------------------------------------------------------------------


def test_lowercase_table_cell_is_an_error(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <table><tbody><tr>'
        '<td>High temp</td><td>within 1&deg;F of actual, then &minus;3 pts beyond.</td>'
        '</tr></tbody></table>'))
    assert "CELL_CASE" in codes(found, "error")


def test_capitalized_table_cell_is_clean(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <table><tbody><tr>'
        '<td>High temp</td><td>Within 1&deg;F of actual, then &minus;3 pts beyond.</td>'
        '</tr></tbody></table>'))
    assert codes(found, "error") == []


def test_lowercase_stat_captions_are_errors(tmp_path):
    """The /right-wrong-ray stat row the owner had to fix by hand."""
    found = lint(tmp_path, "a.tsx", page(
        '    <div>',
        '      <div className="text-xs text-muted">season avg / 100</div>',
        '      <div className="text-xs text-muted">graded Right</div>',
        '      <div className="text-xs text-muted">days scored</div>',
        '    </div>'))
    assert codes(found, "error").count("CAPTION_CASE") == 3


def test_capitalized_stat_captions_are_clean(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <div>',
        '      <div className="text-xs text-muted">Season avg / 100</div>',
        '      <div className="text-xs text-muted">Graded Right</div>',
        '      <div className="text-xs text-muted">Days scored</div>',
        '    </div>'))
    assert codes(found, "error") == []


def test_caption_rule_leaves_domains_and_inline_phrases_alone(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <div>',
        '      <div>davessweater.com</div>',
        '      <p>The index is graded <em>the same way</em> as every source it draws on.</p>',
        '    </div>'))
    assert codes(found, "error") == []


# ---------------------------------------------------------------------------
# JSX adjacency (words running together)
# ---------------------------------------------------------------------------


def test_text_running_into_an_element_is_an_error(tmp_path):
    """Shipped on /methodology as "rangeis scored"."""
    found = lint(tmp_path, "a.tsx", page(
        '    <p>',
        '      A forecast given as a',
        '      <em>range</em> is scored at its midpoint.',
        '    </p>'))
    assert "JSX_SPACING" in codes(found, "error")


def test_element_running_into_text_is_an_error(tmp_path):
    """Shipped on /right-wrong-ray as "Index(the bold white line)"."""
    found = lint(tmp_path, "a.tsx", page(
        '    <p>',
        '      Our own <span className="font-semibold">Dave&apos;s Sweater Index</span>',
        '      (the bold white line) stays near the top.',
        '    </p>'))
    assert "JSX_SPACING" in codes(found, "error")


def test_same_line_adjacency_is_an_error(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <p>A forecast given as a <em>range</em>is scored at its midpoint.</p>'))
    assert "JSX_SPACING" in codes(found, "error")


def test_explicit_space_expression_is_clean(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <p>',
        '      A forecast given as a{" "}',
        '      <em>range</em> is scored at its midpoint. Our own{" "}',
        '      <span className="font-semibold">Index</span>{" "}',
        '      stays near the top.',
        '    </p>'))
    assert codes(found, "error") == []


def test_entity_bearing_wrapped_node_loses_its_space(tmp_path):
    """The /methodology "rangeis scored" bug, confirmed in a production build.

    A text node that carries an HTML entity and wraps across lines loses its
    leading space at build time, so the source looks fine and the page doesn't.
    """
    found = lint(tmp_path, "a.tsx", page(
        '    <p>',
        '      A forecast given as a{" "}',
        '      <em>range</em> is scored at its midpoint, then taxed for vagueness. A',
        '      5&ndash;15 mph range scores lower than a precise 10 mph.',
        '    </p>'))
    assert "JSX_SPACING" in codes(found, "error")


def test_entity_bearing_single_line_node_keeps_its_space(tmp_path):
    """Same entity, one line: the space survives, so this is not a violation."""
    found = lint(tmp_path, "a.tsx", page(
        '    <ul><li><strong>Calm</strong> is 0&ndash;1 mph</li></ul>'))
    assert codes(found, "error") == []


def test_explicit_spacer_fixes_the_entity_case(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <p>',
        '      A forecast given as a{" "}',
        '      <em>range</em>{" "}is scored at its midpoint, then taxed for vagueness. A',
        '      5&ndash;15 mph range scores lower than a precise 10 mph.',
        '    </p>'))
    assert codes(found, "error") == []


def test_css_spaced_elements_are_exempt(tmp_path):
    """A margin utility or a flex row already provides the gap."""
    found = lint(tmp_path, "a.tsx", page(
        '    <p><span className="mx-2">|</span>Not affiliated with Ray&apos;s Weather.</p>',
        '    <summary className="flex items-center gap-1.5">',
        '      All 18 towns',
        '      <span aria-hidden className="text-xs">&#9660;</span>',
        '    </summary>'))
    assert codes(found, "error") == []


# ---------------------------------------------------------------------------
# Data-line separators
# ---------------------------------------------------------------------------


def test_middot_separator_is_an_error(tmp_path):
    """The widget almanac line the owner caught: pipes above, middots below."""
    found = lint(tmp_path, "a.tsx", page(
        '    <div>Sunrise 6:24 AM · Sunset 8:41 PM</div>'))
    assert "SEPARATOR" in codes(found, "error")


def test_middot_entity_separator_is_an_error(tmp_path):
    """`&middot;` reads as the same character, so it drifts the same way."""
    found = lint(tmp_path, "a.tsx", page(
        '    <div className="ds-caption">{r.record} &middot; {r.days} days</div>'))
    assert "SEPARATOR" in codes(found, "error")


def test_middot_join_separator_is_an_error(tmp_path):
    """`join(" · ")` is the case snippet extraction cannot see: too short to
    look like copy, and it produced the contradiction inside the widget card."""
    found = lint(tmp_path, "a.tsx", 'const line = almanac.join(" · ");\n' + page(
        "    <p>Fine copy here.</p>"))
    assert "SEPARATOR" in codes(found, "error")


def test_pipe_separator_is_clean(tmp_path):
    found = lint(tmp_path, "a.tsx", 'const line = almanac.join(" | ");\n' + page(
        '    <div>Sunrise 6:24 AM | Sunset 8:41 PM</div>'))
    assert codes(found, "error") == []


def test_middot_opening_a_list_item_is_a_bullet_glyph(tmp_path):
    """The fireworks report's hand-rolled list markers, exempt by design."""
    found = lint(tmp_path, "a.tsx", page(
        '    <ul>',
        '      <li key={l}>· {l}</li>',
        '      <li key={o.year}>',
        '        · <strong className="text-foreground">The observed record</strong>',
        '      </li>',
        '    </ul>'))
    assert codes(found, "error") == []


def test_middot_opening_an_inline_span_is_still_a_separator(tmp_path):
    """ScoreBreakdown's `<span>· not published</span>` also led its element, and
    it was drift - the exemption is <li>, not "leading glyph"."""
    found = lint(tmp_path, "a.tsx", page(
        '    <div>High temp <span>· not published</span></div>'))
    assert "SEPARATOR" in codes(found, "error")


def test_og_share_card_art_is_exempt(tmp_path):
    """next/og cards are rasterized poster art with their own typography."""
    found = lint(tmp_path, "opengraph-image.tsx", page(
        '    <div>JULY 9–12, 2026  ·  MACRAE MEADOWS</div>'))
    assert codes(found, "error") == []
    same = lint(tmp_path, "page.tsx", page(
        '    <div>JULY 9–12, 2026  ·  MACRAE MEADOWS</div>'))
    assert "SEPARATOR" in codes(same, "error")


def test_middot_in_a_source_comment_is_not_copy(tmp_path):
    found = lint(tmp_path, "a.tsx", '// almanac used to read "Sunrise · Sunset"\n' + page(
        '    <p>Fine copy here.</p>'))
    assert codes(found, "error") == []


# ---------------------------------------------------------------------------
# Typographic quotes in JSX
# ---------------------------------------------------------------------------


def test_straight_quote_entity_in_jsx_is_an_error(tmp_path):
    """The owner caught `What counts as &quot;actual&quot;` on /methodology."""
    found = lint(tmp_path, "a.tsx", page(
        '    <h2>What counts as &quot;actual&quot;</h2>'))
    assert codes(found, "error").count("JSX_QUOTES") == 2


def test_raw_double_quote_in_jsx_is_an_error(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <p>Every listing says "at dusk" and leaves it there.</p>'))
    assert "JSX_QUOTES" in codes(found, "error")


def test_typographic_entities_are_clean(tmp_path):
    found = lint(tmp_path, "a.tsx", page(
        '    <h2>What counts as &ldquo;actual&rdquo;</h2>',
        '    <p>Ray&apos;s Weather never publishes a total.</p>'))
    assert codes(found, "error") == []


def test_markdown_quotes_are_left_to_smartypants(tmp_path):
    body = '---\ntitle: "A Post"\n---\n\nNOAA says "a 10-day forecast is a coin flip" and moves on.\n'
    found = lint(tmp_path, "post.md", body)
    assert "JSX_QUOTES" not in codes(found)
