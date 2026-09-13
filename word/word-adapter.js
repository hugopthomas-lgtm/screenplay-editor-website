// Screenplay Editor for Word — the Word adapter.
//
// Everything that touches the Word object model lives here. WHAT to do comes
// from the shared engine (SEEngine, src/engine.js, the same file the Chrome
// extension runs); this file only decides HOW to do it in Word.
//
// The one thing Word denies an add-in is the keystroke itself: we learn that
// Enter or Tab happened after the fact, from Word's events, and reconcile.
//   Enter  → onParagraphAdded (late): re-read the line just left, apply the
//            live triggers and the casing, give the new line its element
//            (the chained styles already did it natively, instantly).
//   Tab    → a tab character shows up in the paragraph (selection or
//            paragraph events): apply the engine's Tab decision and eat it.
//   Caps   → the style itself displays capitals (Font.allCaps, desktop Word),
//            the real letters are fixed on Enter and on manual formats.
//
// RULE (2026-09-14, Hugo lost a cue and its dialogue): never rewrite a
// paragraph with Paragraph.insertText(..., 'Replace'). On Word for Mac that
// can eat the paragraph mark and merge the line with the next one. Every
// rewrite here goes through a text RANGE (getRange('Content') or a search
// result), which never touches the mark.

import {
  ELEMENTS, STYLE_NAMES, UPPERCASE, elementFromStyleName, classifyParagraphs, cleanText,
} from './classifier.js';

const E = globalThis.SEEngine;
const FONT = 'Courier New';
const FONT_SIZE = 12;
const SPACE_BEFORE = { SCENE_HEADING: 12, ACTION: 12, CHARACTER: 12, PARENTHETICAL: 0, DIALOGUE: 0, TRANSITION: 12 };
const ALIGNMENT = { SCENE_HEADING: 'Left', ACTION: 'Left', CHARACTER: 'Left', PARENTHETICAL: 'Left', DIALOGUE: 'Left', TRANSITION: 'Right' };

function supports(set, version) {
  try { return Office.context.requirements.isSetSupported(set, version); } catch (_e) { return false; }
}

export function capabilities() {
  return {
    styles: supports('WordApi', '1.5'),
    chain: supports('WordApi', '1.6'),
    fields: supports('WordApi', '1.5'),
    live: supports('WordApi', '1.6'),
    allCaps: supports('WordApiDesktop', '1.3'),
  };
}

