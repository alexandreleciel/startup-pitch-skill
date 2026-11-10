# Kestrel Health: pitch start page

Generated 2026-11-10. Numbers as of 2026-09-30 (the weekly export runs to 1 November 2026). Every figure traces to pitch/facts.yaml.

## 1. Answer these first

1. **Was Q3 2026 GMV £1.90M or £1.73M?** The board update and your memo say £1.90M, up 31% on Q2 `[fact:gmv_q3_board]` `[fact:gmv_qoq_growth_board]`. The weekly export (data/kpis-weekly.csv) sums to £1.73M, up 17% `[fact:gmv_current]` `[fact:gmv_qoq_growth]`. Net revenue follows: £418k or £381k `[fact:net_revenue_board]` `[fact:net_revenue]`.
   *Used until you answer:* £1.73M and 17%, with the export's 52-week total as the headline.
2. **How many employers have 250+ staff, and how many employers left in the last 12 months?** The unit economics sheet says 14 enterprise accounts `[fact:enterprise_accounts_xlsx]`; the cohort file counts 24 `[fact:enterprise_accounts_cohort]`. Your memo says 7 lost `[fact:employers_lost_12m]`; the cohort file shows 6 `[fact:employers_lost_12m_cohort]`.
   *Used until you answer:* 14 as the sample behind "no enterprise employer lost", and 7 lost, as counts with no churn percentage.
3. **Is the 118% net revenue retention for all employers or enterprise only, and what is gross retention?** The sheet and the board update say all employers `[fact:nrr_ttm]`; your memo says "the enterprise cohort". No file gives gross retention.
   *Used until you answer:* 118%, all employers, 12 months to September 2026. Gross retention: `[needs number]`.
4. **Which market number will you defend?** The 2026 refresh says £11B across six markets `[assumption:tam]`. Its own caveats put the like-for-like UK figure at about £0.9B `[assumption:market_uk_2026]`, below the £4.2B in the 2024 seed deck `[assumption:market_uk_2024_deck]`.
   *Used until you answer:* the £1.1B serviceable estimate (UK, Netherlands, Ireland, employers with 250+ staff) with its method `[assumption:sam]`. The £11B is not used.
5. **What does £9.5M buy that you would not reach anyway?** The milestone is a £10M GMV run-rate by end of 2027 `[projection:milestone_gmv_run_rate]`. Q3 already annualises to £6.9M `[fact:gmv_run_rate]`, so the target sits inside the current trajectory. The folder has no financial model.
   *Used until you answer:* the milestone as stated, flagged. GMV, net revenue and burn by quarter to end of 2027: `[needs number]`.

More open items (total raised to date, naming the whitepaper employer, sources for NHS waiting times) are in [gaps.md](gaps.md).

## 2. Your pitch

**In two sentences:** Kestrel Health sells employers fast physiotherapy for their staff, booked into the empty weekday slots of 312 independent clinics `[fact:active_clinics]`. Bookings were £5.8M in the 52 weeks to 1 November 2026 `[fact:gmv_ttm]`, and Kestrel keeps 22% of each one `[fact:take_rate]`.

**In 60 seconds:** Kestrel Health sells employers fast physiotherapy for their staff, booked into the empty weekday slots of independent clinics. A warehouse worker with a bad back waits `[needs number: current NHS physiotherapy wait, with a public source]` for treatment, and the employer pays for the absence either way. Through Kestrel, the first appointment at one logistics employer came in 2.3 days on average, across 212 employees `[fact:days_to_first_appointment]`. Clinics fill slots that would otherwise sit empty, and we keep 22% of each booking `[fact:take_rate]`. At the end of September 2026, 41 employers and 312 clinics were active `[fact:active_employers]` `[fact:active_clinics]`. Bookings were £5.8M over the last 52 weeks `[fact:gmv_ttm]`, and October's were 1.9 times those of last November `[fact:gmv_12m_multiple]`. Employers as a group spent 118% of what they spent a year earlier `[fact:nrr_ttm]`. We are raising £9.5M `[fact:ask]` to take bookings to a £10M annual run-rate `[projection:milestone_gmv_run_rate]` and open our first market outside the UK.

## 3. The numbers that matter

| Number | Value | Kind | Source |
|---|---|---|---|
| GMV, 52 weeks to 1 November 2026 `[fact:gmv_ttm]` | £5.81M | fact | data/kpis-weekly.csv |
| GMV, four weeks to 1 November 2026 against four weeks to 30 November 2025 `[fact:gmv_12m_multiple]` | 1.9x | fact | data/kpis-weekly.csv |
| Net revenue retention, all employers, 12 months to September 2026 `[fact:nrr_ttm]` | 118% | fact | data/unit-economics.xlsx |
| Gross margin on net revenue, Q3 2026 `[fact:gross_margin]` | 61% | fact | data/unit-economics.xlsx |
| CAC payback, blended (the weak one; your target was 6) `[fact:cac_payback_blended_months]` | 9 months | fact | data/unit-economics.xlsx |

Q3 GMV and net revenue are in conflict (question 1) and wait for your answer.

