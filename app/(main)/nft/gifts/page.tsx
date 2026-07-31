"use client";

import { useEffect, useState, useCallback } from "react";
import { TxBanner, ErrBanner, OkBanner } from "@/components/nft/Banner";
import { SectionCard } from "@/components/nft/SectionCard";
import { labelStyle, inputStyle } from "@/components/nft/styles";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GiftOrder {
  id: string;
  recipient_wallet: string;
  recipient_name: string | null;
  recipient_email: string | null;
  rarity_tier: string | null;
  gift_message: string | null;
  price_eth: number;
  payment_method: string | null;
  is_airdrop: boolean;
  status: string;
  tx_hash: string | null;
  created_at: string;
  transferred_at: string | null;
}

interface AirdropQuote {
  recipientCount: number;
  amountEachEth: string;
  totalEth: string;
  totalWei: string;
}

type Tab = "eth-airdrop" | "erc20-airdrop" | "nft-airdrop" | "gift-orders";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ETH_ADDR_RE = /^0x[0-9a-fA-F]{40}$/;

function parseAddressList(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    pending:     { bg: "rgba(217,119,6,0.1)",   color: "#d97706" },
    transferred: { bg: "rgba(22,163,74,0.1)",   color: "#16a34a" },
    cancelled:   { bg: "rgba(107,114,128,0.1)", color: "#6b7280" },
    failed:      { bg: "rgba(220,38,38,0.1)",   color: "#dc2626" },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: c.bg, color: c.color }}>{status}</span>
  );
}

