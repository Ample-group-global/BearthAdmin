// @ts-nocheck
'use client';
import { useState, useMemo, useCallback } from 'react';
import { TIER_PRESET_WEIGHTS } from '../../../../lib/studio/tiers';
import { calcRarity } from '../../../../lib/studio/probability';
import { useLayerFiles } from '../LayerFilesContext';

const TIER_LABELS = [
  { label: 'Legendary', color: '#F59E0B' },
  { label: 'Epic',      color: '#A855F7' },
  { label: 'Rare',      color: '#3B82F6' },
  { label: 'Common',    color: '#6B7280' },
];

export default function RarityModal({ layer, weights, supply, onSave, onDelete, onClose }) {
  // Local state for weights - starts from parent weights
  const [localWs, setLocalWs] = useState<Record<string, number>>(() => ({ ...weights }));
  const { getBlobUrl } = useLayerFiles();

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
    const eq = {};
    layer.assets.forEach(a => { eq[a.stem] = (localWs[a.stem] ?? 1) > 0 ? 1 : 0; });
    setLocalWs(eq);
  }

  function distributeByTier() {
    // Sort assets by current weight ascending — rarest first
    const sorted = [...layer.assets].sort((a, b) => (localWs[a.stem] ?? 1) - (localWs[b.stem] ?? 1));
    const n = sorted.length;
    const eq = { ...localWs };
    sorted.forEach((a, i) => {
      const pct = i / Math.max(n - 1, 1);
      if (pct < 0.10)      eq[a.stem] = TIER_PRESET_WEIGHTS.Legendary;
      else if (pct < 0.25) eq[a.stem] = TIER_PRESET_WEIGHTS.Epic;
      else if (pct < 0.50) eq[a.stem] = TIER_PRESET_WEIGHTS.Rare;
      else                 eq[a.stem] = TIER_PRESET_WEIGHTS.Common;
    });
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
          <button className="rm-tbtn" onClick={distributeByTier} title="Auto-assign weights: top 10% = Legendary (1), next 15% = Epic (3), next 25% = Rare (10), rest = Common (30)">✦ Distribute</button>
          <button className="rm-tbtn" onClick={equalizeAll}>Equalize</button>
          <button className="rm-tbtn" onClick={resetAll}>Reset</button>
        </div>

        {/* Asset List */}
        <div className="rm-list">
          {layer.assets.map(asset => {
            const w = localWs[asset.stem] ?? 1;
            const { pct, expected, tier } = calcRarity(w, totalW, supply);
            const enabled = w > 0;

            return (
              <div key={asset.stem} className={`rm-row${enabled ? '' : ' rm-row-disabled'}`}>
                {/* Thumbnail */}
                <div className="rm-thumb">
                  {asset.rel ? (
                    <img
                      src={getBlobUrl(asset.rel) ?? `/api/thumb/${asset.rel}`}
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
                      max="100"
                      step="0.5"
                      value={Math.min(w, 100)}
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
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'0 2px', marginTop:4, gap:2 }}>
                    {TIER_LABELS.map(t => (
                      <button
                        key={t.label}
                        title={`Set to ${t.label} (weight ${TIER_PRESET_WEIGHTS[t.label]})`}
                        onClick={() => setW(asset.stem, TIER_PRESET_WEIGHTS[t.label])}
                        style={{
                          fontSize:9, color: t.color, fontWeight:700, letterSpacing:'0.02em',
                          background:'transparent', border:`1px solid ${t.color}44`,
                          borderRadius:3, padding:'1px 4px', cursor:'pointer',
                          opacity: tier.label === t.label ? 1 : 0.45,
                        }}
                      >
                        {t.label}
                      </button>
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
