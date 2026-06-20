/* ============================================================
   SINGLE SOURCE OF TRUTH FOR THE SITE HEADER.
   Every page uses <site-header></site-header> + this script.
   Change it HERE, it changes EVERYWHERE. Never edit a header
   inside a page again.
   ============================================================ */
(function () {
  var VIOLET = '#9D7BEA';
  var VIOLET_DARK = '#8B6AD4';
  var INSTALL = 'https://workspace.google.com/marketplace/app/screenplay_editor_script_formatter_for_d/611158558476';

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
        '.inner{max-width:1100px;margin:0 auto;padding:18px 30px;' +
        'display:flex;justify-content:space-between;align-items:center;}' +
        ".logo{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;" +
        'font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#fff;' +
        'text-decoration:none;cursor:pointer;}' +
        '.logo .dot{color:' + VIOLET + ';}' +
        'nav{display:flex;align-items:center;}' +
        'nav a{margin-left:26px;font-size:13px;font-weight:500;color:#aaa;' +
        'text-decoration:none;transition:color .2s;}' +
        'nav a:hover{color:#fff;}' +
        '.cta{margin-left:26px;background:' + VIOLET + ';color:#fff;' +
        'padding:9px 18px;border-radius:7px;font-size:13px;font-weight:600;' +
        'transition:background .2s,transform .2s;}' +
        '.cta:hover{background:' + VIOLET_DARK + ';transform:translateY(-1px);}' +
        '@media(max-width:760px){.inner{padding:15px 20px;}' +
        'nav a:not(.cta){display:none;}.cta{margin-left:0;}}' +
        '</style>' +
        '<div class="bar"><div class="inner">' +
        '<a href="/" class="logo">scrrrr<span class="dot">.</span></a>' +
        '<nav>' + navHtml +
        '<a class="cta" href="' + INSTALL + '" target="_blank" rel="noopener">Install</a>' +
        '</nav></div></div>';
    }
  }
  customElements.define('site-header', SiteHeader);
})();
