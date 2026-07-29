"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useChain } from "@/lib/ChainContext";
import { fetchMintedEvents, enrichEvents, type MintedEvent, type ContractState } from "@/lib/nft-events";
import { fetchTokenMetadata, ipfsToGateway, type NFTMetadata } from "@/lib/ipfs";

// ─── helpers ────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function Badge({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={style}>
      {label}
    </span>
  );
}

const MINT_BADGE: Record<string, React.CSSProperties> = {
  "WL Free":       { background: "rgba(65,175,235,0.1)",  color: "#2e9fd8" },
  "Fixed Price":   { background: "rgba(139,92,246,0.1)",  color: "#7c3aed" },
  "Dutch Auction": { background: "rgba(217,119,6,0.1)",   color: "#d97706" },
  "Admin":         { background: "rgba(36,49,95,0.1)",    color: "#24315f" },
};

type SortCol = "tokenId" | "owner" | "mintType" | "waveNum" | "gasFee" | "date";

// ─── NFT Detail Modal ────────────────────────────────────────────────────────

interface NFTModalProps {
  ev: MintedEvent;
  enrich: { gasFeeWei: bigint; gasFeeEth: string; currentHolder: string; transferred: boolean } | undefined;
  blockExplorer: string;
  onClose: () => void;
}

