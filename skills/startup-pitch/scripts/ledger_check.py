#!/usr/bin/env python3
"""ledger_check.py: verify pitch/facts.yaml, and optionally the deck and corpus against it.

Run `ledger_check.py --explain` for the matching rules in 40 lines. In short:

  (a) every entry has id, label, value, unit, kind in {fact, assumption, projection}
      and status in {confirmed, unverified, conflicting}; ids are unique. A string
      value is fine when unit is `text`.
  (b) every kind: fact has a source or a derived_from
  (c) every derived_from expression (ids, numeric literals, + - * / ^ and
      parentheses) recomputes to within 1 percent of value
  (d) conflicts_with pairs both carry status: conflicting
  (e) identity checks, only when the conventional ids or role: values exist
      (arr = mrr * 12, net_revenue = gmv * take_rate, runway = cash / net_burn,
      growth multiple = last / first of its series, use of funds sums, tam >= sam
      >= som, cac payback, headcount cost <= burn); each prints a plain-English
      question when it fails
  (f) staleness: a source dated more than 18 months before as_of, or in old/
  (g) --deck: figures on slides trace to ledger entries (rule in --help)
  (h) --corpus: each source file exists and, unless the entry is computed,
      derived or text, the value's digits appear in the extracted source text

The YAML subset in references/file-formats.md is parsed without PyYAML. If the
built-in parser cannot read the file and PyYAML or uv is available they are
tried as fallbacks, but neither is required.

Usage:
  ledger_check.py pitch/facts.yaml [--deck pitch/deck/deck.json] [--corpus pitch/intake/corpus]
                  [--root <startup-folder>] [--inventory pitch/intake/inventory.json]
  ledger_check.py --explain

Exit codes: 0 all checks PASS or WARN, 1 at least one FAIL, 2 usage error.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path, PurePosixPath

KINDS = {"fact", "assumption", "projection"}
STATUSES = {"confirmed", "unverified", "conflicting"}
REL_TOL = 0.01
STALE_MONTHS = 18

DECK_RULE = """\
deck tracing rule (--deck):
  must trace, FAIL if not   every stats[].value, every chart series value, use_of_funds pct or amount
  must trace, WARN if not   a number in title, subtitle, points, body or a table cell that carries a
                            currency symbol or code, a percent, a multiple (2.1x), a magnitude suffix
                            (k, M, B, bn, m) or is 1,000 or larger
  ignored                   years and dates (8 Nov 2026, Q3 2026, 2027), plain counts and durations under
                            1,000 (24 months, 3 sites, top 5), anything in notes, question, kicker or label,
                            and cover, closing or statement slides that have no stats
  traced means              the slide, chart or stat cites `source: fact:<id>` (assumption: and projection:
                            prefixes also work) and one cited entry rounds to the displayed number
  stat or chart value       no source anywhere on the slide: FAIL. In no ledger entry: FAIL. Only in an
                            entry the slide does not cite: WARN that names the id to add
  figure in text            passes when any ledger entry has the value
  a slide without figures needs no source"""

EXPLAIN = """\
How ledger_check.py matches

ENTRIES
  Record the numbers an output cites, plus both sides of every conflict. Nothing else is required.
  value         a number, a list of numbers (a series), or a string when `unit: text` (never number-checked)
  kind: fact    needs `source` or `derived_from`; assumptions and projections want source, method or assumes
  source        a file path with optional #locator, or `founder statement, <date>` for something said in chat
  derived_from  ids, numeric literals, + - * / ^ and parentheses: (41200 / 4100) ^ (1 / 21) - 1
                literals are fine, so no helper entries are needed; recomputed within 1 percent
  computed: true (or a non-empty `method:`) marks a value you computed from the source file (sum, count,
                average); the corpus check then confirms the file exists and does not look for the digits
  conflicts_with  both entries must be `status: conflicting`

IDENTITIES  run only when these ids (or `role: <name>`) exist; a conflicting entry, or one with
  `open_question: <text>` (an issue the founder knows is open), turns FAIL into WARN
  mrr_current, arr_current                       arr = mrr x 12
  gmv_current, take_rate, net_revenue            net_revenue = gmv x take_rate
  cash, net_burn, runway_months                  runway_months = cash / net_burn
  <m>_growth_multiple or <m>_yoy_multiple        value = last / first of `series: <id>` (`window: n` periods)
  use_of_funds_<bucket>_pct, _amount, ask        pct sum to 100, amounts sum to ask, amount = pct x ask
  tam, sam, som                                  tam >= sam >= som
  cac, acv, gross_margin, cac_payback_months     payback = cac / (acv x gross_margin / 12)
  headcount, avg_cost_per_head, gross_burn       headcount x cost <= gross_burn (plus 10 percent)
  Any other id is never identity-checked.

UNITS  used to match deck figures; the sign is ignored
  ratio, fraction     0.34 matches "34%", "-34%", "34 percent" and "0.34"
  percent, %          34 matches "34%" and "34 percent"
  x, multiple         2.15 matches "2.15x" and "2.2x"
  currency units      41200 EUR/month matches "EUR 41.2k", "41,200" and a chart value of 41.2
  A figure matches when the entry rounds to what is displayed, at most 3 percent away.

