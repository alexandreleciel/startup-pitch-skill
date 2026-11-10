# Deck pipeline

`pitch/deck/deck.json` is the single editable source. One Node script turns it into a
self-contained `deck.html` and a native `deck.pptx`; one shell script prints the HTML to a
PDF. Everything else (themes, fonts, charts, speaker notes, the sources slide) is derived.

```
deck.json  --build_deck.js-->  deck.html  (present in any browser; arrows, click, swipe; n = notes)
                          \->  deck.pptx  (pptxgenjs, native charts and tables, notes, structural check)
deck.html  --export_pdf.sh-->  deck.pdf   (Chrome headless print, one page per slide, vector text)
deck.html  --build_deck.js --check-->  qa/slide-NN.png + qa/report.json  (overflow and overlap report)
```

Preview of the example deck in the `graphite` theme (`example-deck.json`):

| | | |
|---|---|---|
| ![cover](preview/slide-01.jpg) | ![problem](preview/slide-02.jpg) | ![solution](preview/slide-03.jpg) |
| ![product](preview/slide-04.jpg) | ![traction](preview/slide-05.jpg) | ![insight](preview/slide-06.jpg) |
| ![business model](preview/slide-07.jpg) | ![market](preview/slide-08.jpg) | ![go to market](preview/slide-09.jpg) |
| ![competition](preview/slide-10.jpg) | ![team](preview/slide-11.jpg) | ![financials](preview/slide-12.jpg) |

## Commands

The usual way to run all of this is one command from the startup folder, `python3 scripts/pitch.py deck`: build, PDF, QA screenshots, number tracing and one summary. The individual commands below are what it calls.

```bash
# once per machine
scripts/check_env.sh                                   # what is installed, what each missing item unlocks
npm install --prefix scripts                           # pptxgenjs 4.0.1 and playwright-core (drives the installed Chrome for --check; no browser download)

# per deck
node scripts/build_deck.js pitch/deck/deck.json              # deck.html + deck.pptx next to the JSON
node scripts/build_deck.js pitch/deck/deck.json --html-only
node scripts/build_deck.js pitch/deck/deck.json --pptx-only
node scripts/build_deck.js pitch/deck/deck.json --out build/ # write elsewhere
node scripts/build_deck.js pitch/deck/deck.json --check      # also screenshot every slide to deck/qa/
node scripts/build_deck.js pitch/deck/deck.json --strict     # fail the build on any capacity warning
node scripts/build_deck.js --capacities                      # print the capacity table (what fits per slide type)
node scripts/build_deck.js pitch/deck/deck.json --facts pitch/facts.yaml   # ledger for the sources slide (auto-detected at pitch/facts.yaml)
scripts/export_pdf.sh pitch/deck/deck.html [deck.pdf]        # PDF, verifies page count == slide count
```

Try it on the example: copy `example-deck.json` and the `assets/` folder next to it into a
scratch directory as `deck.json`, then run the three commands above.

## Capacity lint

Before rendering, the builder checks deck.json against one capacity table (in the code,
printed by `--capacities`, documented in `references/deck-structure.md` section 4): how
many stats and points each layout holds, table rows and columns, chart labels and legend
names, in both variants. Text is measured, not counted: the lint wraps the actual words of
every title, point and label in the deck's own fonts. The four theme faces and 50 Google
Fonts families are built in as glyph-width tables; a deck that sets `font_display` or
`font_body` is measured in the installed Chrome (about a second) when it is available.
It prints one actionable line per violation, for example "slide 5 (traction): 4 stats and
1 point overfill the side column by about 17 percent. Fits 4 stats and no point, or 3
stats and 1 point up to 93 characters...". Warnings do not stop the build unless `--strict`
is set. The model was calibrated with the web fonts loaded and verified by rendering decks
at the limit in both variants and all four themes with `--check` (0 issues), so a deck with
no warnings should not need a second build.

