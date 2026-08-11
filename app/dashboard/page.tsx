"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
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
  whitelistMint: { soldCount: number; quantity: number; closed: boolean };
  paidMint: { soldCount: number; quantity: number; priceEth: number | null; closed: boolean };
  revealed: number;
  isRevealed: boolean;
  adminRevenue: { totalEth: number; totalSales: number; totalQty: number } | null;
  onChain: { purchaseLimitEnabled: boolean; normalMaxPerWallet: number; sbt: boolean } | null;
}

// ─── Design tokens ───────────────────────────────────────────────────────────

const PHASE_COLORS = [
  { pill: "bg-blue-100 text-blue-700",   dot: "#3b82f6" },
  { pill: "bg-amber-100 text-amber-700", dot: "#f59e0b" },
  { pill: "bg-emerald-100 text-green-700", dot: "#10b981" },
];

// ─── Shared primitives ───────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "#9bafc5" }}>
      {children}
    </p>
  );
}

function MetricCard({ label, value, sub, accent, progress }: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
  progress?: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-2xl font-bold ${accent ?? "text-slate-900"}`}>{value}</p>
      {progress !== undefined && (
        <div className="mt-2.5 h-1.5 rounded-full overflow-hidden bg-slate-100">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, progress)}%`, background: "#41afeb" }} />
        </div>
      )}
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Section components ───────────────────────────────────────────────────────

function MintOverview({ stats, wlCount }: { stats: DbStats; wlCount: number | null }) {
  const phaseIdx = stats.phase ?? 0;
  const pc = PHASE_COLORS[phaseIdx] ?? PHASE_COLORS[0];
  return (
    <section>
      <SectionLabel>Collection Overview</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Phase */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Current Phase</p>
          <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-sm font-semibold ${pc.pill}`}>
            <span className="w-2 h-2 rounded-full" style={{ background: pc.dot }} />
            {stats.phaseName ?? ["Whitelist Mint", "Paid Mint", "Revealed"][phaseIdx] ?? "Unknown"}
          </span>
        </div>

        {/* Total Minted */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Minted</p>
          <p className="text-2xl font-bold text-slate-900">
            {stats.totalMinted.toLocaleString()}
            <span className="text-sm font-medium text-slate-400"> / {stats.maxSupply.toLocaleString()}</span>
          </p>
          <div className="mt-2.5 h-1.5 rounded-full overflow-hidden bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, stats.mintProgress)}%`, background: "#41afeb" }} />
          </div>
          <p className="text-xs text-slate-400 mt-1">{stats.mintProgress}% · {stats.remaining.toLocaleString()} remaining</p>
        </div>

        <MetricCard
          label="Reveal Status"
          value={stats.isRevealed ? "Revealed" : stats.revealed > 0 ? `${stats.revealed} Waves` : "Blind Box"}
          accent={stats.isRevealed || stats.revealed > 0 ? "text-emerald-700" : "text-slate-500"}
          sub={stats.isRevealed ? "All NFTs revealed" : stats.revealed > 0 ? "Partial reveal" : "Awaiting reveal"} />

        <MetricCard
          label="Remaining Supply"
          value={stats.remaining.toLocaleString()}
          accent="text-slate-900"
          sub={`of ${stats.maxSupply.toLocaleString()} max`} />
      </div>
    </section>
  );
}

