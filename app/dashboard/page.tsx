"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import Link from "next/link";
import { useChain } from "@/lib/ChainContext";
import BearthNFTArtifact from "@/lib/BearthNFT.abi.json";

const PHASE_LABELS = ["Not Started", "Whitelist Mint", "Public Mint", "Paid Mint"];
const PHASE_COLORS = [
  "bg-slate-100 text-slate-600",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
];

interface ContractStats {
  phase: number;
  totalMinted: number;
  maxSupply: number;
  stage1Minted: number;
  sbt: boolean;
  revealCount: number;
  limit1: number;
  limit2: number;
  price: string;
  root: string;
  wlStart: number;
  wlEnd: number;
  ethBalance: string;
}

function StatCard({
  label, value, sub, accent,
}: {
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

export default function TechDashboardPage() {
  const { wallets } = useWallets();
  const { activeChain } = useChain();
  const [stats, setStats] = useState<ContractStats | null>(null);
  const [wlCount, setWlCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new ethers.JsonRpcProvider(activeChain.rpcUrl);
      const contract = new ethers.Contract(activeChain.contractAddress, BearthNFTArtifact.abi, provider);

      const [phase, sbt, data, root, wlStart, wlEnd, balance] = await Promise.all([
        contract.phase(),
        contract.sbt(),
        contract.getData(),
        contract.root(),
        contract.wlStart(),
        contract.wlEnd(),
        provider.getBalance(activeChain.contractAddress),
      ]);

      setStats({
        phase: Number(phase),
        totalMinted: Number(data[1]),
        maxSupply: Number(data[2]),
        stage1Minted: Number(data[3]),
        sbt: Boolean(data[4]),
        revealCount: Number(data[5]),
        limit1: Number(data[6]),
        limit2: Number(data[7]),
        price: ethers.formatEther(data[8]),
        root: String(root),
        wlStart: Number(wlStart),
        wlEnd: Number(wlEnd),
        ethBalance: parseFloat(ethers.formatEther(balance)).toFixed(4),
      });
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Failed to read contract");
    } finally {
      setLoading(false);
    }

    // Fetch whitelist count from backend
    try {
      const res = await fetch("/api/whitelist" as string, { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setWlCount(d.addresses?.length ?? null);
      }
    } catch {}
  }, [activeChain]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const now = Math.floor(Date.now() / 1000);
  const wlActive = stats
    ? stats.phase === 1 && now >= stats.wlStart && now <= stats.wlEnd
    : false;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeChain.name} · {activeChain.contractAddress.slice(0, 6)}...{activeChain.contractAddress.slice(-4)}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-3">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span><strong>Contract read error:</strong> {error}. Connect wallet or check RPC.</span>
        </div>
      )}

      {/* Stats grid */}
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
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">Current Phase</p>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${PHASE_COLORS[stats.phase] ?? "bg-slate-100 text-slate-600"}`}>
                {PHASE_LABELS[stats.phase] ?? `Phase ${stats.phase}`}
              </span>
              {wlActive && <p className="text-xs text-emerald-600 mt-1.5 font-medium">● Live now</p>}
            </div>

            <StatCard
              label="Total Minted"
              value={`${stats.totalMinted} / ${stats.maxSupply}`}
              sub={`${Math.round((stats.totalMinted / stats.maxSupply) * 100)}% of supply`}
              accent="text-slate-900"
            />
            <StatCard
              label="Stage 1 Minted"
              value={`${stats.stage1Minted} / 303`}
              sub="WL + Public phase"
            />
            <StatCard
              label="Contract Balance"
              value={`${stats.ethBalance} ETH`}
              accent="text-emerald-700"
            />
            <StatCard
              label="Whitelist Size"
              value={wlCount !== null ? wlCount.toLocaleString() : "—"}
              sub="Addresses in DB"
            />
            <StatCard
              label="Merkle Root"
              value={stats.root !== "0x0000000000000000000000000000000000000000000000000000000000000000"
                ? `${stats.root.slice(0, 10)}...`
                : "Not set"}
              sub={stats.root !== "0x0000000000000000000000000000000000000000000000000000000000000000" ? "On-chain root" : "No root deployed"}
            />
            <StatCard
              label="Reveal Status"
              value={stats.revealCount > 0 ? "Revealed" : "Blind Box"}
              accent={stats.revealCount > 0 ? "text-emerald-700" : "text-slate-500"}
              sub={stats.revealCount > 0 ? `${stats.revealCount} reveals` : "Awaiting reveal"}
            />
            <StatCard
              label="SBT Mode"
              value={stats.sbt ? "Enabled" : "Disabled"}
              accent={stats.sbt ? "text-amber-700" : "text-slate-500"}
              sub={stats.sbt ? "Transfers locked" : "Transfers allowed"}
            />
          </div>

          {/* WL Window */}
          {stats.phase === 1 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">Whitelist Mint Window</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-blue-700 font-medium">Opens: </span>
                  <span className="text-blue-800">{new Date(stats.wlStart * 1000).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-blue-700 font-medium">Closes: </span>
                  <span className="text-blue-800">{new Date(stats.wlEnd * 1000).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickLink href="/dashboard/whitelist" label="Manage Whitelist" desc="Add, remove, export addresses" color="bg-blue-600" />
          <QuickLink href="/dashboard/contract" label="Contract Operations" desc="Phase, reveal, withdraw, emergency" color="bg-slate-700" />
          <QuickLink href="/dashboard/nfts" label="NFT Explorer" desc="Ownership, mint type, reveal status" color="bg-violet-600" />
        </div>
      </div>
    </div>
  );
}
