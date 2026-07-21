"use client";

import { useEffect, useState } from "react";
import { TxBanner } from "@/components/nft/TxBanner";
import { ErrBanner } from "@/components/nft/ErrBanner";
import { Toggle } from "@/components/nft/Toggle";
import { SectionCard } from "@/components/nft/SectionCard";
import { labelStyle, inputStyle } from "@/components/nft/styles";
import { RARITY_TIERS } from "@/lib/nft-constants";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StakingConfig {
  stakingContractAddress: string | null;
  rewardTokenAddress: string | null;
  rewardTokenRate: number;
  genesisBonusBps: number;
  pointsPerDayCommon: number;
  stakingEnabled: boolean;
  syncedAt: string | null;
  updatedAt: string;
}

interface HolderInfo {
  address: string;
  stakedTokens: number[];
  stakedCount: number;
  totalEarned: string;
  totalRedeemed: string;
  available: string;
  pendingPoints: string;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StakingPage() {
  // Config state
  const [config, setConfig]           = useState<StakingConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  // Config form
  const [cfgForm, setCfgForm] = useState({
    stakingContractAddress: "",
    rewardTokenAddress: "",
    pointsPerDayCommon: "",
    stakingEnabled: false,
  });
  const [cfgSaving, setCfgSaving]     = useState(false);
  const [cfgSaveErr, setCfgSaveErr]   = useState<string | null>(null);
  const [cfgSaveOk, setCfgSaveOk]     = useState(false);

  // Genesis bonus
  const [genesisBps, setGenesisBps]   = useState("");
  const [genesisSaving, setGenesisSaving] = useState(false);
  const [genesisTx, setGenesisTx]     = useState<string | null>(null);
  const [genesisErr, setGenesisErr]   = useState<string | null>(null);

  // Rarity multipliers
  const [rarityBps, setRarityBps]     = useState<Record<number, string>>({ 1: "", 2: "", 3: "", 4: "" });
  const [rarityTier, setRarityTier]   = useState<number>(1);
  const [raritySaving, setRaritySaving] = useState(false);
  const [rarityTx, setRarityTx]       = useState<string | null>(null);
  const [rarityErr, setRarityErr]     = useState<string | null>(null);

  // Set reward token on-chain
  const [rtAddress, setRtAddress]     = useState("");
  const [rtRate, setRtRate]           = useState("");
  const [rtSaving, setRtSaving]       = useState(false);
  const [rtTx, setRtTx]               = useState<string | null>(null);
  const [rtErr, setRtErr]             = useState<string | null>(null);

  // Holder lookup
  const [holderAddr, setHolderAddr]   = useState("");
  const [holderLoading, setHolderLoading] = useState(false);
  const [holderInfo, setHolderInfo]   = useState<HolderInfo | null>(null);
  const [holderErr, setHolderErr]     = useState<string | null>(null);

  // Redeem points
  const [redeemHolder, setRedeemHolder] = useState("");
  const [redeemPoints, setRedeemPoints] = useState("");
  const [redeemReason, setRedeemReason] = useState("");
  const [redeemSaving, setRedeemSaving] = useState(false);
  const [redeemTx, setRedeemTx]         = useState<string | null>(null);
  const [redeemErr, setRedeemErr]       = useState<string | null>(null);

  // Pause / unpause
  const [pauseSaving, setPauseSaving] = useState<"pause" | "unpause" | null>(null);
  const [pauseTx, setPauseTx]         = useState<string | null>(null);
  const [pauseErr, setPauseErr]       = useState<string | null>(null);

  // ── Load config ──

  const loadConfig = async () => {
    setConfigLoading(true); setConfigError(null);
    try {
      const d = await fetch("/api/nft-sell/staking/config", { credentials: "include" }).then(r => r.json());
      const cfg: StakingConfig = d.config;
      setConfig(cfg);
      setCfgForm({
        stakingContractAddress: cfg.stakingContractAddress ?? "",
        rewardTokenAddress:     cfg.rewardTokenAddress     ?? "",
        pointsPerDayCommon:     String(cfg.pointsPerDayCommon),
        stakingEnabled:         cfg.stakingEnabled,
      });
      setGenesisBps(String(cfg.genesisBonusBps));
      setRtAddress(cfg.rewardTokenAddress ?? "");
      setRtRate(String(cfg.rewardTokenRate));
    } catch {
      setConfigError("Failed to load staking configuration.");
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => { loadConfig(); }, []);

  // ── Save DB config ──

  const handleSaveConfig = async () => {
    setCfgSaving(true); setCfgSaveErr(null); setCfgSaveOk(false);
    try {
      const res = await fetch("/api/nft-sell/staking/config", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stakingContractAddress: cfgForm.stakingContractAddress || null,
          rewardTokenAddress:     cfgForm.rewardTokenAddress     || null,
          pointsPerDayCommon:     Number(cfgForm.pointsPerDayCommon) || 100,
          stakingEnabled:         cfgForm.stakingEnabled,
        }),
      });
      if (!res.ok) { const d = await res.json(); setCfgSaveErr(d.error ?? "Save failed."); return; }
      setCfgSaveOk(true);
      await loadConfig();
      setTimeout(() => setCfgSaveOk(false), 3000);
    } catch { setCfgSaveErr("Network error."); }
    finally { setCfgSaving(false); }
  };

  // ── Generic on-chain op helper ──

  const chainOp = async <T,>(
    setTx: (v: string | null) => void,
    setErr: (v: string | null) => void,
    setSaving: (v: boolean) => void,
    fn: () => Promise<Response>,
    onOk?: (d: T) => void,
  ) => {
    setSaving(true); setTx(null); setErr(null);
    try {
      const res = await fn();
      const d = await res.json() as T & { error?: string; txHash?: string };
      if (!res.ok) { setErr(d.error ?? "Operation failed."); return; }
      setTx(d.txHash ?? null);
      if (onOk) onOk(d);
    } catch { setErr("Network error."); }
    finally { setSaving(false); }
  };

  // ── Genesis bonus ──

  const handleSetGenesisBonus = () => {
    const bps = parseInt(genesisBps, 10);
    if (isNaN(bps) || bps < 0 || bps > 50000) { setGenesisErr("BPS must be 0–50000."); return; }
    chainOp(setGenesisTx, setGenesisErr, setGenesisSaving,
      () => fetch("/api/nft-sell/staking/genesis-bonus", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bonusBps: bps }),
      }),
      () => loadConfig(),
    );
  };

  // ── Rarity multiplier ──

  const handleSetRarityMultiplier = () => {
    const bps = parseInt(rarityBps[rarityTier] ?? "", 10);
    if (isNaN(bps) || bps < 0) { setRarityErr("BPS must be a non-negative number."); return; }
    chainOp(setRarityTx, setRarityErr, setRaritySaving,
      () => fetch("/api/nft-sell/staking/rarity-multiplier", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rarity: rarityTier, bps }),
      }),
    );
  };

  // ── Set reward token on-chain ──

  const handleSetRewardToken = () => {
    if (!rtAddress) { setRtErr("Token address required."); return; }
    const rate = parseInt(rtRate, 10);
    if (isNaN(rate) || rate < 1) { setRtErr("Points-per-token must be >= 1."); return; }
    chainOp(setRtTx, setRtErr, setRtSaving,
      () => fetch("/api/nft-sell/staking/set-reward-token", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenAddress: rtAddress, pointsPerToken: rate }),
      }),
      () => loadConfig(),
    );
  };

  // ── Holder lookup ──

  const handleLookupHolder = async () => {
    if (!holderAddr.trim()) return;
    setHolderLoading(true); setHolderErr(null); setHolderInfo(null);
    try {
      const res = await fetch(`/api/nft-sell/staking/holders/${holderAddr.trim()}`, { credentials: "include" });
      const d = await res.json();
      if (!res.ok) { setHolderErr(d.error ?? "Lookup failed."); return; }
      setHolderInfo(d);
    } catch { setHolderErr("Network error."); }
    finally { setHolderLoading(false); }
  };

  // ── Redeem points ──

  const handleRedeem = () => {
    if (!redeemHolder.trim()) { setRedeemErr("Holder address required."); return; }
    const pts = parseInt(redeemPoints, 10);
    if (isNaN(pts) || pts < 1) { setRedeemErr("Points must be >= 1."); return; }
    if (!redeemReason.trim())  { setRedeemErr("Reason required."); return; }
    chainOp(setRedeemTx, setRedeemErr, setRedeemSaving,
      () => fetch("/api/nft-sell/staking/redeem", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holder: redeemHolder.trim(), points: pts, reason: redeemReason.trim() }),
      }),
      () => { setRedeemHolder(""); setRedeemPoints(""); setRedeemReason(""); },
    );
  };

  // ── Pause / unpause ──

  const handlePause = (action: "pause" | "unpause") => {
    setPauseSaving(action); setPauseTx(null); setPauseErr(null);
    fetch(`/api/nft-sell/staking/${action}`, { method: "POST", credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.txHash) setPauseTx(d.txHash); else setPauseErr(d.error ?? "Failed."); })
      .catch(() => setPauseErr("Network error."))
      .finally(() => setPauseSaving(null));
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-48" style={{ color: "#9bafc5" }}>
        <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading staking configuration…
      </div>
    );
  }

  return (
    <div className="p-5 space-y-5 max-w-4xl">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "#24315f" }}>NFT Staking</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            BearthStaking contract configuration, rarity multipliers, genesis bonus, holder lookup, and BRT redemption
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {config && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={config.stakingEnabled
                ? { background: "rgba(22,163,74,0.1)", color: "#16a34a" }
                : { background: "rgba(107,114,128,0.1)", color: "#6b7280" }}>
              <span className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: config.stakingEnabled ? "#16a34a" : "#9bafc5" }} />
              {config.stakingEnabled ? "Staking Enabled" : "Staking Disabled"}
            </span>
          )}
          <button onClick={loadConfig} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "white" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {configError && <ErrBanner msg={configError} />}

      {/* ── 1. Contract Configuration (DB) ── */}
      <SectionCard
        title="Contract Configuration"
        subtitle="Addresses and base rates stored in the database. Save updates DB only — does not submit on-chain.">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label style={labelStyle}>BearthStaking Contract Address</label>
              <input
                type="text"
                value={cfgForm.stakingContractAddress}
                onChange={e => setCfgForm({ ...cfgForm, stakingContractAddress: e.target.value })}
                style={inputStyle}
                placeholder="0x…"
                className="font-mono"
              />
            </div>
            <div>
              <label style={labelStyle}>Reward Token (BRT) Address</label>
              <input
                type="text"
                value={cfgForm.rewardTokenAddress}
                onChange={e => setCfgForm({ ...cfgForm, rewardTokenAddress: e.target.value })}
                style={inputStyle}
                placeholder="0x…"
                className="font-mono"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label style={labelStyle}>Points Per Day (Common baseline)</label>
              <input
                type="number"
                min="1"
                value={cfgForm.pointsPerDayCommon}
                onChange={e => setCfgForm({ ...cfgForm, pointsPerDayCommon: e.target.value })}
                style={inputStyle}
                placeholder="100"
              />
              <p className="text-[10px] mt-1" style={{ color: "#9bafc5" }}>
                Rare = 2×, Epic = 3×, Legendary = 4× this value. Genesis Wave 1 gets +{config ? Math.round(config.genesisBonusBps / 100) : 50}% bonus.
              </p>
            </div>
            <div className="flex flex-col justify-between">
              <label style={labelStyle}>Staking Enabled</label>
              <div className="flex items-center gap-3 mt-1">
                <Toggle
                  value={cfgForm.stakingEnabled}
                  onChange={v => setCfgForm({ ...cfgForm, stakingEnabled: v })}
                />
                <span className="text-xs font-semibold" style={{ color: cfgForm.stakingEnabled ? "#16a34a" : "#9bafc5" }}>
                  {cfgForm.stakingEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>
          {cfgSaveErr && <ErrBanner msg={cfgSaveErr} />}
          {cfgSaveOk && (
            <div className="px-4 py-3 rounded-xl text-xs flex items-center gap-2"
              style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.25)", color: "#16a34a" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Configuration saved.
            </div>
          )}
          <div className="flex justify-end pt-1">
            <button onClick={handleSaveConfig} disabled={cfgSaving}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: cfgSaving ? "#9bafc5" : "#41afeb" }}>
              {cfgSaving ? "Saving…" : "Save Configuration"}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── 2. Genesis Bonus ── */}
      <SectionCard
        title="Genesis Bonus (On-Chain)"
        subtitle="Wave 1 (Genesis) NFTs earn extra points on top of their rarity rate. 5000 BPS = +50%.">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <label style={labelStyle}>Genesis Bonus BPS</label>
            <input
              type="number" min="0" max="50000"
              value={genesisBps}
              onChange={e => setGenesisBps(e.target.value)}
              style={inputStyle}
              placeholder="5000"
            />
            <p className="text-[10px] mt-1" style={{ color: "#9bafc5" }}>
              {genesisBps ? `${(parseInt(genesisBps, 10) / 100).toFixed(0)}% bonus for Genesis holders` : "0–50000 BPS. 5000 = +50%"}
            </p>
          </div>
          <div className="space-y-2 flex-1 min-w-48">
            {genesisErr && <ErrBanner msg={genesisErr} />}
            {genesisTx  && <TxBanner txHash={genesisTx} />}
            <button onClick={handleSetGenesisBonus} disabled={genesisSaving}
              className="w-full px-4 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: genesisSaving ? "#9bafc5" : "#7c3aed" }}>
              {genesisSaving ? "Submitting…" : "⛓ Set Genesis Bonus On-Chain"}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── 3. Rarity Multipliers ── */}
      <SectionCard
        title="Rarity Multipliers (On-Chain)"
        subtitle="BPS multiplier applied per rarity tier. 10000 = 1× (baseline). Select a tier, enter BPS, submit.">
        <div className="space-y-4">
          {/* Tier selector */}
          <div className="flex gap-2 flex-wrap">
            {RARITY_TIERS.map(t => (
              <button key={t.id}
                onClick={() => setRarityTier(t.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{
                  border: "1px solid",
                  borderColor: rarityTier === t.id ? t.color : "#e5e7eb",
                  background: rarityTier === t.id ? `${t.color}15` : "white",
                  color: rarityTier === t.id ? t.color : "#6b7280",
                }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Default reference row */}
          <div className="grid grid-cols-4 gap-2">
            {RARITY_TIERS.map(t => (
              <div key={t.id} className="p-2 rounded-xl text-center" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                <span className="block text-[10px] font-bold" style={{ color: t.color }}>{t.label}</span>
                <span className="block text-xs font-semibold mt-0.5" style={{ color: "#374151" }}>
                  {t.defaultBps.toLocaleString()} BPS
                </span>
                <span className="block text-[9px]" style={{ color: "#9bafc5" }}>
                  {t.defaultBps / 10000}× default
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-48">
              <label style={labelStyle}>
                BPS for {RARITY_TIERS.find(t => t.id === rarityTier)?.label}
              </label>
              <input
                type="number" min="0"
                value={rarityBps[rarityTier] ?? ""}
                onChange={e => setRarityBps(prev => ({ ...prev, [rarityTier]: e.target.value }))}
                style={inputStyle}
                placeholder={String(RARITY_TIERS.find(t => t.id === rarityTier)?.defaultBps ?? 10000)}
              />
              <p className="text-[10px] mt-1" style={{ color: "#9bafc5" }}>
                {rarityBps[rarityTier]
                  ? `${(parseInt(rarityBps[rarityTier], 10) / 10000).toFixed(2)}× multiplier`
                  : "10000 = 1×, 20000 = 2×, 40000 = 4×"}
              </p>
            </div>
            <div className="space-y-2 flex-1 min-w-48">
              {rarityErr && <ErrBanner msg={rarityErr} />}
              {rarityTx  && <TxBanner txHash={rarityTx} />}
              <button onClick={handleSetRarityMultiplier} disabled={raritySaving}
                className="w-full px-4 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: raritySaving ? "#9bafc5" : RARITY_TIERS.find(t => t.id === rarityTier)?.color ?? "#41afeb" }}>
                {raritySaving ? "Submitting…" : `⛓ Set ${RARITY_TIERS.find(t => t.id === rarityTier)?.label} Multiplier`}
              </button>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── 4. Wire Reward Token On-Chain ── */}
      <SectionCard
        title="Reward Token — Wire On-Chain"
        subtitle="Calls setRewardToken() on the BearthStaking contract. Also updates the DB config addresses.">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label style={labelStyle}>Reward Token (BRT) Address</label>
              <input
                type="text"
                value={rtAddress}
                onChange={e => setRtAddress(e.target.value)}
                style={inputStyle}
                placeholder="0x…"
                className="font-mono"
              />
            </div>
            <div>
              <label style={labelStyle}>Points Per Token (rate)</label>
              <input
                type="number" min="1"
                value={rtRate}
                onChange={e => setRtRate(e.target.value)}
                style={inputStyle}
                placeholder="100"
              />
              <p className="text-[10px] mt-1" style={{ color: "#9bafc5" }}>
                How many staking points = 1 BRT token when redeeming
              </p>
            </div>
          </div>
          {rtErr && <ErrBanner msg={rtErr} />}
          {rtTx  && <TxBanner txHash={rtTx} />}
          <div className="flex justify-end">
            <button onClick={handleSetRewardToken} disabled={rtSaving}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white"
              style={{ background: rtSaving ? "#9bafc5" : "#41afeb" }}>
              {rtSaving ? "Submitting…" : "⛓ Set Reward Token On-Chain"}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── 5. Holder Lookup ── */}
      <SectionCard
        title="Holder Lookup"
        subtitle="Enter a wallet address to see staked NFTs, earned points, and pending accrual.">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={holderAddr}
              onChange={e => setHolderAddr(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLookupHolder()}
              style={{ ...inputStyle, fontFamily: "monospace" }}
              placeholder="0x wallet address…"
            />
            <button onClick={handleLookupHolder} disabled={holderLoading || !holderAddr.trim()}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white flex-shrink-0"
              style={{ background: holderLoading ? "#9bafc5" : "#41afeb" }}>
              {holderLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : "Look Up"}
            </button>
          </div>

          {holderErr && <ErrBanner msg={holderErr} />}

          {holderInfo && (
            <div className="space-y-4">
              {/* Points summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Staked NFTs",     value: String(holderInfo.stakedCount),   color: "#41afeb" },
                  { label: "Total Earned",     value: holderInfo.totalEarned,           color: "#7c3aed" },
                  { label: "Total Redeemed",   value: holderInfo.totalRedeemed,         color: "#d97706" },
                  { label: "Available Points", value: holderInfo.available,             color: "#16a34a" },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                    <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "#9bafc5" }}>{s.label}</p>
                    <p className="text-lg font-black mt-1" style={{ color: s.color }}>{Number(s.value).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Pending points */}
              {BigInt(holderInfo.pendingPoints) > 0n && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs"
                  style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.2)" }}>
                  <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="#7c3aed" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span style={{ color: "#7c3aed" }}>
                    <strong>{Number(holderInfo.pendingPoints).toLocaleString()}</strong> pending points accrued but not yet claimed on-chain
                  </span>
                </div>
              )}

              {/* Staked token IDs */}
              {holderInfo.stakedCount > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "#9bafc5" }}>
                    Staked Token IDs ({holderInfo.stakedCount})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {holderInfo.stakedTokens.map(id => (
                      <span key={id} className="px-2 py-0.5 rounded text-xs font-mono font-semibold"
                        style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>
                        #{id}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {holderInfo.stakedCount === 0 && (
                <p className="text-xs text-center py-3" style={{ color: "#9bafc5" }}>
                  No NFTs currently staked by this wallet.
                </p>
              )}

              {/* Quick-fill redeem */}
              <div className="pt-2" style={{ borderTop: "1px solid #f3f4f6" }}>
                <button
                  onClick={() => { setRedeemHolder(holderInfo.address); window.scrollTo({ top: 9999, behavior: "smooth" }); }}
                  className="text-xs font-semibold flex items-center gap-1"
                  style={{ color: "#41afeb" }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  Fill in Redeem Points form for this wallet
                </button>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── 6. Redeem Points for BRT ── */}
      <SectionCard
        title="Redeem Points for BRT Tokens"
        subtitle="Admin action: calls redeemPoints() on-chain which mints BRT tokens directly to the holder wallet.">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label style={labelStyle}>Holder Wallet Address</label>
              <input
                type="text"
                value={redeemHolder}
                onChange={e => setRedeemHolder(e.target.value)}
                style={{ ...inputStyle, fontFamily: "monospace" }}
                placeholder="0x…"
              />
            </div>
            <div>
              <label style={labelStyle}>Points to Redeem</label>
              <input
                type="number" min="1"
                value={redeemPoints}
                onChange={e => setRedeemPoints(e.target.value)}
                style={inputStyle}
                placeholder="e.g. 500"
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Reason</label>
            <input
              type="text"
              value={redeemReason}
              onChange={e => setRedeemReason(e.target.value)}
              style={inputStyle}
              placeholder="e.g. Loyalty reward Q3 2026, Event prize, Staking bonus"
            />
          </div>
          {config && redeemPoints && !isNaN(parseInt(redeemPoints)) && (
            <div className="px-4 py-2.5 rounded-xl text-xs"
              style={{ background: "rgba(65,175,235,0.06)", border: "1px solid rgba(65,175,235,0.2)", color: "#41afeb" }}>
              {parseInt(redeemPoints).toLocaleString()} points ÷ {config.rewardTokenRate} pts/token ={" "}
              <strong>{(parseInt(redeemPoints) / config.rewardTokenRate).toFixed(4)} BRT</strong> will be minted to the holder
            </div>
          )}
          {redeemErr && <ErrBanner msg={redeemErr} />}
          {redeemTx  && <TxBanner txHash={redeemTx} />}
          <div className="flex justify-end">
            <button onClick={handleRedeem} disabled={redeemSaving}
              className="px-4 py-2 rounded-lg text-xs font-bold text-white flex items-center gap-2"
              style={{ background: redeemSaving ? "#9bafc5" : "#16a34a" }}>
              {redeemSaving ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting…
                </>
              ) : "⛓ Redeem Points → Mint BRT"}
            </button>
          </div>
        </div>
      </SectionCard>

      {/* ── 7. Contract Controls (Pause / Unpause) ── */}
      <SectionCard
        title="Contract Controls"
        subtitle="Emergency pause stops all staking and unstaking activity. Use only in critical situations.">
        <div className="space-y-3">
          {pauseErr && <ErrBanner msg={pauseErr} />}
          {pauseTx  && <TxBanner txHash={pauseTx} />}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => handlePause("pause")}
              disabled={pauseSaving !== null}
              className="px-4 py-2 rounded-lg text-xs font-bold"
              style={{ border: "1px solid #dc2626", color: "#dc2626", background: "rgba(220,38,38,0.05)", opacity: pauseSaving ? 0.7 : 1 }}>
              {pauseSaving === "pause" ? "Submitting…" : "⛓ Pause Contract"}
            </button>
            <button
              onClick={() => handlePause("unpause")}
              disabled={pauseSaving !== null}
              className="px-4 py-2 rounded-lg text-xs font-bold"
              style={{ border: "1px solid #16a34a", color: "#16a34a", background: "rgba(22,163,74,0.05)", opacity: pauseSaving ? 0.7 : 1 }}>
              {pauseSaving === "unpause" ? "Submitting…" : "⛓ Unpause Contract"}
            </button>
          </div>
          <p className="text-[10px]" style={{ color: "#9bafc5" }}>
            Both actions submit a blockchain transaction and require FIXED_PRIVATE_KEY to hold the PAUSER_ROLE on the BearthStaking contract.
          </p>
        </div>
      </SectionCard>

      {/* ── Config summary footer ── */}
      {config && (
        <div className="px-4 py-3 rounded-xl text-xs" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
          <div className="flex flex-wrap gap-x-6 gap-y-1" style={{ color: "#6b7280" }}>
            <span>Last updated: <strong style={{ color: "#374151" }}>{new Date(config.updatedAt).toLocaleString()}</strong></span>
            {config.syncedAt && <span>Last on-chain sync: <strong style={{ color: "#374151" }}>{new Date(config.syncedAt).toLocaleString()}</strong></span>}
            <span>Points/day (common): <strong style={{ color: "#374151" }}>{config.pointsPerDayCommon}</strong></span>
            <span>Genesis bonus: <strong style={{ color: "#374151" }}>{config.genesisBonusBps / 100}%</strong></span>
            <span>Reward rate: <strong style={{ color: "#374151" }}>{config.rewardTokenRate} pts / BRT</strong></span>
          </div>
        </div>
      )}

    </div>
  );
}
