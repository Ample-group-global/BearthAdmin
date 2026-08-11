"use client";

import { useState } from "react";
import { SectionCard } from "@/components/nft/SectionCard";
import { Toggle } from "@/components/nft/Toggle";
import { TxBanner, ErrBanner, OkBanner } from "@/components/nft/Banner";
import { labelStyle, inputStyle } from "@/components/nft/styles";
import { PHASE_NAMES, PHASE_COLORS, MERKLE_ROOT_RE } from "@/lib/nft-constants";

export interface OnChainInfo {
  currentPhase: number;
  maxSupply: number;
  totalMinted: number;
  revealCount: number;
  sbt: boolean;
  royaltyEnforced: boolean;
  purchaseLimitEnabled: boolean;
  normalMaxPerWallet: number;
}

export interface CollectionConfig {
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

interface Props {
  onChain: OnChainInfo | null;
  config: CollectionConfig | null;
  onRefresh: () => Promise<void>;
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-widest mb-3"
      style={{ color: "#9bafc5" }}>{children}</p>
  );
}

export default function MintOperationsTab({ onChain, config, onRefresh }: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [tx,      setTx]    = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);
  const [opOk,    setOpOk]    = useState<string | null>(null);

  // Phase
  const [phaseTarget, setPhaseTarget] = useState<number>(
    onChain ? Math.min(onChain.currentPhase + 1, 2) : 1
  );

  // VIP
  const [vipAddress, setVipAddress] = useState("");
  const [vipStatus,  setVipStatus]  = useState(true);

  // Purchase limits
  const [limitEnabled,  setLimitEnabled]  = useState(config?.purchase_limit_enabled ?? true);
  const [maxPerWallet,  setMaxPerWallet]  = useState(String(config?.normal_max_per_wallet ?? 5));

  // SBT
  const [sbtEnabled, setSbtEnabled] = useState(config?.sbt_enabled ?? false);

  // Admin mint
  const [mintTo,  setMintTo]  = useState("");
  const [mintQty, setMintQty] = useState("1");

  // Whitelist
  const [merkleRoot, setMerkleRoot] = useState("");

  // ── Op helper ──
  const doOp = async (opName: string, fn: () => Promise<Response>, okMsg?: string) => {
    setSaving(opName); setOpError(null); setTx(null); setOpOk(null);
    try {
      const res = await fn();
      const d   = await res.json();
      if (!res.ok) { setOpError(d.error ?? `${opName} failed.`); return; }
      if (d.txHash) setTx(d.txHash);
      if (okMsg)    setOpOk(okMsg);
      await onRefresh();
    } catch { setOpError("Network error."); }
    finally { setSaving(null); }
  };

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
    if (!MERKLE_ROOT_RE.test(merkleRoot)) { setOpError("Merkle root must be 0x followed by 64 hex characters."); return; }
    doOp("merkle", () => fetch("/api/nft-sell/collection/merkle-root", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root: merkleRoot }),
    }), "Merkle root updated on-chain.");
  };

  return (
    <div className="space-y-7">
      {tx      && <TxBanner  txHash={tx}   onDismiss={() => setTx(null)} />}
      {opError && <ErrBanner msg={opError}  onDismiss={() => setOpError(null)} />}
      {opOk   && <OkBanner  msg={opOk} onDismiss={() => setOpOk(null)} />}

      {/* ─── PHASE MANAGEMENT ─────────────────────────── */}
      <section>
        <GroupLabel>Phase Management</GroupLabel>
        <SectionCard
          title="Phase Control"
          subtitle="Advance the mint phase on-chain. Order: Whitelist → PaidMint → Revealed (one-way, irreversible).">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PHASE_NAMES.map((name, idx) => {
                const current   = onChain ? onChain.currentPhase : -1;
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
      </section>

      {/* ─── ACCESS CONTROL ───────────────────────────── */}
      <section>
        <GroupLabel>Access Control</GroupLabel>
        <div className="space-y-4">
          <SectionCard title="VIP Customer Management" subtitle="Mark wallets as VIP on-chain. Purchase limits apply equally to all wallets.">
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
                    <button onClick={() => setVipStatus(true)} className="flex-1 py-2 text-xs font-bold rounded-lg"
                      style={{
                        border: "1px solid", borderColor: vipStatus ? "#41afeb" : "#e5e7eb",
                        background: vipStatus ? "rgba(65,175,235,0.1)" : "white",
                        color: vipStatus ? "#41afeb" : "#6b7280",
                      }}>Grant VIP</button>
                    <button onClick={() => setVipStatus(false)} className="flex-1 py-2 text-xs font-bold rounded-lg"
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

          <SectionCard title="Purchase Limits" subtitle="Max NFTs a wallet can mint across all waves combined.">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: limitEnabled ? "rgba(65,175,235,0.06)" : "#f9fafb", border: "1px solid #e5e7eb" }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#24315f" }}>Enable Purchase Limits</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                    {limitEnabled ? "ON — wallets capped at max below" : "OFF — wallets can buy any quantity"}
                  </p>
                </div>
                <Toggle value={limitEnabled} onChange={setLimitEnabled} />
              </div>
              {limitEnabled && (
                <div>
                  <label style={labelStyle}>Max NFTs per Wallet</label>
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

          <SectionCard title="Soul Bound Token (SBT) Mode" subtitle="When enabled, minted NFTs cannot be transferred. Permanently bound to the minting wallet.">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: sbtEnabled ? "rgba(220,38,38,0.04)" : "#f9fafb", border: "1px solid #e5e7eb" }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#24315f" }}>SBT Enabled</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                    {sbtEnabled ? "ON — NFTs are non-transferable" : "OFF — NFTs are fully tradeable on OpenSea"}
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
        </div>
      </section>

      {/* ─── WHITELIST ──────────────────────────────────── */}
      <section>
        <GroupLabel>Whitelist</GroupLabel>
        <SectionCard title="Merkle Root" subtitle="Update the on-chain Merkle root used for Wave 1 whitelist proof verification.">
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
      </section>

      {/* ─── ADMIN TOOLS ────────────────────────────────── */}
      <section>
        <GroupLabel>Admin Tools</GroupLabel>
        <SectionCard title="Admin Mint" subtitle="Directly mint NFTs to any wallet (reserves, prizes, gifts). Does not count toward purchase limits.">
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
      </section>
    </div>
  );
}
