# Run log

## 2026-11-10: quick run

- **Request:** "Help me with my investor pitch. Everything is in this folder."
- **Intake:** 15 files inventoried, 13 extracted, 2 confidential and not read (hr/salaries.xlsx, legal/round-terms-draft.md).
- **Files read (corpus extracts, in index order):** docs/board-update-2026-Q3.md, docs/clinical-outcomes-whitepaper.md, docs/competitive-landscape.md, docs/market-sizing-2026.md, notes/founder-perspective.md, docs/board-update-2026-Q2-draft.md (stale draft), data/cohort-retention.csv, data/kpis-weekly.csv, data/unit-economics.xlsx, assets/kestrel-brand.md, team/team.md, notes/investor-feedback-from-seed.md (sensitive), deck/kestrel-seed-deck-2024.pdf (sensitive, stale).
- **Ledger:** pitch/facts.yaml, 32 entries, 6 conflict pairs. `pitch.py check`: WARN, 0 FAIL, 1 WARN (the 2024 seed deck is more than 18 months old; it is cited only as the old side of the market conflict).
- **Questions asked (START-HERE section 1):** Q3 GMV and growth (board update against weekly export); enterprise count and employers lost; scope of the 118% retention figure and gross retention; which market figure; what the round buys beyond the stated milestone. Overflow in pitch/gaps.md.
- **Answers received:** none yet.
- **Values used until answered:** the weekly export's Q3 GMV and growth; 14 enterprise accounts; 7 employers lost; retention as all employers; the serviceable market estimate instead of the six-market total; the milestone as stated.
- **Assumed:** UK institutional Series A funds, priced equity, reading deck then presenting deck (ledger id round_profile).
- **Outputs written:** pitch/START-HERE.md, pitch/facts.yaml, pitch/gaps.md, pitch/run-log.md, pitch/intake/.

## 2026-11-10: founder answers, Series A deck

- **Answers received:** (1) Q3 GMV is the finance figure, 1.90M; the weekly export misses about 170k of manually invoiced enterprise bookings; use 1.90M and footnote the export. (2) 14 enterprise accounts, meaning 250+ staff on annual contracts; 7 employers lost. (3) 118 percent is all employers; gross retention not measured yet. (4) Use the 1.1B serviceable figure. (5) No model yet; left open.
- **Changed values (old to new):** Q3 GMV 1,729,980 to 1,900,000; Q3 net revenue 380,596 to 418,000; Q2 to Q3 growth 17 percent to 31 percent; GMV run-rate 6,919,920 to 7,600,000; enterprise accounts 14 or 24 (conflict) to 14 confirmed; employers lost 7 or 6 (conflict) to 7 confirmed; retention scope confirmed as all employers; market figure fixed at the 1.1B serviceable estimate, with the 11B, 4.2B and 0.9B figures out of use. The export-only 52-week GMV total and 12-month multiple were dropped from the ledger and outputs.
- **References read for the deck:** deck-structure.md, design.md, and the Airbnb, Wise and Divvy Homes notes in deck-library.md that `pitch.py comparables` pointed to.
- **Comparables:** marketplace, Series A: acquco (2020), Solo Funds (2023), Airbnb (2008). Taken from them: one multiplication on the business model and market slides, the supply-side metric in traction, a named-risks slide in the appendix. No numbers copied.
- **Theme:** paper, with the brand's Kestrel Blue as accent and Fraunces and Inter named as faces. Reason: the first use is a read-ahead PDF on a laptop, and the brand notes ask for a calm, clinical look on a light ground.
- **Deck:** pitch/deck/deck.json, 16 slides plus a generated sources page, read variant. Two builds; both clean on capacity and QA. Open slots: runway on the ask slide, contact email on the closing slide. No financials slide, because there is no model.
- **Read-alone test on titles:** passes; each title is a sentence with its number, and the sequence runs growth, problem, solution, evidence, insight, model, market, sales, retention, competition, team, ask.
- **New open questions (START-HERE section 1):** export higher than finance in Q1 and Q2; total raised; permission to name the whitepaper employer; public source for the NHS wait. The model question stays open.
- **Outputs written or updated:** pitch/facts.yaml, pitch/START-HERE.md, pitch/gaps.md, pitch/deck/ (deck.json, deck.html, deck.pdf, deck.pptx, qa/), pitch/run-log.md.

## 2026-11-11: Series A deck rebuilt, editable PowerPoint

- **Request:** "Build the Series A deck. Our partners at the funds will want to edit a few slides, so I need an editable PowerPoint as well as the PDF. Make it look great."
- **State found:** pitch/deck/ did not exist although the previous entry lists it; the deck was built from scratch from the ledger and the intake corpus.
- **Format:** founder asked for an editable PowerPoint, so `meta.pptx: editable`; no format question asked.
- **References read:** deck-structure.md, design.md, THEMES.md, file-formats.md (deck.json), the Airbnb and Divvy Homes notes in deck-library.md.
- **Comparables:** `pitch.py comparables --sector marketplace --round "series a"`: Airbnb (2008), acquco (2020), Iconfinder (2007). Taken: supply-side metric in traction, the model as one multiplication, distribution as a loop. No numbers copied.
- **Theme:** ledger, with Warm Coral (#E8735A) as the accent, Fraunces and Inter. Reason: Kestrel sells to employers who treat absence as a cost line and the readers are Series A funds, so calm and exact; the navy ink sits next to Kestrel Blue and the one coral cell per slide follows the brand rule of one accent per slide.
- **Ledger:** three entries added for the deck (covered_employees, bookings_q3, sick_days_series). `pitch.py check`: PASS, 0 FAIL, 0 WARN.
- **Deck:** 22 slides plus the generated sources page, read variant. Five builds; the last is clean (capacity within budget, 0 QA issues, slack none, ledger PASS, PPTX checked, PDF 23 pages for 23 slides).
- **Changes after looking at the screenshots:** flow cut from five steps to four; market label shortened and an untraced figure removed; source caption on the problem slide shortened because it ran under the colour panel; card texts on the retention slide evened out; closing points given their numbers as leads; risks slide cut to three points; GMV chart restated in thousands because the editable PowerPoint rounds data labels to whole numbers.
- **Read-alone test on titles:** passes; the sequence runs growth, problem, solution, product, why clinics say yes, network, one employer's outcome, the buyer, model, retention, market, sales, alternatives, team, ask.
- **Open slots on slides:** runway on the ask slide, contact on the closing slide. No financials slide (no model). No quote slide (no customer sentence in the folder). No logo or product image (not in the folder).
- **Outputs written or updated:** pitch/deck/ (deck.json, deck.html, deck.pdf, deck.pptx, qa/), pitch/facts.yaml, pitch/START-HERE.md, pitch/gaps.md, pitch/run-log.md.
