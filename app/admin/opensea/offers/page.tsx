"use client";

import { useEffect, useState } from "react";

interface Offer {
  orderHash: string;
  chain: string;
  offerType: string;
  maker: string;
  price: string;
  priceCurrency: string;
  expirationDate: string;
  cancelled: boolean;
  traitCriteria: unknown;
}

type TabType = "all" | "best" | "trait offers";
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

const TABS: TabType[] = ["all", "best", "trait offers"];

const TH_COLS = ["Order Hash", "Chain", "Type", "Price", "Currency", "Maker", "Expiry", "Cancelled"];

function OffersTable({ offers }: { offers: Offer[] }) {
  if (offers.length === 0) return null;
  return (
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
          {offers.map((o, i) => (
            <tr key={o.orderHash ?? i} style={{ color: "#374151" }}>
              <td className="px-4 py-2.5 font-mono" style={{ color: "#9bafc5" }} title={o.orderHash}>
                {truncateHash(o.orderHash)}
              </td>
              <td className="px-4 py-2.5 capitalize">{o.chain ?? "—"}</td>
              <td className="px-4 py-2.5">
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: "#f0f2f7", color: "#24315f" }}>
                  {o.offerType ?? "offer"}
                </span>
              </td>
              <td className="px-4 py-2.5 font-semibold" style={{ color: "#f59e0b" }}>
                {formatPrice(o.price, o.priceCurrency)}
              </td>
              <td className="px-4 py-2.5" style={{ color: "#9bafc5" }}>{o.priceCurrency ?? "—"}</td>
              <td className="px-4 py-2.5 font-mono" title={o.maker} style={{ color: "#9bafc5" }}>
                {truncateAddr(o.maker)}
              </td>
              <td className="px-4 py-2.5" style={{ color: "#9bafc5" }}>{formatExpiry(o.expirationDate)}</td>
              <td className="px-4 py-2.5">
                {o.cancelled ? (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>Yes</span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold" style={{ background: "rgba(22,163,74,0.08)", color: "#16a34a" }}>No</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OffersPage() {
  const [slug, setSlug] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [loaded, setLoaded] = useState(false);

  // NFT-level
  const [nftChain, setNftChain] = useState("");
  const [nftContract, setNftContract] = useState("");
  const [nftTokenId, setNftTokenId] = useState("");
  const [nftOffers, setNftOffers] = useState<Offer[]>([]);
  const [nftLoading, setNftLoading] = useState(false);
  const [nftLoaded, setNftLoaded] = useState(false);
  const [nftMode, setNftMode] = useState<"all" | "best" | null>(null);

  const showToast = (msg: string, type: ToastType = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getEndpoint = (currentSlug: string, tab: TabType) => {
    const base = `/api/opensea/Offers/collection/${currentSlug.trim()}`;
    if (tab === "best") return `${base}/best`;
    if (tab === "trait offers") return `${base}/traits`;
    return base;
  };

  const loadOffers = async (currentSlug: string, tab: TabType) => {
    if (!currentSlug.trim()) return;
    setLoading(true);
    setOffers([]);
    setLoaded(false);
    try {
      const r = await fetch(getEndpoint(currentSlug, tab), { credentials: "include" });
      const d = await r.json();
      if (!r.ok) {
        showToast(d?.error ?? d?.title ?? "Failed to load offers", "error");
        return;
      }
      const rows: Offer[] = Array.isArray(d) ? d : d.offers ?? d.data ?? [];
      setOffers(rows);
      setLoaded(true);
      if (rows.length === 0) showToast("No offers found for this collection.", "info");
    } catch {
      showToast("Network error loading offers.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLoad = () => {
    const s = slugInput.trim();
    if (!s) return;
    setSlug(s);
    loadOffers(s, activeTab);
  };

  const switchTab = (tab: TabType) => {
    setActiveTab(tab);
    if (slug) loadOffers(slug, tab);
  };

  const handleSync = async () => {
    if (!slug.trim()) {
      showToast("Enter and load a collection slug first.", "error");
      return;
    }
    setSyncing(true);
    try {
      const r = await fetch(`/api/opensea/Offers/collection/${slug.trim()}/sync`, {
        method: "POST",
        credentials: "include",
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        showToast(d?.error ?? d?.title ?? "Sync failed.", "error");
      } else {
        showToast(d?.message ?? "Sync triggered successfully.", "success");
        loadOffers(slug, activeTab);
      }
    } catch {
      showToast("Network error during sync.", "error");
    } finally {
      setSyncing(false);
    }
  };

  // NFT offers lookup
  const loadNftOffers = async (best: boolean) => {
    if (!nftChain.trim() || !nftContract.trim() || !nftTokenId.trim()) {
      showToast("Fill in Chain, Contract, and Token ID.", "error");
      return;
    }
    setNftMode(best ? "best" : "all");
    setNftLoading(true);
    setNftOffers([]);
    setNftLoaded(false);
    try {
      const base = `/api/opensea/Offers/chain/${nftChain.trim()}/contract/${nftContract.trim()}/nft/${nftTokenId.trim()}`;
      const endpoint = best ? `${base}/best` : base;
      const r = await fetch(endpoint, { credentials: "include" });
      const d = await r.json();
      if (!r.ok) {
        showToast(d?.error ?? d?.title ?? "Failed to load NFT offers", "error");
        return;
      }
      const rows: Offer[] = Array.isArray(d) ? d : d.offers ?? d.data ?? (d && typeof d === "object" && d.orderHash ? [d] : []);
      setNftOffers(rows);
      setNftLoaded(true);
      if (rows.length === 0) showToast("No offers found for this NFT.", "info");
    } catch {
      showToast("Network error loading NFT offers.", "error");
    } finally {
      setNftLoading(false);
    }
  };

  useEffect(() => { /* intentional */ }, []);

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
        <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Offers</h1>
        <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Browse and sync OpenSea offers by collection or NFT</p>
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
            style={{ ...inputStyle, minWidth: "160px" }}
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
        </div>
      </div>

      {/* Tabs + Table */}
      <div className="bg-white rounded-lg overflow-hidden mb-6" style={{ border: "1px solid #e4e7ed" }}>
        <div className="px-4 pt-3 pb-0 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: "#e4e7ed" }}>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => switchTab(tab)}
                className="px-4 py-1.5 rounded text-xs font-semibold capitalize transition-all"
                style={activeTab === tab
                  ? { background: "#fff", color: "#24315f", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                  : { color: "#9bafc5" }}
              >
                {tab}
              </button>
            ))}
          </div>
          {offers.length > 0 && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded mb-1" style={{ background: "#f0f2f7", color: "#9bafc5" }}>
              {offers.length} row{offers.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : loaded && offers.length === 0 ? (
          <div className="py-10 text-center text-xs" style={{ color: "#9bafc5" }}>
            No offers found for this collection.
          </div>
        ) : !loaded ? (
          <div className="flex flex-col items-center justify-center py-12" style={{ color: "#c4c9d4" }}>
            <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <p className="text-sm font-medium">Enter a collection slug above to load offers</p>
          </div>
        ) : (
          <OffersTable offers={offers} />
        )}
      </div>

      {/* NFT Offers section */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #e4e7ed" }}>
        <div className="px-4 py-2.5 border-b" style={{ borderColor: "#e4e7ed", background: "#f8f9fb" }}>
          <span className="text-xs font-bold" style={{ color: "#24315f" }}>NFT Offer Lookup</span>
          <p className="text-[11px] mt-0.5" style={{ color: "#9bafc5" }}>Query offers for a specific NFT by chain, contract, and token ID</p>
        </div>

        <div className="px-4 py-3 flex flex-wrap items-end gap-3" style={{ borderBottom: nftLoaded || nftLoading ? "1px solid #e4e7ed" : undefined }}>
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
              onClick={() => loadNftOffers(false)}
              disabled={nftLoading}
              className="px-3 py-1.5 rounded text-xs font-semibold text-white transition-opacity"
              style={{ background: "#24315f", opacity: nftLoading ? 0.55 : 1 }}
            >
              All Offers
            </button>
            <button
              onClick={() => loadNftOffers(true)}
              disabled={nftLoading}
              className="px-3 py-1.5 rounded text-xs font-semibold transition-opacity"
              style={{ background: "#f59e0b", color: "#fff", opacity: nftLoading ? 0.55 : 1 }}
            >
              Best Offer
            </button>
          </div>
        </div>

        {nftLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : nftLoaded ? (
          nftOffers.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: "#9bafc5" }}>
              No offers found for this NFT.
            </div>
          ) : (
            <>
              <div className="px-4 pt-2.5 pb-1 flex items-center gap-2">
                <span className="text-xs font-semibold" style={{ color: "#9bafc5" }}>
                  {nftMode === "best" ? "Best offer" : "All offers"} for{" "}
                  <span className="font-mono" style={{ color: "#374151" }}>
                    {truncateAddr(nftContract)} #{nftTokenId}
                  </span>
                  {" "}on{" "}
                  <span className="capitalize" style={{ color: "#374151" }}>{nftChain}</span>
                </span>
              </div>
              <OffersTable offers={nftOffers} />
            </>
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
