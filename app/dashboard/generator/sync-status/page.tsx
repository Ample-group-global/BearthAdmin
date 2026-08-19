// @ts-nocheck
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────
interface CollectionRow {
  srNo:           number;
  collectionId:   string;
  collectionName: string;
  supply:         number;
  createdAt:      string;
  jobId:          string | null;
  jobStatus:      string | null;
  filebaseCount:  number;
  filebaseTotal:  number;
  recordsCount:   number;
  filebaseSynced: boolean;
  recordsSynced:  boolean;
}

interface RowState {
  filebase: 'idle' | 'running' | 'done' | 'error';
  records:  'idle' | 'running' | 'done' | 'error';
  message:  string;
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SyncStatusPage() {
  const [collections,    setCollections]    = useState<CollectionRow[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [pageError,      setPageError]      = useState('');
  const [rowStates,      setRowStates]      = useState<Record<string, RowState>>({});
  const [exportModal,    setExportModal]    = useState<{ collectionId: string; jobId: string; name: string } | null>(null);
  const [recordsModal,   setRecordsModal]   = useState<{ collectionId: string; jobId: string; name: string; count: number } | null>(null);
  const [exportBucket,   setExportBucket]   = useState('');
  const [newBucket,      setNewBucket]      = useState('');
  const [bucketList,     setBucketList]     = useState<string[]>([]);
  const [bucketsLoading, setBucketsLoading] = useState(false);
  const pollRefs = useRef<Record<string, any>>({});

  // ── Fetch collection sync status ──────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setPageError('');
    try {
      const r = await fetch('/api/nft-gen/collections/sync-status');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setCollections(data.collections ?? []);
    } catch (e: any) {
      setPageError(e.message ?? 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // Load bucket list when modal opens
  useEffect(() => {
    if (!exportModal) return;
    setBucketsLoading(true);
    fetch('/api/filebase/buckets')
      .then(r => r.ok ? r.json() : { buckets: [] })
      .then(data => {
        const names: string[] = (data.buckets ?? []).map((b: any) => b.name).filter(Boolean);
        setBucketList(names);
        setExportBucket(prev => prev || names[0] || '');
      })
      .catch(() => {})
      .finally(() => setBucketsLoading(false));
  }, [exportModal]);

  // Cleanup all polling intervals on unmount
  useEffect(() => () => { Object.values(pollRefs.current).forEach(clearInterval); }, []);

  // ── Row state helpers ─────────────────────────────────────────────────────
  function patchRow(id: string, patch: Partial<RowState>) {
    setRowStates(prev => ({
      ...prev,
      [id]: { filebase: 'idle', records: 'idle', message: '', ...prev[id], ...patch },
    }));
  }

  // ── Filebase export ───────────────────────────────────────────────────────
  async function startFilebaseExport() {
    if (!exportModal) return;
    const { collectionId, jobId } = exportModal;
    const bucket = exportBucket === '__new__' ? newBucket.trim() : exportBucket;
    if (!bucket) return;
    setExportModal(null);
    patchRow(collectionId, { filebase: 'running', message: 'Starting export…' });

    try {
      const r = await fetch('/api/nft-gen/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ collectionId, jobId, bucket, syncToRecords: false }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${r.status}`);
      }
      const { exportId } = await r.json();
      const key = `${collectionId}:fb`;
      pollRefs.current[key] = setInterval(async () => {
        try {
          const pr = await fetch(`/api/nft-gen/export/${exportId}`);
          if (!pr.ok) return;
          const state = await pr.json();
          patchRow(collectionId, { message: state.phase ?? '' });
          if (state.status === 'done' || state.status === 'error') {
            clearInterval(pollRefs.current[key]);
            delete pollRefs.current[key];
            patchRow(collectionId, {
              filebase: state.status === 'done' ? 'done' : 'error',
              message:  state.status === 'done' ? `${state.total ?? 0} NFTs uploaded` : (state.error ?? 'Export failed'),
            });
            if (state.status === 'done') fetchStatus();
          }
        } catch { /* retry next tick */ }
      }, 2000);
    } catch (e: any) {
      patchRow(collectionId, { filebase: 'error', message: e.message ?? 'Export failed' });
    }
  }

  // ── Records sync ──────────────────────────────────────────────────────────
  async function startRecordsSync() {
    if (!recordsModal) return;
    const { collectionId, jobId } = recordsModal;
    setRecordsModal(null);
    patchRow(collectionId, { records: 'running', message: 'Syncing to NFT Records…' });
    try {
      const r = await fetch('/api/nft-gen/export/sync-records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error ?? `HTTP ${r.status}`);
      }
      const { synced } = await r.json();
      patchRow(collectionId, { records: 'done', message: `${synced.toLocaleString()} records synced` });
      fetchStatus();
    } catch (e: any) {
      patchRow(collectionId, { records: 'error', message: e.message ?? 'Sync failed' });
    }
  }

  // ── Derived summary ───────────────────────────────────────────────────────
  const totalFbSynced  = collections.filter(c => c.filebaseSynced).length;
  const totalRecSynced = collections.filter(c => c.recordsSynced).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <Link href="/dashboard/generator" style={styles.backLink}>
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
            </svg>
            NFT Studio
          </Link>
          <span style={{ color: 'var(--border)', margin: '0 4px' }}>›</span>
          <h1 style={styles.pageTitle}>Collection Sync Status</h1>
        </div>
        <button onClick={fetchStatus} disabled={loading} style={styles.refreshBtn}>
          <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
          </svg>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      {!loading && !pageError && collections.length > 0 && (
        <div style={styles.summaryGrid}>
          <StatCard label="Total Collections" value={String(collections.length)} accent="var(--text)" />
          <StatCard label="Filebase Synced"   value={`${totalFbSynced} / ${collections.length}`}  accent="#22c55e" />
          <StatCard label="Records Synced"    value={`${totalRecSynced} / ${collections.length}`} accent="#3b82f6" />
          <StatCard
            label="Total NFTs"
            value={collections.reduce((s, c) => s + c.supply, 0).toLocaleString()}
            accent="var(--text-muted)"
          />
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {pageError && (
        <div style={styles.errorBanner}>{pageError}</div>
      )}

      {/* ── Loading ────────────────────────────────────────────────────────── */}
      {loading && <div style={styles.loadingMsg}>Loading collection status…</div>}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      {!loading && !pageError && (
        <div style={styles.tableCard}>
          {collections.length === 0 ? (
            <div style={styles.emptyMsg}>
              No collections found. Create one in{' '}
              <Link href="/dashboard/generator" style={{ color: '#60a5fa' }}>NFT Studio</Link> first.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.thead}>
                    <Th width={52}>#</Th>
                    <Th>Collection</Th>
                    <Th width={100}>Supply</Th>
                    <Th width={260}>Filebase Sync</Th>
                    <Th width={260}>NFT Records</Th>
                    <Th width={180}>Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map((col, ri) => {
                    const rs  = rowStates[col.collectionId] ?? { filebase: 'idle', records: 'idle', message: '' };
                    const hasJob        = !!col.jobId;
                    const fbRunning     = rs.filebase === 'running';
                    const recRunning    = rs.records  === 'running';
                    const canFb         = hasJob && !col.filebaseSynced && rs.filebase === 'idle';
                    const canRec        = hasJob && col.filebaseSynced && !col.recordsSynced && rs.records === 'idle';
                    const allDone       = col.filebaseSynced && col.recordsSynced && rs.filebase === 'idle' && rs.records === 'idle';
                    const isLast        = ri === collections.length - 1;

                    return (
                      <tr key={col.collectionId} style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}>

                        {/* Sr. No */}
                        <Td center muted fw={600}>{col.srNo}</Td>

                        {/* Collection name + job info */}
                        <Td>
                          <div style={{ fontWeight: 700, fontSize: 15 }}>{col.collectionName}</div>
                          <div style={styles.subText}>
                            {hasJob
                              ? `Job ${col.jobId.slice(0, 8)}… · ${col.jobStatus}`
                              : 'No completed generation job'}
                          </div>
                          {col.createdAt && (
                            <div style={{ ...styles.subText, marginTop: 1 }}>
                              Created {new Date(col.createdAt).toLocaleDateString()}
                            </div>
                          )}
                        </Td>

                        {/* Supply */}
                        <Td fw={700} fontSize={16}>{col.supply.toLocaleString()}</Td>

                        {/* Filebase sync */}
                        <Td>
                          {fbRunning ? (
                            <RunningCell msg={rs.message || 'Exporting to Filebase…'} color="#60a5fa" />
                          ) : rs.filebase === 'error' ? (
                            <ErrorCell msg={rs.message} />
                          ) : rs.filebase === 'done' ? (
                            <DoneCell msg={rs.message} />
                          ) : (
                            <SyncBadge synced={col.filebaseSynced} count={col.filebaseCount} total={col.supply} />
                          )}
                        </Td>

                        {/* NFT Records */}
                        <Td>
                          {!hasJob ? (
                            <div style={styles.dimText}>Generate first</div>
                          ) : !col.filebaseSynced && rs.filebase === 'idle' ? (
                            <div style={styles.dimText}>Filebase sync required</div>
                          ) : recRunning ? (
                            <RunningCell msg={rs.message || 'Syncing records…'} color="#a78bfa" />
                          ) : rs.records === 'error' ? (
                            <ErrorCell msg={rs.message} />
                          ) : rs.records === 'done' ? (
                            <DoneCell msg={rs.message} />
                          ) : (
                            <SyncBadge synced={col.recordsSynced} count={col.recordsCount} total={col.supply} />
                          )}
                        </Td>

                        {/* Actions */}
                        <Td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {canFb && (
                              <ActionBtn
                                label="Export → Filebase"
                                color="#3b82f6"
                                onClick={() => {
                                  setExportBucket('');
                                  setNewBucket('');
                                  setExportModal({ collectionId: col.collectionId, jobId: col.jobId, name: col.collectionName });
                                }}
                              />
                            )}
                            {canRec && (
                              <ActionBtn
                                label="Sync → Records"
                                color="#8b5cf6"
                                onClick={() => setRecordsModal({ collectionId: col.collectionId, jobId: col.jobId, name: col.collectionName, count: col.filebaseCount })}
                              />
                            )}
                            {(fbRunning || recRunning) && (
                              <span style={{ color: '#60a5fa', fontSize: 12 }}>Working…</span>
                            )}
                            {allDone && (
                              <span style={{ color: '#22c55e', fontSize: 12, fontWeight: 700 }}>✓ All synced</span>
                            )}
                            {!hasJob && (
                              <Link href="/dashboard/generator" style={{ fontSize: 12, color: '#60a5fa', textDecoration: 'none' }}>
                                Go to Studio →
                              </Link>
                            )}
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Filebase Export Modal ──────────────────────────────────────────── */}
      {exportModal && (
        <Overlay onClose={() => setExportModal(null)}>
          <ModalTitle>Export to Filebase</ModalTitle>
          <p style={styles.modalSub}>
            Select a bucket to export <strong>{exportModal.name}</strong> NFTs and metadata to Filebase IPFS.
            <br />nft_records will <em>not</em> be modified — use "Sync → Records" after confirming the export is correct.
          </p>
          <label style={styles.label}>Filebase Bucket</label>
          {bucketsLoading ? (
            <div style={styles.dimText}>Loading buckets…</div>
          ) : (
            <>
              <select
                value={exportBucket}
                onChange={e => { setExportBucket(e.target.value); if (e.target.value !== '__new__') setNewBucket(''); }}
                style={styles.select}
              >
                {bucketList.length === 0 && <option value="">— no buckets found —</option>}
                {bucketList.map(b => <option key={b} value={b}>{b}</option>)}
                <option value="__new__">+ Create new bucket…</option>
              </select>
              {exportBucket === '__new__' && (
                <input
                  style={{ ...styles.select, marginTop: 8 }}
                  placeholder="New bucket name"
                  value={newBucket}
                  onChange={e => setNewBucket(e.target.value)}
                  autoFocus
                />
              )}
            </>
          )}
          <div style={styles.modalFooter}>
            <button onClick={() => setExportModal(null)} style={styles.cancelBtn}>Cancel</button>
            <button
              onClick={startFilebaseExport}
              disabled={bucketsLoading || (exportBucket === '__new__' ? !newBucket.trim() : !exportBucket)}
              style={{ ...styles.confirmBtn('#3b82f6'), opacity: (bucketsLoading || (exportBucket === '__new__' ? !newBucket.trim() : !exportBucket)) ? 0.5 : 1 }}
            >
              Start Export
            </button>
          </div>
        </Overlay>
      )}

      {/* ── Records Sync Modal ─────────────────────────────────────────────── */}
      {recordsModal && (
        <Overlay onClose={() => setRecordsModal(null)}>
          <ModalTitle>Sync to NFT Records</ModalTitle>
          <p style={styles.modalSub}>
            Sync <strong>{recordsModal.count.toLocaleString()} NFTs</strong> from{' '}
            <strong>{recordsModal.name}</strong> into the <code style={{ background: 'var(--hover)', padding: '1px 5px', borderRadius: 4 }}>nft_records</code> table.
          </p>
          <div style={styles.warningBox}>
            Only run this when all NFT images and metadata are 100% confirmed correct. NFT Records data is never deleted — this is a permanent write.
          </div>
          <div style={styles.modalFooter}>
            <button onClick={() => setRecordsModal(null)} style={styles.cancelBtn}>Cancel</button>
            <button onClick={startRecordsSync} style={styles.confirmBtn('#8b5cf6')}>
              Confirm Sync
            </button>
          </div>
        </Overlay>
      )}

      <style>{`
        @keyframes shimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: any) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color: accent }}>{value}</div>
    </div>
  );
}

function SyncBadge({ synced, count, total }: any) {
  if (total === 0) {
    return <span style={styles.dimText}>No data</span>;
  }
  const pct = Math.round((count / total) * 100);
  if (synced) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#22c55e', fontSize: 18, lineHeight: 1 }}>✓</span>
        <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 14 }}>
          {count.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
    );
  }
  if (count > 0) {
    return (
      <div>
        <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: 14 }}>
          {count.toLocaleString()} / {total.toLocaleString()} ({pct}%)
        </span>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${pct}%`, background: '#f59e0b' }} />
        </div>
      </div>
    );
  }
  return (
    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
      0 / {total.toLocaleString()} — not synced
    </span>
  );
}

function RunningCell({ msg, color }: any) {
  return (
    <div>
      <span style={{ color, fontSize: 13 }}>{msg}</span>
      <div style={styles.progressTrack}>
        <div style={{
          position: 'relative', height: '100%', width: '30%',
          background: color, borderRadius: 2,
          animation: 'shimmer 1.4s ease-in-out infinite',
        }} />
      </div>
    </div>
  );
}

function DoneCell({ msg }: any) {
  return <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 600 }}>✓ {msg}</span>;
}

function ErrorCell({ msg }: any) {
  return <span style={{ color: '#ef4444', fontSize: 12 }}>{msg}</span>;
}

function ActionBtn({ label, color, onClick }: any) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 13px', fontSize: 12, fontWeight: 700, borderRadius: 7, cursor: 'pointer',
      background: `${color}1a`, border: `1px solid ${color}55`, color, whiteSpace: 'nowrap',
    }}>
      {label}
    </button>
  );
}

function Th({ children, width }: any) {
  return (
    <th style={{
      padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)',
      width: width ?? undefined, whiteSpace: 'nowrap',
    }}>
      {children}
    </th>
  );
}

