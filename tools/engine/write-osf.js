// write-osf.js — nos blocs typés vers un fichier Fade In (.fadein).
//
// Un .fadein est une archive ZIP contenant un seul document.xml au format
// ouvert « Open Screenplay Format ». Le squelette ci-dessous est copié sur un
// vrai fichier écrit par Fade In 5.0 : mêmes styles internes, mêmes noms, même
// version de document. C'est ce qui fait qu'il s'ouvre sans avertissement.
//
// Ce qu'on n'écrit pas : les cartes d'index, les étiquettes de dépouillement,
// les révisions, le navigateur. Ce sont des objets de Fade In, pas du
// scénario, et rien ne permettrait de les inventer.

import { zip } from './docx.js';

const OSF_TYPE = {
  SCENE_HEADING: 'Scene Heading',
  ACTION: 'Action',
  CHARACTER: 'Character',
  PARENTHETICAL: 'Parenthetical',
  DIALOGUE: 'Dialogue',
  TRANSITION: 'Transition'
};

const CONTROL = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

function esc(text) {
  return String(text === null || text === undefined ? '' : text)
    .replace(CONTROL, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Les huit styles internes de Fade In, repris tels quels. Les indentations
// sont les siennes, en unités OSF, et il les réappliquera de toute façon.
const STYLES = `  <styles>
    <style name="Normal Text" builtin="1" builtin_index="0" font="Courier New" size="12"/>
    <style name="Scene Heading" builtin="1" builtin_index="1" basestyle="Normal Text" style_enter="Action" style_tab_after="Action" font="Courier New" size="12" spacebefore="2.0" keepwithnext="1" allcaps="1"/>
    <style name="Action" builtin="1" builtin_index="2" basestyle="Normal Text" style_tab_before="Character" font="Courier New" size="12" spacebefore="1.0"/>
    <style name="Character" builtin="1" builtin_index="3" basestyle="Normal Text" style_enter="Dialogue" style_tab_before="Action" style_tab_after="Parenthetical" font="Courier New" size="12" spacebefore="1.0" keepwithnext="1" leftindent="635" allcaps="1"/>
    <style name="Parenthetical" builtin="1" builtin_index="4" basestyle="Normal Text" style_enter="Dialogue" style_tab_before="Dialogue" style_tab_after="Dialogue" font="Courier New" size="12" keepwithnext="1" leftindent="508" rightindent="508"/>
    <style name="Dialogue" builtin="1" builtin_index="5" basestyle="Normal Text" style_enter="Action" style_tab_before="Parenthetical" style_tab_after="Parenthetical" font="Courier New" size="12" leftindent="330" rightindent="254"/>
    <style name="Transition" builtin="1" builtin_index="6" basestyle="Normal Text" style_enter="Scene Heading" style_tab_after="Action" font="Courier New" size="12" spacebefore="1.0" align="right" leftindent="1016" rightindent="127" allcaps="1"/>
    <style name="Shot" builtin="1" builtin_index="7" basestyle="Normal Text" style_enter="Action" style_tab_after="Action" font="Courier New" size="12" spacebefore="1.0" keepwithnext="1" allcaps="1"/>
    <header_style basestyle="Normal Text"/>
    <footer_style basestyle="Normal Text"/>
  </styles>`;

// Les dimensions en unités OSF (millièmes de pouce) : US Letter et A4.
const PAGE = {
  US: 'page_width="2159" page_height="2794" margin_top="266" margin_bottom="228" margin_left="317" margin_right="317"',
  A4: 'page_width="2100" page_height="2970" margin_top="254" margin_bottom="201" margin_left="254" margin_right="254"'
};

function para(style, text, extra = '') {
  return (
    `    <para${extra}>\n` +
    `      <style basestyle="${style}"/>\n` +
    `      <text>${esc(text)}</text>\n` +
    '    </para>'
  );
}

function titlePageXml(titlePage) {
  if (!titlePage) return '';

  const lines = [];
  const blank = () => lines.push(para('Normal Text', ''));
  for (let i = 0; i < 10; i++) blank();

  // Les signets sont ce que Fade In relit pour retrouver ses champs. Sans eux,
  // le titre redeviendrait une ligne centrée parmi d'autres.
  lines.push(para('Normal Text', titlePage.title || 'UNTITLED', ' bookmark="Title"'));
  blank();
  blank();
  if (titlePage.author || titlePage.credit) {
    lines.push(para('Normal Text', 'Written by'));
    blank();
    lines.push(para('Normal Text', titlePage.author || titlePage.credit));
  }
  if (titlePage.source) { blank(); lines.push(para('Normal Text', titlePage.source)); }
  if (titlePage['draft date'] || titlePage.date) {
    blank();
    lines.push(para('Normal Text', titlePage['draft date'] || titlePage.date, ' bookmark="Draft"'));
  }
  if (titlePage.contact) {
    blank();
    lines.push(para('Normal Text', titlePage.contact, ' bookmark="Contact"'));
  }
  if (titlePage.copyright) {
    blank();
    lines.push(para('Normal Text', titlePage.copyright, ' bookmark="Copyright"'));
  }

  return `  <titlepage>\n${lines.join('\n')}\n  </titlepage>\n`;
}

/**
 * @param {{type: string, text: string}[]} blocks
 * @param {{titlePage?: Object|null, pageFormat?: 'US'|'A4'}} [options]
 * @returns {string} le contenu de document.xml
 */
export function buildOsfXml(blocks, options = {}) {
  const body = blocks
    .filter((block) => block && block.text && OSF_TYPE[block.type])
    .map((block) => para(OSF_TYPE[block.type], block.text))
    .join('\n');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<document type="Open Screenplay Format document" version="50">\n' +
    '  <info/>\n' +
    `  <settings ${PAGE[options.pageFormat === 'A4' ? 'A4' : 'US']} normal_linesperinch="6.0" element_spacing="1.00" dialogue_continues="true" cont_text="(cont'd)" more_text="(MORE)" page_header="#." header_alignment="3"/>\n` +
    STYLES + '\n' +
    `  <paragraphs>\n${body}\n  </paragraphs>\n` +
    titlePageXml(options.titlePage) +
    '</document>\n'
  );
}

/**
 * @returns {Uint8Array} le fichier .fadein complet
 */
export function buildFadeIn(blocks, options = {}) {
  return zip([{ name: 'document.xml', data: new TextEncoder().encode(buildOsfXml(blocks, options)) }]);
}
