"use client";

// ─── WaveRevealPanel ──────────────────────────────────────────────────────────
// Shown when the selected wave is closed, has sold NFTs, and has not yet been
// revealed. Lets admin enter an IPFS base URI and trigger on-chain VRF reveal.

interface WaveRevealPanelProps {
  waveFilter: string;
  revealUri: string;
  onUriChange: (v: string) => void;
  onReveal: () => void;
  revealing: boolean;
  revealMsg: string | null;
}

export default function WaveRevealPanel({
  waveFilter,
  revealUri,
  onUriChange,
  onReveal,
  revealing,
  revealMsg,
}: WaveRevealPanelProps) {
  const handleRevealClick = () => {
    console.group("WaveRevealPanel — reveal triggered");
    console.log("waveFilter:", waveFilter);
    console.log("revealUri:", revealUri);
    console.groupEnd();
    onReveal();
  };

  return (
    <div className="rounded-2xl p-4 bg-white" style={{ border: "1px solid #c7d2fe", boxShadow: "0 1px 4px rgba(99,102,241,0.08)" }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#ede9fe" }}>
          <svg className="w-5 h-5" style={{ color: "#7c3aed" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: "#4c1d95" }}>Wave {waveFilter} is closed and awaiting reveal</p>
          <p className="text-xs mt-0.5" style={{ color: "#6d28d9" }}>
            Enter the IPFS metadata base URI to reveal artwork and assign tokens randomly via VRF.
          </p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <input
              type="text"
              value={revealUri}
              onChange={e => onUriChange(e.target.value)}
              placeholder="ipfs://Qm..."
              className="flex-1 min-w-48 px-3 py-2 rounded-xl text-sm outline-none font-mono"
              style={{ border: "1px solid #ddd6fe", background: "#faf5ff", color: "#1e1b4b" }}
            />
            <button
              onClick={handleRevealClick}
              disabled={revealing || !revealUri.startsWith("ipfs://")}
              className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
              style={{
                background: (revealing || !revealUri.startsWith("ipfs://")) ? "#e5e7eb" : "linear-gradient(135deg,#7c3aed,#6366f1)",
                color: (revealing || !revealUri.startsWith("ipfs://")) ? "#9ca3af" : "#fff",
                border: "none", cursor: revealing ? "wait" : "pointer",
              }}>
              {revealing ? "Revealing…" : `✦ Reveal Wave ${waveFilter}`}
            </button>
          </div>
          {revealMsg && (
            <p className="text-xs mt-2 font-semibold" style={{ color: revealMsg.includes("!") ? "#16a34a" : "#dc2626" }}>
              {revealMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
