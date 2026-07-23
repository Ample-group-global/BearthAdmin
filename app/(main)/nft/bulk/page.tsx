"use client";

import { useEffect, useState } from "react";
import { ErrBanner } from "@/components/nft/ErrBanner";
import { OkBanner } from "@/components/nft/OkBanner";
import { labelStyle, inputStyle, thStyle } from "@/components/nft/styles";

interface BulkOrder {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  buyer_wallet: string;
  quantity: number;
  rarity_tier: string | null;
  unit_price_eth: string | null;
  discount_pct: string;
  total_price_eth: string | null;
  total_price_twd: string | null;
  payment_method: string | null;
  status: string;
  minted_token_ids: number[];
  notes: string | null;
  created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    pending:   { bg: "rgba(217,119,6,0.1)",    color: "#d97706" },
    confirmed: { bg: "rgba(65,175,235,0.12)",  color: "#41afeb" },
    minting:   { bg: "rgba(124,58,237,0.1)",   color: "#7c3aed" },
    completed: { bg: "rgba(22,163,74,0.1)",    color: "#16a34a" },
    cancelled: { bg: "rgba(156,163,175,0.12)", color: "#9ca3af" },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}

function RarityBadge({ rarity }: { rarity: string | null }) {
  if (!rarity || rarity === "any") return <span className="text-xs text-gray-400">Any</span>;
  const cfg: Record<string, { bg: string; color: string }> = {
    legendary: { bg: "rgba(217,119,6,0.1)",   color: "#d97706" },
    epic:      { bg: "rgba(124,58,237,0.1)",  color: "#7c3aed" },
    rare:      { bg: "rgba(65,175,235,0.12)", color: "#41afeb" },
    common:    { bg: "rgba(156,163,175,0.12)",color: "#9ca3af" },
  };
  const c = cfg[rarity] ?? cfg.common;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: c.bg, color: c.color }}>
      {rarity}
    </span>
  );
}

