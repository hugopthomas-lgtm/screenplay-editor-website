// track.js — savoir si les outils gratuits servent à quelque chose.
//
// Quatre chiffres par outil, pas un de plus : la page s'ouvre, un scénario est
// lu, un résultat est emporté, quelqu'un part vers le produit. C'est le
// dernier rapport qui décide si un outil fabrique des utilisateurs.
//
// Rien d'autre ne part d'ici. Pas de cookie, pas d'identifiant, pas de titre
// de scénario, pas d'adresse de page. Le corps de l'envoi tient en deux mots :
// le nom de l'outil et le nom de l'événement. Le scénario, lui, ne quitte
// toujours pas la machine.

const ENDPOINT = 'https://screenplay-editor-api.hugopthomas.workers.dev/web/hit';

const TOOL = (() => {
  const path = location.pathname.replace(/\/+$/, '');
  const name = path.slice(path.lastIndexOf('/') + 1).replace(/\.html$/, '');
  return !name || name === 'tools' ? 'index' : name;
})();

const sent = new Set();

/**
 * @param {'open'|'run'|'done'|'to_product'} event
 * @param {{once?: boolean}} [options] once: ne compter qu'une fois par visite
 */
export function track(event, options = {}) {
  try {
    if (options.once) {
      if (sent.has(event)) return;
      sent.add(event);
    }
    const body = JSON.stringify({ tool: TOOL, event });
    // text/plain : une requête simple, donc aucun appel de contrôle CORS avant.
    // La page n'attend jamais cet envoi.
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'text/plain' }));
    } else {
      fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } });
    }
  } catch {
    // Une mesure ratée ne doit jamais abîmer une page.
  }
}

const PRODUCT_LINK = /workspace\.google\.com\/marketplace|chromewebstore\.google\.com|chrome\.google\.com\/webstore|\/pricing/;

function wire() {
  track('open', { once: true });

  // Un clic sur un lien vers l'add-on, l'extension ou les tarifs. La délégation
  // au document couvre aussi les liens que le pied de page injecte après coup.
  document.addEventListener(
    'click',
    (event) => {
      const link = event.target.closest && event.target.closest('a[href]');
      if (link && PRODUCT_LINK.test(link.getAttribute('href') || '')) {
        track('to_product');
        return;
      }
      // Le bouton qui emporte le résultat, quel que soit l'outil.
      const done = event.target.closest && event.target.closest('#download, [data-track-done]');
      if (done) track('done');
    },
    true
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wire, { once: true });
} else {
  wire();
}
