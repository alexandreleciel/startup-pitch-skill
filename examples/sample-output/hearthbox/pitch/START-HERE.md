# Hearthbox: pitch start page

Generated 2026-11-10, run 2 (after your answers). Numbers as of 2026-11-08. Every figure traces to pitch/facts.yaml.

## 1. Answer these first

1. **What is the new budget?** The six costed lines in notes/ask.md sum to $636,000 (85k + 96k + 25k + 320k + 60k + 50k), so $114,000 of the $750,000 has no costed use `[assumption:use_of_funds_uncosted_amount]`.
   *Used until you answer:* the buckets named without amounts, and `[needs number]`.
2. **Is 312 before or after the four refund requests?** Please also export Stripe and screenshot the page showing $299: both claims rest on your word so far.
   *Used until you answer:* "312 paid, four have asked for a refund", always together `[fact:deposits_paid]` `[assumption:deposit_refund_requests]`.
3. **What have the six prototypes shown?** Households, batches completed, failures, the year of "March", one photo or video.
   *Used until you answer:* "six prototypes in Austin kitchens since March (n=6)" `[fact:prototypes_in_use]`, with no usage claim.
4. **What can a home fermenter buy today?** The README says "the first" and "the only hardware out there".
   *Used until you answer:* your read, a crock at about $30 or a lab incubator at about $4,000 `[assumption:alt_crock_price]` `[assumption:alt_incubator_price]`, labelled as your read.
5. **Do you pitch solo, or wait for the co-founder's answer?** And which thermostat company, and one product you shipped there?
   *Used until you answer:* one founder, two planned hires, co-founder not mentioned; background as you stated it `[assumption:founder_hardware_years]`.

The rest (market size, subscription, schedule, safety, cash) is in [gaps.md](gaps.md).

## 2. Your pitch

**In two sentences:** Hearthbox is building a countertop box that holds the exact temperature, humidity and airflow for home ferments for days or weeks: no exploding jars, no mold roulette. 312 people have paid a refundable $49 deposit after seeing the $299 price (8 November 2026).

**In 60 seconds:** I'm Dev Patel. I spent nine years as a hardware engineer at a thermostat company, and since March 2026 I have been full time on Hearthbox. Hearthbox is a countertop box that holds the exact temperature, humidity and airflow for home ferments, for days or weeks. Think of it like a sous-vide for fermentation: put in the vegetables, the milk or the dough, pick a recipe on your phone, and the box does the rest. No exploding jars, no mold roulette. I built six prototypes, and they have been running in Austin kitchens since March. The box is not on sale yet, and by 8 November 312 people had paid a refundable $49 deposit after seeing the $299 price. I am raising $750,000 to build the production tooling, pass UL and FCC, and ship the first 1,000 units, with first units targeted for Q3 2027.

## 3. The numbers that matter

| Number | Value | Kind | Source |
|---|---|---|---|
| Paid refundable deposits | 312 at $49, $15,288 held, 8 Nov 2026 `[fact:deposits_paid]` `[fact:deposit_amount]` `[fact:deposits_collected]` | fact | notes/waitlist.txt |
| Price they saw first | $299, shown to every deposit holder `[assumption:deposit_price_shown]` | assumption (your statement) | no file yet |
| Prototypes in homes | 6, Austin kitchens, since March (n=6) `[fact:prototypes_in_use]` | fact | README.md |
| Founder | 9 years as a hardware engineer at a thermostat company; full time since March 2026 `[assumption:founder_hardware_years]` `[assumption:founder_profile]` | assumption (your statement) | no file yet |
| Cost and price | We estimate $96 to build at 1,000 units (two manufacturer quotes, Oct 2026), about $118 landed, $299 target `[assumption:bom_unit_1000]` `[assumption:landed_cost_unit]` `[assumption:target_price]` | assumption | notes/bom-estimate.md |

