"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollectionFee {
  fee: number;
  recipient: string;
  required: boolean;
}

interface Collection {
  slug: string;
  name: string;
  chain: string;
  category: string | null;
  syncedAt: string | null;
  imageUrl?: string | null;
  fees?: CollectionFee[] | null;
  owner?: string | null;
}

interface CollectionStats {
  collectionSlug: string;
  floorPrice: number | null;
  floorPriceCurrency: string | null;
  totalVolume: number | null;
  numOwners: number | null;
  totalSupply: number | null;
  marketCap: number | null;
  oneDayVolume: number | null;
  sevenDayVolume: number | null;
  thirtyDayVolume: number | null;
  oneDaySales: number | null;
  sevenDaySales: number | null;
  thirtyDaySales: number | null;
}

interface Trait {
  traitType: string;
  traitValue: string;
  count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (s: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

const fmtNum = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString(undefined, { maximumFractionDigits: 4 });

const CHAIN_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ethereum: { bg: "#e8f0fe", text: "#1a56db", label: "Ethereum" },
  matic:    { bg: "#ede9fe", text: "#7c3aed", label: "Polygon" },
  polygon:  { bg: "#ede9fe", text: "#7c3aed", label: "Polygon" },
  solana:   { bg: "#d1fae5", text: "#065f46", label: "Solana" },
  base:     { bg: "#e0f2fe", text: "#0369a1", label: "Base" },
  arbitrum: { bg: "#e0f9f1", text: "#047857", label: "Arbitrum" },
};

function ChainBadge({ chain }: { chain: string }) {
  const c = CHAIN_COLORS[chain?.toLowerCase()] ?? { bg: "#f3f4f6", text: "#6b7280", label: chain };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

function CategoryBadge({ cat }: { cat: string | null }) {
  if (!cat) return <span style={{ color: "#cbd5e1" }}>—</span>;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium capitalize"
      style={{ background: "#f0f4ff", color: "#4f46e5" }}
    >
      {cat}
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

// ─── Modal Shell ──────────────────────────────────────────────────────────────

function ModalShell({
  title,
  subtitle,
  badge,
  onClose,
  children,
  footer,
  wide,
  extraWide,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  extraWide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-2xl w-full flex flex-col"
        style={{
          maxWidth: extraWide ? 860 : wide ? 680 : 480,
          maxHeight: "90vh",
          boxShadow: "0 24px 80px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-6 py-4 flex-shrink-0 rounded-t-2xl"
          style={{ background: "linear-gradient(135deg,#24315f 0%,#1e4a8a 100%)", borderBottom: "none" }}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-white">{title}</h2>
              {badge}
            </div>
            {subtitle && (
              <p className="text-[11px] mt-0.5 font-mono truncate" style={{ color: "rgba(255,255,255,0.55)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-3 flex-shrink-0 p-1 rounded-full transition-colors"
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
        <div className="overflow-y-auto flex-1">{children}</div>

        {/* Footer */}
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

function SyncModal({ onClose }: { onClose: (refreshed: boolean) => void }) {
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slug.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch(`/api/opensea/Collections/${encodeURIComponent(slug.trim())}/sync`, {
        method: "POST",
        credentials: "include",
      });
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

  return (
    <ModalShell
      title="Sync Collection"
      subtitle="Fetch collection data from OpenSea and cache it locally"
      onClose={() => onClose(result?.ok ?? false)}
      footer={
        <button
          form="sync-form"
          type="submit"
          disabled={loading || !slug.trim()}
          className="px-5 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity"
          style={{ background: "linear-gradient(135deg,#24315f,#1e4a8a)", opacity: loading || !slug.trim() ? 0.5 : 1 }}
        >
          {loading ? "Syncing…" : "Sync"}
        </button>
      }
    >
      <form id="sync-form" onSubmit={submit} className="px-6 py-5 space-y-4">
        {result && (
          <div
            className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl"
            style={{ background: result.ok ? "#f0fdf4" : "#fff5f5", color: result.ok ? "#15803d" : "#dc2626", border: `1px solid ${result.ok ? "#bbf7d0" : "#fecaca"}` }}
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
          <label className="block text-xs font-semibold mb-1.5" style={{ color: "#374151" }}>
            Collection Slug
          </label>
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. boredapeyachtclub"
            className="w-full text-xs px-3.5 py-2 rounded-xl outline-none transition-all"
            style={{ border: "1.5px solid #e2e8f0", color: "#374151", background: "#f8fafc" }}
            onFocus={e => (e.target.style.borderColor = "#24315f")}
            onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
          />
          <p className="text-[10px] mt-1.5" style={{ color: "#94a3b8" }}>
            Find the slug in the collection&apos;s OpenSea URL, e.g. opensea.io/collection/<strong>boredapeyachtclub</strong>
          </p>
        </div>
      </form>
    </ModalShell>
  );
}

// ─── Stats Modal ──────────────────────────────────────────────────────────────

function StatsModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/opensea/Collections/${encodeURIComponent(slug)}/stats`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => { setStats(d); setLoading(false); })
      .catch((e) => { setErr(String(e)); setLoading(false); });
  }, [slug]);

  const groups: { label: string; rows: [string, React.ReactNode][] }[] = stats
    ? [
        {
          label: "Market Overview",
          rows: [
            ["Floor Price", stats.floorPrice != null ? `${fmtNum(stats.floorPrice)} ${stats.floorPriceCurrency ?? ""}`.trim() : "—"],
            ["Market Cap",  fmtNum(stats.marketCap)],
            ["Total Supply", fmtNum(stats.totalSupply)],
            ["Total Owners", fmtNum(stats.numOwners)],
            ["Total Volume", fmtNum(stats.totalVolume)],
          ],
        },
        {
          label: "1-Day Activity",
          rows: [
            ["Volume",  fmtNum(stats.oneDayVolume)],
            ["Sales",   fmtNum(stats.oneDaySales)],
          ],
        },
        {
          label: "7-Day Activity",
          rows: [
            ["Volume",  fmtNum(stats.sevenDayVolume)],
            ["Sales",   fmtNum(stats.sevenDaySales)],
          ],
        },
        {
          label: "30-Day Activity",
          rows: [
            ["Volume",  fmtNum(stats.thirtyDayVolume)],
            ["Sales",   fmtNum(stats.thirtyDaySales)],
          ],
        },
      ]
    : [];

  return (
    <ModalShell title="Collection Stats" subtitle={slug} onClose={onClose}>
      <div className="px-6 py-5">
        {loading && <Spinner />}
        {err && (
          <div className="text-xs px-4 py-3 rounded-xl" style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca" }}>
            {err}
          </div>
        )}
        {stats && (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.label}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "#94a3b8" }}>
                  {g.label}
                </p>
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
                  {g.rows.map(([label, val], i) => (
                    <div
                      key={label}
                      className="flex items-center justify-between px-4 py-2.5"
                      style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd", borderBottom: i < g.rows.length - 1 ? "1px solid #f1f5f9" : "none" }}
                    >
                      <span className="text-xs" style={{ color: "#64748b" }}>{label}</span>
                      <span className="text-xs font-bold" style={{ color: "#1e293b" }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ─── Traits Modal ─────────────────────────────────────────────────────────────

function TraitsModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const router = useRouter();
  const [traits, setTraits] = useState<Trait[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/opensea/Collections/${encodeURIComponent(slug)}/traits`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => { setTraits(Array.isArray(d) ? d : []); setLoading(false); })
      .catch((e) => { setErr(String(e)); setLoading(false); });
  }, [slug]);

  const traitTypes = Array.from(new Set(traits.map((t) => t.traitType)));
  const maxCount = traits.reduce((m, t) => Math.max(m, t.count), 0);

  const filtered = traits.filter((t) => {
    const matchType = !activeType || t.traitType === activeType;
    const matchSearch =
      !search ||
      t.traitType.toLowerCase().includes(search.toLowerCase()) ||
      t.traitValue.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const handleCountClick = (t: Trait) => {
    onClose();
    router.push(`/admin/opensea/nfts?collection=${encodeURIComponent(slug)}`);
  };

  const rarityColor = (count: number) => {
    const pct = maxCount > 0 ? count / maxCount : 0;
    if (pct >= 0.8) return "#2563eb";
    if (pct >= 0.5) return "#0891b2";
    if (pct >= 0.25) return "#7c3aed";
    return "#dc2626";
  };

  const rarityLabel = (count: number) => {
    const pct = maxCount > 0 ? count / maxCount : 0;
    if (pct >= 0.8) return "Common";
    if (pct >= 0.5) return "Uncommon";
    if (pct >= 0.25) return "Rare";
    return "Legendary";
  };

  return (
    <ModalShell
      title="Collection Traits"
      subtitle={slug}
      badge={
        !loading && traits.length > 0 ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}>
            {traits.length.toLocaleString()} traits · {traitTypes.length} types
          </span>
        ) : undefined
      }
      onClose={onClose}
      extraWide
    >
      {loading && <Spinner />}
      {err && (
        <div className="mx-6 mt-4 text-xs px-4 py-3 rounded-xl" style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca" }}>
          {err}
        </div>
      )}

      {!loading && !err && (
        <>
          {/* Filter bar + type pills */}
          <div className="px-6 pt-4 pb-3 space-y-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#94a3b8" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search trait type or value…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl outline-none transition-all"
                style={{ border: "1.5px solid #e2e8f0", color: "#374151", background: "#f8fafc" }}
                onFocus={e => (e.target.style.borderColor = "#24315f")}
                onBlur={e => (e.target.style.borderColor = "#e2e8f0")}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveType(null)}
                className="px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors"
                style={{
                  background: activeType === null ? "#24315f" : "#f1f5f9",
                  color: activeType === null ? "#fff" : "#64748b",
                }}
              >
                All
              </button>
              {traitTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveType(activeType === type ? null : type)}
                  className="px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors"
                  style={{
                    background: activeType === type ? "#4f46e5" : "#f1f5f9",
                    color: activeType === type ? "#fff" : "#64748b",
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th className="text-left px-6 py-2.5 font-semibold" style={{ color: "#64748b" }}>Trait Type</th>
                <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Value</th>
                <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Rarity</th>
                <th className="text-right px-6 py-2.5 font-semibold" style={{ color: "#64748b" }}>Count</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr
                  key={i}
                  className="group transition-colors"
                  style={{ borderBottom: "1px solid #f8fafc" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="px-6 py-2.5">
                    <span className="font-semibold" style={{ color: "#1e293b" }}>{t.traitType}</span>
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "#475569" }}>{t.traitValue}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: "#f1f5f9", maxWidth: 80 }}>
                        <div
                          className="h-1.5 rounded-full transition-all"
                          style={{
                            width: `${maxCount > 0 ? (t.count / maxCount) * 100 : 0}%`,
                            background: rarityColor(t.count),
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-medium" style={{ color: rarityColor(t.count), minWidth: 56 }}>
                        {rarityLabel(t.count)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-2.5 text-right">
                    <button
                      onClick={() => handleCountClick(t)}
                      title={`View NFTs with ${t.traitType}: ${t.traitValue}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all"
                      style={{ background: "#eff6ff", color: "#1d4ed8" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#1d4ed8"; e.currentTarget.style.color = "#fff"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.color = "#1d4ed8"; }}
                    >
                      {t.count.toLocaleString()}
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-xs" style={{ color: "#94a3b8" }}>
                    No traits match your filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="px-6 py-2.5 text-[10px]" style={{ color: "#94a3b8", borderTop: "1px solid #f1f5f9" }}>
            Showing {filtered.length.toLocaleString()} of {traits.length.toLocaleString()} traits · Click a count to browse NFTs
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ─── Trending / Top Modal ─────────────────────────────────────────────────────

function CollectionListModal({
  title,
  url,
  onClose,
  onSync,
}: {
  title: string;
  url: string;
  onClose: () => void;
  onSync?: (slug: string) => void;
}) {
  const [items, setItems] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [syncing, setSyncing] = useState<string | null>(null);

  useEffect(() => {
    fetch(url, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => { setItems(d?.data ?? []); setLoading(false); })
      .catch((e) => { setErr(String(e)); setLoading(false); });
  }, [url]);

  const handleSync = async (slug: string) => {
    setSyncing(slug);
    try {
      await fetch(`/api/opensea/Collections/${encodeURIComponent(slug)}/sync`, { method: "POST", credentials: "include" });
      onSync?.(slug);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <ModalShell
      title={title}
      badge={
        !loading && items.length > 0 ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}>
            {items.length} collections
          </span>
        ) : undefined
      }
      onClose={onClose}
      extraWide
    >
      {loading && <Spinner />}
      {err && (
        <div className="mx-6 mt-4 text-xs px-4 py-3 rounded-xl" style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca" }}>
          {err}
        </div>
      )}
      {!loading && !err && (
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              <th className="text-center px-4 py-2.5 font-semibold w-10" style={{ color: "#64748b" }}>#</th>
              <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Collection</th>
              <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Chain</th>
              <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Category</th>
              <th className="text-right px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c, idx) => (
              <tr
                key={c.slug}
                className="transition-colors"
                style={{ borderBottom: "1px solid #f8fafc" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <td className="px-4 py-3 text-center">
                  <span
                    className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
                    style={{
                      background: idx === 0 ? "#fbbf24" : idx === 1 ? "#94a3b8" : idx === 2 ? "#d97706" : "#f1f5f9",
                      color: idx < 3 ? "#fff" : "#64748b",
                    }}
                  >
                    {idx + 1}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-semibold" style={{ color: "#1e293b" }}>{c.name ?? c.slug}</p>
                    <p className="text-[10px] font-mono mt-0.5" style={{ color: "#41afeb" }}>{c.slug}</p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <ChainBadge chain={c.chain} />
                </td>
                <td className="px-4 py-3">
                  <CategoryBadge cat={c.category} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleSync(c.slug)}
                    disabled={syncing === c.slug}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-semibold transition-all"
                    style={{ background: syncing === c.slug ? "#f1f5f9" : "#eff6ff", color: syncing === c.slug ? "#94a3b8" : "#1d4ed8" }}
                    onMouseEnter={e => { if (syncing !== c.slug) { e.currentTarget.style.background = "#1d4ed8"; e.currentTarget.style.color = "#fff"; } }}
                    onMouseLeave={e => { if (syncing !== c.slug) { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.color = "#1d4ed8"; } }}
                  >
                    {syncing === c.slug ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    {syncing === c.slug ? "Syncing…" : "Sync"}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-xs" style={{ color: "#94a3b8" }}>
                  No collections found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </ModalShell>
  );
}

// ─── Earnings Modal ───────────────────────────────────────────────────────────

const OPENSEA_PROTOCOL_RECIPIENT = "0x0000a26b00c1f0df003000390027140000faa719";

function shortAddr(addr: string) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function EarningsModal({
  slug,
  fees,
  owner,
  onClose,
}: {
  slug: string;
  fees: CollectionFee[] | null | undefined;
  owner: string | null | undefined;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyAddr = (addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(addr);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const protocolFee = fees?.find(
    (f) => f.recipient.toLowerCase() === OPENSEA_PROTOCOL_RECIPIENT.toLowerCase()
  );
  const royaltyFees = fees?.filter(
    (f) => f.recipient.toLowerCase() !== OPENSEA_PROTOCOL_RECIPIENT.toLowerCase()
  ) ?? [];

  const hasData = fees && fees.length > 0;

  return (
    <ModalShell
      title="Creator Royalties"
      subtitle={slug}
      badge={
        royaltyFees.length > 0 ? (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: "rgba(255,255,255,0.18)", color: "#fff" }}
          >
            {royaltyFees.reduce((s, f) => s + f.fee, 0)}% royalty
          </span>
        ) : undefined
      }
      onClose={onClose}
      wide
      footer={
        <a
          href={`https://opensea.io/collection/${slug}/edit/creator-earnings`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity"
          style={{ background: "linear-gradient(135deg,#2081e2,#1a5fb4)" }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Edit on OpenSea
        </a>
      }
    >
      <div className="px-6 py-5 space-y-5">
        {/* Info note */}
        <div
          className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-xs"
          style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}
        >
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span>
            Creator royalties are earned on every secondary market sale. To modify the percentage or
            recipient wallet, click <strong>Edit on OpenSea</strong> — wallet signature required.
          </span>
        </div>

        {!hasData && (
          <div className="text-xs text-center py-6" style={{ color: "#94a3b8" }}>
            No fee data available. Re-sync this collection to fetch the latest royalty settings.
          </div>
        )}

        {/* Creator Royalties */}
        {royaltyFees.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "#94a3b8" }}>
              Creator Royalties (Secondary Market)
            </p>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
              {royaltyFees.map((f, i) => (
                <div
                  key={i}
                  className="px-4 py-3 space-y-2"
                  style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd", borderBottom: i < royaltyFees.length - 1 ? "1px solid #f1f5f9" : "none" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "#64748b" }}>Royalty %</span>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-lg font-bold"
                        style={{ color: "#24315f" }}
                      >
                        {f.fee}%
                      </span>
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={
                          f.required
                            ? { background: "#dcfce7", color: "#15803d" }
                            : { background: "#fef9c3", color: "#854d0e" }
                        }
                      >
                        {f.required ? "Enforced on-chain" : "Optional"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "#64748b" }}>Recipient Wallet</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono" style={{ color: "#1e293b" }}>
                        {shortAddr(f.recipient)}
                      </span>
                      <button
                        onClick={() => copyAddr(f.recipient)}
                        title="Copy full address"
                        className="p-1 rounded transition-colors"
                        style={{ color: copied === f.recipient ? "#15803d" : "#94a3b8" }}
                        onMouseEnter={e => (e.currentTarget.style.color = "#24315f")}
                        onMouseLeave={e => (e.currentTarget.style.color = copied === f.recipient ? "#15803d" : "#94a3b8")}
                      >
                        {copied === f.recipient ? (
                          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  <div
                    className="text-[10px] font-mono px-3 py-1.5 rounded-lg break-all"
                    style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #f1f5f9" }}
                  >
                    {f.recipient}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OpenSea Protocol Fee */}
        {protocolFee && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "#94a3b8" }}>
              OpenSea Protocol Fee
            </p>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#fff" }}>
                <span className="text-xs" style={{ color: "#64748b" }}>Platform Fee</span>
                <span className="text-xs font-bold" style={{ color: "#1e293b" }}>{protocolFee.fee}%</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: "#fafbfd", borderTop: "1px solid #f1f5f9" }}>
                <span className="text-xs" style={{ color: "#64748b" }}>Enforcement</span>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: "#dcfce7", color: "#15803d" }}
                >
                  Always enforced
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Collection Owner */}
        {owner && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "#94a3b8" }}>
              Collection Owner
            </p>
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs" style={{ color: "#64748b" }}>Owner Wallet</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono" style={{ color: "#1e293b" }}>{shortAddr(owner)}</span>
                    <button
                      onClick={() => copyAddr(owner)}
                      title="Copy full address"
                      className="p-1 rounded transition-colors"
                      style={{ color: copied === owner ? "#15803d" : "#94a3b8" }}
                    >
                      {copied === owner ? (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div
                  className="text-[10px] font-mono px-3 py-1.5 rounded-lg break-all"
                  style={{ background: "#f8fafc", color: "#64748b", border: "1px solid #f1f5f9" }}
                >
                  {owner}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ─── Holders Modal ────────────────────────────────────────────────────────────

interface Holder {
  address: string;
  quantity: number;
}

function HoldersModal({ slug, chain, onClose }: { slug: string; chain: string; onClose: () => void }) {
  const router = useRouter();
  const [holders, setHolders] = useState<Holder[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const viewNfts = (address: string) => {
    onClose();
    router.push(`/admin/opensea/nfts?account=${encodeURIComponent(address)}&chain=${encodeURIComponent(chain)}`);
  };

  useEffect(() => {
    fetch(`/api/opensea/Collections/${encodeURIComponent(slug)}/holders`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => { setHolders(d?.data ?? []); setLoading(false); })
      .catch((e) => { setErr(String(e)); setLoading(false); });
  }, [slug]);

  const copyAddr = (addr: string) => {
    navigator.clipboard.writeText(addr).then(() => {
      setCopied(addr);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <ModalShell
      title="Top Holders"
      subtitle={slug}
      badge={
        !loading && holders.length > 0 ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}>
            {holders.length} holders
          </span>
        ) : undefined
      }
      onClose={onClose}
      wide
    >
      <div className="px-6 py-5">
        {loading && <Spinner />}
        {err && (
          <div className="text-xs px-4 py-3 rounded-xl" style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca" }}>
            {err}
          </div>
        )}
        {!loading && !err && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th className="text-center px-4 py-2.5 font-semibold w-12" style={{ color: "#64748b" }}>Rank</th>
                  <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Address</th>
                  <th className="text-right px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Quantity ↗</th>
                </tr>
              </thead>
              <tbody>
                {holders.map((h, idx) => (
                  <tr
                    key={h.address}
                    className="transition-colors"
                    style={{ background: idx % 2 === 0 ? "#fff" : "#fafbfd", borderBottom: "1px solid #f1f5f9" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f0f9ff")}
                    onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? "#fff" : "#fafbfd")}
                  >
                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
                        style={{
                          background: idx === 0 ? "#fbbf24" : idx === 1 ? "#94a3b8" : idx === 2 ? "#d97706" : "#f1f5f9",
                          color: idx < 3 ? "#fff" : "#64748b",
                        }}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono" style={{ color: "#1e293b" }}>
                          {h.address.slice(0, 6)}…{h.address.slice(-4)}
                        </span>
                        <button
                          onClick={() => copyAddr(h.address)}
                          title="Copy full address"
                          className="p-1 rounded transition-colors"
                          style={{ color: copied === h.address ? "#15803d" : "#94a3b8" }}
                          onMouseEnter={e => (e.currentTarget.style.color = "#24315f")}
                          onMouseLeave={e => (e.currentTarget.style.color = copied === h.address ? "#15803d" : "#94a3b8")}
                        >
                          {copied === h.address ? (
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => viewNfts(h.address)}
                        title={`View NFTs owned by ${h.address}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all"
                        style={{ background: "#eff6ff", color: "#1d4ed8" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#1d4ed8"; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.color = "#1d4ed8"; }}
                      >
                        {h.quantity.toLocaleString()}
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {holders.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-10 text-center text-xs" style={{ color: "#94a3b8" }}>
                      No holder data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ─── Floor Prices Modal ───────────────────────────────────────────────────────

interface FloorPricePoint {
  floor_price: number;
  timestamp: string;
}

const TIMEFRAME_OPTIONS = [
  { value: "one_hour",    label: "1H" },
  { value: "one_day",     label: "1D" },
  { value: "seven_days",  label: "7D" },
  { value: "thirty_days", label: "30D" },
  { value: "one_year",    label: "1Y" },
  { value: "all_time",    label: "All" },
];

function FloorPricesModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [prices, setPrices] = useState<FloorPricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [timeframe, setTimeframe] = useState("one_day");

  useEffect(() => {
    setLoading(true);
    setErr("");
    fetch(`/api/opensea/Collections/${encodeURIComponent(slug)}/floor-prices?timeframe=${timeframe}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => { setPrices(Array.isArray(d) ? d : []); setLoading(false); })
      .catch((e) => { setErr(String(e)); setLoading(false); });
  }, [slug, timeframe]);

  const validPrices = prices.map((p) => p.floor_price).filter((v) => v != null && !isNaN(v));
  const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : null;
  const maxPrice = validPrices.length > 0 ? Math.max(...validPrices) : null;
  const latestPrice = prices.length > 0 ? prices[prices.length - 1].floor_price : null;

  const fmtEth = (n: number | null) => n == null ? "—" : `${n.toFixed(4)} ETH`;
  const fmtTs = (s: string) => {
    try {
      return new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return s;
    }
  };

  return (
    <ModalShell
      title="Floor Price History"
      subtitle={slug}
      onClose={onClose}
      wide
    >
      <div className="px-6 py-5 space-y-4">
        {/* Timeframe selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {TIMEFRAME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTimeframe(opt.value)}
              className="px-3 py-1 rounded-lg text-[10px] font-semibold transition-colors"
              style={{
                background: timeframe === opt.value ? "#24315f" : "#f1f5f9",
                color: timeframe === opt.value ? "#fff" : "#64748b",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Stat boxes */}
        {!loading && !err && prices.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Latest", value: fmtEth(latestPrice) },
              { label: "Min", value: fmtEth(minPrice) },
              { label: "Max", value: fmtEth(maxPrice) },
            ].map((s) => (
              <div key={s.label} className="rounded-xl px-4 py-3" style={{ border: "1px solid #f1f5f9", background: "#fafbfd" }}>
                <p className="text-[10px] uppercase font-semibold tracking-wider mb-1" style={{ color: "#94a3b8" }}>{s.label}</p>
                <p className="text-sm font-bold" style={{ color: "#1e293b" }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {loading && <Spinner />}
        {err && (
          <div className="text-xs px-4 py-3 rounded-xl" style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca" }}>
            {err}
          </div>
        )}

        {!loading && !err && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Timestamp</th>
                  <th className="text-right px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Floor Price (ETH)</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p, i) => (
                  <tr
                    key={i}
                    style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd", borderBottom: "1px solid #f1f5f9" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f0f9ff")}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafbfd")}
                  >
                    <td className="px-4 py-2.5" style={{ color: "#475569" }}>{fmtTs(p.timestamp)}</td>
                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: "#1e293b" }}>{p.floor_price.toFixed(4)} ETH</td>
                  </tr>
                ))}
                {prices.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-6 py-10 text-center text-xs" style={{ color: "#94a3b8" }}>
                      No floor price data for this timeframe
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ─── Offer Aggregates Modal ───────────────────────────────────────────────────

interface OfferAggregate {
  price: string;
  currency: string;
  quantity: number;
}

function OfferAggregatesModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [offers, setOffers] = useState<OfferAggregate[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/opensea/Collections/${encodeURIComponent(slug)}/offer-aggregates`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => { setOffers(d?.data ?? []); setLoading(false); })
      .catch((e) => { setErr(String(e)); setLoading(false); });
  }, [slug]);

  const fmtPrice = (raw: string) => {
    const n = parseFloat(raw);
    if (isNaN(n)) return raw;
    const val = n > 1e15 ? n / 1e18 : n;
    return val.toFixed(4);
  };

  return (
    <ModalShell
      title="Offer Aggregates"
      subtitle={slug}
      badge={
        !loading && offers.length > 0 ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)" }}>
            {offers.length} price levels
          </span>
        ) : undefined
      }
      onClose={onClose}
      wide
    >
      <div className="px-6 py-5">
        {loading && <Spinner />}
        {err && (
          <div className="text-xs px-4 py-3 rounded-xl" style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca" }}>
            {err}
          </div>
        )}
        {!loading && !err && (
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th className="text-center px-4 py-2.5 font-semibold w-10" style={{ color: "#64748b" }}>#</th>
                  <th className="text-right px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Price</th>
                  <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Currency</th>
                  <th className="text-right px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Quantity</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o, i) => (
                  <tr
                    key={i}
                    style={{ background: i % 2 === 0 ? "#fff" : "#fafbfd", borderBottom: "1px solid #f1f5f9" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f0f9ff")}
                    onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafbfd")}
                  >
                    <td className="px-4 py-2.5 text-center" style={{ color: "#64748b" }}>{i + 1}</td>
                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: "#1e293b" }}>{fmtPrice(o.price)}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ background: "#e0f2fe", color: "#0369a1" }}
                      >
                        {o.currency}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "#475569" }}>{o.quantity.toLocaleString()}</td>
                  </tr>
                ))}
                {offers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-xs" style={{ color: "#94a3b8" }}>
                      No offer aggregate data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ActiveModal =
  | { type: "sync" }
  | { type: "trending" }
  | { type: "top" }
  | { type: "stats"; slug: string }
  | { type: "traits"; slug: string }
  | { type: "earnings"; slug: string }
  | { type: "holders"; slug: string; chain: string }
  | { type: "floor"; slug: string }
  | { type: "offers-agg"; slug: string };

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<ActiveModal | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/opensea/Collections", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => { setCollections(d?.data ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const filtered = collections.filter(
    (c) =>
      !search ||
      c.slug.toLowerCase().includes(search.toLowerCase()) ||
      (c.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Collections</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            {collections.length} cached collection{collections.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "#94a3b8" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 rounded-lg border outline-none"
              style={{ border: "1px solid #e2e8f0", color: "#374151", width: 160 }}
            />
          </div>
          <button
            onClick={() => setModal({ type: "trending" })}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: "#f1f5f9", color: "#24315f" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#e2e8f0")}
            onMouseLeave={e => (e.currentTarget.style.background = "#f1f5f9")}
          >
            Trending
          </button>
          <button
            onClick={() => setModal({ type: "top" })}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: "#f1f5f9", color: "#24315f" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#e2e8f0")}
            onMouseLeave={e => (e.currentTarget.style.background = "#f1f5f9")}
          >
            Top
          </button>
          <button
            onClick={() => setModal({ type: "sync" })}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity"
            style={{ background: "linear-gradient(135deg,#24315f,#1e4a8a)" }}
          >
            Sync
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <Spinner />
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                {["Slug", "Name", "Chain", "Category", "Synced At", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold" style={{ color: "#64748b" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.slug}
                  className="transition-colors"
                  style={{ borderBottom: "1px solid #f8fafc" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="px-4 py-3 font-mono text-[11px]" style={{ color: "#41afeb" }}>{c.slug}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: "#1e293b" }}>{c.name ?? "—"}</td>
                  <td className="px-4 py-3"><ChainBadge chain={c.chain} /></td>
                  <td className="px-4 py-3"><CategoryBadge cat={c.category} /></td>
                  <td className="px-4 py-3 text-[11px]" style={{ color: "#64748b" }}>
                    {c.syncedAt ? (
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-3 h-3" style={{ color: "#22c55e" }} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {fmtDate(c.syncedAt)}
                      </span>
                    ) : (
                      <span style={{ color: "#cbd5e1" }}>Not synced</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setModal({ type: "stats", slug: c.slug })}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                        style={{ background: "#eff6ff", color: "#1d4ed8" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#1d4ed8"; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.color = "#1d4ed8"; }}
                      >
                        Stats
                      </button>
                      <button
                        onClick={() => setModal({ type: "traits", slug: c.slug })}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                        style={{ background: "#f5f3ff", color: "#7c3aed" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#7c3aed"; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#f5f3ff"; e.currentTarget.style.color = "#7c3aed"; }}
                      >
                        Traits
                      </button>
                      <button
                        onClick={() => setModal({ type: "earnings", slug: c.slug })}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                        style={{ background: "#fef3c7", color: "#b45309" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#b45309"; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#fef3c7"; e.currentTarget.style.color = "#b45309"; }}
                      >
                        Royalties
                      </button>
                      <button
                        onClick={() => setModal({ type: "holders", slug: c.slug, chain: c.chain })}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                        style={{ background: "#f0fdf4", color: "#15803d" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#15803d"; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#f0fdf4"; e.currentTarget.style.color = "#15803d"; }}
                      >
                        Holders
                      </button>
                      <button
                        onClick={() => setModal({ type: "floor", slug: c.slug })}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                        style={{ background: "#fff7ed", color: "#c2410c" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#c2410c"; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#fff7ed"; e.currentTarget.style.color = "#c2410c"; }}
                      >
                        Floor
                      </button>
                      <button
                        onClick={() => setModal({ type: "offers-agg", slug: c.slug })}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                        style={{ background: "#f0f9ff", color: "#0369a1" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#0369a1"; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#f0f9ff"; e.currentTarget.style.color = "#0369a1"; }}
                      >
                        Offers
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-xs" style={{ color: "#94a3b8" }}>
                    {search ? `No collections matching "${search}"` : "No collections cached yet. Click Sync to add one."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {modal?.type === "sync" && (
        <SyncModal onClose={(refreshed) => { setModal(null); if (refreshed) load(); }} />
      )}
      {modal?.type === "stats" && (
        <StatsModal slug={modal.slug} onClose={() => setModal(null)} />
      )}
      {modal?.type === "traits" && (
        <TraitsModal slug={modal.slug} onClose={() => setModal(null)} />
      )}
      {modal?.type === "trending" && (
        <CollectionListModal
          title="Trending Collections"
          url="/api/opensea/Collections/trending"
          onClose={() => setModal(null)}
          onSync={() => load()}
        />
      )}
      {modal?.type === "top" && (
        <CollectionListModal
          title="Top Collections"
          url="/api/opensea/Collections/top"
          onClose={() => setModal(null)}
          onSync={() => load()}
        />
      )}
      {modal?.type === "earnings" && (() => {
        const col = collections.find((c) => c.slug === modal.slug);
        return (
          <EarningsModal
            slug={modal.slug}
            fees={col?.fees}
            owner={col?.owner}
            onClose={() => setModal(null)}
          />
        );
      })()}
      {modal?.type === "holders" && (
        <HoldersModal slug={modal.slug} chain={modal.chain} onClose={() => setModal(null)} />
      )}
      {modal?.type === "floor" && (
        <FloorPricesModal slug={modal.slug} onClose={() => setModal(null)} />
      )}
      {modal?.type === "offers-agg" && (
        <OfferAggregatesModal slug={modal.slug} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
