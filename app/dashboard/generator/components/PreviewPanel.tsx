// @ts-nocheck
'use client';
import { useState, useRef, useEffect, useLayoutEffect, useCallback, memo } from 'react';
import { pickWeighted, resolveConflicts, computeRarity } from '../../../../lib/studio/combos';
import { useLayerFiles } from '../LayerFilesContext';
import NftPopup from './NftPopup';

const THUMB      = 160;
const CARD_MIN_W = 155; // matches CSS minmax(155px, 1fr)
const GAP        = 12;  // matches CSS gap: 12px
const CARD_BODY  = 36;  // thumb body height below image (padding + name)
const OVERSCAN   = 3;   // extra rows rendered above/below viewport

// ── Sort + filter ─────────────────────────────────────────────────────────────
function applyView(items, sort, filter) {
  let result = filter
    ? items.filter(({ combo }) => combo[filter.folder]?.stem === filter.stem)
    : [...items];
  if (sort === 'rare-first') result.sort((a, b) => b.score - a.score);
  else if (sort === 'rare-last') result.sort((a, b) => a.score - b.score);
  return result;
}

// ── NFT Card ──────────────────────────────────────────────────────────────────
// memo prevents re-renders on parent scroll state changes; useLayoutEffect
// (no deps) redraws after every render so canvas is never left stale/blank.
const NFTCard = memo(function NFTCard({ index, rank, tier, score, combo, layers, bitmapCache, canvasW, canvasH, collW, collH, onClick }) {
  const canvasRef = useRef(null);

  function draw() {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);
    for (const layer of layers) {
      const pick = combo[layer.folder];
      if (!pick?.rel) continue;
      const bm = bitmapCache.current[pick.rel];
      if (bm) ctx.drawImage(bm, 0, 0, canvasW, canvasH);
    }
  }

  // No dependency array → redraws after every render, so a canvas that was
  // cleared (e.g. by a width/height attribute update) is immediately repainted.
  useLayoutEffect(() => { draw(); });

  function handleClick() {
    const attrs = layers
      .filter(l => combo[l.folder] && combo[l.folder].rel !== null)
      .map(l => ({ trait_type: l.label, value: combo[l.folder].name }));
    onClick({ index, rank, tier, score, combo, layers, bitmapCache, collW, collH, attrs });
  }

  return (
    <div className="prev-card" onClick={handleClick}>
      <div className="prev-thumb">
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        {rank && <div className="prev-rank-badge">#{rank}</div>}
      </div>
      <div className="prev-card-body">
        <div className="prev-card-name">#{index}</div>
      </div>
    </div>
  );
});

