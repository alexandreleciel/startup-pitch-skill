# Red flags: what makes investors pass, how to detect it, how to fix or disclose it

What this file is for: the audit layer of the skill. The taxonomy of things that make an investor close the deck, how to detect each one in the founder's files (`pitch/intake/corpus/`), the ledger (`facts.yaml`) and the skill's own drafts, and what to do about it (fix it, or disclose it honestly in the open questions and `investor-qa.md`).
Read it for a deck review, when writing the full investor Q&A, before building `deck/deck.json`, and as the pre-send gate. A quick run needs only `core.md`, which carries the record format, the ten most common flags and the confidentiality rules.
It also holds the full confidentiality rule set (what never leaves the data room) and the honesty protocol every draft follows. For what good looks like, see `narrative.md`, `metrics.md` and `deck-structure.md`; for the answers to give when a flag cannot be fixed, see `investor-questions.md`.

## Contents

1. How to use this file (severity, flag record format)
2. Red-flag taxonomy by dimension (numbers, market, product, team, business model, competition, go-to-market, the raise, process, legal and confidential leaks, AI tells), with a note on real failures
3. Confidentiality rule set and how exclusions are reported
4. Honesty protocol (labels, refuse to invent, stale data, small n)
5. Pre-send checklist
6. AI-slop list for pitch copy, with rewrites

## 1. How to use this file

**Severity.** Three levels, used everywhere in this skill. Do not add weights or scores; a single critical flag blocks sending regardless of how good the rest is.

| Level | Meaning | Consequence for the skill |
|---|---|---|
| **Critical** | Kills the meeting. The investor closes the deck or stops trusting every other number. | Block `deck.html`/`deck.pdf` export until fixed or explicitly disclosed by the founder. List first in `gaps.md`. |
| **Major** | Needs an answer. The investor will ask, and a weak answer ends the process. | Fix in the deck where possible; otherwise write the honest answer into `investor-qa.md` and add an appendix slide. |
| **Minor** | Polish. Costs credibility by accumulation, not on its own. | Fix silently in drafts; mention in `run-log.md`, not in `gaps.md`. |

Why hard stops rather than a score: a founder who sends a deck with one invented number has lost the room even if 27 other things are right. Investors read inconsistency as a character signal, not a craft issue (idea taken from romankurnovskii's hard-stop rule and amaklakov's stop-list).

