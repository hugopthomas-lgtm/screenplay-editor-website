// Screenplay Editor for Word — the task pane.
//
// This page is also the add-in's shared runtime: the keyboard shortcuts of
// shortcuts.json land here through Office.actions.associate, whether the
// pane is visible or not.

import { ELEMENTS, NEXT_MODE, TAB_NEXT, LABELS } from './rules.js';
import {
  ensureStyles, applyElement, cycleElement, formatDocument, addPageNumbers,
  currentElement, insertSample, startLiveWriting, startEmptyDocument,
} from './word-adapter.js';

const API = 'https://screenplay-editor-api.hugopthomas.workers.dev';
const VERSION = '1.1.2';

const $ = (id) => document.getElementById(id);

let isMac = false;
let stylesReady = false;
let paper = 'US';

// ---------------------------------------------------------------------------
// Shortcuts → functions. Registered at load time, before Office.onReady.
// ---------------------------------------------------------------------------
const ACTIONS = {
  SE_SceneHeading: () => runElement('SCENE_HEADING'),
  SE_Action: () => runElement('ACTION'),
  SE_Character: () => runElement('CHARACTER'),
  SE_Parenthetical: () => runElement('PARENTHETICAL'),
  SE_Dialogue: () => runElement('DIALOGUE'),
  SE_Transition: () => runElement('TRANSITION'),
  SE_CycleNext: () => runCycle(1),
  SE_CyclePrev: () => runCycle(-1),
  SE_FormatDocument: () => runFormat(),
};
for (const [id, fn] of Object.entries(ACTIONS)) {
  try { Office.actions.associate(id, () => fn().catch(() => {})); } catch (_e) { /* no shared runtime */ }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
Office.onReady(async (info) => {
  if (info.host !== Office.HostType.Word) {
    setStatus('Screenplay Editor runs in Word.', 'error');
    return;
  }
  isMac = Office.context.platform === Office.PlatformType.Mac;
  paper = loadPaper();
  $('paper').value = paper;
  document.querySelector('.version').textContent = 'v' + VERSION;
  paintShortcuts();
  wireUi();
  track('sidebar_open');

  try {
    const caps = await ensureStyles(paper);
    stylesReady = true;
    if (!caps.chain) {
      setStatus('Styles are in. This Word cannot chain them, so Enter will not switch elements by itself.', 'error');
    } else {
      const fresh = await startEmptyDocument();
      const live = await startLiveWriting((type) => paintActive(type), (msg) => setStatus(msg, 'ok'));
      if (live) {
        setStatus(fresh
          ? 'Ready. Type a scene heading, Enter, then write. Tab on a new line switches the element.'
          : 'Ready. Enter and Tab work like Final Draft. Format document fixes an existing script.', 'ok');
      } else {
        setStatus('Styles are in. This Word does not expose paragraph events, so Enter only follows the chained styles.', 'ok');
      }
    }
  } catch (e) {
    setStatus(friendly(e), 'error');
  }

  try {
    Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, refreshActive);
  } catch (_e) { /* fine without live highlight */ }
  refreshActive();
});

function wireUi() {
  $('rail').addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    runElement(tile.dataset.type, 'rail');
  });
  $('btn-format').addEventListener('click', () => runFormat());
  $('btn-pages').addEventListener('click', async () => {
    try {
      await addPageNumbers();
      setStatus('Page numbers added, top right.', 'ok');
      track('scene_numbers', { what: 'page_numbers' });
    } catch (e) { setStatus(friendly(e), 'error'); }
  });
  $('btn-sample').addEventListener('click', async () => {
    try {
      if (!stylesReady) { await ensureStyles(paper); stylesReady = true; }
      await insertSample();
      setStatus('Sample scene inserted. Click a line to see its element light up.', 'ok');
      refreshActive();
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
}

function paintShortcuts() {
  const mod = isMac ? '⌥' : 'Alt+';
  document.querySelectorAll('kbd[data-key]').forEach((k) => { k.textContent = mod + k.dataset.key; });
  $('kbd-format').textContent = isMac ? '⇧⌘F' : 'Ctrl+Shift+F';
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function runElement(type, origin) {
  if (!ELEMENTS.includes(type)) return;
  try {
    if (!stylesReady) { await ensureStyles(paper); stylesReady = true; }
    await applyElement(type);
    paintActive(type);
    if (origin === 'rail') track('rail_click', { type });
    else track('smart_format', { type, via: 'shortcut' });
  } catch (e) {
    setStatus(friendly(e), 'error');
  }
}

async function runCycle(direction) {
  try {
    if (!stylesReady) { await ensureStyles(paper); stylesReady = true; }
    const to = await cycleElement(direction);
    if (to) paintActive(to);
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
    refreshActive();
  } catch (e) {
    setStatus(friendly(e), 'error');
  } finally {
    btn.disabled = false;
  }
}

let _refreshBusy = false;
async function refreshActive() {
  if (_refreshBusy) return;
  _refreshBusy = true;
  try {
    const cur = await currentElement();
    paintActive(cur.type);
  } catch (_e) { /* selection in a place we cannot read */ }
  finally { _refreshBusy = false; }
}

function paintActive(type) {
  document.querySelectorAll('.tile').forEach((t) => t.classList.toggle('active', t.dataset.type === type));
  const hint = $('flow-hint');
  if (!type) { hint.textContent = 'Click a line, then pick its element.'; return; }
  hint.textContent = '';
  const enter = document.createElement('span');
  enter.textContent = `Enter → ${LABELS[NEXT_MODE[type]]}`;
  hint.appendChild(enter);
  if (TAB_NEXT[type]) {
    const sep = document.createElement('span');
    sep.className = 'sep';
    sep.textContent = '·';
    const cyc = document.createElement('span');
    cyc.textContent = `${isMac ? '⌥⌘→' : 'Ctrl+Alt+→'} cycles to ${LABELS[TAB_NEXT[type]]}`;
    hint.appendChild(sep);
    hint.appendChild(cyc);
  }
}

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------
function setStatus(text, kind) {
  const el = $('status');
  el.textContent = text || '';
  el.className = 'status' + (kind ? ' ' + kind : '');
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

// Usage goes to the same analytics as the add-on and the extension, through a
// route reserved for the Word add-in (no key on the client).
function track(event, meta) {
  try {
    fetch(API + '/word/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event, uid: uid(), meta: meta || {},
        os: isMac ? 'mac' : 'other', ver: VERSION,
      }),
    }).catch(() => {});
  } catch (_e) { /* never block the UI on analytics */ }
}
