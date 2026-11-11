# Kestrel Health: pitch start page

Generated 2026-11-10, updated the same day with your answers. Series A deck rebuilt 2026-11-11 with an editable PowerPoint. Numbers as of 2026-09-30. Every figure traces to pitch/facts.yaml.

## 1. Answer these first

1. **Why is the weekly export higher than finance in Q1 and Q2?** Missed manual invoices explain Q3, where the export is lower. In Q2 it is higher: £1.48M against finance's £1.45M `[fact:gmv_q2_export]` `[fact:gmv_q2_finance]`, and Q1 runs the same way. Month-end employer and clinic counts differ too.
   *Used until you answer:* finance figures throughout, labelled as such.
2. **What does £9.5M buy that you would not reach anyway?** (You left this open.) Q3 annualises to £7.6M `[fact:gmv_run_rate]`; the milestone is £10M by end of 2027 `[projection:milestone_gmv_run_rate]`.
   *Used until you answer:* the milestone as stated. The ask slide (19) shows runway as `[needs number]`, the closing slide (20) needs a contact line, and the deck has no financials slide.
3. **How much have you raised in total?** The seed size in your seed notes is smaller than the cash the board update shows almost two years later.
   *Used until you answer:* no funding history or capital-efficiency line anywhere.
4. **May investor material name the whitepaper employer?**
   *Used until you answer:* "one logistics employer".
5. **What is the public source and year for the 14-week NHS wait?** `[assumption:nhs_wait_weeks]`
   *Used until you answer:* shown as "our estimate" on the problem and competition slides.

More open items are in [gaps.md](gaps.md).

## 2. Your pitch

**In two sentences:** Kestrel Health sells employers fast physiotherapy for their staff, booked into the empty weekday slots of 312 independent clinics. Bookings reached £1.9M in Q3 2026, up 31% on Q2, and Kestrel keeps 22% of each one.

**In 60 seconds:** Kestrel Health sells employers fast physiotherapy for their staff, booked into the empty weekday slots of independent clinics. An employee with a back injury waits about 14 weeks for NHS physiotherapy, by our estimate, and the employer pays for the absence either way. At one logistics employer, the wait for a first appointment fell from 19 days to 2.3 days with Kestrel, across 212 employees. Clinics fill slots that would otherwise sit empty, and we keep 22% of each booking. At the end of September 2026, 41 employers and 312 clinics were active. Bookings reached £1.9M in the third quarter, up 31% on the second, and employers as a group spent 118% of what they spent a year earlier. We are raising £9.5M to take bookings to a £10M annual run-rate, reach 120 employers and open our first market outside the UK.

## 3. The numbers that matter

| Number | Value | Kind | Source |
|---|---|---|---|
| GMV, Q3 2026, finance figure `[fact:gmv_current]` | £1.90M | fact | docs/board-update-2026-Q3.md, confirmed by you |
| GMV growth, Q2 to Q3 2026, finance figures (Q2 base being reconciled) `[fact:gmv_qoq_growth]` | 31% | fact | docs/board-update-2026-Q3.md |
| Net revenue retention, all employers, 12 months to September 2026 `[fact:nrr_ttm]` | 118% | fact | data/unit-economics.xlsx |
| Gross margin on net revenue, Q3 2026 `[fact:gross_margin]` | 61% | fact | data/unit-economics.xlsx |
| CAC payback, blended (the weak one; your target was 6) `[fact:cac_payback_blended_months]` | 9 months | fact | data/unit-economics.xlsx |

**Do not use yet:**
- "Growing 30%+ QoQ" as a trend: Q2 grew 23% (1.45M over 1.18M) `[fact:gmv_quarterly_series]`. Needs: more quarters from finance.
- "34% fewer sick days" as a general result `[fact:sick_days_reduction]`: one employer, no control group. Needs: the 2027 study.
- "£11B market" `[assumption:tam]`. Needs: revenue from the prevention and occupational health layers.
- The SMB churn percentage, enterprise LTV to CAC, the utilisation benchmark, the network-wide median wait. Needs: an employer list by segment, public sources, a booking export.