// ─── Shared field wrappers ─────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label style={labelStyle}>{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  const { mono, className, ...rest } = props;
  return (
    <input
      style={inputStyle}
      className={mono ? `font-mono${className ? " " + className : ""}` : className}
      {...rest}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }) {
  const { mono, className, ...rest } = props;
  return (
    <textarea
      style={inputStyle}
      className={mono ? `font-mono text-xs${className ? " " + className : ""}` : className}
      {...rest}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select style={inputStyle} {...props} />;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GiftsPage() {
  const [tab, setTab]     = useState<Tab>("eth-airdrop");
  const [gifts, setGifts] = useState<GiftOrder[]>([]);
  const [giftsLoading, setGiftsLoading] = useState(false);

  // Global feedback
  const [tx, setTx]         = useState<string | null>(null);
  const [opErr, setOpErr]   = useState<string | null>(null);
  const [opOk, setOpOk]     = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ETH Airdrop state
  const [ethMode, setEthMode]             = useState<"equal" | "skip-failed" | "variable">("equal");
  const [ethRecipients, setEthRecipients] = useState("");
  const [ethAmountEach, setEthAmountEach] = useState("");
  const [ethAmountsVar, setEthAmountsVar] = useState("");
  const [quote, setQuote]                 = useState<AirdropQuote | null>(null);
  const [quoteLoading, setQuoteLoading]   = useState(false);

  // ERC20 Airdrop state
  const [erc20Mode, setErc20Mode]               = useState<"equal" | "variable">("equal");
  const [erc20Token, setErc20Token]             = useState("");
  const [erc20Recipients, setErc20Recipients]   = useState("");
  const [erc20AmountEach, setErc20AmountEach]   = useState("");
  const [erc20AmountsVar, setErc20AmountsVar]   = useState("");

  // NFT Airdrop state
  const [nftToken, setNftToken]           = useState("");
  const [nftRecipients, setNftRecipients] = useState("");
  const [nftTokenIds, setNftTokenIds]     = useState("");

  // Gift order create state
  const [giftWallet, setGiftWallet]       = useState("");
  const [giftName, setGiftName]           = useState("");
  const [giftEmail, setGiftEmail]         = useState("");
  const [giftRarity, setGiftRarity]       = useState("");
  const [giftMessage, setGiftMessage]     = useState("");
  const [giftIsAirdrop, setGiftIsAirdrop] = useState(true);

  // Batch gift state
  const [batchWallets, setBatchWallets]   = useState("");
  const [batchRarity, setBatchRarity]     = useState("");
  const [batchMessage, setBatchMessage]   = useState("");

  // ── Load gift orders ───────────────────────────────────────────────────────

  const loadGifts = useCallback(async () => {
    setGiftsLoading(true);
    try {
      const d = await fetch("/api/nft-sell/gifts", { credentials: "include" }).then(r => r.json());
      setGifts(d.gifts ?? []);
    } catch {
      // silently fail
    } finally {
      setGiftsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "gift-orders") loadGifts();
  }, [tab, loadGifts]);

  // ── Op helper ──────────────────────────────────────────────────────────────

  const doOp = async (fn: () => Promise<Response>, okMsg: string): Promise<boolean> => {
    setSaving(true); setOpErr(null); setTx(null); setOpOk(null);
    try {
      const res = await fn();
      const d   = await res.json();
      if (!res.ok) { setOpErr(d.error ?? "Operation failed."); return false; }
      if (d.txHash) setTx(d.txHash);
      setOpOk(okMsg);
      return true;
    } catch { setOpErr("Network error."); return false; }
    finally { setSaving(false); }
  };

  // ── Quote calculator ───────────────────────────────────────────────────────

  const fetchQuote = async () => {
    const addrs = parseAddressList(ethRecipients);
    if (!addrs.length || !ethAmountEach) return;
    setQuoteLoading(true);
    try {
      const params = new URLSearchParams({ recipientCount: String(addrs.length), amountEachEth: ethAmountEach });
      const d = await fetch(`/api/nft-sell/airdrop/quote?${params}`, { credentials: "include" }).then(r => r.json());
      setQuote(d);
    } catch { setQuote(null); }
    finally { setQuoteLoading(false); }
  };

  // ── ETH airdrop ────────────────────────────────────────────────────────────

  const handleEthAirdrop = async () => {
    const recipients = parseAddressList(ethRecipients);
    if (!recipients.length) { setOpErr("Enter at least one recipient address."); return; }
    const invalid = recipients.filter(a => !ETH_ADDR_RE.test(a));
    if (invalid.length) { setOpErr(`Invalid address(es): ${invalid.slice(0, 3).join(", ")}`); return; }

    if (ethMode === "variable") {
      const amountsEth = parseAddressList(ethAmountsVar);
      if (amountsEth.length !== recipients.length) {
        setOpErr(`Amount count (${amountsEth.length}) must match recipient count (${recipients.length}).`); return;
      }
      await doOp(() => fetch("/api/nft-sell/airdrop/eth/variable", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients, amountsEth }),
      }), `Variable ETH airdrop sent to ${recipients.length} addresses.`);
    } else {
      if (!ethAmountEach || isNaN(parseFloat(ethAmountEach))) { setOpErr("Valid ETH amount required."); return; }
      const endpoint = ethMode === "skip-failed" ? "skip-failed" : "equal";
      await doOp(() => fetch(`/api/nft-sell/airdrop/eth/${endpoint}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients, amountEachEth: ethAmountEach }),
      }), `ETH airdrop (${ethMode}) sent to ${recipients.length} addresses.`);
    }
  };

  // ── ERC20 airdrop ──────────────────────────────────────────────────────────

  const handleErc20Airdrop = async () => {
    if (!ETH_ADDR_RE.test(erc20Token)) { setOpErr("Valid ERC20 token address required."); return; }
    const recipients = parseAddressList(erc20Recipients);
    if (!recipients.length) { setOpErr("Enter at least one recipient address."); return; }
    const invalid = recipients.filter(a => !ETH_ADDR_RE.test(a));
    if (invalid.length) { setOpErr(`Invalid address(es): ${invalid.slice(0, 3).join(", ")}`); return; }

    if (erc20Mode === "variable") {
      const amountsWei = parseAddressList(erc20AmountsVar);
      if (amountsWei.length !== recipients.length) {
        setOpErr(`Amount count must match recipient count (${recipients.length}).`); return;
      }
      await doOp(() => fetch("/api/nft-sell/airdrop/erc20/variable", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenAddress: erc20Token, recipients, amountsWei }),
      }), `ERC20 variable airdrop sent to ${recipients.length} addresses.`);
    } else {
      if (!erc20AmountEach) { setOpErr("Amount (wei) required."); return; }
      await doOp(() => fetch("/api/nft-sell/airdrop/erc20/equal", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenAddress: erc20Token, recipients, amountEachWei: erc20AmountEach }),
      }), `ERC20 equal airdrop sent to ${recipients.length} addresses.`);
    }
  };

  // ── NFT airdrop ────────────────────────────────────────────────────────────

  const handleNftAirdrop = async () => {
    if (!ETH_ADDR_RE.test(nftToken)) { setOpErr("Valid NFT contract address required."); return; }
    const recipients = parseAddressList(nftRecipients);
    const tokenIds   = parseAddressList(nftTokenIds).map(Number);
    if (!recipients.length) { setOpErr("Enter at least one recipient address."); return; }
    if (tokenIds.length !== recipients.length) {
      setOpErr(`Token ID count must match recipient count (${recipients.length}).`); return;
    }
    const invalid = recipients.filter(a => !ETH_ADDR_RE.test(a));
    if (invalid.length) { setOpErr(`Invalid address(es): ${invalid.slice(0, 3).join(", ")}`); return; }
    await doOp(() => fetch("/api/nft-sell/airdrop/nft", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenContract: nftToken, recipients, tokenIds }),
    }), `NFT airdrop sent to ${recipients.length} addresses.`);
  };

  // ── Gift order handlers ────────────────────────────────────────────────────

  const handleCreateGift = async () => {
    if (!ETH_ADDR_RE.test(giftWallet)) { setOpErr("Valid recipient wallet address required."); return; }
    const ok = await doOp(() => fetch("/api/nft-sell/gifts", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_wallet: giftWallet,
        recipient_name:   giftName   || undefined,
        recipient_email:  giftEmail  || undefined,
        rarity_tier:      giftRarity || undefined,
        gift_message:     giftMessage || undefined,
        is_airdrop:       giftIsAirdrop,
        payment_method:   "airdrop",
      }),
    }), "Gift order created.");
    if (ok) { setGiftWallet(""); setGiftName(""); setGiftEmail(""); setGiftMessage(""); loadGifts(); }
  };

  const handleBatchGift = async () => {
    const wallets = parseAddressList(batchWallets);
    if (!wallets.length) { setOpErr("Enter at least one wallet address."); return; }
    const invalid = wallets.filter(a => !ETH_ADDR_RE.test(a));
    if (invalid.length) { setOpErr(`Invalid address(es): ${invalid.slice(0, 3).join(", ")}`); return; }
    await doOp(() => fetch("/api/nft-sell/gifts/airdrop", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient_wallets: wallets,
        rarity_tier:       batchRarity  || undefined,
        gift_message:      batchMessage || undefined,
      }),
    }), `Batch gift orders created for ${wallets.length} wallets.`);
  };

  const handleTransfer = async (id: string) => {
    await doOp(() => fetch(`/api/nft-sell/gifts/${id}/transfer`, { method: "POST", credentials: "include" }),
      "NFT minted and transferred to recipient.");
    loadGifts();
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this gift order?")) return;
    await doOp(() => fetch(`/api/nft-sell/gifts/${id}`, { method: "DELETE", credentials: "include" }),
      "Gift order cancelled.");
    loadGifts();
  };

  // ── Tab styles ─────────────────────────────────────────────────────────────

  const TAB_ACTIVE   = { borderBottom: "2px solid #41afeb", color: "#41afeb", fontWeight: 700 } as const;
  const TAB_INACTIVE = { borderBottom: "2px solid transparent", color: "#9bafc5", fontWeight: 500 } as const;

  const TABS: { key: Tab; label: string }[] = [
    { key: "eth-airdrop",   label: "ETH Airdrop" },
    { key: "erc20-airdrop", label: "ERC20 Airdrop" },
    { key: "nft-airdrop",   label: "NFT Airdrop" },
    { key: "gift-orders",   label: "Gift Orders" },
  ];

  const ethCount  = parseAddressList(ethRecipients).length;
  const erc20Count = parseAddressList(erc20Recipients).length;
  const nftCount  = parseAddressList(nftRecipients).length;
  const nftIdCount = parseAddressList(nftTokenIds).length;
  const batchCount = parseAddressList(batchWallets).length;

  return (
    <div className="min-h-screen p-4 sm:p-6 space-y-4" style={{ background: "#f8fafc" }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>Gift &amp; Airdrop</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9bafc5" }}>
            On-chain airdrop via BearthAirdrop contract · DB gift order tracking
          </p>
        </div>
      </div>

      {/* Global feedback */}
      {opErr && <ErrBanner msg={opErr} onDismiss={() => setOpErr(null)} />}
      {opOk  && <OkBanner  msg={opOk}  onDismiss={() => setOpOk(null)} />}
      {tx    && <TxBanner  txHash={tx} onDismiss={() => setTx(null)} />}

      {/* Tabs */}
      <div style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div className="flex gap-0">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className="px-4 py-2.5 text-sm transition-colors"
              style={tab === t.key ? TAB_ACTIVE : TAB_INACTIVE}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── ETH AIRDROP ── */}
      {tab === "eth-airdrop" && (
        <div className="space-y-4">
          <SectionCard title="ETH Airdrop Mode" accent="#41afeb">
            <div className="flex gap-4 flex-wrap">
              {(["equal", "skip-failed", "variable"] as const).map(m => (
                <label key={m} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="ethMode" checked={ethMode === m} onChange={() => setEthMode(m)} />
                  <span style={{ color: "#374151" }}>
                    {m === "equal" ? "Equal (all-or-nothing)" : m === "skip-failed" ? "Equal (skip failures)" : "Variable amounts"}
                  </span>
                </label>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: "#9bafc5" }}>
              {ethMode === "equal"
                ? "All recipients get the exact same amount. Reverts if any recipient cannot receive ETH."
                : ethMode === "skip-failed"
                ? "Same amount to each recipient. Recipients that fail are skipped silently."
                : "Each recipient gets a custom ETH amount listed in the same order."}
            </p>
          </SectionCard>

          <SectionCard title="Recipients" accent="#41afeb">
            <FieldLabel>Recipient Addresses (one per line or comma-separated)</FieldLabel>
            <TextArea mono value={ethRecipients} onChange={e => setEthRecipients(e.target.value)}
              rows={6} placeholder={"0xAbc123...\n0xDef456...\n0x789Abc..."} />
            <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>{ethCount} address(es) detected</p>
          </SectionCard>

          {ethMode !== "variable" ? (
            <SectionCard title="Amount per Recipient" accent="#41afeb">
              <FieldLabel>ETH Amount (e.g. 0.01)</FieldLabel>
              <div className="flex gap-2 items-start">
                <TextInput type="number" step="0.0001" min="0" value={ethAmountEach}
                  onChange={e => setEthAmountEach(e.target.value)} placeholder="0.01"
                  style={{ ...inputStyle, width: 160 }} />
                <button onClick={fetchQuote}
                  disabled={quoteLoading || !ethAmountEach || !ethCount}
                  className="px-3 py-2 text-xs font-semibold rounded-lg whitespace-nowrap"
                  style={{ background: "#f0f9ff", color: "#41afeb", border: "1px solid #bae6fd" }}>
                  {quoteLoading ? "Calculating…" : "Preview Total"}
                </button>
              </div>
              {quote && (
                <div className="mt-2 p-3 rounded-lg text-sm" style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}>
                  <span className="font-bold" style={{ color: "#0369a1" }}>Total: {quote.totalEth} ETH</span>
                  <span className="ml-3" style={{ color: "#6b7280" }}>
                    ({quote.recipientCount} × {quote.amountEachEth} ETH)
                  </span>
                </div>
              )}
            </SectionCard>
          ) : (
            <SectionCard title="Amounts per Recipient (Variable)" accent="#41afeb">
              <FieldLabel>ETH Amounts — one per line, same order as recipients</FieldLabel>
              <TextArea mono value={ethAmountsVar} onChange={e => setEthAmountsVar(e.target.value)}
                rows={6} placeholder={"0.01\n0.02\n0.005"} />
              <p className="text-xs mt-1" style={{ color: parseAddressList(ethAmountsVar).length !== ethCount && ethCount > 0 ? "#dc2626" : "#9bafc5" }}>
                {parseAddressList(ethAmountsVar).length} amount(s) / {ethCount} recipient(s)
              </p>
            </SectionCard>
          )}

          <div className="flex justify-end">
            <button onClick={handleEthAirdrop} disabled={saving || !ethCount}
              className="px-6 py-2.5 text-sm font-bold rounded-xl text-white transition-colors"
              style={{ background: saving ? "#9bafc5" : "#41afeb" }}>
              {saving ? "Sending…" : `Send ETH Airdrop (${ethCount} recipients)`}
            </button>
          </div>
        </div>
      )}

      {/* ── ERC20 AIRDROP ── */}
      {tab === "erc20-airdrop" && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl text-xs" style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e" }}>
            The BearthAirdrop contract must be approved to spend tokens first.
            Call <code className="font-mono">token.approve(airdropContract, totalAmount)</code> before sending.
          </div>

          <SectionCard title="ERC20 Token" accent="#7c3aed">
            <FieldLabel>Token Contract Address</FieldLabel>
            <TextInput mono value={erc20Token} onChange={e => setErc20Token(e.target.value)} placeholder="0x..." />
          </SectionCard>

          <SectionCard title="Mode" accent="#7c3aed">
            <div className="flex gap-4">
              {(["equal", "variable"] as const).map(m => (
                <label key={m} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="erc20Mode" checked={erc20Mode === m} onChange={() => setErc20Mode(m)} />
                  <span style={{ color: "#374151" }}>{m === "equal" ? "Equal amount to all" : "Variable amounts"}</span>
                </label>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Recipients" accent="#7c3aed">
            <FieldLabel>Recipient Addresses (one per line or comma-separated)</FieldLabel>
            <TextArea mono value={erc20Recipients} onChange={e => setErc20Recipients(e.target.value)}
              rows={5} placeholder="0xAbc123..." />
            <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>{erc20Count} address(es)</p>
          </SectionCard>

          {erc20Mode === "equal" ? (
            <SectionCard title="Amount" accent="#7c3aed">
              <FieldLabel>Amount per Recipient (wei / smallest unit)</FieldLabel>
              <TextInput mono value={erc20AmountEach} onChange={e => setErc20AmountEach(e.target.value)}
                placeholder="1000000000000000000  (= 1 token with 18 decimals)" />
            </SectionCard>
          ) : (
            <SectionCard title="Amounts (Variable)" accent="#7c3aed">
              <FieldLabel>Wei amounts — one per line, same order as recipients</FieldLabel>
              <TextArea mono value={erc20AmountsVar} onChange={e => setErc20AmountsVar(e.target.value)}
                rows={5} placeholder="1000000000000000000" />
            </SectionCard>
          )}

          <div className="flex justify-end">
            <button onClick={handleErc20Airdrop} disabled={saving || !erc20Token || !erc20Count}
              className="px-6 py-2.5 text-sm font-bold rounded-xl text-white"
              style={{ background: saving ? "#9bafc5" : "#7c3aed" }}>
              {saving ? "Sending…" : `Send ERC20 Airdrop (${erc20Count} recipients)`}
            </button>
          </div>
        </div>
      )}

      {/* ── NFT AIRDROP ── */}
      {tab === "nft-airdrop" && (
        <div className="space-y-4">
          <SectionCard title="NFT Contract" accent="#16a34a">
            <FieldLabel>ERC721 Token Contract Address</FieldLabel>
            <TextInput mono value={nftToken} onChange={e => setNftToken(e.target.value)} placeholder="0x..." />
          </SectionCard>

          <SectionCard title="Recipients &amp; Token IDs" accent="#16a34a">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel>Recipient Addresses (one per line)</FieldLabel>
                <TextArea mono value={nftRecipients} onChange={e => setNftRecipients(e.target.value)}
                  rows={8} placeholder="0xAbc123..." />
                <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>{nftCount} address(es)</p>
              </div>
              <div>
                <FieldLabel>Token IDs (one per line, matching recipients)</FieldLabel>
                <TextArea mono value={nftTokenIds} onChange={e => setNftTokenIds(e.target.value)}
                  rows={8} placeholder={"42\n43\n44"} />
                <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>{nftIdCount} token ID(s)</p>
              </div>
            </div>
            {nftCount > 0 && nftIdCount > 0 && nftCount !== nftIdCount && (
              <p className="text-xs mt-2" style={{ color: "#dc2626" }}>
                Mismatch: {nftCount} recipients vs {nftIdCount} token IDs
              </p>
            )}
          </SectionCard>

          <div className="flex justify-end">
            <button onClick={handleNftAirdrop} disabled={saving || !nftToken || !nftCount}
              className="px-6 py-2.5 text-sm font-bold rounded-xl text-white"
              style={{ background: saving ? "#9bafc5" : "#16a34a" }}>
              {saving ? "Sending…" : `Send NFT Airdrop (${nftCount} recipients)`}
            </button>
          </div>
        </div>
      )}

      {/* ── GIFT ORDERS ── */}
      {tab === "gift-orders" && (
        <div className="space-y-4">

          {/* Single gift */}
          <SectionCard title="Create Gift Order" subtitle="DB-tracked gift for one recipient" accent="#f59e0b">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <FieldLabel>Recipient Wallet Address *</FieldLabel>
                <TextInput mono value={giftWallet} onChange={e => setGiftWallet(e.target.value)} placeholder="0x..." />
              </div>
              <div>
                <FieldLabel>Rarity Tier</FieldLabel>
                <SelectInput value={giftRarity} onChange={e => setGiftRarity(e.target.value)}>
                  <option value="">Any (not specified)</option>
                  <option value="legendary">Legendary</option>
                  <option value="epic">Epic</option>
                  <option value="rare">Rare</option>
                  <option value="common">Common</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Recipient Name</FieldLabel>
                <TextInput value={giftName} onChange={e => setGiftName(e.target.value)} placeholder="Optional" />
              </div>
              <div>
                <FieldLabel>Recipient Email</FieldLabel>
                <TextInput value={giftEmail} onChange={e => setGiftEmail(e.target.value)} placeholder="Optional" />
              </div>
              <div className="sm:col-span-2">
                <FieldLabel>Gift Message</FieldLabel>
                <TextInput value={giftMessage} onChange={e => setGiftMessage(e.target.value)} placeholder="Optional message" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "#374151" }}>
                  <input type="checkbox" checked={giftIsAirdrop} onChange={e => setGiftIsAirdrop(e.target.checked)} />
                  Mark as airdrop (free gift)
                </label>
              </div>
            </div>
            <button onClick={handleCreateGift} disabled={saving || !giftWallet}
              className="mt-3 px-5 py-2 text-sm font-bold rounded-lg text-white"
              style={{ background: saving ? "#9bafc5" : "#f59e0b" }}>
              {saving ? "Creating…" : "Create Gift Order"}
            </button>
          </SectionCard>

          {/* Batch gifts */}
          <SectionCard title="Batch Gift Orders" subtitle="Create multiple gift orders at once" accent="#f59e0b">
            <FieldLabel>Recipient Wallets (one per line or comma-separated)</FieldLabel>
            <TextArea mono value={batchWallets} onChange={e => setBatchWallets(e.target.value)}
              rows={4} placeholder="0xAbc123..." />
            <p className="text-xs mt-1 mb-3" style={{ color: "#9bafc5" }}>{batchCount} wallet(s)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Rarity Tier (applies to all)</FieldLabel>
                <SelectInput value={batchRarity} onChange={e => setBatchRarity(e.target.value)}>
                  <option value="">Not specified</option>
                  <option value="legendary">Legendary</option>
                  <option value="epic">Epic</option>
                  <option value="rare">Rare</option>
                  <option value="common">Common</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Gift Message (applies to all)</FieldLabel>
                <TextInput value={batchMessage} onChange={e => setBatchMessage(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <button onClick={handleBatchGift} disabled={saving || !batchCount}
              className="mt-3 px-5 py-2 text-sm font-bold rounded-lg text-white"
              style={{ background: saving ? "#9bafc5" : "#f59e0b" }}>
              {saving ? "Creating…" : `Create ${batchCount} Gift Orders`}
            </button>
          </SectionCard>

          {/* Gift orders list */}
          <SectionCard title="All Gift Orders" accent="#f59e0b">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs" style={{ color: "#9bafc5" }}>{gifts.length} order(s)</span>
              <button onClick={loadGifts} className="text-xs px-2 py-1 rounded" style={{ color: "#41afeb" }}>
                Refresh
              </button>
            </div>

            {giftsLoading ? (
              <p className="text-sm text-center py-4" style={{ color: "#9bafc5" }}>Loading…</p>
            ) : gifts.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "#9bafc5" }}>No gift orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                      {["Recipient Wallet", "Rarity", "Airdrop", "Status", "Created", "Actions"].map(h => (
                        <th key={h} className="py-2 px-2 text-left font-semibold" style={{ color: "#9bafc5" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gifts.map(g => (
                      <tr key={g.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td className="py-2 px-2 font-mono" style={{ color: "#374151" }}>
                          {g.recipient_wallet.slice(0, 10)}…{g.recipient_wallet.slice(-6)}
                          {g.recipient_name && (
                            <span className="ml-1 not-mono" style={{ color: "#9bafc5" }}>({g.recipient_name})</span>
                          )}
                        </td>
                        <td className="py-2 px-2 capitalize" style={{ color: "#374151" }}>{g.rarity_tier ?? "—"}</td>
                        <td className="py-2 px-2">
                          <span style={{ color: g.is_airdrop ? "#16a34a" : "#9bafc5" }}>
                            {g.is_airdrop ? "✓" : "—"}
                          </span>
                        </td>
                        <td className="py-2 px-2"><StatusBadge status={g.status} /></td>
                        <td className="py-2 px-2" style={{ color: "#9bafc5" }}>
                          {new Date(g.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex gap-1 items-center">
                            {g.status === "pending" && (
                              <>
                                <button onClick={() => handleTransfer(g.id)} disabled={saving}
                                  className="px-2 py-1 rounded text-xs font-semibold text-white"
                                  style={{ background: "#16a34a" }}>
                                  Mint &amp; Transfer
                                </button>
                                <button onClick={() => handleCancel(g.id)} disabled={saving}
                                  className="px-2 py-1 rounded text-xs font-semibold"
                                  style={{ background: "#fef2f2", color: "#dc2626" }}>
                                  Cancel
                                </button>
                              </>
                            )}
                            {g.tx_hash && (
                              <span className="font-mono text-xs" style={{ color: "#9bafc5" }}>
                                TX:{g.tx_hash.slice(0, 8)}…
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
