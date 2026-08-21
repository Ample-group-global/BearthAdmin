// @ts-nocheck
'use client';
import { useState, useRef, useEffect } from 'react';

export const TIER_META = [
  { label: 'Legendary', sub: 'top 1%',  color: '#F59E0B', bg: '#FEF3C7' },
  { label: 'Epic',      sub: 'top 5%',  color: '#A855F7', bg: '#F5F3FF' },
  { label: 'Rare',      sub: 'top 15%', color: '#3B82F6', bg: '#EFF6FF' },
  { label: 'Common',    sub: 'rest',    color: '#6B7280', bg: '#F3F4F6' },
];
export const TIER_COLOR: Record<string, string> = Object.fromEntries(TIER_META.map(t => [t.label, t.color]));

// ── Spinner ───────────────────────────────────────────────────────────────────
export function Spinner({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'studio-spin .75s linear infinite', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="4" opacity={0.2} />
      <path fill={color} opacity={0.8} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Check icon ────────────────────────────────────────────────────────────────
export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ── Rarity card ───────────────────────────────────────────────────────────────
export function RarityCard({ item, jobBitmaps, layers, canvasW, canvasH, onClick, bitmapsVer }) {
  const tierColor = TIER_COLOR[item.tier] ?? '#6B7280';
  const canvasRef    = useRef(null);
  const cardRef      = useRef(null);
  const drawn        = useRef(false);
  const [imgReady, setImgReady] = useState(false);

  function draw() {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasW, canvasH);
    let didDraw = false;
    for (const layer of layers) {
      const pick = item.combo[layer.folder];
      if (!pick?.rel) continue;
      const bm = jobBitmaps.current[pick.rel];
      if (bm) { ctx.drawImage(bm, 0, 0, canvasW, canvasH); didDraw = true; }
    }
    if (didDraw) { drawn.current = true; setImgReady(true); }
  }

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { draw(); obs.disconnect(); } },
      { rootMargin: '200px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Re-draw when bitmaps finish loading (fixes blank canvas on first render)
  useEffect(() => {
    if (bitmapsVer > 0) { drawn.current = false; draw(); }
  }, [bitmapsVer]);

  const [open, setOpen] = useState(false);

  function handleClick() {
    if (!drawn.current) draw();
    const src = canvasRef.current?.toDataURL() ?? '';
    onClick({ index: item.index, src, attrs: item.attrs, rank: item.rank, score: item.score, tier: item.tier });
    setOpen(true);
  }

  return (
    <div ref={cardRef} className={`exp-nft-card${open ? ' exp-nft-open' : ''}`} onClick={handleClick}>
      <div className="exp-nft-thumb">
        <canvas ref={canvasRef} width={canvasW} height={canvasH} style={{ opacity: imgReady ? 1 : 0 }} />
        {!imgReady && <div className="exp-nft-shimmer" />}
        <div className="exp-nft-rank" style={{ color: tierColor }}>#{item.rank}</div>
        <div className="exp-nft-tier-chip" style={{ background: tierColor }}>
          {item.tier}
        </div>
      </div>
      <div className="exp-nft-info">
        <div className="exp-nft-name">#{item.index}</div>
        <div className="exp-nft-score" style={{ color: tierColor }}>
          Score {item.score}
        </div>
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
export function ProgressBar({ value, max, color }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="exp-progress-track">
      <div className="exp-progress-fill" style={{ width: `${pct.toFixed(1)}%`, background: color }} />
    </div>
  );
}

// ── Horizontal layer filter pill ─────────────────────────────────────────────
export function HLayerFilter({ layer, activeFilter, onTraitClick }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const isActive = activeFilter?.folder === layer.folder;

  useEffect(() => {
    if (!open) return;
    function close(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="exp-hfl-item">
      <button
        className={`exp-hfl-btn${isActive ? ' exp-hfl-btn-active' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {layer.label}
        <span className="exp-hfl-ct">{layer.count}</span>
        ▾
      </button>
      {open && (
        <div className="exp-hfl-dropdown">
          {[...layer.assets]
            .sort((a, b) => a.stem.localeCompare(b.stem, undefined, { numeric: true, sensitivity: 'base' }))
            .map(a => (
              <button
                key={a.stem}
                className={`exp-hfl-trait${isActive && activeFilter?.stem === a.stem ? ' active' : ''}`}
                onClick={() => { onTraitClick(layer, a); setOpen(false); }}
              >
                {a.name}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
