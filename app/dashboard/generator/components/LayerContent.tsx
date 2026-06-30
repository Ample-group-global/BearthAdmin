// @ts-nocheck
'use client';
import { useState, useRef } from 'react';
import AssetGrid    from './AssetGrid';
import SummaryPanel from './SummaryPanel';

function TraitNameEditor({ asset, folder, onRenamed }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(asset.name);
  const inputRef              = useRef<HTMLInputElement>(null);

  function startEdit() {
    setVal(asset.name);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function commit() {
    setEditing(false);
    const trimmed = val.trim();
    if (!trimmed || trimmed === asset.name) { setVal(asset.name); return; }
    await fetch('/api/layers/rename', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ folder, stem: asset.stem, name: trimmed }),
    });
    onRenamed?.();
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="lc-name-input"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter')  { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setEditing(false); setVal(asset.name); }
        }}
      />
    );
  }

  return (
    <div className="lc-file-name lc-file-name-editable" onClick={startEdit} title="Click to rename">
      {asset.name}
      <span className="lc-rename-icon">✏</span>
    </div>
  );
}

export default function LayerContent({ layer, layerWeights, allWeights, supply, onWeightChange, onLayersChange, onGenerate }) {
  const [view,      setView]      = useState(layer.assets.length > 0 ? 'advanced' : 'manage');  // 'manage' | 'advanced' | 'quickpreview'
  const [dragOver,  setDragOver]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  async function uploadFiles(files) {
    const imgs = files.filter(f => f.type.startsWith('image/'));
    if (!imgs.length) return;
    setUploading(true);
    const form = new FormData();
    form.append('layer', layer.folder);
    for (const f of imgs) form.append('files', f);
    await fetch('/api/upload', { method: 'POST', body: form });
    setUploading(false);
    onLayersChange?.();
  }

  async function deleteAsset(asset) {
    if (!asset.rel) return;
    if (!confirm(`Delete "${asset.name}"? This cannot be undone.`)) return;
    await fetch('/api/asset/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rel: asset.rel }),
    });
    onLayersChange?.();
  }

  function toggleView(v) { setView(prev => prev === v ? 'manage' : v); }

  return (
    <div className="lc-wrap">
      {/* ── Header ── */}
      <div className="lc-header">
        <div className="lc-header-left">
          <span className="lc-layer-name">{layer.label}</span>
          <button className="lc-hbtn" onClick={() => setView('manage')}>▶ Manage</button>
          <button className="lc-hbtn" onClick={() => { setView('manage'); fileRef.current?.click(); }}>▼ Add Files</button>
        </div>
        <div className="lc-header-right">
          <button
            className={`lc-toggle-btn${view === 'advanced' ? ' lc-toggle-active' : ''}`}
            onClick={() => toggleView('advanced')}
          >
            ● Advanced
          </button>
          <button
            className={`lc-toggle-btn${view === 'quickpreview' ? ' lc-toggle-active' : ''}`}
            onClick={() => toggleView('quickpreview')}
          >
            ● Quick Preview
          </button>
        </div>
      </div>

      {/* ── Manage / Upload view ── */}
      {view === 'manage' && (
        <div className="lc-manage">
          <div className="lc-upload-row">
            {/* Upload drop zone */}
            <div
              className={`lc-upload-zone${dragOver ? ' drag-over' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault(); setDragOver(false);
                uploadFiles([...e.dataTransfer.files]);
              }}
            >
              {uploading ? (
                <>
                  <div className="lc-upload-icon"><div className="spinner" /></div>
                  <div className="lc-upload-label">Uploading…</div>
                </>
              ) : (
                <>
                  <div className="lc-upload-icon">🖼</div>
                  <div className="lc-upload-label">Upload files</div>
                  <div className="lc-upload-sub">or drag and drop</div>
                  <div className="lc-upload-formats">image/png, image/jpg, image/jpeg, image/gif, image/webp up to 10MB</div>
                </>
              )}
            </div>

            {/* Add Custom Asset card */}
            <div className="lc-custom-asset">
              <div className="lc-custom-icon">🎨</div>
              <div className="lc-custom-label">Add Custom Asset</div>
              <div className="lc-custom-sub">An asset with no file that will only be used for metadata.</div>
            </div>
          </div>

          {/* Existing files list */}
          {layer.assets.length > 0 && (
            <div className="lc-file-grid">
              {layer.assets.map(asset => (
                <div key={asset.stem} className="lc-file-card">
                  <div className="lc-file-thumb">
                    {asset.rel ? (
                      <img
                        src={`/api/thumb/${asset.rel}`}
                        alt={asset.name}
                        loading="lazy"
                        onError={e => {
                        const ph = document.createElement('span');
                        ph.className = 'no-img';
                        ph.textContent = '🖼';
                        e.currentTarget.replaceWith(ph);
                      }}
                      />
                    ) : (
                      <span className="no-img" style={{ fontSize: 11, color: '#888' }}>NONE</span>
                    )}
                    {asset.rel && (
                      <button
                        className="lc-file-delete-btn"
                        title="Delete trait"
                        onClick={() => deleteAsset(asset)}
                      >🗑</button>
                    )}
                  </div>
                  <TraitNameEditor asset={asset} folder={layer.folder} onRenamed={onLayersChange} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Advanced: rarity weight sliders ── */}
      {view === 'advanced' && (
        <div className="lc-advanced-view">
          <AssetGrid
            key={layer.folder}
            layer={layer}
            layerWeights={layerWeights}
            supply={supply}
            onWeightChange={onWeightChange}
            onLayersChange={onLayersChange}
          />
          <SummaryPanel
            layer={layer}
            weights={allWeights}
            supply={supply}
            onGenerate={onGenerate}
          />
        </div>
      )}

      {/* ── Quick Preview: layer flow diagram ── */}
      {view === 'quickpreview' && (
        <div className="lc-qp-view">
          <div className="lc-qp-flow">
            <div className="qp-node">Start</div>
            <div className="qp-connector"><span className="qp-pct">100.0%</span></div>
            <div className="qp-node qp-node-active">{layer.label}</div>
            <div className="qp-connector"><span className="qp-pct">100.0%</span></div>
            <div className="qp-node">End</div>
          </div>
          <div className="lc-qp-info">
            <span className="lc-qp-badge">Default</span>
            <span className="lc-qp-badge">+</span>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/png,image/webp,image/jpeg,image/gif"
        style={{ display: 'none' }}
        onChange={e => e.target.files?.length && uploadFiles([...e.target.files])}
      />
    </div>
  );
}
