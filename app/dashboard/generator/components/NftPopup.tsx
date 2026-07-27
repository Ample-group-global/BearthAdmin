// @ts-nocheck
'use client';

const TIER_COLOR: Record<string, string> = {
  Legendary: '#F59E0B',
  Epic:      '#A855F7',
  Rare:      '#3B82F6',
  Common:    '#6B7280',
};

interface NftPopupItem {
  index: number;
  src: string;
  attrs: { trait_type: string; value: string }[];
  rank?: number;
  tier?: string;
  score?: number;
}

export default function NftPopup({ item, onClose }: { item: NftPopupItem | null; onClose: () => void }) {
  if (!item) return null;
  const tierColor = TIER_COLOR[item.tier ?? ''] ?? '#6B7280';

  return (
    <div className="nft-popup-overlay" onClick={onClose}>
      <div className="nft-popup" onClick={e => e.stopPropagation()}>
        <button className="nft-popup-close" onClick={onClose}>✕</button>
        <div className="nft-popup-left">
          <img src={item.src} alt={`#${item.index}`} className="nft-popup-img" />
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
