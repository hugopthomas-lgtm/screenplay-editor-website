// docx.js — blocs typés vers un .docx que Google Docs ouvre déjà formaté.
//
// Le point entier du convertisseur est là : les indentations écrites ici sont
// celles de CONFIG.INDENTS_* dans Code.js, donc quand le document arrive dans
// Docs, l'add-on et l'extension reconnaissent chaque paragraphe sans rien
// avoir à recalculer. Un demi-point d'écart et la détection retombe sur
// ACTION partout.
//
// Le .docx est écrit à la main (OOXML + une archive ZIP « stored ») plutôt
// qu'avec une bibliothèque : le fichier tient en quatre entrées, et ça évite
// 300 ko de dépendance pour produire 60 ko de XML.

import { INDENTS, PAGE, FONT_FAMILY, FONT_SIZE, withBlankLines } from './screenplay.js';

const PT_TO_TWIPS = 20;

function escapeXml(text) {
  return String(text)
    // Les caractères de contrôle rendent le .docx illisible pour Word comme
    // pour Docs : on les retire avant tout échappement.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function runXml(text, { bold = false } = {}) {
  const rPr =
    `<w:rPr><w:rFonts w:ascii="${FONT_FAMILY}" w:hAnsi="${FONT_FAMILY}" w:cs="${FONT_FAMILY}"/>` +
    (bold ? '<w:b/>' : '') +
    `<w:sz w:val="${FONT_SIZE * 2}"/><w:szCs w:val="${FONT_SIZE * 2}"/>` +
    `<w:color w:val="000000"/></w:rPr>`;
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function paragraphXml(text, { left = 0, right = 0, align = 'left', bold = false, pageBreakBefore = false } = {}) {
  const pPr =
    '<w:pPr>' +
    (pageBreakBefore ? '<w:pageBreakBefore/>' : '') +
    '<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>' +
    `<w:ind w:left="${Math.round(left * PT_TO_TWIPS)}" w:right="${Math.round(right * PT_TO_TWIPS)}" w:firstLine="0"/>` +
    `<w:jc w:val="${align}"/>` +
    '</w:pPr>';
  return `<w:p>${pPr}${text ? runXml(text, { bold }) : ''}</w:p>`;
}

function titlePageXml(titlePage) {
  if (!titlePage) return '';
  const centered = (text, bold) => paragraphXml(text, { align: 'center', bold });
  const blank = () => paragraphXml('', {});

  const out = [];
  for (let i = 0; i < 10; i++) out.push(blank());
  out.push(centered((titlePage.title || 'UNTITLED').toUpperCase(), true));
  out.push(blank());
  out.push(blank());
  out.push(centered('Written by'));
  out.push(blank());
  if (titlePage.author || titlePage.credit) out.push(centered(titlePage.author || titlePage.credit));
  if (titlePage.source) { out.push(blank()); out.push(centered(titlePage.source)); }
  for (let i = 0; i < 8; i++) out.push(blank());
  if (titlePage['draft date'] || titlePage.date) out.push(centered(titlePage['draft date'] || titlePage.date));
  if (titlePage.contact) {
    out.push(blank());
    for (const line of String(titlePage.contact).split('\n')) out.push(centered(line));
  }
  return out.join('');
}

/**
 * @param {{type: string, text: string}[]} blocks
 * @param {{pageFormat?: 'US'|'A4', titlePage?: Object|null, sceneHeadingBold?: boolean}} options
 * @returns {string} le contenu de word/document.xml
 */
export function buildDocumentXml(blocks, options = {}) {
  const pageFormat = options.pageFormat === 'A4' ? 'A4' : 'US';
  const indents = INDENTS[pageFormat];
  const page = PAGE[pageFormat];
  const sceneHeadingBold = options.sceneHeadingBold !== false;

  const body = [];
  const title = titlePageXml(options.titlePage);
  if (title) body.push(title);

  const spaced = withBlankLines(blocks);
  let first = true;

  for (const block of spaced) {
    if (block.type === 'BLANK') {
      body.push(paragraphXml('', {}));
      first = false;
      continue;
    }

    const indent = indents[block.type] || indents.ACTION;
    body.push(
      paragraphXml(block.text, {
        left: indent.left,
        right: indent.right,
        align: block.type === 'TRANSITION' ? 'right' : 'left',
        bold: block.type === 'SCENE_HEADING' && sceneHeadingBold,
        pageBreakBefore: Boolean(title) && first
      })
    );
    first = false;
  }

  const inch = (points) => Math.round(points * PT_TO_TWIPS);
  const sectPr =
    '<w:sectPr>' +
    `<w:pgSz w:w="${inch(page.width)}" w:h="${inch(page.height)}"/>` +
    `<w:pgMar w:top="${inch(page.marginTop)}" w:right="${inch(page.marginRight)}" ` +
    `w:bottom="${inch(page.marginBottom)}" w:left="${inch(page.marginLeft)}" ` +
    'w:header="720" w:footer="720" w:gutter="0"/>' +
    '</w:sectPr>';

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    `<w:body>${body.join('')}${sectPr}</w:body></w:document>`
  );
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  '</Types>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

const DOCUMENT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>';

// Le style par défaut porte déjà la police et le corps : si un lecteur ignore
// les runs, le document reste en Courier 12 au lieu de retomber en Calibri 11.
const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:docDefaults><w:rPrDefault><w:rPr>' +
  `<w:rFonts w:ascii="${FONT_FAMILY}" w:hAnsi="${FONT_FAMILY}" w:cs="${FONT_FAMILY}"/>` +
  `<w:sz w:val="${FONT_SIZE * 2}"/><w:szCs w:val="${FONT_SIZE * 2}"/>` +
  '</w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
  '</w:docDefaults>' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
  '</w:styles>';

// ============================================
// ARCHIVE ZIP (méthode « stored », sans compression)
// ============================================

let crcTable = null;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[i] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32(view, offset, value) { view.setUint32(offset, value, true); }
function writeUint16(view, offset, value) { view.setUint16(offset, value, true); }

/**
 * Assemble les entrées en une archive ZIP.
 * @param {{name: string, data: Uint8Array}[]} entries
 * @returns {Uint8Array}
 */
export function zip(entries) {
  const encoder = new TextEncoder();
  const prepared = entries.map((entry) => ({
    nameBytes: encoder.encode(entry.name),
    data: entry.data,
    crc: crc32(entry.data)
  }));

  let localSize = 0;
  let centralSize = 0;
  for (const entry of prepared) {
    localSize += 30 + entry.nameBytes.length + entry.data.length;
    centralSize += 46 + entry.nameBytes.length;
  }

  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let offset = 0;
  const offsets = [];

  for (const entry of prepared) {
    offsets.push(offset);
    writeUint32(view, offset, 0x04034b50);
    writeUint16(view, offset + 4, 20);       // version needed
    writeUint16(view, offset + 6, 0x0800);   // drapeau UTF-8
    writeUint16(view, offset + 8, 0);        // stored
    writeUint16(view, offset + 10, 0);       // heure
    writeUint16(view, offset + 12, 0x21);    // date (1980-01-01, reproductible)
    writeUint32(view, offset + 14, entry.crc);
    writeUint32(view, offset + 18, entry.data.length);
    writeUint32(view, offset + 22, entry.data.length);
    writeUint16(view, offset + 26, entry.nameBytes.length);
    writeUint16(view, offset + 28, 0);
    out.set(entry.nameBytes, offset + 30);
    out.set(entry.data, offset + 30 + entry.nameBytes.length);
    offset += 30 + entry.nameBytes.length + entry.data.length;
  }

  const centralStart = offset;
  for (let i = 0; i < prepared.length; i++) {
    const entry = prepared[i];
    writeUint32(view, offset, 0x02014b50);
    writeUint16(view, offset + 4, 20);
    writeUint16(view, offset + 6, 20);
    writeUint16(view, offset + 8, 0x0800);
    writeUint16(view, offset + 10, 0);
    writeUint16(view, offset + 12, 0);
    writeUint16(view, offset + 14, 0x21);
    writeUint32(view, offset + 16, entry.crc);
    writeUint32(view, offset + 20, entry.data.length);
    writeUint32(view, offset + 24, entry.data.length);
    writeUint16(view, offset + 28, entry.nameBytes.length);
    writeUint16(view, offset + 30, 0);
    writeUint16(view, offset + 32, 0);
    writeUint16(view, offset + 34, 0);
    writeUint16(view, offset + 36, 0);
    writeUint32(view, offset + 38, 0);
    writeUint32(view, offset + 42, offsets[i]);
    out.set(entry.nameBytes, offset + 46);
    offset += 46 + entry.nameBytes.length;
  }

  writeUint32(view, offset, 0x06054b50);
  writeUint16(view, offset + 4, 0);
  writeUint16(view, offset + 6, 0);
  writeUint16(view, offset + 8, prepared.length);
  writeUint16(view, offset + 10, prepared.length);
  writeUint32(view, offset + 12, offset - centralStart);
  writeUint32(view, offset + 16, centralStart);
  writeUint16(view, offset + 20, 0);

  return out;
}

/**
 * @param {{type: string, text: string}[]} blocks
 * @param {Object} options passées à buildDocumentXml
 * @returns {Uint8Array} un .docx complet
 */
export function buildDocx(blocks, options = {}) {
  const encoder = new TextEncoder();
  return zip([
    { name: '[Content_Types].xml', data: encoder.encode(CONTENT_TYPES) },
    { name: '_rels/.rels', data: encoder.encode(ROOT_RELS) },
    { name: 'word/_rels/document.xml.rels', data: encoder.encode(DOCUMENT_RELS) },
    { name: 'word/styles.xml', data: encoder.encode(STYLES) },
    { name: 'word/document.xml', data: encoder.encode(buildDocumentXml(blocks, options)) }
  ]);
}
