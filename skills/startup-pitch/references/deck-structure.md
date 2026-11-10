# Deck structure: slide-by-slide rules and the deck.json mapping

What this file is for: the content rules for every slide type that `scripts/build_deck.js` renders from `pitch/deck/deck.json`, every field the builder accepts, the capacity table that says what fits, the stage variants, the speaker-note rules, and a complete worked example.
Read it when you are about to write or revise `deck.json`, when a founder asks "which slides do I need", or when the build prints capacity warnings.
Visual design (type, colour, layout) lives in `design.md`; metric definitions in `metrics.md`; the objection list in `investor-questions.md`; the ledger format in `file-formats.md`.

## Contents

1 Ground rules. 2 Slide types. 3 Field reference (everything the builder accepts). 4 Capacity table (what fits). 5 Stage variants. 6 Reader data and sequencing. 7 Speaker notes and timing. 8 Appendix and sources. 9 Charts. 10 Investor question and read-alone test. 11 Worked example (Meridian, 12 slides).

## 1. Ground rules that apply to every slide

- One message per slide. The headline is that message, written as a full sentence a stranger can repeat. If two ideas compete, split the slide (Hale, YC, 2015; YC Series A guide, 2020).
- Headline carries the takeaway, never the category. "Traction" is a label; "MRR grew 10x in 21 months" is a headline. A deck whose headlines, read in order with no bodies, still tell the story passes the read-alone test (section 10).
- Body budget: aim for 30 words of body on a presented slide and 50 on a read-ahead slide (Hale, 2015, demo day; DocSend observes funded decks average about 50 words per slide, 2025). These are writing targets. The limits that decide whether a slide fits are in the capacity table (section 4), which the builder checks before it renders; a stat label that carries its method (the market slide) does not count toward the word target. Four to six numbers per slide maximum; ten numbers reads as hiding weakness behind volume.
- Every number on a slide points to a ledger id (`"source": "fact:<id>"` on the slide, or `source` on each stat and chart). The checker fails the build otherwise; cover, closing and statement slides need no `source` when they show no figure. Facts can be stated flat; assumptions carry their method on the slide; projections carry their drivers. Never let the headline turn an assumption or projection into a fact ("Our market is 1.8B EUR" is wrong when the ledger says `kind: assumption`; write "We estimate a 1.8B EUR market: 12,000 operators x 150k EUR").
- Units and time context on every number: MRR or ARR, gross or net, MAU or DAU, and the month it describes (YC Series A guide, 2020).
- Forwardable: assume the deck circulates without you and without an NDA. Anything you would not want screenshotted belongs in the data room, not the deck; confidential material flagged in `gaps.md` (salaries, cap table, named customer contracts without permission) never enters `deck.json`.

## 2. Slide types

Each entry gives: purpose, the investor question it answers, must contain, must not contain, headline rule, density, deck.json fields, and headline examples. Fields marked (opt) are optional. Density lines say how many items a slide should carry; how long each may be is in the capacity table (section 4). All types accept `title`, `notes`, `question` (not rendered, see section 10) and `source`.

### cover. Fields: `title`, `subtitle`, `kicker`, `stats[]` (opt, max 3), `image` (opt, logo)
- Purpose: name the company and say what it does in one concrete sentence. The reader must know what you do before slide 2 (Seibel, YC; Harris, YC, 2018).
- Question: "What is this, in plain words?"
- Must contain: `title` (company name), `subtitle` (what you do, under 12 words, nouns a non-user understands), `kicker` (round and month, e.g. "Seed round, November 2026").
- Must not contain: a vision statement instead of a description ("Reimagining logistics"), a tagline that needs the product to be understood, team photos, funding history.
- Headline rule: the subtitle is the headline; concrete verb plus concrete object.
- Density: 1 sentence plus kicker. Optional 3 fast facts as `stats` (founded, customers, raising) when the deck is a read-ahead (Sequoia, Hilaly, "fast facts" opener).
- Good: "Dock scheduling that carriers actually use". Bad: "The operating system for the future of freight".

### problem. Fields: `title`, `points[]` (max 3), `stats[]` (opt, max 2), `image` (opt), `source`
- Purpose: prove a specific, expensive pain exists and is solved badly today.
- Question: "Who hurts, how much, and what do they do about it now?"
- Must contain: who feels it, how often, what it costs, the current workaround (the workaround sets up competition). A number in the headline (NFX; Jarvis).
- Must not contain: the word "Problem" as the title, three unrelated problems, your solution, generic claims ("the industry is inefficient").
- Headline rule: a data-backed sentence from the customer's world.
- Density: 3 points max, 1 to 2 numbers, one visual at most.
- Good: "Trucks wait 94 minutes at the average mid-size dock, and nobody is paid for that time". Bad: "Logistics is broken".

### solution. Fields: `title`, `subtitle` (opt), `points[]` (max 3), `image` (opt)
- Purpose: show one use case solved clearly better. Lead with what, not how (Hale, 2015).
- Question: "What do you do about it, and for whom?"
- Must contain: what the product is (app, API, device, service), the one core workflow, the outcome with a number where one exists. Each pain named on the problem slide should visibly disappear here.
- Must not contain: feature lists, architecture diagrams (appendix), roadmap items presented as shipped.
- Headline rule: "[Customer] does [outcome] in [time or cost]" or "We [verb] so that [customer] can [outcome]".
- Density: 3 points max, one image or mock.
- Good: "Carriers book a dock slot in 40 seconds from their phone, no account needed". Bad: "An AI-powered platform for supply chain orchestration".

### product. Fields: `title`, `image` (opt), `points[]` (3), `source`
- Purpose: make the product real. One image or mock plus three proof points that it works.
- Question: "Does it exist, and does it do what you say?"
- Must contain: `image` when the folder has one (screenshot, photo of hardware, or mock marked as mock; with none, leave the field out and the points take the full width, see section 3) and 3 `points[]`, each a proof point (shipped since, used by, measured result). State what is live and what is planned; the ledger decides which is fact.
- Must not contain: more than one screenshot in a presented deck (illegible from distance, Hale, 2015), feature tours, "coming soon" items unlabelled.
- Headline rule: the product's job in one sentence.
- Density: 3 points, each under 12 words.
- Good: "One screen replaces the phone, the fax and the gatehouse clipboard". Bad: "Product overview".

