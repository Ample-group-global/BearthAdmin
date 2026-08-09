"use client";

// ─── TestnetResetConfirm ──────────────────────────────────────────────────────
// Fixed-position overlay confirmation dialog shown before wiping all testnet
// NFT records. Only mounted when showResetConfirm is true in the parent.

interface TestnetResetConfirmProps {
  onConfirm: () => void;
  onCancel: () => void;
  resetting: boolean;
}

export default function TestnetResetConfirm({ onConfirm, onCancel, resetting }: TestnetResetConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" style={{ border: "1px solid #fecaca" }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#fef2f2" }}>
            <svg className="w-5 h-5" style={{ color: "#dc2626" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-sm" style={{ color: "#0f172a" }}>Reset All DB Data?</p>
            <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>Testnet only — blocked on mainnet</p>
          </div>
        </div>
        <p className="text-sm mb-5" style={{ color: "#374151" }}>
          This will reset all <strong>9,999 NFT records</strong>, all <strong>7 waves</strong>, the wave pool, and customer wallet minted counts back to pre-mint state. This cannot be undone.
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#374151" }}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={resetting}
            className="flex-1 px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: "#dc2626", color: "white" }}>
            {resetting ? "Resetting…" : "Yes, Reset All"}
          </button>
        </div>
      </div>
    </div>
  );
}
