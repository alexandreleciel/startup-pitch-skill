#!/usr/bin/env bash
# Replace the <owner> placeholder everywhere with your GitHub user or organisation.
#   tools/set-owner.sh acme
set -eu
[ $# -eq 1 ] || { echo "usage: tools/set-owner.sh <github-owner>"; exit 2; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OWNER="$1"
grep -rl '<owner>' "$ROOT" --include='*.md' --include='*.json' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.venv | grep -v "tools/set-owner.sh" | while read -r f; do
  python3 - "$f" "$OWNER" <<'PY'
import sys
p, owner = sys.argv[1], sys.argv[2]
s = open(p, encoding="utf-8").read()
open(p, "w", encoding="utf-8").write(s.replace("<owner>", owner))
print("updated", p)
PY
done
echo "Remaining placeholders: $(grep -rl '<owner>' "$ROOT" --include='*.md' --include='*.json' --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.venv | grep -vc 'tools/set-owner.sh' || true)"
