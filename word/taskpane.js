// Screenplay Editor for Word — the pane. The markup and stylesheet are the
// extension's own side panel (built by build-pane.py); this file wires its
// controls to Word through word-adapter.js, on the shared engine.
//
// This page is also the add-in's shared runtime: the ribbon buttons, the
// context menu and the keyboard shortcuts land here through
// Office.actions.associate.

import { ELEMENTS } from './classifier.js';
import {
  ensureStyles, applyElement, formatDocument, addPageNumbers,
  currentElement, startLiveWriting, startEmptyDocument, liveCounts, capabilities,
  formatScope, insertTitlePage, addSceneNumbers, removeSceneNumbers,
  importFountainText, exportFountainText, docStats,
  readParagraphs, exportFdxText, exportPdfBlob, importTyped,
} from './word-adapter.js';
import { parseFdx, parseFadeIn, parseCeltx, unzipEntry } from './importers.js';
import { computeScriptStats } from './stats-core.js';

const E = globalThis.SEEngine;
const API = 'https://screenplay-editor-api.hugopthomas.workers.dev';
const VERSION = '6.7.3';

const $ = (id) => document.getElementById(id);

let isMac = false;
let stylesReady = false;
let paper = 'US';
let uiMode = null;
let uiEmpty = true;
let hot = false; // Format my document in violet, after an import