**Flag record format.** Every flag the model raises, in `gaps.md` or in the red-flags section of `investor-qa.md`, uses this exact shape (statement / trigger / severity / verbal response / deck fix, after OneWave's objection format):

```markdown
### RF-<dimension>-<n>: <flag in one line, as the investor would say it>
- Severity: critical | major | minor
- Trigger: <the exact text, figure or absence that caused it; file#locator or ledger id>
- Investor reads it as: <one sentence>
- Deck fix: <what changes in deck.json / narrative.md, or "none possible">
- Verbal answer: <the honest two-sentence answer the founder gives if asked>
- Status: open | fixed | disclosed (founder decision, date)
```

Rules: quote the trigger (no anonymous findings). Never mark a flag fixed because the founder explained it verbally; the deck is scored as sent. `N/A` is allowed only with a one-clause reason and never on a critical flag.

## 2. Red-flag taxonomy by dimension

One table for dimensions 2.1 to 2.9, a bold row opening each dimension. Each row: how to detect (what to grep in the corpus or compute in the ledger), the investor's reading, the fix, and the honest disclosure if it cannot be fixed. Grep patterns are case-insensitive and advisory; the model judges meaning.

| Flag (severity) | Detect | Investor reads it as | Fix | If unfixable, disclose |
|---|---|---|---|---|
| **2.1 Numbers** | | | | |
| Unsourced figure (critical) | Any ledger entry with no `source` and no `derived_from`; any number in `deck.json` or `narrative.md` with no `fact:<id>`. Run `scripts/ledger_check.py`. | "They made this up, so what else is made up?" | Trace it to a file or a calculation, or demote it to `kind: assumption` with a `method`, or cut it. | Never. An unsourced number does not ship. Use the refuse-to-invent phrasing in section 4. |
| Inconsistent figures across files (critical) | Ledger entries with `status: conflicting`; same label, different values (memo says ARR 520k, export implies 492k). Also grep the corpus for the same metric word (`ARR`, `MRR`, `customers`, `users`) and compare the numbers that follow. | "Which one is true, and do they know their own business?" | Founder resolves which is current; the other becomes a dated historical fact or is deleted. Until then use the conservative value everywhere. | `gaps.md` section 1 names both values and both sources; narrative uses the lower one and says "as of <date>". |
| Vanity metric as the headline (major) | Headline `stats` in `deck.json` or the first traction sentence whose label matches `signups|registered|downloads|impressions|followers|waitlist|views|LOIs worth|pipeline` and no revenue, active-usage or retention fact exists alongside. | "The real number is bad, so they are showing me this one." | Lead with the metric that would hurt if it stopped: revenue, weekly actives, retention, signed pilots. Move vanity counts to a supporting line with their conversion (10k signups, 200 weekly actives). | State the honest metric with its size and trend, even if small: "200 weekly actives, growing 15 percent week over week, from 10k signups". |
| Cumulative-only chart (major) | A `chart` series that is monotonic non-decreasing with a label containing `total|cumulative|all-time`, and no per-period series next to it. | Hiding flat or falling monthly numbers (YC Series A guide, historical). | Plot the per-period values (monthly or quarterly); show cumulative only beside them. Charts in this skill start the y-axis at zero and use one axis. | If per-period data is not in the files, ask for it in `gaps.md`; do not draw the cumulative chart alone. |
| Hockey stick without drivers (major) | A `kind: projection` series whose year-over-year ratio exceeds 3x at any step and whose entry has no `assumes:` list, or whose assumed ids are themselves unverified. | "They do not understand what produces their own revenue." | Put the three assumptions that produce the curve on the slide (price, customers added per month, retention) and label every value `projection`. | State the drivers as assumptions and give the base case; never show a projection chart without an `assumes` list. |
| Top-down TAM only (major) | A market `assumption` whose `method` contains `% of` or `share of` and no entry with `method` of the form `customers x price x attach rate`. Grep corpus for `1%|one percent|of the \$`. | "They have not found their first customer, only a Gartner number." | Build the bottom-up number from a countable population and the actual price; show the arithmetic on the slide; cite each input with a year. Top-down becomes the ceiling, labelled as such. | Write "bottom-up sizing not yet done" in `gaps.md` with the two inputs the founder must supply. |
| Invented or rounded-up traction (critical) | Deck says `30+` or `~50` where the corpus says 27 or 44; growth rate quoted without the absolute base; monthly revenue presented where the label says annual (or the reverse). Compute every percentage from ledger values and compare. | Dalton Caldwell (YC) treats mixing monthly and annual revenue, or claiming a marquee customer without backing, as disqualifying. | Use the exact ledger number. Every growth rate carries its base and window ("from 4k to 41k MRR, Jan 2025 to Oct 2026"). | Not applicable: exact numbers are always available once the ledger exists. |
| Impressive percentage on a tiny base (minor) | Growth percentage whose base value is below 10 units or below one month of data. | "300 percent of nothing." | Show absolute values; use the percentage only when the base is meaningful. | State n: "from 3 to 12 paying teams in 60 days". |
| Metrics from a period that ended months ago (major) | `as_of` in `facts.yaml` older than 90 days for traction facts. | "Something went wrong since." | Refresh from the latest export; if unavailable, ask in `gaps.md`. | Date the number on the slide and explain the gap in `investor-qa.md`. |
| Truncated y-axis or double axis (minor, becomes major if it flatters) | Chart `y_min` not zero; two `y_label`s on one chart. | Caught every time; reads as manipulation (YC Series A guide, historical). | Start at zero; split into two charts or index both series to 100. | None needed once fixed. |
| **2.2 Market** | | | | |
| Market defined so broadly it implies no focus (major) | Beachhead named as `SMBs|enterprise|everyone|global <industry>`; no segment with a countable population. | "No go-to-market follows from this." | Name the entry segment narrowly enough that a competitor could list the first 50 accounts. | Say "entry segment under test" and name the two candidates. |
| Why-now that is really a why (major) | The why-now sentence has no year, no event, no number; it would read the same in 2019. DocSend's 2020 index found a why-now slide in 54 percent of funded decks versus 38 percent of unfunded, a correlation, not a cause. | "Nothing changed; why did nobody do this before?" | Name a dated change: a regulation, a cost crossing, a model release, a platform policy. | Omit the slide honestly rather than manufacture urgency. |
| Market data older than two years, or one analyst report (major) | Market facts with `source` dated before 2024, or every market fact citing the same report. | Stale or lazy. | Replace with the bottom-up calculation; date the ceiling figure. | Label as historical with the year on the slide. |
| **2.3 Product** | | | | |
| No product evidence of any kind (critical) | No screenshot, demo link, prototype, pilot or external user in the corpus. | Not investable at any price. | Add one captioned, cropped product visual per idea; or the pre-revenue proof stack (paid pilots, LOIs with counts, design-partner usage). | `gaps.md`: "no product evidence found; the deck cannot go out until one exists". |
| Mockups presented as live (critical) | Image files named `mockup|figma|concept|v2` used on a product slide without a label; roadmap features described in present tense. | Fraud if found in diligence; the relationship ends. | Label every visual `Live`, `Private beta` or `Design concept`. | Not applicable: the label is always possible. |
| Roadmap presented as traction (major) | Future dates (`Q3`, `next year`, `will launch`) inside the traction slide. | A plan, not evidence. | Split the slide: Traction (happened, dated) and Plan (next 12 months). | None needed once split. |
| No proof it works (major) | No usage frequency, retention, repeat purchase or completed workflow anywhere. | The product may be a demo. | The smallest honest proof: "412 of 500 beta users ran a second report within 7 days". | State what has been measured and what has not. |
| **2.4 Team** | | | | |
| Solo founder with no plan (major) | One name in the team corpus; no co-founder search, hiring plan or named first hires. | Single point of failure; nobody to argue with. | Show the plan: named candidates in conversation, equity set aside, first two hires with dates. | State it plainly in the narrative: "solo today; CTO search started <month>, two candidates in final talks". |
| Missing technical co-founder in a software company (major) | Product is software (repo, app, API in the corpus) and no founder role matches `CTO|engineer|technical|built`. Grep `looking for a technical co-founder|outsourced development|agency built`. | "Who writes the code?" is the first question. | Name who built what is shipping; if an agency built it, say so and show the in-house plan. | Omit the phrase "looking for a technical co-founder" from the deck; answer it honestly in `investor-qa.md`. |
| Part-time founders (critical at seed, major at pre-seed) | Grep `part-time|nights and weekends|still at|currently employed|will go full-time`. | Not committed; the money funds a hobby. | Give the full-time date and condition ("full-time on close of this round"). | Disclose the date; do not hide it, it surfaces in diligence. |
| Nobody has done this job (major) | No founder line links to the problem (never worked in the industry, never sold to this buyer, never shipped this kind of system). | Founder-market fit missing. | For each founder: what they shipped, at what scale, and the one-line link to this problem. Cut titles, degrees and advisors. | Name the gap and the hire or advisor-with-equity who closes it. |
| Advisor wall, investor logos, photo gallery (minor) | Team slide has more advisors than founders, or logos of existing investors. | Filler; investor logos invite "are they leading?" | Founders only, one achievement each. | None needed. |
| Lopsided equity (major, data-room stage) | Cap table with any founder below 30 percent, or a departed founder holding a large unvested block. | Future conflict or a dead-weight block. | Fix before the raise if possible. | Answer in `investor-qa.md`; never on a slide. |
| **2.5 Business model** | | | | |
| No business model, or several "to choose from" (critical) | Grep `we will figure out|monetize later|potential revenue streams|could charge`; more than one pricing mechanism on one slide. | "They do not know how they make money." | One model now: price, unit sold, buyer, sales motion, gross margin, even if provisional and labelled `assumption`. Other models go to the appendix as future options. | State the current model and the date of the first paid contract. |
| Unit economics missing or implausible (major) | Subscription or marketplace model with no churn, CAC or margin facts; LTV:CAC above 10 with no explanation; gross margin above 90 percent unexplained. | Implausible, or not measured. | Each metric with its definition, window and whether observed or modelled. | "Not yet measured; first cohort reaches month 6 in <date>". |
| Blended CAC hiding a paid channel (major) | One CAC figure; corpus shows paid and organic channels. | A channel that never pays back is hidden. | CAC per channel; say whether it includes sales salaries. | State blended CAC and that per-channel split is in the data room. |
| **2.6 Competition** | | | | |
| "We have no competitors" (critical) | Grep `no competitors|no direct competition|first to do this|nobody else`. | Either no market, or no research, or contempt for the reader (OneWave and amaklakov both treat this as automatic). | Name direct competitors at your stage, the substitute (spreadsheet, intern, doing nothing) and where each beats you. | Not applicable: there is always a status quo to name. |
| Empty top-right 2x2, or a grid you win every row (major) | A competition chart whose axes place only the company in the top right, or a checkmark table with no competitor win. CRV's 2026 guide names the all-wins feature matrix as a mistake. | Marketing, not analysis; the investor looks for the hidden row. | Include at least one row where a competitor wins and say why it does not decide the market. Consider a table of true peers over a 2x2. | None needed once honest. |
| Comparing only against giants, or only against tiny startups (minor) | Competitor list is all `Google|Salesforce|Microsoft`, or all seed-stage names. | Did not look. | Mix: same-stage peers plus the incumbent whose budget you take. | None needed. |
| No defensibility (major) | No sentence answering "what stops a funded team copying this in six months"; moat described as `easy to use|great design|first mover`. | Copyable. | One named mechanism with evidence: data, switching cost, network density, regulatory position, distribution lock-up. | "Defensibility today is speed and the <n> integrations; the data moat starts at <milestone>". |
| **2.7 Go-to-market** | | | | |
| GTM as a channel list (major) | Slide lists `SEO, content, partnerships, paid, events` with no numbers. | Nothing has worked yet. | One channel that works, with its numbers (cost, conversion, cycle length), then the next one to test. | "Channel under test; <n> conversations, <m> closed, since <date>". |
| Sales cycle and buyer unnamed (major) | No `buyer|decision maker|sales cycle|days to close` in corpus. | Enterprise motion not understood. | Name the buyer title, the champion, median days to close from the ledger. | Ask in `gaps.md`. |
| Marketing before product evidence (minor) | Use of funds leads with marketing while no retention fact exists. | Paying for users who will leave. | Reorder: product and retention first. | None needed. |
| **2.8 The raise** | | | | |
| No ask, or ask as a range or "open to offers" (critical) | No `ask` slide; `raising $1-3M`; `flexible on size`. CRV (2026) lists skipping the ask among the common mistakes; Michael Seibel (YC) has long noted most pitches never ask. | Uncertainty; the climax is missing. | One number, one instrument, committed amount if any, close date. | Not applicable. |
| Ask without use of funds or milestones (major) | Ask present, no allocation; `18 months of runway` given as the rationale. | Time is not a fundable milestone. | Three or four buckets with percentages, each tied to the milestone that makes the next round possible, framed over 18 to 24 months (CRV, 2026). | State the milestones even if the split is provisional, labelled `assumption`. |
| Runway under 12 months post-raise (major) | Compute `ask / monthly_burn` from the ledger; flag below 12. CRV (2026) now recommends planning around a two-year horizon before the next priced round; Carta data show 39 percent of seed companies take three or more years to reach Series A (Carta, via Jason Lemkin, 2025). | Will be back raising before anything is proven. | Resize the round or cut burn; show the model. | State the runway and the bridge plan honestly. |
| Stacked SAFEs (major) | Three or more SAFE or note instruments at different caps in the corpus; no pro forma cap table. SAFEs were about 90 percent of pre-seed rounds in Q1 2026 (Carta, 2026), so this is common. | Hidden dilution; the Series A investor buys after 20 to 30 percent is already gone. | Model every instrument at its cap before the next one; show fully diluted ownership in the data room, never in the deck. CRV (2026) also advises modelling dilution before signing each SAFE. | Answer in `investor-qa.md` with the converted cap table summary. |
| Valuation in the deck, or disconnected from stage (major) | Grep `pre-money|post-money|valuation|at a \$.*M cap` in `deck.json`. Compare the implied valuation with the stage: for reference, median seed valuation was 12.8 million dollars and median Series A 41.5 million dollars (Carta, 2024). | Negotiation before the conversation; an inflated number ends it. | Remove it. Discuss price live; "the market will set a fair price". | If the founder insists, put the cap in the speaker notes only and flag it in `gaps.md`. |
| Naming the investors you are talking to (minor) | Grep `in talks with|also speaking to|<fund> is interested` in the deck. | Pressure tactic; and it leaks (CRV, 2026). | Cut. Say "conversations in progress" only when asked. | None needed. |
| Exit slide at seed (minor) | Slide titled `Exit|Acquirers`. | Building to sell; investors know exits better. | Delete; one strategic acquirer may appear on the competition slide at most. | None needed. |
| NDA before viewing (critical) | Corpus or cover email asks for an NDA. | Novice; no investor signs pitch-stage NDAs. | Confidential footer and staged disclosure instead (section 3). | Not applicable. |
| **2.9 Process** | | | | |
| Raise dragging past its own window (major) | Earliest investor outreach date in the corpus versus today; CRV (2026) plans a raise six months before the zero-cash date with at least three months of active process, and calls eight months of runway already late to start. A process still open months past its plan reads as a signal. | "Everyone else passed." | Close what is committed, pause, add evidence, relaunch with a new dated deck. | Reframe: "closed a first tranche of <x> in <month>; reopening for <y> on <milestone>". Never hide the timeline. |
| Editable file or access-gated link (minor) | Output sent as `.pptx` or a link with a request-access wall. | Junior; friction; speaker notes leak. | PDF export, under 10 MB, filename `<Company> - <Round> - <YYYY-MM>.pdf`. | None needed. |
| Deck date stale (minor) | `meta.footer` or cover date older than 60 days. | Reused deck. | Re-date on every send; refresh traction facts. | None needed. |
| Hardcoded financial model (major, data-room stage) | Spreadsheet in corpus with numbers typed where formulas belong. | Cannot test the assumptions. | Driver-based model with inputs on one sheet. | Note it in `gaps.md` as a data-room task. |

### 2.10 Legal and confidential leaks

All critical. Detection and the full rule set are in section 3. Short form: cap table with names, term sheets, salaries, customer contracts, unredacted customer names without permission, personal data, credentials, pending litigation or patent applications in full text. Any of these in `deck.json` blocks export.

### 2.11 AI-generated tells in copy and design

Over 40 percent of pitches now lead with AI (CB Insights, 2026), and a large share of decks are drafted with a model, so these tells are read as "unedited" and cost trust. All major unless noted.

| Tell | Detect | Fix |
|---|---|---|
| Symmetric bullet triads, identical length | Count bullets per slide; three everywhere, lengths within 10 percent | Lumpy is human: two bullets here, one chart there. |
| "Not just X, but Y" and em-dash cadence | Grep `not just|not only` and the em-dash character (U+2014) | Plain sentences, one clause each. This skill never emits em dashes. |
| Adjective without a unit | Grep `significant|robust|seamless|cutting-edge|massive|huge` | Replace each with a number and a unit, or delete. |
| Invented specificity (critical) | A precise-looking figure (`$47.3B`) with no ledger id | Hard stop; see 2.1. |
| Uniform register across slides | Problem, market and team written in the same voice | Keep the founder's own phrasing from the corpus; rewrite only for length. |
| Generic closing vision | Grep `we envision a world|our mission is to transform` | Tie the vision to the wedge: what the first 100 customers buy, then what that becomes. |
| Placeholder residue (critical when sent) | Grep `\[Company|\[X\]|TBD|lorem|insert .* here|XX%` | Fill or cut before export; `scripts/ledger_check.py` fails on these. |
| Stock hero images, 80-word slides, "AI-powered" as the differentiator | Image filenames `stock|unsplash|shutterstock`; word count per slide over 30 (presented deck) | Real product visuals; one idea per slide; say what the AI does: automated, augmented or human. |

**Real failures, read as flags.** Use them as argument ammunition with founders, not as proof that a deck causes an outcome (the survivorship trap: celebrated decks worked because the companies worked).
- Theranos (shut down 2018): unverified technical claims presented as certainties, secrecy in place of evidence (2.3, 2.10). Quibi (shut down 2020): no product evidence before raising, top-down market assumption, competitors dismissed (2.2, 2.3, 2.6). Juicero (bankrupt 2017): a business model resting on lock-in with no demand evidence (2.5).
- Across Failory's startup cemetery (Failory, retrieved 2026) the recurring causes (weak product, business model that did not work, outcompeted, mismanaged funds, legal) map one-to-one onto dimensions 2.3, 2.5, 2.6, 2.8 and 2.10.
- Lesson for the model: a regulatory or scientific claim without a cited basis is a hard stop, and a pitch audit is partly a pre-mortem.

## 3. Confidentiality rule set

**What never goes in an investor deck.** Two inventory classes, handled differently. A `confidential` file is not read at all; it is listed as excluded. A `sensitive` file (or a normal file the inventory tags with `sensitive_terms`: deal or pay terms mentioned in its text) may inform the ledger and founder-facing Q&A, but never investor-facing text without the founder's approval. The items below stay out of investor-facing outputs wherever they appear.

The deck circulates without the founder: forwarded, screenshotted, read by associates at competing funds. Assume everything in it will be seen by a competitor. These items block export when found in `deck.json`:

| Item | Detect in corpus and drafts | Where it belongs instead |
|---|---|---|
| Cap table with names, percentages or share counts | Grep `cap table|shareholder|% owned|fully diluted|shares outstanding`; spreadsheet tabs named `Cap Table` | Data room, entry level: fully diluted summary with prior instruments |
| Term sheets, SAFE or note documents, investor names and amounts | Grep `term sheet|post-money SAFE|convertible note|lead investor`; PDF filenames `SAFE|TS|termsheet` | Data room, entry level: instrument summary; full documents post term sheet |
| Salaries, compensation, option grants by person | Grep `salary|compensation|\$.*k per year|option grant|vesting` next to a person's name | Data room, enhanced level (post term sheet), as an employment list |
| Customer contracts, pricing by named customer, MSAs | Grep `MSA|master services|contract value|signed with <customer>`; files in `contracts/` | Data room, enhanced level: top contracts redacted plus a commercial-terms summary |
| Customer names without written permission | Logos or names on the traction slide; no `permission|logo rights|approved` note in corpus | Describe the customer by category and size ("a top-5 German 3PL"); add logos only with permission on file |
| Personal data: emails, phone numbers, addresses, health or financial data of users or staff | Regex for email and phone patterns; files named `users.csv|customers.csv|payroll` | Never in any pitch artefact; data room only in aggregate |
| Credentials, API keys, tokens found in a repo | Grep `api_key|secret|token|password|BEGIN PRIVATE KEY` | Nowhere; tell the founder to rotate them |
| Pending litigation, disputes, regulatory correspondence | Grep `lawsuit|cease and desist|dispute|regulator|investigation` | Data room, enhanced level; answered honestly in `investor-qa.md` |
| Pending patent applications in full | Files `patent|provisional|claims` | Filing receipts only; the claim text stays private |
| Unreleased product details that give away the roadmap | Internal roadmap docs | Speaker notes or live demo only |
| Board minutes, internal strategy memos, fundraising target lists | Grep `board minutes|investor list|target funds` | Not shared; the target list is never shown to an investor on it |

**Staged disclosure in one line each.**
- **Deck** (anyone): story, sourced numbers, product visuals, team, ask. A "Confidential" footer, no NDA.
- **Entry data room** (interested investors after a partner meeting): expanded deck, financial summary with historical actuals and a two-year projection, KPI sheet, fully diluted cap table summary, org chart and hiring plan, demo videos, index of files. Not a live model.
- **Enhanced data room** (after a signed term sheet only): incorporation documents, stockholder and option records, IP assignments, material contracts redacted, employment list with compensation, litigation and compliance. A non-lead demanding this before a term sheet is out of protocol.
- Hygiene: per-investor folders with revocable access, watermark and view logs, redact names and personal data, refresh monthly.

**How the model reports exclusions in gaps.md.** Section 3 of `gaps.md` ("Confidential material found") uses this template, one entry per item, no values repeated:

```markdown
## 3. Confidential material found and excluded

| Item | Where found | What was done | Where it belongs |
|---|---|---|---|
| Cap table with founder and angel names and percentages | legal/cap-table-2026-09.xlsx (tab "Cap Table") | Not read into facts.yaml beyond the fully diluted total; excluded from deck and narrative | Entry data room, summary form |
| Salary list, 7 employees | finance/payroll-oct.csv | Excluded entirely; aggregate monthly burn used (fact:burn_monthly) | Enhanced data room, post term sheet |
| Customer contract, <customer category>, 2026-04 | contracts/*.pdf | Contract value used only as part of fact:arr_current; customer named as "a mid-size EU logistics operator" | Enhanced data room, redacted |

Nothing from these files appears in deck/, narrative.md or investor-qa.md. Logos appear only
for customers with written permission on file (none found; ask: do you have logo permission?).
```

The same list, shortened, goes into `START-HERE.md` section 6. Also set `confidential: true` for these files in `pitch/intake/inventory.json` so later runs skip them without re-reading.

## 4. Honesty protocol

**Labels in drafts.** Every number in `narrative.md`, `investor-qa.md` and the speaker notes of `deck.json` carries a label in square brackets until the final pass, matching `kind` in `facts.yaml`:

- `[fact]` in a file or verifiable record, with `fact:<id>`. Can be stated flat.
- `[assumption]` a belief or estimate the founder holds today. Must be stated with its method ("12,000 operators x 150k EUR average contract").
- `[projection]` a forward-looking number from a model. Must be stated with its drivers (`assumes:` ids) and the word "projected" or "target" on the slide.

The final pass removes the brackets from `narrative.md` but keeps the sources appendix in the deck and the labels in speaker notes. An assumption or projection never appears on a slide in the typography of a fact: use "estimated", "projected", "target", or show the arithmetic.

**Refuse to invent.** When a number the narrative needs is missing, the model does not estimate it, round it, or borrow an industry average without saying so. It writes the `[needs number]` placeholder, which cannot ship unnoticed (the deck builder renders it as a marked slot), and asks. Exact phrasing to use in drafts:

```
[needs number] monthly churn, last 6 months. No churn figure in the files. Investors ask for it
in a subscription model at seed. Please provide: logo churn and revenue churn per month,
source file. Until then the narrative says "retention data in preparation" and the
traction slide shows MRR only.
```

And the sentence the founder can use live if the number still does not exist: "We have not measured that yet; here is what we have measured instead, and here is when the first reading lands." Saying "I don't know" with a date beats a guess that collapses in diligence.

If the founder supplies a number verbally with no file, record it as `kind: assumption`, `status: unverified`, `source: founder statement, <date>`, and say so wherever it is used.

**Stale data.** Anything whose `as_of` or source date is older than 18 months is labelled with its date wherever it appears ("38,000 labs (2024 survey)") and listed in `gaps.md` section 2 with the request to refresh. Market figures older than two years are additionally flagged as major (section 2.2). Traction numbers older than 90 days are flagged (section 2.1).

**Small n.** Any survey, interview set, pilot or cohort with fewer than 30 observations states n and the setting on the slide and in the narrative: "9 of 11 interviewed dispatchers (EU mid-size 3PLs, Sept 2026) said they re-key dock bookings by hand." Percentages from n under 30 are avoided; use counts. Testimonials carry a name or a role and company category, never anonymous praise.

**Cross-file consistency.** Before export, confirm the one-liner, the headline traction number, the market number and the ask are identical across `narrative.md`, `investor-qa.md` and `deck.json`; the team credentials do not vary between files; every objection in `investor-qa.md` has an answer that does not contradict a slide. `scripts/ledger_check.py` covers the numbers; the model checks the words.

## 5. Pre-send checklist

Run on the final `deck.pdf` and `narrative.md`. Every line is a tick; any unticked critical line blocks the send. Write the completed list into `run-log.md`.

```markdown
## Pre-send check, <Company>, <YYYY-MM-DD>
Critical (any miss blocks)
- [ ] Every number on every slide resolves to a fact:<id>; ledger_check.py passes
- [ ] No status: conflicting facts remain unresolved in the deck
- [ ] No placeholder residue ([X], TBD, lorem, Insert); no [needs number] left unless the founder chose to send with gaps
- [ ] No confidential item from section 3 anywhere in deck/, narrative.md or investor-qa.md
- [ ] The ask is one number, one instrument, with use of funds and 18 to 24 month milestones
- [ ] Product evidence exists and every visual is labelled Live / Private beta / Design concept
- [ ] Competitors named, including the status quo; no "no competitors" phrasing
- [ ] No valuation, no NDA request, no exit slide
Read tests
- [ ] 15-second skim (2 seconds per slide): a stranger can say what the company does, for whom, why now, what is impressive
- [ ] Headline read-alone test: the slide titles in sequence tell the whole story without the bodies
- [ ] Slide 1 names the company and what it does in one concrete sentence
- [ ] Strongest asset appears within the first three slides
Numbers and charts
- [ ] Every chart has a date range, a unit, a single axis, y starting at zero
- [ ] No cumulative-only chart; per-period values shown
- [ ] Every projection slide lists its three drivers and says "projected"
- [ ] Every growth rate carries its base and window
- [ ] Market sizing is bottom-up with each input sourced and dated; top-down shown only as ceiling
- [ ] Anything older than 18 months carries its date; nothing older than 90 days in traction
- [ ] Small-n claims state n and setting
Copy and form
- [ ] Buzzword scan (section 6) returns no unjustified hits
- [ ] No em dashes; no "not just X, but Y"; no adjective without a unit
- [ ] Presented deck: one idea per slide, under 30 words of body; detail in notes or appendix
- [ ] PDF exported from the source, under 10 MB, named <Company> - <Round> - <YYYY-MM>.pdf, dated this month
- [ ] Nothing in the file the founder would be unwilling to have forwarded to a competitor
```

## 6. AI-slop list for pitch copy, with rewrites

Scan `narrative.md`, `deck.json` text fields and `investor-qa.md` for these stems (case-insensitive). Each hit is reviewed in context; keep a term only when it is concrete and accurate (a "platform" with named components is fine, "platform" as a noun of avoidance is not). Seed pattern, adapted from pedronauck's `buzzword-scan.sh`:

```
revolutioniz|disrupt|leverag|synerg|ecosystem|next-generation|cutting-edge|seamless|
empower|unlock|end-to-end|democratiz|world-class|game-chang|paradigm|stakeholder|
holistic|frictionless|best-in-class|ai-powered|ai-native|transform|unprecedented|
robust|scalable solution|no competitors|no direct competition|in stealth|
funding to start|some users|a few customers|several customers|passionate|dedicated|
driven|visionary|we believe|poised to|positioned to|not just|not only|
we envision|our mission is to|huge market|massive opportunity|
```

| Slop | Why it fails | Rewrite pattern |
|---|---|---|
| "Seamless, frictionless user experience" | Unmeasured adjective pair | "Setup takes 11 minutes; 83 percent of trial accounts complete it (n = 120, Q3 2026)." |
| "Poised to transform the industry" | Future tense without a milestone | "Next 12 months: 100 docks live, 60k EUR MRR, NRR above 100 percent." |
| "Not just a tool, but a movement" | Scaffold sentence, no content | Delete the frame; keep the fact that follows it, if any. |
| "Our mission is to empower every business" | Everyone is no one | "First market: 3PLs with 5 to 30 docks in Germany and the Netherlands." |
| "Robust, scalable, enterprise-grade" | Three claims, zero evidence | "Handles 2,000 bookings a day today; largest customer runs 38 docks." |
| "Significant growth" / "growing fast" | No number | "From 4k to 41k EUR MRR, January 2025 to October 2026." |
| "Still looking for a technical co-founder" | Signals you cannot build | Omit from the deck; show the shipped product and name who built it. |
| Hedges: "we believe", "potentially", "could reach", "up to" | Dilutes facts and disguises projections | Facts stated flat with a source; projections labelled "projected" with drivers. Belief statements only in the insight slide, once. |

The scan flags; the model rewrites only where meaning or clarity improves, and preserves the founder's own words where they are concrete. Founder phrasing from the corpus beats a cleaner generic sentence. The eight most common phrases (AI-powered platform, leveraging synergies, a market with no math, no competitors, some users, passionate team, funding to start, in stealth) have their rewrites in the never-say table of `narrative.md` section 7 and are not repeated in the table above.
