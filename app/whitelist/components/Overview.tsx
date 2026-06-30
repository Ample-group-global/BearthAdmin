'use client';

import React from 'react';
import type { WhitelistStats } from '../hooks/useWhitelist';
import { MerkleRootPanel } from './MerkleRootPanel';

interface OverviewProps {
  stats: Partial<WhitelistStats> | Record<string, any>;
  totalAddresses: number;
  onSetMerkleRoot: (root: string) => Promise<unknown>;
  onClearMerkleRootOverride: () => Promise<unknown>;
  setMerkleRootLoading: boolean;
  clearMerkleRootOverrideLoading: boolean;
}

/**
 * Overview tab showing dashboard summary and statistics
 */
export function Overview({
  stats,
  totalAddresses,
  onSetMerkleRoot,
  onClearMerkleRootOverride,
  setMerkleRootLoading,
  clearMerkleRootOverrideLoading,
}: OverviewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Dashboard Overview</h2>
        <p className="text-gray-400">Summary of your whitelist and recent activity</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
          <h3 className="text-lg font-semibold mb-4">Whitelist Statistics</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-400">Total Addresses:</dt>
              <dd className="font-mono text-white">{totalAddresses}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Status:</dt>
              <dd className="text-green-400 font-medium">Active</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-400">Last Updated:</dt>
              <dd className="text-gray-300">
                {stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Never'}
              </dd>
            </div>
          </dl>
        </div>

        <MerkleRootPanel
          currentRoot={stats.merkleRoot}
          manualOverride={Boolean(stats.manualOverride)}
          onSetRoot={onSetMerkleRoot}
          onClearOverride={onClearMerkleRootOverride}
          setLoading={setMerkleRootLoading}
          clearLoading={clearMerkleRootOverrideLoading}
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <a
            href="#manage"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-center text-sm font-medium transition-colors"
          >
            Add Addresses
          </a>
          <a
            href="#test"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-center text-sm font-medium transition-colors"
          >
            Test Membership
          </a>
          <a
            href="#export"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-center text-sm font-medium transition-colors"
          >
            Export Data
          </a>
          <a
            href="#manage"
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-center text-sm font-medium transition-colors"
          >
            Manage List
          </a>
        </div>
      </div>

      {/* Information */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-2 text-blue-300">About Whitelisting</h3>
        <p className="text-sm text-gray-300">
          The whitelist is a list of Ethereum addresses that are eligible to mint NFTs. Use the Manage tab
          to add or remove addresses, the Test tab to verify membership, and the Export tab to download
          your whitelist data.
        </p>
      </div>
    </div>
  );
}

export default Overview;
