'use client';

import React, { useState, useMemo } from 'react';
import { Button } from './Button';
import { Badge } from './Badge';
import type { WhitelistStats } from '../hooks/useWhitelist';

interface ExportProps {
  addresses: string[];
  stats: Partial<WhitelistStats> | Record<string, any>;
  onExport: (format: 'csv' | 'json' | 'txt') => Promise<void>;
}

/**
 * Export tab for downloading whitelist data in various formats
 */
export function Export({ addresses, stats, onExport }: ExportProps) {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'json' | 'txt'>('json');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Generate preview
  const preview = useMemo(() => {
    if (addresses.length === 0) return '';

    const sample = addresses.slice(0, 3);

    switch (selectedFormat) {
      case 'csv':
        return `address\n${sample.join('\n')}\n...`;
      case 'txt':
        return sample.join('\n') + '\n...';
      case 'json':
      default:
        if (includeMetadata) {
          return JSON.stringify(
            {
              whitelist: sample,
              metadata: {
                total: addresses.length,
                merkleRoot: (stats as any)?.merkleRoot?.substring(0, 20) + '...' || 'N/A',
                exportedAt: new Date().toISOString(),
              },
            },
            null,
            2
          );
        } else {
          return JSON.stringify(sample, null, 2);
        }
    }
  }, [selectedFormat, addresses, includeMetadata, stats]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport(selectedFormat);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Export Whitelist</h2>
        <p className="text-gray-400">Download your whitelist in various formats</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Export Options */}
        <div className="space-y-4">
          <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
            <h3 className="text-lg font-semibold mb-4">Export Settings</h3>

            {/* Format Selection */}
            <div className="mb-6">
              <p className="text-sm font-medium mb-3">Format</p>
              <div className="space-y-2">
                {(['csv', 'json', 'txt'] as const).map((format) => (
                  <label key={format} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="format"
                      value={format}
                      checked={selectedFormat === format}
                      onChange={(e) => setSelectedFormat(e.target.value as typeof format)}
                      className="w-4 h-4"
                    />
                    <span className="text-white">
                      {format.toUpperCase()}
                      {format === 'csv' && ' - Spreadsheet Compatible'}
                      {format === 'json' && ' - Structured Data'}
                      {format === 'txt' && ' - Plain Text'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Options */}
            {selectedFormat === 'json' && (
              <div className="mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMetadata}
                    onChange={(e) => setIncludeMetadata(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-white text-sm">Include metadata (root, timestamp)</span>
                </label>
              </div>
            )}

            {/* Stats */}
            <div className="bg-gray-800 rounded p-3 mb-6 text-sm">
              <p className="text-gray-400 mb-2">Export Statistics:</p>
              <div className="space-y-1 text-gray-300">
                <p>Addresses: <span className="font-mono">{addresses.length}</span></p>
                <p>Format: <span className="font-mono">{selectedFormat.toUpperCase()}</span></p>
                <p>
                  File size: ~
                  <span className="font-mono">
                    {Math.round((addresses.length * 45) / 1024)}
                    KB
                  </span>
                </p>
              </div>
            </div>

            {/* Export Button */}
            <Button
              variant="primary"
              loading={isExporting}
              disabled={addresses.length === 0 || isExporting}
              onClick={handleExport}
              fullWidth
            >
              Download {selectedFormat.toUpperCase()}
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
            <h3 className="text-lg font-semibold mb-4">Preview</h3>
            <div className="bg-gray-800 rounded p-3 font-mono text-xs text-gray-300 max-h-80 overflow-y-auto whitespace-pre-wrap break-words">
              {preview || 'No data to export'}
            </div>
          </div>

          {/* Info */}
          <div className="space-y-2">
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-4 text-sm text-green-300">
              <p className="font-medium mb-1">CSV Format</p>
              <p className="text-xs">Perfect for importing into Excel or Google Sheets</p>
            </div>

            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 text-sm text-blue-300">
              <p className="font-medium mb-1">JSON Format</p>
              <p className="text-xs">Structured format ideal for programmatic processing</p>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4 text-sm text-yellow-300">
              <p className="font-medium mb-1">TXT Format</p>
              <p className="text-xs">Simple text file with one address per line</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Export;
