// @ts-nocheck
'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { generateAllCombos } from '../../../../lib/studio/combos';

const THUMB    = 160;  // thumbnail px
const PAGE_SIZE = 96;  // cards per page

// ── Sort + filter ─────────────────────────────────────────────────────────────
function applyView(allCombos, sort, filter, layers) {
  let result = allCombos.map((combo, i) => ({ combo, index: i + 1 }));
  if (filter) {
    result = result.filter(({ combo }) => combo[filter.folder]?.stem === filter.stem);
  }
  if (sort === 'rare-first') {
    result.sort((a, b) =>
      Object.values(b.combo).filter(v => v?.rel !== null).length -
      Object.values(a.combo).filter(v => v?.rel !== null).length
    );
  } else if (sort === 'rare-last') {
    result.sort((a, b) =>
      Object.values(a.combo).filter(v => v?.rel !== null).length -
      Object.values(b.combo).filter(v => v?.rel !== null).length
    );
  }
  return result;
}

// ── NFT Card — lazy composites via IntersectionObserver ───────────────────────
function NFTCard({ index, combo, layers, bitmapCache, canvasW, canvasH, onClick }) {
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
    onClick({ index, src, attrs });
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
          {layer.assets.map(a => (
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
  const supply = collection?.supply ?? 100;
  const srcW   = collection?.width  ?? 512;
  const srcH   = collection?.height ?? 512;
  // Thumbnail canvas dims — keep aspect ratio, cap at THUMB
  const scale  = Math.min(THUMB / srcW, THUMB / srcH, 1);
  const canvasW = Math.max(1, Math.round(srcW * scale));
  const canvasH = Math.max(1, Math.round(srcH * scale));

  const [phase,    setPhase]    = useState('idle');
  const [loadMsg,  setLoadMsg]  = useState('');
  const [visible,  setVisible]  = useState([]);   // filtered + sorted items
  const [page,     setPage]     = useState(0);
  const [sortBy,   setSortBy]   = useState('shuffle');
  const [sortOpen, setSortOpen] = useState(false);
  const [filter,   setFilter]   = useState(null);
  const [popup,    setPopup]    = useState(null);

  const bitmapCache  = useRef({});
  const allCombosRef = useRef([]);

  const rebuild = useCallback((combos, sort, f) => {
    setVisible(applyView(combos, sort, f, layers));
    setPage(0);
  }, [layers]);

  async function run() {
    setPhase('loading');

    // ── Step 1: pre-load all unique layer images in parallel ──
    const rels = [...new Set(
      layers.flatMap(l => l.assets.filter(a => a.rel).map(a => a.rel))
    )];
    let loaded = 0;
    setLoadMsg(`Loading images… 0 / ${rels.length}`);

    await Promise.all(rels.map(async rel => {
      if (bitmapCache.current[rel]) { setLoadMsg(`Loading images… ${++loaded} / ${rels.length}`); return; }
      try {
        const res = await fetch(`/api/layer-img/${rel}?w=${canvasW}&h=${canvasH}`);
        if (res.ok) {
          const blob = await res.blob();
          bitmapCache.current[rel] = await createImageBitmap(blob);
        }
      } catch {}
      setLoadMsg(`Loading images… ${++loaded} / ${rels.length}`);
    }));

    // ── Step 2: generate all combos instantly (pure JS) ──
    setLoadMsg('Generating combinations…');
    await new Promise(r => setTimeout(r, 0)); // flush paint
    const combos = generateAllCombos(supply, layers, weights, conflicts);
    allCombosRef.current = combos;

    // ── Step 3: show ──
    setSortBy('shuffle');
    setFilter(null);
    rebuild(combos, 'shuffle', null);
    setPhase('ready');
  }

  // Auto-run on mount if layers available
  useEffect(() => { if (layers.length > 0) run(); }, []);

  function handleSort(s) {
    setSortBy(s);
    setSortOpen(false);
    if (s === 'shuffle') {
      // Re-randomize combos
      const combos = generateAllCombos(supply, layers, weights, conflicts);
      allCombosRef.current = combos;
      rebuild(combos, s, filter);
    } else {
      rebuild(allCombosRef.current, s, filter);
    }
  }

  function handleTraitClick(layer, asset) {
    const next =
      filter?.folder === layer.folder && filter?.stem === asset.stem
        ? null
        : { folder: layer.folder, stem: asset.stem, layerLabel: layer.label, assetName: asset.name };
    setFilter(next);
    rebuild(allCombosRef.current, sortBy, next);
  }

  function clearFilter() {
    setFilter(null);
    rebuild(allCombosRef.current, sortBy, null);
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

  const pages    = Math.ceil(visible.length / PAGE_SIZE);
  const pageItems = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

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
                {pages > 1 && (
                  <span style={{ color:'var(--dim)', marginLeft:8, fontSize:11 }}>
                    — page {page + 1} of {pages}
                  </span>
                )}
              </div>
              <div className="prev-sort-wrap" style={{ position:'relative' }}>
                <button className="prev-sort-btn" onClick={() => setSortOpen(o => !o)}>
                  Sort: {SORT_LABELS[sortBy]} ▾
                </button>
                {sortOpen && (
                  <div className="prev-sort-dropdown">
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
              {pageItems.map(({ combo, index }) => (
                <NFTCard
                  key={index}
                  index={index}
                  combo={combo}
                  layers={layers}
                  bitmapCache={bitmapCache}
                  canvasW={canvasW}
                  canvasH={canvasH}
                  onClick={setPopup}
                />
              ))}
            </div>

            {pages > 1 && (
              <div className="preview-pagination">
                <button className="btn btn-ghost" disabled={page <= 0} onClick={() => setPage(p => p - 1)}>
                  ← Prev
                </button>
                <span className="page-info">Page {page + 1} / {pages}</span>
                <button className="btn btn-ghost" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {popup && <NFTPopup item={popup} onClose={() => setPopup(null)} />}
    </div>
  );
}
