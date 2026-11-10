# Metric sets by business model

What this file is for: the metrics investors expect for each business model, why they care about each one, and how to compute it from the files a founder actually has.
Read it when the ledger or the traction numbers need the metric set for this startup's model. Read only the block for this startup's model (a hybrid reads two); do not read through.
Definitions, identities and the maturity ladder are in `metrics.md`; stage benchmarks with their sources are in `benchmarks.md`.

## Contents (read only the block for this startup's model)

1. B2B SaaS
2. Marketplace
3. Consumer subscription
4. Consumer hardware plus subscription
5. Fintech
6. AI and ML products
7. Deep tech and hardware (pre-revenue or early revenue)
8. Biotech and medtech
9. Services-to-software (agency or consultancy becoming a product)

Pick the set that matches the business model; using the wrong class (DAU for enterprise SaaS, ARR for a hardware company) is itself a red flag (pedronauck proof-slides, 2025, synthesising Alter/Index 2022 and Hu/SignalFire 2021, historical). Each table says how to compute the metric from the files a founder actually has: a billing or Stripe export, a CRM export, a bank statement or P&L, a product-analytics export, a model spreadsheet. Record each computed value with `source` pointing to the file and `derived_from` where applicable.

## 1. B2B SaaS

| Metric | Why investors care | Compute from typical files |
|---|---|---|
| MRR, ARR | Size of the recurring base; anchors valuation | Billing export: sum active subscriptions for the last full month, exclude one-time lines; ARR = MRR x 12 |
| Net new ARR per month (new + expansion minus contraction minus churn) | Separates linear growth from compounding; "incremental beside cumulative" | Month-over-month diff of the MRR export by customer, x 12 |
| Growth: MoM and CMGR | Trajectory, benchmarked against stage bars | MRR series; CMGR over the full window |
| Gross revenue retention (GRR) and net revenue retention (NRR) | GRR shows product stickiness; NRR shows expansion; a wide gap means a subset upsells while the rest leak | 12-month cohort from the billing export: revenue today from customers active 12 months ago / their revenue then (GRR caps at 100 percent) |
| Logo churn, monthly | Customer-level health independent of contract size | CRM or billing: customers lost / opening customers |
| Gross margin | Whether it is software economics or services in disguise | P&L: (revenue minus hosting, support, implementation, third-party API cost) / revenue |
| CAC (paid and blended), CAC payback | Efficiency of growth; payback is the number most Series A investors quote | Sales and marketing spend from P&L / new customers from CRM; payback = CAC / (monthly ACV x gross margin) |
| ACV, sales cycle, pipeline coverage | Repeatability of the sale | CRM: median closed-won value, median days create-to-close, open pipeline / next-quarter target |
| Burn multiple | Capital efficiency: net burn / net new ARR (Sacks, 2020, historical) | Bank statement net burn over the period / net new ARR over the same period |
| Concentration | Risk from one buyer | Billing export: top 1, top 5 share |

## 2. Marketplace

| Metric | Why investors care | Compute from typical files |
|---|---|---|
| GMV (completed, net of cancellations and refunds) | Scale of the market cleared | Transactions export: sum completed and settled transactions per month |
| Take rate, blended and by revenue stream | Converts GMV to revenue; a rising take rate is pricing power, a falling one is subsidy | Net revenue / GMV; break out transaction fees, listing, ads, subscriptions |
| Net revenue | The actual top line | Take rate x GMV, reconciled to the P&L |
| Liquidity (fill rate, time to first transaction) | Whether the marketplace works at all | Transactions / listings (or searches) in a window; median hours from listing to first order |
| Supply-demand balance | Lopsided growth predicts collapse | Active suppliers / active buyers per month, with "active" defined |
| Repeat rate and frequency by cohort | Retention in a transactional business | Buyer cohort: share with a second purchase within 3, 6, 12 months |
| Contribution margin per transaction | Whether each transaction makes money after incentives | Take rate x average order value minus payments, support, promotions, supply incentives |
| Supply and demand acquisition cost, organic share | Where the next dollar of growth comes from | Spend by side / new accounts by side; organic new accounts / all new accounts |
| Density or concentration by market | Local liquidity in service marketplaces | GMV by top 1, 3, 5 markets |

