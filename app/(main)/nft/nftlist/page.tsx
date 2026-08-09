"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useInterval } from "@/lib/useInterval";
import DataTable, { type ColumnDef } from "@/components/DataTable";
import { ErrBanner } from "@/components/nft/Banner";
import OtcTab from "@/components/nft/tabs/OtcTab";
import BulkTab from "@/components/nft/tabs/BulkTab";
import GiftsTab from "@/components/nft/tabs/GiftsTab";
import AuctionsTab from "@/components/nft/tabs/AuctionsTab";
import SeasonsTab from "@/components/nft/tabs/SeasonsTab";
import EventsTab from "@/components/nft/tabs/EventsTab";
import BurnTab from "@/components/nft/tabs/BurnTab";
import NftImage from "@/components/nft/NftImage";
import WatchdogBanner from "@/components/nft/shared/WatchdogBanner";
import TestnetResetConfirm from "./components/TestnetResetConfirm";
import WaveRevealPanel from "./components/WaveRevealPanel";
import NftFiltersRow from "./components/NftFiltersRow";
import NftHistoryModal from "./components/NftHistoryModal";
import { fmtDatetime as fmt, TIER_COLORS } from "@/lib/nft-utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

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
  mintType: string | null;
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
  waveStartingIndex: number | null;
  priceEth: number | null;
  effectivePriceEth: number | null;
  rarityTier: string | null;
  rarityScore: number | null;
  rarityRank: number | null;
  lastSalePriceEth: number | null;
  waveRevealTxHash: string | null;
  tokenSbt: boolean;
}

interface Master {
  nftStages: Array<{ id: string; name: string; code: string }>;
  nftTypes: Array<{ id: string; name: string; code: string }>;
  deliveryStatuses: Array<{ id: string; name: string; code: string }>;
}

interface WaveOption {
  waveNumber: number;
  name: string;
  onChain: { soldCount: number; closed: boolean; revealed: boolean } | null;
}

