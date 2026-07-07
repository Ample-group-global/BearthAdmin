"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Wave {
  id: string;
  waveNumber: number;
  name: string;
  stageId: string | null;
  stageName: string | null;
  quantity: number;
  cumulativeStart: number;
  cumulativeEnd: number;
  defaultPriceEth: number | null;
  saleMethod: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: string;
  notes: string | null;
  nftCount: number;
  createdAt: string;
  updatedAt: string;
}

const SALE_METHODS: Record<string, string> = {
  free_mint:       "Free Mint",
  fixed_price:     "Fixed Price",
  english_auction: "English Auction",
};

const STATUS_OPTS = ["upcoming", "active", "completed", "paused"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    completed: { bg: "rgba(22,163,74,0.1)",   color: "#16a34a", label: "Completed"   },
    active:    { bg: "rgba(65,175,235,0.12)",  color: "#41afeb", label: "Active"      },
    upcoming:  { bg: "rgba(156,163,175,0.12)", color: "#9ca3af", label: "Upcoming"    },
    paused:    { bg: "rgba(217,119,6,0.1)",   color: "#d97706", label: "Paused"      },
  };
  const c = cfg[status] ?? cfg.upcoming;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: c.bg, color: c.color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: c.color }} />
      {c.label}
    </span>
  );
}

