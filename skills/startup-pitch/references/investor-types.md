# Investor types: adapting the pitch to who is actually deciding

What this file is for: finding out who the pitch is for (from the folder, or with two questions), the default profile when nobody says, and how headline, slides, question themes and tone change by investor type and stage.
Read it when a target investor type or region is named, or before a narrative, Q&A or deck is tuned to one. A quick run needs only `core.md`, which carries the default and the two questions.
The eleven type blocks, the fund math and the regional table are in `investor-types-detail.md`: read only the block for the named type or region.

## Contents

1. Identify the target investor first (folder signals, the two questions, the default)
2. Adaptation table: investor type x stage -> numbers to lead with, slides, question themes, tone
3. What not to do
4. Output template: the `investor_profile` block and the ledger entries it needs

Jargon: *ownership* is the percentage held after the round; *check* is one investor's amount; *lead* sets
price and terms; *pro rata* is the right to keep one's percentage later; a *SAFE* (Simple Agreement for
Future Equity) converts into shares at a later *priced round*, where shares are sold at an agreed valuation.

## 1. Identify the target investor first

The investor type changes the headline number, the slide order, the question bank and the tone more than
the sector does. A grant jury scores against published criteria; an angel backs a person; a growth fund
underwrites a spreadsheet. Treat "who is deciding" as a required field, like stage.

Look in the folder before asking. Signals that usually settle it:

- Investor update emails, a CRM export, a target list, or a term sheet name the firm or programme.
- An application form (YC, Techstars, Antler, EF, EIC, Innovate UK, SBIR) fixes both format and criteria.
- A SAFE, ASA, BSA-AIR or convertible loan draft tells you the instrument and therefore the region and stage.
- The ask size itself constrains the type: a check-size rule (`investor-types-detail.md` section 1) rules whole classes in or out.

If none of these are present, ask at most two questions, in `START-HERE.md` section 1 (they count as one of its five) and in the first conversational turn:

> **Q1. Who are you pitching this to first?** Angels or an angel syndicate, a pre-seed or seed fund, a
> multi-stage VC, a strategic or corporate VC, a family office, an accelerator (which one), a public grant
> or competition (which one), a crowdfunding platform, a lender (venture debt or revenue-based financing),
> a university or impact fund, or several at once. If several, which meeting is first?
>
> **Q2. Where are they, and where is the company incorporated?** US, UK, Germany, France, elsewhere in
> the EU, other. This sets the instrument, the deck convention and the traction bar.

With no answer, apply the default and write it to `run-log.md`: **assume a financial investor (angels plus
a seed fund as lead) at the stage implied by the ledger, in the company's home country, with a reading deck
sent ahead and a presenting deck for the meeting.** Mark it `kind: assumption` in `facts.yaml` (section 4)
so the founder can correct it in one edit.

When several types are named, produce one narrative and one ledger, then per-type variants only where
section 2 says the headline, slides or tone differ. Do not write five decks.

## 2. Adaptation table: investor type x stage

Rows give the headline numbers to lead with, slides to add or drop versus the default deck in
`deck-structure.md`, the question themes to prepare in `investor-qa.md`, and the tone.

| Investor type x stage | Lead with | Add | Drop or shrink | Question themes | Tone |
|---|---|---|---|---|---|
| Angels, pre-seed | Founder story, first users by name or role, why now | A "what I need besides money" slide | TAM detail, five-year P&L | Demand reality, status quo, who else is in | Personal, concrete |
| Angels or syndicate, seed | Paying customers, monthly growth, lead status | SEIS/EIS or INVEST eligibility line (UK/DE) | Competition matrix depth | Round structure, lead, valuation cap logic | Confident, brief |
| Seed fund, pre-seed or seed | Repeatable wedge evidence, growth over 3 to 4 months, bottom-up market | Next-ten-customers slide; fund-math sanity line in notes | Vision slide to the end | Why not anyone else, next milestone, cap table | Direct, evidence-first |
| Multi-stage VC, seed | Market size path to USD 100 million revenue, Series A milestone | Series A plan slide | Nothing extra; keep tight | Follow-on policy, signalling, ambition | Ambitious, precise |
| Growth fund, Series B+ | NRR, gross margin, CAC payback, burn multiple, cohort chart | Pipeline and quota slide, model assumptions appendix | Problem and product story to one slide each | Model stress tests, sales efficiency, scaling limits | Operator to operator |
| Corporate VC, any stage | Integration or distribution with the parent, pilot status | Partnership roadmap slide; what the parent learns | Exit slide (handle in Q&A) | Sponsor identity, ROFR and exclusivity, conflicts | Collaborative, guarded on terms |
| Family office, any stage | Durability, founder background, referral path | Long-horizon plan slide | Blitz-growth language | Horizon, governance, co-investors | Calm, relationship-led |
| Accelerator application | One-sentence what-you-do, users and what you learned, speed of shipping | Nothing beyond the form | Everything the form does not ask for | Demand, users, why this team, competitors | Plain, no adjectives |
| Accelerator demo day | One traction number, one insight, one ask line | Large type, one point per slide | Team detail, appendix | None live; prepare for investor follow-ups | Fast, declarative |
| Grant or competition | Criteria mapping, measurable outcomes, budget by work package | Risk and mitigation slide, Gantt, impact or public benefit | Valuation, dilution, hockey-stick | Each criterion, eligibility, why public money | Formal, criterion-labelled |
| Crowdfunding | Story, community size, perks, min and max target | Video, FAQ, perks tier | Investor jargon, cohort tables | Use of funds, exits for retail, risks | Warm, plain-language |
| Venture debt or RBF | Revenue, cash collection, churn, runway, equity sponsors | Downside case, covenant headroom | Vision, market, team to one line | Repayment source, concentration, bridge-to plan | Banker-plain |
| University or impact fund | IP position or theory of change, translational milestones | Licence terms line; impact metrics tied to ledger | Nothing else changes | Scientist time, licence, additionality, measurement | Rigorous, honest about cap table |

