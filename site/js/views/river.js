/* River of lifetimes: one line per person from birth to death. */
(function () {
  'use strict';
  const FO = window.FO, ui = FO.ui, el = ui.el, C = FO.C;
  const KIN_COLORS = { home: '#1B2632', ancestor: '#A35139', descendant: '#5450A8', relative: '#2B80AA', inlaw: '#DB8328', other: '#B3AC9C' };

  FO.view({
    id: 'river', order: 5, title: 'River of Lifetimes',
    card: 'Every life as a line from birth to death, stacked through the centuries.',
    how: {"see": "The family as a river of lifetimes. Time runs left to right and each thin line is one person, from birth to death, with the earliest births at the top.", "marks": ["Up and down position only orders people by birth year. It means nothing else about a person.", "In the first colouring, red lines are the home person’s direct ancestors, blue are descendants, teal are other blood relatives, gold are people married to a relative and grey are not related by blood. The tick-boxes above the picture are the key.", "A line that fades out has no recorded death year; its length is a guess based on the typical lifespan in this file.", "The curve at the bottom counts how many of these people were alive each year. Red dots along the top are moments of history."], "can": ["Tick or untick each kind of person to show or hide them: direct ancestors, descendants, blood relatives, people married to a relative, and people not related by blood.", "Colour the lives by relationship, surname or birthplace.", "Scroll to zoom in until names appear; drag to move.", "Point at a line for details and click it to open that person. Point at the curve to read a year’s count."], "care": "Anyone who may be living, and anyone with no birth year at all, is left out, so the picture is smaller than the tree."},
    blurb: 'Each thin line is one life, starting at birth and ending at death, with the earliest births at the top. The curve underneath estimates how many of these people were alive in any given year.',
    icon: '<path d="M6 12 H26 M10 18 H34 M14 24 H30 M20 30 H44 M24 36 H50 M30 42 H52 M36 48 H58 M42 54 H58"/><path d="M14 24 H30" stroke="#A35139" stroke-width="2.2"/><path d="M30 42 H52" stroke="#2B80AA" stroke-width="2.2"/>',
    render(v) {
      const s = v.state, data = v.data, kin = FO.kin();
      let colorBy = 'kin';
      const ppl = data.people.filter(p => p.est != null && !p.hidden).sort((a, b) => a.est - b.est);
      if (ppl.length < 2) { ui.empty(v.stage, 'Not enough dates', 'This view needs birth years. The file has too few to draw a river.'); return; }
      // typical lifespan, for people whose death is not recorded
      const spans = ppl.filter(p => p.by != null && p.dy != null && p.dy >= p.by).map(p => p.dy - p.by);
      const typical = spans.length ? d3.median(spans) : 60;
      const span = p => (p.dy != null && p.dy >= p.est ? p.dy : p.est + (p.dead || p.est < new Date().getFullYear() - 100 ? typical : Math.min(typical, new Date().getFullYear() - p.est)));
      const y0 = d3.min(ppl, p => p.est), y1 = Math.min(new Date().getFullYear(), d3.max(ppl, span));
      // which kinds of people are drawn; the home person always is
      const KINDS = ['ancestor', 'descendant', 'relative', 'inlaw', 'other'];
      const kindCount = d3.rollup(ppl, x => x.length, p => kin.cls.get(p));
      const show = {};
      KINDS.forEach(k => (show[k] = s.scope === 'anc' ? k === 'ancestor' : true));
      let rows = [], alive = [], peak = 0, peakYear = y0;
      function rebuild() {
        rows = ppl.filter(p => { const c = kin.cls.get(p); return c === 'home' || show[c]; }).map((p, i) => ({ p, i, b: p.est, d: span(p), known: p.dy != null }));
        alive = [];
        for (let y = y0; y <= y1; y++) alive.push(0);
        rows.forEach(r => { for (let y = r.b; y <= Math.min(r.d, y1); y++) alive[y - y0]++; });
        peak = d3.max(alive) || 0; peakYear = y0 + alive.indexOf(peak);
        setColors();
        if (hintEl) hintEl.textContent = hintText();
      }
      let hintEl = null;

      // history shown for context: world events always, regional ones when the family lived there
      const regShare = d3.rollup(ppl.filter(p => p.b && p.b.place), x => x.length, p => FO.region(p.b.place));
      const placed = d3.sum([...regShare.values()]) || 1;
      const history = (FO.HISTORY || []).filter(([y, , set]) => y >= y0 && y <= y1 && (!set || d3.sum([...set], r => regShare.get(r) || 0) / placed > 0.15));
      let colorOf, legendBox = null;
      function setColors() {
        if (legendBox) legendBox.remove();
        const shown = rows.map(r => r.p);
        if (colorBy === 'kin') {
          colorOf = p => KIN_COLORS[kin.cls.get(p)];
          legendBox = null; // the tick-boxes above the picture are the key
          void 0;
        } else {
          const cat = FO.topCategories(shown, colorBy === 'surname' ? p => p.surname : p => FO.region(p.b && p.b.place));
          colorOf = cat.color;
          legendBox = FO.legend(v.stage, colorBy === 'surname' ? 'Surname' : 'Born in', cat.legend);
        }
        rows.forEach(r => (r.c = colorOf(r.p)));
      }

      rebuild();
      const m = { l: 16, r: 16, t: 22, b: 118 };
      let T = d3.zoomIdentity, hover = null;
      const draw = api => {
        const ctx = api.ctx, W = api.w, H = api.h;
        ctx.clearRect(0, 0, W, H);
        if (!rows.length) { ctx.font = '15px ' + getComputedStyle(document.body).fontFamily; ctx.fillStyle = C.ink2; ctx.textAlign = 'center'; ctx.fillText('Tick at least one kind of person above to draw the river.', W / 2, H / 2); return; }
        const x = T.rescaleX(d3.scaleLinear().domain([y0 - 5, y1 + 5]).range([m.l, W - m.r]));
        const yb = d3.scaleLinear().domain([0, rows.length]).range([m.t, H - m.b]);
        const y = T.rescaleY(yb);
        const lh = Math.abs(y(1) - y(0));
        // year grid
        ctx.font = '11px ' + getComputedStyle(document.body).fontFamily; ctx.fillStyle = C.ink3; ctx.strokeStyle = 'rgba(27,38,50,.055)'; ctx.lineWidth = 1.5; ctx.textAlign = 'center';
        const ticks = x.ticks(Math.max(4, Math.floor(W / 110)));
        ticks.forEach(t => { const px = x(t); ctx.beginPath(); ctx.moveTo(px, m.t - 6); ctx.lineTo(px, H - 22); ctx.stroke(); ctx.fillText(t, px, H - 8); });
        // history markers
        ctx.save(); ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(163,81,57,.45)'; ctx.fillStyle = C.red;
        history.forEach(h => { const px = x(h[0]); if (px < m.l || px > W - m.r) return; ctx.beginPath(); ctx.moveTo(px, m.t - 4); ctx.lineTo(px, H - m.b); ctx.stroke(); ctx.beginPath(); ctx.arc(px, m.t - 8, 3.2, 0, 6.3); ctx.fill(); });
        ctx.restore();
        // river
        ctx.save(); ctx.beginPath(); ctx.rect(0, m.t - 2, W, H - m.b - m.t + 4); ctx.clip();
        ctx.lineWidth = Math.max(0.55, Math.min(6, lh * 0.72));
        const byColor = d3.group(rows, r => r.c);
        for (const [col, rs] of byColor) {
          ctx.strokeStyle = col; ctx.globalAlpha = lh < 1 ? 0.75 : 0.9;
          ctx.beginPath();
          for (const r of rs) { const py = y(r.i + .5); if (py < m.t - 4 || py > H - m.b + 4) continue; ctx.moveTo(x(r.b), py); ctx.lineTo(x(r.known ? r.d : r.b + (r.d - r.b) * .6), py); }
          ctx.stroke();
          // unknown deaths fade out
          ctx.globalAlpha = 0.28; ctx.beginPath();
          for (const r of rs) { if (r.known) continue; const py = y(r.i + .5); if (py < m.t - 4 || py > H - m.b + 4) continue; ctx.moveTo(x(r.b + (r.d - r.b) * .6), py); ctx.lineTo(x(r.d), py); }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        if (lh > 11) {
          ctx.textAlign = 'left'; ctx.fillStyle = '#1B2632'; ctx.font = Math.min(12, lh * .8) + 'px ' + getComputedStyle(document.body).fontFamily;
          rows.forEach(r => { const py = y(r.i + .5); if (py < m.t || py > H - m.b) return; ctx.fillText(r.p.name, x(r.d) + 5, py + 3.5); });
        }
        if (hover) { const py = y(hover.i + .5); ctx.strokeStyle = '#1B2632'; ctx.lineWidth = Math.max(2.5, lh); ctx.beginPath(); ctx.moveTo(x(hover.b), py); ctx.lineTo(x(hover.d), py); ctx.stroke(); }
        ctx.restore();
        // alive curve (its own panel, same years)
        const top = H - m.b + 22, bot = H - 26;
        const ya = d3.scaleLinear().domain([0, peak]).range([bot, top]);
        ctx.save(); ctx.beginPath(); ctx.rect(m.l, top - 14, W - m.l - m.r, bot - top + 16); ctx.clip();
        ctx.beginPath(); alive.forEach((n, i) => { const px = x(y0 + i), py = ya(n); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
        ctx.strokeStyle = '#1B2632'; ctx.lineWidth = 2; ctx.stroke();
        ctx.lineTo(x(y1), bot); ctx.lineTo(x(y0), bot); ctx.closePath(); ctx.fillStyle = 'rgba(43,128,170,.12)'; ctx.fill();
        const px = x(peakYear);
        ctx.fillStyle = '#1B2632'; ctx.beginPath(); ctx.arc(px, ya(peak), 4, 0, 6.3); ctx.fill();
        ctx.restore();
        ctx.textAlign = px > W - 260 ? 'right' : 'left'; ctx.font = '12px ' + getComputedStyle(document.body).fontFamily; ctx.fillStyle = '#1B2632';
        if (px > m.l && px < W - m.r) ctx.fillText('Most alive at once: about ' + ui.fmt(peak) + ' in ' + peakYear, px + (px > W - 260 ? -9 : 9), top - 2);
        ctx.textAlign = 'left'; ctx.fillStyle = C.ink3; ctx.font = '11px ' + getComputedStyle(document.body).fontFamily;
        ctx.fillText('People in this file alive each year', m.l, top - 16 + 0);
        api._x = x; api._y = y;
      };
      const cv = ui.canvas(v.stage, draw);
      const zoom = d3.zoom().scaleExtent([1, 120]).on('zoom', e => { T = e.transform; cv.redraw(); });
      const sel = d3.select(cv.canvas).call(zoom).on('dblclick.zoom', null);
      const at = e => {
        const r = cv.canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        if (py > cv.h - m.b || py < m.t) return null;
        const i = Math.floor(cv._y.invert(py));
        const lh = Math.abs(cv._y(1) - cv._y(0)), reach = Math.max(1, Math.ceil(3 / lh));
        const yr = cv._x.invert(px);
        let best = null, bd = 1e9;
        for (let j = Math.max(0, i - reach); j <= Math.min(rows.length - 1, i + reach); j++) {
          const rr = rows[j];
          if (yr < rr.b - 1 || yr > rr.d + 1) continue;
          const d = Math.abs(j - i); if (d < bd) { bd = d; best = rr; }
        }
        return best;
      };
      cv.canvas.addEventListener('mousemove', e => {
        const rc0 = cv.canvas.getBoundingClientRect(), hx = e.clientX - rc0.left, hy = e.clientY - rc0.top;
        if (hy < m.t + 4) {
          const h = history.find(h => Math.abs(cv._x(h[0]) - hx) < 7);
          if (h) { ui.tip('<b>' + h[0] + '</b><span>' + ui.esc(h[1]) + '</span>', e.clientX, e.clientY); return; }
        }
        const r = at(e);
        if (r !== hover) { hover = r; cv.redraw(); }
        cv.canvas.style.cursor = r ? 'pointer' : 'grab';
        if (r) ui.tip(ui.personTip(r.p, (r.known ? 'Lived ' + (r.d - r.b) + ' years' : 'Death not recorded; line length is a guess') + ' · ' + FO.KIN_LABEL[kin.cls.get(r.p)]), e.clientX, e.clientY);
        else {
          const rc = cv.canvas.getBoundingClientRect(), py = e.clientY - rc.top;
          if (py > cv.h - m.b) { const yr = Math.round(cv._x.invert(e.clientX - rc.left)); if (yr >= y0 && yr <= y1) ui.tip('<b>' + yr + '</b><span>about ' + ui.fmt(alive[yr - y0]) + ' people alive</span>', e.clientX, e.clientY); else ui.untip(); }
          else ui.untip();
        }
      });
      cv.canvas.addEventListener('mouseleave', () => { hover = null; ui.untip(); cv.redraw(); });
      cv.canvas.addEventListener('click', e => { const r = at(e); if (r) FO.select(r.p); });
      const boxes = el('span', { class: 'ctl', style: { flexWrap: 'wrap' } }, el('span', { text: 'Show' }));
      KINDS.filter(k => kindCount.get(k)).forEach(k => {
        const c = ui.chip(FO.KIN_LABEL[k] + ' (' + ui.fmt(kindCount.get(k)) + ')', KIN_COLORS[k], show[k], on => {
          show[k] = on; hover = null;
          const only = KINDS.filter(q => show[q] && kindCount.get(q));
          s.scope = only.length === 1 && only[0] === 'ancestor' ? 'anc' : 'all';
          rebuild(); cv.redraw();
        });
        c.classList.add('box'); boxes.append(c);
      });
      v.controls.append(boxes);
      v.controls.append(
        el('span', { class: 'ctl' }, el('span', { text: 'Colour by' }), ui.seg([{ v: 'kin', label: 'Relationship' }, { v: 'surname', label: 'Surname' }, { v: 'place', label: 'Birthplace' }], colorBy, c => { colorBy = c; setColors(); cv.redraw(); })),
        el('span', { class: 'ctl-group' },
          ui.button('Reset zoom', () => sel.transition().duration(500).call(zoom.transform, d3.zoomIdentity)),
          ui.button('Save as SVG', () => FO.saveCanvasSVG(draw, cv, { title: 'River of Lifetimes', legend: legendBox, view: true }))));
      const hintText = () => 'Scroll to zoom in until names appear; drag to move. ' + ui.fmt(rows.length) + ' lives shown; faded ends mean the death year is unknown.' + (history.length ? ' Red dots along the top are moments of history; point at one to read it.' : '') ;
      hintEl = el('div', { class: 'hint', style: { bottom: '124px' }, text: hintText() });
      v.stage.append(hintEl);
      setColors(); cv.redraw();
      return () => cv.destroy();
    }
  });
})();
