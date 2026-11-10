# Investor Q&A: Hearthbox, pre-seed round, prepared 2026-11-10, numbers as of 2026-11-08

```yaml
investor_profile:
  primary_type: angel
  secondary_types: []
  named_targets: []
  region_investor: US
  region_company: US                 # inferred from Austin and USD; incorporation not stated
  instrument_expected: SAFE
  deck_mode: reading_then_presenting
  source: founder_answer             # "US angels first", 2026-11-10
  note: "Angels ask: why you, how do you know they need it, what will you do with my money, who else is in."
```

## The five questions you are least ready for

Ranked by likelihood times severity, from the ledger and gaps.md. Fix the fact, the file or the answer before the first meeting.

1. What exactly will you do with my money?  (trigger: `use_of_funds_uncosted_amount`, START-HERE question 1, confidence: low)  -> fix: finish the new budget so every line sums to $750,000 and maps to a milestone.
2. Who else is on the team, and who gets it manufactured?  (trigger: `founder_profile`, gaps.md team, confidence: low)  -> fix: get the co-founder's yes or no in writing, or pitch solo with the hires named.
3. Who else sells this, and what do people use today?  (trigger: README.md "the first", "the only hardware out there"; `alt_crock_price`, `alt_incubator_price`, confidence: low)  -> fix: build the table of every product on sale, with price and link.
4. How do you know they need it, not just like it?  (trigger: `deposits_paid` are refundable, `prototypes_in_use` has no usage data, confidence: low)  -> fix: write the prototype log; email the 312 and ask them to confirm at $299.
5. What does a unit really cost, and will it ship in Q3 2027?  (trigger: `bom_unit_1000`, `ship_target`, confidence: low)  -> fix: a dated schedule from mold order to first shipment, and the two quotes in the data room.

## Rapid-fire drill (10 questions, 15-second target each)

Read aloud, time it, score each answer 0-2 on directness, number density and non-defensiveness.

| # | Question | Target answer (one breath) | Ledger ids |
|---|---|---|---|
| 1 | What do you do? | We build a countertop box that holds temperature, humidity and airflow for home ferments, so batches stop failing. | |
| 2 | What is your progress? | Six prototypes in Austin kitchens since March. 312 refundable $49 deposits by 8 November 2026, all after seeing the $299 price. | `[fact:prototypes_in_use]` `[fact:deposits_paid]` `[assumption:deposit_price_shown]` |
| 3 | What is your unique insight? | Ferments fail on conditions, not recipes. Holding temperature and humidity for weeks is a control problem, and I built thermostat hardware for nine years. | `[assumption:founder_hardware_years]` |
| 4 | How do you get the first 1,000 customers? | The 312 deposit holders first, then the 2,140 signups, about 68% in the US. A repeatable channel is not proven yet. | `[fact:deposits_paid]` `[fact:waitlist_signups]` `[fact:waitlist_us_share_pct]` |
| 5 | Who are your competitors and why are you different? | As we read it, a crock at about $30 or a lab incubator at about $4,000. The full list of what is on sale is still to build. | `[assumption:alt_crock_price]` `[assumption:alt_incubator_price]` |
| 6 | How big is the market, bottom-up? | Not counted yet. The count is US households that ferment at home, times $299. | `[needs number]` `[assumption:target_price]` |
| 7 | What is your business model? | We sell the box at a $299 target price, about 60% estimated margin direct. A $12 a month recipe subscription is planned and untested. | `[assumption:target_price]` `[assumption:hardware_gross_margin_pct]` `[assumption:subscription_price]` |
| 8 | Why now? | We have no dated outside change to point to. What is recent is the demand: 312 deposits by 8 November 2026. | `[fact:deposits_paid]` |
| 9 | How much are you raising and what does it buy? | $750,000: tooling, UL and FCC, the first 1,000 units and a team of three for 12 months. First units targeted for Q3 2027. | `[fact:ask]` `[assumption:first_run_units]` `[projection:ship_target]` |
| 10 | What is the biggest risk? | Nothing has been manufactured. The module that heats and cools is the hard part: Peltier is noisy and power hungry. | gaps.md, technical choice |

