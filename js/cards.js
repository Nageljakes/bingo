/* =========================================================
   CARDS ENGINE
   Every paper card is generated from (pack code, game set, card number)
   with a seeded PRNG. The DJ never needs to store printed cards: typing
   the card number regenerates the exact same card for verification.
   ========================================================= */
(function () {
  'use strict';

  const COLS75 = ['B', 'I', 'N', 'G', 'O'];

  function seedFrom(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rngFor(pack, setId, cardNo) {
    return mulberry32(seedFrom(String(pack).trim().toUpperCase() + '|' + setId + '|' + cardNo));
  }

  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function is90(set) { return set.type === 'traditional-90' || set.totalItems === 90; }
  function isTitleSet(set) { return /^(music|trivia)/.test(set.type || ''); }
  function hasFree(set) { return !is90(set) && set.hasFreeSpace !== false; }

  /* 75-ball style 5x5 card (classic numbers, music titles or trivia answers) */
  function gen75(set, rnd) {
    const cols = COLS75.map(function (c) {
      return shuffle(set.items.filter(function (i) { return i.col === c; }), rnd).slice(0, 5);
    });
    if (!isTitleSet(set)) cols.forEach(function (c) { c.sort(function (a, b) { return a.id - b.id; }); });
    const free = hasFree(set);
    const grid = [];
    for (let r = 0; r < 5; r++) {
      grid.push(cols.map(function (c, ci) { return (free && r === 2 && ci === 2) ? 0 : c[r].id; }));
    }
    return { kind: '75', grid: grid };
  }

  /* UK style 90-ball ticket: 3 rows x 9 columns, 15 numbers, 5 per row */
  function gen90(rnd) {
    for (let attempt = 0; attempt < 500; attempt++) {
      const counts = new Array(9).fill(1);
      let extra = 6, guard = 0;
      while (extra > 0 && guard++ < 1000) {
        const c = Math.floor(rnd() * 9);
        if (counts[c] < 3) { counts[c]++; extra--; }
      }
      const rowCount = [0, 0, 0];
      const layout = [new Array(9).fill(false), new Array(9).fill(false), new Array(9).fill(false)];
      const keys = counts.map(function () { return rnd(); });
      const order = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(function (a, b) { return (counts[b] - counts[a]) || (keys[a] - keys[b]); });
      let ok = true;
      for (const c of order) {
        const rk = [rnd(), rnd(), rnd()];
        const rows = [0, 1, 2].sort(function (a, b) { return (rowCount[a] - rowCount[b]) || (rk[a] - rk[b]); }).slice(0, counts[c]);
        for (const r of rows) {
          if (rowCount[r] >= 5) { ok = false; break; }
          layout[r][c] = true; rowCount[r]++;
        }
        if (!ok) break;
      }
      if (!ok || rowCount.some(function (x) { return x !== 5; })) continue;
      const grid = [new Array(9).fill(null), new Array(9).fill(null), new Array(9).fill(null)];
      for (let c = 0; c < 9; c++) {
        const lo = c === 0 ? 1 : c * 10;
        const hi = c === 8 ? 90 : c * 10 + 9;
        const pool = [];
        for (let n = lo; n <= hi; n++) pool.push(n);
        const picks = shuffle(pool, rnd).slice(0, counts[c]).sort(function (a, b) { return a - b; });
        let k = 0;
        for (let r = 0; r < 3; r++) if (layout[r][c]) grid[r][c] = picks[k++];
      }
      return { kind: '90', grid: grid };
    }
    throw new Error('Could not generate 90-ball ticket');
  }

  function generate(set, pack, cardNo) {
    const rnd = rngFor(pack, set.id, cardNo);
    return is90(set) ? gen90(rnd) : gen75(set, rnd);
  }

  /* Evaluate a card against called ids. Returns marks + line counts. */
  function evaluate(card, called) {
    if (card.kind === '75') {
      const m = card.grid.map(function (row) { return row.map(function (v) { return v === 0 || called.has(v); }); });
      const lines = [];
      for (let r = 0; r < 5; r++) if (m[r].every(Boolean)) lines.push('Row ' + (r + 1));
      for (let c = 0; c < 5; c++) if (m.every(function (row) { return row[c]; })) lines.push('Column ' + COLS75[c]);
      if ([0, 1, 2, 3, 4].every(function (i) { return m[i][i]; })) lines.push('Diagonal');
      if ([0, 1, 2, 3, 4].every(function (i) { return m[i][4 - i]; })) lines.push('Diagonal');
      const flat = m.flat();
      const marked = flat.filter(Boolean).length;
      return { marks: m, lines: lines, lineCount: lines.length, full: marked === 25, marked: marked, total: 25 };
    }
    const m = card.grid.map(function (row) { return row.map(function (v) { return v == null ? null : called.has(v); }); });
    const lines = [];
    m.forEach(function (row, r) { if (row.filter(function (x) { return x !== null; }).every(Boolean)) lines.push('Row ' + (r + 1)); });
    const cells = m.flat().filter(function (x) { return x !== null; });
    const marked = cells.filter(Boolean).length;
    return { marks: m, lines: lines, lineCount: lines.length, full: marked === 15, marked: marked, total: 15 };
  }

  function meetsStage(ev, stage) { return stage >= 3 ? ev.full : ev.lineCount >= stage; }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function pad(n) { return String(n).padStart(4, '0'); }

  /* Cell content for a given id */
  function cellHTML(set, byId, id, printMode) {
    if (!isTitleSet(set)) return String(id);
    const it = byId[id];
    if (!it) return String(id);
    const sub = it.artist ? '<small>' + esc(it.artist) + '</small>' : '';
    return esc(it.title) + (printMode ? sub : '');
  }

  /* Card markup. opts: {mode:'print'|'screen', venue, dj, pack, prizes, marks, palette} */
  function renderCard(set, byId, cardNo, card, opts) {
    opts = opts || {};
    const print = opts.mode === 'print';
    const pal = opts.palette;
    const titles = isTitleSet(set);
    let html = '';
    if (card.kind === '75') {
      html += '<table><thead><tr>' + COLS75.map(function (L, i) {
        return '<th style="background:' + pal[i].c + '">' + L + '</th>';
      }).join('') + '</tr></thead><tbody>';
      card.grid.forEach(function (row, r) {
        html += '<tr>' + row.map(function (id, c) {
          const hit = opts.marks && opts.marks[r][c];
          if (id === 0) return '<td class="free' + (hit && !print ? ' hit' : '') + '">FREE</td>';
          return '<td class="' + (hit && !print ? 'hit' : '') + '">' + cellHTML(set, byId, id, print) + '</td>';
        }).join('') + '</tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<table><tbody>';
      card.grid.forEach(function (row, r) {
        html += '<tr>' + row.map(function (n, c) {
          if (n == null) return '<td class="blank"></td>';
          const hit = opts.marks && opts.marks[r][c];
          return '<td class="' + (hit && !print ? 'hit' : '') + '">' + n + '</td>';
        }).join('') + '</tr>';
      });
      html += '</tbody></table>';
    }
    const cls = (card.kind === '90' ? ' t90' : '') + (titles ? ' titles' : '');
    if (print) {
      const prizes = opts.prizes || [];
      return '<div class="pcard cut' + cls + '">' +
        '<div class="pcard-head"><div><div class="pcard-venue">' + esc(opts.venue) + '</div>' +
        '<div class="pcard-meta">' + esc(set.name) + (opts.dj ? ' &middot; ' + esc(opts.dj) : '') + '</div></div>' +
        '<div class="pcard-no"><b>#' + pad(cardNo) + '</b><small>PACK ' + esc(String(opts.pack).toUpperCase()) + '</small></div></div>' +
        html +
        (card.kind === '75' ? '<div class="pcard-foot"><span>1 Line: ' + esc(prizes[0] || '') + '</span><span>Full House: ' + esc(prizes[2] || '') + '</span></div>' : '') +
        '</div>';
    }
    return '<div class="scard' + cls + '"><div class="bcard-head"><span>' + esc(set.name) + ' &middot; Pack ' + esc(String(opts.pack).toUpperCase()) + '</span><span class="no">#' + pad(cardNo) + '</span></div>' + html + '</div>';
  }

  window.Cards = {
    generate: generate,
    evaluate: evaluate,
    meetsStage: meetsStage,
    renderCard: renderCard,
    is90: is90,
    isTitleSet: isTitleSet,
    hasFree: hasFree,
    esc: esc,
    pad: pad
  };
})();
