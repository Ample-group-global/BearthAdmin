// Shared types for the NFT Waves feature (page + all sub-components).

export interface Wave {
  id: string;
  waveNumber: number;
  name: string;
  stageId: string | null;
  stageName: string | null;
  quantity: number | null;
  cumulativeStart: number | null;
  cumulativeEnd: number | null;
  defaultPriceEth: number | null;
  saleMethod: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  revealScheduledAt: string | null;
  waveRevealedAt: string | null;
  tierPrices: { legendary?: number; epic?: number; rare?: number; common?: number } | null;
  status: string;
  notes: string | null;
  nftCount: number;
  soldCount?: number;
  treasuryPendingCount?: number;
  reservedCount?: number;
  treasuryWalletCount?: number;
  priceLocked?: boolean;
  waveClosed?: boolean;
  waveRevealed?: boolean;
  waveRevealTriggered?: boolean;
  waveRevealUri?: string | null;
  closeAction?: string | null;
  unsoldStrategy?: "auto_treasury" | "manual";
  revealStrategy?: "auto" | "manual";
  whitelistRequired?: boolean;
  maxPerWallet?: number;
  syncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  onChain?: {
    priceEth: number;
    qty: number;
    soldCount: number;
    startTime: number;
    endTime: number;
    closed: boolean;
    active: boolean;
    revealed: boolean;
    purchaseLimit?: number;
  } | null;
}

export interface OnChainWaveInfo {
  price: string;
  qty: number;
  soldCount: number;
  startTime: number;
  endTime: number;
  closed: boolean;
  purchaseLimit?: number;
}

export interface SaleMethod {
  code: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}

export interface WaveSchedule {
  wave_number: number;
  wave_name: string;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  reveal_scheduled_at: string | null;
  wave_start_triggered: boolean;
  wave_end_triggered: boolean;
  wave_reveal_triggered: boolean;
  is_revealed: boolean;
  wave_reveal_uri?: string | null;
  wave_revealed_at: string | null;
  sold_count: number;
  quantity: number;
}

export interface WaveManageForm {
  defaultPriceEth: string;
  saleMethod?: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  unsoldStrategy: "auto_treasury" | "manual";
  revealStrategy: "auto" | "manual";
  whitelistRequired: boolean;
  revealUri: string;
}
