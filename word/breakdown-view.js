// Production Breakdown, drawn in the pane: one card per scene, chips per category.
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const CATS = [['cast', 'Cast'], ['extras', 'Extras'], ['props', 'Props'], ['set_dressing', 'Set dressing'], ['wardrobe', 'Wardrobe'], ['hair_makeup', 'Hair & makeup'], ['vehicles', 'Vehicles'], ['sfx', 'SFX'], ['vfx', 'VFX'], ['stunts', 'Stunts'], ['animals', 'Animals'], ['sound_music', 'Sound & music']];

export function renderBreakdown(el, data) {
  const scenes = data.scenes || [];
  const note = data.limited ? `<div class="sv-foot">Free plan: the first ${data.sceneLimit} scenes of ${data.totalScenes}. Pro breaks down the whole script.</div>` : '';
  el.innerHTML = `<div class="sv-meta"><span>${scenes.length} ${scenes.length === 1 ? 'scene' : 'scenes'} broken down</span><span class="sv-sub">The spreadsheet is on its way to your Downloads.</span></div>` +
    scenes.map((s, i) => {
      const meta = [s.int_ext, s.location, s.time_of_day].filter(Boolean).join(' · ');
      const cats = CATS.filter(([k]) => s.elements && s.elements[k] && s.elements[k].length).map(([k, label]) => `<div class="bd-cat"><span class="bd-cat-lb">${label}</span><span class="bd-cat-items">${s.elements[k].map((x) => `<span class="bd-chip">${esc(x)}</span>`).join('')}</span></div>`).join('');
      return `<details class="sv-card bd-scene"${i === 0 ? ' open' : ''}><summary><span class="bd-num">${s.scene_number || i + 1}</span><span class="bd-heading">${esc(s.heading)}</span></summary>${s.synopsis ? `<div class="bd-synopsis">${esc(s.synopsis)}</div>` : ''}${meta ? `<div class="sv-sub">${esc(meta)}</div>` : ''}${cats || '<div class="sv-empty">Nothing to prepare.</div>'}</details>`;
    }).join('') + note;
}
