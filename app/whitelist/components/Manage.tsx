'use client';

import React, { useState } from 'react';
import AddressForm from './AddressForm';
import BulkImportForm from './BulkImportForm';
import AddressTable from './AddressTable';

interface ManageProps {
  addresses: string[];
  onAddAddress: (address: string) => Promise<void>;
  onAddBulk: (addresses: string[]) => Promise<void>;
  onRemoveAddress: (address: string) => Promise<void>;
  isLoading: boolean;
}

type FormMode = 'single' | 'bulk';

/**
 * Manage tab for adding and removing whitelist addresses
 */
export function Manage({
  addresses,
  onAddAddress,
  onAddBulk,
  onRemoveAddress,
  isLoading,
}: ManageProps) {
  const [formMode, setFormMode] = useState<FormMode>('single');

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-2">Manage Addresses</h2>
        <p className="text-gray-400">Add or remove addresses from your whitelist</p>
      </div>

      {/* Form Selection Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setFormMode('single')}
          className={`px-4 py-2 font-medium transition-colors ${
            formMode === 'single'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Add Single Address
        </button>
        <button
          onClick={() => setFormMode('bulk')}
          className={`px-4 py-2 font-medium transition-colors ${
            formMode === 'bulk'
              ? 'text-blue-400 border-b-2 border-blue-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Bulk Import
        </button>
      </div>

      {/* Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          {formMode === 'single' && (
            <AddressForm
              onSubmit={onAddAddress}
              isLoading={isLoading}
              existingAddresses={addresses}
            />
          )}

          {formMode === 'bulk' && (
            <BulkImportForm
              onImport={onAddBulk}
              isLoading={isLoading}
              existingAddresses={addresses}
            />
          )}
        </div>

        {/* Address List */}
        <div className="lg:col-span-2">
          <AddressTable
            addresses={addresses}
            onRemove={onRemoveAddress}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}

export default Manage;
