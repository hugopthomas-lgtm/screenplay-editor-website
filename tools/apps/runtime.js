// runtime.js — le minutage.

import { mountScreenplayTool, $, figure } from './shared.js';
import { runtime, formatDuration, SECONDS_PER_PAGE, DIALOGUE_WPM } from '../engine/analysis.js';

mountScreenplayTool((result) => {
  const t = runtime(result.blocks, { pages: result.pages });
  const spokenPercent = Math.round(t.spokenShareOfRuntime * 100);

  $('#summary').innerHTML =
    figure('It runs about', formatDuration(t.seconds),
      `Somewhere between ${formatDuration(t.lowSeconds)} and ${formatDuration(t.highSeconds)}.`) +
    figure('Pages', t.pages + (t.pagesAreMeasured ? '' : ' <small>about</small>'),
      t.pagesAreMeasured ? 'Counted in the file itself.' : 'Estimated from the text, since this format has no pages.');

  $('#split').innerHTML =
    figure('People talking', formatDuration(t.spokenSeconds),
      `${spokenPercent} percent of the running time, over ${t.dialogueWords.toLocaleString('en')} words.`) +
    figure('Everything else', formatDuration(Math.max(0, t.seconds - t.spokenSeconds)),
      'Action, silence, looks, and every beat your script does not spell out.') +
    figure('Dialogue on the page', Math.round(t.spokenShare * 100) + ' <small>%</small>',
      'The share of your pages taken up by speech. Past 70 percent a reader calls it talky.');

  // Dire de quel côté ça penche vaut mieux qu'une fourchette muette : c'est
  // vérifié sur The Teachers' Lounge, 76 % de dialogue, annoncé 1 h 21 et
  // joué 1 h 38 à l'écran.
  const lean = t.spokenShare > 0.7
    ? `Your script is ${Math.round(t.spokenShare * 100)} percent dialogue on the page, which is a lot. Scripts that lean this far usually play at the top of that range or past it, so take the higher end.`
    : t.spokenShare < 0.35
      ? `Only ${Math.round(t.spokenShare * 100)} percent of your pages are speech, so this one leans towards action. Scripts that lean this way usually come in at the lower end of the range.`
      : 'Your script has a normal balance of dialogue and action, which is where the page rule is at its most reliable.';

  $('#method').textContent =
    lean + ' ' +
    `Method: a page counts as ${SECONDS_PER_PAGE} seconds, which is the average measured across thousands of finished films, ` +
    `and speech is counted at ${DIALOGUE_WPM} words a minute. The range is 15 percent either way, because that is how far ` +
    'the page rule drifts once a script leans towards dialogue or towards action.';
});
