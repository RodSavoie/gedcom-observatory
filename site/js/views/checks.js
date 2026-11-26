/* Things worth checking: places where the record looks unlikely. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el;
  const T = FO.T;
  const approx = p => !!(p.b && p.b.date && p.b.date.q);
  const firstName = p => (p.given || p.name).split(' ')[0];

  /* A question with people in it: Q('Was {m} only {a} when {p} was born?', { m, p }, { a, _sex }) gives the parts to draw,
     the people as links; the template is translated first, so the people may move. */
  const Q = (tmpl, people, vars) => {
    const out = [];
    T(tmpl, vars).split(/(\{\w+\})/).forEach(bit => {
      const k = bit.length > 2 && bit[0] === '{' ? bit.slice(1, -1) : null;
      if (k && people[k]) {
        // French elision before a name: "de Anne" -> "d’Anne"
        const prev = out.length ? out[out.length - 1] : null;
        if (FO.lang === 'fr' && typeof prev === 'string' && /(^|\s)([dD]e|[qQ]ue) $/.test(prev) && /^[AEIOUYHÀÂÉÈÊÎÏÔÙÛ]/i.test(people[k].name)) out[out.length - 1] = prev.replace(/([dD]|[qQ]u)e $/, '$1’');
        out.push(people[k]);
      } else if (bit) out.push(bit);
    });
    return out;
  };
  function findings(data) {
    const out = [];
    const add = (cat, people, parts, detail) => out.push({ cat, people, parts, detail });
    for (const p of data.people) {
      if (p.hidden) continue;
      const by = p.by, dy = p.dy, tol = approx(p) || (p.d && p.d.date && p.d.date.q) ? 3 : 0;
      if (by != null && dy != null) {
        const detail = T('Born {b}, died {d}.', { b: p.b.date.text, d: p.d.date.text });
        if (dy < by - tol) add('dates', [p], Q('Did {p} really die before being born?', { p }, { _sex: p.sex }), detail);
        else if (dy - by > 105 + tol) add('dates', [p], Q('Did {p} really live to {age}?', { p }, { age: dy - by, _sex: p.sex }), detail);
      }
      if (by != null) {
        const m = p.mother, f = p.father;
        if (m && !m.hidden && m.by != null) {
          const t = approx(p) || approx(m) ? 5 : 0, a = by - m.by;
          const detail = T('Mother born {m}, child born {c}.', { m: m.b.date.text, c: p.b.date.text });
          if (a < 0 - t) add('parents', [p, m], Q('Was {p} born before their mother, {m}?', { p, m }, { _sex: p.sex }), T('Child born {c}, mother born {m}.', { c: by, m: m.by }));
          else if (a < 13 - t) add('parents', [p, m], Q('Was {m} only {a} when {p} was born?', { p, m }, { a, _sex: p.sex }), detail);
          else if (a > 52 + t) add('parents', [p, m], Q('Was {m} really {a} when {p} was born?', { p, m }, { a, _sex: p.sex }), detail);
        }
        if (m && !m.hidden && m.dy != null && by > m.dy + (approx(p) || m.d.date.q ? 3 : 0)) add('parents', [p, m], Q('Was {p} born after the death of the mother, {m}?', { p, m }, { _sex: p.sex }), T('Child born {c}, mother died {m}.', { c: p.b.date.text, m: m.d.date.text }));
        if (f && !f.hidden && f.by != null) {
          const t = approx(p) || approx(f) ? 5 : 0, a = by - f.by;
          const detail = T('Father born {f}, child born {c}.', { f: f.b.date.text, c: p.b.date.text });
          if (a < 0 - t) add('parents', [p, f], Q('Was {p} born before their father, {f}?', { p, f }, { _sex: p.sex }), T('Child born {c}, father born {f}.', { c: by, f: f.by }));
          else if (a < 14 - t) add('parents', [p, f], Q('Was {f} only {a} when {p} was born?', { p, f }, { a, _sex: p.sex }), detail);
          else if (a > 75 + t) add('parents', [p, f], Q('Was {f} really {a} when {p} was born?', { p, f }, { a, _sex: p.sex }), detail);
        }
        if (f && !f.hidden && f.dy != null && by > f.dy + 1 + (approx(p) || f.d.date.q ? 3 : 0)) add('parents', [p, f], Q('Was {p} born more than a year after the death of the father, {f}?', { p, f }, { _sex: p.sex }), T('Child born {c}, father died {f}.', { c: p.b.date.text, f: f.d.date.text }));
      }
    }
    for (const f of data.families) {
      if (f.my == null) continue;
      for (const p of [f.husb, f.wife]) {
        if (!p || p.hidden) continue;
        const tol = approx(p) || f.m.date.q ? 4 : 0;
        if (p.by != null && f.my - p.by < 13 - tol) add('marriage', [p], Q('Did {p} really marry at {age}?', { p }, { age: Math.max(0, f.my - p.by), _sex: p.sex }), T('Born {b}, married {m}.', { b: p.b.date.text, m: f.m.date.text }));
        if (p.dy != null && f.my > p.dy + tol) add('marriage', [p], Q('Did {p} marry after dying?', { p }, { _sex: p.sex }), T('Died {d}, married {m}.', { d: p.d.date.text, m: f.m.date.text }));
      }
      // siblings born too close together
    }
    for (const f of data.families) {
      const kids = f.children.filter(c => !c.hidden && c.b && c.b.date && c.b.date.y && c.b.date.m && !c.b.date.q).sort((a, b) => (a.b.date.y * 12 + a.b.date.m) - (b.b.date.y * 12 + b.b.date.m));
      for (let i = 1; i < kids.length; i++) {
        const gap = (kids[i].b.date.y * 12 + kids[i].b.date.m) - (kids[i - 1].b.date.y * 12 + kids[i - 1].b.date.m);
        if (gap >= 2 && gap <= 7) add('siblings', [kids[i - 1], kids[i]], Q('Were {a} and {b} really born {gap} months apart to the same mother?', { a: kids[i - 1], b: kids[i] }, { gap }),
          T('{a} born {ad}, {b} born {bd}.', { a: firstName(kids[i - 1]), ad: kids[i - 1].b.date.text, b: firstName(kids[i]), bd: kids[i].b.date.text }));
      }
    }
    // someone recorded as their own ancestor: walk up the parents and look for a way back
    const state = new Map();
    const loopers = new Set();
    for (const start of data.people) {
      if (state.get(start)) continue;
      const stack = [[start, 0]], path = [];
      while (stack.length) {
        const top = stack[stack.length - 1], p = top[0];
        if (top[1] === 0) { state.set(p, 1); path.push(p); }
        const par = top[1] === 0 ? p.father : top[1] === 1 ? p.mother : undefined;
        top[1]++;
        if (top[1] > 2) { state.set(p, 2); path.pop(); stack.pop(); continue; }
        if (!par) continue;
        if (state.get(par) === 1) { for (let i = path.indexOf(par); i >= 0 && i < path.length; i++) loopers.add(path[i]); }
        else if (!state.get(par)) stack.push([par, 0]);
      }
    }
    for (const p of loopers) if (!p.hidden) add('loop', [p], Q('Is {p} really recorded as their own ancestor?', { p }, { _sex: p.sex }), T('Following the recorded parents upward leads back to the same person. One of the parent links in that circle is wrong.'));
    return out;
  }

  const CATS = [['all', T('Everything')], ['dates', T('Unlikely lifespans')], ['parents', T('Parents’ ages')], ['marriage', T('Marriages')], ['siblings', T('Births too close')], ['loop', T('Own ancestor')]];

  FO.view({
    id: 'checks', order: 12, title: T('Things Worth Checking'),
    card: T('Dates that do not add up, put as questions to look into.'),
    how: {"see": T("A list of entries in this tree that deserve a second look, grouped by kind. Each line is put as a question and says what the file records."), "marks": [T("Parents’ ages: a child born before a parent was about 13, after a mother was 52 or a father 75, or after a parent’s death."), T("Unlikely lifespans: a death before a birth, or a life of more than 105 years."), T("Marriages before 13 or after death; births too close together; someone recorded as their own ancestor.")], "can": [T("Use Show to see one kind at a time."), T("Click a name to open that person here, or, where the file carries a profile link (a WikiTree export does), use the link under each question to open that profile in a new tab and correct it.")], "care": T("Nothing here is certainly wrong. Approximate dates are given a few years’ leeway, and some unusual entries are true.")},
    blurb: T('Nothing here is certainly wrong. These are places where the dates on record are unlikely enough to deserve a second look at the sources. Approximate dates are given extra leeway.'),
    icon: '<circle cx="32" cy="32" r="22" stroke="#A35139" stroke-width="2"/><path d="M25 25 a7 7 0 1 1 10 6 c-2 1.4 -3 3 -3 6" stroke="#A35139" stroke-width="2.4"/><circle cx="32" cy="44" r="1.6" fill="#A35139" stroke="none"/>',
    render(v) {
      v.stage.classList.add('scroll');
      const sheet = el('div', { class: 'sheet', style: { maxWidth: '860px' } });
      v.stage.append(sheet);
      const scope = FO.scope();
      const all = findings(v.data).filter(d => !scope || d.people.some(p => scope.has(p)));
      v.controls.append(ui.scopeSeg());
      let cat = 'all', limit = 150;
      const counts = d3.rollup(all, x => x.length, d => d.cat);
      function show() {
        sheet.innerHTML = '';
        const rows = all.filter(d => cat === 'all' || d.cat === cat);
        sheet.append(el('h2', { text: rows.length ? T('{length}{x} to look into', { length: ui.fmt(rows.length), x: rows.length === 1 ? T(' question') : T(' questions') }) : T('Nothing stands out here') }),
          el('p', { class: 'muted', style: { margin: '0 0 12px' }, text: rows.length ? T('{x} Click a name to open that person.', { x: scope ? T('Among {x} direct ancestors and their records.', { x: ui.fmt(scope.size - 1) }) : T('Out of {length} people.', { length: ui.fmt(v.data.people.length) }) }) : T('No records in this group look unlikely.') }));
        rows.slice(0, limit).forEach(d => {
          const p = el('p');
          d.parts.forEach(x => p.append(typeof x === 'string' ? x : ui.plink(x)));
          const links = el('div', { class: 'links' });
          [...new Set(d.people)].forEach(q => { const a = ui.wt(q, T('Open {name} on {x}', { name: q.name, x: /wikitree/i.test(q.url || '') ? T('WikiTree') : /familysearch/i.test(q.url || '') ? T('FamilySearch') : T('its profile page') })); if (a) links.append(a); });
          sheet.append(el('div', { class: 'q' }, el('div', {}, p, el('small', { text: d.detail }), links.childNodes.length ? links : null)));
        });
        if (rows.length > limit) sheet.append(el('p', {}, ui.button(T('Show {x} more', { x: Math.min(150, rows.length - limit) }), () => { limit += 150; show(); })));
      }
      v.controls.append(ui.select(T('Show'), CATS.filter(c => c[0] === 'all' || counts.get(c[0])).map(c => ({ v: c[0], label: c[1] + ' (' + (c[0] === 'all' ? all.length : counts.get(c[0])) + ')' })), cat, c => { cat = c; limit = 150; show(); v.stage.scrollTop = 0; }));
      show();
      return () => {};
    }
  });
})();
