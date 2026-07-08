"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

interface Referrer {
  id: string;
  referrerCode: string;
  firstName: string;
  lastName: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  roleCode: string;
  referredCount: number;
  referrerName?: string | null;
}

interface ReferrerForm {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
}

interface ReferredPerson {
  id: string;
  userCode: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  roleCode: string;
  createdAt: string;
}

type SortKey = "name" | "referrerCode" | "referredCount" | "roleCode" | "referrerName";
type SortDir = "asc" | "desc";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl flex flex-col" style={{ width: "100%", maxWidth: 480, maxHeight: "90vh", border: "1px solid #e5e7eb" }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>{title}</h2>
          <button onClick={onClose} style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="inline-flex flex-col ml-1" style={{ gap: 1, verticalAlign: "middle" }}>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
        <path d="M4 0L8 5H0L4 0Z" fill={active && dir === "asc" ? "#41afeb" : "#d1d5db"} />
      </svg>
      <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
        <path d="M4 5L0 0H8L4 5Z" fill={active && dir === "desc" ? "#41afeb" : "#d1d5db"} />
      </svg>
    </span>
  );
}

function ReferredModal({ referrer, onClose }: { referrer: Referrer; onClose: () => void }) {
  const [list, setList] = useState<ReferredPerson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/presale/referrers/${referrer.id}/referred`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setList(d.referred ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [referrer.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl flex flex-col" style={{ width: "100%", maxWidth: 560, maxHeight: "80vh", border: "1px solid #e5e7eb" }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Referred by {referrer.name}</h2>
            <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{referrer.referrerCode} · {referrer.referredCount} referred</p>
          </div>
          <button onClick={onClose} style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-32" style={{ color: "#9bafc5" }}>
              <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading…
            </div>
          ) : list.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm" style={{ color: "#9bafc5" }}>No referrals found.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ padding: "8px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9bafc5", textTransform: "uppercase", letterSpacing: "0.05em" }}>#</th>
                  <th style={{ padding: "8px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9bafc5", textTransform: "uppercase", letterSpacing: "0.05em" }}>Name</th>
                  <th style={{ padding: "8px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9bafc5", textTransform: "uppercase", letterSpacing: "0.05em" }}>Code</th>
                  <th style={{ padding: "8px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9bafc5", textTransform: "uppercase", letterSpacing: "0.05em" }}>Contact</th>
                  <th style={{ padding: "8px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#9bafc5", textTransform: "uppercase", letterSpacing: "0.05em" }}>Since</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p, i) => (
                  <tr key={p.id} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                    <td style={{ padding: "9px 16px", color: "#9bafc5", fontSize: 12 }}>{i + 1}</td>
                    <td style={{ padding: "9px 16px", fontWeight: 600, color: "#111827" }}>{p.name}</td>
                    <td style={{ padding: "9px 16px" }}>
                      <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "rgba(65,175,235,0.08)", color: "#41afeb" }}>{p.userCode}</span>
                    </td>
                    <td style={{ padding: "9px 16px" }}>
                      {p.email && <div className="text-xs" style={{ color: "#374151" }}>{p.email}</div>}
                      {p.phone && <div className="text-xs" style={{ color: "#9bafc5" }}>{p.phone}</div>}
                      {!p.email && !p.phone && <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>
                    <td style={{ padding: "9px 16px", fontSize: 12, color: "#9bafc5", whiteSpace: "nowrap" }}>
                      {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", color: "#111827", outline: "none" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: "11px", fontWeight: 700, color: "#9bafc5", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" };
const EMPTY: ReferrerForm = { firstName: "", lastName: "", phone: "", email: "" };
const PAGE_SIZES = [10, 20, 50];

function roleBadge(code: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    bearth_admin:        { bg: "rgba(124,58,237,0.1)",  color: "#7c3aed", label: "Admin" },
    bearth_operation:    { bg: "rgba(59,130,246,0.1)",  color: "#3b82f6", label: "Operation" },
    bearth_sales_team:   { bg: "rgba(16,185,129,0.1)",  color: "#10b981", label: "Sales Team" },
    bearth_technical:    { bg: "rgba(245,158,11,0.1)",  color: "#f59e0b", label: "Technical" },
    bearth_ext_referrer: { bg: "rgba(239,68,68,0.1)",   color: "#ef4444", label: "Ext. Referrer" },
    bearth_customer:     { bg: "rgba(107,114,128,0.1)", color: "#6b7280", label: "Customer" },
  };
  const style = map[code] ?? { bg: "rgba(107,114,128,0.1)", color: "#6b7280", label: code };
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: style.bg, color: style.color }}>
      {style.label}
    </span>
  );
}

function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "…", total];
  if (current >= total - 3) return [1, "…", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "…", current - 1, current, current + 1, "…", total];
}

export default function ReferrersPage() {
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | null>(null);
  const [form, setForm] = useState<ReferrerForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [referredModal, setReferredModal] = useState<Referrer | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/presale/referrers`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setReferrers(d.referrers ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
    setPage(1);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return referrers.filter(r =>
      !q ||
      r.name.toLowerCase().includes(q) ||
      (r.email ?? "").toLowerCase().includes(q) ||
      (r.phone ?? "").includes(q) ||
      r.referrerCode.toLowerCase().includes(q)
    );
  }, [referrers, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av: string | number = a[sortKey] ?? "";
      let bv: string | number = b[sortKey] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(pageStart, pageStart + pageSize);

  useEffect(() => { setPage(1); }, [search, pageSize]);

  const handleSave = async () => {
    if (!form.firstName.trim()) { setError("First name is required."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/presale/referrers", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName || null, phone: form.phone || null, email: form.email || null }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Save failed."); return; }
      setModal(null); setForm(EMPTY); load();
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  };

  const f = (field: keyof ReferrerForm, val: string) => setForm(prev => ({ ...prev, [field]: val }));

  const thStyle = (key: SortKey, align: "left" | "center" = "left"): React.CSSProperties => ({
    fontSize: 11, fontWeight: 700, color: sortKey === key ? "#41afeb" : "#9bafc5",
    textTransform: "uppercase", letterSpacing: "0.05em",
    padding: "10px 14px", textAlign: align,
    borderBottom: "1px solid #e5e7eb", background: "#f9fafb",
    cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
  });

  const thFixedStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#9bafc5",
    textTransform: "uppercase", letterSpacing: "0.05em",
    padding: "10px 14px", textAlign: "center",
    borderBottom: "1px solid #e5e7eb", background: "#f9fafb",
    whiteSpace: "nowrap",
  };

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>Referrers</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{filtered.length} referrer{filtered.length !== 1 ? "s" : ""} · all roles who can refer customers</p>
        </div>
        <button onClick={() => { setForm(EMPTY); setError(null); setModal("create"); }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white rounded-xl" style={{ background: "#41afeb" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Ext. Referrer
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, phone, code…"
          className="px-3 py-2 text-sm rounded-xl outline-none placeholder:text-[#c4d0de]"
          style={{ border: "1px solid #e5e7eb", minWidth: 260, color: "#111827" }} />
        {search && (
          <button onClick={() => setSearch("")} className="px-3 py-2 text-xs rounded-xl bg-white" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Clear</button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40" style={{ color: "#9bafc5" }}>
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading…
        </div>
      ) : sorted.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center" style={{ border: "1px solid #e5e7eb" }}>
          <p className="text-sm font-medium" style={{ color: "#9bafc5" }}>{search ? "No referrers match your search." : "No referrers yet."}</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th style={thFixedStyle}>#</th>
                  <th style={thStyle("name")} onClick={() => handleSort("name")}>
                    Referrer <SortIcon active={sortKey === "name"} dir={sortDir} />
                  </th>
                  <th style={thStyle("referrerCode")} onClick={() => handleSort("referrerCode")}>
                    Code <SortIcon active={sortKey === "referrerCode"} dir={sortDir} />
                  </th>
                  <th style={thStyle("referredCount", "center")} onClick={() => handleSort("referredCount")}>
                    Referred <SortIcon active={sortKey === "referredCount"} dir={sortDir} />
                  </th>
                  <th style={thStyle("referrerName")} onClick={() => handleSort("referrerName")}>
                    Referred By <SortIcon active={sortKey === "referrerName"} dir={sortDir} />
                  </th>
                  <th style={thStyle("roleCode")} onClick={() => handleSort("roleCode")}>
                    Role <SortIcon active={sortKey === "roleCode"} dir={sortDir} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={r.id} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 14px", textAlign: "center", color: "#9bafc5", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>
                      {pageStart + i + 1}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div className="font-semibold" style={{ color: "#111827" }}>{r.name}</div>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "rgba(65,175,235,0.08)", color: "#41afeb" }}>{r.referrerCode}</span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      {r.referredCount > 0 ? (
                        <button
                          onClick={() => setReferredModal(r)}
                          className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold transition-opacity hover:opacity-70"
                          style={{ background: "rgba(65,175,235,0.12)", color: "#41afeb", minWidth: 28, cursor: "pointer" }}>
                          {r.referredCount}
                        </button>
                      ) : (
                        <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {r.referrerName
                        ? <span className="text-xs font-medium" style={{ color: "#374151" }}>{r.referrerName}</span>
                        : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 14px" }}>{roleBadge(r.roleCode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-xs" style={{ color: "#9bafc5" }}>
              <span>Rows per page:</span>
              {PAGE_SIZES.map(s => (
                <button key={s} onClick={() => setPageSize(s)}
                  className="px-2.5 py-1 rounded-lg font-semibold transition-colors"
                  style={{
                    background: pageSize === s ? "#24315f" : "#f3f4f6",
                    color: pageSize === s ? "#fff" : "#6b7280",
                    border: "1px solid " + (pageSize === s ? "#24315f" : "#e5e7eb"),
                  }}>
                  {s}
                </button>
              ))}
              <span style={{ marginLeft: 8 }}>
                {pageStart + 1}–{Math.min(pageStart + pageSize, sorted.length)} of {sorted.length}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="flex items-center justify-center rounded-lg transition-colors"
                style={{ width: 32, height: 32, border: "1px solid #e5e7eb", background: "#fff", color: safePage === 1 ? "#d1d5db" : "#6b7280" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {pageNumbers(safePage, totalPages).map((n, i) =>
                n === "…" ? (
                  <span key={`e${i}`} style={{ width: 32, textAlign: "center", color: "#9bafc5", fontSize: 13 }}>…</span>
                ) : (
                  <button key={n} onClick={() => setPage(n)}
                    className="flex items-center justify-center rounded-lg text-xs font-semibold transition-colors"
                    style={{
                      width: 32, height: 32,
                      background: safePage === n ? "#24315f" : "#fff",
                      color: safePage === n ? "#fff" : "#6b7280",
                      border: "1px solid " + (safePage === n ? "#24315f" : "#e5e7eb"),
                    }}>
                    {n}
                  </button>
                )
              )}

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="flex items-center justify-center rounded-lg transition-colors"
                style={{ width: 32, height: 32, border: "1px solid #e5e7eb", background: "#fff", color: safePage === totalPages ? "#d1d5db" : "#6b7280" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      {referredModal && (
        <ReferredModal referrer={referredModal} onClose={() => setReferredModal(null)} />
      )}

      {modal === "create" && (
        <Modal title="New External Referrer" onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>First Name *</label>
                <input value={form.firstName} onChange={e => f("firstName", e.target.value)} style={inputStyle} placeholder="First name" />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input value={form.lastName} onChange={e => f("lastName", e.target.value)} style={inputStyle} placeholder="Last name" />
              </div>
              <div>
                <label style={labelStyle}>Phone</label>
                <input value={form.phone} onChange={e => f("phone", e.target.value)} style={inputStyle} placeholder="+886 …" />
              </div>
              <div>
                <label style={labelStyle}>Email</label>
                <input value={form.email} onChange={e => f("email", e.target.value)} type="email" style={inputStyle} placeholder="email@…" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-bold text-white rounded-lg" style={{ background: saving ? "#9bafc5" : "#41afeb" }}>{saving ? "Saving…" : "Create Referrer"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
