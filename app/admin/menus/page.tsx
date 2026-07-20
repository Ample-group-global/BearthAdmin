"use client";

import { useEffect, useState } from "react";

interface Menu {
  id: string;
  label: string;
  href: string;
  icon: string | null;
  module: string | null;
  sort_order: number;
  is_active: boolean;
}

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/menus", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setMenus(d.menus ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const grouped = menus.reduce<Record<string, Menu[]>>((acc, m) => {
    (acc[m.module ?? "other"] ??= []).push(m);
    return acc;
  }, {});

  const MODULE_LABEL: Record<string, string> = {
    sales: "Sales & Orders",
    dashboard: "Technical Dashboard",
    admin: "Admin / RBAC",
    other: "Other",
  };

  const MODULE_COLOR: Record<string, string> = {
    sales: "#41afeb",
    dashboard: "#24315f",
    admin: "#f59e0b",
    other: "#9bafc5",
  };

  return (
    <div className="p-5">
      <div className="mb-5">
        <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Menu Registry</h1>
        <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
          {menus.length} menus registered — assign to roles on the Roles page
        </p>
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
          {Object.entries(grouped).map(([module, items]) => (
            <div key={module} className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #e4e7ed" }}>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: MODULE_COLOR[module] ?? "#9bafc5" }} />
                <h3 className="text-xs font-bold" style={{ color: "#24315f" }}>{MODULE_LABEL[module] ?? module}</h3>
                <span className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{ background: "#f0f2f7", color: "#6b7280" }}>{items.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {items.sort((a, b) => a.sort_order - b.sort_order).map(menu => (
                  <div key={menu.id} className="flex items-center gap-4 px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${menu.is_active ? "bg-green-400" : "bg-gray-300"}`} />
                      <span className="text-xs font-semibold" style={{ color: "#374151" }}>{menu.label}</span>
                    </div>
                    <code className="text-[11px] font-mono px-2 py-0.5 rounded ml-auto"
                      style={{ background: "#f8f9fb", color: "#4b5563", border: "1px solid #e4e7ed" }}>
                      {menu.href}
                    </code>
                    {menu.icon && (
                      <span className="text-[10px] font-mono" style={{ color: "#9bafc5" }}>{menu.icon}</span>
                    )}
                    <span className="text-[10px]" style={{ color: "#c4c9d4" }}>#{menu.sort_order}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-10 text-sm" style={{ color: "#9bafc5" }}>No menus found</div>
          )}
        </div>
      )}
    </div>
  );
}
