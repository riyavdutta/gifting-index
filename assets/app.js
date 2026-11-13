/* The Gifting Index
   Loads daily Wikipedia pageviews for four brands straight from the Wikimedia API,
   then draws: this week's stamps, the seasonality small multiples, the long-run chart
   and the auto-detected Moments. Notes for Moments live in data/moments.json. */
(function () {
  'use strict';

  var BRANDS = [
    { id: 'jo',    name: 'Jo Malone London', article: 'Jo_Malone_London', cat: 'Fragrance & home',   color: '#65232b' },
    // Diptyque's article was missing or renamed from March to August 2020: those zeros mean "no page", not "no interest".
    { id: 'dip',   name: 'Diptyque',         article: 'Diptyque',         cat: 'Fragrance & home',   color: '#56707f', gaps: [['2020-03-01', '2020-09-01']] },
    { id: 'ck',    name: 'Charles & Keith',  article: 'Charles_%26_Keith', cat: 'Bags & accessories', color: '#b4546e' },
    { id: 'coach', name: 'Coach',            article: 'Coach_New_York',   cat: 'Bags & accessories', color: '#8a6d2f' }
  ];
  var DAY = 864e5;
  var SPIKE_X = 6, SPIKE_MIN = 300;          // a Moment: at least 6x the usual day, and at least 300 views
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  /* ---------- small helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function median(a) {
    if (!a.length) return NaN;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function mean(a) { var t = 0; for (var i = 0; i < a.length; i++) t += a[i]; return a.length ? t / a.length : NaN; }
  function ymd(d) { return d.toISOString().slice(0, 10).replace(/-/g, ''); }
  function fmtDate(t, withDay) {
    var d = new Date(t);
    return (withDay ? d.getUTCDate() + ' ' : '') + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }
  function fmtNum(n) { return Math.round(n).toLocaleString('en-GB'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function svgEl(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  /* ---------- data ---------- */
  function load(brand) {
    var end = ymd(new Date(Date.now() - DAY));
    var url = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/' +
      brand.article + '/daily/20150701/' + end;
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Wikimedia returned ' + r.status + ' for ' + brand.name);
      return r.json();
    }).then(function (j) {
      brand.days = j.items.map(function (it) {
        var s = it.timestamp;
        return { t: Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)), v: it.views };
      }).filter(function (x) {
        return !(brand.gaps || []).some(function (g) { return x.t >= Date.parse(g[0]) && x.t < Date.parse(g[1]); });
      });
      return brand;
    });
  }

  // Trailing 90-day median before each day: "the usual" for spike detection.
  function trailingBase(days) {
    var out = new Array(days.length);
    for (var i = 0; i < days.length; i++) {
      var w = [];
      for (var j = i - 1; j >= 0 && days[i].t - days[j].t <= 90 * DAY; j--) w.push(days[j].v);
      out[i] = w.length >= 30 ? median(w) : NaN;
    }
    return out;
  }

  /* ---------- 1. This week ---------- */
  function weekStats(b) {
    var d = b.days, last = d[d.length - 1].t;
    var recent = d.filter(function (x) { return x.t > last - 7 * DAY; }).map(function (x) { return x.v; });
    var base = d.filter(function (x) { return x.t <= last - 7 * DAY && x.t > last - 372 * DAY; }).map(function (x) { return x.v; });
    return { idx: mean(recent) / median(base), recent: mean(recent), base: median(base), last: last };
  }
  function sparkline(b) {
    var d = b.days.slice(-120), pts = [];
    for (var i = 6; i < d.length; i++) {
      var w = d.slice(i - 6, i + 1).map(function (x) { return x.v; });
      pts.push(mean(w));
    }
    var max = Math.max.apply(null, pts), min = Math.min.apply(null, pts), W = 200, H = 44;
    var path = pts.map(function (v, i) {
      var x = (i / (pts.length - 1)) * W, y = H - 3 - ((v - min) / ((max - min) || 1)) * (H - 6);
      return (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }).join('');
    return '<svg viewBox="0 0 200 44" preserveAspectRatio="none" aria-hidden="true"><path d="' + path +
      '" fill="none" stroke="' + b.color + '" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>';
  }
  function renderStamps() {
    $('stamps').innerHTML = BRANDS.map(function (b) {
      var s = weekStats(b), x = Math.round(s.idx * 100) / 100;   // label from the number shown
      var dir = x >= 1.1 ? ['up', '↑ Busier than usual'] : x <= 0.9 ? ['down', '↓ Quieter than usual'] : ['flat', '→ About usual'];
      return '<article class="stamp" style="--brand:' + b.color + '" aria-label="' + esc(b.name) + ': ' + x.toFixed(2) + ' times usual">' +
        '<span class="postmark" aria-hidden="true">WEEK TO<br>' + fmtDate(s.last, true).toUpperCase() + '</span>' +
        '<span class="cat">' + esc(b.cat) + '</span>' +
        '<span class="name">' + esc(b.name) + '</span>' +
        '<span class="num"><small>×</small>' + x.toFixed(2) + '</span>' +
        '<span class="dir ' + dir[0] + '">' + dir[1] + '</span>' +
        sparkline(b) + '</article>';
    }).join('');
  }

  /* ---------- 2. Seasons ---------- */
  function seasonality(b) {
    var byYear = {};
    b.days.forEach(function (x) { var y = new Date(x.t).getUTCFullYear(); (byYear[y] = byYear[y] || []).push(x); });
    var months = [[], [], [], [], [], [], [], [], [], [], [], []], years = [];
    Object.keys(byYear).forEach(function (y) {
      var rows = byYear[y];
      if (rows.length < 360) return;                    // full years only
      years.push(+y);
      var med = median(rows.map(function (x) { return x.v; }));
      rows.forEach(function (x) { months[new Date(x.t).getUTCMonth()].push(x.v / med); });
    });
    return { m: months.map(median), from: Math.min.apply(null, years), to: Math.max.apply(null, years) };
  }
  function renderSeasons() {
    var all = BRANDS.map(function (b) { return { b: b, s: seasonality(b) }; });
    var top = Math.max(1.6, Math.max.apply(null, all.map(function (a) { return Math.max.apply(null, a.s.m); })));
    var W = 240, H = 150, pad = 18, bw = (W - 4) / 12;
    var host = $('seasons'); host.innerHTML = '';
    all.forEach(function (a) {
      var y = function (v) { return H - pad - (v / top) * (H - pad - 6); };
      var card = document.createElement('div');
      card.className = 'season'; card.style.setProperty('--brand', a.b.color);
      card.innerHTML = '<h3>' + esc(a.b.name) + '</h3><p class="dec">December <b>×' + a.s.m[11].toFixed(2) + '</b></p>';
      var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
        'aria-label': a.b.name + ' monthly attention, ' + a.s.from + ' to ' + a.s.to + '. December is ' + a.s.m[11].toFixed(2) + ' times a typical day.' });
      a.s.m.forEach(function (v, i) {
        var top_ = y(v), x = 2 + i * bw;
        svg.appendChild(svgEl('rect', { x: (x + 2).toFixed(1), y: top_.toFixed(1), width: (bw - 4).toFixed(1), height: (H - pad - top_).toFixed(1),
          fill: a.b.color, opacity: i >= 10 ? 1 : 0.32, rx: 1.5 }));
        if (i % 3 === 0 || i === 11) {
          var t = svgEl('text', { x: (x + bw / 2).toFixed(1), y: H - 4, 'text-anchor': 'middle', 'font-family': 'Space Mono, monospace', 'font-size': 10, fill: '#856a56' });
          t.textContent = MONTHS[i][0]; svg.appendChild(t);
        }
      });
      svg.appendChild(svgEl('line', { x1: 0, x2: W, y1: y(1).toFixed(1), y2: y(1).toFixed(1), stroke: '#432720', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: .55 }));
      card.appendChild(svg);
      host.appendChild(card);
    });
    var frag = all.filter(function (a) { return a.b.cat[0] === 'F'; }).map(function (a) { return a.s.m[11]; });
    var bags = all.filter(function (a) { return a.b.cat[0] === 'B'; }).map(function (a) { return a.s.m[11]; });
    $('season-sub').textContent = 'Typical attention in each month, compared with that year’s typical day (dashed line = ×1). ' +
      'In December the fragrance brands rise to ×' + Math.min.apply(null, frag).toFixed(2) + '–' + Math.max.apply(null, frag).toFixed(2) +
      '; the bag brands reach only ×' + Math.min.apply(null, bags).toFixed(2) + '–' + Math.max.apply(null, bags).toFixed(2) +
      '. A likely reading: candles and scent get researched as gifts, bags get bought for yourself. Every full year of data is included.';
  }

  /* ---------- 3. Moments ---------- */
  function detectSpikes(b) {
    var d = b.days, base = trailingBase(d), raw = [];
    for (var i = 0; i < d.length; i++) {
      if (base[i] > 0 && d[i].v >= SPIKE_MIN && d[i].v >= SPIKE_X * base[i]) raw.push(i);
    }
    var clusters = [];
    raw.forEach(function (i) {
      var c = clusters[clusters.length - 1];
      if (c && d[i].t - d[c.end].t <= 14 * DAY) { c.end = i; if (d[i].v > d[c.peak].v) c.peak = i; }
      else clusters.push({ start: i, end: i, peak: i });
    });
    // Lasting lift compares the 90 days before with days 30-120 after, with each brand's normal
    // monthly pattern divided out, so a spike in September isn't credited with December's gifting rise.
    var season = seasonality(b).m;
    function adj(x) { return x.v / season[new Date(x.t).getUTCMonth()]; }
    return clusters.map(function (c) {
      var p = d[c.peak], usual = base[c.start];
      var lasted = 0;
      for (var k = c.peak; k < d.length && d[k].v >= 2 * usual; k++) lasted++;
      var before = d.filter(function (x) { return x.t < d[c.start].t && x.t >= d[c.start].t - 90 * DAY; }).map(adj);
      var after = d.filter(function (x) { return x.t > p.t + 30 * DAY && x.t <= p.t + 120 * DAY; }).map(adj);
      var lift = after.length >= 60 && before.length >= 60 ? median(after) / median(before) - 1 : null;
      var why = before.length < 60 ? 'No history' : 'Too soon';
      return { brand: b, t: p.t, peak: p.v, x: p.v / usual, lasted: lasted, lift: lift, why: why };
    });
  }
  function moments(notes) {
    var spikes = [];
    BRANDS.forEach(function (b) { spikes = spikes.concat(detectSpikes(b)); });
    spikes.forEach(function (s) {
      s.note = notes.filter(function (n) {
        return n.brand === s.brand.id && Math.abs(Date.parse(n.date) - s.t) <= 21 * DAY;
      })[0] || null;
    });
    var explained = spikes.filter(function (s) { return s.note; });
    var open = spikes.filter(function (s) { return !s.note; }).sort(function (a, b) { return b.x - a.x; }).slice(0, Math.max(2, 6 - explained.length));
    return explained.concat(open).sort(function (a, b) { return b.t - a.t; });
  }
  function renderMoments(list) {
    $('moments').innerHTML = list.map(function (s) {
      var n = s.note;
      var lift = s.lift === null ? s.why : (s.lift >= 0 ? '+' : '') + Math.round(s.lift * 100) + '%';
      return '<article class="moment' + (n ? '' : ' unexplained') + '" style="--brand:' + s.brand.color + '">' +
        '<p class="when">' + esc(s.brand.name) + ' · ' + fmtDate(s.t, true) + '</p>' +
        '<h3>' + (n ? esc(n.title) : 'Unexplained spike') + '</h3>' +
        (n ? '<p>' + esc(n.note) + (n.source ? ' <a href="' + esc(n.source) + '">Source ↗</a>' : '') + '</p>'
           : '<p class="ask">Detected in the data, not yet explained. What happened here?</p>') +
        '<dl class="facts">' +
          '<div><dt>Peak</dt><dd>×' + Math.round(s.x) + '</dd></div>' +
          '<div><dt>Days above ×2</dt><dd>' + s.lasted + '</dd></div>' +
          '<div><dt>Lift after</dt><dd>' + lift + '</dd></div>' +
        '</dl></article>';
    }).join('');
  }

  /* ---------- 4. Over time ---------- */
  var state = { years: 3, on: { jo: true, dip: true, ck: true, coach: true }, marks: [] };
  function weekly(b, from) {
    var weeks = {};
    b.days.forEach(function (x) {
      if (x.t < from) return;
      var dow = (new Date(x.t).getUTCDay() + 6) % 7, wk = x.t - dow * DAY;   // Monday
      (weeks[wk] = weeks[wk] || []).push(x.v);
    });
    var rows = Object.keys(weeks).map(function (k) { return { t: +k, v: mean(weeks[k]), n: weeks[k].length }; })
      .filter(function (r) { return r.n >= 4; }).sort(function (a, b) { return a.t - b.t; });
    var base = median(rows.map(function (r) { return r.v; }));
    rows.forEach(function (r) { r.i = (r.v / base) * 100; });
    return rows;
  }
  function renderChart() {
    var host = $('chart'); host.innerHTML = '';
    var last = Math.max.apply(null, BRANDS.map(function (b) { return b.days[b.days.length - 1].t; }));
    var from = state.years ? last - state.years * 365.25 * DAY : Date.UTC(2016, 0, 1);   // 2015: articles too new
    var series = BRANDS.filter(function (b) { return state.on[b.id]; }).map(function (b) { return { b: b, rows: weekly(b, from) }; });
    // Draw at the real width so labels stay 11px on a phone instead of shrinking with the chart.
    var W = Math.max(300, Math.min(1000, host.clientWidth || 1000)), narrow = W < 600;
    var H = narrow ? 300 : 380, L = narrow ? 36 : 52, R = 8, T = 14, B = 30;
    var allI = []; series.forEach(function (s) { s.rows.forEach(function (r) { allI.push(r.i); }); });
    // Gridlines double from 100, so the "typical week" line is always labelled.
    var lo = 100 * Math.pow(2, Math.floor(Math.log2(Math.max(12.5, Math.min.apply(null, allI.concat([50]))) / 100)));
    var hi = 100 * Math.pow(2, Math.ceil(Math.log2(Math.max.apply(null, allI.concat([200])) / 100)));
    var x = function (t) { return L + ((t - from) / (last - from)) * (W - L - R); };
    var y = function (v) { return T + (1 - (Math.log2(v) - Math.log2(lo)) / (Math.log2(hi) - Math.log2(lo))) * (H - T - B); };

    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': 'Weekly attention for ' + series.map(function (s) { return s.b.name; }).join(', ') + ', indexed so 100 is each brand’s typical week.' });
    var grid = svgEl('g', { class: 'grid' }), axis = svgEl('g', { class: 'axis' });
    for (var g = lo; g <= hi; g *= 2) {
      grid.appendChild(svgEl('line', { x1: L, x2: W - R, y1: y(g), y2: y(g), class: g === 100 ? 'base' : '' }));
      var lab = svgEl('text', { x: L - 8, y: y(g) + 4, 'text-anchor': 'end' }); lab.textContent = g >= 1000 ? (g / 1000) + 'k' : g; axis.appendChild(lab);
    }
    var y0 = new Date(from).getUTCFullYear() + 1, y1 = new Date(last).getUTCFullYear();
    var step = (y1 - y0) > (narrow ? 3 : 6) ? 2 : 1;
    for (var yr = y0; yr <= y1; yr += step) {
      var tx = x(Date.UTC(yr, 0, 1));
      grid.appendChild(svgEl('line', { x1: tx, x2: tx, y1: T, y2: H - B, opacity: .5 }));
      var yl = svgEl('text', { x: tx, y: H - 8, 'text-anchor': 'middle' }); yl.textContent = yr; axis.appendChild(yl);
    }
    if (state.years === 1 && !narrow) {
      for (var m = 0; m < 12; m += 3) {
        var mt = Date.UTC(new Date(last).getUTCFullYear(), m, 1);
        [mt, mt - 365.25 * DAY].forEach(function (t) {
          if (t > from && t < last && new Date(t).getUTCMonth() !== 0) {
            var ml = svgEl('text', { x: x(t), y: H - 8, 'text-anchor': 'middle' }); ml.textContent = MONTHS[new Date(t).getUTCMonth()]; axis.appendChild(ml);
          }
        });
      }
    }
    svg.appendChild(grid); svg.appendChild(axis);
    series.forEach(function (s) {
      // Lift the pen across missing weeks so a data gap isn't drawn as a real dip.
      var d = s.rows.map(function (r, i) {
        var jump = !i || r.t - s.rows[i - 1].t > 14 * DAY;
        return (jump ? 'M' : 'L') + x(r.t).toFixed(1) + ',' + y(Math.max(lo, r.i)).toFixed(1);
      }).join('');
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: s.b.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    });
    state.marks.forEach(function (mk) {
      var s = series.filter(function (z) { return z.b === mk.brand; })[0];
      if (!s || mk.t < from) return;
      var r = s.rows.reduce(function (best, r) { return Math.abs(r.t - mk.t) < Math.abs(best.t - mk.t) ? r : best; }, s.rows[0]);
      svg.appendChild(svgEl('circle', { cx: x(r.t), cy: y(r.i), r: 5, fill: '#fffdf0', stroke: mk.brand.color, 'stroke-width': 2 }));
    });
    var cursor = svgEl('line', { x1: 0, x2: 0, y1: T, y2: H - B, stroke: '#432720', 'stroke-width': 1, opacity: 0 });
    svg.appendChild(cursor);
    host.appendChild(svg);

    var tip = $('tip');
    function move(ev) {
      var rect = svg.getBoundingClientRect(), px = ((ev.clientX - rect.left) / rect.width) * W;
      if (px < L || px > W - R) { hide(); return; }
      var t = from + ((px - L) / (W - L - R)) * (last - from);
      var lines = series.map(function (s) {
        var r = s.rows.reduce(function (best, r) { return Math.abs(r.t - t) < Math.abs(best.t - t) ? r : best; }, s.rows[0]);
        return { b: s.b, r: r };
      }).filter(function (z) { return z.r; });
      if (!lines.length) return;
      var wk = lines[0].r.t;
      cursor.setAttribute('x1', x(wk)); cursor.setAttribute('x2', x(wk)); cursor.setAttribute('opacity', .35);
      tip.innerHTML = '<b>Week of ' + fmtDate(wk, true) + '</b>' + lines.sort(function (a, b) { return b.r.i - a.r.i; }).map(function (z) {
        return '<i style="background:' + z.b.color + '"></i>' + esc(z.b.name) + '<span>' + Math.round(z.r.i) + '</span>';
      }).join('<br>');
      tip.hidden = false;
      var tw = tip.offsetWidth, left = ev.clientX + 16;
      if (left + tw > window.innerWidth - 8) left = ev.clientX - tw - 16;
      tip.style.left = Math.max(8, left) + 'px'; tip.style.top = Math.max(8, ev.clientY - tip.offsetHeight - 12) + 'px';
    }
    function hide() { tip.hidden = true; cursor.setAttribute('opacity', 0); }
    svg.addEventListener('pointermove', move);
    svg.addEventListener('pointerdown', move);
    svg.addEventListener('pointerleave', hide);
  }
  function wireControls() {
    $('legend').innerHTML = BRANDS.map(function (b) {
      return '<button type="button" aria-pressed="true" data-id="' + b.id + '" style="--brand:' + b.color + '">' + esc(b.name) + '</button>';
    }).join('');
    $('legend').addEventListener('click', function (e) {
      var btn = e.target.closest('button'); if (!btn) return;
      var id = btn.dataset.id, on = !state.on[id];
      if (!on && BRANDS.filter(function (b) { return state.on[b.id]; }).length === 1) return;  // keep at least one line
      state.on[id] = on; btn.setAttribute('aria-pressed', on); renderChart();
    });
    $('range').addEventListener('click', function (e) {
      var btn = e.target.closest('button'); if (!btn) return;
      state.years = +btn.dataset.range;
      [].forEach.call($('range').children, function (c) { c.setAttribute('aria-pressed', c === btn); });
      renderChart();
    });
  }

  /* ---------- boot ---------- */
  var notes = fetch('data/moments.json').then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
  $('stamps').innerHTML = BRANDS.map(function () { return '<div class="stamp skeleton" aria-hidden="true"></div>'; }).join('');

  Promise.all([Promise.all(BRANDS.map(load)), notes]).then(function (res) {
    var list = moments(res[1]);
    state.marks = list;
    var last = Math.max.apply(null, BRANDS.map(function (b) { return b.days[b.days.length - 1].t; }));
    $('updated').textContent = 'Live · data to ' + fmtDate(last, true) + ' · ' + fmtNum(BRANDS.reduce(function (t, b) { return t + b.days.length; }, 0)) + ' days of pageviews';
    renderStamps(); renderSeasons(); wireControls(); renderChart(); renderMoments(list);
    var t, lastW = $('chart').clientWidth;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        $('tip').hidden = true;
        if ($('chart').clientWidth !== lastW) { lastW = $('chart').clientWidth; renderChart(); }
      }, 150);
    });
  }).catch(function (err) {
    $('updated').textContent = 'Couldn’t load live data';
    $('stamps').innerHTML = '<p class="error">The Wikimedia API didn’t respond (' + esc(err.message) + '). Try refreshing in a minute.</p>';
  });
})();