export default function BulkPage() {
  const [orders, setOrders]       = useState<BulkOrder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fulfilling, setFulfilling] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState<string | null>(null);
  const [ok, setOk]               = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [fulfillId, setFulfillId] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    company_name: "",
    contact_name: "",
    contact_email: "",
    buyer_wallet: "",
    quantity: "2",
    rarity_tier: "any",
    unit_price_eth: "",
    unit_price_twd: "",
    discount_pct: "0",
    total_price_eth: "",
    total_price_twd: "",
    payment_method: "eth",
    notes: "",
  });

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/nft-sell/bulk", { credentials: "include" });
      const d = await r.json();
      setOrders(d.orders ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function computeTotals(form: typeof createForm) {
    const unit = parseFloat(form.unit_price_eth);
    const qty  = parseInt(form.quantity);
    const disc = parseFloat(form.discount_pct) / 100;
    if (!isNaN(unit) && !isNaN(qty) && qty > 0) {
      const total = unit * qty * (1 - disc);
      return total.toFixed(4);
    }
    return "";
  }

  async function create() {
    if (!createForm.company_name) return setErr("Company name is required.");
    if (!createForm.buyer_wallet) return setErr("Buyer wallet is required.");
    const qty = parseInt(createForm.quantity);
    if (isNaN(qty) || qty < 2)    return setErr("Quantity must be at least 2 for bulk orders.");

    setSaving(true); setErr(null);
    try {
      const body: Record<string, unknown> = {
        company_name:   createForm.company_name,
        buyer_wallet:   createForm.buyer_wallet,
        quantity:       qty,
        discount_pct:   createForm.discount_pct || "0",
        payment_method: createForm.payment_method,
      };
      if (createForm.contact_name)    body.contact_name    = createForm.contact_name;
      if (createForm.contact_email)   body.contact_email   = createForm.contact_email;
      if (createForm.rarity_tier && createForm.rarity_tier !== "any") body.rarity_tier = createForm.rarity_tier;
      if (createForm.unit_price_eth)  body.unit_price_eth  = createForm.unit_price_eth;
      if (createForm.unit_price_twd)  body.unit_price_twd  = createForm.unit_price_twd;
      if (createForm.total_price_eth) body.total_price_eth = createForm.total_price_eth;
      if (createForm.total_price_twd) body.total_price_twd = createForm.total_price_twd;
      if (createForm.notes)           body.notes           = createForm.notes;

      const r = await fetch("/api/nft-sell/bulk", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to create bulk order");
      setOk("Bulk order created");
      setShowCreate(false);
      setCreateForm({ company_name: "", contact_name: "", contact_email: "", buyer_wallet: "", quantity: "2", rarity_tier: "any", unit_price_eth: "", unit_price_twd: "", discount_pct: "0", total_price_eth: "", total_price_twd: "", payment_method: "eth", notes: "" });
      load();
    } finally { setSaving(false); }
  }

  async function fulfill(id: string) {
    const order = orders.find(o => o.id === id);
    if (!order) return;
    if (!confirm(`Mint ${order.quantity} NFTs to ${order.buyer_wallet.slice(0, 10)}… on-chain? This action cannot be undone.`)) return;
    setFulfilling(true); setErr(null);
    try {
      const r = await fetch(`/api/nft-sell/bulk/${id}/fulfill`, {
        method: "POST", credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to fulfill bulk order");
      setOk(`Bulk order fulfilled — ${order.quantity} NFTs minted`);
      load();
    } finally { setFulfilling(false); }
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this bulk order?")) return;
    await fetch(`/api/nft-sell/bulk/${id}`, { method: "DELETE", credentials: "include" });
    setOk("Bulk order cancelled");
    load();
  }

  const stats = {
    total:     orders.length,
    totalNfts: orders.reduce((sum, o) => sum + (o.quantity ?? 0), 0),
    completed: orders.filter(o => o.status === "completed").length,
  };

  const autoTotal = computeTotals(createForm);

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
          <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>Corporate / Bulk Purchase</h1>
          <p className="text-sm text-gray-400 mt-0.5">Volume orders with discounts for companies and agencies</p>
        </div>
        <button onClick={() => { setShowCreate(true); setErr(null); }}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "#41afeb" }}>
          + New Bulk Order
        </button>
      </div>

      {ok  && <OkBanner  msg={ok}  onDismiss={() => setOk(null)} />}
      {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Orders",       value: stats.total,     color: "#41afeb" },
          { label: "Total NFTs Ordered", value: stats.totalNfts, color: "#7c3aed" },
          { label: "Completed Orders",   value: stats.completed, color: "#16a34a" },
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
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {["Company", "Contact", "Wallet", "Qty", "Rarity", "Unit Price", "Discount%", "Total ETH", "Status", "Actions"].map(h => (
                  <th key={h} style={thStyle} className="text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-sm text-gray-400">No bulk orders yet</td></tr>
              ) : orders.map(order => (
                <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-sm font-semibold" style={{ color: "#24315f" }}>{order.company_name}</td>
                  <td className="px-3 py-3 text-sm text-gray-600">{order.contact_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-3 text-sm font-mono text-gray-500">
                    {order.buyer_wallet ? `${order.buyer_wallet.slice(0, 6)}…${order.buyer_wallet.slice(-4)}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-sm font-bold" style={{ color: "#41afeb" }}>{order.quantity}</td>
                  <td className="px-3 py-3"><RarityBadge rarity={order.rarity_tier} /></td>
                  <td className="px-3 py-3 text-sm text-gray-700">
                    {order.unit_price_eth != null ? `${order.unit_price_eth} ETH` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700">{order.discount_pct}%</td>
                  <td className="px-3 py-3 text-sm font-semibold" style={{ color: "#24315f" }}>
                    {order.total_price_eth != null ? `${order.total_price_eth} ETH` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-3"><StatusBadge status={order.status} /></td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      {(order.status === "pending" || order.status === "confirmed") && (
                        <button
                          onClick={() => fulfill(order.id)}
                          disabled={fulfilling}
                          className="text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a", opacity: fulfilling ? 0.6 : 1 }}>
                          {fulfilling ? "…" : "Fulfill"}
                        </button>
                      )}
                      {order.status !== "completed" && order.status !== "cancelled" && (
                        <button onClick={() => cancel(order.id)}
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
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <Overlay>
          <h2 className="text-base font-bold mb-4" style={{ color: "#24315f" }}>New Bulk Order</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Company Name *</label>
                <input type="text" value={createForm.company_name}
                  onChange={e => setCreateForm(f => ({ ...f, company_name: e.target.value }))}
                  placeholder="Acme Corp" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Contact Name</label>
                <input type="text" value={createForm.contact_name}
                  onChange={e => setCreateForm(f => ({ ...f, contact_name: e.target.value }))}
                  placeholder="Jane Smith" style={inputStyle} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Contact Email</label>
                <input type="email" value={createForm.contact_email}
                  onChange={e => setCreateForm(f => ({ ...f, contact_email: e.target.value }))}
                  placeholder="jane@acme.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Buyer Wallet *</label>
                <input type="text" value={createForm.buyer_wallet}
                  onChange={e => setCreateForm(f => ({ ...f, buyer_wallet: e.target.value }))}
                  placeholder="0x…" style={{ ...inputStyle, fontFamily: "monospace" }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Quantity *</label>
                <input type="number" min={2} value={createForm.quantity}
                  onChange={e => setCreateForm(f => ({ ...f, quantity: e.target.value }))}
                  style={inputStyle} />
                <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>Volume orders start at 2 NFTs</p>
              </div>
              <div>
                <label style={labelStyle}>Rarity Tier</label>
                <select value={createForm.rarity_tier}
                  onChange={e => setCreateForm(f => ({ ...f, rarity_tier: e.target.value }))}
                  style={inputStyle}>
                  <option value="any">Any</option>
                  <option value="legendary">Legendary</option>
                  <option value="epic">Epic</option>
                  <option value="rare">Rare</option>
                  <option value="common">Common</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label style={labelStyle}>Unit Price (ETH)</label>
                <input type="number" step="0.0001" value={createForm.unit_price_eth}
                  onChange={e => setCreateForm(f => ({ ...f, unit_price_eth: e.target.value }))}
                  placeholder="0.03" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Unit Price (TWD)</label>
                <input type="number" step="1" value={createForm.unit_price_twd}
                  onChange={e => setCreateForm(f => ({ ...f, unit_price_twd: e.target.value }))}
                  placeholder="30000" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Discount %</label>
                <input type="number" min={0} max={100} step="0.1" value={createForm.discount_pct}
                  onChange={e => setCreateForm(f => ({ ...f, discount_pct: e.target.value }))}
                  placeholder="10" style={inputStyle} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Total Price (ETH)</label>
                <input type="number" step="0.0001" value={createForm.total_price_eth}
                  onChange={e => setCreateForm(f => ({ ...f, total_price_eth: e.target.value }))}
                  placeholder={autoTotal || "auto"} style={inputStyle} />
                <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>= unit × qty × (1 − discount/100){autoTotal ? ` ≈ ${autoTotal} ETH` : ""}</p>
              </div>
              <div>
                <label style={labelStyle}>Total Price (TWD)</label>
                <input type="number" step="1" value={createForm.total_price_twd}
                  onChange={e => setCreateForm(f => ({ ...f, total_price_twd: e.target.value }))}
                  placeholder="auto" style={inputStyle} />
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
                placeholder="e.g. Corporate package, invoice #B-001" />
            </div>
          </div>
          {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowCreate(false)}
              className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">
              Cancel
            </button>
            <button onClick={create} disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Creating…" : "Create Order"}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
