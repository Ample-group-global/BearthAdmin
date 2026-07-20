"use client";

import { useEffect, useState } from "react";

interface OtcDeal {
  id: string;
  buyer_name: string | null;
  buyer_wallet: string;
  nft_record_ids: string[];
  negotiated_price_eth: string | null;
  negotiated_price_twd: string | null;
  payment_method: string | null;
  status: string;
  notes: string | null;
  transfer_tx_hash: string | null;
  transferred_at: string | null;
  created_at: string;
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
    pending:     { bg: "rgba(217,119,6,0.1)",    color: "#d97706" },
    confirmed:   { bg: "rgba(65,175,235,0.12)",  color: "#41afeb" },
    transferred: { bg: "rgba(22,163,74,0.1)",    color: "#16a34a" },
    cancelled:   { bg: "rgba(156,163,175,0.12)", color: "#9ca3af" },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}

export default function OtcPage() {
  const [deals, setDeals]         = useState<OtcDeal[]>([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState<string | null>(null);
  const [ok, setOk]               = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [settleId, setSettleId]   = useState<string | null>(null);
  const [settleTxHash, setSettleTxHash] = useState("");
  const [selected, setSelected]   = useState<OtcDeal | null>(null);

  const [createForm, setCreateForm] = useState({
    buyer_name: "",
    buyer_wallet: "",
    nft_record_ids_text: "",
    negotiated_price_eth: "",
    negotiated_price_twd: "",
    payment_method: "eth",
    notes: "",
  });

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/nft-sell/otc", { credentials: "include" });
      const d = await r.json();
      setDeals(d.deals ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!createForm.buyer_wallet) return setErr("Buyer wallet is required.");
    setSaving(true); setErr(null);
    try {
      const nft_record_ids = createForm.nft_record_ids_text
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        buyer_wallet:   createForm.buyer_wallet,
        payment_method: createForm.payment_method,
      };
      if (createForm.buyer_name)           body.buyer_name           = createForm.buyer_name;
      if (nft_record_ids.length > 0)       body.nft_record_ids       = nft_record_ids;
      if (createForm.negotiated_price_eth) body.negotiated_price_eth = createForm.negotiated_price_eth;
      if (createForm.negotiated_price_twd) body.negotiated_price_twd = createForm.negotiated_price_twd;
      if (createForm.notes)                body.notes                = createForm.notes;

      const r = await fetch("/api/nft-sell/otc", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to create OTC deal");
      setOk("OTC deal created");
      setShowCreate(false);
      setCreateForm({ buyer_name: "", buyer_wallet: "", nft_record_ids_text: "", negotiated_price_eth: "", negotiated_price_twd: "", payment_method: "eth", notes: "" });
      load();
    } finally { setSaving(false); }
  }

  async function settle() {
    if (!settleId) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/nft-sell/otc/${settleId}/settle`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tx_hash: settleTxHash || undefined }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to settle deal");
      setOk("Deal settled and marked as transferred");
      setSettleId(null);
      setSettleTxHash("");
      load();
    } finally { setSaving(false); }
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this OTC deal? This cannot be undone.")) return;
    await fetch(`/api/nft-sell/otc/${id}`, { method: "DELETE", credentials: "include" });
    setOk("Deal cancelled");
    load();
  }

  const settleTarget = deals.find(d => d.id === settleId) ?? null;

  const stats = {
    total:       deals.length,
    pending:     deals.filter(d => d.status === "pending").length,
    transferred: deals.filter(d => d.status === "transferred").length,
  };

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
          <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>OTC / Private Sale</h1>
          <p className="text-sm text-gray-400 mt-0.5">Direct negotiated sales to specific buyers</p>
        </div>
        <button onClick={() => { setShowCreate(true); setErr(null); }}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "#41afeb" }}>
          + New OTC Deal
        </button>
      </div>

      {ok  && <div className="px-3 py-2 rounded-lg text-xs text-green-700" style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.3)" }}>{ok}</div>}
      {err && <div className="px-3 py-2 rounded-lg text-xs text-red-600"   style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.3)" }}>{err}</div>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Deals",  value: stats.total,       color: "#41afeb" },
          { label: "Pending",      value: stats.pending,     color: "#d97706" },
          { label: "Transferred",  value: stats.transferred, color: "#16a34a" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.label}</div>
            <div className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Deals Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {["Buyer", "Wallet", "NFT Count", "Price ETH", "Price TWD", "Method", "Status", "Created", "Actions"].map(h => (
                  <th key={h} style={thStyle} className="text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-8 text-sm text-gray-400">No OTC deals yet</td></tr>
              ) : deals.map(deal => (
                <tr key={deal.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-sm text-gray-700">{deal.buyer_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-3 text-sm font-mono text-gray-500">
                    {deal.buyer_wallet.slice(0, 6)}…{deal.buyer_wallet.slice(-4)}
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold" style={{ color: "#41afeb" }}>
                    {deal.nft_record_ids?.length ?? 0}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700">
                    {deal.negotiated_price_eth != null ? `${deal.negotiated_price_eth} ETH` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700">
                    {deal.negotiated_price_twd != null ? `TWD ${deal.negotiated_price_twd}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-500 capitalize">{deal.payment_method ?? "—"}</td>
                  <td className="px-3 py-3"><StatusBadge status={deal.status} /></td>
                  <td className="px-3 py-3 text-xs text-gray-400">
                    {new Date(deal.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      {(deal.status === "pending" || deal.status === "confirmed") && (
                        <button
                          onClick={() => { setSettleId(deal.id); setSettleTxHash(""); setSelected(deal); setErr(null); }}
                          className="text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                          Settle
                        </button>
                      )}
                      {deal.status !== "transferred" && deal.status !== "cancelled" && (
                        <button onClick={() => cancel(deal.id)}
                          className="text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Overlay>
          <h2 className="text-base font-bold mb-4" style={{ color: "#24315f" }}>New OTC Deal</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Buyer Name (optional)</label>
                <input type="text" value={createForm.buyer_name}
                  onChange={e => setCreateForm(f => ({ ...f, buyer_name: e.target.value }))}
                  placeholder="John Doe" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Buyer Wallet *</label>
                <input type="text" value={createForm.buyer_wallet}
                  onChange={e => setCreateForm(f => ({ ...f, buyer_wallet: e.target.value }))}
                  placeholder="0x…" style={{ ...inputStyle, fontFamily: "monospace" }} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>NFT Record IDs (optional)</label>
              <textarea value={createForm.nft_record_ids_text}
                onChange={e => setCreateForm(f => ({ ...f, nft_record_ids_text: e.target.value }))}
                rows={3}
                placeholder="Paste specific NFT record UUIDs to assign to this deal (optional)"
                style={{ ...inputStyle, resize: "vertical" }} />
              <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>
                Paste specific NFT record UUIDs to assign to this deal (optional). One per line or comma-separated.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Price (ETH)</label>
                <input type="number" step="0.0001" value={createForm.negotiated_price_eth}
                  onChange={e => setCreateForm(f => ({ ...f, negotiated_price_eth: e.target.value }))}
                  placeholder="0.05" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Price (TWD)</label>
                <input type="number" step="1" value={createForm.negotiated_price_twd}
                  onChange={e => setCreateForm(f => ({ ...f, negotiated_price_twd: e.target.value }))}
                  placeholder="50000" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Payment Method</label>
              <select value={createForm.payment_method}
                onChange={e => setCreateForm(f => ({ ...f, payment_method: e.target.value }))}
                style={inputStyle}>
                <option value="eth">ETH</option>
                <option value="twd">TWD</option>
                <option value="mixed">Mixed</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={createForm.notes}
                onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} style={{ ...inputStyle, resize: "vertical" }}
                placeholder="e.g. Negotiated at 10% discount, refer to invoice #001" />
            </div>
          </div>
          {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowCreate(false)}
              className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">
              Cancel
            </button>
            <button onClick={create} disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Creating…" : "Create Deal"}
            </button>
          </div>
        </Overlay>
      )}

      {/* Settle Modal */}
      {settleId && settleTarget && (
        <Overlay>
          <h2 className="text-base font-bold mb-1" style={{ color: "#24315f" }}>Settle OTC Deal</h2>
          <p className="text-xs text-gray-400 mb-4">Mark this deal as transferred and optionally record the on-chain transaction hash.</p>
          <div className="space-y-3">
            <div className="px-3 py-2 rounded-lg text-xs" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <div className="text-gray-400 uppercase tracking-wide font-semibold mb-1" style={{ fontSize: "10px" }}>Deal Summary</div>
              <div className="text-gray-700">Buyer: <span className="font-mono">{settleTarget.buyer_wallet.slice(0, 10)}…{settleTarget.buyer_wallet.slice(-4)}</span></div>
              <div className="text-gray-700">Price: {settleTarget.negotiated_price_eth ? `${settleTarget.negotiated_price_eth} ETH` : "—"}{settleTarget.negotiated_price_twd ? ` / TWD ${settleTarget.negotiated_price_twd}` : ""}</div>
              <div className="text-gray-700">NFT Count: {settleTarget.nft_record_ids?.length ?? 0}</div>
            </div>
            <div>
              <label style={labelStyle}>Transfer Tx Hash (optional)</label>
              <input type="text" value={settleTxHash}
                onChange={e => setSettleTxHash(e.target.value)}
                placeholder="0x… (paste on-chain tx hash if available)"
                style={{ ...inputStyle, fontFamily: "monospace" }} />
            </div>
          </div>
          {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
          <div className="flex gap-3 mt-5">
            <button onClick={() => { setSettleId(null); setSelected(null); }}
              className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">
              Cancel
            </button>
            <button onClick={settle} disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#16a34a", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Settling…" : "Mark as Transferred"}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
