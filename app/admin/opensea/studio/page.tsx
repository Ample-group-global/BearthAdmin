"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Drop {
  slug: string;
  name: string;
  chain: string;
  dropType: string;
  startDate: string | null;
  endDate: string | null;
  imageUrl: string | null;
  totalSupply: number | null;
  mintedCount: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <svg className="w-5 h-5 animate-spin" style={{ color: "#9bafc5" }} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

const CHAIN_COLORS: Record<string, { bg: string; text: string }> = {
  ethereum: { bg: "#e8f0fe", text: "#1a56db" },
  matic:    { bg: "#ede9fe", text: "#7c3aed" },
  polygon:  { bg: "#ede9fe", text: "#7c3aed" },
  base:     { bg: "#e0f2fe", text: "#0369a1" },
  solana:   { bg: "#d1fae5", text: "#065f46" },
};

function ChainBadge({ chain }: { chain: string }) {
  const c = CHAIN_COLORS[chain?.toLowerCase()] ?? { bg: "#f3f4f6", text: "#6b7280" };
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize" style={{ background: c.bg, color: c.text }}>
      {chain}
    </span>
  );
}

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ─── Create cards ─────────────────────────────────────────────────────────────

function CreateCard({
  icon,
  title,
  description,
  features,
  contract,
  href,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  contract: string;
  href: string;
  color: string;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}
    >
      {/* Card header */}
      <div className="px-6 pt-6 pb-5">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: color + "18" }}
        >
          <div style={{ color }}>{icon}</div>
        </div>
        <h2 className="text-sm font-bold mb-1.5" style={{ color: "#1e293b" }}>{title}</h2>
        <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>{description}</p>
      </div>

      {/* Features */}
      <div className="px-6 pb-5 flex-1">
        <div className="space-y-2">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-xs" style={{ color: "#475569" }}>{f}</span>
            </div>
          ))}
        </div>
        <div
          className="mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
          style={{ background: "#f1f5f9", color: "#64748b" }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          {contract}
        </div>
      </div>

      {/* CTA */}
      <div className="px-6 pb-6">
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          {title === "Scheduled Drop" ? "Create Drop on OpenSea" : "Create Collection on OpenSea"}
        </a>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudioPage() {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loadingDrops, setLoadingDrops] = useState(true);
  const [dropsErr, setDropsErr] = useState("");

  useEffect(() => {
    fetch("/api/opensea/Drops?type=upcoming", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setDrops(d?.data ?? []);
        setLoadingDrops(false);
      })
      .catch((e) => { setDropsErr(String(e)); setLoadingDrops(false); });
  }, []);

  return (
    <div className="p-5 max-w-5xl">

      {/* Header */}
      <div className="mb-7">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5" style={{ color: "#24315f" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h1 className="text-base font-bold" style={{ color: "#24315f" }}>OpenSea Studio</h1>
        </div>
        <p className="text-xs" style={{ color: "#9bafc5" }}>
          Create and manage your NFT drops and collections on OpenSea
        </p>
      </div>

      {/* Info banner */}
      <div
        className="flex items-start gap-3 px-4 py-3.5 rounded-xl mb-7 text-xs"
        style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}
      >
        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <span className="font-semibold">Wallet required on OpenSea:</span> Creating a drop or collection requires you to sign a transaction with your connected wallet on opensea.io. Click the button below to open OpenSea Studio — your wallet will be used to authenticate.
        </div>
      </div>

      {/* Create cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <CreateCard
          title="Scheduled Drop"
          description="Build anticipation with timed launches, gated access, and reveal after mint."
          features={[
            "Scheduled launch with fixed start time",
            "Fixed number of items — set how many will ever be available",
            "Post-mint reveal — blind box experience",
            "Gated access (allowlist / public phases)",
          ]}
          contract="ERC-721 contract"
          href="https://opensea.io/studio"
          color="#6366f1"
          icon={
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <CreateCard
          title="Open Collection"
          description="Publish immediately — ideal for ongoing series or mixed-format collections."
          features={[
            "Launch instantly with no schedule needed",
            "Add new items anytime — no fixed supply",
            "Supports ongoing creativity",
            "Items show right away — great for evolving collections",
          ]}
          contract="ERC-1155 contract"
          href="https://opensea.io/studio"
          color="#0ea5e9"
          icon={
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          }
        />
      </div>

      {/* Upcoming drops from API */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Upcoming Drops</h2>
          <a
            href="/admin/opensea/drops"
            className="text-[11px] font-semibold flex items-center gap-1 transition-colors"
            style={{ color: "#9bafc5" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#24315f")}
            onMouseLeave={e => (e.currentTarget.style.color = "#9bafc5")}
          >
            View all drops
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {loadingDrops && <Spinner />}
        {dropsErr && (
          <div className="text-xs px-4 py-3 rounded-xl" style={{ background: "#fff5f5", color: "#dc2626", border: "1px solid #fecaca" }}>
            {dropsErr}
          </div>
        )}
        {!loadingDrops && !dropsErr && drops.length === 0 && (
          <div
            className="text-center py-10 rounded-xl"
            style={{ background: "#f8fafc", border: "1px dashed #e2e8f0" }}
          >
            <svg className="w-8 h-8 mx-auto mb-3" style={{ color: "#cbd5e1" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-xs" style={{ color: "#94a3b8" }}>No upcoming drops found on OpenSea</p>
          </div>
        )}
        {!loadingDrops && drops.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
          >
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Drop</th>
                  <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Chain</th>
                  <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Type</th>
                  <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Start</th>
                  <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>End</th>
                  <th className="text-left px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Supply</th>
                  <th className="text-right px-4 py-2.5 font-semibold" style={{ color: "#64748b" }}>Link</th>
                </tr>
              </thead>
              <tbody>
                {drops.map((d, i) => (
                  <tr
                    key={d.slug}
                    style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafbfd" }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {d.imageUrl ? (
                          <img src={d.imageUrl} alt="" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-lg flex-shrink-0" style={{ background: "#e2e8f0" }} />
                        )}
                        <div>
                          <div className="font-semibold" style={{ color: "#1e293b" }}>{d.name || d.slug}</div>
                          <div className="font-mono text-[10px]" style={{ color: "#94a3b8" }}>{d.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><ChainBadge chain={d.chain} /></td>
                    <td className="px-4 py-3 capitalize" style={{ color: "#475569" }}>{d.dropType || "—"}</td>
                    <td className="px-4 py-3" style={{ color: "#475569" }}>{fmtDate(d.startDate)}</td>
                    <td className="px-4 py-3" style={{ color: "#475569" }}>{fmtDate(d.endDate)}</td>
                    <td className="px-4 py-3" style={{ color: "#475569" }}>
                      {d.totalSupply != null ? (
                        <span>
                          {(d.mintedCount ?? 0).toLocaleString()}
                          <span style={{ color: "#cbd5e1" }}> / </span>
                          {d.totalSupply.toLocaleString()}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`https://opensea.io/drops/${d.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all"
                        style={{ background: "#eff6ff", color: "#1d4ed8" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#1d4ed8"; e.currentTarget.style.color = "#fff"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.color = "#1d4ed8"; }}
                      >
                        View
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
