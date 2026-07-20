"use client";

import { useEffect, useState } from "react";

interface Listing {
  orderHash: string;
  chain: string;
  contractAddress: string;
  tokenId: string;
  orderType: string;
  maker: string;
  price: string;
  priceCurrency: string;
  startDate: string;
  expirationDate: string;
  cancelled: boolean;
  finalized: boolean;
}

type ToastType = "success" | "error" | "info";

interface Toast {
  msg: string;
  type: ToastType;
}

function Spinner() {
  return (
    <svg className="w-5 h-5 animate-spin" style={{ color: "#9bafc5" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function truncateHash(hash: string) {
  if (!hash) return "—";
  return hash.slice(0, 10) + "...";
}

function truncateAddr(addr: string) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function formatPrice(price: string, currency: string) {
  if (!price || price === "0") return "N/A";
  if (currency === "ETH" || currency === "WETH") {
    const val = Number(price) / 1e18;
    if (val === 0) return "N/A";
    return `${val.toFixed(4)} ${currency}`;
  }
  return `${price} ${currency}`;
}

function formatExpiry(expiry: string) {
  if (!expiry) return "—";
  try {
    return new Date(expiry).toLocaleDateString();
  } catch {
    return "—";
  }
}

const TH_COLS = ["Order Hash", "Chain", "Token ID", "Price", "Expiry", "Maker", "Type", "Status"];

export default function ListingsPage() {
  // Collection slug controls
  const [slug, setSlug] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [bestOnly, setBestOnly] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // NFT-level lookup
  const [nftChain, setNftChain] = useState("");
  const [nftContract, setNftContract] = useState("");
  const [nftTokenId, setNftTokenId] = useState("");
  const [nftBest, setNftBest] = useState(false);
  const [nftListings, setNftListings] = useState<Listing[]>([]);
  const [nftLoading, setNftLoading] = useState(false);
  const [nftLoaded, setNftLoaded] = useState(false);

  const showToast = (msg: string, type: ToastType = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load collection listings
  const loadListings = async (currentSlug: string, currentBestOnly: boolean) => {
    if (!currentSlug.trim()) return;
    setLoading(true);
    setListings([]);
    try {
      const endpoint = currentBestOnly
        ? `/api/opensea/Listings/collection/${currentSlug.trim()}/best`
        : `/api/opensea/Listings/collection/${currentSlug.trim()}`;
      const r = await fetch(endpoint, { credentials: "include" });
      const d = await r.json();
      if (!r.ok) {
        showToast(d?.error ?? d?.title ?? "Failed to load listings", "error");
        return;
      }
      const rows: Listing[] = Array.isArray(d) ? d : d.listings ?? d.data ?? [];
      setListings(rows);
      if (rows.length === 0) showToast("No listings found for this collection.", "info");
    } catch {
      showToast("Network error loading listings.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = () => {
    const s = slugInput.trim();
    if (!s) return;
    setSlug(s);
    loadListings(s, bestOnly);
  };

  const handleBestToggle = () => {
    const next = !bestOnly;
    setBestOnly(next);
    if (slug) loadListings(slug, next);
  };

  const handleSync = async () => {
    if (!slug.trim()) {
      showToast("Enter and load a collection slug first.", "error");
      return;
    }
    setSyncing(true);
    try {
      const r = await fetch(`/api/opensea/Listings/collection/${slug.trim()}/sync`, {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast(d?.error ?? d?.title ?? "Sync failed.", "error");
      } else {
        showToast(d?.message ?? "Sync triggered successfully.", "success");
        loadListings(slug, bestOnly);
      }
    } catch {
      showToast("Network error during sync.", "error");
    } finally {
      setSyncing(false);
    }
  };

  // NFT-level lookup
  const loadNftListings = async (best: boolean) => {
    if (!nftChain.trim() || !nftContract.trim() || !nftTokenId.trim()) {
      showToast("Fill in Chain, Contract, and Token ID.", "error");
      return;
    }
    setNftBest(best);
    setNftLoading(true);
    setNftListings([]);
    setNftLoaded(false);
    try {
      const base = `/api/opensea/Listings/chain/${nftChain.trim()}/contract/${nftContract.trim()}/nft/${nftTokenId.trim()}`;
      const endpoint = best ? `${base}/best` : base;
      const r = await fetch(endpoint, { credentials: "include" });
      const d = await r.json();
      if (!r.ok) {
        showToast(d?.error ?? d?.title ?? "Failed to load NFT listings", "error");
        return;
      }
      const rows: Listing[] = Array.isArray(d) ? d : d.listings ?? d.data ?? (d && typeof d === "object" && d.orderHash ? [d] : []);
      setNftListings(rows);
      setNftLoaded(true);
      if (rows.length === 0) showToast("No listings found for this NFT.", "info");
    } catch {
      showToast("Network error loading NFT listings.", "error");
    } finally {
      setNftLoading(false);
    }
  };

  // Re-fetch when bestOnly toggled from external state (handled in handleBestToggle)
  useEffect(() => { /* intentional: loadListings is called inline */ }, []);

  const inputStyle: React.CSSProperties = {
    border: "1px solid #e4e7ed",
    color: "#374151",
    background: "#fff",
    outline: "none",
  };

  const toastBg: Record<ToastType, string> = {
    success: "#16a34a",
    error: "#dc2626",
    info: "#24315f",
  };

  return (
    <div className="p-5">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg text-xs font-semibold text-white shadow-lg"
          style={{ background: toastBg[toast.type], minWidth: "220px", maxWidth: "360px" }}
        >
          {toast.msg}
        </div>
      )}

      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Listings</h1>
        <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Browse and sync OpenSea listings by collection or NFT</p>
      </div>

      {/* Controls bar */}
      <div className="bg-white rounded-lg px-4 py-3 mb-4 flex flex-wrap items-center gap-3" style={{ border: "1px solid #e4e7ed" }}>
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <label className="text-xs font-semibold flex-shrink-0" style={{ color: "#374151" }}>Collection Slug</label>
          <input
            type="text"
            placeholder="e.g. boredapeyachtclub"
            value={slugInput}
            onChange={e => setSlugInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleLoad(); }}
            className="flex-1 text-xs px-3 py-1.5 rounded"
            style={{ ...inputStyle, border: "1px solid #e4e7ed", minWidth: "160px" }}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleLoad}
            disabled={loading || !slugInput.trim()}
            className="px-4 py-1.5 rounded text-xs font-semibold text-white transition-opacity"
            style={{ background: "#24315f", opacity: loading || !slugInput.trim() ? 0.55 : 1 }}
          >
            {loading ? "Loading…" : "Load"}
          </button>

          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-1.5 rounded text-xs font-semibold transition-opacity"
            style={{ background: syncing ? "#e4e7ed" : "#f59e0b", color: syncing ? "#9bafc5" : "#fff", opacity: syncing ? 0.7 : 1 }}
          >
            {syncing ? "Syncing…" : "Sync"}
          </button>

          {/* Best Only toggle */}
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <div
              onClick={handleBestToggle}
              className="relative w-9 h-5 rounded-full transition-colors cursor-pointer"
              style={{ background: bestOnly ? "#41afeb" : "#d1d5db" }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform"
                style={{ transform: bestOnly ? "translateX(16px)" : "translateX(0)" }}
              />
            </div>
            <span className="text-xs font-semibold" style={{ color: "#374151" }}>Best Only</span>
          </label>
        </div>
      </div>

      {/* Collection Listings Table */}
      <div className="bg-white rounded-lg overflow-hidden mb-6" style={{ border: "1px solid #e4e7ed" }}>
        <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: "#e4e7ed", background: "#f8f9fb" }}>
          <span className="text-xs font-bold" style={{ color: "#24315f" }}>
            {slug ? `${bestOnly ? "Best " : ""}Listings — ${slug}` : "Collection Listings"}
          </span>
          {listings.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: "#f0f2f7", color: "#9bafc5" }}>
              {listings.length} row{listings.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12" style={{ color: "#c4c9d4" }}>
            <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <p className="text-sm font-medium">
              {slug ? "No listings found for this collection." : "Enter a collection slug above to load listings"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid #e4e7ed", background: "#f8f9fb" }}>
                  {TH_COLS.map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold whitespace-nowrap" style={{ color: "#6b7280" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {listings.map((l, i) => (
                  <tr key={l.orderHash ?? i} style={{ color: "#374151" }}>
                    <td className="px-4 py-2.5 font-mono" style={{ color: "#9bafc5" }} title={l.orderHash}>
                      {truncateHash(l.orderHash)}
                    </td>
                    <td className="px-4 py-2.5 capitalize">{l.chain ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono">{l.tokenId ?? "—"}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: "#41afeb" }}>
                      {formatPrice(l.price, l.priceCurrency)}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "#9bafc5" }}>{formatExpiry(l.expirationDate)}</td>
                    <td className="px-4 py-2.5 font-mono" title={l.maker} style={{ color: "#9bafc5" }}>
                      {truncateAddr(l.maker)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: "#f0f2f7", color: "#24315f" }}>
                        {l.orderType ?? "listing"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {l.cancelled ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>Cancelled</span>
                      ) : l.finalized ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: "rgba(22,163,74,0.08)", color: "#16a34a" }}>Finalized</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: "rgba(65,175,235,0.08)", color: "#41afeb" }}>Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* NFT-level lookup */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #e4e7ed" }}>
        <div className="px-4 py-2.5 border-b" style={{ borderColor: "#e4e7ed", background: "#f8f9fb" }}>
          <span className="text-xs font-bold" style={{ color: "#24315f" }}>NFT Listing Lookup</span>
          <p className="text-[11px] mt-0.5" style={{ color: "#9bafc5" }}>Query listings for a specific NFT by chain, contract, and token ID</p>
        </div>

        <div className="px-4 py-3 flex flex-wrap items-end gap-3" style={{ borderBottom: "1px solid #e4e7ed" }}>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold" style={{ color: "#374151" }}>Chain</label>
            <input
              type="text"
              placeholder="ethereum"
              value={nftChain}
              onChange={e => setNftChain(e.target.value)}
              className="text-xs px-3 py-1.5 rounded"
              style={{ ...inputStyle, width: "110px" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold" style={{ color: "#374151" }}>Contract Address</label>
            <input
              type="text"
              placeholder="0x..."
              value={nftContract}
              onChange={e => setNftContract(e.target.value)}
              className="text-xs px-3 py-1.5 rounded"
              style={{ ...inputStyle, width: "200px" }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold" style={{ color: "#374151" }}>Token ID</label>
            <input
              type="text"
              placeholder="1"
              value={nftTokenId}
              onChange={e => setNftTokenId(e.target.value)}
              className="text-xs px-3 py-1.5 rounded"
              style={{ ...inputStyle, width: "80px" }}
            />
          </div>
          <div className="flex gap-2 pb-0.5">
            <button
              onClick={() => loadNftListings(false)}
              disabled={nftLoading}
              className="px-3 py-1.5 rounded text-xs font-semibold text-white transition-opacity"
              style={{ background: "#24315f", opacity: nftLoading ? 0.55 : 1 }}
            >
              All Listings
            </button>
            <button
              onClick={() => loadNftListings(true)}
              disabled={nftLoading}
              className="px-3 py-1.5 rounded text-xs font-semibold transition-opacity"
              style={{ background: "#41afeb", color: "#fff", opacity: nftLoading ? 0.55 : 1 }}
            >
              Best Listing
            </button>
          </div>
        </div>

        {nftLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : nftLoaded ? (
          nftListings.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: "#9bafc5" }}>
              No listings found for this NFT.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid #e4e7ed", background: "#f8f9fb" }}>
                    {TH_COLS.map(h => (
                      <th key={h} className="text-left px-4 py-2.5 font-semibold whitespace-nowrap" style={{ color: "#6b7280" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {nftListings.map((l, i) => (
                    <tr key={l.orderHash ?? i} style={{ color: "#374151" }}>
                      <td className="px-4 py-2.5 font-mono" style={{ color: "#9bafc5" }} title={l.orderHash}>
                        {truncateHash(l.orderHash)}
                      </td>
                      <td className="px-4 py-2.5 capitalize">{l.chain ?? "—"}</td>
                      <td className="px-4 py-2.5 font-mono">{l.tokenId ?? "—"}</td>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: "#41afeb" }}>
                        {formatPrice(l.price, l.priceCurrency)}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: "#9bafc5" }}>{formatExpiry(l.expirationDate)}</td>
                      <td className="px-4 py-2.5 font-mono" title={l.maker} style={{ color: "#9bafc5" }}>
                        {truncateAddr(l.maker)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: "#f0f2f7", color: "#24315f" }}>
                          {l.orderType ?? "listing"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {l.cancelled ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>Cancelled</span>
                        ) : l.finalized ? (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: "rgba(22,163,74,0.08)", color: "#16a34a" }}>Finalized</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: "rgba(65,175,235,0.08)", color: "#41afeb" }}>Active</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="py-8 text-center text-xs" style={{ color: "#c4c9d4" }}>
            Enter chain, contract, and token ID above then click a lookup button.
          </div>
        )}
      </div>
    </div>
  );
}
