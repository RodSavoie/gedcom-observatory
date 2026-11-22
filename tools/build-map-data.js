/* Builds the files behind the Map in "Where They Lived" (site/data/map/). Nothing here runs on the website.

   Sources (all free to reuse):
     world-atlas            Natural Earth countries, 1:10m (public domain), ISC packaging
     Natural Earth          ne_10m_admin_1_states_provinces.geojson (public domain), for Canadian and US borders,
                            ne_10m_lakes.geojson (public domain), for lakes, and ne_10m_rivers_lake_centerlines,
                            ne_10m_rivers_north_america and ne_10m_rivers_europe (public domain), for rivers
     cities-500-structured  GeoNames cities500: every place of the world with 500 people or more (CC BY 4.0)
     cities.json            GeoNames names of regions and counties (CC BY 4.0)
     map-sources/placenames-canada.csv   10,676 Canadian places, including small villages (Open Government Licence – Canada)
     @etalab/decoupage-administratif   every French commune and its département (Licence Ouverte)
     i18n-iso-countries     country names in English and French (MIT)

   Run once, from this folder:
     npm i world-atlas topojson-client topojson-server topojson-simplify cities-500-structured cities.json @etalab/decoupage-administratif i18n-iso-countries
     (download ne_10m_admin_1_states_provinces.geojson, ne_10m_lakes.geojson, ne_10m_rivers_lake_centerlines.geojson,
      ne_10m_rivers_north_america.geojson and ne_10m_rivers_europe.geojson from github.com/nvkelso/natural-earth-vector,
      folder geojson, into this folder)
     node build-map-data.js ne_10m_admin_1_states_provinces.geojson ../site/data/map ne_10m_lakes.geojson

   Output:
     world.json     the base map (TopoJSON): countries, lakes, rivers, and province and state borders for Canada and the US.
     world-detail.json  the same, with much finer coastlines and borders, loaded by the site only when someone zooms in.
                    Rivers carry their Natural Earth rank (r: 0 the greatest, 12 the smallest); smaller rivers come only
                    from the detailed areas below.
                    Simplified hard over most of the world, kept fine around Atlantic Canada, New England, the
                    St. Lawrence and western Europe, where Acadian and French-Canadian families lived.
     regions.json   countries (English and French names) and their first-level regions, each with a centre point;
                    counties too for Canada and the US, and French départements.
     gaz/XX.json    one file per country: place name, latitude, longitude, region codes and population. For France,
                    villages GeoNames does not list are added by name and département only (placed at its centre). */
