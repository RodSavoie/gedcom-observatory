/* Where they lived: births by place and period, and moves between generations. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el, svg = ui.svg, C = FO.C;

  FO.view({
    id: 'places', order: 11, title: 'Where They Lived',
    card: 'A map of where the family was born and died, a grid of births by place and period, or ribbons from parents’ birthplaces to their children’s.',
    how: {"see": "Three pictures of where the family lived. The map shows where people were born or died. The ribbons show how birthplaces changed from parents to children. The grid shows which places held the family, period by period.", "marks": ["On the map, each bubble is one place, sized by how many people were born (or died) there. A dashed ring stands for people whose place is known only by its region, such as “Acadie” or “France”, and sits at that region’s centre.", "In the ribbons, a grey ribbon is children born in the same region as their parent; a coloured ribbon is children born somewhere else, coloured by where they were born.", "In the grid, each square is one place in one period; darker means more births.", "The number at the end of a grid row is that place’s total."], "can": ["Switch between Ribbons, Grid and Map.", "On the map, choose births or deaths and a century, scroll to zoom, drag to move, and click a bubble to list its people.", "Point at a ribbon or a square for its count; click it to list the people.", "In the grid, switch between regions and the places within them."], "care": "The map finds each place from its name, so a name it cannot match, or a village it does not know, is placed at its region or left off; the note under the map counts both. Old names and Acadian settlements are known; French villages missing from the world list are placed at the centre of their département. Elsewhere, places are grouped by how they are written in the file, so two spellings of one place can appear as two rows. A child with two recorded parents counts twice in the ribbons."},
    blurb: 'Three pictures of where the family lived. The map shows each birthplace or place of death as a bubble, sized by how many people it holds. The ribbons join each parent’s birth region, on the left, to their child’s, on the right, so a family’s moves show up as crossings. The grid counts births in each place for each period; darker means more.',
    icon: '<g fill="#FFE8CF" stroke="none"><rect x="10" y="12" width="10" height="10"/><rect x="22" y="12" width="10" height="10" fill="#8FA8BD"/><rect x="34" y="24" width="10" height="10" fill="#2C3B4D"/><rect x="22" y="24" width="10" height="10" fill="#2B80AA"/><rect x="46" y="24" width="10" height="10" fill="#8FA8BD"/><rect x="34" y="36" width="10" height="10"/><rect x="46" y="36" width="10" height="10" fill="#2B80AA"/><rect x="46" y="48" width="10" height="10" fill="#2C3B4D"/></g><path d="M8 10 V60 H58" />',
    render(v) {
      const data = FO.scoped(v.data);
      const ppl = data.people.filter(p => !p.hidden && p.b && p.b.place && FO.region(p.b.place));
      if (ppl.length < 3) { ui.empty(v.stage, 'No birthplaces recorded', 'This view needs places of birth, and the file has too few.'); return; }
      let mode = FO.prefs.get('places.view', 'grid', ['grid', 'ribbons', 'map']), level = FO.prefs.get('places.rows', 'place', ['place', 'region']);
      const root = svg('svg', {});
      v.stage.append(root);
      const hint = el('div', { class: 'hint' }); v.stage.append(hint);
      const regCount = d3.rollup(ppl, x => x.length, p => FO.region(p.b.place));
      const ranked = [...regCount.entries()].sort((a, b) => b[1] - a[1]);
      const locCount = d3.rollup(ppl, x => x.length, p => FO.locality(p.b.place));
      const rankedLoc = [...locCount.entries()].sort((a, b) => b[1] - a[1]);

      function grid() {
        const W = v.stage.clientWidth, H = v.stage.clientHeight;
        const dated = ppl.filter(p => p.est != null);
        const keyOf = level === 'region' ? (p => FO.region(p.b.place)) : (p => FO.locality(p.b.place));
        const rk = level === 'region' ? ranked : rankedLoc, cnt = level === 'region' ? regCount : locCount;
        const nRows = Math.min(rk.length, Math.max(4, Math.floor((H - 120) / (level === 'region' ? 30 : 24))), level === 'region' ? 12 : 22);
        const regs = rk.slice(0, nRows).map(d => d[0]);
        const med = new Map(regs.map(r => [r, d3.median(dated.filter(p => keyOf(p) === r), p => p.est)]));
        regs.sort((a, b) => med.get(a) - med.get(b));
        const y0 = d3.min(dated, p => p.est), y1 = d3.max(dated, p => p.est);
        const m = { l: level === 'region' ? 190 : 250, r: 70, t: 40, b: 84 };
        const maxCols = Math.max(6, Math.floor((W - m.l - m.r) / 26));
        const step = [10, 20, 25, 50, 100].find(s => (y1 - y0) / s <= maxCols) || 100;
        const start = Math.floor(y0 / step) * step, cols = d3.range(start, y1 + 1, step);
        const cw = (W - m.l - m.r) / cols.length, ch = Math.min(40, (H - m.t - m.b) / regs.length);
        const cell = d3.rollup(dated, x => x, keyOf, p => Math.floor(p.est / step) * step);
        const max = d3.max(regs, r => d3.max(cols, c => ((cell.get(r) || new Map()).get(c) || []).length)) || 1;
        const col = d3.scaleSqrt().domain([1, max]).range(['#DCE3EA', '#22344A']).interpolate(d3.interpolateRgb);
        cols.forEach((c, i) => { if (cols.length > 24 && i % 2) return; const t = svg('text', { x: m.l + i * cw + cw / 2, y: m.t - 10, 'text-anchor': 'middle', style: 'font-size:11px;fill:#7C8088' }); t.textContent = c; root.append(t); });
        regs.forEach((r, j) => {
          const t = svg('text', { x: m.l - 12, y: m.t + j * ch + ch / 2 + 4, 'text-anchor': 'end', style: 'font-size:13px;fill:#1B2632' }); t.textContent = r.length > (level === 'region' ? 24 : 34) ? r.slice(0, level === 'region' ? 23 : 33) + '…' : r; if (r === rk[0][0]) t.setAttribute('style', 'font-size:13px;fill:#A35139;font-weight:600'); root.append(t);
          const tot = svg('text', { x: W - m.r + 10, y: m.t + j * ch + ch / 2 + 4, style: 'font-size:12px;fill:#7C8088' }); tot.textContent = ui.fmt(cnt.get(r)); root.append(tot);
          cols.forEach((c, i) => {
            const people = (cell.get(r) || new Map()).get(c) || [];
            const n = people.length;
            const rect = svg('rect', { x: m.l + i * cw + 1, y: m.t + j * ch + 1, width: Math.max(1, cw - 2), height: ch - 2, rx: 2, fill: n ? col(n) : '#F4F0E8', style: n ? 'cursor:pointer' : '' });
            if (n) {
              rect.addEventListener('mousemove', e => ui.tip('<b>' + ui.esc(r) + ', ' + c + '-' + (c + step - 1) + '</b><span>' + n + (n === 1 ? ' birth' : ' births') + '</span>', e.clientX, e.clientY));
              rect.addEventListener('mouseleave', ui.untip);
              rect.addEventListener('click', () => FO.showList(r + ', ' + c + '-' + (c + step - 1), n + ' born here', people.slice().sort((a, b) => a.est - b.est)));
            }
            root.append(rect);
            if (n && cw > 30 && ch > 18) { const t = svg('text', { x: m.l + i * cw + cw / 2, y: m.t + j * ch + ch / 2 + 4, 'text-anchor': 'middle', 'pointer-events': 'none', style: `font-size:10.5px;fill:${n > max * 0.22 ? '#fff' : '#22344A'}` }); t.textContent = n; root.append(t); }
          });
        });
        // scale key
        const ky = m.t + regs.length * ch + 22;
        [1, Math.max(2, Math.round(max / 8)), Math.max(3, Math.round(max / 2.5)), max].forEach((n, i) => {
          root.append(svg('rect', { x: m.l + i * 64, y: ky, width: 18, height: 12, rx: 2, fill: col(n) }));
          const t = svg('text', { x: m.l + i * 64 + 24, y: ky + 10, style: 'font-size:11px;fill:#3D4B5E' }); t.textContent = ui.fmt(n); root.append(t);
        });
        const kt = svg('text', { x: m.l - 12, y: ky + 10, 'text-anchor': 'end', style: 'font-size:11px;fill:#7C8088' }); kt.textContent = 'births per cell'; root.append(kt);
        hint.textContent = ui.fmt(dated.length) + ' births with a place, in ' + step + '-year periods. Rows run from earliest to latest; the row named in red is the most common birthplace. Click a square to list who was born there. This is not a map: places are grouped by the words in the file.';
      }

      function ribbons() {
        const W = v.stage.clientWidth, H = v.stage.clientHeight;
        const hues = FO.CAT.slice(1);
        const top = ranked.slice(0, hues.length).map(d => d[0]);
        const names = ranked.length > hues.length ? top.concat(['Other places']) : top;
        const ix = r => { const i = top.indexOf(r); return i < 0 ? names.length - 1 : i; };
        const n = names.length;
        const M = d3.range(n).map(() => d3.range(n).map(() => 0)), who = d3.range(n).map(() => d3.range(n).map(() => []));
        let pairs = 0;
        ppl.forEach(c => [c.father, c.mother].forEach(par => {
          if (!par || par.hidden || !par.b || !par.b.place || !FO.region(par.b.place)) return;
          const a = ix(FO.region(par.b.place)), b = ix(FO.region(c.b.place));
          M[a][b]++; who[a][b].push(c); pairs++;
        }));
        if (!pairs) { const t = svg('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', style: 'font-size:16px;fill:#3D4B5E' }); t.textContent = 'No parent and child both have a birthplace recorded.'; root.append(t); return; }
        const color = i => (names[i] === 'Other places' ? FO.OTHER : hues[i]);
        const m = { l: Math.max(190, W * 0.2), r: Math.max(190, W * 0.2), t: 54, b: 66 }, bw = 14, gap = 10;
        const usable = H - m.t - m.b - gap * (n - 1), k = usable / pairs;
        const outT = M.map(r => d3.sum(r)), inT = d3.range(n).map(j => d3.sum(M, r => r[j]));
        const yL = [], yR = []; let accL = m.t, accR = m.t;
        for (let i = 0; i < n; i++) { yL[i] = accL; accL += outT[i] * k + gap; yR[i] = accR; accR += inT[i] * k + gap; }
        const xl = m.l, xr = W - m.r;
        const head = (x, text, anchor) => { const t = svg('text', { x, y: m.t - 22, 'text-anchor': anchor, style: 'font-size:11.5px;fill:#7C8088;letter-spacing:.12em;text-transform:uppercase' }); t.textContent = text; root.append(t); };
        head(xl + bw, 'Parent born in', 'end'); head(xr - bw, 'Child born in', 'start');
        // ribbons: the ones that stayed first (faint), then the moves
        const offL = yL.slice(), offR = yR.slice(), bands = [];
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
          const c = M[a][b]; if (!c) continue;
          bands.push({ a, b, c, y0: offL[a], y1: offR[b], h: c * k });
          offL[a] += c * k; offR[b] += c * k;
        }
        const rg = svg('g');
        bands.sort((p, q) => (p.a === p.b ? 0 : 1) - (q.a === q.b ? 0 : 1)).forEach(d => {
          const x0 = xl + bw, x1 = xr - bw, xm = (x0 + x1) / 2, stay = d.a === d.b;
          const path = `M${x0},${d.y0}C${xm},${d.y0} ${xm},${d.y1} ${x1},${d.y1}V${d.y1 + d.h}C${xm},${d.y1 + d.h} ${xm},${d.y0 + d.h} ${x0},${d.y0 + d.h}Z`;
          const base = stay ? .16 : .55;
          const pth = svg('path', { d: path, fill: stay ? '#7C8088' : color(d.b), 'fill-opacity': base, style: 'cursor:pointer' });
          pth.addEventListener('mousemove', e => { pth.setAttribute('fill-opacity', stay ? .4 : .9); ui.tip('<b>' + ui.esc(names[d.a]) + (stay ? ' (stayed)' : ' → ' + ui.esc(names[d.b])) + '</b><span>' + ui.fmt(d.c) + ' parent-and-child pairs, ' + (d.c / pairs * 100).toFixed(d.c / pairs < .01 ? 1 : 0) + '% of all recorded pairs. Click to list the children.</span>', e.clientX, e.clientY); });
          pth.addEventListener('mouseleave', () => { pth.setAttribute('fill-opacity', base); ui.untip(); });
          pth.addEventListener('click', () => FO.showList(stay ? 'Born in ' + names[d.a] + ', like a parent' : names[d.a] + ' → ' + names[d.b], 'Children born in ' + names[d.b] + ' with a parent born in ' + names[d.a], [...new Set(who[d.a][d.b])].sort((x, y) => (x.est || 0) - (y.est || 0))));
          rg.append(pth);
        });
        root.append(rg);
        const label = (x, y, h, text, count, anchor) => {
          if (h < 3 && count / pairs < 0.004) return;
          const t = svg('text', { x, y: y + Math.max(h / 2, 5) + 4, 'text-anchor': anchor, style: 'font-size:13px;fill:#1B2632' }); t.textContent = text;
          const c = svg('tspan', { style: 'fill:#7C8088;font-size:11.5px' }); c.textContent = '  ' + ui.fmt(count); t.append(c); root.append(t);
        };
        for (let i = 0; i < n; i++) {
          if (outT[i]) { root.append(svg('rect', { x: xl, y: yL[i], width: bw, height: Math.max(1, outT[i] * k), fill: color(i) })); label(xl - 10, yL[i], outT[i] * k, names[i], outT[i], 'end'); }
          if (inT[i]) { root.append(svg('rect', { x: xr - bw, y: yR[i], width: bw, height: Math.max(1, inT[i] * k), fill: color(i) })); label(xr + 10, yR[i], inT[i] * k, names[i], inT[i], 'start'); }
        }
        const moved = pairs - d3.sum(d3.range(n), i => M[i][i]);
        hint.textContent = ui.fmt(pairs) + ' parent-and-child pairs with both birthplaces recorded; ' + ui.fmt(moved) + ' children (' + Math.round(moved / pairs * 100) + '%) were born in a different region from that parent. Grey ribbons stayed; coloured ribbons moved, coloured by where the child was born. A child with two recorded parents counts twice.';
      }
      // the map: births or deaths, a century or all, with or without places known only by region
      let what = FO.prefs.get('places.map.what', 'birth', ['birth', 'death']), period = 'all', showRegions = FO.prefs.get('places.map.regions', 'show', ['show', 'hide']) === 'show';
      let mapRun = null;
      const mapZoom = {};   // the map's zoom, kept from one drawing to the next
      function map() {
        const run = { stage: v.stage, root, hint, data, what, period, regions: showRegions, keep: mapZoom, onLegend: items => { if (legendBox) legendBox.remove(); legendBox = FO.legend(v.stage, 'On the map', items); } };
        run.cancelled = () => mapRun !== run;
        mapRun = run;
        FO.placesMap(run);
      }
      const years = new Set();
      data.people.forEach(p => { if (p.hidden) return; const y = p.b && p.b.place ? (p.by != null ? p.by : p.est) : null, z = p.d && p.d.place ? p.dy : null; if (y != null) years.add(Math.floor(y / 100) * 100); if (z != null) years.add(Math.floor(z / 100) * 100); });
      const periodSel = ui.select('Period', [{ v: 'all', label: 'All years' }].concat([...years].sort().map(c => ({ v: c, label: c + 's' }))), period, x => { period = x; draw(); });
      const mapCtl = el('span', { class: 'ctl-group', style: { display: 'contents' } },
        ui.seg([{ v: 'birth', label: 'Births' }, { v: 'death', label: 'Deaths' }], what, x => { what = x; FO.prefs.set('places.map.what', x); draw(); }),
        periodSel,
        el('label', { class: 'ctl' }, el('span', { text: 'Regions only' }), ui.seg([{ v: 'show', label: 'Show' }, { v: 'hide', label: 'Hide' }], showRegions ? 'show' : 'hide', x => { showRegions = x === 'show'; FO.prefs.set('places.map.regions', x); draw(); })),
        ui.button('Reset zoom', () => mapRun && mapRun.resetZoom && mapRun.resetZoom()));
      let legendBox = null;
      function draw() {
        root.innerHTML = ''; ui.untip(); if (legendBox) { legendBox.remove(); legendBox = null; }
        mapCtl.style.display = mode === 'map' ? 'contents' : 'none';
        if (mode !== 'map') mapRun = null;
        (mode === 'grid' ? grid : mode === 'map' ? map : ribbons)();
      }
      const lv = el('span', { class: 'ctl' }, el('span', { text: 'Rows' }), ui.seg([{ v: 'region', label: 'Regions' }, { v: 'place', label: 'Places' }], level, l => { level = l; FO.prefs.set('places.rows', l); draw(); }));
      if (mode !== 'grid') lv.style.display = 'none';
      v.controls.append(ui.scopeSeg());
      v.controls.append(ui.seg([{ v: 'ribbons', label: 'Ribbons' }, { v: 'grid', label: 'Grid' }, { v: 'map', label: 'Map' }], mode, m => { mode = m; FO.prefs.set('places.view', m); lv.style.display = m === 'grid' ? '' : 'none'; draw(); }), lv, mapCtl);
      const ro = new ResizeObserver(draw); ro.observe(v.stage);
      return () => ro.disconnect();
    }
  });
})();