// Rewrite the text of a paragraph without touching its paragraph mark.
function setParagraphText(p, text) {
  p.getRange('Content').insertText(text, Word.InsertLocation.replace);
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
export async function ensureStyles(paper = 'US') {
  const indents = paper === 'A4' ? E.INDENTS_A4 : E.INDENTS_US;
  const caps = capabilities();
  if (!caps.styles) throw new Error('This version of Word cannot create styles (WordApi 1.5 needed).');

  await Word.run(async (context) => {
    const styles = context.document.getStyles();
    const found = {};
    for (const key of ELEMENTS) {
      const s = styles.getByNameOrNullObject(STYLE_NAMES[key]);
      s.load('isNullObject,type');
      found[key] = s;
    }
    await context.sync();

    const objs = {};
    for (const key of ELEMENTS) {
      objs[key] = found[key].isNullObject
        ? context.document.addStyle(STYLE_NAMES[key], Word.StyleType.paragraph)
        : found[key];
    }
    await context.sync();

    for (const key of ELEMENTS) {
      const s = objs[key];
      const f = s.font;
      f.name = FONT;
      f.size = FONT_SIZE;
      f.bold = false;
      f.italic = false;
      f.underline = 'None';
      f.color = '#000000';
      if (caps.allCaps) { try { f.allCaps = !!UPPERCASE[key]; } catch (_e) { /* not on this build */ } }
      const p = s.paragraphFormat;
      p.leftIndent = indents[key].left;
      p.rightIndent = indents[key].right;
      p.firstLineIndent = 0;
      p.alignment = ALIGNMENT[key];
      p.spaceBefore = SPACE_BEFORE[key];
      p.spaceAfter = 0;
      p.lineSpacing = 12;
      p.keepWithNext = key === 'SCENE_HEADING' || key === 'CHARACTER' || key === 'PARENTHETICAL';
      p.keepTogether = key === 'DIALOGUE' || key === 'PARENTHETICAL';
      try { s.quickStyle = true; } catch (_e) { /* optional */ }
      try { s.priority = 1 + ELEMENTS.indexOf(key); } catch (_e) { /* optional */ }
    }
    await context.sync();

    if (caps.chain) {
      for (const key of ELEMENTS) objs[key].nextParagraphStyle = STYLE_NAMES[E.NEXT_MODE[key]];
      await context.sync();
    }

    // The page itself, like the add-on: the indents above are measured from
    // these margins (1.5 in left on US Letter). Desktop Word only.
    if (caps.allCaps) {
      try {
        const ps = context.document.pageSetup;
        ps.set(paper === 'A4'
          ? { paperSize: 'A4', leftMargin: 72, rightMargin: 72, topMargin: 72, bottomMargin: 57 }
          : { paperSize: 'Letter', leftMargin: 108, rightMargin: 72, topMargin: 72, bottomMargin: 72 });
        await context.sync();
      } catch (_e) { /* an older Word: the styles still stand */ }
    }
  });
  return caps;
}

// A brand new document starts on a scene heading.
export async function startEmptyDocument() {
  let started = false;
  await Word.run(async (context) => {
    const paras = context.document.body.paragraphs;
    paras.load('items/text,items/style');
    await context.sync();
    if (paras.items.length !== 1) return;
    const p = paras.items[0];
    if (cleanText(p.text) || elementFromStyleName(p.style)) return;
    p.style = STYLE_NAMES.SCENE_HEADING;
    await context.sync();
    started = true;
  });
  return started;
}

// ---------------------------------------------------------------------------
// Reading the caret
// ---------------------------------------------------------------------------
export async function currentElement() {
  let result = { type: null, empty: true, text: '' };
  await Word.run(async (context) => {
    const paras = context.document.getSelection().paragraphs;
    paras.load('items/style,items/text');
    await context.sync();
    if (!paras.items.length) return;
    const p = paras.items[0];
    result = { type: elementFromStyleName(p.style), empty: !cleanText(p.text), text: p.text };
  });
  return result;
}

// ---------------------------------------------------------------------------
// Manual formats: the rail and the shortcuts
// ---------------------------------------------------------------------------
export async function applyElement(type) {
  if (!ELEMENTS.includes(type)) return;
  await Word.run(async (context) => {
    const paras = context.document.getSelection().paragraphs;
    paras.load('items/text');
    await context.sync();
    for (const p of paras.items) {
      p.style = STYLE_NAMES[type];
      // Same rule as the extension after a rail click: capitals for Scene
      // Heading / Character / Transition, « ( ) » for a parenthetical.
      const target = E.caseFixTarget(type, cleanText(p.text));
      if (target) setParagraphText(p, target);
    }
    await context.sync();
  });
}

// ---------------------------------------------------------------------------
// Live writing
// ---------------------------------------------------------------------------
let _liveOn = false;
let _onChange = null;   // (type, { empty, text, nudge }) → UI
let _onDiag = null;
let _busy = false;
let _pending = false;
let _selCount = 0;
let _lastSig = '';

function diag(msg) { if (_onDiag) { try { _onDiag(msg); } catch (_e) { /* ui gone */ } } }
function changed(type, what) { if (_onChange) { try { _onChange(type, what); } catch (_e) { /* ui gone */ } } }

export function selectionCount() { return _selCount; }

export async function startLiveWriting(onChange, onDiag) {
  _onChange = onChange || null;
  _onDiag = onDiag || null;
  if (_liveOn) return true;
  const caps = capabilities();
  try {
    Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, tick);
  } catch (_e) { /* no selection events: the paragraph events still work */ }
  if (caps.live) {
    await Word.run(async (context) => {
      context.document.onParagraphAdded.add(onParagraphAdded);
      context.document.onParagraphChanged.add(onParagraphChanged);
      await context.sync();
    });
  }
  _liveOn = true;
  return true;
}

function tick() {
  _selCount++;
  if (_busy) { _pending = true; return; }
  _busy = true;
  reconcileSelection()
    .catch((e) => diag('Live: ' + ((e && (e.message || e.code)) || e)))
    .finally(() => {
      _busy = false;
      if (_pending) { _pending = false; tick(); }
    });
}

