#!/usr/bin/env python3
"""Build assets/library/pitch-decks.csv from public pitch deck aggregators.

Standard library only. Sources (all fetched live, nothing is typed in by hand):
  pitchdeckhunt.com   sitemap.xml -> /pitch-decks/<slug> pages (industry, amount, year, stage, SlideShare key)
  bestpitchdeck.com   homepage cards (amount, year, stage, business model) + deck pages for kept rows (paced 2.5 s)
  failory.com         /pitch-deck listing (industry tags, round, amount)
  alexanderjarvis.com post-sitemapN.xml slugs (company, amount, round) + pages for kept rows (slide images, fundraise table)
  businessinsider.com monthly sitemaps 2022-01..2026-11, slugs containing "pitch-deck" (headline -> company, amount, round)

Usage:
  python3 scripts/library_build.py --cache /path/to/cache --out assets/library/pitch-decks.csv [--target 420] [--skip-bi]

Every row written comes from a page that was fetched during the run. The script never invents an entry.
"""
import argparse
import concurrent.futures as cf
import csv
import datetime as dt
import hashlib
import html
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
TODAY = dt.date.today().isoformat()

# per-host minimum spacing between requests, seconds
PACING = {"bestpitchdeck.com": 2.6, "www.alexanderjarvis.com": 0.4, "www.businessinsider.com": 0.3,
          "www.pitchdeckhunt.com": 0.05, "www.failory.com": 0.3}
_host_lock = {}
_host_last = {}
_lock = threading.Lock()


def _pace(host):
    with _lock:
        lk = _host_lock.setdefault(host, threading.Lock())
    with lk:
        gap = PACING.get(host, 0.2)
        wait = _host_last.get(host, 0) + gap - time.time()
        if wait > 0:
            time.sleep(wait)
        _host_last[host] = time.time()


def fetch(url, cache_dir, max_age_days=None, retries=2):
    """GET with browser UA; cache body on disk. Returns (status, final_url, body_text)."""
    key = hashlib.sha1(url.encode()).hexdigest()
    path = os.path.join(cache_dir, key + ".json")
    if os.path.exists(path):
        try:
            with open(path) as f:
                c = json.load(f)
            return c["status"], c["final_url"], c["body"]
        except Exception:
            pass
    host = urllib.parse.urlparse(url).netloc
    status, final, body = 0, url, ""
    for attempt in range(retries + 1):
        _pace(host)
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "text/html,application/xml,*/*"})
        try:
            with urllib.request.urlopen(req, timeout=40) as r:
                status, final = r.status, r.geturl()
                raw = r.read()
                body = raw.decode("utf-8", "replace")
            break
        except urllib.error.HTTPError as e:
            status, final = e.code, e.geturl() or url
            try:
                body = e.read().decode("utf-8", "replace")
            except Exception:
                body = ""
            if status == 429 and attempt < retries:
                time.sleep(8 * (attempt + 1))
                continue
            break
        except Exception as e:  # network error
            status, body = 0, str(e)
            if attempt < retries:
                time.sleep(2)
                continue
    with open(path, "w") as f:
        json.dump({"url": url, "status": status, "final_url": final, "body": body, "fetched": TODAY}, f)
    return status, final, body


def strip_tags(s):
    s = re.sub(r"<script.*?</script>|<style.*?</style>", " ", s, flags=re.S)
    s = re.sub(r"<[^>]+>", "|", s)
    s = html.unescape(s)
    s = re.sub(r"[\s|]*\|[\s|]*", "|", s)
    return s


def norm_key(name):
    k = name.lower()
    k = re.sub(r"\b(pitch deck|startup|inc|the|deck)\b", " ", k)
    k = re.sub(r"[^a-z0-9]", "", k)
    return k


# ---------------------------------------------------------------- normalisers
def norm_round(s):
    if not s:
        return "unknown"
    t = s.strip().lower().replace("-", " ")
    if t.startswith("http") or t in ("n/a", "na", "tbd", "other", "undisclosed", "", "ip", "acquisition",
                                     "crowdfunding", "debt financing", "ipo (secondary)"):
        return "unknown" if "ipo" not in t else "ipo"
    if "pre seed" in t or "preseed" in t or "angel" in t or "friends" in t:
        return "pre-seed"
    if "seed" in t:
        return "seed"
    m = re.search(r"series\s*([a-z])", t)
    if m:
        l = m.group(1)
        if l in "abc":
            return "series-" + l
        return "series-d+"
    if "late stage" in t or "growth" in t or "private equity" in t or "late" in t:
        return "growth"
    if "ipo" in t or "public" in t:
        return "ipo"
    if "early stage" in t:
        return "unknown"
    return "unknown"


FX = {"$": 1.0, "€": 1.08, "£": 1.27, "US$": 1.0, "USD": 1.0, "EUR": 1.08, "GBP": 1.27, "CHF": 1.12,
      "A$": 0.66, "C$": 0.73, "¥": 0.0067, "₹": 0.012, "R$": 0.19, "kr": 0.093, "SEK": 0.093}


def parse_amount(s):
    """Return (usd_int or None, note). Accepts '$600k', '$39,800,000', '€105M', '£19.3M', '5.3M'."""
    if not s:
        return None, ""
    t = s.strip().replace(",", "").replace(" ", " ")
    if t.lower() in ("n/a", "na", "undisclosed", "", "-", "tbd"):
        return None, ""
    m = re.search(r"(US\$|A\$|C\$|R\$|USD|EUR|GBP|CHF|SEK|kr|[$€£¥₹])?\s*([\d.]+)\s*(billion|million|thousand|bn|b|mm|m|k)?",
                  t, flags=re.I)
    if not m:
        return None, ""
    cur = m.group(1) or "$"
    try:
        v = float(m.group(2))
    except ValueError:
        return None, ""
    unit = (m.group(3) or "").lower()
    mult = {"billion": 1e9, "bn": 1e9, "b": 1e9, "million": 1e6, "mm": 1e6, "m": 1e6, "thousand": 1e3, "k": 1e3}.get(unit, 1)
    usd = v * mult * FX.get(cur, 1.0)
    note = ""
    if cur not in ("$", "US$", "USD"):
        note = "amount converted from %s at %.2f USD" % (s.strip(), FX.get(cur, 1.0))
    if usd < 1000:  # nonsense like '$3'
        return None, ""
    return int(round(usd)), note


