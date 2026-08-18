// app.js — l'interface du convertisseur.
//
// Tout se passe dans la page : le fichier n'est jamais envoyé nulle part. Ce
// n'est pas seulement une promesse de confidentialité, c'est aussi ce qui
// permet de convertir un scénario de cent pages sans serveur et sans attente.

import { parseFdx } from '../engine/parse-fdx.js';
import { parseFountain } from '../engine/parse-fountain.js';
import { extractLines, linesToBlocks } from '../engine/parse-pdf.js';
import { buildDocx } from '../engine/docx.js';
import { INDENTS, summarize } from '../engine/screenplay.js';
import { warningText, errorText, converterError } from '../engine/messages.js';

const $ = (selector) => document.querySelector(selector);

const state = {
  blocks: null,
  titlePage: null,
  fileName: 'screenplay',
  pageFormat: 'US',
  keepTitlePage: true
};

// Singulier et pluriel : « 1 transitions » dans un rapport de conversion,
// c'est le genre de détail qui fait douter du reste.
const LABELS = {
  SCENE_HEADING: ['scene heading', 'scene headings'],
  ACTION: ['action paragraph', 'action paragraphs'],
  CHARACTER: ['character cue', 'character cues'],
  DIALOGUE: ['dialogue block', 'dialogue blocks'],
  PARENTHETICAL: ['parenthetical', 'parentheticals'],
  TRANSITION: ['transition', 'transitions']
};

function setStatus(message, kind = 'working') {
  const status = $('#status');
  status.hidden = false;
  status.className = `status status-${kind}`;
  status.textContent = message;
}

function hideStatus() {
  $('#status').hidden = true;
}

async function loadPdfjs() {
  const pdfjsLib = await import('../vendor/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/tools/vendor/pdf.worker.mjs';
  return pdfjsLib;
}

function detectKind(file, text) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.fdx')) return 'fdx';
  if (text && text.trimStart().startsWith('<?xml') && text.includes('<FinalDraft')) return 'fdx';
  return 'fountain';
}

async function convert(file) {
  state.fileName = file.name.replace(/\.[^.]+$/, '') || 'screenplay';

  const isPdf = file.name.toLowerCase().endsWith('.pdf');
  let result;

  if (isPdf) {
    setStatus('Reading the PDF…');
    const pdfjsLib = await loadPdfjs();
    const data = new Uint8Array(await file.arrayBuffer());
    const lines = await extractLines(pdfjsLib, data, (ratio) => {
      setStatus(`Reading the PDF… ${Math.round(ratio * 100)}%`);
    });
    setStatus('Reading the columns…');
    result = linesToBlocks(lines);
  } else {
    const text = await file.text();
    const kind = detectKind(file, text);
    setStatus(kind === 'fdx' ? 'Reading the Final Draft file…' : 'Reading the Fountain file…');
    result = kind === 'fdx' ? parseFdx(text) : parseFountain(text);
  }

  state.blocks = result.blocks;
  state.titlePage = result.titlePage || null;
  render(result);
}

function render(result) {
  hideStatus();
  const summary = summarize(state.blocks);

  $('#result').hidden = false;
  $('#dropzone').classList.add('has-result');
  $('#dropzone-title').textContent = 'Converted. You can drop another screenplay here.';

  const counts = Object.entries(LABELS)
    .filter(([type]) => summary.counts[type] > 0)
    .map(([type, [one, many]]) => {
      const n = summary.counts[type];
      return `<li><b>${n}</b> ${n === 1 ? one : many}</li>`;
    })
    .join('');

  $('#report').innerHTML =
    `<ul class="counts">${counts}</ul>` +
    (summary.characters.length
      ? `<p class="characters"><b>${summary.characters.length} ${summary.characters.length === 1 ? 'character' : 'characters'}:</b> ${summary.characters.slice(0, 14).join(', ')}${summary.characters.length > 14 ? ', and more' : ''}</p>`
      : '');

  const warnings = (result.warnings || []).map(warningText).filter(Boolean);
  $('#warnings').innerHTML = warnings.length
    ? `<ul>${warnings.map((w) => `<li>${w}</li>`).join('')}</ul>`
    : '';
  $('#warnings').hidden = warnings.length === 0;

  $('#title-page-row').hidden = !state.titlePage;
  if (state.titlePage) {
    $('#title-page-name').textContent = state.titlePage.title || 'Untitled';
  }

  renderPreview();
}

function renderPreview() {
  const indents = INDENTS[state.pageFormat];
  const preview = $('#preview');
  preview.innerHTML = '';

  for (const block of state.blocks.slice(0, 80)) {
    const p = document.createElement('p');
    const indent = indents[block.type] || indents.ACTION;
    p.className = `pv pv-${block.type.toLowerCase().replace('_', '-')}`;
    p.style.marginLeft = `${indent.left / 72}in`;
    p.style.marginRight = `${indent.right / 72}in`;
    if (block.type === 'TRANSITION') p.style.textAlign = 'right';
    p.textContent = block.text;
    preview.appendChild(p);
  }

  if (state.blocks.length > 80) {
    const more = document.createElement('p');
    more.className = 'pv-more';
    more.textContent = `${state.blocks.length - 80} more blocks follow in the document.`;
    preview.appendChild(more);
  }
}

function download() {
  const bytes = buildDocx(state.blocks, {
    pageFormat: state.pageFormat,
    titlePage: state.keepTitlePage ? state.titlePage : null
  });
  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.fileName}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  $('#next-steps').hidden = false;
  $('#next-steps').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function handleFile(file) {
  if (!file) return;
  if (file.size > 40 * 1024 * 1024) {
    setStatus(errorText(converterError('too-large')), 'error');
    return;
  }
  $('#result').hidden = true;
  try {
    await convert(file);
  } catch (error) {
    console.error(error);
    setStatus(errorText(error), 'error');
  }
}

// ============================================
// Branchements
// ============================================

const input = $('#file');
const dropzone = $('#dropzone');

input.addEventListener('change', () => handleFile(input.files[0]));

dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
  dropzone.classList.add('dragging');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('dragging');
  handleFile(event.dataTransfer.files[0]);
});

$('#download').addEventListener('click', download);

for (const radio of document.querySelectorAll('input[name="page-format"]')) {
  radio.addEventListener('change', () => {
    state.pageFormat = radio.value;
    if (state.blocks) renderPreview();
  });
}

$('#keep-title-page').addEventListener('change', (event) => {
  state.keepTitlePage = event.target.checked;
});