'use strict';
const fs = require('fs'), path = require('path');
const NE_ADMIN1 = process.argv[2] || 'ne_10m_admin_1_states_provinces.geojson';
const OUT = process.argv[3] || '../site/data/map';
const NE_LAKES = process.argv[4] || 'ne_10m_lakes.geojson';
const req = m => require(path.resolve('node_modules', m));
const tc = req('topojson-client'), ts = req('topojson-server'), tsim = req('topojson-simplify');
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const key = s => strip(s).replace(/[-‐‑–’'`.]/g, ' ').replace(/\bste\b/g, 'sainte').replace(/\bst\b/g, 'saint').replace(/\s+/g, ' ').trim();
const r3 = x => Math.round(x * 1000) / 1000;
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
fs.mkdirSync(path.join(OUT, 'gaz'), { recursive: true });

/* ---------- the base map ----------
   Two files: world.json, light, for the whole map, and world-detail.json, finer, which the site loads only once someone
   zooms in. How much detail each keeps is set here: a point of a coastline or border survives if its weight is above
   the number given, so smaller numbers keep more detail (and make a bigger file). Inside FINE (Atlantic Canada, New
   England, the St. Lawrence, western Europe) points count BOOST times, so those areas keep much more.
     WORLD_DETAIL   0.03 → world.json about 880 KB (255 KB as sent by the server)
     ZOOMED_DETAIL  0.001 → world-detail.json about 3.2 MB (1 MB as sent); 0.003 about 2.2 MB; 0 keeps everything */
const WORLD_DETAIL = 0.01, ZOOMED_DETAIL = 0.001, BOOST = 100;
const FINE = [[-80, 40, -52, 53.5], [-6, 41, 10, 52]];
{
  const w10 = JSON.parse(fs.readFileSync(path.resolve('node_modules/world-atlas/countries-10m.json')));
  const countries = tc.feature(w10, w10.objects.countries);
  countries.features.forEach(f => { f.properties = { name: f.properties.name }; delete f.id; });
  const a1 = JSON.parse(fs.readFileSync(NE_ADMIN1));
  const provinces = { type: 'FeatureCollection', features: a1.features.filter(f => ['CAN', 'USA'].includes(f.properties.adm0_a3)).map(f => ({ type: 'Feature', properties: {}, geometry: f.geometry })) };
  const lk = JSON.parse(fs.readFileSync(NE_LAKES));
  const lakes = { type: 'FeatureCollection', features: lk.features.filter(f => f.geometry).map(f => ({ type: 'Feature', properties: {}, geometry: f.geometry })) };
  // rivers: the main set worldwide (without the centre lines drawn through lakes), the smaller supplementary rivers only
  // where the map keeps fine detail
  const inFine = g => { const c = JSON.stringify(g.coordinates).match(/-?\d+(\.\d+)?/g).map(Number); for (let i = 0; i < c.length; i += 2) if (FINE.some(b => c[i] >= b[0] && c[i] <= b[2] && c[i + 1] >= b[1] && c[i + 1] <= b[3])) return true; return false; };
  const riverFile = f => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)).features : [];
  const rivers = { type: 'FeatureCollection', features: [
    ...riverFile('ne_10m_rivers_lake_centerlines.geojson').filter(f => f.geometry && !/lake/i.test(f.properties.featurecla || '')),
    ...riverFile('ne_10m_rivers_north_america.geojson').filter(f => f.geometry && inFine(f.geometry)),
    ...riverFile('ne_10m_rivers_europe.geojson').filter(f => f.geometry && inFine(f.geometry))]
    .map(f => ({ type: 'Feature', properties: { r: Math.round(f.properties.scalerank != null ? f.properties.scalerank : 12) }, geometry: f.geometry })) };

  function build(keep, file, grid) {
    let topo = tsim.presimplify(ts.topology({ countries, provinces, lakes, rivers }));
    for (const arc of topo.arcs) for (const pt of arc) if (isFinite(pt[2]) && FINE.some(b => pt[0] >= b[0] && pt[0] <= b[2] && pt[1] >= b[1] && pt[1] <= b[3])) pt[2] *= BOOST;
    if (keep > 0) {
      topo = tsim.simplify(topo, keep);
      topo = tsim.filter(topo, tsim.filterWeight(topo, keep));
    }
    // Long straight stretches (the 49th parallel, lines across the Great Lakes) are left with few points; a map draws a
    // line between two far-apart points as the shortest route over the globe, which bows north. Add a point every half
    // degree so these borders follow their parallel as they should.
    const STEP = 0.5;
    topo.arcs = topo.arcs.map(arc => {
      const out = [];
      for (let i = 0; i < arc.length; i++) {
        const p = arc[i];
        if (i) {
          const q = arc[i - 1], dx = p[0] - q[0], dy = p[1] - q[1], n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / STEP);
          if (Math.abs(dx) < 180) for (let k = 1; k < n; k++) out.push([q[0] + dx * k / n, q[1] + dy * k / n]);
        }
        out.push([p[0], p[1]]);
      }
      return out;
    });
    topo = tc.quantize(topo, grid);   // positions rounded to a grid this many steps across the world
    fs.writeFileSync(path.join(OUT, file), JSON.stringify(topo));
  }
  build(WORLD_DETAIL, 'world.json', 1e5);
  build(ZOOMED_DETAIL, 'world-detail.json', 1e6);
}

/* ---------- places ---------- */
const admin1 = JSON.parse(fs.readFileSync(path.resolve('node_modules/cities.json/admin1.json')));
const admin2 = JSON.parse(fs.readFileSync(path.resolve('node_modules/cities.json/admin2.json')));
const iso = req('i18n-iso-countries');
iso.registerLocale(req('i18n-iso-countries/langs/en.json')); iso.registerLocale(req('i18n-iso-countries/langs/fr.json'));

