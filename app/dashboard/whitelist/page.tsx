"use client";

import { useState, useEffect } from "react";
import { useWhitelist } from "./hooks/useWhitelist";
import { ToastContainer } from "./components/Toast";
import { useToast } from "./hooks/useToast";

type Tab = "addresses" | "add" | "bulk" | "merkle" | "test" | "export";

const TABS: { id: Tab; label: string }[] = [
  { id: "addresses", label: "All Addresses" },
  { id: "add", label: "Add Single" },
  { id: "bulk", label: "Bulk Import" },
  { id: "merkle", label: "Merkle Root" },
  { id: "test", label: "Test Address" },
  { id: "export", label: "Export" },
];

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>{children}</span>;
}

export default function TechWhitelistPage() {
  const { toasts, showToast, removeToast } = useToast();
  const {
    addresses, stats, isLoading, error,
    addAddress, addAddressesBulk, removeAddress, testAddress,
    setMerkleRoot, clearMerkleRootOverride, exportWhitelist,
    addAddressLoading, addAddressesLoading, removeAddressLoading,
    testAddressLoading, setMerkleRootLoading, clearMerkleRootOverrideLoading,
  } = useWhitelist();

  const [tab, setTab] = useState<Tab>("addresses");
  const [search, setSearch] = useState("");
  const [newAddr, setNewAddr] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [merkleInput, setMerkleInput] = useState("");
  const [testAddr, setTestAddr] = useState("");
  const [testResult, setTestResult] = useState<{ isWhitelisted: boolean; proof?: string[] } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const filtered = addresses.filter((a) => a.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const wrap = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); showToast(ok, "success"); }
    catch (e: any) { showToast(e?.message || "Error", "error"); }
  };

  const handleAdd = () =>
    wrap(async () => { await addAddress(newAddr.trim()); setNewAddr(""); }, "Address added");

  const handleBulk = () => {
    const list = bulkText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    wrap(async () => { await addAddressesBulk(list); setBulkText(""); }, `${list.length} addresses added`);
  };

  const handleRemove = (addr: string) =>
    wrap(() => removeAddress(addr), "Address removed");

  const handleSetRoot = () =>
    wrap(async () => { await setMerkleRoot(merkleInput.trim()); setMerkleInput(""); }, "Merkle root set");

  const handleClearRoot = () =>
    wrap(clearMerkleRootOverride, "Override cleared, root recomputed");

  const handleTest = async () => {
    try {
      const r = await testAddress(testAddr.trim());
      setTestResult(r);
      showToast(r.isWhitelisted ? "Address is whitelisted ✓" : "Address is NOT whitelisted", r.isWhitelisted ? "success" : "warning");
    } catch (e: any) { showToast(e?.message || "Error", "error"); }
  };

  const handleExport = async (fmt: "csv" | "json" | "txt") => {
    try {
      const blob = await exportWhitelist(fmt);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `whitelist-${new Date().toISOString().split("T")[0]}.${fmt}`;
      document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
      showToast("Downloaded", "success");
    } catch { showToast("Export failed", "error"); }
  };

  useEffect(() => {
    if (error) showToast(error, "error");
  }, [error, showToast]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Whitelist Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {addresses.length.toLocaleString()} addresses ·{" "}
            {stats?.merkleRoot ? `Root: ${stats.merkleRoot.slice(0, 12)}...` : "No root set"}
            {stats?.manualOverride && <Badge color="bg-amber-100 text-amber-700 ml-2">Manual Override</Badge>}
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Addresses", value: addresses.length.toLocaleString() },
          { label: "Merkle Root", value: stats?.merkleRoot ? `${stats.merkleRoot.slice(0, 10)}...` : "—" },
          { label: "Override Active", value: stats?.manualOverride ? "Yes" : "No" },
          { label: "Last Updated", value: stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleDateString() : "—" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <p className="text-xs text-slate-500 mb-1">{s.label}</p>
            <p className="text-sm font-semibold text-slate-900 font-mono truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-1 flex overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* All Addresses tab */}
          {tab === "addresses" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search addresses..."
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <Badge color="bg-slate-100 text-slate-600">{filtered.length} results</Badge>
              </div>

              {isLoading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                ))}</div>
              ) : paginated.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-sm">No addresses found</div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">#</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Address</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginated.map((addr, i) => (
                          <tr key={addr} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-slate-400 font-mono text-xs">{(page - 1) * PER_PAGE + i + 1}</td>
                            <td className="px-4 py-3 font-mono text-slate-800 text-xs break-all">{addr}</td>
                            <td className="px-4 py-3 text-right">
                              {confirmRemove === addr ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-xs text-red-600">Confirm?</span>
                                  <button onClick={() => { handleRemove(addr); setConfirmRemove(null); }}
                                    className="text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">Yes</button>
                                  <button onClick={() => setConfirmRemove(null)}
                                    className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200">No</button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmRemove(addr)}
                                  disabled={removeAddressLoading}
                                  className="text-xs px-3 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50">
                                  Remove
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>Page {page} of {totalPages}</span>
                      <div className="flex gap-2">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                          className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">← Prev</button>
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                          className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">Next →</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Add Single tab */}
          {tab === "add" && (
            <div className="max-w-md space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Add Single Address</h3>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Ethereum Address</label>
                <input value={newAddr} onChange={(e) => setNewAddr(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={handleAdd} disabled={addAddressLoading || !newAddr.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors">
                {addAddressLoading ? "Adding..." : "Add Address"}
              </button>
            </div>
          )}

          {/* Bulk Import tab */}
          {tab === "bulk" && (
            <div className="max-w-lg space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Bulk Import</h3>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">One address per line (or comma-separated)</label>
                <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={10}
                  placeholder={"0xAb5801...\n0x742d35...\n0xd8dA6B..."}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" />
                <p className="text-xs text-slate-400 mt-1">
                  {bulkText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).length} addresses detected
                </p>
              </div>
              <button onClick={handleBulk} disabled={addAddressesLoading || !bulkText.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors">
                {addAddressesLoading ? "Importing..." : "Import Addresses"}
              </button>
            </div>
          )}

          {/* Merkle Root tab */}
          {tab === "merkle" && (
            <div className="max-w-lg space-y-5">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-medium text-slate-500 mb-1">Current Merkle Root</p>
                <p className="font-mono text-xs text-slate-800 break-all">{stats?.merkleRoot || "Not set"}</p>
                {stats?.manualOverride && (
                  <Badge color="bg-amber-100 text-amber-700 mt-2">Manual Override Active</Badge>
                )}
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">Set Manual Override</h3>
                <input value={merkleInput} onChange={(e) => setMerkleInput(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <div className="flex gap-3">
                  <button onClick={handleSetRoot} disabled={setMerkleRootLoading || !merkleInput.trim()}
                    className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white text-sm font-semibold rounded-lg transition-colors">
                    {setMerkleRootLoading ? "Setting..." : "Set Root"}
                  </button>
                  <button onClick={handleClearRoot} disabled={clearMerkleRootOverrideLoading}
                    className="px-4 py-2.5 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white text-sm font-semibold rounded-lg transition-colors">
                    {clearMerkleRootOverrideLoading ? "Clearing..." : "Clear Override"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Test Address tab */}
          {tab === "test" && (
            <div className="max-w-md space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Test Address Membership</h3>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Ethereum Address</label>
                <input value={testAddr} onChange={(e) => { setTestAddr(e.target.value); setTestResult(null); }}
                  placeholder="0x..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={handleTest} disabled={testAddressLoading || !testAddr.trim()}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-lg transition-colors">
                {testAddressLoading ? "Checking..." : "Check Eligibility"}
              </button>
              {testResult && (
                <div className={`p-4 rounded-xl border ${testResult.isWhitelisted ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`font-semibold text-sm ${testResult.isWhitelisted ? "text-emerald-700" : "text-red-700"}`}>
                      {testResult.isWhitelisted ? "✓ Whitelisted" : "✗ Not Whitelisted"}
                    </span>
                  </div>
                  {testResult.isWhitelisted && (testResult.proof?.length ?? 0) > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-600 mb-2">Merkle Proof ({testResult.proof!.length} elements):</p>
                      {testResult.proof!.map((p: string, i: number) => (
                        <p key={i} className="font-mono text-xs text-slate-700 break-all bg-white px-2 py-1 rounded border">{p}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Export tab */}
          {tab === "export" && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800">Export Whitelist</h3>
              <p className="text-sm text-slate-500">{addresses.length} addresses available to export</p>
              <div className="flex flex-wrap gap-3">
                {(["csv", "json", "txt"] as const).map((fmt) => (
                  <button key={fmt} onClick={() => handleExport(fmt)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-sm font-medium text-slate-700 rounded-lg transition-colors">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download .{fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
