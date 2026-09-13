// Screenplay Editor for Word — the thin Office.js adapter.
//
// Everything that touches the Word object model lives here. The rules
// (indents, matrices, classifier) come from rules.js and never change between
// products. If Word behaves differently from Docs, the fix goes here, not in
// the rules.

import {
  ELEMENTS, STYLE_NAMES, INDENTS_US, INDENTS_A4, SPACE_BEFORE, ALIGNMENT,
  UPPERCASE, NEXT_MODE, elementFromStyleName, classifyParagraphs,
  cycleNext, cyclePrev, liveDetect, instantDetect, cleanText,
} from './rules.js';

const FONT = 'Courier New';
const FONT_SIZE = 12;

function supports(set, version) {
  try { return Office.context.requirements.isSetSupported(set, version); } catch (_e) { return false; }
}

export function capabilities() {
  return {
    styles: supports('WordApi', '1.5'),      // addStyle, paragraphFormat, font on Style
    chain: supports('WordApi', '1.6'),       // setting nextParagraphStyle
    fields: supports('WordApi', '1.5'),      // insertField(PAGE)
    live: supports('WordApi', '1.6'),        // onParagraphAdded / onParagraphChanged
    allCaps: supports('WordApiDesktop', '1.3'), // Font.allCaps on a style (desktop only)
  };
}

// ---------------------------------------------------------------------------
// Instant layer. Word's paragraph events arrive seconds late; the selection
// event fires on every caret move, typing included, and reading one paragraph
// costs a few dozen milliseconds. So while the user types we watch the caret's
// paragraph and react to the unambiguous signals: a Tab at the start of the
// line (change the element, eat the tab), "int." / "ext." (scene heading), a
// "(" on a speech line (parenthetical), text in Normal (action).
// ---------------------------------------------------------------------------
let _instantBusy = false;
let _instantPending = false;
let _instantOn = false;
let _selCount = 0;

export function startInstantWriting(onChange, onDiag) {
  if (_instantOn) return true;
  _onLiveChange = onChange || _onLiveChange;
  _onDiag = onDiag || _onDiag;
  try {
    Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, instantTick);
    _instantOn = true;
  } catch (_e) { _instantOn = false; }
  return _instantOn;
}

export function selectionCount() { return _selCount; }

function instantTick() {
  _selCount++;
  if (_instantBusy) { _instantPending = true; return; }
  _instantBusy = true;
  instantCheck()
    .catch((e) => diag('Live: ' + ((e && (e.message || e.code)) || e)))
    .finally(() => {
      _instantBusy = false;
      if (_instantPending) { _instantPending = false; instantTick(); }
    });
}

async function instantCheck() {
  let painted = null;
  await Word.run(async (context) => {
    const paras = context.document.getSelection().paragraphs;
    paras.load('items/text,items/style,items/firstLineIndent,items/tableNestingLevel');
    await context.sync();
    if (paras.items.length !== 1) return;
    const p = paras.items[0];
    if (p.tableNestingLevel > 0) return;
    const text = p.text || '';
    const type = elementFromStyleName(p.style);
    painted = type;

    // 1. A Tab. Either Word kept it as a character, or its AutoFormat turned
    //    it into a first-line indent (all our styles sit at 0).
    const tabChar = text.charAt(0) === '\t';
    const tabIndent = !!type && p.firstLineIndent >= 18;
    if (tabChar || tabIndent) {
      const rest = tabChar ? text.slice(1) : text;
      const from = type || 'ACTION';
      const to = cycleNext(from, !rest.trim());
      if (to) p.style = STYLE_NAMES[to];
      if (tabIndent) p.firstLineIndent = 0;
      if (tabChar) {
        if (!rest) p.insertText('', Word.InsertLocation.replace);
        else {
          const tabs = p.search('^t', { matchCase: false });
          tabs.load('items');
          await context.sync();
          if (tabs.items.length) tabs.items[0].delete();
          else p.insertText(rest, Word.InsertLocation.replace);
        }
      }
      await context.sync();
      painted = to || from;
      diag('Tab: ' + from + (to ? ' → ' + to : ' (no change)'));
      return;
    }

    // 2. What the text says, before Enter.
    const want = instantDetect(text, type);
    if (want && want !== type) {
      p.style = STYLE_NAMES[want];
      await context.sync();
      painted = want;
      diag('Live: "' + cleanText(text).slice(0, 24) + '" → ' + want);
    }
  });
  if (_onLiveChange) _onLiveChange(painted);
}

// ---------------------------------------------------------------------------
// Live writing — the Final Draft feel, on top of the chained styles.
//   Enter : the line just left is re-read (scene heading, transition,
//           character name in caps, plain text in Normal) and the new line
//           receives what must follow.
//   Tab   : a tab typed at the start of a line changes its element
//           (Action → Character, Character → Parenthetical, Dialogue →
//           Parenthetical) and the tab character disappears.
// Both are driven by Word's own paragraph events (WordApi 1.6), so nothing
// intercepts the keyboard.
// ---------------------------------------------------------------------------
let _liveHandlers = null;
let _onLiveChange = null;
let _onDiag = null;
let _liveCount = { enter: 0, tab: 0 };

