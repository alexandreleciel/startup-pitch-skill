# Investor types in detail: fund math, eleven type blocks, regional conventions

What this file is for: the fund-returner arithmetic every VC runs, one block per investor type (what they optimise for, check, process, questions, turn-offs, ask framing), and the US, UK and EU conventions.
Read only the block for the named investor type or region, and section 1 when a fund's size or the ask needs a sanity check. Do not read through.
Detection of the target investor, the default profile, the type x stage adaptation table and the profile block are in `investor-types.md`; a quick run needs only `core.md`.

## Contents (read only the block for the named investor type or region)

1. The fund math every VC runs, with a reusable worked example
2. Investor types
   - 2.1 Angels and angel syndicates
   - 2.2 Pre-seed and seed funds
   - 2.3 Multi-stage VC
   - 2.4 Growth funds
   - 2.5 Corporate VC and strategics
   - 2.6 Family offices
   - 2.7 Accelerators
   - 2.8 Public grants and competitions
   - 2.9 Equity crowdfunding
   - 2.10 Revenue-based financing and venture debt
   - 2.11 University and impact funds
3. Regional differences founders hit: US, UK, Germany, France, elsewhere

Jargon: *ownership* is the percentage held after the round; *check* is one investor's amount; *lead* sets
price and terms; *pro rata* is the right to keep one's percentage later; a *SAFE* (Simple Agreement for
Future Equity) converts into shares at a later *priced round*, where shares are sold at an agreed valuation.

## 1. The fund math every VC runs

A venture fund is judged on whether the whole fund returns a multiple to its investors (LPs), and most of
that return comes from one or two companies. So the VC's question is not "is this a good business" but
"could this one company return my fund, and will I own enough of it when it does?" Venture returns follow
a power law: a few deals produce most of a fund's gains (Horsley Bridge data, historical; VC Beast and
Qubit Capital explainers, 2025).

**The formula, explicit:**

```
required_exit_value  =  fund_size  /  ownership_at_exit
ownership_at_exit    =  ownership_at_entry  x  (1 - dilution_round_2) x (1 - dilution_round_3) x ...
initial_check        ~  (fund_size - fees - follow_on_reserves) / number_of_companies
ownership_at_entry   =  initial_check / post_money_valuation
```

