// analysis.js — ce qu'on peut dire d'un scénario une fois qu'il est en blocs.
//
// Minutage, personnages, dépouillement, défauts de format : quatre outils
// différents, une seule lecture. Rien ici ne touche au DOM ni au réseau, donc
// tout se teste dans Node.

import { INDENTS, PAGE, shouldInsertSpaceBefore, characterName } from './screenplay.js';

// Courier 12 tient 10 caractères au pouce et 6 lignes au pouce. C'est ce qui
// fait qu'une page de scénario est une unité de temps et pas une unité de
// texte, et c'est de là que sortent tous les calculs qui suivent.
const CHARS_PER_INCH = 10;
const LINES_PER_INCH = 6;

/** Largeur utile d'un type de bloc, en caractères. */
export function charsPerLine(type, pageFormat = 'US') {
  const page = PAGE[pageFormat];
  const indents = INDENTS[pageFormat];
  const bodyInches = (page.width - page.marginLeft - page.marginRight) / 72;
  const indent = indents[type] || indents.ACTION;
  const inches = bodyInches - indent.left / 72 - indent.right / 72;
  return Math.max(8, Math.round(inches * CHARS_PER_INCH));
}

export function linesForBlock(block, pageFormat = 'US') {
  const width = charsPerLine(block.type, pageFormat);
  const text = block.text || '';
  if (!text) return 1;

  // On plie le texte comme le ferait la page, mot à mot : diviser la longueur
  // par la largeur sous-estime toujours, parce qu'un mot ne se coupe pas.
  let lines = 1;
  let used = 0;
  for (const word of text.split(/\s+/)) {
    const cost = used === 0 ? word.length : word.length + 1;
    if (used + cost > width && used > 0) { lines++; used = word.length; }
    else used += cost;
  }
  return lines;
}

export function linesPerPage(pageFormat = 'US') {
  const page = PAGE[pageFormat];
  return Math.floor(((page.height - page.marginTop - page.marginBottom) / 72) * LINES_PER_INCH);
}

/**
 * Nombre de pages estimé, quand la source ne le dit pas (un .fdx et un
 * Fountain n'ont pas de pages, seulement du texte).
 */
export function estimatePages(blocks, pageFormat = 'US') {
  let lines = 0;
  let lastType = null;
  let lastText = null;

  for (const block of blocks) {
    // Il faut appliquer la VRAIE règle de ligne vide, celle de l'add-on.
    // Compter un blanc entre chaque paire de blocs gonflait l'estimation de
    // 27 % (113 pages annoncées pour un scénario de 89, mesuré sur The
    // Teachers' Lounge) : il n'y a pas de ligne vide entre un personnage et
    // sa réplique, et c'est la paire la plus fréquente du document.
    if (shouldInsertSpaceBefore(lastType, lastText, block.type, block.text)) lines += 1;
    lines += linesForBlock(block, pageFormat);
    lastType = block.type;
    lastText = block.text;
  }

  return Math.max(1, Math.round((lines / linesPerPage(pageFormat)) * 10) / 10);
}

// ============================================
// MINUTAGE
// ============================================

// Une page vaut 55 secondes, pas 60 : sur des milliers de films, le rapport
// moyen entre pages de scénario et minutes à l'écran est de 1,1 (analyse de
// Stephen Follows). La règle « une page, une minute » surestime donc de 9 %.
export const SECONDS_PER_PAGE = 55;
// Débit de parole à l'écran. Vérifié sur The Teachers' Lounge : 7 466 mots de
// dialogue pour un film de 98 minutes, soit environ 50 minutes de parole.
export const DIALOGUE_WPM = 150;
// Marge honnête. La règle de la page est juste à 5 % près sur un scénario
// équilibré, et dérive de 15 à 20 % dès qu'un scénario penche franchement vers
// le dialogue ou vers l'action. On annonce donc une fourchette, pas un chiffre.
export const SPREAD = 0.15;

/**
 * Combien de temps ce scénario dure-t-il à l'écran.
 *
 * Version précédente : deux estimations concurrentes, l'une par la page,
 * l'autre par le contenu. Abandonnée après vérification sur un vrai film. Une
 * seconde par ligne d'action ne se transporte pas d'un scénario à l'autre :
 * dans un film bavard, les lignes d'action portent aussi tous les silences que
 * le texte n'écrit pas, et le même coefficient donne n'importe quoi ailleurs.
 * On rend donc UN chiffre avec sa fourchette, et le contenu sert de
 * diagnostic : combien de ce temps est de la parole.
 */