DECK TRACING  (--deck)
  FAIL if untraced    every stats[].value, every chart series value, use_of_funds pct or amount
  WARN if untraced    numbers in title, subtitle, points, body or table cells with a currency, a percent,
                      a multiple (2.1x), a magnitude suffix (k, M, B, bn, m), or 1,000 and above
  ignored             years and dates, plain counts and durations under 1,000 ("24 months", "3 sites"),
                      notes, question, kicker and label, and cover, closing or statement slides without stats
  Traced: the slide, chart or stat cites `source: fact:<id>` and a cited entry has that value. A stat or
  chart value found only in an uncited entry is a WARN naming the id; a text figure passes when any entry
  has it. A slide without figures needs no source."""

# Conventional ids -> roles. A role: field on a fact overrides this table.
CONVENTIONAL_IDS = {
    "mrr": "mrr", "mrr_current": "mrr", "mrr_latest": "mrr",
    "arr": "arr", "arr_current": "arr", "arr_run_rate": "arr", "arr_runrate": "arr",
    "gmv": "gmv", "gmv_current": "gmv", "gmv_quarter": "gmv", "gmv_latest_quarter": "gmv",
    "take_rate": "take_rate", "platform_fee": "take_rate",
    "net_revenue": "net_revenue", "net_revenue_current": "net_revenue", "net_revenue_quarter": "net_revenue",
    "cash": "cash", "cash_current": "cash", "cash_in_bank": "cash",
    "net_burn": "net_burn", "net_burn_monthly": "net_burn",
    "gross_burn": "gross_burn", "burn": "gross_burn", "burn_monthly": "gross_burn", "opex_monthly": "gross_burn",
    "runway_months": "runway_months", "runway": "runway_months",
    "ask": "ask", "raise": "ask", "raise_amount": "ask", "round_size": "ask",
    "tam": "tam", "sam": "sam", "som": "som",
    "cac": "cac", "cac_blended": "cac",
    "acv": "acv", "acv_avg": "acv", "acv_average": "acv",
    "gross_margin": "gross_margin",
    "cac_payback_months": "cac_payback_months", "cac_payback": "cac_payback_months",
    "headcount": "headcount", "team_size": "headcount",
    "avg_cost_per_head": "avg_cost_per_head", "cost_per_head": "avg_cost_per_head",
}
ID_PATTERNS = [
    (re.compile(r"^use_of_funds_.+_pct$"), "use_of_funds_pct"),
    (re.compile(r"^use_of_funds_.+_percent$"), "use_of_funds_pct"),
    (re.compile(r"^use_of_funds_.+_amount$"), "use_of_funds_amount"),
    (re.compile(r"^(.+)_growth_multiple$"), "growth_multiple"),
    (re.compile(r"^(.+)_yoy_multiple$"), "growth_multiple"),
]


# ----------------------------------------------------------------------------
# Minimal YAML parser (the subset used by facts.yaml)
# ----------------------------------------------------------------------------

class YamlError(ValueError):
    pass


def _strip_comment(line: str) -> str:
    out, quote = [], None
    for i, ch in enumerate(line):
        if quote:
            out.append(ch)
            if ch == quote:
                quote = None
            continue
        if ch in ("'", '"'):
            quote = ch
            out.append(ch)
            continue
        if ch == "#" and (i == 0 or line[i - 1] in " \t"):
            break
        out.append(ch)
    return "".join(out).rstrip()


def _scalar(text: str):
    t = text.strip()
    if t == "" or t in ("~", "null", "Null", "NULL"):
        return None
    if len(t) >= 2 and t[0] == t[-1] and t[0] in ("'", '"'):
        inner = t[1:-1]
        if t[0] == '"':
            inner = inner.encode("utf-8").decode("unicode_escape") if "\\" in inner else inner
        else:
            inner = inner.replace("''", "'")
        return inner
    if t.startswith("[") and t.endswith("]"):
        return [_scalar(p) for p in _split_inline(t[1:-1])]
    if t.startswith("{") and t.endswith("}"):
        result = {}
        for part in _split_inline(t[1:-1]):
            if ":" in part:
                k, v = part.split(":", 1)
                result[k.strip()] = _scalar(v)
        return result
    low = t.lower()
    if low in ("true", "yes", "on"):
        return True
    if low in ("false", "no", "off"):
        return False
    if re.fullmatch(r"[-+]?\d+", t):
        return int(t)
    if re.fullmatch(r"[-+]?\d[\d_]*", t) and "_" in t:
        return int(t.replace("_", ""))
    if re.fullmatch(r"[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?", t):
        return float(t)
    return t


def _split_inline(text: str) -> list[str]:
    parts, buf, quote, depth = [], [], None, 0
    for ch in text:
        if quote:
            buf.append(ch)
            if ch == quote:
                quote = None
        elif ch in ("'", '"'):
            quote = ch
            buf.append(ch)
        elif ch in "[{":
            depth += 1
            buf.append(ch)
        elif ch in "]}":
            depth -= 1
            buf.append(ch)
        elif ch == "," and depth == 0:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    if "".join(buf).strip():
        parts.append("".join(buf))
    return [p for p in parts if p.strip()]


KEY_RE = re.compile(r"^([A-Za-z0-9_.\-/ ]+?|\"[^\"]+\"|'[^']+')\s*:(?:\s+(.*))?$")


def parse_yaml(text: str):
    raw_lines = text.splitlines()
    lines: list[tuple[int, str, int]] = []  # (indent, content, line number)
    for n, raw in enumerate(raw_lines, 1):
        if raw.strip() in ("---", "..."):
            continue
        content = _strip_comment(raw.replace("\t", "    "))
        if not content.strip():
            continue
        indent = len(content) - len(content.lstrip(" "))
        lines.append((indent, content.strip(), n))
    if not lines:
        return {}
    value, i = _parse_node(lines, 0, lines[0][0], raw_lines)
    if i != len(lines):
        raise YamlError(f"line {lines[i][2]}: unexpected content '{lines[i][1]}'")
    return value


def _block_scalar(lines, i, parent_indent, style, raw_lines) -> tuple[str, int]:
    collected = []
    while i < len(lines) and lines[i][0] > parent_indent:
        collected.append(lines[i][1])
        i += 1
    joiner = "\n" if style == "|" else " "
    return joiner.join(collected), i


def _parse_node(lines, i, indent, raw_lines):
    if lines[i][1].startswith("- ") or lines[i][1] == "-":
        return _parse_list(lines, i, indent, raw_lines)
    return _parse_mapping(lines, i, indent, raw_lines)


def _parse_list(lines, i, indent, raw_lines):
    items = []
    while i < len(lines) and lines[i][0] == indent and (lines[i][1].startswith("- ") or lines[i][1] == "-"):
        ind, content, n = lines[i]
        rest = content[1:].strip()
        if not rest:
            i += 1
            if i < len(lines) and lines[i][0] > indent:
                value, i = _parse_node(lines, i, lines[i][0], raw_lines)
                items.append(value)
            else:
                items.append(None)
            continue
        m = KEY_RE.match(rest)
        if m and not rest.startswith(("[", "{", "'", '"')):
            # mapping whose first key sits on the dash line; later keys align with it
            child_indent = indent + (len(content) - len(rest))
            lines[i] = (child_indent, rest, n)
            value, i = _parse_mapping(lines, i, child_indent, raw_lines)
            items.append(value)
        else:
            items.append(_scalar(rest))
            i += 1
    return items, i


def _parse_mapping(lines, i, indent, raw_lines):
    result: dict = {}
    while i < len(lines) and lines[i][0] == indent:
        ind, content, n = lines[i]
        if content.startswith("- ") or content == "-":
            break
        m = KEY_RE.match(content)
        if not m:
            raise YamlError(f"line {n}: expected 'key: value', got '{content}'")
        key = m.group(1).strip().strip("'\"")
        rest = (m.group(2) or "").strip()
        i += 1
        # a flow list or mapping may continue over several indented lines
        while (rest.count("[") > rest.count("]") or rest.count("{") > rest.count("}")) \
                and i < len(lines) and lines[i][0] > indent:
            rest += " " + lines[i][1]
            i += 1
        if rest in ("|", ">", "|-", ">-", "|+", ">+"):
            value, i = _block_scalar(lines, i, indent, rest[0], raw_lines)
            result[key] = value
        elif rest == "":
            if i < len(lines) and (lines[i][0] > indent or (
                    lines[i][0] == indent and (lines[i][1].startswith("- ") or lines[i][1] == "-"))):
                value, i = _parse_node(lines, i, lines[i][0], raw_lines)
                result[key] = value
            else:
                result[key] = None
        else:
            result[key] = _scalar(rest)
    if i < len(lines) and lines[i][0] > indent:
        raise YamlError(f"line {lines[i][2]}: unexpected indentation")
    return result, i


def load_yaml(path: Path):
    text = path.read_text(encoding="utf-8")
    try:
        return parse_yaml(text), "built-in parser"
    except YamlError as exc:
        first_error = exc
    try:
        import yaml  # type: ignore
        return yaml.safe_load(text), "PyYAML"
    except ImportError:
        pass
    uv = shutil.which("uv")
    if uv:
        code = "import sys, json, yaml; print(json.dumps(yaml.safe_load(sys.stdin.read())))"
        try:
            res = subprocess.run([uv, "run", "--quiet", "--with", "pyyaml", "python", "-c", code],
                                 input=text, capture_output=True, text=True, timeout=120)
            if res.returncode == 0:
                return json.loads(res.stdout), "uv run --with pyyaml"
        except (subprocess.SubprocessError, json.JSONDecodeError):
            pass
    raise YamlError(f"{first_error} (PyYAML fallback unavailable)")


# ----------------------------------------------------------------------------
# Report
# ----------------------------------------------------------------------------

class Report:
    def __init__(self):
        self.sections: list[tuple[str, str, list[str]]] = []

    def add(self, title: str, items: list[tuple[str, str]], pass_text: str = "all good"):
        """items: list of (level, message) where level is WARN or FAIL."""
        level = "PASS"
        if any(l == "FAIL" for l, _ in items):
            level = "FAIL"
        elif any(l == "WARN" for l, _ in items):
            level = "WARN"
        lines = [f"- {l}: {m}" for l, m in items if l != "INFO"] or [f"- {pass_text}"]
        lines += [f"- {m}" for l, m in items if l == "INFO"]
        self.sections.append((title, level, lines))

    def render(self, header: list[str]) -> tuple[str, bool]:
        fails = sum(1 for _, l, _ in self.sections if l == "FAIL")
        warns = sum(1 for _, l, _ in self.sections if l == "WARN")
        out = ["# Ledger check", ""] + header + [""]
        for title, level, lines in self.sections:
            out.append(f"## {title}: {level}")
            out.append("")
            out.extend(lines)
            out.append("")
        verdict = "FAIL" if fails else ("WARN" if warns else "PASS")
        out.append(f"## Verdict: {verdict} ({fails} FAIL, {warns} WARN, "
                   f"{len(self.sections) - fails - warns} PASS)")
        return "\n".join(out) + "\n", fails > 0


# ----------------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------------

def num(v) -> float | None:
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        t = v.strip().replace(",", "").replace("_", "")
        t = re.sub(r"^[^\d\-+.]+", "", t).rstrip("%").strip()
        try:
            return float(t)
        except ValueError:
            return None
    return None


def close(a: float, b: float, rel: float = REL_TOL, abs_tol: float = 0.0) -> bool:
    if a == b:
        return True
    return abs(a - b) <= max(rel * max(abs(a), abs(b)), abs_tol)


def pct_off(a: float, b: float) -> str:
    if b == 0:
        return "n/a"
    return f"{abs(a - b) / abs(b) * 100:.1f} percent"


def fmt(v) -> str:
    if isinstance(v, float):
        if math.isfinite(v) and v == int(v) and abs(v) < 1e15:
            return f"{int(v):,}"
        return f"{v:,.4g}" if abs(v) >= 1000 else f"{v:.4g}"
    if isinstance(v, int):
        return f"{v:,}"
    return str(v)


def as_list(v) -> list:
    if v is None:
        return []
    return list(v) if isinstance(v, (list, tuple)) else [v]


def as_fraction(v: float) -> float:
    """Rates given as 22 or 0.22 both mean 22 percent."""
    return v / 100.0 if v > 1.0 else v


def source_file(fact: dict) -> str | None:
    src = fact.get("source")
    if not isinstance(src, str) or not src.strip():
        return None
    # "founder statement, 2026-11-10" is a valid source for something the founder said in the
    # conversation; there is no file to look for.
    if src.strip().lower().startswith("founder statement"):
        return None
    return src.split("#", 1)[0].strip()


MONTH_NAMES = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


def name_date(stem: str) -> dt.date | None:
    low = stem.lower()
    m = re.search(r"(?<!\d)(20\d\d)[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?!\d)", low)
    if m:
        return dt.date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    m = re.search(r"(?<!\d)(20\d\d)[-_.](0[1-9]|1[0-2])(?!\d)", low)
    if m:
        return dt.date(int(m.group(1)), int(m.group(2)), 1)
    m = re.search(r"(?<!\d)(20\d\d)[-_ ]?q([1-4])(?!\d)", low) or re.search(r"(?<![a-z])q([1-4])[-_ ]?(20\d\d)", low)
    if m:
        y, q = (m.group(1), m.group(2)) if len(m.group(1)) == 4 else (m.group(2), m.group(1))
        return dt.date(int(y), int(q) * 3, 1)
    months = "|".join(["jan(?:uary)?", "feb(?:ruary)?", "mar(?:ch)?", "apr(?:il)?", "may", "jun(?:e)?",
                       "jul(?:y)?", "aug(?:ust)?", "sep(?:t(?:ember)?)?", "oct(?:ober)?", "nov(?:ember)?",
                       "dec(?:ember)?"])
    m = re.search(rf"(?<![a-z])({months})(?![a-z])[-_ .]?(20\d\d)(?!\d)", low)
    if m:
        return dt.date(int(m.group(2)), MONTH_NAMES[m.group(1)[:3]], 1)
    m = re.search(rf"(?<!\d)(20\d\d)[-_ .]?({months})(?![a-z])", low)
    if m:
        return dt.date(int(m.group(1)), MONTH_NAMES[m.group(2)[:3]], 1)
    m = re.search(r"(?<!\d)(20\d\d)(?!\d)", low)
    if m:
        return dt.date(int(m.group(1)), 6, 30)
    return None


def parse_date(v) -> dt.date | None:
    if isinstance(v, dt.date):
        return v
    if isinstance(v, str):
        for pattern in ("%Y-%m-%d", "%Y-%m", "%d.%m.%Y", "%Y/%m/%d"):
            try:
                return dt.datetime.strptime(v.strip(), pattern).date()
            except ValueError:
                continue
    return None


def months_between(a: dt.date, b: dt.date) -> float:
    return (b.year - a.year) * 12 + (b.month - a.month) + (b.day - a.day) / 30.0


# ----------------------------------------------------------------------------
# derived_from expression evaluation
# ----------------------------------------------------------------------------

EXPR_TOKEN = re.compile(r"\s*(?:(\d+\.?\d*(?:[eE][-+]?\d+)?|\.\d+)|([A-Za-z_][A-Za-z0-9_]*)|(\*\*|[-+*/^()]))")


def eval_expr(expr: str, lookup) -> tuple[float, list[str]]:
    tokens, pos, used = [], 0, []
    expr = expr.strip()
    while pos < len(expr):
        m = EXPR_TOKEN.match(expr, pos)
        if not m or m.end() == pos:
            raise ValueError(f"cannot parse '{expr[pos:pos + 12]}'")
        pos = m.end()
        if m.group(1):
            tokens.append(("num", float(m.group(1))))
        elif m.group(2):
            tokens.append(("id", m.group(2)))
        else:
            tokens.append(("op", m.group(3)))
    i = [0]

    def peek():
        return tokens[i[0]] if i[0] < len(tokens) else (None, None)

    def take():
        t = tokens[i[0]]
        i[0] += 1
        return t

    def expr_():
        v = term()
        while peek()[1] in ("+", "-"):
            op = take()[1]
            r = term()
            v = v + r if op == "+" else v - r
        return v

    def term():
        v = unary()
        while peek()[1] in ("*", "/"):
            op = take()[1]
            r = unary()
            if op == "*":
                v *= r
            else:
                if r == 0:
                    raise ValueError("division by zero")
                v /= r
        return v

    def unary():
        if peek() == ("op", "-"):
            take()
            return -unary()
        if peek() == ("op", "+"):
            take()
            return unary()
        return power()

    def power():
        base = atom()
        if peek() in (("op", "^"), ("op", "**")):
            take()
            exponent = unary()  # right associative, and -2 ^ 2 reads as -(2 ^ 2)
            try:
                result = base ** exponent
            except (OverflowError, ZeroDivisionError) as exc:
                raise ValueError(f"cannot raise {base} to {exponent}: {exc}") from exc
            if isinstance(result, complex):
                raise ValueError("negative base with a fractional power")
            return result
        return base

    def atom():
        kind, val = take()
        if kind == "num":
            return val
        if kind == "id":
            used.append(val)
            v = lookup(val)
            if v is None:
                raise ValueError(f"unknown or non-numeric id '{val}'")
            return v
        if val == "(":
            v = expr_()
            if take() != ("op", ")"):
                raise ValueError("expected )")
            return v
        raise ValueError(f"unexpected token {val}")

    result = expr_()
    if i[0] != len(tokens):
        raise ValueError("trailing tokens")
    return result, used


# ----------------------------------------------------------------------------
# Checks
# ----------------------------------------------------------------------------

def role_of(fact: dict) -> str | None:
    role = fact.get("role")
    if isinstance(role, str) and role.strip():
        return role.strip()
    fid = str(fact.get("id", ""))
    if fid in CONVENTIONAL_IDS:
        return CONVENTIONAL_IDS[fid]
    for pattern, role in ID_PATTERNS:
        if pattern.match(fid):
            return role
    return None


def check_fields(facts: list) -> list[tuple[str, str]]:
    items = []
    seen: dict[str, int] = {}
    for n, f in enumerate(facts, 1):
        if not isinstance(f, dict):
            items.append(("FAIL", f"fact #{n} is not a mapping"))
            continue
        fid = f.get("id")
        label = f"fact #{n}" + (f" ({fid})" if fid else "")
        for key in ("id", "label", "value", "unit", "kind", "status"):
            if key not in f or f.get(key) is None or f.get(key) == "":
                items.append(("FAIL", f"{label}: missing `{key}`"))
        if fid is not None:
            if fid in seen:
                items.append(("FAIL", f"{label}: duplicate id, first used by fact #{seen[fid]}"))
            seen[str(fid)] = n
            if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", str(fid)):
                items.append(("FAIL", f"{label}: id must be letters, digits and underscores so derived_from can use it"))
        if f.get("kind") not in KINDS and f.get("kind") is not None:
            items.append(("FAIL", f"{label}: kind `{f.get('kind')}` is not one of fact, assumption, projection"))
        if f.get("status") not in STATUSES and f.get("status") is not None:
            items.append(("FAIL", f"{label}: status `{f.get('status')}` is not one of confirmed, unverified, conflicting"))
        v = f.get("value")
        if v is not None and v != "":
            if isinstance(v, list):
                if not v or any(num(x) is None for x in v):
                    items.append(("FAIL", f"{label}: value list must contain only numbers"))
            elif num(v) is None and str(f.get("unit", "")).strip().lower() != "text":
                items.append(("WARN", f"{label}: value is text but unit is `{f.get('unit')}`. "
                                      "Use `unit: text` for a qualitative entry, or give a number."))
    return items


def check_sources(facts: list) -> list[tuple[str, str]]:
    items = []
    for f in facts:
        if not isinstance(f, dict):
            continue
        has_source = isinstance(f.get("source"), str) and f.get("source").strip()
        if f.get("kind") == "fact" and not has_source and not f.get("derived_from"):
            items.append(("FAIL", f"{f.get('id')}: kind is fact but it has neither source nor derived_from. "
                                  "Either point it at a file or make it an assumption."))
        if f.get("kind") in ("assumption", "projection") and not source_file(f) and not f.get("derived_from") \
                and not f.get("method") and not f.get("assumes"):
            items.append(("WARN", f"{f.get('id')}: {f.get('kind')} without source, method or assumes; "
                                  "say where it comes from"))
    return items


def check_derived(facts: list, by_id: dict) -> list[tuple[str, str]]:
    items = []

    def lookup(fid):
        f = by_id.get(fid)
        return None if f is None else num(f.get("value"))

    for f in facts:
        expr = f.get("derived_from") if isinstance(f, dict) else None
        if not expr:
            continue
        fid = f.get("id")
        target = num(f.get("value"))
        if target is None:
            items.append(("FAIL", f"{fid}: derived_from given but value is not a number"))
            continue
        try:
            result, used = eval_expr(str(expr), lookup)
        except (ValueError, ZeroDivisionError) as exc:
            items.append(("FAIL", f"{fid}: cannot evaluate `{expr}`: {exc}"))
            continue
        if not close(result, target):
            items.append(("FAIL", f"{fid}: value {fmt(target)} but `{expr}` = {fmt(result)} "
                                  f"({pct_off(target, result)} off). Which one is right?"))
    return items


def check_conflicts(facts: list, by_id: dict) -> list[tuple[str, str]]:
    items = []
    for f in facts:
        if not isinstance(f, dict) or not f.get("conflicts_with"):
            continue
        fid = f.get("id")
        if f.get("status") != "conflicting":
            items.append(("FAIL", f"{fid}: has conflicts_with but status is `{f.get('status')}`, "
                                  "it must be conflicting"))
        for other_id in as_list(f.get("conflicts_with")):
            other = by_id.get(str(other_id))
            if other is None:
                items.append(("FAIL", f"{fid}: conflicts_with `{other_id}` which is not in the ledger"))
            elif other.get("status") != "conflicting":
                items.append(("FAIL", f"{other_id}: is named in {fid}.conflicts_with but its status is "
                                      f"`{other.get('status')}`, both sides must be conflicting"))
    return items


def check_identities(facts: list, by_id: dict) -> list[tuple[str, str]]:
    items = []
    roles: dict[str, list[dict]] = {}
    for f in facts:
        if isinstance(f, dict):
            r = role_of(f)
            if r:
                roles.setdefault(r, []).append(f)

    def one(role: str) -> dict | None:
        lst = roles.get(role, [])
        return lst[0] if lst else None

    def val(f: dict | None) -> float | None:
        return None if f is None else num(f.get("value"))

    def level_for(*fs) -> str:
        # A conflicting entry, or one the founder has acknowledged as open (`open_question:`),
        # turns a failed identity into a WARN: it is a question, not a ledger error.
        return "WARN" if any(f is not None and (f.get("status") == "conflicting" or str(f.get("open_question") or "").strip())
                             for f in fs) else "FAIL"

    def report(level, ids, message, question):
        items.append((level, f"[{' / '.join(ids)}] {message} Question: {question}"))

    mrr, arr = one("mrr"), one("arr")
    if mrr and arr and val(mrr) is not None and val(arr) is not None:
        if not close(val(arr), val(mrr) * 12):
            report(level_for(mrr, arr), [arr["id"], mrr["id"]],
                   f"ARR {fmt(val(arr))} but MRR x 12 = {fmt(val(mrr) * 12)} ({pct_off(val(arr), val(mrr) * 12)} off).",
                   "Is the ARR a run-rate from the latest MRR, or contracted ARR including signed-not-live deals?")

    gmv, tr, nr = one("gmv"), one("take_rate"), one("net_revenue")
    if gmv and tr and nr and None not in (val(gmv), val(tr), val(nr)):
        expected = val(gmv) * as_fraction(val(tr))
        if not close(val(nr), expected):
            report(level_for(gmv, tr, nr), [nr["id"], gmv["id"], tr["id"]],
                   f"net revenue {fmt(val(nr))} but GMV x take rate = {fmt(expected)} ({pct_off(val(nr), expected)} off).",
                   "Do GMV and net revenue cover the same period and the same bookings (for example, are manually "
                   "invoiced deals in one but not the other)?")

    cash, burn, runway = one("cash"), one("net_burn"), one("runway_months")
    if cash and burn and runway and None not in (val(cash), val(burn), val(runway)):
        if val(burn) <= 0:
            report("WARN", [burn["id"]], "net burn is zero or negative, runway check skipped.",
                   "Is the company cash-flow positive, or is the burn sign wrong?")
        else:
            expected = val(cash) / val(burn)
            if not close(val(runway), expected, rel=0.05, abs_tol=0.5):
                report(level_for(cash, burn, runway), [runway["id"], cash["id"], burn["id"]],
                       f"runway {fmt(val(runway))} months but cash / net burn = {expected:.1f} months.",
                       "Is the runway computed from the current net burn, or from a planned burn after hiring?")

    for gm in roles.get("growth_multiple", []):
        series_id = gm.get("series")
        if not series_id:
            m = re.match(r"^(.+)_(growth|yoy)_multiple$", str(gm.get("id")))
            if m and f"{m.group(1)}_series" in by_id:
                series_id = f"{m.group(1)}_series"
        series = by_id.get(str(series_id)) if series_id else None
        values = [num(x) for x in as_list(series.get("value"))] if series else []
        if not series or len(values) < 2 or any(v is None for v in values):
            report("WARN", [gm["id"]], "no numeric series to check the growth multiple against.",
                   f"Add `series: <id>` pointing at a list-valued fact (looked for {series_id or 'none'}).")
            continue
        window = gm.get("window")
        first = values[-1 - int(window)] if window and int(window) < len(values) else values[0]
        last = values[-1]
        if first == 0:
            continue
        expected = last / first
        if val(gm) is None or not close(val(gm), expected, rel=0.02):
            report(level_for(gm, series), [gm["id"], series["id"]],
                   f"growth multiple {fmt(val(gm))} but last / first of the series = {expected:.2f}x "
                   f"({fmt(last)} / {fmt(first)}" + (f", window {window}" if window else "") + ").",
                   "Which two points does the multiple compare, and are they the same metric as the series?")

    ask = one("ask")
    pcts = roles.get("use_of_funds_pct", [])
    amounts = roles.get("use_of_funds_amount", [])
    if pcts:
        vals = [val(p) for p in pcts]
        if None not in vals:
            total = sum(vals)
            target = 100.0 if max(vals) > 1.0 else 1.0
            if not close(total, target):
                report(level_for(*pcts), [p["id"] for p in pcts],
                       f"use of funds percentages sum to {fmt(total)}, not {fmt(target)}.",
                       "Which bucket absorbs the difference, or is a bucket missing?")
    if amounts and ask and val(ask) is not None:
        vals = [val(a) for a in amounts]
        if None not in vals:
            total = sum(vals)
            if not close(total, val(ask)):
                report(level_for(ask, *amounts), [a["id"] for a in amounts] + [ask["id"]],
                       f"use of funds amounts sum to {fmt(total)} but the ask is {fmt(val(ask))}.",
                       "Is the ask the total round, or only the lead's share? Which amounts are wrong?")
    if pcts and amounts and ask and val(ask) is not None:
        def bucket(f):
            return re.sub(r"^use_of_funds_|_(pct|percent|amount)$", "", str(f.get("id")))
        amount_by_bucket = {bucket(a): a for a in amounts}
        for p in pcts:
            a = amount_by_bucket.get(bucket(p))
            if a is None or val(p) is None or val(a) is None:
                continue
            expected = as_fraction(val(p)) * val(ask) if val(p) > 1 or max(val(x) for x in pcts) <= 1 else val(p) * val(ask)
            if not close(val(a), expected):
                report(level_for(p, a, ask), [a["id"], p["id"]],
                       f"{fmt(val(a))} is not {fmt(val(p))} percent of the ask ({fmt(expected)}).",
                       "Does the percentage or the amount describe the plan?")

    tam, sam, som = one("tam"), one("sam"), one("som")
    for big, small, names in ((tam, sam, "TAM >= SAM"), (sam, som, "SAM >= SOM"), (tam, som, "TAM >= SOM")):
        if big and small and val(big) is not None and val(small) is not None and val(big) < val(small):
            report(level_for(big, small), [big["id"], small["id"]],
                   f"{names} violated: {fmt(val(big))} < {fmt(val(small))}.",
                   "Are the two sizes measured in the same unit and for the same geography and period?")

    cac, acv, gm_, payback = one("cac"), one("acv"), one("gross_margin"), one("cac_payback_months")
    if cac and acv and gm_ and payback and None not in (val(cac), val(acv), val(gm_), val(payback)):
        monthly_margin = val(acv) * as_fraction(val(gm_)) / 12.0
        if monthly_margin > 0:
            expected = val(cac) / monthly_margin
            if not close(val(payback), expected, rel=0.10, abs_tol=0.5):
                report(level_for(cac, acv, gm_, payback), [payback["id"], cac["id"], acv["id"], gm_["id"]],
                       f"CAC payback {fmt(val(payback))} months but CAC / (ACV x gross margin / 12) = {expected:.1f} months.",
                       "Is payback computed on gross margin or on revenue, and on the same customer segment as the CAC?")

    heads, cost = one("headcount"), one("avg_cost_per_head")
    gross = one("gross_burn")
    if heads and cost and val(heads) is not None and val(cost) is not None:
        monthly_cost = val(cost)
        unit = str(cost.get("unit", "")).lower()
        if "year" in unit or "annual" in unit or "/y" in unit or "p.a" in unit:
            monthly_cost /= 12.0
        people_cost = val(heads) * monthly_cost
        burn_ref, burn_name = None, ""
        if gross and val(gross) is not None:
            burn_ref, burn_name = val(gross), gross["id"]
        elif burn and val(burn) is not None:
            extra = val(mrr) if mrr and val(mrr) is not None else 0.0
            burn_ref, burn_name = val(burn) + extra, f"{burn['id']} + revenue"
        if burn_ref is not None and people_cost > burn_ref * 1.10:
            report(level_for(heads, cost, gross or burn), [heads["id"], cost["id"], burn_name],
                   f"headcount x cost per head = {fmt(people_cost)} per month, more than the burn of {fmt(burn_ref)}.",
                   "Is the cost per head fully loaded and monthly, and does the burn include all salaries?")
    return items


def check_staleness(facts: list, as_of: dt.date | None, root: Path | None, inventory: dict | None) -> list:
    if as_of is None:
        return [("WARN", "no valid `as_of` date at the top of the ledger, staleness not checked")]
    items = []
    inv_dates = {}
    if inventory:
        for e in inventory.get("files", []):
            inv_dates[e["path"]] = e.get("modified")
    by_source: dict[str, list[str]] = {}
    for f in facts:
        if isinstance(f, dict) and source_file(f):
            by_source.setdefault(source_file(f), []).append(str(f.get("id")))
    for src, ids in by_source.items():
        used = f"{len(ids)} entries: {_short(ids, 4)}" if len(ids) > 1 else ids[0]
        parts = PurePosixPath(src).parts
        if any(p.lower() in ("old", "archive", "archived", "deprecated", "superseded") for p in parts[:-1]):
            items.append(("WARN", f"{src} sits in an archive folder. Is there a newer version? (used by {used})"))
            continue
        file_date = name_date(PurePosixPath(src).stem)
        how = "date in file name"
        if file_date is None:
            mod = inv_dates.get(src)
            if mod:
                file_date = parse_date(mod[:10])
                how = "inventory modified date"
            elif root and (root / src).exists():
                file_date = dt.date.fromtimestamp((root / src).stat().st_mtime)
                how = "file modified date"
        if file_date and months_between(file_date, as_of) > STALE_MONTHS:
            items.append(("WARN", f"{src} is dated {file_date.isoformat()} ({how}), more than {STALE_MONTHS} "
                                  f"months before as_of {as_of.isoformat()}. Is there a more recent figure? "
                                  f"(used by {used})"))
    return items


# ----------------------------------------------------------------------------
# Deck check
# ----------------------------------------------------------------------------

CURRENCY_CODES = ("EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK", "JPY", "CNY", "INR",
                  "CAD", "AUD", "SGD", "BRL", "ILS", "AED")
_CODES = "|".join(CURRENCY_CODES)
_MONTHS = (r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|"
           r"sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)")
_MONTHS_NO_MAY = _MONTHS.replace("|may|", "|")

# Things that look like numbers but are never claims: dates, quarters, times, standards, versions, colours.
NOT_A_CLAIM_RE = re.compile(
    r"\b\d{4}-\d{2}(?:-\d{2})?\b"
    r"|\b\d{1,2}[./]\d{1,2}[./]\d{2,4}\b"
    r"|\b\d{1,2}:\d{2}\b"
    rf"|\b\d{{1,2}}(?:st|nd|rd|th)?\s+{_MONTHS}\b\.?,?\s+'?\d{{4}}\b"
    rf"|\b\d{{1,2}}(?:st|nd|rd|th)?\s+{_MONTHS_NO_MAY}\b\.?"
    rf"|\b{_MONTHS}\b\.?\s+\d{{1,2}}(?:st|nd|rd|th)?,\s*\d{{4}}\b"
    rf"|\b{_MONTHS}\b\.?\s+\d{{4}}\b"
    rf"|\b{_MONTHS_NO_MAY}\b\.?\s+'?\d{{2}}\b(?!\s?%|[.,]\d)"
    r"|\b(?:q[1-4]|h[12]|fy)\s*'?\d{2}(?:\d{2})?\b"
    r"|\b(?:19|20)\d{2}\s*(?:q[1-4]|h[12])\b"
    r"|\b(?:iso|nace|hrb|soc|rfc|din|iec|sic|naics)[\s-]?\d[\d.:-]*"
    r"|\bv\d+(?:\.\d+)*\b"
    r"|#[0-9a-fA-F]{3,8}\b|#\d+",
    re.IGNORECASE)
YEAR_RE = re.compile(r"(?<![$€£¥\d.,])\b(?:19|20)\d{2}\b(?!\s?(?:%|percent|pct)|[.,]\d|[kKmMbBxX×]\b)")

CLAIM_RE = re.compile(
    rf"(?<![\w.,/#])(?P<cur1>[$€£¥]|(?:{_CODES})\s?)?(?P<sign>[-+−]\s?)?(?P<cur1b>[$€£¥])?"
    r"(?P<num>\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,3}(?:\.\d{3}){2,}(?:,\d+)?|\d+(?:[.,]\d+)?)"
    r"(?P<suf>\s?%|\s?(?:percent|pct)\b|(?:bn|mn|mm|[kmbx×])(?![A-Za-z0-9])|\s(?:thousand|million|mio|billion|bn|mn)\b)?"
    rf"(?P<cur2>\s?(?:{_CODES})\b|\s?[€$£])?"
    r"(?![A-Za-z0-9])",
    re.IGNORECASE)

SCALE_BY_SUFFIX = {"k": 1e3, "thousand": 1e3, "m": 1e6, "mn": 1e6, "mm": 1e6, "mio": 1e6, "million": 1e6,
                   "b": 1e9, "bn": 1e9, "billion": 1e9}
TEXT_KEYS = {"title", "subtitle", "points", "body", "text", "rows", "columns", "cells", "table", "html",
             "headline", "bullets", "left", "right"}
IGNORED_KEYS = {"source", "notes", "question", "kicker", "label", "labels", "x_label", "y_label", "name",
                "role", "bio", "caption", "theme", "accent", "font_display", "font_body", "logo", "type",
                "kind", "id", "layout", "image", "icon", "color", "colour", "footer", "aspect", "variant"}
STAT_LIST_KEYS = {"stats", "use_of_funds", "metrics", "kpis"}
STAT_VALUE_KEYS = {"value", "pct", "percent", "amount"}
QUIET_SLIDE_TYPES = {"cover", "closing", "statement", "section", "divider", "title", "quote", "thank_you"}


class Claim:
    """One number found on a slide: its text, candidate values, display tolerance and unit kind."""

    def __init__(self, text: str, values: list[tuple[float, float]], kind: str, magnitude: bool):
        self.text = text
        self.values = values      # [(absolute value, tolerance)], more than one when the text is ambiguous
        self.kind = kind          # percent | multiple | currency | plain
        self.magnitude = magnitude

    @property
    def is_text_claim(self) -> bool:
        """In prose, only numbers with a unit or magnitude, or 1,000 and above, are claims."""
        return self.kind != "plain" or self.magnitude or max(v for v, _ in self.values) >= 1000


def _tolerance(value: float, decimals: int, trailing_zeros: int, scale: float) -> float:
    ulp = (10.0 ** -decimals if decimals else 10.0 ** trailing_zeros) * scale
    return max(min(0.5 * ulp, 0.03 * abs(value)), 0.005 * abs(value)) + 1e-9


def _claim_from_number(x: float, kind: str = "plain") -> Claim:
    s = repr(float(x))
    decimals = 0 if s.endswith(".0") or "e" in s else len(s.split(".", 1)[1])
    digits = str(int(abs(x))) if decimals == 0 else ""
    zeros = len(digits) - len(digits.rstrip("0")) if digits not in ("", "0") else 0
    return Claim(fmt(x), [(abs(float(x)), _tolerance(x, decimals, zeros, 1.0))], kind, False)


def claims_in_text(text: str) -> list[Claim]:
    text = NOT_A_CLAIM_RE.sub(" ", str(text))
    text = YEAR_RE.sub(" ", text)
    found: list[Claim] = []
    for m in CLAIM_RE.finditer(text):
        raw = m.group("num")
        suffix = (m.group("suf") or "").strip()
        has_currency = bool(m.group("cur1") or m.group("cur1b") or m.group("cur2"))
        alt_raw = None
        if "," in raw and "." in raw:
            norm = raw.replace(",", "") if raw.rfind(".") > raw.rfind(",") else raw.replace(".", "").replace(",", ".")
        elif re.fullmatch(r"\d{1,3}(?:,\d{3})+", raw):
            norm = raw.replace(",", "")
        elif re.fullmatch(r"\d{1,3}(?:\.\d{3}){2,}", raw):
            norm = raw.replace(".", "")
        elif "," in raw:
            norm = raw.replace(",", ".")
        else:
            norm = raw
            if re.fullmatch(r"[1-9]\d{0,2}\.\d{3}", raw) and not suffix:
                alt_raw = raw.replace(".", "")  # 41.200 may be a continental 41,200
        low = suffix.lower()
        kind, scale = "plain", 1.0
        if low in ("%", "percent", "pct"):
            kind = "percent"
        elif low in ("x", "×"):
            kind = "multiple"
        elif low in SCALE_BY_SUFFIX:
            scale = SCALE_BY_SUFFIX[low]
        if has_currency and kind == "plain":
            kind = "currency"
        values = []
        for candidate in [norm] + ([alt_raw] if alt_raw else []):
            try:
                base = float(candidate)
            except ValueError:
                continue
            decimals = len(candidate.split(".", 1)[1]) if "." in candidate else 0
            zeros = len(candidate) - len(candidate.rstrip("0")) if decimals == 0 and base >= 1000 else 0
            values.append((base * scale, _tolerance(base * scale, decimals, zeros, scale)))
            if suffix == "m" and not has_currency:
                values.append((base, _tolerance(base, decimals, 0, 1.0)))  # 18m may mean 18 months
        if values:
            found.append(Claim(m.group(0).strip(), values, kind, scale > 1.0))
    return found


def unit_family(unit: str) -> str:
    u = str(unit or "").strip().lower()
    if u in ("x", "×", "times") or "multiple" in u:
        return "multiple"
    if "percent" in u or "%" in u or "pct" in u:
        return "percent"
    if any(w in u for w in ("ratio", "fraction", "share", "proportion")) or u == "rate":
        return "ratio"
    if re.search(rf"[$€£¥]|\b(?:{_CODES})\b", str(unit or ""), re.IGNORECASE):
        return "currency"
    return "other"


INCOMPATIBLE = {"percent": {"currency", "multiple"}, "multiple": {"currency", "percent"},
                "currency": {"percent", "ratio", "multiple"}, "plain": set()}


def is_text_entry(fact: dict) -> bool:
    return str(fact.get("unit", "")).strip().lower() == "text"


def claim_matches(claim: Claim, fact: dict, allow_scale: bool) -> bool:
    """True when the entry's value rounds to the displayed number. Sign is ignored."""
    if is_text_entry(fact):
        return False
    family = unit_family(fact.get("unit", ""))
    if family in INCOMPATIBLE[claim.kind]:
        return False
    for raw in as_list(fact.get("value")):
        v = num(raw)
        if v is None:
            continue
        v = abs(v)
        cands = {v}
        if family == "ratio" and claim.kind in ("percent", "plain"):
            cands.add(v * 100)
        if family == "percent":
            if v <= 1.0:
                cands.add(v * 100)
            if claim.kind == "plain":
                cands.add(v / 100)
        if family == "other" and claim.kind == "percent" and v <= 1.5:
            cands.add(v * 100)
        if allow_scale and claim.kind in ("plain", "currency") and not claim.magnitude:
            cands.update({v / 1e3, v / 1e6, v / 1e9})
        for c in cands:
            for value, tol in claim.values:
                if abs(c - value) <= tol:
                    return True
    return False


