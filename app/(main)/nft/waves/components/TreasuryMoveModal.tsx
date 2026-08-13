"use client";

import { useEffect, useState } from "react";
import { ErrBanner } from "@/components/nft/Banner";

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

interface GasEstimate {
  walletAddress: string;
  balanceEth: number;
  estimatedGasEth: number;
  sufficient: boolean;
}

// ─── TreasuryMoveModal ─────────────────────────────────────────────────────────

export default function TreasuryMoveModal({
  wave,
  onClose,
  onSuccess,
}: {
  wave: Wave;
  onClose: () => void;
  onSuccess: (txHash: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gasInfo, setGasInfo] = useState<GasEstimate | null>(null);
  const [gasLoading, setGasLoading] = useState(true);

  // Fetch wallet balance + gas estimate on mount
  useEffect(() => {
    setGasLoading(true);
    fetch(`/api/nft-sell/waves/${wave.waveNumber}/treasury-close-estimate`, { credentials: "include" })
      .then(r => r.json())
      .then((d: GasEstimate) => setGasInfo(d))
      .catch(() => setGasInfo(null))
      .finally(() => setGasLoading(false));
  }, [wave.waveNumber]);

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 360_000);
    try {
      const res = await fetch(`/api/nft-sell/waves/${wave.waveNumber}/treasury-close`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: controller.signal,
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Transfer failed");
        return;
      }
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
  const actionLabel   = saving ? "Transferring…" : "Confirm Transfer";
  const canSubmit     = !saving && (gasInfo?.sufficient !== false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" style={{ border: "1px solid #e5e7eb" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>
              Move to Wallet &mdash; W{wave.waveNumber} {wave.name}
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

          {/* Treasury wallet destination */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl"
            style={{ border: "1.5px solid #41afeb", background: "rgba(65,175,235,0.04)" }}>
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#41afeb" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <div>
              <p className="text-xs font-bold" style={{ color: "#24315f" }}>Default Treasury Wallet</p>
              <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                NFTs will be sent to the treasury address configured in the smart contract
              </p>
            </div>
          </div>

          {/* Wallet balance + gas estimate */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
            <div className="px-3.5 py-2" style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#6b7280" }}>
                Gas Check
              </p>
            </div>
            {gasLoading ? (
              <div className="px-3.5 py-3 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#41afeb", borderTopColor: "transparent" }} />
                <span className="text-xs" style={{ color: "#9bafc5" }}>Fetching wallet balance…</span>
              </div>
            ) : gasInfo ? (
              <div className="divide-y divide-gray-100">
                {/* Balance row */}
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-xs" style={{ color: "#6b7280" }}>Signer wallet balance</span>
                  <span className="text-xs font-mono font-semibold" style={{ color: gasInfo.sufficient ? "#15803d" : "#dc2626" }}>
                    {gasInfo.balanceEth.toFixed(6)} ETH
                  </span>
                </div>
                {/* Gas estimate row */}
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-xs" style={{ color: "#6b7280" }}>Estimated gas cost</span>
                  <span className="text-xs font-mono font-semibold" style={{ color: "#374151" }}>
                    ~{gasInfo.estimatedGasEth.toFixed(6)} ETH
                  </span>
                </div>
                {/* Status row */}
                <div className="flex items-center justify-between px-3.5 py-2.5"
                  style={{ background: gasInfo.sufficient ? "rgba(21,128,61,0.05)" : "rgba(220,38,38,0.05)" }}>
                  <span className="text-xs font-semibold" style={{ color: gasInfo.sufficient ? "#15803d" : "#dc2626" }}>
                    {gasInfo.sufficient ? "✓ Sufficient funds" : "✗ Insufficient funds — top up wallet before proceeding"}
                  </span>
                  {!gasInfo.sufficient && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
                      Need {(gasInfo.estimatedGasEth - gasInfo.balanceEth).toFixed(6)} ETH more
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-3.5 py-3">
                <span className="text-xs" style={{ color: "#9bafc5" }}>Could not fetch gas estimate</span>
              </div>
            )}
          </div>

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