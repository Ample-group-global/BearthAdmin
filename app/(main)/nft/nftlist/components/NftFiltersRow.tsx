"use client";

// ─── NftFiltersRow ────────────────────────────────────────────────────────────
// The full filter row for the NFT Records tab: search, wave, artwork state,
// mint type, rarity tier, date range, and a clear-all button.

export interface WaveOption {
  waveNumber: number;
  name: string;
  onChain: { soldCount: number; closed: boolean; revealed: boolean } | null;
}

interface NftFiltersRowProps {
  search: string;
  onSearch: (v: string) => void;
  waveFilter: string;
  onWaveChange: (v: string) => void;
  revealFilter: string;
  onRevealChange: (v: string) => void;
  mintTypeFilter: string;
  onMintTypeChange: (v: string) => void;
  rarityTierFilter: string;
  onRarityTierChange: (v: string) => void;
  mintedFrom: string;
  onMintedFromChange: (v: string) => void;
  mintedTo: string;
  onMintedToChange: (v: string) => void;
  waves: WaveOption[];
  onClear: () => void;
}

export default function NftFiltersRow({
  search,
  onSearch,
  waveFilter,
  onWaveChange,
  revealFilter,
  onRevealChange,
  mintTypeFilter,
  onMintTypeChange,
  rarityTierFilter,
  onRarityTierChange,
  mintedFrom,
  onMintedFromChange,
  mintedTo,
  onMintedToChange,
  waves,
  onClear,
}: NftFiltersRowProps) {
  const hasActiveFilter =
    !!revealFilter || !!waveFilter || !!mintTypeFilter ||
    !!rarityTierFilter || !!mintedFrom || !!mintedTo;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-48 max-w-64">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input type="text" placeholder="Search serial # or token ID…" value={search}
          onChange={e => onSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none bg-white"
          style={{ border: "1px solid #e5e7eb", color: "#111827" }} />
      </div>

      {/* Wave dropdown */}
      <select value={waveFilter}
        onChange={e => onWaveChange(e.target.value)}
        className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
        style={{ border: "1px solid #e5e7eb", color: waveFilter ? "#111827" : "#9bafc5" }}>
        <option value="">All Waves</option>
        {waves.map(w => (
          <option key={w.waveNumber} value={String(w.waveNumber)}>
            W{w.waveNumber} — {w.name}
          </option>
        ))}
      </select>

      {/* Artwork state — matches NFT lifecycle badge language */}
      <select value={revealFilter}
        onChange={e => onRevealChange(e.target.value)}
        className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
        style={{ border: "1px solid #e5e7eb", color: revealFilter ? "#111827" : "#9bafc5" }}>
        <option value="">All Artwork</option>
        <option value="pre_mint">⬡ Pre-mint</option>
        <option value="reserved">◈ Reserved</option>
        <option value="revealed">✦ Revealed</option>
        <option value="treasury_wallet">🏛 Treasury Wallet</option>
      </select>

      {/* Mint type */}
      <select value={mintTypeFilter}
        onChange={e => onMintTypeChange(e.target.value)}
        className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
        style={{ border: "1px solid #e5e7eb", color: mintTypeFilter ? "#111827" : "#9bafc5" }}>
        <option value="">All Mint Types</option>
        <option value="free">Free</option>
        <option value="paid">Paid</option>
        <option value="treasury">Treasury</option>
      </select>

      {/* Rarity tier */}
      <select value={rarityTierFilter}
        onChange={e => onRarityTierChange(e.target.value)}
        className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
        style={{ border: "1px solid #e5e7eb", color: rarityTierFilter ? "#111827" : "#9bafc5" }}>
        <option value="">All Rarity Tiers</option>
        <option value="legendary">Legendary</option>
        <option value="epic">Epic</option>
        <option value="rare">Rare</option>
        <option value="common">Common</option>
      </select>

      {/* Date range */}
      <input type="date" value={mintedFrom}
        onChange={e => onMintedFromChange(e.target.value)}
        className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
        style={{ border: "1px solid #e5e7eb", color: mintedFrom ? "#111827" : "#9bafc5" }}
        title="Minted from date" />
      <input type="date" value={mintedTo}
        onChange={e => onMintedToChange(e.target.value)}
        className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
        style={{ border: "1px solid #e5e7eb", color: mintedTo ? "#111827" : "#9bafc5" }}
        title="Minted to date" />

      {/* Clear all */}
      {hasActiveFilter && (
        <button onClick={onClear}
          className="px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
          Clear filters
        </button>
      )}
    </div>
  );
}
