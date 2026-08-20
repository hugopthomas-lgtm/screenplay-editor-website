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
    ['Pricing', '/pricing'],
    ['Schools', '/schools'],
    ['Compare', '/compare'],
    ['Tools', '/tools'],
    ['Blog', '/blog'],
    ['About', '/about'],
    ['Support', '/support']
  ];

  // Version française (page avec lang="fr") : libellés FR, et les pages qui
  // existent en français pointent vers /fr/. Une bascule EN/FR ferme la nav ;
  // le choix est mémorisé (se_lang) pour que l'aiguillage automatique de la
  // page d'accueil respecte le visiteur.
  var IS_FR = (document.documentElement.getAttribute('lang') || '').toLowerCase().indexOf('fr') === 0;
  if (IS_FR) {
    NAV = [
      ['Prix', '/fr/pricing'],
      ['Écoles', '/fr/schools'],
      ['Comparer', '/fr/compare'],
      ['Blog', '/fr/blog'],
      ['À propos', '/fr/about'],
      ['Aide', '/fr/support']
    ];
  }
  // Bascule EN/FR : elle mène à la MÊME page dans l'autre langue quand cette
  // page existe dans les deux, sinon à l'accueil de l'autre langue. Ajouter
  // une ligne ici chaque fois qu'une page est traduite.
  var PAIRS = {
    '/': '/fr/',
    '/pricing': '/fr/pricing',
    '/about': '/fr/about',
    '/schools': '/fr/schools',
    '/support': '/fr/support',
    '/privacy': '/fr/privacy',
    '/terms': '/fr/terms',
    '/compare': '/fr/compare',
    '/resources': '/fr/resources',
    '/blog/best-dialogue-hack': '/fr/blog/best-dialogue-hack',
    '/blog/why-feedback-is-hard': '/fr/blog/why-feedback-is-hard',
    '/blog/best-screenplay-addons-google-docs': '/fr/blog/best-screenplay-addons-google-docs',
    '/free-google-docs-screenplay-template': '/fr/free-google-docs-screenplay-template',
    '/screenplay-formatter-google-docs': '/fr/screenplay-formatter-google-docs',
    '/alternative': '/fr/alternative',
    '/success': '/fr/success',
    '/cancel': '/fr/cancel',
    '/picker': '/fr/picker',
    '/uninstall': '/fr/uninstall',
    '/uninstall-addon': '/fr/uninstall-addon',
    '/blog': '/fr/blog',
    '/landing-beginners': '/fr/landing-beginners',
    '/landing-budget': '/fr/landing-budget',
    '/landing-game-writers': '/fr/landing-game-writers',
    '/landing-international': '/fr/landing-international',
    '/landing-professionals': '/fr/landing-professionals',
    '/landing-students': '/fr/landing-students',
    '/landing-teachers': '/fr/landing-teachers',
    '/landing-theater': '/fr/landing-theater',
    '/landing-writers-rooms': '/fr/landing-writers-rooms',
    '/landing-youtube-creators': '/fr/landing-youtube-creators',
    '/resources/action-screenplay-template': '/fr/resources/action-screenplay-template',
    '/resources/chromebook': '/fr/resources/chromebook',
    '/resources/comedy-screenplay-template': '/fr/resources/comedy-screenplay-template',
    '/resources/drama-screenplay-template': '/fr/resources/drama-screenplay-template',
    '/resources/google-docs-vs-final-draft': '/fr/resources/google-docs-vs-final-draft',
    '/resources/horror-screenplay-template': '/fr/resources/horror-screenplay-template',
    '/resources/how-to-get-your-short-film-read-by-producers': '/fr/resources/how-to-get-your-short-film-read-by-producers',
    '/resources/how-to-write-screenplay-google-docs': '/fr/resources/how-to-write-screenplay-google-docs',
    '/resources/sci-fi-screenplay-template': '/fr/resources/sci-fi-screenplay-template',
    '/resources/screenplay-format-google-docs': '/fr/resources/screenplay-format-google-docs',
    '/resources/short-film-screenplay-template': '/fr/resources/short-film-screenplay-template',
    '/resources/thriller-screenplay-template': '/fr/resources/thriller-screenplay-template',
    '/resources/tv-pilot-screenplay-template': '/fr/resources/tv-pilot-screenplay-template',
    '/compare/screenplay-editor-vs-arc-studio': '/fr/compare/screenplay-editor-vs-arc-studio',
    '/compare/screenplay-editor-vs-celtx': '/fr/compare/screenplay-editor-vs-celtx',
    '/compare/screenplay-editor-vs-fade-in': '/fr/compare/screenplay-editor-vs-fade-in',
    '/compare/screenplay-editor-vs-final-draft': '/fr/compare/screenplay-editor-vs-final-draft',
    '/compare/screenplay-editor-vs-highland': '/fr/compare/screenplay-editor-vs-highland',
    '/compare/screenplay-editor-vs-screenplay-formatter': '/fr/compare/screenplay-editor-vs-screenplay-formatter',
    '/compare/screenplay-editor-vs-writersolo': '/fr/compare/screenplay-editor-vs-writersolo'
  };
  function counterpartHref() {
    // Le site n'a plus qu'une seule forme d'URL depuis le 20/08 : sans .html,
    // et une page d'index se lit comme son dossier. On normalise donc ce que
    // le navigateur donne avant de chercher, pour que le sélecteur marche
    // aussi si quelqu'un arrive par une vieille adresse en .html.
    var p = location.pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '') || '/';
    if (IS_FR) {
      var en = p.replace(/^\/fr(\/|$)/, '/');
      for (var k in PAIRS) { if (PAIRS[k] === p || k === en) return k; }
      return '/';
    }
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
        "font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;}" +
        '.rail.away{transform:translateY(-160%);opacity:0;}' +

        '.pill{pointer-events:auto;display:flex;align-items:center;' +
        'max-width:calc(100vw - 28px);' +
        /* No outline: the capsule reads by its fill, lighter than the dark
           hero behind it and dark against the light pages. */
        'background:rgba(14,14,16,0.86);-webkit-backdrop-filter:blur(16px) saturate(160%);' +
        'backdrop-filter:blur(16px) saturate(160%);' +
        'border-radius:999px;padding:7px 7px 7px 26px;' +
        'box-shadow:0 6px 26px rgba(0,0,0,0.22);}' +

        ".logo{font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;" +
        'font-size:19px;font-weight:800;letter-spacing:-0.04em;color:#fff;' +
        'text-decoration:none;cursor:pointer;line-height:1;}' +
        '.logo .dot{color:' + VIOLET + ';}' +

        'nav{display:flex;align-items:center;}' +
        '.nav-links{display:flex;align-items:center;}' +
        'nav a{margin-left:34px;font-size:14px;font-weight:500;letter-spacing:-0.01em;color:#a5a5a5;' +
        'text-decoration:none;white-space:nowrap;transition:color .2s;}' +
        'nav a:hover{color:#fff;}' +
        /* The brand is its own block: give it more air than the links get. */
        '.nav-links a:first-child{margin-left:44px;}' +

        '.cta{margin-left:30px;background:' + VIOLET + ';color:#fff;' +
        'display:inline-flex;align-items:center;gap:7px;white-space:nowrap;' +
        'padding:9px 20px;border-radius:999px;font-size:14px;font-weight:600;letter-spacing:-0.01em;' +
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
        "font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;}" +
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

  /* ----------------------------------------------------------
     SURLIGNAGES : le trait se peint une fois, quand le bloc est
     franchement dans l'ecran, et ne se depeint JAMAIS quand on
     remonte. C'est la raison d'etre de ce bout de code : la
     solution sans JavaScript (animation-timeline: view()) est
     pilotee par la position, donc elle rejoue le trait a l'envers
     au defilement inverse. Ici on pose une classe, une fois, et on
     arrete d'observer. Le style vit dans tokens.css.
     ---------------------------------------------------------- */
  function armeSurlignages() {
    var marks = document.querySelectorAll('span.mark');
    if (!marks.length) return;
    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < marks.length; i++) marks[i].classList.add('mark-on');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('mark-on');
          io.unobserve(entries[i].target);
        }
      }
    }, { threshold: 0.9 });
    for (var j = 0; j < marks.length; j++) io.observe(marks[j]);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', armeSurlignages);
  else armeSurlignages();
})();
