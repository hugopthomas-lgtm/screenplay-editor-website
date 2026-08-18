// breakdown.js — la feuille de dépouillement.

import { mountScreenplayTool, $, showWarnings, escapeHtml, renderTable } from './shared.js';
import { scenes } from '../engine/analysis.js';
import { buildXlsx, breakdownTable } from '../engine/xlsx.js';
import { download } from '../engine/intake.js';

let state = { scenes: [], name: 'screenplay' };

const count = (n, one, many) => `<li><b>${n}</b> ${n === 1 ? one : many}</li>`;

mountScreenplayTool((result) => {
  const sceneList = scenes(result.blocks).filter((s) => s.heading);
  state = { scenes: sceneList, name: result.name };

  const interiors = sceneList.filter((s) => s.intExt === 'INT').length;
  const exteriors = sceneList.filter((s) => s.intExt === 'EXT').length;
  const nights = sceneList.filter((s) => /NIGHT|NUIT|DUSK|DAWN|SOIR|AUBE/i.test(s.time)).length;
  const locations = new Set(sceneList.map((s) => s.location).filter(Boolean));

  $('#report').innerHTML =
    '<ul class="counts">' +
    count(sceneList.length, 'scene', 'scenes') +
    count(locations.size, 'location', 'locations') +
    count(interiors, 'interior', 'interiors') +
    count(exteriors, 'exterior', 'exteriors') +
    count(nights, 'night scene', 'night scenes') +
    '</ul>' +
    '<p class="muted">Night scenes and exteriors carry their own colour in the sheet, because those are the ones that cost money.</p>';

  showWarnings(result.warnings);

  renderTable(
    $('#scenes'),
    ['#', 'Heading', 'Int / Ext', 'Time', 'Page', 'Length', 'Cast'],
    sceneList.slice(0, 120).map((s) => [
      `<td class="num">${s.number}</td>`,
      `<td>${escapeHtml(s.heading)}</td>`,
      `<td>${escapeHtml(s.intExt)}</td>`,
      `<td>${escapeHtml(s.time)}</td>`,
      `<td class="num">${s.startPage}</td>`,
      `<td class="num">${s.pages}</td>`,
      `<td>${escapeHtml(s.characters.slice(0, 5).join(', '))}</td>`
    ])
  );
});

$('#download').addEventListener('click', () => {
  if (!state.scenes.length) return;
  const bytes = buildXlsx(breakdownTable(state.scenes));
  download(bytes, `${state.name} breakdown.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});