function WaveStats({ stats, wlCount }: { stats: DbStats; wlCount: number | null }) {
  return (
    <section>
      <SectionLabel>Wave Progress</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Wave 1 Whitelist */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Wave 1 — Whitelist</p>
          <p className="text-2xl font-bold text-slate-900">{stats.whitelistMint.soldCount.toLocaleString()}</p>
          <div className="mt-2.5 h-1.5 rounded-full overflow-hidden bg-slate-100">
            <div className="h-full rounded-full" style={{
              width: `${stats.whitelistMint.quantity > 0 ? Math.min(100, (stats.whitelistMint.soldCount / stats.whitelistMint.quantity) * 100) : 0}%`,
              background: "#41afeb"
            }} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            minted of {stats.whitelistMint.quantity.toLocaleString()}{stats.whitelistMint.closed ? " · Closed" : ""}
          </p>
          {wlCount !== null && (
            <p className="text-xs mt-1.5 font-semibold" style={{ color: "#41afeb" }}>
              {wlCount.toLocaleString()} addresses in whitelist
            </p>
          )}
        </div>

        {/* Waves 2–7 Paid Mint */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Waves 2–7 — Paid Mint</p>
          <p className="text-2xl font-bold text-slate-900">{stats.paidMint.soldCount.toLocaleString()}</p>
          <div className="mt-2.5 h-1.5 rounded-full overflow-hidden bg-slate-100">
            <div className="h-full rounded-full" style={{
              width: `${stats.paidMint.quantity > 0 ? Math.min(100, (stats.paidMint.soldCount / stats.paidMint.quantity) * 100) : 0}%`,
              background: "#d97706"
            }} />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            of {stats.paidMint.quantity.toLocaleString()} allocated
            {stats.paidMint.priceEth ? ` · ${stats.paidMint.priceEth} ETH` : ""}
          </p>
        </div>

        {/* Placeholder for third column — keeps grid from jumping */}
        <MetricCard
          label="Revealed Waves"
          value={stats.revealed > 0 ? `${stats.revealed} / 7` : "None"}
          accent={stats.revealed > 0 ? "text-emerald-700" : "text-slate-400"}
          sub={stats.isRevealed ? "All waves revealed" : "Pending reveal"} />
      </div>
    </section>
  );
}

function AccessControls({ stats }: { stats: DbStats }) {
  return (
    <section>
      <SectionLabel>Access Controls</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">SBT Mode</p>
          <p className={`text-xl font-bold ${stats.onChain?.sbt ? "text-amber-700" : "text-slate-500"}`}>
            {stats.onChain?.sbt ? "Enabled" : "Disabled"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {stats.onChain?.sbt ? "Transfers locked — soul bound" : "Transfers allowed — tradeable on OpenSea"}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Purchase Limit</p>
          <p className="text-xl font-bold text-slate-900">
            {stats.onChain?.purchaseLimitEnabled
              ? `Max ${stats.onChain.normalMaxPerWallet} / wallet`
              : "Unlimited"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {stats.onChain?.purchaseLimitEnabled ? "Per-wallet cap enforced on-chain" : "No per-wallet cap"}
          </p>
        </div>
      </div>
    </section>
  );
}

function AdminRevenue({ revenue }: { revenue: NonNullable<DbStats["adminRevenue"]> }) {
  return (
    <section>
      <SectionLabel>Admin Sales Revenue</SectionLabel>
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <p className="text-xs text-slate-500 mb-1">Total ETH Collected</p>
            <p className="text-xl font-bold text-emerald-700">{Number(revenue.totalEth).toFixed(4)} ETH</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Total Sales</p>
            <p className="text-xl font-bold" style={{ color: "#24315f" }}>{revenue.totalSales.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">NFTs Sold</p>
            <p className="text-xl font-bold" style={{ color: "#24315f" }}>{revenue.totalQty.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickActions() {
  const links = [
    { href: "/nft/waves",             label: "Wave Management",    desc: "Schedule, pricing, reveal, whitelist",         bg: "#3b82f6" },
    { href: "/nft/contractoperation", label: "Contract Operations", desc: "Phase, royalty, SBT, membership, advanced",   bg: "#374151" },
    { href: "/nft/nftlist",           label: "NFT Lists",          desc: "Ownership, mint type, reveal status, sales",   bg: "#7c3aed" },
  ];
  return (
    <section>
      <SectionLabel>Quick Actions</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {links.map(l => (
          <Link key={l.href} href={l.href}
            className="group flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all shadow-sm">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: l.bg }}>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{l.label}</div>
              <div className="text-xs text-slate-400">{l.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {[4, 3, 2].map((cols, gi) => (
        <div key={gi}>
          <div className="h-3 w-32 bg-slate-100 rounded mb-3 animate-pulse" />
          <div className={`grid grid-cols-2 lg:grid-cols-${cols} gap-4`}>
            {[...Array(cols)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-24 animate-pulse">
                <div className="h-2.5 bg-slate-100 rounded w-1/2 mb-3" />
                <div className="h-7 bg-slate-100 rounded w-3/4" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats,       setStats]       = useState<DbStats | null>(null);
  const [wlCount,     setWlCount]     = useState<number | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [syncing,     setSyncing]     = useState(false);
  const [syncMsg,     setSyncMsg]     = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [watchAlert,  setWatchAlert]  = useState<string | null>(null);
  const prevMintedRef = useRef<number | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [statsRes, wlRes] = await Promise.all([
        fetch("/api/nft-sell/collection/stats", { credentials: "include" }),
        fetch("/api/whitelist",                 { credentials: "include" }),
      ]);
      if (!statsRes.ok) {
        const errData = await statsRes.json().catch(() => null);
        throw new Error(
          errData?.error ??
          (statsRes.status === 503 ? "Service temporarily unavailable — please try again in a moment." :
           statsRes.status === 401 ? "Session expired — please sign in again." :
           `Unable to load dashboard data (${statsRes.status}).`)
        );
      }
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

  // Silent 30s poll
  const silentPoll = useCallback(async () => {
    try {
      const res = await fetch("/api/nft-sell/collection/stats", { credentials: "include" });
      if (!res.ok) return;
      const d = await res.json();
      setLastUpdated(new Date());
      if (prevMintedRef.current !== null && d.totalMinted !== prevMintedRef.current) {
        setWatchAlert(`Minted count updated: ${prevMintedRef.current} → ${d.totalMinted}`);
        fetchStats();
      }
      prevMintedRef.current = d.totalMinted ?? prevMintedRef.current;
      setStats(prev => prev ? { ...prev, ...d } : d);
    } catch { /* silent */ }
  }, [fetchStats]);

  useInterval(silentPoll, 30_000);

  // Sync from chain
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
      await fetchStats();
    } catch (e: unknown) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [fetchStats]);

  return (
    <div className="ba-page space-y-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Sepolia Testnet · Data synced from on-chain</p>
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

      {/* ── Status bar ── */}
      {(watchAlert || syncMsg || lastUpdated) && (
        <div className="space-y-2">
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
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold mb-0.5">Could not load dashboard data</p>
            <p className="text-red-600 opacity-90">{error}</p>
          </div>
          <button onClick={fetchStats}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors">
            Try again
          </button>
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <LoadingSkeleton />
      ) : stats ? (
        <>
          <MintOverview stats={stats} wlCount={wlCount} />
          <WaveStats    stats={stats} wlCount={wlCount} />
          <AccessControls stats={stats} />
          {stats.adminRevenue && stats.adminRevenue.totalSales > 0 && (
            <AdminRevenue revenue={stats.adminRevenue} />
          )}
          <QuickActions />
        </>
      ) : null}

    </div>
  );
}
