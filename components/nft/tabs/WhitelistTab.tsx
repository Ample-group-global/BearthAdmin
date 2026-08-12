"use client";

import { useState, useEffect } from "react";
import { useWhitelist } from "@/app/dashboard/whitelist/useWhitelist";
import { ToastContainer } from "@/app/dashboard/whitelist/Toast";
import { useToast } from "@/app/dashboard/whitelist/useToast";
import { ETH_ADDRESS_RE } from "@/lib/nft-constants";

type WlTab = "addresses" | "add" | "bulk" | "merkle" | "test" | "export";

const TABS: { id: WlTab; label: string }[] = [
  { id: "addresses", label: "All Addresses" },
  { id: "add", label: "Add Single" },
  { id: "bulk", label: "Bulk Import" },
  { id: "merkle", label: "Merkle Root" },
  { id: "test", label: "Test Address" },
  { id: "export", label: "Export" },
];

const TAB_ACTIVE: React.CSSProperties = {
  color: "#24315f", borderBottom: "2px solid #41afeb", fontWeight: 700,
  background: "transparent", padding: "14px 16px", fontSize: 14,
  whiteSpace: "nowrap", transition: "color 0.15s",
};
const TAB_INACTIVE: React.CSSProperties = {
  color: "#9bafc5", borderBottom: "2px solid transparent", fontWeight: 600,
  background: "transparent", padding: "14px 16px", fontSize: 14,
  whiteSpace: "nowrap", transition: "color 0.15s",
};

const inputCls = "w-full px-3.5 py-2.5 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-[#41afeb]";
const inputStyle: React.CSSProperties = { border: "1px solid #e5e7eb" };

const btnPrimary = "px-4 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40";
const btnPrimaryStyle: React.CSSProperties = { background: "#24315f" };

