"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useInterval } from "@/lib/useInterval";
import DataTable, { type ColumnDef } from "@/components/DataTable";
import { ErrBanner } from "@/components/nft/Banner";
import { inputStyle, labelStyle } from "@/components/nft/styles";
import OtcTab from "@/components/nft/tabs/OtcTab";
import BulkTab from "@/components/nft/tabs/BulkTab";
import GiftsTab from "@/components/nft/tabs/GiftsTab";
import AuctionsTab from "@/components/nft/tabs/AuctionsTab";
import SeasonsTab from "@/components/nft/tabs/SeasonsTab";
import EventsTab from "@/components/nft/tabs/EventsTab";
import BurnTab from "@/components/nft/tabs/BurnTab";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE    = 20;
const IPFS_GATEWAY = "https://amgbearth.myfilebase.com/ipfs";
const ETHERSCAN    = process.env.NEXT_PUBLIC_NETWORK === "mainnet"
  ? "https://etherscan.io/tx/"
  : "https://sepolia.etherscan.io/tx/";

// ─── Types — Records tab ──────────────────────────────────────────────────────

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
  mintTxHash: string | null;
  lastTxHash: string | null;
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
  rarityTier: string | null;
  rarityScore: number | null;
  rarityRank: number | null;
  lastSalePriceEth: number | null;
}

interface Master {
  nftStages:        Array<{ id: string; name: string; code: string }>;
  nftTypes:         Array<{ id: string; name: string; code: string }>;
  deliveryStatuses: Array<{ id: string; name: string; code: string }>;
}