// ---------------------------------------------------------------------------
// Ribbon, context menu, shortcuts → functions. Registered before Office.onReady.
// ---------------------------------------------------------------------------
const ACTIONS = {
  SE_SceneHeading: () => runElement('SCENE_HEADING', 'shortcut'),
  SE_Action: () => runElement('ACTION', 'shortcut'),
  SE_Character: () => runElement('CHARACTER', 'shortcut'),
  SE_Parenthetical: () => runElement('PARENTHETICAL', 'shortcut'),
  SE_Dialogue: () => runElement('DIALOGUE', 'shortcut'),
  SE_Transition: () => runElement('TRANSITION', 'shortcut'),
  SE_CycleNext: () => Promise.resolve(),
  SE_CyclePrev: () => Promise.resolve(),
  SE_FormatDocument: () => runFormat(),
};
for (const [id, fn] of Object.entries(ACTIONS)) {
  try {
    Office.actions.associate(id, (event) => fn().catch(() => {}).finally(() => {
      try { if (event && typeof event.completed === 'function') event.completed(); } catch (_e) { /* not a ribbon event */ }
    }));
  } catch (_e) { /* no shared runtime */ }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
Office.onReady(async (info) => {
  $('version').textContent = 'v' + VERSION;
  if (info.host !== Office.HostType.Word) {
    const q = new URLSearchParams(location.search);
    const m = q.get('preview');
    if (m) { isMac = true; (q.get('theme') || '').split(',').filter(Boolean).forEach((t) => document.body.classList.add('se-' + t)); buildRail(); buildPill(); wireUi(); paintMode(m, false, false); switchTab(q.get('tab') || 'home'); if (q.get('empty')) paintEmpty(true); if (q.get('spark')) setTimeout(() => sparkle($('format-doc-btn')), 600); if (q.get('hot')) setHot(true, '<b>Imported.</b> 118 paragraphs came in. One click puts everything in its place.'); return; }
    setStatus('Screenplay Editor runs in Word.', 'error');
    return;
  }
  isMac = Office.context.platform === Office.PlatformType.Mac;
  paper = loadPaper();
  buildRail();
  buildPill();
  wireUi();
  paintPaper();
  track('sidebar_open');
  // No startup auto-load: with a sideloaded manifest, Word answers « Ce complément
  // n'est plus disponible » at the next launch (Hugo, 15/09). The ribbon opens the pane.
  try { Office.addin.setStartupBehavior(Office.StartupBehavior.none); } catch (_e) { /* optional */ }

  try {
    const caps = await ensureStyles(paper);
    stylesReady = true;
    if (!caps.chain) setStatus('This Word cannot chain styles: Enter will not switch elements by itself.', 'error');
    await startEmptyDocument();
    await startLiveWriting(onLiveChange, () => {});
  } catch (e) {
    setStatus(friendly(e), 'error');
  }
  try {
    const cur = await currentElement();
    paintMode(cur.type, cur.empty, false);
  } catch (_e) { /* nothing selected yet */ }
  refreshStats();
});

function onLiveChange(type, what) {
  if (!(what && what.empty)) paintEmpty(false);
  paintMode(type, !!(what && what.empty), true);
  if (what && what.nudge) nudgeRail();
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function switchTab(name) {
  for (const t of ['home', 'studio', 'export']) {
    const b = $('tab-btn-' + t); const p = $('panel-' + t);
    if (b) b.classList.toggle('active', t === name);
    if (p) { const was = p.classList.contains('active'); p.classList.toggle('active', t === name); if (t === name && !was) { p.classList.remove('se-in'); void p.offsetWidth; p.classList.add('se-in'); } }
  }
  track('tab_' + (name === 'home' ? 'home' : name === 'studio' ? 'tools' : 'export'));
}

// ---------------------------------------------------------------------------
// The rail: the shortcuts grid of the extension, made live.
// ---------------------------------------------------------------------------
function buildRail() {
  document.querySelectorAll('.se-el[data-mode]').forEach((el) => {
    const c = E.BADGE_COLORS[el.dataset.mode] || E.BADGE_COLORS.ACTION;
    el.style.setProperty('--tint', c.tint);
    el.style.setProperty('--ink', c.ink);
    el.style.setProperty('--duo', 'transparent');
    el.style.setProperty('--icon', c.ink);
    el.style.setProperty('--grad', c.grad);
    el.style.setProperty('--glow', c.glow);
    el.addEventListener('mousedown', (e) => e.preventDefault());
    el.addEventListener('click', () => runElement(el.dataset.mode, 'rail'));
  });
}

function highlightRail(mode) {
  document.querySelectorAll('.se-el[data-mode]').forEach((el) => el.classList.toggle('active', el.dataset.mode === mode));
}

function nudgeRail() {
  const grid = $('rail');
  if (!grid) return;
  try {
    grid.querySelectorAll('.se-el').forEach((k, i) => {
      k.animate([{ filter: 'none' }, { filter: 'drop-shadow(0 0 7px rgba(124,58,237,0.7)) saturate(1.4)' }, { filter: 'none' }],
        { duration: 380, delay: 110 * i, easing: 'ease-in-out' });
    });
  } catch (_e) { /* no Web Animations */ }
}

// ---------------------------------------------------------------------------
// What Enter and Tab will do, above the rail. The active tile says the element.
// ---------------------------------------------------------------------------
function buildPill() { /* the hint row lives in the markup (build-pane.py) */ }

function paintPill(mode, lineEmpty) {
  if (hot) return; // the import sentence stays until the next change of element
  const c = E.pillContent(mode || 'ACTION', lineEmpty);
  const low = (m) => E.MODE_LABELS[m].toLowerCase();
  const GLYPH = { Enter: '↵', Tab: '⇥' };
  const key = (k) => `<kbd class="se-key">${k}${GLYPH[k] ? ` <span class="se-key-glyph">${GLYPH[k]}</span>` : ''}</kbd>`;
  const parts = [];
  if (c.enter) parts.push(`${key('Enter')} takes you to ${low(c.enter)}`);
  else if (c.scene) parts.push(`Write ${key('INT.')} for a scene heading`);
  if (c.tab) parts.push(`${key('Tab')} for ${low(c.tab)}`);
  const tail = parts.length ? parts.join(', ') + '.' : '';
  const h = $('pill-hints');
  if (h) h.innerHTML = `<span class="se-voice-line">You're in <b>${low(c.mode)}</b>.</span>${tail ? `<span class="se-voice-tip">${tail}</span>` : ''}`;
  const d = $('pill-dot');
  if (d) d.style.background = c.colors.grad;
}

// Format my document turns violet when it is the thing to do (after an import), and quiet again once done.
function setHot(on, sentence) {
  hot = !!on;
  const b = $('format-doc-btn');
  if (b) b.classList.toggle('se-primary-hot', hot);
  if (hot && sentence) {
    const h = $('pill-hints'); if (h) h.innerHTML = sentence;
    const d = $('pill-dot'); if (d) d.style.background = '#6f57ff';
  }
}

// The blank page: an illustration instead of the sentence, gone at the first word.
function paintEmpty(isEmpty) {
  const e = $('se-empty'); const v = $('pill');
  if (!e || !v) return;
  e.hidden = !isEmpty;
  v.hidden = !!isEmpty;
}

// A small rain of sparks over a button, once.
function sparkle(el) {
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 7; i++) {
    const sp = document.createElement('span');
    sp.className = 'se-spark';
    sp.textContent = i % 2 ? '✦' : '✧';
    sp.style.left = (r.left + 12 + Math.random() * (r.width - 24)) + 'px';
    sp.style.top = (r.top + r.height / 2) + 'px';
    sp.style.setProperty('--dx', (Math.random() * 40 - 20).toFixed(0) + 'px');
    sp.style.setProperty('--dy', (-30 - Math.random() * 40).toFixed(0) + 'px');
    sp.style.animationDelay = (Math.random() * 120) + 'ms';
    document.body.appendChild(sp);
    setTimeout(() => sp.remove(), 1100);
  }
}

// The active pill pulses once when the element changes.
function pulseRail(mode) {
  const el = document.querySelector(`.se-el[data-mode="${mode}"]`);
  if (!el) return;
  el.classList.remove('se-pulse'); void el.offsetWidth; el.classList.add('se-pulse');
}

function paintMode(mode, lineEmpty, animate) {
  const changed = mode !== uiMode;
  if (changed && hot && uiMode !== null) setHot(false);
  if (changed && animate) pulseRail(mode);
  uiMode = mode;
  uiEmpty = !!lineEmpty;
  highlightRail(mode);
  paintPill(mode, uiEmpty);
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
function wireUi() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-se]');
    if (!el) return;
    const se = el.dataset.se;
    if (se.startsWith('tab:')) { switchTab(se.slice(4)); return; }
    e.preventDefault();
    handle(se, el).catch((err) => setStatus(friendly(err), 'error'));
  });
  const fileInput = $('import-file-input');
  if (fileInput) {
    fileInput.accept = '.fountain,.txt,.fdx,.fadein,.celtx';
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      const name = f.name.toLowerCase();
      try {
        setStatus('Reading your screenplay…');
        if (!stylesReady) { await ensureStyles(paper); stylesReady = true; }
        let n = 0;
        if (name.endsWith('.fdx')) n = await importTyped(parseFdx(await f.text()));
        else if (name.endsWith('.fadein')) n = await importTyped(parseFadeIn(await unzipEntry(await f.arrayBuffer(), (x) => /document\.xml$/i.test(x))));
        else if (name.endsWith('.celtx')) n = await importTyped(parseCeltx(await unzipEntry(await f.arrayBuffer(), (x) => /\.html?$/i.test(x))));
        else n = await importFountainText(await f.text());
        setStatus(`${n} paragraphs imported.`, 'ok');
        paintEmpty(false);
        if (name.endsWith('.fountain') || name.endsWith('.txt')) setHot(true, `<b>Imported.</b> ${n} paragraphs came in. One click puts everything in its place.`);
        else { const h = $('pill-hints'); if (h) h.innerHTML = `<span class="se-voice-line"><b>Imported.</b></span><span class="se-voice-tip">${n} paragraphs, each with its element. Nothing to format.</span>`; }
        track('import_fountain', { kind: name.split('.').pop() });
        refreshStats();
      } catch (err) { setStatus(friendly(err), 'error'); }
      fileInput.value = '';
    });
  }
}

