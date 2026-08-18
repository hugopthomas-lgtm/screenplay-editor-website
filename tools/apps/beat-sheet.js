// beat-sheet.js — la feuille de structure.

import { $, escapeHtml, renderTable } from './shared.js';
import { beatsForLength, beatDocumentBlocks } from '../engine/beats.js';
import { buildDocx } from '../engine/docx.js';
import { download } from '../engine/intake.js';

const state = { pages: 100, title: '', pageFormat: 'US' };

function readInputs() {
  const pages = parseInt($('#pages').value, 10);
  state.pages = Number.isFinite(pages) ? Math.min(240, Math.max(5, pages)) : 100;
  state.title = $('#title').value.trim();
  const checked = document.querySelector('input[name="page-format"]:checked');
  state.pageFormat = checked ? checked.value : 'US';
}

function render() {
  const beats = beatsForLength(state.pages);
  renderTable(
    $('#beats'),
    ['Beat', 'Page', 'What happens there'],
    beats.map((b) => [
      `<td><b>${escapeHtml(b.name)}</b></td>`,
      `<td class="num">${b.endPage && b.endPage !== b.page ? `${b.page}–${b.endPage}` : b.page}</td>`,
      `<td>${escapeHtml(b.note)}</td>`
    ])
  );
}

for (const id of ['#pages', '#title']) {
  $(id).addEventListener('input', () => { readInputs(); render(); });
}
for (const radio of document.querySelectorAll('input[name="page-format"]')) {
  radio.addEventListener('change', () => { readInputs(); });
}

$('#download').addEventListener('click', () => {
  readInputs();
  const blocks = beatDocumentBlocks(state.pages, state.title);
  const bytes = buildDocx(blocks, { pageFormat: state.pageFormat });
  const name = state.title ? state.title : 'beat sheet';
  download(bytes, `${name}.docx`,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});

readInputs();
render();
