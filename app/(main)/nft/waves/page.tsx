"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useInterval } from "@/lib/useInterval";
import { ErrBanner, OkBanner, TxBanner as SharedTxBanner } from "@/components/nft/Banner";
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
  closeAction?: string | null;
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

const STATUS_OPTS = ["upcoming", "active", "completed", "paused"];

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

function waveState(w: WaveSchedule): "revealed" | "ready_reveal" | "reveal_scheduled" | "active" | "ended" | "upcoming" | "not_scheduled" {
  const now = Date.now();
  if (w.is_revealed) return "revealed"; // authoritative flag — wave_reveal_triggered alone may be set on a failed tx
  if (w.reveal_scheduled_at && new Date(w.reveal_scheduled_at).getTime() <= now) return "ready_reveal";
  if (w.reveal_scheduled_at && new Date(w.reveal_scheduled_at).getTime() > now)  return "reveal_scheduled";
  if (w.wave_start_triggered && !w.wave_end_triggered) return "active";
  if (w.wave_end_triggered)   return "ended";
  if (w.scheduled_start && new Date(w.scheduled_start).getTime() > now) return "upcoming";
  return "not_scheduled";
}

const STATE_META: Record<string, { label: string; color: string; bg: string }> = {
  revealed:         { label: "Revealed",          color: "#16a34a", bg: "rgba(22,163,74,0.1)" },
  ready_reveal:     { label: "Ready to Reveal",   color: "#d97706", bg: "rgba(217,119,6,0.12)" },
  reveal_scheduled: { label: "Reveal Scheduled",  color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
  active:           { label: "Active",             color: "#41afeb", bg: "rgba(65,175,235,0.1)" },
  ended:            { label: "Wave Ended",         color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
  upcoming:         { label: "Upcoming",           color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  not_scheduled:    { label: "Not Scheduled",      color: "#9bafc5", bg: "rgba(156,163,175,0.1)" },
};

// ─── Sub-components (Waves tab) ───────────────────────────────────────────────

const WAVE_COLORS = {
  completed: { bg: "rgba(22,163,74,0.1)",    color: "#16a34a", label: "Completed" },
  revealed:  { bg: "rgba(124,58,237,0.1)",   color: "#7c3aed", label: "Revealed"  },
  active:    { bg: "rgba(65,175,235,0.12)",  color: "#41afeb", label: "Active"    },
  upcoming:  { bg: "rgba(156,163,175,0.12)", color: "#9ca3af", label: "Upcoming"  },
  paused:    { bg: "rgba(217,119,6,0.1)",    color: "#d97706", label: "Paused"    },
  closed:    { bg: "rgba(22,163,74,0.1)",    color: "#16a34a", label: "Closed"    },
  ended:     { bg: "rgba(107,114,128,0.1)",  color: "#6b7280", label: "Ended"     },
  sold_out:  { bg: "rgba(124,58,237,0.1)",   color: "#7c3aed", label: "Sold Out"  },
};

function deriveWaveDisplayStatus(w: Wave): string {
  if (w.waveRevealed) return "revealed";
  if (w.waveClosed)   return "closed";
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
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleSubmit = async () => {
    if (useCustom && !/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
      setError("Enter a valid Ethereum address (0x + 40 hex chars)");
      return;
    }
    setSaving(true); setError(null);
    try {
      const body = useCustom ? { recipient } : {};
      const res = await fetch(`/api/nft-sell/waves/${wave.waveNumber}/treasury-close`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Transfer failed"); return; }
      onSuccess(d.txHash ?? "");
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  };

  const pendingCount = wave.treasuryPendingCount ?? 0;

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
              disabled={saving || (useCustom && !recipient.trim())}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: saving || (useCustom && !recipient.trim()) ? "#9bafc5" : "#16a34a", cursor: saving || (useCustom && !recipient.trim()) ? "not-allowed" : "pointer" }}>
              {saving ? "Transferring…" : "Confirm Transfer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Treasury Transfer Success Modal ─────────────────────────────────────────

function TreasurySuccessModal({ txHash, waveNum, onClose }: { txHash: string; waveNum: number; onClose: () => void }) {
  const etherscan = `https://etherscan.io/tx/${txHash}`;
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
  const [activeTab, setActiveTab] = useState<"waves" | "reveal" | "whitelist" | "packs" | "collaborations">("waves");

  // ── Waves tab state ──
  const [waves, setWaves]             = useState<Wave[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [saleMethods, setSaleMethods] = useState<SaleMethod[]>([]);
  const [wavePage, setWavePage]       = useState(1);
  const WAVES_PER_PAGE = 10;

  // DB edit modal
  const [editWave, setEditWave]   = useState<Wave | null>(null);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    defaultPriceEth: "", saleMethod: "", scheduledStart: "",
    scheduledEnd: "", revealScheduledAt: "", status: "", notes: "",
    clearSchedule: false,
  });

  // Tier prices form
  const [tierLegendary, setTierLegendary] = useState("");
  const [tierEpic, setTierEpic]           = useState("");
  const [tierRare, setTierRare]           = useState("");
  const [tierCommon, setTierCommon]       = useState("");
  const [tierSaving, setTierSaving]       = useState(false);
  const [tierOk, setTierOk]               = useState<string | null>(null);
  const [tierErr, setTierErr]             = useState<string | null>(null);

  // Unified Manage modal tab
  const [manageTab, setManageTab] = useState<"settings" | "blockchain">("settings");

  // On-chain action modal
  const [chainWave, setChainWave]         = useState<Wave | null>(null);
  const [chainOnChain, setChainOnChain]   = useState<OnChainWaveInfo | null>(null);
  const [chainLoading, setChainLoading]   = useState(false);
  const [chainSaving, setChainSaving]     = useState<string | null>(null);
  const [chainError, setChainError]       = useState<string | null>(null);
  const [chainTx, setChainTx]             = useState<string | null>(null);

  // Chain form fields
  const [chainPrice, setChainPrice]   = useState("");
  const [chainStart, setChainStart]   = useState("");
  const [chainEnd, setChainEnd]       = useState("");
  const [auctionTo, setAuctionTo]     = useState("");
  const [auctionQty, setAuctionQty]   = useState("1");
  const [auctionListingId, setAuctionListingId]     = useState("");
  const [auctionStartPrice, setAuctionStartPrice]   = useState("");

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
  const revealLoadedRef = useRef(false);
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
    fetch("/api/nft-sell/lookups/wave-sale-methods", { credentials: "include" })
      .then(r => r.json())
      .then(d => setSaleMethods(d.saleMethods ?? []))
      .catch(() => {});
    fetch("/api/nft-sell/collection/stats", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.blindBoxImageUrl) setBlindBoxUrl(d.blindBoxImageUrl); })
      .catch(() => {});
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

  // Load reveal data only when Reveal tab becomes active (lazy)
  useEffect(() => {
    if (activeTab === "reveal" && !revealLoadedRef.current) {
      revealLoadedRef.current = true;
      loadRevealData();
    }
  }, [activeTab, loadRevealData]);

  // Lazy-load on-chain data when Blockchain tab is activated in Manage modal
  useEffect(() => {
    if (manageTab === "blockchain" && chainWave && !chainOnChain && !chainLoading) {
      setChainLoading(true);
      fetch(`/api/nft-sell/waves/${chainWave.waveNumber}`, { credentials: "include" })
        .then(r => r.json())
        .then(d => setChainOnChain(d.onChain ?? null))
        .catch(() => {})
        .finally(() => setChainLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manageTab]);

  // ── Waves tab handlers ──

  const openEdit = (w: Wave) => {
    setEditWave(w);
    setForm({
      defaultPriceEth:    w.defaultPriceEth != null ? String(w.defaultPriceEth) : "",
      saleMethod:         w.saleMethod ?? "fixed_price",
      scheduledStart:     w.scheduledStart     ? w.scheduledStart.slice(0, 16)     : "",
      scheduledEnd:       w.scheduledEnd       ? w.scheduledEnd.slice(0, 16)       : "",
      revealScheduledAt:  w.revealScheduledAt  ? w.revealScheduledAt.slice(0, 16)  : "",
      status:             w.status ?? "upcoming",
      notes:              w.notes  ?? "",
      clearSchedule:      false,
    });
    setTierLegendary(w.tierPrices?.legendary != null ? String(w.tierPrices.legendary) : "");
    setTierEpic(w.tierPrices?.epic           != null ? String(w.tierPrices.epic)       : "");
    setTierRare(w.tierPrices?.rare           != null ? String(w.tierPrices.rare)       : "");
    setTierCommon(w.tierPrices?.common       != null ? String(w.tierPrices.common)     : "");
    setTierOk(null); setTierErr(null);
    setSaveError(null);
  };

  const saveTierPrices = async () => {
    if (!editWave) return;
    setTierSaving(true); setTierOk(null); setTierErr(null);
    try {
      const tier_prices: Record<string, number> = {};
      if (tierLegendary !== "") tier_prices.legendary = parseFloat(tierLegendary);
      if (tierEpic      !== "") tier_prices.epic      = parseFloat(tierEpic);
      if (tierRare      !== "") tier_prices.rare      = parseFloat(tierRare);
      if (tierCommon    !== "") tier_prices.common    = parseFloat(tierCommon);

      const r = await fetch(`/api/nft-sell/waves/${editWave.waveNumber}/tier-prices`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier_prices }),
      });
      const d = await r.json();
      if (!r.ok) { setTierErr(d.error ?? "Save failed"); return; }
      setTierOk("Tier prices saved");
    } catch { setTierErr("Network error"); }
    finally { setTierSaving(false); }
  };

  const handleSave = async () => {
    if (!editWave) return;
    setSaving(true); setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        defaultPriceEth:   form.defaultPriceEth !== "" ? Number(form.defaultPriceEth) : null,
        saleMethod:        form.saleMethod   || null,
        scheduledStart:    form.clearSchedule ? null : (form.scheduledStart    ? new Date(form.scheduledStart).toISOString()    : null),
        scheduledEnd:      form.clearSchedule ? null : (form.scheduledEnd      ? new Date(form.scheduledEnd).toISOString()      : null),
        revealScheduledAt: form.clearSchedule ? null : (form.revealScheduledAt ? new Date(form.revealScheduledAt).toISOString() : null),
        status:            form.status       || null,
        notes:             form.notes        || null,
        clearSchedule:     form.clearSchedule,
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

  const openManage = (w: Wave, tab: "settings" | "blockchain" = "settings") => {
    // open settings panel
    openEdit(w);
    // prepare blockchain panel (data loaded lazily when tab is activated)
    setChainWave(w); setChainError(null); setChainTx(null); setChainOnChain(null);
    setChainPrice(w.defaultPriceEth != null ? String(w.defaultPriceEth) : "");
    setChainStart(w.scheduledStart ? w.scheduledStart.slice(0, 16) : "");
    setChainEnd(w.scheduledEnd     ? w.scheduledEnd.slice(0, 16)   : "");
    setManageTab(tab);
  };

  const closeManage = () => {
    setEditWave(null); setChainWave(null);
    setChainTx(null); setChainError(null); setManageTab("settings");
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
    if (!chainStart || !chainEnd) { setChainError("Both start and end times required."); return; }
    chainOp("schedule", () => fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/schedule`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUnix: Math.floor(new Date(chainStart).getTime() / 1000),
        endUnix:   Math.floor(new Date(chainEnd).getTime()   / 1000),
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


  const handleMintTransfer = () => {
    if (!auctionTo) { setChainError("Recipient address required."); return; }
    chainOp("mint-transfer", () => fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/auction-mint`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: auctionTo, qty: parseInt(auctionQty, 10) }),
    }));
  };

  const handleSaveAuctionListing = () => {
    if (!auctionListingId) { setChainError("Listing ID required."); return; }
    chainOp("auction", () => fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/auction-listing`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: auctionListingId, startPriceEth: auctionStartPrice }),
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
  const completedCount = waves.filter(w => ["revealed", "completed", "sold_out", "closed"].includes(deriveWaveDisplayStatus(w))).length;
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
          onClick={activeTab === "reveal" ? loadRevealData : activeTab === "waves" ? loadWaves : undefined}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "white" }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div className="flex gap-0">
          {([
            { key: "waves",          label: "Waves" },
            { key: "reveal",         label: "Reveal", badge: readyCount > 0 ? readyCount : null },
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
              {"badge" in tab && tab.badge !== null && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold text-white"
                  style={{ background: "#d97706", fontSize: 10 }}>
                  {tab.badge}
                </span>
              )}
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

          {error && <ErrBanner msg={error} onDismiss={() => setError(null)} />}

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
                      {["Wave", "Qty", "Price (ETH)", "Minted", "Sale Method", "Schedule", "Reveal Date", "Status", "Reveal", ""].map(h => (
                        <th key={h} style={{ ...thStyle, textAlign: ["Qty", "Minted", "Reveal"].includes(h) ? "center" : "left" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {waves.slice((wavePage - 1) * WAVES_PER_PAGE, wavePage * WAVES_PER_PAGE).map((w, i) => {
                      const isClosed = w.waveClosed || w.status === "closed";
                      const isLocked = w.priceLocked;
                      return (
                        <tr key={w.id}
                          style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                          onMouseLeave={e => (e.currentTarget.style.background = "")}>

                          <td style={{ padding: "10px 14px" }}>
                            <div className="flex items-center gap-2">
                              {blindBoxUrl ? (
                                <img
                                  src={blindBoxUrl}
                                  alt="NFT"
                                  className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                                  style={{ border: isClosed ? "2px solid #16a34a" : w.status === "active" ? "2px solid #41afeb" : "2px solid #e5e7eb" }}
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                                  style={{ background: "#f4f6fb", border: isClosed ? "2px solid #16a34a" : w.status === "active" ? "2px solid #41afeb" : "2px solid #e5e7eb" }}>
                                  🐻
                                </div>
                              )}
                              <div>
                                <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded mb-0.5"
                                  style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>
                                  W{w.waveNumber}
                                </span>
                                <div className="font-semibold text-xs" style={{ color: "#111827" }}>{w.name}</div>
                              </div>
                            </div>
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
                              {w.tierPrices && Object.keys(w.tierPrices).length > 0 && (
                                <span className="text-xs" style={{ color: "#7c3aed" }}>Tier-priced</span>
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
                            {w.waveRevealed && w.waveRevealedAt ? (
                              <div className="text-xs font-semibold" style={{ color: "#16a34a" }}>
                                <div>{new Date(w.waveRevealedAt).toLocaleDateString()}</div>
                                <div style={{ color: "#16a34a", fontWeight: 400, opacity: 0.7 }}>{new Date(w.waveRevealedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</div>
                              </div>
                            ) : w.revealScheduledAt ? (
                              <div className="text-xs font-semibold" style={{ color: "#7c3aed" }}>
                                <div>{new Date(w.revealScheduledAt).toLocaleDateString()}</div>
                                <div style={{ color: "#9bafc5", fontWeight: 400 }}>{new Date(w.revealScheduledAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</div>
                              </div>
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
                            {w.waveRevealed ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                Done
                              </span>
                            ) : w.revealScheduledAt ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}>
                                  Scheduled
                                </span>
                                <span className="text-[9px]" style={{ color: "#9bafc5" }}>
                                  {new Date(w.revealScheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{ background: "#f3f4f6", color: "#9bafc5" }}>
                                Blind
                              </span>
                            )}
                          </td>

                          <td style={{ padding: "10px 14px" }}>
                            <div className="flex flex-col gap-1.5 items-start">
                              <button onClick={() => openManage(w, "settings")}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                                style={{ background: "#24315f" }}>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Manage
                              </button>
                              {w.waveClosed && w.waveRevealed && (w.treasuryPendingCount ?? 0) > 0 && (
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

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── REVEAL TAB ───────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "reveal" && (
        <>
          {/* Contract phase badge */}
          {revealPhase !== null && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: PHASE_COLORS[revealPhase]?.bg ?? "#f3f4f6", color: PHASE_COLORS[revealPhase]?.color ?? "#6b7280" }}>
                Contract: {PHASE_LABELS[revealPhase] ?? `Phase ${revealPhase}`}
              </span>
            </div>
          )}

          {revealErr && <ErrBanner msg={revealErr} onDismiss={() => setRevealErr(null)} />}

          {/* ── Wave Reveal Timeline ── */}
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
                          {w.is_revealed ? (
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
                          background: w.is_revealed ? "#16a34a" : "#e5e7eb",
                          margin: "0 4px", marginBottom: 28,
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Ready to reveal alert */}
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
                  The reveal date has passed. Review the wave below and click "Reveal Now" when you are ready.
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

          {/* Wave schedule table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
              <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Wave Schedule</h2>
              <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                Use "Set Date" on each row to schedule a reveal. Click "Reveal Now" when the reveal date arrives.
              </p>
            </div>

            {revealLoading ? (
              <div className="flex items-center justify-center h-40" style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading…
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" style={{ fontSize: 13, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                      {["Wave", "Start Date", "End Date", "Reveal Date", "Minted / Qty", "State", "Action"].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide"
                          style={{ color: "#9bafc5", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {revealWaves.map((w, i) => {
                      const state   = waveState(w);
                      const meta    = STATE_META[state];
                      const isReady = state === "ready_reveal";
                      return (
                        <tr key={w.wave_number}
                          style={{ borderTop: i === 0 ? "none" : "1px solid #f9fafb", background: isReady ? "rgba(217,119,6,0.025)" : "transparent" }}
                          onMouseEnter={e => { if (!isReady) e.currentTarget.style.background = "#fafbff"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = isReady ? "rgba(217,119,6,0.025)" : "transparent"; }}>

                          {/* Wave name */}
                          <td className="px-4 py-3">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>
                              W{w.wave_number}
                            </span>
                            <div className="text-xs mt-1" style={{ color: "#6b7280" }}>{w.wave_name}</div>
                          </td>

                          {/* Start date */}
                          <td className="px-4 py-3">
                            <div className="text-xs" style={{ color: w.wave_start_triggered ? "#16a34a" : "#374151" }}>
                              {fmtFull(w.scheduled_start)}
                            </div>
                            {w.wave_start_triggered && (
                              <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "#16a34a" }}>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                Started
                              </div>
                            )}
                          </td>

                          {/* End date */}
                          <td className="px-4 py-3">
                            <div className="text-xs" style={{ color: w.wave_end_triggered ? "#16a34a" : "#374151" }}>
                              {fmtFull(w.scheduled_end)}
                            </div>
                            {w.wave_end_triggered && (
                              <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "#16a34a" }}>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                Closed
                              </div>
                            )}
                          </td>

                          {/* Reveal date */}
                          <td className="px-4 py-3">
                            <div className="text-xs font-semibold"
                              style={{ color: isReady ? "#d97706" : w.reveal_scheduled_at ? "#7c3aed" : "#d1d5db" }}>
                              {fmtFull(w.reveal_scheduled_at)}
                            </div>
                            {isReady && (
                              <div className="text-xs mt-0.5 font-bold" style={{ color: "#d97706" }}>⚡ Due now</div>
                            )}
                            {w.wave_reveal_triggered && !w.is_revealed && (
                              <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "#7c3aed" }}>
                                <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Tx pending
                              </div>
                            )}
                            {w.is_revealed && w.wave_revealed_at && (
                              <div className="text-xs mt-0.5" style={{ color: "#16a34a" }}>
                                Done {fmtFull(w.wave_revealed_at)}
                              </div>
                            )}
                          </td>

                          {/* Minted / Qty */}
                          <td className="px-4 py-3 text-xs" style={{ whiteSpace: "nowrap" }}>
                            <span className="font-bold" style={{ color: "#41afeb" }}>{(w.minted_count ?? 0).toLocaleString()}</span>
                            <span style={{ color: "#9bafc5" }}> / {w.quantity.toLocaleString()}</span>
                            {w.quantity > 0 && (
                              <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: "#f3f4f6", width: 60 }}>
                                <div className="h-full rounded-full" style={{
                                  width: `${Math.min(100, ((w.minted_count ?? 0) / w.quantity) * 100)}%`,
                                  background: "#41afeb",
                                }} />
                              </div>
                            )}
                          </td>

                          {/* State badge */}
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ background: meta.bg, color: meta.color }}>
                              {meta.label}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="px-4 py-3">
                            {isReady ? (
                              <button onClick={() => setRevealWave(w)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                                style={{ background: "#d97706" }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Reveal Now
                              </button>
                            ) : state === "revealed" ? (
                              <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: "#16a34a" }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                </svg>
                                Done
                              </span>
                            ) : state === "not_scheduled" || state === "upcoming" || state === "reveal_scheduled" ? (
                              <button
                                onClick={() => {
                                  setScheduleEditWave(w);
                                  setScheduleEditDate(w.reveal_scheduled_at ? new Date(w.reveal_scheduled_at).toISOString().slice(0, 16) : "");
                                  setScheduleEditErr(null);
                                }}
                                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
                                style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {w.reveal_scheduled_at ? "Edit Date" : "Set Date"}
                              </button>
                            ) : (
                              <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* How reveals work */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
                color: "#41afeb",
                title: "1. Set Reveal Date",
                desc: "Click \"Set Date\" in the wave row below to schedule each wave's reveal. The date is announced to your community and triggers the alert when it arrives.",
              },
              {
                icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
                color: "#d97706",
                title: "2. Receive Alert",
                desc: "When the reveal date arrives, this tab shows a \"Ready to Reveal\" alert. No action happens automatically.",
              },
              {
                icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
                color: "#7c3aed",
                title: "3. Admin Confirms",
                desc: "Admin clicks \"Reveal Now\", enters the IPFS URI, ticks the confirmation checkbox, and submits the transaction.",
              },
            ].map(item => (
              <div key={item.title} className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-xl" style={{ background: `${item.color}15`, flexShrink: 0 }}>
                    <svg className="w-4 h-4" style={{ color: item.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                  </div>
                  <h3 className="text-xs font-bold" style={{ color: "#24315f" }}>{item.title}</h3>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Inline reveal-date editor modal */}
          {scheduleEditWave && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
              <div className="bg-white rounded-2xl shadow-xl" style={{ width: "100%", maxWidth: 420, border: "1px solid #e5e7eb" }}>
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

          {/* Reveal modals */}
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
        </>
      )}

      {activeTab === "whitelist"      && <WhitelistTab />}
      {activeTab === "packs"          && <PacksTab />}
      {activeTab === "collaborations" && <CollaborationsTab />}

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

      {/* ══ Manage Modal (unified Settings + Blockchain tabs) ═══════════════════ */}
      {editWave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl flex flex-col"
            style={{ width: "100%", maxWidth: 580, maxHeight: "92vh", border: "1px solid #e5e7eb" }}>

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
                  Settings tab for daily config · Blockchain tab for on-chain actions
                </p>
              </div>
              <button onClick={closeManage} style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex flex-shrink-0 px-6" style={{ borderBottom: "1px solid #e5e7eb" }}>
              {(["settings", "blockchain"] as const).map(t => (
                <button key={t} onClick={() => setManageTab(t)}
                  className="flex items-center gap-1.5 py-3 text-sm mr-4 transition-colors"
                  style={manageTab === t
                    ? { color: "#24315f", borderBottom: "2px solid #41afeb", fontWeight: 700, marginBottom: -1 }
                    : { color: "#9bafc5", borderBottom: "2px solid transparent", fontWeight: 600, marginBottom: -1 }}>
                  {t === "settings" ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  )}
                  {t === "settings" ? "Settings" : "Blockchain"}
                </button>
              ))}
            </div>
            {/* ── Settings Tab ── */}
            {manageTab === "settings" && <><div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
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

              {/* Price + Sale Method */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Default Price (ETH)</label>
                  <input type="number" step="0.0001" min="0"
                    value={form.defaultPriceEth}
                    onChange={e => setForm({ ...form, defaultPriceEth: e.target.value })}
                    style={inputStyle} placeholder="0 = Free" />
                </div>
                <div>
                  <label style={labelStyle}>Sale Method</label>
                  <select value={form.saleMethod}
                    onChange={e => setForm({ ...form, saleMethod: e.target.value })}
                    style={inputStyle}>
                    {saleMethods.filter(s => s.is_active && s.code !== "dutch_auction").map(s => (
                      <option key={s.code} value={s.code}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status */}
              <div>
                <label style={labelStyle}>Status</label>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTS.map(s => (
                    <button key={s} onClick={() => setForm({ ...form, status: s })}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize"
                      style={{
                        border: "1px solid", borderColor: form.status === s ? "#41afeb" : "#e5e7eb",
                        background: form.status === s ? "rgba(65,175,235,0.1)" : "white",
                        color: form.status === s ? "#41afeb" : "#6b7280",
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schedule */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Wave Schedule</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.clearSchedule}
                      onChange={e => setForm({ ...form, clearSchedule: e.target.checked, scheduledStart: "", scheduledEnd: "", revealScheduledAt: "" })} />
                    <span className="text-xs" style={{ color: "#9bafc5" }}>Clear all dates</span>
                  </label>
                </div>
                {!form.clearSchedule && (
                  <div className="grid grid-cols-2 gap-3">
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

              {/* Reveal Date */}
              {!form.clearSchedule && (
                <div className="p-3 rounded-xl" style={{ background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.2)" }}>
                  <label style={{ ...labelStyle, color: "#7c3aed" }}>Reveal Date (auto-reveal on this date)</label>
                  <input type="datetime-local" value={form.revealScheduledAt}
                    onChange={e => setForm({ ...form, revealScheduledAt: e.target.value })} style={inputStyle} />
                  <p className="text-xs mt-1.5" style={{ color: "#9bafc5" }}>
                    System auto-reveals on this date. NFTs are randomly assigned to buyers at reveal time.
                  </p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} />
              </div>

              {/* Optional Tier Prices */}
              <div className="pt-2" style={{ borderTop: "1px solid #e5e7eb" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold" style={{ color: "#9bafc5", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Tier Prices (Optional)
                  </p>
                </div>
                <p className="text-xs mb-3" style={{ color: "#9bafc5" }}>
                  Set per-rarity prices to override the default wave price. Leave blank to use the default price for all tiers.
                </p>

                {tierOk  && <OkBanner  msg={tierOk}  onDismiss={() => setTierOk(null)}  />}
                {tierErr && <ErrBanner msg={tierErr} onDismiss={() => setTierErr(null)} />}

                <div className="p-3 rounded-xl" style={{ background: "#fafafa", border: "1px solid #e5e7eb" }}>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ["Legendary", tierLegendary, setTierLegendary],
                      ["Epic",      tierEpic,      setTierEpic],
                      ["Rare",      tierRare,      setTierRare],
                      ["Common",    tierCommon,    setTierCommon],
                    ] as [string, string, (v: string) => void][]).map(([label, val, setter]) => (
                      <div key={label}>
                        <label style={{ ...labelStyle, marginBottom: 2 }}>{label} (ETH)</label>
                        <input type="number" step="0.001" min="0"
                          value={val} onChange={e => setter(e.target.value)}
                          style={{ ...inputStyle, padding: "6px 10px" }} placeholder="leave blank = default" />
                      </div>
                    ))}
                  </div>
                  <button onClick={saveTierPrices} disabled={tierSaving}
                    className="mt-3 w-full py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: tierSaving ? "#9bafc5" : "#41afeb" }}>
                    {tierSaving ? "Saving…" : "Save Tier Prices"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #e5e7eb" }}>
              <button onClick={closeManage} className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: saving ? "#9bafc5" : "#41afeb" }}>
                {saving ? "Saving…" : "Save Settings"}
              </button>
            </div></>}

            {/* ── Blockchain Tab ── */}
            {manageTab === "blockchain" && <>
              {/* Gas cost warning banner */}
              <div className="mx-6 mt-4 flex items-start gap-3 px-4 py-3 rounded-xl flex-shrink-0"
                style={{ background: "rgba(217,119,6,0.07)", border: "1px solid rgba(217,119,6,0.25)" }}>
                <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#d97706" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs leading-relaxed" style={{ color: "#92400e" }}>
                  <strong style={{ color: "#d97706" }}>These actions submit blockchain transactions.</strong> Each costs gas, requires wallet approval, and cannot be undone. Use the <strong>Settings</strong> tab for routine price and schedule changes.
                </p>
              </div>
              <div className="px-6 py-4 overflow-y-auto flex-1 space-y-5">
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
                      { label: "Minted",   value: `${chainOnChain.soldCount} / ${chainOnChain.qty}` },
                      { label: "Price",    value: `${chainOnChain.price} ETH` },
                      { label: "Closed",   value: chainOnChain.closed ? "Yes" : "No" },
                    ].map(s => (
                      <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                        <p className="text-xs" style={{ color: "#9bafc5" }}>{s.label}</p>
                        <p className="font-bold text-sm mt-0.5" style={{ color: "#24315f" }}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {chainTx    && <SharedTxBanner txHash={chainTx} />}
                {chainError && <ErrBanner msg={chainError} onDismiss={() => setChainError(null)} />}

                {/* 1 — Set Schedule */}
                <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                  <p className="text-xs font-bold" style={{ color: "#24315f" }}>1. Push Wave Schedule On-Chain</p>
                  <p className="text-xs" style={{ color: "#9bafc5" }}>Manually push wave start/end to the contract. The system auto-does this when the scheduled date arrives.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label style={labelStyle}>Start Time</label>
                      <input type="datetime-local" value={chainStart} onChange={e => setChainStart(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>End Time</label>
                      <input type="datetime-local" value={chainEnd}  onChange={e => setChainEnd(e.target.value)}   style={inputStyle} />
                    </div>
                  </div>
                  <button onClick={handleSetScheduleOnChain} disabled={chainSaving === "schedule"}
                    className="px-4 py-2 text-xs font-bold text-white rounded-lg"
                    style={{ background: chainSaving === "schedule" ? "#9bafc5" : "#41afeb" }}>
                    {chainSaving === "schedule" ? "Submitting…" : "Push Schedule to Chain"}
                  </button>
                </div>

                {/* 2 — Set Price */}
                {!editWave.priceLocked && editWave.waveNumber > 1 && (
                  <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                    <p className="text-xs font-bold" style={{ color: "#24315f" }}>2. Update Wave Price On-Chain</p>
                    <p className="text-xs" style={{ color: "#9bafc5" }}>Only allowed before first sale in this wave.</p>
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
                )}
                {editWave.priceLocked && (
                  <div className="px-4 py-3 rounded-xl text-xs" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                    Price is locked — first sale has already occurred in this wave.
                  </div>
                )}

                {/* 3 — Auction Listing (Waves 3–7) */}
                {editWave.waveNumber >= 3 && !chainOnChain?.closed && (
                  <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                    <p className="text-xs font-bold" style={{ color: "#24315f" }}>3. Record OpenSea Auction Listing</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label style={labelStyle}>OpenSea Listing ID</label>
                        <input type="text" value={auctionListingId} onChange={e => setAuctionListingId(e.target.value)}
                          style={inputStyle} placeholder="listing-id from OpenSea" />
                      </div>
                      <div>
                        <label style={labelStyle}>Start Price (ETH)</label>
                        <input type="number" step="0.001" value={auctionStartPrice} onChange={e => setAuctionStartPrice(e.target.value)}
                          style={inputStyle} placeholder="0.0303" />
                      </div>
                    </div>
                    <button onClick={handleSaveAuctionListing} disabled={chainSaving === "auction"}
                      className="px-4 py-2 text-xs font-bold text-white rounded-lg"
                      style={{ background: chainSaving === "auction" ? "#9bafc5" : "#7c3aed" }}>
                      {chainSaving === "auction" ? "Saving…" : "Save Auction Listing"}
                    </button>
                  </div>
                )}

                {/* 4 — Mint & Transfer (Waves 3–7) */}
                {editWave.waveNumber >= 3 && !chainOnChain?.closed && (
                  <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                    <p className="text-xs font-bold" style={{ color: "#24315f" }}>4. Mint & Transfer to Auction Winner</p>
                    <p className="text-xs" style={{ color: "#9bafc5" }}>After OpenSea auction settles — mints the NFT directly to the winner.</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <label style={labelStyle}>Winner Address</label>
                        <input type="text" value={auctionTo} onChange={e => setAuctionTo(e.target.value)}
                          style={inputStyle} placeholder="0x..." />
                      </div>
                      <div>
                        <label style={labelStyle}>Qty</label>
                        <input type="number" min="1" value={auctionQty} onChange={e => setAuctionQty(e.target.value)}
                          style={inputStyle} />
                      </div>
                    </div>
                    <button onClick={handleMintTransfer} disabled={chainSaving === "mint-transfer"}
                      className="px-4 py-2 text-xs font-bold text-white rounded-lg"
                      style={{ background: chainSaving === "mint-transfer" ? "#9bafc5" : "#41afeb" }}>
                      {chainSaving === "mint-transfer" ? "Submitting tx…" : "Mint & Transfer On-Chain"}
                    </button>
                  </div>
                )}

                {/* 5 — Move Unsold to Wallet (requires wave closed + revealed) */}
                {editWave.waveClosed && editWave.waveRevealed && (
                  <div className="space-y-3 p-4 rounded-xl" style={{ background: "rgba(22,163,74,0.03)", border: "1px solid rgba(22,163,74,0.3)" }}>
                    <p className="text-xs font-bold" style={{ color: "#16a34a" }}>5. Move Unsold NFTs to Wallet</p>
                    <p className="text-xs" style={{ color: "#9bafc5" }}>
                      Wave is closed and revealed. Transfer{" "}
                      {(editWave.treasuryPendingCount ?? 0) > 0
                        ? `${(editWave.treasuryPendingCount ?? 0).toLocaleString()} unsold NFTs`
                        : "unsold NFTs"}{" "}
                      to the treasury wallet or a custom wallet address.
                    </p>
                    <button
                      onClick={() => {
                        const wave = waves.find(w => w.waveNumber === editWave.waveNumber);
                        if (wave) { closeManage(); setTreasuryMoveWave(wave); }
                      }}
                      disabled={(editWave.treasuryPendingCount ?? 0) === 0}
                      className="px-4 py-2 text-xs font-bold rounded-xl"
                      style={{
                        background: (editWave.treasuryPendingCount ?? 0) === 0 ? "rgba(156,163,175,0.1)" : "rgba(22,163,74,0.08)",
                        color: (editWave.treasuryPendingCount ?? 0) === 0 ? "#9bafc5" : "#16a34a",
                        border: `1px solid ${(editWave.treasuryPendingCount ?? 0) === 0 ? "#e5e7eb" : "rgba(22,163,74,0.3)"}`,
                        cursor: (editWave.treasuryPendingCount ?? 0) === 0 ? "not-allowed" : "pointer",
                      }}>
                      {(editWave.treasuryPendingCount ?? 0) === 0 ? "No Unsold NFTs" : "Move Unsold → Wallet"}
                    </button>
                  </div>
                )}
                {editWave.waveClosed && !editWave.waveRevealed && (
                  <div className="px-4 py-3 rounded-xl text-xs"
                    style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.25)", color: "#92400e" }}>
                    Wave is closed but not yet revealed. Complete the reveal first before moving NFTs to wallet.
                  </div>
                )}
                {!editWave.waveClosed && (
                  <div className="space-y-2 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                    <p className="text-xs font-bold" style={{ color: "#9bafc5" }}>5. Move Unsold NFTs to Wallet</p>
                    <p className="text-xs" style={{ color: "#d1d5db" }}>
                      Available after wave is closed and revealed.
                    </p>
                  </div>
                )}

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
                      : "No reveal date set — use the Settings tab to set a reveal date"}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #e5e7eb" }}>
                <button onClick={closeManage}
                  className="px-4 py-2 text-sm font-medium rounded-lg w-full"
                  style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
                  Close
                </button>
              </div>
            </>}
          </div>
        </div>
      )}

    </div>
  );
}
