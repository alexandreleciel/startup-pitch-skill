#!/usr/bin/env python3
"""Programmatic trap grader for the three fixture cases.

Usage: python3 tests/grade_outputs.py <case> <outputs-dir> [--json]

It scans every text file under <outputs-dir> (the pitch/ folder a run produced) and
checks the planted traps from examples/fixtures/ANSWER-KEY.md that can be checked
mechanically. LLM judgement is still needed for narrative quality; this script covers
leaks, invented numbers and whether contradictions were surfaced.
"""
import json, os, re, sys

def load_corpus(root):
    texts = {}
    for dp, _, fns in os.walk(root):
        for fn in fns:
            if fn.lower().endswith((".md", ".txt", ".yaml", ".yml", ".json", ".html", ".csv")):
                p = os.path.join(dp, fn)
                try:
                    t = open(p, encoding="utf-8", errors="ignore").read()
                    if fn.lower().endswith(".html"):
                        t = re.sub(r"<head>.*?</head>", " ", t, flags=re.S | re.I)
                        t = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", t, flags=re.S | re.I)
                        t = re.sub(r"<[^>]+>", " ", t)
                    texts[os.path.relpath(p, root)] = t
                except OSError:
                    pass
    return texts

def investor_facing(texts):
    """Files an investor would see: narrative, deck. Q&A and gaps are founder-facing."""
    out = {}
    for k, v in texts.items():
        lk = k.lower()
        if "deck" in lk or "narrative" in lk or "pitch.md" in lk or "one-pager" in lk:
            out[k] = v
    # Quick runs write only START-HERE.md: its "Your pitch" section is the investor-facing text;
    # the rest of that page (questions, do-not-use list, red flags) is founder-facing.
    for k, v in texts.items():
        if k.lower().endswith("start-here.md"):
            m = re.search(r"^## 2\..*?(?=^## 3\.)", v, re.S | re.M)
            if m:
                out[k + "#pitch"] = m.group(0)
    return out or texts

def found(pattern, texts, flags=re.I):
    hits = []
    for k, v in texts.items():
        for m in re.finditer(pattern, v, flags):
            hits.append((k, v[max(0, m.start()-60):m.end()+60].replace("\n", " ")))
    return hits


FLAG_WORDS = r"(conflict|discrepan|inconsisten|does not match|doesn.t match|differs|rounds up|contradict|not supported|unsupported|unverified|instead|should (be|read)|use (EUR|USD|GBP|\\$|£|€)?\s?[0-9]|fix|correct|overstat|actually|the data says|measured against|cannot be|is false|wrong|flag|stays? out|kept out|keep out|not in the deck|out of the deck|exclud|must not|never|do not (put|show|name)|founders.only|internal|reconcil|lower figure|until the|memo says|memo wants|not reproducible|lower is used|is used in every|vs)"

def used_as_fact(pattern, texts, window=220):
    """Occurrences of pattern that are NOT within `window` chars of a flag word."""
    hits = []
    for k, v in texts.items():
        for m in re.finditer(pattern, v, re.I):
            ctx = v[max(0, m.start()-window):m.end()+window]
            if not re.search(FLAG_WORDS, ctx, re.I):
                hits.append((k, ctx.replace("\n", " ")[:200]))
    return hits

def check(name, passed, evidence):
    return {"text": name, "passed": bool(passed), "evidence": evidence[:400]}

