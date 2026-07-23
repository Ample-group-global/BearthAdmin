"use client";

import { useEffect, useState, useCallback } from "react";
import { ErrBanner } from "@/components/nft/ErrBanner";
import { OkBanner } from "@/components/nft/OkBanner";
import { TxBanner } from "@/components/nft/TxBanner";
import { Toggle } from "@/components/nft/Toggle";
import { labelStyle, inputStyle } from "@/components/nft/styles";

interface SchedulerStatus {
  autoPhaseEnabled:      boolean;
  autoRevealEnabled:     boolean;
  autoWaveRevealEnabled: boolean;
  currentPhase:          number;
  paidMintScheduledAt:   number;
  paidMintReady:         boolean;
  revealedScheduledAt:   number;
  revealedReady:         boolean;
  revealAt:              number;
  revealURI:             string;
  revealReady:           boolean;
}

interface WaveRevealStatus {
  waveNum:     number;
  scheduledAt: number;
  uri:         string;
  ready:       boolean;
}

const PHASE_LABELS: Record<number, string> = { 0: "Whitelist", 1: "PaidMint", 2: "Revealed" };
const PHASE_COLORS: Record<number, string> = { 0: "#7c3aed", 1: "#41afeb", 2: "#16a34a" };
const WAVES = [1, 2, 3, 4, 5, 6, 7];

function fmtTs(ts: number): string {
  if (!ts) return "Not scheduled";
  return new Date(ts * 1000).toLocaleString();
}

function nowUnix(): number { return Math.floor(Date.now() / 1000); }

