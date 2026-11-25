/* By the numbers: summary charts. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el, svg = ui.svg, C = FO.C;
  const T = FO.T;
  const TEAL = '#2B80AA', BLUE = '#5450A8', PINK = '#C9628E';

  FO.view({
    id: 'numbers', order: 9, title: T('By the Numbers'),
    card: T('Births by decade, lifespans, family sizes and the names that keep returning.'),
    how: {"see": T("The whole file counted up in small charts: births, birthplaces, lifespans, family size, marriage ages and names. Totals run across the top."), "marks": [T("Each bar or wedge is a count of people or families. Point at it for the exact figure."), T("In the births chart, colours show where people were born; where the colours change from left to right, the family was on the move."), T("Marriage ages are drawn as two lines, one for women and one for men.")], "can": [T("Point at any bar, wedge or name for its figure."), T("Click a bar in the births or birthplace charts to list the people behind it.")], "care": T("Every number counts what is recorded. Recent decades look thin because living people are left out, and early ones because fewer records survive.")},
    blurb: T('The whole family counted up: when and where people were born, how long they lived, how big families were, and what they were named. Point at any bar, wedge or name for its exact figure.'),
    icon: '<path d="M8 54 H58"/><rect x="12" y="34" width="8" height="20" fill="#1B2632"/><rect x="24" y="22" width="8" height="32" fill="#1B2632"/><rect x="36" y="12" width="8" height="42" fill="#A35139" stroke="#A35139"/><rect x="48" y="28" width="8" height="26" fill="#1B2632"/>',
    render(v) {
      const data = FO.scoped(v.data);
      v.controls.append(ui.scopeSeg());
      v.stage.classList.add('scroll');
      const sheet = el('div', { class: 'sheet' });
      v.stage.append(sheet);
      const ppl = data.people.filter(p => !p.hidden);
      const born = ppl.filter(p => p.by != null);
      const lived = ppl.filter(p => p.by != null && p.dy != null && p.dy >= p.by && p.dy - p.by <= 115);
      const adults = lived.filter(p => p.dy - p.by >= 16);
      const fams = data.families.filter(f => f.husb || f.wife);
      // families marked partial hold only the children who reached the tree another way (see wikitree.js): left out of family sizes
      const withKids = fams.filter(f => f.children.length && !f.partial);
      const partial = fams.filter(f => f.children.length && f.partial).length;
      const partialNote = partial ? T(' {partial} families where only some of the children were fetched are left out.', { partial: ui.fmt(partial) }) : '';

      const tile = (big, label, note) => el('div', {}, el('b', { class: 'num', text: big }), el('span', { text: label }), note ? el('small', { text: note }) : null);
      const yrs = [].concat(born.map(p => p.by), ppl.filter(p => p.dy != null).map(p => p.dy));
      const grown = lived.filter(p => p.dy - p.by >= 18);
      const placed = ppl.filter(p => p.b && p.b.place).length;
      sheet.append(el('div', { class: 'statrow' },
        tile(ui.fmt(data.people.length), data.scoped ? T('direct ancestors, with the home person') : T('people in the tree'), T('{length} have a birth year the charts can use', { length: ui.fmt(born.length) })),
        tile(ui.fmt(data.families.length), data.scoped ? T('ancestor couples') : T('families'), data.scoped ? T('couples where both partners are direct ancestors') : T('a couple, or one parent, recorded with any children')),
        tile(yrs.length ? T('{x} years', { x: ui.fmt(d3.max(yrs) - d3.min(yrs)) }) : '-', T('span of time covered'), yrs.length ? T('earliest recorded year {yrs}, latest {yrs2}', { yrs: d3.min(yrs), yrs2: d3.max(yrs) }) : ''),
        tile(grown.length ? T('{median} years', { median: Math.round(d3.median(grown, p => p.dy - p.by)) }) : '-', T('typical age at death for adults'), T('the middle value for {length} people with both years who reached 18', { length: ui.fmt(grown.length) })),
        tile(ppl.length ? Math.round(placed / ppl.length * 100) + '%' : '-', T('have a recorded birthplace'), T('{placed} of the {length} people who are no longer living', { placed: ui.fmt(placed), length: ui.fmt(ppl.length) })),
        tile(ui.fmt(new Set(ppl.map(p => p.surname && FO.surnameKey(p.surname)).filter(Boolean)).size), T('surnames'), T('spellings that differ only by accents, spaces or apostrophes count once')),
        tile(ui.fmt(data.people.length - ppl.length), T('living relatives left out'), T('their names, dates and places are not shown or counted'))));

      const grid = el('div', { class: 'grid2' });
      sheet.append(grid);

      // births by decade, split by birthplace
      if (born.length) {
        const d0 = Math.floor(d3.min(born, p => p.by) / 10) * 10, d1 = Math.floor(d3.max(born, p => p.by) / 10) * 10;
        const span = (d1 - d0) / 10 + 1, step = span > 70 ? 20 : 10;
        const cat = FO.topCategories(born, p => FO.region(p.b && p.b.place));
        const keys = cat.legend.map(l => l.key || l.label);   // key: the region as written; label: in the reader's language
        const keyOf = p => { const r = FO.region(p.b && p.b.place); return keys.includes(r) ? r : T('Other or unknown'); };
        const bins = d3.group(born, p => Math.floor(p.by / step) * step);
        const rows = [];
        for (let d = Math.floor(d0 / step) * step; d <= d1; d += step) {
          const people = bins.get(d) || [];
          const c = d3.rollup(people, x => x.length, keyOf);
          rows.push({ label: String(d), tip: d + '-' + (d + step - 1), people, parts: cat.legend.map(l => ({ key: l.label, value: c.get(l.key || l.label) || 0, color: l.color })) });
        }
        const fig = FO.figure(T('Births by {x}, coloured by birthplace', { x: step === 10 ? T('decade') : T('twenty years') }), T('Where the colours change from left to right, the family was on the move. {length} people with a birth year.', { length: ui.fmt(born.length) }), FO.stacked(rows, { unit: T('births'), onClick: d => FO.showList(T('Born {tip}', { tip: d.tip }), T('{length} people', { length: d.people.length }), d.people.slice().sort((a, b) => a.by - b.by)) }));
        fig.append(FO.key(cat.legend));
        grid.append(fig);
      }
      // birthplaces
      const byReg = d3.rollup(ppl.filter(p => p.b && p.b.place), x => x, p => FO.region(p.b.place));
      const regs = [...byReg.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 10).map(([k, x]) => ({ label: T(k), value: x.length, people: x }));
      if (regs.length) grid.append(FO.figure(T('Where they were born'), T('The ten most common regions, as written in the file'), FO.bars(regs, { unit: T('people'), onClick: d => FO.showList(T('Born in {label}', { label: d.label }), T('{value} people', { value: d.value }), d.people.slice().sort((a, b) => (a.est || 0) - (b.est || 0))) })));

      // age at death
      if (lived.length > 5) {
        const bins = d3.range(0, 110, 10).map(a => ({ label: a + (a === 100 ? '+' : ''), tip: a === 100 ? T('100 and over') : T('Aged {a} to {b}', { a: a, b: a + 9 }), value: 0 }));
        lived.forEach(p => bins[Math.min(10, Math.floor((p.dy - p.by) / 10))].value++);
        grid.append(FO.figure(T('Age at death'), T('{length} people with both a birth and a death year', { length: ui.fmt(lived.length) }), FO.columns(bins, { unit: T('people'), every: 1 })));
      }
      // children who died young, and children per family, by era
      if (lived.length > 30) {
        const era = p => Math.floor(p.by / 50) * 50;
        const g5 = d3.rollup(lived, x => ({ n: x.length, young: x.filter(p => p.dy - p.by < 5).length }), era);
        const rows5 = [...g5.keys()].sort((a, b) => a - b).filter(k => g5.get(k).n >= 10).map(k => ({ label: String(k), tip: T('Born {k}-{end}: {young} of {n}', { k: k, end: k + 49, young: g5.get(k).young, n: g5.get(k).n }), value: Math.round(g5.get(k).young / g5.get(k).n * 100) }));
        if (rows5.length > 1) grid.append(FO.figure(T('Died before the age of five'), T('Share of people with both dates, by half-century of birth. A low estimate: child deaths often went unrecorded.'), FO.columns(rows5, { unit: '%', every: 1, color: '#C9628E' })));
      }
      const famEra = withKids.map(f => ({ f, y: d3.min(f.children, c => c.by) })).filter(d => d.y != null);
      if (famEra.length > 20) {
        const g = d3.rollup(famEra, x => ({ n: x.length, avg: d3.mean(x, d => d.f.children.length) }), d => Math.floor(d.y / 50) * 50);
        const rowsF = [...g.keys()].sort((a, b) => a - b).filter(k => g.get(k).n >= 5).map(k => ({ label: String(k), tip: T('First child born {k}-{end} ({n} families)', { k: k, end: k + 49, n: g.get(k).n }), value: Math.round(g.get(k).avg * 10) / 10 }));
        if (rowsF.length > 1) grid.append(FO.figure(T('Children per family, by era'), T('Average recorded children, by the half-century the first child was born. Recent families look small because trees often leave out living children.{partialNote}', { partialNote: partialNote }), FO.columns(rowsF, { unit: T('children on average'), every: 1, color: '#588C46' })));
      }
      // how long people lived, decade by decade of birth
      {
        const past5 = lived.filter(p => p.dy - p.by >= 5);
        const g = d3.rollup(past5, x => ({ n: x.length, avg: d3.mean(x, p => p.dy - p.by) }), p => Math.floor(p.by / 10) * 10);
        const pts = [...g.keys()].sort((a, b) => a - b).filter(k => g.get(k).n >= 3).map(k => ({ x: k, y: g.get(k).avg, n: g.get(k).n }));
        if (pts.length > 3) grid.append(FO.figure(T('How long people lived, decade by decade'), T('Average age at death by decade of birth, for people who lived past five. A hollow dot is fewer than ten people. A drop at the right is not real: people born recently appear only if they have already died.'), FO.lines([{ name: T('Age'), color: TEAL, points: pts }], { suffix: '', step: 10 })));
      }
      // age at first marriage, decade by decade of the wedding
      {
        const rowsM = { M: new Map(), F: new Map() };
        ppl.forEach(p => {
          if (p.by == null || !(p.sex in rowsM)) return;
          const ys = p.fams.map(f => f.my).filter(y => y != null); if (!ys.length) return;
          const y0 = Math.min(...ys), a = y0 - p.by; if (a < 12 || a > 70) return;
          const k = Math.floor(y0 / 10) * 10, m = rowsM[p.sex]; if (!m.has(k)) m.set(k, []); m.get(k).push(a);
        });
        const mk = m => [...m.keys()].sort((a, b) => a - b).filter(k => m.get(k).length >= 3).map(k => ({ x: k, y: d3.mean(m.get(k)), n: m.get(k).length }));
        const pm = mk(rowsM.M), pf = mk(rowsM.F);
        if (pm.length + pf.length > 6) grid.append(FO.figure(T('Age at first marriage, decade by decade'), T('Average age at a person’s first recorded marriage, by decade of the wedding. The gap between the lines is the usual age difference between husbands and wives.'), FO.lines([{ name: T('Men'), color: BLUE, points: pm }, { name: T('Women'), color: PINK, points: pf }], { yMin: 14, step: 10, unit: T('weddings') })));
      }
      // birth months
      const withMonth = ppl.filter(p => p.b && p.b.date && p.b.date.m && !p.b.date.q);
      if (withMonth.length >= 30) {
        const cnt = d3.range(12).map(() => 0); withMonth.forEach(p => cnt[p.b.date.m - 1]++);
        const MN = [T('Jan'), T('Feb'), T('Mar'), T('Apr'), T('May'), T('Jun'), T('Jul'), T('Aug'), T('Sep'), T('Oct'), T('Nov'), T('Dec')];
        const W = 560, H = 250, cx = W / 2, cy = H / 2, r0 = 26, even = withMonth.length / 12, rr = d3.scaleLinear().domain([0, Math.max(...cnt)]).range([r0, 104]);
        const sv = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
        cnt.forEach((n, i) => {
          const a0 = i / 12 * Math.PI * 2 + .03, a1 = (i + 1) / 12 * Math.PI * 2 - .03, mid = (a0 + a1) / 2;
          const w = svg('path', { d: d3.arc()({ innerRadius: r0, outerRadius: rr(n), startAngle: a0, endAngle: a1, cornerRadius: 3 }), transform: `translate(${cx},${cy})`, fill: '#2B80AA' });
          w.addEventListener('mousemove', e => ui.tip(T('<b>{x}</b><span>{n} births, {x2}{x3}% against an even spread</span>', { x: MN[i], n: ui.fmt(n), x2: n / even * 100 - 100 >= 0 ? '+' : '', x3: Math.round(n / even * 100 - 100) }), e.clientX, e.clientY));
          w.addEventListener('mouseleave', ui.untip);
          sv.append(w);
          const t = svg('text', { x: cx + Math.sin(mid) * 118, y: cy - Math.cos(mid) * 118 + 4, 'text-anchor': 'middle' }); t.textContent = MN[i]; sv.append(t);
        });
        sv.append(svg('circle', { cx, cy, r: rr(even), fill: 'none', stroke: '#1B2632', 'stroke-dasharray': '3 4', 'stroke-width': 1, 'pointer-events': 'none' }));
        grid.append(FO.figure(T('Month of birth'), T('{length} births with a recorded month. A longer wedge means more births; the dashed ring is an even spread.', { length: ui.fmt(withMonth.length) }), sv));
      }
      // family size
      if (withKids.length) {
        const cap = 15, bins = d3.range(1, cap + 1).map(n => ({ label: n === cap ? cap + '+' : String(n), tip: n === cap ? T('{cap} or more children', { cap: cap }) : n + (n === 1 ? T(' child') : T(' children')), value: 0 }));
        withKids.forEach(f => bins[Math.min(cap, f.children.length) - 1].value++);
        grid.append(FO.figure(T('Family size'), T('Recorded children per couple ({length} couples with children).{partialNote}', { length: ui.fmt(withKids.length), partialNote: partialNote }), FO.columns(bins, { unit: T('families'), every: 1 })));
      }
      // age at first marriage
      const ages = { M: [], F: [] };
      ppl.forEach(p => {
        if (p.by == null || !(p.sex in ages)) return;
        const ys = p.fams.map(f => f.my).filter(y => y != null);
        if (!ys.length) return;
        const a = Math.min(...ys) - p.by;
        if (a >= 12 && a <= 70) ages[p.sex].push(a);
      });
      if (ages.M.length + ages.F.length > 10) {
        const W = 560, H = 210, m = { l: 38, r: 8, t: 10, b: 24 };
        const lo = 12, hi = 52;
        const hist = arr => d3.range(lo, hi, 2).map(a => arr.filter(x => x >= a && x < a + 2 || (a === hi - 2 && x >= hi)).length);
        const hm = hist(ages.M), hf = hist(ages.F);
        const x = d3.scaleLinear().domain([lo, hi]).range([m.l, W - m.r]), y = d3.scaleLinear().domain([0, Math.max(...hm, ...hf, 1)]).nice(4).range([H - m.b, m.t]);
        const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
        y.ticks(4).forEach(t => { s.append(svg('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), stroke: C.soft })); const tx = svg('text', { x: m.l - 6, y: y(t) + 3.5, 'text-anchor': 'end' }); tx.textContent = t; s.append(tx); });
        d3.range(lo, hi + 1, 4).forEach(a => { const tx = svg('text', { x: x(a), y: H - 8, 'text-anchor': 'middle' }); tx.textContent = a; s.append(tx); });
        const line = d3.line().x((d, i) => x(lo + i * 2 + 1)).y(d => y(d)).curve(d3.curveMonotoneX);
        [[hf, PINK, T('Women')], [hm, BLUE, T('Men')]].forEach(([h, col, name]) => {
          s.append(svg('path', { d: line(h), fill: 'none', stroke: col, 'stroke-width': 2 }));
          const pk = h.indexOf(Math.max(...h));
          const tx = svg('text', { x: x(lo + pk * 2 + 1) + (name === T('Men') ? 10 : -10), y: y(h[pk]) - 6 + (name === T('Men') ? 14 : 0), 'text-anchor': name === T('Men') ? 'start' : 'end', style: 'font-size:12px;fill:#1B2632;font-weight:600' }); tx.textContent = name; s.append(tx);
          s.append(svg('circle', { cx: x(lo + pk * 2 + 1), cy: y(h[pk]), r: 4, fill: col, stroke: '#F7F4EE', 'stroke-width': 2 }));
        });
        s.append(svg('line', { x1: m.l, x2: W - m.r, y1: y(0), y2: y(0), stroke: C.ink3 }));
        const hit = svg('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' });
        hit.addEventListener('mousemove', e => { const r = hit.getBoundingClientRect(); const i = Math.max(0, Math.min(hm.length - 1, Math.floor((e.clientX - r.left) / r.width * hm.length))); ui.tip(T('<b>Married at {a}-{b}{later}</b><span>Women: {women}<br>Men: {men}</span>', { a: lo + i * 2, b: lo + i * 2 + 1, later: i === hm.length - 1 ? T(' or later') : '', women: hf[i], men: hm[i] }), e.clientX, e.clientY); });
        hit.addEventListener('mouseleave', ui.untip);
        s.append(hit);
        grid.append(FO.figure(T('Age at first marriage'), T('Women (median {x}) and men (median {x2}), in two-year steps', { x: Math.round(d3.median(ages.F) || 0), x2: Math.round(d3.median(ages.M) || 0) }), s));
      }
      // names
      const top = (arr, key, n) => [...d3.rollup(arr, x => x.length, key).entries()].filter(d => d[0]).sort((a, b) => b[1] - a[1]).slice(0, n).map(([label, value]) => ({ label, value }));
      // first names are counted as the whole given name, so compound names stay together; hyphens were seldom written,
      // so a space and a hyphen count the same (Jean Baptiste = Jean-Baptiste), and so do accents (Josèphe = Josephe).
      // Each name is shown in its commonest spelling in the file.
      const fullGiven = p => (p.given || '').split(/\s+/).map(w => w.replace(/[^\p{L}'-]/gu, '')).filter(Boolean).join(' ');
      const nameKey = n => FO.norm(n).replace(/[\s-]+/g, ' ');
      const spell = new Map();
      ppl.forEach(p => { const n = fullGiven(p); if (!n) return; const k = nameKey(n), m = spell.get(k) || new Map(); m.set(n, (m.get(n) || 0) + 1); spell.set(k, m); });
      const shown = new Map([...spell].map(([k, m]) => [k, [...m].sort((a, b) => b[1] - a[1])[0][0]]));
      const firstName = p => { const n = fullGiven(p); return n ? shown.get(nameKey(n)) : ''; };
      const skip = p => /^(unknown|living|inconnue?|n|private)$/i.test(firstName(p)) ? '' : firstName(p);
      grid.append(FO.figure(T('Most common surnames'), T('Counting everyone who carries the name; spellings such as LeBlanc and Le Blanc count as one'), FO.bars(top(ppl, FO.surnameCanon(ppl), 15), { unit: T('people'), labelWidth: 130 })));
      // first names by era
      const namedBorn = born.filter(p => skip(p));
      if (namedBorn.length >= 40) {
        const ys = namedBorn.map(p => p.by).sort((a, b) => a - b);
        const cuts = [0, .2, .4, .6, .8, 1].map(q => ys[Math.min(ys.length - 1, Math.floor(q * (ys.length - 1)))]).map((y, i, arr) => (i === 0 || i === arr.length - 1 ? y : Math.round(y / 10) * 10));
        const box = el('div', { class: 'eras' });
        for (let i = 0; i < 5; i++) {
          const lo = cuts[i], hi = cuts[i + 1];
          if (hi <= lo) continue;
          const inEra = namedBorn.filter(p => p.by >= lo && (i === 4 ? p.by <= hi : p.by < hi));
          const row = el('div', { class: 'chiprow' });
          [['M', BLUE], ['F', PINK]].forEach(([sx, colr]) => top(inEra.filter(p => p.sex === sx), skip, 4).forEach(d => row.append(el('span', { class: 'namechip', style: { borderColor: colr }, title: T('{value} {x} born in these years', { value: d.value, x: sx === 'M' ? T('men') : T('women') }) }, d.label, el('small', { text: d.value })))));
          box.append(el('b', { text: lo + '-' + (i === 4 ? hi : hi - 1) }), row);
        }
        grid.append(FO.figure(T('First names through the eras'), T('The four most common first names for men (blue outline) and women (pink outline) in each era, with how many carried each, counting the whole given name (Jean Baptiste and Jean-Baptiste are one name). Eras are fitted so each holds about a fifth of the tree.'), box));
      }
      // record holders
      {
        const recs = [];
        const add = (label, p, note) => { if (p) recs.push(el('li', {}, el('span', {}, el('small', { text: label + '  ', style: { whiteSpace: 'normal' } }), ui.plink(p)), el('small', { text: note }))); };
        const longest = d3.greatest(lived, p => p.dy - p.by);
        if (longest) add(T('Longest recorded life'), longest, T('{n} years', { n: longest.dy - longest.by }));
        const bigFam = d3.greatest(withKids, f => f.children.length);
        if (bigFam) add(T('Largest family'), bigFam.husb && !bigFam.husb.hidden ? bigFam.husb : bigFam.wife, bigFam.husb && bigFam.wife && !bigFam.wife.hidden && !bigFam.husb.hidden ? T('{n} children with {wife}', { n: bigFam.children.length, wife: bigFam.wife.name }) : T('{n} children', { n: bigFam.children.length }));
        const mostKids = d3.greatest(ppl, p => p.children.length);
        if (mostKids && mostKids.fams.length > 1) add(T('Most children overall'), mostKids, T('{n} children, {k} partners', { n: mostKids.children.length, k: mostKids.fams.length }));
        const mostMarr = d3.greatest(ppl, p => p.fams.length);
        if (mostMarr && mostMarr.fams.length > 2) add(T('Most marriages'), mostMarr, T('{k} partners recorded', { k: mostMarr.fams.length }));
        const earliest = d3.least(born, p => p.by);
        if (earliest) add(T('Earliest recorded birth'), earliest, earliest.b.date.text);
        let om = null, of = null;
        ppl.forEach(c => { if (c.by == null) return; const m = c.mother, f = c.father;
          if (m && !m.hidden && m.by != null && c.by - m.by <= 52 && (!om || c.by - m.by > om[1])) om = [m, c.by - m.by, c];
          if (f && !f.hidden && f.by != null && c.by - f.by <= 76 && (!of || c.by - f.by > of[1])) of = [f, c.by - f.by, c]; });
        if (om) add(T('Oldest mother at a birth'), om[0], T('about {age} when {child} was born', { age: om[1], child: om[2].name, _sex: om[2].sex }));
        if (of) add(T('Oldest father at a birth'), of[0], T('about {age} when {child} was born', { age: of[1], child: of[2].name, _sex: of[2].sex }));
        const f0 = FO.founders()[0];
        if (f0) add(T('Most recorded descendants'), f0.p, T('{n} (among the home person’s ancestors)', { n: ui.fmt(f0.n) }));
        if (recs.length) { const ul = el('ul', { class: 'plist' }); recs.forEach(r => ul.append(r)); grid.append(FO.figure(T('Record holders'), T('As recorded in the file. Click a name for details.'), ul)); }
      }
      const NAMES_NOTE = T('The 20 most common, counting the whole given name: Jean Baptiste and Jean-Baptiste are one name, and Jean on its own is another.');
      grid.append(FO.figure(T('Most common first names, women'), NAMES_NOTE, FO.bars(top(ppl.filter(p => p.sex === 'F'), skip, 20), { unit: T('women'), color: PINK, labelWidth: 130 })));
      grid.append(FO.figure(T('Most common first names, men'), NAMES_NOTE, FO.bars(top(ppl.filter(p => p.sex === 'M'), skip, 20), { unit: T('men'), color: BLUE, labelWidth: 130 })));
      return () => {};
    }
  });
})();
