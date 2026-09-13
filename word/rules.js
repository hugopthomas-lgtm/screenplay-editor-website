// Screenplay Editor for Word — the format rules.
//
// This file is the doctrine shared with the Google Docs add-on (Code.js) and
// the Chrome extension (content.js): element list, indents, the Enter / Tab
// matrices and the paragraph classifier. It knows nothing about Word or
// Office.js, so it runs in vitest as-is. Keep it in sync with the two other
// products by hand; the numbers below are copied from Code.js (FORMATS) and
// content.js (NEXT_MODE, TAB_NEXT, TAB_PREV) on 2026-09-13.

export const ELEMENTS = ['SCENE_HEADING', 'ACTION', 'CHARACTER', 'PARENTHETICAL', 'DIALOGUE', 'TRANSITION'];

// Word style names, as the user sees them in the Styles gallery.
export const STYLE_NAMES = {
  SCENE_HEADING: 'Scene Heading',
  ACTION: 'Action',
  CHARACTER: 'Character',
  PARENTHETICAL: 'Parenthetical',
  DIALOGUE: 'Dialogue',
  TRANSITION: 'Transition',
};

export const LABELS = {
  SCENE_HEADING: 'Scene Heading',
  ACTION: 'Action',
  CHARACTER: 'Character',
  PARENTHETICAL: 'Parenthetical',
  DIALOGUE: 'Dialogue',
  TRANSITION: 'Transition',
};

export function elementFromStyleName(name) {
  for (const key of ELEMENTS) if (STYLE_NAMES[key] === name) return key;
  return null;
}

// Indents in points, measured from the page margins (1.5" left, 1" right on
// US Letter). Same numbers as the add-on and the extension.
export const INDENTS_US = {
  SCENE_HEADING: { left: 0, right: 0 },
  ACTION: { left: 0, right: 0 },
  CHARACTER: { left: 194, right: 0 },
  DIALOGUE: { left: 101, right: 94 },
  PARENTHETICAL: { left: 151, right: 137 },
  TRANSITION: { left: 0, right: 0 },
};

export const INDENTS_A4 = {
  SCENE_HEADING: { left: 0, right: 0 },
  ACTION: { left: 0, right: 0 },
  CHARACTER: { left: 178, right: 0 },
  DIALOGUE: { left: 93, right: 93 },
  PARENTHETICAL: { left: 136, right: 136 },
  TRANSITION: { left: 0, right: 0 },
};

// Vertical rhythm. A screenplay puts one blank line between elements, except
// inside a speech (Character → Parenthetical → Dialogue stay glued). In Word we
// express that as "space before" on the style, so one Enter is enough and the
// document never carries empty paragraphs.
export const SPACE_BEFORE = {
  SCENE_HEADING: 12,
  ACTION: 12,
  CHARACTER: 12,
  PARENTHETICAL: 0,
  DIALOGUE: 0,
  TRANSITION: 12,
};

export const ALIGNMENT = {
  SCENE_HEADING: 'Left',
  ACTION: 'Left',
  CHARACTER: 'Left',
  PARENTHETICAL: 'Left',
  DIALOGUE: 'Left',
  TRANSITION: 'Right',
};

// Elements whose text is always upper case (mirrors _CASE_FIX_MODES).
export const UPPERCASE = { SCENE_HEADING: true, CHARACTER: true, TRANSITION: true };

// Enter = advance. This is what Word's nextParagraphStyle chains natively.
export const NEXT_MODE = {
  SCENE_HEADING: 'ACTION',
  ACTION: 'ACTION',
  CHARACTER: 'DIALOGUE',
  DIALOGUE: 'ACTION', // Final Draft convention (Hugo, 2026-08-18)
  PARENTHETICAL: 'DIALOGUE',
  TRANSITION: 'SCENE_HEADING',
};

// Tab = change the TYPE of the current line. null = does nothing.
export const TAB_NEXT = {
  SCENE_HEADING: null,
  ACTION: 'CHARACTER',
  CHARACTER: 'PARENTHETICAL',
  PARENTHETICAL: null,
  DIALOGUE: 'PARENTHETICAL',
  TRANSITION: null,
};

export const TAB_PREV = {
  ACTION: 'SCENE_HEADING',
  CHARACTER: 'ACTION',
  PARENTHETICAL: 'CHARACTER',
  DIALOGUE: 'PARENTHETICAL',
  SCENE_HEADING: 'TRANSITION',
  TRANSITION: 'DIALOGUE',
};

