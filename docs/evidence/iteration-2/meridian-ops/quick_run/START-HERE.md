# Meridian: pitch start page

Generated 2026-11-10. Numbers as of 2026-10-31. Every figure traces to pitch/facts.yaml.

## 1. Answer these first

1. **Which ARR is current: EUR 520k or EUR 494k?** Your November memo says EUR 520,000 `[fact:arr_memo]` (notes/founder-memo-nov-2026.md). The metrics export gives October MRR of EUR 41,200, which is EUR 494,400 a year `[fact:arr_current]` (data/metrics-2026-10.csv). Is the difference signed-but-not-live contracts, November revenue, or one-off fees?
   *Used until you answer:* EUR 494,400, and MRR rather than ARR as the headline.
2. **Which two months does "up 3.4x year on year" compare?** The memo says 3.4x `[fact:mrr_yoy_memo]`. The export shows 2.15x, from EUR 19,200 in October 2025 to EUR 41,200 in October 2026 `[fact:mrr_yoy_multiple]`. The export only gives 3.4x over a longer window than a year.
   *Used until you answer:* 2.15x over 12 months, and 10.05x over the 21 months since January 2025 `[fact:mrr_growth_multiple]`.
3. **Does EUR 3M last 26 months or 19?** The model states 26 months of runway after the raise `[projection:runway_post_raise_model]` (Assumptions sheet, typed in). The losses in the same model's P&L sheet use the cash in about 18.9 months, around July 2028 `[projection:runway_post_raise_pnl]`, before the end-2028 target of EUR 2.5M ARR `[projection:arr_target_2028]`. Which is the plan?
   *Used until you answer:* 18.9 months.
4. **Where do "net revenue retention 112%" and "CAC payback under 8 months" come from?** Both are in the memo's traction list `[assumption:nrr_memo]` `[assumption:cac_payback_memo]`. The folder has no revenue by customer by month and no acquisition cost, so neither can be recomputed. A seed investor asks for both and for the calculation.
   *Used until you answer:* `[needs number]` for both; logo churn (3 customers lost in 22 months `[fact:logo_churn_count]`) is shown instead.
5. **Who are you pitching first, and where are they?** No file names a target investor.
   *Used until you answer:* a seed round led by a seed fund with angels alongside, in Germany, priced equity, a reading deck sent ahead and a presenting deck for the meeting `[assumption:round_profile]`.

More open items than fit here are in [gaps.md](gaps.md).

## 2. Your pitch

**In two sentences:** Meridian sells dock scheduling and driver messaging to mid-size freight forwarders, so dispatchers stop coordinating trucks by phone and WhatsApp. 32 customers `[fact:customers_current]` pay EUR 41,200 a month as of October 2026 `[fact:mrr_current]`, up from EUR 4,100 in January 2025 `[fact:mrr_series]`.

**In 60 seconds:** Meridian sells dock scheduling and driver messaging to mid-size freight forwarders. Today their dispatchers run the yard with phones, WhatsApp groups and a paper notebook, and trucks queue every morning. Carriers used to eat the waiting time. Now they invoice it: one Hamburg site paid about EUR 38,000 in waiting fees in 2024 `[fact:case_waiting_fees]`. With Meridian, carriers book a dock slot through a link, with no app and no login, and drivers get updates by SMS in German, English, Polish or Romanian. At that Hamburg site, dock wait per truck fell from 94 to 65 minutes in the first three months `[fact:case_wait_minutes]`. 32 customers `[fact:customers_current]` pay us EUR 41,200 a month as of October 2026 `[fact:mrr_current]`, up from EUR 4,100 in January 2025 `[fact:mrr_series]`. We are raising EUR 3 million `[fact:ask]` to move from founder-led selling to a sales team that closes without us.

## 3. The numbers that matter

| Number | Value | Kind | Source |
|---|---|---|---|
| MRR, October 2026 `[fact:mrr_current]` | EUR 41,200 | fact | data/metrics-2026-10.csv |
| MRR growth, January 2025 to October 2026 `[fact:mrr_growth_multiple]` | 10.05x in 21 months, from EUR 4,100 | fact | data/metrics-2026-10.csv |
| Paying customers, October 2026 `[fact:customers_current]` | 32 | fact | data/metrics-2026-10.csv |
| Customers lost, January 2025 to October 2026 `[fact:logo_churn_count]` | 3 in 22 months | fact | data/metrics-2026-10.csv, memo agrees |
| Dock wait at one customer site, March to May 2025 `[fact:case_wait_reduction_pct]` | 31% fewer minutes (94 to 65), n=1 site | fact | docs/Meridian-customer-case-study-Nordfracht.pdf |

**Do not use yet:**
- "ARR EUR 520k" `[fact:arr_memo]` and "up 3.4x year on year" `[fact:mrr_yoy_memo]`: the export does not back either. Questions 1 and 2 settle them.
- "Net revenue retention 112%" `[assumption:nrr_memo]`: needs MRR per customer per month, so expansion and contraction can be computed.
- "CAC payback under 8 months" `[assumption:cac_payback_memo]`: needs sales and marketing spend per period and the contract value of the customers it won.
- "~14,000 companies and nobody serves them" as a fact `[assumption:market_companies]`: it is your desk-research estimate from 2025. Say "we estimate" and put the count by country and size band in the folder.
- The per-site waiting-fee range in the memo: the folder backs one site in one year `[fact:case_waiting_fees]`. Needs the fee totals from more customers.
- "31% fewer dock wait minutes" as a company result: it is one site over three months in 2025 `[fact:case_wait_reduction_pct]`. Always say so, and add a second measured customer.

