#!/usr/bin/env node
/* Lists what the French dictionary (site/js/lang/fr.js) is missing, and what it holds that the site no longer uses.
     node tools/check-french.js            missing and unused, with the file each string comes from
     node tools/check-french.js --json     every English string as JSON (for translating in bulk)
   The English strings are the first argument of every T('...') in site/js, and the words written in site/index.html. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SITE = path.join(__dirname, '..', 'site');

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const f = path.join(dir, d.name);
    if (d.isDirectory()) return /vendor|lang/.test(d.name) ? [] : files(f);
    return d.name.endsWith('.js') ? [f] : [];
  });
}

// every T('...') with a plain string first: '...', "..." or `...` without ${}
const found = new Map();   // English -> [files]
const note = (s, f) => { if (!found.has(s)) found.set(s, []); if (!found.get(s).includes(f)) found.get(s).push(f); };
const LIT = /\b(?:T|parts|Q)\(\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\$]|\\.)*`)/g;
for (const f of files(path.join(SITE, 'js'))) {
  const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ''), rel = path.relative(SITE, f);   // comments left out
  for (const m of src.matchAll(LIT)) note(vm.runInNewContext(m[1]), rel);   // T(), ui.parts() and the checks view's Q() all take a template first
}
// the words in index.html (they are translated by their exact text when the page starts)
const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>|<style[\s\S]*?<\/style>/g, '');
for (const m of html.matchAll(/>([^<>]+)</g)) { const t = m[1].replace(/\s+/g, ' ').trim(); if (/[A-Za-z]{2}/.test(t)) note(t, 'index.html'); }
for (const m of html.matchAll(/\b(?:title|aria-label|placeholder|alt|content)="([^"]+)"/g)) if (/[A-Za-z]{2} /.test(m[1]) || /^[A-Z][a-z]+$/.test(m[1])) note(m[1], 'index.html');

if (process.argv.includes('--json')) process.stdout.write(JSON.stringify([...found].map(([s, f]) => ({ s, files: f })), null, 1) + '\n');   // (no process.exit: it would cut a long answer short)
else report();

function report() {

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(SITE, 'js', 'lang', 'fr.js'), 'utf8'), ctx);
const dict = (ctx.window.FO && ctx.window.FO.DICT) || {};
// strings that read the same in both languages (names, brands) are listed in fr.js with the same text
const missing = [...found].filter(([s]) => !(s in dict));
const unused = Object.keys(dict).filter(s => !found.has(s));
console.log(`${found.size} strings in the site, ${Object.keys(dict).length} in fr.js`);
console.log(`\n${missing.length} without a French translation:`);
for (const [s, fs_] of missing) console.log(`  ${fs_.join(', ')}: ${JSON.stringify(s)}`);
console.log(`\n${unused.length} in fr.js but no longer used:`);
for (const s of unused) console.log(`  ${JSON.stringify(s)}`);
process.exitCode = missing.length ? 1 : 0;
}
