'use strict';

(function() {
  // ─── Read docId from query string ───
  const docId = 'word';

  // ─── State ───
  let lastScan = null;       // { data, timestamp }
  let lastAI = null;         // cached AI insights { data, timestamp }
  let aiLoading = false;
  let charSort = { col: 'words', dir: 'desc' };
  let locSort  = { col: 'scenes', dir: 'desc' };
  let charsExpanded = false; // top 10 by default, "Show all" toggles
  let isStale = false;       // doc modified since last scan
  let staleCheckTimer = null;

  // ─── DOM ───
  let $body  = document.getElementById('st-body');
  let onScanHook = null;

  // ────────── HELPERS ──────────

  function fmtNumber(n) {
    return (n || 0).toLocaleString('en-US');
  }
  function fmtInt(n) {
    return Math.round(n || 0).toLocaleString('en-US');
  }
  function fmtPct(p) {
    return Math.round(p) + '%';
  }
  function fmtPages(p) {
    // Decimal pages — used for individual scene lengths and averages. Strip
    // the trailing ".0" when the value is integer ("3 pages", not "3.0 pages").
    const v = Math.round((p || 0) * 10) / 10;
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }
  function fmtPagesInt(p) {
    // Integer pages — used for totals (no useless .0 trailing).
    return fmtInt(p);
  }
  // Grammatical pluralization helper. plural(1, 'page', 'pages') → 'page'.
  function plural(n, single, plur) {
    return (n === 1 || n === -1) ? single : plur;
  }
  function fmtPagesLabel(p) {
    // "1 page" / "2 pages" / "1.5 pages"
    return fmtPages(p) + ' ' + plural(Math.round((p || 0) * 10) / 10 === 1 ? 1 : 2, 'page', 'pages');
  }
  function agoStr(timestamp) {
    const s = Math.floor((Date.now() - timestamp) / 1000);
    if (s < 5) return 'Just now';
    if (s < 60) return s + 's ago';
    const m = Math.floor(s / 60);
    if (m < 60) return m + ' min ago';
    const h = Math.floor(m / 60);
    return h + 'h ago';
  }
  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ────────── CACHE (chrome.storage.session) ──────────

  const cacheKey = 'stats:' + docId;
  const aiCacheKey = 'stats_ai:' + docId;

  function loadCache(cb) {
    if (!docId || !chrome.storage || !chrome.storage.session) return cb(null);
    chrome.storage.session.get(cacheKey, function(data) {
      cb(data && data[cacheKey] ? data[cacheKey] : null);
    });
  }
  function saveCache(scan) {
    if (!docId || !chrome.storage || !chrome.storage.session) return;
    const o = {};
    o[cacheKey] = scan;
    chrome.storage.session.set(o);
  }
  function loadAICache(cb) {
    if (!docId || !chrome.storage || !chrome.storage.session) return cb(null);
    chrome.storage.session.get(aiCacheKey, function(data) {
      cb(data && data[aiCacheKey] ? data[aiCacheKey] : null);
    });
  }
  function saveAICache(payload) {
    if (!docId || !chrome.storage || !chrome.storage.session) return;
    const o = {};
    o[aiCacheKey] = payload;
    chrome.storage.session.set(o);
  }

  // ────────── BOOT (Word) ──────────
  // The pane computes the stats and hands them to this dialog. We ask, it answers.
  const EMBED = new URLSearchParams(location.search).get('embed') === '1';
  function ask() {
    if (onScanHook) { onScanHook(); return; }
    if (EMBED) { try { window.parent.postMessage({ se: 'scan' }, location.origin); } catch (_e) { /* no parent */ } return; }
    try { Office.context.ui.messageParent('scan'); } catch (_e) { /* not in a dialog */ }
  }
  function receive(arg) {
    let d = null;
    try { d = JSON.parse(arg.message); } catch (_e) { return renderError('Could not read the stats.'); }
    if (d && d.error) return renderError(d.error);
    lastScan = { data: d, timestamp: Date.now() };
    isStale = false; charsExpanded = false;
    renderResults(d);
  }
  // In the pane: the pane mounts us on its own element and feeds us.
  window.SEStats = {
    mount: function(el, hook) { $body = el; onScanHook = hook || null; },
    loading: renderLoading,
    error: renderError,
    show: function(d) { lastScan = { data: d, timestamp: Date.now() }; isStale = false; charsExpanded = false; renderResults(d); }
  };
  if (!$body) return; // pane: nothing to boot, the pane drives
  renderLoading();
  if (EMBED) {
    window.addEventListener('message', function(ev) { if (ev.origin === location.origin && ev.data && ev.data.se === 'stats') receive({ message: ev.data.payload }); });
    ask();
  } else if (typeof Office !== 'undefined') {
    Office.onReady(function() {
      try { Office.context.ui.addHandlerAsync(Office.EventType.DialogParentMessageReceived, receive); } catch (_e) { /* old host */ }
      ask();
    });
  }
  function runScan() { renderLoading(); ask(); }
  function runAIInsights() { /* the AI card waits for the account */ }
  function updateMetaBar() {}
  function loadCache(cb) { cb(null); }
  function saveCache() {}

  // ────────── RENDER ──────────

  function renderLoading() {
    $body.innerHTML = '<div class="st-loading"><div class="st-spinner"></div>Analyzing your script…</div>';
  }

  function renderError(msg) {
    $body.innerHTML =
      '<div class="st-error">' + escapeHTML(msg) + '</div>' +
      '<div class="st-empty" style="padding:30px 20px;"><button class="st-analyze-btn" id="st-retry-btn">Try again</button></div>';
    const btn = document.getElementById('st-retry-btn');
    if (btn) btn.addEventListener('click', runScan);
  }

  function renderResults(d) {
    if (!d.overview || d.overview.scenes === 0) {
      $body.innerHTML =
        '<div class="st-empty" style="padding:60px 20px;">' +
        '<div class="st-empty-hint">We couldn\'t detect any screenplay structure. Format your document first.</div>' +
        '<div style="margin-top:18px;"><button class="st-analyze-btn" id="st-retry-btn" style="padding:10px 22px;font-size:12px;">Re-analyze</button></div>' +
        '</div>';
      const btn = document.getElementById('st-retry-btn');
      if (btn) btn.addEventListener('click', runScan);
      return;
    }

    const meta = lastScan
      ? '<div class="st-meta' + (isStale ? ' is-stale' : '') + '" id="st-meta">' +
        '<div class="st-meta-text" id="st-ago">' +
          (isStale
            ? 'Document modified · click Refresh to update'
            : 'Analyzed ' + agoStr(lastScan.timestamp)) +
        '</div>' +
        '<button class="st-refresh-btn' + (isStale ? ' is-emphasized' : '') + '" id="st-refresh-btn">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>' +
          'Refresh' +
        '</button>' +
        '</div>'
      : '';

    $body.innerHTML =
      meta +
      renderScriptIdentity() +
      renderOverview(d.overview) +
      renderScenes(d.sceneStats || {}) +
      renderLocations(d.locations || []) +
      renderCharacters(d.characters || []);

    // If AI insights haven't been fetched yet for this session and we have a
    // fresh deterministic scan, kick them off in the background.

    const rbtn = document.getElementById('st-refresh-btn');
    if (rbtn) rbtn.addEventListener('click', runScan);

    // Keep the "analyzed X ago" fresh — only when not stale.
    if (lastScan) {
      setTimeout(function tick() {
        if (!lastScan) return;
        const el = document.getElementById('st-ago');
        if (!el) return;
        if (!isStale) el.textContent = 'Analyzed ' + agoStr(lastScan.timestamp);
        setTimeout(tick, 30000);
      }, 30000);
    }

    wireSortable();
    wireCharactersExpand();
  }

  function renderOverview(o) {
    return (
      '<div class="st-section">' +
        '<div class="st-section-title">Overview</div>' +
        '<div class="st-overview">' +
          stat(fmtPagesInt(o.pages || 0), plural(o.pages || 0, 'Page', 'Pages')) +
          stat(fmtNumber(o.scenes), plural(o.scenes || 0, 'Scene', 'Scenes')) +
          stat(fmtNumber(o.speakingCharacters), 'Speaking Cast') +
          stat(fmtNumber(o.uniqueLocations), plural(o.uniqueLocations || 0, 'Location', 'Locations')) +
          stat(fmtPct(o.dialogueRatio || 0), 'Dialogue') +
        '</div>' +
      '</div>'
    );
  }
  function stat(value, label) {
    return '<div class="st-stat"><div class="st-stat-value">' + escapeHTML(value) + '</div><div class="st-stat-label">' + escapeHTML(label) + '</div></div>';
  }

  // ────────── Script Identity (AI-driven) ──────────
  // Renders the AI insights card. Empty placeholder when no data yet, fades
  // in content when AI insights land. Updated by updateScriptIdentityCard()
  // after the AI call resolves.
  function renderScriptIdentity() {
    return '<div class="st-section st-identity-section" id="st-identity-section">' + renderScriptIdentityInner() + '</div>';
  }
  function renderScriptIdentityInner() {
    if (!lastAI || !lastAI.data) {
      if (aiLoading) {
        return (
          '<div class="st-section-title">Script Identity</div>' +
          '<div class="st-identity-loading">' +
            '<div class="st-spinner-sm"></div>' +
            '<span>Reading your screenplay…</span>' +
          '</div>'
        );
      }
      return ''; // no data, no loading → render nothing
    }
    const ai = lastAI.data;
    const blocks = [];

    if (ai.logline) {
      blocks.push(
        '<div class="st-identity-card">' +
          '<div class="st-identity-label">Logline</div>' +
          '<div class="st-identity-logline">' + escapeHTML(ai.logline) + '</div>' +
        '</div>'
      );
    }
    if (ai.coreConflict) {
      blocks.push(
        '<div class="st-identity-card">' +
          '<div class="st-identity-label">Core conflict</div>' +
          '<div class="st-identity-text">' + escapeHTML(ai.coreConflict) + '</div>' +
        '</div>'
      );
    }
    if (ai.themes && ai.themes.length) {
      blocks.push(
        '<div class="st-identity-card">' +
          '<div class="st-identity-label">Themes</div>' +
          '<div class="st-identity-list">' +
            ai.themes.map(function(t) {
              return (
                '<div class="st-identity-item">' +
                  '<div class="st-identity-item-name">' + escapeHTML(t.name) + '</div>' +
                  (t.justification ? '<div class="st-identity-item-sub">' + escapeHTML(t.justification) + '</div>' : '') +
                '</div>'
              );
            }).join('') +
          '</div>' +
        '</div>'
      );
    }
    if (ai.acts && ai.acts.length) {
      blocks.push(
        '<div class="st-identity-card">' +
          '<div class="st-identity-label">Acts</div>' +
          '<div class="st-identity-list">' +
            ai.acts.map(function(a) {
              return (
                '<div class="st-identity-item">' +
                  '<div class="st-identity-item-name">' + escapeHTML(a.name) + (a.endPage ? ' <span class="st-identity-page">→ p. ' + a.endPage + '</span>' : '') + '</div>' +
                  (a.beat ? '<div class="st-identity-item-sub">' + escapeHTML(a.beat) + '</div>' : '') +
                '</div>'
              );
            }).join('') +
          '</div>' +
        '</div>'
      );
    }
    if (ai.genre) {
      blocks.push(
        '<div class="st-identity-card">' +
          '<div class="st-identity-label">Genre</div>' +
          '<div class="st-identity-genre">' + escapeHTML(ai.genre) + '</div>' +
        '</div>'
      );
    }

    if (!blocks.length) return '';
    return (
      '<div class="st-section-title">Script Identity</div>' +
      '<div class="st-identity-grid">' + blocks.join('') + '</div>'
    );
  }
  function updateScriptIdentityCard() {
    const section = document.getElementById('st-identity-section');
    if (!section) return;
    section.innerHTML = renderScriptIdentityInner();
  }

  function renderCharacters(chars) {
    if (!chars.length) {
      return (
        '<div class="st-section">' +
          '<div class="st-section-title">Characters</div>' +
          '<div class="st-section-empty">No dialogue detected.</div>' +
        '</div>'
      );
    }
    const sorted = sortCharacters(chars.slice(), charSort);
    const TOP_N = 10;
    const visible = charsExpanded ? sorted : sorted.slice(0, TOP_N);
    const hiddenCount = Math.max(0, sorted.length - TOP_N);

    const rows = visible.map(function(c) {
      const sharePct = c.dialoguePct || 0;
      return (
        '<tr>' +
          '<td class="st-name">' + escapeHTML(c.name) + '</td>' +
          '<td class="st-num">' + fmtNumber(c.scenes) + '</td>' +
          '<td class="st-num">' + fmtNumber(c.lines) + '</td>' +
          '<td class="st-num">' + fmtNumber(c.words) + '</td>' +
          '<td class="st-bar-cell">' +
            '<div class="st-bar"><div class="st-bar-fill" style="width:' + Math.max(2, Math.min(100, sharePct)) + '%"></div></div>' +
            '<div class="st-bar-pct">' + (Math.round(sharePct * 10) / 10).toFixed(1) + '%</div>' +
          '</td>' +
        '</tr>'
      );
    }).join('');

    const expandRow = (hiddenCount > 0)
      ? '<button class="st-show-all" id="st-show-all-chars" type="button">' +
          (charsExpanded
            ? 'Show top ' + TOP_N + ' only'
            : 'Show all ' + hiddenCount + ' other speaking ' + plural(hiddenCount, 'character', 'characters') + ' →') +
        '</button>'
      : '';

    return (
      '<div class="st-section">' +
        '<div class="st-section-title">Characters</div>' +
        '<div class="st-table-wrap">' +
          '<table class="st-table" data-table="chars">' +
            '<thead><tr>' +
              th('name',   'Character', charSort, false, true) +
              th('scenes', 'Scenes',    charSort, true,  true) +
              th('lines',  'Lines',     charSort, true,  true) +
              th('words',  'Words',     charSort, true,  true) +
              th('pct',    'Share',     charSort, false, true) +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
        expandRow +
      '</div>'
    );
  }

  function wireCharactersExpand() {
    const btn = document.getElementById('st-show-all-chars');
    if (!btn) return;
    btn.addEventListener('click', function() {
      charsExpanded = !charsExpanded;
      if (lastScan && lastScan.data) renderResults(lastScan.data);
    });
  }

  function renderScenes(s) {
    const totalForIntExt = s.totalScenes || ((s.intCount || 0) + (s.extCount || 0) + (s.intExtCount || 0));
    const intPct = totalForIntExt ? (s.intCount / totalForIntExt) * 100 : 0;
    const extPct = totalForIntExt ? (s.extCount / totalForIntExt) * 100 : 0;
    const ieMixedPct = totalForIntExt ? (s.intExtCount / totalForIntExt) * 100 : 0;

    // Day/Night includes an "Unspecified" bucket for scenes without a
    // detectable time-of-day, so the four buckets always sum to the total.
    const todTotal = s.totalScenes || ((s.dayCount || 0) + (s.nightCount || 0) + (s.duskCount || 0) + (s.otherTodCount || 0) + (s.unspecifiedTodCount || 0));
    const dayPct   = todTotal ? (s.dayCount        / todTotal) * 100 : 0;
    const nightPct = todTotal ? (s.nightCount      / todTotal) * 100 : 0;
    const duskPct  = todTotal ? (s.duskCount       / todTotal) * 100 : 0;
    const otherPct = todTotal ? (s.otherTodCount   / todTotal) * 100 : 0;
    const unspecPct= todTotal ? (s.unspecifiedTodCount / todTotal) * 100 : 0;

    return (
      '<div class="st-section">' +
        '<div class="st-section-title">Scenes</div>' +
        // Scene Mix block — INT/EXT + Day/Night grouped (both answer the
        // "where + when" question)
        '<div class="st-scene-mix">' +
          '<div class="st-scene-card">' +
            '<div class="st-scene-card-label">Interior / Exterior</div>' +
            splitRow('Interior', s.intCount, intPct) +
            splitRow('Exterior', s.extCount, extPct) +
            (s.intExtCount ? splitRow('INT/EXT', s.intExtCount, ieMixedPct) : '') +
            '<div class="st-split-bar">' +
              '<div class="st-split-bar-fill int"  style="width:' + intPct + '%"></div>' +
              '<div class="st-split-bar-fill ext"  style="width:' + extPct + '%"></div>' +
              '<div class="st-split-bar-fill other" style="width:' + ieMixedPct + '%"></div>' +
            '</div>' +
          '</div>' +
          '<div class="st-scene-card">' +
            '<div class="st-scene-card-label">Day / Night</div>' +
            splitRow('Day',       s.dayCount,      dayPct) +
            splitRow('Night',     s.nightCount,    nightPct) +
            (s.duskCount ? splitRow('Dawn/Dusk',   s.duskCount,            duskPct) : '') +
            (s.otherTodCount ? splitRow('Continuous / Later', s.otherTodCount, otherPct) : '') +
            (s.unspecifiedTodCount ? splitRow('Unspecified', s.unspecifiedTodCount, unspecPct) : '') +
            '<div class="st-split-bar">' +
              '<div class="st-split-bar-fill day"    style="width:' + dayPct + '%"></div>' +
              '<div class="st-split-bar-fill night"  style="width:' + nightPct + '%"></div>' +
              '<div class="st-split-bar-fill dusk"   style="width:' + duskPct + '%"></div>' +
              '<div class="st-split-bar-fill other"  style="width:' + otherPct + '%"></div>' +
              '<div class="st-split-bar-fill unspec" style="width:' + unspecPct + '%"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        // Only the Longest scene card. Average and Shortest were removed
        // because the line-count heuristic isn't accurate enough at sub-page
        // resolution to make those numbers trustworthy.
        (s.longest
          ? '<div class="st-scenes-grid">' +
              '<div class="st-scene-card" style="grid-column: span 2;">' +
                '<div class="st-scene-card-label">Longest Scene</div>' +
                '<div class="st-scene-card-value">' + fmtPagesLabel(s.longest.pages) + '</div>' +
                '<div class="st-scene-card-sub"><span class="slug">' + escapeHTML(s.longest.slug) + '</span><br>page ' + s.longest.startPage + '</div>' +
              '</div>' +
            '</div>'
          : '') +
      '</div>'
    );
  }

  function splitRow(label, count, pct) {
    return (
      '<div class="st-split-row">' +
        '<span class="st-split-label">' + escapeHTML(label) + '</span>' +
        '<span class="st-split-value">' + fmtNumber(count) + ' ' + plural(count, 'scene', 'scenes') + ' (' + fmtPct(pct) + ')</span>' +
      '</div>'
    );
  }

  function renderLocations(locs) {
    if (!locs.length) {
      return (
        '<div class="st-section">' +
          '<div class="st-section-title">Locations</div>' +
          '<div class="st-section-empty">No locations detected.</div>' +
        '</div>'
      );
    }
    const sorted = sortLocations(locs.slice(), locSort);
    const rows = sorted.map(function(l) {
      return (
        '<tr>' +
          '<td class="st-name">' + escapeHTML(l.name) + '</td>' +
          '<td class="st-num">' + fmtNumber(l.scenes) + '</td>' +
          '<td class="st-num">' + fmtPagesInt(l.pages) + '</td>' +
        '</tr>'
      );
    }).join('');

    return (
      '<div class="st-section">' +
        '<div class="st-section-title">Locations</div>' +
        '<div class="st-table-wrap">' +
          '<table class="st-table" data-table="locs">' +
            '<thead><tr>' +
              th('name',   'Location', locSort, false, true) +
              th('scenes', 'Scenes',   locSort, true,  true) +
              th('pages',  'Pages',    locSort, true,  true) +
            '</tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>'
    );
  }

  // Every sortable column shows a default ▼ (dimmed) — the active column
  // shows ▲/▼ in full color. Keeps the affordance consistent across columns.
  function th(col, label, sortState, numeric, sortable) {
    const isSorted = sortState.col === col;
    const arrow = isSorted ? (sortState.dir === 'asc' ? '▲' : '▼') : (sortable ? '▼' : '');
    const classes = [];
    if (numeric) classes.push('st-num');
    if (isSorted) classes.push('is-sorted');
    const cls = classes.length ? ' class="' + classes.join(' ') + '"' : '';
    return (
      '<th data-col="' + col + '"' + cls + '>' +
        escapeHTML(label) +
        (arrow ? '<span class="st-sort-arrow">' + arrow + '</span>' : '') +
      '</th>'
    );
  }

  function wireSortable() {
    document.querySelectorAll('.st-table thead th').forEach(function(thEl) {
      thEl.addEventListener('click', function() {
        const tbl = thEl.closest('table').getAttribute('data-table');
        const col = thEl.getAttribute('data-col');
        const state = tbl === 'chars' ? charSort : locSort;
        if (state.col === col) {
          state.dir = (state.dir === 'asc') ? 'desc' : 'asc';
        } else {
          state.col = col;
          state.dir = (col === 'name') ? 'asc' : 'desc';
        }
        if (lastScan && lastScan.data) renderResults(lastScan.data);
      });
    });
  }

  function sortCharacters(arr, st) {
    const dir = st.dir === 'asc' ? 1 : -1;
    return arr.sort(function(a, b) {
      if (st.col === 'name') return a.name.localeCompare(b.name) * dir;
      const k = st.col === 'pct' ? 'dialoguePct' : st.col;
      return ((a[k] || 0) - (b[k] || 0)) * dir;
    });
  }
  function sortLocations(arr, st) {
    const dir = st.dir === 'asc' ? 1 : -1;
    return arr.sort(function(a, b) {
      if (st.col === 'name') return a.name.localeCompare(b.name) * dir;
      return ((a[st.col] || 0) - (b[st.col] || 0)) * dir;
    });
  }
})();
