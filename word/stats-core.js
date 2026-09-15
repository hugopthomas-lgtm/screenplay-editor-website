// Script Stats, ported from the extension (background.js computeScriptStats),
// fed with typed paragraphs [{ type, text }] instead of a Google Doc.
const STATS_LINES_PER_PAGE = 55;
const STATS_WIDTHS = {
  SCENE_HEADING: 58,
  ACTION:        58,
  CHARACTER:     33,
  PARENTHETICAL: 20,
  DIALOGUE:      33,
  TRANSITION:    58,
};

function stats_linesFor(type, text) {
  const w = STATS_WIDTHS[type] || 58;
  const len = (text || '').length;
  const wrapped = Math.max(1, Math.ceil(len / w));
  // Spacing rules (industry): blank line before SCENE_HEADING, before ACTION,
  // before CHARACTER, before TRANSITION. We model that by adding +1 to those.
  switch (type) {
    case 'SCENE_HEADING': return wrapped + 1;
    case 'ACTION':        return wrapped + 1;
    case 'CHARACTER':     return wrapped + 1;
    case 'TRANSITION':    return wrapped + 1;
    case 'PARENTHETICAL': return wrapped;
    case 'DIALOGUE':      return wrapped;
    default:              return wrapped;
  }
}

// Returns true if a slug line is a structural marker (MONTAGE / INTERCUT / SERIES
// OF SHOTS / BACK TO / FLASHBACK) rather than an actual location heading. These
// still count as scenes but contribute nothing to the Locations report.
function stats_isStructuralSlug(text) {
  const t = (text || '').toUpperCase().trim();
  if (/^(MONTAGE|SERIES OF SHOTS|INTERCUT|BACK TO|FLASHBACK|END FLASHBACK|END OF MONTAGE|END MONTAGE)\b/.test(t)) return true;
  return false;
}

// Detect INT / EXT / I-E from anywhere in the slug. Strips zero-width chars,
// leading scene numbers ("1. ", "12. "), and an optional FLASHBACK/RETOUR
// prefix. Order matters : strip number FIRST so the rest of the chain sees
// a clean "INT. BUREAU…" or "FLASHBACK - EXT. PARKING…".
function stats_intExtKind(text) {
  let s = (text || '').replace(/^[​-‍﻿]+/, '').trim().toUpperCase();
  s = s.replace(/^\d+\.?\s+/, ''); // strip "1. " or "1 " scene-number prefix
  s = s.replace(/^(FLASHBACK|FIN FLASHBACK|END FLASHBACK|RETOUR|RETOUR PR[EÉ]SENT|RETOUR AU PR[EÉ]SENT|FLASHFORWARD|REWIND|FAST FORWARD)\s*[-–—:]\s*/i, '');
  if (/^(INT\/EXT|I\/E|EXT\/INT|E\/I)\b/.test(s)) return 'INTEXT';
  if (/^INT\b/.test(s)) return 'INT';
  if (/^EXT\b/.test(s)) return 'EXT';
  return null;
}

// Normalize a slug line to its location key + time-of-day bucket.
// Examples:
//   "INT. KITCHEN - DAY"                → { location: 'KITCHEN', tod: 'DAY' }
//   "EXT. JOHN'S HOUSE - KITCHEN - LATER" → { location: "JOHN'S HOUSE - KITCHEN", tod: 'OTHER' }
//   "INT. PARK"                        → { location: 'PARK', tod: null }
function stats_parseSlug(text) {
  let s = (text || '').replace(/^[​-‍﻿]+/, '').trim();
  // Strip leading scene number ("1. BUREAU DE LAURA" → "BUREAU DE LAURA")
  s = s.replace(/^\d+\.?\s+/, '');
  // Strip optional FLASHBACK / RETOUR / etc. prefix
  s = s.replace(/^(FLASHBACK|FIN FLASHBACK|END FLASHBACK|RETOUR|RETOUR PR[EÉ]SENT|RETOUR AU PR[EÉ]SENT|FLASHFORWARD|REWIND|FAST FORWARD)\s*[-–—:]\s*/i, '');
  // Strip leading INT./EXT./etc — period optional, accept word-boundary too
  s = s.replace(/^(INT\/EXT\.?|EXT\/INT\.?|I\/E\.?|E\/I\.?|INT\.?|EXT\.?)\s+/i, '');
  s = s.replace(/\.$/, '').trim();
  // Split on " - " or " – " or " — "
  const parts = s.split(/\s+[-–—]\s+/);
  if (parts.length === 0) return { location: '', tod: null };
  const lastRaw = parts[parts.length - 1].trim().toUpperCase();
  const tod = stats_classifyTimeOfDay(lastRaw);
  let locParts;
  if (parts.length > 1 && tod) {
    locParts = parts.slice(0, parts.length - 1);
  } else {
    locParts = parts;
  }
  const location = locParts.map(p => p.trim()).filter(Boolean).join(' - ').toUpperCase();
  return { location, tod };
}

