/* Step 2 of 2 for the map's Relief layer in Where They Lived: traces the light and shadow worked out by
   build-map-relief.py into smooth shapes, and writes site/data/map/relief.json. Nothing here runs on the website.
   Run from this folder, after build-map-relief.py:
     npm i d3-contour topojson-client topojson-server topojson-simplify
     node build-map-relief.js ../site/data/map
   Output: relief.json, objects landShadow, landLight, seaShadow, seaLight, one shape per level below (about 2.2 MB,
   670 KB as sent by the server). */
'use strict';
const fs = require('fs'), path = require('path');
const { contours } = require('d3-contour'), ts = require('topojson-server'), tsim = require('topojson-simplify'), tc = require('topojson-client');
const OUT = process.argv[2] || '../site/data/map';
const W = 2161, H = 1081;   // the grid, west to east and north to south
// the levels traced: how deep a shadow, or how bright a light, starts each one (the map draws each a little stronger)
const LEVELS = { landShadow: ['relief-land.f32', -1, [0.012, 0.02, 0.032, 0.05, 0.07, 0.1]], landLight: ['relief-land.f32', 1, [0.02, 0.03, 0.05, 0.08]],
  seaShadow: ['relief-sea.f32', -1, [0.008, 0.012, 0.02, 0.03, 0.042, 0.06]], seaLight: ['relief-sea.f32', 1, [0.01, 0.015, 0.025, 0.04]] };
// how much the shapes are smoothed (square degrees), the smallest kept, and the grid the points are rounded to
const SIMPLIFY = 0.001, SMALLEST = 0.001, GRID = 200000;

/* d3 draws a ring clockwise as the inside of a shape and anticlockwise as the outside: outer rings are set clockwise,
   holes anticlockwise, measured flat on longitude and latitude */
const signed = r => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[i][0] - r[j][0]) * (r[i][1] + r[j][1]); return a / 2; };
const fixPoly = p => p.map((r, i) => ((signed(r) > 0) === (i === 0) ? r : r.slice().reverse()));
const lonLat = ([x, y]) => [Math.max(-180, Math.min(180, -180 + (x - 0.5) * 360 / (W - 1))), Math.max(-90, Math.min(90, 90 - (y - 0.5) * 180 / (H - 1)))];
const grids = {};
const objects = {};
for (const [name, [file, sign, levels]] of Object.entries(LEVELS)) {
  const g = grids[file] || (grids[file] = new Float32Array(fs.readFileSync(file).buffer.slice(0)));
  const v = sign < 0 ? g.map(x => -x) : g;
  objects[name] = { type: 'FeatureCollection', features: contours().size([W, H]).smooth(true).thresholds(levels)(v).map((mp, i) => ({
    type: 'Feature', properties: { l: levels[i] }, geometry: { type: 'MultiPolygon', coordinates: mp.coordinates.map(p => fixPoly(p.map(r => r.map(lonLat)))) } })) };
}
let t = ts.topology(objects);
t = tsim.presimplify(t); t = tsim.simplify(t, SIMPLIFY); t = tsim.filter(t, tsim.filterWeight(t, SMALLEST));
t.arcs = t.arcs.map(a => a.map(p => [p[0], p[1]]));
t = tc.quantize(t, GRID);
fs.writeFileSync(path.join(OUT, 'relief.json'), JSON.stringify(t));
console.log('relief.json', (fs.statSync(path.join(OUT, 'relief.json')).size / 1024).toFixed(0) + ' KB');
