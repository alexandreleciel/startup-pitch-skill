# Install

## The short version

```bash
git clone https://github.com/alexandreleciel/startup-pitch-skill.git && cd startup-pitch-skill && ./install.sh
```

That links the skill into `~/.claude/skills` (Claude Code) and `~/.agents/skills` (Codex,
Cursor, Gemini CLI, Copilot CLI, OpenCode, Amp), installs the deck dependencies inside the
skill folder, and prints what is available. Then open your agent in your startup's folder
and say "Help me with my investor pitch. Everything is in this folder."

`./install.sh copy` copies instead of linking. Nothing is installed system-wide.

## What works where

The skill is one folder: `skills/startup-pitch/`. What matters is that the agent can **read
your startup folder** and **run scripts**. Two routes do both without an upload step and
were verified on a Mac on 2026-11-10: Claude Code and Codex CLI. Everything else is listed
with its status.

Status words used below: **verified** means we ran it; **documented** means the vendor's docs
describe it and we did not run it; **not supported** means the vendor's docs rule it out.

## Route A: Claude Code (terminal, VS Code/JetBrains, or the Claude Desktop "Code" tab)

Verified on Claude Code 2.1.318.

Option 1, plugin marketplace (keeps the skill updated):

```bash
claude plugin marketplace add alexandreleciel/startup-pitch-skill
```

```bash
claude plugin install startup-pitch@startup-pitch-skill
```

Inside a session the same works as `/plugin marketplace add alexandreleciel/startup-pitch-skill` and
`/plugin install startup-pitch@startup-pitch-skill`. The skill is then invoked as
`/startup-pitch:startup-pitch` or triggers on its own when you ask for a pitch.

Option 2, copy the folder (personal skill, all projects):

```bash
git clone https://github.com/alexandreleciel/startup-pitch-skill.git
```

```bash
cp -R startup-pitch-skill/skills/startup-pitch ~/.claude/skills/startup-pitch
```

Option 3, project skill (only this startup, travels with the repo):

```bash
cp -R startup-pitch-skill/skills/startup-pitch ./.claude/skills/startup-pitch
```

Then open Claude Code inside your startup folder and type `/startup-pitch`, or simply ask
"build my seed pitch from this folder".

Claude Desktop "Code" tab, Local environment: pick your startup folder with the folder
picker; personal skills from `~/.claude/skills/` load automatically (documented, not run here).

Cloud sessions (claude.ai/code): commit the skill to `.claude/skills/` in the repository.
Local plugins and `~/.claude/skills` are not loaded in cloud (documented).

## Route B: Codex CLI, Codex IDE extension, Codex in the ChatGPT desktop app

Verified on Codex CLI 0.167 (the binary bundled with the ChatGPT macOS app). Codex discovers
skills from `~/.agents/skills/` (personal) and `<repo>/.agents/skills/` (project).

```bash
git clone https://github.com/alexandreleciel/startup-pitch-skill.git
```

```bash
mkdir -p ~/.agents/skills && cp -R startup-pitch-skill/skills/startup-pitch ~/.agents/skills/startup-pitch
```

Open Codex in your startup folder and type `$startup-pitch` (or `/skills` to see it listed),
or just ask for the pitch. For the deck export, Codex must be allowed to run local commands:
the default `workspace-write` sandbox runs scripts in the folder; approve network access only
if you want Google Fonts fetched at build time (the deck renders with fallback fonts offline).

The legacy `~/.codex/skills/` location still loads (verified) but is no longer documented.

ChatGPT web and mobile chat cannot read a local folder and cannot run standalone skills
(not supported). Codex cloud works on a connected Git repository: commit the skill to
`.agents/skills/` in that repo (documented).

## Route C: claude.ai web, Claude Desktop Cowork, Claude in Chrome

Upload the skill as a ZIP: Customize > Skills > + > Create skill > Upload a skill. Requires
"Code execution and file creation" enabled in Settings > Capabilities. The ZIP's top-level
folder must be named `startup-pitch` and contain `SKILL.md`.

```bash
cd startup-pitch-skill/skills && zip -r startup-pitch.zip startup-pitch -x "*/node_modules/*" "*/evals/*"
```

Limits (documented, not run here): web chat cannot read a local folder; upload your files or
use a Project. Cowork on the desktop app reads folders you connect, but scripts run in
Claude's cloud container, not on your machine. The deck HTML and PDF still work there; the
PowerPoint file still gets the built-in structural check, which needs only Python.

## Route D: other agents that read SKILL.md (documented, not run here)

| Agent | Where the folder goes |
|---|---|
| Cursor | `.cursor/skills/`, `~/.cursor/skills/`, also reads `.agents/skills/` and `.claude/skills/` |
| Gemini CLI | `~/.gemini/skills/` or `~/.agents/skills/`; `gemini skills link .` |
| GitHub Copilot CLI | `.github/skills`, `.claude/skills`, `.agents/skills`; `~/.copilot/skills` |
| OpenCode | `.opencode/skills`, `.claude/skills`, `.agents/skills` |
| Amp | `~/.agents/skills/`, project `.agents/skills/` |

Shipping tip for a startup repo: put the skill at `.agents/skills/startup-pitch` and add a
symlink from `.claude/skills/startup-pitch`; every agent above finds it.

## Dependencies

The start page, narrative and Q&A need only Python 3.10+ (standard library). The deck needs
Node 18+ and Chrome or Edge. One command sets up everything else inside the skill folder
(node packages in `scripts/node_modules`, a small optional Python environment in
`scripts/.venv`); `install.sh` runs it for you, and the first deck build runs the
node part automatically:

```bash
python3 ~/.claude/skills/startup-pitch/scripts/pitch.py setup
```

```bash
python3 ~/.claude/skills/startup-pitch/scripts/pitch.py doctor
```

| You want | You need | If missing |
|---|---|---|
| Start page, narrative, Q&A | python3 | install Python 3.10+ |
| deck.html | node 18+ | install Node from nodejs.org |
| deck.pptx | pptxgenjs | `pitch.py setup` |
| deck.pdf | Chrome or Edge | install one, or set `CHROME_PATH`; otherwise print from the browser |
| Slide screenshots and overflow check | playwright-core (uses your installed Chrome) | `pitch.py setup` |
| PowerPoint structural check | python3 (built in, always runs) | nothing |
| Deeper PowerPoint validation | Anthropic's pptx skill installed, plus lxml and defusedxml | optional; used automatically when present, `pitch.py setup` adds the two packages |
| Reading PDFs in your folder | poppler's `pdftotext`, or pypdf | `pitch.py setup` installs pypdf |
| PowerPoint preview as PDF | LibreOffice | optional |

Word, Excel and PowerPoint files in your folder are read with built-in fallbacks; no extra
packages are required.

## Verify the install

```bash
python3 ~/.claude/skills/startup-pitch/scripts/pitch.py doctor
```

```bash
cp -R examples/sample-output/hearthbox /tmp/pitch-test && cd /tmp/pitch-test && python3 ~/.claude/skills/startup-pitch/scripts/pitch.py deck
```

The second command rebuilds the sample deck: HTML, PowerPoint, PDF, screenshots and the
ledger trace, ending with a summary. Open `pitch/deck/deck.html` and press the arrow keys.