function diag(msg) { if (_onDiag) { try { _onDiag(msg); } catch (_e) { /* ui gone */ } } }

export async function startLiveWriting(onChange, onDiag) {
  if (!capabilities().live || _liveHandlers) return !!_liveHandlers;
  _onLiveChange = onChange || null;
  _onDiag = onDiag || null;
  await Word.run(async (context) => {
    const added = context.document.onParagraphAdded.add(handleParagraphAdded);
    const changed = context.document.onParagraphChanged.add(handleParagraphChanged);
    await context.sync();
    _liveHandlers = { added, changed };
  });
  return true;
}

export async function stopLiveWriting() {
  if (!_liveHandlers) return;
  const h = _liveHandlers;
  _liveHandlers = null;
  try {
    await Word.run(h.added.context, async (context) => {
      h.added.remove();
      h.changed.remove();
      await context.sync();
    });
  } catch (_e) { /* document gone */ }
}

async function handleParagraphAdded(ev) {
  if (ev.source === 'Remote') return;
  _liveCount.enter++;
  for (const id of ev.uniqueLocalIds || []) {
    try { await smartEnter(id); }
    catch (e) { diag('Enter ' + _liveCount.enter + ': ' + ((e && (e.message || e.code)) || e)); }
  }
}

async function handleParagraphChanged(ev) {
  if (ev.source === 'Remote') return;
  _liveCount.tab++;
  for (const id of ev.uniqueLocalIds || []) {
    try { await smartTab(id); }
    catch (e) { diag('Change ' + _liveCount.tab + ': ' + ((e && (e.message || e.code)) || e)); }
  }
}

export function liveCounts() { return { ..._liveCount }; }

async function smartEnter(id) {
  let applied = null;
  await Word.run(async (context) => {
    const p = context.document.getParagraphByUniqueLocalId(id);
    const prev = p.getPreviousOrNullObject();
    p.load('text,style,tableNestingLevel');
    prev.load('isNullObject,text,style');
    await context.sync();
    if (p.tableNestingLevel > 0 || prev.isNullObject) return;

    const prevText = cleanText(prev.text);
    const prevType = elementFromStyleName(prev.style);
    const detected = liveDetect(prevText, prevType);
    const finalPrev = detected || prevType;
    if (!finalPrev) return;

    if (detected) {
      prev.style = STYLE_NAMES[detected];
      if (UPPERCASE[detected] && prev.text !== prev.text.toUpperCase()) {
        prev.insertText(prev.text.toUpperCase(), Word.InsertLocation.replace);
      }
    }
    // The new line only gets a style if it is empty (a real Enter at the end
    // of the line) and does not already carry the right one.
    const want = STYLE_NAMES[NEXT_MODE[finalPrev]];
    if (!cleanText(p.text) && p.style !== want) p.style = want;
    applied = NEXT_MODE[finalPrev];
    await context.sync();
    diag('Enter ' + _liveCount.enter + ': "' + prevText.slice(0, 24) + '" ' + (prevType || 'Normal') + ' → ' + finalPrev + ', next ' + applied);
  });
  if (applied && _onLiveChange) _onLiveChange(applied);
}

async function smartTab(id) {
  let applied = null;
  await Word.run(async (context) => {
    const p = context.document.getParagraphByUniqueLocalId(id);
    p.load('text,style,tableNestingLevel');
    await context.sync();
    if (p.tableNestingLevel > 0) return;
    const text = p.text || '';
    if (text.charAt(0) !== '\t') return;

    const rest = text.slice(1);
    const type = elementFromStyleName(p.style) || 'ACTION';
    const to = cycleNext(type, !rest.trim());
    if (to) p.style = STYLE_NAMES[to];
    // Drop the tab. On an empty line a plain replace keeps the caret in place;
    // with text after the tab we delete just the tab so the caret stays put.
    if (!rest) {
      p.insertText('', Word.InsertLocation.replace);
    } else {
      const tabs = p.search('^t', { matchCase: false });
      tabs.load('items');
      await context.sync();
      if (tabs.items.length) tabs.items[0].delete();
      else p.insertText(rest, Word.InsertLocation.replace);
    }
    applied = to || type;
    await context.sync();
    diag('Tab ' + _liveCount.tab + ': ' + type + (to ? ' → ' + to : ' (no change)'));
  });
  if (applied && _onLiveChange) _onLiveChange(applied);
}

// A brand new document starts on a scene heading, like Final Draft.
export async function startEmptyDocument() {
  let started = false;
  await Word.run(async (context) => {
    const paras = context.document.body.paragraphs;
    paras.load('items/text,items/style');
    await context.sync();
    if (paras.items.length !== 1) return;
    const p = paras.items[0];
    if (cleanText(p.text)) return;
    if (elementFromStyleName(p.style)) return;
    p.style = STYLE_NAMES.SCENE_HEADING;
    await context.sync();
    started = true;
  });
  return started;
}

