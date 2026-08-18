// digest.js — le résumé compact d'un scénario, pour les deux seuls outils qui
// parlent à un serveur.
//
// Le site promet partout que le scénario ne quitte pas la machine. L'affiche
// et la logline ont besoin d'un modèle, donc il faut bien envoyer quelque
// chose. On envoie le moins possible, et les pages montrent exactement quoi :
// le titre, les personnages principaux, les décors, et des répliques prises au
// début, au milieu et à la fin, jamais le scénario entier.

import { characters, scenes, runtime } from './analysis.js';

const SAMPLE_BLOCKS = 30;

/** Des répliques prises aux trois quarts du film, pas seulement à l'ouverture. */
function sampleDialogue(blocks) {
  const spoken = [];
  let current = null;

  for (const block of blocks) {
    if (block.type === 'CHARACTER') current = block.text;
    else if (block.type === 'DIALOGUE' && current) spoken.push(`${current}: ${block.text}`);
  }
  if (spoken.length <= SAMPLE_BLOCKS) return spoken;

  // Une seule fenêtre au début ferait juger tout le film sur sa première scène.
  const third = Math.floor(SAMPLE_BLOCKS / 3);
  const middle = Math.floor(spoken.length / 2);
  return [
    ...spoken.slice(0, third),
    ...spoken.slice(middle, middle + third),
    ...spoken.slice(-third)
  ];
}

/**
 * @param {Array} blocks
 * @param {{title?: string}} [options]
 * @returns {{title: string, characters: Array, locations: Array, sampleDialogue: string, pageCount: number, lines: string[]}}
 */
export function buildDigest(blocks, { title = '' } = {}) {
  const cast = characters(blocks).slice(0, 5);
  const sceneList = scenes(blocks).filter((s) => s.heading);
  const timing = runtime(blocks);

  const byLocation = new Map();
  for (const scene of sceneList) {
    if (!scene.location) continue;
    byLocation.set(scene.location, (byLocation.get(scene.location) || 0) + 1);
  }
  const locations = [...byLocation.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({
      name,
      scenes: count,
      share: Math.round((count / Math.max(1, sceneList.length)) * 100)
    }));

  const lines = sampleDialogue(blocks);

  return {
    title,
    characters: cast.map((c) => ({ name: c.name, lineCount: c.cues })),
    locations,
    sampleDialogue: lines.join('\n').slice(0, 4000),
    pageCount: Math.round(timing.pages),
    lines
  };
}

/** La même chose en texte, pour le prompt de la logline. */
export function digestToText(digest) {
  const parts = [];
  if (digest.title) parts.push(`Title: ${digest.title}`);
  parts.push(`Length: about ${digest.pageCount} pages.`);
  if (digest.characters.length) {
    parts.push('Main characters, by how much they speak:\n' +
      digest.characters.map((c) => `  - ${c.name} (${c.lineCount} speeches)`).join('\n'));
  }
  if (digest.locations.length) {
    parts.push('Where it mostly happens:\n' +
      digest.locations.map((l) => `  - ${l.name} (${l.scenes} scenes, ${l.share}% of the script)`).join('\n'));
  }
  if (digest.sampleDialogue) {
    parts.push('Dialogue from the beginning, the middle and the end:\n' + digest.sampleDialogue);
  }
  return parts.join('\n\n');
}

/** Ce qui part vraiment, en une phrase, pour l'afficher au visiteur. */
export function digestSummary(digest) {
  return `${digest.characters.length} character names, ${digest.locations.length} locations, ` +
    `${digest.lines.length} lines of dialogue and your page count. Nothing else.`;
}
