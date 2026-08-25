// write-fdx.js — nos blocs typés vers un .fdx que Final Draft ouvre.
//
// C'est le miroir exact de parse-fdx.js, et le fait qu'il soit un miroir est
// ce qui le rend sûr : le .fdx porte le type de chaque paragraphe, donc rien
// n'est deviné à l'écriture non plus. Un aller-retour (lire un .fdx, le
// réécrire, le relire) rend exactement les mêmes blocs, et un test le vérifie.
//
// Ce qu'on n'écrit pas, volontairement : le gras, l'italique, les révisions
// colorées, les numéros de scène verrouillés. Le format scénario n'en a pas et
// le lecteur de départ ne les a jamais gardés.

// Nos types vers Final Draft. L'inverse de TYPE_MAP dans parse-fdx.js.
const FD_TYPE = {
  SCENE_HEADING: 'Scene Heading',
  ACTION: 'Action',
  CHARACTER: 'Character',
  PARENTHETICAL: 'Parenthetical',
  DIALOGUE: 'Dialogue',
  TRANSITION: 'Transition'
};

// Les caractères de contrôle font échouer l'ouverture du fichier sans que Final
// Draft dise pourquoi, et un PDF mal extrait en contient.
const CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

function esc(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(CONTROL, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function paragraph(type, text) {
  return `    <Paragraph Type="${type}"><Text>${esc(text)}</Text></Paragraph>`;
}

function titlePageXml(titlePage) {
  if (!titlePage) return '';

  const lines = [];
  const push = (text) => lines.push(`      <Paragraph Alignment="Center"><Text>${esc(text)}</Text></Paragraph>`);
  const blank = () => lines.push('      <Paragraph Alignment="Center"><Text></Text></Paragraph>');

  // Le titre part tel qu'il a été lu. Une page de titre imprimée se met en
  // capitales, mais un .fdx est un fichier qu'on rouvre pour écrire : mettre
  // « La Salle des profs » en capitales le perdrait pour de bon.
  push(String(titlePage.title || 'UNTITLED'));
  blank();
  push(titlePage.credit && !/^written by$/i.test(titlePage.credit) ? titlePage.credit : 'Written by');
  blank();
  if (titlePage.author || titlePage.credit) push(titlePage.author || titlePage.credit);
  if (titlePage.source) { blank(); push(titlePage.source); }
  if (titlePage['draft date'] || titlePage.date) { blank(); push(titlePage['draft date'] || titlePage.date); }
  if (titlePage.contact) {
    blank();
    for (const line of String(titlePage.contact).split('\n')) push(line);
  }

  return `  <TitlePage>\n    <Content>\n${lines.join('\n')}\n    </Content>\n  </TitlePage>\n`;
}

/**
 * @param {{type: string, text: string}[]} blocks
 * @param {{titlePage?: Object|null}} [options]
 * @returns {string} le contenu d'un fichier .fdx
 */
export function buildFdx(blocks, options = {}) {
  const body = blocks
    .filter((block) => block && block.text && FD_TYPE[block.type])
    .map((block) => paragraph(FD_TYPE[block.type], block.text))
    .join('\n');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
    '<FinalDraft DocumentType="Script" Template="No" Version="1">\n' +
    '  <Content>\n' +
    body +
    '\n  </Content>\n' +
    titlePageXml(options.titlePage) +
    '</FinalDraft>\n'
  );
}
