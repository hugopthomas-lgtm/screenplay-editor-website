// Screenplay Editor for Word — the thin Office.js adapter.
//
// Everything that touches the Word object model lives here. The rules
// (indents, matrices, classifier) come from rules.js and never change between
// products. If Word behaves differently from Docs, the fix goes here, not in
// the rules.

import {
  ELEMENTS, STYLE_NAMES, INDENTS_US, INDENTS_A4, SPACE_BEFORE, ALIGNMENT,
  UPPERCASE, NEXT_MODE, elementFromStyleName, classifyParagraphs,
  cycleNext, cyclePrev,
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
  };
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
