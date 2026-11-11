# Deck structure: slide-by-slide rules and the deck.json mapping

What this file is for: the content rules for every slide type that `scripts/build_deck.js` renders from `pitch/deck/deck.json`, every field the builder accepts, the capacity table that says what fits, the stage variants, the speaker-note rules, and a complete worked example.
Read it when you are about to write or revise `deck.json`, when a founder asks "which slides do I need", or when the build prints capacity warnings.
Visual design principles live in `design.md`, the art directions in `assets/deck-template/THEMES.md`; metric definitions in `metrics.md`; the objection list in `investor-questions.md`; the ledger format in `file-formats.md`.

## Contents

1 Ground rules. 2 Slide types. 3 Field reference (every field, diagrams, icons, layouts). 4 Capacity table (what fits). 5 Stage variants. 6 Reader data and sequencing. 7 Speaker notes and timing. 8 Appendix and sources. 9 Charts. 10 Investor question and read-alone test. 11 Worked example (Meridian, 13 slides).

## 1. Ground rules that apply to every slide

- One message per slide. The headline is that message, written as a full sentence a stranger can repeat. If two ideas compete, split the slide (Hale, YC, 2015; YC Series A guide, 2020).
- Headline carries the takeaway, never the category. "Traction" is a label; "MRR grew 10x in 21 months" is a headline. A deck whose headlines, read in order with no bodies, still tell the story passes the read-alone test (section 10).
- Body budget: aim for 30 words of body on a presented slide and 50 on a read-ahead slide (Hale, 2015, demo day; DocSend observes funded decks average about 50 words per slide, 2025). These are writing targets. The limits that decide whether a slide fits are in the capacity table (section 4), which the builder checks before it renders; a stat label that carries its method (the market slide) does not count toward the word target. Four to six numbers per slide maximum; ten numbers reads as hiding weakness behind volume.
- Every number on a slide points to a ledger id (`"source": "fact:<id>"` on the slide, or `source` on each stat and chart). The checker fails the build otherwise; cover, closing and statement slides need no `source` when they show no figure. Facts can be stated flat; assumptions carry their method on the slide; projections carry their drivers. Never let the headline turn an assumption or projection into a fact ("Our market is 1.8B EUR" is wrong when the ledger says `kind: assumption`; write "We estimate a 1.8B EUR market: 12,000 operators x 150k EUR").
- Units and time context on every number: MRR or ARR, gross or net, MAU or DAU, and the month it describes (YC Series A guide, 2020).
- Forwardable: assume the deck circulates without you and without an NDA. Anything you would not want screenshotted belongs in the data room, not the deck; confidential material flagged in `gaps.md` (salaries, cap table, named customer contracts without permission) never enters `deck.json`.

## 2. Slide types

Each entry gives: purpose, the investor question it answers, must contain, must not contain, headline rule, density, deck.json fields, and headline examples. Fields marked (opt) are optional. Density lines say how many items a slide should carry; how long each may be is in the capacity table (section 4). All types accept `title`, `notes`, `question` (not rendered, see section 10), `source` and `tone`. The newer vocabulary (icons on points, `diagram`, `frame`, `logos`, emphasis in titles) is in section 3; the field lists below name what each type must carry.

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
- Must not contain: feature lists, architecture diagrams (appendix), roadmap items presented as shipped. A `before_after` diagram with one measured pair is the strongest visual here.
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

### market. Fields: `title`, `stats[]` (3: TAM, SAM, SOM; or 2, for example SAM and revenue today; each `label` includes the method), `points[]` (opt, max 2 for sources and narrowing), `source`
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
- Density: use of funds in 3 to 5 buckets (drawn as a donut) or 3 stats, 2 to 4 milestones.
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
- Purpose: one slide per predictable objection, data too dense for the core deck (section 8). One form per slide: text, chart or table. Density is whatever section 4 allows for that form; the kicker takes one row of it. Any slide type with `kicker: "Appendix"` runs under the Appendix running head too; stats with points make a stat mosaic.

### sources
- Generated by the builder from every `source` reference in the deck. Do not hand-write it. See section 8.

### case_study. Fields: `title`, `points[]` (max 3), `stats[]` (max 3, each with `source`), `image` or `chart` (opt), `source`
- Purpose: one customer's before-and-after. Question: "Does a real customer get the value you claim?" Laid out like a traction slide.
- Must contain: the customer name (or "a mid-size German carrier" if confidential), the setting and period, the measured result with n. Must not generalise one site's result to all customers.
- Headline rule: the result with its scope, for example "Nordfracht cut dock wait 31 percent at one site in three months".

