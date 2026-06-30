"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchWhitelistEntries, addWhitelistEntry, type WhitelistEntry } from "@/lib/whitelist";
import { ethers } from "ethers";

const PER_PAGE = 20;

export default function OpsWhitelistPage() {
  const [entries, setEntries] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Add form state
  const [addAddress, setAddAddress] = useState("");
  const [addName, setAddName] = useState("");
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [addressError, setAddressError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchWhitelistEntries();
    setEntries(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return e.address.toLowerCase().includes(q) || (e.name?.toLowerCase().includes(q) ?? false);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function validateAddress(val: string) {
    if (!val) { setAddressError(""); return; }
    try {
      ethers.getAddress(val);
      setAddressError("");
    } catch {
      setAddressError("Not a valid Ethereum wallet address.");
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddResult(null);
    if (addressError || !addAddress.trim()) return;
    let normalized: string;
    try {
      normalized = ethers.getAddress(addAddress.trim());
    } catch {
      setAddressError("Not a valid Ethereum wallet address.");
      return;
    }
    setAdding(true);
    const ok = await addWhitelistEntry(normalized, addName.trim() || null);
    setAdding(false);
    if (ok) {
      setAddResult({ ok: true, msg: `${normalized} has been added to the whitelist.` });
      setAddAddress("");
      setAddName("");
      load();
    } else {
      setAddResult({ ok: false, msg: "Failed to add address. It may already be on the whitelist, or there was a connection error." });
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Whitelist</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Approved wallet addresses for the whitelist mint phase
        </p>
      </div>

      {/* Count badge */}
      <div className="flex items-center gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex items-center gap-2.5">
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <span className="text-sm font-semibold text-emerald-800">
            {loading ? "…" : `${entries.length.toLocaleString()} wallets on whitelist`}
          </span>
        </div>
      </div>

      {/* Add address form */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Wallet Address
        </h2>

        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Wallet Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={addAddress}
              onChange={(e) => { setAddAddress(e.target.value); validateAddress(e.target.value); setAddResult(null); }}
              placeholder="0x..."
              required
              className={`w-full px-3 py-2.5 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                addressError ? "border-red-300 bg-red-50" : "border-slate-200"
              }`}
            />
            {addressError && (
              <p className="text-xs text-red-600 mt-1">{addressError}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Label / Name <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              placeholder="e.g. VIP Partner, Community Winner..."
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={adding || !!addressError || !addAddress.trim()}
              className="px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {adding ? "Adding…" : "Add to Whitelist"}
            </button>
            {addResult && (
              <p className={`text-xs ${addResult.ok ? "text-emerald-700" : "text-red-600"}`}>
                {addResult.ok ? "✓ " : "✗ "}{addResult.msg}
              </p>
            )}
          </div>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400">
          To remove addresses or do bulk imports, contact your technical admin.
        </div>
      </div>

      {/* Search + table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Search bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by address or name…"
              className="pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full"
            />
          </div>
          <span className="text-xs text-slate-400 ml-auto">{filtered.length} results</span>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">
            <svg className="w-5 h-5 animate-spin text-emerald-500 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading whitelist…
          </div>
        ) : paginated.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            {entries.length === 0 ? "No addresses on the whitelist yet." : "No results match your search."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Wallet Address</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Label</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {paginated.map((e, idx) => (
                  <tr key={e.address} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-xs text-slate-400 font-mono">
                      {(page - 1) * PER_PAGE + idx + 1}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-700">
                      <span className="hidden sm:inline" title={e.address}>
                        {e.address.slice(0, 10)}…{e.address.slice(-8)}
                      </span>
                      <span className="sm:hidden" title={e.address}>
                        {e.address.slice(0, 8)}…{e.address.slice(-6)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {e.name ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          {e.name}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">
                      {e.added_at
                        ? new Date(e.added_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-sm text-slate-500">
            <span>Page {page} of {totalPages} · {filtered.length} total</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 text-xs">«</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 text-xs">← Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 text-xs">Next →</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 text-xs">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
