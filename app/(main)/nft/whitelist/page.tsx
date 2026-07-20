"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface WLEntry {
  id: string;
  address: string;
  user_id: string | null;
  is_whitelisted: boolean;
  added_at: string | null;
}

interface WLMeta {
  merkle_root: string;
  last_updated: string;
  manual_override: boolean;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#fff", borderRadius: "12px",
  border: "1px solid #e5e7eb", padding: "20px 24px",
};
const label: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 700,
  color: "#9bafc5", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em",
};
const input: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: "8px",
  border: "1px solid #e5e7eb", fontSize: "13px", color: "#111827", outline: "none",
};
const btn = (color: string): React.CSSProperties => ({
  padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
  background: color, color: "#fff", border: "none", cursor: "pointer",
  display: "inline-flex", alignItems: "center", gap: "6px",
});
const thS: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: "#9bafc5", textTransform: "uppercase",
  letterSpacing: "0.06em", padding: "10px 14px", borderBottom: "1px solid #e5e7eb",
  background: "#f9fafb", whiteSpace: "nowrap",
};
const tdS: React.CSSProperties = {
  fontSize: "13px", color: "#374151", padding: "10px 14px",
  borderBottom: "1px solid #f3f4f6",
};

// ─── Helper ───────────────────────────────────────────────────────────────────

