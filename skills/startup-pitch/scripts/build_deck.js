#!/usr/bin/env node
'use strict';
/*
 * build_deck.js: turn pitch/deck/deck.json into deck.html and deck.pptx.
 *
 *   node scripts/build_deck.js pitch/deck/deck.json [--html-only] [--pptx-only] [--out DIR] [--check] [--strict]
 *
 * - deck.html is one self-contained file: fixed 1920x1080 stage scaled to the window,
 *   keyboard / click / touch navigation, speaker notes (press n), print stylesheet with
 *   one page per slide, inline SVG charts, Google Fonts with local fallbacks.
 * - deck.pptx is a native PowerPoint file built with pptxgenjs (LAYOUT_WIDE), with
 *   native charts, tables, speaker notes and a theme mapped to safe fonts. After writing
 *   it the script runs scripts/pptx_check.py (structural check, Python standard library)
 *   and, when Anthropic's pptx skill is installed on the machine, its OOXML validator too.
 * - Before rendering, a capacity lint lays the deck's words out in its own fonts and
 *   reports what does not fit (--strict fails the build, --capacities prints the table).
 * - --check screenshots every slide with playwright-core and the installed Chrome to
 *   deck/qa/slide-NN.png and reports overflow and overlapping text.
 *
 * Dependencies: pptxgenjs and playwright-core (scripts/package.json). Node 18+, CommonJS.
 * Themes and fonts live in assets/deck-template/themes.css; see THEMES.md.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const STAGE_W = 1920;
const STAGE_H = 1080;
const PLACEHOLDER = '[needs number]';
const KNOWN_TYPES = [
  'cover', 'problem', 'solution', 'product', 'insight', 'market', 'traction', 'business_model',
  'go_to_market', 'competition', 'team', 'financials', 'ask', 'roadmap', 'closing', 'appendix',
  'sources', 'custom_html', 'statement', 'two_column',
  'case_study',   // used by the eval fixtures: title, points, stats, optional image or chart (generic layout)
];
const MAX_POINTS = 5;
const MAX_STATS = 4;

// --------------------------------------------------------------------------------------
// 1. CLI
// --------------------------------------------------------------------------------------

function usage() {
  console.log('Usage: node scripts/build_deck.js pitch/deck/deck.json [--html-only] [--pptx-only] [--out DIR] [--check] [--strict] [--facts pitch/facts.yaml]');
  console.log('       node scripts/build_deck.js --capacities     print the capacity table (what fits on each slide type)');
}

function parseArgs(argv) {
  const opts = { input: null, html: true, pptx: true, out: null, check: false, facts: null, strict: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--html-only') opts.pptx = false;
    else if (a === '--pptx-only') opts.html = false;
    else if (a === '--check') opts.check = true;
    else if (a === '--strict') opts.strict = true;
    else if (a === '--capacities') { console.log(capacityMarkdown()); process.exit(0); }
    else if (a === '--out') opts.out = argv[++i];
    else if (a.startsWith('--out=')) opts.out = a.slice(6);
    else if (a === '--facts') opts.facts = argv[++i];
    else if (a.startsWith('--facts=')) opts.facts = a.slice(8);
    else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
    else if (!a.startsWith('--')) opts.input = a;
    else { console.error('Unknown option: ' + a); usage(); process.exit(1); }
  }
  if (!opts.input) { usage(); process.exit(1); }
  return opts;
}

const log = (msg) => console.log(msg);
// Relative path for messages when the file is under the current folder, absolute otherwise.
function rel(p) { const r = path.relative(process.cwd(), p); return r && !r.startsWith('..') ? r : p; }
const warn = (msg) => console.log('  warning: ' + msg);

// --------------------------------------------------------------------------------------
// 2. Load and normalise deck.json
// --------------------------------------------------------------------------------------

function isPlaceholder(v) {
  return typeof v === 'string' && (v.trim().toLowerCase() === PLACEHOLDER || v.trim().toLowerCase() === '[needs detail]');
}

function hasPlaceholder(v) { return typeof v === 'string' && /\[needs (?:number|detail)\]/i.test(v); }

function asArray(v) { return Array.isArray(v) ? v : (v == null ? [] : [v]); }

function normaliseDeck(raw, ctx) {
  const meta = Object.assign({ company: 'Untitled', theme: 'paper', aspect: '16:9', variant: 'present', show_sources: true }, raw.meta || {});
  meta.variant = String(meta.variant).toLowerCase() === 'read' ? 'read' : 'present';
  ctx.variant = meta.variant;
  const slides = asArray(raw.slides).map((s, i) => normaliseSlide(s, i, ctx));
  // Auto-generated sources appendix unless the deck has a sources slide of its own.
  // meta.sources: "compact" (default, one row per source file), "full" (one row per
  // ledger id) or "none"; the older meta.show_sources: false also means none.
  const used = collectSources(slides);
  used.forEach((it, i) => { it.ref = i + 1; });
  ctx.sourceItems = used;
  ctx.refs = {};
  used.forEach((it) => { ctx.refs[it.id] = it.ref; });
  const mode = String(meta.sources || '').toLowerCase();
  meta.sources = mode === 'full' || mode === 'none' ? mode : (meta.show_sources === false ? 'none' : 'compact');
  const wantSources = meta.sources !== 'none';
  ctx.hasSourcesSlide = (wantSources && used.length > 0) || slides.some((s) => s.type === 'sources');
  if (wantSources && used.length && !slides.some((s) => s.type === 'sources')) {
    slides.push({ type: 'sources', title: 'Sources', auto: true, items: used, notes: '', points: [], stats: [], team: [], milestones: [], use_of_funds: [], rows: [], columns: [] });
  } else {
    slides.forEach((s) => { if (s.type === 'sources' && !s.items) s.items = used; });
  }
  return { meta, slides };
}

// Text shown in the speaker-notes overlay and written to the PPTX notes: the investor
// question the slide answers (never rendered on the slide) followed by the notes.
function notesText(s) {
  const parts = [];
  if (s.question) parts.push('Question: ' + String(s.question));
  if (s.notes) parts.push(String(s.notes));
  return parts.join('\n\n');
}

function normaliseSlide(s, i, ctx) {
  const out = Object.assign({}, s);
  out.type = String(s.type || 'statement').trim().toLowerCase().replace(/-/g, '_');   // accept go-to-market etc.
  if (!KNOWN_TYPES.includes(out.type)) {
    warn('slide ' + (i + 1) + ': unknown type "' + out.type + '", rendered as statement');
    out.unknownType = out.type;
    out.type = 'statement';
  }
  out.points = asArray(s.points);
  if (out.points.length > MAX_POINTS) {
    warn('slide ' + (i + 1) + ': ' + out.points.length + ' points, keeping the first ' + MAX_POINTS);
    out.points = out.points.slice(0, MAX_POINTS);
  }
  out.stats = asArray(s.stats);
  if (out.stats.length > MAX_STATS) {
    warn('slide ' + (i + 1) + ': ' + out.stats.length + ' stats, keeping the first ' + MAX_STATS);
    out.stats = out.stats.slice(0, MAX_STATS);
  }
  if (out.chart) {
    const c = out.chart;
    c.kind = ['bar', 'line', 'stacked_bar', 'area', 'horizontal_bar'].includes(c.kind) ? c.kind : 'bar';
    c.labels = asArray(c.labels).map(String);
    // null keeps a gap (actual vs projection series); anything else becomes a number
    c.series = asArray(c.series).map((se) => ({ name: se.name || '', values: asArray(se.values).map((v) => (v == null || v === '' ? null : (Number(v) || 0))) }));
    if (!c.series.length) { warn('slide ' + (i + 1) + ': chart without series, dropped'); delete out.chart; }
  }
  out.rows = asArray(s.rows);
  out.columns = asArray(s.columns);
  // Table header: accepted with or without the leading (empty) row-label cell.
  if (out.columns.length && out.rows.length && Array.isArray(out.rows[0]) && typeof out.columns[0] !== 'object' &&
      out.rows[0].length === out.columns.length + 1) out.columns = [''].concat(out.columns);
  out.use_of_funds = asArray(s.use_of_funds);
  // team: `team[]` objects or `rows[]` of [name, role, proof line]
  out.team = asArray(s.team);
  if (out.type === 'team' && !out.team.length && out.rows.length) {
    out.team = out.rows.map((r) => (Array.isArray(r) ? { name: r[0], role: r[1], bio: r[2], photo: r[3] } : r));
    out.rows = [];
  }
  // roadmap: `milestones[]` or `rows[]` of [date, milestone, what it proves]
  out.milestones = asArray(s.milestones);
  if (out.type === 'roadmap' && !out.milestones.length && out.rows.length) {
    out.milestones = out.rows.map((r) => (Array.isArray(r) ? { when: r[0], what: r[1], proves: r[2] } : r));
    out.rows = [];
  }
  // ask: use of funds may arrive as `chart{kind: stacked_bar}` (one bar, one series per
  // bucket) and milestones as `points[]`
  if (out.type === 'ask') {
    if (!out.use_of_funds.length && out.chart && out.chart.kind === 'stacked_bar') {
      out.use_of_funds = out.chart.series.map((se) => ({ label: se.name, pct: se.values[0] || 0, source: out.chart.source }));
      delete out.chart;
    }
    if (!out.milestones.length && out.points.length) { out.milestones = out.points; out.points = []; }
  }
  if (out.body && ctx.variant !== 'read') warn('slide ' + (i + 1) + ': `body` is only rendered in the read variant (meta.variant: "read")');
  // Record placeholders so the summary can list them.
  walkStrings(out, (v, where) => { if (hasPlaceholder(v)) ctx.placeholders.push('slide ' + (i + 1) + ' (' + out.type + '): ' + where); });
  return out;
}

function walkStrings(obj, fn, trail) {
  trail = trail || '';
  if (typeof obj === 'string') { fn(obj, trail); return; }
  if (Array.isArray(obj)) { obj.forEach((v, k) => walkStrings(v, fn, trail + '[' + k + ']')); return; }
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach((k) => { if (k !== 'html') walkStrings(obj[k], fn, trail ? trail + '.' + k : k); });
  }
}

function collectSources(slides) {
  const items = [];
  const seen = new Set();
  const add = (slideNo, title, src) => {
    if (Array.isArray(src)) { src.forEach((x) => add(slideNo, title, x)); return; }
    if (!src || typeof src !== 'string') return;
    const key = slideNo + '|' + src;
    if (seen.has(key)) return;
    seen.add(key);
    const m = src.match(/^(fact|assumption|projection):(.+)$/);
    items.push({ slide: slideNo, title: title || '', id: src, kind: m ? m[1] : '', ledgerId: m ? m[2] : src });
  };
  slides.forEach((s, i) => {
    add(i + 1, s.title, s.source);
    s.stats.forEach((st) => add(i + 1, s.title, st && st.source));
    if (s.chart) add(i + 1, s.title, s.chart.source);
    s.use_of_funds.forEach((u) => add(i + 1, s.title, u && u.source));
  });
  // Deduplicate by id, keep slide order, list every slide that uses the id.
  const byId = new Map();
  items.forEach((it) => {
    if (byId.has(it.id)) { byId.get(it.id).slide += ', ' + it.slide; return; }
    byId.set(it.id, Object.assign({}, it, { slide: String(it.slide) }));
  });
  return Array.from(byId.values());
}

// "2 to 6, 9, 12" from a list of slide numbers.
function compressNumbers(nums) {
  const a = Array.from(new Set(nums)).filter((n) => isFinite(n)).sort((x, y) => x - y);
  const out = [];
  for (let i = 0; i < a.length; i++) {
    let j = i;
    while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
    out.push(j - i >= 2 ? a[i] + ' to ' + a[j] : a.slice(i, j + 1).join(', '));
    i = j;
  }
  return out.join(', ');
}

// Compact sources appendix: one row per source file with its figure count and slides.
function groupSourcesByFile(items) {
  const groups = new Map();
  items.forEach((it) => {
    (it.files && it.files.length ? it.files : ['Not in the ledger yet']).forEach((file) => {
      if (!groups.has(file)) groups.set(file, { file, count: 0, kinds: {}, slides: [] });
      const g = groups.get(file);
      g.count += 1;
      if (it.kind) g.kinds[it.kind] = (g.kinds[it.kind] || 0) + 1;
      String(it.slide).split(/,\s*/).forEach((n) => g.slides.push(Number(n)));
    });
  });
  return Array.from(groups.values()).map((g) => ({
    file: g.file, count: g.count,
    kinds: Object.keys(g.kinds).map((k) => g.kinds[k] + ' ' + k + (g.kinds[k] > 1 ? 's' : '')).join(', '),
    slides: compressNumbers(g.slides),
  }));
}
const SOURCE_FILES_PER_SLIDE = 11;
const SOURCE_FILE_PAGES = 2;        // the compact appendix never exceeds two slides

// A sources list longer than one slide is split into continuation slides.
const SOURCES_PER_SLIDE = 20;
const SOURCES_PAGE_PX = 600;        // table body height available under the title
// Estimated height of one ledger row at 19px type: the tallest of its wrapping cells.
function sourceRowPx(it) {
  const lines = (str, perLine) => Math.max(1, Math.ceil(String(str || '').length / perLine));
  const labelLines = lines(it.label, 42) + 1;                       // plus the "slide N" line
  const fileLines = lines((it.file || '').split('#')[0], 34) + (it.method ? lines(it.method, 38) : 0);
  const idLines = lines(it.id, 30);
  return Math.max(labelLines, fileLines, idLines, lines(it.value, 30)) * 24 + 20;
}
function paginateSources(slides) {
  const out = [];
  slides.forEach((s) => {
    if (s.type !== 'sources' || !s.items) { out.push(s); return; }
    if (s.groups) {
      // compact: at most two slides; the last row sums whatever does not fit
      let groups = s.groups;
      const max = SOURCE_FILES_PER_SLIDE * SOURCE_FILE_PAGES;
      if (groups.length > max) {
        const rest = groups.slice(max - 1);
        groups = groups.slice(0, max - 1).concat([{ file: rest.length + ' more files', count: rest.reduce((a, g) => a + g.count, 0), kinds: '', slides: '' }]);
      }
      const n = Math.ceil(groups.length / SOURCE_FILES_PER_SLIDE);
      for (let p = 0; p < n; p++) {
        out.push(Object.assign({}, s, { groups: groups.slice(p * SOURCE_FILES_PER_SLIDE, (p + 1) * SOURCE_FILES_PER_SLIDE), title: (s.title || 'Sources') + (n > 1 ? ' (' + (p + 1) + ' of ' + n + ')' : '') }));
      }
      return;
    }
    const pages = [];
    let page = [];
    let used = 0;
    s.items.forEach((it) => {
      const h = s.rich ? sourceRowPx(it) : 44;
      const full = s.rich ? used + h > SOURCES_PAGE_PX : page.length >= SOURCES_PER_SLIDE;
      if (page.length && full) { pages.push(page); page = []; used = 0; }
      page.push(it); used += h;
    });
    if (page.length) pages.push(page);
    if (pages.length <= 1) { out.push(s); return; }
    pages.forEach((items, p) => out.push(Object.assign({}, s, { items, title: (s.title || 'Sources') + ' (' + (p + 1) + ' of ' + pages.length + ')' })));
  });
  return out;
}

// Minimal reader for facts.yaml (the flat `facts:` list described in file-formats.md).
// Enough to print label, value, unit, kind, as_of and file on the sources slide; it is
// not a general YAML parser and ledger_check.py remains the authority on the ledger.
function readFactsYaml(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return null; }
  const facts = {};
  const top = {};
  let cur = null;
  let inFacts = false;
  text.split(/\r?\n/).forEach((line) => {
    if (!line.trim() || line.trim().startsWith('#')) return;
    const clean = line.replace(/\s+#.*$/, '');
    if (/^facts:\s*$/.test(clean)) { inFacts = true; return; }
    if (!inFacts) {
      const m = clean.match(/^(\w+):\s*(.*)$/);
      if (m) top[m[1]] = unquote(m[2]);
      return;
    }
    let m = clean.match(/^\s*-\s+(\w+):\s*(.*)$/);
    if (m) { cur = {}; cur[m[1]] = unquote(m[2]); if (cur.id) facts[cur.id] = cur; return; }
    m = clean.match(/^\s+(\w+):\s*(.*)$/);
    if (m && cur) { cur[m[1]] = unquote(m[2]); if (m[1] === 'id') facts[cur.id] = cur; }
  });
  return { top, facts };
}
function unquote(v) { v = String(v).trim(); const m = v.match(/^(["'])(.*)\1$/); return m ? m[2] : v; }

function fmtFactValue(f) {
  if (f.value == null || f.value === '') return '';
  const n = Number(f.value);
  const v = isFinite(n) && String(f.value).trim() !== '' ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(f.value);
  return v + (f.unit ? ' ' + f.unit : '');
}

// Files behind a ledger entry: its own source file, or for a derived value the files
// of the entries its expression names (followed up to four levels). null when none.
function ledgerFiles(key, ledger, depth) {
  const f = ledger.facts[key];
  if (!f) return null;
  if (f.source) return [String(f.source).split('#')[0]];
  const out = [];
  if (f.derived_from && (depth || 0) < 4) {
    (String(f.derived_from).match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).forEach((id) => {
      (ledgerFiles(id, ledger, (depth || 0) + 1) || []).forEach((x) => { if (!out.includes(x)) out.push(x); });
    });
  }
  if (!out.length) {
    // a derived entry often names its file only in the note ("sum of 13 weeks in data/kpis-weekly.csv")
    const m = (String(f.note || '') + ' ' + String(f.method || '')).match(/[\w.\/-]+\.(csv|xlsx?|md|pdf|docx?|pptx?|txt|json|ya?ml|tsv)\b/gi);
    (m || []).forEach((x) => { if (!out.includes(x)) out.push(x); });
  }
  return out.length ? out : null;
}

// Enrich the sources list with the ledger when facts.yaml is available.
function attachLedger(items, ledger, ctx) {
  if (!ledger) return;
  items.forEach((it) => {
    const f = ledger.facts[it.ledgerId];
    if (!f) { ctx.missingFacts.push('slide ' + it.slide + ': ' + it.id); return; }
    it.files = f.cite_as ? [String(f.cite_as)]
      : (ledgerFiles(it.ledgerId, ledger) || ['Ledger entries without a source file']).map((x) => (/^founder statement/i.test(x) ? 'company statement' : x));
    it.label = f.label || '';
    it.value = fmtFactValue(f);
    it.kind = f.kind || it.kind;
    it.asOf = f.as_of || ledger.top.as_of || '';
    it.file = f.cite_as ? String(f.cite_as) : (f.source || (f.derived_from ? 'derived: ' + f.derived_from : ''));
    it.method = f.kind === 'fact' ? '' : String(f.method || (f.assumes ? 'assumes ' + f.assumes : '') || '');
    if (it.method.length > 90) it.method = it.method.slice(0, 87) + '...';
    if (it.value.length > 48) it.value = it.value.slice(0, 45) + '...';
    if (it.kind && f.kind && it.kind !== f.kind) ctx.kindMismatch.push('slide ' + it.slide + ': ' + it.id + ' is kind "' + f.kind + '" in the ledger');
  });
}

// --------------------------------------------------------------------------------------
// 3. Theme tokens (parsed from assets/deck-template/themes.css)
// --------------------------------------------------------------------------------------

const THEMES_CSS_PATH = path.join(__dirname, '..', 'assets', 'deck-template', 'themes.css');

// Minimal stand-in so the builder still works if themes.css is missing.
const FALLBACK_THEMES_CSS = `[data-theme="paper"] {
  --bg: #F6F4EF; --ink: #1F2429; --muted: #6B7178; --accent: #1F6F5B; --accent-2: #B8862B;
  --surface: #ECE8DF; --rule: #D8D3C8;
  --font-display: "Albert Sans", "Helvetica Neue", Arial, sans-serif;
  --font-body: "Albert Sans", "Helvetica Neue", Arial, sans-serif;
  --chart-1: #1F6F5B; --chart-2: #B8862B; --chart-3: #6FA392; --chart-4: #9A9A93; --chart-5: #CFC9BC;
  --pptx-display: Calibri; --pptx-body: Calibri; --gfonts: "Albert Sans:wght@400;500;600;700";
  --display-weight: 600; --display-tracking: -0.025em;
}`;

function loadThemesCss() {
  try { return fs.readFileSync(THEMES_CSS_PATH, 'utf8'); } catch (e) {
    warn('themes.css not found at ' + THEMES_CSS_PATH + ', using the built-in paper theme');
    return FALLBACK_THEMES_CSS;
  }
}

function parseThemeTokens(css, name) {
  const re = new RegExp('\\[data-theme="' + name + '"\\]\\s*\\{([^}]*)\\}');
  const m = css.match(re);
  if (!m) return null;
  const tokens = {};
  // A quoted value may contain semicolons (the --gfonts weight lists), so match quotes whole.
  m[1].replace(/--([\w-]+)\s*:\s*("[^"]*"|[^;]+);/g, (_, k, v) => {
    v = v.trim();
    const q = v.match(/^"([^"]*)"$/);
    tokens[k] = q ? q[1] : v;
    return '';
  });
  return tokens;
}

function isHex(v) { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()); }

function resolveTheme(meta, css) {
  let name = String(meta.theme || 'paper').toLowerCase();
  let tokens = parseThemeTokens(css, name);
  if (!tokens) {
    warn('theme "' + name + '" not found in themes.css, falling back to paper');
    name = 'paper';
    tokens = parseThemeTokens(css, 'paper') || parseThemeTokens(FALLBACK_THEMES_CSS, 'paper');
  }
  const overrides = {};
  if (meta.accent) {
    if (isHex(meta.accent)) { overrides.accent = meta.accent.trim().toUpperCase(); overrides['chart-1'] = overrides.accent; }
    else warn('meta.accent "' + meta.accent + '" is not a 6-digit hex colour, ignored');
  }
  const gfonts = tokens.gfonts ? tokens.gfonts.split('|') : [];
  const fontOverride = (key, family) => {
    if (!family) return;
    const fam = String(family).trim();
    const tail = tokens[key].replace(/^"[^"]*",\s*/, '');
    overrides[key] = '"' + fam + '", ' + tail;
    gfonts.push(fam + ':wght@400;500;600;700');
  };
  fontOverride('font-display', meta.font_display);
  fontOverride('font-body', meta.font_body);
  const resolved = Object.assign({}, tokens, overrides);
  resolved.gfontsList = gfonts;
  resolved.webDisplay = firstFamily(resolved['font-display']);
  resolved.webBody = firstFamily(resolved['font-body']);
  return { name, tokens: resolved, overrides };
}

function firstFamily(stack) {
  const m = String(stack || '').match(/^"([^"]+)"/);
  return m ? m[1] : String(stack || '').split(',')[0].trim();
}

// --------------------------------------------------------------------------------------
// 4. HTML renderer
// --------------------------------------------------------------------------------------

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Text that may contain "[needs number]": each occurrence renders as a marked slot,
// whether it is the whole value or sits inside a longer sentence.
const slotHtml = (token) => '<span class="needs" title="Missing, fill in deck.json">' + (/detail/i.test(token) ? 'needs detail' : 'needs number') + '</span>';
function txt(v) {
  if (v == null) return '';
  const str = String(v);
  if (!hasPlaceholder(str)) return esc(str);
  return str.split(/(\[needs (?:number|detail)\])/i).map((part) => (isPlaceholder(part) ? slotHtml(part) : esc(part))).join('');
}

// Decimals (0 to 3) needed to show x without misstating it: 1.18 keeps two, 41 none.
function decimalsFor(x) {
  let d = 0;
  while (d < 3 && Math.abs(Number(x.toFixed(d)) - x) > Math.abs(x) * 0.0002) d++;
  return d;
}
// A figure as it is in the data: k, M and B above ten thousand, never rounded to a
// different value (1.18 stays 1.18, 1,265,000 is 1.265M).
function fmtNum(n) {
  if (!isFinite(n)) return '';
  const abs = Math.abs(n);
  let div = 1;
  let suffix = '';
  if (abs >= 1e9) { div = 1e9; suffix = 'B'; } else if (abs >= 1e6) { div = 1e6; suffix = 'M'; } else if (abs >= 1e4) { div = 1e3; suffix = 'k'; }
  const x = n / div;
  const d = decimalsFor(x);
  return Number(x.toFixed(d)).toLocaleString('en-US', { maximumFractionDigits: d }) + suffix;
}

// Axis ticks from zero on 1-2-5 steps (at most five intervals); whole-number steps
// when every value is a whole number, so a count axis never reads 12.5.
function niceTicks(max, allInt) {
  if (!(max > 0)) return [0, 1];
  const raw = max / 5;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  let step = [1, 2, 5, 10].map((m) => m * exp).find((c) => c >= raw - 1e-12);
  if (allInt) step = Math.max(1, Math.round(step));
  const n = Math.ceil(max / step - 1e-9);
  const ticks = [];
  for (let k = 0; k <= n; k++) ticks.push(Number((k * step).toPrecision(12)));
  return ticks;
}

// Inline SVG chart. Colours reference the theme palette through CSS variables so the
// same markup follows the theme; the y axis always starts at zero.
function svgChart(chart, W, H) {
  const kind = chart.kind;
  const series = chart.series;
  const labels = chart.labels;
  const n = Math.max(labels.length, ...series.map((s) => s.values.length));
  const multi = series.length > 1;
  const stacked = kind === 'stacked_bar';
  const horizontal = kind === 'horizontal_bar';
  const showValues = !!chart.show_values;

  const has = (s, i) => s.values[i] != null;      // null values leave a gap (actual vs projection)
  let maxVal = 0;
  for (let i = 0; i < n; i++) {
    if (stacked) maxVal = Math.max(maxVal, series.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0));
    else series.forEach((s) => { maxVal = Math.max(maxVal, s.values[i] || 0); });
  }
  const allInt = series.every((s) => s.values.every((x) => x == null || Number.isInteger(x)));
  const ticks = niceTicks(maxVal, allInt);
  const top = ticks[ticks.length - 1];

  const padL = horizontal ? 300 : 110;
  const padR = horizontal ? 120 : 28;
  const fs = 22;
  // Legend: one entry per series, wrapped onto as many rows as the names need (never cut).
  const legend = [];
  if (multi) {
    let lx = padL;
    let row = 0;
    series.forEach((s, k) => {
      const w = 28 + (HCTX && HCTX.faces ? textPx(s.name, HCTX.faces.body, fs) * 1.02 : s.name.length * fs * 0.52) + 44;
      if (lx > padL && lx + w > W - padR + 44) { lx = padL; row += 1; }
      legend.push({ x: lx, row, k, name: s.name });
      lx += w;
    });
  }
  const legendRows = legend.length ? legend[legend.length - 1].row + 1 : 0;
  const padT = 70 + legendRows * 38;
  const padB = horizontal ? 56 : 64;
  const pw = W - padL - padR;
  const ph = H - padT - padB;
  const out = [];
  out.push('<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" preserveAspectRatio="xMinYMin meet" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(series.map((s) => s.name).join(', ')) + '" style="font-family:var(--font-body);font-variant-numeric:tabular-nums">');

  // Header row: y label left, legend right.
  if (chart.y_label) out.push('<text x="' + padL + '" y="34" font-size="' + fs + '" style="fill:var(--muted)">' + esc(chart.y_label) + '</text>');
  legend.forEach((it) => {
    const y = 62 + it.row * 38;
    out.push('<rect x="' + it.x.toFixed(0) + '" y="' + y + '" width="18" height="18" rx="2" style="fill:var(--chart-' + (it.k + 1) + ')"/>');
    out.push('<text x="' + (it.x + 28).toFixed(0) + '" y="' + (y + 16) + '" font-size="' + fs + '" style="fill:var(--muted)">' + esc(it.name) + '</text>');
  });

  if (horizontal) {
    // Value axis along the bottom, categories down the left.
    const x0 = padL;
    const xOf = (v) => x0 + (v / top) * pw;
    ticks.forEach((t) => {
      const x = xOf(t);
      out.push('<line x1="' + x + '" y1="' + padT + '" x2="' + x + '" y2="' + (padT + ph) + '" style="stroke:var(--rule)" stroke-width="1"/>');
      out.push('<text x="' + x + '" y="' + (padT + ph + 36) + '" text-anchor="middle" font-size="' + fs + '" style="fill:var(--muted)">' + fmtNum(t) + '</text>');
    });
    const gh = ph / n;
    const bh = Math.min(56, (gh * 0.7) / (stacked ? 1 : series.length));
    for (let i = 0; i < n; i++) {
      const cy = padT + gh * i + gh / 2;
      out.push('<text x="' + (padL - 24) + '" y="' + (cy + 8) + '" text-anchor="end" font-size="' + fs + '" style="fill:var(--ink)">' + esc(labels[i] || '') + '</text>');
      const groupTop = cy - (bh * series.length) / 2;
      series.forEach((s, k) => {
        if (!has(s, i)) return;
        const v = Math.max(0, s.values[i] || 0);
        const y = groupTop + k * bh;
        out.push('<rect x="' + x0 + '" y="' + y.toFixed(1) + '" width="' + (xOf(v) - x0).toFixed(1) + '" height="' + (bh - 4).toFixed(1) + '" style="fill:var(--chart-' + (k + 1) + ')"/>');
        if (showValues) out.push('<text x="' + (xOf(v) + 14) + '" y="' + (y + bh / 2 + 6) + '" font-size="' + fs + '" style="fill:var(--ink)">' + fmtNum(v) + '</text>');
      });
    }
    out.push('<line x1="' + x0 + '" y1="' + padT + '" x2="' + x0 + '" y2="' + (padT + ph) + '" style="stroke:var(--muted)" stroke-width="1.5"/>');
    out.push('</svg>');
    return out.join('');
  }

  // Vertical charts: gridlines and y labels.
  const yOf = (v) => padT + ph - (v / top) * ph;
  ticks.forEach((t) => {
    const y = yOf(t);
    out.push('<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" style="stroke:var(--rule)" stroke-width="1"/>');
    out.push('<text x="' + (padL - 18) + '" y="' + (y + 8).toFixed(1) + '" text-anchor="end" font-size="' + fs + '" style="fill:var(--muted)">' + fmtNum(t) + '</text>');
  });
  const gw = pw / n;
  const cx = (i) => padL + gw * i + gw / 2;
  labels.forEach((lab, i) => {
    out.push('<text x="' + cx(i).toFixed(1) + '" y="' + (padT + ph + 40) + '" text-anchor="middle" font-size="' + fs + '" style="fill:var(--muted)">' + esc(lab) + '</text>');
  });

  if (kind === 'bar' || stacked) {
    // Grouped bars share a slot; when series never overlap on the same label (an
    // actual series followed by a projection series) each label shows one bar.
    const overlap = !stacked && series.length > 1 && labels.some((_, i) => series.filter((s) => has(s, i)).length > 1);
    const perSlot = stacked || !overlap ? 1 : series.length;
    const bw = stacked ? Math.min(120, gw * 0.6) : Math.min(perSlot === 1 ? 120 : 96, (gw * 0.72) / perSlot);
    for (let i = 0; i < n; i++) {
      let acc = 0;
      series.forEach((s, k) => {
        if (!has(s, i)) return;
        const v = Math.max(0, s.values[i] || 0);
        const x = perSlot === 1 ? cx(i) - bw / 2 : cx(i) - (bw * series.length) / 2 + k * bw;
        const y1 = yOf(stacked ? acc + v : v);
        const h = (yOf(stacked ? acc : 0) - y1);
        out.push('<rect x="' + x.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + (bw - 6).toFixed(1) + '" height="' + h.toFixed(1) + '" style="fill:var(--chart-' + (k + 1) + ')"/>');
        if (showValues && !stacked) out.push('<text x="' + (x + (bw - 6) / 2).toFixed(1) + '" y="' + (y1 - 12).toFixed(1) + '" text-anchor="middle" font-size="' + fs + '" style="fill:var(--ink)">' + fmtNum(v) + '</text>');
        if (showValues && stacked && h > 34) out.push('<text x="' + (x + (bw - 6) / 2).toFixed(1) + '" y="' + (y1 + h / 2 + 8).toFixed(1) + '" text-anchor="middle" font-size="' + (fs - 2) + '" style="fill:var(--bg)">' + fmtNum(v) + '</text>');
        acc += v;
      });
      if (showValues && stacked) out.push('<text x="' + cx(i).toFixed(1) + '" y="' + (yOf(acc) - 12).toFixed(1) + '" text-anchor="middle" font-size="' + fs + '" style="fill:var(--ink)">' + fmtNum(acc) + '</text>');
    }
  } else {
    // line or area
    series.forEach((s, k) => {
      const pts = [];
      for (let i = 0; i < n; i++) if (has(s, i)) pts.push([cx(i), yOf(Math.max(0, s.values[i] || 0)), i]);
      if (!pts.length) return;
      const poly = pts.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
      if (kind === 'area') {
        const base = yOf(0).toFixed(1);
        out.push('<polygon points="' + pts[0][0].toFixed(1) + ',' + base + ' ' + poly + ' ' + pts[pts.length - 1][0].toFixed(1) + ',' + base + '" style="fill:var(--chart-' + (k + 1) + ')" opacity="0.18"/>');
      }
      out.push('<polyline points="' + poly + '" fill="none" style="stroke:var(--chart-' + (k + 1) + ')" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>');
      if (n <= 14) pts.forEach((p) => out.push('<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="7" style="fill:var(--chart-' + (k + 1) + ')"/>'));
      if (showValues) pts.forEach((p) => out.push('<text x="' + p[0].toFixed(1) + '" y="' + (p[1] - 18).toFixed(1) + '" text-anchor="middle" font-size="' + fs + '" style="fill:var(--ink)">' + fmtNum(s.values[p[2]] || 0) + '</text>'));
    });
  }
  out.push('<line x1="' + padL + '" y1="' + yOf(0).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + yOf(0).toFixed(1) + '" style="stroke:var(--muted)" stroke-width="1.5"/>');
  out.push('</svg>');
  return out.join('');
}