// ── Layer filter sidebar row ──────────────────────────────────────────────────
function ExpandableLayerRow({ layer, activeFilter, onTraitClick }) {
  const [open, setOpen] = useState(false);
  const isActive = activeFilter?.folder === layer.folder;
  return (
    <div className="plr-group">
      <div className="preview-layer-row" onClick={() => setOpen(o => !o)}>
        <span className="plr-chevron">{open ? '▾' : '▸'}</span>
        <span className="plr-name">{layer.label}</span>
        <span className="plr-count">{layer.count}</span>
      </div>
      {open && (
        <div className="plr-traits">
          {[...layer.assets].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })).map(a => (
            <div
              key={a.stem}
              className={`plr-trait-row${isActive && activeFilter?.stem === a.stem ? ' plr-trait-active' : ''}`}
              onClick={() => onTraitClick(layer, a)}
            >
              <span className="plr-trait-name">{a.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const SORT_LABELS = {
  shuffle:      'Shuffle',
  'rare-first': 'Most rare first',
  'rare-last':  'Most rare last',
};

// ── Main component ────────────────────────────────────────────────────────────
export default function PreviewPanel({ weights, layers, collection, conflicts }) {
  const { getBlobUrl } = useLayerFiles();
  const supply  = collection?.supply ?? 100;
  const srcW    = collection?.width  ?? 512;
  const srcH    = collection?.height ?? 512;
  const scale   = Math.min(THUMB / srcW, THUMB / srcH, 1);
  const canvasW = Math.max(1, Math.round(srcW * scale));
  const canvasH = Math.max(1, Math.round(srcH * scale));

  const [phase,    setPhase]    = useState('idle');
  const [loadMsg,  setLoadMsg]  = useState('');
  const [visible,  setVisible]  = useState([]);
  const [sortBy,   setSortBy]   = useState('shuffle');
  const [sortOpen, setSortOpen] = useState(false);
  const [filter,   setFilter]   = useState(null);
  const [popup,    setPopup]    = useState(null);

  // Virtual scroll state
  const [scrollTop,  setScrollTop]  = useState(0);
  const [gridW,      setGridW]      = useState(0);
  const [gridH,      setGridH]      = useState(600);
  const scrollRef = useRef(null);

  const bitmapCache = useRef({});
  const scoredRef   = useRef([]);
  const sortRef     = useRef('shuffle');
  const filterRef   = useRef(null);

  // Measure scroll container
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setGridW(el.clientWidth);
      setGridH(el.clientHeight);
    });
    ro.observe(el);
    setGridW(el.clientWidth);
    setGridH(el.clientHeight);
    return () => ro.disconnect();
  }, [phase]); // re-attach when phase changes to 'ready'

  // Virtual grid math
  const cols   = gridW > 0 ? Math.max(1, Math.floor((gridW + GAP) / (CARD_MIN_W + GAP))) : 4;
  const cardW  = gridW > 0 ? Math.floor((gridW - (cols - 1) * GAP) / cols) : CARD_MIN_W;
  const rowH   = cardW + CARD_BODY + GAP;
  const totalRows = Math.ceil(visible.length / cols);
  const startRow  = Math.max(0, Math.floor(scrollTop / rowH) - OVERSCAN);
  const endRow    = Math.min(totalRows - 1, Math.ceil((scrollTop + gridH) / rowH) + OVERSCAN);
  const padTop    = startRow * rowH;
  const padBot    = Math.max(0, (totalRows - endRow - 1) * rowH);
  const window_   = visible.slice(startRow * cols, (endRow + 1) * cols);

  // Close sort dropdown on outside click
  const sortWrapRef = useRef(null);
  useEffect(() => {
    if (!sortOpen) return;
    function onDoc(e) {
      if (sortWrapRef.current && !sortWrapRef.current.contains(e.target)) setSortOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [sortOpen]);

  const rebuild = useCallback((scored, sort, f) => {
    setVisible(applyView(scored, sort, f));
    setScrollTop(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, []);

  async function run() {
    setPhase('loading');

    // 1. Pre-load all unique layer bitmaps
    const rels = [...new Set(
      layers.flatMap(l => l.assets.filter(a => a.rel).map(a => a.rel))
    )];
    let loaded = 0;
    const imgTotal = rels.length;
    setLoadMsg('Loading images…');

    // Load bitmaps in small batches to avoid OOM from 86 concurrent 2000×2000 images.
    // Use server-resized 160×160 thumbnails (Sharp) instead of full-res raw PNGs.
    const BATCH = 10;
    for (let i = 0; i < rels.length; i += BATCH) {
      await Promise.all(rels.slice(i, i + BATCH).map(async rel => {
        if (bitmapCache.current[rel]) { loaded++; setLoadMsg(`Loading images… ${Math.round(loaded / imgTotal * 100)}%`); return; }
        try {
          const blobUrl = getBlobUrl(rel);
          let res: Response;
          if (blobUrl) {
            res = await fetch(blobUrl);
            // If blob URL is stale/revoked, fall back to server thumbnail
            if (!res.ok) res = await fetch(`/api/layer-img/${rel}?w=${THUMB}&h=${THUMB}`);
          } else {
            res = await fetch(`/api/layer-img/${rel}?w=${THUMB}&h=${THUMB}`);
          }
          if (res.ok) {
            const blob = await res.blob();
            bitmapCache.current[rel] = await createImageBitmap(blob);
          }
        } catch (e) {
          console.warn(`[preview] bitmap load failed for ${rel}:`, e);
        }
        loaded++;
        setLoadMsg(`Loading images… ${Math.round(loaded / imgTotal * 100)}%`);
      }));
    }

    // 2. Generate combos in chunks so the counter updates per-NFT against supply
    const seen = new Set<string>();
    const combos: Record<string, any>[] = [];
    const GEN_CHUNK = 20;
    for (let i = 0; i < supply; i += GEN_CHUNK) {
      const end = Math.min(i + GEN_CHUNK, supply);
      for (let j = i; j < end; j++) {
        let picks: Record<string, any> = {};
        let unique = false;
        for (let attempt = 0; attempt < 200; attempt++) {
          picks = {};
          for (const layer of layers) {
            const ws = weights[layer.folder] ?? {};
            const pick = pickWeighted(layer.assets, ws);
            if (pick) picks[layer.folder] = pick;
          }
          resolveConflicts(picks, conflicts, weights, layers);
          const key = layers.map((l: any) => picks[l.folder]?.stem ?? '').join('|');
          if (!seen.has(key)) { seen.add(key); unique = true; break; }
        }
        if (!unique) console.warn('[NFT Generator] Could not generate unique combo after 200 attempts.');
        combos.push(picks);
      }
      setLoadMsg(`Generating NFTs… ${end} / ${supply}`);
      await new Promise(r => setTimeout(r, 0));
    }

    // 3. Compute rarity
    setLoadMsg('Computing rarity…');
    await new Promise(r => setTimeout(r, 0));

    const rarity    = computeRarity(combos, layers);
    const rarityMap = new Map(rarity.map(r => [r.index, r]));
    const scored    = combos.map((combo, i) => {
      const r = rarityMap.get(i + 1);
      return { combo, index: i + 1, score: r?.score ?? 0, rank: r?.rank ?? i + 1, tier: r?.tier ?? 'Common' };
    });

    scoredRef.current = scored;
    sortRef.current   = 'shuffle';
    filterRef.current = null;
    setSortBy('shuffle');
    setFilter(null);
    rebuild(scored, 'shuffle', null);
    setPhase('ready');
  }

  useEffect(() => { if (layers.length > 0) run(); }, []);

  function handleSort(s) {
    setSortOpen(false);
    if (s === 'shuffle') {
      // Re-shuffle regenerates combos — bitmaps are already cached so loading phase is instant
      run();
    } else {
      setSortBy(s);
      sortRef.current = s;
      rebuild(scoredRef.current, s, filterRef.current);
    }
  }

  function handleTraitClick(layer, asset) {
    const same = filter?.folder === layer.folder && filter?.stem === asset.stem;
    const next = same ? null : { folder: layer.folder, stem: asset.stem, layerLabel: layer.label, assetName: asset.name };
    filterRef.current = next;
    setFilter(next);
    rebuild(scoredRef.current, sortRef.current, next);
  }

  function clearFilter() {
    filterRef.current = null;
    setFilter(null);
    rebuild(scoredRef.current, sortRef.current, null);
  }

  if (layers.length === 0) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', gap:12, color:'var(--dim)', textAlign:'center', padding:40 }}>
        <div style={{ fontSize:40 }}>👁️</div>
        <div style={{ fontSize:16, fontWeight:600, color:'var(--text)' }}>No layers to preview</div>
        <div style={{ fontSize:13 }}>Import and organize your layers first to generate a preview.</div>
      </div>
    );
  }

  return (
    <div className="preview-layout">
      {/* ── Left panel ── */}
      <div className="preview-left-panel">
        <button className="randomize-btn" onClick={run} disabled={phase === 'loading'}>
          {phase === 'loading' ? loadMsg : 'Randomize'}
        </button>

        <div className="preview-count-row">
          <span className="preview-count-num">{supply.toLocaleString()}</span>
          <span className="preview-count-label">tokens</span>
        </div>

        <div className="preview-sample-note">
          {phase === 'ready'
            ? visible.length < supply
              ? `${visible.length.toLocaleString()} shown (filtered)`
              : `All ${supply.toLocaleString()} NFTs`
            : 'Generating…'}
        </div>

        {filter && (
          <div className="plr-filter-badge">
            <span>Filter: <b>{filter.layerLabel} › {filter.assetName}</b></span>
            <button onClick={clearFilter} className="plr-filter-clear">✕</button>
          </div>
        )}

        <div className="preview-layer-breakdown">
          {layers.map(l => (
            <ExpandableLayerRow
              key={l.folder}
              layer={l}
              activeFilter={filter}
              onTraitClick={handleTraitClick}
            />
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="preview-right-panel">
        {phase === 'loading' && (
          <div className="preview-empty">
            <div className="loading"><div className="spinner" /></div>
            <div style={{ color:'var(--dim)', fontSize:13, marginTop:12 }}>{loadMsg}</div>
          </div>
        )}

        {phase === 'ready' && (
          <>
            {/* Controls bar — stays fixed at top, does NOT scroll */}
            <div className="prev-controls-bar">
              <div className="prev-tokens-badge">
                {visible.length.toLocaleString()} tokens
              </div>
              <div ref={sortWrapRef} style={{ position:'relative' }}>
                <button className="prev-sort-btn" onClick={() => setSortOpen(o => !o)}>
                  Sort: {SORT_LABELS[sortBy]} ▾
                </button>
                {sortOpen && (
                  <div className="prev-sort-dropdown" style={{ position:'absolute', right:0, top:'110%', zIndex:100 }}>
                    {Object.entries(SORT_LABELS).map(([k, l]) => (
                      <button
                        key={k}
                        className={`prev-sort-option${sortBy === k ? ' active' : ''}`}
                        onClick={() => handleSort(k)}
                      >{l}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {visible.length === 0 && filter && (
              <div className="preview-empty">
                <div style={{ fontSize:13, color:'var(--dim)' }}>
                  No NFTs contain <b>{filter.assetName}</b>.{' '}
                  <button className="link-btn" onClick={run}>Randomize</button>
                </div>
              </div>
            )}

            {/* Virtual scroll container — only cards in viewport are in the DOM */}
            <div
              ref={scrollRef}
              className="prev-grid-scroll"
              onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
            >
              {/* Top spacer simulates rows above the visible window */}
              {padTop > 0 && <div style={{ height: padTop }} />}

              <div
                className="prev-grid"
                style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
              >
                {window_.map(({ combo, index, rank, tier, score }) => {
                  const comboKey = `${index}-${Object.values(combo).map((a: any) => a?.stem ?? '').join('|')}`;
                  return (
                    <NFTCard
                      key={comboKey}
                      index={index}
                      rank={sortBy !== 'shuffle' ? rank : null}
                      tier={tier}
                      score={score}
                      combo={combo}
                      layers={layers}
                      bitmapCache={bitmapCache}
                      canvasW={canvasW}
                      canvasH={canvasH}
                      collW={srcW}
                      collH={srcH}
                      onClick={setPopup}
                    />
                  );
                })}
              </div>

              {/* Bottom spacer simulates rows below the visible window */}
              {padBot > 0 && <div style={{ height: padBot }} />}
            </div>
          </>
        )}
      </div>

      {popup && <NftPopup item={popup} onClose={() => setPopup(null)} />}
    </div>
  );
}
