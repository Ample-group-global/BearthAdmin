// @ts-nocheck
'use client';
import { useState, useMemo } from 'react';

function rarityTier(pct: number): { label: string; color: string } {
  if (pct <= 2)  return { label: 'Legendary', color: '#f59e0b' };
  if (pct <= 5)  return { label: 'Epic',      color: '#a78bfa' };
  if (pct <= 15) return { label: 'Rare',      color: '#60a5fa' };
  if (pct <= 30) return { label: 'Uncommon',  color: '#34d399' };
  return          { label: 'Common',   color: '#94a3b8' };
}

const TIER_GUIDE = [
  { icon:'🟡', label:'Legendary', color:'#f59e0b', range:'≤ 2%', desc:'Ultra-rare. Usually only 1–10 pieces in the entire collection. Highest collector value and prestige.' },
  { icon:'🟠', label:'Epic',      color:'#a78bfa', range:'≤ 5%', desc:'Very rare traits. Strong collector demand. Often features special visuals or unique combinations.' },
  { icon:'🔵', label:'Rare',      color:'#60a5fa', range:'≤ 15%', desc:'Clearly limited. More desirable to collectors. Noticeably harder to obtain than common traits.' },
  { icon:'🟢', label:'Uncommon',  color:'#34d399', range:'≤ 30%', desc:'Slightly rarer than common. Moderate supply. Gives the NFT some distinction in the collection.' },
  { icon:'⚪', label:'Common',    color:'#94a3b8', range:'> 30%', desc:'Most frequently appearing trait. Highest supply, lowest individual rarity score contribution.' },
];

function RarityGuideSection() {
  return (
    <div className="rarity-guide-card">
      <div className="rarity-guide-title">🎓 What Are NFT Rarity Tiers?</div>

      <div className="rarity-guide-grid">
        {TIER_GUIDE.map(t => (
          <div key={t.label} className="rarity-guide-tier"
            style={{ background: t.color + '18', borderColor: t.color + '44' }}>
            <div className="rarity-guide-tier-icon">{t.icon}</div>
            <div className="rarity-guide-tier-label" style={{ color: t.color }}>{t.label}</div>
            <div className="rarity-guide-tier-range" style={{ color: t.color }}>{t.range}</div>
            <div className="rarity-guide-tier-desc" style={{ color: t.color }}>{t.desc}</div>
          </div>
        ))}
      </div>

      <div className="rarity-guide-note">
        <b>How rarity is calculated in this app:</b> Rarity tiers are assigned based on a trait's <b>probability of appearing</b> in the collection — calculated from the weights you set in the Organize tab.<br />
        Formula: <code style={{ background:'var(--bg0)', padding:'1px 5px', borderRadius:4, fontSize:11 }}>Probability = trait_weight ÷ layer_total_weight × 100%</code><br /><br />
        <b>Important:</b> "Legendary" is not a universal standard — each NFT project defines its own thresholds. The values above (2%, 5%, 15%, 30%) are used by this generator and match common industry conventions. You control rarity by adjusting weights — lower weight = rarer trait = higher rarity score contribution in post-generation ranking.<br /><br />
        <b>Combination rarity matters:</b> An NFT with 3 "Rare" traits may outscore one with a single "Epic" trait in the post-generation Rarity Score ranking, because the score sums across ALL traits.
      </div>
    </div>
  );
}

