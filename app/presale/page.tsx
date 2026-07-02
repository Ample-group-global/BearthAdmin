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

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: color ?? "#24315f" }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>{sub}</p>}
    </div>
  );
}

function statusColor(code: string): string {
  const c = code?.toLowerCase();
  if (c === "confirmed" || c === "paid" || c === "delivered") return "#16a34a";
  if (c === "pending") return "#d97706";
  if (c === "cancelled" || c === "canceled") return "#dc2626";
  if (c === "received") return "#2563eb";
  return "#6b7280";
}

export default function PresaleOverviewPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/presale/reports", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load report data.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="flex items-center gap-3" style={{ color: "#9bafc5" }}>
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading overview...
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
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>Bearth Overview</h1>
        <p className="text-sm mt-0.5" style={{ color: "#9bafc5" }}>Live summary of all Bearth activity</p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Orders" value={data.orders.total.toLocaleString()} />
        <StatCard label="Total Customers" value={data.customers.total.toLocaleString()} sub={`${data.customers.withOrders} with orders`} />
        <StatCard label="NFT Records" value={data.nft.total.toLocaleString()} />
        <StatCard label="Products" value={data.products.total.toLocaleString()} sub={`${data.products.active} active`} />
      </div>

      {/* Revenue section */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider mb-3" style={{ color: "#9bafc5" }}>Revenue</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="NFT Revenue (TWD)"
            value={`TWD ${(data.orders.totalNftTwd ?? 0).toLocaleString()}`}
            color="#41afeb"
          />
          <StatCard
            label="NFT Revenue (ETH)"
            value={`${data.orders.totalNftEth ?? 0} ETH`}
            color="#41afeb"
          />
          <StatCard
            label="Merch Revenue (TWD)"
            value={`TWD ${(data.orders.totalMerchTwd ?? 0).toLocaleString()}`}
            color="#41afeb"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by payment status */}
        <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: "#24315f" }}>Orders by Payment Status</h2>
          {data.orders.byNftStatus && data.orders.byNftStatus.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th className="pb-2 text-left font-semibold" style={{ color: "#9bafc5" }}>Status</th>
                  <th className="pb-2 text-right font-semibold" style={{ color: "#9bafc5" }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {data.orders.byNftStatus.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td className="py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          background: `${statusColor(s.statusCode)}18`,
                          color: statusColor(s.statusCode),
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: statusColor(s.statusCode) }} />
                        {s.statusName}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-semibold" style={{ color: "#24315f" }}>{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-center py-6" style={{ color: "#9bafc5" }}>No data available</p>
          )}
        </div>

        {/* NFT delivery status */}
        <div className="bg-white rounded-2xl p-5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: "#24315f" }}>NFT Delivery Status</h2>
          {data.nft.byDeliveryStatus && data.nft.byDeliveryStatus.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th className="pb-2 text-left font-semibold" style={{ color: "#9bafc5" }}>Status</th>
                  <th className="pb-2 text-right font-semibold" style={{ color: "#9bafc5" }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {data.nft.byDeliveryStatus.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td className="py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          background: `${statusColor(s.statusCode)}18`,
                          color: statusColor(s.statusCode),
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: statusColor(s.statusCode) }} />
                        {s.statusName}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-semibold" style={{ color: "#24315f" }}>{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-center py-6" style={{ color: "#9bafc5" }}>No data available</p>
          )}
        </div>

        {/* Reconciliation by status */}
        <div className="bg-white rounded-2xl p-5 shadow-sm lg:col-span-2" style={{ border: "1px solid #e5e7eb" }}>
          <h2 className="text-sm font-bold mb-4" style={{ color: "#24315f" }}>Reconciliation Summary</h2>
          {data.reconciliation.byStatus && data.reconciliation.byStatus.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <th className="pb-2 text-left font-semibold" style={{ color: "#9bafc5" }}>Status</th>
                  <th className="pb-2 text-right font-semibold" style={{ color: "#9bafc5" }}>Count</th>
                  <th className="pb-2 text-right font-semibold" style={{ color: "#9bafc5" }}>Total TWD</th>
                  <th className="pb-2 text-right font-semibold" style={{ color: "#9bafc5" }}>Total ETH</th>
                </tr>
              </thead>
              <tbody>
                {data.reconciliation.byStatus.map((s, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td className="py-2.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          background: `${statusColor(s.status)}18`,
                          color: statusColor(s.status),
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: statusColor(s.status) }} />
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-semibold" style={{ color: "#24315f" }}>{s.count}</td>
                    <td className="py-2.5 text-right" style={{ color: "#6b7280" }}>TWD {(s.totalTwd ?? 0).toLocaleString()}</td>
                    <td className="py-2.5 text-right" style={{ color: "#6b7280" }}>{s.totalEth ?? 0} ETH</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-center py-6" style={{ color: "#9bafc5" }}>No data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