def collect_sources(obj, acc: list[str]) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "source":
                for s in as_list(v):
                    if isinstance(s, str):
                        acc.append(re.sub(r"^(fact|assumption|projection):", "", s.strip(), flags=re.I))
            else:
                collect_sources(v, acc)
    elif isinstance(obj, list):
        for v in obj:
            collect_sources(v, acc)


def collect_hard_claims(slide: dict) -> list[tuple[str, Claim]]:
    """Stats values, use-of-funds figures and chart series values: always claims."""
    out: list[tuple[str, Claim]] = []

    def walk(obj):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in STAT_LIST_KEYS and isinstance(v, list):
                    for item in v:
                        if not isinstance(item, dict):
                            continue
                        for vk in STAT_VALUE_KEYS:
                            if vk not in item or isinstance(item[vk], bool) or item[vk] is None:
                                continue
                            raw = item[vk]
                            where = f"{k[:-1] if k.endswith('s') else k} \"{raw}\""
                            if isinstance(raw, (int, float)):
                                out.append((where, _claim_from_number(raw, "percent" if vk in ("pct", "percent") else "plain")))
                            else:
                                out.extend((where, c) for c in claims_in_text(str(raw)))
                elif k == "chart" and isinstance(v, dict):
                    for series in as_list(v.get("series")):
                        if not isinstance(series, dict):
                            continue
                        name = series.get("name", "series")
                        for x in as_list(series.get("values")):
                            if isinstance(x, (int, float)) and not isinstance(x, bool):
                                out.append((f"chart \"{name}\"", _claim_from_number(x)))
                            elif isinstance(x, str):
                                out.extend((f"chart \"{name}\"", c) for c in claims_in_text(x))
                elif k not in IGNORED_KEYS:
                    walk(v)
        elif isinstance(obj, list):
            for v in obj:
                walk(v)

    walk(slide)
    return out


