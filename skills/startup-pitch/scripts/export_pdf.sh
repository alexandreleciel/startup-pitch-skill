#!/usr/bin/env bash
# export_pdf.sh: print deck.html to a one-page-per-slide PDF.
#
#   scripts/export_pdf.sh pitch/deck/deck.html [out.pdf]
#
# Renderer detection, in order:
#   1. Google Chrome   (macOS app bundle, linux google-chrome / chromium / chromium-browser,
#                       or CHROME_PATH; on Windows run this from WSL with CHROME_PATH set to
#                       /mnt/c/Program Files/Google/Chrome/Application/chrome.exe)
#   2. Microsoft Edge
#   3. playwright-core with the installed Chrome (channel chrome), if npm-installed
#   4. LibreOffice: soffice --headless --convert-to pdf deck.pptx  (lower fidelity, fonts substitute)
#
# The HTML carries @page { size: 1920px 1080px; margin: 0 } and one page per slide, so the
# browser print needs no extra flags beyond headless + print-to-pdf. The ?print query flag
# disables animations and the on-screen scaling; fonts are awaited through
# --virtual-time-budget (Chrome waits for document.fonts.ready inside that budget).
set -u

HTML="${1:-}"
if [ -z "$HTML" ] || [ ! -f "$HTML" ]; then
  echo "Usage: scripts/export_pdf.sh pitch/deck/deck.html [out.pdf]" >&2
  exit 1
fi
HTML_ABS="$(cd "$(dirname "$HTML")" && pwd)/$(basename "$HTML")"
OUT="${2:-${HTML_ABS%.html}.pdf}"
case "$OUT" in /*) ;; *) OUT="$(pwd)/$OUT" ;; esac
PPTX="${HTML_ABS%.html}.pptx"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ---- find a Chromium-based browser --------------------------------------------------
find_browser() {
  if [ -n "${CHROME_PATH:-}" ] && [ -x "$CHROME_PATH" ]; then echo "$CHROME_PATH"; return; fi
  local candidates=(
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  )
  local c
  for c in "${candidates[@]}"; do [ -x "$c" ] && { echo "$c"; return; }; done
  for c in google-chrome google-chrome-stable chromium chromium-browser; do
    command -v "$c" >/dev/null 2>&1 && { command -v "$c"; return; }
  done
  # Microsoft Edge
  local edge=(
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  )
  for c in "${edge[@]}"; do [ -x "$c" ] && { echo "$c"; return; }; done
  for c in microsoft-edge microsoft-edge-stable; do
    command -v "$c" >/dev/null 2>&1 && { command -v "$c"; return; }
  done
  return 1
}

# file:// URL with the print flag; spaces in the path are percent-encoded
url_for() {
  local p="$1"
  local enc
  enc="$(printf '%s' "$p" | sed 's/ /%20/g')"
  echo "file://${enc}?print"
}

print_with_browser() {
  local bin="$1"
  echo "Printing with: $bin"
  "$bin" --headless=new --disable-gpu --no-pdf-header-footer --no-first-run --no-default-browser-check \
    --hide-scrollbars --virtual-time-budget=8000 --run-all-compositor-stages-before-draw \
    --print-to-pdf="$OUT" "$(url_for "$HTML_ABS")" 2>/dev/null
  [ -s "$OUT" ]
}

print_with_playwright() {
  local pw_dir
  for pw_dir in "$SCRIPT_DIR" "$(pwd)"; do
    if [ -d "$pw_dir/node_modules/playwright-core" ]; then
      echo "Printing with playwright-core (channel chrome)"
      NODE_PATH="$pw_dir/node_modules" node - "$HTML_ABS" "$OUT" <<'EOF'
const pw = require('playwright-core');
(async () => {
  const [html, out] = process.argv.slice(2);
  let browser;
  try { browser = await pw.chromium.launch({ channel: 'chrome' }); }
  catch (e) { browser = await pw.chromium.launch({ channel: 'msedge' }); }
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + html + '?print', { waitUntil: 'load' });
  await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
  await page.waitForTimeout(300);
  await page.pdf({ path: out, width: '1920px', height: '1080px', printBackground: true, preferCSSPageSize: true });
  await browser.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
EOF
      [ -s "$OUT" ] && return 0
    fi
  done
  return 1
}

print_with_soffice() {
  command -v soffice >/dev/null 2>&1 || return 1
  [ -f "$PPTX" ] || { echo "No $PPTX next to the HTML for the LibreOffice fallback." >&2; return 1; }
  echo "Warning: no Chrome or Edge found. Converting $PPTX with LibreOffice instead (lower fidelity: PowerPoint fonts substitute, web layout is not used)."
  local tmp
  tmp="$(mktemp -d)"
  soffice --headless --convert-to pdf --outdir "$tmp" "$PPTX" >/dev/null 2>&1
  local produced="$tmp/$(basename "${PPTX%.pptx}").pdf"
  [ -s "$produced" ] && mv "$produced" "$OUT"
  rm -rf "$tmp"
  [ -s "$OUT" ]
}

ok=1
if BROWSER="$(find_browser)"; then
  print_with_browser "$BROWSER" && ok=0
fi
[ $ok -ne 0 ] && print_with_playwright && ok=0
[ $ok -ne 0 ] && print_with_soffice && ok=0
if [ $ok -ne 0 ]; then
  echo "Could not produce a PDF. Install Google Chrome (or Edge), or run: npm install --prefix scripts playwright-core, or install LibreOffice for the PPTX fallback." >&2
  exit 1
fi
echo "Wrote $OUT"

# ---- verify page count equals slide count --------------------------------------------
SLIDES="$(grep -o 'name="slide-count" content="[0-9]*"' "$HTML_ABS" | grep -o '[0-9]*$' | head -1)"
[ -z "$SLIDES" ] && SLIDES="$(grep -o '<section class="slide ' "$HTML_ABS" | wc -l | tr -d ' ')"
PAGES=""
if command -v pdfinfo >/dev/null 2>&1; then
  PAGES="$(pdfinfo "$OUT" 2>/dev/null | awk '/^Pages:/ {print $2}')"
elif command -v python3 >/dev/null 2>&1; then
  PAGES="$(python3 - "$OUT" <<'EOF'
import re, sys, zlib
data = open(sys.argv[1], 'rb').read()
try:
    from pypdf import PdfReader
    print(len(PdfReader(sys.argv[1]).pages)); sys.exit(0)
except Exception:
    pass
m = re.findall(rb'/Type\s*/Pages\b[^>]*?/Count\s+(\d+)', data)
print(max(int(x) for x in m) if m else len(re.findall(rb'/Type\s*/Page\b', data)))
EOF
)"
fi
if [ -n "$PAGES" ] && [ -n "$SLIDES" ]; then
  if [ "$PAGES" = "$SLIDES" ]; then
    echo "Page check: $PAGES pages for $SLIDES slides, OK"
  else
    echo "Page check: $PAGES pages but $SLIDES slides. A slide overflows the page or the print stylesheet was ignored; run build_deck.js --check." >&2
    exit 2
  fi
else
  echo "Page check skipped (install poppler for pdfinfo, or python3)."
fi
