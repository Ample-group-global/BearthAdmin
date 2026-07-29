import path   from 'path';
import fs     from 'fs';
import sharp  from 'sharp';
import { NextResponse } from 'next/server';
import { JOBS }        from '../../../lib/studio/jobs';
import { scanLayers, getLayersDir, getName, getTraitNames, clearLayersCache } from '../../../lib/studio/layers';

export const dynamic = 'force-dynamic';

// Parallel NFTs composited at once — set to 4× core count to keep libvips thread pool saturated
const CONCURRENCY = 48;

function applyNameFormat(fmt: string, idx: number): string {
  if (!fmt) return `#${idx}`;
  if (fmt.includes('{{id}}')) return fmt.replace(/\{\{id\}\}/g, String(idx));
  if (fmt.includes('{id}'))   return fmt.replace(/\{id\}/g, String(idx));
  if (/\d/.test(fmt)) {
    return fmt.replace(/(\d+)(?=[^0-9]*$)/, m => String(idx).padStart(m.length, '0'));
  }
  return `${fmt} #${idx}`;
}

function buildPngIndex() {
  const idx: Record<string, Record<string, string>> = {};
  for (const layer of scanLayers()) {
    idx[layer.folder] = {};
    for (const asset of layer.assets) {
      if (asset.rel !== null) {
        idx[layer.folder][asset.stem] = path.join(getLayersDir(), asset.rel);
      }
    }
  }
  return idx;
}

function pickFrom(stems: string[], weights: number[]): string | null {
  if (!stems.length) return null;
  const t = weights.reduce((a, b) => a + b, 0);
  if (t <= 0) return stems[stems.length - 1];
  let r = Math.random() * t;
  for (let i = 0; i < stems.length; i++) { r -= weights[i]; if (r <= 0) return stems[i]; }
  return stems[stems.length - 1];
}

