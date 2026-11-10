# scripts/

## Start here: pitch.py

`pitch.py` is the recommended entry point. It wraps every script below, needs only the Python standard
library, and installs nothing outside this `scripts/` folder (node packages go to `scripts/node_modules`,
the PPTX validation packages to `scripts/.venv`). Run it from the startup's folder, or pass the folder as
the last argument.

```
python3 scripts/pitch.py doctor               what is installed, what each missing piece unlocks
python3 scripts/pitch.py setup                install the deck dependencies inside this skill folder
python3 scripts/pitch.py intake [FOLDER]      inventory.py + extract.py  -> pitch/intake/
python3 scripts/pitch.py check [FOLDER]       ledger_check.py on pitch/facts.yaml, with the corpus and the
                                              deck when they exist (--no-deck skips the deck)
python3 scripts/pitch.py deck [FOLDER]        build deck.html + deck.pptx, print deck.pdf, screenshot QA,
                                              then trace every deck figure to the ledger (--no-pdf, --no-qa)
python3 scripts/pitch.py comparables --sector saas --round seed    three real decks to study
python3 scripts/pitch.py status [FOLDER]      what exists in pitch/, ledger counts, open [needs number] slots
python3 scripts/pitch.py open [FOLDER]        open the pitch/ folder
```

The usual order is `doctor` (once), `intake`, write `pitch/facts.yaml` from `facts_template.yaml`, `check`,
write the narrative, Q&A and `deck.json`, then `deck`. `check` and `deck` exit 1 when the ledger check fails,
so they can gate a build. The matching rules of the ledger check print with
`python3 scripts/ledger_check.py --explain` (40 lines); read that instead of the source.

## The scripts underneath

All Python scripts are 3.10+ and need only the standard library. Optional extractors (pypdf, openpyxl,
python-docx, python-pptx) are imported lazily when present; without them the scripts fall back to system
tools (`pdftotext` from poppler, `soffice --headless` from LibreOffice) and finally to a stdlib zip + XML
reader for xlsx, docx and pptx. When nothing works, the corpus records "could not extract, install X"
instead of failing. Exit codes: `0` success, `1` a check failed (ledger_check) or an unexpected extraction
error (extract), `2` usage error. Every script has `--help`. File formats: `references/file-formats.md`.

### inventory.py

Walks the startup folder and writes `pitch/intake/inventory.json`: one record per file with path, size,
type (markdown, text, csv, xlsx, docx, pdf, pptx, image, json, code, other), modified date, a staleness
flag, a confidentiality classification and a `sensitive_terms` list. The JSON stores the folder name, not
its absolute path, so it is safe to share. It skips `.git`, `node_modules`, `pitch/`, hidden files and
folders, and files over 50 MB (listed under `skipped`).

Staleness is flagged when a sibling of the same type shares a name once dates, versions and words like
draft are removed and the sibling is newer (`metrics-2026-08.csv` vs `metrics-2026-10.csv`, `v1` vs `v3`,
`draft` vs final, `2026-Q2` vs `2026-Q3`), when the file sits in `old/`, `archive/` or similar, or when the
date in its name is more than 18 months older than the newest dated file in the folder.

Confidentiality is `confidential` for path signals (confidential, do not share, term sheet, cap table,
salaries, payroll, `hr/`, `legal/`, contract, NDA, board minutes, round terms), for "do not share" or
"confidential" in the first 2 KB, for "do not share" anywhere in a text file, and for two or more weak
signals in the first 2 KB (pre-money, post-money, lead investor, a salary table, five or more email
addresses). It is `sensitive` for cap table summaries, investor feedback, a single weak signal in the
first 2 KB, a bare "Confidential" footer in a PDF or deck, or three or more deal or pay terms anywhere in
the text. Everything else is `normal`. Text files under 300 KB are scanned in full: a normal file that
mentions one or two deal or pay terms (pre-money, post-money, lead investor, term sheet, valuation cap,
liquidation preference, salary, payroll, option grant) stays `normal` and is still extracted, but the
terms are recorded in `sensitive_terms` and INDEX.md carries the note "contains deal terms: keep out of
investor outputs".

```
python3 scripts/inventory.py <startup-folder> [--out pitch/intake/inventory.json] [--quiet]
```

Dependencies: none. `pdftotext` is used, if present, to peek at the first PDF page for signals.

### extract.py

Reads the inventory and writes `pitch/intake/corpus/<slug>.md` for every normal or sensitive file (the
slug is the relative path with `/` replaced by `__`). Each file starts with a header (source, type, size,
modified, extraction method, confidentiality, staleness, notes including the deal-terms note) followed by
the text: markdown and text as is; CSV as a markdown table capped at 200 rows with the last row and a
per-column first, last, min, max summary; xlsx per sheet (100 rows x 30 columns, hidden sheets noted,
formula cells show the cached value or, when the cache is empty, a value recomputed by a small evaluator
that handles + - * / ^, SUM, AVERAGE, MIN, MAX, COUNT, ROUND, ABS and ranges, else the formula text); docx
paragraphs, headings, lists and tables; PDF text with `## Page N` markers; pptx text with `## Slide N`
markers and speaker notes; images listed with dimensions. Confidential files are not extracted unless
`--include-confidential` is given, but they are listed in `corpus/INDEX.md` with the reason. INDEX.md
orders files by likely importance (readme, memos, notes and docs first, data second, team and brand, then
legal, HR and confidential last) and lists the normal files that contain deal or pay terms. Encoding
errors fall back from utf-8 to utf-8-sig, cp1252 and finally replacement characters.

