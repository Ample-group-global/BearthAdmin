"use client";

import { useEffect, useState, useRef } from "react";

interface Product {
  id: number;
  name: string;
  retailPrice: number;
  presalePrice: number;
  statusCode: string;
  statusName: string;
  stockQty: number;
  totalCount: number;
}

interface Master {
  productStatuses: Array<{ id: number; name: string; code: string }>;
}

const PAGE_SIZE = 100;

function statusBadge(code: string, name: string) {
  const active = (code ?? "").toLowerCase() === "active";
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={active
        ? { background: "rgba(22,163,74,0.1)", color: "#16a34a" }
        : { background: "rgba(156,163,175,0.1)", color: "#9ca3af" }}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: active ? "#16a34a" : "#9ca3af" }} />
      {name}
    </span>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [master, setMaster] = useState<Master | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    name: "",
    retailPrice: "",
    presalePrice: "",
    statusId: "",
    description: "",
    stockQty: "",
  });

  const loadProducts = (q: string, off: number) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ search: q, limit: String(PAGE_SIZE), offset: String(off) });
    fetch(`/api/presale/products?${params}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const rows: Product[] = data.products ?? [];
        setProducts(rows);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load products.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetch("/api/presale/master", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setMaster(d));
  }, []);

  useEffect(() => {
    loadProducts(search, offset);
  }, [offset]);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setOffset(0);
      loadProducts(v, 0);
    }, 300);
  };

  const openCreate = () => {
    setEditProduct(null);
    setForm({ name: "", retailPrice: "", presalePrice: "", statusId: "", description: "", stockQty: "0" });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    const statusId = master?.productStatuses.find((s) => s.code === p.statusCode)?.id ?? "";
    setForm({
      name: p.name ?? "",
      retailPrice: String(p.retailPrice ?? ""),
      presalePrice: String(p.presalePrice ?? ""),
      statusId: String(statusId),
      description: "",
      stockQty: String(p.stockQty ?? ""),
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setFormError(null);
    try {
      const body: any = {
        name: form.name,
        retailPrice: form.retailPrice ? Number(form.retailPrice) : undefined,
        presalePrice: form.presalePrice ? Number(form.presalePrice) : undefined,
        stockQty: form.stockQty ? Number(form.stockQty) : undefined,
        description: form.description || undefined,
      };
      if (form.statusId) body.statusId = Number(form.statusId);

      const url = editProduct ? `/api/presale/products/${editProduct.id}` : "/api/presale/products";
      const method = editProduct ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setFormError(d.error ?? "Save failed.");
        return;
      }
      setShowModal(false);
      loadProducts(search, offset);
    } catch {
      setFormError("Network error.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      const res = await fetch(`/api/presale/products/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Deactivate failed.");
        return;
      }
      setDeleteId(null);
      loadProducts(search, offset);
    } catch {
      setError("Network error.");
    }
  };

  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "14px",
    color: "#111827",
    outline: "none",
  };
  const labelStyle = { display: "block", fontSize: "12px", fontWeight: 600, color: "#24315f", marginBottom: "4px" };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold" style={{ color: "#24315f" }}>Products</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Manage Bearth merchandise products</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
          style={{ background: "#41afeb" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#2e9fd8")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#41afeb")}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Product
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#111827" }}
          />
        </div>
        <span className="text-sm" style={{ color: "#9bafc5" }}>
          {total > 0 ? `${offset + 1}–${Math.min(offset + PAGE_SIZE, total)} of ${total}` : "0 results"}
        </span>
      </div>

      {error && (
        <div className="p-3 rounded-xl text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div className="flex items-center justify-center h-48" style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </div>
        ) : products.length === 0 ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm" style={{ color: "#9bafc5" }}>No products found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-max [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap [&_th]:border-r [&_th]:border-gray-100 [&_td]:border-r [&_td]:border-gray-100 [&_th]:py-2 [&_th]:px-3 [&_td]:py-2 [&_td]:px-3">
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Name</th>
                  <th className="px-4 py-3 text-right font-semibold" style={{ color: "#9bafc5" }}>Retail Price</th>
                  <th className="px-4 py-3 text-right font-semibold" style={{ color: "#9bafc5" }}>Bearth Price</th>
                  <th className="px-4 py-3 text-center font-semibold" style={{ color: "#9bafc5" }}>Stock</th>
                  <th className="px-4 py-3 text-left font-semibold" style={{ color: "#9bafc5" }}>Status</th>
                  <th className="px-4 py-3 text-center font-semibold" style={{ color: "#9bafc5" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: i < products.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: "#111827" }}>{p.name}</td>
                    <td className="px-4 py-3 text-right" style={{ color: "#6b7280" }}>
                      {p.retailPrice != null ? `TWD ${Number(p.retailPrice).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold" style={{ color: "#24315f" }}>
                      {p.presalePrice != null ? `TWD ${Number(p.presalePrice).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-center" style={{ color: "#111827" }}>{p.stockQty ?? 0}</td>
                    <td className="px-4 py-3">{statusBadge(p.statusCode, p.statusName)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded-lg"
                          style={{ color: "#41afeb" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(65,175,235,0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteId(p.id)}
                          className="p-1.5 rounded-lg"
                          style={{ color: "#dc2626" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(220,38,38,0.1)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          title="Deactivate"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ border: "1px solid #e5e7eb", color: offset === 0 ? "#9bafc5" : "#24315f", cursor: offset === 0 ? "not-allowed" : "pointer" }}
          >
            Previous
          </button>
          <span className="text-sm" style={{ color: "#9bafc5" }}>
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{ border: "1px solid #e5e7eb", color: offset + PAGE_SIZE >= total ? "#9bafc5" : "#24315f", cursor: offset + PAGE_SIZE >= total ? "not-allowed" : "pointer" }}
          >
            Next
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #e5e7eb" }}>
              <h2 className="text-base font-bold" style={{ color: "#24315f" }}>{editProduct ? "Edit Product" : "New Product"}</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "#9bafc5" }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>{formError}</div>
              )}
              <div>
                <label style={labelStyle}>Product Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="Product name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Retail Price (TWD)</label>
                  <input type="number" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value })} style={inputStyle} placeholder="0" />
                </div>
                <div>
                  <label style={labelStyle}>Bearth Price (TWD)</label>
                  <input type="number" value={form.presalePrice} onChange={(e) => setForm({ ...form, presalePrice: e.target.value })} style={inputStyle} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={labelStyle}>Stock Quantity</label>
                  <input type="number" value={form.stockQty} onChange={(e) => setForm({ ...form, stockQty: e.target.value })} style={inputStyle} placeholder="0" />
                </div>
                {master && (
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select value={form.statusId} onChange={(e) => setForm({ ...form, statusId: e.target.value })} style={inputStyle}>
                      <option value="">Select...</option>
                      {master.productStatuses.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, minHeight: "64px", resize: "vertical" }} placeholder="Optional description..." />
              </div>
            </div>
            <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: "1px solid #e5e7eb" }}>
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: saving ? "#9bafc5" : "#41afeb" }}
              >
                {saving ? "Saving..." : editProduct ? "Save Changes" : "Create Product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirm */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold mb-2" style={{ color: "#24315f" }}>Deactivate Product</h2>
            <p className="text-sm mb-6" style={{ color: "#6b7280" }}>Are you sure you want to deactivate this product?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium rounded-lg" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
                Cancel
              </button>
              <button onClick={() => handleDeactivate(deleteId)} className="px-4 py-2 text-sm font-bold text-white rounded-lg" style={{ background: "#dc2626" }}>
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
