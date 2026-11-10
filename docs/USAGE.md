# Usage

## Start

Open your agent (Claude Code or Codex) inside your startup's folder and say:

> Help me with my investor pitch. Everything is in this folder.

You do not need to name the skill or know any commands. In about five minutes you get one
page, `pitch/START-HERE.md`, and the folder opens.

## The start page

| Section | What it gives you |
|---|---|
| 1. Answer these first | Up to five questions: contradictions between your files first, then what is missing. Each shows the value used until you answer. |
| 2. Your pitch | The two-sentence version and a 60-second version, built only from what your files support. |
| 3. The numbers that matter | Three to five figures with their kind (fact, assumption, projection) and source file, plus the claims in your files you should not use yet. |
| 4. The five questions you are least ready for | Why an investor asks each, your strongest honest answer, what to have ready. |
| 5. Top three red flags | What an investor reads into each, and the fix. |
| 6. Kept out of investor material | Confidential files that were not read, and terms, names and pay details held back. |
| 7. Next | What you can ask for. |

Every figure on the page traces to `pitch/facts.yaml`, a small ledger (15 to 30 entries)
where each number names the file it came from.

## Answer, then ask for more

Reply to the questions in plain words ("ARR is 494k, the memo counted a contract that is
not live yet"). The ledger and the page are updated and every changed value is listed old
to new. Then ask for what you need:

| Say | You get |
|---|---|
| "Write the full narrative" | `pitch/narrative.md`: purpose sentence, long form, two-sentence, 60-second and 3-minute versions |
| "Prepare the investor Q&A" | `pitch/investor-qa.md`: the least-ready five, a 10-question rapid-fire drill, up to 15 themed questions with honest answers, red-flag records |
| "Build the deck" | `pitch/deck/`: `deck.json` (editable source), `deck.html` (present in a browser), `deck.pdf`, `deck.pptx` |
| "Prepare me for a meeting with a corporate VC" | Q&A and ask tuned to that investor type |
| "Review my deck" (with a PDF or PPTX in the folder) | A red-flag review and the start page, with an offer to rebuild |
| "Update the numbers, the October export is in data/" | Ledger and outputs rebuilt, changed values listed |
| "Make a 3-minute demo day version" | The demo-day narrative and a 6 to 8 slide deck |

You can ask for several at once ("narrative, Q&A and a deck for European seed funds"); the
start page still comes first.

## Editing the deck

Change `pitch/deck/deck.json` (text, numbers, notes, theme) and rebuild with one command:

```bash
python3 ~/.claude/skills/startup-pitch/scripts/pitch.py deck
```

(Use `~/.agents/skills/startup-pitch` if you installed for Codex.) It rebuilds the HTML and
PowerPoint, prints the PDF, screenshots every slide, checks for overflow and traces every
number on the slides back to the ledger. The summary at the end tells you what to fix.

Themes: `graphite`, `paper`, `signal`, `midnight`. Set `meta.theme`; override the accent
with `meta.accent` and fonts with `meta.font_display` / `meta.font_body`. Put a logo and a
brand file with hex colours in your folder and the deck picks them up.

Present from `deck.html`: arrow keys to move, `n` for speaker notes.

## Other commands

```bash
python3 ~/.claude/skills/startup-pitch/scripts/pitch.py status
```

shows what exists in `pitch/` and how many open slots remain. `pitch.py doctor` shows what
is installed; `pitch.py comparables --sector saas --round seed` lists three real decks to
study from the 440-deck library.

## Keeping confidential things out

Files whose names or contents look like term sheets, cap tables with names, salaries or
contracts, or that say "do not share", are not read. Files that merely mention deal terms
or pay are read, but those terms are held back from the narrative and deck. Section 6 of
the start page lists what was kept out. If you want something included, say so explicitly.

## What the skill will not do

- Invent traction, revenue, market size, growth, retention, customers or team credentials.
  Where your folder has nothing, the output says `[needs number]` or `[needs detail]` and
  asks you. In a deck these render as visible amber slots.
- Resolve a contradiction between two of your files on its own. It shows both and asks.
- Attribute a thesis or "signature question" to a named investor without a public source.

## Running the tests

The repository ships three fictional startups under `examples/fixtures/` with an answer key
of planted traps, and eval cases in `skills/startup-pitch/evals/`. With Claude Code 2.1.269
or later:

```bash
claude plugin eval skills/startup-pitch --allow-tools Write,Edit,Bash --scaffold
```

Mechanical trap checks on any produced `pitch/` folder:

```bash
python3 tests/grade_outputs.py meridian-ops path/to/pitch
```

Results we recorded are in `docs/TESTING.md`.
