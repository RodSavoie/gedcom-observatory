/* Builds site/data/map/layers.json, the depth of the sea, and glaciers and ice shelves, for the "Colours" layer of the map in Where They Lived.
   Nothing here runs on the website.

   Sources (Natural Earth, public domain; github.com/nvkelso/natural-earth-vector, folder geojson, into this folder):
     ne_10m_bathymetry_K_200, _J_1000, _I_2000, _H_3000, _G_4000, _F_5000, _E_6000   sea deeper than 200 m, 1 km ... 6 km
     ne_10m_glaciated_areas, ne_10m_antarctic_ice_shelves_polys                         glaciers and ice shelves
   Run from this folder:
     npm i topojson-client topojson-server topojson-simplify
     node build-map-layers.js ../site/data/map
   Output: layers.json, objects d200 ... d6000 and ice (about 1.1 MB, 330 KB as sent by the server). */
'use strict';
const fs = require('fs'), path = require('path');
const tc = require('topojson-client'), ts = require('topojson-server'), tsim = require('topojson-simplify');
const OUT = process.argv[2] || '../site/data/map';
// how much the shapes are smoothed (square degrees), the smallest shape kept, and the grid the points are rounded to
const SIMPLIFY = 0.02, SMALLEST = 0.3, GRID = 20000;

/* d3 draws a ring clockwise as the inside of a shape and anticlockwise as the outside (GeoJSON files usually go the other
   way): outer rings are set clockwise, holes anticlockwise, measured flat on longitude and latitude */
const signed = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[i][0] - r[j][0]) * (r[i][1] + r[j][1]); return a / 2; };   // > 0: clockwise
const fixPoly = p => p.map((r, i) => ((signed(r) > 0) === (i === 0) ? r : r.slice().reverse()));
const rewind = g => { if (g && g.type === 'Polygon') g.coordinates = fixPoly(g.coordinates); else if (g && g.type === 'MultiPolygon') g.coordinates = g.coordinates.map(fixPoly); return g; };
const read = f => JSON.parse(fs.readFileSync(f + '.geojson'));
const shapes = fc => ({ type: 'FeatureCollection', features: fc.features.map(f => ({ type: 'Feature', properties: {}, geometry: rewind(f.geometry) })) });

const objects = {};
for (const [k, f] of [['d200', 'K_200'], ['d1000', 'J_1000'], ['d2000', 'I_2000'], ['d3000', 'H_3000'], ['d4000', 'G_4000'], ['d5000', 'F_5000'], ['d6000', 'E_6000']]) objects[k] = shapes(read('ne_10m_bathymetry_' + f));
objects.ice = shapes(read('ne_10m_glaciated_areas'));
objects.ice.features.push(...shapes(read('ne_10m_antarctic_ice_shelves_polys')).features);
let t = ts.topology(objects);
t = tsim.presimplify(t); t = tsim.simplify(t, SIMPLIFY); t = tsim.filter(t, tsim.filterWeight(t, SMALLEST));
t.arcs = t.arcs.map(a => a.map(p => [p[0], p[1]]));
t = tc.quantize(t, GRID);
fs.writeFileSync(path.join(OUT, 'layers.json'), JSON.stringify(t));
console.log('layers.json', (fs.statSync(path.join(OUT, 'layers.json')).size / 1024).toFixed(0) + ' KB');