def collect_text_claims(slide: dict) -> list[Claim]:
    """Numbers in title, subtitle, points, body and table cells that read as claims."""
    out: list[Claim] = []

    def walk(obj, key: str, inside: bool):
        if isinstance(obj, dict):
            for k, v in obj.items():
                if k in IGNORED_KEYS or k in STAT_LIST_KEYS or k == "chart":
                    continue
                walk(v, k, inside or k in TEXT_KEYS)
        elif isinstance(obj, list):
            for v in obj:
                walk(v, key, inside)
        elif isinstance(obj, bool) or not inside:
            return
        elif isinstance(obj, (int, float)):
            out.append(_claim_from_number(obj))
        elif isinstance(obj, str):
            text = re.sub(r"<[^>]+>", " ", obj) if key == "html" else obj
            out.extend(claims_in_text(text))

    walk(slide, "", False)
    return [c for c in out if c.is_text_claim]


def check_deck(deck_path: Path, by_id: dict) -> list[tuple[str, str]]:
    items: list[tuple[str, str]] = []
    try:
        deck = json.loads(deck_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [("FAIL", f"cannot read deck {deck_path}: {exc}")]
    slides = deck.get("slides", []) if isinstance(deck, dict) else []
    if not slides:
        return [("WARN", "deck has no slides")]
    all_facts = list(by_id.values())
    n_hard = n_text = 0

    def first_match(claim: Claim) -> str | None:
        for f in all_facts:
            if claim_matches(claim, f, allow_scale=False):
                return str(f.get("id"))
        return None

    for n, slide in enumerate(slides, 1):
        if not isinstance(slide, dict):
            continue
        stype = str(slide.get("type", "?"))
        tag = f"slide {n} ({stype})"
        sources: list[str] = []
        collect_sources(slide, sources)
        sources = list(dict.fromkeys(sources))
        for s in sources:
            if s not in by_id:
                items.append(("FAIL", f"{tag}: source `{s}` is not in the ledger"))
        cited = [by_id[s] for s in sources if s in by_id]
        hard = collect_hard_claims(slide)
        if stype in QUIET_SLIDE_TYPES and not hard:
            continue  # cover, closing and statement slides without stats are never traced
        soft = collect_text_claims(slide)
        n_hard += len(hard)
        n_text += len(soft)

        no_source, unknown, uncited = [], [], {}
        for where, claim in hard:
            if any(claim_matches(claim, f, allow_scale=True) for f in cited):
                continue
            label = f"{where}" if claim.text in where else f"{where}: {claim.text}"
            if not sources:
                no_source.append(label)
                continue
            other = first_match(claim)
            if other:
                uncited.setdefault(other, label)
            else:
                unknown.append(label)
        if no_source:
            items.append(("FAIL", f"{tag}: figures with no source on the slide, chart or stat: "
                                  f"{_short(no_source)}. Add `source: fact:<id>`."))
        if unknown:
            items.append(("FAIL", f"{tag}: not in the ledger: {_short(unknown)}. None of the cited entries "
                                  f"({_short(sources, 6)}) has that value. Fix the number or cite the entry it comes from."))
        if uncited:
            hints = [f"{label} looks like `{fid}`" for fid, label in uncited.items()]
            items.append(("WARN", f"{tag}: value found in the ledger but not cited here: {_short(hints)}. "
                                  "Add the id to `source`."))

        loose = []
        for claim in soft:
            if any(claim_matches(claim, f, allow_scale=True) for f in cited):
                continue  # scale allowed for cited entries: a table in GBP k cites entries in GBP
            if first_match(claim) is None:
                loose.append(claim.text)
        loose = list(dict.fromkeys(loose))
        if loose:
            items.append(("WARN", f"{tag}: figures in the text that match no ledger entry: {_short(loose)}. "
                                  "Add the entry, or reword if it is not a claim."))
        elif soft and not sources:
            items.append(("WARN", f"{tag}: the text carries figures ({_short([c.text for c in soft])}) "
                                  "but the slide cites no `source`."))
    items.append(("INFO", f"{n_hard} stat and chart values and {n_text} figures in slide text checked "
                          f"across {len(slides)} slides (rule: --explain)"))
    return items


def _short(values: list, limit: int = 8) -> str:
    values = [str(v) for v in values]
    extra = len(values) - limit
    return ", ".join(values[:limit]) + (f" and {extra} more" if extra > 0 else "")


# ----------------------------------------------------------------------------
# Corpus check
# ----------------------------------------------------------------------------

def load_corpus_index(corpus: Path) -> tuple[dict[str, str], dict[str, str]]:
    """Return (path -> corpus file or '', path -> status note)."""
    mapping, notes = {}, {}
    index = corpus / "INDEX.md"
    if index.is_file():
        for line in index.read_text(encoding="utf-8").splitlines():
            if not line.startswith("|") or line.startswith("|---") or line.startswith("| #"):
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) < 8:
                continue
            path = cells[1].replace("\\|", "|")
            corpus_cell = cells[7]
            m = re.match(r"`([^`]+)`", corpus_cell)
            mapping[path] = m.group(1) if m else ""
            notes[path] = corpus_cell if not m else ""
    return mapping, notes


