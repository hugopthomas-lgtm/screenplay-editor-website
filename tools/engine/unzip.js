// unzip.js — ouvrir une archive ZIP sans bibliothèque.
//
// Trois formats de scénario sont des ZIP : Fade In (.fadein, une archive avec
// un seul document.xml), Highland (.highland, une archive autour d'un fichier
// Fountain) et le .docx que produit Word ou Google Docs. Les lire ouvrait
// jusqu'ici la porte à une dépendance ; le navigateur sait déjà décompresser
// avec DecompressionStream, et Node aussi depuis la version 18.
//
// On lit le répertoire central, pas les en-têtes locaux : lui seul porte des
// tailles fiables, parce qu'une archive écrite au fil de l'eau met les siennes
// dans un descripteur placé APRÈS les données.

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;

function u16(view, at) { return view.getUint16(at, true); }
function u32(view, at) { return view.getUint32(at, true); }

function findEndOfCentralDirectory(view) {
  // Le commentaire final peut faire 65 535 octets, donc on remonte de la fin.
  const max = Math.min(view.byteLength, 65535 + 22);
  for (let i = 22; i <= max; i++) {
    const at = view.byteLength - i;
    if (at < 0) break;
    if (u32(view, at) === SIG_EOCD) return at;
  }
  return -1;
}

async function inflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * @param {Uint8Array|ArrayBuffer} data
 * @returns {Promise<Map<string, Uint8Array>>} nom du fichier vers son contenu
 */
export async function unzip(data) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const eocd = findEndOfCentralDirectory(view);
  if (eocd === -1) throw new Error('not-a-zip');

  const count = u16(view, eocd + 10);
  let at = u32(view, eocd + 16);
  const out = new Map();

  for (let i = 0; i < count; i++) {
    if (u32(view, at) !== SIG_CENTRAL) break;

    const method = u16(view, at + 10);
    const compressedSize = u32(view, at + 20);
    const nameLength = u16(view, at + 28);
    const extraLength = u16(view, at + 30);
    const commentLength = u16(view, at + 32);
    const localAt = u32(view, at + 42);
    const name = new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength));

    // L'en-tête local porte ses propres longueurs de nom et de champ extra,
    // qui ne sont pas forcément celles du répertoire central.
    const localNameLength = u16(view, localAt + 26);
    const localExtraLength = u16(view, localAt + 28);
    const start = localAt + 30 + localNameLength + localExtraLength;
    const raw = bytes.subarray(start, start + compressedSize);

    if (!name.endsWith('/')) {
      out.set(name, method === 0 ? raw : await inflate(raw));
    }

    at += 46 + nameLength + extraLength + commentLength;
  }

  return out;
}

/** Le même, mais rendu en texte. */
export async function unzipText(data, entryName) {
  const files = await unzip(data);
  const bytes = files.get(entryName);
  if (!bytes) throw new Error('missing-entry:' + entryName);
  return new TextDecoder().decode(bytes);
}

/** Le premier fichier dont le nom finit par une des extensions données. */
export function firstEntry(files, extensions) {
  for (const [name, bytes] of files) {
    if (extensions.some((ext) => name.toLowerCase().endsWith(ext))) return { name, bytes };
  }
  return null;
}
