"use client";

import { useEffect, useState, useCallback } from "react";

interface Role {
  id: string;
  code: string;
  name: string;
  home_url: string | null;
  is_active: boolean;
}

interface Permission {
  id: string;
  key: string;
  label: string;
  module: string;
  sort_order: number;
  is_granted: boolean | null;
}

interface Menu {
  id: string;
  label: string;
  href: string;
  icon: string | null;
  module: string | null;
  is_active: boolean;
  sort_order: number;
}

type TabType = "permissions" | "menus";

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("permissions");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [menuIds, setMenuIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/admin/roles", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setRoles(d.roles ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const loadRoleDetail = useCallback(async (role: Role, tab: TabType) => {
    setDetailLoading(true);
    try {
      if (tab === "permissions") {
        const r = await fetch(`/api/admin/roles/${role.id}/permissions`, { credentials: "include" });
        const d = await r.json();
        setPermissions(d.permissions ?? []);
      } else {
        const r = await fetch(`/api/admin/roles/${role.id}/menus`, { credentials: "include" });
        const d = await r.json();
        const roleMenus: Menu[] = d.menus ?? [];
        setMenus(roleMenus);
        setMenuIds(new Set(roleMenus.filter(m => m.sort_order !== null && m.sort_order !== undefined && m.is_active).map(m => m.id)));
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const selectRole = (role: Role) => {
    setSelectedRole(role);
    setActiveTab("permissions");
    loadRoleDetail(role, "permissions");
  };

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    if (selectedRole) loadRoleDetail(selectedRole, tab);
  };

  const togglePermission = async (perm: Permission) => {
    if (!selectedRole) return;
    const newVal = !perm.is_granted;
    setSaving(perm.id);
    try {
      await fetch(`/api/admin/roles/${selectedRole.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ permissionId: perm.id, isGranted: newVal }),
      });
      setPermissions(prev => prev.map(p => p.id === perm.id ? { ...p, is_granted: newVal } : p));
      setSavedId(perm.id);
      setTimeout(() => setSavedId(null), 1500);
    } finally {
      setSaving(null);
    }
  };

  const toggleMenu = (menuId: string) => {
    setMenuIds(prev => {
      const next = new Set(prev);
      if (next.has(menuId)) next.delete(menuId);
      else next.add(menuId);
      return next;
    });
  };

  const saveMenus = async () => {
    if (!selectedRole) return;
    setSaving("menus");
    try {
      await fetch(`/api/admin/roles/${selectedRole.id}/menus`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ menuIds: Array.from(menuIds) }),
      });
      setSavedId("menus");
      setTimeout(() => setSavedId(null), 1500);
    } finally {
      setSaving(null);
    }
  };

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});

  const menuGrouped = menus.reduce<Record<string, Menu[]>>((acc, m) => {
    (acc[m.module ?? "other"] ??= []).push(m);
    return acc;
  }, {});

  const ROLE_COLOR: Record<string, string> = {
    admin: "#dc2626", operation: "#2563eb", technical_team: "#f59e0b",
    sales_team: "#16a34a", ext_referrer: "#7c3aed", customer: "#6b7280",
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Role list */}
      <div className="w-64 flex-shrink-0 bg-white overflow-y-auto" style={{ borderRight: "1px solid #e4e7ed" }}>
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Roles</h2>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Select to manage</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="w-5 h-5 animate-spin" style={{ color: "#9bafc5" }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <ul className="py-1">
            {roles.map(role => (
              <li key={role.id}>
                <button
                  onClick={() => selectRole(role)}
                  className="w-full text-left px-4 py-3 text-sm transition-colors"
                  style={{
                    background: selectedRole?.id === role.id ? "#f0f2f7" : "transparent",
                    borderLeft: selectedRole?.id === role.id ? `3px solid ${ROLE_COLOR[role.code] ?? "#41afeb"}` : "3px solid transparent",
                  }}
                  onMouseEnter={e => { if (selectedRole?.id !== role.id) e.currentTarget.style.background = "#f8f9fb"; }}
                  onMouseLeave={e => { if (selectedRole?.id !== role.id) e.currentTarget.style.background = "transparent"; }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ROLE_COLOR[role.code] ?? "#9bafc5" }} />
                    <span className="font-semibold truncate" style={{ color: "#24315f" }}>{role.name}</span>
                  </div>
                  <div className="mt-0.5 ml-4 text-[10px] font-mono" style={{ color: "#9bafc5" }}>{role.code}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-auto">
        {!selectedRole ? (
          <div className="flex items-center justify-center h-full" style={{ color: "#c4c9d4" }}>
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-sm font-medium">Select a role to manage</p>
            </div>
          </div>
        ) : (
          <div className="p-5">
            {/* Role header */}
            <div className="flex items-center gap-3 mb-4">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ROLE_COLOR[selectedRole.code] ?? "#9bafc5" }} />
              <div>
                <h2 className="text-base font-bold" style={{ color: "#24315f" }}>{selectedRole.name}</h2>
                <span className="text-xs font-mono" style={{ color: "#9bafc5" }}>{selectedRole.code}</span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
              {(["permissions", "menus"] as TabType[]).map(tab => (
                <button key={tab} onClick={() => switchTab(tab)}
                  className="px-4 py-1.5 rounded text-xs font-semibold capitalize transition-all"
                  style={activeTab === tab
                    ? { background: "#fff", color: "#24315f", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                    : { color: "#9bafc5" }}>
                  {tab}
                </button>
              ))}
            </div>

            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="w-6 h-6 animate-spin" style={{ color: "#9bafc5" }} fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : activeTab === "permissions" ? (
              /* Permissions tab */
              <div className="space-y-4">
                {Object.entries(grouped).map(([module, perms]) => (
                  <div key={module} className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #e4e7ed" }}>
                    <div className="px-4 py-2 border-b border-gray-100">
                      <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: "#24315f" }}>{module}</h3>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {perms.map(perm => (
                        <div key={perm.id} className="flex items-center justify-between px-4 py-2.5">
                          <div>
                            <p className="text-xs font-semibold" style={{ color: "#374151" }}>{perm.label}</p>
                            <p className="text-[10px] font-mono mt-0.5" style={{ color: "#9bafc5" }}>{perm.key}</p>
                          </div>
                          <button
                            onClick={() => togglePermission(perm)}
                            disabled={saving === perm.id}
                            className="relative w-9 h-5 rounded-full transition-colors flex-shrink-0"
                            style={{ background: perm.is_granted ? "#22c55e" : "#d1d5db" }}
                          >
                            <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform"
                              style={{ transform: perm.is_granted ? "translateX(16px)" : "translateX(0)" }} />
                            {saving === perm.id && (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <svg className="w-3 h-3 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                              </span>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Menus tab */
              <div>
                <div className="space-y-4 mb-4">
                  {Object.entries(menuGrouped).map(([module, items]) => (
                    <div key={module} className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #e4e7ed" }}>
                      <div className="px-4 py-2 border-b border-gray-100">
                        <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: "#24315f" }}>{module}</h3>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {items.map(menu => {
                          const checked = menuIds.has(menu.id);
                          return (
                            <label key={menu.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer" style={{ color: "#374151" }}>
                              <input type="checkbox" checked={checked} onChange={() => toggleMenu(menu.id)}
                                className="w-4 h-4 rounded accent-blue-600" />
                              <div>
                                <p className="text-xs font-semibold">{menu.label}</p>
                                <p className="text-[10px] font-mono mt-0.5" style={{ color: "#9bafc5" }}>{menu.href}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={saveMenus}
                  disabled={saving === "menus"}
                  className="px-5 py-2 rounded text-sm font-semibold text-white transition-opacity"
                  style={{ background: savedId === "menus" ? "#22c55e" : "#24315f", opacity: saving === "menus" ? 0.6 : 1 }}
                >
                  {savedId === "menus" ? "Saved!" : saving === "menus" ? "Saving…" : "Save Menu Assignments"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
