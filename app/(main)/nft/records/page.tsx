"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
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

// ─── Types — Sales History tab ────────────────────────────────────────────────

type SaleRecord = {
  serial_number:       string;
  token_id:            number | null;
  wave_num:            number | null;
  wallet:              string | null;
  price_eth:           string | null;
  rarity_tier:         string | null;
  image_ipfs_hash:     string | null;
  is_revealed:         boolean;
  mint_tx_hash:        string | null;
  minted_at:           string | null;
  last_sale_price_eth: string | null;
  last_tx_hash:        string | null;
  sold_at:             string | null;
};

type SalesSummary = {
  wave:           string;
  total_minted:   string;
  total_eth:      string | null;
  total_sold:     string;
  total_sale_eth: string | null;
};

const TIER_COLORS: Record<string, string> = {
  Legendary: "#f59e0b",
  Epic:       "#a855f7",
  Rare:       "#3b82f6",
  Common:     "#6b7280",
};

// ─── Types — Fulfillment tab ──────────────────────────────────────────────────

interface FulfillStageRow {
  stageId: string;
  stageName: string;
  stageCode: string;
  total: number;
  delivered: number;
  pending: number;
  cancelled: number;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function shortAddr(addr: string) { return addr.slice(0, 6) + "…" + addr.slice(-4); }
function shortHash(h: string)    { return h.slice(0, 8) + "…" + h.slice(-6); }

function fulfillPct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

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
  const [activeTab, setActiveTab] = useState<"records" | "sales" | "fulfillment" | "otc" | "bulk" | "gifts" | "auctions" | "seasons" | "events" | "burn">("records");
  const salesLoadedRef    = useRef(false);
  const fulfillLoadedRef  = useRef(false);

  // ── Records tab state ─────────────────────────────────────────────────────
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
  const [waves, setWaves]             = useState<Array<{ waveNumber: number; name: string }>>([]);

  // ── Sales History tab state ───────────────────────────────────────────────
  const [saleRecords,  setSaleRecords]  = useState<SaleRecord[]>([]);
  const [saleSummary,  setSaleSummary]  = useState<SalesSummary[]>([]);
  const [saleTotal,    setSaleTotal]    = useState(0);
  const [saleLoading,  setSaleLoading]  = useState(false);
  const [salePage,     setSalePage]     = useState(0);
  const [saleWave,     setSaleWave]     = useState("");
  const [saleWallet,   setSaleWallet]   = useState("");
  const [saleFrom,     setSaleFrom]     = useState("");
  const [saleTo,       setSaleTo]       = useState("");

  const SALE_LIMIT = 50;

  // ── Fulfillment tab state ─────────────────────────────────────────────────
  const [fulfillStages,   setFulfillStages]   = useState<FulfillStageRow[]>([]);
  const [fulfillLoading,  setFulfillLoading]  = useState(false);
  const [fulfillErr,      setFulfillErr]      = useState<string | null>(null);
  const [fulfillStageOff, setFulfillStageOff] = useState(0);
  const [fulfillSortKey,  setFulfillSortKey]  = useState<string | undefined>(undefined);
  const [fulfillSortDir,  setFulfillSortDir]  = useState<"asc" | "desc">("asc");
  // highlighted stat (for visual highlight only — no navigation)
  const [fulfillHighlight, setFulfillHighlight] = useState<"" | "delivered" | "pending" | "cancelled">("");