async function onParagraphAdded(ev) {
  if (ev.source === 'Remote') return;
  for (const id of ev.uniqueLocalIds || []) {
    try { await reconcileEnter(id); }
    catch (e) { diag('Enter: ' + ((e && (e.message || e.code)) || e)); }
  }
}

async function onParagraphChanged(ev) {
  if (ev.source === 'Remote') return;
  for (const id of ev.uniqueLocalIds || []) {
    try {
      await Word.run(async (context) => {
        const p = context.document.getParagraphByUniqueLocalId(id);
        p.load('text,style,tableNestingLevel,firstLineIndent');
        await context.sync();
        if (p.tableNestingLevel > 0) return;
        await reconcileParagraph(context, p, 'chg');
      });
    } catch (e) { diag('Change: ' + ((e && (e.message || e.code)) || e)); }
  }
}

async function reconcileSelection() {
  await Word.run(async (context) => {
    const paras = context.document.getSelection().paragraphs;
    paras.load('items/text,items/style,items/firstLineIndent,items/tableNestingLevel');
    await context.sync();
    if (paras.items.length !== 1) return;
    const p = paras.items[0];
    if (p.tableNestingLevel > 0) return;
    const sig = JSON.stringify([p.text, p.style, p.firstLineIndent]);
    if (sig === _lastSig) { changed(elementFromStyleName(p.style), { empty: !cleanText(p.text), text: p.text }); return; }
    _lastSig = sig;
    await reconcileParagraph(context, p, 'sel');
  });
}

// One paragraph, as Word shows it right now: apply what the engine says.
async function reconcileParagraph(context, p, via) {
  const text = p.text || '';
  const type = elementFromStyleName(p.style);

  // Tab typed somewhere in the line (or turned into an indent by Word).
  if (text.indexOf('\t') >= 0 || (!!type && p.firstLineIndent >= 18)) {
    await applyTab(context, p, text, type);
    return;
  }

  // Live triggers: « int. », « ext. », a whole transition.
  const trig = E.lineTrigger(text);
  if (trig && trig !== type) {
    p.style = STYLE_NAMES[trig];
    await context.sync();
    diag(via + ': "' + cleanText(text).slice(0, 20) + '" → ' + trig);
    changed(trig, { empty: false, text });
    return;
  }

  // Text typed in plain Normal: it is Action (the default element).
  if (!type && cleanText(text)) {
    p.style = STYLE_NAMES.ACTION;
    await context.sync();
    changed('ACTION', { empty: false, text });
    return;
  }

  changed(type, { empty: !cleanText(text), text });
}

// Enter: the new paragraph `id` exists; the line just left is its previous.
async function reconcileEnter(id) {
  await Word.run(async (context) => {
    const p = context.document.getParagraphByUniqueLocalId(id);
    const prev = p.getPreviousOrNullObject();
    p.load('text,style,tableNestingLevel');
    prev.load('isNullObject,text,style');
    await context.sync();
    if (p.tableNestingLevel > 0 || prev.isNullObject) return;

    const prevText = cleanText(prev.text);
    let prevType = elementFromStyleName(prev.style);

    // Empty line + Enter: the extension blocks the key and nudges the rail.
    // Word already made the line; we nudge, and leave the document alone.
    if (!prevText) { changed(prevType, { empty: true, text: '', nudge: true }); return; }

    // The line just left: triggers, then real capitals.
    const trig = E.lineTrigger(prevText);
    if (trig && trig !== prevType) { prev.style = STYLE_NAMES[trig]; prevType = trig; }
    else if (!prevType) { prev.style = STYLE_NAMES.ACTION; prevType = 'ACTION'; }
    if (UPPERCASE[prevType]) {
      const fixed = prevType === 'CHARACTER' ? E.upperCueName(prev.text) : prev.text.toUpperCase();
      if (fixed !== prev.text) setParagraphText(prev, fixed);
    }

    // The new line: what follows, unless the user already typed into it.
    const next = E.NEXT_MODE[prevType] || 'ACTION';
    if (!cleanText(p.text) && p.style !== STYLE_NAMES[next]) p.style = STYLE_NAMES[next];
    await context.sync();
    diag('Enter: "' + prevText.slice(0, 20) + '" ' + prevType + ' → ' + next);
    changed(next, { empty: !cleanText(p.text), text: p.text });
  });
}