function chartBlock(chart, W, H, slideSource) {
  if (!chart) return '';
  const cap = chart.source ? captionHtml([chart.source, slideSource], HCTX) : '';
  const src = cap ? '<p class="chart-source">' + cap + '</p>' : '<p class="chart-source needs-src">Source: <span class="needs">needs source</span></p>';
  return '<div class="chart-wrap">' + svgChart(chart, W, H) + src + '</div>';
}

// ---- small building blocks -----------------------------------------------------------

function headBlock(s, cls, ctx) {
  let h = '<header class="head' + (cls ? ' ' + cls : '') + '">';
  if (s.kicker) h += '<p class="kicker">' + txt(s.kicker) + '</p>';
  if (s.title) h += '<h1 class="title">' + txt(s.title) + '</h1>';
  if (s.subtitle) h += '<p class="subtitle">' + txt(s.subtitle) + '</p>';
  if (s.body && ctx && ctx.variant === 'read') h += '<p class="body-text">' + txt(s.body) + '</p>';
  return h + '</header>';
}

// Human caption for one or more source references. Investors never see a raw ledger id
// on a content slide: with a ledger the entry's source file is shown (its label when the
// value is derived); without one a superscript number points at the sources slide, which
// keeps the ids. Last resort: the id without its prefix, underscores as spaces.
function describeSource(src, ctx) {
  const ids = [];
  const flat = (x) => { if (Array.isArray(x)) x.forEach(flat); else if (typeof x === 'string' && x.trim() && !isPlaceholder(x)) ids.push(x); };
  flat(src);
  let texts = [];
  let notes = [];
  let unsourced = 0;          // ledger entries with neither a file nor a derivation that leads to one
  const add = (t) => { if (!texts.includes(t)) texts.push(t); };
  ids.forEach((id) => {
    const key = id.replace(/^(fact|assumption|projection):/, '');
    const f = ctx && ctx.ledger && ctx.ledger.facts[key];
    if (f) {
      // `cite_as` in the ledger replaces the file path in captions (use it when a file name
      // would reveal something, such as a customer's name). Founder statements have no file.
      if (f.cite_as) { add(String(f.cite_as)); return; }
      const files = ledgerFiles(key, ctx.ledger);
      if (files) files.forEach((x) => add(/^founder statement/i.test(x) ? 'company statement' : x)); else unsourced += 1;
      return;
    }
    if (ctx && ctx.ledger) return;      // id missing from the ledger: the build log reports it, the slide shows nothing
    if (ctx && !ctx.ledger && ctx.hasSourcesSlide && ctx.refs && ctx.refs[id]) { if (!notes.includes(ctx.refs[id])) notes.push(ctx.refs[id]); return; }
    add(key.replace(/_/g, ' '));
  });
  if (unsourced && !texts.length && !notes.length) add('fact ledger (facts.yaml)');
  // At most three entries; the rest is counted and left to the sources appendix.
  const total = texts.length + notes.length;
  texts = texts.slice(0, CAPTION_MAX);
  notes = notes.slice(0, CAPTION_MAX - texts.length);
  const more = total - texts.length - notes.length;
  const tail = more > 0 ? ' and ' + more + ' more' + (ctx && ctx.hasSourcesSlide ? ', see sources' : '') : '';
  const sups = notes.map((n) => '<sup class="fn">' + n + '</sup>').join('');
  return {
    texts, notes,
    html: texts.map(esc).join(', ') + (notes.length ? (texts.length ? ' ' : '') + sups : '') + tail,
    text: texts.join(', ') + (notes.length ? (texts.length ? ' ' : '') + '[' + notes.join(', ') + ']' : '') + tail,
    sups: sups + tail,
  };
}
const CAPTION_MAX = 3;
// Slide types that draw `chart`; on those the chart caption is the single slide caption.
const CHART_TYPES = ['traction', 'financials', 'appendix', 'case_study'];
// "Source: notes/bom-estimate.md" or "Source: sources slide 3" (HTML and plain text).
function captionHtml(src, ctx) {
  const d = describeSource(src, ctx);
  if (!d.texts.length && !d.notes.length) return '';
  return 'Source: ' + (d.texts.length ? d.html : 'sources slide ' + d.sups);
}
function captionText(src, ctx) {
  const d = describeSource(src, ctx);
  if (!d.texts.length && !d.notes.length) return '';
  return 'Source: ' + (d.texts.length ? d.text : 'sources slide ' + d.text);
}
// A stat's source in the read variant: a caption line when it resolves to text, otherwise
// a footnote marker appended to the label. Nothing at all in the present variant.
function statSourceParts(st, ctx) {
  if (!ctx || ctx.variant !== 'read' || !st.source) return { line: '', sup: '', text: '', mark: '' };
  const d = describeSource(st.source, ctx);
  if (d.texts.length) return { line: d.html, sup: '', text: d.text, mark: '' };
  return { line: '', sup: d.sups, text: '', mark: d.notes.length ? ' [' + d.notes.join(', ') + ']' : '' };
}

// Rendering context for the HTML pass (set in buildHtml), so block helpers can read
// the variant, the ledger and the footnote numbers without threading ctx everywhere.
let HCTX = null;

// Slide-level source caption above the footer, in both variants.
function sourceLine(s, ctx) {
  if (!s.source || (s.chart && CHART_TYPES.includes(s.type))) return '';
  const cap = captionHtml(s.source, ctx);
  return cap ? '<p class="slide-source">' + cap + '</p>' : '';
}

function pointsBlock(points, cls) {
  if (!points || !points.length) return '';
  return '<ul class="points' + (cls ? ' ' + cls : '') + '">' + points.map((p) => '<li>' + txt(p) + '</li>').join('') + '</ul>';
}

// Display figures and capitals measure up to 0.66em per character in the widest theme
// face (Sora). A value that would not fit its column of w px on one line is set smaller
// (never below 40px); values are never wrapped.
function fitSize(value, w, size) {
  const str = isPlaceholder(value) ? 'needs num' : String(value == null ? '' : value);
  // HTML: measured in the deck's display face; PPTX (safe fonts) and fallback: 0.66em per character
  // (stat values use tabular figures, so every digit is as wide as the widest one)
  let natural = Math.max(1, str.length) * 0.66 * size;
  if (HCTX && HCTX.faces) {
    const f = HCTX.faces.display;
    const digit = Math.max(...'0123456789'.split('').map((d) => textPx(d, f, size)));
    natural = (textPx(str.replace(/\d/g, ''), f, size) + (str.match(/\d/g) || []).length * digit) * 1.04;
  }
  return Math.max(40, Math.min(size, Math.floor((size * w) / Math.max(1, natural))));
}

// w and size (column width and base font size in px) switch on value fitting.
function statsBlock(stats, cls, w, size) {
  if (!stats || !stats.length) return '';
  return '<div class="stats' + (cls ? ' ' + cls : '') + '">' + stats.map((st) => {
    const sp = statSourceParts(st, HCTX);
    const fit = w ? ' style="font-size:' + fitSize(st.value, w, size) + 'px"' : '';
    return '<div class="stat"><div class="stat-v"' + fit + '>' + txt(st.value) + '</div>' +
      (st.label || sp.sup ? '<div class="stat-l">' + txt(st.label) + sp.sup + '</div>' : '') +
      (sp.line ? '<div class="stat-s">' + sp.line + '</div>' : '') + '</div>';
  }).join('') + '</div>';
}

function tableBlock(columns, rows, company) {
  if (!rows.length) return '';
  const cols = columns.length ? columns : rows[0].map((_, i) => (i === 0 ? '' : 'Col ' + i));
  const check = '<svg class="ck" viewBox="0 0 24 24" width="30" height="30" aria-label="yes"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const cell = (v, j) => {
    if (v === true || v === 'yes' || v === 'true') return '<td class="c">' + check + '</td>';
    if (v === false || v === 'no' || v === 'false' || v === '' || v == null) return '<td class="c"><span class="no">' + (j === 0 ? '' : '–') + '</span></td>';
    return '<td' + (j === 0 ? ' class="rowhead"' : '') + '>' + txt(v) + '</td>';
  };
  let h = '<table class="tbl"><thead><tr>' + cols.map((c) => '<th>' + txt(c) + '</th>').join('') + '</tr></thead><tbody>';
  rows.forEach((r) => {
    const cells = Array.isArray(r) ? r : (r.cells || [r.name].concat(asArray(r.values)));
    const us = company && String(cells[0]).toLowerCase() === String(company).toLowerCase();
    h += '<tr' + (us ? ' class="us"' : '') + '>' + cells.map(cell).join('') + '</tr>';
  });
  return h + '</tbody></table>';
}

// Up to three points side by side, each under a small accent mark.
function columnsBlock(points) {
  const shown = points.slice(0, 3);
  const n = Math.max(1, shown.length);
  return '<div class="cols cols-' + n + '">' + shown.map((p) => '<div class="pt"><span class="mark"></span>' + txt(p) + '</div>').join('') + '</div>' +
    pointsBlock(points.slice(3), 'compact under');
}

function imgTag(src, cls, alt) {
  if (!src) return '';
  return '<img class="' + (cls || '') + '" src="' + esc(src) + '" alt="' + esc(alt || '') + '">';
}

// ---- slide renderers -----------------------------------------------------------------
// Each returns the inner HTML of a slide. ctx carries meta, resolved images, and totals.

const HTML_RENDERERS = {
  cover(s, ctx) {
    const logo = ctx.logo || ctx.image;    // cover `image` is an alternative logo slot
    const facts = s.stats.length ? '<div class="cover-facts">' + s.stats.slice(0, 3).map((st) =>
      '<div class="stat"><div class="stat-v">' + txt(st.value) + '</div><div class="stat-l">' + txt(st.label) + '</div></div>').join('') + '</div>' : '';
    return '<div class="cover-wrap">' +
      (logo ? imgTag(logo, 'cover-logo', ctx.meta.company + ' logo') : '<div class="cover-mark">' + esc(ctx.meta.company) + '</div>') +
      '<div class="cover-main' + (facts ? ' has-facts' : '') + '">' +
      (s.kicker ? '<p class="kicker">' + txt(s.kicker) + '</p>' : '') +
      '<h1 class="cover-title">' + txt(s.title || ctx.meta.company) + '</h1>' +
      (s.subtitle || ctx.meta.tagline ? '<p class="cover-sub">' + txt(s.subtitle || ctx.meta.tagline) + '</p>' : '') +
      facts + '</div></div>';
  },

  problem(s, ctx) {
    // Headline across the top; below it the one big number (or two) beside the points.
    // With an image the points sit beside the picture; with neither the points stand alone.
    const stats = s.stats.slice(0, 2);
    if (ctx.image) {
      return headBlock(s, '', ctx) + '<div class="grid-2 fill">' + pointsBlock(s.points, 'compact') +
        '<div class="frame fillh">' + imgTag(ctx.image, 'fit', s.title) + '</div></div>' + sourceLine(s, ctx);
    }
    if (!stats.length) return headBlock(s, '', ctx) + '<div class="grid-2 problem"><div class="col wide">' + pointsBlock(s.points) + '</div></div>' + sourceLine(s, ctx);
    const two = stats.length > 1;
    return headBlock(s, '', ctx) + '<div class="grid-2 problem">' +
      '<div class="col">' + statsBlock(stats, 'big' + (two ? ' two' : ''), two ? 366 : 780, two ? 120 : 168) + '</div>' +
      '<div class="col">' + pointsBlock(s.points) + '</div></div>' + sourceLine(s, ctx);
  },

  solution(s, ctx) {
    if (ctx.image) {
      return headBlock(s, '', ctx) + '<div class="grid-2 narrow fill">' + pointsBlock(s.points) + '<div class="frame fillh">' + imgTag(ctx.image, 'fit', s.title) + '</div></div>' + sourceLine(s, ctx);
    }
    return headBlock(s, '', ctx) + columnsBlock(s.points) + sourceLine(s, ctx);
  },

  product(s, ctx) {
    // With an image: proof points beside the picture. Without one the points take the
    // full width as columns; there is never an empty frame.
    if (!ctx.image) return headBlock(s, '', ctx) + columnsBlock(s.points) + sourceLine(s, ctx);
    return headBlock(s, '', ctx) + '<div class="prod">' + pointsBlock(s.points, 'compact') +
      '<div class="frame fillh">' + imgTag(ctx.image, 'fit', s.title) + '</div></div>' + sourceLine(s, ctx);
  },

  insight(s, ctx) {
    // The claim is the slide; points and one supporting number sit below it.
    const stat = s.stats[0];
    const below = (s.points.length || stat)
      ? '<div class="insight-body' + (stat ? ' with-stat' : '') + '">' + pointsBlock(s.points, 'compact') + (stat ? statsBlock([stat], 'column', 440, 96) : '') + '</div>'
      : '';
    return '<div class="insight">' + (s.kicker ? '<p class="kicker">' + txt(s.kicker) + '</p>' : '') +
      '<h1 class="insight-title">' + txt(s.title) + '</h1>' +
      (s.subtitle ? '<p class="statement-sub">' + txt(s.subtitle) + '</p>' : '') +
      (s.body && ctx.variant === 'read' ? '<p class="body-text">' + txt(s.body) + '</p>' : '') +
      below + '</div>' + sourceLine(s, ctx);
  },

  market(s, ctx) {
    const widths = [100, 72, 50];
    const colW = s.points.length ? 1064 : 1680;
    const steps = s.stats.slice(0, 3).map((st, i) =>
      '<div class="step' + (i === Math.min(2, s.stats.length - 1) ? ' step-focus' : '') + '" style="width:' + widths[i] + '%">' +
      '<div class="stat-v" style="font-size:' + fitSize(st.value, colW * widths[i] / 100 - 72, 60) + 'px">' + txt(st.value) + '</div><div class="stat-l">' + txt(st.label) + statSourceParts(st, ctx).sup + '</div>' +
      (statSourceParts(st, ctx).line ? '<div class="step-m stat-s">' + statSourceParts(st, ctx).line + '</div>' : '') + '</div>').join('');
    const hasPoints = s.points.length > 0;
    return headBlock(s, '', ctx) + '<div class="market' + (hasPoints ? ' with-points' : '') + '">' +
      '<div class="steps">' + (steps || pointsBlock(s.points)) + '</div>' +
      (hasPoints && steps ? '<div class="side">' + pointsBlock(s.points, 'compact') + '</div>' : '') + '</div>' + sourceLine(s, ctx);
  },

  traction(s, ctx) {
    // The side column stacks stats and (with a chart) points; three or more items use
    // the smaller stat size so the column holds what the capacity table promises.
    const dense = s.stats.length + (s.chart ? s.points.length : 0) >= 3;
    return headBlock(s, '', ctx) + '<div class="trac">' +
      '<div class="chart-col">' + (s.chart ? chartBlock(s.chart, 1140, 600, s.source) : pointsBlock(s.points)) + '</div>' +
      '<div class="side">' + statsBlock(s.stats, 'column' + (dense ? ' dense' : ''), 440, dense ? 72 : 96) + (s.chart ? pointsBlock(s.points, 'compact') : '') + '</div></div>' + sourceLine(s, ctx);
  },

  business_model(s, ctx) {
    if (s.rows.length) return headBlock(s, '', ctx) + tableBlock(s.columns, s.rows, ctx.meta.company) + pointsBlock(s.points, 'compact under') + sourceLine(s, ctx);
    const n = Math.max(1, s.stats.length);
    return headBlock(s, '', ctx) + statsBlock(s.stats, 'row-' + n, Math.floor((1680 - 72 * (n - 1)) / n), n >= 4 ? 80 : 96) + pointsBlock(s.points, 'compact under') + sourceLine(s, ctx);
  },

  go_to_market(s, ctx) {
    const n = Math.max(1, s.points.length);
    return headBlock(s, '', ctx) + '<div class="flow flow-' + n + '">' + s.points.map((p, i) =>
      '<div class="flow-step"><div class="flow-n">' + (i + 1) + '</div><div class="flow-t">' + txt(p) + '</div></div>').join('') + '</div>' +
      (s.stats.length ? statsBlock(s.stats.slice(0, 2), 'row-2 under', 514, 96) : '') + sourceLine(s, ctx);
  },

  competition(s, ctx) {
    if (s.rows.length) return headBlock(s, '', ctx) + tableBlock(s.columns, s.rows, ctx.meta.company) + pointsBlock(s.points.slice(0, 1), 'compact under') + sourceLine(s, ctx);
    return headBlock(s, '', ctx) + pointsBlock(s.points) + sourceLine(s, ctx);
  },

  team(s, ctx) {
    const n = Math.min(4, Math.max(2, s.team.length));
    const initials = (name) => String(name || '').split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();
    return headBlock(s, '', ctx) + '<div class="team team-' + n + '">' + s.team.slice(0, 4).map((m, i) => {
      const photo = ctx.teamPhotos[i] ? imgTag(ctx.teamPhotos[i], 'photo', m.name) : '<span>' + esc(initials(m.name)) + '</span>';
      return '<div class="member"><div class="avatar">' + photo + '</div>' +
        '<div class="m-name">' + txt(m.name) + '</div>' +
        (m.role ? '<div class="m-role">' + txt(m.role) + '</div>' : '') +
        (m.bio ? '<div class="m-bio">' + txt(m.bio) + '</div>' : '') + '</div>';
    }).join('') + '</div>' + (s.points.length ? '<p class="team-note">' + txt(s.points[0]) + '</p>' : '') + sourceLine(s, ctx);
  },

  financials(s, ctx) {
    if (s.rows.length && !s.chart) return headBlock(s, '', ctx) + tableBlock(s.columns, s.rows, ctx.meta.company) + pointsBlock(s.points, 'compact under') + sourceLine(s, ctx);
    return headBlock(s, '', ctx) + '<div class="fin">' +
      '<div class="chart-col">' + chartBlock(s.chart, 1080, 560, s.source) + '</div>' +
      '<div class="side"><p class="side-label">Drivers</p>' + pointsBlock(s.points, 'compact') + statsBlock(s.stats, 'column small', 500, 64) + '</div></div>' + sourceLine(s, ctx);
  },

  ask(s, ctx) {
    const funds = s.use_of_funds;
    const total = funds.reduce((a, u) => a + (Number(u.pct) || 0), 0) || 100;
    const bar = funds.length ? '<div class="funds">' + funds.map((u, i) => {
      const w = (100 * (Number(u.pct) || 0)) / total;
      return '<div class="seg" style="width:' + w.toFixed(2) + '%;background:var(--chart-' + (i + 1) + ')">' + (w >= 9 ? Math.round(Number(u.pct) || 0) + '%' : '') + '</div>';
    }).join('') + '</div><div class="funds-legend">' + funds.map((u, i) =>
      '<span class="leg"><i style="background:var(--chart-' + (i + 1) + ')"></i>' + txt(u.label) + ' ' + Math.round(Number(u.pct) || 0) + '%</span>').join('') + '</div>' : '';
    const ms = s.milestones.length ? '<div class="ms-col"><p class="side-label">What it buys</p><ul class="ms">' + s.milestones.slice(0, 4).map((m) =>
      '<li>' + (typeof m === 'string' ? txt(m) : '<span class="ms-when">' + txt(m.when) + '</span>' + txt(m.what)) + '</li>').join('') + '</ul></div>' : '';
    // stats: amount, runway, allocation buckets when no use_of_funds bar is given
    const ns = Math.min(3, s.stats.length);
    const stats = ns ? statsBlock(s.stats.slice(0, 3), 'row-' + ns + ' ask-stats', Math.floor((1040 - 72 * (ns - 1)) / ns), 72) : '';
    const words = String(s.title || '').split(/\s+/).length;
    const sizeCls = words > 6 ? ' long' : words > 3 ? ' medium' : '';
    return '<div class="ask">' + (s.kicker ? '<p class="kicker">' + txt(s.kicker) + '</p>' : '') +
      '<h1 class="amount' + sizeCls + '">' + txt(s.title) + '</h1>' +
      (s.subtitle ? '<p class="subtitle">' + txt(s.subtitle) + '</p>' : '') +
      '<div class="ask-body"><div class="funds-col">' + (funds.length ? '<p class="side-label">Use of funds</p>' : '') + bar + stats + pointsBlock(s.points, 'compact') + '</div>' + ms + '</div></div>' + sourceLine(s, ctx);
  },

  roadmap(s, ctx) {
    const items = s.milestones.slice(0, 6);
    const n = Math.max(1, items.length);
    return headBlock(s, '', ctx) + '<div class="timeline tl-' + n + '">' + items.map((m) =>
      '<div class="tl-node">' + (typeof m === 'string' ? '<div class="tl-what">' + txt(m) + '</div>' :
        (m.when ? '<div class="tl-when">' + txt(m.when) + '</div>' : '') + '<div class="tl-what">' + txt(m.what) + '</div>' +
        (m.proves ? '<div class="tl-proves">' + txt(m.proves) + '</div>' : '')) + '</div>').join('') + '</div>' +
      pointsBlock(s.points, 'compact under') + sourceLine(s, ctx);
  },

  closing(s, ctx) {
    // One-liner, the three hero facts, and how to reach you (subtitle).
    const facts = s.points.length ? '<div class="hero-facts cols cols-' + Math.min(3, s.points.length) + '">' + s.points.slice(0, 3).map((p) =>
      '<div class="pt"><span class="mark"></span>' + txt(p) + '</div>').join('') + '</div>' : '';
    return '<div class="closing">' +
      (ctx.logo ? imgTag(ctx.logo, 'cover-logo', ctx.meta.company + ' logo') : '') +
      '<h1 class="cover-title">' + txt(s.title || ctx.meta.company) + '</h1>' + facts +
      (s.subtitle ? '<p class="contact">' + txt(s.subtitle) + '</p>' : '') + '</div>';
  },

  appendix(s, ctx) {
    let body = '';
    if (s.chart) body += '<div class="fin"><div class="chart-col">' + chartBlock(s.chart, 1080, 560, s.source) + '</div><div class="side">' + pointsBlock(s.points, 'compact') + statsBlock(s.stats, 'column small', 500, 64) + '</div></div>';
    else if (s.rows.length) body += tableBlock(s.columns, s.rows, ctx.meta.company) + pointsBlock(s.points, 'compact under');
    else if (s.team.length) return HTML_RENDERERS.team(s, ctx);
    else if (ctx.image) body += '<div class="grid-2 fill">' + pointsBlock(s.points) + '<div class="frame fillh">' + imgTag(ctx.image, 'fit') + '</div></div>';
    else if (!s.stats.length) body += '<div class="grid-2"><div class="col wide">' + pointsBlock(s.points) + '</div></div>';
    else body += '<div class="grid-2">' + pointsBlock(s.points) + statsBlock(s.stats, 'grid-2-stats', 370, 96) + '</div>';
    return headBlock(s, '', ctx) + body + sourceLine(s, ctx);
  },

  case_study(s, ctx) { return HTML_RENDERERS.appendix(s, ctx); },

  sources(s, ctx) {
    const items = s.items || [];
    if (!items.length) return headBlock(s, '', ctx) + pointsBlock(s.points);
    if (s.groups) {
      // Compact: one row per source file. The ids stay in facts.yaml (meta.sources: "full" prints them).
      return headBlock(s, '', ctx) + '<p class="src-note">' + s.figures + ' figures from ' + s.fileCount + ' source ' + (s.fileCount === 1 ? 'file' : 'files') +
        '. Each figure has an entry in the fact ledger (facts.yaml) that names its file and location.</p>' +
        '<table class="src-tbl files"><colgroup><col style="width:46%"><col style="width:10%"><col style="width:24%"><col style="width:20%"></colgroup>' +
        '<thead><tr><th>Source file</th><th>Figures</th><th>Kinds</th><th>Slides</th></tr></thead><tbody>' +
        s.groups.map((g) => '<tr><td class="src-id">' + esc(g.file) + '</td><td class="num">' + g.count + '</td><td>' + esc(g.kinds) + '</td><td>' + esc(g.slides) + '</td></tr>').join('') +
        '</tbody></table>';
    }
    const rich = items.some((it) => it.label);
    if (!rich) {
      return headBlock(s, '', ctx) + '<ul class="src">' + items.map((it) =>
        '<li><span class="src-n">' + it.ref + '</span><span class="src-id">' + esc(it.id) + '</span><span class="src-t">slide ' + esc(it.slide) + (it.title ? ': ' + esc(it.title) : '') + '</span></li>').join('') + '</ul>';
    }
    // With facts.yaml: id, label, value, kind, as_of, file (deck-structure.md section 7)
    return headBlock(s, '', ctx) + '<table class="src-tbl"><colgroup><col class="c-n"><col class="c-id"><col class="c-l"><col class="c-v"><col class="c-k"><col class="c-d"><col class="c-f"></colgroup><thead><tr><th>Ref</th><th>Ledger id</th><th>Label</th><th>Value</th><th>Kind</th><th>As of</th><th>Source file</th></tr></thead><tbody>' +
      items.map((it) => '<tr><td class="src-n">' + it.ref + '</td><td class="src-id">' + esc(it.id) + '</td><td>' + esc(it.label || '') + '<span class="src-m">slide ' + esc(it.slide) + '</span></td><td class="num">' + esc(it.value || '') + '</td><td>' + esc(it.kind || '') + '</td><td class="num">' + esc(it.asOf || '') + '</td><td class="file">' + esc(it.file || '') + (it.method ? '<span class="src-m">' + esc(it.method) + '</span>' : '') + '</td></tr>').join('') +
      '</tbody></table>';
  },

  custom_html(s, ctx) {
    return (s.title ? headBlock(s, '', ctx) : '') + '<div class="custom">' + (s.html || '') + '</div>';
  },

  statement(s, ctx) {
    const badge = s.unknownType ? '<div class="warn-badge">Unknown slide type "' + esc(s.unknownType) + '", shown as statement</div>' : '';
    return badge + '<div class="statement">' + (s.kicker ? '<p class="kicker">' + txt(s.kicker) + '</p>' : '') +
      '<h1 class="statement-title">' + txt(s.title) + '</h1>' +
      (s.subtitle ? '<p class="statement-sub">' + txt(s.subtitle) + '</p>' : '') +
      (s.body && ctx.variant === 'read' ? '<p class="body-text">' + txt(s.body) + '</p>' : '') +
      pointsBlock(s.points, 'compact under') + '</div>';
  },

  two_column(s, ctx) {
    const cols = s.columns.slice(0, 2).map((c) => (typeof c === 'string' ? { title: c } : c || {}));
    while (cols.length < 2) cols.push({});
    return headBlock(s, '', ctx) + '<div class="two">' + cols.map((c) =>
      '<div class="two-col">' + (c.title ? '<h2>' + txt(c.title) + '</h2>' : '') +
      (c.body ? '<p class="two-body">' + txt(c.body) + '</p>' : '') + pointsBlock(asArray(c.points).slice(0, MAX_POINTS), 'compact') + '</div>').join('') + '</div>' + sourceLine(s, ctx);
  },
};

function footerBlock(s, i, ctx) {
  const left = (ctx.logoSmall && s.type !== 'cover' && s.type !== 'closing' ? imgTag(ctx.logoSmall, 'foot-logo', '') : '') + esc(ctx.meta.footer || '');
  const right = s.type === 'cover' ? '' : String(i + 1);
  return '<div class="foot"><span class="foot-l">' + left + '</span><span class="foot-r">' + right + '</span></div>';
}

function renderSlideHtml(s, i, ctx) {
  const render = HTML_RENDERERS[s.type] || HTML_RENDERERS.statement;
  const slideCtx = Object.assign({}, ctx, { image: ctx.images[i] || null, teamPhotos: ctx.teamPhotos[i] || [] });
  let inner = render(s, slideCtx);
  // Everything after the header becomes the body block so light slides can balance vertically.
  const cut = inner.indexOf('</header>');
  if (inner.startsWith('<header') && cut >= 0) inner = inner.slice(0, cut + 9) + '<div class="body">' + inner.slice(cut + 9) + '</div>';
  return '<section class="slide s-' + s.type + (i === 0 ? ' active' : '') + '" data-index="' + (i + 1) + '" data-type="' + esc(s.type) + '" aria-label="Slide ' + (i + 1) + '">' +
    inner + footerBlock(s, i, ctx) + '</section>';
}

// ---- stylesheet ----------------------------------------------------------------------

function printRules(prefix) {
  const p = prefix ? prefix + ' ' : '';
  return [
    p + 'html,' + p + 'body{background:#fff;height:auto;overflow:visible}',
    p + '.viewport{position:static;display:block;overflow:visible;background:none;width:' + STAGE_W + 'px}',
    p + '.stage{transform:none !important;width:' + STAGE_W + 'px;height:auto}',
    p + '.slide{position:relative;inset:auto;visibility:visible;opacity:1;transition:none;break-after:page;page-break-after:always}',
    p + '.slide:last-child{break-after:auto;page-break-after:auto}',
    p + '.hud,' + p + '.notes{display:none !important}',
    p + '*{animation:none !important;transition:none !important}',
  ].join('\n');
}

