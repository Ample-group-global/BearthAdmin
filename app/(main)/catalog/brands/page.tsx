"use client";

import { useEffect, useState, useCallback } from "react";

interface Brand {
  id: string;
  code: string;
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  isActive: boolean;
  productCount?: number;
  collectionCount?: number;
}

interface BrandForm {
  name: string; code: string; slug: string;
  description: string; logoUrl: string; websiteUrl: string; isActive: boolean;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl flex flex-col" style={{ width: "100%", maxWidth: 540, maxHeight: "90vh", border: "1px solid #e5e7eb" }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>{title}</h2>
          <button onClick={onClose} style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "13px", color: "#111827", outline: "none" };
const labelStyle: React.CSSProperties = { display: "block", fontSize: "11px", fontWeight: 700, color: "#9bafc5", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" };

const EMPTY_FORM: BrandForm = { name: "", code: "", slug: "", description: "", logoUrl: "", websiteUrl: "", isActive: true };

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function codeify(s: string) { return s.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 20); }

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [form, setForm] = useState<BrandForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((q = search) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "50", offset: "0" });
    if (q) params.set("search", q);
    fetch(`/api/catalog/brands?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setBrands(d.brands ?? []); setTotal(d.total ?? 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setError(null); setModal("create"); };
  const openEdit = (b: Brand) => {
    setEditing(b);
    setForm({ name: b.name, code: b.code, slug: b.slug ?? "", description: b.description ?? "", logoUrl: b.logoUrl ?? "", websiteUrl: b.websiteUrl ?? "", isActive: b.isActive });
    setError(null); setModal("edit");
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) { setError("Name and code are required."); return; }
    setSaving(true); setError(null);
    try {
      const url  = modal === "edit" ? `/api/catalog/brands/${editing!.id}` : "/api/catalog/brands";
      const method = modal === "edit" ? "PUT" : "POST";
      const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Save failed."); return; }
      setModal(null); load();
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  };

  const f = (field: keyof BrandForm, value: string | boolean) => {
    const next = { ...form, [field]: value };
    if (field === "name" && modal === "create") {
      next.slug = slugify(value as string);
      next.code = codeify(value as string);
    }
    setForm(next);
  };

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>Brands</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{total} brand{total !== 1 ? "s" : ""} · product branding and identity</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white rounded-xl" style={{ background: "#41afeb" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Brand
        </button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && load(search)}
          placeholder="Search brands…" className="px-3 py-2 text-sm rounded-xl outline-none"
          style={{ border: "1px solid #e5e7eb", minWidth: 220, color: "#111827" }} />
        <button onClick={() => load(search)} className="px-3 py-2 text-sm font-semibold rounded-xl bg-white" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Search</button>
        {search && <button onClick={() => { setSearch(""); load(""); }} className="px-3 py-2 text-xs rounded-xl bg-white" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Clear</button>}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40" style={{ color: "#9bafc5" }}>
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          Loading…
        </div>
      ) : brands.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center" style={{ border: "1px solid #e5e7eb" }}>
          <p className="text-sm font-medium" style={{ color: "#9bafc5" }}>No brands yet. Create your first brand.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                {["Brand", "Code", "Products", "Collections", "Status", "Actions"].map(h => (
                  <th key={h} style={{ fontSize: 11, fontWeight: 700, color: "#9bafc5", textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 14px", textAlign: "left", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {brands.map((b, i) => (
                <tr key={b.id} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <div className="font-semibold" style={{ color: "#111827" }}>{b.name}</div>
                    <div className="text-xs" style={{ color: "#9bafc5" }}>{b.slug}</div>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "rgba(65,175,235,0.08)", color: "#41afeb" }}>{b.code}</span>
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>{b.productCount ?? 0}</td>
                  <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>{b.collectionCount ?? 0}</td>
                  <td style={{ padding: "10px 14px" }}>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: b.isActive ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.08)", color: b.isActive ? "#16a34a" : "#dc2626" }}>
                      {b.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <button onClick={() => openEdit(b)} className="px-2 py-1 rounded text-xs font-semibold" style={{ border: "1px solid #41afeb", color: "#41afeb", background: "#fff" }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={modal === "create" ? "New Brand" : `Edit — ${editing?.name}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            {error && <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label style={labelStyle}>Brand Name *</label>
                <input value={form.name} onChange={e => f("name", e.target.value)} style={inputStyle} placeholder="e.g. Bearth" />
              </div>
              <div>
                <label style={labelStyle}>Code *</label>
                <input value={form.code} onChange={e => f("code", e.target.value.toUpperCase())} style={inputStyle} placeholder="BRTH" />
              </div>
              <div>
                <label style={labelStyle}>Slug</label>
                <input value={form.slug} onChange={e => f("slug", e.target.value)} style={inputStyle} placeholder="bearth" />
              </div>
              <div className="col-span-2">
                <label style={labelStyle}>Description</label>
                <textarea value={form.description} onChange={e => f("description", e.target.value)} style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="Brand description…" />
              </div>
              <div>
                <label style={labelStyle}>Logo URL</label>
                <input value={form.logoUrl} onChange={e => f("logoUrl", e.target.value)} style={inputStyle} placeholder="https://…" />
              </div>
              <div>
                <label style={labelStyle}>Website URL</label>
                <input value={form.websiteUrl} onChange={e => f("websiteUrl", e.target.value)} style={inputStyle} placeholder="https://…" />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" checked={form.isActive} onChange={e => f("isActive", e.target.checked)} id="brand-active" />
                <label htmlFor="brand-active" className="text-sm" style={{ color: "#374151" }}>Active</label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => setModal(null)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-bold text-white rounded-lg" style={{ background: saving ? "#9bafc5" : "#41afeb" }}>{saving ? "Saving…" : "Save Brand"}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
