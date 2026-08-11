"use client";

import { useEffect } from "react";
import { fmtDatetime as fmt, fmtDateLong as fmtDate, shortAddr, shortHash, TIER_COLORS } from "@/lib/nft-utils";
import NftImage from "@/components/nft/NftImage";

// ─── Constants ────────────────────────────────────────────────────────────────

const IPFS_GATEWAY = "https://amgbearth.myfilebase.com/ipfs";
const ETHERSCAN = process.env.NEXT_PUBLIC_NETWORK === "mainnet"
  ? "https://etherscan.io/tx/"
  : "https://sepolia.etherscan.io/tx/";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NftRecord {
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

export interface WaveOption {
  waveNumber: number;
  name: string;
  onChain: { soldCount: number; closed: boolean; revealed: boolean } | null;
}

// ─── Local helper ─────────────────────────────────────────────────────────────

function artworkId(r: NftRecord): number | null {
  if (!r.isRevealed || r.tokenId == null || r.waveQuantity == null || r.waveStartingIndex == null) return null;
  return ((r.tokenId - 1 + r.waveStartingIndex) % r.waveQuantity) + 1;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface NftHistoryModalProps {
  record: NftRecord | null;
  onClose: () => void;
  maximized: boolean;
  onMaximize: () => void;
  blindBoxImageUrl: string | null;
  traitStats: { total: number; stats: Record<string, Record<string, number>> } | null;
  waves: WaveOption[];
  sbtBusy: boolean;
  sbtMsg: string | null;
  onToggleSbt: (record: NftRecord, enable: boolean) => void;
  modalMintMoveRecip: string;
  setModalMintMoveRecip: (v: string) => void;
  modalMintMoveBusy: boolean;
  modalMintMoveMsg: string | null;
  onMintMove: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NftHistoryModal({
  record,
  onClose,
  maximized,
  onMaximize,
  blindBoxImageUrl,
  traitStats,
  waves,
  sbtBusy,
  sbtMsg,
  onToggleSbt,
  modalMintMoveRecip,
  setModalMintMoveRecip,
  modalMintMoveBusy,
  modalMintMoveMsg,
  onMintMove,
}: NftHistoryModalProps) {

  // ── Debug: log on open ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!record) return;
    console.group("NftHistoryModal opened");
    console.log("id:", record.id);
    console.log("serialNumber:", record.serialNumber);
    console.log("deliveryStatusCode:", record.deliveryStatusCode);
    console.log("isRevealed:", record.isRevealed);
    console.log("waveNumber:", record.waveNumber);
    console.groupEnd();
  }, [record]);

  if (!record) return null;

  const viewRecord = record;

  // ── SBT toggle with debug ───────────────────────────────────────────────────
  const handleSbtToggle = (enable: boolean) => {
    console.log("NftHistoryModal — onToggleSbt:", "tokenId:", viewRecord.tokenId, "enable:", enable);
    onToggleSbt(viewRecord, enable);
  };

  // ── Mint & Move with debug ──────────────────────────────────────────────────
  const handleMintMove = () => {
    console.log("NftHistoryModal — onMintMove:", "record.id:", viewRecord.id, "recipient:", modalMintMoveRecip);
    onMintMove();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)" }}>
      <div className={`flex flex-col ba-modal-records${maximized ? " maximized" : ""}`}>

        {/* ── Title Bar ───────────────────────────────────────────────────── */}
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
                {viewRecord.isRevealed && viewRecord.tokenId != null
                  ? <>Token ID #{viewRecord.tokenId}</>
                  : <>NFT {viewRecord.serialNumber}{viewRecord.tokenId != null && <span style={{ color: "#94a3b8", fontWeight: 500 }}> · Token ID #{viewRecord.tokenId}</span>}</>
                }
              </p>
              <p className="text-xs" style={{ color: "#94a3b8" }}>Full history — generation to delivery</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {viewRecord.isRevealed
              ? <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe" }}>✦ Revealed</span>
              : <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#fffbeb", color: "#d97706", border: "1px solid #fde68a" }}>⬡ Blind Box</span>
            }
            <button onClick={onMaximize} title={maximized ? "Minimize" : "Maximize"}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #e2e8f0" }}>
              {maximized
                ? <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" /></svg>
                : <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
              }
            </button>
            <button onClick={onClose} title="Close"
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca" }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Scrollable Body ──────────────────────────────────────────────── */}
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
                  {/* Minted Token ID */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Minted Token ID</p>
                    <p className="text-sm font-semibold leading-tight" style={{ color: viewRecord.tokenId != null ? "#0f172a" : "#94a3b8" }}>
                      {viewRecord.tokenId != null ? `#${viewRecord.tokenId}` : "Not minted"}
                    </p>
                  </div>
                  {/* Artwork ID — computed after VRF reveal */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Artwork ID</p>
                    {artworkId(viewRecord) != null
                      ? <p className="text-sm font-bold leading-tight" style={{ color: "#7c3aed" }}>✦ #{artworkId(viewRecord)}</p>
                      : <p className="text-sm leading-tight" style={{ color: "#94a3b8" }}>{viewRecord.isRevealed ? "—" : "After reveal"}</p>
                    }
                  </div>
                  {/* NFT Status — derived from lifecycle, industry-standard */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#94a3b8" }}>NFT Status</p>
                    {(() => {
                      const code = viewRecord.deliveryStatusCode;
                      if (code === "delivered") return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#dcfce7", color: "#15803d" }}>✓ Delivered</span>;
                      if (code === "treasury_wallet" || code === "transferred") return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#ecfeff", color: "#0e7490", border: "1px solid #a5f3fc" }}>🏛 Treasury Wallet</span>;
                      if (code === "sold") return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#fef9c3", color: "#a16207" }}>💰 Sold</span>;
                      if (code === "treasury_pending" || (viewRecord.tokenId == null && viewRecord.waveRevealScheduledAt != null))
                        return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>◈ Reserved</span>;
                      if (viewRecord.isRevealed) return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#f5f3ff", color: "#7c3aed" }}>✦ Revealed</span>;
                      if (viewRecord.tokenId != null) return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#eff6ff", color: "#2563eb" }}>⬡ Minted</span>;
                      return <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#f8fafc", color: "#94a3b8", border: "1px solid #e2e8f0" }}>○ Pre-mint</span>;
                    })()}
                  </div>
                  {/* Chain — only meaningful once minted */}
                  {viewRecord.tokenId != null && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Chain</p>
                      <div className="flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 256 417" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M127.9 0L125.2 9V285.2L127.9 287.9L255.8 212.6L127.9 0Z" fill="#343434" />
                          <path d="M127.9 0L0 212.6L127.9 287.9V154.2V0Z" fill="#8C8C8C" />
                          <path d="M127.9 312.8L126.3 314.8V412.1L127.9 416.9L255.9 237.5L127.9 312.8Z" fill="#3C3C3B" />
                          <path d="M127.9 416.9V312.8L0 237.5L127.9 416.9Z" fill="#8C8C8C" />
                          <path d="M127.9 287.9L255.8 212.6L127.9 154.2V287.9Z" fill="#141414" />
                          <path d="M0 212.6L127.9 287.9V154.2L0 212.6Z" fill="#393939" />
                        </svg>
                        <p className="text-sm font-semibold" style={{ color: "#0f172a" }}>
                          {process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "Ethereum" : "Sepolia"}
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Price — only show after wave is assigned */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Mint Price</p>
                    <p className="text-sm font-semibold leading-tight" style={{ color: viewRecord.waveNumber == null ? "#94a3b8" : viewRecord.effectivePriceEth != null ? "#0f172a" : "#15803d" }}>
                      {viewRecord.waveNumber == null
                        ? "—"
                        : viewRecord.effectivePriceEth != null
                          ? `${Number(viewRecord.effectivePriceEth)} ETH`
                          : "Free"}
                    </p>
                  </div>
                  {/* Mint Type */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#94a3b8" }}>Mint Type</p>
                    {(() => {
                      const mt = viewRecord.mintType;
                      if (mt === "free") return <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#dcfce7", color: "#15803d" }}>Free</span>;
                      if (mt === "paid") return <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#eff6ff", color: "#2563eb" }}>Paid</span>;
                      if (mt === "admin") return <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#f5f3ff", color: "#7c3aed" }}>Admin</span>;
                      if (mt === "treasury") return <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: "#fffbeb", color: "#d97706" }}>Treasury</span>;
                      return <span style={{ color: "#94a3b8" }}>—</span>;
                    })()}
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
                  {/* Rarity Tier, Score + Rank — all hidden until revealed */}
                  {(() => {
                    const tier = viewRecord.isRevealed && viewRecord.rarityTier
                      ? viewRecord.rarityTier.charAt(0).toUpperCase() + viewRecord.rarityTier.slice(1)
                      : null;
                    const tierColor = tier ? (TIER_COLORS[tier] ?? "#6b7280") : "#94a3b8";
                    return (
                      <>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#94a3b8" }}>Rarity Tier</p>
                          {tier
                            ? <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: tierColor + "20", color: tierColor }}>● {tier}</span>
                            : <span style={{ color: "#cbd5e1" }}>—</span>}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Rarity Score</p>
                          <p className="text-sm font-bold" style={{ color: viewRecord.isRevealed && viewRecord.rarityScore != null ? tierColor : "#cbd5e1" }}>
                            {viewRecord.isRevealed && viewRecord.rarityScore != null ? Number(viewRecord.rarityScore).toFixed(2) : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Rank</p>
                          <p className="text-sm font-bold">
                            {viewRecord.isRevealed && viewRecord.rarityRank != null
                              ? <><span style={{ color: tierColor }}>#{viewRecord.rarityRank}</span><span className="text-xs font-normal" style={{ color: "#94a3b8" }}> / {viewRecord.totalCount.toLocaleString()}</span></>
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
                      W{viewRecord.waveNumber}{viewRecord.waveName ? ` — ${viewRecord.waveName.split("—")[0]?.trim()}` : ""}{viewRecord.waveQuantity != null ? ` · ${viewRecord.waveQuantity.toLocaleString()} NFTs` : ""}
                    </span>
                  </div>
                  {(() => {
                    const isTrsy = viewRecord.deliveryStatusCode === "treasury_wallet" || viewRecord.deliveryStatusCode === "transferred";
                    const isRes = viewRecord.deliveryStatusCode === "treasury_pending" || (viewRecord.tokenId == null && viewRecord.waveRevealScheduledAt != null);
                    if (isTrsy) return <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#ccfbf1", color: "#0d9488", border: "1px solid #99f6e4" }}>🏛 Treasury Wallet</span>;
                    if (viewRecord.isRevealed) return <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#f5f3ff", color: "#7c3aed" }}>✦ Revealed</span>;
                    if (viewRecord.mintedAt) return <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#eff6ff", color: "#3b82f6" }}>⬡ Minted</span>;
                    if (isRes) return <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>◈ Reserved</span>;
                    return <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: "#f8fafc", color: "#94a3b8" }}>○ Pending</span>;
                  })()}
                </div>
                {/* Progress track */}
                {(() => {
                  const isResTrack = viewRecord.deliveryStatusCode === "treasury_pending" || (viewRecord.tokenId == null && viewRecord.waveRevealScheduledAt != null);
                  const isTreasury = viewRecord.deliveryStatusCode === "treasury_wallet" || viewRecord.deliveryStatusCode === "transferred";
                  const pctWidth = isTreasury ? "100%" : viewRecord.isRevealed ? "100%" : isResTrack ? "100%" : viewRecord.mintedAt ? "65%" : viewRecord.waveScheduledStart && new Date(viewRecord.waveScheduledStart) < new Date() ? "32%" : "0%";
                  const gradient = isTreasury ? "linear-gradient(90deg,#14b8a6,#0d9488)" : viewRecord.isRevealed ? "linear-gradient(90deg,#6366f1,#8b5cf6)" : isResTrack ? "linear-gradient(90deg,#f59e0b,#b45309)" : "linear-gradient(90deg,#6366f1,#8b5cf6)";
                  return (
                    <div className="px-5 pt-4 pb-1">
                      <div className="relative flex items-center">
                        <div className="flex-1 h-1 rounded-full" style={{ background: "#e2e8f0" }}>
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: pctWidth, background: gradient }} />
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <div className={`grid px-5 py-4 gap-4 ${viewRecord.deliveryStatusCode === "treasury_wallet" || viewRecord.deliveryStatusCode === "transferred" ? "grid-cols-4" : "grid-cols-3"}`}>
                  {[
                    { label: "Wave Start", val: fmt(viewRecord.waveScheduledStart), dot: "#41afeb" },
                    { label: "Wave End", val: fmt(viewRecord.waveScheduledEnd), dot: "#f59e0b" },
                  ].map(s => (
                    <div key={s.label} className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: s.dot }} />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>{s.label}</p>
                        <p className="text-xs font-semibold" style={{ color: s.val === "—" ? "#cbd5e1" : "#1e293b" }}>{s.val}</p>
                      </div>
                    </div>
                  ))}
                  {/* Reveal / Reserved Date */}
                  {(() => {
                    const isRes = viewRecord.deliveryStatusCode === "treasury_pending" || (viewRecord.tokenId == null && viewRecord.waveRevealScheduledAt != null);
                    const dotColor = viewRecord.isRevealed ? "#16a34a" : isRes ? "#b45309" : "#7c3aed";
                    const textColor = viewRecord.isRevealed && viewRecord.revealedAt ? "#16a34a" : isRes && viewRecord.waveRevealScheduledAt ? "#b45309" : viewRecord.waveRevealScheduledAt ? "#7c3aed" : "#cbd5e1";
                    const label = viewRecord.isRevealed ? "Revealed On" : isRes ? "Reserved Date" : "Reveal Date";
                    const dateVal = viewRecord.isRevealed && viewRecord.revealedAt ? fmt(viewRecord.revealedAt) : viewRecord.waveRevealScheduledAt ? fmt(viewRecord.waveRevealScheduledAt) : "—";
                    return (
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: dotColor }} />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>{label}</p>
                          <p className="text-xs font-semibold" style={{ color: textColor }}>{dateVal}</p>
                          {viewRecord.isRevealed && (
                            <p className="text-[9px] mt-0.5 font-semibold" style={{ color: "#16a34a" }}>✓ Revealed</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                  {/* Treasury Wallet — only for admin/treasury mints physically moved to treasury */}
                  {(viewRecord.deliveryStatusCode === "treasury_wallet" || viewRecord.deliveryStatusCode === "transferred") && (
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: "#0d9488" }} />
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#94a3b8" }}>Treasury Wallet</p>
                        <p className="text-xs font-semibold" style={{ color: (viewRecord.deliveredAt || viewRecord.mintedAt) ? "#0d9488" : "#cbd5e1" }}>
                          {fmt(viewRecord.deliveredAt ?? viewRecord.mintedAt)}
                        </p>
                        <p className="text-[9px] mt-0.5 font-semibold" style={{ color: "#0d9488" }}>✓ In Treasury</p>
                      </div>
                    </div>
                  )}
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
                { label: "Generated", date: viewRecord.createdAt, color: "#6366f1", desc: "NFT created in DB from generator", txHash: null },
                { label: "Reserved", date: viewRecord.waveRevealScheduledAt ?? null, color: "#b45309", desc: (viewRecord.deliveryStatusCode === "treasury_wallet" || viewRecord.deliveryStatusCode === "transferred") ? "Wave closed — NFT was unsold, reserved for treasury" : "Wave closed — NFT unsold, awaiting mint & move to treasury", txHash: null },
                { label: "Minted", date: viewRecord.mintedAt, color: "#7c3aed", desc: (viewRecord.deliveryStatusCode === "treasury_wallet" || viewRecord.deliveryStatusCode === "transferred") ? "Minted on-chain via treasury close" : "Minted on-chain to buyer wallet", txHash: viewRecord.mintTxHash },
                { label: "Revealed", date: viewRecord.revealedAt, color: "#8b5cf6", desc: "Artwork revealed, blind box opened", txHash: viewRecord.waveRevealTxHash },
                { label: "Sold", date: viewRecord.soldAt, color: "#f59e0b", desc: viewRecord.lastSalePriceEth != null ? `Sold for ${Number(viewRecord.lastSalePriceEth).toFixed(4)} ETH` : "Ownership transferred on-chain", txHash: viewRecord.lastTxHash },
                { label: (viewRecord.deliveryStatusCode === "treasury_wallet" || viewRecord.deliveryStatusCode === "transferred") ? "Treasury Wallet" : "Delivered", date: viewRecord.deliveredAt, color: (viewRecord.deliveryStatusCode === "treasury_wallet" || viewRecord.deliveryStatusCode === "transferred") ? "#0d9488" : "#10b981", desc: (viewRecord.deliveryStatusCode === "treasury_wallet" || viewRecord.deliveryStatusCode === "transferred") ? "Moved to treasury wallet" : "Delivered to customer wallet", txHash: (viewRecord.deliveryStatusCode === "treasury_wallet" || viewRecord.deliveryStatusCode === "transferred") ? viewRecord.mintTxHash ?? null : null },
              ].filter(step => step.date).map((step, i, arr) => {
                const isLast = i === arr.length - 1;
                return (
                  <div key={step.label} className="flex gap-4 px-5 py-3.5" style={{ borderTop: i > 0 ? "1px solid #f8fafc" : undefined }}>
                    {/* Step indicator */}
                    <div className="flex flex-col items-center flex-shrink-0 pt-0.5" style={{ width: 32 }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: `${step.color}18`, border: `2px solid ${step.color}` }}>
                        <svg className="w-3 h-3" style={{ color: step.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {!isLast && (
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
                    {/* Badge — last step = current active state, all others = done */}
                    <div className="flex-shrink-0 pt-0.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={isLast
                          ? { background: `${step.color}20`, color: step.color, border: `1px solid ${step.color}40` }
                          : { background: "#f1f5f9", color: "#64748b" }}>
                        {isLast ? "Active" : "Done"}
                      </span>
                    </div>
                  </div>
                );
              })}
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

            {/* Traits — OpenSea style with rarity % */}
            {viewRecord.isRevealed && viewRecord.traits && Object.keys(viewRecord.traits).length > 0 && (
              <div className="rounded-2xl overflow-hidden bg-white" style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" style={{ color: "#7c3aed" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#7c3aed" }}>Attributes</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#f5f3ff", color: "#7c3aed" }}>
                      {Object.keys(viewRecord.traits).length} traits
                    </span>
                  </div>
                  {!traitStats && (
                    <span className="text-[10px] font-semibold animate-pulse" style={{ color: "#a78bfa" }}>Loading rarity…</span>
                  )}
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  {Object.entries(viewRecord.traits).map(([traitType, traitValue]) => {
                    const count = traitStats?.stats?.[traitType]?.[traitValue] ?? null;
                    const total = traitStats?.total ?? null;
                    const pct = count != null && total ? (count / total) * 100 : null;
                    const isRare = pct != null && pct < 10;
                    return (
                      <div key={traitType} className="rounded-xl p-3"
                        style={{
                          background: isRare ? "linear-gradient(135deg,#fdf4ff,#f5f3ff)" : "#faf5ff",
                          border: isRare ? "1px solid #d8b4fe" : "1px solid #e9d5ff",
                        }}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#a78bfa" }}>{traitType}</p>
                          {isRare && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "#7c3aed", color: "#fff" }}>✦ Rare</span>
                          )}
                        </div>
                        <p className="text-sm font-bold leading-tight mb-2" style={{ color: "#3b0764" }}>{traitValue}</p>
                        {pct != null ? (
                          <>
                            <div className="h-1.5 rounded-full overflow-hidden mb-1" style={{ background: "#ede9fe" }}>
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{
                                  width: `${Math.min(pct, 100)}%`,
                                  background: pct < 5 ? "#7c3aed" : pct < 15 ? "#8b5cf6" : pct < 30 ? "#a78bfa" : "#c4b5fd",
                                }} />
                            </div>
                            <p className="text-[10px] font-semibold" style={{ color: "#7c3aed" }}>
                              {pct.toFixed(1)}% have this trait
                              <span className="font-normal ml-1" style={{ color: "#a78bfa" }}>({count!.toLocaleString()} of {total!.toLocaleString()})</span>
                            </p>
                          </>
                        ) : (
                          <div className="h-1.5 rounded-full animate-pulse" style={{ background: "#ede9fe", width: "60%" }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-5 pt-4 pb-3 bg-white" style={{ borderTop: "1px solid #e2e8f0" }}>

          {/* ── Lifecycle action panel — all 4 treasury states ── */}
          {(() => {
            const { tokenId, deliveryStatusCode, waveNumber, mintType } = viewRecord;

            // Only reserved unminted non-customer NFTs show the Mint & Move panel
            if (tokenId == null && deliveryStatusCode === "treasury_pending" && mintType !== "free" && mintType !== "paid") return (
              <div className="mb-4 p-3 rounded-xl" style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                <p className="text-xs font-bold mb-1" style={{ color: "#1d4ed8" }}>⬡ Mint &amp; Move to Treasury / Custom Wallet</p>
                <p className="text-[10px] mb-2" style={{ color: "#3b82f6" }}>
                  Mints all unsold NFTs in Wave {waveNumber} on-chain, then transfers to the wallet below. Leave blank for the contract&apos;s default treasury wallet.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={modalMintMoveRecip}
                    onChange={e => setModalMintMoveRecip(e.target.value)}
                    placeholder="0x… (leave blank for treasury wallet)"
                    className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none font-mono"
                    style={{ border: "1px solid #bfdbfe", background: "#fff", color: "#1e3a8a" }}
                  />
                  <button
                    onClick={handleMintMove}
                    disabled={modalMintMoveBusy}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0"
                    style={{
                      background: modalMintMoveBusy ? "#e5e7eb" : "linear-gradient(135deg,#2563eb,#1d4ed8)",
                      color: modalMintMoveBusy ? "#9ca3af" : "#fff",
                      border: "none", cursor: modalMintMoveBusy ? "wait" : "pointer",
                    }}>
                    {modalMintMoveBusy ? "Processing…" : "Mint & Move"}
                  </button>
                </div>
                {modalMintMoveMsg && (
                  <p className="text-xs mt-1.5 font-semibold" style={{ color: modalMintMoveMsg.startsWith("Done") ? "#16a34a" : "#dc2626" }}>
                    {modalMintMoveMsg}
                  </p>
                )}
              </div>
            );

            return null;
          })()}
          {/* ── Close row ─────────────────────────────────────────────────── */}
          <div className="flex items-center justify-end">
            <button onClick={onClose}
              className="px-5 py-2 text-sm font-semibold rounded-lg"
              style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
