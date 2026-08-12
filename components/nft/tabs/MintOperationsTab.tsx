"use client";

import { useState } from "react";
import { SectionCard } from "@/components/nft/SectionCard";
import { Toggle } from "@/components/nft/Toggle";
import { TxBanner, ErrBanner, OkBanner } from "@/components/nft/Banner";
import { labelStyle, inputStyle } from "@/components/nft/styles";
import { ETH_ADDRESS_RE } from "@/lib/nft-constants";

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

  // Purchase limits
  const [limitEnabled, setLimitEnabled] = useState(config?.purchase_limit_enabled ?? true);
  const [maxPerWallet, setMaxPerWallet] = useState(String(config?.normal_max_per_wallet ?? 5));

  // SBT
  const [sbtEnabled, setSbtEnabled] = useState(config?.sbt_enabled ?? false);

  // Treasury reserve mint
  const [mintTo,  setMintTo]  = useState("");
  const [mintQty, setMintQty] = useState("1");

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

        </div>
      </section>
    </div>
  );
}
