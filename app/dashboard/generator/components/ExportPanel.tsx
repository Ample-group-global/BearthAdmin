// @ts-nocheck
'use client';
import { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { generateAllCombos, computeRarity, applyNameFormat } from '../../../../lib/studio/combos';
import NftPopup from './NftPopup';

const BATCH = 64; // fallback batch size when Web Workers not available

// ── Canvas helpers ────────────────────────────────────────────────────────────
function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function canvasToBlob(canvas: any, type: string): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type });
  return new Promise(res => canvas.toBlob(res, type));
}

// ── Tier colours ──────────────────────────────────────────────────────────────
const TIER_COLOR: Record<string, string> = {
  Legendary: '#F59E0B',
  Epic:      '#A855F7',
  Rare:      '#3B82F6',
  Common:    '#6B7280',
};

// ── Rarity card ───────────────────────────────────────────────────────────────
function RarityCard({ item, jobBitmaps, layers, canvasW, canvasH, onClick }) {
  const tierColor = TIER_COLOR[item.tier] ?? '#6B7280';

  const canvasRef = useRef(null);
  const cardRef   = useRef(null);
  const drawn     = useRef(false);

  function draw() {
    if (drawn.current || !canvasRef.current) return;
    drawn.current = true;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);
    for (const layer of layers) {
      const pick = item.combo[layer.folder];
      if (!pick?.rel) continue;
      const bm = jobBitmaps.current[pick.rel];
      if (bm) ctx.drawImage(bm, 0, 0, canvasW, canvasH);
    }
  }

  // Draw as soon as card scrolls into view (200px lookahead)
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { draw(); obs.disconnect(); } },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const [open, setOpen] = useState(false);

  function handleClick() {
    if (!drawn.current) draw();
    const src = canvasRef.current?.toDataURL() ?? '';
    onClick({ index: item.index, src, attrs: item.attrs, rank: item.rank, score: item.score });
    setOpen(true);
  }

  return (
    <div ref={cardRef} className={`exp-nft-card${open ? ' exp-nft-open' : ''}`} onClick={handleClick}>
      <div className="exp-nft-thumb">
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        <div className="exp-nft-rank" style={{ color: tierColor }}>#{item.rank}</div>
      </div>
      <div className="exp-nft-info">
        <div className="exp-nft-name">#{item.index}</div>
        <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
          <span className="exp-nft-score" style={{ color: tierColor }}>Score: {item.score}</span>
          <span style={{ fontSize:10, fontWeight:700, color: tierColor, background:`${tierColor}22`, padding:'1px 5px', borderRadius:4 }}>{item.tier}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main ExportPanel ──────────────────────────────────────────────────────────
export default function ExportPanel({ weights, layers: layersProp = [], collection, conflicts, collectionId = null }) {
  const supply      = collection?.supply      ?? 100;
  const targetW     = collection?.width       ?? 2000;
  const targetH     = collection?.height      ?? 2000;
  const wantWebp    = collection?.format      === 'webp';
  const imgExt      = wantWebp ? 'webp' : 'png';
  const imgMime     = wantWebp ? 'image/webp' : 'image/png';
  const nameFormat  = collection?.nameFormat  ?? '';
  const description = collection?.description ?? '';
  const collName    = collection?.name        ?? '';

  // Thumbnail size for the rarity grid display — 280px matches industry NFT card size
  const THUMB = Math.min(280, targetW);
  const scale = Math.min(THUMB / targetW, THUMB / targetH, 1);
  const tW    = Math.max(1, Math.round(targetW * scale));
  const tH    = Math.max(1, Math.round(targetH * scale));

  const [phase,     setPhase]     = useState<'idle'|'preload'|'combos'|'generating'|'done'>('idle');
  const [loadMsg,   setLoadMsg]   = useState('');
  const [progress,  setProgress]  = useState(0);
  const [cid,       setCid]       = useState('');
  const [metaOnly,  setMetaOnly]  = useState(false);
  const [sortBy,    setSortBy]    = useState<'rarity'|'id'>('rarity');
  const [popup,     setPopup]     = useState(null);
  const [dlLoading, setDlLoading] = useState(false);
  const [error,     setError]     = useState('');
  const [dbError,   setDbError]   = useState('');
  const [dbSaving,  setDbSaving]  = useState(false);
  const [dbSaved,   setDbSaved]   = useState(false);

  // ── Filebase IPFS push state ──────────────────────────────────────────────
  const [fbBucket,  setFbBucket]  = useState('');
  const [fbStatus,  setFbStatus]  = useState('idle'); // idle|checking|exists|not_found|creating|created|error
  const [imgPhase,  setImgPhase]  = useState('idle'); // idle|preloading|uploading|done
  const [imgDone,   setImgDone]   = useState(0);
  const [imgCids,   setImgCids]   = useState({});
  const [metaPhase, setMetaPhase] = useState('idle'); // idle|uploading|done
  const [metaDone,  setMetaDone]  = useState(0);
  const [metaCids,  setMetaCids]  = useState({});
  const [showCids,  setShowCids]  = useState(false);
  const [fbError,   setFbError]   = useState('');
  const imgCidsRef = useRef({});


  const [rarityItems, setRarityItems] = useState<any[]>([]);
  const [allCombos,   setAllCombos]   = useState<any[]>([]);

  // Shared bitmap cache — pre-loaded at thumbnail size for grid display
  const jobBitmaps = useRef<Record<string, ImageBitmap>>({});

  const [layers, setLayers] = useState<any[]>(layersProp);
  const cancelledRef       = useRef(false);
  const lastFailedJobIdRef = useRef<string | null>(null);

  async function generate() {
    cancelledRef.current = false;
    setError('');
    setPhase('preload');
    setProgress(0);
    setRarityItems([]);
    setAllCombos([]);
    jobBitmaps.current = {};

    // ── 1. Resolve layers ─────────────────────────────────────────────────────
    let layerData: any[] = layersProp.length ? layersProp : layers;
    if (!layerData.length) {
      try {
        const r = await fetch('/api/layers');
        layerData = await r.json();
      } catch {}
    }
    if (!layerData.length) {
      setError('No layers found. Upload assets in the Settings tab first.');
      setPhase('idle');
      return;
    }
    setLayers(layerData);

    // ── 2. Pre-load all unique layer images (thumbnail size for grid) ─────────
    const rels = [...new Set(
      layerData.flatMap((l: any) => l.assets.filter((a: any) => a.rel).map((a: any) => a.rel))
    )] as string[];

    let loaded = 0;
    setLoadMsg(`Loading images… 0 / ${rels.length}`);

    await Promise.all(rels.map(async (rel) => {
      try {
        const res = await fetch(`/api/layer-img/${rel}?w=${tW}&h=${tH}`);
        if (res.ok) {
          const blob = await res.blob();
          try {
            jobBitmaps.current[rel] = await createImageBitmap(blob, {
              resizeWidth: tW, resizeHeight: tH, resizeQuality: 'medium',
            });
          } catch {
            jobBitmaps.current[rel] = await createImageBitmap(blob);
          }
        }
      } catch {}
      setLoadMsg(`Loading images… ${++loaded} / ${rels.length}`);
    }));

    if (cancelledRef.current) { setPhase('idle'); return; }

    // ── 3. Generate all combos ────────────────────────────────────────────────
    setPhase('combos');
    setLoadMsg('Generating combinations…');
    await new Promise(r => setTimeout(r, 0));

    const combos = generateAllCombos(supply, layerData, weights, conflicts);

    // ── 4. Compute rarity scores ──────────────────────────────────────────────
    const scored = computeRarity(combos, layerData).map(item => ({
      ...item,
      combo: combos[item.index - 1],
      total: supply,
    }));
    setAllCombos(combos);
    setRarityItems(scored);
    setPhase('done');
    setDbError('');
    setDbSaved(false);
    lastFailedJobIdRef.current = null;
    if (collectionId) await persistToDb(scored);
  }

  // ── Persist generated items to DB (can be retried independently) ─────────────
  async function persistToDb(items: any[]) {
    if (!collectionId || !items.length) return;
    setDbSaving(true);
    setDbSaved(false);
    setDbError('');
    // Delete previous failed job before creating a new one — avoids orphan records
    if (lastFailedJobIdRef.current) {
      await fetch(`/api/nft-gen/jobs/${lastFailedJobIdRef.current}`, { method: 'DELETE' }).catch(() => {});
      lastFailedJobIdRef.current = null;
    }
    let dbJobId: string | null = null;
    try {
      const jr = await fetch(`/api/nft-gen/collections/${collectionId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editionSize: items.length }),
      });
      if (!jr.ok) throw new Error(`Job creation failed (${jr.status})`);
      const jdata = await jr.json();
      dbJobId = jdata?.job?.id ?? jdata?.id ?? null;
      if (!dbJobId) throw new Error('Job ID not returned from server');

      await fetch(`/api/nft-gen/jobs/${dbJobId}/start`, { method: 'POST' });

      const ITEM_BATCH = 100;
      for (let i = 0; i < items.length; i += ITEM_BATCH) {
        const chunk = items.slice(i, i + ITEM_BATCH).map((item: any) => ({
          editionNumber: item.index,
          dnaHash: (item.attrs as any[]).map((a: any) => `${a.trait_type}:${a.value}`).join('|'),
          score: item.score,
          rank: item.rank,
          tier: item.tier,
          traits: (item.attrs as any[]).map((a: any) => ({
            traitType: a.trait_type,
            traitValue: a.value,
          })),
        }));
        const br = await fetch(`/api/nft-gen/jobs/${dbJobId}/items/batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: chunk }),
        });
        if (!br.ok) {
          const errData = await br.json().catch(() => ({}));
          throw new Error(`Batch insert failed (${br.status}): ${(errData as any).error ?? 'server error'}`);
        }
        const pctDone = Math.round(((i + chunk.length) / items.length) * 100);
        await fetch(`/api/nft-gen/jobs/${dbJobId}/progress`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ progress: pctDone }),
        });
      }

      await fetch(`/api/nft-gen/jobs/${dbJobId}/complete`, { method: 'POST' });
      setDbSaved(true);
    } catch (err: any) {
      console.error('[DB persist] failed:', err?.message);
      if (dbJobId) {
        await fetch(`/api/nft-gen/jobs/${dbJobId}/fail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errorMessage: err?.message ?? 'Item batch insert failed' }),
        }).catch(() => {});
      }
      lastFailedJobIdRef.current = dbJobId;
      setDbError(err?.message ?? 'Unknown error saving to database');
    } finally {
      setDbSaving(false);
    }
  }

  async function downloadZip() {
    if (!allCombos.length || !layers.length) return;
    setDlLoading(true);
    setError('');
    cancelledRef.current = false;
    setPhase('generating');
    setProgress(0);

    try {
      const zip         = new JSZip();
      const imgsFolder  = metaOnly ? null : zip.folder('images');
      const metaFolder  = zip.folder('metadata');
      const resolvedCid = cid.trim() || 'PLACEHOLDER_CID';

      // Build all metadata upfront (pure JS, instant)
      for (let idx = 0; idx < supply; idx++) {
        const num   = idx + 1;
        const combo = allCombos[idx];
        const attrs = layers
          .filter(l => combo[l.folder] && combo[l.folder].rel !== null)
          .map(l => ({ trait_type: l.label, value: combo[l.folder].name }));
        metaFolder!.file(`${num}.json`, JSON.stringify({
          name:       applyNameFormat(nameFormat || (collName ? `${collName} #{{id}}` : '#{{id}}'), num),
          description,
          image:      `ipfs://${resolvedCid}/${num}.${imgExt}`,
          edition:    num,
          attributes: attrs,
        }, null, 2));
      }

      // ── Image compositing ─────────────────────────────────────────────────
      if (!metaOnly && imgsFolder) {

        // Collect unique rels
        const rels = [...new Set(
          layers.flatMap((l: any) => l.assets.filter((a: any) => a.rel).map((a: any) => a.rel))
        )] as string[];

        // Pre-load ALL images as ArrayBuffers on main thread ONCE — workers get
        // raw bytes directly so they never make network requests themselves.
        const imageBuffers: Record<string, ArrayBuffer> = {};
        let imgLoaded = 0;
        setLoadMsg(`Loading images… 0 / ${rels.length}`);
        await Promise.all(rels.map(async (rel) => {
          try {
            const res = await fetch(`/api/layer-raw/${rel}`);
            if (res.ok) imageBuffers[rel] = await res.arrayBuffer();
          } catch {}
          setLoadMsg(`Loading images… ${++imgLoaded} / ${rels.length}`);
        }));

        if (cancelledRef.current) { setPhase('done'); setDlLoading(false); return; }

        const useWorkers = typeof Worker !== 'undefined';
        const numWorkers = useWorkers ? Math.min(navigator.hardwareConcurrency || 4, 8) : 0;

        if (useWorkers && numWorkers > 0) {
          // ── Web Worker pool: true multi-core parallelism ────────────────────
          setLoadMsg(`Compositing with ${numWorkers} threads…`);

          const chunkSize = Math.ceil(supply / numWorkers);
          let done = 0;
          let workersDone = 0;
          let firstError: string | null = null;

          await new Promise<void>((resolve, reject) => {
            let activeWorkers = 0;

            for (let w = 0; w < numWorkers; w++) {
              const start = w * chunkSize;
              const end   = Math.min(start + chunkSize, supply);
              if (start >= supply) continue;
              activeWorkers++;

              const worker = new Worker('/nft-export-worker.js');

              worker.onmessage = (e) => {
                if (cancelledRef.current) {
                  worker.terminate();
                  workersDone++;
                  if (workersDone >= activeWorkers) resolve();
                  return;
                }
                if (e.data.type === 'chunk') {
                  for (const { idx, buffer } of e.data.results) {
                    imgsFolder.file(`${idx + 1}.${imgExt}`, buffer, { compression: 'STORE' });
                  }
                } else if (e.data.type === 'progress') {
                  done += e.data.count;
                  setProgress(done);
                } else if (e.data.type === 'done') {
                  worker.terminate();
                  workersDone++;
                  if (workersDone >= activeWorkers) resolve();
                } else if (e.data.type === 'error') {
                  if (!firstError) firstError = e.data.message;
                  worker.terminate();
                  workersDone++;
                  if (workersDone >= activeWorkers) {
                    firstError ? reject(new Error(firstError)) : resolve();
                  }
                }
              };

              worker.onerror = (ev) => {
                if (!firstError) firstError = ev.message;
                worker.terminate();
                workersDone++;
                if (workersDone >= activeWorkers) {
                  firstError ? reject(new Error(firstError)) : resolve();
                }
              };

              worker.postMessage({
                combos: allCombos.slice(start, end),
                imageBuffers,
                layers,
                targetW,
                targetH,
                imgMime,
                startIdx: start,
              });
            }

            if (activeWorkers === 0) resolve();
          });

        } else {
          // ── Fallback: main-thread compositing (decode pre-loaded buffers) ───
          const exportBitmaps: Record<string, ImageBitmap> = {};
          await Promise.all(Object.keys(imageBuffers).map(async (rel) => {
            try {
              exportBitmaps[rel] = await createImageBitmap(new Blob([imageBuffers[rel]]));
            } catch {}
          }));

          let done = 0;
          for (let i = 0; i < supply; i += BATCH) {
            if (cancelledRef.current) break;
            const end = Math.min(i + BATCH, supply);
            await Promise.all(
              Array.from({ length: end - i }, async (_, j) => {
                const idx   = i + j;
                const combo = allCombos[idx];
                const canvas = makeCanvas(targetW, targetH);
                const ctx    = (canvas as any).getContext('2d');
                ctx.clearRect(0, 0, targetW, targetH);
                for (const layer of layers) {
                  const pick = combo[layer.folder];
                  if (!pick?.rel) continue;
                  const bm = exportBitmaps[pick.rel];
                  if (bm) ctx.drawImage(bm, 0, 0, targetW, targetH);
                }
                const blob = await canvasToBlob(canvas, imgMime);
                imgsFolder!.file(`${idx + 1}.${imgExt}`, blob, { compression: 'STORE' });
              })
            );
            done = Math.min(i + BATCH, supply);
            setProgress(done);
            await new Promise(r => setTimeout(r, 0));
          }
        }
      }

      if (cancelledRef.current) { setPhase('done'); setDlLoading(false); return; }

      // Generate ZIP
      setLoadMsg('Building ZIP…');
      const blob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } },
        ({ percent }) => setLoadMsg(`Compressing… ${Math.round(percent)}%`)
      );

      // Download
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `${(collName || 'collection').replace(/\s+/g, '_').toLowerCase()}_nfts.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e: any) {
      setError(e.message);
    }

    setPhase('done');
    setLoadMsg('');
    setDlLoading(false);
  }

  function cancel() {
    cancelledRef.current = true;
  }

  // ── Filebase helpers ──────────────────────────────────────────────────────

  async function checkBucket() {
    const name = fbBucket.trim();
    if (!name) return;
    setFbStatus('checking');
    setFbError('');
    try {
      const r = await fetch(`/api/filebase/buckets/${encodeURIComponent(name)}`);
      const d = await r.json();
      setFbStatus(d.exists ? 'exists' : 'not_found');
    } catch {
      setFbStatus('error');
      setFbError('Failed to reach Bearth-Filebase. Is it running on port 8002?');
    }
  }

  async function createBucket() {
    setFbStatus('creating');
    setFbError('');
    try {
      const r = await fetch('/api/filebase/buckets', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: fbBucket.trim() }),
      });
      if (!r.ok) { const t = await r.text(); throw new Error(t); }
      setFbStatus('created');
    } catch (e: any) {
      setFbStatus('error');
      setFbError(e.message ?? 'Create bucket failed');
    }
  }

  async function uploadImages() {
    const bucket = fbBucket.trim();
    if (!bucket || !allCombos.length) return;

    setImgPhase('preloading');
    setFbError('');
    setImgDone(0);
    setImgCids({});
    imgCidsRef.current = {};

    // Pre-load all unique layer images as ArrayBuffers once
    const rels = [...new Set(
      layers.flatMap(l => l.assets.filter(a => a.rel).map(a => a.rel))
    )];
    const imageBuffers = {};
    await Promise.all(rels.map(async (rel) => {
      try {
        const res = await fetch(`/api/layer-raw/${rel}`);
        if (res.ok) imageBuffers[rel] = await res.arrayBuffer();
      } catch {}
    }));

    // Decode bitmaps
    const bitmaps = {};
    await Promise.all(Object.keys(imageBuffers).map(async (rel) => {
      try { bitmaps[rel] = await createImageBitmap(new Blob([imageBuffers[rel]])); } catch {}
    }));

    setImgPhase('uploading');

    // Concurrency-3 composite+upload pool
    const CONCURRENCY = 3;
    let cursor = 0;

    async function runOne() {
      while (cursor < allCombos.length) {
        const idx   = cursor++;
        const num   = idx + 1;
        const combo = allCombos[idx];

        const canvas = makeCanvas(targetW, targetH);
        const ctx    = canvas.getContext('2d');
        ctx.clearRect(0, 0, targetW, targetH);
        for (const layer of layers) {
          const pick = combo[layer.folder];
          if (!pick?.rel) continue;
          const bm = bitmaps[pick.rel];
          if (bm) ctx.drawImage(bm, 0, 0, targetW, targetH);
        }
        const blob = await canvasToBlob(canvas, imgMime);

        const fd = new FormData();
        fd.append('file',   blob, `${num}.${imgExt}`);
        fd.append('bucket', bucket);
        fd.append('key',    `images/${num}.${imgExt}`);

        try {
          const r = await fetch('/api/filebase/image', { method: 'POST', body: fd });
          if (r.ok) {
            const d = await r.json();
            imgCidsRef.current[num] = d.cid || '';
            setImgCids(prev => ({ ...prev, [num]: d.cid || '' }));
          }
        } catch {}

        setImgDone(prev => prev + 1);
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, runOne));
    setImgPhase('done');
  }

  async function uploadMetadata() {
    const bucket = fbBucket.trim();
    if (!bucket || !allCombos.length) return;

    setMetaPhase('uploading');
    setFbError('');
    setMetaDone(0);
    setMetaCids({});

    const BATCH_SIZE     = 50;
    const resolvedNameFmt = nameFormat || (collName ? `${collName} #{{id}}` : '#{{id}}');

    for (let i = 0; i < supply; i += BATCH_SIZE) {
      const end   = Math.min(i + BATCH_SIZE, supply);
      const items = [];

      for (let idx = i; idx < end; idx++) {
        const num   = idx + 1;
        const combo = allCombos[idx];
        const attrs = layers
          .filter(l => combo[l.folder] && combo[l.folder].rel !== null)
          .map(l => ({ trait_type: l.label, value: combo[l.folder].name }));
        const imgCid = imgCidsRef.current[num];

        items.push({
          key:     `metadata/${num}.json`,
          content: JSON.stringify({
            name:       applyNameFormat(resolvedNameFmt, num),
            description,
            image:      imgCid ? `ipfs://${imgCid}` : `ipfs://PLACEHOLDER_CID/${num}.${imgExt}`,
            edition:    num,
            attributes: attrs,
          }, null, 2),
        });
      }

      try {
        const r = await fetch('/api/filebase/metadata', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ bucket, items }),
        });
        if (r.ok) {
          const results = await r.json();
          const update  = {};
          results.forEach(({ key, cid }) => {
            const n = parseInt(key.split('/').pop().replace('.json', ''), 10);
            if (!isNaN(n)) update[n] = cid || '';
          });
          setMetaCids(prev => ({ ...prev, ...update }));
        }
      } catch {}

      setMetaDone(prev => prev + items.length);
    }

    setMetaPhase('done');
  }

  const pct = supply > 0 ? Math.min((progress / supply) * 100, 100) : 0;

  // ── Idle / settings ─────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="export-page">
        <div className="export-card">
          <div className="export-title">Export Collection</div>
          <div className="export-sub">Generate all {supply.toLocaleString()} NFTs and download as ZIP</div>

          <div className="export-section">
            <div className="export-section-title">Collection Summary</div>
            <div className="export-info-grid">
              <div className="export-info-item"><span className="export-info-label">Name</span><span className="export-info-val">{collName || '—'}</span></div>
              <div className="export-info-item"><span className="export-info-label">Supply</span><span className="export-info-val">{supply.toLocaleString()}</span></div>
              <div className="export-info-item"><span className="export-info-label">Blockchain</span><span className="export-info-val" style={{textTransform:'capitalize'}}>{collection?.blockchain || '—'}</span></div>
              <div className="export-info-item"><span className="export-info-label">Format</span><span className="export-info-val">{imgExt.toUpperCase()}</span></div>
              <div className="export-info-item"><span className="export-info-label">Resolution</span><span className="export-info-val">{targetW}×{targetH}px</span></div>
            </div>
          </div>

          <div className="export-section">
            <div className="export-section-title">IPFS CID <span style={{fontWeight:400,fontSize:11,color:'var(--dim)'}}>(optional — set after uploading images to IPFS)</span></div>
            <div className="export-field">
              <input
                placeholder="ipfs://Qm... or leave blank for placeholder"
                value={cid}
                onChange={e => setCid(e.target.value)}
              />
              <span className="field-hint">Image URLs in metadata will be: ipfs://YOUR_CID/1.{imgExt}</span>
            </div>
          </div>

          <div className="export-section">
            <div className="export-section-title">Options</div>
            <label className="export-check">
              <input type="checkbox" checked={metaOnly} onChange={e => setMetaOnly(e.target.checked)} />
              <span>Export metadata JSON only (skip image compositing)</span>
            </label>
          </div>

          {error && <div className="export-error">❌ {error}</div>}

          <div className="export-actions">
            <button className="btn btn-primary btn-lg" onClick={generate}>
              ⚡ Generate {supply.toLocaleString()} NFTs
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Preload / combo phase ────────────────────────────────────────────────────
  if (phase === 'preload' || phase === 'combos') {
    return (
      <div className="export-page">
        <div className="export-card">
          <div className="export-title">Preparing…</div>
          <div className="loading" style={{margin:'30px auto'}}><div className="spinner" /></div>
          <div style={{textAlign:'center', color:'var(--dim)', fontSize:13}}>{loadMsg}</div>
        </div>
      </div>
    );
  }

  // ── Generating ZIP ───────────────────────────────────────────────────────────
  if (phase === 'generating') {
    return (
      <div className="export-page">
        <div className="export-card">
          <div className="export-title">{metaOnly ? 'Generating metadata…' : 'Compositing NFTs…'}</div>
          <div className="export-sub">{loadMsg || `${progress.toLocaleString()} / ${supply.toLocaleString()} NFTs`}</div>
          <div className="export-gen-progress">
            <div className="prog-bg" style={{marginBottom:10}}>
              <div className="prog-fill" style={{ width: `${pct.toFixed(1)}%` }} />
            </div>
            <div className="prog-text">{progress.toLocaleString()} / {supply.toLocaleString()}</div>
            <div style={{fontSize:12, color:'var(--xdim)', marginTop:4}}>{pct.toFixed(1)}% complete</div>
          </div>
          <div style={{textAlign:'center', marginTop:16}}>
            <button className="btn btn-ghost" onClick={cancel}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Done: rarity grid + download ─────────────────────────────────────────────
  return (
    <div className="export-page">
      <div className="export-card export-card-wide">
        <div className="export-title">
          {supply.toLocaleString()} NFTs ready
        </div>

        {/* ── Controls bar ── */}
        <div className="exp-done-bar">
          <div className="exp-sort-row">
            <span style={{fontSize:12, color:'var(--dim)'}}>Sort by:</span>
            <button
              className={`exp-sort-btn${sortBy==='rarity'?' exp-sort-active':''}`}
              onClick={() => { setSortBy('rarity'); setRarityItems(prev => [...prev].sort((a, b) => a.rank - b.rank)); }}
            >🏆 Rarity</button>
            <button
              className={`exp-sort-btn${sortBy==='id'?' exp-sort-active':''}`}
              onClick={() => {
                setSortBy('id');
                setRarityItems(prev => [...prev].sort((a, b) => a.index - b.index));
              }}
            ># ID</button>
          </div>

          <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <label className="export-check" style={{margin:0}}>
              <input type="checkbox" checked={metaOnly} onChange={e => setMetaOnly(e.target.checked)} />
              <span style={{fontSize:12}}>Metadata only</span>
            </label>
            <input
              style={{background:'var(--bg0)', border:'1px solid var(--border)', color:'var(--text)', padding:'5px 10px', borderRadius:7, fontSize:12, width:200}}
              placeholder="IPFS CID (optional)"
              value={cid}
              onChange={e => setCid(e.target.value)}
            />
            <button className="btn btn-primary" onClick={downloadZip} disabled={dlLoading}>
              {dlLoading ? `${loadMsg || 'Generating…'}` : `⬇ Download ZIP`}
            </button>
            {dlLoading && (
              <>
                <div className="prog-bg" style={{width:120, margin:0}}>
                  <div className="prog-fill" style={{width:`${pct.toFixed(0)}%`}} />
                </div>
                <button className="btn btn-ghost" onClick={cancel}>Cancel</button>
              </>
            )}
            <button className="btn btn-ghost" onClick={() => { setPhase('idle'); setRarityItems([]); setAllCombos([]); }}>
              ↺ Regenerate
            </button>
          </div>
        </div>

        {error && <div className="export-error">❌ {error}</div>}

        {/* ── DB save status ── */}
        {dbSaving && (
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:8, fontSize:13, background:'rgba(65,175,235,0.08)', border:'1px solid rgba(65,175,235,0.25)', color:'#41afeb', marginBottom:8 }}>
            <svg className="w-4 h-4 animate-spin" style={{width:16,height:16,flexShrink:0}} fill="none" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity={0.25}/>
              <path fill="currentColor" opacity={0.75} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            Saving {rarityItems.length.toLocaleString()} items to database…
          </div>
        )}
        {dbError && !dbSaving && (
          <div style={{ padding:'10px 14px', borderRadius:8, fontSize:13, background:'#fff1f1', border:'1px solid #fca5a5', color:'#dc2626', marginBottom:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <svg style={{width:16,height:16,flexShrink:0}} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
              </svg>
              <span style={{flex:1}}>Failed to save to database: {dbError}</span>
              <button
                onClick={() => persistToDb(rarityItems)}
                style={{ flexShrink:0, padding:'4px 14px', borderRadius:6, border:'1.5px solid #dc2626', background:'#dc2626', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background='#b91c1c'; }}
                onMouseLeave={e => { e.currentTarget.style.background='#dc2626'; }}
              >
                ↺ Retry Save
              </button>
            </div>
            <div style={{ marginTop:6, fontSize:12, color:'#7f1d1d', lineHeight:1.5 }}>
              Your {rarityItems.length.toLocaleString()} generated NFTs are still in memory. You can{' '}
              <button
                onClick={downloadZip}
                style={{ background:'none', border:'none', color:'#dc2626', fontWeight:700, textDecoration:'underline', cursor:'pointer', padding:0, fontSize:12 }}
              >
                Download ZIP
              </button>{' '}
              at any time. When the server recovers, click Retry Save to persist to the database.
            </div>
          </div>
        )}
        {dbSaved && (
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, fontSize:12, background:'rgba(22,163,74,0.08)', border:'1px solid rgba(22,163,74,0.25)', color:'#16a34a', marginBottom:8 }}>
            <svg style={{width:14,height:14,flexShrink:0}} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/>
            </svg>
            {rarityItems.length.toLocaleString()} items saved to database
          </div>
        )}

        {/* ── Tier legend ── */}
        <div style={{display:'flex', gap:16, padding:'8px 0', fontSize:11, color:'var(--dim)'}}>
          {[
            {label:'Legendary', sub:'top 1%',  color:'#F59E0B'},
            {label:'Epic',      sub:'top 5%',  color:'#A855F7'},
            {label:'Rare',      sub:'top 15%', color:'#3B82F6'},
            {label:'Common',    sub:'rest',     color:'#6B7280'},
          ].map(t => (
            <span key={t.label} style={{display:'flex', alignItems:'center', gap:4}}>
              <span style={{width:8, height:8, borderRadius:'50%', background:t.color, display:'inline-block'}} />
              <span style={{color:t.color, fontWeight:600}}>{t.label}</span>
              <span style={{color:'var(--dim)'}}>({t.sub})</span>
            </span>
          ))}
        </div>

        {/* ── NFT grid — all items, lazy-rendered via IntersectionObserver ── */}
        <div className="exp-nft-grid">
          {rarityItems.map(item => (
            <RarityCard
              key={item.index}
              item={item}
              jobBitmaps={jobBitmaps}
              layers={layers}
              canvasW={tW}
              canvasH={tH}
              onClick={setPopup}
            />
          ))}
        </div>
      </div>

      {/* ── Push to Filebase IPFS ──────────────────────────────────────────── */}
      <div className="export-card export-card-wide" style={{marginTop:16}}>
        <div className="export-title" style={{fontSize:18}}>Push to Filebase IPFS</div>

        {/* Bucket input + check/create */}
        <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:12, flexWrap:'wrap'}}>
          <input
            style={{background:'var(--bg0)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 12px', borderRadius:7, fontSize:13, minWidth:220}}
            placeholder="Filebase bucket name"
            value={fbBucket}
            onChange={e => { setFbBucket(e.target.value); setFbStatus('idle'); }}
          />
          <button className="btn btn-ghost" onClick={checkBucket}
            disabled={!fbBucket.trim() || fbStatus === 'checking'}>
            {fbStatus === 'checking' ? 'Checking…' : 'Check Bucket'}
          </button>
          {fbStatus === 'not_found' && (
            <button className="btn btn-primary" onClick={createBucket} disabled={fbStatus === 'creating'}>
              + Create Bucket
            </button>
          )}
          {fbStatus === 'creating' && <span style={{fontSize:12, color:'var(--dim)'}}>Creating…</span>}
          {(fbStatus === 'exists' || fbStatus === 'created') && (
            <span style={{fontSize:12, color:'#16a34a', fontWeight:600}}>✓ Bucket ready</span>
          )}
          {fbStatus === 'not_found' && (
            <span style={{fontSize:12, color:'#d97706'}}>Bucket not found — create it first</span>
          )}
        </div>

        {fbError && <div className="export-error" style={{marginBottom:12}}>❌ {fbError}</div>}

        {/* Step 1 — Upload Images */}
        <div style={{padding:12, background:'var(--bg0)', borderRadius:8, border:'1px solid var(--border)', marginBottom:10}}>
          <div style={{fontWeight:600, fontSize:13, marginBottom:8}}>Step 1 — Upload Images</div>
          <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <button
              className="btn btn-primary"
              onClick={uploadImages}
              disabled={!['exists','created'].includes(fbStatus) || imgPhase === 'preloading' || imgPhase === 'uploading'}
            >
              {imgPhase === 'preloading' ? 'Preloading images…'
               : imgPhase === 'uploading' ? `Uploading… ${imgDone.toLocaleString()} / ${supply.toLocaleString()}`
               : imgPhase === 'done'      ? '✓ Images Uploaded'
               : '⬆ Upload Images'}
            </button>
            {(imgPhase === 'uploading' || imgPhase === 'done') && (
              <span style={{fontSize:12, color:'var(--dim)'}}>
                {imgDone.toLocaleString()} / {supply.toLocaleString()}
              </span>
            )}
          </div>
          {imgPhase !== 'idle' && (
            <div className="prog-bg" style={{marginTop:8}}>
              <div className="prog-fill" style={{width:`${supply > 0 ? Math.min((imgDone/supply)*100,100).toFixed(0) : 0}%`}} />
            </div>
          )}
        </div>

        {/* Step 2 — Upload Metadata */}
        <div style={{padding:12, background:'var(--bg0)', borderRadius:8, border:'1px solid var(--border)', marginBottom:10}}>
          <div style={{fontWeight:600, fontSize:13, marginBottom:8}}>Step 2 — Upload Metadata</div>
          <div style={{display:'flex', gap:8, alignItems:'center', flexWrap:'wrap'}}>
            <button
              className="btn btn-primary"
              onClick={uploadMetadata}
              disabled={imgPhase !== 'done' || metaPhase === 'uploading'}
            >
              {metaPhase === 'uploading' ? `Uploading… ${metaDone.toLocaleString()} / ${supply.toLocaleString()}`
               : metaPhase === 'done'    ? '✓ Metadata Uploaded'
               : '⬆ Upload Metadata'}
            </button>
            {imgPhase !== 'done' && metaPhase === 'idle' && (
              <span style={{fontSize:12, color:'var(--dim)'}}>Complete Step 1 first</span>
            )}
            {(metaPhase === 'uploading' || metaPhase === 'done') && (
              <span style={{fontSize:12, color:'var(--dim)'}}>
                {metaDone.toLocaleString()} / {supply.toLocaleString()}
              </span>
            )}
          </div>
          {metaPhase !== 'idle' && (
            <div className="prog-bg" style={{marginTop:8}}>
              <div className="prog-fill" style={{width:`${supply > 0 ? Math.min((metaDone/supply)*100,100).toFixed(0) : 0}%`}} />
            </div>
          )}
        </div>

        {/* CID Summary — only visible after metadata done */}
        {metaPhase === 'done' && (
          <div>
            <div style={{display:'flex', gap:8, alignItems:'center', marginBottom:10, flexWrap:'wrap'}}>
              <span style={{fontWeight:600, fontSize:14}}>CID Summary</span>
              <button className="btn btn-ghost" style={{fontSize:11, padding:'3px 10px'}}
                onClick={() => setShowCids(v => !v)}>
                {showCids ? '▲ Hide Table' : '▼ Show CID Table'}
              </button>
              <button className="btn btn-ghost" style={{fontSize:11, padding:'3px 10px'}}
                onClick={() => {
                  const keys = Object.keys(imgCids).sort((a,b) => Number(a)-Number(b));
                  const lines = keys.map(n => `${n}\t${imgCids[n]}\t${metaCids[n] || ''}`).join('\n');
                  navigator.clipboard?.writeText(`#\tImage CID\tMetadata CID\n${lines}`);
                }}>
                📋 Copy All CIDs
              </button>
            </div>

            <div style={{display:'flex', gap:12, marginBottom:12, flexWrap:'wrap'}}>
              {[
                { label:'Images Uploaded',   val: Object.keys(imgCids).length  },
                { label:'Metadata Uploaded',  val: Object.keys(metaCids).length },
              ].map(s => (
                <div key={s.label} style={{padding:'8px 14px', background:'var(--bg0)', borderRadius:7, border:'1px solid var(--border)'}}>
                  <div style={{fontSize:11, color:'var(--dim)'}}>{s.label}</div>
                  <div style={{fontSize:22, fontWeight:700, color:'#41afeb'}}>{s.val.toLocaleString()}</div>
                </div>
              ))}
              <div style={{padding:'8px 14px', background:'var(--bg0)', borderRadius:7, border:'1px solid var(--border)'}}>
                <div style={{fontSize:11, color:'var(--dim)'}}>Bucket</div>
                <div style={{fontSize:14, fontWeight:700, color:'var(--text)'}}>{fbBucket}</div>
              </div>
            </div>

            {showCids && (
              <div style={{overflowX:'auto', maxHeight:400, overflowY:'auto', border:'1px solid var(--border)', borderRadius:7}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:11}}>
                  <thead style={{position:'sticky', top:0, background:'var(--bg1)'}}>
                    <tr>
                      {['#','Image CID','Metadata CID'].map(h => (
                        <th key={h} style={{padding:'6px 10px', textAlign:'left', color:'var(--dim)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap'}}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(imgCids).sort((a,b)=>Number(a)-Number(b)).map(n => (
                      <tr key={n} style={{borderBottom:'1px solid var(--border)'}}>
                        <td style={{padding:'4px 10px', color:'var(--dim)'}}>{n}</td>
                        <td style={{padding:'4px 10px', fontFamily:'monospace', maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {imgCids[n] || '—'}
                        </td>
                        <td style={{padding:'4px 10px', fontFamily:'monospace', maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                          {metaCids[n] || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {popup && <NftPopup item={{...popup, total: supply}} onClose={() => setPopup(null)} />}
    </div>
  );
}
