"use client";

import { useEffect, useState, useRef } from "react";

interface NftRecord {
  id: number;
  serialNumber: string;
  stageName: string;
  typeName: string;
  deliveryStatusCode: string;
  deliveryStatusName: string;
  deliveredAt: string | null;
  totalCount: number;
}

interface Master {
  nftStages: Array<{ id: number; name: string }>;
  nftTypes: Array<{ id: number; name: string }>;
  deliveryStatuses: Array<{ id: number; name: string; code: string }>;
}

const PAGE_SIZE = 100;

function deliveryColor(code: string): string {
  const c = (code ?? "").toLowerCase();
  if (c === "delivered") return "#16a34a";
  if (c === "pending") return "#d97706";
  if (c === "cancelled" || c === "canceled") return "#dc2626";
  return "#6b7280";
}

function DeliveryBadge({ code, name }: { code: string; name: string }) {
  const color = deliveryColor(code);
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

export default function NftPage() {
  const [records, setRecords] = useState<NftRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [master, setMaster] = useState<Master | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDeliveryId, setConfirmDeliveryId] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    serialNumber: "",
    stageId: "",
    nftTypeId: "",
    deliveryStatusId: "",
    notes: "",
  });

  const loadRecords = (q: string, off: number, status: string) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ search: q, limit: String(PAGE_SIZE), offset: String(off) });
    if (status) params.set("delivery_status", status);
    fetch(`/api/presale/nft?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const rows: NftRecord[] = data.nftRecords ?? [];
        setRecords(rows);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load NFT records.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetch("/api/presale/master", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setMaster(d));
  }, []);

  useEffect(() => {
    loadRecords(search, offset, statusFilter);
  }, [offset, statusFilter]);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setOffset(0);
      loadRecords(v, 0, statusFilter);
    }, 300);
  };

  const openCreate = () => {
    setForm({ serialNumber: "", stageId: "", nftTypeId: "", deliveryStatusId: "", notes: "" });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const body: any = {
        serialNumber: form.serialNumber,
        notes: form.notes || undefined,
      };
      if (form.stageId) body.stageId = Number(form.stageId);
      if (form.nftTypeId) body.nftTypeId = Number(form.nftTypeId);
      if (form.deliveryStatusId) body.deliveryStatusId = Number(form.deliveryStatusId);

      const res = await fetch("/api/presale/nft", {
        method: "POST",
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
      loadRecords(search, offset, statusFilter);
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelivery = async (id: number) => {
    try {
      const res = await fetch(`/api/presale/nft/${id}/delivery`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Delivery confirmation failed.");
        return;
      }
      setConfirmDeliveryId(null);
      loadRecords(search, offset, statusFilter);
    } catch {
      setError("Network error.");
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
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>NFT Records</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9bafc5" }}>Manage NFT serial numbers and delivery</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: "#41afeb" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#2e9fd8")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#41afeb")}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New NFT
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by serial number..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#111827" }}
          />
        </div>
        {master && (
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setOffset(0); }}
            className="rounded-xl text-sm bg-white px-3 py-2"
            style={{ border: "1px solid #e5e7eb", color: "#111827", outline: "none" }}
          >
            <option value="">All delivery statuses</option>
            {master.deliveryStatuses.map((s) => (
              <option key={s.id} value={s.code}>{s.name}</option>
            ))}
          </select>
        )}
        <span className="text-sm" style={{ color: "#9bafc5" }}>
          {total > 0 ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}` : "0 results"}
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div className="flex items-center justify-center h-48" style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </div>
        ) : records.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm" style={{ color: "#9bafc5" }}>No NFT records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Serial Number</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Stage</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Type</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Delivery Status</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Delivered At</th>
                  <th className="px-4 py-3 text-center font-semibold" style={{ color: "#9bafc5" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: i < records.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td className="px-4 py-3 font-mono font-semibold" style={{ color: "#24315f" }}>{r.serialNumber}</td>
                    <td className="px-4 py-3" style={{ color: "#6b7280" }}>{r.stageName ?? "—"}</td>
                    <td className="px-4 py-3" style={{ color: "#6b7280" }}>{r.typeName ?? "—"}</td>
                    <td className="px-4 py-3">
                      {r.deliveryStatusCode ? (
                        <DeliveryBadge code={r.deliveryStatusCode} name={r.deliveryStatusName} />
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#6b7280" }}>
                      {r.deliveredAt ? new Date(r.deliveredAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {(r.deliveryStatusCode ?? "").toLowerCase() !== "delivered" && (
                          <button
                            onClick={() => setConfirmDeliveryId(r.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                            style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(22,163,74,0.2)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(22,163,74,0.1)")}
                            title="Confirm Delivery"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Deliver
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

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg"
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
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ border: "1px solid #e5e7eb", color: offset + PAGE_SIZE >= total ? "#9bafc5" : "#24315f", cursor: offset + PAGE_SIZE >= total ? "not-allowed" : "pointer" }}
          >
            Next
          </button>
        </div>
      )}

      {/* New NFT Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #e5e7eb" }}>
              <h2 className="text-base font-bold" style={{ color: "#24315f" }}>New NFT Record</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>{formError}</div>
              )}
              <div>
                <label style={labelStyle}>Serial Number *</label>
                <input value={form.serialNumber} onChange={(e) => setForm({ ...form, serialNumber: e.target.value })} style={inputStyle} placeholder="e.g. BT-0001" />
              </div>
              {master && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label style={labelStyle}>Stage</label>
                      <select value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })} style={inputStyle}>
                        <option value="">Select...</option>
                        {master.nftStages.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>NFT Type</label>
                      <select value={form.nftTypeId} onChange={(e) => setForm({ ...form, nftTypeId: e.target.value })} style={inputStyle}>
                        <option value="">Select...</option>
                        {master.nftTypes.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Delivery Status</label>
                    <select value={form.deliveryStatusId} onChange={(e) => setForm({ ...form, deliveryStatusId: e.target.value })} style={inputStyle}>
                      <option value="">Select...</option>
                      {master.deliveryStatuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, minHeight: "64px", resize: "vertical" }} placeholder="Optional notes..." />
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: "1px solid #e5e7eb" }}>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: saving ? "#9bafc5" : "#41afeb" }}
              >
                {saving ? "Saving..." : "Create NFT"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delivery Modal */}
      {confirmDeliveryId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold mb-2" style={{ color: "#24315f" }}>Confirm Delivery</h2>
            <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
              Mark this NFT as delivered? This will set the delivery date to today and update the delivery status.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDeliveryId(null)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
                Cancel
              </button>
              <button onClick={() => handleConfirmDelivery(confirmDeliveryId)} className="px-4 py-2 text-sm font-bold text-white rounded-lg" style={{ background: "#16a34a" }}>
                Confirm Delivery
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
