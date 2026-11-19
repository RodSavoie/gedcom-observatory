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
  const API = 'https://api.wikitree.com/api.php';
  const RELAY = 'wikitree.php';
  const APP_ID = 'FamilyObservatory';
  const FIELDS = 'Id,Name,FirstName,MiddleName,RealName,LastNameAtBirth,LastNameCurrent,Gender,' +
    'BirthDate,DeathDate,BirthLocation,DeathLocation,Father,Mother,Spouses,IsLiving,DataStatus';
  const PAGE = 1000;                 // WikiTree's largest page of relatives
  const MAX = { anc: 20, desc: 10 }; // what the form offers (WikiTree allows 25 and 10)
  let route = null;                  // 'direct' once WikiTree has answered the browser, 'relay' otherwise

  /* ---------- talking to WikiTree ---------- */
  async function call(params) {
    const body = () => new URLSearchParams(Object.assign({ appId: APP_ID }, params));
    if (route !== 'relay') {
      try {
        const r = await fetch(API, { method: 'POST', body: body(), credentials: 'omit' });
        if (r.ok) {
          const j = await r.json();
          const o = Array.isArray(j) ? j[0] : j;
          if (o && typeof o === 'object' && (o.people || o.resultByKey)) { route = 'direct'; return j; }
          if (route === 'direct') throw new Error('WikiTree sent an answer that could not be read.');
        }
        if (route === 'direct') throw new Error(r.status === 429 ? busy() : 'WikiTree answered with an error (' + r.status + ').');
      } catch (e) {
        if (route === 'direct') throw e;
      }
      route = 'relay';
    }
    let r;
    try { r = await fetch(RELAY, { method: 'POST', body: body(), headers: { Accept: 'application/json' } }); }
    catch (e) { throw new Error('WikiTree could not be reached. Please check the connection and try again.'); }
    if (r.status === 404 || r.status === 501) throw new Error('This copy of the site cannot reach WikiTree: its helper (wikitree.php) needs a web host that runs PHP.');
    let j = null;
    try { j = await r.json(); } catch (e) { /* not JSON */ }
    if (!r.ok) throw new Error((j && j.error) || (r.status === 429 ? busy() : 'WikiTree could not be reached (' + r.status + ').'));
    if (!j) throw new Error('WikiTree sent an answer that could not be read. It may be busy; please try again shortly.');
    return j;
  }
  const busy = () => 'WikiTree is limiting how fast it answers. Please wait a minute and try again.';

  function unwrap(res) {
    const o = Array.isArray(res) ? res[0] : res;
    if (!o || typeof o !== 'object') throw new Error('WikiTree sent an empty answer.');
    const st = typeof o.status === 'string' ? o.status.trim() : '';
    // "Maximum number of profiles (1025) reached" only means there are more pages to fetch
    if (/maximum number of profiles/i.test(st)) o.more = true;
    else if (st) throw new Error('WikiTree says: ' + st);
    return o;
  }

  /* Private profiles arrive as stand-ins with negative ids, numbered afresh in every answer
     (-1 can be a mother in one answer and a grandchild in the next), so each answer's stand-ins get
     their own names, such as "s3_1". Real profiles keep their WikiTree number. */
  let callNo = 0;
  const idOf = (x, n) => { const v = +x; return v > 0 ? v : v < 0 ? 's' + n + '_' + (-v) : 0; };
  function normalise(list, n) {
    return list.map(p => Object.assign({}, p, { Id: idOf(p.Id, n), Father: idOf(p.Father, n), Mother: idOf(p.Mother, n) }));
  }

  /* One getPeople question, page by page; returns the people (ids normalised) and the key's own id */
  async function ask(key, anc, desc, progress, seen) {
    let rootId = null; const out = [];
    for (let page = 0, start = 0; page < 60; page++, start += PAGE) {
      const n = ++callNo;
      const o = unwrap(await call({ action: 'getPeople', keys: key, ancestors: anc, descendants: desc, fields: FIELDS, limit: PAGE, start }));
      const rk = o.resultByKey ? Object.values(o.resultByKey)[0] : null;
      if (rk && rk.status) throw new Error(/illegal|invalid|not found|no profile/i.test(rk.status) ? 'WikiTree does not recognise ' + key + '. Check the ID, for example Savoie-2387.' : 'WikiTree says: ' + rk.status);
      if (rootId == null && rk && rk.Id) rootId = +rk.Id;
      const list = normalise(Object.values(o.people || {}).filter(p => p && p.Id != null), n);
      let fresh = 0;
      for (const p of list) if (!seen.has(p.Id)) { seen.add(p.Id); fresh++; }
      out.push(...list);
      progress(seen.size);
      if ((!o.more && list.length < PAGE) || !fresh) break;
    }
    return { list: out, rootId };
  }

  /* The brothers and sisters of many people at once, 50 per question (WikiTree takes up to 100 when
     relatives are asked for), page by page */
  async function siblingsOf(ids, people, progress) {
    for (let i = 0; i < ids.length; i += 50) {
      const keys = ids.slice(i, i + 50).join(',');
      for (let page = 0, start = 0; page < 20; page++, start += PAGE) {
        const n = ++callNo;
        const o = unwrap(await call({ action: 'getPeople', keys, siblings: 1, fields: FIELDS, limit: PAGE, start }));
        const list = normalise(Object.values(o.people || {}).filter(p => p && p.Id != null), n);
        let fresh = 0;
        for (const p of list) if (!people.has(p.Id)) { people.set(p.Id, p); fresh++; }
        progress(people.size);
        if ((!o.more && list.length < PAGE) || !fresh) break;
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
    const a = await ask(key, anc, 0, progress, seen);
    const rootId = a.rootId;
    for (const p of a.list) if (!people.has(p.Id)) people.set(p.Id, p);
    if (rootId == null || !people.has(rootId)) throw new Error('WikiTree did not send a profile for ' + key + '. Check the ID, for example Savoie-2387.');

    if (sib) {
      // the brothers and sisters of the starting person and of every ancestor WikiTree named, with their husbands and wives
      const line = [...people.keys()].filter(id => typeof id === 'number');
      const before = new Set(people.keys());
      progress.stage('Adding brothers and sisters…');
      await siblingsOf(line, people, progress);
      addSpouses(people, [...people.keys()].filter(id => !before.has(id)));
    }

    if (desc > 0) {
      progress.stage('Adding descendants…');
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
    return { people, rootId };
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

  FO.wikitreeToGedcom = function (people, rootId, title) {
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
      const given = typeof id === 'string' ? 'Private' : one([p.FirstName || p.RealName, p.MiddleName].filter(Boolean).join(' '));
      const surname = one(p.LastNameAtBirth || p.LastNameCurrent).replace(/\//g, '');
      out.push('0 ' + xref(id) + ' INDI', '1 NAME ' + given.replace(/\//g, '') + ' /' + surname + '/');
      out.push('1 SEX ' + (/^m/i.test(p.Gender || '') ? 'M' : /^f/i.test(p.Gender || '') ? 'F' : role.get(id) || 'U'));
      const bd = gedDate(p.BirthDate, status(p, 'BirthDate')), bp = one(p.BirthLocation);
      if (bd || bp) { out.push('1 BIRT'); if (bd) out.push('2 DATE ' + bd); if (bp) out.push('2 PLAC ' + bp); }
      const dd = gedDate(p.DeathDate, status(p, 'DeathDate')), dp = one(p.DeathLocation);
      if (dd || dp) { out.push('1 DEAT'); if (dd) out.push('2 DATE ' + dd); if (dp) out.push('2 PLAC ' + dp); }
      if (p.Name) out.push('1 WWW https://www.WikiTree.com/wiki/' + encodeURI(String(p.Name)));
      if (id === rootId) out.push('1 _HOME Y');
      // WikiTree decides who counts as living; its answer is followed in both directions
      if (p.IsLiving === 1 || p.IsLiving === '1') out.push('1 _LIVING Y');
      else if (p.IsLiving === 0 || p.IsLiving === '0') out.push('1 _LIVING N');
      if (famOf.has(id)) out.push('1 FAMC ' + famOf.get(id));
      for (const f of famsOf.get(id) || []) out.push('1 FAMS ' + f);
    }
    for (const f of fams.values()) {
      out.push('0 ' + f.id + ' FAM');
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
    return a ? 'The ' + a + (b && b.toLowerCase() !== a.toLowerCase() ? '/' + b : '') + ' family' : 'A WikiTree family';
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
          el('div', { class: 'caps', text: 'From WikiTree' }), el('p', { class: 'wt-wait-line' })));
      document.body.append(waitEl);
    }
    if (line != null) waitEl.querySelector('.wt-wait-line').textContent = line;
    waitEl.classList.toggle('on', !!on);
  }

  let busyNow = false;
  FO.loadWikiTree = async function (input, anc, desc, progress, sib) {
    const key = FO.wikitreeKey(input);
    if (!key) throw new Error('Please enter a WikiTree ID, such as Savoie-2387.');
    if (busyNow) throw new Error('A tree is already being fetched.');
    busyNow = true;
    try {
      anc = Math.max(0, Math.min(MAX.anc, Math.round(+anc) || 0));
      desc = Math.max(0, Math.min(MAX.desc, Math.round(+desc) || 0));
      sib = sib !== false;
      let stage = 'Asking WikiTree for ' + key + '…';
      waiting(true, stage);
      const tick = n => { const line = stage + ' ' + FO.ui.fmt(n) + ' people so far.'; waiting(true, line); if (progress) progress(n, line); };
      tick.stage = t => { stage = t; };
      const { people, rootId } = await fetchTree(key, anc, desc, sib, tick);
      waiting(true, 'Drawing ' + FO.ui.fmt(people.size) + ' people…');
      await new Promise(r => setTimeout(r, 30));   // let the card show before the drawing starts
      const title = familyTitle(people, rootId);
      const text = FO.wikitreeToGedcom(people, rootId, title);
      const root = people.get(rootId);
      if (!FO.loadText(text, title, 'wikitree')) throw new Error('WikiTree sent no people that could be drawn.');
      FO.state.wikitree = { key: root && root.Name || key, anc, desc, sib };
      return { count: people.size, key: root && root.Name || key };
    } finally { busyNow = false; waiting(false); }
  };

  /* ---------- the "From WikiTree" panel ---------- */
  function buildPanel(menu) {
    const ui = FO.ui, el = ui.el;
    const opts = (from, to, sel, word) => {
      const s = el('select');
      for (let i = from; i <= to; i++) s.append(el('option', { value: i, text: i === 0 ? 'None' : i + ' ' + (i === 1 ? word : word + 's'), selected: i === sel ? 'selected' : null }));
      return s;
    };
    const id = el('input', { type: 'text', placeholder: 'e.g. Savoie-2387', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'WikiTree ID', value: FO.prefs.get('wt.id', '') });
    const anc = opts(1, MAX.anc, FO.prefs.num('wt.anc', 10, 1, MAX.anc), 'generation');
    const desc = opts(0, MAX.desc, FO.prefs.num('wt.desc', 0, 0, MAX.desc), 'generation');
    const sib = el('input', { type: 'checkbox' });
    sib.checked = FO.prefs.get('wt.sib', 1, [0, 1]) === 1;
    const msg = el('p', { class: 'wt-msg', role: 'status' });
    const go = el('button', { type: 'submit', class: 'pill small', text: 'Draw this family' });
    const form = el('form', { class: 'wt-form' },
      el('label', {}, el('span', { text: 'WikiTree ID' }), id),
      el('div', { class: 'wt-row' },
        el('label', {}, el('span', { text: 'Ancestors' }), anc),
        el('label', {}, el('span', { text: 'Descendants' }), desc)),
      el('label', { class: 'wt-check' }, sib, el('span', { text: 'Brothers and sisters of each ancestor, with their husbands and wives' })),
      el('div', { class: 'row' }, go), msg);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const key = FO.wikitreeKey(id.value);
      if (!key) { msg.textContent = 'Please enter a WikiTree ID, such as Savoie-2387, or paste a profile address.'; id.focus(); return; }
      FO.prefs.set('wt.id', key); FO.prefs.set('wt.anc', +anc.value); FO.prefs.set('wt.desc', +desc.value); FO.prefs.set('wt.sib', sib.checked ? 1 : 0);
      go.disabled = true; msg.textContent = 'Asking WikiTree for ' + key + '…';
      try {
        const r = await FO.loadWikiTree(key, anc.value, desc.value, (n, line) => { msg.textContent = line; }, sib.checked);
        msg.textContent = '';
        FO.closeMenus();
        ui.toast('Loaded ' + ui.fmt(r.count) + ' people from WikiTree, starting from ' + r.key + '. Nothing is stored.');
      } catch (err) {
        msg.textContent = err.message || String(err);
      } finally { go.disabled = false; }
    });
    menu.append(
      el('div', { class: 'caps', text: 'From WikiTree' }),
      el('h3', { text: 'Draw any family on WikiTree' }),
      el('p', { class: 'muted', text: 'Type a WikiTree ID, or paste the address of a profile, and choose how far to go. Descendants and brothers and sisters make trees much larger: the more you ask for, the longer WikiTree takes to answer.' }),
      form,
      el('p', { class: 'muted small-print', text: 'Only what WikiTree shows to everyone is fetched, and people who may be living stay hidden. Nothing is stored: the tree is kept only while this page is open. Data from WikiTree.com, shared by its community of genealogists.' }));
    return { id, anc, desc, form };
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
        FO.loadWikiTree(key, q.get('anc') || 10, q.get('desc') || 0, null, q.get('sib') !== '0')
          .then(r => FO.ui.toast('Loaded ' + FO.ui.fmt(r.count) + ' people from WikiTree, starting from ' + r.key + '. Nothing is stored.'))
          .catch(err => FO.ui.toast(err.message || String(err)));
      }
    }
  });
})();