**Do not use yet:**
- "A $XXB trend": a placeholder. Backed by a bottom-up count (method in gaps.md).
- "The first" and "the only hardware out there": backed by a named competitor table.
- "People do not want to give them back": backed by the prototype log.
- 40% of buyers subscribing `[assumption:subscription_attach_hope_pct]`: backed by offering it to deposit holders.
- The three fermenters `[fact:creators_in_talks]`: backed by one signed letter.
- 2,140 signups as a headline `[fact:waitlist_signups]`: it is gross, and mostly two posts.

## 4. The five questions you are least ready for

Full answers, traps and evidence are in [investor-qa.md](investor-qa.md).

**What exactly will you do with my money?** Why they ask: the draft budget does not add up. Your strongest honest answer: "$750,000 `[fact:ask]`. Tooling, certification, the first 1,000 units and the team are drafted; I am rebuilding the budget and $114,000 is not costed yet `[assumption:use_of_funds_uncosted_amount]`." Have ready: the new budget.

**Who else is on the team?** Why they ask: one founder, and nobody owns manufacturing. Your strongest honest answer: "Today it is me, nine years in thermostat hardware `[assumption:founder_hardware_years]`. The hole is manufacturing and supply chain; the round funds a firmware engineer and a part-time industrial designer." Have ready: the co-founder's answer in writing, or the two job descriptions.

**Who else sells this?** Why they ask: "first" and "only" read as no research. Your strongest honest answer: "As we read it, a crock at about $30 or a lab incubator at about $4,000 `[assumption:alt_crock_price]` `[assumption:alt_incubator_price]`. The full table is not built yet." Have ready: the competitor table.

**How do you know they need it, not just like it?** Why they ask: deposits are refundable. Your strongest honest answer: "312 people paid $49 after seeing the $299 price `[fact:deposits_paid]` `[assumption:deposit_price_shown]`; four asked for a refund `[assumption:deposit_refund_requests]`. That is intent, not a sale. Next we ask them to confirm at $299." Have ready: Stripe export, page screenshot.

**What does it cost, and will it ship in Q3 2027?** Why they ask: nothing has been manufactured. Your strongest honest answer: "We estimate $96 a unit from two quotes `[assumption:bom_unit_1000]`. Q3 2027 assumes the round, the molds and certification all land `[projection:ship_target]`. The open risk is the Peltier module." Have ready: a dated schedule, the quotes.

## 5. Top three red flags

**"The first" and "the only", with no competitor named** (critical). What an investor reads into it: no market, or no research. Fix: the competitor table.

**The use of funds does not add up to the round** (major). What an investor reads into it: the plan is not costed. Fix: the new budget, every line tied to a milestone.

**One founder, and the co-founder waits for the round** (major). What an investor reads into it: nobody else has committed. Fix: a written yes or no, or pitch solo with named hires.

## 6. Kept out of investor material

No file was flagged confidential; all four were read. Held back, without repeating the values: the SAFE cap and cap range in notes/ask.md (not in the ledger); the possible co-founder's name, employer and conditions (notes/ask.md); pay per person (the team is one bucket); the three fermenters (README.md), unnamed until one signs. The deposit money is never called revenue.

## 7. Next

Ask for any of: a deck (HTML, PDF, PowerPoint), preparation for your first angel meeting (run sheet, pressure questions, questions to ask them), a full red-flag audit. The narrative and the investor Q&A are written.

## Files

- [START-HERE.md](START-HERE.md): this page
- [narrative.md](narrative.md): purpose, vertebrae, long form, two-sentence, 60-second and 3-minute versions
- [investor-qa.md](investor-qa.md): least-ready five, 10-question drill, 15 themed questions, red-flag records
- [facts.yaml](facts.yaml): the fact ledger, 34 entries
- [gaps.md](gaps.md): open items and the evidence to collect
- [run-log.md](run-log.md): what was read, asked, answered and changed
- [intake/inventory.json](intake/inventory.json), [intake/corpus/INDEX.md](intake/corpus/INDEX.md): inventory and extracted text
