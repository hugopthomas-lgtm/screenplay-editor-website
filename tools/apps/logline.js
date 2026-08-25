// logline.js — trois loglines écrites depuis le scénario, pas depuis un formulaire.

import { track } from './track.js';
import { mountScreenplayTool, $, figure, escapeHtml, setStatus } from './shared.js';
import { buildDigest, digestToText, digestSummary } from '../engine/digest.js';

const API = 'https://screenplay-editor-api.hugopthomas.workers.dev/web/logline';
let digest = null;

mountScreenplayTool((result) => {
  digest = buildDigest(result.blocks, { title: result.name });

  $('#summary').innerHTML =
    figure('Read from your script', digest.characters.length + ' <small>characters</small>',
      digest.characters.map((c) => c.name).join(', ')) +
    figure('Mostly set in', digest.locations.length + ' <small>places</small>',
      digest.locations.map((l) => l.name).join(', ')) +
    figure('Length', digest.pageCount + ' <small>pages</small>');

  $('#leaving').textContent = digestSummary(digest);
  $('#write').disabled = false;
  $('#loglines').innerHTML = '';
});

$('#write').addEventListener('click', async () => {
  if (!digest) return;
  const button = $('#write');
  button.disabled = true;
  setStatus('Reading your script and writing…');

  try {
    const response = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ digest: digestToText(digest) })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'It did not work.');

    setStatus('');
    $('#status').hidden = true;

    track('done');
    $('#loglines').innerHTML =
      (data.reading ? `<p class="reading">It reads as: ${escapeHtml(data.reading)}</p>` : '') +
      data.loglines.map((line, i) =>
        '<div class="logline">' +
        `<p class="angle">${['The want', 'The pressure', 'The cost'][i] || 'Another angle'}</p>` +
        `<p class="line">${escapeHtml(line)}</p>` +
        '</div>').join('') +
      '<p class="muted">None of these is your logline yet. Take the one that is closest and put your own words in it.</p>';
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});
