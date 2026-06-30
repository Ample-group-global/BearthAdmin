'use client';

import React, { useState } from 'react';
import { Input } from './Input';
import { Button } from './Button';
import { Badge } from './Badge';
import type { ProofData } from '../hooks/useWhitelist';

interface TestProps {
  onTestAddress: (address: string) => Promise<ProofData>;
  isLoading: boolean;
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Test tab for checking address membership and generating proofs
 */
export function Test({ onTestAddress, isLoading }: TestProps) {
  const [testAddress, setTestAddress] = useState('');
  const [proofData, setProofData] = useState<ProofData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'proof' | 'root' | null>(null);

  const isValidAddress = ADDRESS_REGEX.test(testAddress);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAddress || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    setProofData(null);

    try {
      const result = await onTestAddress(testAddress);
      setProofData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to test address');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = async (text: string, field: 'proof' | 'root') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Test Membership</h2>
        <p className="text-gray-400">Check if an address is whitelisted and get its merkle proof</p>
      </div>

      {/* Test Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
          <Input
            label="Ethereum Address"
            type="text"
            placeholder="0x1234567890123456789012345678901234567890"
            value={testAddress}
            onChange={(e) => setTestAddress(e.target.value)}
            monospace
            hint="Enter the address to test for whitelist membership"
          />

          <div className="flex gap-2 mt-4">
            <Button
              type="submit"
              variant="primary"
              loading={isSubmitting || isLoading}
              disabled={!isValidAddress || isSubmitting || isLoading}
              fullWidth
            >
              Test Address
            </Button>
          </div>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-400">
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Results */}
      {proofData && (
        <div className="space-y-4">
          {/* Status */}
          <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
            <h3 className="text-lg font-semibold mb-4">Result</h3>
            <div className="flex items-center gap-4 mb-4">
              <span className="text-gray-400">Status:</span>
              {proofData.isWhitelisted ? (
                <Badge variant="success">Whitelisted</Badge>
              ) : (
                <Badge variant="error">Not Whitelisted</Badge>
              )}
            </div>

            {/* Address */}
            <div className="bg-gray-800 rounded p-3 font-mono text-xs break-all text-gray-300 mb-4">
              {proofData.address}
            </div>

            {/* Test Time */}
            <p className="text-sm text-gray-500">
              Tested at {new Date(proofData.generatedAt).toLocaleString()}
            </p>
          </div>

          {/* Merkle Root */}
          <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
            <h3 className="text-lg font-semibold mb-4">Merkle Root</h3>
            <div className="bg-gray-800 rounded p-3 font-mono text-xs break-all text-gray-300 mb-3">
              {proofData.root}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleCopy(proofData.root, 'root')}
              fullWidth
            >
              {copiedField === 'root' ? 'Copied!' : 'Copy Root'}
            </Button>
          </div>

          {/* Merkle Proof */}
          {proofData.isWhitelisted && proofData.proof.length > 0 && (
            <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
              <h3 className="text-lg font-semibold mb-4">Merkle Proof</h3>
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {proofData.proof.map((hash, idx) => (
                  <div key={idx} className="bg-gray-800 rounded p-2 font-mono text-xs break-all text-gray-300">
                    {idx + 1}. {hash}
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(JSON.stringify(proofData.proof, null, 2), 'proof')}
                fullWidth
              >
                {copiedField === 'proof' ? 'Copied!' : 'Copy Proof as JSON'}
              </Button>
            </div>
          )}

          {/* Info */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 text-sm text-blue-300">
            <p className="font-medium mb-2">About Merkle Proofs</p>
            <p className="text-xs">
              The merkle proof is used to verify whitelist membership without storing all addresses on-chain.
              Users can provide their address and proof to the smart contract to verify membership.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default Test;
