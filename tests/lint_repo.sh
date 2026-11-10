#!/usr/bin/env bash
# Public-repo lint: no em dashes in text, no confidential fixture strings outside the fixtures,
# no secrets, SKILL.md under 500 lines, frontmatter present. Exit 1 on any failure.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
echo "== em dashes (not allowed in public copy; docs/evidence holds raw run transcripts and is exempt)"
if grep -rn --include='*.md' --include='*.txt' --include='*.json' --include='*.yaml' --include='*.js' --include='*.py' --include='*.sh' --include='*.css' --include='*.html' -e '—' "$ROOT" --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=.git | grep -v "examples/fixtures" | grep -v "docs/evidence/" | head -20; then
  n=$(grep -rn --include='*.md' --include='*.txt' --include='*.json' --include='*.yaml' --include='*.js' --include='*.py' --include='*.sh' --include='*.css' --include='*.html' -e '—' "$ROOT" --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=.git | grep -v "examples/fixtures" | grep -v "docs/evidence/" | wc -l | tr -d ' ')
  if [ "$n" != "0" ]; then echo "FAIL: $n em dashes"; fail=1; else echo "ok"; fi
fi
echo "== secrets"
if grep -rnE 'sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA|OPENSSH) PRIVATE' "$ROOT" --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=.git | head; then
  n=$(grep -rnE 'sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA|OPENSSH) PRIVATE' "$ROOT" --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=.git | wc -l | tr -d ' ')
  if [ "$n" != "0" ]; then echo "FAIL: possible secrets"; fail=1; else echo "ok"; fi
fi
echo "== real-person or private paths"
if grep -rnE "/Users/[A-Za-z0-9._-]+/" "$ROOT" --include='*.md' --include='*.json' --include='*.yaml' --include='*.js' --include='*.py' --include='*.sh' --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=.git | grep -v "examples/fixtures" | head; then
  n=$(grep -rnE "/Users/[A-Za-z0-9._-]+/" "$ROOT" --include='*.md' --include='*.json' --include='*.yaml' --include='*.js' --include='*.py' --include='*.sh' --exclude-dir=node_modules --exclude-dir=.venv --exclude-dir=.git | grep -v "examples/fixtures" | wc -l | tr -d ' ')
  if [ "$n" != "0" ]; then echo "FAIL: $n absolute user paths"; fail=1; else echo "ok"; fi
fi
echo "== local paths and secrets inside Office and PDF files"
if python3 - "$ROOT" <<'PY'
import os, re, sys, zipfile
root = sys.argv[1]; bad = []
pat = re.compile(rb"/Users/[A-Za-z0-9._-]+|/home/[A-Za-z0-9._-]+/|[A-Za-z]:\\\\Users\\\\|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}")
for dp, dn, fns in os.walk(root):
    dn[:] = [d for d in dn if d not in (".git", "node_modules", ".venv")]
    for fn in fns:
        p = os.path.join(dp, fn); low = fn.lower()
        try:
            if low.endswith((".pptx", ".xlsx", ".docx")):
                z = zipfile.ZipFile(p)
                for n in z.namelist():
                    m = pat.search(z.read(n))
                    if m: bad.append(f"{os.path.relpath(p, root)}!{n}: {m.group(0)[:40].decode('latin1')}")
            elif low.endswith((".pdf", ".png", ".jpg", ".jpeg", ".gif", ".svg")):
                m = pat.search(open(p, "rb").read())
                if m: bad.append(f"{os.path.relpath(p, root)}: {m.group(0)[:40].decode('latin1')}")
        except Exception as e:
            bad.append(f"{os.path.relpath(p, root)}: unreadable ({e})")
for b in bad[:20]: print(b)
sys.exit(1 if bad else 0)
PY
then echo "ok"; else echo "FAIL: local paths or secrets inside binary documents"; fail=1; fi
echo "== SKILL.md size and frontmatter"
lines=$(wc -l < "$ROOT/skills/startup-pitch/SKILL.md" | tr -d ' ')
head -1 "$ROOT/skills/startup-pitch/SKILL.md" | grep -q '^---$' || { echo "FAIL: no frontmatter"; fail=1; }
grep -q '^name: startup-pitch' "$ROOT/skills/startup-pitch/SKILL.md" || { echo "FAIL: name"; fail=1; }
[ "$lines" -le 500 ] && echo "ok ($lines lines)" || { echo "FAIL: SKILL.md has $lines lines"; fail=1; }
echo "== referenced files exist"
for f in $(grep -oE 'references/[a-z-]+\.md|scripts/[a-z_]+\.(py|js|sh)|assets/[a-zA-Z/_-]+\.(csv|json|md)' "$ROOT/skills/startup-pitch/SKILL.md" | sort -u); do
  [ -e "$ROOT/skills/startup-pitch/$f" ] || { echo "MISSING: $f"; fail=1; }
done
[ $fail -eq 0 ] && echo "LINT PASS" || echo "LINT FAIL"
exit $fail
