'use client';

import React from 'react';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  variant: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-900/30 text-green-400 border border-green-700',
  error: 'bg-red-900/30 text-red-400 border border-red-700',
  warning: 'bg-yellow-900/30 text-yellow-400 border border-yellow-700',
  info: 'bg-blue-900/30 text-blue-400 border border-blue-700',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

/**
 * Status badge component
 */
export function Badge({ variant, size = 'md', children }: BadgeProps) {
  const variantClass = variantStyles[variant];
  const sizeClass = sizeStyles[size];

  return (
    <span className={`inline-block rounded-full font-medium ${variantClass} ${sizeClass}`}>
      {children}
    </span>
  );
}

export default Badge;