function baseCss() {
  return `
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%;background:#000}
body{font-family:var(--font-body);font-synthesis:none;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.viewport{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#000}
.stage{position:relative;width:${STAGE_W}px;height:${STAGE_H}px;flex:none;transform-origin:center center}
.slide{position:absolute;inset:0;width:${STAGE_W}px;height:${STAGE_H}px;overflow:hidden;padding:96px 120px 120px;background:var(--bg);color:var(--ink);visibility:hidden;opacity:0;pointer-events:none;transition:opacity .22s ease;font-size:30px;line-height:1.4}
.slide.active{visibility:visible;opacity:1;pointer-events:auto}
.slide{display:flex;flex-direction:column}
.head{flex:none}
.body{flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-start}
.s-solution .body,.s-insight .body,.s-two_column .body,.s-go_to_market .body,.s-roadmap .body,.s-team .body,.s-business_model .body,.s-market .body,.s-statement .body{justify-content:center;padding-bottom:48px}
html.noscale .viewport{position:static;display:block;overflow:hidden;width:${STAGE_W}px;height:${STAGE_H}px}
html.noscale .slide{transition:none}
html.noscale .hud{display:none}
img{max-width:100%}

/* type scale, fixed in px for the 1920x1080 stage */
.kicker{font-size:24px;line-height:1.3;color:var(--accent);margin:0 0 20px;font-weight:500}
.title{font-family:var(--font-display);font-weight:var(--display-weight);letter-spacing:var(--display-tracking);font-size:64px;line-height:1.08;margin:0;max-width:1440px;text-wrap:balance}
.subtitle{font-size:30px;line-height:1.4;color:var(--muted);margin:24px 0 0;max-width:1240px}
.head{margin:0 0 56px}
.side-label{font-size:22px;color:var(--muted);margin:0 0 20px;font-weight:500}

.points{list-style:none;margin:0;padding:0;font-size:30px;line-height:1.4}
.points li{position:relative;padding:22px 0 22px 44px;border-top:1px solid var(--rule)}
.points li:first-child{border-top:0;padding-top:0}
.points li::before{content:"";position:absolute;left:0;top:calc(22px + .55em);width:12px;height:12px;background:var(--accent)}
.points li:first-child::before{top:.55em}
.points.compact{font-size:26px}
.points.compact li{padding:16px 0 16px 36px}
.points.compact li:first-child{padding-top:0}
.points.compact li::before{top:calc(16px + .5em);width:10px;height:10px}
.points.compact li:first-child::before{top:.5em}
.points.under{margin-top:48px;max-width:1200px}

.stats{display:grid;gap:40px}
.stats.column{grid-template-columns:1fr;gap:44px}
.stats.small .stat-v{font-size:64px}
.stats.grid-2-stats{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-content:start}
.stat-v{font-family:var(--font-display);font-weight:var(--display-weight);letter-spacing:var(--display-tracking);font-size:96px;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}
.stat-l{font-size:26px;line-height:1.3;color:var(--muted);margin-top:12px}
.stat-s{font-size:20px;line-height:1.3;color:var(--muted);margin-top:6px;opacity:.85}
.stats.big .stat-v{font-size:168px}
.stats.big.two{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:48px}
.stats.big.two .stat-v{font-size:120px}
.stats.dense{gap:28px}
.stats.dense .stat-v{font-size:72px}
.stats.dense .stat-l{font-size:22px;margin-top:8px}
.stats.row-1,.stats.row-2,.stats.row-3,.stats.row-4{grid-auto-flow:column;grid-auto-columns:minmax(0,1fr);gap:72px;align-items:start}
.stats.row-4 .stat-v{font-size:80px}
.stats.under{margin-top:72px;max-width:1100px}
.stats.ask-stats{margin-top:16px}
.body-text{font-size:28px;line-height:1.45;margin:28px 0 0;max-width:1240px}
.slide-source{position:absolute;left:120px;right:120px;bottom:100px;margin:0;font-size:20px;line-height:1.3;color:var(--muted)}
sup.fn{font-size:.6em;line-height:0;vertical-align:.5em;color:var(--muted);margin-left:.15em;font-variant-numeric:tabular-nums}
html[data-variant="read"] .points{font-size:27px}
html[data-variant="read"] .points li{padding-top:18px;padding-bottom:18px}
html[data-variant="read"] .points.compact{font-size:25px}
html[data-variant="read"] .points.compact li{padding-top:14px;padding-bottom:14px}
html[data-variant="read"] .points li:first-child{padding-top:0}
html[data-variant="read"] .title{font-size:58px}

.needs{display:inline-block;padding:0 .35em;border:3px dashed #E0A100;color:#B57A00;background:rgba(224,161,0,.10);border-radius:6px;font-weight:600;font-size:.72em;line-height:1.5;white-space:nowrap;vertical-align:.1em;font-family:var(--font-body);letter-spacing:0}
.warn-badge{position:absolute;top:24px;right:120px;background:#E0A100;color:#1A1A1A;font-size:20px;line-height:1;padding:10px 14px;border-radius:4px;font-weight:600;z-index:2}

.foot{position:absolute;left:120px;right:120px;bottom:48px;display:flex;justify-content:space-between;align-items:center;font-size:20px;line-height:1;color:var(--muted)}
.foot-l{display:flex;align-items:center;gap:16px}
.foot-logo{height:26px;width:auto;opacity:.85}
.foot-r{font-variant-numeric:tabular-nums}

.chart-wrap{flex:0 1 auto;min-height:0;display:flex;flex-direction:column}
.chart-wrap svg{display:block;flex:0 1 auto;min-height:0;width:100%;height:auto}
.chart-source{flex:none;font-size:20px;line-height:1.3;color:var(--muted);margin:16px 0 0}

/* cover and closing */
.s-cover,.s-closing{padding:0}
.cover-logo{position:absolute;left:120px;top:96px;height:72px;width:auto}
.cover-mark{position:absolute;left:120px;top:96px;font-family:var(--font-display);font-weight:var(--display-weight);font-size:36px;line-height:1}
.cover-main{position:absolute;left:120px;right:200px;bottom:200px}
.cover-title{font-family:var(--font-display);font-weight:var(--display-weight);letter-spacing:var(--display-tracking);font-size:148px;line-height:.98;margin:0;max-width:1560px;text-wrap:balance}
.cover-sub{font-size:40px;line-height:1.3;color:var(--muted);margin:40px 0 0;max-width:1240px}
.cover-main.has-facts{bottom:168px}
.cover-main.has-facts .cover-title{font-size:128px}
.cover-facts{display:flex;gap:96px;margin-top:64px;padding-top:40px;border-top:1px solid var(--rule)}
.cover-facts .stat-v{font-size:56px}
.cover-facts .stat-l{font-size:22px;margin-top:8px}
.closing{position:absolute;left:120px;right:120px;top:96px;bottom:160px;display:flex;flex-direction:column;justify-content:flex-end}
.closing .cover-logo{top:0;left:0}
.closing .cover-title{font-size:104px}
.closing .hero-facts{margin-top:72px}
.closing .hero-facts .pt{font-size:28px;padding-top:28px}
.closing .hero-facts .pt .mark{margin-bottom:20px}
.contact{font-size:28px;line-height:1.5;color:var(--muted);margin:64px 0 0}

/* problem */
.grid-2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:120px;align-items:start}
.grid-2.narrow{gap:96px}
.grid-2.fill{flex:1;min-height:0;grid-template-rows:minmax(0,1fr);align-items:stretch}
.grid-2 .col.wide{grid-column:1 / -1;max-width:1100px}
.grid-2.problem{align-items:center;flex:1;min-height:0}
.frame.fillh{height:auto;min-height:0}

/* solution columns */
.cols{display:grid;gap:72px;align-items:start}
.cols-1{grid-template-columns:1fr;max-width:1100px}.cols-2{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.cols-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.cols .pt{font-size:32px;line-height:1.4;padding-top:36px;border-top:1px solid var(--rule);position:relative}
.cols .pt .mark{display:block;width:16px;height:16px;background:var(--accent);margin-bottom:28px}

/* product */
.prod{display:grid;grid-template-columns:600px 1fr;gap:96px;align-items:stretch;flex:1;min-height:0;grid-template-rows:minmax(0,1fr)}
.frame{background:var(--surface);border:1px solid var(--rule);border-radius:8px;display:flex;align-items:center;justify-content:center;overflow:hidden;height:600px;padding:24px}
.frame .fit{max-width:100%;max-height:100%;object-fit:contain}
.frame-empty{font-size:26px;color:var(--muted)}

/* statement and insight */
.statement{position:absolute;left:120px;right:160px;top:50%;transform:translateY(-50%);padding-bottom:40px}
.statement-title{font-family:var(--font-display);font-weight:var(--display-weight);letter-spacing:var(--display-tracking);font-size:96px;line-height:1.04;margin:0;max-width:1560px;text-wrap:balance}
.statement-sub{font-size:34px;line-height:1.4;color:var(--muted);margin:40px 0 0;max-width:1300px}
.insight-title{font-family:var(--font-display);font-weight:var(--display-weight);letter-spacing:var(--display-tracking);font-size:72px;line-height:1.08;margin:0;max-width:1600px;text-wrap:balance}
.insight-body{display:grid;grid-template-columns:1fr;gap:120px;margin-top:64px;align-items:start}
.insight-body.with-stat{grid-template-columns:1fr 440px}
.insight-body .stats{padding-top:8px}
.team-note{font-size:24px;line-height:1.4;color:var(--muted);margin:56px 0 0}
.tl-proves{font-size:22px;line-height:1.4;color:var(--muted);margin-top:10px}
.src-tbl{width:100%;border-collapse:collapse;table-layout:fixed;font-size:19px;line-height:1.3;font-variant-numeric:tabular-nums}
.src-tbl col.c-n{width:4%}.src-tbl col.c-id{width:19%}.src-tbl col.c-l{width:23%}.src-tbl col.c-v{width:15%}.src-tbl col.c-k{width:8%}.src-tbl col.c-d{width:9%}.src-tbl col.c-f{width:22%}
.src-tbl th{text-align:left;font-weight:600;padding:10px 14px;border-bottom:2px solid var(--ink);color:var(--ink)}
.src-tbl td{padding:9px 14px;border-bottom:1px solid var(--rule);vertical-align:top}
.src-tbl.files{font-size:22px}
.src-tbl.files td{padding:11px 14px}
.src-note{font-size:22px;line-height:1.4;color:var(--muted);margin:0 0 28px;max-width:1300px}
.src-tbl .src-n{color:var(--muted)}
.src-tbl .src-id{font-weight:600;overflow-wrap:anywhere}
.src-tbl .num{white-space:nowrap}
.src-tbl .file{color:var(--muted);font-size:17px;overflow-wrap:anywhere}
.src-tbl .src-m{display:block;font-size:16px;color:var(--muted);opacity:.85}

/* market */
.market{display:grid;grid-template-columns:1fr;gap:96px;align-items:start}
.market.with-points{grid-template-columns:1fr 520px}
.steps{display:flex;flex-direction:column;gap:16px}
.step{min-width:440px;min-height:150px;background:var(--surface);padding:20px 36px;display:flex;flex-direction:column;justify-content:center;border-radius:6px}
.step .stat-v{font-size:60px}
.step .stat-l{font-size:22px;margin-top:6px}
.step-m{font-size:20px;line-height:1.3;color:var(--muted);margin-top:6px}
.step-focus{background:var(--accent);color:var(--bg)}
.step-focus .stat-l,.step-focus .step-m{color:var(--bg);opacity:.85}

/* traction and financials */
.trac,.fin{display:grid;grid-template-columns:1fr 440px;gap:100px;align-items:stretch;flex:1;min-height:0;grid-template-rows:minmax(0,1fr)}
.fin{grid-template-columns:1fr 500px}
.chart-col{min-width:0;min-height:0;display:flex;flex-direction:column}
.side{min-width:0;align-self:start}
.side .stats{margin-bottom:40px}
.side .points + .stats{margin-top:36px}

/* flow (go to market) */
.flow{display:grid;gap:56px;align-items:start}
.flow-1{grid-template-columns:1fr;max-width:1000px}.flow-2{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.flow-3{grid-template-columns:repeat(3,minmax(0,1fr))}.flow-4{grid-template-columns:repeat(4,minmax(0,1fr))}.flow-5{grid-template-columns:repeat(5,minmax(0,1fr))}
.flow-n{font-family:var(--font-display);font-weight:var(--display-weight);font-size:72px;line-height:1;color:var(--muted)}
.flow-t{font-size:28px;line-height:1.4;margin-top:24px;padding-top:24px;border-top:1px solid var(--rule)}
.flow-4 .flow-t,.flow-5 .flow-t{font-size:26px}

/* tables */
.tbl{width:100%;border-collapse:collapse;font-size:26px;line-height:1.3;font-variant-numeric:tabular-nums}
.tbl th{text-align:left;font-weight:600;padding:16px 24px;border-bottom:2px solid var(--ink);color:var(--ink);vertical-align:bottom}
.tbl td{padding:18px 24px;border-bottom:1px solid var(--rule);vertical-align:middle}
.tbl td.c{text-align:center}
.tbl th:not(:first-child){text-align:center}
.tbl .rowhead{font-weight:500}
.tbl .us{background:var(--surface)}
.tbl .us .rowhead{font-weight:700}
.tbl .ck{color:var(--accent);vertical-align:middle}
.tbl .no{color:var(--muted)}

/* team */
.team{display:grid;gap:0}
.team-2{grid-template-columns:minmax(0,1fr) minmax(0,1fr);max-width:1300px}.team-3{grid-template-columns:repeat(3,minmax(0,1fr))}.team-4{grid-template-columns:repeat(4,minmax(0,1fr))}
.member{padding:0 48px;border-left:1px solid var(--rule)}
.member:first-child{border-left:0;padding-left:0}
.avatar{width:160px;height:160px;border-radius:50%;background:var(--surface);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-weight:var(--display-weight);font-size:56px;line-height:1;color:var(--accent);overflow:hidden}
.avatar .photo{width:100%;height:100%;object-fit:cover}
.m-name{font-size:34px;line-height:1.2;font-weight:600;margin-top:36px}
.m-role{font-size:24px;line-height:1.3;color:var(--muted);margin-top:8px}
.m-bio{font-size:22px;line-height:1.45;color:var(--muted);margin-top:20px}
.team-4 .m-bio{font-size:20px}

/* ask */
.ask .amount{font-family:var(--font-display);font-weight:var(--display-weight);letter-spacing:var(--display-tracking);font-size:128px;line-height:1;margin:0;text-wrap:balance}
.ask .amount.medium{font-size:96px}
.ask .amount.long{font-size:64px;line-height:1.08;max-width:1500px}
.ask .subtitle{margin-top:28px}
.stats.ask-stats .stat-v{font-size:72px}
.ask-body{display:grid;grid-template-columns:1fr 520px;gap:120px;margin-top:72px;align-items:start}
.funds{display:flex;height:84px;width:100%;gap:4px;border-radius:6px;overflow:hidden}
.seg{display:flex;align-items:center;justify-content:center;color:var(--bg);font-size:26px;font-weight:600;font-variant-numeric:tabular-nums;min-width:0}
.funds-legend{display:flex;flex-wrap:wrap;gap:20px 40px;margin-top:24px;font-size:24px;line-height:1.3}
.leg i{display:inline-block;width:16px;height:16px;margin-right:12px;vertical-align:-1px;border-radius:2px}
.funds-col .points{margin-top:48px}
.ms{list-style:none;margin:0;padding:0;font-size:26px;line-height:1.4}
.ms li{padding:14px 0;border-top:1px solid var(--rule)}
.ms li:first-child{border-top:0;padding-top:0}
.ms-when{color:var(--muted);margin-right:16px;font-variant-numeric:tabular-nums}

/* roadmap */
.timeline{position:relative;display:grid;gap:48px;padding-top:48px;margin-top:40px}
.tl-1{grid-template-columns:1fr;max-width:900px}.tl-2{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.tl-3{grid-template-columns:repeat(3,minmax(0,1fr))}.tl-4{grid-template-columns:repeat(4,minmax(0,1fr))}.tl-5{grid-template-columns:repeat(5,minmax(0,1fr))}.tl-6{grid-template-columns:repeat(6,minmax(0,1fr))}
.timeline::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:var(--rule)}
.tl-node{position:relative}
.tl-node::before{content:"";position:absolute;left:0;top:-58px;width:20px;height:20px;border-radius:50%;background:var(--accent)}
.tl-when{font-size:24px;line-height:1.3;color:var(--muted);font-variant-numeric:tabular-nums}
.tl-what{font-size:28px;line-height:1.4;margin-top:12px}
.tl-5 .tl-what,.tl-6 .tl-what{font-size:24px}

/* sources */
.src{columns:2;column-gap:96px;list-style:none;margin:0;padding:0;font-size:22px;line-height:1.45}
.src li{break-inside:avoid;padding:12px 0;border-bottom:1px solid var(--rule);display:flex;gap:20px;align-items:baseline}
.src-n{color:var(--muted);min-width:48px;font-variant-numeric:tabular-nums;white-space:nowrap}
.src-id{font-weight:600;white-space:nowrap}
.src-t{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

/* two column */
.two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:120px;align-items:start}
.two h2{font-family:var(--font-display);font-weight:var(--display-weight);font-size:40px;line-height:1.15;margin:0 0 28px;text-wrap:balance}
.two-body{font-size:28px;line-height:1.45;margin:0 0 24px;color:var(--ink)}

/* custom html */
.custom{position:relative}

/* viewer chrome, outside the stage */
.hud{position:fixed;right:18px;bottom:14px;font:14px/1 -apple-system,system-ui,sans-serif;color:#fff;opacity:.55;pointer-events:none;font-variant-numeric:tabular-nums}
.notes{position:fixed;left:0;right:0;bottom:0;max-height:42vh;overflow:auto;background:rgba(18,18,20,.95);color:#ECECEC;font:18px/1.55 -apple-system,system-ui,sans-serif;padding:20px 32px 28px;z-index:10;white-space:pre-wrap;border-top:1px solid rgba(255,255,255,.12)}
.notes[hidden]{display:none}
.notes .notes-h{font-size:12px;letter-spacing:.02em;color:#9A9A9A;margin-bottom:10px}

@media (prefers-reduced-motion: reduce){.slide{transition:none}}
@page{size:${STAGE_W}px ${STAGE_H}px;margin:0}
@media print{
${printRules('')}
}
${printRules('html.print')}
`;
}

// ---- viewer runtime (no external JS) -------------------------------------------------

function runtimeJs() {
  return [
    '(function(){',
    '  var q = location.search;',
    '  var PRINT = /[?&]print(=|&|$)/.test(q), NOSCALE = PRINT || /[?&]noscale(=|&|$)/.test(q);',
    '  var html = document.documentElement;',
    '  if (PRINT) html.classList.add("print");',
    '  if (NOSCALE) html.classList.add("noscale");',
    '  var slides = [].slice.call(document.querySelectorAll(".slide"));',
    '  var stage = document.getElementById("stage");',
    '  var counter = document.getElementById("counter");',
    '  var notesEl = document.getElementById("notes");',
    '  var notes = [];',
    '  try { notes = JSON.parse(document.getElementById("deck-notes").textContent); } catch (e) {}',
    '  var n = slides.length, idx = 0;',
    '  function fit(){',
    '    if (NOSCALE) { stage.style.transform = "none"; return; }',
    '    var s = Math.min(window.innerWidth / ' + STAGE_W + ', window.innerHeight / ' + STAGE_H + ');',
    '    stage.style.transform = "scale(" + s + ")";',
    '  }',
    '  function renderNotes(){',
    '    if (notesEl.hidden) return;',
    '    var t = notes[idx] || "";',
    '    notesEl.innerHTML = "<div class=\\"notes-h\\">Speaker notes, slide " + (idx + 1) + " of " + n + " (press n to hide)</div>";',
    '    notesEl.appendChild(document.createTextNode(t || "No notes for this slide."));',
    '  }',
    '  function show(i, push){',
    '    i = Math.max(0, Math.min(n - 1, i));',
    '    idx = i;',
    '    for (var k = 0; k < n; k++) slides[k].classList.toggle("active", k === i);',
    '    if (counter) counter.textContent = (i + 1) + " / " + n;',
    '    if (push !== false) { try { history.replaceState(null, "", "#" + (i + 1)); } catch (e) {} }',
    '    renderNotes();',
    '  }',
    '  function next(){ show(idx + 1); }',
    '  function prev(){ show(idx - 1); }',
    '  document.addEventListener("keydown", function(e){',
    '    if (e.metaKey || e.ctrlKey || e.altKey) return;',
    '    var t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;',
    '    switch (e.key) {',
    '      case "ArrowRight": case "ArrowDown": case "PageDown": case " ": case "Spacebar": next(); break;',
    '      case "ArrowLeft": case "ArrowUp": case "PageUp": case "Backspace": prev(); break;',
    '      case "Home": show(0); break;',
    '      case "End": show(n - 1); break;',
    '      case "n": case "N": notesEl.hidden = !notesEl.hidden; renderNotes(); break;',
    '      default: return;',
    '    }',
    '    e.preventDefault();',
    '  });',
    '  document.querySelector(".viewport").addEventListener("click", function(e){',
    '    if (PRINT) return;',
    '    if (e.target.closest("a, button, input, textarea, select, .notes")) return;',
    '    if (e.clientX < window.innerWidth / 3) prev(); else next();',
    '  });',
    '  var tx = null, ty = null;',
    '  document.addEventListener("touchstart", function(e){ var t = e.changedTouches[0]; tx = t.clientX; ty = t.clientY; }, {passive: true});',
    '  document.addEventListener("touchend", function(e){',
    '    if (tx === null) return;',
    '    var t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty; tx = ty = null;',
    '    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) next(); else prev(); }',
    '  }, {passive: true});',
    '  window.addEventListener("resize", fit);',
    '  window.addEventListener("hashchange", function(){ var h = parseInt(location.hash.slice(1), 10); if (h) show(h - 1, false); });',
    '  var start = parseInt(location.hash.slice(1), 10);',
    '  fit();',
    '  show(start ? start - 1 : 0, false);',
    '  window.deck = { go: function(i){ show(i); }, next: next, prev: prev, total: n, get index(){ return idx; } };',
    '})();',
  ].join('\n');
}

// ---- page assembly -------------------------------------------------------------------

function googleFontsHref(families) {
  const seen = new Set();
  const parts = [];
  families.forEach((f) => {
    const fam = f.trim();
    if (!fam || seen.has(fam)) return;
    seen.add(fam);
    const [name, axes] = fam.split(':');
    parts.push('family=' + encodeURIComponent(name).replace(/%20/g, '+') + (axes ? ':' + axes : ''));
  });
  return parts.length ? 'https://fonts.googleapis.com/css2?' + parts.join('&') + '&display=swap' : '';
}

function buildHtml(deck, theme, themesCss, ctx) {
  const { meta, slides } = deck;
  const overrideCss = Object.keys(theme.overrides).length
    ? ':root[data-theme]{' + Object.keys(theme.overrides).map((k) => '--' + k + ':' + theme.overrides[k] + ';').join('') + '}\n'
    : '';
  const fontsHref = googleFontsHref(theme.tokens.gfontsList);
  HCTX = ctx;
  const notes = slides.map(notesText);
  const body = slides.map((s, i) => renderSlideHtml(s, i, ctx)).join('\n');
  return '<!doctype html>\n<html lang="en" data-theme="' + esc(theme.name) + '" data-variant="' + esc(meta.variant) + '">\n<head>\n' +
    '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(meta.company) + (meta.tagline ? ': ' + esc(meta.tagline) : '') + '</title>\n' +
    '<meta name="generator" content="startup-pitch build_deck.js">\n' +
    '<meta name="slide-count" content="' + slides.length + '">\n' +
    '<meta name="color-scheme" content="light dark">\n' +
    (fontsHref ? '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="' + fontsHref + '" rel="stylesheet">\n' : '') +
    '<style>\n' + themesCss + '\n' + overrideCss + baseCss() + '\n</style>\n</head>\n<body>\n' +
    '<div class="viewport"><div class="stage" id="stage">\n' + body + '\n</div></div>\n' +
    '<div class="hud" id="counter">1 / ' + slides.length + '</div>\n' +
    '<aside class="notes" id="notes" hidden></aside>\n' +
    '<script type="application/json" id="deck-notes">' + JSON.stringify(notes).replace(/</g, '\\u003c') + '</script>\n' +
    '<script>\n' + runtimeJs() + '\n</script>\n</body>\n</html>\n';
}

// ---- images --------------------------------------------------------------------------
// Images named in deck.json are resolved against the deck.json folder, copied into
// <out>/assets/ and embedded as data URIs so deck.html stays a single file.

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
const INLINE_LIMIT = 2.5 * 1024 * 1024;

function resolveImage(ref, inputDir, outDir, label) {
  if (!ref || typeof ref !== 'string') return null;
  if (/^(data:|https?:)/.test(ref)) return { html: ref, file: null };
  const src = path.resolve(inputDir, ref);
  if (!fs.existsSync(src)) { warn(label + ': image not found: ' + src); return null; }
  const assetsDir = path.join(outDir, 'assets');
  const dest = path.join(assetsDir, path.basename(src));
  if (path.resolve(dest) !== path.resolve(src)) {
    fs.mkdirSync(assetsDir, { recursive: true });
    fs.copyFileSync(src, dest);
  }
  const ext = path.extname(src).toLowerCase();
  const mime = MIME[ext];
  const size = fs.statSync(src).size;
  let html = 'assets/' + path.basename(src);
  if (mime && size <= INLINE_LIMIT) html = 'data:' + mime + ';base64,' + fs.readFileSync(src).toString('base64');
  return { html, file: dest, ext };
}

// --------------------------------------------------------------------------------------
// 5. PPTX renderer (pptxgenjs, native shapes, charts and tables)
// --------------------------------------------------------------------------------------

const IN = (px) => px / 144;          // 1920px stage == 13.333in, so 144px per inch
const PT = (px) => px / 2;            // 1px at 1920 wide == 0.5pt on a 13.333in slide
const SW = 13.333;
const SH = 7.5;
const ML = IN(120);
const CW = SW - 2 * ML;
const TITLE_Y = IN(96);
const BODY_Y = IN(300);
const BODY_H = IN(960 - 300);
const AMBER = 'B57A00';

function hex(v) { return String(v || '000000').replace('#', '').slice(0, 6).toUpperCase(); }

// Pixel size of a PNG/JPEG via image-size (ships with pptxgenjs); null when unavailable.
function imageDims(file) {
  try {
    const m = require('image-size');
    const fn = m.imageSize || m.default || m;
    const d = fn(fs.readFileSync(file));
    return d && d.width && d.height ? d : null;
  } catch (e) { return null; }
}

// SVG has no reliable PNG fallback inside a .pptx, so the builder rasterises each SVG
// with the installed Chrome (through playwright-core) when it can. Returns a map
// svgPath -> pngPath; missing entries mean the SVG was skipped in the PPTX.
async function rasteriseSvgs(files) {
  const map = {};
  const todo = files.filter((f) => f && f.ext === '.svg' && f.file);
  if (!todo.length) return map;
  let pw;
  try { pw = require('playwright-core'); } catch (e) {
    log('  note: ' + todo.length + ' SVG image(s) left out of the PPTX (no playwright-core to rasterise them; run: npm install --prefix scripts playwright-core, or supply PNGs)');
    return map;
  }
  const exe = findChrome();
  let browser;
  try { browser = await pw.chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' }); } catch (e) {
    log('  note: SVG images left out of the PPTX (no Chrome for playwright-core)');
    return map;
  }
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 });
  for (const f of todo) {
    const png = f.file + '.png';
    try {
      if (!fs.existsSync(png) || fs.statSync(png).mtimeMs < fs.statSync(f.file).mtimeMs) {
        await page.goto('file://' + f.file);
        const svg = await page.$('svg');
        const box = svg ? await svg.boundingBox() : null;
        if (!box || !box.width || !box.height) throw new Error('no size');
        await page.screenshot({ path: png, omitBackground: true, clip: { x: box.x, y: box.y, width: Math.ceil(box.width), height: Math.ceil(box.height) } });
      }
      map[f.file] = png;
    } catch (e) { warn('could not rasterise ' + path.basename(f.file) + ': ' + e.message.split('\n')[0]); }
  }
  await browser.close();
  return map;
}
function xmlEsc(s) { return String(s || '').replace(/&/g, '&amp;'); }

