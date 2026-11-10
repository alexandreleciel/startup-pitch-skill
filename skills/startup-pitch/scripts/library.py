#!/usr/bin/env python3
"""Search the pitch deck reference library (assets/library/pitch-decks.csv). No dependencies.

Examples:
  python3 scripts/library.py --sector fintech --round seed --year-from 2020 --limit 10
  python3 scripts/library.py --company airbnb
  python3 scripts/library.py --random 5
  python3 scripts/library.py --stats
  python3 scripts/library.py --round series-a --sector saas --status ok --format drive_embed
  python3 scripts/library.py --comparables --sector saas --round seed   (three decks to study, always returns three)

Rounds: pre-seed, seed, series-a, series-b, series-c, series-d+, growth, ipo, unknown
Sectors: fintech, saas, marketplace, consumer, healthtech, biotech, edtech, hardware, deeptech, ai, climate,
         mobility, proptech, foodtech, media, gaming, devtools, security, hr, logistics, other
"""
import argparse
import csv
import os
import random
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CSV = os.path.normpath(os.path.join(HERE, "..", "assets", "library", "pitch-decks.csv"))


def load(path):
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def money(v):
    if not v:
        return "-"
    try:
        n = float(v)
    except ValueError:
        return v
    if n >= 1e9:
        return "$%.1fB" % (n / 1e9)
    if n >= 1e6:
        s = "%.1f" % (n / 1e6)
        return "$" + (s[:-2] if s.endswith(".0") else s) + "M"
    if n >= 1e3:
        return "$%dK" % round(n / 1e3)
    return "$%d" % n


def matches(row, a):
    if a.sector and row["sector"] != a.sector:
        return False
    if a.round and row["round"] != a.round:
        return False
    if a.company and a.company.lower() not in row["company"].lower():
        return False
    if a.status and row["verified_status"] != a.status:
        return False
    if a.format and row["deck_format"] != a.format:
        return False
    if a.source and a.source not in row["source_site"]:
        return False
    y = int(row["year"]) if row["year"].isdigit() else None
    if a.year_from and (y is None or y < a.year_from):
        return False
    if a.year_to and (y is None or y > a.year_to):
        return False
    if a.min_amount:
        try:
            if float(row["amount_usd"] or 0) < a.min_amount:
                return False
        except ValueError:
            return False
    return True


def print_table(rows, show_notes=False):
    if not rows:
        print("no rows match")
        return
    cols = [("id", 6), ("company", 22), ("round", 9), ("year", 4), ("amount", 8), ("sector", 11), ("fmt", 16),
            ("status", 8), ("source_url", 0)]
    print("  ".join(name.ljust(w) if w else name for name, w in cols))
    for r in rows:
        vals = [r["id"], r["company"][:22], r["round"], r["year"] or "-", money(r["amount_usd"]), r["sector"],
                (r["deck_format"] or "-")[:16], r["verified_status"] or "-", r["source_url"]]
        print("  ".join(v.ljust(w) if w else v for v, (_, w) in zip(vals, cols)))
        if show_notes:
            extra = []
            if r["slide_count"]:
                extra.append("slides: " + r["slide_count"])
            if r["outcome_note"]:
                extra.append("outcome: " + r["outcome_note"])
            if r["notes"]:
                extra.append("notes: " + r["notes"])
            if extra:
                print("        " + " | ".join(extra))
    print("(%d rows)" % len(rows))


def stats(rows):
    print("rows: %d" % len(rows))

    def block(title, counter, key=None):
        print("\n%s" % title)
        items = counter.most_common() if key is None else sorted(counter.items(), key=key)
        for k, v in items:
            print("  %-14s %4d  %s" % (k or "(blank)", v, "#" * min(v, 60)))
    block("by verified_status", Counter(r["verified_status"] for r in rows))
    block("by round", Counter(r["round"] for r in rows))
    block("by sector", Counter(r["sector"] for r in rows))
    block("by source_site", Counter(r["source_site"] for r in rows))
    block("by deck_format", Counter(r["deck_format"] for r in rows))
    dec = Counter()
    for r in rows:
        y = r["year"]
        dec[(y[:3] + "0s") if y.isdigit() else "unknown"] += 1
    block("by decade", dec, key=lambda kv: kv[0])
    block("by year", Counter(r["year"] or "unknown" for r in rows), key=lambda kv: kv[0])
    recent = sum(1 for r in rows if r["year"].isdigit() and int(r["year"]) >= 2022)
    complete = sum(1 for r in rows if r["year"] and r["amount_usd"] and r["round"] != "unknown" and r["sector"] != "other")
    print("\nrows 2022-2026: %d\nrows with round+year+amount+sector: %d\nrows with slide_count: %d" % (
        recent, complete, sum(1 for r in rows if r["slide_count"])))


ROUND_ORDER = ["pre-seed", "seed", "series-a", "series-b", "series-c", "series-d+", "growth", "ipo"]
CURATED_MD = os.path.normpath(os.path.join(HERE, "..", "references", "deck-library.md"))


