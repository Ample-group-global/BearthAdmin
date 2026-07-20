"use client";

import { useEffect, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryOverview {
  totalProducts: number;
  activeProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  totalInventoryValue: number;
  pendingPos: number;
  openFulfillments: number;
  pendingReturns: number;
  totalReserved: number;
  totalAvailable: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier?: string | null;
  status: string;
  notes?: string | null;
  expectedDate?: string | null;
  createdAt: string;
  itemCount: number;
  totalCost?: number | null;
}

interface POItem {
  productId: string;
  productName: string;
  sku?: string | null;
  orderedQty: number;
  receivedQty: number;
  unitCost?: number | null;
}

interface StockMovement {
  id: string;
  productName: string;
  sku?: string | null;
  changeQty: number;
  previousQty: number;
  newQty: number;
  reason: string;
  reasonLabel?: string | null;
  notes?: string | null;
  adjustedByName?: string | null;
  createdAt: string;
}

interface ReturnItem {
  id: string;
  orderId: string;
  productName: string;
  sku?: string | null;
  quantity: number;
  reason: string;
  condition: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  processedAt?: string | null;
}

type Tab = "overview" | "purchase-orders" | "stock-movements" | "returns";

const PO_STATUSES = ["draft", "ordered", "partial", "received", "cancelled"];
const RETURN_STATUSES = ["pending", "approved", "rejected", "processed"];
const RETURN_CONDITIONS = ["sellable", "damaged", "destroyed"];
const RETURN_REASONS = ["customer_return", "damaged_in_transit", "wrong_item", "defective", "other"];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm"
      style={{ border: "1px solid #e5e7eb", borderLeft: `3px solid ${color}`, padding: "14px 16px" }}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#9bafc5" }}>{label}</p>
      <p className="text-2xl font-extrabold leading-none" style={{ color }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>{sub}</p>}
    </div>
  );
}

