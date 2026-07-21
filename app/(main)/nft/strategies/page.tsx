"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrBanner } from "@/components/nft/ErrBanner";

interface StrategyStep { step: number; title: string; detail: string; }

interface Strategy {
  id: number;
  priority: number;
  name: string;
  tagline: string;
  category: string;
  categoryColor: string;
  description: string;
  industryNote: string;
  process: StrategyStep[];
  bestFor: string[];
  tips: string[];
  supported: boolean;
  saleMethodCode: string | null;
}

function mapStrategy(r: Record<string, unknown>): Strategy {
  return {
    id:            r.id as number,
    priority:      r.priority as number,
    name:          r.name as string,
    tagline:       r.tagline as string,
    category:      r.category as string,
    categoryColor: r.category_color as string,
    description:   r.description as string,
    industryNote:  r.industry_note as string,
    process:       (r.process as StrategyStep[]) ?? [],
    bestFor:       (r.best_for as string[]) ?? [],
    tips:          (r.tips as string[]) ?? [],
    supported:     r.supported as boolean,
    saleMethodCode: (r.sale_method_code as string) ?? null,
  };
}

const CATEGORIES = ["All", "Pricing Model", "Auction", "Access Control", "Sales Format", "Community", "Loyalty", "Direct Sales", "Events", "Utility", "Special"];

const CAT_COLOR: Record<string, string> = {
  "Pricing Model":  "#3b82f6",
  "Auction":        "#7c3aed",
  "Access Control": "#059669",
  "Sales Format":   "#d97706",
  "Community":      "#db2777",
  "Loyalty":        "#16a34a",
  "Direct Sales":   "#6b7280",
  "Events":         "#ea580c",
  "Utility":        "#0891b2",
  "Special":        "#9333ea",
};

