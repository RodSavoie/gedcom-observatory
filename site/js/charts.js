/* Family Observatory: small chart helpers and the drawer list. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el, svg = ui.svg;

  /* A list of people (or any rows) shown in the side drawer. */
  FO.showList = function (title, sub, rows) {
    const d = document.getElementById('drawer');
    if (!d) return;
    const inn = el('div', { class: 'drawer-in' });
    inn.append(el('button', { class: 'x', 'aria-label': 'Close', text: '×', onclick: () => FO.select(null) }));
    inn.append(el('h2', { text: title }));
    if (sub) inn.append(el('p', { class: 'life', text: sub }));
    const ul = el('ul', { class: 'plist' });
    rows.slice(0, 400).forEach(r => ul.append(r instanceof Node ? r : el('li', {}, el('span', {}, ui.plink(r), ' ', ui.wt(r, '')), el('small', { text: FO.lifespan(r) }))));
    if (rows.length > 400) ul.append(el('li', { class: 'muted', text: '…and ' + (rows.length - 400) + ' more' }));
    inn.append(ul);
    d.innerHTML = ''; d.append(inn); d.classList.add('open'); d.scrollTop = 0;
  };

  const roundedTop = (x, y, w, h, r) => { r = Math.min(r, w / 2, h); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
  const roundedRight = (x, y, w, h, r) => { r = Math.min(r, h / 2, w); return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`; };
  const hover = (node, html) => {
    node.addEventListener('mousemove', e => ui.tip(html, e.clientX, e.clientY));
    node.addEventListener('mouseleave', ui.untip);
  };

  /* Vertical columns. data: [{label, value, tip?}], opts: {color, height, every, onClick} */
  FO.columns = function (data, opts) {
    opts = opts || {};
    const W = 560, H = opts.height || 210, m = { l: 38, r: 8, t: 10, b: 24 };
    const max = Math.max(1, ...data.map(d => d.value));
    const y = d3.scaleLinear().domain([0, max]).nice(4).range([H - m.b, m.t]);
    const bw = (W - m.l - m.r) / data.length;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
    y.ticks(4).forEach(t => {
      s.append(svg('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: FO.C.soft }));
      const tx = svg('text', { x: m.l - 6, y: y(t) + 3.5, 'text-anchor': 'end' }); tx.textContent = ui.fmt(t); s.append(tx);
    });
    const every = opts.every || Math.ceil(data.length / 12);
    data.forEach((d, i) => {
      const x = m.l + i * bw, gap = Math.min(2, bw * .2);
      if (d.value > 0) {
        const p = svg('path', { d: roundedTop(x + gap / 2, y(d.value), Math.max(1, bw - gap), y(0) - y(d.value), 3), fill: d.color || opts.color || FO.CAT[1] });
        s.append(p);
      }
      const hit = svg('rect', { x, y: m.t, width: bw, height: H - m.b - m.t, fill: 'transparent', style: opts.onClick ? 'cursor:pointer' : '' });
      hover(hit, '<b>' + ui.esc(d.tip || d.label) + '</b><span>' + ui.fmt(d.value) + (opts.unit ? ' ' + opts.unit : '') + '</span>');
      if (opts.onClick) hit.addEventListener('click', () => opts.onClick(d));
      s.append(hit);
      if (i % every === 0) { const tx = svg('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle' }); tx.textContent = d.label; s.append(tx); }
    });
    s.append(svg('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), stroke: FO.C.ink3 }));
    return s;
  };

  /* Stacked columns. rows: [{label, tip, parts: [{key, value, color}]}] */
  FO.stacked = function (rows, opts) {
    opts = opts || {};
    const W = 560, H = opts.height || 210, m = { l: 38, r: 8, t: 10, b: 24 };
    const max = Math.max(1, ...rows.map(r => d3.sum(r.parts, p => p.value)));
    const y = d3.scaleLinear().domain([0, max]).nice(4).range([H - m.b, m.t]);
    const bw = (W - m.l - m.r) / rows.length;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
    y.ticks(4).forEach(t => { s.append(svg('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: FO.C.soft })); const tx = svg('text', { x: m.l - 6, y: y(t) + 3.5, 'text-anchor': 'end' }); tx.textContent = ui.fmt(t); s.append(tx); });
    const every = Math.ceil(rows.length / 12);
    rows.forEach((r, i) => {
      const x = m.l + i * bw, gap = Math.min(2, bw * .2);
      let acc = 0;
      r.parts.forEach(p => { if (!p.value) return; const y1 = y(acc), y2 = y(acc + p.value); acc += p.value; s.append(svg('rect', { x: x + gap / 2, y: y2 + (y1 - y2 > 3 ? 1 : 0), width: Math.max(1, bw - gap), height: Math.max(.5, y1 - y2 - (y1 - y2 > 3 ? 1 : 0)), fill: p.color })); });
      const hit = svg('rect', { x, y: m.t, width: bw, height: H - m.b - m.t, fill: 'transparent', style: opts.onClick ? 'cursor:pointer' : '' });
      hover(hit, '<b>' + ui.esc(r.tip || r.label) + '</b><span>' + ui.fmt(acc) + ' ' + (opts.unit || '') + r.parts.filter(p => p.value).map(p => '<br>' + ui.esc(p.key) + ': ' + ui.fmt(p.value)).join('') + '</span>');
      if (opts.onClick) hit.addEventListener('click', () => opts.onClick(r));
      s.append(hit);
      if (i % every === 0) { const tx = svg('text', { x: x + bw / 2, y: H - 8, 'text-anchor': 'middle' }); tx.textContent = r.label; s.append(tx); }
    });
    s.append(svg('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), stroke: FO.C.ink3 }));
    return s;
  };
  /* Lines over years. series: [{name, color, points: [{x, y, n}]}]; a hollow dot is a thin sample */
  FO.lines = function (series, opts) {
    opts = opts || {};
    const W = 560, H = opts.height || 220, m = { l: 40, r: 64, t: 12, b: 24 };
    const all = series.flatMap(sr => sr.points);
    if (!all.length) return svg('svg', { viewBox: `0 0 ${W} 10` });
    const x = d3.scaleLinear().domain(d3.extent(all, d => d.x)).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([opts.yMin != null ? opts.yMin : 0, d3.max(all, d => d.y)]).nice(4).range([H - m.b, m.t]);
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
    y.ticks(4).forEach(t => { s.append(svg('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: 'rgba(27,38,50,.07)', 'stroke-width': 1.5 })); const tx = svg('text', { x: m.l - 6, y: y(t) + 3.5, 'text-anchor': 'end' }); tx.textContent = ui.fmt(t) + (opts.suffix || ''); s.append(tx); });
    x.ticks(7).forEach(t => { const tx = svg('text', { x: x(t), y: H - 8, 'text-anchor': 'middle' }); tx.textContent = t; s.append(tx); });
    const line = d3.line().x(d => x(d.x)).y(d => y(d.y)).curve(d3.curveMonotoneX);
    const ends = [];
    series.forEach(sr => {
      if (!sr.points.length) return;
      s.append(svg('path', { d: line(sr.points), fill: 'none', stroke: sr.color, 'stroke-width': 2.2, 'stroke-opacity': .85, 'stroke-linejoin': 'round' }));
      sr.points.forEach(d => s.append(svg('circle', { cx: x(d.x), cy: y(d.y), r: 2.8, fill: d.n != null && d.n < (opts.thin || 10) ? '#fff' : sr.color, stroke: sr.color, 'stroke-width': 1.4 })));
      const last = sr.points[sr.points.length - 1];
      ends.push({ sr, y: y(last.y) });
    });
    ends.sort((a, b) => a.y - b.y).forEach((e, i, arr) => { if (i && e.y - arr[i - 1].y < 13) e.y = arr[i - 1].y + 13; const tx = svg('text', { x: W - m.r + 8, y: e.y + 4, style: 'font-size:12px;fill:#1B2632;font-weight:600' }); tx.textContent = e.sr.name; s.append(tx); });
    const hit = svg('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' });
    const xs = [...new Set(all.map(d => d.x))].sort((a, b) => a - b);
    hit.addEventListener('mousemove', e => {
      const r = hit.getBoundingClientRect(), xv = x.invert(m.l + (e.clientX - r.left) / r.width * (W - m.l - m.r));
      const near = xs.reduce((a, b) => (Math.abs(b - xv) < Math.abs(a - xv) ? b : a));
      ui.tip('<b>' + near + (opts.step ? '-' + (near + opts.step - 1) : '') + '</b><span>' + series.map(sr => { const d = sr.points.find(q => q.x === near); return d ? ui.esc(sr.name) + ': ' + (opts.fmt ? opts.fmt(d.y) : Math.round(d.y)) + (opts.suffix || '') + (d.n != null ? ' (' + ui.fmt(d.n) + ' ' + (opts.unit || 'people') + ')' : '') : ''; }).filter(Boolean).join('<br>') + '</span>', e.clientX, e.clientY);
    });
    hit.addEventListener('mouseleave', ui.untip);
    s.append(hit);
    return s;
  };

  FO.key = function (items) {
    const d = el('div', { class: 'chiprow', style: { margin: '6px 0 0', fontSize: '12px', color: '#3D4B5E', gap: '4px 14px' } });
    items.forEach(it => d.append(el('span', {}, el('i', { style: { display: 'inline-block', width: '10px', height: '10px', background: it.color, marginRight: '6px', borderRadius: '2px' } }), it.label)));
    return d;
  };

  /* Horizontal bars with direct labels. data: [{label, value, color?}] */
  FO.bars = function (data, opts) {
    opts = opts || {};
    const W = 560, rh = 24, lw = opts.labelWidth || 150, H = data.length * rh + 4;
    const max = Math.max(1, ...data.map(d => d.value));
    const x = d3.scaleLinear().domain([0, max]).range([0, W - lw - 60]);
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
    data.forEach((d, i) => {
      const yy = i * rh + 4;
      const lab = svg('text', { x: lw - 10, y: yy + 12, 'text-anchor': 'end', style: 'font-size:13px;fill:#1B2632' }); lab.textContent = d.label.length > 22 ? d.label.slice(0, 21) + '…' : d.label; s.append(lab);
      s.append(svg('path', { d: roundedRight(lw, yy + 2, Math.max(2, x(d.value)), rh - 8, 4), fill: d.color || opts.color || FO.CAT[1] }));
      const v = svg('text', { x: lw + Math.max(2, x(d.value)) + 7, y: yy + 12, style: 'font-size:12px' }); v.textContent = ui.fmt(d.value) + (opts.suffix || ''); s.append(v);
      const hit = svg('rect', { x: 0, y: yy, width: W, height: rh, fill: 'transparent', style: opts.onClick ? 'cursor:pointer' : '' });
      hover(hit, '<b>' + ui.esc(d.label) + '</b><span>' + ui.fmt(d.value) + (opts.unit ? ' ' + opts.unit : '') + '</span>');
      if (opts.onClick) hit.addEventListener('click', () => opts.onClick(d));
      s.append(hit);
    });
    return s;
  };

  /* A few fixed points of French North American history, shown only for families who lived there. */
  const NA = new Set(['Acadie', 'Nova Scotia', 'New Brunswick', 'Nouvelle-France', 'Québec', 'Prince Edward Island', 'Cape Breton']);
  FO.HISTORY = [
    [1605, 'Port-Royal is founded in Acadie', NA], [1608, 'Québec is founded', NA],
    [1632, 'The Treaty of Saint-Germain-en-Laye returns Acadie and Québec to France', NA],
    [1654, 'An English force from Boston captures Port-Royal', NA], [1667, 'The Treaty of Breda returns Acadie to France', NA],
    [1710, 'Port-Royal falls to the British for the last time', NA], [1713, 'The Treaty of Utrecht cedes mainland Acadie to Britain', NA],
    [1755, 'The deportation of the Acadians, the Grand Dérangement, begins', NA], [1758, 'Louisbourg falls to the British', NA],
    [1763, 'The Treaty of Paris ends French rule in North America', NA], [1764, 'Acadians are allowed to settle again in Nova Scotia', NA],
    [1784, 'New Brunswick becomes a separate colony', NA], [1867, 'Canadian Confederation', NA],
    [1881, 'The first Acadian National Convention meets at Memramcook', NA], [1884, 'The Acadian flag is adopted at Miscouche', NA],
    [1914, 'The First World War begins', null], [1918, 'The First World War ends', null], [1939, 'The Second World War begins', null], [1945, 'The Second World War ends', null]
  ];

  /* open arc at radius r; angles clockwise from 12 o'clock */
  FO.arcLine = (r, a, b) => `M${r * Math.sin(a)},${-r * Math.cos(a)}A${r},${r} 0 ${Math.abs(b - a) > Math.PI ? 1 : 0} ${b > a ? 1 : 0} ${r * Math.sin(b)},${-r * Math.cos(b)}`;

  FO.figure = function (title, sub, chart) {
    return el('div', { class: 'figure' }, el('h3', { text: title }), el('p', { class: 'sub', text: sub || '' }), chart);
  };

  /* Top-N categories with everything else folded into "Other". Returns {color(key), legend:[{label,color,count}]} */
  FO.topCategories = function (people, keyFn, n) {
    const counts = new Map();
    for (const p of people) { const k = keyFn(p); if (k) counts.set(k, (counts.get(k) || 0) + 1); }
    // red is kept for "the line you chose" and for repeats, so categories start at the second hue
    const hues = FO.CAT.slice(1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, Math.min(n || hues.length, hues.length));
    const map = new Map(top.map((t, i) => [t[0], hues[i]]));
    const legend = top.map((t, i) => ({ label: t[0], color: hues[i], count: t[1] }));
    const rest = people.length - top.reduce((a, t) => a + t[1], 0);
    if (rest > 0) legend.push({ label: 'Other or unknown', color: FO.OTHER, count: rest });
    return { color: p => map.get(keyFn(p)) || FO.OTHER, legend };
  };
  FO.legend = function (stage, title, items) {
    const box = el('div', { class: 'legend' });
    if (title) box.append(el('b', { text: title }));
    items.forEach(it => box.append(el('div', {}, el('i', { class: it.line ? 'ln' : it.sea ? 'sea' : '', style: { '--c': it.color } }), it.label + (it.count != null ? ' (' + ui.fmt(it.count) + ')' : ''))));
    stage.append(box);
    return box;
  };

  /* Save a chart as a stand-alone SVG file: the whole chart (not just the zoomed part), in the
     current design's colours, with its legend and a caption, and Roboto built in so it looks the
     same when opened on its own. Programs that cannot read a built-in web font (some drawing
     programs) fall back to an installed Roboto, then Arial. */
  const fontData = {};
  const fontURL = f => fontData[f] ? Promise.resolve(fontData[f]) : fetch('fonts/' + f).then(r => r.blob()).then(b => new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fontData[f] = fr.result); fr.readAsDataURL(b); }));
  const RANGE_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
  const RANGE_LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  /* A stand-in for a canvas drawing context that writes SVG instead of pixels, so a chart drawn on
     a canvas (Ancestors Through Time) can be saved as a true vector drawing. It understands the
     drawing calls those charts use: paths (moveTo, lineTo, arc, rect), fill, stroke, text, dashes,
     save / restore, translate / rotate and rectangular clipping. Colours pass through the current
     design, as they do on screen. */
  FO.svgContext = function (opts) {
    opts = opts || {};
    const NS = 'http://www.w3.org/2000/svg';
    const root = document.createElementNS(NS, 'g');
    const measure = document.createElement('canvas').getContext('2d');
    const swap = c => (window.FO_DESIGNS && typeof c === 'string' ? FO_DESIGNS.swap(c) : c);
    const r2 = n => Math.round(n * 100) / 100;
    let st = { fill: '#000', stroke: '#000', lw: 1, cap: 'butt', join: 'miter', dash: [], font: '10px sans-serif', align: 'start', base: 'alphabetic', alpha: 1, m: [1, 0, 0, 1, 0, 0], parent: root, groups: 0 };
    const stack = [];
    let path = '', cx = null, cy = null, clipN = 0;
    const T = (x, y) => [st.m[0] * x + st.m[2] * y + st.m[4], st.m[1] * x + st.m[3] * y + st.m[5]];
    const scale = () => Math.hypot(st.m[0], st.m[1]);
    const add = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); st.parent.append(e); return e; };
    const paint = (c, kind) => {
      // a colour with its own transparency becomes a solid colour plus an opacity, which every SVG reader understands
      const m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+%?)\s*)?\)$/i.exec(c || '');
      if (!m) return { [kind]: c };
      const a = m[4] == null ? 1 : (/%$/.test(m[4]) ? parseFloat(m[4]) / 100 : +m[4]);
      return { [kind]: 'rgb(' + m[1] + ',' + m[2] + ',' + m[3] + ')', [kind + '-opacity']: a < 1 ? r2(a) : null };
    };
    const rgbKey = c => {
      if (typeof c !== 'string') return '';
      let m = /^#([0-9a-f]{6})/i.exec(c);
      if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16)).join(',');
      m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(c);
      return m ? [m[1], m[2], m[3]].map(n => Math.round(+n)).join(',') : '';
    };
    // opts.noPaper: leave out anything filled in the page colour (the soft patches behind labels), so the file has no background
    const paper = opts.noPaper ? rgbKey(swap(FO.C.bg || '#EEE9DF')) : null;
    const alignMap = { left: 'start', start: 'start', center: 'middle', right: 'end', end: 'end' };
    const baseMap = { top: 'text-before-edge', hanging: 'hanging', middle: 'central', alphabetic: null, ideographic: 'ideographic', bottom: 'text-after-edge' };
    const ctx = {
      get fillStyle() { return st.fill; }, set fillStyle(v) { st.fill = swap(v); },
      get strokeStyle() { return st.stroke; }, set strokeStyle(v) { st.stroke = swap(v); },
      get lineWidth() { return st.lw; }, set lineWidth(v) { st.lw = v; },
      get lineCap() { return st.cap; }, set lineCap(v) { st.cap = v; },
      get lineJoin() { return st.join; }, set lineJoin(v) { st.join = v; },
      get font() { return st.font; }, set font(v) { st.font = v; measure.font = v; },
      get textAlign() { return st.align; }, set textAlign(v) { st.align = v; },
      get textBaseline() { return st.base; }, set textBaseline(v) { st.base = v; },
      get globalAlpha() { return st.alpha; }, set globalAlpha(v) { st.alpha = v; },
      setLineDash(d) { st.dash = (d || []).slice(); }, getLineDash() { return st.dash.slice(); },
      save() { stack.push(st); st = Object.assign({}, st, { m: st.m.slice(), dash: st.dash.slice(), groups: 0 }); },
      restore() { if (!stack.length) return; for (let i = 0; i < st.groups; i++) st.parent = st.parent.parentNode; st = stack.pop(); measure.font = st.font; },
      translate(x, y) { const m = st.m; m[4] += m[0] * x + m[2] * y; m[5] += m[1] * x + m[3] * y; },
      rotate(a) { const m = st.m, c = Math.cos(a), s = Math.sin(a); st.m = [m[0] * c + m[2] * s, m[1] * c + m[3] * s, m[2] * c - m[0] * s, m[3] * c - m[1] * s, m[4], m[5]]; },
      scale(x, y) { const m = st.m; st.m = [m[0] * x, m[1] * x, m[2] * y, m[3] * y, m[4], m[5]]; },
      setTransform(a, b, c, d, e, f) { st.m = [a, b, c, d, e, f]; }, resetTransform() { st.m = [1, 0, 0, 1, 0, 0]; },
      clearRect() {},
      beginPath() { path = ''; cx = cy = null; },
      closePath() { path += 'Z'; },
      moveTo(x, y) { const p = T(x, y); path += 'M' + r2(p[0]) + ',' + r2(p[1]); cx = p[0]; cy = p[1]; },
      lineTo(x, y) { const p = T(x, y); path += (cx == null ? 'M' : 'L') + r2(p[0]) + ',' + r2(p[1]); cx = p[0]; cy = p[1]; },
      fillRect(x, y, w, h) { const keep = path, kx = cx, ky = cy; ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fill(); path = keep; cx = kx; cy = ky; },
      strokeRect(x, y, w, h) { const keep = path, kx = cx, ky = cy; ctx.beginPath(); ctx.rect(x, y, w, h); ctx.stroke(); path = keep; cx = kx; cy = ky; },
      rect(x, y, w, h) { ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); path += 'Z'; },
      arc(x, y, r, a0, a1, ccw) {
        let sweep = ccw ? a0 - a1 : a1 - a0;
        if (sweep < 0) sweep += Math.PI * 2 * Math.ceil(-sweep / (Math.PI * 2));
        const full = sweep >= Math.PI * 2 - 1e-6;
        const pt = a => T(x + r * Math.cos(a), y + r * Math.sin(a)), R = r2(r * scale()), dir = ccw ? 0 : 1;
        const p0 = pt(a0);
        path += (cx == null ? 'M' : 'L') + r2(p0[0]) + ',' + r2(p0[1]);
        if (full) { const pm = pt(a0 + (ccw ? -Math.PI : Math.PI)); path += 'A' + R + ',' + R + ' 0 1 ' + dir + ' ' + r2(pm[0]) + ',' + r2(pm[1]) + 'A' + R + ',' + R + ' 0 1 ' + dir + ' ' + r2(p0[0]) + ',' + r2(p0[1]); cx = p0[0]; cy = p0[1]; return; }
        const a2 = ccw ? a0 - sweep : a0 + sweep, p1 = pt(a2);
        path += 'A' + R + ',' + R + ' 0 ' + (sweep > Math.PI ? 1 : 0) + ' ' + dir + ' ' + r2(p1[0]) + ',' + r2(p1[1]); cx = p1[0]; cy = p1[1];
      },
      fill() { if (paper && rgbKey(st.fill) === paper) return; if (path) add('path', Object.assign({ d: path, opacity: st.alpha < 1 ? st.alpha : null }, paint(st.fill, 'fill'))); },
      stroke() {
        if (!path) return;
        add('path', Object.assign({ d: path, fill: 'none', 'stroke-width': r2(st.lw * scale()), 'stroke-linecap': st.cap !== 'butt' ? st.cap : null, 'stroke-linejoin': st.join !== 'miter' ? st.join : null,
          'stroke-dasharray': st.dash.length ? st.dash.map(d => r2(d * scale())).join(' ') : null, opacity: st.alpha < 1 ? st.alpha : null }, paint(st.stroke, 'stroke')));
      },
      clip() {
        const id = 'fo-clip-' + (++clipN) + '-' + Math.random().toString(36).slice(2, 6);
        const cp = add('clipPath', { id }); const pe = document.createElementNS(NS, 'path'); pe.setAttribute('d', path); cp.append(pe);
        const g = add('g', { 'clip-path': 'url(#' + id + ')' }); st.parent = g; st.groups++;
      },
      measureText(t) { return measure.measureText(t); },
      fillText(text, x, y) {
        const m = st.m, rotated = Math.abs(m[1]) > 1e-9 || Math.abs(m[2]) > 1e-9 || Math.abs(m[0] - 1) > 1e-9 || Math.abs(m[3] - 1) > 1e-9;
        const p = rotated ? [x, y] : T(x, y);
        const e = add('text', Object.assign({ x: r2(p[0]), y: r2(p[1]), style: 'font:' + st.font.replace(/"/g, "'"), 'text-anchor': alignMap[st.align] !== 'start' ? alignMap[st.align] : null,
          'dominant-baseline': baseMap[st.base] || null, transform: rotated ? 'matrix(' + m.map(r2).join(' ') + ')' : null, opacity: st.alpha < 1 ? st.alpha : null }, paint(st.fill, 'fill')));
        e.textContent = text;
      }
    };
    ctx.svgRoot = root;
    return ctx;
  };

  /* Save a canvas chart as SVG: run its own draw function once more into an SVG context.
     opts.view: true = exactly what is on screen (cut to the chart's area); otherwise the drawing's full extent. */
  FO.saveCanvasSVG = function (draw, cv, opts) {
    opts = opts || {};
    // no background: the file holds only the chart's own marks, to be placed on any background
    const NS = 'http://www.w3.org/2000/svg', sctx = FO.svgContext({ noPaper: true });
    if (opts.view) { sctx.save(); sctx.beginPath(); sctx.rect(0, 0, cv.w, cv.h); sctx.clip(); }
    try { draw({ ctx: sctx, w: cv.w, h: cv.h, dpr: 1 }); } finally { if (opts.view) sctx.restore(); if (opts.after) opts.after(); }
    const svgEl = document.createElementNS(NS, 'svg');
    svgEl.setAttribute('width', cv.w); svgEl.setAttribute('height', cv.h);
    svgEl.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden';
    svgEl.append(sctx.svgRoot); document.body.append(svgEl);
    const slug = t => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return FO.saveSVG(svgEl, { title: opts.title, legend: opts.legend, box: opts.view ? { x: 0, y: 0, width: cv.w, height: cv.h } : null,
      file: slug(opts.title) + '-' + slug(FO.state.home && FO.state.home.name) }).finally(() => svgEl.remove());
  };

  FO.saveSVG = function (svgEl, opts) {
    opts = opts || {};
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k])); if (text != null) e.textContent = text; return e; };
    const css = getComputedStyle(document.documentElement);
    const ink = (css.getPropertyValue('--ink') || '#1B2632').trim(), ink3 = (css.getPropertyValue('--ink-3') || '#7C8088').trim(), red = (css.getPropertyValue('--red') || '#A35139').trim();
    // the chart itself, unzoomed, without hover effects
    const inner = svgEl.querySelector(':scope > g');
    const box = opts.box || inner.getBBox();   // opts.box: save exactly this area (what is on screen)
    const clone = svgEl.cloneNode(true);
    const cg = clone.querySelector(':scope > g');
    cg.removeAttribute('transform');
    clone.querySelectorAll('.fan-veil, [data-hover]').forEach(e => e.remove());
    clone.removeAttribute('style'); clone.removeAttribute('class');
    const pad = 28;
    let x0 = box.x - pad, y0 = box.y - pad, w = box.width + pad * 2, h = box.height + pad * 2;
    // legend to the right of the chart, read from the legend shown on the page
    const lg = opts.legend;
    if (lg && lg.querySelector) {
      const lx = box.x + box.width + pad + 10, items = [...lg.querySelectorAll(':scope > div')];
      const title = lg.querySelector(':scope > b');
      const L = mk('g', { transform: `translate(${lx},${box.y + 6})` });
      let yy = 0, wmax = 120;
      if (title) { L.append(mk('text', { x: 0, y: yy + 12, style: `font-size:13px;font-weight:500;fill:${ink}` }, title.textContent)); yy += 26; }
      items.forEach(it => {
        const i = it.querySelector('i'), c = (i && getComputedStyle(i).getPropertyValue('--c').trim()) || ink3, label = it.textContent.trim();
        if (i && i.classList.contains('ln')) L.append(mk('line', { x1: 0, y1: yy + 7, x2: 12, y2: yy + 7, stroke: c, 'stroke-width': 2.5 }));
        else L.append(mk('circle', { cx: 6, cy: yy + 7, r: 5, fill: c }));
        L.append(mk('text', { x: 20, y: yy + 11, style: `font-size:12px;fill:${ink}` }, label));
        wmax = Math.max(wmax, 26 + label.length * 6.6); yy += 21;
      });
      clone.append(L);
      w = Math.max(w, lx + wmax + pad - x0); h = Math.max(h, box.y + 6 + yy + pad - y0);
    }
    // caption along the bottom
    const cap = [opts.title, FO.state.home && FO.state.home.name, location.host || 'Family Observatory', new Date().toISOString().slice(0, 10)].filter(Boolean).join('  ·  ');
    clone.append(mk('text', { x: x0 + pad, y: y0 + h + 4, style: `font-size:11px;fill:${ink3}` }, cap));
    h += 18;
    clone.setAttribute('xmlns', NS);
    clone.setAttribute('viewBox', [x0, y0, w, h].map(n => Math.round(n)).join(' '));
    clone.setAttribute('width', Math.round(w)); clone.setAttribute('height', Math.round(h));
    clone.setAttribute('font-family', 'Roboto, Arial, sans-serif');
    return Promise.all([fontURL('roboto-latin-wght-normal.woff2'), fontURL('roboto-latin-ext-wght-normal.woff2')]).catch(() => [])
      .then(([latin, ext]) => {
        if (latin) {
          const st = mk('style', {}, `@font-face{font-family:'Roboto';font-weight:100 900;src:url(${latin}) format('woff2');unicode-range:${RANGE_LATIN}}` +
            (ext ? `@font-face{font-family:'Roboto';font-weight:100 900;src:url(${ext}) format('woff2');unicode-range:${RANGE_EXT}}` : '') + `text{font-family:Roboto,Arial,sans-serif}`);
          clone.insertBefore(st, clone.firstChild);
        }
        const text = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
        a.download = (opts.file || 'chart') + '.svg';
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      });
  };
})();
