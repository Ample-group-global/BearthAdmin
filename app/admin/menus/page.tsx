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
  const [toggling, setToggling] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/menus", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setMenus(d.menus ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggle = async (menu: Menu) => {
    setToggling(menu.id);
    try {
      await fetch(`/api/admin/menus/${menu.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !menu.is_active }),
      });
      setMenus(prev => prev.map(m => m.id === menu.id ? { ...m, is_active: !m.is_active } : m));
    } finally {
      setToggling(null);
    }
  };

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

  const activeCount = menus.filter(m => m.is_active).length;

  return (
    <div className="p-5">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Menu Registry</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            {activeCount} of {menus.length} menus visible — toggle to show/hide from nav
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "white" }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
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
                  style={{ background: "#f0f2f7", color: "#6b7280" }}>
                  {items.filter(m => m.is_active).length}/{items.length} visible
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {items.sort((a, b) => a.sort_order - b.sort_order).map(menu => (
                  <div key={menu.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${menu.is_active ? "bg-green-400" : "bg-gray-300"}`} />
                      <span className="text-xs font-semibold truncate" style={{ color: menu.is_active ? "#374151" : "#9bafc5" }}>
                        {menu.label}
                      </span>
                    </div>
                    <code className="text-[11px] font-mono px-2 py-0.5 rounded flex-shrink-0"
                      style={{ background: "#f8f9fb", color: "#4b5563", border: "1px solid #e4e7ed" }}>
                      {menu.href}
                    </code>
                    {menu.icon && (
                      <span className="text-[10px] font-mono flex-shrink-0" style={{ color: "#9bafc5" }}>{menu.icon}</span>
                    )}
                    <button
                      onClick={() => toggle(menu)}
                      disabled={toggling === menu.id}
                      className="flex-shrink-0 px-2.5 py-1 rounded text-[11px] font-bold transition-opacity"
                      style={menu.is_active
                        ? { background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)", opacity: toggling === menu.id ? 0.5 : 1 }
                        : { background: "rgba(22,163,74,0.08)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.2)", opacity: toggling === menu.id ? 0.5 : 1 }
                      }>
                      {toggling === menu.id ? "…" : menu.is_active ? "Hide" : "Show"}
                    </button>
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
