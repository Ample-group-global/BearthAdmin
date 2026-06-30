'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  ghost: 'bg-transparent border border-gray-600 text-white hover:bg-gray-700',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};

/**
 * Reusable button component with multiple variants and sizes
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  const baseStyles =
    'rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';
  const widthClass = fullWidth ? 'w-full' : '';
  const variantClass = variantStyles[variant];
  const sizeClass = sizeStyles[size];

  return (
    <button
      disabled={disabled || loading}
      className={`${baseStyles} ${variantClass} ${sizeClass} ${widthClass} ${className || ''}`}
      {...props}
    >
      {icon && iconPosition === 'left' && !loading && icon}
      {loading && (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
      {icon && iconPosition === 'right' && !loading && icon}
    </button>
  );
}

export default Button;
