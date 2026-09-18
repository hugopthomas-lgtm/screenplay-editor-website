// parse-osf.js — Fade In (.fadein) et Open Screenplay Format (.osf) vers blocs.
//
// Un .fadein est une archive ZIP qui contient un seul fichier, document.xml,
// écrit dans un format ouvert : « Open Screenplay Format ». Vérifié sur un
// vrai scénario de Fade In 5.0 (96 pages, 2 317 paragraphes), pas sur une
// spécification lue de loin.
//
// La structure est simple et, comme le .fdx, elle DIT le type de chaque
// paragraphe, donc rien n'est deviné :
//
//   <paragraphs>
//     <para><style basestyle="Scene Heading"/><text bold="1">INT. …</text></para>
//     <para><style basestyle="Action"/><text>…</text></para>
//   </paragraphs>
//
// Un paragraphe peut porter plusieurs <text> quand l'auteur a mis un morceau
// en gras : on les recolle, comme pour Final Draft.

import { parseXml, findAll, textOf } from './xml.js';
import { calculateScores, getTypeFromScores, cleanText, titlePageFromLines } from './screenplay.js';
import { converterError } from './messages.js';

// Les styles de base d'Open Screenplay Format vers les nôtres. « Normal Text »
// est le fourre-tout de Fade In, exactement comme « General » dans le .fdx :
// c'est au classificateur de trancher.
const STYLE_MAP = {
  'Scene Heading': 'SCENE_HEADING',
  'Action': 'ACTION',
  'Character': 'CHARACTER',
  'Dialogue': 'DIALOGUE',
  'Parenthetical': 'PARENTHETICAL',
  'Transition': 'TRANSITION',
  'Shot': 'ACTION',
  'Normal Text': null
};

function childrenNamed(node, name) {
  return node.children.filter((c) => typeof c !== 'string' && c.name === name);
}

function paraText(para) {
  const parts = childrenNamed(para, 'text').map(textOf);
  const raw = parts.length ? parts.join('') : textOf(para);
  return cleanText(raw.replace(/\s*\n\s*/g, ' '));
}

function paraStyle(para) {
  const style = childrenNamed(para, 'style')[0];
  return (style && style.attrs.basestyle) || 'Normal Text';
}

// Fade In marque les champs de sa page de titre par un signet. C'est un
// signal exact, à préférer à la lecture au jugé : sur le scénario d'essai, le
// titre est « NIQUES LE P », que rien d'autre ne permettait de deviner.
const BOOKMARK = { Title: 'title', Author: 'author', Copyright: 'copyright', Draft: 'draft date', Contact: 'contact' };

function readTitlePage(node) {
  if (!node) return null;

  const paras = childrenNamed(node, 'para');
  const marked = {};
  const rest = [];

  for (const para of paras) {
    const text = paraText(para);
    if (!text) continue;
    const field = BOOKMARK[para.attrs.bookmark];
    if (field) marked[field] = text;
    else rest.push(text);
  }

  // Ce qui n'est pas marqué passe par la lecture commune, qui saura repérer
  // un « Écrit par … » laissé libre.
  const loose = titlePageFromLines(rest) || {};
  const merged = { ...loose, ...marked };
  merged.lines = [...(marked.title ? [marked.title] : []), ...rest];
  return Object.keys(merged).length > 1 ? merged : null;
}

/**
 * @param {string} source contenu de document.xml
 * @returns {{blocks: {type: string, text: string}[], titlePage: Object|null, warnings: Array}}
 */
export function parseOsf(source) {
  const root = parseXml(source);
  const document_ = findAll(root, 'document')[0];
  if (!document_) throw converterError('not-osf');

  // <titlepage> porte des <para> du même nom que le corps : il faut donc
  // prendre le <paragraphs> du document, pas le premier venu.
  const body = childrenNamed(document_, 'paragraphs')[0];
  if (!body) throw converterError('empty-osf');

  const blocks = [];
  for (const para of childrenNamed(body, 'para')) {
    const text = paraText(para);
    if (!text) continue;

    let type = STYLE_MAP[paraStyle(para)];
    if (type === undefined) type = null;
    if (type === null) {
      const prev = blocks.length ? blocks[blocks.length - 1].type : null;
      type = getTypeFromScores(calculateScores(text, prev, ''));
    }

    blocks.push({ type, text: type === 'TRANSITION' ? text.toUpperCase() : text });
  }

  if (!blocks.length) throw converterError('empty-osf');

  const titlePage = readTitlePage(childrenNamed(document_, 'titlepage')[0]);

  return { blocks, titlePage, warnings: [] };
}
