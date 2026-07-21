"use client";

import { useEffect, useState } from "react";
import { ErrBanner } from "@/components/nft/ErrBanner";
import { OkBanner } from "@/components/nft/OkBanner";
import { labelStyle, inputStyle, thStyle } from "@/components/nft/styles";

interface GiftOrder {
  id: string;
  sender_wallet: string | null;
  recipient_wallet: string;
  recipient_name: string | null;
  recipient_email: string | null;
  rarity_tier: string | null;
  gift_message: string | null;
  price_eth: string | null;
  price_twd: string | null;
  is_airdrop: boolean;
  status: string;
  minted_token_id: number | null;
  transfer_tx_hash: string | null;
  transferred_at: string | null;
  created_at: string;
  sender_name?: string;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    pending:     { bg: "rgba(217,119,6,0.1)",    color: "#d97706" },
    paid:        { bg: "rgba(65,175,235,0.12)",  color: "#41afeb" },
    transferred: { bg: "rgba(22,163,74,0.1)",    color: "#16a34a" },
    cancelled:   { bg: "rgba(156,163,175,0.12)", color: "#9ca3af" },
  };
  const c = cfg[status] ?? cfg.pending;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}

function TypeBadge({ isAirdrop }: { isAirdrop: boolean }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={isAirdrop
        ? { background: "rgba(217,119,6,0.1)", color: "#d97706" }
        : { background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}>
      {isAirdrop ? "Airdrop" : "Gift"}
    </span>
  );
}

