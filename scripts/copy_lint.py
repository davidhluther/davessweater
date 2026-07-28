#!/usr/bin/env python3
"""Copy lint - mechanical styleguide enforcement for shipped UI copy.

Why this exists: the writing styleguide's rules held only as prose, and prose-only
rules demonstrably don't hold (the owner kept catching colon and em-dash violations
by reading the live site). The styleguide's 2026-07-18 changelog entry asks every
project to adopt Pigasus's mechanical copy-lint. This is Dave's Sweater's.

It extracts USER-FACING strings from the codebase (JSX text nodes, prose string
literals, metadata titles/descriptions, aria-labels, markdown posts) and applies the
subset of styleguide rules that are mechanically decidable on UI copy:

  COLON_SENTENCE  error  lowercase complete sentence after a sentence-internal colon
                         (AP violation; styleguide Tier 4 + owner rule 2026-07-18)
  COLON_LABEL     error  lowercase "label: value" skeleton in prose or a list item
  COLON_SKELETON  warn   the same skeleton with a capitalized label
  COLON_FRAGMENT  warn   any other lowercase-after-colon in prose (flagged for review)
  COLON_BUDGET    warn   >3 sentence-internal colons in one file's body prose
  EMDASH          error  em-dash in a user-facing string under src/ (DS practice is
                         to avoid them in UI copy; empty-cell placeholders exempt)
  EMDASH_DENSITY  warn   markdown posts over the universal 1-per-200-words ceiling
  NAV_CASE        error  a nav/category label set that isn't uniformly Title Case
  CELL_CASE       error  a table cell whose text starts lowercase
  CAPTION_CASE    error  a stat caption or standalone label that starts lowercase
  JSX_SPACING     error  words that run together at an element boundary
  JSX_QUOTES      error  straight quotes in rendered JSX text (nothing converts them)
  VOCAB           error  Tier 1 banned vocabulary, puffery, or formulaic transitions

Severity is the design. Errors are the unambiguous mechanical cases; every judgment
call is a warning, because a linter that forces bad rewrites gets switched off.

Word lists are NOT duplicated here. They are read from the canonical shared file
(~/Projects/shared-skills/seo/seo-validate/data/style_rules.json, the same JSON
validate_article.py consumes); a missing file is a loud failure, never a fork.

Usage:
    python3 scripts/copy_lint.py              # the shipped copy (see DEFAULT_TARGETS)
    python3 scripts/copy_lint.py PATH...      # lint specific files or dirs
    python3 scripts/copy_lint.py --dump       # print every extracted string
    python3 scripts/copy_lint.py --json       # machine-readable findings

Exit status: 0 clean, 1 violations found, 2 the linter could not run.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Canonical, shared word lists. Forking a copy into this repo is banned by
# ~/Projects/CLAUDE.md, so we read the shared file and fail loudly if it moved.
# Override for CI or a relocated checkout with DS_STYLE_RULES_PATH.
DEFAULT_STYLE_RULES_PATH = (
    Path.home() / "Projects/shared-skills/seo/seo-validate/data/style_rules.json"
)

# What ships as copy a reader sees: the pages, the components that render them,
# the editable copy decks, and the native posts.
DEFAULT_TARGETS = (
    "src/app",
    "src/components",
    "src/content/copy.ts",
    "src/content/resources.ts",
    "src/content/posts",
)

# Out of scope on purpose. src/lib is data plumbing (RSS/XML builders, JSON-LD
# assembly) whose strings are machinery, src/components/ui is vendored shadcn,
# and __tests__ is fixtures. Pass any of them explicitly if you want them read.
EXCLUDE_DIRS = ("src/components/ui", "src/lib", "__tests__")

# Drafts the owner has not approved. Never linted, never edited.
EXCLUDE_NAMES = {
    "17-high-country-towns.md",  # unapproved draft; leave it alone entirely
}

SRC_SUFFIXES = {".ts", ".tsx", ".md"}


# ---------------------------------------------------------------------------
# Shared style rules
# ---------------------------------------------------------------------------


def load_style_rules(path: Path | None = None) -> dict:
    """Load the canonical shared word lists. Loud failure if they're missing."""
    path = path or Path(os.environ.get("DS_STYLE_RULES_PATH", DEFAULT_STYLE_RULES_PATH))
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(
            f"FATAL: cannot read the canonical style rules at {path}: {exc}\n"
            "copy_lint.py deliberately does not carry its own copy of the word "
            "lists (forking a shared asset is banned by ~/Projects/CLAUDE.md).\n"
            "Fix the checkout of ~/Projects/shared-skills, or point "
            "DS_STYLE_RULES_PATH at style_rules.json."
        ) from exc


def banned_terms(rules: dict) -> list[tuple[str, str]]:
    """(term, category) pairs whose severity in the shared rules is 'error'."""
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for key, block in rules.items():
        if not isinstance(block, dict) or block.get("_severity") != "error":
            continue
        category = block.get("_category", key.upper())
        words = block.get("words", [])
        forms = words.values() if isinstance(words, dict) else [{"forms": [w]} for w in words]
        for spec in forms:
            for form in spec.get("forms", []):
                low = form.lower()
                if low not in seen:
                    seen.add(low)
                    out.append((low, category))
    return out


# ---------------------------------------------------------------------------
# Extraction
# ---------------------------------------------------------------------------