Sourced parameters to plug in (never invent a specific fund's numbers; use these published bands):

- Seed fund ownership targets: Homebrew (Hunter Walk) aimed for 10 to 15 percent at seed, and its third
  fund averaged 11.6 percent across 31 companies (Hunter Walk, December 2025). Harlem Capital's guide gives
  5 to 7 percent for a USD 10 to 25 million fund, 6 to 8 percent for 25 to 50 million, 8 to 10 percent for
  50 to 75 million (Harlem Capital, undated, accessed 2026).
- Initial check: 1 to 3 percent of fund size per company, with only 40 to 60 percent of the fund going
  into first checks (Harlem Capital, undated, accessed 2026); pedronauck's vc-strategy reference uses a 2
  percent rule for 10 to 20 percent ownership (pedronauck, 2026, synthesising NFX and Jason Lemkin).
- Dilution: roughly 20 percent at seed and again at Series A (Carta data summarised by SaaStr, 2024; YC
  calls 10 percent excellent and over 25 percent to be avoided).
- Odds: about 5 percent from a first one-to-one meeting; firms quote 25 to 60 percent offer rates once a
  company reaches the partner meeting, usually 45 to 60 minutes with 5 to 15 investors (First Round
  Review, Liz Wessel, August 2024).

**Worked example the model can reuse (illustrative fund, not a real one):**

> A hypothetical USD 60 million seed fund wants 10 percent ownership at entry (inside the Harlem Capital
> 8 to 10 percent band and the Homebrew 10 to 15 percent band).
> Entry: a USD 1.5 million check at a USD 15 million post-money buys 10 percent.
> Dilution: two later rounds at 20 percent each leave 10% x 0.8 x 0.8 = 6.4 percent at exit.
> Fund-returning exit: 60 / 0.064 = about USD 940 million.
> So the partner must believe this company can be worth close to a billion dollars. If the founder's own
> bottom-up market work cannot support a path to roughly USD 100 million of revenue, this fund will pass
> however good the product is. If the ask were USD 6 million instead of 1.5 million, a 60 million fund
> cannot write it without breaking its portfolio construction; change the fund or the number.

Use the example to sanity-check the ask in `facts.yaml`: compute `implied_post_money = ask / 0.20` (the
20 percent norm) and `implied_fund_size_band = ask / 0.01 to ask / 0.03`. If the folder names a fund whose
size is public, run the formula with that size and show the required exit in `investor-qa.md`. Label every
output of this calculation `kind: assumption`.

This is why VCs probe market size and exit path harder than profit, why they ask "who else is in" (herd
dynamics, Paul Graham, 2013), and why a smaller ask to a smaller fund can succeed where a large fund passed.

## 2. Investor types

Each block: what they optimise for; check and ownership; process and timeline; what they weigh most;
signature questions (generic, with the source of the pattern); turn-offs; how to frame the ask and use of
funds. Numbers carry source and year; where no source exists the principle is stated.

### 2.1 Angels and angel syndicates

- **Optimise for:** the founder and the story, plus a believable path to a large multiple on their own
  money. Angels invest their own capital, decide alone and fast, and have no fund structure forcing check
  size (Paul Graham, "The Hacker's Guide to Investors", 2007, historical).
- **Check and ownership:** small per person. UK platform data shows a median GBP 25k per investor, with
  friends-and-family rounds averaging GBP 70k, angel rounds GBP 200k and VC-led rounds GBP 650k (SeedLegals,
  undated); 2,430 UK companies raised GBP 276 million under SEIS in 2024 to 2025, about GBP 114k each (HMRC,
  May 2026). Syndicates pool small checks into one SPV led by one angel who takes a share of profits, so the
  cap table shows one line (AngelList model; omer-metin sharp_edges, 2025, on SPVs versus party rounds).
- **Process:** one or two conversations, often a decision in the meeting; a syndicate lead then runs a
  short window for members. Days to weeks.
- **Weigh most:** founder credibility, why now, who else is in (the most common investor question, Paul
  Graham, 2013), what you need besides money. Calacanis's angel set: why now, why you, what you will do
  with the money, who else is in (*Angel*, 2017).
- **Signature questions:** "How do you know this person needs it, not just likes it?" (demand reality,
  garrytan gstack forcing questions, 2026). "What did you ship in the last two weeks?" (velocity pattern,
  common at pre-seed funds). "What will you do with my money in the next 90 days?"
- **Turn-offs:** a party round with no lead and nobody writing over about USD 200k (omer-metin, 2025);
  cold outreach with no referral; a founder who cannot name a customer by role and company.
- **Ask framing:** small, round, and tied to a concrete next milestone. Tax wrappers matter: UK angels want
  SEIS/EIS eligibility confirmed up front (HMRC rules, section 3); German angels can claim the INVEST grant
  (section 3). Lead the deck with the founder story and the first customers, not the TAM.

### 2.2 Pre-seed and seed funds

- **Optimise for:** ownership at a price that leaves room for the next round, inside the fund math of
  section 1. Seed funds typically see around a thousand companies a year and back a handful.
- **Check and ownership:** 10 to 15 percent at seed cost about USD 1 to 2 million (Hunter Walk, 2025).
  Median US seed pre-money reached USD 16 million in Q3 2025 (Carta, Q3 2025). Pre-seed SAFE cap medians
  were about USD 10 million for USD 250k to 1 million rounds and 15 million for 1 to 2.5 million rounds
  (Carta State of Pre-Seed, 2025); SAFEs were 92 percent of pre-priced rounds (Carta, Q3 2025).
- **Process:** first meeting, partner meeting, light diligence and references; two to eight weeks when
  competitive. Many seed partnerships approve what a sponsoring partner brings; Series A committees kill
  deals (pedronauck vc-strategy, 2026).
- **Weigh most:** founder-market fit, the unique insight, early evidence the wedge repeats outside the
  founders' hands, and a bottom-up market that clears roughly a billion dollars (pedronauck, 2026, citing
  CRV 2026 and Graham & Walker 2025).
