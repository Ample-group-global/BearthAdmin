'use client';

import React, { useState } from 'react';

const ROOT_RE = /^0x[a-fA-F0-9]{64}$/;

interface MerkleRootPanelProps {
  currentRoot: string | undefined;
  manualOverride: boolean;
  onSetRoot: (root: string) => Promise<unknown>;
  onClearOverride: () => Promise<unknown>;
  setLoading: boolean;
  clearLoading: boolean;
}

export function MerkleRootPanel({
  currentRoot,
  manualOverride,
  onSetRoot,
  onClearOverride,
  setLoading,
  clearLoading,
}: MerkleRootPanelProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const trimmed = input.trim();
    if (!ROOT_RE.test(trimmed)) {
      setError('Root must be a 0x-prefixed 32-byte hex string (66 chars).');
      return;
    }
    try {
      await onSetRoot(trimmed);
      setSuccess('Merkle root override applied.');
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set root.');
    }
  };

  const clear = async () => {
    setError(null);
    setSuccess(null);
    try {
      await onClearOverride();
      setSuccess('Override cleared. Root recomputed from whitelist.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear override.');
    }
  };

  return (
    <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Merkle Root</h3>
        <span
          className={`text-xs font-medium px-2 py-1 rounded ${
            manualOverride
              ? 'bg-yellow-900/40 text-yellow-300 border border-yellow-700'
              : 'bg-gray-800 text-gray-400 border border-gray-600'
          }`}
        >
          {manualOverride ? 'Manual override ON' : 'Auto'}
        </span>
      </div>

      <div className="bg-gray-800 rounded p-3 font-mono text-xs break-all text-gray-300 mb-4">
        {currentRoot || 'Not generated'}
      </div>

      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-xs text-gray-400">Override root (0x + 64 hex)</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0x704f15979cd434504c58c54632838ec88459158d4679205e1a10b505c487e196"
            className="mt-1 block w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 font-mono text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-blue-500"
            spellCheck={false}
            autoComplete="off"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={setLoading || input.trim().length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            {setLoading ? 'Setting…' : 'Set root'}
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={!manualOverride || clearLoading}
            className="bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            {clearLoading ? 'Clearing…' : 'Clear override'}
          </button>
        </div>
      </form>

      {error && (
        <p className="mt-3 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-3 text-xs text-green-400" role="status">
          {success}
        </p>
      )}

      <p className="mt-4 text-xs text-gray-500">
        Setting a root marks the whitelist root as a manual override — subsequent
        add/remove operations will not recompute the root until you clear the
        override.
      </p>
    </div>
  );
}

export default MerkleRootPanel;
