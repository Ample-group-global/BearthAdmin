"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function SalesByStage() {
  const [stages, setStages] = useState<StageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/presale/reports/sales-by-stage", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setStages(d.stages ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load report."); setLoading(false); });
  }, []);

  const grandTotal = stages.reduce((s, r) => s + Number(r.total), 0);

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/presale/reports" className="text-sm font-medium hover:underline" style={{ color: "#9bafc5" }}>Reports</Link>
        <span style={{ color: "#d1d5db" }}>›</span>
        <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Sales by Stage</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16" style={{ color: "#9bafc5" }}>
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading…
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl text-sm" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total NFTs", value: grandTotal },
              { label: "Delivered",  value: stages.reduce((s, r) => s + Number(r.delivered), 0), color: "#16a34a" },
              { label: "Pending",    value: stages.reduce((s, r) => s + Number(r.pending),   0), color: "#d97706" },
              { label: "Cancelled",  value: stages.reduce((s, r) => s + Number(r.cancelled), 0), color: "#dc2626" },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-2xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>{c.label}</p>
                <p className="text-2xl font-bold" style={{ color: c.color ?? "#24315f" }}>{c.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  {["Stage", "Total", "Delivered", "Pending", "Cancelled", "% Delivered"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stages.map((s, i) => (
                  <tr key={s.stageId} style={{ borderBottom: i < stages.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: "#24315f" }}>{s.stageName}</td>
                    <td className="px-4 py-3 font-bold" style={{ color: "#374151" }}>{Number(s.total).toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: "#16a34a" }}>{Number(s.delivered).toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: "#d97706" }}>{Number(s.pending).toLocaleString()}</td>
                    <td className="px-4 py-3" style={{ color: "#dc2626" }}>{Number(s.cancelled).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "#f3f4f6", minWidth: 60 }}>
                          <div className="h-full rounded-full" style={{ width: `${pct(Number(s.delivered), Number(s.total))}%`, background: "#16a34a" }} />
                        </div>
                        <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>{pct(Number(s.delivered), Number(s.total))}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {stages.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-8 text-sm" style={{ color: "#9bafc5" }}>No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
