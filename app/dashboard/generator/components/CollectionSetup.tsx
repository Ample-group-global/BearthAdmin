// @ts-nocheck
'use client';
import { useState, useRef, useEffect } from 'react';
import { useLayerFiles } from '../LayerFilesContext';

// Client-side display name derivation — mirrors server-side getName in lib/studio/layers.ts
function deriveLabelFromFolder(fname) {
  return fname.replace(/^\d+[-_]/, '').replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()).trim() || fname;
}

function clientGetName(folder, stem, rel) {
  // Nested path (e.g. "10-hand/10-6-panda/10-6-7.png") → extract name from parent dir
  if (rel) {
    const parts = rel.split('/');
    if (parts.length >= 3) {
      const parentDir = parts[parts.length - 2];
      const d2 = parentDir.replace(/^\d+[-_]\d+[-_]/, '').trim();
      if (d2 && /[a-zA-Z]/.test(d2))
        return d2.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
      const d1 = parentDir.replace(/^\d+[-_]/, '').trim();
      if (d1 && /[a-zA-Z]/.test(d1))
        return d1.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
    }
  }
  // Flat numeric stem (e.g. "0-1", "2-5") → "LayerLabel N"
  const folderNum = (folder.match(/^(\d+)/) || [])[1] || '';
  const inner = folderNum ? stem.replace(new RegExp('^' + folderNum + '[-_]'), '') : stem;
  const firstSeg = inner.split(/[-_]/)[0];
  if (firstSeg && /^\d+$/.test(firstSeg))
    return deriveLabelFromFolder(folder) + ' ' + firstSeg;
  return inner.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() || stem;
}

