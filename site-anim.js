/* ============================================================
   SHARED SITE ANIMATIONS — le ton de la landing.
   Révélations au scroll (sections + cascade sur cartes/étapes/lignes),
   entrée du hero au chargement, avion en papier qui s'envole après 5 s.
   Filet de sécurité : à la moindre erreur, tout s'affiche.
   Charge ce script en fin de <body> : <script src="/site-anim.js"></script>
   ============================================================ */
(function () {
  var supportsIO = 'IntersectionObserver' in window;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!supportsIO || reduce) {
    document.querySelectorAll('.scroll-fade').forEach(function (el) { el.classList.add('visible'); });
    document.body.classList.add('hero-loaded');
    return;
  }

  try {
    // 1) Sections : fondu + montée.
    var fadeObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); fadeObserver.unobserve(entry.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.scroll-fade').forEach(function (el) { fadeObserver.observe(el); });

    // 2) Éléments répétés : cascade (délai selon le rang dans le groupe).
    var groups = ['.steps .step', '.card-grid .info-card', '.feature-checks li', '.cloud-table .crow'];
    var revealItems = [];
    groups.forEach(function (sel) {
      var byParent = new Map();
      document.querySelectorAll(sel).forEach(function (el) {
        el.classList.add('reveal');
        var p = el.parentElement;
        var idx = byParent.get(p) || 0;
        el.style.setProperty('--d', (idx * 75) + 'ms');
        byParent.set(p, idx + 1);
        revealItems.push(el);
      });
    });
    var revObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { entry.target.classList.add('in'); revObserver.unobserve(entry.target); }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -5% 0px' });
    revealItems.forEach(function (el) { revObserver.observe(el); });

    // 3) Hero : entrée décalée au chargement.
    document.querySelectorAll('.hero-inner > *:not(.float-obj)').forEach(function (el, i) { el.style.setProperty('--d', (i * 85) + 'ms'); });
    requestAnimationFrame(function () { requestAnimationFrame(function () { document.body.classList.add('hero-loaded'); }); });

    // 4) L'avion s'envole après 5 s (s'il y en a un).
    if (document.querySelector('.hero-plane')) {
      setTimeout(function () { document.body.classList.add('plane-flyaway'); }, 5000);
    }
  } catch (e) {
    document.querySelectorAll('.scroll-fade').forEach(function (el) { el.classList.add('visible'); });
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    document.body.classList.add('hero-loaded');
  }
})();
