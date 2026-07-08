"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { WalletButton } from "@/components/WalletButton";
import { ChainSelector } from "@/components/ChainSelector";

interface MenuItem {
  label: string;
  href: string;
  icon: string | null;
  module: string | null;
  sortOrder: number;
}

const ICON_SVG: Record<string, React.ReactNode> = {
  grid: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  ),
  "clipboard-list": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  code: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  image: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  bulb: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  "bar-chart": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  "user-cog": (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

const DEFAULT_ICON = (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const FALLBACK_NAV: MenuItem[] = [
  { label: "Overview",    href: "/dashboard",           icon: "grid",           module: "dashboard", sortOrder: 10 },
  { label: "Whitelist",   href: "/dashboard/whitelist", icon: "clipboard-list", module: "dashboard", sortOrder: 20 },
  { label: "Contract",    href: "/dashboard/contract",  icon: "code",           module: "dashboard", sortOrder: 30 },
  { label: "NFT Overview",href: "/dashboard/nfts",      icon: "image",          module: "dashboard", sortOrder: 40 },
  { label: "NFT Studio",  href: "/dashboard/generator", icon: "bulb",           module: "dashboard", sortOrder: 50 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [navItems, setNavItems] = useState<MenuItem[]>(FALLBACK_NAV);
  const [pageTitle, setPageTitle] = useState("Dashboard");

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.menus) && data.menus.length > 0) {
          const items: MenuItem[] = (data.menus as Array<{
            label: string; href: string; icon?: string; module?: string; sortOrder?: number;
          }>)
            .filter(m => m.module === "dashboard" || m.href.startsWith("/dashboard"))
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map(m => ({ label: m.label, href: m.href, icon: m.icon ?? null, module: m.module ?? null, sortOrder: m.sortOrder ?? 0 }));
          if (items.length > 0) setNavItems(items);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const match = navItems.find(item =>
      item.sortOrder === 10 ? pathname === item.href : pathname.startsWith(item.href)
    );
    setPageTitle(match?.label ?? "Dashboard");
  }, [pathname, navItems]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const isActive = (item: MenuItem) =>
    item.sortOrder === 10 ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="flex h-screen bg-[#f4f6fb]" style={{ fontFamily: "'hoss-round', 'Figtree', sans-serif" }}>
      {/* Sidebar — Bearth navy */}
      <aside
        className={`${sidebarOpen ? "w-60" : "w-16"} flex-shrink-0 flex flex-col transition-all duration-200`}
        style={{ background: "#24315f" }}
      >
        {/* Logo */}
        <div
          className="h-16 flex items-center justify-between px-4 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          {sidebarOpen && (
            <div className="flex items-center gap-2.5">
              <Image src="/icon.png" alt="Bearth" width={32} height={32} className="rounded-lg" />
              <div>
                <div className="text-sm font-bold text-white leading-tight">Bearth NFT</div>
                <div className="text-xs font-medium" style={{ color: "#41afeb" }}>Technical Admin</div>
              </div>
            </div>
          )}
          {!sidebarOpen && (
            <div className="flex justify-center w-full">
              <Image src="/icon.png" alt="Bearth" width={28} height={28} className="rounded-md" />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-md transition-colors flex-shrink-0"
            style={{ color: "rgba(255,255,255,0.5)" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
            onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {sidebarOpen && (
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
              Management
            </p>
          )}
          {navItems.map((item) => {
            const active = isActive(item);
            const icon = item.icon ? (ICON_SVG[item.icon] ?? DEFAULT_ICON) : DEFAULT_ICON;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={!sidebarOpen ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${!sidebarOpen ? "justify-center" : ""}`}
                style={{
                  background: active ? "rgba(65,175,235,0.15)" : "transparent",
                  color: active ? "#41afeb" : "rgba(255,255,255,0.65)",
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#fff"; }}}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}}
              >
                <span style={{ color: active ? "#41afeb" : "rgba(255,255,255,0.4)" }}>
                  {icon}
                </span>
                {sidebarOpen && item.label}
                {active && sidebarOpen && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "#41afeb" }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={logout}
            title={!sidebarOpen ? "Sign Out" : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${!sidebarOpen ? "justify-center" : ""}`}
            style={{ color: "rgba(255,255,255,0.5)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; e.currentTarget.style.color = "#f87171"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {sidebarOpen && "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white flex items-center justify-between px-6 flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div>
            <span className="text-sm font-semibold text-gray-800">{pageTitle}</span>
            <span className="text-sm" style={{ color: "#9bafc5" }}> — Technical Admin</span>
          </div>
          <div className="flex items-center gap-3">
            <ChainSelector />
            <WalletButton />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
