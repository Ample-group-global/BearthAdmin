"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface OSAccount {
  address: string;
  username: string | null;
  profileImageUrl: string | null;
  bio: string | null;
  website: string | null;
  twitterUsername: string | null;
  openseaUrl: string | null;
}

function Spinner({ size = 5 }: { size?: number }) {
  return (
    <svg className={`w-${size} h-${size} animate-spin`} style={{ color: "#9bafc5" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function truncAddr(s: string) {
  if (!s || s.length <= 14) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString();
}

// ─── Sync modal ───────────────────────────────────────────────────────────────

function SyncModal({ onClose, onSynced }: { onClose: () => void; onSynced: (address: string) => void }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSync = async () => {
    if (!input.trim()) return;
    setError("");
    setLoading(true);
    try {
      const r = await fetch(
        `/api/opensea/Accounts/${encodeURIComponent(input.trim())}/sync`,
        { method: "POST", credentials: "include" }
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(`Error ${r.status}: ${d.message ?? d.error ?? ""}`); return; }
      const acc: OSAccount = d.account ?? d;
      if (acc?.address) { onSynced(acc.address); return; }
      setError("Sync succeeded but no address returned.");
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #e4e7ed" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Sync Account from OpenSea</h2>
            <p className="text-[10px] mt-0.5" style={{ color: "#9bafc5" }}>Enter a wallet address or OpenSea username</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: "#9bafc5" }}>
              Address or Username
            </label>
            <input
              autoFocus
              className="w-full text-xs px-3 py-2 rounded border outline-none"
              style={{ border: "1px solid #e4e7ed", color: "#374151" }}
              placeholder="0x… or opensea username"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSync(); }}
            />
          </div>
          {error && (
            <p className="text-xs px-3 py-2 rounded" style={{ background: "#fee2e2", color: "#dc2626" }}>{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-1.5 rounded text-xs font-semibold"
              style={{ border: "1px solid #e4e7ed", color: "#6b7280" }}>
              Cancel
            </button>
            <button
              onClick={handleSync}
              disabled={loading || !input.trim()}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white transition-opacity"
              style={{ background: "#41afeb", opacity: (loading || !input.trim()) ? 0.65 : 1 }}
            >
              {loading ? <Spinner size={3} /> : (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Sync
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<OSAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showSyncModal, setShowSyncModal] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAccounts = async (q = "") => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (q) params.set("search", q);
      const r = await fetch(`/api/opensea/Accounts?${params}`, { credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(`Error ${r.status}: ${d.message ?? d.error ?? ""}`); return; }
      setAccounts(Array.isArray(d) ? d : d.data ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, []);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchAccounts(val), 350);
  };

  const handleSynced = (address: string) => {
    setShowSyncModal(false);
    router.push(`/admin/opensea/accounts/${encodeURIComponent(address)}`);
  };

  return (
    <div className="p-5">
      {showSyncModal && (
        <SyncModal onClose={() => setShowSyncModal(false)} onSynced={handleSynced} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Accounts</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            {accounts.length} cached account{accounts.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowSyncModal(true)}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white"
          style={{ background: "#41afeb" }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sync Account
        </button>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-lg" style={{ border: "1px solid #e4e7ed" }}>
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid #e4e7ed" }}>
          <div className="relative flex-1" style={{ maxWidth: 320 }}>
            <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded border outline-none"
              style={{ border: "1px solid #e4e7ed", color: "#374151" }}
              placeholder="Search by address or username…"
              value={search}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 text-xs" style={{ color: "#dc2626", background: "#fee2e2" }}>{error}</div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid #e4e7ed", background: "#f8f9fb" }}>
                {["Address", "Username", "Bio", "Twitter", "Synced At", ""].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold text-xs whitespace-nowrap"
                    style={{ color: "#6b7280" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr>
                  <td colSpan={6} className="text-center py-10">
                    <div className="flex justify-center"><Spinner /></div>
                  </td>
                </tr>
              )}
              {!loading && accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-xs" style={{ color: "#9bafc5" }}>
                    {search ? "No accounts match your search." : "No accounts synced yet. Use Sync Account to add one."}
                  </td>
                </tr>
              )}
              {!loading && accounts.map((acc) => (
                <tr
                  key={acc.address}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/admin/opensea/accounts/${encodeURIComponent(acc.address)}`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {acc.profileImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={acc.profileImageUrl} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                          style={{ border: "1px solid #e4e7ed" }}
                          onError={e => { e.currentTarget.style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
                          style={{ background: "#e4e7ed" }}>
                          <svg className="w-3.5 h-3.5" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                      <span className="font-mono text-[10px]" style={{ color: "#24315f" }} title={acc.address}>
                        {truncAddr(acc.address)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: "#374151" }}>
                    {acc.username || <span style={{ color: "#c4c9d4" }}>—</span>}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    {acc.bio
                      ? <span className="line-clamp-1" style={{ color: "#6b7280" }}>{acc.bio}</span>
                      : <span style={{ color: "#c4c9d4" }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {acc.twitterUsername
                      ? <span style={{ color: "#1d9bf0" }}>@{acc.twitterUsername}</span>
                      : <span style={{ color: "#c4c9d4" }}>—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: "#9bafc5" }}>
                    {fmtDate((acc as unknown as Record<string, string>)["syncedAt"] ?? "")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/admin/opensea/accounts/${encodeURIComponent(acc.address)}`); }}
                      className="px-3 py-1 rounded text-[10px] font-semibold"
                      style={{ background: "#dbeafe", color: "#2563eb" }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
