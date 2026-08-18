// poster.js — une affiche depuis le scénario.

import { mountScreenplayTool, $, escapeHtml, setStatus } from './shared.js';
import { buildDigest, digestSummary } from '../engine/digest.js';

const API = 'https://screenplay-editor-api.hugopthomas.workers.dev/web/poster';
let digest = null;

mountScreenplayTool((result) => {
  digest = buildDigest(result.blocks, { title: result.name });
  $('#title').value = digest.title;
  $('#leaving').textContent = digestSummary(digest);
  $('#make').disabled = false;
  $('#poster').innerHTML = '';
});

$('#make').addEventListener('click', async () => {
  if (!digest) return;
  const button = $('#make');
  button.disabled = true;
  setStatus('Reading your script, then drawing. This takes about a minute.');

  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...digest,
        title: $('#title').value.trim() || digest.title,
        pitch: $('#pitch').value.trim()
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'It did not work.');

    $('#status').hidden = true;
    $('#poster').innerHTML =
      `<img src="${data.posterUrl}" alt="Poster for ${escapeHtml($('#title').value || digest.title)}">` +
      (data.tagline ? `<p class="tagline">${escapeHtml(data.tagline)}</p>` : '') +
      '<p class="muted">Right click to save it. It is yours, and it is not the film, so treat it as a sketch of one.</p>';
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});
