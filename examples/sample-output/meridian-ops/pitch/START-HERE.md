# Meridian: pitch start page

Generated 2026-11-10, updated 2026-11-11 with the deck for German seed funds. Numbers as of 2026-10-31. Every figure traces to pitch/facts.yaml.

## 1. Answer these first

1. **How small is the smallest target customer?** README.md says 50 truck movements a day `[fact:icp_min_movements_readme]`; your memo says 150 `[fact:icp_min_movements_memo]`. Was the 14,000 count `[assumption:market_companies]` filtered on either?
   *Used until you answer:* 150.
2. **How many target companies are there across Europe, and where is the count behind 14,000?** A seed fund asks for the bottom-up. The folder has neither the research file nor a Europe figure.
   *Used until you answer:* `[needs number]` for TAM on deck slide 10.
3. **What ARR does the revised model reach when the round is spent, around mid 2028?** The round lasts 18.9 months `[projection:runway_post_raise_pnl]`; the EUR 2.5M target is dated end 2028 `[projection:arr_target_2028]`.
   *Used until you answer:* `[needs number]` on deck slide 16, in the last milestone.
4. **What is gross margin in the accounts?** The only figure is a model input, 82% `[assumption:gross_margin_model]`.
   *Used until you answer:* 82%, labelled as an assumption on deck slide 11.
5. **Can you add a product screenshot?** The folder has none, so the deck shows no product image.
   *Used until you answer:* slide 4 explains the product with a four-step diagram instead of a screenshot.

More open items are in [gaps.md](gaps.md).

## 2. Your pitch

**In two sentences:** Meridian sells dock scheduling and driver messaging to mid-size freight forwarders, so dispatchers stop coordinating trucks by phone and WhatsApp. 32 customers pay EUR 41,200 a month as of October 2026, up 2.15x in twelve months.

**In 60 seconds:** Meridian sells dock scheduling and driver messaging to mid-size freight forwarders. Today their dispatchers run the yard with phones, WhatsApp groups and a paper notebook, and trucks queue every morning. Carriers used to eat the waiting time. Now they invoice it: one Hamburg site paid about EUR 38,000 in waiting fees in 2024. With Meridian, carriers book a dock slot through a link, with no app and no login, and drivers get updates by SMS in German, English, Polish or Romanian. At that Hamburg site, dock wait per truck fell from 94 to 65 minutes in the first three months. 32 customers pay us EUR 41,200 a month as of October 2026, up from EUR 19,200 a year earlier. We are raising EUR 3 million to move from founder-led selling to a sales team that closes without us.

## 3. The numbers that matter

| Number | Value | Kind | Source |
|---|---|---|---|
| MRR, October 2026 `[fact:mrr_current]` | EUR 41,200 (ARR run-rate EUR 494,400 `[fact:arr_current]`) | fact | data/metrics-2026-10.csv |
| MRR growth, October 2025 to October 2026 `[fact:mrr_yoy_multiple]` | 2.15x, from EUR 19,200 | fact | data/metrics-2026-10.csv |
| Paying customers, October 2026 `[fact:customers_current]` | 32 | fact | data/metrics-2026-10.csv |
| Customers lost, January 2025 to October 2026 `[fact:logo_churn_count]` | 3 in 22 months | fact | data/metrics-2026-10.csv |
| Dock wait at one customer site, March to May 2025 `[fact:case_wait_reduction_pct]` | 31% fewer minutes (94 to 65), n=1 site | fact | docs/Meridian-customer-case-study-Nordfracht.pdf |

**Do not use yet:**
- Net revenue retention and CAC payback: dropped at your request. They need MRR per customer per month and real acquisition spend.
- The signed contract that goes live in December: a booking, not ARR, until it is live.
- "14,000 companies" as a fact: say "we estimate" until the count is in the folder.
- The per-site waiting-fee range in the memo: the folder backs one site `[fact:case_waiting_fees]`.
- "31% fewer dock wait minutes" as a company result: it is one site in 2025.

## 4. The five questions you are least ready for