**Do not use yet:**
- "£1.9M quarterly GMV, growing 30%+ QoQ" (memo). Needs: finance's reconciliation of the board figure to the weekly export.
- "The enterprise cohort is retaining at 118%" (memo). Needs: retention split by segment, net and gross.
- "34% fewer sick days" as a general result `[fact:sick_days_reduction]`. One employer, 212 self-selected employees against their own previous year, no control group. Use it only with that caveat. Needs: the controlled study planned for 2027.
- "£11B market" `[assumption:tam]`. Most of it is prevention fees and occupational health, where you earn almost nothing today. Needs: revenue from those layers.
- The SMB churn percentage and the enterprise LTV to CAC ratio in the unit economics sheet. Needs: the employer list by segment with start and end dates.
- Utilisation against an "industry benchmark", NHS waiting times, and the network-wide median time to first session. Needs: a named public source with its year, and a booking export.

## 4. The five questions you are least ready for

**"Your board update says £1.9M for Q3 and your export adds up to £1.73M. Which is it?"** Why they ask: one mismatch makes every other number suspect. Your strongest honest answer: The export sums to £1.73M `[fact:gmv_current]` and the board update says £1.9M `[fact:gmv_q3_board]`; we are reconciling them and use the lower figure until then. Over 52 weeks the export shows £5.81M `[fact:gmv_ttm]`. Have ready: finance's reconciliation, by week.

**"What is your churn, and what is gross retention?"** Why they ask: retention above 100% can hide lost customers. Your strongest honest answer: We lost 7 employers in 12 months, all under 200 employees `[fact:employers_lost_12m]`, and none of our 14 employers with 250+ staff in two years `[fact:enterprise_accounts_xlsx]`. Net retention is 118% `[fact:nrr_ttm]`; gross retention is not split out yet `[needs number]`. We stopped selling to employers under 250 staff from Q4 2026. Have ready: the cohort table and the employer list by segment.

**"How much of the 34% would survive a control group?"** Why they ask: outcomes turn a benefit into a budget line, and this is one before-and-after study. Your strongest honest answer: We do not know yet. It is one employer, 212 employees who chose the pathway, against their own previous year `[fact:sick_days_reduction]`. A controlled evaluation with an independent academic partner is planned for 2027. Have ready: the whitepaper's limitations section and the study design.

**"Your top five employers are 58% of GMV. What if the largest leaves?"** Why they ask: revenue quality. Your strongest honest answer: The top five are 58% of GMV `[fact:top5_gmv_share]`. The largest employer's share and contract end date: `[needs number]`. No employer with 250+ staff has left in two years, on a sample of 14 `[fact:enterprise_accounts_xlsx]`; that is a short record. Have ready: GMV by employer with contract dates.

**"You are at a £6.9M run-rate. Why does £9.5M only get you to £10M by the end of 2027?"** Why they ask: a milestone inside the current trajectory reads as caution or an expected slowdown. Your strongest honest answer: Q3 annualises to £6.9M `[fact:gmv_run_rate]` and grew 17% on Q2 `[fact:gmv_qoq_growth]`, so the £10M target `[projection:milestone_gmv_run_rate]` needs restating. Plan by quarter: `[needs number]`. This answer stays weak until the model exists. Have ready: the model, with its two or three drivers named.

## 5. Top three red flags

**Q3 GMV and growth differ between the board update and the weekly export** (critical). What an investor reads into it: "Which one is true, and do they know their own business?" Fix: reconcile before anything is sent; one figure everywhere, the lower one until then.

**8.8 months of cash at the end of September, with burn rising each quarter** `[fact:runway_months]` `[fact:cash]` `[fact:net_burn]` (major). What an investor reads into it: the company has to close, so time is on the investor's side. Fix: state the runway and the target close date plainly, and have a lower-burn case ready.

**The market headline went from £4.2B to £11B since the seed deck while the like-for-like UK figure fell to £0.9B** `[assumption:market_uk_2024_deck]` `[assumption:tam]` `[assumption:market_uk_2026]` (major). What an investor reads into it: the headline is built from layers the company does not earn from. Fix: lead with the £1.1B serviceable estimate and its three inputs, each sourced and dated `[assumption:sam]`.

## 6. Kept out of investor material

- **Not read (confidential, for the data room):** hr/salaries.xlsx, legal/round-terms-draft.md.
- **Read, held back:** the pre-money and the name of the fund you are in discussion with (docs/board-update-2026-Q3.md, notes/founder-perspective.md); names of existing investors and board members, and the advisor's equity (team/team.md, notes/investor-feedback-from-seed.md); clinic payout terms; employee names and references to pay (docs/board-update-2026-Q2-draft.md, data/unit-economics.xlsx); what funds said during the seed (used only to prepare your answers).
- **Held until you confirm:** the whitepaper employer's name. The pitch says "one logistics employer".
- Your list "Things I do not want in the deck" (notes/founder-perspective.md) is applied in full.

## 7. Next

Ask for any of: the full narrative, the full investor Q&A, a deck (HTML, PDF, PowerPoint), preparation for a specific investor type.

## Files

- [START-HERE.md](START-HERE.md)
- [facts.yaml](facts.yaml)
- [gaps.md](gaps.md)
- [run-log.md](run-log.md)
- [intake/inventory.json](intake/inventory.json), [intake/corpus/INDEX.md](intake/corpus/INDEX.md)
