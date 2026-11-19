/* Ancestors through time: every recorded ancestor drawn once, in pedigree order or untangled,
   on a scale of birth years or of generations. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el, C = FO.C;
  const DNA = { y: { bit: 1, color: '#5450A8', label: 'Y-DNA' }, mt: { bit: 2, color: '#C9628E', label: 'Mitochondrial' }, x: { bit: 4, color: '#DB8328', label: 'X-DNA' } };
  const SEX = { M: '#2B80AA', F: '#C9628E', U: '#B3AC9C' };
  const SIDES = ['Father’s father’s side', 'Father’s mother’s side', 'Mother’s father’s side', 'Mother’s mother’s side'];
  const SIDE_COL = ['#2B80AA', '#5450A8', '#DB8328', '#C9628E'];

  FO.view({
    id: 'time', order: 4, title: 'Ancestors Through Time',
    card: 'Each ancestor drawn once, by birth year or by generation, in pedigree order or untangled.',
    blurb: s => 'The recorded ancestors of ' + s.home.name + ', placed by birth year or by generation, with a line from every child to each parent.',
    how: {
      see: 'Each dot is the home person or one of their recorded ancestors. “Arrange” sets left to right: pedigree order (father’s side left, mother’s side right) or untangled, where people are moved so the lines that reach them come together. “Scale” sets up and down: by birth year, earliest at the top, or by generation. The home person is at the foot.',
      marks: ['Lines join each child to their father and mother.', 'Colour shows men and women, or which grandparent’s side a person belongs to.', 'A red ring marks a person where separate lines meet: two or more of their children are also ancestors, usually because cousins married. Everyone above a ring is reached by more than one line too; point at anyone to see how many lines reach them. Each person is drawn only once.', 'In pedigree order, a small dashed ring shows where the pedigree meets someone again; a faint dashed line joins it to their dot. Nothing above a dashed ring is repeated.', 'A hollow dot has no recorded birth year. On the scale of years it is placed by a guess. Grey dots may be living.'],
      can: ['Point at a dot for a short card; click it to light up its line down to the home person and open its details.', 'Switch Arrange, Scale and Colour; the picture slides to its new places.', 'Press a DNA button to light the people and lines that carry it: Y-DNA father to son, mitochondrial DNA mother to child, X-DNA by its own zig-zag rule.', 'Change the number of generations, show lifetimes on the scale of years, or press Play to watch the generations appear.', 'Scroll to zoom into a crowded part and drag to move around; more names appear as there is room for them. Reset zoom goes back to the whole chart.'],
      care: 'People with no recorded birth year are placed by a guess. The picture shows what the file records, not what is certain. The untangled arrangement follows an idea from B. F. Lyon’s work on visualising family trees.'
    },
    icon: '<path d="M32 56 V46 M32 46 L18 34 M32 46 L46 34 M18 34 L10 20 M18 34 L26 20 M46 34 L38 20 M46 34 L54 20 M26 20 L32 8 M38 20 L32 8" /><g fill="#1B2632" stroke="none"><circle cx="32" cy="56" r="2.6"/><circle cx="18" cy="34" r="2"/><circle cx="46" cy="34" r="2"/><circle cx="10" cy="20" r="1.8"/><circle cx="26" cy="20" r="1.8"/><circle cx="38" cy="20" r="1.8"/><circle cx="54" cy="20" r="1.8"/></g><circle cx="32" cy="8" r="3" fill="#A35139" stroke="none"/>',
    render(v) {
      const s = v.state, home = s.home;
      const anc = FO.kin().anc, maxDepth = anc.gens.length - 1;
      if (maxDepth < 1) { ui.empty(v.stage, 'No parents recorded', home.name + ' has no parents in this file. Pick another home person from The family menu.'); return; }
      let G = FO.prefs.num('time.gen', Math.min(maxDepth, 8), 2, Math.min(maxDepth, 24)), order = 'untangled', scale = 'year', colorBy = 'sex', lifetimes = false;
      let fromKey = order + '|' + scale, tw = 1, rev = 1, raf = 0, hover = null, picked = null;
      const on = { y: false, mt: false, x: false };
      let nodes = [], marks = [], byP = new Map(), maxG = 1, yMin = 0, yHome = 0, legendBox = null;
      const lines = p => anc.paths.get(p) || 1; // every line from the home person, in all generations (as in the details panel)
      const meets = n => new Set(n.kids).size > 1; // separate lines come together here: two or more of this person's children are ancestors

      function compute() {
        // walk the pedigree once; a person met again becomes a marker and is not expanded
        nodes = []; marks = []; byP = new Map();
        const layer = new Map();
        for (let g = 0; g <= G && g < anc.gens.length; g++) for (const p of anc.gens[g].keys()) layer.set(p, g); // deepest generation wins
        // generation by generation, so each person is drawn where the pedigree first reaches them
        let frontier = [{ p: home, lo: 0, w: 1, flags: (home.sex === 'M' ? 1 : 0) | 2 | 4, child: null }];
        for (let g = 0; g <= G && frontier.length; g++) {
          const next = [];
          for (const it of frontier) {
            const p = it.p, seen = byP.get(p);
            if (seen) { seen.flags |= it.flags; seen.n++; seen.kids.push(it.child); marks.push({ p, g, x: it.lo + it.w / 2, child: it.child, ref: seen }); continue; }
            const n = { p, g, ped: it.lo + it.w / 2, flags: it.flags, n: 1, kids: it.child ? [it.child] : [], pars: [], side: g < 2 ? -1 : Math.min(3, Math.floor((it.lo + it.w / 2) * 4)), layer: layer.get(p) };
            byP.set(p, n); nodes.push(n);
            if (it.child) it.child.pars.push(n);
            if (g >= G) continue;
            if (p.father) next.push({ p: p.father, lo: it.lo, w: it.w / 2, flags: (it.flags & 1) | (p.sex === 'M' ? 0 : it.flags & 4), child: n });
            if (p.mother) next.push({ p: p.mother, lo: it.lo + it.w / 2, w: it.w / 2, flags: (it.flags & 2) | (it.flags & 4), child: n });
          }
          frontier = next;
        }
        // a repeat's extra child also counts that person as a parent
        marks.forEach(m => { if (!m.child.pars.includes(m.ref)) m.child.pars.push(m.ref); });
        // DNA flags reached through a later line still have to travel up from that person
        for (let pass = 0; pass < 3; pass++) nodes.forEach(n => n.pars.forEach(par => {
          const isF = par.p === n.p.father;
          par.flags |= isF ? ((n.flags & 1) | (n.p.sex === 'M' ? 0 : n.flags & 4)) : ((n.flags & 2) | (n.flags & 4));
        }));
        maxG = d3.max(nodes, n => n.layer) || 1;
        // untangled: pull each person toward their own pedigree place, their children and their parents
        nodes.forEach(n => (n.ux = n.ped));
        for (let pass = 0; pass < 50; pass++) {
          nodes.forEach(n => {
            let t = n.ped, wsum = 1;
            if (n.kids.length) { t += 1.6 * d3.mean(n.kids, k => k.ux); wsum += 1.6; }
            if (n.pars.length) { t += 0.8 * d3.mean(n.pars, k => k.ux); wsum += 0.8; }
            n.ux = t / wsum;
          });
        }
        for (const [, row] of d3.group(nodes, n => n.layer)) {
          row.sort((a, b) => a.ux - b.ux);
          row.forEach((n, r) => (n.ux = row.length === 1 ? n.ux : 0.6 * n.ux + 0.4 * ((r + 0.5) / row.length)));
        }
        yHome = home.est != null ? home.est : new Date().getFullYear() - 40;
        nodes.forEach(n => (n.yr = n.p.est != null ? n.p.est : yHome - 30 * n.layer));
        yMin = d3.min(nodes, n => n.yr);
        const span = Math.max(1, yHome - yMin);
        nodes.forEach(n => {
          n.pos = {
            'pedigree|gen': [n.ped, n.g / maxG], 'pedigree|year': [n.ped, (yHome - n.yr) / span],
            'untangled|gen': [n.ux, n.layer / maxG], 'untangled|year': [n.ux, (yHome - n.yr) / span]
          };
        });
        marks.forEach(m => { m.pos = { 'pedigree|gen': [m.x, m.g / maxG], 'pedigree|year': [m.x, Math.min(1, (yHome - m.ref.yr) / span)] }; });
        const repeats = nodes.filter(meets).length;
        baseHint = hint.textContent = ui.fmt(nodes.length - 1) + ' ancestors in ' + G + ' generations' + (repeats ? '; ' + ui.fmt(repeats) + ' of them are where separate lines meet (red rings): two or more of their children are ancestors too' : '') + (G < maxDepth ? '. The file records ' + maxDepth + ' generations; raise Generations to see more.' : '.') + ' Scroll to zoom, drag to move.';
        if (legendBox) legendBox.remove();
        legendBox = FO.legend(v.stage, colorBy === 'sex' ? 'Colour' : 'Grandparent’s side',
          (colorBy === 'sex' ? [{ label: 'Men', color: SEX.M }, { label: 'Women', color: SEX.F }] : SIDES.map((t, i) => ({ label: t, color: SIDE_COL[i] })))
            .concat([{ label: 'Where separate lines meet', color: C.red }, { label: 'May be living', color: C.frost }]));
      }

      const m = { l: 58, r: 26, t: 26, b: 48 };
      const setMargin = () => { m.r = v.stage.clientWidth > 1000 ? 236 : 26; };
      const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      const key = () => order + '|' + scale;
      const colOf = n => n.p.hidden ? C.frost : colorBy === 'sex' ? SEX[n.p.sex] || SEX.U : n.side < 0 ? '#1B2632' : SIDE_COL[n.side];

      // zoom: positions spread apart while dots, lines and names keep their size, so more names find room
      let zt = d3.zoomIdentity, zoom = null;
      const draw = api => {
        const ctx = api.ctx, font = getComputedStyle(document.body).fontFamily;
        ctx.clearRect(0, 0, api.w, api.h);
        if (!nodes.length) return;
        setMargin();
        const plotW = api.w - m.l - m.r, plotH = api.h - m.t - m.b, e = ease(tw), k = key();
        if (zoom) zoom.extent([[0, 0], [api.w, api.h]]).translateExtent([[0, 0], [api.w, api.h]]);
        const Z = q => [zt.applyX(q[0]), zt.applyY(q[1])];
        const at = pos => { const a = pos[fromKey] || pos[k], b = pos[k] || pos[fromKey]; return [m.l + (a[0] + (b[0] - a[0]) * e) * plotW, api.h - m.b - (a[1] + (b[1] - a[1]) * e) * plotH]; };
        const cut = api.h - m.b - rev * plotH - 2;
        // axis
        ctx.font = '11px ' + font; ctx.fillStyle = C.ink3; ctx.strokeStyle = 'rgba(27,38,50,.055)'; ctx.lineWidth = 1.5; ctx.textAlign = 'right';
        if (scale === 'year') {
          const sc = zt.rescaleY(d3.scaleLinear().domain([yHome, yMin]).range([api.h - m.b, m.t]));
          sc.ticks(10).forEach(t => { const y = sc(t); if (y < 4 || y > api.h - 4) return; ctx.beginPath(); ctx.moveTo(m.l - 6, y); ctx.lineTo(api.w - m.r, y); ctx.stroke(); ctx.fillText(t, m.l - 10, y + 4); });
        } else {
          for (let g = 0; g <= maxG; g++) { const y = zt.applyY(api.h - m.b - g / maxG * plotH); if (y < 4 || y > api.h - 4) continue; ctx.beginPath(); ctx.moveTo(m.l - 6, y); ctx.lineTo(api.w - m.r, y); ctx.stroke(); if (g) ctx.fillText(g, m.l - 10, y + 4); }
          ctx.save(); ctx.translate(16, m.t + plotH / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText('generations back', 0, 0); ctx.restore();
        }
        ctx.textAlign = 'left';
        ctx.save(); ctx.beginPath(); ctx.rect(m.l - 4, 0, api.w - m.l + 4, api.h - 30); ctx.clip(); // keep the chart off the axis when zoomed
        nodes.forEach(n => { n.base = at(n.pos); n.xy = Z(n.base); });
        const showMarks = order === 'pedigree' && tw >= 1;
        if (showMarks) marks.forEach(mk => { mk.base = at(mk.pos); mk.xy = Z(mk.base); });
        const vis = n => n.base[1] >= cut;
        const onScreen = n => n.xy[0] > m.l - 12 && n.xy[0] < api.w + 12 && n.xy[1] > -12 && n.xy[1] < api.h + 12;
        // lifetimes
        if (lifetimes && scale === 'year' && tw >= 1) {
          const sc = d3.scaleLinear().domain([yHome, yMin]).range([api.h - m.b, m.t]);
          ctx.strokeStyle = 'rgba(27,38,50,.16)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath();
          nodes.forEach(n => { if (!vis(n) || n.p.by == null || n.p.dy == null) return; ctx.moveTo(n.xy[0], n.xy[1]); ctx.lineTo(n.xy[0], zt.applyY(Math.min(api.h - m.b, sc(n.p.dy)))); });
          ctx.stroke(); ctx.lineCap = 'butt';
        }
        // links: every child to each parent (in pedigree order a repeat is reached through its marker)
        const markOf = new Map(); if (showMarks) marks.forEach(mk => markOf.set(mk.child.p.id + '>' + mk.p.id, mk));
        const link = (n, par, style) => {
          const mk = showMarks ? markOf.get(n.p.id + '>' + par.p.id) : null;
          const q = mk ? mk.xy : par.xy;
          ctx.moveTo(n.xy[0], n.xy[1]); ctx.lineTo(q[0], q[1]);
        };
        ctx.strokeStyle = 'rgba(27,38,50,.13)'; ctx.lineWidth = 1.7; ctx.lineJoin = 'round'; ctx.beginPath();
        nodes.forEach(n => { if (!vis(n)) return; n.pars.forEach(par => { if (vis(par)) link(n, par); }); });
        ctx.stroke();
        if (showMarks) {
          ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(163,81,57,.35)'; ctx.beginPath();
          marks.forEach(mk => { if (mk.base[1] < cut) return; ctx.moveTo(mk.xy[0], mk.xy[1]); ctx.lineTo(mk.ref.xy[0], mk.ref.xy[1]); });
          ctx.stroke();
          ctx.strokeStyle = C.red; ctx.lineWidth = 1.2; ctx.setLineDash([2, 2]);
          marks.forEach(mk => { if (mk.base[1] < cut) return; ctx.beginPath(); ctx.arc(mk.xy[0], mk.xy[1], 4, 0, 6.3); ctx.stroke(); });
          ctx.setLineDash([]);
        }
        // DNA lines
        ['x', 'y', 'mt'].forEach(kk => {
          if (!on[kk]) return;
          const d = DNA[kk];
          ctx.strokeStyle = d.color; ctx.lineWidth = kk === 'x' ? 1.6 : 2.6; ctx.beginPath();
          nodes.forEach(n => { if (!(n.flags & d.bit) || !vis(n)) return; n.pars.forEach(par => { if ((par.flags & d.bit) && vis(par) && (kk !== 'y' || par.p.sex === 'M') && (kk !== 'mt' || par.p.sex === 'F') && (kk !== 'x' || !(n.p.sex === 'M' && par.p.sex === 'M'))) link(n, par); }); });
          ctx.stroke();
        });
        // the picked person's line down to the home person
        if (picked && byP.get(picked)) {
          ctx.strokeStyle = 'rgba(27,38,50,.8)'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.beginPath();
          const seenK = new Set();
          (function down(n) { if (seenK.has(n)) return; seenK.add(n); n.kids.forEach(kid => { ctx.moveTo(n.xy[0], n.xy[1]); ctx.lineTo(kid.xy[0], kid.xy[1]); down(kid); }); })(byP.get(picked));
          ctx.stroke();
        }
        // dots
        const R = n => Math.max(2.2, 6.2 - n.layer * 0.42);
        nodes.forEach(n => {
          if (!vis(n) || !onScreen(n)) return;
          const r = R(n), lit = ['y', 'mt', 'x'].find(kk => on[kk] && (n.flags & DNA[kk].bit));
          ctx.beginPath(); ctx.arc(n.xy[0], n.xy[1], r, 0, 6.3);
          if (n.p.by == null && !n.p.hidden) { ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = colOf(n); ctx.lineWidth = 1.4; ctx.stroke(); }
          else { ctx.fillStyle = colOf(n); ctx.fill(); }
          if (lit) { ctx.strokeStyle = DNA[lit].color; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(n.xy[0], n.xy[1], r + 2.2, 0, 6.3); ctx.stroke(); }
          else if (meets(n)) { ctx.strokeStyle = C.red; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(n.xy[0], n.xy[1], r + 2.2, 0, 6.3); ctx.stroke(); }
        });
        // names where there is room: nearest generations first, never over another name or a dot
        ctx.font = '11px ' + font; ctx.fillStyle = '#1B2632';
        const boxes = [], shown = nodes.filter(n => vis(n) && onScreen(n));
        const hit = (x0, y0, x1, y1) => boxes.some(b => x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]);
        shown.forEach(n => { const r = R(n) + 1; boxes.push([n.xy[0] - r, n.xy[1] - r, n.xy[0] + r, n.xy[1] + r]); });
        shown.slice().sort((a, b) => a.layer - b.layer).forEach(n => {
          if (n === nodes[0] || n.p.hidden) return;
          const first = (n.p.given || n.p.name).split(' ')[0], label = n.layer <= 3 ? n.p.name : (first + ' ' + n.p.surname).trim();
          const w = ctx.measureText(label).width, x = n.xy[0] + R(n) + 4, y = n.xy[1];
          if (x + w > api.w - 6 || y < 8 || y > api.h - 8 || hit(x, y - 6, x + w, y + 6)) return;
          ctx.fillText(label, x, y + 3.5); boxes.push([x - 2, y - 7, x + w + 2, y + 7]);
        });
        // home
        const h0 = nodes[0];
        ctx.fillStyle = '#1B2632'; ctx.beginPath(); ctx.arc(h0.xy[0], h0.xy[1], 6.5, 0, 6.3); ctx.fill();
        ctx.font = '600 12.5px ' + font; ctx.fillText(home.name, h0.xy[0] + 12, h0.xy[1] + 4);
        if (hover) { const n = hover.ref || hover; ctx.strokeStyle = '#1B2632'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.xy[0], n.xy[1], R(n) + 5, 0, 6.3); ctx.stroke(); }
        ctx.restore();
        api._cut = cut; api._marks = showMarks;
      };
      const cv = ui.canvas(v.stage, draw);

      function animate(dur, step, done) {
        cancelAnimationFrame(raf);
        const t0 = performance.now(), reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const tick = now => { const u = reduced ? 1 : Math.min(1, (now - t0) / dur); step(u); cv.redraw(); if (u < 1) raf = requestAnimationFrame(tick); else if (done) done(); };
        raf = requestAnimationFrame(tick);
      }
      function slide(change) {
        fromKey = key(); change(); tw = 0;
        animate(900, u => { tw = u; }, () => { fromKey = key(); tw = 1; cv.redraw(); });
      }
      const hint = el('div', { class: 'hint' }); v.stage.append(hint);
      const pickAt = e => {
        const r = cv.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        let best = null, bd = 120;
        nodes.forEach(n => { if (!n.xy || n.base[1] < cv._cut) return; const d = (n.xy[0] - x) ** 2 + (n.xy[1] - y) ** 2; if (d < bd) { bd = d; best = n; } });
        if (cv._marks) marks.forEach(mk => { if (!mk.xy) return; const d = (mk.xy[0] - x) ** 2 + (mk.xy[1] - y) ** 2; if (d < bd) { bd = d; best = mk; } });
        return best;
      };
      cv.canvas.addEventListener('mousemove', e => {
        const t = pickAt(e);
        if (t !== hover) { hover = t; cv.redraw(); }
        cv.canvas.style.cursor = t ? 'pointer' : 'grab';
        if (t) { const n = t.ref || t; const near = anc.min.get(n.p) || 0, L = lines(n.p), viaKids = new Set(n.kids).size; ui.tip(ui.personTip(n.p, (near ? (near === 1 ? 'Parent' : FO.relLabel(0, near, n.p.sex)) : 'Home person') + (L > 1 ? ' · reached by ' + ui.fmt(L) + ' lines' + (viaKids > 1 ? ', through ' + viaKids + ' of their children' : '') : '') + (t.ref ? ' · the pedigree meets this person again here' : '') + (n.p.by == null && !n.p.hidden ? ' · no birth year, placed by a guess' : '')), e.clientX, e.clientY); } else ui.untip();
      });
      cv.canvas.addEventListener('mouseleave', () => { hover = null; ui.untip(); cv.redraw(); });
      let baseHint = '';
      const pickNote = () => {
        if (!picked || picked === home) { hint.textContent = baseHint; return; }
        const total = anc.paths.get(picked) || 1;
        let deepest = 0;
        for (let g = 1; g < anc.gens.length; g++) if (anc.gens[g].get(picked)) deepest = g;
        // lines that can be followed through the people on the chart
        const memo = new Map();
        const down = n => { if (n === nodes[0]) return 1; if (memo.has(n)) return memo.get(n); memo.set(n, 0); const c = n.kids.reduce((a, k) => a + down(k), 0); memo.set(n, c); return c; };
        const drawn = byP.get(picked) ? down(byP.get(picked)) : 0;
        hint.textContent = picked.name + ' is reached by ' + ui.fmt(total) + (total === 1 ? ' line' : ' lines') + (drawn < total ? '; ' + ui.fmt(drawn) + ' of them can be followed in the ' + G + ' generations shown, drawn in black. Raise Generations to ' + deepest + ' to see every line.' : ', all drawn in black.');
      };
      cv.canvas.addEventListener('click', e => { const t = pickAt(e); if (!t) { picked = null; pickNote(); cv.redraw(); return; } const n = t.ref || t; picked = n.p; pickNote(); cv.redraw(); FO.select(n.p); });

      v.stage.pickPerson = p => { picked = byP.get(p) ? p : null; pickNote(); cv.redraw(); };
      const more = el('span', { class: 'ctl' }, el('label', { style: { display: 'flex', gap: '6px', alignItems: 'center', cursor: 'pointer' } }, el('input', { type: 'checkbox', onchange: e => { lifetimes = e.target.checked; if (lifetimes && scale !== 'year') ui.toast('Lifetimes are drawn on the scale of years.'); cv.redraw(); } }), 'Lifetimes'));
      v.controls.append(
        el('span', { class: 'ctl' }, el('span', { text: 'Arrange' }), ui.seg([{ v: 'pedigree', label: 'Pedigree order' }, { v: 'untangled', label: 'Untangled' }], order, o => slide(() => { order = o; }))),
        el('span', { class: 'ctl' }, el('span', { text: 'Scale' }), ui.seg([{ v: 'year', label: 'Birth year' }, { v: 'gen', label: 'Generation' }], scale, o => slide(() => { scale = o; }))),
        el('span', { class: 'ctl' }, el('span', { text: 'Colour' }), ui.seg([{ v: 'sex', label: 'Men and women' }, { v: 'side', label: 'Grandparent’s side' }], colorBy, o => { colorBy = o; compute(); cv.redraw(); })),
        el('span', { class: 'ctl-group' },   // the three DNA lines sit together, close
          ui.chip('Y-DNA', DNA.y.color, false, b => { on.y = b; cv.redraw(); }),
          ui.chip('Mitochondrial', DNA.mt.color, false, b => { on.mt = b; cv.redraw(); }),
          ui.chip('X-DNA', DNA.x.color, false, b => { on.x = b; cv.redraw(); })),
        ui.range('Generations', 2, Math.min(maxDepth, 24), G, n => { G = n; FO.prefs.set('time.gen', n); if (picked && !FO.kin().anc.min.has(picked)) picked = null; compute(); if (picked && !byP.get(picked)) picked = null; pickNote(); fromKey = key(); cv.redraw(); }),
        more,
        el('span', { class: 'ctl-group' },
          ui.button('▶ Play', () => { rev = 0; animate(Math.min(9000, 1200 + maxG * 420), u => { rev = u; }); }),
          ui.button('Reset zoom', () => d3.select(cv.canvas).transition().duration(500).call(zoom.transform, d3.zoomIdentity)),
          ui.button('Save as SVG', saveSVG)));
      // Save as SVG: draw the whole chart once more (unzoomed, without the pointer's highlight, keeping a clicked
      // ancestor's lines) into an SVG instead of the screen, then save it with its legend and a caption
      function saveSVG() {
        const NS = 'http://www.w3.org/2000/svg', keepZ = zt, keepH = hover;
        zt = d3.zoomIdentity; hover = null;
        const sctx = FO.svgContext();
        try { draw({ ctx: sctx, w: cv.w, h: cv.h, dpr: 1 }); } finally { zt = keepZ; hover = keepH; cv.redraw(); }
        const svgEl = document.createElementNS(NS, 'svg');
        svgEl.setAttribute('width', cv.w); svgEl.setAttribute('height', cv.h);
        svgEl.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden';
        svgEl.append(sctx.svgRoot); document.body.append(svgEl);
        const slug = t => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        FO.saveSVG(svgEl, { title: 'Ancestors Through Time', legend: legendBox, file: 'ancestors-through-time-' + slug(FO.state.home && FO.state.home.name) })
          .finally(() => svgEl.remove());
      }
      zoom = d3.zoom().scaleExtent([1, 16]).on('zoom', e => { zt = e.transform; ui.untip(); hover = null; cv.redraw(); });
      d3.select(cv.canvas).call(zoom).on('dblclick.zoom', null);
      if (home.sex !== 'M') v.controls.querySelector('.chip').title = 'The Y-DNA line only exists for a male home person';
      compute(); cv.redraw();
      return () => { cancelAnimationFrame(raf); cv.destroy(); };
    }
  });
})();