## PPTX checks

After writing `deck.pptx` the builder always runs `scripts/pptx_check.py`, a structural
check that needs only the Python standard library: the archive is intact, every XML part
is well formed, the slide list matches the slide parts, every relationship resolves, every
part has a content type, and colours are six hex digits. It prints
`pptx_check (exit 0): archive, XML, slide list, relationships, content types and colours all OK`.
When Anthropic's pptx skill is installed on the machine (for example under
`~/.claude/skills/`), its OOXML validator is found and run as a second check and prints
`validate.py (exit 0): All validations PASSED!`; it needs `lxml` and `defusedxml`. This
skill does not contain that validator, and nothing has to be installed for the default
check. Set `PITCH_PPTX_VALIDATOR=/path/to/validate.py` to point at a copy elsewhere.
A failing check sets the build's exit code to 1.

## Editing

**deck.json** is the normal path. Field reference: `references/deck-structure.md` (what each
slide type must contain) and `references/file-formats.md` (the file contract). Rebuild after
every edit; the build is under a second.

- `meta`: `company`, `tagline`, `theme` (`graphite`, `paper`, `signal`, `midnight`),
  `accent` (6-digit hex, overrides the theme accent), `font_display`, `font_body` (Google
  Fonts family names), `logo` (path relative to deck.json; SVG or PNG), `footer`,
  `variant` (`present`, the default, or `read` for a send-ahead: draws `body` paragraphs and
  a source file under each stat), `sources` (`compact`, the default: a sources appendix with
  one row per source file, at most two slides; `full`: one row per ledger id; `none`: no
  appendix; `show_sources: false` still works), `pptx_fonts: "web"` (write the web font names into the PPTX instead of
  the safe fonts).
- Slide types: `cover`, `problem`, `solution`, `product`, `insight`, `market`, `traction`,
  `business_model`, `go_to_market`, `competition`, `team`, `financials`, `ask`, `roadmap`,
  `closing`, `appendix`, `sources`, `custom_html`, `statement`, `two_column`. Hyphenated
  spellings (`go-to-market`) are accepted. An unknown type renders as a statement with a
  visible amber badge.
- Fields: `title`, `subtitle`, `kicker`, `body` (read variant only), `points[]` (max 5),
  `stats[{value,label,source}]` (max 4), `chart{kind, labels[], series[{name, values[]}],
  y_label, source, show_values}` with `kind` one of `bar`, `line`, `stacked_bar`, `area`,
  `horizontal_bar` (`null` values leave a gap, which is how an actual series and a
  projection series share one chart), `image`, `columns[]` and `rows[]` for tables,
  `team[]` or `rows[]` of `[name, role, proof]`, `use_of_funds[{label, pct}]`,
  `milestones[]` or `rows[]` of `[date, milestone, proves]`, `notes`, `question` (not
  rendered; shown in the notes overlay and written into the PPTX notes), `source`.
- `[needs number]`, as a whole value or inside a sentence, renders as a dashed amber slot
  in both outputs and is listed in the build log. It never looks final.
- Table headers (`columns`) may include or omit the leading empty cell for the row labels.
- A product slide without an `image` sets its points across the full width.
- Content slides never show a raw ledger id. A chart or slide caption reads
  "Source: notes/bom-estimate.md" (the ledger entry's source file, or its label when the
  value is derived); without a `facts.yaml` it shows a superscript reference number that
  resolves on the sources slide. Stat-level captions appear only in the `read` variant.
- The sources appendix is generated from every `source` reference. With a `facts.yaml`
  the default is compact: one row per source file with its figure count, kinds and slides
  (the build prints "sources appendix: N files, M figures, P pages"); `meta.sources: "full"`
  prints id, label, value, kind, as-of date and file per ledger id. Without a ledger it is
  a numbered reference list. The build warns about ids that are not in the ledger.

