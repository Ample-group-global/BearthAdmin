"use client";

import { useEffect, useState, useRef } from "react";

interface Order {
  id: number;
  orderNumber: string;
  purchaseDate: string;
  customerName: string;
  customerPhone: string;
  nftAmountTwd: number;
  nftAmountEth: number;
  nftPaymentStatusCode: string;
  nftPaymentStatusName: string;
  merchAmountTwd: number;
  merch_payment_status_code: string;
  totalCount: number;
}

interface Master {
  paymentMethods: Array<{ id: number; name: string; code: string }>;
  paymentStatuses: Array<{ id: number; name: string; code: string }>;
  currencies: Array<{ id: number; code: string; name: string }>;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
}

const PAGE_SIZE = 50;

function statusColor(code: string): string {
  const c = (code ?? "").toLowerCase();
  if (c === "confirmed" || c === "paid") return "#16a34a";
  if (c === "pending") return "#d97706";
  if (c === "cancelled" || c === "canceled") return "#dc2626";
  if (c === "received") return "#2563eb";
  return "#6b7280";
}

function StatusBadge({ code, name }: { code: string; name: string }) {
  const color = statusColor(code);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}18`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      {name}
    </span>
  );
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [master, setMaster] = useState<Master | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editOrder, setEditOrder] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    orderNumber: "",
    customerId: "",
    purchaseDate: "",
    nftAmountTwd: "",
    nftPaymentMethodId: "",
    nftPaymentStatusId: "",
    notes: "",
  });

  const loadOrders = (q: string, off: number) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ search: q, limit: String(PAGE_SIZE), offset: String(off) });
    fetch(`/api/presale/orders?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const rows: Order[] = data.orders ?? [];
        setOrders(rows);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load orders.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetch("/api/presale/master", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setMaster(d));
    fetch("/api/presale/customers?limit=500&offset=0", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setCustomers(data.customers ?? []));
  }, []);

  useEffect(() => {
    loadOrders(search, offset);
  }, [offset]);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setOffset(0);
      loadOrders(v, 0);
    }, 300);
  };

  const openCreate = () => {
    setEditOrder(null);
    setForm({ orderNumber: "", customerId: "", purchaseDate: new Date().toISOString().split("T")[0], nftAmountTwd: "", nftPaymentMethodId: "", nftPaymentStatusId: "", notes: "" });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (order: Order) => {
    setEditOrder(order);
    setForm({
      orderNumber: order.orderNumber ?? "",
      customerId: "",
      purchaseDate: order.purchaseDate ? new Date(order.purchaseDate).toISOString().split("T")[0] : "",
      nftAmountTwd: String(order.nftAmountTwd ?? ""),
      nftPaymentMethodId: "",
      nftPaymentStatusId: "",
      notes: "",
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const body: any = {
        orderNumber: form.orderNumber,
        purchaseDate: form.purchaseDate,
        nftAmountTwd: form.nftAmountTwd ? Number(form.nftAmountTwd) : undefined,
        notes: form.notes || undefined,
      };
      if (form.customerId) body.customerId = Number(form.customerId);
      if (form.nftPaymentMethodId) body.nftPaymentMethodId = Number(form.nftPaymentMethodId);
      if (form.nftPaymentStatusId) body.nftPaymentStatusId = Number(form.nftPaymentStatusId);

      const url = editOrder ? `/api/presale/orders/${editOrder.id}` : "/api/presale/orders";
      const method = editOrder ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error ?? "Save failed.");
        return;
      }
      setShowModal(false);
      setOffset(0);
      loadOrders(search, 0);
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/presale/orders/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Delete failed.");
        return;
      }
      setDeleteId(null);
      loadOrders(search, offset);
    } catch {
      setError("Network error during delete.");
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    color: "#111827",
    outline: "none",
  };

  const labelStyle = { display: "block", fontSize: "12px", fontWeight: 600, color: "#24315f", marginBottom: "4px" };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Orders</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Manage Bearth orders</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-colors"
          style={{ background: "#41afeb" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#2e9fd8")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#41afeb")}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Order
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#111827" }}
          />
        </div>
        <span className="text-sm" style={{ color: "#9bafc5" }}>
          {total > 0 ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}` : "0 results"}
        </span>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div className="flex items-center justify-center h-48" style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48">
            <p className="text-sm" style={{ color: "#9bafc5" }}>No orders found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:border-r [&_th]:border-gray-100 [&_td]:border-r [&_td]:border-gray-100 [&_th]:py-2 [&_th]:px-3 [&_td]:py-2 [&_td]:px-3">
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Order #</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Customer</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Date</th>
                  <th className="px-4 py-3 text-right font-semibold" style={{ color: "#9bafc5" }}>NFT Amount</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>NFT Status</th>
                  <th className="px-4 py-3 text-right font-semibold" style={{ color: "#9bafc5" }}>Merch TWD</th>
                  <th className="px-4 py-3 text-center font-semibold" style={{ color: "#9bafc5" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => (
                  <tr
                    key={o.id}
                    style={{ borderBottom: i < orders.length - 1 ? "1px solid #f3f4f6" : "none" }}
                  >
                    <td className="px-4 py-3 font-mono font-semibold" style={{ color: "#24315f" }}>{o.orderNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium" style={{ color: "#111827" }}>{o.customerName ?? "—"}</div>
                      {o.customerPhone && <div className="text-xs" style={{ color: "#9bafc5" }}>{o.customerPhone}</div>}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#6b7280" }}>
                      {o.purchaseDate ? new Date(o.purchaseDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: "#111827" }}>
                      {o.nftAmountTwd ? `TWD ${Number(o.nftAmountTwd).toLocaleString()}` : "—"}
                      {o.nftAmountEth ? <div className="text-xs" style={{ color: "#9bafc5" }}>{o.nftAmountEth} ETH</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      {o.nftPaymentStatusCode ? (
                        <StatusBadge code={o.nftPaymentStatusCode} name={o.nftPaymentStatusName} />
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: "#6b7280" }}>
                      {o.merchAmountTwd ? `TWD ${Number(o.merchAmountTwd).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(o)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: "#41afeb" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(65,175,235,0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteId(o.id)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: "#dc2626" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(220,38,38,0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
            style={{ border: "1px solid #e5e7eb", color: offset === 0 ? "#9bafc5" : "#24315f", cursor: offset === 0 ? "not-allowed" : "pointer" }}
          >
            Previous
          </button>
          <span className="text-sm" style={{ color: "#9bafc5" }}>
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="px-4 py-2 text-sm font-medium rounded-lg border transition-colors"
            style={{ border: "1px solid #e5e7eb", color: offset + PAGE_SIZE >= total ? "#9bafc5" : "#24315f", cursor: offset + PAGE_SIZE >= total ? "not-allowed" : "pointer" }}
          >
            Next
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" style={{ border: "1px solid #e5e7eb" }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #e5e7eb" }}>
              <h2 className="text-base font-bold" style={{ color: "#24315f" }}>{editOrder ? "Edit Order" : "New Order"}</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  {formError}
                </div>
              )}
              <div>
                <label style={labelStyle}>Order Number</label>
                <input value={form.orderNumber} onChange={(e) => setForm({ ...form, orderNumber: e.target.value })} style={inputStyle} placeholder="e.g. ORD-0001" />
              </div>
              {!editOrder && (
                <div>
                  <label style={labelStyle}>Customer</label>
                  <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} style={inputStyle}>
                    <option value="">Select customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={labelStyle}>Purchase Date</label>
                <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>NFT Amount (TWD)</label>
                <input type="number" value={form.nftAmountTwd} onChange={(e) => setForm({ ...form, nftAmountTwd: e.target.value })} style={inputStyle} placeholder="0" />
              </div>
              {master && (
                <>
                  <div>
                    <label style={labelStyle}>Payment Method</label>
                    <select value={form.nftPaymentMethodId} onChange={(e) => setForm({ ...form, nftPaymentMethodId: e.target.value })} style={inputStyle}>
                      <option value="">Select...</option>
                      {master.paymentMethods.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Payment Status</label>
                    <select value={form.nftPaymentStatusId} onChange={(e) => setForm({ ...form, nftPaymentStatusId: e.target.value })} style={inputStyle}>
                      <option value="">Select...</option>
                      {master.paymentStatuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, minHeight: "72px", resize: "vertical" }} placeholder="Optional notes..." />
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: "1px solid #e5e7eb" }}>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: saving ? "#9bafc5" : "#41afeb" }}
              >
                {saving ? "Saving..." : editOrder ? "Save Changes" : "Create Order"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold mb-2" style={{ color: "#24315f" }}>Delete Order</h2>
            <p className="text-sm mb-6" style={{ color: "#6b7280" }}>Are you sure you want to delete this order? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: "#dc2626" }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
