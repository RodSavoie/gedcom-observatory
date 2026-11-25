/* Family Observatory: load a family straight from WikiTree.
   A visitor types a WikiTree ID; the tree is fetched from the WikiTree API, turned into the same
   GEDCOM text a file would give, and handed to the normal loader, so every view works unchanged.

   WikiTree's rules for outside sites (Help:App Policies) are followed: only what WikiTree shows
   publicly is fetched, biographies and photos are never requested, and nothing is cached or kept
   beyond the open page. Requests carry the appId "FamilyObservatory".

   The browser asks WikiTree directly when WikiTree allows it; otherwise it goes through the small
   relay wikitree.php on this site, which passes the same questions on and keeps nothing. */
(function () {
  'use strict';
  const FO = window.FO;
  const T = FO.T || ((s, v) => v ? s.replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m) : s);   // in Node (tools/test-wikitree.js) the words stay in English
  const API = 'https://api.wikitree.com/api.php';
  const RELAY = 'wikitree.php';
  const APP_ID = 'FamilyObservatory';
  const FIELDS = 'Id,Name,FirstName,MiddleName,RealName,LastNameAtBirth,LastNameCurrent,Gender,' +
    'BirthDate,DeathDate,BirthLocation,DeathLocation,Father,Mother,Spouses,IsLiving,DataStatus';
  const PAGE = 1000;                 // WikiTree's largest page of relatives
  const MAX = { anc: 20, desc: 10 }; // what the form offers (WikiTree allows 25 and 10)
  const DEF = { anc: 12, desc: 2 };   // first-visit defaults; brothers and sisters are on
  let route = null;                  // 'direct' once WikiTree has answered the browser, 'relay' otherwise

  /* ---------- talking to WikiTree ---------- */
  /* Can this browser ask WikiTree directly? Found out once per visit with the smallest possible
     question (one field of one profile), so a refused attempt never costs WikiTree a full tree. */
  async function probe(key) {
    try {
      const r = await fetch(API, { method: 'POST', credentials: 'omit', body: new URLSearchParams({ action: 'getProfile', key: String(key).split(',')[0], fields: 'Id', appId: APP_ID }) });
      if (!r.ok) return 'relay';
      const j = await r.json();
      return Array.isArray(j) && j[0] && typeof j[0] === 'object' ? 'direct' : 'relay';
    } catch (e) { return 'relay'; }
  }

  async function call(params) {
    const body = () => new URLSearchParams(Object.assign({ appId: APP_ID }, params));
    if (route == null) route = await probe(params.keys || 'Savoie-2387');
    if (route === 'direct') {
      try {
        const r = await fetch(API, { method: 'POST', body: body(), credentials: 'omit' });
        if (r.status === 429) throw new Error(busy());
        if (r.ok) {
          const j = await r.json();
          const o = Array.isArray(j) ? j[0] : j;
          if (o && typeof o === 'object' && (o.people || o.resultByKey || o.status)) return j;
        }
        route = 'relay';   // an odd answer: carry on through the relay
      } catch (e) {
        if (e.message === busy()) throw e;
        route = 'relay';   // refused by the browser after all: carry on through the relay
      }
    }
    let r;
    try { r = await fetch(RELAY, { method: 'POST', body: body(), headers: { Accept: 'application/json' } }); }
    catch (e) { throw new Error(T('WikiTree could not be reached. Please check the connection and try again.')); }
    if (r.status === 404 || r.status === 501) throw new Error(T('This copy of the site cannot reach WikiTree: its helper (wikitree.php) needs a web host that runs PHP.'));
    let j = null;
    try { j = await r.json(); } catch (e) { /* not JSON */ }
    if (!r.ok) throw new Error((j && j.error) || (r.status === 429 ? busy() : T('WikiTree could not be reached ({status}).', { status: r.status })));
    if (!j) throw new Error(T('WikiTree sent an answer that could not be read. It may be busy; please try again shortly.'));
    return j;
  }
  const busy = () => T('WikiTree is limiting how fast it answers. Please wait a minute and try again.');

  function unwrap(res) {
    const o = Array.isArray(res) ? res[0] : res;
    if (!o || typeof o !== 'object') throw new Error(T('WikiTree sent an empty answer.'));
    const st = typeof o.status === 'string' ? o.status.trim() : '';
    // "Maximum number of profiles (1025) reached" only means there are more pages to fetch
    if (/maximum number of profiles/i.test(st)) o.more = true;
    else if (st) throw new Error(T('WikiTree says: {st}', { st: st }));
    return o;
  }

  /* Private profiles arrive as stand-ins with negative ids. The numbering holds across all the pages
     of one question but starts again with the next question (-1 can be a mother in one and a grandchild
     in another), so each question's stand-ins get their own names, such as "s3_1". Real profiles keep
     their WikiTree number. */
  let callNo = 0;
  const idOf = (x, n) => { const v = +x; return v > 0 ? v : v < 0 ? 's' + n + '_' + (-v) : 0; };
  function normalise(list, n) {
    return list.map(p => Object.assign({}, p, { Id: idOf(p.Id, n), Father: idOf(p.Father, n), Mother: idOf(p.Mother, n) }));
  }

  /* One getPeople question, page by page; returns the people (ids normalised) and the key's own id */
  async function ask(key, anc, desc, progress, seen, sib) {
    let rootId = null; const out = [];
    const n = ++callNo;   // one namespace for the whole question
    for (let page = 0, start = 0; page < 60; page++, start += PAGE) {
      const q = { action: 'getPeople', keys: key, ancestors: anc, descendants: desc, fields: FIELDS, limit: PAGE, start };
      if (sib) q.siblings = 1;   // with ancestors, WikiTree adds the brothers and sisters of every ancestor
      const o = unwrap(await call(q));
      const rk = o.resultByKey ? Object.values(o.resultByKey)[0] : null;
      if (rk && rk.status) throw new Error(/illegal|invalid|not found|no profile/i.test(rk.status) ? T('WikiTree does not recognise {key}. Check the ID, for example Savoie-2387.', { key: key }) : T('WikiTree says: {status}', { status: rk.status }));
      if (rootId == null && rk && rk.Id) rootId = +rk.Id;
      const list = normalise(Object.values(o.people || {}).filter(p => p && p.Id != null), n);
      let fresh = 0;
      for (const p of list) if (!seen.has(p.Id)) { seen.add(p.Id); fresh++; }
      out.push(...list);
      progress(seen.size);
      if ((!o.more && list.length < PAGE) || !fresh) break;
      out.paged = true;   // more than one page: stand-in numbers may not agree from page to page (see repairParents)
    }
    return { list: out, rootId };
  }

  /* WikiTree numbers its private stand-ins page by page, not across the whole answer: in a large answer, -2 can be one
     person on the first page and someone else on the last (seen 2026-11-22: a mother's brothers and sisters, on the last
     page, pointed at the stand-ins that the first page used for the starting person's own parents, so they were filed
     as that person's brothers and sisters). So anyone with a WikiTree number whose father or mother came back as a
     stand-in is asked about once more, by number, in small groups; WikiTree then gives the parents' real numbers. */
  async function repairParents(people, progress, paged) {
    const ids = [...people.values()].filter(p => typeof p.Id === 'number' && paged.has(p.Id) && (typeof p.Father === 'string' || typeof p.Mother === 'string')).map(p => p.Id);
    if (!ids.length) return;
    if (progress && progress.stage) progress.stage(T('Checking the parents of private profiles…'));
    for (let i = 0; i < ids.length; i += 100) {
      let o;
      try { o = unwrap(await call({ action: 'getPeople', keys: ids.slice(i, i + 100).join(','), ancestors: 0, descendants: 0, fields: 'Id,Father,Mother', limit: PAGE, start: 0 })); }
      catch (e) { if (e.message === busy()) throw e; continue; }   // a refused group keeps what the first answer said
      for (const q of Object.values(o.people || {})) {
        const p = people.get(+q.Id);
        if (!p) continue;
        for (const k of ['Father', 'Mother']) {
          const v = +q[k];
          if (typeof p[k] === 'string' && v > 0 && people.has(v)) p[k] = v;   // a real number for someone already in the tree
        }
      }
    }
  }

  /* Husbands and wives that came along inside each person's spouse list, added as people */
  function addSpouses(people, ids) {
    for (const id of ids) {
      const p = people.get(id);
      if (!p) continue;
      for (const s of spousesOf(p)) {
        if (people.has(s.id)) continue;
        const q = s.profile;
        if (q && (q.Name || q.FirstName || q.LastNameAtBirth)) people.set(s.id, Object.assign({}, q, { Id: s.id, Spouses: undefined, Father: idOf(q.Father, 0), Mother: idOf(q.Mother, 0) }));
      }
    }
  }

  /* All the people in the tree: the starting profile and its ancestors; then, if asked, its
     descendants with their husbands and wives, so families are whole. */
  async function fetchTree(key, anc, desc, sib, progress) {
    const people = new Map(), seen = new Set();
    const paged = new Set(), note = ans => { if (ans.list.paged) ans.list.forEach(p => paged.add(p.Id)); return ans; };   // see repairParents
    if (sib) progress.stage(T('Asking WikiTree for {key}, with brothers and sisters…', { key: key }));
    const a = note(await ask(key, anc, 0, progress, seen, sib));
    const rootId = a.rootId;
    let list = a.list;
    // The siblings query can represent a public ancestor as a private stand-in even when that
    // stand-in is present and fully linked. Missing-record checks cannot detect this. Always use
    // the ancestor-only answer for the direct line, and align the siblings' parent links to it.
    // Give this query its own seen set so overlap with the siblings does not stop pagination.
    if (sib && anc > 0) {
      progress.stage(T('Checking the direct ancestor line.'));
      const b = note(await ask(key, anc, 0, () => {}, new Set(), false));
      list = merge(b.list, list);
    }
    // In large answers WikiTree can leave out a private stand-in that others still point to (seen with
    // and without brothers and sisters). A close-up of 6 generations (one page) can fill gaps
    // near the starting profile. Align its stand-ins with those in the larger answer.
    if (dangling(list).length && anc > 0) {
      progress.stage(T('Filling in private profiles…'));
      const c = note(await ask(key, Math.min(anc, 6), 0, () => {}, new Set(), false));   // its own count, so its pages are not cut short
      list = merge(c.list, list);
    }
    for (const p of list) if (!people.has(p.Id)) people.set(p.Id, p);
    if (rootId == null || !people.has(rootId)) throw new Error(T('WikiTree did not send a profile for {key}. Check the ID, for example Savoie-2387.', { key: key }));
    await repairParents(people, progress, paged);

    // the husbands and wives of the brothers and sisters (and later marriages of ancestors) come inside each spouse list
    if (sib) addSpouses(people, [...people.keys()]);

    if (desc > 0) {
      progress.stage(T('Adding descendants…'));
      const d = await ask(key, 0, desc, progress, seen);
      const ids = new Set(d.list.map(p => p.Id));
      // a living starting person comes back as a stand-in in this answer: the one person whose parents are not in it
      let alias = null;
      if (!ids.has(rootId)) {
        const tops = d.list.filter(p => !ids.has(p.Father) && !ids.has(p.Mother));
        if (tops.length === 1) alias = tops[0].Id;
      }
      for (const p of d.list) {
        if (p.Id === alias || p.Id === rootId) continue;
        if (alias != null) { if (p.Father === alias) p.Father = rootId; if (p.Mother === alias) p.Mother = rootId; }
        if (!people.has(p.Id)) people.set(p.Id, p);
      }
      const line = descendantsOf(people, rootId);
      const want = new Set();
      for (const id of line) {
        const p = people.get(id);
        for (const s of spousesOf(p)) {
          if (people.has(s.id)) continue;
          const q = s.profile;
          if (q && (q.Name || q.FirstName || q.LastNameAtBirth)) people.set(s.id, Object.assign({}, q, { Id: s.id, Spouses: undefined, Father: idOf(q.Father, 0), Mother: idOf(q.Mother, 0) }));
          else want.add(s.id);
        }
        if (id !== rootId) for (const par of [p.Father, p.Mother]) {
          if (typeof par === 'number' && par > 0 && !people.has(par)) want.add(par);
          else if (typeof par === 'string' && !people.has(par)) people.set(par, { Id: par, Father: 0, Mother: 0 });   // a private partner, kept as an unnamed stand-in
        }
      }
      const more = [...want];
      for (let i = 0; i < more.length && i < 3000; i += 100) {
        const n = ++callNo;
        const o = unwrap(await call({ action: 'getPeople', keys: more.slice(i, i + 100).join(','), fields: FIELDS }));
        for (const p of normalise(Object.values(o.people || {}).filter(p => p && p.Id != null), n)) if (!people.has(p.Id)) people.set(p.Id, p);
        progress(people.size);
      }
    }
    // anyone still pointed to but never sent becomes an unnamed private box, so the line is not cut
    for (const p of [...people.values()]) for (const par of [p.Father, p.Mother]) if (typeof par === 'string' && !people.has(par)) people.set(par, { Id: par, Father: 0, Mother: 0 });
    return { people, rootId };
  }

  function dangling(list) {
    const ids = new Set(list.map(p => p.Id));
    return list.filter(p => [p.Father, p.Mother].some(x => typeof x === 'string' && !ids.has(x)));
  }

  /* Line up two answers about the same tree: the direct line (base) and the larger one (extra).
     Stand-ins in the larger answer are matched to the base's through the real people both contain
     (the same real child has the same private mother), then up through the matched stand-ins'
     own parents. Unmatched stand-ins (living brothers and sisters) are added as they are. */
  function merge(base, extra) {
    const B = new Map(base.map(p => [p.Id, p])), X = new Map(extra.map(p => [p.Id, p]));
    const map = new Map();
    const align = (x, y) => {
      if (typeof x !== 'string' || !y || map.has(x)) return;
      map.set(x, y);
      const px = X.get(x), py = B.get(y);
      if (px && py) { align(px.Father, py.Father); align(px.Mother, py.Mother); }
    };
    for (const p of extra) if (typeof p.Id === 'number' && B.has(p.Id)) { const q = B.get(p.Id); align(p.Father, q.Father); align(p.Mother, q.Mother); }
    const m = x => map.has(x) ? map.get(x) : x;
    const out = base.slice(), have = new Set(B.keys());
    for (const p of extra) {
      const id = m(p.Id);
      if (have.has(id)) continue;
      have.add(id);
      out.push(Object.assign({}, p, { Id: id, Father: m(p.Father), Mother: m(p.Mother) }));
    }
    return out;
  }

  function descendantsOf(people, rootId) {
    const kids = new Map();
    for (const p of people.values()) for (const par of [p.Father, p.Mother]) if (par) { if (!kids.has(par)) kids.set(par, []); kids.get(par).push(p.Id); }
    const seen = new Set([rootId]), todo = [rootId];
    while (todo.length) for (const c of kids.get(todo.pop()) || []) if (!seen.has(c)) { seen.add(c); todo.push(c); }
    return seen;
  }

  /* Spouses arrive as an object or a list of spouse entries; each may carry the marriage date and place. */
  function spousesOf(p) {
    const raw = p && p.Spouses;
    if (!raw || typeof raw !== 'object') return [];
    const list = Array.isArray(raw) ? raw : Object.keys(raw).map(k => Object.assign({ Id: +k }, typeof raw[k] === 'object' ? raw[k] : {}));
    return list.filter(s => s && !(s.do_not_display === 1 || s.do_not_display === '1' || s.DoNotDisplay === '1')).map(s => ({
      id: +(s.Id != null ? s.Id : s.id),
      date: s.marriage_date || s.MarriageDate || '',
      place: s.marriage_location || s.MarriageLocation || '',
      status: (s.data_status && s.data_status.marriage_date) || (s.DataStatus && s.DataStatus.MarriageDate) || '',
      profile: s
    })).filter(s => s.id > 0);
  }

  /* ---------- WikiTree profiles to GEDCOM ---------- */
  const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const QUAL = { guess: 'ABT ', before: 'BEF ', after: 'AFT ' };
  function gedDate(ymd, status) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''));
    if (!m || +m[1] === 0) return '';
    const y = +m[1], mo = +m[2], d = +m[3];
    const core = (mo >= 1 && mo <= 12 ? (d >= 1 && d <= 31 ? d + ' ' : '') + MON[mo - 1] + ' ' : '') + y;
    return (QUAL[status] || '') + core;
  }
  const one = s => String(s == null ? '' : s).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const status = (p, k) => (p.DataStatus && typeof p.DataStatus === 'object' ? p.DataStatus[k] : '') || '';

  FO.wikitreeToGedcom = function (people, rootId, title, opts) {
    opts = opts || {};
    const out = ['0 HEAD', '1 SOUR FamilyObservatory', '2 NAME Family Observatory (from WikiTree)', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
    if (title) out.push('1 _TITLE ' + one(title));
    const ids = [rootId, ...[...people.keys()].filter(id => id !== rootId)];

    // families: one for each father and mother pair seen on a child, plus couples with no children here
    const fams = new Map(), famOf = new Map(), famsOf = new Map();
    const fam = (h, w) => {
      const key = (h || 0) + '|' + (w || 0);
      if (!fams.has(key)) {
        const f = { id: '@F' + (fams.size + 1) + '@', h, w, kids: [], m: null };
        fams.set(key, f);
        for (const x of [h, w]) if (x) { if (!famsOf.has(x)) famsOf.set(x, []); famsOf.get(x).push(f.id); }
      }
      return fams.get(key);
    };
    // private profiles are stand-ins (ids such as "s3_1"), still linked to their parents
    const has = id => !!id && people.has(id);
    const xref = id => '@I' + String(id).replace(/[^A-Za-z0-9]/g, '') + '@';
    const role = new Map();
    for (const p of people.values()) { if (has(p.Father)) role.set(p.Father, 'M'); if (has(p.Mother)) role.set(p.Mother, 'F'); }
    for (const id of ids) {
      const p = people.get(id);
      const fa = has(p.Father) ? p.Father : 0, mo = has(p.Mother) ? p.Mother : 0;
      if (fa || mo) { const f = fam(fa, mo); f.kids.push(id); famOf.set(id, f.id); }
    }
    for (const id of ids) {
      const p = people.get(id);
      for (const s of spousesOf(p)) {
        if (!has(s.id)) continue;
        const q = people.get(s.id);
        const male = x => /^m/i.test(x.Gender || '');
        const [h, w] = male(p) || (!male(q) && String(id) < String(s.id)) ? [id, s.id] : [s.id, id];
        const f = fams.get(h + '|' + w) || fams.get(w + '|' + h) || fam(h, w);
        if (!f.m && (gedDate(s.date) || one(s.place))) f.m = { date: gedDate(s.date, s.status), place: one(s.place) };
      }
    }

    for (const id of ids) {
      const p = people.get(id);
      const given = typeof id === 'string' ? '' : one([p.FirstName || p.RealName, p.MiddleName].filter(Boolean).join(' '));
      const surname = one(p.LastNameAtBirth || p.LastNameCurrent).replace(/\//g, '');
      out.push('0 ' + xref(id) + ' INDI', '1 NAME ' + given.replace(/\//g, '') + ' /' + surname + '/');
      out.push('1 SEX ' + (/^m/i.test(p.Gender || '') ? 'M' : /^f/i.test(p.Gender || '') ? 'F' : role.get(id) || 'U'));
      const bd = gedDate(p.BirthDate, status(p, 'BirthDate')), bp = one(p.BirthLocation);
      if (bd || bp) { out.push('1 BIRT'); if (bd) out.push('2 DATE ' + bd); if (bp) out.push('2 PLAC ' + bp); }
      const dd = gedDate(p.DeathDate, status(p, 'DeathDate')), dp = one(p.DeathLocation);
      if (dd || dp) { out.push('1 DEAT'); if (dd) out.push('2 DATE ' + dd); if (dp) out.push('2 PLAC ' + dp); }
      if (p.Name) out.push('1 WWW https://www.WikiTree.com/wiki/' + encodeURI(String(p.Name)));
      if (id === rootId) out.push('1 _HOME Y');
      if (typeof id === 'string') out.push('1 _PRIVATE Y');   // a WikiTree stand-in: WikiTree keeps this person private
      // WikiTree decides who counts as living; its answer is followed in both directions
      if (p.IsLiving === 1 || p.IsLiving === '1') out.push('1 _LIVING Y');
      else if (p.IsLiving === 0 || p.IsLiving === '0') out.push('1 _LIVING N');
      if (famOf.has(id)) out.push('1 FAMC ' + famOf.get(id));
      for (const f of famsOf.get(id) || []) out.push('1 FAMS ' + f);
    }
    /* Which families came with all their children? With brothers and sisters, the family each person on
       the direct line was born into; and the families of the starting person and of descendants above the
       last fetched generation. Any other family holds only the children who reached the tree another way
       (often by marrying into it), so it is marked partial and left out of family-size figures. */
    const line = new Set([rootId]); { const todo = [rootId]; while (todo.length) { const p = people.get(todo.pop()); for (const x of [p && p.Father, p && p.Mother]) if (has(x) && !line.has(x)) { line.add(x); todo.push(x); } } }
    const depth = new Map([[rootId, 0]]); { const todo = [rootId]; while (todo.length) { const id = todo.shift(); for (const f of famsOf.get(id) || []) { const fam = [...fams.values()].find(x => x.id === f); for (const k of fam.kids) if (!depth.has(k)) { depth.set(k, depth.get(id) + 1); todo.push(k); } } } }
    const complete = f => (opts.sib && f.kids.some(k => line.has(k))) || [f.h, f.w].some(x => x && depth.has(x) && depth.get(x) < (opts.desc || 0));
    for (const f of fams.values()) {
      out.push('0 ' + f.id + ' FAM');
      if (f.kids.length && !complete(f)) out.push('1 _PARTIAL Y');
      if (f.h) out.push('1 HUSB ' + xref(f.h));
      if (f.w) out.push('1 WIFE ' + xref(f.w));
      for (const k of f.kids) out.push('1 CHIL ' + xref(k));
      if (f.m) { out.push('1 MARR'); if (f.m.date) out.push('2 DATE ' + f.m.date); if (f.m.place) out.push('2 PLAC ' + f.m.place); }
    }
    out.push('0 TRLR', '');
    return out.join('\n');
  };

  /* "Savoie-2387", "savoie 2387" or a pasted profile address -> "Savoie-2387" */
  FO.wikitreeKey = function (s) {
    let t = String(s || '').trim();
    const u = /wikitree\.com\/(?:wiki|genealogy)\/(?:[^/]*\/)?([^?#/\s]+)/i.exec(t);
    if (u) t = decodeURIComponent(u[1]);
    t = t.replace(/^Profile:/i, '').replace(/[\s_]+(?=\d+$)/, '-').replace(/\s+/g, '_');
    if (!/^[^\s,/?#]+-\d+$/.test(t)) return null;
    return t.charAt(0).toUpperCase() + t.slice(1);
  };

  function familyTitle(people, rootId) {
    const p = people.get(rootId), m = p && typeof p.Mother === 'number' && p.Mother > 0 ? people.get(p.Mother) : null;
    const a = p ? one(p.LastNameAtBirth || p.LastNameCurrent) : '', b = m ? one(m.LastNameAtBirth || m.LastNameCurrent) : '';
    return a ? T('The {a}{x} family', { a: a, x: b && b.toLowerCase() !== a.toLowerCase() ? '/' + b : '' }) : T('A WikiTree family');
  }

  /* ---------- loading ---------- */
  /* While WikiTree is being asked, the page fades behind a small card that counts people as they
     arrive. The header stays clear, so the panel and its messages remain readable. */
  let waitEl = null;
  function waiting(on, line) {
    if (!waitEl) {
      const el = FO.ui.el;
      waitEl = el('div', { class: 'wt-wait', role: 'status', 'aria-live': 'polite' },
        el('div', { class: 'wt-wait-card' }, el('div', { class: 'wt-spin', 'aria-hidden': 'true' }),
          el('div', { class: 'caps', text: T('From WikiTree') }), el('p', { class: 'wt-wait-line' })));
      document.body.append(waitEl);
    }
    if (line != null) waitEl.querySelector('.wt-wait-line').textContent = line;
    waitEl.classList.toggle('on', !!on);
  }

  let busyNow = false;
  FO.loadWikiTree = async function (input, anc, desc, progress, sib) {
    const key = FO.wikitreeKey(input);
    if (!key) throw new Error(T('Please enter a WikiTree ID, such as Savoie-2387.'));
    if (busyNow) throw new Error(T('A tree is already being fetched.'));
    busyNow = true;
    try {
      sib = sib !== false;
      anc = Math.max(0, Math.min(MAX.anc, Math.round(+anc) || 0));
      desc = Math.max(0, Math.min(MAX.desc, Math.round(+desc) || 0));
      let stage = T('Asking WikiTree for {key}…', { key: key });
      waiting(true, stage);
      const tick = n => { const line = T('{stage} {n} people so far.', { stage: stage, n: FO.ui.fmt(n) }); waiting(true, line); if (progress) progress(n, line); };
      tick.stage = t => { stage = t; };
      const { people, rootId } = await fetchTree(key, anc, desc, sib, tick);
      waiting(true, T('Drawing {size} people…', { size: FO.ui.fmt(people.size) }));
      await new Promise(r => setTimeout(r, 30));   // let the card show before the drawing starts
      const title = familyTitle(people, rootId);
      const text = FO.wikitreeToGedcom(people, rootId, title, { sib, desc });
      const root = people.get(rootId);
      if (!FO.loadText(text, title, 'wikitree')) throw new Error(T('WikiTree sent no people that could be drawn.'));
      FO.state.wikitree = { key: root && root.Name || key, anc, desc, sib };
      return { count: people.size, key: root && root.Name || key };
    } finally { busyNow = false; waiting(false); }
  };

  /* ---------- families drawn before ----------
     Kept in this browser only: the WikiTree ID and the choices used with it, never names or anything
     else WikiTree sent (WikiTree asks outside sites not to keep its data). Shown most-used first. */
  const RECENT = 12, SHOW = 6;
  function recents() { const r = FO.prefs.get('wt.recent', []); return Array.isArray(r) ? r.filter(x => x && typeof x.id === 'string') : []; }
  function remember(id, anc, desc, sib) {
    const all = recents(), old = all.find(x => x.id.toLowerCase() === id.toLowerCase());
    const rest = all.filter(x => x !== old);
    FO.prefs.set('wt.recent', [{ id, a: +anc, d: +desc, s: sib ? 1 : 0, n: (old ? old.n || 0 : 0) + 1, t: Date.now() }, ...rest].slice(0, RECENT));
  }
  function forget(id) { FO.prefs.set('wt.recent', recents().filter(x => x.id !== id)); }
  const ranked = () => recents().slice().sort((a, b) => (b.n - a.n) || (b.t - a.t));

  /* ---------- the "From WikiTree" panel ---------- */
  function buildPanel(menu) {
    const ui = FO.ui, el = ui.el;
    const opts = (from, to, sel, word) => {
      const s = el('select');
      for (let i = from; i <= to; i++) s.append(el('option', { value: i, text: i === 0 ? T('None') : (i === 1 ? T('{n} generation', { n: i }) : T('{n} generations', { n: i })), selected: i === sel ? 'selected' : null }));
      return s;
    };
    const id = el('input', { type: 'text', placeholder: T('e.g. Savoie-2387'), autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', list: 'wt-ids', 'aria-label': T('WikiTree ID'), value: FO.prefs.get('wt.id', '') });
    const ids = el('datalist', { id: 'wt-ids' });
    const used = el('div', { class: 'wt-recent' });
    const anc = opts(1, MAX.anc, FO.prefs.num('wt.anc', DEF.anc, 1, MAX.anc), 'generation');
    const desc = opts(0, MAX.desc, FO.prefs.num('wt.desc', DEF.desc, 0, MAX.desc), 'generation');
    const sib = el('input', { type: 'checkbox' });
    sib.checked = FO.prefs.get('wt.sib', 1, [0, 1]) === 1;
    const msg = el('p', { class: 'wt-msg', role: 'status' });
    const go = el('button', { type: 'submit', class: 'pill small', text: T('Draw this family') });
    const form = el('form', { class: 'wt-form' },
      el('label', {}, el('span', { text: T('WikiTree ID') }), id), ids, used,
      el('div', { class: 'wt-row' },
        el('label', {}, el('span', { text: T('Ancestors') }), anc),
        el('label', {}, el('span', { text: T('Descendants') }), desc)),
      el('label', { class: 'wt-check' }, sib, el('span', { text: T('Brothers and sisters of each ancestor, with their husbands and wives') })),
      el('div', { class: 'row' }, go), msg);
    // the "Used before" chips: one click draws that family again with the choices used last time
    const showUsed = () => {
      const list = ranked();
      ids.innerHTML = '';
      list.forEach(x => ids.append(el('option', { value: x.id })));
      used.innerHTML = '';
      if (!list.length) return;
      used.append(el('small', { text: T('Used before') }));
      list.slice(0, SHOW).forEach(x => {
        const what = T('{x} generations of ancestors, {x2}{x3}', { x: x.a || DEF.anc, x2: x.d ? T('{d} of descendants', { d: x.d }) : T('no descendants'), x3: x.s ? T(', with brothers and sisters') : '' });
        used.append(el('span', { class: 'namechip' },
          el('button', { type: 'button', class: 'go', text: x.id, title: T('Draw {id} again: {what}', { id: x.id, what: what }), onclick: () => {
            id.value = x.id; anc.value = x.a || DEF.anc; desc.value = x.d || 0; sib.checked = !!x.s; form.requestSubmit();
          } }),
          el('button', { type: 'button', class: 'x', text: '×', title: T('Forget {id}', { id: x.id }), 'aria-label': T('Forget {id}', { id: x.id }), onclick: () => { forget(x.id); showUsed(); } })));
      });
    };
    showUsed();

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const key = FO.wikitreeKey(id.value);
      if (!key) { msg.textContent = T('Please enter a WikiTree ID, such as Savoie-2387, or paste a profile address.'); id.focus(); return; }
      FO.prefs.set('wt.id', key); FO.prefs.set('wt.anc', +anc.value); FO.prefs.set('wt.desc', +desc.value); FO.prefs.set('wt.sib', sib.checked ? 1 : 0);
      go.disabled = true; msg.textContent = T('Asking WikiTree for {key}…', { key: key });
      try {
        const r = await FO.loadWikiTree(key, anc.value, desc.value, (n, line) => { msg.textContent = line; }, sib.checked);
        msg.textContent = '';
        remember(r.key, anc.value, desc.value, sib.checked); showUsed();
        FO.closeMenus();
        ui.toast(T('Loaded {count} people from WikiTree, starting from {key}. Nothing is stored.', { count: ui.fmt(r.count), key: r.key }));
      } catch (err) {
        msg.textContent = err.message || String(err);
      } finally { go.disabled = false; }
    });
    menu.append(
      el('div', { class: 'caps', text: T('From WikiTree') }),
      el('h3', { text: T('Draw any family on WikiTree') }),
      el('p', { class: 'muted', text: T('Type a WikiTree ID, or paste the address of a profile, and choose how far to go. Descendants and brothers and sisters make trees much larger: the more you ask for, the longer WikiTree takes to answer.') }),
      form,
      el('p', { class: 'muted small-print', text: T('Only what WikiTree shows to everyone is fetched, and people who may be living stay hidden. Nothing is stored: the tree is kept only while this page is open, and this browser remembers only the IDs you used and your choices. Data from WikiTree.com, shared by its community of genealogists.') }));
    return { id, anc, desc, form, showUsed };
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('wt-btn'), menu = document.getElementById('menu-wt');
    if (!btn || !menu) return;
    const panel = buildPanel(menu);
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = !menu.classList.contains('open');
      FO.closeMenus();
      if (open) { menu.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); setTimeout(() => panel.id.focus(), 0); }
    });
    menu.addEventListener('click', e => e.stopPropagation());

    // a link such as index.html?wt=Savoie-2387&anc=10&desc=1 opens straight on that family
    const q = new URLSearchParams(location.search);
    if (q.get('wt')) {
      const key = FO.wikitreeKey(q.get('wt'));
      if (key) {
        FO.loadWikiTree(key, q.get('anc') || DEF.anc, q.get('desc') || DEF.desc, null, q.get('sib') !== '0')
          .then(r => { remember(r.key, FO.state.wikitree.anc, FO.state.wikitree.desc, FO.state.wikitree.sib); panel.showUsed(); FO.ui.toast(T('Loaded {count} people from WikiTree, starting from {key}. Nothing is stored.', { count: FO.ui.fmt(r.count), key: r.key })); })
          .catch(err => FO.ui.toast(err.message || String(err)));
      }
    }
  });
})();
