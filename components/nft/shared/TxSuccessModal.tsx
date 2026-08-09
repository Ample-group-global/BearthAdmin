"use client";

// Green-checkmark success modal shown after any on-chain transaction completes.
// Replaces the near-identical SuccessModal + TreasurySuccessModal in waves/page.tsx.

interface TxSuccessModalProps {
  title: string;
  message: string;
  txHash: string;
  onClose: () => void;
}

export default function TxSuccessModal({ title, message, txHash, onClose }: TxSuccessModalProps) {
  const etherscan =
    process.env.NEXT_PUBLIC_NETWORK === "mainnet"
      ? `https://etherscan.io/tx/${txHash}`
      : `https://sepolia.etherscan.io/tx/${txHash}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-md text-center"
        style={{ border: "1px solid #e5e7eb" }}
      >
        <div className="px-8 py-8 space-y-4">
          {/* Green checkmark */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ background: "rgba(22,163,74,0.1)" }}
          >
            <svg
              className="w-8 h-8"
              style={{ color: "#16a34a" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          {/* Title + message */}
          <div>
            <h2 className="text-lg font-extrabold" style={{ color: "#24315f" }}>{title}</h2>
            <p className="text-sm mt-1" style={{ color: "#6b7280" }}>{message}</p>
          </div>

          {/* Tx hash box */}
          {txHash && (
            <>
              <div
                className="px-4 py-3 rounded-xl text-left"
                style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}
              >
                <p
                  className="text-xs font-bold uppercase tracking-wide mb-1"
                  style={{ color: "#9bafc5" }}
                >
                  Transaction Hash
                </p>
                <p className="text-xs font-mono break-all" style={{ color: "#374151" }}>
                  {txHash}
                </p>
              </div>
              <a
                href={etherscan}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: "#41afeb" }}
              >
                View on Etherscan
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </>
          )}
        </div>

        {/* Done button */}
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: "#24315f" }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