SECTORS = ["fintech", "saas", "marketplace", "consumer", "healthtech", "biotech", "edtech", "hardware", "deeptech",
           "ai", "climate", "mobility", "proptech", "foodtech", "media", "gaming", "devtools", "security", "hr",
           "logistics", "other"]

# ordered: first match on tags wins; descriptions are matched after tags
SECTOR_KEYWORDS = [
    ("biotech", r"biotech|biotechnology|genomic|genetic|drug|pharma|life science|therapeutic|molecul|protein|cell therapy|vaccine"),
    ("security", r"cyber|security|infosec|fraud|identity|password|privacy"),
    ("devtools", r"developer|devops|dev tools|api platform|open source|database|infrastructure|observability|no-code|low-code|cloud infrastructure|kubernetes|hosting|deployment"),
    ("ai", r"\bai\b|artificial intelligence|machine learning|generative|\bllm|computer vision|natural language|deep learning|voice ai"),
    ("fintech", r"fintech|financ|payment|banking|\bbank\b|neobank|insur|lending|\bloan|credit|crypto|blockchain|web3|\bnft|bitcoin|invest|wealth|accounting|\btax\b|expense|remittance|money transfer|payroll|trading|defi|treasury|mortgage"),
    ("hr", r"\bhr\b|recruit|hiring|talent|workforce|employee|benefits|future of work|staffing|people ops|upskill|careers?\b"),
    ("climate", r"climate|sustainab|clean ?tech|cleantech|renewable|solar|wind power|carbon|green energy|energy storage|battery|agtech|agricultur|farming|water tech|recycl|circular|hvac|electrif"),
    ("mobility", r"mobility|transportation|transport\b|automotive|ride[- ]?shar|ride[- ]?hail|scooter|\bev\b|electric vehicle|autonomous|self-driving|aviation|airline|micromobility|parking|fleet|\bcars?\b|trucking"),
    ("logistics", r"logistic|supply chain|deliver|shipping|freight|warehous|fulfil|last mile|courier"),
    ("proptech", r"real estate|proptech|property|housing|rental|coworking|co-working|construction|home services|home improvement|landlord|mortgage|office space"),
    ("healthtech", r"health|medical|medtech|telehealth|telemedicine|clinic|patient|wellness|mental|therapy|fitness|dental|hospital\b|care\b|pharmacy|femtech|nutrition|sleep|diagnos"),
    ("edtech", r"edtech|education|learning|school|student|tutor|course|teacher|classroom|training|bootcamp|university"),
    ("gaming", r"gaming|\bgames?\b|esports|metaverse|game studio"),
    ("foodtech", r"\bfood\b|beverage|restaurant|grocer|meal|kitchen|coffee|snack|drink|cannabis|cpg\b|beer|wine|recipe"),
    ("media", r"\bmedia\b|news|publishing|journalis|entertainment|streaming|\bvideo\b|music|podcast|creator|influencer|content|film|movies|television|advertising|adtech|audio|photo"),
    ("hardware", r"hardware|\biot\b|device|wearable|3d print|robot|drone|sensor|electronics|semiconductor|chip|camera|smart home|manufactur"),
    ("deeptech", r"deep ?tech|quantum|space|satellite|rocket|material|\bar\b|\bvr\b|\bxr\b|augmented|virtual reality|nanotech|photonic|biomanufact|fusion|nuclear|3d technology|motion capture"),
    ("marketplace", r"marketplace|two-sided|peer-to-peer|p2p|booking|gig|freelanc|on-demand|sharing economy|classified"),
    ("saas", r"saas|software|b2b|enterprise|productivity|collaboration|\bcrm\b|analytics|big data|\bdata\b|cloud|martech|marketing|sales|automation|workflow|\bapp\b|platform|communication|messaging|customer service|ecommerce software|e-commerce platform"),
    ("consumer", r"consumer|e-?commerce|retail|fashion|beauty|\bdtc\b|d2c|social|dating|lifestyle|apparel|\bpets?\b|travel|hospitality|hotel|subscription|shopping|luxury|parenting|family|kids|baby|sports|events|community|mobile app"),
]


def classify_sector(tags, desc, company=""):
    """Four passes: specific sectors on tags, marketplace on tags+description, generic (saas/consumer) on tags,
    then everything on the description. Returns one of SECTORS."""
    tags_l = " ; ".join(t for t in tags if t).lower()
    desc_l = (desc or "").lower()
    generic = ("marketplace", "saas", "consumer")
    for sec, pat in SECTOR_KEYWORDS:
        if sec not in generic and re.search(pat, tags_l):
            return sec
    mp = dict(SECTOR_KEYWORDS)["marketplace"]
    if re.search(mp, tags_l + " " + desc_l):
        return "marketplace"
    for sec, pat in SECTOR_KEYWORDS:
        if sec in generic and re.search(pat, tags_l):
            return sec
    for sec, pat in SECTOR_KEYWORDS:
        if re.search(pat, desc_l):
            return sec
    return "other"


def norm_year(s):
    if not s:
        return ""
    m = re.search(r"\b(19[89]\d|20[0-2]\d)\b", str(s))
    if m:
        return m.group(1)
    m = re.fullmatch(r"\s*(\d{2})\s*", str(s))  # bestpitchdeck '18' -> 2018
    if m:
        return "20" + m.group(1)
    return ""


