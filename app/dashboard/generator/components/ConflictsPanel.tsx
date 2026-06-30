// @ts-nocheck
'use client';
import { useState, useMemo } from 'react';

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const panel: React.CSSProperties = {
  background: 'var(--bg1)', borderRadius: 14, padding: 24,
  width: 680, maxWidth: '95vw', maxHeight: '88vh',
  display: 'flex', flexDirection: 'column', gap: 0,
  boxShadow: '0 20px 60px rgba(0,0,0,.3)',
};
const sel: React.CSSProperties = {
  background: 'var(--bg0)', border: '1px solid var(--border2)',
  color: 'var(--text)', padding: '6px 10px', borderRadius: 7,
  fontSize: 12, minWidth: 120, cursor: 'pointer',
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

export default function ConflictsPanel({ layers, rules: initialRules, onSave, onClose }) {
  const [rules, setRules]         = useState(() => normalizeRules(initialRules));
  const [saving, setSaving]       = useState(false);
  const [ruleType, setRuleType]   = useState<'exclude' | 'force'>('exclude');
  const [ifLayer, setIfLayer]     = useState('');
  const [ifTrait, setIfTrait]     = useState('');
  const [thenLayer, setThenLayer] = useState('');
  const [thenTraits, setThenTraits] = useState<string[]>([]);

  const getAssets    = (folder) => layers.find(l => l.folder === folder)?.assets ?? [];
  const getLabel     = (folder) => layers.find(l => l.folder === folder)?.label  ?? folder;
  const getTraitName = (folder, stem) => getAssets(folder).find(a => a.stem === stem)?.name ?? stem;

  const thenAssets = useMemo(() => getAssets(thenLayer), [thenLayer, layers]);

  function toggleThenTrait(stem: string) {
    setThenTraits(prev =>
      prev.includes(stem) ? prev.filter(s => s !== stem) : [...prev, stem]
    );
  }

  function addRule() {
    if (!ifLayer || !ifTrait || !thenLayer || thenTraits.length === 0) return;
    // Merge into existing rule if same (type, ifLayer, ifTrait, thenLayer)
    const key = `${ruleType}|${ifLayer}|${ifTrait}|${thenLayer}`;
    setRules(prev => {
      const existing = prev.find(r => `${r.type}|${r.ifLayer}|${r.ifTrait}|${r.thenLayer}` === key);
      if (existing) {
        const merged = [...new Set([...existing.thenTraits, ...thenTraits])];
        return prev.map(r => r === existing ? { ...r, thenTraits: merged } : r);
      }
      return [...prev, {
        id: Math.random().toString(36).slice(2),
        type: ruleType, ifLayer, ifTrait, thenLayer, thenTraits: [...thenTraits],
      }];
    });
    setThenTraits([]);
  }

  function removeRule(id: string) {
    setRules(prev => prev.filter(r => r.id !== id));
  }

  function removeTrait(id: string, stem: string) {
    setRules(prev => prev.map(r => {
      if (r.id !== id) return r;
      const next = r.thenTraits.filter(s => s !== stem);
      return next.length ? { ...r, thenTraits: next } : null;
    }).filter(Boolean));
  }

  async function save() {
    setSaving(true);
    await onSave(rules);
    setSaving(false);
    onClose();
  }

  const typeLabel = ruleType === 'exclude' ? 'EXCLUDE' : 'ONLY ALLOW';
  const typeBgExclude = ruleType === 'exclude';

  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div style={{ fontWeight:700, fontSize:16, color:'var(--text)' }}>⚡ Conflict Rules</div>
          <button className="btn btn-ghost" style={{ padding:'3px 10px' }} onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize:12, color:'var(--dim)', marginBottom:16, lineHeight:1.5 }}>
          <b>Exclude</b>: prevent a trait combo from appearing. <b>Only Allow</b>: when trait A is picked, layer B must use one of the allowed traits.
        </div>

        {/* Rules list */}
        <div style={{ flex:1, overflowY:'auto', marginBottom:16, maxHeight:260 }}>
          {rules.length === 0 ? (
            <div style={{ color:'var(--xdim)', fontSize:12, textAlign:'center', padding:'20px 0' }}>
              No conflict rules yet. Add one below.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {rules.map(rule => (
                <div key={rule.id} style={{
                  background:'var(--bg0)', border:'1px solid var(--border)',
                  borderRadius:9, padding:'10px 12px',
                }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <div style={{ flex:1, fontSize:12, lineHeight:1.6 }}>
                      <span style={{
                        display:'inline-block', fontSize:9, fontWeight:800, letterSpacing:.6,
                        padding:'2px 7px', borderRadius:9, marginRight:6, textTransform:'uppercase',
                        background: rule.type === 'exclude' ? 'rgba(239,68,68,.12)' : 'rgba(99,102,241,.12)',
                        color:      rule.type === 'exclude' ? '#ef4444'              : 'var(--accent)',
                        border:     `1px solid ${rule.type === 'exclude' ? 'rgba(239,68,68,.3)' : 'rgba(99,102,241,.3)'}`,
                      }}>{rule.type === 'exclude' ? 'EXCLUDE' : 'ONLY ALLOW'}</span>
                      <span style={{ color:'var(--dim)' }}>IF </span>
                      <span style={{ fontWeight:600 }}>{getLabel(rule.ifLayer)}</span>
                      <span style={{ color:'var(--dim)' }}> › </span>
                      <span style={{ color:'var(--accent2)', fontWeight:500 }}>{getTraitName(rule.ifLayer, rule.ifTrait)}</span>
                      <span style={{ color:'var(--dim)' }}> — {rule.type === 'exclude' ? 'exclude' : 'only allow'} </span>
                      <span style={{ fontWeight:600 }}>{getLabel(rule.thenLayer)}</span>
                      <span style={{ color:'var(--dim)' }}> › </span>
                    </div>
                    <button
                      className="btn btn-ghost"
                      style={{ padding:'2px 8px', fontSize:11, flexShrink:0 }}
                      onClick={() => removeRule(rule.id)}
                    >✕</button>
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:6, paddingLeft:4 }}>
                    {rule.thenTraits.map(stem => (
                      <span key={stem} style={{
                        display:'inline-flex', alignItems:'center', gap:4,
                        background:'var(--bg2)', border:'1px solid var(--border)',
                        borderRadius:6, padding:'2px 8px 2px 8px', fontSize:11.5, fontWeight:600,
                        color: rule.type === 'exclude' ? '#ef4444' : 'var(--accent)',
                      }}>
                        {getTraitName(rule.thenLayer, stem)}
                        <button
                          style={{ background:'none', border:'none', cursor:'pointer', padding:0, fontSize:10, color:'var(--xdim)', lineHeight:1 }}
                          onClick={() => removeTrait(rule.id, stem)}
                        >✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add rule form */}
        <div style={{
          background:'var(--bg2)', borderRadius:10, padding:'14px 16px', marginBottom:16,
          border:'1px solid var(--border)',
        }}>
          <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', marginBottom:12 }}>Add Rule</div>

          {/* Rule type */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
            <span style={{ fontSize:12, color:'var(--dim)', fontWeight:600, minWidth:50 }}>Type</span>
            <button
              style={{
                padding:'4px 12px', borderRadius:7, fontSize:11.5, fontWeight:700, cursor:'pointer',
                border:'1px solid var(--border)', transition:'all .12s',
                background: ruleType === 'exclude' ? 'rgba(239,68,68,.12)' : 'var(--bg0)',
                color:      ruleType === 'exclude' ? '#ef4444' : 'var(--dim)',
                borderColor: ruleType === 'exclude' ? 'rgba(239,68,68,.4)' : 'var(--border)',
              }}
              onClick={() => setRuleType('exclude')}
            >Exclude</button>
            <button
              style={{
                padding:'4px 12px', borderRadius:7, fontSize:11.5, fontWeight:700, cursor:'pointer',
                border:'1px solid var(--border)', transition:'all .12s',
                background: ruleType === 'force' ? 'rgba(99,102,241,.12)' : 'var(--bg0)',
                color:      ruleType === 'force' ? 'var(--accent)' : 'var(--dim)',
                borderColor: ruleType === 'force' ? 'rgba(99,102,241,.4)' : 'var(--border)',
              }}
              onClick={() => setRuleType('force')}
            >Only Allow</button>
            <span style={{ fontSize:11, color:'var(--xdim)', fontStyle:'italic' }}>
              {ruleType === 'exclude'
                ? 'When IF trait picked → selected THEN traits are forbidden'
                : 'When IF trait picked → THEN layer must use one of the selected traits'}
            </span>
          </div>

          {/* IF row */}
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:10 }}>
            <span style={{ fontSize:12, color:'var(--dim)', fontWeight:600, minWidth:50 }}>IF</span>
            <select style={sel} value={ifLayer} onChange={e => { setIfLayer(e.target.value); setIfTrait(''); }}>
              <option value="">— Layer —</option>
              {layers.map(l => <option key={l.folder} value={l.folder}>{l.label}</option>)}
            </select>
            <span style={{ fontSize:12, color:'var(--xdim)' }}>›</span>
            <select style={sel} value={ifTrait} onChange={e => setIfTrait(e.target.value)} disabled={!ifLayer}>
              <option value="">— Trait —</option>
              {getAssets(ifLayer).map(a => <option key={a.stem} value={a.stem}>{a.name}</option>)}
            </select>
          </div>

          {/* THEN row */}
          <div style={{ display:'flex', alignItems:'flex-start', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, color:'var(--dim)', fontWeight:600, minWidth:50, paddingTop:7 }}>
              {ruleType === 'exclude' ? 'EXCLUDE' : 'ALLOW'}
            </span>
            <select style={sel} value={thenLayer} onChange={e => { setThenLayer(e.target.value); setThenTraits([]); }}>
              <option value="">— Layer —</option>
              {layers.map(l => <option key={l.folder} value={l.folder}>{l.label}</option>)}
            </select>

            {thenLayer && (
              <div style={{
                flex:1, minWidth:200, maxHeight:120, overflowY:'auto',
                background:'var(--bg0)', border:'1px solid var(--border2)',
                borderRadius:7, padding:'6px 8px', display:'flex', flexDirection:'column', gap:3,
              }}>
                {thenAssets.length === 0
                  ? <span style={{ fontSize:11, color:'var(--xdim)' }}>No assets in this layer</span>
                  : thenAssets.map(a => (
                    <label key={a.stem} style={{
                      display:'flex', alignItems:'center', gap:7, cursor:'pointer',
                      fontSize:12, color: thenTraits.includes(a.stem) ? 'var(--accent2)' : 'var(--muted)',
                      fontWeight: thenTraits.includes(a.stem) ? 700 : 400,
                    }}>
                      <input
                        type="checkbox"
                        checked={thenTraits.includes(a.stem)}
                        onChange={() => toggleThenTrait(a.stem)}
                        style={{ accentColor:'var(--accent)', cursor:'pointer' }}
                      />
                      {a.name}
                    </label>
                  ))
                }
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ marginLeft:'auto', alignSelf:'flex-start' }}
              disabled={!ifLayer || !ifTrait || !thenLayer || thenTraits.length === 0}
              onClick={addRule}
            >+ Add</button>
          </div>

          {thenTraits.length > 0 && (
            <div style={{ marginTop:8, fontSize:11, color:'var(--dim)' }}>
              Selected: <b style={{ color:'var(--accent2)' }}>{thenTraits.map(s => getTraitName(thenLayer, s)).join(', ')}</b>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : `Save ${rules.length > 0 ? `(${rules.length}) ` : ''}Rules`}
          </button>
        </div>
      </div>
    </div>
  );
}
