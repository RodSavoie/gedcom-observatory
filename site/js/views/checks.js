/* Things worth checking: places where the record looks unlikely. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el;
  const approx = p => !!(p.b && p.b.date && p.b.date.q);
  const firstName = p => (p.given || p.name).split(' ')[0];

  function findings(data) {
    const out = [];
    const add = (cat, people, parts, detail) => out.push({ cat, people, parts, detail });
    for (const p of data.people) {
      if (p.hidden) continue;
      const by = p.by, dy = p.dy, tol = approx(p) || (p.d && p.d.date && p.d.date.q) ? 3 : 0;
      if (by != null && dy != null) {
        if (dy < by - tol) add('dates', [p], ['Did ', p, ' really die before being born?'], 'Born ' + p.b.date.text + ', died ' + p.d.date.text + '.');
        else if (dy - by > 105 + tol) add('dates', [p], ['Did ', p, ' really live to ' + (dy - by) + '?'], 'Born ' + p.b.date.text + ', died ' + p.d.date.text + '.');
      }
      if (by != null) {
        const m = p.mother, f = p.father;
        if (m && !m.hidden && m.by != null) {
          const t = approx(p) || approx(m) ? 5 : 0, a = by - m.by;
          if (a < 0 - t) add('parents', [p, m], ['Was ', p, ' born before ' + (p.sex === 'F' ? 'her' : 'his') + ' mother, ', m, '?'], 'Child born ' + by + ', mother born ' + m.by + '.');
          else if (a < 13 - t) add('parents', [p, m], ['Was ', m, ' only ' + a + ' when ', p, ' was born?'], 'Mother born ' + m.b.date.text + ', child born ' + p.b.date.text + '.');
          else if (a > 52 + t) add('parents', [p, m], ['Was ', m, ' really ' + a + ' when ', p, ' was born?'], 'Mother born ' + m.b.date.text + ', child born ' + p.b.date.text + '.');
        }
        if (m && !m.hidden && m.dy != null && by > m.dy + (approx(p) || m.d.date.q ? 3 : 0)) add('parents', [p, m], ['Was ', p, ' born after the death of the mother, ', m, '?'], 'Child born ' + p.b.date.text + ', mother died ' + m.d.date.text + '.');
        if (f && !f.hidden && f.by != null) {
          const t = approx(p) || approx(f) ? 5 : 0, a = by - f.by;
          if (a < 0 - t) add('parents', [p, f], ['Was ', p, ' born before ' + (p.sex === 'F' ? 'her' : 'his') + ' father, ', f, '?'], 'Child born ' + by + ', father born ' + f.by + '.');
          else if (a < 14 - t) add('parents', [p, f], ['Was ', f, ' only ' + a + ' when ', p, ' was born?'], 'Father born ' + f.b.date.text + ', child born ' + p.b.date.text + '.');
          else if (a > 75 + t) add('parents', [p, f], ['Was ', f, ' really ' + a + ' when ', p, ' was born?'], 'Father born ' + f.b.date.text + ', child born ' + p.b.date.text + '.');
        }
        if (f && !f.hidden && f.dy != null && by > f.dy + 1 + (approx(p) || f.d.date.q ? 3 : 0)) add('parents', [p, f], ['Was ', p, ' born more than a year after the death of the father, ', f, '?'], 'Child born ' + p.b.date.text + ', father died ' + f.d.date.text + '.');
      }
    }
    for (const f of data.families) {
      if (f.my == null) continue;
      for (const p of [f.husb, f.wife]) {
        if (!p || p.hidden) continue;
        const tol = approx(p) || f.m.date.q ? 4 : 0;
        if (p.by != null && f.my - p.by < 13 - tol) add('marriage', [p], ['Did ', p, ' really marry at ' + Math.max(0, f.my - p.by) + '?'], 'Born ' + p.b.date.text + ', married ' + f.m.date.text + '.');
        if (p.dy != null && f.my > p.dy + tol) add('marriage', [p], ['Did ', p, ' marry after dying?'], 'Died ' + p.d.date.text + ', married ' + f.m.date.text + '.');
      }
      // siblings born too close together
    }
    for (const f of data.families) {
      const kids = f.children.filter(c => !c.hidden && c.b && c.b.date && c.b.date.y && c.b.date.m && !c.b.date.q).sort((a, b) => (a.b.date.y * 12 + a.b.date.m) - (b.b.date.y * 12 + b.b.date.m));
      for (let i = 1; i < kids.length; i++) {
        const gap = (kids[i].b.date.y * 12 + kids[i].b.date.m) - (kids[i - 1].b.date.y * 12 + kids[i - 1].b.date.m);
        if (gap >= 2 && gap <= 7) add('siblings', [kids[i - 1], kids[i]], ['Were ', kids[i - 1], ' and ', kids[i], ' really born ' + gap + ' months apart to the same mother?'], firstName(kids[i - 1]) + ' born ' + kids[i - 1].b.date.text + ', ' + firstName(kids[i]) + ' born ' + kids[i].b.date.text + '.');
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
    for (const p of loopers) if (!p.hidden) add('loop', [p], ['Is ', p, ' really recorded as ' + (p.sex === 'F' ? 'her' : 'his') + ' own ancestor?'], 'Following the recorded parents upward leads back to the same person. One of the parent links in that circle is wrong.');
    // possible duplicates: same name, same birth year
    const groups = d3.group(data.people.filter(p => !p.hidden && p.by != null && p.surname && p.given && !/^unknown$/i.test(p.given)), p => FO.norm(p.name) + '|' + p.by);
    for (const [, g] of groups) {
      if (g.length < 2) continue;
      add('duplicates', g, ['Are ', g[0], ' and ', g[1], g.length > 2 ? ' (and ' + (g.length - 2) + ' more)' : '', ' the same person entered twice?'], 'Same name and the same birth year, ' + g[0].by + (g[0].father && g[1].father && g[0].father === g[1].father ? '; same father too, so perhaps a child named after a sibling who died young.' : '.'));
    }
    return out;
  }

  const CATS = [['all', 'Everything'], ['dates', 'Unlikely lifespans'], ['parents', 'Parents’ ages'], ['marriage', 'Marriages'], ['siblings', 'Births too close'], ['duplicates', 'Possible duplicates'], ['loop', 'Own ancestor']];

  FO.view({
    id: 'checks', order: 12, title: 'Things Worth Checking',
    card: 'Dates that do not add up, put as questions to look into.',
    how: {"see": "A list of entries in this tree that deserve a second look, grouped by kind. Each line is put as a question and says what the file records.", "marks": ["Parents’ ages: a child born before a parent was about 13, after a mother was 52 or a father 75, or after a parent’s death.", "Unlikely lifespans: a death before a birth, or a life of more than 105 years.", "Marriages before 13 or after death; births too close together; two people with the same name and birth year; someone recorded as their own ancestor."], "can": ["Use Show to see one kind at a time.", "Click a name to open that person here, or, where the file carries a profile link (a WikiTree export does), use the link under each question to open that profile in a new tab and correct it."], "care": "Nothing here is certainly wrong. Approximate dates are given a few years’ leeway, and some unusual entries are true."},
    blurb: 'Nothing here is certainly wrong. These are places where the dates on record are unlikely enough to deserve a second look at the sources. Approximate dates are given extra leeway.',
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
        sheet.append(el('h2', { text: rows.length ? ui.fmt(rows.length) + (rows.length === 1 ? ' question' : ' questions') + ' to look into' : 'Nothing stands out here' }),
          el('p', { class: 'muted', style: { margin: '0 0 12px' }, text: rows.length ? (scope ? 'Among ' + ui.fmt(scope.size - 1) + ' direct ancestors and their records.' : 'Out of ' + ui.fmt(v.data.people.length) + ' people.') + ' Click a name to open that person.' : 'No records in this group look unlikely.' }));
        rows.slice(0, limit).forEach(d => {
          const p = el('p');
          d.parts.forEach(x => p.append(typeof x === 'string' ? x : ui.plink(x)));
          const links = el('div', { class: 'links' });
          [...new Set(d.people)].forEach(q => { const a = ui.wt(q, 'Open ' + q.name + ' on ' + (/wikitree/i.test(q.url || '') ? 'WikiTree' : /familysearch/i.test(q.url || '') ? 'FamilySearch' : 'its profile page')); if (a) links.append(a); });
          sheet.append(el('div', { class: 'q' }, el('div', {}, p, el('small', { text: d.detail }), links.childNodes.length ? links : null)));
        });
        if (rows.length > limit) sheet.append(el('p', {}, ui.button('Show ' + Math.min(150, rows.length - limit) + ' more', () => { limit += 150; show(); })));
      }
      v.controls.append(ui.select('Show', CATS.filter(c => c[0] === 'all' || counts.get(c[0])).map(c => ({ v: c[0], label: c[1] + ' (' + (c[0] === 'all' ? all.length : counts.get(c[0])) + ')' })), cat, c => { cat = c; limit = 150; show(); v.stage.scrollTop = 0; }));
      show();
      return () => {};
    }
  });
})();
