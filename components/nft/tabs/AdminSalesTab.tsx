"use client";

import { useState, useEffect } from "react";
import { Toggle } from "@/components/nft/Toggle";
import { ErrBanner, TxBanner } from "@/components/nft/Banner";
import { labelStyle, inputStyle, thStyle, tdStyle } from "@/components/nft/styles";
import { ETH_ADDRESS_RE } from "@/lib/nft-constants";

export interface SaleMode { code: string; label: string; category: string; }
export interface Currency  { code: string; label: string; symbol: string; }

interface AdminSale {
  id: string;
  sale_mode: string;
  buyer_address: string;
  quantity: number;
  amount_paid_eth: number | null;
  payment_currency: string;
  payment_ref: string | null;
  wave_number: number;
  status: string;
  tx_hash: string | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  saleModes: SaleMode[];
  currencies: Currency[];
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  minted:   { bg: "rgba(22,163,74,0.1)",   color: "#16a34a" },
  pending:  { bg: "rgba(217,119,6,0.1)",   color: "#d97706" },
  failed:   { bg: "rgba(220,38,38,0.1)",   color: "#dc2626" },
  refunded: { bg: "rgba(107,114,128,0.1)", color: "#6b7280" },
};

function SaleStatusBadge({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.pending;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: c.bg, color: c.color }}>{status}</span>
  );
}

const SALES_LIMIT = 20;