Rules for using the table:

1. Change headline and order first; only then add or drop slides. The ledger does not change.
2. Every added slide still sources its numbers to `facts.yaml`; impact and grant outcomes are
   `kind: projection` with their drivers named.
3. Two types in one meeting (seed fund plus strategic): use the financial row, strategic "add" slides in appendix.

## 3. What not to do

- Do not invent VC personas or attribute "signature questions" to named real investors without a source
  and year. Upstream profiles that list questions for named people without citations (the lowesyang
  vc-profiles for Intel Capital, M12 and individual angels) are not reusable until each claim is traced to a
  public statement. Generic question patterns with a source are fine.
- Do not state a fund's size, ownership target or check band unless it is public and dated. Use the bands
  in `investor-types-detail.md` section 1 and label the calculation an assumption.
- Do not copy accelerator or grant terms from memory; quote the live page and date it. Terms moved in 2025
  for Techstars, Antler and the EIC.
- Do not present a SAFE or BSA-AIR cap as a valuation; model conversion at the cap and show the dilution
  (omer-metin sharp_edges, 2025: USD 1 million at a USD 10 million cap is 10 percent at the A, not 5).
- Do not send a VC deck to a grant evaluator or a grant narrative to a VC: different judges, different rubric.
- Do not call venture debt or revenue-based financing "non-dilutive equity"; both are repayable, and
  venture debt carries warrants.
- Do not let an investor-type variant introduce a number that is not in the ledger. Variants reorder and
  reframe; they never add facts.

## 4. Output template

Put this block at the top of `investor-qa.md`, and directly under the open-questions pointer line of
`narrative.md`, when those files are written; fill from the folder, then section 1. A quick run records only
the one-line ledger entry described in `core.md`.

```yaml
investor_profile:
  primary_type: seed_fund            # angel | angel_syndicate | preseed_fund | seed_fund | multistage_vc | growth_fund | corporate_vc |
                                     # family_office | accelerator | grant | competition | crowdfunding | venture_debt | rbf | university_fund | impact_fund
  secondary_types: [angel_syndicate]
  named_targets: []                  # firms or programmes named in the folder, with the file that names them
  region_investor: UK
  region_company: UK
  instrument_expected: ASA           # SAFE | ASA | BSA-AIR | convertible_loan | priced | grant | loan | n/a
  deck_mode: reading_then_presenting # reading | presenting | reading_then_presenting | form
  source: assumption                 # folder | founder_answer | assumption
  note: "No investor files found; default applied (section 1). Founder to confirm."
```

Ledger entries the profile needs (all `kind: assumption` unless a file proves them; add
`target_fund_size_band` as `ask_amount / 0.03` to `ask_amount / 0.01` when a fund is named):

```yaml
  - id: ask_amount
    label: Round size being asked for
    value: 1500000
    unit: GBP
    kind: assumption
    status: unverified
    source: notes/fundraising-plan.md
  - id: implied_post_money
    label: Post-money implied by a 20 percent round
    value: 7500000
    unit: GBP
    kind: assumption
    status: unverified
    derived_from: ask_amount / 0.20
    note: 20 percent norm per Carta data summarised by SaaStr, 2024
```

In `investor-qa.md`, add one section per type in `secondary_types` headed "If the room is a <type>", with
that type's three questions from `investor-types-detail.md` section 2 and the strongest honest answer from the ledger. When `source: assumption`,
the two section 1 questions stay open in `START-HERE.md` section 1 (and in `gaps.md` under "Missing information that changes the pitch" when that file exists).
