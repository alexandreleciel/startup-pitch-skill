---
name: startup-pitch
description: Use when a founder wants an investor pitch, pitch deck, fundraising narrative, investor Q&A preparation, red-flag review or a deck rebuild, working from the files already in their startup folder (notes, metrics exports, financial model, old decks, memos). Trigger on "pitch", "pitch deck", "investor deck", "raise a pre-seed / seed / Series A", "prepare me for investor meetings", "what will VCs ask", "fundraising story", "review my deck", "update the deck numbers", even when the user does not say the word deck. Also use when a user shares startup materials and asks what investors will think. Produces a one-page start page backed by a sourced fact ledger, and on request a narrative, investor Q&A and an HTML, PDF and PPTX deck.
license: MIT
compatibility: Needs read access to the startup folder, a shell and python3. Deck export also needs node 18+ and Chrome or Edge; run `python3 scripts/pitch.py doctor` to see what is available.
metadata:
  version: 0.10.0
  homepage: https://github.com/alexandreleciel/startup-pitch-skill
---

# Startup pitch

Turn a founder's folder into an investor pitch they can defend. Every run starts with the
**quick run**: one page, `pitch/START-HERE.md`, backed by a small sourced ledger. The
narrative, the full investor Q&A and the deck are add-ons the founder asks for.

## Rules

1. **Read before asking.** Run intake and read the files first. Ask only for what is missing,
   material at this stage, and not derivable from the folder.
2. **Every number has a source.** A figure appears in any output only through an entry in
   `pitch/facts.yaml` with a kind (fact, assumption, projection) and a source. If the folder
   has no number, write `[needs number]` and ask. Inventing traction, revenue, market size,
   growth, retention, customers, hires or valuation is the failure this skill exists to prevent.
3. **Surface contradictions, never average them.** Record both values as `conflicting`, use
   the conservative one, say so, ask the founder.
4. **Confidential material stays out of investor-facing text.** Files flagged confidential are
   not read. Valuations, terms, cap table names, prospective investor names, salaries and
   contract terms stay out of the narrative and deck wherever they appear.
5. **Keep the founder's voice.** Use their specific phrasing and customer quotes. Remove
   buzzwords; add none.
6. **Small ledger.** Record only numbers an output cites, plus both sides of each conflict.
   No intermediate entries, no history nobody cites.

## Commands

One entry point; `$SKILL` is this skill's directory (use its absolute path). Run from the
startup folder.

```bash
python3 $SKILL/scripts/pitch.py intake        # inventory + extract -> pitch/intake/
python3 $SKILL/scripts/pitch.py check         # verify pitch/facts.yaml (and the deck if present)
python3 $SKILL/scripts/pitch.py deck          # build html + pptx, print pdf, QA screenshots, trace numbers
python3 $SKILL/scripts/pitch.py comparables --sector saas --round seed   # three real decks to study
python3 $SKILL/scripts/pitch.py status        # what exists, what is open
python3 $SKILL/scripts/pitch.py open          # open pitch/ for the founder
```

`pitch.py setup` installs the deck dependencies inside the skill folder (the first `deck`
run does it automatically); `pitch.py doctor` shows what is installed.

## Quick run (always first; aim for five minutes)

Read `references/core.md` and `references/file-formats.md`. Open no other reference.

1. `pitch.py intake`. Read `pitch/intake/corpus/INDEX.md`, then the files it lists, in
   order: the founder's memos and notes first, then data, then the rest. Prefer the newest of
   any stale pair. Do not open files marked confidential. A file the index marks as
   containing deal terms or pay may be read; those terms stay out of investor-facing text.
2. Write `pitch/facts.yaml`: 15 to 30 entries, only what the start page will cite. Start from
   `scripts/facts_template.yaml`. Run `pitch.py check`; fix every FAIL. A WARN is a question
   for the founder, not something to paper over. `pitch.py check --explain` prints how the
   checker matches ids, units and deck figures, so there is no need to read its source.
3. Write `pitch/START-HERE.md` with the template in `references/file-formats.md`:
   the questions the founder must answer (five at most, contradictions first, each with the
   value used until answered), the two-sentence pitch and 60-second version, the three to
   five numbers that matter and the claims not to use yet, the five investor questions they
   are least ready for with honest answers, the top three red flags with fixes, and what was
   kept out of investor material. About 1,200 words. With more than five open items, put the
   rest in `pitch/gaps.md` and link it.
4. Tell the founder, in chat: the same questions, what you assumed, and the next steps they
   can ask for (narrative, full Q&A, deck, meeting prep). Run `pitch.py open`.

If the target investor is unknown, that is one of the five questions; state the default from
`core.md` and proceed.

## Add-ons (do the ones the founder asked for; the quick run still comes first)