async function handle(se, el) {
  switch (se) {
    case 'format': return runFormat();
    case 'scene': {
      if (!stylesReady) { await ensureStyles(paper); stylesReady = true; }
      const s = await formatScope('scene');
      setStatus(`Scene formatted, ${s.paragraphs} paragraphs.`, 'ok');
      track('smart_format', { via: 'scene' });
      return;
    }
    case 'selection': {
      if (!stylesReady) { await ensureStyles(paper); stylesReady = true; }
      const s = await formatScope('selection');
      setStatus(`Selection formatted, ${s.paragraphs} paragraphs.`, 'ok');
      track('smart_format', { via: 'selection' });
      return;
    }
    case 'titlepage': { const f = $('se-titlepage'); f.hidden = !f.hidden; if (!f.hidden) $('tp-title').focus(); return; }
    case 'titlepage-cancel': $('se-titlepage').hidden = true; return;
    case 'titlepage-insert': {
      if (!stylesReady) { await ensureStyles(paper); stylesReady = true; }
      await insertTitlePage($('tp-title').value.trim(), $('tp-author').value.trim(), $('tp-contact').value.trim());
      $('se-titlepage').hidden = true;
      setStatus('Title page inserted.', 'ok');
      track('title_page');
      return;
    }
    case 'sn-add': { const n = await addSceneNumbers(); setStatus(`${n} scenes numbered.`, 'ok'); track('scene_numbers'); return; }
    case 'sn-remove': { const n = await removeSceneNumbers(); setStatus(`${n} scene numbers removed.`, 'ok'); return; }
    case 'pages': await addPageNumbers(); setStatus('Page numbers added, top right.', 'ok'); track('scene_numbers', { what: 'page_numbers' }); return;
    case 'paper': {
      paper = el.dataset.paper || 'US';
      savePaper(paper);
      paintPaper();
      await ensureStyles(paper);
      setStatus(paper === 'A4' ? 'Page set to A4.' : 'Page set to US Letter.', 'ok');
      return;
    }
    case 'import': { const i = $('import-file-input'); if (i) i.click(); return; }
    case 'export-fountain': {
      setStatus('Writing the Fountain file…');
      const text = await exportFountainText();
      download(docTitle() + '.fountain', new Blob([text], { type: 'text/plain' }));
      let copied = false;
      try { await navigator.clipboard.writeText(text); copied = true; } catch (_e) { /* no clipboard in this webview */ }
      setStatus(copied ? 'Fountain file saved, and copied to the clipboard.' : 'Fountain file saved.', 'ok');
      track('export_fountain');
      return;
    }
    case 'export-fdx': {
      setStatus('Writing the Final Draft file…');
      const xml = await exportFdxText();
      download(docTitle() + '.fdx', new Blob([xml], { type: 'application/xml' }));
      setStatus('Final Draft file saved. Open it in Final Draft.', 'ok');
      track('export_fdx');
      return;
    }
    case 'export-pdf': {
      setStatus('Asking Word for the PDF…');
      const blob = await exportPdfBlob();
      download(docTitle() + '.pdf', blob);
      setStatus('PDF saved.', 'ok');
      track('export_pdf');
      return;
    }
    case 'stats': return refreshStats();
    case 'stats-open': return openStatsDialog();
    case 'shortcuts-info': { const i = $('shortcuts-info'); if (i) i.style.display = i.style.display === 'none' ? 'block' : 'none'; return; }
    case 'feedback': setStatus('Write to hugo@screenplayeditor.app, every message is read.', 'ok'); return;
    case 'soon': setStatus('On its way to Word. Already in the Google Docs extension.', 'ok'); return;
    default: return;
  }
}

