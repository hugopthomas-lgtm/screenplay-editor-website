// parse-docx.js — un .docx de scénario vers blocs typés.
//
// C'est la direction qui manquait le plus, parce que c'est celle de nos
// propres utilisateurs : quelqu'un écrit cent pages dans Google Docs, les
// télécharge en .docx, et veut son .fdx. Jusqu'ici il fallait passer par un
// PDF, donc perdre en route ce que le document savait déjà.
//
// Un .docx ne dit pas « ceci est une réplique ». Il dit « ce paragraphe est
// retiré de 101 points à gauche et de 94 à droite », ce qui est la même
// information dès qu'on sait lire les colonnes. Deux façons de les lire, dans
// cet ordre :
//
//   1. Les indentations de l'add-on, au point près. Un document produit par
//      Screenplay Editor, par notre convertisseur ou par l'extension tombe
//      dedans, et la lecture est exacte.
//   2. Sinon, les colonnes se reconnaissent les unes par rapport aux autres,
//      la leçon du lecteur de PDF : un gabarit Word met le dialogue ailleurs
//      que Final Draft, mais il le met toujours à gauche du personnage.
//
// Et quand il ne reste rien de géométrique, c'est le barème de l'add-on qui
// tranche, comme partout ailleurs.

import { parseXml, findAll, textOf } from './xml.js';
import {
  INDENTS, calculateScores, getTypeFromScores, cleanText, titlePageFromLines
} from './screenplay.js';
import { unzipText } from './unzip.js';
import { converterError } from './messages.js';

const TWIPS_TO_PT = 1 / 20;
// Une demi-lettre en Courier 12 : de quoi absorber un arrondi, pas de quoi
// confondre deux colonnes voisines.
const TOLERANCE = 6;

function childrenNamed(node, name) {
  return node.children.filter((c) => typeof c !== 'string' && c.name === name);
}

function firstNamed(node, name) {
  return childrenNamed(node, name)[0] || null;
}

function paragraphText(p) {
  return cleanText(findAll(p, 'w:t').map(textOf).join('').replace(/\s*\n\s*/g, ' '));
}

function paragraphGeometry(p) {
  const pPr = firstNamed(p, 'w:pPr');
  if (!pPr) return { left: 0, right: 0, align: 'left' };
  const ind = firstNamed(pPr, 'w:ind');
  const jc = firstNamed(pPr, 'w:jc');
  return {
    left: ind ? Math.round(parseInt(ind.attrs['w:left'] || '0', 10) * TWIPS_TO_PT) : 0,
    right: ind ? Math.round(parseInt(ind.attrs['w:right'] || '0', 10) * TWIPS_TO_PT) : 0,
    align: (jc && jc.attrs['w:val']) || 'left'
  };
}

/** Le jeu d'indentations de l'add-on qui colle le mieux, s'il y en a un. */
function matchKnownIndents(geometries) {
  for (const format of ['US', 'A4']) {
    const wanted = INDENTS[format];
    const hits = geometries.filter((g) =>
      ['CHARACTER', 'DIALOGUE', 'PARENTHETICAL'].some(
        (type) => Math.abs(g.left - wanted[type].left) <= TOLERANCE && wanted[type].left > 0
      )
    ).length;
    // Un scénario a forcément du dialogue : si un quart des paragraphes tombe
    // sur ces colonnes-là, le document vient bien de chez nous.
    if (hits >= Math.max(3, geometries.length * 0.15)) return wanted;
  }
  return null;
}

/** À défaut, les colonnes se classent les unes par rapport aux autres. */
function inferColumns(geometries) {
  const counts = new Map();
  for (const g of geometries) {
    if (g.left > 12) counts.set(g.left, (counts.get(g.left) || 0) + 1);
  }
  // On ne garde que les colonnes vraiment peuplées : une indentation vue deux
  // fois est une faute de frappe, pas une colonne.
  const columns = [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([left]) => left)
    .sort((a, b) => a - b);

  if (columns.length < 2) return null;
  if (columns.length === 2) {
    return { DIALOGUE: { left: columns[0] }, CHARACTER: { left: columns[1] }, PARENTHETICAL: null };
  }
  return {
    DIALOGUE: { left: columns[0] },
    PARENTHETICAL: { left: columns[1] },
    CHARACTER: { left: columns[2] }
  };
}

function typeFromGeometry(geometry, indents) {
  if (!indents) return null;
  for (const type of ['CHARACTER', 'PARENTHETICAL', 'DIALOGUE']) {
    const column = indents[type];
    if (column && column.left > 0 && Math.abs(geometry.left - column.left) <= TOLERANCE) return type;
  }
  return null;
}

/**
 * @param {string} source contenu de word/document.xml
 * @returns {{blocks: Array, titlePage: Object|null, warnings: Array, confident: boolean}}
 */
export function parseDocxXml(source) {
  const root = parseXml(source);
  const body = findAll(root, 'w:body')[0];
  if (!body) throw converterError('not-docx');

  const paragraphs = childrenNamed(body, 'w:p')
    .map((p) => ({ text: paragraphText(p), ...paragraphGeometry(p) }));

  // La page de titre est une suite de lignes centrées en tête de document,
  // avant que le scénario ne commence à gauche.
  const titleLines = [];
  let start = 0;
  for (let i = 0; i < paragraphs.length && i < 40; i++) {
    const p = paragraphs[i];
    if (!p.text) continue;
    if (p.align !== 'center') { start = i; break; }
    titleLines.push(p.text);
    start = i + 1;
  }
  const titlePage = titleLines.length >= 2 ? titlePageFromLines(titleLines) : null;
  if (!titlePage) start = 0;

  const bodyParagraphs = paragraphs.slice(start).filter((p) => p.text);
  if (!bodyParagraphs.length) throw converterError('empty-docx');

  const known = matchKnownIndents(bodyParagraphs);
  const indents = known || inferColumns(bodyParagraphs);
  const warnings = [];
  if (!known) warnings.push({ code: 'docx-columns-guessed' });

  const blocks = [];
  for (let i = 0; i < bodyParagraphs.length; i++) {
    const p = bodyParagraphs[i];
    let type = p.align === 'right' ? 'TRANSITION' : typeFromGeometry(p, indents);

    if (!type) {
      const prev = blocks.length ? blocks[blocks.length - 1].type : null;
      const next = bodyParagraphs[i + 1] ? bodyParagraphs[i + 1].text : '';
      type = getTypeFromScores(calculateScores(p.text, prev, next));
    }

    blocks.push({ type, text: type === 'TRANSITION' ? p.text.toUpperCase() : p.text });
  }

  return { blocks, titlePage, warnings, confident: Boolean(known) };
}

/**
 * @param {Uint8Array|ArrayBuffer} data le fichier .docx entier
 */
export async function parseDocx(data) {
  let xml;
  try {
    xml = await unzipText(data, 'word/document.xml');
  } catch {
    throw converterError('not-docx');
  }
  return parseDocxXml(xml);
}