### quote. Fields: `quote`, `by`, `role`, `photo` (opt), `stat` (opt, `{value, label, source}`)
- Purpose: one customer in their own words, set large, with the one metric that backs it. Only a real, attributable quote; with no permission to name, attribute by role and setting (no avatar is drawn without a `photo`). Never invent or polish a quote; when the folder has no customer quote, use a `statement` slide in the founder's own words.

### statement. Fields: `title`, `subtitle` (opt), `points[]` (opt, max 3 short)
- Purpose: one large line on a full-bleed ground: the single claim that needs the whole slide. One per deck, near the middle. No figures means no `source`.

### section. Fields: `title`, `subtitle` (opt), `number` (opt)
- Purpose: a chapter break with a giant numeral, in decks of 14 slides or more. At most three. The title is a claim about the chapter ("Proof: it is working"), not a label. Sections are numbered automatically, and the title becomes the running head of the slides that follow, so keep it under about 40 characters.

### two_column. Fields: `title`, `columns[]` (two objects: `{title, body, points[]}`), `source`
- Purpose: a side-by-side in words: live today and planned, us and them. Up to 5 points per column; the second column is the filled one. For a before-and-after with numbers use `diagram.kind: "before_after"`.

### custom_html. Fields: `title`, `html`, `source` (string or list), `notes`
- Purpose: escape hatch for a layout none of the types or diagrams covers. `html` is placed as given in the area under the title; tone colours are CSS variables (`--bg`, `--ink`, `--muted`, `--accent`, `--surface`). The builder does not measure or validate it, so every figure in the HTML must also appear in `source` as a list of ledger ids.

## 3. Field reference: everything the builder accepts

`meta`:

| Key | Values | Effect |
|---|---|---|
| `company`, `tagline`, `footer` | text | cover fallback, running head, file properties, footer line |
| `theme` | `ledger`, `nocturne`, `poster`, `blueprint`, `studio`, `graphite`, `paper`, `signal`, `midnight` | the art direction; pick one per company with `assets/deck-template/THEMES.md` |
| `accent`, `font_display`, `font_body` | `#RRGGBB`, Google Fonts family names | override the theme accent and fonts |
| `logo`, `logo_light` | paths relative to deck.json (SVG or PNG) | cover and closing; `logo_light` is the version for dark grounds |
| `variant` | `present` (default) or `read` | `present` for a deck shown live; `read` for a deck sent ahead as a PDF: smaller type, `body` paragraphs are drawn, a stat shows its source file when the slide caption does not already name it. When both are needed, build twice. Capacity differs per variant (section 4) |
| `pptx` | `faithful` (default), `editable`, `none` | `faithful`: every slide a 2x picture of what the PDF shows, text not editable. `editable`: native text and charts over a picture of each slide's ground; bar, line and area charts are native, donuts, diagrams and icons are part of the picture; fonts fall back to safe ones, so lines may break differently. The command line flag `--pptx` overrides it |
| `sources` | `compact` (default), `full`, `none` | the generated sources appendix (section 8); `show_sources: false` is the older spelling of `none` |
| `pptx_fonts`, `pptx_font_display`, `pptx_font_body` | `web`; font names | editable PPTX only. Safe fonts are chosen automatically (Georgia for headlines when the display face is a serif); the two font keys name others; `web` writes the web font names |

Every slide accepts `type`, `title`, `kicker` (the small label above the title; defaults to the type name), `subtitle`, `body` (one paragraph, read variant only), `points[]`, `stats[]`, `source` (a ledger id or a list; becomes the one caption line), `notes` (section 7), `question` (section 10; never drawn) and `tone` (`light`, `dark`, `accent`; leave it out and the builder keeps the rhythm, see THEMES.md). Type names use underscores; hyphens are accepted. An unknown type is drawn as a `statement` with a warning badge. A field a slide type has no place for is reported by the lint, never dropped silently.

Emphasis: one phrase per title between asterisks, `"Trucks wait *94 minutes* at the dock"`, drawn in the theme's emphasis (accent colour, serif italic or highlighter block). Emphasise the number or the claim, never more than one phrase.

