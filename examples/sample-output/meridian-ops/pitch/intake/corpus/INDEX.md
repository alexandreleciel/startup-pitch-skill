# Corpus index: cwd

Generated 2026-11-10 22:37 from inventory.json. 16 files in inventory, 15 extracted, 1 confidential and excluded.

Rows are ordered by likely importance: overview and notes first, data second, team and brand, then legal, HR and anything confidential last. Read the index, then open only the corpus files you need.

| # | path | type | size | chars | confidentiality | staleness | corpus file |
|---|---|---|---|---|---|---|---|
| 1 | docs/customer-interviews-notes.md | markdown | 4105 | 4104 | normal |  | `docs__customer-interviews-notes.md.md` |
| 2 | docs/Meridian-customer-case-study-Nordfracht.pdf | pdf | 65206 | 1615 | normal |  | `docs__Meridian-customer-case-study-Nordfracht.pdf.md` |
| 3 | docs/product-vision.md | markdown | 2483 | 2483 | normal |  | `docs__product-vision.md.md` |
| 4 | notes/competitors.md | markdown | 2461 | 2461 | normal |  | `notes__competitors.md.md` |
| 5 | notes/founder-memo-nov-2026.md | markdown | 3176 | 3176 | normal |  | `notes__founder-memo-nov-2026.md.md` |
| 6 | README.md | markdown | 1597 | 1597 | normal |  | `README.md.md` |
| 7 | old/pitch-notes-2025.md | markdown | 1088 | 1088 | normal | inside a old/ folder | `old__pitch-notes-2025.md.md` |
| 8 | data/financial-model-v3.xlsx | xlsx | 8424 | 3961 | normal; mentions pay (salary): keep individual pay out of investor outputs |  | `data__financial-model-v3.xlsx.md` |
| 9 | data/metrics-2026-10.csv | csv | 742 | 1728 | normal |  | `data__metrics-2026-10.csv.md` |
| 10 | data/pipeline.csv | csv | 1489 | 2401 | normal |  | `data__pipeline.csv.md` |
| 11 | data/metrics-2026-08.csv | csv | 682 | 1636 | normal | dated 2026-08 in name, newer sibling dated 2026-10 (superseded by data/metrics-2026-10.csv) | `data__metrics-2026-08.csv.md` |
| 12 | assets/brand-colors.md | markdown | 899 | 899 | normal |  | `assets__brand-colors.md.md` |
| 13 | assets/meridian-logo.svg | image | 507 | 131 | normal |  | `assets__meridian-logo.svg.md` |
| 14 | team/founders.md | markdown | 1882 | 1882 | normal |  | `team__founders.md.md` |
| 15 | legal/cap-table-summary.md | markdown | 1259 | 1259 | sensitive |  | `legal__cap-table-summary.md.md` |
| 16 | CONFIDENTIAL-do-not-share.md | markdown | 1558 | 0 | confidential |  | excluded |

## Confidential files (not extracted)

- `CONFIDENTIAL-do-not-share.md`: excluded: confidential (file name says confidential, file name says do not share). Use --include-confidential to extract; never put its content in the deck.

## Normal files that contain deal or pay terms

Extracted and usable, but the passages with these terms stay out of every investor output.

- `data/financial-model-v3.xlsx`: mentions pay (salary): keep individual pay out of investor outputs

## Extraction methods used

- csv: stdlib csv
- image: header parse
- markdown: read as is
- pdf: pdftotext (poppler)
- xlsx: stdlib zipfile + xml
