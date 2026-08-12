"use client";

import { useState } from "react";
import { SectionCard } from "@/components/nft/SectionCard";
import { Toggle } from "@/components/nft/Toggle";
import { TxBanner, ErrBanner, OkBanner } from "@/components/nft/Banner";
import { labelStyle, inputStyle } from "@/components/nft/styles";
import { MERKLE_ROOT_RE, ETH_ADDRESS_RE } from "@/lib/nft-constants";

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
  const [saving,  setSaving]  = useState<string | null>(null);
  const [tx,      setTx]      = useState<string | null>(null);
  const [opError, setOpError] = useState<string | null>(null);
  const [opOk,    setOpOk]    = useState<string | null>(null);

  // VIP
  const [vipAddress, setVipAddress] = useState("");
  const [vipStatus,  setVipStatus]  = useState(true);

  // Block account
  const [blockAddress, setBlockAddress] = useState("");
  const [blockAction,  setBlockAction]  = useState(true); // true = block, false = unblock

  // Purchase limits
  const [limitEnabled, setLimitEnabled] = useState(config?.purchase_limit_enabled ?? true);
  const [maxPerWallet, setMaxPerWallet] = useState(String(config?.normal_max_per_wallet ?? 5));

  // SBT
  const [sbtEnabled, setSbtEnabled] = useState(config?.sbt_enabled ?? false);

  // Treasury reserve mint
  const [mintTo,  setMintTo]  = useState("");
  const [mintQty, setMintQty] = useState("1");

  // Merkle root (advanced override)
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

  const handleSetVIP = () => {
    if (!ETH_ADDRESS_RE.test(vipAddress)) { setOpError("Enter a valid Ethereum address (0x + 40 hex)."); return; }
    doOp("vip", () => fetch(`/api/nft-sell/customers/${vipAddress}/vip`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVip: vipStatus }),
    }), vipStatus ? "VIP granted." : "VIP revoked.");
  };

  const handleBlockAccount = () => {
    if (!ETH_ADDRESS_RE.test(blockAddress)) { setOpError("Enter a valid Ethereum address (0x + 40 hex)."); return; }
    const endpoint = blockAction ? "block-account" : "unblock-account";
    doOp("block", () => fetch(`/api/nft-sell/customers/${blockAddress}/${endpoint}`, {
      method: "POST", credentials: "include",
    }), blockAction ? "Account blocked on-chain." : "Account unblocked on-chain.");
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

  const handleReserveMint = () => {
    if (!ETH_ADDRESS_RE.test(mintTo)) { setOpError("Valid 0x wallet address required."); return; }
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
      {opOk   && <OkBanner  msg={opOk}     onDismiss={() => setOpOk(null)} />}

      {/* Phase Management moved to NFT Waves page */}

      {/* ─── ACCESS CONTROL ───────────────────────────── */}
      <section>
        <GroupLabel>Access Control</GroupLabel>
        <div className="space-y-4">

          {/* VIP */}
          <SectionCard title="VIP Customer Management" subtitle="Mark wallets as VIP on-chain. Note: purchase limits apply equally to all wallets regardless of VIP status.">
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
                  {saving === "vip" ? "Submitting…" : "⛓ Set VIP On-Chain"}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Block Account */}
          <SectionCard
            title="Block / Unblock Account"
            subtitle="Blocked wallets cannot mint or receive transfers. Applies immediately on-chain.">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div className="sm:col-span-2">
                  <label style={labelStyle}>Wallet Address</label>
                  <input type="text" value={blockAddress} onChange={e => setBlockAddress(e.target.value)}
                    style={{ ...inputStyle, fontFamily: "monospace" }} placeholder="0x…" />
                </div>
                <div>
                  <label style={labelStyle}>Action</label>
                  <div className="flex gap-2">
                    <button onClick={() => setBlockAction(true)} className="flex-1 py-2 text-xs font-bold rounded-lg"
                      style={{
                        border: "1px solid", borderColor: blockAction ? "#dc2626" : "#e5e7eb",
                        background: blockAction ? "rgba(220,38,38,0.08)" : "white",
                        color: blockAction ? "#dc2626" : "#6b7280",
                      }}>Block</button>
                    <button onClick={() => setBlockAction(false)} className="flex-1 py-2 text-xs font-bold rounded-lg"
                      style={{
                        border: "1px solid", borderColor: !blockAction ? "#16a34a" : "#e5e7eb",
                        background: !blockAction ? "rgba(22,163,74,0.08)" : "white",
                        color: !blockAction ? "#16a34a" : "#6b7280",
                      }}>Unblock</button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={handleBlockAccount} disabled={saving === "block" || !blockAddress}
                  className="px-4 py-2 text-xs font-bold text-white rounded-xl"
                  style={{
                    background: saving === "block" || !blockAddress
                      ? "#9bafc5"
                      : blockAction ? "#dc2626" : "#16a34a",
                  }}>
                  {saving === "block"
                    ? "Submitting…"
                    : blockAction ? "⛓ Block Account On-Chain" : "⛓ Unblock Account On-Chain"}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Purchase Limits */}
          <SectionCard title="Purchase Limits" subtitle="Max NFTs a wallet can mint across all waves combined. Applies to all wallets equally.">
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
                  {saving === "limits" ? "Submitting…" : "⛓ Save Limits On-Chain"}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* SBT */}
          <SectionCard title="Soul Bound Token (SBT) Mode" subtitle="When enabled, minted NFTs cannot be transferred. Permanently bound to the minting wallet. Requires DEFAULT_ADMIN_ROLE.">
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
                  {saving === "sbt" ? "Submitting…" : "⛓ Set SBT On-Chain"}
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      </section>

      {/* ─── ADMIN TOOLS ────────────────────────────────── */}
      <section>
        <GroupLabel>Admin Tools</GroupLabel>
        <div className="space-y-4">

          {/* Treasury Reserve Mint */}
          <SectionCard
            title="Treasury Reserve Mint"
            subtitle="Directly mint NFTs to any wallet (reserves, prizes, gifts, team allocation). Minted as wave-0 treasury tokens — does not count toward purchase limits or wave quotas.">
            <div className="space-y-3">
              <div className="px-4 py-3 rounded-xl text-xs"
                style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#d97706" }}>
                These tokens are treasury-reserve (wave 0) and not part of any wave allocation. Use the NFT Waves page to mint from a specific wave's supply.
              </div>
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
                <button onClick={handleReserveMint} disabled={saving === "admin-mint"}
                  className="px-4 py-2 text-xs font-bold text-white rounded-xl"
                  style={{ background: saving === "admin-mint" ? "#9bafc5" : "#16a34a" }}>
                  {saving === "admin-mint" ? "Minting…" : "⛓ Reserve Mint On-Chain"}
                </button>
              </div>
            </div>
          </SectionCard>

          {/* Merkle Root — advanced override */}
          <SectionCard
            title="Merkle Root Override"
            subtitle="Directly set the on-chain whitelist Merkle root. Only use this if you have a pre-computed root from an external source. The standard flow is: NFT Waves → Whitelist tab → compute & push.">
            <div className="space-y-3">
              <div className="px-4 py-3 rounded-xl text-xs"
                style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                Advanced override — pushing an incorrect root will prevent all whitelist mints from verifying. Double-check the root before submitting.
              </div>
              <div>
                <label style={labelStyle}>Merkle Root (bytes32)</label>
                <input type="text" value={merkleRoot} onChange={e => setMerkleRoot(e.target.value)}
                  style={{ ...inputStyle, fontFamily: "monospace" }} placeholder="0x0000…" />
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
        </div>
      </section>
    </div>
  );
}