def slug_for(rel: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", rel.replace("/", "__")) + ".md"


NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
                "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
                "nineteen", "twenty"]


def value_forms(v: float, unit: str) -> list[str]:
    """Ways a value may be written in a source file, plainest first."""
    forms: dict[str, None] = {}
    unit = unit.lower()

    class _Adder:
        def add(self, x):
            forms.setdefault(x, None)

        def update(self, xs):
            for x in sorted(xs, key=len, reverse=True):
                forms.setdefault(x, None)
    forms_ = _Adder()

    def dec(x: float, digits: int) -> str:
        s = f"{x:.{digits}f}"
        if "." in s:
            s = s.rstrip("0").rstrip(".")
        return s if s else "0"

    if v == int(v):
        i = int(v)
        forms_.update({str(i), f"{i:,}", f"{i:,}".replace(",", "."), f"{i:,}".replace(",", " ")})
        if 0 <= i <= 20:
            forms_.add(NUMBER_WORDS[i])  # prose says "six prototypes"
    else:
        for d in (1, 2, 3):
            forms_.add(dec(v, d))
            forms_.add(dec(v, d).replace(".", ","))
    for scale, floor, suffixes in ((1e3, 1e3, ("k", " k")), (1e6, 1e5, ("m", " m", "mn", "mio", " million")),
                                   (1e9, 1e8, ("b", " b", "bn", " bn", " billion"))):
        if abs(v) >= floor:  # 900,000,000 is often written 0.9B
            scaled = v / scale
            for d in (0, 1, 2):
                s = dec(scaled, d)
                if float(s) == 0:
                    continue
                for suf in suffixes:
                    forms_.add(s + suf)
                    forms_.add(s.replace(".", ",") + suf)
    family = unit_family(unit)
    if abs(v) <= 1.5 and (family in ("percent", "ratio") or "margin" in unit or "rate" in unit):
        p = v * 100
        for d in (0, 1):
            forms_.update({dec(p, d) + "%", dec(p, d) + " %", dec(p, d) + " percent"})
    if family == "percent" and abs(v) > 1.0:
        forms_.update({dec(v, 0) + "%", dec(v, 1) + "%", dec(v, 0) + " %", dec(v, 1) + " percent"})
    if family in ("multiple", "ratio"):
        forms_.update({dec(v, 1) + "x", dec(v, 2) + "x"})
    return list(forms)


