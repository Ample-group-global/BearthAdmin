// @ts-nocheck
'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import NftPopup from './NftPopup';
import { TIER_META, Spinner, CheckIcon, RarityCard, ProgressBar, HLayerFilter } from './ExportGridParts';

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

  const [phase,     setPhase]     = useState<'idle'|'done'>('idle');
  const [sortBy,    setSortBy]    = useState<'rarity'|'id'>('rarity');
  const [popup,     setPopup]     = useState(null);
  const [error,     setError]     = useState('');
  const [dbError,   setDbError]   = useState('');
  const [dbSaving,  setDbSaving]  = useState(false);
  const [dbSaved,   setDbSaved]   = useState(false);

  const [externalUrlBase, setExternalUrlBase] = useState(defaultExternalUrl);

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
  const [bitmapsVer,   setBitmapsVer]   = useState(0);
  const [filter,       setFilter]       = useState<{ folder: string; stem: string; layerLabel: string; assetName: string } | null>(null);
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
              const res = await fetch(`/api/layer-raw/${rel}`);
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
              <div className="exp-option-sub">Each NFT gets: <code>{externalUrlBase.trim() ? `${externalUrlBase.trim().replace(/\/$/, '')}/1` : 'https://bearth.io/nft/1'}</code></div>
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
            <span>{supply.toLocaleString()} items saved to database</span>
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
