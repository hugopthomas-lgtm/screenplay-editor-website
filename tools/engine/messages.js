// messages.js — tout ce que l'utilisateur lit, au même endroit.
//
// Les parseurs ne fabriquent pas de phrases : ils rendent un code et un
// nombre. La raison est simple, le site existe en anglais et en français, et
// un avertissement français apparu sur la page anglaise est exactement le
// genre de détail qui fait douter du sérieux de l'outil.
//
// Pour ajouter la page française : traduire ce fichier et charger la bonne
// variante, rien d'autre à toucher.

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

export const WARNINGS = {
  'dual-dialogue': ({ count }) =>
    `${plural(count, 'passage', 'passages')} of dual dialogue ${count === 1 ? 'was' : 'were'} stacked one under the other, because Google Docs cannot show two columns of dialogue side by side.`,
  'dropped-elements': ({ count }) =>
    `${plural(count, 'element', 'elements')} that belong to Final Draft rather than to the script (cast lists, act markers) ${count === 1 ? 'was' : 'were'} left out.`,
  'page-furniture': ({ count }) =>
    `${plural(count, 'line', 'lines')} of page furniture (page numbers, CONTINUED marks) ${count === 1 ? 'was' : 'were'} removed.`,
  'no-columns': () =>
    'This PDF is not laid out like a screenplay, so the elements were worked out from the words alone. Check the characters and the dialogue before you send the document anywhere.'
};

export const ERRORS = {
  'not-fdx': 'This file does not look like a Final Draft file: there is no FinalDraft tag inside it.',
  'empty-fdx': 'This Final Draft file holds no screenplay text.',
  'empty-file': 'This file is empty, so there is nothing to convert.',
  'empty-pdf': 'This PDF holds no readable line of screenplay.',
  'scanned-pdf':
    'This PDF contains an image and no text. It probably comes from a scan or a photo, so it needs to go through character recognition before it can be converted.',
  'too-large': 'That file is over 40 MB. A screenplay is normally under 5 MB, so this one is probably not a script.',
  unknown: 'Something went wrong while reading that file.'
};

/** Une erreur qui porte son code, pour que l'interface choisisse la phrase. */
export function converterError(code) {
  const error = new Error(ERRORS[code] || ERRORS.unknown);
  error.code = code;
  return error;
}

export function warningText(warning) {
  const build = WARNINGS[warning.code];
  return build ? build(warning) : '';
}

export function errorText(error) {
  if (error && error.code && ERRORS[error.code]) return ERRORS[error.code];
  return (error && error.message) || ERRORS.unknown;
}