async function runElement(type, origin) {
  if (!ELEMENTS.includes(type)) return;
  try {
    if (!stylesReady) { await ensureStyles(paper); stylesReady = true; }
    await applyElement(type);
    paintMode(type, uiEmpty, true);
    if (origin === 'rail') track('rail_click', { type });
    else track('smart_format', { type, via: 'shortcut' });
  } catch (e) {
    setStatus(friendly(e), 'error');
  }
}

async function runFormat() {
  setStatus('Reading your scenes…');
  try {
    if (!stylesReady) { await ensureStyles(paper); stylesReady = true; }
    const stats = await formatDocument();
    const n = stats.paragraphs;
    const lines = [`${n} paragraphs in place. Take a bow.`, `All set. ${n} paragraphs, each where it belongs.`, `${n} paragraphs, every one in its right place.`, `Done. ${n} paragraphs. Undo brings everything back.`];
    setStatus(lines[Math.floor(Math.random() * lines.length)], 'ok');
    setHot(false); paintPill(uiMode, uiEmpty);
    const b = $('format-doc-btn'); if (b) { b.classList.remove('se-done'); void b.offsetWidth; b.classList.add('se-done'); sparkle(b); }
    track('format_document', { paragraphs: stats.paragraphs, removed: stats.removed });
    refreshStats();
  } catch (e) {
    setStatus(friendly(e), 'error');
  }
}

