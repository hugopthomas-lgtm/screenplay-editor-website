// Screenplay Editor — LE MOTEUR, unique, partagé par toutes les plateformes.
//
// Un seul fichier, chargé tel quel :
//   - dans Google Docs (content script, avant limits.js et content.js) ;
//   - dans Word (taskpane.html, avant les modules du volet) ;
//   - dans les tests (vitest, eval ou import).
// Il ne connaît ni le DOM, ni Google Docs, ni Office.js. Il contient ce qui ne
// doit exister QU'UNE FOIS : les modes, les matrices Entrée/Tab, les
// déclencheurs de frappe (int., ext., transitions), la casse, les couleurs de la
// pilule, la liste du rail, le contenu de la pilule. Les adaptateurs (content.js
// pour Docs, word-adapter.js pour Word) décident COMMENT appliquer, jamais QUOI.
//
// Leçon Grammarly (chantiers/06, 2026-08-11, rappelée par Hugo le 14/09/2026) :
// le coût n'est pas de fabriquer le deuxième magasin, il est dans chaque
// correction future multipliée par le nombre de copies. Ici il n'y a pas de copie.
(function (root) {
  'use strict';

  const MODES = ['SCENE_HEADING', 'ACTION', 'CHARACTER', 'PARENTHETICAL', 'DIALOGUE', 'TRANSITION'];

  const MODE_LABELS = {
    SCENE_HEADING:  'Scene Heading',
    ACTION:         'Action',
    CHARACTER:      'Character',
    DIALOGUE:       'Dialogue',
    PARENTHETICAL:  'Parenthetical',
    TRANSITION:     'Transition'
  };

  // Entrée = avancer. Convention Final Draft pour Dialogue (décision Hugo, 18/08/2026).
  const NEXT_MODE = {
    SCENE_HEADING:  'ACTION',
    ACTION:         'ACTION',
    CHARACTER:      'DIALOGUE',
    DIALOGUE:       'ACTION',
    PARENTHETICAL:  'DIALOGUE',
    TRANSITION:     'SCENE_HEADING'
  };

  // Tab sur une ligne ÉCRITE = passer à la ligne dans le type suivant. null = rien.
  const TAB_NEXT = {
    SCENE_HEADING:  null,
    ACTION:         'CHARACTER',
    CHARACTER:      'PARENTHETICAL',
    PARENTHETICAL:  null,
    DIALOGUE:       'PARENTHETICAL',
    TRANSITION:     null
  };

  // Tab sur une ligne VIDE = changer le type de la ligne sur place.
  const EMPTY_TAB = { ACTION: 'CHARACTER', DIALOGUE: 'PARENTHETICAL', CHARACTER: 'ACTION' };

  // Entrée en fin d'une ligne ÉDITÉE (curseur revenu dessus) : [mode suivant,
  // passer une ligne vide en plus ?]. C'est la table _ADV de content.js.
  const ENTER_ADVANCE = {
    DIALOGUE:       ['ACTION', true],
    ACTION:         ['ACTION', true],
    SCENE_HEADING:  ['ACTION', true],
    TRANSITION:     ['SCENE_HEADING', true],
    CHARACTER:      ['DIALOGUE', false],
    PARENTHETICAL:  ['DIALOGUE', false]
  };

  // Retraits en points depuis les marges (1,5 po à gauche, 1 po à droite en US
  // Letter). Mêmes nombres que Code.js (add-on) et background.js (FORMATS).
  const INDENTS_US = {
    SCENE_HEADING: { left: 0, right: 0 },
    ACTION:        { left: 0, right: 0 },
    CHARACTER:     { left: 194, right: 0 },
    DIALOGUE:      { left: 101, right: 94 },
    PARENTHETICAL: { left: 151, right: 137 },
    TRANSITION:    { left: 0, right: 0 }
  };
  const INDENTS_A4 = {
    SCENE_HEADING: { left: 0, right: 0 },
    ACTION:        { left: 0, right: 0 },
    CHARACTER:     { left: 178, right: 0 },
    DIALOGUE:      { left: 93, right: 93 },
    PARENTHETICAL: { left: 136, right: 136 },
    TRANSITION:    { left: 0, right: 0 }
  };

  // Modes écrits en capitales à la frappe (toute la ligne).
  const UPPERCASE_MODES = { SCENE_HEADING: 1, CHARACTER: 1, TRANSITION: 1 };
  // Modes retouchés après un format posé à la main (rail, raccourci) :
  // capitales, ou parenthèses pour la parenthèse.
  const CASE_FIX_MODES = { SCENE_HEADING: 1, CHARACTER: 1, TRANSITION: 1, PARENTHETICAL: 1 };

  // Transition tapée : ligne entière (regex ancrée ^$), déclenchée sur ':' ou '.'.
  const TRANSITION_RE = /^((CUT|DISSOLVE|SMASH CUT|MATCH CUT|JUMP CUT|HARD CUT|TIME CUT|WIPE|CROSSFADE) TO\s*:|FADE (IN|OUT|TO BLACK|TO WHITE)\s*[:.]|FADE TO\s*:|FONDU (AU NOIR|AU BLANC|ENCHA[IÎ]N[EÉ])\s*[.:]|COUPE FRANCHE\s*[.:])$/i;

  const TRANSITIONS = [
    'CUT TO:', 'FADE IN:', 'FADE OUT.', 'FADE TO:', 'DISSOLVE TO:', 'BACK TO:',
    'MATCH CUT TO:', 'JUMP CUT TO:', 'HARD CUT TO:', 'SMASH CUT TO:', 'FADE TO BLACK.'
  ];

  // Déclencheur de frappe. Pur : reçoit le tampon de la ligne et la touche,
  // rend le nouveau tampon et, le cas échéant, le déclencheur
  // { mode, upper, erase } : erase = nombre de caractères à l'écran à effacer
  // avant de retaper `upper` (le caractère déclencheur, '.' ou ':', n'a pas été
  // écrit). « int. » / « ext. » → Scene Heading, sur le point. Une transition
  // entière → Transition, sur ':' ou '.'.
  function liveKey(buffer, key) {
    buffer = buffer || '';
    if (key === 'Enter' || key === 'Escape' || key === 'Tab') return { buffer: '', trigger: null };
    if (key === 'Backspace') return { buffer: buffer.slice(0, -1), trigger: null };
    if (!key || key.length !== 1) return { buffer, trigger: null };
    buffer += key;
    if (key === '.') {
      const buf = buffer.toLowerCase();
      let upper = null;
      if (buf === 'int.' || buf.endsWith(' int.')) upper = 'INT.';
      else if (buf === 'ext.' || buf.endsWith(' ext.')) upper = 'EXT.';
      if (upper) return { buffer: '', trigger: { mode: 'SCENE_HEADING', upper, erase: 3 } };
    }
    if (key === ':' || key === '.') {
      const t = buffer.trim();
      if (TRANSITION_RE.test(t)) {
        return { buffer: '', trigger: { mode: 'TRANSITION', upper: t.toUpperCase(), erase: buffer.length - 1 } };
      }
    }
    return { buffer, trigger: null };
  }

  // Même détection, mais sur une ligne DÉJÀ écrite (Word ne voit la frappe
  // qu'après coup) : rend le mode que la ligne réclame, ou null.
  function lineTrigger(text) {
    const t = String(text || '').trim();
    if (!t) return null;
    if (/^(int|ext)\.(\s|$)/i.test(t)) return 'SCENE_HEADING';
    if (TRANSITION_RE.test(t)) return 'TRANSITION';
    return null;
  }

  // Le nom passe en capitales, l'extension entre parenthèses garde sa casse :
  // « bellini (à la radio) » donne « BELLINI (à la radio) ».
  function upperCueName(text) {
    const m = String(text).match(/(\s*\([^)]*\))+\s*$/);
    if (m && m.index > 0) return text.slice(0, m.index).toUpperCase() + text.slice(m.index);
    return String(text).toUpperCase();
  }

  // Texte cible après un format posé à la main sur une ligne fraîchement tapée.
  // null = ne rien toucher.
  function caseFixTarget(mode, buf) {
    if (!CASE_FIX_MODES[mode]) return null;
    buf = buf || '';
    if (!buf.trim() || buf.length > 60 || /[\n\r]/.test(buf)) return null;
    const target = mode === 'PARENTHETICAL'
      ? (/^\(.*\)$/.test(buf.trim()) ? buf : '(' + buf.trim() + ')')
      : (mode === 'CHARACTER' ? upperCueName(buf) : buf.toUpperCase());
    return target === buf ? null : target;
  }

  // Tab : que faire, selon le mode et l'état de la ligne.
  //   { kind: 'none' }                       rien (Parenthèse, Titre, Transition)
  //   { kind: 'inplace', mode }              ligne vide : changer le type sur place
  //   { kind: 'newline', mode, blank, parens } ligne écrite : passer à la ligne
  //       dans `mode` (blank = une ligne vide entre, parens = ouvrir « ( ) »)
  function tabDecision(mode, lineEmpty) {
    if (lineEmpty) {
      const to = EMPTY_TAB[mode] || null;
      return to ? { kind: 'inplace', mode: to, parens: to === 'PARENTHETICAL' } : { kind: 'none' };
    }
    const to = TAB_NEXT[mode] || null;
    if (!to) return { kind: 'none' };
    return { kind: 'newline', mode: to, blank: mode === 'ACTION', parens: to === 'PARENTHETICAL' };
  }

  // Entrée en fin de ligne écrite : mode suivant et ligne vide entre les deux ?
  function enterDecision(mode) {
    const adv = ENTER_ADVANCE[mode] || ['ACTION', true];
    return { mode: adv[0], blank: adv[1] };
  }

  // Ce que la pilule affiche : le badge, la cible d'Entrée, la cible de Tab,
  // et s'il faut montrer « Write INT. or EXT. » à la place de l'Entrée.
  function pillContent(mode, lineEmpty) {
    mode = MODE_LABELS[mode] ? mode : 'ACTION';
    const en = lineEmpty ? (mode === 'PARENTHETICAL' ? 'DIALOGUE' : null) : (NEXT_MODE[mode] || 'ACTION');
    const tb = lineEmpty ? (EMPTY_TAB[mode] || null) : TAB_NEXT[mode];
    const showEnter = !!en && en !== mode;
    return {
      mode,
      label: MODE_LABELS[mode],
      enter: showEnter ? en : null,
      tab: tb || null,
      scene: !showEnter && (mode === 'ACTION' || mode === 'DIALOGUE'),
      colors: BADGE_COLORS[mode] || BADGE_COLORS.ACTION
    };
  }

  // Jetons teintés de la pilule : fond `tint` (~13 %), texte `ink`.
  const BADGE_COLORS = {
    SCENE_HEADING:  { grad: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', glow: '56,189,248',  tint: 'rgba(14,165,233,0.13)',  ink: '#0369a1' },
    ACTION:         { grad: 'linear-gradient(135deg,#8b5cf6,#a855f7)', glow: '168,85,247',  tint: 'rgba(139,92,246,0.13)',  ink: '#6d28d9' },
    CHARACTER:      { grad: 'linear-gradient(135deg,#ec4899,#f472b6)', glow: '244,114,182', tint: 'rgba(236,72,153,0.13)',  ink: '#be185d' },
    DIALOGUE:       { grad: 'linear-gradient(135deg,#8cc81e,#bced52)', glow: '188,237,82',  tint: 'rgba(140,200,30,0.18)',  ink: '#4d7c0f' },
    PARENTHETICAL:  { grad: 'linear-gradient(135deg,#f59e0b,#fbbf24)', glow: '251,191,36',  tint: 'rgba(245,158,11,0.16)',  ink: '#a16207' },
    TRANSITION:     { grad: 'linear-gradient(135deg,#14b8a6,#2dd4bf)', glow: '45,212,191',  tint: 'rgba(20,184,166,0.14)',  ink: '#0f766e' }
  };

  // Le rail : six tuiles, dans cet ordre, avec leur raccourci (⌥ / Alt + chiffre).
  const RAIL_ITEMS = [
    { mode: 'SCENE_HEADING', label: 'Scene Heading', key: '1' },
    { mode: 'ACTION',        label: 'Action',        key: '2' },
    { mode: 'CHARACTER',     label: 'Character',     key: '3' },
    { mode: 'PARENTHETICAL', label: 'Parenthetical', key: '4' },
    { mode: 'DIALOGUE',      label: 'Dialogue',      key: '5' },
    { mode: 'TRANSITION',    label: 'Transition',    key: '6' }
  ];

  // Le rail, preset « color » (le seul actif) : carte blanche, tuiles 22 px
  // monochromes, l'active = pastille anthracite avancée de 10 px.
  const RAIL_STYLE = {
    container: 'background:#fff;padding:6px 5px;border-radius:12px;box-shadow:0 3px 14px rgba(0,0,0,0.09),0 1px 3px rgba(0,0,0,0.05);',
    btnBox: 22, svgSize: 14, gap: 4, pad: 6, radius: 5,
    inactiveColor: '#d1d5db', hoverColor: '#6b7280',
    activeBg: '#3a4046', activeColor: '#fff', activeRadius: 7, activeShift: 10, activeScale: 1.12,
    activeShadow: '0 1px 3px rgba(0,0,0,0.12)',
    tooltipDelay: 450
  };

  // Icônes Tabler 24×24 (ACTION = PNG en masque, fourni par l'adaptateur).
  const MODE_ICONS = {
    SCENE_HEADING:  '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8.813 11.612c.457 -.38 .918 -.38 1.386 .011l.108 .098l4.986 4.986l.094 .083a1 1 0 0 0 1.403 -1.403l-.083 -.094l-1.292 -1.293l.292 -.293l.106 -.095c.457 -.38 .918 -.38 1.386 .011l.108 .098l4.674 4.675a4 4 0 0 1 -3.775 3.599l-.206 .005h-12a4 4 0 0 1 -3.98 -3.603l6.687 -6.69l.106 -.095zm9.187 -9.612a4 4 0 0 1 3.995 3.8l.005 .2v9.585l-3.293 -3.292l-.15 -.137c-1.256 -1.095 -2.85 -1.097 -4.096 -.017l-.154 .14l-.307 .306l-2.293 -2.292l-.15 -.137c-1.256 -1.095 -2.85 -1.097 -4.096 -.017l-.154 .14l-5.307 5.306v-9.585a4 4 0 0 1 3.8 -3.995l.2 -.005h12zm-2.99 5l-.127 .007a1 1 0 0 0 0 1.986l.117 .007l.127 -.007a1 1 0 0 0 0 -1.986l-.117 -.007z"/></svg>',
    ACTION:         null,
    CHARACTER:      '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 1 1 -5 5l.005 -.217a5 5 0 0 1 4.995 -4.783z"/><path d="M14 14a5 5 0 0 1 5 5v1a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-1a5 5 0 0 1 5 -5h4z"/></svg>',
    DIALOGUE:       '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M17.802 17.292s.077 -.055 .2 -.149c1.843 -1.425 3 -3.49 3 -5.789c0 -4.286 -4.03 -7.764 -9 -7.764c-4.97 0 -9 3.478 -9 7.764c0 4.288 4.03 7.646 9 7.646c.424 0 1.12 -.028 2.088 -.084c1.262 .82 3.104 1.493 4.716 1.493c.499 0 .734 -.41 .414 -.828c-.486 -.596 -1.156 -1.551 -1.416 -2.29l-.002 .001"/><path d="M7.5 13.5c2.5 2.5 6.5 2.5 9 0"/></svg>',
    PARENTHETICAL:  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4c-3.333 3.333 -3.333 12.667 0 16"/><path d="M17 4c3.333 3.333 3.333 12.667 0 16"/></svg>',
    TRANSITION:     '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l5 5l-5 5"/><path d="M13 7l5 5l-5 5"/></svg>'
  };

  const api = {
    MODES, MODE_LABELS, NEXT_MODE, TAB_NEXT, EMPTY_TAB, ENTER_ADVANCE,
    INDENTS_US, INDENTS_A4, UPPERCASE_MODES, CASE_FIX_MODES,
    TRANSITION_RE, TRANSITIONS, BADGE_COLORS, RAIL_ITEMS, RAIL_STYLE, MODE_ICONS,
    liveKey, lineTrigger, upperCueName, caseFixTarget, tabDecision, enterDecision, pillContent
  };

  root.SEEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
