"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";

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
}

const PAGE_SIZE = 100;

export default function CustomerReport() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total,     setTotal]     = useState(0);
  const [offset,    setOffset]    = useState(0);
  const [search,    setSearch]    = useState("");
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = (off: number, q: string) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ offset: String(off), limit: String(PAGE_SIZE) });
    if (q) params.set("search", q);
    fetch(`/api/presale/reports/customers?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setCustomers(d.customers ?? []); setTotal(d.total ?? 0); setLoading(false); })
      .catch(() => { setError("Failed to load report."); setLoading(false); });
  };

  useEffect(() => { load(0, ""); }, []);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setOffset(0); load(0, v); }, 300);
  };

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString() : "—";

  const convRate = total > 0
    ? Math.round((customers.filter(c => c.orderCount > 0).length / customers.length) * 100)
    : 0;

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link href="/presale/reports" className="text-sm font-medium hover:underline" style={{ color: "#9bafc5" }}>Reports</Link>
        <span style={{ color: "#d1d5db" }}>›</span>
        <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Customer Report</h1>
        <span className="ml-auto text-sm" style={{ color: "#9bafc5" }}>{total.toLocaleString()} customers</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: total },
          { label: "With Orders",     value: customers.filter(c => c.orderCount > 0).length },
          { label: "Total NFTs",      value: customers.reduce((s, c) => s + Number(c.nftCount), 0) },
          { label: "Conversion Rate", value: `${convRate}%` },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>{m.label}</p>
            <p className="text-2xl font-bold" style={{ color: "#24315f" }}>{typeof m.value === "number" ? m.value.toLocaleString() : m.value}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Search by name, email, or code…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none bg-white"
          style={{ border: "1px solid #e5e7eb", color: "#111827" }}
        />
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
                  {["Code", "Name", "Email", "Phone", "Orders", "NFTs", "Status", "Joined"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: i < customers.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: "#24315f" }}>{c.userCode ?? "—"}</td>
                    <td className="px-4 py-3 font-medium" style={{ color: "#374151" }}>{c.firstName} {c.lastName}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#6b7280" }}>{c.email}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#6b7280" }}>{c.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-center font-bold" style={{ color: Number(c.orderCount) > 0 ? "#24315f" : "#9bafc5" }}>{Number(c.orderCount)}</td>
                    <td className="px-4 py-3 text-center font-bold" style={{ color: Number(c.nftCount) > 0 ? "#24315f" : "#9bafc5" }}>{Number(c.nftCount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${c.isActive ? "text-green-700" : "text-red-600"}`}
                        style={{ background: c.isActive ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)" }}>
                        {c.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "#6b7280" }}>{fmtDate(c.createdAt)}</td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-8 text-sm" style={{ color: "#9bafc5" }}>No customers found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setOffset(Math.max(0, offset - PAGE_SIZE)); load(Math.max(0, offset - PAGE_SIZE), search); }}
            disabled={offset === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ border: "1px solid #e5e7eb", color: offset === 0 ? "#9bafc5" : "#24315f", cursor: offset === 0 ? "not-allowed" : "pointer" }}
          >Previous</button>
          <span className="text-sm" style={{ color: "#9bafc5" }}>{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}</span>
          <button
            onClick={() => { setOffset(offset + PAGE_SIZE); load(offset + PAGE_SIZE, search); }}
            disabled={offset + PAGE_SIZE >= total}
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ border: "1px solid #e5e7eb", color: offset + PAGE_SIZE >= total ? "#9bafc5" : "#24315f", cursor: offset + PAGE_SIZE >= total ? "not-allowed" : "pointer" }}
          >Next</button>
        </div>
      )}
    </div>
  );
}
