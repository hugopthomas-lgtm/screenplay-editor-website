// Script Stats, drawn in the pane's own grammar (white cards on the folder, Geist,
// one colour per figure), at the pane's width. Data from stats-core.js.

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n = (v) => Math.round(v || 0).toLocaleString('en-US');
const pct = (v) => Math.round(v || 0) + '%';
const pages = (v) => { const x = Math.round((v || 0) * 10) / 10; return (Number.isInteger(x) ? String(x) : x.toFixed(1)) + (x === 1 ? ' page' : ' pages'); };

function bar(parts) {
  const total = parts.reduce((s, p) => s + p.v, 0) || 1;
  return `<div class="sv-bar">${parts.filter((p) => p.v > 0).map((p) => `<span style="width:${(p.v / total * 100).toFixed(1)}%;background:${p.c}"></span>`).join('')}</div>`;
}
function rows(items) {
  return items.map((it) => `<div class="sv-row"><span class="sv-dot" style="background:${it.c}"></span><span class="sv-row-lb">${esc(it.l)}</span><span class="sv-row-v">${esc(it.r)}</span></div>`).join('');
}

export function renderStatsView(el, d, h) {
  const o = d.overview || {}; const s = d.sceneStats || {};
  const chars = d.characters || []; const locs = d.locations || [];
  const intext = [{ l: 'Interior', v: s.intCount || 0, c: '#0ea5e9', r: `${n(s.intCount)} scenes` }, { l: 'Exterior', v: s.extCount || 0, c: '#8cc81e', r: `${n(s.extCount)} scenes` }, { l: 'Int / Ext', v: s.intExtCount || 0, c: '#6f57ff', r: `${n(s.intExtCount)} scenes` }];
  const tod = [{ l: 'Day', v: s.dayCount || 0, c: '#facc15', r: `${n(s.dayCount)} scenes` }, { l: 'Night', v: s.nightCount || 0, c: '#334155', r: `${n(s.nightCount)} scenes` }, { l: 'Dawn / Dusk', v: s.duskCount || 0, c: '#f97316', r: `${n(s.duskCount)} scenes` }, { l: 'Continuous / Later', v: s.otherTodCount || 0, c: '#94a3b8', r: `${n(s.otherTodCount)} scenes` }, { l: 'Unspecified', v: s.unspecifiedTodCount || 0, c: '#d1d5db', r: `${n(s.unspecifiedTodCount)} scenes` }];
  const showAll = !!(h && h.allCharacters);
  const shown = showAll ? chars : chars.slice(0, 8);
  el.innerHTML = `
    <div class="sv-meta"><span>Analyzed just now</span><button class="sv-link" data-sv="refresh">Refresh</button></div>
    <div class="sv-grid">
      <div class="sv-fig"><b>${n(o.pages)}</b><span>${o.pages === 1 ? 'page' : 'pages'}</span></div>
      <div class="sv-fig"><b>${n(o.scenes)}</b><span>scenes</span></div>
      <div class="sv-fig"><b>${n(o.speakingCharacters)}</b><span>speaking cast</span></div>
      <div class="sv-fig"><b>${n(o.uniqueLocations)}</b><span>locations</span></div>
      <div class="sv-fig"><b>${pct(o.dialogueRatio)}</b><span>dialogue</span></div>
      <div class="sv-fig"><b>${pages(s.avgScenePages).replace(/ pages?$/, '')}</b><span>pages per scene</span></div>
    </div>
    <div class="se-label">Scenes</div>
    <div class="sv-card">${bar(intext)}${rows(intext.map((x) => ({ l: x.l, r: x.r, c: x.c })))}</div>
    <div class="sv-card">${bar(tod)}${rows(tod.filter((x) => x.v > 0).map((x) => ({ l: x.l, r: x.r, c: x.c })))}</div>
    ${s.longest ? `<div class="sv-card sv-scene"><span class="sv-kicker">Longest scene</span><b>${pages(s.longest.pages)}</b><span class="sv-slug">${esc(s.longest.slug)}</span><span class="sv-sub">page ${n(s.longest.startPage)}</span></div>` : ''}
    ${s.shortest ? `<div class="sv-card sv-scene"><span class="sv-kicker">Shortest scene</span><b>${pages(s.shortest.pages)}</b><span class="sv-slug">${esc(s.shortest.slug)}</span><span class="sv-sub">page ${n(s.shortest.startPage)}</span></div>` : ''}
    <div class="se-label">Locations</div>
    <div class="sv-card">${locs.length ? locs.map((l) => `<div class="sv-row"><span class="sv-row-lb">${esc(l.name)}</span><span class="sv-row-v">${n(l.scenes)} ${l.scenes === 1 ? 'scene' : 'scenes'} · ${pages(l.pages)}</span></div>`).join('') : '<div class="sv-empty">No location yet.</div>'}</div>
    <div class="se-label">Characters</div>
    <div class="sv-card">${shown.length ? shown.map((c) => `<div class="sv-row sv-row-2"><span class="sv-row-lb">${esc(c.name)}<span class="sv-sub">${n(c.lines)} ${c.lines === 1 ? 'line' : 'lines'} · ${n(c.scenes)} ${c.scenes === 1 ? 'scene' : 'scenes'}</span></span><span class="sv-row-v">${pct(c.dialoguePct)}<span class="sv-sub">of dialogue</span></span></div>`).join('') : '<div class="sv-empty">No dialogue yet.</div>'}
      ${chars.length > 8 ? `<button class="sv-link sv-more" data-sv="more">${showAll ? 'Show top 8' : `Show all ${chars.length}`}</button>` : ''}</div>
    <div class="sv-foot">Pages are estimated at 55 lines each, the industry rule.</div>`;
  el.querySelector('[data-sv="refresh"]').onclick = () => h && h.refresh && h.refresh();
  const more = el.querySelector('[data-sv="more"]'); if (more) more.onclick = () => renderStatsView(el, d, Object.assign({}, h, { allCharacters: !showAll }));
}
