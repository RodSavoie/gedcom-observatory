/* Where They Lived, Map: a zoomable bubble map of birthplaces or places of death.
   Each bubble is one place, sized by how many people were born (or died) there. Places named only by a region
   ("Acadie", "France") sit at that region's centre as dashed rings. Place matching is in js/geo.js. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el, svg = ui.svg, C = FO.C;

  // how the map looks: change these to taste
  const LAND = '#F7F4EE', COAST = '#B9B09F', BORDER = '#CFC7B8';
  const BIRTH = C.teal, DEATH = C.red;
  const BUBBLE_OPACITY = 0.5;      // fill of a bubble (0 to 1)
  const MAX_R = 30;                // the biggest bubble's radius, in pixels, before zooming
  const LABELS = 14;               // how many of the biggest places get a name on the map

  /* opts: {stage, root (svg), hint, data (scoped), what: 'birth'|'death', period: 'all'|century, regions: bool, onLegend} */
  FO.placesMap = function (o) {
    const { stage, root, hint } = o;
    const W = stage.clientWidth, H = stage.clientHeight;
    const year = p => (o.what === 'birth' ? (p.by != null ? p.by : p.est) : p.dy);
    const placeOf = p => (o.what === 'birth' ? p.b && p.b.place : p.d && p.d.place);
    const all = o.data.people.filter(p => !p.hidden && placeOf(p));
    const inPeriod = p => o.period === 'all' || (year(p) != null && Math.floor(year(p) / 100) * 100 === +o.period);
    const ppl = all.filter(inPeriod);
    const msg = (text) => { const t = svg('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', style: 'font-size:16px;fill:#3D4B5E' }); t.textContent = text; root.append(t); };
    if (!ppl.length) { msg(o.what === 'birth' ? 'No birthplaces recorded for this period.' : 'No places of death recorded for this period.'); hint.textContent = ''; return; }
    msg('Finding the places on the map…');
    const token = o.token = {};
    FO.geoLoad([...new Set(all.map(placeOf))]).then(({ world, locate }) => {
      if (o.cancelled && o.cancelled(token)) return;
      root.innerHTML = '';
      draw(world, locate);
    }).catch(err => { root.innerHTML = ''; msg('The map could not be loaded (' + err.message + ').'); });

    function draw(world, locate) {
      // one bubble per spot on the map
      const spots = new Map();
      let atRegion = 0, missing = 0, approx = 0;
      for (const p of ppl) {
        const pl = placeOf(p), loc = locate(pl);
        if (!loc) { missing++; continue; }
        if (loc.level === 'region') { atRegion++; if (!o.regions) continue; }
        if (loc.approx) approx++;
        const k = loc.lat.toFixed(3) + ',' + loc.lon.toFixed(3) + ',' + loc.level;
        let s = spots.get(k);
        if (!s) spots.set(k, s = { lat: loc.lat, lon: loc.lon, level: loc.level, approx: loc.approx, label: loc.name, people: [], spell: new Map() });
        s.people.push(p); s.spell.set(pl, (s.spell.get(pl) || 0) + 1);
      }
      const list = [...spots.values()].sort((a, b) => b.people.length - a.people.length);
      list.forEach(s => { s.top = [...s.spell].sort((a, b) => b[1] - a[1])[0][0]; s.n = s.people.length; if (s.level === 'place') s.label = s.top.split(',')[0].replace(/\(.*?\)/g, '').trim() || s.label; });

      // fit the map to the places (towns first; regions only if nothing else)
      const fitTo = list.filter(s => s.level === 'place');
      const pts = (fitTo.length ? fitTo : list).map(s => [s.lon, s.lat]);
      const proj = d3.geoMercator();
      const pad = 34;
      if (pts.length) proj.fitExtent([[pad, pad], [W - pad, H - pad - 34]], { type: 'MultiPoint', coordinates: pts });
      if (pts.length < 2 || proj.scale() > 6000) proj.scale(Math.min(proj.scale(), 6000)).center(pts[0] || [0, 0]).translate([W / 2, H / 2]);
      const path = d3.geoPath(proj);

      const zoomG = svg('g');
      root.append(zoomG);
      const countries = topojson.feature(world, world.objects.countries);
      const ns = { 'vector-effect': 'non-scaling-stroke' };
      zoomG.append(svg('path', { d: path(countries), fill: LAND, stroke: 'none' }));
      zoomG.append(svg('path', Object.assign({ d: path(topojson.mesh(world, world.objects.provinces, (a, b) => a !== b)), fill: 'none', stroke: BORDER, 'stroke-width': 0.7, 'stroke-dasharray': '3 2' }, ns)));
      zoomG.append(svg('path', Object.assign({ d: path(topojson.mesh(world, world.objects.countries, (a, b) => a !== b)), fill: 'none', stroke: BORDER, 'stroke-width': 1 }, ns)));
      zoomG.append(svg('path', Object.assign({ d: path(topojson.mesh(world, world.objects.countries, (a, b) => a === b)), fill: 'none', stroke: COAST, 'stroke-width': 0.8 }, ns)));

      const col = o.what === 'birth' ? BIRTH : DEATH;
      const r0 = d3.scaleSqrt().domain([0, d3.max(list, s => s.n) || 1]).range([0, MAX_R]);
      const bubbles = svg('g');
      zoomG.append(bubbles);
      const dots = list.map(s => {
        const [x, y] = proj([s.lon, s.lat]);
        s.x = x; s.y = y;
        const region = s.level === 'region';
        const c = svg('circle', Object.assign({ cx: x, cy: y, r: Math.max(2.5, r0(s.n)), fill: col, 'fill-opacity': region ? 0.08 : BUBBLE_OPACITY, stroke: region ? col : '#FFFFFF', 'stroke-width': region ? 1.3 : 0.9, 'stroke-opacity': region ? 0.75 : 0.9, style: 'cursor:pointer' }, ns));
        if (region) c.setAttribute('stroke-dasharray', '4 3');
        const what = o.what === 'birth' ? (s.n === 1 ? ' birth' : ' births') : (s.n === 1 ? ' death' : ' deaths');
        const yrs = d3.extent(s.people.map(year).filter(y => y != null));
        const others = s.spell.size - 1;
        const tip = '<b>' + ui.esc(s.top) + '</b><span>' + ui.fmt(s.n) + what + (yrs[0] != null ? ', ' + (yrs[0] === yrs[1] ? yrs[0] : yrs[0] + '–' + yrs[1]) : '') + '</span>' +
          (others ? '<span>and ' + others + ' other spelling' + (others > 1 ? 's' : '') + ' of this place</span>' : '') +
          (region ? '<span>Known only as “' + ui.esc(s.label) + '”: shown at the centre of the region</span>' : '') +
          (s.approx ? '<span>Village placed at the centre of its département</span>' : '');
        c.addEventListener('mousemove', e => { c.setAttribute('fill-opacity', region ? 0.2 : 0.85); ui.tip(tip, e.clientX, e.clientY); });
        c.addEventListener('mouseleave', () => { c.setAttribute('fill-opacity', region ? 0.08 : BUBBLE_OPACITY); ui.untip(); });
        c.addEventListener('click', () => FO.showList(s.top, ui.fmt(s.n) + what + (region ? ', known only by region' : ''), s.people.slice().sort((a, b) => (year(a) || 0) - (year(b) || 0))));
        bubbles.append(c);
        return [c, s];
      });

      // names of the biggest places, kept upright and the same size while zooming
      const labelG = svg('g', { 'pointer-events': 'none' });
      root.append(labelG);
      const named = list.filter(s => s.level === 'place').slice(0, LABELS * 3);
      function labels(t) {
        labelG.innerHTML = '';
        const boxes = []; let shown = 0;
        for (const s of named) {
          if (shown >= LABELS) break;
          const x = t.applyX(s.x), y = t.applyY(s.y), r = Math.max(2.5, r0(s.n)) * Math.sqrt(t.k);
          if (x < 0 || x > W || y < 0 || y > H) continue;
          const text = s.label.length > 24 ? s.label.slice(0, 22) + '…' : s.label;
          const w = text.length * 6.6 + 6, bx = x + r + 3, by = y - 8;
          if (bx + w > W || boxes.some(b => bx < b[0] + b[2] && bx + w > b[0] && by < b[1] + 16 && by + 16 > b[1])) continue;
          boxes.push([bx, by, w]);
          const tx = svg('text', { x: bx, y: y + 4, style: 'font-size:12px;fill:#1B2632;paint-order:stroke;stroke:#F7F4EE;stroke-width:3px;stroke-linejoin:round' });
          tx.textContent = text; labelG.append(tx); shown++;
        }
      }

      const zoom = d3.zoom().scaleExtent([0.5, 80]).on('zoom', e => {
        const t = e.transform;
        zoomG.setAttribute('transform', t.toString());
        dots.forEach(([c, s]) => c.setAttribute('r', Math.max(2.5, r0(s.n)) / Math.sqrt(t.k)));
        labels(t); ui.untip();
      });
      d3.select(root).call(zoom).on('dblclick.zoom', null);
      o.resetZoom = () => d3.select(root).transition().duration(500).call(zoom.transform, d3.zoomIdentity);
      labels(d3.zoomIdentity);

      // sources, as GeoNames' licence asks
      const credit = svg('text', { x: 12, y: 18, style: 'font-size:10.5px;fill:#7C8088;paint-order:stroke;stroke:#F7F4EE;stroke-width:3px;stroke-linejoin:round' });
      credit.textContent = 'Map: Natural Earth. Places: GeoNames (CC BY 4.0), Natural Resources Canada, INSEE.';
      root.append(credit);

      const placed = ppl.length - missing - atRegion;
      const noun = o.what === 'birth' ? 'births' : 'deaths';
      hint.textContent = ui.fmt(ppl.length) + ' ' + noun + ' with a place recorded: ' + ui.fmt(placed) + ' found at a town or village' +
        (approx ? ' (' + ui.fmt(approx) + ' French villages at the centre of their département)' : '') + ', ' + ui.fmt(atRegion) + ' known only by region' +
        (o.regions ? ' (dashed rings at the region’s centre)' : ' (not shown)') + (missing ? ', ' + ui.fmt(missing) + ' not found (at sea, or a name the map does not know)' : '') +
        '. Bubbles grow with the number of people. Scroll to zoom, drag to move, click a bubble to list the people.';
      if (o.onLegend) o.onLegend([{ label: o.what === 'birth' ? 'Births at a place' : 'Deaths at a place', color: col }].concat(atRegion && o.regions ? [{ label: 'Known only by region', color: col, line: true }] : []));
    }
  };
})();
