"""Build a PMTiles archive of worldwide ETOPO 2022 shaded relief.

Pass a directory for the 15 arc-second surface GeoTIFFs. Missing inputs
are fetched from NOAA and cached there. The overview uses the website's
existing global WebP tiles. Use --sample for an Atlantic Canada test.
"""
import argparse
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from contextlib import closing
from functools import lru_cache
from io import BytesIO
import math
from pathlib import Path
import shutil
import sqlite3
import tempfile
import time
from urllib.error import URLError
from urllib.request import urlopen

import numpy as np
from PIL import Image
from pmtiles.reader import Reader
from pmtiles.tile import Compression, TileType, zxy_to_tileid
from pmtiles.writer import Writer

from hillshade import Grid, TILE, hillshade, latitude, shaded_image


SOURCE = "https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/15s/15s_surface_elev_gtif/"
LOWEST_DETAIL_ZOOM = 5
MAX_ZOOM = 8
CELLS_PER_SOURCE = 3600
LONGITUDE_FILES = 24
LATITUDE_FILES = 12
CELL_DEGREES = 15 / CELLS_PER_SOURCE
BUFFER = 16  # Four-sigma lighting filter, interpolation and slope samples.
WEB_MERCATOR_LAT = 85.0511288
OVERVIEW = Path(__file__).resolve().parents[1] / "site/data/map/hillshade-v1"
SAMPLE = (10, 11)  # One zoom-5 block covering the Maritimes.


def source_name(column, row):
    lon = -180 + 15 * (column % LONGITUDE_FILES)
    lat = 90 - 15 * row
    return f"ETOPO_2022_v1_15s_{'N' if lat >= 0 else 'S'}{abs(lat):02d}{'E' if lon >= 0 else 'W'}{abs(lon):03d}_surface.tif"


def fetch_source(destination):
    if destination.is_file():
        return
    temporary = destination.with_suffix(".part")
    for attempt in range(3):
        try:
            with urlopen(SOURCE + destination.name, timeout=60) as response, temporary.open("wb") as target:
                shutil.copyfileobj(response, target, length=1024 * 1024)
                expected = response.headers.get("Content-Length")
                if expected and target.tell() != int(expected):
                    raise OSError("Incomplete TIFF download")
            with Image.open(temporary) as image:
                if image.size != (CELLS_PER_SOURCE, CELLS_PER_SOURCE) or image.format != "TIFF":
                    raise ValueError("Unexpected NOAA TIFF layout")
            temporary.replace(destination)
            return
        except (URLError, OSError, ValueError):
            temporary.unlink(missing_ok=True)
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


@lru_cache(maxsize=4)
def read_source(folder, column, row):
    path = folder / source_name(column, row)
    with Image.open(path) as image:
        scale = image.tag_v2[33550]
        x, y = image.tag_v2[33922][3:5]
        expected_lon = -180 + 15 * column
        expected_lat = 90 - 15 * row
        if image.size != (CELLS_PER_SOURCE, CELLS_PER_SOURCE) or not (
            math.isclose(scale[0], CELL_DEGREES) and math.isclose(scale[1], CELL_DEGREES)
            and math.isclose(x, expected_lon, abs_tol=1e-7) and math.isclose(y, expected_lat, abs_tol=1e-7)
        ):
            raise ValueError(f"Unexpected grid registration in {path.name}")
        return np.array(image, dtype=np.float32)


