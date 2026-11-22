/* Family Observatory: finding birth and death places on a map.

   Everything happens in the visitor's browser: the base map, the list of countries and regions, and one list of places
   per country (from GeoNames and the French official list of communes) are files on this site, fetched only when the
   Map is opened, and only for the countries the family's places mention. No place name is sent anywhere.

   How a place such as "Mortagne, Perche, France" is found:
   1. Its parts are read from right to left to learn the country and the closest known region: here France, then the
      old province of Perche (historic regions, Acadian settlements and colonial names are in HISTORIC below).
   2. The leftmost parts are then looked up in that country's list of places. When several share the name, the one
      nearest the region wins; failing an exact name, a longer name that starts with it (Mortagne-au-Perche).
   3. If nothing matches, the person is placed at the region itself and marked "known only by region".
   French villages that GeoNames does not list are placed at the centre of their département, marked approximate. */
(function () {
  'use strict';
  const FO = window.FO;
  const BASE = 'data/map/';
  const MAP_VERSION = 3;   // raise when world.json or regions.json is rebuilt, so browsers fetch the new files
  const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const key = s => strip(s).replace(/\(.*?\)/g, ' ').replace(/[-‐‑–’'`.]/g, ' ').replace(/\bste\b/g, 'sainte').replace(/\bst\b/g, 'saint').replace(/\s+/g, ' ').trim();
  // "Colony of Nova Scotia", "Province de Québec", "Nova Scotia Colony" → the name itself
  const bare = k => k.replace(/^(the )?(colonial|province|colony|colonie|state|etat|county|comte|parish|paroisse|diocese|region|kingdom|royaume|duchy|duche|territory|territoire|dominion)( of| de la| de l| du| des| de| d)? /, '')
    .replace(/ (colony|province|county|parish|territory|state)$/, '').trim();

  /* Places pinned by hand, for names the map cannot settle on its own: the place as written in the file (any capitals
     or accents), then where it is: [latitude, longitude]. Add a line to correct any place. */
  const PINS = {
    'Tracadie, Colony of Nova Scotia': [47.514, -64.915],   // Tracadie, New Brunswick (Rod, 2026-11-21)
  };

  /* Places and regions the gazetteers don't know, or know under a modern name: [lat, lon, country, region code, kind, reach]
     kind: 'p' a settlement, 'r' a region (people placed there are "known only by region"), 'x' ignore this part.
     reach: for a region, how far (km) from its centre a town named with it may lie (default 400). */
  const HISTORIC = {};
  const add = (names, v) => names.forEach(n => { HISTORIC[key(n)] = v; });
  // Acadia and New France
  add(['Acadie', 'Acadia', "L'Acadie"], [45.3, -64.6, 'CA', '', 'r']);
  add(['Nouvelle-France', 'New France', 'Canada Nouvelle-France'], [47.0, -71.0, 'CA', '', 'r', 1500]);
  add(['British North America', 'Amérique du Nord britannique', 'British Colonial America', 'Amérique coloniale britannique', 'Amérique du Nord', 'North America'], [46.0, -66.0, 'CA', '', 'r', 2500]);
  add(['Bas-Canada', 'Lower Canada', 'Canada East', 'Canada-Est', 'Province de Québec', 'Quebec Province'], [46.8, -71.5, 'CA', '10', 'r']);
  add(['Haut-Canada', 'Upper Canada', 'Canada West', 'Canada-Ouest'], [44.0, -79.0, 'CA', '08', 'r']);
  add(['Île Saint-Jean', 'Isle Saint-Jean', "St. John's Island", 'Isle St. John', 'Saint John Island', 'St. John Island'], [46.35, -63.25, 'CA', '09', 'r']);
  add(['Île Royale', 'Isle Royale', 'Cape Breton', 'Cap-Breton', 'Cape Breton Island'], [46.1, -60.75, 'CA', '07', 'r']);
  add(['Port-Royal', 'Port Royal', 'Annapolis Royale'], [44.745, -65.511, 'CA', '07', 'p']);   // today's Annapolis Royal, so the two names share one bubble
  add(['Beaubassin'], [45.855, -64.29, 'CA', '07', 'p']);
  add(['Grand-Pré', 'Grand Pré', 'Grand-Pre'], [45.104, -64.307, 'CA', '07', 'p']);
  add(['Les Mines', 'Mines', 'Minas', 'Bassin des Mines'], [45.1, -64.35, 'CA', '07', 'p']);
  add(['Pisiguit', 'Pisiquid', 'Pisiquit', 'Pisiguid', 'Piziquid', 'Pigiguit'], [44.99, -64.13, 'CA', '07', 'p']);
  add(['Cobequid', 'Cobequit', 'Cobeguit'], [45.37, -63.3, 'CA', '07', 'p']);
  add(['Rivière-aux-Canards', 'Riviere aux Canards'], [45.15, -64.42, 'CA', '07', 'p']);
  add(['Rivière-aux-Gaspereaux', 'Gaspereau'], [45.07, -64.3, 'CA', '07', 'p']);
  add(['Chipoudy', 'Chipody', 'Shepody'], [45.75, -64.65, 'CA', '04', 'p']);
  add(['Tintamarre'], [45.9, -64.37, 'CA', '04', 'p']);
  add(['Chignecto', 'Isthmus of Chignecto'], [45.8, -64.3, 'CA', '07', 'r']);
  add(['Beauséjour', 'Fort Beauséjour'], [45.865, -64.29, 'CA', '04', 'p']);
  add(['Port-la-Joye', 'Port La Joie', 'Port-Lajoie', 'Port LaJoye', 'Port-LaJoye', 'Port la Joye'], [46.195, -63.13, 'CA', '09', 'p']);
  add(['Pobomcoup'], [43.68, -65.78, 'CA', '07', 'p']);
  add(['Cap-Sable', 'Cap Sable', 'Cape Sable'], [43.47, -65.62, 'CA', '07', 'p']);
  add(['La Hève', 'La Heve', 'LaHave'], [44.29, -64.36, 'CA', '07', 'p']);
  add(['Mirligueche', 'Merliguèche'], [44.38, -64.31, 'CA', '07', 'p']);
  add(['Chédabouctou', 'Chedabouctou', 'Chedabucto'], [45.39, -61.5, 'CA', '07', 'p']);
  add(['Rivière Saint-Jean', 'Rivière St-Jean', 'Saint John River'], [46.0, -66.6, 'CA', '04', 'r']);
  add(['Jemseg'], [45.83, -66.12, 'CA', '04', 'p']);
  add(['Pentagouet', 'Pentagoët'], [44.39, -68.8, 'US', 'ME', 'p']);
  add(['Restigouche', 'Ristigouche'], [48.0, -66.7, 'CA', '04', 'r']);
  add(['Baie Sainte-Marie', 'Baie-Ste-Marie', 'Baie-Sainte-Marie', "St. Mary's Bay"], [44.33, -66.12, 'CA', '07', 'p']);
  add(['Cap-des-Maringouins', 'Cap des Maringouins', 'Cape Maringouin'], [45.83, -64.47, 'CA', '04', 'p']);
  add(['Chezzetcook', 'Chézetcook'], [44.71, -63.25, 'CA', '07', 'p']);
  add(['Ekoupahag', 'Ekoupag', 'Aukpaque'], [45.95, -66.8, 'CA', '04', 'p']);
  add(['Saint-Pierre-du-Nord', 'St-Pierre-du-Nord', 'Saint-Pierre du Nord'], [46.42, -62.58, 'CA', '09', 'p']);
  add(['Saint-Ours'], [45.884, -73.15, 'CA', '10', 'p']);
  add(["Saint-Jacques-de-l'Achigan", "St-Jacques-de-l'Achigan"], [45.95, -73.574, 'CA', '10', 'p']);
  add(['Plattenville'], [29.995, -91.033, 'US', 'LA', 'p']);
  add(['Port Toulouse', 'Port-Toulouse'], [45.655, -60.87, 'CA', '07', 'p']);
  add(['Sillery'], [46.77, -71.25, 'CA', '10', 'p']);
  add(['Pointe-de-Lévy', 'Pointe-Lévy', 'Pointe de Levy'], [46.8, -71.18, 'CA', '10', 'p']);
  add(['Richibouctou-Village'], [46.656, -64.759, 'CA', '04', 'p']);
  add(['Richibouctou'], [46.681, -64.88, 'CA', '04', 'p']);
  add(['Siknikt'], [45.85, -64.3, 'CA', '04', 'r']);
  add(["Mi'kma'ki", "Mi'kmaq territory"], [45.6, -63.5, 'CA', '', 'r']);
  add(["Île d'Orléans", "Isle d'Orléans", 'Ile of Orleans'], [46.92, -70.97, 'CA', '10', 'r']);
  // provinces under their French names and short forms
  add(['Nouveau-Brunswick', 'NB', 'N.B.', 'N-B'], [46.4, -65.9, 'CA', '04', 'r']);
  add(['Nouvelle-Écosse', 'NS', 'N.S.', 'N-É'], [45.1, -63.4, 'CA', '07', 'r']);
  add(['Île-du-Prince-Édouard', 'Ile du Prince Edouard', 'PEI', 'P.E.I.', 'PE', 'Î.-P.-É.'], [46.35, -63.25, 'CA', '09', 'r']);
  add(['Terre-Neuve', 'Newfoundland', 'NL', 'NF'], [48.5, -56.0, 'CA', '05', 'r']);
  add(['QC', 'PQ', 'P.Q.', 'Qué', 'Que'], [46.8, -71.5, 'CA', '10', 'r']);
  add(['ON', 'Ont'], [44.0, -79.0, 'CA', '08', 'r']);
  // elsewhere
  add(['Saint-Domingue', 'Santo Domingo colony'], [19.0, -72.4, 'HT', '', 'r']);
  add(['Comtat-Venaissin', 'Comtat Venaissin'], [44.05, 5.05, 'FR', '', 'r']);
  // old French provinces
  const fr = (names, lat, lon) => add(names, [lat, lon, 'FR', '', 'r']);
  fr(['Aunis'], 46.16, -1.0); fr(['Perche'], 48.42, 0.7); fr(['Poitou'], 46.55, 0.1); fr(['Saintonge'], 45.75, -0.65);
  fr(['Normandie', 'Normandy'], 49.1, 0.2); fr(['Basse-Normandie'], 49.0, -0.6); fr(['Haute-Normandie'], 49.5, 1.0);
  fr(['Bretagne', 'Brittany'], 48.1, -2.8); fr(['Anjou'], 47.45, -0.5); fr(['Touraine'], 47.3, 0.7); fr(['Maine'], 48.05, 0.2);
  fr(['Champagne'], 48.9, 4.2); fr(['Provence'], 43.75, 6.0); fr(['Bourgogne', 'Burgundy'], 47.2, 4.6); fr(['Picardie', 'Picardy'], 49.75, 2.6);
  fr(['Berry'], 46.9, 2.2); fr(['Limousin'], 45.7, 1.6); fr(['Guyenne'], 44.7, 0.6); fr(['Gascogne', 'Gascony'], 43.7, 0.2);
  fr(['Languedoc'], 43.7, 3.3); fr(['Lorraine'], 48.75, 6.2); fr(['Angoumois'], 45.65, 0.15); fr(['Orléanais'], 47.9, 1.9);
  fr(['Nivernais'], 47.1, 3.5); fr(['Auvergne'], 45.5, 3.1); fr(['Lyonnais'], 45.8, 4.6); fr(['Dauphiné'], 45.2, 5.7);
  fr(['Béarn'], 43.3, -0.6); fr(['Flandre', 'Flanders'], 50.65, 3.0); fr(['Artois'], 50.4, 2.5); fr(['Franche-Comté'], 47.1, 6.0);
  fr(['Alsace'], 48.3, 7.5); fr(['Bourbonnais'], 46.4, 3.0); fr(['Marche'], 46.1, 1.9); fr(['Périgord'], 45.1, 0.7);
  fr(['Quercy'], 44.5, 1.5); fr(['Rouergue'], 44.3, 2.6); fr(['Beauce'], 48.3, 1.6); fr(['Brie'], 48.6, 3.0); fr(['Vexin'], 49.2, 1.8);
  fr(['Aquitaine'], 44.8, 0.0); fr(['Île-de-France', 'Ile de France'], 48.85, 2.35);
  add(['Saint-Servan'], [48.632, -2.01, 'FR', '', 'p']);
  add(['Larochelle'], [46.16, -1.151, 'FR', '', 'p']);
  // British Isles and the United States
  add(['England', 'Angleterre', 'Kingdom of England'], [52.5, -1.5, 'GB', 'ENG', 'r']);
  add(['Scotland', 'Écosse'], [56.5, -4.0, 'GB', 'SCT', 'r']);
  add(['Wales', 'Pays de Galles'], [52.3, -3.7, 'GB', 'WLS', 'r']);
  add(['Louisiane', 'Spanish Louisiana', 'Louisiane espagnole'], [30.5, -91.5, 'US', 'LA', 'r']);
  add(['Upper Louisiana', 'Haute-Louisiane'], [38.6, -90.2, 'US', '', 'r', 600]);
  add(['Attakapas', 'Attakapas Post', 'Poste des Attakapas', 'Les Attakapas'], [30.13, -91.83, 'US', 'LA', 'r', 80]);
  add(['Opelousas Post', 'Poste des Opelousas'], [30.533, -92.081, 'US', 'LA', 'p']);
  add(['Cabanocey', 'Cabahannocer', 'Cabahanocé', 'Cabahanosse', 'Cabanocé'], [30.03, -90.8, 'US', 'LA', 'p']);
  add(['Lafourche-des-Chitimachas', 'Lafourche des Chitimachas'], [30.101, -90.994, 'US', 'LA', 'p']);
  add(['Fausse Pointe', 'Fausse-Pointe'], [30.05, -91.74, 'US', 'LA', 'p']);
  add(['Colony of Nova Scotia', 'Nova Scotia Colony', 'Province of Nova Scotia', 'Colonie de la Nouvelle-Écosse', 'Colonie de Nouvelle-Écosse'], [45.6, -64.5, 'CA', '', 'r', 450]);
  add(['Massachusetts Bay'], [42.3, -71.6, 'US', 'MA', 'r']);
  // parts that say nothing about where
  add(['At Sea', 'En mer', 'Lost at sea', 'Unknown', 'Inconnu', 'New Spain', 'Nouvelle-Espagne', 'Nueva España', 'Spanish Empire'], [0, 0, '', '', 'x']);
  const atSea = k => /^(at sea|en mer|lost at sea|aboard|a bord)\b/.test(k);
  const COUNTRY_EXTRA = { usa: 'US', 'u s a': 'US', us: 'US', 'united states': 'US', 'etats unis': 'US', 'etats unis d amerique': 'US', america: 'US',
    uk: 'GB', 'great britain': 'GB', 'grande bretagne': 'GB', 'royaume uni': 'GB', holland: 'NL', 'pays bas': 'NL', 'canada': 'CA' };

  /* Old names that today belong to another place elsewhere, used only when their province is named:
     [name, country, region code, lat, lon]. Plaisance, Newfoundland is today's Placentia (there is a Plaisance in Quebec). */
  const LOCAL = new Map([
    ['Plaisance', 'CA', '05', 47.244, -53.963]].map(([n, cc, a1, lat, lon]) => [key(n) + '|' + cc + '|' + a1, { lat, lon, name: n, pop: 0 }]));

  const pinKey = place => String(place).split(',').map(p => key(p)).filter(Boolean).join(',');
  const PINNED = new Map(Object.entries(PINS).map(([k, v]) => [pinKey(k), v]));

  let base = null, idx = null;
  const gaz = new Map();          // country → {byKey: Map(key → rows), keys: sorted keys}
  const cache = new Map();

  const getJSON = u => fetch(u).then(r => { if (!r.ok) throw new Error(u + ' ' + r.status); return r.json(); });
  function loadBase() {
    if (base) return base;
    base = Promise.all([getJSON(BASE + 'world.json?v=' + MAP_VERSION), getJSON(BASE + 'regions.json?v=' + MAP_VERSION)]).then(([world, reg]) => {
      const country = new Map(), a1 = new Map(), dep = new Map(), a1byCode = new Map();
      for (const [cc, v] of Object.entries(reg.c)) { const o = { lat: v[2], lon: v[3], cc, kind: 'c', name: v[0] }; country.set(key(v[0]), o); country.set(key(v[1]), o); }
      for (const [k, cc] of Object.entries(COUNTRY_EXTRA)) { const c = [...country.values()].find(o => o.cc === cc); if (c) country.set(k, c); }
      for (const [name, cc, code, lat, lon] of reg.a) { const k = key(name), o = { lat, lon, cc, a1: code, kind: 'a', name }; (a1.get(k) || a1.set(k, []).get(k)).push(o); a1byCode.set(cc + '.' + code, o); }
      for (const [name, cc, c1, c2, lat, lon] of reg.d) {
        const o = { lat, lon, cc, a1: c1, a2: c2, kind: 'd', name };
        for (const k of new Set([key(name), bare(key(name))])) (dep.get(k) || dep.set(k, []).get(k)).push(o);
        dep.set(cc + '.' + c1 + '.' + c2, o);
      }
      idx = { country, a1, dep, a1byCode };
      return world;
    });
    return base;
  }
  function loadCountry(cc) {
    if (!gaz.has(cc)) gaz.set(cc, getJSON(BASE + 'gaz/' + cc + '.json').then(d => {
      const byKey = new Map();
      const put = (k, row) => (byKey.get(k) || byKey.set(k, []).get(k)).push(row);
      for (const [name, lat, lon, a1, a2, pop] of d.p) put(key(name), { name, lat, lon, a1, a2, pop });
      for (const [name, a1, a2] of d.x || []) {
        const c = idx.dep.get(cc + '.' + a1 + '.' + a2);
        if (c) put(key(name), { name, lat: c.lat, lon: c.lon, a1, a2, pop: 0, approx: true });
      }
      return { byKey, keys: [...byKey.keys()].sort() };
    }).catch(() => ({ byKey: new Map(), keys: [] })));
    return gaz.get(cc);
  }

  const km = (a, b) => {
    const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
  };
  const partsOf = place => {
    const out = [];
    for (const raw of String(place).replace(/(\p{L}{3,})\. (?=\p{Lu})/gu, '$1, ').split(',')) {
      const main = raw.replace(/\(.*?\)/g, ' ').trim();
      if (main) out.push(main);
      (raw.match(/\((.*?)\)/g) || []).forEach(m => out.push(m.slice(1, -1)));   // "Montreuil (Seine-Saint-Denis)" also says where
    }
    return out;
  };

  /* A part that names a country or a region (never a town). cc: the country already known, if any. */
  function regionOf(part, cc, a1) {
    const k = key(part); if (!k) return null;
    for (const kk of [k, bare(k)]) {
      const h = HISTORIC[kk];
      if (h) return h[4] === 'x' ? { skip: true } : h[4] === 'r' ? { lat: h[0], lon: h[1], cc: h[2], a1: h[3], kind: 'h', name: part, reach: h[5] || 400 } : null;
      const c = idx.country.get(kk); if (c && (!cc || c.cc === cc)) return c;
      const d = idx.dep.get(kk);
      if (d && cc) { const same = d.filter(o => o.cc === cc && (!a1 || o.a1 === a1)); if (same.length) return same[0]; }
      if (c) { const a = idx.a1.get(kk); if (!a || !a.some(o => o.cc === cc)) return c; }   // "St. Martin, Louisiana": the parish, not Saint-Martin
      const a = idx.a1.get(kk);
      if (a) return (cc && a.find(o => o.cc === cc)) || (!cc && a.length === 1 ? a[0] : null) || (cc ? null : a[0]);
    }
    return null;
  }
  // first pass, before the country lists are loaded: every country a place's parts point to
  function countriesOf(place) {
    const out = new Set(), parts = partsOf(place);
    for (const p of parts) {
      const h = HISTORIC[key(p)] || HISTORIC[bare(key(p))];
      if (h && h[2]) out.add(h[2]);
      else { const r = regionOf(p, ''); if (r && r.cc) out.add(r.cc); }
    }
    const c = countryOf(place); if (c) out.add(c);
    return out;
  }
  function countryOf(place) {
    let cc = '';
    const parts = partsOf(place);
    for (let i = parts.length - 1; i >= 0 && !cc; i--) {
      const h = HISTORIC[key(parts[i])] || HISTORIC[bare(key(parts[i]))];
      if (h && h[2]) cc = h[2];
      else { const r = regionOf(parts[i], ''); if (r && r.cc) cc = r.cc; }
    }
    if (!cc && parts.length === 1) {   // "Caraquet New Brunswick": the last words may name the region
      const w = parts[0].split(/\s+/);
      for (let j = Math.min(3, w.length - 1); j >= 1 && !cc; j--) { const r = regionOf(w.slice(-j).join(' '), ''); if (r && r.cc) cc = r.cc; }
    }
    return cc;
  }

  function findPlace(part, cc, ctx, a1) {
    const h = HISTORIC[key(part)];
    if (h && h[4] === 'p') return { name: part, lat: h[0], lon: h[1] };
    const k = key(part); if (!k) return null;
    if (a1 && LOCAL.has(k + '|' + cc + '|' + a1)) return LOCAL.get(k + '|' + cc + '|' + a1);
    const g = cc && gazReady.get(cc);
    if (!g) return null;
    const regional = ctx && ctx.kind !== 'c';
    let rows = (g.byKey.get(k) || g.byKey.get(bare(k)) || []).slice();
    // "Mortagne" for Mortagne-au-Perche: longer names starting with this one count too, but only near a named region
    if (regional && k.length >= 4) {
      let lo = 0, hi = g.keys.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (g.keys[m] < k + ' ') lo = m + 1; else hi = m; }
      for (let i = lo; i < g.keys.length && g.keys[i].startsWith(k + ' '); i++) rows.push(...g.byKey.get(g.keys[i]).map(r => Object.assign({ longer: true }, r)));
    }
    if (!rows.length && /^(le|la|les|l) /.test(k)) return findPlace(k.replace(/^(le|la|les|l) /, ''), cc, ctx, a1);   // "Le Mirebalais"
    if (!rows.length) {
      // parish names: "Notre-Dame de Québec", "Sainte-Anne-de-la-Pocatière", "Hôtel-Dieu de Québec" → the town after "de"
      const at = k.lastIndexOf(' de ');
      return at > 0 ? findPlace(k.slice(at + 4), cc, ctx, a1) : null;
    }
    let inside = false;
    if (a1) {
      const same = rows.filter(r => r.a1 === a1);
      if (same.length) { rows = same; inside = true; }
      else if (ctx && (ctx.kind === 'a' || ctx.kind === 'd')) return null;   // "St. Martin Parish, Louisiana" is not in Mississippi
    }
    let best = null;
    if (ctx && ctx.kind !== 'c') {
      let bd = Infinity;
      for (const r of rows) { const d = km(ctx, r) - Math.log10(1 + r.pop) * 5 + (r.longer ? 25 : 0) + (r.approx ? 10 : 0); if (d < bd) { bd = d; best = r; } }
      // further than this from the region named: probably another place (inside a named province, anywhere goes)
      const limit = ctx.kind === 'd' ? 120 : inside ? Infinity : ctx.reach || 400;
      if (best && km(ctx, best) > limit) { const at = k.lastIndexOf(' de '); return at > 0 ? findPlace(k.slice(at + 4), cc, ctx, a1) : null; }
    } else { rows = rows.filter(r => !r.longer); best = rows.length ? rows.reduce((a, b) => (b.pop > a.pop ? b : a)) : null; }
    return best;
  }
  const gazReady = new Map();

  /* Where one place is: {lat, lon, level: 'place' | 'region', name, approx} or null */
  function locate(place) {
    if (cache.has(place)) return cache.get(place);
    const pin = PINNED.get(pinKey(place));
    if (pin) { const o = { lat: pin[0], lon: pin[1], level: 'place', name: partsOf(place)[0] || place, approx: false }; cache.set(place, o); return o; }
    const parts = partsOf(place);
    if (parts.some(p => atSea(key(p)))) { cache.set(place, null); return null; }
    let cc = '', ctx = null, ctxI = parts.length;
    const vast = () => ctx && ctx.kind === 'h' && !ctx.a1 && (ctx.reach || 0) >= 1000;
    for (let i = parts.length - 1; i >= 1; i--) {
      let r = regionOf(parts[i], cc, ctx && ctx.a1);
      if (!r && vast()) { r = regionOf(parts[i], ''); if (r && !r.skip && r.cc) cc = r.cc; }
      if (!r || r.skip) continue;
      if (r.cc && cc && r.cc !== cc) { if (!vast()) continue; cc = r.cc; }
      if (r.cc) cc = r.cc;
      if (r.kind === 'c' && ctx) { ctxI = i; continue; }   // "…, Acadie, Canada": keep Acadie
      if (r.kind === 'h' && !r.a1 && ctx && ctx.a1) continue;   // "…, Acadia, New Brunswick": keep New Brunswick
      ctx = r; ctxI = i;
    }
    if (!cc) cc = countryOf(place);
    let out = null;
    for (let i = 0; i < ctxI && !out; i++) {
      // a part that names a country or a historic region is that region, not a hamlet that shares its name
      const asRegion = regionOf(parts[i], cc);
      const townToo = asRegion && asRegion.kind === 'h' && !asRegion.a1 && ctx && ctx.a1;   // L'Acadie, Quebec, is also a town
      if (asRegion && !asRegion.skip && (asRegion.kind === 'c' || asRegion.kind === 'h') && !townToo) continue;
      // a province or state named with nothing more precise after it: a town of that name only if it lies inside
      // ("Québec, Canada" is the city; "Louisiana, New Spain" is the province, not Louisiana, Missouri)
      if (asRegion && !asRegion.skip && asRegion.kind === 'a' && (!ctx || ctx.kind === 'c') && (parts.length < 2 || key(parts[i]) !== bare(key(parts[i])))) continue;
      if (asRegion && !asRegion.skip && asRegion.kind === 'a' && (!ctx || ctx.kind === 'c')) {
        const t = findPlace(parts[i], asRegion.cc, asRegion, asRegion.a1);
        if (t) out = { lat: t.lat, lon: t.lon, level: 'place', name: parts[i], approx: !!t.approx };
        continue;
      }
      let p = findPlace(parts[i], cc, ctx || (cc && idx.country.get(key(regionsName(cc)))), ctx && ctx.a1);
      if (p && townToo && (p.longer || p.approx)) p = null;   // only a town of exactly that name, not a village called "Perche-something"
      if (p) out = { lat: p.lat, lon: p.lon, level: 'place', name: parts[i], approx: !!p.approx };
    }
    if (!out && parts.length) {
      // the most specific region named: "Acadie, Nouvelle-France" is Acadie; "Canada, Nouvelle-France" is New France
      const x = regionOf(parts[0], cc, ctx && ctx.a1), r0 = x && !x.skip ? x : null;
      const r = (r0 && r0.kind !== 'c' ? r0 : null) || ctx || r0;
      if (r) out = { lat: r.lat, lon: r.lon, level: 'region', name: r === r0 ? parts[0] : r.name || parts[ctxI] };
    }
    if (!out && parts.length === 1 && !/,/.test(place)) {
      const w = parts[0].split(/\s+/);
      for (let j = Math.min(3, w.length - 1); j >= 1 && !out; j--) {
        const tail = w.slice(-j).join(' '), r = regionOf(tail, '');
        if (r && !r.skip) { const o = locate(w.slice(0, -j).join(' ') + ', ' + tail); if (o) out = o; }
      }
      if (!out) {   // a town on its own: the biggest place of that name among the countries this family lived in
        let best = null;
        for (const g of gazReady.values()) for (const row of g.byKey.get(key(parts[0])) || []) if (!best || row.pop > best.pop) best = row;
        if (best && best.pop > 2000) out = { lat: best.lat, lon: best.lon, level: 'place', name: parts[0], approx: false };
      }
    }
    cache.set(place, out);
    return out;
  }
  const regionsName = cc => { for (const o of idx.country.values()) if (o.cc === cc) return o.name; return ''; };

  /* Load what a list of places needs; resolves to {world, locate} */
  FO.geoLoad = function (places) {
    return loadBase().then(world => {
      const ccs = new Set();
      for (const p of places) for (const c of countriesOf(p)) ccs.add(c);
      return Promise.all([...ccs].map(cc => loadCountry(cc).then(g => gazReady.set(cc, g)))).then(() => { cache.clear(); return { world, locate }; });
    });
  };
})();
