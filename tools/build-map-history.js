/* Builds site/data/map/history.json: colonial borders of North America at six moments, for the "Old borders" layer of the
   map in Where They Lived. Nothing here runs on the website.

   The borders are drawn by hand from treaty lines and cut out of today's provinces and states (Natural Earth, public
   domain), so they follow the coast exactly. They are approximate: a colonial border was often a claim, disputed, or never
   surveyed, and most of this land was Indigenous country whatever a treaty said.

   Run from this folder, with ne_10m_admin_1_states_provinces.geojson (github.com/nvkelso/natural-earth-vector, folder
   geojson) and world-detail.json beside it:
     npm i topojson-client topojson-server topojson-simplify polygon-clipping
     node build-map-history.js ne_10m_admin_1_states_provinces.geojson ../site/data/map/world-detail.json ../site/data/map

   Each era is a list of regions, drawn in order: a region takes only the land no earlier region of that era has taken,
   so a later, broader region (say, "Rupert's Land") can be drawn loosely around the earlier ones.
   A region: { en, fr: names; p: the power, which sets its colour on the map (fr, gb, es, us, ca, mx, ru; '' for land no
   one held, a shared or disputed land: no colour); at: [lon, lat] where its name goes (none: no name); land: what it covers }. */
'use strict';
const fs = require('fs'), path = require('path');
/* d3 draws a ring clockwise as the inside of a shape and anticlockwise as the outside (GeoJSON files usually go the other
   way): outer rings are set clockwise, holes anticlockwise, measured flat on longitude and latitude */
const signed = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[i][0] - r[j][0]) * (r[i][1] + r[j][1]); return a / 2; };   // > 0: clockwise
const fixPoly = p => p.map((r, i) => ((signed(r) > 0) === (i === 0) ? r : r.slice().reverse()));
const rewind = g => { if (g.type === 'Polygon') g.coordinates = fixPoly(g.coordinates); else if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map(fixPoly); return g; };
const pc = require('polygon-clipping'), tc = require('topojson-client'), ts = require('topojson-server'), tsim = require('topojson-simplify');
const ADMIN1 = process.argv[2] || 'ne_10m_admin_1_states_provinces.geojson';
const WORLD = process.argv[3] || '../site/data/map/world-detail.json';
const OUT = process.argv[4] || '../site/data/map';
const SIMPLIFY = 0.0004;   // how much the borders are smoothed (square degrees); smaller keeps more detail and makes a bigger file

// ---------- the land to cut from ----------
const r5 = x => Math.round(x * 1e4) / 1e4;
const clean = p => p.map(ring => ring.map(([x, y]) => [r5(x), r5(y)]).filter((q, i, a) => i === 0 || q[0] !== a[i - 1][0] || q[1] !== a[i - 1][1])).filter(r => r.length >= 4);
const multi = g => (!g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []).map(clean).filter(p => p.length);
const states = {};
{
  // today's provinces and states, smoothed a little first (with shared borders kept shared) so the cutting is quick
  const a1 = JSON.parse(fs.readFileSync(ADMIN1));
  const fc = { type: 'FeatureCollection', features: a1.features.filter(f => ['CAN', 'USA'].includes(f.properties.adm0_a3) && f.properties.name !== 'Hawaii').map(f => ({ type: 'Feature', properties: { name: f.properties.name }, geometry: f.geometry })) };
  let t = ts.topology({ a: fc }); t = tsim.presimplify(t); t = tsim.simplify(t, SIMPLIFY / 4);
  tc.feature(t, t.objects.a).features.forEach(f => { states[f.properties.name] = multi(f.geometry); });
  const w = JSON.parse(fs.readFileSync(WORLD));
  tc.feature(w, w.objects.countries).features.forEach(f => { if (['Mexico', 'St. Pierre and Miquelon'].includes(f.properties.name)) states[f.properties.name] = multi(f.geometry); });
}
const S = (...names) => names.reduce((acc, n) => { if (!states[n]) throw new Error('no ' + n); return snap(pc.union(acc, states[n])); }, []);
const box = (w, s, e, n) => [[[[w, s], [e, s], [e, n], [w, n], [w, s]]]];
const poly = pts => [[pts.concat([pts[0]])]];
const snap = m => m.map(clean).filter(p => p.length);
const and = (a, b) => snap(pc.intersection(a, b)), minus = (a, ...b) => b.reduce((x, y) => snap(pc.difference(x, y)), a), or = (...a) => a.reduce((x, y) => snap(pc.union(x, y)), []);
const inside = (pt, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) c = !c; } return c; };
// the one piece (island) of a province or state that holds a point
const piece = (name, pt) => { const p = states[name].find(p => inside(pt, p[0])); if (!p) throw new Error('no piece of ' + name + ' at ' + pt); return [p]; };

