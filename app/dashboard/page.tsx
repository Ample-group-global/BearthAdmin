"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { fetchTokenMetadata, ipfsToGateway, type NFTMetadata } from "@/lib/ipfs";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DbStats {
  phase: number | null;
  phaseName: string | null;
  totalMinted: number;
  maxSupply: number;
  remaining: number;
  mintProgress: number;
  blindBoxUri: string | null;
  blindBoxImageUrl?: string | null;
  whitelistMint: { soldCount: number; quantity: number; closed: boolean };
  paidMint: { soldCount: number; quantity: number; priceEth: number | null; closed: boolean };
  revealed: number;
  isRevealed: boolean;
  adminRevenue: { totalEth: number; totalSales: number; totalQty: number } | null;
  onChain: { purchaseLimitEnabled: boolean; normalMaxPerWallet: number; sbt: boolean } | null;
}

interface DbToken {
  token_id: number;
  owner_address: string;
  wave_number: number | null;
  rarity_tier: string | null;
  rarity_price_eth: number | null;
  is_revealed: boolean;
  mint_tx_hash: string | null;
  minted_at: string | null;
  synced_at: string | null;
}

interface WaveMeta {
  waveNum: number;
  name: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_LABELS = ["Whitelist Mint", "Paid Mint", "Revealed"];
const PHASE_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
];

const RARITY_STYLE: Record<string, React.CSSProperties> = {
  Legendary: { background: "rgba(217,119,6,0.1)",  color: "#d97706" },
  Epic:      { background: "rgba(124,58,237,0.1)", color: "#7c3aed" },
  Rare:      { background: "rgba(59,130,246,0.1)", color: "#3b82f6" },
  Common:    { background: "rgba(107,114,128,0.1)", color: "#6b7280" },
};

function mintTypeLabel(waveNum: number | null): string {
  if (waveNum === null || waveNum === 0) return "Admin Reserve";
  if (waveNum === 1) return "WL Free";
  return "Paid Mint";
}

function mintTypeBadgeStyle(waveNum: number | null): React.CSSProperties {
  if (waveNum === null || waveNum === 0) return { background: "rgba(36,49,95,0.1)", color: "#24315f" };
  if (waveNum === 1) return { background: "rgba(65,175,235,0.1)", color: "#2e9fd8" };
  return { background: "rgba(124,58,237,0.1)", color: "#7c3aed" };
}

function shortAddr(addr: string | null): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function fmtDate(dt: string | null | undefined): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? "text-slate-900"}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

function QuickLink({ href, label, desc, color }: { href: string; label: string; desc: string; color: string }) {
  return (
    <Link href={href}
      className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all shadow-sm">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
        <div className="w-5 h-5 text-white font-bold text-xs flex items-center justify-center">→</div>
      </div>
      <div>
        <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{label}</div>
        <div className="text-xs text-slate-400">{desc}</div>
      </div>
    </Link>
  );
}

function Badge({ label, style }: { label: string; style: React.CSSProperties }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={style}>
      {label}
    </span>
  );
}

function NFTThumb({ tokenId, blindBoxUrl }: { tokenId: number; blindBoxUrl: string | null }) {
  const [err, setErr] = useState(false);
  if (err || !blindBoxUrl) {
    return <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-base" style={{ background: "#f4f6fb" }}>🐻</div>;
  }
  return (
    <img src={blindBoxUrl} alt={`#${tokenId}`} loading="lazy"
      onError={() => setErr(true)}
      className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
      style={{ background: "#f4f6fb", border: "1px solid #e5e7eb" }} />
  );
}

// ─── NFT Detail Modal ─────────────────────────────────────────────────────────

