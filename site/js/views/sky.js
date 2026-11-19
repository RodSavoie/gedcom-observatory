/* Star chart: one star per person, oldest births at the centre. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el, C = FO.C;

  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; }

  /* Positions in a unit disc: radius from birth year, angle inherited from parents so that families hang together. */
  let cache = null;
  FO.skyLayout = function (data) {
    if (cache && cache.data === data) return cache;
    const ppl = data.people.filter(p => p.est != null);
    const y0 = d3.min(ppl, p => p.est), y1 = d3.max(ppl, p => p.est);
    // radius: half linear in time, half equal-area by rank, so crowded centuries get room
    const years = ppl.map(p => p.est).sort((a, b) => a - b);
    const rOf = y => {
      const lin = (y - y0) / Math.max(1, y1 - y0);
      const q = Math.sqrt(d3.bisectLeft(years, y) / years.length);
      return 0.04 + 0.96 * (0.3 * lin + 0.7 * q);
    };
    // every surname gets a slice of the circle in proportion to its size; children follow their father
    const has = q => q && q.est != null;
    const bySurname = d3.rollup(ppl, v => v.length, p => p.surname || '-');
    const names = [...bySurname.keys()].sort((a, b) => a.localeCompare(b));
    const sector = new Map();
    let acc = 0;
    names.forEach(n => { const w = bySurname.get(n) / ppl.length * Math.PI * 2; sector.set(n, [acc, w]); acc += w; });
    const angle = new Map();
    const get = (p, depth) => {
      if (angle.has(p)) return angle.get(p);
      const s = sector.get(p.surname || '-');
      let a;
      const lead = has(p.father) ? p.father : null;
      if (!lead || depth > 80 || (lead.surname || '-') !== (p.surname || '-')) a = s[0] + s[1] * (0.08 + 0.84 * hash(p.id));
      else {
        angle.set(p, 0); // guard against loops in bad data
        const sibs = p.famc ? p.famc.children : [p];
        const spread = Math.min(0.02, s[1] * 0.05);
        a = get(lead, depth + 1) + (sibs.indexOf(p) - (sibs.length - 1) / 2) * spread + (hash(p.id) - .5) * spread;
        a = Math.max(s[0], Math.min(s[0] + s[1], a));
      }
      angle.set(p, a);
      return a;
    };
    const pts = ppl.map(p => {
      const a = get(p, 0) - Math.PI / 2, r = rOf(p.est) + (hash(p.id + 'r') - .5) * 0.012;
      return { p, x: Math.cos(a) * r, y: Math.sin(a) * r, s: 0.9 + Math.sqrt(p.children.length) * 0.34 };
    });
    const labels = names.filter(n => n !== '-' && bySurname.get(n) / ppl.length > 0.0075).map(n => ({ name: n, a: sector.get(n)[0] + sector.get(n)[1] / 2 - Math.PI / 2 }));
    const byPerson = new Map(pts.map(t => [t.p, t]));
    const rings = [];
    const step = (y1 - y0) > 500 ? 100 : 50;
    for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) rings.push({ y, r: rOf(y) });
    cache = { data, pts, byPerson, rings, labels, y0, y1 };
    return cache;
  };

  function lineOf(home, kind) {
    const out = [];
    if (kind === 'father') for (let q = home, i = 0; q && i < 60; q = q.father, i++) out.push(q);
    else if (kind === 'mother') for (let q = home, i = 0; q && i < 60; q = q.mother, i++) out.push(q);
    return out;
  }

  function drawSky(ctx, L, o) {
    // o: {cx, cy, R, k, tx, ty, anc, chosen(Set), chain(array), hover, home, reveal, labels}
    const { cx, cy, R, k } = o;
    ctx.save();
    ctx.translate(o.tx, o.ty); ctx.scale(k, k);
    const X = t => cx + t.x * R, Y = t => cy + t.y * R;
    // year rings
    ctx.lineWidth = 1.6 / k; ctx.strokeStyle = 'rgba(27,38,50,.06)'; ctx.fillStyle = C.ink3;
    ctx.font = (11 / k) + 'px ' + getComputedStyle(document.body).fontFamily;
    L.rings.forEach(r => {
      if (o.reveal != null && r.r > o.reveal) return;
      ctx.beginPath(); ctx.arc(cx, cy, r.r * R, 0, Math.PI * 2); ctx.stroke();
    });
    // parent links: fathers (short, within a surname) then mothers (the marriages that tie surnames together)
    [['father', 'rgba(27,38,50,.09)'], ['mother', 'rgba(43,128,170,.045)']].forEach(([key, col]) => {
      ctx.strokeStyle = col; ctx.lineWidth = 1.3 / k;
      ctx.beginPath();
      for (const t of L.pts) {
      if (o.scope && !o.scope.has(t.p)) continue;
        if (o.reveal != null && Math.hypot(t.x, t.y) > o.reveal) continue;
        const u = t.p[key] && L.byPerson.get(t.p[key]);
        if (u) { ctx.moveTo(X(t), Y(t)); ctx.lineTo(X(u), Y(u)); }
      }
      ctx.stroke();
    });
    // surname labels round the rim
    if (o.rim) {
      ctx.fillStyle = C.ink3; ctx.font = (10.5 / Math.sqrt(k)) + 'px ' + getComputedStyle(document.body).fontFamily;
      L.labels.forEach(l => {
        ctx.save();
        ctx.translate(cx + Math.cos(l.a) * R * 1.035, cy + Math.sin(l.a) * R * 1.035);
        const flip = Math.cos(l.a) < 0;
        ctx.rotate(l.a + (flip ? Math.PI : 0));
        ctx.textAlign = flip ? 'right' : 'left';
        ctx.fillText(l.name, 0, 3 / Math.sqrt(k));
        ctx.restore();
      });
    }
    // stars
    const sc = 1 / Math.sqrt(k);
    for (const t of L.pts) {
      if (o.scope && !o.scope.has(t.p)) continue;
      if (o.reveal != null && Math.hypot(t.x, t.y) > o.reveal) continue;
      const isAnc = o.anc && o.anc.has(t.p);
      const isDesc = !isAnc && o.desc && o.desc.has(t.p);
      ctx.fillStyle = t.p.hidden ? C.frost : isAnc ? '#1B2632' : isDesc ? '#2B80AA' : 'rgba(27,38,50,.42)';
      ctx.beginPath(); ctx.arc(X(t), Y(t), (isAnc ? t.s + .5 : t.s) * sc, 0, Math.PI * 2); ctx.fill();
    }
    // ring years, over the stars so they stay readable
    ctx.font = (11 / k) + 'px ' + getComputedStyle(document.body).fontFamily;
    L.rings.forEach(r => {
      if (o.reveal != null && r.r > o.reveal) return;
      const w = ctx.measureText(r.y).width;
      ctx.fillStyle = 'rgba(238,233,223,.85)'; ctx.fillRect(cx - w / 2 - 3 / k, cy + r.r * R - 7 / k, w + 6 / k, 14 / k);
      ctx.fillStyle = C.ink2; ctx.textAlign = 'center'; ctx.fillText(r.y, cx, cy + r.r * R + 4 / k); ctx.textAlign = 'left';
    });
    // chosen line
    const drawChain = (chain, color, width) => {
      const pts = chain.map(p => L.byPerson.get(p)).filter(Boolean).filter(t => o.reveal == null || Math.hypot(t.x, t.y) <= o.reveal);
      if (pts.length < 1) return;
      ctx.strokeStyle = color; ctx.lineWidth = width / k; ctx.lineJoin = 'round';
      ctx.beginPath(); pts.forEach((t, i) => (i ? ctx.lineTo(X(t), Y(t)) : ctx.moveTo(X(t), Y(t)))); ctx.stroke();
      ctx.fillStyle = color;
      pts.forEach(t => { ctx.beginPath(); ctx.arc(X(t), Y(t), (t.s + 1.4) * sc, 0, Math.PI * 2); ctx.fill(); });
    };
    if (o.allAnc && o.anc) {
      ctx.strokeStyle = 'rgba(163,81,57,.55)'; ctx.lineWidth = 1 / k; ctx.beginPath();
      for (const p of o.anc.keys()) {
        const t = L.byPerson.get(p); if (!t) continue;
        for (const par of [p.father, p.mother]) { const u = par && L.byPerson.get(par); if (u) { ctx.moveTo(X(t), Y(t)); ctx.lineTo(X(u), Y(u)); } }
      }
      ctx.stroke();
      ctx.fillStyle = C.red;
      for (const p of o.anc.keys()) { const t = L.byPerson.get(p); if (t) { ctx.beginPath(); ctx.arc(X(t), Y(t), (t.s + .6) * sc, 0, Math.PI * 2); ctx.fill(); } }
    }
    if (o.feat) { const tf = L.byPerson.get(o.feat); if (tf) { ctx.strokeStyle = '#2B80AA'; ctx.lineWidth = 2 / k; ctx.beginPath(); ctx.arc(X(tf), Y(tf), 8 * sc, 0, Math.PI * 2); ctx.stroke(); } }
    if (o.chain && o.chain.length) drawChain(o.chain, C.red, 2);
    if (o.pick && o.pick.length) drawChain(o.pick, C.teal, 2);
    // home marker and labels
    const label = (t, text, color) => {
      ctx.font = '600 ' + (12.5 / k) + 'px ' + getComputedStyle(document.body).fontFamily;
      const w = ctx.measureText(text).width;
      const lx = X(t) + 9 / k, ly = Y(t) + 4 / k;
      ctx.fillStyle = 'rgba(238,233,223,.88)'; ctx.fillRect(lx - 3 / k, ly - 12 / k, w + 6 / k, 16 / k);
      ctx.fillStyle = color || '#1B2632'; ctx.fillText(text, lx, ly);
    };
    const th = L.byPerson.get(o.home);
    if (th && (o.reveal == null || o.reveal >= 1)) {
      ctx.strokeStyle = C.red; ctx.lineWidth = 1.6 / k;
      ctx.beginPath(); ctx.arc(X(th), Y(th), 7 * sc, 0, Math.PI * 2); ctx.stroke();
      label(th, o.home.name, '#1B2632');
    }
    if (o.labels && k > 3.2) {
      const vx0 = (-o.tx) / k, vy0 = (-o.ty) / k, vx1 = (o.w - o.tx) / k, vy1 = (o.h - o.ty) / k;
      ctx.font = (10.5 / k) + 'px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillStyle = C.ink2;
      let n = 0;
      for (const t of L.pts) {
      if (o.scope && !o.scope.has(t.p)) continue;
        const x = X(t), y = Y(t);
        if (x < vx0 || x > vx1 || y < vy0 || y > vy1 || t.p.hidden) continue;
        if (k < 7 && !(o.anc && o.anc.has(t.p))) continue;
        ctx.fillText(t.p.name, x + 5 / k, y + 3 / k);
        if (++n > 260) break;
      }
    }
    if (o.hover) {
      const t = L.byPerson.get(o.hover);
      if (t) { ctx.strokeStyle = C.teal; ctx.lineWidth = 2 / k; ctx.beginPath(); ctx.arc(X(t), Y(t), (t.s + 5) * sc, 0, Math.PI * 2); ctx.stroke(); }
    }
    ctx.restore();
  }

  /* hero: static chart with one outward reveal */
  FO.heroSky = function (box) {
    const s = FO.state, L = FO.skyLayout(s.data), anc = FO.kin().anc.min;
    const chain = lineOf(s.home, 'father');
    let reveal = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 0, raf = 0, start = 0;
    const cv = ui.canvas(box, api => {
      api.ctx.clearRect(0, 0, api.w, api.h);
      const R = Math.min(api.w, api.h) * 0.49;
      drawSky(api.ctx, L, { cx: api.w * .5, cy: api.h * .5, R, k: 1, tx: 0, ty: 0, anc, chain, home: s.home, reveal: reveal >= 1 ? null : reveal, w: api.w, h: api.h });
    });
    const oldest = chain[chain.length - 1];
    if (chain.length > 2 && oldest && !oldest.hidden) {
      box.append(el('div', { class: 'tag' }, el('i'), el('div', {}, el('b', { text: (chain.length - 1) + ' fathers back' }), 'The red line runs from ' + s.home.name.split(' ')[0] + ' to ' + oldest.name + (oldest.by ? ', born ' + (oldest.b.date.q ? 'about ' : '') + oldest.by : '') + '.')));
    }
    const tick = t => {
      if (!start) start = t;
      reveal = Math.min(1, (t - start) / 1700);
      reveal = 1 - Math.pow(1 - reveal, 2.2);
      cv.redraw();
      if (reveal < 1) raf = requestAnimationFrame(tick);
    };
    if (reveal < 1) raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); cv.destroy(); };
  };

  FO.view({
    id: 'sky', order: 1, title: 'Star Chart',
    card: 'One star for every person, with the oldest births at the centre.',
    how: {"see": "Everyone in the file as a star. Distance from the centre is birth year: the earliest births sit in the middle and the latest at the rim. Surnames run clockwise in alphabetical order and children sit beside their father, so each family name fans outward as its own spray.", "marks": ["Black stars are the home person’s direct ancestors. The home person wears a red ring.", "The red line is the line you chose with the Red line buttons: fathers, mothers, or every ancestor.", "Blue stars are recorded descendants of the featured ancestor, who wears a blue ring. To begin with it is the named ancestor with the most recorded descendants in the file; choose another, or nobody, from the list above the chart.", "A bigger star has more recorded children. Pale stars are people who may be living, never named. Dark lines join a child to a father, faint blue ones to a mother, and faint rings mark years."], "can": ["Point at a star for a short card; click it to open that person and trace their line.", "Scroll, or use the + and − buttons, to zoom; drag to move. Names appear as you zoom in.", "Use Find to fly to one person, and Reset zoom to come back."], "care": "Only people whose birth year is recorded, or can be estimated from a parent, partner or child, appear. An estimated year makes that star’s distance from the centre approximate."},
    blurb: s => 'Each dot is a person. The centre is the earliest birth in the file and every ring outward is later. Surnames run clockwise in alphabetical order, so each family name forms its own spray of stars. Black stars are direct ancestors of ' + s.home.name + '.',
    icon: '<circle cx="32" cy="32" r="26" stroke="#C9C1B1"/><circle cx="32" cy="32" r="15" stroke="#C9C1B1"/><path d="M32 32 L40 22 L47 14 L55 12" stroke="#A35139" stroke-width="1.8"/><g fill="#1B2632" stroke="none"><circle cx="32" cy="32" r="1.6"/><circle cx="22" cy="26" r="1.3"/><circle cx="26" cy="42" r="1.3"/><circle cx="44" cy="40" r="1.6"/><circle cx="14" cy="38" r="1.2"/><circle cx="20" cy="14" r="1.3"/><circle cx="38" cy="52" r="1.3"/><circle cx="52" cy="30" r="1.3"/><circle cx="12" cy="24" r="1.1"/><circle cx="48" cy="50" r="1.2"/></g><g fill="#A35139" stroke="none"><circle cx="40" cy="22" r="2"/><circle cx="47" cy="14" r="2"/><circle cx="55" cy="12" r="2.2"/></g>',
    render(v) {
      const s = v.state, L = FO.skyLayout(v.data), kin = FO.kin();
      let mode = 'father', hover = null, pick = [];
      const scope = FO.scope();
      const feat = s.noFeatured || scope ? null : FO.featured(), fdesc = feat ? FO.descent(feat).min : null;
      let T = d3.zoomIdentity;
      const draw = api => {
        api.ctx.clearRect(0, 0, api.w, api.h);
        const R = Math.min(api.w, api.h) * 0.4;
        drawSky(api.ctx, L, { rim: true, cx: api.w / 2, cy: api.h / 2, R, k: T.k, tx: T.x, ty: T.y, anc: kin.anc.min, chain: mode === 'father' || mode === 'mother' ? lineOf(s.home, mode) : null, allAnc: mode === 'all', home: s.home, hover, pick, desc: fdesc, feat, scope, labels: true, w: api.w, h: api.h });
      };
      const cv = ui.canvas(v.stage, draw);
      const zoom = d3.zoom().scaleExtent([0.8, 40]).on('zoom', e => { T = e.transform; cv.redraw(); });
      const sel = d3.select(cv.canvas).call(zoom).on('dblclick.zoom', null);
      const nearest = e => {
        const r = cv.canvas.getBoundingClientRect();
        const R = Math.min(cv.w, cv.h) * 0.4;
        const x = ((e.clientX - r.left - T.x) / T.k - cv.w / 2) / R, y = ((e.clientY - r.top - T.y) / T.k - cv.h / 2) / R;
        const lim = 9 / (R * T.k);
        let best = null, bd = lim * lim;
        for (const t of L.pts) { if (scope && !scope.has(t.p)) continue; const d = (t.x - x) * (t.x - x) + (t.y - y) * (t.y - y); if (d < bd) { bd = d; best = t; } }
        return best;
      };
      cv.canvas.addEventListener('mousemove', e => {
        const t = nearest(e);
        const p = t ? t.p : null;
        if (p !== hover) { hover = p; cv.redraw(); }
        cv.canvas.style.cursor = p ? 'pointer' : 'grab';
        if (p) ui.tip(ui.personTip(p, FO.KIN_LABEL[kin.cls.get(p)]), e.clientX, e.clientY); else ui.untip();
      });
      cv.canvas.addEventListener('mouseleave', () => { hover = null; ui.untip(); cv.redraw(); });
      cv.canvas.addEventListener('click', e => {
        const t = nearest(e);
        if (!t) return;
        // if the person is an ancestor, trace the shortest line of descent to the home person
        pick = [];
        const r = FO.bloodRelations(s.home, t.p, 1)[0];
        if (r && r.direct) pick = r.da === 0 ? r.pathB : r.pathA;
        else pick = [t.p];
        cv.redraw();
        FO.select(t.p);
      });
      // whose descendants are the blue stars: by default the named ancestor with the most recorded descendants
      const fl = FO.founders().slice();
      if (feat && !fl.some(f => f.p === feat)) fl.unshift({ p: feat, n: FO.descent(feat).min.size - 1 });
      v.controls.append(ui.scopeSeg());
      if (!scope && fl.length) v.controls.append(ui.select('Blue stars: descendants of', [{ v: 'none', label: 'Nobody' }].concat(fl.map((f, k) => ({ v: k, label: f.p.name + ' (' + ui.fmt(f.n) + ')' }))), feat ? fl.findIndex(f => f.p === feat) : 'none', k => { if (k === 'none') { s.noFeatured = true; } else { s.noFeatured = false; s.founder = fl[+k].p; } FO.render(); }));
      v.controls.append(
        el('span', { class: 'ctl' }, el('span', { text: 'Red line' }), ui.seg([{ v: 'father', label: 'Fathers' }, { v: 'mother', label: 'Mothers' }, { v: 'all', label: 'All ancestors' }, { v: 'off', label: 'Off' }], mode, m => { mode = m; cv.redraw(); })),
        ui.picker('Find', null, p => {
          const t = L.byPerson.get(p);
          if (!t) { ui.toast(p.name + ' has no usable date, so they are not on the chart.'); return; }
          const R = Math.min(cv.w, cv.h) * 0.4, k = 9;
          sel.transition().duration(900).call(zoom.transform, d3.zoomIdentity.translate(cv.w / 2 - (cv.w / 2 + t.x * R) * k, cv.h / 2 - (cv.h / 2 + t.y * R) * k).scale(k));
          pick = [p]; hover = p; FO.select(p);
        }, 'Find someone…'),
        el('span', { class: 'ctl-group' },
          ui.button('Reset zoom', () => sel.transition().duration(600).call(zoom.transform, d3.zoomIdentity)),
          ui.button('Save as SVG', () => FO.saveCanvasSVG(draw, cv, { title: 'Star Chart', legend: skyLegend, view: true }))));
      const skyLegend = FO.legend(v.stage, null, [{ label: 'Direct ancestor', color: '#1B2632' }, feat ? { label: 'Descendants of ' + feat.name + ', who wears a blue ring', color: '#2B80AA' } : null, scope ? null : { label: 'Everyone else', color: 'rgba(27,38,50,.42)' }, { label: 'The line you chose', color: C.red, line: true }, { label: 'A person you clicked', color: C.teal, line: true }].filter(Boolean));
      v.stage.append(el('div', { class: 'zoombtns' }, el('button', { class: 'btn', 'aria-label': 'Zoom in', text: '+', onclick: () => sel.transition().duration(250).call(zoom.scaleBy, 1.6) }), el('button', { class: 'btn', 'aria-label': 'Zoom out', text: '−', onclick: () => sel.transition().duration(250).call(zoom.scaleBy, 1 / 1.6) })));
      v.stage.append(el('div', { class: 'hint', text: 'Scroll to zoom, drag to move, point at a star to see who it is. Names appear as you zoom in.' }));
      return () => { cv.destroy(); };
    }
  });
})();
