"use client";

import { useEffect, useState } from "react";

interface ReportData {
  orders: {
    total: number;
    totalNftTwd: number;
    totalNftEth: number;
    totalMerchTwd: number;
    byNftStatus: Array<{ statusName: string; statusCode: string; count: number }>;
  };
  customers: {
    total: number;
    withOrders: number;
  };
  nft: {
    total: number;
    byDeliveryStatus: Array<{ statusName: string; statusCode: string; count: number }>;
  };
  products: {
    total: number;
    active: number;
  };
  reconciliation: {
    byStatus: Array<{ status: string; count: number; totalTwd: number; totalEth: number }>;
  };
}

function statusColor(code: string): string {
  const c = (code ?? "").toLowerCase();
  if (c === "confirmed" || c === "paid" || c === "delivered" || c === "received") return "#16a34a";
  if (c === "pending") return "#d97706";
  if (c === "cancelled" || c === "canceled") return "#dc2626";
  return "#6b7280";
}

function RevenueCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(65,175,235,0.1)" }}>
          <svg className="w-4 h-4" style={{ color: "#41afeb" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9bafc5" }}>{label}</p>
      </div>
      <p className="text-2xl font-bold" style={{ color: "#24315f" }}>{value}</p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{sub}</p>}
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
      <h2 className="text-sm font-bold mb-4" style={{ color: "#24315f" }}>{title}</h2>
      {children}
    </div>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/presale/reports", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load reports.");
        setLoading(false);
      });
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="flex items-center gap-3" style={{ color: "#9bafc5" }}>
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading reports...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-4 space-y-4 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Reports</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Summary statistics for all Bearth activity</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-white"
          style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>Total Orders</p>
          <p className="text-3xl font-bold" style={{ color: "#24315f" }}>{data.orders.total.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>Customers</p>
          <p className="text-3xl font-bold" style={{ color: "#24315f" }}>{data.customers.total.toLocaleString()}</p>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{data.customers.withOrders} with orders</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>NFT Records</p>
          <p className="text-3xl font-bold" style={{ color: "#24315f" }}>{data.nft.total.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>Products</p>
          <p className="text-3xl font-bold" style={{ color: "#24315f" }}>{data.products.total.toLocaleString()}</p>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{data.products.active} active</p>
        </div>
      </div>

      {/* Revenue */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#9bafc5" }}>Revenue Summary</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <RevenueCard
            label="NFT Revenue (TWD)"
            value={`TWD ${(data.orders.totalNftTwd ?? 0).toLocaleString()}`}
          />
          <RevenueCard
            label="NFT Revenue (ETH)"
            value={`${data.orders.totalNftEth ?? 0} ETH`}
          />
          <RevenueCard
            label="Merch Revenue (TWD)"
            value={`TWD ${(data.orders.totalMerchTwd ?? 0).toLocaleString()}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Status */}
        <SectionCard title="Orders by Payment Status">
          {data.orders.byNftStatus && data.orders.byNftStatus.length > 0 ? (
            <div className="space-y-3">
              {data.orders.byNftStatus.map((s, i) => {
                const color = statusColor(s.statusCode);
                const maxCount = Math.max(...data.orders.byNftStatus.map((x) => x.count));
                const pct = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                        <span className="text-sm" style={{ color: "#374151" }}>{s.statusName}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: "#24315f" }}>{s.count}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#f3f4f6" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-center py-4" style={{ color: "#9bafc5" }}>No data</p>
          )}
        </SectionCard>

        {/* NFT Delivery Status */}
        <SectionCard title="NFT Delivery Breakdown">
          {data.nft.byDeliveryStatus && data.nft.byDeliveryStatus.length > 0 ? (
            <div className="space-y-3">
              {data.nft.byDeliveryStatus.map((s, i) => {
                const color = statusColor(s.statusCode);
                const maxCount = Math.max(...data.nft.byDeliveryStatus.map((x) => x.count));
                const pct = maxCount > 0 ? (s.count / maxCount) * 100 : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
                        <span className="text-sm" style={{ color: "#374151" }}>{s.statusName}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: "#24315f" }}>{s.count}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "#f3f4f6" }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-center py-4" style={{ color: "#9bafc5" }}>No data</p>
          )}
        </SectionCard>

        {/* Customer Stats */}
        <SectionCard title="Customer Statistics">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>Total Registered</p>
              <p className="text-2xl font-bold" style={{ color: "#24315f" }}>{data.customers.total.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>With Orders</p>
              <p className="text-2xl font-bold" style={{ color: "#24315f" }}>{data.customers.withOrders.toLocaleString()}</p>
            </div>
            <div className="p-4 rounded-xl col-span-2" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>Conversion Rate</p>
              <p className="text-2xl font-bold" style={{ color: "#24315f" }}>
                {data.customers.total > 0
                  ? `${Math.round((data.customers.withOrders / data.customers.total) * 100)}%`
                  : "—"}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Reconciliation */}
        <SectionCard title="Reconciliation Summary">
          {data.reconciliation.byStatus && data.reconciliation.byStatus.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th className="pb-2 text-left font-semibold" style={{ color: "#9bafc5" }}>Status</th>
                  <th className="pb-2 text-right font-semibold" style={{ color: "#9bafc5" }}>Count</th>
                  <th className="pb-2 text-right font-semibold" style={{ color: "#9bafc5" }}>TWD</th>
                  <th className="pb-2 text-right font-semibold" style={{ color: "#9bafc5" }}>ETH</th>
                </tr>
              </thead>
              <tbody>
                {data.reconciliation.byStatus.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td className="py-2.5">
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: `${statusColor(s.status)}18`, color: statusColor(s.status) }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(s.status) }} />
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-semibold" style={{ color: "#24315f" }}>{s.count}</td>
                    <td className="py-2.5 text-right text-xs" style={{ color: "#6b7280" }}>
                      TWD {(s.totalTwd ?? 0).toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right text-xs" style={{ color: "#6b7280" }}>
                      {s.totalEth ?? 0} ETH
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-center py-4" style={{ color: "#9bafc5" }}>No data</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