function FormulaSection({ supply }: { supply: number }) {
  const exSupply = Math.min(supply, 100);

  const EX_TRAITS = [
    { name: 'Trait A', weight: 5 },
    { name: 'Trait B', weight: 10 },
    { name: 'Trait C', weight: 3 },
    { name: 'Trait D', weight: 2 },
  ];
  const exTotalW = EX_TRAITS.reduce((s, t) => s + t.weight, 0);

  return (
    <div className="rarity-formula-card">
      <div className="rarity-formula-title">📐 Rarity Formulas Used In This App</div>
      <div className="rarity-formula-grid">

        <div className="rarity-formula-block">
          <div className="rarity-formula-block-title">Pre-Generation — weight-based probability</div>
          <div className="rarity-formula-eq">
            Probability (%) =<br />
            &nbsp;&nbsp;trait_weight ÷ layer_total_weight × 100
          </div>
          <div className="rarity-formula-desc">
            Each trait's rarity is set by its weight relative to other traits in the same layer. Lower weight = rarer. Weight 0 disables the trait completely.
          </div>
          <div className="rarity-formula-example">
            <div className="rarity-formula-ex-title">
              Example — {EX_TRAITS.length} traits, total weight {exTotalW} ({EX_TRAITS.map(t => t.weight).join('+')})
            </div>
            {EX_TRAITS.map(t => (
              <div key={t.name} className="rarity-formula-ex-row">
                <span>{t.name} (w={t.weight})</span>
                <span>{t.weight}÷{exTotalW} = {((t.weight / exTotalW) * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rarity-formula-block">
          <div className="rarity-formula-block-title">Post-Generation — Rarity Score algorithm</div>
          <div className="rarity-formula-eq">
            NFT Rarity Score =<br />
            &nbsp;&nbsp;Σ ( total_supply ÷ trait_occurrence_count )<br />
            &nbsp;&nbsp;for every trait on the NFT
          </div>
          <div className="rarity-formula-desc">
            After generating the full collection, each NFT is scored by summing the inverse frequency of all its traits. Traits appearing in fewer NFTs contribute a higher value. This is the industry-standard <b>Rarity Score</b> method (used by Rarity.tools, etc.).
          </div>
          <div className="rarity-formula-example">
            <div className="rarity-formula-ex-title">Example — supply {exSupply.toLocaleString()}</div>
            <div className="rarity-formula-ex-row"><span>Red Hoodie (10 NFTs)</span><span>{exSupply}÷10 = {exSupply/10}</span></div>
            <div className="rarity-formula-ex-row"><span>Gold Hat (50 NFTs)</span><span>{exSupply}÷50 = {exSupply/50}</span></div>
            <div className="rarity-formula-ex-row"><span>Blue Eyes (25 NFTs)</span><span>{exSupply}÷25 = {exSupply/25}</span></div>
            <div className="rarity-formula-ex-row"><span>Rarity Score</span><span>{exSupply/10 + exSupply/50 + exSupply/25}</span></div>
          </div>
        </div>

      </div>
      <div style={{ marginTop:14, padding:'10px 14px', background:'var(--bg2)', borderRadius:8, fontSize:11.5, color:'var(--dim)', lineHeight:1.6 }}>
        <b style={{ color:'var(--accent2)' }}>Tier thresholds:</b>
        &nbsp;Legendary ≤2% &nbsp;·&nbsp; Epic ≤5% &nbsp;·&nbsp; Rare ≤15% &nbsp;·&nbsp; Uncommon ≤30% &nbsp;·&nbsp; Common &gt;30%
        &nbsp;&nbsp;|&nbsp;&nbsp;
        <b style={{ color:'var(--accent2)' }}>Adjust weights</b> in the Organize tab or via the ⚙ gear button on each layer.
      </div>
    </div>
  );
}

function LayerAccordion({ layer, traits, totalW, supply }) {
  const [open, setOpen] = useState(false);

  // Dominant tier for header badge
  const tierCounts: Record<string, number> = {};
  traits.forEach(t => { tierCounts[t.tier.label] = (tierCounts[t.tier.label] ?? 0) + 1; });
  const dominantTier = traits.reduce((best, t) =>
    (tierCounts[t.tier.label] > (tierCounts[best?.tier?.label] ?? 0)) ? t : best
  , traits[0]);

  return (
    <div className="rarity-accordion">
      {/* ── Header (always visible) ── */}
      <div className="rarity-accordion-header" onClick={() => setOpen(o => !o)}>
        <span className="rarity-acc-chevron">{open ? '▾' : '▸'}</span>
        <span className="rarity-acc-name">{layer.label}</span>
        {layer.optional && <span className="rarity-optional-chip">Optional</span>}
        <span className="rarity-acc-meta">{layer.count} traits · total weight {totalW}</span>
        <div className="rarity-acc-tiers">
          {Object.entries(tierCounts).map(([label, count]) => {
            const t = traits.find(t => t.tier.label === label);
            return (
              <span key={label} className="rarity-acc-tier-chip"
                style={{ background: (t?.tier.color ?? '#94a3b8') + '22', color: t?.tier.color ?? '#94a3b8', border: `1px solid ${(t?.tier.color ?? '#94a3b8')}44` }}>
                {label} ×{count}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Expanded table ── */}
      {open && (
        <div className="rarity-accordion-body">
          <table className="rarity-table">
            <thead>
              <tr>
                <th>Trait</th>
                <th style={{ width:70, textAlign:'center' }}>Weight</th>
                <th>Probability</th>
                <th style={{ width:120, textAlign:'center' }}>~Expected</th>
                <th style={{ width:110, textAlign:'center' }}>Tier</th>
              </tr>
            </thead>
            <tbody>
              {traits.map(t => (
                <tr key={t.stem} className={t.isNone ? 'rarity-row-none' : ''}>
                  <td className="rarity-trait-name">{t.name}</td>
                  <td className="rarity-weight-cell">{t.weight}</td>
                  <td>
                    <div className="rarity-pct-row">
                      <div className="rarity-bar-bg">
                        <div className="rarity-bar-fill" style={{ width:`${Math.min(t.pct,100)}%`, background:t.tier.color }} />
                      </div>
                      <span className="rarity-pct-num" style={{ color:t.tier.color }}>{t.pct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="rarity-exp-cell">{t.isNone ? '—' : `~${t.expectedCount.toLocaleString()}`}</td>
                  <td style={{ textAlign:'center' }}>
                    <span className="rarity-tier-chip"
                      style={{ background:t.tier.color+'22', color:t.tier.color, border:`1px solid ${t.tier.color}44` }}>
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

export default function RarityTab({ layers, weights, collection }) {
  const supply = collection?.supply ?? 100;

  const analysis = useMemo(() => {
    return layers.map(layer => {
      const ws     = weights[layer.folder] ?? {};
      const totalW = layer.assets.reduce((s, a) => s + (ws[a.stem] ?? a.defaultWeight ?? 1), 0);
      const traits = layer.assets.map(a => {
        const w   = ws[a.stem] ?? a.defaultWeight ?? 1;
        const pct = totalW > 0 ? (w / totalW) * 100 : 0;
        const tier = a.rel === null ? { label: 'None', color: '#9ca3af' } : rarityTier(pct);
        return { stem:a.stem, name:a.name, weight:w, pct, expectedCount:Math.round(pct/100*supply), tier, isNone:a.rel===null };
      }).sort((a, b) => a.pct - b.pct);
      return { layer, traits, totalW };
    });
  }, [layers, weights, supply]);

  return (
    <div className="rarity-page">

      {/* ── Educational guide ── */}
      <RarityGuideSection />

      {/* ── Formula reference ── */}
      <FormulaSection supply={supply} />

      {/* ── Implementation status ── */}
      <div className="rarity-info-card">
        <div className="rarity-info-title">Rarity Implementation Status</div>
        <div className="rarity-info-badges">
          <div className="rarity-badge rarity-badge-pre">
            <span className="rarity-badge-icon">✅</span>
            <div>
              <div className="rarity-badge-label">Pre-Generation Rarity — Active</div>
              <div className="rarity-badge-desc">Weight-based probability per trait, configured in the Organize tab</div>
            </div>
          </div>
          <div className="rarity-badge rarity-badge-post">
            <span className="rarity-badge-icon">✅</span>
            <div>
              <div className="rarity-badge-label">Post-Generation Rarity — Active</div>
              <div className="rarity-badge-desc">Rarity Score ranking calculated after Export → ranked highest to lowest</div>
            </div>
          </div>
        </div>
        <div className="rarity-tier-legend">
          {[
            { label:'Legendary', color:'#f59e0b', range:'≤2%' },
            { label:'Epic',      color:'#a78bfa', range:'≤5%' },
            { label:'Rare',      color:'#60a5fa', range:'≤15%' },
            { label:'Uncommon',  color:'#34d399', range:'≤30%' },
            { label:'Common',    color:'#94a3b8', range:'>30%' },
          ].map(t => (
            <div key={t.label} className="rarity-legend-item">
              <span className="rarity-legend-dot" style={{ background:t.color }} />
              <span className="rarity-legend-label" style={{ color:t.color }}>{t.label}</span>
              <span className="rarity-legend-range">{t.range}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Per-layer accordion ── */}
      {analysis.length === 0 ? (
        <div style={{ textAlign:'center', color:'var(--dim)', fontSize:14, padding:'30px 0',
          background:'var(--bg1)', borderRadius:12, border:'1px solid var(--border)' }}>
          No layers found. Upload assets in the <b>Organize</b> tab first.
        </div>
      ) : (
        <div className="rarity-accordion-list">
          <div style={{ fontSize:11, color:'var(--dim)', marginBottom:8 }}>
            Click any layer to expand its trait breakdown ↓
          </div>
          {analysis.map(({ layer, traits, totalW }) => (
            <LayerAccordion key={layer.folder} layer={layer} traits={traits} totalW={totalW} supply={supply} />
          ))}
        </div>
      )}
    </div>
  );
}
