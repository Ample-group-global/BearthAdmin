// @ts-nocheck
'use client';
import { useRef, useLayoutEffect } from 'react';

const TIER_COLOR: Record<string, string> = {
  Legendary: '#F59E0B',
  Epic:      '#A855F7',
  Rare:      '#3B82F6',
  Common:    '#6B7280',
};

interface NftPopupItem {
  index: number;
  src?: string;  // pre-rendered data URL (export panel path)
  combo?: Record<string, { rel: string; name: string; stem: string } | null>;
  layers?: { folder: string; label: string }[];
  bitmapCache?: { current: Record<string, ImageBitmap | HTMLImageElement> };
  collW?: number;
  collH?: number;
  attrs: { trait_type: string; value: string }[];
  rank?: number;
  tier?: string;
  score?: number;
}

export default function NftPopup({ item, onClose }: { item: NftPopupItem | null; onClose: () => void }) {
  const canvasRef = useRef(null);

  useLayoutEffect(() => {
    if (!item || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (item.src) {
      // Export panel: card was pre-rendered to a data URL — draw it directly
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, W, H);
      img.src = item.src;
      return;
    }
    // Preview panel: compose from layers + bitmaps
    for (const layer of (item.layers ?? [])) {
      const pick = item.combo?.[layer.folder];
      if (!pick?.rel) continue;
      const bm = item.bitmapCache?.current[pick.rel];
      if (bm) ctx.drawImage(bm, 0, 0, W, H);
    }
  }, [item]);

  if (!item) return null;
  const tierColor = TIER_COLOR[item.tier ?? ''] ?? '#6B7280';

  return (
    <div className="nft-popup-overlay" onClick={onClose}>
      <div className="nft-popup" onClick={e => e.stopPropagation()}>
        <button className="nft-popup-close" onClick={onClose}>✕</button>
        <div className="nft-popup-left">
          <canvas
            ref={canvasRef}
            width={512}
            height={512}
            className="nft-popup-img"
          />
        </div>
        <div className="nft-popup-right">
          <div className="nft-popup-num">#{item.index}</div>
          {(item.rank || item.tier) && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {item.rank && (
                <span style={{ fontSize: 12, color: tierColor, fontWeight: 700 }}>Rank #{item.rank}</span>
              )}
              {item.tier && (
                <span style={{ fontSize: 11, fontWeight: 700, color: tierColor, background: `${tierColor}22`, padding: '2px 7px', borderRadius: 5 }}>
                  {item.tier}
                </span>
              )}
              {item.score !== undefined && (
                <span style={{ fontSize: 12, color: 'var(--dim)' }}>Score: {item.score}</span>
              )}
            </div>
          )}
          <div className="nft-popup-attrs-title">Attributes</div>
          <div className="nft-popup-attrs">
            {item.attrs.map((a, i) => (
              <div key={i} className="nft-attr-row">
                <span className="nft-attr-type">{a.trait_type}</span>
                <span className="nft-attr-val">{a.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
