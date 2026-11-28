"""Build the Family Observatory hillshade pyramid from ETOPO 2022.

The overview input is NOAA ERDDAP's ETOPO_2022_v1_60s as a NetCDF-3
export, sampled every fifth cell in both dimensions. The local inputs
are NOAA's N45W060, N45W075, N60W060 and N60W075 surface GeoTIFFs (15s).
Requires NumPy, SciPy and Pillow. Run with --help for arguments.
"""
import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.io import netcdf_file
from scipy.ndimage import gaussian_filter, map_coordinates


TILE = 256
GLOBAL_MAX = 4
REGIONAL_MIN = 6
REGIONAL_MAX = 8
# XYZ tile bounds at zoom 6, with an exclusive east and south edge.
REGIONAL_BOUNDS = (19, 22, 22, 24)
SOURCE_GRIDS = ("N45W060", "N45W075", "N60W060", "N60W075")


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


def world_grid(path):
    with netcdf_file(path, mmap=False) as source:
        lon = source.variables["longitude"][:]
        lat = source.variables["latitude"][:]
        z = source.variables["z"][:].astype(np.float32)
    lon = (lon + 180) % 360 - 180
    columns = np.argsort(lon)
    rows = np.argsort(lat)[::-1]
    return Grid(z[np.ix_(rows, columns)], float(lon[columns[0]]),
                float(lat[rows[0]]), float(abs(lat[1] - lat[0])))


def regional_grid(folder, west, south, east, north):
    step = 15 / 3600
    # Snap the padded crop to the common NOAA grid before mosaicking.
    left = math.floor(west / step) - 24
    right = math.ceil(east / step) + 24
    bottom = math.floor(south / step) - 24
    top = math.ceil(north / step) + 24
    z = np.full((top - bottom, right - left), np.nan, dtype=np.float32)
    for name in SOURCE_GRIDS:
        with Image.open(folder / f"ETOPO_2022_v1_15s_{name}_surface.tif") as image:
            _, _, _, origin_x, origin_y, _ = image.tag_v2[33922]
            if not math.isclose(image.tag_v2[33550][0], step):
                raise ValueError(f"{name} does not have 15 arc-second pixels")
            x = round(origin_x / step)
            y = round(origin_y / step)
            x0, x1 = max(left, x), min(right, x + image.width)
            y0, y1 = max(bottom, y - image.height), min(top, y)
            if x0 < x1 and y0 < y1:
                z[top - y1:top - y0, x0 - left:x1 - left] = np.asarray(
                    image.crop((x0 - x, y - y1, x1 - x, y - y0))
                )
    return Grid(z, (left + .5) * step, (top - .5) * step, step)


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


def render_tile(world, region, extent, zoom, x, y):
    count = 1 << zoom
    centres = (np.arange(TILE) + .5) / TILE
    lon = (x + centres) * 360 / count - 180
    lat = latitude((y + centres) / count)
    shade = world.sample(lon, lat, wrap=True)
    if region:
        west, south, east, north = extent
        x_margin = np.minimum(lon - west, east - lon)
        y_margin = np.minimum(lat - south, north - lat)
        mix = np.clip(np.minimum(y_margin[:, None], x_margin) / 1.1, 0, 1)
        mix = mix * mix * (3 - 2 * mix)
        shade += (region.sample(lon, lat) - shade) * mix
    rgba = np.empty((TILE, TILE, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.where(shade >= 0, 255, 0)[:, :, None]
    rgba[:, :, 3] = np.rint(abs(shade) * 255).astype(np.uint8)
    return Image.fromarray(rgba)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--world", type=Path, required=True, help="NOAA ERDDAP world NetCDF-3")
    parser.add_argument("--region", type=Path, required=True, help="Folder containing the four NOAA GeoTIFFs")
    parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "site/data/map/hillshade-v1")
    args = parser.parse_args()
    n = 1 << REGIONAL_MIN
    x0, y0, x1, y1 = REGIONAL_BOUNDS
    extent = (x0 * 360 / n - 180, float(latitude(y1 / n)),
              x1 * 360 / n - 180, float(latitude(y0 / n)))
    world = world_grid(args.world)
    region = regional_grid(args.region, *extent)
    hillshade(world, wrap=True)
    hillshade(region)
    regional = {}
    for zoom in (*range(GLOBAL_MAX + 1), *range(REGIONAL_MIN, REGIONAL_MAX + 1)):
        detail = zoom >= REGIONAL_MIN
        if detail:
            scale = 1 << (zoom - REGIONAL_MIN)
            bounds = tuple(k * scale for k in REGIONAL_BOUNDS)
            regional[zoom] = bounds
        else:
            bounds = (0, 0, 1 << zoom, 1 << zoom)
        left, top, right, bottom = bounds
        for x in range(left, right):
            folder = args.out / str(zoom) / str(x)
            folder.mkdir(parents=True, exist_ok=True)
            for y in range(top, bottom):
                tile = render_tile(world, region if detail else None, extent, zoom, x, y)
                tile.save(folder / f"{y}.webp", lossless=True, method=3)
        print(f"Zoom {zoom}: {(right - left) * (bottom - top)} tiles", flush=True)
    (args.out / "tiles.json").write_text(
        json.dumps({"globalMax": GLOBAL_MAX, "regional": regional}, separators=(",", ":")) + "\n",
        encoding="utf-8"
    )


if __name__ == "__main__":
    main()
