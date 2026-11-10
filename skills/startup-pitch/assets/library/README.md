# Pitch deck reference library

`pitch-decks.csv` is an index of publicly available, real, money-raising startup pitch decks with links to the public pages that show them. It is an index, not a redistribution: no slide files are stored here, every row points to the aggregator or first-party page where the deck is embedded or displayed, and that page's owner controls availability.

Companion files: `unavailable.csv` (famous decks that are not public, with what is public instead), `../../references/deck-library.md` (curated study set of 25 decks with slide-by-slide structure), `../../scripts/library.py` (search CLI), `../../scripts/library_verify.py` (link re-checker), `../../scripts/library_build.py` (the collection script).

## Columns

`id, company, round, year, amount_usd, sector, geography, source_site, source_url, deck_format, slide_count, outcome_note, verified_status, verified_at, notes`

- `round`: pre-seed, seed, series-a, series-b, series-c, series-d+, growth, ipo, unknown. "Late Stage" labels from aggregators map to growth; "Other", "Undisclosed" and URLs that leaked into the stage field map to unknown.
- `sector`: one of fintech, saas, marketplace, consumer, healthtech, biotech, edtech, hardware, deeptech, ai, climate, mobility, proptech, foodtech, media, gaming, devtools, security, hr, logistics, other. Assigned by keyword rules over the aggregators' industry tags and descriptions (see `classify_sector` in `library_build.py`), then corrected by hand for the well-known decks.
- `amount_usd`: integer USD as reported by the aggregator. EUR, GBP and other currencies are converted at fixed rates (EUR 1.08, GBP 1.27, CHF 1.12) and the original amount is kept in `notes`.
- `geography`: blank in this build (the aggregators do not expose it reliably).
- `deck_format`: slideshare_embed, drive_embed, images, pdf or article, detected on the source page during verification.
- `slide_count`: filled only when it can be counted from slide images (alexanderjarvis.com pages) or is stated in a headline; blank otherwise.
- `outcome_note`: a later-funding fact copied from the source page when it offers one (pitchdeckhunt.com "has raised a total of..." lines, alexanderjarvis.com fundraise tables). Blank when the page has none. These are the aggregators' figures, not independently checked.
- `notes`: alternate URLs for the same deck on other aggregators (`also:` prefix), which field came from which source when sources disagree, currency conversions, Business Insider coverage links.

## How rows were collected (2026-11-10)

All rows were produced by `scripts/library_build.py` from pages fetched on 2026-11-10. Nothing was typed in by hand except the corrections listed in the script's `OVERRIDES` and `POST_FIX` tables, each tied to a fetched page.

1. pitchdeckhunt.com: `sitemap.xml` (961 deck URLs), every deck page fetched and parsed for industry, amount, year, stage and the SlideShare embed key.
2. bestpitchdeck.com: homepage cards (845 companies with amount, year, stage), plus the deck page for every row kept from this source, fetched at one request per 2.6 seconds (the site returns 429 above that).
3. failory.com: the `/pitch-deck` listing (487 company decks with industry tags, round and amount).
4. alexanderjarvis.com: Yoast post sitemaps (599 deck posts; company, amount and round parsed from the slug), plus the page for every kept row that has one (slide images, fundraise table).
5. businessinsider.com: monthly sitemaps 2022-01 to 2026-11, 950 article slugs containing "pitch-deck", each article fetched for its headline; company, amount and round are parsed from the headline. Roundups, "how to" pieces and "raised without a pitch deck" stories are skipped. Business Insider articles are paywalled image galleries; the row records the article, not a slide file.
6. Companies were merged across sources by normalised name (round labels kept, so "Front" and "Front (Series B)" stay separate). Field precedence: pitchdeckhunt.com when its stage is a real round and its amount is a round amount (its comma-formatted amounts are total funding), then bestpitchdeck.com, failory.com, alexanderjarvis.com, Business Insider. "Late Stage" labels rank below a specific round from any source.
7. Selection: all requested famous decks, then rows with year and amount, scored for completeness and recency, capped at 36 rows per year so the index spreads across 2003 to 2026. Target 440 rows.

