/* ============================================================
   SOURCE UNIQUE DE VÉRITÉ POUR LE PIED DE PAGE.
   Chaque page écrit <site-footer></site-footer> + ce script.
   On le change ICI, il change PARTOUT.

   Pourquoi : au 2026-08-12 il existait VINGT pieds de page
   différents sur 94 pages, dont un en français qui affichait
   « Compare » et « Resources » en anglais. Même histoire que
   le header, même remède. Ne jamais recoder un <footer> dans
   une page.

   Il s'adapte à la langue de la page (<html lang="fr">) et
   expose la profondeur du site : les ressources, les
   comparatifs et les pages par profil, invisibles jusqu'ici.
   ============================================================ */
(function () {
  var VIOLET = '#9D7BEA';
  var INSTALL_EXT = 'https://chromewebstore.google.com/detail/scrrrr-screenplay-editor/cgnainjnmiaimmeephomhkhpcjahmfln';
  var INSTALL_ADDON = 'https://workspace.google.com/marketplace/app/screenplay_editor_script_formatter_for_d/611158558476';

  var IS_FR = (document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('fr') === 0;
  var P = IS_FR ? '/fr' : '';

  var COLS = IS_FR ? [
    ['Le produit', [
      ['Extension Chrome', INSTALL_EXT],
      ['Module Google Docs', INSTALL_ADDON],
      ['Prix', '/fr/pricing'],
      ['Comparer les outils', '/fr/compare'],
      ['Modèle gratuit', '/fr/free-google-docs-screenplay-template']
    ]],
    ['Apprendre', [
      ['Écrire un scénario dans Google Docs', '/fr/resources/how-to-write-screenplay-google-docs'],
      ['Le format du scénario', '/fr/resources/screenplay-format-google-docs'],
      ['Modèles par genre', '/fr/resources'],
      ['Écrire sur Chromebook', '/fr/resources/chromebook'],
      ['Outils gratuits', '/tools'],
      ['Blog', '/fr/blog']
    ]],
    ['Pour qui', [
      ['Écoles et enseignants', '/fr/schools'],
      ['Étudiants en cinéma', '/fr/landing-students'],
      ['Scénaristes en activité', '/fr/landing-professionals'],
      ['Ateliers d’écriture', '/fr/landing-writers-rooms'],
      ['Théâtre', '/fr/landing-theater']
    ]],
    ['Screenplay Editor', [
      ['À propos', '/fr/about'],
      ['Aide', '/fr/support'],
      ['Confidentialité', '/fr/privacy'],
      ['Conditions d’utilisation', '/fr/terms']
    ]]
  ] : [
    ['Product', [
      ['Chrome extension', INSTALL_EXT],
      ['Google Docs add-on', INSTALL_ADDON],
      ['Pricing', '/pricing'],
      ['Compare the tools', '/compare'],
      ['Free template', '/free-google-docs-screenplay-template']
    ]],
    ['Learn', [
      ['Write a screenplay in Google Docs', '/resources/how-to-write-screenplay-google-docs'],
      ['Screenplay format', '/resources/screenplay-format-google-docs'],
      ['Genre templates', '/resources'],
      ['Write on a Chromebook', '/resources/chromebook'],
      ['Free tools', '/tools'],
      ['Blog', '/blog']
    ]],
    ['Who it is for', [
      ['Schools and teachers', '/schools'],
      ['Film students', '/landing-students'],
      ['Working screenwriters', '/landing-professionals'],
      ['Writers rooms', '/landing-writers-rooms'],
      ['Playwrights', '/landing-theater']
    ]],
    ['Screenplay Editor', [
      ['About', '/about'],
      ['Support', '/support'],
      ['Privacy Policy', '/privacy'],
      ['Terms of Service', '/terms']
    ]]
  ];

  var TAG = IS_FR
    ? 'Le format professionnel du scénario, dans les Google&nbsp;Docs que vous avez déjà.'
    : 'Industry-standard screenplay formatting, inside the Google&nbsp;Docs you already have.';
  var MADE = IS_FR
    ? '&copy; ' + new Date().getFullYear() + ' Screenplay Editor. Fait par un scénariste, pour les scénaristes.'
    : '&copy; ' + new Date().getFullYear() + ' Screenplay Editor. Made by a screenwriter, for screenwriters.';
  var SWITCH = IS_FR ? ['English', '/'] : ['Français', '/fr/'];

  function colHtml(c) {
    return '<div class="col"><h3>' + c[0] + '</h3><ul>' +
      c[1].map(function (l) {
        var ext = l[1].indexOf('http') === 0;
        return '<li><a href="' + l[1] + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + l[0] + '</a></li>';
      }).join('') + '</ul></div>';
  }

  class SiteFooter extends HTMLElement {
    connectedCallback() {
      var root = this.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<style>' +
        ':host{display:block;}' +
        /* Le pied de page est un objet posé sur la page, pas une bande qui
           la termine : une dalle noire à grands arrondis, détachée des
           bords. La marque y prend enfin sa taille réelle. */
        ".shell{background:#FAFAFA;padding:52px 20px 20px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;}" +
        '.wrap{background:#141416;color:#fff;border-radius:40px;padding:66px 60px 30px;' +
        'max-width:1240px;margin:0 auto;overflow:hidden;}' +
        '.inner{display:grid;grid-template-columns:minmax(260px,1.05fr) auto;gap:56px;align-items:start;}' +

        '.brand{min-width:0;}' +
        '.brand .logo{font-family:inherit;font-size:clamp(58px,8.4vw,132px);font-weight:800;' +
        'letter-spacing:-0.045em;line-height:0.84;color:#fff;text-decoration:none;display:block;}' +
        '.brand .logo .dot{color:' + VIOLET + ';margin-left:-0.07em;}' +
        '.brand p{margin:26px 0 0;font-size:14px;line-height:1.65;color:rgba(255,255,255,.42);max-width:300px;}' +
        '.brand .lang{margin-top:20px;display:inline-block;font-size:13px;color:rgba(255,255,255,.55);' +
        'text-decoration:none;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 16px;transition:border-color .2s,color .2s;}' +
        '.brand .lang:hover{color:#fff;border-color:rgba(255,255,255,.45);}' +

        '.cols{display:grid;grid-template-columns:repeat(4,minmax(140px,auto));gap:34px;}' +
        '.col h3{font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:' + VIOLET + ';margin:6px 0 16px;}' +
        '.col ul{list-style:none;margin:0;padding:0;}' +
        '.col li{margin-bottom:10px;}' +
        '.col a{font-size:14px;line-height:1.5;color:rgba(255,255,255,.62);text-decoration:none;transition:color .2s;}' +
        '.col a:hover{color:#fff;}' +

        '.base{margin-top:54px;padding-top:22px;border-top:1px solid rgba(255,255,255,.08);' +
        'display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;}' +
        '.base p{font-size:12px;color:rgba(255,255,255,.3);margin:0;}' +
        '.base a{font-size:12px;color:rgba(255,255,255,.3);text-decoration:none;}' +
        '.base a:hover{color:rgba(255,255,255,.65);}' +

        '@media(max-width:1040px){.inner{grid-template-columns:1fr;gap:44px;}' +
        '.cols{grid-template-columns:repeat(4,minmax(0,1fr));}.wrap{padding:52px 40px 26px;border-radius:32px;}}' +
        '@media(max-width:720px){.cols{grid-template-columns:1fr 1fr;gap:30px 24px;}' +
        '.wrap{padding:44px 26px 24px;border-radius:26px;}.shell{padding:34px 12px 12px;}' +
        '.brand .logo{font-size:clamp(52px,15vw,80px);}}' +
        '</style>' +
        '<div class="shell"><div class="wrap">' +
        '<div class="inner">' +
        '<div class="brand">' +
        '<a class="logo" href="' + (IS_FR ? '/fr/' : '/') + '">scrrrr<span class="dot">.</span></a>' +
        '<p>' + TAG + '</p>' +
        '<a class="lang" href="' + SWITCH[1] + '">' + SWITCH[0] + '</a>' +
        '</div>' +
        '<div class="cols">' + COLS.map(colHtml).join('') + '</div>' +
        '</div>' +
        '<div class="base"><p>' + MADE + '</p>' +
        '<a href="mailto:hugopthomas@gmail.com">hugopthomas@gmail.com</a></div>' +
        '</div></div>';
    }
  }

  if (!customElements.get('site-footer')) customElements.define('site-footer', SiteFooter);
})();

/* ------------------------------------------------------------------
   LE BOUTON NOMME LE NAVIGATEUR DU VISITEUR (13/09/2026)

   Hugo, 12/09 : « sur le site c'est écrit get for chrome, donc les gens qui
   ont Edge ne cliquent pas et prennent l'add-on en dessous. Alors qu'en fait
   c'est bon, ils peuvent utiliser l'extension Chrome sur leur Edge. »

   C'est la pratique de toutes les extensions qui vendent : on écrit le nom du
   navigateur qu'on a sous les yeux. Le lien, lui, ne change pas : le Chrome
   Web Store sert Edge, Brave, Opera et Vivaldi.

   Ce bloc vit ici parce que footer.js est le seul script chargé par les 108
   pages : 94 boutons corrigés sans toucher une seule page. On remplace
   seulement le mot « Chrome » dans le texte du bouton, ce qui marche aussi
   bien pour « Add to Chrome » que pour « Ajouter à Chrome ».

   Safari et Firefox ne peuvent pas installer l'extension : chez eux on ne
   touche à rien, « Chrome » est alors une information utile.
   ------------------------------------------------------------------ */
(function () {
  var STORE = 'chromewebstore.google.com';

  function navigateur() {
    var ua = navigator.userAgent || '';
    if (/\bEdg\//.test(ua)) return 'Edge';
    if (/\bOPR\//.test(ua)) return 'Opera';
    if (/Vivaldi/.test(ua)) return 'Vivaldi';
    try { if (navigator.brave) return 'Brave'; } catch (e) {}
    return null;
  }

  function renommer(lien, nom) {
    var noeuds = lien.childNodes;
    for (var i = 0; i < noeuds.length; i++) {
      var n = noeuds[i];
      if (n.nodeType === 3 && n.nodeValue.indexOf('Chrome') !== -1) {
        n.nodeValue = n.nodeValue.replace('Chrome', nom);
        return true;
      }
    }
    return false;
  }

  function ligneCompatible(nom, fr) {
    if (nom === 'Edge') {
      return fr
        ? 'Edge vous demandera d’autoriser les extensions d’autres boutiques : un clic, en haut de la page.'
        : 'Edge will ask you to allow extensions from other stores: one click, at the top of the page.';
    }
    return fr
      ? 'Marche aussi dans Edge, Brave, Opera et Arc.'
      : 'Also works in Edge, Brave, Opera and Arc.';
  }

  function poser() {
    var nom = navigateur();
    var fr = (document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('fr') === 0;

    if (nom) {
      var liens = document.querySelectorAll('a[href*="' + STORE + '"]');
      for (var i = 0; i < liens.length; i++) renommer(liens[i], nom);
    }

    // Le doute se dissipe avant de se former : on dit la compatibilité sous le
    // bouton, dans la rangée qui porte déjà « Free to start » et le reste.
    var rangees = document.querySelectorAll('.hero-trust');
    for (var j = 0; j < rangees.length; j++) {
      if (rangees[j].querySelector('[data-se-compat]')) continue;
      var li = document.createElement('li');
      li.setAttribute('data-se-compat', '1');
      var ck = document.createElement('span');
      ck.className = 'ck';
      ck.textContent = '✓';
      li.appendChild(ck);
      li.appendChild(document.createTextNode(ligneCompatible(nom, fr)));
      rangees[j].appendChild(li);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser);
  else poser();
})();
