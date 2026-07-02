"use client";

import { useEffect, useState, useRef } from "react";

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  roleCode: string;
  roleName: string;
  isActive: boolean;
  lastLogin: string | null;
  totalCount: number;
}

interface Master {
  roles: Array<{ id: string; name: string; code: string }>;
}

const PAGE_SIZE = 100;

function roleBadge(code: string, name: string) {
  if (code === "admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#dc2626" }} />
        {name}
      </span>
    );
  }
  if (code === "operation") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#41afeb" }} />
        {name}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "rgba(156,163,175,0.1)", color: "#6b7280" }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#6b7280" }} />
      {name}
    </span>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [master, setMaster] = useState<Master | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [activateId, setActivateId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    roleId: "",
  });

  const loadUsers = (q: string, off: number) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ search: q, limit: String(PAGE_SIZE), offset: String(off) });
    fetch(`/api/presale/users?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const rows: User[] = data.users ?? [];
        setUsers(rows);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load users.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetch("/api/presale/master", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setMaster(d));
  }, []);

  useEffect(() => {
    loadUsers(search, offset);
  }, [offset]);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setOffset(0);
      loadUsers(v, 0);
    }, 300);
  };

  const openCreate = () => {
    setEditUser(null);
    setForm({ email: "", firstName: "", lastName: "", roleId: "" });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    const roleId = master?.roles.find((r) => r.code === u.roleCode)?.id ?? "";
    setForm({ email: u.email ?? "", firstName: u.firstName ?? "", lastName: u.lastName ?? "", roleId: String(roleId) });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const body: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
      };
      if (form.roleId) body.roleId = form.roleId;

      const url = editUser ? `/api/presale/users/${editUser.id}` : "/api/presale/users";
      const method = editUser ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error ?? "Save failed.");
        return;
      }
      setShowModal(false);
      loadUsers(search, offset);
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      const res = await fetch(`/api/presale/users/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Deactivate failed.");
        return;
      }
      setDeactivateId(null);
      loadUsers(search, offset);
    } catch {
      setError("Network error.");
    }
  };

  const handleActivate = async (id: string) => {
    try {
      const res = await fetch(`/api/presale/users/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Activate failed.");
        return;
      }
      setActivateId(null);
      loadUsers(search, offset);
    } catch {
      setError("Network error.");
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    color: "#111827",
    outline: "none",
  };
  const labelStyle = { display: "block", fontSize: "12px", fontWeight: 600, color: "#24315f", marginBottom: "4px" };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Bearth Team</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Manage admin panel users and roles</p>
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
          New User
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#111827" }}
          />
        </div>
        <span className="text-sm" style={{ color: "#9bafc5" }}>
          {total > 0 ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}` : "0 results"}
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div className="flex items-center justify-center h-48" style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm" style={{ color: "#9bafc5" }}>No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:border-r [&_th]:border-gray-100 [&_td]:border-r [&_td]:border-gray-100 [&_th]:py-2 [&_th]:px-3 [&_td]:py-2 [&_td]:px-3">
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Name</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Email</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Role</th>
                  <th className="px-4 py-3 text-center font-semibold" style={{ color: "#9bafc5" }}>Active</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Last Login</th>
                  <th className="px-4 py-3 text-center font-semibold" style={{ color: "#9bafc5" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.filter((u) => u.roleCode !== "ext_referrer").map((u, i, arr) => (
                  <tr key={u.id} style={{ borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: "#111827" }}>{u.name ?? "—"}</td>
                    <td className="px-4 py-3" style={{ color: "#6b7280" }}>{u.email}</td>
                    <td className="px-4 py-3">{roleBadge(u.roleCode, u.roleName)}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={u.isActive !== false
                          ? { background: "rgba(22,163,74,0.1)", color: "#16a34a" }
                          : { background: "rgba(156,163,175,0.1)", color: "#9ca3af" }}
                      >
                        {u.isActive !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: "#6b7280" }}>
                      {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(u)}
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
                        {u.isActive !== false ? (
                          <button
                            onClick={() => setDeactivateId(u.id)}
                            className="p-1.5 rounded-lg"
                            style={{ color: "#dc2626" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(220,38,38,0.1)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            title="Deactivate"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={() => setActivateId(u.id)}
                            className="p-1.5 rounded-lg"
                            style={{ color: "#16a34a" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(22,163,74,0.1)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            title="Activate"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ border: "1px solid #e5e7eb", color: offset === 0 ? "#9bafc5" : "#24315f", cursor: offset === 0 ? "not-allowed" : "pointer" }}
          >
            Previous
          </button>
          <span className="text-sm" style={{ color: "#9bafc5" }}>
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ border: "1px solid #e5e7eb", color: offset + PAGE_SIZE >= total ? "#9bafc5" : "#24315f", cursor: offset + PAGE_SIZE >= total ? "not-allowed" : "pointer" }}
          >
            Next
          </button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #e5e7eb" }}>
              <h2 className="text-base font-bold" style={{ color: "#24315f" }}>{editUser ? "Edit User" : "New User"}</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>{formError}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#24315f" }}>First Name *</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    placeholder="First name"
                    required
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: "1px solid #e5e7eb" }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#24315f" }}>Last Name *</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    placeholder="Last name"
                    required
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{ border: "1px solid #e5e7eb" }}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  style={inputStyle}
                  placeholder="user@example.com"
                  disabled={!!editUser}
                />
                {editUser && <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>Email cannot be changed after creation.</p>}
              </div>
              {master && (
                <div>
                  <label style={labelStyle}>Role *</label>
                  <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} style={inputStyle}>
                    <option value="">Select role...</option>
                    {master.roles.filter((r) => r.code !== "ext_referrer").map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: "1px solid #e5e7eb" }}>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: saving ? "#9bafc5" : "#41afeb" }}
              >
                {saving ? "Saving..." : editUser ? "Save Changes" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirm */}
      {deactivateId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold mb-2" style={{ color: "#24315f" }}>Deactivate User</h2>
            <p className="text-sm mb-6" style={{ color: "#6b7280" }}>Are you sure you want to deactivate this user? They will lose access to the admin panel.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeactivateId(null)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
                Cancel
              </button>
              <button onClick={() => handleDeactivate(deactivateId)} className="px-4 py-2 text-sm font-bold text-white rounded-lg" style={{ background: "#dc2626" }}>
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activate confirm */}
      {activateId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold mb-2" style={{ color: "#24315f" }}>Activate User</h2>
            <p className="text-sm mb-6" style={{ color: "#6b7280" }}>Are you sure you want to activate this user? They will regain access to the admin panel.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setActivateId(null)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
                Cancel
              </button>
              <button onClick={() => handleActivate(activateId)} className="px-4 py-2 text-sm font-bold text-white rounded-lg" style={{ background: "#16a34a" }}>
                Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
