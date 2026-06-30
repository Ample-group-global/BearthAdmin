"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchMintedEvents, type MintedEvent } from "@/lib/nft-events";
import { DEFAULT_CHAIN } from "@/lib/chains";

type MintFilter = "all" | "wl" | "public" | "paid";
type RevealFilter = "all" | "revealed" | "blind";
type ViewMode = "table" | "grid";

const MINT_LABEL: Record<string, string> = {
  "WL Free": "Free Whitelist Mint",
  "Public Free": "Free Public Mint",
  "Paid": "Paid Mint",
};

const MINT_COLOR: Record<string, string> = {
  "WL Free": "bg-blue-50 text-blue-700 border border-blue-200",
  "Public Free": "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "Paid": "bg-amber-50 text-amber-700 border border-amber-200",
};

const PER_PAGE = 24;

function MintBadge({ mintType }: { mintType: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${MINT_COLOR[mintType] ?? "bg-slate-100 text-slate-600"}`}>
      {MINT_LABEL[mintType] ?? mintType}
    </span>
  );
}

function RevealBadge({ revealed }: { revealed: boolean }) {
  return revealed ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      ✓ Revealed
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
      Blind Box
    </span>
  );
}

function NFTCard({ ev }: { ev: MintedEvent }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md hover:border-emerald-200 transition-all">
      {/* Art placeholder */}
      <div className={`h-40 flex items-center justify-center ${ev.isRevealed ? "bg-gradient-to-br from-emerald-50 to-teal-100" : "bg-gradient-to-br from-slate-100 to-slate-200"}`}>
        {ev.isRevealed ? (
          <svg className="w-12 h-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ) : (
          <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
          </svg>
        )}
      </div>

      <div className="p-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold text-slate-900">NFT #{ev.tokenId}</span>
          <RevealBadge revealed={ev.isRevealed} />
        </div>

        <MintBadge mintType={ev.mintType} />

        <div className="text-xs text-slate-500 space-y-1 pt-1">
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="font-mono truncate" title={ev.owner}>
              {ev.owner.slice(0, 8)}…{ev.owner.slice(-6)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{ev.dateStr}</span>
          </div>
          {ev.mintType === "Paid" && (
            <div className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold text-amber-700">{ev.pricePaid}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OpsNFTGalleryPage() {
  const [events, setEvents] = useState<MintedEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("grid");

  const [search, setSearch] = useState("");
  const [mintFilter, setMintFilter] = useState<MintFilter>("all");
  const [revealFilter, setRevealFilter] = useState<RevealFilter>("all");
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchMintedEvents(DEFAULT_CHAIN.chainId);
      setEvents(result.events);
    } catch (e: any) {
      setError("Could not load NFT data. Please try refreshing.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = events.filter((e) => {
    if (search) {
      const q = search.toLowerCase();
      if (!e.owner.toLowerCase().includes(q) && !String(e.tokenId).includes(q)) return false;
    }
    if (mintFilter === "wl" && e.mintType !== "WL Free") return false;
    if (mintFilter === "public" && e.mintType !== "Public Free") return false;
    if (mintFilter === "paid" && e.mintType !== "Paid") return false;
    if (revealFilter === "revealed" && !e.isRevealed) return false;
    if (revealFilter === "blind" && e.isRevealed) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const counts = {
    wl: events.filter((e) => e.mintType === "WL Free").length,
    public: events.filter((e) => e.mintType === "Public Free").length,
    paid: events.filter((e) => e.mintType === "Paid").length,
    revealed: events.filter((e) => e.isRevealed).length,
    blind: events.filter((e) => !e.isRevealed).length,
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">NFT Gallery</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {events.length > 0 ? `${events.length} NFTs minted` : "Bearth NFT collection"}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50">
          <svg className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}

      {/* Summary strips */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Free Whitelist Mint", value: counts.wl, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
          { label: "Free Public Mint", value: counts.public, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
          { label: "Paid Mint", value: counts.paid, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
          { label: "Revealed", value: counts.revealed, color: "text-emerald-700", bg: "bg-white border-slate-200" },
          { label: "Blind Box", value: counts.blind, color: "text-slate-500", bg: "bg-white border-slate-200" },
        ].map((c) => (
          <div key={c.label} className={`rounded-xl border p-3.5 shadow-sm ${c.bg}`}>
            <p className="text-xs text-slate-500 mb-1 leading-tight">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Filters + view toggle */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search NFT # or wallet…"
            className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-52"
          />
        </div>

        <select
          value={mintFilter}
          onChange={(e) => { setMintFilter(e.target.value as MintFilter); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">All Mint Types</option>
          <option value="wl">Free Whitelist Mint</option>
          <option value="public">Free Public Mint</option>
          <option value="paid">Paid Mint</option>
        </select>

        <select
          value={revealFilter}
          onChange={(e) => { setRevealFilter(e.target.value as RevealFilter); setPage(1); }}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">All Statuses</option>
          <option value="revealed">Revealed Only</option>
          <option value="blind">Blind Box Only</option>
        </select>

        <span className="text-xs text-slate-400">{filtered.length} NFTs</span>

        <div className="ml-auto flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
          <button
            onClick={() => setView("grid")}
            className={`p-1.5 rounded-md transition-colors ${view === "grid" ? "bg-white shadow-sm text-slate-700" : "text-slate-400 hover:text-slate-600"}`}
            title="Grid view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setView("table")}
            className={`p-1.5 rounded-md transition-colors ${view === "table" ? "bg-white shadow-sm text-slate-700" : "text-slate-400 hover:text-slate-600"}`}
            title="Table view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
          <svg className="w-6 h-6 animate-spin text-emerald-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-slate-500">Loading NFT data from blockchain…</p>
          <p className="text-xs text-slate-400 mt-1">This may take a moment</p>
        </div>
      ) : paginated.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-sm text-slate-400">
          {events.length === 0 ? "No NFTs have been minted yet." : "No NFTs match your filters."}
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-4">
          {paginated.map((ev) => <NFTCard key={ev.tokenId} ev={ev} />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">NFT</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Owner</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Mint Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((ev) => (
                  <tr key={ev.tokenId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 font-bold text-slate-900">#{ev.tokenId}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600" title={ev.owner}>
                      {ev.owner.slice(0, 10)}…{ev.owner.slice(-8)}
                    </td>
                    <td className="px-5 py-3">
                      <MintBadge mintType={ev.mintType} />
                    </td>
                    <td className="px-5 py-3">
                      <RevealBadge revealed={ev.isRevealed} />
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">{ev.dateStr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Page {page} of {totalPages} · {filtered.length} NFTs</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 text-xs">«</button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 text-xs">← Prev</button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 text-xs">Next →</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 text-xs">»</button>
          </div>
        </div>
      )}
    </div>
  );
}
