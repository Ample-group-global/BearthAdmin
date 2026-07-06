"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import DataTable, { ColumnDef } from "@/components/DataTable";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  imageUrl?: string | null;
  sku?: string | null;
  category?: string | null;
  description?: string | null;
  retailPrice: number;
  presalePrice: number;
  stockQty: number;
  sortOrder: number;
  statusCode: string;
  statusName: string;
  createdAt: string;
  updatedAt: string;
}

interface StockAdjustment {
  id: string;
  changeQty: number;
  previousQty: number;
  newQty: number;
  reason: string;
  notes?: string | null;
  adjustedByName?: string | null;
  createdAt: string;
}

interface Master {
  productStatuses:        Array<{ id: string; name: string; code: string }>;
  productCategories:      Array<{ id: string; code: string; name: string; sort_order: number }>;
  stockAdjustmentReasons: Array<{ id: string; value: string; label: string; sort_order: number }>;
}

interface FormState {
  name: string; imageUrl: string; sku: string; category: string;
  description: string; retailPrice: string; presalePrice: string;
  stockQty: string; sortOrder: string; statusId: string;
}

const PAGE_SIZE = 20;

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProductImage({ url, size = 52 }: { url?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      <img
        src={url} alt="Product"
        style={{ width: size, height: size, objectFit: "cover", borderRadius: 8, display: "block", flexShrink: 0 }}
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div style={{ width: size, height: size, background: "#f3f4f6", borderRadius: 8,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      border: "1.5px dashed #d1d5db", flexShrink: 0 }}>
      <svg style={{ width: 18, height: 18, color: "#d1d5db" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      <span style={{ fontSize: 8, color: "#d1d5db", marginTop: 2, fontWeight: 600, letterSpacing: "0.05em" }}>NO IMAGE</span>
    </div>
  );
}

function StockBadge({ qty }: { qty: number }) {
  if (qty === 0)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: "rgba(220,38,38,0.1)", color: "#dc2626" }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#dc2626" }} />Out of Stock
    </span>;
  if (qty <= 10)
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
      style={{ background: "rgba(217,119,6,0.1)", color: "#d97706" }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#d97706" }} />Low ({qty})
    </span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
    style={{ background: "rgba(22,163,74,0.1)", color: "#16a34a" }}>
    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#16a34a" }} />{qty}
  </span>;
}

function StatusBadge({ code, name }: { code: string; name: string }) {
  const active = code?.toLowerCase() === "active";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={active ? { background: "rgba(22,163,74,0.1)", color: "#16a34a" }
                    : { background: "rgba(156,163,175,0.12)", color: "#9ca3af" }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: active ? "#16a34a" : "#9ca3af" }} />
      {name}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [tab, setTab] = useState<"products" | "inventory">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [master, setMaster] = useState<Master | null>(null);

  // Modals
  const [showProductModal, setShowProductModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);
  const [historyData, setHistoryData] = useState<StockAdjustment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    name: "", imageUrl: "", sku: "", category: "",
    description: "", retailPrice: "", presalePrice: "",
    stockQty: "0", sortOrder: "0", statusId: "",
  });

  // Stock adjust form
  const [adjustType, setAdjustType] = useState<"add" | "remove">("add");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("received_stock");
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categories  = master?.productCategories      ?? [];
  const stockReasons = master?.stockAdjustmentReasons ?? [];

  // ── Data fetching ───────────────────────────────────────────────────────────
  const loadProducts = useCallback((q: string, cat: string, st: string, off: number) => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({
      search: q, category: cat, status: st,
      limit: String(PAGE_SIZE), offset: String(off),
    });
    fetch(`/api/presale/products?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => { setProducts(data.products ?? []); setTotal(data.total ?? 0); setLoading(false); })
      .catch(() => { setError("Failed to load products."); setLoading(false); });
  }, []);

  useEffect(() => {
    fetch("/api/presale/master", { credentials: "include" })
      .then(r => r.json()).then(d => setMaster(d));
  }, []);

  useEffect(() => { loadProducts(search, filterCategory, filterStatus, offset); }, [offset]);

  const applyFilters = (q = search, cat = filterCategory, st = filterStatus) => {
    setOffset(0);
    loadProducts(q, cat, st, 0);
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => applyFilters(v), 300);
  };

  // ── Product CRUD ────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditProduct(null);
    setForm({ name: "", imageUrl: "", sku: "", category: "", description: "",
              retailPrice: "", presalePrice: "", stockQty: "0", sortOrder: "0", statusId: "" });
    setFormError(null); setShowProductModal(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    const statusId = master?.productStatuses.find(s => s.code === p.statusCode)?.id ?? "";
    setForm({
      name: p.name ?? "", imageUrl: p.imageUrl ?? "", sku: p.sku ?? "",
      category: p.category ?? "", description: p.description ?? "",
      retailPrice: String(p.retailPrice ?? ""), presalePrice: String(p.presalePrice ?? ""),
      stockQty: String(p.stockQty ?? 0), sortOrder: String(p.sortOrder ?? 0),
      statusId: String(statusId),
    });
    setFormError(null); setShowProductModal(true);
  };

  const handleSave = async () => {
    setSaving(true); setFormError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        imageUrl:     form.imageUrl     || undefined,
        sku:          form.sku          || undefined,
        category:     form.category     || undefined,
        description:  form.description  || undefined,
        retailPrice:  form.retailPrice  ? Number(form.retailPrice)  : undefined,
        presalePrice: form.presalePrice ? Number(form.presalePrice) : undefined,
        stockQty:     form.stockQty     ? Number(form.stockQty)     : undefined,
        sortOrder:    form.sortOrder    ? Number(form.sortOrder)    : undefined,
      };
      if (form.statusId) body.statusId = form.statusId;
      const url = editProduct ? `/api/presale/products/${editProduct.id}` : "/api/presale/products";
      const res = await fetch(url, { method: editProduct ? "PUT" : "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? "Save failed."); return; }
      setShowProductModal(false);
      loadProducts(search, filterCategory, filterStatus, offset);
    } catch { setFormError("Network error."); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    const res = await fetch(`/api/presale/products/${deactivateId}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed."); }
    setDeactivateId(null);
    loadProducts(search, filterCategory, filterStatus, offset);
  };

  // ── Stock adjust ────────────────────────────────────────────────────────────
  const openAdjust = (p: Product) => {
    setAdjustProduct(p);
    setAdjustType("add"); setAdjustQty("");
    setAdjustReason(stockReasons[0]?.value ?? "received_stock");
    setAdjustNotes(""); setAdjustError(null);
  };

  const handleAdjust = async () => {
    if (!adjustProduct || !adjustQty) { setAdjustError("Enter a quantity."); return; }
    const qty = Number(adjustQty);
    if (!qty || qty <= 0) { setAdjustError("Quantity must be a positive number."); return; }
    setAdjusting(true); setAdjustError(null);
    const changeQty = adjustType === "add" ? qty : -qty;
    const res = await fetch(`/api/presale/products/${adjustProduct.id}/adjust-stock`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeQty, reason: adjustReason, notes: adjustNotes || undefined }),
    });
    if (!res.ok) {
      const d = await res.json();
      setAdjustError(d.error ?? "Adjustment failed.");
      setAdjusting(false); return;
    }
    setAdjustProduct(null); setAdjusting(false);
    loadProducts(search, filterCategory, filterStatus, offset);
  };

  // ── Stock history ───────────────────────────────────────────────────────────
  const openHistory = async (p: Product) => {
    setHistoryProduct(p); setHistoryLoading(true);
    const res = await fetch(`/api/presale/products/${p.id}/stock-history?limit=50`, { credentials: "include" });
    const d = await res.json();
    setHistoryData(d.history ?? []); setHistoryLoading(false);
  };

  // ── CSV export ──────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ["SKU", "Name", "Category", "Retail Price", "Bearth Price", "Stock", "Status"];
    const rows = products.map(p => [
      p.sku ?? "", p.name, p.category ?? "",
      p.retailPrice, p.presalePrice, p.stockQty, p.statusName,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `bearth-products-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  // ── Stats ───────────────────────────────────────────────────────────────────
  const outOfStock  = products.filter(p => p.stockQty === 0).length;
  const lowStock    = products.filter(p => p.stockQty > 0 && p.stockQty <= 10).length;
  const totalValue  = products.reduce((s, p) => s + (p.presalePrice * p.stockQty), 0);
  const activeCount = products.filter(p => p.statusCode === "active").length;

  const inventoryProducts = [...products].sort((a, b) => a.stockQty - b.stockQty);

  // ── Shared input styles ─────────────────────────────────────────────────────
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
    textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 14px", textAlign: "left",
    borderBottom: "1px solid #e5e7eb", background: "#f9fafb", whiteSpace: "nowrap",
  };

  const adjustedPreview = (() => {
    const curr = adjustProduct?.stockQty ?? 0;
    const qty  = Number(adjustQty) || 0;
    const next = adjustType === "add" ? curr + qty : curr - qty;
    return { curr, next, diff: adjustType === "add" ? `+${qty}` : `-${qty}` };
  })();

  // ── Column definitions ──────────────────────────────────────────────────────
  const productColumns: ColumnDef<Product>[] = [
    {
      key: "image", header: "", width: 68,
      render: p => <ProductImage url={p.imageUrl} size={52} />,
    },
    {
      key: "product", header: "Product",
      render: p => (
        <div style={{ maxWidth: 280 }}>
          <div className="font-semibold text-sm truncate" style={{ color: "#111827" }}>{p.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {p.sku && <span className="text-xs font-mono" style={{ color: "#9bafc5" }}>{p.sku}</span>}
            {p.category && (
              <span className="px-1.5 py-0.5 rounded text-xs font-semibold"
                style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>
                {p.category}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "retail", header: "Retail (TWD)", align: "right",
      render: p => (
        <span style={{ color: "#6b7280" }}>
          {p.retailPrice != null ? Number(p.retailPrice).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "bearth", header: "Bearth (TWD)", align: "right",
      render: p => (
        <span style={{ fontWeight: 700, color: "#24315f" }}>
          {p.presalePrice != null ? Number(p.presalePrice).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "stock", header: "Stock", align: "center",
      render: p => <StockBadge qty={p.stockQty ?? 0} />,
    },
    {
      key: "status", header: "Status", align: "center",
      render: p => <StatusBadge code={p.statusCode} name={p.statusName} />,
    },
    {
      key: "actions", header: "Actions", align: "center",
      render: p => (
        <div className="flex items-center justify-center gap-1">
          <ActionBtn icon="edit"       label="Edit"          color="#41afeb" onClick={() => openEdit(p)} />
          <ActionBtn icon="stock"      label="Adjust Stock"  color="#7c3aed" onClick={() => openAdjust(p)} />
          <ActionBtn icon="deactivate" label="Deactivate"    color="#dc2626" onClick={() => setDeactivateId(p.id)} />
        </div>
      ),
    },
  ];

  const inventoryColumns: ColumnDef<Product>[] = [
    {
      key: "image", header: "", width: 68,
      render: p => <ProductImage url={p.imageUrl} size={48} />,
    },
    {
      key: "product", header: "Product",
      render: p => (
        <div style={{ maxWidth: 260 }}>
          <div className="font-semibold text-sm truncate" style={{ color: "#111827" }}>{p.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {p.sku      && <span className="text-xs font-mono" style={{ color: "#9bafc5" }}>{p.sku}</span>}
            {p.category && <span className="text-xs" style={{ color: "#9bafc5" }}>{p.category}</span>}
          </div>
        </div>
      ),
    },
    {
      key: "stockStatus", header: "Stock Status", align: "center",
      render: p => <StockBadge qty={p.stockQty ?? 0} />,
    },
    {
      key: "retailValue", header: "Retail Value", align: "right",
      render: p => (
        <span style={{ color: "#6b7280", fontSize: 12 }}>
          TWD {(p.retailPrice * p.stockQty).toLocaleString()}
        </span>
      ),
    },
    {
      key: "presaleValue", header: "Presale Value", align: "right",
      render: p => (
        <span style={{ fontWeight: 700, color: "#24315f", fontSize: 12 }}>
          TWD {(p.presalePrice * p.stockQty).toLocaleString()}
        </span>
      ),
    },
    {
      key: "actions", header: "Actions", align: "center",
      render: p => (
        <div className="flex items-center justify-center gap-1">
          <ActionBtn icon="stock"   label="Adjust Stock"  color="#7c3aed" onClick={() => openAdjust(p)} />
          <ActionBtn icon="history" label="Stock History" color="#41afeb" onClick={() => openHistory(p)} />
        </div>
      ),
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-5 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "#24315f" }}>Bearth Peripheral Products</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Manage Bearth merchandise catalog and inventory</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
            style={{ background: "#41afeb" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#2e9fd8")}
            onMouseLeave={e => (e.currentTarget.style.background = "#41afeb")}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b" style={{ borderColor: "#e5e7eb" }}>
        {(["products", "inventory"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 text-sm font-semibold capitalize transition-colors"
            style={{
              color: tab === t ? "#41afeb" : "#9bafc5",
              borderBottom: tab === t ? "2px solid #41afeb" : "2px solid transparent",
              marginBottom: -1,
            }}>
            {t === "inventory" ? "Inventory" : "Products"}
          </button>
        ))}
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tab === "products" ? <>
          <StatCard label="Total Products"  value={String(total)}        color="#41afeb" />
          <StatCard label="Active"          value={String(activeCount)}  color="#16a34a" />
          <StatCard label="Low Stock"       value={String(lowStock)}     color="#d97706" />
          <StatCard label="Out of Stock"    value={String(outOfStock)}   color="#dc2626" />
        </> : <>
          <StatCard label="Total SKUs"      value={String(products.length)}                       color="#41afeb" />
          <StatCard label="Out of Stock"    value={String(outOfStock)}                            color="#dc2626" />
          <StatCard label="Low Stock"       value={String(lowStock)}                              color="#d97706" />
          <StatCard label="Inventory Value" value={`TWD ${totalValue.toLocaleString()}`}          color="#7c3aed" small />
        </>}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48 max-w-64">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search name, SKU, category…" value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#111827" }} />
        </div>
        <select value={filterCategory}
          onChange={e => { setFilterCategory(e.target.value); applyFilters(search, e.target.value, filterStatus); }}
          className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
          style={{ border: "1px solid #e5e7eb", color: filterCategory ? "#111827" : "#9bafc5" }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        <select value={filterStatus}
          onChange={e => { setFilterStatus(e.target.value); applyFilters(search, filterCategory, e.target.value); }}
          className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
          style={{ border: "1px solid #e5e7eb", color: filterStatus ? "#111827" : "#9bafc5" }}>
          <option value="">All Status</option>
          {(master?.productStatuses ?? []).map(s => (
            <option key={s.id} value={s.code}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* ── Products Tab ── */}
      {tab === "products" && (
        <DataTable
          columns={productColumns}
          data={products}
          total={total}
          offset={offset}
          pageSize={PAGE_SIZE}
          onPageChange={newOffset => { setOffset(newOffset); }}
          loading={loading}
          error={error}
          emptyText="No products found"
          keyExtractor={p => p.id}
        />
      )}

      {/* ── Inventory Tab ── */}
      {tab === "inventory" && (
        <>
          <DataTable
            columns={inventoryColumns}
            data={inventoryProducts}
            total={total}
            offset={offset}
            pageSize={PAGE_SIZE}
            onPageChange={newOffset => { setOffset(newOffset); }}
            loading={loading}
            error={error}
            emptyText="No inventory data"
            keyExtractor={p => p.id}
          />
          {/* Inventory totals row */}
          {!loading && inventoryProducts.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold"
              style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#24315f" }}>
              <span>Total Inventory Value (this page)</span>
              <div className="flex items-center gap-6">
                <span>
                  Retail: <strong>TWD {products.reduce((s, p) => s + p.retailPrice * p.stockQty, 0).toLocaleString()}</strong>
                </span>
                <span>
                  Presale: <strong style={{ color: "#7c3aed" }}>TWD {totalValue.toLocaleString()}</strong>
                </span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ Add / Edit Product Modal ══════════════════════════════════════════ */}
      {showProductModal && (
        <Modal onClose={() => setShowProductModal(false)}
          title={editProduct ? "Edit Product" : "Add New Product"}>
          <div className="space-y-4">
            {formError && <ErrorBanner msg={formError} />}

            {/* Image URL + Preview */}
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <label style={labelStyle}>Product Image URL</label>
                <input value={form.imageUrl} onChange={e => setForm({ ...form, imageUrl: e.target.value })}
                  style={inputStyle} placeholder="https://..." />
              </div>
              <div className="mt-5">
                <ProductImage url={form.imageUrl || null} size={64} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label style={labelStyle}>Product Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  style={inputStyle} placeholder="Full product name" />
              </div>
              <div>
                <label style={labelStyle}>SKU</label>
                <input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })}
                  style={inputStyle} placeholder="BCP-HAT-001" />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  style={inputStyle} placeholder="T-Shirts, Accessories…" list="cat-list" />
                <datalist id="cat-list">
                  {categories.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Retail Price (TWD) *</label>
                <input type="number" value={form.retailPrice} onChange={e => setForm({ ...form, retailPrice: e.target.value })}
                  style={inputStyle} placeholder="0" />
              </div>
              <div>
                <label style={labelStyle}>Bearth Price (TWD) *</label>
                <input type="number" value={form.presalePrice} onChange={e => setForm({ ...form, presalePrice: e.target.value })}
                  style={inputStyle} placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label style={labelStyle}>Stock Qty</label>
                <input type="number" value={form.stockQty} onChange={e => setForm({ ...form, stockQty: e.target.value })}
                  style={inputStyle} placeholder="0" />
              </div>
              <div>
                <label style={labelStyle}>Sort Order</label>
                <input type="number" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: e.target.value })}
                  style={inputStyle} placeholder="0" />
              </div>
              {master && (
                <div>
                  <label style={labelStyle}>Status</label>
                  <select value={form.statusId} onChange={e => setForm({ ...form, statusId: e.target.value })} style={inputStyle}>
                    <option value="">Select…</option>
                    {master.productStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                style={{ ...inputStyle, minHeight: 64, resize: "vertical" }}
                placeholder="Product description, materials, sizes…" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: "16px" }}>
            <button onClick={() => setShowProductModal(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg"
              style={{ background: saving ? "#9bafc5" : "#41afeb" }}>
              {saving ? "Saving…" : editProduct ? "Save Changes" : "Create Product"}
            </button>
          </div>
        </Modal>
      )}

      {/* ══ Deactivate Confirm ══════════════════════════════════════════════════ */}
      {deactivateId && (
        <Modal onClose={() => setDeactivateId(null)} title="Deactivate Product" small>
          <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
            This product will be marked inactive and hidden from active listings. You can reactivate it later by editing.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setDeactivateId(null)} className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
            <button onClick={handleDeactivate} className="px-4 py-2 text-sm font-bold text-white rounded-lg"
              style={{ background: "#dc2626" }}>Deactivate</button>
          </div>
        </Modal>
      )}

      {/* ══ Stock Adjust Modal ══════════════════════════════════════════════════ */}
      {adjustProduct && (
        <Modal onClose={() => setAdjustProduct(null)} title="Adjust Stock">
          <div className="space-y-4">
            {adjustError && <ErrorBanner msg={adjustError} />}
            <div className="p-3 rounded-xl flex items-center gap-3" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <ProductImage url={adjustProduct.imageUrl} size={44} />
              <div>
                <div className="font-semibold text-sm" style={{ color: "#111827" }}>{adjustProduct.name}</div>
                <div className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                  Current stock: <strong style={{ color: "#24315f" }}>{adjustProduct.stockQty}</strong>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              {(["add", "remove"] as const).map(t => (
                <button key={t} onClick={() => setAdjustType(t)}
                  className="flex-1 py-2 text-sm font-bold rounded-lg transition-all"
                  style={{
                    background: adjustType === t ? (t === "add" ? "#16a34a" : "#dc2626") : "#f3f4f6",
                    color: adjustType === t ? "#fff" : "#6b7280",
                    border: "none",
                  }}>
                  {t === "add" ? "＋ Add Stock" : "－ Remove Stock"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Quantity *</label>
                <input type="number" min="1" value={adjustQty}
                  onChange={e => setAdjustQty(e.target.value)} style={inputStyle} placeholder="0" />
              </div>
              <div>
                <label style={labelStyle}>Reason</label>
                <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)} style={inputStyle}>
                  {stockReasons.map(r => <option key={r.id} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Notes (optional)</label>
              <textarea value={adjustNotes} onChange={e => setAdjustNotes(e.target.value)}
                style={{ ...inputStyle, minHeight: 56, resize: "vertical" }}
                placeholder="e.g. PO #1234, damaged items from shipment…" />
            </div>

            {adjustQty && Number(adjustQty) > 0 && (
              <div className="p-3 rounded-xl text-center" style={{
                background: adjustType === "add" ? "rgba(22,163,74,0.06)" : "rgba(220,38,38,0.06)",
                border: `1px solid ${adjustType === "add" ? "rgba(22,163,74,0.2)" : "rgba(220,38,38,0.2)"}`,
              }}>
                <span className="text-sm font-semibold" style={{ color: "#6b7280" }}>
                  {adjustedPreview.curr} → <strong style={{ color: adjustType === "add" ? "#16a34a" : "#dc2626", fontSize: 16 }}>
                    {adjustedPreview.next}
                  </strong> <span style={{ color: adjustType === "add" ? "#16a34a" : "#dc2626" }}>({adjustedPreview.diff})</span>
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => setAdjustProduct(null)} className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
            <button onClick={handleAdjust} disabled={adjusting}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg"
              style={{ background: adjusting ? "#9bafc5" : (adjustType === "add" ? "#16a34a" : "#dc2626") }}>
              {adjusting ? "Adjusting…" : "Confirm Adjustment"}
            </button>
          </div>
        </Modal>
      )}

      {/* ══ Stock History Modal ═════════════════════════════════════════════════ */}
      {historyProduct && (
        <Modal onClose={() => { setHistoryProduct(null); setHistoryData([]); }}
          title={`Stock History — ${historyProduct.name}`} wide>
          {historyLoading ? (
            <div className="flex items-center justify-center h-40" style={{ color: "#9bafc5" }}>
              <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading…
            </div>
          ) : historyData.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "#9bafc5" }}>No adjustment history yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {["Date", "Change", "Before → After", "Reason", "Notes", "By"].map(h => (
                    <th key={h} style={{ ...thStyle, background: "none" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historyData.map((h, i) => (
                  <tr key={h.id} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 14px", color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>
                      {new Date(h.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "center" }}>
                      <span className="font-bold" style={{ color: h.changeQty >= 0 ? "#16a34a" : "#dc2626" }}>
                        {h.changeQty >= 0 ? `+${h.changeQty}` : h.changeQty}
                      </span>
                    </td>
                    <td style={{ padding: "8px 14px", textAlign: "center", color: "#6b7280", fontSize: 12 }}>
                      {h.previousQty} → <strong style={{ color: "#24315f" }}>{h.newQty}</strong>
                    </td>
                    <td style={{ padding: "8px 14px" }}>
                      <span className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>
                        {stockReasons.find(r => r.value === h.reason)?.label ?? h.reason}
                      </span>
                    </td>
                    <td style={{ padding: "8px 14px", color: "#6b7280", fontSize: 12 }}>{h.notes ?? "—"}</td>
                    <td style={{ padding: "8px 14px", color: "#6b7280", fontSize: 12 }}>{h.adjustedByName || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex justify-end pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => { setHistoryProduct(null); setHistoryData([]); }}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Close</button>
          </div>
        </Modal>
      )}

    </div>
  );
}

// ─── Utility Components ───────────────────────────────────────────────────────

function StatCard({ label, value, color, small }: { label: string; value: string; color: string; small?: boolean }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>{label}</p>
      <p className={`font-bold ${small ? "text-base" : "text-2xl"}`} style={{ color }}>{value}</p>
    </div>
  );
}

function Modal({ children, onClose, title, small, wide }:
  { children: React.ReactNode; onClose: () => void; title: string; small?: boolean; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl flex flex-col"
        style={{ width: "100%", maxWidth: wide ? 780 : small ? 400 : 560, maxHeight: "90vh", border: "1px solid #e5e7eb" }}>
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

function ActionBtn({ icon, label, color, onClick }: { icon: string; label: string; color: string; onClick: () => void }) {
  const paths: Record<string, string> = {
    edit:       "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    stock:      "M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4",
    deactivate: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
    history:    "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  };
  return (
    <button onClick={onClick} title={label}
      className="p-1.5 rounded-lg transition-colors"
      style={{ color }}
      onMouseEnter={e => (e.currentTarget.style.background = `${color}18`)}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={paths[icon]} />
      </svg>
    </button>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
      {msg}
    </div>
  );
}
