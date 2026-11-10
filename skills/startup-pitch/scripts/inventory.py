#!/usr/bin/env python3
"""inventory.py: walk a startup folder and write pitch/intake/inventory.json.

For every file it records path, size, type, modified date, a staleness flag
(a sibling has a newer version of a similar name, or the file sits in an
old/ or archive/ folder) and a confidentiality classification:

  confidential  path or first 2 KB carry strong signals (term sheet, salaries,
                payroll, hr/, legal/, NDA, "do not share", "confidential", or
                two or more weak signals such as pre-money, post-money,
                lead investor, a salary table, bulk email addresses)
  sensitive     cap table summaries, investor feedback, a single weak signal, or
                three or more deal or pay terms anywhere in the text
  normal        everything else. Text files under 300 KB are scanned in full: one
                or two deal or pay terms (pre-money, lead investor, term sheet,
                valuation cap, salary ...) keep the file normal but are listed in
                its sensitive_terms, and INDEX.md says to keep them out of
                investor outputs

The JSON is the input for extract.py. Standard library only.

Usage:
  inventory.py <startup-folder> [--out pitch/intake/inventory.json] [--quiet]

Without --out the JSON goes to <startup-folder>/pitch/intake/inventory.json. An
explicit relative --out resolves against the current directory, as usual.

Exit codes: 0 success, 1 the walk found no files, 2 usage error.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import subprocess
import sys
import zipfile
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree

MAX_SIZE = 50 * 1024 * 1024
PEEK_BYTES = 2048
SKIP_DIRS = {".git", "node_modules", "pitch", "__pycache__", ".venv", "venv"}
STALE_DIR_NAMES = {"old", "archive", "archived", "deprecated", "superseded", "previous", "backup", "bak"}

TYPE_BY_EXT = {
    ".md": "markdown", ".markdown": "markdown", ".mdx": "markdown",
    ".txt": "text", ".rst": "text", ".log": "text", ".rtf": "text",
    ".yaml": "text", ".yml": "text", ".toml": "text", ".ini": "text", ".cfg": "text",
    ".csv": "csv", ".tsv": "csv",
    ".xlsx": "xlsx", ".xlsm": "xlsx", ".xls": "xlsx", ".ods": "xlsx", ".numbers": "xlsx",
    ".docx": "docx", ".doc": "docx", ".odt": "docx", ".pages": "docx",
    ".pdf": "pdf",
    ".pptx": "pptx", ".ppt": "pptx", ".odp": "pptx", ".key": "pptx",
    ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image", ".svg": "image",
    ".webp": "image", ".heic": "image", ".bmp": "image", ".tif": "image", ".tiff": "image",
    ".json": "json", ".jsonl": "json", ".geojson": "json",
    ".py": "code", ".js": "code", ".ts": "code", ".tsx": "code", ".jsx": "code", ".html": "code",
    ".htm": "code", ".css": "code", ".scss": "code", ".sh": "code", ".zsh": "code", ".rb": "code",
    ".go": "code", ".rs": "code", ".java": "code", ".kt": "code", ".swift": "code", ".c": "code",
    ".h": "code", ".cpp": "code", ".sql": "code", ".r": "code", ".ipynb": "code", ".xml": "code",
}

# Path signals. Each entry: (regex on the lowercased posix path, human reason).
CONFIDENTIAL_PATH_SIGNALS = [
    (r"confidential", "file name says confidential"),
    (r"do[-_ ]?not[-_ ]?share", "file name says do not share"),
    (r"term[-_ ]?sheet", "term sheet"),
    (r"cap[-_ ]?table", "cap table"),
    (r"salar(y|ies)", "salaries"),
    (r"payroll", "payroll"),
    (r"compensation", "compensation"),
    (r"(^|/)hr/", "hr/ folder"),
    (r"(^|/)legal/", "legal/ folder"),
    (r"contract", "contract"),
    (r"(^|[^a-z])nda([^a-z]|$)", "NDA"),
    (r"board[-_ ]?minutes", "board minutes"),
    (r"round[-_ ]?terms", "round terms"),
    (r"shareholder", "shareholder document"),
    (r"(^|[^a-z])safe[-_ ](agreement|note|terms)", "SAFE agreement"),
    (r"passport|iban|tax[-_ ]?(id|return)", "personal identifiers"),
]
SENSITIVE_PATH_SIGNALS = [
    (r"cap[-_ ]?table.*summary|summary.*cap[-_ ]?table", "cap table summary"),
    (r"investor[-_ ]?feedback|feedback[-_ ]?from[-_ ]?(seed|investors?|vcs?)|investor[-_ ]?objections?",
     "investor feedback"),
]
STRONG_CONTENT_SIGNALS = [
    (r"do not share", "content says do not share"),
    (r"confidential", "content says confidential"),
    (r"strictly private", "content says strictly private"),
]
WEAK_CONTENT_SIGNALS = [
    (r"pre[-\s]?money", "mentions pre-money"),
    (r"post[-\s]?money", "mentions post-money"),
    (r"lead investor", "mentions lead investor"),
    (r"liquidation preference", "mentions liquidation preference"),
    (r"term sheet", "mentions a term sheet"),
]
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
SALARY_TABLE_RE = re.compile(
    r"(salary|salaries|base pay|compensation|option grant)[^\n]{0,120}\n[^\n]*\|", re.IGNORECASE)

MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}


# ----------------------------------------------------------------------------
# Classification helpers
# ----------------------------------------------------------------------------

def classify_type(path: Path) -> str:
    return TYPE_BY_EXT.get(path.suffix.lower(), "other")


def strip_xml(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text)


def peek_text(path: Path, ftype: str) -> str:
    """Return up to ~2 KB of text from the start of a file, by type.

    Office formats are peeked through their zip XML, PDFs through pdftotext if
    present. Anything that fails returns an empty string; the peek is only a
    classification aid and must never make the inventory fail.
    """
    try:
        if ftype in {"markdown", "text", "csv", "json", "code", "other"}:
            with open(path, "rb") as fh:
                raw = fh.read(PEEK_BYTES)
            if b"\x00" in raw:
                return ""
            return raw.decode("utf-8", errors="replace")
        if ftype in {"xlsx", "docx", "pptx"} and zipfile.is_zipfile(path):
            chunks: list[str] = []
            with zipfile.ZipFile(path) as zf:
                names = zf.namelist()
                wanted = [n for n in names if n in ("xl/sharedStrings.xml", "word/document.xml")]
                wanted += sorted(n for n in names if re.match(r"xl/worksheets/sheet\d+\.xml$", n))[:2]
                wanted += sorted(n for n in names if re.match(r"ppt/slides/slide\d+\.xml$", n))[:3]
                for name in wanted:
                    data = zf.read(name)[:PEEK_BYTES * 8]
                    chunks.append(strip_xml(data.decode("utf-8", errors="replace")))
                    if sum(len(c) for c in chunks) > PEEK_BYTES:
                        break
            return " ".join(chunks)[:PEEK_BYTES]
        if ftype == "pdf":
            exe = which("pdftotext")
            if exe:
                res = subprocess.run([exe, "-l", "1", "-q", str(path), "-"],
                                     capture_output=True, text=True, timeout=30)
                return res.stdout[:PEEK_BYTES]
    except Exception:  # noqa: BLE001  peeking is best effort
        return ""
    return ""


def which(name: str) -> str | None:
    for d in os.environ.get("PATH", "").split(os.pathsep):
        cand = os.path.join(d, name)
        if os.path.isfile(cand) and os.access(cand, os.X_OK):
            return cand
    return None


FOOTER_ONLY_TYPES = {"pdf", "pptx"}
HARD_CONTENT_RE = re.compile(
    r"do not (share|distribute|forward|circulate)|internal only|not for distribution|strictly private",
    re.IGNORECASE)


# Deal and pay vocabulary. One or two of these anywhere in an otherwise normal file leave it
# normal (it is still extracted) but are recorded as sensitive_terms so the passage stays out
# of investor outputs. Three or more make the file sensitive.
FULL_SCAN_TYPES = {"markdown", "text", "csv", "json", "code", "other"}
FULL_SCAN_MAX = 300 * 1024
SENSITIVE_TERMS = [
    (r"pre[-\s]?money", "pre-money"),
    (r"post[-\s]?money", "post-money"),
    (r"lead investor", "lead investor"),
    (r"term[-\s]?sheet", "term sheet"),
    (r"valuation cap|(?-i:\bSAFE\b)[^.\n]{0,60}\bcap\b|\bcap\b[^.\n]{0,30}(?-i:\bSAFE\b)", "valuation cap"),
    (r"liquidation preference", "liquidation preference"),
    (r"\bsalar(?:y|ies)\b", "salary"),
    (r"\bpayroll\b", "payroll"),
    (r"\boption grants?\b", "option grant"),
]


def read_full_text(path: Path, ftype: str, size: int) -> str | None:
    """Whole text of a text-like file under 300 KB, else None (the 2 KB peek is used instead)."""
    if ftype not in FULL_SCAN_TYPES or size > FULL_SCAN_MAX:
        return None
    try:
        raw = path.read_bytes()
    except OSError:
        return None
    if b"\x00" in raw[:4096]:
        return None
    return raw.decode("utf-8", errors="replace")


def find_sensitive_terms(text: str) -> list[str]:
    return [label for pattern, label in SENSITIVE_TERMS if re.search(pattern, text, re.IGNORECASE)]


def classify_confidentiality(rel: str, peek: str, ftype: str = "",
                             full_text: str | None = None) -> tuple[str, list[str], list[str]]:
    """Return (classification, reasons, sensitive_terms)."""
    low = rel.lower()
    reasons: list[str] = []

    # Sensitive path rules win first: cap table summaries and investor feedback
    # naturally mention valuations, so content signals would over-flag them.
    for pattern, reason in SENSITIVE_PATH_SIGNALS:
        if re.search(pattern, low):
            reasons.append(reason)
    if reasons:
        for pattern, reason in WEAK_CONTENT_SIGNALS + STRONG_CONTENT_SIGNALS:
            if re.search(pattern, peek, re.IGNORECASE):
                reasons.append(reason)
        return "sensitive", reasons, []

    for pattern, reason in CONFIDENTIAL_PATH_SIGNALS:
        if re.search(pattern, low):
            reasons.append(reason)
    if reasons:
        return "confidential", reasons, []

    strong = [reason for pattern, reason in STRONG_CONTENT_SIGNALS if re.search(pattern, peek, re.IGNORECASE)]
    weak = [reason for pattern, reason in WEAK_CONTENT_SIGNALS if re.search(pattern, peek, re.IGNORECASE)]
    # Decks and PDFs handed to investors routinely carry a "Confidential" footer. For those
    # types a bare "confidential" is a weak signal unless the text also says do not share.
    if ftype in FOOTER_ONLY_TYPES and strong and not HARD_CONTENT_RE.search(peek):
        weak = ["boilerplate confidential footer"] + weak
        strong = []
    emails = set(EMAIL_RE.findall(peek))
    if len(emails) >= 5:
        weak.append(f"{len(emails)} email addresses in the first 2 KB")
    if SALARY_TABLE_RE.search(peek):
        weak.append("looks like a salary table")

    if strong:
        return "confidential", strong + weak, []
    body = full_text if full_text is not None else peek
    if full_text is not None and HARD_CONTENT_RE.search(full_text):
        return "confidential", ["content says do not share (past the first 2 KB)"] + weak, []
    if len(weak) >= 2:
        return "confidential", weak, []
    if weak:
        return "sensitive", weak, []
    terms = find_sensitive_terms(body)
    if len(terms) >= 3:
        return "sensitive", ["mentions " + ", ".join(terms)], terms
    return "normal", [], terms


# ----------------------------------------------------------------------------
# Staleness
# ----------------------------------------------------------------------------

DATE_PATTERNS = [
    # 2026-10-31, 2026_10_31, 20261031
    (re.compile(r"(?<!\d)(20\d\d)[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?!\d)"), "ymd"),
    # 2026-10, 2026_10
    (re.compile(r"(?<!\d)(20\d\d)[-_.](0[1-9]|1[0-2])(?!\d)"), "ym"),
    # 2026-Q3, 2026q3, Q3-2026, q3_2026
    (re.compile(r"(?<!\d)(20\d\d)[-_ ]?q([1-4])(?!\d)", re.IGNORECASE), "yq"),
    (re.compile(r"(?<![a-z])q([1-4])[-_ ]?(20\d\d)(?!\d)", re.IGNORECASE), "qy"),
    # nov-2026, november2026, 2026-nov
    (re.compile(r"(?<![a-z])(" + "|".join([
        "jan(?:uary)?", "feb(?:ruary)?", "mar(?:ch)?", "apr(?:il)?", "may", "jun(?:e)?", "jul(?:y)?",
        "aug(?:ust)?", "sep(?:t(?:ember)?)?", "oct(?:ober)?", "nov(?:ember)?", "dec(?:ember)?"])
        + r")(?![a-z])[-_ .]?(20\d\d)(?!\d)", re.IGNORECASE), "my"),
    (re.compile(r"(?<!\d)(20\d\d)[-_ .]?(" + "|".join([
        "jan(?:uary)?", "feb(?:ruary)?", "mar(?:ch)?", "apr(?:il)?", "may", "jun(?:e)?", "jul(?:y)?",
        "aug(?:ust)?", "sep(?:t(?:ember)?)?", "oct(?:ober)?", "nov(?:ember)?", "dec(?:ember)?"])
        + r")(?![a-z])", re.IGNORECASE), "ym_name"),
    # bare year
    (re.compile(r"(?<!\d)(20\d\d)(?!\d)"), "y"),
]
VERSION_RE = re.compile(r"(?<![a-z0-9])v(?:ersion)?[-_ ]?(\d+)(?:\.(\d+))?(?![a-z0-9])", re.IGNORECASE)
NOISE_WORDS = {"draft", "final", "copy", "old", "new", "latest", "backup", "bak", "wip", "tmp", "temp",
               "updated", "revised", "rev", "edit", "edited", "clean"}


def parse_name_date(stem: str) -> tuple[int, int, int] | None:
    low = stem.lower()
    for regex, kind in DATE_PATTERNS:
        m = regex.search(low)
        if not m:
            continue
        if kind == "ymd":
            return int(m.group(1)), int(m.group(2)), int(m.group(3))
        if kind == "ym":
            return int(m.group(1)), int(m.group(2)), 0
        if kind == "yq":
            return int(m.group(1)), int(m.group(2)) * 3, 0
        if kind == "qy":
            return int(m.group(2)), int(m.group(1)) * 3, 0
        if kind == "my":
            return int(m.group(2)), MONTHS[m.group(1)[:3]], 0
        if kind == "ym_name":
            return int(m.group(1)), MONTHS[m.group(2)[:3]], 0
        if kind == "y":
            return int(m.group(1)), 0, 0
    return None


def parse_version(stem: str) -> tuple[int, int] | None:
    m = VERSION_RE.search(stem)
    if not m:
        return None
    return int(m.group(1)), int(m.group(2) or 0)


def family_key(stem: str) -> str:
    """Name with dates, versions and noise words removed, for sibling matching."""
    low = stem.lower()
    for regex, _kind in DATE_PATTERNS:
        low = regex.sub(" ", low)
    low = VERSION_RE.sub(" ", low)
    tokens = [t for t in re.split(r"[^a-z0-9]+", low) if t and t not in NOISE_WORDS]
    return "-".join(tokens)


def fmt_date(d: tuple[int, int, int] | None) -> str:
    if not d:
        return ""
    y, m, day = d
    if m and day:
        return f"{y:04d}-{m:02d}-{day:02d}"
    if m:
        return f"{y:04d}-{m:02d}"
    return f"{y:04d}"


def flag_staleness(entries: list[dict]) -> None:
    """Mutate entries in place: set stale, stale_reason, superseded_by."""
    for e in entries:
        e["stale"] = False
        e["stale_reason"] = None
        e["superseded_by"] = None
        parts = PurePosixPath(e["path"]).parts[:-1]
        for p in parts:
            if p.lower() in STALE_DIR_NAMES:
                e["stale"] = True
                e["stale_reason"] = f"inside a {p}/ folder"
                break

    groups: dict[tuple[str, str, str], list[dict]] = {}
    for e in entries:
        p = PurePosixPath(e["path"])
        key = (str(p.parent), e["type"], family_key(p.stem))
        if key[2]:
            groups.setdefault(key, []).append(e)

    for key, members in groups.items():
        if len(members) < 2:
            continue
        ranked = []
        for e in members:
            stem = PurePosixPath(e["path"]).stem
            d = parse_name_date(stem)
            v = parse_version(stem)
            low = stem.lower()
            draft = 1 if re.search(r"(^|[^a-z])(draft|wip|old|backup|bak|copy)([^a-z]|$)", low) else 0
            final = 1 if re.search(r"(^|[^a-z])(final|latest)([^a-z]|$)", low) else 0
            ranked.append((e, d, v, draft, final))
        dates = [r[1] for r in ranked if r[1]]
        versions = [r[2] for r in ranked if r[2]]
        if not dates and not versions and not any(r[3] or r[4] for r in ranked):
            continue  # similar names but nothing that orders them

        def sort_key(r):
            e, d, v, draft, final = r
            return (d or (0, 0, 0), v or (0, 0), -draft, final, e["modified"])
        ranked.sort(key=sort_key)
        newest = ranked[-1]
        for r in ranked[:-1]:
            e, d, v, draft, final = r
            if e["stale"]:
                continue
            why = []
            if d and newest[1] and d != newest[1]:
                why.append(f"dated {fmt_date(d)} in name, newer sibling dated {fmt_date(newest[1])}")
            if v and newest[2] and v != newest[2]:
                why.append(f"version {v[0]} vs {newest[2][0]}")
            if draft and not newest[3]:
                why.append("draft while a non-draft sibling exists")
            if not why:
                if newest[4] and not final:
                    why.append("a sibling is marked final")
                else:
                    continue
            e["stale"] = True
            e["stale_reason"] = "; ".join(why)
            e["superseded_by"] = newest[0]["path"]

    # Files whose name carries a date more than 18 months older than the newest dated file
    # in the whole folder are probably historical. Flag as "possibly stale" without a successor.
    dated = [(parse_name_date(PurePosixPath(e["path"]).stem), e) for e in entries]
    dated = [(d, e) for d, e in dated if d]
    if dated:
        newest = max(d for d, _ in dated)
        newest_months = newest[0] * 12 + (newest[1] or 6)
        for d, e in dated:
            if e["stale"]:
                continue
            months = d[0] * 12 + (d[1] or 6)
            if newest_months - months > 18:
                e["stale"] = True
                e["stale_reason"] = (f"dated {fmt_date(d)} in name; newest dated material in the folder "
                                     f"is {fmt_date(newest)}")


# ----------------------------------------------------------------------------
# Walk
# ----------------------------------------------------------------------------

def walk(root: Path) -> tuple[list[dict], list[dict]]:
    entries: list[dict] = []
    skipped: list[dict] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS and not d.startswith("."))
        for name in sorted(filenames):
            if name.startswith("."):
                continue
            full = Path(dirpath) / name
            rel = full.relative_to(root).as_posix()
            try:
                st = full.stat()
            except OSError as exc:
                skipped.append({"path": rel, "reason": f"stat failed: {exc}"})
                continue
            if st.st_size > MAX_SIZE:
                skipped.append({"path": rel, "reason": f"over 50 MB ({st.st_size} bytes)"})
                continue
            ftype = classify_type(full)
            peek = peek_text(full, ftype)
            conf, reasons, terms = classify_confidentiality(
                rel, peek, ftype, read_full_text(full, ftype, st.st_size))
            entries.append({
                "path": rel,
                "name": name,
                "size": st.st_size,
                "type": ftype,
                "ext": full.suffix.lower(),
                "modified": dt.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%dT%H:%M:%S"),
                "name_date": fmt_date(parse_name_date(full.stem)) or None,
                "confidentiality": conf,
                "confidentiality_reasons": reasons,
                "sensitive_terms": terms,
            })
    flag_staleness(entries)
    return entries, skipped


def human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024
    return f"{n} B"


def print_summary(root: Path, entries: list[dict], skipped: list[dict], out: Path) -> None:
    by_type: dict[str, int] = {}
    by_conf: dict[str, int] = {}
    for e in entries:
        by_type[e["type"]] = by_type.get(e["type"], 0) + 1
        by_conf[e["confidentiality"]] = by_conf.get(e["confidentiality"], 0) + 1
    print(f"Inventory of {root}")
    print(f"{len(entries)} files, {len(skipped)} skipped, written to {out}\n")
    print(f"{'type':<10}{'count':>6}    {'classification':<15}{'count':>6}")
    conf_rows = [(k, by_conf[k]) for k in ("normal", "sensitive", "confidential") if k in by_conf]
    type_rows = sorted(by_type.items(), key=lambda kv: -kv[1])
    for i in range(max(len(type_rows), len(conf_rows))):
        left = f"{type_rows[i][0]:<10}{type_rows[i][1]:>6}" if i < len(type_rows) else " " * 16
        right = f"{conf_rows[i][0]:<15}{conf_rows[i][1]:>6}" if i < len(conf_rows) else ""
        print(f"{left}    {right}")

    print("\nFiles")
    print(f"{'path':<55}{'type':<10}{'size':>9}  {'class':<13}{'stale'}")
    for e in entries:
        stale = "stale" if e["stale"] else ""
        print(f"{e['path'][:54]:<55}{e['type']:<10}{human_size(e['size']):>9}  {e['confidentiality']:<13}{stale}")

    confidential = [e for e in entries if e["confidentiality"] == "confidential"]
    sensitive = [e for e in entries if e["confidentiality"] == "sensitive"]
    stale = [e for e in entries if e["stale"]]
    print(f"\nConfidential ({len(confidential)}), excluded from the corpus by default:")
    for e in confidential:
        print(f"  {e['path']}  [{', '.join(e['confidentiality_reasons'])}]")
    if not confidential:
        print("  none")
    flagged = [e for e in entries if e["confidentiality"] == "normal" and e.get("sensitive_terms")]
    print(f"\nNormal files with deal or pay terms ({len(flagged)}), extracted, keep those passages out of "
          "investor outputs:")
    for e in flagged:
        print(f"  {e['path']}  [{', '.join(e['sensitive_terms'])}]")
    if not flagged:
        print("  none")
    print(f"\nSensitive ({len(sensitive)}), extracted but not for the deck:")
    for e in sensitive:
        print(f"  {e['path']}  [{', '.join(e['confidentiality_reasons'])}]")
    if not sensitive:
        print("  none")
    print(f"\nStale ({len(stale)}):")
    for e in stale:
        succ = f" -> {e['superseded_by']}" if e["superseded_by"] else ""
        print(f"  {e['path']}  [{e['stale_reason']}]{succ}")
    if not stale:
        print("  none")
    if skipped:
        print(f"\nSkipped ({len(skipped)}):")
        for s in skipped:
            print(f"  {s['path']}  [{s['reason']}]")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="inventory.py",
        description="Walk a startup folder and write pitch/intake/inventory.json with type, "
                    "staleness and confidentiality per file.",
        epilog="Exit codes: 0 success, 1 no files found, 2 usage error.")
    parser.add_argument("folder", help="the startup's folder")
    parser.add_argument("--out", default=None,
                        help="where to write the JSON (default: <folder>/pitch/intake/inventory.json; "
                             "an explicit relative path resolves against the current directory)")
    parser.add_argument("--quiet", action="store_true", help="print only the one-line result")
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        return 0 if exc.code == 0 else 2

    root = Path(args.folder).expanduser().resolve()
    if not root.is_dir():
        print(f"error: {root} is not a directory", file=sys.stderr)
        return 2
    out = (root / "pitch" / "intake" / "inventory.json") if args.out is None else Path(args.out).expanduser()
    out = out.resolve()

    entries, skipped = walk(root)
    if not entries:
        print(f"error: no files found under {root}", file=sys.stderr)
        return 1

    by_type: dict[str, int] = {}
    for e in entries:
        by_type[e["type"]] = by_type.get(e["type"], 0) + 1
    payload = {
        "root": root.name,
        "root_note": "file paths below are relative to the startup folder; the absolute path is not stored so this file is safe to share",
        "generated_at": dt.datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "file_count": len(entries),
        "by_type": by_type,
        "confidential": [e["path"] for e in entries if e["confidentiality"] == "confidential"],
        "sensitive": [e["path"] for e in entries if e["confidentiality"] == "sensitive"],
        "contains_sensitive_terms": [e["path"] for e in entries
                                     if e["confidentiality"] == "normal" and e.get("sensitive_terms")],
        "stale": [e["path"] for e in entries if e["stale"]],
        "skipped": skipped,
        "files": entries,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    if args.quiet:
        print(f"{len(entries)} files, {len(payload['confidential'])} confidential, "
              f"{len(payload['stale'])} stale -> {out}")
    else:
        print_summary(root, entries, skipped, out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
