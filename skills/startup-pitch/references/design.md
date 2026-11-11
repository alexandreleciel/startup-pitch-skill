# Design: a deck that looks made for this company

Read this before writing `deck.json` and again when reviewing the QA screenshots. Field
names, diagram kinds and the capacity table are in `deck-structure.md`; the nine art
directions are in `assets/deck-template/THEMES.md`. This file is about judgement.

## Contents

1. What "designed" means here
2. Choosing the art direction
3. Composing a slide
4. Choosing the visual for the content
5. Rhythm across the deck
6. Numbers and charts
7. What makes a deck look cheap
8. Reviewing the screenshots
9. PowerPoint: none, faithful or editable

## 1. What "designed" means here

An investor sees twenty decks a week. A designed deck is one where each slide has a single
thing the eye lands on, the whole stage is used, the look belongs to this company, and the
sequence has pace. A typed deck is a title in the top-left corner with small text under it,
the same on every slide. The builder draws the layouts, tones, grids and diagrams; your job
is to give it content with a shape: a number, a diagram, an image, a quote. A slide with
only a title and bullets is not finished.

## 2. Choosing the art direction

Pick from the nine themes in `THEMES.md` by who the company sells to and the room the deck
will be seen in. Useful starting points: `ledger` for anything sold to a finance or
operations buyer; `blueprint` for deep tech, robotics and infrastructure; `nocturne` for
consumer, media and commerce; `poster` for hardware, climate, food and marketplaces;
`studio` for friendly consumer and health products. The older four (`graphite`, `paper`,
`signal`, `midnight`) are quieter.

- If the folder has brand colours, fonts or a logo, keep the theme that fits and set
  `meta.accent`, `meta.font_display`, `meta.font_body`, `meta.logo` and, for dark grounds,
  `meta.logo_light`. The builder checks contrast and adjusts the accent for text.
- Choose for a reason and write it in one line in the run log. Do not reuse the theme of
  the last deck you built out of habit.
- Which brand colour becomes the accent: the one that contrasts with the theme's ink. A
  brand navy or dark teal on a navy-ink theme disappears; use the brand's brighter colour
  as the accent and let the dark one be the ink.
- If the logo is dark, make or ask for a light version and set `meta.logo_light`, so it
  does not sit on a white chip on dark slides.
- A reading deck sent ahead works on any theme; a deck projected in a bright room is safer
  on a light base tone.

## 3. Composing a slide

- **One focal element.** A hero number, a diagram, a product image, a quote, or the headline
  itself on statement slides. Everything else supports it.
- **The title is the takeaway**, under twelve words, with its number, unit and date. Mark
  the phrase that carries the point with asterisks: `"MRR grew *2.15x* in 12 months"`. One
  emphasis per title.
- **Give the number its own stat.** A figure inside a sentence is invisible; the same figure
  as a stat owns a cell. Use `trend` or `delta` when there is a before.
- **Fill the stage.** If the build reports a slide as looking empty, add the missing visual
  (a diagram, a second stat, an image, a quote) or merge the slide with its neighbour. Do not
  pad with words.
- **Cut, do not shrink.** When the capacity check says a slide is over, remove words or split
  it. The renderer picks type sizes; shorter content is set larger.
- **Icons carry meaning or are left out.** Use `icon` on points and steps when the icon names
  the thing (a truck for carriers, a shield for compliance). Three unrelated icons are noise.

## 4. Choosing the visual for the content

| The content is | Use |
|---|---|
| A process, how it works, a pipeline through the product | `diagram: flow` (with a loop-back if it feeds itself) |
| Conversion from many to few (pipeline, onboarding) | `diagram: funnel` |
| Market sizing | `market` slide with three stats and their methods: drawn as nested circles |
| Competitors by capability | `diagram: power_grid`, or the competition table |
| Two real trade-offs with named competitors | `diagram: matrix` (never the company alone in a corner) |
| Milestones, roadmap, what the round buys | `diagram: timeline` with a today marker |
| A self-reinforcing loop | `diagram: loop` |
| Architecture, product tiers | `diagram: layers` |
| A measured change for a customer | `diagram: before_after`, or a `case_study` slide |
| The product | `image` with `frame: browser` or `phone`; two images may overlap |
| The best sentence a customer said | `quote` slide, with the metric beside it |
| Customers or partners with permission to name | `logos[]` |
| Use of funds | chart `donut` |
| Growth over time | bar chart: the latest bar is highlighted automatically; add an `annotation` at the event that changed the slope |
| Several health metrics | `sparklines[]` |
| A chapter break | `section` slide |
| One sentence that must land | `statement` slide |