export default function StrategiesPage() {
  const router = useRouter();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [apiLoading, setApiLoading]  = useState(true);
  const [apiError, setApiError]      = useState<string | null>(null);
  const [selected, setSelected]      = useState<Strategy | null>(null);
  const [category, setCategory]      = useState("All");
  const [search, setSearch]          = useState("");

  useEffect(() => {
    fetch("/api/nft-sell/strategies", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        setStrategies((d.strategies ?? []).map(mapStrategy));
        setApiLoading(false);
      })
      .catch(() => { setApiError("Failed to load strategies."); setApiLoading(false); });
  }, []);

  const filtered = strategies.filter(s => {
    const matchCat = category === "All" || s.category === category;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="flex h-full overflow-hidden" style={{ background: "#f0f2f7" }}>

      {/* â”€â”€ Left: Strategy List â”€â”€ */}
      <div
        className="flex flex-col flex-shrink-0 overflow-hidden bg-white"
        style={{
          width: selected ? "380px" : "100%",
          borderRight: selected ? "1px solid #e5e7eb" : "none",
          transition: "width 0.2s ease",
        }}
      >
        {/* List header */}
        <div className="flex-shrink-0 px-4 pt-4 pb-3 space-y-2" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <div>
            <h1 className="text-base font-bold" style={{ color: "#24315f" }}>NFT Selling Strategies</h1>
            <p className="text-xs" style={{ color: "#9bafc5" }}>
              {apiLoading ? "Loadingâ€¦" : `${strategies.length} strategies ranked by industry adoption Â· ${strategies.filter(s => s.supported).length} live Â· Select a strategy, then click "Use This Strategy" to configure waves`}
            </p>
          </div>
          <input
            type="text"
            placeholder="Search strategies..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg text-xs outline-none"
            style={{ border: "1px solid #e5e7eb", color: "#111827" }}
          />
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)}
                className="px-2 py-0.5 rounded text-[10px] font-semibold"
                style={category === cat
                  ? { background: cat === "All" ? "#24315f" : CAT_COLOR[cat], color: "#fff" }
                  : { background: "#f3f4f6", color: "#6b7280" }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Strategy rows */}
        <div className="flex-1 overflow-y-auto">
          {apiLoading && (
            <div className="flex items-center justify-center h-32 gap-2" style={{ color: "#9bafc5" }}>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading strategiesâ€¦
            </div>
          )}
          {apiError && <div className="m-4"><ErrBanner msg={apiError} /></div>}
          {!apiLoading && !apiError && (<>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                <th className="py-2 pl-4 pr-2 text-left text-[10px] font-bold uppercase tracking-wider w-12" style={{ color: "#9bafc5" }}>#</th>
                <th className="py-2 px-2 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#9bafc5" }}>Strategy</th>
                <th className="py-2 px-2 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: "#9bafc5" }}>Category</th>
                <th className="py-2 pl-2 pr-4 text-center text-[10px] font-bold uppercase tracking-wider w-14" style={{ color: "#9bafc5" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => {
                const isActive = selected?.priority === s.priority;
                const color = CAT_COLOR[s.category];
                return (
                  <tr
                    key={s.priority}
                    onClick={() => setSelected(isActive ? null : s)}
                    className="cursor-pointer transition-colors"
                    style={{
                      borderBottom: "1px solid #f3f4f6",
                      background: isActive ? `${color}0d` : "transparent",
                      borderLeft: isActive ? `3px solid ${color}` : "3px solid transparent",
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "#f9fafb"; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                  >
                    <td className="py-2.5 pl-4 pr-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black"
                        style={{ background: isActive ? `${color}20` : "#f3f4f6", color: isActive ? color : "#9bafc5" }}>
                        {String(s.priority).padStart(2, "0")}
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <p className="text-xs font-semibold leading-tight" style={{ color: isActive ? color : "#111827" }}>{s.name}</p>
                      {!selected && <p className="text-[10px] mt-0.5 leading-tight line-clamp-1" style={{ color: "#9bafc5" }}>{s.tagline}</p>}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold whitespace-nowrap"
                        style={{ background: `${color}18`, color }}>
                        {s.category}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 pr-4 text-center">
                      {s.supported
                        ? <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#16a34a" }} title="Live" />
                        : <span className="inline-block w-2 h-2 rounded-full" style={{ background: "#e5e7eb" }} title="Not yet implemented" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filtered.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs" style={{ color: "#9bafc5" }}>No strategies match your search.</p>
            </div>
          )}
          </>)}

          {/* Legend */}
          <div className="px-4 py-3 flex items-center gap-3" style={{ borderTop: "1px solid #f3f4f6" }}>
            <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "#9bafc5" }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#16a34a" }} />Live in system
            </span>
            <span className="flex items-center gap-1.5 text-[10px]" style={{ color: "#9bafc5" }}>
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#e5e7eb" }} />Not yet implemented
            </span>
          </div>
        </div>
      </div>

      {/* â”€â”€ Right: Detail Panel â”€â”€ */}
      {selected && (() => {
        const color = CAT_COLOR[selected.category];
        return (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 min-w-0">

            {/* Back + CTA row */}
            <div className="flex items-center justify-between gap-3">
              <button onClick={() => setSelected(null)} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "#9bafc5" }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
                Back to list
              </button>
              {selected.saleMethodCode && (
                <button
                  onClick={() => {
                    const params = new URLSearchParams({
                      saleMethod: selected.saleMethodCode!,
                      strategy:   selected.name,
                    });
                    router.push(`/nft/waves?${params.toString()}`);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                  style={{ background: color }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Use This Strategy
                </button>
              )}
            </div>

            {/* Title card */}
            <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #e5e7eb" }}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black"
                  style={{ background: `${color}18`, color }}>
                  {String(selected.priority).padStart(2, "0")}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-1">
                    <h2 className="text-base font-bold" style={{ color: "#111827" }}>{selected.name}</h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ background: `${color}18`, color }}>{selected.category}</span>
                    {selected.supported
                      ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>âœ“ Live in System</span>
                      : <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: "#f3f4f6", color: "#9bafc5" }}>Not yet implemented</span>}
                  </div>
                  <p className="text-xs font-semibold italic mb-2" style={{ color }}>&ldquo;{selected.tagline}&rdquo;</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{selected.description}</p>
                </div>
              </div>

              {/* Industry note */}
              <div className="mt-4 p-3 rounded-xl" style={{ background: `${color}0a`, border: `1px solid ${color}25` }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color }}>Industry Evidence</p>
                <p className="text-xs leading-relaxed" style={{ color: "#374151" }}>{selected.industryNote}</p>
              </div>

              {/* Best for */}
              <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{ borderTop: "1px solid #f3f4f6" }}>
                <span className="text-[10px] font-semibold self-center" style={{ color: "#9bafc5" }}>Best for:</span>
                {selected.bestFor.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{ background: "#f3f4f6", color: "#374151" }}>{t}</span>
                ))}
              </div>
            </div>

            {/* Process steps */}
            <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #e5e7eb" }}>
              <h3 className="text-sm font-bold mb-4" style={{ color: "#24315f" }}>Step-by-Step Process</h3>
              <div className="space-y-0">
                {selected.process.map((step, i) => (
                  <div key={step.step} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold z-10"
                        style={{ background: `${color}15`, color, border: `1.5px solid ${color}35` }}>
                        {step.step}
                      </div>
                      {i < selected.process.length - 1 && (
                        <div className="w-px flex-1 my-1" style={{ background: `${color}20`, minHeight: "16px" }} />
                      )}
                    </div>
                    <div className="flex-1 pb-4 min-w-0">
                      <p className="text-xs font-semibold mb-0.5" style={{ color: "#111827" }}>{step.title}</p>
                      <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid #e5e7eb" }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: "#24315f" }}>Tips & Best Practices</h3>
              <div className="space-y-2.5">
                {selected.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                      style={{ background: "rgba(234,179,8,0.12)", color: "#ca8a04" }}>â˜…</div>
                    <p className="text-xs leading-relaxed" style={{ color: "#374151" }}>{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
