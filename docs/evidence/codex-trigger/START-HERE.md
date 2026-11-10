# Hearthbox: pitch start page

Generated 2026-11-10. Demand: November 8 (2026 inferred); costs: October 2026. Founder-only draft. [facts.yaml](facts.yaml) traces all figures.

## 1. Answer these first

1. **Which scope fixes the raise?** [ask.md](../notes/ask.md) says $750k or $1M; additional tooling is unpriced. *Used:* $750k provisionally. [fact:ask] [fact:ask_expanded]
2. **What do payment records verify?** Reconcile refunds and duplicates. *Used:* reported reservations; verified net deposits are [needs number]. [assumption:deposit_count]
3. **What have prototypes proved?** Need demo, batch results and repeat-use logs. *Used:* six reported Austin appliances; outcomes unmeasured. [assumption:prototype_count]
4. **Do price and costs hold?** Need price tests and full costs. *Used:* $299/$118 estimates; subscription unvalidated. [assumption:target_retail] [assumption:landed_unit] [fact:subscription_evidence]
5. **Who is the first investor, and where is the company incorporated?** *Used:* angels plus a pre-seed fund lead; US context provisional, incorporation unknown. [assumption:investor_profile]

## 2. Your pitch

**In two sentences:** Hearthbox is building a countertop fermentation appliance for home cooks, designed to hold the conditions a recipe needs. As of November 8, our notes report 312 refundable $49 deposits for the appliance. [fact:product_concept] [assumption:deposit_count] [fact:deposit_amount]

**In 60 seconds:** Hearthbox is building a countertop fermentation appliance for people who want to make kimchi, yogurt or sourdough at home. Think of it like sous-vide for fermentation: choose a recipe, put the ingredients in, and let the box manage the conditions. That's the experience we're building toward. Our notes report six hand-built prototypes in Austin kitchens and, as of November 8, 312 refundable deposits of $49 each for the appliance. Those deposits show early interest; we still need to verify them and measure how often people use the product. We plan to sell the box directly, with an optional recipe subscription that still needs testing. Our working raise is $750k to fund production tooling and an initial manufacturing run. The next proof is a reliable product people use repeatedly and buy at full price.

Sources: [fact:product_concept] [assumption:prototype_count] [assumption:deposit_count] [fact:deposit_amount] [fact:subscription_evidence] [assumption:investor_profile] [fact:ask] [projection:initial_batch]. Confirm demonstrated capabilities before describing recipe automation as working.

## 3. The numbers that matter

All are reported or estimated, not verified operating traction.

| Number | Value | Kind | Source |
|---|---|---|---|
| Reservations, November snapshot | Reported 312 refundable deposits, $49 each | Assumption; amount unverified fact | [waitlist](../notes/waitlist.txt), [assumption:deposit_count] [fact:deposit_amount] |
| Kitchen prototypes | Reported six Austin appliances | Assumption | [overview](../README.md), [assumption:prototype_count] |
| Proposed price / landed cost | $299 / $118 | Assumption | [BOM](../notes/bom-estimate.md), [assumption:target_retail] [assumption:landed_unit] |
| Illustrative margin | 60.5%, before unmodeled costs | Assumption | [BOM](../notes/bom-estimate.md), [assumption:hardware_margin] |
| Rough budget | $636k named; $114k unallocated before shipping/buffer | Assumption | [ask](../notes/ask.md), [assumption:named_budget_subtotal] [assumption:base_unallocated] |

**Do not use yet:** deposits as revenue, proven retention/acquisition, subscription adoption/margin, market size, “first,” crock-or-lab-only competition, or blanket failure prevention. Need transaction, usage, subscription, competitor and test evidence. [assumption:deposit_funds] [fact:subscription_evidence] [fact:market_positioning]

## 4. The five questions you are least ready for

**Will people pay full price?** Tests purchase intent. “We report $15,288 in refundable deposits, pending reconciliation. Full-price demand is unproven.” Have ready: payments/refunds and price test. [assumption:deposit_funds] [assumption:target_retail]

**Does it work reliably at home?** Tests product evidence. “We report six kitchen prototypes. Batch success and repeat use need measurement in the next pilot.” Have ready: demo and logs. [assumption:prototype_count]

**Does hardware work financially alone?** Tests subsidy risk. “Estimated price and landed cost imply 60.5% before unmodeled costs. The proposed $12/month subscription is untested.” Have ready: quotes and complete costs. [assumption:hardware_margin] [assumption:subscription_price] [fact:subscription_evidence]

**What does this round deliver?** Tests execution. “We target an initial 1,000-unit run and first shipments in Q3 2027. Budget, schedule and operations cofounder commitment remain provisional.” Have ready: scoped budget, owners and production plan. [projection:initial_batch] [projection:ship_target] [fact:team_status]

**Why this over alternatives?** Tests customer insight. “The 'first' claim is unsubstantiated. We need evidence for choosing this over existing setups.” Have ready: interviews and researched comparisons. [fact:market_positioning]

## 5. Top three red flags

- **Unresolved raise (critical, open).** Alternate asks signal unclear scope. Fix: one scoped budget tied to deliverables. [fact:ask] [fact:ask_expanded] [assumption:named_budget_subtotal]
- **Notes-only evidence (major, open).** Unverified deposits and prototypes impede diligence. Fix: payment reconciliation, demo and outcome logs. [assumption:deposit_count] [assumption:prototype_count]
- **Untested economics (major, open).** Estimates expose cost/subscription risk. Fix: complete costs and separate paid demand tests. [assumption:landed_unit] [fact:subscription_evidence]

## 6. Kept out of investor material

No confidential files flagged. Excluded: valuation terms and prospective teammate identity/employer in [ask.md](../notes/ask.md); founder email in [README.md](../README.md). Intake retains sensitive source passages: keep it private.

## 7. Next

Resolve the questions, then update the ledger. Next options: narrative, full Q&A, HTML/PDF/PowerPoint deck, meeting preparation. More evidence needs: [gaps.md](gaps.md).

## Files

- [START-HERE.md](START-HERE.md)
- [facts.yaml](facts.yaml)
- [gaps.md](gaps.md)
- [run-log.md](run-log.md)
- [intake/inventory.json](intake/inventory.json)
- [intake/corpus/INDEX.md](intake/corpus/INDEX.md)
- [intake/corpus/README.md.md](intake/corpus/README.md.md)
- [intake/corpus/notes__ask.md.md](intake/corpus/notes__ask.md.md)
- [intake/corpus/notes__bom-estimate.md.md](intake/corpus/notes__bom-estimate.md.md)
- [intake/corpus/notes__waitlist.txt.md](intake/corpus/notes__waitlist.txt.md)
