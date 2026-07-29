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
  auto_trigger_state:    string;
}

interface SchedulerStatus {
  configured:           boolean;
  autoPhaseEnabled:     boolean;
  autoRevealEnabled:    boolean;
  autoWaveRevealEnabled:boolean;
  currentPhase:         number;
}

const PHASE_LABELS: Record<number, string> = { 0: "Whitelist", 1: "Paid Mint", 2: "Revealed" };
const PHASE_COLORS: Record<number, string> = { 0: "#7c3aed", 1: "#41afeb", 2: "#16a34a" };

function fmt(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function fmtDate(dt: string | null): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function TriggerBadge({ triggered, label }: { triggered: boolean; label: string }) {
  return triggered ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "rgba(156,163,175,0.12)", color: "#9bafc5" }}>
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      Pending
    </span>
  );
}

function AutoStateBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    started:        { label: "Started",        color: "#41afeb", bg: "rgba(65,175,235,0.1)" },
    ended:          { label: "Ended",          color: "#16a34a", bg: "rgba(22,163,74,0.1)" },
    revealed:       { label: "Revealed",       color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
    pending_start:  { label: "Pending Start",  color: "#d97706", bg: "rgba(217,119,6,0.1)" },
    pending_end:    { label: "Pending End",    color: "#d97706", bg: "rgba(217,119,6,0.1)" },
    pending_reveal: { label: "Pending Reveal", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
    not_scheduled:  { label: "Not Scheduled",  color: "#9bafc5", bg: "rgba(156,163,175,0.1)" },
  };
  const s = map[state] ?? map.not_scheduled;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function SchedulerPage() {
  const [waves, setWaves]         = useState<WaveSchedule[]>([]);
  const [status, setStatus]       = useState<SchedulerStatus | null>(null);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState<string | null>(null);
  const [nextTrigger, setNextTrigger] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const wr = await fetch("/api/nft-sell/waves/schedule-status", { credentials: "include" });
      if (!wr.ok) throw new Error("Failed to load schedule status");
      const wd = await wr.json();
      const mapped: WaveSchedule[] = (wd.waves ?? []) as WaveSchedule[];
      setWaves(mapped);

      // Find next upcoming trigger
      const now = Date.now();
      const upcoming = mapped
        .flatMap(w => [
          w.scheduled_start && !w.wave_start_triggered ? { label: `Wave ${w.wave_number} starts`, dt: new Date(w.scheduled_start).getTime() } : null,
          w.scheduled_end   && !w.wave_end_triggered   ? { label: `Wave ${w.wave_number} ends`,   dt: new Date(w.scheduled_end).getTime()   } : null,
          w.reveal_scheduled_at && !w.wave_reveal_triggered ? { label: `Wave ${w.wave_number} reveals`, dt: new Date(w.reveal_scheduled_at).getTime() } : null,
        ])
        .filter((x): x is { label: string; dt: number } => x !== null && x.dt > now)
        .sort((a, b) => a.dt - b.dt);
      setNextTrigger(upcoming[0] ? `${upcoming[0].label} on ${fmt(new Date(upcoming[0].dt).toISOString())}` : null);

      // Load contract scheduler status if configured
      try {
        const sr = await fetch("/api/nft-sell/scheduler/status", { credentials: "include" });
        if (sr.ok) setStatus(await sr.json());
      } catch { /* scheduler optional */ }

    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const phase      = status?.currentPhase ?? 0;
  const phaseColor = PHASE_COLORS[phase] ?? "#9ca3af";

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>Wave Scheduler</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9bafc5" }}>
            Auto-trigger status for wave start, wave end, and reveal. All actions are triggered automatically by the system.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border text-gray-600"
          style={{ borderColor: "#e5e7eb" }}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}

      {/* Next trigger banner */}
      {nextTrigger && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(65,175,235,0.08)", border: "1px solid rgba(65,175,235,0.3)" }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="#41afeb" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold" style={{ color: "#41afeb" }}>Next auto-trigger:</span>
          <span style={{ color: "#374151" }}>{nextTrigger}</span>
        </div>
      )}

      {/* Contract Phase Status */}
      {status?.configured && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#9bafc5" }}>Contract Phase</div>
            <div className="text-xl font-bold" style={{ color: phaseColor }}>{PHASE_LABELS[phase]}</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#9bafc5" }}>Auto Phase</div>
            <div className="text-xl font-bold" style={{ color: status.autoPhaseEnabled ? "#16a34a" : "#9bafc5" }}>
              {status.autoPhaseEnabled ? "On" : "Off"}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#9bafc5" }}>Auto Reveal</div>
            <div className="text-xl font-bold" style={{ color: status.autoRevealEnabled ? "#16a34a" : "#9bafc5" }}>
              {status.autoRevealEnabled ? "On" : "Off"}
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
            <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#9bafc5" }}>Auto Wave Reveal</div>
            <div className="text-xl font-bold" style={{ color: status.autoWaveRevealEnabled ? "#16a34a" : "#9bafc5" }}>
              {status.autoWaveRevealEnabled ? "On" : "Off"}
            </div>
          </div>
        </div>
      )}

      {/* Wave Timeline Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Wave Auto-Trigger Timeline</h2>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            System checks every 60 seconds and auto-triggers on-chain + off-chain actions when dates arrive.
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
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  {["Wave", "Status", "Start Date", "End Date", "Reveal Date", "Start", "End", "Reveal", "Sold", "Auto State"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "#9bafc5", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {waves.map((w, i) => (
                  <tr key={w.wave_number}
                    style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-xs" style={{ color: "#24315f" }}>W{w.wave_number}</div>
                      <div className="text-xs" style={{ color: "#9bafc5" }}>{w.wave_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                        style={{
                          background: w.status === "active" ? "rgba(65,175,235,0.1)" : w.status === "closed" ? "rgba(22,163,74,0.1)" : "rgba(156,163,175,0.1)",
                          color: w.status === "active" ? "#41afeb" : w.status === "closed" ? "#16a34a" : "#9bafc5",
                        }}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#6b7280", whiteSpace: "nowrap" }}>
                      {fmtDate(w.scheduled_start)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#6b7280", whiteSpace: "nowrap" }}>
                      {fmtDate(w.scheduled_end)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: w.reveal_scheduled_at ? "#7c3aed" : "#d1d5db", whiteSpace: "nowrap" }}>
                      {fmtDate(w.reveal_scheduled_at) !== "—" ? fmtDate(w.reveal_scheduled_at) : "Not set"}
                    </td>
                    <td className="px-4 py-3">
                      <TriggerBadge triggered={w.wave_start_triggered} label="Done" />
                    </td>
                    <td className="px-4 py-3">
                      <TriggerBadge triggered={w.wave_end_triggered} label="Done" />
                    </td>
                    <td className="px-4 py-3">
                      <TriggerBadge triggered={w.wave_reveal_triggered} label="Done" />
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#374151", whiteSpace: "nowrap" }}>
                      <span className="font-bold" style={{ color: "#41afeb" }}>{w.sold_count}</span>
                      <span style={{ color: "#9bafc5" }}> / {w.quantity}</span>
                    </td>
                    <td className="px-4 py-3">
                      <AutoStateBadge state={w.auto_trigger_state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
            title: "Auto Wave Start",
            desc: "When a wave's Start Date arrives, the system automatically pushes the schedule on-chain and sets wave status to Active.",
            color: "#41afeb",
          },
          {
            icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
            title: "Auto Wave End",
            desc: "When End Date arrives, unsold NFTs are minted to treasury automatically and wave is closed on-chain.",
            color: "#16a34a",
          },
          {
            icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
            title: "Auto Reveal",
            desc: "When Reveal Date arrives, NFTs are randomly assigned to buyers, on-chain reveal URI is swapped, and buyers see their NFT.",
            color: "#7c3aed",
          },
        ].map(item => (
          <div key={item.title} className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-xl" style={{ background: `${item.color}15` }}>
                <svg className="w-5 h-5" style={{ color: item.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
              </div>
              <h3 className="text-sm font-bold" style={{ color: "#24315f" }}>{item.title}</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{item.desc}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-center" style={{ color: "#d1d5db" }}>
        Set wave dates via Edit button on the NFT Waves page. System auto-triggers every 60 seconds.
      </p>
    </div>
  );
}
