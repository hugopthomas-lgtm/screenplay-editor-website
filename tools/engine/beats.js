// beats.js — la structure en quinze temps, ramenée à ton nombre de pages.
//
// Les repères de Blake Snyder sont donnés pour un scénario de 110 pages. On
// les garde en pourcentage pour qu'ils suivent la longueur réelle du projet :
// un pilote de 32 pages et un long de 120 n'ont pas leur milieu au même
// endroit, et c'est bien le seul intérêt de faire calculer ça par une machine.

export const REFERENCE_PAGES = 110;

export const BEATS = [
  { name: 'Opening Image', at: 1, kind: 'point',
    note: 'The first picture of the film, and the before shot of your hero.' },
  { name: 'Theme Stated', at: 5, kind: 'point',
    note: 'Somebody, usually not the hero, says what the film is about. The hero does not listen yet.' },
  { name: 'Setup', at: 1, to: 10, kind: 'span',
    note: 'The world as it is, and everything that will have to change in it.' },
  { name: 'Catalyst', at: 12, kind: 'point',
    note: 'The thing that happens to the hero. Not a decision, an event.' },
  { name: 'Debate', at: 12, to: 25, kind: 'span',
    note: 'The hero resists. This is where a script dies if the resistance is not interesting.' },
  { name: 'Break into Two', at: 25, kind: 'point',
    note: 'The hero chooses, and enters the new world. Nothing before this page is the story.' },
  { name: 'B Story', at: 30, kind: 'point',
    note: 'The relationship that carries the theme, usually a new character.' },
  { name: 'Fun and Games', at: 30, to: 55, kind: 'span',
    note: 'The promise of the premise. The pages people bought a ticket for.' },
  { name: 'Midpoint', at: 55, kind: 'point',
    note: 'A false victory or a false defeat, and the stakes turn real.' },
  { name: 'Bad Guys Close In', at: 55, to: 75, kind: 'span',
    note: 'Pressure from outside, cracks from inside.' },
  { name: 'All Is Lost', at: 75, kind: 'point',
    note: 'The lowest point, and something dies here, even if only an idea.' },
  { name: 'Dark Night of the Soul', at: 75, to: 85, kind: 'span',
    note: 'The hero sits in it. Do not rush this, it is what makes the last act land.' },
  { name: 'Break into Three', at: 85, kind: 'point',
    note: 'The answer, found by putting the A story and the B story together.' },
  { name: 'Finale', at: 85, to: 110, kind: 'span',
    note: 'The hero acts on what they learned, and the world changes with them.' },
  { name: 'Final Image', at: 110, kind: 'point',
    note: 'The opposite of the opening image. The after shot.' }
];

/**
 * @param {number} pages longueur visée du scénario
 * @returns {{name: string, note: string, kind: string, page: number, endPage: number|null}[]}
 */
export function beatsForLength(pages) {
  const total = Math.max(1, Math.round(pages));
  const scale = (reference) => Math.max(1, Math.min(total, Math.round((reference / REFERENCE_PAGES) * total)));

  return BEATS.map((beat) => ({
    name: beat.name,
    note: beat.note,
    kind: beat.kind,
    page: scale(beat.at),
    endPage: beat.to ? scale(beat.to) : null
  }));
}

/** Les blocs d'un document déjà découpé, prêt à écrire dedans. */
export function beatDocumentBlocks(pages, title) {
  const blocks = [];
  if (title) {
    blocks.push({ type: 'ACTION', text: title.toUpperCase() });
    blocks.push({ type: 'ACTION', text: `Beat sheet for a ${Math.round(pages)} page screenplay.` });
  }

  for (const beat of beatsForLength(pages)) {
    const where = beat.endPage && beat.endPage !== beat.page
      ? `PAGES ${beat.page} TO ${beat.endPage}`
      : `PAGE ${beat.page}`;
    blocks.push({ type: 'ACTION', text: `${beat.name.toUpperCase()} — ${where}` });
    blocks.push({ type: 'ACTION', text: beat.note });
    // La ligne vide où l'on écrit : c'est tout l'intérêt d'un document plutôt
    // que d'un tableau de chiffres à recopier.
    blocks.push({ type: 'ACTION', text: '' });
  }

  return blocks.filter((b, i) => b.text !== '' || i !== blocks.length - 1);
}
