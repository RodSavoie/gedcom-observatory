/* How are we related? */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el, svg = ui.svg, C = FO.C;
  const T = FO.T;

  function diagram(rel, a, b) {
    const BW = 210, BH = 42, GY = 18, GX = 60;
    const top = rel.via;
    let left, right;
    if (rel.direct) {
      const chain = (rel.da === 0 ? rel.pathB : rel.pathA).slice().reverse(); // ancestor first
      left = chain.slice(1); right = [];
    } else {
      left = rel.pathA.slice(0, -1).reverse(); right = rel.pathB.slice(0, -1).reverse();
    }
    const rows = Math.max(left.length, right.length);
    const W = right.length ? BW * 2 + GX : BW, H = (rows + 1) * (BH + GY);
    // a few pixels of margin all round, so the boxes' borders, corners and shadows are never cut off at the edge
    const s = svg('svg', { viewBox: `-5 -5 ${W + 10} ${H + 10}`, style: `max-width:${W + 10}px;width:100%;height:auto;display:block;overflow:visible` });
    const box = (p, x, y, strong, people) => {
      const g = svg('g', { transform: `translate(${x},${y})`, class: 'hbox', style: 'cursor:pointer' });
      g.append(svg('rect', { width: people ? W : BW, height: BH, rx: 4, fill: strong ? '#1B2632' : '#fff', stroke: '#1B2632', 'stroke-opacity': strong ? 1 : .5, 'stroke-width': strong ? 1 : 2 }));
      const label = people ? people.map(q => q.name).join(T('  and  ')) : p.name;
      const maxc = people ? Math.floor(W / 7.4) : 27;
      const t1 = svg('text', { x: (people ? W : BW) / 2, y: p && FO.lifespan(p) && !people ? 18 : 26, 'text-anchor': 'middle', style: `font-size:13px;font-weight:600;fill:${strong ? '#fff' : '#1B2632'};font-family:inherit` });
      t1.textContent = label.length > maxc ? label.slice(0, maxc - 1) + '…' : label;
      g.append(t1);
      if (!people && FO.lifespan(p)) { const t2 = svg('text', { x: BW / 2, y: 33, 'text-anchor': 'middle', style: `font-size:11px;fill:${strong ? '#D8DDE3' : C.ink3};font-family:inherit` }); t2.textContent = FO.lifespan(p); g.append(t2); }
      g.addEventListener('click', () => FO.select(people ? people[0] : p));
      s.append(g);
    };
    const line = (x1, y1, x2, y2) => s.append(svg('path', { d: `M${x1},${y1}V${(y1 + y2) / 2}H${x2}V${y2}`, fill: 'none', stroke: '#1B2632', 'stroke-opacity': .35, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    // top
    if (top.length > 1 || right.length) box(null, 0, 0, false, top); else box(top[0], 0, 0, top[0] === a || top[0] === b);
    const colX = [0, BW + GX];
    [left, right].forEach((col, ci) => {
      col.forEach((p, i) => {
        const y = (i + 1) * (BH + GY);
        const cx = colX[ci] + BW / 2;
        line(i === 0 ? (right.length ? (ci ? W * .75 : W * .25) : BW / 2) : cx, y - GY, cx, y);
        box(p, colX[ci], y, p === a || p === b);
      });
    });
    return s;
  }

  FO.view({
    id: 'related', order: 7, title: T('How Are We Related?'),
    card: T('Pick any two people and read their relationship in plain words.'),
    how: {"see": T("The ways the file records two people as related, closest first. A list of relationships sits beside a drawing of the selected one, with the shared ancestor or couple at the top."), "marks": [T("The sentence at the top states the closest relationship in plain words."), T("Each entry in the list is a different shared ancestor or couple. “Half” means they share one ancestor there, not a couple."), T("In the drawing, the two people you chose are the black boxes at the foot of each line.")], "can": [T("Type a name in either box to choose a person, press Swap to turn the sentence round, or Surprise me for a random related pair."), T("Click any entry in the list to draw that path."), T("Click a name in the drawing to open that person.")], "care": T("Only relationships through recorded parents are found. When cousins married, an ancestor can be reached by many separate lines; every line is counted, and the shortest eighty are listed, followed by up to forty other relationships.")},
    blurb: T('Choose two people. The closest relationship is spelled out first, followed by every other way they are connected, which in a tangled tree can be many.'),
    icon: '<path d="M32 12 L16 50 M32 12 L48 50"/><circle cx="32" cy="12" r="5" fill="#fff"/><circle cx="16" cy="50" r="5" fill="#1B2632"/><circle cx="48" cy="50" r="5" fill="#A35139" stroke="#A35139"/><path d="M22 50 H42" stroke-dasharray="2 4"/>',
    render(v) {
      const s = v.state, data = v.data;
      v.stage.classList.add('scroll');
      const sheet = el('div', { class: 'sheet' });
      v.stage.append(sheet);
      const pool = data.people.filter(p => !p.hidden);
      const kin = FO.kin();
      const relatives = pool.filter(p => { const c = kin.cls.get(p); return c === 'relative' || c === 'ancestor'; });
      const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
      function surprise() {
        for (let i = 0; i < 300; i++) {
          const a = Math.random() < .6 && relatives.length ? s.home : rnd(pool);
          const b = a === s.home ? rnd(relatives) : rnd(pool);
          if (a && b && a !== b && FO.bloodRelations(a, b, 1).length) return [a, b];
        }
        return [s.home, s.home.father || s.home.mother || rnd(pool)];
      }
      let pair = s.pair && s.pair[0] && s.pair[1] ? s.pair : surprise();
      const pa = ui.picker('', pair[0], p => { pair = [p, pair[1]]; show(); }), pb = ui.picker(T('and'), pair[1], p => { pair = [pair[0], p]; show(); });
      v.controls.append(pa, pb,
        ui.button(T('Swap'), () => { pair = [pair[1], pair[0]]; show(); }),
        ui.button(T('Surprise me'), () => { pair = surprise(); show(); }));

      function show() {
        s.pair = pair;
        const [a, b] = pair;
        pa.setPerson(a); pb.setPerson(b);
        sheet.innerHTML = '';
        if (!a || !b || a === b) { sheet.append(el('p', { class: 'big', text: T('Choose two different people.') })); return; }
        const res = FO.relate(a, b, 40);
        const left = el('div'), right = el('div');
        const wrap = el('div', { class: 'relres' }, left, right);
        const nameBtn = p => ui.plink(p);
        if (!res.blood.length && !res.marriage.length) {
          left.append(el('p', { class: 'big' }, ...ui.parts('{a} and {b} share no ancestor in this file, and are not connected by a single marriage.', { a: nameBtn(a), b: nameBtn(b) })),
            el('p', { class: 'muted', text: T('They may still be connected through a longer chain of marriages, or the link may simply not be recorded yet.') }));
          sheet.append(wrap); return;
        }
        if (res.marriage.length && res.marriage[0].direct) left.append(el('p', { class: 'big' }, ...ui.parts('{a} is the {rel} of {b}.', { a: nameBtn(a), rel: el('em', { text: res.marriage[0].text }), b: nameBtn(b) }, { _sex: a.sex })));
        if (res.blood.length) {
          const r0 = res.blood[0];
          // one entry per way: a direct ancestor is expanded into every separate line of descent
          const options = [];
          let lineNote = null, totalWays = 0, up0 = true;
          res.blood.forEach(r => {
            totalWays += r.ways || 1;
            if (r.direct && (r.ways || 1) > 1) {
              const up = r.da === 0, anc = up ? a : b, desc = up ? b : a; up0 = up;
              const L = FO.linesOfDescent(anc, desc, 80);
              const parts = [...L.byGen.entries()].map(([g, n]) => T('{n}{x} as {relLabel}', { n: n, x: n === 1 ? T(' line') : T(' lines'), relLabel: FO.relLabel(0, g, anc.sex) }));
              lineNote = [L.total, parts, L.total > L.paths.length ? L.paths.length : 0];
              L.paths.forEach((path, k) => {
                const g = path.length - 1;
                options.push({ label: FO.relLabel(up ? 0 : g, up ? g : 0, a.sex), small: T('line {k} of {total} · {g} generations · through {join}', { k: k + 1, total: L.total, g: g, join: [...new Set([path[path.length - 2], path[Math.floor(path.length / 2)], path[Math.min(2, path.length - 2)]])].filter(q => q !== anc && q !== desc).map(q => q.name).join(', ') }),
                  rel: { direct: true, da: up ? 0 : g, db: up ? g : 0, via: [anc], half: false, pathA: up ? [a] : path, pathB: up ? path : [b] } });
              });
            } else {
              const via = r.direct ? T('direct line') : T('through {join}', { join: r.via.map(p => p.name).join(T(' and ')) });
              options.push({ label: r.label, small: T('{via} · {da} and {db} generations up{x}', { via: via, da: r.da, db: r.db, x: (r.ways || 1) > 1 ? T(' · {ways} combinations of lines lead there', { ways: r.ways }) : '' }), rel: r });
            }
          });
          left.append(el('p', { class: 'big' }, ...(lineNote ? ui.parts('{a} is the {rel} of {b}, by {n} different lines.', { a: nameBtn(a), rel: el('em', { text: r0.label }), b: nameBtn(b) }, { n: lineNote[0], _sex: a.sex }) : ui.parts('{a} is the {rel} of {b}.', { a: nameBtn(a), rel: el('em', { text: r0.label }), b: nameBtn(b) }, { _sex: a.sex }))));
          if (lineNote) left.append(el('p', { text: T('Counting every route through the tree, {x} appears on {join}.{x2}', { x: (up0 ? a : b).name.split(' ')[0], join: lineNote[1].join(', '), x2: lineNote[2] ? T(' The {x} shortest lines are listed.', { x: lineNote[2] }) : '' }) }));
          const others = res.blood.length - (lineNote ? 1 : 0);
          left.append(el('p', { class: 'muted', text: !lineNote && res.blood.length === 1 && totalWays === 1 ? T('That is the only blood relationship between them in this file.') :
            T('{x}Choose any entry to see its path.', { x: lineNote ? (others > 0 ? T('They are also related {x} other way{x2}, listed after the direct lines. ', { x: others >= 39 ? T('at least 39') : others, x2: others === 1 ? '' : 's' }) : '') : T('They share {x} different ancestors or couples{x2}. The closest is shown first. ', { x: res.blood.length >= 40 ? T('at least 40') : res.blood.length, x2: totalWays > res.blood.length ? T(', reached by {totalWays} combinations of lines', { totalWays: ui.fmt(totalWays) }) : '' }) }) }));
          let current = 0;
          const listBox = el('div', { style: { maxHeight: '52vh', overflow: 'auto', paddingRight: '4px' } });
          const btns = options.map((o, i) => el('button', { type: 'button', class: 'rel-opt', 'aria-pressed': String(i === 0), onclick: () => { current = i; btns.forEach((x, j) => x.setAttribute('aria-pressed', String(j === i))); drawPath(); } }, o.label, el('small', { text: o.small })));
          btns.forEach(x => listBox.append(x));
          left.append(listBox);
          const drawPath = () => {
            right.innerHTML = '';
            const r = options[current].rel;
            right.append(el('h3', { text: r.direct ? T('The line between them') : (r.via.length > 1 ? T('The path through their shared ancestors') : T('The path through their shared ancestor')) }),
              el('p', { class: 'sub muted', style: { margin: '0 0 14px', fontSize: '13.5px' }, text: r.half ? T('They share only one ancestor here, not a couple, which makes this a half relationship.') : T('Click a name to see that person.') }),
              diagram(r, a, b));
          };
          drawPath();
        } else if (!res.marriage[0].direct) {
          left.append(el('p', { class: 'big' }, ...ui.parts('{a} is the {rel}.', { a: nameBtn(a), rel: el('em', { text: res.marriage[0].text }) }, { _sex: a.sex })),
            el('p', { class: 'muted', text: T('They share no ancestor in this file; the connection runs through a marriage.') }));
          res.marriage.slice(1).forEach(m => left.append(el('p', {}, T('Also: the {text}.', { text: m.text }))));
        }
        sheet.append(wrap);
      }
      show();
      return () => {};
    }
  });
})();
