"use client";

import { useEffect, useState } from "react";
import { ErrBanner } from "@/components/nft/ErrBanner";
import { OkBanner } from "@/components/nft/OkBanner";
import { labelStyle, inputStyle, thStyle } from "@/components/nft/styles";

interface AuctionSession {
  id: string;
  wave_number: number | null;
  token_id: number | null;
  auction_mode: string;
  platform: string;
  contract_address: string | null;
  opensea_listing_id: string | null;
  start_price_eth: number | null;
  reserve_price_eth: number | null;
  current_bid_eth: number | null;
  current_bidder: string | null;
  auction_end_time: string | null;
  winner_wallet: string | null;
  winning_bid_eth: number | null;
  status: string;
  settlement_tx_hash: string | null;
  settled_at: string | null;
  notes: string | null;
  created_at: string;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; color: string }> = {
    upcoming:  { bg: "rgba(156,163,175,0.12)", color: "#9ca3af" },
    active:    { bg: "rgba(65,175,235,0.12)",  color: "#41afeb" },
    settled:   { bg: "rgba(22,163,74,0.1)",    color: "#16a34a" },
    cancelled: { bg: "rgba(220,38,38,0.1)",    color: "#dc2626" },
  };
  const c = cfg[status] ?? cfg.upcoming;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: c.bg, color: c.color }}>
      {status}
    </span>
  );
}

