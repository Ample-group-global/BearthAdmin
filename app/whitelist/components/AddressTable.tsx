'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Button } from './Button';
import { Spinner } from './Spinner';

interface AddressTableProps {
  addresses: string[];
  onRemove: (address: string) => Promise<void>;
  isLoading: boolean;
  pageSize?: number;
}

/**
 * Table component for displaying and managing whitelisted addresses
 */
export function AddressTable({
  addresses,
  onRemove,
  isLoading,
  pageSize = 25,
}: AddressTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingAddress, setDeletingAddress] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Filter and sort addresses
  const filteredAddresses = useMemo(() => {
    if (!searchQuery) return addresses;
    const query = searchQuery.toLowerCase();
    return addresses.filter((addr) => addr.toLowerCase().includes(query));
  }, [addresses, searchQuery]);

  // Paginate
  const totalPages = Math.ceil(filteredAddresses.length / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const paginatedAddresses = filteredAddresses.slice(startIdx, endIdx);

  const handleDeleteClick = useCallback((address: string) => {
    setDeletingAddress(address);
    setShowConfirm(true);
  }, []);

  const handleConfirmDelete = async () => {
    if (!deletingAddress) return;

    try {
      await onRemove(deletingAddress);
      setShowConfirm(false);
      setDeletingAddress(null);
      // Reset to first page if current page is now empty
      if (currentPage > totalPages) {
        setCurrentPage(Math.max(1, currentPage - 1));
      }
    } catch (err) {
      // Error handling is done by parent component via toast
      setShowConfirm(false);
      setDeletingAddress(null);
    }
  };

  const handleCopyAddress = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address);
    } catch (err) {
      console.error('Failed to copy address', err);
    }
  };

  if (addresses.length === 0) {
    return (
      <div className="bg-gray-700 rounded-lg p-8 border border-gray-600 text-center">
        <p className="text-gray-400 mb-4">No addresses in whitelist yet</p>
        <p className="text-gray-500 text-sm">Use the form to add addresses</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search by address..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="flex-1 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20"
        />
      </div>

      {/* Table */}
      <div className="bg-gray-700 rounded-lg border border-gray-600 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800 border-b border-gray-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-300">Address</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAddresses.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-8 text-center text-gray-500">
                    No results found
                  </td>
                </tr>
              ) : (
                paginatedAddresses.map((address) => (
                  <tr key={address} className="border-b border-gray-600 hover:bg-gray-600/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-300">{address}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => handleCopyAddress(address)}
                        className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
                        title="Copy address"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => handleDeleteClick(address)}
                        disabled={isLoading || deletingAddress === address}
                        className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors disabled:opacity-50"
                        title="Delete address"
                      >
                        {deletingAddress === address ? <Spinner size="sm" /> : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
                currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {page}
            </button>
          ))}

          <Button
            variant="secondary"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showConfirm && deletingAddress && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold mb-2">Delete Address</h3>
            <p className="text-gray-400 mb-4 text-sm">
              Are you sure you want to remove this address from the whitelist?
            </p>
            <p className="bg-gray-700 rounded p-2 font-mono text-xs mb-4 break-all">{deletingAddress}</p>
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowConfirm(false);
                  setDeletingAddress(null);
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={isLoading}
                disabled={isLoading}
                onClick={handleConfirmDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="text-xs text-gray-500">
        Showing {paginatedAddresses.length} of {filteredAddresses.length} addresses
        {searchQuery && ` (filtered from ${addresses.length})`}
      </div>
    </div>
  );
}

export default AddressTable;