### insight. Fields: `title`, `points[]` (max 3), `stats[]` (opt, max 1), `source`
- Purpose: the secret, the thing you know or can do that others do not, and why that makes the approach work (Harris, YC, 2018, "Insight"; NFX "secret sauce"). This slide carries the "why us" argument and often the why-now.
- Question: "Why does this work now, and why will you be the one to build it?"
- Must contain: the non-obvious observation, the mechanism it enables, the external change that makes it possible now (an inflection you can cite). A missing why-now beats a fake one (50Folds via pedronauck corpus).
- Must not contain: generic tailwinds ("AI is booming"), a list of trends with no mechanism.
- Headline rule: the insight itself, stated as a claim someone could disagree with.
- Density: 2 to 3 points, 1 cited external data point.
- Good: "Carriers will self-serve if booking takes under a minute and needs no account; incumbents require both". Bad: "Our unique approach".

### market. Fields: `title`, `stats[]` (exactly 3, each `label` includes the method), `points[]` (opt, max 2 for sources and narrowing), `source`
- Purpose: show the prize is large and that you know exactly who buys first. Bottom-up SAM with the arithmetic on the slide (Seibel, YC; Harris, YC, 2018). Investors need the method more than the number.
- Question: "How big can this get, and how do you know?"
- Must contain: TAM, SAM, SOM each with its method in one line, the customer count source, your real price. Mark each as `kind: assumption` in the ledger and show the method on the slide.
- Must not contain: "1% of a 500B market", a research-firm headline as the only figure, stacked TAMs from adjacent business models.
- Headline rule: the SAM with its method, not the TAM alone.
- Density: 3 stats (TAM, SAM, SOM) each with a method label; no more.
- Good: "185M EUR serviceable today: 12,000 EU mid-size operators x our 15.4k EUR contract". Bad: "A 1.8 trillion dollar logistics market".

### traction. Fields: `title`, `chart{kind, labels[], series[{name, values[]}], y_label, source}`, `stats[]` (2 to 4, each with `source`), `notes`
- Purpose: prove momentum with one chart and two to four stats. The most scrutinised slide alongside team and financials (DocSend, 2015; DocSend seed report, 2020).
- Question: "Is this working, and how fast?"
- Must contain: a trajectory chart with time on the x-axis, y-axis from zero, at least 4 to 6 months of history to be believable (YC Series A guide, 2020), the headline metric, elapsed time ("10x in 21 months"), and incremental beside cumulative where a cumulative is shown. One acknowledged weakness with its fix belongs in notes or on the slide.
- Must not contain: cumulative-only charts (read as hiding monthly numbers, YC Series A guide, 2020), double axes, more than 4 stats, vanity metrics (signups, downloads) without retention, projections.
- Headline rule: metric, growth, time: "EUR 41k MRR, up 10x in 21 months".
- Density: 1 chart and up to 4 stats (3 in the read variant), or fewer stats and one point; section 4 lists the combinations.
- Pre-revenue: replace the chart with a proof stack as `points[]` in strength order: paid pilots, production deployments, named design partners, scoped LOIs, willingness to pay, qualified waitlist (a16z Casado, 2018; pedronauck proof-slides). A bad traction slide is worse than none (Seibel, YC).
- Good: "MRR grew from 4k to 41k EUR in 21 months with 2 logos lost". Bad: "Strong early traction".

### business_model. Fields: `title`, `stats[]` (max 4) or `columns[]` plus `rows[]` (max 4 rows), `points[]` (opt, max 2), `source`
- Purpose: show exactly one way money flows to you, with the unit.
- Question: "Who pays, how much, and does a euro in produce more than a euro out?"
- Must contain: who pays, the pricing unit and price, average contract value, gross margin if known, CAC payback if measured (label the data window). One model; alternatives are one line of "later".
- Must not contain: three models "to be tested", pricing "TBD", LTV from 3 months of data presented as fact.
- Headline rule: "[Customer] pays [price] per [unit]; [margin or payback]".
- Density: 3 to 4 stats or a 3-row table; one sentence of body.
- Good: "Operators pay 1,280 EUR per site per month; 81 percent gross margin, 9-month payback". Bad: "SaaS subscription with multiple revenue streams".

### go_to_market. Fields: `title`, `points[]` (max 3), `stats[]` (opt, max 2), `source`
- Purpose: one acquisition motion that is already working, with its numbers; a second at most. A list of channels reads as no strategy (Slidebean teardowns, 2024, via pedronauck corpus).
- Question: "How do you get customers repeatably, and what does one cost?"
- Must contain: beachhead segment, the channel, who sells, sales cycle length, CAC or cost per meeting, and the evidence it works ("9 of 32 customers came from carrier referrals").
- Must not contain: untested channels, unsigned partnerships, "viral growth" without evidence.
- Headline rule: the motion plus its proof number.
- Density: 3 points, 2 stats.
- Good: "Founder-led sales closes a 15k EUR contract in 34 days; 9 of 32 customers came from carrier referrals". Bad: "Multi-channel GTM: sales, marketing, partnerships".

### competition. Fields: `title`, `columns[]` (with or without a leading empty cell for the row labels), `rows[]`, `points[]` (opt, max 1), `source`
- Purpose: show you know the landscape and name a durable edge. Use a power grid or a feature matrix with your company in the first column, 3 real alternatives (including the status quo: spreadsheets, phone, "do nothing"), and 4 to 7 quantified benefit rows in customer priority order (Dreamit power grid, Barsh; lowesyang, 2024 to 2026). Never the 2x2 with the empty top-right, which investors read as a tell.
- Question: "Why will you win against the obvious alternatives, and why won't the incumbent copy you?"
- Must contain: `columns[]` (you first, then 3 alternatives), `rows[]` (benefit, then one cell per column, quantified: "40 s" not "fast"), at least one row where an alternative is honestly ahead, one sentence on the durable edge.
- Must not contain: "no competitors", disparaging language, only startups while ignoring the incumbent, feature counts as the edge.
- Headline rule: the edge in one sentence.
- Density: 4 columns x 4 to 7 rows (6 with a point underneath), cells under 4 words.
- Good: "Only Meridian lets a carrier book without an account; the two incumbents require one". Bad: "Competitive landscape".

