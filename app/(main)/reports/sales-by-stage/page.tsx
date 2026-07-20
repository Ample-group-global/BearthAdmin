"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import DataTable, { type ColumnDef } from "@/components/DataTable";

function StatCard({ label, value, color = "#24315f", href }: { label: string; value: string | number; color?: string; href?: string }) {
  const inner = (
    <>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#9bafc5" }}>{label}</p>
      <p className="text-2xl font-extrabold leading-none" style={{ color }}>{typeof value === "number" ? value.toLocaleString() : value}</p>
    </>
  );
  const style = { border: "1px solid #e5e7eb", borderLeft: `3px solid ${color}`, padding: "14px 16px" };
  return href ? (
    <Link href={href} className="block bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow" style={style}>{inner}</Link>
  ) : (
    <div className="bg-white rounded-xl shadow-sm" style={style}>{inner}</div>
  );
}

interface StageRow {
  stageId: string;
  stageName: string;
  stageCode: string;
  total: number;
  delivered: number;
  pending: number;
  cancelled: number;
}

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

const PAGE_SIZE = 10;

export default function SalesByStage() {
  const [stages, setStages]   = useState<StageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [offset, setOffset]   = useState(0);
  const [sortKey, setSortKey] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetch("/api/reports/sales-by-stage", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setStages(d.stages ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load report."); setLoading(false); });
  }, []);

  const sorted = useMemo(() => {
    if (!sortKey) return stages;
    return [...stages].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortKey) {
        case "stage":     av = a.stageName;                              bv = b.stageName;                              break;
        case "total":     av = Number(a.total);                          bv = Number(b.total);                          break;
        case "delivered": av = Number(a.delivered);                      bv = Number(b.delivered);                      break;
        case "pending":   av = Number(a.pending);                        bv = Number(b.pending);                        break;
        case "cancelled": av = Number(a.cancelled);                      bv = Number(b.cancelled);                      break;
        case "pct":       av = pct(Number(a.delivered), Number(a.total)); bv = pct(Number(b.delivered), Number(b.total)); break;
        default: return 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [stages, sortKey, sortDir]);

  const page = sorted.slice(offset, offset + PAGE_SIZE);

  const grandTotal = stages.reduce((s, r) => s + Number(r.total), 0);

  const columns: ColumnDef<StageRow>[] = [
    {
      key: "stage",
      header: "Stage",
      sortKey: "stage",
      render: r => <span className="font-semibold" style={{ color: "#24315f" }}>{r.stageName}</span>,
    },
    {
      key: "total",
      header: "Total",
      sortKey: "total",
      align: "right",
      render: r => <span className="font-bold" style={{ color: "#374151" }}>{Number(r.total).toLocaleString()}</span>,
    },
    {
      key: "delivered",
      header: "Delivered",
      sortKey: "delivered",
      align: "right",
      render: r => <span style={{ color: "#16a34a" }}>{Number(r.delivered).toLocaleString()}</span>,
    },
    {
      key: "pending",
      header: "Pending",
      sortKey: "pending",
      align: "right",
      render: r => <span style={{ color: "#d97706" }}>{Number(r.pending).toLocaleString()}</span>,
    },
    {
      key: "cancelled",
      header: "Cancelled",
      sortKey: "cancelled",
      align: "right",
      render: r => <span style={{ color: "#dc2626" }}>{Number(r.cancelled).toLocaleString()}</span>,
    },
    {
      key: "pct",
      header: "% Delivered",
      sortKey: "pct",
      render: r => {
        const p = pct(Number(r.delivered), Number(r.total));
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#f3f4f6", minWidth: 60 }}>
              <div className="h-full rounded-full" style={{ width: `${p}%`, background: "#16a34a" }} />
            </div>
            <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>{p}%</span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div>
        <div className="flex items-center gap-1.5 text-xs mb-1">
          <Link href="/orders" className="hover:underline" style={{ color: "#9bafc5" }}>Overview</Link>
          <span style={{ color: "#d1d5db" }}>›</span>
          <span style={{ color: "#9bafc5" }}>Sales by Stage</span>
        </div>
        <h1 className="text-lg font-extrabold" style={{ color: "#24315f" }}>Sales by Stage</h1>
      </div>

      {error ? (
        <div className="p-4 rounded-xl text-sm" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total NFTs", value: grandTotal, color: "#24315f",                                   href: "/nft/records" },
              { label: "Delivered",  value: stages.reduce((s, r) => s + Number(r.delivered), 0), color: "#16a34a", href: "/reports/delivery?status=delivered" },
              { label: "Pending",    value: stages.reduce((s, r) => s + Number(r.pending),   0), color: "#d97706", href: "/reports/delivery?status=pending" },
              { label: "Cancelled",  value: stages.reduce((s, r) => s + Number(r.cancelled), 0), color: "#dc2626", href: "/reports/delivery?status=cancelled" },
            ].map(c => (
              <StatCard key={c.label} label={c.label} value={c.value} color={c.color} href={c.href} />
            ))}
          </div>

          <DataTable
            columns={columns}
            data={page}
            total={sorted.length}
            offset={offset}
            pageSize={PAGE_SIZE}
            onPageChange={setOffset}
            loading={loading}
            emptyText="No stage data available"
            keyExtractor={r => r.stageId}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={(key, dir) => { setSortKey(key); setSortDir(dir); setOffset(0); }}
          />
        </>
      )}
    </div>
  );
}