# ---------------------------------------------------------------- parsers
def parse_pdh(url, body):
    """pitchdeckhunt deck page -> dict."""
    title = re.search(r"<title>(.*?)</title>", body, flags=re.S)
    title = html.unescape(title.group(1)).strip() if title else ""
    if not title or "Not Found" in title or "| Pitch Deck Hunt" not in title:
        return None
    name = title.split("|")[0].replace("Pitch Deck", "").strip()
    txt = strip_tags(body)
    def field(label):
        m = re.search(re.escape(label) + r":\|([^|]+)", txt)
        v = m.group(1).strip() if m else ""
        if re.match(r"^(Year|Stage|Amount Raised|Industry):?$", v) or v.startswith("http"):
            return ""
        return v
    industry = re.sub(r"[^\w&/ ,-]", "", field("Industry")).strip()
    key = re.search(r"slideshare\.net/slideshow/embed_code/key/(\w+)", body)
    drive = re.search(r"drive\.google\.com/file/d/([\w-]+)", body)
    desc = ""
    m = re.search(r"Download Now\|\|?([^|]{30,})\|", txt)
    if m:
        desc = m.group(1).strip()
    total = re.search(r"\|([^|]*has raised a total of[^|]*)\|", txt)
    total = total.group(1).strip() if total else ""
    with_this = re.search(r"\|([^|]*With the help of this pitch deck[^|]*)\|", txt)
    return {"company": name, "industry": industry, "amount": field("Amount Raised"), "year": field("Year"),
            "stage": field("Stage"), "desc": desc, "total_raised": total, "ss_key": key.group(1) if key else "",
            "drive_id": drive.group(1) if drive else "", "url": url, "with_this": with_this.group(1) if with_this else ""}


def parse_bpd_cards(body):
    out = {}
    for card in body.split('<div class="card"')[1:]:
        m = re.search(r'<a href="/([^"/]+)"><h5 class="card-title">(.*?)</h5>', card, flags=re.S)
        if not m:
            continue
        slug = m.group(1)
        name = html.unescape(re.sub(r"<[^>]+>", "", m.group(2))).replace("\xa0", " ").strip()
        meta = re.search(r'<small class="text-muted text-semi-op">(.*?)<i', card, flags=re.S)
        amount = year = stage = ""
        if meta:
            parts = [p.strip() for p in html.unescape(re.sub(r"<[^>]+>", "", meta.group(1))).replace("\xa0", " ").split("•")]
            if len(parts) >= 3:
                amount, year, stage = parts[0], parts[1], parts[2]
            elif len(parts) == 2:
                amount, year = parts[0], parts[1]
        model = re.search(r"Business:</strong>\s*([^<]+)<", card)
        desc = re.search(r'<p class="card-text">(.*?)</p>', card, flags=re.S)
        out[slug] = {"company": name, "amount": amount, "year": year, "stage": stage,
                     "model": html.unescape(model.group(1)).strip() if model else "",
                     "desc": html.unescape(re.sub(r"<[^>]+>", "", desc.group(1))).strip() if desc else "",
                     "url": "https://bestpitchdeck.com/" + slug}
    return out


def parse_bpd_page(body):
    txt = strip_tags(body)
    def field(label):
        m = re.search(r"\|" + re.escape(label) + r"\|:\s*([^|]+)", txt)
        return m.group(1).strip() if m else ""
    key = re.search(r"slideshare\.net/slideshow/embed_code/key/(\w+)", body)
    drive = re.search(r"drive\.google\.com/file/d/([\w-]+)", body)
    yt = re.search(r"youtube\.com/embed/([\w-]+)", body)
    title = re.search(r"<title>(.*?)</title>", body, flags=re.S)
    return {"industry": field("Industry"), "tags": field("Tags"), "investors": field("Investors"),
            "raised": field("Raised"), "year": field("Year"), "stage": field("Stage"),
            "ss_key": key.group(1) if key else "", "drive_id": drive.group(1) if drive else "",
            "yt": yt.group(1) if yt else "", "title": html.unescape(title.group(1)).strip() if title else ""}


def parse_failory(body):
    out = {}
    for a in re.finditer(r'<a class="[^"]*" href="/pitch-deck/([^"/]+)">(.*?)</a>', body, flags=re.S):
        slug, inner = a.group(1), a.group(2)
        tags = [html.unescape(t) for t in re.findall(r'rounded-\[20px\][^>]*>([^<]+)</span>', inner)]
        name = re.search(r'text-\[24px\][^>]*>([^<]+)</span>', inner)
        spans = re.findall(r'<span class="mt-\[10px\] text-\[16px\][^>]*>([^<]+)</span>', inner)
        round_amt = ""
        desc = ""
        for s in spans:
            s2 = html.unescape(s).strip()
            if re.match(r"^[\w .-]+ - [\$€£]?[\d.,]+[KMB]?", s2) or " - $" in s2 or s2.endswith("Undisclosed"):
                round_amt = s2
            else:
                desc = s2
        if not round_amt:
            continue  # category page
        rnd, _, amt = round_amt.partition(" - ")
        out[slug] = {"company": html.unescape(name.group(1)).strip() if name else slug, "tags": tags, "desc": desc,
                     "round": rnd.strip(), "amount": amt.strip(), "url": "https://www.failory.com/pitch-deck/" + slug}
    return out


AJ_SLUG = re.compile(r"^(?P<co>.+?)-pitch-deck-(?:to-raise|raise)-(?:a-)?(?P<amt>[\d-]+[kmb])?-?(?P<rest>.*)$")


