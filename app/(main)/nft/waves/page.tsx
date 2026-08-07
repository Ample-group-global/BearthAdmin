"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useInterval } from "@/lib/useInterval";
import { ErrBanner, TxBanner as SharedTxBanner } from "@/components/nft/Banner";
import { StatusBadge } from "@/components/nft/StatusBadge";
import { labelStyle, inputStyle, thStyle } from "@/components/nft/styles";
import WhitelistTab from "@/components/nft/tabs/WhitelistTab";
import PacksTab from "@/components/nft/tabs/PacksTab";
import CollaborationsTab from "@/components/nft/tabs/CollaborationsTab";

// ─── Types (Waves tab) ────────────────────────────────────────────────────────

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
  unsoldStrategy?: 'auto_treasury' | 'manual';
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

interface OnChainWaveInfo {
  price: string;
  qty: number;
  soldCount: number;
  startTime: number;
  endTime: number;
  closed: boolean;
}

interface SaleMethod { code: string; label: string; is_active: boolean; sort_order: number; }

// Only "paused" is a legitimate admin override — upcoming/active are managed by auto-trigger
const PAUSE_TOGGLE = "paused";

// Per-wave thematic icons — Bearth ecosystem palette (#24315f navy + #41afeb sky-blue)
// Each wave uses a distinct shade/depth variation within the same brand DNA
const WAVE_ICONS: Record<number, { symbol: string; gradient: string; shadow: string }> = {
  1: { symbol: "✦",  gradient: "linear-gradient(135deg, #24315f, #41afeb)",           shadow: "#41afeb" }, // Genesis Free  — full brand gradient
  2: { symbol: "◈",  gradient: "linear-gradient(135deg, #1a2347, #2e9fd8)",           shadow: "#2e9fd8" }, // Genesis Paid  — deeper navy to mid-blue
  3: { symbol: "↑",  gradient: "linear-gradient(135deg, #24315f, #0ea5e9)",           shadow: "#0ea5e9" }, // Ascension     — navy to bright cyan-blue
  4: { symbol: "⊛",  gradient: "linear-gradient(135deg, #0f172a, #24315f)",           shadow: "#24315f" }, // Odyssey       — darkest — deep-space navy
  5: { symbol: "⚡",  gradient: "linear-gradient(135deg, #41afeb, #93d3f8)",           shadow: "#41afeb" }, // Awakening     — light blue dawn
  6: { symbol: "∞",  gradient: "linear-gradient(135deg, #1e3a5f, #4a62a8)",           shadow: "#4a62a8" }, // Continuum     — navy to brand indigo
  7: { symbol: "✦✦", gradient: "linear-gradient(135deg, #24315f, #6b85c4)",           shadow: "#6b85c4" }, // Eternity      — navy to muted periwinkle
};

// Per-wave purpose descriptions shown in the Purpose column
const WAVE_PURPOSE: Record<number, string> = {
  1: "Launch 9,999 Genesis NFTs.",
  2: "Launch 9,999 Genesis NFTs.",
  3: "The community grows and NFT demand increases.",
  4: "Holders complete quests, receive airdrops, and unlock new experiences.",
  5: "Holders gain staking, DAO voting, and exclusive access.",
  6: "The ecosystem expands with games, new collections, and partnerships.",
  7: "The project becomes an iconic NFT brand with lasting value and history.",
};

// ─── Types (Reveal tab) ───────────────────────────────────────────────────────

interface WaveSchedule {
  wave_number:           number;
  wave_name:             string;
  status:                string;
  scheduled_start:       string | null;
  scheduled_end:         string | null;
  reveal_scheduled_at:   string | null;
  wave_start_triggered:  boolean;
  wave_end_triggered:    boolean;
  wave_reveal_triggered: boolean;
  is_revealed:           boolean;
  wave_revealed_at:      string | null;
  sold_count:            number;
  minted_count:          number;
  quantity:              number;
}

// ─── Reveal tab helpers ───────────────────────────────────────────────────────

