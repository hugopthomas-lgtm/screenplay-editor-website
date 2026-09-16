// Try it: the shared engine (engine.js) drives a sheet of paper. Same rules as
// the extension and the Word pane: Enter advances, Tab switches, INT. and
// transitions are recognised as you type, names and headings go to capitals.
(function () {
  var E = window.SEEngine; if (!E) return;
  var sheet = document.getElementById('tryit-sheet'); if (!sheet) return;
  var pill = document.getElementById('tryit-pill');
  var PH = { SCENE_HEADING: 'INT. KITCHEN - NIGHT', ACTION: 'What we see.', CHARACTER: 'WHO SPEAKS', DIALOGUE: 'What they say.', PARENTHETICAL: '(how)', TRANSITION: 'CUT TO:' };
  var GLYPH = { Enter: '↵', Tab: '⇥' };

  function block(mode, text) {
    var d = document.createElement('div');
    d.className = 'tl'; d.contentEditable = 'true'; d.spellcheck = false;
    d.dataset.mode = mode; d.dataset.ph = PH[mode] || '';
    d.textContent = text || '';
    wire(d);
    return d;
  }
  function caretEnd(el, inside) {
    el.focus();
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
    var trig = E.lineTrigger(t);
    if (trig && trig !== el.dataset.mode && (el.dataset.mode === 'ACTION' || el.dataset.mode === 'SCENE_HEADING' || el.dataset.mode === 'TRANSITION')) { setMode(el, trig); }
    fixCase(el);
    paint(el);
  }
  function onKey(e) {
    var el = e.currentTarget, mode = el.dataset.mode, empty = !el.textContent.trim();
    if (e.key === 'Enter') {
      e.preventDefault();
      var d = E.enterDecision(mode);
      var n = block(d.mode, ''); el.after(n); caretEnd(n); paint(n); return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      var td = E.tabDecision(mode, empty);
      if (td.kind === 'inplace') { setMode(el, td.mode); if (td.parens) { el.textContent = '()'; caretEnd(el, true); } paint(el); return; }
      if (td.kind === 'newline') { var nb = block(td.mode, td.parens ? '()' : ''); el.after(nb); caretEnd(nb, !!td.parens); paint(nb); return; }
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
  document.querySelectorAll('.tryit-keys button').forEach(function (b) {
    b.addEventListener('click', function () {
      var cur = sheet.querySelector('.tl.is-cur') || sheet.lastElementChild; if (!cur) return;
      cur.focus();
      onKey({ currentTarget: cur, key: b.dataset.key, preventDefault: function () {} });
    });
  });
})();
