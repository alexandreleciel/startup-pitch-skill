#!/usr/bin/env bash
# check_env.sh: what this machine can do for the startup-pitch pipeline, tier by tier.
# Prints found / missing per item with the exact install command. Always exits 0.
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

found=()
missing=()
row() { printf '  %-10s %-34s %s\n' "$1" "$2" "$3"; }
ok()  { row "found" "$1" "$2"; found+=("$1"); }
no()  { row "MISSING" "$1" "$2"; missing+=("$1|$3"); }

chrome_path() {
  [ -n "${CHROME_PATH:-}" ] && [ -x "$CHROME_PATH" ] && { echo "$CHROME_PATH"; return; }
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" "/Applications/Chromium.app/Contents/MacOS/Chromium"; do
    [ -x "$c" ] && { echo "$c"; return; }
  done
  for c in google-chrome google-chrome-stable chromium chromium-browser; do command -v "$c" 2>/dev/null && return; done
  return 1
}
edge_path() {
  [ -x "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" ] && { echo "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; return; }
  for c in microsoft-edge microsoft-edge-stable; do command -v "$c" 2>/dev/null && return; done
  return 1
}
node_has() { # node_has <module>: resolvable from scripts/ or cwd
  NODE_PATH="$SCRIPT_DIR/node_modules:$(pwd)/node_modules:${NODE_PATH:-}" node -e "require.resolve('$1')" >/dev/null 2>&1
}
py_has() { python3 -c "import $1" >/dev/null 2>&1; }

echo "startup-pitch environment check"
echo
echo "Tier 0: present the deck (any browser opens deck.html)"
if p="$(chrome_path)"; then ok "Chrome" "$p"; elif p="$(edge_path)"; then ok "Edge" "$p"; else no "browser" "no Chrome or Edge found" "install Google Chrome: https://www.google.com/chrome/"; fi

echo
echo "Tier 1: vector PDF from deck.html (scripts/export_pdf.sh)"
if p="$(chrome_path)"; then ok "Chrome" "headless print-to-pdf"; else no "Chrome" "needed for headless print" "install Google Chrome, or set CHROME_PATH"; fi
if p="$(edge_path)"; then ok "Edge" "$p"; else row "optional" "Edge" "alternative to Chrome"; fi

echo
echo "Tier 2: native PPTX (scripts/build_deck.js)"
if command -v node >/dev/null 2>&1; then
  v="$(node --version)"
  case "$v" in v1[0-7].*|v[0-9].*) no "node" "$v is too old" "install Node 18 or newer: https://nodejs.org" ;; *) ok "node" "$v" ;; esac
else
  no "node" "not found" "install Node 18 or newer: https://nodejs.org"
fi
if node_has pptxgenjs; then ok "pptxgenjs" "resolvable from scripts/"; else no "pptxgenjs" "not installed" "npm install --prefix \"$SCRIPT_DIR\"   (or: cd scripts && npm install)"; fi

echo
echo "Tier 3: PPTX check (scripts/pptx_check.py, standard library only)"
if command -v python3 >/dev/null 2>&1; then ok "python3" "$(python3 --version 2>&1)"; else no "python3" "not found: deck.pptx is written but not checked" "install Python 3: https://www.python.org/downloads/"; fi
# Anthropic's OOXML validator is not part of this skill. When their pptx skill is installed it is
# found and used as a second check; it needs lxml and defusedxml.
EXT_VALIDATOR=""
for c in "${PITCH_PPTX_VALIDATOR:-}" "$HOME/.claude/skills/pptx/scripts/office/validate.py" "$HOME"/.claude/skills/synced/*/pptx/scripts/office/validate.py "$HOME/.agents/skills/pptx/scripts/office/validate.py"; do
  [ -n "$c" ] && [ -f "$c" ] && { EXT_VALIDATOR="$c"; break; }
done
if [ -n "$EXT_VALIDATOR" ]; then
  if py_has lxml && py_has defusedxml; then ok "external validator" "Anthropic pptx skill found; lxml, defusedxml present"; else row "optional" "lxml, defusedxml" "only for the external validator: uv pip install lxml defusedxml"; fi
else
  row "optional" "external validator" "none found (the built-in check is the default)"
fi

echo
echo "Tier 4: PPTX preview and PDF fallback (LibreOffice + poppler)"
if command -v soffice >/dev/null 2>&1; then ok "soffice" "$(soffice --version 2>/dev/null | head -1 | cut -c1-40)"; else no "soffice" "LibreOffice not found" "brew install --cask libreoffice   (linux: apt install libreoffice-impress)"; fi
if command -v pdftoppm >/dev/null 2>&1 && command -v pdfinfo >/dev/null 2>&1; then ok "poppler" "pdftoppm, pdfinfo"; else no "poppler" "pdftoppm / pdfinfo not found" "brew install poppler   (linux: apt install poppler-utils)"; fi

echo
echo "Tier 5: QA screenshots and SVG rasterising (build_deck.js --check)"
if node_has playwright-core; then ok "playwright-core" "uses the installed Chrome"; else no "playwright-core" "not installed (optional)" "npm install --prefix \"$SCRIPT_DIR\" playwright-core@1.65.0"; fi

echo
echo "Intake scripts (all optional, only for reading founder files)"
for pkg in pypdf openpyxl docx pptx; do
  case $pkg in docx) pipname=python-docx ;; pptx) pipname=python-pptx ;; *) pipname=$pkg ;; esac
  if py_has "$pkg"; then ok "$pipname" "python package"; else no "$pipname" "not installed (optional)" "uv pip install $pipname   (or: pip3 install $pipname)"; fi
done

echo
if [ ${#missing[@]} -eq 0 ]; then
  echo "Everything found. Full pipeline available."
else
  echo "Install commands for missing items:"
  for m in "${missing[@]}"; do
    printf '  %-20s %s\n' "${m%%|*}" "${m#*|}"
  done
fi
exit 0