// On an EMPTY line Tab means something else (content.js EMPTY_TAB).
export const EMPTY_TAB = { ACTION: 'CHARACTER', DIALOGUE: 'PARENTHETICAL', CHARACTER: 'ACTION' };

// ---------------------------------------------------------------------------
// Classifier — ported line for line from Code.js (isSceneHeading, isTransition,
// isStandaloneParenthetical, calculateScores, getTypeFromScores).
// ---------------------------------------------------------------------------

export function cleanText(text) {
  if (!text) return '';
  return text.replace(/^[\s﻿\xA0]+|[\s﻿\xA0]+$/g, '');
}

export function hasLowercase(text) { return /[a-zàâäéèêëïîôùûüç]/.test(text); }
export function hasUppercase(text) { return /[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/.test(text); }
export function isAllCaps(text) {
  return hasUppercase(text) && !hasLowercase(text);
}

export function isSceneHeading(text) {
  let clean = cleanText(text);
  clean = clean.replace(/^\d+[\.\-\)]\s*/, '');
  return /^(INT[\.\s]|EXT[\.\s]|INT\/EXT|I\/E|EXT\/INT|INTÉRIEUR|EXTÉRIEUR)/i.test(clean);
}

export function isTransition(text) {
  const t = text.trim();
  if (/^(FADE IN|FADE OUT|FADE TO BLACK|CUT TO|DISSOLVE TO|SMASH CUT TO|MATCH CUT TO|JUMP CUT TO|INTERCUT|WIPE TO|THE END)[:.]?$/i.test(t)) return true;
  if (/^(FONDU À L'OUVERTURE|FONDU AU NOIR|FONDU ENCHAÎNÉ|COUPE FRANCHE|CUT|FERMETURE AU NOIR|FIN)[:.]?$/i.test(t)) return true;
  if (/^(AUFBLENDE|ABBLENDE|ÜBERBLENDE|SCHNITT AUF|HARTER SCHNITT|SCHWARZBLENDE)[:.]?$/i.test(t)) return true;
  if (/^(FUNDIDO A NEGRO|CORTE A|DISOLVENCIA A|CORTE DIRECTO)[:.]?$/i.test(t)) return true;
  if (/^(APERTURA IN NERO|DISSOLVENZA IN CHIUSURA|DISSOLVENZA INCROCIATA|STACCO SU|STACCO NETTO|CHIUSURA IN NERO)[:.]?$/i.test(t)) return true;
  if (/^.+\s+TO:$/i.test(t)) return true;
  return false;
}

export function isStandaloneParenthetical(text) {
  return /^\([^)]+\)$/.test(text.trim()) && text.length < 60;
}

export function calculateScores(text, prevType, nextText) {
  const trimmed = text.trim();
  const upper = trimmed.toUpperCase();
  const scores = { SCENE_HEADING: 0, CHARACTER: 0, DIALOGUE: 0, PARENTHETICAL: 0, TRANSITION: 0, ACTION: 10 };

  if (isSceneHeading(trimmed)) scores.SCENE_HEADING += 100;
  if (isTransition(trimmed)) scores.TRANSITION += 100;

  if (isStandaloneParenthetical(trimmed)) {
    scores.PARENTHETICAL += 90;
    if (prevType === 'CHARACTER') scores.PARENTHETICAL += 50;
  }

  const textLength = trimmed.length;
  if (isAllCaps(trimmed) && textLength < 65 && textLength >= 2) {
    const endsWithPunctuation = /[.!]\s*$/.test(trimmed);
    const isInitials = /^(M\.|DR\.|MR\.|MRS\.|MME\.|PROF\.|V\.O\.|O\.S\.|[A-Z]\.[A-Z]\.?)/.test(upper);
    if (endsWithPunctuation && !isInitials) {
      scores.CHARACTER = -1000;
      scores.ACTION += 50;
    } else {
      scores.CHARACTER += 40;
      if (nextText && hasLowercase(nextText) && !isSceneHeading(nextText)) scores.CHARACTER += 30;
      if (/\b(SONNERIE|SILENCE|BANG|BRUIT|NOIR|FLASH|FONDU|CUT|FADE|GROS PLAN|INSERT)\b/i.test(upper)) {
        scores.CHARACTER -= 60;
        scores.ACTION += 40;
      }
    }
  }

  if (/^[A-Z].*\s*\((?:V\.?O\.?|O\.?S\.?|CONT'?D?|SUITE|OFF)\)$/i.test(trimmed)) scores.CHARACTER += 60;

  if (prevType === 'CHARACTER' || prevType === 'PARENTHETICAL') {
    const lettersOnly = trimmed.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    if (!isAllCaps(trimmed) || lettersOnly.length <= 1) scores.DIALOGUE += 70;
  }

  if (textLength > 100 || (hasUppercase(trimmed.charAt(0)) && !isAllCaps(trimmed))) scores.ACTION += 25;

  if (scores.SCENE_HEADING > 50) scores.CHARACTER = 0;

  return scores;
}

export function getTypeFromScores(scores) {
  let maxScore = -1;
  let maxType = 'ACTION';
  for (const type in scores) {
    if (scores[type] > maxScore) { maxScore = scores[type]; maxType = type; }
  }
  return maxType;
}

// Classify a whole document. `texts` = one string per paragraph, in order.
// Returns one entry per paragraph: { type, text } where type is null for an
// empty paragraph (to be removed) and text is the text to write back (upper
// cased where the element demands it).
export function classifyParagraphs(texts) {
  const out = [];
  let prevType = null;
  for (let i = 0; i < texts.length; i++) {
    const text = cleanText(texts[i]);
    if (!text) { out.push({ type: null, text: '' }); continue; }
    let nextText = null;
    for (let j = i + 1; j < texts.length; j++) {
      const n = cleanText(texts[j]);
      if (n) { nextText = n; break; }
    }
    const type = getTypeFromScores(calculateScores(text, prevType, nextText));
    out.push({ type, text: UPPERCASE[type] ? text.toUpperCase() : text });
    prevType = type;
  }
  return out;
}

// Live writing (the Final Draft feel). Called when the user presses Enter on a
// line: decide, from the line's text and its current element, whether the
// line must change element. Returns the new element, or null to leave it as it
// is. Only STRONG signals act here, because this runs on every Enter and a
// wrong guess costs more than a missed one:
//   - a scene heading or a transition always wins, whatever the style;
//   - a standalone (parenthetical) is a Parenthetical;
//   - a short ALL CAPS line typed as Action (or in plain Normal) is a Character;
//   - anything typed in Normal (no element yet) becomes Action.
export function liveDetect(text, currentType) {
  const t = cleanText(text);
  if (!t) return null;
  if (isSceneHeading(t)) return currentType === 'SCENE_HEADING' ? null : 'SCENE_HEADING';
  if (isTransition(t)) return currentType === 'TRANSITION' ? null : 'TRANSITION';
  if (isStandaloneParenthetical(t)) return currentType === 'PARENTHETICAL' ? null : 'PARENTHETICAL';
  if (!currentType || currentType === 'ACTION') {
    const lettersOnly = t.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    const endsWithPunctuation = /[.!?]\s*$/.test(t);
    if (isAllCaps(t) && lettersOnly.length >= 2 && t.length < 65 && !endsWithPunctuation
        && !/\b(SONNERIE|SILENCE|BANG|BRUIT|NOIR|FLASH|FONDU|CUT|FADE|GROS PLAN|INSERT)\b/.test(t)) {
      return 'CHARACTER';
    }
  }
  if (!currentType) return 'ACTION';
  return null;
}

// Instant re-read, run on every caret move WHILE typing (no Enter yet). Only
// prefixes that cannot be anything else act here, because the line is not
// finished: "int." / "ext." make a scene heading the moment the dot lands
// (the Final Draft reflex), a "(" at the start of a speech line opens a
// parenthetical, a typed transition is a transition, text in Normal is Action.
// Character names wait for Enter: "INT" is all caps too, for three keystrokes.
export function instantDetect(text, currentType) {
  const t = cleanText(text);
  if (!t) return null;
  if (isSceneHeading(t)) return currentType === 'SCENE_HEADING' ? null : 'SCENE_HEADING';
  if (isTransition(t)) return currentType === 'TRANSITION' ? null : 'TRANSITION';
  if (!currentType) return 'ACTION';
  return null;
}

// The element to switch to when the user asks for "next type" on a line.
export function cycleNext(type, lineEmpty) {
  if (lineEmpty) return EMPTY_TAB[type] || null;
  return TAB_NEXT[type] || null;
}

export function cyclePrev(type) {
  return TAB_PREV[type] || null;
}
