// @ts-nocheck
'use client';
import { useState, useRef, useEffect } from 'react';

function pickWeighted(assets, ws) {
  const pool = assets.filter(a => (ws[a.stem] ?? a.defaultWeight ?? 1) > 0);
  if (!pool.length) return null;
  const tot = pool.reduce((s, a) => s + (ws[a.stem] ?? a.defaultWeight ?? 1), 0);
  let r = Math.random() * tot;
  for (const a of pool) {
    r -= ws[a.stem] ?? a.defaultWeight ?? 1;
    if (r <= 0) return a;
  }
  return pool[pool.length - 1];
}

const IMG_CACHE = {};
function getImg(url) {
  if (!IMG_CACHE[url]) {
    IMG_CACHE[url] = new Promise(res => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => res(img);
      img.onerror = () => res(null);
      img.src = url;
    });
  }
  return IMG_CACHE[url];
}

async function composite(layers, weights, canvasW, canvasH, conflicts) {
  const canvas = document.createElement('canvas');
  canvas.width  = canvasW;
  canvas.height = canvasH;
  const ctx   = canvas.getContext('2d');
  const attrs = [];

  const picks = layers.map(layer => ({
    layer,
    pick: pickWeighted(layer.assets, weights[layer.folder] ?? {}),
  }));

  if (conflicts?.length) {
    const byFolder = {};
    picks.forEach(p => { byFolder[p.layer.folder] = p; });

    const normalized = conflicts
      .map(r => ({
        type:       r.type ?? 'exclude',
        ifLayer:    r.ifLayer,
        ifTrait:    r.ifTrait,
        thenLayer:  r.thenLayer,
        thenTraits: Array.isArray(r.thenTraits) ? r.thenTraits : (r.thenTrait ? [r.thenTrait] : []),
      }))
      .filter(r => r.thenTraits.length);

    for (let pass = 0; pass < 5; pass++) {
      let changed = false;
      for (const rule of normalized) {
        const ifEntry   = byFolder[rule.ifLayer];
        const thenEntry = byFolder[rule.thenLayer];
        if (!ifEntry || !thenEntry) continue;
        if (ifEntry.pick?.stem !== rule.ifTrait) continue;

        const ws = weights[thenEntry.layer.folder] ?? {};

        if (rule.type === 'exclude') {
          if (!rule.thenTraits.includes(thenEntry.pick?.stem)) continue;
          const valid = thenEntry.layer.assets.filter(
            a => !rule.thenTraits.includes(a.stem) && (ws[a.stem] ?? a.defaultWeight ?? 1) > 0
          );
          if (valid.length) { thenEntry.pick = pickWeighted(valid, ws); changed = true; }
        } else {
          if (rule.thenTraits.includes(thenEntry.pick?.stem)) continue;
          const valid = thenEntry.layer.assets.filter(
            a => rule.thenTraits.includes(a.stem) && (ws[a.stem] ?? a.defaultWeight ?? 1) > 0
          );
          if (valid.length) { thenEntry.pick = pickWeighted(valid, ws); changed = true; }
        }
      }
      if (!changed) break;
    }
  }

  const imgs = await Promise.all(
    picks.map(({ pick }) =>
      pick?.rel
        ? getImg(`/api/layer-img/${pick.rel}?w=${canvasW}&h=${canvasH}`)
        : Promise.resolve(null)
    )
  );

  picks.forEach(({ layer, pick }, i) => {
    if (imgs[i]) ctx.drawImage(imgs[i], 0, 0, canvasW, canvasH);
    if (pick && pick.rel !== null) {
      attrs.push({ trait_type: layer.folder, trait_label: layer.label, value: pick.name });
    }
  });

  return { src: canvas.toDataURL(), attrs };
}