- **Signature questions:** "Why not anyone else with the same tools?" "Walk me through the next ten
  customers by title and company size." "What is the one thing everyone disagrees with you about?"
- **Turn-offs:** an ask implying a post-money the fund cannot buy into; stacked SAFEs at rising caps that
  silently sold 20 percent before the A (Hustle Fund staircase, via pedronauck, 2026); raising to hire the CTO.
- **Ask framing:** amount plus the 18 to 24 month milestone it buys, with two or three plans where more
  money buys faster growth, not longer runway (NFX, via pedronauck, 2026). State that the round is open to a
  lead or already has one.

### 2.3 Multi-stage VC (seed through growth under one roof)

- **Optimise for:** an option on the company. A seed check from a large fund is cheap for them and buys
  information plus the right to lead the A. The founder's risk is signalling: if that fund does not lead
  the next round, others read it as a pass.
- **Check and ownership:** larger first checks than seed funds, sized to reserve heavy follow-on. Exact
  figures depend on the fund; use the section 1 formula with the fund's public size.
- **Process:** the sponsoring partner, then a partner meeting; the firm is also evaluating whether the
  company could absorb a 10 to 20 million Series A from them.
- **Weigh most:** market size large enough for a billion-dollar-plus fund, founder ambition, defensibility.
- **Signature questions:** "What does this look like at 100 million of revenue?" "What is your Series A
  milestone and what are you not spending on until then?"
- **Turn-offs:** anything that caps the outcome (niche market, services revenue, lifestyle ambition).
- **Signalling evidence, both sides:** seed companies whose "smart money" VC did not follow on raised a
  Series A 27 percent of the time against a 35 percent baseline (CB Insights, 2015, data 2008 to 2013,
  historical); NEA's first 35-company seed cohort saw other firms lead the A almost twice as often as NEA,
  which argued the signal was weak (NEA, 2013, historical). Ask the fund how often it leads the next round
  for its seed companies, and diversify option-holders.
- **Ask framing:** as for a seed fund, plus what the Series A must look like: they underwrite two rounds at once.

### 2.4 Growth funds (Series B and later)

- **Optimise for:** predictable compounding. They are buying a model, not a story.
- **Check and ownership:** tens of millions for 10 to 20 percent is the common shape; exact bands vary by
  fund and are not stated here without a source.
- **Process:** data room first, meetings second; cohorts, pipeline, unit economics, customer calls; one to three months.
- **Weigh most:** net revenue retention, gross margin, CAC payback, burn multiple (net burn over net new
  ARR, David Sacks, 2020), growth plus margin (Rule of 40, Brad Feld, 2015). Series A context: median
  pre-money USD 49.3 million in Q3 2025, and USD 3 million ARR framed as the new Series A bar, reached by
  about one in five seed companies (Carta, 2025).
- **Signature questions:** "Show me the cohort chart with your worst cohort included." "Where does the
  sales team's quota attainment sit this quarter?" "What breaks at 3x the current volume?"
- **Turn-offs:** blended CAC hiding paid versus organic; cumulative charts; a model whose assumptions are
  not in the folder.
- **Ask framing:** amount, the plan it funds with monthly detail, and the efficiency metrics it is expected
  to hold or improve. Lead with the metrics slide, not the problem.

### 2.5 Corporate VC and strategics

- **Optimise for:** fit and option value. Corporate motives split into driving the parent's strategy,
  enabling demand for its products, learning about adjacent markets, and financial return (Henry Chesbrough,
  "Making Sense of Corporate Venture Capital", HBR, 2002, historical).
