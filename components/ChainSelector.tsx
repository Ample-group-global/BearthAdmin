"use client";

import { useState, useRef, useEffect } from "react";
import { useWallets } from "@privy-io/react-auth";
import { useChain } from "@/lib/ChainContext";
import { getChainConfig } from "@/lib/chains";

export function ChainSelector() {
  const { activeChain, setActiveChain, supportedChains } = useChain();
  const { wallets } = useWallets();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitch = async (chainId: number) => {
    if (chainId === activeChain.chainId) {
      setOpen(false);
      return;
    }

    const config = getChainConfig(chainId);
    if (!config) return;

    setSwitching(true);
    setError("");

    try {
      const wallet = wallets?.[0];
      if (wallet?.switchChain) {
        await wallet.switchChain(chainId);
      } else if (typeof window !== "undefined" && window.ethereum) {
        const hexChainId = "0x" + chainId.toString(16);
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: hexChainId }],
          });
        } catch (switchErr: unknown) {
          const err = switchErr as { code?: number };
          if (err?.code === 4902) {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: hexChainId,
                chainName: config.name,
                nativeCurrency: config.nativeCurrency,
                rpcUrls: [config.rpcUrl],
                blockExplorerUrls: [config.blockExplorer],
              }],
            });
          } else {
            throw switchErr;
          }
        }
      }

      setActiveChain(config);
      setOpen(false);
    } catch (e: unknown) {
      const err = e as { code?: number; message?: string };
      const msg = err?.message ?? String(e);
      const isRejection = err?.code === 4001 || msg.toLowerCase().includes("user rejected") || msg.toLowerCase().includes("cancelled");
      if (!isRejection) {
        // Only log genuine failures, not user-initiated cancellations
        console.warn("Chain switch failed:", msg);
      }
      setError(isRejection ? "Cancelled" : `Could not switch to ${config.name}`);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => { setOpen(!open); setError(""); }}
        disabled={switching}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
        style={{ background: "#f4f6fb", border: "1px solid #e5e7eb", color: "#374151" }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#41afeb"; e.currentTarget.style.color = "#41afeb"; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.color = "#374151"; }}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "#41afeb" }} />
        {switching ? "Switching…" : activeChain.shortName}
        <svg
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 mt-1.5 w-52 rounded-xl shadow-lg z-50 overflow-hidden py-1"
          style={{ background: "#fff", border: "1px solid #e5e7eb" }}
        >
          {supportedChains.map((chain) => {
            const isActive = chain.chainId === activeChain.chainId;
            return (
              <button
                key={chain.chainId}
                onClick={() => handleSwitch(chain.chainId)}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors"
                style={{ color: isActive ? "#41afeb" : "#374151", fontWeight: isActive ? 600 : 400 }}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#f4f6fb"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: isActive ? "#41afeb" : "#d1d5db" }}
                />
                {chain.name}
                {isActive && (
                  <span className="ml-auto text-xs font-semibold" style={{ color: "#41afeb" }}>Active</span>
                )}
              </button>
            );
          })}
          {error && (
            <div
              className="px-4 py-2 text-xs"
              style={{ borderTop: "1px solid #f3f4f6", color: "#ef4444" }}
            >
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