function stats_classifyTimeOfDay(s) {
  if (!s) return null;
  // English + French (mandatory for v1.1). Strings are already uppercased.
  if (/^(DAY|MORNING|AFTERNOON|MIDDAY|NOON|JOUR|JOURN[EÉ]E|MATIN|MIDI|APR[EÉ]S\s*-?\s*MIDI)\b/i.test(s)) return 'DAY';
  if (/^(NIGHT|EVENING|LATE\s+NIGHT|MIDNIGHT|NUIT|SOIR|SOIR[EÉ]E|NUIT\s+NOIRE)\b/i.test(s)) return 'NIGHT';
  if (/^(DAWN|DUSK|MAGIC\s+HOUR|SUNSET|SUNRISE|TWILIGHT|AUBE|CR[EÉ]PUSCULE|AURORE|COUCHER\s+DE\s+SOLEIL|LEVER\s+DE\s+SOLEIL)\b/i.test(s)) return 'DUSK';
  if (/^(CONTINUOUS|LATER|MOMENTS\s+LATER|SAME\s+TIME|SAME|THE\s+NEXT\s+DAY|MEANWHILE|CONTINU|PLUS\s+TARD|SUITE|EN\s+M[EÉ]ME\s+TEMPS|LE\s+LENDEMAIN)\b/i.test(s)) return 'OTHER';
  return null;
}

// Strip parenthetical extensions from a CHARACTER cue:
// "JOHN (V.O.)" → "JOHN", "JOHN (CONT'D)" → "JOHN", "JOHN (on phone)" → "JOHN"
function stats_normalizeCharacterCue(raw) {
  return (raw || '').replace(/\s*\(.*?\)\s*$/g, '').trim().toUpperCase();
}


