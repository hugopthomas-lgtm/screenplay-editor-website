// Screenplay Editor for Word — the pane: the pill and the rail of the
// extension, hosted in Word's task pane, driven by the shared engine.
//
// This page is also the add-in's shared runtime: the keyboard shortcuts of
// shortcuts.json land here through Office.actions.associate.

import { ELEMENTS } from './classifier.js';
import {
  ensureStyles, applyElement, formatDocument, addPageNumbers,
  currentElement, startLiveWriting, startEmptyDocument, selectionCount,
} from './word-adapter.js';

const E = globalThis.SEEngine;
const API = 'https://screenplay-editor-api.hugopthomas.workers.dev';
const VERSION = '2.1.2';

const $ = (id) => document.getElementById(id);
// Keycap look of the pill (declared before Office.onReady can fire).
const KEYCAP = 'display:inline-block;background:#fff;border:1px solid #e4e6ea;border-radius:6px;box-shadow:0 1px 0 rgba(16,24,40,0.04);padding:2px 8px;margin:0 6px;font-size:11px;font-weight:500;color:#3c4043;line-height:1.35;';

let isMac = false;
let stylesReady = false;
let paper = 'US';
let uiMode = null;
let uiEmpty = true;

// ---------------------------------------------------------------------------
// Shortcuts → functions, registered before Office.onReady.
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
// Ribbon buttons, context menu items and keyboard shortcuts all land here.
// A ribbon command hands us an event that must be completed, or Word keeps
// the button busy.
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
  if (info.host !== Office.HostType.Word) {
    // Design preview in a plain browser: ?preview=MODE
    const m = new URLSearchParams(location.search).get('preview');
    if (m) { isMac = true; buildRail(); buildPill(); wireUi(); paintMode(m, false, false); return; }
    setStatus('Screenplay Editor runs in Word.', 'error');
    return;
  }
  isMac = Office.context.platform === Office.PlatformType.Mac;
  paper = loadPaper();
  $('paper').value = paper;
  buildRail();
  buildPill();
  wireUi();
  track('sidebar_open');

  try {
    const caps = await ensureStyles(paper);
    stylesReady = true;
    if (!caps.chain) {
      setStatus('Styles are in. This Word cannot chain them, so Enter will not switch elements by itself.', 'error');
    } else {
      await startEmptyDocument();
      await startLiveWriting(onLiveChange, (msg) => setStatus(msg, 'ok'));
    }
  } catch (e) {
    setStatus(friendly(e), 'error');
  }

  try {
    const cur = await currentElement();
    paintMode(cur.type, cur.empty, false);
  } catch (_e) { /* nothing selected yet */ }
  setInterval(() => { $('version').textContent = 'v' + VERSION + ' · ' + selectionCount(); }, 1000);

  // Are the keyboard shortcuts registered on this Word? Word tells us.
  try {
    const ks = Office.context.requirements.isSetSupported('KeyboardShortcuts', '1.1');
    const sr = Office.context.requirements.isSetSupported('SharedRuntime', '1.1');
    setStatus('Shortcuts API: ' + (ks ? 'yes' : 'no') + ' · shared runtime: ' + (sr ? 'yes' : 'no'), 'ok');
    if (Office.actions && Office.actions.getShortcuts) {
      Office.actions.getShortcuts()
        .then((m) => setStatus('Shortcuts: ' + JSON.stringify(m), 'ok'))
        .catch((e) => setStatus('Shortcuts: ' + ((e && (e.message || e.code)) || e), 'ok'));
    } else {
      setStatus('Shortcuts: Office.actions.getShortcuts absent', 'ok');
    }
  } catch (e) { setStatus('Shortcuts: ' + e, 'ok'); }
});

function onLiveChange(type, what) {
  paintMode(type, !!(what && what.empty), true);
  if (what && what.nudge) nudgeRail();
}