export function runtime(blocks, { pageFormat = 'US', pages = null } = {}) {
  let dialogueWords = 0;
  let actionLines = 0;
  let spokenLines = 0;
  let cueLines = 0;

  for (const block of blocks) {
    const lines = linesForBlock(block, pageFormat);
    if (block.type === 'DIALOGUE') {
      dialogueWords += (block.text.match(/\S+/g) || []).length;
      spokenLines += lines;
    } else if (block.type === 'CHARACTER' || block.type === 'PARENTHETICAL') {
      cueLines += lines;
    } else {
      actionLines += lines;
    }
  }

  const countedPages = pages || estimatePages(blocks, pageFormat);
  const estimated = countedPages * SECONDS_PER_PAGE;
  const spokenSeconds = (dialogueWords / DIALOGUE_WPM) * 60;
  const bodyLines = spokenLines + cueLines + actionLines;

  return {
    pages: countedPages,
    pagesAreMeasured: Boolean(pages),
    seconds: Math.round(estimated),
    lowSeconds: Math.round(estimated * (1 - SPREAD)),
    highSeconds: Math.round(estimated * (1 + SPREAD)),
    spokenSeconds: Math.round(spokenSeconds),
    spokenShareOfRuntime: estimated > 0 ? Math.min(1, spokenSeconds / estimated) : 0,
    dialogueWords,
    spokenLines,
    actionLines,
    // Part de la page occupée par du dialogue, cues et parenthèses comprises :
    // c'est ce que l'œil voit en feuilletant, et c'est ce qui fait dire à un
    // lecteur « c'est très bavard » avant d'avoir lu une ligne.
    spokenShare: bodyLines > 0 ? (spokenLines + cueLines) / bodyLines : 0
  };
}