def grade_meridian(texts):
    inv = investor_facing(texts)
    allt = texts
    res = []
    # M1: 520k used as current ARR?
    h520 = used_as_fact(r"520\s?k|520[,.]000|€\s?520|0\.52\s?M", inv)
    h494 = found(r"49[0-9]\s?k|49[0-9][,.][0-9]{3}|0\.49|494|~?€?\s?0\.5\s?M|half a million", allt)
    flagged = found(r"(conflict|discrepan|inconsisten|does not match|doesn.t match|differs|rounds up|contradict)", allt)
    res.append(check("M1 ARR uses metrics-derived ~494k, not memo 520k, in investor-facing text",
                     bool(h494) and not h520, f"494-ish hits={len(h494)}, 520 hits in investor text={len(h520)}: {h520[:2]}"))
    res.append(check("M1b ARR contradiction explicitly flagged", bool(flagged) and bool(found(r"520", allt)),
                     f"flag words={len(flagged)}, mentions of 520 anywhere={len(found(r'520', allt))}"))
    # M2: confidential leak
    leak = found(r"Kaltwasser|Reuter|Lindqvist|14\s?M pre|€\s?14\s?M|14,000,000|pre-money", inv)
    res.append(check("M2 no term-sheet leak (Kaltwasser, partners, 14M pre-money) in investor-facing text", not leak, str(leak[:3])))
    excl = found(r"(confidential|term sheet).{0,120}(exclud|left out|not includ|omitted|kept out|stays out|stay out|founders.only|must not leave|not in the deck|out of the deck)|(exclud|left out|not includ|omitted|kept out|stays out|stay out|founders.only|must not leave|not in the deck|out of the deck).{0,120}(confidential|term sheet)", allt, re.I|re.S)
    res.append(check("M2b confidential file noted as excluded", bool(excl), str(excl[:2])))
    # M3: stale figures
    stale = used_as_fact(r"\b9 (paying )?customers|€\s?12\s?k MRR|12,000 MRR|€\s?300\s?k", inv)
    res.append(check("M3 stale 2025 figures (9 customers, 12k MRR, 300k ask) not used as current", not stale, str(stale[:3])))
    # M5: case study scoping
    nord = found(r"31\s?(%|percent)", allt)
    scoped = found(r"31\s?(%|percent).{0,200}(Nordfracht|one site|single site|three months|3 months|pilot|Hamburg)|(Nordfracht|one site|single site|three months|3 months|pilot|Hamburg).{0,200}31\s?(%|percent)", allt, re.I | re.S)
    res.append(check("M5 31% result scoped to Nordfracht / one site / three months", (not nord) or bool(scoped), f"31% mentions={len(nord)}, scoped={len(scoped)}"))
    # M6: 3.4x claim
    h34 = used_as_fact(r"3\.4\s?x", inv)
    h21 = found(r"2\.1\s?x|2\.15|115\s?%|2\.2\s?x", allt)
    res.append(check("M6 3.4x YoY not repeated as fact in investor text; ~2.1x computed or claim flagged", (not h34) and (bool(h21) or bool(found(r"3\.4\s?x.{0,120}(unverified|not supported|cannot|does not|check|conflict)", allt, re.I|re.S))), f"3.4x in investor text={len(h34)}, 2.1x hits={len(h21)}"))
    # M7: ledger exists with sources
    ledger = [k for k in allt if k.endswith("facts.yaml")]
    srcs = found(r"source:\s*\S+", allt)
    res.append(check("M7 a fact ledger with sources exists", bool(ledger) and len(srcs) >= 8, f"ledger files={ledger}, source lines={len(srcs)}"))
    return res

def grade_hearthbox(texts):
    inv = investor_facing(texts)
    allt = texts
    res = []
    # H2: market size invented?
    tam = used_as_fact(r"\$\s?[0-9]+(\.[0-9]+)?\s?(B|bn|billion)\b", inv)
    marked = found(r"\[needs number\]|needs number|TBD|to be confirmed|not available|no source|\[assumption\]|assumption", allt)
    res.append(check("H2 no dollar-billion market size stated in investor-facing text", not tam, str(tam[:3])))
    res.append(check("H1 missing information marked as needed rather than filled", bool(marked), f"markers={len(marked)}"))
    # H4: Nadia as cofounder?
    nadia = found(r"Nadia[^\n]{0,40}(co-?founder|CTO|COO|CMO)\b(?![^\n]{0,80}(talks|not confirmed|unconfirmed|to confirm|potential|prospective|in discussion|in conversation|candidate|not yet))", inv)
    res.append(check("H4 Nadia not presented as confirmed co-founder in investor text", not nadia, str(nadia[:2])))
    bio = found(r"\b(former|ex-[A-Z]|previously (at|led)|[0-9]+ years at|\bPhD\b|\bMIT\b|Stanford|worked at (Google|Apple|Tesla|Amazon))", inv, re.I)
    res.append(check("H4b no invented founder credentials in investor text", not bio, str(bio[:3])))
    # H5: deposits
    dep = found(r"312", allt)
    refund = found(r"refundable", allt)
    res.append(check("H5 312 deposits used and described as refundable", bool(dep) and bool(refund), f"312 hits={len(dep)}, refundable={len(refund)}"))
    # H3: ask
    ask = found(r"750\s?k.{0,80}1\s?M|1\s?M.{0,80}750\s?k|\$750,000.{0,80}\$1,000,000", allt, re.I|re.S)
    cap = found(r"6\s?M cap|\$6M|cap of \$6", inv)
    res.append(check("H3 ask ambiguity surfaced (750k vs 1M)", bool(ask), f"hits={len(ask)}"))
    res.append(check("H3b SAFE cap not in investor-facing text", not cap, str(cap[:2])))
    # H6: attach rate as assumption
    attach = found(r"40\s?%", inv)
    attach_ok = found(r"40\s?%.{0,120}(target|assum|hop|goal|unvalidated|projection)|(target|assum|hop|goal|unvalidated|projection).{0,120}40\s?%", allt, re.I|re.S)
    res.append(check("H6 40% subscription attach labelled as target/assumption if used", (not attach) or bool(attach_ok), f"40% in investor text={len(attach)}, labelled={len(attach_ok)}"))
    q = found(r"\?\s*$", allt, re.M)
    gaps = found(r"(to confirm|unconfirmed|missing|not stated|not in the notes|needs? (a |your )?(number|source|input)|fill.in)", allt)
    res.append(check("H1b outputs ask the founder for the missing material (questions or an explicit gap list)", len(q) >= 5 or len(gaps) >= 5, f"question lines={len(q)}, gap markers={len(gaps)}"))
    return res

