// @ts-nocheck
'use client';
import { TIERS, getTier } from '../../../../lib/studio/tiers';

export default function SummaryPanel({ layer, weights, supply, onGenerate }) {
  if (!layer) return <aside className="summary"><div className="sh">Layer Stats</div><div className="empty">Select a layer</div></aside>;

  const ws: Record<string,number> = weights[layer.folder] ?? {};
  const totalW  = Object.values(ws).reduce((a, b) => a + b, 0);

  const tierCounts = Object.fromEntries(TIERS.map(t => [t.label, 0]));
  layer.assets.forEach(a => {
    const prob = totalW > 0 ? (ws[a.stem] ?? 0) / totalW : 0;
    tierCounts[getTier(prob).label]++;
  });

  const active = layer.assets.filter(a => (ws[a.stem] ?? 0) > 0);
  const rarest = [...active]
    .sort((a, b) => (ws[a.stem] ?? 0) - (ws[b.stem] ?? 0))
    .slice(0, 4);

  return (
    <aside className="summary">
      <div className="sh">Layer Stats</div>

      <div className="sec">
        <div className="sec-title">Tier Distribution</div>
        {TIERS.map(t => {
          const barPct = layer.count > 0 ? (tierCounts[t.label] / layer.count) * 100 : 0;
          return (
            <div className="tier-row" key={t.label}>
              <div className="tier-row-label" style={{ color: t.color }}>{t.label}</div>
              <div className="bar-bg">
                <div className="bar-fill" style={{ width: `${barPct.toFixed(1)}%`, background: t.color }} />
              </div>
              <div className="bar-count">{tierCounts[t.label]}</div>
            </div>
          );
        })}
      </div>

      <div className="sec">
        <div className="stat-box">
          <div className="stat-box-label">Total Weight</div>
          <div className="stat-box-value">{totalW.toFixed(1)}</div>
          <div className="stat-box-sub">{layer.count} traits</div>
        </div>
        <div className="stat-box">
          <div className="stat-box-label">Active Traits</div>
          <div className="stat-box-value">{active.length}</div>
          <div className="stat-box-sub">{layer.count - active.length} disabled (weight = 0)</div>
        </div>
      </div>

      {rarest.length > 0 && (
        <div className="sec">
          <div className="sec-title">Rarest Traits</div>
          {rarest.map(a => {
            const w    = ws[a.stem] ?? 0;
            const prob = totalW > 0 ? w / totalW : 0;
            const tier = getTier(prob);
            const exp  = Math.round(prob * supply);
            return (
              <div className="rare-item" key={a.stem}>
                <div>
                  <div className="rare-item-name">{a.name}</div>
                  <div className="rare-item-sub">{(prob * 100).toFixed(2)}% · {exp.toLocaleString()} NFTs</div>
                </div>
                <div className="tier-pill" style={{ background: tier.bg, color: tier.color }}>{tier.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