const byCountry = new Map();
const addPlace = (cc, p) => (byCountry.get(cc) || byCountry.set(cc, []).get(cc)).push(p);
for (const line of fs.readFileSync(path.resolve('node_modules/cities-500-structured/dist/cities500.txt'), 'utf8').split('\n')) {
  const f = line.split('\t');
  if (f.length < 15) continue;
  const lat = +f[4], lon = +f[5];
  if (!isFinite(lat) || !isFinite(lon)) continue;
  addPlace(f[8], { name: f[1], lat, lon, a1: f[10] || '', a2: f[11] || '', pop: +f[14] || 0 });
}
// Canada: GeoNames misses many villages and parishes, so add the government's list of named places
{
  const PROV = { AB: '01', BC: '02', MB: '03', NB: '04', NL: '05', NS: '07', ON: '08', PE: '09', QC: '10', SK: '11', YT: '12', NT: '13', NU: '14' };
  const have = (byCountry.get('CA') || []);
  const near = (n, lat, lon) => have.some(p => key(p.name) === n && Math.abs(p.lat - lat) < 0.05 && Math.abs(p.lon - lon) < 0.07);
  const rows = fs.readFileSync(path.resolve('map-sources/placenames-canada.csv'), 'utf8').split(/\r?\n/).slice(1);
  const added = [];
  for (const row of rows) {
    const m = row.match(/^("(?:[^"]|"")*"|[^,]*),("(?:[^"]|"")*"|[^,]*),([A-Z]{2}),([-\d.]+),([-\d.]+)$/);
    if (!m) continue;
    const unq = v => v.replace(/^"|"$/g, '').replace(/""/g, '"');
    const [name, nom, pr, lat, lon] = [unq(m[1]), unq(m[2]), m[3], +m[4], +m[5]];
    for (const n of new Set([name, nom])) if (n && !near(key(n), lat, lon)) added.push({ name: n, lat, lon, a1: PROV[pr] || '', a2: '', pop: 0 });
  }
  added.forEach(p => addPlace('CA', p));
}

const regions = { c: {}, a: [], d: [] };
for (const [cc, list] of byCountry) {
  const names = [iso.getName(cc, 'en'), iso.getName(cc, 'fr')].filter(Boolean);
  if (!names.length) continue;
  regions.c[cc] = [names[0], names[1] || names[0], r3(median(list.map(p => p.lat))), r3(median(list.map(p => p.lon)))];
}
for (const a of admin1) {
  const [cc, code] = a.code.split('.');
  const list = (byCountry.get(cc) || []).filter(p => p.a1 === code);
  if (!list.length) continue;
  regions.a.push([a.name, cc, code, r3(median(list.map(p => p.lat))), r3(median(list.map(p => p.lon)))]);
}
for (const a of admin2) {
  const [cc, c1, c2] = a.code.split('.');
  if (!['FR', 'CA', 'US'].includes(cc)) continue;
  const list = (byCountry.get(cc) || []).filter(p => p.a1 === c1 && p.a2 === c2);
  if (!list.length) continue;
  regions.d.push([a.name, cc, c1, c2, r3(median(list.map(p => p.lat))), r3(median(list.map(p => p.lon)))]);
}
fs.writeFileSync(path.join(OUT, 'regions.json'), JSON.stringify(regions));

// French communes GeoNames does not list: name, region and département only
const frExtra = [];
{
  const have = new Set((byCountry.get('FR') || []).map(p => key(p.name) + '|' + p.a2));
  const communes = JSON.parse(fs.readFileSync(path.resolve('node_modules/@etalab/decoupage-administratif/data/communes.json')));
  const seen = new Set();
  for (const c of communes) {
    if (!c.departement || !c.region || c.zone !== 'metro') continue;
    const k = key(c.nom) + '|' + c.departement;
    if (have.has(k) || seen.has(k)) continue;
    seen.add(k); frExtra.push([c.nom, c.region, c.departement]);
  }
}
let total = 0;
for (const [cc, list] of byCountry) {
  const out = { p: list.map(p => [p.name, r3(p.lat), r3(p.lon), p.a1, p.a2, p.pop]) };
  if (cc === 'FR') out.x = frExtra;
  const s = JSON.stringify(out);
  total += s.length;
  fs.writeFileSync(path.join(OUT, 'gaz', cc + '.json'), s);
}
console.log('countries', Object.keys(regions.c).length, 'regions', regions.a.length, 'counties and départements', regions.d.length,
  'places', [...byCountry.values()].reduce((a, l) => a + l.length, 0), 'French villages added', frExtra.length, 'gazetteer MB', (total / 1e6).toFixed(1));
