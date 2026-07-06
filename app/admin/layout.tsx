"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface MenuItem {
  label: string;
  href: string;
  icon: string | null;
  sortOrder: number;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  shield: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  key: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  ),
  menu: (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h7" />
    </svg>
  ),
  "user-check": (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
};

function NavIcon({ icon }: { icon: string | null }): React.ReactNode {
  if (icon && ICON_MAP[icon]) return ICON_MAP[icon];
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M5 12h14" />
    </svg>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [checking, setChecking] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (!data.authenticated) { router.push("/login"); return; }
        if (data.role !== "tech") {
          router.push(data.menus?.[0]?.href ?? "/presale");
          return;
        }
        const adminMenus: MenuItem[] = (data.menus ?? [])
          .filter((m: MenuItem) => m.href?.startsWith("/admin"))
          .sort((a: MenuItem, b: MenuItem) => a.sortOrder - b.sortOrder);
        setMenus(adminMenus.length ? adminMenus : [
          { label: "Roles",        href: "/admin/roles",       icon: "shield",     sortOrder: 10 },
          { label: "Permissions",  href: "/admin/permissions", icon: "key",        sortOrder: 20 },
          { label: "Menu Manager", href: "/admin/menus",       icon: "menu",       sortOrder: 30 },
          { label: "Admin Users",  href: "/admin/users",       icon: "user-check", sortOrder: 40 },
        ]);
        setChecking(false);
      })
      .catch(() => router.push("/login"));
  }, [router]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const currentMenu = menus.find(m => isActive(m.href));

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#f0f2f7" }}>
        <div className="flex flex-col items-center gap-3">
          <svg className="w-7 h-7 animate-spin" style={{ color: "#41afeb" }} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-xs font-medium" style={{ color: "#9bafc5" }}>Verifying access…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={{ background: "#f0f2f7", fontFamily: "'hoss-round', 'Figtree', system-ui, sans-serif" }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className="flex-shrink-0 flex flex-col transition-all duration-200 ease-in-out overflow-hidden"
        style={{ background: "#0f1726", width: collapsed ? "48px" : "210px", boxShadow: "2px 0 8px rgba(0,0,0,0.22)" }}
      >
        {/* Brand */}
        {collapsed ? (
          <div className="flex-shrink-0 flex items-center justify-center" style={{ height: "44px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              onClick={() => setCollapsed(false)}
              className="w-8 h-8 flex items-center justify-center rounded transition-colors"
              style={{ color: "rgba(255,255,255,0.4)" }}
              title="Expand"
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center flex-shrink-0 px-2 gap-2" style={{ height: "44px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <Image src="/icon.png" alt="Bearth" width={26} height={26} className="rounded-md flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white leading-none">Admin</div>
              <div className="text-[10px] font-semibold mt-0.5 leading-none" style={{ color: "#f59e0b" }}>RBAC Management</div>
            </div>
            <button onClick={() => setCollapsed(true)} className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-colors"
              style={{ color: "rgba(255,255,255,0.25)" }} title="Collapse"
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#fff"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.25)"; }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "none" }}>
          {!collapsed && (
            <p className="px-3 pt-1 pb-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.2)" }}>System</p>
          )}
          {menus.map(item => {
            const active = isActive(item.href);
            return (
              <div key={item.href} className="relative group px-1.5 mb-0.5">
                <Link href={item.href}
                  className="flex items-center gap-2.5 rounded text-xs font-medium transition-all duration-150"
                  style={{
                    padding: collapsed ? "7px 0" : "6px 8px",
                    justifyContent: collapsed ? "center" : undefined,
                    background: active ? "rgba(245,158,11,0.15)" : "transparent",
                    color: active ? "#fff" : "rgba(255,255,255,0.45)",
                    borderLeft: active && !collapsed ? "2px solid #f59e0b" : "2px solid transparent",
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.8)"; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; } }}
                  title={collapsed ? item.label : undefined}
                >
                  <span style={{ color: active ? "#f59e0b" : "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                    <NavIcon icon={item.icon} />
                  </span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
                {collapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
                    style={{ background: "#1e2d4a", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer links */}
        <div className="px-1.5 py-2 flex-shrink-0 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Back to Presale */}
          {!collapsed && (
            <Link href="/presale"
              className="w-full flex items-center gap-2.5 rounded text-xs font-medium transition-colors duration-150 px-2 py-1.5"
              style={{ color: "rgba(255,255,255,0.3)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(65,175,235,0.1)"; e.currentTarget.style.color = "#41afeb"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
            >
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Presale</span>
            </Link>
          )}
          <div className="relative group">
            <button onClick={logout}
              className="w-full flex items-center gap-2.5 rounded text-xs font-medium transition-colors duration-150"
              style={{ padding: collapsed ? "7px 0" : "6px 8px", justifyContent: collapsed ? "center" : undefined, color: "rgba(255,255,255,0.3)" }}
              title={collapsed ? "Sign Out" : undefined}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#f87171"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {!collapsed && <span>Sign Out</span>}
            </button>
            {collapsed && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50"
                style={{ background: "#1e2d4a", border: "1px solid rgba(255,255,255,0.1)" }}>Sign Out</div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="flex-shrink-0 flex items-center justify-between px-5 bg-white"
          style={{ height: "44px", borderBottom: "1px solid #e4e7ed", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-bold" style={{ color: "#24315f" }}>Admin</span>
            <svg className="w-3 h-3" style={{ color: "#c4c9d4" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-semibold" style={{ color: "#6b7280" }}>{currentMenu?.label ?? "RBAC"}</span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold"
            style={{ background: "rgba(245,158,11,0.08)", color: "#d97706", border: "1px solid rgba(245,158,11,0.2)" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Technical
          </span>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