## 4. The five questions you are least ready for

**"What is your gross retention?"** Why they ask: net retention can hide lost customers. Your strongest honest answer: Not measured yet. Net retention is 118% across all employers `[fact:nrr_ttm]`. We lost 7 employers in 12 months, all under 200 employees `[fact:employers_lost_12m]`, and none of 14 enterprise employers in two years `[fact:enterprise_accounts]`. Have ready: the date of the first gross figure `[needs detail]`.

**"You are at a £7.6M run-rate. Why only £10M by end of 2027?"** Why they ask: a milestone inside the trajectory reads as an expected slowdown. Your strongest honest answer: Q3 annualises to £7.6M `[fact:gmv_run_rate]` and grew 31% on Q2 `[fact:gmv_qoq_growth]`, so the target `[projection:milestone_gmv_run_rate]` needs restating. Plan by quarter: `[needs number]`. Have ready: the model.

**"Your export and finance disagree. Which is the system of record?"** Why they ask: one mismatch makes every number suspect. Your strongest honest answer: Finance. Q3 GMV was £1.9M `[fact:gmv_current]`; the export shows £1.73M `[fact:gmv_q3_export]` because it misses manually invoiced enterprise bookings. Q1 and Q2: `[needs detail]`. Have ready: a reconciliation by quarter.

**"How much of the 34% would survive a control group?"** Why they ask: outcomes turn a benefit into a budget line. Your strongest honest answer: We do not know yet. It is one employer, 212 employees who chose the pathway, against their own previous year `[fact:sick_days_reduction]`. A controlled evaluation is planned for 2027. Have ready: the whitepaper's limitations.

**"Your top five employers are 58% of GMV. What if the largest leaves?"** Why they ask: revenue quality. Your strongest honest answer: The top five are 58% `[fact:top5_gmv_share]`. Largest employer's share and contract end: `[needs number]`. No enterprise employer has left in two years, on a sample of 14 `[fact:enterprise_accounts]`. Have ready: GMV by employer.

## 5. Top three red flags

**Finance and the weekly export disagree in every quarter of 2026** (critical). What an investor reads into it: "Which one is true?" Fix: a reconciliation by quarter, and a corrected cohort file, before the data room opens.

**No financial model, and a milestone inside the current trajectory** (major). What an investor reads into it: the ask is not tied to a plan. Fix: build the model, restate the milestone, fill the runway slot before sending.

**8.8 months of cash at the end of September** `[fact:runway_months]`: £1.9M `[fact:cash]` at £215k monthly net burn `[fact:net_burn]` (major). What an investor reads into it: the company has to close. Fix: state runway and close date plainly.

## 6. Kept out of investor material

- **Not read (confidential):** hr/salaries.xlsx, legal/round-terms-draft.md.
- **Read, held back:** the pre-money and the name of the fund in discussion (board update Q3, founder memo); existing investor and board names and the advisor's equity (team/team.md, seed feedback notes); clinic payout terms; references to pay.
- **Held until you approve:** the whitepaper employer's name; the channel mix and pipeline figures in notes/investor-feedback-from-seed.md.
- Your list "Things I do not want in the deck" is applied in full.

## 7. Next

Ask for any of: the full narrative, the full investor Q&A, preparation for a specific investor type, the presenting variant of the deck.

## Files

- [START-HERE.md](START-HERE.md), [facts.yaml](facts.yaml), [gaps.md](gaps.md), [run-log.md](run-log.md)
- [deck/deck.pdf](deck/deck.pdf) (send this), [deck/deck.pptx](deck/deck.pptx) (editable PowerPoint: native text and charts, standard fonts), [deck/deck.html](deck/deck.html) (present from this), [deck/deck.json](deck/deck.json) (the source; rebuild from it), [deck/qa/](deck/qa/)
- [intake/inventory.json](intake/inventory.json), [intake/corpus/INDEX.md](intake/corpus/INDEX.md)