export default function AuctionsPage() {
  const [auctions, setAuctions] = useState<AuctionSession[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettle, setShowSettle] = useState<AuctionSession | null>(null);
  const [showSyncBid, setShowSyncBid] = useState<AuctionSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk]   = useState<string | null>(null);

  const [form, setForm] = useState({
    auction_mode: "wave", platform: "bearth",
    wave_number: "", token_id: "",
    contract_address: "", opensea_listing_id: "",
    start_price_eth: "", reserve_price_eth: "", auction_end_time: "", notes: "",
  });
  const [settleForm, setSettleForm] = useState({ winner_wallet: "", winning_bid_eth: "", settlement_tx_hash: "" });
  const [syncForm, setSyncForm] = useState({ current_bid_eth: "", current_bidder: "" });

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/nft-sell/auctions", { credentials: "include" });
      const d = await r.json();
      setAuctions(d.auctions ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function create() {
    setSaving(true); setErr(null);
    try {
      const body: Record<string, unknown> = {
        auction_mode: form.auction_mode, platform: form.platform,
      };
      if (form.wave_number)         body.wave_number         = parseInt(form.wave_number);
      if (form.token_id)            body.token_id            = parseInt(form.token_id);
      if (form.contract_address)    body.contract_address    = form.contract_address;
      if (form.opensea_listing_id)  body.opensea_listing_id  = form.opensea_listing_id;
      if (form.start_price_eth)     body.start_price_eth     = form.start_price_eth;
      if (form.reserve_price_eth)   body.reserve_price_eth   = form.reserve_price_eth;
      if (form.auction_end_time)    body.auction_end_time    = form.auction_end_time;
      if (form.notes)               body.notes               = form.notes;

      const r = await fetch("/api/nft-sell/auctions", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to create auction");
      setOk("Auction session created"); setShowCreate(false);
      load();
    } finally { setSaving(false); }
  }

  async function settle() {
    if (!showSettle) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/nft-sell/auctions/${showSettle.id}/settle`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settleForm),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to settle");
      setOk("Auction settled"); setShowSettle(null);
      load();
    } finally { setSaving(false); }
  }

  async function syncBid() {
    if (!showSyncBid) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/nft-sell/auctions/${showSyncBid.id}/sync-bid`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syncForm),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to sync bid");
      setOk("Bid synced"); setShowSyncBid(null);
      load();
    } finally { setSaving(false); }
  }

  async function cancel(id: string) {
    if (!confirm("Cancel this auction session?")) return;
    await fetch(`/api/nft-sell/auctions/${id}`, { method: "DELETE", credentials: "include" });
    load();
  }

  const stats = {
    total:    auctions.length,
    active:   auctions.filter(a => a.status === "active").length,
    settled:  auctions.filter(a => a.status === "settled").length,
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>Auction Sessions</h1>
          <p className="text-sm text-gray-400 mt-0.5">English auction tracking (Bearth platform + OpenSea)</p>
        </div>
        <button onClick={() => { setShowCreate(true); setErr(null); }}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: "#41afeb" }}>
          + New Auction
        </button>
      </div>

      {ok  && <OkBanner  msg={ok}  onDismiss={() => setOk(null)} />}
      {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: stats.total, color: "#41afeb" },
          { label: "Active", value: stats.active, color: "#d97706" },
          { label: "Settled", value: stats.settled, color: "#16a34a" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.label}</div>
            <div className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</div>
          </div>
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
                {["Mode", "Platform", "Wave/Token", "Start Price", "Current Bid", "End Time", "Status", "Actions"].map(h => (
                  <th key={h} style={thStyle} className="text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {auctions.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-sm text-gray-400">No auction sessions yet</td></tr>
              ) : auctions.map(a => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-sm font-medium text-gray-700">{a.auction_mode}</td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: a.platform === "bearth" ? "rgba(65,175,235,0.12)" : "rgba(124,58,237,0.1)", color: a.platform === "bearth" ? "#41afeb" : "#7c3aed" }}>
                      {a.platform}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-600">
                    {a.wave_number ? `Wave ${a.wave_number}` : a.token_id ? `Token #${a.token_id}` : "—"}
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700">{a.start_price_eth != null ? `${a.start_price_eth} ETH` : "—"}</td>
                  <td className="px-3 py-3 text-sm font-semibold" style={{ color: "#41afeb" }}>
                    {a.current_bid_eth != null ? `${a.current_bid_eth} ETH` : "—"}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {a.auction_end_time ? new Date(a.auction_end_time).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-3 py-3"><StatusBadge status={a.status} /></td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      {a.status === "active" && (
                        <>
                          <button onClick={() => { setShowSyncBid(a); setSyncForm({ current_bid_eth: "", current_bidder: "" }); setErr(null); }}
                            className="text-xs px-2 py-1 rounded-lg font-medium"
                            style={{ background: "rgba(65,175,235,0.12)", color: "#41afeb" }}>
                            Sync Bid
                          </button>
                          <button onClick={() => { setShowSettle(a); setSettleForm({ winner_wallet: a.current_bidder ?? "", winning_bid_eth: String(a.current_bid_eth ?? ""), settlement_tx_hash: "" }); setErr(null); }}
                            className="text-xs px-2 py-1 rounded-lg font-medium"
                            style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                            Settle
                          </button>
                        </>
                      )}
                      {a.status === "upcoming" && (
                        <button onClick={() => cancel(a.id)}
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

      {/* Create Modal */}
      {showCreate && (
        <Overlay>
          <h2 className="text-base font-bold mb-4" style={{ color: "#24315f" }}>New Auction Session</h2>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Mode</label>
              <select value={form.auction_mode} onChange={e => setForm(f => ({ ...f, auction_mode: e.target.value }))}
                style={inputStyle}>
                <option value="wave">Wave (English Auction per wave)</option>
                <option value="token">Token (single NFT auction)</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Platform</label>
              <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))}
                style={inputStyle}>
                <option value="bearth">Bearth (BearthAuction.sol)</option>
                <option value="opensea">OpenSea (off-chain bidding)</option>
              </select>
            </div>
            {form.auction_mode === "wave" ? (
              <div>
                <label style={labelStyle}>Wave Number (3–7)</label>
                <input type="number" min={3} max={7} value={form.wave_number}
                  onChange={e => setForm(f => ({ ...f, wave_number: e.target.value }))}
                  placeholder="e.g. 3" style={inputStyle} />
              </div>
            ) : (
              <div>
                <label style={labelStyle}>Token ID</label>
                <input type="number" value={form.token_id}
                  onChange={e => setForm(f => ({ ...f, token_id: e.target.value }))}
                  placeholder="e.g. 42" style={inputStyle} />
              </div>
            )}
            {form.platform === "bearth" ? (
              <div>
                <label style={labelStyle}>Contract Address (BearthAuction.sol)</label>
                <input type="text" value={form.contract_address}
                  onChange={e => setForm(f => ({ ...f, contract_address: e.target.value }))}
                  placeholder="0x..." style={inputStyle} />
              </div>
            ) : (
              <div>
                <label style={labelStyle}>OpenSea Listing ID</label>
                <input type="text" value={form.opensea_listing_id}
                  onChange={e => setForm(f => ({ ...f, opensea_listing_id: e.target.value }))}
                  placeholder="opensea-listing-id" style={inputStyle} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Start Price (ETH)</label>
                <input type="number" step="0.0001" value={form.start_price_eth}
                  onChange={e => setForm(f => ({ ...f, start_price_eth: e.target.value }))}
                  placeholder="0.0303" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Reserve Price (ETH)</label>
                <input type="number" step="0.0001" value={form.reserve_price_eth}
                  onChange={e => setForm(f => ({ ...f, reserve_price_eth: e.target.value }))}
                  placeholder="0.05" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Auction End Time</label>
              <input type="datetime-local" value={form.auction_end_time}
                onChange={e => setForm(f => ({ ...f, auction_end_time: e.target.value }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
          </div>
          {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={create} disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Creating…" : "Create Auction"}
            </button>
          </div>
        </Overlay>
      )}

      {/* Sync Bid Modal */}
      {showSyncBid && (
        <Overlay>
          <h2 className="text-base font-bold mb-4" style={{ color: "#24315f" }}>Sync Current Bid</h2>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Current Bid (ETH)</label>
              <input type="number" step="0.0001" value={syncForm.current_bid_eth}
                onChange={e => setSyncForm(f => ({ ...f, current_bid_eth: e.target.value }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Current Bidder (wallet)</label>
              <input type="text" value={syncForm.current_bidder}
                onChange={e => setSyncForm(f => ({ ...f, current_bidder: e.target.value }))}
                placeholder="0x..." style={inputStyle} />
            </div>
          </div>
          {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowSyncBid(null)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={syncBid} disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Syncing…" : "Sync Bid"}
            </button>
          </div>
        </Overlay>
      )}

      {/* Settle Modal */}
      {showSettle && (
        <Overlay>
          <h2 className="text-base font-bold mb-1" style={{ color: "#24315f" }}>Settle Auction</h2>
          <p className="text-xs text-gray-400 mb-4">Record winner and mark auction as settled.</p>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Winner Wallet</label>
              <input type="text" value={settleForm.winner_wallet}
                onChange={e => setSettleForm(f => ({ ...f, winner_wallet: e.target.value }))}
                placeholder="0x..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Winning Bid (ETH)</label>
              <input type="number" step="0.0001" value={settleForm.winning_bid_eth}
                onChange={e => setSettleForm(f => ({ ...f, winning_bid_eth: e.target.value }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Settlement Tx Hash (optional)</label>
              <input type="text" value={settleForm.settlement_tx_hash}
                onChange={e => setSettleForm(f => ({ ...f, settlement_tx_hash: e.target.value }))}
                placeholder="0x..." style={inputStyle} />
            </div>
          </div>
          {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowSettle(null)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={settle} disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#16a34a", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Settling…" : "Settle Auction"}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
