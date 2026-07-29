"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import DataTable, { type ColumnDef } from "@/components/DataTable";
import { ErrBanner } from "@/components/nft/Banner";
import { inputStyle, labelStyle } from "@/components/nft/styles";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NftRecord {
  id: string;
  serialNumber: string;
  tokenId: number | null;
  imageIpfsHash: string | null;
  metadataUri: string | null;
  blindBoxUri: string | null;
  isRevealed: boolean;
  revealedAt: string | null;
  stageName: string;
  stageId: string;
  typeName: string;
  nftTypeId: string;
  deliveryStatusCode: string;
  deliveryStatusName: string;
  deliveredAt: string | null;
  mintedAt: string | null;
  soldAt: string | null;
  ownerAddress: string | null;
  notes: string | null;
  traits: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
  totalCount: number;
  // wave info
  waveId: string | null;
  waveNumber: number | null;
  waveName: string | null;
  waveQuantity: number | null;
  waveScheduledStart: string | null;
  waveScheduledEnd: string | null;
  waveRevealScheduledAt: string | null;
  priceEth: number | null;
  effectivePriceEth: number | null;
}

interface Master {
  nftStages:        Array<{ id: string; name: string; code: string }>;
  nftTypes:         Array<{ id: string; name: string; code: string }>;
  deliveryStatuses: Array<{ id: string; name: string; code: string }>;
}

const PAGE_SIZE    = 20;
const IPFS_GATEWAY = "https://amgbearth.myfilebase.com/ipfs";

