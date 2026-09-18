// LE SOL — fabrique les cartes de chaque `.floor-track` de la page (voir /floor.css).
// Le jeu de cartes est écrit trois fois pour que la piste glisse d'exactement une
// copie et boucle sans saut ni bord visible. Les cartes sont des exemples : scènes,
// distribution et titres sont inventés.
(function () {
  var tracks = document.querySelectorAll('.floor-track');
  if (!tracks.length) return;

  var dots = ['#9D7BEA', '#5FA8F5', '#F2B84B', '#6CC38B', '#F08A8A'];
  var ico = {
    page: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    hash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
    inb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7 8l5-5 5 5M4 21h16"/></svg>'
  };

  function page(num, lines) { return '<div class="fc fc-tall fc-page"><span class="num">' + num + '.</span>' + lines + '</div>'; }
  function slug(t) { return '<div class="slug">' + t + '</div>'; }
  function act(t) { return '<div class="act">' + t + '</div>'; }
  function who(t) { return '<div class="who">' + t + '</div>'; }
  function par(t) { return '<div class="par">' + t + '</div>'; }
  function say(t) { return '<div class="say">' + t + '</div>'; }
  function trans(t) { return '<div class="trans">' + t + '</div>'; }
  function scenes(rows) {
    return '<div class="fc"><div class="fc-eyebrow">Scenes</div><div class="fc-scenes">' +
      rows.map(function (r) { return '<span><b>' + r[0] + '</b>' + r[1] + '</span>'; }).join('') + '</div></div>';
  }
  function people(rows) {
    return '<div class="fc"><div class="fc-eyebrow">Cast</div><div class="fc-people">' +
      rows.map(function (r, i) { return '<span><i style="background:' + dots[i % dots.length] + '"></i>' + r + '</span>'; }).join('') + '</div></div>';
  }
  function chips(items) {
    return '<div class="fc-chips">' + items.map(function (c) {
      return '<div class="fc-chip' + (c.mono ? ' fc-mono' : '') + '">' + (c.icon ? ico[c.icon] : '') + c.text + '</div>';
    }).join('') + '</div>';
  }
  function shared(title, sub, initials) {
    return '<div class="fc"><div class="fc-avatars">' +
      initials.map(function (s, i) { return '<b style="background:' + dots[(i + 1) % dots.length] + '">' + s + '</b>'; }).join('') +
      '</div><div class="fc-strong">' + title + '</div><div class="fc-note">' + sub + '</div></div>';
  }

  var tiles = [
    [
      page(27, slug('Int. Kitchen - Night') + act('Margot rinses the same plate for the third time. Lucas stays in the doorway, coat still on.') + who('Margot') + par('(not turning around)') + say('You said nine.') + who('Lucas') + say("I said I'd try.") + trans('Cut to:')),
      scenes([['27', 'INT. KITCHEN'], ['28', 'EXT. DRIVEWAY'], ['29', 'INT. CAR']]),
      chips([{ icon: 'page', text: '94 pages' }, { icon: 'clock', text: 'Act II · p.27' }]),
      people(['MARGOT', 'LUCAS', 'DIALLO', 'NURSE']),
      chips([{ mono: true, text: 'CUT TO:' }, { mono: true, text: "(CONT'D)" }])
    ],
    [
      '<div class="fc fc-tall fc-page fc-title"><div class="t">THE LAST FERRY</div><div>written by</div><div>Léa Marchand</div><div style="margin-top:14px;color:var(--ink-4)">Second draft<br>March 2026</div></div>',
      chips([{ icon: 'check', text: 'Auto-format on' }, { mono: true, text: 'DUAL DIALOGUE' }]),
      page(42, slug('Int. Wheelhouse - Dawn') + act('The radio hisses. Diallo reads the manifest twice.') + who('Diallo') + par('(reading)') + say('Who else had a key?') + who('Captain') + say('Nobody. That was the point.')),
      shared('Shared with Sam', 'Editing now', ['SP', 'HT'])
    ],
    [
      page(58, slug('Ext. Harbour - Day') + act('The ferry horn. Nobody on the quay moves.') + who('Diallo') + say('Last call.') + act('Margot looks at the water, then at the road.') + who('Margot') + par('(to herself)') + say('Nine.') + trans('Fade out.')),
      people(['CAPTAIN', 'MARGOT', 'DIALLO']),
      chips([{ mono: true, text: 'FADE OUT.' }, { icon: 'page', text: 'Scene 58 of 61' }]),
      '<div class="fc"><div class="fc-eyebrow">Note from Sam</div><div class="fc-note">Cut the second phone call. We already know he lied.</div></div>',
      chips([{ icon: 'clock', text: 'Saved just now' }, { icon: 'hash', text: 'Scene numbers' }])
    ],
    [
      '<div class="fc fc-tall fc-poster"><div class="fc-eyebrow">Poster</div><div class="t">THE LAST FERRY</div><div class="by">a film by Léa Marchand</div></div>',
      chips([{ icon: 'out', text: 'Export .fdx' }, { icon: 'inb', text: 'Import Fade In' }]),
      '<div class="fc"><div class="fc-eyebrow">Breakdown</div><div class="fc-counts"><div><b>12</b><small>props</small></div><div><b>3</b><small>sets</small></div><div><b>5</b><small>cast</small></div></div></div>',
      chips([{ icon: 'mic', text: 'Table read' }, { icon: 'users', text: '3 collaborators' }]),
      scenes([['41', 'EXT. FERRY DECK'], ['42', 'INT. WHEELHOUSE'], ['43', 'EXT. HARBOUR']])
    ]
  ];
  var set = '<div class="floor-set">' + tiles.map(function (t) { return '<div class="floor-tile">' + t.join('') + '</div>'; }).join('') + '</div>';
  Array.prototype.forEach.call(tracks, function (track) { track.innerHTML = set + set + set; });
})();
