// @ts-nocheck
'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import NftPopup from './NftPopup';
import { TIER_META, Spinner, CheckIcon, RarityCard, ProgressBar, HLayerFilter } from './ExportGridParts';
import { fetchWithTimeout } from '../../../../lib/fetchWithTimeout';

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ExportPanel({ weights, layers: layersProp = [], collection, conflicts, collectionId = null }) {
  const supply      = Number(collection?.supply ?? 0);
  const targetW     = collection?.width       ?? null;
  const targetH     = collection?.height      ?? null;
  const wantWebp    = collection?.formatType   === 'webp';
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

  const [phase,     setPhase]     = useState<'idle'|'done'>('idle');
  const [sortBy,    setSortBy]    = useState<'rarity'|'id'>('rarity');
  const [popup,     setPopup]     = useState(null);
  const [error,     setError]     = useState('');
  const [dbError,   setDbError]   = useState('');
  const [dbSaving,  setDbSaving]  = useState(false);
  const [dbSaved,   setDbSaved]   = useState(false);

  const [externalUrlBase, setExternalUrlBase] = useState(defaultExternalUrl);

  // ── Server-side export state ──────────────────────────────────────────────
  const [svrBucket,      setSvrBucket]      = useState('');
  const [svrNewBucket,   setSvrNewBucket]   = useState('');
  const [svrSyncRecords, setSvrSyncRecords] = useState(false);
  const [svrResumeFrom,  setSvrResumeFrom]  = useState(0);
  const [bucketList,     setBucketList]     = useState<string[]>([]);
  const [bucketsLoading, setBucketsLoading] = useState(false);
  const [svrStatus,   setSvrStatus]   = useState<'idle'|'running'|'done'|'error'>('idle');
  const [svrProgress, setSvrProgress] = useState(0);
  const [svrTotal,    setSvrTotal]    = useState(0);
  const [svrPhase,    setSvrPhase]    = useState('');
  const [svrError,    setSvrError]    = useState('');
  const svrExportIdRef = useRef<string | null>(null);
  const svrPollRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Refresh CIDs state ────────────────────────────────────────────────────
  const [cidStatus,   setCidStatus]   = useState<'idle'|'running'|'done'|'error'>('idle');
  const [cidProgress, setCidProgress] = useState(0);
  const [cidTotal,    setCidTotal]    = useState(0);
  const [cidResolved, setCidResolved] = useState(0);
  const [cidSkipped,  setCidSkipped]  = useState(0);
  const [cidPhase,    setCidPhase]    = useState('');
  const [cidError,    setCidError]    = useState('');
  const cidPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Server-side generation state ──────────────────────────────────────────
  const [svrGenStatus,   setSvrGenStatus]   = useState<'idle'|'running'|'done'|'error'>('idle');
  const [svrGenProgress, setSvrGenProgress] = useState(0);
  const [svrGenTotal,    setSvrGenTotal]    = useState(0);
  const [svrGenPhase,    setSvrGenPhase]    = useState('');
  const [svrGenError,    setSvrGenError]    = useState('');
  const svrGenPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [layerStatus,  setLayerStatus]  = useState<'loading'|'ok'|'empty'|'unknown'>('loading');

  const [rarityItems,  setRarityItems]  = useState<any[]>([]);
  const [bitmapsVer,   setBitmapsVer]   = useState(0);
  const [filter,       setFilter]       = useState<{ folder: string; stem: string; layerLabel: string; assetName: string } | null>(null);
  const [tierFilter,   setTierFilter]   = useState<string | null>(null);
  const [gridPage,     setGridPage]     = useState(0);
  const jobBitmaps = useRef<Record<string, ImageBitmap>>({});
  const [layers, setLayers] = useState<any[]>(layersProp);
  const lastFailedJobIdRef = useRef<string | null>(null);
  const dbJobIdRef         = useRef<string | null>(null);
  // Set the instant a real generation starts (before the DB even has a job row for
  // it yet) so the auto-restore-on-mount effect below can bail for the whole
  // generation window, not just after dbJobIdRef is finally populated.
  const generationStartedRef = useRef(false);
  // editionNumber → itemId UUID (populated during persistToDb, used for IPFS CID writeback)
  const editionItemMapRef  = useRef<Record<number, string>>({});

  // ── Check whether this collection has active layers in DB ────────────────
  // Re-runs whenever layersProp/layers actually gain data (not just on mount) —
  // otherwise a collectionId that's set before the parent's own layer fetch
  // resolves gets stuck on the self-fetch's stale first verdict.
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
  }, [collectionId, (layersProp as any[]).length, layers.length]);

  // ── Load Filebase bucket list for export dropdown ────────────────────────
  useEffect(() => {
    let cancelled = false;
    setBucketsLoading(true);
    fetch('/api/filebase/buckets')
      .then(r => r.ok ? r.json() : { buckets: [] })
      .then(data => {
        if (cancelled) return;
        const names: string[] = (data.buckets ?? []).map((b: any) => b.name).filter(Boolean);
        setBucketList(names);
        if (names.length > 0 && !svrBucket) setSvrBucket(names[0]);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setBucketsLoading(false); });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-restore done state from DB on mount ─────────────────────────────
  useEffect(() => {
    if (!collectionId || phase !== 'idle') return;
    let cancelled = false;
    (async () => {
      // Retry up to 3× with 5s backoff — BearthApi pool may be briefly stressed
      // after a heavy generation run, causing the first restore attempt to fail.
      // The backoff means this can still be in flight when the user starts a
      // real generation from this same mount; if it resolves after that, it
      // must not clobber the job the user actually just generated — confirmed
      // live 2026-08-17: this restore landed after a fresh generate and
      // silently swapped the UI back to an older, unrelated completed job.
      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled || generationStartedRef.current) return;
        if (attempt > 0) await new Promise(r => setTimeout(r, 5_000));
        try {
          if (cancelled || generationStartedRef.current) return;
          const r = await fetch(`/api/nft-gen/jobs?collectionId=${collectionId}&status=complete`);
          if (!r.ok || cancelled || generationStartedRef.current) continue;
          const data = await r.json();
          if (cancelled || generationStartedRef.current || !data.jobs?.length) return;
          const latestJob = data.jobs[0];
          if (generationStartedRef.current) return; // real generation won the race — don't set dbJobIdRef to a stale job
          dbJobIdRef.current = latestJob.id;
          await loadAndDisplayFromDb(latestJob.id);
          if (cancelled || generationStartedRef.current) return;
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

  // ── Check for pre-built ZIP after server export completes ────────────────
  useEffect(() => {
    if (svrStatus !== 'done' || !dbJobIdRef.current) return;
    const bucket = svrBucket === '__new__' ? svrNewBucket.trim() : svrBucket.trim();
    const qs = bucket ? `?bucket=${encodeURIComponent(bucket)}` : '';
    fetch(`/api/nft-gen/export/presigned-zip/${dbJobIdRef.current}${qs}`)
      .then(r => r.ok ? r.json() : { ready: false })
      .then(d => { if (d.ready) setZipReady(true); })
      .catch(() => {});
  }, [svrStatus]);

  // ── Server export helpers ─────────────────────────────────────────────────

  async function startServerExport() {
    const bucket = svrBucket === '__new__' ? svrNewBucket.trim() : svrBucket.trim();
    if (!bucket || !dbJobIdRef.current) return;
    setSvrStatus('running');
    setSvrProgress(svrResumeFrom || 0);
    setSvrPhase(svrResumeFrom > 0 ? `Resuming from ${svrResumeFrom.toLocaleString()}…` : 'Starting…');
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
          syncToRecords:  svrSyncRecords,
          resumeFrom:     svrResumeFrom || 0,
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
          resp = await fetchWithTimeout(`/api/nft-gen/export/${svrExportIdRef.current}`);
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

  async function startRefreshCids() {
    const bucket = svrBucket === '__new__' ? svrNewBucket.trim() : svrBucket.trim();
    if (!bucket) return;
    setCidStatus('running');
    setCidProgress(0);
    setCidTotal(0);
    setCidResolved(0);
    setCidSkipped(0);
    setCidPhase('Starting…');
    setCidError('');

    try {
      const r = await fetch('/api/nft-gen/export/refresh-cids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket, format: imgExt }),
      });
      let d: any = null;
      try { d = await r.json(); } catch { /* empty or non-JSON body */ }
      if (!r.ok) { setCidStatus('error'); setCidError(d?.error ?? `Server error (${r.status})`); return; }
      const refreshId = d?.refreshId;
      if (!refreshId) { setCidStatus('error'); setCidError('No refreshId returned from server'); return; }

      let cidPollFailures = 0;
      cidPollRef.current = setInterval(async () => {
        let resp: Response;
        let pr: any = null;
        try {
          resp = await fetchWithTimeout(`/api/nft-gen/export/refresh-cids/${refreshId}`);
          pr = await resp.json();
        } catch {
          cidPollFailures++;
          if (cidPollFailures >= 3) {
            clearInterval(cidPollRef.current!); cidPollRef.current = null;
            setCidStatus('error'); setCidError('Lost connection to server.');
          }
          return;
        }
        if (!resp.ok) {
          clearInterval(cidPollRef.current!); cidPollRef.current = null;
          setCidStatus('error'); setCidError(pr?.error ?? 'Refresh failed');
          return;
        }
        setCidProgress(pr.progress ?? 0);
        setCidTotal(pr.total ?? 0);
        setCidResolved(pr.resolved ?? 0);
        setCidSkipped(pr.skipped ?? 0);
        setCidPhase(pr.phase ?? '');
        if (pr.status === 'done') {
          setCidStatus('done');
          clearInterval(cidPollRef.current!); cidPollRef.current = null;
        } else if (pr.status === 'error') {
          setCidStatus('error'); setCidError(pr.error ?? 'Refresh failed');
          clearInterval(cidPollRef.current!); cidPollRef.current = null;
        }
      }, 2000);
    } catch (e: any) {
      setCidStatus('error');
      setCidError(e.message ?? 'Failed to start CID refresh');
    }
  }

  async function downloadOfflineZip() {
    if (!dbJobIdRef.current) return;

    // Fast path: check if a pre-built ZIP exists in Filebase from the last
    // server-side export. If so, use the pre-signed URL (direct S3 speed,
    // no re-rendering, no server-streaming bottleneck).
    try {
      const bucket = svrBucket === '__new__' ? svrNewBucket.trim() : svrBucket.trim();
      const qs = bucket ? `?bucket=${encodeURIComponent(bucket)}` : '';
      const r = await fetch(`/api/nft-gen/export/presigned-zip/${dbJobIdRef.current}${qs}`);
      if (r.ok) {
        const d = await r.json();
        if (d.ready && d.url) {
          window.location.href = d.url;
          return;
        }
      }
    } catch { /* fall through to streaming */ }

    // Streaming fallback: re-renders on the fly (slower, no Filebase needed).
    const params = new URLSearchParams({
      format: imgExt,
      width: String(targetW),
      height: String(targetH),
      collectionName: collName,
      description,
      nameFormat,
      externalUrl: externalUrlBase,
    });
    window.location.href = `/api/nft-gen/export/download-zip/${dbJobIdRef.current}?${params.toString()}`;
  }

  const [zipReady, setZipReady] = useState(false);
  const [syncingLayers, setSyncingLayers] = useState(false);
  async function syncLayersNow() {
    if (!collectionId || syncingLayers) return;
    setSyncingLayers(true);
    setError('');
    try {
      // A real layer set legitimately takes several seconds even with the
      // bulk sync fix — give this a longer budget than the default so a
      // large collection doesn't get cut off mid-sync.
      const r = await fetchWithTimeout(`/api/nft-gen/collections/${collectionId}/sync-from-disk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layers: layersProp }),
      }, 60_000);
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
    if (!collection?.supply) { setError('Collection size is still loading — wait a moment and try again.'); return; }
    generationStartedRef.current = true;
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
          resp = await fetchWithTimeout(`/api/nft-gen/generate/${genId}`);
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

      // Fetch items only — don't block on bitmap loading.
      // Fixed high limit (matches server's own safety ceiling), NOT the client
      // `supply` guess — `supply` can still be the ??100 fallback while
      // collection is loading, which would silently truncate the grid below
      // the real count. 50000 is a safety bound, not a business cap —
      // collections are expected to grow well past 10K.
      const itemsResp = await fetchWithTimeout(`/api/nft-gen/jobs/${jobId}/display-items?limit=50000`, {}, 30_000);

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

      // Load bitmaps in background, in small batches — bump bitmapsVer after
      // EACH batch instead of once at the very end. Previously this was one
      // giant Promise.all over every unique trait image in the whole
      // generated set, so the entire grid stayed blank until all of them
      // arrived (confirmed live: a 1000-NFT set with ~213 distinct trait
      // images left every visible card blank for several seconds after
      // "NFTs Ready" appeared). Cards already lazy-draw via
      // IntersectionObserver as soon as their own bitmaps exist, so
      // progressively unlocking bitmaps in batches lets visible cards start
      // filling in almost immediately instead of waiting for the whole set.
      const BITMAP_BATCH = 24;
      (async () => {
        for (let i = 0; i < rels.length; i += BITMAP_BATCH) {
          const batch = rels.slice(i, i + BITMAP_BATCH);
          await Promise.all(batch.map(async (rel) => {
            if (jobBitmaps.current[rel]) return;
            try {
              const res = await fetchWithTimeout(`/api/layer-raw/${rel}`);
              if (res.ok) {
                const blob = await res.blob();
                jobBitmaps.current[rel] = await createImageBitmap(blob);
              }
            } catch {}
          }));
          setBitmapsVer(v => v + 1);
        }
      })().catch(() => {});
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

  const PAGE_SIZE = 200;

  const visibleItems = useMemo(() => {
    let base = filter
      ? rarityItems.filter(({ combo }) => combo[filter.folder]?.stem === filter.stem)
      : rarityItems;
    if (tierFilter) base = base.filter(item => item.tier === tierFilter);
    if (sortBy === 'rarity') return [...base].sort((a, b) => a.rank - b.rank);
    return [...base].sort((a, b) => a.index - b.index);
  }, [rarityItems, filter, tierFilter, sortBy]);

  // Only render one page at a time — full sort/filter on all items, display is paginated
  const pageItems = useMemo(() =>
    visibleItems.slice(gridPage * PAGE_SIZE, (gridPage + 1) * PAGE_SIZE),
  [visibleItems, gridPage]);

  const totalPages = Math.max(1, Math.ceil(visibleItems.length / PAGE_SIZE));

  // Reset to first page whenever filter or sort changes
  useEffect(() => { setGridPage(0); }, [filter, tierFilter, sortBy]);

  function handleTierClick(label: string) {
    setTierFilter(prev => prev === label ? null : label);
  }

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

  // ── Server-side generation in progress (must come before idle check) ─────────
  if (svrGenStatus === 'running') {
    const pctGen = svrGenTotal > 0 ? (svrGenProgress / svrGenTotal) * 100 : 0;
    return (
      <div className="export-page">
        <div className="exp-loading-card">
          <Spinner size={32} color="var(--accent)" />
          <div className="exp-loading-title">Generating {svrGenTotal > 0 ? svrGenTotal.toLocaleString() : supply.toLocaleString()} NFTs on server…</div>
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
              <div className="exp-idle-sub">{supply > 0 ? `Generate all ${supply.toLocaleString()} NFTs \u2014 composite images, rarity scores, and metadata` : 'Configure your collection in Settings, then generate NFTs here'}</div>
            </div>
            <Link
              href="/dashboard/generator/sync-status"
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', textDecoration: 'none', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {'\ud83d\udccb'} Collection Sync Status
            </Link>
          </div>

          {/* Collection summary */}
          <div className="exp-section">
            <div className="exp-section-label">Collection Summary</div>
            <div className="exp-summary-grid">
              {[
                { label: 'Name',       value: collName        || '—' },
                { label: 'Supply',     value: collection?.supply ? Number(collection.supply).toLocaleString() : '—' },
                { label: 'Blockchain', value: collection?.network || collection?.blockchain || '—' },
                { label: 'Format',     value: collection?.formatType ? collection.formatType.toUpperCase() : '—' },
                { label: 'Resolution', value: (collection?.width && collection?.height) ? collection.width + '×' + collection.height : '—' },
              ].map(item => (
                <div key={item.label} className="exp-summary-stat">
                  <div className="exp-summary-stat-label">{item.label}</div>
                  <div className="exp-summary-stat-val">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="exp-idle-options">
            <div className="exp-idle-option-card">
              <div className="exp-option-label">Website URL <span className="exp-option-hint">(optional — OpenSea "View on Website" link)</span></div>
              <input
                className="exp-text-input"
                placeholder="https://bearth.io/nft"
                value={externalUrlBase}
                onChange={e => setExternalUrlBase(e.target.value)}
              />
              <div className="exp-option-sub">All NFTs share the same URL: <code>{externalUrlBase.trim() ? externalUrlBase.trim().replace(/\/$/, '') : 'https://www.imbearth.com'}</code></div>
            </div>
          </div>

          {layerStatus === 'empty' && (
            <div className="exp-error-banner" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {(!collection?.width || !collection?.height) && (
            <div className="exp-error-banner">
              Dimensions not configured — go to <strong>Settings</strong> and set Width and Height before generating.
            </div>
          )}
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
              disabled={!collection?.width || !collection?.height || !collectionId || svrGenStatus === 'running' || layerStatus === 'loading' || layerStatus === 'empty'}
            >
              {layerStatus === 'loading' ? '⌛ Checking layers…' : supply > 0 ? `⚡ Generate ${supply.toLocaleString()} NFTs` : `⚡ Generate NFTs`}
            </button>
          </div>
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
            <div className="exp-ready-badge">{rarityItems.length > 0 ? rarityItems.length.toLocaleString() : supply.toLocaleString()} NFTs Ready</div>
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
            <button className="btn btn-ghost" onClick={() => { setPhase('idle'); setRarityItems([]); }}>
              ↺ Regenerate
            </button>
          </div>
        </div>

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
            <span>{rarityItems.length > 0 ? rarityItems.length.toLocaleString() : supply.toLocaleString()} items saved to database</span>
          </div>
        )}
        {dbError && !dbSaving && (
          <div className="exp-banner exp-banner-error">
            <div className="exp-banner-error-body">
              <div className="exp-banner-error-msg">Failed to save to database: {dbError}</div>
              <div className="exp-banner-error-sub">
                Your {rarityItems.length.toLocaleString()} generated NFTs are still in memory.
                When the server recovers, click Retry to persist.
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
            <button
              key={t.label}
              className={`exp-tier-pill exp-tier-pill-clickable${tierFilter === t.label ? ' exp-tier-pill-active' : ''}`}
              style={{
                borderColor: tierFilter === t.label ? t.color : `${t.color}33`,
                background: tierFilter === t.label ? `${t.color}18` : undefined,
              }}
              onClick={() => handleTierClick(t.label)}
              title={tierFilter === t.label ? `Showing only ${t.label} — click to clear` : `Show only ${t.label} NFTs`}
            >
              <span className="exp-tier-dot" style={{ background: t.color }} />
              <span style={{ color: t.color, fontWeight: 700 }}>{t.label}</span>
              <span className="exp-tier-pill-sub">{t.sub}</span>
            </button>
          ))}
          {tierFilter && (
            <button className="exp-tier-clear" onClick={() => setTierFilter(null)}>✕ Clear tier filter</button>
          )}
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

      {/* ── Offline Download (images + metadata, no IPFS/Filebase) ── */}
      {dbSaved && dbJobIdRef.current && (
        <div className="exp-fb-card exp-svr-card" data-testid="offline-download-section">
          <div className="exp-fb-header">
            <div className="exp-fb-title">Download All (Offline)</div>
            <div className="exp-fb-sub">
              {zipReady
                ? 'Pre-built ZIP ready in Filebase — instant download via direct link (no server re-render)'
                : `ZIP of all ${supply.toLocaleString()} composited images + metadata — local only, no Filebase upload, no NFT Records sync`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <button
              className="btn btn-primary"
              onClick={downloadOfflineZip}
              data-testid="download-offline-zip-btn"
            >
              {zipReady ? '⚡ Instant Download — ' : '⬇ Download All '}
              {supply.toLocaleString()} NFTs + Metadata (.zip)
            </button>
          </div>
        </div>
      )}

      {/* ── Server-Side Export ── */}
      {dbSaved && dbJobIdRef.current && (
        <div className="exp-fb-card exp-svr-card" data-testid="server-export-section">
          <div className="exp-fb-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div className="exp-fb-title">Server-Side Export</div>
              <div className="exp-fb-sub">
                Recommended for large collections — compositing and IPFS upload run on the server (no browser limits)
              </div>
            </div>
            <Link
              href="/dashboard/generator/sync-status"
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}
            >
              {'📋'} All Collections
            </Link>
          </div>

          {svrStatus === 'idle' && (
            <>
              <div className="exp-fb-bucket-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {bucketsLoading ? (
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>Loading buckets…</span>
                ) : (
                  <select
                    className="exp-fb-input"
                    style={{ minWidth: 200 }}
                    value={svrBucket}
                    onChange={e => { setSvrBucket(e.target.value); if (e.target.value !== '__new__') setSvrNewBucket(''); }}
                  >
                    {bucketList.length === 0 && <option value="">— no buckets found —</option>}
                    {bucketList.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                    <option value="__new__">+ Create new bucket…</option>
                  </select>
                )}
                {svrBucket === '__new__' && (
                  <input
                    className="exp-fb-input"
                    style={{ minWidth: 180 }}
                    placeholder="New bucket name"
                    value={svrNewBucket}
                    onChange={e => setSvrNewBucket(e.target.value)}
                    autoFocus
                  />
                )}
                <button
                  className="btn btn-primary"
                  onClick={startServerExport}
                  disabled={svrBucket === '__new__' ? !svrNewBucket.trim() : !svrBucket.trim()}
                >
                  ⚡ Start Export
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input
                  type="checkbox"
                  id="syncToRecords"
                  checked={svrSyncRecords}
                  onChange={e => setSvrSyncRecords(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label htmlFor="syncToRecords" style={{ fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
                  Sync to NFT Records (production only — leave unchecked for test runs)
                </label>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input
                  type="number"
                  id="resumeFromInput"
                  data-testid="resume-from-input"
                  min={0}
                  max={supply}
                  value={svrResumeFrom || ''}
                  placeholder="0"
                  onChange={e => setSvrResumeFrom(Math.max(0, Number(e.target.value) || 0))}
                  className="exp-fb-input"
                  style={{ width: 90 }}
                />
                <label htmlFor="resumeFromInput" style={{ fontSize: 13, userSelect: 'none', color: 'var(--text-muted)' }}>
                  Resume from edition (0 = start fresh)
                </label>
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

      {/* ── Refresh IPFS CIDs ── */}
      {dbSaved && dbJobIdRef.current && (
        <div className="exp-fb-card exp-svr-card" data-testid="refresh-cids-section">
          <div className="exp-fb-header">
            <div>
              <div className="exp-fb-title">Refresh IPFS CIDs</div>
              <div className="exp-fb-sub">
                After export completes, Filebase assigns real IPFS CIDs to each image (10–30 s delay).
                Run this to replace <code>ipfs://pending/…</code> placeholders with real CIDs in all metadata files.
              </div>
            </div>
          </div>

          {cidStatus === 'idle' && (
            <div style={{ marginTop: 10 }}>
              <button
                className="btn btn-primary"
                onClick={startRefreshCids}
                disabled={!svrBucket.trim() && !svrNewBucket.trim()}
                data-testid="refresh-cids-btn"
              >
                🔄 Refresh IPFS CIDs
              </button>
              {cidError && <div className="exp-error-banner" style={{ marginTop: 8 }}>{cidError}</div>}
            </div>
          )}

          {cidStatus === 'running' && (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Spinner size={16} color="var(--accent)" />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{cidPhase || 'Working…'}</span>
              </div>
              {cidTotal > 0 && (
                <>
                  <ProgressBar value={cidProgress} max={cidTotal} />
                  <div className="exp-step-count">{cidProgress.toLocaleString()} / {cidTotal.toLocaleString()}</div>
                </>
              )}
            </div>
          )}

          {cidStatus === 'done' && (
            <div className="exp-banner exp-banner-saved" style={{ marginTop: 14 }}>
              <CheckIcon size={15} />
              <span>
                {cidResolved.toLocaleString()} CIDs resolved
                {cidSkipped > 0 ? ` · ${cidSkipped.toLocaleString()} skipped (run again in 30 s to pick up remaining)` : ''}
              </span>
              <button className="btn btn-ghost" style={{ marginLeft: 'auto' }}
                onClick={() => { setCidStatus('idle'); setCidProgress(0); setCidTotal(0); }}
              >
                Run again
              </button>
            </div>
          )}

          {cidStatus === 'error' && (
            <div className="exp-banner exp-banner-error" style={{ marginTop: 14 }}>
              <span>CID refresh failed: {cidError}</span>
              <button className="exp-retry-btn" onClick={() => { setCidStatus('idle'); setCidError(''); }}>↺ Retry</button>
            </div>
          )}
        </div>
      )}

      {popup && <NftPopup item={{ ...popup, total: supply }} onClose={() => setPopup(null)} />}
    </div>
  );
}
