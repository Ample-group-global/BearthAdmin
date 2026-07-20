"use client";

import { useEffect, useState, useCallback } from "react";

interface Brand { id: string; name: string; code: string; }
interface Collection {
  id: string; code: string; name: string; slug: string;
  brandId?: string | null; brandName?: string | null;
  theme?: string | null; season?: string | null; year?: number | null;
  launchDate?: string | null; coverImageUrl?: string | null;
  isActive: boolean; isFeatured: boolean; productCount?: number;
}
interface CollForm {
  brandId: string; name: string; code: string; slug: string;
  description: string; theme: string; season: string; year: string;
  launchDate: string; coverUrl: string; isActive: boolean; isFeatured: boolean;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl flex flex-col" style={{ width: "100%", maxWidth: 600, maxHeight: "90vh", border: "1px solid #e5e7eb" }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>{title}</h2>
          <button onClick={onClose} style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", color: "#111827", outline: "none" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: "11px", fontWeight: 700, color: "#9bafc5", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" };
const EMPTY: CollForm = { brandId: "", name: "", code: "", slug: "", description: "", theme: "", season: "", year: "", launchDate: "", coverUrl: "", isActive: true, isFeatured: false };

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function codeify(s: string) { return s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 20); }

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterBrand, setFilterBrand] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [form, setForm] = useState<CollForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((bId = filterBrand, q = search) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50", offset: "0" });
    if (bId) params.set("brandId", bId);
    if (q)   params.set("search", q);
    fetch(`/api/catalog/collections?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setCollections(d.collections ?? []); setTotal(d.total ?? 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filterBrand, search]);

  useEffect(() => {
    load();
    fetch("/api/catalog/brands?limit=100", { credentials: "include" })
      .then(r => r.json()).then(d => setBrands(d.brands ?? []));
  }, []);

  const openCreate = () => { setEditing(null); setForm({ ...EMPTY, brandId: brands[0]?.id ?? "" }); setError(null); setModal("create"); };
  const openEdit = (c: Collection) => {
    setEditing(c);
    setForm({ brandId: c.brandId ?? "", name: c.name, code: c.code, slug: c.slug ?? "", description: "", theme: c.theme ?? "", season: c.season ?? "", year: c.year ? String(c.year) : "", launchDate: c.launchDate ? c.launchDate.slice(0, 10) : "", coverUrl: c.coverImageUrl ?? "", isActive: c.isActive, isFeatured: c.isFeatured });
    setError(null); setModal("edit");
  };

  const f = (field: keyof CollForm, val: string | boolean) => {
    const next = { ...form, [field]: val };
    if (field === "name" && modal === "create") { next.slug = slugify(val as string); next.code = codeify(val as string); }
    setForm(next);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { setError("Name and code are required."); return; }
    setSaving(true); setError(null);
    try {
      const url = modal === "edit" ? `/api/catalog/collections/${editing!.id}` : "/api/catalog/collections";
      const body = { ...form, year: form.year ? Number(form.year) : null, launchDate: form.launchDate || null, coverUrl: form.coverUrl || null, brandId: form.brandId || null };
      const res = await fetch(url, { method: modal === "edit" ? "PUT" : "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Save failed."); return; }
      setModal(null); load();
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>Collections</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{total} collection{total !== 1 ? "s" : ""} · product groupings by theme or season</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white rounded-xl" style={{ background: "#41afeb" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Collection
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <select value={filterBrand} onChange={e => { setFilterBrand(e.target.value); load(e.target.value, search); }}
          className="py-2 px-3 rounded-xl text-sm bg-white outline-none" style={{ border: "1px solid #e5e7eb", color: filterBrand ? "#111827" : "#9bafc5" }}>
          <option value="">All Brands</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load(filterBrand, search)}
          placeholder="Search collections…" className="px-3 py-2 text-sm rounded-xl outline-none"
          style={{ border: "1px solid #e5e7eb", minWidth: 200, color: "#111827" }} />
        {(filterBrand || search) && <button onClick={() => { setFilterBrand(""); setSearch(""); load("", ""); }} className="px-3 py-2 text-xs rounded-xl bg-white" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Clear</button>}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40" style={{ color: "#9bafc5" }}>
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Loading…
        </div>
      ) : collections.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center" style={{ border: "1px solid #e5e7eb" }}>
          <p className="text-sm font-medium" style={{ color: "#9bafc5" }}>No collections yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Collection", "Code", "Brand", "Season/Year", "Products", "Featured", "Status", ""].map(h => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9bafc5", textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 14px", textAlign: "left", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {collections.map((c, i) => (
                <tr key={c.id} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="font-semibold" style={{ color: "#111827" }}>{c.name}</div>
                    {c.theme && <div className="text-xs" style={{ color: "#9bafc5" }}>{c.theme}</div>}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "rgba(65,175,235,0.08)", color: "#41afeb" }}>{c.code}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>{c.brandName ?? "—"}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>
                    {[c.season, c.year].filter(Boolean).join(" ") || "—"}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>{c.productCount ?? 0}</td>
                  <td style={{ padding: "10px 14px" }}>
                    {c.isFeatured && <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "rgba(217,119,6,0.1)", color: "#d97706" }}>Featured</span>}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: c.isActive ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.08)", color: c.isActive ? "#16a34a" : "#dc2626" }}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <button onClick={() => openEdit(c)} className="px-2 py-1 rounded text-xs font-semibold" style={{ border: "1px solid #41afeb", color: "#41afeb", background: "#fff" }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={modal === "create" ? "New Collection" : `Edit — ${editing?.name}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label style={labelStyle}>Collection Name *</label>
                <input value={form.name} onChange={e => f("name", e.target.value)} style={inputStyle} placeholder="e.g. Genesis Collection" />
              </div>
              <div>
                <label style={labelStyle}>Code *</label>
                <input value={form.code} onChange={e => f("code", e.target.value.toUpperCase())} style={inputStyle} placeholder="GENESIS" />
              </div>
              <div>
                <label style={labelStyle}>Slug</label>
                <input value={form.slug} onChange={e => f("slug", e.target.value)} style={inputStyle} placeholder="genesis-collection" />
              </div>
              <div className="col-span-2">
                <label style={labelStyle}>Brand</label>
                <select value={form.brandId} onChange={e => f("brandId", e.target.value)} style={inputStyle}>
                  <option value="">No brand</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Theme</label>
                <input value={form.theme} onChange={e => f("theme", e.target.value)} style={inputStyle} placeholder="Nature, Urban, Minimal…" />
              </div>
              <div>
                <label style={labelStyle}>Season</label>
                <select value={form.season} onChange={e => f("season", e.target.value)} style={inputStyle}>
                  <option value="">None</option>
                  {["Spring","Summer","Autumn","Winter","Year-Round"].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Year</label>
                <input value={form.year} onChange={e => f("year", e.target.value)} type="number" min="2020" max="2030" style={inputStyle} placeholder="2026" />
              </div>
              <div>
                <label style={labelStyle}>Launch Date</label>
                <input value={form.launchDate} onChange={e => f("launchDate", e.target.value)} type="date" style={inputStyle} />
              </div>
              <div className="col-span-2">
                <label style={labelStyle}>Cover Image URL</label>
                <input value={form.coverUrl} onChange={e => f("coverUrl", e.target.value)} style={inputStyle} placeholder="https://…" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.isActive} onChange={e => f("isActive", e.target.checked)} id="coll-active" />
                <label htmlFor="coll-active" className="text-sm" style={{ color: "#374151" }}>Active</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" checked={form.isFeatured} onChange={e => f("isFeatured", e.target.checked)} id="coll-featured" />
                <label htmlFor="coll-featured" className="text-sm" style={{ color: "#374151" }}>Featured</label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-bold text-white rounded-lg" style={{ background: saving ? "#9bafc5" : "#41afeb" }}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
