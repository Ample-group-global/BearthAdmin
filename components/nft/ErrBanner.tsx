"use client";

export function ErrBanner({ msg, onDismiss }: { msg: string; onDismiss?: () => void }) {
  return (
    <div
      className="px-4 py-3 rounded-xl text-sm flex items-center gap-2"
      style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
    >
      <span className="flex-1">{msg}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={{ color: "#dc2626", fontSize: 16, lineHeight: 1 }}>✕</button>
      )}
    </div>
  );
}
