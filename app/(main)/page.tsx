"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ReportData {
  orders?: {
    total: number;
    nftOrderCount: number;
    productOrderCount: number;
    bothOrderCount: number;
    totalNftTwd: number;
    totalNftEth: number;
    totalMerchTwd: number;
    byNftStatus: Array<{ statusName: string; statusCode: string; count: number }>;
    byMerchStatus?: Array<{ statusName: string; statusCode: string; count: number }>;
  };
  customers?: { total: number; withOrders: number };
  nft?: {
    total: number;
    orderedCount: number;
    byDeliveryStatus: Array<{ statusName: string; statusCode: string; count: number }>;
  };
  products?: { total: number; active: number; orderedCount: number };
  reconciliation?: {
    byStatus: Array<{ status: string; count: number; totalTwd: number; totalEth: number }>;
  };
}

function statusColor(code: string): string {
  const c = (code ?? "").toLowerCase();
  if (c === "confirmed" || c === "paid" || c === "delivered") return "#16a34a";
  if (c === "pending") return "#d97706";
  if (c === "cancelled" || c === "canceled") return "#dc2626";
  if (c === "received") return "#2563eb";
  return "#6b7280";
}

function KpiCard({ label, value, sub, color = "#24315f", href, tiny }: {
  label: string; value: string | number; sub?: string;
  color?: string; href?: string; tiny?: boolean;
}) {
  const inner = (
    <>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: "#9bafc5" }}>{label}</p>
      <p className={`font-extrabold leading-none ${tiny ? "text-lg" : "text-2xl"}`} style={{ color }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-xs mt-1.5" style={{ color: "#9bafc5" }}>{sub}</p>}
    </>
  );
  const style = { border: "1px solid #e5e7eb", borderLeft: `3px solid ${color}`, padding: "14px 16px" };
  if (href) return <Link href={href} className="block bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow" style={style}>{inner}</Link>;
  return <div className="bg-white rounded-xl shadow-sm" style={style}>{inner}</div>;
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: "#9bafc5" }}>{label}</span>
      <div className="flex-1 h-px" style={{ background: "#e5e7eb" }} />
    </div>
  );
}

