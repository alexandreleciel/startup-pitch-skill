# File formats and output folder

Everything the skill produces lives in `pitch/` inside the startup's folder. Founders
review and edit these files; later runs read them back, so keep the formats stable. A quick
run writes START-HERE.md, facts.yaml and intake/; the rest appears when asked for.

```
pitch/
├── START-HERE.md           the one page the founder reads first (quick run)
├── facts.yaml              the fact ledger (every number used anywhere)
├── intake/
│   ├── inventory.json      every file found, its type, size, and confidentiality flag
│   └── corpus/             extracted text, one .md per source file, plus INDEX.md
├── gaps.md                 only when there are more open items than START-HERE holds
├── narrative.md            on request
├── investor-qa.md          on request
├── deck/                   on request
│   ├── deck.json           slide content, speaker notes, chart data, theme (the editable source)
│   ├── deck.html           self-contained HTML deck (open in a browser, arrow keys to navigate)
│   ├── deck.pdf            printed from deck.html
│   ├── deck.pptx           PowerPoint, if wanted: faithful (pictures) or editable (native)
│   └── qa/                 slide screenshots and the overflow report
└── run-log.md              what was read, what was asked, what changed, per run
```

## START-HERE.md

The quick run's deliverable and, later, the index of everything else. Keep it to about 1,200
words so a founder reads it in five minutes: each question under 60 words, each investor
answer under 70, each red flag under 40. Ledger ids go in the numbers table, the investor
answers and the questions; the two-sentence and 60-second pitch are spoken text and carry no
id tags. A figure worked out on the page from cited entries shows its arithmetic ("636k is
the sum of the six lines") and needs no entry of its own. Missing figures are written
`[needs number]`; missing non-numeric information (a founder's background, a competitor
list) is written `[needs detail]`. Use exactly these sections.

```markdown
# <Company>: pitch start page

Generated <date>. Numbers as of <as_of>. Every figure traces to pitch/facts.yaml.

## 1. Answer these first
1. **<Question?>** <Both values with their files, or what is missing and why an investor will ask.>
   *Used until you answer:* <the conservative value, or [needs number]>.
(five at most, contradictions first; if the target investor is unknown, that is one of them)

## 2. Your pitch
**In two sentences:** <what you do in plain words; the most impressive true fact>.
**In 60 seconds:** <120 to 150 words: problem, what you built, proof, the ask; a why-now only if a dated external change exists>.

## 3. The numbers that matter
| Number | Value | Kind | Source |
(three to five rows; kind is fact, assumption or projection; source is the file. Prefer
confirmed facts. The conservative side of an open conflict may be a headline when it comes
from the system of record: mark it "being reconciled". Before revenue, labelled assumptions
fill the rows that facts cannot.)
**Do not use yet:** <claims in your files that no data backs, each with what would back it>.

## 4. The five questions you are least ready for
**<Question>** Why they ask: <one line>. Your strongest honest answer: <two or three
sentences citing [fact:id]>. Have ready: <file or slide>.

## 5. Top three red flags
**<Flag>** (critical | major). What an investor reads into it: <one line>. Fix: <one line>.

## 6. Kept out of investor material
<confidential files not read; which terms, names and pay details were held back and from
which files, described without repeating the values>

## 7. Next
Ask for any of: the full narrative, the full investor Q&A, a deck (HTML, PDF, PowerPoint),
preparation for a specific investor type.

## Files
<links to every file written so far in pitch/>
```


## facts.yaml (the fact ledger)

Every figure or claim that appears in the narrative, the Q&A or the deck must have an
entry here. The ledger is what lets a founder answer "where did that number come from?"
in a meeting, and it is what `pitch.py check` verifies (`pitch.py check --explain` prints
its matching rules).

```yaml
company: Meridian
currency: EUR
as_of: 2026-10-31            # the date the numbers describe, not today's date
facts:
  - id: mrr_current
    label: MRR, October 2026
    value: 41000
    unit: EUR/month
    kind: fact               # fact | assumption | projection
    status: confirmed        # confirmed | unverified | conflicting
    source: data/metrics-2026-10.csv#row=2026-10
    note: last full month in the metrics export
  - id: arr_current
    label: ARR, run-rate
    value: 492000
    unit: EUR/year
    kind: fact
    status: conflicting        # both sides of a conflict carry this status
    derived_from: mrr_current * 12
    conflicts_with: arr_memo
    note: the value the narrative uses until the founder confirms
  - id: arr_memo
    label: ARR as stated in founder memo
    value: 520000
    unit: EUR/year
    kind: fact
    status: conflicting
    source: notes/founder-memo-nov-2026.md
    conflicts_with: arr_current
    note: memo says 520k; metrics export implies 492k. Founder to confirm which is current.
  - id: tam_bottom_up
    label: Serviceable market, EU mid-size logistics operators
    value: 1.8e9
    unit: EUR/year
    kind: assumption
    status: unverified
    source: docs/market-sizing.md
    method: 12,000 operators x 150k EUR average contract value
  - id: arr_2028
    label: ARR, end of 2028
    value: 9.6e6
    unit: EUR/year
    kind: projection
    status: unverified
    source: data/financial-model-v3.xlsx#P&L!F14
    assumes: [tam_bottom_up, churn_target]
```

Field rules:

- `kind` answers "how do we know this?": a **fact** is in a file or verifiable record, an
  **assumption** is a belief or estimate the founder holds today (a supplier-quote cost, a
  target price, a planned quantity, a market estimate; give its `method`), a **projection**
  is a forward-looking number or dated target from a model or plan (give `assumes` or name
  its drivers). Facts are stated flat, assumptions with their method, projections with
  their drivers.
- `status`: `confirmed` means read from a primary record (an export, a model, a statement)
  with nothing contradicting it. `unverified` means stated in prose or by the founder with
  no record behind it. `conflicting` means two sources disagree: both entries carry the
  status and point at each other with `conflicts_with`, the checker fails when only one
  side does, and the skill never resolves it. Outputs use the conservative value and
  START-HERE.md section 1 asks the founder. Two projections can conflict the same way.
- `source` is a file in the startup folder with an optional locator after `#`:
  `#row=2026-10` (csv), `#Sheet!F14` (xlsx), `#page=3` (pdf), `#line=12` (text). A fact with
  no `source` and no `derived_from` is a hard failure: make it an assumption or drop it.
- `derived_from` is an expression over ids and numeric literals with `+ - * / ^` and
  parentheses, for example `(41200 / 4100) ^ (1 / 21) - 1`. The checker recomputes it and
  fails above 1 percent. Do not add entries whose only job is to feed another's expression.
- `computed: true` marks a value you summed, counted or averaged from a file (a pipeline
  total, a customer count). The checker confirms the file exists instead of searching for
  the digits. Say how in `note`.
- `unit: text` allows a string `value` for a qualitative entry (stage, investor profile).
- `source: founder statement, <date>` records something the founder said in the
  conversation that no file backs; give it `status: unverified`.
- `open_question: <text>` on an entry marks an issue the founder knows is open (a budget
  that does not yet sum to the ask); identity checks involving it report WARN, not FAIL.
- `cite_as: <label>` replaces the file path in deck captions and the sources appendix. Use
  it when a file name would reveal something an investor should not see, such as a
  customer's name: `cite_as: published customer case study, 2025`.
- Optional fields the checker accepts: `definition` (what a metric includes and excludes),
  `window` (period of a growth or churn figure; a number of periods for a multiple),
  `n` (sample size, required in words wherever a rate from fewer than 100 observations is
  used), `series` (the id of the series a multiple is computed from), `role` (maps a custom
  id to an identity check), `method`, `assumes`, `note`.
- Citations in markdown outputs use the kind as prefix: `[fact:id]`, `[assumption:id]`,
  `[projection:id]`. Deck `source` fields take the same three prefixes.
- Size: the start page's ledger holds 15 to 30 entries. Items that live only in `gaps.md`
  may point at `file#locator` instead of getting an entry.

## gaps.md

The overflow list behind START-HERE.md section 1. Write it only when there are more open
items than the start page's five, and link it from that section. Three sections, in this
order:

1. **Contradictions** found between files, each with both values, both sources, and the
   question that resolves it.
2. **Missing information that changes the pitch**, each with why an investor will ask for
   it and what a good answer looks like. Ask only for things that matter at this stage;
   a pre-seed deck does not need a five-year P&L.
3. **Confidential material found** (names, salaries, term sheets, cap tables, contracts)
   and the statement that it was excluded from the deck.

## deck.json

The single editable source for the deck. `scripts/build_deck.js` turns it into HTML and
PPTX; `scripts/export_pdf.sh` prints the HTML to PDF. Edit this file (or `deck.html`
directly for one-off tweaks), rebuild, done.

```json
{
  "meta": {
    "company": "Meridian",
    "tagline": "Dock scheduling that carriers actually use",
    "theme": "ledger",
    "pptx": "faithful",
    "accent": "#2E6BE6",
    "font_display": "Fraunces",
    "font_body": "Inter",
    "logo": "assets/meridian-logo.svg",
    "footer": "Meridian GmbH, confidential, November 2026",
    "aspect": "16:9"
  },
  "slides": [
    { "type": "cover", "title": "Meridian", "subtitle": "Dock scheduling that carriers actually use",
      "kicker": "Seed round, November 2026", "notes": "Open with the Nordfracht story." },
    { "type": "problem", "title": "Trucks wait 94 minutes at the average mid-size dock",
      "points": ["...", "...", "..."], "source": "fact:dock_wait_minutes", "notes": "..." },
    { "type": "traction", "title": "MRR has grown 10x in 21 months",
      "chart": { "kind": "bar", "series": [{ "name": "MRR (EUR k)", "values": [4, 7, 12, 18, 25, 33, 41] }],
                 "labels": ["Jan 25", "Apr 25", "Jul 25", "Oct 25", "Jan 26", "Apr 26", "Oct 26"],
                 "y_label": "EUR k / month", "source": "fact:mrr_series" },
      "stats": [{ "value": "EUR 41k", "label": "MRR, Oct 2026" }, { "value": "27", "label": "paying customers" }],
      "notes": "..." },
    { "type": "custom_html", "html": "<div class='custom'>...</div>", "notes": "..." }
  ]
}
```

Slide types and their fields are documented in `references/deck-structure.md`. Every
number on a slide carries a `source` that names a ledger id (`fact:<id>`), so the builder
can print a sources appendix and the checker can confirm the deck matches the ledger.

## run-log.md

Append one dated entry per run: files read, questions asked, answers received, outputs
written. This is the audit trail that lets a founder (or an investor doing diligence)
see how the pitch evolved.