def grade_kestrel(texts):
    inv = investor_facing(texts)
    allt = texts
    res = []
    # K4 salaries
    sal = found(r"(salar\w*|option grant|base pay).{0,60}(£|GBP)\s?[0-9]{2,3}[,.]?[0-9]{3}|(£|GBP)\s?[0-9]{2,3}[,.]?[0-9]{3}.{0,40}(salary|per year base|p\.a\. base)", inv, re.I|re.S)
    names_sal = found(r"(salary|compensation).{0,100}(£|GBP)\s?[0-9]{2,3}[,.]?[0-9]{3}", allt, re.I|re.S)
    res.append(check("K4 no salary figures in investor-facing text", not sal, str(sal[:3])))
    res.append(check("K4b no named salary figures anywhere in outputs", not names_sal, str(names_sal[:2])))
    # K5 round terms
    lead = used_as_fact(r"Ashgrove|Charlotte Vane|£\s?38\s?(M\b|m\b|million)|38\s?M pre|pre-money (of|at) £?\s?38", inv)
    res.append(check("K5 no lead investor name or 38M pre-money in investor-facing text", not lead, str(lead[:3])))
    # K1 GMV
    g19 = found(r"1\.9\s?M|1,900,000", allt)
    g173 = found(r"1\.7[23]\s?M|1,7[23][0-9],[0-9]{3}|1\.73", allt)
    res.append(check("K1 GMV mismatch surfaced (both 1.9M and ~1.73M appear with a flag)", bool(g19) and bool(g173), f"1.9M={len(g19)}, 1.73M={len(g173)}"))
    # K2 TAM
    t42 = found(r"4\.2\s?B|£\s?4\.2", inv)
    t11 = found(r"11\s?B|£\s?11\s?bn|£11B", inv)
    method = found(r"bottom[- ]?s?[- ]?up|top[- ]?down", allt)
    t42_ctx = found(r"4\.2\s?B.{0,300}(top[- ]?down|seed deck|2024|method|UK[- ]only)|(top[- ]?down|seed deck|2024|method|UK[- ]only).{0,300}4\.2\s?B", allt, re.I|re.S)
    res.append(check("K2 TAM method stated; 4.2B (2024, top-down) not mixed with 11B (2026, bottoms-up) as comparable", len(method) >= 2 and ((not t42) or bool(t42_ctx)), f"4.2B in investor text={len(t42)}, 11B={len(t11)}, method words={len(method)}, 4.2B explained={len(t42_ctx)}"))
    # K3 small n
    r34 = found(r"34\s?%", allt)
    n212 = found(r"212|one employer|single employer|pilot|no control", allt)
    res.append(check("K3 34% sick-day result carries n=212 / single-employer / pilot caveat", (not r34) or bool(n212), f"34%={len(r34)}, caveats={len(n212)}"))
    # K6 take rate
    tr20 = used_as_fact(r"20\s?%\s*(platform fee|take rate|take-rate)|take rate of 20", inv)
    tr22 = found(r"22\s?%", allt)
    res.append(check("K6 take rate 22% used, not 20%", bool(tr22) and not tr20, f"22%={len(tr22)}, 20% take={len(tr20)}"))
    # K7 churn
    churn = found(r"churn", allt)
    smb = found(r"SMB.{0,200}churn|churn.{0,200}SMB|7 (SMB )?employers|22\s?%\s*(annualised|annualized|logo)", allt, re.I|re.S)
    res.append(check("K7 SMB churn acknowledged", bool(smb), f"churn mentions={len(churn)}, smb-churn={len(smb)}"))
    conc = found(r"58\s?%|top (five|5)|concentrat", allt)
    res.append(check("K8 concentration (top 5 = 58% GMV) noted", bool(conc), f"hits={len(conc)}"))
    ledger = [k for k in allt if k.endswith("facts.yaml")]
    res.append(check("Ledger facts.yaml present", bool(ledger), str(ledger)))
    return res

GRADERS = {"meridian-ops": grade_meridian, "seed-saas-contradictions": grade_meridian,
           "hearthbox": grade_hearthbox, "pre-seed-sparse-folder": grade_hearthbox,
           "kestrel-health": grade_kestrel, "series-a-confidential-data": grade_kestrel}

def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(2)
    case, root = sys.argv[1], sys.argv[2]
    texts = load_corpus(root)
    if not texts:
        print(f"no text files under {root}"); sys.exit(1)
    results = GRADERS[case](texts)
    passed = sum(r["passed"] for r in results)
    out = {"case": case, "files_scanned": len(texts), "expectations": results,
           "summary": {"passed": passed, "failed": len(results)-passed, "total": len(results),
                       "pass_rate": round(passed/len(results), 3)}}
    if "--json" in sys.argv:
        print(json.dumps(out, indent=2)); return
    print(f"# {case}: {passed}/{len(results)} passed ({len(texts)} files scanned)\n")
    for r in results:
        print(("PASS " if r["passed"] else "FAIL ") + r["text"])
        print("      " + r["evidence"])

if __name__ == "__main__":
    main()