| Field | Shape | Drawn on |
|---|---|---|
| `points[]` | strings, or `{text, icon, title}`. `icon` is a name from the icon set below; `title` a short bold lead | most types (see section 2) |
| `stats[]` | `{value, label, source}` plus optional `trend: [numbers]` (a sparkline in the cell), `delta` ("up from 9"), `icon`. A unit after the figure ("94 min", "118%", "9 months") is set small beside it | cover, problem, insight, market, traction, business_model, go_to_market, financials, ask, appendix, case_study |
| `chart` | `{kind, labels[], series[{name, values[]}], y_label, show_values, highlight, annotation{at, text}, source}`. `kind`: `bar`, `line`, `area`, `stacked_bar`, `horizontal_bar`, `donut`. A `null` value leaves a gap. See section 9 | traction, financials, appendix, case_study, insight, business_model, go_to_market |
| `diagram` | `{kind, ...}`, see the table below. Takes the slide's visual slot instead of a chart or image | every content type except cover, section, statement, quote, team, closing, two_column |
| `image`, `images[]`, `frame` | a path, or `{src, frame}`; up to two in `images` (the second overlaps the first). `frame`: `browser`, `phone` or `none` | problem, solution, product, traction, appendix, case_study; cover (logo); quote (`photo`) |
| `columns[]`, `rows[]` | header cells and rows of cells. `true` or `"yes"` draws a filled dot, `false` or `"no"` a hollow one. The column (or row) whose header equals `meta.company` gets the accent fill | competition (a power grid), business_model, financials, appendix, case_study |
| `team[]` | `{name, role, bio, photo}`, or `rows[]` of `[name, role, proof line]`. The photo or, without one, the initials fill the upper part of the tile edge to edge; one or two people are set with the picture beside the words | team |
| `use_of_funds[]` | `{label, pct}`, drawn as a donut with its legend; `chart{kind: "donut"}` or `"stacked_bar"` and three `stats` also work | ask |
| `milestones[]` | strings or `{when, what, proves, done}`; `done: true` (or `today: n`) puts the today marker after the milestones already reached | ask, roadmap (drawn as a timeline) |
| `logos[]` | names, or `{name, image}`: a strip of wordmarks or logo files in one ink. Only customers who agreed to be named | traction, case_study, closing |
| `sparklines[]` | `{label, values[], value}` rows: metric, small line, latest value. Needs a chart, diagram or image on the same slide | traction, financials, appendix, case_study |
| `html` | raw HTML | custom_html |

Diagrams. Use one when the content is a process, a market, a comparison or a structure; bullets that describe a diagram are the weaker slide.

| `kind` | Data | Use it for |
|---|---|---|
| `flow` | `steps[]` of `{title, text, icon}` (2 to 5), `loop` (caption of a dashed return path), `highlight` (index). Keep the steps similar in length: all titles share one size and all texts another, set by the longest | how it works, the sales motion |
| `funnel` | `stages[]` of `{label, value, note}` (2 to 5); the rate against the stage above is added unless `rates: false` (use that for a pipeline snapshot: deals sitting in each stage today, where a rate would be wrong) | go to market, pipeline |
| `timeline` | `items[]` of `{when, what, proves, done}` (2 to 6), `today` | roadmap, history |
| `market` | `rings[]` of three `{value, label}` (TAM, SAM, SOM, each label carrying its method). A market slide with exactly three stats draws this by itself | market |
| `matrix` | `x` and `y` as `{label, low, high}`, `items[]` of `{name, x, y, us}` with x and y from 0 to 1. Needs at least two named competitors; the lint refuses the company alone in the corner | positioning (appendix); the main competition slide stays a power grid |
| `power_grid` | `columns[]`, `rows[]`, `us` (column index) | the same grid on a slide type other than competition |
| `loop` | `nodes[]` of `{title, text}` (3 to 5), `center` | flywheel, network effect |
| `layers` | `layers[]` of `{title, text}`, top first (2 to 5) | architecture, platform stack |
| `before_after` | `before` and `after` as `{label, value, text, points[]}` | the solution in one measured pair, a case study |

Layouts follow the content, not a field. A slide with stats is a mosaic: the first stat owns the accent cell beside the title, the others get cells of their own. Problem, solution and ask are colour-block splits: text on one side, a full-height panel with the stat, image, diagram or donut on the other. A product slide with a wide image sets it large with the points beside it; with a tall image (`frame: "phone"`) the image gets a panel; with no image it must carry a diagram, or its points become icon cards. A product slide takes one stat (not beside a tall image); problem and solution draw `stats` in the panel unless a `diagram` takes it; an insight slide with a diagram may also carry `points`, drawn beside it. Never reference a file that does not exist and never substitute a stock picture.

Icons (Lucide, 74 names): zap, shield-check, globe, trending-up, trending-down, users, user, layers, clock, calendar, check, circle-check, target, rocket, lightbulb, lock, key, database, server, cloud, cpu, code, smartphone, monitor, truck, package, warehouse, factory, building-2, store, shopping-cart, credit-card, banknote, wallet, coins, percent, chart-column, chart-line, chart-pie, activity, gauge, heart-pulse, leaf, sun, droplet, flame, map-pin, route, search, settings, wrench, link, mail, message-circle, handshake, award, star, flag, repeat, refresh-cw, arrow-right, arrow-up-right, sparkles, brain, bot, graduation-cap, book-open, file-text, scale, eye, bell, plug, recycle, puzzle. Give every point on a slide an icon or none.