const ETH_RE = /^0x[a-fA-F0-9]{40}$/;

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function Toast({ msg, ok }: { msg: string; ok: boolean }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      background: ok ? "#16a34a" : "#dc2626", color: "#fff",
      padding: "12px 20px", borderRadius: "10px", fontSize: "13px",
      fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,.18)",
    }}>
      {msg}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function WhitelistPage() {
  const [entries, setEntries] = useState<WLEntry[]>([]);
  const [meta, setMeta] = useState<WLMeta | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  // Single add
  const [singleAddr, setSingleAddr] = useState("");

  // Bulk paste
  const [bulkText, setBulkText] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  // CSV upload
  const fileRef = useRef<HTMLInputElement>(null);

  // Search
  const [search, setSearch] = useState("");

  // Manual override root
  const [overrideRoot, setOverrideRoot] = useState("");
  const [showOverride, setShowOverride] = useState(false);

  const notify = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const loadEntries = useCallback(async (pageNum = 0) => {
    setLoading(true);
    try {
      const offset = pageNum * PAGE_SIZE;
      const r = await fetch(`/api/whitelist/entries?limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? data.detail ?? "Load failed");
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
      setMeta(data.metadata ?? null);
    } catch (e) {
      notify((e as Error).message, false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadEntries(page); }, [loadEntries, page]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function addSingle() {
    if (!ETH_RE.test(singleAddr.trim()))
      return notify("Invalid Ethereum address", false);
    setBusy(true);
    try {
      const r = await fetch("/api/whitelist/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: singleAddr.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? d.detail ?? "Add failed");
      notify(d.added ? `Added — ${d.count} total` : "Already whitelisted");
      setSingleAddr("");
      await loadEntries(0);
      setPage(0);
    } catch (e) { notify((e as Error).message, false); }
    finally { setBusy(false); }
  }

  async function bulkAdd(addresses: string[]) {
    const valid = addresses.map(a => a.trim()).filter(a => ETH_RE.test(a));
    if (!valid.length) return notify("No valid addresses found", false);
    setBusy(true);
    try {
      const r = await fetch("/api/whitelist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses: valid }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? d.detail ?? "Bulk add failed");
      notify(`Added ${d.added}, skipped ${d.skipped} duplicates — ${d.count} total`);
      setBulkText("");
      setShowBulk(false);
      await loadEntries(0);
      setPage(0);
    } catch (e) { notify((e as Error).message, false); }
    finally { setBusy(false); }
  }

  async function removeAddress(address: string) {
    if (!confirm(`Remove ${shortAddr(address)} from whitelist?`)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/whitelist/${address}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? d.detail ?? "Remove failed");
      notify(`Removed — ${d.count} remaining`);
      await loadEntries(page);
    } catch (e) { notify((e as Error).message, false); }
    finally { setBusy(false); }
  }

  async function clearOverride() {
    if (!confirm("Clear manual override and recalculate merkle root from DB?")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/whitelist/merkle-root", { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? d.detail ?? "Clear override failed");
      notify("Override cleared — merkle root recalculated");
      await loadEntries(page);
    } catch (e) { notify((e as Error).message, false); }
    finally { setBusy(false); }
  }

  async function setManualOverride() {
    if (!/^0x[a-fA-F0-9]{64}$/.test(overrideRoot.trim()))
      return notify("Root must be 0x + 64 hex chars", false);
    setBusy(true);
    try {
      const r = await fetch("/api/whitelist/merkle-root", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ root: overrideRoot.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? d.detail ?? "Override failed");
      notify("Manual override set");
      setOverrideRoot("");
      setShowOverride(false);
      await loadEntries(page);
    } catch (e) { notify((e as Error).message, false); }
    finally { setBusy(false); }
  }

  function handleCSV(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/[\r\n,]+/).map(l => l.trim()).filter(Boolean);
      const addrs = lines.filter(l => ETH_RE.test(l));
      if (!addrs.length) { notify("No valid addresses found in file", false); return; }
      bulkAdd(addrs);
    };
    reader.readAsText(file);
  }

  function exportWhitelist(format: "csv" | "json") {
    // Direct browser download via proxy
    window.location.href = `/api/whitelist/export?format=${format}`;
  }

  // ── Filtered entries ───────────────────────────────────────────────────────

  const displayed = search.trim()
    ? entries.filter(e => e.address.toLowerCase().includes(search.toLowerCase()))
    : entries;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: "24px 28px", maxWidth: 1100, margin: "0 auto" }}>
      {toast && <Toast msg={toast.msg} ok={toast.ok} />}

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#111827", margin: 0 }}>
          Whitelist Management
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
          Wave 1 — Free Mint eligibility list. Only these wallets can claim a free NFT.
        </p>
      </div>

      {/* Stats bar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ ...card, textAlign: "center" }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#41afeb" }}>{total.toLocaleString()}</div>
          <div style={{ fontSize: 12, color: "#9bafc5", fontWeight: 600, textTransform: "uppercase" }}>Whitelisted Wallets</div>
        </div>
        <div style={{ ...card, gridColumn: "span 2" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ ...label, marginBottom: 6 }}>Merkle Root</div>
              {meta?.manual_override && (
                <span style={{
                  fontSize: 11, fontWeight: 700, background: "rgba(217,119,6,.1)",
                  color: "#d97706", padding: "2px 8px", borderRadius: 6, marginBottom: 6, display: "inline-block",
                }}>MANUAL OVERRIDE ACTIVE</span>
              )}
              <div style={{
                fontFamily: "monospace", fontSize: 12, color: "#374151",
                wordBreak: "break-all", lineHeight: 1.5,
              }}>
                {meta?.merkle_root ?? "Loading…"}
              </div>
              {meta?.last_updated && (
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  Updated {new Date(meta.last_updated).toLocaleString()}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              {meta?.manual_override && (
                <button style={btn("#6b7280")} onClick={clearOverride} disabled={busy}>
                  Clear Override
                </button>
              )}
              <button
                style={btn("#6366f1")}
                onClick={() => setShowOverride(v => !v)}
                disabled={busy}
              >
                Set Override
              </button>
            </div>
          </div>
          {showOverride && (
            <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <input
                style={{ ...input, fontFamily: "monospace", fontSize: 12, flex: 1 }}
                placeholder="0x0000...0000 (64 hex chars)"
                value={overrideRoot}
                onChange={e => setOverrideRoot(e.target.value)}
              />
              <button style={btn("#6366f1")} onClick={setManualOverride} disabled={busy}>Apply</button>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div style={{ ...card, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          {/* Single add */}
          <div style={{ flex: "1 1 280px" }}>
            <label style={label}>Add Single Address</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={{ ...input, flex: 1 }}
                placeholder="0x..."
                value={singleAddr}
                onChange={e => setSingleAddr(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addSingle()}
              />
              <button style={btn("#16a34a")} onClick={addSingle} disabled={busy || !singleAddr.trim()}>
                Add
              </button>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, background: "#e5e7eb", alignSelf: "stretch" }} />

          {/* Bulk actions */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <button style={btn("#41afeb")} onClick={() => setShowBulk(v => !v)} disabled={busy}>
              Bulk Paste
            </button>
            <button style={btn("#6366f1")} onClick={() => fileRef.current?.click()} disabled={busy}>
              Upload CSV
            </button>
            <input
              ref={fileRef} type="file" accept=".csv,.txt"
              style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleCSV(f); e.target.value = ""; }}
            />
            <button style={btn("#374151")} onClick={() => exportWhitelist("csv")}>
              Export CSV
            </button>
            <button style={btn("#374151")} onClick={() => exportWhitelist("json")}>
              Export JSON
            </button>
          </div>
        </div>

        {/* Bulk paste area */}
        {showBulk && (
          <div style={{ marginTop: 16 }}>
            <label style={label}>Paste addresses (one per line, or comma-separated)</label>
            <textarea
              style={{
                ...input, height: 120, resize: "vertical", fontFamily: "monospace",
                fontSize: 12,
              }}
              placeholder={"0x...\n0x...\n0x..."}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
            />
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button
                style={btn("#16a34a")}
                onClick={() => bulkAdd(bulkText.split(/[\r\n,]+/))}
                disabled={busy || !bulkText.trim()}
              >
                Add All Valid Addresses
              </button>
              <button
                style={{ ...btn("#6b7280"), background: "transparent", color: "#6b7280", border: "1px solid #e5e7eb" }}
                onClick={() => { setShowBulk(false); setBulkText(""); }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        {/* Table header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", borderBottom: "1px solid #e5e7eb",
        }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
            Whitelist Entries
            <span style={{ marginLeft: 8, fontSize: 12, color: "#9bafc5" }}>
              ({total.toLocaleString()} total)
            </span>
          </div>
          <input
            style={{ ...input, width: 240 }}
            placeholder="Search address…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9bafc5", fontSize: 13 }}>Loading…</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thS}>#</th>
                  <th style={thS}>Address</th>
                  <th style={thS}>User ID</th>
                  <th style={thS}>Status</th>
                  <th style={thS}>Added At</th>
                  <th style={{ ...thS, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ ...tdS, textAlign: "center", color: "#9bafc5", padding: 32 }}>
                      {search ? "No addresses match your search." : "No addresses whitelisted yet."}
                    </td>
                  </tr>
                )}
                {displayed.map((e, i) => (
                  <tr key={e.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ ...tdS, color: "#9bafc5" }}>{page * PAGE_SIZE + i + 1}</td>
                    <td style={tdS}>
                      <span
                        title={e.address}
                        style={{ fontFamily: "monospace", fontSize: 12, cursor: "pointer" }}
                        onClick={() => navigator.clipboard.writeText(e.address)}
                      >
                        {e.address}
                      </span>
                    </td>
                    <td style={{ ...tdS, color: "#9bafc5" }}>{e.user_id ?? "—"}</td>
                    <td style={tdS}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                        background: e.is_whitelisted ? "rgba(22,163,74,.1)" : "rgba(220,38,38,.1)",
                        color: e.is_whitelisted ? "#16a34a" : "#dc2626",
                      }}>
                        {e.is_whitelisted ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td style={{ ...tdS, color: "#6b7280", whiteSpace: "nowrap" }}>
                      {e.added_at ? new Date(e.added_at).toLocaleDateString() : "—"}
                    </td>
                    <td style={{ ...tdS, textAlign: "right" }}>
                      <button
                        style={{
                          padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                          background: "rgba(220,38,38,.08)", color: "#dc2626",
                          border: "1px solid rgba(220,38,38,.2)", cursor: "pointer",
                        }}
                        onClick={() => removeAddress(e.address)}
                        disabled={busy}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 20px", borderTop: "1px solid #e5e7eb",
          }}>
            <span style={{ fontSize: 12, color: "#9bafc5" }}>
              Page {page + 1} of {totalPages} · {total.toLocaleString()} entries
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: page === 0 ? "#f3f4f6" : "#fff", color: page === 0 ? "#d1d5db" : "#374151",
                  border: "1px solid #e5e7eb", cursor: page === 0 ? "default" : "pointer",
                }}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                ← Prev
              </button>
              <button
                style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: page >= totalPages - 1 ? "#f3f4f6" : "#fff",
                  color: page >= totalPages - 1 ? "#d1d5db" : "#374151",
                  border: "1px solid #e5e7eb", cursor: page >= totalPages - 1 ? "default" : "pointer",
                }}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info banner */}
      <div style={{
        marginTop: 20, padding: "12px 16px", borderRadius: 10,
        background: "rgba(65,175,235,.06)", border: "1px solid rgba(65,175,235,.2)",
        fontSize: 12, color: "#374151",
      }}>
        <strong style={{ color: "#41afeb" }}>Wave 1 — Free Mint Only</strong>
        {"  "}Only wallets on this list can claim a free NFT in Wave 1 (Genesis, 303 NFTs).
        Waves 2–7 are open to all buyers via paid mint. The merkle root is auto-calculated
        whenever addresses are added or removed. Use &quot;Set Override&quot; only if you need to use a
        pre-computed root from an external tool.
      </div>
    </div>
  );
}