def elevation_grid(folder, lon, lat):
    left = math.floor((lon[0] + 180) / CELL_DEGREES - .5) - BUFFER
    right = math.ceil((lon[-1] + 180) / CELL_DEGREES - .5) + BUFFER + 1
    top = max(0, math.floor((90 - lat[0]) / CELL_DEGREES - .5) - BUFFER)
    bottom = min(LATITUDE_FILES * CELLS_PER_SOURCE,
                 math.ceil((90 - lat[-1]) / CELL_DEGREES - .5) + BUFFER + 1)
    z = np.full((bottom - top, right - left), np.nan, dtype=np.float32)
    for row in range(top // CELLS_PER_SOURCE, (bottom - 1) // CELLS_PER_SOURCE + 1):
        source_top = row * CELLS_PER_SOURCE
        y0, y1 = max(top, source_top), min(bottom, source_top + CELLS_PER_SOURCE)
        for column in range(left // CELLS_PER_SOURCE, (right - 1) // CELLS_PER_SOURCE + 1):
            source_left = column * CELLS_PER_SOURCE
            x0, x1 = max(left, source_left), min(right, source_left + CELLS_PER_SOURCE)
            source = read_source(folder, column % LONGITUDE_FILES, row)
            z[y0 - top:y1 - top, x0 - left:x1 - left] = source[
                y0 - source_top:y1 - source_top, x0 - source_left:x1 - source_left
            ]
    return Grid(z, -180 + (left + .5) * CELL_DEGREES, 90 - (top + .5) * CELL_DEGREES, CELL_DEGREES)


def render_block(job):
    folder, block_x, block_y = job
    side = 1 << (MAX_ZOOM - LOWEST_DETAIL_ZOOM)
    samples = (np.arange(side * TILE, dtype=np.float64) + .5) / (side * TILE)
    world_blocks = 1 << LOWEST_DETAIL_ZOOM
    lon = (block_x + samples) / world_blocks * 360 - 180
    lat = latitude((block_y + samples) / world_blocks)
    grid = elevation_grid(folder, lon, lat)
    hillshade(grid)
    shade = grid.sample(lon, lat)

    tiles = []
    for zoom in range(MAX_ZOOM, LOWEST_DETAIL_ZOOM - 1, -1):
        for y in range(side):
            for x in range(side):
                image = shaded_image(shade[y * TILE:(y + 1) * TILE, x * TILE:(x + 1) * TILE])
                stream = BytesIO()
                image.save(stream, format="WEBP", lossless=True, method=3)
                tiles.append((zxy_to_tileid(zoom, block_x * side + x, block_y * side + y), stream.getvalue()))
        if side > 1:
            half = shade.shape[0] // 2
            shade = shade.reshape(half, 2, half, 2).mean(axis=(1, 3))
            side //= 2
    return tiles


def verify_archive(path, sample=False):
    with path.open("rb") as file:
        def get_bytes(offset, length):
            file.seek(offset)
            return file.read(length)
        reader = Reader(get_bytes)
        header = reader.header()
        overview_count = sum(4 ** z for z in range(LOWEST_DETAIL_ZOOM))
        detail_count = sum(4 ** z for z in range(LOWEST_DETAIL_ZOOM, MAX_ZOOM + 1))
        if sample:
            detail_count //= 4 ** LOWEST_DETAIL_ZOOM
        if (header["addressed_tiles_count"] != overview_count + detail_count
                or header["max_zoom"] != MAX_ZOOM or header["tile_type"] != TileType.WEBP
                or not header["clustered"]):
            raise ValueError("PMTiles archive has unexpected coverage or encoding")
        if reader.metadata().get("format") != "webp":
            raise ValueError("PMTiles archive has unexpected metadata")
        points = [(0, 0, 0), (8, 85, 92)]
        if not sample:
            points.extend([(5, 0, 0), (8, 254, 129), (8, 127, 75), (8, 0, 255), (8, 255, 0)])
        for tile in points:
            pixels = reader.get(*tile)
            if not pixels:
                raise ValueError(f"Missing tile {tile}")
            with Image.open(BytesIO(pixels)) as image:
                image.load()
                if image.size != (TILE, TILE) or image.format != "WEBP":
                    raise ValueError(f"Invalid tile {tile}")


def build_archive(folder, output, workers, sample):
    if sample:
        blocks = [SAMPLE]
    else:
        count = 1 << LOWEST_DETAIL_ZOOM
        blocks = [(x, y) for y in range(count) for x in range(count)]
    jobs = [(folder, x, y) for x, y in blocks]
    with tempfile.TemporaryDirectory(dir=output.parent) as temporary:
        temporary = Path(temporary)
        with closing(sqlite3.connect(temporary / "tiles.sqlite")) as db:
            db.execute("PRAGMA journal_mode = OFF")
            db.execute("CREATE TABLE tiles (id INTEGER PRIMARY KEY, image BLOB NOT NULL)")
            for zoom in range(LOWEST_DETAIL_ZOOM):
                count = 1 << zoom
                db.executemany("INSERT INTO tiles VALUES (?, ?)", (
                    (zxy_to_tileid(zoom, x, y), (OVERVIEW / str(zoom) / str(x) / f"{y}.webp").read_bytes())
                    for x in range(count) for y in range(count)
                ))
            with ProcessPoolExecutor(max_workers=workers) as pool:
                for i, tiles in enumerate(pool.map(render_block, jobs, buffersize=workers * 2), 1):
                    db.executemany("INSERT INTO tiles VALUES (?, ?)", tiles)
                    if i == len(jobs) or i % 32 == 0:
                        print(f"Rendered {i}/{len(jobs)} detail blocks", flush=True)
            db.commit()
            archive = temporary / output.name
            with archive.open("wb") as file:
                writer = Writer(file)
                for tile_id, pixels in db.execute("SELECT id, image FROM tiles ORDER BY id"):
                    writer.write_tile(tile_id, pixels)
                writer.finalize({
                    "tile_type": TileType.WEBP,
                    "tile_compression": Compression.NONE,
                    "min_lon_e7": -1800000000, "max_lon_e7": 1800000000,
                    "min_lat_e7": round(-WEB_MERCATOR_LAT * 1e7), "max_lat_e7": round(WEB_MERCATOR_LAT * 1e7)
                }, {
                    "name": "Family Observatory ETOPO 2022 relief",
                    "format": "webp",
                    "attribution": "NOAA National Centers for Environmental Information, ETOPO 2022 (doi:10.25921/fd45-gt74)"
                })
        verify_archive(archive, sample)
        archive.replace(output)
    print(f"{output} · {output.stat().st_size:,} bytes", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-cache", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--sample", action="store_true", help="Build a partial archive from the four pilot source TIFFs")
    args = parser.parse_args()
    if args.workers < 1:
        parser.error("--workers must be positive")
    folder = args.source_cache.resolve()
    if not args.sample:
        folder.mkdir(parents=True, exist_ok=True)
        sources = [folder / source_name(x, y) for y in range(LATITUDE_FILES) for x in range(LONGITUDE_FILES)]
        with ThreadPoolExecutor(max_workers=4) as pool:
            for i, _ in enumerate(pool.map(fetch_source, sources), 1):
                if i == len(sources) or i % 24 == 0:
                    print(f"Available NOAA grids: {i}/{len(sources)}", flush=True)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    build_archive(folder, args.out.resolve(), args.workers, args.sample)


if __name__ == "__main__":
    main()