- **Market context:** CVC-backed funding was USD 65.9 billion in 2024, up 20 percent, across 3,434 deals,
  the fewest since 2018; 65 percent of deals were seed or Series A; median deal USD 8.6 million (CB Insights,
  February 2025). Deal count fell to 728 in Q1 2025, a seven-year low (CB Insights, 2025).
- **Process:** two decision makers, the venture team and a business-unit sponsor, so expect more meetings
  and a longer calendar than a seed fund; the sponsor leaving can kill the deal. Ask who the sponsor is.
- **Weigh most:** how the company fits the parent's roadmap, whether a pilot or commercial agreement comes
  with the money, and what the parent learns.
- **Signature questions:** "How does your success grow demand for our products?" "Who in our business
  would use this next quarter?" "What happens to the relationship if a competitor of ours acquires you?"
- **Turn-offs for the founder to watch (terms, not personalities):** right of first refusal on a sale,
  board vetoes, exclusivity, information rights that leak to a competing unit (omer-metin sharp_edges,
  2025). Keep the commercial agreement and the equity in separate documents with separate termination.
- **Ask framing:** lead with the integration or distribution story and the pilot; state the strategic
  value in the parent's vocabulary; keep the financial ask identical to what financial investors see.

### 2.6 Family offices

- **Optimise for:** the family's own thesis and relationships; patient capital with no fixed fund life, so
  no forced exit clock. Most active at seed and Series A, sourcing through networks, fund managers and other
  families (SVB and Campden Wealth, 2020, historical).
- **Check and ownership:** varies more than any other class; no reliable median is stated here.
- **Process:** relationship first, often one principal decides; speed varies widely, so ask rather than assume.
- **Weigh most:** alignment with the family's sectors or operating businesses, trust through referral,
  founder quality, and terms that match a longer horizon.
- **Signature questions:** "How did you get to us?" "What would you do differently with a ten-year
  horizon?" "Who else is at the table?"
- **Turn-offs:** treating them as a cheaper VC; pressure tactics; unclear governance.
- **Ask framing:** the same ledger, a calmer tone, more on durability and less on blitz growth. Judge them
  by the same investor-quality bar as a fund (reference calls both ways).

### 2.7 Accelerators (YC, Techstars, Entrepreneur First, Antler and peers): fixed public terms, quote the live page

- **Y Combinator:** USD 500,000 as two SAFEs signed together: USD 125,000 on a post-money SAFE for 7
  percent, and USD 375,000 on an uncapped SAFE with a most-favoured-nation clause (converts on the best
  terms of a later SAFE; at a USD 15 million cap it would be about 2.5 percent). Pro rata rights; not
  contingent on milestones; invests only in US, Canada, Cayman and Singapore corporations, so non-US
  founders restructure under a parent in one of those (YC deal page, accessed 2026). Application: short
  written answers plus a founder video; the interview is about ten minutes and tests whether founders can
  state what they do, what users told them and the numbers, without preamble (YC interview guide;
  pedronauck yc-apply, 2026).
- **Techstars:** USD 220,000 from the Fall 2025 programmes: USD 200,000 on an uncapped MFN SAFE plus USD
  20,000 for 5 percent of common stock on a post-money basis; Asia-Pacific programmes offer a USD 100,000
  SAFE instead (Techstars, April 2025). Mentor-driven; the application varies by programme.
- **Entrepreneur First:** forms teams before a company exists, pays an equity-free stipend during
  formation, then invests up to about USD 250,000 after its investment committee, reported as USD 125,000 on
  a post-money SAFE for 8 percent plus USD 125,000 on an uncapped MFN SAFE (third-party guides, 2025 to
  2026; verify on joinef.com).
- **Antler:** terms are set per market. UK from autumn 2025: GBP 125,000 for 8.5 percent (less a GBP 40,000
  service fee) plus a GBP 85,000 MFN convertible note, and a rolling follow-on matching 50 percent of an
  outside round within nine months, capped at GBP 165,000 or 330,000 by round size (Antler, 2025). Nordics:
  EUR 200,000 pre-seed plus EUR 300,000 pre-committed follow-on (Antler, July 2025).
