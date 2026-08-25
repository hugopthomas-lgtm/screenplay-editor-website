// parse-fountain.js — Fountain (.fountain, .spmd, .txt) vers blocs typés.
//
// Fountain encode le type dans la ponctuation et dans les lignes vides
// alentour, donc la conversion est fidèle tant qu'on respecte ces deux
// signaux. Quand une ligne reste ambiguë, on repasse la main au barème de
// l'add-on plutôt que d'inventer une deuxième vérité.

import {
  calculateScores,
  getTypeFromScores,
  isSceneHeading,
  isTransitionLoose,
  isAllCaps,
  cleanText
} from './screenplay.js';
import { converterError } from './messages.js';

const TITLE_KEYS = /^(title|credit|author|authors|source|draft date|date|contact|copyright|notes|revision)\s*:/i;

function stripEmphasis(text) {
  // Un marqueur échappé (\* ou \_) est un caractère ordinaire, pas du gras.
  // Il faut le mettre de côté AVANT de retirer les marqueurs, sinon le retrait
  // avale la barre oblique et laisse l'astérisque tout seul.
  let out = String(text).replace(/\\\*/g, '\uE000').replace(/\\_/g, '\uE001');

  // Le format scénario n'a ni gras ni italique : les marqueurs Fountain
  // deviendraient des astérisques visibles dans le document.
  out = out
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1');

  return out.replace(/\uE000/g, '*').replace(/\uE001/g, '_');
}

function preprocess(source) {
  return source
    .replace(/\r\n?/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, '')  // boneyard
    .replace(/\[\[[\s\S]*?\]\]/g, '');  // notes
}

function readTitlePage(lines) {
  if (!lines.length || !TITLE_KEYS.test(lines[0])) return { titlePage: null, rest: lines };

  const meta = {};
  const collected = [];
  let i = 0;
  let currentKey = null;

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) break;

    const m = line.match(/^([A-Za-z ]+):\s*(.*)$/);
    if (m && TITLE_KEYS.test(line)) {
      currentKey = m[1].trim().toLowerCase();
      meta[currentKey] = m[2].trim();
      collected.push(line.trim());
    } else if (currentKey && /^\s+\S/.test(line)) {
      // Valeur sur plusieurs lignes : Fountain les indente.
      meta[currentKey] = (meta[currentKey] ? meta[currentKey] + '\n' : '') + line.trim();
      collected.push(line.trim());
    } else {
      break;
    }
  }

  while (i < lines.length && !lines[i].trim()) i++;
  return { titlePage: { ...meta, lines: collected }, rest: lines.slice(i) };
}

/**
 * @param {string} source
 * @returns {{blocks: {type: string, text: string}[], titlePage: Object|null, warnings: string[]}}
 */
export function parseFountain(source) {
  const warnings = [];
  const allLines = preprocess(source).split('\n');
  const { titlePage, rest } = readTitlePage(allLines);

  const blocks = [];
  let inDialogue = false;
  let dualDialogue = 0;

  const prevBlank = (i) => i === 0 || !rest[i - 1].trim();
  const nextLine = (i) => (i + 1 < rest.length ? rest[i + 1] : '');

  for (let i = 0; i < rest.length; i++) {
    const raw = rest[i];
    const line = cleanText(raw);

    if (!line) { inDialogue = false; continue; }

    // Sections, synopsis et sauts de page ne sont pas du scénario.
    if (/^#{1,6}\s/.test(line) || /^=(?!=)/.test(line) || /^={3,}\s*$/.test(line)) {
      inDialogue = false;
      continue;
    }

    let text = stripEmphasis(line);
    let type = null;

    // --- éléments forcés ---
    if (text.startsWith('!')) {
      type = 'ACTION';
      text = text.slice(1).trim();
    } else if (text.startsWith('.') && !text.startsWith('..')) {
      type = 'SCENE_HEADING';
      text = text.slice(1).trim();
    } else if (text.startsWith('@')) {
      type = 'CHARACTER';
      text = text.slice(1).trim();
    } else if (text.startsWith('>') && text.endsWith('<')) {
      // Texte centré : Google Docs le rendrait comme de l'action.
      type = 'ACTION';
      text = text.slice(1, -1).trim();
    } else if (text.startsWith('>')) {
      type = 'TRANSITION';
      text = text.slice(1).trim();
    }

    if (type === 'CHARACTER' || (type === null && !inDialogue)) {
      if (text.endsWith('^')) {
        text = text.slice(0, -1).trim();
        if (type === null && isAllCaps(text)) type = 'CHARACTER';
        dualDialogue++;
      }
    }

    // --- éléments déduits ---
    if (type === null) {
      if (isSceneHeading(text) && prevBlank(i)) {
        type = 'SCENE_HEADING';
      } else if (inDialogue && /^\(.*\)$/.test(text)) {
        type = 'PARENTHETICAL';
      } else if (inDialogue) {
        type = 'DIALOGUE';
      } else if (isTransitionLoose(text) && prevBlank(i) && !nextLine(i).trim()) {
        type = 'TRANSITION';
      } else if (isAllCaps(text) && prevBlank(i) && nextLine(i).trim() && text.length < 65) {
        type = 'CHARACTER';
      } else {
        // Rien de décisif : c'est le barème de l'add-on qui tranche, pour que
        // le tri soit le même ici et dans le produit.
        const prev = blocks.length ? blocks[blocks.length - 1].type : null;
        type = getTypeFromScores(calculateScores(text, prev, cleanText(nextLine(i))));
      }
    }

    if (!text) continue;

    inDialogue = type === 'CHARACTER' || type === 'PARENTHETICAL' || type === 'DIALOGUE';
    blocks.push({ type, text: type === 'TRANSITION' ? text.toUpperCase() : text });
  }

  if (dualDialogue) warnings.push({ code: 'dual-dialogue', count: dualDialogue });
  if (!blocks.length) throw converterError('empty-file');

  return { blocks, titlePage, warnings };
}
