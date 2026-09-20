#!/usr/bin/env node
/* ============================================================
   ÉCRIT LE PIED DE PAGE DANS LES PAGES.

   Le problème réglé ici : <site-footer> construit le pied de page
   à l'exécution, dans un Shadow DOM. Le HTML servi ne contenait
   donc AUCUN lien interne, et Google avait 87 pages découvertes
   qu'il n'explorait pas. Mesuré le 20/09/2026 : l'accueil portait
   six balises <a>, dont une seule vers une autre page du site.

   La règle « UN pied de page, point barre » ne change pas :
   footer.js RESTE la source unique de vérité. Ce script va y lire
   COLS, TAG, MADE et SWITCH, et écrit le même HTML dans chaque
   page entre deux repères. On change un lien dans footer.js, on
   relance `node build-footer.js`, ça change partout.

   footer.js reste chargé par les pages : il ne fait pas que le
   pied de page, il renomme aussi « Add to Chrome » en Edge, Brave
   ou Opera. Il garde aussi <site-footer> défini, ce qui sert de
   filet : une page non convertie affiche encore l'ancien pied de
   page au lieu de rien.

   Usage : node build-footer.js [--check]
     --check ne réécrit rien, il dit seulement ce qui bougerait.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const RACINE = __dirname;
const EXCLUS = ['-tmp/', 'node_modules', '.wrangler', 'board2/', '.git/'];
const DEBUT = '<!-- PIED DE PAGE : écrit par build-footer.js depuis footer.js. Ne pas modifier à la main. -->';
const FIN = '<!-- FIN DU PIED DE PAGE -->';

/* ---- 1. Lire les données dans footer.js -------------------- */

/** Extrait l'expression d'un `var NOM = ...;` en comptant les
 *  crochets, parce qu'un tableau de liens contient des `;` nulle part
 *  mais des `?:` et des virgules partout. */
function expression(src, nom) {
  const debut = src.indexOf('var ' + nom + ' = ');
  if (debut < 0) throw new Error('introuvable dans footer.js : ' + nom);
  let i = debut + ('var ' + nom + ' = ').length;
  let profondeur = 0, chaine = null;
  for (; i < src.length; i++) {
    const c = src[i];
    if (chaine) {
      if (c === '\\') i++;
      else if (c === chaine) chaine = null;
      continue;
    }
    if (c === '"' || c === "'") { chaine = c; continue; }
    if ('[({'.includes(c)) profondeur++;
    else if ('])}'.includes(c)) profondeur--;
    else if (c === ';' && profondeur === 0) break;
  }
  return src.slice(debut + ('var ' + nom + ' = ').length, i);
}

const SRC = fs.readFileSync(path.join(RACINE, 'footer.js'), 'utf8');
const INSTALL_EXT = SRC.match(/var INSTALL_EXT = '([^']+)'/)[1];
const INSTALL_ADDON = SRC.match(/var INSTALL_ADDON = '([^']+)'/)[1];

function donnees(estFr) {
  const ctx = { IS_FR: estFr, INSTALL_EXT, INSTALL_ADDON, Date };
  const lire = (nom) =>
    new Function('IS_FR', 'INSTALL_EXT', 'INSTALL_ADDON', 'return (' + expression(SRC, nom) + ');')
      (ctx.IS_FR, ctx.INSTALL_EXT, ctx.INSTALL_ADDON);
  return { COLS: lire('COLS'), TAG: lire('TAG'), MADE: lire('MADE'), SWITCH: lire('SWITCH') };
}

/* ---- 2. Construire le HTML --------------------------------- */

function colonne(c) {
  const liens = c[1].map(([texte, href]) => {
    const externe = href.indexOf('http') === 0;
    const attrs = externe ? ' target="_blank" rel="noopener"' : '';
    return `            <li><a href="${href}"${attrs}>${texte}</a></li>`;
  }).join('\n');
  return `        <div class="ftr-col">\n          <h3>${c[0]}</h3>\n          <ul>\n${liens}\n          </ul>\n        </div>`;
}

function pied(estFr) {
  const d = donnees(estFr);
  const accueil = estFr ? '/fr/' : '/';
  return [
    DEBUT,
    '  <footer class="ftr-shell">',
    '    <div class="ftr-wrap">',
    '      <div class="ftr-inner">',
    '        <div class="ftr-brand">',
    `          <a class="ftr-logo" href="${accueil}">scrrrr<span class="ftr-dot">.</span></a>`,
    `          <p class="ftr-tag">${d.TAG}</p>`,
    `          <a class="ftr-lang" href="${d.SWITCH[1]}">${d.SWITCH[0]}</a>`,
    '        </div>',
    '        <div class="ftr-cols">',
    d.COLS.map(colonne).join('\n'),
    '        </div>',
    '      </div>',
    '      <div class="ftr-base">',
    `        <p>${d.MADE}</p>`,
    '        <a href="mailto:hugopthomas@gmail.com">hugopthomas@gmail.com</a>',
    '      </div>',
    '    </div>',
    '  </footer>',
    FIN,
  ].join('\n');
}

/* ---- 3. Parcourir les pages -------------------------------- */

function pages(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = path.relative(RACINE, p) + (e.isDirectory() ? '/' : '');
    if (EXCLUS.some((x) => rel.includes(x))) continue;
    if (e.isDirectory()) pages(p, acc);
    else if (e.name.endsWith('.html')) acc.push(p);
  }
  return acc;
}

const CHECK = process.argv.includes('--check');
let ecrits = 0, deja = 0, sans = 0;

for (const f of pages(RACINE)) {
  let t = fs.readFileSync(f, 'utf8');
  const avait = t.includes('<site-footer></site-footer>') || t.includes(DEBUT);
  if (!avait) { sans++; continue; }

  const estFr = /<html[^>]+lang="fr/i.test(t);
  const bloc = pied(estFr);

  const i = t.indexOf(DEBUT);
  if (i >= 0) {
    const j = t.indexOf(FIN, i);
    t = t.slice(0, i) + bloc + t.slice(j + FIN.length);
  } else {
    t = t.replace('<site-footer></site-footer>', bloc);
  }

  // La feuille du pied de page, une seule fois, juste avant </head>.
  if (!t.includes('href="/footer.css"')) {
    t = t.replace('</head>', '  <link rel="stylesheet" href="/footer.css">\n</head>');
  }

  const origine = fs.readFileSync(f, 'utf8');
  if (t === origine) { deja++; continue; }
  if (!CHECK) fs.writeFileSync(f, t, 'utf8');
  ecrits++;
}

console.log(
  (CHECK ? '[contrôle] ' : '') +
  `${ecrits} page(s) ${CHECK ? 'à réécrire' : 'réécrites'}, ${deja} déjà à jour, ${sans} sans pied de page partagé.`
);
