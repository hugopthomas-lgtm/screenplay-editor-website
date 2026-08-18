// title-page.js — la page de titre.
//
// L'aperçu et le document sortent des MÊMES blocs : ce que le visiteur voit à
// l'écran est exactement ce qu'il téléchargera, sinon l'aperçu ment.

import { $ } from './shared.js';
import { buildDocx } from '../engine/docx.js';
import { download } from '../engine/intake.js';

const state = { pageFormat: 'US' };

function readInputs() {
  const checked = document.querySelector('input[name="page-format"]:checked');
  state.pageFormat = checked ? checked.value : 'US';
  return {
    title: $('#title').value.trim(),
    author: $('#author').value.trim(),
    source: $('#source').value.trim(),
    contact: $('#contact').value.trim(),
    withDate: $('#draft-date').checked
  };
}

/** La page de titre telle que le métier la pose, en lignes centrées. */
function titleLines(fields) {
  const lines = [];
  const blank = (n) => { for (let i = 0; i < n; i++) lines.push(''); };

  blank(10);
  lines.push((fields.title || 'UNTITLED').toUpperCase());
  blank(2);
  lines.push('Written by');
  blank(1);
  lines.push(fields.author || 'Your name');
  if (fields.source) { blank(2); lines.push(`Based on ${fields.source}`); }
  return lines;
}

function render() {
  const fields = readInputs();
  const preview = $('#preview');
  preview.innerHTML = '';

  const add = (text, centred) => {
    const p = document.createElement('p');
    p.className = 'pv';
    if (centred) p.style.textAlign = 'center';
    p.textContent = text || ' ';
    preview.appendChild(p);
  };

  for (const line of titleLines(fields)) add(line, true);

  // Le contact vit en bas à gauche, c'est là qu'un lecteur le cherche.
  for (let i = 0; i < 8; i++) add('', false);
  if (fields.withDate) {
    add(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), false);
  }
  for (const line of (fields.contact || '').split('\n')) if (line.trim()) add(line.trim(), false);
}

function blocksFor(fields) {
  const blocks = [];
  const centred = (text) => blocks.push({ type: 'CENTERED', text });
  for (const line of titleLines(fields)) centred(line);
  for (let i = 0; i < 8; i++) blocks.push({ type: 'ACTION', text: '' });
  if (fields.withDate) {
    blocks.push({ type: 'ACTION', text: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) });
  }
  for (const line of (fields.contact || '').split('\n')) {
    if (line.trim()) blocks.push({ type: 'ACTION', text: line.trim() });
  }
  return blocks;
}

for (const id of ['#title', '#author', '#source', '#contact']) {
  $(id).addEventListener('input', render);
}
$('#draft-date').addEventListener('change', render);
for (const radio of document.querySelectorAll('input[name="page-format"]')) {
  radio.addEventListener('change', render);
}

$('#download').addEventListener('click', () => {
  const fields = readInputs();
  const bytes = buildDocx(blocksFor(fields), { pageFormat: state.pageFormat });
  download(bytes, `${fields.title || 'title page'}.docx`,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});

render();