// pptxgenjs writes directory entries ("ppt/", "ppt/slides/") into the archive. PowerPoint
// ignores them, but some cloud services refuse such files, so the archive is rewritten
// without them (jszip ships with pptxgenjs). Any failure leaves the file as written.
async function stripZipFolders(file) {
  try {
    const JSZip = require('jszip');
    const src = await JSZip.loadAsync(fs.readFileSync(file));
    const names = Object.keys(src.files);
    if (!names.some((n) => src.files[n].dir)) return;
    const out = new JSZip();
    for (const n of names) {
      if (src.files[n].dir) continue;
      out.file(n, await src.files[n].async('nodebuffer'), { createFolders: false });
    }
    fs.writeFileSync(file, await out.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
  } catch (e) { /* keep the original archive */ }
}

async function buildPptx(deck, theme, outPath, ctx) {
  let PptxGenJS;
  try { PptxGenJS = require('pptxgenjs'); } catch (e) {
    log('PPTX skipped: pptxgenjs is not installed. Run: npm install --prefix ' + path.relative(process.cwd(), __dirname).replace(/^$/, '.') + '   (or: cd scripts && npm install)');
    return false;
  }
  const { meta, slides } = deck;
  const T = theme.tokens;
  const useWeb = meta.pptx_fonts === 'web';
  const HEAD = useWeb ? T.webDisplay : (T['pptx-display'] || 'Cambria');
  const BODY = useWeb ? T.webBody : (T['pptx-body'] || 'Calibri');
  const C = {
    bg: hex(T.bg), ink: hex(T.ink), muted: hex(T.muted), accent: hex(T.accent), accent2: hex(T['accent-2']),
    surface: hex(T.surface), rule: hex(T.rule),
    chart: [1, 2, 3, 4, 5].map((k) => hex(T['chart-' + k] || T.accent)),
  };
  const headBold = Number(T['display-weight'] || 400) >= 600;
  const READ = meta.variant === 'read';

  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = meta.company + (meta.tagline ? ': ' + meta.tagline : '');
  pres.author = meta.company;
  pres.company = xmlEsc(meta.company);       // written unescaped by pptxgenjs
  pres.theme = { headFontFace: HEAD, bodyFontFace: BODY };

  const footerText = { text: meta.footer || '', options: { x: ML, y: IN(1000), w: CW * 0.7, h: IN(32), fontSize: 10, color: C.muted, margin: 0, valign: 'middle' } };
  const masterObjects = [{ text: footerText }];
  const logoPng = ctx.logoFile ? (ctx.logoFile.ext === '.svg' ? ctx.rasters[ctx.logoFile.file] : ctx.logoFile.file) : null;
  if (logoPng) {
    const d = imageDims(logoPng);
    const lw = IN(28) * (d ? d.width / d.height : 1);
    // altText is set explicitly: without it pptxgenjs writes the image's local file path into the
    // PPTX as the picture description, which would expose the author's folder names.
    masterObjects.push({ image: { path: logoPng, x: ML, y: IN(1001), h: IN(28), w: lw, altText: 'Logo' } });
    footerText.options.x = ML + lw + IN(16);
  }
  pres.defineSlideMaster({ title: 'COVER', background: { color: C.bg }, objects: [{ text: { text: footerText.text, options: Object.assign({}, footerText.options, { x: ML }) } }] });
  pres.defineSlideMaster({
    title: 'CONTENT',
    background: { color: C.bg },
    objects: masterObjects.concat([{
      placeholder: { options: { name: 'title', type: 'title', x: ML, y: TITLE_Y, w: IN(1440), h: IN(150), fontSize: PT(60), color: C.ink, bold: headBold, align: 'left', valign: 'top', margin: 0, charSpacing: -1 } },
    }]),
    slideNumber: { x: SW - ML - IN(160), y: IN(1000), w: IN(160), h: IN(32), fontSize: 10, color: C.muted, align: 'right', margin: 0 },
  });

  // ---- helpers bound to this presentation
  // Text runs with every "[needs number]" occurrence in amber; plain strings stay strings.
  const runs = (v, base) => {
    const str = String(v == null ? '' : v);
    if (!hasPlaceholder(str)) return base ? [{ text: str, options: Object.assign({}, base) }] : str;
    return str.split(/(\[needs (?:number|detail)\])/i).filter((x) => x !== '').map((part) => ({ text: isPlaceholder(part) ? part.toLowerCase() : part, options: Object.assign({}, base, isPlaceholder(part) ? { color: AMBER, bold: true } : {}) }));
  };
  const text = (slide, v, o) => {
    const opts = Object.assign({ isTextBox: true, margin: 0, color: C.ink, fontSize: 15, valign: 'top' }, o);
    if (isPlaceholder(v)) {
      slide.addShape(pres.ShapeType.roundRect, { x: opts.x, y: opts.y, w: opts.w, h: opts.h, rectRadius: 0.05, fill: { color: C.bg }, line: { color: 'E0A100', width: 1.5, dashType: 'dash' } });
      opts.color = AMBER; opts.bold = true; opts.margin = 4; opts.fontFace = BODY;
      if (opts.fontSize > 24) opts.fontSize = 24;
      slide.addText(String(v).trim().toLowerCase(), opts);
      return;
    }
    slide.addText(runs(v), opts);
  };
  const display = (o) => Object.assign({ fontFace: HEAD, bold: headBold, charSpacing: -1 }, o);
  const bullets = (slide, points, o) => {
    if (!points.length) return;
    // one paragraph per point; a point with an inline placeholder becomes several runs
    const items = [];
    points.forEach((p, i) => {
      const parts = runs(p, { bullet: { indent: 14 }, paraSpaceAfter: 10 });
      parts.forEach((r, k) => { r.options.breakLine = k === parts.length - 1 && i < points.length - 1; });
      items.push.apply(items, parts);
    });
    slide.addText(items, Object.assign({ isTextBox: true, margin: 0, color: C.ink, fontSize: 15, valign: 'top' }, o));
  };
  // size: px font size of the value; label and source follow
  // Rough line count for a text box: average glyph width about half the font size.
  const linesFor = (str, wIn, fontPt) => Math.max(1, Math.ceil(String(str || '').length / Math.max(8, Math.floor((wIn * 72) / (fontPt * 0.5)))));
  const statBlock = (slide, st, x, y, w, size) => {
    const base = size || 84;
    const vs = base;                                      // row height stays at the base size
    text(slide, st.value, display({ x, y, w, h: IN(vs * 1.1), fontSize: PT(fitSize(st.value, w * 144, base)), valign: 'bottom' }));
    let yy = y + IN(vs * 1.1 + 10);
    const sp = statSourceParts(st, ctx);
    const label = (st.label || '') + sp.mark;
    if (label) {
      const lpx = vs >= 84 ? 26 : 22;
      const lh = IN(Math.max(36, linesFor(label, w, PT(lpx)) * lpx * 1.3) + 4);
      text(slide, label, { x, y: yy, w, h: lh, fontSize: PT(lpx), color: C.muted });
      yy += lh;
    }
    if (sp.text) text(slide, sp.text, { x, y: yy, w, h: IN(30), fontSize: PT(20), color: C.muted });
  };
  const chartSource = (slide, chart, x, y, w, slideSrc) => {
    const cap = chart.source ? captionText([chart.source, slideSrc], ctx) : '';
    text(slide, cap || 'Source: [needs number]', { x, y, w, h: IN(30), fontSize: PT(20), color: cap ? C.muted : AMBER });
  };
  const slideSource = (slide, s) => {
    if (s.chart && CHART_TYPES.includes(s.type)) return;        // the chart caption carries it
    const cap = s.source ? captionText(s.source, ctx) : '';
    if (cap) text(slide, cap, { x: ML, y: IN(960), w: CW, h: IN(30), fontSize: PT(20), color: C.muted });
  };
  const addChart = (slide, chart, x, y, w, h) => {
    // null stays empty so a line stops instead of dropping to zero; bars simply have no bar there
    const data = chart.series.map((s) => ({ name: s.name, labels: chart.labels, values: s.values.map((v) => (v == null ? '' : v)) }));
    const multi = chart.series.length > 1;
    // axis and data labels as in the HTML chart: 1-2-5 ticks, values with the decimals they have
    const vals = chart.series.reduce((a, s) => a.concat(s.values.filter((x) => x != null)), []);
    const nLab = chart.labels.length;
    const maxVal = chart.kind === 'stacked_bar'
      ? Math.max(0, ...Array.from({ length: nLab }, (_, i) => chart.series.reduce((a, s) => a + Math.max(0, s.values[i] || 0), 0)))
      : Math.max(0, ...vals);
    const axisTicks = niceTicks(maxVal, vals.every((x) => Number.isInteger(x)));
    const dec = Math.max(0, ...vals.map(decimalsFor));
    const numFmt = '#,##0' + (dec ? '.' + '#'.repeat(dec) : '');
    const o = {
      x, y, w, h,
      chartColors: C.chart.slice(0, Math.max(1, chart.series.length)),
      valAxisMinVal: 0, valAxisMaxVal: axisTicks[axisTicks.length - 1], valAxisMajorUnit: axisTicks[1] - axisTicks[0],
      catGridLine: { style: 'none' },
      valGridLine: { color: C.rule, size: 0.75 },
      valAxisLineShow: false,
      catAxisLineShow: true,
      catAxisLineColor: C.muted,
      catAxisLabelColor: C.muted, valAxisLabelColor: C.muted,
      catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
      catAxisLabelFontFace: BODY, valAxisLabelFontFace: BODY,
      valAxisLabelFormatCode: '#,##0' + (decimalsFor(axisTicks[1]) ? '.' + '0'.repeat(decimalsFor(axisTicks[1])) : ''),
      showLegend: multi, legendPos: 't', legendColor: C.muted, legendFontSize: 11, legendFontFace: BODY,
      showValue: !!chart.show_values,
      dataLabelColor: C.ink, dataLabelFontSize: 11, dataLabelFontFace: BODY, dataLabelFormatCode: numFmt + ';-' + numFmt + ';',
      showValAxisTitle: !!chart.y_label, valAxisTitle: chart.y_label || '', valAxisTitleColor: C.muted, valAxisTitleFontSize: 11, valAxisTitleFontFace: BODY,
    };
    let type = pres.ChartType.bar;
    switch (chart.kind) {
      case 'horizontal_bar': o.barDir = 'bar'; o.barGapWidthPct = 60; o.dataLabelPosition = 'outEnd'; break;
      case 'stacked_bar': o.barDir = 'col'; o.barGrouping = 'stacked'; o.barGapWidthPct = 60; o.dataLabelPosition = 'ctr'; o.dataLabelColor = C.bg; break;
      case 'line': type = pres.ChartType.line; o.lineSize = 2.5; o.lineDataSymbol = 'circle'; o.lineDataSymbolSize = 7; o.lineDataSymbolLineColor = C.bg; o.dataLabelPosition = 't'; break;
      case 'area': type = pres.ChartType.area; o.chartColorsOpacity = 45; o.dataLabelPosition = 't'; break;
      default: o.barDir = 'col'; o.barGapWidthPct = 60; o.dataLabelPosition = 'outEnd';
    }
    slide.addChart(type, data, o);
  };
  const addTable = (slide, columns, rows, x, y, w, maxH) => {
    const cols = columns.length ? columns : rows[0].map((_, i) => (i === 0 ? '' : 'Col ' + i));
    const ncol = cols.length;
    const firstW = Math.min(w * 0.34, 3.2);
    const colW = [firstW].concat(new Array(ncol - 1).fill((w - firstW) / Math.max(1, ncol - 1)));
    const header = cols.map((c) => ({ text: String(c), options: { bold: true, color: C.ink, fill: { color: C.bg }, border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 1.25, color: C.ink }, { type: 'none' }], align: 'center' } }));
    header[0].options.align = 'left';
    const body = rows.map((r) => {
      const cells = Array.isArray(r) ? r : (r.cells || [r.name].concat(asArray(r.values)));
      const us = String(cells[0]).toLowerCase() === String(meta.company).toLowerCase();
      return cells.map((v, j) => {
        const base = { color: C.ink, fill: { color: us ? C.surface : C.bg }, border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 0.5, color: C.rule }, { type: 'none' }], align: j === 0 ? 'left' : 'center', bold: us && j === 0 };
        if (v === true || v === 'yes' || v === 'true') return { text: '✓', options: Object.assign(base, { color: C.accent, fontSize: 16, bold: true }) };
        if (v === false || v === 'no' || v === 'false' || v === '' || v == null) return { text: j === 0 ? '' : '–', options: Object.assign(base, { color: C.muted }) };
        if (hasPlaceholder(v)) return { text: String(v), options: Object.assign(base, { color: AMBER, bold: true }) };
        return { text: String(v), options: base };
      });
    });
    const rowH = Math.min(0.55, ((maxH || BODY_H) - 0.2) / (rows.length + 1));
    slide.addTable([header].concat(body), { x, y, w, colW, rowH, fontSize: Math.min(13, rowH * 24), fontFace: BODY, color: C.ink, margin: 0.08, valign: 'middle', autoPage: false });
    return rowH * (rows.length + 1);
  };
  // The column beside a chart (financials, appendix): points first, then up to two stats.
  const sideColumn = (slide, s, x, y) => {
    const w = IN(500);
    const ptsH = s.points.reduce((a, p) => a + IN(34 * linesFor(p, w - IN(30), PT(24)) + 22), 0);
    bullets(slide, s.points, { x, y, w, h: Math.max(ptsH, IN(40)), fontSize: PT(24) });
    let yy = y + (s.points.length ? ptsH + IN(24) : 0);
    s.stats.slice(0, 2).forEach((st) => { statBlock(slide, st, x, yy, w, 56); yy += IN(56 * 1.1 + 10 + 34 * linesFor(st.label, w, PT(22)) + (READ ? 62 : 30)); });
  };
  // A table with its optional points underneath (competition, unit economics, financials, appendix).
  const tableWithPoints = (slide, s, y) => {
    const pts = s.points.slice(0, 3);
    const ptsH = pts.reduce((a, p) => a + IN(40) * Math.ceil(String(p).length / 95) + IN(16), 0);
    const used = addTable(slide, s.columns, s.rows, ML, y, CW, IN(930) - y - (pts.length ? ptsH + IN(40) : 0));
    if (pts.length) bullets(slide, pts, { x: ML, y: y + used + IN(40), w: IN(1300), h: ptsH, fontSize: PT(24) });
  };
  // Places an image inside the box, preserving its aspect ratio (left/top aligned
  // unless `center`). SVG files use the PNG the builder rasterised (ctx.rasters).
  const image = (slide, img, x, y, w, h, extra, center) => {
    if (!img || !img.file) return false;
    let file = img.file;
    if (img.ext === '.svg') {
      file = ctx.rasters[img.file];
      if (!file) return false;
    }
    const dim = imageDims(file);
    let bw = w, bh = h;
    if (dim) { const r = dim.width / dim.height; if (w / h > r) { bw = h * r; } else { bh = w / r; } }
    const bx = center ? x + (w - bw) / 2 : x;
    const by = center ? y + (h - bh) / 2 : y;
    // altText always set (see the note at the logo): never let the local path become the description.
    slide.addImage(Object.assign({ path: file, x: bx, y: by, w: bw, h: bh, altText: 'Image' }, extra || {}));
    return true;
  };
  const content = (s) => {
    const slide = pres.addSlide({ masterName: 'CONTENT' });
    if (s.title) slide.addText(runs(s.title), { placeholder: 'title' });
    // the title placeholder holds two lines; a third pushes the body down one line
    const perLine = HEAD === 'Arial' ? 42 : 50;
    let y = BODY_Y + (String(s.title || '').length > 2 * perLine ? IN(64) : 0);
    if (s.kicker) text(slide, s.kicker, { x: ML, y: IN(56), w: CW, h: IN(34), fontSize: PT(24), color: C.accent });
    if (s.subtitle) { text(slide, s.subtitle, { x: ML, y: y - IN(48), w: IN(1240), h: IN(84), fontSize: PT(28), color: C.muted }); y += IN(50); }
    if (s.body && READ) { text(slide, s.body, { x: ML, y, w: IN(1240), h: IN(110), fontSize: PT(26) }); y += IN(130); }
    slideSource(slide, s);
    return { slide, y };
  };
  const statsRow = (slide, stats, y, size) => {
    const n = Math.max(1, stats.length);
    const gap = IN(72);
    const w = (CW - gap * (n - 1)) / n;
    stats.forEach((st, i) => statBlock(slide, st, ML + i * (w + gap), y, w, size || (n >= 4 ? 72 : 84)));
  };
  // up to three points side by side under a small accent mark (solution, product without image)
  const columns3 = (slide, points, y) => {
    const n = Math.max(1, Math.min(3, points.length));
    const gap = IN(72);
    const colW = (CW - gap * (n - 1)) / n;
    const cy = y + IN(110);
    points.slice(0, 3).forEach((p, i) => {
      const x = ML + i * (colW + gap);
      slide.addShape(pres.ShapeType.line, { x, y: cy, w: colW, h: 0, line: { color: C.rule, width: 0.75 } });
      slide.addShape(pres.ShapeType.rect, { x, y: cy + IN(36), w: IN(16), h: IN(16), fill: { color: C.accent }, line: { color: C.accent, width: 0 } });
      text(slide, p, { x, y: cy + IN(80), w: colW, h: IN(400), fontSize: PT(30) });
    });
    if (points.length > 3) bullets(slide, points.slice(3), { x: ML, y: y + IN(520), w: CW, h: IN(200), fontSize: PT(26) });
  };
  const pointsAndStats = (slide, s, y) => {
    if (s.stats.length) { statsRow(slide, s.stats, y + IN(60)); y += IN(340); }
    bullets(slide, s.points, { x: ML, y, w: IN(1200), h: IN(960) - y, fontSize: PT(26) });
  };

  // ---- per slide type
  const R = {
    cover(s) {
      const slide = pres.addSlide({ masterName: 'COVER' });
      const logo = ctx.logoFile || ctx.images[s._i];
      if (!image(slide, logo, ML, IN(96), IN(600), IN(72))) {
        text(slide, meta.company, display({ x: ML, y: IN(96), w: IN(800), h: IN(50), fontSize: PT(36) }));
      }
      const facts = s.stats.slice(0, 3);
      let y = IN(1080 - 200);
      if (facts.length) {
        y = IN(1080 - 168);
        slide.addShape(pres.ShapeType.line, { x: ML, y: y - IN(150), w: IN(1200), h: 0, line: { color: C.rule, width: 0.75 } });
        facts.forEach((st, i) => statBlock(slide, st, ML + i * IN(400), y - IN(112), IN(360), 56));
        y -= IN(214);
      }
      const titleSize = facts.length ? 120 : 140;
      if (s.subtitle || meta.tagline) { y -= IN(110); text(slide, s.subtitle || meta.tagline, { x: ML, y, w: IN(1240), h: IN(110), fontSize: PT(40), color: C.muted, valign: 'top' }); y -= IN(40); }
      text(slide, s.title || meta.company, display({ x: ML, y: y - IN(300), w: IN(1560), h: IN(300), fontSize: PT(titleSize), valign: 'bottom', charSpacing: -3 }));
      if (s.kicker) text(slide, s.kicker, { x: ML, y: y - IN(300) - IN(50), w: IN(1200), h: IN(40), fontSize: PT(24), color: C.accent });
      return slide;
    },
    problem(s) {
      const { slide, y } = content(s);
      if (image(slide, ctx.images[s._i], ML + IN(900), y, IN(780), IN(560))) {
        bullets(slide, s.points, { x: ML, y, w: IN(800), h: IN(960) - y, fontSize: PT(26) });
        return slide;
      }
      if (!s.stats.length) { bullets(slide, s.points, { x: ML, y, w: IN(1100), h: IN(940) - y, fontSize: PT(30) }); return slide; }
      bullets(slide, s.points, { x: ML + IN(900), y: y + IN(40), w: IN(780), h: IN(900) - y, fontSize: PT(28) });
      const two = s.stats.length > 1;
      // the number sits beside the points, as in the HTML layout
      s.stats.slice(0, 2).forEach((st, i) => statBlock(slide, st, ML + i * IN(420), y + IN(120), IN(two ? 380 : 780), two ? 110 : 150));
      return slide;
    },
    solution(s) {
      const { slide, y } = content(s);
      if (image(slide, ctx.images[s._i], ML + IN(900), y, IN(780), IN(560))) {
        bullets(slide, s.points, { x: ML, y, w: IN(800), h: IN(960) - y, fontSize: PT(30) });
        return slide;
      }
      columns3(slide, s.points, y);
      return slide;
    },
    product(s) {
      const { slide, y } = content(s);
      const img = ctx.images[s._i];
      const usable = img && img.file && (img.ext !== '.svg' || ctx.rasters[img.file]);
      if (!usable) { columns3(slide, s.points, y); return slide; }       // no image: points take the width
      bullets(slide, s.points, { x: ML, y, w: IN(560), h: IN(940) - y, fontSize: PT(26) });
      const fx = ML + IN(696), fw = CW - IN(696), fh = IN(940) - y;
      slide.addShape(pres.ShapeType.roundRect, { x: fx, y, w: fw, h: fh, rectRadius: 0.06, fill: { color: C.surface }, line: { color: C.rule, width: 0.75 } });
      image(slide, img, fx + IN(24), y + IN(24), fw - IN(48), fh - IN(48), null, true);
      return slide;
    },
    insight(s) {
      const slide = pres.addSlide({ masterName: 'CONTENT' });
      if (s.kicker) text(slide, s.kicker, { x: ML, y: IN(56), w: CW, h: IN(34), fontSize: PT(24), color: C.accent });
      const hasBelow = s.points.length || s.stats.length;
      text(slide, s.title, display({ x: ML, y: IN(96), w: IN(1600), h: IN(hasBelow ? 260 : 600), fontSize: PT(72), valign: hasBelow ? 'bottom' : 'middle', charSpacing: -2 }));
      let y = IN(380);
      if (s.subtitle) { text(slide, s.subtitle, { x: ML, y, w: IN(1300), h: IN(90), fontSize: PT(32), color: C.muted }); y += IN(100); }
      if (s.body && READ) { text(slide, s.body, { x: ML, y, w: IN(1240), h: IN(100), fontSize: PT(26) }); y += IN(110); }
      const stat = s.stats[0];
      bullets(slide, s.points, { x: ML, y: y + IN(20), w: IN(stat ? 1080 : 1400), h: IN(960) - y, fontSize: PT(26) });
      if (stat) statBlock(slide, stat, SW - ML - IN(440), y + IN(20), IN(440), 84);
      slideSource(slide, s);
      return slide;
    },
    statement(s) {
      const slide = pres.addSlide({ masterName: 'CONTENT' });
      if (s.unknownType) slide.addShape(pres.ShapeType.rect, { x: SW - ML - IN(520), y: IN(24), w: IN(520), h: IN(40), fill: { color: 'E0A100' }, line: { color: 'E0A100', width: 0 } });
      if (s.unknownType) text(slide, 'Unknown slide type "' + s.unknownType + '", shown as statement', { x: SW - ML - IN(510), y: IN(24), w: IN(500), h: IN(40), fontSize: PT(20), color: '1A1A1A', valign: 'middle', bold: true });
      const hasSub = !!s.subtitle;
      const hasPts = s.points.length > 0;
      text(slide, s.title, display({ x: ML, y: IN(180), w: IN(1560), h: IN(hasSub || hasPts ? 440 : 700), fontSize: PT(92), valign: hasSub || hasPts ? 'bottom' : 'middle', charSpacing: -2 }));
      if (s.kicker) text(slide, s.kicker, { x: ML, y: IN(130), w: IN(1200), h: IN(40), fontSize: PT(24), color: C.accent });
      if (hasSub) text(slide, s.subtitle, { x: ML, y: IN(660), w: IN(1300), h: IN(140), fontSize: PT(34), color: C.muted });
      if (hasPts) bullets(slide, s.points, { x: ML, y: IN(hasSub ? 800 : 660), w: IN(1200), h: IN(180), fontSize: PT(26) });
      return slide;
    },
    market(s) {
      const { slide, y } = content(s);
      const hasPts = s.points.length > 0;
      const fullW = hasPts ? CW - IN(620) : CW;
      const widths = [1, 0.72, 0.5];
      s.stats.slice(0, 3).forEach((st, i) => {
        const focus = i === Math.min(2, s.stats.length - 1);
        const by = y + i * IN(196), bh = IN(176), bw = fullW * widths[i];
        slide.addShape(pres.ShapeType.roundRect, { x: ML, y: by, w: bw, h: bh, rectRadius: 0.04, fill: { color: focus ? C.accent : C.surface }, line: { color: focus ? C.accent : C.surface, width: 0 } });
        const col = focus ? C.bg : C.ink;
        text(slide, st.value, display({ x: ML + IN(40), y: by + IN(22), w: bw - IN(80), h: IN(72), fontSize: PT(64), color: col, valign: 'bottom' }));
        const sp = statSourceParts(st, ctx);
        text(slide, (st.label || '') + sp.mark, { x: ML + IN(40), y: by + IN(100), w: bw - IN(80), h: IN(60), fontSize: PT(22), color: col });
        if (sp.text) text(slide, sp.text, { x: ML + IN(40), y: by + IN(146), w: bw - IN(80), h: IN(26), fontSize: PT(18), color: col });
      });
      if (!s.stats.length) bullets(slide, s.points, { x: ML, y, w: IN(1200), h: IN(960) - y, fontSize: PT(30) });
      else if (hasPts) bullets(slide, s.points, { x: SW - ML - IN(520), y, w: IN(520), h: IN(960) - y, fontSize: PT(26) });
      return slide;
    },
    traction(s) {
      const { slide, y } = content(s);
      const cw = IN(1140), ch = Math.min(IN(560), IN(900) - y);
      if (s.chart) { addChart(slide, s.chart, ML, y, cw, ch); chartSource(slide, s.chart, ML, y + ch + IN(10), cw, s.source); }
      else bullets(slide, s.points, { x: ML, y, w: cw, h: IN(960) - y, fontSize: PT(30) });
      const sx = SW - ML - IN(440);
      const dense = s.stats.length + (s.chart ? s.points.length : 0) >= 3;
      const step = IN(dense ? (READ ? 172 : 150) : 190);
      s.stats.forEach((st, i) => statBlock(slide, st, sx, y + i * step, IN(440), dense ? 56 : 76));
      if (s.chart && s.points.length) bullets(slide, s.points, { x: sx, y: y + s.stats.length * step, w: IN(440), h: IN(300), fontSize: PT(24) });
      return slide;
    },
    business_model(s) {
      const { slide, y } = content(s);
      if (s.rows.length) tableWithPoints(slide, s, y);
      else pointsAndStats(slide, s, y);
      return slide;
    },
    go_to_market(s) {
      const { slide, y } = content(s);
      const n = Math.max(1, s.points.length);
      const gap = IN(56);
      const colW = (CW - gap * (n - 1)) / n;
      s.points.forEach((p, i) => {
        const x = ML + i * (colW + gap);
        text(slide, String(i + 1), display({ x, y, w: colW, h: IN(80), fontSize: PT(72), color: C.muted, valign: 'bottom' }));
        slide.addShape(pres.ShapeType.line, { x, y: y + IN(104), w: colW, h: 0, line: { color: C.rule, width: 0.75 } });
        text(slide, p, { x, y: y + IN(128), w: colW, h: IN(300), fontSize: PT(n > 3 ? 26 : 28) });
      });
      if (s.stats.length) s.stats.slice(0, 2).forEach((st, i) => statBlock(slide, st, ML + i * IN(480), IN(720), IN(440), 72));
      return slide;
    },
    competition(s) {
      const { slide, y } = content(s);
      if (s.rows.length) tableWithPoints(slide, s, y);
      else bullets(slide, s.points, { x: ML, y, w: IN(1200), h: IN(960) - y, fontSize: PT(30) });
      return slide;
    },
    team(s) {
      const { slide, y } = content(s);
      const members = s.team.slice(0, 4);
      const n = Math.max(2, members.length);
      const colW = CW / n;
      members.forEach((m, i) => {
        const x = ML + i * colW + (i ? IN(48) : 0);
        const w = colW - (i ? IN(48) : 0) - IN(48);
        if (i) slide.addShape(pres.ShapeType.line, { x: ML + i * colW, y, w: 0, h: IN(600), line: { color: C.rule, width: 0.75 } });
        const photo = (ctx.teamPhotos[s._i] || [])[i];
        if (!image(slide, photo, x, y, IN(160), IN(160), { rounding: true })) {
          slide.addShape(pres.ShapeType.ellipse, { x, y, w: IN(160), h: IN(160), fill: { color: C.surface }, line: { color: C.surface, width: 0 } });
          const initials = String(m.name || '').split(/\s+/).map((w2) => w2[0] || '').join('').slice(0, 2).toUpperCase();
          text(slide, initials, display({ x, y, w: IN(160), h: IN(160), fontSize: PT(56), color: C.accent, align: 'center', valign: 'middle' }));
        }
        // name, role and proof line flow under the avatar; long names and roles wrap
        let yy = y + IN(196);
        const nameH = IN(44 * linesFor(m.name, w, PT(34) * 1.1));
        text(slide, m.name || '', { x, y: yy, w, h: nameH, fontSize: PT(34), bold: true });
        yy += nameH + IN(6);
        if (m.role) { const rh = IN(32 * linesFor(m.role, w, PT(24))); text(slide, m.role, { x, y: yy, w, h: rh, fontSize: PT(24), color: C.muted }); yy += rh + IN(16); }
        if (m.bio) text(slide, m.bio, { x, y: yy, w, h: IN(900) - yy, fontSize: PT(n > 3 ? 20 : 22), color: C.muted });
      });
      if (s.points.length) text(slide, s.points[0], { x: ML, y: IN(880), w: CW, h: IN(60), fontSize: PT(24), color: C.muted });
      return slide;
    },
    financials(s) {
      const { slide, y } = content(s);
      if (s.rows.length && !s.chart) { tableWithPoints(slide, s, y); return slide; }
      const cw = IN(1080), ch = Math.min(IN(520), IN(900) - y);
      if (s.chart) { addChart(slide, s.chart, ML, y, cw, ch); chartSource(slide, s.chart, ML, y + ch + IN(10), cw, s.source); }
      const sx = SW - ML - IN(500);
      text(slide, 'Drivers', { x: sx, y, w: IN(500), h: IN(32), fontSize: PT(22), color: C.muted });
      sideColumn(slide, s, sx, y + IN(52));
      return slide;
    },
    ask(s) {
      const slide = pres.addSlide({ masterName: 'CONTENT' });
      slideSource(slide, s);
      if (s.kicker) text(slide, s.kicker, { x: ML, y: IN(96), w: IN(1200), h: IN(40), fontSize: PT(24), color: C.accent });
      // Long sentence titles get a smaller size than a bare amount
      const words = String(s.title || '').split(/\s+/).length;
      const titleSize = words > 6 ? 64 : words > 3 ? 92 : 120;
      text(slide, s.title || '', display({ x: ML, y: IN(140), w: IN(1600), h: IN(titleSize > 64 ? 150 : 170), fontSize: PT(titleSize), valign: 'bottom', charSpacing: -2 }));
      if (s.subtitle) text(slide, s.subtitle, { x: ML, y: IN(316), w: IN(1240), h: IN(80), fontSize: PT(30), color: C.muted });
      const y = IN(470);
      const funds = s.use_of_funds;
      const total = funds.reduce((a, u) => a + (Number(u.pct) || 0), 0) || 100;
      const barW = CW - IN(640);
      if (!funds.length && s.stats.length) {
        const st = s.stats.slice(0, 3);
        const gap = IN(48);
        const w = (barW - gap * (st.length - 1)) / st.length;
        st.forEach((x, i) => statBlock(slide, x, ML + i * (w + gap), y, w, 64));
      }
      if (funds.length) {
        text(slide, 'Use of funds', { x: ML, y, w: barW, h: IN(32), fontSize: PT(22), color: C.muted });
        let x = ML;
        funds.forEach((u, i) => {
          const w = barW * ((Number(u.pct) || 0) / total);
          slide.addShape(pres.ShapeType.rect, { x, y: y + IN(52), w: Math.max(0.02, w - IN(4)), h: IN(84), fill: { color: C.chart[i % 5] }, line: { color: C.chart[i % 5], width: 0 } });
          if (w > IN(120)) text(slide, Math.round(Number(u.pct) || 0) + '%', { x, y: y + IN(52), w: w - IN(4), h: IN(84), fontSize: PT(26), color: C.bg, bold: true, align: 'center', valign: 'middle' });
          x += w;
        });
        const legend = funds.map((u, i) => [
          { text: '■ ', options: { color: C.chart[i % 5], fontSize: PT(24) } },
          { text: (isPlaceholder(u.label) ? '[needs number]' : String(u.label || '')) + ' ' + Math.round(Number(u.pct) || 0) + '%' + (i < funds.length - 1 ? '     ' : ''), options: { color: isPlaceholder(u.label) ? AMBER : C.ink, fontSize: PT(24) } },
        ]).reduce((a, b) => a.concat(b), []);
        slide.addText(legend, { x: ML, y: y + IN(156), w: barW, h: IN(80), isTextBox: true, margin: 0, valign: 'top' });
      }
      bullets(slide, s.points, { x: ML, y: y + IN(260), w: barW, h: IN(240), fontSize: PT(24) });
      if (s.milestones.length) {
        const mx = SW - ML - IN(520);
        text(slide, 'What it buys', { x: mx, y, w: IN(520), h: IN(32), fontSize: PT(22), color: C.muted });
        const items = s.milestones.slice(0, 4).map((m) => (typeof m === 'string' ? m : ((m.when ? m.when + '  ' : '') + (m.what || ''))));
        bullets(slide, items, { x: mx, y: y + IN(52), w: IN(520), h: IN(440), fontSize: PT(22) });
      }
      return slide;
    },
    roadmap(s) {
      const { slide, y } = content(s);
      const items = s.milestones.slice(0, 6);
      const n = Math.max(1, items.length);
      const gap = IN(48);
      const colW = (CW - gap * (n - 1)) / n;
      const ly = y + IN(120);
      slide.addShape(pres.ShapeType.line, { x: ML, y: ly, w: CW, h: 0, line: { color: C.rule, width: 1.5 } });
      items.forEach((m, i) => {
        const x = ML + i * (colW + gap);
        slide.addShape(pres.ShapeType.ellipse, { x, y: ly - IN(10), w: IN(20), h: IN(20), fill: { color: C.accent }, line: { color: C.accent, width: 0 } });
        const when = typeof m === 'string' ? '' : (m.when || '');
        const what = typeof m === 'string' ? m : (m.what || '');
        const proves = typeof m === 'string' ? '' : (m.proves || '');
        if (when) text(slide, when, { x, y: ly + IN(48), w: colW, h: IN(32), fontSize: PT(24), color: C.muted });
        text(slide, what, { x, y: ly + IN(when ? 92 : 48), w: colW, h: IN(proves ? 170 : 300), fontSize: PT(n > 4 ? 24 : 28) });
        if (proves) text(slide, proves, { x, y: ly + IN(when ? 200 : 156), w: colW, h: IN(160), fontSize: PT(22), color: C.muted });
      });
      bullets(slide, s.points, { x: ML, y: ly + IN(440), w: IN(1200), h: IN(200), fontSize: PT(26) });
      return slide;
    },
    closing(s) {
      const slide = pres.addSlide({ masterName: 'COVER' });
      if (!image(slide, ctx.logoFile, ML, IN(96), IN(600), IN(72))) {
        text(slide, meta.company, display({ x: ML, y: IN(96), w: IN(800), h: IN(50), fontSize: PT(36) }));
      }
      // one-liner, three hero facts in columns, contact line
      let bottom = IN(1080 - 160);
      if (s.subtitle) { bottom -= IN(60); text(slide, s.subtitle, { x: ML, y: bottom, w: IN(1400), h: IN(60), fontSize: PT(28), color: C.muted, valign: 'bottom' }); bottom -= IN(48); }
      if (s.points.length) {
        const facts = s.points.slice(0, 3);
        const gap = IN(72);
        const colW = (CW - gap * (facts.length - 1)) / facts.length;
        bottom -= IN(200);
        facts.forEach((p, i) => {
          const x = ML + i * (colW + gap);
          slide.addShape(pres.ShapeType.line, { x, y: bottom, w: colW, h: 0, line: { color: C.rule, width: 0.75 } });
          slide.addShape(pres.ShapeType.rect, { x, y: bottom + IN(28), w: IN(16), h: IN(16), fill: { color: C.accent }, line: { color: C.accent, width: 0 } });
          text(slide, p, { x, y: bottom + IN(64), w: colW, h: IN(136), fontSize: PT(28) });
        });
        bottom -= IN(72);
      }
      text(slide, s.title || meta.company, display({ x: ML, y: bottom - IN(300), w: IN(1560), h: IN(300), fontSize: PT(100), valign: 'bottom', charSpacing: -3 }));
      return slide;
    },
    appendix(s) {
      const { slide, y } = content(s);
      if (s.chart) {
        const cw = IN(1080), ch = Math.min(IN(520), IN(900) - y);
        addChart(slide, s.chart, ML, y, cw, ch); chartSource(slide, s.chart, ML, y + ch + IN(10), cw, s.source);
        sideColumn(slide, s, SW - ML - IN(500), y);
      } else if (s.rows.length) {
        tableWithPoints(slide, s, y);
      } else if (image(slide, ctx.images[s._i], ML + IN(900), y, IN(780), IN(560))) {
        bullets(slide, s.points, { x: ML, y, w: IN(800), h: IN(960) - y, fontSize: PT(30) });
      } else pointsAndStats(slide, s, y);
      return slide;
    },
    case_study(s) { return R.appendix(s); },
    sources(s) {
      const { slide, y } = content(s);
      const items = s.items || [];
      if (!items.length) { bullets(slide, s.points, { x: ML, y, w: IN(1200), h: IN(960) - y, fontSize: PT(26) }); return slide; }
      const cellBorder = (pt, color) => [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt, color }, { type: 'none' }];
      if (s.groups) {
        text(slide, s.figures + ' figures from ' + s.fileCount + ' source ' + (s.fileCount === 1 ? 'file' : 'files') + '. Each figure has an entry in the fact ledger (facts.yaml) that names its file and location.', { x: ML, y: y - IN(60), w: CW, h: IN(40), fontSize: PT(22), color: C.muted });
        const hdr = ['Source file', 'Figures', 'Kinds', 'Slides'].map((t) => ({ text: t, options: { bold: true, color: C.ink, border: cellBorder(1, C.ink) } }));
        const rows = s.groups.map((g) => [g.file, String(g.count), g.kinds, g.slides].map((t, j) => ({ text: t, options: { color: C.ink, bold: j === 0, border: cellBorder(0.5, C.rule) } })));
        slide.addTable([hdr].concat(rows), { x: ML, y, w: CW, colW: [CW * 0.46, CW * 0.1, CW * 0.24, CW * 0.2], rowH: 0.36, fontSize: 11, fontFace: BODY, color: C.ink, margin: 0.05, valign: 'middle', autoPage: false });
        return slide;
      }
      if (items.some((it) => it.label)) {
        // ledger table: id, label, value, kind, as of, file
        const hdr = ['Ref', 'Ledger id', 'Label', 'Value', 'Kind', 'As of', 'Source file'].map((t) => ({ text: t, options: { bold: true, color: C.ink, border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 1, color: C.ink }, { type: 'none' }] } }));
        const rows = items.map((it) => [String(it.ref), it.id, (it.label || '') + '\nslide ' + it.slide, it.value || '', it.kind || '', it.asOf || '', (it.file || '') + (it.method ? '\n' + it.method : '')].map((t, j) => ({ text: t, options: { color: j === 0 || j === 6 ? C.muted : C.ink, bold: j === 1, border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 0.5, color: C.rule }, { type: 'none' }] } })));
        const rowH = Math.min(0.42, (BODY_H - 0.1) / (rows.length + 1));
        slide.addTable([hdr].concat(rows), { x: ML, y, w: CW, colW: [0.5, 2.2, 2.6, 1.6, 0.9, 1.0, CW - 8.8], rowH, fontSize: Math.max(8, Math.min(10, rowH * 28)), fontFace: BODY, color: C.ink, margin: 0.05, valign: 'top', autoPage: false });
        return slide;
      }
      const half = Math.ceil(items.length / 2);
      [items.slice(0, half), items.slice(half)].forEach((col, c) => {
        if (!col.length) return;
        const runs2 = col.map((it, i) => [
          { text: it.ref + '   ', options: { color: C.muted } },
          { text: it.id, options: { bold: true } },
          { text: '   slide ' + it.slide + (it.title ? ': ' + it.title : ''), options: { color: C.muted, breakLine: i < col.length - 1 } },
        ]).reduce((a, b) => a.concat(b), []);
        slide.addText(runs2, { x: ML + c * (CW / 2 + IN(24)), y, w: CW / 2 - IN(48), h: IN(960) - y, isTextBox: true, margin: 0, fontSize: PT(20), color: C.ink, valign: 'top', paraSpaceAfter: 8 });
      });
      return slide;
    },
    custom_html(s) {
      const { slide, y } = content(s);
      const plain = String(s.html || '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
      text(slide, 'Custom HTML slide. The designed version is in deck.html; this is its text content.', { x: ML, y, w: CW, h: IN(40), fontSize: PT(22), color: C.muted });
      text(slide, plain.slice(0, 1500), { x: ML, y: y + IN(60), w: CW, h: IN(960) - y - IN(60), fontSize: PT(26) });
      return slide;
    },
    two_column(s) {
      const { slide, y } = content(s);
      const cols = s.columns.slice(0, 2).map((c) => (typeof c === 'string' ? { title: c } : c || {}));
      const colW = (CW - IN(120)) / 2;
      cols.forEach((c, i) => {
        const x = ML + i * (colW + IN(120));
        let yy = y + IN(80);
        if (c.title) { text(slide, c.title, display({ x, y: yy, w: colW, h: IN(56), fontSize: PT(40) })); yy += IN(84); }
        if (c.body) { text(slide, c.body, { x, y: yy, w: colW, h: IN(140), fontSize: PT(28) }); yy += IN(160); }
        bullets(slide, asArray(c.points).slice(0, MAX_POINTS), { x, y: yy, w: colW, h: IN(960) - yy, fontSize: PT(26) });
      });
      return slide;
    },
  };

  slides.forEach((s, i) => {
    s._i = i;
    const fn = R[s.type] || R.statement;
    const slide = fn(s);
    const notes = notesText(s);
    if (notes) slide.addNotes(notes);
  });

  await pres.writeFile({ fileName: outPath });
  await stripZipFolders(outPath);
  return true;
}

