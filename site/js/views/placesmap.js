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
  const WRAP = true;               // the map wraps around east and west (Russia carries on left of Alaska); false stops at the edges

  /* Layers, switched on and off under "Layers" above the map. LAYERS_DEFAULT is what a new visitor sees (any of 'colours',
     'grid', 'borders'); after that each visitor's own choice is kept. Their files are fetched only when first needed. */
  const LAYERS_DEFAULT = ['colours'];
  // Colours: a light blue sea that darkens with depth (200 m, then 1, 2, 3, 4, 5 and 6 km), land a shade darker than the
  // page, and glaciers and ice shelves almost white. These are the colours of the default palette; each design has its own
  // (sea, depth, land and ice in js/designs.js).
  const SEA = '#E3EBF1', DEPTH = '#7F9CB4', LAND_COLOURED = '#E3DCCF', ICE = '#F5F8FA';
  const ICE_EDGE = 0.25;           // how strongly the ice's edge is drawn (in the deep-water colour), 0 to 1
  const DEPTH_OPACITY = 0.05;      // how much colour each step down adds (0 to 1)
  const GRID = '#8FA8BD', GRID_OPACITY = 0.35, GRID_STEP = 5;   // the latitude and longitude grid: colour, strength, degrees apart
  const OLD_COLOURS = { fr: '#3B6EA5', gb: '#B5473A', es: '#C9921F', us: '#5E7186', ca: '#7C5A8E', mx: '#6E8B3D', ru: '#3F8C7A' };
  const OLD_FILL = 0.15;           // old borders: how strongly each colony is tinted
  const OLD_LINE = '#6B5E50';      // and the colour of the borders between them
  const OLD_ERA_FOR = { 1600: '1632', 1700: '1713', 1800: '1803', 1900: '1867', 2000: '1867', all: '1713' };   // the era shown for each period, unless one is picked
  const LAYERS_VERSION = 3;        // raise when a layer's files are rebuilt, so browsers fetch the new ones
  let mapCount = 0;

  // the eras of the old borders (data/map/history.json, built by tools/build-map-history.js)
  FO.OLD_BORDER_ERAS = [
    { id: '1632', label: T('1632–1713: Acadie and New France') },
    { id: '1713', label: T('1713–1763: after the Treaty of Utrecht') },
    { id: '1763', label: T('1763–1783: after the Treaty of Paris') },
    { id: '1784', label: T('1784–1803: after the American Revolution') },
    { id: '1803', label: T('1803–1867: before Confederation') },
    { id: '1867', label: T('1867–1949: Confederation') }];
  const OLD_POWER = { fr: T('French'), gb: T('British'), es: T('Spanish'), us: T('American'), ca: T('Canadian'), mx: T('Mexican'), ru: T('Russian') };
  FO.MAP_LAYERS = [['colours', T('Colours')], ['grid', T('Latitude and longitude')], ['borders', T('Old borders')]];
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
      root.append(svg('rect', { x: 0, y: 0, width: W, height: H, rx: 4, fill: coloured ? SEA : WATER, 'fill-opacity': coloured ? 1 : WATER_OPACITY, 'pointer-events': 'none' }));
      const zoomG = svg('g');
      root.append(zoomG);
      const ns = { 'vector-effect': 'non-scaling-stroke' };
      /* The world is drawn once (baseG, kept in <defs>) and shown side by side as copies; when WRAP is on there are three,
         and they move along as the map is dragged east or west, so there is always world on either side. Each copy has its
         own bubbles, so pointing and clicking work on all of them. */
      const x0 = proj([-180, 0])[0], worldW = proj([180, 0])[0] - x0;
      const COPIES = WRAP ? [-1, 0, 1] : [0];
      const defs = svg('defs');
      root.append(defs);
      const baseId = 'fo-map-base-' + (++mapCount);
      const baseG = svg('g', { id: baseId, class: 'fo-map-base' });
      defs.append(baseG);
      const baseCopies = COPIES.map(() => { const g = svg('g'); g.append(svg('use', { href: '#' + baseId })); zoomG.append(g); return g; });
      let riverTiers = [];
      const era = layers.has('borders') ? (o.era && o.era !== 'auto' ? o.era : OLD_ERA_FOR[o.period] || OLD_ERA_FOR.all) : null;
      const want = (coloured ? ['layers.json'] : []).concat(era ? ['history.json'] : []);
      want.forEach(f => { if (!loaded[f]) fetchLayer(f).then(j => { if (j && !loaded[f]) { loaded[f] = j; if (baseG.isConnected) { drawBase(current); legend(); } } }); });
      // the land as a clipping shape, so the colonies' tints stop at the coast
      const landId = baseId + '-land', clipId = baseId + '-clip';
      defs.append(svg('clipPath', { id: clipId }, svg('use', { href: '#' + landId, 'clip-rule': 'evenodd' })));
      let current = null, oldLabels = [];
      // the land, lakes, rivers and borders, with the layers that are on; drawn again with the finer map once someone zooms in
      function drawBase(w) {
        current = w;
        baseG.innerHTML = ''; riverTiers = []; oldLabels = [];
        const countries = topojson.feature(w, w.objects.countries);
        // land with the lakes cut out of it, so lakes show the same background as the sea
        const lakes = w.objects.lakes ? topojson.feature(w, w.objects.lakes) : null;
        const depth = coloured && loaded['layers.json'];
        if (depth) ['d200', 'd1000', 'd2000', 'd3000', 'd4000', 'd5000', 'd6000'].forEach(k => {
          if (depth.objects[k]) baseG.append(svg('path', { d: path(topojson.feature(depth, depth.objects[k])), fill: DEPTH, 'fill-opacity': DEPTH_OPACITY, stroke: 'none' }));
        });
        baseG.append(svg('path', { id: landId, d: path(countries) + (lakes ? path(lakes) : ''), fill: coloured ? LAND_COLOURED : LAND, 'fill-rule': 'evenodd', stroke: 'none' }));
        if (depth && depth.objects.ice) baseG.append(svg('path', Object.assign({ d: path(topojson.feature(depth, depth.objects.ice)), fill: ICE, stroke: DEPTH, 'stroke-opacity': ICE_EDGE, 'stroke-width': 0.6 }, ns)));
        const hist = era && loaded['history.json'];
        const eraData = hist && hist.eras.find(e => e.id === era);
        if (eraData) {
          const obj = hist.objects['e' + era], fs = topojson.feature(hist, obj).features;
          const g = svg('g', { 'clip-path': 'url(#' + clipId + ')' });
          fs.forEach(f => { const r = eraData.regions[f.properties.i]; if (r && OLD_COLOURS[r.p]) g.append(svg('path', { d: path(f), fill: OLD_COLOURS[r.p], 'fill-opacity': OLD_FILL, stroke: 'none' })); });
          baseG.append(g);
          // names, biggest first, so the small ones give way when the map is zoomed out
          oldLabels = fs.map(f => ({ r: eraData.regions[f.properties.i], a: path.area(f) })).filter(x => x.r && x.r.at).sort((a, b) => b.a - a.a)
            .map(({ r }) => { const [x, y] = proj(r.at); return { x, y, text: FO.lang === 'fr' ? r.fr : r.en, colour: OLD_COLOURS[r.p] || '#6B6F75' }; });
          baseG.oldMesh = path(topojson.mesh(hist, obj, (a, b) => a !== b));
        } else baseG.oldMesh = null;
        if (lakes) baseG.append(svg('path', Object.assign({ d: path(lakes), fill: 'none', stroke: COAST, 'stroke-width': 0.6 }, ns)));
        if (w.objects.rivers) {
          const all = topojson.feature(w, w.objects.rivers).features;
          let lo = -1;
          for (const [hi, width, from] of RIVER_TIERS) {
            const fs = all.filter(f => f.properties.r > lo && f.properties.r <= hi); lo = hi;
            if (!fs.length) continue;
            const el = svg('path', Object.assign({ d: path({ type: 'FeatureCollection', features: fs }), fill: 'none', stroke: RIVER, 'stroke-opacity': RIVER_OPACITY, 'stroke-width': width, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ns));
            baseG.append(el); riverTiers.push([el, from]);
          }
        }
        baseG.append(svg('path', Object.assign({ d: path(topojson.mesh(w, w.objects.provinces, (a, b) => a !== b)), fill: 'none', stroke: BORDER, 'stroke-width': 0.7, 'stroke-dasharray': '3 2' }, ns)));
        baseG.append(svg('path', Object.assign({ d: path(topojson.mesh(w, w.objects.countries, (a, b) => a !== b)), fill: 'none', stroke: BORDER, 'stroke-width': 1 }, ns)));
        if (baseG.oldMesh) baseG.append(svg('path', Object.assign({ d: baseG.oldMesh, fill: 'none', stroke: OLD_LINE, 'stroke-opacity': 0.75, 'stroke-width': 1.3, 'stroke-dasharray': '5 3', 'stroke-linejoin': 'round' }, ns)));
        baseG.append(svg('path', Object.assign({ d: path(topojson.mesh(w, w.objects.countries, (a, b) => a === b)), fill: 'none', stroke: COAST, 'stroke-width': 0.8 }, ns)));
        if (layers.has('grid')) baseG.append(svg('path', Object.assign({ d: path(d3.geoGraticule().extent([[-180, -80], [180.0001, 85]]).step([GRID_STEP, GRID_STEP]).precision(1)()), fill: 'none', stroke: GRID, 'stroke-opacity': GRID_OPACITY, 'stroke-width': 0.6 }, ns)));
        const k = d3.zoomTransform(root).k;
        riverTiers.forEach(([el, from]) => el.setAttribute('display', k >= from ? 'inline' : 'none'));
        if (labelG) labels(d3.zoomTransform(root));
      }
      // the finer map: used straight away if it is already here, otherwise fetched the first time someone zooms in
      let fine = FO.geoDetailReady && FO.geoDetailReady();
      let labelG = null;
      drawBase(fine || world);
      const wantDetail = () => {
        if (fine || !FO.geoDetail) return;
        fine = true;
        FO.geoDetail().then(w => { if (w && !(o.cancelled && o.cancelled(token)) && baseG.isConnected) { fine = w; drawBase(w); } });
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
      const centreCopy = t => WRAP ? Math.floor(((W / 2 - t.x) / t.k - x0) / worldW) : 0;
      function placeCopies(n) {
        if (n === atCopy) return;
        atCopy = n;
        COPIES.forEach((d, i) => { const tr = 'translate(' + (n + d) * worldW + ',0)'; baseCopies[i].setAttribute('transform', tr); bubbleCopies[i].setAttribute('transform', tr); });
      }

      // names of the biggest places, kept upright and the same size while zooming
      const oldG = svg('g', { 'pointer-events': 'none' });
      labelG = svg('g', { 'pointer-events': 'none' });
      root.append(oldG, labelG);
      const named = list.filter(s => s.level === 'place' || s.level === 'sea').slice(0, LABELS * 3);
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
        for (const s of named) {
          if (shown >= LABELS) break;
          const y = t.applyY(s.y), r = Math.max(2.5, r0(s.n)) * Math.sqrt(t.k);
          // on whichever copy of the world the place is in view
          const x = COPIES.map(d => t.applyX(s.x + (atCopy + d) * worldW)).find(v => v >= 0 && v <= W);
          if (x == null || y < 0 || y > H) continue;
          const text = s.label.length > 24 ? s.label.slice(0, 22) + '…' : s.label;
          const w = text.length * 6.6 + 6, bx = x + r + 3, by = y - 8;
          if (bx + w > W || boxes.some(b => bx < b[0] + b[2] && bx + w > b[0] && by < b[1] + 16 && by + 16 > b[1])) continue;
          boxes.push([bx, by, w]);
          const tx = svg('text', { x: bx, y: y + 4, style: 'font-size:12px;fill:#1B2632;paint-order:stroke;stroke:#F7F4EE;stroke-width:3px;stroke-linejoin:round' });
          tx.textContent = text; labelG.append(tx); shown++;
        }
      }

      // the map cannot be dragged past the top and bottom of the world (Antarctica stays above the bottom edge); east and west it
      // wraps around, and it can be zoomed out until the whole world is a little under half the width of the window
      const sphere = path.bounds({ type: 'Sphere' });
      const zoom = d3.zoom().scaleExtent([WRAP ? Math.min(0.5, W * 0.45 / worldW) : 0.5, 80]).extent([[0, 0], [W, H]])
        .translateExtent(WRAP ? [[-Infinity, sphere[0][1]], [Infinity, sphere[1][1]]] : sphere).on('zoom', e => {
        const t = e.transform;
        placeCopies(centreCopy(t));
        if (o.keep) o.keep.t = t;
        zoomG.setAttribute('transform', t.toString());
        dots.forEach(([c, s]) => c.setAttribute('r', Math.max(2.5, r0(s.n)) / Math.sqrt(t.k)));
        riverTiers.forEach(([el, from]) => { const v = t.k >= from ? 'inline' : 'none'; if (el.getAttribute('display') !== v) el.setAttribute('display', v); });
        if (t.k >= DETAIL_FROM) wantDetail();
        labels(t); ui.untip();
      });
      d3.select(root).call(zoom).on('dblclick.zoom', null);
      o.resetZoom = () => d3.select(root).transition().duration(500).call(zoom.transform, d3.zoomIdentity);
      // the same zoom as before this redraw (a new century, deaths instead of births, a window resized only slightly)
      const k = o.keep;
      if (k && k.t && k.W === W && k.H === H && k.frame === pts.length) d3.select(root).call(zoom.transform, k.t);
      else { if (k) Object.assign(k, { W, H, frame: pts.length, t: d3.zoomIdentity }); d3.select(root).call(zoom.transform, d3.zoomIdentity); }

      // sources, as GeoNames' licence asks
      const credit = svg('text', { x: 12, y: 18, style: 'font-size:10.5px;fill:#7C8088;paint-order:stroke;stroke:#F7F4EE;stroke-width:3px;stroke-linejoin:round' });
      credit.textContent = T('Map: Natural Earth. Places: GeoNames (CC BY 4.0), Natural Resources Canada, INSEE.');
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