## 4. The five questions you are least ready for

**"Your memo says ARR is EUR 520k, up 3.4x. Your export says EUR 494k and 2.15x. Which is it?"** Why they ask: one mismatch makes them doubt every other number. Your strongest honest answer: ARR run-rate is EUR 494,400, which is October 2026 MRR of EUR 41,200 times 12 `[fact:arr_current]`. MRR grew 2.15x from October 2025 to October 2026 `[fact:mrr_yoy_multiple]`. The higher figures in my memo are being reconciled, and I use the export. Have ready: data/metrics-2026-10.csv and a monthly MRR chart, not a cumulative one.

**"What is your net revenue retention and your CAC payback, and how do you calculate them?"** Why they ask: at seed in a subscription business, a missing retention figure is itself information. Your strongest honest answer: We have not measured either in a form I can show you yet. What we have measured is logo churn: 3 customers lost in 22 months `[fact:logo_churn_count]`, with 32 paying in October 2026 `[fact:customers_current]`. The cohort view lands on (give the date). Have ready: MRR per customer per month since January 2025; sales and marketing spend by quarter.

**"Who other than Lena has closed a deal, and why will new customers go from 1.5 a month to 4?"** Why they ask: they are testing whether the sale repeats outside the founder's network. Your strongest honest answer: Nobody yet without a founder in the room. We have added 1.5 customers a month on average for 22 months `[fact:new_customers_actual]`, and all 18 open deals are owned by a founder `[fact:pipeline_open_deals]`. The model assumes 4 a month in 2027 `[assumption:new_customers_2027_model]`. That rests on account executives closing alone, which is what this round pays to prove. Have ready: pipeline by owner, the first deal Katrin closes alone, the written sales playbook.

**"Does EUR 3M get you to EUR 2.5M ARR, or do you run out first?"** Why they ask: time is not a milestone, and they check whether you know your own model. Your strongest honest answer: Today we have EUR 380,000 in cash `[fact:cash]`, which is 7.1 months at EUR 53,800 net burn `[fact:runway_months]` `[fact:net_burn]`. The model targets EUR 2.5M ARR by end 2028 `[projection:arr_target_2028]`, and its P&L uses the EUR 3M `[fact:ask]` in about 18.9 months `[projection:runway_post_raise_pnl]`. We are reconciling that against the 26 months stated elsewhere in the model `[projection:runway_post_raise_model]`. Have ready: a monthly cash-flow tab from close to the milestone.

**"14,000 companies at your price is about EUR 216M a year. How does this become a venture-scale company?"** Why they ask: a seed fund needs the outcome to be large, and your revenue per customer has been flat. Your strongest honest answer: We estimate 14,000 companies in our size band in DACH and Benelux, from desk research on Destatis and Eurostat counts in 2025 `[assumption:market_companies]`. At today's average revenue per customer that is about EUR 216M a year `[assumption:sam_bottom_up]`. We do not have a sourced count for the rest of Europe yet. Have ready: the count by country and size band with sources; the pricing v2 plan.

## 5. Top three red flags

**The memo and the metrics export disagree on ARR and on growth** (critical). What an investor reads into it: "Which one is true, and do they know their own business?" Fix: answer questions 1 and 2; until then EUR 494,400 `[fact:arr_current]` and 2.15x `[fact:mrr_yoy_multiple]` everywhere, dated October 2026.

**Two traction-slide numbers have no data behind them** (critical). Trigger: "net revenue retention 112%" `[assumption:nrr_memo]` and "CAC payback under 8 months" `[assumption:cac_payback_memo]` in the memo. What an investor reads into it: "They made this up, so what else is made up?" Fix: export MRR per customer per month and compute gross and net retention; compute CAC from real spend; or cut both and show logo churn `[fact:logo_churn_count]`.

**Your one proof point comes from a shareholder, and it is one site in 2025** (major). Trigger: the Nordfracht contact quoted in the case study is listed among your angels in legal/cap-table-summary.md; the result covers one site over March to May 2025 `[fact:case_wait_reduction_pct]`. What an investor reads into it: "The only reference is an insider, and they will find out in diligence." Fix: disclose it yourself before the reference call; add a measured result from a customer with no stake; refresh the Nordfracht figure now that all its sites are live.

## 6. Kept out of investor material

- `CONFIDENTIAL-do-not-share.md`: flagged confidential, not read. It belongs in the data room, after a partner meeting.
- `legal/cap-table-summary.md` (sensitive, read): shareholder names, percentages and share counts, the terms of the angel round and of the unconverted SAFE, the option pool, and advisor equity. None of it appears in investor-facing text. In a meeting, describe the structure only (two founders, angels, one SAFE that converts in this round, no debt) and discuss price live.
- `data/financial-model-v3.xlsx`: the salary line and the cost per role in the hiring plan are held back.
- `docs/customer-interviews-notes.md` and `data/pipeline.csv`: customer and prospect names other than Nordfracht (whose case study is published) are held back until you have written permission. They are described by type, for example "a five-site forwarder in Frankfurt".
- No valuation and no names of prospective investors in any output.

## 7. Next

Ask for any of: the full narrative, the full investor Q&A, a deck (HTML, PDF, PowerPoint), preparation for a specific investor type.

## Files

- [START-HERE.md](START-HERE.md): this page
- [facts.yaml](facts.yaml): the fact ledger, 29 entries
- [gaps.md](gaps.md): open items beyond the five above
- [run-log.md](run-log.md): what was read, asked and written
- [intake/inventory.json](intake/inventory.json) and [intake/corpus/INDEX.md](intake/corpus/INDEX.md): every file found and its extracted text
