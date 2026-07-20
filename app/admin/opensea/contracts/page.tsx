"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContractInfo {
  address: string;
  chain: string;
  collection: string | null;
  name: string | null;
  tokenStandard: string | null;
  totalSupply: number | null;
  createdDate: string | null;
  ownerCount: number | null;
  [key: string]: unknown;
}

const CHAIN_OPTIONS = [
  "ethereum", "matic", "base", "solana", "arbitrum", "optimism", "avalanche", "bsc", "klaytn",
];

const CHAIN_COLORS: Record<string, { bg: string; text: string }> = {
  ethereum: { bg: "#e8f0fe", text: "#1a56db" },
  matic:    { bg: "#ede9fe", text: "#7c3aed" },
  polygon:  { bg: "#ede9fe", text: "#7c3aed" },
  base:     { bg: "#e0f2fe", text: "#0369a1" },
  solana:   { bg: "#d1fae5", text: "#065f46" },
  arbitrum: { bg: "#e0f9f1", text: "#047857" },
  optimism: { bg: "#fee2e2", text: "#dc2626" },
  avalanche:{ bg: "#fef3c7", text: "#b45309" },
  bsc:      { bg: "#fef9c3", text: "#854d0e" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" style={{ color: "#9bafc5" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid #f1f5f9" }}>
      <span className="text-xs" style={{ color: "#64748b" }}>{label}</span>
      <span className="text-xs font-semibold" style={{ color: "#1e293b" }}>{value ?? "—"}</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ContractsPage() {
  const [chain, setChain] = useState("ethereum");
  const [address, setAddress] = useState("");
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [rawJson, setRawJson] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const lookup = async () => {
    const addr = address.trim();
    if (!addr) return;
    setLoading(true);
    setErr("");
    setContract(null);
    setRawJson(null);
    try {
      const r = await fetch(
        `/api/opensea/Contracts/${encodeURIComponent(chain)}/${encodeURIComponent(addr)}`,
        { credentials: "include" }
      );
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErr(`Error ${r.status}: ${d.error ?? d.message ?? r.statusText}`);
        return;
      }
      const d = await r.json();
      setRawJson(d);
      setContract({
        address: d.address ?? addr,
        chain: d.chain ?? chain,
        collection: d.collection ?? null,
        name: d.name ?? d.collection_name ?? null,
        tokenStandard: d.schema_name ?? d.token_standard ?? null,
        totalSupply: d.total_supply != null ? Number(d.total_supply) : null,
        createdDate: d.created_date ?? null,
        ownerCount: d.owner_count != null ? Number(d.owner_count) : null,
        ...d,
      });
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(address.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const chainStyle = CHAIN_COLORS[chain.toLowerCase()] ?? { bg: "#f3f4f6", text: "#6b7280" };

  return (
    <div className="p-5 max-w-3xl">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Contract Lookup</h1>
        <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
          Look up any NFT contract on OpenSea by chain and contract address
        </p>
      </div>

      {/* Lookup card */}
      <div className="bg-white rounded-xl p-5 mb-5" style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div className="flex flex-wrap gap-3 mb-4">

          {/* Chain selector */}
          <div className="flex-shrink-0">
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "#94a3b8" }}>
              Chain
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CHAIN_OPTIONS.map(c => (
                <button
                  key={c}
                  onClick={() => setChain(c)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all capitalize"
                  style={
                    chain === c
                      ? { background: CHAIN_COLORS[c]?.text ?? "#24315f", color: "#fff" }
                      : { background: "#f1f5f9", color: "#64748b" }
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Address input + button */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="0x… contract address"
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") lookup(); }}
              className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl outline-none transition-all"
              style={{ border: "1.5px solid #e2e8f0", color: "#374151", background: "#f8fafc" }}
              onFocus={e => (e.target.style.borderColor = "#24315f")}
              onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
            />
          </div>
          <button
            onClick={lookup}
            disabled={loading || !address.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity"
            style={{ background: "linear-gradient(135deg,#24315f,#1e4a8a)", opacity: loading || !address.trim() ? 0.6 : 1 }}
          >
            {loading ? <Spinner /> : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            Look Up
          </button>
        </div>

        {/* Current chain display */}
        <div className="mt-2.5 flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "#94a3b8" }}>Looking up on:</span>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
            style={{ background: chainStyle.bg, color: chainStyle.text }}
          >
            {chain}
          </span>
        </div>
      </div>

      {/* Error */}
      {err && (
        <div className="mb-4 text-xs px-4 py-3 rounded-xl" style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca" }}>
          {err}
        </div>
      )}

      {/* Result */}
      {contract && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          {/* Result header */}
          <div
            className="px-5 py-4 flex items-center justify-between"
            style={{ background: "linear-gradient(135deg,#24315f 0%,#1e4a8a 100%)" }}
          >
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-sm font-bold text-white">{contract.name ?? "Unknown Contract"}</h2>
                {contract.tokenStandard && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}>
                    {contract.tokenStandard}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-mono truncate max-w-xs" style={{ color: "rgba(255,255,255,0.55)" }}>
                  {contract.address}
                </p>
                <button
                  onClick={copyAddress}
                  className="p-0.5 rounded"
                  style={{ color: copied ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.45)" }}
                  title="Copy address"
                >
                  {copied ? (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
            <a
              href={`https://opensea.io/assets/${contract.chain}/${contract.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold flex-shrink-0"
              style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on OpenSea
            </a>
          </div>

          {/* Info rows */}
          <div className="divide-y divide-gray-50">
            <StatRow label="Chain" value={
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
                style={{ background: chainStyle.bg, color: chainStyle.text }}>
                {contract.chain}
              </span>
            } />
            <StatRow label="Collection Slug" value={
              contract.collection
                ? <span className="font-mono text-[11px]" style={{ color: "#41afeb" }}>{contract.collection}</span>
                : "—"
            } />
            <StatRow label="Token Standard" value={contract.tokenStandard} />
            <StatRow label="Total Supply" value={contract.totalSupply != null ? contract.totalSupply.toLocaleString() : null} />
            <StatRow label="Owner Count" value={contract.ownerCount != null ? contract.ownerCount.toLocaleString() : null} />
            <StatRow label="Created" value={contract.createdDate ? new Date(contract.createdDate).toLocaleDateString() : null} />
          </div>

          {/* Raw JSON toggle */}
          <div className="px-5 py-3" style={{ borderTop: "1px solid #f1f5f9" }}>
            <button
              onClick={() => setShowRaw(v => !v)}
              className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
              style={{ color: showRaw ? "#24315f" : "#94a3b8" }}
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${showRaw ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {showRaw ? "Hide" : "Show"} raw JSON response
            </button>
            {showRaw && rawJson && (
              <pre
                className="mt-3 text-[10px] font-mono p-3 rounded-xl overflow-auto max-h-80"
                style={{ background: "#f8fafc", color: "#475569", border: "1px solid #f1f5f9" }}
              >
                {JSON.stringify(rawJson, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Idle state */}
      {!contract && !loading && !err && (
        <div className="text-center py-20">
          <div
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#eff6ff,#e0e7ff)" }}
          >
            <svg className="w-8 h-8" style={{ color: "#6366f1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold" style={{ color: "#64748b" }}>Contract Lookup</p>
          <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>
            Select a chain and enter a contract address to fetch its details
          </p>
        </div>
      )}
    </div>
  );
}
