/* Family Observatory: designs.
   Adds a small switcher above the header and recolours the whole site for each design:
   the stylesheet is re-read with its colours swapped, and every colour the views draw
   (canvas, SVG, d3 scales) is swapped at the moment it is drawn, so no view needs editing.
   DEFAULT_DESIGN (an id below) is the design for new visitors (and for anyone whose saved choice no longer exists);
   a visitor's choice is kept in a cookie (and in local storage as a fallback) for a year. */
(function () {
  'use strict';
  const FO = window.FO || {}, T = FO.T || (s => s);   // js/i18n.js, loaded just before

  /* The colours the site uses today, by role. Every design maps these roles to its own colours. */
  const SRC = {
    bg: '#EEE9DF', snow: '#F7F4EE', snow2: '#F4F0E8', soft: '#E0DACE', soft2: '#DDD7CA', soft3: '#D5CFC2',
    line: '#C9C1B1', other: '#B3AC9C', white: '#FFFFFF',
    ink: '#1B2632', ink2: '#3D4B5E', ink3: '#7C8088', deep: '#2C3B4D', navy: '#22344A',
    mid: '#8FA8BD', pale: '#DCE3EA', pale2: '#E6EAEE', tiptext: '#D8DDE3',
    red: '#A35139', redsoft: '#FFE3C2', peach: '#FFE8CF', blush: '#F3C9A0', flax: '#FFB162', peach2: '#F9D3A6', orange: '#E8975A',
    redtext: '#6E2F1D', redtext2: '#5E2A1A',
    teal: '#2B80AA', c3: '#DB8328', c4: '#5450A8', c5: '#C9628E', c6: '#588C46', c7: '#8A62B8',
    bubble: '#EEEEEE'   // the inside of The Tangle's bubbles (BUBBLE_FILL in tangle.js)
  };

  const DEFAULT_DESIGN = 'harbour';
  const DESIGNS = [
    { id: 'ochre', name: T('Ochre'), note: T('Ivory, olive, mustard and burnt orange, on cardboard'),
      pal: { bg: '#E5E1D6', snow: '#F8F5EC', snow2: '#F6F2E8', soft: '#E4DFD1', soft2: '#E0DACB', soft3: '#D7D0BF', line: '#CAC2AE', other: '#B2AA94', white: '#FFFDF8',
        ink: '#2E3A2F', ink2: '#4B5749', ink3: '#848574', deep: '#3D4F3E', navy: '#34452F', mid: '#A3AE8E', pale: '#E6E8DA', pale2: '#EBECE1', tiptext: '#E0E3D6',
        red: '#BF5F2A', redsoft: '#F6DCC6', peach: '#F7E6CF', blush: '#EDC79B', flax: '#DFA53B', peach2: '#F2D6AF', orange: '#D98A3D', redtext: '#6E3214', redtext2: '#6A3012',
        teal: '#5B7550', c3: '#D49A2E', c4: '#56648F', c5: '#B86F7A', c6: '#3F7A74', c7: '#86688C', bubble: '#EDEBE3' } },
    { id: 'mineral', name: T('Mineral'), note: T('Warm mineral, deep ink and smoked oak, on travertine'),
      pal: { bg: '#E9E3D8', snow: '#F3EFE8', snow2: '#F0EBE3', soft: '#DDD5C8', soft2: '#D9D1C3', soft3: '#D0C7B8', line: '#C3B9A8', other: '#ADA391', white: '#FDFBF7',
        ink: '#293541', ink2: '#46525F', ink3: '#81796F', deep: '#2F3E4E', navy: '#2A3644', mid: '#8E9BA8', pale: '#E2E0DA', pale2: '#E8E5DF', tiptext: '#D9DCDF',
        red: '#8F4E32', redsoft: '#EED9C6', peach: '#F1E2D0', blush: '#E2C3A2', flax: '#D7A46A', peach2: '#EAD0B2', orange: '#C98A55', redtext: '#5C3422', redtext2: '#5A3020',
        teal: '#4D6E8C', c3: '#C08A3E', c4: '#5E5A8E', c5: '#B2697C', c6: '#6E8550', c7: '#84648F', bubble: '#EFEBE5' } },
    { id: 'sage', name: T('Sage'), note: T('Cream, sage, greige and terracotta'),
      pal: { bg: '#F2EFE8', snow: '#F8F6F1', snow2: '#F5F2EC', soft: '#E3DFD5', soft2: '#DFDACF', soft3: '#D6D0C4', line: '#C9C3B5', other: '#B2AC9E', white: '#FFFEFB',
        ink: '#33372F', ink2: '#50564C', ink3: '#83867D', deep: '#3E4B3C', navy: '#34443A', mid: '#9DAE98', pale: '#E1E6DC', pale2: '#E7EAE2', tiptext: '#DDE2D8',
        red: '#B0603F', redsoft: '#F3DCCF', peach: '#F4E3D6', blush: '#E8C3AA', flax: '#D9A06C', peach2: '#EFD3BE', orange: '#CF8458', redtext: '#6A3420', redtext2: '#66321F',
        teal: '#5F7D5B', c3: '#C9913F', c4: '#5D6A8C', c5: '#B66F7E', c6: '#8D8A45', c7: '#86688C', bubble: '#EDEEE8' } },
    { id: 'slate', name: T('Slate'), note: T('Cool stone, slate blue and navy, on limestone'),
      pal: { bg: '#ECEBE7', snow: '#F5F5F2', snow2: '#F2F2EE', soft: '#E0DFDA', soft2: '#DBDAD4', soft3: '#D2D1CA', line: '#C4C4BD', other: '#AAABA6', white: '#FDFDFB',
        ink: '#1F2B3A', ink2: '#415062', ink3: '#7A8088', deep: '#2A3D52', navy: '#1F2F45', mid: '#8DA2B8', pale: '#DFE5EB', pale2: '#E5E9EE', tiptext: '#D6DCE3',
        red: '#9C5B4A', redsoft: '#F0DCD3', peach: '#EFE3DA', blush: '#DCC3B6', flax: '#C9A27A', peach2: '#E6D3C6', orange: '#C08668', redtext: '#5E3226', redtext2: '#5A3024',
        teal: '#4A6D8F', c3: '#B98B4E', c4: '#5B5F95', c5: '#B06C86', c6: '#5F8467', c7: '#7F6A9E', bubble: '#EDEFF1' } },
    { id: 'aurora', name: T('Aurora'), note: T('Navy, blush and sage grey, rounded and flat'),
      pal: { bg: '#F4EFE9', snow: '#FAF7F3', snow2: '#F7F3EE', soft: '#E7DED4', soft2: '#E3D9CE', soft3: '#DACFC3', line: '#CDC2B5', other: '#B5AA9D', white: '#FFFEFD',
        ink: '#24344A', ink2: '#46566B', ink3: '#85898F', deep: '#25354B', navy: '#26364C', mid: '#94A5B6', pale: '#E4E8EC', pale2: '#E9ECEF', tiptext: '#D8DEE6',
        red: '#B56B52', redsoft: '#F3DDD2', peach: '#F2E2D6', blush: '#E8D4C4', flax: '#D9AE84', peach2: '#EED6C5', orange: '#CC8C6C', redtext: '#6B3524', redtext2: '#673322',
        teal: '#5B7D78', c3: '#C99A5B', c4: '#5A5E8F', c5: '#B9738A', c6: '#7D8F6B', c7: '#8A7196', bubble: '#F1ECE7' } },
    { id: 'gilt', name: T('Gilt'), note: T('Charcoal, greys and gold, on white paper'),
      pal: { bg: '#ECEBE8', snow: '#F7F7F5', snow2: '#F4F4F2', soft: '#E3E2DF', soft2: '#DFDEDA', soft3: '#D5D4D0', line: '#C5C4BF', other: '#B9B7B1', white: '#FDFDFC',
        ink: '#1E1E1E', ink2: '#424242', ink3: '#7E7C78', deep: '#2B2B2B', navy: '#262626', mid: '#9B9994', pale: '#E5E4E1', pale2: '#EAE9E7', tiptext: '#DCDBD8',
        red: '#A67C2E', redsoft: '#F1E6C9', peach: '#F3EBD7', blush: '#E6D3A4', flax: '#C9A445', peach2: '#EEDFB9', orange: '#C29441', redtext: '#5A4314', redtext2: '#564010',
        teal: '#3D3D3D', c3: '#C9A446', c4: '#7B7B7B', c5: '#946F2F', c6: '#DCC88D', c7: '#5D554B', bubble: '#EEEDEB' } },
    { id: 'harbour', name: T('Harbour'), note: T('A dark navy menu down the left, on soft linen'),
      pal: { bg: '#EDEAE4', snow: '#F6F4F0', snow2: '#F3F1EC', soft: '#E2DED6', soft2: '#DEDAD1', soft3: '#D5D0C6', line: '#C7C1B6', other: '#ADA79C', white: '#FEFDFB',
        ink: '#1D2939', ink2: '#3E4C5E', ink3: '#7B8089', deep: '#26364A', navy: '#1F2E42', mid: '#8EA1B6', pale: '#DEE4EA', pale2: '#E4E9ED', tiptext: '#D5DCE4',
        red: '#B4553C', redsoft: '#F4DCD2', peach: '#F3E4D8', blush: '#E4C2AE', flax: '#E0A84F', peach2: '#EED4C2', orange: '#CF8460', redtext: '#663020', redtext2: '#622E1E',
        teal: '#3D7397', c3: '#D19A3E', c4: '#5C5A96', c5: '#B9688A', c6: '#5B8A63', c7: '#8268A6', bubble: '#EEF0F2' } }
  ];

  const defaultDesign = () => DESIGNS.find(d => d.id === DEFAULT_DESIGN) || DESIGNS[0];

  /* ---------- colour translation ---------- */
  const hex6 = s => s.replace('#', '').toUpperCase();
  const rgbOf = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  const SRC_KEYS = new Set(Object.values(SRC).map(hex6));
  let map = null;          // source hex -> design hex
  let special = null;      // exact strings with their own replacement
  let cache = new Map();
  const RE = /#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])|rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+%?)\s*)?\)/g;

  function swap(str) {
    if (!map || typeof str !== 'string' || (str.indexOf('#') < 0 && str.indexOf('rgb') < 0)) return str;
    let out = cache.get(str);
    if (out !== undefined) return out;
    if (special && special[str.replace(/\s+/g, '')]) out = special[str.replace(/\s+/g, '')];
    else out = str.replace(RE, (m, h, r, g, b, a) => {
      if (h) {
        let six = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6);
        const t = map[six.toUpperCase()];
        if (!t) return m;
        return '#' + t + (h.length === 8 ? h.slice(6) : '');
      }
      const key = [r, g, b].map(n => (+n).toString(16).padStart(2, '0')).join('').toUpperCase();
      const t = map[key];
      if (!t) return m;
      const c = rgbOf(t);
      return a != null ? 'rgba(' + c.join(',') + ',' + a + ')' : 'rgb(' + c.join(',') + ')';
    });
    if (cache.size > 6000) cache = new Map();
    cache.set(str, out);
    return out;
  }

  /* ---------- hooks: every colour the views draw passes through swap() ---------- */
  const C2D = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (C2D) ['fillStyle', 'strokeStyle', 'shadowColor'].forEach(k => {
    const d = Object.getOwnPropertyDescriptor(C2D, k);
    if (d && d.set) Object.defineProperty(C2D, k, { configurable: true, enumerable: d.enumerable, get: d.get, set(v) { d.set.call(this, typeof v === 'string' ? swap(v) : v); } });
  });
  if (window.CanvasGradient) {
    const acs = CanvasGradient.prototype.addColorStop;
    CanvasGradient.prototype.addColorStop = function (o, c) { return acs.call(this, o, swap(c)); };
  }
  const ATTRS = new Set(['fill', 'stroke', 'stop-color', 'color', 'style', 'flood-color']);
  const setAttr = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) { return setAttr.call(this, n, map && typeof v === 'string' && ATTRS.has(n) ? swap(v) : v); };
  const setProp = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (n, v, p) { return setProp.call(this, n, map && typeof v === 'string' ? swap(v) : v, p); };
  /* markup written as text (icons, the About page) is swapped once it is added */
  function paintTree(root) {
    if (!map || !root.querySelectorAll) return;
    const list = root.matches && root.matches('[fill],[stroke],[style]') ? [root] : [];
    root.querySelectorAll('[fill^="#"],[stroke^="#"],[style*="#"],[style*="rgb"],[fill^="rgb"],[stroke^="rgb"]').forEach(e => list.push(e));
    list.forEach(e => ['fill', 'stroke', 'style'].forEach(a => { const v = e.getAttribute(a); if (v) { const s = swap(v); if (s !== v) setAttr.call(e, a, s); } }));
  }
  new MutationObserver(recs => { if (!map) return; recs.forEach(r => r.addedNodes.forEach(n => n.nodeType === 1 && paintTree(n))); })
    .observe(document.documentElement, { childList: true, subtree: true });
  function wrapInterp(fn) {
    const w = (a, b) => fn(swap(a), swap(b));
    if (fn.gamma) w.gamma = g => wrapInterp(fn.gamma(g));
    return w;
  }

  /* ---------- choosing a design ---------- */
  const COOKIE = 'fo-design';
  function readChoice() {
    const m = document.cookie.match(/(?:^|;\s*)fo-design=([a-z]+)/);
    if (m) return m[1];
    try { return localStorage.getItem(COOKIE); } catch (e) { return null; }
  }
  function saveChoice(id) {
    try { document.cookie = COOKIE + '=' + id + '; max-age=31536000; path=/; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) {}
    try { localStorage.setItem(COOKIE, id); } catch (e) {}
  }
  function pick() {
    let id = null;
    try { id = new URLSearchParams(location.search).get('design'); } catch (e) {}
    if (id && DESIGNS.some(d => d.id === id)) saveChoice(id);
    else id = readChoice();
    return DESIGNS.find(d => d.id === id) || defaultDesign();
  }
  let current = pick();
  const root = document.documentElement;
  root.setAttribute('data-design', current.id);
  if (current.pal) root.classList.add('fo-pending');
  setTimeout(() => root.classList.remove('fo-pending'), 1500);

  let baseCss = null;
  function cssText() {
    if (baseCss) return Promise.resolve(baseCss);
    const link = document.getElementById('base-css');
    return fetch(link.getAttribute('href')).then(r => r.text()).then(t => (baseCss = t.replace(/url\((['"]?)\.\.\//g, 'url($1')));
  }

  function apply(d) {
    current = d;
    root.setAttribute('data-design', d.id);
    cache = new Map();
    if (d.pal) {
      map = {}; Object.keys(SRC).forEach(k => { if (d.pal[k]) map[hex6(SRC[k])] = hex6(d.pal[k]); });
      // keep translation one-way: no design colour may also be a source colour
      Object.keys(map).forEach(k => { const v = map[k]; if (v !== k && SRC_KEYS.has(v)) console.warn('design colour collides with a source colour', v); });
      const ink = rgbOf(map[hex6(SRC.ink)]);
      // the line from a chosen ancestor down to the home person (Ancestors Through Time): lighter than before
      special = { 'rgba(27,38,50,.8)': 'rgba(' + ink.join(',') + ',.46)' };
    } else { map = null; special = null; }
    const link = document.getElementById('base-css');
    let st = document.getElementById('design-css');
    if (!d.pal) {
      if (st) st.remove();
      link.disabled = false;
      root.classList.remove('fo-pending');
      after();
      return Promise.resolve();
    }
    return cssText().then(t => {
      if (!st) { st = document.createElement('style'); st.id = 'design-css'; link.after(st); }
      st.textContent = swap(t);
      link.disabled = true;
      root.classList.remove('fo-pending');
      after();
    }).catch(() => { root.classList.remove('fo-pending'); });
  }
  function after() {
    paintBar();
    paintTree(document.body || root);
    if (window.FO && FO.state && FO.state.data && FO.render) {
      const sel = document.querySelector('.drawer.open h2');
      FO.render();
      if (sel && FO.state.data) { const p = FO.state.data.people.find(q => q.name === sel.textContent); if (p) setTimeout(() => FO.select(p), 30); }
    }
  }

  /* ---------- the switcher ---------- */
  let bar = null;
  function paintBar() {
    if (!bar) return;
    bar.querySelectorAll('button[data-id]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.id === current.id)));
    const n = bar.querySelector('.ds-note'); if (n) n.textContent = current.note;
  }
  function buildBar() {
    bar = document.createElement('div');
    bar.className = 'design-bar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', T('Try a design'));
    const lab = document.createElement('span'); lab.className = 'ds-label'; lab.textContent = T('Design'); bar.append(lab);
    DESIGNS.forEach(d => {
      const b = document.createElement('button');
      b.type = 'button'; b.dataset.id = d.id; b.title = d.note;
      const sw = document.createElement('i');
      const p = d.pal || { bg: SRC.bg, ink: SRC.ink, red: SRC.red, teal: SRC.teal };
      sw.style.background = 'linear-gradient(90deg,' + [p.bg, p.teal, p.red, p.ink].map((c, i, a) => c + ' ' + (i * 25) + '% ' + ((i + 1) * 25) + '%').join(',') + ')';
      b.append(sw, document.createTextNode(d.name));
      b.addEventListener('click', () => { saveChoice(d.id); apply(d); });
      bar.append(b);
    });
    const note = document.createElement('span'); note.className = 'ds-note'; bar.append(note);
    if (FO.langSwitch) bar.append(FO.langSwitch());   // FR | EN, at the right end (js/i18n.js)
    document.body.prepend(bar);
    paintBar();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (window.d3 && d3.interpolateRgb) d3.interpolateRgb = wrapInterp(d3.interpolateRgb);
    buildBar();
    apply(current);
  });
  window.FO_DESIGNS = { list: DESIGNS, apply: id => apply(DESIGNS.find(d => d.id === id) || defaultDesign()), swap };
})();
