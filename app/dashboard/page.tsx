"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { ipfsToGateway } from "@/lib/ipfs";
import { useInterval } from "@/lib/useInterval";

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
  image_ipfs_hash: string | null;
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
  Legendary: { background: "rgba(217,119,6,0.1)",   color: "#d97706" },
  Epic:      { background: "rgba(124,58,237,0.1)",  color: "#7c3aed" },
  Rare:      { background: "rgba(59,130,246,0.1)",  color: "#3b82f6" },
  Common:    { background: "rgba(107,114,128,0.1)", color: "#6b7280" },
};

type SortCol = "tokenId" | "owner" | "wave" | "rarity" | "date";

const BLOCK_EXPLORER =
  process.env.NEXT_PUBLIC_CONTRACT_NET === "mainnet"
    ? "https://etherscan.io"
    : "https://sepolia.etherscan.io";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mintTypeLabel(waveNum: number | null): string {
  if (waveNum === null || waveNum === 0) return "Admin Reserve";
  if (waveNum === 1) return "WL Free";
  return "Paid Mint";
}

function mintTypeBadgeStyle(waveNum: number | null): React.CSSProperties {
  if (waveNum === null || waveNum === 0) return { background: "rgba(36,49,95,0.1)",   color: "#24315f" };
  if (waveNum === 1)                     return { background: "rgba(65,175,235,0.1)", color: "#2e9fd8" };
  return                                        { background: "rgba(124,58,237,0.1)", color: "#7c3aed" };
}