  const FULFILL_STAGE_PAGE = 10;

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fulfillment derived values ────────────────────────────────────────────
  const fulfillSortedStages = useMemo(() => {
    if (!fulfillSortKey) return fulfillStages;
    return [...fulfillStages].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (fulfillSortKey) {
        case "stage":     av = a.stageName;                                             bv = b.stageName;                                             break;
        case "total":     av = Number(a.total);                                         bv = Number(b.total);                                         break;
        case "delivered": av = Number(a.delivered);                                     bv = Number(b.delivered);                                     break;
        case "pending":   av = Number(a.pending);                                       bv = Number(b.pending);                                       break;
        case "cancelled": av = Number(a.cancelled);                                     bv = Number(b.cancelled);                                     break;
        case "pct":       av = fulfillPct(Number(a.delivered), Number(a.total));        bv = fulfillPct(Number(b.delivered), Number(b.total));        break;
        default: return 0;
      }
      if (av < bv) return fulfillSortDir === "asc" ? -1 : 1;
      if (av > bv) return fulfillSortDir === "asc" ? 1  : -1;
      return 0;
    });
  }, [fulfillStages, fulfillSortKey, fulfillSortDir]);

  const fulfillStagePage = fulfillSortedStages.slice(fulfillStageOff, fulfillStageOff + FULFILL_STAGE_PAGE);

  const grandTotal     = fulfillStages.reduce((s, r) => s + Number(r.total),     0);
  const grandDelivered = fulfillStages.reduce((s, r) => s + Number(r.delivered), 0);
  const grandPending   = fulfillStages.reduce((s, r) => s + Number(r.pending),   0);
  const grandCancelled = fulfillStages.reduce((s, r) => s + Number(r.cancelled), 0);

  // ── Records data loading ─────────────────────────────────────────────────
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

  // ── Sales data loading ────────────────────────────────────────────────────
  const fetchSalesData = useCallback(async (pg = 0, wv = saleWave, wlt = saleWallet, fr = saleFrom, t = saleTo) => {
    setSaleLoading(true);
    const qs = new URLSearchParams({ limit: String(SALE_LIMIT), offset: String(pg * SALE_LIMIT) });
    if (wv)  qs.set("wave",   wv);
    if (wlt) qs.set("wallet", wlt);
    if (fr)  qs.set("from",   fr);
    if (t)   qs.set("to",     t);

    const [histRes, sumRes] = await Promise.all([
      fetch(`/api/nft-sell/admin-sales/history?${qs}`, { credentials: "include" }),
      fetch("/api/nft-sell/admin-sales/history/summary", { credentials: "include" }),
    ]);
    const histJson = await histRes.json().catch(() => ({}));
    const sumJson  = await sumRes.json().catch(() => ({}));

    setSaleRecords(histJson.records ?? []);
    setSaleTotal(histJson.total   ?? 0);
    setSaleSummary(sumJson.summary ?? []);
    setSaleLoading(false);
  }, [saleWave, saleWallet, saleFrom, saleTo]);

  // ── Fulfillment data loading ──────────────────────────────────────────────
  const fetchFulfillData = useCallback(() => {
    setFulfillLoading(true); setFulfillErr(null);
    fetch("/api/reports/sales-by-stage", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setFulfillStages(d.stages ?? []); setFulfillLoading(false); })
      .catch(() => { setFulfillErr("Failed to load fulfillment data."); setFulfillLoading(false); });
  }, []);

  // ── Initial loads ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/master", { credentials: "include" })
      .then(r => r.json()).then(d => setMaster(d)).catch(() => {});
    fetch("/api/nft-sell/waves", { credentials: "include" })
      .then(r => r.json()).then(d => setWaves(d.waves ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadRecords(search, offset, statusFilter, stageFilter, revealFilter, waveFilter, sortKey, sortDir);
  }, [offset, statusFilter, stageFilter, revealFilter, waveFilter]);

  // ── Lazy load sales when tab first activated ──────────────────────────────
  useEffect(() => {
    if (activeTab === "sales" && !salesLoadedRef.current) {
      salesLoadedRef.current = true;
      fetchSalesData(0, saleWave, saleWallet, saleFrom, saleTo);
    }
    if (activeTab === "fulfillment" && !fulfillLoadedRef.current) {
      fulfillLoadedRef.current = true;
      fetchFulfillData();
    }
  }, [activeTab]);

  // ── Re-fetch sales when filters change (only if tab already loaded) ───────
  useEffect(() => {
    if (!salesLoadedRef.current) return;
    setSalePage(0);
    fetchSalesData(0, saleWave, saleWallet, saleFrom, saleTo);
  }, [saleWave, saleWallet, saleFrom, saleTo]);

  // ── Records handlers ──────────────────────────────────────────────────────
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

  // ── Sales handlers ────────────────────────────────────────────────────────
  function goSalePage(p: number) {
    setSalePage(p);
    fetchSalesData(p, saleWave, saleWallet, saleFrom, saleTo);
  }

  async function exportSalesCsv() {
    const qs = new URLSearchParams({ limit: "9999", offset: "0" });
    if (saleWave)   qs.set("wave",   saleWave);
    if (saleWallet) qs.set("wallet", saleWallet);
    if (saleFrom)   qs.set("from",   saleFrom);
    if (saleTo)     qs.set("to",     saleTo);
    const res  = await fetch(`/api/nft-sell/admin-sales/history?${qs}`, { credentials: "include" });
    const json = await res.json();
    const rows: SaleRecord[] = json.records ?? [];
    const header = ["Serial #","Token ID","Wave","Wallet","Mint Price (ETH)","Rarity","Mint Tx Hash","Minted At","Last Sale (ETH)","Last Tx Hash","Sold At"];
    const lines  = [header.join(","), ...rows.map(r => [
      r.serial_number, r.token_id ?? "", r.wave_num ?? "", r.wallet ?? "",
      r.price_eth ?? "", r.rarity_tier ?? "", r.mint_tx_hash ?? "", r.minted_at ?? "",
      r.last_sale_price_eth ?? "", r.last_tx_hash ?? "", r.sold_at ?? "",
    ].join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "sales-history.csv"; a.click();
  }

  const saleTotalPages = Math.ceil(saleTotal / SALE_LIMIT);

  const waveName = (num: number | null) => {
    if (num == null) return "—";
    const w = waves.find(w => w.waveNumber === num);
    return w ? `W${num} — ${w.name}` : `Wave ${num}`;
  };

  // ── Fulfillment stage table columns ───────────────────────────────────────
  const fulfillStageColumns: ColumnDef<FulfillStageRow>[] = [
    {
      key: "stage",
      header: "Stage",
      sortKey: "stage",
      render: r => (
        <span className="font-semibold" style={{ color: "#24315f" }}>{r.stageName}</span>
      ),
    },
    {
      key: "total",
      header: "Total",
      sortKey: "total",
      align: "right",
      render: r => (
        <span className="font-bold" style={{ color: "#374151" }}>{Number(r.total).toLocaleString()}</span>
      ),
    },
    {
      key: "delivered",
      header: "Delivered",
      sortKey: "delivered",
      align: "right",
      render: r => (
        <span
          className="tabular-nums font-semibold"
          style={{
            color: "#16a34a",
            background: fulfillHighlight === "delivered" ? "rgba(22,163,74,0.08)" : "transparent",
            borderRadius: 6, padding: "2px 6px",
          }}
        >
          {Number(r.delivered).toLocaleString()}
        </span>
      ),
    },
    {
      key: "pending",
      header: "Pending",
      sortKey: "pending",
      align: "right",
      render: r => (
        <span
          className="tabular-nums font-semibold"
          style={{
            color: "#d97706",
            background: fulfillHighlight === "pending" ? "rgba(217,119,6,0.08)" : "transparent",
            borderRadius: 6, padding: "2px 6px",
          }}
        >
          {Number(r.pending).toLocaleString()}
        </span>
      ),
    },
    {
      key: "cancelled",
      header: "Cancelled",
      sortKey: "cancelled",
      align: "right",
      render: r => (
        <span
          className="tabular-nums font-semibold"
          style={{
            color: "#dc2626",
            background: fulfillHighlight === "cancelled" ? "rgba(220,38,38,0.08)" : "transparent",
            borderRadius: 6, padding: "2px 6px",
          }}
        >
          {Number(r.cancelled).toLocaleString()}
        </span>
      ),
    },
    {
      key: "pct",
      header: "% Delivered",
      sortKey: "pct",
      render: r => {
        const p = fulfillPct(Number(r.delivered), Number(r.total));
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#f3f4f6", minWidth: 60 }}>
              <div className="h-full rounded-full" style={{ width: `${p}%`, background: "#16a34a" }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>{p}%</span>
          </div>
        );
      },
    },
  ];

  // ── Records columns ───────────────────────────────────────────────────────
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
        {activeTab === "records" ? (
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
        ) : activeTab === "sales" ? (
          <button onClick={exportSalesCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        ) : null}
      </div>

      {/* ── Tab Bar ── */}
      <div style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div className="flex gap-1">
          {(["records", "sales", "fulfillment", "otc", "bulk", "gifts", "auctions", "seasons", "events", "burn"] as const).map(tab => {
            const LABELS: Record<string, string> = { records: "Records", sales: "Sales History", fulfillment: "Fulfillment", otc: "OTC Deals", bulk: "Bulk Ops", gifts: "Gifts", auctions: "Auctions", seasons: "Season Passes", events: "Events", burn: "Burn to Mint" };
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
      {activeTab === "records" && (
        <>
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
                <option key={w.waveNumber} value={String(w.waveNumber)}>
                  W{w.waveNumber} — {w.name}
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
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* SALES HISTORY TAB                                                     */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "sales" && (
        <>
          {/* Summary cards */}
          {saleSummary.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {saleSummary.map(s => (
                <div key={s.wave} className="bg-white rounded-xl shadow-sm"
                  style={{ border: "1px solid #e5e7eb", borderLeft: "3px solid #41afeb", padding: "14px 16px" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#9bafc5" }}>
                    {waveName(s.wave === "—" ? null : Number(s.wave))}
                  </p>
                  <p className="text-2xl font-extrabold leading-none" style={{ color: "#24315f" }}>
                    {Number(s.total_minted).toLocaleString()}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>
                    minted · {s.total_eth ? Number(s.total_eth).toFixed(4) : "0"} ETH
                  </p>
                  {Number(s.total_sold) > 0 && (
                    <p className="text-xs mt-0.5" style={{ color: "#16a34a" }}>
                      {s.total_sold} sold · {s.total_sale_eth ? Number(s.total_sale_eth).toFixed(4) : "0"} ETH
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={saleWave} onChange={e => setSaleWave(e.target.value)}
              className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
              style={{ border: "1px solid #e5e7eb", color: saleWave ? "#111827" : "#9bafc5" }}>
              <option value="">All Waves</option>
              {waves.map(w => (
                <option key={w.waveNumber} value={String(w.waveNumber)}>
                  W{w.waveNumber} — {w.name}
                </option>
              ))}
            </select>

            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input placeholder="Search wallet 0x..." value={saleWallet} onChange={e => setSaleWallet(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl text-sm bg-white outline-none"
                style={{ border: "1px solid #e5e7eb", color: "#111827", width: 220 }} />
            </div>

            <input type="date" value={saleFrom} onChange={e => setSaleFrom(e.target.value)}
              className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
              style={{ border: "1px solid #e5e7eb", color: saleFrom ? "#111827" : "#9bafc5" }} />
            <input type="date" value={saleTo} onChange={e => setSaleTo(e.target.value)}
              className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
              style={{ border: "1px solid #e5e7eb", color: saleTo ? "#111827" : "#9bafc5" }} />

            {(saleWave || saleWallet || saleFrom || saleTo) && (
              <button onClick={() => { setSaleWave(""); setSaleWallet(""); setSaleFrom(""); setSaleTo(""); }}
                className="px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                Clear filters
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                    {["NFT","Serial #","Wave","Wallet","Mint Price","Rarity","Mint Tx Hash","Minted At","Last Sale","Last Tx","Sold At"].map(h => (
                      <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#9bafc5", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap", background: "#fafafa" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {saleLoading ? (
                    <tr><td colSpan={11} style={{ textAlign: "center", padding: 48, color: "#9bafc5" }}>Loading…</td></tr>
                  ) : saleRecords.length === 0 ? (
                    <tr><td colSpan={11} style={{ textAlign: "center", padding: 64 }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
                      <div style={{ fontWeight: 700, color: "#24315f", marginBottom: 4 }}>No sales yet</div>
                      <div style={{ fontSize: 12, color: "#9bafc5" }}>Records will appear here once NFTs are minted on-chain</div>
                    </td></tr>
                  ) : saleRecords.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f9fafb" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      {/* NFT image */}
                      <td style={{ padding: "10px 14px" }}>
                        {r.image_ipfs_hash ? (
                          <img src={`${IPFS_GATEWAY}/${r.image_ipfs_hash}`} alt={r.serial_number}
                            style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", display: "block" }} />
                        ) : (
                          <div style={{ width: 44, height: 44, borderRadius: 8, background: "#f3f4f6", border: "1.5px dashed #d1d5db" }} />
                        )}
                      </td>
                      {/* Serial */}
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <div className="font-mono font-bold text-sm" style={{ color: "#24315f" }}>{r.serial_number}</div>
                        {r.token_id != null && <div style={{ fontSize: 11, color: "#9bafc5", marginTop: 2 }}>Token #{r.token_id}</div>}
                      </td>
                      {/* Wave */}
                      <td style={{ padding: "10px 14px" }}>
                        {r.wave_num != null ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb", whiteSpace: "nowrap" }}>
                            {waveName(r.wave_num)}
                          </span>
                        ) : <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      {/* Wallet */}
                      <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>
                        {r.wallet ? (
                          <a href={`https://etherscan.io/address/${r.wallet}`} target="_blank" rel="noreferrer"
                            style={{ color: "#41afeb", textDecoration: "none" }} title={r.wallet}>
                            {shortAddr(r.wallet)}
                          </a>
                        ) : <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      {/* Mint price */}
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        {r.price_eth
                          ? <span className="font-bold text-xs" style={{ color: "#24315f" }}>{Number(r.price_eth).toFixed(4)} ETH</span>
                          : <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>Free</span>}
                      </td>
                      {/* Rarity */}
                      <td style={{ padding: "10px 14px" }}>
                        {r.rarity_tier ? (
                          <span style={{ color: TIER_COLORS[r.rarity_tier] ?? "#6b7280", fontWeight: 700, fontSize: 12 }}>
                            ● {r.rarity_tier}
                          </span>
                        ) : <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      {/* Mint tx */}
                      <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>
                        {r.mint_tx_hash ? (
                          <a href={`${ETHERSCAN}${r.mint_tx_hash}`} target="_blank" rel="noreferrer"
                            style={{ color: "#7c3aed", textDecoration: "none" }} title={r.mint_tx_hash}>
                            {shortHash(r.mint_tx_hash)}
                          </a>
                        ) : <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      {/* Minted at */}
                      <td style={{ padding: "10px 14px", color: "#6b7280", whiteSpace: "nowrap", fontSize: 12 }}>{fmtDate(r.minted_at)}</td>
                      {/* Last sale */}
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        {r.last_sale_price_eth
                          ? <span className="text-xs font-bold" style={{ color: "#16a34a" }}>{Number(r.last_sale_price_eth).toFixed(4)} ETH</span>
                          : <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      {/* Last tx */}
                      <td style={{ padding: "10px 14px", fontFamily: "monospace" }}>
                        {r.last_tx_hash ? (
                          <a href={`${ETHERSCAN}${r.last_tx_hash}`} target="_blank" rel="noreferrer"
                            style={{ color: "#7c3aed", textDecoration: "none" }} title={r.last_tx_hash}>
                            {shortHash(r.last_tx_hash)}
                          </a>
                        ) : <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      {/* Sold at */}
                      <td style={{ padding: "10px 14px", color: "#6b7280", whiteSpace: "nowrap", fontSize: 12 }}>{fmtDate(r.sold_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {saleTotalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid #f3f4f6" }}>
                <span style={{ fontSize: 13, color: "#9bafc5" }}>
                  Showing {salePage * SALE_LIMIT + 1}–{Math.min((salePage + 1) * SALE_LIMIT, saleTotal)} of {saleTotal.toLocaleString()} records
                </span>
                <div className="flex gap-2">
                  <button disabled={salePage === 0} onClick={() => goSalePage(salePage - 1)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white"
                    style={{ border: "1px solid #e5e7eb", color: salePage === 0 ? "#d1d5db" : "#374151", cursor: salePage === 0 ? "default" : "pointer" }}>
                    ← Prev
                  </button>
                  <span style={{ padding: "6px 10px", fontSize: 12, color: "#9bafc5" }}>{salePage + 1} / {saleTotalPages}</span>
                  <button disabled={salePage >= saleTotalPages - 1} onClick={() => goSalePage(salePage + 1)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white"
                    style={{ border: "1px solid #e5e7eb", color: salePage >= saleTotalPages - 1 ? "#d1d5db" : "#374151", cursor: salePage >= saleTotalPages - 1 ? "default" : "pointer" }}>
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* FULFILLMENT TAB                                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "fulfillment" && (
        <>
          {fulfillErr ? (
            <div className="p-4 rounded-xl text-sm" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
              {fulfillErr}
            </div>
          ) : (
            <>
              {/* ── Stat Cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: "Total NFTs",
                    value: grandTotal,
                    color: "#24315f",
                    key: "" as const,
                  },
                  {
                    label: "Delivered",
                    value: grandDelivered,
                    color: "#16a34a",
                    key: "delivered" as const,
                  },
                  {
                    label: "Pending",
                    value: grandPending,
                    color: "#d97706",
                    key: "pending" as const,
                  },
                  {
                    label: "Cancelled",
                    value: grandCancelled,
                    color: "#dc2626",
                    key: "cancelled" as const,
                  },
                ].map(card => {
                  const isHighlighted = fulfillHighlight === card.key;
                  return (
                    <button
                      key={card.label}
                      onClick={() => setFulfillHighlight(isHighlighted ? "" : card.key)}
                      className="text-left bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow select-none"
                      style={{
                        border: `1px solid ${isHighlighted ? card.color : "#e5e7eb"}`,
                        borderLeft: `3px solid ${card.color}`,
                        padding: "14px 16px",
                        cursor: card.key ? "pointer" : "default",
                        outline: "none",
                        boxShadow: isHighlighted ? `0 0 0 2px ${card.color}22` : undefined,
                      }}
                      title={card.key ? `Highlight ${card.label} column` : undefined}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#9bafc5" }}>{card.label}</p>
                      <p className="text-2xl font-extrabold leading-none" style={{ color: card.color }}>
                        {fulfillLoading ? "—" : card.value.toLocaleString()}
                      </p>
                      {card.key && (
                        <p className="text-[10px] mt-1.5" style={{ color: "#9bafc5" }}>
                          {isHighlighted ? "Click to clear highlight" : "Click to highlight column"}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── Stage Breakdown ── */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "#9bafc5" }}>Stage Breakdown</p>
                  {fulfillHighlight && (
                    <button
                      onClick={() => setFulfillHighlight("")}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: "#f3f4f6", color: "#6b7280", border: "1px solid #e5e7eb" }}
                    >
                      Clear highlight
                    </button>
                  )}
                </div>
                <DataTable
                  columns={fulfillStageColumns}
                  data={fulfillStagePage}
                  total={fulfillSortedStages.length}
                  offset={fulfillStageOff}
                  pageSize={FULFILL_STAGE_PAGE}
                  onPageChange={setFulfillStageOff}
                  loading={fulfillLoading}
                  emptyText="No stage data available"
                  keyExtractor={r => r.stageId}
                  sortKey={fulfillSortKey}
                  sortDir={fulfillSortDir}
                  onSort={(key, dir) => { setFulfillSortKey(key); setFulfillSortDir(dir); setFulfillStageOff(0); }}
                />
              </div>
            </>
          )}
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
