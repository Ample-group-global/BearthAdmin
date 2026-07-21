// Shared constants for NFT admin pages

export const IPFS_GATEWAY = "https://ipfs.io/ipfs/";

export const PAGE_SIZE = 20;

export const RARITY_TIERS = [
  { id: 1, label: "Common",    color: "#6b7280", defaultBps: 10000 },
  { id: 2, label: "Rare",      color: "#3b82f6", defaultBps: 20000 },
  { id: 3, label: "Epic",      color: "#7c3aed", defaultBps: 30000 },
  { id: 4, label: "Legendary", color: "#d97706", defaultBps: 40000 },
] as const;

export const PHASE_NAMES = ["Whitelist", "PaidMint", "Revealed"] as const;

export const PHASE_COLORS: Record<string, { bg: string; color: string }> = {
  Whitelist: { bg: "rgba(124,58,237,0.1)",  color: "#7c3aed" },
  PaidMint:  { bg: "rgba(65,175,235,0.12)", color: "#41afeb" },
  Revealed:  { bg: "rgba(22,163,74,0.1)",   color: "#16a34a" },
};

export const ETH_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
export const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
export const MERKLE_ROOT_RE = /^0x[0-9a-fA-F]{64}$/;

export const MAX_ROYALTY_BPS = 1000; // 10% maximum royalty
