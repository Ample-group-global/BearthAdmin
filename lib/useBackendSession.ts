"use client";

import { useEffect, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Syncs Privy wallet auth with the Railway backend session.
 * After Privy login, POST the wallet address to /api/auth/session
 * so all subsequent API calls carry the session cookie.
 */
export function useBackendSession() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const lastSynced = useRef<string | null>(null);

  useEffect(() => {
    const address = wallets?.[0]?.address;
    if (!API_BASE || !authenticated || !address) {
      // User logged out — clear backend session
      if (!authenticated && lastSynced.current) {
        fetch(`${API_BASE}/api/auth/session`, {
          method: "DELETE",
          credentials: "include",
        }).catch(() => {});
        lastSynced.current = null;
      }
      return;
    }

    // Already synced this address
    if (lastSynced.current === address.toLowerCase()) return;

    fetch(`${API_BASE}/api/auth/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ address }),
    })
      .then((res) => {
        if (res.ok) lastSynced.current = address.toLowerCase();
      })
      .catch(() => {});
  }, [authenticated, wallets]);
}
