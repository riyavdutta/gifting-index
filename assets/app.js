/* The Gifting Index
   Loads daily Wikipedia pageviews for four brands (from /api/pageviews, which Vercel caches;
   falls back to the Wikimedia API directly, e.g. on a local preview), then draws:
   this week's stamps, the "Call it" game, the seasons, the live gifting season,
   the long-run chart and the auto-detected Moments.
   Words you edit live in data/moments.json and data/dispatch.json. */
(function () {
  'use strict';

  var BRANDS = [
    // group: 'classic' = widely known gift names, 'cult' = niche houses with an insider following.
    { id: 'jo',     name: 'Jo Malone London', article: 'Jo_Malone_London', group: 'classic', cat: 'Classic gift name', color: '#65232b' },
    // Diptyque's article was missing or renamed from March to August 2020: those zeros mean "no page", not "no interest".
    { id: 'dip',    name: 'Diptyque',         article: 'Diptyque',         group: 'classic', cat: 'Classic gift name', color: '#56707f', gaps: [['2020-03-01', '2020-09-01']] },
    { id: 'lelabo', name: 'Le Labo',          article: 'Le_Labo',          group: 'cult',    cat: 'Cult niche house',  color: '#b4546e' },
    { id: 'byredo', name: 'Byredo',           article: 'Byredo',           group: 'cult',    cat: 'Cult niche house',  color: '#8a6d2f' }
  ];
  var DAY = 864e5;
  var SPIKE_X = 6, SPIKE_MIN = 300;          // a Moment: at least 6x the usual day, and at least 300 views
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var MOTION = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var GUESS_KEY = 'gifting-index-guess';

  /* ---------- small helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function median(a) {
    if (!a.length) return NaN;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function quantile(a, q) {
    var s = a.slice().sort(function (x, y) { return x - y; }), p = (s.length - 1) * q, lo = Math.floor(p);
    return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (p - lo);
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
  function svgText(parent, x, y, text, anchor) {
    var t = svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'middle' });
    t.textContent = text; parent.appendChild(t); return t;
  }
  function store(key, val) {
    try { if (val === undefined) return JSON.parse(localStorage.getItem(key)); localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { return null; }
  }
  // Run fn the first time el scrolls into view (straight away if that isn't supported).
  function onView(el, fn) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); fn(); }
    }, { threshold: 0.25 });
    io.observe(el);
  }
  // Animate lines drawing themselves in (paths marked data-draw). Uses each path's measured
  // length, and clears the dash afterwards so nothing can stay half-hidden.
  function drawIn(svg) {
    if (!MOTION) return;
    var paths = [].slice.call(svg.querySelectorAll('path[data-draw]'));
    paths.forEach(function (p) {
      var len = p.getTotalLength() + 2;
      p.style.strokeDasharray = len + ' ' + len; p.style.strokeDashoffset = len;
    });
    onView(svg, function () {
      paths.forEach(function (p, i) {
        p.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(.2,.7,.2,1) ' + (i * 0.12) + 's';
        requestAnimationFrame(function () { requestAnimationFrame(function () { p.style.strokeDashoffset = '0'; }); });
        p.addEventListener('transitionend', function () { p.style.strokeDasharray = ''; p.style.strokeDashoffset = ''; p.style.transition = ''; }, { once: true });
      });
    });
  }

  /* ---------- data ---------- */
  function parse(brand, pairs) {
    brand.days = pairs.map(function (p) {
      var s = p[0];
      return { t: Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)), v: p[1] };
    }).filter(function (x) {
      return !(brand.gaps || []).some(function (g) { return x.t >= Date.parse(g[0]) && x.t < Date.parse(g[1]); });
    });
    brand.byT = {};
    brand.days.forEach(function (x) { brand.byT[x.t] = x.v; });
  }
  function loadDirect() {
    var end = ymd(new Date(Date.now() - DAY));
    return Promise.all(BRANDS.map(function (b) {
      return fetch('https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/' +
        b.article + '/daily/20150701/' + end).then(function (r) {
        if (!r.ok) throw new Error('Wikimedia returned ' + r.status + ' for ' + b.name);
        return r.json();
      }).then(function (j) { parse(b, j.items.map(function (i) { return [i.timestamp.slice(0, 8), i.views]; })); });
    }));
  }
  function loadAll() {
    return fetch('api/pageviews').then(function (r) {
      if (!r.ok) throw new Error('cache ' + r.status);
      return r.json();
    }).then(function (j) {
      BRANDS.forEach(function (b) { parse(b, j.series[b.id]); });
    }).catch(loadDirect);
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
  // 7-day average ending on day t (needs at least 4 of the 7 days).
  function roll7(b, t) {
    var w = [];
    for (var k = 0; k < 7; k++) { var v = b.byT[t - k * DAY]; if (v !== undefined) w.push(v); }
    return w.length >= 4 ? mean(w) : NaN;
  }

  /* ---------- 1. This week ---------- */
  function weekStats(b) {
    var d = b.days, last = d[d.length - 1].t;
    var recent = d.filter(function (x) { return x.t > last - 7 * DAY; }).map(function (x) { return x.v; });
    var base = d.filter(function (x) { return x.t <= last - 7 * DAY && x.t > last - 372 * DAY; }).map(function (x) { return x.v; });
    return { idx: mean(recent) / median(base), last: last };
  }
  function sparkline(b) {
    var d = b.days.slice(-120), pts = [];
    for (var i = 6; i < d.length; i++) pts.push(mean(d.slice(i - 6, i + 1).map(function (x) { return x.v; })));
    var max = Math.max.apply(null, pts), min = Math.min.apply(null, pts), W = 200, H = 44;
    var path = pts.map(function (v, i) {
      var x = (i / (pts.length - 1)) * W, y = H - 3 - ((v - min) / ((max - min) || 1)) * (H - 6);
      return (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    }).join('');
    return '<svg viewBox="0 0 200 44" preserveAspectRatio="none" aria-hidden="true"><path data-draw d="' + path +
      '" fill="none" stroke="' + b.color + '" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>';
  }
  function countUp(el, to) {
    if (!MOTION) { el.textContent = to.toFixed(2); return; }
    var t0 = null;
    (function step(ts) {
      t0 = t0 || ts;
      var p = Math.min(1, (ts - t0) / 900), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * e).toFixed(2);
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }
  function renderStamps() {
    var host = $('stamps');
    host.innerHTML = BRANDS.map(function (b) {
      var s = weekStats(b), x = Math.round(s.idx * 100) / 100;   // label from the number shown
      var dir = x >= 1.1 ? ['up', '↑ Busier than usual'] : x <= 0.9 ? ['down', '↓ Quieter than usual'] : ['flat', '→ About usual'];
      return '<article class="stamp" style="--brand:' + b.color + '" aria-label="' + esc(b.name) + ': ' + x.toFixed(2) + ' times usual">' +
        '<span class="postmark" aria-hidden="true">WEEK TO<br>' + fmtDate(s.last, true).toUpperCase() + '</span>' +
        '<span class="cat">' + esc(b.cat) + '</span>' +
        '<span class="name">' + esc(b.name) + '</span>' +
        '<span class="num"><small>×</small><span class="val" data-to="' + x + '">' + x.toFixed(2) + '</span></span>' +
        '<span class="dir ' + dir[0] + '">' + dir[1] + '</span>' +
        sparkline(b) + '</article>';
    }).join('');
    host.classList.add('stamped');                       // starts the postmark animation (CSS)
    [].forEach.call(host.querySelectorAll('.val'), function (el) { countUp(el, +el.dataset.to); });
    [].forEach.call(host.querySelectorAll('svg'), drawIn);
  }
  function renderDispatch(d) {
    if (!d || !d.text) return;
    var el = $('dispatch');
    el.innerHTML = '<p class="kicker">Dispatch · ' + esc(fmtDate(Date.parse(d.date), true)) + '</p><p>' + esc(d.text) + '</p>';
    el.hidden = false;
  }

  /* ---------- 2. Seasons (monthly pattern, all full years) ---------- */
  function seasonality(b) {
    if (b._season) return b._season;
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
    b._season = { m: months.map(median), from: Math.min.apply(null, years), to: Math.max.apply(null, years), byYear: byYear };
    return b._season;
  }
  // One year's December, the same way: median December day vs that year's median day.
  function decemberOf(b, year) {
    var rows = seasonality(b).byYear[year];
    if (!rows || rows.length < 360) return null;
    var med = median(rows.map(function (x) { return x.v; }));
    return median(rows.filter(function (x) { return new Date(x.t).getUTCMonth() === 11; }).map(function (x) { return x.v / med; }));
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
        var r = svgEl('rect', { x: (x + 2).toFixed(1), y: top_.toFixed(1), width: (bw - 4).toFixed(1), height: (H - pad - top_).toFixed(1),
          fill: a.b.color, opacity: i >= 10 ? 1 : 0.32, rx: 1.5, class: 'bar' });
        r.style.setProperty('--i', i);
        svg.appendChild(r);
        if (i % 3 === 0 || i === 11) {
          var t = svgEl('text', { x: (x + bw / 2).toFixed(1), y: H - 4, 'text-anchor': 'middle', 'font-family': 'Space Mono, monospace', 'font-size': 10, fill: '#856a56' });
          t.textContent = MONTHS[i][0]; svg.appendChild(t);
        }
      });
      svg.appendChild(svgEl('line', { x1: 0, x2: W, y1: y(1).toFixed(1), y2: y(1).toFixed(1), stroke: '#432720', 'stroke-width': 1, 'stroke-dasharray': '3 3', opacity: .55 }));
      card.appendChild(svg);
      host.appendChild(card);
    });
    function range(group) {
      var v = all.filter(function (a) { return a.b.group === group; }).map(function (a) { return a.s.m[11]; });
      var lo = Math.min.apply(null, v).toFixed(2), hi = Math.max.apply(null, v).toFixed(2);
      return lo === hi ? '×' + lo : '×' + lo + '–' + hi;
    }
    $('season-sub').textContent = 'Typical attention in each month, compared with that year’s typical day (dashed line = ×1). ' +
      'In December the classic gift names rise to ' + range('classic') + '; the cult niche houses to ' + range('cult') + '. ' +
      $('season-sub').dataset.reading + ' Every full year of data is included.';
  }
  function unseal(scroll) {
    var wrap = $('finding');
    if (!wrap.classList.contains('sealed')) return;
    wrap.classList.remove('sealed');
    wrap.classList.add('opened');
    $('seal').hidden = true;
    $('season-h').textContent = $('season-h').dataset.open;   // the headline gives the answer away, so it waits
    if (scroll) wrap.scrollIntoView({ behavior: MOTION ? 'smooth' : 'auto', block: 'start' });
  }

  /* ---------- 3. Call it (prediction game) ---------- */
  function renderGame() {
    var saved = store(GUESS_KEY);
    var host = $('game');
    host.innerHTML = BRANDS.map(function (b) {
      var g = saved && saved.g[b.id] ? saved.g[b.id] : 1;
      return '<div class="guess" style="--brand:' + b.color + '" data-id="' + b.id + '">' +
        '<label for="g-' + b.id + '"><span class="gname">' + esc(b.name) + '</span><span class="gval' + (saved ? ' set' : '') + '" id="gv-' + b.id + '">' + (saved ? '×' + g.toFixed(2) : '×?') + '</span></label>' +
        '<input type="range" id="g-' + b.id + '" min="0.8" max="2" step="0.05" value="' + g + '" aria-describedby="game-help">' +
        '<div class="scale" aria-hidden="true"><span>quieter</span><span>usual</span><span>twice as busy</span></div>' +
        '<p class="answer" id="ga-' + b.id + '" hidden></p></div>';
    }).join('') +
      '<div class="game-actions"><button type="button" class="btn" id="reveal">Seal my guesses and reveal</button>' +
      '<button type="button" class="btn btn--line" id="skip">Skip, just show me</button></div>' +
      '<p class="verdict" id="verdict" aria-live="polite"></p>';
    // Every slider has to be moved before the reveal, so nobody scores for a default they never chose.
    var touched = {};
    function readyCheck() {
      var left = BRANDS.filter(function (b) { return !touched[b.id]; }).length;
      $('reveal').disabled = left > 0;
      $('reveal').textContent = left ? 'Call ' + left + ' more to reveal' : 'Seal my guesses and reveal';
    }
    BRANDS.forEach(function (b) {
      $('g-' + b.id).addEventListener('input', function (e) {
        touched[b.id] = true;
        $('gv-' + b.id).textContent = '×' + (+e.target.value).toFixed(2);
        $('gv-' + b.id).classList.add('set');
        readyCheck();
      });
    });
    readyCheck();
    $('reveal').addEventListener('click', function () {
      var g = {};
      BRANDS.forEach(function (b) { g[b.id] = +$('g-' + b.id).value; });
      store(GUESS_KEY, { g: g, at: Date.now(), year: new Date().getUTCFullYear() });
      reveal(g, true);
    });
    $('skip').addEventListener('click', function () { unseal(true); });
    if (saved) reveal(saved.g, false, saved.year);
  }
  function reveal(g, scroll, year) {
    var errs = BRANDS.map(function (b) {
      var actual = seasonality(b).m[11], err = Math.abs(g[b.id] - actual);
      var el = $('ga-' + b.id);
      el.innerHTML = '10-year answer <b>×' + actual.toFixed(2) + '</b> · ' +
        (err <= 0.05 ? 'spot on' : err <= 0.15 ? 'close' : 'off by ' + err.toFixed(2));
      // Once December of the guess year is complete, score against that year too.
      var real = year ? decemberOf(b, year) : null;
      if (real) el.innerHTML += '<br>December ' + year + ' came in at <b>×' + real.toFixed(2) + '</b>';
      el.hidden = false;
      $('g-' + b.id).disabled = true;
      return { b: b, err: err };
    });
    var total = errs.reduce(function (t, e) { return t + e.err; }, 0);
    var best = errs.slice().sort(function (a, b) { return a.err - b.err; })[0];
    var score = Math.max(0, Math.round(100 - total * 100));
    $('verdict').innerHTML = '<b>' + score + '/100.</b> ' +
      (score >= 80 ? 'You read gifting season like a planner. ' : score >= 55 ? 'Good instincts. ' : 'December is harder to call than it looks. ') +
      'Your sharpest call was ' + esc(best.b.name) + '. ' +
      (year ? '' : 'Your guesses are saved on this device: come back in January to see how December ' + new Date().getUTCFullYear() + ' scored.');
    $('reveal').hidden = true; $('skip').hidden = true;
    $('game').classList.add('revealed');
    unseal(scroll);
  }

  /* ---------- 4. This gifting season, live ---------- */
  // A season runs 1 Oct to 6 Jan. Each day is a 7-day average divided by that year's
  // 15 Aug-30 Sep median, so every year starts from its own "normal".
  var SEASON_DAYS = 98;   // 1 Oct .. 6 Jan
  function seasonLine(b, y) {
    var base = [];
    for (var t = Date.UTC(y, 7, 15); t <= Date.UTC(y, 8, 30); t += DAY) if (b.byT[t] !== undefined) base.push(b.byT[t]);
    if (base.length < 30) return null;
    var med = median(base), out = [], start = Date.UTC(y, 9, 1);
    for (var k = 0; k < SEASON_DAYS; k++) out.push(roll7(b, start + k * DAY) / med);
    return out;
  }
  function liveSeason(b, last) {
    var d = new Date(last), cy = d.getUTCMonth() >= 9 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
    var past = [];
    for (var y = 2016; y < cy; y++) {
      var l = seasonLine(b, y);
      if (l && l.filter(function (v) { return !isNaN(v); }).length >= 90) past.push(l);
    }
    var band = [];
    for (var k = 0; k < SEASON_DAYS; k++) {
      var vals = past.map(function (l) { return l[k]; }).filter(function (v) { return !isNaN(v); });
      band.push(vals.length >= 3 ? { lo: quantile(vals, .25), mid: quantile(vals, .5), hi: quantile(vals, .75) } : null);
    }
    var cur = seasonLine(b, cy) || [];
    var lastK = -1;
    for (var j = 0; j < cur.length; j++) if (!isNaN(cur[j]) && Date.UTC(cy, 9, 1) + j * DAY <= last) lastK = j;
    return { year: cy, years: past.length, band: band, cur: cur.slice(0, lastK + 1), lastK: lastK };
  }
  function renderLive() {
    var last = Math.max.apply(null, BRANDS.map(function (b) { return b.days[b.days.length - 1].t; }));
    var host = $('live'); host.innerHTML = '';
    var any = null, status = [];
    BRANDS.forEach(function (b) {
      var s = liveSeason(b, last); any = s;
      var card = document.createElement('div');
      card.className = 'live'; card.style.setProperty('--brand', b.color);
      var now = s.lastK >= 0 ? s.cur[s.lastK] : NaN, ref = s.lastK >= 0 && s.band[s.lastK] ? s.band[s.lastK] : null;
      var read = !ref || isNaN(now) ? ['flat', 'Season not started'] :
        now > ref.hi ? ['up', 'Running hot'] : now < ref.lo ? ['down', 'Running cold'] : ['flat', 'A typical season'];
      if (ref && !isNaN(now)) status.push({ b: b, read: read[1] });
      card.innerHTML = '<div class="live-head"><h3>' + esc(b.name) + '</h3><span class="dir ' + read[0] + '">' + read[1] + '</span></div>' +
        '<p class="live-num">' + (isNaN(now) ? '—' : '<b>×' + now.toFixed(2) + '</b> now · typical ×' + ref.mid.toFixed(2)) + '</p>';
      var chart = document.createElement('div'); chart.className = 'live-chart';
      card.appendChild(chart); host.appendChild(card);
      drawLive(chart, b, s);
    });
    var xmas = Date.UTC(any.year, 11, 25), days = Math.round((xmas - last) / DAY);
    $('live-kicker').textContent = days > 0 ? 'Live · ' + days + ' days to Christmas' : 'Live · season ' + any.year;
    $('live-h').textContent = 'Gifting season ' + any.year + ', so far';
    var hot = status.filter(function (s) { return s.read === 'Running hot'; }).map(function (s) { return s.b.name; });
    var cold = status.filter(function (s) { return s.read === 'Running cold'; }).map(function (s) { return s.b.name; });
    $('live-sub').textContent = 'Each line is this season so far, against the shaded range of the last ' + any.years +
      ' seasons (middle half of years) and the dashed typical year. ×1 is the brand’s normal for late summer. ' +
      (hot.length ? 'Running hot: ' + hot.join(', ') + '. ' : '') + (cold.length ? 'Running cold: ' + cold.join(', ') + '. ' : '') +
      (!hot.length && !cold.length ? 'So far every brand is within its usual range. ' : '') +
      // All four moving together points at Wikipedia's own traffic, not the brands.
      (hot.length === status.length || cold.length === status.length ?
        'When all four move together, the likelier cause is Wikipedia itself (fewer or more people clicking through) rather than every brand at once, so compare the brands with each other. ' : '') +
      'Updates every day until Twelfth Night.';
  }
  function drawLive(host, b, s) {
    var W = Math.max(260, Math.min(560, host.clientWidth || 520)), H = 190, L = 34, R = 8, T = 10, B = 24;
    var vals = [];
    s.band.forEach(function (p) { if (p) vals.push(p.hi); });
    s.cur.forEach(function (v) { if (!isNaN(v)) vals.push(v); });
    var top = Math.max(1.6, Math.ceil(Math.max.apply(null, vals) * 4) / 4), bot = 0.5;
    var x = function (k) { return L + (k / (SEASON_DAYS - 1)) * (W - L - R); };
    var y = function (v) { return T + (1 - (Math.min(v, top) - bot) / (top - bot)) * (H - T - B); };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img',
      'aria-label': b.name + ', gifting season ' + s.year + ' so far against the previous ' + s.years + ' seasons.' });
    var grid = svgEl('g', { class: 'grid' }), axis = svgEl('g', { class: 'axis' });
    for (var g = 0.5; g <= top + 1e-9; g += 0.5) {
      grid.appendChild(svgEl('line', { x1: L, x2: W - R, y1: y(g), y2: y(g), class: g === 1 ? 'base' : '' }));
      svgText(axis, L - 6, y(g) + 4, '×' + g, 'end');
    }
    [['Oct', 0], ['Nov', 31], ['Dec', 61], ['Jan', 92]].forEach(function (m) { svgText(axis, x(m[1]) + 12, H - 6, m[0]); });
    var xk = 85;   // 25 Dec
    grid.appendChild(svgEl('line', { x1: x(xk), x2: x(xk), y1: T, y2: H - B, class: 'xmas' }));
    svgText(axis, x(xk) - 4, T + 10, '25 Dec', 'end');
    svg.appendChild(grid); svg.appendChild(axis);
    // band
    var up = [], dn = [], mid = [];
    s.band.forEach(function (p, k) { if (p) { up.push(x(k).toFixed(1) + ',' + y(p.hi).toFixed(1)); dn.unshift(x(k).toFixed(1) + ',' + y(p.lo).toFixed(1)); mid.push((mid.length ? 'L' : 'M') + x(k).toFixed(1) + ',' + y(p.mid).toFixed(1)); } });
    svg.appendChild(svgEl('polygon', { points: up.concat(dn).join(' '), fill: b.color, opacity: .13 }));
    svg.appendChild(svgEl('path', { d: mid.join(''), fill: 'none', stroke: b.color, 'stroke-width': 1.2, 'stroke-dasharray': '4 4', opacity: .7 }));
    // this season
    var d = '', pen = false;
    s.cur.forEach(function (v, k) {
      if (isNaN(v)) { pen = false; return; }
      d += (pen ? 'L' : 'M') + x(k).toFixed(1) + ',' + y(v).toFixed(1); pen = true;
    });
    if (d) {
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: b.color, 'stroke-width': 2.4, 'stroke-linejoin': 'round', 'data-draw': '' }));
      var lk = s.lastK;
      var dot = svgEl('circle', { cx: x(lk), cy: y(s.cur[lk]), r: 4.5, fill: b.color, class: 'now' });
      svg.appendChild(dot);
    }
    host.appendChild(svg);
    drawIn(svg);
  }

  /* ---------- 5. Moments ---------- */
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
    // Lift after compares the 90 days before with days 30-120 after, with each brand's normal
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
      return { brand: b, t: p.t, peak: p.v, x: p.v / usual, lasted: lasted, lift: lift, why: why, id: 'm-' + b.id + '-' + ymd(new Date(p.t)) };
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
      return '<article class="moment reveal' + (n ? '' : ' unexplained') + '" id="' + s.id + '" tabindex="-1" style="--brand:' + s.brand.color + '">' +
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
  function goToMoment(id) {
    var el = $(id); if (!el) return;
    el.scrollIntoView({ behavior: MOTION ? 'smooth' : 'auto', block: 'center' });
    el.focus({ preventScroll: true });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  /* ---------- 6. Over time ---------- */
  var state = { years: 3, on: {}, marks: [], drawn: false };
  BRANDS.forEach(function (b) { state.on[b.id] = true; });
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
      svgText(axis, L - 8, y(g) + 4, g >= 1000 ? (g / 1000) + 'k' : g, 'end');
    }
    var y0 = new Date(from).getUTCFullYear() + 1, y1 = new Date(last).getUTCFullYear();
    var step = (y1 - y0) > (narrow ? 3 : 6) ? 2 : 1;
    for (var yr = y0; yr <= y1; yr += step) {
      var tx = x(Date.UTC(yr, 0, 1));
      grid.appendChild(svgEl('line', { x1: tx, x2: tx, y1: T, y2: H - B, opacity: .5 }));
      svgText(axis, tx, H - 8, yr);
    }
    if (state.years === 1 && !narrow) {
      for (var m = 0; m < 12; m += 3) {
        var mt = Date.UTC(new Date(last).getUTCFullYear(), m, 1);
        [mt, mt - 365.25 * DAY].forEach(function (t) {
          if (t > from && t < last && new Date(t).getUTCMonth() !== 0) svgText(axis, x(t), H - 8, MONTHS[new Date(t).getUTCMonth()]);
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
      svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: s.b.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'data-draw': '' }));
    });
    var dots = svgEl('g', {});
    state.marks.forEach(function (mk) {
      var s = series.filter(function (z) { return z.b === mk.brand; })[0];
      if (!s || mk.t < from) return;
      var r = s.rows.reduce(function (best, r) { return Math.abs(r.t - mk.t) < Math.abs(best.t - mk.t) ? r : best; }, s.rows[0]);
      var a = svgEl('a', { href: '#' + mk.id, class: 'mark' });
      var title = svgEl('title', {}); title.textContent = mk.brand.name + ', ' + fmtDate(mk.t, true) + ': ' + (mk.note ? mk.note.title : 'unexplained spike') + '. Click to read.';
      a.appendChild(title);
      a.appendChild(svgEl('circle', { cx: x(r.t), cy: y(r.i), r: 12, fill: 'transparent' }));
      a.appendChild(svgEl('circle', { cx: x(r.t), cy: y(r.i), r: 5.5, fill: '#fffdf0', stroke: mk.brand.color, 'stroke-width': 2 }));
      a.addEventListener('click', function (e) { e.preventDefault(); hide(); goToMoment(mk.id); });
      dots.appendChild(a);
    });
    var cursor = svgEl('line', { x1: 0, x2: 0, y1: T, y2: H - B, stroke: '#432720', 'stroke-width': 1, opacity: 0 });
    svg.appendChild(cursor);
    svg.appendChild(dots);
    host.appendChild(svg);
    if (!state.drawn) { state.drawn = true; drawIn(svg); }

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

  /* ---------- scroll reveals ---------- */
  function wireReveals() {
    if (!MOTION || !('IntersectionObserver' in window)) return;
    document.documentElement.classList.add('motion');
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    [].forEach.call(document.querySelectorAll('.reveal'), function (el) { io.observe(el); });
  }

  /* ---------- boot ---------- */
  function json(url) { return fetch(url).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
  $('stamps').innerHTML = BRANDS.map(function () { return '<div class="stamp skeleton" aria-hidden="true"></div>'; }).join('');

  Promise.all([loadAll(), json('data/moments.json'), json('data/dispatch.json')]).then(function (res) {
    var list = moments(res[1] || []);
    state.marks = list;
    var last = Math.max.apply(null, BRANDS.map(function (b) { return b.days[b.days.length - 1].t; }));
    $('updated').textContent = 'Live · data to ' + fmtDate(last, true) + ' · ' + fmtNum(BRANDS.reduce(function (t, b) { return t + b.days.length; }, 0)) + ' days of pageviews';
    renderStamps(); renderDispatch(res[2]);
    renderSeasons(); renderGame();
    renderLive();
    wireControls(); renderChart(); renderMoments(list);
    wireReveals();
    $('open-seal').addEventListener('click', function () { unseal(true); });
    var t, lastW = $('chart').clientWidth;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        $('tip').hidden = true;
        if ($('chart').clientWidth !== lastW) { lastW = $('chart').clientWidth; renderChart(); renderLive(); }
      }, 150);
    });
  }).catch(function (err) {
    $('updated').textContent = 'Couldn’t load live data';
    $('stamps').innerHTML = '<p class="error">The Wikimedia API didn’t respond (' + esc(err.message) + '). Try refreshing in a minute.</p>';
  });
})();
