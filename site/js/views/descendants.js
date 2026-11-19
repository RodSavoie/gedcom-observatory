/* Descendants: rings of slices, one colour per child of the person in the middle. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el, svg = ui.svg, C = FO.C;

  FO.view({
    id: 'descendants', order: 10, title: 'Descendants',
    card: 'Everyone who descends from one person, in rings coloured by child.',
    how: {"see": "A circle with the starting person in the middle. Each ring outward is the next generation: children, then grandchildren, and so on. A wider slice has more descendants.", "marks": ["Each child of the person in the middle has a colour, and their whole branch keeps it, paling outward.", "A red edge marks a descendant who appears more than once, because two lines of descent married each other.", "A pale grey slice is someone who may be living."], "can": ["Point at a slice for a short card; click for details.", "Double-click a slice to put that person in the middle.", "Choose a starting person by name, or from the list of ancestors with the most descendants. Change the number of rings; scroll to zoom."], "care": "Only recorded descendants are drawn. Very large families are cut short in the outer rings."},
    blurb: 'The person in the middle is surrounded by their children, then grandchildren, and so on outward. Each child’s branch keeps one colour. A red edge marks a descendant who appears more than once, through two different lines.',
    icon: '<circle cx="32" cy="32" r="6" fill="#1B2632"/><path d="M32 18 A14 14 0 0 1 44 39 M41 43 A14 14 0 0 1 20 39 M18 32 A14 14 0 0 1 29 18.4"/><path d="M32 8 A24 24 0 0 1 52 19 M54 24 A24 24 0 0 1 50 48 M46 52 A24 24 0 0 1 16 50 M12 45 A24 24 0 0 1 12 20 M15 15 A24 24 0 0 1 27 8.5"/><path d="M54 24 A24 24 0 0 1 50 48" stroke="#A35139" stroke-width="2.4"/>',
    render(v) {
      const s = v.state, home = s.home, data = v.data;
      const list = FO.founders();
      const homeDesc = FO.descent(home).min.size - 1;
      let rootP = s.founder || (homeDesc >= 12 || !list.length ? home : FO.featured());
      if (!rootP.children.length && !list.length) { ui.empty(v.stage, 'No descendants recorded', home.name + ' has no children in this file. Use the search box above to pick someone who does.'); }
      let G = FO.prefs.num('desc.gen', 6, 1, 12), nodes = [], legendBox = null;
      const root = svg('svg', {}), g = svg('g');
      root.append(g); v.stage.append(root);
      const zoom = d3.zoom().scaleExtent([0.6, 16]).on('zoom', e => g.setAttribute('transform', e.transform));
      d3.select(root).call(zoom).on('dblclick.zoom', null);
      const hint = el('div', { class: 'hint' }); v.stage.append(hint);
      const pick = ui.picker('Descendants of', rootP, p => { rootP = p; draw(); });

      function draw() {
        g.innerHTML = ''; if (legendBox) legendBox.remove(); legendBox = null;
        pick.setPerson(rootP);
        const W = v.stage.clientWidth, H = v.stage.clientHeight;
        let budget = 7000, truncated = false;
        const mk = (p, d) => {
          const n = { p, kids: [] };
          if (d < G) for (const c of p.children.slice().sort((a, b) => (a.est || 9999) - (b.est || 9999))) { if (budget-- <= 0) { truncated = true; break; } n.kids.push(mk(c, d + 1)); }
          return n;
        };
        const h = d3.hierarchy(mk(rootP, 0), d => d.kids).sum(d => (d.kids.length ? 0 : 1));
        if (!h.children) { hint.textContent = rootP.name + ' has no children recorded in this file. Pick someone else above.'; const t = svg('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', style: 'font-size:16px;fill:#3D4B5E' }); t.textContent = 'No descendants recorded for ' + rootP.name; g.append(t); return; }
        const depth = h.height;
        const R = Math.min(W, H) / 2 - 18, hole = Math.max(40, R * 0.16), ring = (R - hole) / depth;
        d3.partition().size([Math.PI * 2, depth + 1])(h);
        const cx = W / 2, cy = H / 2;
        const hues = FO.CAT.slice(1);
        const branches = h.children.slice().sort((a, b) => b.value - a.value);
        const colorOf = new Map(branches.map((b, i) => [b, i < hues.length ? hues[i] : FO.OTHER]));
        const count = new Map();
        h.each(n => count.set(n.data.p, (count.get(n.data.p) || 0) + 1));
        nodes = h.descendants();
        const cells = svg('g', { transform: `translate(${cx},${cy})` }), edges = svg('g', { transform: `translate(${cx},${cy})`, fill: 'none', stroke: C.red, 'stroke-width': 2.2, 'stroke-opacity': .85, 'pointer-events': 'none' }), texts = svg('g', { transform: `translate(${cx},${cy})`, 'pointer-events': 'none' });
        nodes.forEach((n, i) => {
          if (!n.depth) return;
          let b = n; while (b.depth > 1) b = b.parent;
          const base = colorOf.get(b);
          const col = d3.interpolateRgb(base, '#ffffff')(Math.min(0.62, (n.depth - 1) * 0.11));
          const r0 = hole + (n.depth - 1) * ring, r1 = r0 + ring, arcLen0 = (n.x1 - n.x0) * (r0 + r1) / 2;
          cells.append(svg('path', { d: d3.arc()({ innerRadius: r0, outerRadius: r1, startAngle: n.x0, endAngle: n.x1 }), fill: n.data.p.hidden ? '#DDD7CA' : col, stroke: arcLen0 >= 5 ? C.bg : (n.data.p.hidden ? '#DDD7CA' : col), 'stroke-width': arcLen0 >= 5 ? 1.4 : 0.6, 'data-i': i, style: 'cursor:pointer' }));
          if (count.get(n.data.p) > 1) edges.append(svg('path', { d: FO.arcLine(r1 - 1.2, n.x0, n.x1) }));
          const mid = (n.x0 + n.x1) / 2, rm = (r0 + r1) / 2, arcLen = (n.x1 - n.x0) * rm;
          if (arcLen > 11 && ring > 34 && !n.data.p.hidden) {
            const maxc = Math.floor((ring - 6) / 5.6);
            const fn = (n.data.p.given || n.data.p.name).split(' ')[0];
            const label = n.data.p.name.length <= maxc ? n.data.p.name : fn.length <= maxc ? fn : fn.slice(0, Math.max(1, maxc - 1)) + '…';
            const flip = mid > Math.PI;
            const t = svg('text', { transform: `rotate(${mid * 180 / Math.PI - 90}) translate(${rm},0) rotate(${flip ? 180 : 0})`, 'text-anchor': 'middle', dy: '.35em', style: 'font-size:10.5px;fill:#1B2632' });
            t.textContent = label; texts.append(t);
          }
        });
        g.append(cells, edges, texts);
        g.append(svg('circle', { cx, cy, r: hole - 3, fill: '#1B2632', 'data-i': 0, style: 'cursor:pointer' }));
        const parts = rootP.name.split(' '), half = Math.ceil(parts.length / 2);
        [parts.slice(0, half).join(' '), parts.slice(half).join(' '), FO.lifespan(rootP)].filter(Boolean).forEach((line, k, arr) => {
          const t = svg('text', { x: cx, y: cy + (k - (arr.length - 1) / 2) * 14 + 4, 'text-anchor': 'middle', 'pointer-events': 'none', style: `font-size:${k === arr.length - 1 && FO.lifespan(rootP) ? 10.5 : 12}px;fill:${k === arr.length - 1 && FO.lifespan(rootP) ? '#D8DDE3' : '#fff'};font-weight:${k === arr.length - 1 && FO.lifespan(rootP) ? 400 : 600}` });
          t.textContent = line.length > 18 ? line.slice(0, 17) + '…' : line; g.append(t);
        });
        const items = branches.slice(0, hues.length).map(b => ({ label: b.data.p.name, color: colorOf.get(b), count: b.descendants().length - 1 }));
        if (branches.length > hues.length) items.push({ label: (branches.length - hues.length) + ' other children', color: FO.OTHER });
        legendBox = FO.legend(v.stage, 'Children of ' + rootP.name.split(' ')[0] + ' (descendants shown)', items);
        const distinct = count.size - 1, places = nodes.length - 1;
        hint.textContent = ui.fmt(distinct) + ' descendants over ' + depth + ' generations' + (places > distinct ? ', filling ' + ui.fmt(places) + ' places because some descend through more than one line' : '') + (truncated ? '. Very large tree: outer rings are cut short' : '') + '. Click for details, double-click a slice to put that person in the middle.';
      }
      const at = e => { const i = e.target.getAttribute && e.target.getAttribute('data-i'); return i == null ? null : nodes[+i]; };
      root.addEventListener('mousemove', e => { const n = at(e); if (n) ui.tip(ui.personTip(n.data.p, n.depth ? 'Generation ' + n.depth + (n.children ? ' · ' + (n.descendants().length - 1) + ' below in this chart' : '') : 'Centre of this chart'), e.clientX, e.clientY); else ui.untip(); });
      root.addEventListener('mouseleave', ui.untip);
      let timer = null;
      root.addEventListener('click', e => { const n = at(e); if (!n) return; clearTimeout(timer); timer = setTimeout(() => FO.select(n.data.p), 220); });
      root.addEventListener('dblclick', e => { const n = at(e); if (!n || !n.depth) return; clearTimeout(timer); rootP = n.data.p; draw(); });
      v.controls.append(pick);
      if (list.length) v.controls.append(ui.select('Ancestors with most descendants', [{ v: '', label: 'Choose…' }].concat(list.map((f, i) => ({ v: i, label: f.p.name + ' (' + ui.fmt(f.n) + ')' }))), '', i => { if (i !== '') { rootP = list[+i].p; draw(); } }));
      v.controls.append(ui.range('Generations', 1, 12, G, n => { G = n; FO.prefs.set('desc.gen', n); draw(); }), ui.button('Reset zoom', () => d3.select(root).transition().duration(500).call(zoom.transform, d3.zoomIdentity)));
      const ro = new ResizeObserver(draw); ro.observe(v.stage);
      return () => ro.disconnect();
    }
  });
})();
