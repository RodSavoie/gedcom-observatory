"""Builds the shaded relief of the map in Where They Lived (site/data/map/relief.jpg, relief-na.jpg, relief-eu.jpg).
Nothing here runs on the website.

Source: Natural Earth's shaded relief (public domain), 10800 x 5400 pixels, as shadedrelief.jpg in the basemap-data
package (pip download basemap-data --no-deps, then unzip the .whl: mpl_toolkits/basemap_data/shadedrelief.jpg), or
from naturalearthdata.com. The picture is turned to the map's projection (Mercator), and the sea and lakes are made
white using the site's own coastlines (relief-land.geojson and relief-lakes.geojson, written by build-map-layers.js),
so the relief stops exactly at the coast drawn on the map.

Run from this folder:  pip install numpy scipy pillow
                       python3 build-map-relief.py shadedrelief.jpg ../site/data/map
The site places each picture by the edges given at the bottom (RELIEF_IMAGES in js/views/placesmap.js must match)."""
import json, math, sys, os
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import map_coordinates
Image.MAX_IMAGE_PIXELS = None
SRC = sys.argv[1] if len(sys.argv) > 1 else 'shadedrelief.jpg'
OUT = sys.argv[2] if len(sys.argv) > 2 else '../site/data/map'
src = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
SH, SW = src.shape[:2]
def merc(lat): return math.log(math.tan(math.pi/4 + math.radians(lat)/2))
def build(lon0, lon1, lat_top, lat_bot, width, out, quality):
    # output covers lon0..lon1, lat_top..lat_bot in Mercator; px per radian of longitude
    ppr = width / math.radians(lon1 - lon0)
    y0, y1 = merc(lat_top), merc(lat_bot)
    height = int(round((y0 - y1) * ppr))
    # source columns for output columns (linear in lon)
    lons = lon0 + (np.arange(width) + 0.5) / width * (lon1 - lon0)
    sx = (lons + 180) / 360 * SW - 0.5
    ys = y0 - (np.arange(height) + 0.5) / ppr
    lats = np.degrees(2 * np.arctan(np.exp(ys)) - math.pi / 2)
    sy = (90 - lats) / 180 * SH - 0.5
    gy, gx = np.meshgrid(sy, sx, indexing='ij')
    img = np.stack([map_coordinates(src[..., c], [gy, gx], order=1, mode='nearest') for c in range(3)], -1)
    # land mask, drawn at 2x then reduced for soft edges
    S = 2
    mask = Image.new('L', (width * S, height * S), 0)
    d = ImageDraw.Draw(mask)
    def P(lon, lat):
        return ((math.radians(lon - lon0)) * ppr * S, (y0 - merc(max(-85, min(85, lat)))) * ppr * S)
    def unwrap(r):
        out = [list(r[0])]
        for p in r[1:]:
            lon = p[0]
            while lon - out[-1][0] > 180: lon -= 360
            while lon - out[-1][0] < -180: lon += 360
            out.append([lon, p[1]])
        return out
    def poly(ring, fill):
        r = unwrap(ring)
        for off in (-360, 0, 360):
            d.polygon([P(x + off, y) for x, y in r], fill=fill)
    def rings(f):
        g = f['geometry'] if 'geometry' in f else f
        if not g: return
        if g['type'] == 'Polygon': yield g['coordinates']
        elif g['type'] == 'MultiPolygon': yield from g['coordinates']
    land = json.load(open('relief-land.geojson'))
    for f in land['features']:
        for pg in rings(f):
            poly(pg[0], 255)
            for hole in pg[1:]: poly(hole, 0)
    for f in json.load(open('relief-lakes.geojson'))['features']:
        for pg in rings(f):
            poly(pg[0], 0)
    mask = np.asarray(mask.resize((width, height), Image.LANCZOS)).astype(np.float32)[..., None] / 255
    out_img = img * mask + 255 * (1 - mask)
    Image.fromarray(np.clip(out_img, 0, 255).astype(np.uint8)).save(os.path.join(OUT, out), quality=quality, optimize=True, progressive=True)
    print(out, width, height, 'lat', lat_top, lat_bot, 'lon', lon0, lon1)
# [west, east, north, south, width in pixels, file, JPEG quality]: the world, then Atlantic Canada and New England, and France
build(-180, 180, 84, -62, 4096, 'relief.jpg', 78)
build(-80, -52, 53.5, 40, 840, 'relief-na.jpg', 82)
build(-6, 10, 52, 41, 480, 'relief-eu.jpg', 82)
