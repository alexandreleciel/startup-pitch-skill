#!/usr/bin/env python3
"""Re-verify every row of assets/library/pitch-decks.csv and write verified_status / verified_at back.

Method (per row, standard library only):
  1. GET source_url with a browser User-Agent, following redirects. Record HTTP status and final URL.
  2. redirect: final URL differs from source_url (ignoring scheme, trailing slash, query) but returned 200.
  3. Page must be about the company: <title> or og:title contains the company name (catches silent
     "Not Found" pages served with HTTP 200).
  4. Aggregator pages must carry a deck signal: slideshare.net/slideshow/embed_code/key/, drive.google.com/file/d/,
     youtube.com/embed/, or >= 5 slide images (alexanderjarvis.com). The signal also sets deck_format and, for
     slide images, slide_count when they are blank.
  5. slideshare.net itself is never fetched (bot challenge page); the aggregator-page signal stands in for it.
  6. Status: ok | redirect | missing (404/410, title mismatch, no deck signal) | blocked (403, 429, network error,
     bot challenge).
Pacing per host: bestpitchdeck.com 1 request / 2.6 s, alexanderjarvis.com 0.5 s, businessinsider.com 0.5 s,
pitchdeckhunt.com 0.15 s, everything else 0.5 s. Hosts run in parallel, each host sequentially.

Usage:
  python3 scripts/library_verify.py                 # all rows
  python3 scripts/library_verify.py --limit 20      # first 20 rows
  python3 scripts/library_verify.py --only-missing  # rows whose status is not ok
  python3 scripts/library_verify.py --dry-run       # do not write the CSV
"""
import argparse
import csv
import datetime as dt
import html
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CSV = os.path.normpath(os.path.join(HERE, "..", "assets", "library", "pitch-decks.csv"))
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
PACING = {"bestpitchdeck.com": 2.6, "www.alexanderjarvis.com": 0.5, "www.businessinsider.com": 0.5,
          "www.pitchdeckhunt.com": 0.15, "www.failory.com": 0.5}
COLS = ["id", "company", "round", "year", "amount_usd", "sector", "geography", "source_site", "source_url",
        "deck_format", "slide_count", "outcome_note", "verified_status", "verified_at", "notes"]


def norm_url(u):
    p = urllib.parse.urlparse(u)
    host = p.netloc.lower().replace("www.", "")
    return host + p.path.rstrip("/").lower()


