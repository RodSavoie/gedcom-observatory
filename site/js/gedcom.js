/* Family Observatory: GEDCOM reader and family model.
   Runs in the browser and in Node (used by tools/scrub.js). */
(function (root) {
  'use strict';
  const FO = (root.FO = root.FO || {});

  FO.LIVING_YEARS = 110;
  const MONTHS = {
    JAN: 1, FEB: 2, FEV: 2, MAR: 3, APR: 4, AVR: 4, MAY: 5, MAI: 5, JUN: 6, JUL: 7,
    AUG: 8, AOU: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
  };
  const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const QUAL = { ABT: 'about', ABOUT: 'about', CAL: 'about', EST: 'about', CIRCA: 'about', C: 'about', BEF: 'before', AFT: 'after', BET: 'between', FROM: 'from' };

  const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

  /* "ABT 12 Jan 1650" -> {raw, y, m, d, q, text} */
  FO.parseDate = function (raw) {
    if (!raw) return null;
    raw = raw.trim();
    if (!raw) return null;
    const toks = strip(raw).toUpperCase().replace(/[.,]/g, ' ').split(/\s+/);
    let q = null, y = null, m = null, d = null;
    for (const t of toks) {
      if (QUAL[t] && !q && y == null) { q = QUAL[t]; continue; }
      if (/^\d{3,4}(\/\d{1,2})?$/.test(t)) { if (y == null) y = parseInt(t, 10); else break; continue; }
      if (/^\d{1,2}$/.test(t) && y == null) { d = parseInt(t, 10); continue; }
      const mm = MONTHS[t.slice(0, 3)];
      if (mm && y == null) { m = mm; continue; }
      if ((t === 'AND' || t === 'TO') && y != null) break;
    }
    if (y == null) return { raw, y: null, m: null, d: null, q, text: raw };
    let text = (d && m ? d + ' ' : '') + (m ? MONTH_NAMES[m] + ' ' : '') + y;
    if (q === 'about') text = 'about ' + text;
    else if (q === 'before') text = 'before ' + text;
    else if (q === 'after') text = 'after ' + text;
    else if (q === 'between' || q === 'from') text = raw.toLowerCase().replace(/\b([a-z]{3})\b/g, s => MONTHS[s.toUpperCase()] ? MONTH_NAMES[MONTHS[s.toUpperCase()]] : s);
    return { raw, y, m, d, q, text };
  };

  /* ---------- places ---------- */
  const WRAP = new Set(['canada', 'usa', 'united states', 'united states of america', 'etats-unis', 'u.s.a.', 'us']);
  const ALIAS = {};
  const alias = (canon, list) => list.forEach(k => (ALIAS[k] = canon));
  alias('Nouvelle-France', ['nouvelle-france', 'nouvelle france', 'new france', 'canada nouvelle-france', 'canada, nouvelle-france', 'canada (nouvelle-france)']);
  alias('Acadie', ['acadie', 'acadia', 'acadie nouvelle-france', "l'acadie"]);
  alias('Nova Scotia', ['nova scotia', 'colony of nova scotia', 'nova scotia colony', 'nouvelle-ecosse', 'province of nova scotia', 'nova scotia (canada)']);
  alias('New Brunswick', ['new brunswick', 'colony of new brunswick', 'new brunswick colony', 'nouveau-brunswick', 'colony of nouveau-brunswick', 'colonie du nouveau-brunswick', 'nouveau brunswick', 'nb', 'n.b.', 'new brunswick (canada)', 'province of new brunswick']);
  alias('Québec', ['quebec', 'qc', 'province de quebec', 'province of quebec', 'quebec province', 'bas-canada', 'lower canada', 'canada east', 'canada-est', 'canada est', 'quebec (canada)']);
  alias('Prince Edward Island', ['prince edward island', 'ile saint-jean', 'ile-saint-jean', 'isle saint-jean', "st. john's island", 'ile-du-prince-edouard']);
  alias('Cape Breton', ['ile royale', 'ile-royale', 'cape breton', 'cape breton island']);
  alias('Ontario', ['ontario', 'upper canada', 'canada west', 'haut-canada']);
  alias('England', ['england', 'angleterre', 'kingdom of england']);
  alias('Scotland', ['scotland', 'ecosse']);
  alias('Ireland', ['ireland', 'irlande']);
  alias('Spain', ['spain', 'espagne', 'espana']);
  alias('Germany', ['germany', 'allemagne', 'deutschland']);
  alias('Switzerland', ['switzerland', 'suisse']);
  alias('France', ['france', 'kingdom of france', 'royaume de france']);
  alias('British North America', ['british north america', 'amerique du nord britannique', 'amerique coloniale britannique', 'british colonial america', 'north america']);
  alias('Massachusetts', ['massachusetts', 'massachusetts colony', 'massachusetts bay colony', 'province of massachusetts bay']);
  alias('Louisiana', ['louisiana', 'louisiane', 'spanish louisiana', 'louisiane espagnole']);

  /* Spellings of one place that differ only by hyphens, accents, capitals, apostrophes or St/Saint are
     treated as the same place and shown in whichever spelling the file uses most. */
  const placeKey = s => strip(s).toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[-‐‑–’'`.]/g, ' ').replace(/\bisle\b/g, 'ile').replace(/\bste\b/g, 'sainte').replace(/\bst\b/g, 'saint').replace(/\s+/g, ' ').trim();
  FO.placeKey = placeKey;
  let canon = new Map();
  const ALIASN = {};
  Object.keys(ALIAS).forEach(k => { ALIASN[placeKey(k)] = ALIAS[k]; });
  const spell = part => canon.get(placeKey(part)) || part;
  const regionCache = new Map();
  FO.buildPlaceSpellings = function (places) {
    const tally = new Map();
    for (const pl of places) for (const part of pl.split(',')) {
      const t = part.trim(); if (!t) continue;
      const k = placeKey(t);
      if (!tally.has(k)) tally.set(k, new Map());
      const m = tally.get(k); m.set(t, (m.get(t) || 0) + 1);
    }
    canon = new Map(); let merged = 0;
    for (const [k, m] of tally) {
      if (m.size > 1) merged += m.size - 1;
      canon.set(k, [...m.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0]);
    }
    regionCache.clear();
    return merged;
  };
  FO.region = function (place) {
    if (!place) return null;
    if (regionCache.has(place)) return regionCache.get(place);
    const parts = place.split(',').map(s => s.trim()).filter(Boolean);
    let out = null;
    if (parts.length) {
      const key = s => strip(s).toLowerCase().replace(/\s+/g, ' ');
      let idx = parts.length - 1;
      if (WRAP.has(key(parts[idx])) && idx > 0) idx--;
      const k = key(parts[idx]);
      out = ALIAS[k] || ALIASN[placeKey(parts[idx])] || spell(parts[idx]);
      if (out === 'Nouvelle-France' || out === 'Nova Scotia' || out === 'France') {
        // Acadian settlements are often written "…, Acadie, Nouvelle-France"
        if (parts.some(p => (ALIAS[key(p)] || ALIASN[placeKey(p)]) === 'Acadie')) out = 'Acadie';
      }
      if (out.length > 34) out = out.slice(0, 32) + '…';
    }
    regionCache.set(place, out);
    return out;
  };

  /* one level below the region: a county, parish or town, written with its region */
  FO.locality = function (place) {
    if (!place) return null;
    const parts = place.split(',').map(s => s.trim()).filter(Boolean);
    const r = FO.region(place);
    if (!r || parts.length < 2) return r;
    const key = s => strip(s).toLowerCase().replace(/\s+/g, ' ');
    let idx = parts.findIndex(p => (ALIAS[key(p)] || ALIASN[placeKey(p)] || spell(p)) === r);
    if (idx < 0) idx = parts.length - 1;
    return idx > 0 ? spell(parts[idx - 1]) + ', ' + r : r;
  };

  FO.shortPlace = function (place) {
    if (!place) return '';
    const parts = place.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length <= 2) return parts.join(', ');
    const r = FO.region(place);
    return parts[0] + (r && r !== parts[0] ? ', ' + r : '');
  };

  /* ---------- text decoding (browser) ---------- */
  FO.decodeBuffer = function (buf) {
    const u8 = new Uint8Array(buf);
    if (u8[0] === 0xff && u8[1] === 0xfe) return new TextDecoder('utf-16le').decode(u8);
    if (u8[0] === 0xfe && u8[1] === 0xff) return new TextDecoder('utf-16be').decode(u8);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); }
    catch (e) { return new TextDecoder('windows-1252').decode(u8); }
  };

  /* ---------- parser ---------- */
  FO.parseGedcom = function (text, opts) {
    opts = opts || {};
    const hideLiving = opts.hideLiving !== false;
    const nowYear = opts.nowYear || new Date().getFullYear();
    const people = [], families = [], byId = new Map(), famById = new Map();
    const head = {};
    let cur = null, kind = null, ev = null, l1 = null;

    const lineRe = /^\s*(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?: (.*))?$/;
    let pos = 0;
    const n = text.length;
    if (text.charCodeAt(0) === 0xfeff) pos = 1;
    while (pos < n) {
      let end = text.indexOf('\n', pos);
      if (end < 0) end = n;
      let line = text.slice(pos, end);
      pos = end + 1;
      if (line.charCodeAt(line.length - 1) === 13) line = line.slice(0, -1);
      if (!line) continue;
      const c0 = line.charCodeAt(0);
      // fast skip of the very common long continuation lines
      if (c0 >= 50 && c0 <= 57 && line.charCodeAt(1) === 32 && line.charCodeAt(2) === 67 && line.charCodeAt(3) === 79) continue;
      const m = lineRe.exec(line);
      if (!m) continue;
      const lvl = +m[1], xid = m[2], tag = m[3].toUpperCase(), val = m[4] || '';
      if (lvl === 0) {
        cur = null; kind = null; ev = null;
        if (tag === 'INDI' && xid) {
          cur = { id: xid, i: people.length, given: '', surname: '', name: '', sex: 'U', b: null, d: null, dead: false, famc: null, fams: [], url: null, flagLiving: false, flagNotLiving: false, flagPrivate: false, flagHome: false, _fc: null, _fs: [] };
          people.push(cur); byId.set(xid, cur); kind = 'I';
        } else if (tag === 'FAM' && xid) {
          cur = { id: xid, i: families.length, husb: null, wife: null, children: [], m: null, _h: null, _w: null, _c: [] };
          families.push(cur); famById.set(xid, cur); kind = 'F';
        } else if (tag === 'HEAD') { kind = 'H'; cur = head; }
        continue;
      }
      if (!cur) continue;
      if (lvl === 1) {
        ev = null; l1 = tag;
        if (kind === 'I') {
          switch (tag) {
            case 'NAME':
              if (!cur._name) {
                cur._name = val;
                const mm = /^([^/]*)\/([^/]*)\/?(.*)$/.exec(val);
                if (mm) { cur.given = mm[1].replace(/\s+/g, ' ').trim(); cur.surname = mm[2].trim(); }
                else cur.given = val.trim();
              }
              break;
            case 'SEX': cur.sex = val.trim().charAt(0).toUpperCase() === 'M' ? 'M' : val.trim().charAt(0).toUpperCase() === 'F' ? 'F' : 'U'; break;
            case 'BIRT': case 'CHR': case 'BAPM':
              if (tag === 'BIRT' || !cur.b) { ev = cur.b || (cur.b = { date: null, place: null }); if (tag !== 'BIRT') ev.bapt = true; }
              break;
            case 'DEAT': case 'BURI': case 'CREM':
              cur.dead = true;
              if (tag === 'DEAT' || !cur.d) ev = cur.d || (cur.d = { date: null, place: null });
              break;
            case 'FAMC': if (!cur._fc) cur._fc = val.trim(); break;
            case 'FAMS': cur._fs.push(val.trim()); break;
            case 'WWW': case 'URL': case '_URL': if (!cur.url && /^https?:/i.test(val.trim())) cur.url = val.trim(); break;
            case '_FSFTID': case 'FSID': case '_FSID': if (!cur.url && /^[A-Z0-9]{4}-[A-Z0-9]{2,4}$/i.test(val.trim())) cur.url = 'https://www.familysearch.org/tree/person/details/' + val.trim().toUpperCase(); break;
            case '_LIVING': cur.flagLiving = /^y/i.test(val.trim()); cur.flagNotLiving = /^n/i.test(val.trim()); break;
            case '_HOME': cur.flagHome = /^y/i.test(val.trim()); break;
            case '_PRIVATE': cur.flagPrivate = /^y/i.test(val.trim()); break;   // a profile its source keeps private (WikiTree stand-ins)
          }
        } else if (kind === 'F') {
          switch (tag) {
            case 'HUSB': cur._h = val.trim(); break;
            case 'WIFE': cur._w = val.trim(); break;
            case 'CHIL': cur._c.push(val.trim()); break;
            case 'MARR': ev = cur.m || (cur.m = { date: null, place: null }); break;
          }
        } else if (kind === 'H') {
          if (tag === 'SOUR') head.source = val.trim();
          if (tag === '_TITLE') head.title = val.trim();
        }
      } else if (lvl === 2 && ev) {
        if (tag === 'DATE' && !ev.date) ev.date = FO.parseDate(val);
        else if (tag === 'PLAC' && !ev.place) ev.place = val.trim() || null;
      } else if (lvl === 2 && kind === 'I' && l1 === 'NAME') {
        if (tag === 'GIVN' && val.trim() && !cur.given) cur.given = val.trim();
        else if (tag === 'SURN' && val.trim() && !cur.surname) cur.surname = val.trim();
      }
    }

    // one spelling per place
    const allPlaces = [];
    for (const p of people) { if (p.b && p.b.place) allPlaces.push(p.b.place); if (p.d && p.d.place) allPlaces.push(p.d.place); }
    for (const f of families) if (f.m && f.m.place) allPlaces.push(f.m.place);
    const mergedSpellings = FO.buildPlaceSpellings(allPlaces);

    // link up
    for (const f of families) {
      f.husb = byId.get(f._h) || null; f.wife = byId.get(f._w) || null;
      f.children = f._c.map(id => byId.get(id)).filter(Boolean);
      delete f._h; delete f._w; delete f._c;
    }
    for (const p of people) {
      p.famc = p._fc ? famById.get(p._fc) || null : null;
      p.fams = p._fs.map(id => famById.get(id)).filter(Boolean);
      p.father = p.famc ? p.famc.husb : null;
      p.mother = p.famc ? p.famc.wife : null;
      p.children = []; p.spouses = [];
      delete p._fc; delete p._fs;
      if (/^(unknown|anonymous|\?+)$/i.test(p.surname)) p.surname = '';
    }
    for (const p of people) {
      for (const f of p.fams) {
        const sp = f.husb === p ? f.wife : f.husb;
        if (sp && sp !== p && !p.spouses.includes(sp)) p.spouses.push(sp);
        for (const c of f.children) if (!p.children.includes(c)) p.children.push(c);
      }
    }

    // estimated birth years (for layout and living detection)
    for (const p of people) {
      p.by = p.b && p.b.date ? p.b.date.y : null;
      p.dy = p.d && p.d.date ? p.d.date.y : null;
      p.est = p.by != null ? p.by : (p.dy != null ? p.dy - 60 : null);
      p.estKnown = p.by != null;
    }
    for (let pass = 0; pass < 12; pass++) {
      let changed = 0;
      for (const p of people) {
        if (p.est != null) continue;
        let e = null;
        const sp = p.spouses.find(s => s.est != null);
        if (sp) e = sp.est + (p.sex === 'F' ? 3 : -3);
        if (e == null) { const c = p.children.filter(c => c.est != null); if (c.length) e = Math.min(...c.map(c => c.est)) - (p.sex === 'F' ? 24 : 28); }
        if (e == null) { if (p.father && p.father.est != null) e = p.father.est + 32; else if (p.mother && p.mother.est != null) e = p.mother.est + 28; }
        if (e == null && p.famc) { const s = p.famc.children.find(c => c.est != null); if (s) e = s.est; }
        if (e != null) { p.est = Math.round(e); changed++; }
      }
      if (!changed) break;
    }

    // home person
    let home = people.find(p => p.flagHome) || people[0] || null;

    // living people
    /* A death counts only when it carries a date or a place: some programs write a bare death line for
       everyone they were not told is living. Otherwise a person is treated as living unless they were born
       (or can be estimated to have been born) more than LIVING_YEARS ago. When in doubt, living wins. */
    const cutoff = nowYear - FO.LIVING_YEARS;
    let livingCount = 0;
    for (const p of people) {
      const proof = p.dead && p.d && (p.d.date || p.d.place);
      const standIn = /^(living|private|vivant|vivante)$/i.test(p.given) || /^(living|private)$/i.test(p.surname);
      p.living = p.flagLiving || (!p.flagNotLiving && ((!proof && (p.est == null || p.est > cutoff)) || (standIn && !proof && !(p.est != null && p.est <= cutoff))));
      if (p.living) livingCount++;
    }
    for (const p of people) {
      p.hidden = false;
      if (p.living && hideLiving) {
        if (p === home) {
          // the home person keeps a name and a birth year, nothing else
          if (p.b) p.b = { date: p.b.date && p.b.date.y ? { raw: '' + p.b.date.y, y: p.b.date.y, m: null, d: null, q: null, text: '' + p.b.date.y } : null, place: null };
        } else {
          p.hidden = true; p.given = p.flagPrivate ? 'Private' : 'Living'; p.surname = ''; p.b = null; p.d = null; p.by = null; p.dy = null; p.url = null;
        }
      }
      p.name = p.flagPrivate ? 'Private' : p.hidden ? 'Living person' : ((p.given + ' ' + p.surname).trim() || 'Unknown');
    }
    for (const f of families) {
      if ((f.husb && f.husb.hidden) || (f.wife && f.wife.hidden)) f.m = null;
      f.my = f.m && f.m.date ? f.m.date.y : null;
    }

    return { mergedSpellings, people, families, byId, famById, home, head, livingCount, hideLiving };
  };

  /* A copy of the family that is safe to pass on: people who have died keep names, sex, birth, death,
     marriages and family links; anyone who may be living is an unnamed placeholder; everything else is left out. */
  FO.cleanCopy = function (data, title) {
    const out = ['0 HEAD', '1 SOUR FamilyObservatory', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8'];
    if (title) out.push('1 _TITLE ' + title);
    const ev = (tag, e) => { out.push('1 ' + tag); if (e && e.date && e.date.raw) out.push('2 DATE ' + e.date.raw); if (e && e.place) out.push('2 PLAC ' + e.place); };
    for (const p of data.people) {
      out.push('0 ' + p.id + ' INDI');
      if (p.living && p !== data.home) out.push('1 NAME Living //', '1 SEX ' + p.sex, '1 _LIVING Y');
      else {
        out.push('1 NAME ' + p.given + ' /' + p.surname + '/', '1 SEX ' + p.sex);
        if (p === data.home) out.push('1 _HOME Y');
        if (p.living) { out.push('1 _LIVING Y'); if (p.by) out.push('1 BIRT', '2 DATE ' + p.by); }
        else { if (p.b) ev('BIRT', p.b); if (p.dead) ev('DEAT', p.d); }
        if (p.url) out.push('1 WWW ' + p.url);
      }
      if (p.famc) out.push('1 FAMC ' + p.famc.id);
      for (const f of p.fams) out.push('1 FAMS ' + f.id);
    }
    for (const f of data.families) {
      out.push('0 ' + f.id + ' FAM');
      if (f.husb) out.push('1 HUSB ' + f.husb.id);
      if (f.wife) out.push('1 WIFE ' + f.wife.id);
      for (const c of f.children) out.push('1 CHIL ' + c.id);
      if (f.m && !((f.husb && f.husb.living) || (f.wife && f.wife.living))) ev('MARR', f.m);
    }
    out.push('0 TRLR', '');
    return out.join('\n');
  };

  FO.lifespan = function (p) {
    if (p.hidden) return '';
    const b = p.by != null ? (p.b.date.q ? 'c. ' : '') + p.by : '', d = p.dy != null ? (p.d.date.q ? 'c. ' : '') + p.dy : '';
    if (!b && !d) return '';
    return (b || '?') + ' - ' + (d || (p.dead ? '?' : ''));
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FO;
})(typeof window !== 'undefined' ? window : globalThis);
