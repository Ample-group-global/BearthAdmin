"use client";

import { StatusBadge } from "@/components/nft/StatusBadge";
import { thStyle } from "@/components/nft/styles";
import { toLocalDateTimeInput } from "@/lib/nft-utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Wave {
  id: string;
  waveNumber: number;
  name: string;
  stageId: string | null;
  stageName: string | null;
  quantity: number | null;
  cumulativeStart: number | null;
  cumulativeEnd: number | null;
  defaultPriceEth: number | null;
  saleMethod: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  revealScheduledAt: string | null;
  waveRevealedAt: string | null;
  tierPrices: { legendary?: number; epic?: number; rare?: number; common?: number } | null;
  status: string;
  notes: string | null;
  nftCount: number;
  soldCount?: number;
  treasuryPendingCount?: number;
  priceLocked?: boolean;
  waveClosed?: boolean;
  waveRevealed?: boolean;
  waveRevealUri?: string | null;
  closeAction?: string | null;
  unsoldStrategy?: "auto_treasury" | "manual";
  whitelistRequired?: boolean;
  syncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  onChain?: {
    priceEth: number;
    qty: number;
    soldCount: number;
    startTime: number;
    endTime: number;
    closed: boolean;
    active: boolean;
    revealed: boolean;
  } | null;
}

interface WaveSchedule {
  wave_number: number;
  wave_name: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  reveal_scheduled_at: string | null;
  wave_start_triggered: boolean;
  wave_end_triggered: boolean;
  wave_reveal_triggered: boolean;
  is_revealed: boolean;
  wave_revealed_at: string | null;
  sold_count: number;
  quantity: number;
}

interface SaleMethod {
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const WAVE_ICONS: Record<number, { symbol: string; gradient: string; shadow: string }> = {
  1: { symbol: "✦", gradient: "linear-gradient(135deg, #24315f, #41afeb)", shadow: "#41afeb" },
  2: { symbol: "◈", gradient: "linear-gradient(135deg, #1a2347, #2e9fd8)", shadow: "#2e9fd8" },
  3: { symbol: "↑", gradient: "linear-gradient(135deg, #24315f, #0ea5e9)", shadow: "#0ea5e9" },
  4: { symbol: "⊛", gradient: "linear-gradient(135deg, #0f172a, #24315f)", shadow: "#24315f" },
  5: { symbol: "⚡", gradient: "linear-gradient(135deg, #41afeb, #93d3f8)", shadow: "#41afeb" },
  6: { symbol: "∞", gradient: "linear-gradient(135deg, #1e3a5f, #4a62a8)", shadow: "#4a62a8" },
  7: { symbol: "✦✦", gradient: "linear-gradient(135deg, #24315f, #6b85c4)", shadow: "#6b85c4" },
};

const WAVE_PURPOSE: Record<number, string> = {
  1: "Launch 9,999 Genesis NFTs.",
  2: "Launch 9,999 Genesis NFTs.",
  3: "The community grows and NFT demand increases.",
  4: "Holders complete quests, receive airdrops, and unlock new experiences.",
  5: "Holders gain staking, DAO voting, and exclusive access.",
  6: "The ecosystem expands with games, new collections, and partnerships.",
  7: "The project becomes an iconic NFT brand with lasting value and history.",
};

const WAVE_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  revealed:         { bg: "rgba(124,58,237,0.1)",   color: "#7c3aed", label: "Revealed"          },
  reveal_scheduled: { bg: "rgba(124,58,237,0.08)",  color: "#7c3aed", label: "Reveal Scheduled"  },
  ready_reveal:     { bg: "rgba(217,119,6,0.1)",    color: "#d97706", label: "Ready to Reveal"   },
  active:           { bg: "rgba(65,175,235,0.12)",  color: "#41afeb", label: "Active"            },
  upcoming:         { bg: "rgba(156,163,175,0.12)", color: "#9ca3af", label: "Upcoming"          },
  paused:           { bg: "rgba(217,119,6,0.1)",    color: "#d97706", label: "Paused"            },
  closed:           { bg: "rgba(22,163,74,0.1)",    color: "#16a34a", label: "Closed"            },
  ended:            { bg: "rgba(107,114,128,0.1)",  color: "#6b7280", label: "Ended"             },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function deriveWaveDisplayStatus(w: Wave): string {
  if (w.waveRevealed) return "revealed";
  if (w.waveClosed) {
    const now = Date.now();
    if (w.revealScheduledAt && new Date(w.revealScheduledAt).getTime() <= now) return "ready_reveal";
    if (w.revealScheduledAt && new Date(w.revealScheduledAt).getTime() > now) return "reveal_scheduled";
    return "closed";
  }
  if (w.status === "active" && w.scheduledEnd && new Date(w.scheduledEnd) < new Date()) return "ended";
  return w.status;
}

function SaleMethodBadge({ method, saleMethods }: { method: string; saleMethods: SaleMethod[] }) {
  const sm = saleMethods.find(s => s.code === method);
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "rgba(65,175,235,0.12)", color: "#41afeb" }}>
      {sm?.label ?? method}
    </span>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface WavesTableProps {
  waves: Wave[];
  loading: boolean;
  wavePage: number;
  setWavePage: (p: number | ((prev: number) => number)) => void;
  saleMethods: SaleMethod[];
  onManage: (w: Wave) => void;
  onReveal: (ws: WaveSchedule) => void;
  onTreasuryMove: (w: Wave) => void;
  onSetRevealDate: (w: Wave, ws: WaveSchedule) => void;
  highlightRef: React.RefObject<HTMLDivElement | null>;
  strategyHighlight: string | null;
  WAVES_PER_PAGE: number;
}

