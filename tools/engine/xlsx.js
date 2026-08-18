// xlsx.js — un classeur de dépouillement, écrit à la main.
//
// Un .xlsx est une archive ZIP de XML, comme un .docx. On réutilise donc le
// même écrivain d'archive plutôt que d'embarquer une bibliothèque, et on écrit
// les chaînes en clair dans les cellules (inlineStr), ce qui évite la table
// des chaînes partagées et son indexation.
//
// Les couleurs comptent : un dépouillement en noir et blanc ne sert à rien sur
// un plateau, c'est la couleur qui fait retrouver une scène de nuit d'un coup
// d'œil dans une liasse.

import { zip } from './docx.js';

const escapeXml = (text) =>
  String(text)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const columnName = (index) => {
  let name = '';
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
};

// Index de style dans styles.xml ci-dessous.
export const STYLE = { plain: 0, header: 1, day: 2, night: 3, ext: 4 };

function cellXml(value, row, column, style) {
  const ref = `${columnName(column)}${row}`;
  const s = style ? ` s="${style}"` : '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${s}><v>${value}</v></c>`;
  }
  const text = value === null || value === undefined ? '' : String(value);
  if (!text) return `<c r="${ref}"${s}/>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '</Types>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

const WORKBOOK_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';

const workbookXml = (sheetName) =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  `<sheets><sheet name="${escapeXml(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets>` +
  '</workbook>';

// Quatre remplissages : l'en-tête, le jour, la nuit, l'extérieur. Les teintes
// reprennent celles du site pour que la feuille ait l'air de venir d'ici.
const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '</fonts>' +
  '<fills count="6">' +
  '<fill><patternFill patternType="none"/></fill>' +
  '<fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1A1A1A"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFFDF6DF"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE7E0F7"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFE4F0F2"/><bgColor indexed="64"/></patternFill></fill>' +
  '</fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="5">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="4" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

/**
 * @param {{columns: {label: string, width?: number}[], rows: {cells: Array, style?: number}[], sheetName?: string}} table
 * @returns {Uint8Array} un .xlsx complet
 */
export function buildXlsx({ columns, rows, sheetName = 'Breakdown' }) {
  const cols = columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width || 18}" customWidth="1"/>`)
    .join('');

  const headerCells = columns.map((c, i) => cellXml(c.label, 1, i, STYLE.header)).join('');
  const body = rows
    .map((row, rowIndex) => {
      const cells = row.cells.map((value, i) => cellXml(value, rowIndex + 2, i, row.style || STYLE.plain)).join('');
      return `<row r="${rowIndex + 2}">${cells}</row>`;
    })
    .join('');

  const sheet =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<cols>${cols}</cols>` +
    // La ligne d'en-tête reste visible au défilement : sur cent scènes, une
    // feuille sans volet figé est illisible.
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    `<sheetData><row r="1">${headerCells}</row>${body}</sheetData>` +
    `<autoFilter ref="A1:${columnName(columns.length - 1)}${rows.length + 1}"/>` +
    '</worksheet>';

  const encoder = new TextEncoder();
  return zip([
    { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbookXml(sheetName)) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(WORKBOOK_RELS) },
    { name: 'xl/styles.xml', data: encoder.encode(STYLES) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheet) }
  ]);
}

/** Les colonnes du dépouillement, et la couleur de chaque ligne. */
export function breakdownTable(sceneList) {
  return {
    sheetName: 'Breakdown',
    columns: [
      { label: '#', width: 6 },
      { label: 'Scene heading', width: 44 },
      { label: 'Int / Ext', width: 10 },
      { label: 'Location', width: 30 },
      { label: 'Time', width: 12 },
      { label: 'Page', width: 8 },
      { label: 'Length (pages)', width: 14 },
      { label: 'Cast', width: 40 },
      { label: 'Dialogue words', width: 15 }
    ],
    rows: sceneList.map((scene) => ({
      style: /NIGHT|NUIT|DUSK|DAWN|SOIR|AUBE/i.test(scene.time)
        ? STYLE.night
        : scene.intExt === 'EXT'
          ? STYLE.ext
          : STYLE.day,
      cells: [
        scene.number,
        scene.heading,
        scene.intExt,
        scene.location,
        scene.time,
        scene.startPage,
        scene.pages,
        scene.characters.join(', '),
        scene.dialogueWords
      ]
    }))
  };
}
