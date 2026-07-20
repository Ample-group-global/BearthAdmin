"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Wave {
  id: string;
  waveNumber: number;
  name: string;
  stageId: string | null;
  stageName: string | null;
  quantity: number;
  cumulativeStart: number;
  cumulativeEnd: number;
  defaultPriceEth: number | null;
  saleMethod: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  status: string;
  notes: string | null;
  nftCount: number;
  // On-chain mirror fields (from nft_waves V8 columns)
  soldCount?: number;
  priceLocked?: boolean;
  waveClosed?: boolean;
  waveRevealed?: boolean;
  closeAction?: string | null;
  syncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OnChainWaveInfo {
  price: string;
  qty: number;
  soldCount: number;
  startTime: number;
  endTime: number;
  closed: boolean;
}

interface SaleMethod { code: string; label: string; is_active: boolean; sort_order: number; }

const STATUS_OPTS = ["upcoming", "active", "completed", "paused"];

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: "8px",
  border: "1px solid #e5e7eb", fontSize: "13px", color: "#111827", outline: "none",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 700,
  color: "#9bafc5", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em",
};
const thStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: "#9bafc5",
  textTransform: "uppercase", letterSpacing: "0.06em",
  padding: "10px 14px", borderBottom: "1px solid #e5e7eb",
  background: "#f9fafb", whiteSpace: "nowrap",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string; label: string }> = {
    completed: { bg: "rgba(22,163,74,0.1)",   color: "#16a34a", label: "Completed"  },
    active:    { bg: "rgba(65,175,235,0.12)",  color: "#41afeb", label: "Active"     },
    upcoming:  { bg: "rgba(156,163,175,0.12)", color: "#9ca3af", label: "Upcoming"   },
    paused:    { bg: "rgba(217,119,6,0.1)",    color: "#d97706", label: "Paused"     },
    closed:    { bg: "rgba(22,163,74,0.1)",    color: "#16a34a", label: "Closed"     },
    sold_out:  { bg: "rgba(124,58,237,0.1)",   color: "#7c3aed", label: "Sold Out"   },
  };
  const c = cfg[status] ?? cfg.upcoming;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: c.bg, color: c.color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: c.color }} />
      {c.label}
    </span>
  );
}

function SaleMethodBadge({ method, saleMethods }: { method: string; saleMethods: SaleMethod[] }) {
  const sm = saleMethods.find(s => s.code === method);
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "rgba(65,175,235,0.12)", color: "#41afeb" }}>
      {sm?.label ?? method}
    </span>
  );
}

