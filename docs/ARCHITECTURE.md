# Architecture

`startup-pitch` is a single Agent Skill (the open SKILL.md format read by Claude Code,
claude.ai, Codex and other agents). It turns a startup's working folder into three
deliverables: a pitch narrative, investor Q&A preparation, and an optional slide deck
with editable source and PDF/PPTX export.

## Design principles

1. **Read before asking.** The skill inventories and extracts the folder first and only
   asks for information that is genuinely missing and material.
2. **Every number has a source.** Figures live in a fact ledger (`pitch/facts.yaml`)
   tagged as fact / assumption / projection, each with the file it came from.
   Nothing reaches the narrative or deck without a ledger entry. Invented traction or
   financials are a hard failure.
3. **Contradictions are surfaced, not resolved silently.** When sources disagree, the
   skill reports both values and asks the founder which is current.
4. **Confidential material stays out of the deck.** Cap tables with names, term sheets,
   salaries, customer contracts and anything marked confidential are flagged by the
   extractor and excluded from investor-facing outputs unless the founder opts in.
5. **Reliability over flourish for export.** The deck is generated from a structured
   `deck.json` by one builder into HTML (editable, self-contained) and PPTX (native,
   editable), and the HTML is printed to PDF with headless Chrome. The same content,
   three formats, no copy-paste drift.

## Pipeline

Every run starts with the quick run; the narrative, Q&A and deck are add-ons.

```
startup folder
   |  pitch.py intake      inventory.py + extract.py -> pitch/intake/ (inventory, corpus, INDEX.md)
   v
quick run   model reads references/core.md + file-formats.md and the corpus, writes
   |        pitch/facts.yaml (15 to 30 sourced entries)
   |  pitch.py check       ledger_check.py: arithmetic, identities, conflicts, sources
   v
pitch/START-HERE.md        questions for the founder, pitch in two sentences and 60 seconds,
   |                       numbers that matter, least-ready five, red flags, what was kept out
   v
founder answers            ledger updated first, then every output that cites the changed ids
   v
add-ons on request
   narrative   references/narrative.md            -> pitch/narrative.md
   Q&A         references/investor-questions.md   -> pitch/investor-qa.md
   deck        references/deck-structure.md, design.md, pitch.py comparables
               model writes pitch/deck/deck.json
               pitch.py deck: capacity lint -> deck.html + deck.pptx (structure checked) -> deck.pdf
                              -> QA screenshots -> every slide number traced to the ledger
```

`scripts/pitch.py` is the single entry point. It finds its own folder, installs the deck
dependencies locally on first use (`scripts/node_modules`, `scripts/.venv`), and prints one
summary a model or a founder can act on.

## Why references are split into a core and on-demand files

The first version had nine reference files of about 450 lines each, and test runs read them
front to back: 150 to 250 KB per run, most of it unused. Measured usage drove the split.
`core.md` (about 230 lines) holds what every run needs. Everything else is opened only when
its situation arises: one business model's metrics, one investor type's block, the question
bank as a lookup. A quick run now reads about 41 KB.

## Why a structured deck.json instead of free-form HTML

A model writing a 15-slide HTML deck from scratch produces a different layout every run,
breaks viewport fit, and cannot be exported to PPTX faithfully. A compact slide schema
with a dozen well-designed slide types (cover, problem, solution, product, market,
traction-chart, business-model, competition, team, financials, ask, closing, custom-html)
keeps the design quality constant, lets the founder edit content in one place, and gives
a native PPTX for the investors who ask for one. A `custom_html` slide type keeps the
escape hatch for bespoke slides. Because layouts are fixed, the builder knows each one's
capacity: it checks deck.json against a capacity table before rendering and says what fits,
so an overflowing slide is fixed by cutting words in one pass instead of by trial renders.

Design rules for the templates are distilled from Anthropic's `frontend-design` skill and
the frontend-slides / html-slides lineage; the PPTX side uses pptxgenjs following the rules in
Anthropic's pptx skill, with our own structural check (`scripts/pptx_check.py`); see docs/UPSTREAM-SOURCES.md. The rules: one memorable element per slide,
deliberate typography, no generic gradients, no bullet walls, viewport-safe scaling, and
reduced-motion support.

## Deck library

`assets/library/pitch-decks.csv` lists 440 real decks with company, round, year, amount,
sector, source URL and a verification status (437 verified reachable with a deck signal on
2026-11-10; `scripts/library_verify.py` re-checks them). `scripts/library.py` searches it.
Twenty-five decks in `references/deck-library.md` were viewed slide by slide and carry
structure and pattern notes the model uses as comparables (never as numbers). Decks that are
not public (Higgsfield, Stripe, OpenAI and others) are recorded in `unavailable.csv` with
what is public instead.

## Repository layout

```
startup-pitch-skill/
├── README.md                    install, quick start, what is tested
├── install.sh                   one-step install for Claude Code and Codex
├── skills/startup-pitch/        the skill (copy or symlink this folder)
│   ├── SKILL.md                 rules and workflow (about 140 lines)
│   ├── references/              core.md plus on-demand files
│   ├── scripts/                 pitch.py (entry point), inventory, extract, ledger_check, build_deck, export_pdf, library
│   ├── assets/                  deck templates/themes, deck library CSV
│   └── evals/                   test cases in the `claude plugin eval` layout
├── .claude-plugin/              marketplace + plugin manifest for `/plugin marketplace add`
├── docs/                        INSTALL, USAGE, ARCHITECTURE, TESTING, UPSTREAM-SOURCES, PROMISES
└── examples/                    fictional startup fixtures and sample outputs
```