// ---------- lines from treaties and rivers (longitude, latitude), each closed into a shape on one side ----------
// south of the height of land between the St. Lawrence and Great Lakes and Hudson Bay (and the Labrador coast)
const SOUTH_OF_DIVIDE = poly([[-97, 49.4], [-91.5, 49.9], [-88, 49.7], [-85, 49.6], [-82, 48.7], [-79.5, 48.4], [-77, 48.9], [-75, 49.9], [-72.5, 50.9], [-69, 51.9], [-66, 52.8], [-63.8, 52.6], [-61, 52.2], [-57.1, 51.6], [-50, 51.6], [-50, 35], [-97, 35]]);
// east of the Kennebec: the western limit France claimed for Acadie (England claimed as far east as the St. Croix)
const EAST_OF_KENNEBEC = poly([[-69.8, 43.0], [-69.78, 44.05], [-69.72, 44.55], [-69.65, 45.05], [-69.75, 45.6], [-70.3, 46.3], [-70.3, 48], [-60, 48], [-60, 43]]);
// the Province of Quebec in the Royal Proclamation of 1763: from Lake Nipissing to the St. Lawrence at 45° north, along the
// highlands to the Baie des Chaleurs, across to the Saint-Jean River on the north shore, and back through Lac Saint-Jean
const QUEBEC_1763 = poly([[-79.5, 46.3], [-80, 43], [-60, 43], [-60, 50.0], [-64.3, 50.25], [-64.6, 51.6], [-72.0, 48.6]]);
// the Appalachian divide, roughly the line of the Proclamation of 1763; the colonies lay east of it
const EAST_OF_APPALACHIANS = poly([[-74.7, 45.0], [-75.2, 43.5], [-76.3, 42.2], [-78.0, 41.0], [-79.2, 39.7], [-79.9, 38.6], [-80.6, 37.5], [-81.7, 36.4], [-82.9, 35.4], [-83.7, 34.6], [-84.0, 33.5], [-83.0, 31.0], [-82.0, 30.6], [-80, 30.6], [-60, 38], [-60, 48], [-71.0, 48], [-74.7, 45.6]]);
// west of the Mississippi (the river is the state line from Louisiana to Minnesota; this only splits Minnesota)
const WEST_OF_MISSISSIPPI = poly([[-91.2, 43.5], [-91.7, 44.6], [-92.9, 44.9], [-93.5, 45.4], [-94.3, 46.3], [-95.2, 47.2], [-95.2, 49.5], [-125, 49.5], [-125, 43.5]]);
// Louisiana east of the Mississippi and north of the lakes: the "Florida parishes", part of West Florida until 1810
const FLORIDA_PARISHES = poly([[-91.64, 31.05], [-91.55, 30.98], [-91.25, 30.7], [-91.17, 30.45], [-91.0, 30.33], [-90.4, 30.28], [-89.8, 30.12], [-89.6, 30.18], [-89.5, 31.05]]);
// the Mississippi's western watershed as far as the Rockies, and the Spanish border of 1819 (Sabine, Red and Arkansas
// rivers, then 42° north): the Louisiana of 1682, the Spanish Louisiana of 1763 and the Louisiana Purchase of 1803
const MISSISSIPPI_BASIN = poly([[-114.1, 49.5], [-114.1, 49.0], [-113.6, 48.0], [-112.6, 46.5], [-111.0, 44.6], [-109.5, 43.0], [-107.5, 41.5], [-106.3, 39.25], [-104.6, 38.25], [-103.0, 38.05], [-100.0, 37.75], [-100.0, 34.56], [-97.0, 33.85], [-94.05, 33.55], [-94.05, 32.0], [-93.85, 29.7], [-93.85, 25], [-50, 25], [-50, 49.5]]);
const SOUTH_OF_42 = box(-130, 10, -90, 42);
// the Oregon Country: west of the Rockies, between Spanish (later Mexican) land at 42° north and Russian America at 54°40′
const OREGON = poly([[-125, 42], [-111.05, 42], [-110.5, 43.5], [-111.0, 44.6], [-112.6, 46.5], [-113.6, 48.0], [-114.1, 49.0], [-120, 53.8], [-120, 54.67], [-135, 54.67], [-135, 42]]);
const SOUTH_OF = lat => box(-130, 10, -50, lat), WEST_OF = lon => box(-180, 10, lon, 85), EAST_OF = lon => box(lon, 10, -40, 85);