### team. Fields: `title`, `team[]` (`{name, role, bio, photo}`) or `rows[]` (`[name, role, proof line]`), `points[]` (opt, max 1 for prior collaboration)
- Purpose: founder-market fit and who builds. The one slide present in nearly every funded seed deck (DocSend, 2015).
- Question: "Why these people, and who writes the code?"
- Must contain: 2 to 4 founders and key hires, each with role, one specific accomplishment with a number or a name, and the technical founder identified. Prior collaboration if any. Capital-efficiency proof fits here ("1.1M EUR spent to reach 492k EUR ARR").
- Must not contain: advisor walls ("Nobody cares about your advisors", Harris, YC, 2018), existing-investor logos (invites "are they leading?", YC Series A guide, 2020), employee headshot grids, degrees without relevance.
- Headline rule: the fit, not the word "Team".
- Density: max 4 people, one line each (under 15 words).
- Good: "We ran 40 docks and built the scheduling engine at a 2B EUR carrier". Bad: "A world-class team".

### financials. Fields: `title`, `chart{}` or `columns[]` plus `rows[]`, `points[]` (drivers, max 5), `source`
- Purpose: show you understand the levers. Chart or table with the drivers visible; investors judge the assumptions, not the number (lowesyang Series A structure, 2024 to 2026; preuve.ai via pedronauck corpus, 2026).
- Question: "What does the next 24 to 36 months look like, and what drives it?"
- Must contain: history plus 24 to 36 months forward (3 years at seed, up to 5 at Series A), 3 to 5 named drivers (hires, win rate, ACV, churn), a sensitivity line. Every forward figure is `kind: projection` in the ledger and labelled "projection" on the slide.
- Must not contain: a hockey stick that starts the month the round closes, a 5-year model at pre-seed, revenue derived backwards from a target, three scenarios on one slide.
- Headline rule: the end state plus the main driver, labelled as a projection.
- Density: 1 chart or 1 table (max 5 rows), 3 to 5 driver points; beside a chart five points fit only when each is one line (section 4).
- Good: "Projection: 200k EUR MRR by Oct 2028, driven by 4 AEs closing 2 sites each per month". Bad: "Financial projections".

### ask. Fields: `title`, `subtitle` (opt), `use_of_funds[]` (`{label, pct}`) or `chart{kind: "stacked_bar"}` or `stats[]` (amount, allocation, runway), `milestones[]` or `points[]` (max 4), `source`
- Purpose: the climax. Amount, use of funds, the milestones it buys, the runway. About 70 percent of pitches never clearly ask (Seibel, YC, 2023, via pedronauck corpus).
- Question: "How much, for what, and what will be true when it is spent?"
- Must contain: one amount (no range), allocation in 3 to 4 buckets as percentages, 2 to 4 milestones with number and date, runway in months with the next-round bar it reaches, non-capital asks if any.
- Must not contain: valuation or terms, "18 months of runway" as the only plan, headcount as the goal, "open to offers".
- Headline rule: amount plus the milestone it buys.
- Density: 1 stacked bar or 3 to 4 stats for allocation, 2 to 4 milestone points.
- Good: "Raising 3M EUR to reach 200k EUR MRR and 150 sites in 24 months". Bad: "The ask".

### roadmap. Fields: `title`, `milestones[]` (`{when, what, proves}`) or `rows[]` (`[date, milestone, what it proves]`), max 5
- Purpose: 3 to 5 dated milestones tied to the ask. Optional at every stage; required in deep tech where money retires named risks (amaklakov deep-tech).
- Question: "What happens, in which order, and what does each step prove?"
- Must contain: dated milestones, the risk or assumption each retires, link to the ask buckets.
- Good: "Four milestones from pilot to repeatable sale by Q4 2027". Bad: "Roadmap".

### closing. Fields: `title` (the one-liner again), `points[]` (exactly 3, the hero facts), `subtitle` (contact)
- Purpose: restate the three strongest points and how to reach you (Ralston, YC demo day guide, 2016, "conclusion"; NFX summary slide).
- Density: 3 points, one contact line. No new information.

### appendix. Fields: `points[]` with `stats[]` or `image`, or a `chart`, or `columns[]` plus `rows[]`; add `kicker: "Appendix"`
- Purpose: one slide per predictable objection, data too dense for the core deck (section 8). One form per slide: text, chart or table. Density is whatever section 4 allows for that form; the kicker takes one row of it.

### sources
- Generated by the builder from every `source` reference in the deck. Do not hand-write it. See section 8.

### case_study. Fields: `title`, `points[]` (max 3), `stats[]` (max 2, each with `source`), `image` (opt), `source`
- Purpose: one customer's before-and-after. Question: "Does a real customer get the value you claim?" Laid out like an appendix slide.
- Must contain: the customer name (or "a mid-size German carrier" if confidential), the setting and period, the measured result with n. Must not generalise one site's result to all customers.
- Headline rule: the result with its scope, for example "Nordfracht cut dock wait 31 percent at one site in three months".

### statement. Fields: `title`, `subtitle` (opt), `points[]` (opt, max 3 short)
- Purpose: one large line, for a section break in a long deck or a single claim that needs the whole slide. No figures means no `source`.

### two_column. Fields: `title`, `columns[]` (two objects: `{title, body, points[]}`), `source`
- Purpose: a side-by-side: before and after, live today and planned, us and them in words. Up to 5 points per column.

### custom_html. Fields: `title`, `html`, `source` (string or list), `notes`
- Purpose: escape hatch for a layout none of the types covers (a map, a timeline, a diagram). `html` is rendered as given; the builder does not validate numbers inside it, so every figure in the HTML must also appear in `source` as a list of ledger ids, or the checker cannot verify the slide.

## 3. Field reference: everything the builder accepts

`meta`:

| Key | Values | Effect |
|---|---|---|
| `company`, `tagline`, `footer` | text | cover fallback, file properties, footer line |
| `theme` | `graphite`, `paper`, `signal`, `midnight` | see `assets/deck-template/THEMES.md` |
| `accent`, `font_display`, `font_body` | `#RRGGBB`, Google Fonts family names | override the theme accent and fonts |
| `logo` | path relative to deck.json (SVG or PNG) | cover, closing, footer |
| `variant` | `present` (default) or `read` | `read` is the send-ahead: slightly smaller type, `body` paragraphs are drawn, each stat shows its source file under the label. Capacity differs per variant (section 4) |
| `sources` | `compact` (default), `full`, `none` | the generated sources appendix (section 8); `show_sources: false` is the older spelling of `none` |
| `pptx_fonts` | `web` | write the web font names into the PPTX instead of the safe fonts (Cambria, Calibri, Arial) |
| `aspect` | `16:9` | the only supported value |