// ---------------------------------------------------------------------------
// The rail (preset « color » of the extension): six monochrome tiles, the
// active one an anthracite pill pushed toward the text.
// ---------------------------------------------------------------------------
function buildRail() {
  const S = E.RAIL_STYLE;
  const rail = $('rail');
  rail.style.cssText = S.container + `display:flex;flex-direction:column;align-items:center;gap:${S.gap}px;`;
  const labels = $('rail-labels');
  labels.innerHTML = '';
  rail.innerHTML = '';
  const mod = isMac ? '⌥' : 'Alt+';
  for (const item of E.RAIL_ITEMS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rail-btn';
    btn.dataset.mode = item.mode;
    btn.title = item.label + ' (' + mod + item.key + ')';
    btn.style.cssText = `all:unset;display:flex;align-items:center;justify-content:center;cursor:pointer;`
      + `transition:background 0.15s ease,color 0.15s ease,transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94),box-shadow 0.15s ease;`
      + `width:${S.btnBox}px;height:${S.btnBox}px;border-radius:${S.radius}px;color:${S.inactiveColor};`;
    btn.innerHTML = iconFor(item.mode, S.svgSize);
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => { e.preventDefault(); runElement(item.mode, 'rail'); });
    btn.addEventListener('mouseenter', () => { if (btn.dataset.active !== '1') { btn.style.color = S.hoverColor; btn.style.transform = 'translateX(6px) scale(1.12)'; } });
    btn.addEventListener('mouseleave', () => { if (btn.dataset.active !== '1') { btn.style.color = S.inactiveColor; btn.style.transform = 'translateX(0) scale(1)'; } });
    rail.appendChild(btn);

    const lab = document.createElement('button');
    lab.type = 'button';
    lab.className = 'rail-label';
    lab.dataset.mode = item.mode;
    lab.style.height = (S.btnBox + S.gap) + 'px';
    lab.innerHTML = `<span class="rail-label-text">${item.label}</span><kbd>${mod}${item.key}</kbd>`;
    lab.addEventListener('mousedown', (e) => e.preventDefault());
    lab.addEventListener('click', (e) => { e.preventDefault(); runElement(item.mode, 'rail'); });
    labels.appendChild(lab);
  }
}

function iconFor(mode, size) {
  const svg = E.MODE_ICONS[mode];
  if (svg) return svg.replace(/width="24" height="24"/, `width="${size}" height="${size}"`);
  // ACTION: the skateboarder, a PNG used as a mask so it takes currentColor.
  return `<span style="display:block;width:${size}px;height:${size}px;background-color:currentColor;`
    + `mask:url(assets/skateboarding.png) center/contain no-repeat;-webkit-mask:url(assets/skateboarding.png) center/contain no-repeat;"></span>`;
}

function highlightRail(mode) {
  const S = E.RAIL_STYLE;
  document.querySelectorAll('.rail-btn').forEach((btn) => {
    const on = btn.dataset.mode === mode;
    btn.dataset.active = on ? '1' : '0';
    btn.style.transform = on ? `translateX(${S.activeShift}px) scale(${S.activeScale})` : 'translateX(0) scale(1)';
    btn.style.background = on ? S.activeBg : 'transparent';
    btn.style.color = on ? S.activeColor : S.inactiveColor;
    btn.style.borderRadius = (on ? S.activeRadius : S.radius) + 'px';
    btn.style.boxShadow = on ? S.activeShadow : 'none';
    btn.style.cursor = on ? 'default' : 'pointer';
    btn.style.pointerEvents = on ? 'none' : 'auto';
  });
  document.querySelectorAll('.rail-label').forEach((l) => l.classList.toggle('active', l.dataset.mode === mode));
}

// The extension's nudge: a violet halo that breathes twice, and a wave down the tiles.
function nudgeRail() {
  const rail = $('rail');
  try {
    rail.animate([
      { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 rgba(124,58,237,0))' },
      { transform: 'scale(1.06)', filter: 'drop-shadow(0 0 13px rgba(124,58,237,0.8))', offset: 0.4 },
      { transform: 'scale(1)', filter: 'drop-shadow(0 0 0 rgba(124,58,237,0))' },
    ], { duration: 850, easing: 'cubic-bezier(0.33, 1, 0.68, 1)', iterations: 2 });
    rail.querySelectorAll(':scope > *').forEach((k, i) => {
      k.animate([
        { filter: 'none' },
        { filter: 'drop-shadow(0 0 7px rgba(124,58,237,0.95)) saturate(1.6)' },
        { filter: 'none' },
      ], { duration: 380, delay: 110 * i, easing: 'ease-in-out' });
    });
  } catch (_e) { /* no Web Animations */ }
}

// ---------------------------------------------------------------------------
// The pill: tinted badge + « Press Enter for X · Press Tab for Y ».
// ---------------------------------------------------------------------------

