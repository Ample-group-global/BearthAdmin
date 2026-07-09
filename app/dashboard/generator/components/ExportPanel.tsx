// @ts-nocheck
'use client';
import { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { generateAllCombos, computeRarity, applyNameFormat } from '../../../../lib/studio/combos';
import { useLayerFiles } from '../LayerFilesContext';

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

// ── Rarity card ───────────────────────────────────────────────────────────────
function RarityCard({ item, jobBitmaps, layers, canvasW, canvasH, onClick }) {
  const tierColor =
    item.rank <= Math.ceil(item.total * 0.01) ? '#F59E0B' :
    item.rank <= Math.ceil(item.total * 0.05) ? '#A855F7' :
    item.rank <= Math.ceil(item.total * 0.15) ? '#3B82F6' : '#6B7280';

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
        <div className="exp-nft-score" style={{ color: tierColor }}>Score: {item.score}</div>
      </div>
    </div>
  );
}

// ── Popup ─────────────────────────────────────────────────────────────────────
function NftPopup({ item, onClose }) {
  if (!item) return null;
  const tierColor =
    item.rank <= Math.ceil(item.total * 0.01) ? '#F59E0B' :
    item.rank <= Math.ceil(item.total * 0.05) ? '#A855F7' :
    item.rank <= Math.ceil(item.total * 0.15) ? '#3B82F6' : '#6B7280';
  return (
    <div className="nft-popup-overlay" onClick={onClose}>
      <div className="nft-popup" onClick={e => e.stopPropagation()}>
        <button className="nft-popup-close" onClick={onClose}>✕</button>
        <div className="nft-popup-left">
          <img src={item.src} alt={`#${item.index}`} className="nft-popup-img" />
        </div>
        <div className="nft-popup-right">
          <div className="nft-popup-num">#{item.index}</div>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <span style={{ fontSize:12, color: tierColor, fontWeight:700 }}>Rank #{item.rank}</span>
            <span style={{ fontSize:12, color:'var(--dim)' }}>Score: {item.score}</span>
          </div>
          <div className="nft-popup-attrs-title">Attributes</div>
          <div className="nft-popup-attrs">
            {item.attrs.map((a, i) => (
              <div key={i} className="nft-attr-row">
                <span className="nft-attr-type">{a.trait_type}</span>
                <span className="nft-attr-val">{a.value}</span>
              </div>
            ))}
          </div>
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

  // Thumbnail size for the rarity grid display
  const THUMB = Math.min(160, targetW);
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

  const { getBlobUrl } = useLayerFiles();

  const [rarityItems, setRarityItems] = useState<any[]>([]);
  const [allCombos,   setAllCombos]   = useState<any[]>([]);

  // Shared bitmap cache — pre-loaded at thumbnail size for grid display
  const jobBitmaps = useRef<Record<string, ImageBitmap>>({});

  const [layers, setLayers] = useState<any[]>(layersProp);
  const cancelledRef = useRef(false);

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
        const blobUrl = getBlobUrl(rel);
        const src = blobUrl ?? `/api/layer-img/${rel}?w=${tW}&h=${tH}`;
        const res = await fetch(src);
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

    // Register in DB if collection exists (non-fatal)
    if (collectionId) {
      try {
        const jr = await fetch(`/api/nft-gen/collections/${collectionId}/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ editionSize: supply }),
        });
        const jdata = await jr.json();
        const dbJobId = jdata?.job?.id ?? jdata?.id ?? null;
        if (dbJobId) {
          await fetch(`/api/nft-gen/jobs/${dbJobId}/start`, { method: 'POST' });
          await fetch(`/api/nft-gen/jobs/${dbJobId}/complete`, { method: 'POST' });
        }
      } catch {}
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
            const src = getBlobUrl(rel) ?? `/api/layer-raw/${rel}`;
            const res = await fetch(src);
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

        {/* ── Tier legend ── */}
        <div style={{display:'flex', gap:16, padding:'8px 0', fontSize:11, color:'var(--dim)'}}>
          {[
            {label:'Top 1%',  color:'#F59E0B'},
            {label:'Top 5%',  color:'#A855F7'},
            {label:'Top 15%', color:'#3B82F6'},
            {label:'Common',  color:'#6B7280'},
          ].map(t => (
            <span key={t.label} style={{display:'flex', alignItems:'center', gap:4}}>
              <span style={{width:8, height:8, borderRadius:'50%', background:t.color, display:'inline-block'}} />
              <span style={{color:t.color}}>{t.label}</span>
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

      {popup && <NftPopup item={{...popup, total: supply}} onClose={() => setPopup(null)} />}
    </div>
  );
}
