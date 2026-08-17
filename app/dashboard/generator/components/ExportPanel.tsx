// @ts-nocheck
'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
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

function canvasToBlob(canvas: any, type: string, quality?: number): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) return canvas.convertToBlob({ type, quality });
  return new Promise(res => canvas.toBlob(res, type, quality));
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
function RarityCard({ item, jobBitmaps, layers, canvasW, canvasH, onClick, bitmapsVer }) {
  const tierColor = TIER_COLOR[item.tier] ?? '#6B7280';
  const canvasRef    = useRef(null);
  const cardRef      = useRef(null);
  const drawn        = useRef(false);
  const [imgReady, setImgReady] = useState(false);

  function draw() {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);
    let didDraw = false;
    for (const layer of layers) {
      const pick = item.combo[layer.folder];
      if (!pick?.rel) continue;
      const bm = jobBitmaps.current[pick.rel];
      if (bm) { ctx.drawImage(bm, 0, 0, canvasW, canvasH); didDraw = true; }
    }
    if (didDraw) { drawn.current = true; setImgReady(true); }
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

  // Re-draw when bitmaps finish loading (fixes blank canvas on first render)
  useEffect(() => {
    if (bitmapsVer > 0) { drawn.current = false; draw(); }
  }, [bitmapsVer]);

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
        <canvas ref={canvasRef} width={canvasW} height={canvasH} style={{ opacity: imgReady ? 1 : 0 }} />
        {!imgReady && <div className="exp-nft-shimmer" />}
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

// ── Horizontal layer filter pill ─────────────────────────────────────────────
function HLayerFilter({ layer, activeFilter, onTraitClick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isActive = activeFilter?.folder === layer.folder;

  useEffect(() => {
    if (!open) return;
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="exp-hfl-item">
      <button
        className={`exp-hfl-btn${isActive ? ' exp-hfl-btn-active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {layer.label}
        <span className="exp-hfl-ct">{layer.count}</span>
        ▾
      </button>
      {open && (
        <div className="exp-hfl-dropdown">
          {[...layer.assets]
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
            .map(a => (
              <button
                key={a.stem}
                className={`exp-hfl-trait${isActive && activeFilter?.stem === a.stem ? ' active' : ''}`}
                onClick={() => { onTraitClick(layer, a); setOpen(false); }}
              >
                {a.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ExportPanel({ weights, layers: layersProp = [], collection, conflicts, collectionId = null }) {
  const supply      = collection?.supply      ?? 100;
  const targetW     = collection?.width       ?? 512;
  const targetH     = collection?.height      ?? 512;
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

  const [fbBucket,  setFbBucket]  = useState('bearth-nft-it');
  const [fbStatus,  setFbStatus]  = useState('idle');
  const [imgPhase,  setImgPhase]  = useState('idle');
  const [imgDone,   setImgDone]   = useState(0);
  const [imgCids,   setImgCids]   = useState({});
  const [metaPhase, setMetaPhase] = useState('idle');
  const [metaDone,  setMetaDone]  = useState(0);
  const [metaCids,  setMetaCids]  = useState({});
  const [showCids,  setShowCids]  = useState(false);
  const [fbError,   setFbError]   = useState('');
  const imgCidsRef      = useRef({});
  const imgPathsRef     = useRef<Record<number, string>>({});

  // ── Server-side export state ──────────────────────────────────────────────
  const [svrBucket,   setSvrBucket]   = useState('bearth-nft-it');
  const [svrStatus,   setSvrStatus]   = useState<'idle'|'running'|'done'|'error'>('idle');
  const [svrProgress, setSvrProgress] = useState(0);
  const [svrTotal,    setSvrTotal]    = useState(0);
  const [svrPhase,    setSvrPhase]    = useState('');
  const [svrError,    setSvrError]    = useState('');
  const svrExportIdRef = useRef<string | null>(null);
  const svrPollRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Server-side image preview/validation state ────────────────────────────
  const [prevStatus,   setPrevStatus]   = useState<'idle'|'running'|'done'|'error'>('idle');
  const [prevProgress, setPrevProgress] = useState(0);
  const [prevTotal,    setPrevTotal]    = useState(0);
  const [prevPhase,    setPrevPhase]    = useState('');
  const [prevValid,    setPrevValid]    = useState(0);
  const [prevInvalid,  setPrevInvalid]  = useState<Array<{ edition: number; reason: string }>>([]);
  const [prevError,    setPrevError]    = useState('');
  const [prevPage,     setPrevPage]     = useState(0);
  const prevIdRef  = useRef<string | null>(null);
  const prevPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Server-side generation state ──────────────────────────────────────────
  const [svrGenStatus,   setSvrGenStatus]   = useState<'idle'|'running'|'done'|'error'>('idle');
  const [svrGenProgress, setSvrGenProgress] = useState(0);
  const [svrGenTotal,    setSvrGenTotal]    = useState(0);
  const [svrGenPhase,    setSvrGenPhase]    = useState('');
  const [svrGenError,    setSvrGenError]    = useState('');
  const svrGenPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [layerStatus,  setLayerStatus]  = useState<'loading'|'ok'|'empty'|'unknown'>('loading');

  const [rarityItems,  setRarityItems]  = useState<any[]>([]);
  const [allCombos,    setAllCombos]    = useState<any[]>([]);
  const [bitmapsVer,   setBitmapsVer]   = useState(0);
  const [filter,       setFilter]       = useState<{ folder: string; stem: string; layerLabel: string; assetName: string } | null>(null);
  const [gridPage,     setGridPage]     = useState(0);
  const jobBitmaps = useRef<Record<string, ImageBitmap>>({});
  const [layers, setLayers] = useState<any[]>(layersProp);
  const cancelledRef       = useRef(false);
  const lastFailedJobIdRef = useRef<string | null>(null);
  const dbJobIdRef         = useRef<string | null>(null);
  // editionNumber → itemId UUID (populated during persistToDb, used for IPFS CID writeback)
  const editionItemMapRef  = useRef<Record<number, string>>({});

  // ── Check whether this collection has active layers in DB ────────────────
  useEffect(() => {
    if (!collectionId) { setLayerStatus('unknown'); return; }
    // If layers are already known from props/state, no extra fetch needed
    if ((layersProp as any[]).length > 0 || layers.length > 0) {
      setLayerStatus('ok');
      return;
    }
    setLayerStatus('loading');
    fetch(`/api/nft-gen/collections/${collectionId}/layers`)
      .then(r => r.ok ? r.json() : { layers: [] })
      .then(data => {
        const active = (data.layers ?? []).filter((l) => l.is_active !== false);
        setLayerStatus(active.length > 0 ? 'ok' : 'empty');
      })
      .catch(() => setLayerStatus('unknown'));
  }, [collectionId]);

  // ── Auto-restore done state from DB on mount ─────────────────────────────
  useEffect(() => {
    if (!collectionId || phase !== 'idle') return;
    let cancelled = false;
    (async () => {
      // Retry up to 3× with 5s backoff — BearthApi pool may be briefly stressed
      // after a heavy generation run, causing the first restore attempt to fail.
      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled) return;
        if (attempt > 0) await new Promise(r => setTimeout(r, 5_000));
        try {
          const r = await fetch(`/api/nft-gen/jobs?collectionId=${collectionId}&status=complete`);
          if (!r.ok || cancelled) continue;
          const data = await r.json();
          if (cancelled || !data.jobs?.length) return;
          const latestJob = data.jobs[0];
          dbJobIdRef.current = latestJob.id;
          await loadAndDisplayFromDb(latestJob.id);
          if (cancelled) return;
          setSvrGenStatus('done');
          setDbSaved(true);
          setPhase('done');
          return;
        } catch { /* retry */ }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId]);

  // ── Server export helpers ─────────────────────────────────────────────────

  async function startServerExport() {
    const bucket = svrBucket.trim();
    if (!bucket || !dbJobIdRef.current) return;
    setSvrStatus('running');
    setSvrProgress(0);
    setSvrPhase('Starting…');
    setSvrError('');

    try {
      const r = await fetch('/api/nft-gen/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId:          dbJobIdRef.current,
          bucket,
          format:         imgExt,
          width:          targetW,
          height:         targetH,
          collectionName: collName,
          description,
          nameFormat,
          externalUrl:    externalUrlBase,
        }),
      });
      const d = await r.json();
      if (!r.ok) { setSvrStatus('error'); setSvrError(d.error ?? 'Server error'); return; }
      svrExportIdRef.current = d.exportId;
      setSvrTotal(d.total ?? supply);

      let exportPollFailures = 0;
      svrPollRef.current = setInterval(async () => {
        let resp: Response;
        let pr: any = null;
        try {
          resp = await fetch(`/api/nft-gen/export/${svrExportIdRef.current}`);
          pr = await resp.json();
        } catch { exportPollFailures++; if (exportPollFailures >= 3) { clearInterval(svrPollRef.current!); svrPollRef.current = null; setSvrStatus('error'); setSvrError('Lost connection to server. Please try again.'); } return; }
        if (!resp.ok) {
          clearInterval(svrPollRef.current!); svrPollRef.current = null;
          setSvrStatus('error');
          setSvrError(pr?.error ?? 'Server restarted during export. Please try again.');
          return;
        }
        setSvrProgress(pr.progress ?? 0);
        setSvrPhase(pr.phase ?? '');
        setSvrTotal(pr.total ?? supply);
        if (pr.status === 'done') {
          setSvrStatus('done');
          if (svrPollRef.current) { clearInterval(svrPollRef.current); svrPollRef.current = null; }
        } else if (pr.status === 'error') {
          setSvrStatus('error');
          setSvrError(pr.error ?? 'Export failed');
          if (svrPollRef.current) { clearInterval(svrPollRef.current); svrPollRef.current = null; }
        }
      }, 2000);
    } catch (e: any) {
      setSvrStatus('error');
      setSvrError(e.message ?? 'Failed to start server export');
    }
  }

  function cancelServerExport() {
    if (svrPollRef.current) { clearInterval(svrPollRef.current); svrPollRef.current = null; }
    setSvrStatus('idle');
  }

  async function startPreview() {
    if (!dbJobIdRef.current) return;
    setPrevStatus('running');
    setPrevProgress(0);
    setPrevPhase('Starting…');
    setPrevError('');
    setPrevInvalid([]);
    setPrevValid(0);
    setPrevPage(0);

    try {
      const r = await fetch('/api/nft-gen/export/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: dbJobIdRef.current, width: targetW, height: targetH }),
      });
      const d = await r.json();
      if (!r.ok) { setPrevStatus('error'); setPrevError(d.error ?? 'Server error'); return; }
      prevIdRef.current = d.previewId;
      setPrevTotal(d.total ?? supply);

      let prevPollFailures = 0;
      prevPollRef.current = setInterval(async () => {
        if (!prevIdRef.current) return;
        let resp: Response;
        let pr: any = null;
        try {
          resp = await fetch(`/api/nft-gen/export/preview/${prevIdRef.current}`);
          pr = await resp.json();
        } catch { prevPollFailures++; if (prevPollFailures >= 3) { clearInterval(prevPollRef.current!); prevPollRef.current = null; setPrevStatus('error'); setPrevError('Lost connection to server. Please try again.'); } return; }
        if (!resp.ok) {
          clearInterval(prevPollRef.current!); prevPollRef.current = null;
          setPrevStatus('error');
          setPrevError(pr?.error ?? 'Server restarted during preview. Please try again.');
          return;
        }
        setPrevProgress(pr.progress ?? 0);
        setPrevPhase(pr.phase ?? '');
        setPrevTotal(pr.total ?? supply);
        setPrevValid(pr.validCount ?? 0);
        setPrevInvalid(pr.invalidItems ?? []);
        if (pr.status === 'done') {
          setPrevStatus('done');
          if (prevPollRef.current) { clearInterval(prevPollRef.current); prevPollRef.current = null; }
        } else if (pr.status === 'error') {
          setPrevStatus('error');
          setPrevError(pr.error ?? 'Preview failed');
          if (prevPollRef.current) { clearInterval(prevPollRef.current); prevPollRef.current = null; }
        }
      }, 3000);
    } catch (e: any) {
      setPrevStatus('error');
      setPrevError(e.message ?? 'Failed to start preview');
    }
  }

  async function generate() {
    cancelledRef.current = false;
    setError('');
    setPhase('preload');
    setProgress(0);
    setRarityItems([]);
    setAllCombos([]);
    jobBitmaps.current = {};
    setBitmapsVer(0);

    let layerData: any[] = layersProp.length ? layersProp : layers;
    if (!layerData.length) {
      if (collectionId) {
        try { const r = await fetch(`/api/layers?collectionId=${collectionId}`); layerData = await r.json(); } catch {}
      }
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
    const imgTotal1 = rels.length;
    setLoadMsg('Loading images…');

    await Promise.all(rels.map(async (rel) => {
      try {
        const res = await fetch(`/api/layer-raw/${rel}`);
        if (res.ok) {
          const blob = await res.blob();
          jobBitmaps.current[rel] = await createImageBitmap(blob);
        }
      } catch {}
      loaded++;
      setLoadMsg(`Loading images… ${Math.round(loaded / imgTotal1 * 100)}%`);
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

  const [syncingLayers, setSyncingLayers] = useState(false);
  async function syncLayersNow() {
    if (!collectionId || syncingLayers) return;
    setSyncingLayers(true);
    setError('');
    try {
      const r = await fetch(`/api/nft-gen/collections/${collectionId}/sync-from-disk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layers: layersProp }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error ?? 'Layer sync failed. Try again.'); return; }
      setLayerStatus(d.layersSynced > 0 ? 'ok' : 'empty');
      if (d.layersSynced === 0) setError('No layers were synced. Go to Settings → Continue to rebuild your layer list.');
    } catch {
      setError('Layer sync failed. Check your connection.');
    } finally {
      setSyncingLayers(false);
    }
  }

  async function generateOnServer() {
    if (!collectionId) { setError('Save collection settings before generating.'); return; }
    setSvrGenStatus('running');
    setSvrGenProgress(0);
    setSvrGenTotal(supply);
    setSvrGenPhase('Starting…');
    setSvrGenError('');
    setError('');

    try {
      const r = await fetch('/api/nft-gen/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId, editionSize: supply }),
      });
      const d = await r.json();
      if (!r.ok) { setSvrGenStatus('error'); setSvrGenError(d.error ?? 'Server error'); return; }

      const genId = d.generateId;
      let pollFailures = 0;
      svrGenPollRef.current = setInterval(async () => {
        let resp: Response;
        let pr: any = null;
        try {
          resp = await fetch(`/api/nft-gen/generate/${genId}`);
          pr = await resp.json();
        } catch { pollFailures++; if (pollFailures >= 3) { clearInterval(svrGenPollRef.current!); svrGenPollRef.current = null; setSvrGenStatus('error'); setSvrGenError('Lost connection to server. Please try again.'); } return; }

        // 404 = server restarted and lost in-memory state
        if (!resp.ok) {
          clearInterval(svrGenPollRef.current!); svrGenPollRef.current = null;
          setSvrGenStatus('error');
          setSvrGenError(pr?.error ?? 'Server restarted during generation. Please try again.');
          return;
        }

        setSvrGenProgress(pr.progress ?? 0);
        setSvrGenPhase(pr.phase ?? '');
        setSvrGenTotal(pr.total ?? supply);
        if (pr.status === 'done') {
          if (svrGenPollRef.current) { clearInterval(svrGenPollRef.current); svrGenPollRef.current = null; }
          const jobIdDone = pr.jobId ?? null;
          if (jobIdDone) {
            dbJobIdRef.current = jobIdDone;
            await loadAndDisplayFromDb(jobIdDone);
          }
          setSvrGenStatus('done');
          setDbSaved(true);
          setDbSaving(false);
          setPhase('done');
        } else if (pr.status === 'error') {
          if (svrGenPollRef.current) { clearInterval(svrGenPollRef.current); svrGenPollRef.current = null; }
          setSvrGenStatus('error');
          setSvrGenError(pr.error ?? 'Generation failed');
        }
      }, 2000);
    } catch (e: any) {
      setSvrGenStatus('error');
      setSvrGenError(e.message ?? 'Failed to start generation');
    }
  }

  async function loadAndDisplayFromDb(jobId: string, attempt = 0) {
    try {
      let layerData: any[] = layersProp.length ? layersProp : layers;
      if (!layerData.length) {
        if (collectionId) {
        try { const r = await fetch(`/api/layers?collectionId=${collectionId}`); layerData = await r.json(); } catch {}
      }
      }
      if (!layerData.length) return;
      setLayers(layerData);

      const rels = [...new Set(
        layerData.flatMap((l: any) => l.assets.filter((a: any) => a.rel).map((a: any) => a.rel))
      )] as string[];

      // Fetch items only — don't block on bitmap loading
      const itemsResp = await fetch(`/api/nft-gen/jobs/${jobId}/display-items?limit=${supply}`);

      if (!itemsResp.ok) {
        console.warn(`[loadAndDisplayFromDb] display-items HTTP ${itemsResp.status} — retrying (${attempt}/3)`);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          return loadAndDisplayFromDb(jobId, attempt + 1);
        }
        return;
      }

      const itemsResult = await itemsResp.json().catch(() => ({ items: [] }));

      if (!itemsResult.items?.length) {
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          return loadAndDisplayFromDb(jobId, attempt + 1);
        }
        return;
      }

      const displayed = itemsResult.items.map((item: any) => {
        const traits: Array<{ traitType: string; traitValue: string }> = item.traits ?? [];
        const combo: Record<string, any> = {};
        for (const t of traits) {
          const layer = layerData.find((l: any) => l.label === t.traitType);
          if (layer) {
            const asset = layer.assets.find((a: any) => a.name === t.traitValue);
            if (asset?.rel) {
              combo[layer.folder] = { rel: asset.rel, stem: asset.stem ?? asset.name, name: t.traitValue };
            }
          }
        }
        return {
          index: item.editionNumber,
          rank:  item.rarityRank,
          score: item.rarityScore,
          tier:  item.rarityTier,
          attrs: traits.map((t: any) => ({ trait_type: t.traitType, value: t.traitValue })),
          combo,
          total: supply,
        };
      });
      setRarityItems(displayed);

      // Load bitmaps in background — increment bitmapsVer when done to trigger re-draw
      Promise.all(rels.map(async (rel) => {
        if (!jobBitmaps.current[rel]) {
          try {
            const res = await fetch(`/api/layer-raw/${rel}`);
            if (res.ok) {
              const blob = await res.blob();
              jobBitmaps.current[rel] = await createImageBitmap(blob);
            }
          } catch {}
        }
      })).then(() => setBitmapsVer(v => v + 1)).catch(() => {});
    } catch (e) {
      console.error('[loadAndDisplayFromDb]', e);
    }
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

    // Retry helper — exponential backoff: 1 s → 2 s → 4 s → 8 s
    // 4xx errors are not retried (bad request / auth — retrying won't help).
    async function withRetry<T>(label: string, fn: () => Promise<T>, maxRetries = 4): Promise<T> {
      let lastErr: unknown;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          const ms = 1_000 * Math.pow(2, attempt - 1);
          console.warn(`[nft-db/${label}] retry ${attempt}/${maxRetries} in ${ms}ms`);
          await new Promise(r => setTimeout(r, ms));
        }
        try { return await fn(); } catch (e: any) {
          lastErr = e;
          if (e?.retryable === false) throw e;
        }
      }
      throw lastErr;
    }

    let dbJobId: string | null = null;
    try {
      // ── 1. Create job ───────────────────────────────────────────────────────
      const jr = await withRetry('create-job', async () => {
        const res = await fetch(`/api/nft-gen/collections/${collectionId}/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ editionSize: items.length }),
        });
        if (!res.ok) {
          const err = new Error(`Job creation failed (${res.status})`);
          if (res.status >= 400 && res.status < 500) (err as any).retryable = false;
          throw err;
        }
        return res.json();
      });
      dbJobId = jr?.job?.id ?? jr?.id ?? null;
      if (!dbJobId) throw Object.assign(new Error('Job ID not returned from server'), { retryable: false });

      // ── 2. Start job ────────────────────────────────────────────────────────
      await withRetry('start-job', () =>
        fetch(`/api/nft-gen/jobs/${dbJobId}/start`, { method: 'POST' }),
      );
      editionItemMapRef.current = {};

      // ── 3. Insert items in batches — 5 concurrent requests ─────────────────
      // 500 items per batch × 5 parallel = processes 9999 in ~4 parallel groups.
      // ON CONFLICT DO NOTHING makes every batch retry fully idempotent.
      const ITEM_BATCH      = 500;
      const BATCH_CONCUR    = 5;
      const totalBatches    = Math.ceil(items.length / ITEM_BATCH);
      let   completedBatches = 0;

      const allChunks = Array.from({ length: totalBatches }, (_, bi) => {
        const start = bi * ITEM_BATCH;
        return {
          batchNum: bi + 1,
          chunk: items.slice(start, start + ITEM_BATCH).map((item: any) => ({
            editionNumber: item.index,
            dnaHash: (item.attrs as any[]).map((a: any) => `${a.trait_type}:${a.value}`).join('|'),
            score: item.score,
            rank:  item.rank,
            tier:  item.tier,
            traits: (item.attrs as any[]).map((a: any) => ({
              traitType:  a.trait_type,
              traitValue: a.value,
            })),
          })),
        };
      });

      for (let g = 0; g < allChunks.length; g += BATCH_CONCUR) {
        const group = allChunks.slice(g, g + BATCH_CONCUR);
        await Promise.all(group.map(async ({ batchNum, chunk }) => {
          const batchData = await withRetry(`batch-${batchNum}/${totalBatches}`, async () => {
            const res = await fetch(`/api/nft-gen/jobs/${dbJobId}/items/batch`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              body:    JSON.stringify({ items: chunk }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              const err  = new Error(`Batch ${batchNum}/${totalBatches} failed (${res.status}): ${(body as any).error ?? 'server error'}`);
              if (res.status >= 400 && res.status < 500) (err as any).retryable = false;
              throw err;
            }
            return res.json().catch(() => ({}));
          });
          for (const row of (batchData?.items ?? [])) {
            editionItemMapRef.current[row.editionNumber] = row.itemId;
          }
        }));

        completedBatches += group.length;
        const pctDone = Math.round((completedBatches / totalBatches) * 100);
        fetch(`/api/nft-gen/jobs/${dbJobId}/progress`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ progress: pctDone }),
        }).catch(() => {});
      }

      // ── 4. Complete job ─────────────────────────────────────────────────────
      await withRetry('complete-job', () =>
        fetch(`/api/nft-gen/jobs/${dbJobId}/complete`, { method: 'POST' }),
      );
      dbJobIdRef.current = dbJobId;
      setDbSaved(true);
    } catch (err: any) {
      if (dbJobId) {
        fetch(`/api/nft-gen/jobs/${dbJobId}/fail`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ errorMessage: err?.message ?? 'Item batch insert failed' }),
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
        const imgTotal2 = rels.length;
        setLoadMsg('Loading images…');
        await Promise.all(rels.map(async (rel) => {
          try {
            const res = await fetch(`/api/layer-raw/${rel}`);
            if (res.ok) imageBuffers[rel] = await res.arrayBuffer();
          } catch {}
          imgLoaded++;
          setLoadMsg(`Loading images… ${Math.round(imgLoaded / imgTotal2 * 100)}%`);
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
              const blob = await canvasToBlob(canvas, imgMime, wantWebp ? 0.85 : undefined);
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
    imgCidsRef.current  = {};
    imgPathsRef.current = {};

    // Create DB upload batch record
    let imgBatchId: string | null = null;
    if (dbJobIdRef.current) {
      try {
        const br = await fetch(`/api/nft-gen/jobs/${dbJobIdRef.current}/upload-batches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'filebase', batchType: 'images', totalItems: supply }),
        });
        if (br.ok) {
          const bd = await br.json();
          imgBatchId = bd?.batch?.id ?? null;
          if (imgBatchId) {
            await fetch(`/api/nft-gen/upload-batches/${imgBatchId}/start`, { method: 'POST' }).catch(() => {});
          }
        } else {
          const errBody = await br.json().catch(() => ({}));
          console.error('[upload-batch-img] create failed:', br.status, JSON.stringify(errBody));
        }
      } catch (e) {
        console.error('[upload-batch-img] create exception:', String(e));
      }
    } else {
      console.error('[upload-batch-img] dbJobIdRef is null — batch skipped');
    }

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
    let uploadedCount = 0;
    let lastReported = 0;

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
        const blob = await canvasToBlob(canvas, imgMime, wantWebp ? 0.85 : undefined);
        const fd = new FormData();
        fd.append('file', blob, `${num}.${imgExt}`);
        fd.append('bucket', bucket);
        fd.append('key', `images/${num}.${imgExt}`);
        try {
          const r = await fetch('/api/filebase/image', { method: 'POST', body: fd });
          if (r.ok) {
            const d = await r.json();
            imgCidsRef.current[num]  = d.cid || '';
            imgPathsRef.current[num] = `images/${num}.${imgExt}`;
            setImgCids(prev => ({ ...prev, [num]: d.cid || '' }));
          }
        } catch {}
        uploadedCount++;
        setImgDone(prev => prev + 1);
        // Report progress every 10% of supply (min 1, max 100)
        const imgProgressStep = Math.max(1, Math.min(100, Math.ceil(supply / 10)));
        if (imgBatchId && uploadedCount - lastReported >= imgProgressStep) {
          lastReported = uploadedCount;
          fetch(`/api/nft-gen/upload-batches/${imgBatchId}/progress`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uploadedItems: uploadedCount }),
          }).catch(() => {});
        }
      }
    }

    try {
      await Promise.all(Array.from({ length: CONCURRENCY }, runOne));
      setImgPhase('done');
      if (imgBatchId) {
        await fetch(`/api/nft-gen/upload-batches/${imgBatchId}/complete`, { method: 'POST' }).catch(() => {});
      }
    } catch (e: any) {
      setImgPhase('idle');
      setFbError(e.message ?? 'Image upload failed');
      if (imgBatchId) {
        fetch(`/api/nft-gen/upload-batches/${imgBatchId}/fail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: e.message ?? 'Image upload failed' }),
        }).catch(() => {});
      }
    }
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

    // Create DB upload batch record
    let metaBatchId: string | null = null;
    if (dbJobIdRef.current) {
      try {
        const br = await fetch(`/api/nft-gen/jobs/${dbJobIdRef.current}/upload-batches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: 'filebase', batchType: 'metadata', totalItems: supply }),
        });
        if (br.ok) {
          const bd = await br.json();
          metaBatchId = bd?.batch?.id ?? null;
          if (metaBatchId) {
            await fetch(`/api/nft-gen/upload-batches/${metaBatchId}/start`, { method: 'POST' }).catch(() => {});
          }
        }
      } catch {}
    }

    const BATCH_SIZE = 50;
    const resolvedNameFmt = nameFormat || (collName ? `${collName} #{{id}}` : '#{{id}}');
    let totalUploaded = 0;
    const localMetaCids: Record<number, string> = {};

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
          Object.assign(localMetaCids, update);
        }
      } catch {}
      totalUploaded += items.length;
      setMetaDone(prev => prev + items.length);
      // Report progress to DB every batch
      if (metaBatchId) {
        fetch(`/api/nft-gen/upload-batches/${metaBatchId}/progress`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadedItems: totalUploaded }),
        }).catch(() => {});
      }
    }
    setMetaPhase('done');
    if (metaBatchId) {
      await fetch(`/api/nft-gen/upload-batches/${metaBatchId}/complete`, { method: 'POST' }).catch(() => {});
    }

    // Write IPFS CIDs back to nft_generated_items in the DB
    if (dbJobIdRef.current && Object.keys(imgCidsRef.current).length > 0) {
      const IPFS_BATCH = 500;
      const editions = Object.keys(imgCidsRef.current).map(Number);
      for (let i = 0; i < editions.length; i += IPFS_BATCH) {
        const chunk = editions.slice(i, i + IPFS_BATCH);
        const payload = chunk
          .filter(n => imgCidsRef.current[n] && localMetaCids[n])
          .map(n => ({
            editionNumber:   n,
            ipfsImageCid:    imgCidsRef.current[n],
            ipfsMetadataCid: localMetaCids[n],
            imagePath:       imgPathsRef.current[n] ?? null,
          }));
        if (payload.length > 0) {
          fetch(`/api/nft-gen/jobs/${dbJobIdRef.current}/items/batch-ipfs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items: payload }),
          }).catch(() => {});
        }
      }
    }
  }

  const PAGE_SIZE = 200;

  const visibleItems = useMemo(() => {
    const base = filter
      ? rarityItems.filter(({ combo }) => combo[filter.folder]?.stem === filter.stem)
      : rarityItems;
    if (sortBy === 'rarity') return [...base].sort((a, b) => a.rank - b.rank);
    return [...base].sort((a, b) => a.index - b.index);
  }, [rarityItems, filter, sortBy]);

  // Only render one page at a time — full sort/filter on all items, display is paginated
  const pageItems = useMemo(() =>
    visibleItems.slice(gridPage * PAGE_SIZE, (gridPage + 1) * PAGE_SIZE),
  [visibleItems, gridPage]);

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));

  // Reset to first page whenever filter or sort changes
  useEffect(() => { setGridPage(0); }, [filter, sortBy]);

  const layerBreakdown = useMemo(() =>
    layers.map(layer => ({ ...layer, count: layer.assets.length })),
  [layers]);

  function handleTraitClick(layer: any, asset: any) {
    setFilter(prev =>
      prev?.folder === layer.folder && prev?.stem === asset.stem
        ? null
        : { folder: layer.folder, stem: asset.stem, layerLabel: layer.label, assetName: asset.name }
    );
  }
  function clearFilter() { setFilter(null); }

  const pct = supply > 0 ? Math.min((progress / supply) * 100, 100) : 0;
  const bucketReady = fbStatus === 'exists' || fbStatus === 'created';

  // ── Server-side generation in progress (must come before idle check) ─────────
  if (svrGenStatus === 'running') {
    const pctGen = svrGenTotal > 0 ? (svrGenProgress / svrGenTotal) * 100 : 0;
    return (
      <div className="export-page">
        <div className="exp-loading-card">
          <Spinner size={32} color="var(--accent)" />
          <div className="exp-loading-title">Generating {supply.toLocaleString()} NFTs on server…</div>
          <div className="exp-loading-msg">{svrGenPhase || 'Starting…'}</div>
          {svrGenTotal > 0 && (
            <>
              <ProgressBar value={svrGenProgress} max={svrGenTotal} />
              <div className="exp-gen-pct">{pctGen.toFixed(1)}%</div>
            </>
          )}
        </div>
      </div>
    );
  }

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

          {layerStatus === 'empty' && (
            <div className="exp-error-banner" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span>No active layers found for this collection.</span>
              {layersProp.length > 0 ? (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: '3px 10px' }}
                  onClick={syncLayersNow}
                  disabled={syncingLayers}
                >
                  {syncingLayers ? '⌛ Syncing…' : '⚡ Sync layers to DB'}
                </button>
              ) : (
                <span>Go to <strong>Settings</strong> → <strong>Continue</strong> to sync your layers.</span>
              )}
            </div>
          )}
          {(error || svrGenError) && <div className="exp-error-banner">{error || svrGenError}</div>}

          <div className="exp-idle-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={generateOnServer}
              disabled={!collectionId || svrGenStatus === 'running' || layerStatus === 'loading' || layerStatus === 'empty'}
            >
              {layerStatus === 'loading' ? '⌛ Checking layers…' : `⚡ Generate ${supply.toLocaleString()} NFTs`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Preload / Combos (browser generation) ────────────────────────────────────
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
                onClick={() => setSortBy('rarity')}
              >🏆 Rarity</button>
              <button
                className={`exp-sort-btn${sortBy === 'id' ? ' exp-sort-active' : ''}`}
                onClick={() => setSortBy('id')}
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
          <div className="exp-banner exp-banner-saved" data-job-id={dbJobIdRef.current ?? ''}>
            <CheckIcon size={15} />
            <span>{supply.toLocaleString()} items saved to database</span>
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

        {/* ── Horizontal filter bar ── */}
        {layers.length > 0 && (
          <div className="exp-hfilter-bar">
            {filter && (
              <div className="plr-filter-badge">
                <span>{filter.layerLabel}: {filter.assetName}</span>
                <button className="plr-filter-clear" onClick={clearFilter}>✕</button>
              </div>
            )}
            {layerBreakdown.map(layer => (
              <HLayerFilter
                key={layer.folder}
                layer={layer}
                activeFilter={filter}
                onTraitClick={handleTraitClick}
              />
            ))}
          </div>
        )}

        {/* ── NFT grid ── */}
        {visibleItems.length > 0 && (
          <div className="exp-grid-nav">
            <div className="preview-count-row">
              <span className="preview-count-num">{visibleItems.length.toLocaleString()}</span>
              {' '}
              <span className="preview-count-label">
                {filter ? `of ${rarityItems.length.toLocaleString()} NFTs` : 'NFTs'}
              </span>
            </div>
            {totalPages > 1 && (
              <div className="exp-page-group">
                <button className="exp-sort-btn" onClick={() => setGridPage(p => Math.max(0, p - 1))} disabled={gridPage === 0}>← Prev</button>
                <span className="exp-page-label">Page {gridPage + 1} / {totalPages}</span>
                <button className="exp-sort-btn" onClick={() => setGridPage(p => Math.min(totalPages - 1, p + 1))} disabled={gridPage >= totalPages - 1}>Next →</button>
              </div>
            )}
          </div>
        )}
        <div className="exp-tier-legend">
          {TIER_META.map(t => (
            <div key={t.label} className="exp-tier-pill" style={{ borderColor: `${t.color}33` }}>
              <span className="exp-tier-dot" style={{ background: t.color }} />
              <span style={{ color: t.color, fontWeight: 700 }}>{t.label}</span>
              <span className="exp-tier-pill-sub">{t.sub}</span>
            </div>
          ))}
        </div>
        {pageItems.length > 0 ? (
          <div className="exp-nft-grid">
            {pageItems.map(item => (
              <RarityCard
                key={item.index}
                item={item}
                jobBitmaps={jobBitmaps}
                layers={layers}
                canvasW={tW}
                canvasH={tH}
                onClick={setPopup}
                bitmapsVer={bitmapsVer}
              />
            ))}
          </div>
        ) : (
          <div className="exp-empty-filter">No NFTs match this filter.</div>
        )}
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

      {/* ── Server-Side Image Preview/Validation ── */}
      {dbSaved && dbJobIdRef.current && (
        <div className="exp-fb-card exp-svr-card" data-testid="image-preview-section">
          <div className="exp-fb-header">
            <div className="exp-fb-title">Validate Images Before Export</div>
            <div className="exp-fb-sub">
              Server composites all {supply.toLocaleString()} NFTs using Sharp — same pipeline as Filebase upload — and validates each image for quality
            </div>
          </div>

          {prevStatus === 'idle' && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
              <button
                className="btn btn-primary"
                onClick={startPreview}
                data-testid="validate-images-btn"
              >
                🔍 Validate All {supply.toLocaleString()} NFT Images
              </button>
            </div>
          )}

          {prevStatus === 'running' && (
            <div style={{ marginTop: 14 }} data-testid="preview-progress">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Spinner size={16} color="var(--accent)" />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{prevPhase || 'Compositing…'}</span>
              </div>
              <ProgressBar value={prevProgress} max={prevTotal} />
              <div className="exp-step-count">{prevProgress.toLocaleString()} / {prevTotal.toLocaleString()}</div>
            </div>
          )}

          {prevStatus === 'error' && (
            <div className="exp-banner exp-banner-error" style={{ marginTop: 10 }}>
              <span>Validation failed: {prevError}</span>
              <button className="exp-retry-btn" onClick={() => { setPrevStatus('idle'); setPrevError(''); }}>↺ Retry</button>
            </div>
          )}

          {prevStatus === 'done' && (
            <div data-testid="preview-done">
              {/* Validation summary */}
              <div style={{ display: 'flex', gap: 16, marginTop: 14, marginBottom: 14, flexWrap: 'wrap' }}>
                <div className="exp-cid-stat">
                  <div className="exp-cid-stat-label">Total</div>
                  <div className="exp-cid-stat-val">{prevTotal.toLocaleString()}</div>
                </div>
                <div className="exp-cid-stat">
                  <div className="exp-cid-stat-label">Valid</div>
                  <div className="exp-cid-stat-val" style={{ color: '#16a34a' }}>{prevValid.toLocaleString()}</div>
                </div>
                <div className="exp-cid-stat">
                  <div className="exp-cid-stat-label">Issues</div>
                  <div className="exp-cid-stat-val" style={{ color: prevInvalid.length ? '#dc2626' : '#16a34a' }}>
                    {prevInvalid.length}
                  </div>
                </div>
                <div className="exp-cid-stat">
                  <div className="exp-cid-stat-label">Quality</div>
                  <div className="exp-cid-stat-val" style={{ color: prevInvalid.length === 0 ? '#16a34a' : '#f59e0b' }}>
                    {prevTotal > 0 ? ((prevValid / prevTotal) * 100).toFixed(1) : 0}%
                  </div>
                </div>
              </div>

              {prevInvalid.length === 0 && (
                <div className="exp-banner exp-banner-saved" style={{ marginBottom: 14 }} data-testid="all-valid-banner">
                  <CheckIcon size={15} />
                  <span>All {prevValid.toLocaleString()} NFT images passed quality validation — safe to upload to Filebase</span>
                </div>
              )}

              {prevInvalid.length > 0 && (
                <div className="exp-banner exp-banner-error" style={{ marginBottom: 14 }}>
                  <span>{prevInvalid.length} NFTs failed validation — review before uploading</span>
                </div>
              )}

              {/* Thumbnail grid — paginated, 100 per page */}
              {prevIdRef.current && prevTotal > 0 && (
                <div data-testid="thumbnail-grid">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dim)' }}>
                      Showing {prevPage * 100 + 1}–{Math.min((prevPage + 1) * 100, prevTotal)} of {prevTotal.toLocaleString()} NFTs
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost" onClick={() => setPrevPage(p => Math.max(0, p - 1))} disabled={prevPage === 0}>← Prev</button>
                      <button className="btn btn-ghost" onClick={() => setPrevPage(p => Math.min(Math.ceil(prevTotal / 100) - 1, p + 1))} disabled={(prevPage + 1) * 100 >= prevTotal}>Next →</button>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
                    {Array.from({ length: Math.min(100, prevTotal - prevPage * 100) }, (_, i) => {
                      const edition = prevPage * 100 + i + 1;
                      const isInvalid = prevInvalid.some(x => x.edition === edition);
                      return (
                        <div key={edition} style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', border: isInvalid ? '2px solid #dc2626' : '1px solid var(--border)' }}>
                          <img
                            src={`/api/nft-gen/export/preview/${prevIdRef.current}/img/${edition}`}
                            alt={`NFT #${edition}`}
                            style={{ width: '100%', display: 'block', aspectRatio: '1/1', objectFit: 'cover' }}
                            loading="lazy"
                          />
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, padding: '2px 3px', textAlign: 'center' }}>
                            #{edition}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 14 }}>
                <button className="btn btn-ghost" onClick={() => { setPrevStatus('idle'); prevIdRef.current = null; }}>
                  ↺ Re-validate
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Server-Side Export ── */}
      {dbSaved && dbJobIdRef.current && (
        <div className="exp-fb-card exp-svr-card" data-testid="server-export-section">
          <div className="exp-fb-header">
            <div className="exp-fb-title">Server-Side Export</div>
            <div className="exp-fb-sub">
              Recommended for large collections — compositing and IPFS upload run on the server (no browser limits)
            </div>
          </div>

          {svrStatus === 'idle' && (
            <>
              <div className="exp-fb-bucket-row">
                <input
                  className="exp-fb-input"
                  placeholder="Filebase bucket name"
                  value={svrBucket}
                  onChange={e => setSvrBucket(e.target.value)}
                />
                <button
                  className="btn btn-primary"
                  onClick={startServerExport}
                  disabled={!svrBucket.trim()}
                >
                  ⚡ Start Server Export
                </button>
              </div>
              {svrError && <div className="exp-error-banner" style={{ marginTop: 10 }}>{svrError}</div>}
            </>
          )}

          {svrStatus === 'running' && (
            <div style={{ marginTop: 14 }} data-export-id={svrExportIdRef.current ?? ''}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Spinner size={16} color="var(--accent)" />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{svrPhase || 'Working…'}</span>
              </div>
              <ProgressBar value={svrProgress} max={svrTotal} />
              <div className="exp-step-count">{svrProgress.toLocaleString()} / {svrTotal.toLocaleString()}</div>
              <button className="btn btn-ghost" onClick={cancelServerExport} style={{ marginTop: 8 }}>
                Stop polling
              </button>
            </div>
          )}

          {svrStatus === 'done' && (
            <div className="exp-banner exp-banner-saved exp-svr-done" style={{ marginTop: 14 }}>
              <CheckIcon size={15} />
              <span>{svrTotal.toLocaleString()} NFTs composited and uploaded to Filebase IPFS</span>
              <button className="btn btn-ghost" style={{ marginLeft: 'auto' }}
                onClick={() => { setSvrStatus('idle'); setSvrProgress(0); svrExportIdRef.current = null; }}
              >
                Export again
              </button>
            </div>
          )}

          {svrStatus === 'error' && (
            <div className="exp-banner exp-banner-error" style={{ marginTop: 14 }}>
              <span>Server export failed: {svrError}</span>
              <button className="exp-retry-btn" onClick={() => { setSvrStatus('idle'); setSvrError(''); }}>↺ Retry</button>
            </div>
          )}
        </div>
      )}

      {popup && <NftPopup item={{ ...popup, total: supply }} onClose={() => setPopup(null)} />}
    </div>
  );
}
