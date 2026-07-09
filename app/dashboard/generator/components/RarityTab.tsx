// @ts-nocheck
'use client';
import { useMemo } from 'react';

// ── Tier helpers ──────────────────────────────────────────────────────────────
function rarityTier(pct: number) {
  if (pct <= 5)  return { label: 'Legendary', color: '#F59E0B' };
  if (pct <= 15) return { label: 'Epic',      color: '#A855F7' };
  if (pct <= 35) return { label: 'Rare',      color: '#3B82F6' };
  return          { label: 'Common',   color: '#6B7280' };
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
            borderColor: t.color + '66',
            background: `linear-gradient(135deg, ${t.color}18 0%, ${t.color}08 100%)`,
          }}>
            <div className="rt-tier-icon">{t.icon}</div>
            <div className="rt-tier-label" style={{ color: t.color }}>{t.label}</div>
            <div className="rt-tier-ranges" style={{ borderColor: t.color + '33' }}>
              <div className="rt-tier-range-row">
                <span className="rt-tier-range-tag">Pre-gen</span>
                <span className="rt-tier-range-val" style={{ color: t.color }}>{t.preRange}</span>
              </div>
              <div className="rt-tier-range-row">
                <span className="rt-tier-range-tag">Post-gen</span>
                <span className="rt-tier-range-val" style={{ color: t.color }}>{t.postRange}</span>
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
        <div className="rt-formula-card">
          <div className="rt-formula-phase-badge" style={{ background:'#34D39920', color:'#059669', border:'1px solid #34D39950' }}>
            Pre-Generation
          </div>
          <div className="rt-formula-name">Weight-Based Probability</div>
          <div className="rt-formula-eq">
            <span className="rt-eq-result">Probability</span> = trait_weight ÷ layer_total_weight × 100%
          </div>
          <div className="rt-formula-note">
            Lower weight = rarer trait. Weight 0 disables completely. Set in Organize tab.
          </div>
          <div className="rt-formula-example">
            <div className="rt-ex-header">Example — {EX.length} traits, total weight {totalW}</div>
            {EX.map(t => {
              const pct  = (t.w / totalW) * 100;
              const tier = rarityTier(pct);
              return (
                <div key={t.name} className="rt-ex-row">
                  <span className="rt-ex-name">{t.name} (w={t.w})</span>
                  <span className="rt-ex-calc">{t.w}÷{totalW}</span>
                  <span className="rt-ex-pct" style={{ color: tier.color }}>{pct.toFixed(0)}%</span>
                  <span className="rt-ex-tier" style={{ color: tier.color, background: tier.color + '20', border:`1px solid ${tier.color}44` }}>{tier.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Post-gen */}
        <div className="rt-formula-card">
          <div className="rt-formula-phase-badge" style={{ background:'#6366F120', color:'#4f46e5', border:'1px solid #6366F150' }}>
            Post-Generation
          </div>
          <div className="rt-formula-name">Rarity Score (Industry Standard)</div>
          <div className="rt-formula-eq">
            <span className="rt-eq-result">NFT Score</span> = Σ ( supply ÷ trait_occurrence ) per trait
          </div>
          <div className="rt-formula-note">
            After generation, each NFT is scored across all traits. Rarer traits = higher score. Tied scores share the same rank.
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
                <span className="rt-ex-pct" style={{ color:'var(--accent2)' }}>{(ex/t.count).toFixed(1)}</span>
                <span className="rt-ex-tier" style={{ color:'var(--dim)', background:'var(--bg2)', border:'1px solid var(--border)' }}>pts</span>
              </div>
            ))}
            <div className="rt-ex-row rt-ex-total">
              <span className="rt-ex-name" style={{ fontWeight:700, color:'var(--text)' }}>Total Score</span>
              <span />
              <span className="rt-ex-pct" style={{ color:'#F59E0B', fontSize:14 }}>{(ex/10 + ex/50 + ex/25).toFixed(1)}</span>
              <span className="rt-ex-tier" style={{ color:'#F59E0B', background:'#F59E0B20', border:'1px solid #F59E0B44' }}>Rare</span>
            </div>
          </div>
        </div>

      </div>
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
      const tier = a.rel === null ? { label: 'None', color: '#9ca3af' } : rarityTier(pct);
      return { stem: a.stem, name: a.name, weight: w, pct, tier, isNone: a.rel === null };
    });
    return { layer, traits, totalW };
  }), [layers, weights, supply]);

  const totalTraits    = analysis.reduce((s, a) => s + a.traits.filter(t => !t.isNone).length, 0);
  const legendaryCount = analysis.reduce((s, a) => s + a.traits.filter(t => t.tier.label === 'Legendary').length, 0);
  const epicCount      = analysis.reduce((s, a) => s + a.traits.filter(t => t.tier.label === 'Epic').length, 0);

  return (
    <div className="rt-page">

      {/* ── Stats bar ── */}
      {analysis.length > 0 && (
        <div className="rt-stats-bar">
          {[
            { label: 'Layers',       value: analysis.length,        color: 'var(--accent2)' },
            { label: 'Total Traits', value: totalTraits,             color: 'var(--text)'    },
            { label: 'Legendary',    value: legendaryCount,          color: '#F59E0B'        },
            { label: 'Epic',         value: epicCount,               color: '#A855F7'        },
            { label: 'Supply',       value: supply.toLocaleString(), color: 'var(--accent)'  },
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

    </div>
  );
}