export default function AdminSalesTab({ saleModes, currencies }: Props) {
  const [sales,       setSales]       = useState<AdminSale[]>([]);
  const [salesTotal,  setSalesTotal]  = useState(0);
  const [salesOffset, setSalesOffset] = useState(0);
  const [salesStatus, setSalesStatus] = useState("");
  const [saving,      setSaving]      = useState<string | null>(null);
  const [opError,     setOpError]     = useState<string | null>(null);
  const [tx,          setTx]          = useState<string | null>(null);
  const [saleResult,  setSaleResult]  = useState<{ saleId: string; txHash?: string; status: string } | null>(null);

  const [saleForm, setSaleForm] = useState({
    saleMode: "offline_cash", buyerAddress: "", quantity: "1",
    amountPaidEth: "", paymentCurrency: "ETH",
    paymentRef: "", waveNumber: "2", notes: "", mintNow: true,
  });

  const loadSales = async (offset = 0, status = "") => {
    const params = new URLSearchParams({ limit: String(SALES_LIMIT), offset: String(offset) });
    if (status) params.set("status", status);
    const d = await fetch(`/api/nft-sell/admin-sales?${params}`, { credentials: "include" }).then(r => r.json());
    setSales(d.sales ?? []);
    setSalesTotal(d.total ?? 0);
    setSalesOffset(offset);
  };

  useEffect(() => { loadSales(0, ""); }, []);

  const handleCreateSale = async () => {
    const qty = parseInt(saleForm.quantity, 10);
    if (!saleForm.buyerAddress)                         { setOpError("Buyer address required."); return; }
    if (!ETH_ADDRESS_RE.test(saleForm.buyerAddress))   { setOpError("Enter a valid Ethereum address (0x + 40 hex)."); return; }
    if (!qty || qty < 1)                               { setOpError("Quantity must be >= 1."); return; }
    setSaving("sale"); setOpError(null); setSaleResult(null);
    try {
      const res = await fetch("/api/nft-sell/admin-sales", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleMode:        saleForm.saleMode,
          buyerAddress:    saleForm.buyerAddress,
          quantity:        qty,
          amountPaidEth:   saleForm.amountPaidEth   || undefined,
          paymentCurrency: saleForm.paymentCurrency,
          paymentRef:      saleForm.paymentRef       || undefined,
          waveNumber:      parseInt(saleForm.waveNumber, 10),
          notes:           saleForm.notes            || undefined,
          mintNow:         saleForm.mintNow,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setOpError(d.error ?? "Sale creation failed."); return; }
      setSaleResult({ saleId: d.saleId, txHash: d.txHash, status: d.status });
      setSaleForm(f => ({ ...f, buyerAddress: "", quantity: "1", amountPaidEth: "", paymentRef: "", notes: "" }));
      loadSales(0, salesStatus);
    } catch { setOpError("Network error."); }
    finally { setSaving(null); }
  };

  const handleMintPending = async (saleId: string) => {
    setSaving(`mint-${saleId}`); setOpError(null);
    try {
      const res = await fetch(`/api/nft-sell/admin-sales/${saleId}/mint`, { method: "POST", credentials: "include" });
      const d   = await res.json();
      if (!res.ok) { setOpError(d.error ?? "Mint failed."); return; }
      setTx(d.txHash);
      loadSales(salesOffset, salesStatus);
    } catch { setOpError("Network error."); }
    finally { setSaving(null); }
  };

  return (
    <div className="space-y-6">
      {tx      && <TxBanner  txHash={tx}   onDismiss={() => setTx(null)} />}
      {opError && <ErrBanner msg={opError}  onDismiss={() => setOpError(null)} />}

      {/* ─── CREATE SALE ──────────────────────────────── */}
      <section>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "#9bafc5" }}>
          Record New Sale
        </p>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
            <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Admin Sale</h2>
            <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
              Offline, bank transfer, gift, or corporate purchase — optionally mint on-chain immediately.
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label style={labelStyle}>Sale Mode</label>
                <select value={saleForm.saleMode}
                  onChange={e => setSaleForm(f => ({ ...f, saleMode: e.target.value }))}
                  style={inputStyle}>
                  {saleModes.map(m => (
                    <option key={m.code} value={m.code}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Payment Currency</label>
                <select value={saleForm.paymentCurrency}
                  onChange={e => setSaleForm(f => ({ ...f, paymentCurrency: e.target.value }))}
                  style={inputStyle}>
                  {currencies.map(c => (
                    <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Buyer Wallet Address</label>
              <input type="text" value={saleForm.buyerAddress}
                onChange={e => setSaleForm(f => ({ ...f, buyerAddress: e.target.value }))}
                style={{ ...inputStyle, fontFamily: "monospace" }} placeholder="0x…" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label style={labelStyle}>Quantity</label>
                <input type="number" min="1" value={saleForm.quantity}
                  onChange={e => setSaleForm(f => ({ ...f, quantity: e.target.value }))}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Amount Paid (ETH)</label>
                <input type="number" step="0.0001" min="0" value={saleForm.amountPaidEth}
                  onChange={e => setSaleForm(f => ({ ...f, amountPaidEth: e.target.value }))}
                  style={inputStyle} placeholder="0.0303" />
              </div>
              <div>
                <label style={labelStyle}>Wave Number</label>
                <input type="number" min="1" max="7" value={saleForm.waveNumber}
                  onChange={e => setSaleForm(f => ({ ...f, waveNumber: e.target.value }))}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Payment Ref / Invoice #</label>
                <input type="text" value={saleForm.paymentRef}
                  onChange={e => setSaleForm(f => ({ ...f, paymentRef: e.target.value }))}
                  style={inputStyle} placeholder="INV-001" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input type="text" value={saleForm.notes}
                onChange={e => setSaleForm(f => ({ ...f, notes: e.target.value }))}
                style={inputStyle} placeholder="e.g. Sold at Singapore event, walk-in customer" />
            </div>
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <Toggle value={saleForm.mintNow} onChange={v => setSaleForm(f => ({ ...f, mintNow: v }))} />
                <span className="text-xs font-semibold" style={{ color: saleForm.mintNow ? "#16a34a" : "#9bafc5" }}>
                  {saleForm.mintNow ? "Mint on-chain immediately" : "Save as pending (mint later)"}
                </span>
              </label>
              <button onClick={handleCreateSale} disabled={saving === "sale"}
                className="px-5 py-2 text-xs font-bold text-white rounded-xl flex items-center gap-2"
                style={{ background: saving === "sale" ? "#9bafc5" : "#41afeb" }}>
                {saving === "sale" ? (
                  <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>Processing…</>
                ) : saleForm.mintNow ? "⛓ Record + Mint Now" : "Save as Pending"}
              </button>
            </div>

            {saleResult && (
              <div className="p-4 rounded-xl" style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.25)" }}>
                <p className="text-xs font-bold" style={{ color: "#16a34a" }}>
                  Sale recorded — {saleResult.status === "minted" ? "minted on-chain" : "saved as pending"}
                </p>
                <p className="text-[10px] font-mono mt-0.5" style={{ color: "#6b7280" }}>ID: {saleResult.saleId}</p>
                {saleResult.txHash && (
                  <p className="text-[10px] font-mono" style={{ color: "#6b7280" }}>Tx: {saleResult.txHash.slice(0, 22)}…</p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─── SALES HISTORY ────────────────────────────── */}
      <section>
        <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "#9bafc5" }}>
          Sales History
        </p>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
          <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: "1px solid #e5e7eb" }}>
            <div>
              <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>All Admin Sales</h2>
              <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{salesTotal.toLocaleString()} total records</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {["", "pending", "minted", "failed", "refunded"].map(s => (
                <button key={s || "all"}
                  onClick={() => { setSalesStatus(s); loadSales(0, s); }}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize"
                  style={{
                    border: "1px solid",
                    borderColor: salesStatus === s ? "#41afeb" : "#e5e7eb",
                    background:  salesStatus === s ? "rgba(65,175,235,0.1)" : "white",
                    color:       salesStatus === s ? "#41afeb" : "#6b7280",
                  }}>
                  {s || "All"}
                </button>
              ))}
            </div>
          </div>
          {sales.length === 0 ? (
            <div className="py-12 text-center text-sm" style={{ color: "#9bafc5" }}>No sales recorded yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-max">
                <thead>
                  <tr>
                    {["Buyer", "Mode", "Qty", "Amount", "Wave", "Ref", "Status", "Created", ""].map(h => (
                      <th key={h} style={{ ...thStyle, textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s, i) => (
                    <tr key={s.id} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                      <td style={tdStyle}>
                        <span className="font-mono">{s.buyer_address.slice(0, 6)}…{s.buyer_address.slice(-4)}</span>
                      </td>
                      <td style={tdStyle}>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ background: "#f3f4f6", color: "#374151" }}>
                          {saleModes.find(m => m.code === s.sale_mode)?.label ?? s.sale_mode}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 700, color: "#41afeb" }}>{s.quantity}</td>
                      <td style={tdStyle}>
                        {s.amount_paid_eth != null
                          ? <span style={{ color: "#24315f", fontWeight: 600 }}>{s.amount_paid_eth} {s.payment_currency}</span>
                          : <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle, color: "#6b7280" }}>W{s.wave_number}</td>
                      <td style={{ ...tdStyle, color: "#9bafc5" }}>{s.payment_ref ?? "—"}</td>
                      <td style={tdStyle}><SaleStatusBadge status={s.status} /></td>
                      <td style={{ ...tdStyle, color: "#9bafc5" }}>
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                      <td style={tdStyle}>
                        {s.status === "pending" || s.status === "failed" ? (
                          <button
                            onClick={() => handleMintPending(s.id)}
                            disabled={saving === `mint-${s.id}`}
                            className="px-2 py-1 rounded text-[10px] font-bold text-white"
                            style={{ background: saving === `mint-${s.id}` ? "#9bafc5" : "#16a34a" }}>
                            {saving === `mint-${s.id}` ? "…" : "Mint"}
                          </button>
                        ) : s.tx_hash ? (
                          <span className="font-mono text-[10px]" style={{ color: "#9bafc5" }}>
                            {s.tx_hash.slice(0, 8)}…
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {salesTotal > SALES_LIMIT && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid #e5e7eb" }}>
              <span className="text-xs" style={{ color: "#9bafc5" }}>
                {salesOffset + 1}–{Math.min(salesOffset + SALES_LIMIT, salesTotal)} of {salesTotal}
              </span>
              <div className="flex gap-2">
                <button disabled={salesOffset === 0}
                  onClick={() => loadSales(Math.max(0, salesOffset - SALES_LIMIT), salesStatus)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold"
                  style={{ border: "1px solid #e5e7eb", color: salesOffset === 0 ? "#d1d5db" : "#6b7280" }}>
                  Prev
                </button>
                <button disabled={salesOffset + SALES_LIMIT >= salesTotal}
                  onClick={() => loadSales(salesOffset + SALES_LIMIT, salesStatus)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold"
                  style={{ border: "1px solid #e5e7eb", color: salesOffset + SALES_LIMIT >= salesTotal ? "#d1d5db" : "#6b7280" }}>
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