function NFTModal({ ev, enrich, blockExplorer, onClose }: NFTModalProps) {
  const [meta, setMeta] = useState<NFTMetadata | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [useAnimation, setUseAnimation] = useState(true);

  useEffect(() => {
    setMetaLoading(true);
    setMeta(null);
    setImgError(false);
    setUseAnimation(true);
    fetchTokenMetadata(ev.tokenId).then((m) => {
      setMeta(m);
      setMetaLoading(false);
    });
  }, [ev.tokenId]);

  const imageUrl = meta ? ipfsToGateway(meta.image) : "";
  const animUrl  = meta?.animation_url ? ipfsToGateway(meta.animation_url) : "";
  const isVideo  = animUrl && (animUrl.endsWith(".mp4") || animUrl.endsWith(".webm") || animUrl.endsWith(".ogv"));
  const displayUrl = useAnimation && animUrl ? animUrl : imageUrl;

  const holder = enrich?.currentHolder;
  const transferred = enrich?.transferred ?? false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,23,38,0.72)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="relative flex bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-3xl max-h-[90vh]"
        style={{ border: "1px solid #e5e7eb" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors text-sm"
          style={{ background: "#f4f6fb", border: "1px solid #e5e7eb", color: "#6b7280" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#e5e7eb"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#f4f6fb"; }}
        >
          ✕
        </button>

        {/* Left — image / animation */}
        <div className="flex-shrink-0 flex flex-col items-center justify-center gap-3 p-6"
          style={{ width: 300, background: "#f4f6fb", borderRight: "1px solid #e5e7eb" }}>

          {metaLoading ? (
            <div className="w-full aspect-square rounded-xl flex items-center justify-center" style={{ background: "#e9edf7" }}>
              <svg className="w-8 h-8 animate-spin" fill="none" viewBox="0 0 24 24" style={{ color: "#41afeb" }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : imageUrl && !imgError ? (
            <>
              {useAnimation && animUrl && !isVideo ? (
                <img
                  src={animUrl}
                  alt={meta?.name ?? `NFT #${ev.tokenId}`}
                  className="w-full aspect-square rounded-xl object-contain"
                  style={{ background: "#e9edf7" }}
                  onError={() => setUseAnimation(false)}
                />
              ) : useAnimation && animUrl && isVideo ? (
                <video
                  src={animUrl}
                  autoPlay loop muted playsInline
                  className="w-full aspect-square rounded-xl object-contain"
                  style={{ background: "#e9edf7" }}
                  onError={() => setUseAnimation(false)}
                />
              ) : (
                <img
                  src={imageUrl}
                  alt={meta?.name ?? `NFT #${ev.tokenId}`}
                  className="w-full aspect-square rounded-xl object-contain"
                  style={{ background: "#e9edf7" }}
                  onError={() => setImgError(true)}
                />
              )}
              {animUrl && (
                <button
                  onClick={() => setUseAnimation((v) => !v)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: "rgba(65,175,235,0.1)", color: "#2e9fd8", border: "1px solid rgba(65,175,235,0.2)" }}
                >
                  {useAnimation ? "Show Static Image" : "Show Animation"}
                </button>
              )}
            </>
          ) : (
            <div className="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-2"
              style={{ background: "#e9edf7", color: "#9bafc5" }}>
              <span className="text-3xl">🐻</span>
              <span className="text-xs">No image</span>
            </div>
          )}

          {/* External links */}
          <div className="flex gap-2 w-full">
            <a
              href={`https://opensea.io/assets/ethereum/0x48ba45309d7a4Ebc7D71e32AC702AbAE8e9fCE48/${ev.tokenId}`}
              target="_blank" rel="noreferrer"
              className="flex-1 text-center text-xs font-semibold py-1.5 rounded-lg transition-colors"
              style={{ background: "rgba(65,175,235,0.08)", color: "#2e9fd8", border: "1px solid rgba(65,175,235,0.2)" }}
            >
              OpenSea ↗
            </a>
            <a
              href={`${blockExplorer}/tx/${ev.txHash}`}
              target="_blank" rel="noreferrer"
              className="flex-1 text-center text-xs font-semibold py-1.5 rounded-lg transition-colors"
              style={{ background: "rgba(107,114,128,0.06)", color: "#6b7280", border: "1px solid #e5e7eb" }}
            >
              Etherscan ↗
            </a>
          </div>
        </div>

        {/* Right — metadata + admin info */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 min-w-0">

          {/* Title */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded" style={{ background: "#f4f6fb", color: "#24315f" }}>
                #{ev.tokenId}
              </span>
              <Badge label={ev.mintType} style={MINT_BADGE[ev.mintType] ?? {}} />
              {ev.isRevealed
                ? <Badge label="Revealed" style={{ background: "rgba(217,119,6,0.08)", color: "#d97706" }} />
                : <Badge label="Blind Box" style={{ background: "rgba(107,114,128,0.08)", color: "#6b7280" }} />
              }
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {metaLoading ? "Loading…" : meta?.name ?? `Bearth NFT #${ev.tokenId}`}
            </h2>
            {meta?.description && (
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "#6b7280" }}>
                {meta.description}
              </p>
            )}
          </div>

          {/* Attributes */}
          {meta && meta.attributes.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "#9bafc5" }}>Traits</p>
              <div className="grid grid-cols-2 gap-2">
                {meta.attributes.map((attr, i) => (
                  <div key={i} className="rounded-lg p-2.5" style={{ background: "rgba(65,175,235,0.06)", border: "1px solid rgba(65,175,235,0.18)" }}>
                    <p className="text-xs uppercase tracking-wide mb-0.5" style={{ color: "#9bafc5" }}>{attr.trait_type}</p>
                    <p className="text-sm font-semibold text-gray-800">{String(attr.value)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {meta && meta.attributes.length === 0 && !metaLoading && (
            <div className="rounded-lg p-3 text-sm text-center" style={{ background: "#f4f6fb", color: "#9bafc5" }}>
              No traits yet — traits will appear after reveal
            </div>
          )}

          {/* Divider */}
          <div style={{ borderTop: "1px solid #f3f4f6" }} />

          {/* Admin info */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#9bafc5" }}>Mint Details</p>
            <div className="space-y-2.5 text-sm">

              <div className="flex items-start justify-between gap-2">
                <span className="text-gray-500 flex-shrink-0">Minted By</span>
                <button
                  onClick={() => copyToClipboard(ev.owner)}
                  title={ev.owner}
                  className="font-mono text-xs flex items-center gap-1 group text-right"
                  style={{ color: "#41afeb" }}
                >
                  {shortAddr(ev.owner)}
                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>

              {holder && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-gray-500 flex-shrink-0">Current Holder</span>
                  <div className="flex items-center gap-1.5">
                    {transferred && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>
                        Transferred
                      </span>
                    )}
                    <button
                      onClick={() => copyToClipboard(holder)}
                      title={holder}
                      className="font-mono text-xs flex items-center gap-1 group"
                      style={{ color: transferred ? "#dc2626" : "#059669" }}
                    >
                      {shortAddr(holder)}
                      <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-500">Wave</span>
                <span className="font-mono text-xs text-gray-700">{ev.waveLabel}</span>
              </div>

              {enrich && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Gas Fee</span>
                  <span className="font-mono font-semibold text-xs" style={{ color: "#d97706" }}>{enrich.gasFeeEth}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="text-xs text-gray-600">{ev.dateStr}</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-500">Transaction</span>
                <a
                  href={`${blockExplorer}/tx/${ev.txHash}`}
                  target="_blank" rel="noreferrer"
                  className="font-mono text-xs flex items-center gap-0.5 hover:underline"
                  style={{ color: "#41afeb" }}
                >
                  {ev.txHash.slice(0, 12)}…
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Block</span>
                <a
                  href={`${blockExplorer}/block/${ev.blockNumber}`}
                  target="_blank" rel="noreferrer"
                  className="font-mono text-xs hover:underline"
                  style={{ color: "#9bafc5" }}
                >
                  {ev.blockNumber.toLocaleString()}
                </a>
              </div>
            </div>
          </div>

          {/* Metadata link */}
          {!metaLoading && (
            <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
              <a
                href={`https://amgbearth.myfilebase.com/ipfs/QmdkLm4gFZaRhjGMjZM8ouuQ8fC7AMTLWNDkDmytbYZY5k/${ev.tokenId}`}
                target="_blank" rel="noreferrer"
                className="text-xs flex items-center gap-1 hover:underline"
                style={{ color: "#9bafc5" }}
              >
                View raw metadata on IPFS
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Thumbnail ───────────────────────────────────────────────────────────────

// Pre-reveal all tokens share the same blind box image — no per-token fetch needed for thumbs
const BLIND_BOX_IMG = "https://amgbearth.myfilebase.com/ipfs/QmbJJezw9jgxN1P4eWD58XU6rSPokENE4MmD2i4qfBwfrF";

function NFTThumb({ tokenId }: { tokenId: number }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-base" style={{ background: "#f4f6fb" }}>
        🐻
      </div>
    );
  }
  return (
    <img
      src={BLIND_BOX_IMG}
      alt={`#${tokenId}`}
      loading="lazy"
      onError={() => setErr(true)}
      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
      style={{ background: "#f4f6fb", border: "1px solid #e5e7eb" }}
    />
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function NFTOverviewPage() {
  const { activeChain } = useChain();

  const [events, setEvents] = useState<MintedEvent[]>([]);
  const [contractState, setContractState] = useState<ContractState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Enrichment state
  const [enrichMap, setEnrichMap] = useState<Map<number, {
    gasFeeWei: bigint; gasFeeEth: string; currentHolder: string; transferred: boolean;
  }>>(new Map());
  const [enriching, setEnriching] = useState(false);
  const [enrichDone, setEnrichDone] = useState(0);
  const [enrichTotal, setEnrichTotal] = useState(0);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  // NFT modal
  const [selectedToken, setSelectedToken] = useState<MintedEvent | null>(null);

  // Filters / pagination
  const [search, setSearch] = useState("");
  const [mintTypeFilter, setMintTypeFilter] = useState("all");
  const [holderFilter, setHolderFilter] = useState("all");
  const [sortCol, setSortCol] = useState<SortCol>("tokenId");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const PER_PAGE = 30;

  // ── load events ──────────────────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setEvents([]);
    setEnrichMap(new Map());
    setEnrichDone(0);
    setEnrichTotal(0);
    setSelectedToken(null);
    try {
      const result = await fetchMintedEvents(activeChain.chainId);
      setEvents(result.events);
      setContractState(result.contractState);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Failed to fetch events");
    } finally {
      setLoading(false);
    }
  }, [activeChain]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // ── enrich ───────────────────────────────────────────────────────────────
  const startEnrich = async () => {
    if (!events.length || enriching) return;
    setEnriching(true);
    setEnrichError(null);
    setEnrichDone(0);
    setEnrichTotal(events.length);
    try {
      const result = await enrichEvents(events, activeChain.chainId, (done, total) => {
        setEnrichDone(done);
        setEnrichTotal(total);
        setEnrichMap((prev) => new Map(prev));
      });
      setEnrichMap(result);
    } catch (e: unknown) {
      setEnrichError(e instanceof Error ? e.message : "Enrichment failed");
    } finally {
      setEnriching(false);
    }
  };

  // ── export CSV ───────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ["Token ID", "Minted By", "Current Holder", "Transferred", "Wave", "Mint Type", "Gas Fee (ETH)", "Status", "Date", "Tx Hash"];
    const rows = events.map((ev) => {
      const enrich = enrichMap.get(ev.tokenId);
      return [
        ev.tokenId,
        ev.owner,
        enrich?.currentHolder ?? ev.owner,
        enrich ? (enrich.transferred ? "Yes" : "No") : "—",
        ev.waveNum,
        ev.mintType,
        enrich?.gasFeeEth ?? "—",
        ev.isRevealed ? "Revealed" : "Blind Box",
        ev.dateStr,
        ev.txHash,
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bearth-nft-${activeChain.shortName}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── derived stats ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalGasWei = [...enrichMap.values()].reduce((s, e) => s + e.gasFeeWei, 0n);
    const transferred = [...enrichMap.values()].filter((e) => e.transferred).length;
    return {
      total: events.length,
      wlFree: events.filter((e) => e.mintType === "WL Free").length,
      fixedPrice: events.filter((e) => e.mintType === "Fixed Price").length,
      dutchAuction: events.filter((e) => e.mintType === "Dutch Auction").length,
      admin: events.filter((e) => e.mintType === "Admin").length,
      revealed: events.filter((e) => e.isRevealed).length,
      totalGasEth: enrichMap.size > 0 ? Number(totalGasWei) / 1e18 : null,
      transferred,
    };
  }, [events, enrichMap]);

  // ── filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...events];
    const q = search.toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const enrich = enrichMap.get(e.tokenId);
        return (
          String(e.tokenId).includes(q) ||
          e.owner.toLowerCase().includes(q) ||
          (enrich?.currentHolder?.toLowerCase().includes(q) ?? false) ||
          e.txHash.toLowerCase().includes(q)
        );
      });
    }
    if (mintTypeFilter !== "all") list = list.filter((e) => e.mintType === mintTypeFilter);
    if (holderFilter === "transferred") list = list.filter((e) => enrichMap.get(e.tokenId)?.transferred === true);
    if (holderFilter === "held") list = list.filter((e) => !enrichMap.get(e.tokenId)?.transferred);
    list.sort((a, b) => {
      let cmp = 0;
      if (sortCol === "tokenId")   cmp = a.tokenId - b.tokenId;
      else if (sortCol === "owner") cmp = a.owner.localeCompare(b.owner);
      else if (sortCol === "mintType") cmp = a.mintType.localeCompare(b.mintType);
      else if (sortCol === "waveNum") cmp = a.waveNum - b.waveNum;
      else if (sortCol === "gasFee") {
        const ga = enrichMap.get(a.tokenId)?.gasFeeWei ?? 0n;
        const gb = enrichMap.get(b.tokenId)?.gasFeeWei ?? 0n;
        cmp = Number(ga - gb);
      }
      else if (sortCol === "date") cmp = a.timestamp - b.timestamp;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [events, enrichMap, search, mintTypeFilter, holderFilter, sortCol, sortDir]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortCol }) =>
    sortCol === col ? <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span> : <span className="ml-0.5 opacity-20">↕</span>;

  const enrichPct = enrichTotal > 0 ? Math.round((enrichDone / enrichTotal) * 100) : 0;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-5">

      {/* ── NFT Detail Modal ── */}
      {selectedToken && (
        <NFTModal
          ev={selectedToken}
          enrich={enrichMap.get(selectedToken.tokenId)}
          blockExplorer={activeChain.blockExplorer}
          onClose={() => setSelectedToken(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">NFT Overview</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9bafc5" }}>
            {activeChain.name} · {events.length} minted
            {contractState && ` · ${contractState.totalMinted} on-chain · Phase ${contractState.phase}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {events.length > 0 && !enriching && enrichMap.size === 0 && (
            <button onClick={startEnrich}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg text-white transition-all"
              style={{ background: "#24315f" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#1a2347")}
              onMouseLeave={e => (e.currentTarget.style.background = "#24315f")}
              title="Fetches gas fees and current holders — takes ~30–60s"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Load Gas &amp; Holders
            </button>
          )}
          {enriching && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: "rgba(65,175,235,0.1)", color: "#2e9fd8" }}>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading {enrichDone}/{enrichTotal} ({enrichPct}%)
            </div>
          )}
          {enrichMap.size > 0 && !enriching && (
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-all"
              style={{ background: "#f4f6fb", border: "1px solid #e5e7eb", color: "#374151" }}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          )}
          <button onClick={loadEvents} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
            style={{ background: "#fff", border: "1px solid #e5e7eb", color: "#6b7280" }}
          >
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Minted",   value: stats.total,        color: "#24315f" },
          { label: "WL Free (Wave1)",value: stats.wlFree,       color: "#2e9fd8" },
          { label: "Fixed Price",    value: stats.fixedPrice,   color: "#7c3aed" },
          { label: "Dutch Auction",  value: stats.dutchAuction, color: "#d97706" },
          { label: "Admin Mints",    value: stats.admin,        color: "#6b7280" },
          { label: "Revealed",       value: stats.revealed,     color: "#059669" },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1 font-medium">{c.label}</p>
            <p className="text-2xl font-bold" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* ── Financial + Holder Summary ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#9bafc5" }}>Paid Mints</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Fixed Price (Wave 2)</span>
              <span className="font-semibold text-gray-800">{stats.fixedPrice}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Dutch Auction</span>
              <span className="font-semibold text-gray-800">{stats.dutchAuction}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
              <span className="font-semibold text-gray-700">Total Paid</span>
              <span className="font-bold" style={{ color: "#7c3aed" }}>{stats.fixedPrice + stats.dutchAuction}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#9bafc5" }}>Gas Fees (Minters)</p>
          {enrichMap.size === 0 ? (
            <p className="text-sm text-gray-400">Click "Load Gas &amp; Holders" to see gas data</p>
          ) : enriching ? (
            <div className="space-y-2">
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-2 rounded-full transition-all" style={{ width: `${enrichPct}%`, background: "#41afeb" }} />
              </div>
              <p className="text-xs text-gray-400">Loading {enrichDone} of {enrichTotal}…</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Txns enriched</span>
                <span className="font-semibold text-gray-800">{enrichMap.size}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                <span className="font-semibold text-gray-700">Total Gas</span>
                <span className="font-bold" style={{ color: "#d97706" }}>
                  {stats.totalGasEth !== null ? `${stats.totalGasEth.toFixed(6)} ETH` : "—"}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#9bafc5" }}>Holder Status</p>
          {enrichMap.size === 0 ? (
            <p className="text-sm text-gray-400">Load holder data to see transfers</p>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Still with minter</span>
                <span className="font-semibold" style={{ color: "#059669" }}>{enrichMap.size - stats.transferred}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Transferred</span>
                <span className="font-semibold" style={{ color: "#dc2626" }}>{stats.transferred}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
                <span className="font-semibold text-gray-700">Unique holders</span>
                <span className="font-bold text-gray-800">
                  {new Set([...enrichMap.values()].map((e) => e.currentHolder.toLowerCase())).size}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Error banners ── */}
      {loadError && (
        <div className="p-4 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          <strong>Load error:</strong> {loadError}
        </div>
      )}
      {enrichError && (
        <div className="p-4 rounded-xl text-sm" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
          <strong>Enrichment error:</strong> {enrichError}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Token ID, wallet, or tx hash…"
            className="pl-9 pr-3 py-2 rounded-lg text-sm outline-none w-64"
            style={{ border: "1px solid #e5e7eb" }}
            onFocus={e => { e.currentTarget.style.borderColor = "#41afeb"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(65,175,235,0.12)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
          />
        </div>
        <select value={mintTypeFilter} onChange={(e) => { setMintTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ border: "1px solid #e5e7eb", color: "#374151" }}>
          <option value="all">All Mint Types</option>
          <option value="WL Free">WL Free (Genesis)</option>
          <option value="Fixed Price">Fixed Price</option>
          <option value="Dutch Auction">Dutch Auction</option>
          <option value="English Auction">English Auction</option>
          <option value="Admin">Admin Mint</option>
        </select>
        {enrichMap.size > 0 && (
          <select value={holderFilter} onChange={(e) => { setHolderFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: "1px solid #e5e7eb", color: "#374151" }}>
            <option value="all">All Holders</option>
            <option value="held">Still with Minter</option>
            <option value="transferred">Transferred</option>
          </select>
        )}
        <span className="ml-auto text-xs" style={{ color: "#9bafc5" }}>
          {filtered.length} results · click any row to preview NFT
        </span>
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <svg className="w-6 h-6 animate-spin mx-auto mb-3" fill="none" viewBox="0 0 24 24" style={{ color: "#41afeb" }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-gray-500">Scanning blockchain events from block {activeChain.deploymentBlock?.toLocaleString() ?? "0"}…</p>
            <p className="text-xs text-gray-400 mt-1">Fetching in 2,000-block chunks — takes ~15–30 seconds</p>
          </div>
        ) : paginated.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            {events.length === 0 ? "No minted NFTs found on this network." : "No results match your filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[960px]">
              <thead>
                <tr style={{ background: "#f4f6fb", borderBottom: "1px solid #e5e7eb" }}>
                  {/* Thumbnail */}
                  <th className="px-3 py-3 w-14" />
                  {[
                    { label: "Token ID",       col: "tokenId"  as SortCol },
                    { label: "Minted By",      col: "owner"    as SortCol },
                    { label: "Current Holder", col: null },
                    { label: "Mint Type",      col: "mintType" as SortCol },
                    { label: "Wave",           col: "waveNum"  as SortCol },
                    { label: "Gas Fee",        col: "gasFee"   as SortCol },
                    { label: "Status",         col: null },
                    { label: "Date",           col: "date"     as SortCol },
                    { label: "Tx",             col: null },
                  ].map(({ label, col }) => (
                    <th key={label}
                      onClick={col ? () => toggleSort(col) : undefined}
                      className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide select-none whitespace-nowrap ${col ? "cursor-pointer" : ""}`}
                      style={{ color: "#9bafc5" }}
                    >
                      {label}{col && <SortIcon col={col} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((ev, idx) => {
                  const enrich = enrichMap.get(ev.tokenId);
                  const holder = enrich?.currentHolder ?? null;
                  const transferred = enrich?.transferred ?? false;
                  const isEven = idx % 2 === 0;

                  return (
                    <tr key={ev.tokenId}
                      onClick={() => setSelectedToken(ev)}
                      className="cursor-pointer"
                      style={{ background: isEven ? "#fff" : "#fafbff", borderBottom: "1px solid #f3f4f6" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#eff8fe")}
                      onMouseLeave={e => (e.currentTarget.style.background = isEven ? "#fff" : "#fafbff")}
                    >
                      {/* Thumbnail */}
                      <td className="px-3 py-2">
                        <NFTThumb tokenId={ev.tokenId} />
                      </td>

                      {/* Token ID */}
                      <td className="px-4 py-3 font-mono font-bold" style={{ color: "#24315f" }}>
                        #{ev.tokenId}
                      </td>

                      {/* Minted By */}
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); copyToClipboard(ev.owner); }}
                          title={`Copy: ${ev.owner}`}
                          className="font-mono text-xs flex items-center gap-1 group"
                          style={{ color: "#41afeb" }}
                        >
                          {shortAddr(ev.owner)}
                          <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </td>

                      {/* Current Holder */}
                      <td className="px-4 py-3">
                        {enriching && !enrich ? (
                          <span className="text-xs text-gray-300">loading…</span>
                        ) : holder ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); copyToClipboard(holder); }}
                              title={`Copy: ${holder}`}
                              className="font-mono text-xs flex items-center gap-1 group"
                              style={{ color: transferred ? "#dc2626" : "#059669" }}
                            >
                              {shortAddr(holder)}
                              <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </button>
                            {transferred && (
                              <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>
                                Transferred
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>

                      {/* Mint Type */}
                      <td className="px-4 py-3">
                        <Badge label={ev.mintType} style={MINT_BADGE[ev.mintType] ?? {}} />
                      </td>

                      {/* Wave */}
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">
                        W{ev.waveNum}
                      </td>

                      {/* Gas Fee */}
                      <td className="px-4 py-3 font-mono text-xs">
                        {enriching && !enrich ? (
                          <span className="text-gray-300">loading…</span>
                        ) : enrich ? (
                          <span style={{ color: "#d97706" }}>{enrich.gasFeeEth}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        {ev.isRevealed
                          ? <Badge label="Revealed" style={{ background: "rgba(217,119,6,0.08)", color: "#d97706" }} />
                          : <Badge label="Blind Box" style={{ background: "rgba(107,114,128,0.08)", color: "#6b7280" }} />}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "#9bafc5" }}>
                        {ev.dateStr}
                      </td>

                      {/* Tx */}
                      <td className="px-4 py-3">
                        <a
                          href={`${activeChain.blockExplorer}/tx/${ev.txHash}`}
                          target="_blank" rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-xs flex items-center gap-0.5 hover:underline"
                          style={{ color: "#41afeb" }}
                        >
                          {ev.txHash.slice(0, 8)}…
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-between px-4 py-3 text-sm" style={{ borderTop: "1px solid #e5e7eb", color: "#9bafc5" }}>
            <span>Page {page} of {totalPages} · {filtered.length} records</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-40"
                style={{ border: "1px solid #e5e7eb" }}>«</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg disabled:opacity-40"
                style={{ border: "1px solid #e5e7eb" }}>← Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg disabled:opacity-40"
                style={{ border: "1px solid #e5e7eb" }}>Next →</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                className="px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-40"
                style={{ border: "1px solid #e5e7eb" }}>»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
