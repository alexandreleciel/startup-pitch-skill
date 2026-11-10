#!/usr/bin/env python3
"""extract.py: turn every readable file in a startup folder into markdown text.

Reads the inventory written by inventory.py and writes one corpus/<slug>.md per
normal or sensitive file (confidential files are listed in the index with the
reason, and only extracted with --include-confidential). Also writes
corpus/INDEX.md, ordered by likely importance, so the model can read the index
and open only what it needs.

Extraction methods, in order of preference per type. Everything after the first
entry is a fallback, and when nothing works the corpus file records
"could not extract, install X" instead of failing the run.

  markdown, text, json, code   read as is (utf-8, utf-8-sig, cp1252, then replace)
  csv                           stdlib csv -> markdown table, 200 row cap, numeric column stats
  xlsx                          openpyxl -> stdlib zipfile + XML (formulas recomputed when the
                                cached value is empty) -> soffice --convert-to xlsx for .xls/.ods
  docx                          python-docx -> stdlib zipfile + XML -> soffice --convert-to txt
  pdf                           pypdf -> pdftotext (poppler) -> note
  pptx                          python-pptx -> stdlib zipfile + XML -> soffice --convert-to pdf + pdftotext
  image                         listed only, with dimensions when the header is readable

Usage:
  extract.py <startup-folder> [--inventory pitch/intake/inventory.json]
             [--out pitch/intake/corpus] [--include-confidential] [--quiet]

Defaults resolve inside the startup folder; explicit relative paths resolve
against the current directory.

Exit codes: 0 success (missing extractors are noted, not failures), 1 an
unexpected error while extracting at least one file, 2 usage error.
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import io
import json
import math
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from xml.etree import ElementTree as ET

CSV_ROW_CAP = 200
XLSX_ROW_CAP = 100
XLSX_COL_CAP = 30
TEXT_CHAR_CAP = 400_000

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
}


def which(name: str) -> str | None:
    return shutil.which(name)


def soffice_path() -> str | None:
    for cand in ("soffice", "libreoffice"):
        p = which(cand)
        if p:
            return p
    mac = "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    return mac if os.path.exists(mac) else None


def md_cell(value) -> str:
    if value is None:
        return ""
    s = str(value)
    return s.replace("|", "\\|").replace("\n", " ").replace("\r", " ").strip()


def md_table(rows: list[list], header: list | None = None) -> str:
    if header is None:
        if not rows:
            return "_(empty)_\n"
        header, rows = rows[0], rows[1:]
    width = max([len(header)] + [len(r) for r in rows]) if (rows or header) else 0
    header = list(header) + [""] * (width - len(header))
    out = ["| " + " | ".join(md_cell(c) for c in header) + " |",
           "|" + "---|" * width]
    for r in rows:
        r = list(r) + [""] * (width - len(r))
        out.append("| " + " | ".join(md_cell(c) for c in r) + " |")
    return "\n".join(out) + "\n"


def fmt_num(v) -> str:
    if isinstance(v, float):
        if math.isfinite(v) and v == int(v) and abs(v) < 1e15:
            return str(int(v))
        return f"{v:.6g}"
    return str(v)


def to_number(s) -> float | None:
    if s is None:
        return None
    if isinstance(s, (int, float)) and not isinstance(s, bool):
        return float(s)
    t = str(s).strip().replace(",", "")
    t = re.sub(r"^[^\d\-+.]+", "", t)  # currency symbols
    t = t.rstrip("%")
    if not t or t.lower() in {"nan", "inf", "-inf"}:
        return None
    try:
        return float(t)
    except ValueError:
        return None


# ----------------------------------------------------------------------------
# Text
# ----------------------------------------------------------------------------

def decode_bytes(raw: bytes) -> tuple[str, str]:
    for enc in ("utf-8", "utf-8-sig"):
        try:
            return raw.decode(enc), enc
        except UnicodeDecodeError:
            pass
    try:
        return raw.decode("cp1252"), "cp1252 (file was not valid utf-8)"
    except UnicodeDecodeError:
        return raw.decode("utf-8", errors="replace"), "utf-8 with replacement characters"


def extract_text(path: Path) -> tuple[str, str, list[str]]:
    raw = path.read_bytes()
    notes: list[str] = []
    if b"\x00" in raw[:4096]:
        return "", "skipped", ["binary content, not extracted"]
    text, enc = decode_bytes(raw)
    if enc != "utf-8":
        notes.append(f"decoded as {enc}")
    if len(text) > TEXT_CHAR_CAP:
        notes.append(f"truncated to {TEXT_CHAR_CAP} characters of {len(text)}")
        text = text[:TEXT_CHAR_CAP]
    return text, "read as is", notes


# ----------------------------------------------------------------------------
# CSV
# ----------------------------------------------------------------------------

def extract_csv(path: Path) -> tuple[str, str, list[str]]:
    raw = path.read_bytes()
    text, enc = decode_bytes(raw)
    notes: list[str] = []
    if enc != "utf-8":
        notes.append(f"decoded as {enc}")
    sample = text[:8192]
    delimiter = "\t" if path.suffix.lower() == ".tsv" else ","
    try:
        delimiter = csv.Sniffer().sniff(sample, delimiters=",;\t|").delimiter
    except csv.Error:
        pass
    rows = [r for r in csv.reader(io.StringIO(text), delimiter=delimiter) if any(c.strip() for c in r)]
    if not rows:
        return "_(empty file)_\n", "stdlib csv", notes
    header, body = rows[0], rows[1:]
    out = [f"Delimiter: `{repr(delimiter)[1:-1]}`, {len(body)} data rows, {len(header)} columns.\n"]
    shown = body[:CSV_ROW_CAP]
    out.append(md_table(shown, header))
    if len(body) > CSV_ROW_CAP:
        out.append(f"\n_Truncated: showing the first {CSV_ROW_CAP} of {len(body)} rows. The last row is below._\n")
        notes.append(f"table truncated to {CSV_ROW_CAP} of {len(body)} rows")
    if body:
        out.append("\n**Last row:** " + ", ".join(
            f"{md_cell(h)}={md_cell(v)}" for h, v in zip(header, body[-1])) + "\n")
        stats = []
        for ci, name in enumerate(header):
            col = [r[ci] for r in body if ci < len(r) and r[ci].strip() != ""]
            nums = [to_number(c) for c in col]
            nums = [n for n in nums if n is not None]
            if col and len(nums) >= max(1, int(0.8 * len(col))):
                stats.append([name, fmt_num(nums[0]), fmt_num(nums[-1]), fmt_num(min(nums)),
                              fmt_num(max(nums)), str(len(nums))])
        if stats:
            out.append("\n**Numeric column summary** (first and last are in file order)\n\n")
            out.append(md_table(stats, ["column", "first", "last", "min", "max", "count"]))
    return "".join(out), "stdlib csv", notes


# ----------------------------------------------------------------------------
# XLSX: openpyxl, then stdlib zip + XML with a small formula evaluator
# ----------------------------------------------------------------------------

def col_to_index(col: str) -> int:
    n = 0
    for ch in col.upper():
        n = n * 26 + (ord(ch) - 64)
    return n


def index_to_col(idx: int) -> str:
    s = ""
    while idx > 0:
        idx, rem = divmod(idx - 1, 26)
        s = chr(65 + rem) + s
    return s


def split_ref(ref: str) -> tuple[int, int]:
    m = re.match(r"^\$?([A-Za-z]{1,3})\$?(\d+)$", ref)
    if not m:
        raise ValueError(f"bad cell ref {ref}")
    return int(m.group(2)), col_to_index(m.group(1))


class FormulaEvaluator:
    """Evaluates the arithmetic subset of Excel formulas over a workbook grid.

    Supports numbers, cell refs, ranges inside SUM/AVERAGE/MIN/MAX/COUNT, ROUND,
    ABS, + - * / ^, parentheses and unary minus. Anything else raises ValueError
    and the caller shows the formula text instead.
    """

    FUNCS = {"SUM", "AVERAGE", "MIN", "MAX", "COUNT", "ROUND", "ABS", "ROUNDUP", "ROUNDDOWN", "INT"}
    TOKEN = re.compile(r"\s*(?:(\d+\.?\d*(?:[eE][-+]?\d+)?)|('[^']+'![$A-Za-z]+\$?\d+|[A-Za-z0-9_]+![$A-Za-z]+\$?\d+|\$?[A-Za-z]{1,3}\$?\d+)|([A-Za-z]+)(?=\()|(:)|([-+*/^(),%]))")

    def __init__(self, sheets: dict[str, dict], formulas: dict[str, dict]):
        self.sheets = sheets      # sheet -> {(row, col): value}
        self.formulas = formulas  # sheet -> {(row, col): formula text}
        self.cache: dict[tuple[str, int, int], float] = {}
        self.depth = 0

    def cell(self, sheet: str, row: int, col: int) -> float:
        key = (sheet, row, col)
        if key in self.cache:
            return self.cache[key]
        grid = self.sheets.get(sheet, {})
        val = grid.get((row, col))
        if (val is None or val == "") and (row, col) in self.formulas.get(sheet, {}):
            self.depth += 1
            if self.depth > 50:
                raise ValueError("formula recursion too deep")
            try:
                val = self.evaluate(sheet, self.formulas[sheet][(row, col)])
            finally:
                self.depth -= 1
        num = to_number(val) if not isinstance(val, bool) else None
        if num is None:
            if val in (None, ""):
                num = 0.0
            else:
                raise ValueError(f"non-numeric cell {sheet}!{index_to_col(col)}{row}")
        self.cache[key] = num
        return num

    def tokenize(self, text: str) -> list[tuple[str, str]]:
        pos, tokens = 0, []
        text = text.strip()
        while pos < len(text):
            m = self.TOKEN.match(text, pos)
            if not m or m.end() == pos:
                raise ValueError(f"unsupported formula syntax near '{text[pos:pos + 10]}'")
            pos = m.end()
            if m.group(1):
                tokens.append(("num", m.group(1)))
            elif m.group(2):
                tokens.append(("ref", m.group(2)))
            elif m.group(3):
                tokens.append(("func", m.group(3).upper()))
            elif m.group(4):
                tokens.append(("colon", ":"))
            elif m.group(5):
                tokens.append(("op", m.group(5)))
        return tokens

    def evaluate(self, sheet: str, formula: str) -> float:
        self.tokens = self.tokenize(formula)
        self.i = 0
        self.sheet = sheet
        val = self.expr()
        if self.i != len(self.tokens):
            raise ValueError("trailing tokens")
        return val

    def peek(self):
        return self.tokens[self.i] if self.i < len(self.tokens) else (None, None)

    def take(self):
        tok = self.tokens[self.i]
        self.i += 1
        return tok

    def expr(self) -> float:
        val = self.term()
        while self.peek() == ("op", "+") or self.peek() == ("op", "-"):
            op = self.take()[1]
            rhs = self.term()
            val = val + rhs if op == "+" else val - rhs
        return val

    def term(self) -> float:
        val = self.power()
        while self.peek() in (("op", "*"), ("op", "/")):
            op = self.take()[1]
            rhs = self.power()
            if op == "*":
                val *= rhs
            else:
                if rhs == 0:
                    raise ValueError("division by zero")
                val /= rhs
        return val

    def power(self) -> float:
        val = self.unary()
        while self.peek() == ("op", "^"):
            self.take()
            val = val ** self.unary()
        return val

    def unary(self) -> float:
        kind, text = self.peek()
        if kind == "op" and text in "+-":
            self.take()
            v = self.unary()
            return -v if text == "-" else v
        return self.atom()

    def resolve_ref(self, ref: str) -> tuple[str, int, int]:
        sheet = self.sheet
        if "!" in ref:
            sname, ref = ref.rsplit("!", 1)
            sheet = sname.strip("'")
        row, col = split_ref(ref)
        return sheet, row, col

    def range_values(self, start: str, end: str) -> list[float]:
        s_sheet, r1, c1 = self.resolve_ref(start)
        _, r2, c2 = self.resolve_ref(end)
        vals = []
        for r in range(min(r1, r2), max(r1, r2) + 1):
            for c in range(min(c1, c2), max(c1, c2) + 1):
                raw = self.sheets.get(s_sheet, {}).get((r, c))
                has_formula = (r, c) in self.formulas.get(s_sheet, {})
                if raw in (None, "") and not has_formula:
                    continue
                if to_number(raw) is None and not has_formula:
                    continue  # SUM ignores text
                vals.append(self.cell(s_sheet, r, c))
        return vals

    def atom(self) -> float:
        kind, text = self.take()
        if kind == "num":
            val = float(text)
        elif kind == "ref":
            if self.peek() == ("colon", ":"):
                raise ValueError("bare range outside a function")
            val = self.cell(*self.resolve_ref(text))
        elif kind == "func":
            if text not in self.FUNCS:
                raise ValueError(f"unsupported function {text}")
            if self.take() != ("op", "("):
                raise ValueError("expected (")
            args: list[list[float]] = []
            if self.peek() != ("op", ")"):
                while True:
                    k, t = self.peek()
                    if k == "ref" and self.i + 1 < len(self.tokens) and self.tokens[self.i + 1] == ("colon", ":"):
                        self.take()
                        self.take()
                        k2, t2 = self.take()
                        if k2 != "ref":
                            raise ValueError("bad range")
                        args.append(self.range_values(t, t2))
                    else:
                        args.append([self.expr()])
                    if self.peek() == ("op", ","):
                        self.take()
                        continue
                    break
            if self.take() != ("op", ")"):
                raise ValueError("expected )")
            flat = [v for a in args for v in a]
            if text == "SUM":
                val = sum(flat)
            elif text == "AVERAGE":
                val = sum(flat) / len(flat) if flat else 0.0
            elif text == "MIN":
                val = min(flat) if flat else 0.0
            elif text == "MAX":
                val = max(flat) if flat else 0.0
            elif text == "COUNT":
                val = float(len(flat))
            elif text == "ABS":
                val = abs(flat[0])
            elif text == "INT":
                val = float(math.floor(flat[0]))
            else:  # ROUND family
                digits = int(flat[1]) if len(flat) > 1 else 0
                factor = 10 ** digits
                x = flat[0] * factor
                if text == "ROUNDUP":
                    x = math.ceil(x) if x > 0 else math.floor(x)
                elif text == "ROUNDDOWN":
                    x = math.floor(x) if x > 0 else math.ceil(x)
                else:
                    x = math.floor(x + 0.5) if x >= 0 else -math.floor(-x + 0.5)
                val = x / factor
        elif kind == "op" and text == "(":
            val = self.expr()
            if self.take() != ("op", ")"):
                raise ValueError("expected )")
        else:
            raise ValueError(f"unexpected token {text}")
        if self.peek() == ("op", "%"):
            self.take()
            val /= 100.0
        return val


def excel_serial_to_date(serial: float) -> str:
    base = dt.datetime(1899, 12, 30)
    d = base + dt.timedelta(days=serial)
    return d.strftime("%Y-%m-%d") if d.hour == 0 and d.minute == 0 else d.strftime("%Y-%m-%d %H:%M")


def read_xlsx_stdlib(path: Path) -> tuple[dict, list[str]]:
    """Return {sheet name: {"state":..., "grid": {(r,c): value}, "formulas": {(r,c): text}}}."""
    notes: list[str] = []
    with zipfile.ZipFile(path) as zf:
        names = set(zf.namelist())
        wb = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rel_map = {}
        for rel in rels.findall("rel:Relationship", NS):
            target = rel.get("Target", "")
            if target.startswith("/"):
                target = target[1:]
            elif not target.startswith("xl/"):
                target = "xl/" + target
            rel_map[rel.get("Id")] = target
        shared: list[str] = []
        if "xl/sharedStrings.xml" in names:
            sst = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in sst.findall("main:si", NS):
                shared.append("".join(t.text or "" for t in si.iter(f"{{{NS['main']}}}t")))
        date_styles: set[int] = set()
        if "xl/styles.xml" in names:
            try:
                styles = ET.fromstring(zf.read("xl/styles.xml"))
                custom = {}
                for nf in styles.iter(f"{{{NS['main']}}}numFmt"):
                    custom[int(nf.get("numFmtId"))] = nf.get("formatCode", "")
                xfs = styles.find("main:cellXfs", NS)
                if xfs is not None:
                    for i, xf in enumerate(xfs.findall("main:xf", NS)):
                        fid = int(xf.get("numFmtId", "0"))
                        code = custom.get(fid, "")
                        if 14 <= fid <= 22 or 45 <= fid <= 47 or (
                                code and re.search(r"[dmy]", re.sub(r'"[^"]*"|\[[^\]]*\]', "", code).lower())
                                and not re.search(r"[#0]", code)):
                            date_styles.add(i)
            except ET.ParseError:
                pass
        sheets: dict[str, dict] = {}
        for sh in wb.find("main:sheets", NS).findall("main:sheet", NS):
            name = sh.get("name")
            state = sh.get("state", "visible")
            rid = sh.get(f"{{{NS['r']}}}id")
            target = rel_map.get(rid)
            if not target or target not in names:
                notes.append(f"sheet {name}: worksheet part not found")
                continue
            root = ET.fromstring(zf.read(target))
            grid: dict[tuple[int, int], object] = {}
            formulas: dict[tuple[int, int], str] = {}
            for c in root.iter(f"{{{NS['main']}}}c"):
                ref = c.get("r")
                if not ref:
                    continue
                row, col = split_ref(ref)
                ctype = c.get("t", "n")
                style = int(c.get("s", "0") or 0)
                f_el = c.find("main:f", NS)
                v_el = c.find("main:v", NS)
                value: object = None
                if ctype == "inlineStr":
                    is_el = c.find("main:is", NS)
                    value = "".join(t.text or "" for t in is_el.iter(f"{{{NS['main']}}}t")) if is_el is not None else ""
                elif ctype == "s" and v_el is not None and v_el.text is not None:
                    value = shared[int(v_el.text)] if int(v_el.text) < len(shared) else ""
                elif ctype == "b" and v_el is not None:
                    value = v_el.text == "1"
                elif ctype in ("str", "e"):
                    value = v_el.text if v_el is not None else ""
                else:
                    if v_el is not None and v_el.text not in (None, ""):
                        num = to_number(v_el.text)
                        value = num if num is not None else v_el.text
                        if num is not None and style in date_styles:
                            value = excel_serial_to_date(num)
                if f_el is not None:
                    ftext = (f_el.text or "").strip()
                    if ftext:
                        formulas[(row, col)] = ftext
                    elif f_el.get("t") == "shared":
                        formulas[(row, col)] = ""  # shared formula without its own text
                if value is not None and value != "":
                    grid[(row, col)] = value
            sheets[name] = {"state": state, "grid": grid, "formulas": formulas}
    return sheets, notes


def render_sheets(sheets: dict, notes: list[str]) -> str:
    evaluator = FormulaEvaluator({n: s["grid"] for n, s in sheets.items()},
                                 {n: {k: v for k, v in s["formulas"].items() if v} for n, s in sheets.items()})
    out: list[str] = []
    hidden = [n for n, s in sheets.items() if s["state"] != "visible"]
    if hidden:
        out.append(f"_Hidden sheets: {', '.join(hidden)} (included below)._\n\n")
        notes.append(f"hidden sheets: {', '.join(hidden)}")
    for name, s in sheets.items():
        grid, formulas = s["grid"], s["formulas"]
        out.append(f"## Sheet: {name}" + (f" ({s['state']})" if s["state"] != "visible" else "") + "\n\n")
        cells = set(grid) | set(formulas)
        if not cells:
            out.append("_(empty sheet)_\n\n")
            continue
        max_row = max(r for r, _ in cells)
        max_col = max(c for _, c in cells)
        shown_rows = min(max_row, XLSX_ROW_CAP)
        shown_cols = min(max_col, XLSX_COL_CAP)
        computed: list[str] = []
        rows: list[list[str]] = []
        for r in range(1, shown_rows + 1):
            row_vals: list[str] = []
            for c in range(1, shown_cols + 1):
                val = grid.get((r, c))
                formula = formulas.get((r, c))
                if (val is None or val == "") and formula is not None:
                    if formula:
                        try:
                            num = evaluator.cell(name, r, c)
                            val = fmt_num(num)
                            computed.append(f"{index_to_col(c)}{r}: ={formula} -> {val}")
                        except (ValueError, ZeroDivisionError, OverflowError):
                            val = f"={formula} (no cached value)"
                            computed.append(f"{index_to_col(c)}{r}: ={formula} -> not evaluated")
                    else:
                        val = "(shared formula, no cached value)"
                elif formula:
                    computed.append(f"{index_to_col(c)}{r}: ={formula} -> {fmt_num(val)}")
                row_vals.append("" if val is None else (fmt_num(val) if isinstance(val, float) else str(val)))
            rows.append(row_vals)
        header = [index_to_col(c) for c in range(1, shown_cols + 1)]
        out.append(md_table([[str(i + 1)] + r for i, r in enumerate(rows)], ["row"] + header))
        if max_row > shown_rows or max_col > shown_cols:
            out.append(f"\n_Truncated: sheet has {max_row} rows x {max_col} columns, showing "
                       f"{shown_rows} x {shown_cols}._\n")
            notes.append(f"sheet {name} truncated to {shown_rows}x{shown_cols} of {max_row}x{max_col}")
        if computed:
            out.append("\n**Formulas** (cell: formula -> value)\n\n")
            out.extend(f"- {line}\n" for line in computed[:200])
            if len(computed) > 200:
                out.append(f"- ... {len(computed) - 200} more formulas\n")
        out.append("\n")
    return "".join(out)


def extract_xlsx(path: Path) -> tuple[str, str, list[str]]:
    notes: list[str] = []
    suffix = path.suffix.lower()
    work = path
    tmpdir = None
    try:
        if suffix not in (".xlsx", ".xlsm"):
            soff = soffice_path()
            if not soff:
                return ("", "none", [f"could not extract {suffix} file: install LibreOffice (soffice) "
                                     "or convert it to .xlsx"])
            tmpdir = tempfile.mkdtemp(prefix="pitch-xlsx-")
            subprocess.run([soff, "--headless", "--convert-to", "xlsx", "--outdir", tmpdir, str(path)],
                           capture_output=True, timeout=180)
            cands = list(Path(tmpdir).glob("*.xlsx"))
            if not cands:
                return "", "none", [f"soffice could not convert {path.name} to xlsx"]
            work = cands[0]
            notes.append("converted with soffice --headless --convert-to xlsx")
        try:
            import openpyxl  # type: ignore
            wb_vals = openpyxl.load_workbook(work, data_only=True, read_only=False)
            wb_form = openpyxl.load_workbook(work, data_only=False, read_only=False)
            sheets: dict[str, dict] = {}
            for ws in wb_form.worksheets:
                grid, formulas = {}, {}
                ws_vals = wb_vals[ws.title]
                for row in ws.iter_rows():
                    for cell in row:
                        if cell.value is None:
                            continue
                        key = (cell.row, cell.column)
                        v = cell.value
                        if isinstance(v, str) and v.startswith("="):
                            formulas[key] = v[1:]
                            cached = ws_vals.cell(row=cell.row, column=cell.column).value
                            if cached is not None:
                                grid[key] = cached
                        else:
                            grid[key] = v.isoformat() if hasattr(v, "isoformat") else v
                sheets[ws.title] = {"state": ws.sheet_state, "grid": grid, "formulas": formulas}
            return render_sheets(sheets, notes), "openpyxl", notes
        except ImportError:
            pass
        sheets, more = read_xlsx_stdlib(work)
        notes.extend(more)
        return render_sheets(sheets, notes), "stdlib zipfile + xml", notes
    finally:
        if tmpdir:
            shutil.rmtree(tmpdir, ignore_errors=True)


# ----------------------------------------------------------------------------
# DOCX
# ----------------------------------------------------------------------------

def docx_paragraph_text(p: ET.Element) -> str:
    parts: list[str] = []
    for node in p.iter():
        tag = node.tag.split("}")[-1]
        if tag == "t":
            parts.append(node.text or "")
        elif tag == "tab":
            parts.append("\t")
        elif tag in ("br", "cr"):
            parts.append("\n")
    return "".join(parts)


def read_docx_stdlib(path: Path) -> str:
    with zipfile.ZipFile(path) as zf:
        root = ET.fromstring(zf.read("word/document.xml"))
    body = root.find("w:body", NS)
    out: list[str] = []
    w = f"{{{NS['w']}}}"
    for child in body:
        tag = child.tag.split("}")[-1]
        if tag == "p":
            text = docx_paragraph_text(child).strip()
            if not text:
                out.append("")
                continue
            style = child.find(f"{w}pPr/{w}pStyle")
            sval = (style.get(f"{w}val") if style is not None else "") or ""
            m = re.match(r"(?i)heading\s*(\d)", sval) or re.match(r"(?i)berschrift\s*(\d)", sval)
            if m:
                out.append("#" * min(int(m.group(1)), 6) + " " + text)
            elif sval.lower() == "title":
                out.append("# " + text)
            elif child.find(f"{w}pPr/{w}numPr") is not None or sval.lower().startswith("list"):
                out.append("- " + text)
            else:
                out.append(text)
        elif tag == "tbl":
            rows = []
            for tr in child.findall(f"{w}tr"):
                rows.append([" ".join(docx_paragraph_text(p).strip() for p in tc.findall(f"{w}p"))
                             for tc in tr.findall(f"{w}tc")])
            out.append("")
            out.append(md_table(rows))
        elif tag == "sdt":
            out.append(docx_paragraph_text(child).strip())
    text = "\n".join(out)
    return re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"


def soffice_to_text(path: Path, target: str = "txt:Text") -> str | None:
    soff = soffice_path()
    if not soff:
        return None
    tmpdir = tempfile.mkdtemp(prefix="pitch-soffice-")
    try:
        subprocess.run([soff, "--headless", "--convert-to", target, "--outdir", tmpdir, str(path)],
                       capture_output=True, timeout=180)
        outs = list(Path(tmpdir).glob("*.txt"))
        if outs:
            return decode_bytes(outs[0].read_bytes())[0]
        return None
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def extract_docx(path: Path) -> tuple[str, str, list[str]]:
    notes: list[str] = []
    if path.suffix.lower() == ".docx":
        try:
            import docx  # type: ignore
            d = docx.Document(str(path))
            out = []
            for block in d.element.body:
                tag = block.tag.split("}")[-1]
                if tag == "p":
                    out.append(docx_paragraph_text(block).strip())
                elif tag == "tbl":
                    rows = []
                    for tr in block.iter(f"{{{NS['w']}}}tr"):
                        rows.append([" ".join(docx_paragraph_text(p).strip() for p in tc.iter(f"{{{NS['w']}}}p"))
                                     for tc in tr.findall(f"{{{NS['w']}}}tc")])
                    out.append(md_table(rows))
            return "\n".join(out) + "\n", "python-docx", notes
        except ImportError:
            pass
        try:
            return read_docx_stdlib(path), "stdlib zipfile + xml", notes
        except (KeyError, ET.ParseError, zipfile.BadZipFile) as exc:
            notes.append(f"stdlib docx parse failed: {exc}")
    text = soffice_to_text(path)
    if text is not None:
        return text, "soffice --headless --convert-to txt", notes
    notes.append(f"could not extract {path.suffix} file: install python-docx (pip install python-docx) "
                 "or LibreOffice (soffice)")
    return "", "none", notes


# ----------------------------------------------------------------------------
# PDF
# ----------------------------------------------------------------------------

def pages_to_markdown(pages: list[str]) -> str:
    out = []
    for i, page in enumerate(pages, 1):
        text = page.strip("\n")
        out.append(f"## Page {i}\n\n{text}\n")
    return "\n".join(out)


def extract_pdf(path: Path) -> tuple[str, str, list[str]]:
    notes: list[str] = []
    try:
        import pypdf  # type: ignore
        reader = pypdf.PdfReader(str(path))
        pages = [(p.extract_text() or "") for p in reader.pages]
        if sum(len(p.strip()) for p in pages) == 0:
            notes.append("pypdf found no text layer (scanned PDF?), OCR not attempted")
        return pages_to_markdown(pages), "pypdf", notes
    except ImportError:
        pass
    exe = which("pdftotext")
    if exe:
        res = subprocess.run([exe, "-layout", "-q", str(path), "-"], capture_output=True, timeout=120)
        text = res.stdout.decode("utf-8", errors="replace")
        pages = text.split("\f")
        if pages and not pages[-1].strip():
            pages = pages[:-1]
        if not any(p.strip() for p in pages):
            notes.append("pdftotext found no text layer (scanned PDF?), OCR not attempted")
        return pages_to_markdown(pages), "pdftotext (poppler)", notes
    notes.append("could not extract PDF: install pypdf (pip install pypdf) or poppler (brew install poppler)")
    return "", "none", notes


# ----------------------------------------------------------------------------
# PPTX
# ----------------------------------------------------------------------------

def read_pptx_stdlib(path: Path) -> str:
    a = f"{{{NS['a']}}}"
    with zipfile.ZipFile(path) as zf:
        names = set(zf.namelist())
        pres = ET.fromstring(zf.read("ppt/presentation.xml"))
        rels = ET.fromstring(zf.read("ppt/_rels/presentation.xml.rels"))
        rel_map = {r.get("Id"): r.get("Target") for r in rels.findall("rel:Relationship", NS)}
        order = []
        for sld in pres.iter(f"{{{NS['p']}}}sldId"):
            target = rel_map.get(sld.get(f"{{{NS['r']}}}id"), "")
            target = target[1:] if target.startswith("/") else "ppt/" + target
            order.append(target)
        if not order:
            order = sorted((n for n in names if re.match(r"ppt/slides/slide\d+\.xml$", n)),
                           key=lambda n: int(re.search(r"(\d+)", n.rsplit("/", 1)[1]).group(1)))
        out = []
        for i, slide_path in enumerate(order, 1):
            if slide_path not in names:
                continue
            root = ET.fromstring(zf.read(slide_path))
            lines = []
            for sp in root.iter():
                tag = sp.tag.split("}")[-1]
                if tag == "txBody" or tag == "tbl":
                    if tag == "tbl":
                        rows = []
                        for tr in sp.findall(f"{a}tr"):
                            rows.append(["".join(t.text or "" for t in tc.iter(f"{a}t")) for tc in tr.findall(f"{a}tc")])
                        lines.append(md_table(rows))
                        continue
                    for p in sp.findall(f"{a}p"):
                        text = "".join(t.text or "" for t in p.iter(f"{a}t")).strip()
                        if text:
                            lines.append(text)
            # speaker notes
            rel_name = slide_path.replace("ppt/slides/", "ppt/slides/_rels/") + ".rels"
            notes_text = ""
            if rel_name in names:
                srels = ET.fromstring(zf.read(rel_name))
                for r in srels.findall("rel:Relationship", NS):
                    if r.get("Type", "").endswith("/notesSlide"):
                        npath = "ppt/" + r.get("Target").replace("../", "")
                        if npath in names:
                            nroot = ET.fromstring(zf.read(npath))
                            notes_text = "\n".join(
                                "".join(t.text or "" for t in p.iter(f"{a}t")).strip()
                                for p in nroot.iter(f"{a}p")).strip()
            out.append(f"## Slide {i}\n\n" + "\n".join(lines) + "\n")
            if notes_text:
                out.append(f"\n_Speaker notes:_ {notes_text}\n")
        return "\n".join(out)


def extract_pptx(path: Path) -> tuple[str, str, list[str]]:
    notes: list[str] = []
    if path.suffix.lower() == ".pptx":
        try:
            from pptx import Presentation  # type: ignore
            prs = Presentation(str(path))
            out = []
            for i, slide in enumerate(prs.slides, 1):
                lines = []
                for shape in slide.shapes:
                    if shape.has_text_frame:
                        for p in shape.text_frame.paragraphs:
                            t = "".join(r.text for r in p.runs).strip()
                            if t:
                                lines.append(t)
                    if getattr(shape, "has_table", False) and shape.has_table:
                        rows = [[c.text for c in r.cells] for r in shape.table.rows]
                        lines.append(md_table(rows))
                out.append(f"## Slide {i}\n\n" + "\n".join(lines) + "\n")
                if slide.has_notes_slide and slide.notes_slide.notes_text_frame.text.strip():
                    out.append(f"\n_Speaker notes:_ {slide.notes_slide.notes_text_frame.text.strip()}\n")
            return "\n".join(out), "python-pptx", notes
        except ImportError:
            pass
        try:
            return read_pptx_stdlib(path), "stdlib zipfile + xml", notes
        except (KeyError, ET.ParseError, zipfile.BadZipFile) as exc:
            notes.append(f"stdlib pptx parse failed: {exc}")
    soff = soffice_path()
    if soff and which("pdftotext"):
        tmpdir = tempfile.mkdtemp(prefix="pitch-pptx-")
        try:
            subprocess.run([soff, "--headless", "--convert-to", "pdf", "--outdir", tmpdir, str(path)],
                           capture_output=True, timeout=240)
            pdfs = list(Path(tmpdir).glob("*.pdf"))
            if pdfs:
                text, _m, more = extract_pdf(pdfs[0])
                notes.extend(more)
                return text.replace("## Page ", "## Slide "), "soffice -> pdf -> pdftotext", notes
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)
    notes.append(f"could not extract {path.suffix} file: install python-pptx (pip install python-pptx) "
                 "or LibreOffice (soffice) plus poppler")
    return "", "none", notes


# ----------------------------------------------------------------------------
# Images
# ----------------------------------------------------------------------------

def image_dimensions(path: Path) -> str | None:
    try:
        with open(path, "rb") as fh:
            head = fh.read(64 * 1024)
    except OSError:
        return None
    if head[:8] == b"\x89PNG\r\n\x1a\n" and len(head) >= 24:
        w, h = struct.unpack(">II", head[16:24])
        return f"{w}x{h}"
    if head[:6] in (b"GIF87a", b"GIF89a") and len(head) >= 10:
        w, h = struct.unpack("<HH", head[6:10])
        return f"{w}x{h}"
    if head[:2] == b"\xff\xd8":
        i = 2
        while i + 9 < len(head):
            if head[i] != 0xFF:
                i += 1
                continue
            marker = head[i + 1]
            if marker in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                h, w = struct.unpack(">HH", head[i + 5:i + 9])
                return f"{w}x{h}"
            seg = struct.unpack(">H", head[i + 2:i + 4])[0]
            i += 2 + seg
        return None
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP" and head[12:16] == b"VP8 " and len(head) >= 30:
        w, h = struct.unpack("<HH", head[26:30])
        return f"{w & 0x3fff}x{h & 0x3fff}"
    if path.suffix.lower() == ".svg" or b"<svg" in head[:2048]:
        text = head.decode("utf-8", errors="replace")
        m = re.search(r"<svg[^>]*>", text, re.IGNORECASE | re.DOTALL)
        if m:
            tag = m.group(0)
            w = re.search(r'\swidth="([^"]+)"', tag)
            h = re.search(r'\sheight="([^"]+)"', tag)
            vb = re.search(r'\sviewBox="([^"]+)"', tag)
            if w and h:
                return f"{w.group(1)}x{h.group(1)}"
            if vb:
                parts = vb.group(1).split()
                if len(parts) == 4:
                    return f"viewBox {parts[2]}x{parts[3]}"
    return None


def extract_image(path: Path) -> tuple[str, str, list[str]]:
    dims = image_dimensions(path)
    body = f"Image file, listed only.\n\n- dimensions: {dims or 'unknown'}\n"
    if path.suffix.lower() == ".svg":
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
            texts = re.findall(r">([^<>]{2,80})<", text)
            texts = [t.strip() for t in texts if t.strip() and not t.strip().startswith("<?")]
            if texts:
                body += "- text inside the SVG: " + "; ".join(texts[:20]) + "\n"
            colors = sorted(set(re.findall(r"#[0-9a-fA-F]{6}\b", text)))
            if colors:
                body += "- colours used: " + ", ".join(colors[:12]) + "\n"
        except OSError:
            pass
    return body, "header parse", []


# ----------------------------------------------------------------------------
# Driver
# ----------------------------------------------------------------------------

EXTRACTORS = {
    "markdown": extract_text, "text": extract_text, "json": extract_text, "code": extract_text,
    "csv": extract_csv, "xlsx": extract_xlsx, "docx": extract_docx, "pdf": extract_pdf,
    "pptx": extract_pptx, "image": extract_image,
}


def extract_other(path: Path) -> tuple[str, str, list[str]]:
    if path.stat().st_size <= 1_000_000:
        raw = path.read_bytes()
        if b"\x00" not in raw[:4096]:
            text, enc = decode_bytes(raw)
            if text.count("\ufffd") < max(5, len(text) // 200):
                return text, "read as text (unknown extension)", ([] if enc == "utf-8" else [f"decoded as {enc}"])
    return "", "skipped", ["unknown file type, not extracted"]


PAY_TERMS = {"salary", "payroll", "option grant"}


def terms_note(terms: list[str]) -> str:
    """Note for a normal file that mentions deal or pay terms somewhere in its text."""
    if not terms:
        return ""
    if all(t in PAY_TERMS for t in terms):
        return f"mentions pay ({', '.join(terms)}): keep individual pay out of investor outputs"
    return f"contains deal terms ({', '.join(terms)}): keep out of investor outputs"


def slug_for(rel: str, used: set[str]) -> str:
    s = rel.replace("/", "__")
    s = re.sub(r"[^A-Za-z0-9._-]+", "-", s)
    base = s
    n = 2
    while s in used:
        s = f"{base}--{n}"
        n += 1
    used.add(s)
    return s


IMPORTANCE_WORDS = [
    (0, r"readme|memo|pitch|vision|overview|summary|one[-_]?pager|board[-_]?update|update|perspective|"
        r"narrative|strategy|plan|faq|whitepaper|case[-_]?study|interview|customer|market|competit|product|"
        r"problem|solution|traction|^notes/|^docs/"),
    (1, r"^data/|metric|model|kpi|pipeline|cohort|unit[-_]?econ|financ|forecast|budget|revenue|sales|funnel|"
        r"waitlist|bom|ask"),
    (2, r"^team/|founder|team|bio|brand|asset|logo|design|deck"),
    (3, r"^legal/|^hr/|cap[-_]?table|contract|terms|salar|payroll|investor[-_]?feedback"),
]


def importance(entry: dict) -> tuple:
    path = entry["path"].lower()
    conf = entry["confidentiality"]
    if conf == "confidential":
        group = 5
    else:
        group = 4
        for g, pattern in IMPORTANCE_WORDS:
            if re.search(pattern, path):
                group = g
                break
        if entry["type"] in ("csv", "xlsx", "json") and group > 1:
            group = 1
        if entry["type"] in ("image", "code", "other") and group < 2:
            group = 2
        if conf == "sensitive" and group < 3:
            group = 3
    # Inside a group: the root README first (it is the overview), then the founder's own memos,
    # then everything else by path.
    if re.fullmatch(r"readme(\.\w+)?", path):
        lead = 0
    elif re.search(r"memo|perspective|founder[-_]?note", path):
        lead = 1
    else:
        lead = 2
    return (group, 1 if entry.get("stale") else 0, lead, path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="extract.py",
        description="Extract text from every file in the inventory into pitch/intake/corpus/*.md plus INDEX.md.",
        epilog="Exit codes: 0 success, 1 unexpected extraction error, 2 usage error.")
    parser.add_argument("folder", help="the startup's folder")
    parser.add_argument("--inventory", default=None,
                        help="inventory.json from inventory.py (default: <folder>/pitch/intake/inventory.json)")
    parser.add_argument("--out", default=None, help="corpus folder (default: <folder>/pitch/intake/corpus)")
    parser.add_argument("--include-confidential", action="store_true",
                        help="also extract files classified confidential (they stay marked in every header)")
    parser.add_argument("--quiet", action="store_true", help="print only the one-line result")
    try:
        args = parser.parse_args(argv)
    except SystemExit as exc:
        return 0 if exc.code == 0 else 2

    root = Path(args.folder).expanduser().resolve()
    if not root.is_dir():
        print(f"error: {root} is not a directory", file=sys.stderr)
        return 2
    inv_path = (root / "pitch" / "intake" / "inventory.json") if args.inventory is None \
        else Path(args.inventory).expanduser().resolve()
    if not inv_path.is_file():
        print(f"error: inventory not found at {inv_path}. Run inventory.py first.", file=sys.stderr)
        return 2
    out_dir = (root / "pitch" / "intake" / "corpus") if args.out is None else Path(args.out).expanduser().resolve()
    try:
        inventory = json.loads(inv_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"error: cannot read inventory: {exc}", file=sys.stderr)
        return 2

    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.md"):
        old.unlink()

    entries = sorted(inventory.get("files", []), key=importance)
    used: set[str] = set()
    index_rows: list[dict] = []
    hard_errors: list[str] = []
    methods_used: dict[str, set[str]] = {}

    for e in entries:
        rel = e["path"]
        src = root / rel
        conf = e["confidentiality"]
        row = {"path": rel, "type": e["type"], "size": e["size"], "chars": 0, "confidentiality": conf,
               "stale": e.get("stale_reason") or "", "superseded_by": e.get("superseded_by"),
               "corpus": "", "method": "", "notes": [],
               "terms": terms_note(e.get("sensitive_terms") or []) if conf == "normal" else ""}
        if conf == "confidential" and not args.include_confidential:
            row["method"] = "excluded"
            row["notes"] = ["excluded: confidential (" + ", ".join(e.get("confidentiality_reasons", [])) + ")"]
            index_rows.append(row)
            continue
        if not src.is_file():
            row["method"] = "missing"
            row["notes"] = ["file no longer exists"]
            index_rows.append(row)
            continue
        extractor = EXTRACTORS.get(e["type"], extract_other)
        try:
            text, method, notes = extractor(src)
        except Exception as exc:  # noqa: BLE001  one bad file must not stop the corpus
            text, method, notes = "", "error", [f"unexpected error: {type(exc).__name__}: {exc}"]
            hard_errors.append(f"{rel}: {exc}")
        methods_used.setdefault(e["type"], set()).add(method)
        slug = slug_for(rel, used) + ".md"
        header = [
            f"# {rel}",
            "",
            f"- source: {rel}",
            f"- type: {e['type']}",
            f"- size: {e['size']} bytes",
            f"- modified: {e['modified']}",
            f"- extraction: {method}",
            f"- confidentiality: {conf}" + (
                " (" + ", ".join(e.get("confidentiality_reasons", [])) + ")" if conf != "normal" else ""),
        ]
        if e.get("stale"):
            header.append(f"- stale: {e.get('stale_reason')}" + (
                f" (superseded by {e['superseded_by']})" if e.get("superseded_by") else ""))
        for n in notes:
            header.append(f"- note: {n}")
        if conf == "normal" and e.get("sensitive_terms"):
            header.append(f"- note: {terms_note(e['sensitive_terms'])}")
        header.append("")
        header.append("---")
        header.append("")
        body = text if text.strip() else "_(no text extracted)_\n"
        (out_dir / slug).write_text("\n".join(header) + body, encoding="utf-8")
        row.update({"chars": len(text), "corpus": slug, "method": method, "notes": notes})
        index_rows.append(row)

    # INDEX.md
    conf_rows = [r for r in index_rows if r["method"] == "excluded"]
    lines = [
        f"# Corpus index: {inventory.get('root', root)}",
        "",
        f"Generated {dt.datetime.now().strftime('%Y-%m-%d %H:%M')} from {inv_path.name}. "
        f"{len(index_rows)} files in inventory, {len([r for r in index_rows if r['corpus']])} extracted, "
        f"{len(conf_rows)} confidential and excluded.",
        "",
        "Rows are ordered by likely importance: overview and notes first, data second, team and brand, "
        "then legal, HR and anything confidential last. Read the index, then open only the corpus files you need.",
        "",
        "| # | path | type | size | chars | confidentiality | staleness | corpus file |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for i, r in enumerate(index_rows, 1):
        stale = r["stale"] + (f" (superseded by {r['superseded_by']})" if r.get("superseded_by") else "")
        corpus = f"`{r['corpus']}`" if r["corpus"] else ("excluded" if r["method"] == "excluded" else r["method"])
        lines.append(f"| {i} | {md_cell(r['path'])} | {r['type']} | {r['size']} | {r['chars']} | "
                     f"{r['confidentiality']}{'; ' + md_cell(r['terms']) if r.get('terms') else ''} | "
                     f"{md_cell(stale)} | {corpus} |")
    if conf_rows:
        lines += ["", "## Confidential files (not extracted)", ""]
        for r in conf_rows:
            lines.append(f"- `{r['path']}`: {r['notes'][0]}. Use --include-confidential to extract; never "
                         "put its content in the deck.")
    termed = [r for r in index_rows if r.get("terms")]
    if termed:
        lines += ["", "## Normal files that contain deal or pay terms", "",
                  "Extracted and usable, but the passages with these terms stay out of every investor output.", ""]
        for r in termed:
            lines.append(f"- `{r['path']}`: {r['terms']}")
    noted = [r for r in index_rows if r["notes"] and r["method"] != "excluded"]
    if noted:
        lines += ["", "## Extraction notes", ""]
        for r in noted:
            for n in r["notes"]:
                lines.append(f"- `{r['path']}`: {n}")
    lines += ["", "## Extraction methods used", ""]
    for t, ms in sorted(methods_used.items()):
        lines.append(f"- {t}: {', '.join(sorted(ms))}")
    (out_dir / "INDEX.md").write_text("\n".join(lines) + "\n", encoding="utf-8")

    extracted = len([r for r in index_rows if r["corpus"]])
    if args.quiet:
        print(f"{extracted} files extracted, {len(conf_rows)} confidential excluded, "
              f"{len(hard_errors)} errors -> {out_dir}")
    else:
        print(f"Corpus written to {out_dir}")
        print(f"{extracted} files extracted, {len(conf_rows)} confidential excluded, {len(hard_errors)} errors\n")
        print(f"{'#':<4}{'path':<52}{'type':<9}{'chars':>7}  {'method':<28}{'class'}")
        for i, r in enumerate(index_rows, 1):
            print(f"{i:<4}{r['path'][:51]:<52}{r['type']:<9}{r['chars']:>7}  {r['method'][:27]:<28}"
                  f"{r['confidentiality']}" + ("  stale" if r["stale"] else ""))
        if conf_rows:
            print("\nExcluded (confidential):")
            for r in conf_rows:
                print(f"  {r['path']}  {r['notes'][0]}")
        if noted:
            print("\nNotes:")
            for r in noted:
                for n in r["notes"]:
                    print(f"  {r['path']}: {n}")
        if hard_errors:
            print("\nErrors:")
            for h in hard_errors:
                print(f"  {h}")
    return 1 if hard_errors else 0


if __name__ == "__main__":
    sys.exit(main())