def curated_index():
    """Map lowercased company name -> heading text, for decks studied slide by slide in deck-library.md."""
    idx = {}
    try:
        with open(CURATED_MD, encoding="utf-8") as f:
            for line in f:
                if line.startswith("### "):
                    head = line[4:].strip()
                    name = head.split(",")[0].split("(")[0].strip().lower()
                    if name and not name.startswith("theranos (see"):
                        idx.setdefault(name, head)
    except OSError:
        pass
    return idx


def comparables(rows, sector, rnd, n=3):
    """Always return n decks: exact sector and round first, then widen. Decks studied slide by
    slide (in references/deck-library.md) rank first because their structure notes are ready."""
    cur = curated_index()
    ok = [r for r in rows if r["verified_status"] == "ok" and r["deck_format"] != "article"]

    def is_curated(r):
        c = r["company"].lower()
        return any(c == k or c.startswith(k + " ") or k.startswith(c + " ") for k in cur)

    def round_gap(r):
        if not rnd or r["round"] not in ROUND_ORDER or rnd not in ROUND_ORDER:
            return 9
        return abs(ROUND_ORDER.index(r["round"]) - ROUND_ORDER.index(rnd))

    def score(r):
        same_sector = bool(sector) and r["sector"] == sector
        gap = round_gap(r)
        return (
            -(4 if same_sector and gap == 0 else 3 if same_sector and gap == 1 else 2 if gap == 0 else 1 if same_sector else 0),
            not is_curated(r),
            not r["slide_count"],
            -(int(r["year"]) if r["year"].isdigit() else 0),
        )

    picked, seen = [], set()
    for r in sorted(ok, key=score):
        key = r["company"].lower()
        if key in seen:
            continue
        seen.add(key)
        picked.append(r)
        if len(picked) == n:
            break
    # Make sure one of the three is a deck with ready structure notes, if the sector or round has one.
    if picked and not any(is_curated(r) for r in picked):
        cands = [r for r in sorted(ok, key=score) if is_curated(r) and r["company"].lower() not in {p["company"].lower() for p in picked}
                 and ((sector and r["sector"] == sector) or round_gap(r) <= 1)]
        if cands:
            picked[-1] = cands[0]
    print("Three decks to study for structure and headline patterns. Never copy their numbers.")
    for r in picked:
        same_sector = bool(sector) and r["sector"] == sector
        why = "same sector and round" if same_sector and round_gap(r) == 0 else \
              "same sector, adjacent round" if same_sector and round_gap(r) == 1 else \
              "same round, other sector" if round_gap(r) == 0 else \
              "same sector" if same_sector else "closest available"
        print("- %s, %s, %s, %s (%s). %s" % (r["company"], r["round"], r["year"] or "year unknown",
                                               money(r["amount_usd"]), why, r["source_url"]))
        if r["slide_count"]:
            print("    slides: %s" % r["slide_count"])
        c = r["company"].lower()
        for k, head in cur.items():
            if c == k or c.startswith(k + " ") or k.startswith(c + " "):
                print("    studied slide by slide: references/deck-library.md, heading \"%s\"" % head[:70])
                break
    if not any(bool(sector) and r["sector"] == sector and round_gap(r) == 0 for r in picked):
        print("Note: the library has no verified deck for exactly this sector and round; these are the nearest.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", default=DEFAULT_CSV)
    ap.add_argument("--sector")
    ap.add_argument("--round", dest="round")
    ap.add_argument("--company", help="case-insensitive substring")
    ap.add_argument("--year-from", type=int)
    ap.add_argument("--year-to", type=int)
    ap.add_argument("--min-amount", type=float, help="USD")
    ap.add_argument("--status", help="ok | redirect | missing | blocked")
    ap.add_argument("--format", help="slideshare_embed | drive_embed | images | pdf | article")
    ap.add_argument("--source", help="substring of source_site")
    ap.add_argument("--random", type=int, metavar="N", help="N random rows (after filters)")
    ap.add_argument("--limit", type=int, default=25)
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--notes", action="store_true", help="also print slide_count, outcome_note and notes")
    ap.add_argument("--seed", type=int, help="random seed")
    ap.add_argument("--comparables", action="store_true",
                    help="three decks to study for this --sector and --round; widens the search so it always returns three")
    a = ap.parse_args()
    rows = load(a.csv)
    if a.stats:
        stats(rows)
        return
    if a.comparables:
        comparables(rows, a.sector, a.round)
        return
    rows = [r for r in rows if matches(r, a)]
    if a.random:
        if a.seed is not None:
            random.seed(a.seed)
        rows = random.sample(rows, min(a.random, len(rows)))
    else:
        # verified ok first, then complete rows, then newest
        rows.sort(key=lambda r: (r["verified_status"] != "ok", not (r["year"] and r["amount_usd"]),
                                 -(int(r["year"]) if r["year"].isdigit() else 0), r["company"].lower()))
        rows = rows[: a.limit]
    print_table(rows, show_notes=a.notes)


if __name__ == "__main__":
    main()