def found_in_text(form: str, text: str) -> bool:
    pattern = re.escape(form)
    if form[0].isdigit() or form[0] in "-+":
        pattern = r"(?<![\d.,])" + pattern
    if form[-1].isdigit():
        pattern = pattern + r"(?![\d])"
    elif form[-1].isalpha():
        pattern = pattern + r"(?![a-zA-Z])"
    return re.search(pattern, text, re.IGNORECASE) is not None


def is_computed(fact: dict) -> bool:
    flag = fact.get("computed")
    if flag is True or (isinstance(flag, str) and flag.strip().lower() in ("true", "yes")):
        return True
    return bool(str(fact.get("method") or "").strip())


def check_corpus(facts: list, corpus: Path, root: Path | None) -> list[tuple[str, str]]:
    items = []
    mapping, notes = load_corpus_index(corpus)
    if not mapping:
        items.append(("WARN", f"no INDEX.md found in {corpus}; falling back to file name matching"))
    text_cache: dict[str, str] = {}
    missing_files: dict[str, list[str]] = {}
    not_in_corpus: dict[str, list[str]] = {}
    n_computed = n_derived = n_text = n_searched = 0
    for f in facts:
        if not isinstance(f, dict):
            continue
        src = source_file(f)
        if not src:
            continue
        fid = str(f.get("id"))
        if root is not None and not (root / src).exists():
            missing_files.setdefault(src, []).append(fid)
            continue
        corpus_name = mapping.get(src)
        if corpus_name is None:
            corpus_name = slug_for(src) if (corpus / slug_for(src)).is_file() else None
        if not corpus_name or not (corpus / corpus_name).is_file():
            not_in_corpus.setdefault(src, []).append(fid)
            continue
        if is_text_entry(f):
            n_text += 1
            continue
        if f.get("derived_from"):
            n_derived += 1
            continue
        if is_computed(f):
            n_computed += 1
            continue
        if corpus_name not in text_cache:
            raw = (corpus / corpus_name).read_text(encoding="utf-8", errors="replace")
            text_cache[corpus_name] = raw.split("\n---\n", 1)[1] if "\n---\n" in raw else raw
        body = text_cache[corpus_name]
        values = as_list(f.get("value"))
        probes = [values[0], values[-1]] if len(values) > 1 else values
        n_searched += 1
        for v in probes:
            x = num(v)
            if x is None or x == 0:
                continue  # a zero comes from prose ("never spent a euro"), there are no digits to find
            forms = value_forms(x, str(f.get("unit", "")))
            if not any(found_in_text(form, body) for form in forms):
                items.append(("WARN", f"{fid}: value {fmt(x)} not found in source text ({src}). "
                                      f"Looked for {', '.join(forms[:5])}. If you computed it from this file "
                                      "(sum, count, average), add `computed: true`; otherwise check the source."))
    for src, ids in missing_files.items():
        items.append(("FAIL", f"source file {src} does not exist in {root} (used by {_short(ids, 5)})"))
    for src, ids in not_in_corpus.items():
        note = notes.get(src, "")
        if "excluded" in note.lower() or mapping.get(src) == "":
            items.append(("WARN", f"source {src} is confidential and was excluded from the corpus; it cannot be "
                                  f"verified and should not feed an investor output (used by {_short(ids, 5)})"))
        else:
            items.append(("WARN", f"source {src} is not in the corpus index, re-run extract.py "
                                  f"(used by {_short(ids, 5)})"))
    items.append(("INFO", f"{n_searched} values searched in their source text. Accepted without a digit search: "
                          f"{n_computed} computed (computed: true or method:), {n_derived} derived_from, "
                          f"{n_text} text; for those only the source file is confirmed"))
    return items