export function computeScriptStats(paras) {
  const items = [];
  let lineCounter = 0;
  let currentCharacter = null;
  for (const it of paras) {
    const type = it.type || 'ACTION';
    const text = (it.text || '').trim();
    if (!text) continue;
    const itemPage = 1 + Math.floor(lineCounter / STATS_LINES_PER_PAGE);
    lineCounter += stats_linesFor(type, text);
    if (type === 'CHARACTER') currentCharacter = stats_normalizeCharacterCue(text);
    else if (type === 'SCENE_HEADING' || type === 'ACTION' || type === 'TRANSITION') currentCharacter = null;
    items.push({ type, text, page: itemPage, character: (type === 'DIALOGUE') ? currentCharacter : null });
  }
  const totalPages = items.length ? items[items.length - 1].page : 1;
  // ── Pass 2 : aggregate scenes ──
  const scenes = []; // { slug, startPage, endPage, type, intExt, tod, location, characters: Set, dialogueWords, actionWords }
  let cur = null;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.type === 'SCENE_HEADING') {
      if (cur) {
        cur.endPage = it.page; // share page with next scene start
        scenes.push(cur);
      }
      const structural = stats_isStructuralSlug(it.text);
      const intExt = stats_intExtKind(it.text);
      const parsed = stats_parseSlug(it.text);
      cur = {
        slug: it.text,
        startPage: it.page,
        endPage: it.page,
        structural: !!structural || !intExt,
        intExt: intExt,                       // 'INT'|'EXT'|'INTEXT'|null
        tod: parsed.tod,                      // 'DAY'|'NIGHT'|'DUSK'|'OTHER'|null
        location: structural ? null : parsed.location,
        characters: new Set(),
        dialogueWords: 0,
        actionWords: 0,
      };
    } else if (cur) {
      cur.endPage = it.page;
      const words = (it.text.match(/\S+/g) || []).length;
      if (it.type === 'DIALOGUE') {
        cur.dialogueWords += words;
        if (it.character) cur.characters.add(it.character);
      } else if (it.type === 'ACTION') {
        cur.actionWords += words;
      }
    }
  }
  if (cur) {
    cur.endPage = totalPages;
    scenes.push(cur);
  }

  // ── Pass 3 : characters ──
  const charMap = {};
  let totalDialogueWords = 0;
  for (const s of scenes) {
    for (const ch of s.characters) {
      if (!charMap[ch]) charMap[ch] = { name: ch, lines: 0, words: 0, scenes: 0, _sceneSet: new Set() };
      charMap[ch]._sceneSet.add(s.startPage + ':' + s.slug);
    }
  }
  // Count dialogue lines + words at item level
  for (const it of items) {
    if (it.type === 'DIALOGUE' && it.character) {
      const c = charMap[it.character];
      if (!c) continue;
      c.lines += 1;
      const w = (it.text.match(/\S+/g) || []).length;
      c.words += w;
      totalDialogueWords += w;
    }
  }
  // Total scene count needed for presence % below
  const sceneCountForPresence = scenes.length;
  const characters = Object.values(charMap)
    .map(c => ({
      name: c.name,
      lines: c.lines,
      words: c.words,
      scenes: c._sceneSet.size,
      dialoguePct: totalDialogueWords > 0 ? (c.words / totalDialogueWords) * 100 : 0,
      presencePct: sceneCountForPresence > 0 ? (c._sceneSet.size / sceneCountForPresence) * 100 : 0,
    }))
    .filter(c => c.lines > 0 && /[A-Za-zÀ-ÿ]/.test(c.name))
    .sort((a, b) => b.words - a.words);

  // ── Pass 4 : scene-level stats ──
  let intCount = 0, extCount = 0, intExtCount = 0;
  let dayCount = 0, nightCount = 0, duskCount = 0, otherTodCount = 0, unspecifiedTodCount = 0;
  let longest = null, shortest = null;
  const sceneCount = scenes.length;
  for (const s of scenes) {
    if (s.intExt === 'INT')    intCount++;
    if (s.intExt === 'EXT')    extCount++;
    if (s.intExt === 'INTEXT') intExtCount++;
    if (s.tod === 'DAY')   dayCount++;
    else if (s.tod === 'NIGHT') nightCount++;
    else if (s.tod === 'DUSK')  duskCount++;
    else if (s.tod === 'OTHER') otherTodCount++;
    else unspecifiedTodCount++;
    const pages = Math.max(1, s.endPage - s.startPage + 1);
    if (!longest  || pages > longest.pages)  longest  = { slug: s.slug, startPage: s.startPage, pages };
    if (!shortest || pages < shortest.pages) shortest = { slug: s.slug, startPage: s.startPage, pages };
  }
  // Average is reconciled with total : total pages ÷ scene count. Avoids the
  // "1.9 × 105 = 200 pages" inconsistency caused by counting boundary pages
  // in each adjacent scene.
  const avgScenePages = sceneCount ? totalPages / sceneCount : 0;

  // ── Pass 5 : locations ──
  const locMap = {};
  for (const s of scenes) {
    if (!s.location) continue;
    if (!locMap[s.location]) locMap[s.location] = { name: s.location, scenes: 0, pages: 0 };
    locMap[s.location].scenes += 1;
    locMap[s.location].pages  += Math.max(1, s.endPage - s.startPage + 1);
  }
  const locations = Object.values(locMap).sort((a, b) => b.scenes - a.scenes);

  // ── Overview ──
  const speakingCharacters = characters.length;
  const uniqueLocations = locations.length;
  const totalActionWords = scenes.reduce((s, sc) => s + sc.actionWords, 0);
  const dialogueRatio = (totalDialogueWords + totalActionWords) > 0
    ? (totalDialogueWords / (totalDialogueWords + totalActionWords)) * 100
    : 0;

  return {
    overview: {
      pages: totalPages,
      scenes: sceneCount,
      speakingCharacters,
      uniqueLocations,
      dialogueRatio,
    },
    characters,
    sceneStats: {
      totalScenes: sceneCount,
      intCount, extCount, intExtCount,
      dayCount, nightCount, duskCount, otherTodCount, unspecifiedTodCount,
      avgScenePages,
      longest, shortest,
    },
    locations,
  };
}
