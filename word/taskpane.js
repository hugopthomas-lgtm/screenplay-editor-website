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
} from './word-adapter.js';

const E = globalThis.SEEngine;
const API = 'https://screenplay-editor-api.hugopthomas.workers.dev';
const VERSION = '3.2.0';

const $ = (id) => document.getElementById(id);

let isMac = false;
let stylesReady = false;
let paper = 'US';
let uiMode = null;
let uiEmpty = true;

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
    if (m) { isMac = true; buildRail(); buildPill(); wireUi(); paintMode(m, false, false); switchTab(q.get('tab') || 'home'); return; }
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
  try { Office.addin.setStartupBehavior(Office.StartupBehavior.load); } catch (_e) { /* optional */ }

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
    if (p) p.classList.toggle('active', t === name);
  }
  track('tab_' + (name === 'home' ? 'home' : name === 'studio' ? 'tools' : 'export'));
}

// ---------------------------------------------------------------------------
// The rail: the shortcuts grid of the extension, made live.
// ---------------------------------------------------------------------------
function buildRail() {
  const rows = document.querySelectorAll('.write-shortcuts-grid .write-sc');
  const mod = isMac ? '⌥' : 'Alt+';
  E.RAIL_ITEMS.forEach((item, i) => {
    const row = rows[i];
    if (!row) return;
    row.dataset.mode = item.mode;
    row.setAttribute('role', 'button');
    const modEl = row.querySelector('.help-kbd-mod');
    if (modEl) modEl.textContent = mod;
    row.addEventListener('mousedown', (e) => e.preventDefault());
    row.addEventListener('click', () => runElement(item.mode, 'rail'));
  });
}

function highlightRail(mode) {
  document.querySelectorAll('.write-sc[data-mode]').forEach((row) => row.classList.toggle('active', row.dataset.mode === mode));
}

function nudgeRail() {
  const grid = document.querySelector('.write-shortcuts-grid');
  if (!grid) return;
  try {
    grid.animate([
      { filter: 'drop-shadow(0 0 0 rgba(124,58,237,0))' },
      { filter: 'drop-shadow(0 0 13px rgba(124,58,237,0.8))', offset: 0.4 },
      { filter: 'drop-shadow(0 0 0 rgba(124,58,237,0))' },
    ], { duration: 850, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', iterations: 2 });
    grid.querySelectorAll('.help-kbd').forEach((k, i) => {
      k.animate([{ filter: 'none' }, { filter: 'drop-shadow(0 0 7px rgba(124,58,237,0.95)) saturate(1.6)' }, { filter: 'none' }],
        { duration: 380, delay: 110 * i, easing: 'ease-in-out' });
    });
  } catch (_e) { /* no Web Animations */ }
}

// ---------------------------------------------------------------------------
// The pill: badge + what Enter and Tab will do.
// ---------------------------------------------------------------------------
function buildPill() { /* the flow hint lives in the markup (build-pane.py) */ }

// What Enter and Tab will do, one quiet line under the shortcuts title.
function paintPill(mode, lineEmpty) {
  const c = E.pillContent(mode || 'ACTION', lineEmpty);
  const parts = [];
  if (c.enter) parts.push(`Enter → ${E.MODE_LABELS[c.enter]}`);
  else if (c.scene) parts.push('INT. or EXT. → Scene heading');
  if (c.tab) parts.push(`Tab → ${E.MODE_LABELS[c.tab]}`);
  const line = $('pill-hint-line');
  if (line) line.textContent = parts.join('   ·   ');
}

// The 3D roll of the extension's badge, ~170 ms.
function rollBadge(el, finalText) {
  el.style.transition = 'transform 0.08s ease-in, opacity 0.08s ease-in';
  el.style.transform = 'translateY(-105%) rotateX(90deg)';
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = finalText;
    el.style.transition = 'none';
    el.style.transform = 'translateY(105%) rotateX(-90deg)';
    el.style.opacity = '0';
    void el.offsetWidth;
    el.style.transition = 'transform 0.13s cubic-bezier(0.2,0.85,0.3,1), opacity 0.12s ease-out';
    el.style.transform = 'translateY(0) rotateX(0)';
    el.style.opacity = '1';
  }, 85);
}

function paintMode(mode, lineEmpty, animate) {
  const changed = mode !== uiMode;
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
    fileInput.accept = '.fountain,.txt,.fdx';
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        setStatus('Importing…');
        const n = await importFountainText(f.name.toLowerCase().endsWith('.fdx') ? fdxToText(text) : text);
        setStatus(`${n} paragraphs imported.`, 'ok');
        track('import_fountain');
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
      const text = await exportFountainText();
      let copied = false;
      try { await navigator.clipboard.writeText(text); copied = true; } catch (_e) { /* no clipboard in this webview */ }
      if (copied) setStatus('Fountain copied to the clipboard. Paste it in a .fountain file.', 'ok');
      else { $('log').hidden = false; $('log').textContent = text; setStatus('Fountain text below: select it and copy.', 'ok'); }
      track('export_fountain');
      return;
    }
    case 'export-pdf': setStatus('In Word: File › Save a Copy › PDF. Your styles carry over.', 'ok'); return;
    case 'stats': return refreshStats();
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
  setStatus('Formatting…');
  try {
    if (!stylesReady) { await ensureStyles(paper); stylesReady = true; }
    const stats = await formatDocument();
    setStatus(`Formatted ${stats.paragraphs} paragraphs. Undo brings everything back.`, 'ok');
    track('format_document', { paragraphs: stats.paragraphs, removed: stats.removed });
    refreshStats();
  } catch (e) {
    setStatus(friendly(e), 'error');
  }
}

async function refreshStats() {
  try {
    const s = await docStats();
    $('focus-stat-words').textContent = s.words.toLocaleString();
    $('focus-stat-chars').textContent = s.chars.toLocaleString();
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
