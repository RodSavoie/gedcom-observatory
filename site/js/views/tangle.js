/* The tangle: surnames as circles, marriages as the threads between them. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el, svg = ui.svg, C = FO.C;

  /* The bubbles' look, in one place. Opacity runs from 0 (see-through) to 1 (solid): 0.85 is 85%. */
  const BUBBLE_FILL = '#eee';          // the inside of each bubble (in Original; each design has its own tone of it, 'bubble' in designs.js)
  const BUBBLE_OPACITY = 0.85;
  const BUBBLE_HOVER = '#FFE8CF';      // the inside while the pointer is over it

  FO.view({
    id: 'tangle', order: 6, title: 'The Tangle',
    card: 'Surnames as circles, tied together by the marriages between them.',
    how: {"see": "Each circle is a surname and each thread is a marriage between two surnames. Families that married each other often are pulled close together, so crowded knots show tightly linked families.", "marks": ["A bigger circle means more people carry that surname. The red circle is the home person’s surname.", "A thread’s thickness is the number of marriages between the two surnames; the faintest threads are single marriages.", "A pink ring around a circle means some marriages joined two people who both had that surname."], "can": ["Point at a circle to light up the families it married into. Click a circle or a thread to list the couples.", "Choose a surname from the list above the picture, or open the most-married pairs.", "Drag any circle to see how it is tied in: its threads pull its neighbours along, and it springs back gently when you let go. Reset layout lets every circle settle again and zooms back out to the whole picture. Use the slider to show more or fewer surnames, and scroll to zoom."], "care": "Only marriages where both partners have a surname are drawn, and marriages of living people are left out. Spellings that differ only by accents are treated as one name."},
    blurb: 'Each circle is a surname, sized by how many people carry it. A thread joins two surnames whenever a couple married across them; thicker threads mean more couples. Click a circle or a thread to list the couples.',
    icon: '<path d="M18 20 L44 16 M18 20 L28 44 M44 16 L28 44 M44 16 L52 40 M28 44 L52 40" stroke="#C9C1B1" stroke-width="2"/><path d="M18 20 L28 44" stroke="#A35139" stroke-width="2.6"/><circle cx="18" cy="20" r="9" fill="#fff"/><circle cx="44" cy="16" r="6" fill="#fff"/><circle cx="28" cy="44" r="8" fill="#fff"/><circle cx="52" cy="40" r="5" fill="#fff"/>',
    render(v) {
      const s = v.state, data = FO.scoped(v.data);
      // spellings that differ only by accents or capitals are treated as one name, shown in its commonest spelling
      const raw = d3.rollup(data.people.filter(p => p.surname && !p.hidden), x => x.length, p => p.surname);
      const canon = new Map(), bestN = new Map();
      for (const [name, n] of raw) { const k = FO.norm(name); if (!bestN.has(k) || n > bestN.get(k)) { bestN.set(k, n); canon.set(k, name); } }
      const sn = p => (p && p.surname ? canon.get(FO.norm(p.surname)) : '');
      const count = d3.rollup(data.people.filter(p => p.surname && !p.hidden), x => x.length, sn);
      const all = [...count.entries()].sort((a, b) => b[1] - a[1]);
      if (all.length < 2) { ui.empty(v.stage, 'Not enough surnames', 'This file has fewer than two surnames, so there is nothing to tangle.'); return; }
      let N = Math.min(36, all.length), sim = null;
      const root = svg('svg', {}), g = svg('g');
      root.append(g); v.stage.append(root);
      const zoom = d3.zoom().scaleExtent([0.4, 6]).on('zoom', e => g.setAttribute('transform', e.transform));
      d3.select(root).call(zoom).on('dblclick.zoom', null);
      const hint = el('div', { class: 'hint' }); v.stage.append(hint);

      function couplesOf(a, b) {
        return data.families.filter(f => f.husb && f.wife && !f.husb.hidden && !f.wife.hidden && (b == null ? (sn(f.husb) === a || sn(f.wife) === a) : ((sn(f.husb) === a && sn(f.wife) === b) || (sn(f.husb) === b && sn(f.wife) === a))))
          .sort((x, y) => (x.my || x.husb.est || 0) - (y.my || y.husb.est || 0));
      }
      function listCouples(title, fams) {
        FO.showList(title, fams.length + (fams.length === 1 ? ' couple' : ' couples'), fams.map(f => el('li', {}, el('span', {}, ui.plink(f.husb), ' and ', ui.plink(f.wife)), el('small', { text: f.my ? 'm. ' + f.my : '' }))));
      }

      function build() {
        if (sim) { sim.stop(); sim.nodes().forEach(n => n.back && n.back.stop()); }
        g.innerHTML = '';
        const W = v.stage.clientWidth, H = v.stage.clientHeight;
        const names = new Set(all.slice(0, N).map(d => d[0]));
        const rmax = Math.max(18, Math.min(58, Math.sqrt(W * H / N) * 0.3));
        const rs = d3.scaleSqrt().domain([0, all[0][1]]).range([4, rmax]);
        const nodes = all.slice(0, N).map(([name, n]) => ({ id: name, n, r: rs(n) }));
        const lk = new Map(), same = new Map();
        data.families.forEach(f => {
          if (!f.husb || !f.wife || f.husb.hidden || f.wife.hidden) return;
          const a = sn(f.husb), b = sn(f.wife);
          if (a && a === b && names.has(a)) same.set(a, (same.get(a) || 0) + 1);
          if (!names.has(a) || !names.has(b) || a === b) return;
          const key = a < b ? a + '|' + b : b + '|' + a;
          lk.set(key, (lk.get(key) || 0) + 1);
        });
        let links = [...lk.entries()].map(([k, n]) => ({ source: k.split('|')[0], target: k.split('|')[1], n }));
        const minN = links.length > 260 ? 2 : 1;
        const shown = links.filter(l => l.n >= minN);
        const wmax = d3.max(links, l => l.n) || 1;
        // a thread's width is the number of marriages between the two surnames
        const ws = d3.scaleLinear().domain([1, Math.max(2, wmax)]).range([1.6, Math.max(8, Math.min(22, rmax * 0.42))]);
        sim = d3.forceSimulation(nodes)
          .force('link', d3.forceLink(shown).id(d => d.id).distance(l => 60 + 160 / l.n).strength(l => 0.03 + 0.25 * l.n / wmax))
          .force('charge', d3.forceManyBody().strength(d => -90 - d.r * 14))
          .force('collide', d3.forceCollide().radius(d => d.r + 10).strength(0.75))
          .force('x', d3.forceX(W / 2).strength(0.05 * H / W)).force('y', d3.forceY(H / 2).strength(0.05 * W / H))
          .force('centre', d3.forceCenter(W / 2, H / 2))   // keeps the whole picture in the middle of the page
          .velocityDecay(0.55)        // more friction than usual, so movement is soft and settles quickly
          .alphaDecay(0.035)
          .stop();
        // start close to rest, so the picture opens calmly and only settles the last little way on screen
        for (let i = 0; i < 260; i++) sim.tick();
        const homeName = sn(s.home);
        const THREAD = '#2B80AA';
        const lg = svg('g', { stroke: THREAD, 'stroke-linecap': 'round' }), ng = svg('g');
        const lines = shown.map(l => {
          const ln = svg('line', { x1: l.source.x, y1: l.source.y, x2: l.target.x, y2: l.target.y, 'stroke-width': ws(l.n), 'stroke-opacity': l.n === 1 ? .22 : .34, style: 'cursor:pointer' });
          ln.addEventListener('mousemove', e => { ln.setAttribute('stroke', C.red); ln.setAttribute('stroke-opacity', .8); ui.tip('<b>' + ui.esc(l.source.id) + ' and ' + ui.esc(l.target.id) + '</b><span>' + l.n + (l.n === 1 ? ' couple' : ' couples') + '</span>', e.clientX, e.clientY); });
          ln.addEventListener('mouseleave', () => { ln.setAttribute('stroke', THREAD); ln.setAttribute('stroke-opacity', l.n === 1 ? .22 : .34); ui.untip(); });
          ln.addEventListener('click', () => listCouples(l.source.id + ' and ' + l.target.id, couplesOf(l.source.id, l.target.id)));
          lg.append(ln);
          return { l, ln };
        });
        nodes.forEach(n => {
          const gg = svg('g', { transform: `translate(${n.x},${n.y})`, style: 'cursor:grab' });
          const c = svg('circle', { r: n.r, fill: BUBBLE_FILL, 'fill-opacity': BUBBLE_OPACITY, stroke: n.id === homeName ? C.red : '#1B2632', 'stroke-opacity': n.id === homeName ? 1 : .55, 'stroke-width': n.id === homeName ? 2.6 : 2 });
          const fit = (n.r * 1.84) / (n.id.length * 0.56);
          const inside = fit >= 9;
          const fs = inside ? Math.min(15, n.r * 0.42, fit) : 10.5;
          const t = svg('text', { 'text-anchor': 'middle', y: inside ? fs * 0.35 : n.r + fs + 1, style: `font-size:${fs}px;fill:#1B2632;font-weight:${n.id === homeName ? 700 : 400};pointer-events:none;paint-order:stroke;stroke:#EEE9DF;stroke-width:${inside ? 0 : 3}px` });
          t.textContent = n.id;
          if (same.get(n.id)) gg.append(svg('circle', { r: n.r + 4, fill: 'none', stroke: '#C9628E', 'stroke-width': 2 }));
          gg.append(c, t);
          gg.addEventListener('mousemove', e => {
            c.setAttribute('fill', BUBBLE_HOVER);
            lines.forEach(x => { const on = x.l.source === n || x.l.target === n; x.ln.setAttribute('stroke-opacity', on ? .85 : .1); });
            ui.tip('<b>' + ui.esc(n.id) + '</b><span>' + ui.fmt(n.n) + ' people' + (same.get(n.id) ? '<br>' + same.get(n.id) + (same.get(n.id) === 1 ? ' marriage' : ' marriages') + ' between two people of this name' : '') + '</span>', e.clientX, e.clientY);
          });
          gg.addEventListener('mouseleave', () => { c.setAttribute('fill', BUBBLE_FILL); lines.forEach(x => x.ln.setAttribute('stroke-opacity', x.l.n === 1 ? .22 : .34)); ui.untip(); });
          gg.addEventListener('click', e => { if (!e.defaultPrevented) listCouples('Couples with the name ' + n.id, couplesOf(n.id)); });
          let moved = false;
          // drag a circle: its threads pull its neighbours along gently; let go and it springs back into the picture
          d3.select(gg).call(d3.drag()
            .on('start', () => { moved = false; })
            .on('drag', e => {
              // only once it really moves: lifting the circle to the front on a plain press would cancel the click that lists its couples
              if (!moved) { moved = true; ui.untip(); gg.style.cursor = 'grabbing'; ng.append(gg); if (n.back) n.back.stop(); n.ox = n.x; n.oy = n.y; sim.alphaTarget(0.12).restart(); }
              n.fx = e.x; n.fy = e.y;
            })
            .on('end', () => {
              gg.style.cursor = 'grab'; if (!moved) return;
              // glide back to where it was over about 0.7 s, easing in at the end, while the neighbours settle around it
              const x0 = n.fx, y0 = n.fy, ease = d3.easeCubicOut, dur = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 700;
              n.back = d3.timer(t => {
                const u = Math.min(1, t / dur), k = ease(u);
                n.fx = x0 + (n.ox - x0) * k; n.fy = y0 + (n.oy - y0) * k;
                if (u >= 1) { n.back.stop(); n.back = null; n.fx = null; n.fy = null; sim.alphaTarget(0); }
              });
            }));
          n.gg = gg;
          ng.append(gg);
        });
        g.append(lg, ng);
        const place = () => {
          nodes.forEach(n => n.gg.setAttribute('transform', `translate(${n.x},${n.y})`));
          lines.forEach(x => { x.ln.setAttribute('x1', x.l.source.x); x.ln.setAttribute('y1', x.l.source.y); x.ln.setAttribute('x2', x.l.target.x); x.ln.setAttribute('y2', x.l.target.y); });
        };
        sim.on('tick', place);
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) sim.alpha(0.12).restart();
        unpin = () => { nodes.forEach(n => { if (n.back) { n.back.stop(); n.back = null; } n.fx = null; n.fy = null; }); sim.alphaTarget(0).alpha(0.5).restart(); };
        topPairs = shown.slice().sort((a, b) => b.n - a.n).slice(0, 30);
        chooser.innerHTML = ''; chooser.append(el('option', { value: '', text: 'Choose a surname…' })); nodes.slice().sort((a, b) => a.id.localeCompare(b.id)).forEach(n => chooser.append(el('option', { value: n.id, text: n.id + ' (' + n.n + ')' })));
        hint.textContent = N + ' most common surnames of ' + ui.fmt(all.length) + ', joined by ' + ui.fmt(shown.length) + ' threads' + (minN > 1 ? ' (single marriages left out to keep it readable)' : '') + '. Drag any circle to see how it is tied in; it springs back when you let go. Scroll to zoom.';
      }
      let topPairs = [], unpin = () => {};
      const chooser = el('select', { 'aria-label': 'Choose a surname', onchange: () => { if (chooser.value) listCouples('Couples with the name ' + chooser.value, couplesOf(chooser.value)); } });
      v.controls.append(ui.scopeSeg());
      v.controls.append(el('label', { class: 'ctl' }, chooser), ui.button('Most-married pairs', () => FO.showList('Most-married pairs of surnames', 'Click a pair to list its couples', topPairs.map(l => el('li', {}, el('button', { type: 'button', class: 'plink', text: l.source.id + ' × ' + l.target.id, onclick: () => listCouples(l.source.id + ' and ' + l.target.id, couplesOf(l.source.id, l.target.id)) }), el('small', { text: l.n + (l.n === 1 ? ' marriage' : ' marriages') }))))));
      v.controls.append(ui.button('Reset layout', () => { unpin(); d3.select(root).transition().duration(500).call(zoom.transform, d3.zoomIdentity); }));
      v.controls.append(ui.range('Surnames shown', Math.min(8, all.length), Math.min(80, all.length), N, n => { N = n; build(); }));
      build();
      return () => { if (sim) { sim.stop(); sim.nodes().forEach(n => n.back && n.back.stop()); } };
    }
  });
})();