- **What they weigh:** team first, then speed of learning and evidence of demand; the idea last. Format
  matters as much as content: hit the word and slide limits exactly.
- **Turn-offs:** jargon, platform visions with no wedge, founders who cannot state what they do in one
  sentence, "interest" presented as demand (garrytan gstack, 2026).
- **Ask framing:** there is no ask slide; the programme's terms are the ask. Spend the space on what you
  will do in the three months and what the demo-day number will be.

### 2.8 Public grants and competitions (EIC Accelerator, Innovate UK, SBIR, pitch competitions)

Grants judge differently: criteria compliance, not conviction. An evaluator scores your text against a
published rubric, often without meeting you; one sub-threshold score can end the application.

- **EIC Accelerator (EU):** grant up to EUR 2.5 million for TRL 6 to 8 work, plus an equity component of
  EUR 1 to 10 million through the EIC Fund (the 2025 programme stated 0.5 to 10 million), with larger
  tickets under STEP Scale-up (EIC, accessed 2026). Three steps: short proposal (12-page form, deck of up
  to ten slides as PDF, video of up to three minutes with up to three team members; feedback in four to six
  weeks), full proposal (form up to 20 pages, annexes on financials, cap table, IP and a lump-sum budget; at
  least 13 of 15 remotely to pass), then a jury interview held twice a year (EIC, accessed 2026).
  Consultancies describe the interview as ten minutes of pitch and up to 35 minutes of questions from a jury
  of up to six, using the submitted deck with no new slides (euacc.ai and FFG listings, 2025; not confirmed
  in Commission text). Criteria: Excellence, Impact, and Level of risk, implementation and need for Union
  support (EIC Work Programme, 2025). The October 2025 cut-off had 923 full applications, 121 interviews
  and 61 funded, a 6.6 percent rate (EIC statistics, 2025 to 2026).
- **Innovate UK:** up to five independent assessors score each question against published matrices and
  rank applications (Innovate UK competition guidance, 2024 to 2025). The flagship Smart grant closed to
  new applications (UKRI, 2026); its historical success rate was low single digits, 4.4 percent in July 2022
  (GrantTree, 2022, historical). Grant intensity is capped by company size; quote the live brief for the
  percentages and the match-funding requirement.
- **SBIR/STTR (US):** equity-free federal awards; Phase I up to USD 335,937 and Phase II up to USD
  2,239,578 without a waiver (SBIR.gov, as of 16 October 2026). NIH scores Significance, Investigators,
  Innovation, Approach and Environment, with commercialisation weighing more in Phase II (NIH, standard
  criteria). Eligibility follows US small-business and ownership rules; check the current policy directive.
- **Pitch competitions:** every rubric differs: idea quality 20 percent and presentation 10 percent
  (University of Memphis TigerTank, 2026 to 2027), 45 points across problem, solution, product, traction and
  model (UT Arlington MAVpitch, 2025), presentation 30 percent of the final score (Idaho State, 2025). Get
  the rubric and map each slide to a criterion.
- **Signature questions:** "Which criterion does this paragraph answer?" "What is the measurable outcome at
  month 24?" "Why can the market not fund this?" (the need-for-public-support test).
- **Turn-offs:** missing eligibility items, unmeasurable outcomes, budgets that do not match the plan,
  copying a VC deck into a grant form.
- **Ask framing:** a budget by work package with eligible costs, a Gantt-style plan, risks with
  mitigations, and the public benefit stated in the funder's words. No valuation, no dilution talk.

### 2.9 Equity crowdfunding

- **Optimise for:** platform rules plus a crowd that buys the story. US Regulation Crowdfunding allows USD
  5 million per 12 months (SEC, since March 2021); 2024 raised USD 343.6 million, down 18 percent, median
  raise USD 60,000, average USD 257,000, average check USD 1,500 (Kingscrowd, 2024). UK investment
  crowdfunding fell to 297 deals and GBP 324 million in 2024 from GBP 773 million in 2021 (Crowdfund Insider
  citing Beauhurst, November 2025). The EU caps offers at EUR 5 million per 12 months (Regulation (EU)
  2020/1503).