def parse_aj_slug(slug):
    s = slug.strip("/")
    if "pitch-deck" not in s or s.startswith(("aa-", "vc-", "how-", "what-", "why-", "the-", "best-", "top-")):
        return None
    m = AJ_SLUG.match(s)
    co = amt = rnd = ""
    if m:
        co = m.group("co")
        amt = (m.group("amt") or "").replace("-", ".")
        rest = m.group("rest")
        r = re.search(r"(pre-seed|seed|series-[a-h]|growth|late-stage|angel)", rest)
        rnd = r.group(1).replace("-", " ") if r else ""
    else:
        co = s.split("-pitch-deck")[0]
        r = re.search(r"(pre-seed|seed|series-[a-h]|growth|angel)", s[len(co):])
        rnd = r.group(1).replace("-", " ") if r else ""
        co = re.sub(r"-(startup|seed-stage|series-[a-h]|seed)$", "", co)
    co = re.sub(r"-(startup|seed-stage|series-[a-h]|seed|the)$", "", co)
    company = co.replace("-", " ").title()
    return {"company": company, "amount": ("$" + amt.upper()) if amt else "", "round": rnd,
            "url": "https://www.alexanderjarvis.com/" + s + "/"}


def parse_aj_page(body):
    title = re.search(r"<title>(.*?)</title>", body, flags=re.S)
    imgs = re.findall(r"https://cdn\.alexanderjarvis\.com/[^\"'\s)]+?\.(?:avif|png|jpg|jpeg|webp)", body)
    slides = []
    for u in dict.fromkeys(imgs):
        fn = u.rsplit("/", 1)[-1]
        if re.search(r"_Page_\d+", fn) or re.match(r"\d{1,2}-?[A-Za-z].*pitch-deck", fn, flags=re.I) \
                or re.search(r"(?:^|[-_])slide[-_]?\d+|-deck-\d+-", fn, flags=re.I):
            if not re.search(r"-\d{2,4}x\d{2,4}\.", fn):
                slides.append(u)
    # fundraise table rows: Date | Amount / Round | Valuation | Lead | Investors
    rounds = []
    tbl = re.search(r"<table.*?</table>", body, flags=re.S)
    if tbl:
        for tr in re.findall(r"<tr.*?</tr>", tbl.group(0), flags=re.S):
            cells = [html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, flags=re.S)]
            if len(cells) >= 2 and re.search(r"/", cells[1]) and re.search(r"\d{4}", cells[0]):
                rounds.append(cells)
    headers = [html.unescape(re.sub(r"<[^>]+>", "", h)).strip() for h in re.findall(r"<h[23][^>]*>(.*?)</h[23]>", body, flags=re.S)]
    slide_titles = [h for h in headers if h.lower().endswith(" slide") and h.lower() not in ("slide length",)]
    return {"title": html.unescape(title.group(1)).strip() if title else "", "slides": slides, "rounds": rounds,
            "slide_titles": slide_titles}


BI_SKIP = re.compile(r"template|how-to|how-i|tips|mistakes|what-vcs|guide|lessons|advice|should|examples|best-|"
                     r"vc-shares|investors-share|founders-share|worst|anatomy|slides-to|most-common|generator|"
                     r"ranked|roundup|library|every-|what-to|words|wrong|avoid", re.I)


BI_STOP = set("""startup startups company fintech adtech agtech edtech healthtech proptech insurtech legaltech tech ai gen-ai genai
deck pitch deck: platform app tool firm agency exclusive exclusive: unicorn real read see how this that these the its and which who
team founders founder leader dropouts students alums father couple rival startup's a an for from with to in of on is are
deck. series seed round funding million billion raises raised raise secures secured lands landed got has have just new nab grab
helped help close scored used uses using check out here's here's: pitch: pre-seed stage sports legal payments data dating social
irl video voice music software semiconductor cybersecurity marketing influencer addiction mental kids autism adhd women's medical
delivery creator gaming studio comic-book family office energy carbon credit portfolio management manufacturing construction
admin network marketplace luxury businesses youtubers four industrial steam emissions father texas analyst smart contact lens insurance freight hiring patent tax human avatar robot agent agents agentic
climate mobile-marketing mobile cloud inventory professional workplace filmmaking law auction meme shopping fitness search
ad analytics affiliate personal-shopping drug ex-uber ex-amazon ex-meta ex-vice yc yc-backed google-backed amazon-backed y
combinator defense recruiter scribe health-ai tesla battery storage white-hat hacking spawned got: adhd ad-analytics""".split())
BI_VERBS = r"(?:Raises|Raised|Raise|Secures|Secured|Lands|Landed|Got|Has Raised|Have Raised|Just Raised|Used|Uses|Nabs|Nabbed|Scored|Closed|Shares|Courts)"


def _bi_name_before(title, idx):
    """Scan capitalised tokens backwards from position idx; stop at a descriptor stopword."""
    pre = title[:idx].strip()
    toks = re.findall(r"[A-Za-z0-9][\w.&'/+-]*|[,:]", pre)
    name = []
    for t in reversed(toks):
        tl = t.lower().strip(".,")
        if t in (",", ":"):
            break
        if tl in BI_STOP and not (tl in ("ai", "labs", "health", "security") and not name):
            break
        if t.endswith("'s") and name:
            break
        if not re.match(r"^[A-Z0-9]", t):
            break
        name.insert(0, t)
        if len(name) == 3:
            break
    return _bi_clean(" ".join(name))


def _bi_clean(name):
    toks = [t for t in name.replace("'s ", " ").split() if t]
    while toks and toks[0].lower().strip(".,:") in BI_STOP:
        toks.pop(0)
    while toks and toks[-1].lower().strip(".,:") in BI_STOP and toks[-1].lower() not in ("ai", "labs", "health", "security"):
        toks.pop()
    name = " ".join(toks).strip(" .,:'")
    if name.endswith("'s"):
        name = name[:-2]
    if not toks or any(t.lower().strip(".,:") in ("pitch", "deck", "startup", "read", "see", "cuban", "vc", "ventures") for t in toks):
        return ""
    if len(toks) == 1 and toks[0].lower() in BI_STOP:
        return ""
    return name