function shortAddr(addr: string | null): string {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtDate(dt: string | null | undefined): string {
  if (!dt) return "—";
  return new Date(dt).toLocaleDateString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: {
  label: string; value: React.ReactNode; sub?: string; accent?: string;
}) {
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

function NFTThumb({ tokenId, isRevealed, imageIpfsHash, blindBoxUrl }: {
  tokenId: number;
  isRevealed?: boolean;
  imageIpfsHash?: string | null;
  blindBoxUrl: string | null;
}) {
  const [err, setErr]     = useState(false);
  const [bbErr, setBbErr] = useState(false);

  if (isRevealed && imageIpfsHash && !err) {
    return (
      <img src={ipfsToGateway(`ipfs://${imageIpfsHash}`)} alt={`#${tokenId}`} loading="lazy"
        onError={() => setErr(true)}
        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
        style={{ background: "#f4f6fb", border: "1px solid #e5e7eb" }} />
    );
  }
  if (blindBoxUrl && !bbErr) {
    return (
      <img src={blindBoxUrl} alt={`#${tokenId}`} loading="lazy"
        onError={() => setBbErr(true)}
        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
        style={{ background: "#f4f6fb", border: "1px solid #e5e7eb" }} />
    );
  }
  return (
    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
      style={{ background: "#f4f6fb" }}>🐻</div>
  );
}

// ─── NFT Detail Modal ─────────────────────────────────────────────────────────

function NFTModal({ token, blockExplorer, waveName, blindBoxImageUrl, onClose }: {
  token: DbToken;
  blockExplorer: string;
  waveName?: string;
  blindBoxImageUrl: string | null;
  onClose: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);

  // Use DB image_ipfs_hash for revealed NFTs — correct source of truth, no hardcoded CID
  const imageUrl = token.is_revealed && token.image_ipfs_hash && !imgErr
    ? ipfsToGateway(`ipfs://${token.image_ipfs_hash}`)
    : null;

  const waveLabel = waveName
    ? `Wave ${token.wave_number} · ${waveName}`
    : token.wave_number != null && token.wave_number > 0
      ? `Wave ${token.wave_number}`
      : "Admin Reserve";

  const fields: { label: string; value: string; mono?: boolean; href?: string }[] = [
    { label: "Owner",        value: token.owner_address ?? "—", mono: true },
    { label: "Wave",         value: waveLabel },
    { label: "Rarity Tier",  value: token.rarity_tier ?? "—" },
    { label: "Rarity Price", value: token.rarity_price_eth != null ? `${token.rarity_price_eth} ETH` : "—" },
    { label: "Minted At",    value: fmtDate(token.minted_at) },
    ...(token.mint_tx_hash ? [{
      label: "Tx Hash",
      value: token.mint_tx_hash,
      mono: true,
      href: `${blockExplorer}/tx/${token.mint_tx_hash}`,
    }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(20,23,38,0.72)", backdropFilter: "blur(6px)" }}
      onClick={onClose}>
      <div className="nft-modal-wrap"
        onClick={e => e.stopPropagation()}>

        <button onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm"
          style={{ background: "#f4f6fb", border: "1px solid #e5e7eb", color: "#6b7280" }}>✕</button>

        {/* Left — image */}
        <div className="nft-modal-image">
          {imageUrl ? (
            <img src={imageUrl} alt={`Bearth NFT #${token.token_id}`}
              className="w-full aspect-square rounded-xl object-contain"
              style={{ background: "#e9edf7" }}
              onError={() => setImgErr(true)} />
          ) : !token.is_revealed && blindBoxImageUrl ? (
            <img src={blindBoxImageUrl} alt="Blind Box"
              className="w-full aspect-square rounded-xl object-contain"
              style={{ background: "#e9edf7" }} />
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
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded"
                style={{ background: "#f4f6fb", color: "#24315f" }}>
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
              {token.is_revealed ? `Bearth NFT #${token.token_id}` : "Bearth Blind Box"}
            </h2>
          </div>

          <div className="grid gap-3">
            {fields.map(f => (
              <div key={f.label} className="flex gap-3 items-start">
                <span className="text-xs font-semibold uppercase tracking-wide w-28 flex-shrink-0 pt-0.5"
                  style={{ color: "#9bafc5" }}>{f.label}</span>
                {f.href ? (
                  <a href={f.href} target="_blank" rel="noreferrer"
                    className={`text-sm break-all ${f.mono ? "font-mono" : ""}`}
                    style={{ color: "#41afeb" }}>{f.value}</a>
                ) : (
                  <span className={`text-sm text-gray-800 break-all ${f.mono ? "font-mono" : ""}`}
                    onClick={f.mono ? () => navigator.clipboard.writeText(f.value).catch(() => {}) : undefined}
                    style={f.mono ? { cursor: "copy" } : {}}>
                    {f.value}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {

  // ── Stats ─────────────────────────────────────────────────────────────────
  const [stats, setStats]     = useState<DbStats | null>(null);
  const [wlCount, setWlCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [statsRes, wlRes] = await Promise.all([
        fetch("/api/nft-sell/collection/stats", { credentials: "include" }),
        fetch("/api/whitelist", { credentials: "include" }),
      ]);
      if (!statsRes.ok) throw new Error(`HTTP ${statsRes.status}`);
      setStats(await statsRes.json());
      if (wlRes.ok) {
        const d = await wlRes.json();
        setWlCount(d.addresses?.length ?? null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // ── Silent 30s poll ───────────────────────────────────────────────────────
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const prevMintedRef = useRef<number | null>(null);
  const [watchAlert, setWatchAlert]   = useState<string | null>(null);

  const silentPoll = useCallback(async () => {
    try {
      const res = await fetch("/api/nft-sell/collection/stats", { credentials: "include" });
      if (!res.ok) return;
      const d = await res.json();
      setLastUpdated(new Date());
      if (prevMintedRef.current !== null && d.totalMinted !== prevMintedRef.current) {
        setWatchAlert(`Minted count changed: ${prevMintedRef.current} → ${d.totalMinted}. Refreshing…`);
        fetchStats();
      }
      prevMintedRef.current = d.totalMinted ?? prevMintedRef.current;
      setStats(prev => prev ? { ...prev, ...d } : d);
    } catch { /* silent */ }
  }, [fetchStats]);

  useInterval(silentPoll, 30_000);

  // ── Wave names ────────────────────────────────────────────────────────────
  const [waves, setWaves] = useState<WaveMeta[]>([]);
  useEffect(() => {
    fetch("/api/nft-sell/waves", { credentials: "include" })
      .then(r => r.json())
      .then(d => setWaves((d.waves ?? []).map((w: { waveNum: number; name: string }) => ({ waveNum: w.waveNum, name: w.name }))))
      .catch(() => {});
  }, []);

  // ── Tokens ────────────────────────────────────────────────────────────────
  const [tokens, setTokens]         = useState<DbToken[]>([]);
  const [totalTokens, setTotalTokens] = useState(0);
  const [nftLoading, setNftLoading] = useState(false);
  const [nftError, setNftError]     = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<DbToken | null>(null);

  const loadTokens = useCallback(async () => {
    setNftLoading(true); setNftError(null);
    try {
      const res = await fetch("/api/nft-sell/collection/tokens?limit=9999&offset=0", { credentials: "include" });
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

  useEffect(() => { loadTokens(); }, [loadTokens]);

  // ── Sync from chain ───────────────────────────────────────────────────────
  const handleSync = useCallback(async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const res = await fetch("/api/nft-sell/waves/resync", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromBlock: 0 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Resync failed");
      const note = d.skippedChunks > 0 ? ` · ${d.skippedChunks} chunk(s) skipped` : "";
      setSyncMsg(`Synced ${d.synced} event${d.synced !== 1 ? "s" : ""} (${(d.scannedBlocks ?? 0).toLocaleString()} blocks${note})`);
      await Promise.all([fetchStats(), loadTokens()]);
    } catch (e: unknown) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [fetchStats, loadTokens]);

  // ── Filters / sort / pagination ───────────────────────────────────────────
  const [search, setSearch]             = useState("");
  const [waveFilter, setWaveFilter]     = useState("all");
  const [revealFilter, setRevealFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");
  const [sortCol, setSortCol]           = useState<SortCol>("tokenId");
  const [sortDir, setSortDir]           = useState<"asc" | "desc">("asc");
  const [page, setPage]                 = useState(1);
  const PER_PAGE = 50;

  const hasActiveFilter = waveFilter !== "all" || revealFilter !== "all" || rarityFilter !== "all" || search !== "";

  const clearFilters = useCallback(() => {
    setWaveFilter("all"); setRevealFilter("all"); setRarityFilter("all"); setSearch(""); setPage(1);
  }, []);

  const tokenStats = useMemo(() => ({
    total:     tokens.length,
    wave1:     tokens.filter(t => t.wave_number === 1).length,
    paid:      tokens.filter(t => (t.wave_number ?? 0) > 1).length,
    admin:     tokens.filter(t => t.wave_number === 0 || t.wave_number === null).length,
    revealed:  tokens.filter(t => t.is_revealed).length,
    legendary: tokens.filter(t => t.rarity_tier === "Legendary").length,
    epic:      tokens.filter(t => t.rarity_tier === "Epic").length,
    rare:      tokens.filter(t => t.rarity_tier === "Rare").length,
    common:    tokens.filter(t => t.rarity_tier === "Common").length,
  }), [tokens]);

  const filtered = useMemo(() => {
    let list = [...tokens];
    const q = search.toLowerCase();
    if (q) list = list.filter(t =>
      String(t.token_id).includes(q) ||
      (t.owner_address?.toLowerCase().includes(q)) ||
      (t.mint_tx_hash?.toLowerCase().includes(q))
    );
    if (waveFilter === "paid") {
      list = list.filter(t => (t.wave_number ?? 0) > 1);
    } else if (waveFilter !== "all") {
      list = list.filter(t => (t.wave_number ?? 0) === parseInt(waveFilter));
    }
    if (revealFilter === "revealed") list = list.filter(t => t.is_revealed);
    if (revealFilter === "blind")    list = list.filter(t => !t.is_revealed);
    if (rarityFilter !== "all")      list = list.filter(t => t.rarity_tier === rarityFilter);
    list.sort((a, b) => {
      let cmp = 0;
      if (sortCol === "tokenId") cmp = a.token_id - b.token_id;
      else if (sortCol === "owner")  cmp = (a.owner_address ?? "").localeCompare(b.owner_address ?? "");
      else if (sortCol === "wave")   cmp = (a.wave_number ?? 0) - (b.wave_number ?? 0);
      else if (sortCol === "rarity") cmp = (a.rarity_tier ?? "").localeCompare(b.rarity_tier ?? "");
      else if (sortCol === "date")   cmp = (a.minted_at ?? "").localeCompare(b.minted_at ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [tokens, search, waveFilter, revealFilter, rarityFilter, sortCol, sortDir]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated  = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(1);
  };

  const exportCSV = () => {
    const headers = ["Token ID", "Owner", "Wave", "Rarity Tier", "Rarity Price (ETH)", "Revealed", "Minted At", "Tx Hash"];
    const rows = filtered.map(t => [
      t.token_id, t.owner_address, t.wave_number ?? 0,
      t.rarity_tier ?? "", t.rarity_price_eth ?? "",
      t.is_revealed ? "Yes" : "No", t.minted_at ?? "", t.mint_tx_hash ?? "",
    ].join(","));
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `bearth-nft-${Date.now()}.csv`,
    });
    a.click(); URL.revokeObjectURL(a.href);
  };

  const SortIcon = ({ col }: { col: SortCol }) =>
    sortCol === col
      ? <span className="ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>
      : <span className="ml-0.5 opacity-20">↕</span>;

  // Derived once — passed to every row and the modal
  const blindBoxUrl = stats?.blindBoxImageUrl ?? (stats?.blindBoxUri ? ipfsToGateway(stats.blindBoxUri) : null);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="ba-page space-y-6">

      {selectedToken && (
        <NFTModal
          token={selectedToken}
          blockExplorer={BLOCK_EXPLORER}
          waveName={waves.find(w => w.waveNum === selectedToken.wave_number)?.name}
          blindBoxImageUrl={blindBoxUrl}
          onClose={() => setSelectedToken(null)}
        />
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Sepolia Testnet · Data from DB (synced on-chain)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchStats} disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50"
            style={{ background: syncing ? "#9bafc5" : "#24315f" }}
            title="Replay all on-chain events into DB">
            <svg className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            {syncing ? "Syncing…" : "Sync from Chain"}
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {watchAlert && (
        <div className="flex items-center justify-between px-4 py-2 rounded-xl text-sm"
          style={{ background: "rgba(65,175,235,0.08)", border: "1px solid rgba(65,175,235,0.25)", color: "#2e9fd8" }}>
          <span>⟳ {watchAlert}</span>
          <button onClick={() => setWatchAlert(null)} className="ml-4 text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}
      {syncMsg && (
        <div className="px-4 py-2 rounded-xl text-sm"
          style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.2)", color: "#16a34a" }}>
          {syncMsg}
        </div>
      )}
      {lastUpdated && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#9bafc5" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          Live · last checked {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {/* ── Stats ── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-24 animate-pulse">
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
              <div className="h-7 bg-slate-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Current Phase */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Current Phase</p>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${PHASE_COLORS[stats.phase ?? 0] ?? "bg-slate-100 text-slate-600"}`}>
                {stats.phaseName ?? PHASE_LABELS[stats.phase ?? 0] ?? "Unknown"}
              </span>
            </div>

            {/* Total Minted — with progress bar */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Total Minted</p>
              <p className="text-2xl font-bold text-slate-900">
                {stats.totalMinted.toLocaleString()}
                <span className="text-sm font-medium text-slate-400"> / {stats.maxSupply.toLocaleString()}</span>
              </p>
              <div className="mt-2.5 h-1.5 rounded-full overflow-hidden bg-slate-100">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, stats.mintProgress)}%`, background: "#41afeb" }} />
              </div>
              <p className="text-xs text-slate-400 mt-1">{stats.mintProgress}% · {stats.remaining.toLocaleString()} remaining</p>
            </div>

            {/* Wave 1 Whitelist — merged */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Wave 1 Whitelist</p>
              <p className="text-2xl font-bold text-slate-900">{stats.whitelistMint.soldCount.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                minted of {stats.whitelistMint.quantity.toLocaleString()}{stats.whitelistMint.closed ? " · Closed" : ""}
              </p>
              {wlCount !== null && (
                <p className="text-xs mt-1.5 font-semibold" style={{ color: "#41afeb" }}>
                  {wlCount.toLocaleString()} addresses in whitelist
                </p>
              )}
            </div>

            <StatCard label="Paid Mint (Waves 2–7)" value={stats.paidMint.soldCount.toLocaleString()}
              sub={`of ${stats.paidMint.quantity.toLocaleString()} allocated${stats.paidMint.priceEth ? ` · ${stats.paidMint.priceEth} ETH` : ""}`} />
            <StatCard label="Reveal Status"
              value={stats.isRevealed ? "Revealed" : `${stats.revealed} Waves`}
              accent={stats.isRevealed || stats.revealed > 0 ? "text-emerald-700" : "text-slate-500"}
              sub={stats.isRevealed ? "All NFTs revealed" : stats.revealed > 0 ? "Partial reveal" : "Blind box"} />
            <StatCard label="SBT Mode"
              value={stats.onChain?.sbt ? "Enabled" : "Disabled"}
              accent={stats.onChain?.sbt ? "text-amber-700" : "text-slate-500"}
              sub={stats.onChain?.sbt ? "Transfers locked" : "Transfers allowed"} />
            <StatCard label="Purchase Limit"
              value={stats.onChain?.purchaseLimitEnabled ? `Max ${stats.onChain.normalMaxPerWallet}/wallet` : "Unlimited"}
              accent={stats.onChain?.purchaseLimitEnabled ? "text-slate-900" : "text-slate-500"} />
          </div>

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
                  <p className="text-xs text-gray-500">NFTs Sold</p>
                  <p className="text-lg font-bold" style={{ color: "#24315f" }}>{stats.adminRevenue.totalQty}</p>
                </div>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <QuickLink href="/nft/waves"   label="Wave Management"    desc="Schedule, pricing, reveal, whitelist"        color="bg-blue-600" />
              <QuickLink href="/nft/selling" label="Contract Operations" desc="Phase, royalty, SBT, membership, advanced" color="bg-slate-700" />
              <QuickLink href="/nft/records" label="NFT Records"         desc="Ownership, mint type, reveal status, sales" color="bg-violet-600" />
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Divider ── */}
      <div style={{ borderTop: "1px solid #e5e7eb" }} />

      {/* ── Minted NFTs ── */}
      <div className="space-y-5">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Minted NFTs{totalTokens > 0 ? ` (${totalTokens.toLocaleString()})` : ""}
            </h2>
            {tokenStats.total > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {([
                  { label: "WL Free",   value: tokenStats.wave1,     color: "#2e9fd8", filter: () => { setWaveFilter("1");    setRevealFilter("all"); setRarityFilter("all"); setSearch(""); setPage(1); } },
                  { label: "Paid",      value: tokenStats.paid,      color: "#7c3aed", filter: () => { setWaveFilter("paid"); setRevealFilter("all"); setRarityFilter("all"); setSearch(""); setPage(1); } },
                  { label: "Admin",     value: tokenStats.admin,     color: "#6b7280", filter: () => { setWaveFilter("0");    setRevealFilter("all"); setRarityFilter("all"); setSearch(""); setPage(1); } },
                  { label: "Legendary", value: tokenStats.legendary, color: "#d97706", filter: () => { setRarityFilter("Legendary"); setWaveFilter("all"); setRevealFilter("all"); setSearch(""); setPage(1); } },
                  { label: "Epic",      value: tokenStats.epic,      color: "#7c3aed", filter: () => { setRarityFilter("Epic");  setWaveFilter("all"); setRevealFilter("all"); setSearch(""); setPage(1); } },
                  { label: "Rare",      value: tokenStats.rare,      color: "#3b82f6", filter: () => { setRarityFilter("Rare");  setWaveFilter("all"); setRevealFilter("all"); setSearch(""); setPage(1); } },
                  { label: "Common",    value: tokenStats.common,    color: "#9bafc5", filter: () => { setRarityFilter("Common"); setWaveFilter("all"); setRevealFilter("all"); setSearch(""); setPage(1); } },
                ] as const).map(c => (
                  <button key={c.label} onClick={c.filter}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-all"
                    style={{ background: `${c.color}12`, color: c.color, border: `1px solid ${c.color}30` }}>
                    {c.label} <span className="font-bold">{c.value}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
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

        {nftError && (
          <div className="p-4 rounded-xl text-sm"
            style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
            <strong>Error:</strong> {nftError}
          </div>
        )}

        {/* Filters */}
        <div className="ba-filters">
          <div className="ba-search">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Token ID, wallet, or tx hash…"
              className="pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
              style={{ border: "1px solid #e5e7eb" }} />
          </div>
          <select value={waveFilter} onChange={e => { setWaveFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: "1px solid #e5e7eb", color: "#374151" }}>
            <option value="all">All Waves</option>
            <option value="paid">Paid (Waves 2–7)</option>
            <option value="0">Admin Reserve</option>
            {waves.length > 0
              ? waves.map(w => <option key={w.waveNum} value={String(w.waveNum)}>Wave {w.waveNum} · {w.name}</option>)
              : [1,2,3,4,5,6,7].map(w => <option key={w} value={String(w)}>Wave {w}</option>)}
          </select>
          <select value={revealFilter} onChange={e => { setRevealFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: "1px solid #e5e7eb", color: "#374151" }}>
            <option value="all">All Status</option>
            <option value="revealed">Revealed</option>
            <option value="blind">Blind Box</option>
          </select>
          <select value={rarityFilter} onChange={e => { setRarityFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm outline-none"
            style={{ border: "1px solid #e5e7eb", color: "#374151" }}>
            <option value="all">All Rarities</option>
            <option value="Legendary">Legendary</option>
            <option value="Epic">Epic</option>
            <option value="Rare">Rare</option>
            <option value="Common">Common</option>
          </select>
          {hasActiveFilter && (
            <button onClick={clearFilters}
              className="px-3 py-2 rounded-lg text-sm font-medium"
              style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)", color: "#dc2626" }}>
              ✕ Clear
            </button>
          )}
          <span className="ml-auto text-xs" style={{ color: "#9bafc5" }}>
            {filtered.length} results · click row to preview
          </span>
        </div>

        {/* Table */}
        <div className="ba-table-wrap bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {nftLoading ? (
            <div className="p-12 text-center">
              <svg className="w-6 h-6 animate-spin mx-auto mb-3" fill="none" viewBox="0 0 24 24" style={{ color: "#41afeb" }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-500">Loading from database…</p>
            </div>
          ) : paginated.length === 0 ? (
            <div className="p-12 text-center text-sm">
              {tokens.length === 0 && stats && stats.totalMinted > 0 ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ background: "rgba(251,191,36,0.12)" }}>
                    <svg className="w-6 h-6" fill="none" stroke="#d97706" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">{stats.totalMinted} NFT{stats.totalMinted !== 1 ? "s" : ""} minted on-chain but not synced</p>
                    <p className="text-xs text-slate-400 mt-1">Run Sync from Chain to load records</p>
                  </div>
                  <button onClick={handleSync} disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: "#41afeb" }}>
                    {syncing ? "Syncing…" : "Sync from Chain"}
                  </button>
                  {syncMsg && (
                    <p className="text-xs mt-1" style={{ color: syncMsg.includes("failed") ? "#dc2626" : "#16a34a" }}>
                      {syncMsg}
                    </p>
                  )}
                </div>
              ) : tokens.length === 0 ? (
                <span className="text-gray-400">No minted NFTs yet.</span>
              ) : (
                <span className="text-gray-400">No results match your filters.</span>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#f4f6fb", borderBottom: "1px solid #e5e7eb" }}>
                    <th className="px-3 py-3 w-14" />
                    {([
                      { label: "Token ID",  col: "tokenId" as SortCol },
                      { label: "Owner",     col: "owner"   as SortCol },
                      { label: "Wave",      col: "wave"    as SortCol },
                      { label: "Mint Type", col: null },
                      { label: "Rarity",    col: "rarity"  as SortCol },
                      { label: "Status",    col: null },
                      { label: "Minted At", col: "date"    as SortCol },
                      { label: "Tx Hash",   col: null },
                    ] as { label: string; col: SortCol | null }[]).map(({ label, col }) => (
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
                  {paginated.map((t, idx) => (
                    <tr key={t.token_id}
                      onClick={() => setSelectedToken(t)}
                      className="cursor-pointer"
                      style={{ background: idx % 2 === 0 ? "#fff" : "#fafbff", borderBottom: "1px solid #f3f4f6" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#eff8fe")}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafbff")}>
                      <td className="px-3 py-2">
                        <NFTThumb tokenId={t.token_id} isRevealed={t.is_revealed} imageIpfsHash={t.image_ipfs_hash} blindBoxUrl={blindBoxUrl} />
                      </td>
                      <td className="px-4 py-3 font-mono font-bold" style={{ color: "#24315f" }}>#{t.token_id}</td>
                      <td className="px-4 py-3">
                        <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(t.owner_address ?? "").catch(() => {}); }}
                          className="font-mono text-xs" style={{ color: "#41afeb" }}>
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
                          ? <Badge label="Revealed"  style={{ background: "rgba(217,119,6,0.08)",  color: "#d97706" }} />
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
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && !nftLoading && (
            <div className="flex items-center justify-between px-4 py-3 text-sm"
              style={{ borderTop: "1px solid #e5e7eb", color: "#9bafc5" }}>
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

    </div>
  );
}
