/* Life story: a written account of one person, beside a timeline. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el;

  const WORDS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
  const nth = n => WORDS[n] || FO.ord(n);
  const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const num = n => (n <= 12 ? NUM[n] : String(n));
  const pro = p => p.sex === 'M' ? { s: 'he', o: 'him', p: 'his' } : p.sex === 'F' ? { s: 'she', o: 'her', p: 'her' } : { s: 'they', o: 'them', p: 'their' };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const first = p => (p.hidden ? 'a person who may still be living' : (p.given || p.name).split(' ')[0]);
  const when = ev => { const d = ev && ev.date; if (!d || !d.y) return ''; if (d.q) return d.text; return (d.d ? 'on ' : 'in ') + d.text; };
  const where = ev => (ev && ev.place ? 'in ' + FO.shortPlace(ev.place) : '');
  const approx = (p, y) => (p.b && p.b.date && p.b.date.q ? 'about ' : '') + (y - p.by);

  const CONTEXT = FO.HISTORY;

  function tell(p, home) {
    const P = pro(p), paras = [], tl = [];
    const para = (...parts) => paras.push(parts.filter(x => x !== '' && x != null));
    const link = q => (q.hidden ? 'someone who may still be living' : q);
    const by = p.by, dy = p.dy;
    const add = (y, text, cls) => { if (y != null) tl.push({ y, text, cls, age: by != null ? y - by : null }); };

    // birth and parents
    const bw = [when(p.b), where(p.b)].filter(Boolean).join(' ');
    const s1 = bw ? [link(p), ' was born ' + bw + '.'] : [link(p), '’s birth is not recorded in this file.'];
    const f = p.father, m = p.mother;
    if (f || m) {
      const sibs = p.famc.children.slice().sort((a, b) => (a.est || 9999) - (b.est || 9999));
      const pos = sibs.indexOf(p) + 1;
      const role = sibs.length === 1 ? 'the only known child' : 'the ' + (pos === sibs.length && sibs.length > 2 ? 'youngest' : nth(pos)) + ' of ' + num(sibs.length) + ' known children';
      s1.push(' ' + cap(P.s) + (P.s === 'they' ? ' were ' : ' was ') + role + ' of ');
      if (f) s1.push(link(f)); if (f && m) s1.push(' and '); if (m) s1.push(link(m)); s1.push('.');
      const ages = [];
      if (by != null && f && f.by != null && by - f.by > 10 && by - f.by < 90) ages.push(P.p + ' father was ' + approx(f, by));
      if (by != null && m && m.by != null && by - m.by > 10 && by - m.by < 65) ages.push(P.p + ' mother ' + (ages.length ? '' : 'was ') + approx(m, by));
      if (ages.length) s1.push(' ' + cap(ages.join(' and ')) + ' at the time.');
    } else s1.push(' ' + cap(P.p) + ' parents are not recorded here, so for now this line ends with ' + P.o + '.');
    para(...s1);
    add(by, 'Born' + (p.b && p.b.place ? ' ' + where(p.b) : ''), 'key');

    // childhood losses
    const early = [];
    [[m, 'mother'], [f, 'father']].forEach(([q, w]) => {
      if (q && q.dy != null && by != null && q.dy >= by) {
        add(q.dy, cap(P.p) + ' ' + w + ', ' + first(q) + ', dies');
        if (q.dy - by < 16) early.push(P.s + (P.s === 'they' ? ' were ' : ' was ') + (q.dy - by < 1 ? 'an infant' : 'about ' + (q.dy - by)) + ' when ' + P.p + ' ' + w + ' died in ' + q.dy);
      }
    });
    if (early.length) para(cap(early.join(', and ')) + '.');

    // marriages and children
    const fams = p.fams.slice().sort((a, b) => ((a.my || (a.children[0] && a.children[0].est) || 9999) - (b.my || (b.children[0] && b.children[0].est) || 9999)));
    let kidsTotal = 0, lostKids = 0;
    fams.forEach((fam, k) => {
      const sp = fam.husb === p ? fam.wife : fam.husb;
      const kids = fam.children.slice().sort((a, b) => (a.est || 9999) - (b.est || 9999));
      kidsTotal += kids.length;
      const parts = [];
      if (sp) {
        if (fam.my != null) {
          const at = by != null && fam.my - by > 10 && fam.my - by < 95 ? ', at ' + approx(p, fam.my) + ',' : '';
          parts.push((fam.m.date.q ? cap(fam.m.date.text) : 'In ' + fam.my) + at + ' ' + P.s + ' married ' + (k > 0 ? 'again, to ' : ''), link(sp), (fam.m.place ? ' ' + where(fam.m) : '') + '.');
          if (!sp.hidden && sp.by != null && fam.my - sp.by > 10 && fam.my - sp.by < 95) parts.push(' ' + first(sp) + ' was ' + approx(sp, fam.my) + '.');
          add(fam.my, 'Marries ' + (sp.hidden ? '' : sp.name) + (fam.m.place ? ' ' + where(fam.m) : ''), 'key');
        } else parts.push(cap(P.s) + (k > 0 ? ' also' : '') + ' had a family with ', link(sp), '; no marriage date is recorded.');
      } else if (kids.length) parts.push(cap(P.s) + ' had children with a partner who is not recorded.');
      if (kids.length) {
        const ys = kids.filter(c => c.by != null).map(c => c.by);
        const named = kids.filter(c => !c.hidden).slice(0, 6);
        const list = [];
        named.forEach((c, i) => { if (i) list.push(i === named.length - 1 && kids.length === named.length ? ' and ' : ', '); list.push(c); });
        if (kids.length > named.length) list.push(named.length ? ' and ' + num(kids.length - named.length) + ' more' : num(kids.length) + ' children');
        parts.push(' Together they had ' + (kids.length === 1 ? 'one known child' : num(kids.length) + ' known children') + (ys.length > 1 && d3.max(ys) > d3.min(ys) ? ' between ' + d3.min(ys) + ' and ' + d3.max(ys) : ys.length === 1 && kids.length === 1 ? ' in ' + ys[0] : '') + ': ', ...list, '.');
        kids.forEach(c => {
          if (!c.hidden) add(c.by, (c.sex === 'M' ? 'Son ' : c.sex === 'F' ? 'Daughter ' : 'Child ') + first(c) + ' is born');
          if (!c.hidden && c.dy != null && dy != null && c.dy < dy) { lostKids++; add(c.dy, first(c) + ' dies' + (c.by != null ? ', aged ' + (c.dy - c.by) : '')); }
        });
      }
      if (sp && !sp.hidden && sp.dy != null && dy != null && sp.dy < dy && (fam.my == null || sp.dy >= fam.my)) {
        add(sp.dy, first(sp) + ' dies');
        if (k === fams.length - 1 && dy - sp.dy >= 1) parts.push(' ' + first(sp) + ' died in ' + sp.dy + ', and ' + P.s + ' lived on for ' + num(dy - sp.dy) + ' more year' + (dy - sp.dy === 1 ? '' : 's') + '.');
      }
      if (parts.length) para(...parts);
    });
    if (!fams.length) para('No marriage or children are recorded for ' + P.o + ' in this file.');
    if (lostKids) para(cap(P.s) + ' outlived at least ' + num(lostKids) + ' of ' + P.p + ' children.');

    // death
    const rb = FO.region(p.b && p.b.place), rd = FO.region(p.d && p.d.place);
    if (dy != null || (p.d && p.d.place)) {
      const dw = [when(p.d), where(p.d)].filter(Boolean).join(' ');
      const age = by != null && dy != null && dy >= by ? ', aged ' + approx(p, dy) : '';
      para(first(p) + ' died ' + dw + age + '.' + (rb && rd && rb !== rd ? ' Born in ' + rb + ', ' + P.s + ' ended ' + P.p + ' days in ' + rd + '.' : ''));
      add(dy, 'Dies' + (p.d && p.d.place ? ' ' + where(p.d) : '') + (age ? age : ''), 'key');
    } else if (p.dead || !p.living) para('No death date is recorded for ' + P.o + '.');

    // legacy
    const de = FO.descent(p);
    const nDesc = de.min.size - 1;
    const tail = [];
    if (nDesc > kidsTotal && nDesc > 1) tail.push('This file follows ' + ui.fmt(nDesc) + ' of ' + P.p + ' descendants over ' + num(de.gens.length - 1) + ' generations.');
    if (p !== home) { const r = FO.relToHome(p); if (r) tail.push(cap(P.s) + (P.s === 'they' ? ' are ' : ' is ') + r + '.'); }
    if (tail.length) para(tail.join(' '));

    // context
    if (by != null) {
      const end = dy != null ? dy : by + 70;
      const regs = new Set([rb, rd].filter(Boolean));
      let n = 0;
      CONTEXT.forEach(([y, text, set]) => {
        if (y < by || y > end || n >= 5) return;
        if (set && ![...regs].some(r => set.has(r))) return;
        if (!set && !regs.size) return;
        tl.push({ y, text, cls: 'ctx', age: y - by }); n++;
      });
    }
    tl.sort((a, b) => a.y - b.y || (a.cls === 'key' && a.text.startsWith('Born') ? -1 : 0));
    return { paras, tl };
  }

  FO.view({
    id: 'story', order: 8, title: 'Life Story',
    card: 'One person’s life told in sentences, beside a timeline of their years.',
    how: {"see": "A short life story for one person, written from the dates, places and family links on record, beside a timeline of the dated events in their life.", "marks": ["Red dots on the timeline are the person’s own birth, marriages and death.", "Open dots are family events: a child born, a parent or partner dying.", "Small grey entries in italics are moments of history, shown only where the person lived in the region concerned."], "can": ["Type a name to choose whose story to read, or press Surprise me.", "Click any name in the story to read that person’s story instead.", "Open details for the full record, or make the person the home person."], "care": "The story says nothing the file does not say, and repeats the file’s mistakes if it has any. No story is written for someone who may be living."},
    blurb: 'A short account written from the dates and places on record: birth, parents, marriages, children, losses and death. It says nothing the file does not say.',
    icon: '<path d="M10 14 H34 M10 22 H30 M10 30 H34 M10 38 H26 M10 46 H32"/><path d="M46 10 V54"/><circle cx="46" cy="14" r="3.4" fill="#A35139" stroke="#A35139"/><circle cx="46" cy="30" r="3" fill="#fff"/><circle cx="46" cy="42" r="3" fill="#fff"/><circle cx="46" cy="54" r="3.4" fill="#1B2632"/>',
    render(v) {
      const s = v.state, data = v.data;
      v.stage.classList.add('scroll');
      const sheet = el('div', { class: 'sheet' });
      v.stage.append(sheet);
      const pool = data.people.filter(p => !p.hidden && p.by != null && p.dy != null && p.fams.length);
      const fallback = () => { // nearest ancestor with a full life on record
        if (!s.home.living && !s.home.hidden) return s.home;
        const q = [s.home.father, s.home.mother].filter(Boolean);
        while (q.length) { const x = q.shift(); if (!x.hidden && x.dy != null) return x; if (x.father) q.push(x.father); if (x.mother) q.push(x.mother); }
        return s.home;
      };
      let subject = s.subject && !s.subject.hidden ? s.subject : fallback();
      const pick = ui.picker('Whose story', subject, p => { subject = p; show(); });
      v.controls.append(pick, ui.button('Surprise me', () => { if (pool.length) { subject = pool[Math.floor(Math.random() * pool.length)]; show(); } }));
      function show() {
        s.subject = subject; pick.setPerson(subject);
        sheet.innerHTML = '';
        const t = tell(subject, s.home);
        const prose = el('div', { class: 'prose' }, el('h2', { text: subject.name }), el('p', { class: 'life' }, FO.lifespan(subject) || 'Dates unknown', '  ', ui.wt(subject)));
        t.paras.forEach(parts => {
          const p = el('p');
          parts.forEach(x => p.append(typeof x === 'string' ? x : ui.plink(x, q => { subject = q; show(); v.stage.scrollTop = 0; })));
          prose.append(p);
        });
        prose.append(el('p', { class: 'muted', style: { fontSize: '14px' }, text: 'Click any name to read that person’s story.' }),
          el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, ui.button('Open details', () => FO.select(subject)), subject !== s.home ? ui.button('Centre the views here', () => FO.setHome(subject)) : null));
        const tl = el('ol', { class: 'timeline' });
        t.tl.forEach(e => tl.append(el('li', { class: e.cls || '' }, el('b', { text: e.y }), e.text, e.age != null && e.age > 0 && e.cls !== 'ctx' && !e.text.startsWith('Dies') ? el('small', { text: '  age ' + e.age }) : null)));
        sheet.append(el('div', { class: 'story' }, prose, el('div', {}, el('h3', { text: 'Timeline', style: { marginBottom: '14px' } }), t.tl.length ? tl : el('p', { class: 'muted', text: 'No dated events are recorded.' }))));
      }
      show();
      return () => {};
    }
  });
})();
