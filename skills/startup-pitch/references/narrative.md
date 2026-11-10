# Building the pitch narrative from the fact ledger

What this file is for: turning ledger entries into one story (purpose sentence, sequence, archetype, headlines, variants) without ever stating an assumption or projection as a fact.
Read it when the founder asks for the full narrative or any spoken or written variant, after `facts.yaml` and `START-HERE.md` exist and before writing `pitch/narrative.md` or any slide.
A quick run does not need it: the purpose sentence, the two-sentence pitch, the 60-second version and the phrasing rules are in `core.md`.

## Contents

1. Memo before deck, and the company purpose sentence
2. Canonical sequences and when each fits
3. Narrative archetypes and how to pick one from the ledger
4. The why-now test and the zoom-out move
5. Headline craft
6. Variants from one narrative, with word budgets (three by default, three on request)
7. Founder voice
8. Honesty rules inside the narrative
9. Output template for `pitch/narrative.md`

Sibling files: `metrics.md` (definitions and headline numbers by stage), `investor-questions.md` (Q&A), `red-flags.md`, `investor-types.md`, `deck-structure.md` (slide types), `design.md`, `file-formats.md` (ledger schema, `fact | assumption | projection`).

## 1. Memo before deck, and the company purpose sentence

Write the story in prose before any slide exists. Prose cannot hide a gap behind a bullet: if the memo cannot say why the company wins, the deck will not either (Underscore VC seed and Series A memo templates; Lily Lyman). The memo is also what a partner retells internally, so it is the artifact the deck is later derived from, not the other way round.

Procedure:

1. Read every ledger entry with `status: confirmed` and list the five strongest. These are the candidate "vertebrae" (YC Series A guide term: the handful of facts an investor must remember).
2. Write the one-paragraph memo (120 to 200 words) using only those entries plus labelled assumptions. Do not consult any deck template yet.
3. Only then choose a sequence (section 2) and an archetype (section 3).

The company purpose sentence comes first in the memo. Sequoia's business-plan outline asks founders to define the company in "a single declarative sentence" and warns against listing features in its place (Sequoia, "Writing a Business Plan", archived page, fetched 2026). Combine that with Kevin Hale's three-nouns test (YC, 2019): after one sentence the listener holds what you make, who it is for, and what problem it removes.

Template and checks:

```
<Company> <builds | sells | runs> <concrete thing> for <named customer> so they can <outcome>.
```

- Concrete nouns only. "Software" and "platform" fail unless followed by what the software does.
- Lead with what, not why or how. The why-now and the technology come later.
- Reproducibility test (Hale): ten engineers reading the sentence should sketch roughly the same product. If they would build ten different things, the sentence is still vague.
- No adjectives that carry no information ("innovative", "seamless", "next-generation").
- Zero numbers in this sentence. Numbers go in the sentence that follows it.

Good: "Meridian sells dock-scheduling software to mid-size freight terminals so trucks stop queueing." Bad: "Meridian is an AI-powered logistics platform transforming the supply chain."

## 2. Canonical sequences and when each fits

A sequence is the order of ideas, not a slide count. Pick one deliberately, then bend it where the ledger is strongest. Five published orders cover almost every case.

**Sequoia business-plan order** (Sequoia, archived article): company purpose, problem, solution, why now, market potential, competition and alternatives, business model, team, financials, vision. It is a thinking order: it forces why-now and competition early. It has no traction section, so companies with real numbers add one after solution.

**YC seed deck order** (Aaron Harris, YC, 2018): title, problem, solution, traction, more metrics, insight, business model, market, team, ask. Harris's structural rule: only the title is exactly one slide; every other item may expand into a short set, but keep sets small. His most-quoted line is that nobody cares about advisors: team means the people who build.

**YC Series A "fundraising vertebrae"** (YC Series A guide, Janelle Tam and Aaron Harris, published 2020, library page dated 2024): write the narrative as 10 to 15 bullets, each one a claim backed by its data points. One bullet becomes one slide, the bullet is the headline, the data is the body. Order: title, traction teaser, problem, solution, traction in depth, market, competition, vision, team, use of funds, appendix. Vision sits late on purpose: after ten slides of evidence the reader is willing to believe the future.

