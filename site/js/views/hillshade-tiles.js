/* Pre-rendered Web Mercator hillshade, drawn in the same coordinates as the D3 map. */
(function () {
  'use strict';
  const FO = window.FO;
  const SIZE = 256, CACHE_LIMIT = 96;
  const DATA = 'data/map/';
  const FOLDER = 'hillshade-v1/';
  const ROOT = DATA + FOLDER;
  const WORLD_CONFIG = DATA + 'hillshade-world.json';
  const PMTILES_CLIENT = DATA + 'pmtiles-4.5.0.js';
  const cache = new Map();
  let pendingWorld;

  function loadClient() {
    if (window.pmtiles?.PMTiles) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = PMTILES_CLIENT;
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }

  function loadWorld(globalMax) {
    if (pendingWorld) return pendingWorld;
    pendingWorld = fetch(WORLD_CONFIG, { cache: 'no-cache' }).then(response => {
      if (response.ok) return response.json();
      return null;
    }).then(async config => {
      if (!config || !/^hillshade-world-v1-[\d-]+\.pmtiles$/.test(config.archive)) return null;
      await loadClient();
      const archive = new window.pmtiles.PMTiles(DATA + config.archive);
      const header = await archive.getHeader();
      // Only activate a published, complete WebP pyramid.
      if (header.tileType === 4 && header.minZoom === 0 && header.maxZoom === 8
          && header.numAddressedTiles === (4 ** (header.maxZoom + 1) - 1) / 3
          && header.maxZoom > globalMax) return { archive, maxZoom: header.maxZoom };
      return null;
    }).catch(() => null);
    return pendingWorld;
  }

  function tile(z, x, y, ready, archive, loose) {
    const path = z + '/' + x + '/' + y, key = archive ? 'world/' + path : path;
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
    let objectUrl;
    function release() {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    image.onload = () => {
      release();
      entry.image = image;
      const listeners = entry.waiting;
      entry.waiting = null;
      listeners.forEach(notify => notify());
    };
    function failed() {
      release();
      entry.waiting = null;
      entry.failed = Date.now() + 30_000;
    }
    image.onerror = failed;
    if (archive) {
      archive.getZxy(z, x, y).then(result => {
        if (!result) throw new Error('Missing relief tile');
        objectUrl = URL.createObjectURL(new Blob([result.data], { type: 'image/webp' }));
        image.src = objectUrl;
      }).catch(() => {
        if (loose) image.src = ROOT + path + '.webp';
        else failed();
      });
    } else image.src = ROOT + path + '.webp';
    return entry;
  }

  FO.hillshadeManifest = FOLDER + 'tiles.json';
  FO.hillshadeTiles = function (manifest, worldWidth, north, ready) {
    const { globalMax, regional } = manifest;
    const pilotMax = Math.max(globalMax, ...Object.keys(regional).map(Number));
    let world, requested = false;
    function covered(z, x, y) {
      if (z <= globalMax) return true;
      const bounds = regional[z];
      return bounds && x >= bounds[0] && y >= bounds[1] && x < bounds[2] && y < bounds[3];
    }

    return function paint(ctx, west, width, height, transform) {
      const zoom = Math.round(Math.log2(worldWidth * transform.k / SIZE));
      if (zoom > globalMax && !requested) {
        requested = true;
        loadWorld(globalMax).then(source => { if (source) { world = source; ready(); } });
      }
      const target = Math.max(0, Math.min(world?.maxZoom ?? pilotMax, zoom));
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
            const loose = covered(z, tx, ty);
            const archive = z > globalMax ? world?.archive : null;
            if (!loose && !archive) continue;
            // Request the sharp tile and, if needed, a coarser visible tile. Draw
            // only one image per cell so transparent shadows never stack.
            const path = z + '/' + tx + '/' + ty;
            const previous = cache.get(archive ? 'world/' + path : path);
            const entry = previous?.image || !haveRequested || z === Math.min(target - 1, globalMax)
              ? tile(z, tx, ty, ready, archive, loose) : previous;
            haveRequested = true;
            const image = entry?.image || (archive && cache.get(path)?.image);
            if (!image) continue;
            const crop = SIZE / factor;
            ctx.drawImage(image, (x - tx * factor) * crop, (y - ty * factor) * crop,
              crop, crop, west + x * edge, north + y * edge, edge, edge);
            break;
          }
        }
      }
    };
  };
})();