function Badge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    draft:     ["rgba(156,163,175,0.12)", "#9ca3af"],
    ordered:   ["rgba(65,175,235,0.1)",   "#41afeb"],
    partial:   ["rgba(217,119,6,0.1)",    "#d97706"],
    received:  ["rgba(22,163,74,0.1)",    "#16a34a"],
    cancelled: ["rgba(220,38,38,0.1)",    "#dc2626"],
    pending:   ["rgba(217,119,6,0.1)",    "#d97706"],
    approved:  ["rgba(22,163,74,0.1)",    "#16a34a"],
    rejected:  ["rgba(220,38,38,0.1)",    "#dc2626"],
    processed: ["rgba(124,58,237,0.1)",   "#7c3aed"],
    sellable:  ["rgba(22,163,74,0.1)",    "#16a34a"],
    damaged:   ["rgba(220,38,38,0.1)",    "#dc2626"],
    destroyed: ["rgba(107,114,128,0.12)", "#6b7280"],
  };
  const [bg, color] = map[status?.toLowerCase()] ?? ["rgba(156,163,175,0.12)", "#9ca3af"];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: bg, color }}>
      {status}
    </span>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl flex flex-col"
        style={{ width: "100%", maxWidth: wide ? 860 : 560, maxHeight: "90vh", border: "1px solid #e5e7eb" }}>
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

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
      {msg}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16" style={{ color: "#9bafc5" }}>
      <svg className="w-10 h-10 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4m4-5h8" />
      </svg>
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("overview");

  // Overview
  const [overview, setOverview] = useState<InventoryOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // Purchase Orders
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [posLoading, setPosLoading] = useState(false);
  const [posFilter, setPosFilter] = useState("");
  const [poDetail, setPoDetail] = useState<{ po: PurchaseOrder; items: POItem[] } | null>(null);
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [showReceivePO, setShowReceivePO] = useState<PurchaseOrder | null>(null);
  const [poForm, setPoForm] = useState({ poNumber: "", supplier: "", notes: "", expectedDate: "" });
  const [poItems, setPoItems] = useState<Array<{ productId: string; productName: string; qty: string; unitCost: string }>>([]);
  const [receiveItems, setReceiveItems] = useState<Array<{ productId: string; productName: string; ordered: number; received: string }>>([]);
  const [poSaving, setPoSaving] = useState(false);
  const [poError, setPoError] = useState<string | null>(null);

  // Stock Movements
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [movTotal, setMovTotal] = useState(0);
  const [movOffset, setMovOffset] = useState(0);

  // Returns
  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [returnsLoading, setReturnsLoading] = useState(false);
  const [returnsFilter, setReturnsFilter] = useState("");
  const [showCreateReturn, setShowCreateReturn] = useState(false);
  const [returnForm, setReturnForm] = useState({
    orderId: "", productId: "", quantity: "1", reason: "customer_return", condition: "sellable", notes: "",
  });
  const [returnSaving, setReturnSaving] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [processingReturn, setProcessingReturn] = useState<ReturnItem | null>(null);
  const [processStatus, setProcessStatus] = useState<"approved" | "rejected" | "processed">("approved");

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

  // ── Data Loaders ─────────────────────────────────────────────────────────────

  const loadOverview = useCallback(() => {
    setOverviewLoading(true);
    fetch("/api/inventory", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setOverview(d.overview ?? d); setOverviewLoading(false); })
      .catch(() => setOverviewLoading(false));
  }, []);

  const loadPOs = useCallback((status = posFilter) => {
    setPosLoading(true);
    const params = new URLSearchParams({ limit: "50", offset: "0" });
    if (status) params.set("status", status);
    fetch(`/api/inventory/purchase-orders?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setPos(d.purchaseOrders ?? d.orders ?? []); setPosLoading(false); })
      .catch(() => setPosLoading(false));
  }, [posFilter]);

  const loadMovements = useCallback((offset = 0) => {
    setMovementsLoading(true);
    fetch(`/api/inventory/stock-movements?limit=50&offset=${offset}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setMovements(d.movements ?? []); setMovTotal(d.total ?? 0); setMovementsLoading(false); })
      .catch(() => setMovementsLoading(false));
  }, []);

  const loadReturns = useCallback((status = returnsFilter) => {
    setReturnsLoading(true);
    const params = new URLSearchParams({ limit: "50", offset: "0" });
    if (status) params.set("status", status);
    fetch(`/api/inventory/returns?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setReturns(d.returns ?? []); setReturnsLoading(false); })
      .catch(() => setReturnsLoading(false));
  }, [returnsFilter]);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  useEffect(() => {
    if (tab === "purchase-orders") loadPOs();
    if (tab === "stock-movements") loadMovements();
    if (tab === "returns") loadReturns();
  }, [tab]);

  // ── PO Actions ────────────────────────────────────────────────────────────────

  const openPODetail = async (po: PurchaseOrder) => {
    const res = await fetch(`/api/inventory/purchase-orders/${po.id}`, { credentials: "include" });
    const d = await res.json();
    const detail = d.purchaseOrder ?? d.po ?? po;
    setPoDetail({ po: detail, items: detail.items ?? d.items ?? [] });
  };

  const handleCreatePO = async () => {
    if (!poForm.poNumber.trim()) { setPoError("PO Number is required."); return; }
    const validItems = poItems.filter(i => i.productId && Number(i.qty) > 0);
    if (validItems.length === 0) { setPoError("At least one item with product ID and quantity is required."); return; }
    setPoSaving(true); setPoError(null);
    try {
      const body = {
        poNumber: poForm.poNumber.trim(),
        supplier: poForm.supplier || undefined,
        notes: poForm.notes || undefined,
        expectedDate: poForm.expectedDate || undefined,
        items: validItems.map(i => ({
          productId: i.productId.trim(),
          orderedQty: Number(i.qty),
          unitCost: i.unitCost ? Number(i.unitCost) : undefined,
        })),
      };
      const res = await fetch("/api/inventory/purchase-orders", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setPoError(d.error ?? "Failed to create PO."); return; }
      setShowCreatePO(false);
      setPoForm({ poNumber: "", supplier: "", notes: "", expectedDate: "" });
      setPoItems([]);
      loadPOs(); loadOverview();
    } catch { setPoError("Network error."); }
    finally { setPoSaving(false); }
  };

  const openReceivePO = (po: PurchaseOrder) => {
    setShowReceivePO(po);
    fetch(`/api/inventory/purchase-orders/${po.id}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        setReceiveItems((d.items ?? []).map((i: POItem) => ({
          productId: i.productId,
          productName: i.productName,
          ordered: i.orderedQty,
          received: String(i.orderedQty - (i.receivedQty ?? 0)),
        })));
      });
  };

  const handleReceivePO = async () => {
    if (!showReceivePO) return;
    setPoSaving(true); setPoError(null);
    try {
      const body = {
        items: receiveItems
          .filter(i => Number(i.received) > 0)
          .map(i => ({ productId: i.productId, receivedQty: Number(i.received) })),
      };
      const res = await fetch(`/api/inventory/purchase-orders/${showReceivePO.id}/receive`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setPoError(d.error ?? "Failed to receive PO."); return; }
      setShowReceivePO(null); setReceiveItems([]);
      loadPOs(); loadOverview();
    } catch { setPoError("Network error."); }
    finally { setPoSaving(false); }
  };

  // ── Return Actions ────────────────────────────────────────────────────────────

  const handleCreateReturn = async () => {
    if (!returnForm.orderId.trim()) { setReturnError("Order ID is required."); return; }
    if (!returnForm.productId.trim()) { setReturnError("Product ID is required."); return; }
    if (!returnForm.quantity || Number(returnForm.quantity) < 1) { setReturnError("Quantity must be at least 1."); return; }
    setReturnSaving(true); setReturnError(null);
    try {
      const res = await fetch("/api/inventory/returns", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: returnForm.orderId.trim(),
          productId: returnForm.productId.trim(),
          quantity: Number(returnForm.quantity),
          reason: returnForm.reason,
          condition: returnForm.condition,
          notes: returnForm.notes || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json(); setReturnError(d.error ?? "Failed to create return."); return; }
      setShowCreateReturn(false);
      setReturnForm({ orderId: "", productId: "", quantity: "1", reason: "customer_return", condition: "sellable", notes: "" });
      loadReturns(); loadOverview();
    } catch { setReturnError("Network error."); }
    finally { setReturnSaving(false); }
  };

  const handleProcessReturn = async () => {
    if (!processingReturn) return;
    setReturnSaving(true); setReturnError(null);
    try {
      const res = await fetch(`/api/inventory/returns/${processingReturn.id}/process`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: processStatus }),
      });
      if (!res.ok) { const d = await res.json(); setReturnError(d.error ?? "Failed to process return."); return; }
      setProcessingReturn(null);
      loadReturns(); loadOverview();
    } catch { setReturnError("Network error."); }
    finally { setReturnSaving(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "overview",        label: "Overview",         icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { id: "purchase-orders", label: "Purchase Orders",  icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
    { id: "stock-movements", label: "Stock Movements",  icon: "M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" },
    { id: "returns",         label: "Returns",          icon: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" },
  ];

  return (
    <div className="p-5 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>Inventory Management</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            Purchase orders, stock movements, returns &amp; restocking
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "#f3f4f6" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all flex-1 justify-center"
            style={{
              background: tab === t.id ? "#fff" : "transparent",
              color: tab === t.id ? "#24315f" : "#9bafc5",
              boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}>
            <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
            </svg>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ══ Overview Tab ══════════════════════════════════════════════════════════ */}
      {tab === "overview" && (
        <div className="space-y-5">
          {overviewLoading ? (
            <div className="flex items-center justify-center h-40" style={{ color: "#9bafc5" }}>
              <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading overview…
            </div>
          ) : overview ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total Products"   value={overview.totalProducts}       color="#41afeb" />
                <StatCard label="Active"           value={overview.activeProducts}      color="#16a34a" />
                <StatCard label="Low Stock"        value={overview.lowStockProducts}    color="#d97706" />
                <StatCard label="Out of Stock"     value={overview.outOfStockProducts}  color="#dc2626" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total Stock (Units)" value={overview.totalAvailable + overview.totalReserved} color="#24315f" />
                <StatCard label="Available to Sell"   value={overview.totalAvailable ?? 0} color="#16a34a"
                  sub="stock minus reserved" />
                <StatCard label="Reserved (Pending Fulfillment)" value={overview.totalReserved ?? 0} color="#d97706"
                  sub="confirmed, not shipped" />
                <StatCard label="Open Fulfillments"  value={overview.openFulfillments ?? 0} color="#41afeb" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                <div className="bg-white rounded-xl p-4" style={{ border: "1px solid #e5e7eb" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#9bafc5" }}>Inventory Value (Bearth Price)</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "#6b7280" }}>Total Presale Value</span>
                      <span className="text-sm font-extrabold" style={{ color: "#24315f" }}>
                        TWD {Number(overview.totalInventoryValue ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4" style={{ border: "1px solid #e5e7eb" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#9bafc5" }}>Pending Actions</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "#6b7280" }}>Purchase Orders</span>
                      <span className="text-sm font-bold"
                        style={{ color: (overview.pendingPos ?? 0) > 0 ? "#d97706" : "#16a34a" }}>
                        {overview.pendingPos ?? 0} pending
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs" style={{ color: "#6b7280" }}>Returns to Process</span>
                      <span className="text-sm font-bold"
                        style={{ color: (overview.pendingReturns ?? 0) > 0 ? "#dc2626" : "#16a34a" }}>
                        {overview.pendingReturns ?? 0} pending
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={() => setTab("purchase-orders")}
                  className="flex items-center justify-between p-4 bg-white rounded-xl text-left transition-all"
                  style={{ border: "1px solid #e5e7eb" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#41afeb"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#e5e7eb"}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#24315f" }}>Purchase Orders</p>
                    <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Manage restocking from suppliers</p>
                  </div>
                  <svg className="w-5 h-5" style={{ color: "#41afeb" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <button onClick={() => setTab("stock-movements")}
                  className="flex items-center justify-between p-4 bg-white rounded-xl text-left transition-all"
                  style={{ border: "1px solid #e5e7eb" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#41afeb"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#e5e7eb"}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#24315f" }}>Stock Movements</p>
                    <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Full audit trail of all stock changes</p>
                  </div>
                  <svg className="w-5 h-5" style={{ color: "#41afeb" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </>
          ) : (
            <EmptyState message="Could not load inventory overview. Run DB migration if this is a first-time setup." />
          )}
        </div>
      )}

      {/* ══ Purchase Orders Tab ═══════════════════════════════════════════════════ */}
      {tab === "purchase-orders" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <select value={posFilter}
                onChange={e => { setPosFilter(e.target.value); loadPOs(e.target.value); }}
                className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
                style={{ border: "1px solid #e5e7eb", color: posFilter ? "#111827" : "#9bafc5" }}>
                <option value="">All Statuses</option>
                {PO_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <button onClick={() => { setShowCreatePO(true); setPoError(null); setPoForm({ poNumber: "", supplier: "", notes: "", expectedDate: "" }); setPoItems([{ productId: "", productName: "", qty: "", unitCost: "" }]); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
              style={{ background: "#41afeb" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Purchase Order
            </button>
          </div>

          {posLoading ? (
            <div className="flex items-center justify-center h-32" style={{ color: "#9bafc5" }}>
              <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading…
            </div>
          ) : pos.length === 0 ? (
            <EmptyState message="No purchase orders found" />
          ) : (
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {["PO Number", "Supplier", "Items", "Expected", "Status", "Created", "Actions"].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pos.map((po, i) => (
                    <tr key={po.id} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <span className="font-mono font-semibold text-xs" style={{ color: "#24315f" }}>{po.poNumber}</span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 12 }}>{po.supplier || "—"}</td>
                      <td style={{ padding: "10px 14px", textAlign: "center", fontSize: 12 }}>
                        <span style={{ color: "#374151" }}>{po.itemCount ?? 0} items</span>
                        {po.totalCost != null && (
                          <div className="text-[10px]" style={{ color: "#9bafc5" }}>
                            TWD {Number(po.totalCost).toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>
                        {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : "—"}
                      </td>
                      <td style={{ padding: "10px 14px" }}><Badge status={po.status} /></td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>
                        {new Date(po.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openPODetail(po)}
                            className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ border: "1px solid #e5e7eb", color: "#41afeb", background: "#fff" }}>
                            View
                          </button>
                          {(po.status === "ordered" || po.status === "partial") && (
                            <button onClick={() => openReceivePO(po)}
                              className="px-2 py-1 rounded text-xs font-semibold"
                              style={{ border: "1px solid #16a34a", color: "#16a34a", background: "#fff" }}>
                              Receive
                            </button>
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
      )}

      {/* ══ Stock Movements Tab ═══════════════════════════════════════════════════ */}
      {tab === "stock-movements" && (
        <div className="space-y-4">
          {movementsLoading ? (
            <div className="flex items-center justify-center h-32" style={{ color: "#9bafc5" }}>
              <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading…
            </div>
          ) : movements.length === 0 ? (
            <EmptyState message="No stock movements recorded yet" />
          ) : (
            <>
              <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      {["Date", "Product", "Change", "Before → After", "Reason", "Notes", "By"].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m, i) => (
                      <tr key={m.id} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                        <td style={{ padding: "8px 14px", fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
                          {new Date(m.createdAt).toLocaleString()}
                        </td>
                        <td style={{ padding: "8px 14px" }}>
                          <div className="font-semibold text-xs" style={{ color: "#111827" }}>{m.productName}</div>
                          {m.sku && <div className="font-mono text-[10px]" style={{ color: "#9bafc5" }}>{m.sku}</div>}
                        </td>
                        <td style={{ padding: "8px 14px", textAlign: "center" }}>
                          <span className="font-bold text-sm" style={{ color: m.changeQty >= 0 ? "#16a34a" : "#dc2626" }}>
                            {m.changeQty >= 0 ? `+${m.changeQty}` : m.changeQty}
                          </span>
                        </td>
                        <td style={{ padding: "8px 14px", textAlign: "center", fontSize: 12, color: "#6b7280" }}>
                          {m.previousQty} → <strong style={{ color: "#24315f" }}>{m.newQty}</strong>
                        </td>
                        <td style={{ padding: "8px 14px" }}>
                          <span className="px-2 py-0.5 rounded text-xs font-semibold"
                            style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>
                            {m.reasonLabel ?? m.reason}
                          </span>
                        </td>
                        <td style={{ padding: "8px 14px", fontSize: 11, color: "#6b7280" }}>{m.notes ?? "—"}</td>
                        <td style={{ padding: "8px 14px", fontSize: 11, color: "#6b7280" }}>{m.adjustedByName ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {movTotal > 50 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#9bafc5" }}>Showing {movOffset + 1}–{Math.min(movOffset + 50, movTotal)} of {movTotal}</span>
                  <div className="flex gap-2">
                    <button disabled={movOffset === 0}
                      onClick={() => { const o = Math.max(0, movOffset - 50); setMovOffset(o); loadMovements(o); }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                      style={{ border: "1px solid #e5e7eb", color: movOffset === 0 ? "#d1d5db" : "#6b7280", background: "#fff" }}>
                      Previous
                    </button>
                    <button disabled={movOffset + 50 >= movTotal}
                      onClick={() => { const o = movOffset + 50; setMovOffset(o); loadMovements(o); }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg"
                      style={{ border: "1px solid #e5e7eb", color: movOffset + 50 >= movTotal ? "#d1d5db" : "#6b7280", background: "#fff" }}>
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ Returns Tab ═══════════════════════════════════════════════════════════ */}
      {tab === "returns" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <select value={returnsFilter}
              onChange={e => { setReturnsFilter(e.target.value); loadReturns(e.target.value); }}
              className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
              style={{ border: "1px solid #e5e7eb", color: returnsFilter ? "#111827" : "#9bafc5" }}>
              <option value="">All Statuses</option>
              {RETURN_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <button onClick={() => { setShowCreateReturn(true); setReturnError(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
              style={{ background: "#41afeb" }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Record Return
            </button>
          </div>

          {returnsLoading ? (
            <div className="flex items-center justify-center h-32" style={{ color: "#9bafc5" }}>
              <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Loading…
            </div>
          ) : returns.length === 0 ? (
            <EmptyState message="No returns found" />
          ) : (
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {["Order ID", "Product", "Qty", "Reason", "Condition", "Status", "Date", "Actions"].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {returns.map((r, i) => (
                    <tr key={r.id} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#6b7280" }}>
                        {r.orderId.slice(0, 8)}…
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div className="font-semibold text-xs" style={{ color: "#111827" }}>{r.productName}</div>
                        {r.sku && <div className="font-mono text-[10px]" style={{ color: "#9bafc5" }}>{r.sku}</div>}
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 700, color: "#24315f" }}>{r.quantity}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#6b7280" }}>
                        {r.reason.replace(/_/g, " ")}
                      </td>
                      <td style={{ padding: "10px 14px" }}><Badge status={r.condition} /></td>
                      <td style={{ padding: "10px 14px" }}><Badge status={r.status} /></td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "#6b7280" }}>
                        {new Date(r.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {r.status === "pending" && (
                          <button onClick={() => { setProcessingReturn(r); setProcessStatus("approved"); setReturnError(null); }}
                            className="px-2 py-1 rounded text-xs font-semibold"
                            style={{ border: "1px solid #16a34a", color: "#16a34a", background: "#fff" }}>
                            Process
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ Create PO Modal ════════════════════════════════════════════════════════ */}
      {showCreatePO && (
        <Modal title="New Purchase Order" onClose={() => setShowCreatePO(false)} wide>
          <div className="space-y-4">
            {poError && <ErrorBanner msg={poError} />}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label style={labelStyle}>PO Number *</label>
                <input value={poForm.poNumber} onChange={e => setPoForm({ ...poForm, poNumber: e.target.value })}
                  style={inputStyle} placeholder="PO-2026-001" />
              </div>
              <div>
                <label style={labelStyle}>Supplier</label>
                <input value={poForm.supplier} onChange={e => setPoForm({ ...poForm, supplier: e.target.value })}
                  style={inputStyle} placeholder="Supplier name" />
              </div>
              <div>
                <label style={labelStyle}>Expected Delivery</label>
                <input type="date" value={poForm.expectedDate} onChange={e => setPoForm({ ...poForm, expectedDate: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <input value={poForm.notes} onChange={e => setPoForm({ ...poForm, notes: e.target.value })}
                  style={inputStyle} placeholder="Optional notes" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label style={{ ...labelStyle, marginBottom: 0 }}>Items</label>
                <button type="button"
                  onClick={() => setPoItems(prev => [...prev, { productId: "", productName: "", qty: "", unitCost: "" }])}
                  className="text-xs font-semibold" style={{ color: "#41afeb" }}>
                  + Add Item
                </button>
              </div>
              <div className="space-y-2">
                {poItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <input value={item.productId}
                      onChange={e => setPoItems(prev => prev.map((p, i) => i === idx ? { ...p, productId: e.target.value } : p))}
                      style={{ ...inputStyle, flex: 2 }} placeholder="Product ID (UUID)" />
                    <input type="number" min="1" value={item.qty}
                      onChange={e => setPoItems(prev => prev.map((p, i) => i === idx ? { ...p, qty: e.target.value } : p))}
                      style={{ ...inputStyle, flex: 1 }} placeholder="Qty" />
                    <input type="number" min="0" value={item.unitCost}
                      onChange={e => setPoItems(prev => prev.map((p, i) => i === idx ? { ...p, unitCost: e.target.value } : p))}
                      style={{ ...inputStyle, flex: 1 }} placeholder="Unit Cost" />
                    <button type="button"
                      onClick={() => setPoItems(prev => prev.filter((_, i) => i !== idx))}
                      className="px-2 py-2 rounded-lg text-xs flex-shrink-0"
                      style={{ border: "1px solid #fecaca", color: "#dc2626", background: "#fff" }}>✕</button>
                  </div>
                ))}
              </div>
              <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>Use product UUIDs from the Products page</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => setShowCreatePO(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
            <button onClick={handleCreatePO} disabled={poSaving}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg"
              style={{ background: poSaving ? "#9bafc5" : "#41afeb" }}>
              {poSaving ? "Creating…" : "Create PO"}
            </button>
          </div>
        </Modal>
      )}

      {/* ══ PO Detail Modal ════════════════════════════════════════════════════════ */}
      {poDetail && (
        <Modal title={`PO Details — ${poDetail.po.poNumber}`} onClose={() => setPoDetail(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 p-3 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Supplier</p>
                <p className="text-sm font-semibold mt-0.5" style={{ color: "#111827" }}>{poDetail.po.supplier || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Status</p>
                <div className="mt-0.5"><Badge status={poDetail.po.status} /></div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Expected</p>
                <p className="text-sm mt-0.5" style={{ color: "#6b7280" }}>
                  {poDetail.po.expectedDate ? new Date(poDetail.po.expectedDate).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>

            {poDetail.items.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {["Product", "Ordered Qty", "Received Qty", "Unit Cost"].map(h => (
                      <th key={h} style={{ ...thStyle, background: "none" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {poDetail.items.map((item, i) => (
                    <tr key={item.productId} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 14px" }}>
                        <div className="font-semibold text-xs" style={{ color: "#111827" }}>{item.productName}</div>
                        {item.sku && <div className="font-mono text-[10px]" style={{ color: "#9bafc5" }}>{item.sku}</div>}
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "center", color: "#374151" }}>{item.orderedQty}</td>
                      <td style={{ padding: "8px 14px", textAlign: "center" }}>
                        <span style={{ color: item.receivedQty >= item.orderedQty ? "#16a34a" : "#d97706", fontWeight: 700 }}>
                          {item.receivedQty}
                        </span>
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "right", color: "#6b7280" }}>
                        {item.unitCost != null ? `TWD ${Number(item.unitCost).toLocaleString()}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex justify-end pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => setPoDetail(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Close</button>
          </div>
        </Modal>
      )}

      {/* ══ Receive PO Modal ═══════════════════════════════════════════════════════ */}
      {showReceivePO && (
        <Modal title={`Receive Stock — ${showReceivePO.poNumber}`} onClose={() => { setShowReceivePO(null); setReceiveItems([]); }} wide>
          <div className="space-y-4">
            {poError && <ErrorBanner msg={poError} />}
            <p className="text-sm" style={{ color: "#6b7280" }}>
              Enter the quantity received for each item. Stock will be updated automatically.
            </p>
            {receiveItems.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    {["Product", "Ordered", "Receive Qty"].map(h => (
                      <th key={h} style={{ ...thStyle, background: "none" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {receiveItems.map((item, i) => (
                    <tr key={item.productId} style={{ borderTop: i === 0 ? "none" : "1px solid #f3f4f6" }}>
                      <td style={{ padding: "8px 14px", fontWeight: 600, fontSize: 13, color: "#111827" }}>
                        {item.productName}
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "center", color: "#6b7280" }}>{item.ordered}</td>
                      <td style={{ padding: "8px 14px" }}>
                        <input type="number" min="0" max={String(item.ordered)}
                          value={item.received}
                          onChange={e => setReceiveItems(prev =>
                            prev.map((p, idx) => idx === i ? { ...p, received: e.target.value } : p)
                          )}
                          style={{ ...inputStyle, maxWidth: 100, textAlign: "center" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="flex items-center justify-center h-16" style={{ color: "#9bafc5" }}>
                <svg className="w-4 h-4 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading items…
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => { setShowReceivePO(null); setReceiveItems([]); }}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
            <button onClick={handleReceivePO} disabled={poSaving}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg"
              style={{ background: poSaving ? "#9bafc5" : "#16a34a" }}>
              {poSaving ? "Processing…" : "Confirm Receipt"}
            </button>
          </div>
        </Modal>
      )}

      {/* ══ Create Return Modal ════════════════════════════════════════════════════ */}
      {showCreateReturn && (
        <Modal title="Record Customer Return" onClose={() => setShowCreateReturn(false)}>
          <div className="space-y-4">
            {returnError && <ErrorBanner msg={returnError} />}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label style={labelStyle}>Order ID *</label>
                <input value={returnForm.orderId} onChange={e => setReturnForm({ ...returnForm, orderId: e.target.value })}
                  style={inputStyle} placeholder="Order UUID" />
              </div>
              <div className="col-span-2">
                <label style={labelStyle}>Product ID *</label>
                <input value={returnForm.productId} onChange={e => setReturnForm({ ...returnForm, productId: e.target.value })}
                  style={inputStyle} placeholder="Product UUID" />
              </div>
              <div>
                <label style={labelStyle}>Quantity *</label>
                <input type="number" min="1" value={returnForm.quantity}
                  onChange={e => setReturnForm({ ...returnForm, quantity: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Condition</label>
                <select value={returnForm.condition} onChange={e => setReturnForm({ ...returnForm, condition: e.target.value })} style={inputStyle}>
                  {RETURN_CONDITIONS.map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label style={labelStyle}>Reason</label>
                <select value={returnForm.reason} onChange={e => setReturnForm({ ...returnForm, reason: e.target.value })} style={inputStyle}>
                  {RETURN_REASONS.map(r => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label style={labelStyle}>Notes</label>
                <textarea value={returnForm.notes} onChange={e => setReturnForm({ ...returnForm, notes: e.target.value })}
                  style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} placeholder="Optional notes" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => setShowCreateReturn(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
            <button onClick={handleCreateReturn} disabled={returnSaving}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg"
              style={{ background: returnSaving ? "#9bafc5" : "#41afeb" }}>
              {returnSaving ? "Saving…" : "Record Return"}
            </button>
          </div>
        </Modal>
      )}

      {/* ══ Process Return Modal ══════════════════════════════════════════════════ */}
      {processingReturn && (
        <Modal title="Process Return" onClose={() => setProcessingReturn(null)}>
          <div className="space-y-4">
            {returnError && <ErrorBanner msg={returnError} />}
            <div className="p-3 rounded-xl" style={{ background: "#f9fafb", border: "1px solid #e5e7eb" }}>
              <p className="text-sm font-semibold" style={{ color: "#111827" }}>{processingReturn.productName}</p>
              <p className="text-xs mt-1" style={{ color: "#6b7280" }}>
                Qty: <strong>{processingReturn.quantity}</strong> &nbsp;·&nbsp;
                Reason: <strong>{processingReturn.reason.replace(/_/g, " ")}</strong> &nbsp;·&nbsp;
                Condition: <Badge status={processingReturn.condition} />
              </p>
            </div>
            <div>
              <label style={labelStyle}>Update Status To</label>
              <div className="flex gap-2 mt-1">
                {(["approved", "rejected", "processed"] as const).map(s => (
                  <button key={s} onClick={() => setProcessStatus(s)}
                    className="flex-1 py-2 text-xs font-bold rounded-lg capitalize"
                    style={{
                      background: processStatus === s
                        ? (s === "approved" ? "#16a34a" : s === "rejected" ? "#dc2626" : "#7c3aed")
                        : "#f3f4f6",
                      color: processStatus === s ? "#fff" : "#6b7280",
                      border: "none",
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => setProcessingReturn(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
            <button onClick={handleProcessReturn} disabled={returnSaving}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg"
              style={{ background: returnSaving ? "#9bafc5" : (processStatus === "rejected" ? "#dc2626" : "#16a34a") }}>
              {returnSaving ? "Processing…" : "Confirm"}
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}