// ---------- named pieces ----------
const CAPE_BRETON = piece('Nova Scotia', [-60.8, 46.2]);
const NOVA_SCOTIA = minus(S('Nova Scotia'), CAPE_BRETON);
const NEWFOUNDLAND = piece('Newfoundland and Labrador', [-56, 48.5]);
const LABRADOR = minus(S('Newfoundland and Labrador'), NEWFOUNDLAND);
const ANTICOSTI = piece('Québec', [-63, 49.4]), MAGDALENS = and(S('Québec'), box(-62.3, 47.1, -61.3, 47.9));
const QC_ON = S('Québec', 'Ontario');
const CANADA_ALL = S('Québec', 'Ontario', 'Nova Scotia', 'New Brunswick', 'Prince Edward Island', 'Newfoundland and Labrador', 'Manitoba', 'Saskatchewan', 'Alberta', 'British Columbia', 'Yukon', 'Northwest Territories', 'Nunavut');
const US_ALL = S(...Object.keys(states).filter(n => !['Québec', 'Ontario', 'Nova Scotia', 'New Brunswick', 'Prince Edward Island', 'Newfoundland and Labrador', 'Manitoba', 'Saskatchewan', 'Alberta', 'British Columbia', 'Yukon', 'Northwest Territories', 'Nunavut', 'Mexico', 'St. Pierre and Miquelon', 'Alaska'].includes(n)));
const ALASKA = S('Alaska'), MEXICO = S('Mexico'), ST_PIERRE = S('St. Pierre and Miquelon');
const SEABOARD = S('Maine', 'New Hampshire', 'Vermont', 'Massachusetts', 'Rhode Island', 'Connecticut', 'New York', 'New Jersey', 'Pennsylvania', 'Delaware', 'Maryland', 'District of Columbia', 'Virginia', 'West Virginia', 'North Carolina', 'South Carolina', 'Georgia');
const COLONIES = and(SEABOARD, EAST_OF_APPALACHIANS);
const PAYS_D_EN_HAUT = S('Michigan', 'Wisconsin', 'Illinois', 'Indiana', 'Ohio');
const WEST_STATES = and(US_ALL, MISSISSIPPI_BASIN);   // everything east of the 1819 line, the seaboard included
const LOUISIANA_WEST = minus(and(or(S('Louisiana', 'Arkansas', 'Missouri', 'Iowa', 'Kansas', 'Nebraska', 'Oklahoma', 'South Dakota', 'North Dakota', 'Montana', 'Wyoming', 'Colorado', 'Texas', 'New Mexico'), and(S('Minnesota'), WEST_OF_MISSISSIPPI)), MISSISSIPPI_BASIN), and(S('Louisiana'), FLORIDA_PARISHES));
const NEW_SPAIN_NORTH = and(minus(US_ALL, MISSISSIPPI_BASIN), SOUTH_OF_42);   // Texas, New Mexico, California and the rest of the southwest
const EAST_OF_MISSISSIPPI = minus(US_ALL, LOUISIANA_WEST, NEW_SPAIN_NORTH, minus(US_ALL, SOUTH_OF_42, MISSISSIPPI_BASIN));
const FLORIDA = S('Florida');
const WEST_FLORIDA_1764 = or(and(FLORIDA, WEST_OF(-85.0)), and(S('Alabama', 'Mississippi'), SOUTH_OF(32.47)), and(S('Louisiana'), FLORIDA_PARISHES));
const WEST_FLORIDA_1783 = or(and(FLORIDA, WEST_OF(-85.0)), and(S('Alabama', 'Mississippi'), SOUTH_OF(31.0)), and(S('Louisiana'), FLORIDA_PARISHES));
const EAST_FLORIDA = and(FLORIDA, EAST_OF(-85.0));
const UPPER = and(S('Ontario'), SOUTH_OF_DIVIDE), LOWER = and(S('Québec'), SOUTH_OF_DIVIDE);
const REST_OF_CANADA = CANADA_ALL;   // drawn last in an era: whatever no other region took

