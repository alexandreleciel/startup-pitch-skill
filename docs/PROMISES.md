# Promises and evidence

The launch video and README describe what this skill does. This page says, promise by
promise, what the evidence in this repository supports and what still needs validation by
real founders. Evidence references point to `docs/TESTING.md` and the workspace files it
names. Date of assessment: 2026-11-10, updated after the second test round the same day.

Status words: **supported** (we ran it and have the artefacts), **partly supported** (it
works, with a limitation stated), **needs validation** (plausible and designed for, but not
demonstrated under real conditions).

## Promise by promise

| Promise | Status | What the evidence shows |
|---|---|---|
| Understands the startup from the files in its folder (product, audience, stage, model, traction, financials, founder's view) | Supported on three fixtures | Intake scripts inventoried 35 files across three fictional startups, extracted PDF, XLSX, CSV, DOCX and SVG without optional packages, and the with-skill runs built ledgers of 103, 53 and 170 entries covering all nine headings. Real founder folders are messier than fixtures; see "needs validation". |
| Reads before asking; asks only for what is genuinely missing | Supported | Every run opens with at most five prioritised questions derived from the folder (which ARR figure is current; who is the founder; which GMV figure is authoritative) and states the value used until answered. In the second round the tester answered as the founder: answers were applied to the ledger first and each changed value was reported old to new. A real founder has not yet done this. |
| Compelling pitch narrative adapted to stage and investor | Partly supported | Narratives follow the referenced sequences, state the archetype chosen and why, and ship 2-sentence, 60-second, 3-minute, 15-minute and read-ahead variants. "Compelling" is a judgement; ours is that the outputs are specific and defensible, and that is the honest limit of what a maintainer can claim without investor feedback. |
| Identifies the numbers that matter | Supported | Each run produced a headline-number set with sources and a "numbers not to use yet" list (NRR and CAC payback with no data behind them were removed from the Meridian traction slide; refundable deposits were kept as the only hard Hearthbox number). |
| Surfaces investor concerns and red flags | Supported | Red-flag records in the skill's severity format: Meridian 3 critical, 11 major, 5 minor, including a model-runway contradiction (26 months claimed, about 19 by the model's own P&L) that neither the founder memo nor the baseline run caught. |
| Credible investor questions and answers | Supported, quality not yet investor-tested | Questions are generated from the startup's own gaps first, then from the themed bank; every answer cites ledger ids; weak answers are flagged rather than spun. Whether real investors find the answers credible needs founder use. |
| Distinguishes facts, assumptions and projections; never invents traction or financials | Supported | Every ledger entry carries a kind; the checker fails unsourced facts; `[needs number]` slots render visibly in decks. The mechanical grader found no invented market size, team credential or financial model in any with-skill run; the plain-prompt baseline wrote an unconfirmed candidate as "Co-founder" on a team slide and a SAFE cap into investor-facing text. |
| Reference library of more than 300 real, distinct decks, sources tracked, contents verified | Partly supported | 440 rows, 437 reachable with a deck signal on 2026-11-10, each with company, round, year, amount, sector and source URL. Content was personally viewed for 25 curated decks; the other 415 are verified as reachable pages with an embedded deck, not read slide by slide. Metadata is as reported by aggregators. |
| Authentic Airbnb and Higgsfield examples | Airbnb supported; Higgsfield unavailable, flagged | The authentic 14-slide Airbnb 2008 deck is indexed from faithful copies (not the editable redesigns) and studied in the curated set. No public Higgsfield fundraising deck exists as of 2026-11-10; the library records that with its public funding history instead. |
| Library is useful during pitch development | Partly supported | The deck step now starts with a comparables command that always returns three real decks and prefers ones with slide-level notes. Both second-round deck runs used it and took structure only (traction early, competition as a table, a named-risks appendix), no numbers. Whether this improves the deck has not been measured against a run without it. |
| Integrates an excellent presentation skill and an excellent front-end design skill | Supported | Presentation: the frontend-slides lineage (fixed stage, print-per-slide) plus Anthropic's pptx skill (its pptxgenjs rules, re-synthesised in the builder; its validator is used when the user has that skill installed, and is not bundled). Design: Anthropic's frontend-design principles distilled into `references/design.md` and four themes that avoid the generated-page defaults. Inventory in `docs/UPSTREAM-SOURCES.md`. |
| Produces an actual presentation with outstanding visual execution, editable source and reliable export | Supported for HTML and PDF; PPTX supported with limits | Example and fixture decks built in all four themes: HTML with zero overflow issues in the QA check, PDF page counts matching slide counts, PPTX passing a built-in structural check and, on the test machine, Anthropic's own validator, and rendering in LibreOffice. In the second round both decks built clean on the first attempt, where the first version needed up to three. A font-loading bug that made every earlier deck render in fallback faces was found and fixed in that round. "Outstanding" is a judgement; the previews are in the repository for the reader to judge. PPTX was not opened in PowerPoint or Keynote (neither is on the test machine). |
| Straightforward installation; working routes for Claude and ChatGPT verified | Claude Code and Codex CLI supported; others documented | One `install.sh` links the skill for both and sets up dependencies inside the skill folder; one `pitch.py` command runs each step. Claude Code: plugin manifest validates, scripts run locally. Codex CLI: a plain request that never named the skill triggered it and produced the start page in a live session, and an explicit `$startup-pitch` run also passed. Not run: `install.sh` on a clean machine, automatic triggering in Claude Code, claude.ai upload, Cowork, Cursor and the others. ChatGPT web cannot read a local folder; that is a platform limit. |
| Tested on realistic folders including incomplete and contradictory inputs, compared with a basic prompt | Supported, with small n | Three fixtures, same model family. Mechanical trap checks: baseline 7/8, 7/9, 9/10; with skill 8/8, 9/9, 10/10 in the first round and again in both turns of the second round. The baseline is strong; the skill's measurable gains are the sourced ledger, the refusal to present unconfirmed people and terms, consistency across files, and the exportable deck. Variance across runs was not measured. |
| Performance: speed and cost | Measured and improved | First version: 20 to 34 minutes and 265k to 440k tokens per full run. Second version: the start page arrives in 5 to 9 minutes (127k to 169k tokens), faster than the plain-prompt baseline's 10 to 19 minutes, and a deck adds 10 to 14 minutes. Reading per quick run fell from 150 to 250 KB to about 45 KB. |

## Claims that require the maintainer's own use

Statements about what the skill did for a specific raise (meetings booked, questions
anticipated correctly, money raised) are personal experience claims. Nothing in this
repository supports them yet. They should be made only after real use, with the founder's
own words, and ideally with the `run-log.md` of that raise as the record.

## What would move items from "partly" to "supported"

1. Ten founder folders from real companies (under NDA, outputs not published) run through
   the skill, with the founders scoring the five least-ready questions for relevance.
2. One investor reading three with-skill decks blind against three baseline decks.
3. Opening five generated PPTX files in PowerPoint on Windows and macOS and fixing what
   differs from the LibreOffice render.
4. Three repeated runs per fixture to measure variance in the trap checks.
5. A dedicated test of the deck library's effect: the same fixture with and without the
   instruction to study three comparable decks.
