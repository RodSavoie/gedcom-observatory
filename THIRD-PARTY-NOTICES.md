# Third-party notices

Family Observatory bundles the following, each under its own licence. Their licence texts
travel with the files.

| What | Where | Licence | Licence text |
|---|---|---|---|
| D3 (data-driven documents), by Mike Bostock | `site/js/vendor/d3.min.js` | ISC | `site/js/vendor/LICENSE-d3.txt` |
| Roboto font, by The Roboto Project Authors | `site/fonts/roboto-*.woff2` | SIL Open Font Licence 1.1 | `site/fonts/OFL.txt` |
| Oswald font (Gilt design), by The Oswald Project Authors | `site/fonts/oswald-*.woff2` | SIL Open Font Licence 1.1 | `site/fonts/OFL-Oswald.txt` |
| topojson-client, by Mike Bostock | `site/js/vendor/topojson-client.min.js` | ISC | `site/js/vendor/LICENSE-topojson-client.txt` |

## Map data (Where They Lived, Map)

The files in `site/data/map/` are built by `tools/build-map-data.js` from these sources:

| What | Used for | Licence |
|---|---|---|
| Natural Earth, 1:10m countries (via the world-atlas package), states and provinces, lakes and rivers | the base map | Public domain |
| Natural Earth, 1:10m bathymetry, glaciated areas and Antarctic ice shelves | the sea's depth and the ice in the map's Colours layer | Public domain |
| GeoNames, cities500 (via the cities-500-structured package) and region names (via cities.json) | place names and coordinates worldwide | Creative Commons Attribution 4.0 (geonames.org) |
| Geolocated placenames in Canada, Natural Resources Canada and Crown-Indigenous Relations and Northern Affairs Canada (via the R package loon.data) | Canadian villages and hamlets | Open Government Licence – Canada |
| Découpage administratif, Etalab / INSEE | every French commune and its département | Licence Ouverte 2.0 |
| i18n-iso-countries | country names in English and French | MIT |

The map credits Natural Earth, GeoNames, Natural Resources Canada and INSEE in its corner, as these licences ask.
The Acadian, colonial and old French place names and their positions in `site/js/geo.js` were added by hand.
The old colonial borders (`site/data/map/history.json`) were drawn for this site in `tools/build-map-history.js`, from treaty lines cut out of Natural Earth's provinces and states.

## Not covered by the MIT licence

The MIT licence in `LICENSE` covers the code. These personal items are included so the site
works as it does on cognitiveoverload.com, but they are not offered for reuse:

- the portrait `site/img/rod-savoie.jpg`
- the Cognitive Overload "CO" logo (`site/img/co-logo.svg` and the copy inside `site/index.html`)
- the text of the About Me and Contact me pages (`site/js/aboutme.js`, `site/js/contact.js`)

If you build your own site from this code, please replace them with your own.
