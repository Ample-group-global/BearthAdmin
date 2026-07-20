"use client";

import { useEffect, useState } from "react";

interface Collaboration {
  id: string;
  name: string;
  partner_name: string;
  partner_contract_address: string | null;
  wave_id: string | null;
  discount_pct: number;
  priority_hours: number;
  status: string;
  created_at: string;
  wallet_count?: number;
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

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  upcoming: { bg: "rgba(156,163,175,0.12)", color: "#9ca3af" },
  active:   { bg: "rgba(22,163,74,0.1)",    color: "#16a34a" },
  ended:    { bg: "rgba(65,175,235,0.12)",   color: "#41afeb" },
};

export default function CollaborationsPage() {
  const [collabs, setCollabs]   = useState<Collaboration[]>([]);
  const [selected, setSelected] = useState<Collaboration | null>(null);
  const [wallets, setWallets]   = useState<{ wallet_address: string; is_eligible: boolean }[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate]       = useState(false);
  const [showImport, setShowImport]       = useState(false);
  const [showMerkle, setShowMerkle]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const [ok, setOk]             = useState<string | null>(null);

  const emptyForm = { name: "", partner_name: "", partner_contract_address: "", discount_pct: "0", priority_hours: "24" };
  const [form, setForm] = useState(emptyForm);
  const [importText, setImportText] = useState("");
  const [merkleForm, setMerkleForm] = useState({ wave_number: "", include_holders: false });

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/nft-sell/collaborations", { credentials: "include" });
      const d = await r.json();
      setCollabs(d.collaborations ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function loadWallets(id: string) {
    const r = await fetch(`/api/nft-sell/collaborations/${id}/wallets`, { credentials: "include" });
    const d = await r.json();
    setWallets(d.wallets ?? []);
  }

  function selectCollab(c: Collaboration) {
    setSelected(c); loadWallets(c.id);
  }

  async function createCollab() {
    setSaving(true); setErr(null);
    try {
      const r = await fetch("/api/nft-sell/collaborations", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          partner_name: form.partner_name,
          partner_contract_address: form.partner_contract_address || undefined,
          discount_pct: parseFloat(form.discount_pct),
          priority_hours: parseInt(form.priority_hours),
        }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to create collaboration");
      setOk("Collaboration created"); setShowCreate(false); setForm(emptyForm); load();
    } finally { setSaving(false); }
  }

  async function importWallets() {
    if (!selected) return;
    const walletList = importText.split(/[,\n\s]+/).map(s => s.trim()).filter(s => s.startsWith("0x"));
    if (!walletList.length) { setErr("No valid wallet addresses found"); return; }

    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/nft-sell/collaborations/${selected.id}/wallets`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallets: walletList }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Import failed");
      setOk(`Imported ${d.imported} wallet(s)`); setShowImport(false); setImportText("");
      await loadWallets(selected.id);
    } finally { setSaving(false); }
  }

  async function generateMerkle() {
    if (!selected) return;
    if (!merkleForm.wave_number) { setErr("Wave number required"); return; }
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/nft-sell/collaborations/${selected.id}/generate-merkle`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wave_number: parseInt(merkleForm.wave_number),
          include_holders: merkleForm.include_holders,
        }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Merkle generation failed");
      setOk(`Wave ${d.wave_number} Merkle root set · ${d.address_count} addresses · Root: ${d.merkle_root?.slice(0, 20)}…${d.txHash ? ` · Tx: ${d.txHash.slice(0, 16)}…` : ""}`);
      setShowMerkle(false);
    } finally { setSaving(false); }
  }

  const stats = {
    total:    collabs.length,
    active:   collabs.filter(c => c.status === "active").length,
    wallets:  collabs.reduce((sum, c) => sum + (c.wallet_count ?? 0), 0),
  };

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
          <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>Cross-Project Collaborations</h1>
          <p className="text-sm text-gray-400 mt-0.5">Partner wallet allowlists with wave-scoped Merkle roots</p>
        </div>
        <button onClick={() => { setShowCreate(true); setForm(emptyForm); setErr(null); }}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#41afeb" }}>
          + New Collaboration
        </button>
      </div>

      {ok && <div className="px-3 py-2 rounded-lg text-xs text-green-700" style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.3)" }}>{ok}</div>}
      {err && <div className="px-3 py-2 rounded-lg text-xs text-red-600" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.3)" }}>{err}</div>}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total", value: stats.total, color: "#41afeb" },
          { label: "Active", value: stats.active, color: "#16a34a" },
          { label: "Partner Wallets", value: stats.wallets, color: "#7c3aed" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.label}</div>
            <div className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Collaborations list */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Collaborations</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {collabs.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">No collaborations yet</div>
              ) : collabs.map(c => (
                <div key={c.id} onClick={() => selectCollab(c)}
                  className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  style={selected?.id === c.id ? { background: "rgba(65,175,235,0.06)" } : {}}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm" style={{ color: "#24315f" }}>{c.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={(STATUS_COLOR[c.status] ?? STATUS_COLOR.upcoming)}>
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {c.partner_name} · {c.discount_pct}% off · {c.priority_hours}h priority · {c.wallet_count ?? 0} wallets
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Wallet management */}
        <div className="space-y-4">
          {selected ? (
            <>
              <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Partner Wallets ({wallets.length})</h2>
                  <div className="flex gap-2">
                    <button onClick={() => { setShowImport(true); setImportText(""); setErr(null); }}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#41afeb" }}>
                      Import
                    </button>
                    <button onClick={() => { setShowMerkle(true); setMerkleForm({ wave_number: "", include_holders: false }); setErr(null); }}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#7c3aed" }}>
                      Gen Merkle
                    </button>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {wallets.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-400">No wallets imported yet</div>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr>
                          {["Wallet", "Eligible"].map(h => (
                            <th key={h} style={{ ...thStyle, padding: "6px 10px" }} className="text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {wallets.map((w, i) => (
                          <tr key={i} className="border-b border-gray-50">
                            <td className="px-2 py-1.5 text-xs font-mono text-gray-600">{w.wallet_address.slice(0, 14)}…</td>
                            <td className="px-2 py-1.5">
                              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                                style={{ background: w.is_eligible ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.08)", color: w.is_eligible ? "#16a34a" : "#dc2626" }}>
                                {w.is_eligible ? "Yes" : "No"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400" style={{ border: "1px solid #e5e7eb" }}>
              Select a collaboration to manage wallets
            </div>
          )}
        </div>
      </div>

      {/* Collaborations table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>All Collaborations</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              {["Name", "Partner", "Discount", "Priority", "Wallets", "Status"].map(h => (
                <th key={h} style={thStyle} className="text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {collabs.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-6 text-sm text-gray-400">No collaborations</td></tr>
            ) : collabs.map(c => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="px-3 py-3 text-sm font-semibold" style={{ color: "#24315f" }}>{c.name}</td>
                <td className="px-3 py-3 text-sm text-gray-600">{c.partner_name}</td>
                <td className="px-3 py-3 text-sm font-semibold" style={{ color: "#16a34a" }}>{c.discount_pct}%</td>
                <td className="px-3 py-3 text-sm text-gray-600">{c.priority_hours}h</td>
                <td className="px-3 py-3 text-sm text-gray-600">{c.wallet_count ?? 0}</td>
                <td className="px-3 py-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={(STATUS_COLOR[c.status] ?? STATUS_COLOR.upcoming)}>
                    {c.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Collaboration Modal */}
      {showCreate && (
        <Overlay>
          <h2 className="text-base font-bold mb-4" style={{ color: "#24315f" }}>New Collaboration</h2>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Collaboration Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Alpha Community Drop" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Partner Name</label>
              <input type="text" value={form.partner_name} onChange={e => setForm(f => ({ ...f, partner_name: e.target.value }))} placeholder="Alpha Community" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Partner Contract Address (optional)</label>
              <input type="text" value={form.partner_contract_address} onChange={e => setForm(f => ({ ...f, partner_contract_address: e.target.value }))} placeholder="0x… (e.g. their NFT contract)" style={inputStyle} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Discount %</label>
                <input type="number" step="0.1" min={0} max={100} value={form.discount_pct} onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Priority Hours</label>
                <input type="number" min={1} value={form.priority_hours} onChange={e => setForm(f => ({ ...f, priority_hours: e.target.value }))} style={inputStyle} />
              </div>
            </div>
          </div>
          {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={createCollab} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </Overlay>
      )}

      {/* Import Wallets Modal */}
      {showImport && (
        <Overlay>
          <h2 className="text-base font-bold mb-1" style={{ color: "#24315f" }}>Import Partner Wallets</h2>
          <p className="text-xs text-gray-400 mb-4">Paste wallet addresses (comma, space, or newline separated)</p>
          <div>
            <label style={labelStyle}>Wallet Addresses</label>
            <textarea value={importText} onChange={e => setImportText(e.target.value)}
              rows={8} placeholder="0xAbc..., 0xDef..."
              style={{ ...inputStyle, resize: "vertical" }} />
            <p className="text-xs text-gray-400 mt-1">
              Preview: {importText.split(/[,\n\s]+/).filter(s => s.startsWith("0x")).length} valid addresses
            </p>
          </div>
          {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowImport(false)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={importWallets} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Importing…" : "Import Wallets"}
            </button>
          </div>
        </Overlay>
      )}

      {/* Generate Merkle Modal */}
      {showMerkle && (
        <Overlay>
          <h2 className="text-base font-bold mb-1" style={{ color: "#24315f" }}>Generate Wave Allowlist</h2>
          <p className="text-xs text-gray-400 mb-4">Builds Merkle tree from partner wallets, stores root in DB, and sets on-chain.</p>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Wave Number</label>
              <select value={merkleForm.wave_number} onChange={e => setMerkleForm(f => ({ ...f, wave_number: e.target.value }))} style={inputStyle}>
                <option value="">Select wave…</option>
                {[1,2,3,4,5,6,7].map(wn => <option key={wn} value={wn}>Wave {wn}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={merkleForm.include_holders}
                onChange={e => setMerkleForm(f => ({ ...f, include_holders: e.target.checked }))}
                className="w-4 h-4 rounded" />
              <span className="text-sm text-gray-600">Also include current NFT holders (holder priority merge)</span>
            </label>
          </div>
          {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowMerkle(false)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={generateMerkle} disabled={saving || !merkleForm.wave_number} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#7c3aed", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Generating…" : "Generate & Set On-Chain"}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
