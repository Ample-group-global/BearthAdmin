"use client";

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
  wave_revealed_at: string | null;
  sold_count: number;
  quantity: number;
}

// ─── Local helper (pure logic — duplicated from page to keep component self-contained) ──

function waveState(w: WaveSchedule): "revealed" | "ready_reveal" | "reveal_scheduled" | "active" | "ended" | "ended_zero" | "upcoming" | "not_scheduled" {
  const now = Date.now();
  if (w.is_revealed) return "revealed";
  if (w.wave_start_triggered && !w.wave_end_triggered) return "active";
  if (w.wave_end_triggered) {
    if (w.reveal_scheduled_at && new Date(w.reveal_scheduled_at).getTime() <= now) return "ready_reveal";
    if (w.reveal_scheduled_at && new Date(w.reveal_scheduled_at).getTime() > now) return "reveal_scheduled";
    if ((w.sold_count ?? 0) === 0) return "ended_zero";
    return "ended";
  }
  // Time-window fallback: scheduler may not have fired yet (up to 30s lag)
  if (w.scheduled_start && new Date(w.scheduled_start).getTime() <= now) {
    if (!w.scheduled_end || new Date(w.scheduled_end).getTime() > now) return "active";
    return "ended"; // both start and end passed but DB flags not yet updated
  }
  if (w.scheduled_start) return "upcoming";
  return "not_scheduled";
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface WaveProgressStepperProps {
  revealWaves: WaveSchedule[];
  stateMeta: Record<string, { label: string; color: string; bg: string }>;
}

// ─── WaveProgressStepper ───────────────────────────────────────────────────────

export default function WaveProgressStepper({ revealWaves, stateMeta }: WaveProgressStepperProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
      <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: "#9bafc5" }}>
        Collection Reveal Progress
      </p>
      <div className="flex items-center">
        {revealWaves.map((w, i) => {
          const st = waveState(w);
          const meta = stateMeta[st];
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
  );
}
