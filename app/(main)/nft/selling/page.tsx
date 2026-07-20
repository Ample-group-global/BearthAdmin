"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollectionConfig {
  current_phase: string;
  provenance_hash: string | null;
  blind_box_uri: string | null;
  reveal_uri: string | null;
  reveal_count: number;
  total_counter: number;
  max_supply: number;
  treasury_wallet: string | null;
  royalty_enforced: boolean;
  purchase_limit_enabled: boolean;
  normal_max_per_wallet: number;
  sbt_enabled: boolean;
  wave_reveal_mode: string;
  synced_at: string | null;
}

interface OnChainInfo {
  currentPhase: number;
  maxSupply: number;
  totalMinted: number;
  revealCount: number;
  sbt: boolean;
  royaltyEnforced: boolean;
  purchaseLimitEnabled: boolean;
  normalMaxPerWallet: number;
}

interface SaleMode { code: string; label: string; category: string; }
interface Currency { code: string; label: string; symbol: string; }

interface AdminSale {
  id: string;
  sale_mode: string;
  buyer_address: string;
  quantity: number;
  amount_paid_eth: number | null;
  payment_currency: string;
  payment_ref: string | null;
  wave_number: number;
  status: string;
  tx_hash: string | null;
  notes: string | null;
  created_at: string;
  minted_at: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_NAMES = ["Whitelist", "PaidMint", "Revealed"];
const PHASE_COLORS: Record<string, { bg: string; color: string }> = {
  Whitelist: { bg: "rgba(124,58,237,0.1)",  color: "#7c3aed" },
  PaidMint:  { bg: "rgba(65,175,235,0.12)", color: "#41afeb" },
  Revealed:  { bg: "rgba(22,163,74,0.1)",   color: "#16a34a" },
};
const TABS = ["Mint Operations", "Admin Sales", "Collection & Controls"] as const;
type Tab = typeof TABS[number];

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 700,
  color: "#9bafc5", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em",
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: "8px",
  border: "1px solid #e5e7eb", fontSize: "13px", color: "#111827", outline: "none",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TxBanner({ txHash, onDismiss }: { txHash: string; onDismiss?: () => void }) {
  return (
    <div className="px-4 py-3 rounded-xl text-xs flex items-center gap-2"
      style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)", color: "#16a34a" }}>
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span className="flex-1">Tx: <span className="font-mono">{txHash.slice(0, 22)}…</span></span>
      {onDismiss && <button onClick={onDismiss} style={{ color: "#16a34a", fontSize: 16 }}>✕</button>}
    </div>
  );
}

function ErrBanner({ msg, onDismiss }: { msg: string; onDismiss?: () => void }) {
  return (
    <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2"
      style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
      <span className="flex-1">{msg}</span>
      {onDismiss && <button onClick={onDismiss} style={{ fontSize: 16 }}>✕</button>}
    </div>
  );
}

function OkBanner({ msg }: { msg: string }) {
  return (
    <div className="px-4 py-3 rounded-xl text-xs flex items-center gap-2"
      style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)", color: "#16a34a" }}>
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      {msg}
    </div>
  );
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!value)} disabled={disabled}
      className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors"
      style={{ background: value ? "#41afeb" : "#d1d5db", opacity: disabled ? 0.5 : 1 }}>
      <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-1"
        style={{ transform: value ? "translateX(24px)" : "translateX(4px)" }} />
    </button>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  const c = PHASE_COLORS[phase] ?? PHASE_COLORS.Whitelist;
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold"
      style={{ background: c.bg, color: c.color }}>
      <span className="w-2 h-2 rounded-full inline-block" style={{ background: c.color }} />
      {phase}
    </span>
  );
}

function SaleStatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    minted:   { bg: "rgba(22,163,74,0.1)",   color: "#16a34a" },
    pending:  { bg: "rgba(217,119,6,0.1)",   color: "#d97706" },
    failed:   { bg: "rgba(220,38,38,0.1)",   color: "#dc2626" },
    refunded: { bg: "rgba(107,114,128,0.1)", color: "#6b7280" },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: c.bg, color: c.color }}>{status}</span>
  );
}

