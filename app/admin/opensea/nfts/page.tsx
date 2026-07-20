"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Nft {
  identifier: string;
  collectionSlug: string;
  contractAddress: string;
  chain: string;
  tokenStandard: string | null;
  name: string | null;
  imageUrl: string | null;
  isNsfw: boolean;
  isSuspicious: boolean;
}

interface NftDetail extends Nft {
  description?: string | null;
  metadataUrl?: string | null;
  traits?: { traitType: string; traitValue: string; displayType?: string | null }[];
}

type FilterMode = "collection" | "contract" | "account";

const PAGE_SIZE = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const truncAddr = (addr: string | null | undefined) =>
  addr && addr.length > 10 ? addr.slice(0, 6) + "…" + addr.slice(-4) : (addr ?? "—");

const CHAIN_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  matic:    { bg: "#ede9fe", color: "#7c3aed", label: "Polygon" },
  polygon:  { bg: "#ede9fe", color: "#7c3aed", label: "Polygon" },
  ethereum: { bg: "#dbeafe", color: "#2563eb", label: "Ethereum" },
  solana:   { bg: "#dcfce7", color: "#16a34a", label: "Solana" },
  base:     { bg: "#cffafe", color: "#0891b2", label: "Base" },
  arbitrum: { bg: "#fef3c7", color: "#d97706", label: "Arbitrum" },
  optimism: { bg: "#fee2e2", color: "#dc2626", label: "Optimism" },
};