Every slide accepts `type`, `title`, `kicker` (small line above the title; "Appendix" on appendix slides), `subtitle`, `body` (one paragraph, drawn in the read variant only), `points[]`, `stats[]` (`{value, label, source}`), `source` (a ledger id or a list of ids; becomes the one caption line), `notes` (section 7) and `question` (section 10; never drawn, shown with the notes). Type names use underscores; hyphens are accepted (`go-to-market`). An unknown type is drawn as a `statement` with a visible warning badge. A field a layout does not draw (a `chart` on a market slide, `stats` on a team slide) is reported by the lint.

| Field | Shape | Drawn on |
|---|---|---|
| `chart` | `{kind, labels[], series[{name, values[]}], y_label, show_values, source}`. `kind`: `bar`, `line`, `area`, `stacked_bar`, `horizontal_bar`. A `null` value leaves a gap (actual and projection as two series). `show_values: true` prints the number on each bar or point | traction, financials, appendix, case_study |
| `columns[]`, `rows[]` | header cells and rows of cells. The header may include or omit the leading empty cell for the row-label column. `true` or `"yes"` draws a check, `false` or `"no"` a dash. The row whose first cell equals `meta.company` is highlighted | competition, business_model, financials, appendix, case_study |
| `team[]` | `{name, role, bio, photo}`, or `rows[]` of `[name, role, proof line]` | team |
| `use_of_funds[]` | `{label, pct}`, drawn as one horizontal stacked bar with a legend; or `chart{kind: "stacked_bar"}` with one series per bucket; or three `stats` | ask |
| `milestones[]` | strings or `{when, what, proves}`. On ask, `points[]` are taken as milestones when `milestones` is absent. On roadmap, `rows[]` of `[date, milestone, what it proves]` also works | ask, roadmap |
| `image` | path relative to deck.json | cover (logo), problem, solution, product, appendix, case_study |
| `html` | raw HTML placed inside the 1920x1080 stage; theme tokens are CSS variables | custom_html |

