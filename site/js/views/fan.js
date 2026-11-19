/* Ancestor fan: the home person at the centre, one ring per generation. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el, svg = ui.svg, C = FO.C;

  FO.pedigreeSlots = function (home, G, cap) {
    const out = [];
    (function rec(p, g, lo, w, flags) {
      if (cap && out.length >= cap) return;
      out.push({ p, g, lo, w, flags });
      if (g >= G) return;
      // flags: 1 = Y line, 2 = mitochondrial line, 4 = X-DNA path
      if (p.father) rec(p.father, g + 1, lo, w / 2, (flags & 1) | (p.sex === 'M' ? 0 : flags & 4));
      if (p.mother) rec(p.mother, g + 1, lo + w / 2, w / 2, (flags & 2) | (flags & 4));
    })(home, 0, 0, 1, (home.sex === 'M' ? 1 : 0) | 2 | 4);
    return out;
  };

  // open arc at radius r; angles clockwise from 12 o'clock
  const arcLine = (r, a, b) => `M${r * Math.sin(a)},${-r * Math.cos(a)}A${r},${r} 0 ${Math.abs(b - a) > Math.PI ? 1 : 0} ${b > a ? 1 : 0} ${r * Math.sin(b)},${-r * Math.cos(b)}`;
  const fitName = (p, maxc) => {
    if (p.hidden) return 'Living';
    const first = (p.given || '').split(' ')[0];
    const opts = [p.name, (first + ' ' + p.surname).trim(), first && p.surname ? first[0] + '. ' + p.surname : '', p.surname || first, first];
    for (const o of opts) if (o && o.length <= maxc) return o;
    const o = opts[3] || p.name;
    return maxc >= 4 ? o.slice(0, maxc - 1) + '…' : '';
  };

  FO.view({
    id: 'fan', order: 2, title: 'Ancestor Fan',
    card: 'Rings of ancestors around one person, with repeats edged in red.',
    how: {"see": "A fan of the home person’s recorded ancestors. The home person is the circle in the middle and each ring outward is one generation further back, with the father’s side on the left and the mother’s side on the right.", "marks": ["Each wedge is one ancestor. Its colour shows birthplace, surname, how often that person appears (from once to more than twenty times, pale to deep), or era, depending on the Colour button.", "A red edge means one person fills more than one place. That happens when cousins married, so the same ancestor sits on both sides. Point at one and every place they fill stays bright while the rest fades.", "A pale empty place means no ancestor is recorded there yet. A white wedge may be a living person and shows no name.", "The small numbers along the left edge count generations back: 1 is parents, 2 is grandparents."], "can": ["Point at a wedge to read a short card and light up every place that person fills.", "Click for full details; double-click to make that person the home person.", "Change the number of rings, or the colouring, with the controls above the picture. Scroll to zoom."], "care": "Only recorded ancestors are drawn, and no more than fourteen rings. Names appear only where they fit."},
    blurb: s => 'Each ring is one generation back from ' + s.home.name + '; fathers to the left of each pair, mothers to the right. A red edge marks someone who fills more than one place, which happens when cousins marry.',
    icon: '<path d="M8 44 A24 24 0 0 1 56 44" /><path d="M16 44 A16 16 0 0 1 48 44"/><path d="M24 44 A8 8 0 0 1 40 44"/><path d="M32 20 V36 M15 27 L26.5 38.5 M49 27 L37.5 38.5"/><path d="M40.5 21.5 A24 24 0 0 1 53.5 33" stroke="#A35139" stroke-width="2.4"/><circle cx="32" cy="44" r="3" fill="#1B2632"/>',
    render(v) {
      const s = v.state, home = s.home;
      const maxDepth = FO.kin().anc.gens.length - 1;
      if (maxDepth < 1) { ui.empty(v.stage, 'No parents recorded', home.name + ' has no parents in this file, so there is no fan to draw. Pick another person from The family menu.'); return; }
      // v.hero: the home page picture, always Surname colouring and 8 generations, with the legend beside it
      const hero = !!v.hero;
      let G = hero ? Math.min(8, maxDepth) : FO.prefs.num('fan.gen', Math.min(8, maxDepth), 2, Math.min(14, maxDepth)),
        mode = hero ? 'surname' : FO.prefs.get('fan.colour', 'place', ['place', 'surname', 'repeat', 'century']);
      const root = svg('svg', {});
      const g = svg('g');
      root.append(g); v.stage.append(root);
      const zoom = d3.zoom().scaleExtent([0.6, 14]).on('zoom', e => g.setAttribute('transform', e.transform));
      if (!hero) d3.select(root).call(zoom).on('dblclick.zoom', null);   // the home page keeps its normal scrolling
      let legendBox = null, sideBox = null, slots = [], shadowArc = null, heroLegend = null;
      // repeat ancestors: one neutral step, then six warm steps from pale to deep (the ramp follows the site's palette)
      const ramp = d3.piecewise(d3.interpolateRgb, ['#F9D3A6', '#E8975A', '#A35139', '#6E2F1D']);
      const REP = ['#D5CFC2'].concat([0, 0.22, 0.44, 0.64, 0.83, 1].map(ramp));
      const REP_LABELS = ['one', 'two', 'three', 'four', 'five to nine', 'ten to twenty', 'more than twenty'];
      const repBin = n => (n <= 4 ? n - 1 : n <= 9 ? 4 : n <= 20 ? 5 : 6);

      function draw() {
        g.innerHTML = ''; litP = null;
        if (legendBox) legendBox.remove();
        if (sideBox) sideBox.remove();
        // the home page draws into its own (larger) picture area; the view fills its stage
        const area = hero ? root.getBoundingClientRect() : null;
        const W = hero ? area.width : v.stage.clientWidth, H = hero ? area.height : v.stage.clientHeight;
        const tuck = hero && W >= 760;   // home page on a wide screen: the legend tucks into the fan's top-right corner
        const side = hero ? (tuck ? 0 : W >= 640 ? 236 : 0) : W > 1100 ? 300 : 0;
        if (!W || !H) return;
        if (shadowArc) { shadowArc.remove(); shadowArc = null; }
        if (heroLegend) { heroLegend.remove(); heroLegend = null; }
        slots = FO.pedigreeSlots(home, G, 20000);
        const count = new Map();
        slots.forEach(t => count.set(t.p, (count.get(t.p) || 0) + 1));
        const span = Math.PI * 1.5, a0 = -span / 2;
        const legW = 214, legHmax = 26 + 9 * 21;   // room kept for the home page legend (longest line about 206 px, at most 9 rows)
        // where the tucked legend starts: just clear of the fan's curved shoulder at the legend's lowest row
        const legX = (R, cx) => { const dy = Math.max(0, R - legHmax - 8) / R; return cx + R * Math.sqrt(1 - dy * dy) + 22; };
        let R = tuck ? Math.min((H - 34) / 1.72, W / 2 - 16) : Math.min((W - side) / 2 - 16, (H - 34) / 1.72);
        if (tuck) while (R > 60 && legX(R, R + 16) + legW > W - 6) R -= 2;   // shrink until the legend fits beside the shoulder
        // full view: side card on the left; home page: legend on the right, fan centred in the rest
        const cx = tuck ? R + 16 : hero ? (W - side) / 2 : side + (W - side) / 2, cy = tuck ? 14 + R : hero ? Math.max(14, (H - 1.74 * R) / 2) + R : 14 + R;
        const wts = d3.range(0, G + 1).map(i => i === 0 ? 0.75 : i <= 4 ? 1 : Math.max(0.42, 1 - (i - 4) * 0.13));
        const tot = d3.sum(wts);
        const r0 = [], r1 = [];
        let acc = 0;
        wts.forEach((w, i) => { r0[i] = acc / tot * R; acc += w; r1[i] = acc / tot * R; });
        // colour
        const anc = slots.filter(t => t.g > 0).map(t => t.p);
        let fill, legend;
        if (mode === 'place') {
          const cat = FO.topCategories([...new Set(anc)], p => FO.region(p.b && p.b.place));
          fill = p => p.hidden ? '#fff' : cat.color(p);
          legend = ['Born in', cat.legend];
        } else if (mode === 'surname') {
          const cat = FO.topCategories([...new Set(anc)], p => (p.hidden ? null : p.surname));
          fill = p => p.hidden ? '#fff' : cat.color(p);
          legend = ['Surname', cat.legend];
        } else if (mode === 'repeat') {
          fill = p => p.hidden ? '#fff' : REP[repBin(count.get(p))];
          legend = ['Places this person fills', REP.map((c, i) => ({ label: REP_LABELS[i], color: c }))];
        } else if (mode === 'century') {
          const ys = anc.filter(p => p.est != null).map(p => p.est);
          const sc = d3.scaleLinear().domain([d3.min(ys), d3.max(ys)]).range(['#2C3B4D', '#E6EAEE']).interpolate(d3.interpolateRgb);
          fill = p => p.est != null ? sc(p.est) : '#fff';
          legend = ['Born', [{ label: 'around ' + d3.min(ys), color: '#2C3B4D' }, { label: 'around ' + Math.round((d3.min(ys) + d3.max(ys)) / 2), color: sc((d3.min(ys) + d3.max(ys)) / 2) }, { label: 'around ' + d3.max(ys), color: '#E6EAEE' }]];
        } else { fill = () => '#fff'; legend = null; }
        // opaque, softened fills: translucent wedges leave seams where they meet
        const soften = mode === 'place' || mode === 'surname' ? 0.42 : 0;
        const tint = new Map();
        const paint = p => { const c = fill(p); if (!soften) return c; if (!tint.has(c)) tint.set(c, d3.interpolateRgb(c, '#ffffff')(soften)); return tint.get(c); };
        const fanArc = (ra, rb) => d3.arc()({ innerRadius: ra, outerRadius: rb, startAngle: a0, endAngle: a0 + span });
        // empty rings behind
        g.append(svg('path', { d: fanArc(r0[1], r1[G]), transform: `translate(${cx},${cy})`, fill: 'rgba(27,38,50,.045)' }));
        const cells = svg('g', { transform: `translate(${cx},${cy})`, 'shape-rendering': 'geometricPrecision' });
        const rings = svg('g', { transform: `translate(${cx},${cy})`, fill: 'none', stroke: C.bg, 'stroke-width': 1.5, 'pointer-events': 'none' });
        const edges = svg('g', { transform: `translate(${cx},${cy})`, fill: 'none', stroke: C.red, 'stroke-width': 2.2, 'stroke-opacity': .85, 'pointer-events': 'none' });
        const texts = svg('g', { transform: `translate(${cx},${cy})`, 'pointer-events': 'none', style: 'font-size:11px' });
        const years = p => (p.hidden ? '' : FO.lifespan(p).replace(/ - /, '-').replace(/\?$/, ''));
        slots.forEach((t, i) => {
          if (t.g === 0) return;
          const sa = a0 + t.lo * span, ea = a0 + (t.lo + t.w) * span;
          const mid = (sa + ea) / 2, rm = (r0[t.g] + r1[t.g]) / 2, arcLen = (ea - sa) * rm, thick = r1[t.g] - r0[t.g];
          const col = paint(t.p), wide = arcLen >= 5;
          // wide wedges get a gap in the page colour; slivers are sealed with their own colour so no hairlines show
          cells.append(svg('path', { d: d3.arc()({ innerRadius: r0[t.g], outerRadius: r1[t.g], startAngle: sa, endAngle: ea }), fill: col, stroke: wide ? C.bg : col, 'stroke-width': wide ? 1.5 : 0.6, 'stroke-opacity': wide ? .9 : 1, 'data-i': i, style: 'cursor:pointer' }));
          if (count.get(t.p) > 1) edges.append(svg('path', { d: arcLine(r1[t.g] - 1.6, sa + (wide ? 0.003 : 0), ea - (wide ? 0.003 : 0)) }));
          // labels: a name, and the years underneath where there is room
          const yrs = years(t.p);
          const darkCell = mode === 'repeat' && !t.p.hidden && repBin(count.get(t.p)) >= 5;
          const ink1 = darkCell ? '#fff' : '#1B2632', ink2 = darkCell ? 'rgba(255,255,255,.82)' : '#3D4B5E';
          if (t.g <= 2 && arcLen > 60) {
            const flip = Math.abs(mid) > Math.PI / 2 + 0.2, two = yrs && thick > 44;
            const line = (txt, rr, size, colr, idx) => {
              const id = 'fa' + i + '-' + idx;
              texts.append(svg('path', { id, d: arcLine(rr, flip ? ea : sa, flip ? sa : ea), fill: 'none' }));
              const tx = svg('text', { style: `font-size:${size}px;fill:${colr}` });
              const tp = svg('textPath', { href: '#' + id, startOffset: '50%', 'text-anchor': 'middle' });
              tp.textContent = txt; tx.append(tp); texts.append(tx);
            };
            const dir = flip ? -1 : 1;
            line(fitName(t.p, Math.floor(arcLen / 7.4)), rm - dir * (two ? -3 : 4), 13, ink1, 0);
            if (two) line(yrs, rm - dir * 13, 10.5, ink2, 1);
          } else if (arcLen > 10 && thick > 30) {
            const deg = mid * 180 / Math.PI - 90, flip = mid < 0;
            const two = yrs && arcLen > 23, size = arcLen > 15 ? 10.5 : 9;
            const tx = svg('text', { transform: `rotate(${deg}) translate(${rm},0) rotate(${flip ? 180 : 0})`, 'text-anchor': 'middle', style: `font-size:${size}px;fill:${ink1}` });
            const t1 = svg('tspan', { x: 0, dy: two ? '-.2em' : '.35em' }); t1.textContent = fitName(t.p, Math.floor((thick - 6) / (size * 0.52)));
            tx.append(t1);
            if (two) { const t2 = svg('tspan', { x: 0, dy: '1.15em', style: 'font-size:8.5px;fill:' + ink2 }); t2.textContent = yrs.length * 4.4 < thick - 4 ? yrs : ''; tx.append(t2); }
            texts.append(tx);
          }
        });
        for (let i = 1; i < G; i++) rings.append(svg('path', { d: arcLine(r1[i], a0, a0 + span) }));
        // a veil that fades everything except the person being pointed at
        veil = svg('path', { d: fanArc(r0[1], r1[G] + 1), transform: `translate(${cx},${cy})`, fill: C.bg, class: 'fan-veil', 'pointer-events': 'none' });
        lit = svg('g', { transform: `translate(${cx},${cy})`, 'pointer-events': 'none' });
        g.append(cells, rings, edges, veil, lit, texts);
        // centre
        g.append(svg('circle', { cx, cy, r: r1[0] - 2, fill: '#1B2632' }));
        const parts = (home.name.length > 20 ? ((home.given || '').split(' ')[0] + ' ' + home.surname).trim() : home.name).split(' ');
        const l1 = parts.slice(0, Math.ceil(parts.length / 2)).join(' '), l2 = parts.slice(Math.ceil(parts.length / 2)).join(' ');
        [l1, l2].forEach((line, k) => { const t = svg('text', { x: cx, y: cy + (l2 ? (k ? 9 : -5) : 4), 'text-anchor': 'middle', style: 'font-size:' + Math.max(9, Math.min(13, r1[0] / 5.2)) + 'px;fill:#fff;font-weight:600', 'pointer-events': 'none' }); t.textContent = line; g.append(t); });
        // generation labels along the left edge
        // each number is centred on its ring and set the same distance out from the fan's edge
        const nx = -Math.cos(a0), ny = -Math.sin(a0), off = 12;
        // where the outer rings are too thin for every number, skip some (always keeping the outermost)
        const mids = d3.range(1, G + 1).map(i => (r0[i] + r1[i]) / 2), gap = 17, shown = [];
        mids.forEach((m, k) => { if (!shown.length || m - mids[shown[shown.length - 1]] >= gap) shown.push(k); });
        if (shown[shown.length - 1] !== G - 1) { if (mids[G - 1] - mids[shown[shown.length - 1]] < gap) shown.pop(); shown.push(G - 1); }
        for (const k of shown) {
          const i = k + 1, rm = mids[k];
          const t = svg('text', { x: cx + Math.sin(a0) * rm + nx * off, y: cy - Math.cos(a0) * rm + ny * off, 'text-anchor': 'middle', 'dominant-baseline': 'central', style: 'font-size:12px;font-weight:600;fill:#7C8088;font-variant-numeric:tabular-nums' });
          t.textContent = i; g.append(t);
        }
        if (legend && hero) {
          // a soft shadow along the fan's outline, drawn once behind it (cheap, so hovering stays smooth)
          shadowArc = svg('path', { d: d3.arc()({ innerRadius: 0, outerRadius: r1[G] + 1, startAngle: a0, endAngle: a0 + span }), transform: `translate(${cx},${cy})`, fill: C.bg, class: 'fan-shadow' });
          root.insertBefore(shadowArc, g);
          // the home page legend is part of the picture: tucked into the corner beside the fan's shoulder, or in a column
          const lx = tuck ? legX(R, cx) : W - side + 6;
          if (tuck || side) {
            const L = svg('g', { transform: `translate(${lx},${Math.max(18, cy - R + 8)})`, class: 'fan-legend' });
            const tt = svg('text', { x: 0, y: 12, style: 'font-size:13px;font-weight:500;fill:#1B2632' }); tt.textContent = legend[0]; L.append(tt);
            legend[1].concat([{ label: 'Red edge: fills more than one place', color: C.red, line: true }]).forEach((it, k) => {
              const y = 26 + k * 21;
              L.append(it.line ? svg('line', { x1: 0, y1: y + 7, x2: 12, y2: y + 7, stroke: it.color, 'stroke-width': 2.5 }) : svg('circle', { cx: 6, cy: y + 7, r: 5, fill: it.color }));
              const t = svg('text', { x: 20, y: y + 11, style: 'font-size:12px;fill:#1B2632' }); t.textContent = it.label + (it.count != null ? ' (' + ui.fmt(it.count) + ')' : ''); L.append(t);
            });
            root.append(L); heroLegend = L;
          }
        } else if (legend) legendBox = FO.legend(v.stage, legend[0], legend[1].concat([{ label: 'Red edge: fills more than one place', color: C.red, line: true }]));
        if (hero) return;   // no side card or note on the home page
        // pedigree-collapse summary
        const distinctN = new Set(anc).size, repeatsN = anc.length - distinctN;
        sideBox = el('div', { class: 'sidecard' });
        sideBox.append(el('h3', { text: repeatsN ? 'Cousins married in this tree' : 'No ancestor appears twice' }),
          el('div', { class: 'kpis' }, el('div', {}, el('b', { text: ui.fmt(anc.length) }), el('span', { text: 'places filled' })), el('div', {}, el('b', { text: ui.fmt(distinctN) }), el('span', { text: 'different people' })), el('div', { class: 'hot' }, el('b', { text: ui.fmt(repeatsN) }), el('span', { text: 'repeats' }))),
          el('p', { text: repeatsN ? 'When cousins marry, the ancestors they share fill more than one place. Genealogists call it pedigree collapse.' : 'Every place in these rings is filled by a different person.' }));
        const tb = el('table', {}, el('tr', {}, el('th', { text: 'Generation' }), el('th', { text: 'Possible' }), el('th', { text: 'Filled' }), el('th', { text: 'People' })));
        for (let i = 1; i <= G; i++) {
          const inGen = slots.filter(t => t.g === i), ppl = new Set(inGen.map(t => t.p)).size;
          tb.append(el('tr', { class: ppl < inGen.length ? 'rep' : '' }, el('td', { text: i }), el('td', { text: ui.fmt(Math.pow(2, i)) }), el('td', { text: ui.fmt(inGen.length) }), el('td', { text: ui.fmt(ppl) })));
        }
        sideBox.append(tb);
        const firstGen = new Map();
        slots.forEach(t => { if (t.g && count.get(t.p) > 1 && !t.p.hidden && !firstGen.has(t.p)) firstGen.set(t.p, t.g); });
        // nearest repeated ancestors, leaving out the parents of someone already listed
        const near = [...firstGen.entries()].sort((a, b) => a[1] - b[1] || count.get(b[0]) - count.get(a[0])).slice(0, 8);
        if (near.length) {
          sideBox.append(el('h3', { text: 'Where the lines first rejoin', style: { marginTop: '14px' } }));
          const ul = el('ul');
          near.forEach(([p, gen]) => {
            const li = el('li', {}, el('span', {}, ui.plink(p)), el('small', { text: count.get(p) + ' places, from ring ' + gen }));
            li.addEventListener('mouseenter', () => light(p)); li.addEventListener('mouseleave', () => light(null));
            ul.append(li);
          });
          sideBox.append(ul);
        }
        v.stage.append(sideBox);
        hint.textContent = 'Hover to light up every place a person fills. Click for details, double-click to make someone the home person, scroll to zoom.' + (FO.kin().anc.gens.length - 1 > G ? ' More ancestors are recorded beyond ring ' + G + '.' : '');
      }

      const hint = el('div', { class: 'hint' });
      if (!hero) v.stage.append(hint);
      let veil = null, lit = null, litP = null;
      function light(p) {
        if (p === litP) return lit ? lit.childNodes.length : 0;
        litP = p;
        if (!lit) return 0;
        lit.innerHTML = '';
        let n = 0;
        if (p) g.querySelectorAll('path[data-i]').forEach(node => {
          if (slots[+node.getAttribute('data-i')].p === p) { n++; const c = node.cloneNode(false); c.removeAttribute('data-i'); c.setAttribute('stroke', '#1B2632'); c.setAttribute('stroke-opacity', .55); c.setAttribute('stroke-width', 1.5); lit.append(c); }
        });
        veil.classList.toggle('on', n > 0);
        return n;
      }
      const over = e => {
        const i = e.target.getAttribute && e.target.getAttribute('data-i');
        if (i == null) { light(null); ui.untip(); return; }
        const t = slots[+i];
        const n = light(t.p);
        ui.tip(ui.personTip(t.p, (t.g === 1 ? 'Parent' : FO.relLabel(0, t.g, t.p.sex)) + (n > 1 ? ' · appears ' + n + ' times here' : '')), e.clientX, e.clientY);
      };
      root.addEventListener('mousemove', over);
      root.addEventListener('mouseleave', () => over({ target: root }));
      const ro = new ResizeObserver(() => draw()); ro.observe(v.stage);
      if (hero) return () => { ro.disconnect(); ui.untip(); };   // on the home page a click anywhere opens the full Ancestor Fan
      let clickTimer = null;
      root.addEventListener('click', e => {
        const i = e.target.getAttribute('data-i'); if (i == null) return;
        clearTimeout(clickTimer); clickTimer = setTimeout(() => FO.select(slots[+i].p), 220);
      });
      root.addEventListener('dblclick', e => {
        const i = e.target.getAttribute('data-i'); if (i == null) return;
        clearTimeout(clickTimer); FO.setHome(slots[+i].p);
      });
      v.controls.append(
        ui.range('Generations', 2, Math.min(14, maxDepth), G, n => { G = n; FO.prefs.set('fan.gen', n); draw(); }),
        el('span', { class: 'ctl' }, el('span', { text: 'Colour' }), ui.seg([{ v: 'place', label: 'Birthplace' }, { v: 'surname', label: 'Surname' }, { v: 'repeat', label: 'Repeat ancestors' }, { v: 'century', label: 'Era' }], mode, m => { mode = m; FO.prefs.set('fan.colour', m); draw(); })),
        el('span', { class: 'ctl-group' },
          ui.button('Reset zoom', () => d3.select(root).transition().duration(500).call(zoom.transform, d3.zoomIdentity)),
          ui.button('Save as SVG', () => {
            const slug = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            FO.saveSVG(root, { title: 'Ancestor Fan', legend: legendBox, file: 'ancestor-fan-' + slug(FO.state.home && FO.state.home.name) });
          })));
      return () => ro.disconnect();
    }
  });

  /* the home page picture: the fan drawn by the view above in its home-page mode */
  FO.heroFan = function (box) {
    if (FO.kin().anc.gens.length < 2) return null;   // no parents recorded: the home page keeps the star chart
    return FO.views.find(x => x.id === 'fan').render({ stage: box, state: FO.state, hero: true });
  };
})();
