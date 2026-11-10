#!/usr/bin/env python3
"""pitch.py: one entry point for the startup-pitch skill's scripts.

Run it from the startup's folder (or pass the folder as the last argument):

  python3 pitch.py setup               install the deck dependencies inside this skill folder
  python3 pitch.py intake [FOLDER]     inventory + extract  -> pitch/intake/
  python3 pitch.py check [FOLDER]      verify pitch/facts.yaml (and the deck, if one exists)
  python3 pitch.py deck [FOLDER]       build deck.html + deck.pptx, print deck.pdf, screenshot QA,
                                       then trace every deck number back to the ledger
  python3 pitch.py comparables --sector saas --round seed    three real decks to study
  python3 pitch.py status [FOLDER]     what exists in pitch/, what is still open
  python3 pitch.py open [FOLDER]       open the pitch/ folder
  python3 pitch.py doctor              what is installed, what each missing piece unlocks

Only the standard library is used here. Nothing is installed outside this skill's
scripts/ folder: node packages go to scripts/node_modules, optional Python packages
go to scripts/.venv.
"""
from __future__ import annotations

import argparse
import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
SKILL = SCRIPTS.parent
IS_WIN = platform.system() == "Windows"


# ---------------------------------------------------------------- helpers

def _stdout_closed() -> None:
    """The reader went away (for example `pitch.py deck | head`). Keep working, stop printing."""
    try:
        os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
    except (OSError, ValueError):
        sys.stdout = open(os.devnull, "w")


def say(msg: str = "") -> None:
    try:
        print(msg, flush=True)
    except BrokenPipeError:
        _stdout_closed()