Sources and prefixes. A `source` is a ledger id with its kind as prefix: `fact:mrr_current`, `assumption:tam_bottom_up`, `projection:arr_2028`. The prefix must match the entry's `kind` in `facts.yaml`; the builder warns on a mismatch and on an id missing from the ledger, and `ledger_check.py` fails on them. No raw id is ever drawn: the caption names the source files ("Source: data/metrics-2026-10.csv"), at most three, then "and N more, see sources". A chart carries the slide's caption. Give a ledger entry `cite_as: <label>` when the file name would reveal something. A `founder statement` source shows as "company statement".

Missing numbers. Write the exact string `[needs number]` wherever a figure is missing, as a whole value or inside a sentence. Each occurrence is drawn as a dashed amber slot and listed in the build log. A `[needs number]` stat takes no `source`. Never estimate a number to fill a slot: build, list the open slots for the founder, and let the founder decide.

## 4. Capacity table: what fits on each slide

`build_deck.js` lays out every word of deck.json in the deck's own fonts before it draws anything, and prints one line per thing that does not fit, for example:

    slide 7 (traction): a stat cell is overfull by about 16 percent. Shorten the stat label.
    slide 12 (competition): the table needs about 9 percent more height than it has (7 rows). Cut a row, shorten the cells that wrap, or move a point to the notes.

Fix every warning before a deck is sent; `--strict` turns warnings into a failed build. Headlines, points and numerals step down in size to fit before anything is reported, so the limits below are the longest text that still fits at the smallest size: a slide written to half of a limit is set large, a slide at the limit is set small. Body type never goes below 24 px on the 1920 px stage (22 px in the read variant), labels and captions never below 16 px. The same ladders run upward: tables, lists, diagram labels and milestone rows grow to use their cell. What stays thin is listed under `slack:` (a list, table or diagram cell less than 55 percent filled, also written to `qa/report.json` by `--check`): that slide will look empty, so add a point, a stat, a diagram or an image rather than ship it.

The table is generated by the same code (`node scripts/build_deck.js --capacities`; paste the output here when the layouts change). Each figure is the longest text for that field with the other fields at a typical length, valid in all nine themes and on every tone; a longer title, a kicker or more notes take room from the rest, so the lint line for the actual slide is the authority; lengths are characters including spaces (6 characters is about one word). Every form is verified by rendering decks at these limits in every theme and both variants.

| Slide type (form) | Longest text per field, in characters, `present / read` |
|---|---|
| cover (3 stats) | title 86; subtitle 167 / 180; kicker 82; stat label 82 / 92 |
| cover | title 86; subtitle 167 / 180; kicker 82 |
| section | title 134; subtitle 193 / 229 |
| statement | title 258; subtitle 234 / 258 |
| statement (3 points) | title 258; point 160 / 183 |
| quote (metric) | quote 318; name 68 / 82; role 153; stat label 115 / 120 |
| quote | quote 419; name 92 / 102; role 211 |
| problem (stats) | title 186; point 266 / 290; stat label 138 / 147 |
| problem (points only) | title 211; point 323 / 364 |
| problem (image) | title 186; point 266 / 290 |
| solution (points only) | title 211; point 323 / 364 |
| solution (before_after) | title 167; point 310 / 419; label 56; diagram text 193 / 221 |
| product (wide image) | title 266; point 211 / 274 |
| product (tall image) | title 186; point 266 / 290 |
| product (no image) | title 266; point 419 |
| insight (stat, 3 points) | title 229; point 229 / 284; stat label 115 / 120 |
| insight (loop) | title 180; stat label 115 / 120; diagram text 99; node 92 / 102 |
| market (3 stats) | title 266; stat label 173 / 186; point 419 |
| market (3 stats, one missing) | title 266; stat label 173 / 186; point 419 |
| market (2 stats) | title 266; stat label 346 / 377; point 419 |
| traction (chart, 3 stats, logos) | title 180; stat label 92 / 120 |
| traction (chart, 2 stats, 1 point) | title 180; stat label 115 / 120; point 211 / 274 |
| traction (no chart) | title 180; stat label 34 / 42; point 120 / 134 |
| business_model (4 stats) | title 180; stat label 92 / 102; point 419 |
| business_model (table) | title 266; row label 138 / 147; cell 115 / 120; point 419 |
| go_to_market (2 stats, 3 steps) | title 149; point 419; stat label 71 / 82 |
| go_to_market (funnel) | title 180; point 245 / 318; stat label 115 / 120; funnel label 58 / 63 |
| competition (power grid) | title 173 / 266; header 50; row label 92 / 99; cell 50 / 58; point 419 |
| competition (matrix) | title 266; point 419; axis 21; item 26 / 30 |
| team (4 people) | title 266; name 50; role 50; proof line 183 / 229; point 134 / 149 |
| financials (chart, 4 drivers) | title 266; point 120 / 183 |
| financials (chart, stat, 3 drivers) | title 180; stat label 115 / 120; point 167 / 183 |
| financials (table) | title 201 / 266; row label 92 / 99; cell 82; point 419 |
| ask (use of funds, milestones) | title 186; subtitle 193 / 229; fund label 115 / 138; milestone 160 |
| ask (stats) | title 186; subtitle 193 / 229; stat label 138 / 147; milestone 183 / 201 |
| roadmap (4 milestones) | title 266; milestone 120 / 167; proves 160 / 201; point 134 / 149 |
| closing (3 points) | title 229; point 180 / 229; subtitle 211 / 221 |
| appendix (text) | title 180; stat label 115 / 120; point 120 / 134 |
| appendix (chart) | title 266; point 120 / 138; stat label 92 |
| appendix (flow) | title 266; loop 102 / 115; step title 50; step text 234 / 302 |
| appendix (layers) | title 266; point 419; layer 42; layer text 92 / 99 |
| two_column | title 266; heading 92; point 211 / 225 |
| case_study | title 180; stat label 50; point 82 / 92 |