function fmt(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NftImage({ hash, isRevealed = false, blindBoxUri, size = 80 }: {
  hash?: string | null;
  isRevealed?: boolean;
  blindBoxUri?: string | null;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [bbFailed,  setBbFailed]  = useState(false);

  if (!isRevealed) {
    // Blind box — show blind_box_uri if available, else styled mystery placeholder
    if (blindBoxUri && !bbFailed) {
      return (
        <img src={blindBoxUri} alt="Blind Box" loading="lazy"
          style={{ width: size, height: size, objectFit: "cover", borderRadius: 10, display: "block", flexShrink: 0 }}
          onError={() => setBbFailed(true)} />
      );
    }
    return (
      <div style={{
        width: size, height: size, borderRadius: 10, flexShrink: 0, overflow: "hidden",
        background: "linear-gradient(135deg, #3b1d8a 0%, #7c3aed 50%, #4f46e5 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        border: "1.5px solid rgba(124,58,237,0.4)",
      }}>
        <svg style={{ width: size * 0.38, height: size * 0.38, color: "rgba(255,255,255,0.9)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        {size >= 60 && (
          <span style={{ fontSize: size * 0.14, color: "rgba(255,255,255,0.7)", fontWeight: 700, letterSpacing: "0.04em" }}>
            BLIND BOX
          </span>
        )}
      </div>
    );
  }

  // Revealed — show actual IPFS image
  const url = hash ? `${IPFS_GATEWAY}/${hash}` : null;
  if (url && !imgFailed) {
    return (
      <img src={url} alt="NFT" loading="lazy"
        style={{ width: size, height: size, objectFit: "cover", borderRadius: 10, display: "block", flexShrink: 0 }}
        onError={() => setImgFailed(true)} />
    );
  }
  return (
    <div style={{ width: size, height: size, background: "#f3f4f6", borderRadius: 10,
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "1.5px dashed #d1d5db", flexShrink: 0 }}>
      <svg style={{ width: size * 0.36, height: size * 0.36, color: "#d1d5db" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  );
}

function StatusBadge({ code, name }: { code: string; name: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    delivered: { bg: "rgba(22,163,74,0.1)",    color: "#16a34a" },
    sold:      { bg: "rgba(124,58,237,0.1)",   color: "#7c3aed" },
    pending:   { bg: "rgba(217,119,6,0.1)",    color: "#d97706" },
  };
  const c = colors[code] ?? { bg: "rgba(156,163,175,0.1)", color: "#6b7280" };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: c.bg, color: c.color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: c.color }} />
      {name}
    </span>
  );
}

function RevealBadge({ revealed }: { revealed: boolean }) {
  return revealed
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}>
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#7c3aed" }} />
        Revealed
      </span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: "rgba(217,119,6,0.1)", color: "#d97706" }}>
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#d97706" }} />
        Blind Box
      </span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NftPage() {
  const [records, setRecords]         = useState<NftRecord[]>([]);
  const [total, setTotal]             = useState(0);
  const [blindCount, setBlindCount]   = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [soldCount, setSoldCount]     = useState(0);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [offset, setOffset]           = useState(0);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter]   = useState("");
  const [stageFilter, setStageFilter]     = useState("");
  const [revealFilter, setRevealFilter]   = useState("");
  const [waveFilter, setWaveFilter]       = useState("");
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [master, setMaster]           = useState<Master | null>(null);
  const [sortKey, setSortKey]         = useState<string | undefined>(undefined);
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("asc");
  const [viewRecord, setViewRecord]   = useState<NftRecord | null>(null);
  const [waves, setWaves]             = useState<Array<{ wave_number: number; name: string }>>([]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadRecords = useCallback((
    q: string, off: number, status: string, stage: string, revealed: string, wave: string,
    sk?: string, sd?: "asc" | "desc",
  ) => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ search: q, limit: String(PAGE_SIZE), offset: String(off) });
    if (status)  params.set("delivery_status", status);
    if (stage)   params.set("stage", stage);
    if (revealed) params.set("revealed", revealed);
    if (wave)    params.set("wave_number", wave);
    if (sk)      params.set("sort_by", sk);
    if (sk && sd) params.set("sort_dir", sd);
    fetch(`/api/nft?${params}`, { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error("API error"); return r.json(); })
      .then(data => {
        setRecords(data.nftRecords ?? []);
        setTotal(data.total ?? 0);
        setBlindCount(data.blindCount ?? 0);
        setRevealedCount(data.revealedCount ?? 0);
        setSoldCount(data.soldCount ?? 0);
        setDeliveredCount(data.deliveredCount ?? 0);
        setLoading(false);
      })
      .catch(e => { setError(e.message ?? "Failed to load NFT records."); setLoading(false); });
  }, []);

  useEffect(() => {
    fetch("/api/master", { credentials: "include" })
      .then(r => r.json()).then(d => setMaster(d)).catch(() => {});
    fetch("/api/nft-sell/waves", { credentials: "include" })
      .then(r => r.json()).then(d => setWaves(d.waves ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadRecords(search, offset, statusFilter, stageFilter, revealFilter, waveFilter, sortKey, sortDir);
  }, [offset, statusFilter, stageFilter, revealFilter, waveFilter]);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setOffset(0);
      loadRecords(v, 0, statusFilter, stageFilter, revealFilter, waveFilter, sortKey, sortDir);
    }, 300);
  };

  const applyFilter = (status = statusFilter, stage = stageFilter, revealed = revealFilter, wave = waveFilter) => {
    setOffset(0);
    loadRecords(search, 0, status, stage, revealed, wave, sortKey, sortDir);
  };

  const handleSort = (key: string, dir: "asc" | "desc") => {
    setSortKey(key); setSortDir(dir); setOffset(0);
    loadRecords(search, 0, statusFilter, stageFilter, revealFilter, waveFilter, key, dir);
  };

  // ── Columns ────────────────────────────────────────────────────────────────
  const columns: ColumnDef<NftRecord>[] = [
    {
      key: "serial",
      header: "Serial / Token",
      sortKey: "serial_number",
      render: r => (
        <div>
          <div className="font-mono font-bold text-sm" style={{ color: "#24315f" }}>{r.serialNumber}</div>
          {r.tokenId != null && (
            <div className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Token #{r.tokenId}</div>
          )}
        </div>
      ),
    },
    {
      key: "image",
      header: "NFT",
      width: 90,
      align: "center",
      render: r => <NftImage hash={r.imageIpfsHash} isRevealed={r.isRevealed} blindBoxUri={r.blindBoxUri} size={70} />,
    },
    {
      key: "wave",
      header: "Wave",
      sortKey: "wave",
      render: r => r.waveNumber != null ? (
        <div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>
            W{r.waveNumber}
          </span>
          {r.waveName && <div className="text-xs mt-1" style={{ color: "#9bafc5" }}>{r.waveName.split("—")[0]?.trim()}</div>}
          {r.waveQuantity != null && (
            <div className="text-xs mt-0.5" style={{ color: "#6b7280" }}>Qty: {r.waveQuantity.toLocaleString()}</div>
          )}
        </div>
      ) : <span style={{ color: "#d1d5db" }}>—</span>,
    },
    {
      key: "schedule",
      header: "Wave Schedule",
      render: r => (
        <div className="text-xs space-y-0.5" style={{ color: "#6b7280", minWidth: 120 }}>
          {r.waveScheduledStart && <div>Start: <strong style={{ color: "#374151" }}>{fmt(r.waveScheduledStart)}</strong></div>}
          {r.waveScheduledEnd   && <div>End: <strong style={{ color: "#374151" }}>{fmt(r.waveScheduledEnd)}</strong></div>}
          {r.waveRevealScheduledAt && (
            <div style={{ color: "#7c3aed" }}>Reveal: <strong>{fmt(r.waveRevealScheduledAt)}</strong></div>
          )}
          {!r.waveScheduledStart && !r.waveScheduledEnd && <span style={{ color: "#d1d5db" }}>—</span>}
        </div>
      ),
    },
    {
      key: "reveal",
      header: "Reveal",
      sortKey: "is_revealed",
      align: "center",
      render: r => <RevealBadge revealed={r.isRevealed} />,
    },
    {
      key: "delivery",
      header: "Status",
      sortKey: "delivery_status",
      align: "center",
      render: r => r.deliveryStatusCode
        ? <StatusBadge code={r.deliveryStatusCode} name={r.deliveryStatusName} />
        : <span style={{ color: "#9bafc5" }}>—</span>,
    },
    {
      key: "price",
      header: "Price",
      sortKey: "price_eth",
      align: "right",
      render: r => {
        const eff = r.effectivePriceEth;
        return eff != null ? (
          <span className="text-xs font-bold" style={{ color: "#24315f" }}>{Number(eff)} ETH</span>
        ) : <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>Free</span>;
      },
    },
    {
      key: "timeline",
      header: "Key Dates",
      render: r => (
        <div className="text-xs space-y-0.5" style={{ minWidth: 110 }}>
          {r.mintedAt   && <div style={{ color: "#6b7280" }}>Minted: <strong style={{ color: "#374151" }}>{fmt(r.mintedAt)}</strong></div>}
          {r.revealedAt && <div style={{ color: "#7c3aed" }}>Revealed: <strong>{fmt(r.revealedAt)}</strong></div>}
          {r.soldAt     && <div style={{ color: "#d97706" }}>Sold: <strong>{fmt(r.soldAt)}</strong></div>}
          {r.deliveredAt && <div style={{ color: "#16a34a" }}>Delivered: <strong>{fmt(r.deliveredAt)}</strong></div>}
          {!r.mintedAt && !r.revealedAt && !r.soldAt && !r.deliveredAt && (
            <span style={{ color: "#d1d5db" }}>No activity</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "center",
      render: r => (
        <button onClick={() => setViewRecord(r)} title="View full history"
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: "#41afeb" }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(65,175,235,0.1)")}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      ),
    },
  ];

  return (
    <div className="p-5 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>NFT Records</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            Full lifecycle report — generation, wave assignment, minting, reveal, sale, and delivery
          </p>
        </div>
        <button onClick={() => {
          const headers = ["Serial #", "Token ID", "Wave", "Wave Start", "Wave End", "Reveal Date", "Minted At", "Revealed At", "Sold At", "Delivered At", "Status", "Price (ETH)", "Owner"];
          const rows = records.map(r => [
            r.serialNumber, r.tokenId ?? "", r.waveNumber ? `W${r.waveNumber}` : "",
            fmt(r.waveScheduledStart), fmt(r.waveScheduledEnd), fmt(r.waveRevealScheduledAt),
            fmt(r.mintedAt), fmt(r.revealedAt), fmt(r.soldAt), fmt(r.deliveredAt),
            r.deliveryStatusName ?? "", r.effectivePriceEth ?? "", r.ownerAddress ?? "",
          ]);
          const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
          const blob = new Blob([csv], { type: "text/csv" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
          a.download = `bearth-nft-lifecycle-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
        }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white"
          style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total NFTs",  value: total,          color: "#41afeb", filter: () => { setRevealFilter(""); setStatusFilter(""); setWaveFilter(""); applyFilter("", stageFilter, "", ""); } },
          { label: "Blind Box",   value: blindCount,     color: "#d97706", filter: () => { setRevealFilter("false"); applyFilter(statusFilter, stageFilter, "false", waveFilter); } },
          { label: "Revealed",    value: revealedCount,  color: "#7c3aed", filter: () => { setRevealFilter("true");  applyFilter(statusFilter, stageFilter, "true",  waveFilter); } },
          { label: "Sold",        value: soldCount,      color: "#f59e0b", filter: () => { setStatusFilter("sold");      applyFilter("sold",      stageFilter, revealFilter, waveFilter); } },
          { label: "Delivered",   value: deliveredCount, color: "#16a34a", filter: () => { setStatusFilter("delivered"); applyFilter("delivered", stageFilter, revealFilter, waveFilter); } },
        ].map(s => (
          <button key={s.label} onClick={s.filter} className="text-left bg-white rounded-xl shadow-sm hover:shadow-md"
            style={{ border: "1px solid #e5e7eb", borderLeft: `3px solid ${s.color}`, padding: "14px 16px" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#9bafc5" }}>{s.label}</p>
            <p className="text-2xl font-extrabold leading-none" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
          </button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48 max-w-64">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search serial # or token ID…" value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#111827" }} />
        </div>

        <select value={waveFilter}
          onChange={e => { setWaveFilter(e.target.value); applyFilter(statusFilter, stageFilter, revealFilter, e.target.value); }}
          className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
          style={{ border: "1px solid #e5e7eb", color: waveFilter ? "#111827" : "#9bafc5" }}>
          <option value="">All Waves</option>
          {waves.map(w => (
            <option key={w.wave_number} value={String(w.wave_number)}>
              W{w.wave_number} — {w.name}
            </option>
          ))}
        </select>

        {master && (
          <select value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); applyFilter(e.target.value, stageFilter, revealFilter, waveFilter); }}
            className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
            style={{ border: "1px solid #e5e7eb", color: statusFilter ? "#111827" : "#9bafc5" }}>
            <option value="">All Statuses</option>
            {master.deliveryStatuses.map(s => <option key={s.id} value={s.code}>{s.name}</option>)}
          </select>
        )}

        <select value={revealFilter}
          onChange={e => { setRevealFilter(e.target.value); applyFilter(statusFilter, stageFilter, e.target.value, waveFilter); }}
          className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
          style={{ border: "1px solid #e5e7eb", color: revealFilter ? "#111827" : "#9bafc5" }}>
          <option value="">All Reveal States</option>
          <option value="false">Blind Box</option>
          <option value="true">Revealed</option>
        </select>

        {(statusFilter || revealFilter || waveFilter || stageFilter) && (
          <button onClick={() => {
            setStatusFilter(""); setRevealFilter(""); setWaveFilter(""); setStageFilter("");
            applyFilter("", "", "", "");
          }} className="px-3 py-2 rounded-xl text-xs font-semibold"
            style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
            Clear filters
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={records}
        total={total}
        offset={offset}
        pageSize={PAGE_SIZE}
        onPageChange={setOffset}
        loading={loading}
        error={error}
        emptyText="No NFT records found"
        keyExtractor={r => r.id}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {/* ══ Full History Modal ══════════════════════════════════════════════════ */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl flex flex-col"
            style={{ width: "100%", maxWidth: 720, maxHeight: "92vh", border: "1px solid #e5e7eb" }}>
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
              <div>
                <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>NFT {viewRecord.serialNumber} — Full History</h2>
                <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Complete lifecycle from generation to delivery</p>
              </div>
              <button onClick={() => setViewRecord(null)} style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-6">

              {/* NFT Identity */}
              <div className="flex gap-5">
                <div className="flex-shrink-0">
                  <NftImage hash={viewRecord.imageIpfsHash} isRevealed={viewRecord.isRevealed} blindBoxUri={viewRecord.blindBoxUri} size={120} />
                  <div className="mt-2 text-center">
                    <RevealBadge revealed={viewRecord.isRevealed} />
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    { label: "Serial Number", val: viewRecord.serialNumber },
                    { label: "Token ID",      val: viewRecord.tokenId != null ? `#${viewRecord.tokenId}` : "Not minted" },
                    { label: "Stage",         val: viewRecord.stageName ?? "—" },
                    { label: "Current Status",val: viewRecord.deliveryStatusName ?? "—" },
                    { label: "Owner Address", val: viewRecord.ownerAddress ? `${viewRecord.ownerAddress.slice(0,6)}…${viewRecord.ownerAddress.slice(-4)}` : "—" },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#9bafc5" }}>{label}</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "#24315f" }}>{val}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Wave Info */}
              {viewRecord.waveNumber != null && (
                <div className="p-4 rounded-xl" style={{ background: "rgba(65,175,235,0.05)", border: "1px solid rgba(65,175,235,0.2)" }}>
                  <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#41afeb" }}>Wave Information</p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>Wave</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: "#24315f" }}>
                        Wave {viewRecord.waveNumber}{viewRecord.waveName ? ` — ${viewRecord.waveName}` : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>Wave Qty</p>
                      <p className="text-sm font-bold mt-0.5" style={{ color: "#24315f" }}>
                        {viewRecord.waveQuantity != null ? viewRecord.waveQuantity.toLocaleString() : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>Wave Start</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "#374151" }}>{fmt(viewRecord.waveScheduledStart)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>Wave End</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "#374151" }}>{fmt(viewRecord.waveScheduledEnd)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>Reveal Date</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "#7c3aed" }}>{fmt(viewRecord.waveRevealScheduledAt)}</p>
                    </div>
                  </div>
                  {viewRecord.effectivePriceEth != null && (
                    <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(65,175,235,0.15)" }}>
                      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>
                        Sale Price {viewRecord.priceEth != null ? "(Custom Override)" : "(Wave Default)"}
                      </p>
                      <p className="text-lg font-bold mt-0.5" style={{ color: viewRecord.priceEth != null ? "#7c3aed" : "#24315f" }}>
                        {Number(viewRecord.effectivePriceEth)} ETH
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Lifecycle Timeline */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: "#9bafc5" }}>Lifecycle Timeline</p>
                <div className="space-y-0">
                  {[
                    { label: "Generated",  date: viewRecord.createdAt,   color: "#41afeb", desc: "NFT created in DB from generator" },
                    { label: "Minted",     date: viewRecord.mintedAt,     color: "#7c3aed", desc: "Minted on-chain to buyer wallet" },
                    { label: "Revealed",   date: viewRecord.revealedAt,   color: "#7c3aed", desc: "NFT artwork revealed, blind box unsealed" },
                    { label: "Sold",       date: viewRecord.soldAt,       color: "#f59e0b", desc: "NFT sold, ownership transferred" },
                    { label: "Delivered",  date: viewRecord.deliveredAt,  color: "#16a34a", desc: "NFT delivered to customer wallet" },
                  ].map((step, i, arr) => (
                    <div key={step.label} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{
                            background: step.date ? `${step.color}15` : "#f9fafb",
                            border: `2px solid ${step.date ? step.color : "#e5e7eb"}`,
                          }}>
                          {step.date ? (
                            <svg className="w-3.5 h-3.5" style={{ color: step.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <div className="w-2 h-2 rounded-full" style={{ background: "#d1d5db" }} />
                          )}
                        </div>
                        {i < arr.length - 1 && (
                          <div className="w-0.5 h-8 mt-1" style={{ background: step.date ? "#e5e7eb" : "#f3f4f6" }} />
                        )}
                      </div>
                      <div className="pb-6">
                        <div className="flex items-baseline gap-3">
                          <p className="text-sm font-bold" style={{ color: step.date ? "#24315f" : "#9bafc5" }}>{step.label}</p>
                          {step.date && (
                            <p className="text-xs" style={{ color: "#6b7280" }}>{fmt(step.date)}</p>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Blind Box notice */}
              {!viewRecord.isRevealed && (
                <div className="p-3 rounded-xl flex items-center gap-3"
                  style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)" }}>
                  <svg className="w-5 h-5 flex-shrink-0" style={{ color: "#d97706" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <div>
                    <p className="text-xs font-bold" style={{ color: "#d97706" }}>Sealed — Blind Box</p>
                    <p className="text-xs mt-0.5" style={{ color: "#92400e" }}>
                      {viewRecord.waveRevealScheduledAt
                        ? `Scheduled to reveal on ${fmt(viewRecord.waveRevealScheduledAt)}. Attributes and artwork are hidden until then.`
                        : "Attributes and artwork will be shown after the wave reveal event."}
                    </p>
                  </div>
                </div>
              )}

              {/* Traits (post-reveal) */}
              {viewRecord.isRevealed && viewRecord.traits && Object.keys(viewRecord.traits).length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#9bafc5" }}>Attributes</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(viewRecord.traits).map(([trait, value]) => (
                      <div key={trait} className="px-3 py-1.5 rounded-xl text-center"
                        style={{ background: "rgba(65,175,235,0.08)", border: "1px solid rgba(65,175,235,0.2)" }}>
                        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "#9bafc5" }}>{trait}</div>
                        <div className="text-sm font-semibold mt-0.5" style={{ color: "#24315f" }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata URI */}
              {viewRecord.metadataUri && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#9bafc5" }}>Metadata URI</p>
                  <p className="text-xs font-mono break-all px-3 py-2 rounded-lg"
                    style={{ background: "#f9fafb", color: "#6b7280", border: "1px solid #e5e7eb" }}>
                    {viewRecord.metadataUri}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #e5e7eb" }}>
              <button onClick={() => setViewRecord(null)} className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
