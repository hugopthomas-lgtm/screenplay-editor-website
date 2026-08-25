// write-fountain.js — nos blocs typés vers du Fountain.
//
// Fountain n'a pas de balises : le type d'une ligne se lit dans sa ponctuation
// et dans les lignes vides autour. Écrire du Fountain, c'est donc reproduire
// ces deux signaux, et forcer explicitement dès qu'une ligne serait relue de
// travers. C'est tout l'enjeu de ce fichier, et c'est là que les convertisseurs
// approximatifs se trompent :
//
//   « BUREAU DE NUIT » en action serait relu comme un personnage  -> on force !
//   « ANNA » sans dialogue derrière serait relu comme de l'action  -> on force @
//   « PLUS TARD » en tête de scène ne commence pas par INT/EXT     -> on force .
//   « RETOUR AU NOIR » en transition ne finit pas par TO:          -> on force >
//
// Un aller-retour (écrire puis relire avec parse-fountain.js) rend les mêmes
// blocs, et un test le vérifie.

import { isSceneHeading, isTransition, isAllCaps } from './screenplay.js';

// Les astérisques et les tirets bas portent le gras et l'italique en Fountain.
// Dans un texte d'action ils doivent rester des caractères ordinaires.
function escapeEmphasis(text) {
  return String(text || '').replace(/([*_])/g, '\\$1');
}

function sceneHeadingLine(text) {
  const clean = text.trim();
  // Fountain reconnaît INT./EXT./EST./I.E. tout seul. Le reste se force par un
  // point en tête, qui ne s'affiche pas.
  return isSceneHeading(clean) ? clean.toUpperCase() : `.${clean.toUpperCase()}`;
}

function transitionLine(text) {
  const clean = text.trim().toUpperCase();
  return isTransition(clean) && /TO:$/.test(clean) ? clean : `> ${clean}`;
}

function characterLine(text) {
  const clean = text.trim();
  // Un nom en capitales suffit. Un nom qui porte des minuscules (« McCOY »,
  // « Dr Anna ») ne serait pas reconnu : l'arobase le force.
  return isAllCaps(clean) ? clean : `@${clean}`;
}

function actionLine(text) {
  const clean = escapeEmphasis(text.trim());
  // Une ligne d'action tout en capitales serait relue comme un personnage, et
  // une ligne qui commence comme une tête de scène comme une tête de scène. Le
  // point d'exclamation en tête force l'action et ne s'affiche pas.
  if (isAllCaps(clean) || isSceneHeading(clean) || /^[.>@!~]/.test(clean)) return `!${clean}`;
  return clean;
}

function parentheticalLine(text) {
  const clean = text.trim();
  return /^\(.*\)$/.test(clean) ? clean : `(${clean.replace(/^\(|\)$/g, '')})`;
}

const ATTACHED = new Set(['DIALOGUE', 'PARENTHETICAL']);
const SPEECH = new Set(['CHARACTER', 'DIALOGUE', 'PARENTHETICAL']);

function titlePageText(titlePage) {
  if (!titlePage) return '';
  const out = [];
  const add = (key, value) => { if (value) out.push(`${key}: ${String(value).split('\n').join('\n\t')}`); };

  add('Title', titlePage.title);
  add('Credit', titlePage.credit || 'Written by');
  add('Author', titlePage.author);
  add('Source', titlePage.source);
  add('Draft date', titlePage['draft date'] || titlePage.date);
  add('Contact', titlePage.contact);
  add('Copyright', titlePage.copyright);

  return out.length ? out.join('\n') + '\n\n' : '';
}

/**
 * @param {{type: string, text: string}[]} blocks
 * @param {{titlePage?: Object|null}} [options]
 * @returns {string} le contenu d'un fichier .fountain
 */
export function buildFountain(blocks, options = {}) {
  const lines = [];
  let prevType = null;

  for (const block of blocks) {
    if (!block || !block.text || !block.text.trim()) continue;

    // Une réplique reste collée à son personnage : une ligne vide entre les
    // deux couperait le dialogue en deux éléments.
    const attached = ATTACHED.has(block.type) && SPEECH.has(prevType);
    if (prevType !== null && !attached) lines.push('');

    switch (block.type) {
      case 'SCENE_HEADING': lines.push(sceneHeadingLine(block.text)); break;
      case 'TRANSITION': lines.push(transitionLine(block.text)); break;
      case 'CHARACTER': lines.push(characterLine(block.text)); break;
      case 'PARENTHETICAL': lines.push(parentheticalLine(block.text)); break;
      case 'DIALOGUE': lines.push(escapeEmphasis(block.text.trim())); break;
      default: lines.push(actionLine(block.text));
    }

    prevType = block.type;
  }

  return titlePageText(options.titlePage) + lines.join('\n') + '\n';
}
