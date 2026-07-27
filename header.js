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
    ['Schools', '/schools.html'],
    ['Blog', '/blog.html'],
    ['Resources', '/resources/'],
    ['About', '/about.html'],
    ['Compare', '/compare/'],
    ['Support', '/support.html']
  ];

  var navHtml = NAV.map(function (n) {
    return '<a href="' + n[1] + '">' + n[0] + '</a>';
  }).join('');

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
        'border-radius:999px;padding:7px 7px 7px 22px;' +
        'box-shadow:0 6px 26px rgba(0,0,0,0.22);}' +

        ".logo{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;" +
        'font-size:19px;font-weight:700;letter-spacing:-0.5px;color:#fff;' +
        'text-decoration:none;cursor:pointer;line-height:1;}' +
        '.logo .dot{color:' + VIOLET + ';}' +

        'nav{display:flex;align-items:center;}' +
        '.nav-links{display:flex;align-items:center;}' +
        'nav a{margin-left:24px;font-size:13px;font-weight:500;color:#a5a5a5;' +
        'text-decoration:none;white-space:nowrap;transition:color .2s;}' +
        'nav a:hover{color:#fff;}' +
        /* The brand is its own block: give it more air than the links get. */
        '.nav-links a:first-child{margin-left:36px;}' +

        '.cta{margin-left:24px;background:' + VIOLET + ';color:#fff;' +
        'display:inline-flex;align-items:center;gap:7px;white-space:nowrap;' +
        'padding:9px 19px;border-radius:999px;font-size:13px;font-weight:600;' +
        'text-decoration:none;transition:background .2s,transform .2s;}' +
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

        '@media(max-width:860px){.nav-links{display:none;}.cta{margin-left:18px;}' +
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
        'Install</a>' +
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
    var months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
    var d = new Date();
    var label = months[d.getMonth()] + ' ' + d.getFullYear();
    var els = document.querySelectorAll('.now-month');
    for (var i = 0; i < els.length; i++) els[i].textContent = label;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fillNow);
  else fillNow();
})();
