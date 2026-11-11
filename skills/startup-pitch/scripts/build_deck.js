#!/usr/bin/env node
'use strict';
/*
 * build_deck.js: turn pitch/deck/deck.json into deck.html and deck.pptx.
 *
 *   node scripts/build_deck.js pitch/deck/deck.json [--html-only] [--pptx-only] [--pptx MODE]
 *                                                   [--out DIR] [--check] [--strict] [--facts FILE]
 *
 * - deck.html is one self-contained file: a fixed 1920x1080 stage scaled to the window,
 *   keyboard, click and touch navigation, speaker notes (press n), a print stylesheet with
 *   one page per slide. Slides are composed from measured cells (mosaic, colour-block
 *   split, full-bleed), each in one of the theme's tones (light, dark, accent), with
 *   inline SVG charts, diagrams and icons.
 * - deck.pptx comes in three modes (meta.pptx or --pptx): "faithful" (default; every
 *   slide is a 2x picture rendered by Chrome, with speaker notes and a title per slide),
 *   "editable" (a picture of the ground and shapes with native text boxes and native
 *   charts on top) and "none". Without Chrome the native renderer (shapes, charts and
 *   tables drawn by pptxgenjs) is used. After writing, scripts/pptx_check.py runs and,
 *   when Anthropic's pptx skill is installed on the machine, its OOXML validator too.
 * - The renderer is also the capacity lint: every text is wrapped in the deck's own fonts
 *   before anything is drawn, and what does not fit is reported per slide (--strict fails
 *   the build, --capacities prints the table of what fits).
 * - --check screenshots every slide with playwright-core and the installed Chrome to
 *   deck/qa/slide-NN.png and reports overflow, overlapping text, type below the size
 *   floor and text contrast under 4.5:1.
 *
 * Dependencies: pptxgenjs and playwright-core (scripts/package.json). Node 18+, CommonJS.
 * Themes live in assets/deck-template/themes.css (see THEMES.md), glyph widths of the
 * theme faces in font-metrics.json, icons (a subset of Lucide, ISC) in icons.json.
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
  'sources', 'custom_html', 'statement', 'two_column', 'section', 'quote',
  'case_study',   // one customer's before and after: title, points, stats, optional image or chart
];
const MAX_POINTS = 5;
const MAX_STATS = 4;
const warn = (msg) => { if (!PROBE_QUIET) console.log('  warning: ' + msg); };

// --------------------------------------------------------------------------------------
// 1. CLI
// --------------------------------------------------------------------------------------

function usage() {
  console.log('Usage: node scripts/build_deck.js pitch/deck/deck.json [--html-only] [--pptx-only] [--pptx none|faithful|editable] [--out DIR] [--check] [--strict] [--facts pitch/facts.yaml]');
  console.log('       node scripts/build_deck.js --capacities     print the capacity table (what fits on each slide type)');
  console.log('       node scripts/build_deck.js --measure-fonts  re-measure the theme faces into assets/deck-template/font-metrics.json (needs Chrome, online)');
}

function parseArgs(argv) {
  const opts = { input: null, html: true, pptx: true, pptxMode: null, out: null, check: false, facts: null, strict: false, capacities: false, measure: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--html-only') opts.pptx = false;
    else if (a === '--pptx-only') opts.html = false;
    else if (a === '--pptx') opts.pptxMode = argv[++i];
    else if (a.startsWith('--pptx=')) opts.pptxMode = a.slice(7);
    else if (a === '--check') opts.check = true;
    else if (a === '--strict') opts.strict = true;
    else if (a === '--capacities') opts.capacities = true;
    else if (a === '--measure-fonts') opts.measure = true;
    else if (a === '--out') opts.out = argv[++i];
    else if (a.startsWith('--out=')) opts.out = a.slice(6);
    else if (a === '--facts') opts.facts = argv[++i];
    else if (a.startsWith('--facts=')) opts.facts = a.slice(8);
    else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
    else if (!a.startsWith('--')) opts.input = a;
    else { console.error('Unknown option: ' + a); usage(); process.exit(1); }
  }
  if (opts.pptxMode != null && !['none', 'faithful', 'editable'].includes(String(opts.pptxMode))) { console.error('--pptx takes none, faithful or editable'); process.exit(1); }
  if (!opts.input && !opts.capacities && !opts.measure) { usage(); process.exit(1); }
  return opts;
}

const log = (msg) => console.log(msg);
// Relative path for messages when the file is under the current folder, absolute otherwise.
function rel(p) { const r = path.relative(process.cwd(), p); return r && !r.startsWith('..') ? r : p; }


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
  const sp = splitPoints(s.points);
  out.points = sp.points;
  out.pmeta = sp.pmeta;
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
    c.kind = ['bar', 'line', 'stacked_bar', 'area', 'horizontal_bar', 'donut'].includes(c.kind) ? c.kind : 'bar';
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
    if (!out.use_of_funds.length && out.chart && (out.chart.kind === 'stacked_bar' || out.chart.kind === 'donut')) {
      out.use_of_funds = out.chart.series.length === 1 && out.chart.labels.length > 1
        ? out.chart.labels.map((l, k) => ({ label: l, pct: out.chart.series[0].values[k] || 0, source: out.chart.source }))
        : out.chart.series.map((se) => ({ label: se.name, pct: se.values[0] || 0, source: out.chart.source }));
      delete out.chart;
    }
    if (!out.milestones.length && out.points.length) { out.milestones = out.points; out.points = []; }
  }
  if (out.body && ctx.variant !== 'read') warn('slide ' + (i + 1) + ': `body` is only rendered in the read variant (meta.variant: "read")');
  normaliseExtras(out, s, i);
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
const SOURCES_PER_SLIDE = 13;
const SOURCES_PAGE_PX = 520;        // table body height available under the title
// Estimated height of one ledger row at 20px type: the tallest of its wrapping cells.
function sourceRowPx(it) {
  const lines = (str, perLine) => Math.max(1, Math.ceil(String(str || '').length / perLine));
  const labelLines = lines(it.label, 32);
  const fileLines = lines(it.file, 24);
  const idLines = lines(it.id, 22);
  return Math.max(labelLines, fileLines, idLines, lines(it.value, 10)) * 28 + 16;
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

// ---- fields added with the visual vocabulary -------------------------------------------
// Called at the end of normaliseSlide: images and frames, icons on points, diagram,
// logos, sparklines, quote fields. Old decks pass through unchanged.
function normaliseExtras(out, s, i) {
  // image: "path" or {src, frame}; images: up to two of them; slide-level `frame` applies to the first
  const imgs = [];
  const addImg = (v, frame) => { if (!v) return; if (typeof v === 'string') imgs.push({ src: v, frame: frame || 'none' }); else if (v.src) imgs.push({ src: String(v.src), frame: v.frame || frame || 'none' }); };
  if (Array.isArray(s.images)) s.images.forEach((v, k) => addImg(v, k === 0 ? s.frame : null));
  else addImg(s.image, s.frame);
  if (out.type === 'quote' && !imgs.length && s.photo) addImg(s.photo);
  if (imgs.length > 2) warn('slide ' + (i + 1) + ': ' + imgs.length + ' images, keeping the first 2');
  out.images = imgs.slice(0, 2).map((im) => ({ src: im.src, frame: ['browser', 'phone', 'none'].includes(String(im.frame).toLowerCase()) ? String(im.frame).toLowerCase() : 'none' }));
  out.image = out.images.length ? out.images[0].src : undefined;
  if (s.diagram && typeof s.diagram === 'object') out.diagram = Object.assign({}, s.diagram, { kind: String(s.diagram.kind || '').toLowerCase().replace(/-/g, '_') });
  else delete out.diagram;
  out.logos = asArray(s.logos).map((l) => (typeof l === 'string' ? { name: l } : { name: String((l && l.name) || ''), image: l && l.image })).filter((l) => l.name || l.image);
  out.sparklines = asArray(s.sparklines).filter((r) => r && typeof r === 'object').map((r) => ({ label: String(r.label || ''), values: asArray(r.values), value: r.value == null ? '' : String(r.value) }));
  if (out.type === 'quote') { out.quote = s.quote || s.title || ''; if (!s.title) out.title = ''; }
  return out;
}
// points: strings, or {text, icon, title}; the text list stays a list of strings.
function splitPoints(raw) {
  const points = [], pmeta = [];
  asArray(raw).forEach((p) => {
    if (p && typeof p === 'object') { points.push(String(p.text == null ? (p.title || '') : p.text)); pmeta.push({ icon: p.icon, title: p.text == null ? undefined : p.title }); }
    else { points.push(p == null ? '' : String(p)); pmeta.push({}); }
  });
  return { points, pmeta };
}
// After the sources pages exist: number the sections, give every slide its tone.
function prepareDeck(deck, theme, ctx) {
  let sec = 0, title = '', appendix = false;
  deck.slides.forEach((s) => {
    if (s.type === 'section') { sec += 1; title = stripEm(s.label || s.title || ''); s.sectionNo = sec; }
    else if (s.type !== 'cover' && s.type !== 'closing') {
      // appendix slides (by type or by kicker) and everything after them run under "Appendix"
      if (s.type === 'sources' || s.type === 'appendix' || /^appendix$/i.test(String(s.kicker || '').trim())) { appendix = true; }
      if (appendix) { s.sectionTitle = 'Appendix'; if (sec) s.sectionNo = sec; }
      else if (sec) { s.sectionNo = sec; s.sectionTitle = title; }
    }
  });
  ctx.toneRuns = assignTones(deck.slides, theme);
}
// --------------------------------------------------------------------------------------
// 3. Themes: art directions, tones and type roles (parsed from assets/deck-template/themes.css)
// --------------------------------------------------------------------------------------

const THEMES_CSS_PATH = path.join(__dirname, '..', 'assets', 'deck-template', 'themes.css');
const TONES = ['light', 'dark', 'accent', 'pop'];
const TONE_KEYS = ['bg', 'ink', 'muted', 'accent', 'accent2', 'surface', 'rule'];
const ROLE_KEYS = ['display', 'em', 'num', 'body', 'mono'];

// Minimal stand-in so the builder still works if themes.css is missing.
const FALLBACK_THEMES_CSS = `[data-theme="paper"] {
  --display: "font-family:'Albert Sans','Helvetica Neue',Arial,sans-serif;font-weight:600;letter-spacing:-0.03em";
  --body: "font-family:'Albert Sans','Helvetica Neue',Arial,sans-serif;font-weight:400";
  --mono: "font-family:'DM Mono',Menlo,monospace;font-weight:500;letter-spacing:0.1em;text-transform:uppercase";
  --light-bg: #F6F4EF; --light-ink: #1F2429; --light-muted: #646A71; --light-accent: #1F6F5B; --light-accent2: #B8862B; --light-surface: #EAE6DC; --light-rule: #CFC9BC;
  --dark-bg: #1F2429; --dark-ink: #F6F4EF; --dark-muted: #A7ADB3; --dark-accent: #7FD1B9; --dark-accent2: #E0B455; --dark-surface: #2B3138; --dark-rule: #474E56;
  --accent-bg: #1F6F5B; --accent-ink: #F6F4EF; --accent-muted: #CFE5DD; --accent-accent: #F2C867; --accent-accent2: #F2C867; --accent-surface: #1A5F4E; --accent-rule: #5E9C8C;
  --cell: soft; --radius: 10; --gfonts: "Albert Sans:wght@400;500;600;700|DM Mono:wght@400;500"; --pptx-display: Calibri; --pptx-body: Calibri;
}`;

function loadThemesCss() {
  try { return fs.readFileSync(THEMES_CSS_PATH, 'utf8'); } catch (e) {
    warn('themes.css not found at ' + THEMES_CSS_PATH + ', using the built-in paper theme');
    return FALLBACK_THEMES_CSS;
  }
}

function themeNames(css) {
  const names = [];
  String(css).replace(/\[data-theme="([\w-]+)"\]\s*\{/g, (_, n) => { if (!names.includes(n)) names.push(n); return ''; });
  return names;
}

function parseThemeTokens(css, name) {
  const re = new RegExp('\\[data-theme="' + name + '"\\]\\s*\\{([^}]*)\\}');
  const m = css.match(re);
  if (!m) return null;
  const tokens = {};
  // A quoted value may contain semicolons (font declarations, weight lists), so match quotes whole.
  m[1].replace(/--([\w-]+)\s*:\s*("[^"]*"|[^;]+);/g, (_, k, v) => {
    v = v.trim();
    const q = v.match(/^"([^"]*)"$/);
    tokens[k] = q ? q[1] : v;
    return '';
  });
  return tokens;
}

function isHex(v) { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()); }

// ---- colour arithmetic ---------------------------------------------------------------
function rgbOf(h) { h = String(h).replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
function hexOf(c) { return '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase(); }
function mixHex(a, b, t) { const x = rgbOf(a), y = rgbOf(b); return hexOf(x.map((v, i) => v + (y[i] - v) * t)); }
function rgbaOf(h, a) { return 'rgba(' + rgbOf(h).join(',') + ',' + a + ')'; }
function luminance(h) {
  const [r, g, b] = rgbOf(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
// The nearest colour to `c` that reads on every ground in `grounds` at `min`:1 (moved
// toward black on light grounds, toward white on dark ones).
function textSafe(c, grounds, min) {
  min = min || 4.5;
  const ok = (x) => grounds.every((g) => contrast(x, g) >= min);
  if (ok(c)) return c;
  const to = contrast('#000000', grounds[0]) >= contrast('#FFFFFF', grounds[0]) ? '#000000' : '#FFFFFF';
  for (let t = 0.04; t <= 1.0001; t += 0.04) { const x = mixHex(c, to, t); if (ok(x)) return x; }
  return to;
}
function bestOn(fill, candidates) {
  return candidates.concat(['#FFFFFF', '#111111']).map((c) => [contrast(c, fill), c]).sort((a, b) => b[0] - a[0])[0][1];
}

// ---- type roles ----------------------------------------------------------------------
// A role is a list of CSS declarations; the same string styles the deck and tells the
// capacity lint which face, weight, width and tracking to measure.
function parseRole(css) {
  const get = (prop) => { const m = String(css).match(new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)')); return m ? m[1].trim() : ''; };
  const fam = get('font-family');
  return {
    css: String(css).replace(/;\s*$/, ''),
    family: (fam.match(/^['"]?([^'",]+)/) || [0, 'sans-serif'])[1].trim(),
    weight: Number(get('font-weight')) || 400,
    italic: /italic/.test(get('font-style')),
    upper: /uppercase/.test(get('text-transform')),
    tracking: parseFloat(get('letter-spacing')) || 0,
  };
}
function swapFamily(css, family) {
  return String(css).replace(/font-family\s*:\s*(['"]?)[^'",;]+\1/, "font-family:'" + String(family).replace(/['"]/g, '') + "'")
    .replace(/font-variation-settings\s*:[^;]+;?/, '').replace(/font-stretch\s*:[^;]+;?/, '');
}

function resolveTheme(meta, css) {
  let name = String(meta.theme || 'paper').toLowerCase().replace(/[\s_]+/g, '-');
  const ALIAS = { 'signal-print': 'poster', 'soft-machine': 'studio' };
  if (ALIAS[name]) name = ALIAS[name];
  let T = parseThemeTokens(css, name);
  if (!T) {
    warn('theme "' + name + '" not found in themes.css (available: ' + themeNames(css).join(', ') + '), falling back to paper');
    name = 'paper';
    T = parseThemeTokens(css, 'paper') || parseThemeTokens(FALLBACK_THEMES_CSS, 'paper');
  }
  const overrides = {};
  const num = (k, d) => (isFinite(parseFloat(T[k])) ? parseFloat(T[k]) : d);

  // tones
  const tones = {};
  TONES.forEach((t) => {
    if (!isHex(T[t + '-bg'])) return;
    const o = {};
    TONE_KEYS.forEach((k) => { o[k] = isHex(T[t + '-' + k]) ? T[t + '-' + k].trim().toUpperCase() : null; });
    o.ink = o.ink || bestOn(o.bg, []);
    o.muted = o.muted || mixHex(o.ink, o.bg, 0.4);
    o.accent = o.accent || o.ink;
    o.accent2 = o.accent2 || o.accent;
    o.surface = o.surface || mixHex(o.bg, o.ink, 0.06);
    o.rule = o.rule || mixHex(o.bg, o.ink, 0.2);
    o.fx = String(T[t + '-fx'] || '').split(/\s+/).filter(Boolean);
    tones[t] = o;
  });
  ['light', 'dark', 'accent'].forEach((t) => { if (!tones[t]) throw new Error('theme "' + name + '" does not define the ' + t + ' tone'); });
  if (meta.accent) {
    if (isHex(meta.accent)) {
      const A = meta.accent.trim().toUpperCase();
      overrides.accent = A;
      tones.light.accent = A; tones.dark.accent = A;
      const a = tones.accent;
      a.bg = A; a.ink = bestOn(A, [tones.light.ink, tones.light.bg]);
      a.muted = mixHex(a.ink, A, 0.22); a.accent = a.ink; a.accent2 = a.ink;
      a.surface = mixHex(A, a.ink, 0.1); a.rule = mixHex(A, a.ink, 0.45);
      a.fx = a.fx.filter((f) => /^(grain|dots|lines)/.test(f));
      if (tones.pop) tones.pop.accent = A;
    } else warn('meta.accent "' + meta.accent + '" is not a 6-digit hex colour, ignored');
  }
  Object.keys(tones).forEach((t) => {
    const o = tones[t];
    const grounds = [o.bg, o.surface];
    o.muted = textSafe(o.muted, grounds);
    o.accentT = textSafe(o.accent, grounds);          // accent as a text colour
    o.accent2T = textSafe(o.accent2, grounds);
    o.fill = mixHex(o.bg, o.ink, 0.2);                // quiet fill: the muted bars of a chart
    o.onAccent = bestOn(o.accent, [o.ink, o.bg]);     // type on an accent-filled shape
    o.onAccent2 = bestOn(o.accent2, [o.ink, o.bg]);
    o.c2 = contrast(o.accent2, o.accent) > 1.3 ? o.accent2 : o.ink;     // second colour for rings and slices
    o.onC2 = bestOn(o.c2, [o.ink, o.bg]);
    // series colours for charts with several series or slices: the tone's own colours first,
    // then greys between ink and ground, each at least 1.4:1 from every one before it and 1.3:1 from the ground
    o.series = [];
    const far = (c) => contrast(c, o.bg) >= 1.3 && o.series.every((x) => contrast(c, x) >= 1.4);
    [o.accent, o.ink, o.accent2, o.muted, o.fill, o.surface].concat([0.5, 0.7, 0.3, 0.85, 0.15, 0.6, 0.4].map((t) => mixHex(o.bg, o.ink, t))).forEach((c) => { if (o.series.length < 5 && far(c)) o.series.push(c); });
    while (o.series.length < 5) o.series.push(mixHex(o.bg, o.ink, 0.2 + 0.15 * o.series.length));
    o.dark = luminance(o.bg) < 0.3;
  });

  // type roles and the fonts to load
  const roles = {};
  ROLE_KEYS.forEach((k) => { roles[k] = T[k] || T.display || FALLBACK_ROLE; });
  if (!T.em) roles.em = roles.display;
  if (!T.num) roles.num = roles.display;
  const gfonts = T.gfonts ? T.gfonts.split('|') : [];
  const fontOverride = (key, family, into) => {
    if (!family) return;
    const fam = String(family).trim();
    overrides[key] = fam;
    into.forEach((r) => { if (r !== 'em' || parseRole(roles.em).family === parseRole(roles.display).family) roles[r] = swapFamily(roles[r], fam); });
    gfonts.push(fam + ':ital,wght@0,400;0,500;0,600;0,700;1,400');
  };
  fontOverride('font-display', meta.font_display, ['em', 'display', 'num']);
  fontOverride('font-body', meta.font_body, ['body']);
  const R = {};
  ROLE_KEYS.forEach((k) => { R[k] = parseRole(roles[k]); });
  R.bodyb = Object.assign({}, R.body, { css: R.body.css.replace(/font-weight\s*:\s*\d+/, 'font-weight:600'), weight: 600 });
  if (!/font-weight/.test(R.bodyb.css)) R.bodyb.css += ';font-weight:600';

  const base = TONES.includes(T['base-tone']) && tones[T['base-tone']] ? T['base-tone'] : 'light';
  const theme = {
    name, T, overrides, tones, roles: R, base,
    cover: tones[T['cover-tone']] ? T['cover-tone'] : (base === 'dark' ? 'dark' : 'accent'),
    bold: String(T['bold-tones'] || 'accent dark').split(/\s+/).filter((t) => tones[t] && t !== base),
    cell: ['hairline', 'rule', 'block', 'outline', 'card', 'soft'].includes(T.cell) ? T.cell : 'soft',
    radius: num('radius', 0), decor: T.decor || 'none', marg: T.marg || 'slash',
    emMode: ['serif', 'mark', 'color'].includes(T['em-mode']) ? T['em-mode'] : 'color',
    emScale: num('em-scale', 1), titleSize: num('title-size', 64), titleLh: num('title-lh', 1.05),
    bigSize: num('big-size', 150), bigLh: num('big-lh', 0.95), numLh: num('num-lh', 0.86), monoSize: num('mono-size', 17),
    gfonts,
  };
  if (!theme.bold.length) theme.bold = ['accent', 'dark', 'light'].filter((t) => t !== base).slice(0, 2);
  // The contrast tone: where a calm slide goes when four in a row would share a tone.
  theme.alt = theme.bold.find((t) => t !== 'accent') || theme.bold[0];
  // Legacy token view (base tone) for the native PPTX renderer and custom_html slides.
  const b = tones[base];
  theme.tokens = {
    bg: b.bg, ink: b.ink, muted: b.muted, accent: b.accentT, 'accent-2': b.accent2T, surface: b.surface, rule: b.rule,
    'chart-1': b.accentT, 'chart-2': b.accent2T, 'chart-3': b.muted, 'chart-4': b.fill, 'chart-5': mixHex(b.bg, b.ink, 0.5),
    'font-display': R.display.family, 'font-body': R.body.family, webDisplay: R.display.family, webBody: R.body.family,
    'display-weight': String(R.display.weight), 'display-tracking': R.display.tracking + 'em',
    'pptx-display': T['pptx-display'] || 'Arial', 'pptx-body': T['pptx-body'] || 'Arial', gfontsList: gfonts,
  };
  return theme;
}
const FALLBACK_ROLE = "font-family:'Helvetica Neue',Arial,sans-serif;font-weight:400";

// Tones a filled cell can take on a slide of tone `t`, most prominent first: the accent
// block, the second colour when the theme has one, then the opposite neutral.
function fillTones(theme, t) {
  const order = ['accent', 'pop', 'dark', 'light'].filter((x) => theme.tones[x] && x !== t);
  if (t === 'accent' || t === 'pop') return order.filter((x) => x !== 'accent' || t === 'pop').sort((a, b) => (a === 'dark' ? -1 : b === 'dark' ? 1 : 0));
  return order;
}

// How the emphasised phrase is drawn in a tone: the theme's mode, or the highlighter
// block where the accent is the ink colour and could not be seen.
function emMode(theme, tone) {
  const o = theme.tones[tone] || theme.tones[theme.base];
  return theme.emMode !== 'mark' && contrast(o.accentT, o.ink) < 1.25 ? 'mark' : theme.emMode;
}

// ---- tone rhythm ---------------------------------------------------------------------
// Every slide gets a tone. An explicit `tone` wins; otherwise cover and closing take the
// cover tone, section and statement slides alternate through the bold tones, quote and
// data slides are calm, and a fourth slide in a row never shares the tone of the three
// before it (the slide in the run that carries an inversion best is flipped).
const FLIP_ORDER = ['quote', 'insight', 'ask', 'team', 'market', 'case_study', 'two_column', 'problem', 'solution', 'go_to_market', 'business_model', 'roadmap', 'competition', 'product', 'financials', 'traction', 'appendix', 'custom_html', 'sources'];
function assignTones(slides, theme) {
  let b = 0;
  slides.forEach((s, i) => {
    const want = String(s.tone || '').toLowerCase();
    s.toneGiven = TONES.includes(want) && !!theme.tones[want];
    if (s.tone && !s.toneGiven) warn('slide ' + (i + 1) + ': tone "' + s.tone + '" is not light, dark or accent; assigned automatically');
    if (s.toneGiven) { s.tone = want; return; }
    if (s.type === 'cover') s.tone = theme.cover;
    else if (s.type === 'closing') s.tone = theme.cover;
    else if (s.type === 'section' || s.type === 'statement') { s.tone = theme.bold[b % theme.bold.length]; b += 1; }
    else s.tone = theme.base;
  });
  // closing differs from the slide before it
  slides.forEach((s, i) => {
    if (s.type === 'closing' && !s.toneGiven && i > 0 && slides[i - 1].tone === s.tone) s.tone = theme.bold.find((t) => t !== s.tone) || theme.alt;
    if ((s.type === 'section' || s.type === 'statement') && !s.toneGiven && i > 0 && slides[i - 1].tone === s.tone) s.tone = theme.bold.find((t) => t !== s.tone) || s.tone;
  });
  for (let i = 3; i < slides.length; i++) {
    const t = slides[i].tone;
    if (slides[i - 1].tone !== t || slides[i - 2].tone !== t || slides[i - 3].tone !== t) continue;
    const cands = [i, i - 1].filter((k) => !slides[k].toneGiven);
    if (!cands.length) continue;
    const rank = (k) => { const r = FLIP_ORDER.indexOf(slides[k].type); return r < 0 ? 99 : r; };
    const pick = cands.sort((x, y) => rank(x) - rank(y) || y - x)[0];
    slides[pick].tone = t === theme.alt ? (theme.bold.find((x) => x !== t) || theme.base) : theme.alt;
    slides[pick].toneFlipped = true;
  }
  const runs = [];
  for (let i = 3; i < slides.length; i++) {
    if ([1, 2, 3].every((k) => slides[i - k].tone === slides[i].tone)) runs.push(i + 1);
  }
  return runs;      // slide numbers that still end a run of four (explicit tones)
}

// ---- generated stylesheet parts ------------------------------------------------------
function toneVars(o) {
  return '--bg:' + o.bg + ';--ink:' + o.ink + ';--muted:' + o.muted + ';--accent:' + o.accent + ';--accent-t:' + o.accentT +
    ';--accent-2:' + o.accent2 + ';--accent-2t:' + o.accent2T + ';--surface:' + o.surface + ';--rule:' + o.rule + ';--fill:' + o.fill +
    o.series.map((c, k) => ';--s' + (k + 1) + ':' + c).join('') + ';--c2:' + o.c2 + ';--on-c2:' + o.onC2 + ';--on-accent:' + o.onAccent + ';--on-accent2:' + o.onAccent2 + ';--hair:' + rgbaOf(o.ink, o.dark ? 0.2 : 0.16) +
    ';--chart-1:' + o.accent + ';--chart-2:' + o.accent2 + ';--chart-3:' + o.muted + ';--chart-4:' + o.fill + ';--chart-5:' + o.ink + ';';
}
// Background treatment of a slide in tone o: gradients and patterns only (they stay
// vector in the PDF). Grain is a separate layer with a small PNG tile.
function toneBackground(o) {
  const layers = [];
  let grain = 0;
  o.fx.forEach((f) => {
    const [k, v] = f.split(':');
    if (k === 'grain') grain = parseFloat(v) || 0.2;
    else if (k === 'dots') layers.unshift('radial-gradient(circle,' + rgbaOf(o.ink, o.dark || luminance(o.bg) < 0.3 ? 0.22 : 0.2) + ' 1.5px,transparent 1.7px) 20px 20px/40px 40px');
    else if (k === 'lines') layers.unshift('linear-gradient(' + rgbaOf(o.ink, 0.055) + ' 1px,transparent 1px) 0 0/60px 60px', 'linear-gradient(90deg,' + rgbaOf(o.ink, 0.055) + ' 1px,transparent 1px) 0 0/60px 60px');
    else if (k === 'vignette' && isHex(v)) layers.push('radial-gradient(1500px 950px at 24% 18%,' + v + ' 0,' + o.bg + ' 62%,' + mixHex(o.bg, '#000000', 0.35) + ' 100%)');
    else if ((k === 'glow' || k === 'mesh') && isHex(v)) {
      layers.push('radial-gradient(' + (k === 'glow' ? '900px 700px at 80% 22%,' : '1100px 800px at 86% 8%,') + rgbaOf(v, k === 'glow' ? 0.5 : 0.6) + ',transparent 70%)',
        'radial-gradient(760px 620px at 6% 110%,' + rgbaOf(mixHex(o.bg, '#000000', 0.45), 0.75) + ',transparent 70%)');
    }
  });
  layers.push(o.bg);
  return { css: layers.join(','), grain };
}

// 192px tile of fine two-tone noise as a PNG data URI (seeded, so builds are repeatable).
// A full-slide SVG turbulence filter would be rasterised by Chrome at print size; a small
// repeating tile keeps the PDF small.
let GRAIN_URI = null;
function grainDataUri() {
  if (GRAIN_URI) return GRAIN_URI;
  const zlib = require('zlib');
  const N = 192;
  let seed = 7;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const raw = Buffer.alloc(N * (1 + N * 2));
  for (let y = 0; y < N; y++) {
    raw[y * (1 + N * 2)] = 0;
    for (let x = 0; x < N; x++) {
      const p = y * (1 + N * 2) + 1 + x * 2;
      raw[p] = rnd() < 0.5 ? 0 : 255;                       // black or white speck
      raw[p + 1] = Math.round(Math.pow(rnd(), 1.6) * 120);  // mostly faint
    }
  }
  const crcTable = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 4;   // 8-bit grey + alpha
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  GRAIN_URI = 'data:image/png;base64,' + png.toString('base64');
  return GRAIN_URI;
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
  const sups = notes.map((n) => '<sup class="fn">[' + n + ']</sup>').join('');
  return {
    texts, notes,
    html: texts.map(esc).join(', ') + (notes.length ? (texts.length ? ' ' : '') + sups : '') + tail,
    text: texts.join(', ') + (notes.length ? (texts.length ? ' ' : '') + '[' + notes.join(', ') + ']' : '') + tail,
    sups: sups + tail,
  };
}
let CAPTION_MAX = 3;      // lowered while a caption is fitted to a narrow line
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

// --------------------------------------------------------------------------------------
// 4a. Measured layout: the renderer and the capacity lint are one pass
// --------------------------------------------------------------------------------------
// Every slide is drawn from boxes of known size. Each piece of text is wrapped here, in
// the deck's own faces, before any HTML is written: headlines step down a size ladder
// until they fit, and whatever still does not fit is reported with the slide number.
// The lint is therefore a dry run of the renderer and covers every layout by construction.

const METRICS_PATH = path.join(__dirname, '..', 'assets', 'deck-template', 'font-metrics.json');
let METRICS = null;
function loadMetrics() {
  if (METRICS) return METRICS;
  try { METRICS = JSON.parse(fs.readFileSync(METRICS_PATH, 'utf8')); } catch (e) { METRICS = {}; }
  return METRICS;
}
const metricCache = {};
function roleWidths(role) {
  const key = role.css;
  if (!(key in metricCache)) {
    const enc = loadMetrics()[key];
    if (enc) { const a = []; for (let i = 0; i < enc.length; i += 2) a.push(parseInt(enc.slice(i, i + 2), 36)); metricCache[key] = a; } else metricCache[key] = null;
  }
  return metricCache[key];
}
// Width in px of a string in a type role at sizePx. Roles of the shipped themes are
// measured glyph by glyph (font-metrics.json); other faces fall back to the family tables.
function tw(text, role, sizePx) {
  let str = String(text == null ? '' : text);
  if (role.upper) str = str.toUpperCase();
  const ws = roleWidths(role);
  if (!ws) return textPx(str, { family: role.family, weight: role.weight, tracking: role.tracking }, sizePx) * (role.upper ? 1.02 : 1);
  let em = 0;
  for (const ch of str) { const i = GLYPH_SET.indexOf(ch); em += i >= 0 ? ws[i] / 1000 : 0.62; }
  return (em + str.length * role.tracking) * sizePx;
}

// "A title with *one emphasised phrase*" as runs. A lone asterisk stays a character.
function parseRuns(text) {
  const str = String(text == null ? '' : text);
  const runs = [];
  const re = /\*([^*\n]+)\*/g;
  let last = 0, m;
  while ((m = re.exec(str))) {
    if (m.index > last) runs.push({ t: str.slice(last, m.index), em: false });
    runs.push({ t: m[1], em: true });
    last = m.index + m[0].length;
  }
  if (last < str.length) runs.push({ t: str.slice(last), em: false });
  return runs.length ? runs : [{ t: '', em: false }];
}
const stripEm = (text) => parseRuns(text).map((r) => r.t).join('');
const SLOT_PX = 0.4;      // a "[needs number]" slot is this much wider (in em) than its words