# ----------------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------------

def resolve(path_str: str | None, ledger: Path) -> Path | None:
    if not path_str:
        return None
    p = Path(path_str).expanduser()
    if p.exists():
        return p.resolve()
    alt = ledger.parent / p
    if alt.exists():
        return alt.resolve()
    alt2 = ledger.parent.parent / p
    if alt2.exists():
        return alt2.resolve()
    return p.resolve()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="ledger_check.py",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description="Check pitch/facts.yaml for completeness, arithmetic, conflicts, identities and staleness; "
                    "optionally trace deck numbers and corpus text back to it.",
        epilog=DECK_RULE + "\n\nledger rules in short (--explain for all of them):\n"
               "  derived_from     ids, numeric literals, + - * / ^ and parentheses, recomputed within 1 percent\n"
               "  computed: true   (or a non-empty method:) a value you computed from the source; digits not searched\n"
               "  unit: text       a string value, skipped by every numeric check\n\n"
               "Exit codes: 0 no FAIL, 1 at least one FAIL, 2 usage error.")
    parser.add_argument("ledger", nargs="?", help="path to facts.yaml")
    parser.add_argument("--explain", action="store_true",
                        help="print how the checker matches ids, roles, units, computed values and deck figures")
    parser.add_argument("--deck", help="deck.json to trace slide numbers against the ledger")
    parser.add_argument("--corpus", help="corpus folder from extract.py (with INDEX.md)")
    parser.add_argument("--root", help="startup folder (default: the parent of the ledger's pitch/ folder)")
    parser.add_argument("--inventory", help="inventory.json for modified dates (default: pitch/intake/inventory.json)")
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        return 0 if exc.code == 0 else 2

    if args.explain:
        print(EXPLAIN)
        return 0
    if not args.ledger:
        print("error: give the path to facts.yaml (or --explain)", file=sys.stderr)
        return 2
    ledger = Path(args.ledger).expanduser()
    if not ledger.is_file():
        print(f"error: ledger not found: {ledger}", file=sys.stderr)
        return 2
    ledger = ledger.resolve()
    try:
        data, parser_used = load_yaml(ledger)
    except (YamlError, OSError) as exc:
        print(f"error: cannot parse {ledger}: {exc}", file=sys.stderr)
        return 2
    if not isinstance(data, dict):
        print("error: ledger must be a mapping with company, currency, as_of and facts", file=sys.stderr)
        return 2

    root: Path | None = None
    if args.root:
        root = Path(args.root).expanduser().resolve()
        if not root.is_dir():
            print(f"error: --root {root} is not a directory", file=sys.stderr)
            return 2
    elif ledger.parent.name == "pitch":
        root = ledger.parent.parent
    deck = resolve(args.deck, ledger)
    corpus = resolve(args.corpus, ledger)
    inv_path = resolve(args.inventory, ledger) if args.inventory else (
        ledger.parent / "intake" / "inventory.json" if (ledger.parent / "intake" / "inventory.json").is_file()
        else (corpus.parent / "inventory.json" if corpus and (corpus.parent / "inventory.json").is_file() else None))
    inventory = None
    if inv_path and inv_path.is_file():
        try:
            inventory = json.loads(inv_path.read_text(encoding="utf-8"))
            # newer inventories store only the folder name; older ones stored the absolute path
            inv_root = Path(str(inventory.get("root") or ""))
            if root is None and inv_root.is_absolute() and inv_root.is_dir():
                root = inv_root
            elif root is None and inv_path.parent.name == "intake" and inv_path.parent.parent.name == "pitch":
                root = inv_path.parent.parent.parent
        except (OSError, json.JSONDecodeError):
            inventory = None

    facts = data.get("facts")
    if not isinstance(facts, list):
        facts = []
    by_id = {str(f.get("id")): f for f in facts if isinstance(f, dict) and f.get("id") is not None}
    as_of = parse_date(data.get("as_of"))

    report = Report()
    header_items = []
    for key in ("company", "currency", "as_of"):
        if not data.get(key):
            header_items.append(("FAIL", f"top-level `{key}` is missing"))
    if data.get("as_of") and as_of is None:
        header_items.append(("FAIL", f"as_of `{data.get('as_of')}` is not a date (use YYYY-MM-DD)"))
    if not facts:
        header_items.append(("FAIL", "`facts` is missing or empty"))
    report.add("(a) Required fields", header_items + check_fields(facts))
    report.add("(b) Facts have a source or derived_from", check_sources(facts))
    report.add("(c) derived_from recomputes within 1 percent", check_derived(facts, by_id),
               pass_text=f"{sum(1 for f in facts if isinstance(f, dict) and f.get('derived_from'))} expressions checked")
    report.add("(d) conflicts_with pairs are both conflicting", check_conflicts(facts, by_id))
    report.add("(e) Identity checks", check_identities(facts, by_id),
               pass_text="no identity violated among the roles present")
    report.add(f"(f) Staleness ({STALE_MONTHS} months before as_of)",
               check_staleness(facts, as_of, root, inventory))
    if deck is not None:
        if deck.is_file():
            report.add(f"(g) Deck numbers trace to the ledger ({deck.name})", check_deck(deck, by_id))
        else:
            report.add("(g) Deck numbers trace to the ledger", [("FAIL", f"deck not found: {deck}")])
    if corpus is not None:
        if corpus.is_dir():
            report.add("(h) Sources exist in the corpus and contain the value", check_corpus(facts, corpus, root))
        else:
            report.add("(h) Sources exist in the corpus", [("FAIL", f"corpus folder not found: {corpus}")])

    header = [
        f"- ledger: {ledger}",
        f"- company: {data.get('company')}, currency: {data.get('currency')}, as_of: {data.get('as_of')}",
        f"- facts: {len(facts)} ({sum(1 for f in facts if isinstance(f, dict) and f.get('kind') == 'fact')} fact, "
        f"{sum(1 for f in facts if isinstance(f, dict) and f.get('kind') == 'assumption')} assumption, "
        f"{sum(1 for f in facts if isinstance(f, dict) and f.get('kind') == 'projection')} projection; "
        f"{sum(1 for f in facts if isinstance(f, dict) and f.get('status') == 'conflicting')} conflicting)",
        f"- parsed with: {parser_used}",
    ]
    if root:
        header.append(f"- startup folder: {root}")
    text, failed = report.render(header)
    sys.stdout.write(text)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
