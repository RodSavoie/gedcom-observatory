/* Pedigree collapse: how often the same ancestors return, and what that does to the tree. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el, C = FO.C;
  const TEAL = '#2B80AA';
  const genName = g => g === 1 ? 'parent' : g === 2 ? 'grandparent' : g === 3 ? 'great-grandparent' : FO.ord(g - 2) + ' great-grandparent';
  const pct = (x, d) => (x * 100).toFixed(d == null ? (x < 0.001 ? 4 : x < 0.01 ? 3 : x < 0.1 ? 2 : 1) : d) + '%';
  const cousinWord = n => (n <= 1 ? '1st' : FO.ord(Math.round(n))) + ' cousins';

  FO.view({
    id: 'collapse', order: 14, title: 'Pedigree Collapse',
    card: 'Which ancestors return again and again, how related the ancestor couples were, and what it adds up to.',
    blurb: s => 'When cousins marry, their shared ancestors fill more than one place in the tree. This page measures that for ' + s.home.name + ': how many places each ancestor fills, how much of the tree they account for, and which ancestor couples were already kin.',
    how: {
      see: 'Tools for a tree where cousins married. Totals run across the top; under them, the collapse generation by generation, the ancestors who appear most often, and the ancestor couples who were related to each other before they married.',
      marks: ['A “place” is one position in the pedigree; a “line” is one route from the home person up to an ancestor. An ancestor reached by 49 lines fills 49 places.',
        '“Expected share” adds up one half for every generation along every line. It is the share of the home person’s DNA that ancestor would be expected to have contributed, on average.',
        'The inbreeding coefficient is the chance that the two copies of a gene the home person carries are the same copy, inherited down both sides from one ancestor. It is worked out from every recorded line.',
        'In the chart, blue is different people and red is places filled by someone already counted in that generation.'],
      can: ['Sort the ancestor table by lines or by expected share.', 'Press “Show the lines” to see every line of descent from that ancestor drawn in How Are We Related.', 'Click a name to open that person; where the file carries profile links (a WikiTree export does), use the link beside the name to open their profile.', 'Click a couple’s relationship to see how the two were related.'],
      care: 'Everything here follows the recorded parents. A wrong parent link changes the counts, and missing ancestors hide collapse that really happened, so the true figures are at least as large as these.'
    },
    icon: '<path d="M32 56 V44 M32 44 L20 32 M32 44 L44 32 M20 32 L12 20 M20 32 L32 18 M44 32 L32 18 M44 32 L52 20"/><circle cx="32" cy="18" r="5" fill="#A35139" stroke="#A35139"/><g fill="#1B2632" stroke="none"><circle cx="32" cy="56" r="3"/><circle cx="20" cy="32" r="2.4"/><circle cx="44" cy="32" r="2.4"/><circle cx="12" cy="20" r="2"/><circle cx="52" cy="20" r="2"/></g>',
    render(v) {
      const s = v.state, home = s.home, first = (home.given || home.name).split(' ')[0];
      v.stage.classList.add('scroll');
      const sheet = el('div', { class: 'sheet' });
      v.stage.append(sheet);
      const anc = FO.kin().anc, G = anc.gens.length - 1;
      if (G < 2) { ui.empty(v.stage, 'Not enough ancestors', home.name + ' needs at least grandparents on record before collapse can be measured.'); return; }
      // lines, generations and expected share for every ancestor
      const info = new Map();
      for (let g = 1; g <= G; g++) for (const [p, c] of anc.gens[g]) {
        const r = info.get(p) || { p, lines: 0, share: 0, gMin: g, gMax: g };
        r.lines += c; r.share += c / Math.pow(2, g); r.gMax = g; info.set(p, r);
      }
      const rows = [...info.values()];
      const filled = d3.sum(rows, r => r.lines), distinct = rows.length, repeated = rows.filter(r => r.lines > 1);
      const top = d3.greatest(rows.filter(r => !r.p.hidden), r => r.lines);
      // inbreeding and the parents' kinship
      const phi = FO.kinship(v.data);
      const F = home.father && home.mother ? phi(home.father, home.mother) : 0;
      const eq = F > 0 ? (-Math.log2(F) - 2) / 2 : null;
      const parentsRel = home.father && home.mother ? FO.bloodRelations(home.father, home.mother, 40) : [];
      // ancestor couples who were kin
      const couples = [];
      const seenFam = new Set();
      for (const p of info.keys()) for (const f of p.fams) {
        if (seenFam.has(f) || !f.husb || !f.wife || !info.has(f.husb) || !info.has(f.wife)) continue;
        if (!f.children.some(c => c === home || info.has(c))) continue;
        seenFam.add(f);
        const r = FO.bloodRelations(f.husb, f.wife, 1)[0];
        if (r) couples.push({ f, r, k: phi(f.husb, f.wife) });
      }
      if (home.father && home.mother && home.famc && parentsRel[0] && !seenFam.has(home.famc)) couples.push({ f: home.famc, r: parentsRel[0], k: F });
      couples.sort((a, b) => b.k - a.k);
      const nCouples = seenFam.size + (home.famc ? 1 : 0);

      const tile = (big, label, note, hot) => el('div', {}, el('b', { class: 'num', text: big, style: hot ? { color: C.red } : null }), el('span', { text: label }), note ? el('small', { text: note }) : null);
      sheet.append(el('div', { class: 'statrow' },
        tile(ui.fmt(filled), 'places filled', 'in ' + G + ' generations of the pedigree'),
        tile(ui.fmt(distinct), 'different ancestors', 'so each fills ' + (filled / distinct).toFixed(1) + ' places on average'),
        tile(ui.fmt(repeated.length), 'ancestors appear more than once', pct(repeated.length / distinct, 0) + ' of them', true),
        tile(top ? '× ' + ui.fmt(top.lines) : '-', 'most repeated ancestor', top ? top.p.name : ''),
        tile(F > 0 ? pct(F) : 'none found', 'inbreeding coefficient of ' + first, F > 0 ? 'about what a child of ' + (eq < 1 ? 'first cousins or closer' : eq % 1 > 0.25 && eq % 1 < 0.75 ? FO.ord(Math.floor(eq)) + ' to ' + cousinWord(Math.ceil(eq)) : cousinWord(eq)) + ' would have, though it comes from ' + ui.fmt(parentsRel.length >= 40 ? 40 : parentsRel.length) + (parentsRel.length >= 40 ? '+' : '') + ' shared ancestors or couples' : 'the parents share no recorded ancestor'),
        tile(ui.fmt(couples.length), 'ancestor couples were kin', 'of ' + ui.fmt(nCouples) + ' couples in the pedigree, as recorded')));

      const grid = el('div', { class: 'grid2' });
      sheet.append(grid);
      // generation by generation
      const gens = d3.range(1, G + 1).map(g => { const m = anc.gens[g], slots = d3.sum([...m.values()]); return { g, possible: Math.pow(2, g), slots, people: m.size }; });
      grid.append(FO.figure('Places and people, generation by generation', 'Each column is one generation back. Blue is different people; red is places filled by someone already counted in that generation.',
        FO.stacked(gens.map(d => ({ label: String(d.g), tip: 'Generation ' + d.g + ' (' + genName(d.g) + 's): ' + ui.fmt(d.slots) + ' of ' + (d.possible < 1e6 ? ui.fmt(d.possible) : d.possible.toExponential(1)) + ' places filled', parts: [{ key: 'Different people', value: d.people, color: TEAL }, { key: 'Repeat places', value: d.slots - d.people, color: C.red }] })), { unit: 'places' })));
      grid.append(FO.figure('How much each generation has collapsed', 'Of the places filled in a generation, the share taken by someone who is already there. Zero means everyone in that generation is a different person.',
        FO.columns(gens.map(d => ({ label: String(d.g), tip: 'Generation ' + d.g + ': ' + ui.fmt(d.slots - d.people) + ' of ' + ui.fmt(d.slots) + ' places are repeats', value: d.slots ? Math.round((1 - d.people / d.slots) * 100) : 0 })), { unit: '% of filled places', color: C.red, every: 1 })));

      // the ancestors who return most often
      let sortBy = 'lines';
      const tblBox = el('div');
      const drawTable = () => {
        tblBox.innerHTML = '';
        const list = rows.filter(r => !r.p.hidden && (sortBy === 'share' || r.lines > 1)).sort((a, b) => (sortBy === 'lines' ? b.lines - a.lines || b.share - a.share : b.share - a.share || a.gMin - b.gMin)).slice(sortBy === 'share' ? 6 : 0, sortBy === 'share' ? 56 : 50);
        const t = el('table', { class: 'tbl' });
        t.append(el('thead', {}, el('tr', {}, ...['Ancestor', 'Lines of descent', 'Generations back', 'Expected share of ' + first + '’s DNA', 'Worth about one', ''].map(h => el('th', { text: h })))));
        const tb = el('tbody');
        list.forEach(r => {
          const eqG = Math.round(-Math.log2(r.share));
          tb.append(el('tr', {},
            el('td', {}, ui.plink(r.p), el('small', { class: 'muted', text: '  ' + FO.lifespan(r.p) + '  ' }), ui.wt(r.p)),
            el('td', { style: r.lines > 1 ? { color: C.red, fontWeight: 700 } : null, text: ui.fmt(r.lines) }),
            el('td', { text: r.gMin === r.gMax ? String(r.gMin) : r.gMin + ' to ' + r.gMax }),
            el('td', {}, el('span', { class: 'bar', style: { width: Math.max(2, r.share / list[0].share * (sortBy === 'share' ? 90 : 60)) + 'px', background: TEAL, marginRight: '8px' } }), pct(r.share)),
            el('td', { class: 'muted', text: genName(eqG) }),
            el('td', {}, r.lines > 1 ? el('button', { type: 'button', text: 'Show the lines', onclick: () => { s.pair = [r.p, home]; FO.go('related', true); } }) : null)));
        });
        t.append(tb);
        tblBox.append(el('div', { style: { overflowX: 'auto' } }, t));
      };
      const tableTile = el('div', { class: 'tile', style: { marginTop: '18px' } },
        el('div', { style: { display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' } },
          el('div', {}, el('h3', { text: 'The ancestors who return most often' }), el('p', { class: 'sub', text: 'A line is one route from ' + first + ' up to that ancestor. “Expected share” counts a half for every generation on every line; “worth about one” says which single ancestor would contribute the same.' })),
          ui.seg([{ v: 'lines', label: 'Most lines' }, { v: 'share', label: 'Largest share beyond the great-grandparents' }], sortBy, x => { sortBy = x; drawTable(); })),
        tblBox);
      drawTable();
      sheet.append(tableTile);

      // couples who were already related
      if (couples.length) {
        const t = el('table', { class: 'tbl' });
        t.append(el('thead', {}, el('tr', {}, ...['Couple', 'Married', 'They were', 'Kinship', 'Lines through them'].map(h => el('th', { text: h })))));
        const tb = el('tbody');
        couples.slice(0, 60).forEach(c => {
          const lines = c.f === home.famc ? 1 : Math.max(info.get(c.f.husb).lines, info.get(c.f.wife).lines);
          tb.append(el('tr', {},
            el('td', {}, ui.plink(c.f.husb), ' and ', ui.plink(c.f.wife), '  ', ui.wt(c.f.husb, '')),
            el('td', { text: c.f.my || '' }),
            el('td', {}, el('button', { type: 'button', text: c.r.label.replace(/cousin\b/, 'cousins'), onclick: () => { s.pair = [c.f.husb, c.f.wife]; FO.go('related', true); } })),
            el('td', { text: pct(c.k) }),
            el('td', { text: c.f === home.famc ? first + '’s parents' : ui.fmt(lines) })));
        });
        t.append(tb);
        sheet.append(el('div', { class: 'tile', style: { marginTop: '18px' } }, el('h3', { text: 'Ancestor couples who were already kin' }),
          el('p', { class: 'sub', text: ui.fmt(couples.length) + ' of the ' + ui.fmt(nCouples) + ' couples in this pedigree share a recorded ancestor. Closest first; kinship is the chance that a gene picked from each partner is the same by descent' + (couples.length > 60 ? '. The 60 closest are shown.' : '.') + ' Click the relationship to see how they were related.' }),
          el('div', { style: { overflowX: 'auto' } }, t)));
      }
      return () => {};
    }
  });
})();
