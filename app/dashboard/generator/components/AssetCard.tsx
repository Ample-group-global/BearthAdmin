// @ts-nocheck
'use client';
import { calcRarity, positionForProb } from '../../../../lib/studio/probability';
import { useLayerFiles } from '../LayerFilesContext';

// Clicking a card used to open its own single-trait modal (CardModal, removed) —
// now it opens the same layer modal used by the sidebar gear icon, scrolled to
// this trait, via onOpen. Two different popups for what looked like the same
// kind of editing was confusing; there's exactly one now. The inline slider on
// the card itself still lets you drag weight without opening anything.
export default function AssetCard({ asset, weight, totalWeight, supply, onChange, onDelete, onOpen }) {
  const { tier, pct } = calcRarity(weight, totalWeight, supply);
  const { getBlobUrl } = useLayerFiles();

  // Tier zone positions on 0-100 slider scale (same math as the layer modal)
  const otherW = Math.max(0, totalWeight - weight);
  const lPos = positionForProb(otherW, 0.01);
  const ePos = positionForProb(otherW, 0.05);
  const rPos = positionForProb(otherW, 0.15);

  function handleDelete(e) {
    e.stopPropagation();
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;
    onDelete?.(asset);
  }

  return (
    <div
      className={`asset-card${weight === 0 ? ' disabled' : ''}`}
      onClick={() => onOpen?.()}
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
  );
}
