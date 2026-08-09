"use client";

// Inline pill badge for the NFT lifecycle state.
// Derives the label and color from deliveryStatusCode + isRevealed + tokenId props
// so no NftRecord type import is needed in a shared component.

interface NftLifecycleBadgeProps {
  deliveryStatusCode: string;
  isRevealed: boolean;
  tokenId: number | null;
  waveRevealScheduledAt?: string | null;
}

export default function NftLifecycleBadge({
  deliveryStatusCode,
  isRevealed,
  tokenId,
  waveRevealScheduledAt,
}: NftLifecycleBadgeProps) {
  const base = "inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full";

  if (deliveryStatusCode === "delivered")
    return <span className={base} style={{ background: "#dcfce7", color: "#15803d" }}>✓ Delivered</span>;

  if (deliveryStatusCode === "sold")
    return <span className={base} style={{ background: "#fef9c3", color: "#a16207" }}>💰 Sold</span>;

  if (deliveryStatusCode === "treasury_pending")
    return (
      <span className={base} style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>
        ◈ Reserved
      </span>
    );

  if (isRevealed)
    return <span className={base} style={{ background: "#f5f3ff", color: "#7c3aed" }}>✦ Revealed</span>;

  if (tokenId != null)
    return <span className={base} style={{ background: "#eff6ff", color: "#2563eb" }}>⬡ Minted</span>;

  // Unminted NFT with a reveal scheduled → wave closed, NFT is unsold → Reserved
  if (tokenId == null && waveRevealScheduledAt != null)
    return (
      <span className={base} style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>
        ◈ Reserved
      </span>
    );

  return (
    <span className={`${base} font-semibold`} style={{ background: "#f8fafc", color: "#94a3b8", border: "1px solid #e2e8f0" }}>
      ○ Pre-mint
    </span>
  );
}
