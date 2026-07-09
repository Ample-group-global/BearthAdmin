/**
 * NFT Export Worker
 * Receives pre-loaded image ArrayBuffers from main thread (no network calls here).
 *
 * Messages IN:
 *   { combos, imageBuffers, layers, targetW, targetH, imgMime, startIdx }
 *
 * Messages OUT:
 *   { type: 'chunk',    results: [{ idx, buffer }] }  — transferable ArrayBuffers
 *   { type: 'progress', count }
 *   { type: 'done' }
 *   { type: 'error',   message }
 */

const INNER_BATCH = 8;

self.onmessage = async (e) => {
  const { combos, imageBuffers, layers, targetW, targetH, imgMime, startIdx } = e.data;

  try {
    // Decode pre-loaded ArrayBuffers into ImageBitmaps — no network needed
    const bitmaps = {};
    await Promise.all(Object.keys(imageBuffers).map(async (rel) => {
      try {
        bitmaps[rel] = await createImageBitmap(new Blob([imageBuffers[rel]]));
      } catch {}
    }));

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

      const transfers = results.map(r => r.buffer);
      self.postMessage({ type: 'chunk', results }, transfers);
      self.postMessage({ type: 'progress', count: slice.length });
    }

    self.postMessage({ type: 'done' });
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) });
  }
};
