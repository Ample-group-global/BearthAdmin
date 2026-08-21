// @ts-nocheck
'use client';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { TIER_PRESET_WEIGHTS, TIERS, getTier } from '../../../../lib/studio/tiers';
import { calcRarity } from '../../../../lib/studio/probability';
import { useLayerFiles } from '../LayerFilesContext';
import RulesTabContent from './RulesTabContent';

const TIER_LABELS = [
  { label: 'Legendary', color: '#F59E0B' },
  { label: 'Epic',      color: '#A855F7' },
  { label: 'Rare',      color: '#3B82F6' },
  { label: 'Common',    color: '#6B7280' },
];

export default function RarityModal({
  layer, weights, supply, onSave, onDelete, onClose,
  allLayers, conflicts, onSaveConflicts, onSaveLayerMeta, onRenameTrait, focusStem,
}) {
  // Local state for weights - starts from parent weights
  const [localWs, setLocalWs] = useState<Record<string, number>>(() => ({ ...weights }));
  // Tracks explicit tier selections — capitalised label (Legendary/Epic/Rare/Common)
  const [localTiers, setLocalTiers] = useState<Record<string, string>>(() =>
    Object.fromEntries(layer.assets.map(a => [a.stem, capitalise(a.rarityTier ?? 'common')]))
  );
  const { getBlobUrl } = useLayerFiles();
  const listRef = useRef<HTMLDivElement>(null);

  function capitalise(s: string) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); }

  async function applyTier(asset, tierName: string) {
    const weight = TIER_PRESET_WEIGHTS[tierName] ?? 10;
    setW(asset.stem, weight);
    setLocalTiers(prev => ({ ...prev, [asset.stem]: tierName }));
    if (!asset.id) return;
    await fetch(`/api/nft-gen/traits/${asset.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rarityWeight: weight, rarityTier: tierName.toLowerCase(), isActive: true }),
    }).catch(() => {});
  }

  // Opened from a card click (not the gear icon) — scroll straight to that
  // trait's row and briefly highlight it, since this is now the same modal
  // both entry points share instead of a separate single-trait popup.
  useEffect(() => {
    if (!focusStem || !listRef.current) return;
    const row = listRef.current.querySelector(`[data-stem="${CSS.escape(focusStem)}"]`);
    if (!row) return;
    row.scrollIntoView({ block: 'center' });
    row.classList.add('rm-row-focused');
    const t = setTimeout(() => row.classList.remove('rm-row-focused'), 1800);
    return () => clearTimeout(t);
  }, [focusStem]);

  const [tab, setTab] = useState<'assets' | 'rules'>('assets');
  const [compact, setCompact] = useState(false);
  const [name, setName] = useState(layer.label ?? layer.folder);
  const [rarityPct, setRarityPct] = useState(layer.rarityPct ?? 100);
  const [traitNames, setTraitNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(layer.assets.map(a => [a.stem, a.name])));
  const [weightInputOpen, setWeightInputOpen] = useState<Record<string, boolean>>({});

  const totalW  = useMemo(() => Object.values(localWs).reduce((a, b) => a + b, 0), [localWs]);
  // sliderMax scales with the heaviest trait so the thumb and tier-zone bar
  // stay meaningful even when weights are large (e.g. Excel-imported 82-820).
  const sliderMax = useMemo(() => Math.max(100, ...Object.values(localWs)), [localWs]);

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
    // Sort assets by current weight ascending — rarest first. Boundaries
    // match the same TIERS thresholds used for the tier badges shown right
    // below (was previously 10/25/50%, badges use 1/5/15% — mismatched).
    const sorted = [...layer.assets].sort((a, b) => (localWs[a.stem] ?? 1) - (localWs[b.stem] ?? 1));
    const n = sorted.length;
    const eq = { ...localWs };
    sorted.forEach((a, i) => {
      const pct = i / Math.max(n - 1, 1);
      if (pct < TIERS[0].max)      eq[a.stem] = TIER_PRESET_WEIGHTS.Legendary;
      else if (pct < TIERS[1].max) eq[a.stem] = TIER_PRESET_WEIGHTS.Epic;
      else if (pct < TIERS[2].max) eq[a.stem] = TIER_PRESET_WEIGHTS.Rare;
      else                         eq[a.stem] = TIER_PRESET_WEIGHTS.Common;
    });
    setLocalWs(eq);
  }

  function commitTraitName(asset) {
    const next = traitNames[asset.stem]?.trim();
    if (!next || next === asset.name) return;
    onRenameTrait?.(asset, next);
  }

  function handleSave() {
    onSave(localWs);
    // isActive intentionally not sent here — it's the same flag the
    // sync-from-disk reconcile step uses to remove/restore layers based on
    // what's actually on disk. Wiring this toggle to it risks a layer either
    // becoming unreachable (no gear icon left to undo it) or silently
    // reappearing on the next sync. Name/rarity are safe: they're pure
    // display fields with no reconcile interaction.
    onSaveLayerMeta?.({ displayName: name, layerRarityPct: rarityPct });
    onClose();
  }

  const layerRuleCount = allLayers
    ? (conflicts ?? []).filter(r => r.ifLayer === layer.folder || r.thenLayer === layer.folder).length
    : (conflicts ?? []).length;

  return (
    <div className="rm-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="rm-modal" style={compact ? { maxHeight: '90vh', overflowY: 'auto' } : undefined}>
        {/* Header */}
        <div className="rm-header">
          <div>
            <div className="rm-title">{layer.folder} <span style={{ opacity: .5, margin: '0 4px' }}>›</span> {layer.count} traits</div>
            <div className="rm-sub">Layer Rarity Settings</div>
          </div>
          <button className="rm-close" onClick={onClose}>✕</button>
        </div>

        {/* Layer Metadata — hidden on Rules tab (keeps room for dropdown to open downward) */}
        {onSaveLayerMeta && tab !== 'rules' && (
          <div style={{ padding: '14px 20px 4px' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>Layer Metadata</div>
            <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 10 }}>Layer details appearing in the token metadata.</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', minWidth: 40 }}>Name</span>
              <input
                className="rm-w-input"
                style={{ flex: 1, width: 'auto', textAlign: 'left', padding: '7px 10px' }}
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginTop: 14, marginBottom: 2 }}>Layer Rarity</div>
            <div style={{ fontSize: 11.5, color: 'var(--dim)', marginBottom: 8 }}>Chance for this layer to appear in your tokens. 100% means every token has it.</div>
            <div className="rm-slider-row">
              <input
                className="rm-w-input"
                type="number" min="0" max="100" step="1"
                style={{ width: 64 }}
                value={rarityPct}
                onChange={e => setRarityPct(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
              />
              <input
                className="rm-slider"
                type="range" min="0" max="100" step="1"
                value={rarityPct}
                onChange={e => setRarityPct(parseFloat(e.target.value))}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent2)', width: 40, textAlign: 'right' }}>{rarityPct}%</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 20, padding: '14px 20px 0',
          borderBottom: '1px solid var(--border)',
          ...(compact ? { position: 'sticky', top: 0, background: 'var(--bg1)', zIndex: 10 } : {}),
        }}>
          <button
            onClick={() => setTab('assets')}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 10px',
              fontSize: 13, fontWeight: 700, color: tab === 'assets' ? 'var(--text)' : 'var(--dim)',
              borderBottom: tab === 'assets' ? '2px solid var(--accent)' : '2px solid transparent',
            }}
          >Assets <span style={{ opacity: .6, fontWeight: 500 }}>{layer.count}</span></button>
          {onSaveConflicts && (
            <button
              onClick={() => setTab('rules')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 10px',
                fontSize: 13, fontWeight: 700, color: tab === 'rules' ? 'var(--text)' : 'var(--dim)',
                borderBottom: tab === 'rules' ? '2px solid var(--accent)' : '2px solid transparent',
              }}
            >Rules <span style={{ opacity: .6, fontWeight: 500 }}>{layerRuleCount}</span></button>
          )}
          {(tab === 'assets' || tab === 'rules') && (
            <button
              onClick={() => setCompact(c => !c)}
              title={compact ? 'Switch to detailed view' : 'Switch to compact view'}
              style={{
                marginLeft: 'auto', marginBottom: 10,
                background: compact ? 'var(--bg2)' : 'none',
                border: '1px solid var(--border2)', borderRadius: 6,
                padding: '3px 10px', fontSize: 11, fontWeight: 600,
                color: compact ? 'var(--text)' : 'var(--dim)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1 }}>{compact ? '▤' : '☰'}</span>
              {compact ? 'Detailed' : 'Compact'}
            </button>
          )}
        </div>

        {tab === 'rules' && onSaveConflicts ? (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <RulesTabContent layer={layer} layers={allLayers ?? [layer]} rules={conflicts} onChange={onSaveConflicts} compact={compact} />
          </div>
        ) : (
        <>
        {/* Asset List */}
        <div
          className="rm-list rm-list-v2"
          ref={listRef}
          style={compact ? { maxHeight: 'none', overflow: 'visible' } : undefined}
        >
          {[...layer.assets]
            .sort((a, b) => a.stem.localeCompare(b.stem, undefined, { numeric: true, sensitivity: 'base' }))
            .map((asset, idx) => {
            const w = localWs[asset.stem] ?? 1;
            const { pct, tier } = calcRarity(w, totalW, supply);
            const enabled = w > 0;

            if (compact) {
              // ── Compact row (no slider, no tier-zone bar) ──────────────────
              return (
                <div
                  key={asset.stem}
                  data-stem={asset.stem}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '0 14px', height: 38,
                    borderBottom: '1px solid var(--border)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.03)',
                    opacity: enabled ? 1 : 0.4,
                  }}
                >
                  {/* Tier-coloured enable dot */}
                  <button
                    onClick={() => setW(asset.stem, enabled ? 0 : (asset.defaultWeight ?? 1))}
                    title={enabled ? 'Disable trait' : 'Enable trait'}
                    style={{
                      width: 9, height: 9, borderRadius: '50%', border: 'none', padding: 0,
                      background: enabled ? tier.color : 'var(--border2)',
                      cursor: 'pointer', flexShrink: 0,
                      boxShadow: enabled ? `0 0 5px ${tier.color}80` : 'none',
                    }}
                  />

                  {/* Tiny thumbnail */}
                  <div style={{
                    width: 26, height: 26, flexShrink: 0, borderRadius: 4,
                    overflow: 'hidden', background: 'var(--bg2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {asset.rel
                      ? <img src={getBlobUrl(asset.rel) ?? `/api/thumb/${asset.rel}`} alt={asset.name}
                          loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      : <span style={{ fontSize: 8, color: 'var(--xdim)', fontWeight: 600 }}>NONE</span>
                    }
                  </div>

                  {/* Stem (monospace accent) */}
                  <span style={{
                    fontFamily: 'monospace', fontSize: 12, fontWeight: 700,
                    color: 'var(--accent)', flexShrink: 0, minWidth: 38,
                  }}>{asset.stem}</span>

                  {/* Display name (if different from stem) */}
                  <span style={{
                    fontSize: 12, color: 'var(--muted)', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {(traitNames[asset.stem] ?? asset.name) !== asset.stem
                      ? (traitNames[asset.stem] ?? asset.name) : ''}
                  </span>

                  {/* Tier dropdown — compact */}
                  <select
                    value={localTiers[asset.stem] ?? capitalise(asset.rarityTier ?? 'common')}
                    onChange={e => applyTier(asset, e.target.value)}
                    style={{
                      fontSize: 11, fontWeight: 700, color: tier.color,
                      background: 'var(--bg0)', border: '1px solid var(--border2)',
                      borderRadius: 5, padding: '2px 5px', cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    <option value="Legendary">Legendary</option>
                    <option value="Epic">Epic</option>
                    <option value="Rare">Rare</option>
                    <option value="Common">Common</option>
                  </select>

                  {/* % chip */}
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: 'var(--muted)',
                    minWidth: 42, textAlign: 'right', flexShrink: 0,
                  }}>
                    <span style={{ color: tier.color, opacity: 0.8, marginRight: 1 }}>◈</span>{pct}%
                  </span>

                  {/* Delete */}
                  {asset.rel && (
                    <button
                      title="Delete trait"
                      onClick={() => { if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return; onDelete?.(asset); }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 13, color: 'var(--xdim)', padding: '0 2px',
                        lineHeight: 1, flexShrink: 0,
                      }}
                    >🗑</button>
                  )}
                </div>
              );
            }

            // ── Detailed row (original) ─────────────────────────────────────
            // Bar color follows the dropdown tier the user assigned (not the
            // computed probability tier) so the visual matches their intent.
            const dropdownTierColor = TIER_LABELS.find(
              t => t.label === (localTiers[asset.stem] ?? '')
            )?.color ?? tier.color;
            const fillPct = sliderMax > 0 ? Math.min(100, (w / sliderMax) * 100) : 0;

            return (
              <div key={asset.stem} data-stem={asset.stem} className={`rm-row-v2${enabled ? '' : ' rm-row-disabled'}`}>
                <button
                  className={`rm-radio${enabled ? ' rm-radio-on' : ''}`}
                  onClick={() => setW(asset.stem, enabled ? 0 : 1)}
                  title={enabled ? 'Disable trait' : 'Enable trait'}
                >
                  {enabled && <span className="rm-radio-dot" />}
                </button>

                <div className="rm-thumb rm-thumb-v2">
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

                <input
                  className="rm-name-input"
                  value={traitNames[asset.stem] ?? asset.name}
                  onChange={e => setTraitNames(prev => ({ ...prev, [asset.stem]: e.target.value }))}
                  onBlur={() => commitTraitName(asset)}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                />

                <select
                  className="rm-tier-select"
                  data-stem={asset.stem}
                  value={localTiers[asset.stem] ?? capitalise(asset.rarityTier ?? 'common')}
                  onChange={e => applyTier(asset, e.target.value)}
                  style={{
                    background: 'var(--bg0)', border: '1px solid var(--border2)', borderRadius: 6,
                    color: tier.color, fontSize: 11.5, fontWeight: 700, padding: '4px 8px',
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  <option value="Legendary">Legendary</option>
                  <option value="Epic">Epic</option>
                  <option value="Rare">Rare</option>
                  <option value="Common">Common</option>
                </select>

                <div className="rm-pct-chip" title="Chance this trait is picked when its layer appears">
                  <span className="rm-pct-icon">◈</span>{pct}%
                </div>

                <div className="rm-tierzone-col">
                  {/* Fill bar: color = dropdown tier, width = weight proportion */}
                  <div className="rm-tier-bar" style={{ position: 'relative', overflow: 'hidden' }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: `${dropdownTierColor}22`,
                    }} />
                    <div style={{
                      position: 'absolute', top: 0, left: 0, bottom: 0,
                      width: `${fillPct}%`,
                      background: dropdownTierColor,
                      opacity: 0.55,
                      transition: 'width .1s',
                    }} />
                  </div>
                  <input
                    className="rm-slider rm-slider-v2"
                    type="range"
                    min="0"
                    max={sliderMax}
                    step={Math.max(1, Math.ceil(sliderMax / 200))}
                    value={w}
                    onChange={e => setW(asset.stem, parseFloat(e.target.value))}
                  />
                </div>

                <button
                  className={`rm-pct-toggle${weightInputOpen[asset.stem] ? ' rm-pct-toggle-on' : ''}`}
                  title="Show exact weight number"
                  onClick={() => setWeightInputOpen(prev => ({ ...prev, [asset.stem]: !prev[asset.stem] }))}
                >%</button>
                {weightInputOpen[asset.stem] && (
                  <input
                    className="rm-w-input"
                    type="number" min="0" step="0.1"
                    value={w}
                    onChange={e => setW(asset.stem, Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                )}

                {asset.rel && (
                  <button
                    className="rm-delete-btn rm-delete-btn-v2"
                    title="Delete trait"
                    onClick={() => {
                      if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;
                      onDelete?.(asset);
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>
            );
          })}
        </div>
        </>
        )}

        {/* Footer */}
        <div
          className="rm-footer"
          style={compact ? { position: 'sticky', bottom: 0, background: 'var(--bg1)', zIndex: 10 } : undefined}
        >
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save Rarity</button>
        </div>
      </div>
    </div>
  );
}
