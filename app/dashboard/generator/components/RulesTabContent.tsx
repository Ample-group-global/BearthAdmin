// @ts-nocheck
'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useLayerFiles } from '../LayerFilesContext';

// Standalone copy of the rule-builder UI (not shared with ConflictsPanel.tsx)
// so this new embedded tab can't affect that already-working standalone
// modal in any way. Auto-saves on every add/remove — no separate Save button
// here, matching the instant-save pattern already used for rarity weights.
//
// Layout matches the reference tool exactly: one row — [IF trait, scoped to
// the layer this modal is already open on] [force/block] [THEN trait,
// searchable across every other layer] — instead of a generic two-dropdown
// (layer, then trait) picker on both sides.

function normalizeRules(rules: any[]) {
  return (rules ?? []).map(r => ({
    id:         r.id ?? Math.random().toString(36).slice(2),
    type:       r.type ?? 'exclude',
    ifLayer:    r.ifLayer,
    ifTrait:    r.ifTrait,
    thenLayer:  r.thenLayer,
    thenTraits: Array.isArray(r.thenTraits) ? r.thenTraits : (r.thenTrait ? [r.thenTrait] : []),
  })).filter(r => r.ifLayer && r.ifTrait && r.thenLayer && r.thenTraits.length);
}

function useOutsideClose(ref, close) {
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) close(); }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [ref, close]);
}

function TraitThumb({ rel, name }) {
  const { getBlobUrl } = useLayerFiles();
  return rel ? (
    <img src={getBlobUrl(rel) ?? `/api/thumb/${rel}`} alt={name} loading="lazy"
      style={{ width: 22, height: 22, objectFit: 'contain', borderRadius: 4, background: 'var(--bg2)', flexShrink: 0 }}
      onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
  ) : <div style={{ width: 22, height: 22, flexShrink: 0 }} />;
}

