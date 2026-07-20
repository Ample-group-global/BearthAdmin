"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import DataTable, { type ColumnDef } from "@/components/DataTable";

interface CustomerRow {
  id: string;
  userCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  createdAt: string;
  isActive: boolean;
  orderCount: number;
  nftCount: number;
  productCount: number;
}

const PAGE_SIZE = 20;

export default function CustomerReport() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total,     setTotal]     = useState(0);
  const [offset,    setOffset]    = useState(0);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [sortKey,   setSortKey]   = useState<string | undefined>(undefined);
  const [sortDir,   setSortDir]   = useState<"asc" | "desc">("asc");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback((off: number, q: string, sk?: string, sd?: "asc" | "desc") => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ offset: String(off), limit: String(PAGE_SIZE) });
    if (q) params.set("search", q);
    if (sk) params.set("sort_by", sk);
    if (sk && sd) params.set("sort_dir", sd);
    fetch(`/api/reports/customers?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setCustomers(d.customers ?? []); setTotal(d.total ?? 0); setLoading(false); })
      .catch(() => { setError("Failed to load report."); setLoading(false); });
  }, []);

  useEffect(() => { load(0, ""); }, []);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setOffset(0); load(0, v, sortKey, sortDir); }, 300);
  };
  const handleSort = (key: string, dir: "asc" | "desc") => { setSortKey(key); setSortDir(dir); setOffset(0); load(0, search, key, dir); };
  const handlePage = (off: number) => { setOffset(off); load(off, search, sortKey, sortDir); };

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString() : "—";

  const withOrders    = customers.filter(c => c.orderCount > 0).length;
  const totalNfts     = customers.reduce((s, c) => s + Number(c.nftCount), 0);
  const totalProducts = customers.reduce((s, c) => s + Number(c.productCount), 0);
  const convRate      = customers.length > 0 ? Math.round((withOrders / customers.length) * 100) : 0;

  const columns: ColumnDef<CustomerRow>[] = [
    {
      key: "code",
      header: "Code",
      sortKey: "user_code",
      render: r => <span className="font-mono text-xs font-semibold" style={{ color: "#24315f" }}>{r.userCode ?? "—"}</span>,
    },
    {
      key: "name",
      header: "Name",
      sortKey: "name",
      render: r => <span className="font-medium" style={{ color: "#374151" }}>{r.firstName} {r.lastName}</span>,
    },
    {
      key: "email",
      header: "Email",
      sortKey: "email",
      render: r => <span className="text-xs" style={{ color: "#6b7280" }}>{r.email}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      render: r => <span className="text-xs" style={{ color: "#6b7280" }}>{r.phone ?? "—"}</span>,
    },
    {
      key: "orders",
      header: "Total Orders",
      sortKey: "orders",
      align: "center",
      render: r => <span className="font-bold" style={{ color: Number(r.orderCount) > 0 ? "#24315f" : "#9bafc5" }}>{Number(r.orderCount)}</span>,
    },
    {
      key: "nfts",
      header: "NFT Items",
      sortKey: "nfts",
      align: "center",
      render: r => <span className="font-bold" style={{ color: Number(r.nftCount) > 0 ? "#24315f" : "#9bafc5" }}>{Number(r.nftCount)}</span>,
    },
    {
      key: "products",
      header: "Product Items",
      sortKey: "products",
      align: "center",
      render: r => <span className="font-bold" style={{ color: Number(r.productCount) > 0 ? "#24315f" : "#9bafc5" }}>{Number(r.productCount)}</span>,
    },
    {
      key: "status",
      header: "Status",
      sortKey: "is_active",
      align: "center",
      render: r => (
        <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${r.isActive ? "text-green-700" : "text-red-600"}`}
          style={{ background: r.isActive ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)" }}>
          {r.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "joined",
      header: "Joined",
      sortKey: "created_at",
      render: r => <span className="text-xs" style={{ color: "#6b7280" }}>{fmtDate(r.createdAt)}</span>,
    },
  ];

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div>
        <div className="flex items-center gap-1.5 text-xs mb-1">
          <Link href="/orders" className="hover:underline" style={{ color: "#9bafc5" }}>Overview</Link>
          <span style={{ color: "#d1d5db" }}>›</span>
          <span style={{ color: "#9bafc5" }}>Customer Report</span>
        </div>
        <div className="flex items-end justify-between">
          <h1 className="text-lg font-extrabold" style={{ color: "#24315f" }}>Customer Report</h1>
          <span className="text-xs" style={{ color: "#9bafc5" }}>{total.toLocaleString()} customers</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Customers",  value: total,         color: "#24315f", sub: `${convRate}% conversion` },
          { label: "With Orders",      value: withOrders,    color: "#41afeb", href: "/orders" },
          { label: "NFT Items Bought", value: totalNfts,     color: "#7c3aed", href: "/nft/records" },
          { label: "Product Items",    value: totalProducts, color: "#16a34a", href: "/products" },
        ].map(m => {
          const inner = (
            <>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#9bafc5" }}>{m.label}</p>
              <p className="text-2xl font-extrabold leading-none" style={{ color: m.color }}>{typeof m.value === "number" ? m.value.toLocaleString() : m.value}</p>
              {"sub" in m && m.sub && <p className="text-xs mt-1.5" style={{ color: "#9bafc5" }}>{m.sub}</p>}
            </>
          );
          const cardStyle = { border: "1px solid #e5e7eb", borderLeft: `3px solid ${m.color}`, padding: "16px 18px" };
          return "href" in m && m.href ? (
            <Link key={m.label} href={m.href} className="block bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow" style={cardStyle}>{inner}</Link>
          ) : (
            <div key={m.label} className="bg-white rounded-xl shadow-sm" style={cardStyle}>{inner}</div>
          );
        })}
      </div>

      <div className="relative max-w-sm">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" placeholder="Search by name, email, or code…" value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none bg-white"
          style={{ border: "1px solid #e5e7eb", color: "#111827" }} />
      </div>

      <DataTable
        columns={columns}
        data={customers}
        total={total}
        offset={offset}
        pageSize={PAGE_SIZE}
        onPageChange={handlePage}
        loading={loading}
        error={error}
        emptyText="No customers found"
        keyExtractor={r => r.id}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />
    </div>
  );
}