def run(cmd: list[str], cwd: Path | None = None, env: dict | None = None, capture: bool = False):
    """Run a command, streaming output unless capture is set. Returns (code, text)."""
    try:
        if capture:
            p = subprocess.run(cmd, cwd=cwd, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            return p.returncode, p.stdout or ""
        p = subprocess.Popen(cmd, cwd=cwd, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        lines = []
        assert p.stdout is not None
        for line in p.stdout:
            try:
                sys.stdout.write(line)
                sys.stdout.flush()
            except BrokenPipeError:
                _stdout_closed()
            lines.append(line)
        p.wait()
        return p.returncode, "".join(lines)
    except FileNotFoundError:
        return 127, f"command not found: {cmd[0]}"


def venv_python() -> Path | None:
    cand = SCRIPTS / ".venv" / ("Scripts/python.exe" if IS_WIN else "bin/python")
    return cand if cand.exists() else None


def has_node_module(name: str) -> bool:
    return (SCRIPTS / "node_modules" / name / "package.json").exists()


def find_browser() -> str | None:
    env = os.environ.get("CHROME_PATH")
    if env and Path(env).exists():
        return env
    candidates = []
    if platform.system() == "Darwin":
        for app in ("Google Chrome", "Chromium", "Microsoft Edge", "Brave Browser"):
            candidates.append(f"/Applications/{app}.app/Contents/MacOS/{app}")
            candidates.append(str(Path.home() / f"Applications/{app}.app/Contents/MacOS/{app}"))
    elif IS_WIN:
        for base in (os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)"), os.environ.get("LOCALAPPDATA")):
            if base:
                candidates.append(str(Path(base) / "Google/Chrome/Application/chrome.exe"))
                candidates.append(str(Path(base) / "Microsoft/Edge/Application/msedge.exe"))
    for name in ("google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "brave-browser"):
        w = shutil.which(name)
        if w:
            candidates.append(w)
    for c in candidates:
        if c and Path(c).exists():
            return c
    return None


def folder_arg(value: str | None) -> Path:
    root = Path(value or ".").expanduser().resolve()
    if not root.is_dir():
        say(f"Not a folder: {root}")
        sys.exit(2)
    return root


def pdf_page_count(pdf: Path) -> int:
    data = pdf.read_bytes()
    counts = [int(x) for x in re.findall(rb"/Count\s+(\d+)", data)]
    return max(counts) if counts else len(re.findall(rb"/Type\s*/Page\b", data))


# ---------------------------------------------------------------- commands

def cmd_setup(args) -> int:
    say("Setting up the deck pipeline inside this skill folder (nothing is installed system-wide).")
    ok = True
    npm = shutil.which("npm")
    if not shutil.which("node") or not npm:
        say("  node/npm not found. Install Node 18 or newer (https://nodejs.org), then run setup again.")
        say("  Without it you still get the narrative, the Q&A and the HTML-free deliverables.")
        ok = False
    else:
        say("  npm install (pptxgenjs for PowerPoint, playwright-core for screenshots; about 21 MB) ...")
        code, out = run([npm, "install", "--no-audit", "--no-fund", "--loglevel=error"], cwd=SCRIPTS, capture=True)
        say("  node packages: " + ("ok" if code == 0 else "FAILED\n" + out[-600:]))
        ok = ok and code == 0
    vpy = venv_python()
    if not vpy:
        uv = shutil.which("uv")
        code = run([uv, "venv", str(SCRIPTS / ".venv"), "-q"], capture=True)[0] if uv else \
            run([sys.executable, "-m", "venv", str(SCRIPTS / ".venv")], capture=True)[0]
        vpy = venv_python() if code == 0 else None
    if vpy:
        uv = shutil.which("uv")
        pkgs = ["lxml", "defusedxml", "pypdf"]
        cmd = [uv, "pip", "install", "-q", "--python", str(vpy), *pkgs] if uv else [str(vpy), "-m", "pip", "install", "-q", *pkgs]
        code, out = run(cmd, capture=True)
        say("  python packages (pypdf for reading PDFs; lxml, defusedxml for the optional external PPTX validator): " + ("ok" if code == 0 else "skipped\n" + out[-400:]))
    else:
        say("  python venv: skipped (nothing depends on it; the built-in PPTX check needs only python3)")
    say("  browser for PDF export: " + (find_browser() or "not found (install Chrome or Edge, or set CHROME_PATH)"))
    say("Setup " + ("complete." if ok else "incomplete, see above."))
    return 0 if ok else 1


def cmd_intake(args) -> int:
    root = folder_arg(args.folder)
    inv = root / "pitch" / "intake" / "inventory.json"
    corpus = root / "pitch" / "intake" / "corpus"
    code, _ = run([sys.executable, str(SCRIPTS / "inventory.py"), str(root), "--out", str(inv)])
    if code != 0:
        return code
    code, _ = run([sys.executable, str(SCRIPTS / "extract.py"), str(root), "--inventory", str(inv), "--out", str(corpus)])
    if code == 0:
        say("")
        say(f"Next: read {corpus.relative_to(root)}/INDEX.md, then the files it lists, in order.")
    return code


def cmd_check(args) -> int:
    if args.explain:
        return run([sys.executable, str(SCRIPTS / "ledger_check.py"), "--explain"])[0]
    root = folder_arg(args.folder)
    ledger = root / "pitch" / "facts.yaml"
    if not ledger.exists():
        say("pitch/facts.yaml does not exist yet. Write the ledger first (template: scripts/facts_template.yaml).")
        return 2
    cmd = [sys.executable, str(SCRIPTS / "ledger_check.py"), str(ledger), "--root", str(root)]
    corpus = root / "pitch" / "intake" / "corpus"
    if corpus.is_dir():
        cmd += ["--corpus", str(corpus)]
    deck = root / "pitch" / "deck" / "deck.json"
    if deck.exists() and not args.no_deck:
        cmd += ["--deck", str(deck)]
    return run(cmd)[0]


def cmd_deck(args) -> int:
    root = folder_arg(args.folder)
    deck_json = root / "pitch" / "deck" / "deck.json"
    if not deck_json.exists():
        say("pitch/deck/deck.json does not exist yet. Write it first (fields: references/deck-structure.md).")
        return 2
    node = shutil.which("node")
    if not node:
        say("node is not installed, so the deck cannot be built. Install Node 18+ (https://nodejs.org) and run:")
        say(f"  python3 {Path(__file__).name} setup")
        return 2
    if not has_node_module("pptxgenjs"):
        say("First deck build on this machine: installing node packages into the skill folder ...")
        npm = shutil.which("npm")
        code = run([npm, "install", "--no-audit", "--no-fund", "--loglevel=error"], cwd=SCRIPTS, capture=True)[0] if npm else 1
        if code != 0:
            say("  npm install failed; building HTML only. Run `pitch.py setup` when online to add PowerPoint export.")
    env = dict(os.environ)
    vpy = venv_python()
    if vpy and "PITCH_PYTHON" not in env:
        env["PITCH_PYTHON"] = str(vpy)

    results: dict[str, str] = {}
    build = [node, str(SCRIPTS / "build_deck.js"), str(deck_json)]
    if not args.no_qa:
        build.append("--check")
    say("== Build")
    code, out = run(build, env=env)
    html = deck_json.with_name("deck.html")
    pptx = deck_json.with_name("deck.pptx")
    results["deck.html"] = "ok" if html.exists() and code in (0, 1) else "FAILED"
    if pptx.exists():
        chk = re.search(r"pptx_check \(exit (\d+)\)", out)
        ext = re.search(r"validate\.py \(exit (\d+)\)", out)
        if (chk and chk.group(1) != "0") or (ext and ext.group(1) != "0"):
            results["deck.pptx"] = "CHECK FAILED (see the pptx_check or validate.py lines above)"
        elif chk and ext:
            results["deck.pptx"] = "ok, structure checked and validated"
        elif chk:
            results["deck.pptx"] = "ok, structure checked"
        else:
            results["deck.pptx"] = "ok, not checked (python3 not found)"
    else:
        results["deck.pptx"] = "not written"
    m = re.search(r"QA: (\d+) screenshots.*?(\d+) issues", out)
    if m:
        results["QA"] = f"{m.group(2)} issues, {m.group(1)} screenshots in pitch/deck/qa/"
    elif "--check skipped" in out:
        results["QA"] = "skipped (playwright-core or a browser is missing)"
    cap = re.search(r"capacity: (\d+) warning", out)
    results["capacity"] = f"{cap.group(1)} slides over their layout budget (lines above say what fits)" if cap else "all slides within budget"
    src = re.search(r"sources appendix: (.+)", out)
    if src:
        results["sources"] = src.group(1).strip()
    slots = re.search(r"(\d+) placeholders? marked", out)
    if slots:
        results["open slots"] = f"{slots.group(1)} x [needs number] or [needs detail] still on slides"

    fail = results["deck.html"] == "FAILED" or "FAILED" in results["deck.pptx"]
    if html.exists() and not args.no_pdf:
        say("== PDF")
        pdf = deck_json.with_name("deck.pdf")
        browser = find_browser()
        done = False
        if browser:
            url = html.as_uri() + "?print"
            c, _ = run([browser, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--no-first-run",
                        "--no-default-browser-check", "--virtual-time-budget=8000",
                        f"--print-to-pdf={pdf}", url], capture=True)
            done = c == 0 and pdf.exists()
        if not done and shutil.which("bash") and (SCRIPTS / "export_pdf.sh").exists():
            done = run(["bash", str(SCRIPTS / "export_pdf.sh"), str(html), str(pdf)], capture=True)[0] == 0 and pdf.exists()
        if done:
            pages = pdf_page_count(pdf)
            sc = re.search(r'name="slide-count" content="(\d+)"', html.read_text(encoding="utf-8", errors="ignore"))
            slides = int(sc.group(1)) if sc else pages
            results["deck.pdf"] = f"ok, {pages} pages" if pages == slides else f"PAGE MISMATCH: {pages} pages for {slides} slides"
            fail = fail or pages != slides
            say(f"  wrote {pdf.name}: {pages} pages for {slides} slides")
        else:
            results["deck.pdf"] = "not written (no Chrome or Edge found; open deck.html and print to PDF, or set CHROME_PATH)"
            say("  " + results["deck.pdf"])

    ledger = root / "pitch" / "facts.yaml"
    if ledger.exists():
        say("== Ledger trace")
        c, lout = run([sys.executable, str(SCRIPTS / "ledger_check.py"), str(ledger), "--root", str(root), "--deck", str(deck_json)], capture=True)
        v = re.search(r"## Verdict: (.+)", lout)
        results["ledger"] = v.group(1).strip() if v else f"exit {c}"
        section = re.search(r"## \(g\).*?(?=\n## )", lout, re.S)
        if section and ("FAIL" in section.group(0).splitlines()[0] or "WARN" in section.group(0).splitlines()[0]):
            say(section.group(0).strip())
        fail = fail or c != 0
    else:
        results["ledger"] = "no pitch/facts.yaml, deck numbers are untraced"

    qa_issues = re.match(r"(\d+) issues", results.get("QA", ""))
    say("")
    say("== Deck summary")
    for k in ("deck.html", "deck.pptx", "deck.pdf", "capacity", "QA", "sources", "open slots", "ledger"):
        if k in results:
            say(f"  {k:<11} {results[k]}")
    if (qa_issues and int(qa_issues.group(1)) > 0) or cap:
        say("  Fix the capacity and QA lines in deck.json (cut words, do not shrink type) and run this command again.")
        fail = True
    say("  Present: open pitch/deck/deck.html (arrow keys, n for notes)")
    return 1 if fail else 0


def cmd_comparables(args) -> int:
    cmd = [sys.executable, str(SCRIPTS / "library.py"), "--comparables"]
    if args.sector:
        cmd += ["--sector", args.sector]
    if args.round:
        cmd += ["--round", args.round]
    return run(cmd)[0]


def cmd_status(args) -> int:
    root = folder_arg(args.folder)
    pitch = root / "pitch"
    if not pitch.is_dir():
        say("No pitch/ folder yet. Start with: pitch.py intake")
        return 0
    order = ["START-HERE.md", "gaps.md", "facts.yaml", "narrative.md", "investor-qa.md",
             "deck/deck.json", "deck/deck.html", "deck/deck.pdf", "deck/deck.pptx", "run-log.md"]
    for rel in order:
        p = pitch / rel
        say(f"  {'ok     ' if p.exists() else 'missing'}  pitch/{rel}")
    ledger = pitch / "facts.yaml"
    if ledger.exists():
        text = ledger.read_text(encoding="utf-8", errors="ignore")
        n_entries = len(re.findall(r"^\s*- id:", text, re.M))
        n_conf = len(re.findall(r"status:\s*conflicting", text))
        n_assume = len(re.findall(r"kind:\s*assumption", text))
        n_proj = len(re.findall(r"kind:\s*projection", text))
        say(f"  ledger: {n_entries} entries, {n_conf} conflicting, {n_assume} assumptions, {n_proj} projections")
    slots = 0
    for p in list(pitch.glob("*.md")) + [pitch / "deck" / "deck.json"]:
        if p.exists() and p.name != "gaps.md":
            t = p.read_text(encoding="utf-8", errors="ignore")
            slots += t.count("[needs number]") + t.count("[needs detail]")
    say(f"  [needs number] and [needs detail] occurrences across outputs (one gap can appear in several files): {slots}")
    return 0


def cmd_open(args) -> int:
    root = folder_arg(args.folder)
    target = root / "pitch"
    if not target.exists():
        say("No pitch/ folder yet.")
        return 1
    opener = ["open"] if platform.system() == "Darwin" else (["explorer"] if IS_WIN else ["xdg-open"])
    code = run(opener + [str(target)], capture=True)[0]
    say(f"Opened {target}" if code == 0 or IS_WIN else f"Could not open a file browser; the folder is {target}")
    return 0


def cmd_doctor(args) -> int:
    def row(label, value, hint=""):
        say(f"  {'found  ' if value else 'MISSING'}  {label:<34} {value or hint}")
    say("startup-pitch environment")
    row("python3 (intake, ledger, Q&A)", sys.version.split()[0])
    row("node (deck build)", shutil.which("node"), "install Node 18+ from https://nodejs.org")
    row("pptxgenjs (PowerPoint export)", has_node_module("pptxgenjs") and "scripts/node_modules", "run: pitch.py setup")
    row("playwright-core (screenshots, QA)", has_node_module("playwright-core") and "scripts/node_modules", "run: pitch.py setup")
    row("Chrome or Edge (PDF export)", find_browser(), "install Chrome or Edge, or set CHROME_PATH")
    row("optional python packages (.venv)", venv_python() and "scripts/.venv", "optional, run: pitch.py setup")
    row("pdftotext (reading founder PDFs)", shutil.which("pdftotext"), "optional: brew install poppler, or setup installs pypdf")
    row("LibreOffice (PPTX preview)", shutil.which("soffice"), "optional")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(prog="pitch.py", description="One entry point for the startup-pitch skill scripts.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("setup", help="install deck dependencies inside the skill folder").set_defaults(fn=cmd_setup)
    p = sub.add_parser("intake", help="inventory + extract into pitch/intake/")
    p.add_argument("folder", nargs="?")
    p.set_defaults(fn=cmd_intake)
    p = sub.add_parser("check", help="verify pitch/facts.yaml (and the deck, if present)")
    p.add_argument("folder", nargs="?")
    p.add_argument("--no-deck", action="store_true", help="skip tracing deck numbers")
    p.add_argument("--explain", action="store_true", help="print how the checker matches ids, units and deck figures")
    p.set_defaults(fn=cmd_check)
    p = sub.add_parser("deck", help="build html + pptx, print pdf, QA screenshots, trace numbers")
    p.add_argument("folder", nargs="?")
    p.add_argument("--no-pdf", action="store_true")
    p.add_argument("--no-qa", action="store_true")
    p.set_defaults(fn=cmd_deck)
    p = sub.add_parser("comparables", help="three real decks to study for structure")
    p.add_argument("--sector")
    p.add_argument("--round")
    p.set_defaults(fn=cmd_comparables)
    p = sub.add_parser("status", help="what exists in pitch/ and what is open")
    p.add_argument("folder", nargs="?")
    p.set_defaults(fn=cmd_status)
    p = sub.add_parser("open", help="open the pitch/ folder")
    p.add_argument("folder", nargs="?")
    p.set_defaults(fn=cmd_open)
    sub.add_parser("doctor", help="what is installed and what is missing").set_defaults(fn=cmd_doctor)
    args = ap.parse_args()
    return args.fn(args)


if __name__ == "__main__":
    try:
        code = main()
        sys.stdout.flush()
    except BrokenPipeError:
        _stdout_closed()
        code = 0
    sys.exit(code)