function buildPill() {
  const pill = $('pill');
  pill.innerHTML = `
    <span id="pill-badge" style="display:inline-block;font-weight:600;font-size:10.5px;letter-spacing:0.7px;text-transform:uppercase;padding:4px 10px;border-radius:7px;min-width:128px;text-align:center;box-sizing:border-box;overflow:hidden;perspective:70px;transition:background-color 0.18s ease,color 0.18s ease;"><span id="pill-badge-text" style="display:inline-block;"></span></span>
    <span id="pill-hints" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 0;margin-top:8px;min-height:22px;">
      <span id="pill-enter" style="display:none;align-items:center;white-space:nowrap;"><span style="color:#9aa0ac;">Press </span><span style="${KEYCAP}">Enter</span><span style="color:#9aa0ac;">for&nbsp;</span><span id="pill-enter-target" style="color:#202124;font-weight:500;"></span></span>
      <span id="pill-scene" style="display:none;align-items:center;white-space:nowrap;"><span style="color:#9aa0ac;">Write </span><span style="${KEYCAP}">INT.</span><span style="color:#9aa0ac;">or</span><span style="${KEYCAP}">EXT.</span><span style="color:#9aa0ac;">for a scene heading</span></span>
      <span id="pill-tab" style="display:none;align-items:center;white-space:nowrap;"><span style="color:#9aa0ac;">Press </span><span style="${KEYCAP}">Tab</span><span style="color:#9aa0ac;">for&nbsp;</span><span id="pill-tab-target" style="color:#202124;font-weight:500;"></span></span>
    </span>`;
}

function paintPill(mode, lineEmpty, animate) {
  const c = E.pillContent(mode || 'ACTION', lineEmpty);
  const badge = $('pill-badge');
  const txt = $('pill-badge-text');
  badge.style.backgroundColor = c.colors.tint;
  badge.style.color = c.colors.ink;
  if (animate && txt.textContent && txt.textContent !== c.label) rollBadge(txt, c.label);
  else txt.textContent = c.label;
  $('pill-enter').style.display = c.enter ? 'inline-flex' : 'none';
  $('pill-enter-target').textContent = c.enter ? E.MODE_LABELS[c.enter] : '';
  $('pill-scene').style.display = c.scene ? 'inline-flex' : 'none';
  $('pill-tab').style.display = c.tab ? 'inline-flex' : 'none';
  $('pill-tab-target').textContent = c.tab ? E.MODE_LABELS[c.tab] : '';
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
  paintPill(mode, uiEmpty, animate && changed);
  if (changed && mode) {
    const btn = document.querySelector(`.rail-btn[data-mode="${mode}"]`);
    if (btn) {
      const S = E.RAIL_STYLE;
      btn.style.transform = `translateX(${S.activeShift}px) scale(1.18)`;
      setTimeout(() => { btn.style.transform = `translateX(${S.activeShift}px) scale(${S.activeScale})`; }, 180);
    }
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
function wireUi() {
  $('btn-format').addEventListener('click', () => runFormat());
  $('btn-pages').addEventListener('click', async () => {
    try {
      await addPageNumbers();
      setStatus('Page numbers added, top right.', 'ok');
      track('scene_numbers', { what: 'page_numbers' });
    } catch (e) { setStatus(friendly(e), 'error'); }
  });
  $('paper').addEventListener('change', async (e) => {
    paper = e.target.value;
    savePaper(paper);
    try {
      await ensureStyles(paper);
      setStatus(paper === 'A4' ? 'Indents set for A4.' : 'Indents set for US Letter.', 'ok');
    } catch (err) { setStatus(friendly(err), 'error'); }
  });
  $('kbd-format').textContent = isMac ? '⇧⌘F' : 'Ctrl+Shift+F';
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
  const btn = $('btn-format');
  btn.disabled = true;
  setStatus('Formatting…');
  try {
    if (!stylesReady) { await ensureStyles(paper); stylesReady = true; }
    const stats = await formatDocument();
    setStatus(`Formatted ${stats.paragraphs} paragraphs. Undo brings everything back.`, 'ok');
    track('format_document', { paragraphs: stats.paragraphs, removed: stats.removed });
  } catch (e) {
    setStatus(friendly(e), 'error');
  } finally {
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------
const _log = [];
function setStatus(text, kind) {
  const el = $('status');
  el.textContent = text || '';
  el.className = 'status' + (kind ? ' ' + kind : '');
  if (text) {
    _log.push(text);
    while (_log.length > 8) _log.shift();
    $('log').textContent = _log.join('\n');
  }
}

function friendly(e) {
  const msg = (e && (e.message || e.code)) || String(e);
  if (/AccessDenied|ReadOnly/i.test(msg)) return 'This document is read-only. Open an editable copy.';
  if (/NotImplemented|ApiNotAvailable|InvalidArgument/i.test(msg)) return 'Your Word is missing an API this needs. Word 365 or Word on the web work.';
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
