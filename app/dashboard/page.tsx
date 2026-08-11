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
  blindBoxImageUrl?: string | null;
  whitelistMint: { soldCount: number; quantity: number; closed: boolean };
  paidMint: { soldCount: number; quantity: number; priceEth: number | null; closed: boolean };
  revealed: number;
  isRevealed: boolean;
  adminRevenue: { totalEth: number; totalSales: number; totalQty: number } | null;
  onChain: { purchaseLimitEnabled: boolean; normalMaxPerWallet: number; sbt: boolean } | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_LABELS = ["Whitelist Mint", "Paid Mint", "Revealed"];
const PHASE_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
];

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
      await fetchStats();
    } catch (e: unknown) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [fetchStats]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="ba-page space-y-6">

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
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold mb-0.5">Could not load dashboard data</p>
            <p className="text-red-600 opacity-90">{error}</p>
          </div>
          <button
            onClick={fetchStats}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-100 hover:bg-red-200 text-red-700 transition-colors"
          >
            Try again
          </button>
        </div>
      )}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(7)].map((_, i) => (
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

            {/* Total Minted */}
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

            {/* Wave 1 Whitelist */}
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
              <QuickLink href="/nft/waves"   label="Wave Management"     desc="Schedule, pricing, reveal, whitelist"        color="bg-blue-600" />
              <QuickLink href="/nft/contractoperation" label="Contract Operations"  desc="Phase, royalty, SBT, membership, advanced"   color="bg-slate-700" />
              <QuickLink href="/nft/nftlist" label="NFT Lists"             desc="Ownership, mint type, reveal status, sales"  color="bg-violet-600" />
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
