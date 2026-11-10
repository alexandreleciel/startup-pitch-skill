# Testing evidence

This document records what was actually tested, how, and what the results were. Where a
result is an opinion (narrative quality) it is labelled as such; where it is mechanical
(a string found or not found in an output file) the script that produced it is named.

## What was tested

Three fictional startup folders under `examples/fixtures/`, each with planted traps and a
written answer key (`examples/fixtures/ANSWER-KEY.md`):

| Fixture | Stage, model | Files | What it tests |
|---|---|---|---|
| `meridian-ops` | Seed, B2B SaaS, EUR 3M | 16 | Contradictions between a founder memo and the metrics export (ARR 520k vs 494k, 3.4x vs 2.15x YoY), a confidential term sheet, stale duplicates, a scoped case-study metric |
| `hearthbox` | Pre-seed, consumer hardware + subscription | 4 | Sparse inputs: no model, market, competitors or team bio; a placeholder "$XXB" market; an unclear ask; an unconfirmed co-founder |
| `kestrel-health` | Series A, B2B2C marketplace, GBP 9.5M | 15 | Q3 GMV 1.9M vs 1.73M in the weekly KPI file, TAM 4.2B vs 11B with different methods, small-n clinical claim, salary spreadsheet, draft round terms with a named lead |

## How the runs were executed

Baseline and with-skill runs were executed as fresh Claude subagents (same model family as
the authoring session, Claude Fable 5.1) working in a copy of each fixture folder. The
baseline received only the plain prompt below. The with-skill run received the same prompt
plus the path to the skill folder. This mirrors the methodology in Anthropic's skill-creator
skill. We did not use `claude -p` because the headless CLI cannot authenticate from inside a
Claude Desktop child session on this machine (recorded in the run logs).

Plain prompt (baseline and with-skill, Meridian):

> Read the files in this folder to understand my startup. Then write me an investor pitch
> (a narrative I can use in meetings and as the basis for a deck), tell me which numbers
> matter most, list the questions investors are likely to ask with the best answers, and
> point out any red flags or concerns. Save everything as markdown files in a folder
> called pitch/ here.

The Hearthbox and Kestrel prompts are in `skills/startup-pitch/evals/*/prompt.md`.

Mechanical grading: `tests/grade_outputs.py <case> <pitch-folder>` scans every text file
the run produced and checks the traps that can be checked by pattern (leaks of confidential
strings, use of a wrong figure as fact, presence of flag words next to a contested figure,
presence of a sourced ledger). Judgement grading (narrative quality, usefulness of the Q&A,
deck design) was done by reading the outputs and is reported as opinion.

Limitations of this evidence:

- Three fixtures, one run each per condition. Variance between runs is real and was not
  measured; treat differences of one or two checks as noise.
- The grader is pattern-based; two of its checks were corrected during the baseline pass
  after false positives (font names matched as credentials, a correctly labelled
  "co-founder in conversation" matched as a confirmed co-founder). All results below are
  from the corrected grader.
- The baseline model is strong. A good share of the traps were caught without the skill.
  The honest comparison is on the remaining failures and on the structure of the output
  (sourced ledger, consistent numbers across narrative, Q&A and deck, exportable deck).

## First round: full runs against a plain prompt

### Mechanical trap checks (tests/grade_outputs.py, final grader)

| Fixture | Plain prompt | With skill | What the skill fixed |
|---|---|---|---|
| meridian-ops (seed SaaS) | 7 / 8 | 8 / 8 | No sourced ledger in the baseline; the skill produced 103 sourced entries, 8 marked conflicting, checker verdict WARN with every WARN explained |
| hearthbox (pre-seed, sparse) | 7 / 9 | 9 / 9 | Baseline listed an unconfirmed candidate as "Co-founder" on the team slide and wrote the SAFE cap into the investor narrative; the skill kept both out and left the market as `[needs number]` |
| kestrel-health (Series A) | 9 / 10 | 10 / 10 | No ledger in the baseline; the skill never read `hr/salaries.xlsx` or the round-terms draft (excluded at inventory) and put the GMV reconciliation on the slide |

Per-run grading JSON and timings: `docs/evidence/iteration-1/`. Baselines were strong on
the headline contradictions (ARR 520k vs 494k, GMV 1.9M vs 1.73M, the small-n clinical
claim); the measurable difference is structural: sourced ledger, consistency checks, refusal
to present unconfirmed people and terms, and the exportable deck.

### Time and tokens (subagent harness, one run each)