| The founder wants | Read | Do |
|---|---|---|
| The narrative | `references/narrative.md` | Write `pitch/narrative.md`: purpose sentence, narrative choices, long form, two-sentence, 60-second and 3-minute versions. Cite ids inline. Other variants only on request. |
| Investor Q&A | `references/investor-questions.md`; `question-bank.md` as a lookup by theme | Write `pitch/investor-qa.md`: least-ready five, 10-question drill, at most 15 themed questions with honest answers citing ids, and red-flag records in the `core.md` format. |
| A full red-flag audit or pre-send check | `references/red-flags.md` | Add the audit to `investor-qa.md` (or the deck review) with every flag's trigger, fix and status. |
| A deck | `references/deck-structure.md` (capacity table), `references/design.md` | `pitch.py comparables` and skim the three decks' structure. Write `pitch/deck/deck.json` within the capacity table, a theme chosen for this company, brand colours and logo if the folder has them. `pitch.py deck`. Fix every lint and QA line by cutting words, rerun until the summary is clean, then look at `pitch/deck/qa/` yourself. |
| Prep for an investor type or firm | `references/investor-types.md`, the one block in `investor-types-detail.md`, `references/meetings.md` | Tune the Q&A and the ask. Use only what a firm's public pages say, cited. |
| Stage benchmarks, model-specific metrics | `references/benchmarks.md`, the one block in `metrics-by-model.md` | Quote with source and year, or not at all. |
| "Review my deck" (pdf, pptx, html in the folder) | `references/red-flags.md` | Intake extracts it. Build the ledger from deck plus folder, write the start page as a review, offer the rebuild. |
| "Update the numbers" | none | Re-run intake and check, update the ledger, rebuild outputs, list every changed value old and new. |
| A 3-minute demo day pitch | `references/narrative.md`, `references/deck-structure.md` | Demo-day variant and the 6 to 8 slide structure. |

Each add-on extends the ledger only with the numbers it newly cites. Add each new file to the
"Files" list at the bottom of START-HERE.md.

## When the founder answers

Update the ledger first, then the pages.

- A decision (the round size, the target investor, which of two figures is current) becomes
  `status: confirmed`; the other side of a conflict moves into its `note`.
- A claim with no file behind it (a refund count, the founder's background) is recorded with
  `source: founder statement, <date>` and `status: unverified`, stated plainly in outputs,
  and the record that would back it goes on the list of things to bring.
- An issue the founder leaves open ("I need to redo the budget") gets `open_question:` on
  the entry it concerns, so the check reports a WARN, not a FAIL. Do not add entries to make
  an identity balance.
- An answer that contradicts a file is applied, and the file is named in START-HERE.md
  section 1 as needing an update.
- If they name an investor type or region, open `references/investor-types.md`.

Run `pitch.py check`, update START-HERE.md and every output that cited the changed ids,
and report each changed value as old to new. Remove answered questions; promote the next
open item. If they ask for a deck while slots are still open, build it and list the
remaining `[needs number]` slots first in your reply.

## When nobody can answer (non-interactive run)

Continue with the conservative value for every conflict and `[needs number]` for every gap.
START-HERE.md section 1 lists every open item, so nothing is hidden; a deck may keep visible
`[needs number]` slots.

## Before handing over

- `pitch.py check` has no FAIL; with a deck, the `pitch.py deck` summary shows a checked
  PPTX, matching PDF page count, 0 QA issues.
- Every number in every output cites a ledger id; no confidential content in investor-facing
  text.
- Slide titles alone tell the pitch (read them top to bottom).
- Small samples state n and setting; data older than 18 months carries its date.
- Append a dated entry to `pitch/run-log.md`: files read, questions asked, answers, outputs.

## Reference map

| File | Open when |
|---|---|
| `references/core.md` | every run |
| `references/file-formats.md` | every run (ledger, START-HERE template, deck.json, folder layout) |
| `references/narrative.md` | writing narrative.md or any spoken variant |
| `references/investor-questions.md`, `question-bank.md`, `meetings.md` | Q&A, lookups by theme, meeting run sheet and follow-up |
| `references/red-flags.md` | deck reviews, full audits, pre-send check |
| `references/investor-types.md`, `investor-types-detail.md` | a target investor type or region is named |
| `references/metrics.md`, `metrics-by-model.md`, `benchmarks.md` | metric definitions, one business model's metrics, stage bars |
| `references/deck-structure.md`, `references/design.md` | building or reviewing a deck |
| `references/deck-library.md` | a comparable deck has structure notes there (the comparables command says so) |

## Common mistakes

- Writing the pitch first and back-filling sources. The ledger comes first so the story is
  built from what is true.
- Trusting the founder memo over the metrics export. Memos round up: record both, ask.
- Presenting one customer's three-month result as a company metric. State n and setting.
- Filling the market slide from a report because the folder has nothing. Use
  `[needs number]` and give the founder the bottom-up method.
- Reading every reference before starting. The quick run needs two files.
- Padding the ledger to quiet the checker. Use `computed: true` for values you summed or
  counted, and cite only what you use.
- Fitting an overflowing slide by shrinking type. Cut words or split the slide.
- Hiding a weak answer. Investors find it; a candid answer with a plan reads as maturity.