- **Weigh most:** a consumer-legible story, an existing community, and visible pre-commitments before going public.
- **Turn-offs:** B2B infrastructure nobody outside the industry understands; no community to bring.
- **Ask framing:** minimum and maximum targets, perks, and a plain-language use of funds. Real capital,
  not smart money (Antler, via pedronauck round-design, 2026).

### 2.10 Revenue-based financing and venture debt (not equity)

Founders confuse these with equity. Neither buys shares; both must be repaid.

- **Venture debt:** a term loan alongside or after an institutional round, repaid over three to four years
  after an interest-only period, floating rate plus spread, with warrants (rights to buy a little stock) as
  the lender's upside. Guides put size at 20 to 35 percent of the last round, interest around 10 to 14
  percent and warrants from under 1 to a few percent of the loan, ranges varying by source (lender and
  adviser guides, 2025 to 2026). US market: USD 68.8 billion in 2025, about 1,000 deals, median USD 5.5
  million (Runway Growth Capital and PitchBook, May 2026). Lenders underwrite the equity investors behind
  you; without a recent institutional round most decline.
- **Revenue-based financing:** an advance repaid as a fixed percentage of monthly revenue until a capped
  multiple is paid, commonly quoted at 1.1x to 1.5x, open to companies without VC backing but with
  recurring revenue; one provider sets a floor of about USD 10,000 average monthly revenue over six months
  (Wayflyer help centre, accessed 2026; comparison guides, 2025 to 2026). Fast growth shortens repayment and
  raises the effective annual cost.
- **Weigh most:** cash collection, churn, concentration, covenants headroom. Not vision.
- **Turn-offs:** pitching the dream; missing bank data; using debt to fund an unproven experiment.
- **Ask framing:** amount, repayment source, a downside case where revenue falls 30 percent, and the equity
  round it bridges to. Drop the market and team slides to one line each.

### 2.11 University and impact funds

- **University funds and spinouts:** the university is often already a shareholder. The UK Independent
  Review of University Spin-out Companies (November 2023, all 11 recommendations accepted) points to the
  TenU USIT guide: about 10 percent or less university equity for software and other less IP-intensive
  spinouts, 10 to 25 percent for life sciences, royalties of about 0.5 to 5 percent (TenU USIT guide, 2023;
  Science Business, 2023). Such funds weigh the licence terms, the translational milestone and the founding
  scientists' time. Lead with the IP position and the de-risking plan; explain the cap table honestly.
- **Impact funds:** full financial diligence plus an impact diligence. Published question sets ask how
  tightly impact is tied to revenue (it should grow with sales, not sit beside them), the evidence chain
  from product to outcome (theory of change), how impact is measured over time, what could make the company
  drift, and who else at the table cares (Impact Engine, 2019; GIIN IRIS+ impact due diligence guidance,
  2020; Bertelsmann impact due diligence principles, 2024). Many test additionality: funded without us?
- **Ask framing:** add one impact slide with the theory of change and two or three metrics tied to the
  ledger; never let the impact slide replace the unit economics.

## 3. Regional differences founders hit

