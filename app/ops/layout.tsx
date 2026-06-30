"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const NAV_ITEMS = [
  {
    href: "/ops",
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
    href: "/ops/whitelist",
    label: "Whitelist",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/ops/nfts",
    label: "NFT Gallery",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const isActive = (item: (typeof NAV_ITEMS)[0]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <div className="flex h-screen bg-[#f4f6fb]" style={{ fontFamily: "'hoss-round', 'Figtree', sans-serif" }}>
      {/* Sidebar — Bearth navy */}
      <aside className="w-60 flex-shrink-0 flex flex-col" style={{ background: "#24315f" }}>
        {/* Logo */}
        <div
          className="h-16 flex items-center px-5 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2.5">
            <Image src="/icon.png" alt="Bearth" width={32} height={32} className="rounded-lg" />
            <div>
              <div className="text-sm font-bold text-white leading-tight">Bearth NFT</div>
              <div className="text-xs font-medium" style={{ color: "#41afeb" }}>Operations Staff</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
            Navigation
          </p>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
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
                {item.label}
                {active && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "#41afeb" }} />}
              </Link>
            );
          })}
        </nav>

        {/* Info box */}
        <div
          className="mx-3 mb-3 p-3 rounded-xl text-xs"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" }}
        >
          <p className="font-semibold text-white mb-1">Operations Access</p>
          <p>View NFT stats, whitelist info, and gallery. Contact technical admin for contract changes.</p>
        </div>

        {/* Footer */}
        <div className="px-3 py-3 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
            style={{ color: "rgba(255,255,255,0.5)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.15)"; e.currentTarget.style.color = "#f87171"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white flex items-center justify-between px-6 flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div>
            <span className="text-sm font-semibold text-gray-800">
              {NAV_ITEMS.find(isActive)?.label ?? "Dashboard"}
            </span>
            <span className="text-sm" style={{ color: "#9bafc5" }}> — Operations</span>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: "#9bafc5" }}>
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#41afeb" }} />
            Operations Staff
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
