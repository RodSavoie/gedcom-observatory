/* Pre-rendered Web Mercator hillshade, drawn in the same coordinates as the D3 map. */
(function () {
  'use strict';
  const FO = window.FO;
  const SIZE = 256, CACHE_LIMIT = 96;
  const FOLDER = 'hillshade-v1/';
  const ROOT = 'data/map/' + FOLDER;
  const cache = new Map();

  function tile(z, x, y, ready) {
    const key = z + '/' + x + '/' + y;
    let entry = cache.get(key);
    if (entry && (!entry.failed || Date.now() < entry.failed)) {
      cache.delete(key);
      cache.set(key, entry);
      if (entry.waiting) entry.waiting.add(ready);
      return entry;
    }
    const image = new Image();
    entry = { image: null, waiting: new Set([ready]), failed: 0 };
    cache.set(key, entry);
    if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
    image.decoding = 'async';
    image.onload = () => {
      entry.image = image;
      const listeners = entry.waiting;
      entry.waiting = null;
      listeners.forEach(notify => notify());
    };
    image.onerror = () => {
      entry.waiting = null;
      entry.failed = Date.now() + 30_000;
    };
    image.src = ROOT + key + '.webp';
    return entry;
  }

  FO.hillshadeManifest = FOLDER + 'tiles.json';
  FO.hillshadeTiles = function (manifest, worldWidth, north, ready) {
    const { globalMax, regional } = manifest;
    const maxZoom = Math.max(globalMax, ...Object.keys(regional).map(Number));
    function covered(z, x, y) {
      if (z <= globalMax) return true;
      const bounds = regional[z];
      return bounds && x >= bounds[0] && y >= bounds[1] && x < bounds[2] && y < bounds[3];
    }

    return function paint(ctx, west, width, height, transform) {
      const target = Math.max(0, Math.min(maxZoom, Math.round(Math.log2(worldWidth * transform.k / SIZE))));
      const count = 2 ** target, edge = worldWidth / count;
      const left = Math.max(0, Math.floor((transform.invertX(0) - west) / edge));
      const right = Math.min(count, Math.ceil((transform.invertX(width) - west) / edge));
      const top = Math.max(0, Math.floor((transform.invertY(0) - north) / edge));
      const bottom = Math.min(count, Math.ceil((transform.invertY(height) - north) / edge));
      ctx.globalAlpha = 1;
      for (let y = top; y < bottom; y++) {
        for (let x = left; x < right; x++) {
          let haveRequested = false;
          for (let z = target; z >= 0; z--) {
            const factor = 2 ** (target - z);
            const tx = Math.floor(x / factor), ty = Math.floor(y / factor);
            if (!covered(z, tx, ty)) continue;
            // Request the sharp tile and, if needed, a coarser visible tile. Draw
            // only one image per cell so transparent shadows never stack.
            const previous = cache.get(z + '/' + tx + '/' + ty);
            const entry = previous?.image || !haveRequested || z === Math.min(target - 1, globalMax)
              ? tile(z, tx, ty, ready) : previous;
            haveRequested = true;
            if (!entry?.image) continue;
            const crop = SIZE / factor;
            ctx.drawImage(entry.image, (x - tx * factor) * crop, (y - ty * factor) * crop,
              crop, crop, west + x * edge, north + y * edge, edge, edge);
            break;
          }
        }
      }
    };
  };
})();
