"""Step 1 of 2 for the map's Relief layer in Where They Lived: works out the light and shadow of the land and the sea floor
as if lit from the north-west, from a world elevation grid. Step 2 (build-map-relief.js) traces it into shapes.
Nothing here runs on the website.

Source: ETOPO1 (NOAA, public domain) at 10 arc-minutes, as earth-topography-10arcmin.nc from Fatiando a Terra
(github.com/fatiando-data/earth-topography-10arcmin, releases; CC BY 4.0, which the map credits when the layer is on).

Run from this folder:  pip install numpy scipy h5py
                       python3 build-map-relief.py earth-topography-10arcmin.nc
It writes relief-land.f32 and relief-sea.f32 here, for build-map-relief.js."""
import math, sys
import h5py, numpy as np
from scipy.ndimage import gaussian_filter

LAND_STEEPNESS = 8    # how much the land's slopes are exaggerated; higher gives more shadow
SEA_STEEPNESS = 3     # the same for the sea floor
LIGHT_FROM = 315      # where the light comes from, in degrees (315: north-west), and how high it is
LIGHT_HEIGHT = 45

f = h5py.File(sys.argv[1] if len(sys.argv) > 1 else 'earth-topography-10arcmin.nc')
lat = f['latitude'][:]; z = f['topography'][:].astype(np.float32)
if lat[0] < lat[-1]: z = z[::-1]; lat = lat[::-1]    # north first
print('grid', z.shape)
cell = 10 / 60 * 111320.0                             # metres between rows

def shade(e, steep, blur):
    """0 on flat ground, below 0 in shadow, above 0 in light"""
    e = gaussian_filter(e, blur, mode=['nearest', 'wrap'])
    dy = np.gradient(e, axis=0) / cell
    dx = np.gradient(e, axis=1) / (cell * np.cos(np.radians(lat))[:, None].clip(0.05, 1))
    dx *= steep; dy *= steep
    slope = np.arctan(np.hypot(dx, dy)); aspect = np.arctan2(dy, -dx)   # dy runs southward, as rows do
    az = math.radians(360 - LIGHT_FROM + 90); alt = math.radians(LIGHT_HEIGHT)
    return math.sin(alt) * np.cos(slope) + math.cos(alt) * np.sin(slope) * np.cos(az - aspect) - math.sin(alt)

land = z > 0
shade(np.where(land, z, 0), LAND_STEEPNESS, 1.0).astype('<f4').tofile('relief-land.f32')
shade(np.where(land, 0, z), SEA_STEEPNESS, 1.5).astype('<f4').tofile('relief-sea.f32')
print('relief-land.f32 and relief-sea.f32, %d x %d' % (z.shape[1], z.shape[0]))
