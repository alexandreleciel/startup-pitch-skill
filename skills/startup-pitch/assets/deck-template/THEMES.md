# Deck themes

Four named themes live in `themes.css` as CSS custom property sets. `build_deck.js` inlines the file into `deck.html` and parses the same tokens for the PPTX renderer, so the file is the only place colours and fonts are defined. Pick one with `meta.theme` in `deck.json`.

## Picking a theme

| Theme | Ground | Display face | Body face | Accent | Built for |
|---|---|---|---|---|---|
| `graphite` | near-black graphite `#23252B`, warm off-white type `#F2EDE4` | Newsreader (editorial serif, optical sizes) | Hanken Grotesk | periwinkle `#A9BBFF`, brass `#D5A54A` second | premium, deep tech, hardware, anything that should feel considered rather than loud |
| `paper` | warm light `#F6F4EF`, dark ink `#1F2429` | Albert Sans 600 | Albert Sans 400 | one restrained green `#1F6F5B`, ochre second | B2B SaaS, services, anything sent as a read-ahead |
| `signal` | white `#FFFFFF`, ink `#1C1E24` | Archivo 800 (wide, heavy) | Figtree | hot orange-red `#FF4A1C`, ink as second | consumer, marketplace, brands that want large numerals and energy |
| `midnight` | deep navy `#0F1B33`, ice type `#E8F0FA` | Sora 600 (geometric) | IBM Plex Sans | sky blue `#6FB8FF`, amber `#FFC857` second | fintech, infrastructure, security, data |

Rules of thumb: dark grounds (`graphite`, `midnight`) present well in a room and on a projector; light grounds (`paper`, `signal`) read better as PDFs and on laptops. If the company has a brand colour, keep the theme and set `meta.accent`.

## Token contract

Every theme defines all of these:

| Token | Used for |
|---|---|
| `--bg` | slide background |
| `--ink` | primary type |
| `--muted` | captions, axis labels, secondary type, footer |
| `--accent` | the one hot colour: kicker, bullet marks, chart series 1, the focus block on the market slide |
| `--accent-2` | second chart series, small marks |
| `--surface` | tinted panels: image frames, market blocks, table row highlight, avatar circles |
| `--rule` | hairlines, gridlines, separators |
| `--font-display`, `--font-body` | web font stacks with local fallbacks |
| `--chart-1` to `--chart-5` | categorical chart palette, in order; `--chart-1` equals the accent |
| `--pptx-display`, `--pptx-body` | safe fonts written into the PPTX (Cambria for the serif theme, Calibri or Arial for sans) |
| `--gfonts` | Google Fonts families to load, `Family:axes@values|Family2:...` |
| `--display-weight`, `--display-tracking` | weight and letter spacing for display type, so a serif at 400 and a grotesk at 800 both look intended |

Keep every colour as 6-digit `#RRGGBB`. The PPTX renderer strips the hash; pptxgenjs rejects 8-digit alpha hex.

## Overrides from deck.json

- `meta.accent: "#2E6BE6"` replaces `--accent` and `--chart-1`. Check contrast against the theme ground; the builder does not.
- `meta.font_display: "Fraunces"` and `meta.font_body: "Inter"` replace the first family in the stack and add the family to the Google Fonts request (weights 400 to 700). The PPTX keeps the safe font unless `meta.pptx_fonts: "web"` is set, in which case the web family name is written into the file and PowerPoint substitutes if it is not installed.

## Adding a theme

Copy one block in `themes.css`, rename the selector (`[data-theme="yourname"]`), fill every token, and add a `@font-face` fallback line for each new web family. Then set `meta.theme: "yourname"`. Avoid the generated-page defaults named in the frontend-design skill: cream plus terracotta plus serif, black plus acid green, identical rounded cards with the same soft shadow, all-caps eyebrow labels, middle-dot meta strings, arrows appended to text.

## Offline

Fonts load from Google Fonts with `display=swap`. Without network the `*-Fallback` faces (local Georgia, Iowan Old Style, Helvetica Neue, Avenir Next, Arial, size-adjusted) render instead, so line breaks move slightly but nothing overflows. For a fully offline deck, download the WOFF2 files and replace the `<link>` in `deck.html` with `@font-face` rules; the rebuild will overwrite that edit.
