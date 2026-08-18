// screenplay.js — le modèle commun du convertisseur.
//
// Tout ce qui suit est porté à l'identique depuis Code.js (l'add-on) : mêmes
// prédicats, même barème, mêmes indentations, mêmes règles de ligne vide. C'est
// volontaire et ça doit le rester : un document produit ici doit être reconnu
// par l'extension et par l'add-on sans qu'ils aient une seule ligne à corriger.
// Si une règle change dans Code.js, elle change ici, et les tests le disent.
//
// Aucune dépendance, aucun DOM : ce fichier tourne dans le navigateur comme
// dans Node.

export const TYPES = [
  'SCENE_HEADING',
  'ACTION',
  'CHARACTER',
  'DIALOGUE',
  'PARENTHETICAL',
  'TRANSITION'
];

// Indentations en points, mesurées depuis la marge (Code.js, CONFIG.INDENTS_*).
export const INDENTS = {
  US: {
    SCENE_HEADING: { left: 0, right: 0 },
    ACTION: { left: 0, right: 0 },
    CHARACTER: { left: 194, right: 0 },
    DIALOGUE: { left: 101, right: 94 },
    PARENTHETICAL: { left: 151, right: 137 },
    TRANSITION: { left: 0, right: 0 }
  },
  A4: {
    SCENE_HEADING: { left: 0, right: 0 },
    ACTION: { left: 0, right: 0 },
    CHARACTER: { left: 178, right: 0 },
    DIALOGUE: { left: 93, right: 93 },
    PARENTHETICAL: { left: 136, right: 136 },
    TRANSITION: { left: 0, right: 0 }
  }
};

export const PAGE = {
  US: { width: 612, height: 792, marginLeft: 108, marginRight: 72, marginTop: 72, marginBottom: 72 },
  A4: { width: 595, height: 842, marginLeft: 72, marginRight: 72, marginTop: 72, marginBottom: 57 }
};

export const FONT_FAMILY = 'Courier Prime';
export const FONT_SIZE = 12;

// ============================================
// PRÉDICATS (Code.js l.1155-1220)
// ============================================

export function isAllCaps(text) {
  const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  return letters.length > 0 && letters === letters.toUpperCase();
}

export function hasLowercase(text) { return /[a-zàâäéèêëïîôùûüç]/.test(text); }
export function hasUppercase(text) { return /[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/.test(text); }

export function cleanText(text) {
  if (!text) return '';
  return text.replace(/^[\s﻿\xA0]+|[\s﻿\xA0]+$/g, '');
}

export function isSceneHeading(text) {
  let clean = cleanText(text);
  clean = clean.replace(/^\d+[.\-)]\s*/, '');
  return /^(INT[.\s]|EXT[.\s]|INT\/EXT|I\/E|EXT\/INT|INTÉRIEUR|EXTÉRIEUR)/i.test(clean);
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

/**
 * La typographie française met une espace avant le deux-points : « CUT TO : ».
 * isTransition, repris tel quel de Code.js, ne la connaît pas, et La Petite
 * Inspectrice y perd toutes ses transitions sauf une. On ne touche pas au
 * prédicat partagé (il doit rester identique à l'add-on), on normalise ce
 * qu'on lui donne à lire. Le texte écrit dans le document, lui, garde son
 * espace : c'est celle de l'auteur.
 *
 * ⚠️ Le même défaut existe dans Code.js et mérite d'y être corrigé.
 */
export function isTransitionLoose(text) {
  return isTransition(text.replace(/[\s\u00A0\u202F]+([:.])\s*$/, '$1'));
}

/**
 * Le nom d'un personnage, sans ses extensions.
 *
 * Il peut y en avoir PLUSIEURS à la suite : « THOMAS LIEBENWERDA (O.S.)
 * (CONT'D) » existe vraiment, vu dans le scénario de The Teachers' Lounge. Une
 * règle qui n'en retire qu'une laisse « THOMAS LIEBENWERDA (O.S.) » et le
 * personnage apparaît deux fois dans tous les rapports.
 */
export function characterName(text) {
  return String(text || '').replace(/(\s*\([^)]*\))+\s*$/, '').trim();
}

export function isStandaloneParenthetical(text) {
  return /^\([^)]+\)$/.test(text.trim()) && text.length < 60;
}

// ============================================
// BARÈME (Code.js l.1290-1355)
// ============================================

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

/**
 * Classe une suite de lignes brutes (sans indication de type) en blocs typés.
 * C'est le chemin utilisé quand la source ne porte aucune structure : un PDF
 * dont les positions sont illisibles, ou un texte collé à la main.
 *
 * @param {string[]} lines
 * @returns {{type: string, text: string}[]}
 */
export function classifyLines(lines) {
  const blocks = [];
  let prevType = null;

  for (let i = 0; i < lines.length; i++) {
    const text = cleanText(lines[i]);
    if (!text) { prevType = null; continue; }

    let nextText = '';
    for (let j = i + 1; j < lines.length; j++) {
      const candidate = cleanText(lines[j]);
      if (candidate) { nextText = candidate; break; }
    }

    const type = getTypeFromScores(calculateScores(text, prevType, nextText));
    blocks.push({ type, text: type === 'TRANSITION' ? text.toUpperCase() : text });
    prevType = type;
  }

  return blocks;
}

// ============================================
// LIGNES VIDES (Code.js, autoFormatShouldInsertSpaceBefore_)
// ============================================

const LIST_REGEX = /^[-–—•]/;

export function shouldInsertSpaceBefore(lastType, lastText, type, text) {
  if (lastType === null || lastText === '' || lastText == null) return false;
  if (lastType === 'SCENE_HEADING') return true;
  if (type === 'SCENE_HEADING') return true;
  if (type === 'TRANSITION') return true;
  if (type === 'CHARACTER') return true;
  if (type === 'ACTION' && (lastType === 'DIALOGUE' || lastType === 'PARENTHETICAL')) return true;
  if (type === 'ACTION' && lastType === 'ACTION') {
    const currentIsDash = LIST_REGEX.test(text);
    const prevIsDash = LIST_REGEX.test(lastText);
    return !(currentIsDash && prevIsDash);
  }
  return false;
}

/**
 * Intercale les paragraphes vides entre les blocs, exactement comme l'add-on le
 * fait quand il formate un document. Le résultat est ce qui part dans le .docx.
 *
 * @param {{type: string, text: string}[]} blocks
 * @returns {{type: string, text: string}[]} blocs + séparateurs ({type:'BLANK'})
 */
export function withBlankLines(blocks) {
  const out = [];
  let lastType = null;
  let lastText = null;

  for (const block of blocks) {
    if (shouldInsertSpaceBefore(lastType, lastText, block.type, block.text)) {
      out.push({ type: 'BLANK', text: '' });
    }
    out.push(block);
    lastType = block.type;
    lastText = block.text;
  }

  return out;
}

/**
 * Compte les éléments par type. Sert au rapport affiché après conversion : le
 * lecteur doit pouvoir vérifier d'un coup d'œil que rien ne s'est perdu.
 */
export function summarize(blocks) {
  const counts = Object.fromEntries(TYPES.map((t) => [t, 0]));
  const characters = new Set();
  let scenes = 0;

  for (const block of blocks) {
    if (counts[block.type] !== undefined) counts[block.type]++;
    if (block.type === 'SCENE_HEADING') scenes++;
    if (block.type === 'CHARACTER') {
      characters.add(characterName(block.text));
    }
  }

  return { counts, scenes, characters: [...characters].sort() };
}
