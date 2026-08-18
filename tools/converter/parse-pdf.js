// parse-pdf.js — un scénario en PDF vers blocs typés.
//
// C'est le cas difficile : un PDF ne dit pas "ceci est un dialogue", il dit
// "ce texte commence à 2,9 pouces du bord". Or le format scénario est
// justement une géométrie, donc l'information est là, il faut la relire.
//
// La méthode tient en trois temps :
//   1. regrouper les fragments en lignes visuelles (avec leur abscisse) ;
//   2. calibrer les colonnes sur le document lui-même plutôt que sur des
//      valeurs figées, parce que Final Draft, Celtx et Fade In ne posent pas
//      leurs marges au même endroit ;
//   3. recoller les lignes en paragraphes, un dialogue occupant trois lignes
//      à l'écran mais un seul bloc dans le document.
//
// extractLines a besoin de pdf.js ; linesToBlocks est pure et se teste dans Node.

import {
  calculateScores,
  getTypeFromScores,
  isSceneHeading,
  isTransitionLoose,
  isAllCaps,
  cleanText
} from './screenplay.js';
import { converterError } from './messages.js';

/**
 * Certains exports écrivent deux fois la même couche de texte : la ligne
 * ressort en double, collée à elle-même. On le voit dans The Teachers' Lounge
 * sur les rappels de personnage. Recoller sans le détecter doublerait tout le
 * scénario.
 */
export function collapseDoubled(text) {
  const t = text.trim();
  if (t.length < 6 || t.length % 2 !== 0) return text;
  const half = t.length / 2;
  return t.slice(0, half) === t.slice(half) ? t.slice(0, half) : text;
}

const Y_TOLERANCE = 2.5;      // fragments considérés sur la même ligne
const MARGIN_BAND = 54;       // bande haute et basse où vivent folios et mentions
const CLUSTER_TOLERANCE = 9;  // deux abscisses à moins de 9 points = même colonne

/**
 * Lit le PDF et rend des lignes visuelles ordonnées.
 *
 * @param {*} pdfjsLib le module pdf.js déjà configuré (workerSrc posé)
 * @param {ArrayBuffer} data
 * @param {(ratio: number) => void} [onProgress]
 * @returns {Promise<{page: number, y: number, x0: number, x1: number, text: string, pageHeight: number}[]>}
 */
export async function extractLines(pdfjsLib, data, onProgress) {
  const pdf = await pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
  const lines = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const buckets = [];

    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;
      const x = item.transform[4];
      const y = item.transform[5];
      const width = item.width || 0;

      let bucket = buckets.find((b) => Math.abs(b.y - y) <= Y_TOLERANCE);
      if (!bucket) {
        bucket = { y, items: [] };
        buckets.push(bucket);
      }
      bucket.items.push({ x, width, str: item.str });
    }

    buckets.sort((a, b) => b.y - a.y); // de haut en bas

    for (const bucket of buckets) {
      bucket.items.sort((a, b) => a.x - b.x);
      // Les fragments d'une même ligne sont parfois séparés par un simple
      // décalage : on rétablit l'espace quand le trou dépasse une demi-chasse.
      let text = '';
      let previousEnd = null;
      for (const item of bucket.items) {
        if (previousEnd !== null && item.x - previousEnd > 3 && !/\s$/.test(text)) text += ' ';
        text += item.str;
        previousEnd = item.x + item.width;
      }
      text = cleanText(collapseDoubled(text.replace(/\s{2,}/g, ' ')));
      if (!text) continue;

      const first = bucket.items[0];
      const last = bucket.items[bucket.items.length - 1];
      lines.push({
        page: pageNumber,
        y: bucket.y,
        x0: first.x,
        x1: last.x + last.width,
        text,
        pageHeight: viewport.height
      });
    }

    page.cleanup();
    if (onProgress) onProgress(pageNumber / pdf.numPages);
  }

  if (!lines.length) {
    throw converterError('scanned-pdf');
  }

  return lines;
}

// Folios, mentions de continuité, numéros de scène isolés : de la mise en page,
// pas du scénario. On accepte le point doublé ("12.12.") parce que pdf.js relit
// parfois le même folio deux fois sur une page révisée.
const NUMERIC_ONLY = /^\d{1,4}[A-Z]?[.)]?(\s*\d{1,4}[A-Z]?[.)]?)?$/;
const CONTINUATION = /^\(?\s*(CONTINUED|CONTINUES|MORE|SUITE|À SUIVRE)\s*\)?[.:]?$/i;

