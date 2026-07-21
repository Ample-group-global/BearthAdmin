"use client";

import { useEffect, useState } from "react";
import { ErrBanner } from "@/components/nft/ErrBanner";
import { OkBanner } from "@/components/nft/OkBanner";
import { labelStyle, inputStyle, thStyle } from "@/components/nft/styles";

interface Season {
  id: string;
  name: string;
  code: string;
  wave_numbers: number[];
  price_eth: number;
  price_twd: number | null;
  discount_pct: number | null;
  status: string;
  sale_start: string | null;
  sale_end: string | null;
  created_at: string;
}

interface PassHolder {
  id: string;
  wallet_address: string;
  pass_serial: string;
  nft_token_id: number | null;
  amount_paid_eth: number | null;
  amount_paid_twd: number | null;
  redeemed_wave_numbers: number[];
  created_at: string;
}

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  upcoming: { bg: "rgba(156,163,175,0.12)", color: "#9ca3af" },
  active:   { bg: "rgba(65,175,235,0.12)",  color: "#41afeb" },
  ended:    { bg: "rgba(22,163,74,0.1)",    color: "#16a34a" },
};

export default function SeasonsPage() {
  const [seasons, setSeasons]     = useState<Season[]>([]);
  const [selected, setSelected]   = useState<Season | null>(null);
  const [passes, setPasses]       = useState<PassHolder[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showIssue, setShowIssue]   = useState(false);
  const [showRedeem, setShowRedeem] = useState<PassHolder | null>(null);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState<string | null>(null);
  const [ok, setOk]               = useState<string | null>(null);

  const emptyForm = { name: "", code: "", wave_numbers: [] as number[], price_eth: "", price_twd: "", discount_pct: "", sale_start: "", sale_end: "" };
  const [form, setForm] = useState(emptyForm);
  const [issueForm, setIssueForm] = useState({ customer_id: "", wallet_address: "", amount_paid_eth: "", amount_paid_twd: "" });
  const [redeemWave, setRedeemWave] = useState("");

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/nft-sell/seasons", { credentials: "include" });
      const d = await r.json();
      setSeasons(d.seasons ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function loadPasses(seasonId: string) {
    const r = await fetch(`/api/nft-sell/seasons/${seasonId}/passes`, { credentials: "include" });
    const d = await r.json();
    setPasses(d.passes ?? []);
  }

  function selectSeason(s: Season) {
    setSelected(s); loadPasses(s.id);
  }

  function toggleWave(wn: number) {
    setForm(f => ({
      ...f,
      wave_numbers: f.wave_numbers.includes(wn)
        ? f.wave_numbers.filter(w => w !== wn)
        : [...f.wave_numbers, wn].sort(),
    }));
  }

  async function createSeason() {
    setSaving(true); setErr(null);
    try {
      const r = await fetch("/api/nft-sell/seasons", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, code: form.code,
          wave_numbers: form.wave_numbers,
          price_eth: parseFloat(form.price_eth),
          price_twd: form.price_twd ? parseFloat(form.price_twd) : undefined,
          discount_pct: form.discount_pct ? parseFloat(form.discount_pct) : undefined,
          sale_start: form.sale_start || undefined,
          sale_end:   form.sale_end || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to create season");
      setOk("Season created"); setShowCreate(false); load();
    } finally { setSaving(false); }
  }

  async function issuePass() {
    if (!selected) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/nft-sell/seasons/${selected.id}/passes`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: issueForm.customer_id,
          wallet_address: issueForm.wallet_address,
          amount_paid_eth: issueForm.amount_paid_eth ? parseFloat(issueForm.amount_paid_eth) : undefined,
          amount_paid_twd: issueForm.amount_paid_twd ? parseFloat(issueForm.amount_paid_twd) : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to issue pass");
      setOk(`Pass ${d.pass?.pass_serial ?? ""} issued${d.pass?.mint_tx_hash ? " · Tx: " + d.pass.mint_tx_hash.slice(0, 18) + "…" : ""}`);
      setShowIssue(false); setIssueForm({ customer_id: "", wallet_address: "", amount_paid_eth: "", amount_paid_twd: "" });
      await loadPasses(selected.id);
    } finally { setSaving(false); }
  }

  async function redeemWaveForPass() {
    if (!showRedeem) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/nft-sell/seasons/${selected!.id}/passes/${showRedeem.id}/redeem`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wave_number: parseInt(redeemWave) }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to redeem");
      setOk(`Wave ${redeemWave} redeemed for pass ${showRedeem.pass_serial}`);
      setShowRedeem(null); setRedeemWave("");
      await loadPasses(selected!.id);
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
          <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>Season Passes</h1>
          <p className="text-sm text-gray-400 mt-0.5">Multi-wave subscription passes with on-chain NFT (VeeFriends model)</p>
        </div>
        <button onClick={() => { setShowCreate(true); setForm(emptyForm); setErr(null); }}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#41afeb" }}>
          + New Season
        </button>
      </div>

      {ok  && <OkBanner  msg={ok}  onDismiss={() => setOk(null)} />}
      {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Seasons list */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Seasons</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {seasons.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">No seasons yet</div>
              ) : seasons.map(s => (
                <div key={s.id} onClick={() => selectSeason(s)}
                  className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  style={selected?.id === s.id ? { background: "rgba(65,175,235,0.06)" } : {}}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm" style={{ color: "#24315f" }}>{s.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={(STATUS_COLOR[s.status] ?? STATUS_COLOR.upcoming)}>
                      {s.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Waves {s.wave_numbers.join(", ")} · {s.price_eth} ETH
                    {s.price_twd ? ` / NT$${s.price_twd}` : ""}
                    {s.discount_pct ? ` · ${s.discount_pct}% off` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pass holders */}
        <div className="space-y-4">
          {selected ? (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Pass Holders — {selected.name}</h2>
                <button onClick={() => { setShowIssue(true); setErr(null); }}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#41afeb" }}>
                  Issue Pass
                </button>
              </div>
              <table className="w-full">
                <thead>
                  <tr>
                    {["Serial", "Wallet", "Token ID", "Redeemed", ""].map(h => (
                      <th key={h} style={{ ...thStyle, padding: "8px 10px" }} className="text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {passes.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-6 text-xs text-gray-400">No passes issued</td></tr>
                  ) : passes.map(p => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-2 py-2 text-xs font-mono font-semibold text-gray-700">{p.pass_serial}</td>
                      <td className="px-2 py-2 text-xs font-mono text-gray-500">{p.wallet_address.slice(0, 10)}…</td>
                      <td className="px-2 py-2 text-xs text-gray-500">{p.nft_token_id ?? "—"}</td>
                      <td className="px-2 py-2 text-xs text-gray-500">
                        {p.redeemed_wave_numbers.length > 0 ? `Waves ${p.redeemed_wave_numbers.join(", ")}` : "None"}
                      </td>
                      <td className="px-2 py-2">
                        <button onClick={() => { setShowRedeem(p); setRedeemWave(""); setErr(null); }}
                          className="text-xs px-2 py-1 rounded-lg font-medium"
                          style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
                          Redeem
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400" style={{ border: "1px solid #e5e7eb" }}>
              Select a season to view pass holders
            </div>
          )}
        </div>
      </div>

      {/* Create Season Modal */}
      {showCreate && (
        <Overlay>
          <h2 className="text-base font-bold mb-4" style={{ color: "#24315f" }}>New Season</h2>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Season Name</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Season 1" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Code</label>
                <input type="text" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="season_1" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Waves Included</label>
              <div className="flex gap-2 flex-wrap mt-1">
                {[1,2,3,4,5,6,7].map(wn => (
                  <button key={wn} onClick={() => toggleWave(wn)}
                    className="px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors"
                    style={form.wave_numbers.includes(wn)
                      ? { background: "#41afeb", color: "#fff", borderColor: "#41afeb" }
                      : { background: "#fff", color: "#9ca3af", borderColor: "#e5e7eb" }}>
                    W{wn}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Price (ETH)</label>
                <input type="number" step="0.001" value={form.price_eth} onChange={e => setForm(f => ({ ...f, price_eth: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Price (TWD, optional)</label>
                <input type="number" value={form.price_twd} onChange={e => setForm(f => ({ ...f, price_twd: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Bundle Discount %</label>
              <input type="number" step="0.1" value={form.discount_pct} onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value }))} style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Sale Start</label>
                <input type="datetime-local" value={form.sale_start} onChange={e => setForm(f => ({ ...f, sale_start: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Sale End</label>
                <input type="datetime-local" value={form.sale_end} onChange={e => setForm(f => ({ ...f, sale_end: e.target.value }))} style={inputStyle} />
              </div>
            </div>
          </div>
          {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={createSeason} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Creating…" : "Create Season"}
            </button>
          </div>
        </Overlay>
      )}

      {/* Issue Pass Modal */}
      {showIssue && (
        <Overlay>
          <h2 className="text-base font-bold mb-1" style={{ color: "#24315f" }}>Issue Season Pass</h2>
          <p className="text-xs text-gray-400 mb-4">Mints an on-chain NFT pass and records in DB.</p>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Customer ID (UUID)</label>
              <input type="text" value={issueForm.customer_id} onChange={e => setIssueForm(f => ({ ...f, customer_id: e.target.value }))} placeholder="customer uuid" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Wallet Address</label>
              <input type="text" value={issueForm.wallet_address} onChange={e => setIssueForm(f => ({ ...f, wallet_address: e.target.value }))} placeholder="0x..." style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Amount Paid (ETH)</label>
                <input type="number" step="0.001" value={issueForm.amount_paid_eth} onChange={e => setIssueForm(f => ({ ...f, amount_paid_eth: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Amount Paid (TWD)</label>
                <input type="number" value={issueForm.amount_paid_twd} onChange={e => setIssueForm(f => ({ ...f, amount_paid_twd: e.target.value }))} style={inputStyle} />
              </div>
            </div>
          </div>
          {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowIssue(false)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={issuePass} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Minting & Issuing…" : "Issue Pass"}
            </button>
          </div>
        </Overlay>
      )}

      {/* Redeem Modal */}
      {showRedeem && (
        <Overlay>
          <h2 className="text-base font-bold mb-1" style={{ color: "#24315f" }}>Redeem Wave</h2>
          <p className="text-xs text-gray-400 mb-4">Pass: {showRedeem.pass_serial} · Already redeemed: {showRedeem.redeemed_wave_numbers.join(", ") || "none"}</p>
          <div>
            <label style={labelStyle}>Wave Number</label>
            <select value={redeemWave} onChange={e => setRedeemWave(e.target.value)} style={inputStyle}>
              <option value="">Select wave…</option>
              {selected?.wave_numbers.filter(wn => !showRedeem.redeemed_wave_numbers.includes(wn)).map(wn => (
                <option key={wn} value={wn}>Wave {wn}</option>
              ))}
            </select>
          </div>
          {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowRedeem(null)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={redeemWaveForPass} disabled={saving || !redeemWave} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#16a34a", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Redeeming…" : "Redeem Wave"}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