const R = (en, fr, p, at, land) => ({ en, fr, p, at, land });
const ERAS = [
  { id: '1632', from: 1632, to: 1713, en: 'Acadie and New France', fr: 'L’Acadie et la Nouvelle-France', regions: [
    R('Acadie', 'Acadie', 'fr', [-65.6, 45.6], or(S('Nova Scotia', 'New Brunswick', 'Prince Edward Island'), and(S('Maine'), EAST_OF_KENNEBEC))),
    R('New France (Canada)', 'Nouvelle-France (Canada)', 'fr', [-72.2, 47.4], and(QC_ON, SOUTH_OF_DIVIDE)),
    R('Newfoundland (English and French)', 'Terre-Neuve (anglaise et française)', '', [-56.0, 48.6], NEWFOUNDLAND),
    R('English colonies', 'Colonies anglaises', 'gb', [-76.2, 39.2], COLONIES),
    R('Louisiane (from 1682)', 'Louisiane (dès 1682)', 'fr', [-91.8, 33.5], and(S('Louisiana', 'Mississippi', 'Arkansas'), MISSISSIPPI_BASIN)),
    R('Spanish Florida', 'Floride espagnole', 'es', [-81.7, 28.6], FLORIDA),
    R('New Spain', 'Nouvelle-Espagne', 'es', [-104, 27], or(MEXICO, and(S('Texas', 'New Mexico'), SOUTH_OF_42))),
    R('Rupert’s Land (from 1670)', 'Terre de Rupert (dès 1670)', 'gb', [-92, 55.5], minus(S('Québec', 'Ontario', 'Manitoba', 'Saskatchewan', 'Alberta'), SOUTH_OF_DIVIDE, box(-70, 50, -50, 64))),
    R('', '', '', null, or(US_ALL, CANADA_ALL, ALASKA)) ] },
  { id: '1713', from: 1713, to: 1763, en: 'After the Treaty of Utrecht', fr: 'Après le traité d’Utrecht', regions: [
    R('Nova Scotia', 'Nouvelle-Écosse', 'gb', [-63.6, 44.9], NOVA_SCOTIA),
    R('Île Royale', 'Île Royale', 'fr', [-60.6, 46.25], CAPE_BRETON),
    R('Île Saint-Jean', 'Île Saint-Jean', 'fr', [-63.3, 46.4], S('Prince Edward Island')),
    R('Acadie (claimed by France and Britain)', 'Acadie (revendiquée par la France et la Grande-Bretagne)', '', [-66.3, 46.6], S('New Brunswick')),
    R('Canada', 'Canada', 'fr', [-72.2, 47.4], and(QC_ON, SOUTH_OF_DIVIDE)),
    R('Newfoundland', 'Terre-Neuve', 'gb', [-56.0, 48.6], NEWFOUNDLAND),
    R('British colonies', 'Colonies britanniques', 'gb', [-76.2, 39.2], COLONIES),
    R('Pays d’en Haut', 'Pays d’en Haut', 'fr', [-86.5, 42.2], minus(PAYS_D_EN_HAUT, COLONIES)),
    R('Louisiane', 'Louisiane', 'fr', [-92.5, 36.5], minus(or(S('Mississippi', 'Alabama', 'Tennessee', 'Kentucky'), LOUISIANA_WEST), COLONIES, FLORIDA)),
    R('Spanish Florida', 'Floride espagnole', 'es', [-81.7, 28.6], FLORIDA),
    R('New Spain', 'Nouvelle-Espagne', 'es', [-104, 27], or(MEXICO, NEW_SPAIN_NORTH)),
    R('Rupert’s Land', 'Terre de Rupert', 'gb', [-92, 55.5], minus(S('Québec', 'Ontario', 'Manitoba', 'Saskatchewan', 'Alberta'), SOUTH_OF_DIVIDE, box(-70, 50, -50, 64))),
    R('', '', '', null, or(US_ALL, CANADA_ALL, ALASKA)) ] },
  { id: '1763', from: 1763, to: 1783, en: 'After the Treaty of Paris', fr: 'Après le traité de Paris', regions: [
    R('Province of Quebec', 'Province de Québec', 'gb', [-72.2, 47.4], minus(and(QC_ON, QUEBEC_1763), ANTICOSTI, MAGDALENS)),
    R('Nova Scotia', 'Nouvelle-Écosse', 'gb', [-65.2, 45.3], S('Nova Scotia', 'New Brunswick')),
    R('Island of St. John', 'Île Saint-Jean', 'gb', [-63.3, 46.4], S('Prince Edward Island')),
    R('Newfoundland', 'Terre-Neuve', 'gb', [-58.5, 52.3], or(NEWFOUNDLAND, LABRADOR, and(S('Québec'), EAST_OF(-64.3), box(-70, 50.1, -50, 53)), ANTICOSTI, MAGDALENS)),
    R('Saint-Pierre-et-Miquelon', 'Saint-Pierre-et-Miquelon', 'fr', [-56.3, 46.85], ST_PIERRE),
    R('Thirteen Colonies', 'Treize colonies', 'gb', [-76.2, 39.2], minus(COLONIES, FLORIDA)),
    R('East Florida', 'Floride orientale', 'gb', [-81.7, 28.6], EAST_FLORIDA),
    R('West Florida', 'Floride occidentale', 'gb', [-88.6, 31.4], WEST_FLORIDA_1764),
    R('Indian Reserve (Proclamation of 1763)', 'Réserve indienne (Proclamation de 1763)', '', [-85.5, 38.6], minus(or(EAST_OF_MISSISSIPPI, and(QC_ON, SOUTH_OF_DIVIDE)), COLONIES)),
    R('Spanish Louisiana', 'Louisiane espagnole', 'es', [-95.5, 40], LOUISIANA_WEST),
    R('New Spain', 'Nouvelle-Espagne', 'es', [-104, 27], or(MEXICO, NEW_SPAIN_NORTH)),
    R('Rupert’s Land', 'Terre de Rupert', 'gb', [-92, 55.5], minus(S('Québec', 'Ontario', 'Manitoba', 'Saskatchewan', 'Alberta'), box(-70, 50, -50, 64))),
    R('', '', '', null, or(US_ALL, CANADA_ALL, ALASKA)) ] },
  { id: '1784', from: 1784, to: 1803, en: 'After the American Revolution', fr: 'Après la Révolution américaine', regions: [
    R('New Brunswick', 'Nouveau-Brunswick', 'gb', [-66.3, 46.6], S('New Brunswick')),
    R('Nova Scotia', 'Nouvelle-Écosse', 'gb', [-63.6, 44.9], NOVA_SCOTIA),
    R('Cape Breton', 'Cap-Breton', 'gb', [-60.6, 46.25], CAPE_BRETON),
    R('Island of St. John (P.E.I. from 1799)', 'Île Saint-Jean (Î.-P.-É. dès 1799)', 'gb', [-63.3, 46.4], S('Prince Edward Island')),
    R('Newfoundland', 'Terre-Neuve', 'gb', [-56.0, 48.6], NEWFOUNDLAND),
    R('Saint-Pierre-et-Miquelon', 'Saint-Pierre-et-Miquelon', 'fr', [-56.3, 46.85], ST_PIERRE),
    R('Lower Canada (1791)', 'Bas-Canada (1791)', 'gb', [-72.2, 47.4], or(LOWER, LABRADOR)),
    R('Upper Canada (1791)', 'Haut-Canada (1791)', 'gb', [-80.5, 45.2], UPPER),
    R('Spanish Florida', 'Floride espagnole', 'es', [-82, 29], or(EAST_FLORIDA, WEST_FLORIDA_1783)),
    R('United States', 'États-Unis', 'us', [-82, 37.5], EAST_OF_MISSISSIPPI),
    R('Spanish Louisiana (French again in 1800)', 'Louisiane espagnole (française en 1800)', 'es', [-95.5, 40], LOUISIANA_WEST),
    R('New Spain', 'Nouvelle-Espagne', 'es', [-104, 27], or(MEXICO, NEW_SPAIN_NORTH)),
    R('Russian America', 'Amérique russe', 'ru', [-152, 64], ALASKA),
    R('Rupert’s Land', 'Terre de Rupert', 'gb', [-92, 55.5], minus(S('Québec', 'Ontario', 'Manitoba', 'Saskatchewan', 'Alberta'), box(-70, 50, -50, 64))),
    R('', '', '', null, or(US_ALL, CANADA_ALL)) ] },
  { id: '1803', from: 1803, to: 1867, en: 'Before Confederation', fr: 'Avant la Confédération', regions: [
    R('New Brunswick', 'Nouveau-Brunswick', 'gb', [-66.3, 46.6], S('New Brunswick')),
    R('Nova Scotia', 'Nouvelle-Écosse', 'gb', [-63.6, 44.9], S('Nova Scotia')),
    R('Prince Edward Island', 'Île-du-Prince-Édouard', 'gb', [-63.3, 46.4], S('Prince Edward Island')),
    R('Newfoundland', 'Terre-Neuve', 'gb', [-58.5, 52.3], or(NEWFOUNDLAND, LABRADOR)),
    R('Saint-Pierre-et-Miquelon', 'Saint-Pierre-et-Miquelon', 'fr', [-56.3, 46.85], ST_PIERRE),
    R('Lower Canada (Canada East)', 'Bas-Canada (Canada-Est)', 'gb', [-72.2, 47.4], LOWER),
    R('Upper Canada (Canada West)', 'Haut-Canada (Canada-Ouest)', 'gb', [-80.5, 45.2], UPPER),
    R('United States', 'États-Unis', 'us', [-90, 38], WEST_STATES),
    R('Oregon Country (shared to 1846)', 'Pays de l’Oregon (partagé jusqu’en 1846)', '', [-119.5, 46.5], and(or(US_ALL, CANADA_ALL), OREGON)),
    R('New Spain, then Mexico (1821)', 'Nouvelle-Espagne, puis Mexique (1821)', 'es', [-104, 27], or(MEXICO, NEW_SPAIN_NORTH)),
    R('Russian America', 'Amérique russe', 'ru', [-152, 64], ALASKA),
    R('Rupert’s Land and the North-West', 'Terre de Rupert et Territoire du Nord-Ouest', 'gb', [-100, 58], REST_OF_CANADA),
    R('', '', '', null, US_ALL) ] },
  { id: '1867', from: 1867, to: 1949, en: 'Confederation', fr: 'La Confédération', regions: [
    R('Newfoundland', 'Terre-Neuve', 'gb', [-58.5, 52.3], S('Newfoundland and Labrador')),
    R('Saint-Pierre-et-Miquelon', 'Saint-Pierre-et-Miquelon', 'fr', [-56.3, 46.85], ST_PIERRE),
    R('Canada', 'Canada', 'ca', [-100, 56], CANADA_ALL),
    R('United States', 'États-Unis', 'us', [-98, 39], or(US_ALL, ALASKA)),
    R('Mexico', 'Mexique', 'mx', [-103, 24.5], MEXICO) ] }
];

