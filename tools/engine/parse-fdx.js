// parse-fdx.js — Final Draft (.fdx) vers blocs typés.
//
// Le .fdx est le cas facile et c'est celui qui compte le plus : le fichier
// porte déjà le type de chaque paragraphe, donc la conversion est fidèle à
// 100 % et ne repose sur aucune devinette. On ne rejoue le classificateur que
// pour les types que Final Draft laisse flous ("General").

import { parseXml, findAll, textOf } from './xml.js';
import { calculateScores, getTypeFromScores, cleanText } from './screenplay.js';
import { converterError } from './messages.js';

// Types Final Draft vers les nôtres. Shot et General n'ont pas d'équivalent :
// à l'écran ce sont des lignes d'action, c'est là qu'ils doivent atterrir.
const TYPE_MAP = {
  'Scene Heading': 'SCENE_HEADING',
  'Action': 'ACTION',
  'Character': 'CHARACTER',
  'Parenthetical': 'PARENTHETICAL',
  'Dialogue': 'DIALOGUE',
  'Transition': 'TRANSITION',
  'Shot': 'ACTION',
  'General': null // au classificateur de trancher
};

// Ni les listes de rôles ni les marqueurs d'acte ne sont du scénario.
const DROPPED = new Set(['Cast List', 'New Act', 'End of Act', 'Act Break', 'Summary']);

function childrenNamed(node, name) {
  return node.children.filter((c) => typeof c !== 'string' && c.name === name);
}

function paragraphText(paragraph) {
  // Un paragraphe Final Draft peut être découpé en plusieurs <Text> (gras,
  // italique, souligné). On recolle, on ne garde pas les styles : le format
  // scénario n'en a pas besoin et l'add-on les réécrirait de toute façon.
  const parts = childrenNamed(paragraph, 'Text').map(textOf);
  const raw = parts.length ? parts.join('') : textOf(paragraph);
  return cleanText(raw.replace(/\s*\n\s*/g, ' '));
}

function readTitlePage(finalDraft) {
  const titlePages = childrenNamed(finalDraft, 'TitlePage');
  if (!titlePages.length) return null;

  const lines = findAll(titlePages[0], 'Paragraph')
    .map(paragraphText)
    .filter(Boolean);
  if (!lines.length) return null;

  const meta = {};
  const loose = [];
  for (const line of lines) {
    const m = line.match(/^(Title|Credit|Author|Authors|Source|Draft date|Date|Contact|Copyright)\s*:\s*(.*)$/i);
    if (m && m[2]) meta[m[1].toLowerCase()] = m[2].trim();
    else loose.push(line);
  }

  // Une page de titre Final Draft n'est presque jamais étiquetée : c'est du
  // texte centré. Sans étiquette, la première ligne est le titre et ce qui suit
  // un "written by" est l'auteur.
  if (!meta.title && loose.length) meta.title = loose[0];
  if (!meta.author) {
    const byIndex = loose.findIndex((l) => /^(written|screenplay|story)\s+by$/i.test(l.trim()));
    if (byIndex !== -1 && loose[byIndex + 1]) meta.author = loose[byIndex + 1];
  }

  return { ...meta, lines };
}

/**
 * @param {string} source contenu du .fdx
 * @returns {{blocks: {type: string, text: string}[], titlePage: Object|null, warnings: string[]}}
 */
export function parseFdx(source) {
  const warnings = [];
  const root = parseXml(source);
  const finalDraft = findAll(root, 'FinalDraft')[0];

  if (!finalDraft) {
    throw converterError('not-fdx');
  }

  // Le corps est le <Content> enfant direct de <FinalDraft>. Celui de
  // <TitlePage> porte le même nom, d'où la recherche sur un seul niveau.
  const content = childrenNamed(finalDraft, 'Content')[0];
  if (!content) throw converterError('empty-fdx');

  const paragraphs = findAll(content, 'Paragraph');
  const blocks = [];
  let dropped = 0;
  let dualDialogue = 0;

  for (const paragraph of paragraphs) {
    const fdType = paragraph.attrs.Type || 'General';
    if (DROPPED.has(fdType)) { dropped++; continue; }

    const text = paragraphText(paragraph);
    if (!text) continue;

    let type = TYPE_MAP[fdType];
    if (type === undefined) type = null;
    if (type === null) {
      const prev = blocks.length ? blocks[blocks.length - 1].type : null;
      type = getTypeFromScores(calculateScores(text, prev, ''));
    }

    blocks.push({ type, text: type === 'TRANSITION' ? text.toUpperCase() : text });
  }

  dualDialogue = findAll(content, 'DualDialogue').length;
  if (dualDialogue) warnings.push({ code: 'dual-dialogue', count: dualDialogue });
  if (dropped) warnings.push({ code: 'dropped-elements', count: dropped });
  if (!blocks.length) throw converterError('empty-fdx');

  return { blocks, titlePage: readTitlePage(finalDraft), warnings };
}