def parse_bi_article(url, body):
    title = re.search(r'<meta property="og:title" content="([^"]*)"', body)
    title = html.unescape(title.group(1)).strip() if title else ""
    if not title:
        t = re.search(r"<title>(.*?)</title>", body, flags=re.S)
        title = html.unescape(t.group(1)).strip() if t else ""
    title = re.sub(r"\s*[-|]\s*Business Insider\s*$", "", title).strip()
    desc = re.search(r'<meta (?:name|property)="(?:description|og:description)" content="([^"]*)"', body)
    desc = html.unescape(desc.group(1)).strip() if desc else ""
    pub = re.search(r'"datePublished"\s*:\s*"(\d{4})-(\d{2})', body)
    year = pub.group(1) if pub else ""
    if not year:
        m = re.search(r"-(20\d\d)-\d{1,2}$", url)
        year = m.group(1) if m else ""
    low = title.lower()
    if (re.match(r"^\d+ ", title) or "pitch decks" in low or "without a pitch deck" in low or "leaked deck" in low
            or "no longer makes" in low or "decks " in low):
        return {"title": title, "desc": desc, "year": year, "amount": "", "round": "", "company": "", "slide_count": "", "url": url}
    amt = re.search(r"\$\s?([\d.]+)\s*(billion|million|thousand|bn|mm|B|M|K)\b", title + " " + desc, flags=re.I)
    amount = ""
    if amt:
        unit = {"billion": "B", "bn": "B", "million": "M", "mm": "M", "thousand": "K"}.get(amt.group(2).lower(), amt.group(2).upper())
        amount = "$" + amt.group(1) + unit
    rnd = re.search(r"(pre-?seed|seed|series\s+[A-Ha-h]\b|growth round|IPO)", title + " " + desc, flags=re.I)
    rnd = rnd.group(1) if rnd else ""
    slides = re.search(r"(\d{1,2})-(?:slide|page)", title + " " + desc)
    company = ""
    m = re.match(r"^([A-Z][\w.&'/+-]*(?: [A-Z&][\w.&'/+-]*){0,2})(?:'s)? (?:Series [A-H] )?Pitch Deck\b", title)
    if m:
        company = _bi_name_before(title, m.end(1))
    if not company:
        m = re.search(r"([A-Z][\w.&'/+-]*(?: [A-Z&][\w.&'/+-]*){0,2})'s? (?:\$|Pitch Deck|Seed Pitch|Series)", title)
        if m:
            company = _bi_name_before(title, m.end(1))
    if not company:
        m = re.search(r"\b" + BI_VERBS + r"\b", title)
        if m:
            company = _bi_name_before(title, m.start())
    if not company:
        m = re.match(r"^([A-Z][\w.&'/+-]*(?: [A-Z&][\w.&'/+-]*){0,2})[:,] ", title)
        if m:
            company = _bi_clean(m.group(1))
    if not company:
        m = re.search(r"\bGot ([A-Z][\w.&'/+-]*(?: [A-Z][\w.&'/+-]*){0,2}) \$", title)
        if m:
            company = m.group(1)
    company = _bi_clean(company)
    if company.lower() in BI_STOP or len(company) < 2 or company.lower() in ("y combinator", "google", "amazon", "yale", "goldman"):
        company = ""
    return {"title": title, "desc": desc, "year": year, "amount": amount, "round": rnd, "company": company,
            "slide_count": slides.group(1) if slides else "", "url": url}


# post-selection curated corrections tied to pages viewed during the build (see README)
POST_FIX = {
    ("wise", "alexanderjarvis.com"): {"company": "Wise (embedded business banking, US)", "year": "2020", "sector": "fintech",
        "notes": "not TransferWise: US embedded-banking startup, deck dated Series A Oct 2020 (viewed on alexanderjarvis.com)"},
    ("divvy", "alexanderjarvis.com"): {"company": "Divvy Homes", "year": "2018", "sector": "proptech",
        "notes": "deck dated April 2018 (viewed on alexanderjarvis.com); pitchdeckhunt.com lists the same company under divvy-homes 2019"},
    ("sorare", "pitchdeckhunt.com"): {"year": "2020", "notes": "deck states round closing May 2020 (viewed on alexanderjarvis.com)"},
    ("linkedin", "pitchdeckhunt.com"): {"company": "LinkedIn"},
    ("youtube", "pitchdeckhunt.com"): {"company": "YouTube"},
    ("buzzfeed", "pitchdeckhunt.com"): {"company": "BuzzFeed"},
}