## 3. Consumer subscription

| Metric | Why investors care | Compute from typical files |
|---|---|---|
| Paying subscribers and MRR | The monetised base, not the install base | App store or billing export: active paid subscriptions at month end; MRR net of store fees stated |
| Trial-to-paid and free-to-paid conversion | Funnel efficiency | Analytics: paid starts / trial starts in a cohort window |
| Retention curves (D1, D7, D30 for engagement; M1, M3, M6, M12 for paid) | Shape of the curve, not a single point; a flattening curve is the PMF signal | Cohort tables from analytics and billing; always cohorted, never aggregate |
| ARPU (paying) and blended ARPU | Monetisation per user | Revenue / paying users; revenue / all active users |
| CAC by channel, organic share | Scalable growth or paid treadmill | Spend per channel / attributed installs that convert to paid |
| LTV realised at 12 and 24 months | Honest unit economics while the base is young | Cohort revenue x gross margin, summed over the window |
| DAU/MAU | Habit, where the use case is daily | Analytics: average daily actives over 28 days / monthly actives |

## 4. Consumer hardware plus subscription

| Metric | Why investors care | Compute from typical files |
|---|---|---|
| Units shipped per period and backlog | Demand, shown incrementally | Order and fulfilment export: shipped per month; orders received not yet shipped |
| Hardware gross margin now and at planned volume | Whether the device funds itself | BOM sheet and invoices: (ASP minus fully loaded COGS incl. freight, duties, warranty reserve) / ASP; volume cases are projections |
| Attach rate | Share of devices on a paid subscription; the software multiple depends on it | Active paid subscriptions / devices shipped (or active devices) |
| Subscription MRR and subscriber churn | The recurring layer | Billing export, as in section 3 |
| Return and warranty rate | Product quality and margin leakage | Returns / units shipped within the return window; claims / units under warranty |
| Blended CAC and payback including hardware margin | Unit economics across both layers | Spend / new device customers; payback = (CAC minus hardware gross profit per unit) / monthly subscription gross profit |
| Channel mix and margin by channel | DTC vs retail economics differ sharply | Revenue and margin by channel from the P&L |
| Design-to-ship timeline vs plan | Execution credibility | Project plan dates vs actual ship dates (facts), next milestone (projection) |

## 5. Fintech

| Metric | Why investors care | Compute from typical files |
|---|---|---|
| Volume (TPV, originations, AUM) | Scale; never the revenue figure | Processor or ledger export: sum settled volume per period |
| Net revenue and effective take rate | What the company keeps after interchange, network, funding cost | Net revenue / volume; show by product line |
| Gross margin after direct costs | Payments margins are structurally thin; software layered on top widens them | (Net revenue minus interchange, network, cost of funds, losses, KYC data) / net revenue |
| Loss rate or default rate by vintage | Credit quality; the number that kills lenders | Charge-offs / originations by cohort month; gross and net of recoveries |
| CAC including onboarding and KYC, payback | Trust and compliance make acquisition expensive | Spend incl. verification costs / funded accounts |
| Activation and funded-account rate | Sign-ups are not customers | Funded or transacting accounts / sign-ups in a cohort |
| NRR on volume | Embedded products grow with the customer | Volume from customers active 12 months ago, today vs then |
| Regulatory status | Gates the whole plan | List of licences, each obtained / applied / planned with dates (facts and projections, kept apart) |
| Concentration (top partner, top sponsor bank) | Platform risk | Volume share by counterparty |

## 6. AI and ML products

| Metric | Why investors care | Compute from typical files |
|---|---|---|
| Revenue (ARR for subscriptions, consumption revenue separately) | Size, with the recurring and usage parts split | Billing export; never annualise a usage spike as ARR |
| Inference gross margin | The question of 2025 and 2026: whether the product makes money per query | (Revenue minus model API fees, GPU hours, serving infra, vendor costs) / revenue; take inference cost from cloud and API invoices, not from the model's assumptions |
| Cost per query or per task, and price per query | Unit economics at the smallest grain | Monthly inference cost / queries served; revenue / queries |
| Usage depth and retention (weekly active accounts, tasks per account, cohort usage retention) | Whether users come back without prompting; distinguishes a wedge from a novelty | Product analytics by account, cohorted monthly |
| Eval or quality metrics for the task | Credibility of the product claim | Internal eval set results with date, size and method stated; a projection if not yet measured in production |
| Concentration and whale dependence | One large account can mask flat usage elsewhere | Revenue and usage by top 1, 3, 10 accounts |
| Gross margin trend | Investors accept lower margin if it is rising with a mechanism (model routing, caching, smaller models) | Monthly series from P&L and invoices |
| Data moat indicators | Proprietary data volume, exclusivity and velocity | Counts from the data pipeline, labelled as facts only when counted |