const TIER_COLORS: Record<string, string> = {
  Legendary: "#f59e0b",
  Epic:       "#a855f7",
  Rare:       "#3b82f6",
  Common:     "#6b7280",
};

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(dt: string | null): string {
  if (!dt) return "—";
  const d = new Date(dt);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function shortAddr(addr: string) { return addr.slice(0, 6) + "…" + addr.slice(-4); }
function shortHash(h: string)    { return h.slice(0, 8) + "…" + h.slice(-6); }

// ─── Sub-components (Records tab) ─────────────────────────────────────────────

function NftImage({ hash, isRevealed = false, blindBoxUri, size = 80 }: {
  hash?: string | null;
  isRevealed?: boolean;
  blindBoxUri?: string | null;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const [bbFailed,  setBbFailed]  = useState(false);

  if (!isRevealed) {
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
  // ── Tab ──────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"records" | "otc" | "bulk" | "gifts" | "auctions" | "seasons" | "events" | "burn">("records");

  // ── Records tab state ─────────────────────────────────────────────────────
  const [records, setRecords]         = useState<NftRecord[]>([]);
  const [total, setTotal]             = useState(0);
  const [totalAll, setTotalAll]       = useState(0);
  const [blindCount, setBlindCount]   = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [mintedCount, setMintedCount] = useState(0);
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
  const [modalMaximized, setModalMaximized] = useState(false);
  const [waves, setWaves]             = useState<Array<{ waveNumber: number; name: string }>>([]);
  const [blindBoxImageUrl, setBlindBoxImageUrl] = useState<string | null>(null);

  const [mintedFrom,   setMintedFrom]   = useState("");
  const [mintedTo,     setMintedTo]     = useState("");

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Records data loading ─────────────────────────────────────────────────
  const loadRecords = useCallback((
    q: string, off: number, status: string, stage: string, revealed: string, wave: string,
    sk?: string, sd?: "asc" | "desc",
    mFrom?: string, mTo?: string,
  ) => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ search: q, limit: String(PAGE_SIZE), offset: String(off) });
    if (status)  params.set("delivery_status", status);
    if (stage)   params.set("stage", stage);
    if (revealed === "pre_mint") {
      params.set("minted", "false");
    } else if (revealed === "minted") {
      params.set("minted", "true");          // all minted (blind box + revealed combined)
    } else if (revealed === "false") {
      params.set("revealed", "false");
      params.set("minted", "true");          // blind box = minted but not revealed
    } else if (revealed === "true") {
      params.set("revealed", "true");
    }
    if (wave)    params.set("wave_number", wave);
    if (mFrom)   params.set("minted_from", mFrom);
    if (mTo)     params.set("minted_to",   mTo);
    if (sk)      params.set("sort_by", sk);
    if (sk && sd) params.set("sort_dir", sd);
    fetch(`/api/nft?${params}`, { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error("API error"); return r.json(); })
      .then(data => {
        setRecords(data.nftRecords ?? []);
        setTotal(data.total ?? 0);
        setTotalAll(data.totalAll ?? 0);
        setBlindCount(data.blindCount ?? 0);
        setRevealedCount(data.revealedCount ?? 0);
        setMintedCount(data.mintedCount ?? 0);
        setSoldCount(data.soldCount ?? 0);
        setDeliveredCount(data.deliveredCount ?? 0);
        setLoading(false);
      })
      .catch(e => { setError(e.message ?? "Failed to load NFT records."); setLoading(false); });
  }, []);

  // ── Initial loads ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/master", { credentials: "include" })
      .then(r => r.json()).then(d => setMaster(d)).catch(() => {});
    fetch("/api/nft-sell/waves", { credentials: "include" })
      .then(r => r.json()).then(d => setWaves(d.waves ?? [])).catch(() => {});
    fetch("/api/nft-sell/collection/stats", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.blindBoxImageUrl) setBlindBoxImageUrl(d.blindBoxImageUrl); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadRecords(search, offset, statusFilter, stageFilter, revealFilter, waveFilter, sortKey, sortDir);
  }, [offset, statusFilter, stageFilter, revealFilter, waveFilter]);

  // ── Watchdog: silent 30s poll on stats ───────────────────────────────────
  const [recWatchAlert, setRecWatchAlert] = useState<string | null>(null);
  const [recWatchUpdated, setRecWatchUpdated] = useState<Date | null>(null);
  const prevRecMintedRef = useRef<number | null>(null);

  const silentRecPoll = useCallback(async () => {
    try {
      const res = await fetch("/api/nft-sell/collection/stats", { credentials: "include" });
      if (!res.ok) return;
      const d = await res.json();
      setRecWatchUpdated(new Date());
      if (d.blindBoxImageUrl) setBlindBoxImageUrl(d.blindBoxImageUrl);
      if (prevRecMintedRef.current !== null && d.totalMinted > prevRecMintedRef.current) {
        setRecWatchAlert(`${d.totalMinted - prevRecMintedRef.current} new NFT${d.totalMinted - prevRecMintedRef.current > 1 ? "s" : ""} minted on-chain. Refresh records to see latest.`);
      }
      prevRecMintedRef.current = d.totalMinted ?? prevRecMintedRef.current;
    } catch { /* silent */ }
  }, []);

  useInterval(silentRecPoll, 30_000);

  // ── Records handlers ──────────────────────────────────────────────────────
  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setOffset(0);
      loadRecords(v, 0, statusFilter, stageFilter, revealFilter, waveFilter, sortKey, sortDir, mintedFrom, mintedTo);
    }, 300);
  };

  const applyFilter = (status = statusFilter, stage = stageFilter, revealed = revealFilter, wave = waveFilter, mFrom = mintedFrom, mTo = mintedTo) => {
    setOffset(0);
    loadRecords(search, 0, status, stage, revealed, wave, sortKey, sortDir, mFrom, mTo);
  };

  const handleSort = (key: string, dir: "asc" | "desc") => {
    setSortKey(key); setSortDir(dir); setOffset(0);
    loadRecords(search, 0, statusFilter, stageFilter, revealFilter, waveFilter, key, dir, mintedFrom, mintedTo);
  };

  // ── Records columns ───────────────────────────────────────────────────────
  const columns: ColumnDef<NftRecord>[] = [
    {
      // NFT thumbnail + serial + token ID merged into one column
      key: "nft",
      header: "NFT",
      sortKey: "serial_number",
      render: r => (
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ border: "1.5px solid #e2e8f0" }}>
            <NftImage hash={r.imageIpfsHash} isRevealed={r.isRevealed} blindBoxUri={blindBoxImageUrl} size={52} />
          </div>
          <div>
            <div className="font-mono font-bold text-sm leading-tight" style={{ color: "#0f172a" }}>{r.serialNumber}</div>
            <div className="text-xs mt-0.5" style={{ color: r.tokenId != null ? "#64748b" : "#cbd5e1" }}>
              {r.tokenId != null ? `Token #${r.tokenId}` : "Not minted"}
            </div>
            {r.rarityTier && (
              <div className="mt-0.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: (TIER_COLORS[r.rarityTier.charAt(0).toUpperCase() + r.rarityTier.slice(1)] ?? "#6b7280") + "20", color: TIER_COLORS[r.rarityTier.charAt(0).toUpperCase() + r.rarityTier.slice(1)] ?? "#6b7280" }}>
                  ● {r.rarityTier.charAt(0).toUpperCase() + r.rarityTier.slice(1)}
                </span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "wave",
      header: "Wave",
      sortKey: "wave",
      render: r => r.waveNumber != null ? (
        <div>
          <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>
            W{r.waveNumber}
          </span>
          {r.waveName && (
            <div className="text-xs mt-1 font-medium" style={{ color: "#374151" }}>{r.waveName.split("—")[0]?.trim()}</div>
          )}
        </div>
      ) : <span style={{ color: "#d1d5db" }}>—</span>,
    },
    {
      key: "schedule",
      header: "Wave Schedule",
      render: r => {
        if (r.waveNumber == null) return <span style={{ color: "#d1d5db" }}>—</span>;
        const start = r.waveScheduledStart;
        const end   = r.waveScheduledEnd;
        if (!start && !end) return <span className="text-xs" style={{ color: "#d1d5db" }}>Not set</span>;
        return (
          <div className="text-xs space-y-0.5" style={{ minWidth: 130 }}>
            {start && <div style={{ color: "#64748b" }}><span style={{ color: "#94a3b8" }}>From </span><strong style={{ color: "#374151" }}>{fmt(start)}</strong></div>}
            {end   && <div style={{ color: "#64748b" }}><span style={{ color: "#94a3b8" }}>To </span><strong style={{ color: "#374151" }}>{fmt(end)}</strong></div>}
          </div>
        );
      },
    },
    {
      // Single derived NFT status — industry standard, no logistics jargon
      key: "status",
      header: "Status",
      align: "center",
      render: r => {
        const code = r.deliveryStatusCode;
        if (code === "delivered") return <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#dcfce7", color: "#15803d" }}>✓ Delivered</span>;
        if (code === "sold")      return <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#fef9c3", color: "#a16207" }}>💰 Sold</span>;
        if (r.isRevealed)         return <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#f5f3ff", color: "#7c3aed" }}>✦ Revealed</span>;
        if (r.tokenId != null)    return <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#eff6ff", color: "#2563eb" }}>⬡ Minted</span>;
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#f8fafc", color: "#94a3b8", border: "1px solid #e2e8f0" }}>○ Pre-mint</span>;
      },
    },
    {
      key: "reveal_date",
      header: "Reveal",
      render: r => {
        if (r.isRevealed && r.revealedAt) return (
          <div>
            <div className="text-xs font-semibold" style={{ color: "#7c3aed" }}>Revealed</div>
            <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>{fmt(r.revealedAt)}</div>
          </div>
        );
        if (r.waveRevealScheduledAt) {
          const isPast = new Date(r.waveRevealScheduledAt) < new Date();
          return (
            <div>
              <div className="text-xs font-semibold" style={{ color: isPast ? "#dc2626" : "#6366f1" }}>
                {isPast ? "Overdue" : "Scheduled"}
              </div>
              <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>{fmt(r.waveRevealScheduledAt)}</div>
            </div>
          );
        }
        return <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>;
      },
    },
    {
      key: "price",
      header: "Mint Price",
      sortKey: "price_eth",
      align: "right",
      render: r => {
        const eff = r.effectivePriceEth;
        return eff != null
          ? <span className="text-sm font-bold" style={{ color: "#0f172a" }}>{Number(eff)} ETH</span>
          : <span className="text-sm font-semibold" style={{ color: "#15803d" }}>Free</span>;
      },
    },
    {
      // Most recent lifecycle event only — single compact line
      key: "last_activity",
      header: "Last Activity",
      render: r => {
        const latest =
          r.deliveredAt ? { label: "Delivered", date: r.deliveredAt, color: "#15803d" } :
          r.soldAt      ? { label: "Sold",      date: r.soldAt,      color: "#a16207" } :
          r.revealedAt  ? { label: "Revealed",  date: r.revealedAt,  color: "#7c3aed" } :
          r.mintedAt    ? { label: "Minted",    date: r.mintedAt,    color: "#2563eb" } :
          null;
        if (!latest) return <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>;
        return (
          <div>
            <div className="text-xs font-semibold" style={{ color: latest.color }}>{latest.label}</div>
            <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>{fmt(latest.date)}</div>
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      align: "center",
      width: 80,
      render: r => (
        <button onClick={() => { setViewRecord(r); setModalMaximized(false); }} title="View full history"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={{ color: "#41afeb", border: "1px solid rgba(65,175,235,0.3)", background: "rgba(65,175,235,0.05)" }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(65,175,235,0.12)"; e.currentTarget.style.borderColor = "rgba(65,175,235,0.5)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(65,175,235,0.05)"; e.currentTarget.style.borderColor = "rgba(65,175,235,0.3)"; }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          History
        </button>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-5 space-y-5">

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>NFT Records</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            Full lifecycle report — generation, wave assignment, minting, reveal, sale, and delivery
          </p>
        </div>
        {/* Per-tab CSV export */}
        {activeTab === "records" && (
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
        )}
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div className="flex gap-1">
          {(["records", "otc", "bulk", "gifts", "auctions", "seasons", "events", "burn"] as const).map(tab => {
            const LABELS: Record<string, string> = { records: "Records", otc: "OTC Deals", bulk: "Bulk Ops", gifts: "Gifts", auctions: "Auctions", seasons: "Season Passes", events: "Events", burn: "Burn to Mint" };
            const label = LABELS[tab] ?? tab;
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-4 py-2.5 text-sm font-semibold transition-colors relative"
                style={{
                  color: isActive ? "#24315f" : "#9bafc5",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  outline: "none",
                }}>
                {label}
                {isActive && (
                  <span style={{
                    position: "absolute", bottom: -1, left: 0, right: 0,
                    height: 2, background: "#41afeb", borderRadius: "2px 2px 0 0",
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* RECORDS TAB                                                           */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Watchdog alert + live indicator — shown across all tabs */}
      {recWatchAlert && (
        <div className="flex items-center justify-between px-4 py-2 rounded-xl text-sm"
          style={{ background: "rgba(65,175,235,0.08)", border: "1px solid rgba(65,175,235,0.25)", color: "#2e9fd8" }}>
          <span>⟳ {recWatchAlert}</span>
          <button onClick={() => setRecWatchAlert(null)} className="ml-4 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
      {recWatchUpdated && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#9bafc5" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          Live · last checked {recWatchUpdated.toLocaleTimeString()}
        </div>
      )}

      {activeTab === "records" && (
        <>
          {/* ── Stats ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              {
                label: "Total NFTs", value: totalAll, color: "#24315f", bg: "#eef0f8", pct: 100,
                sub: "Full collection",
                icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
                filter: () => { setRevealFilter(""); setStatusFilter(""); setWaveFilter(""); applyFilter("", stageFilter, "", ""); },
              },
              {
                label: "Pre-mint", value: totalAll - mintedCount, color: "#64748b", bg: "#f8fafc", pct: totalAll ? Math.round((totalAll - mintedCount) / totalAll * 100) : 0,
                sub: "Awaiting mint",
                icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                filter: () => { setRevealFilter("pre_mint"); applyFilter(statusFilter, stageFilter, "pre_mint", waveFilter); },
              },
              {
                label: "Minted", value: mintedCount, color: "#2563eb", bg: "#eff6ff", pct: totalAll ? Math.round(mintedCount / totalAll * 100) : 0,
                sub: "On-chain tokens",
                icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
                filter: () => { setRevealFilter("minted"); setStatusFilter(""); applyFilter("", stageFilter, "minted", waveFilter); },
              },
              {
                label: "Blind Box", value: blindCount, color: "#d97706", bg: "#fffbeb", pct: totalAll ? Math.round(blindCount / totalAll * 100) : 0,
                sub: "Minted, unrevealed",
                icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
                filter: () => { setRevealFilter("false"); applyFilter(statusFilter, stageFilter, "false", waveFilter); },
              },
              {
                label: "Revealed", value: revealedCount, color: "#7c3aed", bg: "#f5f3ff", pct: totalAll ? Math.round(revealedCount / totalAll * 100) : 0,
                sub: "Artwork unlocked",
                icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
                filter: () => { setRevealFilter("true"); applyFilter(statusFilter, stageFilter, "true", waveFilter); },
              },
            ].map(s => (
              <button key={s.label} onClick={s.filter}
                className="text-left bg-white rounded-2xl transition-all duration-150 group"
                style={{ border: "1px solid #e5e7eb", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; e.currentTarget.style.borderColor = s.color + "60"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; e.currentTarget.style.borderColor = "#e5e7eb"; }}>
                {/* Icon + label row */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#94a3b8" }}>{s.label}</p>
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: s.bg, color: s.color }}>
                    {s.icon}
                  </div>
                </div>
                {/* Number */}
                <p className="text-2xl font-extrabold leading-none mb-1" style={{ color: s.color }}>
                  {s.value.toLocaleString()}
                </p>
                {/* Subtitle */}
                <p className="text-[10px] mb-3" style={{ color: "#94a3b8" }}>{s.sub}</p>
                {/* Progress bar */}
                <div className="h-1 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${s.pct}%`, background: s.color, opacity: 0.7 }} />
                </div>
                <p className="text-[10px] mt-1 font-semibold" style={{ color: s.color + "99" }}>
                  {s.pct}% of collection
                </p>
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
                <option key={w.waveNumber} value={String(w.waveNumber)}>
                  W{w.waveNumber} — {w.name}
                </option>
              ))}
            </select>

            {/* Artwork state — matches NFT lifecycle badge language */}
            <select value={revealFilter}
              onChange={e => { setRevealFilter(e.target.value); applyFilter(statusFilter, stageFilter, e.target.value, waveFilter); }}
              className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
              style={{ border: "1px solid #e5e7eb", color: revealFilter ? "#111827" : "#9bafc5" }}>
              <option value="">All Artwork</option>
              <option value="pre_mint">○ Pre-mint</option>
              <option value="false">⬡ Blind Box</option>
              <option value="true">✦ Revealed</option>
            </select>

            <input type="date" value={mintedFrom}
              onChange={e => { setMintedFrom(e.target.value); applyFilter(statusFilter, stageFilter, revealFilter, waveFilter, e.target.value, mintedTo); }}
              className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
              style={{ border: "1px solid #e5e7eb", color: mintedFrom ? "#111827" : "#9bafc5" }}
              title="Minted from date" />
            <input type="date" value={mintedTo}
              onChange={e => { setMintedTo(e.target.value); applyFilter(statusFilter, stageFilter, revealFilter, waveFilter, mintedFrom, e.target.value); }}
              className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
              style={{ border: "1px solid #e5e7eb", color: mintedTo ? "#111827" : "#9bafc5" }}
              title="Minted to date" />

            {(statusFilter || revealFilter || waveFilter || stageFilter || mintedFrom || mintedTo) && (
              <button onClick={() => {
                setStatusFilter(""); setRevealFilter(""); setWaveFilter(""); setStageFilter("");
                setMintedFrom(""); setMintedTo("");
                applyFilter("", "", "", "", "", "");
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
        </>
      )}

      {activeTab === "otc"      && <OtcTab />}
      {activeTab === "bulk"     && <BulkTab />}
      {activeTab === "gifts"    && <GiftsTab />}
      {activeTab === "auctions" && <AuctionsTab />}
      {activeTab === "seasons"  && <SeasonsTab />}
      {activeTab === "events"   && <EventsTab />}
      {activeTab === "burn"     && <BurnTab />}

      {/* ══ Full History Modal ══════════════════════════════════════════════════ */}
      {viewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)" }}>
          <div className="flex flex-col shadow-2xl overflow-hidden bg-white"
            style={{
              width: "100%",
              maxWidth:     modalMaximized ? "100vw" : 800,
              height:       modalMaximized ? "100vh" : "auto",
              maxHeight:    modalMaximized ? "100vh" : "92vh",
              borderRadius: modalMaximized ? 0 : 16,
              border: "1px solid #e2e8f0",
              transition: "max-width 0.2s ease, height 0.2s ease, border-radius 0.2s ease",
            }}>

            {/* ── Title Bar ───────────────────────────────────────────────── */}
            <div className="flex-shrink-0 flex items-center justify-between px-5 py-3"
              style={{ borderBottom: "1px solid #e5e7eb", background: "#fff" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#e0e7ff,#ede9fe)" }}>
                  <svg className="w-4.5 h-4.5" style={{ color: "#6366f1", width: 18, height: 18 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-extrabold leading-tight" style={{ color: "#0f172a" }}>
                    NFT {viewRecord.serialNumber}
                    {viewRecord.tokenId != null && <span style={{ color: "#94a3b8", fontWeight: 500 }}> · Token #{viewRecord.tokenId}</span>}
                  </p>
                  <p className="text-xs" style={{ color: "#94a3b8" }}>Full history — generation to delivery</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {viewRecord.isRevealed
                  ? <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe" }}>✦ Revealed</span>
                  : <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" }}>⬡ Blind Box</span>
                }
                <button onClick={() => setModalMaximized(v => !v)} title={modalMaximized ? "Minimize" : "Maximize"}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>
                  {modalMaximized
                    ? <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" /></svg>
                    : <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                  }
                </button>
                <button onClick={() => setViewRecord(null)} title="Close"
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca" }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ── Scrollable Body ─────────────────────────────────────────── */}
            <div className="overflow-y-auto flex-1" style={{ background: "#f8fafc" }}>

              {/* ── Identity card ── */}
              <div className="m-5 mb-0 rounded-2xl overflow-hidden bg-white" style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                <div className="flex gap-5 p-5">
                  {/* NFT image */}
                  <div className="flex-shrink-0">
                    <div className="rounded-xl overflow-hidden" style={{ border: "2px solid #e2e8f0" }}>
                      <NftImage hash={viewRecord.imageIpfsHash} isRevealed={viewRecord.isRevealed} blindBoxUri={blindBoxImageUrl} size={140} />
                    </div>
                  </div>
                  {/* Details grid */}
                  <div className="flex-1 min-w-0">
                    <div className="grid grid-cols-3 gap-x-4 gap-y-4">
                      {/* Serial # */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Serial #</p>
                        <p className="text-sm font-semibold leading-tight" style={{ color: "#0f172a" }}>{viewRecord.serialNumber}</p>
                      </div>
                      {/* Token ID */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Token ID</p>
                        <p className="text-sm font-semibold leading-tight" style={{ color: viewRecord.tokenId != null ? "#0f172a" : "#94a3b8" }}>
                          {viewRecord.tokenId != null ? `#${viewRecord.tokenId}` : "Not minted"}
                        </p>
                      </div>
                      {/* NFT Status — derived from lifecycle, industry-standard */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#94a3b8" }}>NFT Status</p>
                        {(() => {
                          const code = viewRecord.deliveryStatusCode;
                          if (code === "delivered") return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#dcfce7", color: "#15803d" }}>✓ Delivered</span>;
                          if (code === "sold")      return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#fef9c3", color: "#a16207" }}>💰 Sold</span>;
                          if (viewRecord.isRevealed) return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#f5f3ff", color: "#7c3aed" }}>✦ Revealed</span>;
                          if (viewRecord.tokenId != null) return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#eff6ff", color: "#2563eb" }}>⬡ Minted</span>;
                          return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#f8fafc", color: "#94a3b8", border: "1px solid #e2e8f0" }}>○ Pre-mint</span>;
                        })()}
                      </div>
                      {/* Chain */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Chain</p>
                        <div className="flex items-center gap-1.5">
                          <svg width="14" height="14" viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M127.9 0L125.2 9V285.2L127.9 287.9L255.8 212.6L127.9 0Z" fill="#343434"/>
                            <path d="M127.9 0L0 212.6L127.9 287.9V154.2V0Z" fill="#8C8C8C"/>
                            <path d="M127.9 312.8L126.3 314.8V412.1L127.9 416.9L255.9 237.5L127.9 312.8Z" fill="#3C3C3B"/>
                            <path d="M127.9 416.9V312.8L0 237.5L127.9 416.9Z" fill="#8C8C8C"/>
                            <path d="M127.9 287.9L255.8 212.6L127.9 154.2V287.9Z" fill="#141414"/>
                            <path d="M0 212.6L127.9 287.9V154.2L0 212.6Z" fill="#393939"/>
                          </svg>
                          <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>
                            {process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "Ethereum" : "Sepolia"}
                          </p>
                        </div>
                      </div>
                      {/* Price */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Mint Price</p>
                        <p className="text-sm font-semibold leading-tight" style={{ color: viewRecord.effectivePriceEth != null ? "#0f172a" : "#15803d" }}>
                          {viewRecord.effectivePriceEth != null ? `${Number(viewRecord.effectivePriceEth)} ETH` : "Free"}
                        </p>
                      </div>
                      {/* Wave */}
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Wave</p>
                        <p className="text-sm font-semibold leading-tight" style={{ color: viewRecord.waveNumber != null ? "#0f172a" : "#94a3b8" }}>
                          {viewRecord.waveNumber != null
                            ? `W${viewRecord.waveNumber}${viewRecord.waveName ? ` — ${viewRecord.waveName.split("—")[0]?.trim()}` : ""}`
                            : "—"}
                        </p>
                      </div>
                      {/* Rarity */}
                      {/* Rarity Tier + Score + Rank — three cells in one row */}
                      {viewRecord.rarityTier && (() => {
                        const tier = viewRecord.rarityTier!.charAt(0).toUpperCase() + viewRecord.rarityTier!.slice(1);
                        const tierColor = TIER_COLORS[tier] ?? "#6b7280";
                        return (
                          <>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#94a3b8" }}>Rarity Tier</p>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: tierColor + "20", color: tierColor }}>
                                ● {tier}
                              </span>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Rarity Score</p>
                              <p className="text-sm font-bold" style={{ color: tierColor }}>
                                {viewRecord.rarityScore != null ? Number(viewRecord.rarityScore).toFixed(2) : <span style={{ color: "#cbd5e1" }}>—</span>}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Rank</p>
                              <p className="text-sm font-bold" style={{ color: "#0f172a" }}>
                                {viewRecord.rarityRank != null
                                  ? <><span style={{ color: tierColor }}>#{viewRecord.rarityRank}</span><span className="text-xs font-normal" style={{ color: "#94a3b8" }}> / {totalAll.toLocaleString()}</span></>
                                  : <span style={{ color: "#cbd5e1" }}>—</span>}
                              </p>
                            </div>
                          </>
                        );
                      })()}
                      {/* Last Sale */}
                      {viewRecord.lastSalePriceEth != null && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Last Sale</p>
                          <p className="text-sm font-bold" style={{ color: "#16a34a" }}>{Number(viewRecord.lastSalePriceEth).toFixed(4)} ETH</p>
                        </div>
                      )}
                    </div>
                    {viewRecord.ownerAddress && (
                      <div className="mt-4 pt-3" style={{ borderTop: "1px solid #f1f5f9" }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#94a3b8" }}>Owner Address</p>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-mono font-semibold" style={{ color: "#334155" }}>{viewRecord.ownerAddress}</p>
                          <button
                            onClick={() => navigator.clipboard.writeText(viewRecord.ownerAddress!)}
                            title="Copy address"
                            className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors"
                            style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#64748b" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#e0e7ff"; e.currentTarget.style.color = "#6366f1"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#64748b"; }}>
                            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">

                {/* Wave Schedule */}
                {viewRecord.waveNumber != null && (
                  <div className="rounded-2xl overflow-hidden bg-white" style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4" style={{ color: "#6366f1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#6366f1" }}>Wave Schedule</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#eff0fe", color: "#6366f1" }}>
                          W{viewRecord.waveNumber}{viewRecord.waveQuantity != null ? ` · ${viewRecord.waveQuantity.toLocaleString()} NFTs` : ""}
                        </span>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={viewRecord.isRevealed
                          ? { background: "#f5f3ff", color: "#7c3aed" }
                          : viewRecord.mintedAt
                          ? { background: "#eff6ff", color: "#3b82f6" }
                          : { background: "#f8fafc", color: "#94a3b8" }}>
                        {viewRecord.isRevealed ? "✦ Revealed" : viewRecord.mintedAt ? "⬡ Minted" : "○ Pending"}
                      </span>
                    </div>
                    {/* Progress track */}
                    <div className="px-5 pt-4 pb-1">
                      <div className="relative flex items-center">
                        <div className="flex-1 h-1 rounded-full" style={{ background: "#e2e8f0" }}>
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: viewRecord.isRevealed ? "100%" : viewRecord.mintedAt ? "65%" : viewRecord.waveScheduledStart && new Date(viewRecord.waveScheduledStart) < new Date() ? "32%" : "0%",
                              background: "linear-gradient(90deg,#6366f1,#8b5cf6)",
                            }} />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 px-5 py-4 gap-4">
                      {[
                        { label: "Wave Start",  val: fmt(viewRecord.waveScheduledStart),    dot: "#41afeb" },
                        { label: "Wave End",    val: fmt(viewRecord.waveScheduledEnd),      dot: "#f59e0b" },
                        { label: "Reveal Date", val: fmt(viewRecord.waveRevealScheduledAt), dot: "#7c3aed" },
                      ].map(s => (
                        <div key={s.label} className="flex items-start gap-2">
                          <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: s.dot }} />
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>{s.label}</p>
                            <p className="text-xs font-semibold" style={{ color: s.val === "—" ? "#cbd5e1" : "#1e293b" }}>{s.val}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {viewRecord.priceEth != null && (
                      <div className="flex items-center justify-between px-5 py-3 mx-0" style={{ borderTop: "1px solid #f1f5f9", background: "#fafaff" }}>
                        <span className="text-xs font-semibold" style={{ color: "#94a3b8" }}>Sale Price <span style={{ color: "#7c3aed" }}>(Custom Override)</span></span>
                        <span className="text-base font-extrabold" style={{ color: "#7c3aed" }}>{Number(viewRecord.priceEth)} ETH</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Lifecycle Timeline */}
                <div className="rounded-2xl overflow-hidden bg-white" style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                  <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <svg className="w-4 h-4" style={{ color: "#10b981" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#10b981" }}>Lifecycle Timeline</span>
                  </div>
                  {[
                    { label: "Generated", date: viewRecord.createdAt,   color: "#6366f1", desc: "NFT created in DB from generator",  txHash: null },
                    { label: "Minted",    date: viewRecord.mintedAt,    color: "#7c3aed", desc: "Minted on-chain to buyer wallet",    txHash: viewRecord.mintTxHash },
                    { label: "Revealed",  date: viewRecord.revealedAt,  color: "#8b5cf6", desc: "Artwork revealed, blind box opened", txHash: null },
                    { label: "Sold",      date: viewRecord.soldAt,      color: "#f59e0b", desc: viewRecord.lastSalePriceEth != null ? `Sold for ${Number(viewRecord.lastSalePriceEth).toFixed(4)} ETH` : "Ownership transferred on-chain",     txHash: viewRecord.lastTxHash },
                    { label: "Delivered", date: viewRecord.deliveredAt, color: "#10b981", desc: "Delivered to customer wallet",        txHash: null },
                  ].filter(step => step.date).map((step, i, arr) => (
                    <div key={step.label} className="flex gap-4 px-5 py-3.5" style={{ borderTop: i > 0 ? "1px solid #f8fafc" : undefined }}>
                      {/* Step indicator */}
                      <div className="flex flex-col items-center flex-shrink-0 pt-0.5" style={{ width: 32 }}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center"
                          style={{ background: `${step.color}18`, border: `2px solid ${step.color}` }}>
                          <svg className="w-3 h-3" style={{ color: step.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        {i < arr.length - 1 && (
                          <div className="w-px flex-1 mt-1" style={{ background: "#e2e8f0", minHeight: 12 }} />
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 pb-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold" style={{ color: "#0f172a" }}>{step.label}</span>
                          <span className="text-xs" style={{ color: "#64748b" }}>{fmt(step.date)}</span>
                          {step.txHash && (
                            <a href={`${ETHERSCAN}${step.txHash}`} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-mono px-2 py-0.5 rounded-md"
                              style={{ background: "#eff6ff", color: "#3b82f6", border: "1px solid #bfdbfe", textDecoration: "none" }}>
                              {shortHash(step.txHash)} ↗
                            </a>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{step.desc}</p>
                      </div>
                      {/* Badge */}
                      <div className="flex-shrink-0 pt-0.5">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: `${step.color}12`, color: step.color }}>
                          Done
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Blind Box notice */}
                {!viewRecord.isRevealed && (
                  <div className="rounded-2xl flex items-start gap-3 p-4 bg-white"
                    style={{ border: "1px solid #fde68a", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: "#fffbeb" }}>
                      <svg className="w-5 h-5" style={{ color: "#d97706" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: "#92400e" }}>Sealed — Blind Box</p>
                      <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#b45309" }}>
                        {viewRecord.waveRevealScheduledAt
                          ? `Scheduled to reveal on ${fmt(viewRecord.waveRevealScheduledAt)}. Artwork and attributes remain hidden until the reveal event.`
                          : "Artwork and attributes will appear after the wave reveal event."}
                      </p>
                    </div>
                  </div>
                )}

                {/* Traits */}
                {viewRecord.isRevealed && viewRecord.traits && Object.keys(viewRecord.traits).length > 0 && (
                  <div className="rounded-2xl overflow-hidden bg-white" style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                    <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <svg className="w-4 h-4" style={{ color: "#7c3aed" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7c3aed" }}>Attributes</span>
                    </div>
                    <div className="p-4 flex flex-wrap gap-2">
                      {Object.entries(viewRecord.traits).map(([trait, value]) => (
                        <div key={trait} className="px-3 py-2 rounded-xl text-center"
                          style={{ background: "#faf5ff", border: "1px solid #e9d5ff", minWidth: 80 }}>
                          <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#a78bfa" }}>{trait}</div>
                          <div className="text-sm font-bold" style={{ color: "#3b0764" }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <div className="flex-shrink-0 flex justify-end px-5 py-3 bg-white" style={{ borderTop: "1px solid #e2e8f0" }}>
              <button onClick={() => setViewRecord(null)}
                className="px-5 py-2 text-sm font-semibold rounded-lg"
                style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}>
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