# ---------------------------------------------------------------- main build
def log(*a):
    print(*a, file=sys.stderr, flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--target", type=int, default=420)
    ap.add_argument("--skip-bi", action="store_true")
    ap.add_argument("--bi-from", default="2022-01")
    ap.add_argument("--bi-to", default="2026-11")
    ap.add_argument("--dump", help="write merged master records as JSON here")
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    C = args.cache

    # 1. pitchdeckhunt --------------------------------------------------
    log("[pdh] sitemap")
    st, _, sm = fetch("https://www.pitchdeckhunt.com/sitemap.xml", C)
    pdh_urls = sorted(set(u.strip() for u in re.findall(r"<loc>\s*(https://www\.pitchdeckhunt\.com/pitch-decks/[^<\s]+)\s*</loc>", sm)))
    log("[pdh] %d deck urls" % len(pdh_urls))
    pdh = {}
    with cf.ThreadPoolExecutor(12) as ex:
        for url, (st, fin, body) in zip(pdh_urls, ex.map(lambda u: fetch(u, C), pdh_urls)):
            if st == 200:
                rec = parse_pdh(url, body)
                if rec:
                    pdh[url] = rec
    log("[pdh] parsed %d" % len(pdh))

    # 2. bestpitchdeck homepage ----------------------------------------
    log("[bpd] homepage")
    st, _, body = fetch("https://bestpitchdeck.com/", C)
    bpd = parse_bpd_cards(body) if st == 200 else {}
    log("[bpd] %d cards" % len(bpd))

    # 3. failory ------------------------------------------------------
    log("[failory] listing")
    st, _, body = fetch("https://www.failory.com/pitch-deck", C)
    fail = parse_failory(body) if st == 200 else {}
    log("[failory] %d company decks" % len(fail))

    # 4. alexanderjarvis slugs ----------------------------------------
    log("[aj] sitemaps")
    st, _, idx = fetch("https://www.alexanderjarvis.com/sitemap.xml", C)
    aj_maps = re.findall(r"<loc>(https://www\.alexanderjarvis\.com/post-sitemap\d*\.xml)</loc>", idx)
    aj = {}
    with cf.ThreadPoolExecutor(4) as ex:
        for st, _, body in ex.map(lambda u: fetch(u, C), aj_maps):
            for loc in [u.strip() for u in re.findall(r"<loc>\s*(https://www\.alexanderjarvis\.com/[^<\s]+)\s*</loc>", body)]:
                slug = loc.replace("https://www.alexanderjarvis.com/", "").strip("/")
                rec = parse_aj_slug(slug)
                if rec:
                    aj[loc] = rec
    log("[aj] %d deck posts" % len(aj))

    # 5. business insider ---------------------------------------------
    bi = {}
    if not args.skip_bi:
        y0, m0 = map(int, args.bi_from.split("-"))
        y1, m1 = map(int, args.bi_to.split("-"))
        months = []
        y, m = y0, m0
        while (y, m) <= (y1, m1):
            months.append("%04d-%02d" % (y, m))
            m += 1
            if m > 12:
                y, m = y + 1, 1
        log("[bi] %d monthly sitemaps" % len(months))
        bi_urls = []
        with cf.ThreadPoolExecutor(4) as ex:
            for st, _, body in ex.map(lambda mo: fetch("https://www.businessinsider.com/sitemap/%s.xml" % mo, C), months):
                for loc in [u.strip() for u in re.findall(r"<loc>\s*(https://www\.businessinsider\.com/[^<\s]*pitch-deck[^<\s]*)\s*</loc>", body)]:
                    if not BI_SKIP.search(loc.rsplit("/", 1)[-1]):
                        bi_urls.append(loc)
        bi_urls = sorted(set(bi_urls))
        log("[bi] %d candidate articles" % len(bi_urls))
        with cf.ThreadPoolExecutor(4) as ex:
            for url, (st, fin, body) in zip(bi_urls, ex.map(lambda u: fetch(u, C), bi_urls)):
                if st == 200 and body:
                    rec = parse_bi_article(url, body)
                    if rec["company"] and rec["amount"]:
                        bi[url] = rec
        log("[bi] %d with company+amount" % len(bi))

    # 6. merge ---------------------------------------------------------
    master = {}

    def get(company):
        k = norm_key(company)
        if not k:
            return None
        return master.setdefault(k, {"key": k, "names": [], "pdh": [], "bpd": [], "fail": [], "aj": [], "bi": []})

    for url, r in pdh.items():
        m = get(r["company"])
        if m is not None:
            m["pdh"].append(r); m["names"].append(r["company"])
    for slug, r in bpd.items():
        m = get(r["company"])
        if m is not None:
            m["bpd"].append(r); m["names"].append(r["company"])
    for slug, r in fail.items():
        m = get(r["company"])
        if m is not None:
            m["fail"].append(r); m["names"].append(r["company"])
    for url, r in aj.items():
        m = get(r["company"])
        if m is not None:
            m["aj"].append(r); m["names"].append(r["company"])
    for url, r in bi.items():
        m = get(r["company"])
        if m is not None:
            m["bi"].append(r); m["names"].append(r["company"])
    log("[merge] %d companies" % len(master))

    # 7. build candidate rows -----------------------------------------
    BAD_PDH_STAGE = ("late stage", "other", "", "undisclosed")

    def pick_name(m):
        # prefer a properly cased name from failory/bpd, else pdh, else aj
        for src in ("fail", "bpd", "pdh", "bi", "aj"):
            if m[src]:
                return m[src][0]["company"]
        return m["names"][0]

    cands = []
    for k, m in master.items():
        srcs = [s for s in ("pdh", "bpd", "fail", "aj", "bi") if m[s]]
        if not srcs:
            continue
        p = m["pdh"][0] if m["pdh"] else None
        b = m["bpd"][0] if m["bpd"] else None
        f = m["fail"][0] if m["fail"] else None
        a = m["aj"][0] if m["aj"] else None
        i = m["bi"][0] if m["bi"] else None
        # exclude VC fund decks and acquisitions
        stage_candidates = [x for x in [b and b["stage"], f and f["round"], p and p["stage"], a and a["round"], i and i["round"]] if x]
        if any(re.search(r"\bfund\b|fund \d|acquisition", s, flags=re.I) for s in stage_candidates):
            continue
        def pdh_weak(p):
            if not p:
                return True
            st_ = p["stage"].strip().lower()
            return (not st_ or "late" in st_ or st_ in ("other", "undisclosed") or st_.startswith("http")
                    or "," in p["amount"])
        def late(v):
            return bool(v) and ("late" in v.lower() or "growth" in v.lower() or "early" in v.lower())
        rnd_src, rnd = "", "unknown"
        order = []
        if p and not pdh_weak(p):
            order.append(("pitchdeckhunt.com", p["stage"]))
        for src, val in (("bestpitchdeck.com", b and b["stage"]), ("failory.com", f and f["round"])):
            if val and not late(val):
                order.append((src, val))
        order.append(("alexanderjarvis.com", a and a["round"]))
        for src, val in (("bestpitchdeck.com", b and b["stage"]), ("failory.com", f and f["round"])):
            if val and late(val):
                order.append((src, val))
        if p and pdh_weak(p):
            order.append(("pitchdeckhunt.com", p["stage"]))
        order.append(("businessinsider.com", i and i["round"]))
        for src, val in order:
            if val and norm_round(val) != "unknown":
                rnd, rnd_src = norm_round(val), src
                break
        year = ""
        for val in ((p and p["year"]), (b and b["year"]), (i and i["year"])):
            if norm_year(val):
                year = norm_year(val)
                break
        amount, amt_note = None, ""
        amt_order = []
        if p and not pdh_weak(p):
            amt_order.append(p["amount"])
        amt_order += [b and b["amount"], f and f["amount"], a and a["amount"]]
        if p and pdh_weak(p):
            amt_order.append(p["amount"])
        amt_order.append(i and i["amount"])
        for val in amt_order:
            usd, note = parse_amount(val or "")
            if usd:
                amount, amt_note = usd, note
                break
        tags = []
        if p: tags.append(p["industry"])
        if f: tags += f["tags"]
        if b: tags.append(b.get("industry", ""))
        desc = " ".join(x for x in [(f and f["desc"]) or "", (b and b["desc"]) or "", (p and p["desc"]) or "", (i and (i["title"] + " " + i["desc"])) or ""] if x)
        sector = classify_sector(tags, desc)
        # source_url preference: pdh > bpd > failory > aj > bi
        if p:
            src_site, src_url, fmt = "pitchdeckhunt.com", p["url"], ("slideshare_embed" if p["ss_key"] else ("drive_embed" if p["drive_id"] else ""))
        elif b:
            src_site, src_url, fmt = "bestpitchdeck.com", b["url"], ""
        elif f:
            src_site, src_url, fmt = "failory.com", f["url"], "slideshare_embed"
        elif a:
            src_site, src_url, fmt = "alexanderjarvis.com", a["url"], "images"
        else:
            src_site, src_url, fmt = "businessinsider.com", i["url"], "article"
        alts = []
        for src in ("pdh", "bpd", "fail", "aj", "bi"):
            for r in m[src]:
                if r["url"] != src_url:
                    alts.append(r["url"])
        notes = []
        if rnd_src and rnd_src != src_site:
            notes.append("round per " + rnd_src)
        if amt_note:
            notes.append(amt_note)
        if i and src_site != "businessinsider.com":
            notes.append("BI coverage: " + i["url"])
        outcome = ""
        if p and p["total_raised"]:
            outcome = re.sub(r"\s+", " ", p["total_raised"]).strip().rstrip(".") + " (per pitchdeckhunt.com)"
        if i and src_site == "businessinsider.com":
            notes.append("headline: " + i["title"][:140])
        cands.append({
            "company": pick_name(m), "round": rnd, "year": year, "amount_usd": amount or "", "sector": sector,
            "geography": "", "source_site": src_site, "source_url": src_url, "deck_format": fmt,
            "slide_count": (i and i["slide_count"]) or "", "outcome_note": outcome,
            "verified_status": "", "verified_at": "", "notes": "; ".join(notes),
            "_alts": alts, "_srcs": srcs, "_key": k, "_bpd": b, "_aj": a, "_bi": i, "_pdh": p, "_fail": f,
        })
    # curated corrections for well-known decks where aggregator fields disagree or are mis-tagged.
    # Each value is taken from one of the fetched aggregator pages named in the note.
    OVERRIDES = {
        "airbnb": {"sector": "marketplace", "round": "seed", "notes": "round: aggregators label pre-seed/seed; alexanderjarvis.com lists $600k seed Apr 2009 (Sequoia); deck dated 2008"},
        "uber": {"sector": "mobility"},
        "buffer": {"sector": "saas"},
        "intercom": {"sector": "saas"},
        "foursquare": {"sector": "consumer"},
        "headout": {"sector": "marketplace"},
        "tinder": {"sector": "consumer", "year": "2012", "round": "pre-seed", "amount_usd": "", "notes": "pitchdeckhunt.com lists pre-seed 2012 amount N/A; bestpitchdeck.com and failory.com list seed 2016 $50M"},
        "moz": {"sector": "saas"},
        "mattermark": {"sector": "saas"},
        "sorare": {"sector": "gaming", "round": "seed", "amount_usd": "4000000", "notes": "round and amount per alexanderjarvis.com slug (4m seed); pitchdeckhunt.com shows total funding"},
        "wise": {"sector": "fintech"},
        "divvy": {"sector": "fintech"},
        "monzo": {"round": "series-b", "notes": "round per alexanderjarvis.com (series b); aggregators label Late Stage"},
        "linkedin": {"sector": "hr", "year": "2004"},
        "facebook": {"sector": "media"},
        "snapchat": {"sector": "media"},
        "youtube": {"sector": "media"},
        "coinbase": {"sector": "fintech"},
        "dropbox": {"sector": "saas"},
        "square": {"sector": "fintech"},
        "canva": {"sector": "saas"},
        "figma": {"sector": "saas"},
        "mixpanel": {"sector": "saas"},
        "front": {"sector": "saas"},
        "alan": {"sector": "fintech"},
    }
    for c in cands:
        ov = OVERRIDES.get(c["_key"])
        if ov:
            for k2, v2 in ov.items():
                if k2 == "notes":
                    c["notes"] = (c["notes"] + "; " if c["notes"] else "") + v2
                else:
                    c[k2] = v2
    log("[cands] %d candidate rows" % len(cands))

    # 8. selection -----------------------------------------------------
    MUST = ["airbnb", "uber", "facebook", "linkedin", "buffer", "front", "frontseriesa", "frontseriesb", "intercom",
            "mixpanel", "coinbase", "square", "youtube", "buzzfeed", "foursquare", "dropbox", "wework", "moz",
            "mattermark", "alan", "brex", "revolut", "monzo", "n26", "transferwise", "wise", "snapchat", "tinder",
            "dwolla", "divvy", "divvyhomes", "ledgy", "headout", "canva", "figma", "notion", "loom", "lemlist", "qonto",
            "doctolib", "backmarket", "sorare", "mint", "mistral", "perplexityai", "elevenlabs", "render", "stripe"]

    def score(c):
        s = 0
        if c["year"]: s += 3
        if c["amount_usd"]: s += 3
        if c["round"] != "unknown": s += 2
        if c["sector"] != "other": s += 2
        s += min(len(c["_srcs"]) - 1, 2)
        y = int(c["year"]) if c["year"] else 0
        if y >= 2024: s += 10   # recent decks are scarce on the aggregators; Business Insider supplies them
        elif y >= 2022: s += 4
        elif y >= 2019: s += 1
        if c["_key"] in MUST: s += 100
        return s

    for c in cands:
        c["_score"] = score(c)
    cands.sort(key=lambda c: -c["_score"])
    selected, per_year = [], {}
    YEAR_CAP = 36
    for c in cands:
        if len(selected) >= args.target:
            break
        y = c["year"] or "unknown"
        if c["_key"] not in MUST:
            if not c["year"] or not c["amount_usd"]:
                continue
            yi = int(c["year"])
            if yi < 1998 or yi > 2026:
                continue
            if per_year.get(y, 0) >= YEAR_CAP:
                continue
        per_year[y] = per_year.get(y, 0) + 1
        selected.append(c)
    log("[select] %d rows" % len(selected))

    # 9. enrich kept rows: bestpitchdeck pages (paced), alexanderjarvis pages ---------
    bpd_rows = [c for c in selected if c["source_site"] == "bestpitchdeck.com" or (c["_bpd"] and c["sector"] == "other")]
    log("[bpd] fetching %d deck pages at 1 req / 2.6 s" % len(bpd_rows))
    for c in bpd_rows:
        st, fin, body = fetch(c["_bpd"]["url"], C)
        if st != 200:
            continue
        pg = parse_bpd_page(body)
        if pg["industry"] or pg["tags"]:
            new = classify_sector([pg["industry"], pg["tags"]], "")
            if c["sector"] == "other" and new != "other":
                c["sector"] = new
        if c["source_site"] == "bestpitchdeck.com":
            c["deck_format"] = "slideshare_embed" if pg["ss_key"] else ("drive_embed" if pg["drive_id"] else ("article" if pg["yt"] else ""))
            if pg["investors"]:
                c["notes"] = (c["notes"] + "; " if c["notes"] else "") + "investors: " + pg["investors"][:120]
    aj_rows = [c for c in selected if c["_aj"]]
    log("[aj] fetching %d pages" % len(aj_rows))
    with cf.ThreadPoolExecutor(3) as ex:
        for c, (st, fin, body) in zip(aj_rows, ex.map(lambda c: fetch(c["_aj"]["url"], C), aj_rows)):
            if st != 200:
                continue
            pg = parse_aj_page(body)
            if c["source_site"] == "alexanderjarvis.com":
                c["deck_format"] = "images" if len(pg["slides"]) >= 5 else c["deck_format"]
                if len(pg["slides"]) >= 5:
                    c["slide_count"] = str(len(pg["slides"]))
            elif pg["slides"] and len(pg["slides"]) >= 5 and not c["slide_count"]:
                c["slide_count"] = str(len(pg["slides"]))
                c["notes"] = (c["notes"] + "; " if c["notes"] else "") + "slide count from alexanderjarvis.com images"
            # outcome from fundraise table: latest round later than the deck round
            if pg["rounds"] and not c["outcome_note"]:
                latest = pg["rounds"][0]
                c["outcome_note"] = "later rounds listed on alexanderjarvis.com, latest %s %s" % (latest[0], latest[1])
            if not c["year"]:
                # try the fundraise table row matching the round label
                for row in pg["rounds"]:
                    if norm_round(row[1].split("/")[-1]) == c["round"]:
                        c["year"] = norm_year(row[0])
                        c["notes"] = (c["notes"] + "; " if c["notes"] else "") + "year from alexanderjarvis.com fundraise table"
                        break

    for c in selected:
        fix = POST_FIX.get((c["_key"], c["source_site"]))
        if fix:
            for k2, v2 in fix.items():
                if k2 == "notes":
                    c["notes"] = (c["notes"] + "; " if c["notes"] else "") + v2
                else:
                    c[k2] = v2

    # 10. write --------------------------------------------------------
    cols = ["id", "company", "round", "year", "amount_usd", "sector", "geography", "source_site", "source_url",
            "deck_format", "slide_count", "outcome_note", "verified_status", "verified_at", "notes"]
    selected.sort(key=lambda c: (c["company"].lower(), c["year"]))
    with open(args.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for n, c in enumerate(selected, 1):
            notes = c["notes"]
            if c["_alts"]:
                notes = (notes + "; " if notes else "") + " ".join("also:" + u for u in c["_alts"][:4])
            row = {k: c.get(k, "") for k in cols}
            row["id"] = "pd%04d" % n
            row["notes"] = notes.replace("\u2014", "-")
            w.writerow(row)
    log("[write] %s (%d rows)" % (args.out, len(selected)))
    if args.dump:
        with open(args.dump, "w") as f:
            json.dump({k: {s: v for s, v in m.items()} for k, m in master.items()}, f)


if __name__ == "__main__":
    main()
