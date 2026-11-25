/* Family Observatory: languages.
   English is written in the code; every visible string goes through T('English text'), which looks it up in the
   dictionary of the chosen language (js/lang/fr.js) and falls back to the English. Words that change with the
   person or the numbers are named in braces: T('Born in {place}', { place }) - the translation may move them.
   The language is chosen by ?lang=fr or ?lang=en in a link, else by the visitor's saved choice, else DEFAULT_LANG.
   Changing it saves the choice (the same cookie as the other remembered choices) and reloads the page.
   After editing a dictionary, raise DICT_VERSION so browsers fetch the new copy; node tools/check-french.js lists
   the strings that still lack a translation. */
(function () {
  'use strict';
  const FO = (window.FO = window.FO || {});
  const DEFAULT_LANG = 'en';
  const DICT_VERSION = 1;
  const LANGS = [{ id: 'en', label: 'EN', name: 'English' }, { id: 'fr', label: 'FR', name: 'Français' }];
  const ids = LANGS.map(l => l.id);

  // the saved choice is read straight from the cookie (the shared preferences are set up later, in app.js)
  let saved;
  try { const m = document.cookie.match(/(?:^|;\s*)fo-prefs=([^;]*)/); if (m) saved = (JSON.parse(decodeURIComponent(m[1])) || {}).lang; } catch (e) {}
  if (!saved) try { saved = (JSON.parse(localStorage.getItem('fo-prefs') || '{}') || {}).lang; } catch (e) {}
  let fromLink = null;
  try { fromLink = new URLSearchParams(location.search).get('lang'); } catch (e) {}
  const lang = ids.includes(fromLink) ? fromLink : ids.includes(saved) ? saved : DEFAULT_LANG;
  FO.LANGS = LANGS;
  FO.lang = lang;
  FO.langFromLink = ids.includes(fromLink) && fromLink !== saved;   // app.js saves it once the preferences exist
  document.documentElement.lang = lang;
  if (lang !== 'en') document.write('<script src="js/lang/' + lang + '.js?v=' + DICT_VERSION + '"><\/script>');

  /* T('Born in {place}', { place }): the translation, with the named words filled in; {{ and }} are literal braces.
     A translation may differ with the person's sex: { m: 'Né', f: 'Née' }, chosen by _sex: 'M' or 'F' among the words
     (FO.sexOf(p) gives it); with no sex known, u is used if given, else m. */
  FO.T = function (s, v) {
    const d = FO.DICT;
    let t = d && Object.prototype.hasOwnProperty.call(d, s) && d[s] != null ? d[s] : s;
    if (typeof t === 'object') { const g = v && v._sex === 'F' ? 'f' : v && v._sex === 'M' ? 'm' : 'u'; t = t[g] != null ? t[g] : t.m; }
    if (t.indexOf('{') < 0 && t.indexOf('}') < 0) return t;
    t = t.replace(/\{\{|\}\}|\{(\w+)\}/g, (m, k) => m === '{{' ? '{' : m === '}}' ? '}' : v && k in v ? v[k] : m);
    return v && FO.lang === 'fr' ? elide(t) : t;
  };
  /* French elision once names and words are filled in: "de Anne" -> "d’Anne", "le arrière-grand-père" -> "l’arrière-grand-père"
     (not before huit, onze, haut… which keep "de"); markup between the two words is kept. */
  const elide = t => t.replace(/(^|[\s(«“>])([dD]e|[lL][ea]|[qQ]ue|[nN]e|[sS]e|[jJ]usque) ((?:<[^>]+>)*)(?=[aeiouyhàâäéèêëîïôöùûüœæAEIOUYHÀÂÄÉÈÊËÎÏÔÖÙÛÜŒÆ])(?!huit|onz|haut|hors|hongr|hollan|yo|Huit|Onz|Haut|Hors|Hongr|Hollan|Yo)/g,
    (m, pre, w, tags) => pre + w.slice(0, -1) + '’' + tags);
  // numbers and ordinals in the reader's language: 1,234 / 1 234; 3rd / 3e
  FO.locale = lang === 'fr' ? 'fr-CA' : 'en-CA';
  FO.num = (n, digits) => n == null ? '' : Number(n).toLocaleString(FO.locale, digits == null ? { maximumFractionDigits: 0 } : { minimumFractionDigits: digits, maximumFractionDigits: digits });

  // the words written in index.html itself (menus, buttons, loading message): translated once, by their exact text
  FO.translateStatic = function (root) {
    if (FO.lang === 'en' || !FO.DICT) return;
    const tr = s => { const k = s.replace(/\s+/g, ' ').trim(); return k && FO.DICT[k] ? s.replace(k, FO.DICT[k]) : s; };
    const walk = node => {
      if (node.nodeType === 3) { const t = tr(node.nodeValue); if (t !== node.nodeValue) node.nodeValue = t; return; }
      if (node.nodeType !== 1 || /^(SCRIPT|STYLE|svg)$/i.test(node.nodeName)) return;
      ['title', 'aria-label', 'placeholder', 'alt', 'content'].forEach(a => { if (node.hasAttribute(a)) node.setAttribute(a, tr(node.getAttribute(a))); });
      node.childNodes.forEach(walk);
    };
    walk(root || document.documentElement);
  };

  // switch language: save it, keep the address's own ?lang= in step, reload
  FO.setLang = function (id) {
    if (!ids.includes(id) || id === FO.lang) return;
    if (FO.prefs) FO.prefs.set('lang', id);
    const u = new URL(location.href);
    // an address with ?lang= gets the new language; otherwise it stays the same, and a page whose address ends in a view
    // (#/fan) would not reload on its own, so it is reloaded outright
    if (u.searchParams.has('lang')) { u.searchParams.set('lang', id); location.replace(u.toString()); }
    else location.reload();
  };
  // the FR | EN switch, built where app.js asks for it
  FO.langSwitch = function () {
    const wrap = document.createElement('span');
    wrap.className = 'lang-switch';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', FO.T('Language'));
    LANGS.slice().reverse().forEach((l, i) => {
      if (i) { const sep = document.createElement('span'); sep.className = 'sep'; sep.textContent = '|'; sep.setAttribute('aria-hidden', 'true'); wrap.append(sep); }
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = l.label; b.lang = l.id; b.title = l.name;
      b.setAttribute('aria-pressed', String(l.id === FO.lang));
      b.addEventListener('click', () => FO.setLang(l.id));
      wrap.append(b);
    });
    return wrap;
  };
})();