@dataclass
class Snippet:
    """One user-facing string, with where it came from."""

    path: str
    line: int
    text: str  # HTML entities decoded, JSX expressions stripped
    raw: str  # as written in the file
    role: str  # prose | heading | label | list_item | cell | data
    origin: str  # jsx | string | md
    src: str = field(default="", repr=False)  # whole file, for line lookup
    span: tuple[int, int] = field(default=(0, 0), repr=False)
    parent: str = ""  # immediate enclosing element (JSX only)
    solitary: bool = False  # the parent element's only text node
    cell_first: bool = False  # leads a <td>/<th>

    def line_of(self, pattern: str, nth: int = 0) -> int:
        """Line of the nth match of `pattern` inside this snippet's source span.

        Findings point at the offending word, not at the top of the paragraph
        that contains it. Falls back to the snippet's first line.
        """
        if not self.src:
            return self.line
        seg = self.src[self.span[0] : self.span[1]]
        matches = list(re.finditer(pattern, seg, re.DOTALL))
        if len(matches) <= nth:
            return self.line
        return _line_of(self.src, self.span[0] + matches[nth].start())


@dataclass
class Finding:
    path: str
    line: int
    code: str
    severity: str  # error | warn
    message: str
    text: str


def _line_of(text: str, index: int) -> int:
    return text.count("\n", 0, index) + 1


def _blank(match_text: str) -> str:
    """Replace a region with spaces/newlines so offsets and line numbers hold."""
    return "".join("\n" if ch == "\n" else " " for ch in match_text)


def strip_comments(src: str) -> str:
    """Blank out // and /* */ comments without moving any offset.

    Comments are full of em-dashes and colons that never reach a reader, so they
    have to go before anything else runs.
    """
    out = list(src)
    i, n = 0, len(src)
    state = None  # None | '"' | "'" | '`' | 'line' | 'block'
    while i < n:
        ch = src[i]
        nxt = src[i + 1] if i + 1 < n else ""
        if state is None:
            if ch == "/" and nxt == "/":
                state = "line"
                out[i] = out[i + 1] = " "
                i += 2
                continue
            if ch == "/" and nxt == "*":
                state = "block"
                out[i] = out[i + 1] = " "
                i += 2
                continue
            if ch in "\"'`":
                state = ch
            i += 1
            continue
        if state in ("line", "block"):
            if state == "line" and ch == "\n":
                state = None
            elif state == "block" and ch == "*" and nxt == "/":
                out[i] = out[i + 1] = " "
                i += 2
                state = None
                continue
            elif ch != "\n":
                out[i] = " "
            i += 1
            continue
        # inside a string literal
        if ch == "\\":
            i += 2
            continue
        if ch == state:
            state = None
        i += 1
    return "".join(out)


# Attribute/key values that are machinery, not copy.
_TECHNICAL_KEYS = (
    "className|class|href|src|url|rel|target|xmlns|viewBox|fill|stroke|d|id|key|"
    "slug|path|canonical|encodingFormat|contentUrl|license|sizes|type|as|charSet|"
    "content|property|style|onClick|onChange|value|htmlFor|role|itemProp|"
    "strategy|crossOrigin|loading|decoding|preload"
)


def mask_technical(src: str) -> str:
    """Blank out class names, import paths, and other non-copy string values."""
    out = src

    def blank_span(text: str, start: int, end: int) -> str:
        return text[:start] + _blank(text[start:end]) + text[end:]

    # import/export ... from "..."  and  require("...")
    for pattern in (
        r'^\s*(?:import|export)[^\n;]*?from\s*(["\'])(?:(?!\1).)*\1',
        r'^\s*import\s*(["\'])(?:(?!\1).)*\1',
        r'require\(\s*(["\'])(?:(?!\1).)*\1\s*\)',
    ):
        for m in list(re.finditer(pattern, out, re.MULTILINE)):
            out = blank_span(out, m.start(), m.end())

    # technicalKey={...} / technicalKey="..." / "technicalKey": "..."
    key_re = re.compile(rf'(?<![\w$])"?({_TECHNICAL_KEYS})"?\s*[:=]\s*')
    pos = 0
    while True:
        m = key_re.search(out, pos)
        if not m:
            break
        i = m.end()
        if i >= len(out):
            break
        ch = out[i]
        if ch in "\"'":
            j = i + 1
            while j < len(out) and out[j] != ch:
                j += 2 if out[j] == "\\" else 1
            end = min(j + 1, len(out))
        elif ch == "{":
            depth, j = 0, i
            while j < len(out):
                if out[j] == "{":
                    depth += 1
                elif out[j] == "}":
                    depth -= 1
                    if depth == 0:
                        break
                elif out[j] in "\"'`":
                    quote, j = out[j], j + 1
                    while j < len(out) and out[j] != quote:
                        j += 2 if out[j] == "\\" else 1
                j += 1
            end = min(j + 1, len(out))
        else:
            pos = m.end()
            continue
        out = blank_span(out, i, end)
        pos = end
    return out


_JSX_EXPR = re.compile(r"\{[^{}]*\}")
# Interpolated values stand in as "X", not as nothing: a hole would turn
# `${name} forecast for ${date}: ${line}` into a lowercase label skeleton that
# the real rendered string never has.
_PLACEHOLDER_TOKEN = "X"


def _sub_expression(m: re.Match) -> str:
    """`{" "}` keeps its literal spacing; every other expression becomes X."""
    inner = m.group(0)[1:-1].strip()
    if len(inner) >= 2 and inner[0] == inner[-1] and inner[0] in "\"'":
        return inner[1:-1]
    return _PLACEHOLDER_TOKEN
_CELL_TAGS = {"td", "th"}
_BLOCK_TAGS = {
    "p", "li", "button", "a", "summary", "figcaption", "caption",
    "dt", "dd", "blockquote", "label", "option",
} | _CELL_TAGS
_HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6", "title", "legend"}
_INLINE_TAGS = {"span", "em", "strong", "small", "b", "i", "sup", "sub", "abbr",
                "a", "Link", "code"}
