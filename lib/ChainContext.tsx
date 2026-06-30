"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { SUPPORTED_CHAINS, DEFAULT_CHAIN, getChainConfig, type ChainConfig } from "./chains";

const STORAGE_KEY = "bearth-active-chain-id";

interface ChainContextType {
  activeChain: ChainConfig;
  setActiveChain: (chain: ChainConfig) => void;
  supportedChains: ChainConfig[];
}

const ChainContext = createContext<ChainContextType>({
  activeChain: DEFAULT_CHAIN,
  setActiveChain: () => {},
  supportedChains: SUPPORTED_CHAINS,
});

export function ChainProvider({ children }: { children: ReactNode }) {
  const [activeChain, setActiveChainState] = useState<ChainConfig>(DEFAULT_CHAIN);

  // Load saved chain on mount (client-side only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const config = getChainConfig(Number(saved));
        if (config) setActiveChainState(config);
      }
    } catch {}
  }, []);

  const setActiveChain = useCallback((chain: ChainConfig) => {
    setActiveChainState(chain);
    try {
      localStorage.setItem(STORAGE_KEY, String(chain.chainId));
    } catch {}
  }, []);

  return (
    <ChainContext.Provider
      value={{ activeChain, setActiveChain, supportedChains: SUPPORTED_CHAINS }}
    >
      {children}
    </ChainContext.Provider>
  );
}

export function useChain() {
  return useContext(ChainContext);
}
