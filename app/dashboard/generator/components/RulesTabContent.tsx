// @ts-nocheck
'use client';
import { useState, useMemo } from 'react';

// Standalone copy of the rule-builder UI (not shared with ConflictsPanel.tsx)
// so this new embedded tab can't affect that already-working standalone
// modal in any way. Auto-saves on every add/remove — no separate Save button
// here, matching the instant-save pattern already used for rarity weights
// elsewhere in this app.

const sel: React.CSSProperties = {
  background: 'var(--bg0)', border: '1px solid var(--border2)',
  color: 'var(--text)', padding: '6px 10px', borderRadius: 7,
  fontSize: 12, minWidth: 130, cursor: 'pointer',
};

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

export default function RulesTabContent({ layers, rules: initialRules, onChange }) {
  const [rules, setRules]         = useState(() => normalizeRules(initialRules));
  const [ruleType, setRuleType]   = useState<'exclude' | 'force'>('force');
  const [ifLayer, setIfLayer]     = useState('');
  const [ifTrait, setIfTrait]     = useState('');
  const [thenLayer, setThenLayer] = useState('');
  const [thenTraits, setThenTraits] = useState<string[]>([]);

  const getAssets    = (folder) => layers.find(l => l.folder === folder)?.assets ?? [];
  const getLabel     = (folder) => layers.find(l => l.folder === folder)?.label  ?? folder;
  const getTraitName = (folder, stem) => getAssets(folder).find(a => a.stem === stem)?.name ?? stem;

  const thenAssets = useMemo(() => getAssets(thenLayer), [thenLayer, layers]);

  function commit(next: typeof rules) {
    setRules(next);
    onChange(next);
  }

  function toggleThenTrait(stem: string) {
    setThenTraits(prev => prev.includes(stem) ? prev.filter(s => s !== stem) : [...prev, stem]);
  }

  function addRule() {
    if (!ifLayer || !ifTrait || !thenLayer || thenTraits.length === 0) return;
    const key = `${ruleType}|${ifLayer}|${ifTrait}|${thenLayer}`;
    const existing = rules.find(r => `${r.type}|${r.ifLayer}|${r.ifTrait}|${r.thenLayer}` === key);
    if (existing) {
      const merged = [...new Set([...existing.thenTraits, ...thenTraits])];
      commit(rules.map(r => r === existing ? { ...r, thenTraits: merged } : r));
    } else {
      commit([...rules, {
        id: Math.random().toString(36).slice(2),
        type: ruleType, ifLayer, ifTrait, thenLayer, thenTraits: [...thenTraits],
      }]);
    }
    setThenTraits([]);
  }

  function removeRule(id: string) {
    commit(rules.filter(r => r.id !== id));
  }

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
        A rule allows you to <b>force</b> or <b>block</b> certain traits to match together.
      </div>

      {rules.length > 0 && (
        <div style={{ overflowY: 'auto', marginBottom: 14, maxHeight: 220 }}>
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

      <div style={{
        background: 'var(--bg2)', borderRadius: 10, padding: '14px 16px',
        border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--xdim)', fontWeight: 700 }}>IF</span>
          <select style={sel} value={ifLayer} onChange={e => { setIfLayer(e.target.value); setIfTrait(''); }}>
            <option value="">— Layer —</option>
            {layers.map(l => <option key={l.folder} value={l.folder}>{l.label}</option>)}
          </select>
          <select style={sel} value={ifTrait} onChange={e => setIfTrait(e.target.value)} disabled={!ifLayer}>
            <option value="">— Trait —</option>
            {getAssets(ifLayer).map(a => <option key={a.stem} value={a.stem}>{a.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--xdim)', fontWeight: 700 }}>THEN</span>
          <select style={sel} value={ruleType} onChange={e => setRuleType(e.target.value as 'exclude' | 'force')}>
            <option value="force">force — only compatible with</option>
            <option value="exclude">block — never compatible with</option>
          </select>
          <select style={sel} value={thenLayer} onChange={e => { setThenLayer(e.target.value); setThenTraits([]); }}>
            <option value="">— Layer —</option>
            {layers.map(l => <option key={l.folder} value={l.folder}>{l.label}</option>)}
          </select>
          <button className="btn btn-primary" disabled={!ifLayer || !ifTrait || !thenLayer || thenTraits.length === 0} onClick={addRule}>Add Rule</button>
          <button className="btn btn-ghost" onClick={deleteAll}>Delete All</button>
        </div>

        {thenLayer && (
          <div style={{
            maxHeight: 140, overflowY: 'auto',
            background: 'var(--bg0)', border: '1px solid var(--border2)',
            borderRadius: 7, padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3,
          }}>
            {thenAssets.length === 0
              ? <span style={{ fontSize: 11, color: 'var(--xdim)' }}>No assets in this layer</span>
              : thenAssets.map(a => (
                <label key={a.stem} style={{
                  display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                  fontSize: 12, color: thenTraits.includes(a.stem) ? 'var(--accent2)' : 'var(--muted)',
                  fontWeight: thenTraits.includes(a.stem) ? 700 : 400,
                }}>
                  <input type="checkbox" checked={thenTraits.includes(a.stem)} onChange={() => toggleThenTrait(a.stem)} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
                  {a.name}
                </label>
              ))
            }
          </div>
        )}
      </div>
    </div>
  );
}
