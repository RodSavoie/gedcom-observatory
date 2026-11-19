/* What's missing: how complete each generation of the pedigree is. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el;
  const genName = g => g === 1 ? 'Parents' : g === 2 ? 'Grandparents' : g === 3 ? 'Great-grandparents' : FO.ord(g - 2) + ' great-grandparents';
  const big = n => n < 1e6 ? ui.fmt(n) : n < 1e9 ? (n / 1e6).toFixed(1) + ' million' : (n / 1e9).toFixed(1) + ' billion';

  FO.view({
    id: 'missing', order: 13, title: 'What’s Missing',
    card: 'How complete each generation is, and exactly who lacks a date or a place.',
    how: {"see": "One row for each generation back from the home person. It shows how many of the possible ancestors the file records, and how many of those lack a birth or death date or place.", "marks": ["The bar shows the share of places in that generation that are filled.", "“Different people” is smaller than “places filled” wherever an ancestor appears more than once.", "“Line ends here” counts people with no parents recorded: the next things to find."], "can": ["Click any number to list the people it counts.", "Click a name in that list to open the person."], "care": "A missing date may simply never have been recorded anywhere. People who may be living are not counted as missing anything."},
    blurb: s => 'Each row is one generation of ' + s.home.name + '’s ancestors: how many of the possible places are filled, and how many of those people lack a birth or death detail or have no parents recorded. Click any count to see the names.',
    icon: '<circle cx="32" cy="32" r="22" stroke-dasharray="3 5"/><path d="M32 10 A22 22 0 0 1 54 32" stroke-width="2.6"/><path d="M32 10 A22 22 0 0 0 16 17" stroke-width="2.6"/><circle cx="32" cy="32" r="3" fill="#1B2632"/>',
    render(v) {
      const s = v.state;
      v.stage.classList.add('scroll');
      const sheet = el('div', { class: 'sheet', style: { maxWidth: 'none' } });
      v.stage.append(sheet);
      const anc = FO.kin().anc;
      if (anc.gens.length < 2) { ui.empty(v.stage, 'No parents recorded', s.home.name + ' has no parents in this file, so there are no generations to measure.'); return; }
      const allAnc = [...anc.min.keys()].filter(p => p !== s.home);
      const known = allAnc.filter(p => !p.hidden);
      const miss = {
        bd: p => !(p.b && p.b.date && p.b.date.y), bp: p => !(p.b && p.b.place),
        dd: p => !(p.d && p.d.date && p.d.date.y), dp: p => !(p.d && p.d.place),
        par: p => !p.father && !p.mother, one: p => (!p.father) !== (!p.mother)
      };
      const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
      sheet.append(el('div', { class: 'statrow' },
        el('div', {}, el('b', { class: 'num', text: ui.fmt(allAnc.length) }), el('span', { text: 'ancestors found' })),
        el('div', {}, el('b', { class: 'num', text: anc.gens.length - 1 }), el('span', { text: 'generations reached' })),
        el('div', {}, el('b', { class: 'num', text: pct(known.filter(p => !miss.bd(p)).length, known.length) + '%' }), el('span', { text: 'have a birth year' })),
        el('div', {}, el('b', { class: 'num', text: pct(known.filter(p => !miss.dd(p)).length, known.length) + '%' }), el('span', { text: 'have a death year' })),
        el('div', {}, el('b', { class: 'num', text: ui.fmt(known.filter(miss.par).length) }), el('span', { text: 'lines that end (no parents recorded)' }))));

      const tbl = el('table', { class: 'tbl' });
      tbl.append(el('thead', {}, el('tr', {}, ...['Generation', 'Places filled', '', 'Different people', 'No birth date', 'No birth place', 'No death date', 'No death place', 'One parent missing', 'Line ends here', 'May be living'].map(h => el('th', { text: h })))));
      const body = el('tbody');
      const cell = (g, people, f, label) => {
        const hit = people.filter(f);
        if (!hit.length) return el('td', { class: 'muted', text: '-' });
        return el('td', {}, el('button', { type: 'button', text: ui.fmt(hit.length), onclick: () => FO.showList(label, genName(g) + ' · ' + hit.length + (hit.length === 1 ? ' person' : ' people'), hit.slice().sort((a, b) => (a.est || 0) - (b.est || 0))) }));
      };
      for (let g = 1; g < anc.gens.length; g++) {
        const m = anc.gens[g];
        const slots = d3.sum([...m.values()]), possible = Math.pow(2, g);
        const people = [...m.keys()].filter(p => !p.hidden);
        const share = slots / possible;
        const bar = el('span', { class: 'bar bg', title: (share * 100).toFixed(share < 0.01 ? 2 : 0) + '% of places filled' }, el('i', { style: { width: Math.max(share > 0 ? 1.5 : 0, share * 100) + '%' } }));
        body.append(el('tr', {},
          el('td', {}, el('b', { style: { fontWeight: 600 }, text: genName(g) }), el('small', { class: 'muted', text: '  ' + g })),
          el('td', { text: ui.fmt(slots) + ' of ' + big(possible) }),
          el('td', { style: { textAlign: 'left' } }, bar),
          el('td', {}, el('button', { type: 'button', text: ui.fmt(m.size), onclick: () => FO.showList(genName(g), m.size + ' different people', [...m.keys()].sort((a, b) => (a.est || 0) - (b.est || 0))) })),
          cell(g, people, miss.bd, 'No birth date'), cell(g, people, miss.bp, 'No birth place'), cell(g, people, miss.dd, 'No death date'), cell(g, people, miss.dp, 'No death place'), cell(g, people, miss.one, 'One parent missing'), cell(g, people, miss.par, 'Line ends here'),
          el('td', { class: 'muted', text: (m.size - people.length) ? (m.size - people.length) + ' not shown' : 'none' })));
      }
      tbl.append(body);
      sheet.append(el('h2', { text: 'Generation by generation' }),
        el('p', { class: 'muted', style: { margin: '0 0 16px', maxWidth: '60em' }, text: '“Places filled” counts positions in the pedigree; “different people” is smaller wherever an ancestor appears more than once. “Line ends here” lists the people whose parents are the next thing to find.' }),
        el('div', { style: { overflowX: 'auto' } }, tbl));
      return () => {};
    }
  });
})();
