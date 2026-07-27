// @ts-nocheck
'use client';
import { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { generateAllCombos, computeRarity, applyNameFormat } from '../../../../lib/studio/combos';
import NftPopup from './NftPopup';

const BATCH = 64;

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

const TIER_META = [
  { label: 'Legendary', sub: 'top 1%',  color: '#F59E0B', bg: '#FEF3C7' },
  { label: 'Epic',      sub: 'top 5%',  color: '#A855F7', bg: '#F5F3FF' },
  { label: 'Rare',      sub: 'top 15%', color: '#3B82F6', bg: '#EFF6FF' },
  { label: 'Common',    sub: 'rest',    color: '#6B7280', bg: '#F3F4F6' },
];
const TIER_COLOR: Record<string, string> = Object.fromEntries(TIER_META.map(t => [t.label, t.color]));

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'studio-spin .75s linear infinite', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="4" opacity={0.2} />
      <path fill={color} opacity={0.8} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Check icon ────────────────────────────────────────────────────────────────
function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

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
    onClick({ index: item.index, src, attrs: item.attrs, rank: item.rank, score: item.score, tier: item.tier });
    setOpen(true);
  }

  return (
    <div ref={cardRef} className={`exp-nft-card${open ? ' exp-nft-open' : ''}`} onClick={handleClick}>
      <div className="exp-nft-thumb">
        <canvas ref={canvasRef} width={canvasW} height={canvasH} />
        <div className="exp-nft-rank" style={{ color: tierColor }}>#{item.rank}</div>
        <div className="exp-nft-tier-chip" style={{ background: tierColor }}>
          {item.tier}
        </div>
      </div>
      <div className="exp-nft-info">
        <div className="exp-nft-name">#{item.index}</div>
        <div className="exp-nft-score" style={{ color: tierColor }}>
          Score {item.score}
        </div>
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="exp-progress-track">
      <div className="exp-progress-fill" style={{ width: `${pct.toFixed(1)}%`, background: color }} />
    </div>
  );
}