| Fixture | Plain prompt | With skill |
|---|---|---|
| meridian-ops | 10.2 min, 121k tokens | 20.3 min, 265k tokens |
| hearthbox | 12.6 min, 185k tokens | 20.5 min, 338k tokens (incl. deck) |
| kestrel-health | 18.7 min, 200k tokens (incl. PPTX via the pptx skill) | 33.8 min, 438k tokens (incl. deck) |

The skill roughly doubles time and tokens. The extra buys the ledger, the checker passes,
the gaps file and, where asked, the deck pipeline with QA. Founders who want only the
narrative can stop after Phase 5.

### Judgement notes (opinion, from reading the outputs)

- The with-skill `gaps.md` files are the most useful single artefact: five prioritised
  questions with the assumption applied if unanswered. The Meridian run found a model-runway
  contradiction (26 months claimed, about 19 by the model's own P&L) that neither the memo
  nor the baseline caught.
- Narratives are specific and defensible rather than rousing. That is the intended trade.
- Baseline outputs were good prose and in two cases produced decks (one HTML, one PPTX via
  the installed pptx skill). The skill's decks are more consistent: every number carries a
  source, placeholders are visible, and the PDF and PPTX come from one source file.
- Weakness found and fixed during testing: the first builder printed raw ledger ids
  (`fact:retail_price`) on content slides. It now prints the source file name or a footnote
  number, and keeps ids on the sources slide only.
- Weakness found and not yet fixed: a chart whose data comes from several derived ledger
  entries gets a long concatenated caption ("Source: GMV, Q1 2026, weekly export, GMV, Q2
  2026, ..."). Cosmetic; tracked in the deck-template README.
- Weakness found and fixed: the ledger checker only resolved `fact:` prefixes in deck
  sources; `assumption:` and `projection:` now resolve too.

### Pipeline checks on this machine (macOS 15, Node 26, Python 3.15, Chrome 157, LibreOffice 26.8)

| Check | Result |
|---|---|
| `inventory.py` + `extract.py` on all three fixtures | All confidential and stale traps flagged; PDF via pdftotext, xlsx/docx/pptx via the stdlib fallback (no optional packages installed) |
| `ledger_check.py` on the shipped good and broken ledgers | Good: WARN (one intended staleness notice). Broken: FAIL with 7 failing checks, each with a plain-English question |
| `build_deck.js` on the example deck, four themes | HTML written, `--check` 0 issues, PPTX validated by Anthropic's validate.py (a copy vendored at the time, since removed; lxml in an isolated venv via PITCH_PYTHON), LibreOffice render matches |
| `export_pdf.sh` | Chrome headless, page count equals slide count on every deck built (21, 17, 19, 21 pages) |
| `library.py --stats`, random URL re-check | 440 rows, 437 ok; 5 of 5 random source pages re-fetched with HTTP 200 and a deck signal |
| `claude plugin validate .` | Validation passed |
| Live Codex CLI run (`codex exec`, workspace-write sandbox, skill symlinked into `~/.agents/skills`) | Discovered the skill, ran inventory, extract and ledger_check (exit 0 each), produced facts.yaml and gaps.md with five founder questions, finished in 364 s. Transcript in `docs/evidence/codex-route/` |
| `tests/lint_repo.sh` | PASS (no em dashes outside vendored and transcript folders, no secrets, no absolute paths, SKILL.md under 500 lines, all referenced files present) |

## Second round: the ease-of-use pass

After the first round, the three with-skill agents were asked what they actually read and
where their time went. Their answers drove a second version: a quick run with one start
page, a single `pitch.py` entry point, references split into a core plus on-demand files,
a capacity check in the deck builder, and checker rules that no longer push runs into
padding the ledger. It was then re-tested in two turns per fixture, with a deliberately
vague opening request and the tester answering as the founder.

Opening request, all three fixtures:

> Help me with my investor pitch. Everything is in this folder.

### Turn 1: quick run (start page)

| Fixture | First version, full run | Quick run | Ledger entries | Trap checks |
|---|---|---|---|---|
| meridian-ops | 20.3 min, 265k tokens | 7.3 min, 152k tokens | 29 (was 103) | 8 / 8 |
| hearthbox | 20.5 min, 338k tokens | 5.4 min, 127k tokens | 27 (was 53) | 9 / 9 |
| kestrel-health | 33.8 min, 438k tokens | 9.4 min, 169k tokens | 32 (was 170) | 10 / 10 |

Each quick run opened only `SKILL.md`, `core.md`, `file-formats.md` and the ledger template
(about 45 KB, against 150 to 250 KB read in the first round), read no script source, and
ended with five questions for the founder and the values used meanwhile. The start pages are
in `docs/evidence/iteration-2/*/quick_run/START-HERE.md`. They ran to 1,500 to 1,700 words
against a "one page" target; the template now carries word budgets (about 1,200 words).

### Turn 2: the founder answers and asks for more

| Fixture | Founder asked for | Time | Result | Trap checks |
|---|---|---|---|---|
| meridian-ops | answers to all five, then "build the deck" | 10.4 min | Every changed value reported old to new. 12 slides plus a one-page sources summary; 0 capacity warnings and 0 QA issues on the first build (two further builds were visual polish). PPTX validated, PDF page count matched, every slide number traced to the ledger. | 8 / 8 |
| hearthbox | partial answers including facts no file backs, then "write the full narrative and the investor Q&A" | 10.2 min | Founder statements recorded as unverified with their date; narrative 2,314 words, Q&A 3,694 words; opened only the narrative, investor-questions, question-bank and investor-types files. | 9 / 9 |
| kestrel-health | answers that overruled the conservative GMV figure, one question left open, then "build the Series A deck" | 13.5 min | 16 slides plus a one-page sources summary (the first version's appendix ran to 18 pages); 0 capacity warnings and 0 QA issues on the first build; the export figure kept as a footnoted entry. | 10 / 10 |

In the first round the Kestrel deck needed three builds to clear 21 overflow issues. In the
second round neither deck had a capacity warning or a QA issue on any build.

### What the second round found and what was done

- **Fonts never loaded (fixed).** The builder truncated the Google Fonts token, so every
  deck rendered in fallback faces while QA reported no issue. Found by the Kestrel run.
  After the fix the font request succeeds and all four themes render clean with the real
  faces. The capacity limits were then re-verified against the real fonts (see below).
- **Acknowledged open issues (fixed).** When a founder confirmed the round size but left the
  budget open, the checker turned a warning into a failure and the run padded the ledger to
  pass. Entries can now carry `open_question:` to keep such an identity as a warning.
- **Founder statements (fixed).** `source: founder statement, <date>` is now accepted
  without a file.
- **File names in captions (fixed).** Captions show source file names, which exposed a
  customer's name. A ledger entry can now carry `cite_as:`; the Meridian sample uses it.
- **Start page length, undocumented ledger fields, index order, grader scope (fixed).**
- **Bundled validator (removed).** The first version vendored the validator from Anthropic's
  pptx skill. It was removed before the first commit. Every PPTX now gets a built-in
  structural check (`scripts/pptx_check.py`: archive, XML, slide list, relationships,
  content types, colour values; it passes real decks and fails a deliberately broken one),
  and Anthropic's validator still runs automatically when the user has that skill installed.
- **Capacity limits re-verified with real fonts.** After the font fix, 7 of 516 limit-case
  renders overflowed. The capacity check now measures text in the deck's actual typefaces
  instead of counting characters; the harness shows 0 issues in all 516 renders (four
  themes, both variants), re-run independently after the change.
- **Still open:** the presenting variant is not built automatically alongside the reading
  one; a deck QA pass cannot tell whether brand fonts loaded on the founder's machine; the
  PPTX is still unverified in PowerPoint and Keynote.

### Codex CLI

| Check | Result |
|---|---|
| Automatic triggering | A plain request that did not name the skill ("Help me with my investor pitch. Everything is in this folder.") made Codex select the skill and write START-HERE.md, facts.yaml and gaps.md in 382 seconds. Transcript: `docs/evidence/codex-trigger/`. |
| Explicit invocation (first round) | `$startup-pitch` ran intake, ledger and gaps with exit 0. Transcript: `docs/evidence/codex-route/`. |

Automatic triggering in Claude Code could not be tested here: the headless `claude -p`
cannot authenticate from inside a Claude Desktop child session.

## Not tested

- PowerPoint or Keynote rendering of the PPTX (LibreOffice only).
- Windows and Linux.
- claude.ai skill upload, Cowork, Claude Desktop Code tab, Cursor, Gemini CLI, Copilot CLI,
  OpenCode, Amp (documented from vendor pages only).
- Automatic triggering in Claude Code, and `install.sh` on a clean machine.
- A real person answering the questions; the second-round founder answers were written by
  the tester from the fixture answer key.
- Run-to-run variance (one run per condition).
- Real founder folders and real investor reactions.
