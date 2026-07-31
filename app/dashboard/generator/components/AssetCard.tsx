// @ts-nocheck
'use client';
import { useState } from 'react';
import { calcRarity } from '../../../../lib/studio/probability';
import { useLayerFiles } from '../LayerFilesContext';

function CardModal({ asset, weight, totalWeight, supply, onChange, onDelete, onClose }) {
  const { prob, tier, pct, expected: exp } = calcRarity(weight, totalWeight, supply);
  const { getBlobUrl } = useLayerFiles();

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
          <span className="card-modal-tier" style={{ background: tier.bg, color: tier.color }}>
            {tier.label}
          </span>

          <div className="card-modal-stats">
            <div className="card-modal-stat">
              <div className="card-modal-stat-label">Probability</div>
              <div className="card-modal-stat-val" style={{ color: tier.color }}>{pct}%</div>
            </div>
            <div className="card-modal-stat">
              <div className="card-modal-stat-label">Expected count</div>
              <div className="card-modal-stat-val">~{exp.toLocaleString()}</div>
            </div>
            <div className="card-modal-stat">
              <div className="card-modal-stat-label">Weight</div>
              <div className="card-modal-stat-val">{weight}</div>
            </div>
          </div>

          <div className="card-modal-slider-label">
            Weight <span style={{ color: tier.color, fontWeight: 700 }}>{weight}</span>
            {weight > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--dim)' }}>→ {pct}% probability</span>}
            {weight === 0 && <span style={{ marginLeft: 8, fontSize: 11, color: '#9CA3AF' }}>→ disabled (excluded from generation)</span>}
          </div>
          <input
            className="range-slider"
            type="range"
            min="0" max="100" step="0.5"
            value={Math.min(weight, 100)}
            onChange={e => onChange(asset.stem, parseFloat(e.target.value))}
            style={{ width: '100%', marginBottom: 4 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--xdim)' }}>
            <span>0 = disabled</span><span style={{ color: '#3B82F6' }}>Rare ≈ 10</span><span>100 = max weight</span>
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

        {/* Slider — always visible, no hover required */}
        <div className="card-slider-row" onClick={e => e.stopPropagation()}>
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
