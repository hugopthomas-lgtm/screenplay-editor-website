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
  ELEMENTS, STYLE_NAMES, UPPERCASE, elementFromStyleName, classifyParagraphs, cleanText, isSceneHeading,
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

let _chgCount = 0;
let _addCount = 0;
export function liveCounts() { return { sel: _selCount, chg: _chgCount, add: _addCount, on: _liveOn, busy: _busy }; }
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

let _tickAt = 0;
function tick() {
  _selCount++;
  _tickAt = performance.now();
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
  _addCount++;
  if (ev.source === 'Remote') return;
  for (const id of ev.uniqueLocalIds || []) {
    try { await reconcileEnter(id); }
    catch (e) { diag('Enter: ' + ((e && (e.message || e.code)) || e)); }
  }
}

async function onParagraphChanged(ev) {
  _chgCount++;
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
    diag(via + ': "' + cleanText(text).slice(0, 20) + '" → ' + trig + ' ' + Math.round(performance.now() - _tickAt) + 'ms');
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
  const t0 = performance.now();
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

    // The new line: what follows, unless the user already typed into it or
    // something else (the chained styles, the Startup template's Tab) already
    // gave it one of our elements.
    const next = E.NEXT_MODE[prevType] || 'ACTION';
    if (!cleanText(p.text) && !elementFromStyleName(p.style)) p.style = STYLE_NAMES[next];
    await context.sync();
    diag('Enter: "' + prevText.slice(0, 20) + '" ' + prevType + ' → ' + next + ' ' + Math.round(performance.now() - t0) + 'ms');
    changed(next, { empty: !cleanText(p.text), text: p.text });
  });
}

// Tab, as the engine decides it, from the tab character Word left in the line.
async function applyTab(context, p, text, type) {
  const t0 = performance.now();
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
    diag('Tab: ' + from + ' (nothing) ' + Math.round(performance.now() - t0) + 'ms');
    changed(from, { empty: !cleanText(text), text });
    return;
  }

  if (d.kind === 'inplace') {
    p.style = STYLE_NAMES[d.mode];
    if (!indentOnly) await deleteTab(context, p, false);
    if (d.parens && !cleanText(after)) await openParens(context, p);
    await context.sync();
    diag('Tab: ' + from + ' → ' + d.mode + ' ' + Math.round(performance.now() - t0) + 'ms');
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
  diag('Tab: ' + from + ' → ' + d.mode + ' (new line) ' + Math.round(performance.now() - t0) + 'ms');
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
  // A PAGE field written as OOXML: Paragraph.insertField is not there on Word
  // for Mac (checked 15/09/2026), insertOoxml is (WordApi 1.1).
  const run = (inner) => `<w:r><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:cs="${FONT}"/><w:sz w:val="${FONT_SIZE * 2}"/><w:szCs w:val="${FONT_SIZE * 2}"/></w:rPr>${inner}</w:r>`;
  const para = '<w:p><w:pPr><w:jc w:val="right"/><w:spacing w:before="0" w:after="0"/></w:pPr>'
    + run('<w:fldChar w:fldCharType="begin"/>') + run('<w:instrText xml:space="preserve"> PAGE </w:instrText>')
    + run('<w:fldChar w:fldCharType="separate"/>') + run('<w:t>1</w:t>') + run('<w:fldChar w:fldCharType="end"/>')
    + run('<w:t>.</w:t>') + '</w:p>';
  const ooxml = '<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">'
    + '<pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml"><pkg:xmlData>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
    + '</pkg:xmlData></pkg:part>'
    + '<pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"><pkg:xmlData>'
    + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + para + '</w:body></w:document>'
    + '</pkg:xmlData></pkg:part></pkg:package>';
  await Word.run(async (context) => {
    const section = context.document.sections.getFirst();
    const header = section.getHeader(Word.HeaderFooterType.primary);
    header.clear();
    header.insertOoxml(ooxml, Word.InsertLocation.start);
    await context.sync();
  });
}

