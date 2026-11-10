# Run log

## 2026-11-10: quick run

**Request:** "Help me with my investor pitch. Everything is in this folder."

**Intake:** 16 files in the inventory, 15 extracted, 1 confidential and not read, 0 errors.

**Files read (corpus order):**
- docs/customer-interviews-notes.md
- docs/Meridian-customer-case-study-Nordfracht.pdf
- docs/product-vision.md
- notes/competitors.md
- notes/founder-memo-nov-2026.md
- README.md
- old/pitch-notes-2025.md (stale; used only for the method behind the market count)
- data/financial-model-v3.xlsx (contains pay; salary and per-role costs held back)
- data/metrics-2026-10.csv
- data/pipeline.csv
- data/metrics-2026-08.csv (stale; superseded by the October export, identical on shared rows)
- assets/brand-colors.md, assets/meridian-logo.svg
- team/founders.md
- legal/cap-table-summary.md (sensitive; read, nothing from it in investor-facing text)

**Not read:** CONFIDENTIAL-do-not-share.md (confidential by file name).

**Ledger:** pitch/facts.yaml, 29 entries (20 facts, 6 assumptions, 3 projections; 4 conflicting pairs). `pitch.py check`: PASS, 0 FAIL, 0 WARN.

**Conflicts recorded, conservative value used:**
- ARR: 494,400 (export) against 520,000 (memo). Used 494,400.
- Year-on-year MRR growth: 2.15x (export) against 3.4x (memo). Used 2.15x.
- Runway after the raise: 18.9 months (model P&L) against 26 (model Assumptions). Used 18.9.
- Smallest target customer: 150 movements a day (memo) against 50 (README). Used 150.

**Checked by hand, consistent:** customer count across README, memo, model and export; logo churn count in memo and export; current runway against cash and net burn; monthly cost lines sum to total opex; use of funds sums to the ask; case-study percentage against its before and after minutes.

**Questions asked (START-HERE section 1):**
1. Which ARR is current?
2. Which two months does the 3.4x compare?
3. Does the round last 26 months or about 19?
4. Where do NRR and CAC payback come from?
5. Who is the first investor, and where?

**Answers received:** none yet.

**Default applied:** seed round, seed fund lead plus angels, Germany, priced equity, reading deck then presenting deck.

**Outputs written:** pitch/START-HERE.md, pitch/facts.yaml, pitch/gaps.md, pitch/run-log.md, pitch/intake/.

## 2026-11-10: founder answers, then the deck

**Answers received:**
1. ARR: use 494,400. The memo's 520,000 counted a contract that is signed but not live until December.
2. Growth: use 2.15x. The memo's 3.4x compared June 2025 with October 2026.
3. Runway after the raise: use about 19 months; the founder will fix the model.
4. Net revenue retention and CAC payback: no data, drop both.
5. Investor: German seed funds first, priced round.

**Ledger changes (old to new):**
- arr_current: conflicting, 494,400 against 520,000 in arr_memo, to confirmed 494,400. arr_memo removed; its value is in the note.
- mrr_yoy_multiple: conflicting, 2.15x against 3.4x in mrr_yoy_memo, to confirmed 2.15x. mrr_yoy_memo removed.
- runway_post_raise_pnl: conflicting, 18.9 months against 26 in runway_post_raise_model, to confirmed 18.9. runway_post_raise_model removed.
- nrr_memo (112 percent) and cac_payback_memo (under 8 months): removed; no output cites them.
- round_profile: default (seed fund lead plus angels, Germany), unverified, to "German seed funds first; priced equity round", confirmed.
- sam_bottom_up: 216,300,000 to 216,384,000, because the expression now uses the export's average MRR per customer (arpa_current, 1,288) instead of MRR divided by customers (1,287.5). Displayed as EUR 216M both before and after.
- Added for the deck: arpa_current, gross_margin_model, case_go_live_days, competitor_grid, use_of_funds_gtm_pct, use_of_funds_product_pct, use_of_funds_ops_pct.
- Entries: 29 to 31. `pitch.py check`: PASS, 0 FAIL, 0 WARN.

**Start page changes:** headline growth is now the 12-month 2.15x, not the 21-month 10.05x. Questions 1 to 5 replaced by the next open items (target-customer size, Europe count, ARR at month 19, gross margin from the accounts, product screenshot). Red flags replaced: the two that the answers closed (conflicting ARR and growth, unsourced retention and payback) gave way to the milestone gap and the missing retention figure.

**References opened for this step:** SKILL.md, core.md and file-formats.md again (both had changed), deck-structure.md, design.md, assets/deck-template/THEMES.md, investor-types.md, investor-types-detail.md (seed fund block and the regional table only), deck-library.md (the Buffer and Intercom entries only).

**Comparables:** `pitch.py comparables --sector saas --round seed` returned Buffer (seed, 2011), Intercom (2011) and Almanac (seed, 2020). Taken from the first two: traction by slide 4 or 5 with a unit and a date on every number; the competition slide as a category table, not a 2x2; one idea per slide in 12 to 13 slides. Almanac has no structure notes in the library and was not fetched. No numbers copied.

**Theme:** paper, reading variant. A German seed fund reads the deck as a PDF before the meeting, and the brand's own background is the same warm light ground. Accent set to the brand's deep teal (#0F4C5C) rather than its orange, for contrast on the light ground and to keep clear of the cream-plus-terracotta look; brand fonts Space Grotesk and Inter; logo from assets/.

**Read-alone test on the titles:** passes. Cover one-liner, the 94-minute wait and the bill, booking through a link, MRR 2.15x in 12 months, the driver-side insight, price per customer, the 14,000 company estimate, founder-led sales and what the round changes, who it is built for, the founders, the ask, the one-liner again.

**Deck builds:** three runs of `pitch.py deck`, all with the same summary: capacity within budget, PPTX validated, PDF 13 pages for 13 slides, QA 0 issues, ledger PASS, 2 open `[needs number]` slots (slide 7 TAM, slide 11 ARR at month 19). Run 2 fixed something the QA did not flag: a "Team of 7" row drawn as a third person with initials. Run 3 reworded the closing headline, which broke "mid-size" across two lines.

**Not done:** the presenting variant (`meta.variant: "present"`) is not built. The QA screenshots rendered with fallback fonts, so the brand fonts were not checked by eye.

**Outputs written:** pitch/deck/deck.json, deck.html, deck.pdf, deck.pptx, pitch/deck/qa/; pitch/START-HERE.md, pitch/facts.yaml, pitch/gaps.md updated.