function TxBanner({ txHash }: { txHash: string }) {
  return (
    <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-2"
      style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.3)", color: "#16a34a" }}>
      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      Tx: <span className="font-mono">{txHash.slice(0, 18)}…</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WavesPage() {
  const searchParams = useSearchParams();
  const strategyHighlight = searchParams.get("saleMethod");
  const strategyName      = searchParams.get("strategy");
  const highlightRef      = useRef<HTMLDivElement>(null);

  const [waves, setWaves]             = useState<Wave[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [saleMethods, setSaleMethods] = useState<SaleMethod[]>([]);

  // DB edit modal
  const [editWave, setEditWave]   = useState<Wave | null>(null);
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState({
    defaultPriceEth: "", saleMethod: "", scheduledStart: "",
    scheduledEnd: "", status: "", notes: "", clearSchedule: false,
  });

  // On-chain action modal
  const [chainWave, setChainWave]         = useState<Wave | null>(null);
  const [chainOnChain, setChainOnChain]   = useState<OnChainWaveInfo | null>(null);
  const [chainLoading, setChainLoading]   = useState(false);
  const [chainSaving, setChainSaving]     = useState<string | null>(null);
  const [chainError, setChainError]       = useState<string | null>(null);
  const [chainTx, setChainTx]             = useState<string | null>(null);

  // Chain form fields
  const [chainPrice, setChainPrice]       = useState("");
  const [chainStart, setChainStart]       = useState("");
  const [chainEnd, setChainEnd]           = useState("");
  const [auctionTo, setAuctionTo]         = useState("");
  const [auctionQty, setAuctionQty]       = useState("1");
  const [auctionListingId, setAuctionListingId] = useState("");
  const [auctionStartPrice, setAuctionStartPrice] = useState("");

  // Dutch auction form fields
  const [dutchStartPrice, setDutchStartPrice]     = useState("");
  const [dutchFloorPrice, setDutchFloorPrice]     = useState("");
  const [dutchDecrement, setDutchDecrement]       = useState("");
  const [dutchInterval, setDutchInterval]         = useState("");
  const [dutchCurrentPrice, setDutchCurrentPrice] = useState<string | null>(null);

  // Reveal wave form fields
  const [revealWaveUri, setRevealWaveUri] = useState("");

  // Strategy config form fields (separate save actions per section)
  const [stratSaving, setStratSaving] = useState<string | null>(null);
  const [stratOk, setStratOk]         = useState<string | null>(null);
  const [stratErr, setStratErr]       = useState<string | null>(null);
  const [flashEnabled, setFlashEnabled]       = useState(false);
  const [flashDiscount, setFlashDiscount]     = useState("");
  const [artistEnabled, setArtistEnabled]     = useState(false);
  const [artistName, setArtistName]           = useState("");
  const [artistWallet, setArtistWallet]       = useState("");
  const [artistRoyaltyBps, setArtistRoyaltyBps] = useState("");
  const [tierLegendary, setTierLegendary]     = useState("");
  const [tierEpic, setTierEpic]               = useState("");
  const [tierRare, setTierRare]               = useState("");
  const [tierCommon, setTierCommon]           = useState("");
  const [holderPriorityStart, setHolderPriorityStart] = useState("");
  const [holderPriorityEnd, setHolderPriorityEnd]     = useState("");

  // Holder snapshot / merkle (on-chain modal)
  const [snapshotWallets, setSnapshotWallets] = useState<string[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const loadWaves = () => {
    setLoading(true); setError(null);
    fetch("/api/nft-sell/waves", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setWaves(d.waves ?? []); setLoading(false); })
      .catch(() => { setError("Failed to load waves."); setLoading(false); });
  };

  useEffect(() => {
    loadWaves();
    fetch("/api/nft-sell/lookups/wave-sale-methods", { credentials: "include" })
      .then(r => r.json())
      .then(d => setSaleMethods(d.saleMethods ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (strategyHighlight && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [strategyHighlight, waves]);

  // ── DB edit ──

  const openEdit = (w: Wave) => {
    setEditWave(w);
    setForm({
      defaultPriceEth: w.defaultPriceEth != null ? String(w.defaultPriceEth) : "",
      saleMethod:      w.saleMethod ?? "fixed_price",
      scheduledStart:  w.scheduledStart ? w.scheduledStart.slice(0, 16) : "",
      scheduledEnd:    w.scheduledEnd   ? w.scheduledEnd.slice(0, 16)   : "",
      status:          w.status ?? "upcoming",
      notes:           w.notes  ?? "",
      clearSchedule:   false,
    });
    // Reset strategy form fields
    setFlashEnabled(false); setFlashDiscount("");
    setArtistEnabled(false); setArtistName(""); setArtistWallet(""); setArtistRoyaltyBps("");
    setTierLegendary(""); setTierEpic(""); setTierRare(""); setTierCommon("");
    setHolderPriorityStart(""); setHolderPriorityEnd("");
    setStratOk(null); setStratErr(null);
    setSaveError(null);
  };

  const saveStratSection = async (section: string, body: Record<string, unknown>, waveNum: number) => {
    setStratSaving(section); setStratErr(null); setStratOk(null);
    try {
      const r = await fetch(`/api/nft-sell/waves/${waveNum}/${section}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { setStratErr(d.error ?? "Save failed"); return; }
      setStratOk(`${section.replace(/-/g, " ")} saved`);
    } catch { setStratErr("Network error"); }
    finally { setStratSaving(null); }
  };

  const handleSave = async () => {
    if (!editWave) return;
    setSaving(true); setSaveError(null);
    try {
      const body: Record<string, unknown> = {
        defaultPriceEth: form.defaultPriceEth !== "" ? Number(form.defaultPriceEth) : null,
        saleMethod:      form.saleMethod   || null,
        scheduledStart:  form.clearSchedule ? null : (form.scheduledStart ? new Date(form.scheduledStart).toISOString() : null),
        scheduledEnd:    form.clearSchedule ? null : (form.scheduledEnd   ? new Date(form.scheduledEnd).toISOString()   : null),
        status:          form.status       || null,
        notes:           form.notes        || null,
        clearSchedule:   form.clearSchedule,
      };
      const res = await fetch(`/api/waves/${editWave.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setSaveError(d.error ?? "Save failed."); return; }
      setEditWave(null); loadWaves();
    } catch { setSaveError("Network error."); }
    finally { setSaving(false); }
  };

  // ── On-chain actions ──

  const openChainModal = async (w: Wave) => {
    setChainWave(w); setChainError(null); setChainTx(null); setChainOnChain(null);
    setChainLoading(true);
    setChainPrice(w.defaultPriceEth != null ? String(w.defaultPriceEth) : "");
    setChainStart(w.scheduledStart ? w.scheduledStart.slice(0, 16) : "");
    setChainEnd(w.scheduledEnd     ? w.scheduledEnd.slice(0, 16)   : "");
    setDutchStartPrice(""); setDutchFloorPrice(""); setDutchDecrement(""); setDutchInterval("");
    setDutchCurrentPrice(null); setRevealWaveUri("");
    try {
      const d = await fetch(`/api/nft-sell/waves/${w.waveNumber}`, { credentials: "include" }).then(r => r.json());
      setChainOnChain(d.onChain ?? null);
      if (w.saleMethod === "dutch_auction") {
        try {
          const dp = await fetch(`/api/nft-sell/waves/${w.waveNumber}/dutch-price`, { credentials: "include" }).then(r => r.json());
          setDutchCurrentPrice(dp.currentPriceEth ?? null);
        } catch { /* ignore */ }
      }
    } catch { /* show modal anyway */ }
    finally { setChainLoading(false); }
  };

  const chainOp = async (opName: string, fn: () => Promise<Response>) => {
    setChainSaving(opName); setChainError(null); setChainTx(null);
    try {
      const res = await fn();
      const d   = await res.json();
      if (!res.ok) { setChainError(d.error ?? `${opName} failed.`); return; }
      setChainTx(d.txHash ?? null);
      // refresh on-chain data
      const fresh = await fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}`, { credentials: "include" }).then(r => r.json());
      setChainOnChain(fresh.onChain ?? null);
      loadWaves();
    } catch { setChainError("Network error."); }
    finally { setChainSaving(null); }
  };

  const handleSetScheduleOnChain = () => {
    if (!chainStart || !chainEnd) { setChainError("Both start and end times required."); return; }
    chainOp("schedule", () => fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/schedule`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startUnix: Math.floor(new Date(chainStart).getTime() / 1000),
        endUnix:   Math.floor(new Date(chainEnd).getTime()   / 1000),
      }),
    }));
  };

  const handleSetPriceOnChain = () => {
    if (!chainPrice || isNaN(parseFloat(chainPrice))) { setChainError("Enter a valid price."); return; }
    chainOp("price", () => fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/price`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceEth: chainPrice }),
    }));
  };

  const handleCloseTreasury = () =>
    chainOp("treasury", () => fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/close-treasury`, {
      method: "POST", credentials: "include",
    }));

  const handleCloseBurn = () =>
    chainOp("burn", () => fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/close-burn`, {
      method: "POST", credentials: "include",
    }));

  const handleMintTransfer = () => {
    if (!auctionTo) { setChainError("Recipient address required."); return; }
    chainOp("mint-transfer", () => fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/mint-transfer`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: auctionTo, qty: parseInt(auctionQty, 10) }),
    }));
  };

  const handleSaveAuctionListing = () => {
    if (!auctionListingId) { setChainError("Listing ID required."); return; }
    chainOp("auction", () => fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/auction-listing`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: auctionListingId, startPriceEth: auctionStartPrice }),
    }));
  };

  const handleSetDutchAuction = () => {
    if (!dutchStartPrice || !dutchFloorPrice || !dutchDecrement || !dutchInterval) {
      setChainError("All Dutch auction fields are required."); return;
    }
    chainOp("dutch", () => fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/dutch-auction`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startPriceEth:  dutchStartPrice,
        floorPriceEth:  dutchFloorPrice,
        decrementEth:   dutchDecrement,
        intervalSeconds: parseInt(dutchInterval, 10),
      }),
    }));
  };

  const handleRevealWave = () => {
    if (!revealWaveUri) { setChainError("Reveal URI is required."); return; }
    chainOp("reveal-wave", async () => {
      const res = await fetch("/api/nft-sell/collection/reveal-wave", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ waveNum: chainWave!.waveNumber, uri: revealWaveUri }),
      });
      if (res.ok) {
        setWaves(prev => prev.map(w =>
          w.waveNumber === chainWave!.waveNumber ? { ...w, waveRevealed: true } : w
        ));
      }
      return res;
    });
  };

  const totalNfts     = waves.reduce((s, w) => s + w.quantity, 0);
  const activeWave    = waves.find(w => w.status === "active");
  const completedCount = waves.filter(w => w.status === "completed" || w.status === "closed" || w.status === "sold_out").length;
  const totalSold     = waves.reduce((s, w) => s + (w.soldCount ?? 0), 0);

  return (
    <div className="p-5 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "#24315f" }}>NFT Sell</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            Primary selling control center — manage pricing, schedules, Dutch auctions, and on-chain wave actions
          </p>
        </div>
        <button onClick={loadWaves}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
          style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "white" }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* ── Strategy banner (shown when navigated from Strategies page) ── */}
      {strategyHighlight && (
        <div ref={highlightRef} className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm"
          style={{ background: "rgba(65,175,235,0.08)", border: "1px solid rgba(65,175,235,0.3)" }}>
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="#41afeb" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <span className="font-bold" style={{ color: "#41afeb" }}>
              {strategyName ? `Strategy: ${strategyName}` : "Strategy selected"}
            </span>
            <span className="ml-2" style={{ color: "#6b7280" }}>
              — Configure waves with{" "}
              <strong>{saleMethods.find(s => s.code === strategyHighlight)?.name ?? strategyHighlight}</strong>{" "}
              as the sale method. Edit each wave below and set Sale Method accordingly.
            </span>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Waves",  value: String(waves.length),     color: "#41afeb" },
          { label: "Closed/Done",  value: String(completedCount),   color: "#16a34a" },
          { label: "Active Wave",  value: activeWave?.name ?? "—",  color: "#7c3aed", small: true },
          { label: "Total Sold",   value: `${totalSold.toLocaleString()} / ${totalNfts.toLocaleString()}`, color: "#24315f", small: true },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>{s.label}</p>
            <p className={`font-bold ${s.small ? "text-sm" : "text-2xl"}`} style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          {error}
        </div>
      )}

      {/* ── Waves Table ── */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div className="flex items-center justify-center h-48" style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max">
              <thead>
                <tr>
                  {["Wave", "Qty", "Price (ETH)", "Sold", "Sale Method", "Schedule", "Status", "Revealed", "Actions"].map(h => (
                    <th key={h} style={{ ...thStyle, textAlign: ["Qty", "Sold", "Revealed"].includes(h) ? "center" : "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {waves.map((w, i) => {
                  const isClosed = w.waveClosed || w.status === "closed";
                  const isLocked = w.priceLocked;
                  return (
                    <tr key={w.id}
                      style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#fafbff")}
                      onMouseLeave={e => (e.currentTarget.style.background = "")}>

                      <td style={{ padding: "10px 14px" }}>
                        <div className="flex items-center gap-2">
                          <img
                            src="https://amgbearth.myfilebase.com/ipfs/QmbJJezw9jgxN1P4eWD58XU6rSPokENE4MmD2i4qfBwfrF"
                            alt="NFT"
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                            style={{ border: isClosed ? "2px solid #16a34a" : w.status === "active" ? "2px solid #41afeb" : "2px solid #e5e7eb" }}
                          />
                          <div className="font-semibold text-xs" style={{ color: "#111827" }}>{w.name}</div>
                        </div>
                      </td>

                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <span className="text-xs font-semibold" style={{ color: "#374151" }}>{w.quantity.toLocaleString()}</span>
                      </td>

                      <td style={{ padding: "10px 14px" }}>
                        <div className="flex items-center gap-1">
                          {w.defaultPriceEth != null ? (
                            <span className="font-bold text-xs" style={{ color: "#24315f" }}>{w.defaultPriceEth} ETH</span>
                          ) : (
                            <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>Free</span>
                          )}
                          {isLocked && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-bold"
                              style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
                              Locked
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <div className="text-xs">
                          <span className="font-bold" style={{ color: "#41afeb" }}>{(w.soldCount ?? 0).toLocaleString()}</span>
                          <span style={{ color: "#9bafc5" }}> / {w.quantity.toLocaleString()}</span>
                        </div>
                        {(w.soldCount ?? 0) > 0 && (
                          <div className="h-1 rounded-full mt-1" style={{ background: "#e5e7eb", width: 60, margin: "4px auto 0" }}>
                            <div className="h-1 rounded-full" style={{
                              width: `${Math.min(100, Math.round((w.soldCount ?? 0) / w.quantity * 100))}%`,
                              background: "#41afeb",
                            }} />
                          </div>
                        )}
                      </td>

                      <td style={{ padding: "10px 14px" }}>
                        <SaleMethodBadge method={w.saleMethod} saleMethods={saleMethods} />
                      </td>

                      <td style={{ padding: "10px 14px", minWidth: 140 }}>
                        {w.scheduledStart || w.scheduledEnd ? (
                          <div className="text-xs" style={{ color: "#6b7280" }}>
                            {w.scheduledStart && <div>From: <strong style={{ color: "#374151" }}>{new Date(w.scheduledStart).toLocaleDateString()}</strong></div>}
                            {w.scheduledEnd   && <div>To: <strong style={{ color: "#374151" }}>{new Date(w.scheduledEnd).toLocaleDateString()}</strong></div>}
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: "#d1d5db" }}>Not scheduled</span>
                        )}
                      </td>

                      <td style={{ padding: "10px 14px" }}>
                        <div className="space-y-1">
                          <StatusBadge status={w.status} />
                          {isClosed && w.closeAction && (
                            <span className="block text-xs" style={{ color: "#9bafc5" }}>
                              {w.closeAction === "treasury" ? "→ Treasury" : "→ Burned"}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        {w.waveRevealed ? (
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#16a34a" }} title="Revealed" />
                        ) : (
                          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: "#d1d5db" }} title="Not revealed" />
                        )}
                      </td>

                      <td style={{ padding: "10px 14px" }}>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(w)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "white" }}>
                            Edit DB
                          </button>
                          <button onClick={() => openChainModal(w)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white"
                            style={{ background: isClosed ? "#9bafc5" : "#41afeb" }}
                            disabled={isClosed}>
                            ⛓ On-Chain
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer totals */}
      {!loading && waves.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold"
          style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#24315f" }}>
          <span>Totals across all 7 waves</span>
          <div className="flex items-center gap-6">
            <span>Qty: <strong>{totalNfts.toLocaleString()} / 9,999</strong></span>
            <span>Sold: <strong style={{ color: "#41afeb" }}>{totalSold.toLocaleString()}</strong></span>
            <span>NFTs in DB: <strong style={{ color: "#7c3aed" }}>{waves.reduce((s, w) => s + Number(w.nftCount ?? 0), 0).toLocaleString()}</strong></span>
          </div>
        </div>
      )}

      {/* ══ Edit DB Modal ══════════════════════════════════════════════════════════ */}
      {editWave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl flex flex-col"
            style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", border: "1px solid #e5e7eb" }}>
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
              <div>
                <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>
                  Edit Wave {editWave.waveNumber} — {editWave.name}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>DB settings (display + scheduling)</p>
              </div>
              <button onClick={() => setEditWave(null)} style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              {saveError && (
                <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  {saveError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={labelStyle}>Default Price (ETH)</label>
                  <input type="number" step="0.0001" min="0"
                    value={form.defaultPriceEth}
                    onChange={e => setForm({ ...form, defaultPriceEth: e.target.value })}
                    style={inputStyle} placeholder="0 = Free" />
                </div>
                <div>
                  <label style={labelStyle}>Sale Method</label>
                  <select value={form.saleMethod}
                    onChange={e => setForm({ ...form, saleMethod: e.target.value })}
                    style={inputStyle}>
                    {saleMethods.filter(s => s.is_active).map(s => (
                      <option key={s.code} value={s.code}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <div className="flex gap-2 flex-wrap">
                  {STATUS_OPTS.map(s => (
                    <button key={s} onClick={() => setForm({ ...form, status: s })}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize"
                      style={{
                        border: "1px solid", borderColor: form.status === s ? "#41afeb" : "#e5e7eb",
                        background: form.status === s ? "rgba(65,175,235,0.1)" : "white",
                        color: form.status === s ? "#41afeb" : "#6b7280",
                      }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label style={{ ...labelStyle, marginBottom: 0 }}>Schedule (DB display)</label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.clearSchedule}
                      onChange={e => setForm({ ...form, clearSchedule: e.target.checked, scheduledStart: "", scheduledEnd: "" })} />
                    <span className="text-xs" style={{ color: "#9bafc5" }}>Clear</span>
                  </label>
                </div>
                {!form.clearSchedule && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label style={labelStyle}>Start</label>
                      <input type="datetime-local" value={form.scheduledStart}
                        onChange={e => setForm({ ...form, scheduledStart: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>End</label>
                      <input type="datetime-local" value={form.scheduledEnd}
                        onChange={e => setForm({ ...form, scheduledEnd: e.target.value })} style={inputStyle} />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} />
              </div>

              {/* ── Strategy Config ── */}
              <div className="pt-2" style={{ borderTop: "1px solid #e5e7eb" }}>
                <p className="text-xs font-bold mb-3" style={{ color: "#9bafc5", textTransform: "uppercase", letterSpacing: "0.06em" }}>Strategy Config</p>

                {stratOk && <div className="mb-2 px-3 py-1.5 rounded-lg text-xs text-green-700" style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.3)" }}>{stratOk}</div>}
                {stratErr && <div className="mb-2 px-3 py-1.5 rounded-lg text-xs text-red-600" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.3)" }}>{stratErr}</div>}

                {/* Flash Sale */}
                <div className="p-3 rounded-xl mb-3" style={{ background: "#fafafa", border: "1px solid #e5e7eb" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold" style={{ color: "#24315f" }}>Flash Sale</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={flashEnabled} onChange={e => setFlashEnabled(e.target.checked)} className="w-4 h-4" />
                      <span className="text-xs text-gray-500">Enable</span>
                    </label>
                  </div>
                  {flashEnabled && (
                    <div className="flex items-end gap-2">
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Discount %</label>
                        <input type="number" step="0.1" min={0} max={100} value={flashDiscount} onChange={e => setFlashDiscount(e.target.value)} style={inputStyle} placeholder="e.g. 20" />
                      </div>
                      <button onClick={() => saveStratSection("flash-sale", { is_flash_sale: flashEnabled, flash_discount_pct: parseFloat(flashDiscount) }, editWave!.waveNumber)}
                        disabled={stratSaving === "flash-sale"}
                        className="px-3 py-2 rounded-lg text-xs font-semibold text-white"
                        style={{ background: "#d97706", opacity: stratSaving === "flash-sale" ? 0.6 : 1, whiteSpace: "nowrap" }}>
                        {stratSaving === "flash-sale" ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                  {!flashEnabled && (
                    <button onClick={() => saveStratSection("flash-sale", { is_flash_sale: false, flash_discount_pct: 0 }, editWave!.waveNumber)}
                      disabled={!!stratSaving}
                      className="text-xs px-2 py-1 rounded-lg font-medium"
                      style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>
                      Disable Flash Sale
                    </button>
                  )}
                </div>

                {/* Tier Prices */}
                <div className="p-3 rounded-xl mb-3" style={{ background: "#fafafa", border: "1px solid #e5e7eb" }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#24315f" }}>Tier Prices (ETH)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[["Legendary", tierLegendary, setTierLegendary], ["Epic", tierEpic, setTierEpic], ["Rare", tierRare, setTierRare], ["Common", tierCommon, setTierCommon]].map(([label, val, setter]) => (
                      <div key={label as string}>
                        <label style={{ ...labelStyle, marginBottom: 2 }}>{label as string}</label>
                        <input type="number" step="0.001" value={val as string} onChange={e => (setter as (v: string) => void)(e.target.value)} style={{ ...inputStyle, padding: "6px 10px" }} placeholder="0.00" />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => saveStratSection("tier-prices", { tier_prices: { legendary: tierLegendary ? parseFloat(tierLegendary) : undefined, epic: tierEpic ? parseFloat(tierEpic) : undefined, rare: tierRare ? parseFloat(tierRare) : undefined, common: tierCommon ? parseFloat(tierCommon) : undefined } }, editWave!.waveNumber)}
                    disabled={stratSaving === "tier-prices"}
                    className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: "#41afeb", opacity: stratSaving === "tier-prices" ? 0.6 : 1 }}>
                    {stratSaving === "tier-prices" ? "Saving…" : "Save Tier Prices"}
                  </button>
                </div>

                {/* Artist Edition */}
                <div className="p-3 rounded-xl mb-3" style={{ background: "#fafafa", border: "1px solid #e5e7eb" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold" style={{ color: "#24315f" }}>Artist Edition</span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={artistEnabled} onChange={e => setArtistEnabled(e.target.checked)} className="w-4 h-4" />
                      <span className="text-xs text-gray-500">Enable</span>
                    </label>
                  </div>
                  {artistEnabled && (
                    <div className="space-y-2">
                      <div>
                        <label style={labelStyle}>Artist Name</label>
                        <input type="text" value={artistName} onChange={e => setArtistName(e.target.value)} style={inputStyle} placeholder="Artist / Creator Name" />
                      </div>
                      <div>
                        <label style={labelStyle}>Artist Wallet</label>
                        <input type="text" value={artistWallet} onChange={e => setArtistWallet(e.target.value)} style={inputStyle} placeholder="0x..." />
                      </div>
                      <div>
                        <label style={labelStyle}>Royalty BPS (0–1000 = 0–10%)</label>
                        <input type="number" min={0} max={1000} value={artistRoyaltyBps} onChange={e => setArtistRoyaltyBps(e.target.value)} style={inputStyle} placeholder="e.g. 250 = 2.5%" />
                      </div>
                      <button onClick={() => saveStratSection("artist-config", { artist_name: artistName, artist_wallet: artistWallet, artist_royalty_bps: parseInt(artistRoyaltyBps), is_artist_edition: true }, editWave!.waveNumber)}
                        disabled={stratSaving === "artist-config"}
                        className="w-full py-1.5 rounded-lg text-xs font-semibold text-white"
                        style={{ background: "#7c3aed", opacity: stratSaving === "artist-config" ? 0.6 : 1 }}>
                        {stratSaving === "artist-config" ? "Saving…" : "Save Artist Config"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Holder Priority Window */}
                <div className="p-3 rounded-xl" style={{ background: "#fafafa", border: "1px solid #e5e7eb" }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#24315f" }}>Holder Priority Window</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label style={labelStyle}>Priority Start</label>
                      <input type="datetime-local" value={holderPriorityStart} onChange={e => setHolderPriorityStart(e.target.value)} style={{ ...inputStyle, fontSize: "12px" }} />
                    </div>
                    <div>
                      <label style={labelStyle}>Priority End</label>
                      <input type="datetime-local" value={holderPriorityEnd} onChange={e => setHolderPriorityEnd(e.target.value)} style={{ ...inputStyle, fontSize: "12px" }} />
                    </div>
                  </div>
                  <button onClick={() => saveStratSection("holder-priority", { start: holderPriorityStart ? new Date(holderPriorityStart).toISOString() : undefined, end: holderPriorityEnd ? new Date(holderPriorityEnd).toISOString() : undefined }, editWave!.waveNumber)}
                    disabled={stratSaving === "holder-priority"}
                    className="mt-2 w-full py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: "#41afeb", opacity: stratSaving === "holder-priority" ? 0.6 : 1 }}>
                    {stratSaving === "holder-priority" ? "Saving…" : "Save Priority Window"}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #e5e7eb" }}>
              <button onClick={() => setEditWave(null)} className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: saving ? "#9bafc5" : "#41afeb" }}>
                {saving ? "Saving…" : "Save DB"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ On-Chain Action Modal ══════════════════════════════════════════════════ */}
      {chainWave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
          <div className="bg-white rounded-2xl shadow-xl flex flex-col"
            style={{ width: "100%", maxWidth: 600, maxHeight: "92vh", border: "1px solid #e5e7eb" }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
              style={{ borderBottom: "1px solid #e5e7eb", background: "rgba(65,175,235,0.04)" }}>
              <div>
                <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>
                  ⛓ Wave {chainWave.waveNumber} — {chainWave.name} — On-Chain Actions
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                  Each action submits a blockchain transaction. Wait for confirmation before proceeding.
                </p>
              </div>
              <button onClick={() => { setChainWave(null); setChainTx(null); setChainError(null); }}
                style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-5">

              {chainLoading && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "#9bafc5" }}>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Reading on-chain state…
                </div>
              )}

              {/* On-chain status */}
              {chainOnChain && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Sold",     value: `${chainOnChain.soldCount} / ${chainOnChain.qty}` },
                    { label: "Price",    value: `${chainOnChain.price} ETH` },
                    { label: "Closed",   value: chainOnChain.closed ? "Yes" : "No" },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                      <p className="text-xs" style={{ color: "#9bafc5" }}>{s.label}</p>
                      <p className="font-bold text-sm mt-0.5" style={{ color: "#24315f" }}>{s.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {chainTx   && <TxBanner txHash={chainTx} />}
              {chainError && <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>{chainError}</div>}

              {/* 1 — Set Schedule */}
              <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <p className="text-xs font-bold" style={{ color: "#24315f" }}>1. Set Wave Schedule On-Chain</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Start Time</label>
                    <input type="datetime-local" value={chainStart} onChange={e => setChainStart(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>End Time</label>
                    <input type="datetime-local" value={chainEnd}  onChange={e => setChainEnd(e.target.value)}   style={inputStyle} />
                  </div>
                </div>
                <button onClick={handleSetScheduleOnChain} disabled={chainSaving === "schedule"}
                  className="px-4 py-2 text-xs font-bold text-white rounded-lg"
                  style={{ background: chainSaving === "schedule" ? "#9bafc5" : "#41afeb" }}>
                  {chainSaving === "schedule" ? "Submitting…" : "Push Schedule to Chain"}
                </button>
              </div>

              {/* 2 — Set Price (only if not locked and Wave > 1) */}
              {!chainWave.priceLocked && chainWave.waveNumber > 1 && (
                <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                  <p className="text-xs font-bold" style={{ color: "#24315f" }}>2. Update Wave Price On-Chain</p>
                  <p className="text-xs" style={{ color: "#9bafc5" }}>Only allowed before first sale in this wave.</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label style={labelStyle}>Price (ETH)</label>
                      <input type="number" step="0.0001" min="0" value={chainPrice}
                        onChange={e => setChainPrice(e.target.value)} style={inputStyle} />
                    </div>
                    <button onClick={handleSetPriceOnChain} disabled={chainSaving === "price"}
                      className="px-4 py-2 text-xs font-bold text-white rounded-lg flex-shrink-0"
                      style={{ background: chainSaving === "price" ? "#9bafc5" : "#41afeb" }}>
                      {chainSaving === "price" ? "Submitting…" : "Set Price"}
                    </button>
                  </div>
                </div>
              )}
              {chainWave.priceLocked && (
                <div className="px-4 py-3 rounded-xl text-xs" style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>
                  Price is locked — first sale has already occurred in this wave.
                </div>
              )}

              {/* 3 — Auction (Waves 3–7 only) */}
              {chainWave.waveNumber >= 3 && !chainOnChain?.closed && (
                <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                  <p className="text-xs font-bold" style={{ color: "#24315f" }}>3. Record OpenSea Auction Listing (off-chain)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label style={labelStyle}>OpenSea Listing ID</label>
                      <input type="text" value={auctionListingId} onChange={e => setAuctionListingId(e.target.value)}
                        style={inputStyle} placeholder="listing-id from OpenSea" />
                    </div>
                    <div>
                      <label style={labelStyle}>Start Price (ETH)</label>
                      <input type="number" step="0.001" value={auctionStartPrice} onChange={e => setAuctionStartPrice(e.target.value)}
                        style={inputStyle} placeholder="0.0303" />
                    </div>
                  </div>
                  <button onClick={handleSaveAuctionListing} disabled={chainSaving === "auction"}
                    className="px-4 py-2 text-xs font-bold text-white rounded-lg"
                    style={{ background: chainSaving === "auction" ? "#9bafc5" : "#7c3aed" }}>
                    {chainSaving === "auction" ? "Saving…" : "Save Auction Listing"}
                  </button>
                </div>
              )}

              {/* 4 — Mint & Transfer (Waves 3–7 after auction) */}
              {chainWave.waveNumber >= 3 && !chainOnChain?.closed && (
                <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                  <p className="text-xs font-bold" style={{ color: "#24315f" }}>4. Mint & Transfer to Auction Winner</p>
                  <p className="text-xs" style={{ color: "#9bafc5" }}>After OpenSea auction settles — mints the NFT directly to the winner.</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label style={labelStyle}>Winner Address</label>
                      <input type="text" value={auctionTo} onChange={e => setAuctionTo(e.target.value)}
                        style={inputStyle} placeholder="0x..." />
                    </div>
                    <div>
                      <label style={labelStyle}>Qty</label>
                      <input type="number" min="1" value={auctionQty} onChange={e => setAuctionQty(e.target.value)}
                        style={inputStyle} />
                    </div>
                  </div>
                  <button onClick={handleMintTransfer} disabled={chainSaving === "mint-transfer"}
                    className="px-4 py-2 text-xs font-bold text-white rounded-lg"
                    style={{ background: chainSaving === "mint-transfer" ? "#9bafc5" : "#41afeb" }}>
                    {chainSaving === "mint-transfer" ? "Submitting tx…" : "Mint & Transfer On-Chain"}
                  </button>
                </div>
              )}

              {/* 5 — Dutch Auction Config (only when not free_mint and not already dutch_auction) */}
              {chainWave.saleMethod !== "free_mint" && chainWave.saleMethod !== "dutch_auction" && !chainOnChain?.closed && (
                <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                  <p className="text-xs font-bold" style={{ color: "#24315f" }}>5. Configure Dutch Auction</p>
                  <p className="text-xs" style={{ color: "#9bafc5" }}>
                    Price automatically decrements each interval until floor is reached or NFT is purchased.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label style={labelStyle}>Start Price (ETH)</label>
                      <input type="number" step="0.0001" min="0" value={dutchStartPrice}
                        onChange={e => setDutchStartPrice(e.target.value)} style={inputStyle} placeholder="0.1" />
                    </div>
                    <div>
                      <label style={labelStyle}>Floor Price (ETH)</label>
                      <input type="number" step="0.0001" min="0" value={dutchFloorPrice}
                        onChange={e => setDutchFloorPrice(e.target.value)} style={inputStyle} placeholder="0.01" />
                    </div>
                    <div>
                      <label style={labelStyle}>Decrement per Interval (ETH)</label>
                      <input type="number" step="0.0001" min="0" value={dutchDecrement}
                        onChange={e => setDutchDecrement(e.target.value)} style={inputStyle} placeholder="0.005" />
                    </div>
                    <div>
                      <label style={labelStyle}>Interval (seconds)</label>
                      <input type="number" step="1" min="1" value={dutchInterval}
                        onChange={e => setDutchInterval(e.target.value)} style={inputStyle} placeholder="300" />
                    </div>
                  </div>
                  <button onClick={handleSetDutchAuction} disabled={chainSaving === "dutch"}
                    className="px-4 py-2 text-xs font-bold text-white rounded-lg"
                    style={{ background: chainSaving === "dutch" ? "#9bafc5" : "#d97706" }}>
                    {chainSaving === "dutch" ? "Submitting…" : "Set Dutch Auction"}
                  </button>
                </div>
              )}

              {/* Dutch Auction — read-only view when already configured */}
              {chainWave.saleMethod === "dutch_auction" && (
                <div className="space-y-3 p-4 rounded-xl" style={{ background: "#f9fafb", border: "1px solid rgba(217,119,6,0.3)" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold" style={{ color: "#d97706" }}>5. Dutch Auction — Active</p>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: "rgba(217,119,6,0.1)", color: "#d97706" }}>
                      Dutch Auction
                    </span>
                  </div>
                  {dutchCurrentPrice != null ? (
                    <div className="p-3 rounded-xl text-center" style={{ background: "white", border: "1px solid #e5e7eb" }}>
                      <p className="text-xs" style={{ color: "#9bafc5" }}>Current Price</p>
                      <p className="font-bold text-lg mt-0.5" style={{ color: "#d97706" }}>{dutchCurrentPrice} ETH</p>
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: "#9bafc5" }}>Current price unavailable.</p>
                  )}
                </div>
              )}

              {/* 6 — Close Wave */}
              {!chainOnChain?.closed && (
                <div className="space-y-3 p-4 rounded-xl" style={{ background: "rgba(220,38,38,0.03)", border: "1px solid #fecaca" }}>
                  <p className="text-xs font-bold" style={{ color: "#dc2626" }}>6. Close Wave (irreversible)</p>
                  <p className="text-xs" style={{ color: "#9bafc5" }}>
                    Only available after wave end time. Choose what happens to unsold NFTs:
                  </p>
                  <div className="flex gap-3">
                    <button onClick={handleCloseTreasury} disabled={!!chainSaving}
                      className="flex-1 py-2.5 text-xs font-bold rounded-xl"
                      style={{ background: "rgba(22,163,74,0.08)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.3)" }}>
                      {chainSaving === "treasury" ? "Minting…" : "Mint Unsold → Treasury"}
                    </button>
                    <button onClick={handleCloseBurn} disabled={!!chainSaving}
                      className="flex-1 py-2.5 text-xs font-bold rounded-xl"
                      style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid #fecaca" }}>
                      {chainSaving === "burn" ? "Burning…" : "Burn Unsold (permanent gaps)"}
                    </button>
                  </div>
                </div>
              )}

              {chainOnChain?.closed && (
                <div className="px-4 py-3 rounded-xl text-xs text-center"
                  style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.3)", color: "#16a34a" }}>
                  Wave {chainWave.waveNumber} is closed on-chain. No further actions available.
                </div>
              )}

              {/* 7 — Reveal Wave */}
              {chainWave.waveClosed && !chainWave.waveRevealed ? (
                <div className="space-y-3 p-4 rounded-xl" style={{ background: "rgba(124,58,237,0.03)", border: "1px solid rgba(124,58,237,0.25)" }}>
                  <p className="text-xs font-bold" style={{ color: "#7c3aed" }}>7. Reveal This Wave</p>
                  <p className="text-xs" style={{ color: "#9bafc5" }}>
                    Wave is closed. Upload metadata to IPFS first, then set the reveal URI to expose real NFT images.
                  </p>
                  <div>
                    <label style={labelStyle}>Reveal URI (IPFS)</label>
                    <input type="text" value={revealWaveUri} onChange={e => setRevealWaveUri(e.target.value)}
                      style={inputStyle} placeholder="ipfs://Qm..." />
                  </div>
                  <button onClick={handleRevealWave} disabled={chainSaving === "reveal-wave" || !revealWaveUri}
                    className="px-4 py-2 text-xs font-bold text-white rounded-lg"
                    style={{ background: chainSaving === "reveal-wave" || !revealWaveUri ? "#9bafc5" : "#7c3aed" }}>
                    {chainSaving === "reveal-wave" ? "Submitting tx…" : "Reveal This Wave"}
                  </button>
                </div>
              ) : chainWave.waveRevealed ? (
                <div className="px-4 py-3 rounded-xl text-xs flex items-center gap-2"
                  style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.3)", color: "#16a34a" }}>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Revealed ✓
                </div>
              ) : null}

              {/* 8 — Holder Priority Merkle */}
              <div className="space-y-3 p-4 rounded-xl" style={{ background: "rgba(65,175,235,0.03)", border: "1px solid rgba(65,175,235,0.2)" }}>
                <p className="text-xs font-bold" style={{ color: "#41afeb" }}>8. Holder Priority / Merkle Root</p>
                <p className="text-xs" style={{ color: "#9bafc5" }}>
                  Snapshot current NFT holders, build a wave-scoped Merkle tree, and set on-chain for holder-priority / collab allowlists.
                </p>
                <div className="flex gap-3">
                  <button
                    disabled={snapshotLoading}
                    onClick={async () => {
                      setSnapshotLoading(true); setChainError(null);
                      try {
                        const r = await fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/holder-snapshot`, { credentials: "include" });
                        const d = await r.json();
                        setSnapshotWallets(d.holders ?? []);
                      } catch { setChainError("Snapshot failed"); }
                      finally { setSnapshotLoading(false); }
                    }}
                    className="flex-1 py-2 text-xs font-bold rounded-xl"
                    style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb", border: "1px solid rgba(65,175,235,0.3)" }}>
                    {snapshotLoading ? "Snapshotting…" : `Run Snapshot${snapshotWallets.length ? ` (${snapshotWallets.length} holders)` : ""}`}
                  </button>
                  <button
                    disabled={!!chainSaving || snapshotWallets.length === 0}
                    onClick={async () => {
                      setChainSaving("holder-merkle"); setChainError(null); setChainTx(null);
                      try {
                        const r = await fetch(`/api/nft-sell/waves/${chainWave!.waveNumber}/holder-merkle`, {
                          method: "POST", credentials: "include",
                          headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
                        });
                        const d = await r.json();
                        if (!r.ok) { setChainError(d.error ?? "Merkle generation failed"); return; }
                        if (d.txHash) setChainTx(d.txHash);
                      } catch { setChainError("Network error"); }
                      finally { setChainSaving(null); }
                    }}
                    className="flex-1 py-2 text-xs font-bold text-white rounded-xl"
                    style={{ background: snapshotWallets.length === 0 ? "#9bafc5" : "#41afeb", opacity: chainSaving === "holder-merkle" ? 0.6 : 1 }}>
                    {chainSaving === "holder-merkle" ? "Setting on-chain…" : "Generate & Set Merkle Root"}
                  </button>
                </div>
                {snapshotWallets.length > 0 && (
                  <p className="text-xs" style={{ color: "#9bafc5" }}>
                    {snapshotWallets.length} holder address(es) will be included in the Merkle tree.
                  </p>
                )}
              </div>

            </div>

            <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: "1px solid #e5e7eb" }}>
              <button onClick={() => { setChainWave(null); setChainTx(null); setChainError(null); }}
                className="px-4 py-2 text-sm font-medium rounded-lg w-full"
                style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
