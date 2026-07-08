"use client";

import { useEffect, useState } from "react";

interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  roleId: string;
  roleName?: string;
  roleCode?: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Role {
  id: string;
  code: string;
  name: string;
}

interface PermissionRow {
  id: string;
  key: string;
  label: string;
  module: string;
  overrideId: string | null;
  isGranted: boolean | null;
  reason: string | null;
  actionedAt: string | null;
}

const EMPTY_FORM = { email: "", firstName: "", lastName: "", phone: "", roleId: "" };

function PermissionsModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [perms, setPerms] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/users/${user.id}/permissions`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setPerms(d.permissions ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const set = async (perm: PermissionRow, isGranted: boolean) => {
    setSaving(perm.id);
    await fetch(`/api/admin/users/${user.id}/permissions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ permissionId: perm.id, isGranted, reason: reason || null }),
    });
    setSaving(null);
    load();
  };

  const clear = async (perm: PermissionRow) => {
    setSaving(perm.id);
    await fetch(`/api/admin/users/${user.id}/permissions/${perm.id}`, {
      method: "DELETE", credentials: "include",
    });
    setSaving(null);
    load();
  };

  const modules = [...new Set(perms.map(p => p.module))].sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-lg w-full max-w-2xl mx-4 flex flex-col" style={{ maxHeight: "85vh", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Permission Overrides</h2>
            <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{user.firstName} {user.lastName} — overrides apply on top of the role</p>
          </div>
          <button onClick={onClose} style={{ color: "#9bafc5" }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>Reason (optional — applied to next change)</label>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Temporary access for handover"
            className="w-full text-xs px-3 py-1.5 rounded border outline-none"
            style={{ border: "1px solid #e4e7ed", color: "#374151" }}
          />
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="w-5 h-5 animate-spin" style={{ color: "#9bafc5" }} fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map(mod => (
                <div key={mod}>
                  <div className="text-xs font-bold uppercase tracking-wider mb-2 pb-1 border-b border-gray-100" style={{ color: "#9bafc5" }}>
                    {mod}
                  </div>
                  <div className="space-y-1">
                    {perms.filter(p => p.module === mod).map(p => {
                      const isBusy = saving === p.id;
                      return (
                        <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded" style={{ background: p.overrideId ? (p.isGranted ? "rgba(22,163,74,0.05)" : "rgba(220,38,38,0.05)") : "transparent" }}>
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-medium" style={{ color: "#374151" }}>{p.label}</span>
                            <span className="text-xs ml-2 font-mono" style={{ color: "#9bafc5" }}>{p.key}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                            {p.overrideId && (
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${p.isGranted ? "text-green-700" : "text-red-600"}`}
                                style={{ background: p.isGranted ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.1)" }}>
                                {p.isGranted ? "Granted" : "Denied"}
                              </span>
                            )}
                            <button
                              disabled={isBusy}
                              onClick={() => set(p, true)}
                              className="text-xs px-2 py-0.5 rounded font-semibold"
                              style={{ background: "#d1fae5", color: "#065f46", opacity: isBusy ? 0.5 : 1 }}
                              title="Grant this permission"
                            >+</button>
                            <button
                              disabled={isBusy}
                              onClick={() => set(p, false)}
                              className="text-xs px-2 py-0.5 rounded font-semibold"
                              style={{ background: "#fee2e2", color: "#991b1b", opacity: isBusy ? 0.5 : 1 }}
                              title="Deny this permission"
                            >−</button>
                            {p.overrideId && (
                              <button
                                disabled={isBusy}
                                onClick={() => clear(p)}
                                className="text-xs px-2 py-0.5 rounded font-semibold"
                                style={{ background: "#f3f4f6", color: "#6b7280", opacity: isBusy ? 0.5 : 1 }}
                                title="Clear override (revert to role default)"
                              >✕</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {perms.length === 0 && (
                <p className="text-xs text-center py-6" style={{ color: "#9bafc5" }}>No permissions found</p>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end flex-shrink-0">
          <button onClick={onClose}
            className="px-4 py-1.5 rounded text-xs font-semibold"
            style={{ color: "#6b7280", background: "#f3f4f6" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [permUser, setPermUser] = useState<AdminUser | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/users", { credentials: "include" }).then(r => r.json()),
      fetch("/api/admin/roles", { credentials: "include" }).then(r => r.json()),
    ]).then(([ud, rd]) => {
      setUsers(ud.users ?? []);
      setRoles(rd.roles ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditUser(user);
    setForm({ email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? "", roleId: user.roleId });
    setError("");
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = editUser ? `/api/admin/users/${editUser.id}` : "/api/admin/users";
      const method = editUser ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, phone: form.phone || null }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Failed to save user"); return; }
      setShowForm(false);
      load();
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  };

  const deactivate = async (user: AdminUser) => {
    if (!confirm(`Deactivate ${user.firstName} ${user.lastName}?`)) return;
    await fetch(`/api/admin/users/${user.id}`, { method: "DELETE", credentials: "include" });
    load();
  };

  const filtered = users.filter(u =>
    !search || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString() : "—";

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Admin Users</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{users.length} team members</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
            className="text-xs px-3 py-1.5 rounded border outline-none"
            style={{ border: "1px solid #e4e7ed", color: "#374151", width: "160px" }}
          />
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold text-white"
            style={{ background: "#24315f" }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="w-6 h-6 animate-spin" style={{ color: "#9bafc5" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #e4e7ed" }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid #e4e7ed", background: "#f8f9fb" }}>
                {["Name", "Email", "Role", "Status", "Last Login", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold" style={{ color: "#6b7280" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(user => (
                <tr key={user.id} style={{ color: "#374151" }}>
                  <td className="px-4 py-3 font-medium">{user.firstName} {user.lastName}</td>
                  <td className="px-4 py-3" style={{ color: "#6b7280" }}>{user.email}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold"
                      style={{ background: "#f0f2f7", color: "#24315f" }}>
                      {user.roleCode ?? roles.find(r => r.id === user.roleId)?.code ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${user.isActive ? "text-green-700" : "text-red-600"}`}
                      style={{ background: user.isActive ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)" }}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3" style={{ color: "#9bafc5" }}>{fmtDate(user.lastLoginAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(user)}
                        className="text-xs font-medium hover:underline" style={{ color: "#2563eb" }}>Edit</button>
                      <button onClick={() => setPermUser(user)}
                        className="text-xs font-medium hover:underline" style={{ color: "#7c3aed" }}>Permissions</button>
                      {user.isActive && (
                        <button onClick={() => deactivate(user)}
                          className="text-xs font-medium hover:underline" style={{ color: "#dc2626" }}>Deactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8" style={{ color: "#9bafc5" }}>No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Create modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-lg w-full max-w-md mx-4" style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>
                {editUser ? "Edit User" : "Add Admin User"}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ color: "#9bafc5" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={submit} className="px-5 py-4 space-y-3">
              {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>First Name *</label>
                  <input required value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                    className="w-full text-xs px-3 py-1.5 rounded border outline-none"
                    style={{ border: "1px solid #e4e7ed", color: "#374151" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>Last Name</label>
                  <input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                    className="w-full text-xs px-3 py-1.5 rounded border outline-none"
                    style={{ border: "1px solid #e4e7ed", color: "#374151" }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>Email *</label>
                <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full text-xs px-3 py-1.5 rounded border outline-none"
                  style={{ border: "1px solid #e4e7ed", color: "#374151" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>Phone</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full text-xs px-3 py-1.5 rounded border outline-none"
                  style={{ border: "1px solid #e4e7ed", color: "#374151" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: "#374151" }}>Role *</label>
                <select required value={form.roleId} onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
                  className="w-full text-xs px-3 py-1.5 rounded border outline-none bg-white"
                  style={{ border: "1px solid #e4e7ed", color: "#374151" }}>
                  <option value="">Select a role…</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.code})</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-1.5 rounded text-xs font-semibold" style={{ color: "#6b7280", background: "#f3f4f6" }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-4 py-1.5 rounded text-xs font-semibold text-white"
                  style={{ background: "#24315f", opacity: saving ? 0.6 : 1 }}>
                  {saving ? "Saving…" : editUser ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permission overrides modal */}
      {permUser && <PermissionsModal user={permUser} onClose={() => setPermUser(null)} />}
    </div>
  );
}
