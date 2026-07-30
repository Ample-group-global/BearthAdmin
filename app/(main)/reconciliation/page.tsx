"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import DataTable, { type ColumnDef } from "@/components/DataTable";

// ─── Shared ───────────────────────────────────────────────────────────────────

function statusColor(s: string): string {
  const c = (s ?? "").toLowerCase();
  if (c === "confirmed" || c === "received") return "#16a34a";
  if (c === "pending")                        return "#d97706";
  if (c === "cancelled" || c === "canceled")  return "#dc2626";
  return "#6b7280";
}

function StatusBadge({ status }: { status: string }) {
  const color = statusColor(status);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}18`, color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      {status}
    </span>
  );
}

const TAB_ACTIVE   = { color: "#24315f", borderBottom: "2px solid #41afeb", fontWeight: 700, background: "transparent" };
const TAB_INACTIVE = { color: "#9bafc5", borderBottom: "2px solid transparent", fontWeight: 600, background: "transparent" };

// ─── Actions tab types ────────────────────────────────────────────────────────

interface ActionEntry {
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

// ─── Report tab types ─────────────────────────────────────────────────────────

interface ReportEntry {
  id: string;
  entryType: string;
  amountTwd: string | null;
  amountEth: string | null;
  status: string;
  notes: string | null;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  orderNumber: string | null;
  customerName: string;
  customerEmail: string;
  paymentMethod: string | null;
  currencyCode: string | null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const ACTION_STATUSES = [
  { value: "",           label: "All" },
  { value: "pending",    label: "Pending" },
  { value: "received",   label: "Received" },
  { value: "cancelled",  label: "Cancelled" },
];

const REPORT_STATUSES = [
  { code: "",            label: "All" },
  { code: "pending",     label: "Pending" },
  { code: "confirmed",   label: "Confirmed" },
  { code: "cancelled",   label: "Cancelled" },
];

const ACTION_PAGE = 100;
const REPORT_PAGE = 20;

export default function ReconciliationPage() {
  const [tab, setTab] = useState<"actions" | "report">("actions");
  const reportLoadedRef = useRef(false);

  // ── Actions tab state ──────────────────────────────────────────────────────
  const [entries,      setEntries]      = useState<ActionEntry[]>([]);
  const [actionTotal,  setActionTotal]  = useState(0);
  const [actionOffset, setActionOffset] = useState(0);
  const [actionStatus, setActionStatus] = useState("");
  const [actionLoading,setActionLoading]= useState(true);
  const [actionError,  setActionError]  = useState<string | null>(null);
  const [actionModal,  setActionModal]  = useState<{ id: string; action: "confirm" | "cancel" } | null>(null);
  const [modalNotes,   setModalNotes]   = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);

  // ── Report tab state ───────────────────────────────────────────────────────
  const [reportEntries, setReportEntries] = useState<ReportEntry[]>([]);
  const [reportTotal,   setReportTotal]   = useState(0);
  const [reportOffset,  setReportOffset]  = useState(0);
  const [reportStatus,  setReportStatus]  = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError,   setReportError]   = useState<string | null>(null);
  const [reportSortKey, setReportSortKey] = useState<string | undefined>(undefined);
  const [reportSortDir, setReportSortDir] = useState<"asc" | "desc">("asc");

  // ── Actions tab data ───────────────────────────────────────────────────────

  const loadActions = useCallback((status: string, off: number) => {
    setActionLoading(true); setActionError(null);
    const params = new URLSearchParams({ limit: String(ACTION_PAGE), offset: String(off) });
    if (status) params.set("status", status);
    fetch(`/api/reconciliation?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setEntries(d.entries ?? []); setActionTotal(d.total ?? 0); setActionLoading(false); })
      .catch(() => { setActionError("Failed to load entries."); setActionLoading(false); });
  }, []);

  useEffect(() => { loadActions(actionStatus, actionOffset); }, []);

  // ── Report tab data ────────────────────────────────────────────────────────

  const loadReport = useCallback((off: number, st: string, sk?: string, sd?: "asc" | "desc") => {
    setReportLoading(true); setReportError(null);
    const params = new URLSearchParams({ offset: String(off), limit: String(REPORT_PAGE) });
    if (st) params.set("status", st);
    if (sk) params.set("sort_by", sk);
    if (sk && sd) params.set("sort_dir", sd);
    fetch(`/api/reports/reconciliation?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setReportEntries(d.entries ?? []); setReportTotal(d.total ?? 0); setReportLoading(false); })
      .catch(() => { setReportError("Failed to load report."); setReportLoading(false); });
  }, []);

  useEffect(() => {
    if (tab === "report" && !reportLoadedRef.current) {
      reportLoadedRef.current = true;
      loadReport(0, "");
    }
  }, [tab, loadReport]);

  // ── Actions tab handlers ───────────────────────────────────────────────────

  const openModal = (id: string, action: "confirm" | "cancel") => {
    setActionModal({ id, action }); setModalNotes(""); setSubmitError(null);
  };

  const handleSubmit = async () => {
    if (!actionModal) return;
    setSubmitting(true); setSubmitError(null);
    try {
      const res = await fetch(`/api/reconciliation/${actionModal.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionModal.action, notes: modalNotes || undefined }),
      });
      if (!res.ok) { const d = await res.json(); setSubmitError(d.error ?? "Action failed."); return; }
      setActionModal(null);
      loadActions(actionStatus, actionOffset);
    } catch { setSubmitError("Network error."); }
    finally { setSubmitting(false); }
  };

  // ── Report tab handlers ────────────────────────────────────────────────────

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString() : "—";
  const fmtAmt  = (twd: string | null, eth: string | null) => {
    const parts = [];
    if (twd && Number(twd) !== 0) parts.push(`TWD ${Number(twd).toLocaleString()}`);
    if (eth && Number(eth) !== 0) parts.push(`${eth} ETH`);
    return parts.join(" / ") || "—";
  };

  const reportColumns: ColumnDef<ReportEntry>[] = [
    {
      key: "order", header: "Order", sortKey: "order",
      render: r => <span className="font-mono text-xs font-semibold" style={{ color: "#24315f" }}>{r.orderNumber ?? "—"}</span>,
    },
    {
      key: "customer", header: "Customer", sortKey: "customer",
      render: r => (
        <div>
          <div className="font-medium text-xs" style={{ color: "#374151" }}>{r.customerName}</div>
          <div className="text-xs" style={{ color: "#9bafc5" }}>{r.customerEmail}</div>
        </div>
      ),
    },
    {
      key: "type", header: "Type", sortKey: "entry_type",
      render: r => <span className="text-xs" style={{ color: "#6b7280" }}>{r.entryType}</span>,
    },
    {
      key: "amount", header: "Amount", sortKey: "amount_twd", align: "right",
      render: r => <span className="text-xs font-semibold" style={{ color: "#24315f" }}>{fmtAmt(r.amountTwd, r.amountEth)}</span>,
    },
    {
      key: "payment", header: "Payment",
      render: r => <span className="text-xs" style={{ color: "#6b7280" }}>{r.paymentMethod ?? "—"}</span>,
    },
    {
      key: "status", header: "Status", sortKey: "status",
      render: r => <StatusBadge status={r.status} />,
    },
    {
      key: "confirmedAt", header: "Confirmed", sortKey: "confirmed_at",
      render: r => <span className="text-xs" style={{ color: "#6b7280" }}>{fmtDate(r.confirmedAt)}</span>,
    },
    {
      key: "createdAt", header: "Created", sortKey: "created_at",
      render: r => <span className="text-xs" style={{ color: "#6b7280" }}>{fmtDate(r.createdAt)}</span>,
    },
  ];

  // ── Stats for Actions tab ──────────────────────────────────────────────────

  const pendingCount    = entries.filter(e => (e.status ?? "").toLowerCase() === "pending").length;
  const confirmedCount  = entries.filter(e => (e.status ?? "").toLowerCase() === "confirmed" || (e.status ?? "").toLowerCase() === "received").length;
  const cancelledCount  = entries.filter(e => (e.status ?? "").toLowerCase() === "cancelled" || (e.status ?? "").toLowerCase() === "canceled").length;

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "#24315f" }}>Reconciliation</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            Review, confirm and report on payment reconciliation entries
          </p>
        </div>
        <button
          onClick={() => tab === "actions" ? loadActions(actionStatus, actionOffset) : loadReport(reportOffset, reportStatus, reportSortKey, reportSortDir)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white"
          style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Tab Bar */}
      <div style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div className="flex gap-0">
          {([
            { key: "actions", label: "Actions", badge: pendingCount > 0 ? pendingCount : null },
            { key: "report",  label: "Report" },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm transition-colors"
              style={tab === t.key ? TAB_ACTIVE : TAB_INACTIVE}>
              {t.label}
              {"badge" in t && t.badge !== null && (
                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-xs font-bold text-white"
                  style={{ background: "#d97706", fontSize: 10 }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ACTIONS TAB — confirm / cancel pending entries
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "actions" && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Pending",   value: pendingCount,   color: "#d97706", filter: "pending" },
              { label: "Confirmed", value: confirmedCount, color: "#16a34a", filter: "received" },
              { label: "Cancelled", value: cancelledCount, color: "#dc2626", filter: "cancelled" },
            ].map(s => (
              <button key={s.label}
                onClick={() => { setActionStatus(s.filter); setActionOffset(0); loadActions(s.filter, 0); }}
                className="text-left bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
                style={{ border: "1px solid #e5e7eb", borderLeft: `3px solid ${s.color}`, padding: "14px 16px" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#9bafc5" }}>{s.label}</p>
                <p className="text-2xl font-extrabold leading-none" style={{ color: s.color }}>
                  {actionLoading ? "—" : s.value}
                </p>
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-1 p-1 rounded-xl bg-white" style={{ border: "1px solid #e5e7eb" }}>
              {ACTION_STATUSES.map(opt => (
                <button key={opt.value}
                  onClick={() => { setActionStatus(opt.value); setActionOffset(0); loadActions(opt.value, 0); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={actionStatus === opt.value
                    ? { background: "#41afeb", color: "#fff" }
                    : { color: "#6b7280" }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <span className="text-xs" style={{ color: "#9bafc5" }}>
              {actionTotal > 0
                ? `${actionOffset + 1}–${Math.min(actionOffset + ACTION_PAGE, actionTotal)} of ${actionTotal}`
                : "0 results"}
            </span>
          </div>

          {actionError && (
            <div className="p-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
              {actionError}
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
            {actionLoading ? (
              <div className="flex items-center justify-center h-48" style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading…
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2">
                <svg className="w-8 h-8" style={{ color: "#d1d5db" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-sm" style={{ color: "#9bafc5" }}>No reconciliation entries found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                      {["Order #", "Customer", "Type", "Amount TWD", "Amount ETH", "Payment", "Status", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide"
                          style={{ color: "#9bafc5", whiteSpace: "nowrap" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={e.id}
                        style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = "#fafbff")}
                        onMouseLeave={ev => (ev.currentTarget.style.background = "")}>
                        <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: "#24315f" }}>{e.orderNumber ?? "—"}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#374151" }}>{e.customerName ?? "—"}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#6b7280" }}>{e.entryType ?? "—"}</td>
                        <td className="px-4 py-3 text-xs text-right font-semibold" style={{ color: "#24315f" }}>
                          {e.amountTwd != null ? `TWD ${Number(e.amountTwd).toLocaleString()}` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-right" style={{ color: "#6b7280" }}>
                          {e.amountEth != null ? `${e.amountEth} ETH` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "#6b7280" }}>{e.paymentMethodName ?? "—"}</td>
                        <td className="px-4 py-3"><StatusBadge status={e.status ?? "—"} /></td>
                        <td className="px-4 py-3">
                          {(e.status ?? "").toLowerCase() === "pending" ? (
                            <div className="flex items-center gap-2">
                              <button onClick={() => openModal(e.id, "confirm")}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                                style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Confirm
                              </button>
                              <button onClick={() => openModal(e.id, "cancel")}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold"
                                style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: "#d1d5db" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {actionTotal > ACTION_PAGE && (
            <div className="flex items-center justify-between">
              <button onClick={() => { const o = Math.max(0, actionOffset - ACTION_PAGE); setActionOffset(o); loadActions(actionStatus, o); }}
                disabled={actionOffset === 0}
                className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ border: "1px solid #e5e7eb", color: actionOffset === 0 ? "#9bafc5" : "#24315f", cursor: actionOffset === 0 ? "not-allowed" : "pointer" }}>
                Previous
              </button>
              <span className="text-xs" style={{ color: "#9bafc5" }}>
                {actionOffset + 1}–{Math.min(actionOffset + ACTION_PAGE, actionTotal)} of {actionTotal}
              </span>
              <button onClick={() => { const o = actionOffset + ACTION_PAGE; setActionOffset(o); loadActions(actionStatus, o); }}
                disabled={actionOffset + ACTION_PAGE >= actionTotal}
                className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ border: "1px solid #e5e7eb", color: actionOffset + ACTION_PAGE >= actionTotal ? "#9bafc5" : "#24315f", cursor: actionOffset + ACTION_PAGE >= actionTotal ? "not-allowed" : "pointer" }}>
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          REPORT TAB — sortable read-only history via DataTable
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === "report" && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {REPORT_STATUSES.map(f => (
              <button key={f.code}
                onClick={() => { setReportStatus(f.code); setReportOffset(0); loadReport(0, f.code, reportSortKey, reportSortDir); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: reportStatus === f.code ? "#24315f" : "#f3f4f6", color: reportStatus === f.code ? "#fff" : "#374151" }}>
                {f.label}
              </button>
            ))}
            <span className="ml-auto text-xs" style={{ color: "#9bafc5" }}>{reportTotal.toLocaleString()} entries</span>
          </div>

          <DataTable
            columns={reportColumns}
            data={reportEntries}
            total={reportTotal}
            offset={reportOffset}
            pageSize={REPORT_PAGE}
            onPageChange={off => { setReportOffset(off); loadReport(off, reportStatus, reportSortKey, reportSortDir); }}
            loading={reportLoading}
            error={reportError}
            emptyText="No reconciliation entries found"
            keyExtractor={r => r.id}
            sortKey={reportSortKey}
            sortDir={reportSortDir}
            onSort={(key, dir) => { setReportSortKey(key); setReportSortDir(dir); setReportOffset(0); loadReport(0, reportStatus, key, dir); }}
          />
        </>
      )}

      {/* ══ Confirm / Cancel Modal ════════════════════════════════════════════ */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" style={{ border: "1px solid #e5e7eb" }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
              <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>
                {actionModal.action === "confirm" ? "Confirm Entry" : "Cancel Entry"}
              </h2>
              <p className="text-xs mt-1" style={{ color: "#6b7280" }}>
                {actionModal.action === "confirm"
                  ? "Mark this reconciliation entry as confirmed."
                  : "Cancel this reconciliation entry."}
              </p>
            </div>

            <div className="px-6 py-4 space-y-3">
              {submitError && (
                <div className="p-3 rounded-lg text-xs" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  {submitError}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Notes (optional)</label>
                <textarea value={modalNotes} onChange={e => setModalNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                  style={{ border: "1px solid #e5e7eb", color: "#111827", minHeight: 64, resize: "vertical" }}
                  placeholder="Add notes…" />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid #f3f4f6" }}>
              <button onClick={() => setActionModal(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: submitting ? "#9bafc5" : actionModal.action === "confirm" ? "#16a34a" : "#dc2626" }}>
                {submitting ? "Processing…" : actionModal.action === "confirm" ? "Confirm" : "Cancel Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
