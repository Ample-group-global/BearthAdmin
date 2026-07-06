"use client";

import React from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColumnDef<T> {
  key: string;
  header: string;
  width?: number | string;
  align?: "left" | "center" | "right";
  render: (row: T, rowIndex: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns:      ColumnDef<T>[];
  data:         T[];
  total:        number;
  offset:       number;
  pageSize:     number;
  onPageChange: (newOffset: number) => void;
  loading?:     boolean;
  error?:       string | null;
  emptyText?:   string;
  keyExtractor: (row: T) => string | number;
}

// ─── Pagination helper ────────────────────────────────────────────────────────

function buildPages(current: number, totalPages: number): Array<number | "…"> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: Array<number | "…"> = [];
  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, "…", totalPages);
  } else if (current >= totalPages - 3) {
    pages.push(1, "…", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
  } else {
    pages.push(1, "…", current - 1, current, current + 1, "…", totalPages);
  }
  return pages;
}

// ─── DataTable component ──────────────────────────────────────────────────────

export default function DataTable<T>({
  columns,
  data,
  total,
  offset,
  pageSize,
  onPageChange,
  loading = false,
  error = null,
  emptyText = "No records found",
  keyExtractor,
}: DataTableProps<T>) {
  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages  = Math.ceil(total / pageSize);
  const rangeStart  = total === 0 ? 0 : offset + 1;
  const rangeEnd    = Math.min(offset + pageSize, total);

  const thBase: React.CSSProperties = {
    fontSize: "11px", fontWeight: 700, color: "#9bafc5",
    textTransform: "uppercase", letterSpacing: "0.06em",
    padding: "10px 14px", borderBottom: "1px solid #e5e7eb",
    background: "#f9fafb", whiteSpace: "nowrap",
  };

  const btnBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    height: 34, borderRadius: 8, fontSize: 12, fontWeight: 600,
    transition: "all 0.15s ease", cursor: "pointer",
  };

  return (
    <div className="space-y-3">

      {/* ── Error banner ── */}
      {error && (
        <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2"
          style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Table card ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div className="flex items-center justify-center h-52" style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading…
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-52 gap-3">
            <svg className="w-10 h-10" style={{ color: "#e5e7eb" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium" style={{ color: "#9bafc5" }}>{emptyText}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr>
                  <th style={{ ...thBase, width: 52, textAlign: "center" }}>Sr.</th>
                  {columns.map(col => (
                    <th key={col.key} style={{
                      ...thBase,
                      textAlign: col.align ?? "left",
                      width: col.width,
                    }}>
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={keyExtractor(row)}
                    style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td style={{ padding: "10px 14px", textAlign: "center",
                      fontSize: 12, color: "#9bafc5", fontWeight: 600 }}>
                      {offset + i + 1}
                    </td>
                    {columns.map(col => (
                      <td key={col.key} style={{
                        padding: "10px 14px",
                        textAlign: col.align ?? "left",
                      }}>
                        {col.render(row, i)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-3 px-1">

          {/* Range info */}
          <span className="text-xs font-medium" style={{ color: "#9bafc5" }}>
            Showing{" "}
            <strong style={{ color: "#374151" }}>{rangeStart}</strong>
            {" – "}
            <strong style={{ color: "#374151" }}>{rangeEnd}</strong>
            {" of "}
            <strong style={{ color: "#374151" }}>{total}</strong>
          </span>

          {/* Page buttons */}
          <div className="flex items-center gap-1">

            {/* Prev */}
            <button
              onClick={() => onPageChange(Math.max(0, offset - pageSize))}
              disabled={currentPage === 1}
              style={{
                ...btnBase,
                gap: 4, padding: "0 12px",
                border: "1.5px solid",
                borderColor: currentPage === 1 ? "#f3f4f6" : "#e5e7eb",
                color: currentPage === 1 ? "#d1d5db" : "#374151",
                background: currentPage === 1 ? "#fafafa" : "white",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
              }}>
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>

            {/* Page numbers */}
            {buildPages(currentPage, totalPages).map((p, idx) =>
              p === "…" ? (
                <span key={`e-${idx}`}
                  style={{
                    width: 34, height: 34, lineHeight: "34px",
                    textAlign: "center", fontSize: 13, color: "#9bafc5",
                    userSelect: "none", display: "inline-block",
                  }}>
                  ···
                </span>
              ) : (
                <button
                  key={p}
                  onClick={() => onPageChange((p - 1) * pageSize)}
                  style={{
                    ...btnBase,
                    width: 34,
                    border: p === currentPage ? "none" : "1.5px solid #e5e7eb",
                    background: p === currentPage ? "#41afeb" : "white",
                    color: p === currentPage ? "white" : "#374151",
                    cursor: "pointer",
                    fontWeight: p === currentPage ? 800 : 500,
                    boxShadow: p === currentPage ? "0 2px 8px rgba(65,175,235,0.4)" : "none",
                  }}>
                  {p}
                </button>
              )
            )}

            {/* Next */}
            <button
              onClick={() => onPageChange(Math.min((totalPages - 1) * pageSize, offset + pageSize))}
              disabled={currentPage === totalPages}
              style={{
                ...btnBase,
                gap: 4, padding: "0 12px",
                border: "1.5px solid",
                borderColor: currentPage === totalPages ? "#f3f4f6" : "#e5e7eb",
                color: currentPage === totalPages ? "#d1d5db" : "#374151",
                background: currentPage === totalPages ? "#fafafa" : "white",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
              }}>
              Next
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>

          </div>

          {/* Page counter */}
          <span className="text-xs font-medium" style={{ color: "#9bafc5" }}>
            Page{" "}
            <strong style={{ color: "#374151" }}>{currentPage}</strong>
            {" / "}
            <strong style={{ color: "#374151" }}>{totalPages}</strong>
          </span>

        </div>
      )}

      {/* Single page hint */}
      {totalPages <= 1 && total > 0 && (
        <div className="text-xs text-right px-1" style={{ color: "#9bafc5" }}>
          Showing all <strong style={{ color: "#374151" }}>{total}</strong> records
        </div>
      )}
    </div>
  );
}
