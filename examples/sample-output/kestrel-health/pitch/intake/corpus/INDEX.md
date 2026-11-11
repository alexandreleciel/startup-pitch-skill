# Corpus index: cwd

Generated 2026-11-10 22:37 from inventory.json. 15 files in inventory, 13 extracted, 2 confidential and excluded.

Rows are ordered by likely importance: overview and notes first, data second, team and brand, then legal, HR and anything confidential last. Read the index, then open only the corpus files you need.

| # | path | type | size | chars | confidentiality | staleness | corpus file |
|---|---|---|---|---|---|---|---|
| 1 | docs/board-update-2026-Q3.md | markdown | 3287 | 3272 | normal; contains deal terms (pre-money): keep out of investor outputs |  | `docs__board-update-2026-Q3.md.md` |
| 2 | docs/clinical-outcomes-whitepaper.md | markdown | 2478 | 2478 | normal |  | `docs__clinical-outcomes-whitepaper.md.md` |
| 3 | docs/competitive-landscape.md | markdown | 2364 | 2364 | normal |  | `docs__competitive-landscape.md.md` |
| 4 | docs/market-sizing-2026.md | markdown | 2727 | 2705 | normal |  | `docs__market-sizing-2026.md.md` |
| 5 | notes/founder-perspective.md | markdown | 3259 | 3256 | normal; contains deal terms (pre-money, salary): keep out of investor outputs |  | `notes__founder-perspective.md.md` |
| 6 | docs/board-update-2026-Q2-draft.md | markdown | 498 | 495 | normal | dated 2026-06 in name, newer sibling dated 2026-09; draft while a non-draft sibling exists (superseded by docs/board-update-2026-Q3.md) | `docs__board-update-2026-Q2-draft.md.md` |
| 7 | data/cohort-retention.csv | csv | 674 | 1655 | normal |  | `data__cohort-retention.csv.md` |
| 8 | data/kpis-weekly.csv | csv | 1656 | 2738 | normal |  | `data__kpis-weekly.csv.md` |
| 9 | data/unit-economics.xlsx | xlsx | 6110 | 1871 | normal; mentions pay (salary): keep individual pay out of investor outputs |  | `data__unit-economics.xlsx.md` |
| 10 | assets/kestrel-brand.md | markdown | 1216 | 1216 | normal |  | `assets__kestrel-brand.md.md` |
| 11 | team/team.md | markdown | 2352 | 2351 | normal |  | `team__team.md.md` |
| 12 | notes/investor-feedback-from-seed.md | markdown | 2085 | 2081 | sensitive |  | `notes__investor-feedback-from-seed.md.md` |
| 13 | deck/kestrel-seed-deck-2024.pdf | pdf | 77134 | 4148 | sensitive | dated 2024 in name; newest dated material in the folder is 2026-09 | `deck__kestrel-seed-deck-2024.pdf.md` |
| 14 | hr/salaries.xlsx | xlsx | 6514 | 0 | confidential |  | excluded |
| 15 | legal/round-terms-draft.md | markdown | 1604 | 0 | confidential |  | excluded |

## Confidential files (not extracted)

- `hr/salaries.xlsx`: excluded: confidential (salaries, hr/ folder). Use --include-confidential to extract; never put its content in the deck.
- `legal/round-terms-draft.md`: excluded: confidential (legal/ folder, round terms). Use --include-confidential to extract; never put its content in the deck.

## Normal files that contain deal or pay terms

Extracted and usable, but the passages with these terms stay out of every investor output.

- `docs/board-update-2026-Q3.md`: contains deal terms (pre-money): keep out of investor outputs
- `notes/founder-perspective.md`: contains deal terms (pre-money, salary): keep out of investor outputs
- `data/unit-economics.xlsx`: mentions pay (salary): keep individual pay out of investor outputs

## Extraction methods used

- csv: stdlib csv
- markdown: read as is
- pdf: pdftotext (poppler)
- xlsx: stdlib zipfile + xml