def get(url, timeout=40):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,*/*"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            ctype = r.headers.get("Content-Type", "")
            body = r.read(3_000_000)
            text = body.decode("utf-8", "replace") if "pdf" not in ctype else ""
            return r.status, r.geturl(), ctype, text, len(body)
    except urllib.error.HTTPError as e:
        try:
            text = e.read(200_000).decode("utf-8", "replace")
        except Exception:
            text = ""
        return e.code, e.geturl() or url, e.headers.get("Content-Type", "") if e.headers else "", text, 0
    except Exception as e:
        return 0, url, "", str(e), 0


def company_in_title(company, text):
    t = re.search(r'<meta property="og:title" content="([^"]*)"', text)
    title = html.unescape(t.group(1)) if t else ""
    t2 = re.search(r"<title>(.*?)</title>", text, flags=re.S)
    title += " " + (html.unescape(t2.group(1)) if t2 else "")
    ck = re.sub(r"[^a-z0-9]", "", company.lower().split("(")[0])
    tk = re.sub(r"[^a-z0-9]", "", title.lower())
    if not ck:
        return False
    if ck in tk:
        return True
    first = re.sub(r"[^a-z0-9]", "", company.lower().split()[0]) if company.split() else ck
    return len(first) >= 4 and first in tk


def deck_signal(text):
    """Return (deck_format, slide_count) detected on an aggregator page, or ("", "")."""
    if re.search(r"slideshare\.net/slideshow/embed_code/key/\w+", text):
        return "slideshare_embed", ""
    if re.search(r"drive\.google\.com/file/d/[\w-]+", text):
        return "drive_embed", ""
    if re.search(r"youtube\.com/embed/[\w-]+", text):
        return "article", ""
    imgs = re.findall(r"https://cdn\.alexanderjarvis\.com/[^\"'\s)]+?\.(?:avif|png|jpg|jpeg|webp)", text)
    slides = []
    for u in dict.fromkeys(imgs):
        fn = u.rsplit("/", 1)[-1]
        if (re.search(r"_Page_\d+", fn) or re.match(r"\d{1,2}-?[A-Za-z].*pitch-deck", fn, flags=re.I)
                or re.search(r"(?:^|[-_])slide[-_]?\d+|-deck-\d+-", fn, flags=re.I)) and not re.search(r"-\d{2,4}x\d{2,4}\.", fn):
            slides.append(u)
    if len(slides) >= 5:
        return "images", str(len(slides))
    if re.search(r"\.pdf[\"'?]", text) and re.search(r"<embed|<object|pdf-viewer|pdfjs", text, flags=re.I):
        return "pdf", ""
    return "", ""


AGGREGATORS = ("pitchdeckhunt.com", "bestpitchdeck.com", "failory.com", "alexanderjarvis.com")


def verify_row(row):
    url = row["source_url"]
    host = urllib.parse.urlparse(url).netloc.lower()
    status, final, ctype, text, size = get(url)
    result = {"http": status, "final": final}
    if status in (403, 429) or status == 0:
        result["status"] = "blocked"
        return result
    if status in (404, 410) or status >= 500:
        result["status"] = "missing"
        return result
    if status != 200:
        result["status"] = "missing"
        return result
    if "slideshare.net" in host and size < 6000:
        result["status"] = "blocked"  # bot challenge page
        return result
    if "pdf" in ctype:
        result["status"] = "ok" if size > 50_000 else "missing"
        result["deck_format"] = "pdf"
        return result
    if not company_in_title(row["company"], text):
        result["status"] = "missing"
        result["why"] = "title mismatch"
        return result
    fmt, cnt = deck_signal(text)
    is_agg = any(a in host for a in AGGREGATORS)
    if is_agg and not fmt:
        result["status"] = "missing"
        result["why"] = "no deck signal"
        return result
    if fmt:
        result["deck_format"] = fmt
        if cnt:
            result["slide_count"] = cnt
    elif not row["deck_format"]:
        result["deck_format"] = "article"
    result["status"] = "redirect" if norm_url(final) != norm_url(url) else "ok"
    return result


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", default=DEFAULT_CSV)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--only-missing", action="store_true", help="only rows whose verified_status is not ok")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--quiet", action="store_true")
    a = ap.parse_args()

    with open(a.csv, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    todo = [r for r in rows if not a.only_missing or r["verified_status"] != "ok"]
    if a.limit:
        todo = todo[: a.limit]
    by_host = defaultdict(list)
    for r in todo:
        by_host[urllib.parse.urlparse(r["source_url"]).netloc.lower()].append(r)
    today = dt.date.today().isoformat()
    lock = threading.Lock()
    done = [0]

    def run_host(host, items):
        gap = PACING.get(host, 0.5)
        for r in items:
            res = verify_row(r)
            if res["status"] == "blocked" and res.get("http") == 429:
                time.sleep(15)
                res = verify_row(r)
            with lock:
                r["verified_status"] = res["status"]
                r["verified_at"] = today
                if res.get("deck_format") and (not r["deck_format"] or r["deck_format"] != res["deck_format"]):
                    r["deck_format"] = res["deck_format"]
                if res.get("slide_count") and not r["slide_count"]:
                    r["slide_count"] = res["slide_count"]
                if res["status"] == "redirect":
                    tag = "redirects to " + res["final"]
                    if tag not in r["notes"]:
                        r["notes"] = (r["notes"] + "; " if r["notes"] else "") + tag
                done[0] += 1
                if not a.quiet:
                    print("[%3d/%d] %-8s %-4s %-24s %s %s" % (done[0], len(todo), res["status"], res.get("http"),
                                                             r["company"][:24], r["source_url"], res.get("why", "")),
                          flush=True)
            time.sleep(gap)

    threads = [threading.Thread(target=run_host, args=(h, items)) for h, items in by_host.items()]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    dist = Counter(r["verified_status"] for r in rows)
    print("\nverified_status distribution (all %d rows): %s" % (len(rows), dict(dist)))
    if a.dry_run:
        return
    tmp = a.csv + ".tmp"
    with open(tmp, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in COLS})
    os.replace(tmp, a.csv)
    print("wrote", a.csv)


if __name__ == "__main__":
    main()
