"use client";

import { useEffect, useState } from "react";

interface BurnRatio {
  id: string;
  from_rarity: string;
  to_rarity: string;
  burn_count: number;
  is_active: boolean;
}

interface BurnHistory {
  id: string;
  token_id: number;
  serial_number: string | null;
  rarity_tier: string | null;
  burn_tx_hash: string | null;
  burned_at: string | null;
  upgraded_from: string[] | null;
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

const RARITY_COLORS: Record<string, string> = {
  legendary: "#d97706", epic: "#7c3aed", rare: "#41afeb", common: "#9ca3af",
};

export default function BurnPage() {
  const [ratios, setRatios]     = useState<BurnRatio[]>([]);
  const [history, setHistory]   = useState<BurnHistory[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [executing, setExecuting] = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [ok, setOk]             = useState<string | null>(null);

  const [editRatio, setEditRatio] = useState<BurnRatio | null>(null);
  const [editForm, setEditForm]   = useState({ burn_count: "" });

  const [burnIds, setBurnIds]         = useState("");
  const [recipientWallet, setRecipientWallet] = useState("");
  const [burnPreview, setBurnPreview] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/nft-sell/burn/ratios", { credentials: "include" }),
        fetch("/api/nft-sell/burn/history", { credentials: "include" }),
      ]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      setRatios(d1.ratios ?? []);
      setHistory(d2.history ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { loadAll(); }, []);

  async function saveRatio() {
    if (!editRatio) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetch("/api/nft-sell/burn/ratios", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_rarity: editRatio.from_rarity,
          to_rarity: editRatio.to_rarity,
          burn_count: parseInt(editForm.burn_count),
        }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to save ratio");
      setOk("Burn ratio updated"); setEditRatio(null); loadAll();
    } finally { setSaving(false); }
  }

  function previewBurn() {
    const ids = burnIds.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
    if (!ids.length) { setBurnPreview(null); return; }
    setBurnPreview(`${ids.length} NFT record(s) will be burned → 1 upgraded NFT minted to ${recipientWallet || "(no wallet)"}`);
  }

  async function executeBurn() {
    const ids = burnIds.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
    if (!ids.length || !recipientWallet) {
      setErr("Both NFT record IDs and recipient wallet are required"); return;
    }
    if (!confirm(`Burn ${ids.length} NFT(s) and mint 1 upgraded NFT to ${recipientWallet}?\n\nThis action is irreversible on-chain.`)) return;

    setExecuting(true); setErr(null);
    try {
      const r = await fetch("/api/nft-sell/burn/execute", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ burn_nft_record_ids: ids, recipient_wallet: recipientWallet }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Burn failed");
      setOk(`Burned ${d.burned_count} NFT(s) → upgraded #${d.upgraded_record_id ?? "?"} · Tx: ${d.txHash?.slice(0, 18)}…`);
      setBurnIds(""); setRecipientWallet(""); setBurnPreview(null); loadAll();
    } finally { setExecuting(false); }
  }

  const stats = {
    burned:   history.length,
    upgraded: history.filter(h => h.upgraded_from?.length).length,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>Burn to Mint</h1>
        <p className="text-sm text-gray-400 mt-0.5">Burn N tokens of one rarity → mint 1 upgraded token of the next rarity</p>
      </div>

      {ok && <div className="px-3 py-2 rounded-lg text-xs text-green-700" style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.3)" }}>{ok}</div>}
      {err && <div className="px-3 py-2 rounded-lg text-xs text-red-600" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.3)" }}>{err}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Total Burned", value: stats.burned, color: "#dc2626" },
          { label: "Total Upgraded", value: stats.upgraded, color: "#7c3aed" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.label}</div>
            <div className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Burn Ratios */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Burn Ratios</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  {["From", "To", "Burn Count", ""].map(h => <th key={h} style={thStyle} className="text-left">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {ratios.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-6 text-xs text-gray-400">No ratios configured</td></tr>
                ) : ratios.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                        style={{ background: `${RARITY_COLORS[r.from_rarity]}18`, color: RARITY_COLORS[r.from_rarity] }}>
                        {r.from_rarity}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                        style={{ background: `${RARITY_COLORS[r.to_rarity]}18`, color: RARITY_COLORS[r.to_rarity] }}>
                        {r.to_rarity}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm font-bold text-gray-700">{r.burn_count}:1</td>
                    <td className="px-3 py-3">
                      <button onClick={() => { setEditRatio(r); setEditForm({ burn_count: String(r.burn_count) }); }}
                        className="text-xs px-2 py-1 rounded-lg font-medium"
                        style={{ background: "rgba(65,175,235,0.12)", color: "#41afeb" }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Execute Burn */}
        <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: "1px solid #e5e7eb" }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: "#24315f" }}>Execute Burn &amp; Upgrade</h2>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>NFT Record UUIDs to Burn (comma or newline)</label>
              <textarea value={burnIds}
                onChange={e => { setBurnIds(e.target.value); setBurnPreview(null); }}
                rows={4} placeholder="uuid1, uuid2, uuid3…"
                style={{ ...inputStyle, resize: "vertical" }} />
            </div>
            <div>
              <label style={labelStyle}>Recipient Wallet (receives upgraded NFT)</label>
              <input type="text" value={recipientWallet}
                onChange={e => { setRecipientWallet(e.target.value); setBurnPreview(null); }}
                placeholder="0x..." style={inputStyle} />
            </div>
            <button onClick={previewBurn} className="w-full py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-700">
              Preview
            </button>
            {burnPreview && (
              <div className="px-3 py-2 rounded-lg text-xs text-gray-700" style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.3)" }}>
                {burnPreview}
              </div>
            )}
            <button onClick={executeBurn} disabled={executing}
              className="w-full py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: "#dc2626", opacity: executing ? 0.6 : 1 }}>
              {executing ? "Executing on-chain…" : "🔥 Execute Burn & Upgrade"}
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Burn History</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              {["Token ID", "Serial", "Rarity", "Tx Hash", "Burned At"].map(h => (
                <th key={h} style={thStyle} className="text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-6 text-sm text-gray-400">No burns yet</td></tr>
            ) : history.map(h => (
              <tr key={h.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-3 py-3 text-sm font-semibold text-gray-700">#{h.token_id}</td>
                <td className="px-3 py-3 text-xs text-gray-500">{h.serial_number ?? "—"}</td>
                <td className="px-3 py-3">
                  {h.rarity_tier && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                      style={{ background: `${RARITY_COLORS[h.rarity_tier] ?? "#9ca3af"}18`, color: RARITY_COLORS[h.rarity_tier] ?? "#9ca3af" }}>
                      {h.rarity_tier}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-xs font-mono text-gray-500">{h.burn_tx_hash ? h.burn_tx_hash.slice(0, 14) + "…" : "—"}</td>
                <td className="px-3 py-3 text-xs text-gray-400">{h.burned_at ? new Date(h.burned_at).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Ratio Modal */}
      {editRatio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-base font-bold mb-4" style={{ color: "#24315f" }}>
              Edit Ratio: {editRatio.from_rarity} → {editRatio.to_rarity}
            </h2>
            <div>
              <label style={labelStyle}>Burn Count (how many to burn for 1 upgrade)</label>
              <input type="number" min={2} value={editForm.burn_count}
                onChange={e => setEditForm(f => ({ ...f, burn_count: e.target.value }))} style={inputStyle} />
            </div>
            {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditRatio(null)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
              <button onClick={saveRatio} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
