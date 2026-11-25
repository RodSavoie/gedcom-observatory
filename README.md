# Family Observatory

A website that draws a family tree fourteen different ways. Load any GEDCOM file (the
standard export from WikiTree, Ancestry, FamilySearch, Gramps and most genealogy programs) and
explore ancestors, descendants, places, lifetimes, repeated ancestors and the gaps worth
researching.

See it live at **[cognitiveoverload.com](https://cognitiveoverload.com/)**. It opens on the
Acadians and their spouses, about 27,000 people from the
[WikiTree Acadians Project](https://www.wikitree.com/wiki/Project:Acadians); the Acadians alone
and my own Savoie · Breau family can be opened from the menu.

- **Plain static files.** HTML, CSS and JavaScript, with no build step and no framework.
- **Private by design.** A file you load is read inside your own browser. Nothing is uploaded.
  Living people are hidden by default.
- **Works with any GEDCOM.** WikiTree files get profile links on every person; files from
  elsewhere work too, just without the links.
- **Several families built in.** The site can publish any number of cleaned family files and
  open on whichever one you choose.
- **Or straight from WikiTree.** Type a WikiTree ID under **From WikiTree** and the family is
  fetched live from the [WikiTree API](https://github.com/wikitree/wikitree-api), no export needed.

## The fourteen views

| Question | Views |
|---|---|
| Who are my ancestors? | Ancestor Fan, Hourglass, Ancestors Through Time, Descendants |
| How are we connected? | How Are We Related?, Pedigree Collapse, The Tangle |
| When and where? | Star Chart, River of Lifetimes, Where They Lived, Life Story |
| What does the whole tree look like? | By the Numbers |
| What needs work? | What's Missing, Things Worth Checking |

Every view has a "How to read this" guide. Where They Lived can be drawn as ribbons, a grid or a
map; the map finds places from lists that come with the site (old Acadian and French names
included) and puts births and deaths at sea on the water, along the crossing they belong to.

Seven designs can be switched at the top of the page: Ochre, Mineral, Sage, Slate, Aurora, Gilt
(charcoal and gold, with a torn-paper edge) and Harbour (a navy menu down the left side, on
linen). Harbour is the default. Each visitor's choices are remembered.

The whole site is in English and French: **FR | EN** at the right end of the same strip switches
it, and the choice is remembered. It opens in English. Names, places and dates from the family
files are shown as written; dates, relationships and the life stories are written in proper French
(né, née, cousin germain, le 12 mars 1750).

## Links

A link can open the site on a given family, design or view, and the parameters can be combined:

| Parameter | Does |
|---|---|
| `?family=savoie`, `acadians`, `acadians-plus` | opens one of the families on the site |
| `?design=ochre`, `mineral`, `sage`, `slate`, `aurora`, `gilt`, `harbour` | switches the design (and remembers it) |
| `?lang=fr`, `?lang=en` | opens the site in French or English (and remembers it) |
| `?wt=Savoie-2387&anc=10&desc=1&sib=0` | draws a family from WikiTree (see below) |
| `#/places?view=map&what=deaths&period=1750&layers=colours,borders&era=1763` | opens a view with its settings (`layers=` any of `colours`, `relief`, `grid`, `borders`, or `none`; `era=` an era's first year, or `auto`). Where They Lived, The Tangle (`surnames=`) and the Everyone / Direct ancestors switch (`show=`) write their settings back to the address as you change them, so it can be copied and shared |
| `#/about?families` | opens the About page at one of its sections |

## Try it on your computer

Browsers will not load the family file from a folder you simply double-click, so the site has
to be served. With [Python](https://www.python.org/) installed:

```
cd site
python -m http.server 8000
```

then open <http://localhost:8000>. (The Contact me form needs PHP; with PHP installed,
`php -S localhost:8000` runs it too.)

## Put it on your own website

Upload the **contents** of the `site` folder to any ordinary web host, at the root or in a
sub-folder such as `/family/`. All paths are relative, so either works.

The families on the site are in `site/data/`: `AcadiansPlus.GED.txt`, `Acadians.GED.txt` and
`family.ged.txt` (Savoie · Breau). They end in `.txt` because some web hosts refuse to serve
`.ged` files; each is an ordinary GEDCOM. They are listed in `FAMILIES` in `site/js/app.js`,
and `DEFAULT_FAMILY` just above it names the one the site opens on. Visitors always get the
newest copy of a file, so replacing one in `site/data/` is enough to update it.

### Put your own family on the site

Never publish a raw export: genealogy exports often contain living relatives, e-mail
addresses and private notes. Make a cleaned copy first, either way:

- **In the browser:** open the site, choose "Load your file", then in "The family" choose
  "Save a cleaned copy". Put the downloaded `family.ged.txt` in `site/data/`.
- **With Node.js:**
  ```
  cd tools
  node scrub.js "path/to/your-export.ged" ../site/data/family.ged.txt "My family"
  ```

The cleaned copy keeps names, sex, birth, death and marriage dates and places, profile links
and relationships. It drops biographies, notes, sources, images and e-mail addresses, and
turns anyone who may be living into an unnamed "Living person" with no dates or places.

Then add a line for it to `FAMILIES` in `site/js/app.js` (an `id` for links, the `file`, a
`label` for the menus and a `short` name for Harbour's side menu), and set `DEFAULT_FAMILY` to
its `id` if the site should open on it. The first person in the file is the home person.

### The map

The map in Where They Lived asks no map service: places are looked up in files under
`site/data/map/`, built once by `tools/build-map-data.js` from Natural Earth, GeoNames, Natural
Resources Canada's place names and the French communes list (sources and licences in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)). Acadian settlements, old French provinces,
historic regions such as French Louisiana, and the routes for deaths and births at sea are added
by hand in `site/js/geo.js`. If you rebuild the map files, raise `MAP_VERSION` at the top of
`geo.js` so browsers fetch the new ones.

The map wraps around east and west (`WRAP` at the top of `site/js/views/placesmap.js`), and its
**Layers** menu has four layers, each fetched only the first time it is needed:

| Layer | Files in `site/data/map/` | Built by |
|---|---|---|
| Colours (on for new visitors): a light blue sea, darker where it is deeper (200 m, then 1 to 6 km), land a shade darker than the page, and glaciers and ice shelves almost white | `layers.json` | `tools/build-map-layers.js`, from Natural Earth |
| Relief: soft shadows and light on mountains and the sea floor, as if lit from the north-west, drawn as shapes so they stay sharp at any zoom | `relief.json` | `tools/build-map-relief.py`, then `tools/build-map-relief.js`, from ETOPO1 |
| Latitude and longitude, every 5° | none: drawn by the page | |
| Old borders: North America in six eras, 1632–1713, 1713–1763, 1763–1783, 1784–1803, 1803–1867 and 1867–1949 | `history.json` | `tools/build-map-history.js` |

Each design has its own sea, deep-water, land, ice and relief-shadow colours (`sea`, `depth`, `land`, `ice` and `shade` in each palette
in `site/js/designs.js`). The old borders are drawn by hand from treaty lines and cut out of today's
provinces and states, so they follow the coast; they are approximate, and the page says so. Each
era's colonies, their names in English and French, their colours and where their names sit are
listed in `build-map-history.js`, so a border can be corrected there and the file rebuilt. The era
shown follows the Period setting (the 1700s show 1713–1763, the era of the Deportation) unless one
is picked in the menu. Which layers a new visitor sees, how strong the depth steps are, the grid's
spacing and the era for each period are the constants at the top of `placesmap.js`
(`LAYERS_DEFAULT`, `DEPTH_OPACITY`, `RELIEF_LAND_SHADOW`, `GRID_STEP`, `OLD_ERA_FOR` and so on).
Three places in France are always named, with a small dot: Belle-Île-en-Mer, Morlaix and
Châtellerault, where Acadians were settled after the Deportation (`ALWAYS_NAMED` there). If you rebuild a layer's
files, raise `LAYERS_VERSION` there.

### Drawing families from WikiTree

`site/js/wikitree.js` asks the WikiTree API for a person's ancestors (up to 20 generations), the
brothers and sisters of each ancestor with their husbands and wives, and descendants (up to 10), turns the answer into GEDCOM text and hands it to the normal loader, so
every view works unchanged. A link such as `index.html?wt=Savoie-2387&anc=10&desc=1` opens a
family directly; `&sib=0` leaves out brothers and sisters.

With brothers and sisters selected, the importer also fetches the direct ancestor line without
siblings and uses that answer for ancestor details and parent links. This prevents a private
placeholder in the larger response from hiding an ancestor whose public details are available
in the direct response. Both queries are anonymous; private relatives remain private.

WikiTree does not always answer browsers on other sites, so `site/wikitree.php` relays the same
questions from your web host (it needs PHP with curl). The relay answers only the site's own
pages, accepts only checked WikiTree IDs and generation counts, limits requests per visitor and
for the whole site, and stores nothing.

Following WikiTree's [App Policies](https://www.wikitree.com/wiki/Help:App_Policies), only what
WikiTree shows publicly is fetched, biographies and photos are never requested, and nothing is
cached or kept beyond the open page. If you run your own copy, change `APP_ID` in
`wikitree.js` and `appId` in `wikitree.php` to a name of your own.

### The Contact me form (optional)

`site/contact.php` sends the form by e-mail through your own mail server, using SMTP with
sign-in. It needs PHP on the host.

1. Copy `site/fo-contact-config.sample.php` and name the copy `fo-contact-config.php`.
2. Fill in your addresses, mail server and password.
3. Upload it to the hosting **home folder above the public web folder**, never inside it.
   `contact.php` looks for it there.

Without that file the form says it is not set up, and without PHP the page offers a plain
e-mail link instead. The form has spam protection (a hidden robot trap, a minimum time before
sending, a same-site check, a limit of 5 messages an hour per visitor, and header-injection
filtering). Nothing is stored.

### Publishing from GitHub (optional)

`.github/workflows/deploy.yml` copies the `site` folder to the web host over SSH whenever a
change inside `site/` reaches the `main` branch, and can be run by hand from the Actions tab. It
only adds or updates files, never deletes any, and never sends a filled-in
`fo-contact-config.php`. The server details and SSH key live in GitHub secrets; the comments at
the top of the file list them.

## Making it yours

| To change | Edit |
|---|---|
| Site name, menu, logo | `site/index.html`, `site/img/co-logo.svg` |
| About Me page | `site/js/aboutme.js` and `site/img/rod-savoie.jpg` |
| Contact me page and social links | `site/js/contact.js` |
| Layout and type | `site/css/style.css` |
| Families on the site, and the one it opens on | `FAMILIES` and `DEFAULT_FAMILY` in `site/js/app.js` |
| Designs, and the default one | `site/js/designs.js` (palettes, `DEFAULT_DESIGN`) and `site/css/designs.css` (textures, shadows, corners, Harbour's side menu, the header's hover wash) |
| Chart colours | `FO.C` and `FO.CAT` at the top of `site/js/app.js` |
| Settings of a view (fan, Tangle, map, …) | the capitalised constants at the top of each file in `site/js/views/` |
| Places that should count as one | the `alias(...)` lines in `site/js/gedcom.js` |
| Places the map should know, and how names are matched | `site/js/geo.js` |
| Historical events on timelines | `FO.HISTORY` in `site/js/charts.js` |
| French wording | `site/js/lang/fr.js` (see below); the About me and Contact me pages each hold their French text beside the English (`HTML_FR`) |
| Language the site opens in | `DEFAULT_LANG` in `site/js/i18n.js` |

### Translating

Every English string in the code goes through `T('…')`, which looks it up in `site/js/lang/fr.js`:
one line per string, `"English": "French"`, with the English exactly as the code writes it. Words in
braces, such as `{name}`, are filled in by the site and may move within the sentence. A translation
that changes with the person's sex is written `{ m: "…", f: "…" }`. After editing the file, raise
`DICT_VERSION` in `site/js/i18n.js` so browsers fetch the new copy. `node tools/check-french.js`
lists any string without a French translation (after a change to the English, say) and any French
entry no longer used. Relationship names in French (cousin germain, petite-nièce) are built in
`site/js/kin.js`, and the French life story in `site/js/views/story.js`.

## How the code is organised

```
site/
  index.html            the single page
  designs.html          forwards old links to index.html
  contact.php           sends the Contact me form
  wikitree.php          relays questions to the WikiTree API
  css/                  style.css (layout), designs.css (the seven designs)
  js/
    app.js              start-up, menus, home and About pages, families, remembered choices
    gedcom.js           reads GEDCOM files, merges place spellings
    kin.js              relationships, lines of descent, pedigree collapse
    charts.js           shared drawing helpers, SVG export, history events
    designs.js          the designs and the switcher
    i18n.js             the languages: T(), the FR | EN switch
    lang/fr.js          the French text
    geo.js              finds places for the map, including at sea
    wikitree.js         draws a family from WikiTree
    aboutme.js, contact.js, totop.js
    views/              one file per view (placesmap.js is the map in Where They Lived)
    vendor/             D3 and topojson-client
  data/                 the families on the site; map/ holds the map and place-name files
  fonts/                Roboto, and Oswald for the Gilt design
  img/                  logo, portrait, and designs/ (textures, torn edge, brush strokes)
tools/
  scrub.js              makes a cleaned, publishable copy of a GEDCOM
  build-map-data.js     builds site/data/map/ (sources in map-sources/)
  build-map-layers.js   builds the depth of the sea for the map's colours (layers.json)
  build-map-relief.py   with build-map-relief.js, builds the map's relief (relief.json)
  build-map-history.js  builds the map's old borders (history.json)
  test-wikitree.js      checks the WikiTree import: node tools/test-wikitree.js
  check-french.js       lists strings that lack a French translation
.github/workflows/deploy.yml   publishes site/ to the web host
```

## Credits

The idea and the list of views come from the
[Kinfolk Observatory](https://observatory.vibegenealogy.ai/). Family Observatory is a separate
implementation, written from scratch with its own code and design; none of the original's
code, sample families or images is included. Pedigree Collapse is an addition of its own. The
untangled pedigree in Ancestors Through Time owes a debt to B. F. Lyon's
[Exploring Family Trees](https://learnforeverlearn.com/ancestors/).

The families on the site are drawn from profiles on [WikiTree](https://www.wikitree.com/),
built by many volunteers, including the
[Acadians Project](https://www.wikitree.com/wiki/Project:Acadians).

Bundled: [D3](https://d3js.org/) and topojson-client (ISC licence), the Roboto and Oswald fonts
(SIL Open Font Licence), and map data from Natural Earth, GeoNames, Natural Resources Canada
and INSEE. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Licence

The code is released under the [MIT licence](LICENSE): use it, change it and share it freely,
keeping the copyright notice. My portrait, the Cognitive Overload logo and the text of my
About Me and Contact me pages are personal and are not covered; please replace them with your
own.

Created by Rod Savoie, with a keen interest in Acadian genealogy and the
[WikiTree Acadians Project](https://www.wikitree.com/wiki/Project:Acadians).
