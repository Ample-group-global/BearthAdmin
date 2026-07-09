/**
 * NFT Export Worker
 * Runs in a background thread — composites layer images onto OffscreenCanvas,
 * encodes to PNG/WebP, and streams ArrayBuffer chunks back to the main thread.
 *
 * Messages IN  (from main):
 *   { type: 'run', combos, layerUrls, layers, targetW, targetH, imgMime, startIdx }
 *
 * Messages OUT (to main):
 *   { type: 'chunk', results: [{ idx, buffer }] }   — transferable ArrayBuffers
 *   { type: 'progress', count }
 *   { type: 'done' }
 *   { type: 'error', message }
 */

const INNER_BATCH = 8; // concurrent encodes per worker

self.onmessage = async (e) => {
  const { combos, layerUrls, layers, targetW, targetH, imgMime, startIdx } = e.data;

  try {
    // Load all required layer images once (blob URLs or /api/ URLs are same-origin)
    const bitmaps = {};
    const rels = Object.keys(layerUrls);
    await Promise.all(rels.map(async (rel) => {
      try {
        const res = await fetch(layerUrls[rel]);
        if (res.ok) {
          const blob = await res.blob();
          bitmaps[rel] = await createImageBitmap(blob);
        }
      } catch {}
    }));

    // Process combos in small internal batches so encoding is pipelined
    for (let i = 0; i < combos.length; i += INNER_BATCH) {
      const slice = combos.slice(i, Math.min(i + INNER_BATCH, combos.length));

      const results = await Promise.all(slice.map(async (combo, j) => {
        const canvas = new OffscreenCanvas(targetW, targetH);
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, targetW, targetH);

        for (const layer of layers) {
          const pick = combo[layer.folder];
          if (!pick?.rel) continue;
          const bm = bitmaps[pick.rel];
          if (bm) ctx.drawImage(bm, 0, 0, targetW, targetH);
        }

        const blob = await canvas.convertToBlob({ type: imgMime });
        const buffer = await blob.arrayBuffer();
        return { idx: startIdx + i + j, buffer };
      }));

      // Transfer ArrayBuffers zero-copy back to main thread
      const transfers = results.map(r => r.buffer);
      self.postMessage({ type: 'chunk', results }, transfers);
      self.postMessage({ type: 'progress', count: slice.length });
    }

    self.postMessage({ type: 'done' });
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) });
  }
};
