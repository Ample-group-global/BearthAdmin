"use client";

import { useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  wave_reveal_uri?: string | null;
  wave_revealed_at: string | null;
  sold_count: number;
  quantity: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtFull(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// ─── WaveRevealModal ───────────────────────────────────────────────────────────

export default function WaveRevealModal({
  wave,
  onClose,
  onSuccess,
}: {
  wave: WaveSchedule;
  onClose: () => void;
  onSuccess: (txHash: string) => void;
}) {
  const [uri, setUri] = useState(wave.wave_reveal_uri ?? "");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doReveal() {
    if (!confirmed || !uri.startsWith("ipfs://")) return;
    setBusy(true);
    setError(null);

    console.group("[WaveRevealModal] doReveal");
    console.log("wave_number:", wave.wave_number);
    console.log("uri:", uri);

    try {
      const res = await fetch(`/api/nft-sell/waves/${wave.wave_number}/reveal`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uri }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Reveal failed");

      console.log("txHash:", json.txHash);
      console.groupEnd();

      onSuccess(json.txHash);
    } catch (e: unknown) {
      console.log("error:", e);
      console.groupEnd();
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
              color: confirmed && uri.startsWith("ipfs://") && !busy ? "#fff" : "#9bafc5",
              cursor: confirmed && uri.startsWith("ipfs://") && !busy ? "pointer" : "default",
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
