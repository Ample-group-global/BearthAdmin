"use client";

import { useEffect, useState } from "react";

interface DutchWave {
  wave_num: number;
  start_price_eth: string;
  floor_price_eth: string;
  decrement_eth: string;
  interval_secs: number;
  status: string;
}

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

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    active:        { bg: "rgba(65,175,235,0.12)",  color: "#41afeb" },
    floor_reached: { bg: "rgba(22,163,74,0.1)",    color: "#16a34a" },
    disabled:      { bg: "rgba(156,163,175,0.12)", color: "#9ca3af" },
  };
  const c = cfg[status] ?? cfg.disabled;
  const label = status === "floor_reached" ? "Floor Reached" : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: c.bg, color: c.color }}>
      {label}
    </span>
  );
}

export default function DutchAuctionPage() {
  const [waves, setWaves]             = useState<DutchWave[]>([]);
  const [currentPrices, setCurrentPrices] = useState<Record<number, string>>({});
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [err, setErr]                 = useState<string | null>(null);
  const [ok, setOk]                   = useState<string | null>(null);
  const [showConfig, setShowConfig]   = useState(false);

  const [configForm, setConfigForm] = useState({
    wave_num: "",
    start_price_eth: "",
    floor_price_eth: "",
    decrement_eth: "",
    interval_secs: "",
  });

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/nft-sell/dutch", { credentials: "include" });
      const d = await r.json();
      const loaded: DutchWave[] = d.waves ?? [];
      setWaves(loaded);

      const prices: Record<number, string> = {};
      await Promise.all(loaded.map(async (w) => {
        try {
          const pr = await fetch(`/api/nft-sell/dutch/${w.wave_num}/price`, { credentials: "include" });
          const pd = await pr.json();
          if (pr.ok && pd.current_price_eth != null) {
            prices[w.wave_num] = String(pd.current_price_eth);
          }
        } catch {
          // ignore price fetch errors
        }
      }));
      setCurrentPrices(prices);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save() {
    const start = parseFloat(configForm.start_price_eth);
    const floor = parseFloat(configForm.floor_price_eth);
    const dec   = parseFloat(configForm.decrement_eth);

    if (!configForm.wave_num) return setErr("Wave number is required.");
    if (isNaN(start) || isNaN(floor) || isNaN(dec)) return setErr("All price fields are required.");
    if (!(start > floor)) return setErr("Start price must be greater than floor price.");
    if (!(floor > dec))   return setErr("Floor price must be greater than decrement.");
    if (!configForm.interval_secs || parseInt(configForm.interval_secs) < 1) return setErr("Interval (seconds) is required.");

    setSaving(true); setErr(null);
    try {
      const r = await fetch("/api/nft-sell/dutch", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wave_num:        parseInt(configForm.wave_num),
          start_price_eth: configForm.start_price_eth,
          floor_price_eth: configForm.floor_price_eth,
          decrement_eth:   configForm.decrement_eth,
          interval_secs:   parseInt(configForm.interval_secs),
        }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to configure Dutch wave");
      setOk("Dutch auction wave configured");
      setShowConfig(false);
      setConfigForm({ wave_num: "", start_price_eth: "", floor_price_eth: "", decrement_eth: "", interval_secs: "" });
      load();
    } finally { setSaving(false); }
  }

  async function disable(waveNum: number) {
    if (!confirm(`Disable Dutch auction for Wave ${waveNum}?`)) return;
    await fetch(`/api/nft-sell/dutch/${waveNum}`, { method: "DELETE", credentials: "include" });
    setOk(`Wave ${waveNum} Dutch auction disabled`);
    load();
  }

  const activeCount  = waves.filter(w => w.status === "active").length;
  const lowestPrice  = waves.length > 0
    ? Math.min(...waves.map(w => parseFloat(currentPrices[w.wave_num] ?? w.floor_price_eth))).toFixed(4)
    : "—";
  const highestStart = waves.length > 0
    ? Math.max(...waves.map(w => parseFloat(w.start_price_eth))).toFixed(4)
    : "—";

  const Overlay = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>Dutch Auction</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Auto-declining price per wave — set it and the contract handles price drops automatically
          </p>
        </div>
        <button
          onClick={() => { setShowConfig(true); setErr(null); setConfigForm({ wave_num: "", start_price_eth: "", floor_price_eth: "", decrement_eth: "", interval_secs: "" }); }}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "#41afeb" }}>
          + Configure Wave
        </button>
      </div>

      {ok  && <div className="px-3 py-2 rounded-lg text-xs text-green-700" style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.3)" }}>{ok}</div>}
      {err && <div className="px-3 py-2 rounded-lg text-xs text-red-600"   style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.3)" }}>{err}</div>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Dutch Waves",    value: activeCount,  color: "#41afeb" },
          { label: "Lowest Current Price",  value: waves.length > 0 ? `${lowestPrice} ETH` : "—", color: "#16a34a" },
          { label: "Highest Start Price",   value: waves.length > 0 ? `${highestStart} ETH` : "—", color: "#d97706" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.label}</div>
            <div className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {["Wave #", "Start Price (ETH)", "Floor Price (ETH)", "Decrement (ETH)", "Interval (secs)", "Current Price", "Status", "Actions"].map(h => (
                  <th key={h} style={thStyle} className="text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {waves.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-sm text-gray-400">No Dutch auction waves configured yet</td></tr>
              ) : waves.map(w => (
                <tr key={w.wave_num} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-sm font-bold" style={{ color: "#24315f" }}>Wave {w.wave_num}</td>
                  <td className="px-3 py-3 text-sm text-gray-700">{w.start_price_eth} ETH</td>
                  <td className="px-3 py-3 text-sm text-gray-700">{w.floor_price_eth} ETH</td>
                  <td className="px-3 py-3 text-sm text-gray-700">{w.decrement_eth} ETH</td>
                  <td className="px-3 py-3 text-sm text-gray-500">{w.interval_secs}s</td>
                  <td className="px-3 py-3 text-sm font-semibold" style={{ color: "#41afeb" }}>
                    {currentPrices[w.wave_num] != null ? `${currentPrices[w.wave_num]} ETH` : "—"}
                  </td>
                  <td className="px-3 py-3"><StatusBadge status={w.status} /></td>
                  <td className="px-3 py-3">
                    {w.status === "active" && (
                      <button onClick={() => disable(w.wave_num)}
                        className="text-xs px-2 py-1 rounded-lg font-medium"
                        style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>
                        Disable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Config Modal */}
      {showConfig && (
        <Overlay>
          <h2 className="text-base font-bold mb-1" style={{ color: "#24315f" }}>Configure Dutch Auction Wave</h2>
          <p className="text-xs text-gray-400 mb-4">Price starts at start price and drops by decrement every interval until floor is reached.</p>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Wave Number</label>
              <select value={configForm.wave_num}
                onChange={e => setConfigForm(f => ({ ...f, wave_num: e.target.value }))}
                style={inputStyle}>
                <option value="">Select wave…</option>
                {[1,2,3,4,5,6,7].map(n => (
                  <option key={n} value={n}>Wave {n}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Start Price (ETH)</label>
                <input type="number" step="0.0001" min="0" value={configForm.start_price_eth}
                  onChange={e => setConfigForm(f => ({ ...f, start_price_eth: e.target.value }))}
                  placeholder="0.1" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Floor Price (ETH)</label>
                <input type="number" step="0.0001" min="0" value={configForm.floor_price_eth}
                  onChange={e => setConfigForm(f => ({ ...f, floor_price_eth: e.target.value }))}
                  placeholder="0.03" style={inputStyle} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Decrement (ETH)</label>
                <input type="number" step="0.0001" min="0" value={configForm.decrement_eth}
                  onChange={e => setConfigForm(f => ({ ...f, decrement_eth: e.target.value }))}
                  placeholder="0.005" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Interval (seconds)</label>
                <input type="number" min="1" value={configForm.interval_secs}
                  onChange={e => setConfigForm(f => ({ ...f, interval_secs: e.target.value }))}
                  placeholder="300" style={inputStyle} />
              </div>
            </div>
            <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "rgba(65,175,235,0.06)", border: "1px solid rgba(65,175,235,0.2)", color: "#41afeb" }}>
              Validate: start &gt; floor &gt; decrement. Price drops by decrement every interval until floor is reached.
            </div>
          </div>
          {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowConfig(false)}
              className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">
              Cancel
            </button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Save Configuration"}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