function artworkId(r: NftRecord): number | null {
  if (!r.isRevealed || r.tokenId == null || r.waveQuantity == null || r.waveStartingIndex == null)
    return null;
  return ((r.tokenId - 1 + r.waveStartingIndex) % r.waveQuantity) + 1;
}
function StatusBadge({ code, name }: { code: string; name: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    delivered: { bg: "rgba(22,163,74,0.1)", color: "#16a34a" },
    sold: { bg: "rgba(124,58,237,0.1)", color: "#7c3aed" },
    pending: { bg: "rgba(7, 4, 1, 0.1)", color: "#d97706" },
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
  const [activeTab, setActiveTab] = useState<"nftlist" | "otc" | "bulk" | "gifts" | "auctions" | "seasons" | "events" | "burn">("nftlist");

  // ── Records tab state ─────────────────────────────────────────────────────
  const [records, setRecords] = useState<NftRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAll, setTotalAll] = useState(0);
  const [preMintCount, setPreMintCount] = useState(0);
  const [reservedCount, setReservedCount] = useState(0);
  const [treasuryWalletCount, setTreasuryWalletCount] = useState(0);
  const [blindCount, setBlindCount] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [mintedCount, setMintedCount] = useState(0);
  const [soldCount, setSoldCount] = useState(0);
  const [deliveredCount, setDeliveredCount] = useState(0);
  const [customerWalletCount, setCustomerWalletCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [revealFilter, setRevealFilter] = useState("");
  const [waveFilter, setWaveFilter] = useState("");
  const [mintTypeFilter, setMintTypeFilter] = useState("");
  const [rarityTierFilter, setRarityTierFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [master, setMaster] = useState<Master | null>(null);
  const [sortKey, setSortKey] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewRecord, setViewRecord] = useState<NftRecord | null>(null);
  const [modalMaximized, setModalMaximized] = useState(false);
  const [waves, setWaves] = useState<WaveOption[]>([]);
  const [blindBoxImageUrl, setBlindBoxImageUrl] = useState<string | null>(null);
  const [traitStats, setTraitStats] = useState<{ total: number; stats: Record<string, Record<string, number>> } | null>(null);

  const [mintedFrom, setMintedFrom] = useState("");
  const [mintedTo, setMintedTo] = useState("");

  // ── Per-NFT reveal + transfer state ───────────────────────────────────────
  const [revealUri, setRevealUri] = useState("");
  const [revealing, setRevealing] = useState(false);
  const [revealMsg, setRevealMsg] = useState<string | null>(null);

  // ── Per-token SBT state ───────────────────────────────────────────────────
  const [sbtBusy, setSbtBusy] = useState(false);
  const [sbtMsg, setSbtMsg] = useState<string | null>(null);
  const [sbtRowBusy, setSbtRowBusy] = useState<string | null>(null); // record id being toggled inline

  // ── Table row: treasury move busy state ──────────────────────────────────

  // ── Modal lifecycle-action state ──────────────────────────────────────────
  const [modalMintMoveRecip, setModalMintMoveRecip] = useState("");   // State 1
  const [modalMintMoveBusy, setModalMintMoveBusy] = useState(false);
  const [modalMintMoveMsg, setModalMintMoveMsg] = useState<string | null>(null);

  // ── Testnet reset state ───────────────────────────────────────────────────
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);
  const isTestnet = process.env.NEXT_PUBLIC_NETWORK !== "mainnet";

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Records data loading ─────────────────────────────────────────────────
  const loadRecords = useCallback((
    q: string, off: number, status: string, stage: string, revealed: string, wave: string,
    sk?: string, sd?: "asc" | "desc",
    mFrom?: string, mTo?: string, mintType?: string, rarityTier?: string,
  ) => {
    console.group("[NftPage] loadRecords");
    console.log("q:", q, "off:", off, "wave:", wave, "status:", status, "revealed:", revealed);
    setLoading(true); setError(null);
    const params = new URLSearchParams({ search: q, limit: String(PAGE_SIZE), offset: String(off) });
    if (status) params.set("delivery_status", status);
    if (stage) params.set("stage", stage);
    if (revealed === "pre_mint") {
      params.set("delivery_status", "pending");
    } else if (revealed === "reserved") {
      params.set("delivery_status", "treasury_pending");
    } else if (revealed === "minted") {
      params.set("minted", "true");
    } else if (revealed === "revealed") {
      params.set("delivery_status", "revealed");
    } else if (revealed === "treasury_wallet") {
      params.set("delivery_status", "treasury_wallet");
    }
    if (wave) params.set("wave_number", wave);
    if (mFrom) params.set("minted_from", mFrom);
    if (mTo) params.set("minted_to", mTo);
    if (mintType) params.set("mint_type", mintType);
    if (rarityTier) {
      params.set("rarity_tier", rarityTier);
    }
    if (sk) params.set("sort_by", sk);
    if (sk && sd) params.set("sort_dir", sd);
    fetch(`/api/nfts?${params}`, { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        setRecords(data.nftRecords ?? []);
        setTotal(data.total ?? 0);
        setTotalAll(data.totalAll ?? 0);
        setPreMintCount(data.preMintCount ?? 0);
        setReservedCount(data.reservedCount ?? 0);
        setTreasuryWalletCount(data.treasuryWalletCount ?? 0);
        setBlindCount(data.blindCount ?? 0);
        setRevealedCount(data.revealedCount ?? 0);
        setMintedCount(data.mintedCount ?? 0);
        setSoldCount(data.soldCount ?? 0);
        setDeliveredCount(data.deliveredCount ?? 0);
        setCustomerWalletCount(data.customerWalletCount ?? 0);
        setLoading(false);
        console.log("records loaded:", data.nftRecords?.length ?? 0);
        console.groupEnd();
      })
      .catch(() => { setError("Unable to load NFT records. Please try again."); setLoading(false); console.groupEnd(); });
  }, []);

  const handleTestnetReset = useCallback(async () => {
    setResetting(true); setResetMsg(null);
    try {
      const res = await fetch("/api/nfts/testnet-reset", { method: "POST", credentials: "include" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Reset failed");
      setResetMsg(d.message ?? "Reset complete.");
      setStatusFilter(""); setRevealFilter(""); setWaveFilter(""); setStageFilter("");
      setMintedFrom(""); setMintedTo(""); setMintTypeFilter(""); setRarityTierFilter(""); setOffset(0);
      loadRecords("", 0, "", "", "", "", undefined, "asc", "", "", "", "");
    } catch (e) {
      setResetMsg(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(false); setShowResetConfirm(false);
    }
  }, [loadRecords]);

  // ── Initial loads ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/master", { credentials: "include" })
      .then(r => r.json()).then(d => setMaster(d)).catch(() => { });
    fetch("/api/nft-sell/waves", { credentials: "include" })
      .then(r => r.json()).then(d => setWaves(d.waves ?? [])).catch(() => { });
    fetch("/api/nft-sell/collection/stats", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.blindBoxImageUrl) setBlindBoxImageUrl(d.blindBoxImageUrl); })
      .catch(() => { });
  }, []);

  useEffect(() => {
    loadRecords(search, offset, statusFilter, stageFilter, revealFilter, waveFilter, sortKey, sortDir, mintedFrom, mintedTo, mintTypeFilter, rarityTierFilter);
  }, [offset, statusFilter, stageFilter, revealFilter, waveFilter, mintTypeFilter, rarityTierFilter]);

  // ── Watchdog: silent 30s poll on stats ───────────────────────────────────
  const [recWatchAlert, setRecWatchAlert] = useState<string | null>(null);
  const [recWatchUpdated, setRecWatchUpdated] = useState<Date | null>(null);
  const prevRecMintedRef = useRef<number | null>(null);

  const silentRecPoll = useCallback(async () => {
    try {
      const res = await fetch("/api/nft-sell/collection/stats", { credentials: "include" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setSbtMsg(d.error ?? "SBT update failed"); return; }
      const d = await res.json();
      setRecWatchUpdated(new Date());
      if (d.blindBoxImageUrl) setBlindBoxImageUrl(d.blindBoxImageUrl);
      if (prevRecMintedRef.current !== null && d.totalMinted > prevRecMintedRef.current) {
        setRecWatchAlert(`${d.totalMinted - prevRecMintedRef.current} new NFT${d.totalMinted - prevRecMintedRef.current > 1 ? "s" : ""} minted on-chain. Refresh records to see latest.`);
      }
      prevRecMintedRef.current = d.totalMinted ?? prevRecMintedRef.current;
    } catch { setSbtMsg("Network error"); }
  }, []);

  useInterval(silentRecPoll, 30_000);

  // ── Records handlers ──────────────────────────────────────────────────────
  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setOffset(0);
      loadRecords(v, 0, statusFilter, stageFilter, revealFilter, waveFilter, sortKey, sortDir, mintedFrom, mintedTo, mintTypeFilter, rarityTierFilter);
    }, 300);
  };

  const applyFilter = (status = statusFilter, stage = stageFilter, revealed = revealFilter, wave = waveFilter, mFrom = mintedFrom, mTo = mintedTo, mintType = mintTypeFilter, rarityTier = rarityTierFilter) => {
    setOffset(0);
    loadRecords(search, 0, status, stage, revealed, wave, sortKey, sortDir, mFrom, mTo, mintType, rarityTier);
  };

  const handleSort = (key: string, dir: "asc" | "desc") => {
    setSortKey(key); setSortDir(dir); setOffset(0);
    loadRecords(search, 0, statusFilter, stageFilter, revealFilter, waveFilter, key, dir, mintedFrom, mintedTo, mintTypeFilter, rarityTierFilter);
  };

  // ── Computed: wave reveal panel ───────────────────────────────────────────
  const activeWave = waveFilter ? waves.find(w => String(w.waveNumber) === waveFilter) : null;
  const showRevealPanel = !!activeWave?.onChain?.closed && !activeWave?.onChain?.revealed && (activeWave?.onChain?.soldCount ?? 0) > 0;

  // ── Per-NFT reveal handler ────────────────────────────────────────────────
  const handleRevealWave = async () => {
    if (!revealUri.startsWith("ipfs://")) { setRevealMsg("URI must start with ipfs://"); return; }
    setRevealing(true); setRevealMsg(null);
    try {
      const res = await fetch(`/api/nft-sell/waves/${waveFilter}/reveal`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri: revealUri }),
      });
      const d = await res.json();
      if (!res.ok) { setRevealMsg(d.error ?? "Reveal failed"); return; }
      setRevealMsg(`Wave ${waveFilter} revealed! Tx: ${String(d.txHash).slice(0, 12)}…`);
      fetch("/api/nft-sell/waves", { credentials: "include" })
        .then(r => r.json()).then(d2 => setWaves(d2.waves ?? [])).catch(() => { });
      loadRecords(search, offset, statusFilter, stageFilter, revealFilter, waveFilter, sortKey, sortDir, mintedFrom, mintedTo, mintTypeFilter);
    } catch { setRevealMsg("Network error during reveal"); }
    finally { setRevealing(false); }
  };

  // ── Per-token SBT toggle ─────────────────────────────────────────────────
  const handleToggleSbt = async (record: NftRecord, enable: boolean) => {
    console.group("[NftPage] handleToggleSbt");
    console.log("tokenId:", record.tokenId, "enable:", enable);
    setSbtBusy(true); setSbtMsg(null);
    try {
      const res = await fetch(`/api/nfts/${record.id}/sbt`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: enable }),
      });
      const d = await res.json();
      if (!res.ok) { setSbtMsg(d.error ?? "SBT update failed"); console.groupEnd(); return; }
      setSbtMsg(`SBT ${enable ? "enabled" : "disabled"} — Tx: ${String(d.txHash).slice(0, 12)}…`);
      loadRecords(search, offset, statusFilter, stageFilter, revealFilter, waveFilter, sortKey, sortDir, mintedFrom, mintedTo, mintTypeFilter);
      setViewRecord(r => r ? { ...r, tokenSbt: enable } : null);
    } catch { setSbtMsg("Network error"); }
    finally { setSbtBusy(false); console.groupEnd(); }
  };

  // ── Inline table SBT toggle (no modal required) ──────────────────────────
  const handleTableSbt = async (record: NftRecord, enable: boolean) => {
    console.group("[NftPage] handleTableSbt");
    console.log("tokenId:", record.tokenId, "enable:", enable);
    setSbtRowBusy(record.id);
    try {
      const res = await fetch(`/api/nfts/${record.id}/sbt`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: enable }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setSbtMsg(d.error ?? "SBT update failed"); console.groupEnd(); return; }
      loadRecords(search, offset, statusFilter, stageFilter, revealFilter, waveFilter, sortKey, sortDir, mintedFrom, mintedTo, mintTypeFilter, rarityTierFilter);
    } catch { setSbtMsg("Network error"); }
    finally { setSbtRowBusy(null); console.groupEnd(); }
  };


  // ── Open modal with clean state (shared by row click + action buttons) ──
  const openModal = useCallback((r: NftRecord) => {
    console.group("[NftPage] openModal");
    console.log("id:", r.id, "serial:", r.serialNumber, "revealed:", r.isRevealed);
    setViewRecord(r); setModalMaximized(false); setTraitStats(null);
    setModalMintMoveRecip(""); setModalMintMoveMsg(null);
    if (r.isRevealed && r.traits && Object.keys(r.traits).length > 0) {
      fetch("/api/nfts/trait-stats", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traits: r.traits }),
      }).then(res => res.ok ? res.json() : null).then(data => { if (data) setTraitStats(data); }).catch(() => null);
    }
    console.groupEnd();
  }, []);

  // ── Modal: State 1 — Mint all reserved in wave + transfer to recipient ──
  const handleModalMintMove = async () => {
    if (!viewRecord || viewRecord.waveNumber == null) return;
    const recip = modalMintMoveRecip.trim() || null;
    if (recip && !/^0x[0-9a-fA-F]{40}$/.test(recip)) {
      setModalMintMoveMsg("Enter a valid 0x address or leave blank for treasury wallet"); return;
    }
    console.group("[NftPage] handleModalMintMove");
    console.log("record.id:", viewRecord.id, "recipient:", recip);
    setModalMintMoveBusy(true); setModalMintMoveMsg(null);
    try {
      const res = await fetch(`/api/nfts/${viewRecord.id}/treasury-move`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: recip }),
      });
      const d = await res.json();
      if (!res.ok) { setModalMintMoveMsg(d.error ?? "Operation failed"); console.groupEnd(); return; }
      setModalMintMoveMsg(`Done! Tx: ${String(d.txHash).slice(0, 12)}…`);
      setModalMintMoveRecip("");
      setTimeout(() => setViewRecord(null), 1500);
      loadRecords(search, offset, statusFilter, stageFilter, revealFilter, waveFilter, sortKey, sortDir, mintedFrom, mintedTo, mintTypeFilter, rarityTierFilter);
    } catch { setModalMintMoveMsg("Network error"); }
    finally { setModalMintMoveBusy(false); console.groupEnd(); }
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
            {r.isRevealed && r.tokenId != null ? (
              <>
                <div className="font-mono font-bold text-sm leading-tight" style={{ color: "#0f172a" }}>
                  Token ID #{r.tokenId}
                </div>
                {artworkId(r) != null && (
                  <div className="text-xs mt-0.5 font-semibold" style={{ color: "#7c3aed" }}>
                    ✦ Artwork ID #{artworkId(r)}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="font-mono font-bold text-sm leading-tight" style={{ color: "#0f172a" }}>{r.serialNumber}</div>
                <div className="text-xs mt-0.5" style={{ color: r.tokenId != null ? "#64748b" : "#cbd5e1" }}>
                  {r.tokenId != null ? `Token ID #${r.tokenId}` : "Not minted"}
                </div>
              </>
            )}
            {r.tokenSbt && (
              <div className="mt-0.5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: "#fef2f2", color: "#dc2626" }}>
                  🔒 Soulbound
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
        const end = r.waveScheduledEnd;
        if (!start && !end) return <span className="text-xs" style={{ color: "#d1d5db" }}>Not set</span>;
        return (
          <div className="text-xs space-y-0.5" style={{ minWidth: 130 }}>
            {start && <div style={{ color: "#64748b" }}><span style={{ color: "#94a3b8" }}>From </span><strong style={{ color: "#374151" }}>{fmt(start)}</strong></div>}
            {end && <div style={{ color: "#64748b" }}><span style={{ color: "#94a3b8" }}>To </span><strong style={{ color: "#374151" }}>{fmt(end)}</strong></div>}
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
        if (code === "sold") return <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#fef9c3", color: "#a16207" }}>💰 Sold</span>;
        if (code === "treasury_pending") return <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>◈ Reserved</span>;
        if (code === "treasury_wallet" || code === "transferred") return <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#ecfeff", color: "#0e7490", border: "1px solid #a5f3fc" }}>🏛 Treasury Wallet</span>;
        if (r.isRevealed) return <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#f5f3ff", color: "#7c3aed" }}>✦ Revealed</span>;
        if (r.tokenId != null) return <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#eff6ff", color: "#2563eb" }}>⬡ Minted</span>;
        // Unminted NFT with a reveal scheduled = wave closed, NFT is unsold → Reserved
        if (r.tokenId == null && r.waveRevealScheduledAt != null) return <span className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>◈ Reserved</span>;
        return <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#f8fafc", color: "#94a3b8", border: "1px solid #e2e8f0" }}>○ Pre-mint</span>;
      },
    },
    {
      key: "rarity_tier",
      header: "Tier",
      render: r => {
        if (!r.isRevealed) return <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>;
        const tier = r.rarityTier ? r.rarityTier.charAt(0).toUpperCase() + r.rarityTier.slice(1) : null;
        const tierColor = tier ? (TIER_COLORS[tier] ?? "#6b7280") : "#6b7280";
        return tier
          ? <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
            style={{ background: tierColor + "20", color: tierColor }}>● {tier}</span>
          : <span className="text-[10px]" style={{ color: "#d1d5db" }}>—</span>;
      },
    },
    {
      key: "rarity_score",
      header: "Score",
      sortKey: "rarity_score",
      align: "right",
      render: r => {
        if (!r.isRevealed) return <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>;
        const tier = r.rarityTier ? r.rarityTier.charAt(0).toUpperCase() + r.rarityTier.slice(1) : null;
        const tierColor = tier ? (TIER_COLORS[tier] ?? "#6b7280") : "#6b7280";
        return r.rarityScore != null
          ? <span className="text-xs font-semibold" style={{ color: tierColor }}>{Number(r.rarityScore).toFixed(2)}</span>
          : <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>;
      },
    },
    {
      key: "rarity_rank",
      header: "Rank",
      sortKey: "rarity_rank",
      align: "right",
      render: r => {
        if (!r.isRevealed) return <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>;
        return r.rarityRank != null
          ? <span className="text-xs font-bold" style={{ color: "#475569" }}>#{r.rarityRank}</span>
          : <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>;
      },
    },
    {
      key: "sbt",
      header: "SBT",
      align: "center",
      render: r => {
        // Only minted tokens can have SBT toggled
        if (r.tokenId == null) return <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>;
        const busy = sbtRowBusy === r.id;
        if (r.tokenSbt) {
          return (
            <button
              disabled={busy}
              onClick={e => { e.stopPropagation(); handleTableSbt(r, false); }}
              title="Remove Soulbound"
              className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md disabled:opacity-40 whitespace-nowrap"
              style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", cursor: "pointer", letterSpacing: "0.01em" }}>
              {busy ? "…" : "🔒 Soulbound"}
            </button>
          );
        }
        return (
          <button
            disabled={busy}
            onClick={e => { e.stopPropagation(); handleTableSbt(r, true); }}
            title="Set Soulbound"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md disabled:opacity-40 whitespace-nowrap"
            style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", cursor: "pointer", letterSpacing: "0.01em" }}>
            {busy ? "…" : "🔓 Set Soulbound"}
          </button>
        );
      },
    },
    {
      key: "reveal_date",
      header: "Reveal",
      render: r => {
        // Unminted NFTs have no per-token reveal — reveal happens via Mint & Move flow
        if (r.tokenId == null) return <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>;
        if (r.isRevealed && r.revealedAt) return (
          <div>
            <div className="text-xs font-semibold" style={{ color: "#7c3aed" }}>Revealed</div>
            <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>{fmt(r.revealedAt)}</div>
          </div>
        );
        if (r.waveRevealScheduledAt) {
          return (
            <div>
              <div className="text-xs font-semibold" style={{ color: "#6366f1" }}>Scheduled</div>
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
        if (r.waveNumber == null) return <span className="text-sm" style={{ color: "#d1d5db" }}>—</span>;
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
        const isReserved = r.deliveryStatusCode === "treasury_pending" || (r.tokenId == null && r.waveRevealScheduledAt != null);
        const latest =
          r.deliveredAt && (r.deliveryStatusCode === "treasury_wallet" || r.deliveryStatusCode === "transferred") ? { label: "Treasury Wallet", date: r.deliveredAt, color: "#0e7490" } :
          r.deliveredAt ? { label: "Delivered", date: r.deliveredAt, color: "#15803d" } :
            r.soldAt ? { label: "Sold", date: r.soldAt, color: "#a16207" } :
              r.revealedAt ? { label: "Revealed", date: r.revealedAt, color: "#7c3aed" } :
                r.mintedAt ? { label: "Minted", date: r.mintedAt, color: "#2563eb" } :
                  isReserved ? { label: "Reserved", date: r.waveRevealScheduledAt, color: "#b45309" } :
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
      key: "lifecycle_action",
      header: "Action",
      align: "center",
      render: r => {
        // Only reserved unminted non-customer NFTs get an action — single-click Mint & Move
        if (r.tokenId == null && r.deliveryStatusCode === "treasury_pending" && r.mintType !== "free" && r.mintType !== "paid") {
          return (
            <button
              onClick={e => { e.stopPropagation(); openModal(r); }}
              title="Mint &amp; Move to Treasury / Custom Wallet"
              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
              style={{ background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe", cursor: "pointer" }}>
              ⬡ Mint &amp; Move
            </button>
          );
        }
        return <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>;
      },
    },
    {
      key: "actions",
      header: "",
      align: "center",
      width: 80,
      render: r => (
        <button onClick={() => openModal(r)} title="View full history"
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
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>NFT Lists</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            Full lifecycle report — generation, wave assignment, minting, reveal, sale, and delivery
          </p>
        </div>
        {/* Per-tab actions */}
        {activeTab === "nftlist" && (
          <div className="flex items-center gap-2">
            {/* Testnet-only reset — blocked on mainnet */}
            {isTestnet && (
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={resetting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
                title="Reset all 9,999 records to pre-mint state (testnet only)">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {resetting ? "Resetting…" : "Reset DB"}
              </button>
            )}
            <button onClick={() => {
              const headers = ["NFT #", "Token ID", "Artwork ID", "Wave", "Wave Start", "Wave End", "Reveal Date", "Minted At", "Revealed At", "Sold At", "Delivered At", "Status", "Price (ETH)", "Owner"];
              const rows = records.map(r => [
                r.serialNumber, r.tokenId ?? "", artworkId(r) != null ? `#${artworkId(r)}` : "", r.waveNumber ? `W${r.waveNumber}` : "",
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
        )}
      </div>

      {/* ── Reset result banner ── */}
      {resetMsg && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl text-sm"
          style={{ background: resetMsg.includes("complete") ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)", border: `1px solid ${resetMsg.includes("complete") ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)"}`, color: resetMsg.includes("complete") ? "#16a34a" : "#dc2626" }}>
          <span>{resetMsg}</span>
          <button onClick={() => setResetMsg(null)} className="ml-4 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ── Testnet reset confirmation dialog ── */}
      {showResetConfirm && (
        <TestnetResetConfirm
          onConfirm={handleTestnetReset}
          onCancel={() => setShowResetConfirm(false)}
          resetting={resetting}
        />
      )}

      {/* ── Tab Bar ── */}
      <div className="ba-tabs" style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div className="flex gap-1">
          {(["nftlist", "otc", "bulk", "gifts", "auctions", "seasons", "events", "burn"] as const).map(tab => {
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
      <WatchdogBanner alert={recWatchAlert} onDismiss={() => setRecWatchAlert(null)} updatedAt={recWatchUpdated} />

      {activeTab === "nftlist" && (
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
                label: "Pre-mint", value: preMintCount, color: "#64748b", bg: "#f8fafc", pct: totalAll ? Math.round(preMintCount / totalAll * 100) : 0,
                sub: "Blind box · awaiting mint",
                icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
                filter: () => { setRevealFilter("pre_mint"); setStatusFilter(""); setWaveFilter(""); applyFilter("", stageFilter, "pre_mint", ""); },
              },
              {
                label: "Reserved", value: reservedCount, color: "#b45309", bg: "#fffbeb", pct: totalAll ? Math.round(reservedCount / totalAll * 100) : 0,
                sub: "Unsold · awaiting treasury",
                icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
                filter: () => { setRevealFilter("reserved"); setStatusFilter(""); setWaveFilter(""); applyFilter("", stageFilter, "reserved", ""); },
              },
              {
                label: "Minted", value: mintedCount, color: "#2563eb", bg: "#eff6ff", pct: totalAll ? Math.round(mintedCount / totalAll * 100) : 0,
                sub: "On-chain tokens",
                icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
                filter: () => { setRevealFilter("minted"); setStatusFilter(""); setWaveFilter(""); applyFilter("", stageFilter, "minted", ""); },
              },
              {
                label: "Revealed", value: revealedCount, color: "#7c3aed", bg: "#f5f3ff", pct: totalAll ? Math.round(revealedCount / totalAll * 100) : 0,
                sub: "Artwork unlocked",
                icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>,
                filter: () => { setRevealFilter("revealed"); setStatusFilter(""); setWaveFilter(""); applyFilter("", stageFilter, "revealed", ""); },
              },
              {
                label: "Customer Wallets", value: customerWalletCount, color: "#0891b2", bg: "#ecfeff", pct: totalAll ? Math.round(customerWalletCount / totalAll * 100) : 0,
                sub: "Owned by customers",
                icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
                filter: () => { setRevealFilter("revealed"); setStatusFilter(""); setWaveFilter(""); applyFilter("", stageFilter, "revealed", ""); },
              },
              {
                label: "Treasury Wallet", value: treasuryWalletCount, color: "#0e7490", bg: "#f0fdff", pct: totalAll ? Math.round(treasuryWalletCount / totalAll * 100) : 0,
                sub: "Unsold · treasury-owned",
                icon: <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>,
                filter: () => { setRevealFilter("treasury_wallet"); setStatusFilter(""); setWaveFilter(""); applyFilter("", stageFilter, "treasury_wallet", ""); },
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
              <option value="pre_mint">⬡ Pre-mint</option>
              <option value="reserved">◈ Reserved</option>
              <option value="revealed">✦ Revealed</option>
              <option value="treasury_wallet">🏛 Treasury Wallet</option>
            </select>

            <select value={mintTypeFilter}
              onChange={e => { setMintTypeFilter(e.target.value); applyFilter(statusFilter, stageFilter, revealFilter, waveFilter, mintedFrom, mintedTo, e.target.value); }}
              className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
              style={{ border: "1px solid #e5e7eb", color: mintTypeFilter ? "#111827" : "#9bafc5" }}>
              <option value="">All Mint Types</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
              <option value="treasury">Treasury</option>
            </select>

            <select value={rarityTierFilter}
              onChange={e => { const tier = e.target.value; setRarityTierFilter(tier); const newReveal = tier ? "revealed" : revealFilter; if (tier) setRevealFilter("revealed"); applyFilter(statusFilter, stageFilter, newReveal, waveFilter, mintedFrom, mintedTo, mintTypeFilter, tier); }}
              className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
              style={{ border: "1px solid #e5e7eb", color: rarityTierFilter ? "#111827" : "#9bafc5" }}>
              <option value="">All Rarity Tiers</option>
              <option value="legendary">Legendary</option>
              <option value="epic">Epic</option>
              <option value="rare">Rare</option>
              <option value="common">Common</option>
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

            {(statusFilter || revealFilter || waveFilter || stageFilter || mintedFrom || mintedTo || mintTypeFilter || rarityTierFilter) && (
              <button onClick={() => {
                setStatusFilter(""); setRevealFilter(""); setWaveFilter(""); setStageFilter("");
                setMintedFrom(""); setMintedTo(""); setMintTypeFilter(""); setRarityTierFilter("");
                applyFilter("", "", "", "", "", "", "", "");
              }} className="px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                Clear filters
              </button>
            )}
          </div>

          {/* ── Wave Reveal Panel ── */}
          {showRevealPanel && (
            <WaveRevealPanel
              waveFilter={waveFilter}
              revealUri={revealUri}
              onUriChange={setRevealUri}
              onReveal={handleRevealWave}
              revealing={revealing}
              revealMsg={revealMsg}
            />
          )}

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


      {activeTab === "otc" && <OtcTab />}
      {activeTab === "bulk" && <BulkTab />}
      {activeTab === "gifts" && <GiftsTab />}
      {activeTab === "auctions" && <AuctionsTab />}
      {activeTab === "seasons" && <SeasonsTab />}
      {activeTab === "events" && <EventsTab />}
      {activeTab === "burn" && <BurnTab />}

      {/* ══ Full History Modal ══════════════════════════════════════════════════ */}
      {viewRecord && (
        <NftHistoryModal
          record={viewRecord}
          onClose={() => setViewRecord(null)}
          maximized={modalMaximized}
          onMaximize={() => setModalMaximized(v => !v)}
          blindBoxImageUrl={blindBoxImageUrl}
          traitStats={traitStats}
          waves={waves}
          sbtBusy={sbtBusy}
          sbtMsg={sbtMsg}
          onToggleSbt={handleToggleSbt}
          modalMintMoveRecip={modalMintMoveRecip}
          setModalMintMoveRecip={setModalMintMoveRecip}
          modalMintMoveBusy={modalMintMoveBusy}
          modalMintMoveMsg={modalMintMoveMsg}
          onMintMove={handleModalMintMove}
        />
      )}
    </div>
  );
}