// --------------------------------------------------------------------------------------
// 6. PPTX checks
// --------------------------------------------------------------------------------------
// Always: scripts/pptx_check.py, a structural check with the Python standard library.
// Also, when the user has Anthropic's pptx skill installed, its OOXML validator (it is
// not part of this skill and is never required).

function pythonCandidates() {
  return [process.env.PITCH_PYTHON, 'python3', 'python'].filter(Boolean).filter((c) => spawnSync(c, ['--version'], { encoding: 'utf8' }).status === 0);
}

// An external copy of Anthropic's validate.py: PITCH_PPTX_VALIDATOR, then the usual
// install locations of their pptx skill. The plugin cache is searched with a bounded walk.
function findExternalValidator() {
  const tail = ['pptx', 'scripts', 'office', 'validate.py'];
  const isFile = (f) => { try { return fs.statSync(f).isFile(); } catch (e) { return false; } };
  const dirs = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort(); } catch (e) { return []; } };
  if (process.env.PITCH_PPTX_VALIDATOR && isFile(process.env.PITCH_PPTX_VALIDATOR)) return process.env.PITCH_PPTX_VALIDATOR;
  const home = require('os').homedir();
  const direct = path.join(home, '.claude', 'skills', ...tail);
  if (isFile(direct)) return direct;
  const synced = path.join(home, '.claude', 'skills', 'synced');
  for (const d of dirs(synced)) { const f = path.join(synced, d, ...tail); if (isFile(f)) return f; }
  // ~/.claude/plugins/**/skills/pptx/scripts/office/validate.py: at most 6 levels and 3000 directories
  let seen = 0;
  const walk = (dir, depth) => {
    if (depth > 6 || seen > 3000) return null;
    for (const d of dirs(dir)) {
      seen += 1;
      if (d === 'node_modules' || d.startsWith('.git')) continue;
      const sub = path.join(dir, d);
      if (d === 'skills') { const f = path.join(sub, ...tail); if (isFile(f)) return f; }
      const hit = walk(sub, depth + 1);
      if (hit) return hit;
    }
    return null;
  };
  const plugin = walk(path.join(home, '.claude', 'plugins'), 0);
  if (plugin) return plugin;
  const agents = path.join(home, '.agents', 'skills', ...tail);
  return isFile(agents) ? agents : null;
}

function checkPptx(pptxPath, slideCount) {
  const name = path.basename(pptxPath);
  const pys = pythonCandidates();
  if (!pys.length) { log('  python3 not found: ' + name + ' was written but not checked.'); return; }
  const script = path.join(__dirname, 'pptx_check.py');
  if (fs.existsSync(script)) {
    const r = spawnSync(pys[0], [script, pptxPath, '--slides', String(slideCount)], { encoding: 'utf8' });
    const lines = ((r.stdout || '') + (r.stderr || '')).trim().split(/\r?\n/).filter((l) => l.trim());
    log('  pptx_check (exit ' + r.status + '): ' + (lines[0] || 'no output').replace(/^pptx_check:\s*/, ''));
    if (r.status !== 0) { lines.slice(1).forEach((l) => log('    ' + l.trim())); process.exitCode = 1; }
  } else log('  scripts/pptx_check.py not found: ' + name + ' was written but not checked.');

  const ext = findExternalValidator();
  if (!ext) return;
  const py = pys.find((c) => spawnSync(c, ['-c', 'import lxml, defusedxml'], { encoding: 'utf8' }).status === 0);
  if (!py) { log('  validate.py: found at ' + ext + ' but lxml and defusedxml are missing, skipped (uv pip install lxml defusedxml).'); return; }
  const r = spawnSync(py, [ext, pptxPath], { encoding: 'utf8' });
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  // the verdict is the validator's last line; notes and errors before it follow indented
  const vl = out.split(/\r?\n/).filter((l) => l.trim());
  log('  validate.py (exit ' + r.status + '): ' + (vl.length ? vl[vl.length - 1].trim() : 'no output'));
  vl.slice(0, -1).forEach((l) => log('    ' + l.trim()));
  if (r.status !== 0) process.exitCode = 1;
}

// --------------------------------------------------------------------------------------
// 7. QA screenshots and overflow check (--check, needs playwright-core)
// --------------------------------------------------------------------------------------

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const mac = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium'];
  for (const p of mac) if (fs.existsSync(p)) return p;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
    const r = spawnSync('which', [name], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return null;
}

// Runs inside the page: reports text that leaves the stage, overlaps a sibling, or
// sits inside a container that scrolls.
function pageCheckScript() {
  return function (dims) {
    const W = dims.W, H = dims.H;
    const slide = document.querySelector('.slide.active');
    const issues = [];
    if (!slide) return ['no active slide'];
    if (slide.scrollHeight > H + 1 || slide.scrollWidth > W + 1) issues.push('slide content overflows the stage: ' + slide.scrollWidth + 'x' + slide.scrollHeight);
    const leaves = [];
    slide.querySelectorAll('*').forEach((el) => {
      if (el.closest('svg') || el.closest('.custom')) return;
      const hasText = Array.from(el.childNodes).some((nd) => nd.nodeType === 3 && nd.textContent.trim());
      if (!hasText) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      leaves.push({ el, r, label: (el.textContent || '').trim().slice(0, 40) });
      if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) issues.push('text leaves the stage: "' + (el.textContent || '').trim().slice(0, 40) + '"');
      if (!el.closest('.foot, .slide-source') && r.bottom > H - 100 && !el.classList.contains('warn-badge')) issues.push('text too close to the footer: "' + (el.textContent || '').trim().slice(0, 40) + '"');
      let p = el.parentElement;
      while (p && p !== slide) {
        const cs = getComputedStyle(p);
        if (cs.overflow === 'hidden' || cs.overflowY === 'hidden') {
          if (p.scrollHeight > p.clientHeight + 2) issues.push('text clipped by its container: "' + (el.textContent || '').trim().slice(0, 40) + '"');
          break;
        }
        p = p.parentElement;
      }
    });
    for (let i = 0; i < leaves.length; i++) {
      for (let j = i + 1; j < leaves.length; j++) {
        const a = leaves[i], b = leaves[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (ox > 6 && oy > 6) issues.push('text overlaps: "' + a.label + '" and "' + b.label + '"');
      }
    }
    return Array.from(new Set(issues));
  };
}

async function runCheck(htmlPath, outDir, slideCount) {
  let pw;
  try { pw = require('playwright-core'); } catch (e) {
    log('  --check skipped: playwright-core is not installed. Run: npm install --prefix ' + path.relative(process.cwd(), __dirname) + ' playwright-core   (uses your installed Chrome, no browser download)');
    return;
  }
  const exe = findChrome();
  let browser;
  try {
    browser = await pw.chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
  } catch (e) {
    try { browser = await pw.chromium.launch({ channel: 'msedge' }); } catch (e2) {
      log('  --check skipped: no Chrome or Edge found for playwright-core (' + e.message.split('\n')[0] + ')');
      return;
    }
  }
  const qaDir = path.join(outDir, 'qa');
  fs.mkdirSync(qaDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: STAGE_W, height: STAGE_H }, deviceScaleFactor: 1 });
  await page.goto('file://' + htmlPath + '?noscale', { waitUntil: 'load' });
  // Measure the real faces: wait for the web fonts, then report which ones loaded.
  const fonts = await page.evaluate(async () => {
    if (!document.fonts) return { loaded: [], linked: false };
    await document.fonts.ready;
    await new Promise((r) => setTimeout(r, 250));
    await document.fonts.ready;
    const loaded = Array.from(document.fonts).filter((f) => f.status === 'loaded' && !/Fallback/.test(f.family)).map((f) => f.family.replace(/"/g, ''));
    return { loaded: Array.from(new Set(loaded)), linked: !!document.querySelector('link[href*="fonts.googleapis.com"]') };
  });
  if (fonts.loaded.length) log('  QA fonts: ' + fonts.loaded.join(', ') + ' (web fonts loaded)');
  else if (fonts.linked) warn('web fonts did not load (offline or blocked); QA measured the fallback fonts, which are narrower. Re-run --check online before trusting a clean result.');
  const report = [];
  let issueCount = 0;
  for (let i = 0; i < slideCount; i++) {
    await page.evaluate((k) => window.deck.go(k), i);
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
    await page.waitForTimeout(120);
    const file = path.join(qaDir, 'slide-' + String(i + 1).padStart(2, '0') + '.png');
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: STAGE_W, height: STAGE_H } });
    const issues = await page.evaluate(pageCheckScript(), { W: STAGE_W, H: STAGE_H });
    issueCount += issues.length;
    report.push({ slide: i + 1, file: path.relative(outDir, file), issues });
    if (issues.length) log('  slide ' + (i + 1) + ': ' + issues.slice(0, 6).join('; ') + (issues.length > 6 ? '; +' + (issues.length - 6) + ' more' : ''));
  }
  await browser.close();
  fs.writeFileSync(path.join(qaDir, 'report.json'), JSON.stringify(report, null, 2));
  log('  QA: ' + slideCount + ' screenshots in ' + rel(qaDir) + '/, ' + issueCount + ' issue' + (issueCount === 1 ? '' : 's') + ' (report.json)');
}