export default function SchedulerPage() {
  const [status, setStatus]     = useState<SchedulerStatus | null>(null);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [ok, setOk]             = useState<string | null>(null);
  const [txHash, setTxHash]     = useState<string | null>(null);

  // Wave reveal status (loaded on demand)
  const [waveStatuses, setWaveStatuses] = useState<WaveRevealStatus[]>([]);
  const [waveStatusLoading, setWaveStatusLoading] = useState(false);

  // Phase scheduling form
  const [schedPhase, setSchedPhase]         = useState<"1" | "2">("1");
  const [schedDateTime, setSchedDateTime]   = useState("");

  // Full reveal scheduling form
  const [revealUri, setRevealUri]           = useState("");
  const [revealDateTime, setRevealDateTime] = useState("");

  // Wave reveal scheduling form
  const [waveRevealNum, setWaveRevealNum]   = useState<string>("1");
  const [waveRevealUri, setWaveRevealUri]   = useState("");
  const [waveRevealDateTime, setWaveRevealDateTime] = useState("");

  // Manual forms
  const [manualPhase, setManualPhase]               = useState<"1" | "2">("1");
  const [manualRevealUri, setManualRevealUri]       = useState("");
  const [manualWaveNum, setManualWaveNum]           = useState<string>("1");
  const [manualWaveRevealUri, setManualWaveRevealUri] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/nft-sell/scheduler/status", { credentials: "include" });
      if (!r.ok) { const d = await r.json(); setErr(d.error ?? "Failed to load scheduler status."); return; }
      const d = await r.json();
      setStatus(d);
    } catch { setErr("Network error loading scheduler."); }
    finally { setLoading(false); }
  }, []);

  const loadWaveStatuses = useCallback(async () => {
    setWaveStatusLoading(true);
    try {
      const results = await Promise.all(
        WAVES.map(async (w) => {
          const r = await fetch(`/api/nft-sell/scheduler/wave-reveal-status/${w}`, { credentials: "include" });
          if (!r.ok) return { waveNum: w, scheduledAt: 0, uri: "", ready: false };
          return r.json() as Promise<WaveRevealStatus>;
        })
      );
      setWaveStatuses(results);
    } catch { /* non-critical */ }
    finally { setWaveStatusLoading(false); }
  }, []);

  useEffect(() => { load(); loadWaveStatuses(); }, [load, loadWaveStatuses]);

  async function call(path: string, method: string, body?: object): Promise<boolean> {
    setBusy(true); setErr(null); setOk(null); setTxHash(null);
    try {
      const r = await fetch(`/api/nft-sell/scheduler/${path}`, {
        method, credentials: "include",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error ?? `Failed: ${path}`); return false; }
      if (d.txHash) setTxHash(d.txHash);
      return true;
    } catch { setErr("Network error."); return false; }
    finally { setBusy(false); }
  }

  async function toggleAutoPhase(enabled: boolean) {
    const ok = await call("auto-phase", "POST", { enabled });
    if (ok) { setOk(`Auto phase mode ${enabled ? "enabled" : "disabled"}.`); await load(); }
  }

  async function toggleAutoReveal(enabled: boolean) {
    const ok = await call("auto-reveal", "POST", { enabled });
    if (ok) { setOk(`Auto reveal mode ${enabled ? "enabled" : "disabled"}.`); await load(); }
  }

  async function toggleAutoWaveReveal(enabled: boolean) {
    const ok = await call("auto-wave-reveal", "POST", { enabled });
    if (ok) { setOk(`Auto wave reveal mode ${enabled ? "enabled" : "disabled"}.`); await load(); }
  }

  async function schedulePhase() {
    if (!schedDateTime) return setErr("Select a date/time first.");
    const ts = Math.floor(new Date(schedDateTime).getTime() / 1000);
    if (ts <= nowUnix()) return setErr("Schedule must be in the future.");
    const success = await call("schedule-phase", "POST", { phase: parseInt(schedPhase), timestamp: ts });
    if (success) { setOk(`Phase ${PHASE_LABELS[parseInt(schedPhase)]} scheduled.`); await load(); }
  }

  async function cancelPhase(phase: number) {
    if (!confirm(`Cancel scheduled phase ${PHASE_LABELS[phase]} transition?`)) return;
    const success = await call(`schedule-phase/${phase}`, "DELETE");
    if (success) { setOk(`Phase ${phase} schedule cancelled.`); await load(); }
  }

  async function triggerPhase(phase: number) {
    if (!confirm(`Trigger phase ${PHASE_LABELS[phase]} now?`)) return;
    const success = await call(`trigger-phase/${phase}`, "POST");
    if (success) { setOk(`Phase ${PHASE_LABELS[phase]} triggered.`); await load(); }
  }

  async function scheduleReveal() {
    if (!revealUri.startsWith("ipfs://")) return setErr("Reveal URI must start with ipfs://");
    if (!revealDateTime) return setErr("Select a date/time first.");
    const ts = Math.floor(new Date(revealDateTime).getTime() / 1000);
    if (ts <= nowUnix()) return setErr("Schedule must be in the future.");
    const success = await call("schedule-reveal", "POST", { uri: revealUri, timestamp: ts });
    if (success) { setOk(`Reveal scheduled.`); setRevealUri(""); setRevealDateTime(""); await load(); }
  }

  async function cancelReveal() {
    if (!confirm("Cancel the scheduled reveal?")) return;
    const success = await call("schedule-reveal", "DELETE");
    if (success) { setOk("Reveal schedule cancelled."); await load(); }
  }

  async function triggerReveal() {
    if (!confirm("Trigger reveal now? Auto reveal mode must be enabled.")) return;
    const success = await call("trigger-reveal", "POST");
    if (success) { setOk("Reveal triggered."); await load(); }
  }

  async function scheduleWaveReveal() {
    const waveNum = parseInt(waveRevealNum);
    if (!waveRevealUri.startsWith("ipfs://")) return setErr("URI must start with ipfs://");
    if (!waveRevealDateTime) return setErr("Select a date/time first.");
    const ts = Math.floor(new Date(waveRevealDateTime).getTime() / 1000);
    if (ts <= nowUnix()) return setErr("Schedule must be in the future.");
    const success = await call("schedule-wave-reveal", "POST", { waveNum, uri: waveRevealUri, timestamp: ts });
    if (success) {
      setOk(`Wave ${waveNum} reveal scheduled.`);
      setWaveRevealUri(""); setWaveRevealDateTime("");
      await loadWaveStatuses();
    }
  }

  async function cancelWaveReveal(waveNum: number) {
    if (!confirm(`Cancel scheduled reveal for Wave ${waveNum}?`)) return;
    const success = await call(`schedule-wave-reveal/${waveNum}`, "DELETE");
    if (success) { setOk(`Wave ${waveNum} reveal schedule cancelled.`); await loadWaveStatuses(); }
  }

  async function triggerWaveReveal(waveNum: number) {
    if (!confirm(`Trigger Wave ${waveNum} reveal on-chain now?`)) return;
    const success = await call(`trigger-wave-reveal/${waveNum}`, "POST");
    if (success) { setOk(`Wave ${waveNum} reveal triggered.`); await loadWaveStatuses(); }
  }

  async function doManualPhase() {
    const phaseName = PHASE_LABELS[parseInt(manualPhase)];
    if (!confirm(`Manually set phase to ${phaseName}? Executes immediately on-chain.`)) return;
    const success = await call("manual-phase", "POST", { phase: parseInt(manualPhase) });
    if (success) { setOk(`Phase set to ${phaseName}.`); await load(); }
  }

  async function doManualReveal() {
    if (!manualRevealUri.startsWith("ipfs://")) return setErr("Reveal URI must start with ipfs://");
    if (!confirm("Execute full reveal NOW on-chain? This is irreversible.")) return;
    const success = await call("manual-reveal", "POST", { uri: manualRevealUri });
    if (success) { setOk("Full reveal executed on-chain."); setManualRevealUri(""); await load(); }
  }

  async function doManualWaveReveal() {
    const waveNum = parseInt(manualWaveNum);
    if (!manualWaveRevealUri.startsWith("ipfs://")) return setErr("URI must start with ipfs://");
    if (!confirm(`Reveal Wave ${waveNum} NOW on-chain? This is irreversible.`)) return;
    const success = await call("manual-wave-reveal", "POST", { waveNum, uri: manualWaveRevealUri });
    if (success) {
      setOk(`Wave ${waveNum} revealed on-chain.`);
      setManualWaveRevealUri("");
      await loadWaveStatuses();
    }
  }

  async function togglePause() {
    if (!confirm("Pause/unpause BearthScheduler?")) return;
    const success = await call("pause", "POST");
    if (success) { setOk("Scheduler pause state changed."); await load(); }
  }

  const phase      = status?.currentPhase ?? 0;
  const phaseColor = PHASE_COLORS[phase] ?? "#9ca3af";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>Scheduler</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Automated phase transitions, full reveal, and per-wave reveal for BearthGenesisNFT
          </p>
        </div>
        <button onClick={() => { load(); loadWaveStatuses(); }}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-gray-600">
          Refresh
        </button>
      </div>

      {err    && <ErrBanner msg={err}    onDismiss={() => setErr(null)} />}
      {ok     && <OkBanner  msg={ok}     onDismiss={() => setOk(null)} />}
      {txHash && <TxBanner  txHash={txHash} onDismiss={() => setTxHash(null)} />}

      {loading ? (
        <div className="p-8 text-center text-sm text-gray-400">Loading scheduler status…</div>
      ) : !status ? (
        <div className="p-8 text-center text-sm text-gray-400">
          Scheduler not reachable — set SCHEDULER_CONTRACT_ADDRESS env var.
        </div>
      ) : (
        <>
          {/* Status Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Current Phase</div>
              <div className="text-2xl font-bold mt-1" style={{ color: phaseColor }}>
                {PHASE_LABELS[phase]}
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Auto Phase</div>
              <div className="flex items-center gap-2">
                <Toggle value={status.autoPhaseEnabled} onChange={toggleAutoPhase} disabled={busy} />
                <span className="text-sm font-semibold" style={{ color: status.autoPhaseEnabled ? "#16a34a" : "#9ca3af" }}>
                  {status.autoPhaseEnabled ? "On" : "Off"}
                </span>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Auto Full Reveal</div>
              <div className="flex items-center gap-2">
                <Toggle value={status.autoRevealEnabled} onChange={toggleAutoReveal} disabled={busy} />
                <span className="text-sm font-semibold" style={{ color: status.autoRevealEnabled ? "#16a34a" : "#9ca3af" }}>
                  {status.autoRevealEnabled ? "On" : "Off"}
                </span>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Auto Wave Reveal</div>
              <div className="flex items-center gap-2">
                <Toggle value={status.autoWaveRevealEnabled} onChange={toggleAutoWaveReveal} disabled={busy} />
                <span className="text-sm font-semibold" style={{ color: status.autoWaveRevealEnabled ? "#16a34a" : "#9ca3af" }}>
                  {status.autoWaveRevealEnabled ? "On" : "Off"}
                </span>
              </div>
            </div>
          </div>

          {/* Scheduled Phase States */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: "1px solid #e5e7eb" }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>PaidMint Phase</h2>
                {status.paidMintReady && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>Ready</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">{fmtTs(status.paidMintScheduledAt)}</p>
              <div className="flex gap-2">
                {status.paidMintScheduledAt > 0 && (
                  <>
                    <button onClick={() => cancelPhase(1)} disabled={busy}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600">
                      Cancel
                    </button>
                    {status.paidMintReady && (
                      <button onClick={() => triggerPhase(1)} disabled={busy}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ background: "#41afeb" }}>
                        Trigger
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: "1px solid #e5e7eb" }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Revealed Phase</h2>
                {status.revealedReady && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>Ready</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">{fmtTs(status.revealedScheduledAt)}</p>
              <div className="flex gap-2">
                {status.revealedScheduledAt > 0 && (
                  <>
                    <button onClick={() => cancelPhase(2)} disabled={busy}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600">
                      Cancel
                    </button>
                    {status.revealedReady && (
                      <button onClick={() => triggerPhase(2)} disabled={busy}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ background: "#16a34a" }}>
                        Trigger
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: "1px solid #e5e7eb" }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Full Reveal (URI)</h2>
                {status.revealReady && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>Ready</span>
                )}
              </div>
              <p className="text-xs text-gray-500">{fmtTs(status.revealAt)}</p>
              {status.revealURI && <p className="text-xs font-mono text-gray-400 mt-1 truncate">{status.revealURI}</p>}
              <div className="flex gap-2 mt-3">
                {status.revealAt > 0 && (
                  <>
                    <button onClick={cancelReveal} disabled={busy}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 text-gray-600">
                      Cancel
                    </button>
                    {status.revealReady && (
                      <button onClick={triggerReveal} disabled={busy}
                        className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ background: "#7c3aed" }}>
                        Trigger
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Per-wave Reveal Status Grid */}
          <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: "1px solid #e5e7eb" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Per-wave Reveal Status</h2>
              <button onClick={loadWaveStatuses} disabled={waveStatusLoading}
                className="px-2 py-1 rounded-lg text-xs font-semibold border border-gray-200 text-gray-500">
                {waveStatusLoading ? "Loading…" : "Refresh"}
              </button>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {waveStatusLoading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="rounded-xl bg-gray-100 animate-pulse h-20" />
                ))
              ) : (
                waveStatuses.map((ws) => (
                  <div key={ws.waveNum} className="rounded-xl p-3 text-center"
                    style={{ background: ws.scheduledAt > 0 ? "rgba(65,175,235,0.08)" : "#f9fafb", border: "1px solid #e5e7eb" }}>
                    <div className="text-xs font-bold text-gray-500 mb-1">W{ws.waveNum}</div>
                    {ws.scheduledAt > 0 ? (
                      <>
                        <div className={`text-xs font-semibold ${ws.ready ? "text-green-600" : "text-blue-500"}`}>
                          {ws.ready ? "Ready" : "Scheduled"}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate" title={fmtTs(ws.scheduledAt)}>
                          {new Date(ws.scheduledAt * 1000).toLocaleDateString()}
                        </div>
                        <div className="mt-1 flex flex-col gap-1">
                          {ws.ready && (
                            <button onClick={() => triggerWaveReveal(ws.waveNum)} disabled={busy}
                              className="w-full py-0.5 rounded text-xs font-semibold text-white"
                              style={{ background: "#16a34a", fontSize: "10px" }}>
                              Trigger
                            </button>
                          )}
                          <button onClick={() => cancelWaveReveal(ws.waveNum)} disabled={busy}
                            className="w-full py-0.5 rounded text-xs font-semibold border border-gray-200 text-gray-500"
                            style={{ fontSize: "10px" }}>
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-gray-400 mt-1">—</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Schedule Forms Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Schedule Phase */}
            <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: "1px solid #e5e7eb" }}>
              <h2 className="text-sm font-bold mb-4" style={{ color: "#24315f" }}>Schedule Phase (Auto)</h2>
              <div className="space-y-3">
                <div>
                  <label style={labelStyle}>Target Phase</label>
                  <select value={schedPhase} onChange={e => setSchedPhase(e.target.value as "1" | "2")} style={inputStyle}>
                    <option value="1">Phase 1 — PaidMint</option>
                    <option value="2">Phase 2 — Revealed</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Trigger Date & Time</label>
                  <input type="datetime-local" value={schedDateTime} onChange={e => setSchedDateTime(e.target.value)} style={inputStyle} />
                </div>
                <button onClick={schedulePhase} disabled={busy}
                  className="w-full py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "#41afeb", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Scheduling…" : "Schedule Phase"}
                </button>
              </div>
            </div>

            {/* Schedule Full Reveal */}
            <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: "1px solid #e5e7eb" }}>
              <h2 className="text-sm font-bold mb-4" style={{ color: "#24315f" }}>Schedule Full Reveal (Auto)</h2>
              <div className="space-y-3">
                <div>
                  <label style={labelStyle}>IPFS Reveal URI</label>
                  <input type="text" value={revealUri} onChange={e => setRevealUri(e.target.value)}
                    placeholder="ipfs://Qm..." style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Reveal Date & Time</label>
                  <input type="datetime-local" value={revealDateTime} onChange={e => setRevealDateTime(e.target.value)} style={inputStyle} />
                </div>
                <button onClick={scheduleReveal} disabled={busy}
                  className="w-full py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "#7c3aed", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Scheduling…" : "Schedule Full Reveal"}
                </button>
              </div>
            </div>

            {/* Schedule Wave Reveal */}
            <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: "1px solid #e5e7eb" }}>
              <h2 className="text-sm font-bold mb-4" style={{ color: "#24315f" }}>Schedule Wave Reveal (Auto)</h2>
              <div className="space-y-3">
                <div>
                  <label style={labelStyle}>Wave</label>
                  <select value={waveRevealNum} onChange={e => setWaveRevealNum(e.target.value)} style={inputStyle}>
                    {WAVES.map(w => <option key={w} value={String(w)}>Wave {w}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>IPFS URI for this wave</label>
                  <input type="text" value={waveRevealUri} onChange={e => setWaveRevealUri(e.target.value)}
                    placeholder="ipfs://Qm..." style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Reveal Date & Time</label>
                  <input type="datetime-local" value={waveRevealDateTime} onChange={e => setWaveRevealDateTime(e.target.value)} style={inputStyle} />
                </div>
                <button onClick={scheduleWaveReveal} disabled={busy}
                  className="w-full py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "#f59e0b", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Scheduling…" : "Schedule Wave Reveal"}
                </button>
              </div>
            </div>
          </div>

          {/* Manual Override */}
          <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: "1px solid #e5e7eb", borderColor: "rgba(220,38,38,0.3)" }}>
            <h2 className="text-sm font-bold mb-1" style={{ color: "#dc2626" }}>Manual Override (Execute Immediately)</h2>
            <p className="text-xs text-gray-400 mb-4">Bypasses auto mode and executes on-chain immediately. Use only when ready.</p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Manual Phase */}
              <div className="space-y-3">
                <div>
                  <label style={labelStyle}>Set Phase To</label>
                  <select value={manualPhase} onChange={e => setManualPhase(e.target.value as "1" | "2")} style={inputStyle}>
                    <option value="1">Phase 1 — PaidMint</option>
                    <option value="2">Phase 2 — Revealed</option>
                  </select>
                </div>
                <button onClick={doManualPhase} disabled={busy}
                  className="w-full py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "#dc2626", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Executing…" : "Set Phase Now"}
                </button>
              </div>
              {/* Manual Full Reveal */}
              <div className="space-y-3">
                <div>
                  <label style={labelStyle}>Full Reveal URI (IPFS)</label>
                  <input type="text" value={manualRevealUri} onChange={e => setManualRevealUri(e.target.value)}
                    placeholder="ipfs://Qm..." style={inputStyle} />
                </div>
                <button onClick={doManualReveal} disabled={busy}
                  className="w-full py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "#dc2626", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Executing…" : "Reveal All Now"}
                </button>
              </div>
              {/* Manual Wave Reveal */}
              <div className="space-y-3">
                <div>
                  <label style={labelStyle}>Wave Reveal</label>
                  <select value={manualWaveNum} onChange={e => setManualWaveNum(e.target.value)} style={inputStyle}>
                    {WAVES.map(w => <option key={w} value={String(w)}>Wave {w}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Wave URI (IPFS)</label>
                  <input type="text" value={manualWaveRevealUri} onChange={e => setManualWaveRevealUri(e.target.value)}
                    placeholder="ipfs://Qm..." style={inputStyle} />
                </div>
                <button onClick={doManualWaveReveal} disabled={busy}
                  className="w-full py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "#dc2626", opacity: busy ? 0.6 : 1 }}>
                  {busy ? "Executing…" : "Reveal Wave Now"}
                </button>
              </div>
            </div>
          </div>

          {/* Pause / Unpause */}
          <div className="flex items-center gap-4">
            <button onClick={togglePause} disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600">
              Pause / Unpause Scheduler
            </button>
            <span className="text-xs text-gray-400">Paused state blocks public trigger functions but not admin manual calls.</span>
          </div>
        </>
      )}
    </div>
  );
}
