// parse-celtx.js — un projet Celtx (.celtx) vers blocs typés.
//
// ⚠️ Le seul lecteur de ce moteur qui n'a PAS été calibré sur un vrai fichier,
// faute d'en avoir un sous la main. Tout le reste (PDF, .fdx, Fountain,
// .fadein, .docx) a été vérifié sur un scénario réel. Ici, la structure vient
// de la documentation : un .celtx est une archive ZIP qui contient le script
// en HTML, avec une classe par type de paragraphe.
//
// Conséquence assumée sur la façon d'écrire ce fichier : on ne fait confiance
// aux classes que si on les reconnaît, et sinon on garde le texte et on laisse
// le barème de l'add-on trancher. Un projet Celtx dont les classes auraient
// changé rend donc un scénario un peu moins bien typé, jamais un écran vide.
//
// Le Celtx d'aujourd'hui est une application web qui exporte en Fountain et en
// .txt : c'est le chemin le plus sûr, et la page le dit.

import {
  calculateScores, getTypeFromScores, cleanText, titlePageFromLines
} from './screenplay.js';
import { unzip, firstEntry } from './unzip.js';
import { converterError } from './messages.js';

const CLASS_MAP = {
  sceneheading: 'SCENE_HEADING',
  slugline: 'SCENE_HEADING',
  action: 'ACTION',
  character: 'CHARACTER',
  dialog: 'DIALOGUE',
  dialogue: 'DIALOGUE',
  parenthetical: 'PARENTHETICAL',
  paren: 'PARENTHETICAL',
  transition: 'TRANSITION',
  shot: 'ACTION'
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(text) {
  return text
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, name) => (ENTITIES[name] !== undefined ? ENTITIES[name] : m));
}

/** Les paragraphes d'un fragment HTML, avec la classe portée par chacun. */
export function paragraphsFromHtml(html) {
  const body = html.replace(/<(script|style|head)\b[\s\S]*?<\/\1>/gi, ' ');
  const out = [];

  for (const m of body.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)) {
    const attrs = m[1];
    const classMatch = attrs.match(/class\s*=\s*["']([^"']*)["']/i);
    const text = cleanText(decode(m[2].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' '));
    if (!text) continue;

    let type = null;
    for (const name of (classMatch ? classMatch[1] : '').toLowerCase().split(/\s+/)) {
      if (CLASS_MAP[name]) { type = CLASS_MAP[name]; break; }
    }
    out.push({ type, text });
  }

  return out;
}

/** Type les paragraphes, en gardant ce que le HTML disait quand il le disait. */
export function blocksFromParagraphs(paragraphs) {
  const blocks = [];
  let guessed = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    let { type, text } = paragraphs[i];
    if (!type) {
      guessed++;
      const prev = blocks.length ? blocks[blocks.length - 1].type : null;
      const next = paragraphs[i + 1] ? paragraphs[i + 1].text : '';
      type = getTypeFromScores(calculateScores(text, prev, next));
    }
    blocks.push({ type, text: type === 'TRANSITION' ? text.toUpperCase() : text });
  }

  return { blocks, guessed };
}

/**
 * @param {Uint8Array|ArrayBuffer} data le fichier .celtx entier
 */
export async function parseCeltx(data) {
  let files;
  try {
    files = await unzip(data);
  } catch {
    throw converterError('not-celtx');
  }

  const entry = firstEntry(files, ['.html', '.htm', '.xhtml']);
  if (!entry) throw converterError('not-celtx');

  const paragraphs = paragraphsFromHtml(new TextDecoder().decode(entry.bytes));
  if (!paragraphs.length) throw converterError('empty-celtx');

  const { blocks, guessed } = blocksFromParagraphs(paragraphs);
  const warnings = [];
  // La moitié des paragraphes sans classe reconnue veut dire que la structure
  // n'est pas celle attendue : il faut le dire au lieu de faire comme si.
  if (guessed > paragraphs.length / 2) warnings.push({ code: 'celtx-classes-unknown' });

  const titleIndex = blocks.findIndex((b) => b.type === 'SCENE_HEADING');
  const titlePage = titleIndex > 1 ? titlePageFromLines(blocks.slice(0, titleIndex).map((b) => b.text)) : null;

  return { blocks: titlePage ? blocks.slice(titleIndex) : blocks, titlePage, warnings, confident: guessed === 0 };
}
