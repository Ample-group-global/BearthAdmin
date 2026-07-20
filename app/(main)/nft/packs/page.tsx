"use client";

import { useEffect, useState } from "react";

interface PackDef {
  id: string;
  name: string;
  wave_id: string | null;
  pack_size: number;
  rarity_composition: { rarity: string; count: number }[];
  bonus_chance_pct: number | null;
  price_eth: number;
  price_twd: number | null;
  randomness_seed: string | null;
  commitment_hash: string | null;
  is_active: boolean;
  created_at: string;
}

interface PackOrder {
  id: string;
  pack_index: number;
  buyer_wallet: string;
  assigned_nft_ids: string[] | null;
  revealed: boolean;
  created_at: string;
}

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

const RARITIES = ["legendary", "epic", "rare", "common"];

export default function PacksPage() {
  const [packs, setPacks]       = useState<PackDef[]>([]);
  const [selected, setSelected] = useState<PackDef | null>(null);
  const [orders, setOrders]     = useState<PackOrder[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [showCommit, setShowCommit]   = useState<PackDef | null>(null);
  const [showReveal, setShowReveal]   = useState<PackDef | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [ok, setOk]             = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "", pack_size: "3", price_eth: "", price_twd: "", bonus_chance_pct: "",
    composition: RARITIES.reduce((acc, r) => ({ ...acc, [r]: "0" }), {} as Record<string, string>),
  });
  const [commitSeed, setCommitSeed]   = useState("");
  const [revealSeed, setRevealSeed]   = useState("");
  const [orderWallet, setOrderWallet] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/nft-sell/packs", { credentials: "include" });
      const d = await r.json();
      setPacks(d.packs ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function loadOrders(packId: string) {
    const r = await fetch(`/api/nft-sell/packs/${packId}/orders`, { credentials: "include" });
    const d = await r.json();
    setOrders(d.orders ?? []);
  }

  function selectPack(p: PackDef) { setSelected(p); loadOrders(p.id); }

  async function createPack() {
    setSaving(true); setErr(null);
    try {
      const rarity_composition = RARITIES
        .filter(r => parseInt(form.composition[r]) > 0)
        .map(r => ({ rarity: r, count: parseInt(form.composition[r]) }));
      const r = await fetch("/api/nft-sell/packs", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          pack_size: parseInt(form.pack_size),
          rarity_composition,
          price_eth: parseFloat(form.price_eth),
          price_twd: form.price_twd ? parseFloat(form.price_twd) : undefined,
          bonus_chance_pct: form.bonus_chance_pct ? parseFloat(form.bonus_chance_pct) : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to create pack");
      setOk("Pack definition created"); setShowCreate(false); load();
    } finally { setSaving(false); }
  }

  async function commitSeedFn() {
    if (!showCommit) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/nft-sell/packs/${showCommit.id}/commit`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: commitSeed }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to commit");
      setOk(`Committed. Hash: ${d.commitment_hash?.slice(0, 20)}…`);
      setShowCommit(null); setCommitSeed(""); load();
    } finally { setSaving(false); }
  }

  async function revealPack() {
    if (!showReveal) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/nft-sell/packs/${showReveal.id}/reveal`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: revealSeed }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to reveal");
      setOk(`Packs revealed: ${JSON.stringify(d.revealed)}`);
      setShowReveal(null); setRevealSeed(""); loadOrders(showReveal.id);
    } finally { setSaving(false); }
  }

  async function createOrder() {
    if (!selected) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/nft-sell/packs/${selected.id}/orders`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer_wallet: orderWallet }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to create order");
      setOk(`Pack order created (index ${d.order?.pack_index})`);
      setShowNewOrder(false); setOrderWallet("");
      loadOrders(selected.id);
    } finally { setSaving(false); }
  }

  const Overlay = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>Mystery Box Packs</h1>
          <p className="text-sm text-gray-400 mt-0.5">Commit-reveal randomness — verifiable, fair NFT pack allocation</p>
        </div>
        <button onClick={() => { setShowCreate(true); setErr(null); }}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#41afeb" }}>
          + New Pack Type
        </button>
      </div>

      {ok && <div className="px-3 py-2 rounded-lg text-xs text-green-700" style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.3)" }}>{ok}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pack definitions */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Pack Definitions</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {packs.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">No pack types yet</div>
              ) : packs.map(p => (
                <div key={p.id} onClick={() => selectPack(p)}
                  className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  style={selected?.id === p.id ? { background: "rgba(65,175,235,0.06)" } : {}}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm" style={{ color: "#24315f" }}>{p.name}</span>
                    <div className="flex gap-1">
                      {!p.commitment_hash && (
                        <button onClick={e => { e.stopPropagation(); setShowCommit(p); setCommitSeed(""); setErr(null); }}
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: "rgba(217,119,6,0.1)", color: "#d97706" }}>
                          Commit Seed
                        </button>
                      )}
                      {p.commitment_hash && !p.randomness_seed && (
                        <button onClick={e => { e.stopPropagation(); setShowReveal(p); setRevealSeed(""); setErr(null); }}
                          className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                          Reveal
                        </button>
                      )}
                      {p.randomness_seed && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                          Revealed ✓
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {p.pack_size} NFTs · {p.price_eth} ETH
                    {p.commitment_hash ? " · Hash committed" : " · No hash yet"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pack orders */}
        <div className="space-y-4">
          {selected ? (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Orders — {selected.name}</h2>
                <button onClick={() => { setShowNewOrder(true); setErr(null); }}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#41afeb" }}>
                  + Add Order
                </button>
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    {["#", "Buyer", "NFTs Assigned", "Revealed"].map(h => (
                      <th key={h} style={{ ...thStyle, padding: "8px 10px" }} className="text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-6 text-xs text-gray-400">No orders yet</td></tr>
                  ) : orders.map(o => (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-2 py-2 text-xs font-semibold text-gray-700">{o.pack_index}</td>
                      <td className="px-2 py-2 text-xs font-mono text-gray-500">{o.buyer_wallet.slice(0, 10)}…</td>
                      <td className="px-2 py-2 text-xs text-gray-500">{o.assigned_nft_ids?.length ?? 0} NFT(s)</td>
                      <td className="px-2 py-2">
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                          style={{ background: o.revealed ? "rgba(22,163,74,0.1)" : "rgba(217,119,6,0.1)", color: o.revealed ? "#16a34a" : "#d97706" }}>
                          {o.revealed ? "Yes" : "No"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400" style={{ border: "1px solid #e5e7eb" }}>
              Select a pack type to view orders
            </div>
          )}
        </div>
      </div>

      {/* Create Pack Modal */}
      {showCreate && (
        <Overlay>
          <h2 className="text-base font-bold mb-4" style={{ color: "#24315f" }}>New Pack Definition</h2>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Pack Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Pack of 3" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Pack Size</label>
              <input type="number" min={1} value={form.pack_size} onChange={e => setForm(f => ({ ...f, pack_size: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Rarity Composition</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {RARITIES.map(r => (
                  <div key={r} className="flex items-center gap-2">
                    <span className="text-xs font-semibold w-20 text-gray-600 capitalize">{r}</span>
                    <input type="number" min={0} value={form.composition[r]}
                      onChange={e => setForm(f => ({ ...f, composition: { ...f.composition, [r]: e.target.value } }))}
                      style={{ ...inputStyle, width: "60px" }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Price (ETH)</label>
                <input type="number" step="0.001" value={form.price_eth} onChange={e => setForm(f => ({ ...f, price_eth: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Bonus Chance %</label>
                <input type="number" step="0.1" min={0} max={100} value={form.bonus_chance_pct} onChange={e => setForm(f => ({ ...f, bonus_chance_pct: e.target.value }))} placeholder="0" style={inputStyle} />
              </div>
            </div>
          </div>
          {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={createPack} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Creating…" : "Create Pack"}
            </button>
          </div>
        </Overlay>
      )}

      {/* Commit Seed Modal */}
      {showCommit && (
        <Overlay>
          <h2 className="text-base font-bold mb-1" style={{ color: "#24315f" }}>Commit Randomness Seed</h2>
          <p className="text-xs text-gray-400 mb-4">Enter your secret seed. Only the SHA256 hash is stored — the seed stays secret until reveal time.</p>
          <div>
            <label style={labelStyle}>Secret Seed</label>
            <input type="text" value={commitSeed} onChange={e => setCommitSeed(e.target.value)}
              placeholder="any secret string" style={inputStyle} />
            <p className="text-xs text-gray-400 mt-1">Keep this secret until all orders are placed. Never share before reveal.</p>
          </div>
          {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowCommit(null)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={commitSeedFn} disabled={saving || !commitSeed} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#d97706", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Committing…" : "Commit Hash"}
            </button>
          </div>
        </Overlay>
      )}

      {/* Reveal Modal */}
      {showReveal && (
        <Overlay>
          <h2 className="text-base font-bold mb-1" style={{ color: "#24315f" }}>Reveal Packs</h2>
          <p className="text-xs text-gray-400 mb-4">Enter the same seed you committed. We verify hash match, then assign NFTs to all orders.</p>
          <div>
            <label style={labelStyle}>Reveal Seed</label>
            <input type="text" value={revealSeed} onChange={e => setRevealSeed(e.target.value)}
              placeholder="the original secret seed" style={inputStyle} />
          </div>
          {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowReveal(null)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={revealPack} disabled={saving || !revealSeed} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#16a34a", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Revealing…" : "Reveal All Packs"}
            </button>
          </div>
        </Overlay>
      )}

      {/* New Order Modal */}
      {showNewOrder && (
        <Overlay>
          <h2 className="text-base font-bold mb-4" style={{ color: "#24315f" }}>Create Pack Order</h2>
          <div>
            <label style={labelStyle}>Buyer Wallet</label>
            <input type="text" value={orderWallet} onChange={e => setOrderWallet(e.target.value)} placeholder="0x..." style={inputStyle} />
          </div>
          {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowNewOrder(false)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={createOrder} disabled={saving || !orderWallet} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Creating…" : "Create Order"}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
