// intake.js — recevoir un scénario, quel que soit son format.
//
// Six outils sur huit commencent pareil : on dépose un fichier, il faut
// deviner ce que c'est, le lire, et rendre des blocs typés. Écrire ça une
// seule fois évite que le convertisseur et le vérificateur ne se mettent à
// lire le même PDF de deux façons différentes.

import { parseFdx } from './parse-fdx.js';
import { parseFountain } from './parse-fountain.js';
import { extractLines, linesToBlocks } from './parse-pdf.js';
import { converterError } from './messages.js';

export const ACCEPT = '.pdf,.fdx,.fountain,.spmd,.txt';
export const MAX_BYTES = 40 * 1024 * 1024;

let pdfjsPromise = null;
function loadPdfjs() {
  // Un mégaoctet et demi de bibliothèque : on ne le charge que le jour où
  // quelqu'un dépose vraiment un PDF, et une seule fois par page.
  if (!pdfjsPromise) {
    pdfjsPromise = import('../vendor/pdf.mjs').then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = '/tools/vendor/pdf.worker.mjs';
      return lib;
    });
  }
  return pdfjsPromise;
}

function detectKind(file, text) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.fdx')) return 'fdx';
  if (text && text.trimStart().startsWith('<?xml') && text.includes('<FinalDraft')) return 'fdx';
  return 'fountain';
}

/**
 * Lit un fichier déposé et rend des blocs typés.
 *
 * @param {File} file
 * @param {(message: string) => void} [onProgress] pour tenir le lecteur au courant
 * @returns {Promise<{blocks: Array, titlePage: Object|null, warnings: Array, confident: boolean, kind: string, name: string}>}
 */
export async function readScreenplay(file, onProgress = () => {}) {
  if (file.size > MAX_BYTES) throw converterError('too-large');

  const name = file.name.replace(/\.[^.]+$/, '') || 'screenplay';

  if (file.name.toLowerCase().endsWith('.pdf')) {
    onProgress('Reading the PDF…');
    const pdfjsLib = await loadPdfjs();
    const data = new Uint8Array(await file.arrayBuffer());
    const lines = await extractLines(pdfjsLib, data, (ratio) => {
      onProgress(`Reading the PDF… ${Math.round(ratio * 100)}%`);
    });
    onProgress('Reading the columns…');
    const result = linesToBlocks(lines);
    return { ...result, kind: 'pdf', name, pages: Math.max(...lines.map((l) => l.page)) };
  }

  const text = await file.text();
  const kind = detectKind(file, text);
  onProgress(kind === 'fdx' ? 'Reading the Final Draft file…' : 'Reading the Fountain file…');
  const result = kind === 'fdx' ? parseFdx(text) : parseFountain(text);
  return { confident: true, ...result, kind, name, pages: null };
}

/**
 * Branche une zone de dépôt et un champ fichier sur un traitement.
 * Chaque page d'outil se contente de dire quoi faire du résultat.
 *
 * @param {{dropzone: Element, input: HTMLInputElement, onFile: (file: File) => Promise<void>}} config
 */
export function wireDropzone({ dropzone, input, onFile }) {
  input.addEventListener('change', () => {
    if (input.files[0]) onFile(input.files[0]);
  });

  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('dragging');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragging');
    if (event.dataTransfer.files[0]) onFile(event.dataTransfer.files[0]);
  });
}

/** Propose un fichier au téléchargement, sans laisser fuir l'URL objet. */
export function download(bytes, filename, mime) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