export default function GiftsPage() {
  const [gifts, setGifts]               = useState<GiftOrder[]>([]);
  const [loading, setLoading]           = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [saving, setSaving]             = useState(false);
  const [err, setErr]                   = useState<string | null>(null);
  const [ok, setOk]                     = useState<string | null>(null);
  const [tab, setTab]                   = useState<"gifts" | "airdrop">("gifts");
  const [showCreate, setShowCreate]     = useState(false);
  const [showAirdrop, setShowAirdrop]   = useState(false);
  const [transferId, setTransferId]     = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    sender_wallet: "",
    recipient_wallet: "",
    recipient_name: "",
    recipient_email: "",
    rarity_tier: "any",
    gift_message: "",
    price_eth: "",
    price_twd: "",
    payment_method: "eth",
    is_airdrop: false,
  });

  const [airdropWallets, setAirdropWallets] = useState("");
  const [airdropRarity, setAirdropRarity]   = useState("any");
  const [airdropMessage, setAirdropMessage] = useState("");
  const [airdropLoading, setAirdropLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/nft-sell/gifts", { credentials: "include" });
      const d = await r.json();
      setGifts(d.gifts ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function createGift() {
    if (!createForm.recipient_wallet) return setErr("Recipient wallet is required.");
    setSaving(true); setErr(null);
    try {
      const body: Record<string, unknown> = {
        recipient_wallet: createForm.recipient_wallet,
        is_airdrop:       createForm.is_airdrop,
      };
      if (createForm.sender_wallet)  body.sender_wallet  = createForm.sender_wallet;
      if (createForm.recipient_name) body.recipient_name = createForm.recipient_name;
      if (createForm.recipient_email)body.recipient_email= createForm.recipient_email;
      if (createForm.rarity_tier && createForm.rarity_tier !== "any") body.rarity_tier = createForm.rarity_tier;
      if (createForm.gift_message)   body.gift_message   = createForm.gift_message;
      if (!createForm.is_airdrop) {
        if (createForm.price_eth)      body.price_eth      = createForm.price_eth;
        if (createForm.price_twd)      body.price_twd      = createForm.price_twd;
        if (createForm.payment_method) body.payment_method = createForm.payment_method;
      }

      const r = await fetch("/api/nft-sell/gifts", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to create gift order");
      setOk(createForm.is_airdrop ? "Airdrop gift created" : "Gift order created");
      setShowCreate(false);
      setCreateForm({ sender_wallet: "", recipient_wallet: "", recipient_name: "", recipient_email: "", rarity_tier: "any", gift_message: "", price_eth: "", price_twd: "", payment_method: "eth", is_airdrop: false });
      load();
    } finally { setSaving(false); }
  }

  async function batchAirdrop() {
    const wallets = airdropWallets
      .split(/[\n,]+/)
      .map(w => w.trim())
      .filter(w => w.length > 0);
    if (wallets.length === 0) return setErr("At least one recipient wallet is required.");
    setAirdropLoading(true); setErr(null);
    try {
      const body: Record<string, unknown> = {
        recipient_wallets: wallets,
      };
      if (airdropRarity && airdropRarity !== "any") body.rarity_tier  = airdropRarity;
      if (airdropMessage)                            body.gift_message = airdropMessage;

      const r = await fetch("/api/nft-sell/gifts/airdrop", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to create airdrops");
      setOk(`Airdrop created for ${wallets.length} recipient${wallets.length !== 1 ? "s" : ""}`);
      setShowAirdrop(false);
      setAirdropWallets(""); setAirdropRarity("any"); setAirdropMessage("");
      load();
    } finally { setAirdropLoading(false); }
  }

  async function transfer(id: string) {
    const gift = gifts.find(g => g.id === id);
    if (!gift) return;
    if (!confirm(`Mint 1 NFT and send to ${gift.recipient_wallet.slice(0, 10)}… on-chain?`)) return;
    setTransferring(true); setErr(null);
    try {
      const r = await fetch(`/api/nft-sell/gifts/${id}/transfer`, {
        method: "POST", credentials: "include",
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to transfer");
      setOk("Gift NFT transferred on-chain");
      load();
    } finally { setTransferring(false); }
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this gift order?")) return;
    await fetch(`/api/nft-sell/gifts/${id}`, { method: "DELETE", credentials: "include" });
    setOk("Gift order cancelled");
    load();
  }

  const filteredGifts = tab === "airdrop"
    ? gifts.filter(g => g.is_airdrop)
    : gifts.filter(g => !g.is_airdrop);

  const stats = {
    totalGifts:   gifts.filter(g => !g.is_airdrop).length,
    airdrops:     gifts.filter(g => g.is_airdrop).length,
    transferred:  gifts.filter(g => g.status === "transferred").length,
  };

  const airdropWalletCount = airdropWallets
    .split(/[\n,]+/)
    .map(w => w.trim())
    .filter(Boolean).length;

  const Overlay = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>Gift &amp; Airdrop</h1>
          <p className="text-sm text-gray-400 mt-0.5">Send NFTs directly to recipient wallets — paid gifts or free airdrops</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowCreate(true); setErr(null); setCreateForm(f => ({ ...f, is_airdrop: false })); }}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#7c3aed" }}>
            + New Gift Order
          </button>
          <button onClick={() => { setShowAirdrop(true); setErr(null); }}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#d97706" }}>
            + Batch Airdrop
          </button>
        </div>
      </div>

      {ok  && <OkBanner  msg={ok}  onDismiss={() => setOk(null)} />}
      {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Gifts",  value: stats.totalGifts,  color: "#7c3aed" },
          { label: "Airdrops",     value: stats.airdrops,    color: "#d97706" },
          { label: "Transferred",  value: stats.transferred, color: "#16a34a" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.label}</div>
            <div className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b" style={{ borderColor: "#e5e7eb" }}>
        {(["gifts", "airdrop"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 text-xs font-semibold rounded-t-lg -mb-px transition-colors capitalize"
            style={tab === t
              ? { background: "white", color: "#41afeb", border: "1px solid #e5e7eb", borderBottom: "1px solid white" }
              : { color: "#9bafc5", border: "1px solid transparent" }}>
            {t === "gifts" ? "Gifts" : "Airdrops"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {["Recipient Wallet", "Recipient Name", "Rarity", "Price", "Type", "Status", "Tx Hash", "Actions"].map(h => (
                  <th key={h} style={thStyle} className="text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredGifts.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-sm text-gray-400">
                  {tab === "airdrop" ? "No airdrops yet" : "No gift orders yet"}
                </td></tr>
              ) : filteredGifts.map(gift => (
                <tr key={gift.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-sm font-mono text-gray-700">
                    {gift.recipient_wallet.slice(0, 6)}…{gift.recipient_wallet.slice(-4)}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600">{gift.recipient_name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-3 text-sm text-gray-500 capitalize">{gift.rarity_tier ?? "any"}</td>
                  <td className="px-3 py-3 text-sm text-gray-700">
                    {gift.is_airdrop ? (
                      <span className="text-gray-300">Free</span>
                    ) : gift.price_eth != null ? (
                      `${gift.price_eth} ETH`
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3"><TypeBadge isAirdrop={gift.is_airdrop} /></td>
                  <td className="px-3 py-3"><StatusBadge status={gift.status} /></td>
                  <td className="px-3 py-3 text-xs font-mono text-gray-400">
                    {gift.transfer_tx_hash
                      ? `${gift.transfer_tx_hash.slice(0, 8)}…${gift.transfer_tx_hash.slice(-4)}`
                      : <span className="text-gray-200">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      {(gift.status === "pending" || gift.status === "paid") && (
                        <button
                          onClick={() => transfer(gift.id)}
                          disabled={transferring}
                          className="text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a", opacity: transferring ? 0.6 : 1 }}>
                          {transferring ? "…" : "Transfer"}
                        </button>
                      )}
                      {gift.status !== "transferred" && gift.status !== "cancelled" && (
                        <button onClick={() => cancel(gift.id)}
                          className="text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Gift Modal */}
      {showCreate && (
        <Overlay>
          <h2 className="text-base font-bold mb-4" style={{ color: "#24315f" }}>New Gift Order</h2>
          <div className="space-y-3">
            {/* Airdrop toggle */}
            <div className="flex items-center justify-between px-3 py-2 rounded-lg"
              style={{ background: createForm.is_airdrop ? "rgba(217,119,6,0.06)" : "#f9fafb", border: "1px solid #e5e7eb" }}>
              <span className="text-xs font-semibold" style={{ color: "#24315f" }}>
                {createForm.is_airdrop ? "This is a free airdrop" : "This is a paid gift"}
              </span>
              <button
                type="button"
                onClick={() => setCreateForm(f => ({ ...f, is_airdrop: !f.is_airdrop }))}
                className="relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors"
                style={{ background: createForm.is_airdrop ? "#d97706" : "#d1d5db" }}>
                <span className="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-1"
                  style={{ transform: createForm.is_airdrop ? "translateX(24px)" : "translateX(4px)" }} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Sender Wallet (optional)</label>
                <input type="text" value={createForm.sender_wallet}
                  onChange={e => setCreateForm(f => ({ ...f, sender_wallet: e.target.value }))}
                  placeholder="0x…" style={{ ...inputStyle, fontFamily: "monospace" }} />
              </div>
              <div>
                <label style={labelStyle}>Recipient Wallet *</label>
                <input type="text" value={createForm.recipient_wallet}
                  onChange={e => setCreateForm(f => ({ ...f, recipient_wallet: e.target.value }))}
                  placeholder="0x…" style={{ ...inputStyle, fontFamily: "monospace" }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Recipient Name</label>
                <input type="text" value={createForm.recipient_name}
                  onChange={e => setCreateForm(f => ({ ...f, recipient_name: e.target.value }))}
                  placeholder="Alice" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Recipient Email</label>
                <input type="email" value={createForm.recipient_email}
                  onChange={e => setCreateForm(f => ({ ...f, recipient_email: e.target.value }))}
                  placeholder="alice@example.com" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Rarity Tier</label>
              <select value={createForm.rarity_tier}
                onChange={e => setCreateForm(f => ({ ...f, rarity_tier: e.target.value }))}
                style={inputStyle}>
                <option value="any">Any</option>
                <option value="legendary">Legendary</option>
                <option value="epic">Epic</option>
                <option value="rare">Rare</option>
                <option value="common">Common</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Gift Message</label>
              <textarea value={createForm.gift_message}
                onChange={e => setCreateForm(f => ({ ...f, gift_message: e.target.value }))}
                rows={2} style={{ ...inputStyle, resize: "vertical" }}
                placeholder="Congratulations! Here is your Bearth NFT…" />
            </div>
            {!createForm.is_airdrop && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Price (ETH)</label>
                    <input type="number" step="0.0001" value={createForm.price_eth}
                      onChange={e => setCreateForm(f => ({ ...f, price_eth: e.target.value }))}
                      placeholder="0.03" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Price (TWD)</label>
                    <input type="number" step="1" value={createForm.price_twd}
                      onChange={e => setCreateForm(f => ({ ...f, price_twd: e.target.value }))}
                      placeholder="30000" style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Payment Method</label>
                  <select value={createForm.payment_method}
                    onChange={e => setCreateForm(f => ({ ...f, payment_method: e.target.value }))}
                    style={inputStyle}>
                    <option value="eth">ETH</option>
                    <option value="twd">TWD</option>
                    <option value="mixed">Mixed</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </>
            )}
          </div>
          {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowCreate(false)}
              className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">
              Cancel
            </button>
            <button onClick={createGift} disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: createForm.is_airdrop ? "#d97706" : "#7c3aed", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Creating…" : createForm.is_airdrop ? "Create Airdrop" : "Create Gift"}
            </button>
          </div>
        </Overlay>
      )}

      {/* Batch Airdrop Modal */}
      {showAirdrop && (
        <Overlay>
          <h2 className="text-base font-bold mb-1" style={{ color: "#24315f" }}>Batch Airdrop</h2>
          <p className="text-xs text-gray-400 mb-4">
            Drop one NFT to each recipient wallet for free. All wallets receive individual gift records.
          </p>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Recipient Wallets (one per line or comma-separated)</label>
              <textarea
                value={airdropWallets}
                onChange={e => setAirdropWallets(e.target.value)}
                rows={6}
                placeholder={"0xABC...\n0xDEF...\n0x123..."}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: "12px" }} />
              <p className="text-xs mt-1" style={{ color: airdropWalletCount > 0 ? "#41afeb" : "#9bafc5" }}>
                {airdropWalletCount > 0
                  ? `${airdropWalletCount} wallet${airdropWalletCount !== 1 ? "s" : ""} detected`
                  : "Paste wallet addresses above"}
              </p>
            </div>
            <div>
              <label style={labelStyle}>Rarity Tier (applied to all)</label>
              <select value={airdropRarity} onChange={e => setAirdropRarity(e.target.value)} style={inputStyle}>
                <option value="any">Any</option>
                <option value="legendary">Legendary</option>
                <option value="epic">Epic</option>
                <option value="rare">Rare</option>
                <option value="common">Common</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Gift Message (optional)</label>
              <textarea
                value={airdropMessage}
                onChange={e => setAirdropMessage(e.target.value)}
                rows={2}
                placeholder="You have received a Bearth NFT airdrop!"
                style={{ ...inputStyle, resize: "vertical" }} />
            </div>
          </div>
          {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowAirdrop(false)}
              className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">
              Cancel
            </button>
            <button onClick={batchAirdrop} disabled={airdropLoading || airdropWalletCount === 0}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#d97706", opacity: (airdropLoading || airdropWalletCount === 0) ? 0.6 : 1 }}>
              {airdropLoading
                ? "Creating…"
                : `Airdrop to ${airdropWalletCount} Wallet${airdropWalletCount !== 1 ? "s" : ""}`}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