// Parse layer structure from dropped files client-side (mirrors server scanLayers)
function parseLayersFromFiles(files) {
  const groups = new Map(); // folder -> [{ file, stem, rel }]
  const fileMap = new Map(); // rel -> File

  for (const file of files) {
    const wpath = file.webkitRelativePath || file.name;
    const parts = wpath.split('/').filter(Boolean);
    const layerIdx = parts.findIndex(p => /^\d+[-_]/.test(p));
    if (layerIdx === -1) continue;
    if (!file.name.match(/\.(png|webp|jpg|jpeg|gif)$/i)) continue;

    const layerName = parts[layerIdx];
    const rel = parts.slice(layerIdx).join('/');
    const stem = file.name.replace(/\.(png|webp|jpg|jpeg|gif)$/i, '');

    if (!groups.has(layerName)) groups.set(layerName, []);
    groups.get(layerName).push({ file, stem, rel });
    fileMap.set(rel, file);
  }

  const sorted = [...groups.entries()].sort((a, b) => {
    const na = parseInt(a[0]), nb = parseInt(b[0]);
    return (isNaN(na) ? 999 : na) - (isNaN(nb) ? 999 : nb);
  });

  const layers = sorted.map(([folder, entries]) => {
    const label = folder
      .replace(/^\d+[-_]/, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim() || folder;
    const assets = entries
      .map(({ stem, rel }) => ({
        stem,
        name: clientGetName(folder, stem, rel),
        rel,
        defaultWeight: 1,
      }))
      .sort((a, b) => a.stem.localeCompare(b.stem, undefined, { numeric: true, sensitivity: 'base' }));

    // Disambiguate duplicate display names (same logic as server-side buildCache)
    const nameCounts = {};
    for (const a of assets) nameCounts[a.name] = (nameCounts[a.name] ?? 0) + 1;
    const nameIdx = {};
    for (const a of assets) {
      if (nameCounts[a.name] > 1) {
        nameIdx[a.name] = (nameIdx[a.name] ?? 0) + 1;
        a.name = `${a.name} ${nameIdx[a.name]}`;
      }
    }

    return { folder, label, count: assets.length, optional: false, assets };
  });

  return { layers, fileMap };
}

function applyNameFormat(fmt, idx) {
  if (!fmt) return `#${idx}`;
  if (fmt.includes('{{id}}')) return fmt.replace(/\{\{id\}\}/g, idx);
  if (fmt.includes('{id}'))   return fmt.replace(/\{id\}/g, idx);
  if (/\d/.test(fmt)) {
    return fmt.replace(/(\d+)(?=[^0-9]*$)/, m => String(idx).padStart(m.length, '0'));
  }
  return `${fmt} #${idx}`;
}

const BLOCKCHAINS = [
  { value: 'ethereum', label: 'Ethereum (+ Base, Polygon & other EVM chains)' },
  { value: 'solana',   label: 'Solana' },
  { value: 'base',     label: 'Base' },
  { value: 'polygon',  label: 'Polygon' },
  { value: 'cardano',  label: 'Cardano' },
  { value: 'xrp',      label: 'XRP' },
];

// Recursively collect all files from a DataTransferEntry (folder or file)
function readEntry(entry) {
  return new Promise(resolve => {
    if (entry.isFile) {
      entry.file(f => {
        // Attach full path so we can determine layer folder later
        Object.defineProperty(f, 'webkitRelativePath', { value: entry.fullPath.replace(/^\//, ''), writable: false });
        resolve([f]);
      }, () => resolve([]));
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const allEntries = [];
      const readAll = () => {
        reader.readEntries(async batch => {
          if (!batch.length) {
            const nested = await Promise.all(allEntries.map(readEntry));
            resolve(nested.flat());
          } else {
            allEntries.push(...batch);
            readAll(); // readEntries may return < 100 items; keep reading
          }
        }, () => resolve([]));
      };
      readAll();
    } else {
      resolve([]);
    }
  });
}

export default function CollectionSetup({ collection, onChange, onNext, onReset, onLayersChange, syncing = false, syncError = '', sessionRestored = false, collectionId = undefined, onDismissRestore = undefined }) {
  const [dragOver,      setDragOver]      = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [uploadDone,    setUploadDone]    = useState(false);
  const [uploadMsg,     setUploadMsg]     = useState('');
  const [activeFolder,  setActiveFolder]  = useState('');
  const [errors,        setErrors]        = useState({});
  const [serverInfo,    setServerInfo]    = useState(null);
  const [pathInput,     setPathInput]     = useState('');
  const [pathSaving,    setPathSaving]    = useState(false);
  const [pathMsg,       setPathMsg]       = useState('');
  const folderRef = useRef(null);
  const { storeFiles } = useLayerFiles();

  function refreshServerInfo() {
    fetch('/api/nft-gen/layers/server-info')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setServerInfo(d?.folderCount > 0 ? d : null);
        if (d?.layersDir) setPathInput(d.layersDir);
      })
      .catch(() => {});
  }

  useEffect(() => { refreshServerInfo(); }, []);

  async function handleSetFolder() {
    if (!pathInput.trim()) return;
    setPathSaving(true);
    setPathMsg('');
    try {
      const r = await fetch('/api/nft-gen/layers/set-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathInput.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setPathMsg(d.error ?? 'Failed to set path'); return; }
      setPathMsg(`Saved — ${d.folderCount} layer folder${d.folderCount === 1 ? '' : 's'} found`);
      refreshServerInfo();
    } catch {
      setPathMsg('Error saving path');
    } finally {
      setPathSaving(false);
    }
  }

  const set = (k, v) => {
    onChange({ ...collection, [k]: v });
    // Clear the error for this field as the user edits it
    if (errors[k]) setErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  function validate() {
    const e = {};
    if (!collection.name?.trim())   e.name   = 'Collection Name is required.';
    if (!collection.symbol?.trim()) e.symbol  = 'Token Symbol is required.';
    const s = Number(collection.supply);
    if (!collection.supply || isNaN(s) || s < 1) e.supply = 'Collection Size must be at least 1.';
    return e;
  }

  function handleSubmit() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setErrors({});
    onNext?.();
  }

  async function handleFolderUpload(files, replace = false) {
    if (!files.length) return;
    setUploading(true);
    setUploadMsg('Reading files…');

    // ── 1. Parse layers client-side — instant ────────────────────────────────
    const { layers: parsedLayers, fileMap } = parseLayersFromFiles(files);
    storeFiles(fileMap);
    onLayersChange?.(parsedLayers);

    // Show success immediately — no need to wait for server
    setUploading(false);
    setUploadDone(true);
    setUploadMsg(`${parsedLayers.length} layers imported!`);

    // ── 2. Fire server uploads in background (local dev persistence only) ────
    // These are intentionally NOT awaited — the UI is already updated above.
    const doServerUpload = async () => {
      let detectedRoot = null;
      for (const file of files) {
        const parts = (file.webkitRelativePath || file.name).split('/').filter(Boolean);
        const layerIdx = parts.findIndex(p => /^\d+[-_]/.test(p));
        if (layerIdx > 0) { detectedRoot = parts[0]; break; }
      }
      if (detectedRoot) {
        const safe = detectedRoot.replace(/[^a-zA-Z0-9\-_]/g, '');
        if (safe) {
          setActiveFolder(safe);
          await fetch('/api/layers/root', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folder: safe }),
          }).catch(() => {});
        }
      }
      const groups = {};
      for (const file of files) {
        if (!file.type.startsWith('image/') && !file.name.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) continue;
        const parts = (file.webkitRelativePath || file.name).split('/').filter(Boolean);
        const layerIdx = parts.findIndex(p => /^\d+[-_]/.test(p));
        if (layerIdx === -1) continue;
        const layerName = parts[layerIdx];
        const subpath = parts.slice(layerIdx + 1).join('/');
        if (!groups[layerName]) groups[layerName] = [];
        groups[layerName].push({ file, subpath });
      }
      if (Object.keys(groups).length > 0) {
        // Clear bearth-layers bucket before uploading new collection layers
        await fetch('/api/nft-gen/layers/clear-bucket', { method: 'POST' }).catch(() => {});
      }
      for (const [layer, entries] of Object.entries(groups)) {
        const form = new FormData();
        form.append('layer', layer);
        for (const { file, subpath } of entries) {
          form.append('files', file);
          form.append('subpaths', subpath);
        }
        fetch('/api/upload', { method: 'POST', body: form }).catch(() => {});
      }
    };
    doServerUpload(); // fire and forget — no await
  }

  async function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const items = [...e.dataTransfer.items];
    const entries = items.map(i => i.webkitGetAsEntry?.()).filter(Boolean);
    // Dropping a folder = replace; dropping individual files = merge
    const hasFolder = entries.some(en => en.isDirectory);
    if (entries.length) {
      const nested = await Promise.all(entries.map(readEntry));
      await handleFolderUpload(nested.flat(), hasFolder);
    } else {
      await handleFolderUpload([...e.dataTransfer.files], false);
    }
  }

  return (
    <div className="setup-page">

      {/* Session restore banner — informational only; destructive reset is in the footer */}
      {sessionRestored && collectionId && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '9px 14px', marginBottom: 16,
          background: 'rgba(65,175,235,0.07)', border: '1px solid rgba(65,175,235,0.22)',
          borderRadius: 8, fontSize: 12.5, color: '#2e9fd8',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>
              <strong>Previous session resumed.</strong> Your collection and layers are loaded — switch to the <strong>Organize</strong> tab to continue.
              To start over, use <strong>Start a new collection</strong> below.
            </span>
          </div>
          <button
            onClick={() => onDismissRestore?.()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9bafc5', padding: '0 2px', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
            title="Dismiss"
            aria-label="Dismiss session restore notice"
          >×</button>
        </div>
      )}

      <div className="setup-two-col">

        {/* ── Left: form ── */}
        <div className="setup-left">
          <div className="setup-section-head">Collection Settings</div>

          <div className="setup-field">
            <label>Collection Name <span style={{color:'#ef4444'}}>*</span></label>
            <input
              placeholder="No Name"
              value={collection.name}
              onChange={e => set('name', e.target.value)}
              style={errors.name ? { borderColor: '#ef4444' } : undefined}
            />
            {errors.name && <span className="field-error">{errors.name}</span>}
          </div>

          <div className="setup-field">
            <label>Token Symbol <span style={{color:'#ef4444'}}>*</span></label>
            <input
              placeholder="BRT"
              maxLength={10}
              value={collection.symbol}
              onChange={e => set('symbol', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
              style={errors.symbol ? { borderColor: '#ef4444' } : undefined}
            />
            <span className="field-hint">Short uppercase identifier (e.g. BAYC, AZUKI). Max 10 characters.</span>
            {errors.symbol && <span className="field-error">{errors.symbol}</span>}
          </div>

          <div className="setup-field">
            <label>Collection Description</label>
            <input
              placeholder="The description will appear in the NFT metadata"
              value={collection.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>

          <div className="setup-row2">
            <div className="setup-field">
              <label>Collection Size <span style={{color:'#ef4444'}}>*</span></label>
              <input
                type="number" min="1" max="100000"
                value={collection.supply}
                onChange={e => set('supply', Math.max(1, +e.target.value))}
                style={errors.supply ? { borderColor: '#ef4444' } : undefined}
              />
              {errors.supply && <span className="field-error">{errors.supply}</span>}
            </div>
            <div className="setup-field">
              <label>Name of each NFT</label>
              <input
                value={collection.nameFormat}
                onChange={e => set('nameFormat', e.target.value)}
              />
              <span className="field-hint">
                Preview: {[1, 2, 3].map(i => applyNameFormat(collection.nameFormat, i)).join(', ')}, ...
              </span>
            </div>
          </div>

          <div className="setup-field">
            <label>Blockchain</label>
            <select value={collection.blockchain} onChange={e => set('blockchain', e.target.value)}>
              {BLOCKCHAINS.map(b => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>

          <div className="setup-field">
            <label>Export Format</label>
            <div className="setup-format-row">
              {[{v:'png',l:'PNG'},{v:'webp',l:'Webp'}].map(f => (
                <button
                  key={f.v}
                  className={`fmt-sel-btn${collection.format === f.v ? ' fmt-sel-active' : ''}`}
                  onClick={() => set('format', f.v)}
                >{f.l}</button>
              ))}
            </div>
          </div>

          <div className="setup-field">
            <label>Dimensions</label>
            <div className="setup-hint">Optional. Dimensions of your assets (px). Calculated automatically from imported assets.</div>
            <div className="setup-dim-row">
              <input
                type="number"
                min="1"
                placeholder="Width"
                value={collection.width ?? ''}
                onChange={e => set('width', e.target.value ? Math.max(1, +e.target.value) : undefined)}
              />
              <span className="setup-dim-x">×</span>
              <input
                type="number"
                min="1"
                placeholder="Height"
                value={collection.height ?? ''}
                onChange={e => set('height', e.target.value ? Math.max(1, +e.target.value) : undefined)}
              />
            </div>
          </div>

          {/* Artwork Optional */}
          <div className="setup-artwork">
            <div className="setup-artwork-title">Import Artwork Layers</div>
            <div className="setup-artwork-hint">
              Drag and Drop your assets folder into the box below. We will automatically detect your folder name and import all layers.
            </div>
            {/* Layers folder path — editable, saved to BearthApi config */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  value={pathInput}
                  onChange={e => { setPathInput(e.target.value); setPathMsg(''); }}
                  placeholder="e.g. D:\MyProject\exported_layers"
                  style={{ flex: 1, fontSize: 12, padding: '5px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--fg)', fontFamily: 'monospace' }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSetFolder(); }}
                />
                <button
                  onClick={handleSetFolder}
                  disabled={pathSaving || !pathInput.trim()}
                  style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', color: 'var(--fg)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {pathSaving ? 'Setting…' : 'Set Path'}
                </button>
              </div>
              {pathMsg && (
                <div style={{ marginTop: 4, fontSize: 11, color: pathMsg.startsWith('Saved') ? '#22c55e' : '#ef4444' }}>{pathMsg}</div>
              )}
            </div>

            {/* Server layers detected banner */}
            {serverInfo && !uploadDone && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10,
                padding: '8px 12px', background: 'rgba(34,197,94,0.07)',
                border: '1px solid rgba(34,197,94,0.25)', borderRadius: 8, fontSize: 12,
              }}>
                <span style={{ color: '#22c55e', fontSize: 15, flexShrink: 0 }}>✓</span>
                <span>
                  <strong style={{ color: '#22c55e' }}>{serverInfo.folderCount} layer {serverInfo.folderCount === 1 ? 'folder' : 'folders'} detected</strong>
                  <span style={{ color: 'var(--dim)', marginLeft: 5 }}>— drag-drop below to replace, or click <strong>Save &amp; Continue</strong> to use them directly.</span>
                </span>
              </div>
            )}

            <div
              className={`setup-drop-zone${dragOver ? ' drag-over' : ''}${uploadDone ? ' done' : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => folderRef.current?.click()}
            >
              {uploading ? (
                <>
                  <div className="setup-drop-icon"><div className="spinner" /></div>
                  <div className="setup-drop-label">{uploadMsg || 'Uploading…'}</div>
                </>
              ) : uploadDone ? (
                <>
                  <div className="setup-drop-icon">✅</div>
                  <div className="setup-drop-label">{uploadMsg || 'Assets imported!'}</div>
                  <div className="setup-drop-sub">Click to add more</div>
                </>
              ) : serverInfo ? (
                <>
                  <div className="setup-drop-icon">☁</div>
                  <div className="setup-drop-label">Drop to replace server layers</div>
                  <div className="setup-drop-sub">Optional — server layers will be used automatically if you skip this</div>
                </>
              ) : (
                <>
                  <div className="setup-drop-icon">☁</div>
                  <div className="setup-drop-label">Drop your assets folder ↓</div>
                  <div className="setup-drop-sub">Drag the entire exported_layers folder — we'll import everything</div>
                </>
              )}
            </div>
            <input
              ref={folderRef}
              type="file"
              {...{ webkitdirectory: 'true' }}
              multiple
              style={{ display: 'none' }}
              onChange={e => e.target.files?.length && handleFolderUpload([...e.target.files], true)}
            />
          </div>

          {syncError && <div style={{color:'#ef4444',fontSize:13,marginBottom:8}}>⚠ {syncError}</div>}

          <button
            className="btn btn-primary btn-lg setup-continue-btn"
            onClick={handleSubmit}
            disabled={syncing}
          >
            {syncing ? (
              <><span className="spinner" style={{width:14,height:14,marginRight:6}} />Saving to database…</>
            ) : 'Save & Continue'}
          </button>
          <div className="setup-footer-links">
            <button className="link-btn" onClick={onReset}>Start a new collection</button>
          </div>
        </div>

        {/* ── Right: info panel ── */}
        <div className="setup-right">
          <div className="setup-info-title">Collection Settings</div>
          <div className="setup-info-sub">
            The most powerful no-code NFT tool trusted by the world's largest NFT creators.
          </div>

          <div className="setup-info-steps">
            <div className="setup-info-step">
              <div className="setup-info-num">1</div>
              <div className="setup-info-body">
                <div className="setup-info-step-title">Setup your NFT Collection</div>
                <div className="setup-info-step-desc">
                  Select the desired Blockchain, give your collection a name, a description, and set up the size of the final art pieces. Once you are ready, click "Save & Continue" button to proceed to the next step.
                </div>
              </div>
            </div>
            <div className="setup-info-step">
              <div className="setup-info-num">2</div>
              <div className="setup-info-body">
                <div className="setup-info-step-title">Import your art into the tool</div>
                <div className="setup-info-step-desc">
                  You can import a single image or a folder of images. The tool will automatically generate the corresponding metadata for each image.
                </div>
              </div>
            </div>
            <div className="setup-info-step">
              <div className="setup-info-num">3</div>
              <div className="setup-info-body">
                <div className="setup-info-step-title">Preview and Generate your collection</div>
                <div className="setup-info-step-desc">
                  Once the metadata is generated, download the metadata file. You can also upload the metadata file to IPFS to generate the NFTs.
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