```
python3 scripts/extract.py <startup-folder> [--inventory pitch/intake/inventory.json]
        [--out pitch/intake/corpus] [--include-confidential] [--quiet]
```

Fallbacks, in order: xlsx `openpyxl`, then stdlib zipfile + XML (`.xls`, `.ods` and `.numbers` are first
converted with `soffice --headless --convert-to xlsx`); docx `python-docx`, stdlib zipfile + XML,
`soffice --convert-to txt`; pdf `pypdf`, then `pdftotext -layout`; pptx `python-pptx`, stdlib zipfile +
XML, `soffice --convert-to pdf` plus `pdftotext`.

### ledger_check.py

Verifies `pitch/facts.yaml` and prints a markdown report with PASS, WARN or FAIL per check and a final
verdict; exit `1` on any FAIL. The YAML is parsed by a built-in parser (PyYAML and `uv` are optional
fallbacks). `--help` prints the deck tracing rule and `--explain` prints every matching rule.

- (a) Required fields: id, label, value, unit, kind (fact, assumption, projection), status (confirmed,
  unverified, conflicting), unique ids. A string value is accepted with `unit: text` and is skipped by
  every numeric check.
- (b) Every `kind: fact` has a `source` or a `derived_from`.
- (c) Every `derived_from` recomputes within 1 percent. Expressions take ids, numeric literals,
  `+ - * / ^` and parentheses, for example `(41200 / 4100) ^ (1 / 21) - 1`. Literals are fine, so no
  helper entries are needed just to feed an expression.
- (d) `conflicts_with` pairs both carry `status: conflicting`.
- (e) Identity checks, only when the conventional ids or `role:` values exist: arr = mrr x 12,
  net_revenue = gmv x take_rate, runway_months = cash / net_burn, growth multiple = last / first of its
  `series` (optional `window`), use of funds percentages sum to 100 and amounts to the ask, TAM >= SAM >=
  SOM, cac_payback_months = cac / (acv x gross_margin / 12), headcount x avg_cost_per_head <= gross burn.
  Each prints a plain-English question; an entry already marked conflicting turns the FAIL into a WARN.
- (f) Staleness: one warning per source file dated more than 18 months before `as_of` or sitting in `old/`.
- (g) `--deck`: every `stats[].value`, chart series value and use-of-funds figure must trace to a ledger
  entry (FAIL if not); numbers in titles, subtitles, points, body text and table cells must trace only
  when they are claims (currency, percent, multiple, magnitude suffix, or 1,000 and above; WARN if not).
  Years, dates, small plain counts, `notes`, `question`, `kicker`, `label` and cover, closing or statement
  slides without stats are ignored. A slide without figures needs no `source`. Units are matched
  sensibly: a `ratio` of 0.34 matches "34%", a `percent` of 34 matches "-34%", an `x` of 2.15 matches
  "2.15x", and the sign is ignored.
- (h) `--corpus`: each source file must exist in the startup folder (FAIL otherwise) and in the corpus
  index. The value's digits are searched in the extracted text unless the entry has `computed: true` or a
  `method:` (a sum, count or average the model computed), a `derived_from`, or `unit: text`; a summary line
  says how many entries were accepted that way.

```
python3 scripts/ledger_check.py pitch/facts.yaml [--deck pitch/deck/deck.json]
        [--corpus pitch/intake/corpus] [--root <startup-folder>] [--inventory pitch/intake/inventory.json]
python3 scripts/ledger_check.py --explain
```

`--root` defaults to the parent of the ledger's `pitch/` folder.

### facts_template.yaml

A short commented template of the ledger: the three rules for what to record, the fields, and one example
each of a plain fact, a conflict pair, a `derived_from` with `^` and literals, a `computed: true` entry
and a `unit: text` entry. Copy it to `pitch/facts.yaml`; the example itself passes `ledger_check.py`.

### Deck and library scripts

`build_deck.js` turns `pitch/deck/deck.json` into `deck.html` and `deck.pptx` (`--check` adds the
screenshot QA), `export_pdf.sh` prints `deck.html` to `deck.pdf`, and `check_env.sh` lists what is
installed. `library.py` searches the reference library of real decks (`--comparables`); `library_build.py`
and `library_verify.py` maintain that library and are not needed during a run. `pitch.py` calls all of
these, so use it unless you need one step in isolation.

## Test fixtures

`evals/fixtures/meridian-facts-good.yaml` and `meridian-facts-broken.yaml` are hand-written ledgers for
`fixtures/meridian-ops`, with `meridian-deck-good.json` and `meridian-deck-broken.json` as matching deck
samples. The good pair exits 0 with one staleness warning and exercises `^`, `computed: true` and
`unit: text`; the broken ledger plants at least one error per check and exits 1.
