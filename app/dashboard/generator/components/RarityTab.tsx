// @ts-nocheck
'use client';
import { useState, useMemo } from 'react';

// ── Tier helpers ──────────────────────────────────────────────────────────────
function rarityTier(pct: number) {
  if (pct <= 5)  return { label: 'Legendary', color: '#F59E0B', glow: '#F59E0B' };
  if (pct <= 15) return { label: 'Epic',      color: '#A855F7', glow: '#A855F7' };
  if (pct <= 35) return { label: 'Rare',      color: '#3B82F6', glow: '#3B82F6' };
  return          { label: 'Common',   color: '#6B7280', glow: '#6B7280' };
}

const TIERS = [
  { label: 'Legendary', color: '#F59E0B', icon: '👑', preRange: '≤ 5%',  postRange: 'Top 1%',  desc: 'Ultra-rare. Highest collector value.' },
  { label: 'Epic',      color: '#A855F7', icon: '💎', preRange: '≤ 15%', postRange: 'Top 5%',  desc: 'Very rare. Strong collector demand.' },
  { label: 'Rare',      color: '#3B82F6', icon: '⭐', preRange: '≤ 35%', postRange: 'Top 15%', desc: 'Clearly limited. Noticeably scarce.' },
  { label: 'Common',    color: '#6B7280', icon: '🔹', preRange: '> 35%', postRange: 'Rest',     desc: 'Most frequent. Baseline traits.' },
];

