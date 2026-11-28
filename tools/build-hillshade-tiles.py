"""Build the Family Observatory hillshade pyramid from ETOPO 2022.

The overview input is NOAA ERDDAP's ETOPO_2022_v1_60s as a NetCDF-3
export, sampled every fifth cell in both dimensions. The local inputs
are NOAA's N45W060, N45W075, N60W060 and N60W075 surface GeoTIFFs (15s).
Requires NumPy, SciPy and Pillow. Run with --help for arguments.
"""
import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image
from scipy.io import netcdf_file
from hillshade import Grid, TILE, hillshade, latitude, shaded_image


GLOBAL_MAX = 4
REGIONAL_MIN = 6
REGIONAL_MAX = 8
# XYZ tile bounds at zoom 6, with an exclusive east and south edge.
REGIONAL_BOUNDS = (19, 22, 22, 24)
SOURCE_GRIDS = ("N45W060", "N45W075", "N60W060", "N60W075")



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
    return shaded_image(shade)


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