**NFX 15** (NFX, "The Non-Obvious Guide to Fundraising"): cover, team, problem, vision, size of opportunity, business model, traction, product and demo, competition, path to defensibility, plan ahead, distribution, secret sauce and key insights, summary of strongest points, appendix. Its four unusual sections (defensibility, distribution, secret sauce, closing summary) are exactly the questions infrastructure and AI investors ask, so borrow those even when you use another order.

**Demo-day compression** (Kevin Hale, YC blog, 2015; YC Demo Day guide, Geoff Ralston, 2016): pick the five to seven ideas the audience must remember, give each one slide, make every slide legible from the back of the room, one idea per slide, and a stranger must say the idea on sight. Hale's post names a 2 minute 30 second slot (historical, 2015). Ralston's order: what you do, problem, product and customer, bottom-up opportunity, traction, team, conclusion restating three or four points. Investors should understand how you make money by the end even without a model slide.

### Comparison

| Sequence | Opens with | Where traction sits | Where team sits | Best fit | Weak fit |
|---|---|---|---|---|---|
| Sequoia order | Purpose sentence, then problem | Not native; insert after solution | Late | Memo writing, pre-seed with a strong why-now, first draft of any story | Companies whose strongest ledger entries are metrics |
| YC seed (Harris, 2018) | Problem | Slide 4, right after solution | Late | Seed with early but real numbers; founders who need a safe default | Series A, where promise before proof reads thin |
| YC Series A vertebrae | Traction teaser on slide 2 | Early teaser plus 3 or more deep slides | Late | Series A and strong seed; any company where money, not product-market fit, is the obstacle | Pre-revenue companies (the teaser slot has nothing to show) |
| NFX 15 | Team on slide 2 | Middle | Slide 2 | Repeat founders; infrastructure, AI and network-effect businesses that will be asked about defensibility and distribution | First-time founders with no standout bios (team-first then undercuts the open) |
| Demo day (Hale, Ralston) | What you do, or the single strongest fact | As early as it is strong | Short, late | 2 to 3 minute stage slots, accelerator juries | Anything the audience will read alone |

Choosing rule: sort the confirmed ledger entries by how impressive they are to a stranger. If the top entry is a growth or revenue number, use the vertebrae order. If it is a founder fact, use NFX or move team to slide 2 in any order. If it is a market shift with a checkable date, use the Sequoia order and open on why-now. If nothing is yet impressive, use the YC seed order and let the insight slide carry the weight. Record the choice and the reason in `pitch/narrative.md` (section 9).

## 3. Narrative archetypes and how to pick one from the ledger

An archetype is the single answer to "why will this company win?" Mixing two produces a hedged pitch; investors remember a hedged pitch as no pitch. Choose one, then let the other strengths appear as supporting evidence.

| Archetype | Core claim | Ledger must contain | Typical stage | Watch for |
|---|---|---|---|---|
| Why-now driven | A dated external change opened a window that did not exist before | At least one `fact` describing the change (regulation date, cost curve, platform release) with an external source | Pre-seed, seed, deep tech, AI infrastructure | A company milestone disguised as a market change ("we launched v2") |
| Traction driven | The numbers already prove demand; capital buys speed | Revenue or usage series as `fact`, with time window, plus retention or repeat-use evidence | Seed with revenue, Series A and later | A bad traction story told anyway; cumulative-only charts |
| Insight or secret driven | The team knows something non-obvious about the customer or the technology, and has evidence for it | Customer research, failed alternatives tried, data no one else has, recorded as `fact` with sources | Pre-seed, seed, post-pivot companies | "Easy to use" or "better design" presented as the insight |
| Team driven | These specific people are among the few who can build this | Verifiable prior work (shipped systems, exits, domain years) as `fact` | Pre-seed, repeat founders, regulated or scientific fields | Titles instead of artifacts; the startup itself listed as the achievement |
| Wedge to platform | A narrow product wins one job today and that position expands into a much larger business | Wedge traction as `fact`; expansion path as labelled `assumption`; second-product evidence if any | Seed and Series A | Vision slide placed before any proof; a wedge that is not actually winning yet |

