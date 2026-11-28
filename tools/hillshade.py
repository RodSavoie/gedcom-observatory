"""Terrain sampling, lighting and tile encoding for both relief builds."""
from dataclasses import dataclass

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, map_coordinates


TILE = 256


@dataclass
class Grid:
    values: np.ndarray
    west: float  # Longitude at the centre of the first column.
    north: float  # Latitude at the centre of the first row.
    step: float

    def sample(self, lon, lat, wrap=False):
        col, row = np.meshgrid((lon - self.west) / self.step,
                               (self.north - lat) / self.step)
        mode = "grid-wrap" if wrap else "nearest"
        return map_coordinates(self.values, [row, col], order=1, mode=mode)


def hillshade(grid, wrap=False):
    z = grid.values
    if not np.isfinite(z).all() or z.min() < -12000:
        raise ValueError("Elevation source has missing cells in the requested area")
    mode = ("nearest", "wrap" if wrap else "nearest")
    metres = grid.step * 111_195
    lat = grid.north - np.arange(z.shape[0]) * grid.step
    width = metres * np.cos(np.radians(lat)).clip(.03, 1).astype(np.float32)[:, None]
    # Two scales give broad landforms soft shadows while retaining finer ridges.
    # The continuous elevation grid is smoothed before shading, including at sea level.
    light = np.zeros_like(z)
    for sigma, weight, exaggeration in ((.8, .68, 1.8), (3.0, .32, 3.4)):
        smooth = gaussian_filter(z, sigma, mode=mode)
        dy = np.gradient(smooth, axis=0) * (exaggeration / metres)
        dx = (np.roll(smooth, -1, axis=1) - np.roll(smooth, 1, axis=1)) / 2 if wrap else np.gradient(smooth, axis=1)
        dx *= exaggeration / width
        normal = np.sqrt(1 + dx * dx + dy * dy)
        # Northwest key light at 45 degrees, with softer high-angle fill light.
        key = (.7071 + .5 * (dx + dy)) / normal - .7071
        fill = (.9239 + .3827 * dy) / normal - .9239
        light += weight * (.82 * key + .18 * fill)
    # The continental shelf stays quieter than the land. Ease across sea level
    # before quantization to avoid a hard edge from differences in coastline data.
    land = np.clip((z + 12) / 24, 0, 1)
    opacity = np.where(light < 0, .32, .46) * (.42 + .58 * land)
    grid.values = (np.tanh(3.4 * light) * opacity).astype(np.float32)


def latitude(y):
    return np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * y))))


def shaded_image(shade):
    height, width = shade.shape
    rgba = np.empty((height, width, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.where(shade >= 0, 255, 0)[:, :, None]
    rgba[:, :, 3] = np.rint(abs(shade) * 255).astype(np.uint8)
    return Image.fromarray(rgba)
