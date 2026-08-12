"use client";

import { useEffect, useState, useRef } from "react";
import DataTable, { type ColumnDef } from "@/components/DataTable";
import { useWhitelist } from "@/app/dashboard/whitelist/useWhitelist";
import { useToast } from "@/app/dashboard/whitelist/useToast";
import { ToastContainer } from "@/app/dashboard/whitelist/Toast";

const ETH_ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

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
  const [activeTab, setActiveTab] = useState<"customers" | "wallets">("customers");

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

  // Wallet modal (per-customer)
  const [walletCustomer, setWalletCustomer] = useState<Customer | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletsLoading, setWalletsLoading] = useState(false);
  const [walletsError, setWalletsError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Wallets tab (all customer wallets flat list)
  interface AllWallet {
    userId: string;
    userCode: string;
    fullName: string;
    email: string;
    walletId: string;
    address: string;
    isWhitelisted: boolean;
    isBlocked: boolean;
    isVip: boolean;
    walletTotalMinted: number;
    addedAt: string;
  }
  const [allWallets, setAllWallets] = useState<AllWallet[]>([]);
  const [allWalletsLoading, setAllWalletsLoading] = useState(false);
  const [allWalletsError, setAllWalletsError] = useState<string | null>(null);
  const [walletSearch, setWalletSearch] = useState("");
  const [walletCopiedId, setWalletCopiedId] = useState<string | null>(null);

  // Whitelist integration (merged into Wallet Status tab)
  const {
    addresses: wlAddresses, stats: wlStats, isLoading: wlLoading,
    addAddress, addAddressesBulk, removeAddress, exportWhitelist,
    addAddressLoading, addAddressesLoading, removeAddressLoading,
  } = useWhitelist();
  const { toasts, showToast, removeToast } = useToast();
  const [wlModal, setWlModal] = useState<null | "add" | "bulk">(null);
  const [wlAddInput, setWlAddInput] = useState("");
  const [wlBulkInput, setWlBulkInput] = useState("");
  const [wlActionAddr, setWlActionAddr] = useState<string | null>(null);
  const [vipActionAddr, setVipActionAddr] = useState<string | null>(null);
  const [blockActionAddr, setBlockActionAddr] = useState<string | null>(null);

  const loadAllWallets = () => {
    setAllWalletsLoading(true);
    setAllWalletsError(null);
    fetch("/api/customers/wallet-status", { credentials: "include" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? `Error ${r.status}`);
        setAllWallets(d.wallets ?? []);
      })
      .catch((e: Error) => setAllWalletsError(e.message || "Failed to load wallet data."))
      .finally(() => setAllWalletsLoading(false));
  };

  // Whitelist handlers
  const handleWlAdd = async () => {
    if (!ETH_ADDR_RE.test(wlAddInput.trim())) { showToast("Invalid ETH address", "error"); return; }
    try {
      await addAddress(wlAddInput.trim());
      showToast("Address added to whitelist", "success");
      setWlModal(null); setWlAddInput("");
      loadAllWallets();
    } catch (e: unknown) { showToast((e as Error).message || "Failed to add", "error"); }
  };

  const handleWlBulk = async () => {
    const lines = wlBulkInput.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const invalid = lines.filter((a) => !ETH_ADDR_RE.test(a));
    if (invalid.length) { showToast(`${invalid.length} invalid address${invalid.length > 1 ? "es" : ""}`, "error"); return; }
    if (!lines.length) { showToast("No addresses to import", "warning"); return; }
    try {
      await addAddressesBulk(lines);
      showToast(`${lines.length} address${lines.length > 1 ? "es" : ""} imported`, "success");
      setWlModal(null); setWlBulkInput("");
      loadAllWallets();
    } catch (e: unknown) { showToast((e as Error).message || "Failed to import", "error"); }
  };

  const handleWlRemoveRow = async (address: string) => {
    setWlActionAddr(address);
    try {
      await removeAddress(address);
      showToast("Removed from whitelist", "success");
      loadAllWallets();
    } catch (e: unknown) { showToast((e as Error).message || "Remove failed", "error"); }
    finally { setWlActionAddr(null); }
  };

  const handleWlAddRow = async (address: string) => {
    setWlActionAddr(address);
    try {
      await addAddress(address);
      showToast("Added to whitelist", "success");
      loadAllWallets();
    } catch (e: unknown) { showToast((e as Error).message || "Add failed", "error"); }
    finally { setWlActionAddr(null); }
  };

  const handleExportWl = async (fmt: "csv" | "json" | "txt") => {
    try {
      const blob = await exportWhitelist(fmt);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `whitelist.${fmt}`; a.click();
      URL.revokeObjectURL(url);
    } catch { showToast("Export failed", "error"); }
  };

  const handleToggleVip = async (address: string, currentIsVip: boolean) => {
    setVipActionAddr(address);
    try {
      const res = await fetch(`/api/nft-sell/customers/${address}/vip`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVip: !currentIsVip }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "VIP update failed"); }
      showToast(!currentIsVip ? "VIP granted successfully" : "VIP revoked successfully", "success");
      loadAllWallets();
    } catch (e: unknown) { showToast((e as Error).message || "VIP update failed", "error"); }
    finally { setVipActionAddr(null); }
  };

  const handleToggleBlock = async (address: string, currentIsBlocked: boolean) => {
    setBlockActionAddr(address);
    try {
      const method = currentIsBlocked ? "DELETE" : "POST";
      const res = await fetch(`/api/wallets/${address}/block`, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        ...(currentIsBlocked ? {} : { body: JSON.stringify({ onChain: true }) }),
      });
      const d = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(d.error || d.onChainError || "Block update failed");
      if (res.status === 207) {
        showToast(`DB ${currentIsBlocked ? "unblocked" : "blocked"} — on-chain failed: ${d.onChainError ?? "unknown"}`, "warning");
      } else {
        showToast(currentIsBlocked ? "Wallet unblocked on-chain" : "Wallet blocked on-chain", "success");
      }
      loadAllWallets();
    } catch (e: unknown) { showToast((e as Error).message || "Block update failed", "error"); }
    finally { setBlockActionAddr(null); }
  };

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
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? `Error ${r.status}`);
        setCustomers(data.customers ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch((e: Error) => { setError(e.message || "Failed to load customers."); setLoading(false); });
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
        {activeTab === "customers" && (
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
        )}
      </div>

      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: "#e5e7eb" }}>
        {(["customers", "wallets"] as const).map((t) => (
          <button key={t}
            onClick={() => {
              setActiveTab(t);
              if (t === "wallets" && allWallets.length === 0 && !allWalletsLoading) loadAllWallets();
            }}
            className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={{
              borderColor: activeTab === t ? "#41afeb" : "transparent",
              color: activeTab === t ? "#41afeb" : "#9bafc5",
            }}>
            {t === "customers" ? "Customers" : "Wallet Status"}
          </button>
        ))}
      </div>

      {activeTab === "wallets" && (() => {
        const filtered = allWallets.filter((w) => {
          const q = walletSearch.toLowerCase().trim();
          if (!q) return true;
          return (
            w.fullName.toLowerCase().includes(q) ||
            w.userCode.toLowerCase().includes(q) ||
            w.address.toLowerCase().includes(q) ||
            (w.email ?? "").toLowerCase().includes(q)
          );
        });
        const wlCount = wlAddresses.length;
        return (
          <div className="space-y-4">
            {/* ── Whitelist Stats Bar ── */}
            <div className="grid grid-cols-2 gap-3" style={{ maxWidth: 480 }}>
              {([
                { label: "WL Addresses", value: wlLoading ? "…" : String(wlCount), color: "#41afeb" },
                { label: "Last Updated", value: wlLoading ? "…" : (wlStats?.lastUpdated ? new Date(wlStats.lastUpdated).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"), color: "#6b7280" },
              ] as { label: string; value: string; color: string; mono?: boolean }[]).map((s) => (
                <div key={s.label} className="bg-white rounded-xl p-3.5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
                  <p className="text-xs" style={{ color: "#9bafc5" }}>{s.label}</p>
                  <p className={`text-sm font-bold mt-0.5 truncate${s.mono ? " font-mono" : ""}`} style={{ color: s.color }} title={s.value}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* ── Action Buttons ── */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => { setWlModal("add"); setWlAddInput(""); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#41afeb" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#2e9fd8")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#41afeb")}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Address
              </button>
              <button onClick={() => { setWlModal("bulk"); setWlBulkInput(""); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ border: "1px solid #e5e7eb", color: "#374151", background: "white" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Bulk Import
              </button>
              <button onClick={() => handleExportWl("csv")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ border: "1px solid #e5e7eb", color: "#374151", background: "white" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "white")}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                Export CSV
              </button>
            </div>

            {/* ── Search + Refresh ── */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Search by name, wallet, email..." value={walletSearch}
                  onChange={(e) => setWalletSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none bg-white"
                  style={{ border: "1px solid #e5e7eb", color: "#111827" }} />
              </div>
              <button onClick={loadAllWallets} disabled={allWalletsLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "white" }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <span className="text-xs" style={{ color: "#9bafc5" }}>{filtered.length} wallet{filtered.length !== 1 ? "s" : ""}</span>
            </div>

            {allWalletsError && (
              <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>{allWalletsError}</div>
            )}

            {allWalletsLoading ? (
              <div className="flex items-center justify-center h-40" style={{ color: "#9bafc5" }}>
                <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading wallets…
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-sm" style={{ color: "#9bafc5" }}>
                {walletSearch ? "No wallets match your search." : "No customer wallets found."}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm overflow-x-auto" style={{ border: "1px solid #e5e7eb" }}>
                <table className="w-full text-sm min-w-max">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
                      {["Customer", "Code", "Wallet Address", "Whitelisted", "Blocked", "VIP", "Minted", "Added", "WL Action"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "#9bafc5" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((w) => (
                      <tr key={w.walletId} className="transition-colors" style={{ borderBottom: "1px solid #f9fafb" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-medium" style={{ color: "#111827" }}>{w.fullName || "—"}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs font-semibold" style={{ color: "#41afeb" }}>{w.userCode}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs" style={{ color: "#24315f" }} title={w.address}>
                              {w.address.slice(0, 8)}…{w.address.slice(-6)}
                            </span>
                            <button
                              onClick={() => { navigator.clipboard?.writeText(w.address); setWalletCopiedId(w.walletId); setTimeout(() => setWalletCopiedId(null), 2000); }}
                              className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors"
                              style={walletCopiedId === w.walletId ? { background: "rgba(22,163,74,0.1)", color: "#16a34a" } : { background: "rgba(65,175,235,0.08)", color: "#41afeb" }}
                              title="Copy full address">
                              {walletCopiedId === w.walletId
                                ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                              }
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {w.isWhitelisted ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                              Listed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(156,163,175,0.1)", color: "#9ca3af" }}>Not Listed</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {blockActionAddr === w.address ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "#f3f4f6", color: "#9bafc5" }}>
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                              Wait…
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleBlock(w.address, w.isBlocked)}
                              title={w.isBlocked ? "Click to unblock this wallet" : "Click to block this wallet"}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer"
                              style={w.isBlocked
                                ? { background: "rgba(220,38,38,0.08)", color: "#dc2626", borderColor: "rgba(220,38,38,0.25)" }
                                : { background: "rgba(22,163,74,0.08)", color: "#16a34a", borderColor: "rgba(22,163,74,0.25)" }}
                              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.transform = "scale(0.97)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "scale(1)"; }}
                            >
                              {w.isBlocked ? (
                                <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>Blocked</>
                              ) : (
                                <><span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#16a34a" }} />Active</>
                              )}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {vipActionAddr === w.address ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: "#f3f4f6", color: "#9bafc5" }}>
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                              Wait…
                            </span>
                          ) : (
                            <button
                              onClick={() => handleToggleVip(w.address, w.isVip)}
                              title={w.isVip ? "Click to revoke VIP" : "Click to grant VIP"}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer"
                              style={w.isVip
                                ? { background: "rgba(245,158,11,0.1)", color: "#d97706", borderColor: "rgba(245,158,11,0.3)" }
                                : { background: "rgba(156,163,175,0.08)", color: "#6b7280", borderColor: "rgba(156,163,175,0.25)" }}
                              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.7"; e.currentTarget.style.transform = "scale(0.97)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "scale(1)"; }}
                            >
                              {w.isVip ? "★ VIP" : "Normal"}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span className="font-semibold text-xs" style={{ color: w.walletTotalMinted > 0 ? "#7c3aed" : "#9ca3af" }}>{w.walletTotalMinted ?? 0}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs" style={{ color: "#9bafc5" }}>
                          {w.addedAt ? new Date(w.addedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {wlActionAddr === w.address ? (
                            <span className="text-xs" style={{ color: "#9bafc5" }}>…</span>
                          ) : w.isWhitelisted ? (
                            <button onClick={() => handleWlRemoveRow(w.address)} disabled={removeAddressLoading}
                              className="px-2 py-0.5 rounded text-xs font-semibold transition-colors"
                              style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(220,38,38,0.15)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(220,38,38,0.08)")}>
                              Remove WL
                            </button>
                          ) : (
                            <button onClick={() => handleWlAddRow(w.address)} disabled={addAddressLoading}
                              className="px-2 py-0.5 rounded text-xs font-semibold transition-colors"
                              style={{ background: "rgba(22,163,74,0.08)", color: "#16a34a" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(22,163,74,0.15)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(22,163,74,0.08)")}>
                              + Add WL
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {activeTab === "customers" && (<>
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
      </>)}

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
            className={`ba-modal-customers flex flex-col${modalMinimized ? " minimized" : ""}${modalMaximized ? " maximized" : ""}`}
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

      {/* ── Add Address Modal ─────────────────────────────────────────── */}
      {wlModal === "add" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: "#24315f" }}>Add Address to Whitelist</h3>
              <button onClick={() => setWlModal(null)} style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#24315f" }}>Wallet Address</label>
              <input type="text" value={wlAddInput} onChange={(e) => setWlAddInput(e.target.value)} placeholder="0x…"
                className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none"
                style={{ border: `1px solid ${wlAddInput && !ETH_ADDR_RE.test(wlAddInput.trim()) ? "#dc2626" : "#e5e7eb"}` }} />
              {wlAddInput && !ETH_ADDR_RE.test(wlAddInput.trim()) && (
                <p className="text-xs mt-1" style={{ color: "#dc2626" }}>Must be a valid 0x… Ethereum address (42 chars)</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setWlModal(null)} className="px-4 py-2 text-sm rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button onClick={handleWlAdd} disabled={addAddressLoading || !ETH_ADDR_RE.test(wlAddInput.trim())}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: addAddressLoading || !ETH_ADDR_RE.test(wlAddInput.trim()) ? "#9bafc5" : "#41afeb" }}>
                {addAddressLoading ? "Adding…" : "Add Address"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Import Modal ─────────────────────────────────────────── */}
      {wlModal === "bulk" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold" style={{ color: "#24315f" }}>Bulk Import Addresses</h3>
              <button onClick={() => setWlModal(null)} style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#24315f" }}>Addresses (one per line or comma-separated)</label>
              <textarea value={wlBulkInput} onChange={(e) => setWlBulkInput(e.target.value)}
                placeholder={"0x1234…\n0xabcd…\n0xefab…"} rows={8}
                className="w-full px-3 py-2 rounded-lg text-xs font-mono outline-none resize-none"
                style={{ border: "1px solid #e5e7eb" }} />
              {(() => {
                const lines = wlBulkInput.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
                const invalid = lines.filter((a) => !ETH_ADDR_RE.test(a));
                if (!lines.length) return null;
                return (
                  <p className="text-xs mt-1" style={{ color: invalid.length ? "#dc2626" : "#16a34a" }}>
                    {lines.length} address{lines.length !== 1 ? "es" : ""}{invalid.length ? ` — ${invalid.length} invalid` : " — all valid"}
                  </p>
                );
              })()}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setWlModal(null)} className="px-4 py-2 text-sm rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button onClick={handleWlBulk} disabled={addAddressesLoading || !wlBulkInput.trim()}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: addAddressesLoading || !wlBulkInput.trim() ? "#9bafc5" : "#41afeb" }}>
                {addAddressesLoading ? "Importing…" : "Import All"}
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
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