Sources and prefixes. A `source` is a ledger id with its kind as prefix: `fact:mrr_current`, `assumption:tam_bottom_up`, `projection:arr_2028`. All three prefixes are accepted; the prefix must match the entry's `kind` in `facts.yaml`. The builder warns on a mismatch and on an id missing from the ledger, and `ledger_check.py` fails on them. No raw id is ever drawn: the caption names the source files ("Source: data/metrics-2026-10.csv"), at most three, then "and N more, see sources". A slide with a chart has one caption, under the chart, covering the chart and the slide. Captions and the sources appendix show each entry's source file; give a ledger entry `cite_as: <label>` when the file name would reveal something (a customer's name). A `founder statement` source shows as "company statement".

Missing numbers. Write the exact string `[needs number]` wherever a figure is missing, as a whole value (`"value": "[needs number]"`) or inside a sentence (`"CAC is [needs number] EUR"`). Each occurrence is drawn as a dashed amber slot in HTML and PPTX and listed in the build log. Never estimate a number to fill a slot, and never send a deck that still has one.

No product image. When the folder has no screenshot, photo or mock, leave `image` out: a product, solution or problem slide then sets its points across the full width. Do not reference a file that does not exist (the builder warns and drops it) and do not substitute a stock picture; ask for a screenshot in `gaps.md`.

## 4. Capacity table: what fits on each slide

`build_deck.js` checks deck.json against this table before it renders anything and prints one line per violation, for example:

    slide 5 (traction): 4 stats and 1 point overfill the side column by about 17 percent. Fits 4 stats and no point, or 3 stats and 1 point up to 93 characters, or 2 stats and 1 point up to 217 characters. Cut a stat or move a point to the notes.

Write to the table and a first build is clean. Fix every warning before a deck is sent; `--strict` turns warnings into a failed build. The table is generated from the numbers the lint uses (`node scripts/build_deck.js --capacities`; paste the output here when the layouts change). The lint lays out the deck's actual words in its own fonts, so its verdict is more exact than the character figures below, which are a guide for writing. Each limit is verified by rendering decks at the limit, with the web fonts loaded, in both variants and all four themes. It is the only definition of density in the skill.

Values are `present / read` where the two variants differ. Lengths are characters including spaces (6 characters is about one word).

| Slide type (form) | Stats | Points | Longest point at that count | Shared column, what fits | Other limits |
|---|---|---|---|---|---|
| cover | 3, label 60 | 0 |  |  | title 2 lines (about 36 characters); subtitle 110; kicker 70; stat value 10 |
| problem | 2, label 90 | 3 | 196 / 200 |  |  |
| problem (image) | 0 | 3 | 160 |  |  |
| solution | 0 | 3 | 220 |  |  |
| solution (image) | 0 | 3 | 196 / 200 |  |  |
| product | 0 | 4 | 129 / 140 |  |  |
| product (no image) | 0 | 3 | 220 |  |  |
| insight | 1, label 60 | 3 | 220 |  | title 3 lines (about 123 characters) |
| market | 3, label 130 | 2 | 150 |  | 3 blocks, widest first; a label fits two lines in its block (about 80 characters in the narrowest when there are side points) |
| traction | 4 / 3, label 100 | 2 | 220 (no stats) | 4 stats; 3 stats + 1 point of 90; 2 stats + 1 point of 210 / 3 stats; 2 stats + 1 point of 186; 1 stat + 1 point of 220 | chart, see below |
| traction (no chart) | 4 / 3, label 100 | 5 | 148 / 166 |  |  |
| business_model | 4, label 84 | 2 | 180 |  |  |
| business_model (table) | 0 | 2 | 180 (each line under the table costs half a row) |  | table, see below |
| go_to_market | 2, label 44 | 4 | 160 |  | points are numbered steps side by side; the 2-stat row fits underneath |
| competition | 0 | 1 | 180 (each line under the table costs half a row) |  | table, see below |
| team | 0 | 1 | 150 |  | 4 people: name 60, role 80, proof line 200 |
| financials | 2, label 100 | 5 | 70 / 72 (no stats) | 2 stats; 1 stat + 1 point of 160; 1 point of 160 | chart, see below |
| financials (table) | 0 | 3 | 180 (each line under the table costs half a row) |  | table, see below |
| ask | 0 | 1 | 160 |  | title 3 lines (about 132 characters); subtitle 160; 5 use-of-funds buckets, label 90; 4 milestones of 110 |
| ask (stats) | 3, label 66 | 0 |  |  | title 3 lines (about 132 characters); subtitle 160; 4 milestones of 110 |
| roadmap | 0 | 1 | 150 |  | 5 milestones: date 14, milestone 70, proves 90 |
| closing | 0 | 3 | 100 |  | title 4 lines (about 108 characters); subtitle 110 |
| appendix (chart) | 2, label 100 | 5 | 70 / 108 (no stats) | 2 stats; 1 stat + 1 point of 160; 1 point of 160 | chart, see below |
| appendix (table) | 0 | 2 | 180 (each line under the table costs half a row) |  | table, see below |
| appendix (text) | 4, label 90 | 5 | 98 / 110 |  |  |
| statement | 0 | 3 | 120 |  | title 4 lines (about 116 characters); subtitle 160 |
| two_column | 0 | 5 | 114 / 120 |  | column heading 70; points per column |
| custom_html | 0 | 0 |  |  |  |

Rules that apply to every type:

- Text is measured, not counted: the lint wraps the actual words of each title, point and label in the deck's own fonts (the four theme faces and 50 Google Fonts families used as `font_display` or `font_body` are built in; an unknown family is treated as wide). The character figures in this table are a guide for the widest theme faces; narrower faces fit more.
- Slide title, two lines / three lines (the maximum), in characters that every sample headline kept within: graphite 84 / 130 (read 98 / 150), paper 84 / 130 (read 92 / 140), signal 76 / 118 (read 88 / 138), midnight 72 / 110 (read 82 / 128). Titles wrap balanced, so no line is left with a single word.
- The budgets above assume a two-line title. A third title line, a `kicker`, a `subtitle` (max 160) or, in the read variant, a `body` paragraph (max 260) each take about one row of space: one point, one stat or one table row less. A one-line title gives one row back. The lint does this arithmetic.
- Stat value: up to 14 characters; long values are set smaller instead of wrapping. Put the unit in the label when you can.
- Table: up to 6 columns. 8 single-line rows under a two-line title, 7 with a kicker ("Appendix"), 6 / 7 with one one-line point underneath. A cell that wraps costs half a row per extra line. Cells stay on one line when the longest cells of all columns add up to about 126 characters (3 columns), 122 characters (4 columns), 118 characters (5 columns), 114 characters (6 columns).
- Chart: up to 12 x labels (6 characters each at 12 labels, 10 at 8), 10 bars of 24 characters for `horizontal_bar`, up to 5 series. Legend names wrap onto extra rows and are never cut (max 60 characters, 3 rows); the chart shrinks to make room, so prefer short names and put the unit in `y_label`.
- Source caption: one line per slide, at most three source files, then "and N more, see sources".

## 5. Stage variants

Slide counts are starting points, not rules. The corpus openly disagrees (5 to 7 for demo day, Hale 2015; 10 to 15, YC Series A guide 2020; funded seed decks average about 19 to 20 pages, DocSend 2015 and 2025). Pick by artifact and stage.

| Slide type | Pre-seed (8 to 10) | Seed (10 to 12) | Series A (12 to 15 + appendix) | Demo day (6 to 8, 2 to 3 min) |
|---|---|---|---|---|
| cover | required | required | required | required (one-liner, batch) |
| problem | required | required | required | required (merged with market) |
| solution | required | required | required | required (with product image) |
| product | required (prototype beats diagram) | optional | optional (case study variant) | optional |
| insight | required (carries why-now) | optional | optional (why-now barely read at A, amaklakov) | optional (merged with moat) |
| market | required | required | required | merged into problem |
| traction | required as proof stack | required | required, 2 to 3 slides, one at slide 2 | required, the longest slide |
| business_model | one line on ask or model slide | required | required with NDR and gross margin | required (one sentence) |
| go_to_market | optional, hypothesis only | required | required with CAC by channel | omit |
| competition | required | required | required | omit (name no competitors on stage) |
| team | required, more space | required | required | required (3 people max) |
| financials | omit (one-line unit economics instead) | optional, 12-month directional | required, 36 months with drivers | omit |
| ask | required | required | required | required (amount and milestone) |
| roadmap | optional | optional | optional | omit |
| closing | optional | optional | optional | required (restate one-liner) |
| appendix | 0 to 2 | 2 to 6 | 6 to 10 or more | none |

Stage notes. Pre-seed: the bet is founder, market, validation; team gets more space; traction is qualitative but present (90 percent of funded pre-seeds had at least an alpha product, DocSend, 2020); skip the five-year model. Seed: narrative plus business model carry the deck and traction turns quantitative; only about 58 percent of funded seed decks include financials (DocSend, 2015), so include them only when they help. Series A: traction teaser at slide 2, traction in depth in up to 3 slides, vision late; growth rate dominates (YC Series A guide, 2020).

Read-ahead versus presented deck (Jarvis; amaklakov "read me" versus "listen to me"): in a read-ahead (10 to 12 slides, sent as PDF only) the text carries the story, up to about 50 words a slide, and screenshots are welcome; in a presented deck (10 to 15 slides, `deck.html` plus PDF) the founder carries it, about 30 words a slide and often under 15, bullets beat screenshots (Hale, 2015), and the notes are the spoken script (section 7). Build both from the same `deck.json`: `meta.variant` is `"read"` or `"present"`; the capacity table (section 4) has the limits for each. Never send the full presented deck cold; it gets forwarded without context.

## 6. Reader data and sequencing

What DocSend telemetry says (quote the year; samples differ): funded seed decks were viewed for about 3 minutes 44 seconds over about 20 pages in 2015, with most time on financials and team, then competition (DocSend with Harvard Business School, 2015). By 2022 pre-seed decks got 2 minutes 42 seconds, traction got 41 percent more time than the year before, and company purpose became the third most scrutinised section (DocSend, 2022). Funded decks run about 50 words per slide in about 12 sections (DocSend, 2025). Dwell time on a page is a defect signal: investors flip at a steady pace and stop where something confuses them (Heddleston, DocSend, 2015). What that implies: budget the whole read at 2 to 4 minutes, 10 to 20 seconds a slide; weak numbers on team and financials are a liability, and a seed deck without financials is normal; spend real effort on the cover subtitle; always include a proof slide, qualitative if necessary.

Default seed order (Harris, YC, 2018, adapted): cover, problem, solution, traction, insight, business_model, market, go_to_market, competition, team, financials (optional), ask. Overrides:

- Traction early when strong: at slide 2 as a teaser and again in depth later (YC Series A guide, 2020).
- Insight after solution, never before; competition after business model and go-to-market.
- Team at the end by default; at slide 2 or 3 only when the team is the advantage or at pre-seed.
- Ask last, followed only by closing and appendix. Nothing new after the ask.
- Alternate dense slides (traction, market, competition, financials) with light ones. Two tables or two charts back to back is where readers stall. Never a divider slide.

## 7. Speaker notes and timing

Every slide carries `notes`. Notes hold what is said, not what is shown. Three parts, in this order, as plain text with line breaks:

```
Say: <the spoken message in the founder's own words, 2 to 4 sentences, containing at least one number not on the slide>
Context: <what the slide leaves out on purpose: the definition, the caveat, the weakness and its fix>
Transition: <one sentence that hands over to the next headline>
Time: <seconds>
```

Timing budget for a 15-minute pitch inside a 30-minute meeting (amaklakov: about 75 seconds per slide for 12 slides, then 15 minutes of questions; NFX: one third presenting, two thirds discussion). Attention in a presented pitch starts dropping after about 18 minutes (David S. Rose, via pedronauck corpus, historical).

Seconds per slide: cover 30, problem 75, solution 75, traction 120, insight 75, market 60, business_model 75, go_to_market 60, competition 60, team 60, financials 60, ask 90. Total 840 seconds, 14 minutes, leaving a minute of slack. Reallocate, do not add: a 15-slide deck gets 55 seconds a slide. Demo day (3 minutes, 7 slides): cover 10 s, problem plus market 25 s, solution plus product 30 s, traction 45 s, business_model 20 s, team 20 s, ask plus closing 20 s. Under 15 words per slide.

Rules for what to say: lead the first 10 seconds with the one-liner and the most impressive fact; do not read the slide; give the definition of any metric the moment it appears ("MRR is contracted monthly subscription, excluding setup fees"); name one weakness before the investor does; end each slide with the transition line so the next headline lands as an answer. Check in once after the solution slide ("does that make sense, or would an example help?", Seibel, YC). Plan material for 20 minutes of an hour meeting, never 60 (Hilaly, Sequoia; Kawasaki 10/20/30, 2005: 10 slides, 20 minutes, 30-point type, historical).

## 8. Appendix and sources

Appendix: start with 2 slides, grow toward 10 as the process runs (NFX). Each appendix slide answers one objection from `investor-qa.md`. The mapping:

| Objection in investor-qa.md | Appendix slide type | Content |
|---|---|---|
| "Is it one customer or many?" | traction (cohort) | logo and revenue retention by cohort, `chart.kind: line` |
| "Why won't the incumbent build this?" | competition (deep) | full feature matrix, switching-cost evidence |
| "Show me the unit economics" | business_model (table) | CAC, payback, gross margin, LTV with data window |
| "What is in the model?" | financials (drivers) | driver table, sensitivity case |
| "What exactly does the money buy?" | ask (detail) | use of funds by quarter, hiring plan tied to milestones |
| "How does it work?" | product or custom_html | architecture, security, compliance |
| Any red flag in red-flags.md | the slide it concerns | the weakness, the fix, the result |

Rules: appendix slides keep `kicker: "Appendix"`, follow the capacity table for their form (the kicker takes one row), and still source every number. Nothing in the appendix that is unforwardable.

Sources appendix: generated by the builder from every `source` in the deck, after the appendix slides. Never hand-write it.

- `meta.sources: "compact"` (default, both variants): one row per source file with the number of figures taken from it, their kinds and the slides that use them, on at most two slides. The build prints `sources appendix: N files, M figures, P pages`.
- `meta.sources: "full"`: one row per ledger id (id, label, value and unit, kind, as-of date, file and locator, method for assumptions and projections). Use it for a diligence pack, not a first send; a long ledger makes many pages.
- `meta.sources: "none"`: no appendix. The captions on the content slides still name the files.
- Without a `facts.yaml` the appendix is a numbered reference list, and captions point to it with superscript numbers.

An id that is not in `facts.yaml` gets a build warning with its slide number; `ledger_check.py` is the hard gate.

## 9. Charts: data-to-visual mapping and honesty

| Data | Form | Rules |
|---|---|---|
| Monthly MRR or ARR, customers per month | `bar` | consistent intervals, at most 12 labels, the slide title states the conclusion |
| Cohort retention, NDR over time | `line`, one series per cohort, max 5 | months since start on x, short series names, unit in `y_label` |
| Use of funds | `use_of_funds[]` on the ask slide | 3 to 5 buckets as percentages |
| Unit economics (CAC, payback, margin) | table | each row names its data window |
| TAM, SAM, SOM | 3 market stats with method labels | no concentric circles |
| Projection | `bar` or `line`, actual and projection as two series with `null` gaps | the projection series name contains "projection" and the title says "Projection" |
| Two metrics at once | two slides | never a double axis |

Honesty rules (metric definitions in `metrics.md`): the y-axis starts at zero (the builder enforces it); never cumulative alone, show the incremental figure beside it (YC Series A guide, 2020); one unit per axis, named in `y_label`; every series is a ledger series and `chart.source` names its id; growth charts show how long it took; no pie, no 3D.

## 10. The "investor question" field and the read-alone test

Every slide object may carry `"question": "<the question in the investor's head that this slide answers>"`. The builder does not render it. It exists so the model and the founder can audit the deck: list all `question` values in order; the list must read as the natural interrogation an investor runs (what is it, who hurts, what do you do, is it working, why you, how big, how do you make money, how do you sell, who do you beat, who are you, what next, how much). A slide with no question to answer is cut or moved to the appendix (shawnpang output format; pedronauck teardown rubric).

Read-alone headline test: extract every `title` in order and read them as a paragraph with nothing else. It must tell the whole story: the world is a certain way, something changed, what you built, proof it works, why you, what you need. If a headline is a label ("Market", "Team") or needs its body to make sense, rewrite it. Run this before every build and record the result in `run-log.md`. The Meridian example below passes it: read its twelve titles in sequence.

## 11. Worked example: Meridian seed deck

Fictional B2B SaaS, seed, read-ahead variant. Numbers are consistent with the `facts.yaml` example in `file-formats.md` (MRR 41,000 EUR in October 2026, ARR run-rate 492,000 EUR) and extend it: 32 paying customers, average 1,281 EUR MRR per customer (41,000 / 32), average contract 15.4k EUR per year, raising 3M EUR. Every `source` names a ledger id; ids not in the file-formats example (`raise_amount`, `customers_current`, `dock_wait_minutes`, `wait_reduction`, `mrr_series`, `nrr_ttm`, `logo_churn_12m`, `referral_share`, `driver_smartphone_share`, `mrr_per_customer`, `acv_current`, `gross_margin`, `cac_payback`, `cac_2026`, `sam_bottom_up`, `som_2029`, `sales_cycle_days`, `competitor_grid`, `mrr_2028_projection`, `use_of_funds`, `runway_months`) must exist in the startup's ledger with the kinds the `source` prefixes name before this validates.

```json
{
  "meta": {
    "company": "Meridian",
    "tagline": "Dock scheduling that carriers actually use",
    "variant": "read",
    "theme": "graphite",
    "accent": "#2E6BE6",
    "font_display": "Fraunces",
    "font_body": "Inter",
    "logo": "assets/meridian-logo.svg",
    "footer": "Meridian GmbH, confidential, November 2026",
    "aspect": "16:9",
    "sources": "compact"
  },
  "slides": [
    { "type": "cover", "title": "Meridian", "subtitle": "Dock scheduling that carriers actually use",
      "kicker": "Seed round, November 2026",
      "stats": [
        { "value": "EUR 41k", "label": "MRR, Oct 2026", "source": "fact:mrr_current" }, { "value": "32", "label": "paying operators", "source": "fact:customers_current" },
        { "value": "EUR 3M", "label": "raising", "source": "fact:raise_amount" } ],
      "question": "What is this, in plain words?",
      "notes": "Say: Meridian is the booking screen a truck driver uses to get a dock slot. 32 logistics operators pay us for it today.\nContext: do not explain the product yet.\nTransition: here is why they pay.\nTime: 30" },
    { "type": "problem", "title": "Trucks wait 94 minutes at the average mid-size dock, and nobody is paid for that time",
      "points": [ "Mid-size operators run 6 to 20 docks on phone calls, fax and a gatehouse clipboard",
                  "Carriers charge waiting fees from the 61st minute; operators absorb them",
                  "Incumbent scheduling modules require carrier accounts; under 20 percent of carriers ever log in" ],
      "source": "fact:dock_wait_minutes",
      "question": "Who hurts, how much, and what do they do about it now?",
      "notes": "Say: 94 minutes is the median in our 2025 sample of 140 sites; at one Nordfracht site it was 3 hours.\nContext: the 20 percent login figure is from the founder's prior employer, labelled assumption in the ledger.\nTransition: the fix has to work for the driver, not the planner.\nTime: 75" },
    { "type": "solution", "title": "Carriers book a dock slot in 40 seconds from their phone, no account needed",
      "points": [ "Driver opens a link, picks a slot, done; the operator's board updates live",
                  "Operators set rules once: dock types, cut-offs, priority lanes",
                  "Waiting time at live sites fell from 94 to 31 minutes within 8 weeks" ],
      "image": "assets/meridian-booking.png",
      "source": "fact:wait_reduction",
      "question": "What do you do about it, and for whom?",
      "notes": "Say: no app store, no password; that is the whole trick.\nContext: 31 minutes is the 12-site median, not the best site.\nTransition: does it work as a business?\nTime: 75" },
    { "type": "traction", "title": "MRR grew from 4k to 41k EUR in 21 months with 2 logos lost",
      "chart": { "kind": "bar", "labels": ["Jan 25", "Apr 25", "Jul 25", "Oct 25", "Jan 26", "Apr 26", "Jul 26", "Oct 26"],
                 "series": [ { "name": "MRR (EUR k)", "values": [4, 7, 12, 18, 25, 33, 37, 41] } ],
                 "y_label": "EUR k per month", "source": "fact:mrr_series" },
      "stats": [ { "value": "EUR 41k", "label": "MRR, Oct 2026", "source": "fact:mrr_current" },
                 { "value": "118%", "label": "net revenue retention, trailing 12 months", "source": "fact:nrr_ttm" },
                 { "value": "2", "label": "logos lost in 12 months", "source": "fact:logo_churn_12m" } ],
      "question": "Is this working, and how fast?",
      "notes": "Say: 10x in 21 months; the step in April 2026 is the multi-site plan.\nContext: both lost logos were single-dock sites below our current minimum; name them if asked.\nTransition: the reason carriers adopt it is the part incumbents cannot copy quickly.\nTime: 120" },
    { "type": "insight", "title": "Carriers self-serve when booking takes under a minute and needs no account; incumbents require both",
      "points": [ "Incumbent modules are sold to planners and built for planners; the driver is an afterthought",
                  "Smartphone penetration among EU truck drivers passed 90 percent in 2024, so a link is enough",
                  "Every carrier that books once is a referral into the next operator: 9 of 32 customers came that way" ],
      "stats": [ { "value": "9 of 32", "label": "customers via carrier referral", "source": "fact:referral_share" } ],
      "source": "assumption:driver_smartphone_share",
      "question": "Why does this work now, and why you?",
      "notes": "Say: the incumbents' buyer is the planner; ours is the driver, who then sells us to the next operator.\nContext: the 90 percent figure is an industry survey, kind assumption, year 2024.\nTransition: who pays and how much.\nTime: 75" },
    { "type": "business_model", "title": "Operators pay 1,280 EUR per site per month; 81 percent gross margin, 9-month payback",
      "stats": [ { "value": "EUR 1,281", "label": "average MRR per customer", "source": "fact:mrr_per_customer" },
                 { "value": "EUR 15.4k", "label": "average annual contract", "source": "fact:acv_current" },
                 { "value": "81%", "label": "gross margin, Q3 2026", "source": "fact:gross_margin" },
                 { "value": "9 months", "label": "CAC payback, gross-margin adjusted, 2026 cohort", "source": "fact:cac_payback" } ],
      "points": [ "Priced per site per month; carriers never pay" ],
      "question": "Who pays, how much, and does a euro in produce more than a euro out?",
      "notes": "Say: one price, one buyer, carriers free; that keeps the referral loop open.\nContext: payback uses 2026 cohort CAC of 9.8k EUR; the 2025 cohort was 14k EUR.\nTransition: how big that can get.\nTime: 75" },
    { "type": "market", "title": "185M EUR serviceable today: 12,000 EU mid-size operators x our 15.4k EUR contract",
      "stats": [ { "value": "EUR 1.8B", "label": "TAM: EU operators' yard and dock software spend, 12,000 x 150k EUR (assumption)", "source": "assumption:tam_bottom_up" },
                 { "value": "EUR 185M", "label": "SAM: 12,000 operators x 15.4k EUR current contract (assumption)", "source": "assumption:sam_bottom_up" },
                 { "value": "EUR 6.2M", "label": "SOM 2029: 400 operators x 15.4k EUR (projection)", "source": "projection:som_2029" } ],
      "points": [ "Operator count from Eurostat NACE H52 size classes, 2024; contract value from our own 32 contracts" ],
      "question": "How big can this get, and how do you know?",
      "notes": "Say: we size on our own price, not the incumbents'.\nContext: TAM uses a 150k EUR total software spend assumption; SOM is a projection.\nTransition: and how we get there, one motion.\nTime: 60" },
    { "type": "go_to_market", "title": "Founder-led sales closes a 15k EUR contract in 34 days; 9 of 32 customers came from carrier referrals",
      "points": [ "Beachhead: German and Benelux operators with 6 to 20 docks",
                  "Motion: a 20-minute demo on the operator's own carrier list, pilot on one dock, expand",
                  "Next: two account executives from Q1 2027, each targeting 2 sites per month" ],
      "stats": [ { "value": "34 days", "label": "median sales cycle, 2026", "source": "fact:sales_cycle_days" }, { "value": "EUR 9.8k", "label": "CAC, 2026 cohort", "source": "fact:cac_2026" } ],
      "question": "How do you get customers repeatably, and what does one cost?",
      "notes": "Say: the pilot is on one dock; expansion to the site is where the contract value comes from.\nContext: AE productivity of 2 sites per month is a plan, not yet observed.\nTransition: who else the operator could buy from.\nTime: 60" },
    { "type": "competition", "title": "Only Meridian lets a carrier book without an account; the two incumbents require one",
      "columns": [ "", "Meridian", "Incumbent TMS module", "Point-solution startups", "Phone, fax, spreadsheet" ],
      "rows": [ [ "Carrier books without account", "yes", "no", "no", "n/a" ],
                [ "Time to book a slot", "40 s", "4 to 6 min", "2 min", "a phone call" ],
                [ "Setup time per site", "2 days", "6 to 12 weeks", "1 to 2 weeks", "none" ],
                [ "Price per site per month", "1,280 EUR", "bundled in TMS", "600 to 900 EUR", "0 EUR" ],
                [ "Yard management, ERP integrations", "partial", "full", "partial", "none" ] ],
      "source": "assumption:competitor_grid",
      "question": "Why will you win against the obvious alternatives?",
      "notes": "Say: the incumbent wins on integrations; we win on adoption, and adoption is what the operator actually pays for.\nContext: competitor figures from public pricing and 11 customer interviews, labelled assumption.\nTransition: the people doing this.\nTime: 60" },
    { "type": "team", "title": "We ran 40 docks and built the scheduling engine at a 2B EUR carrier",
      "rows": [ [ "Lena Hoffmann", "CEO", "12 years in operations at a mid-size operator, ran 40 docks across 3 sites" ],
                [ "Tomas Varga", "CTO, writes the code", "Built carrier-facing scheduling at a 2B EUR revenue carrier, team of 9" ],
                [ "Priya Nair", "Head of sales", "Closed 20 of the 32 customers; previously 6 years selling TMS software" ] ],
      "points": [ "Lena and Tomas worked together for 4 years before founding Meridian" ],
      "question": "Why these people, and who writes the code?",
      "notes": "Say: 1.1M EUR spent to reach 492k EUR ARR run-rate.\nContext: no advisors on the slide by design.\nTransition: what the next 24 months look like.\nTime: 60" },
    { "type": "financials", "title": "Projection: 200k EUR MRR by October 2028, driven by 4 AEs closing 2 sites each per month",
      "chart": { "kind": "bar", "labels": ["Oct 26", "Apr 27", "Oct 27", "Apr 28", "Oct 28"],
                 "series": [ { "name": "MRR actual (EUR k)", "values": [41, null, null, null, null] },
                             { "name": "MRR projection (EUR k)", "values": [null, 62, 98, 145, 200] } ],
                 "y_label": "EUR k per month", "source": "projection:mrr_2028_projection" },
      "points": [ "Drivers: 2 AEs from Q1 2027, 4 from Q1 2028; 2 new sites per AE per month; 15.4k EUR contract; NRR held at 110 percent; logo churn 6 percent a year",
                  "Sensitivity: at 1 site per AE per month, MRR reaches 128k EUR by Oct 2028 and runway holds" ],
      "question": "What does the next 24 months look like, and what drives it?",
      "notes": "Say: this is a projection; the levers are AE count and sites per AE.\nContext: NRR assumed below the observed 118 percent on purpose.\nTransition: which is what the round pays for.\nTime: 60" },
    { "type": "ask", "title": "Raising 3M EUR to reach 200k EUR MRR and 150 sites in 24 months",
      "stats": [ { "value": "EUR 3M", "label": "seed round, one close", "source": "fact:raise_amount" }, { "value": "50 / 35 / 15", "label": "product / go-to-market / operations and buffer, percent", "source": "assumption:use_of_funds" },
                 { "value": "24 months", "label": "runway at planned burn, next raise from month 18", "source": "projection:runway_months" } ],
      "points": [ "Q2 2027: 60 sites live, 2 AEs ramped",
                  "Q4 2027: yard-management module shipped, first 3 ERP integrations",
                  "Q4 2028: 200k EUR MRR, 150 sites, Series A metrics with NRR above 110 percent",
                  "Non-capital asks: intros to 5 Benelux operators and one TMS partner" ],
      "question": "How much, for what, and what will be true when it is spent?",
      "notes": "Say: one number, three buckets, three dated milestones.\nContext: 15 percent buffer is inside operations; valuation is for the conversation, not the slide.\nTransition: closing summary.\nTime: 90" }
  ]
}
```

Why this example validates: 12 slides, zero capacity warnings in the read variant (three traction stats, because each carries a source line there), each with a `title` that is a sentence, every stat and chart carrying a `source` whose prefix (`fact`, `assumption`, `projection`) matches the ledger kind, the market and financials slides labelled as assumption and projection in their own text, the traction chart with time on x and y from zero, incremental information in the stats, one competition row where the incumbent wins, no advisors, no investor logos, no valuation. Add `closing`, up to 6 `appendix` slides from `investor-qa.md`, and let the builder append `sources`. Run the read-alone test on the twelve titles before building.
