"use client";

import { useEffect, useState, useCallback } from "react";
import { ethers } from "ethers";
import { DEFAULT_CHAIN } from "@/lib/chains";
import BearthNFTArtifact from "@/lib/BearthNFT.abi.json";

const PHASE_NAME: Record<number, string> = {
  0: "Not Started",
  1: "Whitelist Mint",
  2: "Public Mint",
  3: "Paid Mint",
};

const PHASE_DESC: Record<number, string> = {
  0: "The project has not launched yet.",
  1: "Whitelisted wallets can claim a free NFT.",
  2: "Anyone can claim a free NFT.",
  3: "NFTs are available for purchase.",
};

const PHASE_COLOR: Record<number, string> = {
  0: "bg-slate-100 text-slate-600 border-slate-200",
  1: "bg-blue-50 text-blue-700 border-blue-200",
  2: "bg-emerald-50 text-emerald-700 border-emerald-200",
  3: "bg-amber-50 text-amber-700 border-amber-200",
};

interface OpsStats {
  phase: number;
  totalMinted: number;
  maxSupply: number;
  stage1Minted: number;
  revealCount: number;
  sbt: boolean;
  price: string;
  wlStart: number;
  wlEnd: number;
  ethBalance: string;
}

function StatBlock({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  note?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 text-emerald-600">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
        <p className="text-xl font-bold text-slate-900 truncate">{value}</p>
        {note && <p className="text-xs text-slate-400 mt-0.5">{note}</p>}
      </div>
    </div>
  );
}

export default function OpsOverviewPage() {
  const [stats, setStats] = useState<OpsStats | null>(null);
  const [wlCount, setWlCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new ethers.JsonRpcProvider(DEFAULT_CHAIN.rpcUrl);
      const contract = new ethers.Contract(DEFAULT_CHAIN.contractAddress, BearthNFTArtifact.abi, provider);

      const [data, wlStart, wlEnd, balance] = await Promise.all([
        contract.getData(),
        contract.wlStart(),
        contract.wlEnd(),
        provider.getBalance(DEFAULT_CHAIN.contractAddress),
      ]);

      setStats({
        phase: Number(data[0]),
        totalMinted: Number(data[1]),
        maxSupply: Number(data[2]),
        stage1Minted: Number(data[3]),
        sbt: Boolean(data[4]),
        revealCount: Number(data[5]),
        price: ethers.formatEther(data[8]),
        wlStart: Number(wlStart),
        wlEnd: Number(wlEnd),
        ethBalance: parseFloat(ethers.formatEther(balance)).toFixed(4),
      });
    } catch (e: any) {
      setError("Could not load project data. Please try refreshing.");
    } finally {
      setLoading(false);
    }

    try {
      const res = await fetch("/api/whitelist", { credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setWlCount(d.addresses?.length ?? null);
      }
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const now = Math.floor(Date.now() / 1000);
  const mintProgress = stats ? Math.round((stats.totalMinted / stats.maxSupply) * 100) : 0;
  const stage1Progress = stats ? Math.round((stats.stage1Minted / 303) * 100) : 0;
  const wlWindowActive = stats ? stats.phase === 1 && now >= stats.wlStart && now <= stats.wlEnd : false;
  const wlWindowEnded = stats ? now > stats.wlEnd && stats.wlEnd > 0 : false;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Project Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">Bearth NFT · Live status</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 h-24 animate-pulse">
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-3" />
              <div className="h-6 bg-slate-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <>
          {/* Phase banner */}
          <div className={`rounded-2xl border p-5 ${PHASE_COLOR[stats.phase] ?? "bg-slate-50 text-slate-700 border-slate-200"}`}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider opacity-70 mb-1">Current Phase</p>
                <p className="text-2xl font-bold">{PHASE_NAME[stats.phase] ?? `Phase ${stats.phase}`}</p>
                <p className="text-sm opacity-80 mt-1">{PHASE_DESC[stats.phase]}</p>
              </div>
              {wlWindowActive && (
                <div className="flex items-center gap-2 bg-white/70 rounded-xl px-4 py-2 text-sm font-semibold text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                  Minting is live right now
                </div>
              )}
              {stats.phase === 3 && (
                <div className="bg-white/70 rounded-xl px-4 py-2 text-sm font-semibold text-amber-700">
                  Price: {stats.price} ETH per NFT
                </div>
              )}
            </div>

            {/* WL window times */}
            {stats.phase === 1 && stats.wlStart > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm bg-white/50 rounded-xl p-3">
                <div>
                  <span className="opacity-60 block text-xs mb-0.5">Window Opens</span>
                  <span className="font-semibold">{new Date(stats.wlStart * 1000).toLocaleString()}</span>
                </div>
                <div>
                  <span className="opacity-60 block text-xs mb-0.5">Window Closes</span>
                  <span className="font-semibold">
                    {wlWindowEnded
                      ? <span className="text-red-600">Ended</span>
                      : new Date(stats.wlEnd * 1000).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Minting progress */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Minting Progress</h2>

            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Total NFTs Minted</span>
                <span className="font-semibold text-slate-800">{stats.totalMinted.toLocaleString()} / {stats.maxSupply.toLocaleString()}</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${mintProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{mintProgress}% of total supply minted</p>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                <span>Free Mint Phase (WL + Public)</span>
                <span className="font-semibold text-slate-800">{stats.stage1Minted.toLocaleString()} / 303</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all"
                  style={{ width: `${Math.min(stage1Progress, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">{stage1Progress}% of free mint allocation used</p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatBlock
              label="Whitelisted Wallets"
              value={wlCount !== null ? wlCount.toLocaleString() : "—"}
              note="Addresses approved for WL mint"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              }
            />
            <StatBlock
              label="Revenue Collected"
              value={`${stats.ethBalance} ETH`}
              note="ETH held by the contract"
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
            <StatBlock
              label="NFT Artwork"
              value={stats.revealCount > 0 ? "Revealed" : "Blind Box"}
              note={stats.revealCount > 0 ? "NFT artwork is now visible" : "Artwork not yet revealed"}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              }
            />
            <StatBlock
              label="Transfer Lock"
              value={stats.sbt ? "Locked (SBT)" : "Transfers Allowed"}
              note={stats.sbt ? "NFTs cannot be transferred or sold" : "NFTs can be transferred freely"}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stats.sbt
                    ? "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    : "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"
                  } />
                </svg>
              }
            />
            <StatBlock
              label="Paid Mint Price"
              value={stats.phase === 3 ? `${stats.price} ETH` : "—"}
              note={stats.phase === 3 ? "Current price per NFT" : "Paid phase not active"}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
              }
            />
            <StatBlock
              label="Remaining Supply"
              value={(stats.maxSupply - stats.totalMinted).toLocaleString()}
              note={`Out of ${stats.maxSupply.toLocaleString()} total`}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              }
            />
          </div>

          {/* Help note */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">
            <p className="font-medium text-slate-700 mb-1">Need to make changes?</p>
            <p>To change phases, reveal artwork, set pricing, or withdraw funds — contact your technical admin. Operations staff have view access only for contract settings.</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