function SaleMethodBadge({ method }: { method: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    free_mint:       { bg: "rgba(22,163,74,0.1)",   color: "#16a34a" },
    fixed_price:     { bg: "rgba(65,175,235,0.12)",  color: "#41afeb" },
    english_auction: { bg: "rgba(124,58,237,0.1)",  color: "#7c3aed" },
  };
  const c = cfg[method] ?? cfg.fixed_price;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: c.bg, color: c.color }}>
      {SALE_METHODS[method] ?? method}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WavesPage() {
  const [waves, setWaves]       = useState<Wave[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [editWave, setEditWave] = useState<Wave | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [form, setForm] = useState({
    defaultPriceEth: "",
    saleMethod: "",
    scheduledStart: "",
    scheduledEnd: "",
    status: "",
    notes: "",
    clearSchedule: false,
  });

  const loadWaves = () => {
    setLoading(true); setError(null);
    fetch("/api/presale/waves", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setWaves(d.waves ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load waves."); setLoading(false); });
  };

  useEffect(() => { loadWaves(); }, []);

  const openEdit = (w: Wave) => {
    setEditWave(w);
    setForm({
      defaultPriceEth: w.defaultPriceEth != null ? String(w.defaultPriceEth) : "",
      saleMethod:      w.saleMethod ?? "fixed_price",
      scheduledStart:  w.scheduledStart ? w.scheduledStart.slice(0, 16) : "",
      scheduledEnd:    w.scheduledEnd   ? w.scheduledEnd.slice(0, 16)   : "",
      status:          w.status ?? "upcoming",
      notes:           w.notes ?? "",
      clearSchedule:   false,
    });
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editWave) return;
    setSaving(true); setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        defaultPriceEth: form.defaultPriceEth !== "" ? Number(form.defaultPriceEth) : null,
        saleMethod:      form.saleMethod   || null,
        scheduledStart:  form.clearSchedule ? null : (form.scheduledStart ? new Date(form.scheduledStart).toISOString() : null),
        scheduledEnd:    form.clearSchedule ? null : (form.scheduledEnd   ? new Date(form.scheduledEnd).toISOString()   : null),
        status:          form.status       || null,
        notes:           form.notes        || null,
        clearSchedule:   form.clearSchedule,
      };
      const res = await fetch(`/api/presale/waves/${editWave.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setSaveError(d.error ?? "Save failed."); return; }
      setEditWave(null); loadWaves();
    } catch { setSaveError("Network error."); }
    finally { setSaving(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: "8px",
    border: "1px solid #e5e7eb", fontSize: "13px", color: "#111827", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "11px", fontWeight: 700,
    color: "#9bafc5", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em",
  };
  const thStyle: React.CSSProperties = {
    fontSize: "11px", fontWeight: 700, color: "#9bafc5",
    textTransform: "uppercase", letterSpacing: "0.06em",
    padding: "10px 14px", borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb", whiteSpace: "nowrap",
  };

  const totalNfts = waves.reduce((s, w) => s + w.quantity, 0);
  const activeWave = waves.find(w => w.status === "active");
  const completedCount = waves.filter(w => w.status === "completed").length;

  return (
    <div className="p-5 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "#24315f" }}>NFT Waves & Phases</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            Manage launch schedule, pricing, and sale methods for each wave
          </p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Waves",    value: String(waves.length),      color: "#41afeb" },
          { label: "Completed",      value: String(completedCount),    color: "#16a34a" },
          { label: "Active Wave",    value: activeWave?.name ?? "—",   color: "#7c3aed", small: true },
          { label: "Total NFTs",     value: String(totalNfts),         color: "#24315f" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>{s.label}</p>
            <p className={`font-bold ${s.small ? "text-sm" : "text-2xl"}`} style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          {error}
        </div>
      )}

      {/* ── Waves Table ── */}
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
                  {["Wave", "Stage", "Qty", "Cumulative", "Default Price (ETH)", "Sale Method", "Schedule", "Status", "NFTs", "Actions"].map(h => (
                    <th key={h} style={{ ...thStyle, textAlign: h === "Qty" || h === "NFTs" || h === "Cumulative" ? "center" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {waves.map((w, i) => (
                  <tr key={w.id}
                    style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>

                    <td style={{ padding: "10px 14px" }}>
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: w.status === "completed" ? "#16a34a" : w.status === "active" ? "#41afeb" : "#9bafc5" }}>
                          {w.waveNumber}
                        </span>
                        <div>
                          <div className="font-semibold text-xs" style={{ color: "#111827" }}>{w.name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span className="text-xs" style={{ color: "#6b7280" }}>{w.stageName ?? "—"}</span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span className="text-xs font-semibold" style={{ color: "#374151" }}>
                        {w.quantity.toLocaleString()}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span className="text-xs font-mono" style={{ color: "#9bafc5" }}>
                        #{w.cumulativeStart}–#{w.cumulativeEnd}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {w.defaultPriceEth != null ? (
                        <span className="font-bold text-xs" style={{ color: "#24315f" }}>
                          {Number(w.defaultPriceEth)} ETH
                        </span>
                      ) : (
                        <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>Free</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <SaleMethodBadge method={w.saleMethod} />
                    </td>
                    <td style={{ padding: "10px 14px", minWidth: 160 }}>
                      {w.scheduledStart || w.scheduledEnd ? (
                        <div className="text-xs" style={{ color: "#6b7280" }}>
                          {w.scheduledStart && (
                            <div>From: <strong style={{ color: "#374151" }}>{new Date(w.scheduledStart).toLocaleDateString()}</strong></div>
                          )}
                          {w.scheduledEnd && (
                            <div>To: <strong style={{ color: "#374151" }}>{new Date(w.scheduledEnd).toLocaleDateString()}</strong></div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs" style={{ color: "#d1d5db" }}>Not scheduled</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <StatusBadge status={w.status} />
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>
                        {w.nftCount.toLocaleString()}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => openEdit(w)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                        style={{ border: "1px solid #e5e7eb", color: "#41afeb", background: "white" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "rgba(65,175,235,0.06)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Totals footer */}
      {!loading && waves.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold"
          style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#24315f" }}>
          <span>Total across all waves</span>
          <div className="flex items-center gap-6">
            <span>NFTs: <strong>{waves.reduce((s, w) => s + w.quantity, 0).toLocaleString()} / 9,999</strong></span>
            <span>Assigned: <strong style={{ color: "#41afeb" }}>{waves.reduce((s, w) => s + Number(w.nftCount), 0).toLocaleString()}</strong></span>
          </div>
        </div>
      )}

      {/* ══ Edit Wave Modal ══════════════════════════════════════════════════════ */}
      {editWave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl flex flex-col"
            style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", border: "1px solid #e5e7eb" }}>
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
              <div>
                <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>
                  Edit Wave {editWave.waveNumber} — {editWave.name}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                  {editWave.quantity.toLocaleString()} NFTs · #{editWave.cumulativeStart}–#{editWave.cumulativeEnd}
                </p>
              </div>
              <button onClick={() => setEditWave(null)} style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              {saveError && (
                <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  {saveError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Default Price (ETH)</label>
                  <input type="number" step="0.0001" min="0"
                    value={form.defaultPriceEth}
                    onChange={e => setForm({ ...form, defaultPriceEth: e.target.value })}
                    style={inputStyle} placeholder="0 = Free" />
                  <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>Leave blank for free mint</p>
                </div>
                <div>
                  <label style={labelStyle}>Sale Method</label>
                  <select value={form.saleMethod}
                    onChange={e => setForm({ ...form, saleMethod: e.target.value })}
                    style={inputStyle}>
                    {Object.entries(SALE_METHODS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTS.map(s => (
                    <button key={s} onClick={() => setForm({ ...form, status: s })}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                      style={{
                        border: "1px solid",
                        borderColor: form.status === s ? "#41afeb" : "#e5e7eb",
                        background: form.status === s ? "rgba(65,175,235,0.1)" : "white",
                        color: form.status === s ? "#41afeb" : "#6b7280",
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Schedule</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox"
                      checked={form.clearSchedule}
                      onChange={e => setForm({ ...form, clearSchedule: e.target.checked, scheduledStart: "", scheduledEnd: "" })}
                    />
                    <span className="text-xs" style={{ color: "#9bafc5" }}>Clear schedule</span>
                  </label>
                </div>
                {!form.clearSchedule && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label style={labelStyle}>Start Date & Time</label>
                      <input type="datetime-local" value={form.scheduledStart}
                        onChange={e => setForm({ ...form, scheduledStart: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>End Date & Time</label>
                      <input type="datetime-local" value={form.scheduledEnd}
                        onChange={e => setForm({ ...form, scheduledEnd: e.target.value })} style={inputStyle} />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
                  placeholder="Internal notes about this wave…" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #e5e7eb" }}>
              <button onClick={() => setEditWave(null)} className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: saving ? "#9bafc5" : "#41afeb" }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