// each region takes only what no earlier region of its era took
const objects = {}, eras = [];
for (const era of ERAS) {
  let taken = [];
  const features = [];
  era.regions.forEach((r, i) => {
    const g = taken.length ? minus(r.land, taken) : r.land;
    taken = or(taken, r.land);
    if (!g.length) return;
    features.push({ type: 'Feature', properties: { i }, geometry: rewind({ type: 'MultiPolygon', coordinates: g }) });
  });
  objects['e' + era.id] = { type: 'FeatureCollection', features };
  eras.push({ id: era.id, from: era.from, to: era.to, en: era.en, fr: era.fr, regions: era.regions.map(r => r.at ? { en: r.en, fr: r.fr, p: r.p, at: r.at } : { p: r.p }) });
  console.log(era.id, features.length, 'regions');
}
let t = ts.topology(objects);
t = tsim.presimplify(t); t = tsim.simplify(t, SIMPLIFY);
t = tsim.filter(t, tsim.filterWeight(t, 0.002));   // drops slivers left where two cuts nearly meet
t.arcs = t.arcs.map(a => a.map(p => [p[0], p[1]]));
t = tc.quantize(t, 1e5);
t.eras = eras;
const s = JSON.stringify(t);
fs.writeFileSync(path.join(OUT, 'history.json'), s);
console.log('history.json', (s.length / 1024).toFixed(0) + ' KB');