// --------------------------------------------------------------------------------------
// 8a. Text measurement for the capacity lint
// --------------------------------------------------------------------------------------
// Advance widths of the glyphs in GLYPH_SET for 50 Google Fonts families (the theme faces
// and the usual font_display / font_body overrides), measured in Chrome with the real font
// files at weights 400 and 700: two base-36 digits per glyph, in thousandths of an em,
// then the factor by which running text is wider than the sum of its glyphs (kerning,
// optical sizes).
// With these the lint lays out the actual words of a deck instead of guessing from a
// character count. Regenerate with a headless browser if a theme face changes.
const GLYPH_SET = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u00a3\u20ac\u2013\u2019\u201c\u201d\u00d7\u00e9\u00fc\u00f6\u00e4";
const FONT_W = {
  // the four theme faces exactly as the stylesheet sets them (display weight and optical size at 64px; body at 400)
  "theme:graphite:display": ["6e7287ghghm4ke3w7k7m97fo6i816fabghghghghghghghghghgh7b7lfofofoc0ork1i4jeleifgdkymq9mankuh1s6l3luheluj1fhhnkmfepbk4edhx879b87fobedwdufxcvg9dh9rdzg57n6yfl7go4gdfjgbfvb0bd9vfreyl5f8encu866d86foghghco4ma59kfodhfrfjdu", "6e7287ghghm4ke3w7k7m97fo6i816fabghghghghghghghghghgh7b7lfofofoc0ork1i4jeleifgdkymq9mankuh1s6l3luheluj1fhhnkmfepbk4edhx879b87fobedwdufxcvg9dh9rdzg57n6yfl7go4gdfjgbfvb0bd9vfreyl5f8encu866d86foghghco4ma59kfodhfrfjdu"],
  "theme:graphite:body": ["786o9ejffkkrj24u6666a7fk6o936obmfkfkfkfkfkfkfkfkfkfk6o6ofkfkfkd5oahpgpjkiyg9eokbiu6ufchmdrnbisksfeligmfodri8gnpkhtekg676cg76fcb984f0gbeegbf09beaf76a6aes7dn0f7g1gbgbbbd29mf7e4kmege4d46n766nfkfkfkbg7bc4c6fkf0f7g1f0", "786o9ejffkkrj24u6666a7fk6o936obmfkfkfkfkfkfkfkfkfkfk6o6ofkfkfkd5oahpgpjkiyg9eokbiu6ufchmdrnbisksfeligmfodri8gnpkhtekg676cg76fcb984f0gbeegbf09beaf76a6aes7dn0f7g1gbgbbbd29mf7e4kmege4d46n766nfkfkfkbg7bc4c6fkf0f7g1f0"],
  "theme:paper:display": ["7s7u9pntg7mej75mc8c9dah97xek789xht8zgigki6h9h0fghdh07f8fe2ije2f7rojuipl6kagtgblaju7eeli5erokjtlshklshyg7fujnifqwkmgogn959x95j1fj6tengjfagpfm90gpfo7q7kfg6uolfkgbgpgpa9dha2fleykne8eodbao87anggh2lrhl7pcscsfrfmflgben", "7s7u9pntg7mej75mc8c9dah97xek789xht8zgigki6h9h0fghdh07f8fe2ije2f7rojuipl6kagtgblaju7eeli5erokjtlshklshyg7fujnifqwkmgogn959x95j1fj6tengjfagpfm90gpfo7q7kfg6uolfkgbgpgpa9dha2fleykne8eodbao87anggh2lrhl7pcscsfrfmflgben"],
  "theme:paper:body": ["7s798hmjfyl2jk5abcbdd8ho7ceh6j8vhh8igpgni7hcgnfghkgn6s7sdtijdsf8rbioicl9k9gxgblejl6ye4gvego0jllph0lphdfyfkjdhppvjoftgk8a8w8ai5eb6ieogufggufo90gufr766zee6cowfngegugua0d79sfmedkmdddxdbah7wagf5gtlthm6yb7b7fffofmgeeo", "7s798hmjfyl2jk5abcbdd8ho7ceh6j8vhh8igpgni7hcgnfghkgn6s7sdtijdsf8rbioicl9k9gxgblejl6ye4gvego0jllph0lphdfyfkjdhppvjoftgk8a8w8ai5eb6ieogufggufo90gufr766zee6cowfngegugua0d79sfmedkmdddxdbah7wagf5gtlthm6yb7b7fffofmgeeo"],
  "theme:signal:display": ["598qd5hdg3rcmo7baeaebbi18u998u8ehdhdhdhdhehdhdhdhdhd9a9ai1i1i1h0rwkqkpkwkzjfhsmnlv95hhlehbpelvmijemikujdgtlrjvqskgijiya68ea6i1eu75h4hlh0hlh79shkhh807ygy80q1hhhnhlhlbag3aphhfxnvh0fxeuav7davi1hfhfdw77dsdsi1h7hhhnh4", "598qd5hdg3rcmo7baeaebbi18u998u8ehdhdhdhdhehdhdhdhdhd9a9ai1i1i1h0rwkqkpkwkzjfhsmnlv95hhlehbpelvmijemikujdgtlrjvqskgijiya68ea6i1eu75h4hlh0hlh79shkhh807ygy80q1hhhnhlhlbag3aphhfxnvh0fxeuav7davi1hfhfdw77dsdsi1h7hhhnh4"],
  "theme:signal:body": ["6u898vhhfolthv5j9q9qddhb6abl5sathtbhfjf4h9fyfqexh2fq7177hbhbhbe0rhitgyk1j4ggetl4kv7jebgwegnhlilkfzloheh2e2jnj4qkh2g0ht8zat8zfbc665e6gaf1g9f6a9gcfi6g7gdh64nnfig4gfg29ecyaifie9lkd8efdoap75apfrg0idfa519696hbf7fig4e4", "6u898vhhfolthv5j9q9qddhb6abl5sathtbhfjf4h9fyfqexh2fq7177hbhbhbe0rhitgyk1j4ggetl4kv7jebgwegnhlilkfzloheh2e2jnj4qkh2g0ht8zat8zfbc665e6gaf1g9f6a9gcfi6g7gdh64nnfig4gfg29ecyaifie9lkd8efdoap75apfrg0idfa519696hbf7fig4e4"],
  "theme:midnight:display": ["608mcgjsi3odjw6para7ftgi7he37haql0bthfheiehpitgki9it7h7hgigegievv9lhj4m6lsgkfdn4m992huk8fdqio3o1ieo1k0iqg2lojtt5johnhyaraaa7gqg98cgbjegxjeh8ajiyi09198h58hr6i0ivjejeblf9bzhrg4otgafidtarafa7enhkjoeh6tdbcygih8hrivgb", "608mcgjsi3odjw6para7ftgi7he37haql0bthfheiehpitgki9it7h7hgigegievv9lhj4m6lsgkfdn4m992huk8fdqio3o1ieo1k0iqg2lojtt5johnhyaraaa7gqg98cgbjegxjeh8ajiyi09198h58hr6i0ivjejeblf9bzhrg4otgafidtarafa7enhkjoeh6tdbcygih8hrivgb"],
  "theme:midnight:body": ["6k7wb8jtgmprja6b9b9bc3go7kb37kangogogogogogogogogogo8484gogogod9orhti5h9ing7ezjbjnb4e6hcdxmkjnjogkjohsg5d4iufonxh1dzg48tan8tgofpgoeug4dzg4f990eofs6y6yen7ko9fsfkg4g4a7dj9rfsdgl7e3dncw9j8q9jgogjhdgc67btbsgof9fsfkeu", "6k7wb8jtgmprja6b9b9bc3go7kb37kangogogogogogogogogogo8484gogogod9orhti5h9ing7ezjbjnb4e6hcdxmkjnjogkjohsg5d4iufonxh1dzg48tan8tgofpgoeug4dzg4f990eofs6y6yen7ko9fsfkg4g4a7dj9rfsdgl7e3dncw9j8q9jgogjhdgc67btbsgof9fsfkeu"],
  // Google Fonts families at weights 400 and 700
  "Newsreader": ["6d7i9tfrfrlojx5i7x7xbie86m756earfrfrfrfrfrfrfrfrfrfr717ge8e8e8byorjqhijil5hsfnknm89ebwk6grr7l4lggxlghxffevk7gcp5jyejhl94ap96e8bedwcgejb8erbr9ldffl7s6vex7hn4fxdcf0egaya599exenkne3ejbu8y708ye8frfrbr5zbeaue8brexdccg", "5x84b0hmhmo4lc5n8f8fbae8787i74azhmhmhmhmhmhmhmhmhmhm7p7ve8e8e8dlp0lnjgjtm3j3h0lenpasdkm1i8t4lqltj5ltk8gogcl1hgrdlofsig94ax94e8bfdwdpfkcdfqclbbeogr8s85gm8homh1e4fyfecibgb2gefnmbf7fsd28z6r8ze8hmhmbc6kdkcne8clgee4dp", 1.026],
  "Hanken Grotesk": ["786o9ejffkkrj24u6666b2fk6o936obmfkfkfkfkfkfkfkfkfkfk6o6ofkfkfkecoahpghjkiyg9eckbiu6ufchmdrnbisksfeligmfae2i8hfq4htfcg676cg76fcb984f0fndpfme09be5f76a6aes7dn0f7engbfmbbd29mf7ehksegehd46n766nfkfkfkbg7bc4c6fke0f7enf0", "7870a6jafkkfjg5d7p7pb3fk6o936obofkfkfkfkfkfkfkfkfkfk6o6ofkfkfkebo9iqgojpiqg2eekfj97bfgife0nsj5krfmlth0fiexi9hwqsimg0gt8bcc8bhfdp8of1fadkf6du9oegfo6t6tfk7qnffoecfjf6bucya7foevkzf2evd37v7j7vfkfkfkbw7icucvfkdufoecf1", 1.022],
  "Albert Sans": ["7s798hmjfyl2jk5abcbdd8ho7ceh6j8vhh8igpgni7hcgnfghkgn6s7sdtijdsf8rbioicl9k9gxgblejl6ye4gvego0jllph0lphdfygyjditqzjoi1gk8a8w8ai5eb6ieegaecgaek90gafr766zee6comfdfagagaa0d79sfmenkydne9dbah7wagf5gtlthm6yb7b7ffekfmfaee", "7s82a5o6ggn1j45qceced7h07yel7hadhx99gggii6h5gzfahbgz7o8he6ihe5f8rvkjivl1kcgwggl4jw7jewipexoqjvlqhtlqi8gghnjpk2sfkzjlgr9oad9ojdg26ye9fudyfye996fyfr7x7rfs6zo3f5eyfyfyakdka7fmfflef8fidgat8aash2h6lphj7uddddfxe9fmeye9", 1.029],
  "Archivo": ["5t7laeg6e6qej85t9v9vbbhd7p7l7p86fxehfrfxfffvfxfdfyfx8787hdhdhdg2rxiojek8keith0m4kg7ffjieecnjkglwihlwk7ipfvkbh6ouhsgohn888688hddh57ekf6duf6el7sfgfn6967db69nwfnepf6f698dq89fme0k3e9e0du9t6t9thdftg5c86nayayhdelfmepek", "5g8dcngofgr1l871a4a4bbht8j7l8j8cgjgkgkgkglgjgkgkgkgj9b9bhththth1rtjuk2kdkjizhambky8dgrk5fvo8kym1ixm1kaivh2ksigpyiihpi59q8c9qhtee6cfeg4f5g4fb91gvgq7f7ceu7forgqfgg4g4akes9igpf7m6fwf7efax71axhtgngnc87sdkdkhtfbgpfgfe", 1.027],
  "Figtree": ["6v8a8whhfnlthv5k9s9sddhb6abl5sathtbhfjf4h9fzfpexh2fp7177hbhbhbe0rhisgzk1j4ggf3l4kv7jebgyegnhlilkg3lohdh2fcjoj9qoh2gsht90at90fbc665e1g5erg5ewa9g6fi6g7gdh64nnfifugafx9ecyaifieglsd7emdnap76apfrg0iefa519696hbexfifue4", "6m8obghjfemli06tamamdkhk75bc6wc0i0bqg3fghlg5g4fgh0g48d8hhkhkhke9rkjuh1k5jggdfeknku81fciiexntlhlvgrlxhxgvg8jkk2rdivhzhk9kc09kg5c27bebg2e6g1eeaxg7fu7a83ey6uo8fsf5g7fyajcyb6fsfgn7ewg0d9ay74ayijgjjbfa63bjbjhkehfsf5eo", 1.02],
  "Sora": ["6c88ayj8i4nmj46aa2a2frge7acg7a9kknboh6h2huhbibfyhpib7a7agegegeeov6l0iwm3lzgofan3mc8qhsiuf4pknlo1hso1jgixfmlxj6szjchai6a296a2fwgk8cfpitggitgmanifhq8k8vfx7yquhqi4ititbjelbqh4fjnkfkf7dca2aea2drhcjgco6cbubqgegmh4i4fp", "5u8tctk2i2oqkb6jahahfugk7lcq7lbbl7bwhjhkiohwj3gvijj37l7lgkgegkf0vblpj8m8lpgif8n5m898hvkwfiqzoco0ijo0kaicgcljk3trk1hehzahasahh5h18cg8j6gkj6gwatipi3999hhr8rrbi3i5j6j6bvezc1hlgkplgofudpahafahf3hojsd773dpdmgkgwhli5g8", 1.012],
  "IBM Plex Sans": ["6k7wc7jtgmpriq7a9b9bd2go7k957kangogogogogogogogogogo8484gogogod9o7hthvh9ing7ekjbjnb4e6hce7mkjnjogfjohsg5d4iugdo7h1fdg48tan8tgogtgoeufsdnfsel90eofs6y6yen7ko9fsewfsfsa7cv9rfsdolce3dvcw9j8q9jgogjhdee7qcxdbgoelfseweu", "6k8wdphkgpr2j77g9e9egpgo8m998mcsgogogogogogogogogogo9696gogogodwnzj1i7i3jdgvf5jzk4c0f4j7f0mrk4juhtjuiqhceajahiqhipftgv9acs9agogkgoftggdxggeqa1fcgk7y7yg18fougkesggggb8dfangkeyndfkeueeacb6acgog6hfee7nebe6goeqgkesft", 1.018],
  "Inter": ["7t80cyhlhurahw8ca5a5dxh580bj80a0hjbbgyh6hyghh8fqh7h8808eiegiiee7quj6i6kak2gpgekqkn7hfviofpp3kxl9hrl9hwhuegkoj6rdiyivhha5a0a5d3co8zfmgeemgeeyaugfgf6q6qf96qocgfffgegeaweo9ngffmmqf6fmfcbu99buh5gzijdw79c8c8ieeygffffm", "6l9efbi1i7s7io9fahahfjhm9abr9aasiqbzhihxishai2g5i3i29a9jivgzivfjs8kriekkk2gvgbkukr7tg8jzfppwl6lei0lli9i7gskckrsukikbigahasahdjd8a5g2gyf8gyffbgh0hb7j7jg47jpchafxgygybrfkakhbgonmg4gqfxd1acd1hmhqj1dw8mf0esivffhbfxg2", 1.015],
  "Fraunces": ["688l9bi1gfkikn4c9l9lhcfg71bk6qdoi0cggiezgjfpgge2g5gk6w77e8fge8drokjsiujclphygal1n0ald1l3h2oylkm2ihm2jugehwknhtqzk3guho92dn96ddd86df2gfe4gteha6fih98d8dgj8gq0h9g7gvggcjd0a4gvfamieqfed6as7bashphkj8eb5sbfbydxehgvg7f2", "5u98beiph5mwlq5ialalhbfq8mb88adyjidlhugfifgyhyfai5hz8c8oejfqejftqgl5kljsmpishhliocc2ffn0i0qjlgm8kcm8lzhgjql2iksbkmhdi4a7dyafd8e17jg4hhezhsf6bsgkie9a9ahq9brbiegwhvhie1e5bii2funxfzgbe6bj8hbjhri7k3fc78efemexf6i2gwg4", 1.006],
  "Space Grotesk": ["7571bthgh1lggt6zajahegh86zak71aahtbmgrgthdgnh0fohbh07171h8h8h8g4sihiidhuiffnf0ici86sgigyf6o1igilgpilhjh1e4iigeobhqevg297aa97h8h87sfngzetgzencagyh16t6vey6tnwh1fcgzgzahe3csh1f0m9ghh1ehbw6obwh8hgizes6zbtbth8enh1fcfn", "728aeahogul2gf86b2auf0h886a08aasi0ckgigwhogoh6fegoh68a8ah8h8h8g2s6hmighwiifeeuiei87cgyhef2oiimisgsishkgue4iogioyhwfgg09yas9yh8h888fugueigue9c4guh47e7gfo7enqh4f8gugub0e5coh4f8lsggh4eecy76cyh8hqiue886eaeah8e9h4f8fu", 1.032],
  "Instrument Sans": ["5k6d7mjwgwlukz3e8t8o9dbf5b9b5b9vho9tf5fie7edfvb8fdge6o6oerd7dbecnpk2gsjmk6gyekk0kg72bwj8fxp6kgkqhnlfhrfwcsibh0rkikemgba0cba0c6as9ue2fwd2g0dt9rg9g85y5tdv6op7g8ecfwg0a7cbahfkegl8fbegdka26qa7cwgcjhbh3v8l85erdtfkefe2", "5f6iabkhi9lzln4d9b989tc7657s659shca6fsfgele0fuc3fagi7g7gfgdfdsezofkbgpj8k4h0edjlk577aqk5fzozk5khi5lzi6gjdrhzh1qyjvfdgubycibycta59zdzgdd9ghdn9ygngk6664fy7nprgkefgdghavcgbhfjf6mhgof6dqby6jbydugzk7b050bubafgdnfjeedz", 1.082],
  "Instrument Serif": ["5a75avi7blgygn71akakcwfb6lbm6h7qdc7hbsavbhb6bsaoclbq6h6lfbfbfb9di2cddodwf2d5b8f1fq7h6tdcc1ilf0fcdifce9bbclesbxhbe8c1cf9l7q9lclb0aebfch9jct9z7ub4d66r6jb76ajwdeascic49e8i7fd6ahgba5ajad9e7k9efbf0ebdu609wa6fb9zd6b2bf", "5a75avi7blgygn71akakcwfb6lbm6h7qdc7hbsavbhb6bsaoclbq6h6lfbfbfb9di2cddodwf2d5b8f1fq7h6tdcc1ilf0fcdifce9bbclesbxhbe8c1cf9l7q9lclb0aebfch9jct9z7ub4d66r6jb76ajwdeascic49e8i7fd6ahgba5ajad9e7k9efbf0ebdu609wa6fb9zd6b2bf", 1],
  "Playfair Display": ["6c7a8ahpejkmn9597u7wdogb79cs70acgoaadbcjdqbjedbaege57e7xgwhzgwcroehigpimjogxftj1l19f8ki7gco7jejpg9jpi0f0h9i3g1nyhmffgi88ac88ewgf7vduf6d1fod798eogc857ffa7yoogleafof6cdcf9ug5dlleefe0d88g668gi1gqg8es6tbmbje6d7g5eadu", "5w80a9h8fyk8oy5t8p8qddfy7jby7ia8hxanejdkeocrflcnflfd8288gqhngqe4okiji5izl7hmggjtm8ag9ojugzprjul2htl2j8g8ikibh8pqj7gagq8ya88yepgw88eefqd6g2d19sfdgw8r89g98np5h2elg4fpczcu9sgue4lvewefd6997199ikichrfb71cwcrdpd1guelee", 1.021],
  "DM Sans": ["7e6y83mcg4luke4fadaddcfa52f15iawj08og3gfgvgyhgeugwhg5m6bfafafaekrxiggrjxj4fpevl2ix6idxg8enndj7lig4ligig4eai7ilqwgrg4f18qaw8qhaic5xf1gtfbguek9gfifz6o6re067orfyfbgtguaadyawfxenl7dsfgcqbv6ibvfagplfil5ua7a7faekfxfbf1", "6j8la7nsgsp2lp5ib9b9e9g36ufz70bwjka4gegri2h9hmewhkhm737rg3g3g3ezt2johqkijng7fgllju7lf1i5fjolkalrh2lrhigsfkj0jmsaimhng2ahbwahisk56jfxhgg5hgf0abgkh67m7ng27fq5h5fhhghgbderc1h4fqmsfvgsdmd27ld2g3hflxjc73clclg3f0h4fhfx", 1.024],
  "DM Serif Display": ["6097b5ffeqo5jo5j9q9qazez8a7l8a8vdw9oeqeqeweqeodjdweq8a8aezezezdpnzi4g4g3hofddrh4j58ba3i4eylxh2i4fni4hedzeffjdsm5h0cefi908z90ezeqb2e5fjcnfcdb9hefg27q7dg77wo5g0dzewexc7bw9tfeeolnfueucv8w7d8wezeqeqd556bwb1ezdbfedze5", "6097b5ffeqo5jo5j9q9qazez8a7l8a8vdw9oeqeqeweqeodjdweq8a8aezezezdpnzi4g4g3hofddrh4j58ba3i4eylxh2i4fni4hedzeffjdsm5h0cefi908z90ezeqb2e5fjcnfcdb9hefg27q7dg77wo5g0dzewexc7bw9tfeeolnfueucv8w7d8wezeqeqd556bwb1ezdbfedze5", 1.03],
  "Manrope": ["5k8pawpkgdp1i35xbubuc5g17db471a7gyaufufdg4g2h9dyg4h98b8hh2kuh2ekp4hmh1jvinfudzjlj16hcwgie6ndj0jjgsjjhjh4d9jifyp6gudsh2bbarbbilicdmewfweufwf59vfwgi6h6yds6hnkgifmg6fwa1e1b5gidul1eneneqbn71bniefvi1f066acacdkf5gifmew", "5ka0czpvhgp0ik78clclcxfw8fb48fbhiac6gjg5gfgahaeth0ha9j9jhpkuhpfdpeinhjkijgg9ejkck27sdxhzetnrjyk9hqk9ici9djk0gzqai7fbifbrc1briwicezfggkfgglfmaigkhd7s80ey7sozhdg5gmglb3ehc1hdf3m0fefjeuch8cchjwfvizf07wcjcje3fmhdg5fg", 1.019],
  "Plus Jakarta Sans": ["4q7uazlyher2ke6t8787dbgu7idu7ybxnndmjzk8ktkfjwiekrjw7y8igugugudvp9i4izlpk2h0f1mtkg74ani6ern8kgnuhvnuhthecujghkr2glfng88rbx8rgugm9sfmhzg4hzg9axhufx6d6df86dp8fxh3hzhz9edvasfxedm5djewch8t8c8tguhvllfs7ibobogug9fxh3fm", "4yaadupfhft2m18najajf0ic9xgoaie2mie0jfjtl0jwjkickdjkaib2icicicg7p7jsixlik0gjf5mgkd7raxivf3otkknui0nuichfdojyits2idgofvbje2bjicifalfui4gci4g6bahkgh7070g170poghh0i4i4aedsbhghfqojfig9ddb2azb2iciflei79xfkfkicg6ghh0fu", 1.012],
  "Poppins": ["7f8a84nchal3kj4fcmcmdiiz5ifb5ud8hg8wfzgdhhhghnf6hjhi5x7cffk3ezeks5iqh1lgjne9e0lmj86ueqgnc0nxjjlug3lwgwgbf1irisr4h9g8f1briabrhhkd75isisgvish895ishs6u6web6usmhshsisisadeia4hsflmsdbfncncu83cuefh8mjit63akakhvh8hshsis", "5wawbfp4iao6m665d9d9euhg7zg47ucli4agfvgtiti2hpevi0h37w9nfbjcf1eyu0khibl6k7f1f7l6kb87g2jdd9pikwluhclwi4h3gfjlkat8jvingke6mae6jplo83ivivgtivh4a0iviq8786h687tfiqhpivivbwfibaiqheo2gchkdsdv83dvhoifm4jb8qf1f1hph4iqhpiv", 1.006],
  "Montserrat": ["7b78adjcgin1i15m9595baeq5w9e5w7uhua6fgfch4fig8fihmgn5c5cfzfzfzfys8j1kyj2mmi6h0lcml8edqiog5qjmlmtj0mtk3gidnldhvtch9ffi38u7z8ug0fzgog4ideoidfw9fikit7h7kg27hthitghididaxd0baifdynbeudsdn9a879aeqh0ljcn5wamamfzfwifghg4", "7v81c5k0hbodjk6e9y9ycuf77b9a7b9sibb9gifzhog8h1guhyhg6r6rgogogogwrxkal9jdmiihhcl2mg94eyjbgpqjmgmmjgmmkfhbfolmj7usingkina89pa8gofrgogvirfnitgparj1j78d99hn8dt5j7hdirirbwe7c3itfioxgjfcekav8lavf7hvm6cf7bdudugogpithdgv", 1.035],
  "Outfit": ["6h7zboihh2j2j1759494ebfs8dc08rbkiyadfrfnhcfrgefbg0ge8987fsfsfserkqisi1jel9h3fum6k07kegi7fknpk4mghknfh5fqejjpgyq9ivfxgxa4bka4dber8jghghdtghesaigefx6y74dk6wohfxfmghghbpc5a6f2dtksdadod59p849pfshxkvfz7ncqcrfsesf2fmgh", "608ndej4hhjqjw7o9b9bebgd8lc891bej7b8geg9hngagnfdgcgn8s8igdgdgdell0jviijflohsgimiko8ifijbfzo8kvmvi6nhi0gjf6k8hnqujjgrhlafbeafdoer9pgwgwdzgwf8bvgkgm7z8af37zozgmfzgwgwcdd0b9fpejlre6e7e2a88pa8gdi7kkgi7ze9e9gdf8fpfzgw", 1],
  "Lexend": ["7s6kbgiuhcnbkg5pa6a6argf7fay6cfagvdwf8eph8fsfhf2g3fb6c7aekfqeke7qqjgiuilkih2gbl0l5dahukcgno0m1l6hml6jbhcf6kajvroj1h8ib8zfab7g3j6dwgrgye1gsfdaxi1gj7q7dfs6zplgjfpgzgob7d1aogofxm8fmg5dg976f97e6gyhyea6pcgcddgfdgofpgr", "8w8mdakehmqwlh70auauc8gl7zcg75gcirflf8gfiegkg3fdgmg17583elhbemewqqjajej0l6hxgrlglnffihkjgxoemfm0iem0jihmhdkzjsrljli1iz9gg1boggj3dwhhhqebhcfdaxilhn8v8rhe8gqqhngfhrhgcndhb2hpgtn6guh8fa9n8u9nfihqivgj7oe2e1esfdhpgfhh", 1.021],
  "Source Serif 4": ["6g7wagege9prk34x9s9nclep897n8992ekekekekekekekekekek8989epepepbdn1jshqhzk4hlgbjomhab97jlh1puknk3h4k3j1epgujeg8paijfcg5919c8wepe5azekgndrgde4a4f2ho908agd90qehqezg6g0cjcs9uhbfyn3fyg5dh9p7x9kepeae9d169cnc8epe4hbezek", "629ecrfpfkqwkj67awavc3fm8m828ma9frfrfrfrfrfrfrfrfrfr8m8mfmfmfmc4oqjsikhykkhig5izm9b39pknh1pojpkci6kck8fhh5iog9ptj0f6gma3afa1fmf2b3fqhce3gyebakg0ib9i8lhv9lqwidfkgwgcdsd7afhug7o0gsgle09v8q9tfmflfkdd6pdod8fmebhufkfq", 1.024],
  "Source Sans 3": ["5k7obudtdtmxgx6x8f8fazdt757w6q9qdtdtdtdtdtdtdtdtdtdt6x75dtdtdtbtnjf0g2flgqdsd0gvi47bdbfndik7hzhsfdhsfmeqcwhqdhludpbdec8f9q8fdtdwf2dqewceexd380e0f46u6vdj73n1f7e4exex9nbn8af4czjzcfclbt8f6p8fdtdtdtcl6xbubudtd3f4e4dq", "5k8yexeoeontik8c9k9kc4eo8t877w9feoeoeoeoeoeoeoeoeoeo8c8teoeoeocvp3fogjfwh4dzdkhgiq8de5gceel6ihi8g2i8glf7e3i0efmlf7che99k9f9keodwffedf6c4f7d799eufv7o7qer7yntfwdyf7f7b2cb9jfsejlkeadkcs9k7g9keoeoeocc8cexexeod7fsdyed", 1.03],
  "Libre Baskerville": ["798ka7iihainoe5z8x8xecfa7lb67dcsjuceh4h4g9fshvdyguhv7x8ng5h8g5b3sllgkxlwnxk6imnippbja7lnk7uaolp8j3pblwhxirmmj7uamqhrle9ncs9odck27nfehjeai6f5bggij49h8gh491ttj5gxi8hkd9cmaiimgynogxhrfh9b829bfdiwjxif72chceeff5imgxfe", "6p8nawjihwjsor5x9899dofk7aaw78dikzc4i3hpiggjiqechniq7w87ghh6ghb7thmhlumdp5l8j5nvq9bxasmukzvtpppbjxpumnifmtnijnvonkism5abd9aadoka8bfyi5f1iofccbgtjua197ig9vuqk7h3isi4ducyamjphcori0hyfs9u879ufmjol6ih6qclcgekfcjph3fy", 1.022],
  "Lora": ["7b7e9mn2epo6jw5s868hegeq71db6uirh9a4exfhf2f5g2ctfmg26y7beqeqeqd6m4j1gkiukhhaewkclo9ba4izg2pil1lahblchxfmh6kjh3q6izevgy91ie96mvk970ecg1egghes9efdgn7t79ex7kougvfzggfvc1cvb3glegmqeqeoe79a6f9aeqf8l4g44ub49peqesglfzec", "7b7692o7gcp4it587p7qeteq6yc56hibhobaetfkf7f0fzd1fwg06y7feqeqeqdzm1ighvikkxhcfqk3m5ahbxjsgsqskwknhrkoj2gbhyjjh4prjff6gl97hs97mvn4ekekfpe0g6eka9frh9938egi8opkhqf4ghfldcdhbhh6etmjf8fbea9m779neqfxmhep5uc5bfeqekh6f4ek", 1.014],
  "Merriweather": ["5s6obuh9guryj56g8e8bgobf698p5p8ih4bgfte6e3duf7edfng46l6hdkffdmafqgk1hbh8jvgsfjiul7917njgg8rak7j7guj8iuezihigfsp6jmf2gy8t9t8qdhataredf9cwfmd9atgahi8g7lhi82r7i1eggaf3c3cpaqgkfpnmhbfqezb6ax9q8yjuj3ei6xd3cuhrd9gkeged", "5u73c5hch3srjq6g8l8kgwbm6x8r6h8shnbzfvekf3eafjf1gbgg7d78dffbdgazr7kki6hfk8h8g2j2lu9u8ekegosbkojihgjjjpfcj6iogcppk1fehb969q8ydg9cbeeyfod6g1dqb4gthv8w86i18irhifetgoflcedfb0h1g3nvhwg3f9bkaz9uamkkjwef6xe0dehudqh1etey", 1.066],
  "Roboto": ["6w768wh4fmkdha4v9i9obzfs5h7o7cbhfmfmfmfmfmfmfmfmfmfm6q5we4f9ejd5oyi4hbi3i8fsfdixjt7kfchgezo9jtj4hjj4h4gifji0hponhfgdgn7dbf7dbmcj8lf4feeafeeh9ofcfb6r6ne36rodfcfafefj9fec93fbdgkwdsd5ds9e6s9eiwg6fmi85k9u9yeuehfbfaf4", "6x7i8uggfykji94h9q9rcmf56uay82abfyfyfyfyfyfyfyfyfyfy7u7be6fyecduowiohqi7i2fmf9ixjm85fjhof1objmj6hxj6hth3g6ibi5obhngwgv7pbq7pc6cd96evffe7fdeq9yflfk7d78eu7do2fkeyfffea6ea9efke2kee5e0e5957095i0gifyhi6db7bbereqfkeyev", 1.009],
  "Open Sans": ["787cb2hyfwmzk9638787fbfw778y7ba7fwfwfwfwfwfwfwfwfwfw7b7bfwfwfwc0oxhkhyhik6fgeck7kh7r7hh0eip0kxlmgqlmh5f8fbk9gkpng2fjfw93a793fwc67pfgh0dbh0fm9df3h17171el71pqh1gqh0h0bdd99xh1dwljejdxd1aff9affwfwfwdw4q9p9pfwfmh1gqfg", "787yd4hyfwp1ku7e9f9ff5fw7x8y7xbhfwfwfwfwfwfwfwfwfwfw7x7xfwfwfwd9oxj6iohpkkfkf9k4l99797igfpq7mlm4hgm4icfbg3l0i2qvijhcg397bh97fwbfa2gshleahlgfarfpi98h8hh88hrai9h7hlhlcmdtc2i9ftnsg2ftdkayfbayfwfwfwdw61cdcdfwgfi9h7gs", 1.001],
  "Work Sans": ["8d7kb7hrgunsh16i9494fwgs7ebc7ebqhaaug7g7gzg6gwflh4h58888gsgsgsf2qmichviojkhqg1jqke88fci8gmnqkejxgyjxihhdd4joheqpgpe1hi8obt8ofkc5dwffguepgveyaxelh77e7efr8iqhh7fjgugvbcdzbnh5egn8eteceu9f6r9ff0h8jgfm73cbcbgseyh5fjff", "6u8dcfj4hmq2hs6yamamgcgs89bm89cuhwbzgkghhyg7h4gwhfh48e8egsgsgsgvpvitiwirjrhjgnjxkm8uh1j9gqpaklk4ikk4j5hrgojqirrpifgihmahcvahh0bxdwfzgpergpenbjfhgw8383ha93ptgwf6gpgpbyefc5h7flp0gdfnecbj8wbjglh9jig67uf5engsenh7f6fz", 1.039],
  "Geist": ["826haqeeilneic628q8qcigm659f65csjjbsibi5i7iihlf4hwhl7575g8g4g8ftqaiuhijjigfneqk0i55ugvi2fumpizktgoknhui2e8jfhzpph4fgf4arcxarcygl80ehevdievdx9bfteh5468f06umxepe9f3fu8jcs9pg4cqklf5crdtbx8gbxfni3lbhj6rbcbcf2dxg4e9eh", "7m7vc4hnjwo7kw6xa9a9cmh47a9v7adskjdrjfjbjijxipfujqit7d7dgkgmgkgvs0kqi0keiwgcfgkqij6uhvjfgfnxjclohglhidj1g1jzjkrhjeh5goc3edc3e3gv90fgfredfrelb3ggfh6b85gl7snqfpeyfzgha5dlbbgxf1lqgseff3cm9gcmftj9mjht85e4e4gaelgxeyfg", 1.063],
  "Onest": ["7i7l9zi5i8mcit668k8kbifa79cq72d9iha3fqgnhlh4hbe1hah87179fafafae9rbiri7jkk0gygnk0k779fihdfynskll5hil5iai4ftk6izrbghgigl8xd98xfacvfjffgietgifda6gigf6372eg63mrgffzgigiaddgaag0ewnfebgleeat79atfag8ivg28ddmdmfafdg0fuff", "7u8gbgixifomjx6v9u9ucvgg8dcx7te9icauflh1hph3hce8hdh97w8dggggggeqrmjwitjukah9gskckn85g9ipgiozlalhi5lij5icgjkijvrwilieh69te99tggcdgyfsh2f2h3ffaoh3gt6z7gfj6znogtg3h2h3axdka6g9fio3fkh4e6b77vb7ggh1k4h19bfpfpggffg9g1fs", 1.016],
  "Public Sans": ["7179bgh1ikpejy6j8p8pb8fp6z8q6ja0hablguhshqi2hlgyiahm6j6yfffpffeklvjniwjejdh9g8knlk85b2j8gmovl8k6i3kkiuhyfejqiaq3jlg4hz8pa08idfen6cerfvdvgcejbkhrfz757kfv8pnzfzehfugbbidlaig9ealyfff5dg9e7l9bg2hbgxdo6pbxbofaejg9eher", "6e7zd0h9j1q8lw6y9e9edagh7t8x7maqi1c1hsimidivihhjirif7m7vg6ghg6ewl9juj5k3k1hnghl8lj8obak2grpmlvk9i9kmjai6fmk9icppkfhbiq9iaq9fdlfi7gf3fxdggae9bqhugd7k85g89aosgee9fvg9bwdubhgeelm1g7fsduat7laph5i5i8eg7edgdeg5e9gee9f3", 1.026],
  "Urbanist": ["6o5078l0gehtjp3j8y8y9tg45lbt509tgk7df5dof6feezevenen505pg4g4g4dyo2i2fijpioe6dclchg64b6etdyolholeekllfigyhiifgomcicgqhy7i9t7iaxh8ahf0fmd5fpde9bfber4q62dn5aoaehdgfbfi9ybe9lece0mbetdhe3b65ub6h0g5g8gt479090dfdeecdgf0", "6o6986lugskyjv44ajaja2g471bt69b9gs96fve7g3fzf9faf5f86972g4g4g4fephjagbjpioegdglci67kccgaejpzimlefelvgvhchiiwi5nck4ifhy8wb88xdbh8ebewfrcqfscn9vfyf65g6xev6qnqejcnf3fpacas9yeyfjn2gleze3be7abei5gmfkgt5nb6b6efcneycnew", 1.071],
  "Bricolage Grotesque": ["6b6b7tg3gmp5k93q7b6wa3ak3z6k5j99ha7wfqf8elfdh0cgh2gv524rcfcjcgb6opi0hhhmi8fqewiiir6n9jhndto2jmivgtizhggwdmizh4pch6eqf57v8m7ae3fn74eofqdvfoe59jg5fs686ff467o4fsetfqfoaxdrauflf2mif3fge58x6b87avj6jobk488l8ldfe5fleueo", "5x7la7gxhcqokg548985cjbf5f726w9pht96gfg0fvg5hndlhrhk6y6edadtdbbnq3jgifi5isgtfyjbjm7pa8ine3pml2j7hjj9iihnf6joi7qwj7gcfi8j9h8effey7efkgreegselakgph2787bge76pth2f7grgsbye8begtg1nygbg9es96728wc2jgk8c45lb7aze7elgtf8fk", 1.072],
  "Raleway": ["737084iwh7jviv5h7h7g8xbj69ao59gkh0bweheuf6f5grevghga585pe4c6e4d8n9isi9isjlgxfsjmki6wdehvg7odlgkahak9i5gocxkzibsghkgghh76fs76eze766f1giemgnf396gjg76269eq7kpjg7f8gigi9rdf9bgietmle0f2do776f77e7dvmaes348s8ncpf3gif8f1", "6o8jaxk1hmlukk6j8s8s9lbp6gat69j6h2dqfofifvfegvflgsgd6v77ebc4ebdinhipimiqjlgpfqjtkp7ydnilg8o1l7kchdkiihgremkui5skhygrhf8rhw8rg9d773fsh0exhcffa8h1gs7379fi8tpvgsfjh0h0ardjaoh6fanberf9dp8t7k8tfrf5m6fy49c2btd9ffh6fjfs", 1.019],
  "Nunito": ["766cawgogopuj9658t8td0go71a4716tgogogogogogogogogogo6c6cgogogobpqajoisifkmg7exk6l57590g5ejnrkklbh6lbich2emk8hnt4hdecfy8r7v8rgoel9welfwcrfwec8vfzfs6g6kdc88nsfsetfwfwa3d3a0fldrmteldqcl8y7d8ygogogoc767asasgoecfleteq", "7j6wcggogoq9k66r9y9ydbgo7qao7q7qgogogogogogogogogogo6w6wgogogoc2qek1j4iml6glf9kglh7u9uhff2o4kslthpltiuhhf3kii7tbhzeyge9u8p9ugoeqahf4gbd6gbem9kgfg97377ec8vodg9fagbgbb1daayg3e3n5f6e2cwa680a6gogogoci76clclgoemg3faf7", 1.011],
  "Rubik": ["6s6tadjch6l5jb628o8oceha6xbs70cmhnbwgbgph9gigre9hogh747jdoftdnern4imijigj3guf7iojt7lh8gpfnm2jaiphuipi7h3c2jfgwm6hlexgo8gcm8gc0ks9df6g5eug5evapg7gx6q72ec6ropguf6g6g6ake1avgpfemaezfbe59o6h9ofkitkoea63azajfjevgpf6f6", "5x83ckj2ikmfkp6racaccdgv7qbw7wdwiwdti2ibizhyi3fxitht848cedfqecglnhjwjfjcjqhrgljmkp90i8ifgln0jzjgisjgj7i3f8jzhumuj6fxi2addvadcwkfb2g4h1fih0fhcbh2i27x8fg97ypfhvfvh1h1cmevczhqgjnagcglfdbk7dbkfek0ltee73dmd7gqfhhqfvg4", 1.022],
  "Karla": ["6m7q8ghdhik5pe3r9v9vbhel5t9o4ybzgh96g3gefifofxd1h2g46e79elelelduq2fyh9h1icfmdshwik7sb7gwd0njj0hxfdi3h1gsb7i5fnouhtcegf8sbz7welk490faghecghe99jfogr8a8pfn7spzgrf6g8g8a1elaggtdzk4e7cxd69o7s9oelfoh1d55xb5b1ele9gtf6fa", "7185aniuj5l9qt4zb3b3bdex71ae5zd3hl9xgthagjg6gvduhygy7i8kexexexedsjhdi0hlj3gaebitjl8gcbi6dqobjxizg4j2hvhpc1j6grqaizddhh9sd39bexlca0g9h2eph2eqa8g6hb949bgg8gqdhbfqgygyaxenazhfefl2fddzdrav8gavexgqhlel7jdndhexeqhffqg9", 1.015],
  "EB Garamond": ["5k6y96d0c9i2l05k8r8r9gge6e7m6e9udcdcdcdcdcdcdcdcdcdc6w6cfkfqfkagktj8gbjqkyfoe8k9mi9g9gixg8p1m0l7fcl7jtcxg4kifmmejndugr978v97dwdw5kaodc9xdd9q8uc3eb6t6ad16olmeoc3dgdt9a8z8qenc6j1byc6ahag78agdwdmjnfa6qbmbmgo9qenc3ao", "6l82b2dgctjim76l8g8g9xgp6v8s6vb1epepepepepepepepepep7u6vf1hhf1azlpk0hejplafzeqjzm9a49pl7gaphlkl4gvl4l4dqgtkph1prkug2gk9w9u9weage6lc4eba5eoaha0dkfj877ef67xmffqcjeke7bia0affbdfkwe1ddc5ad7nadf5fskihk6nc7c7ezahfbcjc4", 1.03],
  "Crimson Pro": ["5878bdebcokijc6c9i9ibeen6c9q6c8ufk8tcucjd9cpdpc9e5e46c6cenenen9qoff2f0g7igemd2hli88f83fadtn2hyikdmikf2coeuhkeoocfcdhec8t9e8senazgacodtaye6bf83cwex7a6qd57bmcexd0e9dr9pan8qegc6jsd2c6bsa07ga0endahkdk6mbmbmenbfegd0co", "5c80efehdgljkw7rababd7en7r9z7ra7gq9udrcjdrd3encofdf67r7renenenabqafpg1gmj0f7dxhxj29d8wgvero6ihj0f2j0ghdggcigf7p2fuefeu9eaq9eend1gad8ejbqembw8tdjfy827oey83njfydfeueaatb29fficml7e3cmcqa37aa3enf4hzdk7xebecenbwfidfd8", 1.032],
  "Spectral": ["6y6ycidwdwkujb6y6o6o9qdw6y9v6e6ydwdwdwdwdwdwdwdwdwdw6y6ydwdwdwdblhkai0jmlji4g8lcmiaua0jphaqnm7mfhqmfideriqlxjqqzkahqho6o6y6odwdw7hdgf0crf9cw9iemg68p8qey86nwg6egfhf8arbg9ufldckxdsdcde6y6y6ydwdwdwdc6obyc8dwcwflegdg", "6y7hciflflm1l96y6u6ub3fl7a9d6w6yflflflflflflflflflfl7g7gflflfldbm0l4jijjmaixh1l0n8bhbclehxrnmolxiulxk7fqjbmqkksilejej76u6y6ufldw7me3facwfxd8abenh69390gj92p1h6ehfxfubpbfaeg2dekef9dedy7a6y7aflflfld064bqbifld8g2ehe3", 1.02],
  "IBM Plex Serif": ["6g7sc3jbggpdj6799595cugo808z809cgogogogogogogogogogo8080gogogodjp3j2ici1jmhtgfk1lv9mcpjngso8lmjwgyjwiog7h0jvhcq2ilfyhp7wa57wgogsgof6g5dqgie59if4hc8r8fg88cqhhreqgkg8cbcw9th7eullfleue4938a93gogbh7ed7ldeczgoe5h7eqf6", "6g8oeghrgjpok78i9v9vhigo8z948yb2gogogogogogogogogogo8f8ggogogoefokjpjaihkziahrljmkaoeklvhiowlzl4ixl4kfhhjqldi6rzk7hqi59vbw9vgogogofvgxe9h3esapg4i39b8yha92qzief8h4gxdpe0adhzfoo4gcfveaapaeapgogih9ei82eremgoeshzf8fv", 1.019],
  "Libre Franklin": ["6b75bqh4h6ptlz718a8aaxfu697r659vjhdah0i5idijiqh0ixim656qfhfufhevnjjxjsjzkeh4fakvks8ebyj2h3pjldlljilljoi5gek2jasujghihw8b9v8bdkeq8af5gddqgdeqaoh2gl6z6zfg70pigkeygbgdb0dqabg3eolpesebdq8u7m8ug4hgh0co6jbfbgfdeqg3eyf5", "677tdih8ioqpnr7d9797dego7i847gamk6emidj1jmj9jihojgjh7g7ogigogifennl4kkkmldi7fmldlc98cxkihwqulklzkcm0kjjah4kijwu1kqixje9aam9adofm8zfggndlgneebli2h27u7vgp7vq0h1ehgngncbdubcggf2m2fyf1ewan7ganheieilds76dedigheeggehfg", 1.018],
  "Lato": ["5d9jb1g4g4lujj6e8c8cb4g45w9n5w9ng4g4g4g4g4g4g4g4g4g47070g4g4g4b2muiwhzj1kxg5fqkel08jccixeapkl0m6gzm6hweqeekai6sbhvfnhc8caf8cg4ay8je3epc5epcw9de7fg7472ek74mtfgdseiepb7c2adfge8lae0e8cu8c8c8cg4g4g4fg5wa4a4g4cwfgdse3", "5da1bqg4g4mbju6m8c8cb4g4699z699ug4g4g4g4g4g4g4g4g4g47d7dg4g4g4bpmvjqi4inksfxfmk3l08qc5jeedpul0m8hdm8i7exenk8itt3ivgbh58cav8cg4ay8vekf0cff0d79reeft7j7hfc7jnefte5ewf0bdc5arfteulzf0eud28c8c8cg4g4g4ft69avavg4d7fte5ek", 1.036],
  "Red Hat Display": ["5k538fitfck4hb4waea9bze16j9s6jamhz7mg9g9gsg9g9g9g9gl6j6jg9g9g9d8jmivh5jniwgpf7kijg60g9h5gdn4jqldhkldhsfae8j5hrnohqeagd98ac93ehczg9dieqcleqd19pemeu5555dq55ngeudjeqeq97ba9qefe4j4e2e1cga777a2fngol4ck6jababg9d1efdjdi", "5a5xanjpfzl5hu61auakcje16ja06jc5if8rg9g9htg9g9g9g9h16j6jg9g9g9dwk1jvhqjkj6h4g0kkjw6sh1iogtnsk6ldi8ldigftf1jjipoviwfkgma4bu9ufcd7g9e9ficyfideasfffo5z5zf55zocfoe0fifiadcaavf9fjkifafidfb38baufyhblecs6qblblg9def9e0e9", 1.081],
  "Schibsted Grotesk": ["736s8oi7fpnnj34e7774c5cs748t6za5gg94fxfsdyfdgac1fwg87t7hfhf3ffeqomjmhhj5itg1dijjjk9ne1i4ewo5jtksgkkshggqcpi0gnozi3e0gj79c47adac2dxezfjdxfjea95f8fj686ff370ntfpezfkfkaldc98flexmefieve17p6o7pbogqie7n5kbob2hoeaflf0ez", "5n7n9sjtghp5j44t7z7zb0d57p957nawgxargegaf0g7gsdkgkgn877xftfufnfhpfkfi9jcjrgfeqjokebcf5jufqptkskli3kliuhdeej3hlqmk8ezhf8rco8redb0dpfzgjefgien9tfrgf7b7ign7vougmf1gkgic3dzabgkg7o6h1ggew8u7e8ucoh8i58d6ednd3hgengkf1fz", 1.067],
  "Syne": ["5u7c8rj6cklpg94y8h8hbycs5ici6iblgc8yclcnexeudzcjdmdp7m6mesd2esemogh8h4j6j4gpfpk1k07sexhjfuogk0kkgukkhuf1cijbgossh4gei29jbl9ngblybffefte7fte19nejfq6868ee6eoqfeesftft96bp9ufedqlfe6e1dubn7ibn7ccwl7fk5i9o9ob8e1feesfe", "6p8hbip9fjqcln6e9c9cdzfk6fdq7jddkiauhchtjrj1j5hvirjd8b7lesgaeyhettlxloolofldklpeov90izmmj3ujp1polspomyjahaohljzzlokkmtbcddbegbnle4jgk1hvk2hkcei0ji7g7gi17jvbj9iak4k2b5emc2j9hfrgi9hrhadf8zdf8niaqsgs6fbxbxdwhkj9iajg", 1.026],
  "Roboto Slab": ["6x6kaggwf2jthh698z8vd0fj5hat6pb6fubgfcf0g4eofjfbfcfn5p5rdtfaeecxopkthxhiiehqh1i9le9bfvkdgfqwllichlioisgdi1knkgswkrjig97sbf7ibqfu6qfdfce7g9e39uffhu8u74hg8vqti8epg1f6bldv9wgwgdoqgcg6e09i649iitg0ecj05oa3a7eje3gwepfd", "6t6waog9f0jehc639a9oceew6tb273asfvcafff3fpetfjf1f4fh6665dqf8dzddoikii8hxjchrh6imlp9pgbkzgas1lrjmhzjoj4gxhtl3kutvkjk5gn83bl7vc0eu80fnftefg6ecaufzho8z85hv8vq0hqf2gmffc1e19zhagxoqhwhgf1945t97hyfzefim6ebbbeeiedhaf2fn", 1.007],
  "Mulish": ["796cawgogoq1in658u8ud4go71a8716wgogogogogogogogogogo6c6cgogogobtqxjtiwirkrgcfbkbla7795gdelnukrlgholgizhbenkahwtehgeng58t7y8tgoeqdwgkgddngdep8zggga6m6mdr6moegaf9gdgda8dia0g2e7nleve7e5917c91gogogocd67auaugoepg2f9go", "7m6wcggogoqej46r9w9wdfgo7qas7q7tgogogogogogogogogogo6w6wgogogoc7qtk7j6irl6gjfjkkli7wa2hgf0o6kzlvi3lvjahvf1kkiftjhyf9gh9u8s9ugoevdwh5gve2gves9ogxgr7979es79ozgrfqgvgvb2dnatgkeknzf9ejeca77ua7gogogocn76cpcpgoesgkfqh8", 1.011],
  "Noto Sans": ["787hbchyfwn3kc698c8cfbfw7g8y7gacfwfwfwfwfwfwfwfwfwfw7g7gfwfwfwc2ozhri2hkkafgefk8kl9f7lh7ekp7l4lpgtlphaf9ewkbgopugafqfw95ac95fwcc7tflgjcsgjek9kh3h67676eu76pzh6fpgjgjbhdba1h6e4luepe6d2akfbakfwfwfwdw4v9z9zfwekh6fpfl", "787udbhyfwp2ku7e9f9ff3fw7x8w7tbjfwfwfwfwfwfwfwfwfwfw7t7xfwfwfwd9oyj8ihhukdfkf9k4l9at97igfjq7mllzh9lzi7fbfhl0i2qvimheg397bj97fwbfa5gnh0dsh0fharhki28b8ah88ar3i2g9h0h0cfdyc2i2fvnsg2fvdpayfbayfwfwfwdw61cdcdfwfhi2g9gn", 1.017],
};
const glyphCache = {};
function glyphWidths(family) {
  if (!(family in glyphCache)) {
    const rec = FONT_W[family];
    glyphCache[family] = rec ? rec.slice(0, 2).map((str) => { const a = []; for (let i = 0; i < str.length; i += 2) a.push(parseInt(str.slice(i, i + 2), 36)); return a; }) : null;
  }
  return glyphCache[family];
}
// Width in px of a string set in face {family, weight, tracking} at sizePx. Weights between
// 400 and 700 are interpolated; a family that is not in the table is assumed to be as wide
// as the widest theme face plus 6 percent.
function textPx(text, face, sizePx) {
  const str = String(text == null ? '' : text);
  const gw = glyphWidths(face.family);
  const t = Math.max(0, Math.min(1, ((face.weight || 400) - 400) / 300));
  // families other than the theme faces: their measured running-text factor plus one percent,
  // three more above weight 700; a family that is not in the table gets six percent
  const heavy = face.exact ? (face.semibold ? 1.04 : 1) : ((FONT_W[face.family] && FONT_W[face.family][2]) || 1.06) * 1.01 * ((face.weight || 400) > 700 ? 1.03 : 1);
  let em = 0;
  for (const ch of str) {
    const i = GLYPH_SET.indexOf(ch);
    if (gw && i >= 0) em += (gw[0][i] + (gw[1][i] - gw[0][i]) * t) / 1000;
    else em += gw ? 0.6 : 0.5 + 0.03 * t;
  }
  return (em * heavy + str.length * (face.tracking || 0)) * sizePx;
}
// Lines a text takes in a box widthPx wide: greedy breaks at spaces and after hyphens,
// which is also the line count of a balanced wrap (text-wrap: balance only evens them out).
function wrapLines(text, widthPx, face, sizePx) {
  const space = textPx(' ', face, sizePx);
  let lines = 1;
  let x = 0;
  String(text == null ? '' : text).split(/\s+/).filter(Boolean).forEach((word) => {
    word.split(/(?<=-)/).forEach((part, k) => {
      const w = textPx(part, face, sizePx);
      const lead = k === 0 && x > 0 ? space : 0;
      if (x > 0 && x + lead + w > widthPx) { lines += 1; x = w; } else x += lead + w;
    });
  });
  return lines;
}
// A deck that sets font_display or font_body is measured in the installed Chrome when it
// is available (about a second), so the lint is as exact for those faces as for the theme
// faces. Without a browser, or offline, the built-in tables and their margins apply.
async function measureFaces(theme, faces) {
  const roles = ['display', 'body'].filter((k) => !faces[k].exact);
  if (!roles.length) return faces;
  let browser;
  try {
    const pw = require('playwright-core');
    const exe = findChrome();
    browser = await pw.chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
    const page = await browser.newPage();
    const href = googleFontsHref(theme.tokens.gfontsList);
    await page.setContent('<html><head><link rel="stylesheet" href="' + href + '"></head><body></body></html>', { waitUntil: 'load', timeout: 15000 });
    const spec = {};
    roles.forEach((k) => { spec[k] = { family: faces[k].family, weight: k === 'display' ? faces[k].weight : 400, size: k === 'display' ? 64 : 30 }; });
    const got = await page.evaluate(async ({ spec, glyphs }) => {
      const out = {};
      for (const k of Object.keys(spec)) {
        const f = spec[k];
        try { await document.fonts.load(f.weight + ' ' + f.size + 'px "' + f.family + '"', glyphs); } catch (e) { /* measured below */ }
        if (!Array.from(document.fonts).some((x) => x.family.replace(/"/g, '') === f.family && x.status === 'loaded')) continue;
        const span = document.createElement('span');
        span.style.cssText = 'position:absolute;white-space:pre;font:' + f.weight + ' ' + f.size + 'px "' + f.family + '", monospace';
        document.body.appendChild(span);
        const ws = [];
        for (const ch of glyphs) {
          span.textContent = 'non' + ch + 'non'; const a = span.getBoundingClientRect().width;
          span.textContent = 'nonnon'; const b = span.getBoundingClientRect().width;
          ws.push(Math.round(((a - b) / f.size) * 1000));
        }
        span.remove();
        out[k] = ws;
      }
      return out;
    }, { spec, glyphs: GLYPH_SET });
    const measured = [];
    roles.forEach((k) => {
      if (!got[k]) return;
      const key = 'measured:' + faces[k].family + ':' + k;
      const enc = got[k].map((w) => Math.max(0, Math.min(1295, w)).toString(36).padStart(2, '0')).join('');
      FONT_W[key] = [enc, enc];
      measured.push(faces[k].family);
      faces[k] = Object.assign({}, faces[k], { family: key, exact: true });
    });
    if (measured.length) log('  fonts: ' + measured.join(' and ') + ' measured in Chrome for the capacity lint');
  } catch (e) { /* no browser or no network: the built-in tables are used */ }
  if (browser) await browser.close().catch(() => {});
  return faces;
}

// The two faces of a deck, from the resolved theme (meta.font_display / font_body included).
function facesOf(theme) {
  const T = theme.tokens;
  const own = (key, role) => (!theme.overrides[key] && FONT_W['theme:' + theme.name + ':' + role] ? 'theme:' + theme.name + ':' + role : null);
  const d = own('font-display', 'display');
  const b = own('font-body', 'body');
  return {
    display: { family: d || T.webDisplay, exact: !!d, weight: Math.min(800, Number(T['display-weight']) || 400), tracking: parseFloat(T['display-tracking']) || 0 },
    body: { family: b || T.webBody, exact: !!b, weight: 400, tracking: 0 },
  };
}

// --------------------------------------------------------------------------------------
// 8. Capacity table and pre-flight lint
// --------------------------------------------------------------------------------------
// What each layout holds, in one place. Every number is a pixel measurement of the
// stylesheet above (stage 1920x1080; the body runs from under the title to y = 940,
// where the source caption sits) and is verified by rendering decks at the limit with
// --check in both variants and all four themes. lintDeck() checks deck.json against it
// before anything is rendered; `--capacities` prints the markdown table that
// references/deck-structure.md carries.

const PV = (present, read) => ({ present, read: read === undefined ? present : read });
const pv = (x, v) => (x && typeof x === 'object' && 'present' in x ? x[v] : x);
const len = (v) => String(v == null ? '' : v).length;
// A text box: width and font size in px, the face it is set in (body or display) and an
// optional weight. linesOf() lays the actual words out in it with the deck's fonts.
let FACES = null;                                   // set per deck by lintDeck
const bbox = (w, px, weight) => ({ w, px, kind: 'body', weight });
const dbox = (w, px) => ({ w, px, kind: 'display' });
// (a semibold run of a measured face is taken as four percent wider than its regular weight)
const faceOf = (box) => (!box.weight ? FACES[box.kind] : FACES[box.kind].exact ? Object.assign({}, FACES[box.kind], { semibold: true }) : Object.assign({}, FACES[box.kind], { weight: box.weight }));
// (a measured face needs almost no margin; a table face carries its own in textPx)
const linesOf = (text, box) => (len(text) ? wrapLines(text, box.w * (faceOf(box).exact ? 0.997 : 0.99), faceOf(box), box.px) : 1);
// Characters that fit on one line of a box, for the "fits up to N characters" hints.
const SAMPLE = 'Operators pay 1,280 EUR per site per month; carriers book a dock slot in 40 seconds from their phone';
const boxCpl = (box) => Math.max(6, Math.floor(box.w / (textPx(SAMPLE, faceOf(box), box.px) / SAMPLE.length)) - 3);

// Character widths are measured with the web fonts loaded (not the local fallback faces).
// Text is measured, not estimated: cplFor() names a body-text box (width, font size) and
// linesOf() wraps the real words in it. BODY_EM (the widest theme body face, Albert Sans)
// is only used for table and legend arithmetic.
const BODY_EM = 0.464;
const cplFor = (widthPx, fontPx) => bbox(widthPx, fontPx);

// Display type differs by theme (Sora is 14 percent wider than Newsreader). For the
// documentation: title is the number of characters per line of a slide title that every
// sample headline kept within, max the same for three lines. The lint itself wraps the
// actual title in the deck's display face.
const DISPLAY = {
  graphite: { title: PV(42, 49), max: PV(130, 150), f: 1 },
  paper: { title: PV(42, 46), max: PV(130, 140), f: 1 },
  signal: { title: PV(38, 44), max: PV(118, 138), f: 0.9 },
  midnight: { title: PV(36, 41), max: PV(110, 128), f: 0.86 },
};
const TITLE_BOX = { present: dbox(1440, 64), read: dbox(1440, 58) };
// Display sizes other than the slide title: box width and font size
const OWN = { insight: dbox(1600, 72), statement: dbox(1560, 96), askLong: dbox(1500, 64), askMedium: dbox(1680, 96), colHeading: dbox(780, 40), closing: dbox(1560, 104) };
const dcpl = (box) => box;

// The standard slide head: 64px title (58px in read). Budgets assume two title lines.
const HEADG = {
  line: PV(69, 63),           // px per title line
  kicker: 51,
  subtitle: { base: 24, line: 42, cpl: cplFor(1240, 30), max: 160 },
  body: { base: 28, line: 41, cpl: cplFor(1240, 28), max: 260 },
};
const BODY_PX = PV(650, 662);   // body height under a two-line title

// Text column presets: padding per point, line height, characters per line. Points are
// 30px (27px in read); compact points 26px (25px in read). Widths are the text width in px.
const COL = {
  wide: { pad: PV(44, 36), line: PV(42, 38), cpl: PV(cplFor(736, 30), cplFor(736, 27)) },      // half-width column
  full: { pad: PV(44, 36), line: PV(42, 38), cpl: PV(cplFor(1096, 30), cplFor(1096, 27)) },    // chart-width column
  compact: (w) => ({ pad: PV(32, 28), line: PV(36.4, 35), cpl: PV(cplFor(w, 26), cplFor(w, 25)) }),
};
// share: stats and points stacked in one side column. base = stat height without its label
// lines (read adds the source line), gapStat = gap between stats, gap = gap to the points.
const SIDE_CHART = { stats: 2, statLabel: 100, points: 5, pointChars: 160, col: COL.compact(464), share: { base: PV(76, 108), line: 34, cpl: cplFor(500, 26), gapStat: 44, gap: 36 }, chart: 1080 };
const TABLE = { table: true, stats: 0, points: 2, pointChars: 180 };

const CAPACITY = {
  cover: { titleLines: 2, subtitle: 110, kicker: 70, stats: 3, statLabel: 60, statValue: 10, points: 0 },
  problem: { stats: 2, statLabel: 90, points: 3, pointChars: 200, col: COL.wide },
  'problem (image)': { stats: 0, points: 3, pointChars: 160, col: COL.compact(744) },
  solution: { stats: 0, points: 3, pointChars: 220 },
  'solution (image)': { stats: 0, points: 3, pointChars: 200, col: COL.wide },
  product: { stats: 0, points: 4, pointChars: 140, col: COL.compact(564) },
  'product (no image)': { stats: 0, points: 3, pointChars: 220 },
  insight: { titleLines: 3, titleBox: OWN.insight, stats: 1, statLabel: 60, points: 3, pointChars: 220, col: COL.compact(1084) },
  market: { stats: 3, statLabel: 130, points: 2, pointChars: 150, col: COL.compact(484) },
  traction: { stats: PV(4, 3), statLabel: 100, points: 2, pointChars: 220, col: COL.compact(404), share: { base: PV(80, 112), line: 29, cpl: cplFor(440, 22), gapStat: 28, gap: 40 }, chart: 1140 },
  'traction (no chart)': { stats: PV(4, 3), statLabel: 100, points: 5, pointChars: 220, col: COL.full, statsCol: { base: PV(80, 112), line: 29, cpl: cplFor(440, 22), gapStat: 28 } },
  business_model: { stats: 4, statLabel: 84, points: 2, pointChars: 180, col: COL.compact(1164) },
  'business_model (table)': TABLE,
  go_to_market: { stats: 2, statLabel: 44, points: 4, pointChars: 160 },
  competition: Object.assign({}, TABLE, { points: 1 }),
  team: { stats: 0, points: 1, pointChars: 150, members: 4, name: 60, role: 80, bio: 200 },
  financials: Object.assign({}, SIDE_CHART, { sideLabel: 49 }),
  'financials (table)': Object.assign({}, TABLE, { points: 3 }),
  ask: { titleLines: 3, titleBox: OWN.askLong, subtitle: 160, funds: 5, fundLabel: 90, stats: 0, milestones: 4, milestoneChars: 110, points: 1, pointChars: 160 },
  'ask (stats)': { titleLines: 3, titleBox: OWN.askLong, subtitle: 160, stats: 3, statLabel: 66, milestones: 4, milestoneChars: 110, points: 0 },
  roadmap: { stats: 0, milestones: 5, when: 14, what: 70, proves: 90, points: 1, pointChars: 150 },
  closing: { titleLines: 4, titleBox: OWN.closing, subtitle: 110, stats: 0, points: 3, pointChars: 100 },
  'appendix (chart)': SIDE_CHART,
  'appendix (table)': TABLE,
  'appendix (text)': { stats: 4, statLabel: 90, points: 5, pointChars: 220, col: COL.wide, statsGrid: { base: 108, line: 34, cpl: cplFor(370, 26), gap: 40 } },
  statement: { titleLines: 4, titleBox: OWN.statement, subtitle: 160, stats: 0, points: 3, pointChars: 120 },
  two_column: { stats: 0, points: 5, pointChars: 150, colTitle: 70, col: COL.compact(744) },
  custom_html: { stats: 0, points: 0 },
};
const CHART_CAP = { labels: 12, hbarLabels: 10, hbarLabelChars: 24, series: 5, legendRows: 3, legendChars: 60 };
// charPx: 26px table text in the widest body face; fill: share of the row that single-line cells may use
const TABLE_CAP = { cols: 6, header: 66, row: 70, wrap: 34, charPx: 26 * BODY_EM, fill: 0.88 };


function formOf(s) {
  const img = !!s.image;
  switch (s.type) {
    case 'problem': return img ? 'problem (image)' : 'problem';
    case 'solution': return img ? 'solution (image)' : 'solution';
    case 'product': return img ? 'product' : 'product (no image)';
    case 'traction': return s.chart ? 'traction' : 'traction (no chart)';
    case 'business_model': return s.rows.length ? 'business_model (table)' : 'business_model';
    case 'financials': return s.chart ? 'financials' : (s.rows.length ? 'financials (table)' : 'financials');
    case 'appendix': case 'case_study': return s.chart ? 'appendix (chart)' : (s.rows.length ? 'appendix (table)' : 'appendix (text)');
    case 'ask': return s.use_of_funds.length || !s.stats.length ? 'ask' : 'ask (stats)';
    default: return s.type;
  }
}

// px the standard head takes beyond its two-line allowance (negative for a one-line title).
function headExtra(s, v) {
  const tl = Math.min(3, linesOf(s.title, TITLE_BOX[v]));
  let px = (tl - 2) * pv(HEADG.line, v);
  if (s.kicker) px += HEADG.kicker;
  if (s.subtitle) px += HEADG.subtitle.base + linesOf(s.subtitle, HEADG.subtitle.cpl) * HEADG.subtitle.line;
  if (s.body && v === 'read') px += HEADG.body.base + linesOf(s.body, HEADG.body.cpl) * HEADG.body.line;
  return px;
}
// Height of a list of points in a column: the first has half the padding.
function pointsPx(points, col, v) {
  if (!points.length) return 0;
  return points.reduce((a, p) => a + pv(col.pad, v) + linesOf(p, pv(col.cpl, v)) * pv(col.line, v), 0) - pv(col.pad, v) / 2;
}
// Longest point (characters) that still fits when n points share `px` of column height.
function pointRoom(px, n, col, v) {
  const lines = Math.floor(((px + pv(col.pad, v) / 2) / n - pv(col.pad, v)) / pv(col.line, v));
  return Math.max(0, lines) * boxCpl(pv(col.cpl, v));
}
const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');
// Budgets stop 14px above the source caption, so a 2 percent overrun still clears it.
const over = (need, room) => need > room * 1.02;
const approx = (c) => c + ' characters (about ' + Math.round(c / 6) + ' words)';

// Height of a table: header, rows, half a row for every extra wrapped line. Cells are
// measured in the body face at 26px; columns share the row in proportion to their widest cell.
function tablePx(s) {
  const rows = s.rows.map((r) => (Array.isArray(r) ? r : (r.cells || [r.name].concat(asArray(r.values)))));
  const cols = Math.max(s.columns.length, ...rows.map((r) => r.length));
  const str = (c) => (c === true || c === false || c == null ? 'x' : String(c));
  const cellPx = (c, weight) => textPx(str(c), faceOf(bbox(0, 26, weight)), 26);
  const need = [];
  for (let j = 0; j < cols; j++) need.push(Math.max(40, cellPx(s.columns[j], 600), ...rows.map((r) => cellPx(r[j]))));
  const avail = (1680 - 48 * cols) * 0.99;
  const sum = need.reduce((a, b) => a + b, 0);
  const fits = sum <= avail;
  const width = need.map((n) => (fits ? n : Math.max(60, (n * avail) / sum)));
  // once a table wraps, the browser gives columns less than their share: 12 percent slack
  const linesIn = (cells, weight) => Math.max(1, ...cells.map((c, j) => (fits ? 1 : wrapLines(str(c), (width[j] || 60) * 0.88, faceOf(bbox(0, 26, weight)), 26))));
  const headerLines = linesIn(s.columns, 600);
  let px = TABLE_CAP.header + (headerLines - 1) * TABLE_CAP.wrap;
  let wrapped = 0;
  rows.forEach((r) => { const l = linesIn(r); wrapped += l - 1; px += TABLE_CAP.row + (l - 1) * TABLE_CAP.wrap; });
  let worst = 0;
  need.forEach((n, j) => { if (n / width[j] > need[worst] / width[worst]) worst = j; });
  const chPx = TABLE_CAP.charPx;
  return { px, cols, rows: rows.length, wrapped, worstCol: worst + 1, worstLen: Math.max(len(s.columns[worst]), ...rows.map((r) => len(str(r[worst])))), fitLen: Math.floor(width[worst] / chPx) };
}

// One actionable line per violation. Returns an array of strings.
function lintDeck(deck, theme, faces) {
  const v = deck.meta.variant === 'read' ? 'read' : 'present';
  FACES = faces || facesOf(theme || resolveTheme(deck.meta, loadThemesCss()));
  const out = [];
  deck.slides.forEach((s, i) => {
    if (s.type === 'sources') return;
    const form = formOf(s);
    const cap = CAPACITY[form] || {};
    const say = (msg) => out.push('slide ' + (i + 1) + ' (' + s.type + '): ' + msg);
    const nStats = s.stats.length;
    const nPts = s.points.length;

    // ---- title, subtitle, body
    // titles are wrapped in the deck's display face: three lines for a slide title, fewer or more at other sizes
    const ownTitle = cap.titleLines || 0;
    const askWords = String(s.title || '').split(/\s+/).length;
    const tBox = s.type === 'cover' ? dbox(1560, nStats ? 128 : 148) : s.type === 'ask' ? (askWords > 6 ? OWN.askLong : askWords > 3 ? OWN.askMedium : dbox(1680, 128)) : (cap.titleBox || TITLE_BOX[v]);
    const tFit = s.type === 'ask' ? (askWords > 6 ? 3 : askWords > 3 ? 2 : 1) : (ownTitle || 3);
    const tLines = linesOf(s.title, tBox);
    if (tLines > tFit) say('title is ' + len(s.title) + ' characters and wraps to ' + tLines + ' lines in this deck\'s display face; ' + plural(tFit, 'line') + ' fit (about ' + tFit * boxCpl(tBox) + ' characters). Shorten the headline and move the detail to the notes.');
    const subMax = cap.subtitle || HEADG.subtitle.max;
    if (s.subtitle && len(s.subtitle) > subMax) say('subtitle is ' + len(s.subtitle) + ' characters; ' + subMax + ' fit. Cut it to one sentence.');
    if (s.body && v === 'read' && len(s.body) > HEADG.body.max) say('body is ' + len(s.body) + ' characters; ' + HEADG.body.max + ' fit (three lines). Trim it or move part to the notes.');
    if (cap.kicker && len(s.kicker) > cap.kicker) say('kicker is ' + len(s.kicker) + ' characters; ' + cap.kicker + ' fit on one line.');

    // ---- fields this layout does not draw
    if (s.chart && !CHART_TYPES.includes(s.type)) say('`chart` is not drawn on a ' + s.type + ' slide. Use traction, financials or appendix for a chart.');
    if (s.image && !['cover', 'problem', 'solution', 'product', 'appendix', 'case_study'].includes(s.type)) say('`image` is not shown on a ' + s.type + ' slide. Use product, solution, problem or appendix.');
    if (form === 'problem (image)' && nStats) say('stats are not shown when a problem slide has an image. Drop the image or move the number into the headline.');
    if (s.rows.length && !cap.table && !['team', 'roadmap'].includes(s.type)) say('`rows` is not drawn on this layout' + (s.chart ? ' when the slide has a chart' : '') + '. Put the table on its own appendix slide.');

    // ---- counts
    const maxStats = pv(cap.stats, v);
    if (maxStats !== undefined && nStats > maxStats) {
      say(maxStats === 0 ? 'stats are not shown on this layout. Move the ' + plural(nStats, 'figure') + ' into the points or the headline.'
        : plural(nStats, 'stat') + '; ' + maxStats + ' fit' + (v === 'read' && pv(cap.stats, 'present') > maxStats ? ' in the read variant (each carries a source line)' : '') + '. Cut ' + (nStats - maxStats) + ' or move it to the notes.');
    }
    const maxPts = cap.points;
    if (maxPts !== undefined && nPts > maxPts) {
      say(maxPts === 0 ? 'points are not shown on this layout. Remove them or use another slide type.'
        : plural(nPts, 'point') + '; ' + maxPts + ' fit. Cut ' + (nPts - maxPts) + ' or split the slide.');
    }
    const stats = s.stats.slice(0, maxStats === undefined ? MAX_STATS : maxStats);
    const points = s.points.slice(0, maxPts === undefined ? MAX_POINTS : maxPts);

    // ---- single items
    stats.forEach((st, k) => {
      if (cap.statLabel && len(st.label) > cap.statLabel) say('stat ' + (k + 1) + ' label is ' + len(st.label) + ' characters; ' + cap.statLabel + ' fit. Keep the unit and the period, move the rest to the notes.');
      const vMax = cap.statValue || 14;
      if (!isPlaceholder(st.value) && len(st.value) > vMax) say('stat ' + (k + 1) + ' value "' + st.value + '" is ' + len(st.value) + ' characters; ' + vMax + ' fit at display size. Put the unit in the label.');
    });
    points.forEach((p, k) => {
      if (cap.pointChars && len(p) > cap.pointChars) say('point ' + (k + 1) + ' is ' + approx(len(p)) + '; ' + cap.pointChars + ' fit. Cut it to one claim.');
    });

    // ---- vertical budgets
    const extra = ownTitle ? 0 : headExtra(s, v);
    const budget = pv(BODY_PX, v) - extra;
    const headNote = extra > 20 ? ' (a third title line, a kicker, a subtitle or a body paragraph each take space from it)' : '';

    if (cap.table && s.rows.length) {
      const t = tablePx(s);
      if (t.cols > TABLE_CAP.cols) say('table has ' + t.cols + ' columns; ' + TABLE_CAP.cols + ' fit. Drop a column or split the table.');
      const ptsPx = points.length ? 48 + pointsPx(points, COL.compact(1164), v) : 0;
      const fitRows = Math.floor((budget - TABLE_CAP.header) / TABLE_CAP.row);
      const fitRowsPts = Math.floor((budget - TABLE_CAP.header - ptsPx) / TABLE_CAP.row);
      if (over(t.px + ptsPx, budget)) {
        const parts = [plural(t.rows, 'row')];
        if (t.wrapped) parts.push(plural(t.wrapped, 'wrapped cell line'));
        if (points.length) parts.push(plural(points.length, 'point'));
        say('table with ' + parts.join(', ') + ' is about ' + Math.round(((t.px + ptsPx) / budget - 1) * 100) + ' percent too tall' + headNote + '. Fits ' + plural(Math.max(0, fitRows), 'single-line row') +
          (points.length ? ', or ' + Math.max(0, fitRowsPts) + ' with ' + (points.length === 1 ? 'the point' : 'these points') : '') + '. ' +
          (t.wrapped ? 'Shorten column ' + t.worstCol + ' (longest cell ' + t.worstLen + ' characters, about ' + t.fitLen + ' fit with ' + t.cols + ' columns), cut rows' : 'Cut rows') + (points.length ? ', or move the point to the notes.' : '.'));
      }
    } else if (cap.share && cap.col) {
      // stats and points stacked in one side column (beside a chart)
      const sh = cap.share;
      const statPx = (st) => pv(sh.base, v) + linesOf(st.label, sh.cpl) * sh.line;
      const room = budget - (cap.sideLabel || 0);
      const need = stats.reduce((a, st) => a + statPx(st), 0) + sh.gapStat * Math.max(0, stats.length - 1) + (stats.length && points.length ? sh.gap : 0) + pointsPx(points, cap.col, v);
      if (over(need, room)) {
        const one = pv(sh.base, v) + 2 * sh.line + sh.gapStat;       // a stat with a two-line label
        const fits = [];
        for (let k = Math.min(stats.length, Math.floor((room + sh.gapStat) / one)); k >= 0 && fits.length < 3; k--) {
          const left = room - k * one + (k ? sh.gapStat - sh.gap : 0);
          const np = Math.max(1, points.length);
          const c = Math.min(cap.pointChars, pointRoom(left, np, cap.col, v));
          if (!points.length) { fits.push(plural(k, 'stat')); break; }
          if (c >= 30) fits.push((k ? plural(k, 'stat') + ' and ' : '') + plural(np, 'point') + ' up to ' + c + ' characters' + (np > 1 ? ' each' : ''));
          else if (k === Math.min(stats.length, Math.floor((room + sh.gapStat) / one))) fits.push(plural(k, 'stat') + ' and no point');
        }
        say((stats.length ? plural(stats.length, 'stat') + ' and ' : '') + plural(points.length, 'point') + ' overfill the side column by about ' + Math.round((need / room - 1) * 100) + ' percent' + headNote + '. Fits ' + fits.join(', or ') + '. ' + (stats.length ? 'Cut a stat or move a point to the notes.' : 'Shorten the points or move one to the notes.'));
      }
    } else if (cap.col && points.length && s.type !== 'two_column') {
      // a column of points with its own budget
      let room = budget;
      if (form === 'business_model') {
        // the stats row above the points: value, label lines, margin
        const n = Math.max(1, stats.length);
        const labelCpl = cplFor((1680 - 72 * (n - 1)) / n, 26);
        room -= 48 + 92 + Math.max(1, ...stats.map((st) => linesOf(st.label, labelCpl))) * 34 + (v === 'read' ? 32 : 0);
      }
      if (form === 'insight') room = 940 - 96 - Math.min(3, linesOf(s.title, OWN.insight)) * 78 - 64 - (s.kicker ? 51 : 0) - (s.subtitle ? 40 + linesOf(s.subtitle, bbox(1300, 34)) * 48 : 0) - (s.body && v === 'read' ? 28 + linesOf(s.body, HEADG.body.cpl) * 41 : 0);
      const need = pointsPx(points, cap.col, v);
      if (over(need, room)) {
        const c = Math.min(cap.pointChars, pointRoom(room, points.length, cap.col, v));
        say(plural(points.length, 'point') + ' (' + points.reduce((a, p) => a + len(p), 0) + ' characters in all) overfill the column by about ' + Math.round((need / room - 1) * 100) + ' percent' + headNote + '. Fits ' +
          (c >= 30 ? plural(points.length, 'point') + ' up to ' + approx(c) + ' each' : plural(points.length - 1, 'point')) +
          (points.length > 1 ? ', or ' + plural(points.length - 1, 'point') + ' up to ' + Math.min(cap.pointChars, pointRoom(room, points.length - 1, cap.col, v)) + ' characters each' : '') + '. Shorten the points or cut one.');
      }
    }

    if (cap.statsCol && stats.length) {
      // stats in a column of their own (traction without a chart)
      const sc = cap.statsCol;
      const need = stats.reduce((a, st) => a + pv(sc.base, v) + linesOf(st.label, sc.cpl) * sc.line, 0) + sc.gapStat * (stats.length - 1);
      if (over(need, budget)) say(plural(stats.length, 'stat') + ' overfill the side column by about ' + Math.round((need / budget - 1) * 100) + ' percent' + headNote + '. Fits ' + Math.max(1, Math.floor((budget + sc.gapStat) / (pv(sc.base, v) + 2 * sc.line + sc.gapStat))) + ' stats with labels up to ' + 2 * boxCpl(sc.cpl) + ' characters. Cut a stat or shorten the labels.');
    }
    if (cap.statsGrid && stats.length && !s.image) {
      // stats in a two-column grid beside the points (appendix, case study)
      const g = cap.statsGrid;
      const rowsN = Math.ceil(stats.length / 2);
      const need = rowsN * (g.base + Math.max(...stats.map((st) => linesOf(st.label, g.cpl))) * g.line + (v === 'read' ? 32 : 0)) + g.gap * (rowsN - 1);
      if (over(need, budget)) say(plural(stats.length, 'stat') + ' beside the points are about ' + Math.round((need / budget - 1) * 100) + ' percent too tall' + headNote + '. Fits 2 stats, or 4 with labels up to ' + 2 * boxCpl(g.cpl) + ' characters under a short head. Cut two stats or shorten the labels.');
    }
    if (s.type === 'closing') {
      // bottom-anchored block under the logo: one-liner, the facts in columns, the contact line
      const n = Math.min(3, Math.max(1, points.length));
      const ptBox = bbox((1680 - 72 * (n - 1)) / n, 28);
      const need = Math.min(4, tLines) * 102 + (points.length ? 136 + Math.max(...points.map((p) => linesOf(p, ptBox))) * 39.2 : 0) + (s.subtitle ? 64 + linesOf(s.subtitle, bbox(1680, 28)) * 42 : 0);
      if (over(need, 712)) say('the closing line (' + plural(tLines, 'line') + '), the facts and the contact line are about ' + Math.round((need / 712 - 1) * 100) + ' percent too tall under the logo. Shorten the title to about ' + (tLines - 1) * boxCpl(OWN.closing) + ' characters or keep each fact to one line (about ' + boxCpl(ptBox) + ' characters).');
    }
    if (s.type === 'cover') {
      const size = nStats ? 128 : 148;
      const sub = s.subtitle || deck.meta.tagline;
      const subLines = sub ? linesOf(sub, bbox(1240, 40)) : 0;
      const need = (s.kicker ? 51 : 0) + Math.min(2, tLines) * size * 0.98 + (subLines ? 40 + subLines * 52 : 0) + (nStats ? 226 : 0);
      const room = 1080 - (nStats ? 168 : 200) - 168 - 40;
      if (subLines > 2) say('subtitle wraps to ' + subLines + ' lines on the cover; 2 fit (about ' + 2 * boxCpl(bbox(1240, 40)) + ' characters). Say what the company does in one sentence.');
      else if (over(need, room)) say('the cover block (kicker, title, subtitle' + (nStats ? ', fast facts' : '') + ') is about ' + Math.round((need / room - 1) * 100) + ' percent too tall and would run into the logo. Keep the title to one line or drop the fast facts.');
    }
    if (s.type === 'statement') {
      const need = (s.kicker ? 51 : 0) + linesOf(s.title, dcpl(OWN.statement)) * 100 + (s.subtitle ? 40 + linesOf(s.subtitle, cplFor(1300, 34)) * 48 : 0) + (s.body && v === 'read' ? 28 + linesOf(s.body, HEADG.body.cpl) * 41 : 0) + (points.length ? 48 + pointsPx(points, COL.compact(1164), v) : 0);
      if (over(need, 820)) say('the statement, its subtitle and points are about ' + Math.round((need / 820 - 1) * 100) + ' percent too tall. A statement is one line: fits a title of about ' + 4 * boxCpl(OWN.statement) + ' characters alone, or about 70 with a subtitle and three short points. Cut the points first.');
    }

    // ---- per-type geometry
    if (s.type === 'market' && stats.length) {
      const colW = points.length ? 1064 : 1680;
      const need = stats.reduce((a, st, k) => a + 106 + linesOf(st.label, cplFor(colW * [1, 0.72, 0.5][k] - 72, 22)) * 29 + (v === 'read' ? 26 : 0), 0) + 16 * (stats.length - 1);
      if (over(need, budget)) say('the three market blocks are about ' + Math.round((need / budget - 1) * 100) + ' percent too tall' + headNote + '. Keep each label to two lines (about ' + 2 * boxCpl(cplFor((points.length ? 1064 : 1680) * 0.5 - 72, 22)) + ' characters in the narrowest block) and the method in it short.');
    }
    if (s.type === 'go_to_market' && points.length) {
      const n = points.length;
      const cpl = n > 3 ? cplFor(378, 26) : cplFor(n === 1 ? 1000 : (1680 - 56 * (n - 1)) / n, 28);     // step text width and size by count
      const line = n > 3 ? 36.4 : 39.2;
      const statsPx = stats.length ? 72 + 96 + 12 + Math.max(...stats.map((st) => linesOf(st.label, cplFor(514, 26)))) * 34 + (v === 'read' ? 32 : 0) : 0;
      const need = 120 + Math.max(...points.map((p) => linesOf(p, cpl))) * line + statsPx;
      if (over(need, budget)) say(plural(n, 'step') + (stats.length ? ' plus the stats row' : '') + ' are about ' + Math.round((need / budget - 1) * 100) + ' percent too tall' + headNote + '. Fits ' + n + ' steps up to ' +
        Math.max(0, Math.floor((budget - 120 - statsPx) / line)) * boxCpl(cpl) + ' characters each' + (stats.length ? ', or longer steps without the stats' : '') + '. Shorten the longest step.');
    }
    if (s.type === 'team') {
      if (s.team.length > cap.members) say(plural(s.team.length, 'person') + '; ' + cap.members + ' fit. Keep founders and key hires only.');
      const people = s.team.slice(0, cap.members);
      const n = Math.min(4, Math.max(2, people.length));
      const w = { 2: 554, 3: 464, 4: 324 }[n];                     // text width of one person column
      const bioPx = n > 3 ? 20 : 22;
      const noteLen = len(s.points[0]);
      const note = noteLen ? 56 + linesOf(s.points[0], cplFor(1680, 24)) * 34 : 0;
      const tallest = (p) => 196 + linesOf(p.name, bbox(w, 34, 600)) * 41 + 8 + (p.role ? linesOf(p.role, cplFor(w, 24)) * 31 : 0) + 20 + (p.bio ? linesOf(p.bio, cplFor(w, bioPx)) * bioPx * 1.45 : 0);
      people.forEach((m, k) => {
        if (len(m.name) > cap.name) say('person ' + (k + 1) + ' name is ' + len(m.name) + ' characters; ' + cap.name + ' fit.');
        if (len(m.role) > cap.role) say('person ' + (k + 1) + ' role is ' + len(m.role) + ' characters; ' + cap.role + ' fit.');
        if (len(m.bio) > cap.bio) say('person ' + (k + 1) + ' proof line is ' + approx(len(m.bio)) + '; ' + cap.bio + ' fit. One accomplishment with a number.');
        else if (over(tallest(m) + note, budget)) say('person ' + (k + 1) + ' (name, role and proof line) is about ' + Math.round(((tallest(m) + note) / budget - 1) * 100) + ' percent too tall for a ' + n + '-person row' + headNote + '. Keep the proof line near ' + (n > 3 ? 110 : 150) + ' characters and the role on one line' + (noteLen ? ', or drop the note under the team' : '') + '.');
      });
    }
    if (s.type === 'roadmap') {
      if (s.milestones.length > cap.milestones) say(plural(s.milestones.length, 'milestone') + '; ' + cap.milestones + ' fit on the timeline. Merge or cut.');
      s.milestones.slice(0, cap.milestones).forEach((m, k) => {
        const what = typeof m === 'string' ? m : m.what;
        if (len(what) > cap.what) say('milestone ' + (k + 1) + ' is ' + len(what) + ' characters; ' + cap.what + ' fit.');
        if (typeof m !== 'string' && len(m.proves) > cap.proves) say('milestone ' + (k + 1) + ' "proves" text is ' + len(m.proves) + ' characters; ' + cap.proves + ' fit.');
        if (typeof m !== 'string' && len(m.when) > cap.when) say('milestone ' + (k + 1) + ' date is ' + len(m.when) + ' characters; ' + cap.when + ' fit ("Q2 2027").');
      });
    }
    if (s.type === 'ask') {
      if (s.use_of_funds.length > cap.funds) say(plural(s.use_of_funds.length, 'use-of-funds bucket') + '; ' + cap.funds + ' fit (the palette has five colours). Merge the small ones.');
      s.use_of_funds.forEach((u, k) => { if (cap.fundLabel && len(u.label) > cap.fundLabel) say('use-of-funds label ' + (k + 1) + ' is ' + len(u.label) + ' characters; ' + cap.fundLabel + ' fit.'); });
      const ms = s.milestones;
      if (ms.length > cap.milestones) say(plural(ms.length, 'milestone') + '; ' + cap.milestones + ' are shown. Cut ' + (ms.length - cap.milestones) + '.');
      const msText = ms.slice(0, cap.milestones).map((m) => (typeof m === 'string' ? m : (m.when || '') + ' ' + (m.what || '')));
      // legend under the bar wraps: rows of labels across the 1040px funds column
      let legendRows = s.use_of_funds.length ? 1 : 0;
      let lx = 0;
      s.use_of_funds.slice(0, cap.funds).forEach((u) => { const w = textPx(String(u.label || '') + ' 100%', FACES.body, 24) + 68; if (lx && lx + w > 1040) { legendRows += 1; lx = 0; } lx += w; });
      const words = String(s.title || '').split(/\s+/).length;
      const titlePx = words > 6 ? linesOf(s.title, dcpl(OWN.askLong)) * 69 : words > 3 ? linesOf(s.title, dcpl(OWN.askMedium)) * 96 : 128;
      const room = 940 - 96 - (s.kicker ? 51 : 0) - titlePx - (s.subtitle ? 28 + linesOf(s.subtitle, HEADG.subtitle.cpl) * 42 : 0) - 72 - 49;
      const msCol = { pad: 28, line: 36.4, cpl: bbox(504, 26) };     // 520px column less the gap after the date
      const need = msText.reduce((a, m) => a + 28 + linesOf(m, msCol.cpl) * 36.4, 0);
      if (msText.length && over(need, room)) say(plural(msText.length, 'milestone') + ' overfill their column by about ' + Math.round((need / room - 1) * 100) + ' percent. Fits ' + msText.length + ' up to ' + Math.min(cap.milestoneChars, pointRoom(room, msText.length, msCol, v)) + ' characters each, or ' + (msText.length - 1) + ' up to ' + Math.min(cap.milestoneChars, pointRoom(room, Math.max(1, msText.length - 1), msCol, v)) + '. Shorten them, or shorten the headline and subtitle above.');
      msText.forEach((m, k) => { if (len(m) > cap.milestoneChars) say('milestone ' + (k + 1) + ' is ' + len(m) + ' characters; ' + cap.milestoneChars + ' fit.'); });
      const fundsNeed = (s.use_of_funds.length ? 84 + 24 + legendRows * 31 + (legendRows - 1) * 20 : 0) +
        (stats.length ? 16 + 84 + Math.max(...stats.map((st) => linesOf(st.label, cplFor((1040 - 72 * (stats.length - 1)) / stats.length, 26)))) * 34 + (v === 'read' ? 32 : 0) : 0) +
        (points.length ? 48 + pointsPx(points, COL.compact(1004), v) : 0);
      if (over(fundsNeed, room)) say('the use-of-funds column (bar, ' + (legendRows > 1 ? legendRows + ' legend rows' : 'legend') + (stats.length ? ', stats' : '') + (points.length ? ', point' : '') + ') is about ' + Math.round((fundsNeed / room - 1) * 100) + ' percent too tall. Shorten the bucket labels to a few words each' + (points.length ? ', or move the point to the notes' : '') + ', or shorten the headline and subtitle above.');
    }
    if (s.type === 'two_column') {
      s.columns.slice(0, 2).forEach((c, k) => {
        if (!c || typeof c !== 'object') return;
        const pts = asArray(c.points);
        if (len(c.title) > cap.colTitle) say('column ' + (k + 1) + ' heading is ' + len(c.title) + ' characters; ' + cap.colTitle + ' fit on one line.');
        if (pts.length > cap.points) say('column ' + (k + 1) + ' has ' + plural(pts.length, 'point') + '; ' + cap.points + ' are shown.');
        const room = budget - (c.title ? 28 + linesOf(c.title, dcpl(OWN.colHeading)) * 46 : 0) - (c.body ? 24 + linesOf(c.body, cplFor(780, 28)) * 41 : 0);
        const need = pointsPx(pts.slice(0, cap.points), cap.col, v);
        if (over(need, room)) say('column ' + (k + 1) + ' is about ' + Math.round((need / room - 1) * 100) + ' percent too tall' + headNote + '. Fits ' + plural(Math.min(pts.length, cap.points), 'point') + ' up to ' + Math.min(cap.pointChars, pointRoom(room, Math.min(pts.length, cap.points), cap.col, v)) + ' characters each. Shorten or cut one.');
      });
    }

    // ---- chart
    if (s.chart && CHART_TYPES.includes(s.type)) {
      const c = s.chart;
      const n = c.labels.length;
      if (c.kind === 'horizontal_bar') {
        if (n > CHART_CAP.hbarLabels) say('horizontal bar chart has ' + n + ' bars; ' + CHART_CAP.hbarLabels + ' fit. Group the smallest into "other".');
        c.labels.forEach((l) => { if (len(l) > CHART_CAP.hbarLabelChars) say('bar label "' + l + '" is ' + len(l) + ' characters; ' + CHART_CAP.hbarLabelChars + ' fit beside the bar.'); });
      } else {
        if (n > CHART_CAP.labels) say('chart has ' + n + ' x labels; ' + CHART_CAP.labels + ' fit. Aggregate (months to quarters) or show the last ' + CHART_CAP.labels + '.');
        // neighbouring labels are centred one slot apart: two of them must not touch
        const slot = ((cap.chart || 1080) - 138) / Math.max(1, n);
        const lw = c.labels.map((l) => textPx(l, FACES.body, 22));
        let clash = -1;
        for (let k = 0; k + 1 < lw.length; k++) if ((lw[k] + lw[k + 1]) / 2 + 6 > slot) { clash = k; break; }
        if (n <= CHART_CAP.labels && clash >= 0) say('x labels "' + c.labels[clash] + '" and "' + c.labels[clash + 1] + '" would touch with ' + n + ' labels; about ' + Math.floor((slot - 6) / (22 * BODY_EM * 1.05)) + ' characters fit each. Shorten them ("Jan 26") or use fewer.');
      }
      // the chart scales down to whatever height the head and the legend leave
      const natural = cap.chart === 1140 ? 600 : 560;
      const scale = (budget + 20 - 42) / natural;
      if (scale < 0.75) say('the chart is squeezed to about ' + Math.round(scale * 100) + ' percent of its size by the head above it' + headNote + '. Shorten the title to two lines or drop the subtitle.');
      let legendRows = c.series.length > 1 ? 1 : 0;
      let lx = 0;
      c.series.forEach((se) => { const w = 72 + textPx(se.name, FACES.body, 22) * 1.02; if (lx && lx + w > (cap.chart || 1080) - 138 + 44) { legendRows += 1; lx = 0; } lx += w; });
      if (legendRows > CHART_CAP.legendRows) say('the legend needs ' + legendRows + ' rows and leaves little room for the plot; ' + CHART_CAP.legendRows + ' rows fit. Shorten the series names (about ' + Math.floor((((cap.chart || 1080) - 138) / 2 - 72) / 11.44) + ' characters fit two to a row) and put the unit in y_label.');
      if (c.series.length > CHART_CAP.series) say('chart has ' + c.series.length + ' series; ' + CHART_CAP.series + ' fit (five palette colours). Combine or cut.');
      c.series.forEach((se) => { if (len(se.name) > CHART_CAP.legendChars) say('legend name "' + se.name.slice(0, 30) + '..." is ' + len(se.name) + ' characters; ' + CHART_CAP.legendChars + ' fit. Put the unit in y_label.'); });
    }
  });
  return out;
}

// The capacity table as markdown (node build_deck.js --capacities).
function capacityMarkdown() {
  // reference faces for the printed numbers: the widest theme faces (midnight display, paper body)
  FACES = { display: { family: 'theme:midnight:display', exact: true, weight: 600, tracking: -0.02 }, body: { family: 'theme:paper:body', exact: true, weight: 400, tracking: 0 } };
  const both = (f) => { const p = f('present'); const r = f('read'); return p === r ? String(p) : p + ' / ' + r; };
  const L = [];
  L.push('Values are `present / read` where the two variants differ. Lengths are characters including spaces (6 characters is about one word).');
  L.push('');
  L.push('| Slide type (form) | Stats | Points | Longest point at that count | Shared column, what fits | Other limits |');
  L.push('|---|---|---|---|---|---|');
  Object.keys(CAPACITY).forEach((form) => {
    const cap = CAPACITY[form];
    const statsCell = cap.stats === undefined ? '' : both((v) => pv(cap.stats, v)) + (cap.statLabel ? ', label ' + cap.statLabel : '');
    const ptsCell = cap.points === undefined ? '' : String(cap.points);
    let longest = '';
    let shared = '';
    if (cap.table) { longest = cap.pointChars + ' (each line under the table costs half a row)'; }
    else if (cap.share) {
      const fitsFor = (v) => {
        const room = pv(BODY_PX, v) - (cap.sideLabel || 0);
        const sh = cap.share;
        const one = pv(sh.base, v) + 2 * sh.line + sh.gapStat;
        const kMax = Math.min(pv(cap.stats, v), Math.floor((room + sh.gapStat) / one));
        const parts = [plural(kMax, 'stat')];
        for (let k = kMax - 1; k >= Math.max(0, kMax - 2); k--) {
          const c = Math.min(cap.pointChars, pointRoom(room - k * one + (k ? sh.gapStat - sh.gap : 0), 1, cap.col, v));
          if (c >= 30) parts.push((k ? plural(k, 'stat') + ' + ' : '') + '1 point of ' + c);
        }
        return parts.join('; ');
      };
      shared = both(fitsFor);
      longest = both((v) => Math.min(cap.pointChars, pointRoom(pv(BODY_PX, v) - (cap.sideLabel || 0), cap.points, cap.col, v))) + ' (no stats)';
    } else if (cap.col && cap.points) {
      const roomFor = (v) => (form === 'business_model' ? pv(BODY_PX, v) - 48 - 92 - 4 * 34 - (v === 'read' ? 32 : 0) : form === 'insight' ? 940 - 96 - 2 * 78 - 64 : form === 'two_column' ? pv(BODY_PX, v) - 74 : pv(BODY_PX, v));
      longest = both((v) => Math.min(cap.pointChars, pointRoom(roomFor(v), cap.points, cap.col, v)));
    } else if (cap.pointChars && cap.points) longest = String(cap.pointChars);
    const other = [];
    if (cap.titleLines) { const tb = cap.titleBox || dbox(1560, 148); other.push('title ' + plural(cap.titleLines, 'line') + ' (about ' + cap.titleLines * boxCpl(tb) + ' characters)'); }
    if (cap.subtitle) other.push('subtitle ' + cap.subtitle);
    if (cap.kicker) other.push('kicker ' + cap.kicker);
    if (cap.statValue) other.push('stat value ' + cap.statValue);
    if (cap.members) other.push(cap.members + ' people: name ' + cap.name + ', role ' + cap.role + ', proof line ' + cap.bio);
    if (cap.funds) other.push(cap.funds + ' use-of-funds buckets, label ' + cap.fundLabel);
    if (cap.milestones) other.push(cap.milestones + ' milestones' + (cap.milestoneChars ? ' of ' + cap.milestoneChars : '') + (cap.what ? ': date ' + cap.when + ', milestone ' + cap.what + ', proves ' + cap.proves : ''));
    if (cap.colTitle) other.push('column heading ' + cap.colTitle + '; points per column');
    if (cap.table) other.push('table, see below');
    if (cap.chart) other.push('chart, see below');
    if (form === 'go_to_market') other.push('points are numbered steps side by side; the 2-stat row fits underneath');
    if (form === 'market') other.push('3 blocks, widest first; a label fits two lines in its block (about 80 characters in the narrowest when there are side points)');
    L.push('| ' + form + ' | ' + statsCell + ' | ' + ptsCell + ' | ' + longest + ' | ' + shared + ' | ' + other.join('; ') + ' |');
  });
  L.push('');
  L.push('Rules that apply to every type:');
  L.push('');
  L.push('- Text is measured, not counted: the lint wraps the actual words of each title, point and label in the deck\'s own fonts (the four theme faces and 50 Google Fonts families used as `font_display` or `font_body` are built in; an unknown family is treated as wide). The character figures in this table are a guide for the widest theme faces; narrower faces fit more.');
  L.push('- Slide title, two lines / three lines (the maximum), in characters that every sample headline kept within: ' +
    Object.keys(DISPLAY).map((t) => t + ' ' + 2 * DISPLAY[t].title.present + ' / ' + DISPLAY[t].max.present + ' (read ' + 2 * DISPLAY[t].title.read + ' / ' + DISPLAY[t].max.read + ')').join(', ') + '. Titles wrap balanced, so no line is left with a single word.');
  L.push('- The budgets above assume a two-line title. A third title line, a `kicker`, a `subtitle` (max ' + HEADG.subtitle.max + ') or, in the read variant, a `body` paragraph (max ' + HEADG.body.max + ') each take about one row of space: one point, one stat or one table row less. A one-line title gives one row back. The lint does this arithmetic.');
  L.push('- Stat value: up to 14 characters; long values are set smaller instead of wrapping. Put the unit in the label when you can.');
  const rowsFit = (v, extra) => Math.floor((pv(BODY_PX, v) - extra - TABLE_CAP.header) / TABLE_CAP.row);
  L.push('- Table: up to ' + TABLE_CAP.cols + ' columns. ' + both((v) => rowsFit(v, 0)) + ' single-line rows under a two-line title, ' + both((v) => rowsFit(v, HEADG.kicker)) + ' with a kicker ("Appendix"), ' + both((v) => rowsFit(v, 48 + 50)) + ' with one one-line point underneath. A cell that wraps costs half a row per extra line. Cells stay on one line when the longest cells of all columns add up to about ' +
    [3, 4, 5, 6].map((c) => Math.floor(((1680 - 48 * c) * 0.99) / TABLE_CAP.charPx) + ' characters (' + c + ' columns)').join(', ') + '.');
  L.push('- Chart: up to ' + CHART_CAP.labels + ' x labels (' + Math.floor(((1140 - 138) / 12 - 8) / 11.5) + ' characters each at 12 labels, ' + Math.floor(((1140 - 138) / 8 - 8) / 11.5) + ' at 8), ' + CHART_CAP.hbarLabels + ' bars of ' + CHART_CAP.hbarLabelChars + ' characters for `horizontal_bar`, up to ' + CHART_CAP.series + ' series. Legend names wrap onto extra rows and are never cut (max ' + CHART_CAP.legendChars + ' characters, ' + CHART_CAP.legendRows + ' rows); the chart shrinks to make room, so prefer short names and put the unit in `y_label`.');
  L.push('- Source caption: one line per slide, at most three source files, then "and N more, see sources".');
  return L.join('\n');
}

// --------------------------------------------------------------------------------------
// 9. main
// --------------------------------------------------------------------------------------

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(opts.input);
  if (!fs.existsSync(inputPath)) { console.error('deck.json not found: ' + inputPath); process.exit(1); }
  let raw;
  try { raw = JSON.parse(fs.readFileSync(inputPath, 'utf8')); } catch (e) { console.error('deck.json is not valid JSON: ' + e.message); process.exit(1); }

  const inputDir = path.dirname(inputPath);
  const outDir = path.resolve(opts.out || inputDir);
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.basename(inputPath).replace(/\.json$/i, '') || 'deck';

  const ctx = { placeholders: [], missingFacts: [], kindMismatch: [] };
  const deck = normaliseDeck(raw, ctx);
  const themesCss = loadThemesCss();
  const theme = resolveTheme(deck.meta, themesCss);
  log('Building "' + deck.meta.company + '" with theme ' + theme.name + ', variant ' + deck.meta.variant + ' (' + deck.slides.length + ' slides)');

  // Pre-flight: does the content fit the layouts? One line per violation, before rendering.
  ctx.faces = await measureFaces(theme, facesOf(theme));
  const lint = lintDeck(deck, theme, ctx.faces);
  if (lint.length) {
    log('  capacity: ' + lint.length + ' warning' + (lint.length === 1 ? '' : 's') + ' (what fits per slide type: node scripts/build_deck.js --capacities)');
    lint.forEach((m) => log('    ' + m));
    if (opts.strict) { console.error('  --strict: stopping because of capacity warnings. Fix deck.json and rebuild.'); process.exit(1); }
  } else log('  capacity: all slides within their layout budgets');

  // Ledger: --facts, or pitch/facts.yaml next to the deck folder. Enriches the sources slide.
  const factsPath = opts.facts ? path.resolve(opts.facts) : path.join(inputDir, '..', 'facts.yaml');
  const ledger = readFactsYaml(factsPath);
  ctx.ledger = ledger;
  if (opts.facts && !ledger) warn('facts.yaml not readable: ' + factsPath);
  if (ledger) {
    attachLedger(ctx.sourceItems, ledger, ctx);
    deck.slides.forEach((s) => {
      if (s.type !== 'sources' || !s.items) return;
      s.rich = s.items.some((it) => it.label);
      if (deck.meta.sources !== 'full') { s.groups = groupSourcesByFile(s.items); s.figures = s.items.length; s.fileCount = s.groups.length; }
    });
    if (ctx.missingFacts.length) { warn(ctx.missingFacts.length + ' source id(s) not in ' + rel(factsPath) + ':'); ctx.missingFacts.forEach((m) => log('    ' + m)); }
    ctx.kindMismatch.forEach((m) => warn(m));
  }
  deck.slides = paginateSources(deck.slides);
  const srcPages = deck.slides.filter((s) => s.type === 'sources' && s.items);
  if (srcPages.length) {
    const files = srcPages[0].groups ? srcPages[0].fileCount + (srcPages[0].fileCount === 1 ? ' file, ' : ' files, ') : '';
    log('  sources appendix: ' + files + ctx.sourceItems.length + ' figures, ' + srcPages.length + (srcPages.length === 1 ? ' page' : ' pages') +
      (srcPages[0].groups ? '' : (ledger ? ' (meta.sources: "full")' : ' (no facts.yaml: reference list)')));
  } else if (ctx.sourceItems.length) log('  sources appendix: off (' + ctx.sourceItems.length + ' figures referenced)');

  // Images: logo, per-slide image, team photos.
  ctx.meta = deck.meta;
  const logo = resolveImage(deck.meta.logo, inputDir, outDir, 'meta.logo');
  ctx.logo = logo ? logo.html : null;
  ctx.logoSmall = ctx.logo;
  ctx.logoFile = logo;
  ctx.rasters = {};
  ctx.images = deck.slides.map((s, i) => { const r = resolveImage(s.image, inputDir, outDir, 'slide ' + (i + 1)); return r; });
  ctx.teamPhotos = deck.slides.map((s, i) => s.team.map((m) => { const r = resolveImage(m && m.photo, inputDir, outDir, 'slide ' + (i + 1) + ' team'); return r; }));
  const htmlCtx = Object.assign({}, ctx, {
    images: ctx.images.map((r) => (r ? r.html : null)),
    teamPhotos: ctx.teamPhotos.map((arr) => arr.map((r) => (r ? r.html : null))),
  });

  if (ctx.placeholders.length) {
    log('  ' + ctx.placeholders.length + ' placeholder' + (ctx.placeholders.length === 1 ? '' : 's') + ' marked "[needs number]" or "[needs detail]":');
    ctx.placeholders.forEach((p) => log('    ' + p));
  }

  const htmlPath = path.join(outDir, base + '.html');
  if (opts.html) {
    fs.writeFileSync(htmlPath, buildHtml(deck, theme, themesCss, htmlCtx));
    log('  wrote ' + rel(htmlPath) + ' (' + Math.round(fs.statSync(htmlPath).size / 1024) + ' KB)');
  }

  if (opts.pptx) {
    const pptxPath = path.join(outDir, base + '.pptx');
    try {
      const allImages = [ctx.logoFile].concat(ctx.images, ctx.teamPhotos.reduce((a, b) => a.concat(b), []));
      ctx.rasters = await rasteriseSvgs(allImages);
      const ok = await buildPptx(deck, theme, pptxPath, ctx);
      if (ok) { log('  wrote ' + rel(pptxPath)); checkPptx(pptxPath, deck.slides.length); }
    } catch (e) {
      console.error('  PPTX failed: ' + (e && e.stack || e));
      process.exitCode = 1;
    }
  }

  if (opts.check) {
    if (!opts.html && !fs.existsSync(htmlPath)) log('  --check needs deck.html; build without --pptx-only first');
    else await runCheck(htmlPath, outDir, deck.slides.length);
  }
}

if (require.main === module) main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
module.exports = { GLYPH_SET, textPx, wrapLines, facesOf, resolveTheme, loadThemesCss, CAPACITY, HEADG, BODY_PX, CHART_CAP, TABLE_CAP, DISPLAY, lintDeck, normaliseDeck, formOf, capacityMarkdown };
