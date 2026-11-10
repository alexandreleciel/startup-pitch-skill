# Investor questions: deriving them from the ledger and answering them

What this file is for: turning `facts.yaml` and the open questions (`START-HERE.md` section 1, `gaps.md` when it exists) into `pitch/investor-qa.md`, a question-by-question prep sheet in the founder's voice.
Read it when the founder asks for the full investor Q&A, after the ledger exists and before writing `investor-qa.md`. A quick run needs only `core.md`.
The themed bank is in `question-bank.md` (look up, do not read through); the meeting run sheet, follow-up email and objection log are in `meetings.md`.

## Contents

1. Generate questions from the startup's own weak spots
2. Stage filters: what dominates at pre-seed, seed, Series A, later
3. Trick and pressure questions, and the scripts that survive them
4. The answer rubric
5. Output template for `pitch/investor-qa.md`, with the default size

Vocabulary: a **fact** sits in a file, an **assumption** is a belief with a method, a **projection** comes from a
model (`file-formats.md`). "DD" is due diligence. A "cohort" is the customers who started in the same month.

## 1. Generate questions from the startup's own weak spots

A generic FAQ is worthless because the investor does not ask generic questions. They ask about the thing in
the deck that did not add up. So derive the first and most important questions from the ledger itself, then
fill in from the bank in `question-bank.md`. Investors spend most of their deck time on the team and financials
sections (DocSend, 2024), so weak spots there surface first.

### 1.1 Derivation rules (ledger state to question)

Walk every entry in `facts.yaml` and every item in `gaps.md`. Each rule below fires a question record.

| Ledger or gap state | Question the investor will ask | Intent behind it |
|---|---|---|
| `status: conflicting` (two values for one metric) | "Your deck says X and your model says Y. Which is it, and why do they differ?" | Can I trust any number from this team? Do they have clean systems? |
| `kind: assumption` with no `method` | "How did you get to that number?" | Is this a belief dressed as a fact? |
| `kind: assumption` on market size | "Walk me through the bottom-up: how many buyers, paying what, how many you can reach." | Is the market real or a slice of a report? |
| `kind: projection` | "What has to be true for this curve? Which driver are you least sure of?" | Does the founder know the model's levers, or did a spreadsheet produce them? |
| `derived_from` mismatch above 1 percent | "Your ARR is not 12 times your MRR. What is in the gap?" | Bookings counted as revenue? One-offs? Sloppiness? |
| Fact with small n (fewer than roughly 10 customers, one cohort, one month) | "Is this repeatable outside the founder's hands? What happens if the top customer leaves?" | Is this traction or three friendly logos? |
| Customer concentration (one customer above about a third of revenue) | "What is your exposure if they churn or renegotiate?" | Revenue quality, bargaining power. |
| Metric expected at this stage is absent (see section 2) | "What is your retention / CAC / gross margin?" | Either they do not measure it or it is bad. Both are information. |
| `as_of` older than about 90 days | "What do the numbers look like today?" | Did growth stall during the raise? |
| Cumulative chart in the corpus | "Show me the monthly numbers, not the cumulative." | Cumulative curves only go up; they hide a plateau. |
| No named competitor, or "no competitors" in the corpus | "Who else is solving this? What does the customer use today?" | No competitors usually means no market, or no homework. |
| The word "platform", or more than one business model listed | "Which one are you?" | Focus. A this-or-that question must never get "both". |
| Insight stated as passion or vision, no customer evidence | "What do you know that the incumbents do not? How did you learn it?" | Is there an earned insight or just enthusiasm? |
| Team gap in `gaps.md` (no technical founder, part-time founder, missing seller) | "Who builds the product? Who sells it? When is everyone full-time?" | Execution risk; whether the founders see the hole themselves. |
| Round terms in corpus (valuation, instrument, who is in) | "How did you arrive at that valuation? Who has committed?" | Price discipline, momentum, signalling. |
| Confidential material excluded (cap table, contracts) | Questions still come; prepare answers that give the structure without the file. | Cap table hygiene, messy SAFEs, prior IP claims. |
| Regulatory, custody, safety or data-privacy exposure in the domain | "What is the most likely regulatory threat and where are you on it?" | Could this be shut down or blocked at exit? |

