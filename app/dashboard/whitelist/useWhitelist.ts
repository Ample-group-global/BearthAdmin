"use client";

import { useState, useEffect, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export function useWhitelist() {
  const [addresses, setAddresses] = useState<string[]>([]);
  const [stats, setStats] = useState<{
    merkleRoot: string;
    manualOverride: boolean;
    lastUpdated: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addAddressLoading, setAddAddressLoading] = useState(false);
  const [addAddressesLoading, setAddAddressesLoading] = useState(false);
  const [removeAddressLoading, setRemoveAddressLoading] = useState(false);
  const [testAddressLoading, setTestAddressLoading] = useState(false);
  const [setMerkleRootLoading, setSetMerkleRootLoading] = useState(false);
  const [clearMerkleRootOverrideLoading, setClearMerkleRootOverrideLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/whitelist?limit=1000`, { credentials: "include" });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      setAddresses(data.addresses ?? []);
      if (data.metadata) {
        setStats({
          merkleRoot: data.metadata.merkle_root ?? "0x0",
          manualOverride: Boolean(data.metadata.manual_override),
          lastUpdated: data.metadata.last_updated ?? "",
        });
      }
    } catch (e: unknown) {
      setError((e as Error)?.message || "Failed to load whitelist");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addAddress = useCallback(async (address: string) => {
    setAddAddressLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/whitelist/entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || data.error || "Failed to add address");
      }
      await load();
    } finally {
      setAddAddressLoading(false);
    }
  }, [load]);

  const addAddressesBulk = useCallback(async (list: string[]) => {
    setAddAddressesLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/whitelist/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ addresses: list }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || data.error || "Failed to import addresses");
      }
      await load();
    } finally {
      setAddAddressesLoading(false);
    }
  }, [load]);

  const removeAddress = useCallback(async (address: string) => {
    setRemoveAddressLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/whitelist/${encodeURIComponent(address)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || data.error || "Failed to remove address");
      }
      await load();
    } finally {
      setRemoveAddressLoading(false);
    }
  }, [load]);

  const testAddress = useCallback(async (address: string) => {
    setTestAddressLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/whitelist/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || data.error || "Failed to test address");
      }
      const data = await res.json();
      return { isWhitelisted: Boolean(data.is_whitelisted), proof: data.proof ?? [] };
    } finally {
      setTestAddressLoading(false);
    }
  }, []);

  const setMerkleRoot = useCallback(async (root: string) => {
    setSetMerkleRootLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/whitelist/merkle-root`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ root }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || data.error || "Failed to set merkle root");
      }
      await load();
    } finally {
      setSetMerkleRootLoading(false);
    }
  }, [load]);

  const clearMerkleRootOverride = useCallback(async () => {
    setClearMerkleRootOverrideLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/whitelist/merkle-root`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || data.error || "Failed to clear override");
      }
      await load();
    } finally {
      setClearMerkleRootOverrideLoading(false);
    }
  }, [load]);

  const exportWhitelist = useCallback(async (fmt: "csv" | "json" | "txt") => {
    const res = await fetch(`${API_BASE}/api/whitelist/export?format=${fmt}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Export failed");
    return res.blob();
  }, []);

  return {
    addresses, stats, isLoading, error,
    addAddress, addAddressesBulk, removeAddress, testAddress,
    setMerkleRoot, clearMerkleRootOverride, exportWhitelist,
    addAddressLoading, addAddressesLoading, removeAddressLoading,
    testAddressLoading, setMerkleRootLoading, clearMerkleRootOverrideLoading,
  };
}
