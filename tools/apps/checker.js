// checker.js — le vérificateur de format.

import { mountScreenplayTool, $, figure, escapeHtml } from './shared.js';
import { checkFormat, formatDuration } from '../engine/analysis.js';

const LEVEL_LABEL = { stop: 'Fix this', look: 'Have a look' };

mountScreenplayTool((result) => {
  const { findings, timing, sceneCount } = checkFormat(result.blocks, {
    pages: result.pages,
    geometry: result.geometry || null
  });

  const stops = findings.filter((f) => f.level === 'stop').length;

  $('#summary').innerHTML =
    figure('Verdict',
      stops ? `${stops} to fix` : findings.length ? 'Nearly there' : 'Clean',
      stops
        ? 'These are the ones a reader notices before reading.'
        : findings.length
          ? 'Nothing blocking, a few things worth a look.'
          : 'Nothing to flag. Send it.') +
    figure('Pages', timing.pages + (timing.pagesAreMeasured ? '' : ' <small>about</small>')) +
    figure('Scenes', sceneCount) +
    figure('Runs about', formatDuration(timing.seconds));

  $('#findings').innerHTML = findings.length
    ? findings.map((f) =>
        '<div class="finding">' +
        `<div class="head"><span class="pill-level ${f.level}">${LEVEL_LABEL[f.level]}</span>` +
        `<h4>${escapeHtml(f.title)}</h4></div>` +
        `<p>${escapeHtml(f.detail)}</p>` +
        (f.where ? `<p class="where">${escapeHtml(f.where)}</p>` : '') +
        '</div>').join('')
    : '<div class="finding"><h4>Nothing to flag.</h4>' +
      '<p>The type, the margins, the headings and the block lengths all read the way a reader expects. ' +
      'That is rarer than it sounds.</p></div>';
});