Row 3 is drafted from your README and your background. Replace it with what the six kitchens taught you.

## Questions by theme

### Team and hiring

#### Q: Who are you, and why are you the one to build this?
**Why they ask it:** Angels back the person first. The folder gave no background until you answered.
**Strongest honest answer (founder's voice):**
I'm Dev Patel. I spent nine years as a hardware engineer at a thermostat company `[assumption:founder_hardware_years]`. I have been full time on Hearthbox since March 2026 and I built the six prototypes myself `[assumption:founder_profile]` `[fact:prototypes_in_use]`.
**Trap to avoid:** Adjectives about passion. Name the company and one product you shipped.
**Evidence to have ready:** Your CV or LinkedIn, with the employer and one shipped product named (missing, in gaps.md).
**Confidence:** medium

#### Q: Who else is on the team, and what is the biggest hole?
**Why they ask it:** One founder on paper, and nobody yet owns manufacturing and supply chain (notes/ask.md).
**Strongest honest answer (founder's voice):**
Today it is me. The biggest hole is manufacturing and supply chain. The round pays for 12 months of me, a firmware engineer and a part-time industrial designer, drafted at $320,000 `[assumption:use_of_funds_team_amount]`.
**Trap to avoid:** Announcing a co-founder who has not said yes.
**Evidence to have ready:** The co-founder's decision in writing with its date, or job descriptions for the two hires (missing, in gaps.md).
**Confidence:** low
**FLAG:** weak honest answer. How we will find out: ask the co-founder for a yes or no by a date you set, before the first meeting.

### Traction and proof

#### Q: How do you know people need this, not just like it?
**Why they ask it:** The angel's demand question. Your proof is deposits and prototypes, not sales.
**Strongest honest answer (founder's voice):**
312 people paid a refundable $49 deposit by 8 November 2026 `[fact:deposits_paid]` `[fact:deposit_amount]`, each after seeing the $299 price `[assumption:deposit_price_shown]`. Four have asked for a refund `[assumption:deposit_refund_requests]`. That is intent at a stated price, not a sale.
**Trap to avoid:** Calling deposits pre-orders or revenue.
**Evidence to have ready:** Stripe export of deposits and refunds; screenshot of the landing page showing $299 (both missing, in gaps.md).
**Confidence:** medium

#### Q: How many of the 312 will actually buy at $299?
**Why they ask it:** A refundable $49 is cheap to pay and cheap to take back.
**Strongest honest answer (founder's voice):**
We do not know yet. 312 paid the deposit `[fact:deposits_paid]` and four have asked for it back `[assumption:deposit_refund_requests]`. The next step is the prototype video to all 312, with a request to confirm at $299 `[assumption:target_price]`.
**Trap to avoid:** Quoting a conversion rate you have not measured.
**Evidence to have ready:** The email, its send date and the replies (missing, in gaps.md).
**Confidence:** low
**FLAG:** weak honest answer. How we will find out: send the prototype video and count confirmations; date `[needs detail]`.

#### Q: What have the six prototypes taught you?
**Why they ask it:** Six units since March is the only product proof, and it has no detail behind it.
**Strongest honest answer (founder's voice):**
Six hand-built prototypes have been running in Austin kitchens since March `[fact:prototypes_in_use]` (n=6). `[needs detail]`: households, batches completed, batches that failed and why, and what you changed in the design.
**Trap to avoid:** "People do not want to give them back" with no count behind it.
**Evidence to have ready:** A prototype log and one photo or video labelled "prototype" (missing, in gaps.md).
**Confidence:** low
**FLAG:** weak honest answer. How we will find out: write the log from your own notes this week; it needs no new data.

### Go-to-market

#### Q: Where did the signups come from, and can you do it again?
**Why they ask it:** Most of the waitlist came from two posts.
**Strongest honest answer (founder's voice):**
About 1,400 of 2,140 gross signups came from one post in r/fermentation and one TikTok with 900,000 views `[fact:signups_from_two_posts]` `[fact:waitlist_signups]` `[fact:tiktok_views]`. 14.6% of all signups paid a deposit `[fact:signup_to_deposit_pct]`. We have not yet shown a channel that repeats.
**Trap to avoid:** Presenting 2,140 as a net or active list. It is gross.
**Evidence to have ready:** Signups and deposits by week and by channel (missing, in gaps.md).
**Confidence:** medium

### Competition and moat

#### Q: Who else sells this, and what does a home fermenter use today?
**Why they ask it:** The README says "the first" and "the only hardware out there". Investors hear no research.
**Strongest honest answer (founder's voice):**
As we read it, people use a crock at about $30 or a lab incubator at about $4,000 `[assumption:alt_crock_price]` `[assumption:alt_incubator_price]`. That is our own read, not a full list. The table of everything on sale, with prices, is not built yet.
**Trap to avoid:** "We have no competitors."
**Evidence to have ready:** Competitor table with price, link and where each one beats Hearthbox (missing, in gaps.md).
**Confidence:** low
**FLAG:** weak honest answer. How we will find out: one afternoon of searching; add the table before the first meeting.

### Business model and unit economics

#### Q: Hardware or subscription: which one are you?
**Why they ask it:** The README describes both, and "platform". A this-or-that question never gets "both".
**Strongest honest answer (founder's voice):**
The box. It is what 312 people paid a deposit for `[fact:deposits_paid]`. The $12 a month recipe subscription `[assumption:subscription_price]` has not been offered to anyone, so there is no attach rate. We hope for 40% and have no data `[assumption:subscription_attach_hope_pct]`.
**Trap to avoid:** The coffee pod comparison.
**Evidence to have ready:** The subscription offer and the date it goes to deposit holders (missing, in gaps.md).
**Confidence:** medium

#### Q: What are the unit economics, and what happens if you sell through retail?
**Why they ask it:** Every cost is an estimate, and your own note says retail margin eats most of the hardware margin.
**Strongest honest answer (founder's voice):**
We estimate $96 to build at 1,000 units from two contract manufacturer quotes `[assumption:bom_unit_1000]`, about $118 landed `[assumption:landed_cost_unit]`, and about 60% margin at $299 direct `[assumption:target_price]` `[assumption:hardware_gross_margin_pct]`. We estimate $78 at 5,000 units `[assumption:bom_unit_5000]`. If we go retail, their margin eats most of that, so the subscription has to carry it.
**Trap to avoid:** Stating the margin as a fact. Nothing has been manufactured.
**Evidence to have ready:** notes/bom-estimate.md and the two quotes (the quotes are missing, in gaps.md).
**Confidence:** medium

### Market and why now

#### Q: How big is this, bottom-up?
**Why they ask it:** The README has "$XXB" as a placeholder.
**Strongest honest answer (founder's voice):**
We have not counted it yet. The count is US households that ferment at home, times $299 `[assumption:target_price]`; about 68% of our signups are in the US `[fact:waitlist_us_share_pct]`. `[needs number]`
**Trap to avoid:** A report number, or "one percent of" anything.
**Evidence to have ready:** A dated survey of home fermenting households (missing, in gaps.md).
**Confidence:** low
**FLAG:** weak honest answer. How we will find out: find one dated household survey and do the multiplication; date `[needs detail]`.

#### Q: Why now?
**Why they ask it:** Angels weigh it heavily, and the folder has no dated outside change.
**Strongest honest answer (founder's voice):**
We do not have a single outside event to point to. What we have is recent demand: 312 deposits by 8 November 2026 `[fact:deposits_paid]`, most of the signups from one Reddit post and one TikTok `[fact:signups_from_two_posts]`.
**Trap to avoid:** "Gut health is trending" with no date or source.
**Evidence to have ready:** If one exists: a dated cost or component change that makes a $299 box possible (missing, in gaps.md).
**Confidence:** low
**FLAG:** weak honest answer. How we will find out: if no dated change exists, leave why-now out of the deck.

### Financials and use of funds

#### Q: What will you do with my money, in the next 90 days and across the round?
**Why they ask it:** The angel's standard question, and the draft budget does not add up.
**Strongest honest answer (founder's voice):**
We are raising $750,000 `[fact:ask]`. The draft has tooling at $85,000, certification at $25,000, the first 1,000 units at $96,000 and the team at $320,000 `[assumption:use_of_funds_tooling_amount]` `[assumption:use_of_funds_certs_amount]` `[assumption:use_of_funds_units_amount]` `[assumption:use_of_funds_team_amount]`. I am rebuilding it line by line; $114,000 is not costed yet `[assumption:use_of_funds_uncosted_amount]`.
**Trap to avoid:** "18 months of runway" or "buffer" as an answer.
**Evidence to have ready:** The new budget, summing to the ask, with the first 90 days listed (in progress).
**Confidence:** low
**FLAG:** weak honest answer. How we will find out: the redone budget; date `[needs detail]`.

### The round itself

#### Q: Who else is in, and on what terms?
**Why they ask it:** The most common angel question. They are testing momentum and price discipline.
**Strongest honest answer (founder's voice):**
We are raising $750,000 on a SAFE `[fact:ask]` `[assumption:round_profile]`. `[needs detail]`: the amount committed so far, if any. On price: the market will set it, and I will discuss it in the meeting, not in the deck.
**Trap to avoid:** Naming people who have not committed, or quoting a cap you have not checked.
**Evidence to have ready:** Committed amount and close date, once they exist (missing, in gaps.md).
**Confidence:** low
**FLAG:** weak honest answer. How we will find out: check comparable pre-seed hardware rounds with a source before the first meeting.

### Risks and what kills you

#### Q: What does a unit really cost, and will it ship in Q3 2027?
**Why they ask it:** Nothing has been manufactured, and first hardware runs slip.
**Strongest honest answer (founder's voice):**
The plan targets first units in Q3 2027, assuming the round closes, the molds are cut and certification passes `[projection:ship_target]`. The open risk is the Peltier module: noisy and power hungry. Cost is an estimate of $96 a unit `[assumption:bom_unit_1000]` until the first run.
**Trap to avoid:** Certainty about a date nobody has scheduled.
**Evidence to have ready:** Dated schedule from mold order to first shipment; measured noise and power on a prototype (both missing, in gaps.md).
**Confidence:** low
**FLAG:** weak honest answer. How we will find out: build the schedule with one of the two contract manufacturers; date `[needs detail]`.

#### Q: A heated box with food in it for weeks: what is the safety and regulatory exposure?
**Why they ask it:** A mains-powered kitchen appliance that grows cultures. Certification has not started.
**Strongest honest answer (founder's voice):**
UL and FCC are not done yet; we budget $25,000 for them `[assumption:use_of_funds_certs_amount]`. `[needs detail]`: the food-contact materials and what the box does when a batch goes wrong.
**Trap to avoid:** "It is just a warm box."
**Evidence to have ready:** A test-lab quote and the list of standards that apply (missing, in gaps.md).
**Confidence:** low
**FLAG:** weak honest answer. How we will find out: one call with a certification lab; date `[needs detail]`.

## Red flags

### RF-ask-1: "The use of funds does not add up to the round"
- Severity: major
- Trigger: notes/ask.md. The six lines with a figure sum to $636,000 (85,000 + 96,000 + 25,000 + 320,000 + 60,000 + 50,000) against $750,000 `[fact:ask]` `[assumption:use_of_funds_tooling_amount]` `[assumption:use_of_funds_units_amount]` `[assumption:use_of_funds_certs_amount]` `[assumption:use_of_funds_team_amount]` `[assumption:use_of_funds_content_amount]` `[assumption:use_of_funds_marketing_amount]`; "shipping" and "buffer" have no figure, which leaves $114,000 `[assumption:use_of_funds_uncosted_amount]`.
- Investor reads it as: the plan has not been costed.
- Deck fix: none possible until the budget is redone; the narrative names the buckets and shows `[needs number]`.
- Verbal answer: "I am rebuilding the budget line by line. Tooling, certification, the first 1,000 units and the team are drafted; shipping and the buffer are not costed yet."
- Status: open (founder is redoing the budget, 2026-11-10)

### RF-ask-2: "They do not know how much they are raising"
- Severity: critical
- Trigger: notes/ask.md, "raising $750k pre-seed... maybe $1M?"
- Investor reads it as: uncertainty about the plan.
- Deck fix: every output uses $750,000 `[fact:ask]`.
- Verbal answer: "$750,000."
- Status: fixed in the outputs (founder decision, 2026-11-10). notes/ask.md still carries both figures; update it before anyone else reads it.

### RF-competition-1: "They say they are the first and the only one"
- Severity: critical
- Trigger: README.md, "the first countertop fermentation appliance" and "the only hardware out there is either a $30 crock or a $4,000 lab incubator" `[assumption:alt_crock_price]` `[assumption:alt_incubator_price]`.
- Investor reads it as: no market, or no research.
- Deck fix: "first" and "only" are removed; the two price points are stated as our own read. A named competitor table is still missing.
- Verbal answer: "As we read it, a crock or a lab incubator. The full table of what is on sale is not built yet."
- Status: open

### RF-team-1: "One founder, and the co-founder waits for the round"
- Severity: major
- Trigger: notes/ask.md, the co-founder "would join full time at close. Not confirmed."; `[assumption:founder_profile]`.
- Investor reads it as: nobody owns manufacturing, and nobody else has committed.
- Deck fix: the team section shows the founder and the two planned hires; the co-founder is not mentioned.
- Verbal answer: "Today it is me. The hole is manufacturing and supply chain, and the round funds a firmware engineer and a part-time industrial designer."
- Status: open

### RF-evidence-1: "Three claims rest on the founder's word"
- Severity: major
- Trigger: `[assumption:deposit_price_shown]`, `[assumption:deposit_refund_requests]`, `[assumption:founder_hardware_years]`: stated in chat on 2026-11-10, no file in the folder.
- Investor reads it as: fine in a first meeting, a problem in diligence.
- Deck fix: none needed in the text; attach the Stripe export, the landing page screenshot and the CV.
- Verbal answer: "I can send the Stripe export and the page screenshot today."
- Status: open

### RF-product-1: "Six prototypes, and nothing to look at"
- Severity: major
- Trigger: README.md, "six hand-built prototypes" and "people genuinely do not want to give them back"; no photo, video or usage record in the folder `[fact:prototypes_in_use]`.
- Investor reads it as: a concept until they see it run.
- Deck fix: one photo or video labelled "Prototype"; the "give them back" line is cut until there is a log.
- Verbal answer: "Six units in Austin kitchens since March. Here is one running, and here is the log."
- Status: open

### RF-market-1: "The market number is a placeholder"
- Severity: major
- Trigger: README.md, "Fermentation is a $XXB trend".
- Investor reads it as: they have not counted their customers.
- Deck fix: `[needs number]` with the bottom-up method; no report figure.
- Verbal answer: "We have not counted it yet. The count is US households that ferment at home, times $299."
- Status: open

### RF-traction-1: "The waitlist is the headline"
- Severity: major
- Trigger: notes/waitlist.txt, 2,140 gross signups `[fact:waitlist_signups]`, about 1,400 from two posts `[fact:signups_from_two_posts]`.
- Investor reads it as: a spike, not demand.
- Deck fix: deposits lead; signups appear only as the base of the 14.6% `[fact:signup_to_deposit_pct]`, labelled gross.
- Verbal answer: "The number that matters is 312 paid deposits. The waitlist is gross and mostly two posts."
- Status: fixed in the outputs

### RF-model-1: "Box, subscription, platform: which is it?"
- Severity: major
- Trigger: README.md, "the platform for home fermentation"; notes/bom-estimate.md, "Hoping for 40%+ of buyers to subscribe. No data" `[assumption:subscription_attach_hope_pct]`.
- Investor reads it as: unfocused, and the recurring revenue is a hope.
- Deck fix: the box is the business; the subscription is shown as planned and untested.
- Verbal answer: "The box. The subscription has not been offered to anyone yet."
- Status: fixed in the outputs; the data is still open

### RF-terms-1: "There is a valuation in the notes"
- Severity: major if it reaches a deck
- Trigger: notes/ask.md contains a SAFE cap and a cap range, marked "need to check".
- Investor reads it as: negotiating before the conversation.
- Deck fix: excluded from the narrative, this file and the ledger.
- Verbal answer: "The market will set it. I will discuss price in the meeting."
- Status: fixed (excluded)

## Trick and pressure questions (on request)

Not written. Ask for it, or it is added when a meeting is booked.

## Questions to ask the investor (on request)

Not written. Ask for it, or it is added when a meeting is booked.

## Appendix slides this prep requires

- "Use of funds: $750,000 by line and milestone". Answers: what will you do with my money. `[fact:ask]`, the use_of_funds entries. Waits for the new budget.
- "What a home fermenter can buy today". Answers: who else sells this. `[assumption:alt_crock_price]` `[assumption:alt_incubator_price]`, plus the table to build.
- "Unit cost at 1,000 and 5,000 units". Answers: unit economics. `[assumption:bom_unit_1000]` `[assumption:landed_cost_unit]` `[assumption:bom_unit_5000]`.
- "Deposits and signups by week and channel". Answers: can you repeat the demand. `[fact:deposits_paid]` `[fact:waitlist_signups]`, plus the series to export.
- "From mold order to first shipment". Answers: will it ship in Q3 2027. `[projection:ship_target]`.
- "Six kitchens: the prototype log". Answers: what have the prototypes taught you. `[fact:prototypes_in_use]`.

## Data-room items this prep requires

1. Stripe export of deposits and refunds. Answers: need it or like it; how many buy. Status: missing, in gaps.md. Owner: Dev.
2. Landing page screenshot showing the $299 price. Answers: need it or like it. Status: missing, in gaps.md. Owner: Dev.
3. CV or LinkedIn naming the thermostat company and one shipped product. Answers: why you. Status: missing, in gaps.md. Owner: Dev.
4. BOM estimate (notes/bom-estimate.md). Answers: unit economics. Status: ready. Owner: Dev.
5. The two contract manufacturer quotes. Answers: unit economics; real cost. Status: missing, in gaps.md. Owner: Dev.
6. Budget summing to $750,000. Answers: what will you do with my money. Status: in progress. Owner: Dev.
7. Competitor table. Answers: who else sells this. Status: missing, in gaps.md. Owner: Dev.
8. Prototype log and one photo or video. Answers: what have the prototypes taught you. Status: missing, in gaps.md. Owner: Dev.
9. Schedule from mold order to first shipment; certification lab quote. Answers: ship date; safety. Status: missing, in gaps.md. Owner: Dev.
10. Signups and deposits by week and channel. Answers: can you repeat it. Status: missing, in gaps.md. Owner: Dev.
11. Cap table and SAFE documents. Answers: who else is in. Status: not applicable until the first commitment. Owner: Dev.