_STACK_TAGS = _BLOCK_TAGS | _HEADING_TAGS | _INLINE_TAGS | {
    "div", "section", "ul", "ol", "table", "tbody", "thead", "tr",
    "header", "footer", "main", "nav", "aside", "figure",
}
_TAG_RE = re.compile(r"<(/?)([a-zA-Z][\w.-]*)((?:[^<>\"']|\"[^\"]*\"|'[^']*')*?)(/?)>")
# Tags whose contents are code, not copy.
_OPAQUE_TAGS = {"style", "script", "Script", "code", "pre"}
_CODEY = re.compile(
    r"=>|===|&&|\|\||;\s*$|\$\{|\breturn\b|\bconst\b|=\s*[\"'{]"
    r"|\)\s*[:?]|[?:]\s*\(\s*$|\bfunction\b|\bnew Date\b|\w+\.\w+\("
)


def _role_from_stack(stack: list[str]) -> str:
    for tag in reversed(stack):
        if tag in _HEADING_TAGS:
            return "heading"
        if tag == "li":
            return "list_item"
        if tag in _CELL_TAGS:
            return "cell"
        if tag in _BLOCK_TAGS:
            return "prose"
    return "prose"


def extract_jsx_text(rel: str, src: str) -> list[Snippet]:
    """Text nodes between JSX tags, with the enclosing element's role.

    Frames track each open element instance so a text node knows its immediate
    parent, whether it is that parent's only text (a caption or cell label
    rather than a phrase inside a sentence), and whether it leads a table cell.
    """
    snippets: list[Snippet] = []
    frames: list[dict] = []
    opaque = 0
    prev_end = 0
    for m in _TAG_RE.finditer(src):
        chunk = src[prev_end : m.start()]
        if chunk.strip() and not opaque:
            cleaned = _JSX_EXPR.sub(_sub_expression, chunk)
            decoded = html.unescape(cleaned)
            flat = " ".join(decoded.split())
            stack = [f["name"] for f in frames]
            if (
                stack  # real JSX text always sits inside an element; a bare
                # `Record<string, DayPlan>` type annotation does not
                and len(re.findall(r"[A-Za-z]", flat)) >= 2
                and not _CODEY.search(flat)
                and "}" not in flat
                and "{" not in flat
            ):
                lead = len(chunk) - len(chunk.lstrip())
                snip = Snippet(
                    path=rel,
                    line=_line_of(src, prev_end + lead),
                    text=flat,
                    raw=" ".join(chunk.split()),
                    role=_role_from_stack(stack),
                    origin="jsx",
                    src=src,
                    span=(prev_end + lead, m.start()),
                    parent=frames[-1]["name"],
                )
                frames[-1]["texts"].append(snip)
                for frame in reversed(frames):
                    if frame["name"] in _CELL_TAGS:
                        snip.cell_first = not frame["cell_seen"]
                        frame["cell_seen"] = True
                        break
                snippets.append(snip)
        closing, name, _attrs, self_closing = m.groups()
        if name in _OPAQUE_TAGS and not self_closing:
            opaque = max(0, opaque - 1) if closing else opaque + 1
        if name in _STACK_TAGS:
            if closing:
                names = [f["name"] for f in frames]
                if name in names:
                    while frames:
                        frame = frames.pop()
                        for text in frame["texts"]:
                            text.solitary = len(frame["texts"]) == 1
                        if frame["name"] == name:
                            break
            elif not self_closing:
                frames.append({"name": name, "texts": [], "cell_seen": False})
        prev_end = m.end()
    return snippets


_PROSE_KEYS = {
    "description", "summary", "blurb", "body", "tagline", "footnote", "subline",
    "text", "answer", "question", "note", "imagealt", "alt", "aria-label",
    "arialabel", "placeholder", "caption", "metadescription", "excerpt", "dek",
}
_LABEL_KEYS = {
    "title", "headline", "name", "label", "schemaname", "kicker", "heading",
    "metatitle", "sitename",
}
_DATA_KEYS = {"keywords", "about", "@type", "@context", "position", "item"}

_STRING_RE = re.compile(
    r'"((?:[^"\\\n]|\\.)*)"' r"|'((?:[^'\\\n]|\\.)*)'" r"|`((?:[^`\\]|\\.)*)`",
    re.DOTALL,
)
_KEY_BEFORE = re.compile(r'["\']?([\w$@-]+)["\']?\s*[:=]\s*$')
_SLUGGY = re.compile(r"^[a-z0-9_\-./#]+$")
_TAILWINDY = re.compile(r"^[a-z0-9\-:/\[\]%.#!$&*_ +]+$")
_CODE_STRING = re.compile(
    r"\bfunction\s*\(|=>|;\s*$|\}\s*;|\{\s*\w[\w-]*\s*:\s*[^}]*\}"
    r"|\bvar\b|\bwindow\.|\bdocument\.|!function|\bnew Date\b"
)


