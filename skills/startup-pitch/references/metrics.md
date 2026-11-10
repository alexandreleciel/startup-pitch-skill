# Metrics: define, check, present honestly

What this file is for: how to define each number so it survives diligence, the arithmetic the ledger must satisfy, the maturity ladder, and the rules for putting numbers on slides without misleading anyone.
Read it when you build or audit `facts.yaml` beyond a quick run, when a founder file uses a term loosely (ARR, users, CAC, TAM), when you pick the headline numbers for the traction slide, or before drawing any chart.
The metric set for one business model is in `metrics-by-model.md` (read only that model's block); stage benchmarks with source and vintage are in `benchmarks.md`; a quick run needs only `core.md`.

## Contents

1. Definitions and the misuses investors catch
2. Consistency checks the ledger must pass (what `ledger_check.py` automates)
3. The maturity ladder and the "more maturity than evidence" failure
4. Chart honesty rules
5. Picking the 3 to 5 headline numbers per stage
6. Metric entries in facts.yaml, with a worked example

Vocabulary used throughout: **fact** (in a file or verifiable record), **assumption** (a founder belief or estimate), **projection** (a forward-looking model output). See file-formats.md. A benchmark is never a fact about the company; it is context, and it is cited with its source and year every time.

## 1. Definitions and the misuses investors catch

The canonical list is a16z's "16 Startup Metrics" and "16 More Startup Metrics" (Jordan, Hariharan, Chen, Kasireddy, 2015; historical for any numbers, still the standard for definitions). Define every term the first time it appears in the ledger and use that definition everywhere: deck, narrative, Q&A, model.

| Term pair | Correct definition | The misuse, and what to do in the ledger |
|---|---|---|
| Bookings vs revenue | Bookings: value of a signed contractual commitment. Revenue: recognised as the service is delivered. LOIs and verbal yeses are neither. | Founders show bookings as revenue. Record both as separate ids (`bookings_q3`, `revenue_q3`); never let a bookings number sit under a "Revenue" heading. |
| ARR vs MRR vs run-rate | MRR: recurring subscription revenue in one month, excluding one-time fees, services and non-contracted usage. ARR = MRR x 12. "Run-rate" is any monthly figure x 12 and is not ARR unless the revenue is recurring. | "ARR" computed from a month that includes setup fees, hardware or a one-off project. Strip non-recurring items, then derive ARR with `derived_from: mrr_current * 12`. If the founder's figure is total revenue x 12, label it `revenue_run_rate`, not `arr`. |
| TCV vs ACV | TCV: whole-contract value across its term, including one-time and services. ACV: contract value normalised to 12 months. | A 5-year, 5M contract shown as "5M ARR". Record `tcv` and `acv` separately; the deck says "1M ARR contract, 5-year term". |
| GMV vs net revenue | GMV: total value transacted through a marketplace. Net revenue: what the company keeps (take rate x GMV plus fees). | GMV presented as revenue, or growth quoted on GMV while margins are quoted on net revenue. Ledger holds `gmv`, `take_rate`, `net_revenue`, with `net_revenue` derived. |
| Gross vs net churn | Gross revenue churn: MRR lost (cancellations plus downgrades) / opening MRR. Net churn: the same minus expansion MRR from existing customers. Logo churn: customers lost / opening customers. | Quoting net churn (or "negative churn") to hide gross losses, or annual churn to make a monthly number look small. Record `churn_gross_monthly`, `churn_net_monthly`, `churn_logo_monthly` as three ids; the deck shows gross and net side by side. |
| Users vs MAU vs paying | Registered users: cumulative sign-ups ever. Active users: meet a stated "active" definition (which action, which window, which deduplication). Paying: active and billed in the period. | "50,000 users" when 50,000 ever signed up and 1,900 pay. Every user id carries its definition in `note` (`active = completed >=1 session of >=3 s in trailing 30 days`). One definition per product, never mixed across slides. Downloads and registered counts are vanity context only; the headline is engagement or revenue. |
| Blended vs paid CAC | Paid CAC: acquisition spend / customers acquired through paid channels, including referral fees, credits and discounts. Blended CAC: total acquisition spend / all new customers, organic included. | Blended CAC presented as the CAC that scales with spend. Record both; LTV:CAC and payback use paid CAC unless the deck says "blended". |
| LTV | Present value of the net contribution a customer produces over their life. Simple form: ARPU x gross margin x average lifetime, where lifetime = 1 / monthly churn. With under 12 months of data, show 12- and 24-month realised value instead of an infinite-horizon LTV. | LTV built on revenue rather than gross margin, or on churn measured over three months. The ledger stores the inputs (`arpu`, `gross_margin`, `churn_gross_monthly`) and derives LTV so the checker can recompute it. |
| MoM growth vs CMGR | CMGR (compound monthly growth rate) = (latest month / first month)^(1 / months) minus 1. | Averaging monthly growth percentages, which overstates growth. Quote CMGR for any window longer than three months and state the window. |
| Gross vs net burn | Gross burn: cash out per month. Net burn: cash out minus cash in. Runway = cash / net burn. | Runway computed on gross burn (too short) or on a projected future burn (too long). Ledger: `cash_balance`, `net_burn_monthly`, `runway_months` derived. |
| Deferred revenue and billings | Deferred revenue: cash collected before recognition. Billings: revenue plus change in deferred revenue. | Revenue looks flat while the company works off a backlog; billings reveals it. Record billings when annual prepay is common. |
| Cumulative vs incremental | A cumulative series only ever rises, even in a shrinking business. Incremental (per period) shows the direction. | "Total customers" chart with no new-customers-per-month beside it. Store the per-period series; the chart rule is in section 4. |
| Customer concentration | Revenue from top 1, top 5 and top 10 customers / total revenue. | Hidden until diligence. Record `concentration_top1`, `concentration_top5`; the narrative addresses it when top 1 is material. |

Two general rules from the same source: define "active" and "gross profit" explicitly because companies differ in what they include; and investors read size first (revenue, GMV, bookings), then growth, as a health check, so the deck must make both findable in seconds.

## 2. Consistency checks the ledger must pass

`scripts/ledger_check.py` recomputes every `derived_from` expression and runs the identities below over `facts.yaml`. The idea of a deterministic cross-slide numeric check comes from romankurnovskii `score_deck.py` (`check_consistency` over labels such as ARR, MRR, TAM, SAM, SOM, round size, valuation); the ledger version checks the arithmetic itself, not just repeated labels. Default tolerance is 1 percent relative unless stated. A failure never gets "fixed" by changing a number; it produces a question in `gaps.md` and, until answered, the narrative uses the conservative value.

1. **ARR = MRR x 12.** Tolerance 1 percent. On failure: "Which figure is current, and does the ARR include non-recurring lines?"
2. **Net revenue = GMV x take rate** (marketplaces, payments). Tolerance 2 percent (rounding of blended take rate). On failure: "Is the take rate blended across all revenue streams, and is GMV net of cancellations and refunds?"
3. **Runway = cash / net burn.** Tolerance 0.5 month. On failure: "Is the burn figure gross or net, and is it the trailing 3-month average or a budgeted future number?"
4. **Growth multiple = latest / earliest** for any "grew Nx" claim, with both endpoints and dates on record (ledger entries when an output cites them, otherwise literals in `derived_from` with the dates in `window`); CMGR = (latest / earliest)^(1/months) minus 1. Tolerance 1 percent on the multiple, 0.5 percentage point on CMGR. On failure: "Which two months does the Nx compare, and are both from the same export?"
5. **CAC payback = CAC / (ACV x gross margin / 12)** in months (equivalently CAC / (monthly revenue per customer x gross margin)). Tolerance 0.5 month. On failure: "Is the CAC paid or blended, and is the margin gross margin or contribution margin?"
6. **LTV consistency: LTV = ARPU x gross margin / monthly gross churn**, and LTV:CAC = LTV / CAC. Tolerance 2 percent. Flag separately when churn is measured over fewer than 6 months or the implied lifetime exceeds 5 years. On failure: "Which churn and which margin went into the LTV, and over what window was churn measured?"
7. **Gross churn >= net churn; GRR <= 100 percent; GRR <= NRR.** Hard check, no tolerance (NRR may sit below 100 percent, but never below GRR). On failure: "Are gross and net defined as in section 1, and are both measured on the same cohort and period?"
8. **Headcount x average fully loaded cost + non-people costs ≈ gross burn.** Tolerance 15 percent (contractors, timing). On failure: "What does the headcount include (contractors, founders without salary), and what are the non-people lines?"
9. **Use of funds sums to the ask.** Tolerance 1 percent; percentages sum to 100. On failure: "Is the contingency inside the stated lines or on top of the ask?"
10. **Ask / net burn over the plan ≈ runway stated**, and runway reaches the stated milestone date plus at least 6 months to raise (`benchmarks.md` section 3 for why). Tolerance 1 month. On failure: "Does the plan's burn step up with hires, and is that reflected in the runway claim?"
11. **TAM >= SAM >= SOM, and SOM <= revenue projection at the horizon.** Hard check. Bottom-up SAM = customer count x price, both with sources. On failure: "Which customer count and which price produce the SAM, and is the price the company's own or a competitor's?"
12. **Cohort retention vs claimed churn.** Implied monthly churn from a 12-month cohort (1 minus month-12 retention)^(1/12) must match claimed monthly logo churn within 1 percentage point. On failure: "Is the churn claim from the same cohort basis, or a single good month?"
13. **Customer count x ARPU (or ACV / 12) ≈ MRR.** Tolerance 5 percent (mix). On failure: "Does the customer count include free, trial or churned accounts?"
14. **Revenue in the narrative = revenue in the model = revenue in the data export for the same month.** Tolerance 1 percent; every mismatch becomes a `status: conflicting` pair. On failure: "Which file is the system of record?"
15. **Projection anchors to facts.** The first projected month must equal (within 2 percent) the last actual month in the ledger; growth in the first 6 projected months may not exceed the best trailing 6-month CMGR actually achieved unless an `assumes:` entry names the driver. On failure: "What changes at the round close that makes growth jump?"
16. **Units and currency match across an identity.** EUR vs USD, monthly vs annual, thousands vs units. Hard check on the `unit` field. On failure: "Which currency does the deck use, and at what rate were the others converted?"
17. **Dates.** `as_of` for every metric fact is within 90 days of the ledger `as_of`, or the entry is marked stale and the narrative says "as of <date>". On failure: "Is a fresher export available?"

Output format the checker writes to `gaps.md` for each failure (the model uses the same when running checks by hand):

```
- [ ] CHECK 05 CAC payback: ledger says 9 months; recomputed 14.2 months from cac_paid (3,400) / (acv (4,800) x gross_margin (0.72) / 12).
      Sources: data/unit-economics.xlsx#Summary!C9 vs derived. Question: is the 9-month figure on blended CAC or on contribution margin?
```

## 3. The maturity ladder and the "more maturity than evidence" failure

Round names describe money, not maturity. Casado's ladder (a16z, 2018, historical) replaces them with four evidence stages; present only the evidence class of the stage the company has actually reached.

| Stage | What investors need to see | Evidence that counts | What does not count |
|---|---|---|---|
| Team | Founder-market fit; a sharp view of the problem | Long-form founder background tied to the problem; market understanding | Product claims, logos of "conversations" |
| Product | Product-market fit shown by market behaviour | Production deployments; engagements with real decision makers; customers building internal projects that mirror the product | Potential-customer quotes; exploratory PoCs, OEM talks, services work and one-offs dressed as PMF |
| Repeatable sale | The sale repeats across similar buyers and use cases | Consistent buyer profile, consistent use case, growing pipeline, sales-cycle length that investors can confirm by calling customers | An early burst from accounts worked since day one, with no pipeline behind it |
| Unit economics | A path to attractive margins | ACV, CAC, net dollar retention; in enterprise, the real effort to sell and implement, since gross margin is hard to measure early | A model that assumes margins the company has not shown |

The governing failure is signalling more maturity than the evidence supports: raising to "scale sales" with a vision slide where PMF evidence should be. A company is rarely less mature than its age and funding suggest, so hiding a pivot or slow market readiness only moves the discovery to diligence, where it costs trust (Casado, 2018). In the ledger this means: the stage declared in the narrative is itself an entry (`kind: assumption`, with the evidence ids it rests on), and the traction slide uses only metrics from that stage or below.

Pre-revenue proof stack, strongest to weakest (pedronauck proof-slides synthesis, 2025, drawing on Friedman/YC and Casado): paid pilots; production deployments with real decision makers; named design partners with success criteria; LOIs with scope and price; confirmed willingness to pay at the stated price; a qualified and segmented waitlist; engagement depth on a free or open-source product; beta feedback tied to the claimed pain; discovery-interview counts with hit rate; smoke-test conversion. Record each item as a fact with its counterparty and date; a count without a list behind it is an assumption.

## 4. Chart honesty rules

Each rule is enforced on the chart data in `deck.json`, not on the picture; deck-structure.md documents the chart fields and design.md the styling.

1. **Y-axis starts at zero** for any bar or area chart and for line charts of levels (revenue, users). Truncating the axis exaggerates change (a16z, 2015, historical, "please do not do this"). Exception: rates on a bounded scale (retention 0 to 100 percent) may use the full bounded range.
2. **Incremental beside cumulative.** A cumulative series (total customers, total revenue to date, total signups) may appear only with the per-period series next to it or overlaid, because a cumulative line rises even while the business shrinks (a16z, 2015; YC Series A Guide, 2020, historical). The checker flags any `chart.kind = "cumulative"` or a monotonically non-decreasing series without a sibling incremental series.
3. **Single axis.** No dual y-axes; two metrics with different units get two small charts. A second axis lets the eye infer a relationship the data does not show (YC Series A Guide, 2020, historical, via the landscape report).
4. **Label units, currency and dates on every axis and every stat tile.** "41" means nothing; "EUR 41k MRR, Oct 2026" does. Every chart carries `y_label` and dated `labels`.
5. **Show n for small samples.** Any rate (conversion, retention, NPS) from fewer than 100 observations prints "n = 37" beside it; NPS additionally states who was surveyed, since surveying only engaged users biases the score (a16z, 2015, historical).
6. **No truncated time windows.** A growth chart starts at the first month the metric existed or at a stated, justified start (launch, pivot) and runs to the latest full month; it never starts at a dip to flatter the slope. Trend claims need at least 4 to 6 months of history (YC Series A Guide, 2020, historical, via pedronauck); cohort claims need about 12 months (Jarvis, via pedronauck, undated).
7. **Percentages carry absolutes.** "300 percent growth" shows the two underlying numbers; growth off a tiny base is stated as such (a16z, 2015, historical).
8. **Consistent intervals.** Monthly series are monthly throughout; no switching to quarterly where the monthly numbers dipped.
9. **One definition per metric per deck.** The chart's series name matches the ledger label exactly, and the `source: fact:<id>` on every chart and stat tile resolves.
10. **Projections look different from actuals.** Dashed or lighter styling, a vertical "today" marker, and the drivers footnoted; a chart that blends actual and projected in one solid line is a hard failure in the audit.
11. **Retention is a curve, not a point.** Show the cohort curve (or stacked cohorts) rather than a single "80 percent retention" figure, and name the cohort basis.
12. **Weakness disclosed where it is visible.** If the series has a dip or a churn event, annotate it with the cause and the fix rather than cropping it out; diligence finds it anyway (pedronauck proof-slides, 2025).

## 5. Picking the 3 to 5 headline numbers per stage

Rule of thumb from the proof-slides synthesis: one headline metric, two or three quality metrics, four to six numbers in total on the traction slide; ten numbers reads as hiding weakness in complexity (pedronauck, 2025). Pick in this order: (1) the north-star metric for the business model (`metrics-by-model.md`), (2) its trajectory with a dated window, (3) the quality metric that proves the trajectory is healthy, (4) the one number that is unusually strong versus a sourced benchmark, (5) the acknowledged weakness with its fix if the story needs it.

| Stage (ladder) | Headline (1) | Trajectory (2) | Quality (3) | Standout (4), only if sourced | Avoid |
|---|---|---|---|---|---|
| Team / pre-product | Strongest pre-revenue proof item with count and names (paid pilots, LOIs with value) | Discovery hit rate or waitlist growth per month | Depth of engagement (hours used, integrations built) | Founder's directly relevant prior result, as a fact | TAM as a headline; "users" of a landing page |
| Product (post-launch, pre-repeatable) | Paying customers or MRR, with the month | Net new per month over the full window | Cohort retention curve or usage retention | A benchmark the company beats, with population and year | Cumulative signups; blended CAC |
| Repeatable sale (seed to A) | ARR or GMV with net revenue | CMGR over 6 or more months and net new ARR per month | GRR and NRR as a pair, or repeat rate for marketplaces | CAC payback against the CRV 12 to 18 month range (2026) | Projections in the headline row |
| Unit economics (Series A and beyond) | ARR and growth multiple year over year | Net new ARR by quarter, new vs expansion vs churn | Gross margin, burn multiple, CAC payback | NRR or magic number with the comparison population named | Any metric whose definition changed during the window |

For each chosen number write the "handoff sentence" into the narrative: traction, then what the capital accelerates, then the milestone it buys with a number and a date (pedronauck, 2025). Every headline number is a `kind: fact` with `status: confirmed`; if a candidate is `unverified` or `conflicting`, it cannot be a headline until the founder resolves it in `gaps.md`.

## 6. Metric entries in facts.yaml, with a worked example

Metric entries follow file-formats.md plus the metric-specific fields below. Record only numbers an output will cite, plus both sides of every conflict; inputs that only feed a calculation go into `derived_from` as literals or into `note`. Template:

```yaml
  - id: <snake_case, stable across runs>
    label: <human label incl. period, e.g. "MRR, October 2026">
    value: <number, no thousands separators; scientific notation allowed>
    unit: <EUR/month | USD/year | customers | percent | months | ratio>
    kind: fact | assumption | projection
    status: confirmed | unverified | conflicting
    as_of: <YYYY-MM-DD the number describes>
    source: <path#locator>            # required unless derived_from is present
    derived_from: <expression over ids and literals: + - * / ^ ( )>  # optional; checker recomputes
    computed: true                    # only when the value was summed, counted or averaged from the source file; say how in note
    definition: <one line: what is included and excluded>   # required for metrics
    window: <e.g. "2026-05 to 2026-10, 6 months">            # required for growth and churn
    n: <sample size>                                         # required for rates from fewer than 100 observations
    conflicts_with: <id>                                      # when status is conflicting; both sides carry it
    assumes: [<ids>]                                          # projections only
    note: <anything an investor would ask about this number>
```

### Worked example

Founder folder contains `notes/founder-memo-nov-2026.md`, which says "We are at 520k ARR, growing 15 percent a month, with 2 percent churn and 1,900 users. CAC is about 600 EUR", and `data/metrics-2026-10.csv` (columns as found, tidied; three more months sit between the first two rows shown). The ledger entries the model writes follow the export.

```
month,   mrr_eur, new_mrr, expansion_mrr, churned_mrr, customers, trials, paid_from_trial, s_and_m_spend
2026-05, 24100,   4200,    900,           600,         17,        140,    9,               6100
2026-09, 37400,   4300,    600,           1400,        25,        210,    13,              7800
2026-10, 41000,   4600,    900,           1900,        27,        230,    14,              8300
```

```yaml
facts:
  - id: mrr_current
    label: MRR, October 2026
    value: 41000
    unit: EUR/month
    kind: fact
    status: confirmed
    as_of: 2026-10-31
    source: data/metrics-2026-10.csv#row=2026-10,col=mrr_eur
    definition: active subscription revenue in the month; no setup fees or services lines in this export
  - id: arr_current
    label: ARR, run-rate from October MRR
    value: 492000
    unit: EUR/year
    kind: fact
    status: conflicting
    derived_from: mrr_current * 12
    conflicts_with: arr_memo
  - id: arr_memo
    label: ARR as stated in founder memo
    value: 520000
    unit: EUR/year
    kind: fact
    status: conflicting
    source: notes/founder-memo-nov-2026.md#para=1
    conflicts_with: arr_current
    note: memo 520k vs export 492k (5.7 percent gap, above 1 percent tolerance). Possibly includes November bookings not yet live. Founder to confirm; narrative uses 492k until then.
  - id: mrr_cmgr_6m
    label: MRR compound monthly growth, May to Oct 2026
    value: 0.112
    unit: ratio
    kind: fact
    status: confirmed
    derived_from: (mrr_current / 24100) ^ (1 / 5) - 1
    window: 2026-05 to 2026-10, 5 compounding steps
    note: 24100 is May MRR from the same export, a literal rather than an extra entry. Memo claims 15 percent MoM; the export gives 11.2 percent CMGR and 9.6 percent for the latest month. Deck says "11 percent compound monthly growth over six months".
  - id: churn_gross_monthly
    label: Gross MRR churn, October 2026
    value: 0.051
    unit: ratio
    kind: fact
    status: confirmed
    source: data/metrics-2026-10.csv#row=2026-10,col=churned_mrr
    computed: true
    definition: churned plus contracted MRR over opening MRR; expansion excluded
    note: 1900 / 37400. Memo says "2 percent churn"; net churn ((1900 - 900) / 37400) is 2.7 percent, gross is 5.1 percent. Deck shows gross and net together; the founder is asked which one the memo meant.
```

The rest of the memo is handled the same way. "1,900 users" has no definition and no analytics export behind it: one entry with `status: unverified`, not used in the deck until defined (seats? registered? active?). "CAC about 600 EUR" is not reproducible per paying customer: 8300 / 14 = 593 is spend per converted trial, while spend per net new paying customer in October is 8300 / 2 = 4,150 (n = 2, so the deck would use the six-month average). The memo figure is recorded as `kind: assumption`, `status: conflicting` against the computed blended CAC. A model target such as ARR of 2.6M EUR by December 2027 is a `kind: projection` with `assumes:` naming its drivers; it implies 12.6 percent CMGR for 14 months, above the achieved 11.2 percent, so check 15 passes only because the driver (two sales hires in Q1 2027) is named.

The open questions then lead with the two contradictions (ARR 520k vs 492k; CAC 600 vs 4,150) and two definitional questions (which churn; what "users" means), each with the question that resolves it. The traction slide, pending answers, shows: EUR 41k MRR (Oct 2026), 11 percent compound monthly growth over six months, 27 paying customers, gross churn 5.1 percent and net 2.7 percent in October. That is four numbers, each resolving to a confirmed fact, and none of them is the memo's.
