// Try it: the shared engine (engine.js) drives a sheet of paper. Same rules as
// the extension and the Word pane: Enter advances, Tab switches, INT. and
// transitions are recognised as you type, names and headings go to capitals.
(function () {
  var E = window.SEEngine; if (!E) return;
  var sheet = document.getElementById('tryit-sheet'); if (!sheet) return;
  var pill = document.getElementById('tryit-pill');
  // The words, in the language of the page (the engine is the same).
  var FR = /^fr/i.test(document.documentElement.lang || '');
  var T = FR ? {
    ph: { SCENE_HEADING: 'INT. CUISINE - NUIT', ACTION: 'Ce qu\'on voit.', CHARACTER: 'QUI PARLE', DIALOGUE: 'Ce qu\'il dit.', PARENTHETICAL: '(comment)', TRANSITION: 'CUT TO:' },
    labels: { SCENE_HEADING: 'intitulé de scène', ACTION: 'action', CHARACTER: 'personnage', DIALOGUE: 'dialogue', PARENTHETICAL: 'parenthèse', TRANSITION: 'transition' },
    keyEnter: 'Entrée', keyTab: 'Tab',
    youre: 'Vous êtes en <b>', takes: ' vous emmène en ', write: 'Écrivez ', forHeading: ' pour un intitulé de scène', forX: ' pour ',
    nowEnter: 'Appuyez sur Entrée', outro: 'Installez-moi, et arrêtez de copier Sofia Coppola.', outroBtn: 'Ajouter à Chrome', outroBtnWord: 'Télécharger pour Word', typeHere: 'Tapez sa réplique ici.',
    seed: [['SCENE_HEADING', 'INT. BAR DE L\'HÔTEL, TOKYO - NUIT'], ['ACTION', 'Le néon par la fenêtre. BOB, soixante ans, cravate défaite, sirote un whisky qu\'il n\'a pas commandé.'], ['CHARACTER', 'CHARLOTTE'], ['PARENTHETICAL', '(un tabouret plus loin)'], ['DIALOGUE', 'Vous non plus, vous n\'allez pas dormir.'], ['CHARACTER', 'BOB'], ['DIALOGUE', 'Je n\'ai pas dormi depuis jeudi. Lequel, je ne saurais pas dire.'], ['CHARACTER', 'CHARLOTTE'], ['DIALOGUE', '']]
  } : {
    ph: { SCENE_HEADING: 'INT. KITCHEN - NIGHT', ACTION: 'What we see.', CHARACTER: 'WHO SPEAKS', DIALOGUE: 'What they say.', PARENTHETICAL: '(how)', TRANSITION: 'CUT TO:' },
    labels: null, keyEnter: 'Enter', keyTab: 'Tab',
    youre: "You're in <b>", takes: ' takes you to ', write: 'Write ', forHeading: ' for a scene heading', forX: ' for ',
    nowEnter: 'Now press Enter', outro: 'Now install me and stop copying Sofia Coppola.', outroBtn: 'Add to Chrome', outroBtnWord: 'Get it for Word', typeHere: 'Type her line here.',
    seed: [['SCENE_HEADING', 'INT. HOTEL BAR, TOKYO - NIGHT'], ['ACTION', 'Neon through the window. BOB, sixty, tie undone, nurses a whisky he did not order.'], ['CHARACTER', 'CHARLOTTE'], ['PARENTHETICAL', '(one stool over)'], ['DIALOGUE', "You're not going to sleep either."], ['CHARACTER', 'BOB'], ['DIALOGUE', "I haven't slept since Thursday. Which Thursday, I couldn't tell you."], ['CHARACTER', 'CHARLOTTE'], ['DIALOGUE', '']]
  };
  var PH = T.ph;
  var GLYPH = { Enter: '↵', Tab: '⇥' };

  var canvas = sheet.closest('.gdoc-canvas');

  // At the bottom of the page: the way out, with a smile.
  var outro = null, outroShown = false, added = 0;
  function showOutro() {
    if (outroShown || !canvas) return; outroShown = true;
    outro = document.createElement('div'); outro.className = 'tryit-outro';
    outro.innerHTML = '<span class="tryit-outro-text">' + T.outro + '</span><a class="tryit-outro-btn" target="_blank" rel="noopener"></a>';
    aimOutro();
    canvas.appendChild(outro);
    requestAnimationFrame(function () { outro.classList.add('in'); });
  }
  // Which door: Chrome for Google Docs, the Word page when the demo is in Word mode.
  var CWS = 'https://chromewebstore.google.com/detail/scrrrr-screenplay-editor/cgnainjnmiaimmeephomhkhpcjahmfln';
  function isWord() { var g = document.querySelector('.gdoc'); return !!(g && g.classList.contains('is-word')); }
  function aimOutro() {
    if (!outro) return; var a = outro.querySelector('.tryit-outro-btn'); if (!a) return;
    var w = isWord(); a.href = w ? '/word' : CWS; a.textContent = w ? T.outroBtnWord : T.outroBtn; a.target = w ? '_self' : '_blank';
  }
  document.addEventListener('se-surface', aimOutro);
  function checkOutro() {
    if (outroShown) return;
    var wrap = sheet.parentElement, last = sheet.lastElementChild; if (!wrap || !last) return;
    var w = wrap.getBoundingClientRect(), l = last.getBoundingClientRect();
    if (added >= 5 || l.bottom > w.bottom - 60) showOutro();
  }

  function block(mode, text) {
    var d = document.createElement('div');
    d.className = 'tl'; d.contentEditable = 'true'; d.spellcheck = false;
    d.dataset.mode = mode; d.dataset.ph = PH[mode] || '';
    d.textContent = text || '';
    wire(d);
    return d;
  }
  function caretEnd(el, inside) {
    el.focus({ preventScroll: true });
    var r = document.createRange(), s = window.getSelection();
    if (inside && el.firstChild) { r.setStart(el.firstChild, Math.max(0, el.textContent.length - 1)); r.collapse(true); }
    else { r.selectNodeContents(el); r.collapse(false); }
    s.removeAllRanges(); s.addRange(r);
  }
  function low(m) { return T.labels ? T.labels[m] : E.MODE_LABELS[m].toLowerCase(); }
  function key(k) { var name = k === 'Enter' ? T.keyEnter : k === 'Tab' ? T.keyTab : k; return '<span class="tryit-key">' + name + (GLYPH[k] ? ' ' + GLYPH[k] : '') + '</span>'; }
  function paint(el) {
    if (!pill) return;
    var mode = el.dataset.mode, empty = !el.textContent.trim();
    var c = E.pillContent(mode, empty);
    var parts = [];
    if (c.enter) parts.push(key('Enter') + T.takes + low(c.enter));
    else if (c.scene) parts.push(T.write + key('INT.') + T.forHeading);
    if (c.tab) parts.push(key('Tab') + T.forX + low(c.tab));
    pill.querySelector('.tryit-line').innerHTML = T.youre + low(c.mode) + '</b>.';
    pill.querySelector('.tryit-tip').innerHTML = parts.map(function (p) { return p + '.'; }).join('<br>');
    pill.querySelector('.tryit-dot').style.background = c.colors.ink;
    sheet.querySelectorAll('.tl.is-cur').forEach(function (n) { n.classList.remove('is-cur'); });
    el.classList.add('is-cur');
  }
  function setMode(el, mode) { el.dataset.mode = mode; el.dataset.ph = PH[mode] || ''; }
  function fixCase(el) {
    var mode = el.dataset.mode, t = el.textContent;
    if (!t) return;
    var target = mode === 'CHARACTER' ? E.upperCueName(t) : (E.UPPERCASE_MODES[mode] ? t.toUpperCase() : null);
    if (target && target !== t) { el.textContent = target; caretEnd(el); }
  }
  function onInput(e) {
    var el = e.currentTarget, t = el.textContent;
    var cta = pill && pill.querySelector('.tryit-cta'); if (cta && t.trim() && cta.dataset.step !== '1') { cta.dataset.step = '1'; cta.textContent = T.nowEnter; }
    var trig = E.lineTrigger(t);
    if (trig && trig !== el.dataset.mode && (el.dataset.mode === 'ACTION' || el.dataset.mode === 'SCENE_HEADING' || el.dataset.mode === 'TRANSITION')) { setMode(el, trig); }
    fixCase(el);
    paint(el);
  }
  function onKey(e) {
    var el = e.currentTarget, mode = el.dataset.mode, empty = !el.textContent.trim();
    if (e.key === 'Enter') {
      e.preventDefault();
      var cta = pill && pill.querySelector('.tryit-cta'); if (cta) cta.remove();
      var d = E.enterDecision(mode);
      var n = block(d.mode, ''); el.after(n); caretEnd(n); paint(n); added++; checkOutro(); return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      var td = E.tabDecision(mode, empty);
      if (td.kind === 'inplace') { setMode(el, td.mode); if (td.parens) { el.textContent = '()'; caretEnd(el, true); } paint(el); return; }
      if (td.kind === 'newline') { var nb = block(td.mode, td.parens ? '()' : ''); el.after(nb); caretEnd(nb, !!td.parens); paint(nb); added++; checkOutro(); return; }
      return;
    }
    if (e.key === 'Backspace' && empty && el.previousElementSibling) {
      e.preventDefault(); var p = el.previousElementSibling; el.remove(); caretEnd(p); paint(p);
    }
  }
  function wire(el) { el.addEventListener('input', onInput); el.addEventListener('keydown', onKey); el.addEventListener('focus', function () { paint(el); }); }

  var seed = T.seed;
  seed.forEach(function (s) { sheet.appendChild(block(s[0], s[1])); });
  sheet.lastElementChild.dataset.ph = T.typeHere;
  sheet.addEventListener('click', function (e) { if (e.target === sheet) { var last = sheet.lastElementChild; if (last) caretEnd(last); } });
  var last = sheet.lastElementChild; paint(last);
  // Type anywhere: while the page is on screen and nothing else has the focus, keys go to the current line.
  function onScreen() { var r = sheet.getBoundingClientRect(); return r.bottom > 120 && r.top < window.innerHeight - 120; }
  function editable(el) { return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); }
  document.addEventListener('keydown', function (e) {
    if (!onScreen() || editable(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
    var cur = sheet.querySelector('.tl.is-cur') || sheet.lastElementChild; if (!cur) return;
    if (e.key === 'Enter' || e.key === 'Tab') { caretEnd(cur); onKey({ currentTarget: cur, key: e.key, preventDefault: function () { e.preventDefault(); } }); return; }
    if (e.key.length === 1 || e.key === 'Backspace') { caretEnd(cur); }
  });
  document.querySelectorAll('.tryit-keys button').forEach(function (b) {
    b.addEventListener('click', function () {
      var cur = sheet.querySelector('.tl.is-cur') || sheet.lastElementChild; if (!cur) return;
      cur.focus();
      onKey({ currentTarget: cur, key: b.dataset.key, preventDefault: function () {} });
    });
  });
})();