Rules that apply to every type:

- Counts: at most 5 points and 4 stats per slide (3 on the cover and beside a chart), 4 people, 6 milestones, 5 use-of-funds buckets, 6 logos, 6 sparkline rows. The builder keeps the first ones and says so.
- The first stat is the hero: put the number the title talks about first. A stat value of up to about 9 characters is set large; a longer one is set smaller, never wrapped. Put the unit after the figure ("34 days") or in the label.
- A `kicker`, a `subtitle` or, in the read variant, a `body` paragraph (about 260 characters) takes room from the title; the title cell grows by a row and the body of the slide shrinks. The lint does this arithmetic.
- Table: up to 7 columns. About 7 single-line rows under a two-line title; a cell may wrap to 3 lines and each extra line costs about half a row.
- Chart: up to 12 x labels (about 6 characters each at 12, 10 at 8), 8 rows for `horizontal_bar`, up to 5 series. Lines are labelled at their ends when the series names are short (about 20 characters); longer names go to a legend. Annotation up to 44 characters.
- Source caption: one line per slide, at most three source files, then "and N more, see sources".
- A deck that sets `font_display` or `font_body` is measured with those faces (in Chrome at build time); wider faces fit less than the table says.

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

Counting: the slide numbers per stage are content slides including cover and closing; `section` slides and the generated sources pages do not count. A Series A deck without a financial model omits the financials slide and says so in the ask notes.

## 6. Reader data and sequencing

What DocSend telemetry says (quote the year; samples differ): funded seed decks were viewed for about 3 minutes 44 seconds over about 20 pages in 2015, with most time on financials and team, then competition (DocSend with Harvard Business School, 2015). By 2022 pre-seed decks got 2 minutes 42 seconds, traction got 41 percent more time than the year before, and company purpose became the third most scrutinised section (DocSend, 2022). Funded decks run about 50 words per slide in about 12 sections (DocSend, 2025). Dwell time on a page is a defect signal: investors flip at a steady pace and stop where something confuses them (Heddleston, DocSend, 2015). What that implies: budget the whole read at 2 to 4 minutes, 10 to 20 seconds a slide; weak numbers on team and financials are a liability, and a seed deck without financials is normal; spend real effort on the cover subtitle; always include a proof slide, qualitative if necessary.

Default seed order (Harris, YC, 2018, adapted): cover, problem, solution, traction, insight, business_model, market, go_to_market, competition, team, financials (optional), ask. Overrides:

