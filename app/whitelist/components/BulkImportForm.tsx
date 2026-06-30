'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from './Button';
import { Badge } from './Badge';

interface BulkImportFormProps {
  onImport: (addresses: string[]) => Promise<void>;
  isLoading: boolean;
  existingAddresses?: string[];
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  validAddresses: string[];
  invalidLines: Array<{ line: number; content: string; reason: string }>;
}

/**
 * Form component for bulk importing addresses
 */
export function BulkImportForm({
  onImport,
  isLoading,
  existingAddresses = [],
}: BulkImportFormProps) {
  const [importMethod, setImportMethod] = useState<'paste' | 'file'>('paste');
  const [rawInput, setRawInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validation = useMemo<ValidationSummary>(() => {
    const lines = rawInput.split('\n').filter((line) => line.trim());
    const validAddresses: string[] = [];
    const invalidLines: ValidationSummary['invalidLines'] = [];
    const seenLower = new Set(existingAddresses.map((a) => a.toLowerCase()));
    let duplicates = 0;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!ADDRESS_REGEX.test(trimmed)) {
        invalidLines.push({
          line: index + 1,
          content: trimmed,
          reason: 'Invalid format',
        });
      } else {
        const lower = trimmed.toLowerCase();
        if (seenLower.has(lower)) {
          duplicates++;
        } else {
          validAddresses.push(trimmed);
          seenLower.add(lower);
        }
      }
    });

    return {
      total: lines.length,
      valid: validAddresses.length,
      invalid: invalidLines.length,
      duplicates,
      validAddresses,
      invalidLines,
    };
  }, [rawInput, existingAddresses]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setRawInput(content);
    };
    reader.readAsText(file);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validation.validAddresses.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onImport(validation.validAddresses);
      setRawInput('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClear = useCallback(() => {
    setRawInput('');
  }, []);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-700 rounded-lg p-4 border border-gray-600">
        <h3 className="text-lg font-semibold mb-4">Bulk Import Addresses</h3>

        {/* Import Method Selector */}
        <div className="flex gap-2 mb-4 border-b border-gray-600 pb-4">
          <button
            type="button"
            onClick={() => setImportMethod('paste')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              importMethod === 'paste'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Paste
          </button>
          <button
            type="button"
            onClick={() => setImportMethod('file')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              importMethod === 'file'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Upload File
          </button>
        </div>

        {/* Input Area */}
        {importMethod === 'paste' ? (
          <textarea
            placeholder="Paste addresses here, one per line&#10;0x1234567890123456789012345678901234567890&#10;0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
            value={rawInput}
            onChange={(e) => setRawInput(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:border-blue-500 focus:ring-blue-500/20 font-mono text-sm h-32"
          />
        ) : (
          <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors">
            <input
              type="file"
              accept=".csv,.json,.txt"
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer block">
              <svg
                className="w-8 h-8 mx-auto mb-2 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <p className="text-white font-medium">Click to upload or drag and drop</p>
              <p className="text-gray-400 text-sm">CSV, JSON, or TXT files</p>
            </label>
          </div>
        )}

        {/* Validation Summary */}
        {rawInput && (
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="info">Total: {validation.total}</Badge>
              <Badge variant="success">Valid: {validation.valid}</Badge>
              {validation.duplicates > 0 && (
                <Badge variant="warning">Duplicates: {validation.duplicates}</Badge>
              )}
              {validation.invalid > 0 && (
                <Badge variant="error">Invalid: {validation.invalid}</Badge>
              )}
            </div>

            {/* Invalid Lines */}
            {validation.invalidLines.length > 0 && (
              <div className="bg-red-900/20 border border-red-700 rounded p-3 max-h-40 overflow-y-auto">
                <p className="text-red-400 font-medium mb-2">Invalid Addresses:</p>
                <ul className="space-y-1 text-xs">
                  {validation.invalidLines.slice(0, 5).map((item, idx) => (
                    <li key={idx} className="text-red-300">
                      Line {item.line}: {item.reason}
                    </li>
                  ))}
                  {validation.invalidLines.length > 5 && (
                    <li className="text-red-300">
                      ... and {validation.invalidLines.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-2 pt-4">
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting || isLoading}
            disabled={validation.validAddresses.length === 0 || isSubmitting || isLoading}
            fullWidth
          >
            Import {validation.valid} Address{validation.valid !== 1 ? 'es' : ''}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClear}
            disabled={!rawInput || isSubmitting || isLoading}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 text-sm text-blue-300">
        <p className="font-medium mb-2">Supported Formats</p>
        <ul className="list-disc list-inside space-y-1 text-xs">
          <li><strong>CSV/TXT:</strong> One address per line</li>
          <li><strong>JSON:</strong> Array of addresses ["0x...", "0x..."]</li>
          <li><strong>Max:</strong> 1000 addresses per import</li>
          <li><strong>Duplicates:</strong> Automatically removed</li>
        </ul>
      </div>
    </form>
  );
}

export default BulkImportForm;
