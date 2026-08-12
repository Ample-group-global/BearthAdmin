"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useInterval } from "@/lib/useInterval";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollectionStats {
  totalMinted: number;
  maxSupply: number;
  revealed: number;
  treasuryWalletCount: number;
  phaseName: string | null;
}

interface WaveRow {
  waveNumber: number;
  name: string;
  quantity: number | null;
  defaultPriceEth: number | null;
  soldCount: number;
  waveRevealed: boolean;
  waveClosed: boolean;
  status: string;
  treasuryPendingCount: number;
  reservedCount?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function waveStatusMeta(w: WaveRow): { label: string; color: string; bg: string } {
  if (w.waveRevealed) return { label: "Revealed", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" };
  if (w.waveClosed) return { label: "Closed", color: "#16a34a", bg: "rgba(22,163,74,0.08)" };
  switch (w.status) {
    case "active": return { label: "Active", color: "#41afeb", bg: "rgba(65,175,235,0.1)" };
    case "upcoming": return { label: "Upcoming", color: "#d97706", bg: "rgba(217,119,6,0.08)" };
    default: return { label: w.status || "—", color: "#9bafc5", bg: "#f8fafc" };
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-6 pt-5 pb-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
      <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>{title}</p>
    </div>
  );
}

function SnapshotRow({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-4 py-3" style={{ borderBottom: "1px solid #f8fafc" }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-sm w-52 flex-shrink-0" style={{ color: "#4b5563" }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
      <span className="text-sm font-bold w-16 text-right tabular-nums" style={{ color: "#24315f" }}>
        {count.toLocaleString()}
      </span>
      <span className="text-xs w-12 text-right tabular-nums" style={{ color: "#9bafc5" }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-6 space-y-4 animate-pulse" style={{ border: "1px solid #e5e7eb" }}>
        <div className="h-3 w-40 bg-slate-100 rounded" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-slate-100" />
            <div className="h-3 w-48 bg-slate-100 rounded" />
            <div className="flex-1 h-1.5 bg-slate-100 rounded" />
            <div className="h-3 w-14 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow-sm animate-pulse" style={{ border: "1px solid #e5e7eb", height: 220 }} />
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [waves, setWaves] = useState<WaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [watchAlert, setWatchAlert] = useState<string | null>(null);
  const prevMintedRef = useRef<number | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [sRes, wRes] = await Promise.all([
        fetch("/api/nft-sell/collection/stats", { credentials: "include" }),
        fetch("/api/nft-sell/waves", { credentials: "include" }),
      ]);
      if (!sRes.ok) throw new Error(
        sRes.status === 401 ? "Session expired — please sign in again." :
          sRes.status === 503 ? "Service temporarily unavailable." :
            `Could not load dashboard (${sRes.status})`
      );
      const s = await sRes.json();
      const w = wRes.ok ? await wRes.json() : { waves: [] };
      setStats(s);
      setWaves((w.waves ?? []) as WaveRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const silentPoll = useCallback(async () => {
    try {
      const res = await fetch("/api/nft-sell/collection/stats", { credentials: "include" });
      if (!res.ok) return;
      const d = await res.json();
      setLastUpdated(new Date());
      if (prevMintedRef.current !== null && d.totalMinted !== prevMintedRef.current) {
        setWatchAlert(`Mints updated: ${prevMintedRef.current} → ${d.totalMinted}`);
        fetchAll();
      }
      prevMintedRef.current = d.totalMinted ?? prevMintedRef.current;
      setStats(prev => prev ? { ...prev, ...d } : d);
    } catch { /* silent */ }
  }, [fetchAll]);

  useInterval(silentPoll, 30_000);

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
      await fetchAll();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, [fetchAll]);

  // ── Derived counts (all from already-fetched data — no extra requests) ──────
  const max = stats?.maxSupply ?? 9999;
  const minted = stats?.totalMinted ?? 0;
  const revealed = stats?.revealed ?? 0;
  const inTreasury = stats?.treasuryWalletCount ?? 0;
  const reserved = waves.reduce((s, w) => s + (w.reservedCount ?? 0) + (w.treasuryPendingCount ?? 0), 0);
  const blindBox = Math.max(0, minted - revealed - inTreasury);
  const preMint = Math.max(0, max - minted - reserved);

  return (
    <div className="ba-page space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9bafc5" }}>Sepolia Testnet · Live from chain</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50"
            style={{ background: "white", border: "1px solid #e5e7eb", color: "#6b7280" }}>
            <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button onClick={handleSync} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg text-white disabled:opacity-50"
            style={{ background: syncing ? "#9bafc5" : "#24315f" }}
            title="Replay on-chain events into DB">
            <svg className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            {syncing ? "Syncing…" : "Sync from Chain"}
          </button>
        </div>
      </div>

      {/* ── Status bar ── */}
      {(watchAlert || syncMsg || lastUpdated) && (
        <div className="space-y-1.5">
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
        <div className="p-4 rounded-xl text-sm flex items-start justify-between gap-4"
          style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          <div>
            <p className="font-semibold mb-0.5">Could not load dashboard</p>
            <p className="opacity-90">{error}</p>
          </div>
          <button onClick={fetchAll} className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg"
            style={{ background: "#fee2e2", color: "#dc2626" }}>
            Try again
          </button>
        </div>
      )}

      {loading ? <Skeleton /> : stats ? (
        <>
          {/* ── Collection Snapshot ── */}
          <div className="bg-white rounded-xl shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <div className="flex items-center justify-between px-6 pt-5 pb-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
              <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Collection Snapshot</p>
              <div>
                <span className="text-lg font-bold tabular-nums" style={{ color: "#24315f" }}>{max.toLocaleString()}</span>
                <span className="text-xs ml-1.5" style={{ color: "#9bafc5" }}>total supply</span>
              </div>
            </div>
            <div className="px-6 py-1">
              <SnapshotRow label="Pre-mint (Available)" count={preMint} total={max} color="#94a3b8" />
              <SnapshotRow label="Blind Box (Minted)" count={blindBox} total={max} color="#41afeb" />
              <SnapshotRow label="Revealed" count={revealed} total={max} color="#7c3aed" />
              <SnapshotRow label="Reserved" count={reserved} total={max} color="#d97706" />
              <SnapshotRow label="In Treasury Wallet" count={inTreasury} total={max} color="#16a34a" />
            </div>
          </div>

          {/* ── Wave Breakdown ── */}
          <div className="bg-white rounded-xl shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <SectionHeader title="Wave Breakdown" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                    {["W#", "Wave Name", "Phase", "Allocated", "Minted", "Mint Progress", "Revealed", "Status"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: "#9bafc5", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {waves.map((w, i) => {
                    const isFree = !w.defaultPriceEth || Number(w.defaultPriceEth) === 0;
                    const qty = w.quantity ?? 0;
                    const sold = w.soldCount ?? 0;
                    const pct = qty > 0 ? Math.round((sold / qty) * 100) : 0;
                    const sm = waveStatusMeta(w);
                    return (
                      <tr key={w.waveNumber}
                        className="hover:bg-slate-50 transition-colors"
                        style={{ borderBottom: i < waves.length - 1 ? "1px solid #f8fafc" : undefined }}>

                        {/* W# */}
                        <td className="px-5 py-3.5 font-bold tabular-nums" style={{ color: "#24315f" }}>
                          {w.waveNumber}
                        </td>

                        {/* Name */}
                        <td className="px-5 py-3.5 font-medium" style={{ color: "#374151" }}>
                          {w.name}
                        </td>

                        {/* Phase — Free or Paid based on wave price */}
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold"
                            style={isFree
                              ? { background: "rgba(22,163,74,0.1)", color: "#16a34a" }
                              : { background: "rgba(65,175,235,0.1)", color: "#2563eb" }}>
                            {isFree ? "Free" : `Paid · ${w.defaultPriceEth} ETH`}
                          </span>
                        </td>

                        {/* Allocated */}
                        <td className="px-5 py-3.5 tabular-nums" style={{ color: "#374151" }}>
                          {qty.toLocaleString()}
                        </td>

                        {/* Minted */}
                        <td className="px-5 py-3.5 tabular-nums" style={{ color: "#374151" }}>
                          {sold.toLocaleString()}
                        </td>

                        {/* Progress bar + % */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, background: pct === 100 ? "#16a34a" : "#41afeb" }} />
                            </div>
                            <span className="text-xs tabular-nums w-8 text-right" style={{ color: "#9bafc5" }}>
                              {pct}%
                            </span>
                          </div>
                        </td>

                        {/* Revealed */}
                        <td className="px-5 py-3.5 text-center">
                          {w.waveRevealed
                            ? <span className="text-xs font-bold" style={{ color: "#7c3aed" }}>✓</span>
                            : <span style={{ color: "#d1d5db" }}>—</span>}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-3.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold"
                            style={{ background: sm.bg, color: sm.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: sm.color }} />
                            {sm.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {waves.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-sm" style={{ color: "#9bafc5" }}>
                        No waves configured yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Quick Links ── */}
          <div className="flex flex-wrap gap-2 pb-2">
            {[
              { href: "/nft/waves", label: "Wave Management" },
              { href: "/nft/contractoperation", label: "Contract Operations" },
              { href: "/nft/nftlist", label: "NFT Lists" },
            ].map(l => (
              <Link key={l.href} href={l.href}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors hover:shadow-sm"
                style={{ background: "white", border: "1px solid #e5e7eb", color: "#24315f" }}>
                {l.label}
                <svg className="w-3.5 h-3.5 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