export default function WhitelistTab() {
  const { toasts, showToast, removeToast } = useToast();
  const {
    addresses, stats, isLoading, error,
    addAddress, addAddressesBulk, removeAddress, testAddress,
    setMerkleRoot, clearMerkleRootOverride, exportWhitelist,
    addAddressLoading, addAddressesLoading, removeAddressLoading,
    testAddressLoading, setMerkleRootLoading, clearMerkleRootOverrideLoading,
  } = useWhitelist();

  const [wlTab, setWlTab] = useState<WlTab>("addresses");
  const [search, setSearch] = useState("");
  const [newAddr, setNewAddr] = useState("");
  const [newRoleCode, setNewRoleCode] = useState("customer");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [registerLoading, setRegisterLoading] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [merkleInput, setMerkleInput] = useState("");
  const [testAddr, setTestAddr] = useState("");
  const [pushChainLoading, setPushChainLoading] = useState(false);
  const [pushChainTxHash, setPushChainTxHash] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ isWhitelisted: boolean; proof?: string[] } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  const filtered = addresses.filter((a) => a.toLowerCase().includes(search.toLowerCase()));
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const wrap = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); showToast(ok, "success"); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error", "error"); }
  };

  const handleRegister = async () => {
    const addr = newAddr.trim();
    if (!ETH_ADDRESS_RE.test(addr)) { showToast("Invalid Ethereum address — must be 0x + 40 hex", "error"); return; }
    if (!newFirstName.trim()) { showToast("First name is required", "error"); return; }
    setRegisterLoading(true);
    try {
      const res = await fetch("/api/whitelist/register", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: addr, role_code: newRoleCode,
          first_name: newFirstName.trim(), last_name: newLastName.trim() || undefined,
          email: newEmail.trim() || undefined,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; isNewUser?: boolean; roleCode?: string };
      if (!res.ok) throw new Error(data.error ?? "Registration failed");
      setNewAddr(""); setNewFirstName(""); setNewLastName(""); setNewEmail(""); setNewRoleCode("customer");
      showToast(`Wallet registered as ${data.roleCode ?? newRoleCode}${data.isNewUser ? " (new user created)" : " (linked to existing user)"}`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleBulk = () => {
    const list = bulkText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    const invalid = list.filter(a => !ETH_ADDRESS_RE.test(a));
    if (invalid.length > 0) {
      showToast(`${invalid.length} invalid address(es) found — fix before importing`, "error");
      return;
    }
    wrap(async () => { await addAddressesBulk(list); setBulkText(""); }, `${list.length} addresses added`);
  };

  const handleRemove = (addr: string) =>
    wrap(() => removeAddress(addr), "Address removed");

  const handleSetRoot = () =>
    wrap(async () => { await setMerkleRoot(merkleInput.trim()); setMerkleInput(""); }, "Merkle root set");

  const handlePushToChain = async () => {
    setPushChainLoading(true);
    setPushChainTxHash(null);
    try {
      const res = await fetch("/api/whitelist/push-chain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await res.json() as { success?: boolean; txHash?: string; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Push failed");
      setPushChainTxHash(data.txHash ?? null);
      showToast("Allowlist root pushed to contract ✓", "success");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Push failed", "error");
    } finally {
      setPushChainLoading(false);
    }
  };

  const handleClearRoot = () =>
    wrap(clearMerkleRootOverride, "Override cleared, root recomputed");

  const handleTest = async () => {
    try {
      const r = await testAddress(testAddr.trim());
      setTestResult(r);
      showToast(r.isWhitelisted ? "Address is whitelisted ✓" : "Address is NOT whitelisted", r.isWhitelisted ? "success" : "warning");
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : "Error", "error"); }
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: "#24315f" }}>Whitelist Management</h2>
          <p className="text-sm mt-0.5" style={{ color: "#9bafc5" }}>
            {addresses.length.toLocaleString()} addresses ·{" "}
            {stats?.merkleRoot ? `Root: ${stats.merkleRoot.slice(0, 12)}...` : "No root set"}
            {stats?.manualOverride && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: "rgba(217,119,6,0.1)", color: "#d97706" }}>
                Manual Override
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Addresses", value: addresses.length.toLocaleString() },
          { label: "Merkle Root",     value: stats?.merkleRoot ? `${stats.merkleRoot.slice(0, 10)}...` : "—" },
          { label: "Override Active", value: stats?.manualOverride ? "Yes" : "No" },
          { label: "Last Updated",    value: stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleDateString() : "—" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <p className="text-xs mb-1" style={{ color: "#9bafc5" }}>{s.label}</p>
            <p className="text-sm font-semibold font-mono truncate" style={{ color: "#24315f" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Panel */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        {/* Sub-tabs */}
        <div className="px-1 flex overflow-x-auto" style={{ borderBottom: "1px solid #e5e7eb" }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setWlTab(t.id)}
              style={wlTab === t.id ? TAB_ACTIVE : TAB_INACTIVE}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── All Addresses ── */}
          {wlTab === "addresses" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "#9bafc5" }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search addresses..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#41afeb]"
                    style={{ border: "1px solid #e5e7eb" }}
                  />
                </div>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: "#f3f4f6", color: "#6b7280" }}>
                  {filtered.length} results
                </span>
              </div>

              {isLoading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => (
                  <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "#f3f4f6" }} />
                ))}</div>
              ) : paginated.length === 0 ? (
                <div className="text-center py-10 text-sm" style={{ color: "#9bafc5" }}>No addresses found</div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg" style={{ border: "1px solid #e5e7eb" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                          <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>#</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>Address</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((addr, i) => (
                          <tr key={addr}
                            style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                            onMouseLeave={e => (e.currentTarget.style.background = "")}>
                            <td className="px-4 py-3 font-mono text-xs" style={{ color: "#9bafc5" }}>{(page - 1) * PER_PAGE + i + 1}</td>
                            <td className="px-4 py-3 font-mono text-xs break-all" style={{ color: "#24315f" }}>{addr}</td>
                            <td className="px-4 py-3 text-right">
                              {confirmRemove === addr ? (
                                <div className="flex items-center justify-end gap-2">
                                  <span className="text-xs" style={{ color: "#dc2626" }}>Confirm?</span>
                                  <button onClick={() => { handleRemove(addr); setConfirmRemove(null); }}
                                    className="text-xs px-2 py-1 rounded text-white" style={{ background: "#dc2626" }}>
                                    Yes
                                  </button>
                                  <button onClick={() => setConfirmRemove(null)}
                                    className="text-xs px-2 py-1 rounded" style={{ background: "#f3f4f6", color: "#6b7280" }}>
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmRemove(addr)}
                                  disabled={removeAddressLoading}
                                  className="text-xs px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                  style={{ color: "#dc2626", background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.15)" }}>
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
                    <div className="flex items-center justify-between text-sm" style={{ color: "#9bafc5" }}>
                      <span>Page {page} of {totalPages}</span>
                      <div className="flex gap-2">
                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                          style={{ border: "1px solid #e5e7eb", color: "#374151", background: "white" }}>
                          ← Prev
                        </button>
                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-40"
                          style={{ border: "1px solid #e5e7eb", color: "#374151", background: "white" }}>
                          Next →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Add Single (Register Wallet) ── */}
          {wlTab === "add" && (
            <div className="max-w-md space-y-4">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "#24315f" }}>Register Wallet</h3>
                <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                  Every whitelisted wallet must belong to a registered user. Select the user type, fill in their details, then register.
                </p>
              </div>

              {/* User Type */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#6b7280" }}>User Type</label>
                <select
                  value={newRoleCode}
                  onChange={(e) => setNewRoleCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#41afeb] bg-white"
                  style={{ border: "1px solid #e5e7eb", color: "#24315f" }}>
                  <option value="customer">Customer — can mint NFTs</option>
                  <option value="technical_team">Team Member — internal / testing</option>
                  <option value="ext_referrer">Partner — referral / collaboration</option>
                </select>
              </div>

              {/* Wallet Address */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#6b7280" }}>Wallet Address <span style={{ color: "#dc2626" }}>*</span></label>
                <input value={newAddr} onChange={(e) => setNewAddr(e.target.value)}
                  placeholder="0x..."
                  className={inputCls}
                  style={inputStyle} />
              </div>

              {/* First Name */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#6b7280" }}>First Name <span style={{ color: "#dc2626" }}>*</span></label>
                <input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)}
                  placeholder="e.g. John"
                  className={inputCls}
                  style={inputStyle} />
              </div>

              {/* Last Name + Email in a row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#6b7280" }}>Last Name</label>
                  <input value={newLastName} onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Optional"
                    className={inputCls}
                    style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "#6b7280" }}>Email</label>
                  <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Optional"
                    type="email"
                    className={inputCls}
                    style={inputStyle} />
                </div>
              </div>

              <div className="pt-1 p-3 rounded-lg text-xs" style={{ background: "rgba(65,175,235,0.06)", border: "1px solid rgba(65,175,235,0.2)", color: "#1e6fa8" }}>
                If email matches an existing user, the wallet is linked to that user instead of creating a new one.
              </div>

              <button onClick={handleRegister} disabled={registerLoading || !newAddr.trim() || !newFirstName.trim()}
                className={btnPrimary}
                style={btnPrimaryStyle}>
                {registerLoading ? "Registering..." : "Register & Add to Whitelist"}
              </button>
            </div>
          )}

          {/* ── Bulk Import ── */}
          {wlTab === "bulk" && (
            <div className="max-w-lg space-y-4">
              <h3 className="text-sm font-semibold" style={{ color: "#24315f" }}>Bulk Import</h3>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#6b7280" }}>One address per line (or comma-separated)</label>
                <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={10}
                  placeholder={"0xAb5801...\n0x742d35...\n0xd8dA6B..."}
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-[#41afeb] resize-y"
                  style={inputStyle} />
                <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>
                  {bulkText.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).length} addresses detected
                </p>
              </div>
              <button onClick={handleBulk} disabled={addAddressesLoading || !bulkText.trim()}
                className={btnPrimary}
                style={btnPrimaryStyle}>
                {addAddressesLoading ? "Importing..." : "Import Addresses"}
              </button>
            </div>
          )}

          {/* ── Merkle Root ── */}
          {wlTab === "merkle" && (
            <div className="max-w-lg space-y-5">
              <div className="p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <p className="text-xs font-medium mb-1" style={{ color: "#9bafc5" }}>Current Merkle Root</p>
                <p className="font-mono text-xs break-all" style={{ color: "#24315f" }}>{stats?.merkleRoot || "Not set"}</p>
                {stats?.manualOverride && (
                  <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ background: "rgba(217,119,6,0.1)", color: "#d97706" }}>
                    Manual Override Active
                  </span>
                )}
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold" style={{ color: "#24315f" }}>Set Manual Override</h3>
                <input value={merkleInput} onChange={(e) => setMerkleInput(e.target.value)}
                  placeholder="0x..."
                  className={inputCls}
                  style={inputStyle} />
                <div className="flex gap-3">
                  <button onClick={handleSetRoot} disabled={setMerkleRootLoading || !merkleInput.trim()}
                    className="px-4 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40"
                    style={{ background: "#d97706" }}>
                    {setMerkleRootLoading ? "Setting..." : "Set Root"}
                  </button>
                  <button onClick={handleClearRoot} disabled={clearMerkleRootOverrideLoading}
                    className="px-4 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40"
                    style={{ background: "#6b7280" }}>
                    {clearMerkleRootOverrideLoading ? "Clearing..." : "Clear Override"}
                  </button>
                </div>
              </div>
              <div className="pt-4 mt-2" style={{ borderTop: "1px solid #e5e7eb" }}>
                <h3 className="text-sm font-semibold mb-1" style={{ color: "#24315f" }}>Push to Blockchain</h3>
                <p className="text-xs mb-3" style={{ color: "#9bafc5" }}>
                  Submit the current merkle root to the smart contract on-chain. Requires gas from the operations wallet.
                </p>
                <button
                  onClick={handlePushToChain}
                  disabled={pushChainLoading}
                  data-testid="push-allowlist-chain"
                  className="px-4 py-2.5 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40"
                  style={{ background: "#16a34a" }}>
                  {pushChainLoading ? "Pushing..." : "Push to Contract"}
                </button>
                {pushChainTxHash && (
                  <p className="text-xs mt-2 font-mono break-all" style={{ color: "#16a34a" }}>
                    Tx: {pushChainTxHash}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Test Address ── */}
          {wlTab === "test" && (
            <div className="max-w-md space-y-4">
              <h3 className="text-sm font-semibold" style={{ color: "#24315f" }}>Test Address Membership</h3>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#6b7280" }}>Ethereum Address</label>
                <input value={testAddr} onChange={(e) => { setTestAddr(e.target.value); setTestResult(null); }}
                  placeholder="0x..."
                  className={inputCls}
                  style={inputStyle} />
              </div>
              <button onClick={handleTest} disabled={testAddressLoading || !testAddr.trim()}
                className={btnPrimary}
                style={btnPrimaryStyle}>
                {testAddressLoading ? "Checking..." : "Check Eligibility"}
              </button>
              {testResult && (
                <div className={`p-4 rounded-xl`}
                  style={{
                    background: testResult.isWhitelisted ? "rgba(22,163,74,0.06)" : "rgba(239,68,68,0.06)",
                    border: `1px solid ${testResult.isWhitelisted ? "rgba(22,163,74,0.2)" : "rgba(239,68,68,0.2)"}`,
                  }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="font-semibold text-sm"
                      style={{ color: testResult.isWhitelisted ? "#16a34a" : "#dc2626" }}>
                      {testResult.isWhitelisted ? "✓ Whitelisted" : "✗ Not Whitelisted"}
                    </span>
                  </div>
                  {testResult.isWhitelisted && (testResult.proof?.length ?? 0) > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium mb-2" style={{ color: "#6b7280" }}>
                        Merkle Proof ({testResult.proof!.length} elements):
                      </p>
                      {testResult.proof!.map((p: string, i: number) => (
                        <p key={i} className="font-mono text-xs break-all px-2 py-1 rounded"
                          style={{ background: "white", border: "1px solid #e5e7eb", color: "#374151" }}>
                          {p}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Export ── */}
          {wlTab === "export" && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold" style={{ color: "#24315f" }}>Export Whitelist</h3>
              <p className="text-sm" style={{ color: "#9bafc5" }}>{addresses.length} addresses available to export</p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => handleExport("csv")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ background: "white", border: "1px solid #e5e7eb", color: "#374151" }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#41afeb";
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(65,175,235,0.06)";
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#e5e7eb";
                    (e.currentTarget as HTMLButtonElement).style.background = "white";
                  }}>
                  <svg className="w-4 h-4" style={{ color: "#41afeb" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download .CSV
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
