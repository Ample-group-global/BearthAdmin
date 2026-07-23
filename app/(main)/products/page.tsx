"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import DataTable, { ColumnDef } from "@/components/DataTable";
import * as XLSX from "xlsx";
import QRCode from "qrcode";

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
  reservedQty: number;
  availableQty: number;
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

interface ImportRow {
  name: string;
  sku?: string;
  category?: string;
  retailPrice?: number;
  presalePrice?: number;
  stockQty?: number;
  description?: string;
  _rowNum: number;
  _errors: string[];
}

const PAGE_SIZE = 20;

const STORE_URL = (
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_STORE_URL : undefined
) ?? "https://bearth.io";

// Maps full category names → 3-4 char codes (industry standard: brand-category-seq)
const CAT_CODE_MAP: Record<string, string> = {
  "t-shirts": "TSH", "tshirts": "TSH", "t shirts": "TSH", "shirts": "SHT",
  "hoodies": "HDY", "hoodie": "HDY", "sweatshirts": "SWT",
  "headwear": "HWR", "hats": "HAT", "caps": "CAP",
  "bags": "BAG", "bag": "BAG", "backpacks": "BPK", "tote bags": "TOT",
  "accessories": "ACC", "accessory": "ACC",
  "outerwear": "OWT", "jackets": "JKT", "coats": "COT",
  "socks": "SCK", "sock": "SCK",
  "pants": "PNT", "trousers": "TRS", "shorts": "SHO",
  "shoes": "FOO", "footwear": "FOO", "sneakers": "SNK",
  "nft": "NFT", "digital": "DIG",
};

function getCatCode(category: string): string {
  const lower = category.trim().toLowerCase();
  if (CAT_CODE_MAP[lower]) return CAT_CODE_MAP[lower];
  // Derive from first 3 consonants or first 3 chars, uppercase
  const letters = lower.replace(/[^a-z]/g, "");
  return letters.slice(0, 3).toUpperCase().padEnd(3, "X");
}