| Topic | United States | United Kingdom | Germany | France | Elsewhere |
|---|---|---|---|---|---|
| Early instrument | Post-money SAFE, the standard since 2018 (YC); 92 percent of pre-priced rounds (Carta, Q3 2025) | Advance Subscription Agreement (ASA) for SEIS/EIS angels; priced round on BVCA-style docs; a US SAFE does not qualify for SEIS/EIS (practitioner guides, 2024 to 2026) | Convertible loan (Wandeldarlehen) with qualified subordination; whether it needs a notary depends on its terms, and a mandatory conversion is usually notarised to avoid invalidity risk (Bird & Bird, 2023; Chambers, 2025); priced GmbH rounds always need a notary | BSA-AIR, a warrant under the Commercial Code, needs an extraordinary general meeting and an auditor report; usually a pre-money cap, a 15 to 25 percent discount and often a floor (Hectelion, 2025 to 2026) | Check local SAFE adaptations; many Asian and LatAm funds ask for a Delaware or Cayman parent |
| ASA tax conditions | n/a | HMRC expects no interest, no refund, no investor protections, not variable or assignable, shares issued within a longstop of about six months; relief dates from share issue (HMRC guidance via Ashfords and Bird & Bird, 2023 to 2024) | n/a | n/a | n/a |
| Angel incentives | None federal; some state credits | SEIS up to GBP 250,000 per company since April 2023; EIS above it (HMRC) | INVEST: 15 percent acquisition grant on angel investments from EUR 10,000, down from 25 percent, convertible loans eligible, guideline runs to December 2026 (BAFA guideline, March 2024, via IHK) | Madelin/IR-PME relief on direct subscriptions; applicability to BSA-AIR unclear (Hectelion, 2025 to 2026) | Varies |
| Round sizes | Seed median raise roughly USD 3 to 4 million on about USD 20 million post (Carta, 2025; reports differ by dataset); seed pre-money median USD 16 million (Carta, Q3 2025) | Digital and tech seed average GBP 1.8 million (Beauhurst via gov.uk, 2025); pre-seed/seed deal median around EUR 1.2 million on EUR 4.7 million pre-money (PitchBook, Q3 2025); seed deal count fell 27 percent in 2025 (British Business Bank, 2026) | European seed median about USD 1.4 million, with the US median more than double (Atomico, 2024); pre-seed/seed pre-money median EUR 5.0 million for Europe (PitchBook, Q3 2025) | Same European figures; Bpifrance co-invests through French Tech Seed convertible bonds alongside private money (French government, 2018 to 2019, historical) | Expect smaller rounds and more milestone tranching |
| Traction bar | Revenue growth weighted heaviest; strong B2B seed at roughly USD 250k to 1 million ARR for an institutional seed (CRV, "Pitching to Investors", July 2026, fetched 2026-11-10) | Investors focus earlier on profitability and want UK numbers plus a US expansion story; US VCs discount UK-only traction (GBX roundtable; founder newsletters, 2024) | European VCs weight international scalability and are more conservative (Block, Diegel, Fisch and Moritz, academic study, 2025) | Same, plus public co-funding often expected in the round | Ask local funds for their written bar |
| Deck convention | Short presenting deck, 12 to 14 slides; 25 will not work (Wilson Sonsini guide, undated); investors spend under three minutes on a sent deck (DocSend, 2025) | Reading deck sent ahead is normal; founders read as reserved, so state ambition explicitly (TechCrunch, 2014, historical) | Technology-led decks slide into feature lists; keep the business case first | EIC and Bpifrance vocabulary: "read deck" versus live pitch | Follow the programme's template when one exists |
| Public money in the round | SBIR grants; no equity | British Business Bank backs many seed funds (ECF programme: 50 funds, GBP 2.5 billion committed, 1,137 companies by June 2025) | HTGF (public-private seed fund) and KfW programmes co-invest; EIF is Europe's largest venture fund-of-funds | Bpifrance co-invests widely; Bourse French Tech grant for companies under a year old (historical) | Expect reporting and geographic conditions when public LPs sit behind the fund |

Practical consequences for the model:
- Convert currency once (`currency:` in `facts.yaml`), show both when the investor is abroad. A US fund
  will ask for a Delaware flip; YC requires a US, Canada, Cayman or Singapore parent (YC deal page, 2026).
  Put the planned structure in `investor-qa.md`.
- UK angels: confirm SEIS/EIS advance assurance before the ASA is signed, since relief starts at share
  issue (Bird & Bird, 2024). German convertibles: note whether the draft is notarised. Anything further is
  counsel-required; the upstream corpus has no cross-border mechanics (pedronauck round-design, 2026).
