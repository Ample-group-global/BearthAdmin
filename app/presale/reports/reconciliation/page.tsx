"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import DataTable, { type ColumnDef } from "@/components/DataTable";

interface ReconEntry {
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

const STATUS_FILTERS = [
  { code: "", label: "All" },
  { code: "pending",   label: "Pending" },
  { code: "confirmed", label: "Confirmed" },
  { code: "cancelled", label: "Cancelled" },
];

function statusColor(s: string): string {
  const c = (s ?? "").toLowerCase();
  if (c === "confirmed" || c === "received") return "#16a34a";
  if (c === "pending") return "#d97706";
  if (c === "cancelled" || c === "canceled") return "#dc2626";
  return "#6b7280";
}

const PAGE_SIZE = 20;

export default function ReconciliationReport() {
  const [entries, setEntries] = useState<ReconEntry[]>([]);
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
    fetch(`/api/presale/reports/reconciliation?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setEntries(d.entries ?? []); setTotal(d.total ?? 0); setLoading(false); })
      .catch(() => { setError("Failed to load report."); setLoading(false); });
  }, []);

  useEffect(() => { load(0, ""); }, []);

  const changeStatus = (st: string) => { setStatus(st); setOffset(0); load(0, st, sortKey, sortDir); };
  const handleSort   = (key: string, dir: "asc" | "desc") => { setSortKey(key); setSortDir(dir); setOffset(0); load(0, status, key, dir); };
  const handlePage   = (off: number) => { setOffset(off); load(off, status, sortKey, sortDir); };

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString() : "—";
  const fmtAmt  = (twd: string | null, eth: string | null) => {
    const parts = [];
    if (twd && Number(twd) !== 0) parts.push(`TWD ${Number(twd).toLocaleString()}`);
    if (eth && Number(eth) !== 0) parts.push(`${eth} ETH`);
    return parts.join(" / ") || "—";
  };

  const columns: ColumnDef<ReconEntry>[] = [
    {
      key: "order",
      header: "Order",
      sortKey: "order",
      render: r => <span className="font-mono text-xs font-semibold" style={{ color: "#24315f" }}>{r.orderNumber ?? "—"}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      sortKey: "customer",
      render: r => (
        <div>
          <div className="font-medium text-xs" style={{ color: "#374151" }}>{r.customerName}</div>
          <div className="text-xs" style={{ color: "#9bafc5" }}>{r.customerEmail}</div>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortKey: "entry_type",
      render: r => <span className="text-xs" style={{ color: "#6b7280" }}>{r.entryType}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      sortKey: "amount_twd",
      align: "right",
      render: r => <span className="text-xs font-semibold" style={{ color: "#24315f" }}>{fmtAmt(r.amountTwd, r.amountEth)}</span>,
    },
    {
      key: "payment",
      header: "Payment",
      render: r => <span className="text-xs" style={{ color: "#6b7280" }}>{r.paymentMethod ?? "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      render: r => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: `${statusColor(r.status)}18`, color: statusColor(r.status) }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(r.status) }} />
          {r.status}
        </span>
      ),
    },
    {
      key: "confirmedAt",
      header: "Confirmed",
      sortKey: "confirmed_at",
      render: r => <span className="text-xs" style={{ color: "#6b7280" }}>{fmtDate(r.confirmedAt)}</span>,
    },
    {
      key: "createdAt",
      header: "Created",
      sortKey: "created_at",
      render: r => <span className="text-xs" style={{ color: "#6b7280" }}>{fmtDate(r.createdAt)}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link href="/presale/reports" className="text-sm font-medium hover:underline" style={{ color: "#9bafc5" }}>Reports</Link>
        <span style={{ color: "#d1d5db" }}>›</span>
        <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Reconciliation Report</h1>
        <span className="ml-auto text-sm" style={{ color: "#9bafc5" }}>{total.toLocaleString()} entries</span>
      </div>

      <div className="flex items-center gap-2">
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
        data={entries}
        total={total}
        offset={offset}
        pageSize={PAGE_SIZE}
        onPageChange={handlePage}
        loading={loading}
        error={error}
        emptyText="No reconciliation entries found"
        keyExtractor={r => r.id}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />
    </div>
  );
}
