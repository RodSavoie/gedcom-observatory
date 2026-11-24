/* Family Observatory: shell: routing, shared controls, person drawer, file loading. */
(function () {
  'use strict';
  const FO = window.FO;
  FO.views = [];
  FO.view = v => FO.views.push(v);
  FO.C = { bg: '#EEE9DF', ink: '#1B2632', ink2: '#3D4B5E', ink3: '#7C8088', line: '#C9C1B1', soft: '#E0DACE', snow: '#F7F4EE', red: '#A35139', teal: '#2B80AA', tealDeep: '#2C3B4D', blush: '#F3C9A0', flax: '#FFB162', frost: '#C9C1B1' };
  /* categorical series, checked for colour-blind separation on the snow surface */
  FO.CAT = ['#A35139', '#2B80AA', '#DB8328', '#5450A8', '#C9628E', '#588C46', '#8A62B8'];
  FO.OTHER = '#B3AC9C';
  FO.state = { data: null, home: null, title: '', builtin: true, hideLiving: true, text: null, subject: null, pair: null, founder: null };

  /* Choices that stay put between visits (generations on each view, the fan's colouring, the
     Where They Lived buttons, everyone / direct ancestors): one small cookie, kept for a year,
     with local storage as a fallback. Each view has its own keys. */
  FO.prefs = (function () {
    const NAME = 'fo-prefs';
    let p = {};
    try { const m = document.cookie.match(/(?:^|;\s*)fo-prefs=([^;]*)/); if (m) p = JSON.parse(decodeURIComponent(m[1])) || {}; } catch (e) { p = {}; }
    if (!Object.keys(p).length) try { p = JSON.parse(localStorage.getItem(NAME) || '{}') || {}; } catch (e) { p = {}; }
    const save = () => {
      const s = JSON.stringify(p);
      try { document.cookie = NAME + '=' + encodeURIComponent(s) + '; max-age=31536000; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) {}
      try { localStorage.setItem(NAME, s); } catch (e) {}
    };
    return {
      // a saved choice, if it is one of the allowed values
      get(k, def, allowed) { const v = p[k]; return v !== undefined && (!allowed || allowed.includes(v)) ? v : def; },
      // a saved number, fitted to this file's range (a smaller family file may not reach it)
      num(k, def, min, max) { const v = Math.round(+p[k]); return p[k] !== undefined && isFinite(v) ? Math.max(min, Math.min(max, v)) : def; },
      set(k, v) { if (p[k] === v) return; p[k] = v; save(); }
    };
  })();
  FO.state.scope = FO.prefs.get('scope', 'all', ['all', 'anc']);

  /* ---------- tiny DOM helpers ---------- */
  const ui = (FO.ui = {});
  ui.el = function (tag, attrs) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) e.style.setProperty(sk, v[sk]); else e.style[sk] = v[sk]; } }
      else e.setAttribute(k, v);
    }
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(x => x != null && x !== false && e.append(x));
      else e.append(c);
    }
    return e;
  };
  const el = ui.el;
  ui.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  ui.fmt = n => (n == null ? '' : Math.round(n).toLocaleString('en-CA'));
  ui.svg = function (tag, attrs) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    for (let i = 2; i < arguments.length; i++) if (arguments[i] != null) e.append(arguments[i]);
    return e;
  };

  ui.seg = function (options, value, onChange) {
    const wrap = el('div', { class: 'seg', role: 'group' });
    options.forEach(o => {
      const b = el('button', { type: 'button', 'aria-pressed': String(o.v === value), text: o.label, onclick: () => {
        wrap.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true'); onChange(o.v);
      } });
      wrap.append(b);
    });
    return wrap;
  };
  ui.range = function (label, min, max, value, onChange) {
    const out = el('output', { text: value });
    const inp = el('input', { type: 'range', min, max, value, 'aria-label': label, oninput: () => { out.textContent = inp.value; onChange(+inp.value); } });
    return el('label', { class: 'ctl' }, el('span', { text: label }), inp, out);
  };
  ui.select = function (label, options, value, onChange) {
    const sel = el('select', { 'aria-label': label, onchange: () => onChange(sel.value) });
    options.forEach(o => { const op = el('option', { value: o.v, text: o.label }); if (String(o.v) === String(value)) op.selected = true; sel.append(op); });
    return el('label', { class: 'ctl' }, label ? el('span', { text: label }) : null, sel);
  };
  ui.chip = function (label, color, pressed, onChange) {
    const b = el('button', { type: 'button', class: 'chip', 'aria-pressed': String(!!pressed), style: { '--c': color }, onclick: () => {
      const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); onChange(v);
    } }, el('i'), label);
    return b;
  };
  ui.button = (label, onClick) => el('button', { type: 'button', class: 'btn', text: label, onclick: onClick });

  /* type-ahead person picker */
  ui.picker = function (label, current, onPick, placeholder) {
    const input = el('input', { type: 'search', placeholder: placeholder || 'Search a name…', value: current && !current.hidden ? current.name : (current ? current.name : ''), 'aria-label': label || 'Find a person', autocomplete: 'off', spellcheck: 'false' });
    const list = el('ul', { style: { display: 'none' }, role: 'listbox' });
    let items = [], idx = -1;
    const close = () => { list.style.display = 'none'; idx = -1; };
    const paint = () => {
      list.innerHTML = '';
      items.forEach((p, i) => list.append(el('li', { class: i === idx ? 'on' : '', role: 'option', onmousedown: e => { e.preventDefault(); pick(p); } }, p.name, el('span', { text: FO.lifespan(p) }))));
      list.style.display = items.length ? 'block' : 'none';
    };
    const pick = p => { input.value = p.name; close(); input.blur(); onPick(p); };
    input.addEventListener('input', () => { items = FO.search(FO.state.data, input.value, 14); idx = items.length ? 0 : -1; paint(); });
    input.addEventListener('focus', () => input.select());
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { idx = Math.min(items.length - 1, idx + 1); paint(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); paint(); e.preventDefault(); }
      else if (e.key === 'Enter' && items[idx]) { pick(items[idx]); e.preventDefault(); }
      else if (e.key === 'Escape') close();
    });
    const wrap = el('label', { class: 'ctl picker' }, label ? el('span', { text: label }) : null, el('span', { style: { position: 'relative' } }, input, list));
    wrap.setPerson = p => { input.value = p ? p.name : ''; };
    return wrap;
  };

  /* HiDPI canvas that redraws on resize */
  ui.canvas = function (stage, draw) {
    const canvas = el('canvas');
    stage.append(canvas);
    const ctx = canvas.getContext('2d');
    const api = { canvas, ctx, w: 0, h: 0, dpr: 1 };
    const size = () => {
      const r = stage.getBoundingClientRect();
      api.dpr = Math.min(window.devicePixelRatio || 1, 2);
      api.w = Math.max(50, r.width); api.h = Math.max(50, r.height);
      canvas.width = Math.round(api.w * api.dpr); canvas.height = Math.round(api.h * api.dpr);
      ctx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0);
      draw(api);
    };
    const ro = new ResizeObserver(size);
    ro.observe(stage);
    api.redraw = () => { ctx.setTransform(api.dpr, 0, 0, api.dpr, 0, 0); draw(api); };
    api.destroy = () => ro.disconnect();
    size();
    return api;
  };

  /* tooltip */
  const tipEl = el('div', { class: 'tip', role: 'tooltip' });
  ui.tip = function (html, x, y) {
    tipEl.innerHTML = html; tipEl.style.display = 'block';
    const r = tipEl.getBoundingClientRect();
    tipEl.style.left = Math.max(6, Math.min(window.innerWidth - r.width - 6, x + 14)) + 'px';
    tipEl.style.top = Math.max(6, Math.min(window.innerHeight - r.height - 6, y + 16)) + 'px';
  };
  ui.untip = () => { tipEl.style.display = 'none'; };
  ui.personTip = function (p, extra) {
    const where = p.b && p.b.place ? FO.shortPlace(p.b.place) : '';
    return '<b>' + ui.esc(p.name) + '</b><span>' + ui.esc([FO.lifespan(p), where].filter(Boolean).join(' · ')) + (extra ? '<br>' + ui.esc(extra) : '') + '</span>';
  };
  ui.empty = function (stage, title, text, action) {
    const box = el('div', {}, el('h3', { text: title }), el('p', { text: text }));
    if (action) box.append(action);
    stage.append(el('div', { class: 'empty' }, box));
  };
  ui.plink = function (p, onClick) {
    if (!p) return document.createTextNode('unknown');
    return el('button', { type: 'button', class: 'plink', text: p.name, onclick: () => (onClick || FO.select)(p) });
  };
  /* a small link to the person's own profile page (WikiTree for a WikiTree export) */
  ui.wt = function (p, label) {
    if (!p || !p.url) return null;
    let host = ''; try { host = new URL(p.url).hostname.replace(/^www\./i, ''); } catch (e) { return null; }
    const site = /wikitree/i.test(host) ? 'WikiTree' : /familysearch/i.test(host) ? 'FamilySearch' : host;
    return el('a', { class: 'wt', href: p.url, target: '_blank', rel: 'noopener', title: 'Open ' + p.name + ' on ' + site + ' in a new tab', text: (label || site) + ' ↗' });
  };
  let toastTimer;
  ui.toast = function (msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.style.display = 'block';
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.style.display = 'none'), 4200);
  };

  /* ---------- kin helpers with caching ---------- */
  let kinCache = null;
  FO.kin = function () {
    const s = FO.state;
    if (!kinCache || kinCache.home !== s.home || kinCache.data !== s.data) {
      kinCache = { home: s.home, data: s.data, anc: FO.ancestry(s.home), cls: FO.kinClasses(s.data, s.home), dna: FO.dna(s.home) };
    }
    return kinCache;
  };
  FO.relToHome = function (p) {
    const h = FO.state.home;
    if (!h || p === h) return p === h ? 'Home person' : '';
    const r = FO.relate(p, h, 1);
    const first = (h.given || h.name).split(' ')[0];
    if (r.blood[0]) {
      const lines = r.blood[0].direct && r.blood[0].db === 0 ? 0 : (FO.kin().anc.paths.get(p) || 0);
      return first + '’s ' + r.blood[0].label + (lines > 1 ? ' · by ' + lines + ' lines' : '');
    }
    if (r.marriage[0]) return r.marriage[0].direct ? first + '’s ' + r.marriage[0].text : r.marriage[0].text;
    return '';
  };

  /* ---------- person drawer ---------- */
  FO.select = function (p) {
    const d = document.getElementById('drawer');
    if (!d) return;
    if (!p) { d.classList.remove('open'); d.innerHTML = ''; return; }
    const s = FO.state;
    const inn = el('div', { class: 'drawer-in' });
    inn.append(el('button', { class: 'x', 'aria-label': 'Close', text: '×', onclick: () => FO.select(null) }));
    inn.append(el('h2', { text: p.name }));
    if (p.hidden) inn.append(el('p', { class: 'life', text: 'Details of people who may be living are not shown.' }));
    else inn.append(el('p', { class: 'life', text: FO.lifespan(p) || 'Dates unknown' }));
    const rel = FO.relToHome(p);
    if (rel) inn.append(el('span', { class: 'rel', text: rel }));
    const dl = el('dl');
    const row = (k, v) => { if (v) dl.append(el('dt', { text: k }), el('dd', {}, v)); };
    if (!p.hidden) {
      if (p.b && (p.b.date || p.b.place)) row('Born', [p.b.date && p.b.date.text, p.b.place].filter(Boolean).join(', '));
      if (p.d && (p.d.date || p.d.place)) row('Died', [p.d.date && p.d.date.text, p.d.place].filter(Boolean).join(', '));
    }
    if (p.father || p.mother) {
      const dd = el('ul');
      if (p.father) dd.append(el('li', {}, ui.plink(p.father), el('small', { text: ' ' + FO.lifespan(p.father) })));
      if (p.mother) dd.append(el('li', {}, ui.plink(p.mother), el('small', { text: ' ' + FO.lifespan(p.mother) })));
      row('Parents', dd);
    }
    p.fams.forEach(f => {
      const sp = f.husb === p ? f.wife : f.husb;
      const dd = el('ul');
      if (sp) dd.append(el('li', {}, ui.plink(sp), el('small', { text: f.my ? ' married ' + f.my : '' })));
      const kids = f.children.slice().sort((a, b) => (a.est || 0) - (b.est || 0));
      kids.slice(0, 12).forEach(c => dd.append(el('li', {}, '· ', ui.plink(c), el('small', { text: ' ' + FO.lifespan(c) }))));
      if (kids.length > 12) dd.append(el('li', { class: 'muted', text: '…and ' + (kids.length - 12) + ' more children' }));
      row(sp ? (kids.length ? 'Spouse and ' + kids.length + (kids.length === 1 ? ' child' : ' children') : 'Spouse') : 'Children', dd);
    });
    inn.append(dl);
    const acts = el('div', { class: 'acts' });
    if (p !== s.home) acts.append(ui.button('Make home person', () => FO.setHome(p)));
    if (!p.hidden) acts.append(ui.button('Life story', () => { s.subject = p; FO.go('story', true); }));
    if (p !== s.home) acts.append(ui.button('How related?', () => { s.pair = [s.home, p]; FO.go('related', true); }));
    if (p.children.length) acts.append(ui.button('Show their descendants', () => { s.founder = p; s.noFeatured = false; FO.go('descendants', true); }));
    if (p.url) {
      let host = 'source'; try { host = new URL(p.url).hostname.replace(/^www\./i, ''); } catch (e) {}
      acts.append(el('a', { class: 'btn', href: p.url, target: '_blank', rel: 'noopener', text: (/wikitree/i.test(host) ? 'WikiTree profile' : /familysearch/i.test(host) ? 'FamilySearch profile' : 'Profile on ' + host) + ' ↗', style: { textDecoration: 'none' } }));
    }
    inn.append(acts);
    d.innerHTML = ''; d.append(inn); d.classList.add('open'); d.scrollTop = 0;
  };

  /* Everyone, or only the home person and their direct ancestors (kept while moving between views) */
  FO.scope = function () {
    if (FO.state.scope !== 'anc') return null;
    return new Set(FO.kin().anc.min.keys());
  };
  FO.scoped = function (data) {
    const sc = FO.scope();
    if (!sc) return data;
    return Object.assign({}, data, { scoped: true, people: data.people.filter(p => sc.has(p)), families: data.families.filter(f => f.husb && f.wife && sc.has(f.husb) && sc.has(f.wife)) });
  };
  ui.scopeSeg = function (onChange) {
    return el('span', { class: 'ctl' }, el('span', { text: 'Show' }), ui.seg([{ v: 'all', label: 'Everyone' }, { v: 'anc', label: 'Direct ancestors only' }], FO.state.scope === 'anc' ? 'anc' : 'all', x => { FO.state.scope = x; FO.prefs.set('scope', x); FO.setHashParam('show', x === 'anc' ? 'ancestors' : 'everyone'); (onChange || FO.render)(); }));
  };

  /* Ancestors of the home person with the most recorded descendants (one of each couple). */
  let founderCache = null;
  FO.founders = function () {
    const s = FO.state;
    if (founderCache && founderCache.home === s.home && founderCache.data === s.data) return founderCache.list;
    const anc = [...FO.kin().anc.min.keys()].filter(p => !p.hidden && p.children.length);
    const scored = anc.map(p => [FO.descent(p).min.size - 1, p]).sort((a, b) => b[0] - a[0]);
    const list = [], seen = new Set();
    for (const [n, p] of scored) {
      if (list.length >= 10) break;
      if (p.spouses.some(sp => seen.has(sp))) continue;
      seen.add(p); list.push({ p, n });
    }
    founderCache = { home: s.home, data: s.data, list };
    return list;
  };
  /* The featured ancestor: the one you chose, else the named ancestor with the most descendants. */
  FO.featured = function () {
    const s = FO.state;
    if (s.founder && s.data.people[s.founder.i] === s.founder) return s.founder;
    const list = FO.founders();
    const f = list.find(x => !/^unknown/i.test(x.p.given)) || list[0];
    return f ? f.p : null;
  };

  /* "How to read this": the same four headings for every view */
  FO.howTo = function (v) {
    const h = typeof v.how === 'function' ? v.how(FO.state) : v.how;
    let d = document.getElementById('how');
    if (!d) { d = el('dialog', { id: 'how', class: 'how' }); document.body.append(d); d.addEventListener('click', e => { if (e.target === d) d.close(); }); }
    d.innerHTML = '';
    const list = items => el('ul', {}, items.map(t => el('li', { text: t })));
    d.append(el('div', { class: 'how-in' },
      el('button', { class: 'x', 'aria-label': 'Close', text: '×', onclick: () => d.close() }),
      el('div', { class: 'caps', text: 'How to read this' }), el('h2', { text: v.title }),
      el('h3', { text: 'What you are looking at' }), el('p', { text: h.see }),
      el('h3', { text: 'What the marks mean' }), list(h.marks),
      el('h3', { text: 'What you can do' }), list(h.can),
      el('h3', { text: 'Keep in mind' }), el('p', { text: h.care })));
    d.showModal();
  };

  FO.setHome = function (p) {
    if (!p) return;
    FO.state.home = p; FO.state.subject = null; FO.state.founder = null;
    render();
    ui.toast(p.name + ' is now the home person. Every picture is redrawn from where they stand.');
  };

  /* ---------- routing ---------- */
  let cleanup = null;
  FO.go = function (id, force) {
    const h = '#/' + id;
    if (location.hash === h) { if (force) render(); } else location.hash = h;
  };
  function route() { return (location.hash || '').replace(/^#\/?/, '').split('?')[0]; }
  /* settings carried in the address after the view's name, such as #/tangle?surnames=100, so a view can be linked to
     exactly as it looks; FO.setHashParam keeps the address in step without redrawing the page */
  const hashQuery = () => new URLSearchParams((location.hash.split('?')[1]) || '');
  FO.hashParam = name => hashQuery().get(name);
  FO.setHashParam = function (name, value) {
    const q = hashQuery();
    if (value == null || value === '') q.delete(name); else q.set(name, value);
    const qs = q.toString(), u = new URL(location.href);
    u.hash = '#/' + route() + (qs ? '?' + qs : '');
    if (u.href !== location.href) history.replaceState(null, '', u.href);
  };

  function closeMenus() {
    document.querySelectorAll('.menu').forEach(m => m.classList.remove('open'));
    document.querySelectorAll('.nav button').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }

  function render() {
    if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
    ui.untip(); closeMenus();
    const page = document.getElementById('page');
    page.innerHTML = '';
    const r = route();
    const s = FO.state;
    document.body.classList.remove('in-view'); delete document.body.dataset.view;
    document.querySelectorAll('.nav > a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === (location.hash || '#/')));
    if (!s.data) { page.append(el('div', { class: 'loading', text: 'Reading the family file…' })); return; }
    buildMenus();
    const fd = document.getElementById('finder');
    if (fd && !fd.firstChild) fd.append(ui.picker('', null, p => { if (!document.getElementById('drawer')) FO.go('hourglass'); setTimeout(() => FO.select(p), 60); }, 'Find a person…'));
    if (r === 'me' && FO.renderMe) { FO.renderMe(page); window.scrollTo(0, 0); return; }
    if (r === 'contact' && FO.renderContact) { FO.renderContact(page); window.scrollTo(0, 0); return; }
    if (r === 'about') { renderAbout(page); const m = location.hash.match(/\?([\w-]+)/), pv = m && document.getElementById(m[1]); if (pv) pv.scrollIntoView(); else window.scrollTo(0, 0); return; }
    const v = FO.views.find(v => v.id === r);
    if (!v) { renderHome(page); return; }

    document.body.classList.add('in-view'); document.body.dataset.view = v.id;
    document.title = v.title + ' | Family Observatory';
    const tabs = el('nav', { class: 'tabs', 'aria-label': 'Views' });
    FO.views.forEach(x => {
      // split each name over two lines at the space nearest its middle, so the row is narrower
      const words = x.title.split(' ');
      let best = 0, bd = 1e9;
      for (let i = 1; i < words.length; i++) { const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length); if (d < bd) { bd = d; best = i; } }
      const a = el('a', { href: '#/' + x.id, class: x.id === v.id ? 'on' : '', 'aria-label': x.title });
      if (best) a.append(words.slice(0, best).join(' '), el('br'), words.slice(best).join(' ')); else a.append(x.title);
      tabs.append(a);
    });
    const controls = el('div', { class: 'controls' });
    const titleRow = el('div', { class: 'title-row' }, el('h1', { text: v.title }));
    if (v.how) titleRow.append(el('button', { type: 'button', class: 'btn quiet', text: 'How to read this', onclick: () => FO.howTo(v) }));
    titleRow.append(el('button', { type: 'button', class: 'homechip', title: 'Open the home person. Change it from any person’s details panel, or from The family menu.', onclick: () => FO.select(s.home) }, el('span', { text: 'Home person' }), s.home.name));
    const head = el('div', { class: 'view-head' }, el('div', { class: 'titles' }, titleRow, el('p', { text: typeof v.blurb === 'function' ? v.blurb(s) : v.blurb })), controls);
    const stage = el('div', { class: 'stage' });
    const drawer = el('aside', { class: 'drawer', id: 'drawer', 'aria-label': 'Person details' });
    page.append(tabs, head, el('div', { class: 'stage-wrap' }, stage, drawer));
    const on = tabs.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    // a link can choose Everyone or Direct ancestors only for this visit: #/places?show=everyone (or show=ancestors)
    const show = FO.hashParam('show');
    if (show === 'everyone') s.scope = 'all'; else if (show === 'ancestors') s.scope = 'anc';
    try { cleanup = v.render({ stage, controls, data: s.data, home: s.home, state: s }) || null; }
    catch (e) { console.error(e); ui.empty(stage, 'This view could not be drawn', String(e.message || e)); }
  }
  FO.render = render;

  /* ---------- home page ---------- */
  function familyFacts() {
    const s = FO.state, d = s.data;
    const ys = d.people.filter(p => p.by != null).map(p => p.by);
    const anc = FO.kin().anc;
    return { people: d.people.length, families: d.families.length, gens: anc.gens.length, from: ys.length ? d3.min(ys) : null, to: ys.length ? d3.max(ys) : null,
      surnames: new Set(d.people.map(p => p.surname && FO.surnameKey(p.surname)).filter(Boolean)).size, places: new Set(d.people.map(p => p.b && p.b.place && FO.placeKey(p.b.place)).filter(Boolean)).size, living: d.livingCount };
  }
  function renderHome(page) {
    const s = FO.state, f = familyFacts();
    document.title = s.title + ' | Family Observatory';
    // the picture beside the title: the ancestor fan (or the star chart when no parents are recorded)
    const useFan = !!FO.heroFan && FO.kin().anc.gens.length > 1;
    const sky = el('div', { class: 'hero-sky' + (useFan ? ' hero-fan' : ''), title: useFan ? 'Open the Ancestor Fan' : 'Open the star chart', onclick: () => FO.go(useFan ? 'fan' : 'sky') });
    const facts = el('dl', { class: 'hero-facts' },
      el('div', {}, el('dt', { text: 'people' }), el('dd', { class: 'num', text: ui.fmt(f.people) })),
      el('div', {}, el('dt', { text: 'families' }), el('dd', { class: 'num', text: ui.fmt(f.families) })),
      el('div', {}, el('dt', { text: 'generations back' }), el('dd', { class: 'num', text: Math.max(0, f.gens - 1) })),
      f.from != null ? el('div', {}, el('dt', { text: 'birth years' }), el('dd', { class: 'num', text: f.from + '-' + f.to })) : null,
      el('div', {}, el('dt', { text: 'surnames' }), el('dd', { class: 'num', text: ui.fmt(f.surnames) })),
      el('div', {}, el('dt', { text: 'birthplaces' }), el('dd', { class: 'num', text: ui.fmt(f.places) })));
    const hero = el('section', { class: 'hero' },
      el('div', { class: 'hero-text' },
        el('div', { class: 'caps', text: 'Family Observatory' }),
        familyTitle(s.title),
        el('p', { text: 'Every person in this family file, drawn ' + (['', '', '', '', '', '', '', '', '', '', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'][FO.views.length] || FO.views.length) + ' different ways: as a chart of stars, a fan of ancestors, a river of lifetimes, and more. Seen from ' + s.home.name + '.' }),
        facts,
        el('div', { class: 'hero-cta' },
          el('button', { class: 'pill dark', text: useFan ? 'Open the ancestor fan' : 'Open the star chart', onclick: () => FO.go(useFan ? 'fan' : 'sky') }),
          el('button', { class: 'pill', text: 'Load your own file', onclick: () => document.getElementById('file').click() }))),
      sky);
    const cards = el('div', { class: 'cards' });
    FO.views.forEach(v => cards.append(el('a', { class: 'card', href: '#/' + v.id }, iconSvg(v), el('h3', { text: v.title }), el('p', { text: v.card }))));
    // the recorded line back along the fathers (the red line in the star chart)
    const chainP = []; for (let q = s.home, i = 0; q && i < 60; q = q.father, i++) chainP.push(q);
    let lineage = null;
    if (chainP.length > 2) {
      const chain = el('div', { class: 'chain' });
      chainP.forEach((q, i) => { if (i) chain.append(el('i', { text: '→' })); chain.append(el('button', { type: 'button', onclick: () => { FO.state.subject = q.hidden ? null : q; FO.go(q.hidden ? 'hourglass' : 'story', true); } }, el('b', { text: q.name }), el('span', { text: FO.lifespan(q) || ' ' }))); });
      lineage = el('div', { class: 'note-card' }, el('h3', { text: 'The recorded line from ' + s.home.name.split(' ')[0] + ' back to ' + chainP[chainP.length - 1].name }), chain,
        el('p', { class: 'muted', text: 'Each arrow is a father recorded in the file. A recorded parent is a claim to check against documents, not proof. Click a name to read that person’s story.' }));
    }
    const notes = el('div', { class: 'note-card' }, el('h3', { text: 'Three things to know before you trust a picture' }), el('ol', {},
      el('li', {}, el('b', { text: 'A tree is a set of conclusions. ' }), 'Every picture shows what the file records. It cannot tell you whether a recorded parent, date or place is right.'),
      el('li', {}, el('b', { text: 'Living people are hidden. ' }), 'Anyone with no recorded death who was born in the last ' + FO.LIVING_YEARS + ' years, or whose age cannot be worked out, appears only as an unnamed mark' + (f.living ? ' (' + f.living + ' in this family).' : '.')),
      el('li', {}, el('b', { text: 'Some positions are guesses. ' }), 'Where a birth year is missing, a person is placed by an estimate from their parents, partner or children. Every view has a “How to read this” button that says what its marks mean.')));
    page.append(hero,
      el('section', { class: 'band' }, el('div', { class: 'frame' }, el('h2', { text: (['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen'][FO.views.length] || FO.views.length) + ' ways to look at one family' }),
        el('p', { text: 'Each view answers a different question. Click any person in any view to see their details, read their story, or re-centre everything on them.' }), cards,
        el('div', { class: 'notes-row' }, lineage, notes))),
      el('footer', { class: 'foot' },
        el('span', { text: 'Your family file is read in your browser and never leaves your device.' }),
        el('span', { html: '<a href="#/about">About and privacy</a>' })));
    if (useFan) cleanup = FO.heroFan(sky);
    else if (FO.heroSky) cleanup = FO.heroSky(sky);
  }
  function iconSvg(v) {
    const d = el('div');
    d.innerHTML = '<svg viewBox="0 0 64 64" fill="none" stroke="#1B2632" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + v.icon + '</svg>';
    return d.firstChild;
  }

  function renderAbout(page) {
    document.title = 'About | Family Observatory';
    const s = FO.state;
    const f = familyFacts(), gens = Math.max(0, f.gens - 1);
    const v = id => '<a href="#/' + id + '">' + ui.esc((FO.views.find(x => x.id === id) || {}).title || id) + '</a>';
    // the views, grouped by the question each one answers
    const VIEWS = [
      ['Who are my ancestors?', [
        ['fan', 'Rings of ancestors around one person, coloured by birthplace, surname, era or how often each person repeats. Can be saved as an SVG image.'],
        ['hourglass', 'A classic family chart: parents and grandparents above, children and grandchildren below.'],
        ['time', 'Every ancestor placed by birth year or generation, with a line from each child to each parent. Click someone to trace every route back.'],
        ['descendants', 'Everyone descended from one person, in rings coloured by child.']]],
      ['How are we connected?', [
        ['related', 'Pick any two people and read their relationship in plain words, with the path through their shared ancestors.'],
        ['collapse', 'Which ancestors appear more than once, through how many lines, the expected DNA share, and how related ancestor couples already were.'],
        ['tangle', 'Surnames as circles, tied together by the marriages between them.']]],
      ['When and where?', [
        ['sky', 'One star for every person, with the oldest births at the centre.'],
        ['river', 'Every life as a line from birth to death, stacked through the centuries, with historical events alongside.'],
        ['places', 'A zoomable map of where people were born and died, a grid of births by place and period, or ribbons from parents’ birthplaces to their children’s.'],
        ['story', 'One person’s life told in sentences, beside a timeline of their years.']]],
      ['What does the whole tree look like?', [
        ['numbers', 'Births by decade, lifespans, family sizes and the names that keep returning.']]],
      ['What needs work?', [
        ['missing', 'How complete each generation is, and exactly who lacks a date or a place.'],
        ['checks', 'Dates that do not add up, listed as questions to look into.']]]];
    const viewRows = VIEWS.map(([q, rows]) => rows.map(([id, what], k) =>
      '<tr>' + (k ? '' : '<th scope="rowgroup" rowspan="' + rows.length + '">' + q + '</th>') + '<td class="av-view">' + v(id) + '</td><td class="av-what">' + what + '</td></tr>').join('')).join('');
    const designs = (window.FO_DESIGNS ? FO_DESIGNS.list.map(d => d.name) : []);
    const NUM = ['', '', '', '', '', '', '', '', '', '', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen'];
    const nViews = NUM[FO.views.length] || String(FO.views.length);
    // "My Savoie·Breau family" reads as "my Savoie·Breau family" inside a sentence
    const inSentence = t => String(t).replace(/^(My|Our|The|Ma|Mon|Notre)\b/, w => w.toLowerCase());
    page.append(el('article', { class: 'about', html:
      '<div class="caps">About</div><h1>A place to look at a family</h1>' +
      '<p>Family Observatory draws one family tree ' + nViews + ' different ways, so you can see what no single chart shows: where the family lived, how often cousins married, and which ancestors turn up again and again.</p>' +
      '<p>' + (s.family === defaultFamily().id ? 'It opens on ' : 'You are looking at ') + ui.esc(inSentence(s.title)) + ': ' + ui.fmt(f.people) + ' people' + (gens ? ' across ' + gens + ' generations' : '') + '. ' +
        'Two other families can be opened too (see <a href="#/about?families">Families on this site</a>), and anyone can load their own family file and explore it the same way. There is nothing to install, no account, and nothing is uploaded.</p>' +
      '<h2 id="views">The ' + nViews + ' views</h2>' +
      '<p>Each view answers one question about the family, and each has a <b>How to read this</b> guide beside its title.</p>' +
      '<table class="about-views"><thead><tr><th>Question</th><th>View</th><th>What it shows</th></tr></thead><tbody>' + viewRows + '</tbody></table>' +
      '<h2>Exploring people</h2>' +
      '<p>Every view is seen from one <b>home person</b>, shown beside each view’s title. Anyone can become the home person, and every view redraws from their point of view.</p><ul>' +
      '<li><b>Point at anyone</b> to see their dates, birthplace and relationship to the home person.</li>' +
      '<li><b>Click anyone</b> to open their details: birth, death, parents, spouses and children, with buttons to make them the home person, read their life story, see how they are related, or show their descendants.</li>' +
      '<li><b>Find a person</b> by name from the search box at the top of every page.</li>' +
      '<li><b>Go to the source:</b> people link to their WikiTree profile wherever they appear, so corrections can be made where the research lives.</li>' +
      '<li><b>Zoom and drag</b> the busier charts (the fan, Ancestors Through Time, The Tangle and the map in Where They Lived) to look closely at crowded areas.</li>' +
      '<li><b>See where they lived</b> on the map in ' + v('places') + ': every birthplace or place of death as a bubble, for one century or all of them. Click a bubble to list its people.</li>' +
      '<li><b>Back to the top:</b> on long pages, a small arrow at the bottom right brings you back up.</li></ul>' +
      '<h2>Look and feel</h2><ul>' +
      (designs.length ? '<li><b>' + ((['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][designs.length]) || designs.length) + ' designs</b> can be picked from the strip at the top of every page: ' + designs.join(', ').replace(/, ([^,]*)$/, ' and $1') + '. Each recolours the whole site, charts included.</li>' : '') +
      '<li><b>Choices are remembered</b> between visits: the design, the number of generations on each chart, the fan’s colouring, and the settings on Where They Lived, map included.</li>' +
      '<li><b>The home page</b> shows the family’s ancestor fan beside its title; click it to open the full chart.</li>' +
      '<li><b><a href="#/contact">Contact me</a></b> sends a message to Rod from a simple form on the site.</li></ul>' +
      '<h2 id="privacy">Privacy</h2><ul>' +
      '<li><b>Your file stays on your device.</b> When you load a family file it is read by your own browser. It is not uploaded, stored or sent anywhere.</li>' +
      '<li><b>No account, no tracking.</b> There is nothing to sign in to and the site keeps nothing about you or your file.</li>' +
      '<li><b>No AI looks at your file.</b> Everything you see is drawn by ordinary code running in your browser.</li>' +
      '<li><b>The map asks no one.</b> Places are found in lists of place names that come with this site; no place name is sent to a map service.</li>' +
      '<li><b>Living people are hidden.</b> Anyone with no death or burial recorded with a date or a place, who was born in the last ' + FO.LIVING_YEARS + ' years or whose age cannot be worked out, is shown only as “Living person”, without dates or places. In the families on this site those details were removed from the files themselves before they were published; in the Savoie · Breau family only the home person’s name and birth year remain.</li></ul>' +
      '<h2 id="families">Families on this site</h2><p>Three families can be opened from <b>The family</b> menu, or straight from a link. The two larger ones are made from the <a href="https://www.wikitree.com/wiki/Project:Acadians" target="_blank" rel="noopener">WikiTree Acadians Project</a>:</p><ul>' +
        FAMILIES.map(fm => '<li><b><a href="?family=' + fm.id + '#/">' + ui.esc(fm.label) + '</a></b>' + (fm === defaultFamily() ? ', the family the site opens on' : '') + (fm.note ? ': ' + ui.esc(fm.note) : '') + '. Link: <code style="white-space:nowrap">?family=' + fm.id + '</code></li>').join('') +
        '</ul><p>These files are updated from time to time; the newest version is always the one shown.</p>' +
      '<h2>Loading your own family</h2><p>Export a GEDCOM (.ged) file from your genealogy program or website (WikiTree, Ancestry, FamilySearch-compatible software, Gramps, RootsMagic and so on), then use <b>Load your file</b> at the top of the page, or drag the file onto the window. From <b>The family</b> menu you can then save a cleaned copy: the same family without notes, sources or living people. The first person in the file becomes the home person; you can re-centre on anyone from their details panel.</p>' +
      '<h2>Drawing a family from WikiTree</h2><p>Use <b>From WikiTree</b> at the top of the page and type a WikiTree ID, such as Savoie-2387, to draw that person&rsquo;s ancestors, with the brothers and sisters along every line and, if you like, descendants, straight from <a href="https://www.wikitree.com/" target="_blank" rel="noopener">WikiTree</a>. Only what WikiTree shows to everyone is fetched; biographies and photos are not. Nothing is stored: the family is kept only while the page is open, and people who may be living stay hidden. A link such as <code>?wt=Savoie-2387&amp;anc=10</code> opens a family directly (add <code>&amp;desc=2</code> for descendants, or <code>&amp;sib=0</code> to leave out brothers and sisters).</p>' +
      '<h2>What the pictures can and cannot tell you</h2><p>Every picture draws what a family file records. A recorded parent, date or place is a conclusion someone entered; it may rest on good documents, on a guess, or on another person’s tree, and the pictures cannot tell those apart. Use them to see patterns and to find things worth checking. Every view has a <b>How to read this</b> button beside its title.</p><p>Names are grouped where only their writing differs: surnames that differ by accents, capitals, spaces or apostrophes (LeBlanc and Le Blanc, Hébert and Hebert) count as one, and so do first names written with a space or a hyphen (Jean Baptiste and Jean-Baptiste). On the map, a place is found from its name, old Acadian and French names included; one known only by its region (“Acadie”, “France”) is shown at that region’s centre, and a small French village missing from the world list is placed at the centre of its département. The note under the map says how many of each.</p><h2>Reading the views</h2><p>Dark marks are the family. The <span style="color:#A35139">warm accent colour</span> marks the line or the people you have chosen, and anyone who appears more than once in a chart. Underlined text and outlined buttons are things you can press. Estimated years are used where a birth date is missing, so positions for those people are approximate.</p>' +
      '<h2>Credit</h2>' +
      '<p>The idea and the set of views follow <a href="https://observatory.vibegenealogy.ai/" target="_blank" rel="noopener">Kinfolk Observatory</a>, a Vibe Genealogy project by Steve Little, described in <a href="https://vibegenealogy.ai/p/fun-prompt-friday-fable-make-something-incredible-kinfolk-observatory" target="_blank" rel="noopener">his write-up of 13 November 2026</a>. This version was built separately, with its own code and a lighter look.</p>' +
      '<p>The untangled pedigree in Ancestors Through Time owes a debt to B.&nbsp;F. Lyon’s <a href="https://learnforeverlearn.com/ancestors/" target="_blank" rel="noopener">Exploring Family Trees</a>.</p>' +
      '<p>The families on this site are drawn from profiles on <a href="https://www.wikitree.com/" target="_blank" rel="noopener">WikiTree</a>, the shared tree built by many volunteers, including the <a href="https://www.wikitree.com/wiki/Project:Acadians" target="_blank" rel="noopener">Acadians Project</a>. Each person’s panel links to their WikiTree profile.</p>' +
      '<p>The map is drawn from <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a> (public domain). Place names and positions come from <a href="https://www.geonames.org/" target="_blank" rel="noopener">GeoNames</a> (Creative Commons Attribution 4.0), Natural Resources Canada’s geolocated place names (Open Government Licence – Canada) and the French communes list from INSEE and Etalab (Licence Ouverte); Acadian settlements and old French provinces were placed by hand.</p>' +
      '<p>The kinship and inbreeding figures use coefficients that go back to Sewall Wright (1922) and Gustave Malécot (1948). Drawing each life as a line along a scale of years has a long history; an early example is Joseph Priestley’s <i>Chart of Biography</i> (1765).</p>' +
      '<h2>Built with</h2><ul>' +
      '<li><a href="https://d3js.org/" target="_blank" rel="noopener">D3</a> 7.9.2, copyright 2010–2026 Mike Bostock, ISC License.</li>' +
      '<li><a href="https://github.com/topojson/topojson-client" target="_blank" rel="noopener">topojson-client</a> 3.1.0, copyright 2012–2019 Michael Bostock, ISC License.</li>' +
      '<li><a href="https://github.com/googlefonts/roboto-classic" target="_blank" rel="noopener">Roboto</a> 3.015, copyright 2011 The Roboto Project Authors, SIL Open Font License 1.1, from the Fontsource package.</li>' +
      '<li>The <a href="https://gedcom.io/" target="_blank" rel="noopener">GEDCOM</a> standard from FamilySearch, which every family file uses.</li></ul>' }));
  }

  /* ---------- menus ---------- */
  function buildMenus() {
    const s = FO.state;
    const vm = document.getElementById('menu-views');
    vm.innerHTML = '';
    const grid = el('div', { class: 'menu-grid' });
    FO.views.forEach(v => { const a = el('a', { href: '#/' + v.id, class: route() === v.id ? 'on' : '' }, iconSvg(v), el('div', {}, el('b', { text: v.title }), el('span', { text: v.card }))); grid.append(a); });
    vm.append(grid);

    // the families on this site, listed under The family in the Harbour design's side menu (hidden elsewhere)
    let fl = document.getElementById('fam-links');
    if (!fl) { fl = el('div', { id: 'fam-links', class: 'fam-links' }); document.getElementById('btn-family').after(fl); }
    fl.innerHTML = '';
    FAMILIES.forEach(f => fl.append(el('a', { href: '?family=' + f.id + '#/' + route(), class: s.family === f.id ? 'on' : '', title: f.label + (f.note ? ': ' + f.note : ''),
      onclick: e => { e.preventDefault(); if (s.family !== f.id) loadBuiltin(false, f.id); } }, f.short || f.label)));

    const fm = document.getElementById('menu-family');
    fm.innerHTML = '';
    fm.append(el('div', { class: 'caps', text: s.builtin ? (s.family === defaultFamily().id ? 'Built-in family' : 'A family on this site') : s.source === 'wikitree' ? 'From WikiTree' + (s.wikitree ? ': ' + s.wikitree.key : '') : 'Your file' }), el('h3', { text: s.title }),
      el('p', { class: 'muted', style: { margin: '2px 0 0' }, text: ui.fmt(s.data.people.length) + ' people, ' + ui.fmt(s.data.families.length) + ' families' + (s.data.livingCount ? ', ' + s.data.livingCount + ' possibly living' + (s.data.hideLiving ? ' (hidden)' : '') : '') }));
    const pick = ui.picker('Home person', s.home, p => FO.setHome(p));
    fm.append(el('div', { class: 'row' }, pick));
    const row = el('div', { class: 'row' });
    row.append(el('button', { class: 'pill small', text: 'Load your family file', onclick: () => document.getElementById('file').click() }));
    fm.append(row);
    // the other families published with the site
    const others = FAMILIES.filter(f => f.id !== s.family);
    if (others.length) {
      fm.append(el('div', { class: 'caps', style: { marginTop: '16px' }, text: s.family ? 'Other families on this site' : 'Families on this site' }));
      const fr = el('div', { class: 'row' });
      others.forEach(f => fr.append(el('button', { class: 'pill small dark', text: f.label, title: f.note || '', onclick: () => loadBuiltin(false, f.id) })));
      fm.append(fr);
    }
    if (!s.builtin) {
      if (s.source !== 'wikitree' || CLEAN_COPY_FROM_WIKITREE) row.append(el('button', { class: 'pill small dark', text: 'Save a cleaned copy', title: 'A copy without notes, sources or living people, safe to share or to publish as a built-in family', onclick: saveClean }));
      const cb = el('input', { type: 'checkbox', onchange: () => { s.hideLiving = cb.checked; useText(s.text, s.title, false, s.source); } });
      cb.checked = s.hideLiving;
      fm.append(el('label', { class: 'row', style: { fontSize: '14px', gap: '8px' } }, cb, 'Hide people who may be living'));
    }
    fm.append(el('p', { class: 'muted', style: { fontSize: '13px', margin: '14px 0 0' }, text: s.source === 'wikitree' ? 'Fetched from WikiTree when you asked: only what WikiTree shows publicly, kept only while this page is open.' : s.family ? 'Published on this site, cleaned of notes, sources and living people, and always shown in its newest version. A file you load yourself is read in your browser only; it is never uploaded.' : 'A file you load is read in your browser only. It is never uploaded.' }));
  }

  /* "Save a cleaned copy" for a family fetched from WikiTree: switched on for testing while WikiTree
     considers the feature. Set to false to hide the button again for WikiTree families. */
  const CLEAN_COPY_FROM_WIKITREE = true;

  function saveClean() {
    const s = FO.state;
    const full = FO.parseGedcom(s.text, { hideLiving: false });
    const text = FO.cleanCopy(full, s.title);
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type: 'text/plain' })), download: 'family.ged.txt' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    ui.toast('Saved family.ged.txt: ' + full.people.filter(p => p.living && p !== full.home).length + ' people who may be living are unnamed in it, and notes and sources are left out.');
  }

  /* The family's name on the home page, in three parts like a book title: a small opening word ("My"),
     the names large and bold ("SAVOIE · BREAU"), and a small closing word ("FAMILY"). Any title works:
     the small lines appear only when the title has such words, and a long name comes down a size. */
  function titleParts(title) {
    let t = String(title || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/\s+(ged|gedcom)$/i, '');
    let pre = '', post = '';
    const a = t.match(/^(my|our|the|ma|mon|mes|notre|nos)\s+(.+)$/i);
    if (a) { pre = a[1]; t = a[2]; }
    const b = t.match(/^(.+?)\s+(family tree|family|families|famille|familles|ancestors|ancestry|tree)$/i);
    if (b) { t = b[1]; post = b[2]; }
    // "Savoie/Breau" and "Savoie·Breau" both become "Savoie · Breau"; the dot stays with the name before it if the line wraps
    const core = t.replace(/\s*[\/·•]\s*/g, '\u00a0· ').trim();
    return core ? { pre, core, post } : { pre: '', core: String(title || 'Family'), post: '' };
  }
  function familyTitle(title) {
    const t = titleParts(title);
    const h = el('h1', { class: 'family-title' + (t.core.length > 16 ? ' long' : ''), 'aria-label': title });
    if (t.pre) h.append(el('span', { class: 'ft-small', text: t.pre }));
    h.append(el('span', { class: 'ft-core', text: t.core }));
    if (t.post) h.append(el('span', { class: 'ft-small', text: t.post }));
    // keep the names on one line: step the size down a little until they fit their column; a single long word
    // keeps stepping down, while several words that still do not fit go back to full size and wrap instead
    const core = h.querySelector('.ft-core');
    const fit = () => {
      if (!h.isConnected) return;
      core.style.fontSize = ''; core.style.whiteSpace = 'nowrap';
      const base = parseFloat(getComputedStyle(core).fontSize), oneWord = !/\s/.test(core.textContent.trim());
      let size = base;
      const floor = oneWord ? 22 : base * 0.74;
      while (core.scrollWidth > h.clientWidth + 1 && size > floor) { size -= 1; core.style.fontSize = size + 'px'; }
      if (core.scrollWidth > h.clientWidth + 1 && !oneWord) { core.style.whiteSpace = ''; core.style.fontSize = ''; }
    };
    requestAnimationFrame(fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe(h);
    return h;
  }
  FO.titleParts = titleParts;

  /* ---------- the families published with the site ----------
     Each is a cleaned GEDCOM in site/data. DEFAULT_FAMILY (an id below) is the one the site opens on; the list's order
     is the order of the menus and of the About page. A link such as ?family=savoie opens another one directly. Replace a file in site/data to update it: visitors always get the newest copy.
     title: shown as the family's name; leave it out to use the title written in the file (_TITLE).
     short: the name in the Harbour design's side menu, under The family. */
  const DEFAULT_FAMILY = 'acadians-plus';
  const FAMILIES = [
    { id: 'savoie', file: 'data/family.ged.txt', label: 'My Savoie · Breau family', short: 'Savoie · Breau' },
    { id: 'acadians', file: 'data/Acadians.GED.txt', label: 'The Acadians', short: 'Acadians', note: 'about 23,000 people from the WikiTree Acadians Project' },
    { id: 'acadians-plus', file: 'data/AcadiansPlus.GED.txt', label: 'The Acadians and their spouses', short: 'Acadians + spouses', title: 'The Acadians and their spouses', note: 'the Acadians with the spouses who married into them, about 27,000 people' }];
  FO.FAMILIES = FAMILIES;
  const familyOf = id => FAMILIES.find(f => f.id === id);
  const defaultFamily = () => familyOf(DEFAULT_FAMILY) || FAMILIES[0];
  // keep ?family= in the address in step with the family shown, so the link can be shared or bookmarked
  function setFamilyParam(id) {
    const u = new URL(location.href);
    if (id && id !== defaultFamily().id) u.searchParams.set('family', id); else u.searchParams.delete('family');
    if (id) u.searchParams.delete('wt');
    if (u.href !== location.href) history.replaceState(null, '', u.href);
  }

  /* ---------- loading ---------- */
  function useText(text, title, builtin, source, family) {
    const s = FO.state;
    const data = FO.parseGedcom(text, { hideLiving: builtin ? true : s.hideLiving });
    if (!data.people.length) { ui.toast('No people were found in that file. Is it a GEDCOM (.ged) file?'); return false; }
    s.data = data; s.text = builtin ? null : text; s.builtin = builtin; s.source = builtin ? 'builtin' : (source || 'file'); if (s.source !== 'wikitree') s.wikitree = null; s.home = data.home; s.subject = null; s.pair = null; s.founder = null;
    s.family = builtin ? (family || defaultFamily()).id : null;
    s.title = (family && family.title) || data.head.title || title;   // a title written in the file wins; otherwise the file's name
    if (!builtin) setFamilyParam(null);
    kinCache = null;
    render();
    return true;
  }
  function loadBuiltin(atBoot, id) {
    const fam = familyOf(id) || defaultFamily();
    if (atBoot !== true) { closeMenus(); ui.toast('Loading ' + fam.label + '…'); }
    // "no-cache": the browser checks with the server first, so an updated file is always the one shown
    fetch(fam.file, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      // at start-up, a family the visitor asked for while this one was loading (a WikiTree link) wins
      .then(buf => {
        if (atBoot === true && FO.state.source && FO.state.source !== 'builtin') return;
        if (useText(FO.decodeBuffer(buf), fam.label, true, null, fam)) { setFamilyParam(fam.id); if (atBoot !== true) ui.toast('Loaded ' + FO.state.title + ': ' + ui.fmt(FO.state.data.people.length) + ' people.'); }
      })
      .catch(() => {
        if (atBoot === true && FO.state.source && FO.state.source !== 'builtin') return;
        if (fam !== defaultFamily()) { ui.toast(fam.label + ' could not be fetched.'); if (!FO.state.data) loadBuiltin(atBoot); return; }
        const page = document.getElementById('page');
        page.innerHTML = '';
        page.append(el('div', { class: 'loading' }, el('div', { style: { textAlign: 'center', maxWidth: '30em' } },
          el('h2', { text: 'Load a family file to begin' }),
          el('p', { text: 'The family could not be fetched (this happens when the page is opened straight from a folder rather than from a web server). You can still load any GEDCOM file from your computer.' }),
          el('button', { class: 'pill', text: 'Load your family file', onclick: () => document.getElementById('file').click() }))));
      });
  }
  function loadFile(file) {
    if (!file) return;
    const rd = new FileReader();
    rd.onload = () => {
      const name = file.name.replace(/\.[^.]+$/, '');
      FO.state.hideLiving = true;
      if (useText(FO.decodeBuffer(rd.result), name, false, 'file')) ui.toast('Loaded ' + file.name + '. It stays on this device.');
    };
    rd.onerror = () => ui.toast('That file could not be read.');
    rd.readAsArrayBuffer(file);
  }

  FO.loadText = function (text, title, source) { FO.state.hideLiving = true; return useText(text, title, false, source); };
  FO.closeMenus = function () { closeMenus(); const b = document.getElementById('wt-btn'); if (b) b.setAttribute('aria-expanded', 'false'); };

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    document.body.append(tipEl);
    FO.views.sort((a, b) => a.order - b.order);
    const file = document.getElementById('file');
    file.addEventListener('change', () => { loadFile(file.files[0]); file.value = ''; });
    document.getElementById('load-btn').addEventListener('click', () => file.click());
    const toggle = (btnId, menuId) => {
      const b = document.getElementById(btnId), m = document.getElementById(menuId);
      b.addEventListener('click', e => { e.stopPropagation(); const open = !m.classList.contains('open'); closeMenus(); if (open) { m.classList.add('open'); b.setAttribute('aria-expanded', 'true'); } });
      m.addEventListener('click', e => e.stopPropagation());
    };
    toggle('btn-views', 'menu-views'); toggle('btn-family', 'menu-family');
    document.addEventListener('click', closeMenus);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenus(); FO.select(null); } });
    const drop = document.getElementById('drop');
    let depth = 0;
    window.addEventListener('dragenter', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { depth++; drop.classList.add('on'); } });
    window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) drop.classList.remove('on'); });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => { e.preventDefault(); depth = 0; drop.classList.remove('on'); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
    window.addEventListener('hashchange', render);
    render();
    // ?family=acadians opens one of the site's other families; a WikiTree link (?wt=) is handled in wikitree.js
    const asked = new URLSearchParams(location.search).get('family');
    loadBuiltin(true, familyOf(asked) ? asked : null);
  });
})();