Sources deliberately excluded: slidebean.com, pitch.com, bestpitch.es, beautiful.ai, slideteam and other template or redesign galleries (not faithful copies). The PitchDeckCoach "Airbnb" SlideShare is a reproduction and is not used; the Airbnb row points to the 14-slide original as shown on alexanderjarvis.com, with the Business Insider 2011 article and SlideShare 65585661 (the upload pitchdeckhunt.com and bestpitchdeck.com embed) in `notes`.

## Verification method

`scripts/library_verify.py`, run on 2026-11-10 over all 440 rows:

1. GET `source_url` with a browser User-Agent, following redirects; record HTTP status and final URL.
2. `redirect` when the final URL differs from the requested one (ignoring scheme, trailing slash and query) but still returns 200 and passes the content checks.
3. The page must be about the company: `<title>` or `og:title` must contain the company name (catches "Not Found" pages served with HTTP 200).
4. Aggregator pages must carry a deck signal: `slideshare.net/slideshow/embed_code/key/`, `drive.google.com/file/d/`, `youtube.com/embed/`, or at least 5 slide images on alexanderjarvis.com. The signal sets `deck_format` and, for slide images, `slide_count`.
5. slideshare.net itself is never fetched (it serves a bot-challenge page to scripts); the aggregator's embed code stands in for it. A SlideShare upload can therefore be removed without this check noticing until the aggregator drops the embed.
6. Status values: `ok`, `redirect`, `missing` (404, 410, 5xx, title mismatch or no deck signal), `blocked` (403, 429, network error, bot challenge).

Pacing: bestpitchdeck.com one request per 2.6 s; alexanderjarvis.com, businessinsider.com and failory.com one per 0.5 s; pitchdeckhunt.com one per 0.15 s. Hosts run in parallel, each host sequentially.

Status distribution after the 2026-11-10 run over 440 rows: ok 437, missing 3, redirect 0, blocked 0. The three `missing` rows (Woodoo on bestpitchdeck.com, Launchrock and Ledgy on pitchdeckhunt.com) are pages that no longer carry a deck embed or whose title no longer matches the company; they are kept with their status so a later run can pick them up again. `python3 scripts/library.py --stats` prints the current counts.

## How to re-verify

```
python3 scripts/library_verify.py                # all rows, writes verified_status and verified_at
python3 scripts/library_verify.py --only-missing # only rows that are not ok
python3 scripts/library_verify.py --limit 20 --dry-run
```

Re-run monthly. Rows that fail stay in the file with their status rather than being deleted, because aggregator slugs are stable and pages often come back. To rebuild the index from scratch: `python3 scripts/library_build.py --cache /tmp/deck-cache --out assets/library/pitch-decks.csv --target 440` (about 15 minutes, dominated by the bestpitchdeck.com pacing and the Business Insider article fetches).

## Searching

```
python3 scripts/library.py --sector fintech --round seed --year-from 2020 --limit 10
python3 scripts/library.py --company airbnb --notes
python3 scripts/library.py --random 5 --seed 1
python3 scripts/library.py --stats
```

## Known limitations

- The aggregators host embeds, not files. A deck can disappear from SlideShare or Google Drive while the aggregator page still returns 200; the verifier only sees the embed code, not the embedded file.
- Amounts, years and stages are as reported by the aggregators and they disagree with each other for a noticeable share of companies (for example LinkedIn's Series B is dated 2004 by pitchdeckhunt.com and 2014 by bestpitchdeck.com; the deck itself says August 2004). Where sources disagree the `notes` column says which source was used.
- pitchdeckhunt.com's comma-formatted amounts (for example $203,600,000 for Front) are total funding to date, not the round in the deck; the build treats such rows as weak and prefers another source's round amount.
- Business Insider rows (2022 to 2026) are parsed from headlines: the round is `unknown` when the headline does not name it, the sector leans towards `ai` because headlines say "AI startup", and the company name is a best-effort extraction. The articles are paywalled.
- Sector is a single label from keyword rules; multi-sector companies (fintech + AI, health + AI) get the first matching label.
- Slide counts are known only for rows with slide images (alexanderjarvis.com) or a headline that states the count.
- `geography` is empty in this build.
- Some alexanderjarvis.com pages show the wrong or partial slides (Foursquare shows a board-meeting template, Revolut shows 2 of its slides, BuzzFeed mixes in Rocket Internet slides). Those rows keep their other aggregator links; `unavailable.csv` records the cases found.
- Licenses of the aggregator pages were not reviewed. This library links to them; it does not copy their content.