**deck.html** can be hand-edited for a one-off tweak, but the next build overwrites it.
For a layout none of the types covers, use a `custom_html` slide: its `html` is inserted
verbatim inside the 1920x1080 stage and survives rebuilds. Theme tokens are available as
CSS variables (`var(--accent)`, `var(--font-display)`, see THEMES.md).

## Themes and fonts

Four themes live in `themes.css`; `THEMES.md` documents the tokens and when to pick which.
The builder inlines the CSS into `deck.html` and reads the same tokens for the PPTX, so
colours never drift between outputs. `meta.accent` overrides the accent and the first chart
colour; `meta.font_display` and `meta.font_body` swap the web fonts.

Web fonts load from Google Fonts with `display=swap` and fall back to size-adjusted local
faces when offline. The PPTX uses safe fonts (Cambria for the serif theme, Calibri or Arial
for the sans themes) because web fonts are not embedded in PowerPoint files.

## Presenting

Open `deck.html` in any browser. The 1920x1080 stage scales to the window. Keys: arrows,
space, PageUp/PageDown, Home, End; click the right two thirds for next, left third for
previous; swipe on touch screens; `n` toggles the speaker notes overlay (question plus
notes). The URL hash tracks the slide, so `deck.html#7` opens slide 7. `?print` lays all
slides out in sequence without scaling (what the PDF printer sees); `?noscale` keeps the
viewer interactive at 1:1 (what `--check` screenshots).

## Known limitations

- PPTX fonts substitute. The safe fonts are metric-compatible in PowerPoint and LibreOffice,
  but a PPTX never looks identical to the HTML. Open it once in PowerPoint before sending.
- Hand edits to `deck.html` are lost on rebuild unless they live in a `custom_html` slide.
- `custom_html` slides appear in the PPTX as their plain text with a note pointing to
  `deck.html`; the PPTX renderer cannot lay out arbitrary HTML.
- SVG images are embedded in the PPTX by rasterising them with Chrome through playwright-core
  (a `.svg.png` is written next to the SVG). Without Chrome the SVG is left out of the PPTX
  with a note; supply a PNG to avoid that.
- The capacity lint models the HTML layouts. The PPTX follows the same limits but its text is
  not measured, so look at the PPTX once before sending it.
- Offline, the fallback fonts change line breaks slightly. Nothing overflows in the four
  themes with the example content, but check `--check` after large text changes.
- Chart text in the SVG is set in the theme body font. Axis ticks use 1-2-5 steps (whole
  numbers when the data are whole numbers) and data labels keep the decimals the data have
  (`1.18`, `41.2`, `1.265M`). Supply values in the unit named by `y_label`.
- The builder does not read the ledger to verify numbers; it only decorates the sources
  slide and warns about unknown ids. `scripts/ledger_check.py` is the authority.
- No PowerPoint or Keynote is used in the test loop; PPTX QA relies on the structural
  check, Anthropic's validator where it is installed, and a LibreOffice render.
- `--check` measures what the browser shows. Offline it measures the fallback fonts, which
  are narrower, and says so; trust a clean result only when the log shows the web fonts loaded.

## Dependencies and versions tested

| Item | Version tested | Needed for |
|---|---|---|
| Node | 26.13.0 (18 or newer works) | build_deck.js |
| pptxgenjs | 4.0.1 | deck.pptx |
| playwright-core | 1.65.0 | `--check` screenshots, SVG rasterising, PDF fallback route |
| Google Chrome | 157.0.8103.50 | PDF print, screenshots (Edge or Chromium also work) |
| Python | 3.14 and 3.15 | pptx_check.py (standard library only) |
| lxml, defusedxml | 6.1.3, 0.7.1 | only for Anthropic's validator, when their pptx skill is installed |
| LibreOffice | 26.8.2.2 | PPTX preview render, PDF fallback from PPTX |
| poppler (pdfinfo, pdftoppm) | 26.11.0 | page-count check, PPTX preview images |