### 1.2 The procedure

1. Produce one question record per fired rule, citing the ledger ids and the `gaps.md` item that triggered it.
2. Dedupe. Many rules fire on the same underlying weakness; merge into one question with several triggers.
3. Add the stage-dominant themes from section 2 that the ledger did not already cover, looking up
   questions in `question-bank.md` (only the themes you need).
4. Score each record: likelihood (will this investor type at this stage ask it, 1 to 3) times severity
   (how much a weak answer hurts, 1 to 3). Sort descending.
5. The top five with the weakest honest answers become "The five questions you are least ready for".
   Keep at most 15 more for the themed section, the highest scores first; write more only on request.
6. For every question, draft the answer using only ledger facts (section 4), label its confidence, and name
   the evidence the founder must have in hand. If the honest answer is weak, flag it and write the
   "how we will find out" version rather than inventing comfort. Never fabricate a figure to make an
   answer stronger; a question whose honest answer is "we do not know yet" is still a prepared question.

## 2. Stage filters

Weight the bank by stage; theme numbers below are the section numbers of `question-bank.md`. The criteria investors weigh and how the weight shifts: founders and insight
dominate at pre-seed and seed, traction becomes the baseline at seed, defensibility becomes existential
at Series A, and process discipline is itself evaluated from Series A onward (pedronauck vc-strategy
synthesis of CRV 2026 and Graham & Walker 2025).

| Stage | Themes that dominate | Themes that are light | Benchmarks to know, with source |
|---|---|---|---|
| Pre-seed | Team (theme 6), insight (theme 2), problem and why now (theme 1), demand evidence (theme 3 q9), use of funds (theme 8 q1, q5) | Unit economics, exit, most of theme 11 | About 90 percent of funded pre-seed decks showed a product at least in alpha (DocSend, 2020, historical); the "11 percent idea stage" figure sometimes quoted is only the inverse of that number, not a published statistic. |
| Seed | Traction (theme 3), business model (theme 4), GTM channel (theme 7 q2), competition (theme 5), round (theme 9) | Deep legal DD, exit path | CRV's live guide puts institutional seed expectations at roughly 250k to 1M USD ARR for B2B SaaS (CRV, "Pitching to Investors", July 2026, fetched 2026-11-10); the 500k to 1.5M figure attributed to CRV in some skills is not on that page and is unverified. CRV also says to start raising at least six months before zero cash and to budget three months for the active process (CRV, 2026). |
| Series A | Repeatability and cohorts (theme 3 q3, q9), unit economics (theme 4), moat (theme 5), expansion path (theme 7 q6), data integrity, full theme 11 | Origin story, why now | CRV's live guide gives 1M to 5M USD ARR in its body and 5M to 10M in its FAQ for Series A, category dependent (CRV, 2026, fetched 2026-11-10), yet 35.6 percent of Series A rounds had zero revenue and 69.8 percent were under 1M USD ARR (Carta, 2024, via pedronauck): the advice bar sits far above the actual distribution. |
| Later (B and beyond) | Efficiency (burn multiple, NRR, GRR), sales productivity, operating leverage (theme 4 q3), hiring plan, exit path (theme 5 q8), board and governance | Problem definition | Treat any later-stage threshold as market-dependent; state the number only with its source and year. |

Rules for the model:
- At pre-seed, do not generate five-year P&L questions; generate "what will you build first" and "what is the
  strongest demand evidence" questions instead.
- At seed, the absence of any retention or churn figure in the ledger is itself a top-five question.
- At Series A, a `status: conflicting` entry on revenue is automatically question number one. Investor type
  shifts the mix too (angels ask "why you", strategics ask about fit); see `investor-types.md`.

## 3. Trick and pressure questions

Investors probe to the edge of what the founder knows and then watch what happens. These scripts are
starting points; rewrite them in the founder's words with ledger facts.

