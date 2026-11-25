/* What's missing: how complete each generation of the pedigree is. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el;
  const T = FO.T;
  const genName = g => g === 1 ? T('Parents') : g === 2 ? T('Grandparents') : g === 3 ? T('Great-grandparents') : T('{ord} great-grandparents', { ord: FO.ord(g - 2) });
  // (French says 1,5 million but 2,0 millions)
  const big = n => n < 1e6 ? ui.fmt(n) : n < 1e9 ? (FO.lang === 'fr' && n >= 2e6 ? T('{x} millions', { x: FO.num(n / 1e6, 1) }) : T('{x} million', { x: FO.num(n / 1e6, 1) }))
    : (FO.lang === 'fr' && n >= 2e9 ? T('{x} billions', { x: FO.num(n / 1e9, 1) }) : T('{x} billion', { x: FO.num(n / 1e9, 1) }));

  FO.view({
    id: 'missing', order: 13, title: T('What’s Missing'),
    card: T('How complete each generation is, and exactly who lacks a date or a place.'),
    how: {"see": T("One row for each generation back from the home person. It shows how many of the possible ancestors the file records, and how many of those lack a birth or death date or place."), "marks": [T("The bar shows the share of places in that generation that are filled."), T("“Different people” is smaller than “places filled” wherever an ancestor appears more than once."), T("“Line ends here” counts people with no parents recorded: the next things to find.")], "can": [T("Click any number to list the people it counts."), T("Click a name in that list to open the person.")], "care": T("A missing date may simply never have been recorded anywhere. People who may be living are not counted as missing anything.")},
    blurb: s => T('Each row is one generation of {name}’s ancestors: how many of the possible places are filled, and how many of those people lack a birth or death detail or have no parents recorded. Click any count to see the names.', { name: s.home.name }),
    icon: '<circle cx="32" cy="32" r="22" stroke-dasharray="3 5"/><path d="M32 10 A22 22 0 0 1 54 32" stroke-width="2.6"/><path d="M32 10 A22 22 0 0 0 16 17" stroke-width="2.6"/><circle cx="32" cy="32" r="3" fill="#1B2632"/>',
    render(v) {
      const s = v.state;
      v.stage.classList.add('scroll');
      const sheet = el('div', { class: 'sheet', style: { maxWidth: 'none' } });
      v.stage.append(sheet);
      const anc = FO.kin().anc;
      if (anc.gens.length < 2) { ui.empty(v.stage, T('No parents recorded'), T('{name} has no parents in this file, so there are no generations to measure.', { name: s.home.name })); return; }
      const allAnc = [...anc.min.keys()].filter(p => p !== s.home);
      const known = allAnc.filter(p => !p.hidden);
      const miss = {
        bd: p => !(p.b && p.b.date && p.b.date.y), bp: p => !(p.b && p.b.place),
        dd: p => !(p.d && p.d.date && p.d.date.y), dp: p => !(p.d && p.d.place),
        par: p => !p.father && !p.mother, one: p => (!p.father) !== (!p.mother)
      };
      const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
      sheet.append(el('div', { class: 'statrow' },
        el('div', {}, el('b', { class: 'num', text: ui.fmt(allAnc.length) }), el('span', { text: T('ancestors found') })),
        el('div', {}, el('b', { class: 'num', text: anc.gens.length - 1 }), el('span', { text: T('generations reached') })),
        el('div', {}, el('b', { class: 'num', text: pct(known.filter(p => !miss.bd(p)).length, known.length) + '%' }), el('span', { text: T('have a birth year') })),
        el('div', {}, el('b', { class: 'num', text: pct(known.filter(p => !miss.dd(p)).length, known.length) + '%' }), el('span', { text: T('have a death year') })),
        el('div', {}, el('b', { class: 'num', text: ui.fmt(known.filter(miss.par).length) }), el('span', { text: T('lines that end (no parents recorded)') }))));

      const tbl = el('table', { class: 'tbl' });
      tbl.append(el('thead', {}, el('tr', {}, ...[T('Generation'), T('Places filled'), '', T('Different people'), T('No birth date'), T('No birth place'), T('No death date'), T('No death place'), T('One parent missing'), T('Line ends here'), T('May be living')].map(h => el('th', { text: h })))));
      const body = el('tbody');
      const cell = (g, people, f, label) => {
        const hit = people.filter(f);
        if (!hit.length) return el('td', { class: 'muted', text: '-' });
        return el('td', {}, el('button', { type: 'button', text: ui.fmt(hit.length), onclick: () => FO.showList(label, genName(g) + ' · ' + hit.length + (hit.length === 1 ? T(' person') : T(' people')), hit.slice().sort((a, b) => (a.est || 0) - (b.est || 0))) }));
      };
      for (let g = 1; g < anc.gens.length; g++) {
        const m = anc.gens[g];
        const slots = d3.sum([...m.values()]), possible = Math.pow(2, g);
        const people = [...m.keys()].filter(p => !p.hidden);
        const share = slots / possible;
        const bar = el('span', { class: 'bar bg', title: T('{x}% of places filled', { x: FO.num(share * 100, share < 0.01 ? 2 : 0) }) }, el('i', { style: { width: Math.max(share > 0 ? 1.5 : 0, share * 100) + '%' } }));
        body.append(el('tr', {},
          el('td', {}, el('b', { style: { fontWeight: 600 }, text: genName(g) }), el('small', { class: 'muted', text: '  ' + g })),
          el('td', { text: T('{slots} of {big}', { slots: ui.fmt(slots), big: big(possible) }) }),
          el('td', { style: { textAlign: 'left' } }, bar),
          el('td', {}, el('button', { type: 'button', text: ui.fmt(m.size), onclick: () => FO.showList(genName(g), T('{size} different people', { size: m.size }), [...m.keys()].sort((a, b) => (a.est || 0) - (b.est || 0))) })),
          cell(g, people, miss.bd, T('No birth date')), cell(g, people, miss.bp, T('No birth place')), cell(g, people, miss.dd, T('No death date')), cell(g, people, miss.dp, T('No death place')), cell(g, people, miss.one, T('One parent missing')), cell(g, people, miss.par, T('Line ends here')),
          el('td', { class: 'muted', text: (m.size - people.length) ? T('{x} not shown', { x: m.size - people.length }) : T('none') })));
      }
      tbl.append(body);
      sheet.append(el('h2', { text: T('Generation by generation') }),
        el('p', { class: 'muted', style: { margin: '0 0 16px', maxWidth: '60em' }, text: T('“Places filled” counts positions in the pedigree; “different people” is smaller wherever an ancestor appears more than once. “Line ends here” lists the people whose parents are the next thing to find.') }),
        el('div', { style: { overflowX: 'auto' } }, tbl));
      return () => {};
    }
  });
})();