**"What is your net revenue retention and CAC payback?"** Why they ask: at seed, a missing retention figure is itself information. Your strongest honest answer: We have not measured either yet. What we have measured is logo churn: 3 customers lost in 22 months `[fact:logo_churn_count]`, with 32 paying today `[fact:customers_current]`. The cohort view lands on (give the date). Have ready: MRR per customer per month.

**"Who other than Lena has closed a deal?"** Why they ask: they test whether the sale repeats outside the founders. Your strongest honest answer: Nobody yet. We add 1.5 customers a month `[fact:new_customers_actual]` and all 18 open deals are owned by a founder `[fact:pipeline_open_deals]`. The model assumes 4 a month in 2027 `[assumption:new_customers_2027_model]`; this round pays to prove it. Have ready: pipeline by owner, deck slide 12.

**"Does EUR 3M reach EUR 2.5M ARR?"** Why they ask: time is not a milestone. Your strongest honest answer: Not on the current model. The round lasts about 18.9 months `[projection:runway_post_raise_pnl]`, to mid 2028, and the EUR 2.5M target is dated end 2028 `[projection:arr_target_2028]`. I am revising the model. Today we hold EUR 380,000 `[fact:cash]`, 7.1 months `[fact:runway_months]`. Have ready: monthly cash flow.

**"Is growth slowing?"** Why they ask: the MRR chart is a straight line, not a curve. Your strongest honest answer: In percentage terms, yes. MRR grew 2.15x in twelve months `[fact:mrr_yoy_multiple]` and 10.05x in 21 `[fact:mrr_growth_multiple]`, because we add a steady 1.5 customers a month `[fact:new_customers_actual]`. Growth is capped by two founders selling. Have ready: deck slide 6.

**"How does a EUR 216M market make a venture-scale company?"** Why they ask: a seed fund needs a large outcome. Your strongest honest answer: We estimate 14,000 companies in DACH and Benelux from 2025 desk research `[assumption:market_companies]`, about EUR 216M a year at today's revenue per customer `[assumption:sam_bottom_up]`. We have no sourced Europe count yet. Have ready: the count by country.

## 5. Top three red flags

**The round ends before its own milestone** (major). What an investor reads into it: the plan buys time, not a result. Fix: revise the model and state the ARR reached at month 19 (question 3).

**No retention or acquisition-cost figure at seed** (major). What an investor reads into it: not measured, or bad. Fix: export MRR per customer per month; compute gross and net retention before the first meeting.

**The one proof point comes from a shareholder** (major). What an investor reads into it: the only reference is an insider. Fix: disclose it before the reference call; add a measured result from a customer with no stake.

## 6. Kept out of investor material

- `CONFIDENTIAL-do-not-share.md`: not read. Data room only.
- `legal/cap-table-summary.md` (read): shareholder names and stakes, earlier round and SAFE terms, option pool, advisor equity. None of it is in the deck or its notes.
- `data/financial-model-v3.xlsx`: the salary line and cost per role.
- `docs/customer-interviews-notes.md`, `data/pipeline.csv`: customer and prospect names. The slide text names no customer, and the source captions read "published customer case study, June 2025" instead of the file name. The two customer quotes (slides 7 and 13) are attributed by role only.
- No valuation, no terms and no investor names in any output.

## 7. Next

Ask for any of: the full narrative, the full investor Q&A, the presenting variant of the deck, a PowerPoint export, preparation for a specific German seed fund.

## Files

- [START-HERE.md](START-HERE.md), [facts.yaml](facts.yaml) (33 entries), [gaps.md](gaps.md), [run-log.md](run-log.md)
- [deck/deck.html](deck/deck.html) (web version, arrow keys, n for notes), [deck/deck.pdf](deck/deck.pdf): 17 slides plus one sources page, reading variant, no PowerPoint
- [deck/deck.json](deck/deck.json): the editable source; [deck/qa/](deck/qa/): slide screenshots
- [intake/corpus/INDEX.md](intake/corpus/INDEX.md), [intake/inventory.json](intake/inventory.json)