// Tab, as the engine decides it, from the tab character Word left in the line.
async function applyTab(context, p, text, type) {
  const from = type || 'ACTION';
  const idx = text.indexOf('\t');
  const indentOnly = idx < 0;
  const before = indentOnly ? text : text.slice(0, idx);
  const after = indentOnly ? '' : text.slice(idx + 1);
  if (indentOnly) p.firstLineIndent = 0;

  const d = E.tabDecision(from, !cleanText(before));

  if (d.kind === 'none') {
    if (!indentOnly) await deleteTab(context, p, false);
    await context.sync();
    diag('Tab: ' + from + ' (nothing)');
    changed(from, { empty: !cleanText(text), text });
    return;
  }

  if (d.kind === 'inplace') {
    p.style = STYLE_NAMES[d.mode];
    if (!indentOnly) await deleteTab(context, p, false);
    if (d.parens && !cleanText(after)) await openParens(context, p);
    await context.sync();
    diag('Tab: ' + from + ' → ' + d.mode);
    changed(d.mode, { empty: !cleanText(after), text: after });
    return;
  }

  // newline: the text before the tab stays, a new line below in d.mode with
  // whatever was typed after the tab, caret at its end.
  if (!indentOnly) await deleteTab(context, p, true);
  const np = p.insertParagraph(after, Word.InsertLocation.after);
  np.style = STYLE_NAMES[d.mode];
  if (d.parens && !cleanText(after)) await openParens(context, np);
  else np.select(Word.SelectionMode.end);
  await context.sync();
  diag('Tab: ' + from + ' → ' + d.mode + ' (new line)');
  changed(d.mode, { empty: !cleanText(after), text: after });
}

// Delete the tab character; with `toEnd`, also everything after it (it moves
// to the new line). Ranges only: the paragraph mark is never touched.
async function deleteTab(context, p, toEnd) {
  const tabs = p.search('^t', { matchCase: false });
  tabs.load('items');
  await context.sync();
  if (!tabs.items.length) return;
  let r = tabs.items[0];
  if (toEnd) r = r.expandTo(p.getRange(Word.RangeLocation.end));
  r.delete();
}

// « ( ) » with the caret in the middle, like the extension's auto parens.
async function openParens(context, p) {
  p.insertText('()', Word.InsertLocation.end);
  const close = p.search(')', { matchCase: false });
  close.load('items');
  await context.sync();
  if (close.items.length) close.items[0].select(Word.SelectionMode.start);
  else p.select(Word.SelectionMode.end);
}

// ---------------------------------------------------------------------------
// Whole document
// ---------------------------------------------------------------------------
export async function formatDocument() {
  const stats = { paragraphs: 0, removed: 0 };
  await Word.run(async (context) => {
    const paras = context.document.body.paragraphs;
    paras.load('items/text,items/tableNestingLevel');
    await context.sync();
    const items = paras.items;
    const texts = items.map((p) => p.text);
    const plan = classifyParagraphs(texts);
    const toDelete = [];
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (p.tableNestingLevel > 0) continue;
      const { type, text } = plan[i];
      if (!type) { toDelete.push(p); continue; }
      p.style = STYLE_NAMES[type];
      if (text !== texts[i]) setParagraphText(p, text);
      stats.paragraphs++;
    }
    await context.sync();
    const last = items[items.length - 1];
    for (const p of toDelete) {
      if (p === last) continue;
      p.delete();
      stats.removed++;
    }
    await context.sync();
  });
  return stats;
}

export async function addPageNumbers() {
  if (!capabilities().fields) throw new Error('This version of Word cannot insert fields (WordApi 1.5 needed).');
  await Word.run(async (context) => {
    const section = context.document.sections.getFirst();
    const header = section.getHeader(Word.HeaderFooterType.primary);
    header.clear();
    const p = header.insertParagraph('', Word.InsertLocation.start);
    p.alignment = Word.Alignment.right;
    p.font.name = FONT;
    p.font.size = FONT_SIZE;
    p.spaceAfter = 0;
    p.spaceBefore = 0;
    const field = p.insertField(Word.InsertLocation.end, Word.FieldType.page, '', false);
    field.result.font.name = FONT;
    field.result.font.size = FONT_SIZE;
    const dot = p.insertText('.', Word.InsertLocation.end);
    dot.font.name = FONT;
    dot.font.size = FONT_SIZE;
    await context.sync();
  });
}
