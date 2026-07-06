"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DeliveryRecord {
  id: string;
  serialNumber: string;
  stageName: string;
  typeName: string;
  deliveryStatusName: string;
  deliveryStatusCode: string;
  deliveredAt: string | null;
  notes: string | null;
  createdAt: string;
}

const STATUS_FILTERS = [
  { code: "", label: "All Statuses" },
  { code: "delivered", label: "Delivered" },
  { code: "pending",   label: "Pending" },
  { code: "cancelled", label: "Cancelled" },
];

function statusColor(code: string): string {
  const c = (code ?? "").toLowerCase();
  if (c === "delivered") return "#16a34a";
  if (c === "pending")   return "#d97706";
  if (c === "cancelled" || c === "canceled") return "#dc2626";
  return "#6b7280";
}

const PAGE_SIZE = 100;

export default function DeliveryReport() {
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [total,   setTotal]   = useState(0);
  const [offset,  setOffset]  = useState(0);
  const [status,  setStatus]  = useState("");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = (off: number, st: string) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ offset: String(off), limit: String(PAGE_SIZE) });
    if (st) params.set("status", st);
    fetch(`/api/presale/reports/delivery?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setRecords(d.records ?? []); setTotal(d.total ?? 0); setLoading(false); })
      .catch(() => { setError("Failed to load report."); setLoading(false); });
  };

  useEffect(() => { load(0, ""); }, []);

  const changeStatus = (st: string) => { setStatus(st); setOffset(0); load(0, st); };
  const changePage   = (off: number) => { setOffset(off); load(off, status); };

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString() : "—";

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link href="/presale/reports" className="text-sm font-medium hover:underline" style={{ color: "#9bafc5" }}>Reports</Link>
        <span style={{ color: "#d1d5db" }}>›</span>
        <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Delivery Report</h1>
        <span className="ml-auto text-sm" style={{ color: "#9bafc5" }}>{total.toLocaleString()} records</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.code}
            onClick={() => changeStatus(f.code)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{
              background: status === f.code ? "#24315f" : "#f3f4f6",
              color:      status === f.code ? "#fff"     : "#374151",
            }}
          >{f.label}</button>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl text-sm" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>{error}</div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div className="flex items-center justify-center h-48" style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>Loading…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  {["Serial Number", "Stage", "Type", "Status", "Delivered At", "Created"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>{h}</th>
                  ))}
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
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: `${statusColor(r.deliveryStatusCode)}18`, color: statusColor(r.deliveryStatusCode) }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(r.deliveryStatusCode) }} />
                          {r.deliveryStatusName}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: "#6b7280" }}>{fmtDate(r.deliveredAt)}</td>
                    <td className="px-4 py-3" style={{ color: "#6b7280" }}>{fmtDate(r.createdAt)}</td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-sm" style={{ color: "#9bafc5" }}>No records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => changePage(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ border: "1px solid #e5e7eb", color: offset === 0 ? "#9bafc5" : "#24315f", cursor: offset === 0 ? "not-allowed" : "pointer" }}
          >Previous</button>
          <span className="text-sm" style={{ color: "#9bafc5" }}>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button
            onClick={() => changePage(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ border: "1px solid #e5e7eb", color: offset + PAGE_SIZE >= total ? "#9bafc5" : "#24315f", cursor: offset + PAGE_SIZE >= total ? "not-allowed" : "pointer" }}
          >Next</button>
        </div>
      )}
    </div>
  );
}
