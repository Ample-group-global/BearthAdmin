"use client";

import { useEffect, useState } from "react";
import { TxBanner } from "@/components/nft/TxBanner";
import { ErrBanner } from "@/components/nft/ErrBanner";
import { Toggle } from "@/components/nft/Toggle";
import { labelStyle, inputStyle, thStyle } from "@/components/nft/styles";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoyaltyConfig {
  royalty_pct_bps: number;
  receiver_address: string;
  enforce_royalty: boolean;
  last_tx_hash: string | null;
  synced_at: string | null;
}

interface Marketplace {
  id: string;
  address: string;
  name: string | null;
  enabled: boolean;
  synced_at: string | null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RoyaltyPage() {
  const [royalty, setRoyalty]         = useState<RoyaltyConfig | null>(null);
  const [markets, setMarkets]         = useState<Marketplace[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  // Royalty form
  const [feePct, setFeePct]           = useState("");   // in % (0–10), converted to bps on submit
  const [receiver, setReceiver]       = useState("");
  const [enforced, setEnforced]       = useState(true);
  const [savingRoyalty, setSavingRoyalty] = useState(false);
  const [royaltyError, setRoyaltyError]   = useState<string | null>(null);
  const [royaltyTx, setRoyaltyTx]         = useState<string | null>(null);

  // Marketplace modal
  const [showAddMarket, setShowAddMarket] = useState(false);
  const [mktAddr, setMktAddr]             = useState("");
  const [mktName, setMktName]             = useState("");
  const [mktEnabled, setMktEnabled]       = useState(true);
  const [savingMkt, setSavingMkt]         = useState(false);
  const [mktError, setMktError]           = useState<string | null>(null);
  const [mktTx, setMktTx]                 = useState<string | null>(null);

  const load = () => {
    setLoading(true); setError(null);
    Promise.all([
      fetch("/api/nft-sell/royalty",              { credentials: "include" }).then(r => r.json()),
      fetch("/api/nft-sell/royalty/marketplaces", { credentials: "include" }).then(r => r.json()),
    ]).then(([rData, mData]) => {
      const r: RoyaltyConfig = rData.royalty ?? null;
      setRoyalty(r);
      if (r) {
        setFeePct(String((r.royalty_pct_bps / 100).toFixed(2)));
        setReceiver(r.receiver_address ?? "");
        setEnforced(r.enforce_royalty ?? true);
      }
      setMarkets(mData.marketplaces ?? []);
      setLoading(false);
    }).catch(() => { setError("Failed to load royalty settings."); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const handleSaveRoyalty = async () => {
    setSavingRoyalty(true); setRoyaltyError(null); setRoyaltyTx(null);
    const pctNum = parseFloat(feePct);
    if (isNaN(pctNum) || pctNum < 0 || pctNum > 10) {
      setRoyaltyError("Royalty must be 0–10%."); setSavingRoyalty(false); return;
    }
    if (!receiver.startsWith("0x") || receiver.length !== 42) {
      setRoyaltyError("Enter a valid Ethereum address (0x...)."); setSavingRoyalty(false); return;
    }
    try {
      const res = await fetch("/api/nft-sell/royalty", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverAddress: receiver, feeBps: Math.round(pctNum * 100) }),
      });
      const d = await res.json();
      if (!res.ok) { setRoyaltyError(d.error ?? "Save failed."); return; }
      setRoyaltyTx(d.txHash);
      load();
    } catch { setRoyaltyError("Network error."); }
    finally { setSavingRoyalty(false); }
  };

  const handleToggleEnforcement = async (val: boolean) => {
    setEnforced(val);
    try {
      const res = await fetch("/api/nft-sell/royalty/enforcement", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enforced: val }),
      });
      const d = await res.json();
      if (!res.ok) { setRoyaltyError(d.error ?? "Failed to toggle."); setEnforced(!val); return; }
      setRoyaltyTx(d.txHash);
    } catch { setRoyaltyError("Network error."); setEnforced(!val); }
  };

  const handleSaveMarketplace = async () => {
    setSavingMkt(true); setMktError(null); setMktTx(null);
    if (!mktAddr.startsWith("0x") || mktAddr.length !== 42) {
      setMktError("Enter a valid Ethereum address (0x...)."); setSavingMkt(false); return;
    }
    try {
      const res = await fetch("/api/nft-sell/royalty/marketplaces", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: mktAddr, name: mktName, allowed: mktEnabled }),
      });
      const d = await res.json();
      if (!res.ok) { setMktError(d.error ?? "Save failed."); return; }
      setMktTx(d.txHash);
      setShowAddMarket(false); setMktAddr(""); setMktName(""); setMktEnabled(true);
      load();
    } catch { setMktError("Network error."); }
    finally { setSavingMkt(false); }
  };

  const toggleMarket = async (mkt: Marketplace) => {
    try {
      const res = await fetch("/api/nft-sell/royalty/marketplaces", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: mkt.address, name: mkt.name, allowed: !mkt.enabled }),
      });
      const d = await res.json();
      if (!res.ok) { setRoyaltyError(d.error ?? "Failed to toggle marketplace."); return; }
      load();
    } catch { setRoyaltyError("Network error."); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64" style={{ color: "#9bafc5" }}>
      <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Loading…
    </div>
  );

  return (
    <div className="p-5 space-y-5 max-w-3xl">

      {/* ── Header ── */}
      <div>
        <h1 className="text-lg font-bold" style={{ color: "#24315f" }}>Royalty & Marketplace Settings</h1>
        <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
          ERC2981 on-chain royalty — changes submit a blockchain transaction and update the DB mirror automatically
        </p>
      </div>

      {error && <ErrBanner msg={error} />}

      {/* ── Royalty Config ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5" style={{ border: "1px solid #e5e7eb" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>ERC2981 Royalty</h2>
            <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
              OpenSea reads this automatically. Max 10%.
            </p>
          </div>
          {royalty?.last_tx_hash && (
            <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: "#f0fdf4", color: "#16a34a" }}>
              Synced on-chain
            </span>
          )}
        </div>

        {royaltyTx && <TxBanner txHash={royaltyTx} />}
        {royaltyError && <ErrBanner msg={royaltyError} />}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>Royalty % (0–10%)</label>
            <div className="relative">
              <input type="number" step="0.01" min="0" max="10"
                value={feePct}
                onChange={e => setFeePct(e.target.value)}
                style={{ ...inputStyle, paddingRight: "36px" }}
                placeholder="5.00" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold"
                style={{ color: "#9bafc5" }}>%</span>
            </div>
            <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>
              {feePct && !isNaN(parseFloat(feePct))
                ? `= ${Math.round(parseFloat(feePct) * 100)} basis points`
                : "Stored as basis points (500 = 5%)"}
            </p>
          </div>
          <div>
            <label style={labelStyle}>Receiver Wallet Address</label>
            <input type="text"
              value={receiver}
              onChange={e => setReceiver(e.target.value)}
              style={inputStyle}
              placeholder="0x..." />
            <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>
              ETH sent here from secondary sales
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl"
          style={{ background: enforced ? "rgba(65,175,235,0.06)" : "#f9fafb", border: "1px solid #e5e7eb" }}>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#24315f" }}>Royalty Enforcement</p>
            <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
              {enforced
                ? "ON — transfers only via approved marketplaces"
                : "OFF — NFTs tradeable anywhere (royalties not enforced)"}
            </p>
          </div>
          <Toggle value={enforced} onChange={handleToggleEnforcement} />
        </div>

        {!enforced && (
          <div className="px-4 py-3 rounded-xl text-xs" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#d97706" }}>
            Warning: When enforcement is OFF, buyers can bypass royalties by trading on unapproved platforms.
          </div>
        )}

        <div className="flex justify-end">
          <button onClick={handleSaveRoyalty} disabled={savingRoyalty}
            className="px-5 py-2.5 text-sm font-bold text-white rounded-xl transition-opacity"
            style={{ background: savingRoyalty ? "#9bafc5" : "#41afeb" }}>
            {savingRoyalty ? "Submitting tx…" : "Save Royalty On-Chain"}
          </button>
        </div>
      </div>

      {/* ── Marketplace Allowlist ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Approved Marketplaces</h2>
            <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
              Only these platforms can execute transfers when enforcement is ON
            </p>
          </div>
          <button onClick={() => setShowAddMarket(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
            style={{ background: "#41afeb" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Marketplace
          </button>
        </div>

        {mktTx && (
          <div className="mx-5 mt-4"><TxBanner txHash={mktTx} /></div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Marketplace", "Address", "Status", "Synced", "Toggle"].map(h => (
                  <th key={h} style={{ ...thStyle, textAlign: h === "Toggle" ? "center" : "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {markets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-sm" style={{ color: "#9bafc5" }}>
                    No marketplaces configured
                  </td>
                </tr>
              ) : markets.map((m, i) => (
                <tr key={m.id}
                  style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <td style={{ padding: "10px 14px" }}>
                    <span className="font-semibold text-xs" style={{ color: "#111827" }}>
                      {m.name ?? "Unknown"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span className="font-mono text-xs" style={{ color: "#6b7280" }}>
                      {m.address.slice(0, 10)}…{m.address.slice(-6)}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        background: m.enabled ? "rgba(22,163,74,0.1)" : "rgba(156,163,175,0.12)",
                        color: m.enabled ? "#16a34a" : "#9ca3af",
                      }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.enabled ? "#16a34a" : "#9ca3af" }} />
                      {m.enabled ? "Allowed" : "Blocked"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span className="text-xs" style={{ color: "#9bafc5" }}>
                      {m.synced_at ? new Date(m.synced_at).toLocaleDateString() : "—"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px", textAlign: "center" }}>
                    <Toggle value={m.enabled} onChange={() => toggleMarket(m)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══ Add Marketplace Modal ══ */}
      {showAddMarket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl flex flex-col"
            style={{ width: "100%", maxWidth: 480, border: "1px solid #e5e7eb" }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
              <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Add Marketplace</h2>
              <button onClick={() => { setShowAddMarket(false); setMktError(null); }}
                style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {mktError && <ErrBanner msg={mktError} />}
              <div>
                <label style={labelStyle}>Contract Address</label>
                <input type="text" value={mktAddr} onChange={e => setMktAddr(e.target.value)}
                  style={inputStyle} placeholder="0x000000000000…" />
              </div>
              <div>
                <label style={labelStyle}>Name (optional)</label>
                <input type="text" value={mktName} onChange={e => setMktName(e.target.value)}
                  style={inputStyle} placeholder="e.g. OpenSea Seaport v1.6" />
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <span className="text-sm font-medium" style={{ color: "#374151" }}>Allow transfers</span>
                <Toggle value={mktEnabled} onChange={setMktEnabled} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid #e5e7eb" }}>
              <button onClick={() => { setShowAddMarket(false); setMktError(null); }}
                className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
                Cancel
              </button>
              <button onClick={handleSaveMarketplace} disabled={savingMkt}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: savingMkt ? "#9bafc5" : "#41afeb" }}>
                {savingMkt ? "Submitting tx…" : "Add On-Chain"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
