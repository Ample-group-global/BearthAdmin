"use client";

const ERR = { background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" };
const OK  = { background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)", color: "#16a34a" };

function CheckIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function ErrBanner({ msg, onDismiss }: { msg: string; onDismiss?: () => void }) {
  return (
    <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2" style={ERR}>
      <span className="flex-1">{msg}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={{ color: "#dc2626", fontSize: 16, lineHeight: 1 }}>✕</button>
      )}
    </div>
  );
}

export function OkBanner({ msg, onDismiss }: { msg: string; onDismiss?: () => void }) {
  return (
    <div className="px-4 py-3 rounded-xl text-xs flex items-center gap-2" style={OK}>
      <CheckIcon />
      <span className="flex-1">{msg}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={{ color: "#16a34a", fontSize: 16, lineHeight: 1 }}>✕</button>
      )}
    </div>
  );
}

export function TxBanner({ txHash, onDismiss }: { txHash: string; onDismiss?: () => void }) {
  return (
    <div className="px-4 py-3 rounded-xl text-xs flex items-center gap-2" style={OK}>
      <CheckIcon />
      <span className="flex-1">
        Transaction submitted: <span className="font-mono">{txHash.slice(0, 22)}…</span>
      </span>
      {onDismiss && (
        <button onClick={onDismiss} style={{ color: "#16a34a", fontSize: 16, lineHeight: 1 }}>✕</button>
      )}
    </div>
  );
}
