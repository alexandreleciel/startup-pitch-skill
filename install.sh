#!/usr/bin/env bash
# Install the startup-pitch skill for Claude Code (~/.claude/skills) and for Codex, Cursor,
# Gemini CLI, Copilot CLI, OpenCode and Amp (~/.agents/skills), then set up the deck pipeline.
#
#   ./install.sh          symlink the skill (a later `git pull` updates it)
#   ./install.sh copy     copy the skill instead (no link back to this checkout)
#
# Nothing is installed system-wide: node packages go to skills/startup-pitch/scripts/node_modules
# and the Python packages for PPTX validation go to skills/startup-pitch/scripts/.venv.
set -eu
REPO="$(cd "$(dirname "$0")" && pwd)"
SRC="$REPO/skills/startup-pitch"
MODE="${1:-link}"

for dest in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
  mkdir -p "$dest"
  target="$dest/startup-pitch"
  if [ -e "$target" ] || [ -L "$target" ]; then
    echo "already present: $target (left as is; remove it first to reinstall)"
    continue
  fi
  if [ "$MODE" = "copy" ]; then cp -R "$SRC" "$target"; else ln -s "$SRC" "$target"; fi
  echo "installed: $target"
done

echo
python3 "$SRC/scripts/pitch.py" setup || echo "Setup was incomplete. The narrative and Q&A work without it; see the messages above for the deck."
echo
python3 "$SRC/scripts/pitch.py" doctor
echo
echo "Done. Open Claude Code or Codex inside your startup's folder and say:"
echo "  Build my pitch from this folder."