Picking by stage, driven by what the ledger supports:

- **Pre-seed.** Usually insight, team, or why-now. Traction is qualitative: paid pilots, letters of intent with scope and price, interview hit rates. Use those as evidence for the insight, not as a traction archetype in disguise.
- **Seed.** Insight or why-now with early traction as the proof section, or traction driven if the series is clean and the window is longer than a few months. Business model must be stated even if provisional.
- **Series A.** Traction driven by default (YC Series A guide: it is hard to raise an A on promise). Insight and why-now become the explanation of why the traction will continue. Wedge-to-platform is the vision section, delivered after the proof.
- **Later rounds.** Traction plus unit economics; the archetype question becomes "why does this compound?" Defer to `metrics.md` section 5 and the company's block in `metrics-by-model.md` for which figures are expected.

Point of view (NFX, James Currier, 2021) is a separate choice from archetype: tell it as an industry story (how the world changed and where you sit), a customer story (one named buyer's day before and after), a founder story (only with real founder-market fit), or a journey to insight (post-pivot: the one or two learnings, never the chronology). Currier's warning: founders default to the founder story because they like telling it, not because it works. Pair each archetype with the most effective voice, usually industry or customer.

Stage-fit rule (pedronauck narrative playbook): a company with validation-stage evidence telling a scale-up story loses credibility. If the ledger is thin, say so and pick the archetype the evidence supports, not the one the founder wishes it supported. Put the mismatch in `gaps.md` as a question for the founder.

## 4. The why-now test and the zoom-out move

Why-now is the most frequently faked section, and investors have seen the fake version. Run every candidate why-now through this test before it enters the narrative (adapted from the pedronauck narrative playbook, which compiles Oren Jacob, CRV and 50Folds):

1. Which axis changed: customer behaviour, competition, technical feasibility, or cost?
2. Is there an external, checkable data point for the change (a regulation with a date, a price series, a platform release)? An assertion like "AI is changing everything" fails.
3. Is it a market change, or a company milestone wearing a market costume?
4. Would the slide have been equally true five years ago, and will it be five years from now? If yes, it is a "why", not a "why now" (romankurnovskii anti-patterns, AP-02).
5. Answer both "why this year" and "why this decade".
6. If the enabling shift is more than two or three years old, pre-answer "why has nobody won this already?"
7. Does the wedge only work on the far side of the change? If it worked before, the change is not load-bearing.
8. Market timing is not fundraising timing. Never argue "we are raising now because the market is hot."

If no honest why-now survives, cut the section. DocSend's own guidance is to skip the slide when the problem has no particular timeliness (DocSend, 2020). Historical correlation, same source: the why-now slide appeared in 54 percent of funded decks versus 38 percent of unfunded decks (DocSend, 2020, historical; a correlation, not a cause).

**Zoom out to the trend first.** Sequoia's Aaref Hilaly opens a partner meeting with "what changed", then "what we do", then fast facts; the first five minutes earn the next fifteen. NFX agrees: open with the change in the world, because a listener may reject your framing of the problem before you reach the change that makes it solvable. First Round's storytelling guidance makes the same move: trend, then why-now, then product. In ledger terms: the opening sentence of the long-form narrative cites a `fact` about the world, not a fact about the company. Garry Tan's story shape is the test: the world was one way, something happened, the world is now another way, and the company is what the new world needs.

## 5. Headline craft

Every section of the narrative, and later every slide, carries a headline that is the takeaway. "Market" and "Traction" are labels, not headlines. The rule from the YC Series A guide: the bullet is the headline, the data is the body.

Rules:

- The headline states the conclusion. "Trucks wait 94 minutes at the average mid-size dock", not "The problem".
- It reads alone. Strip all bodies and read the headlines in order; they must still tell the whole story (read-alone test, NFX; teardown rubric). If a headline only makes sense with its body, rewrite it.
- Under about 12 words. Longer headlines become body text and stop being scanned.
- Numbers carry units and dates. "EUR 41k MRR, October 2026", never "41k" or "strong MRR". Name the unit exactly: MRR or ARR, MAU or DAU, gross or net (YC Series A guide).
- One number in the headline where possible; the rest of the numbers go in the body.
- Every number maps to a ledger id, written in the narrative as `[fact:mrr_current]`, so every headline number traces to the ledger.
- No question headlines, no rhetorical setups, no "Why us?".
- A headline built on an `assumption` or `projection` says so in the headline or the first body line: "We estimate 12,000 operators in the EU segment", "Model shows EUR 9.6M ARR by 2028 if churn holds at 2 percent".

Hale's three tests still apply to headlines (YC, 2015): legible (short), simple (one idea that does not fold into two), obvious (a stranger says the point on sight).

## 6. Variants from one narrative, with word budgets

Author each variant separately from the memo. A long version cut down loses its rhythm, and a short version padded out loses its point (Oren Jacob, via the pedronauck sequences file). All variants share the same ledger ids, the same purpose sentence and the same archetype; only compression and medium change. Budgets below are this skill's working budgets, not published statistics; time spoken variants out loud and adjust to the founder's own pace.

Default set (write these three, nothing else unless asked):

| Variant | Budget | Contains | Test |
|---|---|---|---|
| Two-sentence pitch | 2 sentences, under 45 words | Sentence 1: company name plus what it does for whom. Sentence 2: how it makes money or the single strongest fact | Email Test (Seibel, YC): email it to a smart friend and ask them to explain it back. Any clarifying question means revise. Email, not conversation, because the reader cannot interrupt |
| 60-second verbal | 130 to 160 words | Purpose sentence, the change in the world, the one strongest number with date, the ask | Listener repeats what you do and the number without notes |
| 3-minute demo day | 380 to 450 words, 5 to 7 slides | What you do, problem in one breath, product for whom, bottom-up opportunity, traction or team (whichever is stronger), restate three or four facts, ask (Ralston, YC, 2016; Hale, YC, 2015) | Each slide passes legible, simple, obvious; every slide under about seven words of text |

Rules across variants:

- The two-sentence pitch is the root. If it fails the Email Test, do not write the others yet.
- Lead with what is impressive, by the first or second sentence (Seibel). If the impressive thing is a number, give its time window; a chart or growth figure without the time it took earns no credit.
- Include the ask in every spoken variant longer than 60 seconds. A large share of pitches never state the ask (Seibel, YC talk, 2023); treat its absence as a defect.

### On request only

Write these only when the founder asks for them. Rules and budgets:

| Variant | Budget | Contains | Test |
|---|---|---|---|
| 15-minute partner meeting | 1,800 to 2,200 words spoken, 10 to 15 slides | What changed, what you do, fast facts, agenda, check-in question, then the chosen sequence; stop for questions at least every three slides | Plan roughly 20 minutes of material for an hour; the rest is discussion (Hilaly, Sequoia) |
| Read-ahead or teaser deck | 5 to 12 slides, up to about 30 words per slide | The headlines of the narrative with their key number and source note; no speaker needed | Survives being forwarded to someone who never met the founder; nothing on it the founder would refuse to see screenshotted |
| One-page memo | 400 to 600 words | Purpose sentence, problem, solution, why now, market with the math, traction, team, ask, one acknowledged risk with mitigation | A partner who read it once can retell it in 30 seconds; every number traces to a ledger id |

- Output form: the partner meeting as an outline only (opening block of what changed, what we do, fast facts, agenda and check-in; then one line per slide with its headline and the question to pause on; 25 to 40 lines); the read-ahead as 5 to 12 numbered headlines, each with its key number and id; the memo as prose.
- The teaser is not always right: an interested investor who receives three pages with no data may pass (Jason Lemkin's counterargument, cited in the pedronauck sequences file). When the ledger has strong numbers, the read-ahead carries them.
- Reading time matters for the read-ahead: average investor time per seed deck was about 3 minutes 44 seconds (DocSend, 2019 to 2020, historical) and later indexes report shorter times. Write the read-ahead for a three-minute reader.

## 7. Founder voice

The narrative should sound like the founder on a good day, not like a template. The ledger stores numbers; the founder's notes store phrasing. Use both.

Preserve the founder's own words when they are specific:

- Pull sentences from `pitch/intake/corpus/` that name a customer, a moment, a number, a mistake, or a mechanism, and keep them close to verbatim. "Nordfracht's dispatcher called us at 6am because the gate queue hit the motorway" is better than any paraphrase.
- Keep the founder's informal grammar and regional English where it is clear. Fix only dictation errors and proper-name spellings.
- Replace the founder's words only when they are vague, inflated, or buzzwords. Then rewrite with a plainer, more specific sentence and note the change in `run-log.md`.

Never-say list with the accepted rewrite (YC applicant guidance compiled in pedronauck yc-apply anti-patterns; honesty-protocol, ferdinandobons):

| Never say | Say instead |
|---|---|
| "We have no competitors" | Name the three alternatives customers use today, including spreadsheets and doing nothing, and what each does well |
| "We need funding to start" | What was built, sold or signed with the money already spent |
| "AI-powered platform for X" | What the product does for whom, then what the model automates, with the human steps named |
| "Leveraging synergies across the ecosystem" | Plain verbs and concrete nouns: "we resell through the two terminal operators who already bill the carriers" |
| "Some users", "several customers", "a few pilots" | The exact count, the date, and whether they pay |
| "A USD 50B market" with no math | "N customers x price x share we can serve = Z", each term with a ledger id |
| "Passionate", "dedicated", "world-class team" | One shipped artifact or verifiable result per founder |
| "We're in stealth" | Omit, unless a genuine IP reason exists and is stated |
| "Revolutionary", "disruptive", "game-changing" | The measured difference: "30 percent fewer idle hours in the pilot", with the id |
| "We'll use the funds to grow" | Amount, allocation, and the milestone it buys in 18 to 24 months |

Avoid the tells of machine-written text (romankurnovskii patterns-and-antipatterns, Part 4, 2024 to 2026): exactly three symmetric bullets on every slide, "not just X, but Y" scaffolding, em dashes as the default punctuation, adjectives with no unit attached, one uniform register from problem through team, a closing vision with no link to the wedge, and placeholder residue such as `[X]%` or `TBD`. Human narratives are lumpy: some sections short, some with a story, some with a table. Also avoid invented specificity: a plausible figure with no ledger id is a hard failure for the checker, not a style issue.

## 8. Honesty rules inside the narrative

The ledger kinds decide the verb. Investors treat facts, assumptions and projections very differently, and so must the sentence (file-formats.md).

| Kind | How to phrase | Example |
|---|---|---|
| `fact`, `status: confirmed` | State flat, with unit and date, cite the id | "MRR was EUR 41k in October 2026 `[fact:mrr_current]`" |
| `fact`, `status: unverified` | State it, add the source type, flag in `gaps.md` | "The founder memo reports 27 paying customers; the export has not been reconciled `[fact:customers_memo]`" |
| `assumption` | Use "we estimate", "we assume", "we believe", and give the method in the same sentence | "We estimate 12,000 EU mid-size operators, from Eurostat counts filtered by fleet size `[assumption:tam_bottom_up]`" |
| `projection` | Use "the model shows", "if ... then", and name the two or three drivers | "If churn holds at 2 percent a month and we add one sales rep a quarter, the model reaches EUR 9.6M ARR by end 2028 `[projection:arr_2028]`" |

Rules:

- Never promote a kind. An assumption with a confident verb is a false fact; the checker cannot catch it, so the writer must.
- Numbers over adjectives. Let the reader form the opinion from the number (NFX). "Churn fell from 4.2 to 1.9 percent a month over six months" needs no "dramatically".
- One acknowledged weakness belongs in every long variant, with its mitigation. Concealment turns "is this risk acceptable?" into "is this founder candid?" (Andrew Lee, Initialized, 2020, via the pedronauck playbook). The teardown corpus's best-regarded deck, Front's 2016 Series A, named its own cohort failures.
- Cut the weakest claim instead of defending it. One weak argument spoils the set.

**Presenting an unresolved contradiction.** When two sources disagree (`status: conflicting`), the skill never picks the flattering number. Use the conservative value in all variants, mark it, and state the discrepancy where a reader would otherwise find it:

```
ARR run-rate is EUR 492k (metrics export, October 2026) [fact:arr_current].
The November founder memo states EUR 520k [fact:arr_memo]; the difference is being reconciled
and the lower figure is used throughout.
```

In spoken variants, say the lower number and be ready with the reason for the gap. The question that resolves it lives in `START-HERE.md` section 1 (and `gaps.md`), not in the narrative.

**Presenting small-n evidence.** Early evidence is legitimate if its size is visible. Always give n, the time window, and what the evidence does and does not show:

```
Three of the four pilot terminals renewed at full price after 90 days (n=4, pilots started
March to May 2026) [fact:pilot_renewals]. This shows willingness to pay in one segment; it does
not yet show repeatable sales.
```

Never convert a small n into a percentage without the n beside it ("75 percent renewal" from four pilots misleads). Never project a small-n result forward without the `projection` label. Interview counts follow the same rule: "22 of 30 dispatchers interviewed named gate queues as their top cost" is evidence; "dispatchers agree" is not.

**Pre-revenue honesty.** "Pre-revenue" is acceptable at pre-seed; "pre-revenue and pre-evidence" is not investable (romankurnovskii AP-18). If the ledger has no demand evidence, the narrative says what has been built and what will be tested with the round, and `gaps.md` asks for pilots, LOIs or waitlist conversion.

## 9. Output template for `pitch/narrative.md`

Write exactly these sections in this order. Keep the stated lengths; a founder reads this file in one sitting and edits it, so brevity is a feature. Spoken variants (two-sentence, 60-second, 3-minute) carry no id tags; in the written sections cite ledger ids inline as `[fact:id]` (`[assumption:id]` and `[projection:id]` for the other kinds); do not restate the ledger in a table. Open questions live in `pitch/START-HERE.md` and `pitch/gaps.md`: the file opens with a one-line pointer to them and never lists or resolves them itself.

```markdown
# <Company>: pitch narrative

Open questions that affect this narrative: pitch/START-HERE.md section 1 (and pitch/gaps.md when it exists).

as_of: <date the numbers describe>   stage: <pre-seed | seed | series-a | later>
round: <amount and instrument, if in the ledger>   generated: <today>, run <n>

## 1. Company purpose
<One declarative sentence, section 1 template. No numbers.>

## 2. Narrative choices
- Archetype: <one of five> because <the ledger ids that support it>.
- Sequence: <Sequoia | YC seed | YC Series A vertebrae | NFX 15 | demo day> because <reason>.
- Point of view: <industry | customer | founder | journey to insight>.
- Opening fact (zoom-out): <the external change, with id>.
- Acknowledged weakness: <one sentence> with mitigation <one sentence>.
(5 to 8 lines.)

## 3. Vertebrae
<10 to 15 bullets, each a headline under 12 words, each followed by its data points with ids.
One bullet becomes one slide. Read the bullets alone: they must tell the whole story.>

## 4. Long-form narrative
<600 to 900 words, prose, in sequence order, one short heading per section (the headline from
section 3). Every number carries [kind:id]. Assumptions and projections use the verbs from
section 8. The contradiction and small-n passages, if any, appear here.>

## 5. Variants
### Two-sentence pitch
<2 sentences, under 45 words. Email Test status: passed on <date> | not yet sent.>
### 60-second verbal
<130 to 160 words.>
### 3-minute demo day
<380 to 450 words, with slide breaks marked as "--- slide: <headline> ---".>
<On request only, each under its own ### heading: 15-minute partner meeting outline, read-ahead deck
headlines, one-page memo. Budgets and output form in section 6.>

## 6. Founder voice notes
- Kept verbatim: <quoted founder phrases used, with corpus file>.
- Rewritten: <original> → <rewrite> (why).
(3 to 10 lines.)
```

Before saving, run the narrative stress test: purpose sentence passes three nouns and reproducibility; one archetype, sayable aloud; why-now passes the eight-point test or is absent; headlines read alone; every claim carries its single strongest evidence and an id; the weakest claim has been deleted; one weakness is acknowledged; the story matches the stage's evidence class; and a stranger could retell it in 30 seconds. If any item fails, fix the narrative before `deck.json` is touched.
