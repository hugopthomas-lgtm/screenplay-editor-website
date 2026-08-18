// shared.js — ce que toutes les pages d'outils font pareil.
//
// Recevoir un fichier, dire où on en est, afficher une erreur lisible, replier
// la zone de dépôt une fois le travail fait. Écrit une fois.

import { readScreenplay, wireDropzone } from '../engine/intake.js';
import { errorText, warningText } from '../engine/messages.js';

export const $ = (selector) => document.querySelector(selector);

export function setStatus(message, kind = 'working') {
  const status = $('#status');
  if (!status) return;
  status.hidden = false;
  status.className = `status status-${kind}`;
  status.textContent = message;
}

export function hideStatus() {
  const status = $('#status');
  if (status) status.hidden = true;
}

export function showWarnings(warnings) {
  const box = $('#warnings');
  if (!box) return;
  const texts = (warnings || []).map(warningText).filter(Boolean);
  box.innerHTML = texts.length ? `<ul>${texts.map((w) => `<li>${w}</li>`).join('')}</ul>` : '';
  box.hidden = texts.length === 0;
}

/**
 * Monte une page qui commence par un scénario déposé.
 * @param {(result: Object) => void} render appelé avec le scénario lu
 */
export function mountScreenplayTool(render) {
  const dropzone = $('#dropzone');
  const input = $('#file');
  const title = $('#dropzone-title');

  const onFile = async (file) => {
    $('#result').hidden = true;
    try {
      const result = await readScreenplay(file, (message) => setStatus(message));
      hideStatus();
      render(result);
      $('#result').hidden = false;
      dropzone.classList.add('has-result');
      if (title) title.textContent = 'Done. You can drop another screenplay here.';
    } catch (error) {
      console.error(error);
      setStatus(errorText(error), 'error');
    }
  };

  wireDropzone({ dropzone, input, onFile });
}

/** Un grand chiffre avec son étiquette. */
export function figure(label, value, note) {
  return (
    '<div class="figure">' +
    `<p class="k">${label}</p>` +
    `<p class="v">${value}</p>` +
    (note ? `<p class="note">${note}</p>` : '') +
    '</div>'
  );
}

export const escapeHtml = (text) =>
  String(text === null || text === undefined ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Rend un tableau à partir d'en-têtes et de lignes déjà échappées. */
export function renderTable(element, headers, rows) {
  element.innerHTML =
    `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>` +
    `<tbody>${rows.map((cells) => `<tr>${cells.join('')}</tr>`).join('')}</tbody>`;
}
