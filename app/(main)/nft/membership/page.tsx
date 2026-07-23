"use client";

import { useEffect, useState } from "react";
import { ErrBanner } from "@/components/nft/ErrBanner";
import { OkBanner } from "@/components/nft/OkBanner";
import { labelStyle, inputStyle, thStyle } from "@/components/nft/styles";

interface MembershipTier {
  id: string;
  name: string;
  tier_level: number;
  qualifying_wave_number: number | null;
  qualifying_rarity_tier: string | null;
  min_tokens_held: number;
  discount_pct: number;
  benefits: unknown[] | null;
  priority_whitelist_slot: number | null;
  is_active: boolean;
  sort_order: number;
}

interface WalletMembership {
  tier_name: string | null;
  tier_level: number | null;
  discount_pct: number;
  tokens_held: number;
  benefits: unknown[] | null;
}

const RARITY_OPTIONS = ["", "legendary", "epic", "rare", "common"];

export default function MembershipPage() {
  const [tiers, setTiers]     = useState<MembershipTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing]       = useState<MembershipTier | null>(null);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState<string | null>(null);
  const [ok, setOk]           = useState<string | null>(null);

  const [verifyWallet, setVerifyWallet]     = useState("");
  const [verifying, setVerifying]           = useState(false);
  const [verifyResult, setVerifyResult]     = useState<WalletMembership | null>(null);
  const [verifyErr, setVerifyErr]           = useState<string | null>(null);

  const emptyForm = { name: "", tier_level: "1", qualifying_wave_number: "", qualifying_rarity_tier: "", min_tokens_held: "1", discount_pct: "0", benefits: "", sort_order: "0" };
  const [form, setForm] = useState(emptyForm);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/nft-sell/membership", { credentials: "include" });
      const d = await r.json();
      setTiers(d.tiers ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(emptyForm); setEditing(null); setErr(null); setShowCreate(true);
  }
  function openEdit(t: MembershipTier) {
    setForm({
      name: t.name, tier_level: String(t.tier_level),
      qualifying_wave_number: String(t.qualifying_wave_number ?? ""),
      qualifying_rarity_tier: t.qualifying_rarity_tier ?? "",
      min_tokens_held: String(t.min_tokens_held),
      discount_pct: String(t.discount_pct),
      benefits: t.benefits ? JSON.stringify(t.benefits) : "",
      sort_order: String(t.sort_order),
    });
    setEditing(t); setErr(null); setShowCreate(true);
  }

  async function save() {
    setSaving(true); setErr(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        tier_level: parseInt(form.tier_level),
        min_tokens_held: parseInt(form.min_tokens_held),
        discount_pct: parseFloat(form.discount_pct),
        sort_order: parseInt(form.sort_order),
      };
      if (form.qualifying_wave_number) body.qualifying_wave_number = parseInt(form.qualifying_wave_number);
      if (form.qualifying_rarity_tier) body.qualifying_rarity_tier = form.qualifying_rarity_tier;
      if (form.benefits) {
        try { body.benefits = JSON.parse(form.benefits); } catch { body.benefits = [form.benefits]; }
      }

      const url  = editing ? `/api/nft-sell/membership/${editing.id}` : "/api/nft-sell/membership";
      const meth = editing ? "PUT" : "POST";
      const r    = await fetch(url, { method: meth, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d    = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to save");
      setOk(editing ? "Tier updated" : "Tier created"); setShowCreate(false);
      load();
    } finally { setSaving(false); }
  }

  async function deactivate(id: string) {
    if (!confirm("Deactivate this tier?")) return;
    await fetch(`/api/nft-sell/membership/${id}`, { method: "DELETE", credentials: "include" });
    load();
  }

  async function verify() {
    setVerifying(true); setVerifyResult(null); setVerifyErr(null);
    try {
      const r = await fetch(`/api/nft-sell/membership/verify?wallet=${encodeURIComponent(verifyWallet)}`, { credentials: "include" });
      const d = await r.json();
      if (!r.ok) return setVerifyErr(d.error ?? "Verification failed");
      setVerifyResult(d.membership);
    } finally { setVerifying(false); }
  }

  const Overlay = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>Membership Tiers</h1>
          <p className="text-sm text-gray-400 mt-0.5">NFT holder membership + token-gated discounts</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#41afeb" }}>
          + New Tier
        </button>
      </div>

      {ok  && <OkBanner  msg={ok}  onDismiss={() => setOk(null)} />}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Total Tiers", value: tiers.length, color: "#41afeb" },
          { label: "Active", value: tiers.filter(t => t.is_active).length, color: "#16a34a" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{s.label}</div>
            <div className="text-2xl font-bold mt-1" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Wallet Verify */}
      <div className="bg-white rounded-2xl shadow-sm p-5" style={{ border: "1px solid #e5e7eb" }}>
        <h2 className="text-sm font-bold mb-3" style={{ color: "#24315f" }}>Wallet Membership Lookup</h2>
        <div className="flex gap-3">
          <input type="text" value={verifyWallet} onChange={e => setVerifyWallet(e.target.value)}
            placeholder="0x wallet address" style={{ ...inputStyle, flex: 1 }} />
          <button onClick={verify} disabled={verifying || !verifyWallet}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#7c3aed", opacity: verifying ? 0.6 : 1, whiteSpace: "nowrap" }}>
            {verifying ? "Checking…" : "Verify"}
          </button>
        </div>
        {verifyErr && <div className="mt-2 text-xs text-red-600">{verifyErr}</div>}
        {verifyResult && (
          <div className="mt-3 p-3 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
            {verifyResult.tier_name ? (
              <>
                <div className="font-semibold text-sm" style={{ color: "#24315f" }}>{verifyResult.tier_name} (Level {verifyResult.tier_level})</div>
                <div className="text-xs text-gray-500 mt-1">Tokens held: {verifyResult.tokens_held} · Discount: {verifyResult.discount_pct}%</div>
                {verifyResult.benefits && <div className="text-xs text-gray-400 mt-1">Benefits: {JSON.stringify(verifyResult.benefits)}</div>}
              </>
            ) : (
              <div className="text-sm text-gray-500">No membership tier — holds {verifyResult.tokens_held} token(s)</div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {["Name", "Level", "Qualifying Conditions", "Discount", "Active", "Actions"].map(h => (
                  <th key={h} style={thStyle} className="text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tiers.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-sm text-gray-400">No membership tiers yet</td></tr>
              ) : tiers.map(t => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-3 py-3 text-sm font-semibold" style={{ color: "#24315f" }}>{t.name}</td>
                  <td className="px-3 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}>
                      L{t.tier_level}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {[
                      t.qualifying_wave_number ? `Wave ${t.qualifying_wave_number}` : null,
                      t.qualifying_rarity_tier ? t.qualifying_rarity_tier : null,
                      `≥${t.min_tokens_held} token(s)`,
                    ].filter(Boolean).join(" · ")}
                  </td>
                  <td className="px-3 py-3 text-sm font-semibold" style={{ color: "#16a34a" }}>{t.discount_pct}%</td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${t.is_active ? "text-green-700" : "text-gray-400"}`}
                      style={{ background: t.is_active ? "rgba(22,163,74,0.1)" : "rgba(156,163,175,0.12)" }}>
                      {t.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(t)} className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: "rgba(65,175,235,0.12)", color: "#41afeb" }}>Edit</button>
                      {t.is_active && (
                        <button onClick={() => deactivate(t.id)} className="text-xs px-2 py-1 rounded-lg font-medium" style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}>Deactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreate && (
        <Overlay>
          <h2 className="text-base font-bold mb-4" style={{ color: "#24315f" }}>{editing ? "Edit Tier" : "New Membership Tier"}</h2>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Tier Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Gold, Silver, Bronze…" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Tier Level</label>
              <select value={form.tier_level} onChange={e => setForm(f => ({ ...f, tier_level: e.target.value }))} style={inputStyle}>
                <option value="1">1 — Bronze</option>
                <option value="2">2 — Silver</option>
                <option value="3">3 — Gold</option>
                <option value="4">4 — Platinum</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Qualifying Wave # (optional)</label>
                <input type="number" min={1} max={7} value={form.qualifying_wave_number}
                  onChange={e => setForm(f => ({ ...f, qualifying_wave_number: e.target.value }))}
                  placeholder="any" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Qualifying Rarity (optional)</label>
                <select value={form.qualifying_rarity_tier}
                  onChange={e => setForm(f => ({ ...f, qualifying_rarity_tier: e.target.value }))}
                  style={inputStyle}>
                  {RARITY_OPTIONS.map(r => <option key={r} value={r}>{r || "Any"}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Min Tokens Held</label>
                <input type="number" min={1} value={form.min_tokens_held}
                  onChange={e => setForm(f => ({ ...f, min_tokens_held: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Discount %</label>
                <input type="number" min={0} max={100} step={0.1} value={form.discount_pct}
                  onChange={e => setForm(f => ({ ...f, discount_pct: e.target.value }))} style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Benefits (JSON array or text)</label>
              <textarea value={form.benefits} onChange={e => setForm(f => ({ ...f, benefits: e.target.value }))}
                rows={2} placeholder='["20% off products", "Early wave access"]'
                style={{ ...inputStyle, resize: "vertical" }} />
            </div>
          </div>
          {err && <ErrBanner msg={err} onDismiss={() => setErr(null)} />}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={save} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