function NFTModal({ token, blockExplorer, waveName, onClose }: { token: DbToken; blockExplorer: string; waveName?: string; onClose: () => void }) {
  const [meta, setMeta] = useState<NFTMetadata | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setMetaLoading(true);
    setMeta(null);
    setImgError(false);
    if (token.is_revealed) {
      fetchTokenMetadata(token.token_id).then(m => { setMeta(m); setMetaLoading(false); });
    } else {
      setMetaLoading(false);
    }
  }, [token.token_id, token.is_revealed]);

  const imageUrl = meta ? ipfsToGateway(meta.image) : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,23,38,0.72)", backdropFilter: "blur(6px)" }}
      onClick={onClose}>
      <div className="relative flex bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-3xl max-h-[90vh]"
        style={{ border: "1px solid #e5e7eb" }}
        onClick={e => e.stopPropagation()}>
        <button onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors text-sm"
          style={{ background: "#f4f6fb", border: "1px solid #e5e7eb", color: "#6b7280" }}>✕</button>

        {/* Left — image */}
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
            <img src={imageUrl} alt={meta?.name ?? `NFT #${token.token_id}`}
              className="w-full aspect-square rounded-xl object-contain"
              style={{ background: "#e9edf7" }}
              onError={() => setImgError(true)} />
          ) : (
            <div className="w-full aspect-square rounded-xl flex flex-col items-center justify-center gap-2"
              style={{ background: "#e9edf7", color: "#9bafc5" }}>
              <span className="text-3xl">🐻</span>
              <span className="text-xs">{token.is_revealed ? "No image" : "Blind Box"}</span>
            </div>
          )}
          {token.mint_tx_hash && (
            <a href={`${blockExplorer}/tx/${token.mint_tx_hash}`} target="_blank" rel="noreferrer"
              className="w-full text-center text-xs font-semibold py-1.5 rounded-lg"
              style={{ background: "rgba(107,114,128,0.06)", color: "#6b7280", border: "1px solid #e5e7eb" }}>
              View Tx on Etherscan ↗
            </a>
          )}
        </div>

        {/* Right — details */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 min-w-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded" style={{ background: "#f4f6fb", color: "#24315f" }}>
                #{token.token_id}
              </span>
              <Badge label={mintTypeLabel(token.wave_number)} style={mintTypeBadgeStyle(token.wave_number)} />
              {token.is_revealed
                ? <Badge label="Revealed" style={{ background: "rgba(217,119,6,0.08)", color: "#d97706" }} />
                : <Badge label="Blind Box" style={{ background: "rgba(107,114,128,0.08)", color: "#6b7280" }} />}
              {token.rarity_tier && (
                <Badge label={token.rarity_tier} style={RARITY_STYLE[token.rarity_tier] ?? {}} />
              )}
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {metaLoading ? "Loading…" : meta?.name ?? `Bearth NFT #${token.token_id}`}
            </h2>
            {meta?.description && <p className="text-sm mt-1.5 leading-relaxed" style={{ color: "#6b7280" }}>{meta.description}</p>}
          </div>

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

          {!token.is_revealed && !metaLoading && (
            <div className="rounded-lg p-3 text-sm text-center" style={{ background: "#f4f6fb", color: "#9bafc5" }}>
              Traits will appear after reveal
            </div>
          )}

          <div style={{ borderTop: "1px solid #f3f4f6" }} />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#9bafc5" }}>Mint Details</p>
            <div className="space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="text-gray-500 flex-shrink-0">Owner</span>
                <button onClick={() => copyToClipboard(token.owner_address ?? "")}
                  className="font-mono text-xs flex items-center gap-1 group" style={{ color: "#41afeb" }}>
                  {shortAddr(token.owner_address)}
                  <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Wave</span>
                <span className="font-semibold text-gray-700">
                  {token.wave_number === 0 || token.wave_number === null
                    ? "Admin Reserve"
                    : waveName
                      ? `Wave ${token.wave_number} · ${waveName}`
                      : `Wave ${token.wave_number}`}
                </span>
              </div>
              {token.rarity_price_eth != null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Rarity Price</span>
                  <span className="font-semibold text-gray-700">{token.rarity_price_eth} ETH</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Minted At</span>
                <span className="text-gray-700">{fmtDate(token.minted_at)}</span>
              </div>
              {token.mint_tx_hash && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-gray-500 flex-shrink-0">Tx Hash</span>
                  <button onClick={() => copyToClipboard(token.mint_tx_hash ?? "")}
                    className="font-mono text-xs flex items-center gap-1 group text-right" style={{ color: "#41afeb" }}>
                    {token.mint_tx_hash.slice(0, 10)}…
                    <svg className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ActiveTab = "overview" | "minted";
type SortCol = "tokenId" | "owner" | "wave" | "rarity" | "date";

const BLOCK_EXPLORER = process.env.NEXT_PUBLIC_CONTRACT_NET === "mainnet"
  ? "https://etherscan.io"
  : "https://sepolia.etherscan.io";

export default function DashboardPage() {
  const [activeTab, setActiveTab]             = useState<ActiveTab>("overview");
  const [mintedTabActivated, setMintedTabActivated] = useState(false);

  function switchTab(tab: ActiveTab) {
    setActiveTab(tab);
    if (tab === "minted") setMintedTabActivated(true);
  }

  // ── Overview state ────────────────────────────────────────────────────────
  const [stats, setStats]   = useState<DbStats | null>(null);
  const [wlCount, setWlCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/nft-sell/collection/stats", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setStats(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }

    try {
      const res = await fetch("/api/whitelist", { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setWlCount(d.addresses?.length ?? null);
      }
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleSyncFromChain = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const res = await fetch("/api/nft-sell/waves/resync", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromBlock: 0 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Resync failed");
      setSyncMsg(`Synced ${d.synced} events from chain`);
      await fetchStats();
    } catch (e: unknown) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const [waves, setWaves] = useState<WaveMeta[]>([]);

  useEffect(() => {
    fetch("/api/nft-sell/waves", { credentials: "include" })
      .then(r => r.json())
      .then(d => setWaves((d.waves ?? []).map((w: { waveNum: number; name: string }) => ({ waveNum: w.waveNum, name: w.name }))))
      .catch(() => {});
  }, []);

  // ── Minted NFTs state ─────────────────────────────────────────────────────
  const [tokens, setTokens]         = useState<DbToken[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [nftLoading, setNftLoading] = useState(false);
  const [nftError, setNftError]     = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<DbToken | null>(null);

  // Filters / sort / pagination
  const [search, setSearch]           = useState("");
  const [waveFilter, setWaveFilter]   = useState("all");
  const [revealFilter, setRevealFilter] = useState("all");
  const [sortCol, setSortCol]         = useState<SortCol>("tokenId");
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("asc");
  const [page, setPage]               = useState(1);
  const PER_PAGE = 50;

  const loadTokens = useCallback(async () => {
    setNftLoading(true); setNftError(null);
    try {
      const res = await fetch(`/api/nft-sell/collection/tokens?limit=9999&offset=0`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      setTokens(d.tokens ?? []);
      setTotalTokens(d.total ?? 0);
    } catch (e: unknown) {
      setNftError(e instanceof Error ? e.message : "Failed to load tokens");
    } finally {
      setNftLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mintedTabActivated) loadTokens();
  }, [mintedTabActivated, loadTokens]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const tokenStats = useMemo(() => ({
    total:    tokens.length,
    wave1:    tokens.filter(t => t.wave_number === 1).length,
    paid:     tokens.filter(t => (t.wave_number ?? 0) > 1).length,
    admin:    tokens.filter(t => t.wave_number === 0 || t.wave_number === null).length,
    revealed: tokens.filter(t => t.is_revealed).length,
    legendary: tokens.filter(t => t.rarity_tier === "Legendary").length,
    epic:      tokens.filter(t => t.rarity_tier === "Epic").length,
    rare:      tokens.filter(t => t.rarity_tier === "Rare").length,
    common:    tokens.filter(t => t.rarity_tier === "Common").length,
  }), [tokens]);

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = [...tokens];
    const q = search.toLowerCase();
    if (q) list = list.filter(t =>
      String(t.token_id).includes(q) ||
      (t.owner_address?.toLowerCase().includes(q)) ||
      (t.mint_tx_hash?.toLowerCase().includes(q))
    );
    if (waveFilter !== "all") {
      const wn = parseInt(waveFilter);
      list = list.filter(t => (t.wave_number ?? 0) === wn);
    }
    if (revealFilter === "revealed") list = list.filter(t => t.is_revealed);
    if (revealFilter === "blind")    list = list.filter(t => !t.is_revealed);

    list.sort((a, b) => {
      let cmp = 0;
      if (sortCol === "tokenId") cmp = a.token_id - b.token_id;
      else if (sortCol === "owner") cmp = (a.owner_address ?? "").localeCompare(b.owner_address ?? "");
      else if (sortCol === "wave")  cmp = (a.wave_number ?? 0) - (b.wave_number ?? 0);
      else if (sortCol === "rarity") cmp = (a.rarity_tier ?? "").localeCompare(b.rarity_tier ?? "");
      else if (sortCol === "date")  cmp = (a.minted_at ?? "").localeCompare(b.minted_at ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [tokens, search, waveFilter, revealFilter, sortCol, sortDir]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(1);
  };

  const SortIcon = ({ col }: { col: SortCol }) =>
    sortCol === col ? <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span> : <span className="ml-0.5 opacity-20">↕</span>;

  const exportCSV = () => {
    const headers = ["Token ID", "Owner", "Wave", "Rarity Tier", "Rarity Price (ETH)", "Revealed", "Minted At", "Tx Hash"];
    const rows = filtered.map(t => [
      t.token_id,
      t.owner_address,
      t.wave_number ?? 0,
      t.rarity_tier ?? "",
      t.rarity_price_eth ?? "",
      t.is_revealed ? "Yes" : "No",
      t.minted_at ?? "",
      t.mint_tx_hash ?? "",
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `bearth-nft-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {selectedToken && (
        <NFTModal
          token={selectedToken}
          blockExplorer={BLOCK_EXPLORER}
          waveName={waves.find(w => w.waveNum === selectedToken.wave_number)?.name}
          onClose={() => setSelectedToken(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Sepolia Testnet · Data from DB (synced on-chain)</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "overview" && (
            <>
              <button onClick={fetchStats} disabled={loading}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
                <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <button onClick={handleSyncFromChain} disabled={syncing}
                className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50"
                style={{ background: syncing ? "#9bafc5" : "#24315f" }}
                title="Replay all on-chain events into DB">
                <svg className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                {syncing ? "Syncing…" : "Sync from Chain"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sync message */}
      {syncMsg && (
        <div className="px-4 py-2 rounded-xl text-sm" style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)", color: "#16a34a" }}>
          {syncMsg}
        </div>
      )}

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {(["overview", "minted"] as ActiveTab[]).map(tab => (
          <button key={tab} onClick={() => switchTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {tab === "overview" ? "Overview" : `Minted NFTs${totalTokens > 0 ? ` (${totalTokens})` : ""}`}
          </button>
        ))}
      </div>

      {/* ══════════════ OVERVIEW TAB ══════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <strong>Error:</strong> {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-24 animate-pulse">
                  <div className="h-3 bg-slate-100 rounded w-1/2 mb-3" /><div className="h-7 bg-slate-100 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : stats ? (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Current Phase</p>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${PHASE_COLORS[stats.phase ?? 0] ?? "bg-slate-100 text-slate-600"}`}>
                    {stats.phaseName ?? PHASE_LABELS[stats.phase ?? 0] ?? "Unknown"}
                  </span>
                </div>
                <StatCard
                  label="Total Minted"
                  value={`${stats.totalMinted} / ${stats.maxSupply}`}
                  sub={`${stats.mintProgress}% of supply · ${stats.remaining} remaining`}
                />
                <StatCard
                  label="Whitelist Mint (Wave 1)"
                  value={stats.whitelistMint.soldCount}
                  sub={`of ${stats.whitelistMint.quantity} allocated${stats.whitelistMint.closed ? " · Closed" : ""}`}
                />
                <StatCard
                  label="Whitelist Size"
                  value={wlCount !== null ? wlCount.toLocaleString() : "—"}
                  sub="Addresses in DB (Wave 1 free)"
                />
                <StatCard
                  label="Paid Mint (Waves 2–7)"
                  value={stats.paidMint.soldCount}
                  sub={`of ${stats.paidMint.quantity} allocated${stats.paidMint.priceEth ? ` · ${stats.paidMint.priceEth} ETH` : ""}`}
                />
                <StatCard
                  label="Reveal Status"
                  value={stats.isRevealed ? "Revealed" : `${stats.revealed} Waves`}
                  accent={stats.isRevealed || stats.revealed > 0 ? "text-emerald-700" : "text-slate-500"}
                  sub={stats.isRevealed ? "All NFTs revealed" : stats.revealed > 0 ? "Partial reveal" : "Blind box — awaiting reveal"}
                />
                <StatCard
                  label="SBT Mode"
                  value={stats.onChain?.sbt ? "Enabled" : "Disabled"}
                  accent={stats.onChain?.sbt ? "text-amber-700" : "text-slate-500"}
                  sub={stats.onChain?.sbt ? "Transfers locked" : "Transfers allowed"}
                />
                <StatCard
                  label="Purchase Limit"
                  value={stats.onChain?.purchaseLimitEnabled ? `Max ${stats.onChain.normalMaxPerWallet}/wallet` : "Unlimited"}
                  accent={stats.onChain?.purchaseLimitEnabled ? "text-slate-900" : "text-slate-500"}
                />
              </div>

              {/* Admin Revenue */}
              {stats.adminRevenue && stats.adminRevenue.totalSales > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#9bafc5" }}>Admin Sales Revenue</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Total ETH</p>
                      <p className="text-lg font-bold text-emerald-700">{Number(stats.adminRevenue.totalEth).toFixed(4)} ETH</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total Sales</p>
                      <p className="text-lg font-bold" style={{ color: "#24315f" }}>{stats.adminRevenue.totalSales}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Total NFTs Sold</p>
                      <p className="text-lg font-bold" style={{ color: "#24315f" }}>{stats.adminRevenue.totalQty}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick links */}
              <div>
                <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <QuickLink href="/nft/waves" label="Wave Management" desc="Schedule, pricing, reveal, whitelist" color="bg-blue-600" />
                  <QuickLink href="/nft/selling" label="Contract Operations" desc="Phase, royalty, SBT, membership, advanced" color="bg-slate-700" />
                  <QuickLink href="/nft/records" label="NFT Records" desc="Ownership, mint type, reveal status, sales" color="bg-violet-600" />
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ══════════════ MINTED NFTs TAB ══════════════ */}
      {activeTab === "minted" && (
        <div className="space-y-5">

          {/* Header */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <p className="text-sm" style={{ color: "#9bafc5" }}>
              {tokens.length} loaded · {totalTokens} minted in DB
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {tokens.length > 0 && (
                <button onClick={exportCSV}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg"
                  style={{ background: "#f4f6fb", border: "1px solid #e5e7eb", color: "#374151" }}>
                  Export CSV
                </button>
              )}
              <button onClick={loadTokens} disabled={nftLoading}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50"
                style={{ background: "#fff", border: "1px solid #e5e7eb", color: "#6b7280" }}>
                <svg className={`w-3.5 h-3.5 ${nftLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { label: "Total",     value: tokenStats.total,    color: "#24315f" },
              { label: "WL Free",   value: tokenStats.wave1,    color: "#2e9fd8" },
              { label: "Paid",      value: tokenStats.paid,     color: "#7c3aed" },
              { label: "Admin",     value: tokenStats.admin,    color: "#6b7280" },
              { label: "Revealed",  value: tokenStats.revealed, color: "#059669" },
              { label: "Legendary", value: tokenStats.legendary, color: "#d97706" },
              { label: "Epic",      value: tokenStats.epic,     color: "#7c3aed" },
              { label: "Rare",      value: tokenStats.rare,     color: "#3b82f6" },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                <p className="text-xs text-gray-400 mb-1 font-medium">{c.label}</p>
                <p className="text-xl font-bold" style={{ color: c.color }}>{c.value}</p>
              </div>
            ))}
          </div>

          {nftError && (
            <div className="p-4 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
              <strong>Error:</strong> {nftError}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Token ID, wallet, or tx hash…"
                className="pl-9 pr-3 py-2 rounded-lg text-sm outline-none w-64"
                style={{ border: "1px solid #e5e7eb" }} />
            </div>
            <select value={waveFilter} onChange={e => { setWaveFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: "1px solid #e5e7eb", color: "#374151" }}>
              <option value="all">All Waves</option>
              <option value="0">Admin Reserve</option>
              {waves.length > 0
                ? waves.map(w => (
                    <option key={w.waveNum} value={String(w.waveNum)}>
                      Wave {w.waveNum} · {w.name}
                    </option>
                  ))
                : [1,2,3,4,5,6,7].map(w => <option key={w} value={String(w)}>Wave {w}</option>)
              }
            </select>
            <select value={revealFilter} onChange={e => { setRevealFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: "1px solid #e5e7eb", color: "#374151" }}>
              <option value="all">All Status</option>
              <option value="revealed">Revealed</option>
              <option value="blind">Blind Box</option>
            </select>
            <span className="ml-auto text-xs" style={{ color: "#9bafc5" }}>
              {filtered.length} results · click row to preview
            </span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {nftLoading ? (
              <div className="p-12 text-center">
                <svg className="w-6 h-6 animate-spin mx-auto mb-3" fill="none" viewBox="0 0 24 24" style={{ color: "#41afeb" }}>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-sm text-gray-500">Loading from database…</p>
              </div>
            ) : paginated.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm">
                {tokens.length === 0 ? "No minted NFTs yet. Sync from chain to populate." : "No results match your filters."}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#f4f6fb", borderBottom: "1px solid #e5e7eb" }}>
                      <th className="px-3 py-3 w-14" />
                      {[
                        { label: "Token ID", col: "tokenId" as SortCol },
                        { label: "Owner",    col: "owner"   as SortCol },
                        { label: "Wave",     col: "wave"    as SortCol },
                        { label: "Mint Type", col: null },
                        { label: "Rarity",   col: "rarity"  as SortCol },
                        { label: "Status",   col: null },
                        { label: "Minted At", col: "date"   as SortCol },
                        { label: "Tx Hash",  col: null },
                      ].map(({ label, col }) => (
                        <th key={label}
                          onClick={col ? () => toggleSort(col) : undefined}
                          className={`text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide select-none whitespace-nowrap ${col ? "cursor-pointer" : ""}`}
                          style={{ color: "#9bafc5" }}>
                          {label}{col && <SortIcon col={col} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((t, idx) => {
                      const isEven = idx % 2 === 0;
                      return (
                        <tr key={t.token_id}
                          onClick={() => setSelectedToken(t)}
                          className="cursor-pointer"
                          style={{ background: isEven ? "#fff" : "#fafbff", borderBottom: "1px solid #f3f4f6" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#eff8fe")}
                          onMouseLeave={e => (e.currentTarget.style.background = isEven ? "#fff" : "#fafbff")}>
                          <td className="px-3 py-2"><NFTThumb tokenId={t.token_id} blindBoxUrl={stats?.blindBoxImageUrl ?? (stats?.blindBoxUri ? ipfsToGateway(stats.blindBoxUri) : null)} /></td>
                          <td className="px-4 py-3 font-mono font-bold" style={{ color: "#24315f" }}>#{t.token_id}</td>
                          <td className="px-4 py-3">
                            <button onClick={e => { e.stopPropagation(); copyToClipboard(t.owner_address ?? ""); }}
                              className="font-mono text-xs flex items-center gap-1 group" style={{ color: "#41afeb" }}>
                              {shortAddr(t.owner_address)}
                            </button>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-600">
                            {t.wave_number === 0 || t.wave_number === null ? "Reserve" : `W${t.wave_number}`}
                          </td>
                          <td className="px-4 py-3">
                            <Badge label={mintTypeLabel(t.wave_number)} style={mintTypeBadgeStyle(t.wave_number)} />
                          </td>
                          <td className="px-4 py-3">
                            {t.rarity_tier
                              ? <Badge label={t.rarity_tier} style={RARITY_STYLE[t.rarity_tier] ?? {}} />
                              : <span className="text-xs text-gray-300">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            {t.is_revealed
                              ? <Badge label="Revealed" style={{ background: "rgba(217,119,6,0.08)", color: "#d97706" }} />
                              : <Badge label="Blind Box" style={{ background: "rgba(107,114,128,0.08)", color: "#6b7280" }} />}
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "#9bafc5" }}>
                            {fmtDate(t.minted_at)}
                          </td>
                          <td className="px-4 py-3">
                            {t.mint_tx_hash ? (
                              <a href={`${BLOCK_EXPLORER}/tx/${t.mint_tx_hash}`} target="_blank" rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="font-mono text-xs flex items-center gap-1" style={{ color: "#41afeb" }}>
                                {t.mint_tx_hash.slice(0, 8)}…
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            ) : <span className="text-gray-300 text-xs">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && !nftLoading && (
              <div className="flex items-center justify-between px-4 py-3 text-sm" style={{ borderTop: "1px solid #e5e7eb", color: "#9bafc5" }}>
                <span>Page {page} of {totalPages} · {filtered.length} records</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(1)} disabled={page === 1}
                    className="px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-40" style={{ border: "1px solid #e5e7eb" }}>«</button>
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg disabled:opacity-40" style={{ border: "1px solid #e5e7eb" }}>← Prev</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg disabled:opacity-40" style={{ border: "1px solid #e5e7eb" }}>Next →</button>
                  <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                    className="px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-40" style={{ border: "1px solid #e5e7eb" }}>»</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
