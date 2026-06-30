// @ts-nocheck
'use client';
import { useState, useMemo } from 'react';
import { TIERS, getTier }    from '../../../../lib/studio/tiers';
import AssetCard              from './AssetCard';
import RarityModal            from './RarityModal';

export default function AssetGrid({ layer, layerWeights, supply, onWeightChange, onLayersChange }) {
  const [filterTier, setFilterTier] = useState('all');
  const [showModal, setShowModal]   = useState(false);

  const ws: Record<string,number> = layerWeights ?? {};
  const totalW  = useMemo(() => Object.values(ws).reduce((a, b) => a + b, 0), [ws]);

  const tierCounts = useMemo(() => {
    const counts = {};
    TIERS.forEach(t => { counts[t.label] = 0; });
    layer.assets.forEach(a => {
      const prob = totalW > 0 ? (ws[a.stem] ?? 0) / totalW : 0;
      counts[getTier(prob).label]++;
    });
    return counts;
  }, [layer, ws, totalW]);

  const visible = filterTier === 'all'
    ? layer.assets
    : layer.assets.filter(a => {
        const prob = totalW > 0 ? (ws[a.stem] ?? 0) / totalW : 0;
        return getTier(prob).label.toLowerCase() === filterTier;
      });

  async function handleDelete(asset) {
    await fetch('/api/asset/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rel: asset.rel }),
    });
    onLayersChange?.();
  }

  return (
    <main className="content">
      <div className="ch">
        <div className="ct">{layer.label}</div>
        <div className="cs">{layer.count} traits &nbsp;·&nbsp; <b>Total weight: {totalW.toFixed(1)}</b></div>
      </div>

      <div className="toolbar">
        <button
          className={`filter-btn${filterTier === 'all' ? ' active' : ''}`}
          onClick={() => setFilterTier('all')}
        >
          All ({layer.count})
        </button>
        {TIERS.filter(t => tierCounts[t.label] > 0).map(t => (
          <button
            key={t.label}
            className={`filter-btn${filterTier === t.label.toLowerCase() ? ' active' : ''}`}
            onClick={() => setFilterTier(t.label.toLowerCase())}
            style={filterTier === t.label.toLowerCase()
              ? { borderColor: t.color, color: t.color, background: t.bg }
              : {}}
          >
            {t.label} ({tierCounts[t.label]})
          </button>
        ))}
        <button className="filter-btn" style={{ marginLeft: 'auto' }} onClick={() => setShowModal(true)}>
          ⚙ Layer Rarity
        </button>
      </div>

      <div className="asset-grid">
        {visible.map(asset => (
          <AssetCard
            key={asset.stem}
            asset={asset}
            weight={ws[asset.stem] ?? asset.defaultWeight ?? 1}
            totalWeight={totalW}
            supply={supply}
            onChange={(stem, val) => onWeightChange(layer.folder, stem, val)}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {visible.length === 0 && <div className="empty">No traits match this filter.</div>}

      {showModal && (
        <RarityModal
          layer={layer}
          weights={ws}
          supply={supply}
          onSave={newWs => {
            Object.entries(newWs).forEach(([stem, val]) => onWeightChange(layer.folder, stem, val));
          }}
          onDelete={handleDelete}
          onClose={() => setShowModal(false)}
        />
      )}
    </main>
  );
}
