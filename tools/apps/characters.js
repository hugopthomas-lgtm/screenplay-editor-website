// characters.js — le rapport de personnages.

import { mountScreenplayTool, $, figure, escapeHtml, renderTable } from './shared.js';
import { characters, scenes } from '../engine/analysis.js';
import { buildXlsx } from '../engine/xlsx.js';
import { download } from '../engine/intake.js';

let state = { cast: [], name: 'screenplay' };

mountScreenplayTool((result) => {
  const cast = characters(result.blocks);
  const sceneList = scenes(result.blocks);
  state = { cast, name: result.name };

  const speaking = cast.length;
  const carriers = cast.filter((c) => c.share >= 0.05).length;

  $('#summary').innerHTML =
    figure('Speaking parts', speaking) +
    figure('Scenes', sceneList.length) +
    figure('Carry the film', carriers,
      'Characters holding at least a twentieth of the dialogue.') +
    figure('Words spoken', cast.reduce((sum, c) => sum + c.words, 0).toLocaleString('en'));

  renderTable(
    $('#cast'),
    ['Character', 'Share of dialogue', 'Words', 'Speeches', 'Scenes', 'First', 'Last'],
    cast.map((c) => [
      `<td>${escapeHtml(c.name)}</td>`,
      `<td><span class="share"><i style="width:${Math.max(2, Math.round(c.share * 100))}%"></i></span></td>`,
      `<td class="num">${c.words.toLocaleString('en')}</td>`,
      `<td class="num">${c.cues}</td>`,
      `<td class="num">${c.scenes} <small>/ ${c.totalScenes}</small></td>`,
      `<td class="num">${c.firstScene}</td>`,
      `<td class="num">${c.lastScene}</td>`
    ])
  );
});

$('#download').addEventListener('click', () => {
  if (!state.cast.length) return;
  const bytes = buildXlsx({
    sheetName: 'Characters',
    columns: [
      { label: 'Character', width: 28 },
      { label: 'Share of dialogue', width: 16 },
      { label: 'Words', width: 10 },
      { label: 'Speeches', width: 10 },
      { label: 'Scenes', width: 10 },
      { label: 'First scene', width: 12 },
      { label: 'Last scene', width: 12 }
    ],
    rows: state.cast.map((c) => ({
      cells: [c.name, Math.round(c.share * 1000) / 10, c.words, c.cues, c.scenes, c.firstScene, c.lastScene]
    }))
  });
  download(bytes, `${state.name} characters.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});