// ─── WavesTable ────────────────────────────────────────────────────────────────

export default function WavesTable({
  waves,
  loading,
  wavePage,
  setWavePage,
  saleMethods,
  onManage,
  onReveal,
  onTreasuryMove,
  onSetRevealDate,
  WAVES_PER_PAGE,
}: WavesTableProps) {
  const totalNfts = waves.reduce((s, w) => s + (w.quantity ?? 0), 0);

  return (
    <>
      {/* Waves Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div className="flex items-center justify-center h-48" style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr>
                  {["Sr.", "Wave No.", "Wave Symbol", "Wave", "Purpose", "Qty", "Price (ETH)", "Minted", "Sale Method", "Schedule", "Reveal Date", "Status", "Reveal", ""].map(h => (
                    <th key={h} style={{ ...thStyle, textAlign: ["Qty", "Minted", "Reveal", "Wave Symbol", "Sr."].includes(h) ? "center" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {waves.slice((wavePage - 1) * WAVES_PER_PAGE, wavePage * WAVES_PER_PAGE).map((w, i) => {
                  const isClosed = w.waveClosed || w.status === "closed";
                  const isLocked = w.priceLocked;
                  const soldCount = w.soldCount ?? 0;
                  // Wave is closed with zero minted — reveal is irrelevant (no buyers); auto-reveal fires during treasury close
                  const isZeroMinted = isClosed && soldCount === 0 && (w.quantity ?? 0) > 0 && !w.closeAction;
                  return (
                    <tr key={w.id}
                      style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}>

                      {/* Sr. No. */}
                      <td style={{ padding: "10px 14px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <span className="text-xs font-semibold" style={{ color: "#9bafc5" }}>{(wavePage - 1) * WAVES_PER_PAGE + i + 1}</span>
                      </td>

                      {/* Wave Number */}
                      <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                        <span className="text-xs font-bold" style={{ color: "#24315f" }}>Wave {w.waveNumber}</span>
                      </td>

                      {/* Image — thematic per-wave icon */}
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        {(() => {
                          const icon = WAVE_ICONS[w.waveNumber];
                          const borderColor = isClosed ? "#16a34a" : w.status === "active" ? "#41afeb" : "transparent";
                          return (
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto select-none"
                              style={{
                                background: icon?.gradient ?? "#f4f6fb",
                                border: `2px solid ${borderColor}`,
                                boxShadow: icon ? `0 2px 10px ${icon.shadow}55` : undefined,
                                fontSize: "18px",
                                color: "#ffffff",
                                fontWeight: 700,
                                letterSpacing: "-1px",
                              }}>
                              {icon?.symbol ?? "◆"}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Wave Name */}
                      <td style={{ padding: "10px 14px" }}>
                        <div className="font-semibold text-xs" style={{ color: "#111827" }}>{w.name}</div>
                      </td>

                      {/* Purpose */}
                      <td style={{ padding: "10px 14px", minWidth: 220, maxWidth: 260 }}>
                        {WAVE_PURPOSE[w.waveNumber]
                          ? <span className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{WAVE_PURPOSE[w.waveNumber]}</span>
                          : <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>}
                      </td>

                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <span className="text-xs font-semibold" style={{ color: "#374151" }}>{(w.quantity ?? 0).toLocaleString()}</span>
                      </td>

                      <td style={{ padding: "10px 14px" }}>
                        <div className="flex flex-col gap-0.5">
                          {w.defaultPriceEth != null ? (
                            <span className="font-bold text-xs" style={{ color: "#24315f" }}>{w.defaultPriceEth} ETH</span>
                          ) : (
                            <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>Free</span>
                          )}
                          {isLocked && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold w-fit"
                              style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
                              Locked
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        {(() => {
                          const minted = w.soldCount ?? w.onChain?.soldCount ?? 0;
                          const pending = w.treasuryPendingCount ?? 0;
                          return (
                            <>
                              <div className="text-xs">
                                <span className="font-bold" style={{ color: "#41afeb" }}>{minted.toLocaleString()}</span>
                                <span style={{ color: "#9bafc5" }}> / {(w.quantity ?? 0).toLocaleString()}</span>
                              </div>
                              {minted > 0 && (
                                <div className="h-1 rounded-full mt-1" style={{ background: "#e5e7eb", width: 60, margin: "4px auto 0" }}>
                                  <div className="h-1 rounded-full" style={{
                                    width: `${Math.min(100, Math.round(minted / (w.quantity || 1) * 100))}%`,
                                    background: "#41afeb",
                                  }} />
                                </div>
                              )}
                              {pending > 0 && (
                                <div className="text-[9px] font-bold mt-1" style={{ color: "#d97706" }}>
                                  {pending.toLocaleString()} unsold
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </td>

                      <td style={{ padding: "10px 14px" }}>
                        <SaleMethodBadge method={w.saleMethod} saleMethods={saleMethods} />
                      </td>

                      <td style={{ padding: "10px 14px", minWidth: 155 }}>
                        {w.scheduledStart || w.scheduledEnd ? (
                          <div className="text-xs" style={{ color: "#6b7280" }}>
                            {w.scheduledStart && (
                              <div>From: <strong style={{ color: "#374151" }}>
                                {new Date(w.scheduledStart).toLocaleDateString()}{" "}
                                <span style={{ color: "#7c3aed" }}>{new Date(w.scheduledStart).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                              </strong></div>
                            )}
                            {w.scheduledEnd && (
                              <div>To: <strong style={{ color: "#374151" }}>
                                {new Date(w.scheduledEnd).toLocaleDateString()}{" "}
                                <span style={{ color: "#7c3aed" }}>{new Date(w.scheduledEnd).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
                              </strong></div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: "#d1d5db" }}>Not scheduled</span>
                        )}
                      </td>

                      <td style={{ padding: "10px 14px", minWidth: 130 }}>
                        {!isClosed ? (
                          <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>
                        ) : w.waveRevealed && w.waveRevealedAt ? (
                          <div className="text-xs font-semibold" style={{ color: "#16a34a" }}>
                            <div>{new Date(w.waveRevealedAt).toLocaleDateString()}</div>
                            <div style={{ color: "#16a34a", fontWeight: 400, opacity: 0.7 }}>{new Date(w.waveRevealedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</div>
                          </div>
                        ) : w.revealScheduledAt ? (
                          <div className="text-xs font-semibold" style={{ color: "#7c3aed" }}>
                            <div>{new Date(w.revealScheduledAt).toLocaleDateString()}</div>
                            <div style={{ color: "#9bafc5", fontWeight: 400 }}>{new Date(w.revealScheduledAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</div>
                          </div>
                        ) : isZeroMinted ? (
                          <span className="text-xs font-semibold" style={{ color: "#9bafc5" }}>Auto</span>
                        ) : (
                          <span className="text-xs" style={{ color: "#d1d5db" }}>Not set</span>
                        )}
                      </td>

                      <td style={{ padding: "10px 14px" }}>
                        <div className="space-y-1">
                          <StatusBadge status={deriveWaveDisplayStatus(w)} colorMap={WAVE_COLORS} dot />
                          {isClosed && w.closeAction && (
                            <span className="block text-xs" style={{ color: "#9bafc5" }}>
                              {w.closeAction === "treasury" ? "→ Treasury" : "→ Burned"}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        {(() => {
                          if (!isClosed) return (
                            <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>
                          );
                          const isAuto = (w.unsoldStrategy ?? "auto_treasury") === "auto_treasury";
                          const stratBadge = !w.waveRevealed ? (
                            <div style={{ marginTop: 4 }}>
                              <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                style={isAuto
                                  ? { background: "rgba(65,175,235,0.08)", color: "#41afeb", border: "1px solid rgba(65,175,235,0.2)" }
                                  : { background: "rgba(217,119,6,0.08)", color: "#d97706", border: "1px solid rgba(217,119,6,0.2)" }
                                }>
                                {isAuto ? "Auto → Treasury" : "Manual Transfer"}
                              </span>
                            </div>
                          ) : null;
                          // 0-minted closed wave: no reveal date picker needed — backend auto-reveals + transfers
                          if (isZeroMinted) {
                            // Auto-treasury + no action taken yet: show trigger button (opens TreasuryMoveModal)
                            if (isAuto && !w.closeAction) return (
                              <button onClick={() => onTreasuryMove(w)}
                                className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb", border: "1px solid rgba(65,175,235,0.3)", cursor: "pointer" }}>
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Auto Transfer
                              </button>
                            );
                            // Already completed or manual strategy: show static badge
                            return (
                              <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                style={isAuto
                                  ? { background: "rgba(22,163,74,0.08)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.2)" }
                                  : { background: "rgba(217,119,6,0.08)", color: "#d97706", border: "1px solid rgba(217,119,6,0.2)" }
                                }>
                                {isAuto ? "✓ Transferred" : "Manual Transfer"}
                              </span>
                            );
                          }
                          const isReady = !w.waveRevealed && !!w.revealScheduledAt && new Date(w.revealScheduledAt).getTime() <= Date.now();
                          const makeWS = (): WaveSchedule => ({
                            wave_number: w.waveNumber, wave_name: w.name, status: w.status,
                            scheduled_start: w.scheduledStart, scheduled_end: w.scheduledEnd,
                            reveal_scheduled_at: w.revealScheduledAt, wave_start_triggered: false,
                            wave_end_triggered: true, wave_reveal_triggered: false,
                            is_revealed: w.waveRevealed ?? false, wave_revealed_at: w.waveRevealedAt,
                            sold_count: w.soldCount ?? 0, quantity: w.quantity ?? 0,
                          });
                          if (w.waveRevealed) return (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                              Done
                            </span>
                          );
                          if (isReady) return (
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => {
                                  console.log("[WavesTable] Reveal Now clicked — wave_number:", w.waveNumber, "status:", deriveWaveDisplayStatus(w));
                                  onReveal(makeWS());
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white"
                                style={{ background: "#d97706" }}>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Reveal Now
                              </button>
                              {stratBadge}
                            </div>
                          );
                          return (
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => onSetRevealDate(w, makeWS())}
                                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-lg"
                                style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {w.revealScheduledAt ? "Edit Date" : "Set Date"}
                              </button>
                              {stratBadge}
                            </div>
                          );
                        })()}
                      </td>

                      <td style={{ padding: "10px 14px" }}>
                        <div className="flex flex-col gap-1.5 items-start">
                          <button
                            onClick={() => {
                              console.log("[WavesTable] Manage clicked —", w);
                              onManage(w);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                            style={{ background: "#24315f" }}>
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Manage
                          </button>
                          {/* 0-minted wave: manual strategy only — auto_treasury is handled automatically on reveal */}
                          {isZeroMinted && !w.closeAction && isClosed && w.unsoldStrategy === "manual" && (
                            <button
                              onClick={() => onTreasuryMove(w)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                              style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.3)" }}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                              Move to Wallet
                            </button>
                          )}
                          {/* Waves with customer sales: require reveal first, then show Move to Wallet for manual strategy */}
                          {w.waveClosed && w.waveRevealed && !w.closeAction && !isZeroMinted &&
                            w.unsoldStrategy === "manual" &&
                            (w.treasuryPendingCount ?? 0) > 0
                            && (
                              <button
                                onClick={() => onTreasuryMove(w)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.3)" }}>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                </svg>
                                Move to Wallet
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && waves.length > WAVES_PER_PAGE && (
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs" style={{ color: "#9bafc5" }}>
            Showing {(wavePage - 1) * WAVES_PER_PAGE + 1}–{Math.min(wavePage * WAVES_PER_PAGE, waves.length)} of {waves.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setWavePage(p => Math.max(1, p - 1))} disabled={wavePage === 1}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ border: "1px solid #e5e7eb", color: "#374151", background: "white" }}>
              ← Prev
            </button>
            {Array.from({ length: Math.ceil(waves.length / WAVES_PER_PAGE) }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setWavePage(p)}
                className="w-8 h-8 rounded-lg text-xs font-semibold"
                style={{ border: "1px solid #e5e7eb", background: p === wavePage ? "#41afeb" : "white", color: p === wavePage ? "white" : "#374151" }}>
                {p}
              </button>
            ))}
            <button onClick={() => setWavePage(p => Math.min(Math.ceil(waves.length / WAVES_PER_PAGE), p + 1))} disabled={wavePage === Math.ceil(waves.length / WAVES_PER_PAGE)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ border: "1px solid #e5e7eb", color: "#374151", background: "white" }}>
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Footer totals */}
      {!loading && waves.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold"
          style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#24315f" }}>
          <span>Totals across all 7 waves</span>
          <div className="flex items-center gap-6">
            <span>Qty: <strong>{totalNfts.toLocaleString()} / 9,999</strong></span>
          </div>
        </div>
      )}
    </>
  );
}