- Traction early when strong: at slide 2 as a teaser and again in depth later (YC Series A guide, 2020).
- Insight after solution, never before; competition after business model and go-to-market.
- Team at the end by default; at slide 2 or 3 only when the team is the advantage or at pre-seed.
- Ask last, followed only by closing and appendix. Nothing new after the ask.
- Alternate dense slides (traction, market, competition, financials) with light ones. Two tables or two charts back to back is where readers stall. `section` slides only in decks of 14 slides or more, at most three; one `statement` or `quote` slide near the middle breaks the rhythm better than a divider.

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
| Use of funds | `use_of_funds[]` on the ask slide (a donut) | 3 to 5 buckets as percentages |
| Unit economics (CAC, payback, margin) | table | each row names its data window |
| TAM, SAM, SOM | 3 market stats with method labels (drawn as nested circles with the numbers beside them) | each label carries its method; the circles are not to scale |
| Projection | `bar` or `line`, actual and projection as two series with `null` gaps | the projection series name contains "projection" and the title says "Projection" |
| Two metrics at once | two slides | never a double axis |

Honesty rules (metric definitions in `metrics.md`): the y-axis starts at zero (the builder enforces it); never cumulative alone, show the incremental figure beside it (YC Series A guide, 2020); one unit per axis, named in `y_label`; every series is a ledger series and `chart.source` names its id; growth charts show how long it took; a donut only for shares of one whole; no 3D. How charts are drawn: one accent series and the others quiet; in a single-series bar chart the latest bar is the accent and carries its value (`highlight: "none"`, an x label or an index changes that; `show_values` labels every bar); lines are labelled at their ends, a series whose name contains "projection", "plan" or "forecast" is dashed, and the first line gets a soft fill; `annotation: {"at": "Apr 26", "text": "Multi-site plan ships"}` marks the one event that explains the bend; `donut` shows shares with the largest in the hole; a stat with `trend` pairs a big number with its sparkline, and `sparklines[]` replaces a table of KPIs.

## 10. The "investor question" field and the read-alone test

Every slide object may carry `"question": "<the question in the investor's head that this slide answers>"`. The builder does not render it. It exists so the model and the founder can audit the deck: list all `question` values in order; the list must read as the natural interrogation an investor runs (what is it, who hurts, what do you do, is it working, why you, how big, how do you make money, how do you sell, who do you beat, who are you, what next, how much). A slide with no question to answer is cut or moved to the appendix (shawnpang output format; pedronauck teardown rubric).

Read-alone headline test: extract every `title` in order and read them as a paragraph with nothing else. It must tell the whole story: the world is a certain way, something changed, what you built, proof it works, why you, what you need. If a headline is a label ("Market", "Team") or needs its body to make sense, rewrite it. Run this before every build and record the result in `run-log.md`. The Meridian example below passes it: read its twelve titles in sequence.

## 11. Worked example: Meridian seed deck

Fictional B2B SaaS, seed, read-ahead variant, `ledger` theme. Numbers are consistent with the `facts.yaml` example in `file-formats.md` (MRR 41,000 EUR in October 2026) and extend it: 32 paying customers, average 1,281 EUR MRR per customer, average contract 15.4k EUR per year. The full 22-slide version with the appendix diagrams (flow, layers, matrix, timeline) is `assets/deck-template/example-deck.json`. It shows a cover with fast facts, colour-block splits (problem, solution with a `before_after` diagram, ask with a donut), a `section` slide, a mosaic traction slide (annotated chart, a stat with a trend, logos), a `quote`, a market slide drawn from its three stats, a `funnel`, a power grid, icons on points, and one emphasised phrase per title.