| Question | What is really being tested | Answer that survives | Answer that fails |
|---|---|---|---|
| "What is your exit strategy?" | Whether the founder is building a company or a flip | "We are focused on building the company; the exit takes care of itself. The natural acquirers would be A and B, for reason C." | Naming an IPO date, or a specific buyer and price. |
| "Why will Google (or the incumbent) not do this?" | Humility plus a real reason | Concede they could. Then: their side project is your sole focus; it is cheaper to buy you than to build it; here is the switching cost or data you accumulate. | "They won't." "They're too slow." Refusing to concede. |
| "What valuation do you want?" | Price discipline | "The market will set it." If pressed: "Comparable companies have been valued between X and Y" with the source. | A number with no basis, or a number that moves within the meeting. |
| "Who else is in?" | Momentum, honesty | "We are running a tight process with several leads in diligence; we are not naming firms." Insiders: a definite yes with an amount. | Naming firms, or "they are deciding". |
| "What keeps you up at night?" | Self-awareness | One or two real risks from `gaps.md`, each with a mitigation and a date. | "Nothing." "Raising this round." |
| "Are you a platform or a tool? Marketplace or SaaS?" | Clarity of identity | Pick one. Say why. Name what you are not. | "Both." A this-or-that answered with both has ended real Series A processes (Garry Tan on Posterous). |
| "I don't like your idea. What else have you got?" | Posture under rejection, curiosity, range | Zero defensiveness. "Why do you think it will not work?" Engage with their reasoning; have a credible adjacent idea on tap. | Arguing. Repeating the pitch louder. Freezing. |
| "Your numbers from source A and source B disagree." | Data integrity | The reconciliation, line by line, with which number the deck uses and why. | Blaming a tool. Guessing. |
| "You have three customers. Is that a business?" | Repeatability | Who they are, why they bought, what the pipeline looks like, what proves it repeats outside your network. | Defending three as many. |
| A question you do not understand | Whether you answer past the question | Stop. "Can you say more about what you mean and why you ask?" Then answer exactly that. | Answering the question you wish they had asked. |
| A question at the edge of what you know | Honesty | "I do not know that yet. Here is how I will find out, and I will send it by tomorrow." | Bluffing. A misstated number or customer name can be disqualifying on its own (Dalton Caldwell's rule on misrepresentation, YC). |

Three rules under probe:
- The 10-second rule: lead with the direct answer in one sentence, then proof, then stop. Interruptions
  are normal; if the answer is buried, it is never heard.
- Three highest-signal facts: before the meeting, pick the two or three strongest facts (best traction
  figure, strongest founder credential, sharpest insight) and make sure each lands at least once whatever is asked.
- Shift altitude deliberately: ten-year picture down to this month's mechanics and back. Technical founders
  get stuck at one altitude.

## 4. The answer rubric

Every drafted answer in `investor-qa.md` follows this shape:

1. **Direct first sentence.** Answers the question asked. Yes, no, or the number.
2. **Number with unit and date.** "41,000 EUR MRR in October 2026", not "about 40k". Cite the ledger id.
   Say which kind it is when it is not a fact: "we assume", "the model projects".
3. **One supporting fact.** The thing that makes the number credible: the cohort, the customer, the method.
4. **Stop.** Let them ask the follow-up. Two to four sentences is the ceiling.

What defensiveness sounds like (flag these in drafts and in rehearsal transcripts):
- Starting with "well, actually"; answering a different question; context or three caveats before the number.
- Adjectives in place of evidence: "huge", "massive", "best-in-class", "seamless".
- "We have no competitors." "We only need one percent of the market." "We just need marketing."
- Repeating the pitch when challenged; speeding up; claiming certainty about a projection.

When "we do not know yet" is the right answer: when the ledger has no fact and no assumption with a
method for what was asked. Say so, then the plan: "We do not have cohort retention past month three because
the product has been live for four months. We will have the month-six curve in February; here is the
month-three number today." Investors fund teams that know the edge of their knowledge. The empty answer is
acceptable once per theme; two in the same theme mean the theme is a real gap and belongs in `gaps.md`.

Confidence labels for the template:
- **high**: the answer rests on confirmed facts, is rehearsed, and the evidence is in the appendix or data room.
- **medium**: rests on an unverified fact or an assumption with a stated method; evidence partly ready.
- **low**: rests on a projection, a conflicting entry, or a gap. Always carries the `FLAG: weak honest answer`
  line and a "how we will find out" sentence.

## 5. Output template for `pitch/investor-qa.md`

Default size: the five least-ready questions, the 10-question drill, and at most 15 themed questions chosen
by likelihood times severity, plus the red-flag records. More themed questions, the trick and pressure
section and the questions to ask the investor are written only on request (or when a meeting is booked).

Write this file exactly. Every number cites a ledger id in square brackets. Answers are in the first person
plural, in the founder's register (reuse their phrasing from the corpus where it is clear), with no filler.

```markdown
# Investor Q&A: <Company>, <stage> round, prepared <YYYY-MM-DD>, numbers as of <facts.yaml as_of>

## The five questions you are least ready for
Ranked by likelihood times severity, from the ledger and gaps.md. Fix the fact, the file or the
answer before the first meeting.

1. <Question>  (trigger: <gap or ledger id>, confidence: low)  -> fix: <what to do before meeting 1>
2. ...
5. ...

## Rapid-fire drill (10 questions, 15-second target each)
Read aloud, time it, score each answer 0-2 on directness, number density and non-defensiveness.
| # | Question | Target answer (one breath) | Ledger ids |
|---|---|---|---|
| 1 | What do you do? | <one sentence, concrete nouns> | |
| 2 | What is your progress? | <number, unit, date> | [id] |
| 3 | What is your unique insight? | ... | [id] |
| 4 | How do you get the first 1,000 customers? | ... | [id] |
| 5 | Who are your competitors and why are you different? | ... | [id] |
| 6 | How big is the market, bottom-up? | ... | [id] |
| 7 | What is your business model? | ... | [id] |
| 8 | Why now? | ... | [id] |
| 9 | How much are you raising and what does it buy? | ... | [id] |
| 10 | What is the biggest risk? | ... | [gap ref] |

## Questions by theme
<At most 15 blocks by default, highest likelihood times severity first, grouped under the theme names of
question-bank.md, stage-filtered.>

### <Theme, e.g. Traction and proof>

#### Q: <The question, in the investor's words>
**Why they ask it:** <one or two sentences: the intent, and what in our deck or ledger triggers it>
**Strongest honest answer (founder's voice):**
<Direct first sentence. Number with unit and date [ledger_id]. One supporting fact [ledger_id]. Stop.>
**Trap to avoid:** <the defensive or inflated version, one line>
**Evidence to have ready:** <file path in the startup folder, data-room item, or appendix slide name>
**Confidence:** high | medium | low
**FLAG:** <only when confidence is low: "weak honest answer" plus the "how we will find out" sentence and date>

## Red flags
<One record per critical or major flag, in the record format of core.md section 8.>

## Trick and pressure questions (on request)
<The rows of section 3 that apply, rewritten in the founder's words with ledger facts.>

## Questions to ask the investor (on request)
<Five to eight, from meetings.md section 1.2, tailored to the firm.>

## Appendix slides this prep requires
<List of slide titles to add to deck.json as appendix, each with the question it answers and ledger ids.>

## Data-room items this prep requires
<Numbered list: item, question it answers, status (ready / in progress / not applicable), owner.>
```

Rules for the model when filling it:
- Use only ledger facts. A number with no ledger id is a hard failure; create the ledger entry first
  (and if it has no source, it is an assumption, and the answer must say so).
- Where `status: conflicting`, the answer uses the conservative value and says the reconciliation is in progress.
- Projections appear in answers only as "the model projects X assuming Y", never as flat statements.
- Keep every answer under 70 words, rapid-fire targets under 35. Exclude confidential material (listed in
  `START-HERE.md` section 6 and `gaps.md` section 3); describe structure, not contents.
- Cross-check: every "Evidence to have ready" item must exist, be in `gaps.md` as missing, or be an appendix
  slide you add to `deck.json` (see `deck-structure.md`).
- Check the finished answers against the ten common flags in `core.md` section 8; open `red-flags.md` only for a full audit.

Sibling files: `narrative.md` for the story the answers must stay consistent with, `metrics.md` and `metrics-by-model.md` for which
numbers each stage and business model needs and how to compute them, `red-flags.md` for phrases and claims to strip,
`investor-types.md` for how angels, seed funds, multi-stage funds and strategics shift the question mix,
`deck-structure.md` for appendix slide types.
