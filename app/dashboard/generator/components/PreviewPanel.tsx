// @ts-nocheck
'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { generateAllCombos, computeRarity } from '../../../../lib/studio/combos';
import { useLayerFiles } from '../LayerFilesContext';

const THUMB = 160; // thumbnail px

// ── Sort + filter ─────────────────────────────────────────────────────────────
function applyView(items, sort, filter) {
  // items: [{ combo, index, score, rank }]
  let result = filter
    ? items.filter(({ combo }) => combo[filter.folder]?.stem === filter.stem)
    : [...items];

  if (sort === 'rare-first') {
    result.sort((a, b) => b.score - a.score); // highest rarity score first
  } else if (sort === 'rare-last') {
    result.sort((a, b) => a.score - b.score); // lowest rarity score first
  }
  // 'shuffle' = insertion order (randomised by generateAllCombos)
  return result;
}

// ── NFT Card — lazy composites via IntersectionObserver ───────────────────────
function NFTCard({ index, rank, combo, layers, bitmapCache, canvasW, canvasH, onClick }) {
  const canvasRef  = useRef(null);
  const composited = useRef(false);

  function draw() {
    if (composited.current || !canvasRef.current) return;
    composited.current = true;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);
    for (const layer of layers) {
      const pick = combo[layer.folder];
      if (!pick?.rel) continue;
      const bm = bitmapCache.current[pick.rel];
      if (bm) ctx.drawImage(bm, 0, 0, canvasW, canvasH);
    }
  }

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { draw(); obs.disconnect(); } },
      { rootMargin: '400px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  function handleClick() {
    if (!composited.current) draw();
    const src   = canvasRef.current?.toDataURL() ?? '';
    const attrs = layers
      .filter(l => combo[l.folder] && combo[l.folder].rel !== null)
      .map(l => ({ trait_type: l.label, value: combo[l.folder].name }));
    onClick({ index, rank, src, attrs });
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
        {rank && (
          <div className="prev-rank-badge">#{rank}</div>
        )}
      </div>
      <div className="prev-card-body">
        <div className="prev-card-name">#{index}</div>
      </div>
    </div>
  );
}

