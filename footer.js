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
      ['Prix', '/fr/pricing.html'],
      ['Comparer les outils', '/fr/compare/'],
      ['Modèle gratuit', '/fr/free-google-docs-screenplay-template.html']
    ]],
    ['Apprendre', [
      ['Écrire un scénario dans Google Docs', '/fr/resources/how-to-write-screenplay-google-docs.html'],
      ['Le format du scénario', '/fr/resources/screenplay-format-google-docs.html'],
      ['Modèles par genre', '/fr/resources/'],
      ['Écrire sur Chromebook', '/fr/resources/chromebook.html'],
      ['Blog', '/fr/blog.html']
    ]],
    ['Pour qui', [
      ['Écoles et enseignants', '/fr/schools.html'],
      ['Étudiants en cinéma', '/fr/landing-students.html'],
      ['Scénaristes en activité', '/fr/landing-professionals.html'],
      ['Ateliers d’écriture', '/fr/landing-writers-rooms.html'],
      ['Théâtre', '/fr/landing-theater.html']
    ]],
    ['Screenplay Editor', [
      ['À propos', '/fr/about.html'],
      ['Aide', '/fr/support.html'],
      ['Confidentialité', '/fr/privacy.html'],
      ['Conditions d’utilisation', '/fr/terms.html']
    ]]
  ] : [
    ['Product', [
      ['Chrome extension', INSTALL_EXT],
      ['Google Docs add-on', INSTALL_ADDON],
      ['Pricing', '/pricing.html'],
      ['Compare the tools', '/compare/'],
      ['Free template', '/free-google-docs-screenplay-template']
    ]],
    ['Learn', [
      ['Write a screenplay in Google Docs', '/resources/how-to-write-screenplay-google-docs'],
      ['Screenplay format', '/resources/screenplay-format-google-docs'],
      ['Genre templates', '/resources/'],
      ['Write on a Chromebook', '/resources/chromebook'],
      ['Blog', '/blog']
    ]],
    ['Who it is for', [
      ['Schools and teachers', '/schools.html'],
      ['Film students', '/landing-students.html'],
      ['Working screenwriters', '/landing-professionals.html'],
      ['Writers rooms', '/landing-writers-rooms.html'],
      ['Playwrights', '/landing-theater.html']
    ]],
    ['Screenplay Editor', [
      ['About', '/about.html'],
      ['Support', '/support.html'],
      ['Privacy Policy', '/privacy.html'],
      ['Terms of Service', '/terms.html']
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
        ".wrap{background:#1a1a1a;color:#fff;padding:62px 30px 34px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;}" +
        '.inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1.4fr repeat(4,1fr);gap:40px 30px;}' +
        ".brand .logo{font-family:inherit;font-size:20px;font-weight:800;" +
        'letter-spacing:0.15px;color:#fff;text-decoration:none;display:inline-block;}' +
        '.brand .logo .dot{color:' + VIOLET + ';}' +
        '.brand p{margin-top:12px;font-size:13px;line-height:1.7;color:rgba(255,255,255,.42);max-width:260px;}' +
        '.brand .lang{margin-top:18px;display:inline-block;font-size:12px;color:rgba(255,255,255,.55);' +
        'text-decoration:none;border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:6px 14px;transition:border-color .2s,color .2s;}' +
        '.brand .lang:hover{color:#fff;border-color:rgba(255,255,255,.45);}' +
        '.col h3{font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:' + VIOLET + ';margin:2px 0 14px;}' +
        '.col ul{list-style:none;margin:0;padding:0;}' +
        '.col li{margin-bottom:9px;}' +
        '.col a{font-size:13.5px;line-height:1.55;color:rgba(255,255,255,.62);text-decoration:none;transition:color .2s;}' +
        '.col a:hover{color:#fff;}' +
        '.base{max-width:1100px;margin:44px auto 0;padding-top:22px;border-top:1px solid rgba(255,255,255,.08);' +
        'display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;}' +
        '.base p{font-size:11.5px;color:rgba(255,255,255,.3);margin:0;}' +
        '.base a{font-size:11.5px;color:rgba(255,255,255,.3);text-decoration:none;}' +
        '.base a:hover{color:rgba(255,255,255,.65);}' +
        '@media(max-width:900px){.inner{grid-template-columns:1fr 1fr;gap:34px 24px;}.brand{grid-column:1 / -1;}}' +
        '@media(max-width:520px){.inner{grid-template-columns:1fr;}.wrap{padding:48px 24px 28px;}}' +
        '</style>' +
        '<div class="wrap"><div class="inner">' +
        '<div class="brand">' +
        '<a class="logo" href="' + (IS_FR ? '/fr/' : '/') + '">scrrrr<span class="dot">.</span></a>' +
        '<p>' + TAG + '</p>' +
        '<a class="lang" href="' + SWITCH[1] + '">' + SWITCH[0] + '</a>' +
        '</div>' +
        COLS.map(colHtml).join('') +
        '</div>' +
        '<div class="base"><p>' + MADE + '</p>' +
        '<a href="mailto:hugopthomas@gmail.com">hugopthomas@gmail.com</a></div>' +
        '</div>';
    }
  }

  if (!customElements.get('site-footer')) customElements.define('site-footer', SiteFooter);
})();
