// @ts-nocheck
'use client';
import { useState } from 'react';
import { calcRarity } from '../../../../lib/studio/probability';
import { TIER_PRESET_WEIGHTS } from '../../../../lib/studio/tiers';
import { useLayerFiles } from '../LayerFilesContext';

const PRESETS = [
  { label: 'Disable',   weight: 0,                             color: '#9CA3AF' },
  { label: 'Legendary', weight: TIER_PRESET_WEIGHTS.Legendary, color: '#F59E0B' },
  { label: 'Epic',      weight: TIER_PRESET_WEIGHTS.Epic,      color: '#A855F7' },
  { label: 'Rare',      weight: TIER_PRESET_WEIGHTS.Rare,      color: '#3B82F6' },
  { label: 'Common',    weight: TIER_PRESET_WEIGHTS.Common,    color: '#6B7280' },
];

function CardModal({ asset, weight, totalWeight, supply, onChange, onDelete, onClose }) {
  const { prob, tier, pct, expected: exp } = calcRarity(weight, totalWeight, supply);
  const { getBlobUrl } = useLayerFiles();

  // Compute where tier boundaries fall on the 0-100 slider scale
  const otherWeight = Math.max(0, totalWeight - weight);
  function probAtWeight(w) {
    const tot = otherWeight + w;
    return tot > 0 ? w / tot : 0;
  }
  // Find slider position (0-100) where each tier starts
  // prob = w/(w+otherWeight) → w = prob*otherWeight/(1-prob)
  function weightForProb(p) {
    if (p <= 0 || otherWeight === 0) return 0;
    if (p >= 1) return 100;
    return Math.min(100, (p * otherWeight) / (1 - p));
  }
  const legendaryPos = weightForProb(0.01);  // 1% boundary
  const epicPos      = weightForProb(0.05);  // 5%
  const rarePos      = weightForProb(0.15);  // 15%

  const sliderVal = Math.min(weight, 100);

  return (
    <div className="card-modal-overlay" onClick={onClose}>
      <div className="card-modal" onClick={e => e.stopPropagation()}>
        <button className="card-modal-close" onClick={onClose}>✕</button>

        <div className="card-modal-img-wrap">
          {asset.rel ? (
            <img src={getBlobUrl(asset.rel) ?? `/api/layer-img/${asset.rel}?w=400&h=400`} alt={asset.stem} className="card-modal-img" />
          ) : (
            <div className="card-modal-none">NONE</div>
          )}
        </div>

        <div className="card-modal-body">
          <div className="card-modal-name">{asset.name}</div>

          {/* ── Probability hero ── */}
          <div className="cm-prob-hero" style={{ borderColor: tier.color, background: tier.bg }}>
            <div className="cm-prob-tier" style={{ color: tier.color }}>{tier.label}</div>
            <div className="cm-prob-pct"  style={{ color: tier.color }}>
              {weight === 0 ? 'Disabled' : `${pct}%`}
            </div>
            <div className="cm-prob-count">
              {weight === 0
                ? 'Excluded from generation'
                : `~${exp.toLocaleString()} of ${supply.toLocaleString()} NFTs`}
            </div>
          </div>

          {/* ── Quick tier presets ── */}
          <div className="cm-presets-label">Quick assign</div>
          <div className="cm-presets">
            {PRESETS.map(p => (
              <button
                key={p.label}
                className={`cm-preset-btn${weight === p.weight ? ' active' : ''}`}
                style={weight === p.weight ? { background: p.color, color: '#fff', borderColor: p.color } : { borderColor: p.color, color: p.color }}
                onClick={() => onChange(asset.stem, p.weight)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* ── Slider with tier zone bar ── */}
          <div className="cm-slider-section">
            <div className="cm-slider-header">
              <span className="cm-slider-label">Rarity Weight</span>
              <input
                className="cm-weight-input"
                type="number"
                min="0" max="100" step="0.5"
                value={sliderVal}
                onChange={e => onChange(asset.stem, Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
              />
            </div>

            {/* Tier zone gradient bar */}
            <div className="cm-tier-bar">
              <div className="cm-tier-zone cm-zone-legendary" style={{ width: `${legendaryPos}%` }} title="Legendary" />
              <div className="cm-tier-zone cm-zone-epic"      style={{ width: `${Math.max(0, epicPos - legendaryPos)}%` }} title="Epic" />
              <div className="cm-tier-zone cm-zone-rare"      style={{ width: `${Math.max(0, rarePos - epicPos)}%` }} title="Rare" />
              <div className="cm-tier-zone cm-zone-common"    style={{ width: `${Math.max(0, 100 - rarePos)}%` }} title="Common" />
            </div>

            <input
              className="range-slider cm-range"
              type="range"
              min="0" max="100" step="0.5"
              value={sliderVal}
              onChange={e => onChange(asset.stem, parseFloat(e.target.value))}
            />

            <div className="cm-tier-labels">
              <span style={{ color: '#F59E0B' }}>Legendary</span>
              <span style={{ color: '#A855F7' }}>Epic</span>
              <span style={{ color: '#3B82F6' }}>Rare</span>
              <span style={{ color: '#6B7280' }}>Common</span>
            </div>
          </div>

          <div className="cm-weight-meta">
            Weight {weight} · Total layer weight {totalWeight.toLocaleString()} · {supply.toLocaleString()} NFTs
          </div>

          {asset.rel && (
            <button
              className="card-modal-delete"
              onClick={() => {
                if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;
                onDelete?.(asset);
                onClose();
              }}
            >
              🗑 Delete trait
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AssetCard({ asset, weight, totalWeight, supply, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const { tier, pct } = calcRarity(weight, totalWeight, supply);
  const { getBlobUrl } = useLayerFiles();

  // Tier zone positions on 0-100 slider scale (same math as modal)
  const otherW = Math.max(0, totalWeight - weight);
  function wpAt(p) {
    if (p <= 0 || otherW === 0) return 0;
    return Math.min(100, (p * otherW) / (1 - p));
  }
  const lPos = wpAt(0.01);
  const ePos = wpAt(0.05);
  const rPos = wpAt(0.15);

  function handleDelete(e) {
    e.stopPropagation();
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;
    onDelete?.(asset);
  }

  return (
    <>
      <div
        className={`asset-card${weight === 0 ? ' disabled' : ''}`}
        onClick={() => setOpen(true)}
        style={{ cursor: 'pointer' }}
      >
        <div className="thumb">
          {asset.rel ? (
            <img
              src={getBlobUrl(asset.rel) ?? `/api/layer-img/${asset.rel}?w=200&h=200`}
              alt={asset.stem}
              loading="lazy"
              onError={e => {
                const img = e.currentTarget as HTMLImageElement;
                const ph = document.createElement('span');
                ph.className = 'no-img';
                ph.textContent = '🖼';
                img.replaceWith(ph);
              }}
            />
          ) : (
            <span className="no-img" style={{ fontSize: 13, color: '#888' }}>NONE</span>
          )}
          <div className="tier-ribbon" style={{ background: tier.bg, color: tier.color }}>
            {tier.label}
          </div>
          {asset.rel && (
            <button className="card-delete-btn" onClick={handleDelete} title="Delete trait">🗑</button>
          )}
        </div>

        <div
          className="card-slider-row"
          style={{ '--tier-color': tier.color } as any}
          onClick={e => e.stopPropagation()}
        >
          {/* Tier zone bar — shows where each rarity tier starts on this card's slider */}
          <div className="card-tier-bar">
            <div style={{ width: `${lPos}%`,                    background: '#F59E0B' }} />
            <div style={{ width: `${Math.max(0,ePos-lPos)}%`,   background: '#A855F7' }} />
            <div style={{ width: `${Math.max(0,rPos-ePos)}%`,   background: '#3B82F6' }} />
            <div style={{ width: `${Math.max(0,100-rPos)}%`,    background: '#D1D5DB' }} />
          </div>
          <input
            className="range-slider"
            type="range"
            min="0" max="100" step="0.5"
            value={Math.min(weight, 100)}
            onChange={e => onChange(asset.stem, parseFloat(e.target.value))}
          />
        </div>

        <div className="card-bottom">
          <span className="card-stem" title={asset.name}>{asset.name}</span>
          <span className="card-pct" style={{ color: tier.color }}>{pct}%</span>
        </div>
      </div>

      {open && (
        <CardModal
          asset={asset}
          weight={weight}
          totalWeight={totalWeight}
          supply={supply}
          onChange={onChange}
          onDelete={onDelete}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
