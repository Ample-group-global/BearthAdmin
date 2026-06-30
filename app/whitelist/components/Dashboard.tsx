'use client';

import React, { useState } from 'react';
import { useWhitelist } from '../hooks/useWhitelist';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './Toast';
import { Spinner } from './Spinner';
import Overview from './Overview';
import Manage from './Manage';
import Test from './Test';
import Export from './Export';

type TabName = 'overview' | 'manage' | 'test' | 'export';

const TAB_LABELS: Record<TabName, string> = {
  overview: 'Overview',
  manage: 'Manage',
  test: 'Test',
  export: 'Export',
};

const TABS: TabName[] = ['overview', 'manage', 'test', 'export'];

/**
 * Main dashboard container managing tab state and global operations
 */
export function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabName>('overview');
  const { toasts, showToast, removeToast } = useToast();
  const {
    addresses,
    stats: statsData = {},
    isLoading,
    error: whitelistError,
    addAddress,
    addAddressesBulk,
    removeAddress,
    testAddress,
    setMerkleRoot,
    clearMerkleRootOverride,
    exportWhitelist,
    addAddressLoading,
    addAddressesLoading,
    removeAddressLoading,
    testAddressLoading,
    setMerkleRootLoading,
    clearMerkleRootOverrideLoading,
  } = useWhitelist();

  // Ensure stats has proper type
  const stats: Record<string, any> = statsData || {};

  React.useEffect(() => {
    if (whitelistError) {
      showToast(whitelistError, 'error');
    }
  }, [whitelistError, showToast]);

  const handleAddAddress = async (address: string) => {
    try {
      await addAddress(address);
      showToast('Address added successfully', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add address';
      showToast(message, 'error');
    }
  };

  const handleAddBulk = async (addrs: string[]) => {
    try {
      await addAddressesBulk(addrs);
      showToast(`${addrs.length} addresses added successfully`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add addresses';
      showToast(message, 'error');
    }
  };

  const handleRemoveAddress = async (address: string) => {
    try {
      await removeAddress(address);
      showToast('Address removed successfully', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove address';
      showToast(message, 'error');
    }
  };

  const handleTestAddress = async (address: string) => {
    try {
      const result = await testAddress(address);
      if (result.isWhitelisted) {
        showToast('Address is whitelisted', 'success');
      } else {
        showToast('Address is not whitelisted', 'warning');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to test address';
      showToast(message, 'error');
      throw err;
    }
  };

  const handleSetMerkleRoot = async (root: string) => {
    try {
      await setMerkleRoot(root);
      showToast('Merkle root override applied', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to set merkle root';
      showToast(message, 'error');
      throw err;
    }
  };

  const handleClearMerkleRootOverride = async () => {
    try {
      await clearMerkleRootOverride();
      showToast('Override cleared, root recomputed', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clear override';
      showToast(message, 'error');
      throw err;
    }
  };

  const handleExport = async (format: 'csv' | 'json' | 'txt') => {
    try {
      const blob = await exportWhitelist(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `whitelist-${new Date().toISOString().split('T')[0]}.${format === 'txt' ? 'txt' : format}`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Whitelist exported successfully', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to export whitelist';
      showToast(message, 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Spinner size="lg" label="Loading whitelist..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Whitelist Management</h1>
          <p className="text-gray-400">Manage your NFT whitelist addresses</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <p className="text-gray-400 text-sm mb-2">Total Addresses</p>
            <p className="text-3xl font-bold">{addresses.length}</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <p className="text-gray-400 text-sm mb-2">Merkle Root</p>
            <p className="text-sm font-mono truncate">{stats?.merkleRoot?.substring(0, 16) || 'N/A'}...</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <p className="text-gray-400 text-sm mb-2">Last Updated</p>
            <p className="text-sm">{stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Never'}</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <p className="text-gray-400 text-sm mb-2">Status</p>
            <p className="text-sm font-medium text-green-400">Active</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 border-b border-gray-700 mb-8 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'text-blue-400 border-b-2 border-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
              aria-current={activeTab === tab ? 'page' : undefined}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          {activeTab === 'overview' && (
            <Overview
              stats={stats}
              totalAddresses={addresses.length}
              onSetMerkleRoot={handleSetMerkleRoot}
              onClearMerkleRootOverride={handleClearMerkleRootOverride}
              setMerkleRootLoading={setMerkleRootLoading}
              clearMerkleRootOverrideLoading={clearMerkleRootOverrideLoading}
            />
          )}

          {activeTab === 'manage' && (
            <Manage
              addresses={addresses}
              onAddAddress={handleAddAddress}
              onAddBulk={handleAddBulk}
              onRemoveAddress={handleRemoveAddress}
              isLoading={addAddressLoading || addAddressesLoading || removeAddressLoading}
            />
          )}

          {activeTab === 'test' && (
            <Test
              onTestAddress={handleTestAddress}
              isLoading={testAddressLoading}
            />
          )}

          {activeTab === 'export' && (
            <Export
              addresses={addresses}
              stats={stats}
              onExport={handleExport}
            />
          )}
        </div>
      </div>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}

export default Dashboard;