// IF side — single-select, scoped to the current layer's own assets only.
function IfTraitDropdown({ assets, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutsideClose(ref, () => setOpen(false));
  const selected = assets.find(a => a.stem === value);

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: 160 }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={ddBtn}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected ? selected.name : 'Select a trait'}</span>
        <span style={{ opacity: .5 }}>⌄</span>
      </button>
      {open && (
        <div style={ddPanel}>
          {assets.map(a => (
            <div key={a.stem} onClick={() => { onChange(a.stem); setOpen(false); }} style={ddRow}>
              <TraitThumb rel={a.rel} name={a.name} />
              <span>{a.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// THEN side — multi-select, searchable, grouped by layer (every layer except
// none excluded — a rule can reference the same layer too).
function ThenTraitDropdown({ layers, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useOutsideClose(ref, () => setOpen(false));

  const filtered = useMemo(() => {
    if (!q.trim()) return layers;
    const needle = q.trim().toLowerCase();
    return layers
      .map(l => ({ ...l, assets: l.assets.filter(a => a.name.toLowerCase().includes(needle)) }))
      .filter(l => l.assets.length);
  }, [layers, q]);

  function toggle(layerFolder, stem) {
    const key = `${layerFolder}::${stem}`;
    onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key]);
  }

  const label = value.length === 0 ? 'Select a trait' : value.length === 1 ? '1 trait selected' : `${value.length} traits selected`;

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: 160 }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={ddBtn}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        <span style={{ opacity: .5 }}>⌄</span>
      </button>
      {open && (
        <div style={{ ...ddPanel, width: 260 }}>
          <input
            autoFocus
            placeholder="Search a trait"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', marginBottom: 6, borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--bg1)', color: 'var(--text)', fontSize: 12 }}
          />
          {filtered.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--xdim)', padding: '4px 2px' }}>No matching traits</div>}
          {filtered.map(l => (
            <div key={l.folder} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)', padding: '4px 4px 2px' }}>{l.label}</div>
              {l.assets.map(a => {
                const key = `${l.folder}::${a.stem}`;
                const checked = value.includes(key);
                return (
                  <label key={a.stem} onClick={() => toggle(l.folder, a.stem)} style={{ ...ddRow, color: checked ? 'var(--accent2)' : 'var(--muted)', fontWeight: checked ? 700 : 400 }}>
                    <input type="checkbox" checked={checked} readOnly style={{ accentColor: 'var(--accent)', pointerEvents: 'none' }} />
                    <TraitThumb rel={a.rel} name={a.name} />
                    <span>{a.name}</span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ddBtn: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
  background: 'var(--bg0)', border: '1px solid var(--border2)', color: 'var(--text)',
  padding: '7px 10px', borderRadius: 7, fontSize: 12, cursor: 'pointer',
};
const ddPanel: React.CSSProperties = {
  position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 20,
  background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 8,
  padding: 6, width: 220, maxHeight: 260, overflowY: 'auto',
  boxShadow: '0 10px 30px rgba(0,0,0,.35)',
};
const ddRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px', borderRadius: 6,
  cursor: 'pointer', fontSize: 12.5, color: 'var(--muted)',
};

export default function RulesTabContent({ layer, layers, rules: initialRules, onChange }) {
  const [rules, setRules]         = useState(() => normalizeRules(initialRules));
  const [ruleType, setRuleType]   = useState<'exclude' | 'force'>('force');
  const [ifTrait, setIfTrait]     = useState('');
  const [thenKeys, setThenKeys]   = useState<string[]>([]);

  const getLabel     = (folder) => layers.find(l => l.folder === folder)?.label ?? folder;
  const getTraitName = (folder, stem) => layers.find(l => l.folder === folder)?.assets.find(a => a.stem === stem)?.name ?? stem;

  function commit(next: typeof rules) {
    setRules(next);
    onChange(next);
  }

  function addRule() {
    if (!ifTrait || thenKeys.length === 0) return;
    // Group the picked then-traits by their own layer — one rule per distinct target layer.
    const byLayer: Record<string, string[]> = {};
    for (const key of thenKeys) {
      const [thenLayer, stem] = key.split('::');
      (byLayer[thenLayer] ??= []).push(stem);
    }
    let next = [...rules];
    for (const [thenLayer, stems] of Object.entries(byLayer)) {
      const ruleKey = `${ruleType}|${layer.folder}|${ifTrait}|${thenLayer}`;
      const existing = next.find(r => `${r.type}|${r.ifLayer}|${r.ifTrait}|${r.thenLayer}` === ruleKey);
      if (existing) {
        const merged = [...new Set([...existing.thenTraits, ...stems])];
        next = next.map(r => r === existing ? { ...r, thenTraits: merged } : r);
      } else {
        next = [...next, { id: Math.random().toString(36).slice(2), type: ruleType, ifLayer: layer.folder, ifTrait, thenLayer, thenTraits: stems }];
      }
    }
    commit(next);
    setThenKeys([]);
  }

  function removeRule(id: string) { commit(rules.filter(r => r.id !== id)); }
  function removeTrait(id: string, stem: string) {
    commit(rules.map(r => {
      if (r.id !== id) return r;
      const next = r.thenTraits.filter(s => s !== stem);
      return next.length ? { ...r, thenTraits: next } : null;
    }).filter(Boolean));
  }
  function deleteAll() {
    if (!rules.length) return;
    if (!confirm(`Delete all ${rules.length} rule(s)? This cannot be undone.`)) return;
    commit([]);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 14, lineHeight: 1.5 }}>
        A rule allows you to <b>force</b> or <b>block</b> certain traits to match together. If you have too many rules, consider deleting unused ones.
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
        <IfTraitDropdown assets={layer.assets} value={ifTrait} onChange={setIfTrait} />
        <select value={ruleType} onChange={e => setRuleType(e.target.value as 'exclude' | 'force')} style={{ ...ddBtn, width: 'auto', cursor: 'pointer' }}>
          <option value="force">⚡ force</option>
          <option value="exclude">⃠ block</option>
        </select>
        <ThenTraitDropdown layers={layers} value={thenKeys} onChange={setThenKeys} />
        <button className="btn btn-primary" disabled={!ifTrait || thenKeys.length === 0} onClick={addRule} style={{ whiteSpace: 'nowrap' }}>Add Rule</button>
        <button className="btn btn-ghost" onClick={deleteAll} style={{ whiteSpace: 'nowrap' }}>Delete All</button>
      </div>

      {rules.length > 0 && (
        <div style={{ overflowY: 'auto', maxHeight: 220 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rules.map(rule => (
              <div key={rule.id} style={{ background: 'var(--bg0)', border: '1px solid var(--border)', borderRadius: 9, padding: '10px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, fontSize: 12, lineHeight: 1.6 }}>
                    <span style={{
                      display: 'inline-block', fontSize: 9, fontWeight: 800, letterSpacing: .6,
                      padding: '2px 7px', borderRadius: 9, marginRight: 6, textTransform: 'uppercase',
                      background: rule.type === 'exclude' ? 'rgba(239,68,68,.12)' : 'rgba(99,102,241,.12)',
                      color:      rule.type === 'exclude' ? '#ef4444'              : 'var(--accent)',
                      border:     `1px solid ${rule.type === 'exclude' ? 'rgba(239,68,68,.3)' : 'rgba(99,102,241,.3)'}`,
                    }}>{rule.type === 'exclude' ? 'BLOCK' : 'FORCE'}</span>
                    <span style={{ color: 'var(--dim)' }}>IF </span>
                    <span style={{ fontWeight: 600 }}>{getLabel(rule.ifLayer)}</span>
                    <span style={{ color: 'var(--dim)' }}> › </span>
                    <span style={{ color: 'var(--accent2)', fontWeight: 500 }}>{getTraitName(rule.ifLayer, rule.ifTrait)}</span>
                    <span style={{ color: 'var(--dim)' }}> — {rule.type === 'exclude' ? 'block' : 'force'} </span>
                    <span style={{ fontWeight: 600 }}>{getLabel(rule.thenLayer)}</span>
                    <span style={{ color: 'var(--dim)' }}> › </span>
                  </div>
                  <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: 11, flexShrink: 0 }} onClick={() => removeRule(rule.id)}>✕</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, paddingLeft: 4 }}>
                  {rule.thenTraits.map(stem => (
                    <span key={stem} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: 'var(--bg2)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '2px 8px', fontSize: 11.5, fontWeight: 600,
                      color: rule.type === 'exclude' ? '#ef4444' : 'var(--accent)',
                    }}>
                      {getTraitName(rule.thenLayer, stem)}
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 10, color: 'var(--xdim)', lineHeight: 1 }} onClick={() => removeTrait(rule.id, stem)}>✕</button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
