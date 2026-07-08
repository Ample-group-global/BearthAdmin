"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import DataTable, { type ColumnDef } from "@/components/DataTable";

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

const PAGE_SIZE = 20;

export default function DeliveryReport() {
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [total,   setTotal]   = useState(0);
  const [offset,  setOffset]  = useState(0);
  const [status,  setStatus]  = useState("");
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const load = useCallback((off: number, st: string, sk?: string, sd?: "asc" | "desc") => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ offset: String(off), limit: String(PAGE_SIZE) });
    if (st) params.set("status", st);
    if (sk) params.set("sort_by", sk);
    if (sk && sd) params.set("sort_dir", sd);
    fetch(`/api/presale/reports/delivery?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setRecords(d.records ?? []); setTotal(d.total ?? 0); setLoading(false); })
      .catch(() => { setError("Failed to load report."); setLoading(false); });
  }, []);

  useEffect(() => { load(0, ""); }, []);

  const changeStatus = (st: string) => { setStatus(st); setOffset(0); load(0, st, sortKey, sortDir); };
  const handleSort   = (key: string, dir: "asc" | "desc") => { setSortKey(key); setSortDir(dir); setOffset(0); load(0, status, key, dir); };
  const handlePage   = (off: number) => { setOffset(off); load(off, status, sortKey, sortDir); };

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString() : "—";

  const columns: ColumnDef<DeliveryRecord>[] = [
    {
      key: "serial",
      header: "Serial Number",
      sortKey: "serial_number",
      render: r => <span className="font-mono font-semibold" style={{ color: "#24315f" }}>{r.serialNumber}</span>,
    },
    {
      key: "stage",
      header: "Stage",
      sortKey: "stage",
      render: r => <span style={{ color: "#6b7280" }}>{r.stageName ?? "—"}</span>,
    },
    {
      key: "type",
      header: "Type",
      sortKey: "type",
      render: r => <span style={{ color: "#6b7280" }}>{r.typeName ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortKey: "delivery_status",
      render: r => r.deliveryStatusCode ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: `${statusColor(r.deliveryStatusCode)}18`, color: statusColor(r.deliveryStatusCode) }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(r.deliveryStatusCode) }} />
          {r.deliveryStatusName}
        </span>
      ) : <span style={{ color: "#9bafc5" }}>—</span>,
    },
    {
      key: "deliveredAt",
      header: "Delivered At",
      sortKey: "delivered_at",
      render: r => <span style={{ color: "#6b7280" }}>{fmtDate(r.deliveredAt)}</span>,
    },
    {
      key: "createdAt",
      header: "Created",
      sortKey: "created_at",
      render: r => <span style={{ color: "#6b7280" }}>{fmtDate(r.createdAt)}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div>
        <div className="flex items-center gap-1.5 text-xs mb-1">
          <Link href="/presale" className="hover:underline" style={{ color: "#9bafc5" }}>Overview</Link>
          <span style={{ color: "#d1d5db" }}>›</span>
          <span style={{ color: "#9bafc5" }}>Delivery Report</span>
        </div>
        <div className="flex items-end justify-between">
          <h1 className="text-lg font-extrabold" style={{ color: "#24315f" }}>Delivery Report</h1>
          <span className="text-xs" style={{ color: "#9bafc5" }}>{total.toLocaleString()} records</span>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_FILTERS.map(f => (
          <button key={f.code} onClick={() => changeStatus(f.code)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: status === f.code ? "#24315f" : "#f3f4f6", color: status === f.code ? "#fff" : "#374151" }}>
            {f.label}
          </button>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={records}
        total={total}
        offset={offset}
        pageSize={PAGE_SIZE}
        onPageChange={handlePage}
        loading={loading}
        error={error}
        emptyText="No delivery records found"
        keyExtractor={r => r.id}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />
    </div>
  );
}
