"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import DataTable, { type ColumnDef } from "@/components/DataTable";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StageRow {
  stageId: string;
  stageName: string;
  stageCode: string;
  total: number;
  delivered: number;
  pending: number;
  cancelled: number;
}

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

// ─── Constants ───────────────────────────────────────────────────────────────

const STAGE_PAGE_SIZE    = 10;
const DELIVERY_PAGE_SIZE = 20;

const STATUS_FILTERS = [
  { code: "",           label: "All Statuses" },
  { code: "delivered",  label: "Delivered" },
  { code: "pending",    label: "Pending" },
  { code: "cancelled",  label: "Cancelled" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(n: number, total: number) {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function statusColor(code: string): string {
  const c = (code ?? "").toLowerCase();
  if (c === "delivered")                    return "#16a34a";
  if (c === "pending")                      return "#d97706";
  if (c === "cancelled" || c === "canceled") return "#dc2626";
  return "#6b7280";
}

function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString() : "—";
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  onClick?: () => void;
}

function StatCard({ label, value, color = "#24315f", onClick }: StatCardProps) {
  const style = {
    border: "1px solid #e5e7eb",
    borderLeft: `3px solid ${color}`,
    padding: "14px 16px",
    cursor: onClick ? "pointer" : "default",
  };
  return (
    <div
      className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow select-none"
      style={style}
      onClick={onClick}
      title={onClick ? `Filter by ${label}` : undefined}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#9bafc5" }}>{label}</p>
      <p className="text-2xl font-extrabold leading-none" style={{ color }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

// ─── Section Divider ─────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "#9bafc5" }}>
      {children}
    </h2>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function FulfillmentReport() {
  // ── Stage summary state ──
  const [stages,        setStages]        = useState<StageRow[]>([]);
  const [stagesLoading, setStagesLoading] = useState(true);
  const [stagesError,   setStagesError]   = useState<string | null>(null);
  const [stageOffset,   setStageOffset]   = useState(0);
  const [stageSortKey,  setStageSortKey]  = useState<string | undefined>(undefined);
  const [stageSortDir,  setStageSortDir]  = useState<"asc" | "desc">("asc");

  // ── Delivery detail state ──
  const [records,  setRecords]  = useState<DeliveryRecord[]>([]);
  const [total,    setTotal]    = useState(0);
  const [dlOffset, setDlOffset] = useState(0);
  const [status,   setStatus]   = useState("");
  const [dlLoading,setDlLoading]= useState(true);
  const [dlError,  setDlError]  = useState<string | null>(null);
  const [dlSortKey,setDlSortKey]= useState<string | undefined>(undefined);
  const [dlSortDir,setDlSortDir]= useState<"asc" | "desc">("asc");

  // ── Scroll ref for detail table ──
  const detailRef = useRef<HTMLDivElement>(null);

  // ─── Load stage summary (once) ───────────────────────────────────────────

  useEffect(() => {
    fetch("/api/reports/sales-by-stage", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setStages(d.stages ?? []); setStagesLoading(false); })
      .catch(() => { setStagesError("Failed to load stage summary."); setStagesLoading(false); });
  }, []);

  // ─── Sorted stage data (client-side) ─────────────────────────────────────

  const sortedStages = useMemo(() => {
    if (!stageSortKey) return stages;
    return [...stages].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (stageSortKey) {
        case "stage":     av = a.stageName;                                bv = b.stageName;                                break;
        case "total":     av = Number(a.total);                            bv = Number(b.total);                            break;
        case "delivered": av = Number(a.delivered);                        bv = Number(b.delivered);                        break;
        case "pending":   av = Number(a.pending);                          bv = Number(b.pending);                          break;
        case "cancelled": av = Number(a.cancelled);                        bv = Number(b.cancelled);                        break;
        case "pct":       av = pct(Number(a.delivered), Number(a.total));  bv = pct(Number(b.delivered), Number(b.total));  break;
        default: return 0;
      }
      if (av < bv) return stageSortDir === "asc" ? -1 : 1;
      if (av > bv) return stageSortDir === "asc" ? 1  : -1;
      return 0;
    });
  }, [stages, stageSortKey, stageSortDir]);

  const stagePage = sortedStages.slice(stageOffset, stageOffset + STAGE_PAGE_SIZE);

  // ─── Grand totals from stage data ────────────────────────────────────────

  const grandTotal    = stages.reduce((s, r) => s + Number(r.total),     0);
  const grandDelivered= stages.reduce((s, r) => s + Number(r.delivered), 0);
  const grandPending  = stages.reduce((s, r) => s + Number(r.pending),   0);
  const grandCancelled= stages.reduce((s, r) => s + Number(r.cancelled), 0);

  // ─── Load delivery detail ─────────────────────────────────────────────────

  const loadDelivery = useCallback((off: number, st: string, sk?: string, sd?: "asc" | "desc") => {
    setDlLoading(true); setDlError(null);
    const params = new URLSearchParams({ offset: String(off), limit: String(DELIVERY_PAGE_SIZE) });
    if (st) params.set("status", st);
    if (sk) params.set("sort_by", sk);
    if (sk && sd) params.set("sort_dir", sd);
    fetch(`/api/reports/delivery?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setRecords(d.records ?? []); setTotal(d.total ?? 0); setDlLoading(false); })
      .catch(() => { setDlError("Failed to load delivery records."); setDlLoading(false); });
  }, []);

  useEffect(() => { loadDelivery(0, ""); }, []);

  // ─── Helpers to change status filter + optionally scroll ─────────────────

  const scrollToDetail = () => {
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const applyStatusFilter = (st: string, scroll = false) => {
    setStatus(st);
    setDlOffset(0);
    loadDelivery(0, st, dlSortKey, dlSortDir);
    if (scroll) setTimeout(scrollToDetail, 80);
  };

  const handleDlSort = (key: string, dir: "asc" | "desc") => {
    setDlSortKey(key); setDlSortDir(dir); setDlOffset(0);
    loadDelivery(0, status, key, dir);
  };

  const handleDlPage = (off: number) => {
    setDlOffset(off);
    loadDelivery(off, status, dlSortKey, dlSortDir);
  };

  // ─── Stage table columns ──────────────────────────────────────────────────

  const stageColumns: ColumnDef<StageRow>[] = [
    {
      key: "stage",
      header: "Stage",
      sortKey: "stage",
      render: r => (
        <button
          className="text-left font-semibold hover:underline"
          style={{ color: "#24315f" }}
          onClick={() => applyStatusFilter("", true)}
          title="Show all delivery records for this stage"
        >
          {r.stageName}
        </button>
      ),
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
      render: r => (
        <button
          className="hover:underline tabular-nums"
          style={{ color: "#16a34a" }}
          onClick={() => applyStatusFilter("delivered", true)}
        >
          {Number(r.delivered).toLocaleString()}
        </button>
      ),
    },
    {
      key: "pending",
      header: "Pending",
      sortKey: "pending",
      align: "right",
      render: r => (
        <button
          className="hover:underline tabular-nums"
          style={{ color: "#d97706" }}
          onClick={() => applyStatusFilter("pending", true)}
        >
          {Number(r.pending).toLocaleString()}
        </button>
      ),
    },
    {
      key: "cancelled",
      header: "Cancelled",
      sortKey: "cancelled",
      align: "right",
      render: r => (
        <button
          className="hover:underline tabular-nums"
          style={{ color: "#dc2626" }}
          onClick={() => applyStatusFilter("cancelled", true)}
        >
          {Number(r.cancelled).toLocaleString()}
        </button>
      ),
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

  // ─── Delivery detail columns ──────────────────────────────────────────────

  const deliveryColumns: ColumnDef<DeliveryRecord>[] = [
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
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
          style={{
            background: `${statusColor(r.deliveryStatusCode)}18`,
            color: statusColor(r.deliveryStatusCode),
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(r.deliveryStatusCode) }} />
          {r.deliveryStatusName}
        </span>
      ) : (
        <span style={{ color: "#9bafc5" }}>—</span>
      ),
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-8 max-w-6xl">

      {/* Page header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs mb-1">
          <Link href="/orders" className="hover:underline" style={{ color: "#9bafc5" }}>Overview</Link>
          <span style={{ color: "#d1d5db" }}>›</span>
          <span style={{ color: "#9bafc5" }}>Fulfillment Report</span>
        </div>
        <div className="flex items-end justify-between">
          <h1 className="text-lg font-extrabold" style={{ color: "#24315f" }}>Fulfillment Report</h1>
          <span className="text-xs" style={{ color: "#9bafc5" }}>Click a stat card or stage row to filter the detail table below</span>
        </div>
      </div>

      {stagesError ? (
        <div className="p-4 rounded-xl text-sm" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
          {stagesError}
        </div>
      ) : (
        <>
          {/* ── Stat Cards ─────────────────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeading>Summary</SectionHeading>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Total NFTs"
                value={grandTotal}
                color="#24315f"
              />
              <StatCard
                label="Delivered"
                value={grandDelivered}
                color="#16a34a"
                onClick={() => applyStatusFilter("delivered", true)}
              />
              <StatCard
                label="Pending"
                value={grandPending}
                color="#d97706"
                onClick={() => applyStatusFilter("pending", true)}
              />
              <StatCard
                label="Cancelled"
                value={grandCancelled}
                color="#dc2626"
                onClick={() => applyStatusFilter("cancelled", true)}
              />
            </div>
          </section>

          {/* ── Stage Breakdown ─────────────────────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeading>Stage Breakdown</SectionHeading>
            <p className="text-xs" style={{ color: "#9bafc5" }}>
              Click any count in a row to pre-filter the delivery detail table below.
            </p>
            <DataTable
              columns={stageColumns}
              data={stagePage}
              total={sortedStages.length}
              offset={stageOffset}
              pageSize={STAGE_PAGE_SIZE}
              onPageChange={setStageOffset}
              loading={stagesLoading}
              emptyText="No stage data available"
              keyExtractor={r => r.stageId}
              sortKey={stageSortKey}
              sortDir={stageSortDir}
              onSort={(key, dir) => { setStageSortKey(key); setStageSortDir(dir); setStageOffset(0); }}
            />
          </section>
        </>
      )}

      {/* ── Delivery Detail ───────────────────────────────────────────────── */}
      <section className="space-y-3" ref={detailRef}>
        <div className="flex items-end justify-between">
          <SectionHeading>Delivery Detail</SectionHeading>
          <span className="text-xs" style={{ color: "#9bafc5" }}>{total.toLocaleString()} records</span>
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.code}
              onClick={() => applyStatusFilter(f.code)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: status === f.code ? "#24315f" : "#f3f4f6",
                color:      status === f.code ? "#fff"     : "#374151",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <DataTable
          columns={deliveryColumns}
          data={records}
          total={total}
          offset={dlOffset}
          pageSize={DELIVERY_PAGE_SIZE}
          onPageChange={handleDlPage}
          loading={dlLoading}
          error={dlError}
          emptyText="No delivery records found"
          keyExtractor={r => r.id}
          sortKey={dlSortKey}
          sortDir={dlSortDir}
          onSort={handleDlSort}
        />
      </section>

    </div>
  );
}
