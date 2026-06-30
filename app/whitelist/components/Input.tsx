'use client';

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  monospace?: boolean;
}

/**
 * Form input component with validation states and helper text
 */
export function Input({
  label,
  error,
  hint,
  monospace = false,
  id,
  className,
  ...props
}: InputProps) {
  const inputId = id || Math.random().toString(36).substring(7);
  const monoClass = monospace ? 'font-mono' : '';
  const borderClass = error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : 'border-gray-600 focus:border-blue-500 focus:ring-blue-500/20';

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-white">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-3 py-2 rounded-lg bg-gray-700 border ${borderClass} text-white placeholder-gray-500 focus:outline-none focus:ring-2 transition-all ${monoClass} ${className || ''}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export default Input;
