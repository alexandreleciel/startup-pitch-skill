# Design: making the deck look like it was made for this company

Read this before writing `deck.json` and again when reviewing the QA screenshots. It distils
Anthropic's `frontend-design` skill and the html-slides lineage for the one case that matters
here: a 16:9 investor deck that will be presented on a projector and read as a PDF.

## Contents

1. Choose a theme for this company, not a default
2. Typography and the headline
3. One memorable element per slide
4. Charts and numbers
5. Images, logos and brand files
6. The generated-deck tells to avoid
7. QA pass on screenshots
8. When to use `custom_html`

## 1. Choose a theme for this company, not a default

Four themes ship in `assets/deck-template/themes.css` (details in `THEMES.md`):

| Theme | Feel | Fits |
|---|---|---|
| `graphite` | dark graphite ground, editorial serif display, warm off-white type | deep tech, hardware, infrastructure, anything that should feel considered |
| `paper` | warm light ground, one restrained green accent, humanist sans | B2B SaaS, services, read-ahead decks that will be printed or skimmed |
| `signal` | white ground, heavy wide grotesk, one hot orange-red accent, large numerals | consumer, marketplace, brands that trade on energy |
| `midnight` | deep navy, ice type, geometric sans, sky blue and amber | fintech, data, security |

Pick by audience and setting, then say why in one line in the run log. Dark grounds carry a
room; light grounds read better as PDFs on a laptop. If the founder's folder has a brand file
(hex colours, font names, a logo), keep the theme that fits the setting and set `meta.accent`
to the brand colour and `meta.font_display` / `meta.font_body` to the brand faces. Check the
accent against the ground: a mid-blue accent on `midnight` disappears, a pale accent on
`paper` has no contrast. The builder does not check contrast; you do, on the screenshots.

Never ship a theme because it is first in the list. A pitch deck is the one document where
investors see twenty near-identical decks a week; the theme choice is part of the message.

## 2. Typography and the headline

The headline carries the slide. Rules the builder enforces by layout and you enforce by
writing:

- The headline is the takeaway, under twelve words, with the number, unit and date when the
  slide is about a number. "MRR grew 10x in 21 months to EUR 41k (Oct 2026)" beats "Traction".
- Headlines read alone: scrolling only the titles tells the whole pitch. Test this in the
  speaker-notes overlay or by reading `deck.json` titles top to bottom.
- Sentence case. No ALL CAPS eyebrow labels, no middle-dot meta strings, no arrows appended
  to text, no single word in a different colour for emphasis.
- Body copy under 30 words per slide in the presented variant. If it needs more, it is two
  slides or it belongs in the speaker notes.
- One display face and one body face, from the theme. Do not mix in a third.

## 3. One memorable element per slide

Each slide type has a built-in focal element: the wordmark on the cover, the big number on
the problem slide, the chart on traction, the stepped blocks on market, the amount on the ask.
Everything else on the slide stays quiet. Before adding anything (a second stat, an extra
bullet, an image), ask what it adds to the one message. Density limits per slide type are in
`deck-structure.md`; the builder warns when you exceed them, and the warning is a signal to
cut, not to shrink type.

Rhythm matters across the deck: alternate dense slides (traction, business model, competition)
with light ones (insight, statement, closing). A deck of fourteen stat grids is a spreadsheet.

## 4. Charts and numbers

The builder draws charts as inline SVG (HTML, PDF) and native charts (PPTX) from the same data,
with the y axis at zero and a source caption under every chart. What you control:

- Pick the chart kind by the data: `bar` for monthly or quarterly totals, `line` for cohorts
  and trends over many periods, `stacked_bar` for use of funds or revenue mix, `horizontal_bar`
  for ranked categories, `area` only for a single cumulative series shown next to its
  incremental counterpart. No pie charts.
- One series unless the comparison is the point. Two at most. Actual and projection share one
  chart with `null` gaps so the break is visible.
- Labels carry units and dates: "EUR k / month", "Jan 25 ... Oct 26". Round to the precision
  the source supports; a 41,183 becomes 41.2k, not 41,183.
- Every `stats[].value` and chart `source` names a ledger id (`fact:mrr_current`). The sources
  slide is generated from these; a stat without a source prints an amber "needs source".
- `[needs number]` renders as a dashed amber slot. That is intentional: a founder must not be
  able to send a deck with an invented figure by accident. Clear every slot or leave the gap
  visible and say so in the handoff.

## 5. Images, logos and brand files

- `meta.logo` takes an SVG or PNG from the founder's folder; the builder copies it next to the
  deck and embeds it. SVG logos in the PPTX need playwright-core to rasterise; otherwise
  supply a PNG.
- Product screenshots go on the `product` slide only, inside the frame the layout provides.
  One image, real product, no stock photography, no generic illustration of "a team" or
  "growth".
- A team slide uses names, roles and one proof line each; photos are optional and only if
  the founder supplies them.

## 6. The generated-deck tells to avoid

These are the patterns that make a deck look machine-made, drawn from the frontend-design
calibration list and from investor feedback on AI-written decks. The themes avoid them by
construction; do not reintroduce them through `custom_html` or copy:

- cream background with a terracotta accent and a high-contrast serif as a reflex choice;
  near-black with one acid green; both are fine only when chosen for a reason
- the card kit: content chopped into identical rounded cards with the same soft shadow
- gradient washes as decoration, glow effects, particles
- tracked-out ALL-CAPS labels above every heading, "01 / 02 / 03" numbering on content
  that is not a sequence
- a competition 2x2 with the company alone in the top right
- fade-and-slide-up on every element; one restrained reveal per slide at most, and none in
  the PDF
- buzzword copy: revolutionary, disrupt, seamless, cutting-edge, world-class, best-in-class,
  unlock, leverage, synergy. Replace with the specific thing.
- a market slide that is three circles with billions and no method line

## 7. QA pass on screenshots

Run `pitch.py deck` and open `pitch/deck/qa/`.
The summary lists capacity warnings (what fits on each layout), overflow, clipped text and overlaps; fix those first in `deck.json`. Then
look at every slide and ask, in this order:

1. Does the headline alone tell me what this slide proves?
2. Is there exactly one thing my eye goes to? Is it the right thing?
3. Can I read the smallest text from the back of a room (nothing under 22 px on the stage)?
4. Does every number carry a unit and a date, and a source caption?
5. Would a founder be embarrassed by any word on this slide (buzzwords, hedges, filler)?
6. Does the deck still work in grayscale (print test) and without the web fonts (offline)?

Fix in `deck.json`, rebuild, re-check. Three passes is normal.

## 8. When to use `custom_html`

Only for a layout the builder does not have (a product flow diagram, a before-and-after, a
timeline with more than five points). Write it with the theme tokens (`var(--ink)`,
`var(--accent)`, `var(--font-display)`), keep it inside the 1920x1080 stage with fixed pixel
sizes, and give it `source` ids like any other slide. The PPTX gets the slide's text and notes
only, so if the investor will receive the PPTX, prefer a built-in type.