Context, not a bar: ICONIQ's January 2026 State of AI snapshot (about 300 software executives) reports average AI product gross margin of 41 percent in 2024, 45 percent in 2025 and 52 percent projected for 2026, and inference at about 23 percent of revenue (ICONIQ, 2026, via SaaStr summary). Bessemer's 2025 cohort analysis puts the fastest-growing AI companies near 25 percent gross margin early and steadier ones near 60 percent (Bessemer State of AI, 2025, via secondary summaries). These populations differ; cite the one that matches the company and say so.

## 7. Deep tech and hardware (pre-revenue or early revenue)

| Metric | Why investors care | Compute from typical files |
|---|---|---|
| Technical milestone status vs plan | Execution risk is the main risk | Roadmap or grant reports: milestone, planned date, achieved date, evidence file |
| Performance vs incumbent on the metric the customer buys on | Is the advantage real and measured? | Test reports: metric, conditions, sample size, date; label lab vs field |
| Paid pilots, LOIs with scope and price, design partners | Pre-revenue proof stack, strongest to weakest (`metrics.md` section 3) | Contracts folder: counterparty, value, scope, signed date |
| Pipeline value and stage | Future revenue plausibility | CRM or spreadsheet; weighted only in the model, unweighted in the ledger |
| Unit cost now and at volume, yield | Path to margin | BOM and production logs; volume cases are projections with their drivers |
| Non-dilutive funding secured | Validation and runway extension | Grant letters: amount, date, conditions |
| Cash, net burn, runway to next technical milestone | Whether the raise reaches a value inflection | Bank statements and budget |
| Patents filed and granted | Defensibility | IP schedule with filing and grant dates and jurisdictions |

## 8. Biotech and medtech

| Metric | Why investors care | Compute from typical files |
|---|---|---|
| Pipeline: each asset's indication, mechanism, stage, next milestone and date | The portfolio is the company | Pipeline slide source table, one row per program |
| Regulatory interactions and designations | De-risks the path | Meeting minutes and letters: type, date, outcome |
| Preclinical and clinical data with n, endpoint, comparator | The evidence itself | Study reports; never summarise without n and endpoint |
| Enrolment rate vs plan | Trial execution | Site reports: patients per site per month, screen-failure rate |
| Cash runway to the next data readout plus buffer | Running out mid-trial is fatal | Cash / net burn vs readout date; the buffer is an assumption, label it |
| Partnerships: upfront, milestones, royalties, non-dilutive received | External validation and capital | Executed agreements |
| IP: composition of matter vs method of use, expiry | Durability of the asset | IP schedule |
| For commercial medtech: revenue per procedure or test, reimbursement status, penetration | Commercial reality | Billing and payer letters |

## 9. Services-to-software (agency or consultancy becoming a product)

| Metric | Why investors care | Compute from typical files |
|---|---|---|
| Revenue split: software subscription vs services vs one-off | Only the software part gets a software multiple | P&L by revenue line; the ledger holds three ids, never a blended "revenue" |
| Software gross margin vs services gross margin | Proves the product is a product | Cost allocation by line; state the allocation method |
| Share of software revenue sold without services | Repeatability without hand-holding | Billing export: subscriptions with zero services line |
| Net new software ARR per month | The transition speed | MRR diff on software lines only |
| Headcount mix: delivery vs product and engineering | Whether the company is still an agency | HR or payroll export |
| Customer overlap: services clients converted to software | The wedge working | CRM join of both lists |
| Retention on software lines | Stickiness of the product alone | Cohort on software MRR only |