function SectionCard({ title, subtitle, accent, children }: {
  title: string; subtitle?: string; accent?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm"
      style={{ border: `1px solid ${accent ?? "#e5e7eb"}`, background: accent ? `${accent}04` : "white" }}>
      <div className="px-6 py-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
        <h2 className="text-sm font-bold" style={{ color: accent ?? "#24315f" }}>{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{subtitle}</p>}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SellingPage() {
  const [tab, setTab] = useState<Tab>("Mint Operations");

  // Data
  const [config, setConfig]       = useState<CollectionConfig | null>(null);
  const [onChain, setOnChain]     = useState<OnChainInfo | null>(null);
  const [saleModes, setSaleModes] = useState<SaleMode[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [sales, setSales]         = useState<AdminSale[]>([]);
  const [salesTotal, setSalesTotal] = useState(0);
  const [events, setEvents]       = useState<{ id: string; event_name: string; tx_hash: string; block_number: number; processed_at: string }[]>([]);

  // UI state
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [tx, setTx]               = useState<string | null>(null);
  const [opError, setOpError]     = useState<string | null>(null);
  const [opOk, setOpOk]           = useState<string | null>(null);
  const [saving, setSaving]       = useState<string | null>(null);

  // Phase
  const [phaseTarget, setPhaseTarget] = useState<number>(1);

  // VIP
  const [vipAddress, setVipAddress] = useState("");
  const [vipStatus, setVipStatus]   = useState(true);

  // Purchase limits
  const [limitEnabled, setLimitEnabled] = useState(true);
  const [maxPerWallet, setMaxPerWallet] = useState("5");

  // SBT
  const [sbtEnabled, setSbtEnabled] = useState(false);

  // Admin mint
  const [mintTo, setMintTo]     = useState("");
  const [mintQty, setMintQty]   = useState("1");

  // Merkle root
  const [merkleRoot, setMerkleRoot] = useState("");

  // Reveal
  const [revealUri, setRevealUri] = useState("");

  // Treasury
  const [treasury, setTreasury] = useState("");

  // Provenance
  const [provHash, setProvHash] = useState("");

  // Admin sale creation
  const [saleForm, setSaleForm] = useState({
    saleMode: "offline_cash", buyerAddress: "", quantity: "1",
    amountPaidEth: "", paymentCurrency: "ETH",
    paymentRef: "", waveNumber: "2", notes: "", mintNow: true,
  });
  const [saleResult, setSaleResult] = useState<{ saleId: string; txHash?: string; status: string } | null>(null);

  // Sales filter
  const [salesStatus, setSalesStatus] = useState("");
  const [salesOffset, setSalesOffset] = useState(0);
  const SALES_LIMIT = 20;

  // ── Load ──

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [colData, lookupsData, evData] = await Promise.all([
        fetch("/api/nft-sell/collection",         { credentials: "include" }).then(r => r.json()),
        fetch("/api/nft-sell/lookups",            { credentials: "include" }).then(r => r.json()),
        fetch("/api/nft-sell/collection/events?limit=20", { credentials: "include" }).then(r => r.json()),
      ]);
      const cfg: CollectionConfig = colData.config ?? null;
      const oc: OnChainInfo | null = colData.onChain ?? null;
      setConfig(cfg);
      setOnChain(oc);
      if (cfg) {
        setLimitEnabled(cfg.purchase_limit_enabled);
        setMaxPerWallet(String(cfg.normal_max_per_wallet));
        setSbtEnabled(cfg.sbt_enabled);
        if (cfg.treasury_wallet) setTreasury(cfg.treasury_wallet);
      }
      if (oc) setPhaseTarget(Math.min(oc.currentPhase + 1, 2));
      setSaleModes(lookupsData.saleModes ?? []);
      setCurrencies(lookupsData.currencies ?? []);
      setEvents(evData.events ?? []);
    } catch {
      setError("Failed to load collection data.");
    } finally {
      setLoading(false);
    }
  };

  const loadSales = async (offset = 0, status = "") => {
    const params = new URLSearchParams({ limit: String(SALES_LIMIT), offset: String(offset) });
    if (status) params.set("status", status);
    const d = await fetch(`/api/nft-sell/admin-sales?${params}`, { credentials: "include" }).then(r => r.json());
    setSales(d.sales ?? []);
    setSalesTotal(d.total ?? 0);
    setSalesOffset(offset);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === "Admin Sales") loadSales(0, salesStatus); }, [tab]);

  // ── Op helper ──

  const doOp = async (opName: string, fn: () => Promise<Response>, okMsg?: string) => {
    setSaving(opName); setOpError(null); setTx(null); setOpOk(null);
    try {
      const res = await fn();
      const d   = await res.json();
      if (!res.ok) { setOpError(d.error ?? `${opName} failed.`); return; }
      if (d.txHash) setTx(d.txHash);
      if (okMsg)    setOpOk(okMsg);
      await load();
    } catch { setOpError("Network error."); }
    finally { setSaving(null); }
  };

  // ── Handlers ──

  const handleSetPhase = () =>
    doOp("phase", () => fetch("/api/nft-sell/collection/phase", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase: phaseTarget }),
    }));

  const handleSetVIP = () => {
    if (!vipAddress) { setOpError("Wallet address required."); return; }
    doOp("vip", () => fetch(`/api/nft-sell/customers/${vipAddress}/vip`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVip: vipStatus }),
    }), vipStatus ? "VIP granted." : "VIP revoked.");
  };

  const handleSaveLimits = () =>
    doOp("limits", () => fetch("/api/nft-sell/customers/limits", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: limitEnabled, normalMaxPerWallet: parseInt(maxPerWallet, 10) }),
    }));

  const handleSetSBT = () =>
    doOp("sbt", () => fetch("/api/nft-sell/collection/sbt", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: sbtEnabled }),
    }));

  const handleAdminMint = () => {
    if (!/^0x[a-fA-F0-9]{40}$/.test(mintTo)) { setOpError("Valid 0x wallet address required."); return; }
    const qty = parseInt(mintQty, 10);
    if (!qty || qty < 1) { setOpError("Quantity must be >= 1."); return; }
    doOp("admin-mint", () => fetch("/api/nft-sell/collection/admin-mint", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: mintTo, qty }),
    }));
  };

  const handleSetMerkleRoot = () => {
    if (!merkleRoot) { setOpError("Merkle root required."); return; }
    doOp("merkle", () => fetch("/api/nft-sell/collection/merkle-root", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root: merkleRoot }),
    }), "Merkle root updated on-chain.");
  };

  const handleReveal = () => {
    if (!revealUri.startsWith("ipfs://")) { setOpError("Reveal URI must start with ipfs://"); return; }
    doOp("reveal", () => fetch("/api/nft-sell/collection/reveal", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ revealUri }),
    }));
  };

  const handleSetProvenance = () => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(provHash)) {
      setOpError("Provenance hash must be 0x + 64 hex characters."); return;
    }
    doOp("provenance", () => fetch("/api/nft-sell/collection/provenance", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash: provHash }),
    }));
  };

  const handleSetTreasury = () => {
    if (!treasury) { setOpError("Wallet address required."); return; }
    doOp("treasury", () => fetch("/api/nft-sell/collection/treasury", {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: treasury }),
    }));
  };

  const handleWithdraw = () =>
    doOp("withdraw", () => fetch("/api/nft-sell/collection/withdraw", { method: "POST", credentials: "include" }));

  const handlePause = (pause: boolean) =>
    doOp(pause ? "pause" : "unpause", () => fetch(
      `/api/nft-sell/collection/${pause ? "pause" : "unpause"}`,
      { method: "POST", credentials: "include" }
    ));

  const handleCreateSale = async () => {
    const qty = parseInt(saleForm.quantity, 10);
    if (!saleForm.buyerAddress) { setOpError("Buyer address required."); return; }
    if (!qty || qty < 1)        { setOpError("Quantity must be >= 1."); return; }
    setSaving("sale"); setOpError(null); setSaleResult(null);
    try {
      const res = await fetch("/api/nft-sell/admin-sales", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleMode:        saleForm.saleMode,
          buyerAddress:    saleForm.buyerAddress,
          quantity:        qty,
          amountPaidEth:   saleForm.amountPaidEth || undefined,
          paymentCurrency: saleForm.paymentCurrency,
          paymentRef:      saleForm.paymentRef    || undefined,
          waveNumber:      parseInt(saleForm.waveNumber, 10),
          notes:           saleForm.notes         || undefined,
          mintNow:         saleForm.mintNow,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setOpError(d.error ?? "Sale creation failed."); return; }
      setSaleResult({ saleId: d.saleId, txHash: d.txHash, status: d.status });
      setSaleForm(f => ({ ...f, buyerAddress: "", quantity: "1", amountPaidEth: "", paymentRef: "", notes: "" }));
      loadSales(0, salesStatus);
    } catch { setOpError("Network error."); }
    finally { setSaving(null); }
  };

  const handleMintPending = async (saleId: string) => {
    setSaving(`mint-${saleId}`); setOpError(null);
    try {
      const res = await fetch(`/api/nft-sell/admin-sales/${saleId}/mint`, { method: "POST", credentials: "include" });
      const d = await res.json();
      if (!res.ok) { setOpError(d.error ?? "Mint failed."); return; }
      setTx(d.txHash);
      loadSales(salesOffset, salesStatus);
    } catch { setOpError("Network error."); }
    finally { setSaving(null); }
  };

  // ── Derived ──

  const mintProgress = onChain ? Math.round((onChain.totalMinted / onChain.maxSupply) * 100) : 0;
  const phaseName    = config?.current_phase ?? "Whitelist";

  // ─── Loading ──

  if (loading) return (
    <div className="flex items-center justify-center h-64" style={{ color: "#9bafc5" }}>
      <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Loading…
    </div>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* ── Sticky header strip ── */}
      <div className="flex-shrink-0 px-5 pt-5 pb-0 space-y-4" style={{ background: "#f0f2f7" }}>

        {/* Title + phase + refresh */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "#24315f" }}>NFT Selling</h1>
            <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
              Phase control · admin sales · VIP · purchase limits · reveal · emergency controls
            </p>
          </div>
          <div className="flex items-center gap-3">
            {config && <PhaseBadge phase={phaseName} />}
            <button onClick={load}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "white" }}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* Stats strip */}
        {onChain && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: "Phase",         value: phaseName,                                          color: PHASE_COLORS[phaseName]?.color ?? "#41afeb" },
              { label: "Minted",        value: `${onChain.totalMinted.toLocaleString()} / ${onChain.maxSupply.toLocaleString()}`, color: "#41afeb" },
              { label: "Progress",      value: `${mintProgress}%`,                                 color: mintProgress === 100 ? "#16a34a" : "#d97706" },
              { label: "Revealed",      value: String(onChain.revealCount),                        color: "#7c3aed" },
              { label: "Max/Wallet",    value: onChain.purchaseLimitEnabled ? String(onChain.normalMaxPerWallet) : "Unlimited", color: "#24315f" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl px-3 py-2.5 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#9bafc5" }}>{s.label}</p>
                <p className="text-sm font-bold mt-0.5" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Mint progress bar */}
        {onChain && (
          <div className="bg-white rounded-xl px-4 py-3 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#9bafc5" }}>Mint Progress</span>
              <span className="text-xs font-bold" style={{ color: "#24315f" }}>{onChain.totalMinted.toLocaleString()} / 9,999</span>
            </div>
            <div className="h-1.5 rounded-full" style={{ background: "#e5e7eb" }}>
              <div className="h-1.5 rounded-full transition-all"
                style={{ width: `${mintProgress}%`, background: mintProgress === 100 ? "#16a34a" : "#41afeb" }} />
            </div>
          </div>
        )}

        {/* Global feedback */}
        {error    && <ErrBanner msg={error} />}
        {tx       && <TxBanner txHash={tx} onDismiss={() => setTx(null)} />}
        {opError  && <ErrBanner msg={opError} onDismiss={() => setOpError(null)} />}
        {opOk     && <OkBanner msg={opOk} />}

        {/* Tabs */}
        <div className="flex gap-1 border-b" style={{ borderColor: "#e5e7eb" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 text-xs font-semibold rounded-t-lg -mb-px transition-colors"
              style={tab === t
                ? { background: "white", color: "#41afeb", border: "1px solid #e5e7eb", borderBottom: "1px solid white" }
                : { color: "#9bafc5", border: "1px solid transparent" }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">

        {/* ════════════════════════════════════════════════════════════
            TAB 1 — Mint Operations
        ════════════════════════════════════════════════════════════ */}
        {tab === "Mint Operations" && (<>

          {/* Phase Control */}
          <SectionCard title="Phase Control" subtitle="Advance the mint phase on-chain. Order: Whitelist → PaidMint → Revealed (one-way, irreversible).">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {PHASE_NAMES.map((name, idx) => {
                  const current = onChain ? onChain.currentPhase : -1;
                  const isPast    = idx < current;
                  const isCurrent = idx === current;
                  const c = PHASE_COLORS[name];
                  return (
                    <button key={name}
                      onClick={() => setPhaseTarget(idx)}
                      disabled={idx <= current}
                      className="p-3 rounded-xl text-left space-y-1 transition-all"
                      style={{
                        border: `1px solid ${phaseTarget === idx && idx > current ? c.color : "#e5e7eb"}`,
                        background: isPast ? "#f9fafb" : isCurrent ? `${c.color}10` : phaseTarget === idx ? `${c.color}08` : "white",
                        opacity: idx < current ? 0.5 : 1,
                        cursor: idx <= current ? "not-allowed" : "pointer",
                      }}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: isPast ? "#9bafc5" : c.color }} />
                        <span className="text-xs font-bold" style={{ color: isPast ? "#9bafc5" : c.color }}>{name}</span>
                      </div>
                      <p className="text-[10px]" style={{ color: "#9bafc5" }}>
                        {isPast ? "Complete" : isCurrent ? "Current phase" : "Next phase"}
                      </p>
                    </button>
                  );
                })}
              </div>
              {onChain && phaseTarget > onChain.currentPhase && (
                <div className="px-4 py-3 rounded-xl text-xs"
                  style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)", color: "#d97706" }}>
                  This will advance from <strong>{PHASE_NAMES[onChain.currentPhase]}</strong> → <strong>{PHASE_NAMES[phaseTarget]}</strong>. This is irreversible.
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={handleSetPhase}
                  disabled={saving === "phase" || !onChain || phaseTarget <= onChain.currentPhase}
                  className="px-5 py-2 text-xs font-bold text-white rounded-xl"
                  style={{ background: saving === "phase" || !onChain || phaseTarget <= onChain.currentPhase ? "#9bafc5" : "#7c3aed" }}>
                  {saving === "phase" ? "Submitting…" : `Advance to ${PHASE_NAMES[phaseTarget]}`}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* VIP Customer Management */}
          <SectionCard title="VIP Customer Management" subtitle="VIP wallets bypass the per-wallet purchase limit — they can mint any quantity.">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label style={labelStyle}>Wallet Address</label>
                  <input type="text" value={vipAddress} onChange={e => setVipAddress(e.target.value)}
                    style={{ ...inputStyle, fontFamily: "monospace" }} placeholder="0x…" />
                </div>
                <div>
                  <label style={labelStyle}>Action</label>
                  <div className="flex gap-2">
                    <button onClick={() => setVipStatus(true)}
                      className="flex-1 py-2 text-xs font-bold rounded-lg"
                      style={{
                        border: "1px solid", borderColor: vipStatus ? "#41afeb" : "#e5e7eb",
                        background: vipStatus ? "rgba(65,175,235,0.1)" : "white",
                        color: vipStatus ? "#41afeb" : "#6b7280",
                      }}>Grant VIP</button>
                    <button onClick={() => setVipStatus(false)}
                      className="flex-1 py-2 text-xs font-bold rounded-lg"
                      style={{
                        border: "1px solid", borderColor: !vipStatus ? "#dc2626" : "#e5e7eb",
                        background: !vipStatus ? "rgba(220,38,38,0.08)" : "white",
                        color: !vipStatus ? "#dc2626" : "#6b7280",
                      }}>Revoke VIP</button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleSetVIP} disabled={saving === "vip" || !vipAddress}
                  className="px-4 py-2 text-xs font-bold text-white rounded-xl"
                  style={{ background: saving === "vip" || !vipAddress ? "#9bafc5" : "#41afeb" }}>
                  {saving === "vip" ? "Submitting…" : "Set VIP On-Chain"}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Purchase Limits */}
          <SectionCard title="Purchase Limits" subtitle="Max NFTs a normal (non-VIP) wallet can mint across all waves.">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: limitEnabled ? "rgba(65,175,235,0.06)" : "#f9fafb", border: "1px solid #e5e7eb" }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#24315f" }}>Enable Purchase Limits</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                    {limitEnabled ? "ON — wallets capped at max below" : "OFF — anyone can buy any quantity"}
                  </p>
                </div>
                <Toggle value={limitEnabled} onChange={setLimitEnabled} />
              </div>
              {limitEnabled && (
                <div>
                  <label style={labelStyle}>Max NFTs per Normal Wallet</label>
                  <input type="number" min="1" max="9999" value={maxPerWallet}
                    onChange={e => setMaxPerWallet(e.target.value)}
                    style={{ ...inputStyle, maxWidth: 160 }} />
                  <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>
                    Current on-chain: {onChain?.normalMaxPerWallet ?? "?"}
                  </p>
                </div>
              )}
              <div className="flex justify-end">
                <button onClick={handleSaveLimits} disabled={saving === "limits"}
                  className="px-4 py-2 text-xs font-bold text-white rounded-xl"
                  style={{ background: saving === "limits" ? "#9bafc5" : "#41afeb" }}>
                  {saving === "limits" ? "Submitting…" : "Save Limits On-Chain"}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* SBT Toggle */}
          <SectionCard title="Soul Bound Token (SBT) Mode" subtitle="When enabled, minted NFTs cannot be transferred. They are permanently bound to the minting wallet.">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: sbtEnabled ? "rgba(220,38,38,0.04)" : "#f9fafb", border: "1px solid #e5e7eb" }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#24315f" }}>SBT Enabled</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                    {sbtEnabled ? "ON — NFTs are non-transferable (membership/access pass mode)" : "OFF — NFTs are fully tradeable on OpenSea"}
                  </p>
                </div>
                <Toggle value={sbtEnabled} onChange={setSbtEnabled} />
              </div>
              <div className="flex justify-end">
                <button onClick={handleSetSBT} disabled={saving === "sbt"}
                  className="px-4 py-2 text-xs font-bold text-white rounded-xl"
                  style={{ background: saving === "sbt" ? "#9bafc5" : "#24315f" }}>
                  {saving === "sbt" ? "Submitting…" : "Set SBT On-Chain"}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Whitelist Merkle Root */}
          <SectionCard title="Whitelist — Merkle Root" subtitle="Update the on-chain Merkle root for Wave 1 whitelist verification. Generate from BearthApi whitelist tool.">
            <div className="space-y-3">
              <div>
                <label style={labelStyle}>Merkle Root (bytes32)</label>
                <input type="text" value={merkleRoot} onChange={e => setMerkleRoot(e.target.value)}
                  style={{ ...inputStyle, fontFamily: "monospace" }} placeholder="0x…" />
              </div>
              <div className="flex justify-end">
                <button onClick={handleSetMerkleRoot} disabled={saving === "merkle" || !merkleRoot}
                  className="px-4 py-2 text-xs font-bold text-white rounded-xl"
                  style={{ background: saving === "merkle" || !merkleRoot ? "#9bafc5" : "#41afeb" }}>
                  {saving === "merkle" ? "Submitting…" : "⛓ Set Merkle Root On-Chain"}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Admin Mint */}
          <SectionCard title="Admin Mint" subtitle="Directly mint NFTs to any wallet (admin reserve, prizes, gifts). Does not count toward wallet purchase limits.">
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label style={labelStyle}>Recipient Wallet</label>
                  <input type="text" value={mintTo} onChange={e => setMintTo(e.target.value)}
                    style={{ ...inputStyle, fontFamily: "monospace" }} placeholder="0x…" />
                </div>
                <div>
                  <label style={labelStyle}>Quantity</label>
                  <input type="number" min="1" value={mintQty}
                    onChange={e => setMintQty(e.target.value)} style={inputStyle} />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleAdminMint} disabled={saving === "admin-mint"}
                  className="px-4 py-2 text-xs font-bold text-white rounded-xl"
                  style={{ background: saving === "admin-mint" ? "#9bafc5" : "#16a34a" }}>
                  {saving === "admin-mint" ? "Minting…" : "⛓ Admin Mint On-Chain"}
                </button>
              </div>
            </div>
          </SectionCard>

        </>)}

        {/* ════════════════════════════════════════════════════════════
            TAB 2 — Admin Sales
        ════════════════════════════════════════════════════════════ */}
        {tab === "Admin Sales" && (<>

          {/* Create sale */}
          <SectionCard title="Record Admin Sale" subtitle="Create a sale for offline, bank transfer, gift, or corporate purchases. Optionally mint on-chain immediately.">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Sale Mode</label>
                  <select value={saleForm.saleMode}
                    onChange={e => setSaleForm(f => ({ ...f, saleMode: e.target.value }))}
                    style={inputStyle}>
                    {saleModes.map(m => (
                      <option key={m.code} value={m.code}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Payment Currency</label>
                  <select value={saleForm.paymentCurrency}
                    onChange={e => setSaleForm(f => ({ ...f, paymentCurrency: e.target.value }))}
                    style={inputStyle}>
                    {currencies.map(c => (
                      <option key={c.code} value={c.code}>{c.label} ({c.code})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>Buyer Wallet Address</label>
                <input type="text" value={saleForm.buyerAddress}
                  onChange={e => setSaleForm(f => ({ ...f, buyerAddress: e.target.value }))}
                  style={{ ...inputStyle, fontFamily: "monospace" }} placeholder="0x…" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label style={labelStyle}>Quantity</label>
                  <input type="number" min="1" value={saleForm.quantity}
                    onChange={e => setSaleForm(f => ({ ...f, quantity: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Amount Paid (ETH)</label>
                  <input type="number" step="0.0001" min="0" value={saleForm.amountPaidEth}
                    onChange={e => setSaleForm(f => ({ ...f, amountPaidEth: e.target.value }))}
                    style={inputStyle} placeholder="0.0303" />
                </div>
                <div>
                  <label style={labelStyle}>Wave Number</label>
                  <input type="number" min="1" max="7" value={saleForm.waveNumber}
                    onChange={e => setSaleForm(f => ({ ...f, waveNumber: e.target.value }))}
                    style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Payment Ref / Invoice #</label>
                  <input type="text" value={saleForm.paymentRef}
                    onChange={e => setSaleForm(f => ({ ...f, paymentRef: e.target.value }))}
                    style={inputStyle} placeholder="INV-001" />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <input type="text" value={saleForm.notes}
                  onChange={e => setSaleForm(f => ({ ...f, notes: e.target.value }))}
                  style={inputStyle} placeholder="e.g. Sold at Singapore event, walk-in customer" />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Toggle value={saleForm.mintNow} onChange={v => setSaleForm(f => ({ ...f, mintNow: v }))} />
                  <span className="text-xs font-semibold" style={{ color: saleForm.mintNow ? "#16a34a" : "#9bafc5" }}>
                    {saleForm.mintNow ? "Mint on-chain immediately" : "Save as pending (mint later)"}
                  </span>
                </label>
                <button onClick={handleCreateSale} disabled={saving === "sale"}
                  className="px-5 py-2 text-xs font-bold text-white rounded-xl flex items-center gap-2"
                  style={{ background: saving === "sale" ? "#9bafc5" : "#41afeb" }}>
                  {saving === "sale" ? (
                    <><svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>Processing…</>
                  ) : saleForm.mintNow ? "⛓ Record + Mint Now" : "Save as Pending"}
                </button>
              </div>

              {saleResult && (
                <div className="p-4 rounded-xl space-y-1" style={{ background: "rgba(22,163,74,0.06)", border: "1px solid rgba(22,163,74,0.25)" }}>
                  <p className="text-xs font-bold" style={{ color: "#16a34a" }}>
                    Sale recorded — {saleResult.status === "minted" ? "minted on-chain" : "saved as pending"}
                  </p>
                  <p className="text-[10px] font-mono" style={{ color: "#6b7280" }}>ID: {saleResult.saleId}</p>
                  {saleResult.txHash && (
                    <p className="text-[10px] font-mono" style={{ color: "#6b7280" }}>Tx: {saleResult.txHash.slice(0, 22)}…</p>
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          {/* Sales list */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
            <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: "1px solid #e5e7eb" }}>
              <div>
                <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Admin Sales</h2>
                <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{salesTotal.toLocaleString()} total records</p>
              </div>
              <div className="flex gap-2">
                {["", "pending", "minted", "failed", "refunded"].map(s => (
                  <button key={s || "all"}
                    onClick={() => { setSalesStatus(s); loadSales(0, s); }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize"
                    style={{
                      border: "1px solid",
                      borderColor: salesStatus === s ? "#41afeb" : "#e5e7eb",
                      background: salesStatus === s ? "rgba(65,175,235,0.1)" : "white",
                      color: salesStatus === s ? "#41afeb" : "#6b7280",
                    }}>
                    {s || "All"}
                  </button>
                ))}
              </div>
            </div>
            {sales.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: "#9bafc5" }}>No sales recorded yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-max">
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {["Buyer", "Mode", "Qty", "Amount", "Wave", "Ref", "Status", "Created", ""].map(h => (
                        <th key={h} style={{
                          fontSize: "10px", fontWeight: 700, color: "#9bafc5",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          padding: "8px 12px", borderBottom: "1px solid #e5e7eb", textAlign: "left", whiteSpace: "nowrap",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s, i) => (
                      <tr key={s.id} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                        <td style={{ padding: "8px 12px" }}>
                          <span className="font-mono" style={{ color: "#374151" }}>
                            {s.buyer_address.slice(0, 6)}…{s.buyer_address.slice(-4)}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{ background: "#f3f4f6", color: "#374151" }}>
                            {saleModes.find(m => m.code === s.sale_mode)?.label ?? s.sale_mode}
                          </span>
                        </td>
                        <td style={{ padding: "8px 12px", fontWeight: 700, color: "#41afeb" }}>{s.quantity}</td>
                        <td style={{ padding: "8px 12px" }}>
                          {s.amount_paid_eth != null
                            ? <span style={{ color: "#24315f", fontWeight: 600 }}>{s.amount_paid_eth} {s.payment_currency}</span>
                            : <span style={{ color: "#d1d5db" }}>—</span>}
                        </td>
                        <td style={{ padding: "8px 12px", color: "#6b7280" }}>W{s.wave_number}</td>
                        <td style={{ padding: "8px 12px", color: "#9bafc5" }}>{s.payment_ref ?? "—"}</td>
                        <td style={{ padding: "8px 12px" }}><SaleStatusBadge status={s.status} /></td>
                        <td style={{ padding: "8px 12px", color: "#9bafc5" }}>
                          {new Date(s.created_at).toLocaleDateString()}
                        </td>
                        <td style={{ padding: "8px 12px" }}>
                          {s.status === "pending" || s.status === "failed" ? (
                            <button
                              onClick={() => handleMintPending(s.id)}
                              disabled={saving === `mint-${s.id}`}
                              className="px-2 py-1 rounded text-[10px] font-bold text-white"
                              style={{ background: saving === `mint-${s.id}` ? "#9bafc5" : "#16a34a" }}>
                              {saving === `mint-${s.id}` ? "…" : "Mint"}
                            </button>
                          ) : s.tx_hash ? (
                            <span className="font-mono text-[10px]" style={{ color: "#9bafc5" }}>
                              {s.tx_hash.slice(0, 8)}…
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {salesTotal > SALES_LIMIT && (
              <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: "1px solid #e5e7eb" }}>
                <span className="text-xs" style={{ color: "#9bafc5" }}>
                  {salesOffset + 1}–{Math.min(salesOffset + SALES_LIMIT, salesTotal)} of {salesTotal}
                </span>
                <div className="flex gap-2">
                  <button disabled={salesOffset === 0}
                    onClick={() => loadSales(Math.max(0, salesOffset - SALES_LIMIT), salesStatus)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold"
                    style={{ border: "1px solid #e5e7eb", color: salesOffset === 0 ? "#d1d5db" : "#6b7280" }}>
                    Prev
                  </button>
                  <button disabled={salesOffset + SALES_LIMIT >= salesTotal}
                    onClick={() => loadSales(salesOffset + SALES_LIMIT, salesStatus)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold"
                    style={{ border: "1px solid #e5e7eb", color: salesOffset + SALES_LIMIT >= salesTotal ? "#d1d5db" : "#6b7280" }}>
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

        </>)}

        {/* ════════════════════════════════════════════════════════════
            TAB 3 — Collection & Controls
        ════════════════════════════════════════════════════════════ */}
        {tab === "Collection & Controls" && (<>

          {/* Reveal */}
          <SectionCard
            title="Reveal Collection"
            subtitle="One-time — all minted tokens switch to real metadata. Requires all waves closed first."
            accent={onChain?.currentPhase === 1 ? "#7c3aed" : undefined}>
            <div className="space-y-4">
              {onChain && onChain.currentPhase !== 1 && (
                <div className="px-4 py-3 rounded-xl text-xs"
                  style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#d97706" }}>
                  Current phase: <strong>{PHASE_NAMES[onChain.currentPhase]}</strong> — reveal is only available in PaidMint phase.
                </div>
              )}
              {config?.reveal_count && config.reveal_count > 0 ? (
                <div className="px-4 py-3 rounded-xl text-sm" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a" }}>
                  <p className="font-bold">Collection revealed ({config.reveal_count} tokens)</p>
                  {config.reveal_uri && <p className="text-xs font-mono mt-1" style={{ color: "#6b7280" }}>{config.reveal_uri}</p>}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label style={labelStyle}>Reveal Base URI (IPFS)</label>
                    <input type="text" value={revealUri} onChange={e => setRevealUri(e.target.value)}
                      style={inputStyle} placeholder="ipfs://Qm…" />
                    <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>
                      Upload all 9,999 metadata JSON files to IPFS first, then paste the base URI here
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <button onClick={handleReveal}
                      disabled={saving === "reveal" || !revealUri || onChain?.currentPhase !== 1}
                      className="px-5 py-2.5 text-xs font-bold text-white rounded-xl"
                      style={{ background: saving === "reveal" || !revealUri || onChain?.currentPhase !== 1 ? "#9bafc5" : "#7c3aed" }}>
                      {saving === "reveal" ? "Submitting tx…" : "⛓ Reveal Collection On-Chain"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Treasury wallet */}
          <SectionCard title="Treasury Wallet" subtitle="ETH from mint sales is withdrawable to this address.">
            <div className="space-y-3">
              <div className="flex gap-2">
                <input type="text" value={treasury} onChange={e => setTreasury(e.target.value)}
                  style={{ ...inputStyle, flex: 1, fontFamily: "monospace" }} placeholder="0x…" />
                <button onClick={handleSetTreasury} disabled={saving === "treasury" || !treasury}
                  className="px-4 py-2 text-xs font-bold text-white rounded-xl flex-shrink-0"
                  style={{ background: saving === "treasury" || !treasury ? "#9bafc5" : "#41afeb" }}>
                  {saving === "treasury" ? "Saving…" : "⛓ Set On-Chain"}
                </button>
              </div>
              <p className="text-xs" style={{ color: "#9bafc5" }}>
                Current: {config?.treasury_wallet
                  ? <span className="font-mono">{config.treasury_wallet}</span>
                  : "Not set"}
              </p>
            </div>
          </SectionCard>

          {/* Provenance hash */}
          <SectionCard title="Provenance Hash" subtitle="SHA256 of all 9,999 metadata files — proves the order was not cherry-picked. Set before first mint.">
            {config?.provenance_hash ? (
              <div className="p-3 rounded-xl" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                <p className="text-xs font-bold" style={{ color: "#16a34a" }}>Provenance hash set (immutable)</p>
                <p className="text-xs font-mono mt-1 break-all" style={{ color: "#6b7280" }}>{config.provenance_hash}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input type="text" value={provHash} onChange={e => setProvHash(e.target.value)}
                  style={{ ...inputStyle, fontFamily: "monospace" }} placeholder="0x + 64 hex chars (SHA256 of all metadata)" />
                <div className="flex justify-end">
                  <button onClick={handleSetProvenance} disabled={saving === "provenance" || !provHash}
                    className="px-4 py-2 text-xs font-bold text-white rounded-xl"
                    style={{ background: saving === "provenance" || !provHash ? "#9bafc5" : "#24315f" }}>
                    {saving === "provenance" ? "Saving…" : "⛓ Set Provenance On-Chain"}
                  </button>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Emergency Controls */}
          <SectionCard title="Emergency Controls" subtitle="Pause stops all mints and transfers. Withdraw pulls ETH balance to treasury." accent="#dc2626">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-3">
                <button onClick={() => handlePause(true)} disabled={saving === "pause"}
                  className="px-4 py-2 text-xs font-bold rounded-xl"
                  style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", border: "1px solid #fecaca" }}>
                  {saving === "pause" ? "Pausing…" : "⛓ Pause Contract"}
                </button>
                <button onClick={() => handlePause(false)} disabled={saving === "unpause"}
                  className="px-4 py-2 text-xs font-bold rounded-xl"
                  style={{ background: "rgba(22,163,74,0.08)", color: "#16a34a", border: "1px solid rgba(22,163,74,0.3)" }}>
                  {saving === "unpause" ? "Unpausing…" : "⛓ Unpause Contract"}
                </button>
                <button onClick={handleWithdraw} disabled={saving === "withdraw"}
                  className="px-4 py-2 text-xs font-bold rounded-xl"
                  style={{ background: "rgba(65,175,235,0.08)", color: "#41afeb", border: "1px solid rgba(65,175,235,0.3)" }}>
                  {saving === "withdraw" ? "Withdrawing…" : "⛓ Withdraw ETH to Treasury"}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Contract Events */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
            <div className="px-5 py-4" style={{ borderBottom: "1px solid #e5e7eb" }}>
              <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Contract Events (Audit Log)</h2>
              <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Immutable on-chain event history</p>
            </div>
            {events.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: "#9bafc5" }}>No events recorded yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-max">
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {["Event", "Tx Hash", "Block", "Time"].map(h => (
                        <th key={h} style={{
                          fontSize: "10px", fontWeight: 700, color: "#9bafc5",
                          textTransform: "uppercase", letterSpacing: "0.06em",
                          padding: "8px 14px", borderBottom: "1px solid #e5e7eb", textAlign: "left",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev, i) => (
                      <tr key={ev.id} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                        <td style={{ padding: "8px 14px" }}>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>
                            {ev.event_name}
                          </span>
                        </td>
                        <td style={{ padding: "8px 14px" }}>
                          <span className="font-mono" style={{ color: "#6b7280" }}>
                            {ev.tx_hash.slice(0, 10)}…{ev.tx_hash.slice(-6)}
                          </span>
                        </td>
                        <td style={{ padding: "8px 14px", color: "#374151" }}>{ev.block_number.toLocaleString()}</td>
                        <td style={{ padding: "8px 14px", color: "#9bafc5" }}>
                          {new Date(ev.processed_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </>)}

      </div>
    </div>
  );
}
