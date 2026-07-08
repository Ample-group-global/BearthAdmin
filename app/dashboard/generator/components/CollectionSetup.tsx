// @ts-nocheck
'use client';
import { useState, useRef, useEffect } from 'react';
import { useLayerFiles } from '../LayerFilesContext';

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
        name: stem.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim() || stem,
        rel,
        defaultWeight: 1,
      }))
      .sort((a, b) => a.stem.localeCompare(b.stem));
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

export default function CollectionSetup({ collection, onChange, onNext, onReset, onLayersChange, syncing = false, syncError = '' }) {
  const [dragOver,      setDragOver]      = useState(false);
  const [uploading,     setUploading]     = useState(false);
  const [uploadDone,    setUploadDone]    = useState(false);
  const [uploadMsg,     setUploadMsg]     = useState('');
  const [activeFolder,  setActiveFolder]  = useState('BearthLayersv1');
  const folderRef = useRef(null);
  const { storeFiles } = useLayerFiles();

  useEffect(() => {
    fetch('/api/layers/root').then(r => r.json()).then(d => { if (d.folder) setActiveFolder(d.folder); }).catch(() => {});
  }, []);

  const set = (k, v) => onChange({ ...collection, [k]: v });

  async function handleFolderUpload(files, replace = false) {
    if (!files.length) return;
    setUploading(true);
    setUploadMsg('Reading files…');

    // ── 1. Parse layers client-side immediately ──────────────────────────────
    const { layers: parsedLayers, fileMap } = parseLayersFromFiles(files);
    storeFiles(fileMap);              // store blob URLs in context
    onLayersChange?.(parsedLayers);   // update UI right away (no server round-trip)

    // ── 2. Detect root folder name ────────────────────────────────────────────
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
        fetch('/api/layers/root', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ folder: safe }),
        }).catch(() => {});
      }
    }

    // ── 3. Upload to server in background (local dev only, silent on cloud) ──
    if (replace) {
      await fetch('/api/layers/clear', { method: 'POST' }).catch(() => {});
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
    const layerNames = Object.keys(groups);
    let done = 0;
    for (const [layer, entries] of Object.entries(groups)) {
      setUploadMsg(`Uploading ${layer} (${++done}/${layerNames.length})…`);
      const form = new FormData();
      form.append('layer', layer);
      for (const { file, subpath } of entries) {
        form.append('files', file);
        form.append('subpaths', subpath);
      }
      await fetch('/api/upload', { method: 'POST', body: form }).catch(() => {});
    }

    setUploading(false);
    setUploadDone(true);
    setUploadMsg(`${parsedLayers.length} layers imported!`);
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
      <div className="setup-two-col">

        {/* ── Left: form ── */}
        <div className="setup-left">
          <div className="setup-section-head">Collection Settings</div>

          <div className="setup-field">
            <label>Collection Name</label>
            <input
              placeholder="No Name"
              value={collection.name}
              onChange={e => set('name', e.target.value)}
            />
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
              <label>Collection Size</label>
              <input
                type="number" min="1" max="100000"
                value={collection.supply}
                onChange={e => set('supply', Math.max(1, +e.target.value))}
              />
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
              {[{v:'png',l:'PNG'},{v:'webp',l:'WebP'}].map(f => (
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
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, padding:'6px 10px', background:'var(--bg2)', borderRadius:7, border:'1px solid var(--border)', fontSize:12 }}>
              <span style={{ color:'var(--dim)' }}>Active layers folder:</span>
              <span style={{ color:'var(--accent)', fontWeight:600, fontFamily:'monospace' }}>{activeFolder}</span>
            </div>
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
            onClick={onNext}
            disabled={syncing}
          >
            {syncing ? (
              <><span className="spinner" style={{width:14,height:14,marginRight:6}} />Saving to database…</>
            ) : 'Save & Continue'}
          </button>
          <div className="setup-footer-links">
            <button className="link-btn" onClick={onReset}>Reset collection</button>
            <span className="link-sep">·</span>
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