// Create (or refresh) the six paragraph styles and chain them. Idempotent:
// running it twice leaves the document as it was.
export async function ensureStyles(paper = 'US') {
  const indents = paper === 'A4' ? INDENTS_A4 : INDENTS_US;
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
      // Desktop Word displays these lines in capitals whatever is typed, so
      // "int. kitchen" reads INT. KITCHEN the instant it lands on the page.
      if (caps.allCaps) { try { f.allCaps = !!UPPERCASE[key]; } catch (_e) { /* not on this build */ } }
      const p = s.paragraphFormat;
      p.leftIndent = indents[key].left;
      p.rightIndent = indents[key].right;
      p.firstLineIndent = 0;
      p.alignment = ALIGNMENT[key];
      p.spaceBefore = SPACE_BEFORE[key];
      p.spaceAfter = 0;
      p.lineSpacing = 12; // single, for a 12 pt Courier
      p.keepWithNext = key === 'SCENE_HEADING' || key === 'CHARACTER' || key === 'PARENTHETICAL';
      p.keepTogether = key === 'DIALOGUE' || key === 'PARENTHETICAL';
      try { s.quickStyle = true; } catch (_e) { /* optional */ }
      try { s.priority = 1 + ELEMENTS.indexOf(key); } catch (_e) { /* optional */ }
    }
    await context.sync();

    if (caps.chain) {
      for (const key of ELEMENTS) {
        objs[key].nextParagraphStyle = STYLE_NAMES[NEXT_MODE[key]];
      }
      await context.sync();
    }
  });
  return caps;
}

// Read the element under the cursor (first paragraph of the selection).
export async function currentElement() {
  let result = { type: null, empty: true };
  await Word.run(async (context) => {
    const paras = context.document.getSelection().paragraphs;
    paras.load('items/style,items/text');
    await context.sync();
    if (!paras.items.length) return;
    const p = paras.items[0];
    result = { type: elementFromStyleName(p.style), empty: !p.text.trim() };
  });
  return result;
}

// Apply an element to every paragraph of the selection. Upper cases the text
// when the element demands it (scene headings, character names, transitions),
// the same way the extension does.
export async function applyElement(type) {
  if (!ELEMENTS.includes(type)) return;
  await Word.run(async (context) => {
    const paras = context.document.getSelection().paragraphs;
    paras.load('items/text');
    await context.sync();
    for (const p of paras.items) {
      p.style = STYLE_NAMES[type];
      const text = p.text;
      if (UPPERCASE[type] && text && text !== text.toUpperCase()) {
        p.insertText(text.toUpperCase(), Word.InsertLocation.replace);
      }
    }
    await context.sync();
  });
}

export async function cycleElement(direction) {
  const cur = await currentElement();
  const from = cur.type || 'ACTION';
  const to = direction < 0 ? cyclePrev(from) : cycleNext(from, cur.empty);
  if (!to) return null;
  await applyElement(to);
  return to;
}

// Format the whole document: classify every paragraph by its text, apply the
// styles, drop the empty paragraphs the spacing model makes redundant. Word
// keeps all of it in one undo step per sync, so Ctrl+Z brings the text back.
export async function formatDocument() {
  let stats = { paragraphs: 0, removed: 0 };
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
      if (p.tableNestingLevel > 0) continue; // never touch tables
      const { type, text } = plan[i];
      if (!type) {
        toDelete.push(p);
        continue;
      }
      p.style = STYLE_NAMES[type];
      if (text !== texts[i]) p.insertText(text, Word.InsertLocation.replace);
      stats.paragraphs++;
    }
    await context.sync();

    // Word refuses to delete the very last paragraph of a body.
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

// Page numbers top right, Courier 12, followed by a period, from page 2.
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

// A quick check for the sample document button: is the body empty?
export async function bodyIsEmpty() {
  let empty = true;
  await Word.run(async (context) => {
    const body = context.document.body;
    body.load('text');
    await context.sync();
    empty = !body.text.trim();
  });
  return empty;
}

export async function insertSample() {
  const lines = [
    ['SCENE_HEADING', 'INT. KITCHEN - NIGHT'],
    ['ACTION', 'JULES, 30s, stands at the sink. The tap drips. She does not turn it off.'],
    ['CHARACTER', 'JULES'],
    ['PARENTHETICAL', '(without turning)'],
    ['DIALOGUE', 'You said midnight.'],
    ['CHARACTER', 'MARC'],
    ['DIALOGUE', 'I said around midnight.'],
    ['ACTION', 'She turns off the tap. Silence.'],
    ['TRANSITION', 'CUT TO:'],
  ];
  await Word.run(async (context) => {
    const body = context.document.body;
    for (const [type, text] of lines) {
      const p = body.insertParagraph(text, Word.InsertLocation.end);
      p.style = STYLE_NAMES[type];
    }
    await context.sync();
  });
}
