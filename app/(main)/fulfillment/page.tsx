"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Fulfillment {
  id: string;
  orderId: string;
  customerName?: string | null;
  orderNumber?: string | null;
  purchaseDate?: string | null;
  nftAmountTwd?: number | null;
  merchAmountTwd?: number | null;
  nftCount?: number | null;
  productCount?: number | null;
  status: string;               // from SP: status (not fulfillmentStatus)
  fulfillmentType: string;
  trackingNumber?: string | null;
  carrier?: string | null;
  notes?: string | null;
  assignedTo?: string | null;
  updatedAt: string;
}

interface FulfillmentDetail extends Fulfillment {
  nftItems?: Array<{ nftId: string; serialNumber: string; waveName: string }>;
  productItems?: Array<{ productId: string; productName: string; sku?: string | null; quantity: number; unitPrice: number }>;
}

const FULFILLMENT_STATUSES = [
  { value: "pending",    label: "Pending",    color: "#d97706" },
  { value: "processing", label: "Processing", color: "#41afeb" },
  { value: "packed",     label: "Packed",     color: "#7c3aed" },
  { value: "shipped",    label: "Shipped",    color: "#2e9fd8" },
  { value: "delivered",  label: "Delivered",  color: "#16a34a" },
  { value: "returned",   label: "Returned",   color: "#9ca3af" },
  { value: "cancelled",  label: "Cancelled",  color: "#dc2626" },
];

const FULFILLMENT_TYPES = [
  { value: "product", label: "Products Only" },
  { value: "nft",     label: "NFT Only"      },
  { value: "mixed",   label: "Mixed"         },
];

const CARRIERS = ["DHL", "FedEx", "UPS", "USPS", "Local Courier", "Hand Delivery", "Other"];

