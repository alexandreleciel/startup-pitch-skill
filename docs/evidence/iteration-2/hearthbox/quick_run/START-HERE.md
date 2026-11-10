# Hearthbox: pitch start page

Generated 2026-11-10. Numbers as of 2026-11-08. Every figure traces to pitch/facts.yaml.

## 1. Answer these first

1. **Are you raising $750k or $1M?** notes/ask.md says "raising $750k pre-seed... maybe $1M?", depending on whether UL cert and a second mold set happen now or later. Certs are already a line inside the $750k list, so say what the extra money buys. Investors need one number.
   *Used until you answer:* $750,000 `[fact:ask]`, with $1,000,000 `[fact:ask_high]` recorded as the other side.
2. **What do shipping and the buffer cost?** The six lines with a figure in notes/ask.md (tooling $85,000, first 1,000 units $96,000, certs $25,000, team $320,000, content $60,000, marketing $50,000) add up to $636,000 `[assumption:funds_named_total]` `[assumption:use_of_funds_tooling_amount]` `[assumption:use_of_funds_units_amount]` `[assumption:use_of_funds_certs_amount]` `[assumption:use_of_funds_team_amount]` `[assumption:use_of_funds_content_amount]` `[assumption:use_of_funds_marketing_amount]`. "Shipping" and "buffer" have no figure, which leaves $114,000 of a $750k round unexplained `[assumption:funds_unallocated]`. The units line is priced at the $96 BOM `[assumption:bom_unit_1000]`, while your own landed estimate is about $118 a unit `[assumption:landed_cost_unit]`.
   *Used until you answer:* the six named lines only; shipping and buffer are `[needs number]`.
3. **Is 2,140 net of unsubscribes, did the 312 see the $299 price before they paid, and has anyone asked for a refund?** Your own todo in notes/waitlist.txt raises the first; the folder is silent on the other two. This decides whether you can say "312 pre-orders at $299" or "312 refundable deposits".
   *Used until you answer:* "312 refundable $49 deposits" `[fact:deposits_paid]`, never "pre-orders"; 2,140 signups `[fact:waitlist_signups]` and 14.6% `[fact:signup_to_deposit_pct]` stay off the headline (removing unsubscribes can only raise the rate).
4. **Who is on the team today?** The folder names one founder and gives no background: what you did before, who built the six prototypes, whether you are full time. notes/ask.md describes a co-founder who would join at close and is not confirmed. At pre-seed the team is most of the decision.
   *Used until you answer:* one founder, background `[needs detail]`; the co-founder is not mentioned in investor material; the firmware engineer and the part-time industrial designer are shown as planned hires.
5. **Who are you pitching first, and where is the company incorporated?** Nothing in the folder names an investor.
   *Used until you answer:* US angels plus a pre-seed fund as lead, a reading deck sent ahead and a presenting deck for the meeting `[assumption:round_profile]`.

Six more open items (prototype evidence, market size, competitors, subscription evidence, cash and runway, why now) are in [gaps.md](gaps.md).

## 2. Your pitch

**In two sentences:** Hearthbox is building a countertop box that holds the exact temperature, humidity and airflow for home ferments for days or weeks: no exploding jars, no mold roulette. 312 people have paid a refundable $49 deposit for one (8 November 2026) `[fact:deposits_paid]`.

**In 60 seconds:** Hearthbox is building a countertop box that holds the exact temperature, humidity and airflow for home ferments, for days or weeks. Fermenting at home fails in familiar ways: exploding jars, mold roulette, "is this supposed to smell like this". Hearthbox works like a sous-vide for fermentation: you put in the vegetables, the milk, the dough or the tempeh beans, pick a recipe on your phone, and the box runs the program. Six hand-built prototypes have been running in Austin kitchens since March `[fact:prototypes_in_use]`. The box is not on sale yet, and 312 people have already paid a refundable $49 deposit for one, as of 8 November 2026 `[fact:deposits_paid]`. We are raising a $750,000 pre-seed `[fact:ask]` to build the production tooling, pass UL and FCC certification and ship the first 1,000 units to the waitlist `[assumption:first_run_units]`, with first units targeted for Q3 2027 `[projection:ship_target]`.

No "why now" line: the folder has no dated outside change (a regulation, a cost crossing, a technology release). If you have one, send it.

## 3. The numbers that matter

| Number | Value | Kind | Source |
|---|---|---|---|
| Paid refundable deposits | 312 at $49 each, $15,288 held in Stripe, 8 Nov 2026 `[fact:deposits_paid]` `[fact:deposit_amount]` `[fact:deposits_collected]` | fact | notes/waitlist.txt |
| Prototypes in homes | 6 hand-built, Austin kitchens, since March (n=6, no usage data yet) `[fact:prototypes_in_use]` | fact | README.md |
| Cost to build | We estimate $96 a unit at 1,000 units, from two contract manufacturer quotes plus Digikey prices, October 2026; about $118 landed `[assumption:bom_unit_1000]` `[assumption:landed_cost_unit]` | assumption | notes/bom-estimate.md |
| Price and hardware margin | $299 target price; we estimate about 60% gross margin sold direct `[assumption:target_price]` `[assumption:hardware_gross_margin_pct]` | assumption | notes/bom-estimate.md |

Missing from this table: the trajectory. `[needs number]` signups and deposits per week since the landing page went live.

