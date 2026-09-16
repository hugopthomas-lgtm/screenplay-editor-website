// Try it: the shared engine (engine.js) drives a sheet of paper. Same rules as
// the extension and the Word pane: Enter advances, Tab switches, INT. and
// transitions are recognised as you type, names and headings go to capitals.
(function () {
  var E = window.SEEngine; if (!E) return;
  var sheet = document.getElementById('tryit-sheet'); if (!sheet) return;
  var pill = document.getElementById('tryit-pill');
  var PH = { SCENE_HEADING: 'INT. KITCHEN - NIGHT', ACTION: 'What we see.', CHARACTER: 'WHO SPEAKS', DIALOGUE: 'What they say.', PARENTHETICAL: '(how)', TRANSITION: 'CUT TO:' };
  var GLYPH = { Enter: '↵', Tab: '⇥' };

  var canvas = sheet.closest('.gdoc-canvas');

  // At the bottom of the page: the way out, with a smile.
  var outro = null, outroShown = false, added = 0;
  function showOutro() {
    if (outroShown || !canvas) return; outroShown = true;
    outro = document.createElement('div'); outro.className = 'tryit-outro';
    outro.innerHTML = '<span class="tryit-outro-text">Now install me and stop copying Sofia Coppola.</span><a class="tryit-outro-btn" href="https://chromewebstore.google.com/detail/scrrrr-screenplay-editor/cgnainjnmiaimmeephomhkhpcjahmfln" target="_blank" rel="noopener">Add to Chrome</a><a class="tryit-outro-alt" href="/word">or get it for Word</a>';
    canvas.appendChild(outro);
    requestAnimationFrame(function () { outro.classList.add('in'); });
  }
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
  function low(m) { return E.MODE_LABELS[m].toLowerCase(); }
  function key(k) { return '<span class="tryit-key">' + k + (GLYPH[k] ? ' ' + GLYPH[k] : '') + '</span>'; }
  function paint(el) {
    if (!pill) return;
    var mode = el.dataset.mode, empty = !el.textContent.trim();
    var c = E.pillContent(mode, empty);
    var parts = [];
    if (c.enter) parts.push(key('Enter') + ' takes you to ' + low(c.enter));
    else if (c.scene) parts.push('Write ' + key('INT.') + ' for a scene heading');
    if (c.tab) parts.push(key('Tab') + ' for ' + low(c.tab));
    pill.querySelector('.tryit-line').innerHTML = "You're in <b>" + low(c.mode) + '</b>.';
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
    var cta = pill && pill.querySelector('.tryit-cta'); if (cta && t.trim() && cta.dataset.step !== '1') { cta.dataset.step = '1'; cta.textContent = 'Now press Enter'; }
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

  var seed = [
    ['SCENE_HEADING', 'INT. HOTEL BAR, TOKYO - NIGHT'],
    ['ACTION', 'Neon through the window. BOB, sixty, tie undone, nurses a whisky he did not order.'],
    ['CHARACTER', 'CHARLOTTE'],
    ['PARENTHETICAL', '(one stool over)'],
    ['DIALOGUE', "You're not going to sleep either."],
    ['CHARACTER', 'BOB'],
    ['DIALOGUE', "I haven't slept since Thursday. Which Thursday, I couldn't tell you."],
    ['CHARACTER', 'CHARLOTTE'],
    ['DIALOGUE', '']
  ];
  seed.forEach(function (s) { sheet.appendChild(block(s[0], s[1])); });
  sheet.lastElementChild.dataset.ph = 'Type her line here.';
  sheet.addEventListener('click', function (e) { if (e.target === sheet) { var last = sheet.lastElementChild; if (last) caretEnd(last); } });
  var last = sheet.lastElementChild; paint(last);
  // Type anywhere: while the page is on screen and nothing else has the focus, keys go to the current line.
  var onScreen = false;
  if ('IntersectionObserver' in window) { new IntersectionObserver(function (es) { onScreen = es[0].isIntersecting; }, { threshold: 0.35 }).observe(sheet); } else { onScreen = true; }
  function editable(el) { return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)); }
  document.addEventListener('keydown', function (e) {
    if (!onScreen || editable(document.activeElement) || e.metaKey || e.ctrlKey || e.altKey) return;
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
