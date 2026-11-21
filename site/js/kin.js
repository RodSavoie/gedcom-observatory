/* Family Observatory: kinship calculations. */
(function (root) {
  'use strict';
  const FO = (root.FO = root.FO || {});
  const MAXG = 60;

  /* Ancestors by generation. Returns { min: Map(person -> nearest generation),
     gens: [Map(person -> number of pedigree slots in that generation)], paths: Map(person -> total slots) } */
  FO.ancestry = function (p, maxGen) {
    maxGen = Math.min(maxGen || MAXG, MAXG);
    const min = new Map(), paths = new Map(), gens = [];
    let frontier = new Map([[p, 1]]);
    for (let g = 0; g <= maxGen && frontier.size; g++) {
      gens.push(frontier);
      const next = new Map();
      for (const [q, c] of frontier) {
        if (!min.has(q)) min.set(q, g);
        paths.set(q, (paths.get(q) || 0) + c);
        if (q.father) next.set(q.father, (next.get(q.father) || 0) + c);
        if (q.mother) next.set(q.mother, (next.get(q.mother) || 0) + c);
      }
      frontier = next;
    }
    return { min, gens, paths };
  };

  FO.descent = function (p, maxGen) {
    maxGen = Math.min(maxGen || MAXG, MAXG);
    const min = new Map(), gens = [];
    let frontier = new Map([[p, 1]]);
    for (let g = 0; g <= maxGen && frontier.size; g++) {
      gens.push(frontier);
      const next = new Map();
      for (const [q, c] of frontier) {
        if (!min.has(q)) min.set(q, g);
        for (const ch of q.children) next.set(ch, (next.get(ch) || 0) + c);
      }
      frontier = next;
    }
    return { min, gens };
  };

  /* Lines of DNA inheritance, walking up from p. */
  FO.dna = function (p) {
    const y = new Set(), mt = new Set(), x = new Set();
    if (p.sex === 'M') for (let q = p, i = 0; q && i < MAXG; q = q.father, i++) y.add(q);
    for (let q = p, i = 0; q && i < MAXG; q = q.mother, i++) mt.add(q);
    const walk = (q, d) => {
      if (!q || d > MAXG || x.has(q)) return;
      x.add(q);
      walk(q.mother, d + 1);
      if (q.sex !== 'M') walk(q.father, d + 1);
    };
    walk(p, 0);
    return { y, mt, x };
  };

  /* Everyone's relation to the home person, coarse. */
  FO.kinClasses = function (data, home) {
    const cls = new Map();
    if (!home) return cls;
    const anc = FO.ancestry(home).min;
    const desc = FO.descent(home).min;
    const blood = new Set();
    const stack = [...anc.keys()];
    while (stack.length) {
      const q = stack.pop();
      if (blood.has(q)) continue;
      blood.add(q);
      for (const c of q.children) if (!blood.has(c)) stack.push(c);
    }
    for (const p of data.people) {
      let c = 'other';
      if (p === home) c = 'home';
      else if (anc.has(p)) c = 'ancestor';
      else if (desc.has(p)) c = 'descendant';
      else if (blood.has(p)) c = 'relative';
      else if (p.spouses.some(s => blood.has(s))) c = 'inlaw';
      cls.set(p, c);
    }
    return cls;
  };
  FO.KIN_LABEL = { home: 'Home person', ancestor: 'Direct ancestor', descendant: 'Descendant', relative: 'Blood relative', inlaw: 'Married to a relative', other: 'Not related by blood' };

  /* ---------- relationship naming ---------- */
  FO.ord = function (n) {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  const greats = (n, base) => n <= 0 ? base : n === 1 ? 'great-' + base : FO.ord(n) + ' great-' + base;
  const sx = (sex, m, f, u) => sex === 'M' ? m : sex === 'F' ? f : u;

  /* A is the <label> of B, where da/db are generations up to the common ancestor. */
  FO.relLabel = function (da, db, sex, half) {
    const h = half ? 'half-' : '';
    if (da === 0 && db === 0) return 'same person';
    if (da === 0) {
      if (db === 1) return sx(sex, 'father', 'mother', 'parent');
      return greats(db - 2, sx(sex, 'grandfather', 'grandmother', 'grandparent'));
    }
    if (db === 0) {
      if (da === 1) return sx(sex, 'son', 'daughter', 'child');
      return greats(da - 2, sx(sex, 'grandson', 'granddaughter', 'grandchild'));
    }
    if (da === 1 && db === 1) return h + sx(sex, 'brother', 'sister', 'sibling');
    if (da === 1) return h + (db === 2 ? '' : db === 3 ? 'great-' : FO.ord(db - 2) + ' great-') + sx(sex, 'uncle', 'aunt', 'uncle or aunt');
    if (db === 1) return h + (da === 2 ? '' : da === 3 ? 'great-' : FO.ord(da - 2) + ' great-') + sx(sex, 'nephew', 'niece', 'nephew or niece');
    const deg = Math.min(da, db) - 1, rem = Math.abs(da - db);
    return h + FO.ord(deg) + ' cousin' + (rem === 0 ? '' : rem === 1 ? ' once removed' : rem === 2 ? ' twice removed' : ' ' + rem + ' times removed');
  };

  function upMap(a) {
    const depth = new Map([[a, 0]]), prev = new Map();
    let frontier = [a];
    for (let g = 1; g <= MAXG && frontier.length; g++) {
      const next = [];
      for (const q of frontier) for (const par of [q.father, q.mother]) {
        if (par && !depth.has(par)) { depth.set(par, g); prev.set(par, q); next.push(par); }
      }
      frontier = next;
    }
    return { depth, prev };
  }
  function chain(m, from, to) { // from ancestor down to the start person
    const out = [from];
    let q = from, guard = 0;
    while (q !== to && guard++ < MAXG + 2) { q = m.prev.get(q); if (!q) break; out.push(q); }
    return out.reverse(); // start person ... ancestor
  }

  /* All distinct blood relationships between a and b, closest first. */
  FO.bloodRelations = function (a, b, limit) {
    if (a === b) return [];
    const A = upMap(a), B = upMap(b), out = [], seen = new Set();
    const LA = FO.ancestry(a).paths, LB = FO.ancestry(b).paths; // how many lines lead up to each ancestor
    for (const [c, da0] of A.depth) {
      if (!B.depth.has(c)) continue;
      let rel = null;
      if (c === a || c === b) {
        rel = { da: A.depth.get(c), db: B.depth.get(c), via: [c], half: false, pathA: chain(A, c, a), pathB: chain(B, c, b), direct: true, key: 'd', ways: c === a ? LB.get(a) || 1 : LA.get(b) || 1 };
      } else {
        // need two different children of c, one leading to a and the other to b
        let best = null, ways = 0;
        for (const x of c.children) {
          if (!A.depth.has(x)) continue;
          for (const y of c.children) {
            if (y === x || !B.depth.has(y)) continue;
            ways += (LA.get(x) || 1) * (LB.get(y) || 1);
            const s = A.depth.get(x) + B.depth.get(y);
            if (!best || s < best.s) best = { s, x, y };
          }
        }
        if (!best) continue;
        const full = best.x.famc && best.x.famc === best.y.famc && best.x.famc.husb && best.x.famc.wife;
        const via = full ? [best.x.famc.husb, best.x.famc.wife] : [c];
        rel = {
          da: A.depth.get(best.x) + 1, db: B.depth.get(best.y) + 1, via, half: !full,
          pathA: chain(A, best.x, a).concat([c]), pathB: chain(B, best.y, b).concat([c]),
          key: full ? 'f' + best.x.famc.id : 'h' + c.id, ways
        };
      }
      if (seen.has(rel.key)) continue;
      seen.add(rel.key);
      rel.label = FO.relLabel(rel.da, rel.db, a.sex, rel.half);
      out.push(rel);
    }
    out.sort((p, q) => (p.da + p.db) - (q.da + q.db) || Math.max(p.da, p.db) - Math.max(q.da, q.db));
    // a direct line makes every other shared ancestor redundant only if it lies on that line; keep all, but direct first
    return limit ? out.slice(0, limit) : out;
  };

  /* Every line of descent from an ancestor down to a descendant.
     Returns { total, byGen: Map(generations -> lines), paths: [[descendant ... ancestor]] (first `cap`) } */
  FO.linesOfDescent = function (anc, desc, cap) {
    const below = FO.descent(anc).min; // everyone descended from the ancestor
    const res = { total: 0, byGen: new Map(), paths: [] };
    if (anc === desc || !below.has(desc)) return res;
    const memo = new Map();
    const count = p => {
      if (p === anc) return new Map([[0, 1]]);
      if (memo.has(p)) return memo.get(p);
      const m = new Map(); memo.set(p, m);
      for (const par of [p.father, p.mother]) if (par && below.has(par)) for (const [g, c] of count(par)) m.set(g + 1, (m.get(g + 1) || 0) + c);
      return m;
    };
    res.byGen = new Map([...count(desc).entries()].sort((x, y) => x[0] - y[0]));
    res.total = [...res.byGen.values()].reduce((x, y) => x + y, 0);
    // list the shortest lines first
    const lim = cap || 60, stack = [];
    const maxLen = Math.max(...res.byGen.keys());
    for (let want = Math.min(...res.byGen.keys()); want <= maxLen && res.paths.length < lim; want++) {
      (function walk(p, depth) {
        if (res.paths.length >= lim) return;
        stack.push(p);
        if (p === anc) { if (depth === want) res.paths.push(stack.slice()); }
        else if (depth < want) for (const par of [p.father, p.mother]) if (par && below.has(par) && count(par).has(want - depth - 1)) walk(par, depth + 1);
        stack.pop();
      })(desc, 0);
    }
    return res;
  };

  /* Kinship coefficient of two people (the chance that a gene picked from each is the same by descent),
     following recorded parents. The inbreeding coefficient of a person is the kinship of their parents. */
  FO.kinship = function (data) {
    const N = data.people.length, memo = new Map(), height = new Map();
    const h = p => { if (!p) return -1; if (height.has(p)) return height.get(p); height.set(p, 0); const v = 1 + Math.max(h(p.father), h(p.mother)); height.set(p, v); return v; };
    const phi = (a, b) => {
      if (!a || !b) return 0;
      if (h(a) < h(b) || (h(a) === h(b) && a.i < b.i)) { const t = a; a = b; b = t; }
      const key = a.i * N + b.i;
      const got = memo.get(key);
      if (got !== undefined) return got;
      memo.set(key, 0); // guards against a loop in bad data
      const v = a === b ? 0.5 * (1 + phi(a.father, a.mother)) : 0.5 * (phi(a.father, b) + phi(a.mother, b));
      memo.set(key, v);
      return v;
    };
    return phi;
  };

  /* Blood first, then one marriage away. */
  FO.relate = function (a, b, limit) {
    const res = { blood: [], marriage: [] };
    if (a === b) return res;
    res.blood = FO.bloodRelations(a, b, limit || 12);
    if (a.spouses.includes(b)) res.marriage.push({ text: sx(a.sex, 'husband', 'wife', 'spouse'), direct: true });
    if (!res.blood.length && !res.marriage.length) {
      for (const s of a.spouses) {
        const r = FO.bloodRelations(s, b, 1)[0];
        if (r) res.marriage.push({ text: sx(a.sex, 'husband', 'wife', 'spouse') + ' of ' + s.name + ', who is the ' + r.label + ' of ' + b.name, through: s, rel: r, total: r.da + r.db });
      }
      for (const t of b.spouses) {
        const r = FO.bloodRelations(a, t, 1)[0];
        if (r) res.marriage.push({ text: r.label + ' of ' + t.name + ', the ' + sx(t.sex, 'husband', 'wife', 'spouse') + ' of ' + b.name, through: t, rel: r, total: r.da + r.db });
      }
      res.marriage.sort((p, q) => (p.total || 0) - (q.total || 0));
      res.marriage = res.marriage.slice(0, 4);
    }
    return res;
  };

  /* ---------- search ---------- */
  const strip = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  FO.norm = strip;
  /* One surname, however it is spelled: accents, capitals, spaces, apostrophes and hyphens are ignored,
     so Hébert / Hebert, LeBlanc / Le Blanc and D'Amours / D Amours count as one name. */
  FO.surnameKey = s => strip(s || '').replace(/[^a-z0-9]/g, '');
  /* For a list of people: a function giving each person's surname in its commonest spelling in that list. */
  FO.surnameCanon = function (people) {
    const raw = new Map();
    for (const p of people) if (p && p.surname && !p.hidden) raw.set(p.surname, (raw.get(p.surname) || 0) + 1);
    const canon = new Map(), best = new Map();
    for (const [name, n] of raw) { const k = FO.surnameKey(name); if (k && (!best.has(k) || n > best.get(k))) { best.set(k, n); canon.set(k, name); } }
    return p => (p && p.surname ? canon.get(FO.surnameKey(p.surname)) || p.surname : '');
  };
  FO.search = function (data, q, max) {
    const toks = strip(q).split(/\s+/).filter(Boolean);
    if (!toks.length) return [];
    const out = [];
    for (const p of data.people) {
      if (p.hidden) continue;
      if (!p.key) p.key = strip(p.name);
      let ok = true, score = 0;
      for (const t of toks) {
        const i = p.key.indexOf(t);
        if (i < 0) { ok = false; break; }
        score += i === 0 || p.key[i - 1] === ' ' ? 0 : 5;
      }
      if (ok) out.push([score + (p.key.startsWith(toks[0]) ? -3 : 0), p]);
    }
    out.sort((x, y) => x[0] - y[0] || (x[1].est || 9999) - (y[1].est || 9999));
    return out.slice(0, max || 12).map(x => x[1]);
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = FO;
})(typeof window !== 'undefined' ? window : globalThis);
