"use client";

import { ErrBanner } from "@/components/nft/Banner";

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

// ─── Props ─────────────────────────────────────────────────────────────────────

interface RevealScheduleEditModalProps {
  wave: WaveSchedule;
  date: string;
  onDateChange: (v: string) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}

// ─── RevealScheduleEditModal ───────────────────────────────────────────────────

export default function RevealScheduleEditModal({
  wave,
  date,
  onDateChange,
  onSave,
  onClose,
  saving,
  error,
}: RevealScheduleEditModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="ba-modal-sm shadow-xl">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>
              Set Reveal Date — W{wave.wave_number} {wave.wave_name}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
              Choose when this wave will be revealed to holders
            </p>
          </div>
          <button onClick={onClose} style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <ErrBanner msg={error} onDismiss={() => {/* caller manages error state */}} />}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
              Reveal Date &amp; Time
            </label>
            <input
              type="datetime-local"
              value={date}
              onChange={e => onDateChange(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{ border: "1px solid #d1d5db", outline: "none" }}
            />
            <p className="text-xs mt-1.5" style={{ color: "#9bafc5" }}>
              This date is shown to your community. The actual on-chain reveal tx runs when you click &quot;Reveal Now&quot;.
            </p>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "white" }}>
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving || !date}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: saving || !date ? "#9bafc5" : "#7c3aed", cursor: saving || !date ? "not-allowed" : "pointer" }}>
              {saving ? "Saving…" : "Save Reveal Date"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
