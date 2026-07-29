"use client";

import { useEffect, useState, useRef } from "react";
import DataTable, { type ColumnDef } from "@/components/DataTable";

interface Customer {
  id: string;
  userCode: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  email: string;
  lineId: string;
  referrerId: string | null;
  referrerName: string | null;
  walletCount: number;
  isActive: boolean;
  createdAt: string;
  totalCount: number;
}

interface Referrer {
  id: string;
  referrerCode: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  email: string;
  roleCode: string;
}

interface Wallet {
  id: string;
  address: string;
  isWhitelisted: boolean;
  addedAt: string;
}

const PAGE_SIZE = 20;

function truncateAddress(addr: string) {
  if (!addr || addr.length <= 16) return addr;
  return addr.slice(0, 8) + "…" + addr.slice(-6);
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showInactive, setShowInactive] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Create / Edit customer modal
  const [showModal, setShowModal] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [modalMaximized, setModalMaximized] = useState(false);
  const [modalMinimized, setModalMinimized] = useState(false);

  // Wallet modal
  const [walletCustomer, setWalletCustomer] = useState<Customer | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [walletsError, setWalletsError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Referrer dropdown
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [referrersLoading, setReferrersLoading] = useState(false);
  const [showAddReferrer, setShowAddReferrer] = useState(false);
  const [newReferrer, setNewReferrer] = useState({ firstName: "", lastName: "", phone: "", email: "" });
  const [addingReferrer, setAddingReferrer] = useState(false);
  const [addReferrerError, setAddReferrerError] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const referrerBtnRef = useRef<HTMLButtonElement>(null);
  const referrerPanelRef = useRef<HTMLDivElement>(null);
  const [referrerDropOpen, setReferrerDropOpen] = useState(false);
  const [referrerSearch, setReferrerSearch] = useState("");
  const [referrerPanelStyle, setReferrerPanelStyle] = useState<React.CSSProperties>({});

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    lineId: "",
    referrerId: "",
    notes: "",
  });

  const loadCustomers = (q: string, off: number, sb = sortKey, sd = sortDir, inactive = showInactive) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ search: q, limit: String(PAGE_SIZE), offset: String(off), sort_by: sb, sort_dir: sd });
    if (inactive) params.set("active", "false");
    fetch(`/api/customers?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCustomers(data.customers ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load customers."); setLoading(false); });
  };

  useEffect(() => { loadCustomers(search, offset, sortKey, sortDir, showInactive); }, [offset, sortKey, sortDir, showInactive]);

  useEffect(() => {
    if (!referrerDropOpen) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (referrerBtnRef.current?.contains(t) || referrerPanelRef.current?.contains(t)) return;
      setReferrerDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [referrerDropOpen]);

  const handleSort = (key: string, dir: "asc" | "desc") => {
    setSortKey(key);
    setSortDir(dir);
    setOffset(0);
    loadCustomers(search, 0, key, dir, showInactive);
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setOffset(0); loadCustomers(v, 0); }, 300);
  };

  const loadReferrers = () => {
    setReferrersLoading(true);
    fetch("/api/referrers", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setReferrers(d.referrers ?? []); })
      .catch(() => {})
      .finally(() => setReferrersLoading(false));
  };

  const openCreate = () => {
    setEditCustomer(null);
    setForm({ firstName: "", lastName: "", phone: "", email: "", lineId: "", referrerId: "", notes: "" });
    setFormError(null);
    setShowAddReferrer(false);
    setAddReferrerError(null);
    setNewReferrer({ firstName: "", lastName: "", phone: "", email: "" });
    setReferrerDropOpen(false);
    setReferrerSearch("");
    setModalMaximized(false);
    setModalMinimized(false);
    loadReferrers();
    setShowModal(true);
  };

  const openEdit = (c: Customer) => {
    setEditCustomer(c);
    setForm({ firstName: c.firstName ?? "", lastName: c.lastName ?? "", phone: c.phone ?? "", email: c.email ?? "", lineId: c.lineId ?? "", referrerId: c.referrerId ?? "", notes: "" });
    setFormError(null);
    setShowAddReferrer(false);
    setAddReferrerError(null);
    setNewReferrer({ firstName: "", lastName: "", phone: "", email: "" });
    setReferrerDropOpen(false);
    setReferrerSearch("");
    setModalMaximized(false);
    setModalMinimized(false);
    loadReferrers();
    setShowModal(true);
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_RE = /^[+\d\s\-().]{6,20}$/;

  const hasContact = () => !!(form.phone.trim() || form.email.trim() || form.lineId.trim());

  const validateForm = (): string | null => {
    if (!form.firstName.trim()) return "First name is required.";
    if (!form.lastName.trim()) return "Last name is required.";
    if (!hasContact()) return "At least one contact method is required: Phone, Email, or LINE ID.";
    if (form.phone.trim() && !PHONE_RE.test(form.phone.trim()))
      return "Phone number is not valid (digits, +, spaces, dashes — 6 to 20 characters).";
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim()))
      return "Email address is not valid.";
    return null;
  };

  const handleSave = async () => {
    setFormError(null);
    const clientError = validateForm();
    if (clientError) { setFormError(clientError); return; }
    setSaving(true);
    try {
      const body: Record<string, string | undefined> = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        lineId: form.lineId.trim() || undefined,
        referrerId: form.referrerId || undefined,
        notes: form.notes.trim() || undefined,
      };
      const url = editCustomer ? `/api/customers/${editCustomer.id}` : "/api/customers";
      const method = editCustomer ? "PUT" : "POST";
      const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? "Save failed."); return; }
      setShowModal(false);
      loadCustomers(search, offset);
    } catch { setFormError("Network error."); }
    finally { setSaving(false); }
  };

  const handleToggleActive = async (c: Customer) => {
    setTogglingId(c.id);
    setConfirmToggle(null);
    try {
      const res = await fetch(`/api/customers/${c.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Status update failed."); return; }
      setCustomers((prev) => prev.map((x) => x.id === c.id ? { ...x, isActive: !c.isActive } : x));
    } catch { setError("Network error."); }
    finally { setTogglingId(null); }
  };

  // Wallet modal
  const openWallets = async (c: Customer) => {
    setWalletCustomer(c);
    setWallets([]);
    setWalletsError(null);
    setWalletsLoading(true);
    try {
      const res = await fetch(`/api/customers/${c.id}/wallets`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) { setWalletsError(data.error ?? "Failed to load wallets."); }
      else { setWallets(data.wallets ?? []); }
    } catch { setWalletsError("Network error."); }
    finally { setWalletsLoading(false); }
  };

  const inputStyle = { width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "14px", color: "#111827", outline: "none" };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: 600, color: "#24315f", marginBottom: "4px" };

  const columns: ColumnDef<Customer>[] = [
    { key: "user_code",   header: "Customer Code", sortKey: "user_code",     render: (c) => <span className="font-mono text-xs font-semibold" style={{ color: "#41afeb" }}>{c.userCode ?? "N/A"}</span> },
    { key: "first_name",  header: "First Name",    sortKey: "first_name",    render: (c) => <span className="font-medium" style={{ color: "#111827" }}>{c.firstName || "N/A"}</span> },
    { key: "last_name",   header: "Last Name",     sortKey: "last_name",     render: (c) => <span style={{ color: "#6b7280" }}>{c.lastName || "N/A"}</span> },
    { key: "full_name",   header: "Full Name",     sortKey: "full_name",     render: (c) => <span className="font-medium" style={{ color: "#111827" }}>{`${c.firstName} ${c.lastName}`.trim() || "N/A"}</span> },
    { key: "phone",       header: "Phone",                                   render: (c) => <span style={{ color: "#6b7280" }}>{c.phone || "N/A"}</span> },
    { key: "email",       header: "Email",         sortKey: "email",         render: (c) => <span style={{ color: "#6b7280" }}>{c.email || "N/A"}</span> },
    { key: "line_id",     header: "LINE ID",       sortKey: "line_id",       render: (c) => <span style={{ color: "#6b7280" }}>{c.lineId || "N/A"}</span> },
    { key: "referrer",    header: "Referrer",      sortKey: "referrer_name", render: (c) => <span style={{ color: "#6b7280" }}>{c.referrerName?.trim() || "N/A"}</span> },
    {
      key: "wallets", header: "Wallets", sortKey: "wallet_count", align: "center",
      render: (c) => (
        <button
          onClick={() => openWallets(c)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors"
          style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(65,175,235,0.2)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(65,175,235,0.1)")}
          title="View wallets"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
          {c.walletCount ?? 0}
        </button>
      ),
    },
    {
      key: "created_at", header: "Joined", sortKey: "created_at", align: "center",
      render: (c) => <span className="text-xs" style={{ color: "#6b7280" }}>{c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "N/A"}</span>,
    },
    {
      key: "is_active", header: "Active", sortKey: "is_active", align: "center",
      render: (c) => (
        <button
          onClick={() => handleToggleActive(c)}
          disabled={togglingId === c.id}
          title={c.isActive !== false ? "Click to deactivate" : "Click to activate"}
          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold transition-opacity"
          style={{
            opacity: togglingId === c.id ? 0.5 : 1,
            cursor: togglingId === c.id ? "wait" : "pointer",
            ...(c.isActive !== false
              ? { background: "rgba(22,163,74,0.1)", color: "#16a34a" }
              : { background: "rgba(156,163,175,0.1)", color: "#9ca3af" })
          }}
        >
          {togglingId === c.id ? "…" : c.isActive !== false ? "Active" : "Inactive"}
        </button>
      ),
    },
    {
      key: "actions", header: "Actions", align: "center",
      render: (c) => (
        <button
          onClick={() => openEdit(c)}
          className="p-1.5 rounded-lg"
          style={{ color: "#41afeb" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(65,175,235,0.1)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          title="Edit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
      ),
    },
  ];

  const filteredReferrers = referrers.filter((r) => {
    const q = referrerSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      r.referrerCode.toLowerCase().includes(q) ||
      r.firstName.toLowerCase().includes(q) ||
      r.lastName.toLowerCase().includes(q) ||
      (r.phone ?? "").includes(q) ||
      (r.email ?? "").toLowerCase().includes(q)
    );
  });

  const toggleReferrerDrop = () => {
    if (referrersLoading) return;
    if (!referrerDropOpen && referrerBtnRef.current) {
      const rect = referrerBtnRef.current.getBoundingClientRect();
      const panelWidth = Math.min(rect.width, 672);
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      if (spaceBelow >= 200 || spaceBelow >= spaceAbove) {
        setReferrerPanelStyle({
          position: "fixed",
          top: rect.bottom + 4,
          left: rect.left,
          width: panelWidth,
          maxHeight: Math.max(spaceBelow - 4, 120),
          zIndex: 200,
        });
      } else {
        setReferrerPanelStyle({
          position: "fixed",
          bottom: window.innerHeight - rect.top + 4,
          left: rect.left,
          width: panelWidth,
          maxHeight: Math.max(spaceAbove - 4, 120),
          zIndex: 200,
        });
      }
    }
    setReferrerDropOpen((v) => !v);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>Bearth Customers</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Manage and view all registered customers</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
          style={{ background: "#41afeb" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#2e9fd8")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#41afeb")}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Customer
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#111827" }}
          />
        </div>
        <button
          onClick={() => { setShowInactive((v) => !v); setOffset(0); }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
          style={showInactive
            ? { background: "rgba(156,163,175,0.15)", color: "#6b7280", border: "1px solid #d1d5db" }
            : { background: "transparent", color: "#9bafc5", border: "1px solid #e5e7eb" }}
        >
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: showInactive ? "#9ca3af" : "#16a34a" }} />
          {showInactive ? "All customers" : "Active only"}
        </button>
        <span className="text-sm" style={{ color: "#9bafc5" }}>
          {total > 0 ? `${total} customer${total !== 1 ? "s" : ""}` : "0 results"}
        </span>
      </div>

      <DataTable
        columns={columns}
        data={customers}
        total={total}
        offset={offset}
        pageSize={PAGE_SIZE}
        onPageChange={(off) => { setOffset(off); loadCustomers(search, off); }}
        loading={loading}
        error={error}
        emptyText="No customers found"
        keyExtractor={(c) => c.id}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
      />

      {/* ── Wallet Modal ─────────────────────────────────────────────── */}
      {walletCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl">
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #e5e7eb" }}>
              <div>
                <h2 className="text-base font-bold" style={{ color: "#24315f" }}>Wallets</h2>
                <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                  {walletCustomer.name || `${walletCustomer.firstName} ${walletCustomer.lastName}`.trim()} · {walletCustomer.userCode}
                </p>
              </div>
              <button onClick={() => setWalletCustomer(null)} style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Wallet list */}
            <div className="px-6 py-4 space-y-3 max-h-96 overflow-y-auto">
              {walletsError && (
                <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>{walletsError}</div>
              )}
              {walletsLoading ? (
                <div className="flex items-center justify-center h-20" style={{ color: "#9bafc5" }}>
                  <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </div>
              ) : wallets.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: "#9bafc5" }}>No wallets linked yet</p>
              ) : (
                <table className="w-full text-sm min-w-max [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:border-r [&_th]:border-gray-100 [&_td]:border-r [&_td]:border-gray-100 [&_th]:py-2 [&_th]:px-3 [&_td]:py-2 [&_td]:px-3">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <th className="pb-2 text-left text-xs font-semibold" style={{ color: "#9bafc5" }}>Wallet Address</th>
                      <th className="pb-2 text-center text-xs font-semibold" style={{ color: "#9bafc5" }}>Whitelist</th>
                      <th className="pb-2 text-right text-xs font-semibold" style={{ color: "#9bafc5" }}>Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallets.map((w) => (
                      <tr key={w.id} style={{ borderBottom: "1px solid #f9fafb" }}>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs" style={{ color: "#24315f" }}>
                              {w.address}
                            </span>
                            <button
                              onClick={() => {
                                navigator.clipboard?.writeText(w.address);
                                setCopiedId(w.id);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors"
                              style={copiedId === w.id
                                ? { background: "rgba(22,163,74,0.1)", color: "#16a34a" }
                                : { background: "rgba(65,175,235,0.08)", color: "#41afeb" }}
                              title="Copy address"
                            >
                              {copiedId === w.id ? (
                                <>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Copied
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  Copy
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-2 text-center">
                          {w.isWhitelisted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Listed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(156,163,175,0.1)", color: "#9ca3af" }}>
                              Not Listed
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right text-xs" style={{ color: "#9bafc5" }}>
                          {w.addedAt ? new Date(w.addedAt).toLocaleDateString() : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── Create/Edit Modal ─────────────────────────────────────────── */}
      {showModal && (
        <div
          className={
            modalMinimized
              ? "fixed bottom-4 right-4 z-50"
              : modalMaximized
              ? "fixed inset-0 z-50"
              : "fixed inset-0 z-50 flex items-center justify-center p-4"
          }
          style={!modalMinimized && !modalMaximized ? { background: "rgba(0,0,0,0.4)" } : {}}
        >
          <div
            className="bg-white shadow-xl flex flex-col"
            style={{
              width: modalMinimized ? "320px" : "100%",
              maxWidth: modalMinimized ? "320px" : modalMaximized ? "100%" : "672px",
              maxHeight: modalMinimized ? "none" : modalMaximized ? "100vh" : "90vh",
              height: modalMaximized && !modalMinimized ? "100vh" : "auto",
              borderRadius: modalMaximized && !modalMinimized ? 0 : "16px",
            }}
          >
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
              <h2
                className="text-base font-bold"
                style={{ color: "#24315f", cursor: modalMinimized ? "pointer" : "default" }}
                onClick={() => { if (modalMinimized) setModalMinimized(false); }}
                title={modalMinimized ? "Restore" : undefined}
              >
                {editCustomer ? "Edit Customer" : "New Customer"}
              </h2>
              <div className="flex items-center gap-0.5">
                {/* Minimize / Restore-up */}
                <button
                  onClick={() => { setModalMinimized((v) => !v); if (!modalMinimized) setModalMaximized(false); }}
                  title={modalMinimized ? "Restore" : "Minimize"}
                  className="p-1.5 rounded-md"
                  style={{ color: "#9bafc5" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "#6b7280"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9bafc5"; }}
                >
                  {modalMinimized ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="4" y="19" width="16" height="2" rx="1" />
                    </svg>
                  )}
                </button>
                {/* Maximize / Restore-down */}
                {!modalMinimized && (
                  <button
                    onClick={() => setModalMaximized((v) => !v)}
                    title={modalMaximized ? "Restore" : "Maximize"}
                    className="p-1.5 rounded-md"
                    style={{ color: "#9bafc5" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#f3f4f6"; e.currentTarget.style.color = "#6b7280"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9bafc5"; }}
                  >
                    {modalMaximized ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 14l6-6m0 0h-5m5 0v5M20 10l-6 6m0 0h5m-5 0v-5" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3h6m0 0v6m0-6l-7 7M9 21H3m0 0v-6m0 6l7-7" />
                      </svg>
                    )}
                  </button>
                )}
                {/* Close */}
                <button
                  onClick={() => setShowModal(false)}
                  title="Close"
                  className="p-1.5 rounded-md"
                  style={{ color: "#9bafc5" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; e.currentTarget.style.color = "#dc2626"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#9bafc5"; }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1" style={{ display: modalMinimized ? "none" : undefined }}>
              <div className={`space-y-4${modalMaximized ? " max-w-3xl mx-auto w-full" : ""}`}>
              {formError && (
                <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#24315f" }}>First Name <span style={{ color: "#dc2626" }}>*</span></label>
                  <input
                    type="text" value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    placeholder="First name"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: !form.firstName.trim() && formError ? "1px solid #dc2626" : "1px solid #e5e7eb" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#24315f" }}>Last Name <span style={{ color: "#dc2626" }}>*</span></label>
                  <input
                    type="text" value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    placeholder="Last name"
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: !form.lastName.trim() && formError ? "1px solid #dc2626" : "1px solid #e5e7eb" }}
                  />
                </div>
              </div>
              {/* Contact group — at least one required */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{ color: "#24315f" }}>
                    Contact <span style={{ color: "#dc2626" }}>*</span>
                    <span className="font-normal ml-1" style={{ color: "#9bafc5" }}>(at least one required)</span>
                  </span>
                  {formError && !hasContact() && (
                    <span className="text-xs" style={{ color: "#dc2626" }}>Fill in at least one</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#9bafc5" }}>Phone</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      style={{ ...inputStyle, border: (!hasContact() && formError) || (form.phone.trim() && !PHONE_RE.test(form.phone.trim())) ? "1px solid #dc2626" : "1px solid #e5e7eb" }}
                      placeholder="+886 912..."
                    />
                    {form.phone.trim() && !PHONE_RE.test(form.phone.trim()) && (
                      <p className="text-xs mt-1" style={{ color: "#dc2626" }}>Invalid format</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#9bafc5" }}>Email</label>
                    <input
                      type="text" value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      style={{ ...inputStyle, border: (!hasContact() && formError) || (form.email.trim() && !EMAIL_RE.test(form.email.trim())) ? "1px solid #dc2626" : "1px solid #e5e7eb" }}
                      placeholder="name@example.com"
                    />
                    {form.email.trim() && !EMAIL_RE.test(form.email.trim()) && (
                      <p className="text-xs mt-1" style={{ color: "#dc2626" }}>Invalid format</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "#9bafc5" }}>LINE ID</label>
                    <input
                      value={form.lineId}
                      onChange={(e) => setForm({ ...form, lineId: e.target.value })}
                      style={{ ...inputStyle, border: !hasContact() && formError ? "1px solid #dc2626" : "1px solid #e5e7eb" }}
                      placeholder="LINE ID"
                    />
                  </div>
                </div>
              </div>
              {/* Referrer dropdown */}
              <div>
                <label style={labelStyle}>Referrer</label>
                {/* Trigger */}
                <button
                  ref={referrerBtnRef}
                  type="button"
                  onClick={toggleReferrerDrop}
                  disabled={referrersLoading}
                  style={{
                    ...inputStyle,
                    background: "#fff",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: referrersLoading ? "not-allowed" : "pointer",
                  }}
                >
                  <span style={{
                    color: referrers.find(r => r.id === form.referrerId) ? "#111827" : "#9bafc5",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {referrersLoading ? "Loading referrers…" : (() => {
                      const sel = referrers.find(r => r.id === form.referrerId);
                      return sel
                        ? `${sel.referrerCode} — ${`${sel.firstName} ${sel.lastName}`.trim()}`
                        : "— No referrer —";
                    })()}
                  </span>
                  <svg
                    className="w-4 h-4 flex-shrink-0 ml-2"
                    style={{ color: "#9bafc5", transform: referrerDropOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Role label */}
                {form.referrerId && (() => {
                  const sel = referrers.find((r) => r.id === form.referrerId);
                  if (!sel) return null;
                  const roleLabels: Record<string, string> = {
                    admin:          "Bearth Admin",
                    operation:      "Bearth Operation",
                    technical_team: "Bearth Technical Team",
                    sales_team:     "Bearth Sales Team",
                    ext_referrer:   "Bearth Ext-Referrer",
                    customer:       "Bearth Customer",
                  };
                  return (
                    <p className="text-xs mt-1.5" style={{ color: "#9bafc5" }}>
                      Role: <span className="font-semibold" style={{ color: "#24315f" }}>{roleLabels[sel.roleCode] ?? sel.roleCode}</span>
                    </p>
                  );
                })()}

                {/* Dropdown panel — fixed to escape modal overflow clipping */}
                {referrerDropOpen && (
                  <div
                    ref={referrerPanelRef}
                    style={{
                      ...referrerPanelStyle,
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {/* Search input */}
                    <div style={{ padding: "8px", borderBottom: "1px solid #f3f4f6", flexShrink: 0 }}>
                      <div style={{ position: "relative" }}>
                        <svg
                          className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2"
                          style={{ color: "#9bafc5" }}
                          fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          autoFocus
                          type="text"
                          value={referrerSearch}
                          onChange={(e) => setReferrerSearch(e.target.value)}
                          placeholder="Search by name, code, phone…"
                          className="w-full outline-none"
                          style={{ ...inputStyle, paddingLeft: "28px", fontSize: "13px" }}
                        />
                      </div>
                    </div>
                    {/* Options list */}
                    <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
                      {/* Clear option */}
                      <button
                        type="button"
                        onClick={() => { setForm((f) => ({ ...f, referrerId: "" })); setReferrerDropOpen(false); setReferrerSearch(""); setShowAddReferrer(false); }}
                        className="w-full text-left"
                        style={{ padding: "8px 12px", fontSize: "13px", color: "#9bafc5", background: !form.referrerId ? "rgba(65,175,235,0.06)" : "transparent", border: "none", cursor: "pointer", display: "block" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = !form.referrerId ? "rgba(65,175,235,0.06)" : "transparent")}
                      >
                        — No referrer —
                      </button>
                      {filteredReferrers.length === 0 && referrerSearch.trim() ? (
                        <div style={{ padding: "12px", fontSize: "13px", color: "#9bafc5", textAlign: "center" }}>No referrers found</div>
                      ) : filteredReferrers.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => { setForm((f) => ({ ...f, referrerId: r.id })); setReferrerDropOpen(false); setReferrerSearch(""); setShowAddReferrer(false); }}
                          className="w-full text-left"
                          style={{ padding: "8px 12px", fontSize: "13px", color: "#111827", background: form.referrerId === r.id ? "rgba(65,175,235,0.08)" : "transparent", border: "none", cursor: "pointer", display: "block" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = form.referrerId === r.id ? "rgba(65,175,235,0.08)" : "transparent")}
                        >
                          <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#41afeb", fontWeight: 600 }}>{r.referrerCode}</span>
                          {" — "}
                          {`${r.firstName} ${r.lastName}`.trim()}
                        </button>
                      ))}
                    </div>
                    {/* Add external referrer */}
                    <div style={{ borderTop: "1px solid #f3f4f6", flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => { setShowAddReferrer(true); setForm((f) => ({ ...f, referrerId: "" })); setReferrerDropOpen(false); setReferrerSearch(""); }}
                        className="w-full text-left"
                        style={{ padding: "8px 12px", fontSize: "13px", color: "#41afeb", fontWeight: 600, background: "transparent", border: "none", cursor: "pointer", display: "block" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f9ff")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        + Register new external referrer…
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {/* Inline add-referrer form */}
              {showAddReferrer && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "#0369a1" }}>New External Referrer</p>
                    <p className="text-xs mt-0.5" style={{ color: "#0369a1", opacity: 0.7 }}>Bearth team members already appear above. Use this only for external referrers.</p>
                  </div>
                  {addReferrerError && <p className="text-xs" style={{ color: "#dc2626" }}>{addReferrerError}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "#24315f" }}>First Name *</label>
                      <input value={newReferrer.firstName} onChange={(e) => setNewReferrer((r) => ({ ...r, firstName: e.target.value }))} style={inputStyle} placeholder="First name" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "#24315f" }}>Last Name</label>
                      <input value={newReferrer.lastName} onChange={(e) => setNewReferrer((r) => ({ ...r, lastName: e.target.value }))} style={inputStyle} placeholder="Last name" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "#24315f" }}>Phone</label>
                      <input value={newReferrer.phone} onChange={(e) => setNewReferrer((r) => ({ ...r, phone: e.target.value }))} style={inputStyle} placeholder="Phone" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "#24315f" }}>Email</label>
                      <input type="email" value={newReferrer.email} onChange={(e) => setNewReferrer((r) => ({ ...r, email: e.target.value }))} style={inputStyle} placeholder="Email" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setShowAddReferrer(false); setAddReferrerError(null); }} className="px-3 py-1.5 text-xs font-medium rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
                    <button
                      disabled={addingReferrer || !newReferrer.firstName.trim()}
                      onClick={async () => {
                        setAddingReferrer(true);
                        setAddReferrerError(null);
                        try {
                          const res = await fetch("/api/referrers", {
                            method: "POST",
                            credentials: "include",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ firstName: newReferrer.firstName, lastName: newReferrer.lastName, phone: newReferrer.phone || undefined, email: newReferrer.email || undefined }),
                          });
                          const data = await res.json();
                          if (!res.ok) { setAddReferrerError(data.error ?? "Failed to create referrer."); return; }
                          const created: Referrer = { ...data.referrer, roleCode: "ext_referrer" };
                          setReferrers((prev) => [...prev, created]);
                          setForm((f) => ({ ...f, referrerId: created.id }));
                          setShowAddReferrer(false);
                          setNewReferrer({ firstName: "", lastName: "", phone: "", email: "" });
                        } catch { setAddReferrerError("Network error."); }
                        finally { setAddingReferrer(false); }
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-white rounded-lg"
                      style={{ background: addingReferrer || !newReferrer.firstName.trim() ? "#9bafc5" : "#41afeb" }}
                    >
                      {addingReferrer ? "Creating…" : "Create & Select"}
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...inputStyle, minHeight: "64px", resize: "vertical" }} placeholder="Optional notes..." />
              </div>
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3 flex-shrink-0" style={{ borderTop: "1px solid #e5e7eb", display: modalMinimized ? "none" : undefined }}>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving || !form.firstName.trim() || !form.lastName.trim() || !hasContact()}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: saving || !form.firstName.trim() || !form.lastName.trim() || !hasContact() ? "#9bafc5" : "#41afeb" }}
              >
                {saving ? "Saving..." : editCustomer ? "Save Changes" : "Create Customer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Activate / Deactivate confirm ────────────────────────────── */}
      {confirmToggle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold mb-2" style={{ color: "#24315f" }}>
              {confirmToggle.isActive !== false ? "Deactivate Customer" : "Activate Customer"}
            </h2>
            <p className="text-sm mb-1" style={{ color: "#111827" }}>
              <strong>{confirmToggle.firstName} {confirmToggle.lastName}</strong> · {confirmToggle.userCode}
            </p>
            <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
              {confirmToggle.isActive !== false
                ? "This customer will be marked as inactive and hidden from the default view."
                : "This customer will be marked as active and visible in the default view."}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmToggle(null)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button
                onClick={() => handleToggleActive(confirmToggle)}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: confirmToggle.isActive !== false ? "#dc2626" : "#16a34a" }}
              >
                {confirmToggle.isActive !== false ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
