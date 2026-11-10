# Run log

## 2026-11-10: quick run

- **Request:** "Help me with my investor pitch. Everything is in this folder."
- **Files read (4 of 4, none confidential):** notes/ask.md (contains deal terms: valuation cap), notes/bom-estimate.md, notes/waitlist.txt, README.md.
- **Ledger:** pitch/facts.yaml, 27 entries (10 fact, 16 assumption, 1 projection; 1 conflicting pair: ask and ask_high).
- **Check:** `pitch.py check` verdict WARN (0 FAIL, 1 WARN, 6 PASS). The WARN: use of funds amounts sum to 636,000 against an ask of 750,000. Left as a question for the founder, not patched.
- **Questions asked (START-HERE.md section 1):** round size ($750k or $1M); cost of shipping and buffer; whether 2,140 is net of unsubscribes, whether depositors saw the $299 price, refunds to date; the team today; first investor and country of incorporation.
- **Values used until answered:** ask $750,000; six named use-of-funds lines only; "312 refundable $49 deposits"; one founder, co-founder not mentioned; US angels plus a pre-seed fund as lead.
- **Answers received:** none yet.
- **Outputs written:** pitch/START-HERE.md, pitch/facts.yaml, pitch/gaps.md, pitch/run-log.md, pitch/intake/.
- **Kept out of investor material:** SAFE cap and cap range, co-founder details, per-person pay, unsigned creators.

## 2026-11-10: run 2, founder answers, narrative and investor Q&A

- **Founder's answers (verbatim):** "1. 750k. 2. Leave that open, I need to redo the budget. 3. 2,140 is gross, I have not removed unsubscribes. Everyone saw the 299 price before paying. 4 people have asked for refunds so far. 4. I am Dev Patel, nine years as a hardware engineer at a thermostat company, full time on Hearthbox since March 2026. I built the six prototypes. Nadia is still not confirmed. 5. US angels first. Now write the full narrative and the investor Q&A."
- **Changed values, old to new:**
  - `ask`: 750,000 USD, conflicting with `ask_high` (1,000,000 USD) → 750,000 USD, confirmed. `ask_high` removed; its value is in the note of `ask`.
  - `waitlist_signups`: 2,140 "total", unverified → 2,140 gross, confirmed.
  - `signup_to_deposit_pct`: 14.6%, unverified → 14.6% of gross signups, confirmed.
  - `round_profile`: "US angels plus a pre-seed fund as lead" (default) → "US angels first" (founder answer, confirmed).
  - `funds_named_total` (636,000) and `funds_unallocated` (114,000) removed; the pages now show the arithmetic. `use_of_funds_uncosted_amount` (114,000, the remainder of the ask) added so the use-of-funds identity holds while the budget is redone. The budget question stays open.
- **Recorded as founder statements with no file (kind assumption, status unverified, method "founder statement, 2026-11-10"):** `deposit_refund_requests` (4), `deposit_price_shown`, `founder_hardware_years` (9), `founder_profile`.
- **Added for the new outputs:** `waitlist_us_share_pct` (68), `tiktok_views` (900,000), `bom_unit_5000` (78), `alt_crock_price` (30), `alt_incubator_price` (4,000).
- **Founder wording rewritten in the narrative:** "the first countertop fermentation appliance", "$XXB trend" and "the platform for home fermentation" (see narrative.md section 6). Cut: "do not want to give them back", the three fermenters.
- **Check:** `pitch.py check` verdict PASS (0 FAIL, 0 WARN, 7 PASS), 34 entries.
- **Outputs written or updated:** pitch/narrative.md (new), pitch/investor-qa.md (new), pitch/START-HERE.md, pitch/gaps.md, pitch/facts.yaml.
- **Still open:** the budget; whether 312 is before or after the refunds; prototype evidence; competitor table; the co-founder decision.
