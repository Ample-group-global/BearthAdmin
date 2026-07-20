"use client";

import type { Toast } from "../hooks/useToast";

const STYLES: Record<Toast["type"], { bg: string; border: string; color: string }> = {
  success: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534" },
  error:   { bg: "#fef2f2", border: "#fecaca", color: "#991b1b" },
  warning: { bg: "#fffbeb", border: "#fde68a", color: "#92400e" },
};

export function ToastContainer({ toasts, onClose }: { toasts: Toast[]; onClose: (id: string) => void }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2">
      {toasts.map(t => {
        const s = STYLES[t.type];
        return (
          <div
            key={t.id}
            className="flex items-start gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-xs"
            style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
          >
            <span className="flex-1">{t.message}</span>
            <button
              onClick={() => onClose(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100 text-base leading-none"
            >
              &times;
            </button>
          </div>
        );
      })}
    </div>
  );
}