function ChainBadge({ chain }: { chain: string }) {
  const s = CHAIN_BADGE[chain?.toLowerCase()] ?? { bg: "#f1f5f9", color: "#64748b", label: chain || "—" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function Spinner({ small }: { small?: boolean }) {
  return (
    <div className={`flex items-center justify-center ${small ? "py-4" : "py-12"}`}>
      <svg className={`${small ? "w-4 h-4" : "w-5 h-5"} animate-spin`} style={{ color: "#9bafc5" }} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

// ─── Modal Shell (professional, matching Collections page) ────────────────────

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl w-full flex flex-col"
        style={{
          maxWidth: wide ? 720 : 480,
          maxHeight: "90vh",
          boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
        }}
      >
        <div
          className="flex items-start justify-between px-6 py-4 flex-shrink-0 rounded-t-2xl"
          style={{ background: "linear-gradient(135deg,#24315f 0%,#1e4a8a 100%)" }}
        >
          <div>
            <h2 className="text-sm font-bold text-white">{title}</h2>
            {subtitle && (
              <p className="text-[11px] mt-0.5 font-mono" style={{ color: "rgba(255,255,255,0.55)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full transition-colors"
            style={{ color: "rgba(255,255,255,0.6)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1">{children}</div>
        <div
          className="px-6 py-3 flex items-center justify-end gap-2 flex-shrink-0 rounded-b-2xl"
          style={{ borderTop: "1px solid #f1f5f9" }}
        >
          {footer}
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ color: "#64748b", background: "#f1f5f9" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#e2e8f0")}
            onMouseLeave={e => (e.currentTarget.style.background = "#f1f5f9")}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sync Modal ───────────────────────────────────────────────────────────────

function SyncModal({ onClose }: { onClose: () => void }) {
  const [chain, setChain] = useState("matic");
  const [contract, setContract] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contract.trim() || !identifier.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch(
        `/api/opensea/Nfts/chain/${encodeURIComponent(chain)}/contract/${encodeURIComponent(contract.trim())}/${encodeURIComponent(identifier.trim())}/sync`,
        { method: "POST", credentials: "include" }
      );
      const ok = r.ok;
      let msg = ok ? "Sync successful." : "Sync failed.";
      try {
        const d = await r.json();
        if (d?.message) msg = d.message;
        else if (d?.error) msg = d.error;
      } catch { /* ignore */ }
      setResult({ ok, msg });
    } catch {
      setResult({ ok: false, msg: "Network error." });
    } finally {
      setLoading(false);
    }
  };

  const CHAINS = ["matic", "ethereum", "polygon", "arbitrum", "optimism", "base", "avalanche", "solana"];

  return (
    <ModalShell
      title="Sync NFT"
      subtitle="Fetches individual NFT data from OpenSea and caches it"
      onClose={onClose}
      footer={
        <button
          form="sync-nft-form"
          type="submit"
          disabled={loading || !contract.trim() || !identifier.trim()}
          className="px-5 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity"
          style={{ background: "linear-gradient(135deg,#24315f,#1e4a8a)", opacity: loading || !contract.trim() || !identifier.trim() ? 0.5 : 1 }}
        >
          {loading ? "Syncing…" : "Sync"}
        </button>
      }
    >
      <form id="sync-nft-form" onSubmit={submit} className="px-6 py-5 space-y-4">
        {result && (
          <div
            className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl"
            style={{
              background: result.ok ? "#f0fdf4" : "#fff5f5",
              color: result.ok ? "#15803d" : "#dc2626",
              border: `1px solid ${result.ok ? "#bbf7d0" : "#fecaca"}`,
            }}
          >
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              {result.ok
                ? <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                : <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 102 0V5zm-1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />}
            </svg>
            {result.msg}
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Chain</label>
          <select
            value={chain}
            onChange={e => setChain(e.target.value)}
            className="w-full text-xs px-3.5 py-2 rounded-xl border outline-none bg-white"
            style={{ border: "1.5px solid #e2e8f0", color: "#374151" }}
          >
            {CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Contract Address</label>
          <input
            required
            value={contract}
            onChange={e => setContract(e.target.value)}
            placeholder="0x…"
            className="w-full text-xs px-3.5 py-2 rounded-xl outline-none font-mono"
            style={{ border: "1.5px solid #e2e8f0", color: "#374151", background: "#f8fafc" }}
            onFocus={e => (e.target.style.borderColor = "#24315f")}
            onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>Token ID</label>
          <input
            required
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            placeholder="e.g. 1"
            className="w-full text-xs px-3.5 py-2 rounded-xl outline-none"
            style={{ border: "1.5px solid #e2e8f0", color: "#374151", background: "#f8fafc" }}
            onFocus={e => (e.target.style.borderColor = "#24315f")}
            onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
          />
        </div>
      </form>
    </ModalShell>
  );
}

// ─── NFT Detail Modal ─────────────────────────────────────────────────────────

function NftDetailModal({ nft, onClose }: { nft: Nft; onClose: () => void }) {
  const [detail, setDetail] = useState<NftDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(
      `/api/opensea/Nfts/chain/${encodeURIComponent(nft.chain)}/contract/${encodeURIComponent(nft.contractAddress)}/${encodeURIComponent(nft.identifier)}`,
      { credentials: "include" }
    )
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d) setDetail(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [nft]);

  const d = detail ?? nft;
  const displayName = d.name ?? `#${nft.identifier}`;

  return (
    <ModalShell
      title={displayName}
      subtitle={`${nft.collectionSlug} · ${truncAddr(nft.contractAddress)} / ${nft.identifier}`}
      onClose={onClose}
      wide
    >
      {loading && <Spinner small />}

      <div className="px-6 py-5 space-y-5">
        {/* Image + core info */}
        <div className="flex gap-5">
          {/* Image */}
          <div
            className="flex-shrink-0 rounded-xl overflow-hidden"
            style={{ width: 140, height: 140, background: "#f1f5f9", border: "1px solid #e2e8f0" }}
          >
            {d.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={d.imageUrl}
                alt={displayName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={e => { e.currentTarget.style.display = "none"; }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ color: "#cbd5e1" }}>
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Fields */}
          <div className="flex-1 min-w-0 space-y-0">
            {([
              ["Collection", d.collectionSlug],
              ["Chain",      d.chain],
              ["Contract",   d.contractAddress],
              ["Token ID",   d.identifier],
              ["Standard",   d.tokenStandard ?? "—"],
              ["Status",     ""],
            ] as [string, string][]).map(([label, val], i) => (
              <div
                key={label}
                className="flex items-center gap-3 py-2"
                style={{ borderBottom: i < 5 ? "1px solid #f1f5f9" : "none" }}
              >
                <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: "#94a3b8", width: 76 }}>
                  {label}
                </span>
                {label === "Chain" ? (
                  <ChainBadge chain={val} />
                ) : label === "Status" ? (
                  d.isSuspicious ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#fee2e2", color: "#dc2626" }}>Suspicious</span>
                  ) : d.isNsfw ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#fef3c7", color: "#d97706" }}>NSFW</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#dcfce7", color: "#16a34a" }}>Safe</span>
                  )
                ) : (
                  <span
                    className={`text-xs break-all ${label === "Contract" ? "font-mono" : ""}`}
                    style={{ color: label === "Contract" ? "#41afeb" : "#1e293b" }}
                  >
                    {val}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        {detail?.description && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "#94a3b8" }}>Description</p>
            <p className="text-xs leading-relaxed" style={{ color: "#475569" }}>{detail.description}</p>
          </div>
        )}

        {/* Metadata URL */}
        {detail?.metadataUrl && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "#94a3b8" }}>Metadata URL</p>
            <a
              href={detail.metadataUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs break-all hover:underline"
              style={{ color: "#41afeb" }}
            >
              {detail.metadataUrl}
            </a>
          </div>
        )}

        {/* Traits */}
        {detail?.traits && detail.traits.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-3" style={{ color: "#94a3b8" }}>
              Traits <span style={{ color: "#cbd5e1" }}>· {detail.traits.length}</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {detail.traits.map((t, i) => (
                <div
                  key={i}
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
                >
                  <p className="text-[9px] font-bold uppercase tracking-wider truncate" style={{ color: "#94a3b8" }}>
                    {t.traitType}
                  </p>
                  <p className="text-xs font-semibold mt-1 truncate" style={{ color: "#1e293b" }}>
                    {t.traitValue}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ─── NFT Analytics Modal ──────────────────────────────────────────────────────

function NftAnalyticsModal({
  chain,
  contractAddress,
  identifier,
  onClose,
}: {
  chain: string;
  contractAddress: string;
  identifier: string;
  onClose: () => void;
}) {
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(
      `/api/opensea/Nfts/chain/${encodeURIComponent(chain)}/contract/${encodeURIComponent(contractAddress)}/${encodeURIComponent(identifier)}/analytics`,
      { credentials: "include" }
    )
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => { setAnalytics(d); setLoading(false); })
      .catch(e => { setErr(`Failed to load analytics (${e})`); setLoading(false); });
  }, [chain, contractAddress, identifier]);

  const fmtVal = (v: unknown) => {
    if (v == null) return "—";
    if (typeof v === "number") return v.toLocaleString();
    return String(v);
  };

  const statRows: [string, unknown][] = analytics
    ? [
        ["Sales", analytics.sales ?? analytics.salesCount ?? analytics.numSales],
        ["Volume", analytics.volume ?? analytics.totalVolume],
        ["Floor Price", analytics.floorPrice ?? analytics.floor_price],
        ["Average Price", analytics.averagePrice ?? analytics.average_price ?? analytics.avgPrice],
        ["Num Owners", analytics.numOwners ?? analytics.owners ?? analytics.ownerCount],
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-xl w-full flex flex-col"
        style={{
          maxWidth: 400,
          maxHeight: "90vh",
          boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-5 py-4 rounded-t-xl flex-shrink-0"
          style={{ background: "linear-gradient(135deg,#24315f 0%,#1e4a8a 100%)" }}
        >
          <div>
            <h2 className="text-sm font-bold text-white">NFT Analytics</h2>
            <p className="text-[11px] mt-0.5 font-mono" style={{ color: "rgba(255,255,255,0.55)" }}>
              #{identifier}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full transition-colors"
            style={{ color: "rgba(255,255,255,0.6)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.12)")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {loading && <Spinner small />}
          {!loading && err && (
            <p className="text-xs px-3 py-2 rounded" style={{ background: "#fee2e2", color: "#dc2626" }}>{err}</p>
          )}
          {!loading && !err && analytics && (
            <div className="divide-y" style={{ borderColor: "#f1f5f9" }}>
              {statRows.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-2.5">
                  <span className="text-xs font-semibold" style={{ color: "#64748b" }}>{label}</span>
                  <span className="text-xs font-bold" style={{ color: "#1e293b" }}>{fmtVal(value)}</span>
                </div>
              ))}
            </div>
          )}
          {!loading && !err && !analytics && (
            <p className="text-xs text-center py-6" style={{ color: "#94a3b8" }}>No analytics available.</p>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 py-3 flex justify-end rounded-b-xl flex-shrink-0"
          style={{ borderTop: "1px solid #f1f5f9" }}
        >
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ color: "#64748b", background: "#f1f5f9" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#e2e8f0")}
            onMouseLeave={e => (e.currentTarget.style.background = "#f1f5f9")}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({
  mode,
  setMode,
  onFetch,
  onSyncAll,
  loading,
  syncingAll,
  initialSlug,
  initialAccount,
  initialChain,
}: {
  mode: FilterMode;
  setMode: (m: FilterMode) => void;
  onFetch: (url: string) => void;
  onSyncAll: (slug: string) => void;
  loading: boolean;
  syncingAll: boolean;
  initialSlug?: string;
  initialAccount?: string;
  initialChain?: string;
}) {
  const [colSlug, setColSlug] = useState(initialSlug ?? "");
  const [conChain, setConChain] = useState("matic");
  const [conAddress, setConAddress] = useState("");
  const [accAddress, setAccAddress] = useState(initialAccount ?? "");
  const [accChain, setAccChain] = useState(initialChain ?? "");

  const CHAINS = ["matic", "ethereum", "polygon", "arbitrum", "optimism", "base", "avalanche", "solana"];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "collection" && colSlug.trim())
      onFetch(`/api/opensea/Nfts/collection/${encodeURIComponent(colSlug.trim())}`);
    else if (mode === "contract" && conAddress.trim())
      onFetch(`/api/opensea/Nfts/chain/${encodeURIComponent(conChain)}/contract/${encodeURIComponent(conAddress.trim())}`);
    else if (mode === "account" && accAddress.trim()) {
      const chain = accChain.trim();
      onFetch(`/api/opensea/Nfts/account/${encodeURIComponent(accAddress.trim())}${chain ? `?chain=${encodeURIComponent(chain)}` : ""}`);
    }
  };

  const inputCls = "w-full text-xs px-3 py-1.5 rounded-lg outline-none transition-all";
  const inputStyle = { border: "1.5px solid #e2e8f0", color: "#374151", background: "#f8fafc" };

  return (
    <form
      onSubmit={submit}
      className="bg-white rounded-xl px-4 py-3 mb-4 flex flex-wrap items-end gap-3"
      style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
    >
      {/* Mode tabs */}
      <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid #e2e8f0" }}>
        {(["collection", "contract", "account"] as FilterMode[]).map((m, idx) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
            style={{
              background: mode === m ? "#24315f" : "#f8fafc",
              color: mode === m ? "#fff" : "#64748b",
              borderRight: idx < 2 ? "1px solid #e2e8f0" : undefined,
            }}
          >
            {m === "collection" ? "By Collection" : m === "contract" ? "By Contract" : "By Account"}
          </button>
        ))}
      </div>

      {mode === "collection" && (
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] font-semibold mb-1" style={{ color: "#64748b" }}>Collection Slug</label>
          <input
            value={colSlug}
            onChange={e => setColSlug(e.target.value)}
            placeholder="e.g. boredapeyachtclub"
            className={inputCls}
            style={inputStyle}
            onFocus={e => (e.target.style.borderColor = "#24315f")}
            onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
          />
        </div>
      )}

      {mode === "contract" && (
        <>
          <div style={{ minWidth: 130 }}>
            <label className="block text-[10px] font-semibold mb-1" style={{ color: "#64748b" }}>Chain</label>
            <select
              value={conChain}
              onChange={e => setConChain(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg border outline-none bg-white"
              style={{ border: "1.5px solid #e2e8f0", color: "#374151" }}
            >
              {CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-semibold mb-1" style={{ color: "#64748b" }}>Contract Address</label>
            <input
              value={conAddress}
              onChange={e => setConAddress(e.target.value)}
              placeholder="0x…"
              className={`${inputCls} font-mono`}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = "#24315f")}
              onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
            />
          </div>
        </>
      )}

      {mode === "account" && (
        <>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[10px] font-semibold mb-1" style={{ color: "#64748b" }}>Account Address</label>
            <input
              value={accAddress}
              onChange={e => setAccAddress(e.target.value)}
              placeholder="0x…"
              className={`${inputCls} font-mono`}
              style={inputStyle}
              onFocus={e => (e.target.style.borderColor = "#24315f")}
              onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
            />
          </div>
          <div style={{ minWidth: 130 }}>
            <label className="block text-[10px] font-semibold mb-1" style={{ color: "#64748b" }}>Chain (optional)</label>
            <select
              value={accChain}
              onChange={e => setAccChain(e.target.value)}
              className="w-full text-xs px-3 py-1.5 rounded-lg border outline-none bg-white"
              style={{ border: "1.5px solid #e2e8f0", color: "#374151" }}
            >
              <option value="">All chains</option>
              {CHAINS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={loading || syncingAll}
        className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white flex-shrink-0 transition-opacity"
        style={{ background: "linear-gradient(135deg,#24315f,#1e4a8a)", opacity: (loading || syncingAll) ? 0.6 : 1 }}
      >
        {loading ? "Loading…" : "Fetch"}
      </button>

      {mode === "collection" && (
        <button
          type="button"
          disabled={loading || syncingAll || !colSlug.trim()}
          onClick={() => colSlug.trim() && onSyncAll(colSlug.trim())}
          className="px-4 py-1.5 rounded-lg text-xs font-semibold flex-shrink-0 transition-opacity flex items-center gap-1.5"
          style={{
            background: "#f8fafc", color: "#64748b", border: "1.5px solid #e2e8f0",
            opacity: (loading || syncingAll || !colSlug.trim()) ? 0.6 : 1,
          }}
          title="Re-fetch all NFTs from OpenSea API and update local cache. Only needed when collection data is outdated or not yet synced."
        >
          {syncingAll ? (
            <>
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Syncing…
            </>
          ) : (
            <>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Re-sync from OpenSea
            </>
          )}
        </button>
      )}
    </form>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function pageRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const delta = 2;
  const items: (number | "…")[] = [1];
  const lo = Math.max(2, current - delta);
  const hi = Math.min(total - 1, current + delta);
  if (lo > 2) items.push("…");
  for (let p = lo; p <= hi; p++) items.push(p);
  if (hi < total - 1) items.push("…");
  items.push(total);
  return items;
}

function Pagination({ total, page, pageSize, onChange }: {
  total: number; page: number; pageSize: number; onChange: (p: number) => void;
}) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;
  const items = pageRange(page, totalPages);
  const btnBase = "h-7 min-w-[28px] px-1.5 rounded-lg text-xs font-semibold transition-colors";
  return (
    <div className="flex items-center justify-between px-4 py-2.5" style={{ borderTop: "1px solid #f1f5f9" }}>
      <span className="text-[11px]" style={{ color: "#94a3b8" }}>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className={btnBase}
          style={{ background: page === 1 ? "#f8fafc" : "#fff", color: page === 1 ? "#cbd5e1" : "#374151", border: "1px solid #e2e8f0" }}
        >
          ‹
        </button>
        {items.map((item, i) =>
          item === "…" ? (
            <span key={`e${i}`} className="w-6 text-center text-xs" style={{ color: "#94a3b8" }}>…</span>
          ) : (
            <button
              key={item}
              onClick={() => onChange(item as number)}
              className={btnBase}
              style={{
                background: item === page ? "#24315f" : "#fff",
                color: item === page ? "#fff" : "#64748b",
                border: "1px solid #e2e8f0",
              }}
            >
              {item}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className={btnBase}
          style={{ background: page === totalPages ? "#f8fafc" : "#fff", color: page === totalPages ? "#cbd5e1" : "#374151", border: "1px solid #e2e8f0" }}
        >
          ›
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function NftsPageContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<FilterMode>("collection");
  const [nfts, setNfts] = useState<Nft[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [fetched, setFetched] = useState(false);
  const [page, setPage] = useState(1);
  const [showSync, setShowSync] = useState(false);
  const [detailNft, setDetailNft] = useState<Nft | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllMsg, setSyncAllMsg] = useState("");
  const [analyticsModal, setAnalyticsModal] = useState<{ chain: string; contractAddress: string; identifier: string } | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [refreshMsg, setRefreshMsg] = useState<{ key: string; ok: boolean } | null>(null);

  const handleModeChange = (m: FilterMode) => {
    setMode(m);
    setNfts([]);
    setErr("");
    setFetched(false);
    setPage(1);
  };

  const fetchNfts = (url: string) => {
    const isCollection = url.includes("/Nfts/collection/");
    setLoading(true);
    setErr("");
    setNfts([]);
    setFetched(false);
    setPage(1);

    const batchUrl = url;

    (async () => {
      try {
        let all: Nft[] = [];
        let nextFetch: string | null = batchUrl;

        while (nextFetch) {
          const r = await fetch(nextFetch, { credentials: "include" });
          if (!r.ok) throw new Error(r.statusText);
          const d = await r.json();
          const batch: Nft[] = d?.data ?? d?.nfts ?? (Array.isArray(d) ? d : []);
          all = [...all, ...batch];
          const cursor: string | null = d?.next ?? null;

          if (isCollection && cursor?.startsWith("db:")) {
            setNfts([...all]); // Show progress as DB pages stream in
            const u = new URL(batchUrl, window.location.origin);
            u.searchParams.set("next", cursor);
            nextFetch = u.toString();
          } else {
            nextFetch = null;
          }
        }

        setNfts(all);
        setFetched(true);
      } catch (e) {
        setErr(String(e));
        setFetched(true);
      } finally {
        setLoading(false);
      }
    })();
  };

  // Auto-fetch when navigated here with ?collection=slug or ?account=address
  useEffect(() => {
    const slug = searchParams.get("collection");
    const account = searchParams.get("account");
    const chain = searchParams.get("chain");
    if (slug) {
      fetchNfts(`/api/opensea/Nfts/collection/${encodeURIComponent(slug)}`);
    } else if (account) {
      setMode("account");
      const chainParam = chain ? `?chain=${encodeURIComponent(chain)}` : "";
      fetchNfts(`/api/opensea/Nfts/account/${encodeURIComponent(account)}${chainParam}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSyncAll = async (slug: string) => {
    setSyncingAll(true);
    setSyncAllMsg("");
    try {
      const r = await fetch(
        `/api/opensea/Nfts/collection/${encodeURIComponent(slug)}/sync-all`,
        { method: "POST", credentials: "include" }
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setSyncAllMsg(`Error: ${d.message ?? d.error ?? r.status}`); return; }
      setSyncAllMsg(`${d.message ?? `Synced ${d.synced} NFTs`} — loading all from cache…`);
      fetchNfts(`/api/opensea/Nfts/collection/${encodeURIComponent(slug)}`);
    } catch (e) {
      setSyncAllMsg(`Error: ${String(e)}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleRefresh = async (chain: string, contractAddress: string, identifier: string) => {
    const key = `${chain}:${contractAddress}:${identifier}`;
    setRefreshing(key);
    setRefreshMsg(null);
    try {
      const r = await fetch(
        `/api/opensea/Nfts/chain/${encodeURIComponent(chain)}/contract/${encodeURIComponent(contractAddress)}/${encodeURIComponent(identifier)}/refresh`,
        { method: "POST", credentials: "include" }
      );
      setRefreshMsg({ key, ok: r.ok });
      setTimeout(() => setRefreshMsg(null), 3000);
    } finally {
      setRefreshing(null);
    }
  };

  const paged = nfts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-bold" style={{ color: "#24315f" }}>NFTs</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Browse and sync NFTs from OpenSea</p>
        </div>
        <button
          onClick={() => setShowSync(true)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#24315f,#1e4a8a)" }}
        >
          Sync NFT
        </button>
      </div>

      {/* Filter bar */}
      <FilterBar
        mode={mode}
        setMode={handleModeChange}
        onFetch={fetchNfts}
        onSyncAll={handleSyncAll}
        loading={loading}
        syncingAll={syncingAll}
        initialSlug={searchParams.get("collection") ?? undefined}
        initialAccount={searchParams.get("account") ?? undefined}
        initialChain={searchParams.get("chain") ?? undefined}
      />

      {/* Sync All status */}
      {syncingAll && (
        <div className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl mb-4" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
          <svg className="w-3.5 h-3.5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Syncing all NFTs from OpenSea — may take several minutes for large collections…
        </div>
      )}
      {!syncingAll && syncAllMsg && (
        <div className="text-xs px-4 py-2.5 rounded-xl mb-4" style={{ background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0" }}>
          {syncAllMsg}
        </div>
      )}

      {/* Error */}
      {err && (
        <div className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl mb-4" style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca" }}>
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 102 0V5zm-1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {err}
        </div>
      )}

      {loading && <Spinner />}

      {/* Table */}
      {!loading && fetched && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
            <span className="text-xs font-bold" style={{ color: "#24315f" }}>NFTs</span>
            {nfts.length > 0 && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#e2e8f0", color: "#64748b" }}>
                {nfts.length} result{nfts.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  {["NFT", "Chain", "Contract", "Standard", "Status", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold whitespace-nowrap" style={{ color: "#64748b" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paged.map((nft, i) => (
                  <tr
                    key={`${nft.contractAddress}-${nft.identifier}-${i}`}
                    className="transition-colors"
                    style={{ borderBottom: "1px solid #f8fafc", cursor: "pointer" }}
                    onClick={() => setDetailNft(nft)}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    {/* NFT column: image + name + ID */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex-shrink-0 rounded-xl overflow-hidden"
                          style={{ width: 52, height: 52, background: "#f1f5f9", border: "1px solid #e2e8f0" }}
                        >
                          {nft.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={nft.imageUrl}
                              alt={nft.name ?? ""}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              onError={e => { e.currentTarget.style.display = "none"; }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ color: "#cbd5e1" }}>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate" style={{ color: "#1e293b", maxWidth: 160 }}>
                            {nft.name ?? `#${nft.identifier}`}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3"><ChainBadge chain={nft.chain} /></td>

                    <td className="px-4 py-3 font-mono text-[11px]" style={{ color: "#41afeb" }}>
                      {truncAddr(nft.contractAddress)}
                    </td>

                    <td className="px-4 py-3" style={{ color: "#64748b" }}>
                      {nft.tokenStandard ?? "—"}
                    </td>

                    <td className="px-4 py-3">
                      {nft.isSuspicious ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#fee2e2", color: "#dc2626" }}>Suspicious</span>
                      ) : nft.isNsfw ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#fef3c7", color: "#d97706" }}>NSFW</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#dcfce7", color: "#16a34a" }}>Safe</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={e => { e.stopPropagation(); setDetailNft(nft); }}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all"
                          style={{ background: "#eff6ff", color: "#1d4ed8" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#1d4ed8"; e.currentTarget.style.color = "#fff"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.color = "#1d4ed8"; }}
                        >
                          View
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setAnalyticsModal({ chain: nft.chain, contractAddress: nft.contractAddress, identifier: nft.identifier }); }}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all"
                          style={{ background: "#eff6ff", color: "#1d4ed8" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#1d4ed8"; e.currentTarget.style.color = "#fff"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.color = "#1d4ed8"; }}
                        >
                          Analytics
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleRefresh(nft.chain, nft.contractAddress, nft.identifier); }}
                          disabled={refreshing === `${nft.chain}:${nft.contractAddress}:${nft.identifier}`}
                          title="Refresh Metadata"
                          className="px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all"
                          style={{
                            background: "#f0fdf4",
                            color: "#15803d",
                            opacity: refreshing === `${nft.chain}:${nft.contractAddress}:${nft.identifier}` ? 0.5 : 1,
                          }}
                          onMouseEnter={e => { if (refreshing !== `${nft.chain}:${nft.contractAddress}:${nft.identifier}`) { e.currentTarget.style.background = "#15803d"; e.currentTarget.style.color = "#fff"; } }}
                          onMouseLeave={e => { e.currentTarget.style.background = "#f0fdf4"; e.currentTarget.style.color = "#15803d"; }}
                        >
                          {refreshing === `${nft.chain}:${nft.contractAddress}:${nft.identifier}` ? "…" : "Refresh"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {nfts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-xs" style={{ color: "#94a3b8" }}>
                      No NFTs found. Try a different collection or contract.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <Pagination total={nfts.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
        </div>
      )}

      {/* Empty initial state */}
      {!loading && !fetched && !err && (
        <div
          className="bg-white rounded-xl flex flex-col items-center justify-center py-16 gap-3"
          style={{ border: "1px solid #e2e8f0" }}
        >
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: "#f1f5f9" }}>
            <svg className="w-6 h-6" style={{ color: "#94a3b8" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm font-semibold" style={{ color: "#64748b" }}>No NFTs loaded</p>
          <p className="text-xs" style={{ color: "#94a3b8" }}>Use the filter bar above to fetch NFTs by collection, contract, or account</p>
        </div>
      )}

      {showSync && <SyncModal onClose={() => setShowSync(false)} />}
      {detailNft && <NftDetailModal nft={detailNft} onClose={() => setDetailNft(null)} />}
      {analyticsModal && (
        <NftAnalyticsModal
          chain={analyticsModal.chain}
          contractAddress={analyticsModal.contractAddress}
          identifier={analyticsModal.identifier}
          onClose={() => setAnalyticsModal(null)}
        />
      )}
      {refreshMsg && (
        <div
          className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg text-xs font-semibold text-white"
          style={{ background: refreshMsg.ok ? "#15803d" : "#dc2626" }}
        >
          {refreshMsg.ok ? "Metadata refresh triggered" : "Refresh failed"}
        </div>
      )}
    </div>
  );
}

export default function NftsPage() {
  return (
    <Suspense>
      <NftsPageContent />
    </Suspense>
  );
}
