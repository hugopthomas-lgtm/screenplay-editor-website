// Importers: Final Draft (.fdx), Fade In (.fadein), Celtx (.celtx) → [{ type, text }],
// with the element types the files carry (no guessing). Ported from the extension's
// converters (sidepanel-app.js fdxToFountain_, fadeInXmlToFountain_, celtxToFountain_),
// but typed instead of flattened to text.

const UNESC = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const STRIP = /<[^>]+>/g;

function typeOf(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('scene')) return 'SCENE_HEADING';
  if (n.includes('character')) return 'CHARACTER';
  if (n.includes('parenthetical')) return 'PARENTHETICAL';
  if (n.includes('dialog')) return 'DIALOGUE';
  if (n.includes('transition')) return 'TRANSITION';
  return 'ACTION';
}
function paren(t) { let s = t; if (!s.startsWith('(')) s = '(' + s; if (!s.endsWith(')')) s += ')'; return s; }

export function parseFdx(xml) {
  const out = [];
  const paraRe = /<Paragraph[^>]*Type="([^"]*)"[^>]*>([\s\S]*?)<\/Paragraph>/gi;
  const textRe = /<Text[^>]*>([\s\S]*?)<\/Text>/gi;
  let m;
  while ((m = paraRe.exec(xml)) !== null) {
    const parts = []; let t; textRe.lastIndex = 0;
    while ((t = textRe.exec(m[2])) !== null) parts.push(t[1].replace(STRIP, ''));
    const text = UNESC(parts.join('')).trim();
    if (!text) continue;
    const type = typeOf(m[1]);
    out.push({ type, text: type === 'PARENTHETICAL' ? paren(text) : text });
  }
  return out;
}

export function parseFadeIn(xml) {
  const out = [];
  const paraRe = /<para[^>]*>([\s\S]*?)<\/para>/g;
  const styleRe = /basestyle(?:name)?="([^"]+)"/;
  const textRe = /<text[^>]*>([\s\S]*?)<\/text>/;
  let m;
  while ((m = paraRe.exec(xml)) !== null) {
    const sm = styleRe.exec(m[1]); const tm = textRe.exec(m[1]);
    const text = UNESC(tm ? tm[1].replace(STRIP, '') : '').trim();
    if (!text) continue;
    const type = typeOf(sm ? sm[1] : 'action');
    out.push({ type, text: type === 'PARENTHETICAL' ? paren(text) : text });
  }
  return out;
}

export function parseCeltx(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = [];
  doc.querySelectorAll('p').forEach((p) => {
    const text = (p.textContent || '').trim();
    if (!text) return;
    const cls = (p.className || '').toLowerCase();
    const type = typeOf(cls.replace('-', '').replace('sceneheading', 'scene'));
    out.push({ type, text: type === 'PARENTHETICAL' ? paren(text) : text });
  });
  return out;
}

// A zip (.fadein, .celtx) → the inner file we parse.
export async function unzipEntry(buffer, pick) {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files);
  const name = names.find(pick);
  if (!name) throw new Error('No screenplay inside this file.');
  return zip.file(name).async('string');
}