function Td({ children, center, muted, fw, fontSize }: any) {
  return (
    <td style={{
      padding: '15px 16px', verticalAlign: 'middle',
      textAlign: center ? 'center' : 'left',
      color: muted ? 'var(--text-muted)' : undefined,
      fontWeight: fw ?? undefined,
      fontSize: fontSize ?? undefined,
    }}>
      {children}
    </td>
  );
}

function Overlay({ children, onClose }: any) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '28px 32px', maxWidth: 500, width: '92%' }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalTitle({ children }: any) {
  return <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700 }}>{children}</h3>;
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, any> = {
  page:       { padding: '24px 32px', maxWidth: 1280, margin: '0 auto', minHeight: '100vh' },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  pageTitle:  { margin: 0, fontSize: 22, fontWeight: 800 },
  backLink:   { display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)', textDecoration: 'none', fontSize: 14, fontWeight: 500 },
  refreshBtn: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px',
    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8,
    cursor: 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--text)',
  },
  summaryGrid:  { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 },
  statCard:     { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' },
  statLabel:    { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: 6 },
  statValue:    { fontSize: 24, fontWeight: 800 },
  errorBanner:  { padding: '14px 18px', background: '#1e1e1e', border: '1px solid #ef4444', borderRadius: 9, color: '#ef4444', marginBottom: 20, fontSize: 14 },
  loadingMsg:   { textAlign: 'center', padding: 64, color: 'var(--text-muted)', fontSize: 15 },
  tableCard:    { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' },
  table:        { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  thead:        { background: 'var(--hover)', borderBottom: '2px solid var(--border)' },
  emptyMsg:     { padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 15 },
  subText:      { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
  dimText:      { color: 'var(--text-muted)', fontSize: 13 },
  progressTrack: { marginTop: 5, height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden', width: 130 },
  progressFill:  { height: '100%', borderRadius: 2, transition: 'width 0.4s ease' },
  // Modal
  modalSub:   { margin: '0 0 18px', color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.5 },
  label:      { display: 'block', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, color: 'var(--text-muted)' },
  select:     { width: '100%', padding: '9px 12px', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' },
  warningBox: { padding: '12px 16px', background: 'rgba(139,92,246,0.09)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, fontSize: 13, color: '#c4b5fd', marginBottom: 20, lineHeight: 1.5 },
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22 },
  cancelBtn:  { padding: '9px 18px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text)', fontSize: 14 },
  confirmBtn: (color: string) => ({ padding: '9px 20px', background: color, border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', fontSize: 14, fontWeight: 700 }),
};
