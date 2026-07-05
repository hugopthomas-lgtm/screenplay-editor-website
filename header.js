/* ============================================================
   SINGLE SOURCE OF TRUTH FOR THE SITE HEADER.
   Every page uses <site-header></site-header> + this script.
   Change it HERE, it changes EVERYWHERE. Never edit a header
   inside a page again.
   ============================================================ */
(function () {
  var VIOLET = '#9D7BEA';
  var VIOLET_DARK = '#8B6AD4';
  var INSTALL = 'https://chromewebstore.google.com/detail/scrrrr-screenplay-editor/cgnainjnmiaimmeephomhkhpcjahmfln';

  // Fixed header height, published as a CSS var so any page can clear the
  // fixed bar (e.g. breadcrumb: margin-top:var(--site-header-h)). Change the
  // height here and in the .inner rule below together — pages follow.
  var HEADER_H = 65; // px (64px inner + 1px border)
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
        '.bar{position:fixed;top:0;left:0;right:0;z-index:1000;' +
        'background:#1a1a1a;-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);' +
        'border-bottom:1px solid rgba(157,123,234,0.18);' +
        "font-family:'JetBrains Mono',monospace;}" +
        '.inner{max-width:1100px;margin:0 auto;height:64px;padding:0 30px;' +
        'display:flex;justify-content:space-between;align-items:center;}' +
        ".logo{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;" +
        'font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#fff;' +
        'text-decoration:none;cursor:pointer;}' +
        '.logo .dot{color:' + VIOLET + ';}' +
        'nav{display:flex;align-items:center;}' +
        '.nav-links{display:flex;align-items:center;}' +
        'nav a{margin-left:26px;font-size:13px;font-weight:500;color:#aaa;' +
        'text-decoration:none;transition:color .2s;}' +
        'nav a:hover{color:#fff;}' +
        '.cta{margin-left:26px;background:' + VIOLET + ';color:#fff;' +
        'display:inline-flex;align-items:center;gap:7px;' +
        'padding:9px 18px;border-radius:7px;font-size:13px;font-weight:600;' +
        'transition:background .2s,transform .2s;}' +
        '.cta:hover{background:' + VIOLET_DARK + ';transform:translateY(-1px);}' +
        '.cta .flame{width:16px;height:16px;flex-shrink:0;filter:brightness(0) invert(1);}' +
        '.burger{display:none;margin-left:16px;width:26px;height:20px;background:none;border:0;padding:0;cursor:pointer;position:relative;}' +
        '.burger span{position:absolute;left:0;width:26px;height:2px;background:#fff;border-radius:2px;' +
        'transition:transform .25s ease,opacity .2s ease,top .25s ease;}' +
        '.burger span:nth-child(1){top:3px;}.burger span:nth-child(2){top:9px;}.burger span:nth-child(3){top:15px;}' +
        '.bar.open .burger span:nth-child(1){top:9px;transform:rotate(45deg);}' +
        '.bar.open .burger span:nth-child(2){opacity:0;}' +
        '.bar.open .burger span:nth-child(3){top:9px;transform:rotate(-45deg);}' +
        '.mobile-menu{display:none;flex-direction:column;background:#1a1a1a;' +
        'border-bottom:1px solid rgba(157,123,234,0.18);padding:4px 0 12px;}' +
        '.mobile-menu a{padding:13px 22px;font-size:15px;font-weight:500;color:#ccc;' +
        "text-decoration:none;border-top:1px solid rgba(255,255,255,0.06);font-family:'JetBrains Mono',monospace;}" +
        '.mobile-menu a:active{background:rgba(157,123,234,0.14);color:#fff;}' +
        '@media(max-width:760px){.inner{padding:0 20px;}' +
        '.nav-links{display:none;}.cta{margin-left:0;}.burger{display:block;}' +
        '.bar.open .mobile-menu{display:flex;}}' +
        '</style>' +
        '<div class="bar"><div class="inner">' +
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

      var bar = root.querySelector('.bar');
      var burger = root.querySelector('.burger');
      burger.addEventListener('click', function () {
        var open = bar.classList.toggle('open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      root.querySelectorAll('.mobile-menu a').forEach(function (a) {
        a.addEventListener('click', function () {
          bar.classList.remove('open');
          burger.setAttribute('aria-expanded', 'false');
        });
      });
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
