// xml.js — un lecteur XML minimal, juste ce qu'il faut pour un .fdx.
//
// Pourquoi ne pas utiliser DOMParser : il n'existe pas dans Node, et je veux que
// le parseur FDX soit testable hors navigateur. Un .fdx est produit par une
// machine (Final Draft), donc bien formé et sans surprise : un lecteur de 80
// lignes suffit et évite d'embarquer une bibliothèque.

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '
};

export function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X'
        ? parseInt(body.slice(2), 16)
        : parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    const known = ENTITIES[body.toLowerCase()];
    return known === undefined ? whole : known;
  });
}

function parseAttributes(raw) {
  const attrs = {};
  const re = /([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(raw))) {
    attrs[m[1]] = decodeEntities(m[3] !== undefined ? m[3] : m[4]);
  }
  return attrs;
}

/**
 * Transforme du XML en arbre : { name, attrs, children: [node|string] }.
 * Les nœuds texte sont des chaînes. Commentaires et instructions sont ignorés.
 *
 * @param {string} source
 * @returns {{name: string, attrs: Object, children: Array}} la racine
 */
export function parseXml(source) {
  const root = { name: '#root', attrs: {}, children: [] };
  const stack = [root];
  let i = 0;

  const pushText = (text) => {
    if (!text) return;
    stack[stack.length - 1].children.push(decodeEntities(text));
  };

  while (i < source.length) {
    const lt = source.indexOf('<', i);
    if (lt === -1) { pushText(source.slice(i)); break; }
    pushText(source.slice(i, lt));

    if (source.startsWith('<!--', lt)) {
      const end = source.indexOf('-->', lt);
      i = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', lt)) {
      const end = source.indexOf(']]>', lt);
      const stop = end === -1 ? source.length : end;
      stack[stack.length - 1].children.push(source.slice(lt + 9, stop));
      i = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith('<?', lt) || source.startsWith('<!', lt)) {
      const end = source.indexOf('>', lt);
      i = end === -1 ? source.length : end + 1;
      continue;
    }

    const gt = source.indexOf('>', lt);
    if (gt === -1) break;
    const inner = source.slice(lt + 1, gt);

    if (inner[0] === '/') {
      const name = inner.slice(1).trim();
      for (let d = stack.length - 1; d > 0; d--) {
        if (stack[d].name === name) { stack.length = d; break; }
      }
      i = gt + 1;
      continue;
    }

    const selfClosing = inner.endsWith('/');
    const body = selfClosing ? inner.slice(0, -1) : inner;
    const space = body.search(/\s/);
    const name = space === -1 ? body : body.slice(0, space);
    const node = {
      name,
      attrs: space === -1 ? {} : parseAttributes(body.slice(space)),
      children: []
    };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
    i = gt + 1;
  }

  return root;
}

/** Tous les descendants portant ce nom, dans l'ordre du document. */
export function findAll(node, name, out = []) {
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    if (child.name === name) out.push(child);
    findAll(child, name, out);
  }
  return out;
}

/** Le texte concaténé d'un nœud et de sa descendance. */
export function textOf(node) {
  let out = '';
  for (const child of node.children) {
    out += typeof child === 'string' ? child : textOf(child);
  }
  return out;
}
