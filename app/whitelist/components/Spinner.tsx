'use client';

import React from 'react';

type SpinnerSize = 'sm' | 'md' | 'lg';
type SpinnerVariant = 'primary' | 'white';

interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  label?: string;
}

const sizeStyles: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

const variantStyles: Record<SpinnerVariant, string> = {
  primary: 'text-blue-600',
  white: 'text-white',
};

/**
 * Loading spinner component
 */
export function Spinner({ size = 'md', variant = 'primary', label }: SpinnerProps) {
  const sizeClass = sizeStyles[size];
  const variantClass = variantStyles[variant];

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        className={`animate-spin ${sizeClass} ${variantClass}`}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
        <path
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label && <span className="text-sm text-gray-400">{label}</span>}
    </div>
  );
}

export default Spinner;
