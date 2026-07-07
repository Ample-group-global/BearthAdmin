"use client";

import { useEffect, useState } from "react";

interface ReconciliationEntry {
  id: string;
  entryType: string;
  amountTwd: number;
  amountEth: number;
  status: string;
  orderNumber: string;
  customerName: string;
  currencyCode: string;
  paymentMethodName: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  totalCount: number;
}

const PAGE_SIZE = 100;

function statusColor(status: string): string {
  const s = (status ?? "").toLowerCase();
  if (s === "confirmed" || s === "received") return "#16a34a";
  if (s === "pending") return "#d97706";
  if (s === "cancelled" || s === "canceled") return "#dc2626";
  return "#6b7280";
}

function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}18`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      {status}
    </span>
  );
}

export default function ReconciliationPage() {
  const [entries, setEntries] = useState<ReconciliationEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<{ id: string; action: "confirm" | "cancel" } | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actioning, setActioning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadEntries = (status: string, off: number) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
    if (status) params.set("status", status);
    fetch(`/api/presale/reconciliation?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const rows: ReconciliationEntry[] = data.entries ?? [];
        setEntries(rows);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load reconciliation entries.");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadEntries(statusFilter, offset);
  }, [offset, statusFilter]);

  const openAction = (id: string, action: "confirm" | "cancel") => {
    setActionModal({ id, action });
    setActionNotes("");
    setActionError(null);
  };

  const handleAction = async () => {
    if (!actionModal) return;
    setActioning(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/presale/reconciliation/${actionModal.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionModal.action, notes: actionNotes || undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        setActionError(d.error ?? "Action failed.");
        return;
      }
      setActionModal(null);
      loadEntries(statusFilter, offset);
    } catch {
      setActionError("Network error.");
    } finally {
      setActioning(false);
    }
  };

  const STATUS_OPTIONS = [
    { value: "", label: "All Statuses" },
    { value: "pending", label: "Pending" },
    { value: "received", label: "Received" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Reconciliation</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Review and confirm payment reconciliation entries</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl bg-white" style={{ border: "1px solid #e5e7eb" }}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setOffset(0); }}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={statusFilter === opt.value
                ? { background: "#41afeb", color: "#fff" }
                : { color: "#6b7280" }}
            >
              {opt.label}
            </button>
          ))}
        </div>
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
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm" style={{ color: "#9bafc5" }}>No reconciliation entries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:border-r [&_th]:border-gray-100 [&_td]:border-r [&_td]:border-gray-100 [&_th]:py-2 [&_th]:px-3 [&_td]:py-2 [&_td]:px-3">
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Entry Type</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Order #</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Customer</th>
                  <th className="px-4 py-3 text-right font-semibold" style={{ color: "#9bafc5" }}>Amount TWD</th>
                  <th className="px-4 py-3 text-right font-semibold" style={{ color: "#9bafc5" }}>Amount ETH</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Status</th>
                  <th className="px-4 py-3 text-center font-semibold" style={{ color: "#9bafc5" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={e.id} style={{ borderBottom: i < entries.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: "#111827" }}>{e.entryType ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: "#6b7280" }}>{e.orderNumber ?? "—"}</td>
                    <td className="px-4 py-3" style={{ color: "#6b7280" }}>{e.customerName ?? "—"}</td>
                    <td className="px-4 py-3 text-right" style={{ color: "#111827" }}>
                      {e.amountTwd != null ? `TWD ${Number(e.amountTwd).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: "#6b7280" }}>
                      {e.amountEth != null ? `${e.amountEth} ETH` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={e.status ?? "—"} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {(e.status ?? "").toLowerCase() === "pending" && (
                          <>
                            <button
                              onClick={() => openAction(e.id, "confirm")}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                              style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}
                              onMouseEnter={(ev) => (ev.currentTarget.style.background = "rgba(22,163,74,0.2)")}
                              onMouseLeave={(ev) => (ev.currentTarget.style.background = "rgba(22,163,74,0.1)")}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Confirm
                            </button>
                            <button
                              onClick={() => openAction(e.id, "cancel")}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                              style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}
                              onMouseEnter={(ev) => (ev.currentTarget.style.background = "rgba(220,38,38,0.2)")}
                              onMouseLeave={(ev) => (ev.currentTarget.style.background = "rgba(220,38,38,0.1)")}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Cancel
                            </button>
                          </>
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

      {/* Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold mb-1" style={{ color: "#24315f" }}>
              {actionModal.action === "confirm" ? "Confirm Entry" : "Cancel Entry"}
            </h2>
            <p className="text-sm mb-4" style={{ color: "#6b7280" }}>
              {actionModal.action === "confirm"
                ? "This will mark the reconciliation entry as confirmed."
                : "This will cancel the reconciliation entry."}
            </p>
            {actionError && (
              <div className="p-3 rounded-lg text-sm mb-4" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>{actionError}</div>
            )}
            <div className="mb-4">
              <label className="block text-xs font-semibold mb-1" style={{ color: "#24315f" }}>Notes (optional)</label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: "1px solid #e5e7eb", color: "#111827", minHeight: "64px", resize: "vertical" }}
                placeholder="Add notes..."
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setActionModal(null)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={actioning}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: actioning ? "#9bafc5" : actionModal.action === "confirm" ? "#16a34a" : "#dc2626" }}
              >
                {actioning ? "Processing..." : actionModal.action === "confirm" ? "Confirm" : "Cancel Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
