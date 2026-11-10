#!/usr/bin/env bash
# Live Codex CLI route test: bounded to Phases 1 to 3 of the skill.
CODEX="/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex"
W="${WORKSPACE:-$PWD}"   # the workspace copy of examples/fixtures/hearthbox used at test time
cd "$W/hearthbox" || exit 1
START=$(date +%s)
"$CODEX" exec --skip-git-repo-check -s workspace-write -C "$W/hearthbox" \
  "Use the \$startup-pitch skill on this folder. Run only its Phase 1 (intake), Phase 2 (fact ledger) and Phase 3 (gaps and questions), then stop; do not write the narrative or the deck. The founder cannot answer questions in this run. Report which skill files you read, the scripts you ran with their exit codes, the ledger_check.py verdict, and the first five questions in gaps.md." \
  > "$W/codex-output.txt" 2> "$W/codex-stderr.txt"
echo "exit=$? seconds=$(( $(date +%s) - START ))" >> "$W/codex-output.txt"