**Do not use yet:**
- "Fermentation is a $XXB trend" (README.md). The figure is a placeholder. What backs it: a bottom-up count, households that ferment at home in your launch countries times your price, each input sourced and dated. The method is in gaps.md.
- "The first countertop fermentation appliance" and "the only hardware out there is a crock or a lab incubator" (README.md). No competitor list in the folder. What backs it: every product a home fermenter can buy today, with price and link, and where each beats you.
- "People genuinely do not want to give them back" (README.md). What backs it: number of households, batches completed, weeks in use, and quotes you have permission to use.
- 40% of buyers subscribing `[assumption:subscription_attach_hope_pct]` and the subscription margin (notes/bom-estimate.md). Your note says there is no data. What backs it: offer the $12 a month plan `[assumption:subscription_price]` to the 312 deposit holders and count who commits.
- Three well known fermenters `[fact:creators_in_talks]`. Conversations are not partnerships. What backs it: one signed letter.
- "The platform for home fermentation", like the coffee pod company (README.md). A comparison is not evidence, and it invites "hardware or subscription: which one are you?"

## 4. The five questions you are least ready for

**Who builds this, and who gets it manufactured?** Why they ask: a hardware pre-seed is a bet on the team, and the folder shows one founder. Your strongest honest answer: "Today it is me `[needs detail: your background and what you built yourself]`. The round pays for 12 months of me, a firmware engineer and a part-time industrial designer `[assumption:use_of_funds_team_amount]`." This answer is weak until question 4 is answered. Have ready: a short bio, who built the six prototypes, and the co-founder's commitment in writing with its date and condition.

**Is it $750k or $1M, and what does it buy?** Why they ask: a range reads as not knowing what the plan costs. Your strongest honest answer: "$750,000 `[fact:ask]`. $636,000 is allocated across six lines `[assumption:funds_named_total]`; the two largest are the team at $320,000 and the molds at $85,000 `[assumption:use_of_funds_team_amount]` `[assumption:use_of_funds_tooling_amount]`. Shipping and the buffer are not costed yet." Have ready: a use of funds that sums to the ask, each line tied to shipping the first 1,000 units.

**312 deposits at $49: how many become buyers at $299, and can you repeat the demand?** Why they ask: refundable deposits are interest, not orders, and about 1,400 of 2,140 signups came from one Reddit post and one TikTok `[fact:signups_from_two_posts]` `[fact:waitlist_signups]`. Your strongest honest answer: "We have not measured that yet. 312 people paid a refundable $49 deposit by 8 November 2026 `[fact:deposits_paid]`. Next we send them the prototype video and ask them to confirm at $299 `[assumption:target_price]`; that gives the first conversion reading." Have ready: signups and deposits by week and by channel, refunds to date.

**What does a unit really cost, and when does it ship?** Why they ask: nothing has been manufactured, and first hardware runs slip. Your strongest honest answer: "We estimate $96 a unit at 1,000 units, from two contract manufacturer quotes and Digikey prices in October 2026 `[assumption:bom_unit_1000]`, about $118 landed `[assumption:landed_cost_unit]`. The open risks are the Peltier module's noise and power draw, and UL and FCC, budgeted at $25,000 `[assumption:use_of_funds_certs_amount]`. First units are targeted for Q3 2027 `[projection:ship_target]`." Have ready: the two quotes, and a dated schedule from mold order to first shipment.

**Hardware or subscription: which one are you?** Why they ask: the README describes both, and a this-or-that question never gets "both". Your strongest honest answer: "The box. It is what 312 people paid a deposit for `[fact:deposits_paid]`. Nobody has been offered the $12 a month subscription yet `[assumption:subscription_price]`, so we have no attach rate; the first reading comes when we offer it to the deposit holders." Have ready: the subscription offer and the date it goes out.

## 5. Top three red flags

**The ask is a range and the use of funds does not add up** (critical). What an investor reads into it: the plan has not been costed. Fix: one number, with every line (including shipping and buffer) summing to it and tied to the Q3 2027 shipment `[projection:ship_target]`.

**"The first" and "the only hardware out there", with no competitor named** (critical). What an investor reads into it: no market, or no research. Fix: name what home fermenters use and can buy today, with prices, and say where each one beats Hearthbox.

**One founder on paper, and the co-founder joins only if the round closes** (major). What an investor reads into it: nobody has committed yet, and nobody owns manufacturing. Fix: your background and what you built, plus a dated, written commitment from the co-founder, or pitch as a solo founder with named hires.

## 6. Kept out of investor material

No file was flagged confidential; all four files were read. Held back from anything an investor sees:
- notes/ask.md: the SAFE valuation cap and the cap range your friends quoted. Not recorded in the ledger. Price is discussed live, never written in the deck.
- notes/ask.md: the name, employer and conditions of the possible co-founder, until she confirms.
- notes/ask.md: the team budget appears as one bucket, never as pay per person.
- README.md: the three fermenters stay unnamed and uncounted until one signs.
- notes/waitlist.txt: the $15,288 is described as refundable deposits held, never as revenue.

## 7. Next

Ask for any of: the full narrative, the full investor Q&A, a deck (HTML, PDF, PowerPoint), preparation for a specific investor type.

## Files

- [START-HERE.md](START-HERE.md): this page
- [facts.yaml](facts.yaml): the fact ledger, 27 entries
- [gaps.md](gaps.md): the open items beyond the five above
- [run-log.md](run-log.md): what was read and written, per run
- [intake/inventory.json](intake/inventory.json) and [intake/corpus/INDEX.md](intake/corpus/INDEX.md): the file inventory and extracted text