// ── Tier overview cards ───────────────────────────────────────────────────────
function TierOverview() {
  return (
    <div className="rt-section">
      <div className="rt-section-header">
        <span className="rt-section-icon">✨</span>
        <span className="rt-section-title">Rarity Tiers</span>
      </div>
      <div className="rt-tiers-grid">
        {TIERS.map(t => (
          <div key={t.label} className="rt-tier-card" style={{
            '--tc': t.color,
            borderColor: t.color + '55',
            background: `linear-gradient(135deg, ${t.color}12 0%, ${t.color}06 100%)`,
          } as any}>
            <div className="rt-tier-icon">{t.icon}</div>
            <div className="rt-tier-label" style={{ color: t.color }}>{t.label}</div>
            <div className="rt-tier-ranges">
              <div className="rt-tier-range-row">
                <span className="rt-tier-range-tag">Pre</span>
                <span style={{ color: t.color, fontWeight: 700 }}>{t.preRange}</span>
              </div>
              <div className="rt-tier-range-row">
                <span className="rt-tier-range-tag">Post</span>
                <span style={{ color: t.color, fontWeight: 700 }}>{t.postRange}</span>
              </div>
            </div>
            <div className="rt-tier-desc">{t.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Formula section ───────────────────────────────────────────────────────────
function FormulaSection({ supply }) {
  const ex = Math.min(supply, 100);
  const EX = [
    { name: 'Trait A', w: 5  },
    { name: 'Trait B', w: 10 },
    { name: 'Trait C', w: 3  },
    { name: 'Trait D', w: 2  },
  ];
  const totalW = EX.reduce((s, t) => s + t.w, 0);

  return (
    <div className="rt-section">
      <div className="rt-section-header">
        <span className="rt-section-icon">📐</span>
        <span className="rt-section-title">How Rarity Is Calculated</span>
      </div>
      <div className="rt-formula-grid">

        {/* Pre-gen */}
        <div className="rt-formula-card rt-formula-pre">
          <div className="rt-formula-phase-badge" style={{ background:'#34D39922', color:'#34D399', borderColor:'#34D39944' }}>
            Pre-Generation
          </div>
          <div className="rt-formula-name">Weight-Based Probability</div>
          <div className="rt-formula-eq">
            <span className="rt-eq-result">Probability</span> = trait_weight ÷ layer_total_weight × 100%
          </div>
          <div className="rt-formula-note">
            Lower weight = rarer trait. Weight 0 disables completely. Set in Organize tab ⚙
          </div>
          <div className="rt-formula-example">
            <div className="rt-ex-header">Example — {EX.length} traits, total weight {totalW}</div>
            {EX.map(t => {
              const pct = (t.w / totalW) * 100;
              const tier = rarityTier(pct);
              return (
                <div key={t.name} className="rt-ex-row">
                  <span className="rt-ex-name">{t.name} (w={t.w})</span>
                  <span className="rt-ex-calc">{t.w}÷{totalW}</span>
                  <span className="rt-ex-result" style={{ color: tier.color }}>{pct.toFixed(0)}%</span>
                  <span className="rt-ex-tier" style={{ color: tier.color, background: tier.color + '20', border: `1px solid ${tier.color}44` }}>{tier.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Post-gen */}
        <div className="rt-formula-card rt-formula-post">
          <div className="rt-formula-phase-badge" style={{ background:'#6366F122', color:'#818CF8', borderColor:'#6366F144' }}>
            Post-Generation
          </div>
          <div className="rt-formula-name">Rarity Score (Industry Standard)</div>
          <div className="rt-formula-eq">
            <span className="rt-eq-result">NFT Score</span> = Σ ( supply ÷ trait_occurrence ) per trait
          </div>
          <div className="rt-formula-note">
            After generation, each NFT is scored across all traits. Rarer traits = higher score. Tied scores share the same rank. Used in Preview &amp; Export.
          </div>
          <div className="rt-formula-example">
            <div className="rt-ex-header">Example — supply {ex}</div>
            {[
              { name: 'Red Hoodie', count: 10 },
              { name: 'Gold Hat',   count: 50 },
              { name: 'Blue Eyes',  count: 25 },
            ].map(t => (
              <div key={t.name} className="rt-ex-row">
                <span className="rt-ex-name">{t.name} ({t.count} NFTs)</span>
                <span className="rt-ex-calc">{ex}÷{t.count}</span>
                <span className="rt-ex-result" style={{ color:'var(--accent2)' }}>= {ex/t.count}</span>
                <span className="rt-ex-tier" style={{ color:'var(--dim)', background:'var(--bg0)', border:'1px solid var(--border)' }}>score</span>
              </div>
            ))}
            <div className="rt-ex-row rt-ex-total">
              <span className="rt-ex-name">Total Rarity Score</span>
              <span />
              <span className="rt-ex-result" style={{ color:'#F59E0B' }}>{ex/10 + ex/50 + ex/25}</span>
              <span />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Layer accordion ───────────────────────────────────────────────────────────
function TierDistBar({ traits }) {
  const total = traits.filter(t => !t.isNone).length || 1;
  const counts = { Legendary: 0, Epic: 0, Rare: 0, Common: 0 };
  traits.filter(t => !t.isNone).forEach(t => { counts[t.tier.label] = (counts[t.tier.label] ?? 0) + 1; });
  return (
    <div className="rt-dist-bar">
      {TIERS.map(t => counts[t.label] > 0 && (
        <div key={t.label} title={`${t.label}: ${counts[t.label]}`}
          style={{ flex: counts[t.label], background: t.color, minWidth: 4, borderRadius: 3 }} />
      ))}
    </div>
  );
}

function LayerAccordion({ layer, traits, totalW, supply }) {
  const [open, setOpen] = useState(false);

  const tierCounts: Record<string, number> = {};
  traits.filter(t => !t.isNone).forEach(t => {
    tierCounts[t.tier.label] = (tierCounts[t.tier.label] ?? 0) + 1;
  });
  const topTier = TIERS.find(t => tierCounts[t.label] > 0);

  return (
    <div className="rt-layer-row" style={{ '--accent-c': topTier?.color ?? '#6B7280' } as any}>
      <div className="rt-layer-header" onClick={() => setOpen(o => !o)}>
        <span className="rt-layer-chevron">{open ? '▾' : '▸'}</span>
        <div className="rt-layer-info">
          <span className="rt-layer-name">{layer.label}</span>
          {layer.optional && <span className="rt-optional-tag">Optional</span>}
          <span className="rt-layer-meta">{layer.count} traits · weight {totalW}</span>
        </div>
        <TierDistBar traits={traits} />
        <div className="rt-layer-chips">
          {TIERS.filter(t => tierCounts[t.label]).map(t => (
            <span key={t.label} className="rt-layer-chip"
              style={{ color: t.color, background: t.color + '1a', border: `1px solid ${t.color}44` }}>
              {t.label[0]} ×{tierCounts[t.label]}
            </span>
          ))}
        </div>
      </div>

      {open && (
        <div className="rt-layer-body">
          <table className="rt-table">
            <thead>
              <tr>
                <th>Trait</th>
                <th style={{ width:60, textAlign:'center' }}>Wt</th>
                <th>Probability</th>
                <th style={{ width:90, textAlign:'center' }}>~Count</th>
                <th style={{ width:100, textAlign:'center' }}>Tier</th>
              </tr>
            </thead>
            <tbody>
              {traits.map(t => (
                <tr key={t.stem} className={t.isNone ? 'rt-row-none' : ''}>
                  <td className="rt-trait-name" style={ !t.isNone && t.tier.label === 'Legendary'
                    ? { color: t.tier.color, textShadow: `0 0 8px ${t.tier.color}66` } : {} }>
                    {t.name}
                  </td>
                  <td style={{ textAlign:'center', color:'var(--dim)', fontSize:11 }}>{t.weight}</td>
                  <td>
                    <div className="rt-bar-row">
                      <div className="rt-bar-bg">
                        <div className="rt-bar-fill" style={{
                          width: `${Math.min(t.pct, 100)}%`,
                          background: t.tier.color,
                          boxShadow: t.tier.label !== 'Common' ? `0 0 6px ${t.tier.color}88` : 'none',
                        }} />
                      </div>
                      <span className="rt-pct" style={{ color: t.tier.color }}>{t.pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={{ textAlign:'center', fontSize:11.5, color:'var(--muted)' }}>
                    {t.isNone ? '—' : `~${t.expectedCount.toLocaleString()}`}
                  </td>
                  <td style={{ textAlign:'center' }}>
                    <span className="rt-tier-chip" style={{
                      color: t.tier.color,
                      background: t.tier.color + '1a',
                      border: `1px solid ${t.tier.color}44`,
                      boxShadow: t.tier.label !== 'Common' ? `0 0 8px ${t.tier.color}33` : 'none',
                    }}>
                      {t.tier.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function RarityTab({ layers, weights, collection }) {
  const supply = collection?.supply ?? 100;

  const analysis = useMemo(() => layers.map(layer => {
    const ws     = weights[layer.folder] ?? {};
    const totalW = layer.assets.reduce((s, a) => s + (ws[a.stem] ?? a.defaultWeight ?? 1), 0);
    const traits = layer.assets.map(a => {
      const w   = ws[a.stem] ?? a.defaultWeight ?? 1;
      const pct = totalW > 0 ? (w / totalW) * 100 : 0;
      const tier = a.rel === null ? { label: 'None', color: '#9ca3af', glow: '#9ca3af' } : rarityTier(pct);
      return { stem: a.stem, name: a.name, weight: w, pct, expectedCount: Math.round(pct / 100 * supply), tier, isNone: a.rel === null };
    }).sort((a, b) => a.pct - b.pct);
    return { layer, traits, totalW };
  }), [layers, weights, supply]);

  // Collection-wide stats
  const totalTraits    = analysis.reduce((s, a) => s + a.traits.filter(t => !t.isNone).length, 0);
  const legendaryCount = analysis.reduce((s, a) => s + a.traits.filter(t => t.tier.label === 'Legendary').length, 0);
  const epicCount      = analysis.reduce((s, a) => s + a.traits.filter(t => t.tier.label === 'Epic').length, 0);

  return (
    <div className="rt-page">

      {/* ── Stats bar ── */}
      {analysis.length > 0 && (
        <div className="rt-stats-bar">
          {[
            { label: 'Layers',      value: analysis.length,   color: 'var(--accent2)' },
            { label: 'Total Traits',value: totalTraits,        color: 'var(--text)' },
            { label: 'Legendary',   value: legendaryCount,     color: '#F59E0B' },
            { label: 'Epic',        value: epicCount,          color: '#A855F7' },
            { label: 'Supply',      value: supply.toLocaleString(), color: 'var(--accent)' },
          ].map(s => (
            <div key={s.label} className="rt-stat">
              <div className="rt-stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="rt-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tier overview ── */}
      <TierOverview />

      {/* ── Formulas ── */}
      <FormulaSection supply={supply} />

      {/* ── Layer breakdown ── */}
      <div className="rt-section">
        <div className="rt-section-header">
          <span className="rt-section-icon">🗂️</span>
          <span className="rt-section-title">Layer Breakdown</span>
        </div>

        {analysis.length === 0 ? (
          <div className="rt-empty">
            No layers found. Upload assets in the <b>Organize</b> tab first.
          </div>
        ) : (
          <div className="rt-layers-list">
            {analysis.map(({ layer, traits, totalW }) => (
              <LayerAccordion key={layer.folder} layer={layer} traits={traits} totalW={totalW} supply={supply} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
