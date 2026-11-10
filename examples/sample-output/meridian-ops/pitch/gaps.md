# Meridian: open items beyond the start page

Updated 2026-11-10 after the founder's answers. The five most urgent questions are in [START-HERE.md](START-HERE.md) section 1. These come next. Figures cite pitch/facts.yaml; items that live only here point at the file and cell.

## 1. Contradictions between files

1. **Is the December contract signed, and for how much?** Your answer says the memo's higher ARR counted a contract that is signed but not live. data/pipeline.csv (row P-052) still lists that deal at the Negotiation stage with a note that the contract is out, and its contract value in that row does not equal the gap between the memo and the export. Please update the pipeline file, or say which deal the memo counted.
   *Used until you answer:* the contract is left out of every revenue figure `[fact:arr_current]`.
2. **Is the 2026 revenue line in the model up to date?** The model's 2026 revenue (data/financial-model-v3.xlsx, P&L 2026-2029!B4) is lower than the ten actual months in the export plus two more months at the October level `[fact:mrr_series]`. Worth fixing in the same pass as the runway.
   *Used until you answer:* the metrics export; the model's 2026 revenue line is not cited anywhere.
3. **Is the end-2028 target the model's output or a separate number?** End-2028 customers times average revenue per customer in the P&L sheet (cells D2 and D3) gives a higher exit ARR than the stated target `[projection:arr_target_2028]`.
   *Used until you answer:* the stated target, as a projection.

## 2. Missing information that changes the pitch

1. **Waiting fees across customers.** The memo gives a per-site range; the folder backs one site in one year `[fact:case_waiting_fees]`. Fee totals from three or four more customers turn the problem slide from one site into a pattern.
2. **Driver wait times across customers.** docs/product-vision.md cites an average wait range from interview data, but the interview notes do not contain it. The only measured figure is one site `[fact:case_wait_minutes]`.
3. **A second measured customer result.** The case study is one site over three months in 2025 `[fact:case_wait_reduction_pct]`. A result from a customer with no stake in the company, and a refreshed figure across all of the first customer's sites, are the two cheapest upgrades to the proof.
4. **Revenue by customer.** The memo says per-site pricing undercharges the two biggest customers. A table of MRR by customer answers the concentration question and is the input for retention.
5. **Sales cycle data.** The memo says the cycle lengthened as deals grew. The pipeline file has expected close months but no created dates, so it cannot be checked or put on the go-to-market slide.
6. **Competitor facts checked against public pages.** The competition slide rests on what prospects said `[assumption:competitor_grid]`; two cells read "not known".
7. **Written permission to name customers.** The slide text names none; only the published case study's file name appears, in source captions. Logos need permission before they go on a slide.
8. **A lead, or the statement that the round is open to one.** Seed funds ask on the first call. Nothing in the folder says either way, so the deck says neither.

## 3. Confidential material found

- `CONFIDENTIAL-do-not-share.md`: flagged by its file name, not read, no values repeated. Data room only.
- `legal/cap-table-summary.md`: shareholder names and stakes, the terms of earlier rounds and of the unconverted SAFE, the option pool. Read so the founder can be prepared for the question; excluded from the deck and its speaker notes.
- `data/financial-model-v3.xlsx`: salary line and cost per role in the hiring plan. Excluded.
- `docs/customer-interviews-notes.md`, `data/pipeline.csv`: customer and prospect names. Excluded.
- `team/founders.md`: an advisor's equity. Excluded; no advisors on the team slide.