function isPageFurniture(line, geometry) {
  const t = line.text.trim();
  const nearEdge = line.y > line.pageHeight - MARGIN_BAND || line.y < MARGIN_BAND;
  if (CONTINUATION.test(t)) return true;
  if (/^page\s+\d+/i.test(t)) return true;
  // Rappel de personnage en haut de page ("CARLA (CONT'D)") : c'est un en-tête
  // de mise en page. Le même texte au milieu de la page, lui, est un vrai
  // personnage et doit rester.
  if (nearEdge && /^.{1,40}\(\s*CONT'?D\s*\)\s*$/i.test(t)) return true;
  if (!NUMERIC_ONLY.test(t)) return false;
  if (nearEdge) return true;
  // Un folio peut descendre bas dans la page quand la mise en page est serrée :
  // ce qui le trahit alors, c'est qu'il vit dans une gouttière, loin du texte.
  if (geometry && (line.x0 > geometry.base + 300 || line.x0 < geometry.base - 30)) return true;
  return false;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clusterByX(lines) {
  const clusters = [];
  for (const line of lines) {
    let cluster = clusters.find((c) => Math.abs(c.x - line.x0) <= CLUSTER_TOLERANCE);
    if (!cluster) {
      cluster = { x: line.x0, lines: [] };
      clusters.push(cluster);
    }
    cluster.lines.push(line);
    cluster.x = median(cluster.lines.map((l) => l.x0));
  }
  return clusters;
}

const ratio = (cluster, predicate) =>
  cluster.lines.filter((l) => predicate(l.text.trim())).length / cluster.lines.length;

/**
 * Repère les colonnes réellement utilisées par ce document.
 *
 * Première version fondée sur des écarts en points repris de Final Draft :
 * fausse. Un vrai scénario (The Teachers' Lounge, export allemand) place son
 * dialogue à 72 points de l'action, sa parenthèse à 101 et son personnage à
 * 144, là où Final Draft dit 101, 151 et 194. Les valeurs absolues ne se
 * transportent pas d'un logiciel à l'autre.
 *
 * Ce qui se transporte, en revanche : l'action est la colonne la plus à gauche,
 * la parenthèse est celle où l'on ouvre une parenthèse, le personnage est en
 * capitales. On reconnaît donc les colonnes à leur CONTENU, et la géométrie ne
 * sert plus qu'à les séparer. Prendre la colonne la plus peuplée pour l'action
 * était faux aussi : dans ce scénario le dialogue compte 1646 lignes contre 783.
 */
export function calibrateColumns(lines) {
  const rightEdge = Math.max(...lines.map((l) => l.x1));
  const clusters = clusterByX(lines);
  const floor = Math.max(3, lines.length * 0.005);
  const significant = clusters.filter((c) => c.lines.length >= floor).sort((a, b) => a.x - b.x);
  if (significant.length < 2) return null;

  // La colonne la plus à gauche n'est pas toujours l'action : quand les scènes
  // sont numérotées, une gouttière porte "12 INT. CUISINE - JOUR 12". Elle ne
  // contient que des en-têtes, c'est à ça qu'on la reconnaît.
  // Le numéro fait partie de la ligne ("3 INT. SALLE - JOUR 3"), il faut donc
  // le retirer avant de demander si c'est un en-tête de scène : sans ça la
  // gouttière passe inaperçue et toutes les colonnes glissent d'un cran.
  let baseIndex = 0;
  while (
    baseIndex < significant.length - 1 &&
    ratio(significant[baseIndex], (t) => isSceneHeading(stripSceneNumber(t))) > 0.6
  ) baseIndex++;

  const base = significant[baseIndex].x;
  const sceneGutter = baseIndex > 0 ? significant[0].x : null;

  const candidates = significant.slice(baseIndex + 1).filter((c) => {
    const offset = c.x - base;
    return offset >= 30 && offset <= 300 && ratio(c, (t) => NUMERIC_ONLY.test(t)) < 0.6;
  });

  const columns = { base, sceneGutter, rightEdge, dialogue: null, parenthetical: null, character: null };

  if (candidates.length) {
    const scored = candidates.map((cluster) => ({
      cluster,
      caps: ratio(cluster, isAllCaps),
      paren: ratio(cluster, (t) => t.startsWith('('))
    }));

    let pool = scored;
    const parenthetical = pool.filter((s) => s.paren > 0.5).sort((a, b) => b.paren - a.paren)[0];
    if (parenthetical) pool = pool.filter((s) => s !== parenthetical);

    const character =
      pool.filter((s) => s.caps > 0.6).sort((a, b) => b.caps - a.caps)[0] ||
      (pool.length > 1 ? pool.slice().sort((a, b) => b.cluster.x - a.cluster.x)[0] : null);
    if (character) pool = pool.filter((s) => s !== character);

    const dialogue = pool.sort((a, b) => b.cluster.lines.length - a.cluster.lines.length)[0];

    if (parenthetical) columns.parenthetical = parenthetical.cluster.x;
    if (character) columns.character = character.cluster.x;
    if (dialogue) columns.dialogue = dialogue.cluster.x;
  }

  const covered = candidates.reduce((sum, c) => sum + c.lines.length, 0);
  columns.confident =
    columns.character !== null && columns.dialogue !== null && covered >= lines.length * 0.08;

  return columns;
}

// Un PDF imprime le numéro de scène de part et d'autre de l'en-tête. C'est de
// la mise en page : le document Google n'en veut pas.
export function stripSceneNumber(text) {
  return text
    .replace(/^\d{1,4}[A-Z]?[.)]?\s+/, '')
    .replace(/\s+\d{1,4}[A-Z]?[.)]?$/, '')
    .trim();
}

const BY_LINE = /^(written by|screenplay by|story by|a screenplay by|by|écrit par|un scénario de|scénario de|de)$/i;

/**
 * Une première page sans en-tête de scène, avec une poignée de lignes centrées,
 * est une page de titre. Il faut la sortir du corps : laissée dedans, elle
 * tombe dans les colonnes de dialogue et le titre du film devient une réplique.
 *
 * @returns {{titlePage: Object|null, body: Array}}
 */
export function extractTitlePage(lines) {
  const firstPage = lines.filter((l) => l.page === 1);
  if (!firstPage.length || firstPage.length > 20) return { titlePage: null, body: lines };
  if (lines.every((l) => l.page === 1)) return { titlePage: null, body: lines };
  if (firstPage.some((l) => isSceneHeading(stripSceneNumber(l.text)))) {
    return { titlePage: null, body: lines };
  }

  const texts = firstPage.map((l) => l.text.trim()).filter(Boolean);
  if (!texts.length) return { titlePage: null, body: lines };

  const meta = { title: texts[0], lines: texts };
  const byIndex = texts.findIndex((t) => BY_LINE.test(t));
  if (byIndex !== -1 && texts[byIndex + 1]) meta.author = texts[byIndex + 1];
  else if (texts.length > 1) meta.author = texts[1];

  const contact = texts.find((t) => /@|\+\d|\(\d{3}\)/.test(t));
  if (contact) meta.contact = contact;

  return { titlePage: meta, body: lines.filter((l) => l.page !== 1) };
}

function typeFromColumn(line, columns) {
  const offset = line.x0 - columns.base;

  if (columns.sceneGutter !== null && Math.abs(line.x0 - columns.sceneGutter) <= CLUSTER_TOLERANCE) {
    return 'SCENE_HEADING';
  }
  if (isSceneHeading(stripSceneNumber(line.text))) return 'SCENE_HEADING';
  if (isTransitionLoose(line.text)) return 'TRANSITION';

  const candidates = [
    ['DIALOGUE', columns.dialogue],
    ['PARENTHETICAL', columns.parenthetical],
    ['CHARACTER', columns.character]
  ].filter(([, x]) => x !== null);

  const onAColumn = candidates.some(([, x]) => Math.abs(line.x0 - x) <= CLUSTER_TOLERANCE);

  // Une transition se reconnaît à sa géométrie : elle touche la marge de
  // droite. Mais un nom de personnage part lui aussi de la droite, alors on ne
  // lit le calage à droite que pour une ligne qui ne tombe sur aucune colonne
  // connue. Sinon « CLAIRE » deviendrait une transition.
  const flushRight = columns.rightEdge - line.x1 < 24 && offset > 24;
  if (flushRight && !onAColumn && isAllCaps(line.text) && line.text.length < 40) return 'TRANSITION';

  if (offset < 24) return 'ACTION';
  if (!candidates.length) return 'ACTION';

  let best = candidates[0];
  let bestDistance = Math.abs(line.x0 - best[1]);
  for (const candidate of candidates.slice(1)) {
    const distance = Math.abs(line.x0 - candidate[1]);
    if (distance < bestDistance) { best = candidate; bestDistance = distance; }
  }

  let type = best[0];

  // La colonne dit d'où part la ligne, le texte dit ce qu'elle est. Quand les
  // deux se contredisent sur un cas net, le texte gagne.
  if (type === 'CHARACTER' && !isAllCaps(line.text)) type = 'DIALOGUE';
  if (/^\(.*\)$/.test(line.text.trim())) type = 'PARENTHETICAL';

  return type;
}

/**
 * Lignes visuelles vers blocs typés.
 *
 * @param {{page:number,y:number,x0:number,x1:number,text:string,pageHeight:number}[]} rawLines
 * @returns {{blocks: {type: string, text: string}[], titlePage: Object|null, warnings: string[], confident: boolean}}
 */
export function linesToBlocks(rawLines) {
  const warnings = [];

  // Deux passes : la première sert seulement à savoir où tombe la colonne
  // d'action, la seconde en profite pour reconnaître les folios qui se cachent
  // dans les gouttières, loin du bord de page.
  const roughGeometry = calibrateColumns(rawLines.filter((l) => !isPageFurniture(l, null)));
  const cleaned = rawLines.filter((l) => !isPageFurniture(l, roughGeometry));
  const dropped = rawLines.length - cleaned.length;
  const { titlePage, body: lines } = extractTitlePage(cleaned);

  if (!lines.length) throw converterError('empty-pdf');

  const columns = calibrateColumns(lines);

  // Sans colonnes exploitables, le PDF n'a pas été mis en page comme un
  // scénario : on ne fait pas semblant, on relit le texte au barème.
  if (!columns || !columns.confident) {
    warnings.push({ code: 'no-columns' });
    const blocks = mergeAndClassifyFlat(lines);
    return { blocks, titlePage, warnings, confident: false };
  }

  const typed = lines.map((line) => ({
    ...line,
    type: typeFromColumn(line, columns),
    text: line.text
  }));

  // Écart vertical typique entre deux lignes d'un même paragraphe : on le
  // mesure sur le document au lieu de le supposer.
  const gaps = [];
  for (let i = 1; i < typed.length; i++) {
    if (typed[i].page !== typed[i - 1].page) continue;
    const gap = typed[i - 1].y - typed[i].y;
    if (gap > 0 && gap < 60) gaps.push(gap);
  }
  const lineHeight = median(gaps) || 12;
  const paragraphGap = lineHeight * 1.6;

  const blocks = [];
  for (let i = 0; i < typed.length; i++) {
    const line = typed[i];
    const previous = blocks.length ? blocks[blocks.length - 1] : null;
    const previousLine = i > 0 ? typed[i - 1] : null;

    const continues =
      previous &&
      previousLine &&
      previous.type === line.type &&
      previousLine.page === line.page &&
      previousLine.y - line.y <= paragraphGap &&
      line.type !== 'SCENE_HEADING' &&
      line.type !== 'CHARACTER';

    // Un dialogue coupé par un saut de page se poursuit sous un "PERSONNAGE
    // (CONT'D)" : on recolle et on retire la reprise.
    const isContinuation =
      previous &&
      previousLine &&
      line.type === 'CHARACTER' &&
      /\(\s*CONT'?D\s*\)\s*$/i.test(line.text) &&
      previousLine.page !== line.page;

    if (isContinuation) {
      const bare = line.text.replace(/\s*\(\s*CONT'?D\s*\)\s*$/i, '').trim();
      const previousCharacter = [...blocks].reverse().find((b) => b.type === 'CHARACTER');
      if (previousCharacter && previousCharacter.text.replace(/\s*\([^)]*\)\s*$/, '').trim() === bare) {
        continue;
      }
    }

    if (continues) {
      previous.text = `${previous.text} ${line.text}`.replace(/\s{2,}/g, ' ');
    } else {
      let text = line.text;
      if (line.type === 'SCENE_HEADING') text = stripSceneNumber(text);
      if (line.type === 'TRANSITION') text = text.toUpperCase();
      blocks.push({ type: line.type, text });
    }
  }

  // Un nom de personnage qui n'est suivi d'aucune réplique n'est pas un
  // personnage : c'est un carton centré ("SEPTEMBRE 2012", "TROIS MOIS PLUS
  // TARD") qui tombe dans la même colonne. Vu sur La Petite Inspectrice.
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type !== 'CHARACTER') continue;
    const next = blocks[i + 1];
    if (!next || (next.type !== 'DIALOGUE' && next.type !== 'PARENTHETICAL')) {
      blocks[i].type = 'ACTION';
    }
  }

  if (dropped) warnings.push({ code: 'page-furniture', count: dropped });

  return { blocks, titlePage, warnings, confident: true };
}

// Repli quand la géométrie ne dit rien : on recolle les lignes en paragraphes
// sur les seuls sauts verticaux, puis on classe au barème de l'add-on.
function mergeAndClassifyFlat(lines) {
  const paragraphs = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const previousLine = i > 0 ? lines[i - 1] : null;
    const samePage = previousLine && previousLine.page === line.page;
    const gap = samePage ? previousLine.y - line.y : Infinity;
    if (paragraphs.length && samePage && gap < 18 && Math.abs(line.x0 - lines[i - 1].x0) < 6) {
      paragraphs[paragraphs.length - 1] += ` ${line.text}`;
    } else {
      paragraphs.push(line.text);
    }
  }

  const blocks = [];
  let prevType = null;
  for (let i = 0; i < paragraphs.length; i++) {
    const text = cleanText(paragraphs[i]);
    if (!text) { prevType = null; continue; }
    const type = getTypeFromScores(calculateScores(text, prevType, paragraphs[i + 1] || ''));
    blocks.push({ type, text: type === 'TRANSITION' ? text.toUpperCase() : text });
    prevType = type;
  }
  return blocks;
}