function StatusBadge({ status }: { status: string }) {
  const s = FULFILLMENT_STATUSES.find(x => x.value === status);
  const color = s?.color ?? "#9ca3af";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: `${color}18`, color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      {s?.label ?? status}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, [string, string]> = {
    product: ["rgba(65,175,235,0.1)",  "#41afeb"],
    nft:     ["rgba(124,58,237,0.1)",  "#7c3aed"],
    mixed:   ["rgba(217,119,6,0.1)",   "#d97706"],
  };
  const [bg, color] = map[type] ?? ["rgba(156,163,175,0.12)", "#9ca3af"];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize"
      style={{ background: bg, color }}>
      {FULFILLMENT_TYPES.find(t => t.value === type)?.label ?? type}
    </span>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl flex flex-col"
        style={{ width: "100%", maxWidth: wide ? 860 : 560, maxHeight: "90vh", border: "1px solid #e5e7eb" }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>{title}</h2>
          <button onClick={onClose} style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
      {msg}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16" style={{ color: "#9bafc5" }}>
      <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

// ─── Fulfillment Form State ───────────────────────────────────────────────────

interface FulfillForm {
  status: string;
  fulfillmentType: string;
  trackingNumber: string;
  carrier: string;
  notes: string;
  assignedTo: string;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FulfillmentPage() {
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [offset, setOffset] = useState(0);
  const PAGE_SIZE = 25;

  const [detailOrder, setDetailOrder] = useState<FulfillmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editModal, setEditModal] = useState<Fulfillment | null>(null);
  const [form, setForm] = useState<FulfillForm>({
    status: "pending", fulfillmentType: "product", trackingNumber: "", carrier: "", notes: "", assignedTo: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [initMsg, setInitMsg] = useState<string | null>(null);

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
    textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 14px", textAlign: "left",
    borderBottom: "1px solid #e5e7eb", background: "#f9fafb", whiteSpace: "nowrap",
  };

  // ── Stats from current page data ──────────────────────────────────────────────
  const statusCounts = FULFILLMENT_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s.value] = fulfillments.filter(f => f.status === s.value).length;
    return acc;
  }, {});

  // ── Data Loader ───────────────────────────────────────────────────────────────

  const loadFulfillments = useCallback((status = filterStatus, type = filterType, off = offset) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
    if (status) params.set("status", status);
    if (type) params.set("type", type);
    fetch(`/api/fulfillment?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setFulfillments(d.fulfillments ?? []); setTotal(d.total ?? 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filterStatus, filterType, offset]);

  useEffect(() => { loadFulfillments(); }, []);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const openDetail = async (f: Fulfillment) => {
    setDetailLoading(true);
    setDetailOrder(f as FulfillmentDetail);
    try {
      const res = await fetch(`/api/fulfillment/${f.orderId}`, { credentials: "include" });
      const d = await res.json();
      setDetailOrder(d.fulfillment ?? f);
    } catch { /* keep basic data */ }
    finally { setDetailLoading(false); }
  };

  const openEdit = (f: Fulfillment) => {
    setEditModal(f);
    setForm({
      status: f.status,
      fulfillmentType: f.fulfillmentType,
      trackingNumber: f.trackingNumber ?? "",
      carrier: f.carrier ?? "",
      notes: f.notes ?? "",
      assignedTo: f.assignedTo ?? "",
    });
    setSaveError(null);
  };

  const handleSave = async () => {
    if (!editModal) return;
    setSaving(true); setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        status: form.status,
        fulfillmentType: form.fulfillmentType,
        notes: form.notes || undefined,
        assignedTo: form.assignedTo || undefined,
      };
      if (form.trackingNumber) body.trackingNumber = form.trackingNumber;
      if (form.carrier) body.carrier = form.carrier;

      const res = await fetch(`/api/fulfillment/${editModal.orderId}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setSaveError(d.error ?? "Save failed."); return; }
      setEditModal(null);
      loadFulfillments();
    } catch { setSaveError("Network error."); }
    finally { setSaving(false); }
  };

  const handleInitialize = async () => {
    setInitializing(true); setInitMsg(null);
    try {
      const res = await fetch("/api/fulfillment/initialize", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      setInitMsg(res.ok ? `Initialized ${d.initialized ?? d.count ?? 0} fulfillment records.` : (d.error ?? "Failed."));
      if (res.ok) loadFulfillments();
    } catch { setInitMsg("Network error."); }
    finally { setInitializing(false); }
  };

  const applyFilter = (status: string, type: string) => {
    setOffset(0);
    setFilterStatus(status);
    setFilterType(type);
    loadFulfillments(status, type, 0);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  const pendingCount = fulfillments.filter(f => f.status === "pending").length;
  const processingCount = fulfillments.filter(f => f.status === "processing").length;

  return (
    <div className="p-5 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>Order Fulfillment</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            Manage packing, shipping, and delivery for all orders (Products &amp; NFTs)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {initMsg && (
            <span className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#6b7280" }}>
              {initMsg}
            </span>
          )}
          <button onClick={handleInitialize} disabled={initializing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}
            title="Create fulfillment records for any orders that don't have one yet">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {initializing ? "Syncing…" : "Sync Orders"}
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb", borderLeft: "3px solid #d97706" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Pending</p>
          <p className="text-2xl font-extrabold" style={{ color: "#d97706" }}>{statusCounts["pending"] ?? 0}</p>
          <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>needs action</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb", borderLeft: "3px solid #41afeb" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Processing</p>
          <p className="text-2xl font-extrabold" style={{ color: "#41afeb" }}>{statusCounts["processing"] ?? 0}</p>
          <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>in progress</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb", borderLeft: "3px solid #7c3aed" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Packed</p>
          <p className="text-2xl font-extrabold" style={{ color: "#7c3aed" }}>{(statusCounts["packed"] ?? 0)}</p>
          <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>ready to ship</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb", borderLeft: "3px solid #16a34a" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Delivered</p>
          <p className="text-2xl font-extrabold" style={{ color: "#16a34a" }}>{statusCounts["delivered"] ?? 0}</p>
          <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>completed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={filterStatus}
          onChange={e => applyFilter(e.target.value, filterType)}
          className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
          style={{ border: "1px solid #e5e7eb", color: filterStatus ? "#111827" : "#9bafc5" }}>
          <option value="">All Statuses</option>
          {FULFILLMENT_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterType}
          onChange={e => applyFilter(filterStatus, e.target.value)}
          className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
          style={{ border: "1px solid #e5e7eb", color: filterType ? "#111827" : "#9bafc5" }}>
          <option value="">All Types</option>
          {FULFILLMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        {(filterStatus || filterType) && (
          <button onClick={() => applyFilter("", "")}
            className="px-3 py-2 text-xs font-semibold rounded-xl"
            style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "#fff" }}>
            Clear Filters
          </button>
        )}
        <span className="ml-auto text-xs" style={{ color: "#9bafc5" }}>
          {total} order{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40" style={{ color: "#9bafc5" }}>
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading fulfillments…
        </div>
      ) : fulfillments.length === 0 ? (
        <div className="bg-white rounded-xl" style={{ border: "1px solid #e5e7eb" }}>
          <EmptyState message={
            filterStatus || filterType
              ? "No fulfillments match the selected filters"
              : "No fulfillment records yet. Click 'Sync Orders' to create records for existing orders."
          } />
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Order", "Customer", "Type", "Status", "Tracking", "Assigned To", "Updated", "Actions"].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fulfillments.map((f, i) => (
                <tr key={f.id} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <button onClick={() => openDetail(f)}
                      className="font-mono text-xs font-semibold"
                      style={{ color: "#24315f", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                      {f.orderId.slice(0, 8)}…
                    </button>
                    {f.purchaseDate && (
                      <p className="text-[10px] mt-0.5" style={{ color: "#9bafc5" }}>
                        {new Date(f.purchaseDate).toLocaleDateString()}
                      </p>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="text-xs font-semibold" style={{ color: "#111827" }}>
                      {f.customerName ?? "—"}
                    </div>
                    {f.orderNumber && (
                      <div className="text-[10px] font-mono" style={{ color: "#9bafc5" }}>#{f.orderNumber}</div>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}><TypeBadge type={f.fulfillmentType} /></td>
                  <td style={{ padding: "10px 14px" }}><StatusBadge status={f.status} /></td>
                  <td style={{ padding: "10px 14px" }}>
                    {f.trackingNumber ? (
                      <div>
                        <div className="font-mono text-xs font-semibold" style={{ color: "#24315f" }}>{f.trackingNumber}</div>
                        {f.carrier && <div className="text-[10px]" style={{ color: "#9bafc5" }}>{f.carrier}</div>}
                      </div>
                    ) : (
                      <span style={{ color: "#d1d5db" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>
                    {f.assignedTo ?? "—"}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 11, color: "#9bafc5" }}>
                    {new Date(f.updatedAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openDetail(f)}
                        className="px-2 py-1 rounded text-xs font-semibold"
                        style={{ border: "1px solid #e5e7eb", color: "#41afeb", background: "#fff" }}>
                        View
                      </button>
                      <button onClick={() => openEdit(f)}
                        className="px-2 py-1 rounded text-xs font-semibold"
                        style={{ border: "1px solid #41afeb", color: "#41afeb", background: "#fff" }}>
                        Update
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid #f3f4f6" }}>
              <span className="text-xs" style={{ color: "#9bafc5" }}>
                Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button disabled={offset === 0}
                  onClick={() => { const o = Math.max(0, offset - PAGE_SIZE); setOffset(o); loadFulfillments(filterStatus, filterType, o); }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                  style={{ border: "1px solid #e5e7eb", color: offset === 0 ? "#d1d5db" : "#6b7280", background: "#fff" }}>
                  Previous
                </button>
                <button disabled={offset + PAGE_SIZE >= total}
                  onClick={() => { const o = offset + PAGE_SIZE; setOffset(o); loadFulfillments(filterStatus, filterType, o); }}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                  style={{ border: "1px solid #e5e7eb", color: offset + PAGE_SIZE >= total ? "#d1d5db" : "#6b7280", background: "#fff" }}>
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ Order Detail Modal ════════════════════════════════════════════════════ */}
      {detailOrder && (
        <Modal title={`Order — ${detailOrder.orderId.slice(0, 8)}…`} onClose={() => setDetailOrder(null)} wide>
          {detailLoading ? (
            <div className="flex items-center justify-center h-32" style={{ color: "#9bafc5" }}>
              <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading details…
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Customer</p>
                  <p className="text-sm font-semibold mt-0.5" style={{ color: "#111827" }}>{detailOrder.customerName ?? "—"}</p>
                  {detailOrder.orderNumber && (
                    <p className="text-xs font-mono" style={{ color: "#9bafc5" }}>#{detailOrder.orderNumber}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Fulfillment Status</p>
                  <div className="mt-1"><StatusBadge status={detailOrder.status} /></div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Order Total</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: "#24315f" }}>
                    {((detailOrder.nftAmountTwd ?? 0) + (detailOrder.merchAmountTwd ?? 0)) > 0
                      ? `TWD ${((detailOrder.nftAmountTwd ?? 0) + (detailOrder.merchAmountTwd ?? 0)).toLocaleString()}`
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Tracking */}
              {(detailOrder.trackingNumber || detailOrder.carrier) && (
                <div className="p-3 rounded-xl" style={{ background: "rgba(65,175,235,0.05)", border: "1px solid rgba(65,175,235,0.2)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#9bafc5" }}>Shipping</p>
                  <div className="flex items-center gap-4 text-sm">
                    {detailOrder.carrier && <span style={{ color: "#6b7280" }}>Carrier: <strong>{detailOrder.carrier}</strong></span>}
                    {detailOrder.trackingNumber && (
                      <span style={{ color: "#6b7280" }}>Tracking: <strong className="font-mono">{detailOrder.trackingNumber}</strong></span>
                    )}
                  </div>
                </div>
              )}

              {/* Product Items */}
              {(detailOrder.productItems?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#9bafc5" }}>Physical Products</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        {["Product", "SKU", "Qty", "Unit Price", "Subtotal"].map(h => (
                          <th key={h} style={{ fontSize: 10, fontWeight: 700, color: "#9bafc5", padding: "6px 10px",
                            textAlign: "left", borderBottom: "1px solid #e5e7eb", background: "#f9fafb",
                            textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailOrder.productItems!.map((item, i) => (
                        <tr key={item.productId} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                          <td style={{ padding: "6px 10px", fontWeight: 600, color: "#111827" }}>{item.productName}</td>
                          <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#9bafc5" }}>{item.sku ?? "—"}</td>
                          <td style={{ padding: "6px 10px", textAlign: "center", color: "#374151" }}>{item.quantity}</td>
                          <td style={{ padding: "6px 10px", textAlign: "right", color: "#6b7280" }}>
                            TWD {Number(item.unitPrice).toLocaleString()}
                          </td>
                          <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, color: "#24315f" }}>
                            TWD {(Number(item.unitPrice) * item.quantity).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* NFT Items */}
              {(detailOrder.nftItems?.length ?? 0) > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#9bafc5" }}>NFTs</p>
                  <div className="flex flex-wrap gap-2">
                    {detailOrder.nftItems!.map(nft => (
                      <span key={nft.nftId} className="px-2 py-1 rounded-lg text-xs font-semibold"
                        style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.15)" }}>
                        #{nft.serialNumber} — {nft.waveName}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {detailOrder.notes && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#9bafc5" }}>Notes</p>
                  <p className="text-sm" style={{ color: "#6b7280" }}>{detailOrder.notes}</p>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-between pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => { openEdit(detailOrder); setDetailOrder(null); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg"
              style={{ border: "1px solid #41afeb", color: "#41afeb", background: "#fff" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Update Fulfillment
            </button>
            <button onClick={() => setDetailOrder(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Close</button>
          </div>
        </Modal>
      )}

      {/* ══ Update Fulfillment Modal ══════════════════════════════════════════════ */}
      {editModal && (
        <Modal title="Update Fulfillment" onClose={() => setEditModal(null)}>
          <div className="space-y-4">
            {saveError && <ErrorBanner msg={saveError} />}

            <div className="p-3 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <p className="text-xs font-semibold" style={{ color: "#111827" }}>
                Order: <span className="font-mono">{editModal.orderId.slice(0, 8)}…</span>
              </p>
              {editModal.customerName && (
                <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Customer: {editModal.customerName}</p>
              )}
            </div>

            {/* Status pipeline */}
            <div>
              <label style={labelStyle}>Fulfillment Status</label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {FULFILLMENT_STATUSES.map(s => (
                  <button key={s.value} onClick={() => setForm({ ...form, status: s.value })}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg"
                    style={{
                      background: form.status === s.value ? s.color : "#f3f4f6",
                      color: form.status === s.value ? "#fff" : "#6b7280",
                      border: "none",
                    }}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Type */}
            <div>
              <label style={labelStyle}>Order Type</label>
              <select value={form.fulfillmentType}
                onChange={e => setForm({ ...form, fulfillmentType: e.target.value })}
                style={inputStyle}>
                {FULFILLMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {/* Tracking */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Tracking Number</label>
                <input value={form.trackingNumber}
                  onChange={e => setForm({ ...form, trackingNumber: e.target.value })}
                  style={inputStyle} placeholder="e.g. 1Z999AA1" />
              </div>
              <div>
                <label style={labelStyle}>Carrier</label>
                <select value={form.carrier}
                  onChange={e => setForm({ ...form, carrier: e.target.value })}
                  style={inputStyle}>
                  <option value="">Select carrier…</option>
                  {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Assigned To */}
            <div>
              <label style={labelStyle}>Assigned To (User ID)</label>
              <input value={form.assignedTo}
                onChange={e => setForm({ ...form, assignedTo: e.target.value })}
                style={inputStyle} placeholder="Staff user UUID (optional)" />
            </div>

            {/* Notes */}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                style={{ ...inputStyle, minHeight: 56, resize: "vertical" }}
                placeholder="Packing notes, special instructions…" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => setEditModal(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg"
              style={{ background: saving ? "#9bafc5" : "#41afeb" }}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}
