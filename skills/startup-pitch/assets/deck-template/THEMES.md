# Deck themes: nine art directions

What this file is for: choosing `meta.theme` for a deck and understanding what a theme controls. Tokens live in `themes.css`; `build_deck.js` parses that file, so a colour or font changed there changes every deck.
Read it when you set `meta.theme`, when a founder asks for "our colours", or when a deck looks wrong on a projector.

## Pick one per company

Choose by who the company sells to and what the room expects, not by taste or habit. `ledger` is a sound choice for most B2B companies; say why you chose what you chose.

| Theme | Mood | Ground, type | Signature | Use it for |
|---|---|---|---|---|
| `ledger` | Swiss financial print: calm, exact | cool paper, navy ink, cobalt; Hanken Grotesk, IBM Plex Mono | hairline mosaic: cells share 1px borders, one ink cell and one cobalt cell per slide, tabular numerals | fintech, B2B SaaS, infrastructure, data, anything sold to a CFO |
| `nocturne` | late-edition magazine: dark, warm | plum-black with a vignette, bone type, hot pink; Fraunces, Geist, DM Mono | light serif numerals in pink, italic emphasis, fine grain, chapter labels | consumer, creator economy, media, commerce, hospitality, music, fashion |
| `poster` | risograph poster: loud, flat, physical | paper, ink, cobalt, tomato, yolk; Big Shoulders Display capitals, Albert Sans | colour blocks, condensed capitals, 3px ink outlines on diagrams, highlighter emphasis, grain | climate, hardware, marketplaces, food, mobility, consumer brands |
| `blueprint` | engineering drawing: precise, technical | blueprint blue with a dot grid, white type, yellow marker; Archivo expanded, DM Mono | corner crosshairs, "Sheet 04 of 14", outlined cells, yellow on exactly one thing | robotics, deep tech, AI infrastructure, developer tools, space, energy, industrial |
| `studio` | friendly product studio: bright, tactile | lavender, ink, violet, lime, orange; Bricolage Grotesque, Instrument Serif italic | white cards with 2px outlines and hard offset shadows, big flat shapes cropped by the edge, serif italic emphasis and monograms | consumer apps, health, education, community, future of work, family |
| `graphite` | near-black editorial | graphite, warm off-white, periwinkle; Newsreader, Hanken Grotesk | serif display with italic emphasis, hair rules, vignette and grain | premium and deep-tech companies, research-heavy stories |
| `paper` | warm paper, quiet and exact | off-white, dark ink, one green; Albert Sans | soft tinted cells with rounded corners | B2B SaaS and services when the deck should feel calm |
| `signal` | white, heavy, one hot orange | white, near-black, orange; Archivo, Figtree | orange used as a block, highlighter emphasis | consumer and marketplace companies |
| `midnight` | deep navy with a soft glow | navy, pale blue type, sky blue, amber; Sora, IBM Plex Sans | outlined rounded cells, a glow in one corner | fintech, security and infrastructure on a dark stage |

Older names still resolve: `signal-print` is `poster`, `soft-machine` is `studio`.

## Tones and rhythm

Every theme has three tones, each a complete colour set: `light`, `dark` and `accent` (a full-bleed ground in the brand colour). `poster` and `studio` add a fourth colour block the builder uses for cells.

Every slide gets one tone. Leave `tone` out and the builder assigns it:

- cover and closing take the theme's cover tone;
- `section` and `statement` slides alternate through the theme's two bold tones;
- data slides stay on the theme's base tone (light for most themes, dark for `nocturne`, `graphite` and `midnight`, blue for `blueprint`);
- a fourth slide in a row never shares the tone of the three before it: the slide in the run that carries an inversion best (a quote, the insight, the ask, the team) flips to the contrast tone.

Set `"tone": "light" | "dark" | "accent"` on a slide only to make a point (the ask on the accent ground, one dark slide for the product). The build log prints the sequence, for example `tones: D L L D L A L ...`. Inside a slide, filled cells and panels are nested tones, so type on them always takes the right ink.

## What a theme controls

- Type roles: `display` (headlines), `em` (the emphasised phrase), `num` (hero numerals), `body`, `mono` (running head, page count, labels, captions, axis labels). All faces are on Google Fonts and load from the one link in `deck.html`; offline, the fallback stacks apply.
- Emphasis: one phrase per title between asterisks, `"Trucks wait *94 minutes* at the dock"`. It is drawn in the theme's way: accent colour (`ledger`, `paper`, `midnight`), serif italic (`nocturne`, `graphite`, `studio`) or a highlighter block (`poster`, `blueprint`, `signal`). On a ground where the accent would not show, the highlighter block is used.
- Cells: how the mosaic is drawn (shared hairlines, colour blocks, outlines, cards with hard shadows, soft tinted panels).
- Background per tone: layered radial gradients, a dot or line grid, a vignette, and grain as a small repeating PNG tile. No full-slide SVG filters and no backdrop blur, so the PDF stays small and prints exactly.
- Marginalia: company and section at the top left, page count at the top right, the source caption at the bottom left, `meta.footer` at the bottom right, all in the mono role.
- Contrast: text colours are checked against 4.5:1 on their ground when the theme is loaded. An accent that is too weak for text keeps its colour for fills and gets a darker or lighter version for type.

## Overrides in deck.json

```json
"meta": { "theme": "ledger", "accent": "#0F4C5C", "font_display": "Space Grotesk", "font_body": "Inter", "logo_light": "assets/logo-white.svg" }
```

- `accent` (`#RRGGBB`) replaces the accent of the light and dark tones and becomes the ground of the accent tone. Type on it is set in whichever ink reads best.
- `font_display` and `font_body` take any Google Fonts family. The builder measures the new faces in Chrome at build time so the capacity lint stays exact; offline it falls back to its family tables.
- `logo_light` is a version of the logo for dark and coloured grounds. Without it the logo sits on a small white chip there.
- Any slide can set `tone`.

## Adding or changing a theme

Copy a block in `themes.css`, rename it, change the tokens (the header of that file documents each one). Then run `node scripts/build_deck.js --measure-fonts` once (Chrome, online): it re-measures the glyph widths of every theme face into `font-metrics.json`, which the capacity lint uses. Build `example-deck.json` with `--check` and look at `qa/`; the check reports text below the size floor and contrast under 4.5:1.

## Fonts and PowerPoint

The faithful PPTX carries pictures of the slides, so the fonts are exactly those of the HTML and PDF. The editable PPTX sets native text in safe fonts (`--pptx-display`, `--pptx-body`: Calibri, Arial, Georgia, Cambria, Impact) because PowerPoint cannot embed web fonts; `"pptx_fonts": "web"` writes the web font names instead, for machines that have them installed.

## Icons

`icons.json` holds 74 icons from Lucide (lucide-static 1.71.0, ISC license, https://github.com/lucide-icons/lucide). Use them by name on points, cards and flow steps (`{"icon": "truck", "text": "..."}`). An unknown name is drawn as a plain mark and listed in the build log. Names: see `icons.json` or deck-structure.md section 3.
