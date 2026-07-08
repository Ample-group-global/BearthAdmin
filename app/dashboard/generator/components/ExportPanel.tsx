// @ts-nocheck
'use client';
import { useState } from 'react';

function NftCard({ jobId, item }) {
  const [open, setOpen] = useState(false);
  const tierColor = item.rank <= 50 ? '#f59e0b'
    : item.rank <= 200 ? '#a78bfa'
    : item.rank <= 500 ? '#60a5fa'
    : '#94a3b8';

  return (
    <div className={`exp-nft-card${open ? ' exp-nft-open' : ''}`} onClick={() => setOpen(!open)}>
      <div className="exp-nft-thumb">
        <img
          src={`/api/nft/${jobId}/${item.index}`}
          alt={item.name}
          loading="lazy"
          onError={e => { e.currentTarget.parentElement.innerHTML = '<span class="no-img">🖼</span>'; }}
        />
        <div className="exp-nft-rank" style={{ color: tierColor }}>#{item.rank}</div>
      </div>
      <div className="exp-nft-info">
        <div className="exp-nft-name">{item.name}</div>
        <div className="exp-nft-score" style={{ color: tierColor }}>Score: {item.rarityScore}</div>
      </div>
      {open && (
        <div className="exp-nft-traits">
          {(item.attributes ?? []).map((a, i) => (
            <div key={i} className="exp-trait-tag">
              <span className="exp-trait-type">{a.trait_type}</span>
              <span className="exp-trait-val">{a.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExportPanel({ weights, collection, conflicts, collectionId = null }) {
  const [phase,   setPhase]   = useState('idle');
  const [jobId,   setJobId]   = useState(null);
  const [cid,     setCid]     = useState('');
  const [metaOnly,setMetaOnly]= useState(false);
  const [progress,setProgress]= useState({ done: 0, total: 0 });
  const [error,   setError]   = useState('');
  const [items,   setItems]   = useState([]);
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [total,   setTotal]   = useState(0);
  const [sortBy,  setSortBy]  = useState('rarity'); // 'rarity' | 'id'
  const [dlLoading, setDlLoading] = useState(false);

  const supply = collection?.supply ?? 100;

  async function generate() {
    setPhase('generating'); setError(''); setProgress({ done: 0, total: supply });

    // Register job in DB if we have a collection
    let dbJobId = null;
    if (collectionId) {
      try {
        const jr = await fetch(`/api/nft-gen/collections/${collectionId}/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ editionSize: supply }),
        });
        const jdata = await jr.json();
        dbJobId = jdata?.job?.id ?? jdata?.id ?? null;
        if (dbJobId) {
          await fetch(`/api/nft-gen/jobs/${dbJobId}/start`, { method: 'POST' });
        }
      } catch { /* non-fatal — local generation continues regardless */ }
    }

    try {
      const r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total:     supply,
          config:    weights ?? {},
          conflicts: conflicts ?? [],
          collection: {
            name:        collection?.name        ?? 'NFT',
            description: collection?.description ?? '',
            format:      collection?.format      ?? 'png',
            nameFormat:  collection?.nameFormat  ?? '',
          },
        }),
      });
      const { job_id } = await r.json();
      setJobId(job_id);

      await new Promise((resolve, reject) => {
        const es = new EventSource(`/api/progress/${job_id}`);
        es.onmessage = e => {
          const d = JSON.parse(e.data);
          setProgress({ done: d.done ?? 0, total: d.total ?? supply });
          if (d.status === 'done')  { es.close(); resolve(job_id); }
          if (d.status === 'error') { es.close(); reject(new Error(d.error || 'Generation failed')); }
        };
        es.onerror = () => { es.close(); reject(new Error('Connection lost')); };
      });

      setPhase('done');
      // Mark DB job complete
      if (dbJobId) {
        fetch(`/api/nft-gen/jobs/${dbJobId}/complete`, { method: 'POST' }).catch(() => {});
      }
      loadRarity(job_id, 1, 'rarity');
    } catch(e) {
      // Mark DB job failed
      if (dbJobId) {
        fetch(`/api/nft-gen/jobs/${dbJobId}/fail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ errorMessage: e.message }),
        }).catch(() => {});
      }
      setError(e.message);
      setPhase('idle');
    }
  }

  async function loadRarity(jid, p, sort) {
    const r = await fetch(`/api/rarity/${jid}?page=${p}&limit=24`);
    const d = await r.json();
    let items = d.items ?? [];
    if (sort === 'id') items = [...items].sort((a, b) => a.index - b.index);
    setItems(items);
    setPage(p);
    setPages(d.pages ?? 1);
    setTotal(d.total ?? 0);
  }

  function changeSort(s) {
    setSortBy(s);
    if (jobId) loadRarity(jobId, 1, s);
  }

  async function downloadZip() {
    if (!jobId) return;
    setDlLoading(true);
    try {
      const r = await fetch(`/api/download/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cid: cid || 'PLACEHOLDER_CID',
          format: collection?.format ?? 'png',
          collectionName: collection?.name ?? 'collection',
          metaOnly,
        }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Download failed'); }
      const blob = await r.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `${(collection?.name || 'collection').replace(/\s+/g,'_').toLowerCase()}_nfts.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch(e) { setError(e.message); }
    setDlLoading(false);
  }

  const pct = progress.total > 0 ? Math.min((progress.done / progress.total) * 100, 100) : 0;

  return (
    <div className="export-page">
      <div className={`export-card${phase === 'done' ? ' export-card-wide' : ''}`}>
        <div className="export-title">Export Collection</div>
        <div className="export-sub">
          {phase === 'done'
            ? `${total.toLocaleString()} NFTs generated — browse rarity rankings or download ZIP`
            : `Generate all ${supply.toLocaleString()} NFTs and download as ZIP`}
        </div>

        {phase === 'idle' && (
          <>
            <div className="export-section">
              <div className="export-section-title">Collection Summary</div>
              <div className="export-info-grid">
                <div className="export-info-item"><span className="export-info-label">Name</span><span className="export-info-val">{collection?.name || '—'}</span></div>
                <div className="export-info-item"><span className="export-info-label">Symbol</span><span className="export-info-val">{collection?.symbol || '—'}</span></div>
                <div className="export-info-item"><span className="export-info-label">Blockchain</span><span className="export-info-val" style={{textTransform:'capitalize'}}>{collection?.blockchain || '—'}</span></div>
                <div className="export-info-item"><span className="export-info-label">Supply</span><span className="export-info-val">{supply.toLocaleString()}</span></div>
              </div>
            </div>

            <div className="export-section">
              <div className="export-section-title">IPFS CID</div>
              <div className="export-field">
                <input placeholder="ipfs://Qm... or leave blank for placeholder" value={cid} onChange={e => setCid(e.target.value)} />
                <span className="field-hint">Image URLs in metadata will update to ipfs://YOUR_CID/1.png</span>
              </div>
            </div>

            <div className="export-section">
              <div className="export-section-title">Options</div>
              <label className="export-check">
                <input type="checkbox" checked={metaOnly} onChange={e => setMetaOnly(e.target.checked)} />
                <span>Export metadata JSON only (no images)</span>
              </label>
            </div>

            {error && <div className="export-error">❌ {error}</div>}

            <div className="export-actions">
              <button className="btn btn-primary btn-lg" onClick={generate}>
                ⚡ Generate {supply.toLocaleString()} NFTs
              </button>
            </div>
          </>
        )}

        {phase === 'generating' && (
          <div className="export-gen-progress">
            <div className="prog-bg" style={{marginBottom:10}}>
              <div className="prog-fill" style={{ width: `${pct.toFixed(1)}%` }} />
            </div>
            <div className="prog-text">{progress.done.toLocaleString()} / {progress.total.toLocaleString()} NFTs</div>
            <div style={{fontSize:12,color:'var(--xdim)',marginTop:4}}>{pct.toFixed(1)}% complete</div>
          </div>
        )}

        {phase === 'done' && (
          <>
            <div className="exp-done-bar">
              <div className="exp-sort-row">
                <span style={{fontSize:12,color:'var(--dim)'}}>Sort by:</span>
                <button className={`exp-sort-btn${sortBy==='rarity'?' exp-sort-active':''}`} onClick={() => changeSort('rarity')}>🏆 Rarity</button>
                <button className={`exp-sort-btn${sortBy==='id'?' exp-sort-active':''}`} onClick={() => changeSort('id')}># ID</button>
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <label className="export-check" style={{margin:0}}>
                  <input type="checkbox" checked={metaOnly} onChange={e => setMetaOnly(e.target.checked)} />
                  <span style={{fontSize:12}}>Metadata only</span>
                </label>
                <input
                  style={{background:'var(--bg0)',border:'1px solid var(--border)',color:'var(--text)',padding:'5px 10px',borderRadius:7,fontSize:12,width:200}}
                  placeholder="IPFS CID (optional)"
                  value={cid}
                  onChange={e => setCid(e.target.value)}
                />
                <button className="btn btn-ghost" onClick={downloadZip} disabled={dlLoading}>
                  {dlLoading ? 'Preparing…' : '⬇ Download ZIP'}
                </button>
                <button className="btn btn-ghost" onClick={() => { setPhase('idle'); setItems([]); setJobId(null); }}>
                  ↺ Regenerate
                </button>
              </div>
            </div>

            {error && <div className="export-error">❌ {error}</div>}

            <div className="exp-nft-grid">
              {items.map(item => (
                <NftCard key={item.index} jobId={jobId} item={item} />
              ))}
            </div>

            {pages > 1 && (
              <div className="preview-pagination">
                <button className="btn btn-ghost" disabled={page <= 1} onClick={() => loadRarity(jobId, page-1, sortBy)}>← Prev</button>
                <span className="page-info">Page {page} / {pages}</span>
                <button className="btn btn-ghost" disabled={page >= pages} onClick={() => loadRarity(jobId, page+1, sortBy)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
