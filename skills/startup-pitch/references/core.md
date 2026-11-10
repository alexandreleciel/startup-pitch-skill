# Core: everything a quick run needs

What this file is for: the rules a quick run applies between intake and `pitch/START-HERE.md`: ledger discipline, the arithmetic checks, picking and phrasing numbers, the pitch in two sentences and in 60 seconds, investor questions from the startup's own weak spots, red flags, confidentiality and the default investor.
Read it on every run, together with `file-formats.md` (ledger schema and the START-HERE template). A quick run opens no other reference.
Each section is the short form of a longer reference; the table in section 12 says which situations need the long one.

## Contents

1. Ledger discipline
2. Consistency identities
3. The 3 to 5 numbers that matter, and the maturity ladder
4. Phrasing by kind, and refusing to invent
5. Purpose sentence, two-sentence pitch, 60-second version
6. Headline craft
7. Investor questions from the startup's own weak spots, and the answer rubric
8. Red flags: record format and the ten most common
9. Confidentiality
10. The default investor, and the two questions to ask
11. Never-say list
12. When to open something else

## 1. Ledger discipline

Every number or claim an output states has exactly one entry in `pitch/facts.yaml` (schema and example in `file-formats.md`). The ledger comes first; the story is built from it.

- **Kinds** answer "how do we know this?": `fact` (in a file or verifiable record), `assumption` (a belief or estimate the founder holds today; needs a `method`), `projection` (a forward-looking number from a model; needs `assumes: [ids]` or its drivers named).
- **Statuses:** `confirmed`, `unverified`, `conflicting`. When two files disagree, record both values, both with `status: conflicting`, each pointing at the other with `conflicts_with`. The skill never resolves a conflict and never averages one: outputs use the conservative value and say so until the founder answers.
- **Size:** record only numbers an output will cite, plus both sides of every conflict. No intermediate entries, no history nobody cites. A quick run needs 15 to 30 entries. A figure worked out on the page from cited entries shows its arithmetic and needs no entry; items that live only in `gaps.md` may point at `file#locator` instead.
- **Awkward conflicts:** conflict pairs do not count towards the 30. With three values, pair the two like-for-like ones and keep the third as its own entry with a note. When sources disagree on scope rather than value ("118 percent, all employers" against "enterprise only"), keep one entry, say so in its `note`, and ask.
- **Confirmed or unverified:** `confirmed` is read from a primary record (export, model, statement) with nothing contradicting it; `unverified` is stated in prose or by the founder with no record behind it.
- **Where a value comes from:** `source: path#locator` when it is read from a file. `derived_from` when it is calculated: an expression over ids and literals with `+ - * / ^` and parentheses, which the checker recomputes to within 1 percent; inputs that only feed the calculation stay literals in the expression. `computed: true` plus `source` when you summed, counted or averaged the value from a file, with the how in `note`. A `fact` with neither `source` nor `derived_from` is a hard failure: make it an assumption or drop it.
- **Qualitative entries** (stage, investor profile, hiring status) use `unit: text` and a string `value`.
- **Something the founder says with no file behind it** (a count, their background): `source: founder statement, <date>`, `status: unverified`; an estimate is still `kind: assumption`. State it plainly in outputs, mark it once on the start page as their statement, and list the record that would back it. A founder's decision (the round size, the target investor, which figure is current) is `confirmed`.
- **An issue the founder leaves open:** add `open_question: <text>` to the entry it concerns; the check then reports a WARN. Never add entries to make an identity balance.
- **Metric entries** carry the period in `label`, a one-line `definition` (what is included and excluded), a `window` for growth and churn, and `n` for any rate from fewer than 100 observations.
- **Terms founders use loosely:** bookings, LOIs and verbal yeses are not revenue. ARR is recurring MRR x 12 and nothing else (total revenue x 12 is `revenue_run_rate`). GMV is not revenue. Gross and net churn are two numbers, shown together. Registered, active and paying users are three numbers, each with its definition. Blended CAC is not paid CAC. Runway uses net burn. Record each pair as separate ids, never one under the other's label.
- **Checking:** run `pitch.py check`. Fix every FAIL; a WARN is a question for the founder. A failed identity is never fixed by changing a number: it becomes a question, and outputs use the conservative value until it is answered.
- **Open questions** go to `START-HERE.md` section 1: five at most, contradictions first, each with the value used until answered. With more than five open items, write the rest to `gaps.md` and link it from section 1; where another reference says "list it in gaps.md", read it as this pair.
- **Missing things:** `[needs number]` for a missing figure, `[needs detail]` for missing non-numeric information (a founder's background, a competitor list). Spoken text (the two-sentence and 60-second pitch) carries no id tags.

## 2. Consistency identities

The checker runs these when the ids or roles exist; run the rest by hand on anything an output cites. Default tolerance is 1 percent relative.

| # | Identity | Tolerance | Question to ask when it fails |
|---|---|---|---|
| 1 | ARR = MRR x 12 | 1 percent | Which figure is current, and does the ARR include non-recurring lines? |
| 2 | Net revenue = GMV x take rate (marketplaces, payments) | 2 percent | Is the take rate blended across all revenue streams, and is GMV net of cancellations and refunds? |
| 3 | Runway = cash / net burn | 0.5 month | Is the burn figure gross or net, and is it the trailing 3-month average or a budgeted future number? |
| 4 | Growth multiple = latest / earliest for any "grew Nx" claim, both endpoints dated; CMGR = (latest / earliest)^(1/months) minus 1 | 1 percent on the multiple, 0.5 percentage point on CMGR | Which two months does the Nx compare, and are both from the same export? |
| 5 | CAC payback in months = CAC / (ACV x gross margin / 12) | 0.5 month | Is the CAC paid or blended, and is the margin gross margin or contribution margin? |
| 6 | LTV = ARPU x gross margin / monthly gross churn; LTV:CAC = LTV / CAC. Flag churn measured over fewer than 6 months or an implied lifetime above 5 years | 2 percent | Which churn and which margin went into the LTV, and over what window was churn measured? |
| 7 | Gross churn >= net churn; GRR <= 100 percent; GRR <= NRR | Hard check | Are gross and net defined the same way, and are both measured on the same cohort and period? |
| 8 | Headcount x average fully loaded cost + non-people costs ≈ gross burn | 15 percent | What does the headcount include (contractors, founders without salary), and what are the non-people lines? |
| 9 | Use of funds sums to the ask; percentages sum to 100 | 1 percent | Is the contingency inside the stated lines or on top of the ask? |
| 10 | Ask / net burn over the plan ≈ runway stated, and runway reaches the stated milestone date plus at least 6 months to raise | 1 month | Does the plan's burn step up with hires, and is that reflected in the runway claim? |
| 11 | TAM >= SAM >= SOM, and SOM <= revenue projection at the horizon; bottom-up SAM = customer count x price, both sourced | Hard check | Which customer count and which price produce the SAM, and is the price the company's own or a competitor's? |
| 12 | Implied monthly churn from a 12-month cohort matches the claimed monthly logo churn | 1 percentage point | Is the churn claim from the same cohort basis, or a single good month? |
| 13 | Customer count x ARPU (or ACV / 12) ≈ MRR | 5 percent | Does the customer count include free, trial or churned accounts? |
| 14 | Revenue in the narrative = revenue in the model = revenue in the data export for the same month; every mismatch becomes a `conflicting` pair | 1 percent | Which file is the system of record? |
| 15 | The first projected month equals the last actual month; growth in the first 6 projected months does not exceed the best trailing 6-month CMGR achieved unless an `assumes:` entry names the driver | 2 percent | What changes at the round close that makes growth jump? |
| 16 | Units and currency match across an identity (EUR vs USD, monthly vs annual, thousands vs units) | Hard check | Which currency does the deck use, and at what rate were the others converted? |
| 17 | Every metric's `as_of` is within 90 days of the ledger `as_of`, or the entry is stale and outputs say "as of <date>" | 90 days | Is a fresher export available? |

## 3. The 3 to 5 numbers that matter, and the maturity ladder

Pick in this order: (1) the north-star metric for the business model, (2) its trajectory over a dated window, (3) the quality metric that proves the trajectory is healthy, (4) the one number that is unusually strong against a sourced benchmark, (5) the acknowledged weakness with its fix, if the story needs it. One headline metric plus two or three quality metrics; ten numbers reads as hiding weakness in complexity. Prefer `kind: fact` with `status: confirmed`. The conservative side of an open conflict may be a headline when it comes from the system of record (the data export, not the memo): mark it "being reconciled". An `unverified` claim waits until the founder backs it. Before revenue, when fewer than three facts exist, labelled assumptions fill the remaining rows. Do not swap a solid 12-month figure for a longer window that flatters a slowing trend. "Do not use yet" in `START-HERE.md` lists the claims in the founder's files that no data backs, each with what would back it.

| Stage (ladder) | Headline (1) | Trajectory (2) | Quality (3) | Standout (4), only if sourced | Avoid |
|---|---|---|---|---|---|
| Team / pre-product | Strongest pre-revenue proof item with count and names (paid pilots, LOIs with value) | Discovery hit rate or waitlist growth per month | Depth of engagement (hours used, integrations built) | Founder's directly relevant prior result, as a fact | TAM as a headline; "users" of a landing page |
| Product (post-launch, pre-repeatable) | Paying customers or MRR, with the month | Net new per month over the full window | Cohort retention curve or usage retention | A benchmark the company beats, with population and year | Cumulative signups; blended CAC |
| Repeatable sale (seed to A) | ARR or GMV with net revenue | CMGR over 6 or more months and net new ARR per month | GRR and NRR as a pair, or repeat rate for marketplaces | CAC payback against the CRV 12 to 18 month range (2026) | Projections in the headline row |
| Unit economics (Series A and beyond) | ARR and growth multiple year over year | Net new ARR by quarter, new vs expansion vs churn | Gross margin, burn multiple, CAC payback | NRR or magic number with the comparison population named | Any metric whose definition changed during the window |

The maturity ladder (Casado, a16z, 2018, historical). Round names describe money, not maturity; present only the evidence class of the stage the company has actually reached:
1. **Team:** founder-market fit and a sharp view of the problem. Counts: founder background tied to the problem. Does not count: product claims, logos of "conversations".
2. **Product:** product-market fit shown by market behaviour. Counts: production deployments, engagements with real decision makers. Does not count: potential-customer quotes, exploratory PoCs, services work and one-offs dressed as PMF.
3. **Repeatable sale:** the sale repeats across similar buyers and use cases. Counts: a consistent buyer profile and use case, a growing pipeline, a sales cycle investors can confirm by calling customers. Does not count: an early burst from accounts worked since day one.
4. **Unit economics:** a path to attractive margins. Counts: ACV, CAC, net dollar retention. Does not count: a model that assumes margins the company has not shown.
5. The governing failure is signalling more maturity than the evidence supports. Pre-revenue proof, strongest to weakest: paid pilots; production deployments; named design partners with success criteria; LOIs with scope and price; confirmed willingness to pay at the stated price; a qualified waitlist; engagement depth on a free product; beta feedback tied to the pain; discovery-interview counts with hit rate; smoke-test conversion. A count without a list behind it is an assumption.

## 4. Phrasing by kind, and refusing to invent

The kind decides the verb. Never promote a kind: an assumption with a confident verb is a false fact, and no checker catches it.

| What you are stating | How to phrase it | Example |
|---|---|---|
| `fact`, `confirmed` | Flat, with unit and date, citing the id | "MRR was EUR 41k in October 2026 `[fact:mrr_current]`" |
| `fact`, `unverified` | State it, add the source type, list it as an open question | "The founder memo reports 27 paying customers; the export has not been reconciled `[fact:customers_memo]`" |
| `assumption` | "We estimate", "we assume", "we believe", with the method in the same sentence | "We estimate 12,000 EU mid-size operators, from Eurostat counts filtered by fleet size `[assumption:tam_bottom_up]`" |
| `projection` | "The model shows", "if ... then", naming the two or three drivers; "projected" or "target" on a slide | "If churn holds at 2 percent a month and we add one sales rep a quarter, the model reaches EUR 9.6M ARR by end 2028 `[projection:arr_2028]`" |
| Small n (fewer than 30 observations) | Counts, not percentages, with n, the setting and the window, and what the evidence does and does not show. Any rate from fewer than 100 observations prints its n | "Three of the four pilot terminals renewed at full price after 90 days (n=4, pilots started March to May 2026). This shows willingness to pay in one segment; it does not yet show repeatable sales." |
| Stale data | Anything older than 18 months carries its date wherever it appears, with a request to refresh; traction older than 90 days and market figures older than two years are flagged | "38,000 labs (2024 survey)" |
| Unresolved conflict | The conservative value everywhere, with the discrepancy stated where a reader would otherwise find it. Spoken: say the lower number and have the reason for the gap ready | "ARR run-rate is EUR 492k (metrics export, October 2026) `[fact:arr_current]`. The November founder memo states EUR 520k `[fact:arr_memo]`; the difference is being reconciled and the lower figure is used throughout." |
| Missing number | Do not estimate it, round it or borrow an industry average. Write `[needs number]` with what is missing, why an investor asks and what to provide, and ask in `START-HERE.md` section 1 | "`[needs number]` monthly churn, last 6 months. No churn figure in the files; investors ask for it in a subscription model at seed. Please provide logo churn and revenue churn per month, with the source file." |

Numbers over adjectives. Every number carries its unit and date, every growth rate its base and window ("from 4k to 41k EUR MRR, January 2025 to October 2026"). Use the exact ledger number, never "30+" for 27. The sentence a founder can use live when a number does not exist yet: "We have not measured that yet; here is what we have measured instead, and here is when the first reading lands."

## 5. Purpose sentence, two-sentence pitch, 60-second version

**Purpose sentence:** one declarative sentence (Sequoia's business-plan outline) that passes the three-nouns test (Kevin Hale, YC, 2019): after it the listener holds what you make, who it is for and what problem it removes. Template: `<Company> <builds | sells | runs> <concrete thing> for <named customer> so they can <outcome>.`
- Concrete nouns only: "software" and "platform" fail unless followed by what the software does. Lead with what, not why or how. Reproducibility test: ten engineers reading the sentence should sketch roughly the same product.
- No adjectives that carry no information ("innovative", "seamless", "next-generation"). Zero numbers; numbers go in the sentence that follows.
- Good: "Meridian sells dock-scheduling software to mid-size freight terminals so trucks stop queueing." Bad: "Meridian is an AI-powered logistics platform transforming the supply chain."

**Two-sentence pitch:** 2 sentences, under 45 words. Sentence 1: company name plus what it does for whom. Sentence 2: how it makes money or the single strongest fact; if that fact is a number, give its time window. Email Test (Seibel, YC): email it to a smart friend and ask them to explain it back. Any clarifying question means revise. Email, not conversation, because the reader cannot interrupt. This pitch is the root: if it fails the Email Test, do not write longer versions yet.

**60-second version:** 120 to 150 words in `START-HERE.md` (the spoken variant in a full narrative runs 130 to 160). It contains the purpose sentence, the problem and the change in the world, what was built, the one strongest number with its date, and the ask. Test: a listener repeats what you do and the number without notes. Write it on its own; do not cut it down from something longer. A why-now needs a dated external change (a regulation, a cost crossing, a platform release), not a company milestone; if none exists, leave it out.

## 6. Headline craft

- The headline states the conclusion: "Trucks wait 94 minutes at the average mid-size dock", not "The problem". "Market" and "Traction" are labels, not headlines.
- It reads alone: strip the bodies and the headlines, read in order, still tell the whole story.
- Under about 12 words, one idea, one number where possible; the other numbers go in the body.
- Numbers carry units and dates, with the unit named exactly: "EUR 41k MRR, October 2026", never "41k" or "strong MRR"; MRR or ARR, gross or net.
- Every number maps to a ledger id, written inline as `[fact:mrr_current]`.
- No question headlines and no rhetorical setups. A headline built on an assumption or a projection says so: "We estimate 12,000 operators in the EU segment".

## 7. Investor questions from the startup's own weak spots, and the answer rubric

Investors ask about the thing that did not add up, so derive the questions from the ledger and the open questions, not from a generic FAQ. Each state below fires a question.

| Ledger or gap state | The investor asks | What is being tested |
|---|---|---|
| `status: conflicting` | "Your deck says X and your model says Y. Which is it, and why do they differ?" | Can I trust any number from this team? |
| An `assumption` with no method, or any market-size assumption | "How did you get to that number?" "Walk me through the bottom-up: how many buyers, paying what, how many you can reach." | A belief dressed as a fact; a slice of a report |
| `projection` | "What has to be true for this curve? Which driver are you least sure of?" | Does the founder know the model's levers? |
| `derived_from` mismatch above 1 percent | "Your ARR is not 12 times your MRR. What is in the gap?" | Bookings counted as revenue, one-offs, sloppiness |
| Small n, or one customer above about a third of revenue | "Is this repeatable outside the founder's hands? What happens if the top customer leaves?" | Traction or three friendly logos; revenue quality |
| A metric expected at this stage is absent | "What is your retention / CAC / gross margin?" | Either not measured or bad; both are information |
| `as_of` older than about 90 days, or a cumulative-only chart | "What do the numbers look like today?" "Show me the monthly numbers, not the cumulative." | Did growth stall during the raise? |
| No named competitor | "Who else is solving this? What does the customer use today?" | No market, or no homework |
| The word "platform", or more than one business model | "Which one are you?" | Focus; a this-or-that question never gets "both" |
| Insight stated as passion, with no customer evidence | "What do you know that the incumbents do not? How did you learn it?" | Earned insight or enthusiasm |
| Team gap (no technical founder, part-time founder, missing seller) | "Who builds the product? Who sells it? When is everyone full-time?" | Execution risk; whether the founders see the hole |
| Round terms in the folder, or confidential material excluded | "How did you arrive at that valuation? Who has committed?" | Price discipline and momentum; answer with structure, not the file |
| Regulatory, custody, safety or data-privacy exposure | "What is the most likely regulatory threat and where are you on it?" | Could this be shut down or blocked at exit? |

Merge the rules that fire on the same weakness, score each question likelihood (1 to 3) times severity (1 to 3), and take the five with the weakest honest answers: those are "the five questions you are least ready for". By stage: pre-seed gets team, insight and demand-evidence questions, not a five-year P&L; at seed a missing retention or churn figure is itself a top-five question; at Series A a conflicting revenue entry is question one. The answer rubric:

1. Direct first sentence: yes, no, or the number. It answers the question that was asked.
2. Number with unit and date, citing the ledger id: "41,000 EUR MRR in October 2026", not "about 40k". Say the kind when it is not a fact: "we assume", "the model projects X assuming Y".
3. One supporting fact that makes the number credible: the cohort, the customer, the method.
4. Stop. Two to four sentences is the ceiling (under 70 words); let them ask the follow-up.
5. Use only ledger entries. On a conflict, give the conservative value and say the reconciliation is in progress.
6. "We do not know yet" is the right answer when the ledger has no fact and no assumption with a method. Say so, then the plan and its date: "We will have the month-six curve in February; here is the month-three number today."
7. Never invent a figure to strengthen an answer. A weak honest answer is marked as weak and becomes a fix, an appendix slide or a data-room item, not spin.
8. Strip the defensive tells: "well, actually", caveats before the number, adjectives in place of evidence, "we have no competitors", "we only need one percent of the market", certainty about a projection.
9. With each question, write why they ask it (one line) and what to have ready (a file or a slide).
10. Under pressure: no valuation without a basis ("the market will set it"), no names of other firms in the process, and concede that the incumbent could build it before saying why it is cheaper to buy or ignore you.

## 8. Red flags: record format and the ten most common

Severity: **critical** kills the meeting and blocks sending until fixed or explicitly disclosed by the founder; **major** needs an answer, fixed in the output or answered honestly; **minor** is polish, fixed silently. No scores: one critical flag blocks regardless of the rest. Quote the trigger, and never mark a flag fixed because the founder explained it verbally. The full record (the START-HERE template uses a shorter form of the same fields):

```markdown
### RF-<dimension>-<n>: <flag in one line, as the investor would say it>
- Severity: critical | major | minor
- Trigger: <the exact text, figure or absence that caused it; file#locator or ledger id>
- Investor reads it as: <one sentence>
- Deck fix: <what changes in the outputs, or "none possible">
- Verbal answer: <the honest two-sentence answer the founder gives if asked>
- Status: open | fixed | disclosed (founder decision, date)
```

| Flag (severity) | Trigger to look for | Investor reads it as | Fix |
|---|---|---|---|
| Unsourced, invented or rounded-up figure (critical) | A number with no ledger id; "30+" where the files say 27; a growth rate with no base | "They made this up, so what else is made up?" | Trace it to a file or a calculation, demote it to an assumption with its method, or cut it |
| Inconsistent figures across files (critical) | `status: conflicting`; the same metric with two values | "Which one is true, and do they know their own business?" | The founder resolves it; until then the conservative value everywhere, dated |
| "We have no competitors" (critical) | `no competitors`, `first to do this`, `nobody else` | No market, or no research | Name direct competitors, the substitute (spreadsheet, intern, doing nothing) and where each beats you |
| No business model, or several "to choose from" (critical) | `monetize later`, `potential revenue streams`, more than one pricing mechanism | "They do not know how they make money." | One model now: price, unit sold, buyer, gross margin, even if provisional and labelled an assumption |
| No ask, or an ask as a range (critical) | No ask; "raising 1 to 3M"; "flexible on size" | Uncertainty; the climax is missing | One number, one instrument, committed amount if any, close date |
| No product evidence, or mockups presented as live (critical) | No screenshot, demo, pilot or external user; roadmap features in the present tense | Not investable; fraud if found in diligence | One real product visual or the pre-revenue proof stack; label every visual Live, Private beta or Design concept |
| Part-time founders (critical at seed, major at pre-seed); missing technical co-founder in a software company (major) | `part-time`, `still at`, `will go full-time`; `agency built`, `looking for a technical co-founder` | Not committed; "who writes the code?" | Give the full-time date and condition; name who built what is shipping |
| Vanity metric as the headline, or a cumulative-only chart (major) | Signups, downloads, waitlist or pipeline in the lead with no revenue, usage or retention beside it | "The real number is bad, so they are showing me this one." | Lead with the metric that would hurt if it stopped; show per-period values |
| Top-down TAM only, or a projection with no drivers (major) | "1 percent of a 50B market"; a hockey stick with no `assumes` list | "They have not found their first customer, only a report number." | Bottom-up: countable customers x actual price, each input sourced and dated; put the three drivers on the slide |
| Ask without use of funds or milestones; valuation in the deck (major) | "18 months of runway" as the rationale; `pre-money`, `post-money` or a cap in investor text | Time is not a fundable milestone; negotiation before the conversation | Three or four buckets, each tied to the milestone that makes the next round possible; remove the valuation and discuss price live |

## 9. Confidentiality

Investor-facing outputs (the narrative, the deck, anything a founder forwards) circulate without the founder: assume a competitor will see them. `START-HERE.md`, `investor-qa.md` and `facts.yaml` are founder-facing.

- **Never in investor-facing text, wherever it appears in the folder:** cap table names, percentages or share counts; valuations, caps and round terms (term sheets, SAFE or note documents); names of prospective investors and who is "in talks"; salaries and compensation by person; customer contracts and contract terms; customer names or logos without written permission; personal data; credentials (tell the founder to rotate any key found in the folder); pending litigation; board minutes.
- **`confidential` files** (flagged by the inventory) are not read. List each one as excluded, with its path and where it belongs (the data room), in `START-HERE.md` section 6. Repeat no values from them.
- **`sensitive` files, and normal files the inventory tags with `sensitive_terms`** (deal or pay terms mentioned in their text; the corpus index notes them), may be read. They may inform the ledger and the founder-facing Q&A, so the founder is ready for the cap-table or pricing question, but nothing from them enters investor-facing text without the founder's approval. Say in section 6 what was held back.
- In answers, describe structure, not contents: "a mid-size EU logistics operator" for an unnamed customer; the instrument and the fact that the cap table is clean, not the names or the cap.
- No NDA request and no valuation in any investor-facing output. A "Confidential" footer and staged disclosure instead: the deck first, a data room after a partner meeting, full documents after a signed term sheet.

## 10. The default investor, and the two questions to ask

Who is deciding changes the headline number, the questions and the tone more than the sector does. Look in the folder first: investor update emails, a CRM export or target list, an accelerator or grant application form, a SAFE or convertible draft, and the ask size itself usually settle it. When several types are named, write one narrative and one ledger, never five decks; do not invent a firm's thesis, fund size or check size (use only what its public pages say, cited and dated). If the folder is silent, ask (together these count as one of the five questions in `START-HERE.md` section 1):

1. **Who are you pitching this to first?** Angels or an angel syndicate, a pre-seed or seed fund, a multi-stage VC, a strategic or corporate VC, a family office, an accelerator (which one), a public grant or competition (which one), a crowdfunding platform, a lender (venture debt or revenue-based financing), a university or impact fund, or several at once. If several, which meeting is first?
2. **Where are they, and where is the company incorporated?** US, UK, Germany, France, elsewhere in the EU, other. This sets the instrument, the deck convention and the traction bar.

With no answer, apply the default and say so: **assume a financial investor (angels plus a seed fund as lead) at the stage implied by the ledger, in the company's home country, with a reading deck sent ahead and a presenting deck for the meeting.** In a quick run, record it as one ledger entry (`unit: text`, `kind: assumption`, `status: unverified`, a `method` naming this default) so the founder can correct it in one edit. The full profile block, written at the top of `investor-qa.md` and under the pointer line of `narrative.md` when those exist:

```yaml
investor_profile:
  primary_type: seed_fund            # angel | angel_syndicate | preseed_fund | seed_fund | multistage_vc | growth_fund | corporate_vc | family_office | accelerator | grant | competition | crowdfunding | venture_debt | rbf | university_fund | impact_fund
  secondary_types: [angel_syndicate]
  named_targets: []                  # firms or programmes named in the folder, with the file that names them
  region_investor: <company home country>
  region_company: <company home country>
  instrument_expected: <SAFE | ASA | BSA-AIR | convertible_loan | priced | grant | loan | n/a>
  deck_mode: reading_then_presenting # reading | presenting | reading_then_presenting | form
  source: assumption                 # folder | founder_answer | assumption
  note: "No investor files found; default applied. Founder to confirm."
```

## 11. Never-say list

Scan every output for: revolutionary, disruptive, game-changing, leverage, synergy, ecosystem, seamless, frictionless, robust, cutting-edge, next-generation, world-class, best-in-class, AI-powered, empower, unlock, transform, passionate, visionary, "no competitors", "in stealth", "some users", "huge market", "not just X, but Y", "poised to". Replace each with a number and a unit, or delete it, and keep the founder's own concrete phrasing. Three rewrites:
- "AI-powered platform revolutionizing logistics" becomes "<Company> schedules dock slots for mid-size 3PLs so trucks wait 40 minutes less": who, what, outcome, under 15 words.
- "We have no direct competitors" becomes "Today they use Excel and phone calls; the two funded startups in this space are X and Y, who win on Z."
- "Some early customers love it" becomes "27 paying customers; 9 of them expanded seats in the last 90 days": the exact count, the date, and whether they pay.

## 12. When to open something else

| Situation | Open |
|---|---|
| The founder asks for the full narrative, a 3-minute demo-day pitch or any other variant | `narrative.md` |
| The founder asks for the full investor Q&A | `investor-questions.md`, then `red-flags.md`; `question-bank.md` only as a lookup by theme |
| A meeting is booked, or has just happened | `meetings.md` (run sheet, follow-up email, objection log) |
| A deck review, a pre-send check, a full red-flag audit or the full confidentiality rule set | `red-flags.md` |
| A target investor type or region is named | `investor-types.md`, then only that type's or region's block in `investor-types-detail.md` |
| A fund's size is public, or the ask needs a sanity check against fund math | `investor-types-detail.md` section 1 |
| The ledger needs the metric set for this startup's business model | The one block for that model in `metrics-by-model.md` |
| An output will quote a stage benchmark, or a founder file quotes one | `benchmarks.md` (quote with source and year, or not at all) |
| A term the short list in section 1 does not settle, any chart, a metric entry beyond the basics | `metrics.md` |
| The founder asks for a deck | `deck-structure.md` and `design.md`; `deck-library.md` when the comparables command points to it |
| Ledger schema, START-HERE template, deck.json, folder layout | `file-formats.md` (every run) |
