"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";

export function WalletButton() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  if (!ready) {
    return (
      <button disabled className="px-3 py-1.5 rounded-lg text-sm opacity-50"
        style={{ border: "1px solid #e5e7eb", color: "#9bafc5", background: "#f4f6fb" }}>
        Loading…
      </button>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white transition-all"
        style={{ background: "#41afeb" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#2e9fd8")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "#41afeb")}
      >
        Connect Wallet
      </button>
    );
  }

  const wallet = wallets[0];
  const addr = wallet?.address;
  const display = addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "Connected";

  return (
    <div className="flex items-center gap-2">
      <span
        className="px-3 py-1.5 rounded-lg font-mono text-xs font-medium"
        style={{ background: "rgba(65,175,235,0.08)", border: "1px solid rgba(65,175,235,0.2)", color: "#2e9fd8" }}
      >
        {display}
      </span>
      <button
        onClick={logout}
        className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
        style={{ border: "1px solid #fecaca", color: "#ef4444", background: "transparent" }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "#fef2f2"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
      >
        Disconnect
      </button>
    </div>
  );
}
