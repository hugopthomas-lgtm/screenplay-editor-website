// The stats as a PDF, drawn in the pane (pdf-lib), one clean page or two.
const n = (v) => Math.round(v || 0).toLocaleString('en-US');
const pct = (v) => Math.round(v || 0) + '%';
const pages = (v) => { const x = Math.round((v || 0) * 10) / 10; return (Number.isInteger(x) ? String(x) : x.toFixed(1)) + (x === 1 ? ' page' : ' pages'); };
const clean = (s) => String(s == null ? '' : s).replace(/[^\x20-\x7E -ÿ]/g, '');

export async function buildStatsPdf(d, title) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612, H = 792, M = 56;
  let page = doc.addPage([W, H]); let y = H - M;
  const ink = rgb(0.11, 0.13, 0.16), muted = rgb(0.45, 0.48, 0.52), violet = rgb(0.44, 0.34, 1);
  const line = (txt, size, f, color, x) => { page.drawText(clean(txt), { x: x || M, y, size, font: f || font, color: color || ink }); };
  const down = (h) => { y -= h; if (y < M) { page = doc.addPage([W, H]); y = H - M; } };
  const heading = (t) => { down(22); line(t.toUpperCase(), 9, bold, violet); down(14); };
  const row = (l, r) => { line(l, 10.5); page.drawText(clean(r), { x: W - M - font.widthOfTextAtSize(clean(r), 10.5), y, size: 10.5, font, color: muted }); down(16); };

  line(title || 'Screenplay', 20, bold); down(16);
  line('Script Stats', 10.5, font, muted); down(8);
  const o = d.overview || {}, s = d.sceneStats || {};
  heading('Overview');
  const figs = [[n(o.pages), o.pages === 1 ? 'page' : 'pages'], [n(o.scenes), 'scenes'], [n(o.speakingCharacters), 'speaking cast'], [n(o.uniqueLocations), 'locations'], [pct(o.dialogueRatio), 'dialogue'], [pages(s.avgScenePages).replace(/ pages?$/, ''), 'pages per scene']];
  const colW = (W - 2 * M) / 6;
  figs.forEach((f, i) => { const x = M + i * colW; page.drawText(f[0], { x, y, size: 20, font: bold, color: ink }); page.drawText(f[1], { x, y: y - 14, size: 8.5, font, color: muted }); });
  down(40);
  heading('Scenes');
  row('Interior', `${n(s.intCount)} scenes`); row('Exterior', `${n(s.extCount)} scenes`); if (s.intExtCount) row('Int / Ext', `${n(s.intExtCount)} scenes`);
  down(6);
  row('Day', `${n(s.dayCount)} scenes`); row('Night', `${n(s.nightCount)} scenes`); if (s.duskCount) row('Dawn / Dusk', `${n(s.duskCount)} scenes`); if (s.otherTodCount) row('Continuous / Later', `${n(s.otherTodCount)} scenes`); if (s.unspecifiedTodCount) row('Unspecified', `${n(s.unspecifiedTodCount)} scenes`);
  if (s.longest) { down(6); row(`Longest: ${s.longest.slug}`, `${pages(s.longest.pages)}, page ${n(s.longest.startPage)}`); }
  if (s.shortest) row(`Shortest: ${s.shortest.slug}`, `${pages(s.shortest.pages)}, page ${n(s.shortest.startPage)}`);
  heading('Locations');
  (d.locations || []).forEach((l) => row(l.name, `${n(l.scenes)} ${l.scenes === 1 ? 'scene' : 'scenes'} · ${pages(l.pages)}`));
  heading('Characters');
  (d.characters || []).forEach((c) => row(c.name, `${n(c.lines)} lines · ${n(c.words)} words · ${n(c.scenes)} scenes · ${pct(c.dialoguePct)} of dialogue`));
  down(10); line('Pages estimated at 55 lines each. Made with Screenplay Editor for Word.', 8.5, font, muted);
  return new Blob([await doc.save()], { type: 'application/pdf' });
}