def _looks_like_copy(value: str) -> bool:
    """Reject paths, slugs, class lists, inline code, and other machinery."""
    v = value.strip()
    if len(v) < 2 or not re.search(r"[A-Za-z]", v):
        return False
    if v.startswith(("/", "#", "http", "data:", "@", ".", "-")):
        return False
    if _SLUGGY.match(v):
        return False
    if re.match(r"^\d{4}-\d{2}(-\d{2})?$", v):
        return False
    if _CODE_STRING.search(v):
        return False
    words = v.split()
    if len(words) == 1 and _TAILWINDY.match(v) and re.search(r"[:\[\]]", v):
        return False  # a single utility class token, e.g. "sm:grid-cols-2"
    if len(words) >= 2 and _TAILWINDY.match(v):
        # class lists: all lowercase, hyphen/colon-dense, no sentence punctuation
        dense = sum(1 for w in words if re.search(r"[-:/\[\]]", w))
        if dense >= max(1, len(words) // 2) and not re.search(r"[.,?!]", v):
            return False
    return True


def _strip_interpolations(text: str) -> str:
    """Drop `${...}` template holes, braces and all (they nest)."""
    out: list[str] = []
    i, n = 0, len(text)
    while i < n:
        if text.startswith("${", i):
            depth, i = 1, i + 2
            while i < n and depth:
                if text[i] == "{":
                    depth += 1
                elif text[i] == "}":
                    depth -= 1
                i += 1
            out.append(_PLACEHOLDER_TOKEN)
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def extract_strings(rel: str, src: str) -> list[Snippet]:
    """Prose-looking string literals, tagged by the key they're assigned to."""
    snippets: list[Snippet] = []
    for m in _STRING_RE.finditer(src):
        raw = next(g for g in m.groups() if g is not None)
        value = _strip_interpolations(raw)
        value = value.replace("\\n", " ").replace('\\"', '"').replace("\\'", "'")
        value = " ".join(html.unescape(value).split())
        if not _looks_like_copy(value):
            continue
        before = src[max(0, m.start() - 60) : m.start()]
        key_match = _KEY_BEFORE.search(before.rstrip().replace("\n", " ").rstrip())
        key = key_match.group(1).lower() if key_match else ""
        if key in _DATA_KEYS:
            role = "data"
        elif key in _LABEL_KEYS:
            role = "label"
        else:
            role = "prose"
        snippets.append(
            Snippet(rel, _line_of(src, m.start()), value, raw, role, "string",
                    src=src, span=(m.start(), m.end()))
        )
    return snippets


_FENCE = re.compile(r"^\s*```")
_MD_META_KEYS = ("title", "summary", "metaTitle", "metaDescription", "description")


def extract_md(rel: str, src: str) -> list[Snippet]:
    """Markdown post copy: frontmatter titles/descriptions plus body prose."""
    snippets: list[Snippet] = []
    lines = src.split("\n")
    in_front = False
    in_fence = False
    for idx, line in enumerate(lines, start=1):
        if idx == 1 and line.strip() == "---":
            in_front = True
            continue
        if in_front:
            if line.strip() == "---":
                in_front = False
                continue
            m = re.match(r"\s*(\w+)\s*:\s*(.*)$", line)
            if m and m.group(1) in _MD_META_KEYS:
                value = m.group(2).strip().strip('"').strip("'")
                if value:
                    role = "label" if m.group(1) in ("title", "metaTitle") else "prose"
                    snippets.append(Snippet(rel, idx, value, value, role, "md"))
            continue
        if _FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence or not line.strip():
            continue
        text = line.strip()
        if text.startswith("#"):
            role = "heading"
            text = text.lstrip("#").strip()
        elif text.startswith(("- ", "* ", "|")):
            role = "list_item"
            text = text.lstrip("-* ").strip()
        else:
            role = "prose"
        # strip markdown link targets, keeping the anchor text
        text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
        if re.search(r"[A-Za-z]", text):
            snippets.append(Snippet(rel, idx, text, line.strip(), role, "md"))
    return snippets


def _rel(path: Path) -> str:
    try:
        return str(path.resolve().relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def extract_file(path: Path) -> list[Snippet]:
    rel = _rel(path)
    src = path.read_text(encoding="utf-8")
    if path.suffix == ".md":
        return extract_md(rel, src)
    stripped = strip_comments(src)
    snippets: list[Snippet] = []
    if path.suffix == ".tsx":
        snippets += extract_jsx_text(rel, stripped)
    snippets += extract_strings(rel, mask_technical(stripped))
    return snippets


# ---------------------------------------------------------------------------
# Rules
# ---------------------------------------------------------------------------

EM_DASH = "—"
_PLACEHOLDER = re.compile(r"^[\s—–(){}\[\]/|,.'\"°%$#*+-]*$")

# Finite-verb markers. If one of these turns up in the clause after a colon, the
# clause stands as a sentence and AP requires a capital.
_AUX = {
    "is", "are", "was", "were", "be", "been", "being", "am", "has", "have", "had",
    "does", "do", "did", "can", "cannot", "will", "would", "should", "could",
    "must", "may", "might", "shall", "isn't", "aren't", "wasn't", "weren't",
    "doesn't", "don't", "didn't", "hasn't", "haven't", "won't", "can't",
    "couldn't", "shouldn't", "wouldn't", "it's", "they're", "we're", "you're",
    "there's", "that's", "he's", "she's", "who's", "let's",
}
_SUBJECT_PRONOUNS = {
    "it", "they", "we", "he", "she", "you", "i", "this", "that", "these", "those",
    "there", "who", "nobody", "everybody", "anyone", "someone", "everything",
    "nothing", "one",
}
# Common finite verbs in this site's register. Not a grammar; a working list that
# catches the "verb-led clause with no auxiliary" case ("it prices the fields").
_FINITE_VERBS = {
    "adds", "applies", "beats", "becomes", "begins", "belongs", "buys", "calls",
    "carries", "changes", "clears", "comes", "costs", "counts", "covers", "cuts",
    "drops", "earns", "ends", "falls", "feels", "finds", "follows", "forfeits",
    "gets", "gives", "goes", "grades", "hands", "happens", "helps", "hits",
    "holds", "includes", "keeps", "knows", "lands", "leads", "leaves", "lets",
    "lists", "lives", "looks", "loses", "makes", "matters", "means", "measures",
    "moves", "needs", "opens", "pays", "picks", "prices", "publishes", "puts",
    "ranks", "reaches", "reads", "requires", "rises", "runs", "says", "scores",
    "sees", "sends", "shows", "sits", "sorts", "splits", "stands", "starts",
    "stays", "stops", "takes", "tells", "tracks", "turns", "uses", "wants",
    "wins", "works",
}
_DETERMINERS = {
    "the", "a", "an", "this", "that", "these", "those", "his", "her", "its",
    "our", "your", "their", "my", "no", "none", "every", "each", "some", "any",
    "all", "both", "most", "many", "few", "several", "another", "one", "two",
    "ray's", "dave's",
}
_PREPOSITIONS = {
    "of", "in", "on", "for", "with", "from", "at", "by", "to", "about",
    "between", "across", "under", "over", "into", "than", "like", "per",
    "against", "around", "near", "during", "through", "within", "past",
}
# A clause opening with one of these is dependent ("how each forecaster did"),
# not a sentence - unless a main clause follows it after a comma.
_SUBORDINATORS = {
    "how", "what", "when", "where", "why", "which", "whether", "if", "because",
    "while", "although", "though", "unless", "until", "since", "after",
    "before", "that", "whose", "whom", "as", "so",
}
_SMALL_WORDS = {
    "a", "an", "and", "the", "or", "nor", "but", "of", "for", "to", "in", "on",
    "at", "by", "vs", "with", "from", "as", "per",
}
_COLON_SKIP = re.compile(r"\d\s*:\s*\d|https?:|mailto:")


def _words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z][A-Za-z'’]*", text)


def _is_enumeration(clause: str) -> bool:
    """A list of items ("slugs, names, coordinates") rather than a clause.

    Two or more commas whose first item doesn't stand alone as a sentence. AP
    keeps enumerations lowercase after a colon, so these are never errors.
    """
    head = re.split(r"(?<=[.!?])\s", clause)[0]
    if head.count(",") < 2:
        return False
    first_item = head.split(",")[0]
    return not _clause_is_sentence(first_item, allow_enumeration=False)


_RELATIVIZERS = {"that", "which", "who", "whose", "whom"}
# An opening bare verb is an imperative, and the styleguide names imperatives
# explicitly: they take a capital after a colon like any other sentence.
_IMPERATIVE_OPENERS = {
    "add", "avoid", "bring", "build", "capture", "check", "choose", "click",
    "compare", "consider", "download", "drive", "expect", "find", "follow",
    "get", "give", "go", "grade", "head", "keep", "know", "leave", "look",
    "make", "note", "open", "pack", "pick", "plan", "predict", "print", "put",
    "read", "remember", "save", "see", "send", "set", "skip", "stay",
    "stop", "take", "tap", "tell", "treat", "try", "turn", "use", "visit",
    "wait", "watch", "wear", "write",
}
# What can legitimately follow an imperative verb. Without this, a noun compound
# ("start times, computed") reads as a command.
_IMPERATIVE_FOLLOWERS = _DETERMINERS | _PREPOSITIONS | {
    "it", "them", "us", "you", "me", "your", "how", "what", "when", "where",
    "why", "again", "here", "there", "back", "out", "up", "down", "not",
}


def _has_finite_core(words: list[str]) -> bool:
    """Subject + finite verb, as far as a word list can tell.

    Deliberately conservative, because the error tier has to be trustworthy:
    - a finite verb only counts when something follows it, since the same tokens
      double as plural nouns in final position ("daily accuracy scores for Boone");
    - it needs exactly one free determiner ahead of it, so a noun phrase carrying
      a relative clause ("the minute the ridgeline takes the sun off") reads as
      the fragment it is, while "the credibility of the comparison depends on X"
      (second determiner governed by a preposition) still reads as a sentence;
    - an auxiliary right after a relativizer is a relative clause, not a main verb.
    """
    if len(words) < 2:
        return False
    if words[0] in _IMPERATIVE_OPENERS and words[1] in _IMPERATIVE_FOLLOWERS:
        return True
    if len(words) < 3:
        return False
    window = words[:14]
    for i, word in enumerate(window[:-1]):
        if word in _AUX and (i == 0 or window[i - 1] not in _RELATIVIZERS):
            return True
    if words[0] in _SUBJECT_PRONOUNS:
        return True
    free_dets = [
        i
        for i, w in enumerate(window)
        if w in _DETERMINERS and (i == 0 or window[i - 1] not in _PREPOSITIONS)
    ]
    for i, word in enumerate(window[:-1]):
        if word in _FINITE_VERBS and len([d for d in free_dets if d < i]) == 1:
            return True
    return False


def _clause_is_sentence(clause: str, allow_enumeration: bool = True) -> bool:
    """Heuristic: does this clause stand as a complete sentence?"""
    if allow_enumeration and _is_enumeration(clause):
        return False
    head = re.split(r"[.;!?]", clause)[0]
    words = [w.lower().replace("’", "'") for w in _words(head)]
    if not words:
        return False
    if words[0] in _SUBORDINATORS:
        # dependent opener: only a main clause after a comma makes it a sentence
        for tail in head.split(",")[1:]:
            tail_words = [w.lower().replace("’", "'") for w in _words(tail)]
            if tail_words and tail_words[0] not in _SUBORDINATORS and _has_finite_core(tail_words):
                return True
        return False
    return _has_finite_core(words)


def _prose_colons(text: str) -> list[tuple[int, str, str]]:
    """(index, left-side, right-side) for each sentence-internal colon."""
    out = []
    for m in re.finditer(r":", text):
        i = m.start()
        if _COLON_SKIP.search(text[max(0, i - 6) : i + 3]):
            continue
        right = text[i + 1 :].strip()
        if not right:  # trailing colon introducing a list or table below
            continue
        out.append((i, text[:i], right))
    return out


def _colon_line(s: Snippet, right: str) -> int:
    """Point the finding at the colon itself, not the top of the paragraph."""
    words = _words(right)
    if not words:
        return s.line
    return s.line_of(r":\s*(?:&\w+;\s*)*" + re.escape(words[0]))


def rule_colons(snips: list[Snippet]) -> list[Finding]:
    findings: list[Finding] = []
    per_file: dict[str, int] = {}
    last_line: dict[str, int] = {}
    for s in snips:
        if s.role == "data":
            continue
        for _i, left, right in _prose_colons(s.text):
            # The budget is a body-prose rule. A list of grade bands
            # ("90-100: Right (5 rays)") and a "Title: Subtitle" are not the
            # skeleton the styleguide is counting.
            if s.role == "prose":
                per_file[s.path] = per_file.get(s.path, 0) + 1
                last_line[s.path] = s.line
            label_side = re.split(r"[.;!?]", left)[-1].strip()
            label_words = _words(label_side)
            is_label = 0 < len(label_words) <= 4 and not _clause_is_sentence(left)
            line = _colon_line(s, right)
            if is_label and label_side[:1].islower() and s.role in ("prose", "list_item"):
                findings.append(
                    Finding(
                        s.path, line, "COLON_LABEL", "error",
                        f'lowercase label in a "label: value" skeleton - capitalize it '
                        f'or restructure: "{label_side}: {right[:40]}"',
                        s.text,
                    )
                )
                continue
            if not right[0].islower():
                continue
            if _clause_is_sentence(right):
                findings.append(
                    Finding(
                        s.path, line, "COLON_SENTENCE", "error",
                        "a complete sentence after a colon takes a capital (AP): "
                        f'"...: {right[:60]}"',
                        s.text,
                    )
                )
            elif is_label and s.role in ("prose", "list_item"):
                findings.append(
                    Finding(
                        s.path, line, "COLON_SKELETON", "warn",
                        f'"label: value" skeleton - the styleguide calls this a machine '
                        f'fingerprint; most read better as a sentence: "{label_side}: {right[:40]}"',
                        s.text,
                    )
                )
            else:
                findings.append(
                    Finding(
                        s.path, line, "COLON_FRAGMENT", "warn",
                        "lowercase after a colon - correct only for a genuine fragment "
                        f'or enumeration: "...: {right[:60]}"',
                        s.text,
                    )
                )
    for path, count in sorted(per_file.items()):
        # Warn only, deliberately: the shared validator warns rather than errors
        # on colon count too, and a long franchise page legitimately runs past
        # an article's budget. The blocking colon rules are the case rules above.
        if count > 3:
            findings.append(
                Finding(path, last_line[path], "COLON_BUDGET", "warn",
                        f"{count} sentence-internal colons in this file's body prose "
                        "(styleguide budget is 2-3) - restructure most as sentences", "")
            )
    return findings


def rule_emdash(snips: list[Snippet]) -> list[Finding]:
    findings: list[Finding] = []
    md_words: dict[str, int] = {}
    md_dashes: dict[str, list[int]] = {}
    for s in snips:
        if s.origin == "md":
            md_words[s.path] = md_words.get(s.path, 0) + len(_words(s.text))
        if EM_DASH not in s.text:
            continue
        if s.origin == "md":
            md_dashes.setdefault(s.path, []).extend([s.line] * s.text.count(EM_DASH))
            continue
        if _PLACEHOLDER.match(s.text):
            continue  # empty-cell placeholder, e.g. `${hi ?? "-"}`
        for nth in range(s.text.count(EM_DASH)):
            findings.append(
                Finding(
                    s.path, s.line_of(r"—|&mdash;|&#8212;", nth), "EMDASH", "error",
                    "em-dash in UI copy - use a period, comma, or colon "
                    f'(empty-cell placeholders excepted): "{s.text[:70]}"',
                    s.text,
                )
            )
    for path, lines in md_dashes.items():
        allowed = max(1, md_words.get(path, 0) // 200)
        if len(lines) > allowed:
            findings.append(
                Finding(path, lines[0], "EMDASH_DENSITY", "warn",
                        f"{len(lines)} em-dashes in ~{md_words.get(path, 0)} words "
                        f"(ceiling is 1 per 200 words = {allowed})", "")
            )
    return findings


def _title_case_violations(label: str) -> list[str]:
    bad = []
    words = re.split(r"[\s/]+", label.strip())
    for i, word in enumerate(words):
        core = word.strip("(),.:;’'\"&")
        if not core or not core[0].isalpha():
            continue
        if core[0].isupper():
            continue
        if i > 0 and core.lower() in _SMALL_WORDS:
            continue
        bad.append(core)
    return bad


NAV_LABEL_SETS = [
    ("src/components/SiteHeader.tsx", "primary"),
    ("src/components/SiteHeader.tsx", "resources"),
    ("src/content/resources.ts", "CATEGORIES"),
]


def _array_body(src: str, name: str) -> tuple[str, int] | None:
    m = re.search(rf"\b(?:const|let|var)\s+{re.escape(name)}\b[^=]*=\s*\[", src)
    if not m:
        return None
    start = m.end()
    depth, i = 1, start
    while i < len(src) and depth:
        if src[i] == "[":
            depth += 1
        elif src[i] == "]":
            depth -= 1
        i += 1
    return src[start : i - 1], start


def rule_nav_case(files: list[Path]) -> list[Finding]:
    """Nav and category label sets must be uniformly Title Case."""
    findings: list[Finding] = []
    by_rel = {_rel(p): p for p in files}
    for rel, name in NAV_LABEL_SETS:
        path = by_rel.get(rel)
        if path is None:
            continue
        src = strip_comments(path.read_text(encoding="utf-8"))
        found = _array_body(src, name)
        if not found:
            findings.append(
                Finding(rel, 1, "NAV_CASE", "error",
                        f"label set `{name}` not found - copy_lint's nav check is wired "
                        "to it; update NAV_LABEL_SETS if it was renamed", "")
            )
            continue
        body, offset = found
        for m in re.finditer(r'label\s*:\s*"([^"]+)"', body):
            label = m.group(1)
            bad = _title_case_violations(label)
            if bad:
                findings.append(
                    Finding(rel, _line_of(src, offset + m.start()), "NAV_CASE", "error",
                            f'"{label}" breaks Title Case among its `{name}` siblings '
                            f"(lowercase: {', '.join(bad)})", label)
                )
    return findings


# A domain, URL, or handle keeps its own casing.
_DOMAINISH = re.compile(r"^(?:https?://|www\.|@)|^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$")


def rule_label_case(snips: list[Snippet]) -> list[Finding]:
    """Labels, table cells, and stat captions start capitalized.

    Sibling label sets drift out of case agreement one edit at a time (the
    /right-wrong-ray stat row read "season avg / 100 | graded Right | days
    scored"). Requiring a capital on every one of them keeps a set consistent
    by construction, which is the only version of "consistent" a linter can
    enforce without guessing which sibling is the odd one out.
    """
    findings: list[Finding] = []
    for s in snips:
        if s.origin != "jsx" or not s.text[:1].islower():
            continue
        if s.role == "cell" and s.cell_first and s.parent in _CELL_TAGS:
            findings.append(
                Finding(s.path, s.line, "CELL_CASE", "error",
                        f'table cell starts lowercase - cells are labels, not sentence '
                        f'continuations: "{s.text[:60]}"', s.text))
        elif (
            s.parent == "div"
            and s.solitary
            and len(s.text.split()) <= 6
            and s.text[-1] not in ".?!:"
            and not _DOMAINISH.match(s.text)
        ):
            findings.append(
                Finding(s.path, s.line, "CAPTION_CASE", "error",
                        f'caption/label starts lowercase - capitalize it so a sibling set '
                        f'stays consistent: "{s.text[:60]}"', s.text))
    return findings


# Elements that carry their own horizontal spacing, or sit in a flex/grid row
# that spaces them, don't need a text space between them.
_SPACING_CLASS = re.compile(r"\b(?:mx|mr|ml|px|pr|pl|gap|gap-x|space-x)-")
_LAID_OUT = re.compile(r"\b(?:flex|grid|gap-|space-x-|justify-|items-)")
_WORDY = re.compile(r"[A-Za-z0-9]")
_ENTITY = re.compile(r"&(?:[A-Za-z][A-Za-z0-9]*|#\d+);")


def _spacing_finding(rel: str, src: str, pos: int, message: str) -> Finding:
    context = " ".join(src[max(0, pos - 45) : pos + 45].split())
    return Finding(rel, _line_of(src, pos), "JSX_SPACING", "error",
                   f'{message} - insert an explicit {{" "}}: "{context}"', "")


def rule_jsx_spacing(files: list[Path]) -> list[Finding]:
    """Words that run together at an element boundary.

    JSX strips whitespace that touches a newline, so `</span>\\n(the bold line)`
    ships as "Index(the bold line)" and `as a\\n<em>range</em>` ships as
    "as arange". Both have reached production. The fix is an explicit `{" "}`.

    Exempt: a boundary where CSS already provides the gap (the element carries
    its own margin/padding, or its parent is a flex/grid row).
    """
    findings: list[Finding] = []
    for path in files:
        if path.suffix != ".tsx":
            continue
        rel = _rel(path)
        src = strip_comments(path.read_text(encoding="utf-8"))
        stack: list[tuple[str, str]] = []
        opaque = 0
        prev_end = 0
        prev_tag: tuple[str, str, bool] | None = None  # name, attrs, was_closing
        for m in _TAG_RE.finditer(src):
            chunk = src[prev_end : m.start()]
            closing, name, attrs, self_closing = m.groups()
            parent_attrs = stack[-1][1] if stack else ""
            laid_out = bool(_LAID_OUT.search(parent_attrs))
            if not opaque and chunk and _WORDY.search(chunk):
                # A text node that carries an HTML entity AND wraps across lines
                # loses its LEADING space in this toolchain, so `</em> is scored
                # ... 5&ndash;15 mph` ships as "rangeis scored" even though the
                # source has a space. A single-line node keeps it. Verified
                # against a production build, Next 16 / SWC, 2026-07-28.
                # An interpolation splits the run into separate text nodes, so
                # only the segment up to the first `{` is the node in question.
                first_node = chunk.split("{", 1)[0]
                if (
                    prev_tag
                    and (prev_tag[2] or prev_tag[0] not in _STACK_TAGS)
                    and first_node[:1] == " "
                    and _ENTITY.search(first_node)
                    and "\n" in first_node
                ):
                    findings.append(_spacing_finding(
                        rel, src, prev_end,
                        f"the space after </{prev_tag[0]}> is dropped at build time "
                        "(this text node carries an HTML entity and wraps lines)"))
                # left boundary: a closing tag running into this text
                elif prev_tag and prev_tag[2]:
                    head = chunk[: len(chunk) - len(chunk.lstrip())]
                    body = chunk.lstrip()
                    joined = head == "" or "\n" in head
                    if (
                        joined
                        and body[:1]
                        and (body[0].isalnum() or body[0] == "(")
                        and not _SPACING_CLASS.search(prev_tag[1])
                        and not laid_out
                    ):
                        findings.append(_spacing_finding(
                            rel, src, prev_end,
                            f"</{prev_tag[0]}> runs into the next word"))
                # right boundary: this text running into an opening inline tag
                if (
                    not closing
                    and name in _INLINE_TAGS
                    and chunk.rstrip()[-1:].isalnum()
                    and "\n" in chunk[len(chunk.rstrip()) :]
                    and not _SPACING_CLASS.search(attrs)
                    and not laid_out
                ):
                    findings.append(_spacing_finding(
                        rel, src, m.start(), f"text runs into <{name}>"))
            if name in _OPAQUE_TAGS and not self_closing:
                opaque = max(0, opaque - 1) if closing else opaque + 1
            closed_attrs = attrs
            if name in _STACK_TAGS:
                if closing:
                    if name in [s[0] for s in stack]:
                        while stack:
                            popped = stack.pop()
                            if popped[0] == name:
                                # the element's own classes, not the closing tag's
                                closed_attrs = popped[1]
                                break
                elif not self_closing:
                    stack.append((name, attrs))
            prev_tag = (name, closed_attrs, bool(closing))
            prev_end = m.end()
    return findings


# Straight quotes render as straight marks in the display face; the owner
# caught `What counts as &quot;actual&quot;` shipping with slanted marks on
# both sides. Markdown gets smart quotes from marked-smartypants at render;
# JSX gets nothing, so it has to be written with the real entities.
_STRAIGHT_QUOTE = re.compile(r"&quot;|&#0*34;|\"")


def rule_jsx_quotes(snips: list[Snippet]) -> list[Finding]:
    findings: list[Finding] = []
    for s in snips:
        if s.origin != "jsx":
            continue
        seg = s.src[s.span[0] : s.span[1]] if s.src else s.raw
        # `{" "}` spacers are code, not copy; blank them without moving offsets
        seg = _JSX_EXPR.sub(lambda m: " " * len(m.group(0)), seg)
        for m in _STRAIGHT_QUOTE.finditer(seg):
            findings.append(
                Finding(s.path, _line_of(s.src, s.span[0] + m.start()) if s.src else s.line,
                        "JSX_QUOTES", "error",
                        "straight quote in rendered text - use &ldquo;/&rdquo; (nothing "
                        f'converts quotes in JSX): "{s.text[:60]}"', s.text))
    return findings


def rule_vocab(snips: list[Snippet], terms: list[tuple[str, str]]) -> list[Finding]:
    findings: list[Finding] = []
    for s in snips:
        low = s.text.lower()
        for term, category in terms:
            if term not in low:
                continue
            if re.search(rf"(?<![\w-]){re.escape(term)}(?![\w-])", low):
                findings.append(
                    Finding(s.path, s.line, "VOCAB", "error",
                            f'banned term "{term}" ({category}) in user-facing copy: '
                            f'"{s.text[:70]}"', s.text)
                )
    return findings


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


def _wanted(path: Path) -> bool:
    if path.suffix not in SRC_SUFFIXES or path.name in EXCLUDE_NAMES:
        return False
    rel = _rel(path).replace(os.sep, "/")
    return not any(part in rel.split("/") or rel.startswith(part) for part in EXCLUDE_DIRS)


def default_targets() -> list[Path]:
    return [REPO_ROOT / t for t in DEFAULT_TARGETS if (REPO_ROOT / t).exists()]


def iter_files(paths: list[Path]) -> list[Path]:
    out: list[Path] = []
    for p in paths:
        if p.is_dir():
            out.extend(sub for sub in sorted(p.rglob("*")) if _wanted(sub))
        elif _wanted(p):
            out.append(p)
    return out


def lint(paths: list[Path], rules: dict | None = None) -> list[Finding]:
    rules = rules if rules is not None else load_style_rules()
    terms = banned_terms(rules)
    files = iter_files(paths)
    snips: list[Snippet] = []
    for path in files:
        snips.extend(extract_file(path))
    findings = rule_colons(snips) + rule_emdash(snips) + rule_vocab(snips, terms)
    findings += rule_label_case(snips) + rule_jsx_quotes(snips)
    findings += rule_nav_case(files) + rule_jsx_spacing(files)
    return sorted(findings, key=lambda f: (f.path, f.line, f.code))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("paths", nargs="*", help="files or dirs (default: the shipped copy)")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    ap.add_argument("--dump", action="store_true", help="print every extracted string")
    ap.add_argument("--warnings-as-errors", action="store_true")
    args = ap.parse_args(argv)

    targets = (
        [Path(p) if Path(p).is_absolute() else Path.cwd() / p for p in args.paths]
        if args.paths
        else default_targets()
    )

    if args.dump:
        for path in iter_files(targets):
            for s in extract_file(path):
                print(f"{s.path}:{s.line}\t[{s.origin}/{s.role}]\t{s.text}")
        return 0

    findings = lint(targets)
    errors = [f for f in findings if f.severity == "error"]
    warns = [f for f in findings if f.severity == "warn"]

    if args.json:
        print(json.dumps([f.__dict__ for f in findings], indent=2))
    else:
        for f in findings:
            mark = "ERROR" if f.severity == "error" else "warn "
            print(f"{mark} {f.path}:{f.line} [{f.code}] {f.message}")
        print(f"\n{len(errors)} error(s), {len(warns)} warning(s)")
        if errors:
            print("Copy fails the styleguide. See guidelines/seo/DS_WRITING_QUALITY.md.")

    return 1 if errors or (args.warnings_as_errors and warns) else 0


if __name__ == "__main__":
    sys.exit(main())
