/* Import regression checks with synthetic API responses. Run: node tools/test-wikitree.js */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const rootId = 1;
const publicPerson = (Id, FirstName, Father = 0, Mother = 0) => ({
  Id, Name: 'Example-' + Id, FirstName, LastNameAtBirth: 'Example',
  Father, Mother, IsLiving: 0, DeathDate: '1992-09-30'
});

async function importTree(reply, options = {}) {
  const requests = [];
  const FO = { state: {}, ui: { fmt: String, el: () => ({
    querySelector: () => ({}), classList: { toggle() {} }
  }) } };
  const context = {
    window: { FO }, document: { addEventListener() {}, body: { append() {} } },
    URLSearchParams, setTimeout,
    fetch: async (url, init) => {
      assert.equal(init.credentials, 'omit', 'API calls must remain anonymous');
      const q = Object.fromEntries(init.body);
      if (q.action === 'getProfile') return { ok: true, json: async () => [{ profile: { Id: rootId } }] };
      requests.push(q);
      return { ok: true, json: async () => [{
        resultByKey: { 'Example-1': { Id: rootId } },
        ...reply(q)
      }] };
    }
  };
  vm.createContext(context);
  for (const file of ['gedcom.js', 'wikitree.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../site/js', file), 'utf8'), context);
  }
  FO.loadText = text => { FO.state.data = FO.parseGedcom(text, { hideLiving: true }); return true; };
  await FO.loadWikiTree('Example-1', options.anc || 2, options.desc || 0, null, options.sib !== false);
  return { data: FO.state.data, requests };
}

const response = list => ({ people: Object.fromEntries(list.map(p => [p.Id, p])) });
const person = (data, id) => data.people.find(p => p.id === '@I' + id + '@');

function family() {
  const grandparents = [4, 5, 6, 7].map(id => publicPerson(id, 'Ancestor' + id));
  const root = { Id: rootId, Name: 'Example-1', FirstName: 'Home', IsLiving: 1 };
  return {
    direct: [
      { ...root, Father: 2, Mother: -1 }, publicPerson(2, 'Public parent', 4, 5),
      { Id: -1, Father: 6, Mother: 7 }, ...grandparents
    ],
    siblings: [
      { ...root, Father: -1, Mother: -2 },
      { Id: -1, Father: 4, Mother: 5 }, { Id: -2, Father: 6, Mother: 7 },
      ...grandparents,
      { ...publicPerson(8, 'Uncle', 4, 5), Spouses: { 9: publicPerson(9, 'Partner') } },
      { Id: -3, Father: -1, Mother: -2 }
    ]
  };
}

test('siblings preserve a public parent even when the response contains a complete private placeholder', async () => {
  const f = family();
  const { data, requests } = await importTree(q => response(q.siblings ? f.siblings : f.direct));
  const home = person(data, 1), father = person(data, 2);
  assert.ok(father, 'public father must be recovered from the direct ancestor response');
  assert.equal(home.father.id, father.id);
  assert.equal(father.name, 'Public parent Example');
  assert.equal(father.hidden, false);
  assert.equal(father.flagPrivate, false);
  assert.equal(father.d.date.text, '30 Sep 1992');
  assert.equal(home.mother.flagPrivate, true, 'genuinely private mother stays private');
  assert.equal(home.mother.name, 'Private');
  assert.equal(home.mother.father.id, person(data, 6).id, 'private IDs from separate calls must align by relationship');
  assert.ok(person(data, 8), 'uncle from the siblings response is kept');
  assert.ok(person(data, 9), 'uncle\'s partner is kept');
  const brother = data.people.find(p => p !== home && p.father === father && p.mother === home.mother);
  assert.ok(brother, 'private sibling is kept and linked to the recovered parent');
  assert.equal(brother.flagPrivate, true);
  assert.equal(requests.length, 2);
});

test('ancestor-only imports do not make an unnecessary verification request', async () => {
  const { direct } = family();
  const { data, requests } = await importTree(() => response(direct), { sib: false });
  assert.equal(person(data, 2).hidden, false);
  assert.equal(requests.length, 1);
});