function genSku(category?: string): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  const seq  = Math.floor(Math.random() * 900 + 100); // 100–999
  if (category && category.trim()) {
    const cat = getCatCode(category);
    return `BRTH-${cat}-${yy}${mm}-${seq}`;
  }
  return `BRTH-GEN-${yy}${mm}-${rand}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProductImage({ url, size = 52, zoom = false }: { url?: string | null; size?: number; zoom?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState(false);
  if (url && !failed) {
    return (
      <div style={{ width: size, height: size, borderRadius: 8, overflow: "hidden", flexShrink: 0,
        transition: "box-shadow 0.2s", boxShadow: zoom && hovered ? "0 4px 16px rgba(0,0,0,0.18)" : "none" }}
        onMouseEnter={() => zoom && setHovered(true)}
        onMouseLeave={() => zoom && setHovered(false)}>
        <img src={url} alt="Product"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block",
            transition: "transform 0.25s ease", transform: zoom && hovered ? "scale(1.18)" : "scale(1)" }}
          onError={() => setFailed(true)} />
      </div>
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
  const [products,    setProducts]    = useState<Product[]>([]);
  const [total,       setTotal]       = useState(0);
  const [globalTotal, setGlobalTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [outOfStock,  setOutOfStock]  = useState(0);
  const [lowStock,    setLowStock]    = useState(0);
  const [totalValue,  setTotalValue]  = useState(0);
  const [offset,      setOffset]      = useState(0);
  const [search,      setSearch]      = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus,   setFilterStatus]   = useState("");
  const [sortKey, setSortKey] = useState<string | undefined>(undefined);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [master,      setMaster]      = useState<Master | null>(null);

  // Modals
  const [showProductModal,  setShowProductModal]  = useState(false);
  const [editProduct,       setEditProduct]        = useState<Product | null>(null);
  const [deactivateId,      setDeactivateId]       = useState<string | null>(null);
  const [adjustProduct,     setAdjustProduct]      = useState<Product | null>(null);
  const [historyProduct,    setHistoryProduct]     = useState<Product | null>(null);
  const [historyData,       setHistoryData]        = useState<StockAdjustment[]>([]);
  const [historyLoading,    setHistoryLoading]     = useState(false);
  const [qrProduct,         setQrProduct]          = useState<Product | null>(null);
  const [qrDataUrl,         setQrDataUrl]          = useState<string>("");
  const [detailProduct,     setDetailProduct]      = useState<Product | null>(null);
  const [lightboxUrl,       setLightboxUrl]        = useState<string | null>(null);
  const [showImportModal,   setShowImportModal]    = useState(false);
  const [importRows,        setImportRows]         = useState<ImportRow[]>([]);
  const [importLoading,     setImportLoading]      = useState(false);
  const [importError,       setImportError]        = useState<string | null>(null);
  const [importing,         setImporting]          = useState(false);
  const [showNewCat,        setShowNewCat]         = useState(false);
  const [newCatValue,       setNewCatValue]        = useState("");

  const [saving,     setSaving]     = useState(false);
  const [formError,  setFormError]  = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadError,    setUploadError]    = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    name: "", imageUrl: "", sku: "", category: "",
    description: "", retailPrice: "", presalePrice: "",
    stockQty: "0", sortOrder: "0", statusId: "",
  });

  // Stock adjust
  const [adjustType,   setAdjustType]   = useState<"add" | "remove">("add");
  const [adjustQty,    setAdjustQty]    = useState("");
  const [adjustReason, setAdjustReason] = useState("received_stock");
  const [adjustNotes,  setAdjustNotes]  = useState("");
  const [adjusting,    setAdjusting]    = useState(false);
  const [adjustError,  setAdjustError]  = useState<string | null>(null);

  const searchTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const skuAutoRef = useRef(true); // true = SKU is still auto-generated, false = user manually typed

  const categories   = master?.productCategories      ?? [];
  const stockReasons = master?.stockAdjustmentReasons ?? [];

  // ── Client-side sort ─────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortKey) return products;
    return [...products].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortKey) {
        case "product":  av = a.name;         bv = b.name;         break;
        case "retail":   av = a.retailPrice;  bv = b.retailPrice;  break;
        case "bearth":   av = a.presalePrice; bv = b.presalePrice; break;
        case "stock":    av = a.stockQty;     bv = b.stockQty;     break;
        case "status":   av = a.statusCode;   bv = b.statusCode;   break;
        default: return 0;
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [products, sortKey, sortDir]);

  // ── Data fetching ─────────────────────────────────────────────────────────────
  const loadProducts = useCallback((q: string, cat: string, st: string, off: number) => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({
      search: q, category: cat, status: st,
      limit: String(PAGE_SIZE), offset: String(off),
    });
    fetch(`/api/products?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        setProducts(data.products ?? []);
        setTotal(data.total ?? 0);
        setGlobalTotal(data.globalTotal ?? data.total ?? 0);
        setActiveCount(data.activeCount ?? 0);
        setOutOfStock(data.outOfStock ?? 0);
        setLowStock(data.lowStock ?? 0);
        setTotalValue(data.totalValue ?? 0);
        setLoading(false);
      })
      .catch(() => { setError("Failed to load products."); setLoading(false); });
  }, []);

  useEffect(() => {
    fetch("/api/master", { credentials: "include" })
      .then(r => r.json()).then(d => setMaster(d));
  }, []);

  useEffect(() => { loadProducts(search, filterCategory, filterStatus, offset); }, [offset]);

  const applyFilters = (q = search, cat = filterCategory, st = filterStatus) => {
    setOffset(0); loadProducts(q, cat, st, 0);
  };

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => applyFilters(v), 300);
  };

  // ── Image upload ──────────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) {
      setUploadError("Invalid file type. Allowed: JPG, PNG, WebP, GIF."); return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File too large. Maximum size is 5 MB."); return;
    }

    setUploadingImage(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/products/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? "Upload failed."); return; }
      setForm(f => ({ ...f, imageUrl: data.url }));
    } catch { setUploadError("Upload failed. Please try again."); }
    finally { setUploadingImage(false); if (fileInputRef.current) fileInputRef.current.value = ""; }
  };

  // ── Form validation ───────────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) errs.name = "Product name is required.";
    if (!form.retailPrice || isNaN(Number(form.retailPrice)) || Number(form.retailPrice) < 0)
      errs.retailPrice = "Enter a valid retail price (0 or more).";
    if (!form.presalePrice || isNaN(Number(form.presalePrice)) || Number(form.presalePrice) < 0)
      errs.presalePrice = "Enter a valid Bearth price (0 or more).";
    if (form.stockQty && (isNaN(Number(form.stockQty)) || Number(form.stockQty) < 0))
      errs.stockQty = "Stock quantity cannot be negative.";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Product CRUD ──────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditProduct(null);
    skuAutoRef.current = true;
    setForm({ name: "", imageUrl: "", sku: genSku(), category: "",
              description: "", retailPrice: "", presalePrice: "",
              stockQty: "0", sortOrder: "0", statusId: "" });
    setFormError(null); setFormErrors({}); setUploadError(null);
    setShowNewCat(false); setNewCatValue("");
    setShowProductModal(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    skuAutoRef.current = false; // in edit mode, never auto-update SKU
    const statusId = master?.productStatuses.find(s => s.code === p.statusCode)?.id ?? "";
    setForm({
      name: p.name ?? "", imageUrl: p.imageUrl ?? "", sku: p.sku ?? "",
      category: p.category ?? "", description: p.description ?? "",
      retailPrice: String(p.retailPrice ?? ""), presalePrice: String(p.presalePrice ?? ""),
      stockQty: String(p.stockQty ?? 0), sortOrder: String(p.sortOrder ?? 0),
      statusId: String(statusId),
    });
    setFormError(null); setFormErrors({}); setUploadError(null);
    setShowNewCat(false); setNewCatValue("");
    setShowProductModal(true);
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true); setFormError(null);
    try {
      const body: Record<string, unknown> = {
        name:         form.name.trim(),
        imageUrl:     form.imageUrl     || undefined,
        sku:          form.sku.trim()   || undefined,
        category:     form.category     || undefined,
        description:  form.description  || undefined,
        retailPrice:  Number(form.retailPrice),
        presalePrice: Number(form.presalePrice),
        stockQty:     form.stockQty  ? Number(form.stockQty)  : 0,
        sortOrder:    form.sortOrder ? Number(form.sortOrder) : 0,
      };
      if (form.statusId) body.statusId = form.statusId;
      const url = editProduct ? `/api/products/${editProduct.id}` : "/api/products";
      const res = await fetch(url, { method: editProduct ? "PUT" : "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? "Save failed."); return; }
      setShowProductModal(false);
      loadProducts(search, filterCategory, filterStatus, offset);
    } catch { setFormError("Network error. Please try again."); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    const res = await fetch(`/api/products/${deactivateId}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed."); }
    setDeactivateId(null);
    loadProducts(search, filterCategory, filterStatus, offset);
  };

  // ── Stock adjust ──────────────────────────────────────────────────────────────
  const openAdjust = (p: Product) => {
    setAdjustProduct(p);
    setAdjustType("add"); setAdjustQty("");
    setAdjustReason(stockReasons[0]?.value ?? "received_stock");
    setAdjustNotes(""); setAdjustError(null);
  };

  const handleAdjust = async () => {
    if (!adjustProduct) return;
    if (!adjustQty || isNaN(Number(adjustQty)) || Number(adjustQty) <= 0) {
      setAdjustError("Enter a valid positive quantity."); return;
    }
    setAdjusting(true); setAdjustError(null);
    const changeQty = adjustType === "add" ? Number(adjustQty) : -Number(adjustQty);
    const res = await fetch(`/api/products/${adjustProduct.id}/adjust-stock`, {
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

  // ── Stock history ─────────────────────────────────────────────────────────────
  const openHistory = async (p: Product) => {
    setHistoryProduct(p); setHistoryLoading(true);
    const res = await fetch(`/api/products/${p.id}/stock-history?limit=50`, { credentials: "include" });
    const d = await res.json();
    setHistoryData(d.history ?? []); setHistoryLoading(false);
  };

  // ── QR code ───────────────────────────────────────────────────────────────────
  const openQR = async (p: Product) => {
    setQrProduct(p);
    const sku = p.sku || p.id;
    const url = `${STORE_URL}/products/${sku}`;
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2, color: { dark: "#24315f", light: "#ffffff" } });
      setQrDataUrl(dataUrl);
    } catch { setQrDataUrl(""); }
  };

  const downloadQR = () => {
    if (!qrDataUrl || !qrProduct) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `qr-${qrProduct.sku || qrProduct.id}.png`;
    a.click();
  };

  // ── Excel template ────────────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Name", "SKU", "Category", "Retail Price (TWD)", "Bearth Price (TWD)", "Stock Qty", "Description"],
      ["Bearth Classic Hat", "BCP-20260707-HAT1", "Accessories", 990, 550, 50, "Adjustable cap"],
    ]);
    ws["!cols"] = [{ wch: 30 }, { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, "bearth-products-template.xlsx");
  };

  // ── Excel import ──────────────────────────────────────────────────────────────
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null); setImportRows([]); setImportLoading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/products/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error ?? "Failed to parse file."); return; }
      setImportRows(data.rows ?? []);
    } catch { setImportError("Failed to parse Excel file."); }
    finally { setImportLoading(false); if (importInputRef.current) importInputRef.current.value = ""; }
  };

  const handleConfirmImport = async () => {
    const validRows = importRows.filter(r => r._errors.length === 0);
    if (validRows.length === 0) { setImportError("No valid rows to import."); return; }
    setImporting(true); setImportError(null);
    try {
      const items = validRows.map(r => ({
        name: r.name, sku: r.sku || genSku(), category: r.category,
        retailPrice: r.retailPrice, presalePrice: r.presalePrice,
        stockQty: r.stockQty ?? 0, description: r.description,
      }));
      const res = await fetch("/api/products/bulk", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) { setImportError(data.error ?? "Import failed."); return; }
      setShowImportModal(false); setImportRows([]);
      loadProducts(search, filterCategory, filterStatus, 0);
      setOffset(0);
    } catch { setImportError("Network error during import."); }
    finally { setImporting(false); }
  };

  // ── CSV export ────────────────────────────────────────────────────────────────
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

  // ── Shared styles ─────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: "8px",
    border: "1px solid #e5e7eb", fontSize: "13px", color: "#111827", outline: "none",
  };
  const errInputStyle: React.CSSProperties = { ...inputStyle, border: "1px solid #fca5a5" };
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

  // ── Column definitions ────────────────────────────────────────────────────────
  const productColumns: ColumnDef<Product>[] = [
    {
      key: "image", header: "", width: 84,
      render: p => (
        <div style={{ cursor: p.imageUrl ? "zoom-in" : "default" }}
          onClick={() => p.imageUrl && setLightboxUrl(p.imageUrl)}>
          <ProductImage url={p.imageUrl} size={68} zoom />
        </div>
      ),
    },
    {
      key: "product", header: "Product", sortKey: "product",
      render: p => (
        <div style={{ maxWidth: 220, minWidth: 140, overflow: "hidden" }}>
          <button type="button" onClick={() => setDetailProduct(p)} title={p.name}
            className="font-semibold text-sm text-left block w-full"
            style={{ color: "#24315f", cursor: "pointer", background: "none", border: "none", padding: 0,
              textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.name}
          </button>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {p.sku && (
              <span className="text-xs font-mono" title={p.sku}
                style={{ color: "#9bafc5", maxWidth: 100, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                {p.sku}
              </span>
            )}
            {p.category && (
              <span className="px-1.5 py-0.5 rounded text-xs font-semibold" title={p.category}
                style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb",
                  maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis",
                  whiteSpace: "nowrap", display: "inline-block" }}>
                {p.category}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "retail", header: "MRP PRICE", sortKey: "retail", align: "right",
      render: p => <span style={{ color: "#6b7280" }}>{p.retailPrice != null ? `TWD ${Number(p.retailPrice).toLocaleString()}` : "—"}</span>,
    },
    {
      key: "bearth", header: "Bearth PRICE", sortKey: "bearth", align: "right",
      render: p => <span style={{ fontWeight: 700, color: "#24315f" }}>{p.presalePrice != null ? `TWD ${Number(p.presalePrice).toLocaleString()}` : "—"}</span>,
    },
    {
      key: "stock", header: "Stock", sortKey: "stock", align: "center",
      render: p => <StockBadge qty={p.stockQty ?? 0} />,
    },
    {
      key: "reserved", header: "Reserved", align: "center",
      render: p => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: p.reservedQty > 0 ? "rgba(217,119,6,0.1)" : "rgba(156,163,175,0.08)",
            color: p.reservedQty > 0 ? "#d97706" : "#9bafc5" }}>
          {p.reservedQty ?? 0}
        </span>
      ),
    },
    {
      key: "available", header: "Available", align: "center",
      render: p => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ background: (p.availableQty ?? 0) > 0 ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.08)",
            color: (p.availableQty ?? 0) > 0 ? "#16a34a" : "#dc2626" }}>
          {p.availableQty ?? 0}
        </span>
      ),
    },
    {
      key: "status", header: "Status", sortKey: "status", align: "center",
      render: p => <StatusBadge code={p.statusCode} name={p.statusName} />,
    },
    {
      key: "actions", header: "Actions", align: "center",
      render: p => (
        <div className="flex items-center justify-center gap-0.5">
          <ActionBtn icon="edit"       label="Edit"          color="#41afeb" onClick={() => openEdit(p)} />
          <ActionBtn icon="qr"         label="QR Code"       color="#7c3aed" onClick={() => openQR(p)} />
          <ActionBtn icon="stock"      label="Adjust Stock"  color="#16a34a" onClick={() => openAdjust(p)} />
          <ActionBtn icon="history"    label="Stock History" color="#41afeb" onClick={() => openHistory(p)} />
          <ActionBtn icon="deactivate" label="Deactivate"    color="#dc2626" onClick={() => setDeactivateId(p.id)} />
        </div>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-5 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>Bearth Product Inventory</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Manage merchandise catalog, stock levels, and inventory value</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button onClick={() => { setShowImportModal(true); setImportRows([]); setImportError(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#16a34a" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
            </svg>
            Import Excel
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

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Total Products"  value={String(globalTotal)}                   color="#41afeb" />
        <StatCard label="Active"          value={String(activeCount)}                   color="#16a34a" />
        <StatCard label="Low Stock"       value={String(lowStock)}                      color="#d97706" />
        <StatCard label="Out of Stock"    value={String(outOfStock)}                    color="#dc2626" />
        <StatCard label="Inventory Value" value={`TWD ${totalValue.toLocaleString()}`}  color="#7c3aed" small />
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

      {/* ── Product Table ── */}
      <DataTable
        columns={productColumns}
        data={sorted}
        total={total}
        offset={offset}
        pageSize={PAGE_SIZE}
        onPageChange={newOffset => setOffset(newOffset)}
        loading={loading}
        error={error}
        emptyText="No products found"
        keyExtractor={p => p.id}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={(key, dir) => { setSortKey(key); setSortDir(dir); }}
      />

      {/* ── Inventory Totals Row ── */}
      {!loading && products.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl text-xs font-semibold"
          style={{ background: "#f9fafb", border: "1px solid #e5e7eb", color: "#24315f" }}>
          <span>Inventory Value (this page)</span>
          <div className="flex items-center gap-6">
            <span>Retail: <strong>TWD {products.reduce((s, p) => s + p.retailPrice * p.stockQty, 0).toLocaleString()}</strong></span>
            <span>Presale: <strong style={{ color: "#7c3aed" }}>TWD {totalValue.toLocaleString()}</strong></span>
          </div>
        </div>
      )}

      {/* ══ Add / Edit Product Modal ══════════════════════════════════════════════ */}
      {showProductModal && (
        <Modal onClose={() => setShowProductModal(false)}
          title={editProduct ? "Edit Product" : "Add New Product"} wide>
          <div className="space-y-4">
            {formError && <ErrorBanner msg={formError} />}

            {/* Image Upload */}
            <div>
              <label style={labelStyle}>Product Image</label>
              <div className="flex gap-3 items-start">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input ref={fileInputRef} type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      style={{ display: "none" }} onChange={handleFileChange} />
                    <button type="button" disabled={uploadingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
                      style={{ border: "1px solid #e5e7eb", color: "#41afeb", background: "#fff", cursor: "pointer" }}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {uploadingImage ? "Uploading…" : form.imageUrl ? "Change Image" : "Upload Image"}
                    </button>
                    {form.imageUrl && (
                      <button type="button" onClick={() => setForm(f => ({ ...f, imageUrl: "" }))}
                        className="px-2 py-2 rounded-lg text-xs"
                        style={{ border: "1px solid #fecaca", color: "#dc2626", background: "#fff" }}>
                        Remove
                      </button>
                    )}
                  </div>
                  {form.imageUrl && (
                    <p className="text-xs truncate" style={{ color: "#6b7280" }}>
                      {form.imageUrl.split("/").pop()}
                    </p>
                  )}
                  {uploadError && <p className="text-xs" style={{ color: "#dc2626" }}>{uploadError}</p>}
                  <p className="text-xs" style={{ color: "#9bafc5" }}>JPG, PNG, WebP, GIF — max 5 MB</p>
                </div>
                <ProductImage url={form.imageUrl || null} size={72} />
              </div>
            </div>

            {/* Name + SKU */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label style={labelStyle}>Product Name *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  style={formErrors.name ? errInputStyle : inputStyle} placeholder="Full product name" />
                {formErrors.name && <p className="text-xs mt-0.5" style={{ color: "#dc2626" }}>{formErrors.name}</p>}
              </div>
              <div>
                <label style={labelStyle}>
                  SKU{" "}
                  {!editProduct && (
                    <span style={{ color: "#9bafc5", fontWeight: 400 }}>
                      {skuAutoRef.current ? "(auto — pick category to refine)" : "(custom)"}
                    </span>
                  )}
                </label>
                <input value={form.sku}
                  onChange={e => { skuAutoRef.current = false; setForm({ ...form, sku: e.target.value }); }}
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13, letterSpacing: "0.04em" }}
                  placeholder="BRTH-CAT-YYMM-NNN" />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                {!showNewCat ? (
                  <select
                    value={form.category}
                    onChange={e => {
                      if (e.target.value === "__add__") {
                        setShowNewCat(true); setNewCatValue("");
                      } else {
                        const newCat = e.target.value;
                        setForm(prev => ({
                          ...prev,
                          category: newCat,
                          sku: !editProduct && skuAutoRef.current ? genSku(newCat) : prev.sku,
                        }));
                      }
                    }}
                    style={{ ...inputStyle, cursor: "pointer" }}>
                    <option value="">Select category…</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    <option value="__add__">➕ Add New Category</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={newCatValue}
                      onChange={e => setNewCatValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && newCatValue.trim()) {
                          const cat = newCatValue.trim();
                          setForm(prev => ({
                            ...prev,
                            category: cat,
                            sku: !editProduct && skuAutoRef.current ? genSku(cat) : prev.sku,
                          }));
                          setShowNewCat(false);
                        }
                        if (e.key === "Escape") { setShowNewCat(false); setNewCatValue(""); }
                      }}
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="Type new category name…"
                    />
                    <button type="button"
                      onClick={() => {
                        const cat = newCatValue.trim();
                        if (cat) {
                          setForm(prev => ({
                            ...prev,
                            category: cat,
                            sku: !editProduct && skuAutoRef.current ? genSku(cat) : prev.sku,
                          }));
                        }
                        setShowNewCat(false);
                      }}
                      className="px-3 py-2 text-xs font-bold rounded-lg flex-shrink-0"
                      style={{ background: "#41afeb", color: "#fff", border: "none", cursor: "pointer" }}>
                      Add
                    </button>
                    <button type="button"
                      onClick={() => { setShowNewCat(false); setNewCatValue(""); }}
                      className="px-2 py-2 text-xs rounded-lg flex-shrink-0"
                      style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "#fff", cursor: "pointer" }}>
                      ✕
                    </button>
                  </div>
                )}
                {form.category && !showNewCat && (
                  <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>
                    Selected: <span style={{ color: "#41afeb", fontWeight: 600 }}>{form.category}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>Retail Price (TWD) *</label>
                <input type="number" min="0" value={form.retailPrice}
                  onChange={e => setForm({ ...form, retailPrice: e.target.value })}
                  style={formErrors.retailPrice ? errInputStyle : inputStyle} placeholder="0" />
                {formErrors.retailPrice && <p className="text-xs mt-0.5" style={{ color: "#dc2626" }}>{formErrors.retailPrice}</p>}
              </div>
              <div>
                <label style={labelStyle}>Bearth Price (TWD) *</label>
                <input type="number" min="0" value={form.presalePrice}
                  onChange={e => setForm({ ...form, presalePrice: e.target.value })}
                  style={formErrors.presalePrice ? errInputStyle : inputStyle} placeholder="0" />
                {formErrors.presalePrice && <p className="text-xs mt-0.5" style={{ color: "#dc2626" }}>{formErrors.presalePrice}</p>}
              </div>
            </div>

            {/* Stock / Sort / Status */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label style={labelStyle}>Stock Qty</label>
                <input type="number" min="0" value={form.stockQty}
                  onChange={e => setForm({ ...form, stockQty: e.target.value })}
                  style={formErrors.stockQty ? errInputStyle : inputStyle} placeholder="0" />
                {formErrors.stockQty && <p className="text-xs mt-0.5" style={{ color: "#dc2626" }}>{formErrors.stockQty}</p>}
              </div>
              <div>
                <label style={labelStyle}>Sort Order</label>
                <input type="number" min="0" value={form.sortOrder}
                  onChange={e => setForm({ ...form, sortOrder: e.target.value })}
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

            {/* Description */}
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
            <button onClick={handleSave} disabled={saving || uploadingImage}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg"
              style={{ background: saving || uploadingImage ? "#9bafc5" : "#41afeb" }}>
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

      {/* ══ Product Detail Modal ════════════════════════════════════════════════ */}
      {detailProduct && (
        <Modal onClose={() => setDetailProduct(null)} title="Product Details" wide>
          <div className="flex gap-6 flex-wrap">
            {/* Image */}
            <div className="flex-shrink-0" style={{ cursor: detailProduct.imageUrl ? "zoom-in" : "default" }}
              onClick={() => detailProduct.imageUrl && setLightboxUrl(detailProduct.imageUrl)}>
              <ProductImage url={detailProduct.imageUrl} size={220} zoom />
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0 space-y-4">
              <div>
                <h2 className="text-xl font-extrabold leading-tight" style={{ color: "#24315f" }}>{detailProduct.name}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {detailProduct.sku && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{ background: "#f3f4f6", color: "#6b7280" }}>{detailProduct.sku}</span>
                  )}
                  {detailProduct.category && (
                    <span className="px-2 py-0.5 rounded text-xs font-semibold"
                      style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>{detailProduct.category}</span>
                  )}
                  <StatusBadge code={detailProduct.statusCode} name={detailProduct.statusName} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={{ border: "1px solid #e5e7eb", borderLeft: "3px solid #6b7280" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>MRP Price</p>
                  <p className="text-lg font-extrabold mt-0.5" style={{ color: "#374151" }}>
                    TWD {Number(detailProduct.retailPrice).toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl p-3" style={{ border: "1px solid #e5e7eb", borderLeft: "3px solid #24315f" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Bearth Price</p>
                  <p className="text-lg font-extrabold mt-0.5" style={{ color: "#24315f" }}>
                    TWD {Number(detailProduct.presalePrice).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Stock</p>
                  <div className="mt-0.5"><StockBadge qty={detailProduct.stockQty ?? 0} /></div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Last Updated</p>
                  <p className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                    {new Date(detailProduct.updatedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {detailProduct.description && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#9bafc5" }}>Description</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{detailProduct.description}</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => { setDetailProduct(null); openEdit(detailProduct); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg"
              style={{ border: "1px solid #41afeb", color: "#41afeb", background: "#fff" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Product
            </button>
            <button onClick={() => setDetailProduct(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Close</button>
          </div>
        </Modal>
      )}

      {/* ══ QR Code Modal ══════════════════════════════════════════════════════ */}
      {qrProduct && (
        <Modal onClose={() => { setQrProduct(null); setQrDataUrl(""); }} title="Product QR Code" small>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="p-1 rounded-xl" style={{ border: "1px solid #e5e7eb" }}>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR Code" style={{ width: 220, height: 220, display: "block", borderRadius: 8 }} />
              ) : (
                <div className="flex items-center justify-center" style={{ width: 220, height: 220, color: "#9bafc5" }}>
                  Generating…
                </div>
              )}
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm" style={{ color: "#111827" }}>{qrProduct.name}</p>
              {qrProduct.sku && <p className="text-xs font-mono mt-0.5" style={{ color: "#9bafc5" }}>{qrProduct.sku}</p>}
              <p className="text-xs mt-2" style={{ color: "#6b7280" }}>
                Scans to: <span className="font-mono break-all" style={{ color: "#41afeb" }}>
                  {STORE_URL}/products/{qrProduct.sku || qrProduct.id}
                </span>
              </p>
              <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>
                Customers scan to view product info &amp; purchase (registration required)
              </p>
            </div>
            <button onClick={downloadQR} disabled={!qrDataUrl}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white"
              style={{ background: "#7c3aed" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download QR PNG
            </button>
          </div>
        </Modal>
      )}

      {/* ══ Excel Import Modal ══════════════════════════════════════════════════ */}
      {showImportModal && (
        <Modal onClose={() => { setShowImportModal(false); setImportRows([]); setImportError(null); }}
          title="Import Products from Excel" wide>
          <div className="space-y-4">
            {/* Template download + file picker */}
            <div className="p-4 rounded-xl flex items-start justify-between gap-4 flex-wrap"
              style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <div>
                <p className="text-sm font-semibold" style={{ color: "#24315f" }}>Upload Excel File</p>
                <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
                  Required columns: <strong>Name</strong>, <strong>Retail Price (TWD)</strong>, <strong>Bearth Price (TWD)</strong>.
                  Optional: SKU, Category, Stock Qty, Description. Max 500 rows.
                </p>
              </div>
              <button onClick={downloadTemplate}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold shrink-0"
                style={{ border: "1px solid #41afeb", color: "#41afeb", background: "#fff" }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Template
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input ref={importInputRef} type="file" accept=".xlsx,.xls"
                style={{ display: "none" }} onChange={handleImportFile} />
              <button type="button" disabled={importLoading}
                onClick={() => importInputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ border: "1px solid #e5e7eb", color: "#24315f", background: "#fff" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
                </svg>
                {importLoading ? "Parsing…" : "Select Excel File"}
              </button>
              {importRows.length > 0 && (
                <span className="text-xs" style={{ color: "#6b7280" }}>
                  {importRows.length} rows parsed —{" "}
                  <span style={{ color: "#16a34a" }}>{importRows.filter(r => r._errors.length === 0).length} valid</span>
                  {importRows.filter(r => r._errors.length > 0).length > 0 && (
                    <span style={{ color: "#dc2626" }}>, {importRows.filter(r => r._errors.length > 0).length} with errors</span>
                  )}
                </span>
              )}
            </div>

            {importError && <ErrorBanner msg={importError} />}

            {/* Preview table */}
            {importRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid #e5e7eb" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {["Row", "Name", "SKU", "Category", "Retail (TWD)", "Bearth (TWD)", "Stock", "Status"].map(h => (
                        <th key={h} style={{ ...thStyle, background: "none", padding: "8px 10px", fontSize: 10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map(r => (
                      <tr key={r._rowNum}
                        style={{ borderTop: "1px solid #f3f4f6", background: r._errors.length > 0 ? "#fef2f2" : "transparent" }}>
                        <td style={{ padding: "6px 10px", color: "#9bafc5" }}>{r._rowNum}</td>
                        <td style={{ padding: "6px 10px", fontWeight: 600, color: r.name ? "#111827" : "#dc2626" }}>
                          {r.name || "—"}
                        </td>
                        <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#6b7280" }}>{r.sku || <em style={{ color: "#9bafc5" }}>auto</em>}</td>
                        <td style={{ padding: "6px 10px", color: "#6b7280" }}>{r.category || "—"}</td>
                        <td style={{ padding: "6px 10px", textAlign: "right", color: r.retailPrice !== undefined ? "#374151" : "#dc2626" }}>
                          {r.retailPrice !== undefined ? r.retailPrice.toLocaleString() : "—"}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, color: r.presalePrice !== undefined ? "#24315f" : "#dc2626" }}>
                          {r.presalePrice !== undefined ? r.presalePrice.toLocaleString() : "—"}
                        </td>
                        <td style={{ padding: "6px 10px", textAlign: "center", color: "#6b7280" }}>{r.stockQty ?? 0}</td>
                        <td style={{ padding: "6px 10px" }}>
                          {r._errors.length > 0 ? (
                            <span className="flex items-center gap-1" style={{ color: "#dc2626" }}>
                              <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              {r._errors.join("; ")}
                            </span>
                          ) : (
                            <span style={{ color: "#16a34a" }}>✓ Valid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between pt-4 flex-wrap gap-3"
            style={{ borderTop: "1px solid #e5e7eb", marginTop: "16px" }}>
            <p className="text-xs" style={{ color: "#9bafc5" }}>
              {importRows.filter(r => r._errors.length > 0).length > 0
                ? "Rows with errors will be skipped."
                : importRows.length > 0 ? `${importRows.length} rows will be imported.` : ""}
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowImportModal(false); setImportRows([]); setImportError(null); }}
                className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button onClick={handleConfirmImport}
                disabled={importing || importRows.filter(r => r._errors.length === 0).length === 0}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: importing || importRows.filter(r => r._errors.length === 0).length === 0 ? "#9bafc5" : "#16a34a" }}>
                {importing ? "Importing…" : `Import ${importRows.filter(r => r._errors.length === 0).length} Products`}
              </button>
            </div>
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
                placeholder="e.g. PO #1234, damaged items…" />
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

      {/* ══ Image Lightbox ════════════════════════════════════════════════════ */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }}
          onClick={() => setLightboxUrl(null)}>
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 p-2 rounded-full"
            style={{ background: "rgba(255,255,255,0.15)", color: "#fff" }}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxUrl}
            alt="Product"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: "88vw", maxHeight: "88vh",
              borderRadius: 16, boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              objectFit: "contain",
            }} />
        </div>
      )}

      {/* ══ Stock History Modal ════════════════════════════════════════════════ */}
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
    <div className="bg-white rounded-xl shadow-sm"
      style={{ border: "1px solid #e5e7eb", borderLeft: `3px solid ${color}`, padding: "14px 16px" }}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#9bafc5" }}>{label}</p>
      <p className={`font-extrabold leading-none ${small ? "text-base" : "text-2xl"}`} style={{ color }}>{value}</p>
    </div>
  );
}

function Modal({ children, onClose, title, small, wide }:
  { children: React.ReactNode; onClose: () => void; title: string; small?: boolean; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl flex flex-col"
        style={{ width: "100%", maxWidth: wide ? 780 : small ? 400 : 560, maxHeight: "90vh", border: "1px solid #e5e7eb" }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid #e5e7eb" }}>
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
    qr:         "M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z",
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
