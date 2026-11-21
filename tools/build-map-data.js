/* Builds the files behind the Map in "Where They Lived" (site/data/map/). Nothing here runs on the website.

   Sources (all free to reuse):
     world-atlas            Natural Earth countries, 1:10m (public domain), ISC packaging
     Natural Earth          ne_10m_admin_1_states_provinces.geojson (public domain), for Canadian and US borders
     cities-500-structured  GeoNames cities500: every place of the world with 500 people or more (CC BY 4.0)
     cities.json            GeoNames names of regions and counties (CC BY 4.0)
     map-sources/placenames-canada.csv   10,676 Canadian places, including small villages (Open Government Licence – Canada)
     @etalab/decoupage-administratif   every French commune and its département (Licence Ouverte)
     i18n-iso-countries     country names in English and French (MIT)

   Run once, from this folder:
     npm i world-atlas topojson-client topojson-server topojson-simplify cities-500-structured cities.json @etalab/decoupage-administratif i18n-iso-countries
     (download ne_10m_admin_1_states_provinces.geojson from github.com/nvkelso/natural-earth-vector, folder geojson)
     node build-map-data.js ne_10m_admin_1_states_provinces.geojson ../site/data/map

   Output:
     world.json     the base map (TopoJSON): countries, plus province and state borders for Canada and the US.
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
const req = m => require(path.resolve('node_modules', m));
const tc = req('topojson-client'), ts = req('topojson-server'), tsim = req('topojson-simplify');
const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const key = s => strip(s).replace(/[-‐‑–’'`.]/g, ' ').replace(/\bste\b/g, 'sainte').replace(/\bst\b/g, 'saint').replace(/\s+/g, ' ').trim();
const r3 = x => Math.round(x * 1000) / 1000;
const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
fs.mkdirSync(path.join(OUT, 'gaz'), { recursive: true });

/* ---------- the base map ---------- */
{
  const w10 = JSON.parse(fs.readFileSync(path.resolve('node_modules/world-atlas/countries-10m.json')));
  const countries = tc.feature(w10, w10.objects.countries);
  countries.features.forEach(f => { f.properties = { name: f.properties.name }; delete f.id; });
  const a1 = JSON.parse(fs.readFileSync(NE_ADMIN1));
  const provinces = { type: 'FeatureCollection', features: a1.features.filter(f => ['CAN', 'USA'].includes(f.properties.adm0_a3)).map(f => ({ type: 'Feature', properties: {}, geometry: f.geometry })) };
  const KEEP = 0.03, BOOST = 100;   // a point survives if its weight is above KEEP; inside FINE its weight counts BOOST times
  const FINE = [[-80, 40, -52, 53.5], [-6, 41, 10, 52]];
  let topo = tsim.presimplify(ts.topology({ countries, provinces }));
  for (const arc of topo.arcs) for (const pt of arc) if (isFinite(pt[2]) && FINE.some(b => pt[0] >= b[0] && pt[0] <= b[2] && pt[1] >= b[1] && pt[1] <= b[3])) pt[2] *= BOOST;
  topo = tsim.simplify(topo, KEEP);
  topo = tsim.filter(topo, tsim.filterWeight(topo, KEEP));
  topo = tc.quantize(topo, 1e5);
  fs.writeFileSync(path.join(OUT, 'world.json'), JSON.stringify(topo));
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
