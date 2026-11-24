// The working preview in the hero: the Graphley Mac window with made-up sample data.
// Pick a site, change the range, hover the chart, switch the appearance. Below it, the
// agent session switches between "View only" and "Can make changes". No network calls.
(function () {
  var gw = document.querySelector('.gw');
  if (gw) preview(gw);
  agentSession();
  appearance(gw);

  function preview(gw) {
    // Sample sites: [id, name, base visitors per day, daily growth, downloads per day (0 = website only)]
    var SITES = [
      ['harbor', 'Harbor Notes', 70, 0.0045, 1.8],
      ['field', 'Field Guide', 42, 0.002, 0],
      ['tidepool', 'Tidepool', 18, 0.011, 4.6],
      ['lantern', 'Lantern Docs', 19, -0.001, 0],
      ['drift', 'Driftwood', 13, 0.003, 0]
    ];
    var DAYS = 180; // 90 shown at most, plus the 90 before it for comparisons
    var seed = 20261124;
    function random() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }

    var data = {};
    SITES.forEach(function (s, si) {
      var visitors = [], downloads = [], events = [];
      for (var d = 0; d < DAYS; d++) {
        var weekday = (d + 3) % 7;
        var week = weekday === 5 || weekday === 6 ? 0.72 : 1;
        var trend = s[2] * Math.pow(1 + s[3], d - DAYS + 90);
        var wave = 1 + 0.12 * Math.sin((d + si * 9) / 6.5);
        var spike = s[0] === 'tidepool' && d > DAYS - 21 ? 1 + 1.6 * Math.exp(-(d - (DAYS - 21)) / 5) : 1;
        var v = Math.max(0, Math.round(trend * week * wave * spike * (0.85 + random() * 0.3)));
        visitors.push(v);
        downloads.push(s[4] ? Math.max(0, Math.round(s[4] * spike * (0.4 + random() * 1.2))) : 0);
        events.push(Math.round(v * (0.03 + random() * 0.03)));
      }
      data[s[0]] = { name: s[1], visitors: visitors, downloads: downloads, events: events, app: s[4] > 0 };
    });

    var state = { site: 'all', days: 30 };
    var svg = gw.querySelector('.gw-chart svg');
    var readout = gw.querySelector('.gw-readout');
    var W = 640, H = 200, PAD = { l: 34, r: 6, t: 10, b: 22 };
    function measure() {
      // Draw at the chart's real size so the axis text stays small at every width.
      W = Math.max(280, Math.round(svg.getBoundingClientRect().width) || 640);
      H = W < 520 ? 170 : 210;
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    }
    var today = new Date();

    function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
    function last(arr, n, offset) { return arr.slice(arr.length - n - (offset || 0), arr.length - (offset || 0)); }
    function fmt(n) { return n >= 10000 ? (n / 1000).toFixed(1) + 'k' : n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n); }
    function full(n) { return n.toLocaleString('en-US'); }
    function ids() { return state.site === 'all' ? SITES.map(function (s) { return s[0]; }) : [state.site]; }
    function total(key, offset) {
      return sum(ids().map(function (id) { return sum(last(data[id][key], state.days, offset)); }));
    }
    function niceMax(v) { if (v <= 5) return 5; var p = Math.pow(10, Math.floor(Math.log10(v))); var m = v / p; return (m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
    function dayLabel(i, n) {
      var d = new Date(today); d.setDate(d.getDate() - (n - 1 - i));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    function delta(cur, prev) {
      if (!prev) return { cls: '', txt: 'new' };
      var p = Math.round((cur - prev) / prev * 100);
      return { cls: p >= 0 ? 'up' : 'down', txt: (p >= 0 ? '▲ ' : '▼ ') + Math.abs(p) + '% vs previous' };
    }

    function render() {
      measure();
      var n = state.days;
      var list = ids();
      // Header and sidebar
      gw.querySelector('[data-k="title"]').textContent = state.site === 'all' ? 'All sites' : data[state.site].name;
      gw.querySelector('[data-k="sub"]').textContent = (state.site === 'all' ? '5 sites and apps' : data[state.site].app ? 'Website and App Store app' : 'Website') + ' · last ' + n + ' days';
      gw.querySelectorAll('[data-site-to]').forEach(function (b) {
        var id = b.getAttribute('data-site-to');
        b.setAttribute('aria-pressed', String(id === state.site));
        var count = b.querySelector('.n');
        if (id !== 'all') count.textContent = fmt(sum(last(data[id].visitors, n)));
      });
      gw.querySelectorAll('[data-days]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.getAttribute('data-days') === n)); });
      gw.querySelectorAll('.gw-legend [data-site]').forEach(function (s) { s.classList.toggle('off', list.indexOf(s.getAttribute('data-site')) < 0); });

      // KPIs
      ['visitors', 'downloads', 'events'].forEach(function (key, i) {
        var box = gw.querySelector('.gw-kpi[data-i="' + i + '"]');
        var hasApp = list.some(function (id) { return data[id].app; });
        if (key === 'downloads' && !hasApp) {
          box.querySelector('.v').textContent = '–';
          var none = box.querySelector('.d'); none.className = 'd'; none.textContent = 'No app linked';
          return;
        }
        var cur = total(key), prev = total(key, n), d = delta(cur, prev);
        box.querySelector('.v').textContent = full(cur);
        var el = box.querySelector('.d'); el.className = 'd ' + d.cls; el.textContent = d.txt;
      });

      // Chart
      var series = list.map(function (id) { return { id: id, values: last(data[id].visitors, n) }; });
      var max = niceMax(Math.max.apply(null, series.map(function (s) { return Math.max.apply(null, s.values); })));
      var iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
      function X(i) { return PAD.l + i * iw / (n - 1); }
      function Y(v) { return PAD.t + ih - v / max * ih; }
      var out = '<g class="grid">';
      [0, 0.5, 1].forEach(function (f) { out += '<line x1="' + PAD.l + '" x2="' + (W - PAD.r) + '" y1="' + Y(max * f) + '" y2="' + Y(max * f) + '"/>'; });
      out += '</g><g class="axis">';
      [0, 0.5, 1].forEach(function (f) { out += '<text x="' + (PAD.l - 6) + '" y="' + (Y(max * f) + 4) + '" text-anchor="end">' + fmt(max * f) + '</text>'; });
      out += '<text x="' + PAD.l + '" y="' + (H - 4) + '">' + dayLabel(0, n) + '</text>';
      out += '<text x="' + (W - PAD.r) + '" y="' + (H - 4) + '" text-anchor="end">Today</text></g>';
      SITES.forEach(function (s, si) {
        var shown = list.indexOf(s[0]) >= 0;
        var vals = last(data[s[0]].visitors, n);
        var line = vals.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(Math.min(v, max)).toFixed(1); }).join(' ');
        var area = line + ' L' + X(n - 1).toFixed(1) + ' ' + Y(0) + ' L' + X(0).toFixed(1) + ' ' + Y(0) + ' Z';
        var cls = ' k' + (si + 1) + (shown ? '' : ' is-off');
        out += '<path class="area' + cls + '" d="' + area + '"/><path class="line' + cls + '" d="' + line + '"/>';
      });
      out += '<line class="hover-line" x1="0" x2="0" y1="' + PAD.t + '" y2="' + (H - PAD.b) + '" visibility="hidden"/>';
      svg.innerHTML = out;
      svg.classList.toggle('all', state.site === 'all');
      state.X = X; state.Y = Y; state.max = max;
      showDay(null);
    }

    function totalsOn(i) {
      var n = state.days;
      return sum(ids().map(function (id) { return last(data[id].visitors, n)[i]; }));
    }
    function showDay(i) {
      var n = state.days;
      var hover = svg.querySelector('.hover-line');
      if (i === null) {
        var best = 0;
        for (var k = 1; k < n; k++) if (totalsOn(k) > totalsOn(best)) best = k;
        readout.textContent = 'Busiest day: ' + dayLabel(best, n) + ' · ' + full(totalsOn(best)) + ' visitors';
        hover.setAttribute('visibility', 'hidden');
        return;
      }
      readout.textContent = dayLabel(i, n) + ' · ' + full(totalsOn(i)) + ' visitors';
      hover.setAttribute('x1', state.X(i)); hover.setAttribute('x2', state.X(i));
      hover.setAttribute('visibility', 'visible');
    }

    svg.addEventListener('pointermove', function (e) {
      var box = svg.getBoundingClientRect();
      var x = (e.clientX - box.left) / box.width * W;
      var i = Math.round((x - PAD.l) / (W - PAD.l - PAD.r) * (state.days - 1));
      showDay(Math.max(0, Math.min(state.days - 1, i)));
    });
    svg.addEventListener('pointerleave', function () { showDay(null); });

    gw.addEventListener('click', function (e) {
      var site = e.target.closest('[data-site-to]');
      var range = e.target.closest('[data-days]');
      if (site) { state.site = site.getAttribute('data-site-to'); render(); }
      if (range) { state.days = +range.getAttribute('data-days'); render(); }
    });
    var resizeTimer;
    window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 120); });
    render();
  }

  function appearance(gw) {
    var buttons = document.querySelectorAll('[data-look]');
    if (!gw || !buttons.length) return;
    // Start in the visitor's own appearance.
    var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    set(dark ? 'dark' : 'light');
    buttons.forEach(function (b) { b.addEventListener('click', function () { set(b.getAttribute('data-look')); }); });
    function set(look) {
      gw.setAttribute('data-appearance', look);
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-look') === look)); });
    }
  }

  function agentSession() {
    var session = document.querySelector('.session');
    if (!session) return;
    session.querySelectorAll('[data-mode-to]').forEach(function (b) {
      b.addEventListener('click', function () {
        var mode = b.getAttribute('data-mode-to');
        session.setAttribute('data-mode', mode);
        session.querySelectorAll('[data-mode-to]').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      });
    });
  }
})();