// Script Stats live in a dialog (the pane is too narrow). The dialog asks, the pane answers.
let statsDialog = null;
async function openStatsDialog() {
  const url = new URL('stats.html', location.href).href;
  if (statsDialog) { try { statsDialog.close(); } catch (_e) { /* gone */ } statsDialog = null; }
  await new Promise((resolve, reject) => {
    Office.context.ui.displayDialogAsync(url, { height: 78, width: 56, displayInIframe: false }, (res) => {
      if (res.status !== Office.AsyncResultStatus.Succeeded) return reject(new Error(res.error && res.error.message || 'Word could not open the window.'));
      statsDialog = res.value;
      statsDialog.addEventHandler(Office.EventType.DialogMessageReceived, async (arg) => {
        if (arg.message !== 'scan') return;
        try {
          const paras = await readParagraphs();
          statsDialog.messageChild(JSON.stringify(computeScriptStats(paras)));
        } catch (e) { try { statsDialog.messageChild(JSON.stringify({ error: friendly(e) })); } catch (_e) { /* closed */ } }
      });
      statsDialog.addEventHandler(Office.EventType.DialogEventReceived, () => { statsDialog = null; });
      track('stats_open');
      resolve();
    });
  });
}

async function refreshStats() {
  try {
    const s = await docStats();
    $('focus-stat-words').textContent = s.words.toLocaleString();
    $('focus-stat-chars').textContent = s.chars.toLocaleString();
    paintEmpty(s.words === 0);
  } catch (_e) { /* not in Word */ }
}

function paintPaper() {
  document.querySelectorAll('.se-paper-opt').forEach((b) => b.classList.toggle('active', b.dataset.paper === paper));
}

// Final Draft .fdx → plain lines with Fountain markers, enough for the importer.
function fdxToText(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const out = [];
  doc.querySelectorAll('Paragraph').forEach((p) => {
    const type = (p.getAttribute('Type') || '').toLowerCase();
    const text = [...p.querySelectorAll('Text')].map((t) => t.textContent).join('').trim();
    if (!text) return;
    if (type === 'scene heading') out.push('', '.' + text);
    else if (type === 'character') out.push('', '@' + text);
    else if (type === 'transition') out.push('', '> ' + text);
    else if (type === 'action' || type === 'general') out.push('', '!' + text);
    else if (type === 'dialogue') out.push('~' + text);
    else if (type === 'parenthetical') out.push(text);
  });
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------
// Hand a file to the user. Word's webview may or may not honour a download link:
// we try it, and say where the file went.
function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 4000);
}
function docTitle() {
  try { const u = Office.context.document.url || ''; const base = u.split(/[\\/]/).pop() || 'screenplay'; return base.replace(/\.[a-z0-9]+$/i, '') || 'screenplay'; } catch (_e) { return 'screenplay'; }
}

function setStatus(text, kind) {
  const el = $('status');
  el.textContent = text || '';
  el.className = 'se-status' + (kind ? ' ' + kind : '');
}

function friendly(e) {
  const msg = (e && (e.message || e.code)) || String(e);
  if (/AccessDenied|ReadOnly/i.test(msg)) return 'This document is read-only. Open an editable copy.';
  if (/NotImplemented|ApiNotAvailable|InvalidArgument/i.test(msg)) return 'Your Word is missing an API this needs. Word 365 works.';
  return msg;
}

function loadPaper() {
  try { return localStorage.getItem('se_word_paper') || 'US'; } catch (_e) { return 'US'; }
}
function savePaper(v) {
  try { localStorage.setItem('se_word_paper', v); } catch (_e) { /* private mode */ }
}

function uid() {
  try {
    let id = localStorage.getItem('se_word_uid');
    if (!id) {
      id = 'word-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem('se_word_uid', id);
    }
    return id;
  } catch (_e) { return 'word-anon'; }
}

function track(event, meta) {
  try {
    fetch(API + '/word/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, uid: uid(), meta: meta || {}, os: isMac ? 'mac' : 'other', ver: VERSION }),
    }).catch(() => {});
  } catch (_e) { /* never block the UI on analytics */ }
}

globalThis.SEDBG = { liveCounts, capabilities };
