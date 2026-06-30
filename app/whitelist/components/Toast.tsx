'use client';

import React, { useEffect } from 'react';
import type { Toast as ToastType, ToastVariant } from '../hooks/useToast';

interface ToastProps extends ToastType {
  onClose: () => void;
}

/**
 * Individual toast notification component
 */
function Toast({ id, message, variant, duration, onClose }: ToastProps) {
  useEffect(() => {
    if (duration) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const variantStyles: Record<ToastVariant, string> = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-blue-600 text-white',
    warning: 'bg-yellow-600 text-white',
  };

  const bgClass = variantStyles[variant];

  return (
    <div
      className={`${bgClass} px-4 py-3 rounded-lg shadow-lg flex items-center justify-between gap-4 animate-slide-in`}
      role="alert"
      aria-live="polite"
    >
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="text-white hover:opacity-75 transition-opacity"
        aria-label="Close notification"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastType[];
  onClose: (id: string) => void;
}

/**
 * Toast container component that displays multiple toasts
 */
export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 pointer-events-none z-50">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast {...toast} onClose={() => onClose(toast.id)} />
        </div>
      ))}
    </div>
  );
}

export default Toast;
