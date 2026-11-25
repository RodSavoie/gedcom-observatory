/* Where They Lived, Map: a zoomable bubble map of birthplaces or places of death.
   Each bubble is one place, sized by how many people were born (or died) there. Places named only by a region
   ("Acadie", "France") sit at that region's centre as dashed rings. Place matching is in js/geo.js. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el, svg = ui.svg, C = FO.C;
  const T = FO.T;

  // how the map looks: change these to taste
  const LAND = '#F7F4EE', COAST = '#B9B09F', BORDER = '#CFC7B8';
  const FRAME = COAST, FRAME_OPACITY = 0.9;   // the faint border around the map
  const WATER = '#FFFFFF', WATER_OPACITY = 0.22;
  const RIVER = COAST, RIVER_OPACITY = 0.5;   // rivers: the greatest always shown, smaller ones as you zoom in
  const DETAIL_FROM = 2;   // zoom from which the finer coastlines and borders are fetched and drawn (data/map/world-detail.json)
  const RIVER_TIERS = [   // [largest rank in the tier (0 = greatest river), line width, zoom from which it shows]
    [6, 1.0, 0], [9, 0.8, 2], [12, 0.6, 4]];   // a light wash over the sea and lakes, so the map stands apart from the page
  const BIRTH = C.teal, DEATH = C.red;
  const BUBBLE_OPACITY = 0.5;      // fill of a bubble (0 to 1)
  const MAX_R = 30;                // the biggest bubble's radius, in pixels, before zooming
  const SEA_RING = 1.6;            // width of the dotted ring around a death or birth at sea
  const LABELS = 14;               // how many of the biggest places get a name on the map
  /* Places named before any other, by region, wherever the family has a bubble there (the places of Acadian history: Acadie,
     Canada, the exile in the Anglo-American colonies and England, France, Louisiana, the Caribbean and Guiana, Saint-Pierre).
     Names are handed out one region at a time, the biggest bubble of each region first, so every region gets its main
     places named even when the map is zoomed out; the rest follow as it is zoomed in. Each place: [name, longitude,
     latitude, and optionally how far its bubble may be, in degrees (0.12 if not given)]; the name goes on the bubble of that
     name, or else on the biggest bubble that near, and is left out where the family has none. */
  const NAMED_PLACES = [
    [['Annapolis Royal', -65.52, 44.74], ['Grand-Pré', -64.31, 45.10], ['Beaubassin', -64.28, 45.85], ['Louisbourg', -59.97, 45.92],
      ['Pisiguit', -64.14, 44.99], ['Port LaJoye', -63.13, 46.20], ['Memramcook', -64.55, 46.00], ['Halifax', -63.57, 44.65]],
    [['Québec', -71.21, 46.81], ['Bécancour', -72.43, 46.34], ['L’Acadie', -73.34, 45.31]],
    [['Boston', -71.06, 42.36], [T('Philadelphia'), -75.17, 39.95], ['Baltimore', -76.61, 39.29], ['Charleston', -79.93, 32.78]],
    [['Liverpool', -2.98, 53.41], ['Bristol', -2.59, 51.45], ['Southampton', -1.40, 50.90], ['Falmouth', -5.07, 50.15]],
    [['Saint-Malo', -2.025, 48.649, 0.03], ['Saint-Servan', -2.012, 48.636, 0.03], ['Cherbourg', -1.616, 49.639], ['Brest', -4.486, 48.390],
      ['La Rochelle', -1.151, 46.160], ['Rochefort', -0.963, 45.937], ['Nantes', -1.553, 47.218], ['Belle-Île-en-Mer', -3.18, 47.33, 0.2],
      ['Morlaix', -3.827, 48.578], ['Châtellerault', 0.546, 46.818], ['Le Havre', 0.107, 49.494], ['Boulogne-sur-Mer', 1.614, 50.726]],
    [[T('St. James'), -90.85, 30.03, 0.2], [T('St. Gabriel'), -91.10, 30.25], ['Saint-Martinville', -91.83, 30.13], [T('New Orleans'), -90.07, 29.95],
      ['Opelousas', -92.08, 30.53], ['Lafayette', -92.02, 30.22]],
    [['Môle-Saint-Nicolas', -73.38, 19.80], ['Mirebalais', -72.10, 18.83], ['Fort-Royal', -61.07, 14.60], ['Sinnamary', -52.96, 5.38], ['Cayenne', -52.33, 4.94]],
    [['Saint-Pierre', -56.18, 46.78], ['Miquelon', -56.38, 47.10], ['Plaisance', -53.97, 47.24]]];
  const WRAP = true;               // the map wraps around east and west (Russia carries on left of Alaska); false stops at the edges
  /* The land, the sea and the layers are drawn on a canvas, which the browser draws with the graphics card, again at every
     step of a drag or a zoom, so the map stays sharp while it moves; the bubbles and names are drawn over it. SHARPNESS caps
     how many canvas pixels go to each screen pixel on a high-resolution screen (more is sharper, and more work). */
  const SHARPNESS = 2;

  /* Layers, switched on and off under "Layers" above the map. LAYERS_DEFAULT is what a new visitor sees (any of 'colours',
     'relief', 'grid', 'borders'); after that each visitor's own choice is kept. Their files are fetched only when first needed. */
  const LAYERS_DEFAULT = ['colours'];
  // Colours: a light blue sea that darkens with depth (200 m, then 1, 2, 3, 4, 5 and 6 km), land a shade darker than the
  // page, and glaciers and ice shelves almost white. These are the colours of the default palette; each design has its own
  // (sea, depth, land and ice in js/designs.js).
  const SEA = '#E3EBF1', DEPTH = '#7F9CB4', LAND_COLOURED = '#E3DCCF', ICE = '#F5F8FA';
  const ICE_EDGE = 0.25;           // how strongly the ice's edge is drawn (in the deep-water colour), 0 to 1
  const DEPTH_OPACITY = 0.05;      // how much colour each step down adds (0 to 1)
  // Relief: soft shadows and highlights on mountains and on the sea floor, as if lit from the north-west (data/map/relief.json,
  // traced from ETOPO1 by tools/build-map-relief.py). Each of the six levels of shadow and four of light adds this much.
  const SHADE = '#6A6052';         // the shadows on land (each design has its own: shade in js/designs.js); at sea they take DEPTH
  const RELIEF_LAND_SHADOW = 0.035, RELIEF_LAND_LIGHT = 0.07, RELIEF_SEA_SHADOW = 0.035, RELIEF_SEA_LIGHT = 0.06;
  const GRID = '#8FA8BD', GRID_OPACITY = 0.35, GRID_STEP = 5;   // the latitude and longitude grid: colour, strength, degrees apart
  const OLD_COLOURS = { fr: '#3B6EA5', gb: '#B5473A', es: '#C9921F', us: '#5E7186', ca: '#7C5A8E', mx: '#6E8B3D', ru: '#3F8C7A' };
  const OLD_FILL = 0.15;           // old borders: how strongly each colony is tinted
  const OLD_LINE = '#6B5E50';      // and the colour of the borders between them
  const OLD_ERA_FOR = { 1600: '1632', 1700: '1713', 1800: '1803', 1900: '1867', 2000: '1867', all: '1713' };   // the era shown for each period, unless one is picked
  const LAYERS_VERSION = 7;        // raise when a layer's files are rebuilt, so browsers fetch the new ones

  // the eras of the old borders (data/map/history.json, built by tools/build-map-history.js)
  FO.OLD_BORDER_ERAS = [
    { id: '1632', label: T('1632–1713: Acadie and New France') },
    { id: '1713', label: T('1713–1763: after the Treaty of Utrecht') },
    { id: '1763', label: T('1763–1783: after the Treaty of Paris') },
    { id: '1784', label: T('1784–1803: after the American Revolution') },
    { id: '1803', label: T('1803–1867: before Confederation') },
    { id: '1867', label: T('1867–1949: Confederation') }];
  const OLD_POWER = { fr: T('French'), gb: T('British'), es: T('Spanish'), us: T('American'), ca: T('Canadian'), mx: T('Mexican'), ru: T('Russian') };
  FO.MAP_LAYERS = [['colours', T('Colours')], ['relief', T('Relief')], ['grid', T('Latitude and longitude')], ['borders', T('Old borders')]];
  FO.MAP_LAYERS_DEFAULT = LAYERS_DEFAULT;
  const files = {};
  const fetchLayer = f => files[f] || (files[f] = fetch('data/map/' + f + '?v=' + LAYERS_VERSION).then(r => (r.ok ? r.json() : null)).catch(() => null).then(j => { if (!j) delete files[f]; return j; }));
  const loaded = {};   // the layers' files once here

  /* opts: {stage, root (svg), hint, data (scoped), what: 'birth'|'death', period: 'all'|century, regions: bool,
     layers: Set of layer ids, era: 'auto' or an era's id, onLegend} */
  FO.placesMap = function (o) {
    const { stage, root, hint } = o;
    const W = stage.clientWidth, H = stage.clientHeight;
    const year = p => (o.what === 'birth' ? (p.by != null ? p.by : p.est) : p.dy);
    const placeOf = p => (o.what === 'birth' ? p.b && p.b.place : p.d && p.d.place);
    const all = o.data.people.filter(p => !p.hidden && placeOf(p));
    const inPeriod = p => o.period === 'all' || (year(p) != null && Math.floor(year(p) / 100) * 100 === +o.period);
    const ppl = all.filter(inPeriod);
    const msg = (text) => { const t = svg('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', style: 'font-size:16px;fill:#3D4B5E' }); t.textContent = text; root.append(t); };
    if (!ppl.length) { msg(o.what === 'birth' ? T('No birthplaces recorded for this period.') : T('No places of death recorded for this period.')); hint.textContent = ''; return; }
    msg(T('Finding the places on the map…'));
    const token = o.token = {};
    const everyPlace = new Set();
    o.data.people.forEach(p => { if (p.hidden) return; if (p.b && p.b.place) everyPlace.add(p.b.place); if (p.d && p.d.place) everyPlace.add(p.d.place); });
    FO.geoLoad([...everyPlace]).then(({ world, locate }) => {
      if (o.cancelled && o.cancelled(token)) return;
      root.innerHTML = '';
      draw(world, locate);
    }).catch(err => { root.innerHTML = ''; msg(T('The map could not be loaded ({message}).', { message: err.message })); });

    function draw(world, locate) {
      // the map is framed on all the family's places, births and deaths of every period, so it stays put when the
      // filters change and the zoom can be kept
      const frame = [];
      for (const pl of everyPlace) { const l = locate(pl); if (l && l.level === 'place') frame.push([l.lon, l.lat]); }
      // one bubble per spot on the map
      const spots = new Map();
      let atRegion = 0, missing = 0, approx = 0, atSea = 0;
      for (const p of ppl) {
        const pl = placeOf(p), loc = locate(pl, year(p));   // the year chooses the crossing for someone who died at sea
        if (!loc) { missing++; continue; }
        if (loc.level === 'sea') atSea++;
        if (loc.level === 'region') { atRegion++; if (!o.regions) continue; }
        if (loc.approx) approx++;
        const k = loc.lat.toFixed(3) + ',' + loc.lon.toFixed(3) + ',' + loc.level;
        let s = spots.get(k);
        if (!s) spots.set(k, s = { lat: loc.lat, lon: loc.lon, level: loc.level, approx: loc.approx, label: loc.name, note: loc.note, people: [], spell: new Map() });
        s.people.push(p); s.spell.set(pl, (s.spell.get(pl) || 0) + 1);
      }
      const list = [...spots.values()].sort((a, b) => b.people.length - a.people.length);
      list.forEach(s => { s.top = [...s.spell].sort((a, b) => b[1] - a[1])[0][0]; s.n = s.people.length; if (s.level === 'place') s.label = s.top.split(',')[0].replace(/\(.*?\)/g, '').trim() || s.label; });

      // fit the map to the places (towns first; regions only if nothing else)
      const pts = frame.length ? frame : list.map(s => [s.lon, s.lat]);
      const proj = d3.geoMercator();
      const pad = 34;
      if (pts.length) proj.fitExtent([[pad, pad], [W - pad, H - pad - 34]], { type: 'MultiPoint', coordinates: pts });
      if (pts.length < 2 || proj.scale() > 6000) proj.scale(Math.min(proj.scale(), 6000)).center(pts[0] || [0, 0]).translate([W / 2, H / 2]);
      const path = d3.geoPath(proj);

      const layers = o.layers || new Set(), coloured = layers.has('colours');
      /* Two layers, one over the other: the canvas ("under"), with the sea, the land and the layers, and over it root, with
         the bubbles and names, which answer the pointer. Both use the same coordinates. */
      stage.querySelectorAll('.map-under').forEach(e => e.remove());
      const dpr = Math.min(window.devicePixelRatio || 1, SHARPNESS);
      const under = document.createElement('canvas');
      under.className = 'map-under';
      under.setAttribute('aria-hidden', 'true');
      under.width = Math.round(W * dpr); under.height = Math.round(H * dpr);
      under.style.cssText = 'position:absolute;left:0;top:0;width:' + W + 'px;height:' + H + 'px;pointer-events:none';
      stage.insertBefore(under, root);
      const ctx = under.getContext('2d');
      const zoomG = svg('g');
      root.append(zoomG);
      const ns = { 'vector-effect': 'non-scaling-stroke' };
      /* The world is drawn side by side as copies; when WRAP is on there are three, and they move along as the map is
         dragged east or west, so there is always world on either side. Each copy has its own bubbles, so pointing and
         clicking work on all of them. */
      const x0 = proj([-180, 0])[0], worldW = proj([180, 0])[0] - x0;
      const COPIES = WRAP ? [-1, 0, 1] : [0];
      const era = layers.has('borders') ? (o.era && o.era !== 'auto' ? o.era : OLD_ERA_FOR[o.period] || OLD_ERA_FOR.all) : null;
      const relief = layers.has('relief');
      const want = (coloured ? ['layers.json'] : []).concat(relief ? ['relief.json'] : [], era ? ['history.json'] : []);
      want.forEach(f => { if (!loaded[f]) fetchLayer(f).then(j => { if (j && !loaded[f]) { loaded[f] = j; if (under.isConnected) { drawBase(current); legend(); } } }); });
      let current = null, oldLabels = [];
      // the layers' shapes do not change with the coastline, so they are worked out once and kept for later drawings
      const shapes = new Map();
      const once = (key, make) => { if (!shapes.has(key)) shapes.set(key, make()); return shapes.get(key); };
      /* What the canvas draws, in order: each an outline (Path2D) and how to paint it: fill and its opacity, or a line
         (stroke, its opacity, width in screen pixels, dashes), "rule" for shapes with holes, "clip" for what stays on land,
         "from" for what shows only from a zoom. */
      let items = [], landShape = null;
      const shape = d => new Path2D(d || '');
      // the land, lakes, rivers and borders, with the layers that are on; worked out again with the finer map once someone zooms in
      function drawBase(w) {
        current = w;
        items = []; oldLabels = [];
        const add = (d, how) => items.push(Object.assign({ p: d instanceof Path2D ? d : shape(d) }, how));
        const countries = topojson.feature(w, w.objects.countries);
        // land with the lakes cut out of it, so lakes show the same background as the sea
        const lakes = w.objects.lakes ? topojson.feature(w, w.objects.lakes) : null;
        const depth = coloured && loaded['layers.json'];
        if (depth) ['d200', 'd1000', 'd2000', 'd3000', 'd4000', 'd5000', 'd6000'].forEach(k => {
          if (depth.objects[k]) add(once('depth' + k, () => shape(path(topojson.feature(depth, depth.objects[k])))), { fill: DEPTH, alpha: DEPTH_OPACITY });
        });
        // the relief: shadows and light, at sea under the land and on land clipped to the coast
        const rel = relief && loaded['relief.json'];
        const shading = (key, colour, opacity, how) => { if (rel && rel.objects[key]) once('relief' + key, () => topojson.feature(rel, rel.objects[key]).features.map(f => shape(path(f)))).forEach(p => add(p, Object.assign({ fill: colour, alpha: opacity }, how))); };
        shading('seaShadow', DEPTH, RELIEF_SEA_SHADOW); shading('seaLight', '#FFFFFF', RELIEF_SEA_LIGHT);
        landShape = shape(path(countries) + (lakes ? path(lakes) : ''));
        add(landShape, { fill: coloured ? LAND_COLOURED : LAND, rule: 'evenodd' });
        shading('landShadow', SHADE, RELIEF_LAND_SHADOW, { clip: true }); shading('landLight', '#FFFFFF', RELIEF_LAND_LIGHT, { clip: true });
        if (depth && depth.objects.ice) add(once('ice', () => shape(path(topojson.feature(depth, depth.objects.ice)))), { fill: ICE, stroke: DEPTH, strokeAlpha: ICE_EDGE, width: 0.6 });
        const hist = era && loaded['history.json'];
        const eraData = hist && hist.eras.find(e => e.id === era);
        let oldMesh = null;
        if (eraData) {
          const obj = hist.objects['e' + era];
          const old = once('old', () => {
            const fs = topojson.feature(hist, obj).features;
            return {
              fills: fs.map(f => ({ r: eraData.regions[f.properties.i], p: shape(path(f)) })).filter(x => x.r && OLD_COLOURS[x.r.p]),
              // names, biggest first, so the small ones give way when the map is zoomed out
              labels: fs.map(f => ({ r: eraData.regions[f.properties.i], a: path.area(f) })).filter(x => x.r && x.r.at).sort((a, b) => b.a - a.a)
                .map(({ r }) => { const [x, y] = proj(r.at); return { x, y, text: FO.lang === 'fr' ? r.fr : r.en, colour: OLD_COLOURS[r.p] || '#6B6F75' }; }),
              mesh: shape(path(topojson.mesh(hist, obj, (a, b) => a !== b))) };
          });
          old.fills.forEach(x => add(x.p, { fill: OLD_COLOURS[x.r.p], alpha: OLD_FILL, clip: true }));
          oldLabels = old.labels;
          oldMesh = old.mesh;
        }
        if (lakes) add(path(lakes), { stroke: COAST, width: 0.6 });
        if (w.objects.rivers) {
          const all = topojson.feature(w, w.objects.rivers).features;
          let lo = -1;
          for (const [hi, width, from] of RIVER_TIERS) {
            const fs = all.filter(f => f.properties.r > lo && f.properties.r <= hi); lo = hi;
            if (fs.length) add(path({ type: 'FeatureCollection', features: fs }), { stroke: RIVER, strokeAlpha: RIVER_OPACITY, width, round: true, from });
          }
        }
        add(path(topojson.mesh(w, w.objects.provinces, (a, b) => a !== b)), { stroke: BORDER, width: 0.7, dash: [3, 2] });
        add(path(topojson.mesh(w, w.objects.countries, (a, b) => a !== b)), { stroke: BORDER, width: 1 });
        if (oldMesh) add(oldMesh, { stroke: OLD_LINE, strokeAlpha: 0.75, width: 1.3, dash: [5, 3], round: true });
        add(path(topojson.mesh(w, w.objects.countries, (a, b) => a === b)), { stroke: COAST, width: 0.8 });
        if (layers.has('grid')) add(once('grid', () => shape(path(d3.geoGraticule().extent([[-180, -80], [180.0001, 85]]).step([GRID_STEP, GRID_STEP]).precision(1)()))), { stroke: GRID, strokeAlpha: GRID_OPACITY, width: 0.6 });
        if (labelG) { labels(now); paint(); }
      }
      // the canvas, drawn for the transform "now": the sea, then each copy of the world in view
      function paint() {
        const t = now;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, under.width, under.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalAlpha = coloured ? 1 : WATER_OPACITY; ctx.fillStyle = coloured ? SEA : WATER;
        ctx.fillRect(0, 0, W, H);
        const n = centreCopy(t);
        for (const d of COPIES) {
          const off = (n + d) * worldW;
          if (!inView(t, off, 0)) continue;
          ctx.setTransform(dpr * t.k, 0, 0, dpr * t.k, dpr * (t.x + t.k * off), dpr * t.y);
          let clipped = false;
          for (const it of items) {
            if (it.from && t.k < it.from) continue;
            // what stays on land is drawn inside the land's outline
            if (!!it.clip !== clipped) {
              if (clipped) ctx.restore(); else { ctx.save(); ctx.clip(landShape, 'evenodd'); }
              clipped = !clipped;
            }
            if (it.fill) { ctx.globalAlpha = it.alpha == null ? 1 : it.alpha; ctx.fillStyle = it.fill; ctx.fill(it.p, it.rule || 'nonzero'); }
            if (it.stroke) {
              ctx.globalAlpha = it.strokeAlpha == null ? 1 : it.strokeAlpha; ctx.strokeStyle = it.stroke;
              ctx.lineWidth = it.width / t.k;
              ctx.setLineDash(it.dash ? it.dash.map(v => v / t.k) : []);
              ctx.lineCap = ctx.lineJoin = it.round ? 'round' : 'butt';
              if (!it.round) ctx.lineJoin = 'miter';
              ctx.stroke(it.p);
            }
          }
          if (clipped) ctx.restore();
        }
        ctx.globalAlpha = 1;
      }
      // the finer map: used straight away if it is already here, otherwise fetched the first time someone zooms in
      let fine = FO.geoDetailReady && FO.geoDetailReady();
      let labelG = null, now = d3.zoomIdentity;
      drawBase(fine || world);
      const wantDetail = () => {
        if (fine || !FO.geoDetail) return;
        fine = true;
        FO.geoDetail().then(w => { if (w && !(o.cancelled && o.cancelled(token)) && under.isConnected) { fine = w; drawBase(w); } });
      };

      const col = o.what === 'birth' ? BIRTH : DEATH;
      const r0 = d3.scaleSqrt().domain([0, d3.max(list, s => s.n) || 1]).range([0, MAX_R]);
      const bubbleCopies = COPIES.map(() => { const g = svg('g'); zoomG.append(g); return g; });
      list.forEach(s => { const [x, y] = proj([s.lon, s.lat]); s.x = x; s.y = y; });
      const dots = bubbleCopies.flatMap(bubbles => list.map(s => {
        const x = s.x, y = s.y;
        const region = s.level === 'region', sea = s.level === 'sea';
        const c = svg('circle', Object.assign({ cx: x, cy: y, r: Math.max(2.5, r0(s.n)), fill: col, 'fill-opacity': region ? 0.08 : BUBBLE_OPACITY, stroke: region || sea ? col : '#FFFFFF', 'stroke-width': region ? 1.3 : sea ? SEA_RING : 0.9, 'stroke-opacity': region ? 0.75 : 0.9, style: 'cursor:pointer' }, ns));
        if (region) c.setAttribute('stroke-dasharray', '4 3');
        if (sea) c.setAttribute('stroke-dasharray', '1.5 2.5');
        const what = o.what === 'birth' ? (s.n === 1 ? T(' birth') : T(' births')) : (s.n === 1 ? T(' death') : T(' deaths'));
        const yrs = d3.extent(s.people.map(year).filter(y => y != null));
        const others = s.spell.size - 1;
        const lines = [ui.fmt(s.n) + what + (yrs[0] != null ? ', ' + (yrs[0] === yrs[1] ? yrs[0] : yrs[0] + '–' + yrs[1]) : '')];
        if (sea) lines.push(T('Recorded as “{top}”{x}', { top: ui.esc(s.top), x: others ? T(' and {others} other wording{x}', { others: others, x: others > 1 ? 's' : '' }) : '' }));
        else if (others) lines.push(T('and {others} other spelling{x} of this place', { others: others, x: others > 1 ? 's' : '' }));
        if (region) lines.push(T('Known only as “{label}”: shown at the centre of the region', { label: ui.esc(s.label) }));
        if (sea) lines.push(ui.esc(s.note));
        if (s.approx) lines.push(T('Village placed at the centre of its département'));
        const tip = '<b>' + ui.esc(sea ? s.label : s.top) + '</b><span>' + lines.join('<br>') + '</span>';
        c.addEventListener('mousemove', e => { c.setAttribute('fill-opacity', region ? 0.2 : 0.85); ui.tip(tip, e.clientX, e.clientY); });
        c.addEventListener('mouseleave', () => { c.setAttribute('fill-opacity', region ? 0.08 : BUBBLE_OPACITY); ui.untip(); });
        c.addEventListener('click', () => FO.showList(sea ? s.label : s.top, ui.fmt(s.n) + what + (region ? T(', known only by region') : ''), s.people.slice().sort((a, b) => (year(a) || 0) - (year(b) || 0))));
        bubbles.append(c);
        return [c, s];
      }));
      // which copy of the world is under the middle of the window; the copies sit on it and on either side of it
      let atCopy = null;
      function centreCopy(t) { return WRAP ? Math.floor(((W / 2 - t.x) / t.k - x0) / worldW) : 0; }
      // a copy is drawn only if it is in view (with room to spare): the others are left out, which saves drawing them
      function inView(t, off, spare) { return t.applyX(x0 + off) < W + spare && t.applyX(x0 + worldW + off) > -spare; }
      const show = (el, on) => { const v = on ? 'inline' : 'none'; if (el.getAttribute('display') !== v) el.setAttribute('display', v); };
      function placeCopies(n, t, copies, spare) {
        COPIES.forEach((d, i) => {
          const off = (n + d) * worldW, tr = 'translate(' + off + ',0)';
          if (copies[i].getAttribute('transform') !== tr) copies[i].setAttribute('transform', tr);
          show(copies[i], inView(t, off, spare));
        });
      }

      // names of the biggest places, kept upright and the same size while zooming
      const oldG = svg('g', { 'pointer-events': 'none' });
      labelG = svg('g', { 'pointer-events': 'none' });
      root.append(oldG, labelG);
      // the named places, each on its bubble: first a bubble of the same name (St- and Ste- read as Saint- and Sainte-), then
      // the biggest one near enough; then, region by region, the biggest first
      const plain = x => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(ste?)\b\.?[\s-]*/g, (m, a) => (a === 'st' ? 'saint' : 'sainte')).replace(/[^a-z]/g, '');
      const used = new Set();
      const nearTo = ([, lon, lat, within = 0.12]) => list.filter(s => s.level === 'place' && !used.has(s) && Math.abs(s.lat - lat) <= within && Math.abs(s.lon - lon) <= within / Math.cos(lat * Math.PI / 180));
      const groups = NAMED_PLACES.map(g => g.map(a => ({ a, s: nearTo(a).find(s => plain(s.label) === plain(a[0])) })));
      groups.forEach(g => g.forEach(x => { if (x.s) used.add(x.s); }));
      groups.forEach(g => g.forEach(x => { if (!x.s) { x.s = nearTo(x.a).sort((p, q) => q.n - p.n)[0]; if (x.s) used.add(x.s); } }));
      const byRegion = groups.map(g => g.filter(x => x.s).sort((p, q) => q.s.n - p.s.n));
      const pinned = [];
      for (let i = 0; byRegion.some(g => g[i]); i++) byRegion.forEach(g => { if (g[i]) pinned.push({ text: g[i].a[0], s: g[i].s }); });
      const pinnedSpots = new Set(pinned.map(p => p.s)), pinnedNames = new Set(NAMED_PLACES.flat().map(a => plain(a[0])));
      const named = list.filter(s => (s.level === 'place' || s.level === 'sea') && !pinnedSpots.has(s) && !pinnedNames.has(plain(s.label))).slice(0, LABELS * 3);
      function labels(t) {
        labelG.innerHTML = ''; oldG.innerHTML = '';
        const boxes = []; let shown = 0;
        // the names of the colonies, in italics, on every copy of the world in view, leaving out any that would overlap
        const oldBoxes = [];
        for (const l of oldLabels) {
          const y = t.applyY(l.y), w = l.text.length * 6.2;
          if (y < 8 || y > H - 8) continue;
          for (const d of COPIES) {
            const x = t.applyX(l.x + (atCopy + d) * worldW);
            if (x < w / 2 || x > W - w / 2) continue;
            const b = [x - w / 2 - 4, y - 9, w + 8, 18];
            if (oldBoxes.some(o => b[0] < o[0] + o[2] && b[0] + b[2] > o[0] && b[1] < o[1] + o[3] && b[1] + b[3] > o[1])) continue;
            oldBoxes.push(b);
            const tx = svg('text', { x, y: y + 4, 'text-anchor': 'middle', style: 'font-size:11.5px;font-style:italic;letter-spacing:.02em;fill:' + l.colour + ';paint-order:stroke;stroke:#F7F4EE;stroke-width:3px;stroke-linejoin:round' });
            tx.textContent = l.text; oldG.append(tx);
          }
        }
        // a place's name to the right of its bubble, or to the left if that is taken, unless it would run off the map or over
        // another name
        function name(s, label) {
          const y = t.applyY(s.y), r = (s.n ? Math.max(2.5, r0(s.n)) : 0) * Math.sqrt(t.k);
          // on whichever copy of the world the place is in view
          const x = COPIES.map(d => t.applyX(s.x + (atCopy + d) * worldW)).find(v => v >= 0 && v <= W);
          if (x == null || y < 0 || y > H) return false;
          const text = label.length > 24 ? label.slice(0, 22) + '…' : label;
          const w = text.length * 6.6 + 6, by = y - 8;
          const free = bx => bx >= 0 && bx + w <= W && !boxes.some(b => bx < b[0] + b[2] && bx + w > b[0] && by < b[1] + 16 && by + 16 > b[1]);
          const bx = [x + r + 3, x - r - 3 - w].find(free);
          if (bx == null) return false;
          boxes.push([bx, by, w]);
          const tx = svg('text', { x: bx, y: y + 4, style: 'font-size:12px;fill:#1B2632;paint-order:stroke;stroke:#F7F4EE;stroke-width:3px;stroke-linejoin:round' });
          tx.textContent = text; labelG.append(tx);
          return true;
        }
        pinned.forEach(p => name(p.s, p.text));
        for (const s of named) {
          if (shown >= LABELS) break;
          if (name(s, s.label)) shown++;
        }
      }

      // the map cannot be dragged past the top and bottom of the world (Antarctica stays above the bottom edge); east and west it
      // wraps around
      const sphere = path.bounds({ type: 'Sphere' });
      // at every step of a drag or zoom: the canvas, the bubbles and the names, once per frame of the screen
      let queued = 0, lastK = null;
      function step() {
        queued = 0;
        const t = now;
        const n = centreCopy(t);
        atCopy = n;
        placeCopies(n, t, bubbleCopies, 60);
        zoomG.setAttribute('transform', t.toString());
        if (t.k !== lastK) { lastK = t.k; dots.forEach(([c, s]) => c.setAttribute('r', Math.max(2.5, r0(s.n)) / Math.sqrt(t.k))); }
        paint();
        if (t.k >= DETAIL_FROM) wantDetail();
        labels(t); ui.untip();
      }
      // zoomed out, the world fills the frame from top to bottom and goes no smaller (east and west it wraps)
      const zoom = d3.zoom().scaleExtent([WRAP ? Math.min(1, H / (sphere[1][1] - sphere[0][1])) : 0.5, 80]).extent([[0, 0], [W, H]])
        .translateExtent(WRAP ? [[-Infinity, sphere[0][1]], [Infinity, sphere[1][1]]] : sphere).on('zoom', e => {
        now = e.transform;
        if (o.keep) o.keep.t = now;
        if (!queued) queued = requestAnimationFrame(step);
      });
      d3.select(root).call(zoom).on('dblclick.zoom', null);
      o.resetZoom = () => d3.select(root).transition().duration(500).call(zoom.transform, d3.zoomIdentity);
      // the same zoom as before this redraw (a new century, deaths instead of births, a window resized only slightly)
      const k = o.keep;
      if (k && k.t && k.W === W && k.H === H && k.frame === pts.length) d3.select(root).call(zoom.transform, k.t);
      else { if (k) Object.assign(k, { W, H, frame: pts.length, t: d3.zoomIdentity }); d3.select(root).call(zoom.transform, d3.zoomIdentity); }
      if (queued) cancelAnimationFrame(queued);
      step();

      // sources, as GeoNames' licence asks
      const credit = svg('text', { x: 12, y: 18, style: 'font-size:10.5px;fill:#7C8088;paint-order:stroke;stroke:#F7F4EE;stroke-width:3px;stroke-linejoin:round' });
      credit.textContent = T('Map: Natural Earth. Places: GeoNames (CC BY 4.0), Natural Resources Canada, INSEE.') + (relief ? ' ' + T('Relief: ETOPO1 (NOAA), via Fatiando a Terra (CC BY 4.0).') : '');
      root.append(credit);
      root.append(svg('rect', { x: 0.5, y: 0.5, width: W - 1, height: H - 1, rx: 4, fill: 'none', stroke: FRAME, 'stroke-opacity': FRAME_OPACITY, 'pointer-events': 'none' }));

      const placed = ppl.length - missing - atRegion - atSea;
      const noun = o.what === 'birth' ? T('births') : T('deaths');
      hint.textContent = T('{length} {noun} with a place recorded: {placed} found at a town or village{x}, {atRegion} known only by region{x2}{x3}{x4}. Bubbles grow with the number of people. Scroll to zoom, drag to move, click a bubble to list the people.', { length: ui.fmt(ppl.length), noun: noun, placed: ui.fmt(placed), x: approx ? T(' ({approx} French villages at the centre of their département)', { approx: ui.fmt(approx) }) : '', atRegion: ui.fmt(atRegion), x2: o.regions ? T(' (dashed rings at the region’s centre)') : T(' (not shown)'), x3: atSea ? T(', {atSea} at sea (dotted rings, on the crossing they were most likely on)', { atSea: ui.fmt(atSea) }) : '', x4: missing ? T(', {missing} not found (a name the map does not know)', { missing: ui.fmt(missing) }) : '' });
      if (era) {
        const e = FO.OLD_BORDER_ERAS.find(x => x.id === era);
        hint.textContent += ' ' + T('Old borders: {era}. They are drawn by hand from treaty lines and only approximate, and most of this land was Indigenous country.', { era: e ? e.label : era });
      }
      legend();
      // the legend, with the colonial powers of the era when the old borders are on
      function legend() {
        if (!o.onLegend || (o.cancelled && o.cancelled(token))) return;
        const hist = era && loaded['history.json'], e = hist && hist.eras.find(x => x.id === era);
        const powers = e ? [...new Set(e.regions.map(r => r.p).filter(p => OLD_COLOURS[p]))] : [];
        o.onLegend([{ label: o.what === 'birth' ? T('Births at a place') : T('Deaths at a place'), color: col }]
          .concat(atSea ? [{ label: o.what === 'birth' ? T('Born at sea') : T('Died at sea'), color: col, sea: true }] : [])
          .concat(atRegion && o.regions ? [{ label: T('Known only by region'), color: col, line: true }] : [])
          .concat(powers.map(p => ({ label: OLD_POWER[p], color: OLD_COLOURS[p], area: true }))));
      }
    }
  };
})();
