"use client";

import { useEffect, useRef } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";

export function useBackendSession() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const lastSynced = useRef<string | null>(null);
  useEffect(() => {
    const address = wallets?.[0]?.address;
    if (!authenticated || !address) {
      if (!authenticated && lastSynced.current) {
        fetch("/api/auth/session", {
          method: "DELETE",
          credentials: "include",
        }).catch(() => { });
        lastSynced.current = null;
      }
      return;
    }

    if (lastSynced.current === address.toLowerCase()) return;

    fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ address }),
    })
      .then((res) => {
        if (res.ok) lastSynced.current = address.toLowerCase();
      })
      .catch(() => { });
  }, [authenticated, wallets]);
}
