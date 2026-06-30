'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface WhitelistStats {
  total: number;
  merkleRoot?: string;
  lastUpdated?: string;
  timestamp?: number;
  manualOverride?: boolean;
}

interface WhitelistMetaApi {
  merkle_root?: string;
  last_updated?: string;
  timestamp?: number;
  manual_override?: boolean;
}

export interface WhitelistResponse {
  addresses: string[];
  metadata?: WhitelistMetaApi;
}

export interface ProofData {
  isWhitelisted: boolean;
  address: string;
  proof: string[];
  root: string;
  leafIndex?: number | null;
  generatedAt: string;
}

/**
 * Main hook for managing whitelist state and API interactions
 * Uses TanStack Query for caching and synchronization
 */
export function useWhitelist() {
  const queryClient = useQueryClient();

  // Fetch whitelist
  const {
    data: response = { addresses: [], metadata: {} },
    isLoading,
    error,
    refetch,
  } = useQuery<WhitelistResponse>({
    queryKey: ['whitelist'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/whitelist`, { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`Failed to fetch whitelist: ${res.statusText}`);
      }
      return res.json();
    },
    staleTime: 30000, // 30 seconds
    retry: 2,
  });

  const addresses = response.addresses || [];
  const meta = response.metadata || {};
  const stats: WhitelistStats = {
    total: addresses.length,
    merkleRoot: meta.merkle_root,
    lastUpdated: meta.last_updated,
    timestamp: meta.timestamp,
    manualOverride: meta.manual_override ?? false,
  };

  // Add single address mutation
  const addAddressMutation = useMutation({
    mutationFn: async (address: string) => {
      const res = await fetch(`${API_BASE}/api/whitelist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ addresses: [address] }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add address');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
    },
  });

  // Add bulk addresses mutation
  const addAddressesMutation = useMutation({
    mutationFn: async (addrs: string[]) => {
      const res = await fetch(`${API_BASE}/api/whitelist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ addresses: addrs }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to add addresses');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
    },
  });

  // Remove address mutation
  const removeAddressMutation = useMutation({
    mutationFn: async (address: string) => {
      const res = await fetch(`${API_BASE}/api/whitelist/${address}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove address');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
    },
  });

  // Set merkle root (manual override). Subsequent whitelist edits will NOT
  // recompute the root until clearMerkleRootOverride is called.
  const setMerkleRootMutation = useMutation({
    mutationFn: async (root: string) => {
      const res = await fetch(`${API_BASE}/api/whitelist/merkle-root`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ root }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `Failed to set merkle root (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
    },
  });

  // Clear manual override and recompute from current whitelist.
  const clearMerkleRootOverrideMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/api/whitelist/merkle-root`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.error || `Failed to clear override (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist'] });
    },
  });

  // Test address membership
  const testAddressMutation = useMutation({
    mutationFn: async (address: string): Promise<ProofData> => {
      const res = await fetch(`${API_BASE}/api/whitelist/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ address }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to test address');
      }
      return res.json();
    },
  });

  // Export whitelist
  const exportWhitelist = async (format: 'csv' | 'json' | 'txt' = 'json') => {
    const res = await fetch(`${API_BASE}/api/whitelist/export?format=${format}`, { credentials: 'include' });
    if (!res.ok) {
      throw new Error('Failed to export whitelist');
    }
    return res.blob();
  };

  return {
    // State
    addresses,
    stats,
    isLoading,
    error: error ? (error as Error).message : null,

    // Actions
    addAddress: addAddressMutation.mutateAsync,
    addAddressesBulk: addAddressesMutation.mutateAsync,
    removeAddress: removeAddressMutation.mutateAsync,
    testAddress: testAddressMutation.mutateAsync,
    setMerkleRoot: setMerkleRootMutation.mutateAsync,
    clearMerkleRootOverride: clearMerkleRootOverrideMutation.mutateAsync,
    refetch,

    // Mutations for loading state
    addAddressLoading: addAddressMutation.isPending,
    addAddressesLoading: addAddressesMutation.isPending,
    removeAddressLoading: removeAddressMutation.isPending,
    testAddressLoading: testAddressMutation.isPending,
    setMerkleRootLoading: setMerkleRootMutation.isPending,
    clearMerkleRootOverrideLoading: clearMerkleRootOverrideMutation.isPending,

    // Export
    exportWhitelist,
  };
}