// ── NFT Popup ─────────────────────────────────────────────────────────────────
function NFTPopup({ item, onClose }) {
  return (
    <div className="nft-popup-overlay" onClick={onClose}>
      <div className="nft-popup" onClick={e => e.stopPropagation()}>
        <button className="nft-popup-close" onClick={onClose}>✕</button>
        <div className="nft-popup-left">
          <img src={item.src} alt={`#${item.index}`} className="nft-popup-img" />
        </div>
        <div className="nft-popup-right">
          <div className="nft-popup-num">#{item.index}</div>
          {item.rank && (
            <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 8 }}>
              Rarity rank #{item.rank}
            </div>
          )}
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

  const bitmapCache = useRef({});
  // Scored items: [{ combo, index, score, rank }] — stable across filter/sort changes
  const scoredRef   = useRef([]);
  const sortRef     = useRef('shuffle');
  const filterRef   = useRef(null);

  // Close sort dropdown when clicking outside
  const sortWrapRef = useRef(null);
  useEffect(() => {
    if (!sortOpen) return;
    function onDoc(e) {
      if (sortWrapRef.current && !sortWrapRef.current.contains(e.target)) {
        setSortOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [sortOpen]);

  const rebuild = useCallback((scored, sort, f) => {
    setVisible(applyView(scored, sort, f));
  }, []);

  async function run() {
    setPhase('loading');

    // ── 1. Pre-load all unique layer images ───────────────────────────────────
    const rels = [...new Set(
      layers.flatMap(l => l.assets.filter(a => a.rel).map(a => a.rel))
    )];
    let loaded = 0;
    setLoadMsg(`Loading images… 0 / ${rels.length}`);

    await Promise.all(rels.map(async rel => {
      if (bitmapCache.current[rel]) { setLoadMsg(`Loading images… ${++loaded} / ${rels.length}`); return; }
      try {
        const blobUrl = getBlobUrl(rel);
        const src = blobUrl ?? `/api/layer-img/${rel}?w=${canvasW}&h=${canvasH}`;
        const res = await fetch(src);
        if (res.ok) {
          const blob = await res.blob();
          try {
            bitmapCache.current[rel] = await createImageBitmap(blob, {
              resizeWidth: canvasW, resizeHeight: canvasH, resizeQuality: 'medium',
            });
          } catch {
            bitmapCache.current[rel] = await createImageBitmap(blob);
          }
        }
      } catch {}
      setLoadMsg(`Loading images… ${++loaded} / ${rels.length}`);
    }));

    // ── 2. Generate combos + compute real rarity scores ───────────────────────
    setLoadMsg('Generating combinations…');
    await new Promise(r => setTimeout(r, 0));

    const combos  = generateAllCombos(supply, layers, weights, conflicts);
    const rarity  = computeRarity(combos, layers); // [{ index, score, rank, attrs }]

    // Build scored items array (index is 1-based, matching rarity output)
    const scored = combos.map((combo, i) => {
      const r = rarity.find(x => x.index === i + 1);
      return { combo, index: i + 1, score: r?.score ?? 0, rank: r?.rank ?? i + 1 };
    });

    scoredRef.current  = scored;
    sortRef.current    = 'shuffle';
    filterRef.current  = null;
    setSortBy('shuffle');
    setFilter(null);
    rebuild(scored, 'shuffle', null);
    setPhase('ready');
  }

  // Auto-run on mount
  useEffect(() => { if (layers.length > 0) run(); }, []);

  function handleSort(s) {
    setSortBy(s);
    sortRef.current = s;
    setSortOpen(false);

    if (s === 'shuffle') {
      // Re-randomise: new combos + new rarity scores
      const combos  = generateAllCombos(supply, layers, weights, conflicts);
      const rarity  = computeRarity(combos, layers);
      const scored  = combos.map((combo, i) => {
        const r = rarity.find(x => x.index === i + 1);
        return { combo, index: i + 1, score: r?.score ?? 0, rank: r?.rank ?? i + 1 };
      });
      scoredRef.current = scored;
      rebuild(scored, s, filterRef.current);
    } else {
      rebuild(scoredRef.current, s, filterRef.current);
    }
  }

  function handleTraitClick(layer, asset) {
    const same = filter?.folder === layer.folder && filter?.stem === asset.stem;
    const next = same
      ? null
      : { folder: layer.folder, stem: asset.stem, layerLabel: layer.label, assetName: asset.name };
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

      {/* ── Right: grid ── */}
      <div className="preview-right-panel">
        {phase === 'loading' && (
          <div className="preview-empty">
            <div className="loading"><div className="spinner" /></div>
            <div style={{ color:'var(--dim)', fontSize:13, marginTop:12 }}>{loadMsg}</div>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <div className="prev-controls-bar">
              <div className="prev-tokens-badge">
                {visible.length.toLocaleString()} tokens
              </div>
              <div ref={sortWrapRef} style={{ position: 'relative' }}>
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
                  No NFTs in this sample contain <b>{filter.assetName}</b>.{' '}
                  <button className="link-btn" onClick={run}>Randomize</button>
                </div>
              </div>
            )}

            <div className="prev-grid">
              {visible.map(({ combo, index, rank }) => (
                <NFTCard
                  key={index}
                  index={index}
                  rank={sortBy !== 'shuffle' ? rank : null}
                  combo={combo}
                  layers={layers}
                  bitmapCache={bitmapCache}
                  canvasW={canvasW}
                  canvasH={canvasH}
                  onClick={setPopup}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {popup && <NFTPopup item={popup} onClose={() => setPopup(null)} />}
    </div>
  );
}
