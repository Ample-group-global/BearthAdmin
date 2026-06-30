"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { WalletButton } from "@/components/WalletButton";
import { ChainSelector } from "@/components/ChainSelector";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Overview",
    exact: true,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/whitelist",
    label: "Whitelist",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/dashboard/contract",
    label: "Contract",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    href: "/dashboard/nfts",
    label: "NFT Overview",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/generator",
    label: "NFT Studio",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const isActive = (item: (typeof NAV_ITEMS)[0]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

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
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
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
                  {item.icon}
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
            <span className="text-sm font-semibold text-gray-800">
              {NAV_ITEMS.find(isActive)?.label ?? "Dashboard"}
            </span>
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