// ---------------------------------------------------------------------------
// Spike (2026-09-14): can an add-in put KEY BINDINGS into the document itself,
// with no macro? Word stores document-level bindings in a keyMapCustomizations
// part (verified on a real .docx written by Word for Mac: acd based on fixed
// command 0x0065 "Style", argValue = base64(0x0002 + style name in UTF-16LE)).
// If insertOoxml merges that part, Alt/Option+1..6 become native and instant.
// ---------------------------------------------------------------------------
function b64utf16le(str) {
  const bytes = [0x02, 0x00];
  for (const ch of str) { const c = ch.charCodeAt(0); bytes.push(c & 0xff, c >> 8); }
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function keymapOoxml(bindings) {
  // bindings: [{ kcm: '0831', style: 'Scene Heading' }, ...]
  const acds = bindings.map((b, i) => `<wne:acd wne:argValue="${b64utf16le(b.style)}" wne:acdName="acd${i}" wne:fciIndexBasedOn="0065"/>`).join('');
  const maps = bindings.map((b, i) => `<wne:keymap wne:kcmPrimary="${b.kcm}"><wne:acd wne:acdName="acd${i}"/></wne:keymap>`).join('');
  const manifest = bindings.map((b, i) => `<wne:acdEntry wne:acdName="acd${i}"/>`).join('');
  const tcg = `<wne:tcg xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"><wne:keymaps>${maps}</wne:keymaps><wne:toolbars><wne:acdManifest>${manifest}</wne:acdManifest></wne:toolbars><wne:acds>${acds}</wne:acds></wne:tcg>`;
  return `<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">`
    + `<pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml"><pkg:xmlData><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships></pkg:xmlData></pkg:part>`
    + `<pkg:part pkg:name="/word/_rels/document.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml"><pkg:xmlData><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.microsoft.com/office/2006/relationships/keyMapCustomizations" Target="customizations.xml"/></Relationships></pkg:xmlData></pkg:part>`
    + `<pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"><pkg:xmlData><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t xml:space="preserve"></w:t></w:r></w:p></w:body></w:document></pkg:xmlData></pkg:part>`
    + `<pkg:part pkg:name="/word/customizations.xml" pkg:contentType="application/vnd.ms-word.keyMapCustomizations+xml"><pkg:xmlData>${tcg}</pkg:xmlData></pkg:part>`
    + `</pkg:package>`;
}

export async function spikeKeymap(bindings) {
  let report = '';
  await Word.run(async (context) => {
    const body = context.document.body;
    const before = body.paragraphs; before.load('items'); await context.sync();
    const n0 = before.items.length;
    const r = body.insertOoxml(keymapOoxml(bindings), Word.InsertLocation.end);
    await context.sync();
    const after = body.paragraphs; after.load('items/text'); await context.sync();
    // remove whatever the insert added at the end (an empty paragraph)
    const added = after.items.length - n0;
    for (let i = 0; i < added; i++) {
      const last = after.items[after.items.length - 1 - i];
      if (!(last.text || '').trim()) last.delete();
    }
    await context.sync();
    report = 'ooxml inserted, added=' + added;
  });
  return report;
}

// ---------------------------------------------------------------------------
// The rest of the write tab, in Word
// ---------------------------------------------------------------------------

// Format only some paragraphs: the selection, or the current scene (from the
// scene heading above the caret to the one below).
export async function formatScope(scope) {
  const stats = { paragraphs: 0, removed: 0 };
  await Word.run(async (context) => {
    const all = context.document.body.paragraphs;
    all.load('items/text,items/tableNestingLevel');
    const sel = context.document.getSelection().paragraphs;
    sel.load('items/text');
    await context.sync();
    const texts = all.items.map((p) => p.text);
    // indexes of the selected paragraphs inside the body
    const selTexts = sel.items.map((p) => p.text);
    let first = -1, last = -1;
    for (let i = 0; i < all.items.length; i++) {
      if (first < 0 && texts[i] === selTexts[0]) {
        let ok = true;
        for (let k = 0; k < selTexts.length; k++) if (texts[i + k] !== selTexts[k]) { ok = false; break; }
        if (ok) { first = i; last = i + selTexts.length - 1; break; }
      }
    }
    if (first < 0) return;
    if (scope === 'scene') {
      while (first > 0 && !isSceneHeading(cleanText(texts[first]))) first--;
      last = first + 1;
      while (last < texts.length && !isSceneHeading(cleanText(texts[last]))) last++;
      last--;
    }
    const plan = classifyParagraphs(texts);
    for (let i = first; i <= last; i++) {
      const p = all.items[i];
      if (p.tableNestingLevel > 0) continue;
      const { type, text } = plan[i];
      if (!type) continue;
      p.style = STYLE_NAMES[type];
      if (text !== texts[i]) setParagraphText(p, text);
      stats.paragraphs++;
    }
    await context.sync();
  });
  return stats;
}

// Title page, the industry way: title in caps a third of the way down, "Written
// by", the name, the contact bottom left, then a page break.
export async function insertTitlePage(title, author, contact) {
  await Word.run(async (context) => {
    const body = context.document.body;
    const first = body.paragraphs.getFirst();
    const lines = [];
    for (let i = 0; i < 16; i++) lines.push('');
    lines.push((title || '').toUpperCase());
    lines.push('');
    lines.push('Written by');
    lines.push('');
    lines.push(author || '');
    for (let i = 0; i < 20; i++) lines.push('');
    lines.push(contact || '');
    let anchor = first;
    for (const line of lines) {
      const p = anchor.insertParagraph(line, Word.InsertLocation.before);
      p.style = STYLE_NAMES.ACTION;
      p.alignment = line === (contact || '') && line === lines[lines.length - 1] ? 'Left' : 'Centered';
      p.spaceBefore = 0;
    }
    first.insertBreak(Word.BreakType.page, Word.InsertLocation.before);
    await context.sync();
  });
}

// Scene numbers, exactly like the add-on: "N.<tab>" hanging into the margin.
export async function addSceneNumbers() {
  await removeSceneNumbers();
  let n = 0;
  await Word.run(async (context) => {
    const paras = context.document.body.paragraphs;
    paras.load('items/text,items/style');
    await context.sync();
    for (const p of paras.items) {
      if (elementFromStyleName(p.style) !== 'SCENE_HEADING' && !isSceneHeading(cleanText(p.text))) continue;
      n++;
      p.getRange(Word.RangeLocation.start).insertText(n + '.\t', Word.InsertLocation.before);
      p.leftIndent = 0;
      p.firstLineIndent = -36;
    }
    await context.sync();
  });
  return n;
}

export async function removeSceneNumbers() {
  let n = 0;
  await Word.run(async (context) => {
    const paras = context.document.body.paragraphs;
    paras.load('items/text,items/style');
    await context.sync();
    for (const p of paras.items) {
      const m = /^(\d+\.\t)/.exec(p.text || '');
      if (!m) continue;
      const r = p.getRange(Word.RangeLocation.start).expandTo(p.search(m[1].trim(), { matchCase: true }).getFirst());
      const tabs = p.search('^t', { matchCase: false });
      tabs.load('items');
      await context.sync();
      const upto = tabs.items.length ? p.getRange(Word.RangeLocation.start).expandTo(tabs.items[0]) : r;
      upto.delete();
      p.firstLineIndent = 0;
      n++;
    }
    await context.sync();
  });
  return n;
}

// Import Fountain (or any plain screenplay text): one paragraph per line,
// classified like Format document, Fountain markers honoured.
export async function importFountainText(text) {
  const raw = text.replace(/\r\n?/g, '\n').split('\n');
  // drop a title page (key: value lines at the top) and boneyard/notes
  let lines = raw;
  if (/^[A-Za-z ]+:\s*\S/.test(lines[0] || '')) {
    let i = 0;
    while (i < lines.length && lines[i].trim() !== '') i++;
    lines = lines.slice(i);
  }
  lines = lines.filter((l) => !/^\s*(\[\[.*\]\]|\/\*.*\*\/)\s*$/.test(l));
  const forced = lines.map((l) => {
    const t = l.trim();
    if (/^\./.test(t) && !/^\.\./.test(t)) return { text: t.slice(1), type: 'SCENE_HEADING' };
    if (/^@/.test(t)) return { text: t.slice(1), type: 'CHARACTER' };
    if (/^>/.test(t) && !/<$/.test(t)) return { text: t.slice(1).trim(), type: 'TRANSITION' };
    if (/^!/.test(t)) return { text: t.slice(1), type: 'ACTION' };
    if (/^~/.test(t)) return { text: t.slice(1), type: 'DIALOGUE' };
    if (/^=/.test(t) || /^#/.test(t)) return null; // synopsis, sections
    return { text: t, type: null };
  }).filter(Boolean);
  const plan = classifyParagraphs(forced.map((f) => f.text));
  let count = 0;
  await Word.run(async (context) => {
    const body = context.document.body;
    for (let i = 0; i < forced.length; i++) {
      const type = forced[i].type || plan[i].type;
      if (!type) continue;
      const txt = forced[i].type ? forced[i].text : plan[i].text;
      const p = body.insertParagraph(UPPERCASE[type] ? txt.toUpperCase() : txt, Word.InsertLocation.end);
      p.style = STYLE_NAMES[type];
      count++;
    }
    await context.sync();
  });
  return count;
}

// Export the document as Fountain text.
export async function exportFountainText() {
  let out = [];
  await Word.run(async (context) => {
    const paras = context.document.body.paragraphs;
    paras.load('items/text,items/style');
    await context.sync();
    let prev = null;
    for (const p of paras.items) {
      const type = elementFromStyleName(p.style);
      const t = cleanText(p.text);
      if (!t) continue;
      if (type === 'SCENE_HEADING') { out.push('', isSceneHeading(t) ? t : '.' + t, ''); }
      else if (type === 'CHARACTER') { if (prev !== 'CHARACTER') out.push(''); out.push(t.toUpperCase() === t ? t : '@' + t); }
      else if (type === 'PARENTHETICAL') out.push(t);
      else if (type === 'DIALOGUE') out.push(t);
      else if (type === 'TRANSITION') { out.push('', /TO:$/.test(t) ? t : '> ' + t, ''); }
      else { out.push('', t); }
      prev = type;
    }
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

export async function docStats() {
  let words = 0, chars = 0;
  await Word.run(async (context) => {
    const body = context.document.body;
    body.load('text');
    await context.sync();
    const t = body.text || '';
    chars = t.replace(/\s/g, '').length;
    words = (t.match(/\S+/g) || []).length;
  });
  return { words, chars };
}