A market slide needs a serviceable market with its method; show the wider market only when
the folder sources it, and use today's revenue as the inner ring when there is no
obtainable-market figure. Keep flow steps to similar lengths so the cards match, and keep
section titles short: they become the running head of the slides that follow.

When the folder has no product image, do not leave a frame empty: explain the product with a
`flow` or `before_after` diagram and ask the founder for screenshots.

## 5. Rhythm across the deck

The builder alternates light, dark and accent tones on its own; set `tone` on a slide only
to make a point. What you control is the sequence: open with the cover and the problem,
place a `section` slide before each chapter (two or three in a 12 to 16 slide deck), follow
a dense slide (traction, business model, competition) with a light one (quote, statement,
insight), and end on a closing slide that repeats the one-liner with three hero facts. Read
the tone line in the build log (`tones: D L L D L A ...`): four data slides in a row with no
break means a section, quote or statement is missing.

## 6. Numbers and charts

- Every stat and chart cites a ledger id; the sources slide is generated from them.
- One series unless the comparison is the point; actual and projection share a chart with a
  `null` gap so the break is visible. The y axis starts at zero.
- Labels carry units and dates. Round to what the source supports.
- `[needs number]` and `[needs detail]` render as amber slots on purpose: a founder must not
  be able to send an invented figure by accident.
- Small samples say so on the slide ("one site, three months", "n=212").

## 7. What makes a deck look cheap

Check the finished deck against this list; each item is a reason an investor discounts the
company before reading a word.

- every slide the same layout and background
- titles that are labels ("Traction", "Market") instead of takeaways
- bullets where a number, diagram or image should be
- small text with the bottom half of the slide empty
- three or more fonts, or more than one accent colour used at equal weight
- a pie chart with many slices; a chart without units, dates or a highlighted point
- a competition 2x2 with the company alone in the top-right corner
- stock photos, clip-art icons, decorative illustrations unrelated to the product
- screenshots without a frame, stretched or blurry
- a team slide of names with no proof line
- buzzwords: revolutionary, disrupt, seamless, cutting-edge, world-class, unlock, leverage
- a market slide of three numbers with no method
- visible placeholders the founder did not choose to leave

## 8. Reviewing the screenshots

`pitch.py deck` writes `pitch/deck/qa/slide-NN.png` and reports capacity, overflow, contrast,
minimum text size and slides that look empty. Fix those lines first. Then open every
screenshot and ask:

1. In two seconds, what is this slide about? If the answer is not the title's point, the
   focal element is wrong.
2. Is the stage used, without crowding?
3. Does the deck change pace, or do five slides in a row look alike?
4. Would this slide survive next to one made by a designer? If not, change its content
   shape (see section 4), not its wording.
5. Is anything on it that the founder could not defend, or that should not be public?

Three build-and-look passes is normal for a good deck.

## 9. PowerPoint: none, faithful or editable

The HTML deck and its PDF are the designed artefact. PowerPoint cannot reproduce every
effect, so the founder chooses (`meta.pptx`):

- `none`: PDF and web deck only. The right choice when the deck is sent as a link or PDF.
- `faithful` (default): each slide is a high-resolution picture with speaker notes. It looks
  identical to the PDF; the text cannot be edited in PowerPoint. Edit `deck.json` and rebuild.
- `editable`: text and charts are native and editable; grounds, cells and diagrams are
  pictures. Close to the PDF, with safe fonts, so line breaks can differ slightly.

Ask once, before building. If the founder will hand the deck to someone who must edit it in
PowerPoint, choose `editable`; otherwise `faithful` or `none`.

`custom_html` remains for a layout the builder does not have. Use the theme's CSS variables,
stay inside the 1920x1080 stage, and cite sources as on any other slide. It is not measured
by the capacity check, so look at its screenshot with extra care.