```json
{
  "meta": {"company": "Meridian", "tagline": "Dock scheduling that carriers actually use", "variant": "read", "theme": "ledger", "logo": "assets/meridian-logo.svg", "footer": "Meridian GmbH, confidential, November 2026", "pptx": "faithful"},
  "slides": [
    { "type": "cover", "title": "Meridian",
      "subtitle": "Dock scheduling that carriers actually use",
      "kicker": "Seed round, November 2026",
      "stats": [{"value": "EUR 41k", "label": "MRR, October 2026", "source": "fact:mrr_current"},{"value": "61", "label": "sites live at 32 operators", "source": "fact:customers_current"},{"value": "EUR 3M", "label": "raising, one close", "source": "fact:raise_amount"}],
      "question": "What is this, in plain words?", "notes": "Say: Meridian is dock scheduling that carriers actually use.\nTime: 20" },
    { "type": "problem", "title": "Trucks wait *94 minutes* at the average mid-size dock, and nobody is paid for that time",
      "points": [{"icon": "clock", "text": "Mid-size operators run 6 to 20 docks on phone calls, fax and a gatehouse clipboard"},{"icon": "banknote", "text": "Carriers charge waiting fees from the 61st minute; operators absorb them"},{"icon": "lock", "text": "Incumbent scheduling modules require carrier accounts; under 20 percent of carriers ever log in"}],
      "stats": [{"value": "94 min", "label": "median truck wait, 140 sites, 2025", "source": "fact:dock_wait_minutes"}],
      "source": "fact:dock_wait_minutes",
      "question": "Who hurts, how much, and what do they do about it now?", "notes": "Say: the wait is the cost; the workaround is a phone.\nContext: 140 sites surveyed in 2025.\nTransition: so we removed the account.\nTime: 60" },
    { "type": "solution", "title": "Carriers book a dock slot in *40 seconds* from their phone, no account needed",
      "diagram": {"kind": "before_after", "before": {"label": "Before, phone and fax", "value": "94 min", "text": "Median wait at the dock"}, "after": {"label": "After, Meridian link", "value": "31 min", "text": "At live sites within 8 weeks"}},
      "points": [{"icon": "link", "text": "Driver opens a link, picks a slot, done; the operator's board updates live"},{"icon": "settings", "text": "Operators set rules once: dock types, cut-offs, priority lanes"}],
      "source": "fact:wait_reduction",
      "question": "What do you do about it, and for whom?", "notes": "Say: a link, a slot, done.\nTransition: here is the product.\nTime: 60" },
    { "type": "section", "title": "Proof: it is *working*",
      "subtitle": "Revenue, retention and what customers say",
      "notes": "Time: 5" },
    { "type": "traction", "title": "MRR grew from 4k to *41k EUR* in 21 months with 2 logos lost",
      "chart": {"kind": "bar", "labels": ["Jan 25", "Apr 25", "Jul 25", "Oct 25", "Jan 26", "Apr 26", "Jul 26", "Oct 26"], "series": [{"name": "MRR (EUR k)", "values": [4,7,12,18,25,33,37,41]}], "y_label": "MRR, EUR k per month", "annotation": {"at": "Apr 26", "text": "Multi-site plan ships"}, "source": "fact:mrr_series"},
      "stats": [{"value": "118%", "label": "net revenue retention, trailing 12 months", "source": "fact:nrr_ttm"},{"value": "32", "label": "paying operators", "trend": [3,6,10,14,19,25,29,32], "source": "fact:customers_current"},{"value": "61", "label": "sites live", "source": "fact:customers_current"}],
      "logos": ["Nordfracht", "Elbe Trans", "Benelux Cargo", "Hansa Freight", "Rhein Kurier"],
      "question": "Is this working, and how fast?", "notes": "Say: 10x in 21 months; the step in April 2026 is the multi-site plan.\nContext: both lost logos were single-dock sites below our current minimum.\nTime: 120" },
    { "type": "quote", "quote": "We stopped answering the phone. The drivers book themselves and the yard is *calm by seven*.",
      "by": "Site manager",
      "role": "Mid-size operator, Hamburg, 14 docks",
      "stat": {"value": "31 min", "label": "median wait at this site, down from 96", "source": "fact:wait_reduction"},
      "question": "Does a real customer get the value you claim?", "notes": "Say: this is what an operator notices first.\nTime: 30" },
    { "type": "market", "title": "*185M EUR* serviceable today: 12,000 EU mid-size operators x our 15.4k EUR contract",
      "stats": [{"value": "EUR 1.8B", "label": "TAM: EU operators' yard and dock software spend, 12,000 x 150k EUR (assumption)", "source": "assumption:tam_bottom_up"},{"value": "EUR 185M", "label": "SAM: 12,000 operators x 15.4k EUR current contract (assumption)", "source": "assumption:sam_bottom_up"},{"value": "EUR 6.2M", "label": "SOM 2029: 400 operators x 15.4k EUR (projection)", "source": "projection:som_2029"}],
      "points": ["Operator count from Eurostat NACE H52 size classes, 2024; contract value from our own 32 contracts"],
      "question": "How big can this get, and how do you know?", "notes": "Say: the SAM is our price times the operators that exist.\nTime: 60" },
    { "type": "business_model", "title": "Operators pay *1,280 EUR* per site per month; 81 percent gross margin, 9-month payback",
      "stats": [{"value": "EUR 1,281", "label": "average MRR per customer", "source": "fact:mrr_per_customer"},{"value": "EUR 15.4k", "label": "average annual contract", "source": "fact:acv_current"},{"value": "81%", "label": "gross margin, Q3 2026", "source": "fact:gross_margin"},{"value": "9 months", "label": "CAC payback, gross-margin adjusted, 2026 cohort", "source": "fact:cac_payback"}],
      "points": [{"icon": "credit-card", "text": "Priced per site per month; carriers never pay"}],
      "question": "Who pays, how much, and does a euro in produce more than a euro out?", "notes": "Say: one price, per site, per month.\nTime: 60" },
    { "type": "go_to_market", "title": "Founder-led sales closes a 15k EUR contract in *34 days*; 9 of 32 customers came from carrier referrals",
      "diagram": {"kind": "funnel", "stages": [{"label": "Operators contacted, 2026", "value": "410"},{"label": "Demos on their own carrier list", "value": "96"},{"label": "One-dock pilots", "value": "31"},{"label": "Contracts signed", "value": "18"}]},
      "stats": [{"value": "34 days", "label": "median sales cycle, 2026", "source": "fact:sales_cycle_days"},{"value": "[needs number]", "label": "CAC, 2026 cohort", "source": "fact:cac_2026"}],
      "points": ["Beachhead: German and Benelux operators with 6 to 20 docks", "Next: two account executives from Q1 2027, each targeting 2 sites per month"],
      "source": "fact:sales_cycle_days",
      "question": "How do you get customers repeatably, and what does one cost?", "notes": "Say: a 20-minute demo on the operator's own carrier list, then a pilot on one dock.\nTime: 75" },
    { "type": "competition", "title": "Only Meridian lets a carrier book *without an account*; the two incumbents require one",
      "columns": ["", "Meridian", "Incumbent TMS module", "Point-solution startups", "Phone, fax, spreadsheet"],
      "rows": [["Carrier books without account",true,false,false, "n/a"],["Time to book a slot", "40 s", "4 to 6 min", "2 min", "a phone call"],["Setup time per site", "2 days", "6 to 12 weeks", "1 to 2 weeks", "none"],["Price per site per month", "1,280 EUR", "bundled in TMS", "600 to 900 EUR", "0 EUR"],["Yard management, ERP integrations", "partial", "full", "partial", "none"]],
      "source": "assumption:competitor_grid",
      "question": "Why will you win against the obvious alternatives, and why won't the incumbent copy you?", "notes": "Say: the incumbents are ahead on integrations and we say so.\nTime: 60" },
    { "type": "team", "title": "We ran 40 docks and built the scheduling engine at a 2B EUR carrier",
      "team": [{"name": "Lena Hoffmann", "role": "CEO", "bio": "12 years in operations at a mid-size operator, ran 40 docks across 3 sites"},{"name": "Tomas Varga", "role": "CTO, writes the code", "bio": "Built carrier-facing scheduling at a 2B EUR revenue carrier, team of 9"},{"name": "Priya Nair", "role": "Head of sales", "bio": "Closed 20 of the 32 customers; previously 6 years selling TMS software"}],
      "points": ["Lena and Tomas worked together for 4 years before founding Meridian"],
      "question": "Why these people, and who writes the code?", "notes": "Say: operator, engineer, seller.\nTime: 45" },
    { "type": "ask", "title": "Raising *EUR 3M* to reach 200k EUR MRR and 150 sites in 24 months",
      "subtitle": "One close, runway to month 24",
      "use_of_funds": [{"label": "Product and engineering", "pct": 50, "source": "assumption:use_of_funds"},{"label": "Go-to-market", "pct": 35},{"label": "Operations and buffer", "pct": 15}],
      "milestones": [{"when": "Q2 2027", "what": "60 sites live, 2 AEs ramped"},{"when": "Q4 2027", "what": "Yard-management module shipped, first 3 ERP integrations"},{"when": "Q4 2028", "what": "200k EUR MRR, 150 sites, NRR above 110 percent"}],
      "source": "fact:raise_amount",
      "question": "How much, for what, and what will be true when it is spent?", "notes": "Say: three million euros, two years, 150 sites.\nTime: 60" },
    { "type": "closing", "title": "Dock scheduling that carriers *actually use*",
      "points": [{"icon": "trending-up", "text": "EUR 41k MRR, up 10x in 21 months, 2 logos lost"},{"icon": "handshake", "text": "9 of 32 customers arrived through carrier referrals"},{"icon": "rocket", "text": "Raising EUR 3M to reach 200k EUR MRR in 24 months"}],
      "subtitle": "lena@meridian.example, +49 30 000 000, meridian.example",
      "notes": "Say: the one-liner again, then stop.\nTime: 20" }
  ]
}
```

Why this example validates: 13 slides plus the generated sources pages, zero capacity warnings in the read variant, every `title` a sentence with at most one emphasised phrase, every stat and chart carrying a `source` whose prefix (`fact`, `assumption`, `projection`) matches the ledger kind, one `[needs number]` left visible instead of an estimate, notes in the Say, Context, Transition, Time form, and a `question` on every content slide. Tones are not set anywhere: the builder assigns them and prints the sequence.
