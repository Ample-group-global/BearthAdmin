// @ts-nocheck
'use client';
import { useState, useMemo, useCallback } from 'react';
import { getTier } from '../../../../lib/studio/tiers';

export default function RarityModal({ layer, weights, supply, onSave, onDelete, onClose }) {
  // Local state for weights - starts from parent weights
  const [localWs, setLocalWs] = useState<Record<string, number>>(() => ({ ...weights }));

  const totalW = useMemo(() => Object.values(localWs).reduce((a, b) => a + b, 0), [localWs]);

  const setW = useCallback((stem, val) => {
    setLocalWs(prev => ({ ...prev, [stem]: Math.max(0, val) }));
  }, []);

  function resetAll() {
    const eq = {};
    layer.assets.forEach(a => { eq[a.stem] = a.defaultWeight ?? 1; });
    setLocalWs(eq);
  }

  function equalizeAll() {
    const count = layer.assets.filter(a => (localWs[a.stem] ?? 1) > 0).length;
    if (!count) return;
    const eq = {};
    layer.assets.forEach(a => { eq[a.stem] = (localWs[a.stem] ?? 1) > 0 ? 1 : 0; });
    setLocalWs(eq);
  }

  function handleSave() {
    onSave(localWs);
    onClose();
  }

  return (
    <div className="rm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="rm-modal">
        {/* Header */}
        <div className="rm-header">
          <div>
            <div className="rm-title">{layer.folder} — {layer.label}</div>
            <div className="rm-sub">Layer Rarity Settings</div>
          </div>
          <button className="rm-close" onClick={onClose}>✕</button>
        </div>

        {/* Toolbar */}
        <div className="rm-toolbar">
          <span className="rm-trait-count">{layer.count} traits</span>
          <span className="rm-totalw">Total weight: {totalW.toFixed(1)}</span>
          <button className="rm-tbtn" onClick={equalizeAll}>Equalize</button>
          <button className="rm-tbtn" onClick={resetAll}>Reset</button>
        </div>

        {/* Asset List */}
        <div className="rm-list">
          {layer.assets.map(asset => {
            const w = localWs[asset.stem] ?? 1;
            const prob = totalW > 0 ? w / totalW : 0;
            const pct = (prob * 100).toFixed(2);
            const expected = Math.round(prob * supply);
            const tier = getTier(prob);
            const enabled = w > 0;

            return (
              <div key={asset.stem} className={`rm-row${enabled ? '' : ' rm-row-disabled'}`}>
                {/* Thumbnail */}
                <div className="rm-thumb">
                  {asset.rel ? (
                    <img
                      src={`/api/thumb/${asset.rel}`}
                      alt={asset.name}
                      loading="lazy"
                      onError={e => { e.currentTarget.parentElement.innerHTML = '<span class="rm-noimg">🖼</span>'; }}
                    />
                  ) : (
                    <span className="rm-none-label">NONE</span>
                  )}
                </div>

                {/* Info */}
                <div className="rm-info">
                  <div className="rm-asset-name" title={asset.name}>{asset.name}</div>
                  <div className="rm-tier-pill" style={{ background: tier.bg, color: tier.color }}>{tier.label}</div>
                </div>

                {/* Controls */}
                <div className="rm-controls">
                  <div className="rm-pct-row">
                    <span className="rm-pct">{pct}%</span>
                    <span className="rm-exp">{expected.toLocaleString()} NFTs</span>
                  </div>
                  <div className="rm-slider-row">
                    <input
                      className="rm-slider"
                      type="range"
                      min="0"
                      max="20"
                      step="0.05"
                      value={Math.min(w, 20)}
                      onChange={e => setW(asset.stem, parseFloat(e.target.value))}
                    />
                    <input
                      className="rm-w-input"
                      type="number"
                      min="0"
                      step="0.1"
                      value={w}
                      onChange={e => setW(asset.stem, Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'0 2px', marginTop:2 }}>
                    {[
                      { label:'Legendary', color:'#F59E0B' },
                      { label:'Epic',      color:'#A855F7' },
                      { label:'Rare',      color:'#3B82F6' },
                      { label:'Common',    color:'#6B7280' },
                    ].map(t => (
                      <span key={t.label} style={{ fontSize:9, color: t.color, fontWeight:600, letterSpacing:'0.02em' }}>{t.label}</span>
                    ))}
                  </div>
                </div>

                {/* Toggle */}
                <button
                  className={`rm-toggle${enabled ? ' rm-toggle-on' : ''}`}
                  onClick={() => setW(asset.stem, enabled ? 0 : 1)}
                  title={enabled ? 'Disable' : 'Enable'}
                >
                  {enabled ? '●' : '○'}
                </button>

                {/* Delete */}
                {asset.rel && (
                  <button
                    className="rm-delete-btn"
                    title="Delete trait"
                    onClick={() => {
                      if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;
                      onDelete?.(asset);
                      onClose();
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="rm-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Rarity</button>
        </div>
      </div>
    </div>
  );
}