const PHASE_LABELS: Record<number, string> = { 0: "Whitelist", 1: "PaidMint", 2: "Revealed" };
const PHASE_COLORS: Record<number, { color: string; bg: string }> = {
  0: { color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
  1: { color: "#41afeb", bg: "rgba(65,175,235,0.1)" },
  2: { color: "#16a34a", bg: "rgba(22,163,74,0.1)" },
};

function fmtDate(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtFull(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function toLocalDateTimeInput(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function waveState(w: WaveSchedule): "revealed" | "ready_reveal" | "reveal_scheduled" | "active" | "ended" | "ended_zero" | "upcoming" | "not_scheduled" {
  const now = Date.now();
  if (w.is_revealed) return "revealed";
  if (w.wave_start_triggered && !w.wave_end_triggered) return "active";
  // Reveal states only apply after the wave has ended
  if (w.wave_end_triggered) {
    if (w.reveal_scheduled_at && new Date(w.reveal_scheduled_at).getTime() <= now) return "ready_reveal";
    if (w.reveal_scheduled_at && new Date(w.reveal_scheduled_at).getTime() > now)  return "reveal_scheduled";
    // 0-minted closed wave: nothing to reveal, auto-treasury handles it → treat as complete
    if ((w.sold_count ?? 0) === 0) return "ended_zero";
    return "ended";
  }
  if (w.scheduled_start && new Date(w.scheduled_start).getTime() > now) return "upcoming";
  return "not_scheduled";
}

const STATE_META: Record<string, { label: string; color: string; bg: string }> = {
  revealed:         { label: "Revealed",          color: "#16a34a", bg: "rgba(22,163,74,0.1)" },
  ready_reveal:     { label: "Ready to Reveal",   color: "#d97706", bg: "rgba(217,119,6,0.12)" },
  reveal_scheduled: { label: "Reveal Scheduled",  color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
  active:           { label: "Active",             color: "#41afeb", bg: "rgba(65,175,235,0.1)" },
  ended:            { label: "Wave Ended",         color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
  ended_zero:       { label: "Complete",           color: "#16a34a", bg: "rgba(22,163,74,0.1)"   },
  upcoming:         { label: "Upcoming",           color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  not_scheduled:    { label: "Not Scheduled",      color: "#9bafc5", bg: "rgba(156,163,175,0.1)" },
};

// ─── Sub-components (Waves tab) ───────────────────────────────────────────────

const WAVE_COLORS = {
  revealed:         { bg: "rgba(124,58,237,0.1)",   color: "#7c3aed", label: "Revealed"         },
  reveal_scheduled: { bg: "rgba(124,58,237,0.08)",  color: "#7c3aed", label: "Reveal Scheduled" },
  ready_reveal:     { bg: "rgba(217,119,6,0.1)",    color: "#d97706", label: "Ready to Reveal"  },
  active:           { bg: "rgba(65,175,235,0.12)",  color: "#41afeb", label: "Active"           },
  upcoming:         { bg: "rgba(156,163,175,0.12)", color: "#9ca3af", label: "Upcoming"         },
  paused:           { bg: "rgba(217,119,6,0.1)",    color: "#d97706", label: "Paused"           },
  closed:           { bg: "rgba(22,163,74,0.1)",    color: "#16a34a", label: "Closed"           },
  ended:            { bg: "rgba(107,114,128,0.1)",  color: "#6b7280", label: "Ended"            },
};

function deriveWaveDisplayStatus(w: Wave): string {
  if (w.waveRevealed) return "revealed";
  if (w.waveClosed) {
    const now = Date.now();
    if (w.revealScheduledAt && new Date(w.revealScheduledAt).getTime() <= now) return "ready_reveal";
    if (w.revealScheduledAt && new Date(w.revealScheduledAt).getTime() > now)  return "reveal_scheduled";
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

// ─── Reveal Confirmation Modal ────────────────────────────────────────────────

function RevealModal({
  wave, onClose, onSuccess,
}: {
  wave: WaveSchedule;
  onClose: () => void;
  onSuccess: (txHash: string) => void;
}) {
  const [uri,       setUri]       = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function doReveal() {
    if (!confirmed || !uri.startsWith("ipfs://")) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/nft-sell/waves/${wave.wave_number}/reveal`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Reveal failed");
      onSuccess(json.txHash);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Reveal failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" style={{ border: "1px solid #e5e7eb" }}>
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(217,119,6,0.1)" }}>
              <svg className="w-5 h-5" style={{ color: "#d97706" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Reveal Wave {wave.wave_number}</h2>
              <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{wave.wave_name}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Warning banner */}
          <div className="flex gap-3 p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)" }}>
            <svg className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#dc2626" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-xs leading-relaxed" style={{ color: "#dc2626" }}>
              <strong>This action is irreversible.</strong> Once revealed, all blind box NFTs in Wave {wave.wave_number} will
              permanently show their actual artwork. Buyers will see their traits and rarity.
            </p>
          </div>

          {/* Wave summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#9bafc5" }}>NFTs to Reveal</p>
              <p className="text-xl font-extrabold mt-1" style={{ color: "#24315f" }}>{wave.quantity.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#9bafc5" }}>Reveal Date</p>
              <p className="text-sm font-semibold mt-1" style={{ color: "#24315f" }}>{fmtFull(wave.reveal_scheduled_at)}</p>
            </div>
          </div>

          {/* IPFS URI input */}
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: "#374151" }}>
              Metadata Base URI <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input
              value={uri}
              onChange={e => setUri(e.target.value)}
              placeholder="ipfs://Qm.../metadata/"
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{
                border: `1px solid ${uri && !uri.startsWith("ipfs://") ? "#fca5a5" : "#e5e7eb"}`,
                color: "#111827",
                fontFamily: "monospace",
              }}
            />
            {uri && !uri.startsWith("ipfs://") && (
              <p className="text-xs mt-1" style={{ color: "#dc2626" }}>URI must start with ipfs://</p>
            )}
            <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>
              The IPFS base URI for revealed metadata. Each token appends its ID (e.g. ipfs://Qm.../1).
            </p>
          </div>

          {/* Confirmation checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded" style={{ accentColor: "#24315f", flexShrink: 0 }} />
            <span className="text-xs leading-relaxed" style={{ color: "#374151" }}>
              I understand this reveal is permanent and irreversible. I have verified the IPFS URI is correct and all
              metadata is live on IPFS before proceeding.
            </span>
          </label>

          {error && (
            <div className="px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(239,68,68,0.08)", color: "#dc2626", border: "1px solid rgba(239,68,68,0.2)" }}>
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid #e5e7eb" }}>
          <button onClick={onClose} disabled={busy}
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
            Cancel
          </button>
          <button
            onClick={doReveal}
            disabled={busy || !confirmed || !uri.startsWith("ipfs://")}
            className="px-5 py-2 text-sm font-bold rounded-lg flex items-center gap-2"
            style={{
              background: confirmed && uri.startsWith("ipfs://") && !busy ? "#d97706" : "#f3f4f6",
              color:      confirmed && uri.startsWith("ipfs://") && !busy ? "#fff"    : "#9bafc5",
              cursor:     confirmed && uri.startsWith("ipfs://") && !busy ? "pointer" : "default",
            }}>
            {busy ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Revealing…
              </>
            ) : "Confirm Reveal"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reveal Success Modal ───────────────────────────────────────────────────────

function SuccessModal({ txHash, waveNum, onClose }: { txHash: string; waveNum: number; onClose: () => void }) {
  const etherscan = process.env.NEXT_PUBLIC_NETWORK === "mainnet"
    ? `https://etherscan.io/tx/${txHash}`
    : `https://sepolia.etherscan.io/tx/${txHash}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md text-center" style={{ border: "1px solid #e5e7eb" }}>
        <div className="px-8 py-8 space-y-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(22,163,74,0.1)" }}>
            <svg className="w-8 h-8" style={{ color: "#16a34a" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-extrabold" style={{ color: "#24315f" }}>Wave {waveNum} Revealed!</h2>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
              The reveal transaction was submitted on-chain. Buyers can now see their NFT artwork.
            </p>
          </div>
          <div className="px-4 py-3 rounded-xl text-left" style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}>
            <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#9bafc5" }}>Transaction Hash</p>
            <p className="text-xs font-mono break-all" style={{ color: "#374151" }}>{txHash}</p>
          </div>
          <a href={etherscan} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: "#41afeb" }}>
            View on Etherscan
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
        <div className="px-6 pb-6">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: "#24315f" }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Treasury Move Modal ─────────────────────────────────────────────────────

function TreasuryMoveModal({
  wave,
  onClose,
  onSuccess,
}: {
  wave: Wave;
  onClose: () => void;
  onSuccess: (txHash: string) => void;
}) {
  const [useCustom, setUseCustom] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [revealUri, setRevealUri] = useState(wave.waveRevealUri ?? "");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // 0-minted wave that hasn't been revealed yet needs a reveal URI to proceed
  const needsRevealUri = (wave.soldCount ?? 0) === 0 && !wave.waveRevealed;

  const handleSubmit = async () => {
    if (useCustom && !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
      setError("Enter a valid Ethereum address (0x + 40 hex chars)");
      return;
    }
    if (needsRevealUri && !revealUri.trim().startsWith("ipfs://")) {
      setError("Enter a valid IPFS reveal URI (must start with ipfs://)");
      return;
    }
    setSaving(true); setError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 360_000);
    try {
      const body: Record<string, string> = {};
      if (useCustom) body.recipient = recipient;
      if (needsRevealUri && revealUri.trim()) body.revealUri = revealUri.trim();
      const res = await fetch(`/api/nft-sell/waves/${wave.waveNumber}/treasury-close`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Transfer failed"); return; }
      onSuccess(d.txHash ?? "");
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Transaction submitted but is taking longer than expected. Refresh the page in a few minutes to confirm the transfer completed.");
      } else {
        setError("Something went wrong on the server. Please try again.");
      }
    } finally {
      clearTimeout(timer);
      setSaving(false);
    }
  };

  const pendingCount  = wave.treasuryPendingCount ?? 0;
  const canSubmit     = !saving && (!useCustom || !!recipient.trim()) && (!needsRevealUri || revealUri.trim().startsWith("ipfs://"));
  const actionLabel   = saving ? "Transferring…" : "Confirm Transfer";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" style={{ border: "1px solid #e5e7eb" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>
              Move to Wallet — W{wave.waveNumber} {wave.name}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
              {pendingCount.toLocaleString()} unsold NFT{pendingCount !== 1 ? "s" : ""} awaiting transfer
            </p>
          </div>
          <button onClick={onClose} style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          {error && <ErrBanner msg={error} onDismiss={() => setError(null)} />}

          {/* Reveal URI — only for 0-minted unrevealed waves */}
          {needsRevealUri && (
            <div className="px-3.5 py-3 rounded-xl space-y-2"
              style={{ background: "rgba(65,175,235,0.05)", border: "1px solid rgba(65,175,235,0.2)" }}>
              <div className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#41afeb" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[11px] font-semibold" style={{ color: "#24315f" }}>Reveal URI Required</p>
              </div>
              <p className="text-[10px]" style={{ color: "#9bafc5" }}>
                No customers minted in this wave — reveal will run automatically during the transfer. Enter the IPFS metadata base URI to use for this wave&apos;s artwork.
              </p>
              <input
                type="text"
                value={revealUri}
                onChange={e => setRevealUri(e.target.value)}
                placeholder="ipfs://Qm.../metadata"
                className="w-full rounded-lg px-3 py-2 text-xs font-mono"
                style={{ border: "1px solid #d1d5db", outline: "none" }}
              />
            </div>
          )}

          {/* Option A — default treasury wallet */}
          <label
            className="flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition-colors"
            style={{ border: `1.5px solid ${!useCustom ? "#41afeb" : "#e5e7eb"}`, background: !useCustom ? "rgba(65,175,235,0.04)" : "white" }}>
            <input type="radio" checked={!useCustom} onChange={() => setUseCustom(false)} className="mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold" style={{ color: "#24315f" }}>Default Treasury Wallet</p>
              <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                Uses the treasury address configured in the smart contract
              </p>
            </div>
          </label>

          {/* Option B — custom wallet */}
          <label
            className="flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition-colors"
            style={{ border: `1.5px solid ${useCustom ? "#41afeb" : "#e5e7eb"}`, background: useCustom ? "rgba(65,175,235,0.04)" : "white" }}>
            <input type="radio" checked={useCustom} onChange={() => setUseCustom(true)} className="mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold" style={{ color: "#24315f" }}>Custom Wallet Address</p>
              <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                Send NFTs to any Ethereum wallet you specify
              </p>
              {useCustom && (
                <input
                  type="text"
                  value={recipient}
                  onChange={e => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="mt-2 w-full rounded-lg px-3 py-2 text-xs font-mono"
                  style={{ border: "1px solid #d1d5db", outline: "none" }}
                  autoFocus
                />
              )}
            </div>
          </label>

          {/* Gas warning */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
            style={{ background: "rgba(217,119,6,0.07)", border: "1px solid rgba(217,119,6,0.2)", color: "#92400e" }}>
            <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#d97706" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            This submits a blockchain transaction. Gas fees apply and the action cannot be undone.
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "white" }}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: !canSubmit ? "#9bafc5" : "#16a34a", cursor: !canSubmit ? "not-allowed" : "pointer" }}>
              {actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Treasury Transfer Success Modal ─────────────────────────────────────────

function TreasurySuccessModal({ txHash, waveNum, onClose }: { txHash: string; waveNum: number; onClose: () => void }) {
  const etherscan = process.env.NEXT_PUBLIC_NETWORK === "mainnet"
    ? `https://etherscan.io/tx/${txHash}`
    : `https://sepolia.etherscan.io/tx/${txHash}`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md text-center" style={{ border: "1px solid #e5e7eb" }}>
        <div className="px-8 py-8 space-y-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(22,163,74,0.1)" }}>
            <svg className="w-8 h-8" style={{ color: "#16a34a" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-extrabold" style={{ color: "#24315f" }}>Wave {waveNum} Transferred!</h2>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>
              Unsold NFTs from Wave {waveNum} have been minted to the wallet.
            </p>
          </div>
          {txHash && (
            <>
              <div className="px-4 py-3 rounded-xl text-left" style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}>
                <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#9bafc5" }}>Transaction Hash</p>
                <p className="text-xs font-mono break-all" style={{ color: "#374151" }}>{txHash}</p>
              </div>
              <a href={etherscan} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: "#41afeb" }}>
                View on Etherscan
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </>
          )}
        </div>
        <div className="px-6 pb-6">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: "#24315f" }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WavesPage() {
  const searchParams = useSearchParams();
  const strategyHighlight = searchParams.get("saleMethod");
  const strategyName      = searchParams.get("strategy");
  const highlightRef      = useRef<HTMLDivElement>(null);

  // ── Tab state ──
  const [activeTab, setActiveTab] = useState<"waves" | "whitelist" | "packs" | "collaborations">("waves");

  // ── Waves tab state ──
  const [waves, setWaves]             = useState<Wave[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [saleMethods, setSaleMethods] = useState<SaleMethod[]>([]);
  const [wavePage, setWavePage]       = useState(1);
  const WAVES_PER_PAGE = 10;

  // DB edit modal
  const [editWave, setEditWave]   = useState<Wave | null>(null);
  const [manageMaximized, setManageMaximized] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    defaultPriceEth: "", saleMethod: "", scheduledStart: "",
    scheduledEnd: "", status: "", unsoldStrategy: "auto_treasury" as 'auto_treasury' | 'manual',
  });

  // On-chain action modal
  const [chainWave, setChainWave]         = useState<Wave | null>(null);
  const [chainOnChain, setChainOnChain]   = useState<OnChainWaveInfo | null>(null);
  const [chainLoading, setChainLoading]   = useState(false);
  const [chainSaving, setChainSaving]     = useState<string | null>(null);
  const [chainError, setChainError]       = useState<string | null>(null);
  const [chainTx, setChainTx]             = useState<string | null>(null);

  // Chain form fields
  const [chainPrice, setChainPrice]   = useState("");

  // ── Treasury move modal state ──
  const [treasuryMoveWave,    setTreasuryMoveWave]    = useState<Wave | null>(null);
  const [treasurySuccessData, setTreasurySuccessData] = useState<{ txHash: string; waveNum: number } | null>(null);

  // ── Reveal tab state ──
  const [revealWaves,       setRevealWaves]       = useState<WaveSchedule[]>([]);
  const [revealPhase,       setRevealPhase]       = useState<number | null>(null);
  const [revealLoading,     setRevealLoading]     = useState(false);
  const [revealErr,         setRevealErr]         = useState<string | null>(null);
  const [revealWave,        setRevealWave]        = useState<WaveSchedule | null>(null);
  const [revealSuccessData, setRevealSuccessData] = useState<{ txHash: string; waveNum: number } | null>(null);
  const [scheduleEditWave,   setScheduleEditWave]   = useState<WaveSchedule | null>(null);
  const [scheduleEditDate,   setScheduleEditDate]   = useState("");
  const [scheduleEditSaving, setScheduleEditSaving] = useState(false);
  const [scheduleEditErr,    setScheduleEditErr]    = useState<string | null>(null);
  const [blindBoxUrl, setBlindBoxUrl] = useState<string | null>(null);

  // ── Waves tab data loading ──

  const loadWaves = () => {
    setLoading(true); setError(null);
    fetch("/api/nft-sell/waves", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setWaves(d.waves ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load waves."); setLoading(false); });
  };

  // ── Watchdog: silent 30s poll ─────────────────────────────────────────────
  const [waveWatchAlert, setWaveWatchAlert] = useState<string | null>(null);
  const [revealReadyCount, setRevealReadyCount] = useState(0);
  const [watchUpdated, setWatchUpdated] = useState<Date | null>(null);

  const silentWavePoll = useCallback(async () => {
    try {
      const res = await fetch("/api/nft-sell/waves", { credentials: "include" });
      if (!res.ok) return;
      const d = await res.json();
      const updated: Wave[] = d.waves ?? [];
      setWatchUpdated(new Date());

      // detect waves whose reveal date has passed but are not yet revealed
      const now = Date.now();
      const readyToReveal = updated.filter(w =>
        w.revealScheduledAt && new Date(w.revealScheduledAt).getTime() <= now && !w.waveRevealed
      );
      setRevealReadyCount(readyToReveal.length);
      if (readyToReveal.length > 0) {
        setWaveWatchAlert(`${readyToReveal.length} wave${readyToReveal.length > 1 ? "s" : ""} ready to reveal: ${readyToReveal.map(w => `Wave ${w.waveNumber}`).join(", ")}`);
      }

      // silently refresh wave list if data changed
      setWaves(updated);
    } catch { /* silent */ }
  }, []);

  useInterval(silentWavePoll, 30_000);

  useEffect(() => {
    loadWaves();
    loadRevealData();
    fetch("/api/nft-sell/lookups/wave-sale-methods", { credentials: "include" })
      .then(r => r.json())
      .then(d => setSaleMethods(d.saleMethods ?? []))
      .catch(() => {});
    fetch("/api/nft-sell/collection/stats", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.blindBoxImageUrl) setBlindBoxUrl(d.blindBoxImageUrl); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (strategyHighlight && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [strategyHighlight, waves]);

  // ── Reveal tab data loading (lazy) ──

  const loadRevealData = useCallback(async () => {
    setRevealLoading(true); setRevealErr(null);
    try {
      const [wr, sr] = await Promise.all([
        fetch("/api/nft-sell/waves/schedule-status", { credentials: "include" }),
        fetch("/api/nft-sell/scheduler/status",      { credentials: "include" }),
      ]);
      const wd = await wr.json();
      setRevealWaves(wd.waves ?? []);
      if (sr.ok) {
        const sd = await sr.json();
        if (sd.configured) setRevealPhase(sd.currentPhase ?? null);
      }
    } catch {
      setRevealErr("Failed to load wave data");
    } finally {
      setRevealLoading(false);
    }
  }, []);

  const saveRevealDate = async () => {
    if (!scheduleEditWave) return;
    const matched = waves.find(w => w.waveNumber === scheduleEditWave.wave_number);
    if (!matched) { setScheduleEditErr("Wave not found."); return; }
    setScheduleEditSaving(true); setScheduleEditErr(null);
    try {
      const res = await fetch(`/api/waves/${matched.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revealScheduledAt: scheduleEditDate ? new Date(scheduleEditDate).toISOString() : null }),
      });
      if (!res.ok) { const d = await res.json(); setScheduleEditErr(d.error ?? "Save failed"); return; }
      setScheduleEditWave(null);
      loadRevealData();
      loadWaves();
    } catch { setScheduleEditErr("Network error."); }
    finally { setScheduleEditSaving(false); }
  };



  // ── Waves tab handlers ──

  const openEdit = (w: Wave) => {
    setEditWave(w);
    setForm({
      defaultPriceEth:    w.defaultPriceEth != null ? String(w.defaultPriceEth) : "",
      saleMethod:         w.saleMethod ?? "fixed_price",
      scheduledStart:     w.scheduledStart     ? toLocalDateTimeInput(new Date(w.scheduledStart)) : "",
      scheduledEnd:       w.scheduledEnd       ? toLocalDateTimeInput(new Date(w.scheduledEnd))   : "",
      status:             w.status ?? "upcoming",
      unsoldStrategy:     (w.unsoldStrategy ?? "auto_treasury") as 'auto_treasury' | 'manual',
    });
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editWave) return;
    setSaving(true); setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        defaultPriceEth:   form.defaultPriceEth !== "" ? Number(form.defaultPriceEth) : null,
        saleMethod:        form.saleMethod   || null,
        scheduledStart:    form.scheduledStart ? new Date(form.scheduledStart).toISOString() : null,
        scheduledEnd:      form.scheduledEnd   ? new Date(form.scheduledEnd).toISOString()   : null,
        status:            form.status       || null,
        unsoldStrategy:    form.unsoldStrategy,
      };
      const res = await fetch(`/api/waves/${editWave.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setSaveError(d.error ?? "Save failed."); return; }
      setEditWave(null); loadWaves();
    } catch { setSaveError("Network error."); }
    finally { setSaving(false); }
  };

  const openManage = (w: Wave) => {
    openEdit(w);
    setChainWave(w); setChainError(null); setChainTx(null); setChainOnChain(null);
    setChainPrice(w.defaultPriceEth != null ? String(w.defaultPriceEth) : "");
    // Eagerly load on-chain state
    setChainLoading(true);
    fetch(`/api/nft-sell/waves/${w.waveNumber}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setChainOnChain(d.onChain ?? null))
      .catch(() => {})
      .finally(() => setChainLoading(false));
  };

  const closeManage = () => {
    setEditWave(null); setChainWave(null);
    setChainTx(null); setChainError(null);
    setManageMaximized(false);
  };

  const chainOp = async (opName: string, fn: () => Promise<Response>) => {
    setChainSaving(opName); setChainError(null); setChainTx(null);
    try {
      const res = await fn();
      const d   = await res.json();
      if (!res.ok) { setChainError(d.error ?? `${opName} failed.`); return; }
      setChainTx(d.txHash ?? null);
      const fresh = await fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}`, { credentials: "include" }).then(r => r.json());
      setChainOnChain(fresh.onChain ?? null);
      loadWaves();
    } catch { setChainError("Network error."); }
    finally { setChainSaving(null); }
  };

  const handleSetScheduleOnChain = () => {
    if (!editWave?.scheduledStart || !editWave?.scheduledEnd) {
      setChainError("No schedule in DB — set start/end dates in the Settings tab first.");
      return;
    }
    chainOp("schedule", () => fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/schedule`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUnix: Math.floor(new Date(editWave.scheduledStart!).getTime() / 1000),
        endUnix:   Math.floor(new Date(editWave.scheduledEnd!).getTime()   / 1000),
      }),
    }));
  };

  const handleSetPriceOnChain = () => {
    if (!chainPrice || isNaN(parseFloat(chainPrice))) { setChainError("Enter a valid price."); return; }
    chainOp("price", () => fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/price`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceEth: chainPrice }),
    }));
  };


  // ── Reveal tab handlers ──

  function handleRevealSuccess(txHash: string, waveNum: number) {
    setRevealWave(null);
    setRevealSuccessData({ txHash, waveNum });
    loadRevealData();
  }

  // ── Derived values ──

  const totalNfts      = waves.reduce((s, w) => s + (w.quantity ?? 0), 0);
  const activeWave     = waves.find(w => deriveWaveDisplayStatus(w) === "active");
  // Waves whose minting period is over: closed, reveal-scheduled, ready-to-reveal, revealed, or transitional ended
  const completedCount = waves.filter(w =>
    ["revealed", "closed", "reveal_scheduled", "ready_reveal", "ended"].includes(deriveWaveDisplayStatus(w))
  ).length;
  const totalSold      = waves.reduce((s, w) => s + (w.soldCount ?? w.onChain?.soldCount ?? 0), 0);

  const revealNow = Date.now();
  const readyCount = Math.max(
    revealWaves.filter(w => waveState(w) === "ready_reveal").length,
    revealReadyCount
  );
  const nextAction = revealWaves
    .flatMap(w => [
      w.scheduled_start && !w.wave_start_triggered ? { label: `W${w.wave_number} starts`, dt: new Date(w.scheduled_start).getTime() } : null,
      w.reveal_scheduled_at && !w.wave_reveal_triggered && !w.is_revealed ? { label: `W${w.wave_number} reveal due`, dt: new Date(w.reveal_scheduled_at).getTime() } : null,
    ])
    .filter((x): x is { label: string; dt: number } => x !== null && x.dt > revealNow)
    .sort((a, b) => a.dt - b.dt)[0] ?? null;

  // ── Tab UI helpers ──

  const TAB_STYLE_ACTIVE = {
    color: "#24315f",
    borderBottom: "2px solid #41afeb",
    fontWeight: 700,
    background: "transparent",
  };
  const TAB_STYLE_INACTIVE = {
    color: "#9bafc5",
    borderBottom: "2px solid transparent",
    fontWeight: 600,
    background: "transparent",
  };

  return (
    <div className="p-5 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "#24315f" }}>NFT Waves</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            Manage wave pricing, schedules, reveal dates and on-chain wave actions
          </p>
        </div>
        <button
          onClick={activeTab === "waves" ? () => { loadWaves(); loadRevealData(); } : undefined}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "white" }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="ba-tabs" style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div className="flex gap-0">
          {([
            { key: "waves",          label: "Waves" },
            { key: "whitelist",      label: "Whitelist" },
            { key: "packs",          label: "Mystery Packs" },
            { key: "collaborations", label: "Collaborations" },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors"
              style={activeTab === tab.key ? TAB_STYLE_ACTIVE : TAB_STYLE_INACTIVE}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── WAVES TAB ────────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* Watchdog alert — shown across all tabs */}
      {waveWatchAlert && (
        <div className="flex items-center justify-between px-4 py-2 rounded-xl text-sm"
          style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.25)", color: "#d97706" }}>
          <span>⚡ {waveWatchAlert}</span>
          <button onClick={() => setWaveWatchAlert(null)} className="ml-4 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
      {watchUpdated && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#9bafc5" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          Live · last checked {watchUpdated.toLocaleTimeString()}
        </div>
      )}

      {activeTab === "waves" && (
        <>
          {/* Strategy banner */}
          {strategyHighlight && (
            <div ref={highlightRef} className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
              style={{ background: "rgba(65,175,235,0.08)", border: "1px solid rgba(65,175,235,0.3)" }}>
              <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="#41afeb" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <span className="font-bold" style={{ color: "#41afeb" }}>
                  {strategyName ? `Strategy: ${strategyName}` : "Strategy selected"}
                </span>
                <span className="ml-2" style={{ color: "#6b7280" }}>
                  — Configure waves with{" "}
                  <strong>{saleMethods.find(s => s.code === strategyHighlight)?.label ?? strategyHighlight}</strong>{" "}
                  as the sale method. Edit each wave below and set Sale Method accordingly.
                </span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Waves",  value: String(waves.length),    color: "#41afeb" },
              { label: "Complete",      value: String(completedCount),  color: "#16a34a" },
              { label: "Active Wave",  value: activeWave?.name ?? "—", color: "#7c3aed", small: true },
              { label: "Total Minted", value: `${totalSold.toLocaleString()} / ${totalNfts.toLocaleString()}`, color: "#24315f", small: true },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>{s.label}</p>
                <p className={`font-bold ${s.small ? "text-sm" : "text-2xl"}`} style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {error    && <ErrBanner msg={error}     onDismiss={() => setError(null)} />}
          {revealErr && <ErrBanner msg={revealErr} onDismiss={() => setRevealErr(null)} />}

          {/* Contract phase badge */}
          {revealPhase !== null && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: PHASE_COLORS[revealPhase]?.bg ?? "#f3f4f6", color: PHASE_COLORS[revealPhase]?.color ?? "#6b7280" }}>
                Contract: {PHASE_LABELS[revealPhase] ?? `Phase ${revealPhase}`}
              </span>
            </div>
          )}

          {/* Collection Reveal Progress */}
          {revealWaves.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
              <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#9bafc5" }}>
                Collection Reveal Progress
              </p>
              <div className="flex items-center">
                {revealWaves.map((w, i) => {
                  const st   = waveState(w);
                  const meta = STATE_META[st];
                  const isLast = i === revealWaves.length - 1;
                  return (
                    <div key={w.wave_number} className="flex items-center" style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex flex-col items-center" style={{ flexShrink: 0 }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: meta.bg, color: meta.color, border: `2px solid ${meta.color}` }}>
                          {w.is_revealed || st === "ended_zero" ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : st === "ready_reveal" ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                          ) : (
                            <span>{w.wave_number}</span>
                          )}
                        </div>
                        <div className="text-[10px] font-bold mt-1.5" style={{ color: meta.color }}>W{w.wave_number}</div>
                        <div className="text-[9px] mt-0.5 text-center leading-tight" style={{ color: "#9bafc5", maxWidth: 56 }}>
                          {meta.label}
                        </div>
                      </div>
                      {!isLast && (
                        <div style={{
                          flex: 1, height: 2, minWidth: 4,
                          background: w.is_revealed || st === "ended_zero" ? "#16a34a" : "#e5e7eb",
                          margin: "0 4px", marginBottom: 28,
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ready-to-reveal alert */}
          {readyCount > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.3)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(217,119,6,0.15)" }}>
                <svg className="w-4 h-4" style={{ color: "#d97706" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#d97706" }}>
                  {readyCount} wave{readyCount > 1 ? "s" : ""} ready to reveal
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#92400e" }}>
                  Reveal date has passed. Find the wave below and click &quot;Reveal Now&quot;.
                </p>
              </div>
            </div>
          )}

          {/* Next upcoming action */}
          {!readyCount && nextAction && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(65,175,235,0.06)", border: "1px solid rgba(65,175,235,0.2)" }}>
              <svg className="w-4 h-4 flex-shrink-0" style={{ color: "#41afeb" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm" style={{ color: "#374151" }}>
                <strong style={{ color: "#41afeb" }}>Next: </strong>
                {nextAction.label} on {fmtFull(new Date(nextAction.dt).toISOString())}
              </span>
            </div>
          )}

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
                      const isClosed     = w.waveClosed || w.status === "closed";
                      const isLocked     = w.priceLocked;
                      const soldCount    = w.soldCount ?? 0;
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
                              const isAuto = (w.unsoldStrategy ?? 'auto_treasury') === 'auto_treasury';
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
                              // 0-minted closed wave: no reveal date picker needed — backend handles reveal internally during transfer
                              if (isZeroMinted) return (
                                <span className="inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                  style={isAuto
                                    ? { background: "rgba(65,175,235,0.08)", color: "#41afeb", border: "1px solid rgba(65,175,235,0.2)" }
                                    : { background: "rgba(217,119,6,0.08)", color: "#d97706", border: "1px solid rgba(217,119,6,0.2)" }
                                  }>
                                  {isAuto ? "Auto → Treasury" : "Manual Transfer"}
                                </span>
                              );
                              const isReady = !w.waveRevealed && !!w.revealScheduledAt && new Date(w.revealScheduledAt).getTime() <= Date.now();
                              const makeWS = (): WaveSchedule => ({
                                wave_number: w.waveNumber, wave_name: w.name, status: w.status,
                                scheduled_start: w.scheduledStart, scheduled_end: w.scheduledEnd,
                                reveal_scheduled_at: w.revealScheduledAt, wave_start_triggered: false,
                                wave_end_triggered: true, wave_reveal_triggered: false,
                                is_revealed: w.waveRevealed ?? false, wave_revealed_at: w.waveRevealedAt,
                                sold_count: w.soldCount ?? 0, minted_count: w.soldCount ?? 0, quantity: w.quantity ?? 0,
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
                                  <button onClick={() => setRevealWave(makeWS())}
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
                                    onClick={() => {
                                      setScheduleEditWave(makeWS());
                                      setScheduleEditDate(w.revealScheduledAt ? toLocalDateTimeInput(new Date(w.revealScheduledAt)) : "");
                                      setScheduleEditErr(null);
                                    }}
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
                              <button onClick={() => openManage(w)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                                style={{ background: "#24315f" }}>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Manage
                              </button>
                              {/* 0-minted wave: manual strategy only — auto_treasury is handled automatically on reveal */}
                              {isZeroMinted && !w.closeAction && isClosed && w.unsoldStrategy === 'manual' && (
                                <button
                                  onClick={() => setTreasuryMoveWave(w)}
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
                                w.unsoldStrategy === 'manual' &&
                                (w.treasuryPendingCount ?? 0) > 0
                              && (
                                <button
                                  onClick={() => setTreasuryMoveWave(w)}
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
      )}

      {activeTab === "whitelist"      && <WhitelistTab />}
      {activeTab === "packs"          && <PacksTab />}
      {activeTab === "collaborations" && <CollaborationsTab />}

      {/* ── Reveal Date Editor Modal ─────────────────────────────────────── */}
      {scheduleEditWave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="ba-modal-sm shadow-xl">
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
              <div>
                <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>
                  Set Reveal Date — W{scheduleEditWave.wave_number} {scheduleEditWave.wave_name}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                  Choose when this wave will be revealed to holders
                </p>
              </div>
              <button onClick={() => setScheduleEditWave(null)} style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {scheduleEditErr && <ErrBanner msg={scheduleEditErr} onDismiss={() => setScheduleEditErr(null)} />}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
                  Reveal Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduleEditDate}
                  onChange={e => setScheduleEditDate(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ border: "1px solid #d1d5db", outline: "none" }}
                />
                <p className="text-xs mt-1.5" style={{ color: "#9bafc5" }}>
                  This date is shown to your community. The actual on-chain reveal tx runs when you click &quot;Reveal Now&quot;.
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setScheduleEditWave(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "white" }}>
                  Cancel
                </button>
                <button
                  onClick={saveRevealDate}
                  disabled={scheduleEditSaving || !scheduleEditDate}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{ background: scheduleEditSaving || !scheduleEditDate ? "#9bafc5" : "#7c3aed", cursor: scheduleEditSaving || !scheduleEditDate ? "not-allowed" : "pointer" }}>
                  {scheduleEditSaving ? "Saving…" : "Save Reveal Date"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reveal Modals ────────────────────────────────────────────────── */}
      {revealWave && (
        <RevealModal
          wave={revealWave}
          onClose={() => setRevealWave(null)}
          onSuccess={(txHash) => handleRevealSuccess(txHash, revealWave.wave_number)}
        />
      )}
      {revealSuccessData && (
        <SuccessModal
          txHash={revealSuccessData.txHash}
          waveNum={revealSuccessData.waveNum}
          onClose={() => setRevealSuccessData(null)}
        />
      )}

      {/* ── Treasury Move Modal ─────────────────────────────────────────────── */}
      {treasuryMoveWave && (
        <TreasuryMoveModal
          wave={treasuryMoveWave}
          onClose={() => setTreasuryMoveWave(null)}
          onSuccess={(txHash) => {
            setTreasuryMoveWave(null);
            setTreasurySuccessData({ txHash, waveNum: treasuryMoveWave.waveNumber });
            loadWaves();
          }}
        />
      )}
      {treasurySuccessData && (
        <TreasurySuccessModal
          txHash={treasurySuccessData.txHash}
          waveNum={treasurySuccessData.waveNum}
          onClose={() => { setTreasurySuccessData(null); }}
        />
      )}

      {/* ══ Manage Modal ═══════════════════════════════════════════════════════ */}
      {editWave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className={`ba-modal-manage shadow-xl flex flex-col transition-all duration-200${manageMaximized ? " maximized" : ""}`}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>
                    W{editWave.waveNumber}
                  </span>
                  <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>{editWave.name}</h2>
                </div>
                <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                  Configure wave settings and push on-chain actions
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setManageMaximized(m => !m)}
                  title={manageMaximized ? "Restore" : "Maximize"}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                  style={{ color: "#9bafc5", border: "1px solid #e5e7eb" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "#374151"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9bafc5"; }}>
                  {manageMaximized ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  )}
                </button>
                <button onClick={closeManage} style={{ color: "#9bafc5" }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Single scrollable body */}
            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              {saveError && (
                <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  {saveError}
                </div>
              )}

              {/* Wave Quantity — read-only */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <svg className="w-4 h-4 flex-shrink-0" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <div>
                  <p className="text-xs font-bold" style={{ color: "#374151" }}>
                    Wave Quantity: {(editWave.quantity ?? 0).toLocaleString()} NFTs
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                    Fixed at launch — predefined by the Fibonacci allocation plan
                  </p>
                </div>
              </div>

              {/* Price + Sale Method — Wave 1 = free; Waves 2-7 = fixed price
                  Closed waves: read-only display; active/upcoming: editable (locked if priceLocked) */}
              {editWave.waveNumber === 1 ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(65,175,235,0.07)", border: "1px solid rgba(65,175,235,0.2)" }}>
                  <span className="text-xs font-semibold" style={{ color: "#41afeb" }}>Free Mint — no price applies to Wave 1</span>
                </div>
              ) : editWave.waveClosed ? (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                  style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <div>
                    <p className="text-xs font-bold" style={{ color: "#374151" }}>
                      Final Price: {editWave.defaultPriceEth != null ? `${editWave.defaultPriceEth} ETH` : "Free"} · Fixed Price
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                      Wave closed — price and sale method are permanently locked
                    </p>
                  </div>
                </div>
              ) : (
                <div className="ba-form-2">
                  <div>
                    <label style={labelStyle}>Default Price (ETH)</label>
                    <input type="number" step="0.0001" min="0"
                      value={form.defaultPriceEth}
                      onChange={e => { if (!editWave.priceLocked) setForm({ ...form, defaultPriceEth: e.target.value }); }}
                      style={editWave.priceLocked ? { ...inputStyle, background: "#f9fafb", color: "#6b7280", cursor: "not-allowed" } : inputStyle}
                      readOnly={!!editWave.priceLocked}
                      placeholder="0 = Free" />
                    {editWave.priceLocked && (
                      <p className="text-xs mt-1" style={{ color: "#dc2626" }}>
                        Locked — first sale occurred. Price cannot be changed.
                      </p>
                    )}
                  </div>
                  <div>
                    <label style={labelStyle}>Sale Method</label>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ background: "rgba(65,175,235,0.07)", border: "1px solid rgba(65,175,235,0.2)", height: "38px" }}>
                      <span className="text-xs font-semibold" style={{ color: "#41afeb" }}>Fixed Price</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Emergency Pause — only for upcoming/active waves; hidden for closed/revealed (no minting occurs) */}
              {!editWave.waveClosed && <div className="flex items-center justify-between p-3 rounded-xl"
                style={{
                  background: form.status === PAUSE_TOGGLE ? "rgba(217,119,6,0.07)" : "#f9fafb",
                  border: `1px solid ${form.status === PAUSE_TOGGLE ? "rgba(217,119,6,0.3)" : "#e5e7eb"}`,
                }}>
                <div>
                  <p className="text-xs font-bold" style={{ color: form.status === PAUSE_TOGGLE ? "#d97706" : "#374151" }}>
                    Emergency Pause
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                    Halts minting for this wave. Auto-trigger will not override this at wave start.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-4 flex-shrink-0">
                  <input type="checkbox" className="sr-only"
                    checked={form.status === PAUSE_TOGGLE}
                    onChange={e => {
                      if (e.target.checked) {
                        setForm({ ...form, status: "paused" });
                      } else {
                        // Derive correct auto-managed status from schedule
                        const now = new Date();
                        let autoStatus = "upcoming";
                        if (editWave.scheduledEnd && new Date(editWave.scheduledEnd) <= now) {
                          autoStatus = "closed";
                        } else if (editWave.scheduledStart && new Date(editWave.scheduledStart) <= now) {
                          autoStatus = "active";
                        }
                        setForm({ ...form, status: autoStatus });
                      }
                    }} />
                  <div className="w-10 h-6 rounded-full transition-colors"
                    style={{ background: form.status === PAUSE_TOGGLE ? "#d97706" : "#d1d5db" }} />
                  <div className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform"
                    style={{ left: 4, transform: form.status === PAUSE_TOGGLE ? "translateX(16px)" : "translateX(0)" }} />
                </label>
              </div>}

              {/* Schedule — read-only once wave has started (API also rejects date changes after start) */}
              {(() => {
                const schedLocked = editWave.waveClosed ||
                  editWave.status === "active" ||
                  !!(editWave.scheduledStart && new Date(editWave.scheduledStart) <= new Date());
                return (
                  <div className="space-y-3">
                    <label style={{ ...labelStyle, marginBottom: 0 }}>Wave Schedule</label>
                    {schedLocked ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-2.5 rounded-lg" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#9bafc5" }}>Start Date</p>
                            <p className="text-xs font-semibold" style={{ color: "#374151" }}>
                              {editWave.scheduledStart ? new Date(editWave.scheduledStart).toLocaleString() : <span style={{ color: "#d1d5db" }}>Not set</span>}
                            </p>
                          </div>
                          <div className="p-2.5 rounded-lg" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#9bafc5" }}>End Date</p>
                            <p className="text-xs font-semibold" style={{ color: "#374151" }}>
                              {editWave.scheduledEnd ? new Date(editWave.scheduledEnd).toLocaleString() : <span style={{ color: "#d1d5db" }}>Not set</span>}
                            </p>
                          </div>
                        </div>
                        <p className="text-[10px]" style={{ color: "#9bafc5" }}>
                          Wave schedule is locked — dates cannot be changed after the wave starts.
                        </p>
                      </>
                    ) : (
                      <div className="ba-form-2">
                        <div>
                          <label style={labelStyle}>Start Date</label>
                          <input type="datetime-local" value={form.scheduledStart}
                            onChange={e => setForm({ ...form, scheduledStart: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                          <label style={labelStyle}>End Date</label>
                          <input type="datetime-local" value={form.scheduledEnd}
                            onChange={e => setForm({ ...form, scheduledEnd: e.target.value })} style={inputStyle} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── On-Chain Actions ── */}
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(217,119,6,0.07)", border: "1px solid rgba(217,119,6,0.25)" }}>
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#d97706" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-xs font-bold mb-0.5" style={{ color: "#d97706" }}>On-Chain Actions</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#92400e" }}>
                    Each action submits a blockchain transaction. Costs gas, requires wallet approval, and cannot be undone.
                  </p>
                </div>
              </div>

              {chainLoading && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "#9bafc5" }}>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Reading on-chain state…
                </div>
              )}

              {chainOnChain && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Minted", value: `${chainOnChain.soldCount} / ${chainOnChain.qty}` },
                    { label: "Price",  value: `${chainOnChain.price} ETH` },
                    { label: "Closed", value: chainOnChain.closed ? "Yes" : "No" },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                      <p className="text-xs" style={{ color: "#9bafc5" }}>{s.label}</p>
                      <p className="font-bold text-sm mt-0.5" style={{ color: "#24315f" }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* DB ↔ On-Chain price sync indicator — shows when the price buyers actually pay differs from the DB record */}
              {chainOnChain && editWave.waveNumber > 1 && (() => {
                const onChainPrice = parseFloat(chainOnChain.price);
                const dbPrice = editWave.defaultPriceEth;
                if (dbPrice == null) return null;
                const outOfSync = Math.abs(onChainPrice - dbPrice) > 0.000001;
                return outOfSync ? (
                  <div className="flex items-start gap-3 p-3 rounded-xl text-xs"
                    style={{ background: "rgba(220,38,38,0.06)", border: "1px solid #fecaca" }}>
                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#dc2626" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div style={{ color: "#dc2626" }}>
                      <p className="font-bold">Price out of sync</p>
                      <p className="mt-0.5">
                        On-chain: <strong>{chainOnChain.price} ETH</strong> · DB: <strong>{dbPrice} ETH</strong>
                      </p>
                      {!editWave.waveClosed && !editWave.priceLocked && (
                        <p className="mt-0.5" style={{ color: "#92400e" }}>
                          Use &quot;Set Wave Price On-Chain&quot; below to sync the on-chain price to match DB.
                        </p>
                      )}
                      {editWave.priceLocked && (
                        <p className="mt-0.5" style={{ color: "#92400e" }}>
                          Price is locked (first sale occurred) — on-chain and DB are now permanently diverged.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                    style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.3)", color: "#16a34a" }}>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    On-chain price matches DB ({dbPrice} ETH)
                  </div>
                );
              })()}

              {chainTx    && <SharedTxBanner txHash={chainTx} />}
              {chainError && <ErrBanner msg={chainError} onDismiss={() => setChainError(null)} />}

              {/* Schedule Push — only before wave has started (upcoming only) */}
              {(() => {
                const waveStarted = editWave.waveClosed || editWave.status === "active";
                return !waveStarted ? (
                  <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                    <p className="text-xs font-bold" style={{ color: "#24315f" }}>Push Wave Schedule On-Chain</p>
                    <p className="text-xs" style={{ color: "#9bafc5" }}>
                      The system auto-pushes when the scheduled date arrives. Use this only if you need to push early or re-sync.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2.5 rounded-lg" style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#9bafc5" }}>Start Date</p>
                        <p className="text-xs font-semibold" style={{ color: "#374151" }}>
                          {editWave.scheduledStart ? new Date(editWave.scheduledStart).toLocaleString() : <span style={{ color: "#d1d5db" }}>Not set</span>}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg" style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
                        <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#9bafc5" }}>End Date</p>
                        <p className="text-xs font-semibold" style={{ color: "#374151" }}>
                          {editWave.scheduledEnd ? new Date(editWave.scheduledEnd).toLocaleString() : <span style={{ color: "#d1d5db" }}>Not set</span>}
                        </p>
                      </div>
                    </div>
                    <button onClick={handleSetScheduleOnChain} disabled={chainSaving === "schedule" || !editWave.scheduledStart || !editWave.scheduledEnd}
                      className="px-4 py-2 text-xs font-bold text-white rounded-lg"
                      style={{ background: chainSaving === "schedule" || !editWave.scheduledStart || !editWave.scheduledEnd ? "#9bafc5" : "#41afeb" }}>
                      {chainSaving === "schedule" ? "Submitting…" : "Push Schedule to Chain"}
                    </button>
                  </div>
                ) : null;
              })()}

              {/* Set Price — paid waves only, only before wave closes, only if not locked */}
              {editWave.waveNumber > 1 && !editWave.waveClosed && (
                editWave.priceLocked ? (
                  <div className="px-4 py-3 rounded-xl text-xs" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                    Price locked — first sale has already occurred. No further price changes allowed.
                  </div>
                ) : (
                  <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                    <p className="text-xs font-bold" style={{ color: "#24315f" }}>Set Wave Price On-Chain</p>
                    <p className="text-xs" style={{ color: "#9bafc5" }}>Only allowed before the first sale in this wave.</p>
                    <div className="flex gap-2 items-end">
                      <div className="flex-1">
                        <label style={labelStyle}>Price (ETH)</label>
                        <input type="number" step="0.0001" min="0" value={chainPrice}
                          onChange={e => setChainPrice(e.target.value)} style={inputStyle} />
                      </div>
                      <button onClick={handleSetPriceOnChain} disabled={chainSaving === "price"}
                        className="px-4 py-2 text-xs font-bold text-white rounded-lg flex-shrink-0"
                        style={{ background: chainSaving === "price" ? "#9bafc5" : "#41afeb" }}>
                        {chainSaving === "price" ? "Submitting…" : "Set Price"}
                      </button>
                    </div>
                  </div>
                )
              )}

              {/* Unsold NFT Strategy — set BEFORE reveal; locked once wave is revealed */}
              <div>
                <label className="text-xs font-semibold mb-2 block" style={{ color: "#374151" }}>
                  Unsold NFT Strategy
                </label>
                <p className="text-[11px] mb-2.5" style={{ color: "#9bafc5" }}>
                  Determines what happens to unsold NFTs when this wave is revealed. Must be set before reveal.
                </p>
                <div className="flex gap-2">
                  {/* Auto → Treasury */}
                  <button
                    disabled={!!editWave.waveRevealed}
                    onClick={() => !editWave.waveRevealed && setForm(f => ({ ...f, unsoldStrategy: "auto_treasury" }))}
                    className="flex-1 flex flex-col gap-1 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{
                      border: `1.5px solid ${form.unsoldStrategy === "auto_treasury" ? "#41afeb" : "#e5e7eb"}`,
                      background: form.unsoldStrategy === "auto_treasury" ? "rgba(65,175,235,0.06)" : "white",
                      opacity: editWave.waveRevealed ? 0.5 : 1,
                      cursor: editWave.waveRevealed ? "not-allowed" : "pointer",
                    }}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{ borderColor: form.unsoldStrategy === "auto_treasury" ? "#41afeb" : "#d1d5db" }}>
                        {form.unsoldStrategy === "auto_treasury" && (
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#41afeb" }} />
                        )}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: "#24315f" }}>Auto → Treasury Wallet</span>
                    </div>
                    <p className="text-[10px] ml-5" style={{ color: "#9bafc5" }}>
                      Unsold NFTs automatically transfer to the treasury wallet as part of the reveal process. No extra admin action needed.
                    </p>
                  </button>
                  {/* Manual */}
                  <button
                    disabled={!!editWave.waveRevealed}
                    onClick={() => !editWave.waveRevealed && setForm(f => ({ ...f, unsoldStrategy: "manual" }))}
                    className="flex-1 flex flex-col gap-1 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{
                      border: `1.5px solid ${form.unsoldStrategy === "manual" ? "#d97706" : "#e5e7eb"}`,
                      background: form.unsoldStrategy === "manual" ? "rgba(217,119,6,0.05)" : "white",
                      opacity: editWave.waveRevealed ? 0.5 : 1,
                      cursor: editWave.waveRevealed ? "not-allowed" : "pointer",
                    }}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                        style={{ borderColor: form.unsoldStrategy === "manual" ? "#d97706" : "#d1d5db" }}>
                        {form.unsoldStrategy === "manual" && (
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#d97706" }} />
                        )}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: "#24315f" }}>Manual Transfer</span>
                    </div>
                    <p className="text-[10px] ml-5" style={{ color: "#9bafc5" }}>
                      Reveal runs for sold NFTs only. Admin manually moves unsold NFTs to treasury or a custom wallet using "Move to Wallet".
                    </p>
                  </button>
                </div>
                {editWave.waveRevealed && (
                  <p className="text-[10px] mt-1.5" style={{ color: "#9bafc5" }}>
                    Strategy is locked — this wave has already been revealed.
                  </p>
                )}
              </div>

              {/* Reveal status */}
              {editWave.waveRevealed ? (
                <div className="px-4 py-3 rounded-xl text-xs flex items-center gap-2"
                  style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.3)", color: "#16a34a" }}>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  This wave has been revealed
                </div>
              ) : (
                <div className="px-4 py-3 rounded-xl text-xs flex items-center gap-2"
                  style={{ background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.2)", color: "#7c3aed" }}>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {editWave.revealScheduledAt
                    ? `Reveal scheduled for ${new Date(editWave.revealScheduledAt).toLocaleString()} — system will auto-reveal`
                    : `No reveal date set — use the "Set Date" button in the Waves table`}
                </div>
              )}
            </div>

            {/* Footer — Save only shown for non-closed waves (closed = all settings are historical/read-only) */}
            <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #e5e7eb" }}>
              <button onClick={closeManage} className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Close</button>
              {(!editWave.waveClosed || !editWave.waveRevealed) && (
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                  style={{ background: saving ? "#9bafc5" : "#41afeb" }}>
                  {saving ? "Saving…" : "Save Settings"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