// ── Step card for IPFS ────────────────────────────────────────────────────────
function StepCard({ num, title, status, children }) {
  const isDone = status === 'done';
  return (
    <div className={`exp-step-card${isDone ? ' exp-step-done' : ''}`}>
      <div className="exp-step-head">
        <div className={`exp-step-num${isDone ? ' exp-step-num-done' : ''}`}>
          {isDone ? <CheckIcon size={12} /> : num}
        </div>
        <span className="exp-step-label">{title}</span>
        {isDone && <span className="exp-step-done-badge">Complete</span>}
      </div>
      {children}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
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
  const defaultExternalUrl = collection?.externalUrl ?? '';

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

  const [externalUrlBase, setExternalUrlBase] = useState(defaultExternalUrl);

  const [fbBucket,  setFbBucket]  = useState('');
  const [fbStatus,  setFbStatus]  = useState('idle');
  const [imgPhase,  setImgPhase]  = useState('idle');
  const [imgDone,   setImgDone]   = useState(0);
  const [imgCids,   setImgCids]   = useState({});
  const [metaPhase, setMetaPhase] = useState('idle');
  const [metaDone,  setMetaDone]  = useState(0);
  const [metaCids,  setMetaCids]  = useState({});
  const [showCids,  setShowCids]  = useState(false);
  const [fbError,   setFbError]   = useState('');
  const imgCidsRef = useRef({});

  const [rarityItems, setRarityItems] = useState<any[]>([]);
  const [allCombos,   setAllCombos]   = useState<any[]>([]);
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

    let layerData: any[] = layersProp.length ? layersProp : layers;
    if (!layerData.length) {
      try { const r = await fetch('/api/layers'); layerData = await r.json(); } catch {}
    }
    if (!layerData.length) {
      setError('No layers found. Upload assets in the Settings tab first.');
      setPhase('idle');
      return;
    }
    setLayers(layerData);

    const rels = [...new Set(
      layerData.flatMap((l: any) => l.assets.filter((a: any) => a.rel).map((a: any) => a.rel))
    )] as string[];

    let loaded = 0;
    setLoadMsg(`Loading ${rels.length} layer images…`);

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

    setPhase('combos');
    setLoadMsg('Generating trait combinations…');
    await new Promise(r => setTimeout(r, 0));

    const combos = generateAllCombos(supply, layerData, weights, conflicts);
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

  async function persistToDb(items: any[]) {
    if (!collectionId || !items.length) return;
    setDbSaving(true);
    setDbSaved(false);
    setDbError('');
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
      const zip        = new JSZip();
      const imgsFolder = metaOnly ? null : zip.folder('images');
      const metaFolder = zip.folder('metadata');
      const resolvedCid = cid.trim() || 'PLACEHOLDER_CID';

      for (let idx = 0; idx < supply; idx++) {
        const num   = idx + 1;
        const combo = allCombos[idx];
        const attrs = layers
          .filter(l => combo[l.folder] && combo[l.folder].rel !== null)
          .map(l => ({ trait_type: l.label, value: combo[l.folder].name }));
        metaFolder!.file(`${num}.json`, JSON.stringify({
          name:         applyNameFormat(nameFormat || (collName ? `${collName} #{{id}}` : '#{{id}}'), num),
          description,
          image:        `ipfs://${resolvedCid}/${num}.${imgExt}`,
          edition:      num,
          ...(externalUrlBase.trim() ? { external_url: `${externalUrlBase.trim().replace(/\/$/, '')}/${num}` } : {}),
          attributes:   attrs,
        }, null, 2));
      }

      if (!metaOnly && imgsFolder) {
        const rels = [...new Set(
          layers.flatMap((l: any) => l.assets.filter((a: any) => a.rel).map((a: any) => a.rel))
        )] as string[];

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
          setLoadMsg(`Compositing with ${numWorkers} threads…`);
          const chunkSize = Math.ceil(supply / numWorkers);
          let done = 0, workersDone = 0;
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
                if (cancelledRef.current) { worker.terminate(); workersDone++; if (workersDone >= activeWorkers) resolve(); return; }
                if (e.data.type === 'chunk') {
                  for (const { idx, buffer } of e.data.results) imgsFolder.file(`${idx + 1}.${imgExt}`, buffer, { compression: 'STORE' });
                } else if (e.data.type === 'progress') {
                  done += e.data.count; setProgress(done);
                } else if (e.data.type === 'done') {
                  worker.terminate(); workersDone++; if (workersDone >= activeWorkers) resolve();
                } else if (e.data.type === 'error') {
                  if (!firstError) firstError = e.data.message;
                  worker.terminate(); workersDone++;
                  if (workersDone >= activeWorkers) { firstError ? reject(new Error(firstError)) : resolve(); }
                }
              };
              worker.onerror = (ev) => {
                if (!firstError) firstError = ev.message;
                worker.terminate(); workersDone++;
                if (workersDone >= activeWorkers) { firstError ? reject(new Error(firstError)) : resolve(); }
              };
              worker.postMessage({ combos: allCombos.slice(start, end), imageBuffers, layers, targetW, targetH, imgMime, startIdx: start });
            }
            if (activeWorkers === 0) resolve();
          });
        } else {
          const exportBitmaps: Record<string, ImageBitmap> = {};
          await Promise.all(Object.keys(imageBuffers).map(async (rel) => {
            try { exportBitmaps[rel] = await createImageBitmap(new Blob([imageBuffers[rel]])); } catch {}
          }));
          let done = 0;
          for (let i = 0; i < supply; i += BATCH) {
            if (cancelledRef.current) break;
            const end = Math.min(i + BATCH, supply);
            await Promise.all(Array.from({ length: end - i }, async (_, j) => {
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
            }));
            done = Math.min(i + BATCH, supply);
            setProgress(done);
            await new Promise(r => setTimeout(r, 0));
          }
        }
      }

      if (cancelledRef.current) { setPhase('done'); setDlLoading(false); return; }

      setLoadMsg('Building ZIP…');
      const blob = await zip.generateAsync(
        { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 1 } },
        ({ percent }) => setLoadMsg(`Compressing… ${Math.round(percent)}%`)
      );
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url;
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

  function cancel() { cancelledRef.current = true; }

  // ── Filebase helpers ──────────────────────────────────────────────────────────
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
      setFbError('Failed to reach the API. Is BearthApi running on port 8000?');
    }
  }

  async function createBucket() {
    setFbStatus('creating');
    setFbError('');
    try {
      const r = await fetch('/api/filebase/buckets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fbBucket.trim() }),
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

    const rels = [...new Set(layers.flatMap(l => l.assets.filter(a => a.rel).map(a => a.rel)))];
    const imageBuffers = {};
    await Promise.all(rels.map(async (rel) => {
      try { const res = await fetch(`/api/layer-raw/${rel}`); if (res.ok) imageBuffers[rel] = await res.arrayBuffer(); } catch {}
    }));
    const bitmaps = {};
    await Promise.all(Object.keys(imageBuffers).map(async (rel) => {
      try { bitmaps[rel] = await createImageBitmap(new Blob([imageBuffers[rel]])); } catch {}
    }));

    setImgPhase('uploading');
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
        fd.append('file', blob, `${num}.${imgExt}`);
        fd.append('bucket', bucket);
        fd.append('key', `images/${num}.${imgExt}`);
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

  async function clearUploads() {
    const bucket = fbBucket.trim();
    if (!bucket) return;
    if (!confirm(`Delete ALL uploaded files from bucket "${bucket}"? This cannot be undone.`)) return;
    setFbError('');
    try {
      // List everything with images/ and metadata/ prefix
      const [imgList, metaList] = await Promise.all([
        fetch(`/api/filebase/objects?bucket=${encodeURIComponent(bucket)}&prefix=images/`).then(r => r.json()),
        fetch(`/api/filebase/objects?bucket=${encodeURIComponent(bucket)}&prefix=metadata/`).then(r => r.json()),
      ]);
      const keys = [
        ...(imgList.objects ?? []).map((o: any) => o.key),
        ...(metaList.objects ?? []).map((o: any) => o.key),
      ].filter(Boolean);

      if (!keys.length) { alert('No files found in bucket to delete.'); return; }

      const r = await fetch('/api/filebase/objects/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket, keys }),
      });
      const d = await r.json();
      if (r.ok) {
        setImgPhase('idle');
        setImgDone(0);
        setImgCids({});
        setMetaPhase('idle');
        setMetaDone(0);
        setMetaCids({});
        imgCidsRef.current = {};
        alert(`Deleted ${d.deleted} files from bucket "${bucket}".`);
      } else {
        setFbError(d.error ?? 'Delete failed');
      }
    } catch (e: any) {
      setFbError(e.message ?? 'Delete failed');
    }
  }

  async function uploadMetadata() {
    const bucket = fbBucket.trim();
    if (!bucket || !allCombos.length) return;
    setMetaPhase('uploading');
    setFbError('');
    setMetaDone(0);
    setMetaCids({});
    const BATCH_SIZE = 50;
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
            name:         applyNameFormat(resolvedNameFmt, num),
            description,
            image:        imgCid ? `ipfs://${imgCid}` : `ipfs://PLACEHOLDER_CID/${num}.${imgExt}`,
            edition:      num,
            ...(externalUrlBase.trim() ? { external_url: `${externalUrlBase.trim().replace(/\/$/, '')}/${num}` } : {}),
            attributes:   attrs,
          }, null, 2),
        });
      }
      try {
        const r = await fetch('/api/filebase/metadata', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucket, items }),
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
  const bucketReady = fbStatus === 'exists' || fbStatus === 'created';

  // ── Idle ─────────────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div className="export-page">
        <div className="exp-idle-card">
          {/* Header */}
          <div className="exp-idle-header">
            <div>
              <div className="exp-idle-title">Export Collection</div>
              <div className="exp-idle-sub">Generate all {supply.toLocaleString()} NFTs — composite images, rarity scores, and metadata</div>
            </div>
          </div>

          {/* Collection summary */}
          <div className="exp-section">
            <div className="exp-section-label">Collection Summary</div>
            <div className="exp-summary-grid">
              {[
                { label: 'Name',       value: collName        || '—' },
                { label: 'Supply',     value: supply.toLocaleString() },
                { label: 'Blockchain', value: collection?.blockchain || '—' },
                { label: 'Format',     value: imgExt.toUpperCase() },
                { label: 'Resolution', value: `${targetW}×${targetH}` },
              ].map(item => (
                <div key={item.label} className="exp-summary-stat">
                  <div className="exp-summary-stat-label">{item.label}</div>
                  <div className="exp-summary-stat-val">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CID + Options */}
          <div className="exp-idle-options">
            <div className="exp-idle-option-card">
              <div className="exp-option-label">IPFS CID <span className="exp-option-hint">(optional — paste after uploading images)</span></div>
              <input
                className="exp-text-input"
                placeholder="ipfs://Qm…  or leave blank"
                value={cid}
                onChange={e => setCid(e.target.value)}
              />
              <div className="exp-option-sub">Image URLs in metadata: <code>ipfs://YOUR_CID/1.{imgExt}</code></div>
            </div>
            <div className="exp-idle-option-card">
              <div className="exp-option-label">Website URL <span className="exp-option-hint">(optional — OpenSea "View on Website" link)</span></div>
              <input
                className="exp-text-input"
                placeholder="https://bearth.io/nft"
                value={externalUrlBase}
                onChange={e => setExternalUrlBase(e.target.value)}
              />
              <div className="exp-option-sub">Each NFT gets: <code>{externalUrlBase.trim() ? `${externalUrlBase.trim().replace(/\/$/, '')}/1` : 'https://bearth.io/nft/1'}</code></div>
            </div>
            <div className="exp-idle-option-card">
              <div className="exp-option-label">Options</div>
              <label className="exp-checkbox-row">
                <input type="checkbox" checked={metaOnly} onChange={e => setMetaOnly(e.target.checked)} />
                <span>Metadata only <span className="exp-option-hint">(skip image compositing)</span></span>
              </label>
            </div>
          </div>

          {error && <div className="exp-error-banner">{error}</div>}

          <div className="exp-idle-actions">
            <button className="btn btn-primary btn-lg" onClick={generate}>
              ⚡ Generate {supply.toLocaleString()} NFTs
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Preload / Combos ──────────────────────────────────────────────────────────
  if (phase === 'preload' || phase === 'combos') {
    return (
      <div className="export-page">
        <div className="exp-loading-card">
          <Spinner size={32} color="var(--accent)" />
          <div className="exp-loading-title">{phase === 'combos' ? 'Generating combinations…' : 'Preparing…'}</div>
          <div className="exp-loading-msg">{loadMsg}</div>
        </div>
      </div>
    );
  }

  // ── Generating ZIP ────────────────────────────────────────────────────────────
  if (phase === 'generating') {
    return (
      <div className="export-page">
        <div className="exp-loading-card">
          <div className="exp-gen-title">{metaOnly ? 'Generating metadata…' : 'Compositing NFTs…'}</div>
          <div className="exp-gen-sub">{loadMsg || `${progress.toLocaleString()} / ${supply.toLocaleString()} NFTs`}</div>
          <div className="exp-gen-progress-wrap">
            <ProgressBar value={progress} max={supply} />
            <div className="exp-gen-pct">{pct.toFixed(1)}%</div>
          </div>
          <button className="btn btn-ghost" onClick={cancel} style={{ marginTop: 8 }}>Cancel</button>
        </div>
      </div>
    );
  }

  // ── Done ──────────────────────────────────────────────────────────────────────
  return (
    <div className="export-page">
      <div className="export-card export-card-wide">

        {/* ── Top bar ── */}
        <div className="exp-top-bar">
          <div className="exp-top-left">
            <div className="exp-ready-badge">{supply.toLocaleString()} NFTs Ready</div>
            <div className="exp-sort-group">
              <button
                className={`exp-sort-btn${sortBy === 'rarity' ? ' exp-sort-active' : ''}`}
                onClick={() => { setSortBy('rarity'); setRarityItems(prev => [...prev].sort((a, b) => a.rank - b.rank)); }}
              >🏆 Rarity</button>
              <button
                className={`exp-sort-btn${sortBy === 'id' ? ' exp-sort-active' : ''}`}
                onClick={() => { setSortBy('id'); setRarityItems(prev => [...prev].sort((a, b) => a.index - b.index)); }}
              ># ID</button>
            </div>
          </div>

          <div className="exp-top-right">
            <label className="exp-checkbox-row exp-checkbox-sm">
              <input type="checkbox" checked={metaOnly} onChange={e => setMetaOnly(e.target.checked)} />
              <span>Metadata only</span>
            </label>
            <input
              className="exp-cid-input"
              placeholder="IPFS CID (optional)"
              value={cid}
              onChange={e => setCid(e.target.value)}
            />
            <button className="btn btn-primary" onClick={downloadZip} disabled={dlLoading}>
              {dlLoading ? loadMsg || 'Generating…' : '⬇ Download ZIP'}
            </button>
            {dlLoading && (
              <button className="btn btn-ghost" onClick={cancel}>Cancel</button>
            )}
            <button className="btn btn-ghost" onClick={() => { setPhase('idle'); setRarityItems([]); setAllCombos([]); }}>
              ↺ Regenerate
            </button>
          </div>
        </div>

        {/* ZIP progress (while downloading) */}
        {dlLoading && (
          <div className="exp-dl-progress">
            <ProgressBar value={progress} max={supply} />
            <div className="exp-dl-pct">{pct.toFixed(0)}%&ensp;{loadMsg}</div>
          </div>
        )}

        {error && <div className="exp-error-banner" style={{ marginBottom: 10 }}>{error}</div>}

        {/* ── DB save status ── */}
        {dbSaving && (
          <div className="exp-banner exp-banner-saving">
            <Spinner size={15} color="#41afeb" />
            <span>Saving {rarityItems.length.toLocaleString()} items to database…</span>
          </div>
        )}
        {dbSaved && !dbSaving && (
          <div className="exp-banner exp-banner-saved">
            <CheckIcon size={15} />
            <span>{rarityItems.length.toLocaleString()} items saved to database</span>
          </div>
        )}
        {dbError && !dbSaving && (
          <div className="exp-banner exp-banner-error">
            <div className="exp-banner-error-body">
              <div className="exp-banner-error-msg">Failed to save to database: {dbError}</div>
              <div className="exp-banner-error-sub">
                Your {rarityItems.length.toLocaleString()} generated NFTs are still in memory. You can{' '}
                <button className="exp-inline-btn" onClick={downloadZip}>Download ZIP</button>{' '}
                at any time. When the server recovers, click Retry to persist.
              </div>
            </div>
            <button className="exp-retry-btn" onClick={() => persistToDb(rarityItems)}>↺ Retry</button>
          </div>
        )}

        {/* ── Tier legend ── */}
        <div className="exp-tier-legend">
          {TIER_META.map(t => (
            <div key={t.label} className="exp-tier-pill" style={{ borderColor: `${t.color}33` }}>
              <span className="exp-tier-dot" style={{ background: t.color }} />
              <span style={{ color: t.color, fontWeight: 700 }}>{t.label}</span>
              <span className="exp-tier-pill-sub">{t.sub}</span>
            </div>
          ))}
        </div>

        {/* ── NFT grid ── */}
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

      {/* ── Push to Filebase IPFS ── */}
      <div className="exp-fb-card">
        <div className="exp-fb-header">
          <div className="exp-fb-title">Push to Filebase IPFS</div>
          <div className="exp-fb-sub">Upload all images and metadata to IPFS via Filebase for on-chain use</div>
        </div>

        {/* Bucket row */}
        <div className="exp-fb-bucket-row">
          <input
            className="exp-fb-input"
            placeholder="Filebase bucket name"
            value={fbBucket}
            onChange={e => { setFbBucket(e.target.value); setFbStatus('idle'); }}
          />
          <button
            className="btn btn-ghost"
            onClick={checkBucket}
            disabled={!fbBucket.trim() || fbStatus === 'checking'}
          >
            {fbStatus === 'checking' ? <><Spinner size={13} />&ensp;Checking…</> : 'Check Bucket'}
          </button>
          {fbStatus === 'not_found' && (
            <button className="btn btn-primary" onClick={createBucket} disabled={fbStatus === 'creating'}>
              + Create Bucket
            </button>
          )}
          {fbStatus === 'creating' && <span className="exp-fb-status-info"><Spinner size={13} />&ensp;Creating…</span>}
          {bucketReady && (
            <span className="exp-fb-status-ok"><CheckIcon size={14} /> Bucket ready</span>
          )}
          {fbStatus === 'not_found' && (
            <span className="exp-fb-status-warn">Bucket not found — create it first</span>
          )}
        </div>

        {fbError && <div className="exp-error-banner" style={{ marginBottom: 14 }}>{fbError}</div>}

        {/* Step cards */}
        <div className="exp-step-grid">
          {/* Step 1 — Images */}
          <StepCard num={1} title="Upload Images" status={imgPhase}>
            <button
              className="btn btn-primary"
              onClick={uploadImages}
              disabled={!bucketReady || imgPhase === 'preloading' || imgPhase === 'uploading'}
              style={{ width: '100%', marginBottom: 10, justifyContent: 'center' }}
            >
              {imgPhase === 'preloading' ? <><Spinner size={13} color="#fff" />&ensp;Preloading images…</>
               : imgPhase === 'uploading' ? <><Spinner size={13} color="#fff" />&ensp;Uploading {imgDone.toLocaleString()} / {supply.toLocaleString()}</>
               : imgPhase === 'done'      ? <><CheckIcon size={13} />&ensp;{imgDone.toLocaleString()} Images Uploaded</>
               : '⬆ Upload Images'}
            </button>
            {imgPhase !== 'idle' && (
              <>
                <ProgressBar value={imgDone} max={supply} color={imgPhase === 'done' ? '#16a34a' : undefined} />
                <div className="exp-step-count">{imgDone.toLocaleString()} / {supply.toLocaleString()}</div>
              </>
            )}
            {!bucketReady && imgPhase === 'idle' && (
              <div className="exp-step-hint">Configure a bucket above first</div>
            )}
          </StepCard>

          {/* Step 2 — Metadata */}
          <StepCard num={2} title="Upload Metadata" status={metaPhase}>
            <button
              className="btn btn-primary"
              onClick={uploadMetadata}
              disabled={imgPhase !== 'done' || metaPhase === 'uploading'}
              style={{ width: '100%', marginBottom: 10, justifyContent: 'center' }}
            >
              {metaPhase === 'uploading' ? <><Spinner size={13} color="#fff" />&ensp;Uploading {metaDone.toLocaleString()} / {supply.toLocaleString()}</>
               : metaPhase === 'done'    ? <><CheckIcon size={13} />&ensp;{metaDone.toLocaleString()} Metadata Uploaded</>
               : '⬆ Upload Metadata'}
            </button>
            {metaPhase !== 'idle' && (
              <>
                <ProgressBar value={metaDone} max={supply} color={metaPhase === 'done' ? '#16a34a' : undefined} />
                <div className="exp-step-count">{metaDone.toLocaleString()} / {supply.toLocaleString()}</div>
              </>
            )}
            {imgPhase !== 'done' && metaPhase === 'idle' && (
              <div className="exp-step-hint">Complete Step 1 first</div>
            )}
          </StepCard>
        </div>

        {/* CID summary (after metadata done) */}
        {metaPhase === 'done' && (
          <div className="exp-cid-section">
            <div className="exp-cid-header">
              <div className="exp-cid-title">CID Summary</div>
              <div className="exp-cid-actions">
                <button className="btn btn-ghost" onClick={() => setShowCids(v => !v)}>
                  {showCids ? '▲ Hide table' : '▼ Show table'}
                </button>
                <button className="btn btn-ghost" onClick={() => {
                  const keys = Object.keys(imgCids).sort((a, b) => Number(a) - Number(b));
                  const lines = keys.map(n => `${n}\t${imgCids[n]}\t${metaCids[n] || ''}`).join('\n');
                  navigator.clipboard?.writeText(`#\tImage CID\tMetadata CID\n${lines}`);
                }}>📋 Copy All</button>
                <button
                  className="btn btn-ghost"
                  style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                  onClick={clearUploads}
                >🗑 Clear uploads</button>
              </div>
            </div>

            <div className="exp-cid-stats">
              {[
                { label: 'Images Uploaded',   val: Object.keys(imgCids).length },
                { label: 'Metadata Uploaded', val: Object.keys(metaCids).length },
                { label: 'Bucket',            val: fbBucket, mono: true },
              ].map(s => (
                <div key={s.label} className="exp-cid-stat">
                  <div className="exp-cid-stat-label">{s.label}</div>
                  <div className={`exp-cid-stat-val${s.mono ? ' exp-cid-mono' : ''}`}>{typeof s.val === 'number' ? s.val.toLocaleString() : s.val}</div>
                </div>
              ))}
            </div>

            {showCids && (
              <div className="exp-cid-table-wrap">
                <table className="exp-cid-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Image CID</th>
                      <th>Metadata CID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(imgCids).sort((a, b) => Number(a) - Number(b)).map(n => (
                      <tr key={n}>
                        <td className="exp-cid-num">{n}</td>
                        <td className="exp-cid-mono">{imgCids[n] || '—'}</td>
                        <td className="exp-cid-mono">{metaCids[n] || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {popup && <NftPopup item={{ ...popup, total: supply }} onClose={() => setPopup(null)} />}
    </div>
  );
}
