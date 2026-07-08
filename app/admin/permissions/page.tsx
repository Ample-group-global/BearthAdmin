"use client";

import { useEffect, useState } from "react";

interface Permission {
  id: string;
  key: string;
  label: string;
  module: string;
  sort_order: number;
}

export default function PermissionsPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/permissions", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setPermissions(d.permissions ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = permissions.filter(p =>
    !search || p.key.includes(search.toLowerCase()) || p.label.toLowerCase().includes(search.toLowerCase()) || p.module.includes(search.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});

  const MODULE_COLOR: Record<string, string> = {
    dashboard: "#6366f1", orders: "#2563eb", nft: "#7c3aed", products: "#16a34a",
    customers: "#f59e0b", reconciliation: "#dc2626", reports: "#0891b2",
    users: "#0369a1", admin: "#f59e0b",
  };

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Permission Registry</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            {permissions.length} permissions across {Object.keys(grouped).length} modules
          </p>
        </div>
        <input
          type="text"
          placeholder="Search permissions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-xs px-3 py-1.5 rounded border outline-none"
          style={{ border: "1px solid #e4e7ed", color: "#374151", width: "200px" }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="w-6 h-6 animate-spin" style={{ color: "#9bafc5" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([module, perms]) => (
            <div key={module} className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #e4e7ed" }}>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: MODULE_COLOR[module] ?? "#9bafc5" }} />
                <h3 className="text-xs font-bold uppercase tracking-wide" style={{ color: "#24315f" }}>{module}</h3>
                <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ background: "#f0f2f7", color: "#6b7280" }}>{perms.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {perms.map(perm => (
                  <div key={perm.id} className="flex items-center gap-4 px-4 py-2.5">
                    <code className="text-[11px] font-mono px-2 py-0.5 rounded flex-shrink-0"
                      style={{ background: "#f8f9fb", color: "#4b5563", border: "1px solid #e4e7ed" }}>
                      {perm.key}
                    </code>
                    <span className="text-xs" style={{ color: "#374151" }}>{perm.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-10 text-sm" style={{ color: "#9bafc5" }}>No permissions found</div>
          )}
        </div>
      )}
    </div>
  );
}
