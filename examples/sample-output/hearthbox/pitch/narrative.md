# Hearthbox: pitch narrative

Open questions that affect this narrative: pitch/START-HERE.md section 1 (and pitch/gaps.md).

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
  note: "Angels at pre-seed: lead with the founder and the first users, keep market detail short."
```

as_of: 2026-11-08   stage: pre-seed
round: $750,000 on a SAFE `[fact:ask]`   generated: 2026-11-10, run 2

## 1. Company purpose

Hearthbox builds a countertop box that holds temperature, humidity and airflow for home fermenters so their batches stop failing.

## 2. Narrative choices

- Archetype: team driven, because the strongest entries are the founder's nine years in thermostat hardware `[assumption:founder_hardware_years]` and six prototypes he built himself `[fact:prototypes_in_use]` `[assumption:founder_profile]`. The 312 deposits `[fact:deposits_paid]` support it as demand evidence; they are not a traction story.
- Sequence: YC seed order with the team moved to second place, because the first audience is US angels `[assumption:round_profile]`, who back the person, and the ledger has no revenue series.
- Point of view: founder story. The fit is real: a temperature-control engineer building a temperature-control appliance.
- Opening fact (zoom-out): none. The folder has no dated outside change, so there is no why-now section and the story opens in the kitchen. `[needs detail]`
- Acknowledged weakness: no unit has been manufactured and the cost is an estimate from two quotes `[assumption:bom_unit_1000]`. Mitigation: the round pays for tooling, certification and a firmware engineer, and the founder builds hardware for a living.
- Stage fit: prototype and deposit evidence only. Nothing below claims sales.
- Resting on the founder's word until a record is attached: the background, the price shown to deposit holders, the refund count.

## 3. Vertebrae

1. **Hearthbox runs home ferments for you.** Purpose sentence; "like a sous-vide for fermentation" (README.md).
2. **Built by a thermostat hardware engineer, full time since March 2026.** Nine years `[assumption:founder_hardware_years]`; sole founder, built the prototypes `[assumption:founder_profile]`.
3. **Home fermenting fails: exploding jars, mold roulette, weeks of guessing.** The founder's own words (README.md). No number.
4. **We see two options today: a $30 crock or a $4,000 incubator.** Our read, not a sourced list `[assumption:alt_crock_price]` `[assumption:alt_incubator_price]`. Named competitor table: `[needs detail]`.
5. **Put the food in, pick a recipe, the box holds the conditions.** Heats and cools; temperature, humidity, airflow; recipe chosen on the phone (README.md, notes/bom-estimate.md).
6. **Six prototypes have run in Austin kitchens since March.** n=6 `[fact:prototypes_in_use]`. Usage data: `[needs number]`.
7. **312 people paid a $49 deposit after seeing the $299 price.** `[fact:deposits_paid]` `[fact:deposit_amount]` `[assumption:deposit_price_shown]`; $15,288 held, refundable `[fact:deposits_collected]`; four refund requests `[assumption:deposit_refund_requests]`.
8. **Most signups came from one Reddit post and one TikTok.** About 1,400 of 2,140 gross signups `[fact:signups_from_two_posts]` `[fact:waitlist_signups]`; 900,000 views `[fact:tiktok_views]`; about 68% in the US `[fact:waitlist_us_share_pct]`.
9. **We estimate $96 to build and $299 to sell.** `[assumption:bom_unit_1000]` `[assumption:target_price]`; about $118 landed `[assumption:landed_cost_unit]`; about 60% margin direct `[assumption:hardware_gross_margin_pct]`.
10. **The box is the business; the $12 subscription is untested.** `[assumption:subscription_price]`. Deposits were for the box only.
11. **Market size: `[needs number]`, to be counted bottom-up.** Households that ferment at home in the US, times the price `[assumption:target_price]`.
12. **$750,000 takes Hearthbox from prototype to 1,000 units shipped.** `[fact:ask]` `[assumption:first_run_units]`. Line-by-line budget: `[needs number]`.
13. **First units ship in Q3 2027 if tooling and certification hold.** `[projection:ship_target]`.
14. **Besides money: people who have shipped a consumer appliance.** Tooling, UL and a first production run are the open risks (notes/bom-estimate.md).

## 4. Long-form narrative

### Hearthbox runs home ferments for you

Hearthbox builds a countertop box that holds temperature, humidity and airflow for home fermenters so their batches stop failing. Think of it like a sous-vide for fermentation.

### Built by a thermostat hardware engineer, full time since March 2026

Dev Patel spent nine years as a hardware engineer at a thermostat company `[assumption:founder_hardware_years]`. Hearthbox is a temperature-control product, and that is the work he comes from. He has been full time on it since March 2026 and built every prototype himself `[assumption:founder_profile]`. Today the company is Dev.

### Home fermenting fails: exploding jars, mold roulette, weeks of guessing

A ferment needs the same conditions for days or weeks, and a kitchen counter does not give them. Anyone who has tried knows the result: exploding jars, mold roulette, and "is this supposed to smell like this".

### We see two options today: a $30 crock or a $4,000 incubator

As we read it, the hardware on sale is either a crock at about $30 or a lab incubator at about $4,000 `[assumption:alt_crock_price]` `[assumption:alt_incubator_price]`. That is our own read of the shelf, not yet a sourced list. The table of named products is `[needs detail]`.

### Put the food in, pick a recipe, the box holds the conditions

You put in the vegetables, or the milk, or the dough, or the tempeh beans, pick a recipe on your phone, and the box holds the exact temperature, humidity and airflow until it is done. It heats and cools, which is the hard part. Kimchi, kombucha, miso, hot sauce, yogurt, sourdough starter, natto, the works.

### Six prototypes have run in Austin kitchens since March

Six hand-built prototypes have been running in Austin kitchens since March `[fact:prototypes_in_use]` (n=6). That shows the box runs in real kitchens, in other people's hands. It does not yet show how often it is used or how many batches succeed: that record is `[needs number]`.

### 312 people paid a $49 deposit after seeing the $299 price

By 8 November 2026, 312 people had paid a refundable $49 deposit for a box that is not on sale `[fact:deposits_paid]` `[fact:deposit_amount]`. That is $15,288 held in Stripe `[fact:deposits_collected]`, and 14.6% of 2,140 gross signups `[fact:signup_to_deposit_pct]` `[fact:waitlist_signups]`. Each of them saw the $299 price before paying (founder statement, 10 November 2026) `[assumption:deposit_price_shown]`. Four have asked for a refund so far (founder statement) `[assumption:deposit_refund_requests]`. A refundable deposit is intent at a stated price. It is not a sale.

### Most signups came from one Reddit post and one TikTok

About 1,400 of the signups came from one post in r/fermentation and one TikTok that did 900,000 views `[fact:signups_from_two_posts]` `[fact:tiktok_views]`. About 68% are in the US `[fact:waitlist_us_share_pct]`. Fermenters gather in places we can reach, and we have reached them twice. We have not yet shown a channel that repeats.

### We estimate $96 to build and $299 to sell

We estimate a bill of materials of $96 a unit at 1,000 units, from quotes by two Shenzhen contract manufacturers plus Digikey prices in October 2026 `[assumption:bom_unit_1000]`, and about $118 landed with shipping and duties `[assumption:landed_cost_unit]`. Against a target price of $299 `[assumption:target_price]`, we estimate about 60% gross margin sold direct `[assumption:hardware_gross_margin_pct]`. We estimate the bill of materials falls to about $78 at 5,000 units `[assumption:bom_unit_5000]`. The first production run is what proves these numbers.

### The box is the business; the $12 subscription is untested

The plan adds a recipe subscription at $12 a month `[assumption:subscription_price]`: guided ferments, with the box adjusting its program automatically. Nobody has been offered it. The deposits were for the box only, so there is no attach rate to quote.

### Market size: `[needs number]`, to be counted bottom-up

We have not counted the market and will not borrow a report number. The count we will build is households that ferment at home in the US, where most of our signups are, times the price of the box.

### $750,000 takes Hearthbox from prototype to 1,000 units shipped

We are raising $750,000 on a SAFE `[fact:ask]`. It pays for the injection mold tooling, UL and FCC certification, the first 1,000 units `[assumption:first_run_units]`, and 12 months of a team of three: Dev, a firmware engineer and a part-time industrial designer. The line-by-line budget is being rebuilt: `[needs number]`.

### First units ship in Q3 2027 if tooling and certification hold

If the round closes, the molds are cut, and UL and FCC pass, first units ship in Q3 2027 `[projection:ship_target]`. The weak point is plain: no unit has been manufactured. The Peltier module that heats and cools is noisy and power hungry; a compressor would be quieter but costs more and is bigger. That choice has to be settled before the molds are ordered.

### Besides money: people who have shipped a consumer appliance

The most useful angel for Hearthbox has taken a consumer appliance through tooling, certification and a first production run.

## 5. Variants

Spoken text carries no id tags. Every figure in it is in section 3 or 4 with its id.

### Two-sentence pitch

Hearthbox is building a countertop box that holds the exact temperature, humidity and airflow for home ferments for days or weeks: no exploding jars, no mold roulette. 312 people have paid a refundable $49 deposit after seeing the $299 price (8 November 2026).

Email Test status: not yet sent.

### 60-second verbal

I'm Dev Patel. I spent nine years as a hardware engineer at a thermostat company, and since March 2026 I have been full time on Hearthbox. Hearthbox is a countertop box that holds the exact temperature, humidity and airflow for home ferments, for days or weeks. Think of it like a sous-vide for fermentation: put in the vegetables, the milk or the dough, pick a recipe on your phone, and the box does the rest. No exploding jars, no mold roulette. I built six prototypes, and they have been running in Austin kitchens since March. The box is not on sale yet, and by 8 November 312 people had paid a refundable $49 deposit after seeing the $299 price. I am raising $750,000 to build the production tooling, pass UL and FCC, and ship the first 1,000 units, with first units targeted for Q3 2027.

### 3-minute demo day

--- slide: Hearthbox runs home ferments for you ---

I'm Dev Patel, and I am building Hearthbox. Hearthbox is a countertop box that holds the exact temperature, humidity and airflow for home ferments, for days or weeks. Think of it like a sous-vide for fermentation.

--- slide: Home fermenting fails in the kitchen ---

If you have ever tried to make kimchi or kombucha at home, you know how it goes. Exploding jars. Mold roulette. Standing over a jar asking "is this supposed to smell like this". A ferment needs the same conditions for weeks, and a kitchen counter does not give them. As we read the shelf today, you can buy a crock for about $30 or a lab incubator for about $4,000.

--- slide: Put the food in, pick a recipe ---

With Hearthbox you put in the vegetables, or the milk, or the dough, or the tempeh beans. You pick a recipe on your phone. The box heats, cools and holds the humidity until it is done. Kimchi, kombucha, miso, hot sauce, yogurt, sourdough starter, natto, the works.

--- slide: Built by a thermostat engineer, running in six kitchens ---

I spent nine years as a hardware engineer at a thermostat company. Temperature control is my trade. I have been full time on Hearthbox since March 2026, and I built six prototypes by hand. They have been running in Austin kitchens since March.

--- slide: 312 deposits after seeing the $299 price ---

The box is not on sale yet. By 8 November, 312 people had paid a refundable $49 deposit to get one, and every one of them saw the $299 price first. Four have asked for their money back. Most of them found us through one Reddit post and one TikTok. Two out of three are in the US.

[needs number: households that ferment at home in the US, times $299. Add one sentence here once it is counted.]

--- slide: We estimate $96 to build, $299 to sell ---

We estimate the box costs $96 to build at 1,000 units, from two contract manufacturer quotes, and about $118 landed. At $299 we estimate about 60% gross margin sold direct. A recipe subscription at $12 a month comes after the box, and it is not tested yet.

--- slide: $750,000 to ship the first 1,000 units ---

I am raising $750,000. It pays for the production molds, UL and FCC certification, the first 1,000 units, and a firmware engineer and an industrial designer alongside me. First units are targeted for Q3 2027.

So, three things to remember. A thermostat engineer built six working prototypes. 312 people paid a deposit after seeing the price. And $750,000 gets the first 1,000 boxes onto kitchen counters. If you have shipped a consumer appliance, I would like to talk to you tonight.

## 6. Founder voice notes

- Kept verbatim (README.md): "like a sous-vide for fermentation", "exploding jars", "mold roulette", "is this supposed to smell like this", "the works", the list of ferments.
- Kept verbatim (notes/bom-estimate.md): "the hard part", "noisy and power hungry".
- Rewritten: "the first countertop fermentation appliance that actually works for normal people" → the purpose sentence (nothing in the folder backs "first").
- Rewritten: "Fermentation is a $XXB trend" → "Market size: `[needs number]`, to be counted bottom-up" (placeholder, no figure in the folder).
- Rewritten: "the platform for home fermentation", like the coffee pod company → "The box is the business; the $12 subscription is untested" (no subscription data, and it invites "which one are you?").
- Cut: "people genuinely do not want to give them back" (no usage record yet) and the three fermenters (talking, none signed).
- "Two out of three are in the US" is the spoken form of "about 68%".
- "Temperature control is my trade" is my wording for nine years at a thermostat company. Replace it with what you actually built there.
- The last line of the demo-day pitch and vertebra 14 are a suggested ask for help, drawn from your open risks. Change them to what you actually want from angels.