// Lines and widest line of a text wrapped at widthPx: greedy breaks at spaces and after
// hyphens, which is also the line count of a balanced wrap.
function wrapText(text, role, sizePx, widthPx, em) {
  const T = LX.theme;
  const keepHyph = role === T.roles.display || role === T.roles.em;      // display type keeps compounds whole
  const runs = em ? parseRuns(text) : [{ t: String(text == null ? '' : text), em: false }];
  const words = [];
  runs.forEach((r) => {
    const ro = r.em && T.emMode === 'serif' ? T.roles.em : role;
    const sz = r.em && T.emMode === 'serif' ? sizePx * T.emScale : sizePx;
    const padEm = r.em && emMode(T, LX.tone) === 'mark' ? 0.12 * sizePx : 0;
    const parts = r.t.split(/(\s+)/);
    parts.forEach((p, k) => {
      if (!p) return;
      if (/^\s+$/.test(p)) { words.push({ sp: true, w: tw(' ', ro, sz) }); return; }
      const whole = !LX.brk && keepHyph && /[A-Za-z0-9]-[A-Za-z0-9]/.test(p) && tw(p, ro, sz) <= widthPx;
      (whole ? [p] : p.split(LX.brk ? /(?<=[-_/:.#])/ : /(?<=-)/)).forEach((frag, j) => {
        let w = tw(frag.replace(/\[needs (?:number|detail)\]/ig, 'needs number'), ro, sz);
        if (hasPlaceholder(frag)) w += SLOT_PX * sizePx;
        // highlighter padding: at both ends of the phrase and again wherever it breaks across lines,
        // so every emphasised word is counted with one
        if (padEm) w += padEm;
        if (padEm && k === 0 && j === 0) w += padEm;
        words.push({ w, glue: j > 0 });
      });
    });
  });
  let lines = 1, x = 0, widest = 0, pendingSp = 0, over = false;
  words.forEach((wd) => {
    if (wd.sp) { pendingSp = wd.w; return; }
    if (wd.w > widthPx && !wd.glue) over = true;      // one word wider than the line: it cannot wrap
    const lead = x > 0 && !wd.glue ? pendingSp : 0;
    if (x > 0 && x + lead + wd.w > widthPx) { lines += 1; widest = Math.max(widest, x); x = wd.w; } else x += lead + wd.w;
    pendingSp = 0;
  });
  return { lines, widest: Math.max(widest, x), over };
}

// ---- the layout context --------------------------------------------------------------
// LX is set per slide while it renders: theme, variant, tone, slide number, and the list
// that collects what does not fit.
let LX = { theme: null, variant: 'present', tone: 'light', no: 0, type: '', issues: [], slack: [], quiet: false };
const sv = (present, read) => (LX.variant === 'read' && read !== undefined ? read : present);
function issue(msg) { if (!LX.quiet) LX.issues.push('slide ' + LX.no + ' (' + LX.type + '): ' + msg); LX.count = (LX.count || 0) + 1; }

// Smallest sizes drawn, in px on the 1920 stage: running text and marginalia.
const FLOOR = { body: { present: 24, read: 22 }, small: 16 };
const floorBody = () => FLOOR.body[LX.variant] || 24;

const SLACK_MIN = 0.55;       // a list, table or diagram cell filled less than this is reported as slack
const WRAP_SAFETY = 0.985;    // measured glyph sums against real shaping: kerning and rounding

// One block of text: {h, html, size, lines}. o: role, size or sizes (largest first), lh,
// w (wrap width), max (lines), cls, what (name used in a warning), em (parse *phrase*),
// nowrap, style, tag.
function tb(text, o) {
  const T = LX.theme;
  const roleName = o.role || 'body';
  const role = T.roles[roleName];
  const sizes = o.sizes || [o.size];
  const lh = o.lh || (roleName === 'body' || roleName === 'bodyb' ? 1.36 : roleName === 'mono' ? 1.3 : T.titleLh);
  const max = o.nowrap ? 1 : (o.max || 99);
  // a highlighter block that breaks across lines keeps its padding at the break, which the
  // browser's line breaker does not count: the block reserves that much at its right edge
  const markPad = o.em && emMode(T, LX.tone) === 'mark' && /\*[^*\n]+\*/.test(String(text || ''));
  let size = sizes[sizes.length - 1], m = null, fits = false;
  for (const sz of sizes) {
    m = wrapText(text, role, sz, o.w * WRAP_SAFETY - 1 - (markPad ? 0.13 * sz : 0), o.em);
    if (m.lines <= max && !m.over && (!o.maxH || m.lines * sz * lh <= o.maxH)) { size = sz; fits = true; break; }
  }
  if (!fits && o.what && m.over && m.lines <= max) issue(o.what + ' has a word that is wider than its line' + (sizes.length > 1 ? ' at the smallest size' : '') + '. Shorten or hyphenate it.');
  else if (!fits && o.what) {
    const len = stripEm(text).length;
    const cap = o.maxH ? Math.max(1, Math.min(max, Math.floor(o.maxH / (size * lh)))) : max;
    const about = Math.max(4, Math.floor((len * cap / m.lines) * 0.94 / 2) * 2);
    issue(o.what + ' is too long: ' + len + ' characters take ' + m.lines + ' line' + (m.lines === 1 ? '' : 's') + (sizes.length > 1 ? ' at the smallest size' : '') +
      ', ' + cap + ' fit' + (cap === 1 ? 's' : '') + '. Shorten it to about ' + about + ' characters.');
  }
  const lines = m.lines;
  const cls = 't f-' + roleName + (o.cls ? ' ' + o.cls : '');
  const st = 'font-size:' + size + 'px;line-height:' + lh + (o.nowrap ? ';white-space:nowrap' : (max > 1 && /\blbl\b/.test(o.cls || '') ? ';white-space:normal' : '')) + (o.mw ? ';max-width:' + Math.round(o.w) + 'px' : '') + (markPad ? ';padding-right:.13em' : '') + (o.style ? ';' + o.style : '');
  const tag = o.tag || 'div';
  return { h: lines * size * lh, size, lines, widest: m.widest, fits,
    html: '<' + tag + ' class="' + cls + '" style="' + st + '">' + (roleName === 'display' && !LX.brk ? keepCompounds(o.em ? emHtml(text) : txt(text), (wd) => tw(wd, role, size) <= o.w * WRAP_SAFETY - 1) : o.em ? emHtml(text) : (LX.brk ? txt(text).replace(/([_/:.#])(?=[^\s<])/g, '$1<wbr>') : txt(text))) + '</' + tag + '>' };
}
// Inline HTML of a text with its emphasised phrase.
function emHtml(text) {
  return parseRuns(text).map((r) => (r.em ? '<em class="em" data-ground="--em-bg">' + txt(r.t) + '</em>' : txt(r.t))).join('');
}
// Wrap hyphenated compounds of a headline in a no-break span (those that fit on a line).
function keepCompounds(html, fits) {
  return html.replace(/(^|[\s>])([A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)(?=[\s<.,;:!?]|$)/g, (m, pre, wd) => (fits(wd) ? pre + '<span class="nb">' + wd + '</span>' : m));
}
// Mono label (running head, eyebrow, caption). One line unless max is given.
function label(text, w, o) {
  o = o || {};
  const T = LX.theme;
  return tb(text, Object.assign({ role: 'mono', size: T.monoSize + (/\beb\b/.test(o.cls || '') ? 3 : 0), lh: 1.3, w, max: o.max || 1, cls: 'lbl' + (o.cls ? ' ' + o.cls : ''), what: o.what || 'a label', style: (o.max || 1) > 1 ? 'white-space:normal' : '' }, o.size ? { size: o.size } : {}));
}
const gapBlock = (h) => ({ h, html: '<div style="height:' + h + 'px;flex:none"></div>' });
const rawBlock = (h, html) => ({ h, html });
// Stack blocks with a gap: {h, html}.
function vs(blocks, gap, cls) {
  const list = blocks.filter(Boolean);
  const h = list.reduce((a, b) => a + b.h, 0) + Math.max(0, list.length - 1) * (gap || 0);
  return { h, html: '<div class="vs' + (cls ? ' ' + cls : '') + '" style="gap:' + (gap || 0) + 'px">' + list.map((b) => b.html).join('') + '</div>' };
}

// ---- stage geometry ------------------------------------------------------------------
// The content frame and its 12 x 8 grid. Gaps, padding and how a cell is drawn come from
// the theme's cell style.
const FRAME = { x: 72, y: 96, w: 1776, h: 900 };
const CELL_STYLE = {
  hairline: { gap: 0, pad: 34, plainPad: 34 },
  rule: { gap: 0, pad: 34, plainPad: 34 },
  block: { gap: 12, pad: 34, plainPad: 0 },
  outline: { gap: 16, pad: 32, plainPad: 0 },
  card: { gap: 22, pad: 34, plainPad: 0 },
  soft: { gap: 16, pad: 34, plainPad: 0 },
};
const cs = () => CELL_STYLE[LX.theme.cell];
// Rectangle of grid columns c0..c0+cn and rows r0..r0+rn (zero-based) inside `f`.
function grid(c0, r0, cn, rn, f) {
  f = f || FRAME;
  const g = cs().gap;
  const cw = (f.w - 11 * g) / 12, rh = (f.h - 7 * g) / 8;
  return { x: f.x + c0 * (cw + g), y: f.y + r0 * (rh + g), w: cn * cw + (cn - 1) * g, h: rn * rh + (rn - 1) * g };
}
// Split a rectangle into n columns or rows with the theme gap; weights are relative sizes.
function splitRect(r, n, dir, weights) {
  const g = cs().gap;
  const wts = weights || Array(n).fill(1);
  const total = wts.reduce((a, b) => a + b, 0);
  const span = (dir === 'row' ? r.h : r.w) - (n - 1) * g;
  const out = [];
  let pos = dir === 'row' ? r.y : r.x;
  wts.forEach((wt) => {
    const len = span * wt / total;
    out.push(dir === 'row' ? { x: r.x, y: pos, w: r.w, h: len } : { x: pos, y: r.y, w: len, h: r.h });
    pos += len + g;
  });
  return out;
}

// One cell. o.tone fills it with another tone (a nested tone scope); o.kind "plain" is
// an unframed text area, "bleed" a full-height panel. build(w, h) returns {top, bottom,
// mid}: lists of blocks pinned to the top, the bottom, or centred. What does not fit in
// the cell height is reported.
function cell(r, o, build) {
  o = o || {};
  const st = cs();
  const hair = LX.theme.cell === 'hairline' || LX.theme.cell === 'rule';
  const plain = o.kind === 'plain';
  const pad = o.pad !== undefined ? o.pad : (plain ? st.plainPad : st.pad);
  const padX = o.padX !== undefined ? o.padX : pad;
  const iw = r.w - 2 * padX, ih = r.h - 2 * pad;
  const prevTone = LX.tone;
  if (o.tone) LX.tone = o.tone;
  const parts = build(iw, ih) || {};
  LX.tone = prevTone;
  const gap = o.gap !== undefined ? o.gap : 18;
  const group = (list) => { const l = (list || []).filter(Boolean); return { l, h: l.reduce((a, b) => a + b.h, 0) + Math.max(0, l.length - 1) * gap }; };
  const top = group(parts.top), mid = group(parts.mid), bottom = group(parts.bottom);
  const used = top.h + mid.h + bottom.h + ((top.l.length ? 1 : 0) + (mid.l.length ? 1 : 0) + (bottom.l.length ? 1 : 0) - 1) * Math.max(gap, o.minGap || 0);
  if (used > ih * 1.012 + 1) {
    const pct = Math.round((used / ih - 1) * 100);
    issue((o.what || 'a cell') + ' is overfull by about ' + Math.max(1, pct) + ' percent' + (o.fix ? '. ' + o.fix : '. Shorten the text or cut an item.'));
  }
  if (o.slack && !LX.quiet) {
    const filled = top.l.concat(mid.l, bottom.l).reduce((a, b) => a + (b.fill !== undefined ? b.fill : b.h), 0) + Math.max(0, top.l.length + mid.l.length + bottom.l.length - 1) * gap;
    if (filled < ih * SLACK_MIN) LX.slack.push('slide ' + LX.no + ' (' + LX.type + '): ' + (o.what || 'a cell') + ' is only ' + Math.round(filled * 100 / ih) + ' percent filled. The slide will look empty: add a point, a stat, a diagram or an image, or say more.');
  }
  const wrap = (g, cls) => (g.l.length ? '<div class="cg ' + cls + '" style="gap:' + gap + 'px">' + g.l.map((b) => b.html).join('') + '</div>' : '');
  const cls = 'cell' + (plain ? ' plain' : o.kind === 'bleed' ? ' bleed' : '') + (o.tone ? ' filled' : '') + (o.cls ? ' ' + o.cls : '');
  // hairline cells overlap by one pixel so neighbours share a border
  const grow = hair && !plain && o.kind !== 'bleed' ? 1 : 0;
  const style = 'left:' + r.x.toFixed(1) + 'px;top:' + r.y.toFixed(1) + 'px;width:' + (r.w + grow).toFixed(1) + 'px;height:' + (r.h + grow).toFixed(1) + 'px;padding:' + pad + 'px ' + padX + 'px' + (o.style ? ';' + o.style : '');
  return '<div class="' + cls + '"' + (o.tone ? ' data-tone="' + o.tone + '"' : '') + ' style="' + style + '">' + (parts.under || '') + wrap(top, 'cg-top') + wrap(mid, 'cg-mid') + wrap(bottom, 'cg-bottom') + (parts.over || '') + '</div>';
}

// ---- icons ---------------------------------------------------------------------------
// A subset of Lucide (ISC), assets/deck-template/icons.json. Unknown names fall back to
// a plain mark and are listed in the build log.
let ICONS = null;
function icon(name, size, cls) {
  if (!ICONS) { try { ICONS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'deck-template', 'icons.json'), 'utf8')); } catch (e) { ICONS = {}; } }
  const key = String(name || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
  let inner = key && key !== '_meta' ? ICONS[key] : null;
  if (!inner) {
    if (key && LX.unknownIcons && !LX.unknownIcons.includes(key)) LX.unknownIcons.push(key);
    inner = '<rect x="5" y="5" width="14" height="14" rx="1" fill="currentColor" stroke="none"/>';
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="' + Math.round(size * 0.5) + '" height="' + Math.round(size * 0.5) + '" aria-hidden="true">' + inner + '</svg>';
  }
  return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" aria-hidden="true">' + inner + '</svg>';
}
const iconNames = () => { icon('zap', 1); return Object.keys(ICONS).filter((k) => k !== '_meta'); };

// ---- hero numerals -------------------------------------------------------------------
// "138%" becomes a numeral with a raised unit; "492k EUR" a numeral with a small unit.
function splitValue(v) {
  const str = String(v == null ? '' : v).trim();
  const m = str.match(/^([^\d\s]{0,3}\s?[\d][\d.,]*(?:\s?(?:[kKMB]|bn|m)(?![A-Za-z]))?)\s*([%x×]|pp|[^\d]{1,12})?$/);
  if (!m || !m[2]) return { main: str, unit: '' };
  return { main: m[1].trim(), unit: m[2].trim() };
}
// A numeral that fills width w on one line: {h, html, size}. sizes: largest first.
function numBlock(value, w, sizes, o) {
  o = o || {};
  const T = LX.theme;
  if (isPlaceholder(value)) {
    let size = Math.min(sizes[0], 60);
    while (size > 30 && tw('needs number', T.roles.bodyb, size * 0.72) + size * 0.8 > w) size -= 4;
    return { h: size * 1.1, size, html: '<div class="num f-num" style="font-size:' + size + 'px;line-height:1.1">' + txt(value) + '</div>' };
  }
  const { main, unit } = splitValue(value);
  const digit = Math.max(...'0123456789'.split('').map((d) => tw(d, T.roles.num, 100))) / 100;
  // tabular figures: every digit is as wide as the widest one
  const mainW = (sz) => tw(main.replace(/\d/g, ''), T.roles.num, sz) + (main.match(/\d/g) || []).length * (digit + T.roles.num.tracking) * sz;
  const unitW = (sz) => (unit ? tw(unit, T.roles.num, sz * 0.36) + sz * 0.05 : 0);
  let size = sizes[sizes.length - 1], fits = false;
  for (const sz of sizes) { if ((mainW(sz) + unitW(sz)) * 1.03 <= w) { size = sz; fits = true; break; } }
  if (!fits) issue((o.what || 'a stat value') + ' "' + String(value) + '" is too long for its cell. Keep the figure and move the unit into the label (about ' + Math.max(3, Math.floor(String(value).length * w / ((mainW(size) + unitW(size)) * 1.03))) + ' characters fit).');
  const lh = T.numLh;
  return { h: size * lh, size,
    html: '<div class="num f-num' + (o.cls ? ' ' + o.cls : '') + '" style="font-size:' + size + 'px;line-height:' + lh + '">' + esc(main) + (unit ? '<sup>' + esc(unit) + '</sup>' : '') + '</div>' };
}
const ladder = (max, min, step) => { const a = []; for (let s = max; s >= min; s -= (step || Math.max(4, Math.round(max * 0.08)))) a.push(Math.round(s)); if (a[a.length - 1] !== min) a.push(min); return a; };
// --------------------------------------------------------------------------------------
// 4b. Charts: inline SVG at the exact pixel size of their cell
// --------------------------------------------------------------------------------------
// One accent series, the others muted; the latest bar or point is the highlight; lines
// are labelled at their end instead of in a legend; the y axis always starts at zero;
// whole-number data gets whole-number ticks. Colours are CSS variables of the tone.

const SERIES_FILL = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];
const CHART_LIMITS = { labels: 12, hbarRows: 8, series: 5, annotation: 44 };
const AX = 19;       // axis label size, px
const VL = 24;       // value label size, px
let chartSeq = 0;
const f1 = (n) => Number(n.toFixed(1));

function chartMax(chart) {
  let max = 0;
  if (chart.kind === 'stacked_bar') chart.labels.forEach((_, i) => { max = Math.max(max, chart.series.reduce((a, se) => a + (se.values[i] || 0), 0)); });
  else chart.series.forEach((se) => se.values.forEach((v) => { if (v != null) max = Math.max(max, v); }));
  return max;
}
const isPlan = (name) => /projection|projected|forecast|plan\b|target/i.test(String(name || ''));

// Returns {svg, issues[]}. W and H are final pixels: nothing is scaled afterwards.
function endLabelWidth(chart) {
  const body = LX.theme.roles.bodyb;
  const series = chart.series.slice(0, CHART_LIMITS.series);
  return Math.max(0, ...series.map((se) => { let k = se.values.length - 1; while (k >= 0 && se.values[k] == null) k--; return Math.max(se.name && series.length > 1 ? tw(se.name, body, 22) : 0, tw(k >= 0 ? fmtNum(se.values[k]) : '', body, VL)); })) + 22;
}
function svgChart(chart, W, H, direct) {
  const T = LX.theme;
  const mono = T.roles.mono, body = T.roles.bodyb;
  const n = chart.labels.length;
  const series = chart.series.slice(0, CHART_LIMITS.series);
  if (chart.series.length > CHART_LIMITS.series) issue('the chart has ' + chart.series.length + ' series; ' + CHART_LIMITS.series + ' are drawn. Merge the smallest into "Other".');
  if (chart.kind !== 'horizontal_bar' && n > CHART_LIMITS.labels) issue('the chart has ' + n + ' x labels; ' + CHART_LIMITS.labels + ' fit. Aggregate (months into quarters) or show the latest ' + CHART_LIMITS.labels + '.');
  const allInt = series.every((se) => se.values.every((v) => v == null || Number.isInteger(v)));
  const out = [];
  const id = 'c' + (++chartSeq);

  if (chart.kind === 'horizontal_bar') {
    const rows = Math.min(n, CHART_LIMITS.hbarRows);
    if (n > CHART_LIMITS.hbarRows) issue('the bar chart has ' + n + ' rows; ' + CHART_LIMITS.hbarRows + ' fit. Keep the top ' + CHART_LIMITS.hbarRows + '.');
    const vals = series[0].values;
    const max = Math.max(1e-9, ...vals.slice(0, rows).map((v) => v || 0));
    const lw = Math.min(W * 0.42, Math.max(...chart.labels.slice(0, rows).map((l) => tw(l, T.roles.body, 24))) + 20);
    if (Math.max(...chart.labels.slice(0, rows).map((l) => tw(l, T.roles.body, 24))) + 20 > W * 0.42) issue('a bar label is too long for the chart. Keep bar labels under about ' + Math.floor(W * 0.42 / (24 * 0.5)) + ' characters.');
    const vw = Math.max(...vals.slice(0, rows).map((v) => tw(fmtNum(v || 0), body, VL))) + 14;
    const rh = Math.min(84, H / rows), bh = Math.min(44, rh * 0.56);
    const hi = chart.highlight === 'none' ? -1 : (Number.isInteger(chart.highlight) ? chart.highlight : 0);
    for (let i = 0; i < rows; i++) {
      const y = i * rh + (rh - bh) / 2;
      const bw = Math.max(2, (W - lw - vw) * (vals[i] || 0) / max);
      out.push('<text class="hl" x="0" y="' + f1(y + bh / 2 + 8) + '">' + esc(chart.labels[i]) + '</text>');
      out.push('<rect x="' + f1(lw) + '" y="' + f1(y) + '" width="' + f1(bw) + '" height="' + f1(bh) + '" fill="' + (i === hi ? 'var(--accent)' : 'var(--fill)') + '"/>');
      out.push('<text class="vl' + (i === hi ? ' hi' : '') + '" x="' + f1(lw + bw + 12) + '" y="' + f1(y + bh / 2 + 8) + '">' + esc(fmtNum(vals[i] || 0)) + '</text>');
    }
    return '<svg class="chart" width="' + Math.round(W) + '" height="' + Math.round(rows * rh) + '" viewBox="0 0 ' + Math.round(W) + ' ' + Math.round(rows * rh) + '" role="img" aria-label="Bar chart">' + out.join('') + '</svg>';
  }

  const ticks = niceTicks(chartMax(chart), allInt);
  const top = ticks[ticks.length - 1];
  const tickW = Math.max(...ticks.map((t) => tw(fmtNum(t), mono, AX)));
  const isLine = chart.kind === 'line' || chart.kind === 'area';
  // direct labels at the end of each line: name and latest value
  const ends = isLine ? series.map((se) => { let k = se.values.length - 1; while (k >= 0 && se.values[k] == null) k--; return { k, name: se.name, val: k >= 0 ? fmtNum(se.values[k]) : '' }; }) : [];
  // names too long to sit at the line ends go to the legend; the latest values stay at the ends
  if (isLine && !direct) ends.forEach((e) => { e.name = ''; });
  const endW = isLine ? Math.max(0, ...ends.map((e) => Math.max(e.name && series.length > 1 ? tw(e.name, body, 22) : 0, tw(e.val, body, VL)))) + 22 : 0;
  const L = tickW + 16, R = isLine ? Math.max(16, endW) : 6, TOP = 44, B = 48;
  const pw = W - L - R, ph = H - TOP - B;
  const y = (v) => TOP + ph - (ph * v) / top;
  // gridlines: faint, horizontal only; the baseline is the one solid line
  ticks.forEach((t, k) => {
    if (k > 0) out.push('<line x1="' + f1(L) + '" x2="' + f1(L + pw) + '" y1="' + f1(y(t)) + '" y2="' + f1(y(t)) + '" class="grid"/>');
    out.push('<text class="ax" text-anchor="end" x="' + f1(L - 12) + '" y="' + f1(y(t) + 6) + '">' + esc(fmtNum(t)) + '</text>');
  });
  const slot = pw / Math.max(1, n);
  const cx = (i) => (isLine ? L + (n === 1 ? pw / 2 : (pw * i) / (n - 1)) : L + slot * (i + 0.5));
  // x labels must not collide with their neighbours
  const lws = chart.labels.map((l) => tw(l, mono, AX));
  const step = isLine && n > 1 ? pw / (n - 1) : slot;
  if (lws.some((w, i) => i > 0 && (w + lws[i - 1]) / 2 + 10 > step)) {
    issue('the chart\'s x labels run into each other. Shorten them to about ' + Math.max(2, Math.floor((step - 10) / (AX * 0.68))) + ' characters ("Q1 25", "Jan") or use fewer points.');
  }
  // the highlight: the latest value of the first series, unless chart.highlight says otherwise
  let hi = -1;
  if (chart.highlight !== 'none') {
    if (Number.isInteger(chart.highlight)) hi = chart.highlight;
    else if (typeof chart.highlight === 'string' && chart.labels.indexOf(chart.highlight) >= 0) hi = chart.labels.indexOf(chart.highlight);
    else { hi = series[0].values.length - 1; while (hi >= 0 && series[0].values[hi] == null) hi--; }
  }
  chart.labels.forEach((l, i) => {
    const anchor = isLine && i === 0 ? 'start' : (isLine && i === n - 1 ? 'end' : 'middle');
    out.push('<text class="ax' + (i === hi && series.length === 1 && !isLine ? ' hi' : '') + '" text-anchor="' + anchor + '" x="' + f1(cx(i)) + '" y="' + f1(TOP + ph + 34) + '">' + esc(l) + '</text>');
  });

  if (chart.kind === 'bar') {
    const group = Math.min(slot * 0.8, 150 * series.length);
    const bw = group / series.length;
    series.forEach((se, si) => se.values.forEach((v, i) => {
      if (v == null) return;
      const single = series.length === 1;
      const fill = single ? (i === hi ? 'var(--accent)' : 'var(--fill)') : SERIES_FILL[si];
      const x = L + slot * i + (slot - group) / 2 + bw * si;
      out.push('<rect x="' + f1(x + (single ? 0 : 1)) + '" y="' + f1(y(v)) + '" width="' + f1(bw - (single ? 0 : 2)) + '" height="' + f1(Math.max(0, TOP + ph - y(v))) + '" fill="' + fill + '"/>');
      if (chart.show_values || (single && i === hi)) out.push('<text class="vl' + (single && i === hi ? ' hi' : '') + '" text-anchor="middle" x="' + f1(x + bw / 2) + '" y="' + f1(y(v) - 10) + '">' + esc(fmtNum(v)) + '</text>');
    }));
  } else if (chart.kind === 'stacked_bar') {
    const bw = Math.min(slot * 0.7, 170);
    chart.labels.forEach((_, i) => {
      let acc = 0;
      series.forEach((se, si) => {
        const v = se.values[i] || 0;
        if (!v) return;
        out.push('<rect x="' + f1(cx(i) - bw / 2) + '" y="' + f1(y(acc + v)) + '" width="' + f1(bw) + '" height="' + f1(Math.max(0, y(acc) - y(acc + v) - 2)) + '" fill="' + SERIES_FILL[si] + '"/>');
        acc += v;
      });
      if (chart.show_values || i === hi) out.push('<text class="vl" text-anchor="middle" x="' + f1(cx(i)) + '" y="' + f1(y(acc) - 10) + '">' + esc(fmtNum(acc)) + '</text>');
    });
  } else {
    const fillArea = chart.kind === 'area' || series.length === 1;
    series.forEach((se, si) => {
      // null values leave gaps: one path per run of numbers
      const runs = []; let run = [];
      se.values.forEach((v, i) => { if (v == null) { if (run.length) runs.push(run); run = []; } else run.push([cx(i), y(v)]); });
      if (run.length) runs.push(run);
      const stroke = SERIES_FILL[si];
      const dash = isPlan(se.name) || (si > 0 && series.length === 2 && !isPlan(series[0].name)) ? ' stroke-dasharray="3 9" stroke-linecap="round"' : '';
      runs.forEach((pts) => {
        const d = pts.map((p, k) => (k ? 'L' : 'M') + f1(p[0]) + ' ' + f1(p[1])).join('');
        if (si === 0 && fillArea && pts.length > 1) {
          out.push('<defs><linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--s1)" stop-opacity=".42"/><stop offset="1" stop-color="var(--s1)" stop-opacity="0"/></linearGradient></defs>');
          out.push('<path d="' + d + 'L' + f1(pts[pts.length - 1][0]) + ' ' + f1(TOP + ph) + 'L' + f1(pts[0][0]) + ' ' + f1(TOP + ph) + 'Z" fill="url(#' + id + 'g)"/>');
        }
        if (pts.length === 1) out.push('<circle cx="' + f1(pts[0][0]) + '" cy="' + f1(pts[0][1]) + '" r="5" fill="' + stroke + '"/>');
        else out.push('<path class="draw" d="' + d + '" fill="none" stroke="' + stroke + '" stroke-width="' + (si === 0 ? 4 : 2.5) + '" stroke-linejoin="round"' + dash + '/>');
      });
      if (chart.show_values && si === 0) se.values.forEach((v, i) => { if (v != null && i !== ends[0].k) out.push('<text class="vl sm" text-anchor="middle" x="' + f1(cx(i)) + '" y="' + f1(y(v) - 14) + '">' + esc(fmtNum(v)) + '</text>'); });
    });
    // end dots and direct labels, nudged apart when two lines end close together
    const marks = ends.map((e, si) => ({ si, e, py: e.k >= 0 ? y(series[si].values[e.k]) : 0, px: e.k >= 0 ? cx(e.k) : 0 })).filter((m2) => m2.e.k >= 0).sort((a, b) => a.py - b.py);
    const lineH = series.length > 1 && direct ? 58 : 30;
    marks.forEach((m2, k) => { m2.ly = k === 0 ? Math.max(m2.py, TOP + 4) : Math.max(m2.py, marks[k - 1].ly + lineH); });
    marks.forEach((m2) => {
      const stroke = SERIES_FILL[m2.si];
      out.push('<circle cx="' + f1(m2.px) + '" cy="' + f1(m2.py) + '" r="' + (m2.si === 0 ? 8 : 5) + '" fill="var(--bg)" stroke="' + stroke + '" stroke-width="' + (m2.si === 0 ? 4 : 2.5) + '"/>');
      const lx = m2.px + 18;
      if (series.length > 1 && m2.e.name && direct) {
        out.push('<text class="el" x="' + f1(lx) + '" y="' + f1(m2.ly - 2) + '">' + esc(m2.e.name) + '</text>');
        out.push('<text class="vl' + (m2.si === 0 ? ' hi' : '') + '" x="' + f1(lx) + '" y="' + f1(m2.ly + 27) + '">' + esc(m2.e.val) + '</text>');
      } else out.push('<text class="vl' + (m2.si === 0 ? ' hi' : '') + '" x="' + f1(lx) + '" y="' + f1(m2.ly + 8) + '">' + esc(m2.e.val) + '</text>');
    });
  }
  out.push('<line x1="' + f1(L) + '" x2="' + f1(L + pw) + '" y1="' + f1(TOP + ph) + '" y2="' + f1(TOP + ph) + '" class="base"/>');

  // annotation: the event that explains the bend, on a leader line
  const an = chart.annotation;
  if (an && an.text) {
    let at = Number.isInteger(an.at) ? an.at : chart.labels.indexOf(String(an.at));
    if (at < 0 || at >= n) issue('chart annotation: "at" must be one of the x labels (or its index); "' + an.at + '" is not.');
    else {
      if (String(an.text).length > CHART_LIMITS.annotation) issue('the chart annotation is ' + String(an.text).length + ' characters; ' + CHART_LIMITS.annotation + ' fit on its line.');
      const v = chart.kind === 'stacked_bar' ? series.reduce((a, se) => a + (se.values[at] || 0), 0) : (series[0].values[at] || 0);
      const px = cx(at), py = y(v);
      const textW = tw(an.text, body, 20);
      const left = px + 14 + textW > L + pw;
      const ty = Math.max(TOP - 16, Math.min(py - 70, TOP + ph * 0.35));
      out.push('<line class="an-l" x1="' + f1(px) + '" x2="' + f1(px) + '" y1="' + f1(py - (isLine ? 0 : 6)) + '" y2="' + f1(ty - 14) + '"/>');
      if (isLine) out.push('<circle cx="' + f1(px) + '" cy="' + f1(py) + '" r="6" class="an-d"/>');
      out.push('<text class="an" text-anchor="' + (left ? 'end' : 'start') + '" x="' + f1(px + (left ? -12 : 12)) + '" y="' + f1(ty) + '">' + esc(an.text) + '</text>');
    }
  }
  return '<svg class="chart" width="' + Math.round(W) + '" height="' + Math.round(H) + '" viewBox="0 0 ' + Math.round(W) + ' ' + Math.round(H) + '" role="img" aria-label="' + esc((chart.y_label || 'Chart') + ', ' + series.map((se) => se.name).filter(Boolean).join(', ')) + '">' + out.join('') + '</svg>';
}

// Chart with its header row (what the y axis measures, legend for bars) and its source
// caption, filling w x h exactly.
function chartBlock(chart, w, h, src) {
  const T = LX.theme;
  if (chart.kind === 'donut') {
    const parts = chart.labels.map((l, k) => ({ label: l, pct: chart.series[0].values[k] || 0 }));
    return { h, html: '<div class="chart-b" style="height:' + Math.round(h) + 'px;justify-content:center">' + fundsBlock(parts, Math.min(w, 760)).html + '</div>' };
  }
  const isLine = chart.kind === 'line' || chart.kind === 'area';
  const direct = isLine && endLabelWidth(chart) <= w * 0.3;
  const multi = chart.series.length > 1 && chart.kind !== 'horizontal_bar' && !(isLine && direct);
  const lineColor = (i) => SERIES_FILL[i];
  const cap = src ? captionHtml(src, HCTX) : '';
  let head = 0, headHtml = '';
  const legend = multi ? chart.series.slice(0, CHART_LIMITS.series).map((se, i) => '<span class="lg"><i style="background:' + (isLine ? lineColor(i) : SERIES_FILL[i]) + '"></i>' + esc(se.name) + '</span>').join('') : '';
  if (chart.y_label || legend) {
    const legW = multi ? chart.series.slice(0, CHART_LIMITS.series).reduce((a, se) => a + tw(se.name, T.roles.mono, T.monoSize) + 54, 0) : 0;
    const ylW = chart.y_label ? tw(chart.y_label, T.roles.mono, T.monoSize) + 30 : 0;
    const two = legW + ylW > w;
    if (legW > w) issue('the chart legend does not fit on one line. Shorten the series names (about ' + Math.floor((w / chart.series.length - 54) / (T.monoSize * 0.7)) + ' characters each).');
    if (ylW > w) issue('y_label is too long for the chart (about ' + Math.floor(w / (T.monoSize * 0.7)) + ' characters fit).');
    head = two ? 64 : 34;
    headHtml = '<div class="chart-h f-mono lbl" style="height:' + head + 'px;font-size:' + T.monoSize + 'px' + (two ? ';flex-wrap:wrap' : '') + '">' + (chart.y_label ? '<span>' + esc(chart.y_label) + '</span>' : '<span></span>') + (legend ? '<span class="lgs">' + legend + '</span>' : '') + '</div>';
  }
  const foot = cap ? 34 : 0;
  const ch = h - head - foot;
  if (ch < 240) issue('the chart has only ' + Math.round(ch) + ' px of height left. Cut a stat or a point beside it.');
  const svg = svgChart(chart, w, Math.max(160, ch), direct);
  return { h, html: '<div class="chart-b" style="height:' + Math.round(h) + 'px">' + headHtml + svg + (cap ? '<p class="cap f-mono" style="font-size:16px">' + cap + '</p>' : '') + '</div>' };
}

// Donut: each slice is a stroke-dasharray on a circle of circumference 100, so it stays
// vector in the PDF. The largest share sits in the hole.
const DONUT_COLORS = SERIES_FILL;
function donutSvg(parts, size) {
  const total = parts.reduce((a, p) => a + (Number(p.pct) || 0), 0) || 1;
  const colors = DONUT_COLORS;
  let acc = 0;
  const segs = parts.map((p, i) => {
    const v = (Number(p.pct) || 0) * 100 / total;
    const seg = '<circle cx="21" cy="21" r="15.915" stroke="' + colors[i % colors.length] + '" stroke-dasharray="' + f1(Math.max(0, v - 0.6)) + ' ' + f1(100 - Math.max(0, v - 0.6)) + '" stroke-dashoffset="' + f1(-acc) + '"/>';
    acc += v;
    return seg;
  }).join('');
  const big = parts.reduce((a, p) => ((Number(p.pct) || 0) > (Number(a.pct) || 0) ? p : a), parts[0] || { pct: 0 });
  return '<svg class="donut" width="' + size + '" height="' + size + '" viewBox="0 0 42 42" role="img" aria-label="Use of funds"><g fill="none" stroke-width="5.2" transform="rotate(-90 21 21)">' + segs + '</g>' +
    '<text class="f-num dn" x="21" y="24.2" text-anchor="middle">' + esc(fmtNum(Number(big.pct) || 0)) + '%</text></svg>';
}


// Sparkline: a small line that ends in an accent dot. No axis; the value beside it is the number.
function sparkSvg(values, w, h, strong) {
  const v = values.filter((x) => x != null).map(Number);
  if (v.length < 2) return '';
  const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
  const pts = v.map((x, i) => [4 + (w - 12) * i / (v.length - 1), 5 + (h - 10) * (1 - (x - min) / span)]);
  return '<svg class="spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><polyline class="draw" fill="none" stroke="currentColor" stroke-width="' + (strong ? 3 : 2) + '" stroke-linejoin="round" points="' + pts.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ') + '"/>' +
    '<circle cx="' + f1(pts[pts.length - 1][0]) + '" cy="' + f1(pts[pts.length - 1][1]) + '" r="' + (strong ? 6 : 4.5) + '" fill="var(--accent-2)"/></svg>';
}
// Rows of metric name, sparkline, latest value: replaces a table of KPIs.
function sparkRows(rows, w) {
  const T = LX.theme;
  const size = sv(24, 22);
  const list = rows.slice(0, 6);
  if (rows.length > 6) issue(rows.length + ' sparkline rows; 6 are drawn.');
  const valW = Math.max(60, ...list.map((r) => tw(String(r.value == null ? '' : r.value), T.roles.bodyb, size))) + 8;
  const sw = Math.max(90, Math.min(240, w * 0.36));
  const nameW = w - sw - valW - 36;
  const rowH = 54;
  const html = list.map((r) => {
    if (tw(r.label, T.roles.body, size) > nameW) issue('sparkline label "' + r.label + '" is too long (about ' + Math.floor(nameW / (size * 0.52)) + ' characters fit).');
    return '<div class="sp-row" style="height:' + rowH + 'px;font-size:' + size + 'px"><span class="t f-body sp-n">' + txt(r.label) + '</span>' + sparkSvg(asArray(r.values), Math.round(sw), 34) + '<b class="t f-bodyb sp-v" style="width:' + Math.round(valW) + 'px">' + txt(r.value) + '</b></div>';
  }).join('');
  return { h: list.length * rowH, html: '<div class="sparks">' + html + '</div>' };
}
// --------------------------------------------------------------------------------------
// 4c. Diagrams: native SVG and positioned text, drawn from the `diagram` object
// --------------------------------------------------------------------------------------
// Each kind takes its data and the pixel size of its cell and returns {h, html}. Shapes
// are SVG (vector in the PDF); words are measured text boxes, so the lint covers them.

const DIAGRAM_KINDS = ['flow', 'funnel', 'timeline', 'market', 'matrix', 'power_grid', 'loop', 'layers', 'before_after'];
let dgSeq = 0;
// A text box at (x, y) inside the diagram.
const dgAt = (x, y, w, html, extra) => '<div class="dg-t" style="left:' + f1(x) + 'px;top:' + f1(y) + 'px;width:' + f1(w) + 'px' + (extra ? ';' + extra : '') + '">' + html + '</div>';
const dgWrap = (w, h, svg, html, cls, fill) => ({ h, fill: fill === undefined ? h : Math.min(h, fill), html: '<div class="dg dg-' + cls + '" style="width:' + Math.round(w) + 'px;height:' + Math.round(h) + 'px">' + (svg ? '<svg class="dg-s" width="' + Math.round(w) + '" height="' + Math.round(h) + '" viewBox="0 0 ' + Math.round(w) + ' ' + Math.round(h) + '" aria-hidden="true">' + svg + '</svg>' : '') + html + '</div>' });
const arrowDef = (id) => '<defs><marker id="' + id + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--ink)"/></marker></defs>';
const stepOf = (x) => (typeof x === 'string' ? { text: x } : (x || {}));
const two = (n) => String(n).padStart(2, '0');

const DIAGRAMS = {
  // Steps with arrows; `loop` adds a dashed return path with a caption.
  flow(d, w, h) {
    const steps = asArray(d.steps).slice(0, 5).map(stepOf);
    if (asArray(d.steps).length > 5) issue('the flow has ' + d.steps.length + ' steps; 5 are drawn.');
    const n = Math.max(1, steps.length);
    const gap = n > 3 ? 54 : 72;
    const loopH = d.loop ? 104 : 0;
    const bw = (w - (n - 1) * gap) / n;
    const bh = h - loopH;                       // the cards run the full height of the cell
    const pad = bw < 300 ? 24 : 30;
    const iw = bw - 2 * pad;
    const hi = Number.isInteger(d.highlight) ? d.highlight : n - 1;
    const id = 'dg' + (++dgSeq);
    const fills = fillTones(LX.theme, LX.tone);
    const titleLadder = n > 3 ? [52, 46, 40, 34, 30, 26] : [64, 56, 48, 42, 36, 30, 26];
    const anyTitle = steps.some((st) => st.title);
    // every step is fitted alone first; then all titles take the smallest title size and all texts
    // the smallest text size, so uneven steps do not end up in different sizes
    const fitAll = (tSizes, bSizes) => steps.map((st, i) => {
      const title = st.title ? tb(st.title, { role: 'display', sizes: tSizes, w: iw, max: 2, what: 'flow step ' + (i + 1) + ' title' }) : null;
      const body = st.text ? tb(st.text, { role: 'body', sizes: bSizes, w: iw, maxH: bh - 2 * pad - 56 - 16 - (title ? title.h + 14 : 0), what: 'flow step ' + (i + 1) + ' text' }) : null;
      return { title, body };
    });
    const was = LX.quiet; LX.quiet = true; const c0 = LX.count || 0;
    const first = fitAll(titleLadder, PT_SIZES().slice(anyTitle ? 1 : 0));
    LX.count = c0; LX.quiet = was;
    const tSize = Math.min(...first.map((f) => (f.title ? f.title.size : 999)));
    const bSize = Math.min(...first.map((f) => (f.body ? f.body.size : 999)));
    const parts = fitAll([tSize], [bSize]);
    let svg = arrowDef(id), html = '';
    steps.forEach((st, i) => {
      const x = i * (bw + gap);
      const tone = i === hi ? fills[0] : null;
      const head = st.icon ? rawBlock(56, icon(st.icon, 52)) : tb(two(i + 1), { role: 'num', size: 52, lh: 1, w: iw, max: 1, cls: 'idx' });
      const { title, body } = parts[i];
      html += '<div class="dg-box' + (tone ? ' filled' : '') + '"' + (tone ? ' data-tone="' + tone + '"' : '') + ' style="left:' + f1(x) + 'px;top:0;width:' + f1(bw) + 'px;height:' + f1(bh) + 'px;padding:' + pad + 'px"><div class="cg cg-top">' + head.html + '</div><div class="cg cg-bottom" style="gap:14px">' + (title ? title.html : '') + (body ? body.html : '') + '</div></div>';
      if (i < n - 1) svg += '<path d="M' + f1(x + bw + 8) + ' ' + f1(bh / 2) + 'H' + f1(x + bw + gap - 8) + '" class="dg-l" marker-end="url(#' + id + ')"/>';
    });
    if (d.loop) {
      const yl = bh + 58;
      svg += '<path d="M' + f1(w - bw / 2) + ' ' + f1(bh + 6) + 'V' + f1(yl) + 'H' + f1(bw / 2) + 'V' + f1(bh + 10) + '" class="dg-l dash" marker-end="url(#' + id + ')"/>';
      const cap = tb(d.loop, { role: 'body', size: sv(26, 24), w: w - bw - 40, nowrap: true, what: 'the flow loop caption' });
      html += dgAt(bw / 2 + 20, yl + 8, w - bw - 40, cap.html, 'text-align:center');
    }
    // how full the cards are decides whether the slide reads as thin
    const content = Math.max(...parts.map((p) => 56 + 16 + (p.title ? p.title.h + 14 : 0) + (p.body ? p.body.h : 0))) + 2 * pad;
    return dgWrap(w, h, svg, html, 'flow', Math.max(content * 1.5, bh * 0.56) + loopH);
  },

  // Stacked trapezoids, figures inside, labels on leader lines; the last stage is the accent.
  funnel(d, w, h) {
    const stages = asArray(d.stages).slice(0, 5);
    if (asArray(d.stages).length > 5) issue('the funnel has ' + d.stages.length + ' stages; 5 are drawn.');
    const n = Math.max(1, stages.length);
    const g = 10;
    const sh = Math.min(170, (h - (n - 1) * g) / n);
    const y0 = (h - (n * sh + (n - 1) * g)) / 2;
    const fw = Math.min(w * 0.56, 760);
    const labelX = fw + 110, labelW = w - labelX;
    let svg = '', html = '';
    stages.forEach((st, i) => {
      const t0 = 1 - i * 0.72 / n, t1 = 1 - (i + 1) * 0.72 / n;
      const y = y0 + i * (sh + g);
      const a = fw * (1 - t0) / 2, b = fw * (1 - t1) / 2;
      const last = i === n - 1;
      svg += '<path d="M' + f1(a) + ' ' + f1(y) + 'H' + f1(fw - a) + 'L' + f1(fw - b) + ' ' + f1(y + sh) + 'H' + f1(b) + 'Z" class="dg-shape" fill="' + (last ? 'var(--accent)' : i % 2 ? 'var(--fill)' : 'var(--surface)') + '"/>';
      svg += '<line x1="' + f1(fw - (a + b) / 2 + 14) + '" x2="' + f1(labelX - 16) + '" y1="' + f1(y + sh / 2) + '" y2="' + f1(y + sh / 2) + '" class="dg-h"/>';
      const val = numBlock(st.value, fw * t1 - 30, ladder(Math.min(84, sh * 0.52), 30, 6), { what: 'funnel stage ' + (i + 1) + ' value' });
      html += dgAt(0, y + (sh - val.h) / 2, fw, '<div data-ground="' + (last ? '--accent' : i % 2 ? '--fill' : '--surface') + '">' + val.html + '</div>', 'text-align:center;color:' + (last ? 'var(--on-accent)' : 'var(--ink)'));
      let note = st.note;
      const pv = i > 0 ? Number(String(stages[i - 1].value).replace(/[^\d.]/g, '')) : 0, cv = Number(String(st.value).replace(/[^\d.]/g, ''));
      if (!note && i > 0 && pv > 0 && cv >= 0 && d.rates !== false) note = fmtNum(Math.round(cv * 1000 / pv) / 10) + '% of the stage above';
      const lab = tb(st.label, { role: 'bodyb', sizes: LX.variant === 'read' ? [30, 27, 24] : [34, 30, 26], w: labelW, max: 2, maxH: sh - 30, what: 'funnel label ' + (i + 1), cls: last ? 'hi' : '' });
      const nt = note ? label(note, labelW, { what: 'funnel note ' + (i + 1), size: LX.theme.monoSize + 2 }) : null;
      html += dgAt(labelX, y + (sh - lab.h - (nt ? nt.h + 4 : 0)) / 2, labelW, lab.html + (nt ? nt.html : ''));
    });
    return dgWrap(w, h, svg, html, 'funnel', n * sh + (n - 1) * g);
  },

  // One line, milestones as circles (filled when done), a marker for today.
  timeline(d, w, h) {
    const items = asArray(d.items).slice(0, 6).map((x) => (typeof x === 'string' ? { what: x } : (x || {})));
    if (asArray(d.items).length > 6) issue('the timeline has ' + d.items.length + ' milestones; 6 are drawn.');
    const n = Math.max(1, items.length);
    const colW = w / n;
    const tall = h > 420;
    const tw0 = colW - 40;
    let done = Number.isInteger(d.today) ? d.today : items.filter((it) => it.done).length;
    const hasToday = d.today !== undefined || items.some((it) => it.done);
    done = Math.max(0, Math.min(n, done));
    const headH = hasToday ? 70 : 24;          // room above the line for the today marker
    const cards = tall;                         // a tall cell: each milestone is a card that runs to the bottom
    const pad = cards ? 30 : 0;
    const cgap = cards ? Math.max(14, cs().gap) : 0;
    const cw = cards ? (w - (n - 1) * cgap) / n : colW;
    const tw1 = cards ? cw - 2 * pad : tw0;
    const ly = cards ? headH : 0;
    const cardH = h - headH - 46;
    const fills = fillTones(LX.theme, LX.tone);
    const cols = items.map((it, i) => {
      const tone = cards && i === n - 1 ? fills[0] : null;
      const prev = LX.tone; if (tone) LX.tone = tone;
      const when = it.when ? tb(it.when, { role: 'display', sizes: tall ? (n > 4 ? [56, 48, 42, 36, 30] : [76, 66, 58, 50, 42, 34]) : [30, 26], w: tw1, max: 1, what: 'milestone ' + (i + 1) + ' date' }) : null;
      const avail = (cards ? cardH - 2 * pad : h - headH - 60) - (when ? when.h + 14 : 0);
      const what = it.what ? tb(it.what, { role: 'bodyb', sizes: tall ? PT_SIZES().slice(1) : [sv(24, 22)], w: tw1, maxH: avail * (it.proves ? 0.5 : 1), what: 'milestone ' + (i + 1) }) : null;
      const proves = it.proves ? tb(it.proves, { role: 'body', sizes: tall ? PT_SIZES().slice(2) : [sv(24, 22)], w: tw1, maxH: avail - (what ? what.h + 14 : 0) - 14, what: 'milestone ' + (i + 1) + ' "proves" line', cls: 'mut' }) : null;
      LX.tone = prev;
      const list = [what, proves].filter(Boolean);
      const textHtml = '<div class="vs" style="gap:14px">' + list.map((b) => b.html).join('') + '</div>';
      return { tone, h: (when ? when.h + 14 : 0) + list.reduce((a, b) => a + b.h, 0) + Math.max(0, list.length - 1) * 14,
        html: cards ? '<div class="cg cg-top">' + (when ? when.html : '') + '</div><div class="cg cg-bottom">' + textHtml + '</div>' : '<div class="vs" style="gap:14px">' + (when ? when.html : '') + textHtml + '</div>' };
    });
    const textH = Math.max(0, ...cols.map((c) => c.h));
    const total = headH + 60 + textH;
    const lineY = cards ? ly : Math.round(Math.max(0, (h - total) * 0.42) + headH);
    const x = (i) => (cards ? i * (cw + cgap) + 30 : colW * i + 22);
    const tx = done >= n ? w - 10 : (done === 0 ? 0 : (x(done - 1) + x(done)) / 2);
    let svg = '<line x1="0" x2="' + f1(w) + '" y1="' + lineY + '" y2="' + lineY + '" class="dg-axis"/>';
    let html = '';
    if (hasToday) {
      svg += '<rect x="0" y="' + (lineY - 5) + '" width="' + f1(tx) + '" height="10" fill="var(--accent)"/>';
      svg += '<path d="M' + f1(tx) + ' ' + (lineY - 14) + 'l12 -20h-24z" fill="var(--accent)"/>';
      const lab = label(d.today_label || 'Today', 160, {});
      html += dgAt(Math.max(0, Math.min(w - 160, tx - 80)), lineY - 42 - lab.h, 160, lab.html, 'text-align:center');
    }
    items.forEach((it, i) => {
      const isDone = hasToday && i < done;
      svg += '<circle cx="' + f1(x(i)) + '" cy="' + lineY + '" r="15" class="dg-node' + (isDone ? ' on' : '') + '"/>';
      if (cards) {
        svg += '<line x1="' + f1(x(i)) + '" x2="' + f1(x(i)) + '" y1="' + (lineY + 15) + '" y2="' + (lineY + 46) + '" class="dg-h"/>';
        html += '<div class="dg-box' + (cols[i].tone ? ' filled' : '') + '"' + (cols[i].tone ? ' data-tone="' + cols[i].tone + '"' : '') + ' style="left:' + f1(i * (cw + cgap)) + 'px;top:' + (lineY + 46) + 'px;width:' + f1(cw) + 'px;height:' + f1(cardH) + 'px;padding:' + pad + 'px">' + cols[i].html + '</div>';
      } else html += dgAt(x(i) - 16, lineY + 46, tw0, cols[i].html);
    });
    return dgWrap(w, h, svg, html, 'timeline', cards ? h : total);    return dgWrap(w, h, svg, html, 'timeline');
  },

  // TAM, SAM, SOM as circles that share the bottom tangent, each with its number and method.
  market(d, w, h) {
    const rings = asArray(d.rings).slice(0, 3);
    const D = Math.min(h, w * 0.44);
    const r = rings.length === 2 ? [D / 2, D * 0.27] : [D / 2, D * 0.33, D * 0.165];
    const cx0 = D / 2, y0 = (h - D) / 2;
    const fills = ['var(--fill)', 'var(--accent)', 'var(--c2)'];
    const colW = Math.min(w - D - 96, 980);
    const x0 = Math.max(0, (w - (D + 96 + colW)) / 2);      // centre the group when the cell is wider than it needs
    const cx = x0 + cx0;
    const colX = x0 + D + 96;
    const rowH = h / Math.max(1, rings.length);
    let svg = '', html = '';
    rings.forEach((rg, i) => {
      const cy = y0 + D - r[i];
      svg += '<circle cx="' + f1(cx) + '" cy="' + f1(cy) + '" r="' + f1(r[i] - 2) + '" fill="' + fills[i] + '" class="dg-shape"/>';
    });
    rings.forEach((rg, i) => {
      const dotY = y0 + D - 2 * r[i] + (i === rings.length - 1 && i > 0 ? r[i] : 30);
      const rowY = i * rowH;
      const val = numBlock(rg.value, colW, ladder(Math.min(150, rowH * 0.42), 44, 8), { what: 'market figure ' + (i + 1) });
      const lab = tb(rg.label || rg.method || '', { role: 'body', sizes: PT_SIZES().slice(2), w: colW, maxH: rowH - val.h - 18, what: 'market label ' + (i + 1) });
      const ty = rowY + Math.max(0, (rowH - val.h - 10 - lab.h) / 2);
      const my = ty + val.h * 0.5;
      svg += '<path d="M' + f1(cx) + ' ' + f1(dotY) + 'H' + f1(x0 + D + 28) + 'L' + f1(x0 + D + 56) + ' ' + f1(my) + 'H' + f1(colX - 14) + '" class="dg-h" fill="none"/><circle cx="' + f1(cx) + '" cy="' + f1(dotY) + '" r="5" fill="' + (i === 0 ? 'var(--ink)' : i === 1 ? 'var(--on-accent)' : 'var(--on-c2)') + '"/>';
      html += dgAt(colX, ty, colW, '<div class="vs" style="gap:10px">' + val.html + lab.html + '</div>');
    });
    return dgWrap(w, h, svg, html, 'market', Math.max(D, h * 0.8));
  },

  // 2x2 with labelled axes. Competitors are named; the company is the filled dot.
  matrix(d, w, h) {
    const items = asArray(d.items).slice(0, 8);
    const rivals = items.filter((it) => !it.us).length;
    if (rivals < 2) issue('a 2x2 matrix needs at least two named competitors; the company alone in a corner reads as a tell. Add them to diagram.items or use a power_grid.');
    const ax = (v) => (Array.isArray(v) ? { low: v[0], high: v[1], label: '' } : (v || {}));
    const X = ax(d.x), Y = ax(d.y);
    const mono = LX.theme.monoSize * 1.3;
    const ML = 14 + mono + (Y.label ? mono + 8 : 0), MB = 14 + mono + (X.label ? mono + 8 : 0);
    const S = Math.min(h - MB, w - ML);
    const x0 = ML + (w - ML - S) / 2, y0 = 0;
    let svg = '<rect x="' + f1(x0 + S / 2) + '" y="' + f1(y0) + '" width="' + f1(S / 2) + '" height="' + f1(S / 2) + '" fill="var(--accent)" fill-opacity=".16"/>' +
      '<rect x="' + f1(x0) + '" y="' + f1(y0) + '" width="' + f1(S) + '" height="' + f1(S) + '" fill="none" class="dg-frame"/>' +
      '<path d="M' + f1(x0 + S / 2) + ' ' + f1(y0) + 'V' + f1(y0 + S) + 'M' + f1(x0) + ' ' + f1(y0 + S / 2) + 'H' + f1(x0 + S) + '" class="dg-h dash"/>';
    let html = '';
    // axis ends on the first row outside the square, the axis name on a second row
    const lab = (t, bw, what) => label(t, bw, { what });
    const half = S / 2 - 12;
    if (X.low) html += dgAt(x0, y0 + S + 12, half, lab(X.low, half, 'the low end of the x axis').html);
    if (X.high) html += dgAt(x0 + S - half, y0 + S + 12, half, lab(X.high, half, 'the high end of the x axis').html, 'text-align:right');
    if (X.label) html += dgAt(x0, y0 + S + 16 + mono, S, lab(X.label, S, 'the x axis label').html, 'text-align:center;color:var(--ink)');
    // the y axis reads bottom to top
    const rot = (t, top, bw, col, align, ink, what) => '<div class="dg-t dg-rot" style="left:' + f1(col) + 'px;top:' + f1(top) + 'px;width:' + f1(bw) + 'px;text-align:' + align + (ink ? ';color:var(--ink)' : '') + '">' + lab(t, bw, what).html + '</div>';
    const c1 = x0 - 12 - mono, c2 = c1 - mono - 6;
    if (Y.low) html += rot(Y.low, y0 + S, half, c1, 'left', 0, 'the low end of the y axis');
    if (Y.high) html += rot(Y.high, y0 + half, half, c1, 'right', 0, 'the high end of the y axis');
    if (Y.label) html += rot(Y.label, y0 + S, S, c2, 'center', 1, 'the y axis label');
    items.forEach((it) => {
      const px = x0 + S * Math.max(0.05, Math.min(0.95, Number(it.x) || 0)), py = y0 + S * (1 - Math.max(0.07, Math.min(0.93, Number(it.y) || 0)));
      const size = it.us ? sv(28, 26) : sv(24, 22);
      const tW = tw(it.name, LX.theme.roles.bodyb, size) + 6;
      const off = it.us ? 48 : 22;
      if (tW > S * 0.62) issue('matrix label "' + it.name + '" is too long (about ' + Math.floor(S * 0.62 / (size * 0.56)) + ' characters fit).');
      svg += it.us ? '<circle cx="' + f1(px) + '" cy="' + f1(py) + '" r="20" fill="var(--accent)"/><circle cx="' + f1(px) + '" cy="' + f1(py) + '" r="36" fill="none" stroke="var(--accent)" stroke-width="2"/>'
        : '<circle cx="' + f1(px) + '" cy="' + f1(py) + '" r="11" fill="var(--bg)" stroke="var(--ink)" stroke-width="2.5"/>';
      // beside the dot when there is room, else centred above it
      const right = px + off + tW <= x0 + S - 8, left = px - off - tW >= x0 + 8;
      const lx = right ? px + off : left ? px - off - tW : Math.max(x0 + 8, Math.min(x0 + S - 8 - tW, px - tW / 2));
      const ly = right || left ? py - size * 0.68 : py - (it.us ? 44 : 18) - size * 1.36;
      html += dgAt(lx, ly, tW, '<div class="t f-bodyb' + (it.us ? ' hi' : '') + '" style="font-size:' + size + 'px;line-height:1.36;white-space:nowrap">' + txt(it.name) + '</div>');
    });
    return dgWrap(w, h, svg, html, 'matrix', S + MB);
  },

  power_grid(d, w, h) { return gridTable(asArray(d.columns), asArray(d.rows), w, h, { us: d.us, grid: true }); },

  // Flywheel: nodes on a circle, arcs with arrowheads, a label in the centre.
  loop(d, w, h) {
    const nodes = asArray(d.nodes).slice(0, 5).map(stepOf);
    if (asArray(d.nodes).length > 5) issue('the loop has ' + d.nodes.length + ' nodes; 5 are drawn.');
    const n = Math.max(2, nodes.length);
    // an even number of nodes starts off the vertical, so every label sits beside the circle
    const ang = (i) => -Math.PI / 2 + (n % 2 ? 0 : Math.PI / n) + (2 * Math.PI * i) / n;
    const sideW = Math.min(w > 1300 ? 440 : 330, w * 0.27);
    // measure the labels first: the circle takes what they leave
    const labs = nodes.map((nd, i) => {
      const c = Math.cos(ang(i));
      const side = Math.abs(c) > 0.3;
      const bw = side ? sideW : Math.min(560, w);
      const big = h > 520 && w > 1300;      // a large cell: larger labels, and a larger circle below
      const t1 = tb(nd.title || nd.text || '', { role: 'bodyb', sizes: big ? (LX.variant === 'read' ? [38, 34, 30, 27, 25] : [42, 38, 34, 30, 28]) : (LX.variant === 'read' ? [30, 27, 25] : [34, 30, 28]), w: bw, max: side ? 3 : 1, what: 'loop node ' + (i + 1) });
      const t2 = nd.title && nd.text ? tb(nd.text, { role: 'body', sizes: big ? PT_SIZES().slice(2) : [sv(24, 22)], w: bw, max: side ? 3 : 1, what: 'loop node ' + (i + 1) + ' text', cls: 'mut' }) : null;
      return { side, bw, h: t1.h + (t2 ? t2.h + 6 : 0), html: '<div class="vs" style="gap:6px">' + t1.html + (t2 ? t2.html : '') + '</div>' };
    });
    const capH = Math.max(0, ...labs.filter((l) => !l.side).map((l) => l.h));
    const R = Math.max(80, Math.min((h - 2 * (capH ? capH + 34 : 16)) / 2, (w - 2 * sideW - 80) / 2, 400));
    if (R < 110) issue('the loop has too little room (' + Math.round(R) + ' px radius). Shorten the node labels or give the slide fewer points.');
    const cx = w / 2, cy = h / 2;
    const id = 'dg' + (++dgSeq);
    let svg = '<defs><marker id="' + id + '" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" fill="var(--accent)"/></marker></defs>';
    let html = '';
    const gapA = 0.2;
    for (let i = 0; i < n; i++) {
      const a0 = ang(i) + gapA, a1 = ang(i + 1) - gapA;
      svg += '<path d="M' + f1(cx + R * Math.cos(a0)) + ' ' + f1(cy + R * Math.sin(a0)) + 'A' + f1(R) + ' ' + f1(R) + ' 0 0 1 ' + f1(cx + R * Math.cos(a1)) + ' ' + f1(cy + R * Math.sin(a1)) + '" fill="none" stroke="var(--accent)" stroke-width="' + f1(Math.max(4, R / 50)) + '" marker-end="url(#' + id + ')"/>';
      svg += '<circle cx="' + f1(cx + R * Math.cos(ang(i))) + '" cy="' + f1(cy + R * Math.sin(ang(i))) + '" r="' + f1(Math.max(12, R / 17)) + '" fill="var(--ink)"/>';
      const lb = labs[i];
      if (!lb) continue;
      const c = Math.cos(ang(i)), s2 = Math.sin(ang(i));
      const px = cx + (R + 40) * c, py = cy + (R + 34) * s2;
      const bx = lb.side ? (c > 0 ? px : px - lb.bw) : cx - lb.bw / 2;
      const by = lb.side ? Math.max(0, Math.min(h - lb.h, py - lb.h / 2)) : (s2 < 0 ? py - lb.h : py);
      html += dgAt(bx, by, lb.bw, lb.html, lb.side ? (c > 0 ? '' : 'text-align:right') : 'text-align:center');
    }
    if (d.center) { const c = tb(d.center, { role: 'display', sizes: [72, 64, 56, 50, 44, 38, 32, 28, 24], w: R * 1.3, max: 4, maxH: R * 1.2, what: 'the loop centre label' }); html += dgAt(cx - R * 0.65, cy - c.h / 2, R * 1.3, c.html, 'text-align:center'); }
    return dgWrap(w, h, svg, html, 'loop', 2 * R + 2 * (capH ? capH + 34 : 16));
  },

  // A stack: flat rhombi from bottom to top, the top layer is the accent; names beside them.
  layers(d, w, h) {
    const layers = asArray(d.layers).slice(0, 5).map(stepOf);
    if (asArray(d.layers).length > 5) issue('the stack has ' + d.layers.length + ' layers; 5 are drawn.');
    const n = Math.max(1, layers.length);
    // the widest rhombus whose stack still fits the height: total = 2 * RH + step * (n - 1), step = 0.95 * RH
    const RW = Math.min(w * 0.46, 680, (h / (0.32 * (2 + 0.95 * (n - 1)))));
    const RH = RW * 0.32;
    const step = n > 1 ? RH * 0.95 : 0;
    const total = RH * 2 + step * (n - 1);
    const y0 = (h - total) / 2;
    const colX = RW + 110, colW = w - colX;
    let svg = '', html = '';
    for (let i = n - 1; i >= 0; i--) {      // bottom layer first
      const y = y0 + i * step;
      const fill = i === 0 ? 'var(--accent)' : (i % 2 ? 'var(--surface)' : 'var(--fill)');
      svg += '<path d="M' + f1(RW / 2) + ' ' + f1(y) + 'L' + f1(RW) + ' ' + f1(y + RH) + 'L' + f1(RW / 2) + ' ' + f1(y + 2 * RH) + 'L0 ' + f1(y + RH) + 'Z" fill="' + fill + '" class="dg-shape lay"/>';
    }
    layers.forEach((ly, i) => {
      const y = y0 + i * step + RH;
      svg += '<line x1="' + f1(RW + 10) + '" x2="' + f1(colX - 18) + '" y1="' + f1(y) + '" y2="' + f1(y) + '" class="dg-h"/>';
      const rowH = n > 1 ? step : h;
      const t1 = tb(ly.title || ly.text || '', { role: 'display', sizes: [52, 46, 40, 34, 30, 26], w: colW, max: 1, maxH: rowH * 0.5, what: 'layer ' + (i + 1) + ' name' });
      const t2 = ly.title && ly.text ? tb(ly.text, { role: 'body', sizes: PT_SIZES().slice(1), w: Math.min(colW, 900), maxH: Math.max(34, rowH - t1.h - 22), what: 'layer ' + (i + 1) + ' text', cls: 'mut' }) : null;
      const bh = t1.h + (t2 ? t2.h + 6 : 0);
      html += dgAt(colX, y - Math.min(bh / 2, t1.h * 0.6), colW, '<div class="vs" style="gap:6px">' + t1.html + (t2 ? t2.html : '') + '</div>');
    });
    return dgWrap(w, h, svg, html, 'layers', total);
  },

  // Two panels: before is outlined and muted, after is the accent block. Side by side
  // in a wide cell, stacked in a narrow one.
  before_after(d, w, h) {
    const vertical = w < 780;
    const gap = vertical ? 76 : 96;
    const pw = vertical ? w : (w - gap) / 2, ph = vertical ? (h - gap) / 2 : h, pad = 34;
    const fills = fillTones(LX.theme, LX.tone);
    const panel = (side, x, y, tone, name) => {
      const p = d[side] || {};
      const prev = LX.tone; if (tone) LX.tone = tone;
      const iw = pw - 2 * pad, ih = ph - 2 * pad;
      const lab = label(p.label || name, iw, { what: 'the "' + side + '" label' });
      const val = p.value != null ? numBlock(p.value, iw, ladder(Math.min(170, Math.round(ih * 0.36)), 56, 10), { what: 'the "' + side + '" value', cls: side === 'before' ? 'strike' : '' }) : null;
      const used = lab.h + (val ? val.h + 18 : 0);
      const pts0 = asArray(p.points).slice(0, 4);
      const text = p.text ? tb(p.text, { role: 'body', size: sv(28, 25), w: iw, maxH: (ih - used - 30) * (pts0.length ? 0.45 : 1), what: 'the "' + side + '" text' }) : null;
      const pts = pts0.length ? pointList(pts0.map((t) => ({ text: String(t) })), iw, { size: sv(24, 22), what: 'the "' + side + '" points', maxH: ih - used - (text ? text.h + 18 : 0) - 30 }) : null;
      LX.tone = prev;
      return '<div class="dg-box' + (tone ? ' filled' : ' ghost') + '"' + (tone ? ' data-tone="' + tone + '"' : '') + ' style="left:' + f1(x) + 'px;top:' + f1(y) + 'px;width:' + f1(pw) + 'px;height:' + f1(ph) + 'px;padding:' + pad + 'px"><div class="cg cg-top">' + lab.html + '</div><div class="cg cg-bottom" style="gap:18px">' + [val, text, pts].filter(Boolean).map((b) => b.html).join('') + '</div></div>';
    };
    const id = 'dg' + (++dgSeq);
    const svg = arrowDef(id) + (vertical
      ? '<path d="M' + f1(w / 2) + ' ' + f1(ph + 14) + 'V' + f1(ph + gap - 14) + '" class="dg-l thick" marker-end="url(#' + id + ')"/>'
      : '<path d="M' + f1(pw + 16) + ' ' + f1(h / 2) + 'H' + f1(pw + gap - 16) + '" class="dg-l thick" marker-end="url(#' + id + ')"/>');
    return dgWrap(w, h, svg, panel('before', 0, 0, null, 'Before') + (vertical ? panel('after', 0, ph + gap, fills[0], 'After') : panel('after', pw + gap, 0, fills[0], 'After')), 'ba');
  },
};

function diagramBlock(d, w, h) {
  const kind = String(d.kind || '').toLowerCase().replace(/-/g, '_');
  if (!DIAGRAMS[kind]) { issue('diagram kind "' + d.kind + '" is not one of ' + DIAGRAM_KINDS.join(', ') + '.'); return rawBlock(h, '<div style="height:' + Math.round(h) + 'px"></div>'); }
  return DIAGRAMS[kind](d, w, h);
}

// Table drawn as a hairline grid. true and false become filled and hollow dots; the
// company's column (or row) gets a full-height accent fill. Used for power grids and
// for every plain table.
function gridTable(columns, rows, w, h, o) {
  o = o || {};
  const T = LX.theme;
  if (!o._size) {
    // the largest type at which the table fits its panel, like a headline's ladder
    const sizes = o.ref ? [24, 22, 20] : (LX.variant === 'read' ? [32, 29, 26, 24, 22] : [36, 32, 28, 26, 24]);
    const was = LX.quiet; LX.quiet = true;
    let pick = sizes[sizes.length - 1];
    for (const sz of sizes) { const c0 = LX.count || 0; const r0 = gridTable(columns, rows, w, h, Object.assign({}, o, { _size: sz })); const ok = (LX.count || 0) === c0 && r0.need <= h; LX.count = c0; if (ok) { pick = sz; break; } }
    LX.quiet = was;
    return gridTable(columns, rows, w, h, Object.assign({}, o, { _size: pick }));
  }
  const company = HCTX && HCTX.meta ? String(HCTX.meta.company || '').toLowerCase() : '';
  const cells = rows.map((r) => (Array.isArray(r) ? r : (r.cells || [r.name].concat(asArray(r.values)))));
  const nc = Math.max(columns.length, ...cells.map((r) => r.length), 1);
  const cols = columns.length ? columns.slice() : Array(nc).fill('').map((_, i) => (i === 0 ? '' : 'Col ' + i));
  while (cols.length < nc) cols.push('');
  if (nc > 7) issue('the table has ' + nc + ' columns; 7 fit. Drop or merge columns.');
  let usCol = Number.isInteger(o.us) ? o.us : cols.findIndex((c, i) => i > 0 && company && String(c).toLowerCase() === company);
  const usRow = cells.findIndex((r) => company && String(r[0]).toLowerCase() === company);
  if (usCol < 0 && o.grid && usRow < 0) usCol = 1;
  const size = o._size;
  const monoSize = T.monoSize + (o.ref ? 0 : Math.max(0, Math.round((size - 24) / 3)));
  // column widths: the label column takes what its longest cell needs (up to 34 percent)
  const need0 = Math.max(tw(cols[0], T.roles.mono, monoSize), ...cells.map((r) => tw(String(r[0] == null ? '' : r[0]), T.roles.bodyb, size))) + 40;
  const w0 = nc === 1 ? w : Math.max(w * 0.16, Math.min(w * 0.34, need0));
  const wc = nc > 1 ? (w - w0) / (nc - 1) : 0;
  const colW = (j) => (o.widths ? w * o.widths[j] : (j === 0 ? w0 : wc));
  const padX = 20;
  const headB = cols.map((c, j) => tb(c, j === usCol ? { role: 'display', sizes: [Math.round(size * 1.25), size, 26, 22], w: colW(j) - 2 * padX, max: 2, what: 'a table header' } : { role: 'mono', size: monoSize, lh: 1.3, w: colW(j) - 2 * padX, max: 2, cls: 'lbl', what: 'a table header' }));
  const headH = Math.max(56, Math.max(...headB.map((b) => b.h)) + 28);
  const isDot = (v) => v === true || v === false || v === 'yes' || v === 'no' || v === 'true' || v === 'false';
  LX.brk = !!o.ref;      // reference tables may break ids and paths after _ / : . #
  const rowB = cells.map((r, i) => cols.map((_, j) => {
    const v = r[j];
    if (v == null || v === '') return { h: 0, html: j === 0 ? '' : '<span class="tb-no"></span>' };
    if (isDot(v)) { const on = v === true || v === 'yes' || v === 'true'; return { h: 26, html: '<span class="tb-dot' + (on ? ' on' : '') + '" style="width:' + Math.round(size) + 'px;height:' + Math.round(size) + 'px" role="img" aria-label="' + (on ? 'yes' : 'no') + '"></span>' }; }
    return tb(v, { role: j === 0 || j === usCol || i === usRow ? 'bodyb' : 'body', size, w: colW(j) - 2 * padX, max: o.ref ? 6 : 3, what: 'a table cell ("' + String(v).slice(0, 24) + '")' });
  }));
  LX.brk = false;
  // rows are padded generously when there is room and tightened before anything is reported
  let minRow = rowB.map((r) => Math.max(o.ref ? 26 : 34, ...r.map((b) => b.h)) + (o.ref ? 14 : 26));
  if (!o.ref && headH + minRow.reduce((a, b) => a + b, 0) > h) minRow = minRow.map((x) => x - 10);
  const need = headH + minRow.reduce((a, b) => a + b, 0);
  if (need > h * 1.01) issue('the table needs about ' + Math.round((need / h - 1) * 100) + ' percent more height than it has (' + cells.length + ' rows). Cut a row, shorten the cells that wrap, or move a point to the notes.');
  const extra = Math.max(0, Math.min((h - need) / Math.max(1, cells.length), o.ref ? 16 : 90));
  const usTone = fillTones(T, LX.tone)[0];
  let html = '<div class="tb-r tb-h" style="height:' + f1(headH) + 'px">' + headB.map((b, j) => '<div class="tb-c' + (j === usCol ? ' us" data-ground="--bg" data-tone="' + usTone : '') + '" style="width:' + f1(colW(j)) + 'px;padding:0 ' + padX + 'px">' + b.html + '</div>').join('') + '</div>';
  rowB.forEach((r, i) => {
    html += '<div class="tb-r' + (i === usRow ? ' usr' : '') + '" style="height:' + f1(minRow[i] + extra) + 'px">' + r.map((b, j) => '<div class="tb-c' + (j === 0 ? ' rh' : '') + (j === usCol ? ' us" data-ground="--bg" data-tone="' + usTone : '') + '" style="width:' + f1(colW(j)) + 'px;padding:0 ' + padX + 'px">' + b.html + '</div>').join('') + '</div>';
  });
  const th = Math.min(h, headH + minRow.reduce((a, b) => a + b + extra, 0));
  // the accent column is one nested tone behind the cells, so its type picks the right ink
  const band = usCol > 0 ? '<div class="tb-us" data-tone="' + usTone + '" style="left:' + f1(w0 + (usCol - 1) * wc) + 'px;width:' + f1(wc) + 'px;height:' + f1(th) + 'px"></div>' : '';
  return { h: th, need, html: '<div class="tb' + (usCol > 0 ? ' has-us' : '') + (o.ref ? ' ref' : '') + '" style="width:' + Math.round(w) + 'px;height:' + f1(th) + 'px" ">' + band + html + '</div>' };
}
// --------------------------------------------------------------------------------------
// 4d. Slide layouts
// --------------------------------------------------------------------------------------
// Three families share the stage: the mosaic (a title cell, a hero number cell and
// unequal cells for chart, diagram, points and further numbers), the colour-block split
// (text beside a full-height panel in another tone) and the full-bleed slides (cover,
// section, statement, quote, closing). Every renderer returns the inner HTML of a slide.

const BODY = () => sv(28, 25);
const SMALL = () => sv(24, 22);
const LEAD = () => sv(34, 29);
const PT_SIZES = () => (LX.variant === 'read' ? [36, 33, 30, 27, 25, 22] : [42, 38, 34, 30, 27, 24]);
const TYPE_LABEL = {
  problem: 'The problem', solution: 'The solution', product: 'Product', insight: 'Insight', market: 'Market', traction: 'Traction',
  business_model: 'Business model', go_to_market: 'Go to market', competition: 'Competition', team: 'Team', financials: 'Financials',
  ask: 'The ask', roadmap: 'Roadmap', appendix: 'Appendix', case_study: 'Case study', sources: 'Appendix', quote: 'In their words',
};
const eyebrow = (s) => (s.kicker != null && s.kicker !== '' ? s.kicker : (TYPE_LABEL[s.type] || ''));

// Points as rows: an icon, a number or a small mark, then the text. items: {text, icon, title}.
function pointList(items, w, o) {
  o = o || {};
  if (o.sizes && o.maxH) {
    // the largest size at which the list fits its height
    const was = LX.quiet; LX.quiet = true;
    let pick = o.sizes[o.sizes.length - 1];
    for (const sz of o.sizes) { const c0 = LX.count || 0; const b = pointList(items, w, Object.assign({}, o, { sizes: null, size: sz, maxH: 0 })); const ok = (LX.count || 0) === c0 && b.h <= o.maxH; LX.count = c0; if (ok) { pick = sz; break; } }
    LX.quiet = was;
    return pointList(items, w, Object.assign({}, o, { sizes: null, size: pick, maxH: 0 }));
  }
  const size = o.size || BODY();
  const hasIcon = items.some((it) => it.icon);
  const markW = o.numbered ? 58 : hasIcon ? 60 : 34;
  const padY = o.padY !== undefined ? o.padY : Math.round(size * (size <= 26 ? 0.46 : 0.6));
  let h = 0;
  const rows = items.map((it, i) => {
    const tt = it.title ? tb(it.title, { role: 'bodyb', size, w: w - markW, max: 2, what: (o.what || 'a point') + ' title' }) : null;
    const tx = tb(it.text, { role: 'body', size, w: w - markW, what: o.what || 'a point', cls: tt ? 'mut' : '' });
    const th = (tt ? tt.h + 4 : 0) + tx.h;
    const rh = Math.max(th, hasIcon ? 40 : 0) + 2 * padY;
    h += rh;
    const mark = o.numbered ? '<span class="pt-n f-mono" style="font-size:' + LX.theme.monoSize + 'px">' + two(i + 1) + '</span>' : (it.icon ? icon(it.icon, 38, 'pt-i') : (hasIcon ? icon('', 38, 'pt-i') : '<span class="pt-m"></span>'));
    return '<li style="padding:' + padY + 'px 0;min-height:' + f1(rh) + 'px"><span class="pt-k" style="width:' + markW + 'px;height:' + f1(size * 1.36) + 'px">' + mark + '</span><div class="pt-t">' + (tt ? tt.html : '') + tx.html + '</div></li>';
  });
  if (o.maxH && h > o.maxH * 1.012) issue((o.what || 'the points') + ' are overfull by about ' + Math.max(1, Math.round((h / o.maxH - 1) * 100)) + ' percent. Shorten them or cut one.');
  return { h, html: '<ul class="pts">' + rows.join('') + '</ul>' };
}
const pointItems = (s, from, to) => s.points.slice(from || 0, to).map((p, i) => Object.assign({ text: p }, (s.pmeta && s.pmeta[(from || 0) + i]) || {}));

// The blocks of one stat: numeral, label, optional delta, and its source in the read variant.
function statBlocks(st, w, sizes, o) {
  o = o || {};
  const sp = statSourceParts(st, HCTX);
  const out = [numBlock(st.value, w, sizes, { what: o.what || 'a stat value' })];
  if (st.label || sp.sup) {
    const lb = tb(st.label || '', { role: 'body', size: o.labelSize || SMALL(), w, max: o.maxLabel || 3, what: (o.what || 'a stat') + ' label', cls: 'st-l' });
    if (sp.sup) lb.html = lb.html.replace(/<\/div>$/, sp.sup + '</div>');
    out.push(lb);
  }
  if (st.delta) out.push(tb(st.delta, { role: 'bodyb', size: SMALL(), w, max: 1, what: 'a stat delta', cls: 'st-d' }));
  const srcKey = sp.text || sp.line;
  const dup = sp.line && ((LX.capText && LX.capText.indexOf(srcKey) >= 0) || (LX.statSrc && LX.statSrc.indexOf(srcKey) >= 0));
  if (sp.line && !dup && LX.statSrc && !LX.quiet) LX.statSrc.push(srcKey);
  if (sp.line && !dup) {
    const mono = LX.theme.roles.mono;
    let line = sp.line;
    if (tw(sp.text, mono, 16) > w) { const short = sp.text.split(', ').map((x) => x.replace(/^.*\//, '')).join(', '); line = tw(short, mono, 16) <= w ? esc(short) : ''; }
    if (line) out.push({ h: 23, html: '<div class="t f-mono st-s" style="font-size:16px;line-height:1.4;white-space:nowrap">' + line + '</div>' });
  }
  return out;
}
// A cell that a number owns: numeral and label at the bottom, optional icon or trend at the top.
function statCell(r, st, o) {
  o = o || {};
  if (!o.labelSize && r.h > 330 && r.w > 420) o = Object.assign({}, o, { labelSize: BODY() });
  return cell(r, { tone: o.tone, what: o.what || 'a stat cell', gap: 12, fix: 'Shorten the stat label.' }, (w, h) => {
    const top = [];
    if (o.eyebrow) top.push(label(o.eyebrow, w, {}));
    if (asArray(st.trend).length > 1) top.push(rawBlock(48, '<div class="st-tr">' + sparkSvg(asArray(st.trend), Math.min(220, Math.round(w * 0.6)), 44, true) + '</div>'));
    else if (st.icon) top.push(rawBlock(48, icon(st.icon, 44)));
    const sizes = o.sizes || ladder(Math.min(200, Math.round(r.h * 0.42)), 48);
    const topH = top.reduce((a2, b2) => a2 + b2.h + 12, 0);
    // the numeral steps down until numeral, label and what sits above them fit the cell
    let from = 0;
    const was = LX.quiet; LX.quiet = true;
    for (; from < sizes.length - 1; from++) { const c0 = LX.count || 0; const bl = statBlocks(st, w, sizes.slice(from), o); LX.count = c0; if (bl.reduce((a2, b2) => a2 + b2.h, 0) + (bl.length - 1) * 12 + topH <= h) break; }
    LX.quiet = was;
    return { top, bottom: statBlocks(st, w, sizes.slice(from), o) };
  });
}

// Title block parts: eyebrow label, headline (steps down its size ladder), subtitle and,
// in the read variant, the body paragraph.
function headParts(s, w, h, o) {
  o = o || {};
  const T = LX.theme;
  const out = [];
  const eb = o.label !== undefined ? o.label : eyebrow(s);
  if (eb) out.push(label(eb, w, { what: 'the kicker', cls: 'eb' }));
  const sub = s.subtitle && !o.noSub ? tb(s.subtitle, { role: 'body', size: o.subSize || LEAD(), lh: 1.3, w: Math.min(w, o.subW || 1320), max: 3, what: 'the subtitle', cls: 'sub', mw: true }) : null;
  const body = s.body && LX.variant === 'read' ? tb(s.body, { role: 'body', size: 25, w: Math.min(w, 1320), max: 4, what: 'the body paragraph', cls: 'bodyp', mw: true }) : null;
  const rest = (eb ? out[0].h + 18 : 0) + (sub ? sub.h + 18 : 0) + (body ? body.h + 18 : 0);
  if (s.title) out.push(tb(s.title, { role: 'display', sizes: o.sizes || ladder(T.titleSize, Math.round(T.titleSize * 0.62)), w: o.titleW || w, max: o.max || 4, maxH: h - rest, em: true, what: 'the title', cls: 'title', tag: 'h1', mw: !!o.titleW }));
  if (sub) out.push(sub);
  if (body) out.push(body);
  return out;
}

// The top band of a mosaic slide: the title cell and up to two number cells beside it.
// It takes as many grid rows as the title needs (2 to 4) and returns where the body starts.
function band(s, heroes, o) {
  o = o || {};
  const k = Math.min(2, heroes.length);
  const titleCols = k === 0 ? 12 : k === 1 ? 8 : 7;
  const plain = cs().plainPad === 0;
  let rows = k ? 3 : 2;
  for (; rows < 4; rows++) {
    const r = grid(0, 0, titleCols, rows);
    const ih = r.h - (plain ? 26 : 2 * cs().pad), iw = r.w - (plain ? 28 : 2 * cs().pad);
    const was = LX.quiet; LX.quiet = true; const before = LX.count || 0;
    const parts = headParts(s, iw, ih, o);
    LX.quiet = was;
    const used = parts.reduce((a, b) => a + b.h, 0) + (parts.length - 1) * 18;
    const clean = (LX.count || 0) === before; LX.count = before;
    if (clean && used <= ih) break;
  }
  const tr = grid(0, 0, titleCols, rows);
  let html = cell(tr, { kind: 'plain', what: 'the title block', gap: 18, padX: plain ? 0 : undefined, pad: plain ? 0 : undefined, style: plain ? 'padding-right:28px' : '', fix: 'Shorten the title or the subtitle.' },
    (w, h) => ({ top: headParts(s, plain ? w - 28 : w, plain ? h - 26 : h, o) }));
  if (k) {
    const fills = fillTones(LX.theme, LX.tone);
    const hr = grid(titleCols, 0, 12 - titleCols, rows);
    const rects = k === 1 ? [hr] : splitRect(hr, 2, 'col');
    heroes.slice(0, 2).forEach((st, i) => { html += statCell(rects[i], st, { tone: fills[i] || fills[0], what: 'the ' + (i ? 'second' : 'first') + ' stat cell', sizes: ladder(k === 1 ? 170 : 104, 48) }); });
  }
  return { html, top: rows };
}

// ---- images and frames ---------------------------------------------------------------
// An image fitted into w x h without cropping, inside a browser or phone frame when asked.
function imageBox(img, w, h, o) {
  o = o || {};
  const dims = img.file && img.file.file ? imageDims(HCTX.rasters && HCTX.rasters[img.file.file] ? HCTX.rasters[img.file.file] : img.file.file) : null;
  const ar = dims ? dims.width / dims.height : (img.frame === 'phone' ? 0.46 : 1.6);
  const frame = img.frame === 'browser' || img.frame === 'phone' ? img.frame : 'none';
  const chromeH = frame === 'browser' ? 52 : frame === 'phone' ? 28 : 0, chromeW = frame === 'phone' ? 28 : frame === 'browser' ? 4 : 0;
  const shadow = LX.theme.cell === 'card' || LX.theme.cell === 'block' ? 14 : 0;
  let iw = w - chromeW - shadow, ih = iw / ar;
  if (ih > h - chromeH - shadow) { ih = h - chromeH - shadow; iw = ih * ar; }
  const fw = iw + chromeW, fh = ih + chromeH;
  const tag = '<img src="' + esc(img.src) + '" alt="' + esc(o.alt || '') + '" style="width:' + f1(iw) + 'px;height:' + f1(ih) + 'px">';
  const inner = frame === 'browser' ? '<div class="fr-bar"><i></i><i></i><i></i><span></span></div>' + tag : frame === 'phone' ? '<div class="fr-scr">' + tag + '</div>' : tag;
  return { w: fw, h: fh, html: '<div class="fr fr-' + frame + (o.cls ? ' ' + o.cls : '') + '" style="width:' + f1(fw) + 'px;height:' + f1(fh) + 'px' + (o.style ? ';' + o.style : '') + '">' + inner + '</div>' };
}
// One or two images in a w x h area; the second overlaps the first at the lower right.
function imagesBlock(imgs, w, h, centre) {
  if (imgs.length < 2) { const b = imageBox(imgs[0], w, h, {}); return { h, html: '<div class="imgs' + (centre ? ' ctr' : '') + '" style="width:' + f1(w) + 'px;height:' + f1(h) + 'px">' + b.html + '</div>' }; }
  const a = imageBox(imgs[0], w * 0.88, h * 0.84, {});
  const b = imageBox(imgs[1], w * 0.38, h * 0.6, { cls: 'over', style: 'position:absolute;right:64px;bottom:44px' + (imgs[1].frame === 'phone' ? ';transform:rotate(5deg);transform-origin:bottom right' : '') });
  return { h, html: '<div class="imgs" style="width:' + f1(w) + 'px;height:' + f1(h) + 'px">' + a.html + b.html + '</div>' };
}

// Logo wall: wordmarks set in the display face, or image files, in a hairline strip.
function logosBlock(logos, w, h) {
  const list = logos.slice(0, 6);
  if (logos.length > 6) issue(logos.length + ' logos; 6 are drawn.');
  const cw = w / list.length;
  const html = list.map((lg) => {
    if (lg.src) return '<div class="lg-c"><img src="' + esc(lg.src) + '" alt="' + esc(lg.name || '') + '" style="max-height:' + Math.round(h * 0.46) + 'px;max-width:' + Math.round(cw - 48) + 'px"></div>';
    const b = tb(lg.name, { role: 'display', sizes: [30, 26, 22], w: cw - 36, max: 1, what: 'logo name "' + lg.name + '"' });
    return '<div class="lg-c">' + b.html + '</div>';
  }).join('');
  return { h, html: '<div class="logos" style="height:' + Math.round(h) + 'px">' + html + '</div>' };
}

// The logo: as it is on a light ground; on a dark or coloured ground it sits on a light
// chip unless meta.logo_light names a version made for dark grounds.
function logoBlock(src, h) {
  const alt = HCTX.logoLight;
  const o = LX.theme.tones[LX.tone];
  const needChip = luminance(o.bg) < 0.45 && !alt;
  if (!needChip) return rawBlock(h, '<img class="logo" src="' + esc(alt && luminance(o.bg) < 0.45 ? alt : src) + '" alt="" style="height:' + h + 'px">');
  return rawBlock(h + 28, '<div class="logo-chip"><img class="logo" src="' + esc(src) + '" alt="" style="height:' + h + 'px"></div>');
}

// The main visual of a slide, by priority: diagram, chart, image, table.
function visualOf(s) { return s.diagram ? 'diagram' : s.chart ? 'chart' : (LX.imgs && LX.imgs.length) ? 'image' : (s.rows && s.rows.length) ? 'table' : null; }
function visualBlock(s, w, h, kind) {
  if (kind === 'diagram') return diagramBlock(s.diagram, w, h);
  if (kind === 'chart') return chartBlock(s.chart, w, h, s.chart.source || s.source);
  if (kind === 'image') return imagesBlock(LX.imgs, w, h);
  if (kind === 'table') return gridTable(s.columns, s.rows, w, h, { grid: s.type === 'competition' });
  return rawBlock(0, '');
}
// A cell that holds the main visual. Charts and tables sit in a framed cell, diagrams and
// images on the open ground.
function visualCell(s, r, kind) {
  const open = kind === 'diagram' || kind === 'image' || (kind === 'table');
  const hair = LX.theme.cell === 'hairline' || LX.theme.cell === 'rule';
  return cell(r, { kind: open && !hair ? 'plain' : undefined, what: 'the ' + kind + ' cell', cls: 'vis vis-' + kind, pad: open && !hair ? 0 : undefined, slack: kind !== 'image' }, (w, h) => ({ top: [visualBlock(s, w, h, kind)] }));
}

// Side column of a mosaic: further stats as cells, then points, then sparklines.
function sideCells(s, r, stats, items, o) {
  o = o || {};
  const fills = fillTones(LX.theme, LX.tone);
  const parts = [];
  stats.forEach((st, i) => parts.push({ wt: 1, draw: (rr) => statCell(rr, st, { tone: i === 0 && o.fillFirst !== false ? (o.tone || fills[1] || fills[0]) : null, what: 'a stat cell', sizes: ladder(Math.min(120, Math.round(rr.h * 0.4)), 44) }) }));
  if (s.sparklines && s.sparklines.length && !o.noSpark) parts.push({ wt: Math.max(1, s.sparklines.length * 0.45), draw: (rr) => cell(rr, { what: 'the sparkline cell' }, (w) => ({ top: [label(s.sparkline_label || 'Trend', w, {})], bottom: [sparkRows(s.sparklines, w)] })) });
  if (items.length) parts.push({ wt: Math.max(1, items.length * 0.75), draw: (rr) => cell(rr, { what: 'the points cell', fix: 'Shorten the points, cut one, or cut a stat.' }, (w, h) => ({ mid: [pointList(items, w, { sizes: PT_SIZES().slice(1), maxH: h })] })) });
  if (!parts.length) return '';
  return splitRect(r, parts.length, 'row', parts.map((p) => p.wt)).map((rr, i) => parts[i].draw(rr)).join('');
}

// The standard mosaic body under the band: main visual (or points) and a side column.
function mosaicBody(s, top, o) {
  o = o || {};
  const rows = 8 - top;
  const kind = o.kind !== undefined ? o.kind : visualOf(s);
  const stats = o.stats || [];
  const items = o.items || [];
  const hasLogos = s.logos && s.logos.length && o.logos !== false;
  const lr = hasLogos ? 1 : 0;
  let html = '';
  const sideNeeded = kind && (stats.length || items.length || (s.sparklines && s.sparklines.length));
  const mainCols = sideNeeded ? (o.mainCols || 8) : 12;
  const mainR = grid(o.flip && sideNeeded ? 12 - mainCols : 0, top, mainCols, rows - lr);
  const sideR = sideNeeded ? grid(o.flip ? 0 : mainCols, top, 12 - mainCols, rows - lr) : null;
  if (kind) { html += visualCell(s, mainR, kind); if (sideR) html += sideCells(s, sideR, stats, items, o); }
  else {
    // no visual: the numbers own the stage, the points sit beneath them
    const R = grid(0, top, 12, rows - lr);
    const fills = fillTones(LX.theme, LX.tone);
    const statRow = (r) => splitRect(r, stats.length, 'col', stats.length === 3 ? [5, 4, 3.4] : stats.length === 2 ? [5, 4] : null).map((rr, i) => statCell(rr, stats[i], { tone: i === 0 ? (fills[1] || fills[0]) : null, sizes: ladder(Math.min(180, Math.round(rr.h * 0.42)), 48) })).join('');
    const pointsArea = (r) => (items.length <= 3 && items.length > 1 && r.h < 430
      ? cardRow(r, items, { what: 'point', fill: false, equal: true })
      : cell(r, { what: 'the points cell', slack: true, fix: 'Shorten the points or cut one.' }, (w, h) => ({ mid: [pointList(items, Math.min(w, 1400), { sizes: PT_SIZES(), maxH: h })] })));
    if (stats.length && items.length) { const [a, b] = splitRect(R, 2, 'row', [1, Math.max(0.7, Math.min(2.2, items.length * 0.55))]); html += statRow(a) + pointsArea(b); }
    else if (stats.length) html += statRow(R);
    else if (items.length) html += pointsArea(R);
    if (s.sparklines && s.sparklines.length) issue('`sparklines` need a chart, diagram or image beside them on this slide type.');
  }
  if (hasLogos) html += cell(grid(0, 7, 12, 1), { what: 'the logo strip', pad: 0, cls: 'lg-cell' }, (w, h) => ({ top: [logosBlock(s.logos, w, h)] }));
  return html;
}

// Cells across the stage, one per item, the first one filled: hero facts, steps, pillars.
function cardRow(r, items, o) {
  o = o || {};
  const n = items.length;
  if (!n) return '';
  const fills = fillTones(LX.theme, LX.tone);
  const weights = o.equal || n < 3 ? null : (n === 3 ? [5, 4, 3.4] : [4, 3.2, 3.2, 3]);
  const rects = splitRect(r, n, 'col', weights);
  const draw = (tSizes, bSizes, sink) => rects.map((rr, i) => cell(rr, { tone: i === (o.fillAt || 0) && o.fill !== false ? fills[0] : (i === 1 && o.second ? fills[1] : null), what: (o.what || 'a card') + ' ' + (i + 1), fix: 'Shorten it.' }, (w, h) => {
    const it = items[i];
    const top = [it.icon ? rawBlock(52, icon(it.icon, 48)) : tb(two(i + 1), { role: 'num', size: 44, lh: 1, w, max: 1, cls: 'idx' })];
    const bottom = [];
    const title = it.title ? tb(it.title, { role: 'display', sizes: tSizes, w, max: 2, what: (o.what || 'a card') + ' title' }) : null;
    if (title) bottom.push(title);
    const body = tb(it.text, { role: 'body', sizes: bSizes, w, maxH: h - 76 - (title ? title.h + 18 : 0), what: (o.what || 'a card') + ' ' + (i + 1) });
    bottom.push(body);
    if (sink) sink.push({ t: title ? title.size : 999, b: body.size });
    return { top, bottom, over: o.arrows && i < n - 1 ? '<span class="arr">' + icon('arrow-right', 34) + '</span>' : '' };
  })).join('');
  // first every card alone, then all of them at the smallest sizes any card needed
  const got = [];
  const was = LX.quiet; LX.quiet = true; const c0 = LX.count || 0;
  draw([44, 40, 36, 32, 28], o.size ? [o.size] : PT_SIZES(), got);
  LX.count = c0; LX.quiet = was;
  return draw([Math.min(...got.map((g) => g.t))], [Math.min(...got.map((g) => g.b))]);
}

// Colour-block split: text on the slide's ground, a full-height panel in another tone.
function splitSlide(s, o) {
  const T = LX.theme;
  const fills = fillTones(T, LX.tone);
  const PW = o.wide ? 860 : 740;
  const left = o.side === 'left';
  const panelR = { x: left ? 0 : STAGE_W - PW, y: 0, w: PW, h: STAGE_H };
  const textR = { x: left ? PW + 72 : FRAME.x, y: FRAME.y, w: STAGE_W - PW - 72 - FRAME.x, h: FRAME.h };
  const tone = o.tone || fills[0];
  let html = cell(panelR, { kind: 'bleed', tone, what: 'the panel', pad: 96, padX: 72, gap: 28, fix: o.fix || 'Shorten the panel content.' }, (w, h) => o.panel(w, h));
  LX.panel = { side: left ? 'left' : 'right', tone };
  LX.panelW = PW;
  html += cell(textR, { kind: 'plain', pad: 0, what: 'the text column', gap: 22, fix: 'Shorten the title or the points, or cut a point.' }, (w, h) => {
    if (!o.bottom) {
      // nothing under the title: set it large and anchor it to the bottom, like a poster
      const parts = headParts(s, w, h - 60, { label: '', sizes: ladder(Math.round(T.titleSize * 1.7), Math.round(T.titleSize * 0.7)), max: 6 });
      return { top: [label(eyebrow(s), w, { cls: 'eb' })], bottom: parts };
    }
    const top = headParts(s, w, h * 0.6, { sizes: ladder(Math.round(T.titleSize * 1.45), Math.round(T.titleSize * 0.66)), max: 5 });
    const used = top.reduce((a2, b2) => a2 + b2.h, 0) + (top.length - 1) * 22;
    return { top, bottom: o.bottom(w, h - used - 48) };
  });
  return html;
}
// Numbered points for a panel: big index, then the text.
function panelPoints(items, w, h, size) {
  const n = items.length;
  if (!size) {
    const was = LX.quiet; LX.quiet = true;
    size = PT_SIZES().find((sz) => panelPoints(items, w, h, sz).h <= h) || PT_SIZES()[PT_SIZES().length - 1];
    LX.quiet = was;
  }
  const rows = items.map((it, i) => {
    const idx = tb(two(i + 1), { role: 'num', size: 64, lh: 0.9, w: 110, max: 1, cls: 'idx' });
    const tt = it.title ? tb(it.title, { role: 'bodyb', size, w: w - 120, max: 2, what: 'a point title' }) : null;
    const tx = tb(it.text, { role: 'body', size, w: w - 120, what: 'a point' });
    const rh = Math.max(64, (tt ? tt.h + 4 : 0) + tx.h);
    return { h: rh, html: '<div class="pp" style="min-height:' + f1(rh) + 'px"><div style="width:120px;flex:none">' + idx.html + '</div><div>' + (tt ? tt.html : '') + tx.html + '</div></div>' };
  });
  const h0 = rows.reduce((a, b) => a + b.h, 0) + (n - 1) * 57;
  return { h: h0, html: '<div class="pps">' + rows.map((r) => r.html).join('<hr class="hr">') + '</div>' };
}
// What a split panel shows: the diagram, the image, the stats, or the points as numbers.
function panelFor(s, o) {
  o = o || {};
  return (w, h) => {
    if (s.diagram) return { mid: [diagramBlock(s.diagram, w, h)] };
    if (LX.imgs && LX.imgs.length) {
      const stats = s.stats.slice(0, 2);
      const sh = stats.length ? 190 : 0;
      const parts = { top: [imagesBlock(LX.imgs, w, h - sh - (sh ? 28 : 0))] };
      if (stats.length) parts.bottom = [rawBlock(sh, '<div class="hs" style="height:' + sh + 'px">' + stats.map((st) => '<div style="flex:1;min-width:0">' + vs(statBlocks(st, (w - 40 * (stats.length - 1)) / stats.length, ladder(88, 44), { maxLabel: 2 }), 10).html + '</div>').join('') + '</div>')];
      return parts;
    }
    if (s.stats.length) {
      const stats = s.stats.slice(0, o.maxStats || 2);
      const blocks = [];
      stats.forEach((st, i) => {
        if (i) blocks.push(rawBlock(1, '<hr class="hr">'));
        blocks.push(vs(statBlocks(st, w, i === 0 && stats.length < 3 ? ladder(250, 72) : ladder(stats.length > 2 ? 112 : 150, 56), { labelSize: i === 0 ? BODY() : SMALL(), what: 'a stat' }), 14));
      });
      return { bottom: blocks };
    }
    return { mid: [panelPoints(pointItems(s), w, h)] };
  };
}

// Use of funds: a donut with the largest share in the hole and the buckets beside it.
function fundsBlock(funds, w) {
  const list = funds.slice(0, 5);
  if (funds.length > 5) issue(funds.length + ' use-of-funds buckets; 5 are drawn. Merge the smallest.');
  const stacked = w < 760;
  const D = stacked ? Math.min(460, w * 0.78) : Math.min(380, w * 0.5);
  const lw = stacked ? w : w - D - 44;
  // the legend is set as large as its labels allow (two lines each, three at the smallest size)
  const fitsAt = (sz, lines) => list.every((f) => wrapText(f.label, LX.theme.roles.body, sz, (lw - 30 - 96) * WRAP_SAFETY - 1).lines <= lines);
  const size = [sv(32, 28), sv(28, 25)].find((sz) => fitsAt(sz, 2)) || SMALL();
  const rows = list.map((f, i) => {
    const b = tb(f.label, { role: 'body', size, w: lw - 30 - 96, max: size === SMALL() ? 3 : 2, what: 'use-of-funds label "' + String(f.label).slice(0, 20) + '"' });
    return { h: b.h, html: '<div class="fd-r" style="min-height:' + f1(b.h) + 'px"><i style="background:' + DONUT_COLORS[i % 5] + '"></i>' + b.html + '<b class="t f-bodyb" style="font-size:' + size + 'px;line-height:1.36">' + esc(fmtNum(Number(f.pct) || 0)) + '%</b></div>' };
  });
  const lh = rows.reduce((a, b) => a + b.h, 0) + (rows.length - 1) * 14;
  const fh = stacked ? D + 40 + lh : Math.max(D, lh);
  return { h: fh, html: '<div class="funds' + (stacked ? ' stk' : '') + '" style="min-height:' + f1(fh) + 'px">' + donutSvg(list, Math.round(D)) + '<div class="fd-l" style="width:' + f1(lw) + 'px;gap:14px">' + rows.map((r) => r.html).join('') + '</div></div>' };
}

// Milestones as rows: a date in the display face, then what will be true.
function milestoneRows(ms, w, o) {
  o = o || {};
  if (o.sizes && o.maxH) {
    const was = LX.quiet; LX.quiet = true;
    let pick = o.sizes[o.sizes.length - 1];
    for (const sz of o.sizes) { const c0 = LX.count || 0; const b = milestoneRows(ms, w, { size: sz }); const ok = (LX.count || 0) === c0 && b.h <= o.maxH; LX.count = c0; if (ok) { pick = sz; break; } }
    LX.quiet = was;
    return milestoneRows(ms, w, { size: pick });
  }
  const size = o.size || SMALL();
  const padY = Math.round(size * 0.55);
  const rows = ms.map((m, i) => {
    const it = typeof m === 'string' ? { what: m } : (m || {});
    const whenW = it.when ? Math.min(w * 0.32, Math.max(150, tw(it.when, LX.theme.roles.bodyb, size) + 36)) : 0;
    const when = it.when ? tb(it.when, { role: 'bodyb', size, w: whenW - 16, max: 2, what: 'milestone ' + (i + 1) + ' date', cls: 'ms-w' }) : null;
    const what = tb([it.what, it.proves].filter(Boolean).join('. '), { role: 'body', size, w: w - whenW - 34, what: 'milestone ' + (i + 1) });
    const rh = Math.max(what.h, when ? when.h : 0) + 2 * padY;
    return { h: rh, html: '<li style="min-height:' + f1(rh) + 'px;padding:' + padY + 'px 0"><span class="ms-d" style="top:' + f1(padY + size * 0.68 - 7) + 'px"></span>' + (when ? '<div style="width:' + f1(whenW) + 'px;flex:none">' + when.html + '</div>' : '') + '<div>' + what.html + '</div></li>' };
  });
  return { h: rows.reduce((a, b) => a + b.h, 0), html: '<ul class="ms">' + rows.map((r) => r.html).join('') + '</ul>' };
}

// Decoration for cover and section slides: the theme's signature, kept clear of the text.
function decorHtml(zone, seedText) {
  const T = LX.theme;
  const fills = fillTones(T, LX.tone);
  const z = zone;
  const box = (x, y, w, h, tone, extra) => '<div class="dc" ' + (tone ? 'data-tone="' + tone + '" ' : '') + 'style="left:' + f1(x) + 'px;top:' + f1(y) + 'px;width:' + f1(w) + 'px;height:' + f1(h) + 'px' + (extra ? ';' + extra : '') + '"></div>';
  if (T.decor === 'blocks') return box(z.x, 0, z.w, z.h * 0.42, fills[0]) + box(z.x, z.h * 0.42, z.w * 0.5, z.h * 0.58, fills[1] || fills[0]) + box(z.x + z.w * 0.5, z.h * 0.42, z.w * 0.5, z.h * 0.58, fills[2] || null, fills[2] ? '' : 'background:var(--accent-2)');
  if (T.decor === 'shapes') return '<div class="dc shape" style="left:' + f1(z.x + z.w * 0.1) + 'px;top:-190px;width:680px;height:680px;border-radius:50%;background:' + T.tones[fills[1] || fills[0]].bg + '"></div>' +
    '<div class="dc shape" style="left:' + f1(z.x - 40) + 'px;top:' + f1(z.h - 330) + 'px;width:400px;height:400px;border-radius:64px;transform:rotate(-12deg);background:var(--accent-2)"></div>';
  if (T.decor === 'mosaic') {
    const g = splitRect({ x: z.x, y: FRAME.y, w: STAGE_W - z.x - FRAME.x, h: FRAME.h }, 3, 'row', [3, 2, 3]);
    const a = splitRect(g[0], 2, 'col', [2, 3]), b = splitRect(g[2], 2, 'col', [3, 2]);
    const c = (r, tone) => '<div class="cell' + (tone ? ' filled' : '') + '" ' + (tone ? 'data-tone="' + tone + '" ' : '') + 'style="left:' + f1(r.x) + 'px;top:' + f1(r.y) + 'px;width:' + f1(r.w + 1) + 'px;height:' + f1(r.h + 1) + 'px"></div>';
    return c(a[0]) + c(a[1], fills[0]) + c(g[1]) + c(b[0], fills[1]) + c(b[1]);
  }
  // an oversized, cropped initial as texture (outline, never behind text)
  const ch = esc(String(seedText || '').trim().charAt(0).toUpperCase() || '1');
  return '<div class="dc ghost f-num" aria-hidden="true" style="left:' + f1(z.x + z.w * 0.08) + 'px;top:' + f1(z.h * 0.16) + 'px;font-size:' + Math.round(z.h * 0.98) + 'px">' + ch + '</div>';
}

// ---- slide renderers -----------------------------------------------------------------
const RENDER = {
  cover(s) {
    const T = LX.theme, meta = HCTX.meta;
    const fills = fillTones(T, LX.tone);
    const stats = s.stats.slice(0, 3);
    if (s.stats.length > 3) issue(s.stats.length + ' cover stats; 3 are drawn.');
    const PW = 640;
    const textW = STAGE_W - PW - FRAME.x - 60;
    let html = stats.length
      ? cell({ x: STAGE_W - PW, y: 0, w: PW, h: STAGE_H }, { kind: 'bleed', tone: fills[0], pad: 96, padX: 72, gap: 34, what: 'the cover stats panel' }, (w) => {
        const blocks = [];
        stats.forEach((st, i) => { if (i) blocks.push(rawBlock(1, '<hr class="hr">')); blocks.push(vs(statBlocks(st, w, ladder(124, 56), { maxLabel: 2, what: 'a cover stat' }), 12)); });
        return { bottom: blocks };
      })
      : decorHtml({ x: STAGE_W - PW, y: 0, w: PW, h: STAGE_H }, s.title || meta.company);
    const logo = LX.imgs && LX.imgs.length ? LX.imgs[0].src : HCTX.logo;
    if (stats.length) { LX.panel = { side: 'right', tone: fills[0] }; LX.panelW = PW; }
    html += cell({ x: FRAME.x, y: FRAME.y, w: textW, h: FRAME.h }, { kind: 'plain', pad: 0, gap: 30, what: 'the cover text', fix: 'Shorten the title or the subtitle.' }, (w, h) => {
      const top = [];
      if (logo) top.push(logoBlock(logo, 72));
      if (s.kicker) top.push(label(s.kicker, w, { what: 'the kicker', cls: 'eb' }));
      const bottom = [tb(s.title || meta.company, { role: 'display', sizes: ladder(Math.min(300, Math.round(T.bigSize * 1.9)), 72), lh: T.bigLh, w, max: 3, maxH: h * 0.56, em: true, what: 'the cover title', cls: 'title big', tag: 'h1' })];
      const sub = s.subtitle || meta.tagline;
      if (sub) bottom.push(tb(sub, { role: 'body', size: sv(42, 38), lh: 1.24, w: Math.min(w, 1080), max: 3, what: 'the cover subtitle', cls: 'sub', mw: true }));
      return { top, bottom };
    });
    return html;
  },

  section(s) {
    const T = LX.theme;
    const mine = T.tones[LX.tone];
    const tone = fillTones(T, LX.tone).find((t) => contrast(mine.ink, T.tones[t].bg) >= 3) || null;
    const PW = 640;
    let html = '<div class="dc" ' + (tone ? 'data-tone="' + tone + '"' : '') + ' style="left:0;top:0;width:' + PW + 'px;height:' + STAGE_H + 'px' + (tone ? '' : ';background:var(--surface)') + '"></div>';
    if (tone) { LX.panel = { side: 'left', tone }; LX.panelW = PW; }
    const numTxt = String(s.number != null ? s.number : two(s.sectionNo || 1));
    // the numeral crosses the seam of the colour block and stops short of the title column
    const numSize = Math.min(700, Math.floor(700 / Math.max(1, tw(numTxt, T.roles.num, 1))));
    html += '<div class="sec-n f-num" aria-hidden="true" style="left:44px;top:' + f1(150) + 'px;font-size:' + numSize + 'px">' + esc(numTxt) + '</div>';
    html += cell({ x: PW + 170, y: FRAME.y, w: STAGE_W - PW - 170 - FRAME.x, h: FRAME.h }, { kind: 'plain', pad: 0, gap: 28, what: 'the section title', fix: 'Shorten the section title.' }, (w, h) => ({
      top: [label(s.kicker || 'Section ' + numTxt, w, { cls: 'eb' })],
      bottom: [tb(s.title, { role: 'display', sizes: ladder(Math.round(T.bigSize * 0.78), 56), lh: T.bigLh, w, max: 4, maxH: h * 0.6, em: true, what: 'the section title', cls: 'title big', tag: 'h1' })]
        .concat(s.subtitle ? [tb(s.subtitle, { role: 'body', size: LEAD(), lh: 1.3, w, max: 3, what: 'the subtitle', cls: 'sub' })] : []),
    }));
    return html;
  },

  statement(s) {
    const T = LX.theme;
    const badge = s.unknownType ? '<div class="warn-badge">Unknown slide type "' + esc(s.unknownType) + '", shown as statement</div>' : '';
    const pts = pointItems(s).slice(0, 3);
    const stripH = pts.length ? 210 : 0;
    let html = badge + cell({ x: FRAME.x, y: FRAME.y, w: FRAME.w, h: FRAME.h - stripH }, { kind: 'plain', pad: 0, gap: 34, what: 'the statement', fix: 'Shorten the statement.' }, (w, h) => {
      const top = s.kicker ? [label(s.kicker, w, { cls: 'eb', what: 'the kicker' })] : [];
      const sub = s.subtitle ? tb(s.subtitle, { role: 'body', size: sv(38, 34), lh: 1.28, w: Math.min(w, 1400), max: 3, what: 'the subtitle', cls: 'sub', mw: true }) : null;
      const body = s.body && LX.variant === 'read' ? tb(s.body, { role: 'body', size: 25, w: Math.min(w, 1320), max: 4, what: 'the body paragraph', cls: 'bodyp', mw: true }) : null;
      const title = tb(s.title, { role: 'display', sizes: ladder(T.bigSize, 60), lh: T.bigLh, w: Math.min(w, 1700), max: 5, maxH: h - (top.length ? 60 : 0) - (sub ? sub.h + 34 : 0) - (body ? body.h + 34 : 0), em: true, what: 'the statement', cls: 'title big', tag: 'h1' });
      return { top, bottom: [title, sub, body] };
    });
    if (pts.length) html += splitRect({ x: FRAME.x, y: FRAME.y + FRAME.h - stripH + 30, w: FRAME.w, h: stripH - 30 }, pts.length, 'col').map((r, i) => cell(r, { kind: 'plain', pad: 0, cls: 'strip', what: 'statement point ' + (i + 1), style: 'padding-top:22px;padding-right:32px' }, (w, h) => ({ top: [tb(pts[i].text, { role: 'body', size: BODY(), w: w - 32, maxH: h - 22, what: 'statement point ' + (i + 1) })] }))).join('');
    return html;
  },

  quote(s) {
    const T = LX.theme;
    const fills = fillTones(T, LX.tone);
    const st = s.stat || s.stats[0];
    const tw0 = st ? 1150 : 1560;
    let html = cell({ x: FRAME.x, y: FRAME.y, w: tw0, h: FRAME.h }, { kind: 'plain', pad: 0, gap: 36, what: 'the quote', fix: 'Shorten the quote.' }, (w, h) => {
      const who = [s.by || s.name, s.role].filter(Boolean);
      const photo = LX.imgs && LX.imgs.length ? LX.imgs[0].src : null;
      // a picture only when there is a photo: `by` is often a role, and its first letter is not a monogram
      const av = photo ? '<img class="q-av" src="' + esc(photo) + '" alt="">' : '<span class="q-bar"></span>';
      const aw = photo ? 150 : 34;
      const name = tb(s.by || s.name || '', { role: 'bodyb', size: sv(34, 30), w: w - aw, max: 1, what: 'the quote attribution' });
      const role = s.role ? label(s.role, w - aw, { max: 2, what: 'the quote role', cls: 'eb' }) : null;
      const foot = who.length ? rawBlock(Math.max(photo ? 112 : 0, name.h + (role ? role.h + 8 : 0)), '<div class="q-by">' + av + '<div class="vs" style="gap:8px">' + name.html + (role ? role.html : '') + '</div></div>') : null;
      const markH = 150;
      // the quote is the picture: as large as the stage allows
      const q = tb(s.quote || s.title, { role: 'display', sizes: ladder(Math.round(T.bigSize * 0.8), Math.round(T.titleSize * 0.6)), lh: Math.min(1.12, T.titleLh + 0.04), w, max: 7, maxH: h - 70 - markH - 36 * 3 - (foot ? foot.h : 0), em: true, what: 'the quote', cls: 'title q-t', tag: 'blockquote' });
      return { top: [label(eyebrow(s), w, { cls: 'eb' })], mid: [rawBlock(markH, '<div class="q-m f-em" aria-hidden="true" style="height:' + markH + 'px">\u201c</div>'), q, foot] };
    });
    if (st) html += statCell(grid(8, 1, 4, 6), st, { tone: fills[0], what: 'the quote metric', sizes: ladder(200, 56), labelSize: BODY() });
    return html;
  },

  problem(s) {
    const hasPanelStuff = s.diagram || (LX.imgs && LX.imgs.length) || s.stats.length;
    return splitSlide(s, { panel: panelFor(s), bottom: hasPanelStuff && s.points.length ? (w, h) => [pointList(pointItems(s), w, { sizes: PT_SIZES(), maxH: h })] : null });
  },
  solution(s) {
    const hasPanelStuff = s.diagram || (LX.imgs && LX.imgs.length) || s.stats.length;
    return splitSlide(s, { side: 'left', wide: !!(s.diagram || (LX.imgs && LX.imgs.length)), tone: fillTones(LX.theme, LX.tone)[1], panel: panelFor(s), bottom: hasPanelStuff && s.points.length ? (w, h) => [pointList(pointItems(s), w, { sizes: PT_SIZES(), maxH: h })] : null });
  },

  product(s) {
    const b = band(s, s.stats.slice(0, 1));
    const kind = visualOf(s);
    if (kind) {
      const im = kind === 'image' && LX.imgs[0].file && LX.imgs[0].file.file ? imageDims(LX.imgs[0].file.file) : null;
      const portrait = kind === 'image' && LX.imgs.length === 1 && (LX.imgs[0].frame === 'phone' || (im && im.width / im.height < 0.9));
      // a portrait screen gets a full-height panel of its own
      if (portrait && s.stats.length) issue('`stats` are not drawn on a product slide with a tall image: the image takes the panel.');
      if (portrait) return splitSlide(s, { side: 'left', tone: fillTones(LX.theme, LX.tone)[1] || fillTones(LX.theme, LX.tone)[0], panel: (w, h) => ({ mid: [imagesBlock(LX.imgs, w, h, true)] }), bottom: s.points.length ? (w, h) => [pointList(pointItems(s), w, { sizes: PT_SIZES(), maxH: h })] : null });
      return b.html + mosaicBody(s, b.top, { kind, items: pointItems(s), mainCols: 8 });
    }
    return b.html + cardRow(grid(0, b.top, 12, 8 - b.top), pointItems(s).slice(0, 4), { what: 'product point', equal: true });
  },

  insight(s) {
    const T = LX.theme;
    const fills = fillTones(T, LX.tone);
    const st = s.stats[0];
    const pts = pointItems(s).slice(0, 3);
    const kind = visualOf(s);
    if (kind) { const b = band(s, st ? [st] : []); return b.html + mosaicBody(s, b.top, { kind, items: pointItems(s) }); }
    const rows = pts.length ? 5 : 8;
    let html = cell(grid(0, 0, st ? 8 : 12, rows), { kind: cs().plainPad === 0 ? 'plain' : undefined, what: 'the insight', gap: 22, style: cs().plainPad === 0 ? 'padding-right:40px;padding-bottom:26px' : '', fix: 'Shorten the title.' }, (w, h) => ({
      top: [label(eyebrow(s), w, { cls: 'eb' })],
      bottom: headParts(s, w - 40, h - 60, { label: '', sizes: ladder(Math.round(T.titleSize * 1.34), Math.round(T.titleSize * 0.7)), max: 6 }),
    }));
    if (st) html += statCell(grid(8, 0, 4, rows), st, { tone: fills[0], what: 'the stat cell', sizes: ladder(190, 56) });
    if (pts.length) html += cardRow(grid(0, 5, 12, 3), pts, { what: 'insight point', fill: false, equal: true });
    return html;
  },

  market(s) {
    const b = band(s, []);
    const auto = !s.diagram && (s.stats.length === 3 || s.stats.length === 2) ? { kind: 'market', rings: s.stats.map((st) => ({ value: st.value, label: st.label })) } : null;
    if (auto || s.diagram) {
      const d = s.diagram || auto;
      const items = pointItems(s).slice(0, 2);
      const R = grid(0, b.top, 12, 8 - b.top);
      const plain = cs().plainPad === 0;
      const was = LX.quiet; LX.quiet = true;
      const noteH = items.length ? pointList(items, R.w - 2 * cs().pad, { size: SMALL(), padY: 10 }).h + 2 * (plain ? 0 : 26) + (plain ? 18 : 0) : 0;
      LX.quiet = was;
      const dr = { x: R.x, y: R.y, w: R.w, h: R.h - (noteH ? noteH + cs().gap : 0) };
      let html = b.html + cell(dr, { kind: plain ? 'plain' : undefined, what: 'the market diagram', pad: plain ? 0 : undefined, slack: true }, (w, h) => ({ top: [diagramBlock(d, w, h)] }));
      if (items.length) html += cell({ x: R.x, y: dr.y + dr.h + cs().gap, w: R.w, h: noteH }, { kind: plain ? 'plain' : undefined, pad: plain ? 0 : 26, what: 'the notes under the market diagram', fix: 'Shorten the notes.' }, (w) => ({ bottom: [pointList(items, w, { size: SMALL(), padY: 10 })] }));
      return html;
    }
    const b2 = band(s, s.stats.slice(0, 1));
    return b2.html + mosaicBody(s, b2.top, { stats: s.stats.slice(1), items: pointItems(s) });
  },

  traction(s) {
    const kind = visualOf(s);
    const b = band(s, s.stats.slice(0, 1));
    return b.html + mosaicBody(s, b.top, { kind, stats: s.stats.slice(1), items: pointItems(s) });
  },
  case_study(s) { return RENDER.traction(s); },

  business_model(s) {
    const kind = visualOf(s);
    if (kind === 'table') { const b = band(s, []); return b.html + tableBody(s, b.top); }
    const b = band(s, s.stats.slice(0, 1));
    const rest = s.stats.slice(1);
    if (kind || s.points.length) return b.html + mosaicBody(s, b.top, { kind, stats: rest, items: pointItems(s) });
    // numbers only: unequal cells across the stage
    return b.html + (rest.length ? splitRect(grid(0, b.top, 12, 8 - b.top), rest.length, 'col', rest.length === 3 ? [5, 4, 3.4] : null).map((r, i) => statCell(r, rest[i], { tone: i === 1 ? fillTones(LX.theme, LX.tone)[1] : null, sizes: ladder(150, 56) })).join('') : '');
  },

  go_to_market(s) {
    const kind = visualOf(s);
    const b = band(s, s.stats.slice(0, 2));
    if (kind) return b.html + mosaicBody(s, b.top, { kind, items: pointItems(s) });
    return b.html + cardRow(grid(0, b.top, 12, 8 - b.top), pointItems(s).slice(0, 4), { what: 'go-to-market step', arrows: true, equal: true, fillAt: Math.min(3, s.points.length) - 1 });
  },

  competition(s) {
    const b = band(s, []);
    if (s.diagram) return b.html + mosaicBody(s, b.top, { kind: 'diagram', items: pointItems(s), mainCols: 7 });
    return b.html + tableBody(s, b.top);
  },

  team(s) {
    const b = band(s, []);
    const T = LX.theme;
    const people = s.team.slice(0, 4);
    if (s.team.length > 4) issue(s.team.length + ' people on the team slide; 4 are drawn. Keep founders and key hires.');
    const pt = s.points[0];
    const ph = pt ? 84 : 0;
    const area = grid(0, b.top, 12, 8 - b.top);
    area.h -= ph;
    const swatch = ['var(--accent)', 'var(--c2)', 'var(--ink)', 'var(--fill)'];
    const swInk = ['var(--on-accent)', 'var(--on-c2)', 'var(--bg)', 'var(--ink)'];
    const beside = people.length <= 2;      // one or two people: picture left, words beside it
    // two passes: the first measures every tile's words, so all pictures get the same height
    let common = Infinity;
    const tiles = (pass) => splitRect(area, people.length, 'col').map((r, i) => {
      const pad = cs().pad;
      const sideW = beside ? Math.round(Math.min(r.h, r.w * 0.42)) : 0;
      let bandH = 0;
      const inner = cell(r, { what: 'team member ' + (i + 1), gap: 12, cls: 'tm', style: beside ? 'padding-left:' + (sideW + pad) + 'px' : '', fix: 'Shorten the proof line.' }, (w0, h) => {
        const m = people[i] || {};
        const w = beside ? w0 - sideW : w0;
        const name = tb(m.name || '', { role: 'display', sizes: beside ? [64, 56, 48, 40, 34] : [48, 44, 40, 36, 32, 28], w, max: 2, what: 'a team member name' });
        const role = m.role ? label(m.role, w, { max: 2, what: 'a team member role', cls: 'eb' }) : null;
        const minBand = beside ? 0 : Math.round(h * 0.34);
        const bio = m.bio ? tb(m.bio, { role: 'body', sizes: PT_SIZES(), w, maxH: h - minBand - name.h - (role ? role.h + 12 : 0) - 40, what: 'the proof line of ' + (m.name || 'a team member') }) : null;
        const textH = name.h + (role ? role.h + 12 : 0) + (bio ? bio.h + 12 + 6 : 0);
        bandH = beside ? r.h : Math.round(r.h - pad - textH - 30);
        if (pass === 1) common = Math.min(common, bandH); else if (!beside) bandH = common;
        return beside ? { top: [role], bottom: [name, bio ? gapBlock(6) : null, bio] } : { top: [rawBlock(bandH - pad, '<div style="height:' + (bandH - pad) + 'px"></div>'), name, role, bio ? gapBlock(6) : null, bio] };
      });
      const m = people[i] || {};
      const photo = LX.teamPhotos && LX.teamPhotos[i];
      const init = String(m.name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x.charAt(0).toUpperCase()).join('');
      const bw = beside ? sideW : r.w, bh = bandH;
      const fs = Math.round(Math.min(bh * 0.62, bw * 0.5));
      const band = '<div class="tm-b f-num" data-ground="' + ['--accent', '--c2', '--ink', '--fill'][i % 4] + '" style="left:0;top:0;' + (beside ? 'bottom:0;width:' + f1(bw) + 'px' : 'right:0;height:' + f1(bh) + 'px') + ';background:' + swatch[i % 4] + ';color:' + swInk[i % 4] + ';font-size:' + fs + 'px">' +
        (photo ? '<img src="' + esc(photo) + '" alt="' + esc(m.name || '') + '">' : '<span aria-hidden="true">' + esc(init) + '</span>') + '</div>';
      return inner.replace(/(<div class="cell[^>]*>)/, '$1' + band);
    }).join('');
    let html = '';
    if (people.length) { const was = LX.quiet; LX.quiet = true; const c0 = LX.count || 0; tiles(1); LX.count = c0; LX.quiet = was; html = tiles(2); }
    if (pt) html += cell({ x: area.x, y: area.y + area.h + 20, w: area.w, h: ph - 20 }, { kind: 'plain', pad: 0, what: 'the point under the team' }, (w) => ({ mid: [pointList([Object.assign({ text: pt }, (s.pmeta && s.pmeta[0]) || {})], w, { padY: 0 })] }));
    return b.html + html;
  },

  financials(s) {
    const kind = visualOf(s);
    if (kind === 'table') { const b = band(s, []); return b.html + tableBody(s, b.top); }
    const b = band(s, s.stats.slice(0, 1));
    return b.html + mosaicBody(s, b.top, { kind, stats: s.stats.slice(1), items: pointItems(s), flip: true });
  },

  ask(s) {
    const ms = s.milestones.slice(0, 4);
    if (s.milestones.length > 4) issue(s.milestones.length + ' milestones on the ask; 4 are drawn.');
    return splitSlide(s, {
      panel: (w, h) => {
        if (s.diagram) return { mid: [diagramBlock(s.diagram, w, h)] };
        if (s.use_of_funds.length) return { top: [label(s.funds_label || 'Use of funds', w, {})], bottom: [fundsBlock(s.use_of_funds, w)] };
        return panelFor(s, { maxStats: 3 })(w, h);
      },
      fix: 'Shorten the use-of-funds labels or the stat labels.',
      bottom: (w, h) => (ms.length ? [label(s.milestones_label || 'What it buys', w, {}), milestoneRows(ms, w, { sizes: PT_SIZES().slice(1), maxH: h - 50 - (s.points.length ? 70 : 0) })].concat(s.milestones.length && s.points.length ? [pointList(pointItems(s).slice(0, 1), w, { size: SMALL(), padY: 6 })] : []) : (s.points.length ? [pointList(pointItems(s), w, { sizes: PT_SIZES(), maxH: h })] : [])),
    });
  },

  roadmap(s) {
    const b = band(s, []);
    const pt = s.points[0];
    const ph = pt ? 84 : 0;
    const area = grid(0, b.top, 12, 8 - b.top);
    area.h -= ph;
    const d = s.diagram || { kind: 'timeline', items: s.milestones.slice(0, 6), today: s.today };
    if (!s.diagram && s.milestones.length > 6) issue(s.milestones.length + ' milestones; 6 are drawn.');
    let html = b.html + cell(area, { what: 'the roadmap', kind: 'plain', pad: 0, slack: true }, (w, h) => ({ top: [diagramBlock(d, w, h)] }));
    if (pt) html += cell({ x: area.x, y: area.y + area.h + 20, w: area.w, h: ph - 20 }, { kind: 'plain', pad: 0, what: 'the point under the roadmap' }, (w) => ({ mid: [pointList([Object.assign({ text: pt }, (s.pmeta && s.pmeta[0]) || {})], w, { padY: 0 })] }));
    return html;
  },

  closing(s) {
    const T = LX.theme;
    const pts = pointItems(s).slice(0, 3);
    const hasLogos = s.logos && s.logos.length;
    const rows = pts.length ? 5 : 8;
    const logo = HCTX.logo;
    let html = cell(grid(0, 0, 12, rows - (hasLogos && !pts.length ? 1 : 0)), { kind: 'plain', pad: 0, gap: 28, what: 'the closing title', style: 'padding-bottom:30px', fix: 'Shorten the closing line.' }, (w, h) => {
      const top = [];
      if (logo) top.push(logoBlock(logo, 60));
      else if (s.kicker) top.push(label(s.kicker, w, { cls: 'eb' }));
      const sub = s.subtitle ? tb(s.subtitle, { role: 'mono', size: sv(24, 22), lh: 1.3, w, max: 2, what: 'the contact line', cls: 'lbl contact' }) : null;
      const title = tb(s.title, { role: 'display', sizes: ladder(Math.round(T.bigSize * 0.86), 56), lh: T.bigLh, w: Math.min(w, 1700), max: 4, maxH: h - 30 - (top.length ? 100 : 0) - (sub ? sub.h + 28 : 0), em: true, what: 'the closing title', cls: 'title big', tag: 'h1' });
      return { top, bottom: [title, sub] };
    });
    if (pts.length) html += cardRow(grid(0, 5, 12, hasLogos ? 2 : 3), pts, { what: 'closing point' });
    if (hasLogos) html += cell(grid(0, 7, 12, 1), { what: 'the logo strip', pad: 0, cls: 'lg-cell' }, (w, h) => ({ top: [logosBlock(s.logos, w, h)] }));
    return html;
  },

  appendix(s) {
    const kind = visualOf(s);
    if (kind === 'table') { const b = band(s, []); return b.html + tableBody(s, b.top); }
    const b = band(s, kind ? [] : s.stats.slice(0, 1));
    if (kind) return b.html + mosaicBody(s, b.top, { kind, stats: s.stats.slice(0, 2), items: pointItems(s), flip: kind === 'chart' });
    return b.html + mosaicBody(s, b.top, { stats: s.stats.slice(1), items: pointItems(s) });
  },

  two_column(s) {
    const b = band(s, []);
    const fills = fillTones(LX.theme, LX.tone);
    const cols = s.columns.slice(0, 2).map((c) => (typeof c === 'object' && c ? c : { title: String(c || '') }));
    return b.html + splitRect(grid(0, b.top, 12, 8 - b.top), Math.max(1, cols.length), 'col').map((r, i) => cell(r, { tone: i === 1 ? fills[0] : null, what: 'column ' + (i + 1), gap: 20, fix: 'Shorten the points or cut one.' }, (w, h) => {
      const c = cols[i] || {};
      const top = [];
      if (c.title) top.push(tb(c.title, { role: 'display', sizes: [44, 38, 32], w, max: 2, what: 'a column heading' }));
      if (c.body) top.push(tb(c.body, { role: 'body', size: BODY(), w, what: 'a column body' }));
      const pts = asArray(c.points).slice(0, 5).map((p) => (typeof p === 'object' && p ? p : { text: String(p) }));
      const used = top.reduce((a2, b2) => a2 + b2.h + 20, 0);
      if (pts.length) top.push(pointList(pts, w, { sizes: PT_SIZES().slice(1), maxH: h - used }));
      return { top };
    })).join('');
  },

  sources(s) {
    const b = band(s, [], { label: 'Appendix' });
    const area = grid(0, b.top, 12, 8 - b.top);
    const items = s.items || [];
    const hair = LX.theme.cell === 'hairline' || LX.theme.cell === 'rule';
    if (!items.length) return b.html + cell(area, { what: 'the sources' }, (w) => ({ top: [pointList(pointItems(s), w, {})] }));
    return b.html + cell(area, { kind: hair ? undefined : 'plain', pad: hair ? 30 : 0, what: 'the sources table', gap: 16, cls: 'ref' }, (w, h) => {
      const was = LX.variant; LX.refSize = 20;
      let note = null, table;
      if (s.groups) {
        note = tb(s.figures + ' figures from ' + s.fileCount + ' source ' + (s.fileCount === 1 ? 'file' : 'files') + '. Each figure has an entry in the fact ledger (facts.yaml) that names its file and location.', { role: 'body', size: 22, w, max: 2, cls: 'mut' });
        table = gridTable(['Source file', 'Figures', 'Kinds', 'Slides'], s.groups.map((g) => [g.file, String(g.count), g.kinds, g.slides]), w, h - note.h - 16, { ref: true, widths: [0.46, 0.1, 0.24, 0.2] });
      } else if (!items.some((it) => it.label)) {
        table = gridTable(['Ref', 'Ledger id', 'Used on'], items.map((it) => [String(it.ref), it.id, 'slide ' + it.slide + (it.title ? ': ' + (stripEm(it.title).length > 64 ? stripEm(it.title).slice(0, 62).trim() + '...' : stripEm(it.title)) : '')]), w, h, { ref: true, widths: [0.08, 0.42, 0.5] });
      } else {
        table = gridTable(['Ref', 'Ledger id', 'Label', 'Value', 'Kind', 'As of', 'Source file'], items.map((it) => [String(it.ref), it.id, it.label || '', it.value || '', it.kind || '', it.asOf || '', it.file || '']), w, h, { ref: true, widths: [0.05, 0.2, 0.25, 0.1, 0.1, 0.09, 0.21] });
      }
      LX.refSize = 0; LX.variant = was;
      return { top: [note, table] };
    });
  },

  custom_html(s) {
    const b = s.title ? band(s, []) : { html: '', top: 0 };
    const r = grid(0, b.top, 12, 8 - b.top);
    return b.html + '<div class="custom" style="left:' + f1(r.x) + 'px;top:' + f1(r.y) + 'px;width:' + f1(r.w) + 'px;height:' + f1(r.h) + 'px">' + (s.html || '') + '</div>';
  },
};

// A table under the band, with an optional point below it.
function tableBody(s, top) {
  const pts = pointItems(s).slice(0, 2);
  const area = grid(0, top, 12, 8 - top);
  const hair = LX.theme.cell === 'hairline' || LX.theme.cell === 'rule';
  return cell(area, { kind: hair ? undefined : 'plain', pad: hair ? 30 : 0, what: 'the table', slack: true, gap: 18, fix: 'Cut a row, shorten the cells that wrap, or move the point to the notes.' }, (w, h) => {
    const pl = pts.length ? pointList(pts, w, { size: SMALL(), padY: 10 }) : null;
    return { top: [gridTable(s.columns, s.rows, w, h - (pl ? pl.h + 18 : 0), { grid: s.type === 'competition' })], bottom: pl ? [pl] : [] };
  });
}

// Running head and page count in the theme's wording; the source caption at the foot.
function marginalia(s, i, ctx) {
  const T = LX.theme;
  const total = ctx.total;
  const co = String(ctx.meta.company || '');
  const sec = s.sectionTitle && s.type !== 'section' ? s.sectionTitle : '';
  const quiet = s.type === 'cover';
  let left = co + (sec ? ' / ' + sec : '');
  if (T.marg === 'chapter' && s.sectionNo && sec) left = 'Chapter ' + two(s.sectionNo) + ' / ' + sec;
  const right = quiet ? '' : (T.marg === 'sheet' ? 'Sheet ' + two(i + 1) + ' of ' + two(total) : two(i + 1) + ' / ' + two(total));
  const maxLeft = 1200;
  if (tw(left, T.roles.mono, T.monoSize) > maxLeft) left = co;
  // on a slide with a full-height panel, the marginalia on that side take the panel's tone
  const pt = (side) => (LX.panel && LX.panel.side === side ? ' data-ground="--bg" data-tone="' + LX.panel.tone + '"' : '');
  let html = '<div class="mg mg-l f-mono"' + pt('left') + ' style="font-size:' + T.monoSize + 'px">' + esc(left) + '</div>' + (right ? '<div class="mg mg-r f-mono"' + pt('right') + ' style="font-size:' + T.monoSize + 'px">' + esc(right) + '</div>' : '');
  if (T.decor === 'crosshair') html += '<i class="cross" style="left:28px;top:28px"></i><i class="cross" style="right:28px;top:28px"></i><i class="cross" style="left:28px;bottom:28px"></i><i class="cross" style="right:28px;bottom:28px"></i>';
  const foot = ctx.meta.footer ? esc(ctx.meta.footer) : '';
  // room for the caption: up to the footer, or on a split slide only the half it sits on
  const footW = foot && !quiet ? tw(ctx.meta.footer, T.roles.mono, 16) + 40 : 0;
  const PWs = LX.panel ? (LX.panelW || 740) : 0;
  const capMax = !LX.panel ? FRAME.w - footW : (LX.panel.side === 'left' ? PWs - FRAME.x - 40 : STAGE_W - PWs - FRAME.x - 40);
  let cap = '';
  if (s.source && !(s.chart && visualOf(s) === 'chart')) {
    // fewer files, then "and N more", until the line fits
    for (let k = 3; k >= 1; k--) {
      CAPTION_MAX = k;
      cap = captionHtml(s.source, ctx);
      if (tw(cap.replace(/<[^>]+>/g, ''), T.roles.mono, 16) <= capMax) break;
    }
    CAPTION_MAX = 3;
  }
  if (cap) {
    if (tw(cap.replace(/<[^>]+>/g, ''), T.roles.mono, 16) > capMax) issue('the source caption does not fit its line even with one file named. Give the ledger entry a short `cite_as`.');
    html += '<p class="slide-source f-mono"' + pt('left') + ' data-max="' + Math.round(capMax) + '">' + cap + '</p>';
  }
  if (foot && !quiet) html += '<div class="foot f-mono"' + pt('right') + '>' + foot + '</div>';
  return html;
}
// --------------------------------------------------------------------------------------
// 4e. Stylesheet, slide shell and page assembly
// --------------------------------------------------------------------------------------

function renderSlideHtml(s, i, ctx) {
  const T = ctx.theme;
  LX.no = i + 1; LX.type = s.type; LX.tone = s.tone || T.base; LX.count = 0;
  LX.panel = null;
  // a stat repeats its source file only when neither the slide caption nor an earlier stat names it
  LX.capText = captionText(s.chart && s.chart.source ? [s.source, s.chart.source] : s.source, ctx) || '';
  LX.statSrc = [];
  LX.imgs = (ctx.slideImages && ctx.slideImages[i]) || [];
  LX.teamPhotos = (ctx.teamPhotos && ctx.teamPhotos[i]) || [];
  const render = RENDER[s.type] || RENDER.statement;
  const inner = render(s);
  const tone = T.tones[LX.tone];
  const bg = toneBackground(tone);
  return '<section class="slide s-' + s.type + (i === 0 ? ' active' : '') + '" data-tone="' + LX.tone + '" data-index="' + (i + 1) + '" data-type="' + esc(s.type) + '" aria-label="Slide ' + (i + 1) + (s.title ? ': ' + esc(stripEm(s.title)) : '') + '">' +
    inner + marginalia(s, i, ctx) + (bg.grain ? '<div class="grain" style="opacity:' + bg.grain + '"></div>' : '') + '</section>';
}

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

// Theme-dependent rules: type roles, tones, backgrounds, how cells and emphasis are drawn.
function themeCss(T) {
  const out = [];
  const R = T.roles;
  out.push(':root{--font-display:' + R.display.css.match(/font-family:([^;]+)/)[1] + ';--font-body:' + R.body.css.match(/font-family:([^;]+)/)[1] + ';--radius:' + T.radius + 'px;--gap:' + CELL_STYLE[T.cell].gap + 'px}');
  ['display', 'em', 'num', 'body', 'bodyb', 'mono'].forEach((k) => out.push('.f-' + k + '{' + R[k].css + '}'));
  out.push('body,.slide{' + R.body.css + '}');
  Object.keys(T.tones).forEach((t) => {
    const o = T.tones[t];
    const mark = isHex(T.T[t + '-mark']) ? T.T[t + '-mark'].toUpperCase() : (T.T.mark === 'accent' ? o.accent : o.accent2);
    const onMark = bestOn(mark, [o.ink, o.bg]);
    out.push('[data-tone="' + t + '"]{' + toneVars(o) + '--mark:' + mark + ';--on-mark:' + onMark + ';background-color:var(--bg);color:var(--ink)}');
    // the slide's own line colour: nested cells keep the line of the slide they sit on
    const line = T.cell === 'rule' ? rgbaOf(o.ink, 0.22) : T.cell === 'outline' ? rgbaOf(o.ink, 0.38) : o.rule;
    out.push('.slide[data-tone="' + t + '"]{--line:' + line + ';background:' + toneBackground(o).css + '}');
    // emphasis: a highlighter block where the theme asks for one, and wherever the accent
    // cannot be told from the ink
    const mark0 = emMode(T, t) === 'mark';
    out.push('[data-tone="' + t + '"]{--em-bg:' + (mark0 ? 'var(--mark)' : 'transparent') + ';--em-ink:' + (mark0 ? 'var(--on-mark)' : 'var(--accent-t)') + ';--em-pad:' + (mark0 ? '.12em' : '0') + '}');
  });
  // the highlighter band is kept inside the line, so tight headlines do not cover the line above
  out.push('.em{font-style:normal;background:linear-gradient(transparent 14%,var(--em-bg) 14%,var(--em-bg) 90%,transparent 90%);color:var(--em-ink);padding:0 var(--em-pad);-webkit-box-decoration-break:clone;box-decoration-break:clone}');
  if (T.emMode === 'serif') out.push('.em{' + R.em.css + ';font-size:' + T.emScale + 'em}');
  // cells
  const c = T.cell;
  if (c === 'hairline' || c === 'rule') out.push('.cell{border:1px solid var(--line)}.cell.filled{border-color:var(--line)}.dg-box{border:1px solid var(--line)}.dg-box.filled{border-color:transparent}');
  if (c === 'block') out.push('.cell{background:var(--surface)}.dg-box{background:var(--surface);border:3px solid var(--ink)}.dg-shape{stroke:var(--ink);stroke-width:3}.fr{border:3px solid var(--ink);box-shadow:12px 12px 0 var(--ink)}');
  if (c === 'outline') out.push('.cell{border:1.5px solid var(--line);border-radius:var(--radius)}.cell.filled{border-color:transparent}.dg-box{border:1.5px solid var(--line);border-radius:var(--radius)}.dg-box.filled{border-color:transparent}');
  if (c === 'card') out.push('.cell{background:var(--surface);border:2px solid var(--line);border-radius:var(--radius);box-shadow:8px 8px 0 var(--line)}.dg-box{background:var(--surface);border:2px solid var(--ink);border-radius:var(--radius);box-shadow:6px 6px 0 var(--ink)}.dg-shape{stroke:var(--ink);stroke-width:2}.fr{border:2px solid var(--ink);box-shadow:12px 12px 0 var(--ink)}.dc.shape{border:2px solid var(--ink)}');
  if (c === 'soft') out.push('.cell{background:var(--surface);border-radius:var(--radius)}.dg-box{background:var(--surface);border-radius:var(--radius)}');
  out.push('.cell.plain,.cell.bleed{background:none;border:0;box-shadow:none;border-radius:0}.cell.filled,.cell.bleed.filled{background:var(--bg)}');
  if (T.T['num-color'] === 'accent') out.push('.num{color:var(--accent-t)}');
  if (T.marg === 'chapter') out.push('.mg-l{color:var(--accent-t)}');
  if (c === 'card' || c === 'soft' || c === 'rule') out.push('.tm-m{border-radius:50%}');
  return out.join('\n');
}

function baseCss() {
  return `
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%;background:#000}
body{font-synthesis:none;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.viewport{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#000}
.stage{position:relative;width:${STAGE_W}px;height:${STAGE_H}px;flex:none;transform-origin:center center}
.slide{position:absolute;inset:0;width:${STAGE_W}px;height:${STAGE_H}px;overflow:hidden;visibility:hidden;opacity:0;pointer-events:none;transition:opacity .22s ease;font-size:28px;line-height:1.36;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.slide.active{visibility:visible;opacity:1;pointer-events:auto}
html.noscale .viewport{position:static;display:block;overflow:hidden;width:${STAGE_W}px;height:${STAGE_H}px}
html.noscale .slide{transition:none}
html.noscale .hud{display:none}
img{max-width:100%;display:block}
.grain{position:absolute;inset:0;pointer-events:none;z-index:5;background:url(${grainDataUri()}) 0 0/192px 192px}

/* text */
.t{margin:0;padding:0;font-style:normal}
.title{text-wrap:balance;margin:0}
.nb{white-space:nowrap}
blockquote.t{margin:0}
.lbl{color:var(--muted);white-space:nowrap}
.lbl.eb{color:var(--accent-t)}
.lbl.contact{color:var(--ink);white-space:normal}
.sub,.mut,.bodyp,.st-l{color:var(--muted)}
.hi{color:var(--accent-t)}
.st-d{color:var(--accent-2t)}
.st-s{color:var(--muted)}
.vs{display:flex;flex-direction:column}
.hr{border:0;height:1px;background:var(--hair);margin:0;width:100%;flex:none}
sup.fn{font-size:1em;line-height:inherit;vertical-align:baseline;margin-left:.3em;font-variant-numeric:tabular-nums}
.needs{display:inline-block;padding:0 .35em;border:3px dashed #E0A100;color:#8A5C00;background:#FFF3D1;border-radius:6px;font-weight:600;font-size:.72em;line-height:1.5;white-space:nowrap;vertical-align:.1em;letter-spacing:0;text-transform:none;font-family:var(--font-body)}
.warn-badge{position:absolute;top:24px;right:420px;background:#E0A100;color:#1A1A1A;font-size:20px;line-height:1;padding:10px 14px;border-radius:4px;font-weight:600;z-index:6}

/* numerals */
.num{white-space:nowrap;font-variant-numeric:tabular-nums lining-nums;margin:0}
.num sup{font-size:.36em;line-height:1;vertical-align:top;position:relative;top:.16em;margin-left:.05em;letter-spacing:0;font-variant-numeric:normal}
.num.strike{text-decoration:line-through;text-decoration-thickness:.06em;color:var(--muted)}
.idx{color:var(--accent-t)}

/* cells */
.cell{position:absolute;display:flex;flex-direction:column;justify-content:space-between;min-width:0}
.cg{display:flex;flex-direction:column;min-width:0}
.cg-mid{margin:auto 0}
.cg-bottom{margin-top:auto}
.cell.strip{box-shadow:inset 0 2px 0 var(--ink)}
.arr{position:absolute;right:calc(var(--gap) / -2 - 23px);top:50%;margin-top:-23px;width:46px;height:46px;border-radius:50%;background:var(--ink);color:var(--bg);display:grid;place-items:center;z-index:3}
.dc{position:absolute;pointer-events:none}
.dc.ghost{line-height:.8;white-space:nowrap;color:transparent;-webkit-text-stroke:2px var(--hair);opacity:.9}
.sec-n{position:absolute;line-height:.8;white-space:nowrap;color:var(--ink);z-index:1}
.cross{position:absolute;width:36px;height:36px;opacity:.75}
.cross::before,.cross::after{content:"";position:absolute;background:var(--ink)}
.cross::before{left:17px;top:0;width:2px;height:36px}
.cross::after{top:17px;left:0;height:2px;width:36px}
.mg{position:absolute;top:44px;color:var(--muted);white-space:nowrap;line-height:1.3;z-index:2}
.mg-l{left:72px}.mg-r{right:72px}
.mg[data-tone],.slide-source[data-tone],.foot[data-tone]{background:none}
.slide-source{position:absolute;left:72px;bottom:30px;margin:0;font-size:16px;line-height:1.3;color:var(--muted);white-space:nowrap;z-index:2}
.foot{position:absolute;right:72px;bottom:30px;font-size:16px;line-height:1.3;color:var(--muted);white-space:nowrap;z-index:2}
.logo{object-fit:contain;object-position:left center;max-width:420px}
.logo-chip{display:inline-flex;align-self:flex-start;padding:14px 20px;background:#FFFFFF;border-radius:calc(var(--radius) * .5 + 4px)}
.custom{position:absolute;overflow:hidden}

/* icons */
.ico{fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none;display:block}

/* points */
.pts{list-style:none;margin:0;padding:0}
.pts li{display:flex;align-items:flex-start;border-top:1px solid var(--hair)}
.pts li:first-child{border-top:0}
.pt-k{flex:none;display:flex;align-items:center}
.pt-m{width:12px;height:12px;background:var(--accent)}
.pt-n,.pt-i{color:var(--accent-t)}
.pt-t{min-width:0;flex:1}
.pps{display:flex;flex-direction:column;gap:28px}
.pp{display:flex;align-items:flex-start}
.ms{list-style:none;margin:0;padding:0}
.ms li{display:flex;align-items:flex-start;gap:0;border-top:1px solid var(--hair);position:relative;padding-left:34px !important}
.ms-d{position:absolute;left:0;top:24px;width:14px;height:14px;border-radius:50%;background:var(--accent)}
.ms-w{color:var(--ink)}
.hs{display:flex;gap:40px;align-items:flex-end}

/* charts */
.chart-b{display:flex;flex-direction:column}
.chart{display:block;overflow:visible;flex:none}
.chart-h{display:flex;justify-content:space-between;align-items:flex-start;gap:8px 30px;flex:none;line-height:1.3}
.lgs{display:flex;gap:26px}
.lg{display:inline-flex;align-items:center;gap:10px;white-space:nowrap}
.lg i{width:14px;height:14px;display:inline-block}
.cap{margin:0;height:34px;line-height:34px;color:var(--muted);white-space:nowrap;flex:none}
.chart .ax{font-size:19px;fill:var(--muted)}
.chart .ax.hi{fill:var(--accent-t)}
.chart .vl{font-size:24px;fill:var(--ink)}
.chart .vl.hi{fill:var(--accent-t)}
.chart .vl.sm{font-size:18px;fill:var(--muted)}
.chart .el{font-size:22px;fill:var(--muted)}
.chart .hl{font-size:24px;fill:var(--ink)}
.chart .an{font-size:20px;fill:var(--accent-2t)}
.chart .an-l{stroke:var(--accent-2t);stroke-width:1.5}
.chart .an-d{fill:var(--accent-2t)}
.chart .grid{stroke:var(--hair);stroke-width:1}
.chart .base{stroke:var(--ink);stroke-width:2}
.donut{flex:none;display:block}
.donut .dn{font-size:8.6px;fill:var(--ink);letter-spacing:-.03em}
.funds{display:flex;align-items:center;gap:44px}
.funds.stk{flex-direction:column;align-items:flex-start;gap:40px}
.fd-l{display:flex;flex-direction:column}
.fd-r{display:flex;align-items:baseline;gap:14px}
.fd-r i{width:14px;height:14px;flex:none;display:inline-block;transform:translateY(1px)}
.fd-r div.t{flex:1;min-width:0}
.fd-r b{white-space:nowrap;text-align:right;width:82px;flex:none}
.sparks{display:flex;flex-direction:column}
.sp-row{display:flex;align-items:center;gap:18px;border-top:1px solid var(--hair)}
.sp-row:first-child{border-top:0}
.sp-n{flex:1;min-width:0;white-space:nowrap}
.sp-v{text-align:right;white-space:nowrap}
.spark{flex:none;display:block;overflow:visible;color:var(--ink)}
.st-tr{display:flex;justify-content:flex-end;color:var(--ink)}

/* diagrams */
.dg{position:relative;flex:none}
.dg-s{position:absolute;left:0;top:0;overflow:visible}
.dg-t{position:absolute}
.dg-box{position:absolute;display:flex;flex-direction:column;justify-content:space-between}
.dg-box.filled{background:var(--bg);color:var(--ink)}
.dg-box.ghost{background:none;border:2px dashed var(--muted);box-shadow:none}
.dg-l{stroke:var(--ink);stroke-width:3;fill:none}
.dg-l.dash{stroke-dasharray:8 9}
.dg-l.thick{stroke-width:5}
.dg-h{stroke:var(--muted);stroke-width:1.5;fill:none}
.dg-h.dash{stroke-dasharray:4 8}
.dg-axis{stroke:var(--ink);stroke-width:3}
.dg-node{fill:var(--bg);stroke:var(--ink);stroke-width:4}
.dg-node.on{fill:var(--accent)}
.dg-frame{stroke:var(--muted);stroke-width:1.5}
.dg-shape.lay{stroke:var(--bg);stroke-width:3}
.dg-rot{transform-origin:0 0;transform:rotate(-90deg)}
.dg .ico{color:var(--accent-t)}
.dg-funnel .num{color:inherit}

/* tables */
.tb{position:relative}
.tb-us{position:absolute;top:0;z-index:0}
.tb-r{display:flex;border-top:1px solid var(--hair);position:relative;z-index:1}
.tb-h{border-top:0;box-shadow:inset 0 -2px 0 var(--ink)}
.tb-c{display:flex;align-items:center;flex:none;min-width:0;background:none !important}
.tb-c .t{min-width:0}
.tb-r.usr{background:var(--surface)}
.tb-dot{width:24px;height:24px;border-radius:50%;border:2.5px solid var(--muted);display:inline-block}
.tb-dot.on{background:var(--ink);border-color:var(--ink)}
.tb-no{width:18px;height:2px;background:var(--muted);display:inline-block}


/* images, frames, logos, people */
.imgs{position:relative;display:flex;align-items:center;justify-content:flex-start}
.imgs.ctr{justify-content:center}
.fr{flex:none;overflow:hidden;background:var(--surface);border-radius:calc(var(--radius) * .8)}
.fr img{display:block;max-width:none}
.fr-none{border:1px solid var(--hair)}
.fr-browser{border:2px solid var(--ink);border-radius:16px}
.fr-bar{height:48px;display:flex;align-items:center;gap:9px;padding:0 18px;border-bottom:2px solid var(--ink);background:var(--bg)}
.fr-bar i{width:13px;height:13px;border-radius:50%;border:2px solid var(--ink);display:block}
.fr-bar span{flex:1;height:24px;margin-left:14px;border-radius:12px;background:var(--surface)}
.fr-phone{background:#16161A;border:0;border-radius:46px;padding:14px;box-shadow:none}
.fr-scr{border-radius:32px;overflow:hidden}
.fr.over{z-index:2}
.logos{display:flex;align-items:stretch;width:100%}
.lg-c{flex:1;display:grid;place-items:center;border-left:1px solid var(--hair);min-width:0}
.lg-c:first-child{border-left:0}
.lg-c img{filter:grayscale(1)}
.lg-cell{background:none !important;box-shadow:inset 0 1px 0 var(--hair) !important}
.tm-m{display:grid;place-items:center;line-height:1;flex:none}
.cell.tm{overflow:hidden}
.tm-b{position:absolute;display:grid;place-items:center;line-height:1;overflow:hidden;letter-spacing:-.04em}
.tm-b img{width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.05);max-width:none}
.tm-p{overflow:hidden;border-radius:999px 999px 0 0;flex:none}
.tm-p img{width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.05);max-width:none}
.q-m{font-size:400px;line-height:.82;color:var(--accent-t);overflow:hidden}
.q-by{display:flex;align-items:stretch;gap:26px}
.q-by .vs{justify-content:center}
.q-bar{width:6px;background:var(--accent);flex:none}
.q-av{width:112px;height:112px;border-radius:50%;flex:none;object-fit:cover}
.mono-av{display:grid;place-items:center;background:var(--accent);color:var(--on-accent);font-size:50px;line-height:1}

/* staged entrance: on screen only, never in print, QA or reduced motion */
@media screen and (prefers-reduced-motion: no-preference){
  html:not(.noscale):not(.print) .slide.active>.cell,html:not(.noscale):not(.print) .slide.active>.sec-n{animation:rise .5s cubic-bezier(.2,.7,.2,1) both}
  html:not(.noscale):not(.print) .slide.active>.cell:nth-of-type(2){animation-delay:.06s}
  html:not(.noscale):not(.print) .slide.active>.cell:nth-of-type(3){animation-delay:.12s}
  html:not(.noscale):not(.print) .slide.active>.cell:nth-of-type(4){animation-delay:.18s}
  html:not(.noscale):not(.print) .slide.active>.cell:nth-of-type(n+5){animation-delay:.24s}
  @keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
}

/* presenter chrome */
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

// ---- page assembly and the lint pass ------------------------------------------------

// Fields a slide type has no place for; the lint names them instead of dropping them silently.
const NOT_DRAWN = {
  cover: 'chart points rows team milestones use_of_funds diagram logos sparklines',
  section: 'chart points stats rows team milestones use_of_funds diagram logos sparklines image',
  statement: 'chart stats rows team milestones use_of_funds diagram logos sparklines image',
  quote: 'chart points rows team milestones use_of_funds diagram logos sparklines',
  problem: 'chart rows team milestones use_of_funds logos sparklines',
  solution: 'chart rows team milestones use_of_funds logos sparklines',
  ask: 'chart rows team logos sparklines image',
  team: 'chart stats image diagram milestones use_of_funds logos sparklines',
  roadmap: 'chart stats image rows team use_of_funds logos sparklines',
  competition: 'chart stats image team milestones use_of_funds logos sparklines',
  market: 'chart image rows team milestones use_of_funds logos sparklines',
  closing: 'chart stats image rows team milestones use_of_funds diagram sparklines',
  two_column: 'chart stats points image rows team milestones use_of_funds diagram logos sparklines',
  product: 'team milestones use_of_funds sparklines',
  insight: 'team milestones use_of_funds logos sparklines',
};
function fieldLint(s) {
  const has = { chart: !!s.chart, points: s.points.length, stats: s.stats.length, rows: s.rows.length, team: s.team.length, milestones: s.milestones.length, use_of_funds: s.use_of_funds.length, diagram: !!s.diagram, logos: (s.logos || []).length, sparklines: (s.sparklines || []).length, image: (s.images || []).length };
  String(NOT_DRAWN[s.type] || 'team milestones use_of_funds').split(' ').forEach((f) => { if (has[f]) issue('`' + f + '` is not drawn on a ' + s.type + ' slide. Move it to a slide type that shows it.'); });
  if (has.diagram && has.stats && ['problem', 'solution', 'ask'].includes(s.type)) issue('`stats` are not drawn beside a `diagram` on a ' + s.type + ' slide: the diagram takes the panel. Put the figure into the diagram or the title.');
  if (s.type === 'product' && has.stats > 1) issue('a product slide draws one stat (the first); ' + has.stats + ' given.');
  const vis = ['diagram', 'chart', 'image', 'rows'].filter((f) => has[f] && !String(NOT_DRAWN[s.type] || '').split(' ').includes(f));
  if (vis.length > 1 && !['problem', 'solution', 'ask', 'team', 'roadmap', 'quote', 'cover'].includes(s.type) && !(s.type === 'competition')) issue('the slide has ' + vis.join(' and ') + '; only the ' + vis[0] + ' is drawn. One visual per slide.');
}

// Render every slide once. The same pass is the capacity lint: it returns the slide
// HTML and the list of what does not fit.
function renderDeck(deck, theme, ctx) {
  HCTX = ctx;
  ctx.theme = theme; ctx.meta = deck.meta; ctx.total = deck.slides.length; ctx.variant = deck.meta.variant;
  LX = { theme, variant: deck.meta.variant, tone: theme.base, no: 0, type: '', issues: [], slack: [], quiet: false, unknownIcons: [] };
  chartSeq = 0; dgSeq = 0;
  const html = deck.slides.map((s, i) => {
    const out = renderSlideHtml(s, i, ctx);
    fieldLint(s);
    return out;
  });
  (ctx.toneRuns || []).forEach((n) => LX.issues.push('slide ' + n + ': the fourth slide in a row with the same tone. Remove an explicit `tone` or change one.'));
  return { html, issues: LX.issues, slack: LX.slack, unknownIcons: LX.unknownIcons };
}
// Lint only (no files): used by --capacities and the test harness.
function lintDeck(deck, theme, ctx) {
  const c = Object.assign({ placeholders: [], slideImages: [], teamPhotos: [], logo: null, rasters: {} }, ctx || {});
  return renderDeck(deck, theme, c).issues;
}

function buildHtml(deck, theme, ctx, slidesHtml) {
  const { meta, slides } = deck;
  const fontsHref = googleFontsHref(theme.gfonts);
  const notes = slides.map(notesText);
  return '<!doctype html>\n<html lang="en" data-theme="' + esc(theme.name) + '" data-variant="' + esc(meta.variant) + '">\n<head>\n' +
    '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(meta.company) + (meta.tagline ? ': ' + esc(meta.tagline) : '') + '</title>\n' +
    '<meta name="generator" content="startup-pitch build_deck.js">\n' +
    '<meta name="slide-count" content="' + slides.length + '">\n' +
    (fontsHref ? '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="' + fontsHref + '" rel="stylesheet">\n' : '') +
    '<style>\n' + themeCss(theme) + '\n' + baseCss() + '\n</style>\n</head>\n<body>\n' +
    '<div class="viewport"><div class="stage" id="stage">\n' + slidesHtml.join('\n') + '\n</div></div>\n' +
    '<div class="hud" id="counter">1 / ' + slides.length + '</div>\n' +
    '<aside class="notes" id="notes" hidden></aside>\n' +
    '<script type="application/json" id="deck-notes">' + JSON.stringify(notes).replace(/</g, '\\u003c') + '</script>\n' +
    '<script>\n' + runtimeJs() + '\n</script>\n</body>\n</html>\n';
}

// Measure, in the installed Chrome, the type roles that font-metrics.json does not cover
// (a deck that sets meta.font_display or meta.font_body). Without a browser or network the
// family tables below are used, with their margins. `all` measures every role (used to
// regenerate font-metrics.json after a theme changes).
async function measureRoles(themes, all) {
  const todo = [];
  themes.forEach((T) => Object.keys(T.roles).forEach((k) => { const r = T.roles[k]; if ((all || !roleWidths(r)) && !todo.some((x) => x.css === r.css)) todo.push({ css: r.css, family: r.family, gf: T.gfonts }); }));
  if (!todo.length) return {};
  const got = {};
  let browser;
  try {
    const pw = require('playwright-core');
    const exe = findChrome();
    browser = await pw.chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' });
    const page = await browser.newPage();
    const fams = [];
    todo.forEach((t) => t.gf.forEach((g) => { if (!fams.includes(g)) fams.push(g); }));
    for (let i = 0; i < fams.length; i += 6) {
      await page.setContent('<html><head><link rel="stylesheet" href="' + googleFontsHref(fams.slice(i, i + 6)) + '"></head><body></body></html>', { waitUntil: 'load', timeout: 20000 });
      const batch = todo.filter((t) => fams.slice(i, i + 6).some((g) => g.split(':')[0] === t.family));
      const res = await page.evaluate(async ({ batch, glyphs }) => {
        const out = {};
        for (const t of batch) {
          const span = document.createElement('span');
          span.style.cssText = t.css + ';position:absolute;white-space:pre;font-size:100px;letter-spacing:0';
          document.body.appendChild(span);
          span.textContent = glyphs;
          try { await document.fonts.load(getComputedStyle(span).fontStyle + ' ' + getComputedStyle(span).fontWeight + ' 100px "' + t.family + '"', glyphs); } catch (e) { /* checked below */ }
          await document.fonts.ready;
          if (!Array.from(document.fonts).some((x) => x.family.replace(/"/g, '') === t.family && x.status === 'loaded')) { span.remove(); continue; }
          const ws = [];
          for (const ch of glyphs) {
            span.textContent = 'non' + ch + 'non'; const a = span.getBoundingClientRect().width;
            span.textContent = 'nonnon'; const b = span.getBoundingClientRect().width;
            ws.push(Math.round((a - b) * 10));
          }
          span.remove();
          out[t.css] = ws;
        }
        return out;
      }, { batch, glyphs: GLYPH_SET });
      Object.assign(got, res);
    }
  } catch (e) { /* no browser or no network */ }
  if (browser) await browser.close().catch(() => {});
  const enc = {};
  Object.keys(got).forEach((css) => { enc[css] = got[css].map((w) => Math.max(0, Math.min(1295, w)).toString(36).padStart(2, '0')).join(''); loadMetrics()[css] = enc[css]; delete metricCache[css]; });
  return enc;
}
// --------------------------------------------------------------------------------------
// 8. Capacity table
// --------------------------------------------------------------------------------------
// What fits is whatever the renderer lays out without a warning, so the table is found by
// asking it: each form below is rendered with one field growing until the lint objects.
// The same forms drive the test harness (decks at the limit must render clean).

const SAMPLE_WORDS = 'operators pay 1,280 EUR per site per month; carriers book a dock slot in 40 seconds from their phone and the waiting time at live sites fell from 94 to 31 minutes within eight weeks of the first booking'.split(' ');
// Text of exactly-or-just-under n characters, cut at a word; `seed` varies the words.
function sampleText(n, seed) {
  let s = '', i = (seed || 0) * 7;
  while (true) {
    const w = SAMPLE_WORDS[i % SAMPLE_WORDS.length]; i += 1 + ((seed || 0) % 3);
    if ((s ? s.length + 1 : 0) + w.length > n) break;
    s += (s ? ' ' : '') + w;
  }
  if (!s) s = SAMPLE_WORDS[0].slice(0, Math.max(1, n));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
// The same with its second and third words emphasised, as a title would have.
function sampleTitle(n, seed) {
  const w = sampleText(n, seed).split(' ');
  return w.length < 4 ? w.join(' ') : w.slice(0, 1).concat(['*' + w.slice(1, 3).join(' ') + '*'], w.slice(3)).join(' ');
}
const IMG_WIDE = 'assets/meridian-board.svg', IMG_TALL = 'assets/meridian-booking.svg';
const st3 = (g) => [{ value: 'EUR 41k', label: g('stat label', 28) }, { value: '118%', label: g('stat label', 28) }, { value: '61', label: g('stat label', 28) }];
const pts = (g, n, base) => Array.from({ length: n }, () => g('point', base || 70));
const CHART8 = { kind: 'bar', labels: ['Jan 25', 'Apr 25', 'Jul 25', 'Oct 25', 'Jan 26', 'Apr 26', 'Jul 26', 'Oct 26'], series: [{ name: 'MRR', values: [4, 7, 12, 18, 25, 33, 37, 41] }], y_label: 'EUR k per month', source: 'fact:mrr_series' };
const LINE5 = { kind: 'line', labels: ['Oct 26', 'Apr 27', 'Oct 27', 'Apr 28', 'Oct 28'], series: [{ name: 'Plan', values: [41, 62, 98, 145, 200] }, { name: 'Low case', values: [41, 52, 71, 98, 128] }], y_label: 'EUR k per month' };
// name: [what the row is called, (g) => slide]. g(field, typicalLength) returns sample text.
const FORMS = {
  'cover (3 stats)': (g) => ({ type: 'cover', title: g('title', 9), subtitle: g('subtitle', 44), kicker: g('kicker', 26), stats: st3(g) }),
  'cover': (g) => ({ type: 'cover', title: g('title', 9), subtitle: g('subtitle', 44), kicker: g('kicker', 26) }),
  'section': (g) => ({ type: 'section', title: g('title', 30), subtitle: g('subtitle', 50) }),
  'statement': (g) => ({ type: 'statement', title: g('title', 56), subtitle: g('subtitle', 70) }),
  'statement (3 points)': (g) => ({ type: 'statement', title: g('title', 56), points: pts(g, 3, 50) }),
  'quote (metric)': (g) => ({ type: 'quote', quote: g('quote', 90), by: g('name', 20), role: g('role', 36), stat: { value: '31 min', label: g('stat label', 34) } }),
  'quote': (g) => ({ type: 'quote', quote: g('quote', 110), by: g('name', 20), role: g('role', 36) }),
  'problem (stats)': (g) => ({ type: 'problem', title: g('title', 84), points: pts(g, 3, 80), stats: [{ value: '94 min', label: g('stat label', 34) }, { value: '61', label: g('stat label', 34) }] }),
  'problem (points only)': (g) => ({ type: 'problem', title: g('title', 84), points: pts(g, 3, 80) }),
  'problem (image)': (g) => ({ type: 'problem', title: g('title', 84), points: pts(g, 3, 80), image: IMG_WIDE }),
  'solution (points only)': (g) => ({ type: 'solution', title: g('title', 76), points: pts(g, 3, 80) }),
  'solution (before_after)': (g) => ({ type: 'solution', title: g('title', 76), points: pts(g, 2, 70), diagram: { kind: 'before_after', before: { label: g('label', 20), value: '94 min', text: g('diagram text', 26) }, after: { label: g('label', 20), value: '31 min', text: g('diagram text', 26) } } }),
  'product (wide image)': (g) => ({ type: 'product', title: g('title', 66), points: pts(g, 3, 52), images: [{ src: IMG_WIDE, frame: 'browser' }, { src: IMG_TALL, frame: 'phone' }] }),
  'product (tall image)': (g) => ({ type: 'product', title: g('title', 66), points: pts(g, 3, 60), images: [{ src: IMG_TALL, frame: 'phone' }] }),
  'product (no image)': (g) => ({ type: 'product', title: g('title', 66), points: pts(g, 4, 60) }),
  'insight (stat, 3 points)': (g) => ({ type: 'insight', title: g('title', 96), points: pts(g, 3, 80), stats: [{ value: '9 of 32', label: g('stat label', 30) }] }),
  'insight (loop)': (g) => ({ type: 'insight', title: g('title', 96), stats: [{ value: '9 of 32', label: g('stat label', 30) }], diagram: { kind: 'loop', center: g('diagram text', 34), nodes: [1, 2, 3, 4].map(() => ({ title: g('node', 16), text: g('node', 20) })) } }),
  'market (3 stats)': (g) => ({ type: 'market', title: g('title', 100), stats: [{ value: 'EUR 1.8B', label: g('stat label', 76) }, { value: 'EUR 185M', label: g('stat label', 76) }, { value: 'EUR 6.2M', label: g('stat label', 76) }], points: pts(g, 2, 110) }),
  'market (3 stats, one missing)': (g) => ({ type: 'market', title: g('title', 100), stats: [{ value: '[needs number]', label: g('stat label', 76) }, { value: 'EUR 185M', label: g('stat label', 76) }, { value: 'EUR 6.2M', label: g('stat label', 76) }], points: pts(g, 2, 110) }),
  'market (2 stats)': (g) => ({ type: 'market', title: g('title', 84), stats: [{ value: 'EUR 185M', label: g('stat label', 76) }, { value: 'EUR 494k', label: g('stat label', 76) }], points: pts(g, 1, 90) }),
  'traction (chart, 3 stats, logos)': (g) => ({ type: 'traction', title: g('title', 62), chart: CHART8, stats: st3(g), logos: ['Nordfracht', 'Elbe Trans', 'Benelux Cargo', 'Hansa Freight'] }),
  'traction (chart, 2 stats, 1 point)': (g) => ({ type: 'traction', title: g('title', 62), chart: CHART8, stats: st3(g).slice(0, 2), points: pts(g, 1, 60) }),
  'traction (no chart)': (g) => ({ type: 'traction', title: g('title', 62), stats: st3(g).concat([{ value: '0', label: g('stat label', 28) }]), points: pts(g, 4, 70) }),
  'business_model (4 stats)': (g) => ({ type: 'business_model', title: g('title', 84), stats: st3(g).concat([{ value: '9 months', label: g('stat label', 28) }]), points: pts(g, 1, 60) }),
  'business_model (table)': (g) => ({ type: 'business_model', title: g('title', 84), columns: ['', 'Starter', 'Site', 'Network'], rows: [1, 2, 3, 4].map(() => [g('row label', 22), g('cell', 12), g('cell', 12), g('cell', 12)]), points: pts(g, 1, 80) }),
  'go_to_market (2 stats, 3 steps)': (g) => ({ type: 'go_to_market', title: g('title', 90), points: pts(g, 3, 70), stats: [{ value: '34 days', label: g('stat label', 22) }, { value: 'EUR 9.8k', label: g('stat label', 22) }] }),
  'go_to_market (funnel)': (g) => ({ type: 'go_to_market', title: g('title', 90), points: pts(g, 2, 60), stats: [{ value: '34 days', label: g('stat label', 22) }], diagram: { kind: 'funnel', stages: [410, 96, 31, 18].map((v) => ({ label: g('funnel label', 24), value: String(v) })) } }),
  'competition (power grid)': (g) => ({ type: 'competition', title: g('title', 80), columns: ['', 'Meridian', g('header', 18), g('header', 18), g('header', 18)], rows: [[g('row label', 26), true, false, false, 'n/a']].concat([1, 2, 3, 4].map(() => [g('row label', 26), g('cell', 9), g('cell', 12), g('cell', 12), g('cell', 10)])), points: pts(g, 1, 80) }),
  'competition (matrix)': (g) => ({ type: 'competition', title: g('title', 80), points: pts(g, 2, 80), diagram: { kind: 'matrix', x: { label: g('axis', 20), low: g('axis', 14), high: g('axis', 14) }, y: { label: g('axis', 20), low: g('axis', 14), high: g('axis', 14) }, items: [{ name: 'Meridian', x: 0.55, y: 0.88, us: true }, { name: g('item', 18), x: 0.86, y: 0.2 }, { name: g('item', 18), x: 0.3, y: 0.52 }, { name: g('item', 18), x: 0.12, y: 0.3 }] } }),
  'team (4 people)': (g) => ({ type: 'team', title: g('title', 70), team: [1, 2, 3, 4].map(() => ({ name: g('name', 14), role: g('role', 18), bio: g('proof line', 70) })), points: pts(g, 1, 70) }),
  'financials (chart, 4 drivers)': (g) => ({ type: 'financials', title: g('title', 84), chart: LINE5, points: pts(g, 4, 46) }),
  'financials (chart, stat, 3 drivers)': (g) => ({ type: 'financials', title: g('title', 70), chart: LINE5, stats: [{ value: 'EUR 200k', label: g('stat label', 26) }], points: pts(g, 3, 46) }),
  'financials (table)': (g) => ({ type: 'financials', title: g('title', 84), columns: ['', '2026', '2027', '2028'], rows: [1, 2, 3, 4, 5].map(() => [g('row label', 22), g('cell', 8), g('cell', 8), g('cell', 8)]), points: pts(g, 1, 80) }),
  'ask (use of funds, milestones)': (g) => ({ type: 'ask', title: g('title', 64), subtitle: g('subtitle', 34), use_of_funds: [{ label: g('fund label', 22), pct: 50 }, { label: g('fund label', 22), pct: 35 }, { label: g('fund label', 22), pct: 15 }], milestones: [1, 2, 3].map(() => ({ when: 'Q2 2027', what: g('milestone', 46) })) }),
  'ask (stats)': (g) => ({ type: 'ask', title: g('title', 64), subtitle: g('subtitle', 34), stats: st3(g), milestones: [1, 2, 3].map(() => g('milestone', 50)) }),
  'roadmap (4 milestones)': (g) => ({ type: 'roadmap', title: g('title', 60), milestones: [1, 2, 3, 4].map((k) => ({ when: 'Q' + k + ' 2027', what: g('milestone', 30), proves: g('proves', 44), done: k === 1 })), points: pts(g, 1, 80) }),
  'closing (3 points)': (g) => ({ type: 'closing', title: g('title', 44), points: pts(g, 3, 52), subtitle: g('subtitle', 56) }),
  'appendix (text)': (g) => ({ type: 'appendix', kicker: 'Appendix', title: g('title', 70), stats: st3(g).slice(0, 2), points: pts(g, 4, 80) }),
  'appendix (chart)': (g) => ({ type: 'appendix', kicker: 'Appendix', title: g('title', 70), chart: CHART8, points: pts(g, 3, 50), stats: [{ value: '118%', label: g('stat label', 26) }] }),
  'appendix (flow)': (g) => ({ type: 'appendix', kicker: 'Appendix', title: g('title', 60), diagram: { kind: 'flow', loop: g('loop', 30), steps: [1, 2, 3, 4].map(() => ({ icon: 'link', title: g('step title', 14), text: g('step text', 56) })) } }),
  'appendix (layers)': (g) => ({ type: 'appendix', kicker: 'Appendix', title: g('title', 60), points: pts(g, 1, 70), diagram: { kind: 'layers', layers: [1, 2, 3].map(() => ({ title: g('layer', 18), text: g('layer text', 50) })) } }),
  'two_column': (g) => ({ type: 'two_column', title: g('title', 60), columns: [1, 2].map(() => ({ title: g('heading', 22), points: pts(g, 4, 46) })) }),
  'case_study': (g) => ({ type: 'case_study', title: g('title', 70), stats: st3(g).slice(0, 2), points: pts(g, 3, 60), image: IMG_WIDE }),
};

// Lint issues of a few raw slides in one theme and variant (no files written).
let PROBE_QUIET = false;
function probe(rawSlides, themeName, variant, css) {
  const ctx = { placeholders: [], missingFacts: [], kindMismatch: [] };
  PROBE_QUIET = true;
  let issues;
  try {
    const deck = normaliseDeck({ meta: { company: 'Meridian', theme: themeName, variant, sources: 'none' }, slides: [{ type: 'cover', title: 'Meridian' }].concat(rawSlides) }, ctx);
    const theme = resolveTheme(deck.meta, css || loadThemesCss());
    prepareDeck(deck, theme, ctx);
    ctx.slideImages = deck.slides.map((s) => (s.images || []).map((im) => ({ src: im.src, file: null, frame: im.frame })));
    ctx.teamPhotos = deck.slides.map(() => []);
    issues = renderDeck(deck, theme, ctx).issues;
  } finally { PROBE_QUIET = false; }
  return issues;
}
// Fields of a form with their typical lengths, in the order the form asks for them.
function formFields(make) {
  const seen = {};
  make((name, base) => { if (!(name in seen)) seen[name] = base; return sampleText(base, 0); });
  return seen;
}
// Longest text of `field` (others typical, or all scaled together when field is null)
// that still lints clean in every listed theme.
function formLimit(make, field, themes, variant, css, seed) {
  // a slide can land on any tone (the rhythm decides), and the emphasis is drawn differently per tone
  const fits = (n) => themes.every((t) => ['light', 'dark', 'accent'].every((tone) => probe([Object.assign(make((name, base) => (name === 'title' || name === 'quote' ? sampleTitle : sampleText)(field === null ? Math.round(base * n / 100) : (name === field ? n : base), seed || 0)), { tone })], t, variant, css).length === 0));
  let lo = 0, hi = field === null ? 400 : 420;
  if (!fits(field === null ? 100 : 4)) return 0;
  lo = field === null ? 100 : 4;
  while (hi - lo > (field === null ? 4 : 2)) { const mid = Math.round((lo + hi) / 2); if (fits(mid)) lo = mid; else hi = mid; }
  return lo;
}

function capacityMarkdown() {
  const css = loadThemesCss();
  const themes = themeNames(css);
  const out = [];
  out.push('| Slide type (form) | Longest text per field, in characters, `present / read` |');
  out.push('|---|---|');
  Object.keys(FORMS).forEach((name) => {
    const make = FORMS[name];
    const fields = formFields(make);
    const cells = Object.keys(fields).map((f) => {
      const p = formLimit(make, f, themes, 'present', css), r = formLimit(make, f, themes, 'read', css);
      return f + ' ' + (p === r ? p : p + ' / ' + r);
    });
    out.push('| ' + name + ' | ' + cells.join('; ') + ' |');
  });
  return out.join('\n');
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

async function buildPptxNative(deck, theme, outPath, ctx) {
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
// 5b. PPTX from the rendered deck: faithful (every slide a picture) and editable
//     (a picture of the ground and shapes, native text boxes and native charts on top)
// --------------------------------------------------------------------------------------
// Both open deck.html in the installed Chrome through playwright-core. Without it the
// build falls back to the native renderer above, which needs no browser.

async function openDeckPage(htmlPath, scale) {
  const pw = require('playwright-core');
  const exe = findChrome();
  let browser;
  try { browser = await pw.chromium.launch(exe ? { executablePath: exe } : { channel: 'chrome' }); } catch (e) { browser = await pw.chromium.launch({ channel: 'msedge' }); }
  const page = await browser.newPage({ viewport: { width: STAGE_W, height: STAGE_H }, deviceScaleFactor: scale });
  await page.goto('file://' + htmlPath + '?noscale', { waitUntil: 'load' });
  await page.evaluate(async () => { if (document.fonts) { await document.fonts.ready; await new Promise((r) => setTimeout(r, 250)); await document.fonts.ready; } });
  return { browser, page };
}
// One slide as an image: PNG, or JPEG when grain and gradients make the PNG heavy.
const SHOT_PNG_MAX = 900 * 1024;
async function shootSlide(page, i) {
  await page.evaluate((k) => window.deck.go(k), i);
  await page.waitForTimeout(60);
  const clip = { x: 0, y: 0, width: STAGE_W, height: STAGE_H };
  let buf = await page.screenshot({ clip, type: 'png' });
  let mime = 'image/png';
  if (buf.length > SHOT_PNG_MAX) { buf = await page.screenshot({ clip, type: 'jpeg', quality: 90 }); mime = 'image/jpeg'; }
  return { data: mime + ';base64,' + buf.toString('base64'), bytes: buf.length, mime };
}
function newPres(deck, theme) {
  const PptxGenJS = require('pptxgenjs');
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = deck.meta.company + (deck.meta.tagline ? ': ' + deck.meta.tagline : '');
  pres.company = deck.meta.company; pres.author = deck.meta.company;
  // one layout with a title placeholder, so every slide has a name in the outline and the slide sorter
  pres.defineSlideMaster({ title: 'DECK', background: { color: hex(theme.tones[theme.base].bg) }, objects: [{ placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.35, w: 12.3, h: 0.8, fontSize: 20, color: hex(theme.tones[theme.base].bg), align: 'left', valign: 'top', margin: 0 }, text: '' } }] });
  return pres;
}
const slideName = (s, i) => stripEm(s.title || s.quote || (s.type === 'sources' ? 'Sources' : s.type.replace(/_/g, ' '))) || 'Slide ' + (i + 1);

// faithful: pixel-identical to the PDF, text not editable.
async function buildPptxFaithful(deck, theme, htmlPath, outPath) {
  const { browser, page } = await openDeckPage(htmlPath, 2);
  // Grain is noise, and noise at 3840 px does not compress: it would triple the file. The
  // pictures leave it out unless PITCH_PPTX_GRAIN=1; everything else is as in the PDF.
  if (!process.env.PITCH_PPTX_GRAIN) await page.addStyleTag({ content: '.grain{display:none !important}' });
  const pres = newPres(deck, theme);
  let bytes = 0, jpeg = 0;
  try {
    for (let i = 0; i < deck.slides.length; i++) {
      const s = deck.slides[i];
      const shot = await shootSlide(page, i);
      bytes += shot.bytes; if (shot.mime === 'image/jpeg') jpeg += 1;
      const slide = pres.addSlide({ masterName: 'DECK' });
      slide.background = { color: hex(theme.tones[s.tone || theme.base].bg) };
      slide.addText(slideName(s, i), { placeholder: 'title' });
      slide.addImage({ data: shot.data, x: 0, y: 0, w: SW, h: SH, altText: slideName(s, i) });
      const notes = notesText(s);
      if (notes) slide.addNotes(notes);
    }
  } finally { await browser.close().catch(() => {}); }
  await pres.writeFile({ fileName: outPath });
  await stripZipFolders(outPath);
  return { jpeg, bytes };
}

// Runs in the page: every piece of text of slide i with its box and style, and the charts.
function extractScript() {
  return function (i) {
    const slide = document.querySelectorAll('.slide')[i];
    const hexOf = (c) => { const m = String(c).match(/[\d.]+/g) || [0, 0, 0]; return m.slice(0, 3).map((v) => Math.round(Number(v)).toString(16).padStart(2, '0')).join('').toUpperCase(); };
    const alphaOf = (c) => { const m = String(c).match(/[\d.]+/g) || []; return m.length > 3 ? Number(m[3]) : 1; };
    const roleOf = (el) => { const m = (el.closest('[class*="f-"]') || el).className.match(/f-(display|em|num|bodyb|body|mono)/); return m ? m[1] : 'body'; };
    // the highlighter colour of an emphasised phrase, when the tone draws one
    const emBg = (el) => { const p = document.createElement('i'); p.style.color = 'var(--em-bg)'; el.appendChild(p); const c = getComputedStyle(p).color; p.remove(); return alphaOf(c) > 0.5 ? hexOf(c) : null; };
    const texts = [];
    const SEL = '.t,.num,.mg,.slide-source,.foot,.lg,.chart-h>span:first-child,.cap,.pt-n,.sec-n,.q-m,.tm-m,.tm-b,.mono-av,.warn-badge';
    slide.querySelectorAll(SEL).forEach((el) => {
      if (el.closest('.custom') || el.closest('.dc')) return;
      if (el.parentElement && el.parentElement.closest(SEL) && !el.matches('.lg')) return;
      const str = el.textContent.replace(/\s+/g, ' ').trim();
      if (!str) return;
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const size = parseFloat(st.fontSize);
      const runs = [];
      const walk = (node, inh) => {
        node.childNodes.forEach((ch) => {
          if (ch.nodeType === 3) { if (ch.textContent) runs.push(Object.assign({ text: ch.textContent.replace(/\s+/g, ' ') }, inh)); return; }
          if (ch.nodeType !== 1 || ch.tagName === 'svg' || ch.tagName === 'I' || ch.tagName === 'IMG') return;
          const cs = getComputedStyle(ch);
          const bgc = cs.backgroundColor;
          walk(ch, { color: hexOf(cs.color), bold: Number(cs.fontWeight) >= 600, italic: cs.fontStyle === 'italic', sup: ch.tagName === 'SUP' && !ch.classList.contains('fn'), role: roleOf(ch),
            hl: ch.classList.contains('em') ? emBg(ch) : (alphaOf(bgc) > 0.5 && ch.classList.contains('needs') ? hexOf(bgc) : null), rel: parseFloat(cs.fontSize) / size });
        });
      };
      walk(el, { color: hexOf(st.color), bold: Number(st.fontWeight) >= 600, italic: st.fontStyle === 'italic', sup: false, role: roleOf(el), hl: null, rel: 1 });
      const lh = parseFloat(st.lineHeight);
      texts.push({ x: r.left, y: r.top, w: r.width, h: r.height, size, lh: isFinite(lh) ? lh : size * 1.2, align: st.textAlign === 'center' ? 'center' : (st.textAlign === 'right' || st.textAlign === 'end' ? 'right' : 'left'),
        upper: st.textTransform === 'uppercase', spacing: parseFloat(st.letterSpacing) || 0, nowrap: st.whiteSpace === 'nowrap' || st.whiteSpace === 'pre', rot: el.closest('.dg-rot') ? 270 : 0,
        center: el.matches('.tm-m,.tm-b,.mono-av'), strike: /line-through/.test(st.textDecorationLine || st.textDecoration || ''), title: el.matches('h1.title,blockquote.title'), runs });
    });
    const charts = [];
    slide.querySelectorAll('svg.chart').forEach((el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      const v = (n) => { const d = document.createElement('i'); d.style.color = 'var(' + n + ')'; el.parentElement.appendChild(d); const c = hexOf(getComputedStyle(d).color); d.remove(); return c; };
      charts.push({ x: r.left, y: r.top, w: r.width, h: r.height, donut: el.classList.contains('donut'), colors: { accent: v('--accent'), fill: v('--fill'), muted: v('--muted'), ink: v('--ink'), bg: v('--bg'), series: [1, 2, 3, 4, 5].map((k) => v('--s' + k)) } });
    });
    return { texts, charts };
  };
}
const PPTX_BG_CSS = 'html.pptx-bg .t,html.pptx-bg .t *,html.pptx-bg .num,html.pptx-bg .num *,html.pptx-bg .mg,html.pptx-bg .slide-source,html.pptx-bg .slide-source *,html.pptx-bg .foot,html.pptx-bg .lg,html.pptx-bg .chart-h>span:first-child,html.pptx-bg .cap,html.pptx-bg .cap *,html.pptx-bg .pt-n,html.pptx-bg .sec-n,html.pptx-bg .q-m,html.pptx-bg .tm-m,html.pptx-bg .tm-b,html.pptx-bg .mono-av,html.pptx-bg .warn-badge{color:transparent !important}' +
  'html.pptx-bg .em,html.pptx-bg .needs{background:transparent !important;border-color:transparent !important}html.pptx-bg svg.chart{visibility:hidden}html.pptx-bg .lg i{visibility:hidden}html.pptx-bg .grain{display:none}' +
  'html.pptx-bg .custom *{color:inherit}';

// editable: the ground, cells, diagrams, icons, images and donuts are one picture per slide;
// all text is native text at the measured position, bar, line and area charts are native charts.
async function buildPptxEditable(deck, theme, htmlPath, outPath) {
  const { browser, page } = await openDeckPage(htmlPath, 2);
  const pres = newPres(deck, theme);
  const web = deck.meta.pptx_fonts === 'web';
  // safe faces: a serif display face (theme or meta.font_display) maps to Georgia, not to a sans
  const SERIF = /serif|fraunces|newsreader|playfair|lora|merriweather|garamond|baskerville|crimson|spectral|caslon|cormorant|bitter|slab|georgia|times|libre bodoni|dm serif/i;
  const isSerif = (r) => (!/sans/i.test(r.family) && SERIF.test(r.family)) || (!theme.overrides['font-display'] && /,\s*serif\s*$/.test(r.css.match(/font-family:([^;]+)/)[1]));
  const safeDisplay = deck.meta.pptx_font_display || (isSerif(theme.roles.display) ? 'Georgia' : (theme.T['pptx-display'] || 'Arial'));
  const safeBody = deck.meta.pptx_font_body || (theme.T['pptx-body'] || 'Arial');
  const fmtCode = (ch) => { let d = 0; ch.series.forEach((se) => se.values.forEach((v) => { if (v != null) d = Math.max(d, Math.min(2, decimalsFor(v))); })); return d ? '#,##0.' + '0'.repeat(d) : '#,##0'; };
  const faceOf = (role) => {
    if (deck.meta.pptx_font_display && /display|num|em/.test(role)) return deck.meta.pptx_font_display;
    if (deck.meta.pptx_font_body && /body/.test(role)) return deck.meta.pptx_font_body;
    if (web) return theme.roles[role === 'bodyb' ? 'body' : role].family;
    if (role === 'mono') return /mono/i.test(theme.roles.mono.family) ? 'Courier New' : safeDisplay;
    if (role === 'em') return isSerif(theme.roles.em) ? 'Georgia' : safeDisplay;
    return role === 'body' || role === 'bodyb' ? safeBody : safeDisplay;
  };
  const X = (px) => px / 144;
  try {
    for (let i = 0; i < deck.slides.length; i++) {
      const s = deck.slides[i];
      await page.evaluate((k) => window.deck.go(k), i);
      const info = await page.evaluate(extractScript(), i);
      await page.addStyleTag({ content: PPTX_BG_CSS }).catch(() => {});
      await page.evaluate(() => document.documentElement.classList.add('pptx-bg'));
      const shot = await shootSlide(page, i);
      await page.evaluate(() => document.documentElement.classList.remove('pptx-bg'));
      const slide = pres.addSlide({ masterName: 'DECK' });
      slide.background = { color: hex(theme.tones[s.tone || theme.base].bg) };
      slide.addText(slideName(s, i), { placeholder: 'title' });
      slide.addImage({ data: shot.data, x: 0, y: 0, w: SW, h: SH });
      // native charts
      info.charts.forEach((c) => {
        const C = c.colors;
        const ch = s.chart;
        if (!ch) return;
        const kind = ch.kind;
        const type = kind === 'line' ? pres.charts.LINE : kind === 'area' ? pres.charts.AREA : pres.charts.BAR;
        const data = ch.series.slice(0, 5).map((se) => ({ name: se.name || ' ', labels: ch.labels, values: se.values.map((v) => (v == null ? '' : v)) }));
        const multi = data.length > 1;
        slide.addChart(type, data, {
          x: X(c.x), y: X(c.y), w: X(c.w), h: X(c.h), barDir: kind === 'horizontal_bar' ? 'bar' : 'col', barGrouping: kind === 'stacked_bar' ? 'stacked' : 'clustered', barGapWidthPct: 45,
          // one series of bars: every bar quiet, the latest one in the accent
          chartColors: multi || kind === 'line' || kind === 'area' ? C.series.slice(0, data.length) : ch.labels.map((_, k) => (k === (kind === 'horizontal_bar' ? 0 : ch.labels.length - 1) ? C.accent : C.fill)),
          catAxisLabelColor: C.muted, valAxisLabelColor: C.muted, catAxisLabelFontSize: 10, valAxisLabelFontSize: 10, catAxisLabelFontFace: faceOf('body'), valAxisLabelFontFace: faceOf('body'),
          valGridLine: { color: C.fill, size: 0.5 }, catGridLine: { style: 'none' }, valAxisLineShow: false, catAxisLineShow: true, valAxisMinVal: 0,
          showLegend: multi, legendPos: 't', legendColor: C.muted, legendFontSize: 10, legendFontFace: faceOf('body'), showValue: !!ch.show_values, dataLabelColor: C.ink, dataLabelFontSize: 10, dataLabelFormatCode: fmtCode(ch), valAxisLabelFormatCode: fmtCode(ch), lineSize: 3, lineDataSymbol: 'none',
          catAxisOrientation: kind === 'horizontal_bar' ? 'maxMin' : 'minMax',
        });
      });
      // native text, one box per text block
      info.texts.forEach((t) => {
        const runs = t.runs.filter((r) => r.text).map((r, k, all) => {
          let text = t.upper ? r.text.toUpperCase() : r.text;
          if (k === 0) text = text.replace(/^\s+/, '');
          if (k === all.length - 1) text = text.replace(/\s+$/, '');
          const o = { fontFace: faceOf(r.role), fontSize: Math.max(4, Math.round(t.size * r.rel * 0.5 * 10) / 10), color: r.color, bold: r.bold && !/display|num|em/.test(r.role) ? true : (r.role === 'display' || r.role === 'num') && theme.roles[r.role].weight >= 600, italic: r.italic, superscript: r.sup };
          if (r.sup) o.fontSize = Math.max(4, Math.round(t.size * 0.5 * 10) / 10);
          if (r.hl) o.highlight = r.hl;
          if (t.strike) o.strike = 'sngStrike';
          return { text, options: o };
        }).filter((r) => r.text);
        if (!runs.length) return;
        let x = t.x, y = t.y, w = t.w, h = t.h;
        if (t.rot) { const cx = t.x + t.w / 2, cy = t.y + t.h / 2; w = t.h; h = t.w; x = cx - w / 2; y = cy - h / 2; }
        slide.addText(runs, { x: X(x), y: X(y), w: X(w + (t.nowrap ? 40 : 0)), h: X(h), margin: 0, valign: t.center ? 'middle' : 'top', align: t.center ? 'center' : t.align, wrap: !t.nowrap, fit: 'none',
          lineSpacing: Math.round(t.lh * 0.5 * 10) / 10, charSpacing: Math.round(t.spacing * 0.5 * 10) / 10, rotate: t.rot || 0 });
      });
      const notes = notesText(s);
      if (notes) slide.addNotes(notes);
    }
  } finally { await browser.close().catch(() => {}); }
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
// --------------------------------------------------------------------------------------
// 7. QA screenshots and render checks (--check, needs playwright-core)
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

// Runs inside the page, on the active slide. Reports text that leaves the stage or the
// content frame, is clipped, overlaps other text, is set below the size floor, or has
// less than 4.5:1 contrast against the ground it sits on.
function pageCheckScript() {
  return function (dims) {
    const W = dims.W, H = dims.H;
    const slide = document.querySelector('.slide.active');
    const issues = [];
    if (!slide) return ['no active slide'];
    const quote = (el) => '"' + (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) + '"';
    const rgba = (c) => { const m = String(c).match(/[\d.]+/g) || []; return { r: +m[0] || 0, g: +m[1] || 0, b: +m[2] || 0, a: m.length > 3 ? +m[3] : 1 }; };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    // the colour a piece of text sits on: a ground named by the renderer, else the nearest filled ancestor
    const groundOf = (el) => {
      const named = el.closest('[data-ground]');
      if (named) { const probe = document.createElement('i'); probe.style.color = 'var(' + named.getAttribute('data-ground') + ')'; named.appendChild(probe); const c = rgba(getComputedStyle(probe).color); probe.remove(); if (c.a > 0.9) return c; el = named.parentElement || el; }
      for (let p = el; p; p = p.parentElement) { const c = rgba(getComputedStyle(p).backgroundColor); if (c.a > 0.9) return c; if (p === slide) break; }
      return rgba(getComputedStyle(slide).backgroundColor);
    };
    const leaves = [];
    slide.querySelectorAll('*').forEach((el) => {
      if (el.closest('.custom') || el.closest('.dc') || el.closest('[aria-hidden="true"]') || el.closest('.grain')) return;
      const inSvg = !!el.closest('svg');
      if (inSvg && el.tagName !== 'text') return;
      const hasText = Array.from(el.childNodes).some((nd) => nd.nodeType === 3 && nd.textContent.trim());
      if (!hasText) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const cs = getComputedStyle(el);
      // size floor: running text against the body floor, marginalia and chart labels against the small one
      let px = parseFloat(cs.fontSize);
      if (inSvg) { const svg = el.closest('svg'); const vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 1; px *= vb; }
      const small = inSvg || el.closest('.f-mono, .mg, .slide-source, .foot, .cap, .ref, .st-s, sup, .needs, .lg, .warn-badge, .lbl');
      const floor = small ? dims.small : dims.body;
      if (px < floor - 0.4) issues.push('text below the size floor (' + Math.round(px * 10) / 10 + 'px, floor ' + floor + 'px): ' + quote(el));
      // contrast
      if (!el.classList.contains('needs') && !el.closest('.needs') && !el.classList.contains('warn-badge')) {
        const fg = rgba(inSvg ? cs.fill : cs.color);
        if (fg.a > 0.5) { const cr = ratio(fg, groundOf(el)); if (cr < 4.5) issues.push('text contrast ' + cr.toFixed(1) + ':1 is under 4.5:1: ' + quote(el)); }
      }
      if (inSvg) return;
      // an inline run is covered by its block, whose box is the one that can collide
      if (cs.display !== 'inline') leaves.push({ el, r, label: (el.textContent || '').trim().slice(0, 40) });
      if (r.right > W + 1 || r.bottom > H + 1 || r.left < -1 || r.top < -1) issues.push('text leaves the stage: ' + quote(el));
      // an inline run (an emphasised phrase) is judged by the block it sits in
      const inline = cs.display === 'inline';
      if (!inline && !el.closest('.foot, .slide-source, .mg') && !el.classList.contains('warn-badge') && (r.bottom > H - 76 || r.top < 84 || r.left < 60 || r.right > W - 60)) issues.push('text outside the content frame: ' + quote(el));
      if (el.matches('.slide-source') && el.getAttribute('data-max') && r.width > Number(el.getAttribute('data-max')) + 4) issues.push('the source caption is wider than the room it has (it crosses a panel edge or the footer): ' + quote(el));
      if (el.matches('.t, .num') && el.scrollWidth > el.clientWidth + 2) issues.push('text is wider than its box: ' + quote(el));
      // text must stay inside its cell
      const box = el.closest('.cell, .dg-box');
      if (box && !inline) { const b = box.getBoundingClientRect(); if (r.bottom > b.bottom + 2 || r.right > b.right + 2 || r.top < b.top - 2 || r.left < b.left - 2) issues.push('text leaves its cell: ' + quote(el)); }
      for (let p = el.parentElement; p && p !== slide; p = p.parentElement) {
        const ps = getComputedStyle(p);
        if (ps.overflow === 'hidden' || ps.overflowY === 'hidden') { if (p.scrollHeight > p.clientHeight + 2 || p.scrollWidth > p.clientWidth + 2) issues.push('text clipped by its container: ' + quote(el)); break; }
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
    // neighbouring series colours (donut slices, stacked or grouped bars, lines, legend swatches) must be told apart
    const seriesRun = (els, prop, what) => {
      const cols = []; els.forEach((el) => { const c = getComputedStyle(el)[prop]; if (c && c !== 'none' && rgba(c).a > 0.5 && c !== cols[cols.length - 1]) cols.push(c); });
      for (let k = 1; k < cols.length; k++) if (ratio(rgba(cols[k]), rgba(cols[k - 1])) < 1.25) { issues.push(what + ': two neighbouring series colours are too close to tell apart'); break; }
    };
    slide.querySelectorAll('svg.donut').forEach((d) => seriesRun(d.querySelectorAll('g circle'), 'stroke', 'donut'));
    slide.querySelectorAll('.lgs, .fd-l').forEach((g) => seriesRun(g.querySelectorAll('i'), 'backgroundColor', 'chart legend'));
    // images and charts must stay inside the stage too
    slide.querySelectorAll('svg.chart, svg.donut, .dg, .fr, .tb').forEach((el) => {
      if (el.closest('.custom')) return;
      const r = el.getBoundingClientRect(); const box = el.closest('.cell');
      if (!box) return; const b = box.getBoundingClientRect();
      if (r.bottom > b.bottom + 3 || r.right > b.right + 3) issues.push('a ' + (el.classList[0] || 'block') + ' leaves its cell by ' + Math.round(Math.max(r.bottom - b.bottom, r.right - b.right)) + 'px');
    });
    return Array.from(new Set(issues));
  };
}

async function runCheck(htmlPath, outDir, slideCount, variant, slack) {
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
    const loaded = Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, ''));
    return { loaded: Array.from(new Set(loaded)), linked: !!document.querySelector('link[href*="fonts.googleapis.com"]') };
  });
  if (fonts.loaded.length) log('  QA fonts: ' + fonts.loaded.join(', ') + ' (web fonts loaded)');
  else if (fonts.linked) warn('web fonts did not load (offline or blocked); QA measured the fallback fonts. Re-run --check online before trusting a clean result.');
  const report = [];
  let issueCount = 0;
  for (let i = 0; i < slideCount; i++) {
    await page.evaluate((k) => window.deck.go(k), i);
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
    await page.waitForTimeout(100);
    const file = path.join(qaDir, 'slide-' + String(i + 1).padStart(2, '0') + '.png');
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: STAGE_W, height: STAGE_H } });
    const issues = await page.evaluate(pageCheckScript(), { W: STAGE_W, H: STAGE_H, body: FLOOR.body[variant] || FLOOR.body.present, small: FLOOR.small });
    issueCount += issues.length;
    const thin = (slack || []).filter((m) => m.indexOf('slide ' + (i + 1) + ' ') === 0).map((m) => m.replace(/^slide \d+ \([^)]*\): /, 'slack: '));
    report.push({ slide: i + 1, file: path.relative(outDir, file), issues, slack: thin });
    if (issues.length) log('  slide ' + (i + 1) + ': ' + issues.slice(0, 6).join('; ') + (issues.length > 6 ? '; +' + (issues.length - 6) + ' more' : ''));
  }
  await browser.close();
  fs.writeFileSync(path.join(qaDir, 'report.json'), JSON.stringify(report, null, 2));
  log('  QA: ' + slideCount + ' screenshots in ' + rel(qaDir) + '/, ' + issueCount + ' issue' + (issueCount === 1 ? '' : 's') + ((slack || []).length ? ', ' + slack.length + ' slack warning' + (slack.length === 1 ? '' : 's') : '') + ' (report.json)');
}

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
// --------------------------------------------------------------------------------------
// 9. main
// --------------------------------------------------------------------------------------

function chromeAvailable() {
  if (process.env.PITCH_NO_BROWSER) return false;      // for testing the fallback
  try { require.resolve('playwright-core'); } catch (e) { return false; }
  return !!findChrome();
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const themesCss = loadThemesCss();
  if (opts.measure) {
    const themes = themeNames(themesCss).map((n) => resolveTheme({ theme: n }, themesCss));
    const got = await measureRoles(themes, true);
    const want = []; themes.forEach((T) => Object.keys(T.roles).forEach((k) => { if (!want.includes(T.roles[k].css)) want.push(T.roles[k].css); }));
    const missing = want.filter((c) => !got[c]);
    if (missing.length) { console.error('Could not measure ' + missing.length + ' of ' + want.length + ' type roles (Chrome and network are needed). font-metrics.json left as it was.'); process.exit(1); }
    fs.writeFileSync(METRICS_PATH, '{\n' + want.map((c) => JSON.stringify(c) + ': ' + JSON.stringify(got[c])).join(',\n') + '\n}\n');
    log('Measured ' + want.length + ' type roles of ' + themes.length + ' themes into ' + rel(METRICS_PATH));
    return;
  }
  if (opts.capacities) { console.log(capacityMarkdown()); return; }

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
  const theme = resolveTheme(deck.meta, themesCss);
  let mode = String(opts.pptxMode || deck.meta.pptx || 'faithful').toLowerCase();
  if (!['none', 'faithful', 'editable'].includes(mode)) { warn('meta.pptx "' + deck.meta.pptx + '" is not none, faithful or editable; using faithful'); mode = 'faithful'; }
  if (!opts.pptx) mode = 'none';

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
  }
  deck.slides = paginateSources(deck.slides);
  prepareDeck(deck, theme, ctx);
  log('Building "' + deck.meta.company + '" with theme ' + theme.name + ', variant ' + deck.meta.variant + ' (' + deck.slides.length + ' slides)');
  if (ledger) {
    if (ctx.missingFacts.length) { warn(ctx.missingFacts.length + ' source id(s) not in ' + rel(factsPath) + ':'); ctx.missingFacts.forEach((m) => log('    ' + m)); }
    ctx.kindMismatch.forEach((m) => warn(m));
  }

  // Images: logo, slide images, team photos, logo files.
  const logo = resolveImage(deck.meta.logo, inputDir, outDir, 'meta.logo');
  ctx.logo = logo ? logo.html : null;
  ctx.logoFile = logo;
  const logoLight = resolveImage(deck.meta.logo_light, inputDir, outDir, 'meta.logo_light');
  ctx.logoLight = logoLight ? logoLight.html : null;
  ctx.rasters = {};
  const imgFiles = deck.slides.map((s, i) => (s.images || []).map((im) => { const r = resolveImage(im.src, inputDir, outDir, 'slide ' + (i + 1)); return r ? { src: r.html, file: r, frame: im.frame } : null; }).filter(Boolean));
  ctx.slideImages = imgFiles;
  deck.slides.forEach((s, i) => { if (!imgFiles[i].length) { s.images = []; s.image = undefined; } (s.logos || []).forEach((l) => { const r = l.image ? resolveImage(l.image, inputDir, outDir, 'slide ' + (i + 1) + ' logo') : null; l.src = r ? r.html : null; }); });
  const teamFiles = deck.slides.map((s, i) => s.team.map((m) => resolveImage(m && m.photo, inputDir, outDir, 'slide ' + (i + 1) + ' team')));
  ctx.teamPhotos = teamFiles.map((arr) => arr.map((r) => (r ? r.html : null)));

  // Faces the metrics file does not know (font overrides) are measured in Chrome when it is there.
  const measured = await measureRoles([theme], false);
  if (Object.keys(measured).length) log('  fonts: ' + Array.from(new Set(Object.keys(theme.roles).filter((k) => measured[theme.roles[k].css]).map((k) => theme.roles[k].family))).join(' and ') + ' measured in Chrome for the capacity lint');
  else if (Object.keys(theme.roles).some((k) => !roleWidths(theme.roles[k]))) log('  fonts: no measurements for ' + Array.from(new Set(Object.keys(theme.roles).filter((k) => !roleWidths(theme.roles[k])).map((k) => theme.roles[k].family))).join(', ') + ' (no Chrome or offline); the capacity lint uses its family tables');

  // Render once. The same pass is the pre-flight lint: one line per thing that does not fit.
  const out = renderDeck(deck, theme, ctx);
  if (out.issues.length) {
    log('  capacity: ' + out.issues.length + ' warning' + (out.issues.length === 1 ? '' : 's') + ' (what fits per slide type: node scripts/build_deck.js --capacities)');
    out.issues.forEach((m) => log('    ' + m));
    if (opts.strict) { console.error('  --strict: stopping because of capacity warnings. Fix deck.json and rebuild.'); process.exit(1); }
  } else log('  capacity: all slides within their layout budgets');
  if (out.slack.length) {
    log('  slack: ' + out.slack.length + ' slide area' + (out.slack.length === 1 ? '' : 's') + ' mostly empty (not an error; the deck will look thin there)');
    out.slack.forEach((m) => log('    ' + m));
  }
  else log('  slack: none');
  ctx.slack = out.slack;
  if (out.unknownIcons.length) log('  icons: unknown name' + (out.unknownIcons.length === 1 ? '' : 's') + ' ' + out.unknownIcons.join(', ') + ' (drawn as a plain mark; the available names are in assets/deck-template/icons.json)');
  log('  tones: ' + deck.slides.map((s) => s.tone.charAt(0).toUpperCase()).join(' ') + '  (L light, D dark, A accent)');

  const srcPages = deck.slides.filter((s) => s.type === 'sources' && s.items);
  if (srcPages.length) {
    const files = srcPages[0].groups ? srcPages[0].fileCount + (srcPages[0].fileCount === 1 ? ' file, ' : ' files, ') : '';
    log('  sources appendix: ' + files + ctx.sourceItems.length + ' figures, ' + srcPages.length + (srcPages.length === 1 ? ' page' : ' pages') +
      (srcPages[0].groups ? '' : (ledger ? ' (meta.sources: "full")' : ' (no facts.yaml: reference list)')));
  } else if (ctx.sourceItems.length) log('  sources appendix: off (' + ctx.sourceItems.length + ' figures referenced)');

  if (ctx.placeholders.length) {
    log('  ' + ctx.placeholders.length + ' placeholder' + (ctx.placeholders.length === 1 ? '' : 's') + ' marked "[needs number]" or "[needs detail]":');
    ctx.placeholders.forEach((p) => log('    ' + p));
  }

  const htmlPath = path.join(outDir, base + '.html');
  if (opts.html || mode === 'faithful' || mode === 'editable') {
    fs.writeFileSync(htmlPath, buildHtml(deck, theme, ctx, out.html));
    log('  wrote ' + rel(htmlPath) + ' (' + Math.round(fs.statSync(htmlPath).size / 1024) + ' KB)');
  }

  if (mode !== 'none') {
    const pptxPath = path.join(outDir, base + '.pptx');
    try {
      let done = false;
      if (chromeAvailable()) {
        try {
          if (mode === 'faithful') {
            const r = await buildPptxFaithful(deck, theme, htmlPath, pptxPath);
            log('  wrote ' + rel(pptxPath) + ' (faithful: ' + deck.slides.length + ' slides as 2x pictures' + (r.jpeg ? ', ' + r.jpeg + ' as JPEG' : '') + ', ' + (fs.statSync(pptxPath).size / 1048576).toFixed(1) + ' MB; text is not editable, use --pptx editable for that)');
          } else {
            await buildPptxEditable(deck, theme, htmlPath, pptxPath);
            log('  wrote ' + rel(pptxPath) + ' (editable: native text and charts over a picture of each slide\'s ground, ' + (fs.statSync(pptxPath).size / 1048576).toFixed(1) + ' MB)');
          }
          done = true;
        } catch (e) { warn('the ' + mode + ' PPTX could not be rendered in Chrome (' + String(e && e.message || e).split('\n')[0] + '); writing the native PPTX instead'); }
      } else log('  pptx: Chrome or playwright-core is not available, so the ' + mode + ' PPTX cannot be rendered; writing the native PPTX instead (single tone, simpler layouts, fully editable). Install Chrome and run npm install in scripts/ for the designed version.');
      if (!done) {
        const nctx = Object.assign({}, ctx, { images: imgFiles.map((a) => (a[0] ? a[0].file : null)), teamPhotos: teamFiles });
        const allImages = [ctx.logoFile].concat(nctx.images, teamFiles.reduce((a, b) => a.concat(b), []));
        nctx.rasters = await rasteriseSvgs(allImages);
        const ok = await buildPptxNative(nativeDeck(deck), theme, pptxPath, nctx);
        if (ok) log('  wrote ' + rel(pptxPath) + ' (native)');
      }
      if (fs.existsSync(pptxPath)) checkPptx(pptxPath, deck.slides.length);
    } catch (e) {
      console.error('  PPTX failed: ' + (e && e.stack || e));
      process.exitCode = 1;
    }
  }

  if (opts.check) {
    if (!fs.existsSync(htmlPath)) log('  --check needs deck.html; build without --pptx-only first');
    else await runCheck(htmlPath, outDir, deck.slides.length, deck.meta.variant, ctx.slack);
  }
}

// The native renderer knows the older slide types: map the newer ones onto them.
function nativeDeck(deck) {
  return { meta: deck.meta, slides: deck.slides.map((s) => {
    const o = Object.assign({}, s, { title: stripEm(s.title || '') });
    if (s.type === 'section') o.type = 'statement';
    if (s.diagram && !o.points.length) {
      const d = s.diagram;
      const line = (x) => (typeof x === 'string' ? x : [x.when, x.title || x.label || x.name || x.what, x.value, x.text || x.proves].filter(Boolean).join(': '));
      o.points = asArray(d.steps || d.stages || d.items || d.nodes || d.layers || d.rings || [d.before, d.after].filter(Boolean)).slice(0, 5).map(line);
    }
    if (s.type === 'quote') { o.type = 'statement'; o.title = '“' + stripEm(s.quote || '') + '”'; o.subtitle = [s.by || s.name, s.role].filter(Boolean).join(', '); }
    return o;
  }) };
}


if (require.main === module) main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
module.exports = { FORMS, probe, formFields, formLimit, sampleText, sampleTitle, GLYPH_SET, textPx, tw, resolveTheme, loadThemesCss, themeNames, lintDeck, renderDeck, normaliseDeck, prepareDeck, capacityMarkdown, iconNames, DIAGRAM_KINDS, contrast };
