'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Input } from './Input';
import { Button } from './Button';

interface AddressFormProps {
  onSubmit: (address: string) => Promise<void>;
  isLoading: boolean;
  existingAddresses?: string[];
}

type ValidationType = 'error' | 'warning' | 'info' | 'success' | null;

interface ValidationState {
  type: ValidationType;
  message: string;
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Form component for adding a single address to whitelist
 */
export function AddressForm({
  onSubmit,
  isLoading,
  existingAddresses = [],
}: AddressFormProps) {
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validation = useMemo<ValidationState>(() => {
    if (!address) {
      return { type: null, message: '' };
    }

    if (!ADDRESS_REGEX.test(address)) {
      return {
        type: 'error',
        message: 'Invalid address format. Expected: 0x + 40 hex characters',
      };
    }

    const normalizedAddress = address.toLowerCase();
    const isDuplicate = existingAddresses.some((a) => a.toLowerCase() === normalizedAddress);
    if (isDuplicate) {
      return {
        type: 'warning',
        message: 'This address is already in the whitelist',
      };
    }

    return {
      type: 'success',
      message: 'Address format is valid',
    };
  }, [address, existingAddresses]);

  const isValid = validation.type !== 'error' && validation.type !== 'warning' && address.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(address);
      setAddress('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = useCallback(() => {
    setAddress('');
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
        <h3 className="text-lg font-semibold mb-4">Add Single Address</h3>

        <Input
          label="Ethereum Address"
          type="text"
          placeholder="0x1234567890123456789012345678901234567890"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          monospace
          autoFocus
          error={validation.type === 'error' ? validation.message : undefined}
          hint={
            validation.type === 'warning'
              ? validation.message
              : validation.type === 'success'
                ? validation.message
                : 'Enter a valid Ethereum address'
          }
        />

        <div className="flex gap-2 pt-4">
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting || isLoading}
            disabled={!isValid || isSubmitting || isLoading}
            fullWidth
          >
            Add Address
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClear}
            disabled={!address || isSubmitting || isLoading}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 text-sm text-blue-300">
        <p className="font-medium mb-2">Ethereum Address Format</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li>Starts with "0x"</li>
          <li>Followed by exactly 40 hexadecimal characters (0-9, A-F)</li>
          <li>Case-insensitive (uppercase and lowercase are equivalent)</li>
        </ul>
      </div>
    </form>
  );
}

export default AddressForm;
