#!/usr/bin/env bash
# Codex auto-trigger test: the prompt does not name the skill.
CODEX="/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex"
W="$(cd "$(dirname "$0")" && pwd)"
START=$(date +%s)
"$CODEX" exec --skip-git-repo-check -s workspace-write -C "$W/hearthbox" \
  "Help me with my investor pitch. Everything is in this folder. When you are done, tell me which skill or instructions you followed, if any, and list the files you wrote." \
  > "$W/codex-output.txt" 2> "$W/codex-stderr.txt"
echo "exit=$? seconds=$(( $(date +%s) - START ))" >> "$W/codex-output.txt"
