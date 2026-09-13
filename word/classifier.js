// Screenplay Editor for Word — the whole-document classifier behind
// « Format document ». Ported from the Google Docs add-on (Code.js:
// isSceneHeading, isTransition, isStandaloneParenthetical, calculateScores,
// getTypeFromScores) on 2026-09-13. Its natural home is the shared engine;
// until Code.js can load engine.js, this copy mirrors it by hand.
//
// Everything about the six elements themselves (names, matrices, casing)
// comes from SEEngine (src/engine.js, loaded before this module).

const E = globalThis.SEEngine;

export const ELEMENTS = E.MODES;
export const STYLE_NAMES = E.MODE_LABELS;
export const UPPERCASE = E.UPPERCASE_MODES;

export function elementFromStyleName(name) {
  for (const key of ELEMENTS) if (STYLE_NAMES[key] === name) return key;
  return null;
}

export function cleanText(text) {
  if (!text) return '';
  return text.replace(/^[\s﻿\xA0]+|[\s﻿\xA0]+$/g, '');
}

export function hasLowercase(text) { return /[a-zàâäéèêëïîôùûüç]/.test(text); }
export function hasUppercase(text) { return /[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/.test(text); }
export function isAllCaps(text) { return hasUppercase(text) && !hasLowercase(text); }

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
// Returns { type, text } per paragraph: type null = empty paragraph to drop,
// text = what to write back (upper cased where the element demands it).
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
    const fixed = type === 'CHARACTER' ? E.upperCueName(text) : (UPPERCASE[type] ? text.toUpperCase() : text);
    out.push({ type, text: fixed });
    prevType = type;
  }
  return out;
}