export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h} h ${String(m).padStart(2, '0')}`;
  return `${m} min ${String(s).padStart(2, '0')}`;
}

// ============================================
// SCÈNES ET PERSONNAGES
// ============================================

const TIME_WORDS = /\b(DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|CONTINUOUS|LATER|SAME|MOMENTS LATER|JOUR|NUIT|MATIN|SOIR|AUBE|CRÉPUSCULE|PLUS TARD|CONTINU)\b/i;

/** Découpe un en-tête de scène en ses trois informations utiles. */
export function readHeading(text) {
  const clean = (text || '').trim();
  const intExt = /^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E)/i.test(clean)
    ? 'INT/EXT'
    : /^EXT/i.test(clean) ? 'EXT'
    : /^INT/i.test(clean) ? 'INT'
    : '';

  // Le décor vit entre le premier séparateur et le dernier : "INT. CUISINE - JOUR".
  const withoutPrefix = clean.replace(/^(INT\.?\/EXT\.?|EXT\.?\/INT\.?|I\/E|INT\.?|EXT\.?|INTÉRIEUR|EXTÉRIEUR)\s*/i, '');
  const parts = withoutPrefix.split(/\s+[-–—]\s+/);
  const timeMatch = clean.match(TIME_WORDS);

  return {
    intExt,
    location: (parts[0] || withoutPrefix).trim(),
    time: timeMatch ? timeMatch[0].toUpperCase() : ''
  };
}

/**
 * Découpe le scénario en scènes, avec qui y parle et ce qu'elle pèse.
 * C'est la base du dépouillement et du rapport de personnages.
 */
export function scenes(blocks, pageFormat = 'US') {
  const out = [];
  let current = null;
  let lastCharacter = null;
  const perPage = linesPerPage(pageFormat);

  const push = () => { if (current) out.push(current); };

  for (const block of blocks) {
    if (block.type === 'SCENE_HEADING') {
      push();
      const parsed = readHeading(block.text);
      current = {
        number: out.length + 1,
        heading: block.text,
        ...parsed,
        characters: [],
        lines: 0,
        dialogueWords: 0
      };
      lastCharacter = null;
      continue;
    }

    if (!current) {
      // Du texte avant la première scène : on lui ouvre une scène sans titre
      // plutôt que de le perdre.
      current = { number: 1, heading: '', intExt: '', location: '', time: '', characters: [], lines: 0, dialogueWords: 0 };
    }

    current.lines += linesForBlock(block, pageFormat);

    if (block.type === 'CHARACTER') {
      lastCharacter = characterName(block.text);
      if (lastCharacter && !current.characters.includes(lastCharacter)) current.characters.push(lastCharacter);
    } else if (block.type === 'DIALOGUE') {
      current.dialogueWords += (block.text.match(/\S+/g) || []).length;
    }
  }
  push();

  let cumulative = 0;
  for (const scene of out) {
    scene.startPage = Math.round((cumulative / perPage) * 10) / 10 + 1;
    cumulative += scene.lines;
    // Un huitième de page est la plus petite unité qu'une production compte :
    // une scène affichée à 0 page n'existe pas, elle est juste très courte.
    scene.pages = Math.max(0.1, Math.round((scene.lines / perPage) * 10) / 10);
  }

  return out;
}

/** Qui parle, combien, et où. */
export function characters(blocks, pageFormat = 'US') {
  const sceneList = scenes(blocks, pageFormat);
  const byName = new Map();

  let sceneIndex = 0;
  let lastCharacter = null;

  for (const block of blocks) {
    if (block.type === 'SCENE_HEADING') { sceneIndex++; lastCharacter = null; continue; }

    if (block.type === 'CHARACTER') {
      const name = characterName(block.text);
      if (!name) continue;
      lastCharacter = name;
      if (!byName.has(name)) {
        byName.set(name, { name, cues: 0, words: 0, scenes: new Set(), firstScene: sceneIndex || 1, lastScene: sceneIndex || 1 });
      }
      const entry = byName.get(name);
      entry.cues++;
      entry.scenes.add(sceneIndex || 1);
      entry.lastScene = sceneIndex || 1;
    } else if (block.type === 'DIALOGUE' && lastCharacter) {
      const entry = byName.get(lastCharacter);
      if (entry) entry.words += (block.text.match(/\S+/g) || []).length;
    }
  }

  const totalWords = [...byName.values()].reduce((sum, c) => sum + c.words, 0) || 1;

  return [...byName.values()]
    .map((c) => ({
      name: c.name,
      cues: c.cues,
      words: c.words,
      scenes: c.scenes.size,
      firstScene: c.firstScene,
      lastScene: c.lastScene,
      share: c.words / totalWords,
      totalScenes: sceneList.length
    }))
    .sort((a, b) => b.words - a.words || a.name.localeCompare(b.name));
}

// ============================================
// DÉFAUTS DE FORMAT
// ============================================

const LEVELS = { stop: 'stop', look: 'look' };

// Deux noms qui ne diffèrent que par la ponctuation ou un accent sont le même
// personnage écrit de deux façons. C'est le défaut le plus fréquent et le plus
// gênant : il casse les rapports de production.
const nameKey = (name) =>
  name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();

export function checkFormat(blocks, { pageFormat = 'US', pages = null, geometry = null } = {}) {
  const findings = [];
  const sceneList = scenes(blocks, pageFormat);
  const timing = runtime(blocks, { pageFormat, pages });
  const add = (level, title, detail, where) => findings.push({ level, title, detail, where });

  // --- la géométrie, quand on l'a lue dans un PDF ---
  if (geometry) {
    if (geometry.size && (geometry.size < 11.4 || geometry.size > 12.6)) {
      add(LEVELS.stop, 'The type is not 12 point',
        `Your pages are set at about ${geometry.size.toFixed(1)} point. Screenplay format is Courier 12, and a reader notices the difference before reading a word, because it changes how many pages your story appears to be.`,
        'measured across the whole document');
    }
    if (geometry.leftMarginInches && Math.abs(geometry.leftMarginInches - 1.5) > 0.2) {
      add(LEVELS.stop, 'The left margin is not an inch and a half',
        `Your text starts ${geometry.leftMarginInches.toFixed(2)} inch from the edge. The standard is 1.5, and the extra room is there for the brads and for the reader's thumb.`,
        'measured across the whole document');
    }
  }

  // --- les en-têtes de scène ---
  const headingsWithoutTime = sceneList.filter((s) => s.heading && !s.time);
  if (headingsWithoutTime.length) {
    add(LEVELS.look, `${headingsWithoutTime.length} scene heading${headingsWithoutTime.length > 1 ? 's' : ''} without a time of day`,
      'A heading tells the reader where and when. Without DAY or NIGHT, the first assistant director cannot schedule the scene and the reader cannot picture it.',
      headingsWithoutTime.slice(0, 3).map((s) => `scene ${s.number}: ${s.heading}`).join(' · '));
  }

  const headingsWithoutIntExt = sceneList.filter((s) => s.heading && !s.intExt);
  if (headingsWithoutIntExt.length) {
    add(LEVELS.stop, `${headingsWithoutIntExt.length} scene heading${headingsWithoutIntExt.length > 1 ? 's' : ''} without INT or EXT`,
      'Every scene happens inside or outside. Without that word the heading is a title, not a slug line.',
      headingsWithoutIntExt.slice(0, 3).map((s) => `scene ${s.number}: ${s.heading}`).join(' · '));
  }

  // --- les personnages écrits de deux façons ---
  const seen = new Map();
  for (const character of characters(blocks, pageFormat)) {
    const key = nameKey(character.name);
    if (!key) continue;
    if (!seen.has(key)) seen.set(key, []);
    seen.get(key).push(character.name);
  }
  const doubles = [...seen.values()].filter((names) => names.length > 1);
  if (doubles.length) {
    add(LEVELS.stop, `${doubles.length} character${doubles.length > 1 ? 's are' : ' is'} spelled more than one way`,
      'The same person written two ways becomes two people in every report a production runs off your script.',
      doubles.slice(0, 3).map((names) => names.join(' / ')).join(' · '));
  }

  // --- les pavés ---
  const longAction = blocks.filter((b) => b.type === 'ACTION' && linesForBlock(b, pageFormat) > 5);
  if (longAction.length) {
    add(LEVELS.look, `${longAction.length} action paragraph${longAction.length > 1 ? 's run' : ' runs'} past five lines`,
      'Long blocks of description are the first thing a reader skims, and what gets skimmed does not get read. Four lines is the usual ceiling.',
      longAction.slice(0, 2).map((b) => `"${b.text.slice(0, 58)}…"`).join(' · '));
  }

  const longSpeeches = blocks.filter((b) => b.type === 'DIALOGUE' && linesForBlock(b, pageFormat) > 8);
  if (longSpeeches.length) {
    add(LEVELS.look, `${longSpeeches.length} speech${longSpeeches.length > 1 ? 'es run' : ' runs'} past eight lines`,
      'A speech that fills a third of the page reads as a monologue whether you meant it or not. Break it with an action beat, or cut it.',
      longSpeeches.slice(0, 2).map((b) => `"${b.text.slice(0, 58)}…"`).join(' · '));
  }

  // --- les parenthèses qui font de la mise en scène ---
  const fatParentheticals = blocks.filter(
    (b) => b.type === 'PARENTHETICAL' && (b.text.match(/\S+/g) || []).length > 5
  );
  if (fatParentheticals.length) {
    add(LEVELS.look, `${fatParentheticals.length} parenthetical${fatParentheticals.length > 1 ? 's are' : ' is'} longer than five words`,
      'A parenthetical is a hint about how a line is said, not a stage direction. Past a few words it belongs in an action line, or nowhere.',
      fatParentheticals.slice(0, 3).map((b) => b.text).join(' · '));
  }

  // --- la longueur du scénario ---
  const pageCount = Math.round(timing.pages);
  if (pageCount > 130) {
    add(LEVELS.stop, `The script runs ${pageCount} pages`,
      'Past 120 pages a spec screenplay gets read with a pencil in hand. Anything over 130 is usually turned down before page one.',
      'whole document');
  } else if (pageCount < 80 && pageCount > 45) {
    add(LEVELS.look, `The script runs ${pageCount} pages`,
      'That is short for a feature and long for a short. If it is a feature, a reader will wonder what is missing.',
      'whole document');
  }

  // --- l'équilibre ---
  if (timing.spokenShare > 0.72) {
    add(LEVELS.look, 'The script is almost all dialogue',
      `About ${Math.round(timing.spokenShare * 100)} percent of your lines are spoken. That reads as a play on the page, and it usually means the images are doing none of the work.`,
      'whole document');
  } else if (timing.spokenShare < 0.2 && blocks.length > 40) {
    add(LEVELS.look, 'The script is almost all description',
      `Only ${Math.round(timing.spokenShare * 100)} percent of your lines are spoken. A reader will feel the silence, and if it is deliberate, say so in the first page.`,
      'whole document');
  }

  // --- des scènes qui ne sont que du dialogue ---
  const emptyScenes = sceneList.filter((s) => s.heading && s.lines <= 2);
  if (emptyScenes.length > 2) {
    add(LEVELS.look, `${emptyScenes.length} scenes hold almost nothing`,
      'A heading followed by one line is usually a leftover from an outline. Either the scene is missing, or the heading is.',
      emptyScenes.slice(0, 3).map((s) => `scene ${s.number}: ${s.heading}`).join(' · '));
  }

  const order = { stop: 0, look: 1 };
  findings.sort((a, b) => order[a.level] - order[b.level]);

  return { findings, timing, sceneCount: sceneList.length };
}
