"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  type: "collection" | "nft" | "account";
  slug?: string;
  name?: string;
  imageUrl?: string;
  chain?: string;
  address?: string;
  username?: string;
  contractAddress?: string;
  identifier?: string;
}

const CHAIN_BADGE: Record<string, { bg: string; color: string }> = {
  ethereum: { bg: "#e8f0fe", color: "#1a56db" },
  matic:    { bg: "#ede9fe", color: "#7c3aed" },
  polygon:  { bg: "#ede9fe", color: "#7c3aed" },
  solana:   { bg: "#d1fae5", color: "#065f46" },
  base:     { bg: "#e0f2fe", color: "#0369a1" },
};

const TYPE_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  collection: { bg: "#eff6ff", color: "#1d4ed8", label: "Collection" },
  nft:        { bg: "#f5f3ff", color: "#7c3aed", label: "NFT"        },
  account:    { bg: "#fef3c7", color: "#b45309", label: "Account"    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" style={{ color: "#9bafc5" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function TypeBadge({ type }: { type: string }) {
  const s = TYPE_BADGE[type] ?? { bg: "#f3f4f6", color: "#6b7280", label: type };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function ChainBadge({ chain }: { chain?: string }) {
  if (!chain) return null;
  const s = CHAIN_BADGE[chain.toLowerCase()] ?? { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
      style={{ background: s.bg, color: s.color }}
    >
      {chain}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const SEARCH_TYPES = ["All", "collection", "nft", "account"] as const;

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<string>("All");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const search = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError("");
    setSearched(false);
    try {
      const params = new URLSearchParams({ query: q, limit: "50" });
      if (searchType !== "All") params.set("type", searchType);
      const r = await fetch(`/api/opensea/Search?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error(`Error ${r.status}: ${r.statusText}`);
      const d = await r.json();
      setResults(Array.isArray(d) ? d : d.results ?? d.data ?? []);
    } catch (e) {
      setError(String(e));
      setResults([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") search();
  };

  const navigate = (item: SearchResult) => {
    if (item.type === "collection" && item.slug) {
      router.push(`/admin/opensea/collections`);
    } else if (item.type === "account" && item.address) {
      router.push(`/admin/opensea/accounts/${encodeURIComponent(item.address)}`);
    } else if (item.type === "nft" && item.contractAddress && item.chain) {
      router.push(`/admin/opensea/nfts?chain=${item.chain}&contract=${item.contractAddress}`);
    }
  };

  return (
    <div className="p-5 max-w-4xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-base font-bold" style={{ color: "#24315f" }}>OpenSea Search</h1>
        <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
          Search across collections, NFTs, and accounts on OpenSea
        </p>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-xl p-5 mb-5" style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#94a3b8" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              autoFocus
              type="text"
              placeholder="Search collections, NFTs, wallets…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKey}
              className="w-full text-sm pl-10 pr-4 py-2.5 rounded-xl outline-none transition-all"
              style={{ border: "1.5px solid #e2e8f0", color: "#374151", background: "#f8fafc" }}
              onFocus={e => (e.target.style.borderColor = "#24315f")}
              onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
            />
          </div>
          <button
            onClick={search}
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
            style={{ background: "linear-gradient(135deg,#24315f,#1e4a8a)", opacity: loading || !query.trim() ? 0.6 : 1 }}
          >
            {loading ? <Spinner /> : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            Search
          </button>
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider mr-1" style={{ color: "#94a3b8" }}>Filter:</span>
          {SEARCH_TYPES.map(t => (
            <button
              key={t}
              onClick={() => setSearchType(t)}
              className="px-3 py-1 rounded-full text-[11px] font-semibold transition-all capitalize"
              style={
                searchType === t
                  ? { background: "#24315f", color: "#fff" }
                  : { background: "#f1f5f9", color: "#64748b" }
              }
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 text-xs px-4 py-3 rounded-xl" style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca" }}>
          {error}
        </div>
      )}

      {/* Results */}
      {searched && !error && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
            <span className="text-xs font-bold" style={{ color: "#24315f" }}>Results</span>
            {results.length > 0 && (
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full" style={{ background: "#f0f2f7", color: "#64748b" }}>
                {results.length} result{results.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {results.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-10 h-10 mx-auto mb-3" style={{ color: "#e2e8f0" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm font-semibold" style={{ color: "#94a3b8" }}>No results found</p>
              <p className="text-xs mt-1" style={{ color: "#cbd5e1" }}>Try a different query or filter type</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {results.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  onClick={() => navigate(item)}
                >
                  {/* Image / avatar */}
                  <div
                    className="w-10 h-10 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
                    style={{ background: "#f1f5f9", border: "1px solid #e2e8f0" }}
                  >
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="w-full h-full object-cover"
                        onError={e => { e.currentTarget.style.display = "none"; }} />
                    ) : (
                      <svg className="w-5 h-5" style={{ color: "#cbd5e1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold truncate" style={{ color: "#1e293b" }}>
                        {item.name ?? item.username ?? item.address ?? item.slug ?? "—"}
                      </span>
                      <TypeBadge type={item.type} />
                      {item.chain && <ChainBadge chain={item.chain} />}
                    </div>
                    <p className="text-[11px] font-mono truncate" style={{ color: "#94a3b8" }}>
                      {item.slug ?? item.address ?? item.contractAddress ?? ""}
                      {item.identifier ? ` #${item.identifier}` : ""}
                    </p>
                  </div>

                  {/* Arrow */}
                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: "#cbd5e1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Initial state */}
      {!searched && !loading && (
        <div className="text-center py-20">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#eff6ff,#e0e7ff)" }}
          >
            <svg className="w-8 h-8" style={{ color: "#6366f1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-sm font-semibold" style={{ color: "#64748b" }}>Search OpenSea</p>
          <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
            Enter a collection name, NFT name, or wallet address above
          </p>
        </div>
      )}
    </div>
  );
}