function PurchasePanel({
  type, color, icon, orderCount, itemCount, revenueTwd, revenueEth, statusData, statusLinkBase, ordersLink, itemsLink, statusParam,
}: {
  type: string; color: string; icon: React.ReactNode;
  orderCount: number; itemCount: number;
  revenueTwd: number; revenueEth?: number;
  statusData: Array<{ statusName: string; statusCode: string; count: number }>;
  statusLinkBase: string;
  ordersLink: string;
  itemsLink: string;
  statusParam: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden" style={{ border: `1px solid #e5e7eb`, borderTop: `3px solid ${color}` }}>
      <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid #f3f4f6" }}>
        <span style={{ color }}>{icon}</span>
        <h3 className="text-sm font-extrabold" style={{ color: "#24315f" }}>{type}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-x" style={{ borderBottom: "1px solid #f3f4f6" }}>
        {[
          { label: "Orders",        value: orderCount,                           href: ordersLink },
          { label: "Items Sold",    value: itemCount,                            href: itemsLink },
          { label: "Revenue (TWD)", value: `TWD ${revenueTwd.toLocaleString()}`, href: ordersLink },
        ].map(m => (
          <Link key={m.label} href={m.href}
            className="px-4 py-3 text-center transition-colors hover:bg-gray-50 cursor-pointer block">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#9bafc5" }}>{m.label}</p>
            <p className="text-lg font-extrabold" style={{ color }}>{typeof m.value === "number" ? m.value.toLocaleString() : m.value}</p>
          </Link>
        ))}
      </div>
      {revenueEth != null && (
        <div className="px-4 py-2 text-center" style={{ borderBottom: "1px solid #f3f4f6", background: `${color}06` }}>
          <span className="text-xs font-bold" style={{ color }}>+ {revenueEth} ETH</span>
        </div>
      )}
      {statusData.length > 0 && (
        <div className="px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#9bafc5" }}>Payment Status</p>
          <div className="space-y-1.5">
            {statusData.map((s, i) => (
              <Link key={i} href={`${statusLinkBase}?${statusParam}=${s.statusCode}`}
                className="flex items-center justify-between hover:bg-gray-50 rounded px-1 py-0.5 transition-colors">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: statusColor(s.statusCode) }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(s.statusCode) }} />
                  {s.statusName}
                </span>
                <span className="text-xs font-bold" style={{ color: "#24315f" }}>{s.count}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OverviewPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/reports", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load report data."); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="flex items-center gap-3" style={{ color: "#9bafc5" }}>
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading overview…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const orders         = data.orders         ?? { total: 0, nftOrderCount: 0, productOrderCount: 0, bothOrderCount: 0, totalNftTwd: 0, totalNftEth: 0, totalMerchTwd: 0, byNftStatus: [], byMerchStatus: [] };
  const customers      = data.customers      ?? { total: 0, withOrders: 0 };
  const nft            = data.nft            ?? { total: 0, orderedCount: 0, byDeliveryStatus: [] };
  const products       = data.products       ?? { total: 0, active: 0, orderedCount: 0 };
  const reconciliation = data.reconciliation ?? { byStatus: [] };
  const nftOrdered  = nft.orderedCount  ?? 0;
  const prodOrdered = products.orderedCount ?? 0;

  const nftIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
  const productIcon = (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );

  return (
    <div className="p-6 space-y-6 max-w-6xl">

      <div>
        <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>Bearth Overview</h1>
        <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Live summary of all Bearth activity</p>
      </div>

      <div>
        <SectionDivider label="Summary" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total Orders"          value={orders.total}    color="#24315f" href="/orders"      sub={`${orders.bothOrderCount ?? 0} with both types`} />
          <KpiCard label="Total Customers"        value={customers.total} color="#24315f" href="/customers"   sub={`${customers.withOrders} with orders`} />
          <KpiCard label="NFT Items in Stock"     value={nft.total}       color="#7c3aed" href="/nft/records" />
          <KpiCard label="Products in Catalog"    value={products.total}  color="#41afeb" href="/products"    sub={`${products.active} active`} />
        </div>
      </div>

      <div>
        <SectionDivider label="Purchase Breakdown" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <PurchasePanel
            type="NFT Purchases"
            color="#7c3aed"
            icon={nftIcon}
            orderCount={orders.nftOrderCount ?? 0}
            itemCount={nftOrdered}
            revenueTwd={orders.totalNftTwd ?? 0}
            revenueEth={orders.totalNftEth ?? 0}
            statusData={orders.byNftStatus ?? []}
            statusLinkBase="/orders"
            ordersLink="/orders?nft_status=all"
            itemsLink="/nft/records"
            statusParam="nft_status"
          />
          <PurchasePanel
            type="Bearth Product Purchases"
            color="#41afeb"
            icon={productIcon}
            orderCount={orders.productOrderCount ?? 0}
            itemCount={prodOrdered}
            revenueTwd={orders.totalMerchTwd ?? 0}
            statusData={orders.byMerchStatus ?? []}
            statusLinkBase="/orders"
            ordersLink="/orders?merch_status=all"
            itemsLink="/products"
            statusParam="merch_status"
          />
        </div>
      </div>

      <div>
        <SectionDivider label="NFT Delivery" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl p-5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#24315f" }}>NFT Delivery Status</h3>
            {nft.byDeliveryStatus?.length > 0 ? (
              <div className="space-y-1.5">
                {nft.byDeliveryStatus.map((s, i) => (
                  <Link key={i} href={`/nft/records?delivery_status=${s.statusCode}`}
                    className="flex items-center justify-between hover:bg-gray-50 rounded px-1 py-1.5 transition-colors">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: statusColor(s.statusCode) }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(s.statusCode) }} />
                      {s.statusName}
                    </span>
                    <span className="text-xs font-bold" style={{ color: "#24315f" }}>{s.count}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-center py-4" style={{ color: "#9bafc5" }}>No data</p>}
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#24315f" }}>Reconciliation Summary</h3>
            {reconciliation.byStatus?.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <th className="pb-2 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Status</th>
                    <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Count</th>
                    <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>TWD</th>
                    <th className="pb-2 text-right text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>ETH</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliation.byStatus.map((s, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid #f9fafb" }}>
                      <td className="py-2">
                        <span className="inline-flex items-center gap-1.5 font-semibold"
                          style={{ color: statusColor(s.status) }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor(s.status) }} />
                          {s.status}
                        </span>
                      </td>
                      <td className="py-2 text-right font-bold" style={{ color: "#24315f" }}>{s.count}</td>
                      <td className="py-2 text-right" style={{ color: "#6b7280" }}>{(s.totalTwd ?? 0).toLocaleString()}</td>
                      <td className="py-2 text-right" style={{ color: "#6b7280" }}>{s.totalEth ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="text-sm text-center py-4" style={{ color: "#9bafc5" }}>No data</p>}
          </div>
        </div>
      </div>

      <div>
        <SectionDivider label="Detailed Reports" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: "/reports/sales-by-stage", label: "Sales by Stage",  icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
            { href: "/reports/delivery",        label: "Delivery Report", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
            { href: "/reports/reconciliation",  label: "Reconciliation",  icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" },
            { href: "/reports/customers",       label: "Customer Report", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
          ].map(r => (
            <Link key={r.href} href={r.href}
              className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow group"
              style={{ border: "1px solid #e5e7eb" }}>
              <span className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(65,175,235,0.08)" }}>
                <svg className="w-4 h-4" style={{ color: "#41afeb" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={r.icon} />
                </svg>
              </span>
              <span className="text-xs font-semibold flex-1" style={{ color: "#24315f" }}>{r.label}</span>
              <svg className="w-3.5 h-3.5 flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: "#d1d5db" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}