test('verification follows the entire requested ancestor depth', async () => {
  const direct = Array.from({ length: 10 }, (_, i) => publicPerson(i + 1, 'Ancestor' + (i + 1), i < 9 ? i + 2 : 0));
  const siblings = direct.map(p => ({ ...p, Id: p.Id === 8 ? -1 : p.Id, Father: p.Father === 8 ? -1 : p.Father }));
  siblings.find(p => p.Id === -1).FirstName = '';
  const { data, requests } = await importTree(q => response(q.siblings ? siblings : direct), { anc: 9 });
  assert.equal(person(data, 7).father.id, '@I8@');
  assert.equal(person(data, 8).flagPrivate, false);
  assert.ok(requests.some(q => !q.siblings && +q.ancestors === 9));
});

test('direct ancestor pagination has its own seen set', async () => {
  const profiles = Array.from({ length: 1001 }, (_, i) => publicPerson(i + 1, 'Ancestor' + (i + 1)));
  profiles[0].Father = 2;
  // Both queries return the same people: sharing the seen set would end the direct query after page one.
  const { data, requests } = await importTree(q => response(profiles.slice(+q.start, +q.start + 1000)));
  assert.ok(person(data, 1001), 'last profile must be kept');
  assert.equal(requests.filter(q => !q.siblings).length, 2);
});

test('missing private ancestors still get filled by the small ancestor-only query', async () => {
  const root = { Id: 1, Name: 'Example-1', Father: -1 };
  const grandparent = publicPerson(4, 'Grandparent');
  const { data, requests } = await importTree(q => response(+q.ancestors > 6
    ? [root, grandparent] : [root, { Id: -1, Father: 4 }, grandparent]), { anc: 12, sib: false });
  assert.equal(data.home.father.flagPrivate, true);
  assert.equal(data.home.father.father.id, '@I4@');
  assert.equal(requests.length, 2);
});

test('descendants stay linked to the original root after ancestor reconciliation', async () => {
  const f = family();
  const { data } = await importTree(q => response(+q.descendants
    ? [{ Id: -1 }, { ...publicPerson(10, 'Child'), Father: -1 }]
    : q.siblings ? f.siblings : f.direct), { desc: 1 });
  assert.equal(data.home.father.id, '@I2@');
  assert.equal(person(data, 10).father.id, data.home.id);
});

test('stand-in numbers that change between pages do not move an aunt into the home person\'s family', async () => {
  // Seen on 2026-11-22 with Savoie-2387: the siblings answer ran over several pages, and on the last page a mother's
  // sisters pointed at -1 and -2, the numbers the first page used for the home person's own parents.
  const grandparents = [4, 5, 6, 7].map(id => publicPerson(id, 'Ancestor' + id));
  const firstPage = [
    { Id: rootId, Name: 'Example-1', FirstName: 'Home', IsLiving: 1, Father: -1, Mother: -2 },
    { Id: -1, Father: 4, Mother: 5 }, { Id: -2, Father: 6, Mother: 7 }, ...grandparents];
  const lastPage = [{ Id: 20, Name: 'Example-20', FirstName: '', Father: -1, Mother: -2 }];   // really a child of 6 and 7
  const { data, requests } = await importTree(q => {
    if (String(q.keys).split(',').includes('20')) return response([{ Id: 20, Father: 6, Mother: 7 }]);
    if (!q.siblings) return response([{ Id: rootId, Name: 'Example-1', FirstName: 'Home', IsLiving: 1, Father: -1, Mother: -2 },
      { Id: -1, Father: 4, Mother: 5 }, { Id: -2, Father: 6, Mother: 7 }, ...grandparents]);
    return +q.start === 0 ? { ...response(firstPage), status: 'Maximum number of profiles (1025) reached.' } : response(lastPage);
  });
  const aunt = person(data, 20);
  assert.ok(aunt, 'the aunt is kept');
  assert.equal(aunt.father && aunt.father.id, '@I6@', 'the aunt\'s father is her real father, not the home person\'s');
  assert.equal(aunt.mother && aunt.mother.id, '@I7@');
  assert.ok(!data.home.father.children.includes(aunt), 'she is not filed as the home person\'s sister');
  assert.ok(requests.some(q => String(q.keys).split(',').includes('20') && +q.ancestors === 0), 'her parents were asked about again, by number');
});
