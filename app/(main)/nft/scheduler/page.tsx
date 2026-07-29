"use client";

import { useEffect, useState, useCallback } from "react";
import { ErrBanner } from "@/components/nft/Banner";

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
  quantity:              number;
}

const PHASE_LABELS: Record<number, string> = { 0: "Free Mint", 1: "Paid Mint", 2: "Revealed" };
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
  if (w.is_revealed || w.wave_reveal_triggered) return "revealed";
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

// ── Reveal Confirmation Modal ─────────────────────────────────────────────────
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

// ── Success Modal ─────────────────────────────────────────────────────────────
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function WaveOverviewPage() {
  const [waves,       setWaves]       = useState<WaveSchedule[]>([]);
  const [phase,       setPhase]       = useState<number | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [err,         setErr]         = useState<string | null>(null);
  const [revealWave,  setRevealWave]  = useState<WaveSchedule | null>(null);
  const [successData, setSuccessData] = useState<{ txHash: string; waveNum: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const [wr, sr] = await Promise.all([
        fetch("/api/nft-sell/waves/schedule-status", { credentials: "include" }),
        fetch("/api/nft-sell/scheduler/status",      { credentials: "include" }),
      ]);
      const wd = await wr.json();
      setWaves(wd.waves ?? []);
      if (sr.ok) {
        const sd = await sr.json();
        if (sd.configured) setPhase(sd.currentPhase ?? null);
      }
    } catch {
      setErr("Failed to load wave data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Count waves ready to reveal
  const now = Date.now();
  const readyCount = waves.filter(w => waveState(w) === "ready_reveal").length;

  const nextAction = waves
    .flatMap(w => [
      w.scheduled_start && !w.wave_start_triggered ? { label: `W${w.wave_number} starts`, dt: new Date(w.scheduled_start).getTime() } : null,
      w.reveal_scheduled_at && !w.wave_reveal_triggered && !w.is_revealed ? { label: `W${w.wave_number} reveal due`, dt: new Date(w.reveal_scheduled_at).getTime() } : null,
    ])
    .filter((x): x is { label: string; dt: number } => x !== null && x.dt > now)
    .sort((a, b) => a.dt - b.dt)[0] ?? null;

  function handleRevealSuccess(txHash: string, waveNum: number) {
    setRevealWave(null);
    setSuccessData({ txHash, waveNum });
    load();
  }

  return (
    <div className="p-5 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>Wave Overview</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            Monitor wave schedule and trigger reveals when the time arrives
          </p>
        </div>
        <div className="flex items-center gap-2">
          {phase !== null && (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ background: PHASE_COLORS[phase]?.bg ?? "#f3f4f6", color: PHASE_COLORS[phase]?.color ?? "#6b7280" }}>
              Contract: {PHASE_LABELS[phase] ?? `Phase ${phase}`}
            </span>
          )}
          <button onClick={load} disabled={loading}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}

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

      {/* Wave table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
          <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Wave Schedule</h2>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            Set dates on the NFT Waves page. Click "Reveal Now" when a wave's reveal date arrives.
          </p>
        </div>

        {loading ? (
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
                  {["Wave", "Start Date", "End Date", "Reveal Date", "Sold / Qty", "State", "Action"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide"
                      style={{ color: "#9bafc5", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {waves.map((w, i) => {
                  const state = waveState(w);
                  const meta  = STATE_META[state];
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
                          {fmtDate(w.scheduled_start)}
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
                          {fmtDate(w.scheduled_end)}
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
                          {fmtDate(w.reveal_scheduled_at)}
                        </div>
                        {isReady && (
                          <div className="text-xs mt-0.5 font-bold" style={{ color: "#d97706" }}>⚡ Due now</div>
                        )}
                        {w.is_revealed && w.wave_revealed_at && (
                          <div className="text-xs mt-0.5" style={{ color: "#16a34a" }}>
                            Done {fmtDate(w.wave_revealed_at)}
                          </div>
                        )}
                      </td>

                      {/* Sold / Qty */}
                      <td className="px-4 py-3 text-xs" style={{ whiteSpace: "nowrap" }}>
                        <span className="font-bold" style={{ color: "#41afeb" }}>{w.sold_count.toLocaleString()}</span>
                        <span style={{ color: "#9bafc5" }}> / {w.quantity.toLocaleString()}</span>
                        {w.quantity > 0 && (
                          <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: "#f3f4f6", width: 60 }}>
                            <div className="h-full rounded-full" style={{
                              width: `${Math.min(100, (w.sold_count / w.quantity) * 100)}%`,
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
                        ) : state === "not_scheduled" ? (
                          <a href="/nft/waves" className="text-xs font-semibold" style={{ color: "#41afeb", textDecoration: "none" }}>
                            Set Schedule →
                          </a>
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
            desc: "On the NFT Waves page, set a reveal date for each wave. This date is shown to the community.",
          },
          {
            icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
            color: "#d97706",
            title: "2. Receive Alert",
            desc: "When the reveal date arrives, this page shows a \"Ready to Reveal\" alert. No action happens automatically.",
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

      {/* Modals */}
      {revealWave && (
        <RevealModal
          wave={revealWave}
          onClose={() => setRevealWave(null)}
          onSuccess={(txHash) => handleRevealSuccess(txHash, revealWave.wave_number)}
        />
      )}
      {successData && (
        <SuccessModal
          txHash={successData.txHash}
          waveNum={successData.waveNum}
          onClose={() => setSuccessData(null)}
        />
      )}
    </div>
  );
}