async function runJob(jobId: string, config: any, total: number, outName: string, collection: any, conflicts: any[]) {
  const job = JOBS.get(jobId);
  const { name = 'NFT', description = '', format = 'png', nameFormat } = collection ?? {};
  const tokenFmt = nameFormat || `${name} #1`;
  const wantPng  = format !== 'webp';
  const wantWebp = format === 'webp';

  try {
    const BASE    = path.resolve(process.cwd(), '..');
    const outDir  = path.join(BASE, outName);
    const metaDir = path.join(outDir, 'metadata');
    if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(metaDir, { recursive: true });
    if (wantPng)  fs.mkdirSync(path.join(outDir, 'png'),  { recursive: true });
    if (wantWebp) fs.mkdirSync(path.join(outDir, 'webp'), { recursive: true });

    const pngIdx     = buildPngIndex();
    const layerOrder = scanLayers().map(l => l.folder);

    // ── Pre-load every layer PNG into memory once (zero disk I/O per NFT) ──────
    const bufCache: Record<string, Buffer> = {};
    let imgWidth: number | undefined, imgHeight: number | undefined;
    for (const stems of Object.values(pngIdx)) {
      for (const filePath of Object.values(stems as Record<string, string>)) {
        if (!bufCache[filePath]) {
          bufCache[filePath] = fs.readFileSync(filePath);
          if (!imgWidth) {
            const m = await sharp(bufCache[filePath]).metadata();
            imgWidth  = m.width;
            imgHeight = m.height;
          }
        }
      }
    }

    // Collection-specified dimensions take precedence; PNG-detected dims as fallback
    const targetW = collection?.width  ?? imgWidth  ?? 2000;
    const targetH = collection?.height ?? imgHeight ?? 2000;
    const needsResize = imgWidth && (targetW !== imgWidth || targetH !== imgHeight);

    // ── Build rarity pools ────────────────────────────────────────────────────
    const pools: Record<string, { stems: string[]; weights: number[] }> = {};
    for (const layer of scanLayers()) {
      const f  = layer.folder;
      const ws = config[f] ?? Object.fromEntries(layer.assets.map(a => [a.stem, a.defaultWeight ?? 1]));
      const stems   = Object.keys(ws).filter(s => parseFloat(ws[s]) > 0);
      const weights = stems.map(s => parseFloat(ws[s]));
      if (stems.length) pools[f] = { stems, weights };
    }

    function pick(folder: string): string | null {
      const pool = pools[folder];
      if (!pool?.stems.length) return null;
      return pickFrom(pool.stems, pool.weights);
    }

    // ── Build NONE stem lookup for metadata filtering ────────────────────────
    // Any asset with rel === null is a NONE placeholder — skip it in metadata output
    const noneStemsByFolder: Record<string, Set<string>> = {};
    for (const layer of scanLayers()) {
      const nones = layer.assets.filter(a => a.rel === null).map(a => a.stem);
      if (nones.length) noneStemsByFolder[layer.folder] = new Set(nones);
    }

    // ── Pre-build exclude / force entries for fast per-combo resolution ───────
    // Normalize rule format: supports both old {thenTrait} and new {type, thenTraits[]}
    const excludeEntries: any[] = [];
    const forceEntries:   any[] = [];

    if (conflicts?.length) {
      const normalized = conflicts
        .map(r => ({
          type:       r.type ?? 'exclude',
          ifLayer:    r.ifLayer,
          ifTrait:    r.ifTrait,
          thenLayer:  r.thenLayer,
          thenTraits: Array.isArray(r.thenTraits) ? r.thenTraits : (r.thenTrait ? [r.thenTrait] : []),
        }))
        .filter(r => r.ifLayer && r.ifTrait && r.thenLayer && r.thenTraits.length);

      // Group by (type, ifLayer, ifTrait, thenLayer) so multiple thenTraits merge into one entry
      const grouped = new Map<string, any>();
      for (const rule of normalized) {
        const key = `${rule.type}\x00${rule.ifLayer}\x00${rule.ifTrait}\x00${rule.thenLayer}`;
        if (!grouped.has(key)) grouped.set(key, { ...rule, traitSet: new Set() });
        rule.thenTraits.forEach((t: string) => grouped.get(key).traitSet.add(t));
      }

      for (const { type, ifLayer, ifTrait, thenLayer, traitSet } of grouped.values()) {
        const pool = pools[thenLayer];
        if (!pool) continue;

        if (type === 'exclude') {
          const validI = pool.stems.reduce((acc: number[], s, i) => { if (!traitSet.has(s)) acc.push(i); return acc; }, []);
          if (validI.length) {
            excludeEntries.push({ ifLayer, ifTrait, thenLayer, traitSet,
              stems:   validI.map(i => pool.stems[i]),
              weights: validI.map(i => pool.weights[i]) });
          }
        } else {
          // 'force' — restrict pool to allowed traits only
          const validI = pool.stems.reduce((acc: number[], s, i) => { if (traitSet.has(s)) acc.push(i); return acc; }, []);
          if (validI.length) {
            forceEntries.push({ ifLayer, ifTrait, thenLayer, traitSet,
              stems:   validI.map(i => pool.stems[i]),
              weights: validI.map(i => pool.weights[i]) });
          }
        }
      }
    }

    function applyConflictRules(combo: Record<string, string>) {
      if (!excludeEntries.length && !forceEntries.length) return combo;
      for (let pass = 0; pass < 5; pass++) {
        let changed = false;
        for (const e of excludeEntries) {
          if (combo[e.ifLayer] !== e.ifTrait) continue;
          if (!e.traitSet.has(combo[e.thenLayer])) continue;
          combo[e.thenLayer] = pickFrom(e.stems, e.weights)!;
          changed = true;
        }
        for (const e of forceEntries) {
          if (combo[e.ifLayer] !== e.ifTrait) continue;
          if (e.traitSet.has(combo[e.thenLayer])) continue;
          combo[e.thenLayer] = pickFrom(e.stems, e.weights)!;
          changed = true;
        }
        if (!changed) break;
      }
      return combo;
    }

    // ── Generate all trait combos (pure CPU — no I/O) ─────────────────────────
    const seen   = new Set<string>();
    const combos: Record<string, string>[] = [];
    for (let i = 0; i < total; i++) {
      let combo: Record<string, string> = {};
      for (let attempt = 0; attempt < 3; attempt++) {
        combo = {};
        for (const f of layerOrder) if (pools[f]) combo[f] = pick(f)!;
        applyConflictRules(combo);
        const key = layerOrder.map(f => combo[f] ?? '').join('|');
        if (!seen.has(key)) { seen.add(key); break; }
      }
      combos.push(combo);
    }

    // ── Composite images and write metadata in parallel batches ───────────────
    // Force fresh scan so trait names are always current regardless of module cache state
    clearLayersCache();
    const allLayers    = scanLayers();
    const layerLabelMap = Object.fromEntries(allLayers.map(l => [l.folder, l.label]));
    // Read trait names fresh from disk and overlay onto scanLayers-derived names
    const freshTraitNames = getTraitNames();
    const stemNames: Record<string, Record<string, string>> = {};
    for (const l of allLayers) {
      stemNames[l.folder] = {};
      for (const a of l.assets) {
        stemNames[l.folder][a.stem] = freshTraitNames[l.folder]?.[a.stem] ?? a.name;
      }
    }
    let doneCount = 0;

    async function processOne(i: number) {
      if (job.cancelled) return;
      const combo = combos[i];

      const bufs = layerOrder
        .map(f => {
          const stem     = combo[f];
          const filePath = stem ? pngIdx[f]?.[stem] : null;
          return filePath ? bufCache[filePath] : null;
        })
        .filter(Boolean) as Buffer[];

      if (bufs.length) {
        const composites = bufs.slice(1).map(buf => ({ input: buf, blend: 'over' as const }));
        const base = sharp({
          create: { width: targetW, height: targetH, channels: 4, background: { r:0, g:0, b:0, alpha:0 } },
        }).composite([{ input: bufs[0] }, ...composites]);

        const pipeline = needsResize ? base.resize(targetW, targetH, { fit: 'fill' }) : base;
        const writes: Promise<any>[] = [];
        if (wantPng)  writes.push(pipeline.clone().png({ compressionLevel: 0 }).toFile(path.join(outDir, 'png',  `${i + 1}.png`)));
        if (wantWebp) writes.push(pipeline.clone().webp({ quality: 90 })        .toFile(path.join(outDir, 'webp', `${i + 1}.webp`)));
        await Promise.all(writes);
      }

      // Exclude NONE placeholder picks from metadata attributes
      const attrs = layerOrder
        .filter(f => combo[f] && !noneStemsByFolder[f]?.has(combo[f]))
        .map(f => ({
          trait_type: layerLabelMap[f] ?? f,
          value: stemNames[f]?.[combo[f]] ?? getName(f, combo[f]),
        }));

      fs.writeFileSync(
        path.join(metaDir, `${i + 1}.json`),
        JSON.stringify({
          name:        applyNameFormat(tokenFmt, i + 1),
          description,
          image:       `ipfs://PLACEHOLDER_CID/${i + 1}.${wantWebp ? 'webp' : 'png'}`,
          edition:     i + 1,
          attributes:  attrs,
        }, null, 2)
      );

      job.done = ++doneCount;
    }

    // Sliding window worker pool — always keeps CONCURRENCY tasks in flight
    // so no CPU cycle is wasted waiting for a slow composite to unblock the next batch
    let nextIdx = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (!job.cancelled) {
        const i = nextIdx++;
        if (i >= total) break;
        await processOne(i);
      }
    }));

    job.status = 'done';
    job.outDir = outDir;
    job.total  = total;
  } catch (err: any) {
    job.status = 'error';
    job.error  = err.message;
  }
}

export async function POST(request: Request) {
  const { total = 10, config = {}, collection = {}, conflicts = [] } = await request.json();
  const count    = Math.max(1, Math.min(+total, 100000));
  const jobId    = Math.random().toString(36).slice(2, 10);
  const safeName = (collection?.name || 'output').replace(/[^a-zA-Z0-9_-]/g, '_');
  const outName  = `${safeName}_nfts`;

  JOBS.set(jobId, { status: 'running', done: 0, total: count, cancelled: false, outDir: null, error: null });

  setImmediate(() => runJob(jobId, config, count, outName, collection, conflicts));

  return NextResponse.json({ job_id: jobId });
}