function applyFilterSort(source, sort, f) {
  let result = [...source];
  if (sort === 'rare-first') result.sort((a, b) => b.attrs.length - a.attrs.length);
  else if (sort === 'rare-last') result.sort((a, b) => a.attrs.length - b.attrs.length);
  if (f) {
    result = result.filter(item =>
      item.attrs.some(a => a.trait_type === f.folder && a.value === f.assetName)
    );
  }
  return result;
}

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
              className={`plr-trait-row${isActive && activeFilter?.assetName === a.name ? ' plr-trait-active' : ''}`}
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
                <span className="nft-attr-type">{a.trait_label ?? a.trait_type}</span>
                <span className="nft-attr-val">{a.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const BATCH_SIZE = 8;

export default function PreviewPanel({ weights, layers, collection, conflicts }) {
  const supply  = collection?.supply ?? 100;
  const srcW    = collection?.width  ?? 512;
  const srcH    = collection?.height ?? 512;
  const scale   = Math.min(512 / srcW, 512 / srcH, 1);
  const canvasW = Math.round(srcW * scale);
  const canvasH = Math.round(srcH * scale);

  const [phase,    setPhase]    = useState('idle');
  const [items,    setItems]    = useState([]);
  const [progress, setProgress] = useState(0);
  const [sortBy,   setSortBy]   = useState('shuffle');
  const [sortOpen, setSortOpen] = useState(false);
  const [filter,   setFilter]   = useState(null);
  const [popup,    setPopup]    = useState(null);

  const genRef     = useRef(0);
  const allRef     = useRef([]);
  const runningRef = useRef(false);
  const sortByRef  = useRef('shuffle');
  const filterRef  = useRef(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (layers.length > 0) run(); }, []);

  async function run() {
    if (runningRef.current) return;
    runningRef.current = true;
    const gen = ++genRef.current;

    sortByRef.current = 'shuffle';
    filterRef.current = null;
    setSortBy('shuffle');
    setFilter(null);
    setPopup(null);
    setPhase('running');
    setItems([]);
    setProgress(0);
    allRef.current = [];

    try {
      for (let start = 0; start < supply; start += BATCH_SIZE) {
        if (gen !== genRef.current) return;
        const end   = Math.min(start + BATCH_SIZE, supply);
        const batch = await Promise.all(
          Array.from({ length: end - start }, (_, i) =>
            composite(layers, weights, canvasW, canvasH, conflicts).then(r => ({ ...r, index: start + i + 1 }))
          )
        );
        if (gen !== genRef.current) return;
        allRef.current = [...allRef.current, ...batch];
        setItems(applyFilterSort(allRef.current, sortByRef.current, filterRef.current));
        setProgress(allRef.current.length);
      }
      setPhase('done');
    } finally {
      runningRef.current = false;
    }
  }

  function handleSort(s) {
    sortByRef.current = s;
    setSortBy(s);
    setSortOpen(false);
    if (s === 'shuffle') {
      run();
    } else {
      setItems(applyFilterSort(allRef.current, s, filterRef.current));
    }
  }

  function handleTraitClick(layer, asset) {
    const newFilter =
      filterRef.current?.folder === layer.folder && filterRef.current?.assetName === asset.name
        ? null
        : { folder: layer.folder, layerLabel: layer.label, assetName: asset.name, displayName: asset.name };
    filterRef.current = newFilter;
    setFilter(newFilter);
    setItems(applyFilterSort(allRef.current, sortByRef.current, newFilter));
  }

  function clearFilter() {
    filterRef.current = null;
    setFilter(null);
    setItems(applyFilterSort(allRef.current, sortByRef.current, null));
  }

  const SORT_LABELS = {
    shuffle:      'Shuffle',
    'rare-first': 'Most rare first',
    'rare-last':  'Most rare last',
  };

  const isRunning = phase === 'running';

  return (
    <div className="preview-layout">
      {/* ── Left panel ── */}
      <div className="preview-left-panel">
        <button className="randomize-btn" onClick={run} disabled={isRunning}>
          {isRunning ? `Generating… ${progress}/${supply}` : 'Randomize'}
        </button>

        {isRunning && (
          <div style={{ marginTop: -4 }}>
            <div className="prog-bg" style={{ margin: 0 }}>
              <div className="prog-fill" style={{ width: `${supply > 0 ? (progress / supply * 100).toFixed(1) : 0}%` }} />
            </div>
          </div>
        )}

        <div className="preview-count-row">
          <span className="preview-count-num">{supply.toLocaleString()}</span>
          <span className="preview-count-label">tokens</span>
        </div>

        <div className="preview-sample-note">
          Showing {supply.toLocaleString()} random samples.<br />
          Full {supply.toLocaleString()} NFTs generate on Export.
        </div>

        {filter && (
          <div className="plr-filter-badge">
            <span>Filter: <b>{filter.layerLabel ?? filter.folder} › {filter.displayName}</b></span>
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

      {/* ── Right: NFT grid ── */}
      <div className="preview-right-panel">
        {(phase !== 'idle' || items.length > 0) && (
          <div className="prev-controls-bar">
            <div className="prev-tokens-badge">{supply.toLocaleString()} Tokens</div>
            {items.length > 0 && (
              <div className="prev-sort-wrap" style={{ position: 'relative' }}>
                <button className="prev-sort-btn" onClick={() => setSortOpen(o => !o)}>
                  Sort by: {SORT_LABELS[sortBy]} ▾
                </button>
                {sortOpen && (
                  <div className="prev-sort-dropdown">
                    {Object.entries(SORT_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        className={`prev-sort-option${sortBy === key ? ' active' : ''}`}
                        onClick={() => handleSort(key)}
                      >{label}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isRunning && items.length === 0 && (
          <div className="preview-empty">
            <div className="loading"><div className="spinner" /></div>
            <div style={{ color: 'var(--dim)', fontSize: 13, marginTop: 12 }}>
              Generating preview…
            </div>
          </div>
        )}

        {phase === 'done' && items.length === 0 && filter && (
          <div className="preview-empty">
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>
              No NFTs in this sample contain <b>{filter.displayName}</b>.<br />
              Try <button className="link-btn" onClick={run}>Randomize</button> for a new sample.
            </div>
          </div>
        )}

        {items.length > 0 && (
          <div className="prev-grid">
            {items.map(item => (
              <div key={item.index} className="prev-card" onClick={() => setPopup(item)}>
                <div className="prev-thumb">
                  <img src={item.src} alt={`#${item.index}`} />
                </div>
                <div className="prev-card-body">
                  <div className="prev-card-name">#{item.index}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {popup && <NFTPopup item={popup} onClose={() => setPopup(null)} />}
    </div>
  );
}
