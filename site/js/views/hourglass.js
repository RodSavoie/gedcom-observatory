/* Hourglass: ancestors above, descendants below. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el, svg = ui.svg, C = FO.C;
  const BW = 132, BH = 60, GX = 14, GY = 46;   // box width and height, and the gaps between boxes

  FO.view({
    id: 'hourglass', order: 3, title: 'Hourglass',
    card: 'Ancestors above, descendants below, as a classic family chart.',
    how: {"see": "A chart drawn around the home person, who sits in the middle in black. Ancestors rise above, each father on the left and mother on the right. Descendants hang below.", "marks": ["Each box is one person with a name and years. The stripe on a box’s left edge shows the sex the file records.", "A red outline means the same person fills more than one place on the chart, which happens when cousins married.", "A dashed box is a parent the file does not record. Blue-edged boxes are descendants.", "An arrow after the years means the line continues beyond what is shown."], "can": ["Choose how many generations to show above and below.", "Click a box for details; double-click it to make that person the home person.", "Scroll to zoom, drag to move, and use Fit to window to see it all."], "care": "Very large families are cut off after a few thousand boxes so the chart stays usable."},
    blurb: s => 'Parents and grandparents rise above ' + s.home.name + '; children and grandchildren fall below. Choose how many generations to show in each direction.',
    icon: '<rect x="24" y="27" width="16" height="10" fill="#1B2632"/><rect x="8" y="8" width="14" height="8"/><rect x="42" y="8" width="14" height="8"/><rect x="4" y="48" width="12" height="8"/><rect x="26" y="48" width="12" height="8"/><rect x="48" y="48" width="12" height="8"/><path d="M15 16 V21 H49 V16 M32 21 V27 M32 37 V43 M10 48 V43 H54 V48 M32 43 V48"/>',
    render(v) {
      const s = v.state, home = s.home;
      let up = FO.prefs.num('hg.up', 3, 0, 7), down = FO.prefs.num('hg.down', 2, 0, 5);
      const root = svg('svg', {}), g = svg('g');
      root.append(g); v.stage.append(root);
      const zoom = d3.zoom().scaleExtent([0.08, 3]).on('zoom', e => g.setAttribute('transform', e.transform));
      const sel = d3.select(root).call(zoom).on('dblclick.zoom', null);
      const hint = el('div', { class: 'hint' }); v.stage.append(hint);
      let nodes = [];

      function build() {
        g.innerHTML = '';
        nodes = [];
        let budget = 2500;
        const mk = (p, d, max, kids) => ({ p, kids: d < max && budget-- > 0 && p ? kids(p).map(c => mk(c, d + 1, max, kids)) : [] });
        // a parent the file lacks keeps its place as a dashed box, so fathers stay left and mothers right
        const aRoot = d3.hierarchy(mk(home, 0, up, p => (p.father || p.mother ? [p.father || null, p.mother || null] : [])), d => d.kids);
        const dRoot = d3.hierarchy(mk(home, 0, down, p => p.children.slice().sort((a, b) => (a.est || 9999) - (b.est || 9999))), d => d.kids);
        const tree = d3.tree().nodeSize([BW + GX, BH + GY]).separation((a, b) => (a.parent === b.parent ? 1 : 1.12));
        tree(aRoot); tree(dRoot);
        const links = svg('g', { fill: 'none', stroke: '#1B2632', 'stroke-opacity': .28, 'stroke-width': 2, 'stroke-linejoin': 'round' });
        const boxes = svg('g');
        g.append(links, boxes);   // on the page before the boxes are drawn, so their text can be measured
        const elbow = (x1, y1, x2, y2) => { const my = (y1 + y2) / 2; return `M${x1},${y1}V${my}H${x2}V${y2}`; };
        aRoot.links().forEach(l => links.append(svg('path', { d: elbow(l.source.x, -l.source.y - BH / 2, l.target.x, -l.target.y + BH / 2) })));
        dRoot.links().forEach(l => links.append(svg('path', { d: elbow(l.source.x, l.source.y + BH / 2, l.target.x, l.target.y - BH / 2) })));
        const times = new Map();
        aRoot.each(n => { if (n.data.p) times.set(n.data.p, (times.get(n.data.p) || 0) + 1); });
        dRoot.each(n => { if (n.depth) times.set(n.data.p, (times.get(n.data.p) || 0) + 1); });
        let repeats = 0;
        const add = (n, y, kind) => {
          if (!n.data.p) {
            const mg = svg('g', { transform: `translate(${n.x - BW / 2},${y - BH / 2})` });
            mg.append(svg('rect', { width: BW, height: BH, rx: 4, class: 'hbox-missing' }));
            const mt = svg('text', { x: BW / 2, y: BH / 2 + 4, 'text-anchor': 'middle', style: 'font-size:11.5px;fill:#7C8088;font-style:italic' }); mt.textContent = (n.parent && n.parent.children.indexOf(n) === 0 ? 'father' : 'mother') + ' not recorded';
            mg.append(mt); boxes.append(mg); return;
          }
          const p = n.data.p, isHome = p === home, rep = times.get(p) > 1 && !isHome;
          if (rep) repeats++;
          const i = nodes.push(p) - 1;
          const gg = svg('g', { transform: `translate(${n.x - BW / 2},${y - BH / 2})`, 'data-i': i, class: 'hbox', style: 'cursor:pointer' });
          gg.append(svg('rect', { width: BW, height: BH, rx: 4, fill: isHome ? '#1B2632' : '#fff', stroke: isHome ? '#1B2632' : rep ? C.red : kind === 'a' ? '#1B2632' : C.teal, 'stroke-opacity': isHome || rep ? 1 : .5, 'stroke-width': isHome ? 1 : rep ? 2.4 : 2 }));
          // the coloured edge on the left follows the box's rounded corners
          if (!isHome) gg.append(svg('path', { d: `M4,0 V${BH} A4,4 0 0 1 0,${BH - 4} V4 A4,4 0 0 1 4,0 Z`, fill: p.sex === 'M' ? C.frost : p.sex === 'F' ? C.blush : C.soft }));
          // first name(s) on one line, surname on the next, then the dates
          const nameStyle = `font-size:12.5px;font-weight:600;fill:${isHome ? '#fff' : '#1B2632'}`;
          const given = p.given || (p.surname ? '' : p.name), sur = p.surname || '';
          const lines = given && sur ? [given, sur] : [given || sur || p.name];
          const dates = (FO.lifespan(p) || (p.hidden ? '' : 'dates unknown'));
          const tn = lines.map((txt, k) => { const t = svg('text', { x: 13, y: lines.length > 1 ? 17 + k * 15 : dates ? 24 : BH / 2 + 4, style: nameStyle }); t.textContent = txt; return t; });
          const more = kind === 'a' && n.depth === up && (p.father || p.mother) ? ' ↑' : kind === 'd' && n.depth === down && p.children.length ? ' ↓ ' + p.children.length : '';
          const t2 = svg('text', { x: 13, y: lines.length > 1 ? 49 : 42, style: `font-size:11px;fill:${isHome ? '#D8DDE3' : C.ink3}` }); t2.textContent = dates + more;
          gg.append(...tn, t2); boxes.append(gg);
          // anything wider than the box is trimmed to fit, with an ellipsis (measured, since letters vary in width)
          const room = BW - 13 - 7;
          tn.concat(t2).forEach(t => {
            if (!t.getComputedTextLength || t.getComputedTextLength() <= room) return;
            if (t === t2) { t.style.fontSize = '10px'; if (t.getComputedTextLength() <= room) return; }
            // drop whole words first ("Françoise Marie Brigitte Anne" becomes "Françoise Marie…"), then letters if one word is still too long
            const words = t.textContent.split(' ');
            while (words.length > 1 && t.getComputedTextLength() > room) { words.pop(); t.textContent = words.join(' ') + '…'; }
            let txt = words.join(' ');
            while (txt.length > 2 && t.getComputedTextLength() > room) { txt = txt.slice(0, -1); t.textContent = txt.trimEnd() + '…'; }
            const full = t === t2 ? null : lines[tn.indexOf(t)]; if (full) { const ti = svg('title'); ti.textContent = full; t.append(ti); }
          });
        };
        aRoot.each(n => add(n, -n.y, 'a'));
        dRoot.each(n => { if (n.depth > 0) add(n, n.y, 'd'); });
        hint.textContent = ui.fmt(aRoot.descendants().filter(n => n.data.p).length - 1) + ' ancestors and ' + ui.fmt(dRoot.descendants().length - 1) + ' descendants shown. Click a box for details, double-click to make that person the home person. ↑ and ↓ mean the line continues' + (repeats ? '; a red outline marks someone who fills more than one place.' : '.');
        fit();
      }
      function fit() {
        const bb = g.getBBox(), W = v.stage.clientWidth, H = v.stage.clientHeight;
        if (!bb.width || !W) return;
        const k = Math.min(1.15, (W - 40) / bb.width, (H - 60) / bb.height);
        sel.call(zoom.transform, d3.zoomIdentity.translate(W / 2 - (bb.x + bb.width / 2) * k, H / 2 - (bb.y + bb.height / 2) * k).scale(k));
      }
      const idx = e => { const n = e.target.closest && e.target.closest('g[data-i]'); return n ? nodes[+n.getAttribute('data-i')] : null; };
      let timer = null;
      root.addEventListener('click', e => { const p = idx(e); if (!p) return; clearTimeout(timer); timer = setTimeout(() => FO.select(p), 220); });
      root.addEventListener('dblclick', e => { const p = idx(e); if (!p) return; clearTimeout(timer); FO.setHome(p); });
      root.addEventListener('mousemove', e => { const p = idx(e); if (p) ui.tip(ui.personTip(p, FO.relToHome(p)), e.clientX, e.clientY); else ui.untip(); });
      root.addEventListener('mouseleave', ui.untip);
      const maxUp = Math.max(1, Math.min(7, FO.kin().anc.gens.length - 1));
      up = Math.min(up, maxUp);
      v.controls.append(
        ui.range('Generations up', 0, maxUp, up, n => { up = n; FO.prefs.set('hg.up', n); build(); }),
        ui.range('Generations down', 0, 5, down, n => { down = n; FO.prefs.set('hg.down', n); build(); }),
        ui.picker('Centre on', home, p => FO.setHome(p)),
        ui.button('Fit to window', fit));
      build();
      return () => {};
    }
  });
})();
