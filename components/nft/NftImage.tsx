"use client";

import { useState } from "react";

// NFT image with 4 states: revealed (IPFS), blind-box URI, blind-box fallback, broken-image fallback.
// Moved from records/page.tsx to be reusable across any page showing NFT thumbnails.

const IPFS_GATEWAY = "https://amgbearth.myfilebase.com/ipfs";

interface NftImageProps {
  hash?: string | null;
  isRevealed?: boolean;
  blindBoxUri?: string | null;
  size?: number;
}

export default function NftImage({ hash, isRevealed = false, blindBoxUri, size = 80 }: NftImageProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [bbFailed, setBbFailed] = useState(false);

  if (!isRevealed) {
    if (blindBoxUri && !bbFailed) {
      return (
        <img
          src={blindBoxUri}
          alt="Blind Box"
          loading="lazy"
          style={{ width: size, height: size, objectFit: "cover", borderRadius: 10, display: "block", flexShrink: 0 }}
          onError={() => setBbFailed(true)}
        />
      );
    }
    return (
      <div style={{
        width: size, height: size, borderRadius: 10, flexShrink: 0, overflow: "hidden",
        background: "linear-gradient(135deg, #3b1d8a 0%, #7c3aed 50%, #4f46e5 100%)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
        border: "1.5px solid rgba(124,58,237,0.4)",
      }}>
        <svg
          style={{ width: size * 0.38, height: size * 0.38, color: "rgba(255,255,255,0.9)" }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        {size >= 60 && (
          <span style={{ fontSize: size * 0.14, color: "rgba(255,255,255,0.7)", fontWeight: 700, letterSpacing: "0.04em" }}>
            BLIND BOX
          </span>
        )}
      </div>
    );
  }

  const url = hash ? `${IPFS_GATEWAY}/${hash}` : null;
  if (url && !imgFailed) {
    return (
      <img
        src={url}
        alt="NFT"
        loading="lazy"
        style={{ width: size, height: size, objectFit: "cover", borderRadius: 10, display: "block", flexShrink: 0 }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div style={{
      width: size, height: size, background: "#f3f4f6", borderRadius: 10,
      display: "flex", alignItems: "center", justifyContent: "center",
      border: "1.5px dashed #d1d5db", flexShrink: 0,
    }}>
      <svg
        style={{ width: size * 0.36, height: size * 0.36, color: "#d1d5db" }}
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  );
}
