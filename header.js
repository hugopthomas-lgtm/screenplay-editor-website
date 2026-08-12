/* ============================================================
   SINGLE SOURCE OF TRUTH FOR THE SITE HEADER.
   Every page uses <site-header></site-header> + this script.
   Change it HERE, it changes EVERYWHERE. Never edit a header
   inside a page again.

   Shape: a floating pill (same idea as uccello.app) — a capsule
   centred at the top of the viewport, translucent + blurred, that
   slides away when you scroll down and comes back when you scroll up.
   ============================================================ */
(function () {
  var VIOLET = '#9D7BEA';
  var VIOLET_DARK = '#8B6AD4';
  var INSTALL = 'https://chromewebstore.google.com/detail/scrrrr-screenplay-editor/cgnainjnmiaimmeephomhkhpcjahmfln';

  // Room the pill takes at the top, published as a CSS var so any page can
  // clear it (e.g. breadcrumb: margin-top:var(--site-header-h)). It is the
  // gap above the pill + the pill itself + a little air underneath.
  var HEADER_H = 86; // px (14 top gap + ~53 pill + 19 air)
  try { document.documentElement.style.setProperty('--site-header-h', HEADER_H + 'px'); } catch (e) {}

  // Nav links. Absolute paths so they work from any folder depth.
  var NAV = [
    ['Pricing', '/pricing.html'],
    ['Schools', '/schools.html'],
    ['Compare', '/compare/'],
    ['About', '/about.html'],
    ['Support', '/support.html']
  ];

  // Version française (page avec lang="fr") : libellés FR, et les pages qui
  // existent en français pointent vers /fr/. Une bascule EN/FR ferme la nav ;
  // le choix est mémorisé (se_lang) pour que l'aiguillage automatique de la
  // page d'accueil respecte le visiteur.
  var IS_FR = (document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('fr') === 0;
  if (IS_FR) {
    NAV = [
      ['Prix', '/fr/pricing.html'],
      ['Écoles', '/fr/schools.html'],
      ['Comparer', '/fr/compare/'],
      ['À propos', '/fr/about.html'],
      ['Aide', '/fr/support.html']
    ];
  }
  // Bascule EN/FR : elle mène à la MÊME page dans l'autre langue quand cette
  // page existe dans les deux, sinon à l'accueil de l'autre langue. Ajouter
  // une ligne ici chaque fois qu'une page est traduite.
  var PAIRS = {
    '/': '/fr/',
    '/pricing.html': '/fr/pricing.html',
    '/about.html': '/fr/about.html',
    '/schools.html': '/fr/schools.html',
    '/support.html': '/fr/support.html',
    '/privacy.html': '/fr/privacy.html',
    '/terms.html': '/fr/terms.html',
    '/compare/': '/fr/compare/',
    '/resources/': '/fr/resources/',
    '/blog/best-dialogue-hack.html': '/fr/blog/best-dialogue-hack.html',
    '/blog/why-feedback-is-hard.html': '/fr/blog/why-feedback-is-hard.html',
    '/blog/best-screenplay-addons-google-docs/': '/fr/blog/best-screenplay-addons-google-docs.html',
    '/free-google-docs-screenplay-template.html': '/fr/free-google-docs-screenplay-template.html',
    '/screenplay-formatter-google-docs.html': '/fr/screenplay-formatter-google-docs.html',
    '/alternative.html': '/fr/alternative.html',
    '/success.html': '/fr/success.html',
    '/cancel.html': '/fr/cancel.html',
    '/picker.html': '/fr/picker.html',
    '/uninstall.html': '/fr/uninstall.html',
    '/uninstall-addon.html': '/fr/uninstall-addon.html',
    '/blog.html': '/fr/blog.html',
    '/landing-beginners.html': '/fr/landing-beginners.html',
    '/landing-budget.html': '/fr/landing-budget.html',
    '/landing-game-writers.html': '/fr/landing-game-writers.html',
    '/landing-international.html': '/fr/landing-international.html',
    '/landing-professionals.html': '/fr/landing-professionals.html',
    '/landing-students.html': '/fr/landing-students.html',
    '/landing-teachers.html': '/fr/landing-teachers.html',
    '/landing-theater.html': '/fr/landing-theater.html',
    '/landing-writers-rooms.html': '/fr/landing-writers-rooms.html',
    '/landing-youtube-creators.html': '/fr/landing-youtube-creators.html',
    '/resources/action-screenplay-template.html': '/fr/resources/action-screenplay-template.html',
    '/resources/chromebook.html': '/fr/resources/chromebook.html',
    '/resources/comedy-screenplay-template.html': '/fr/resources/comedy-screenplay-template.html',
    '/resources/drama-screenplay-template.html': '/fr/resources/drama-screenplay-template.html',
    '/resources/google-docs-vs-final-draft.html': '/fr/resources/google-docs-vs-final-draft.html',
    '/resources/horror-screenplay-template.html': '/fr/resources/horror-screenplay-template.html',
    '/resources/how-to-get-your-short-film-read-by-producers.html': '/fr/resources/how-to-get-your-short-film-read-by-producers.html',
    '/resources/how-to-write-screenplay-google-docs.html': '/fr/resources/how-to-write-screenplay-google-docs.html',
    '/resources/sci-fi-screenplay-template.html': '/fr/resources/sci-fi-screenplay-template.html',
    '/resources/screenplay-format-google-docs.html': '/fr/resources/screenplay-format-google-docs.html',
    '/resources/short-film-screenplay-template.html': '/fr/resources/short-film-screenplay-template.html',
    '/resources/thriller-screenplay-template.html': '/fr/resources/thriller-screenplay-template.html',
    '/resources/tv-pilot-screenplay-template.html': '/fr/resources/tv-pilot-screenplay-template.html',
    '/compare/screenplay-editor-vs-arc-studio.html': '/fr/compare/screenplay-editor-vs-arc-studio.html',
    '/compare/screenplay-editor-vs-celtx.html': '/fr/compare/screenplay-editor-vs-celtx.html',
    '/compare/screenplay-editor-vs-fade-in.html': '/fr/compare/screenplay-editor-vs-fade-in.html',
    '/compare/screenplay-editor-vs-final-draft.html': '/fr/compare/screenplay-editor-vs-final-draft.html',
    '/compare/screenplay-editor-vs-highland.html': '/fr/compare/screenplay-editor-vs-highland.html',
    '/compare/screenplay-editor-vs-screenplay-formatter.html': '/fr/compare/screenplay-editor-vs-screenplay-formatter.html',
    '/compare/screenplay-editor-vs-writersolo.html': '/fr/compare/screenplay-editor-vs-writersolo.html'
  };
  function counterpartHref() {
    var p = location.pathname.replace(/\/index\.html$/, '/');
    if (IS_FR) {
      var en = p.replace(/^\/fr(\/|$)/, '/');
      for (var k in PAIRS) { if (PAIRS[k] === p || k === en) return k; }
      return '/';
    }
    if (!/\.html$/.test(p) && p !== '/' && !/\/$/.test(p)) p += '.html'; // /schools → /schools.html
    return PAIRS[p] || '/fr/';
  }
  var LANG = IS_FR ? ['EN', counterpartHref(), 'en'] : ['FR', counterpartHref(), 'fr'];

  var navHtml = NAV.map(function (n) {
    return '<a href="' + n[1] + '">' + n[0] + '</a>';
  }).join('') +
    '<a class="lang-switch" data-lang="' + LANG[2] + '" href="' + LANG[1] + '">' + LANG[0] + '</a>';

  class SiteHeader extends HTMLElement {
    connectedCallback() {
      var root = this.attachShadow({ mode: 'open' });
      root.innerHTML =
        '<style>' +
        /* The fixed rail: full width, nothing visible, just centres the pill
           and lets clicks through everywhere except on the pill itself. */
        '.rail{position:fixed;top:14px;left:0;right:0;z-index:1000;' +
        'display:flex;flex-direction:column;align-items:center;pointer-events:none;' +
        'transition:transform .45s cubic-bezier(.4,0,.2,1),opacity .35s ease;' +
        "font-family:'JetBrains Mono',monospace;}" +
        '.rail.away{transform:translateY(-160%);opacity:0;}' +

        '.pill{pointer-events:auto;display:flex;align-items:center;' +
        'max-width:calc(100vw - 28px);' +
        /* No outline: the capsule reads by its fill, lighter than the dark
           hero behind it and dark against the light pages. */
        'background:rgba(14,14,16,0.86);-webkit-backdrop-filter:blur(16px) saturate(160%);' +
        'backdrop-filter:blur(16px) saturate(160%);' +
        'border-radius:999px;padding:7px 7px 7px 26px;' +
        'box-shadow:0 6px 26px rgba(0,0,0,0.22);}' +

        ".logo{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;" +
        'font-size:19px;font-weight:700;letter-spacing:0.6px;color:#fff;' +
        'text-decoration:none;cursor:pointer;line-height:1;}' +
        '.logo .dot{color:' + VIOLET + ';}' +

        'nav{display:flex;align-items:center;}' +
        '.nav-links{display:flex;align-items:center;}' +
        'nav a{margin-left:32px;font-size:13px;font-weight:500;color:#a5a5a5;' +
        'text-decoration:none;white-space:nowrap;transition:color .2s;}' +
        'nav a:hover{color:#fff;}' +
        /* The brand is its own block: give it more air than the links get. */
        '.nav-links a:first-child{margin-left:44px;}' +

        '.cta{margin-left:30px;background:' + VIOLET + ';color:#fff;' +
        'display:inline-flex;align-items:center;gap:7px;white-space:nowrap;' +
        'padding:9px 19px;border-radius:999px;font-size:13px;font-weight:600;' +
        'text-decoration:none;}' +
        '.cta{transition:background .3s cubic-bezier(.4,0,.2,1),transform .3s cubic-bezier(.4,0,.2,1);}' +
        '.cta:hover{background:' + VIOLET_DARK + ';transform:translateY(-1px);}' +
        '.cta .flame{width:16px;height:16px;flex-shrink:0;filter:brightness(0) invert(1);}' +

        '.burger{display:none;margin-left:14px;margin-right:6px;width:24px;height:18px;' +
        'background:none;border:0;padding:0;cursor:pointer;position:relative;}' +
        '.burger span{position:absolute;left:0;width:24px;height:2px;background:#fff;border-radius:2px;' +
        'transition:transform .25s ease,opacity .2s ease,top .25s ease;}' +
        '.burger span:nth-child(1){top:2px;}.burger span:nth-child(2){top:8px;}.burger span:nth-child(3){top:14px;}' +
        '.rail.open .burger span:nth-child(1){top:8px;transform:rotate(45deg);}' +
        '.rail.open .burger span:nth-child(2){opacity:0;}' +
        '.rail.open .burger span:nth-child(3){top:8px;transform:rotate(-45deg);}' +

        /* Mobile sheet: a second rounded surface under the pill, same material. */
        '.mobile-menu{display:none;pointer-events:auto;flex-direction:column;' +
        'width:min(340px,calc(100vw - 28px));margin-top:10px;padding:8px;' +
        'background:rgba(40,40,42,0.96);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);' +
        'border-radius:22px;box-shadow:0 10px 34px rgba(0,0,0,0.30);}' +
        '.mobile-menu a{padding:13px 18px;font-size:15px;font-weight:500;color:#ccc;' +
        'border-radius:14px;text-decoration:none;' +
        "font-family:'JetBrains Mono',monospace;}" +
        '.mobile-menu a:active{background:rgba(157,123,234,0.16);color:#fff;}' +

        '@media(max-width:980px){.nav-links{display:none;}.cta{margin-left:18px;}' +
        '.pill{padding:7px 7px 7px 20px;}.burger{display:block;}' +
        '.rail.open .mobile-menu{display:flex;}}' +
        '@media(prefers-reduced-motion:reduce){.rail{transition:none;}}' +
        '</style>' +
        '<div class="rail"><div class="pill">' +
        '<a href="/" class="logo">scrrrr<span class="dot">.</span></a>' +
        '<nav>' +
        '<span class="nav-links">' + navHtml + '</span>' +
        '<a class="cta" href="' + INSTALL + '" target="_blank" rel="noopener">' +
        '<img class="flame" src="/flame.png" alt="" aria-hidden="true">' +
        (IS_FR ? 'Installer' : 'Install') + '</a>' +
        '<button class="burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>' +
        '</nav></div>' +
        '<div class="mobile-menu">' + navHtml + '</div>' +
        '</div>';

      var rail = root.querySelector('.rail');
      var burger = root.querySelector('.burger');
      burger.addEventListener('click', function () {
        var open = rail.classList.toggle('open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });

      // Bascule de langue : mémorise le choix pour que l'aiguillage de la
      // page d'accueil ne renvoie pas le visiteur d'où il vient.
      root.querySelectorAll('.lang-switch').forEach(function (a) {
        a.addEventListener('click', function () {
          try { localStorage.setItem('se_lang', a.getAttribute('data-lang')); } catch (e) {}
        });
      });
      root.querySelectorAll('.mobile-menu a').forEach(function (a) {
        a.addEventListener('click', function () {
          rail.classList.remove('open');
          burger.setAttribute('aria-expanded', 'false');
        });
      });

      // Scrolling down hides the pill, scrolling back up brings it in. Near
      // the top it always stays. Never hide it while the mobile menu is open.
      var lastY = window.pageYOffset || 0;
      var ticking = false;
      function onScroll() {
        var y = window.pageYOffset || 0;
        if (rail.classList.contains('open')) { lastY = y; return; }
        if (y < 90) rail.classList.remove('away');
        else if (y > lastY + 6) rail.classList.add('away');
        else if (y < lastY - 6) rail.classList.remove('away');
        lastY = y;
      }
      window.addEventListener('scroll', function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(function () { ticking = false; onScroll(); });
      }, { passive: true });
    }
  }
  customElements.define('site-header', SiteHeader);

  // Keep any ".now-month" element on the current month/year, so Screenplay
  // Editor's "Last Update" in the comparison tables always reads as freshly
  // maintained. (Competitors' dates stay hardcoded.)
  function fillNow() {
    var months = IS_FR
      ? ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
         'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
      : ['January', 'February', 'March', 'April', 'May', 'June',
         'July', 'August', 'September', 'October', 'November', 'December'];
    var d = new Date();
    var label = months[d.getMonth()] + ' ' + d.getFullYear();
    var els = document.querySelectorAll('.now-month');
    for (var i = 0; i < els.length; i++) els[i].textContent = label;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fillNow);
  else fillNow();
})();
