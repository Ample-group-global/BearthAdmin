"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OsDropStage {
  uuid: string;
  stageType: string;
  label: string | null;
  price: number | string | null;
  priceCurrencyAddress: string | null;
  startTime: string | null;
  endTime: string | null;
  maxPerWallet: number | null;
}

interface OsDrop {
  collectionSlug: string;
  collectionName: string;
  chain: string;
  contractAddress: string;
  dropType: string;
  isMinting: boolean;
  imageUrl: string | null;
  openseaUrl: string | null;
  activeStage: OsDropStage | null;
  nextStage: OsDropStage | null;
  stages?: OsDropStage[];
  totalSupply?: number | null;
  maxSupply?: number | null;
}

type DropType = "featured" | "upcoming" | "recently_minted";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHAIN_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ethereum: { bg: "#e8f0fe", text: "#1a56db", label: "Ethereum" },
  matic:    { bg: "#ede9fe", text: "#7c3aed", label: "Polygon" },
  polygon:  { bg: "#ede9fe", text: "#7c3aed", label: "Polygon" },
  base:     { bg: "#e0f2fe", text: "#0369a1", label: "Base" },
  solana:   { bg: "#d1fae5", text: "#065f46", label: "Solana" },
};

function ChainBadge({ chain }: { chain: string }) {
  const c = CHAIN_COLORS[chain?.toLowerCase()] ?? { bg: "#f3f4f6", text: "#6b7280", label: chain || "—" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

function Spinner({ small }: { small?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${small ? "py-4" : "py-16"}`}>
      <svg
        className={`${small ? "w-4 h-4" : "w-6 h-6"} animate-spin`}
        style={{ color: "#9bafc5" }}
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString();
  } catch {
    return s;
  }
}

function fmtPrice(price: number | string | null | undefined, currencyAddress?: string | null): string {
  if (price == null) return "—";
  const n = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(n)) return String(price);
  // If the number is very large (raw wei), convert to ETH
  if (n > 1000) {
    const eth = n / 1e18;
    return `${eth.toFixed(4)} ETH`;
  }
  return String(n);
}

// ─── Drop Card ────────────────────────────────────────────────────────────────

function StageInfo({ stage, label }: { stage: OsDropStage; label: string }) {
  return (
    <div
      className="rounded-xl p-3 mt-3 space-y-1.5"
      style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "#9bafc5" }}>
        {label}
      </p>
      {stage.label && (
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: "#64748b" }}>Stage</span>
          <span className="text-[10px] font-semibold" style={{ color: "#1e293b" }}>{stage.label}</span>
        </div>
      )}
      {stage.price != null && (
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: "#64748b" }}>Price</span>
          <span className="text-[10px] font-bold" style={{ color: "#24315f" }}>
            {fmtPrice(stage.price, stage.priceCurrencyAddress)}
          </span>
        </div>
      )}
      {stage.startTime && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] flex-shrink-0" style={{ color: "#64748b" }}>Start</span>
          <span className="text-[10px] text-right" style={{ color: "#475569" }}>{fmtDate(stage.startTime)}</span>
        </div>
      )}
      {stage.endTime && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] flex-shrink-0" style={{ color: "#64748b" }}>End</span>
          <span className="text-[10px] text-right" style={{ color: "#475569" }}>{fmtDate(stage.endTime)}</span>
        </div>
      )}
      {stage.maxPerWallet != null && (
        <div className="flex items-center justify-between">
          <span className="text-[10px]" style={{ color: "#64748b" }}>Max / wallet</span>
          <span className="text-[10px] font-semibold" style={{ color: "#1e293b" }}>{stage.maxPerWallet}</span>
        </div>
      )}
    </div>
  );
}

function DropCard({ drop }: { drop: OsDrop }) {
  const hasSupply =
    drop.totalSupply != null &&
    drop.maxSupply != null &&
    drop.maxSupply > 0;

  const supplyPct = hasSupply
    ? Math.min(100, Math.round(((drop.totalSupply ?? 0) / (drop.maxSupply ?? 1)) * 100))
    : 0;

  return (
    <div
      className="bg-white rounded-xl flex flex-col overflow-hidden"
      style={{
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
      }}
    >
      {/* Card header */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Collection identity */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="flex-shrink-0 rounded-xl overflow-hidden"
            style={{
              width: 48,
              height: 48,
              background: "#f1f5f9",
              border: "1px solid #e2e8f0",
            }}
          >
            {drop.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={drop.imageUrl}
                alt={drop.collectionName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={e => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ color: "#cbd5e1" }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: "#1e293b" }}>
              {drop.collectionName || drop.collectionSlug}
            </p>
            <p className="text-[10px] font-mono truncate mt-0.5" style={{ color: "#9bafc5" }}>
              {drop.collectionSlug}
            </p>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <ChainBadge chain={drop.chain} />

          {/* Drop type badge */}
          <span
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
            style={{ background: "#f0f4ff", color: "#4f46e5" }}
          >
            {drop.dropType?.replace(/_/g, " ") || "Drop"}
          </span>

          {/* Status badge */}
          {drop.isMinting && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: "#dcfce7", color: "#15803d" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: "#22c55e" }}
              />
              Live
            </span>
          )}
          {!drop.isMinting && drop.nextStage && (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: "#fef9c3", color: "#854d0e" }}
            >
              Upcoming
            </span>
          )}
        </div>

        {/* Active stage */}
        {drop.activeStage && (
          <StageInfo stage={drop.activeStage} label="Active Stage" />
        )}

        {/* Next stage (only show if not currently minting) */}
        {!drop.isMinting && drop.nextStage && (
          <StageInfo stage={drop.nextStage} label="Next Stage" />
        )}

        {/* Supply progress */}
        {hasSupply && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold" style={{ color: "#64748b" }}>Supply Minted</span>
              <span className="text-[10px] font-bold" style={{ color: "#24315f" }}>
                {(drop.totalSupply ?? 0).toLocaleString()} / {(drop.maxSupply ?? 0).toLocaleString()}
                &nbsp;
                <span style={{ color: "#9bafc5" }}>({supplyPct}%)</span>
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "#e2e8f0" }}>
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${supplyPct}%`,
                  background:
                    supplyPct >= 90
                      ? "#ef4444"
                      : supplyPct >= 60
                      ? "#f59e0b"
                      : "#22c55e",
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Card footer — View on OpenSea */}
      <div className="px-4 py-3" style={{ borderTop: "1px solid #f1f5f9" }}>
        {drop.openseaUrl ? (
          <a
            href={drop.openseaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{ background: "linear-gradient(135deg,#24315f,#1e4a8a)", color: "#fff" }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.88")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View on OpenSea
          </a>
        ) : (
          <div
            className="flex items-center justify-center w-full py-1.5 rounded-lg text-[11px] font-semibold"
            style={{ background: "#f8fafc", color: "#cbd5e1", border: "1px solid #e2e8f0" }}
          >
            No link available
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DropsPage() {
  const [dropType, setDropType] = useState<DropType>("featured");
  const [chains, setChains] = useState("");
  const [drops, setDrops] = useState<OsDrop[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [fetched, setFetched] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const buildUrl = (type: DropType, chainsVal: string, cursor?: string | null) => {
    let url = `/api/opensea/Drops?type=${encodeURIComponent(type)}`;
    const trimmedChains = chainsVal.trim();
    if (trimmedChains) {
      url += `&chains=${encodeURIComponent(trimmedChains)}`;
    }
    if (cursor) {
      url += `&next=${encodeURIComponent(cursor)}`;
    }
    return url;
  };

  const fetchDrops = async (type: DropType, chainsVal: string) => {
    setLoading(true);
    setErr("");
    setDrops([]);
    setNextCursor(null);
    setFetched(false);

    try {
      const r = await fetch(buildUrl(type, chainsVal), { credentials: "include" });
      if (!r.ok) {
        const text = await r.text().catch(() => r.statusText);
        throw new Error(text || r.statusText);
      }
      const d = await r.json();
      setDrops(d?.data ?? []);
      setNextCursor(d?.next ?? null);
      setFetched(true);
    } catch (e) {
      setErr(String(e));
      setFetched(true);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const r = await fetch(buildUrl(dropType, chains, nextCursor), { credentials: "include" });
      if (!r.ok) throw new Error(r.statusText);
      const d = await r.json();
      setDrops(prev => [...prev, ...(d?.data ?? [])]);
      setNextCursor(d?.next ?? null);
    } catch {
      // silently ignore load-more errors
    } finally {
      setLoadingMore(false);
    }
  };

  // Auto-load on mount with default type
  useEffect(() => {
    fetchDrops("featured", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const TYPE_TABS: { value: DropType; label: string }[] = [
    { value: "featured",         label: "Featured" },
    { value: "upcoming",         label: "Upcoming" },
    { value: "recently_minted",  label: "Recently Minted" },
  ];

  const handleLoad = () => {
    fetchDrops(dropType, chains);
  };

  const handleTabChange = (t: DropType) => {
    setDropType(t);
    fetchDrops(t, chains);
  };

  return (
    <div className="p-5">
      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-base font-bold" style={{ color: "#24315f" }}>NFT Drops</h1>
        <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
          Browse upcoming, active, and featured drops on OpenSea
        </p>
      </div>

      {/* Filter bar */}
      <div
        className="bg-white rounded-xl px-4 py-3 mb-5 flex flex-wrap items-end gap-3"
        style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
      >
        {/* Type tabs */}
        <div>
          <label className="block text-[10px] font-semibold mb-1.5" style={{ color: "#64748b" }}>
            Drop Type
          </label>
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #e2e8f0" }}>
            {TYPE_TABS.map((tab, idx) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleTabChange(tab.value)}
                className="px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  background: dropType === tab.value ? "#24315f" : "#f8fafc",
                  color: dropType === tab.value ? "#fff" : "#64748b",
                  borderRight: idx < TYPE_TABS.length - 1 ? "1px solid #e2e8f0" : undefined,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Chains filter */}
        <div className="flex-1 min-w-[160px] max-w-xs">
          <label className="block text-[10px] font-semibold mb-1.5" style={{ color: "#64748b" }}>
            Chains <span style={{ color: "#9bafc5", fontWeight: 400 }}>(optional, comma-separated)</span>
          </label>
          <input
            type="text"
            value={chains}
            onChange={e => setChains(e.target.value)}
            placeholder="e.g. ethereum,matic"
            className="w-full text-xs px-3 py-1.5 rounded-lg outline-none transition-all"
            style={{ border: "1.5px solid #e2e8f0", color: "#374151", background: "#f8fafc" }}
            onFocus={e => (e.target.style.borderColor = "#24315f")}
            onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
            onKeyDown={e => { if (e.key === "Enter") handleLoad(); }}
          />
        </div>

        {/* Load button */}
        <button
          type="button"
          onClick={handleLoad}
          disabled={loading}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white flex-shrink-0 transition-opacity"
          style={{
            background: "linear-gradient(135deg,#24315f,#1e4a8a)",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Loading…" : "Load"}
        </button>
      </div>

      {/* Error banner */}
      {err && (
        <div
          className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl mb-4"
          style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca" }}
        >
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 102 0V5zm-1 8a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          {err}
        </div>
      )}

      {/* Loading spinner */}
      {loading && <Spinner />}

      {/* Results */}
      {!loading && fetched && (
        <>
          {/* Results count */}
          {drops.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold" style={{ color: "#24315f" }}>
                {drops.length} drop{drops.length !== 1 ? "s" : ""}
              </span>
              <span className="text-[10px]" style={{ color: "#9bafc5" }}>
                {TYPE_TABS.find(t => t.value === dropType)?.label}
              </span>
            </div>
          )}

          {/* Cards grid */}
          {drops.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {drops.map((drop, i) => (
                  <DropCard key={`${drop.collectionSlug}-${i}`} drop={drop} />
                ))}
              </div>

              {/* Load More */}
              {nextCursor && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: loadingMore ? "#f1f5f9" : "#fff",
                      color: loadingMore ? "#94a3b8" : "#24315f",
                      border: "1.5px solid #e2e8f0",
                    }}
                    onMouseEnter={e => {
                      if (!loadingMore) {
                        e.currentTarget.style.background = "#24315f";
                        e.currentTarget.style.color = "#fff";
                        e.currentTarget.style.borderColor = "#24315f";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!loadingMore) {
                        e.currentTarget.style.background = "#fff";
                        e.currentTarget.style.color = "#24315f";
                        e.currentTarget.style.borderColor = "#e2e8f0";
                      }
                    }}
                  >
                    {loadingMore ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading more…
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Load More
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Empty state */
            <div
              className="bg-white rounded-xl flex flex-col items-center justify-center py-16 gap-3"
              style={{ border: "1px solid #e2e8f0" }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: "#f1f5f9" }}
              >
                <svg className="w-6 h-6" style={{ color: "#94a3b8" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold" style={{ color: "#64748b" }}>No drops found</p>
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                Try a different drop type or remove chain filters
              </p>
            </div>
          )}
        </>
      )}

      {/* Initial empty (not yet fetched) */}
      {!loading && !fetched && !err && (
        <div
          className="bg-white rounded-xl flex flex-col items-center justify-center py-16 gap-3"
          style={{ border: "1px solid #e2e8f0" }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: "#f1f5f9" }}
          >
            <svg className="w-6 h-6" style={{ color: "#94a3b8" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold" style={{ color: "#64748b" }}>Select a drop type and click Load</p>
        </div>
      )}
    </div>
  );
}
