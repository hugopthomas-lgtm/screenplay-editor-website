// intake.js — recevoir un scénario, quel que soit son format.
//
// Six outils sur huit commencent pareil : on dépose un fichier, il faut
// deviner ce que c'est, le lire, et rendre des blocs typés. Écrire ça une
// seule fois évite que le convertisseur et le vérificateur ne se mettent à
// lire le même PDF de deux façons différentes.

import { parseFdx } from './parse-fdx.js';
import { parseFountain } from './parse-fountain.js';
import { extractLines, linesToBlocks } from './parse-pdf.js';
import { parseOsf } from './parse-osf.js';
import { parseDocxXml } from './parse-docx.js';
import { parseCeltx } from './parse-celtx.js';
import { unzip } from './unzip.js';
import { converterError } from './messages.js';

export const ACCEPT = '.pdf,.fdx,.fountain,.spmd,.txt,.fadein,.osf,.docx,.celtx,.highland';
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

/** Un ZIP commence toujours par PK, quel que soit le nom du fichier. */
async function isZip(file) {
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
}

/**
 * Quatre formats de scénario sont des archives ZIP, et l'extension ment
 * souvent (un .fadein renommé, un .docx téléchargé sous un autre nom). On
 * regarde donc ce qu'il y a DEDANS, pas comment le fichier s'appelle.
 */
async function readZipped(data, name, onProgress) {
  const files = await unzip(data);
  const decode = (bytes) => new TextDecoder().decode(bytes);

  if (files.has('word/document.xml')) {
    onProgress('Reading the document…');
    return { ...parseDocxXml(decode(files.get('word/document.xml'))), kind: 'docx' };
  }

  if (files.has('document.xml')) {
    onProgress('Reading the Fade In file…');
    return { confident: true, ...parseOsf(decode(files.get('document.xml'))), kind: 'fadein' };
  }

  // Highland range un fichier Fountain dans une archive.
  for (const [entry, bytes] of files) {
    if (/\.(fountain|spmd|txt)$/i.test(entry)) {
      onProgress('Reading the Highland file…');
      return { confident: true, ...parseFountain(decode(bytes)), kind: 'highland' };
    }
  }

  onProgress('Reading the Celtx project…');
  return { ...(await parseCeltx(data)), kind: 'celtx' };
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

  if (await isZip(file)) {
    const data = new Uint8Array(await file.arrayBuffer());
    const result = await readZipped(data, name, onProgress);
    return { confident: true, warnings: [], ...result, name, pages: null };
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
