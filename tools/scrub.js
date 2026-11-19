#!/usr/bin/env node
/* Build the site's default family file from a full GEDCOM export.
   Usage: node scrub.js "path/to/export.ged" ../site/data/family.ged.txt "Family title"
   The same cleaned copy can be made in the browser: load the file on the site, open "The family",
   and choose "Save a cleaned copy". */
const fs = require('fs');
const path = require('path');
const FO = require(path.join(__dirname, '../site/js/gedcom.js'));
const [src, dst, title] = process.argv.slice(2);
if (!src || !dst) { console.error('usage: node scrub.js <in.ged> <out> [title]'); process.exit(1); }
const data = FO.parseGedcom(fs.readFileSync(src, 'utf8'), { hideLiving: false });
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.writeFileSync(dst, FO.cleanCopy(data, title));
console.log(`${data.people.length} people, ${data.families.length} families, ${data.people.filter(p => p.living && p !== data.home).length} possibly-living people anonymised`);
console.log(`wrote ${dst} (${(fs.statSync(dst).size / 1024).toFixed(0)} KB)`);
