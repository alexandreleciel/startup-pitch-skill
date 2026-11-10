#!/usr/bin/env python3
"""pptx_check.py: structural check of a .pptx with the standard library only.

  python3 pptx_check.py deck.pptx [--slides N]

It answers one question: will PowerPoint, Keynote and LibreOffice open this file? It checks
that the archive is intact, every XML part is well formed, the slide list matches the slide
parts, every relationship points at a part that exists, every part has a content type, no local
file path has leaked into the package, and colour values are six hex digits (the defect that most often corrupts generated decks).
It does not validate against the full OOXML schemas. Exit 0 when all checks pass, 1 otherwise.
"""
from __future__ import annotations

import argparse
import posixpath
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": "http://schemas.openxmlformats.org/package/2006/relationships",
    "ct": "http://schemas.openxmlformats.org/package/2006/content-types",
}


def check(path: str, expected_slides: int | None = None) -> list[str]:
    problems: list[str] = []
    try:
        z = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError) as e:
        return [f"not a readable zip archive: {e}"]
    with z:
        bad = z.testzip()
        if bad:
            problems.append(f"corrupt archive member: {bad}")
        names = set(z.namelist())
        for required in ("[Content_Types].xml", "ppt/presentation.xml", "ppt/_rels/presentation.xml.rels"):
            if required not in names:
                problems.append(f"missing required part: {required}")
        if problems:
            return problems

        # 1. every XML part is well formed
        trees: dict[str, ET.Element] = {}
        for n in sorted(names):
            if n.endswith((".xml", ".rels")):
                try:
                    trees[n] = ET.fromstring(z.read(n))
                except ET.ParseError as e:
                    problems.append(f"{n}: XML is not well formed ({e})")

        # 2. slide list matches slide parts
        slide_parts = sorted(n for n in names if re.fullmatch(r"ppt/slides/slide\d+\.xml", n))
        pres = trees.get("ppt/presentation.xml")
        listed = len(pres.findall("p:sldIdLst/p:sldId", NS)) if pres is not None else 0
        if listed != len(slide_parts):
            problems.append(f"presentation.xml lists {listed} slides but the package has {len(slide_parts)} slide parts")
        if expected_slides is not None and len(slide_parts) != expected_slides:
            problems.append(f"{len(slide_parts)} slides in the file, {expected_slides} expected")
        if not slide_parts:
            problems.append("the deck has no slides")

        # 3. every internal relationship target exists
        for n, root in trees.items():
            if not n.endswith(".rels"):
                continue
            base = posixpath.dirname(posixpath.dirname(n))  # folder of the part the rels file belongs to
            for rel in root.findall("r:Relationship", NS):
                if rel.get("TargetMode") == "External":
                    continue
                target = rel.get("Target", "")
                full = target.lstrip("/") if target.startswith("/") else posixpath.normpath(posixpath.join(base, target))
                if full not in names:
                    problems.append(f"{n}: relationship {rel.get('Id')} points at {target}, which is not in the file")

        # 4. every slide has a layout relationship
        for s in slide_parts:
            rels = f"ppt/slides/_rels/{posixpath.basename(s)}.rels"
            root = trees.get(rels)
            if root is None or not any((r.get("Type") or "").endswith("/slideLayout") for r in root.findall("r:Relationship", NS)):
                problems.append(f"{s}: no slide layout relationship")

        # 5. every part has a content type
        ct = trees.get("[Content_Types].xml")
        if ct is not None:
            defaults = {d.get("Extension", "").lower() for d in ct.findall("ct:Default", NS)}
            overrides = {o.get("PartName", "").lstrip("/") for o in ct.findall("ct:Override", NS)}
            for n in sorted(names):
                if n.endswith("/") or n == "[Content_Types].xml":
                    continue
                ext = n.rsplit(".", 1)[-1].lower() if "." in posixpath.basename(n) else ""
                if n not in overrides and ext not in defaults:
                    problems.append(f"{n}: no content type declared")
            # An Override for a part that is absent is tolerated by every Office application
            # (pptxgenjs writes a few), so it is not reported.

        # 6. no local file path leaked into the package (picture descriptions, link targets)
        local_path = re.compile(r'(?:descr|name|title|Target)="((?:/Users/|/home/|/private/|/var/folders/|[A-Za-z]:\\\\)[^"]*)"')
        for n in sorted(trees):
            if not n.startswith("ppt/"):
                continue
            m = local_path.search(z.read(n).decode("utf-8", "ignore"))
            if m:
                problems.append(f"{n}: contains a local file path ({m.group(1)[:60]}); it would be visible to whoever receives the deck")

        # 7. colour values are six hex digits
        for n, root in trees.items():
            if not n.startswith("ppt/"):
                continue
            for el in root.iter(f"{{{NS['a']}}}srgbClr"):
                val = el.get("val", "")
                if not re.fullmatch(r"[0-9A-Fa-f]{6}", val):
                    problems.append(f"{n}: colour value '{val}' is not six hex digits")
                    break
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description="Structural check of a .pptx (standard library only).")
    ap.add_argument("pptx")
    ap.add_argument("--slides", type=int, default=None, help="expected number of slides")
    args = ap.parse_args()
    problems = check(args.pptx, args.slides)
    if problems:
        print(f"pptx_check: {len(problems)} problem(s) in {args.pptx}")
        for p in problems[:30]:
            print("  - " + p)
        return 1
    print("pptx_check: archive, XML, slide list, relationships, content types, no local paths, colours all OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
