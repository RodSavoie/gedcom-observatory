# Family Observatory

A website that draws a family tree fourteen different ways. Load any GEDCOM file (the
standard export from WikiTree, Ancestry, FamilySearch, Gramps and most genealogy programs) and
explore ancestors, descendants, places, lifetimes, repeated ancestors and the gaps worth
researching.

See it live at **[cognitiveoverload.com](https://cognitiveoverload.com/)**, showing my
Savoie / Breau family.

- **Plain static files.** HTML, CSS and JavaScript, with no build step and no framework.
- **Private by design.** A file you load is read inside your own browser. Nothing is uploaded.
  Living people are hidden by default.
- **Works with any GEDCOM.** WikiTree files get profile links on every person; files from
  elsewhere work too, just without the links.
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

Every view has a "How to read this" guide. Five colour designs (Ochre, Mineral, Sage, Slate,
Aurora) can be switched at the top of the page, and each visitor's choices are remembered.

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

The built-in family file is `site/data/family.ged.txt`. It ends in `.txt` because some web
hosts refuse to serve `.ged` files; it is an ordinary GEDCOM.

### Use your own family as the built-in one

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

### Drawing families from WikiTree

`site/js/wikitree.js` asks the WikiTree API for a person's ancestors (up to 20 generations) and
descendants (up to 10), turns the answer into GEDCOM text and hands it to the normal loader, so
every view works unchanged. A link such as `index.html?wt=Savoie-2387&anc=10&desc=1` opens a
family directly.

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

## Making it yours

| To change | Edit |
|---|---|
| Site name, menu, logo | `site/index.html`, `site/img/co-logo.svg` |
| About Me page | `site/js/aboutme.js` and `site/img/rod-savoie.jpg` |
| Contact me page and social links | `site/js/contact.js` |
| Layout and type | `site/css/style.css` |
| Colour designs | `site/js/designs.js` (palettes) and `site/css/designs.css` (textures, shadows, corners) |
| Chart colours | `FO.C` and `FO.CAT` at the top of `site/js/app.js` |
| Places that should count as one | the `alias(...)` lines in `site/js/gedcom.js` |
| Historical events on timelines | `FO.HISTORY` in `site/js/charts.js` |

## How the code is organised

```
site/
  index.html            the single page
  contact.php           sends the Contact me form
  css/                  style.css (layout), designs.css (the five designs)
  js/
    app.js              start-up, menu, home page, remembered choices
    gedcom.js           reads GEDCOM files, merges place spellings
    kin.js              relationships, lines of descent, pedigree collapse
    charts.js           shared drawing helpers, SVG export, history events
    designs.js          colour designs and the switcher
    views/              one file per view
    vendor/d3.min.js    D3
  data/family.ged.txt   the built-in family
  fonts/, img/
tools/scrub.js          makes a cleaned, publishable copy of a GEDCOM
```

## Credits

The idea and the list of views come from the
[Kinfolk Observatory](https://observatory.vibegenealogy.ai/). Family Observatory is a separate
implementation, written from scratch with its own code and design; none of the original's
code, sample families or images is included. Pedigree Collapse is an addition of its own.

Bundled: [D3](https://d3js.org/) (ISC licence) and the Roboto font (SIL Open Font Licence).
See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Licence

The code is released under the [MIT licence](LICENSE): use it, change it and share it freely,
keeping the copyright notice. My portrait, the Cognitive Overload logo and the text of my
About Me and Contact me pages are personal and are not covered; please replace them with your
own.

Created by Rod Savoie, with a keen interest in Acadian genealogy and the
[WikiTree Acadians Project](https://www.wikitree.com/wiki/Project:Acadians).
