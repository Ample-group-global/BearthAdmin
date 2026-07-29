"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import DataTable, { type ColumnDef } from "@/components/DataTable";
import PaymentMethodSelect from "@/components/PaymentMethodSelect";

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderType = "nft" | "product" | "mixed";

interface Order {
  id: string;
  orderNumber: string;
  purchaseDate: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  notes: string;
  paymentNotes: string;
  nftPaymentMethodId: string;
  nftPaymentMethodCode: string;
  nftPaymentMethodName: string;
  nftAmountTwd: number;
  nftAmountEth: number;
  nftPaymentStatusId: string;
  nftPaymentStatusCode: string;
  nftPaymentStatusName: string;
  merchPaymentMethodId: string;
  merchPaymentMethodCode: string;
  merchPaymentMethodName: string;
  merchAmountTwd: number;
  merchAmountEth: number;
  merchPaymentStatusId: string;
  merchPaymentStatusCode: string;
  merchPaymentStatusName: string;
  totalCount: number;
}

interface Master {
  paymentMethods: Array<{ id: string; name: string; code: string; category: string }>;
  paymentStatuses: Array<{ id: string; name: string; code: string }>;
  currencies: Array<{ id: string; code: string; name: string }>;
}

interface Customer { id: string; name: string; phone: string; }

interface NftRecord {
  id: string;
  serialNumber: string;
  effectivePriceEth: number | null;
  stageName: string;
  typeName: string;
  waveNumber: number | null;
  waveName: string | null;
  imageIpfsHash: string | null;
}

interface ProductRecord {
  id: string;
  name: string;
  sku: string | null;
  retailPrice: number | null;
  presalePrice: number | null;
  imageUrl: string | null;
  description: string | null;
  stockQty: number | null;
}

interface NftLineItem {
  nftRecordId: string;
  serialNumber: string;
  effectivePriceEth: number | null;
  walletAddress: string;
  unitPriceTwd: string;
  unitPriceEth: string;
  imageIpfsHash: string | null;
  stageName: string;
  typeName: string;
  waveNumber: number | null;
  waveName: string | null;
}

interface ProductLineItem {
  productId: string;
  productName: string;
  retailPrice: number | null;
  presalePrice: number | null;
  quantity: string;
  unitPrice: string;
  imageUrl: string | null;
  description: string | null;
  stockQty: number | null;
}

interface OrderForm {
  orderNumber: string;
  customerId: string;
  purchaseDate: string;
  orderType: OrderType;
  nftPaymentMethodId: string;
  nftAmountTwd: string;
  nftAmountEth: string;
  nftPaymentStatusId: string;
  merchPaymentMethodId: string;
  merchAmountTwd: string;
  merchAmountEth: string;
  merchPaymentStatusId: string;
  notes: string;
  nftItems: NftLineItem[];
  productItems: ProductLineItem[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

function inferOrderType(o: Order): OrderType {
  const hasNft   = Number(o.nftAmountTwd)   > 0 || Number(o.nftAmountEth)   > 0;
  const hasMerch = Number(o.merchAmountTwd) > 0 || Number(o.merchAmountEth) > 0;
  if (hasNft && hasMerch) return "mixed";
  if (hasMerch) return "product";
  return "nft";
}

function isCrypto(methods: Master["paymentMethods"], id: string): boolean {
  return methods.find(m => m.id === id)?.category === "crypto";
}

function statusColor(code: string): string {
  const c = (code ?? "").toLowerCase();
  if (c === "confirmed" || c === "paid" || c === "nft_confirmed") return "#16a34a";
  if (c === "pending") return "#d97706";
  if (c === "cancelled" || c === "canceled") return "#dc2626";
  if (c === "received") return "#2563eb";
  return "#6b7280";
}

function StatusBadge({ code, name }: { code: string; name: string }) {
  const color = statusColor(code);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}18`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}

function OrderTypeBadge({ type }: { type: OrderType }) {
  const map = {
    nft:     { label: "NFT",         bg: "rgba(124,58,237,0.10)", color: "#7c3aed" },
    product: { label: "Product",     bg: "rgba(16,185,129,0.10)", color: "#059669" },
    mixed:   { label: "NFT+Product", bg: "rgba(59,130,246,0.10)", color: "#3b82f6" },
  };
  const s = map[type];
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>{s.label}</span>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: "8px",
  border: "1px solid #e5e7eb", fontSize: "13px", color: "#111827", outline: "none",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "11px", fontWeight: 700,
  color: "#6b7280", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.04em",
};

function SectionHeader({ color, title, subtitle }: { color: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 pt-1 pb-0.5">
      <div className="w-1 h-5 rounded-full" style={{ background: color }} />
      <div>
        <p className="text-xs font-bold" style={{ color }}>{title}</p>
        {subtitle && <p className="text-[10px]" style={{ color: "#9bafc5" }}>{subtitle}</p>}
      </div>
    </div>
  );
}

function StepHeader({ step, title, subtitle }: { step: number; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0"
        style={{ background: "#24315f" }}>
        {step}
      </div>
      <span className="text-xs font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "#24315f" }}>{title}</span>
      {subtitle && <span className="text-[10px] flex-shrink-0" style={{ color: "#9bafc5" }}>{subtitle}</span>}
      <div className="flex-1" style={{ borderBottom: "1px solid #e5e7eb" }} />
    </div>
  );
}

function NftThumbnail({ hash, size = 48 }: { hash: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = hash && !failed ? `https://ipfs.io/ipfs/${hash}` : null;
  return (
    <div className="flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size, background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
      {url ? (
        <img src={url} alt="" onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <svg width={size * 0.45} height={size * 0.45} fill="none" stroke="#d1d5db" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )}
    </div>
  );
}

function ProductThumbnail({ url: imgUrl, size = 48 }: { url: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = imgUrl && !failed ? imgUrl : null;
  return (
    <div className="flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center"
      style={{ width: size, height: size, background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
      {src ? (
        <img src={src} alt="" onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <svg width={size * 0.45} height={size * 0.45} fill="none" stroke="#d1d5db" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function OrdersPageInner() {
  const searchParams = useSearchParams();

  const [orders, setOrders]       = useState<Order[]>([]);
  const [total, setTotal]         = useState(0);
  const [offset, setOffset]       = useState(0);
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState(() => { const v = searchParams.get("status") ?? ""; return v === "all" ? "" : v; });
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [master, setMaster]       = useState<Master | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [deleteId, setDeleteId]   = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sortKey, setSortKey]     = useState<string | undefined>(undefined);
  const [sortDir, setSortDir]     = useState<"asc" | "desc">("asc");
  const [confirmModal, setConfirmModal] = useState<{ orderId: string; type: "nft" | "merch" } | null>(null);
  const [confirmStatusId, setConfirmStatusId] = useState("");
  const [confirming, setConfirming]           = useState(false);
  const [confirmError, setConfirmError]       = useState<string | null>(null);

  const [modalMaximized, setModalMaximized] = useState(false);
  const [nftRecords, setNftRecords]         = useState<NftRecord[]>([]);
  const [productRecords, setProductRecords] = useState<ProductRecord[]>([]);
  const [ethTwdRate, setEthTwdRate]         = useState<number | null>(null);
  const [rateUpdated, setRateUpdated]       = useState<Date | null>(null);
  const rateTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  const EMPTY_FORM: OrderForm = {
    orderNumber: "", customerId: "", purchaseDate: new Date().toISOString().split("T")[0],
    orderType: "nft",
    nftPaymentMethodId: "", nftAmountTwd: "", nftAmountEth: "", nftPaymentStatusId: "",
    merchPaymentMethodId: "", merchAmountTwd: "", merchAmountEth: "", merchPaymentStatusId: "",
    notes: "", nftItems: [], productItems: [],
  };
  const [form, setForm] = useState<OrderForm>(EMPTY_FORM);
  const setF = (patch: Partial<OrderForm>) => setForm(prev => ({ ...prev, ...patch }));

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadOrders = useCallback((q: string, off: number, st: string, sk?: string, sd?: "asc" | "desc") => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ search: q, limit: String(PAGE_SIZE), offset: String(off) });
    if (st)       params.set("status",   st);
    if (sk)       params.set("sort_by",  sk);
    if (sk && sd) params.set("sort_dir", sd);
    fetch(`/api/orders?${params}`, { credentials: "include" })
      .then(r => r.json())
      .then(d => { setOrders(d.orders ?? []); setTotal(d.total ?? 0); setLoading(false); })
      .catch(() => { setError("Failed to load orders."); setLoading(false); });
  }, []);

  useEffect(() => {
    fetch("/api/master", { credentials: "include" }).then(r => r.json()).then(d => setMaster(d)).catch(() => {});
    fetch("/api/customers?limit=500&offset=0", { credentials: "include" }).then(r => r.json()).then(d => setCustomers(d.customers ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    loadOrders(search, 0, statusFilter, sortKey, sortDir);
  }, []);

  useEffect(() => { if (!initialized.current) return; loadOrders(search, offset, statusFilter, sortKey, sortDir); }, [offset]);

  const fetchEthRate = useCallback(() => {
    fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=twd")
      .then(r => r.json())
      .then(d => {
        const rate = d?.ethereum?.twd;
        if (rate) { setEthTwdRate(Number(rate)); setRateUpdated(new Date()); }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showModal) {
      setModalMaximized(false);
      if (rateTimer.current) clearInterval(rateTimer.current);
      return;
    }
    fetch("/api/nft?limit=500&offset=0", { credentials: "include" })
      .then(r => r.json()).then(d => setNftRecords(d.nftRecords ?? [])).catch(() => {});
    fetch("/api/products?limit=500&offset=0", { credentials: "include" })
      .then(r => r.json()).then(d => setProductRecords(d.products ?? [])).catch(() => {});
    fetchEthRate();
    rateTimer.current = setInterval(fetchEthRate, 60000);
    return () => { if (rateTimer.current) clearInterval(rateTimer.current); };
  }, [showModal, fetchEthRate]);

  // Auto-calculate payment totals from line items (create mode only)
  useEffect(() => {
    if (editOrder) return;
    const validNft = form.nftItems.filter(i => i.nftRecordId);
    const nftTwd = validNft.reduce((s, i) => s + (Number(i.unitPriceTwd) || 0), 0);
    const nftEth = validNft.reduce((s, i) => s + (Number(i.unitPriceEth) || 0), 0);
    setForm(prev => ({
      ...prev,
      nftAmountTwd: nftTwd > 0 ? String(nftTwd) : "",
      nftAmountEth: nftEth > 0 ? Number(nftEth.toFixed(8)).toString() : "",
    }));
  }, [form.nftItems, editOrder]);

  useEffect(() => {
    if (editOrder) return;
    const validProd = form.productItems.filter(i => i.productId);
    const prodTwd = validProd.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.quantity) || 1), 0);
    setForm(prev => ({
      ...prev,
      merchAmountTwd: prodTwd > 0 ? String(prodTwd) : "",
    }));
  }, [form.productItems, editOrder]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const applyFilter = (st: string) => { setOffset(0); loadOrders(search, 0, st, sortKey, sortDir); };

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setOffset(0); loadOrders(v, 0, statusFilter, sortKey, sortDir); }, 300);
  };

  const handleSort = (key: string, dir: "asc" | "desc") => {
    setSortKey(key); setSortDir(dir); setOffset(0);
    loadOrders(search, 0, statusFilter, key, dir);
  };

  const openCreate = async () => {
    setEditOrder(null); setForm(EMPTY_FORM); setFormError(null); setShowModal(true);
    try {
      const res = await fetch("/api/orders/next-number", { credentials: "include" });
      const d   = await res.json();
      if (d.nextNumber) setF({ orderNumber: d.nextNumber });
    } catch { /* leave blank if fetch fails */ }
  };

  const openEdit = (order: Order) => {
    setEditOrder(order);
    setForm({
      orderNumber:          order.orderNumber ?? "",
      customerId:           order.customerId ?? "",
      purchaseDate:         order.purchaseDate ? new Date(order.purchaseDate).toISOString().split("T")[0] : "",
      orderType:            inferOrderType(order),
      nftPaymentMethodId:   order.nftPaymentMethodId   ?? "",
      nftAmountTwd:         order.nftAmountTwd   ? String(order.nftAmountTwd)   : "",
      nftAmountEth:         order.nftAmountEth   ? String(order.nftAmountEth)   : "",
      nftPaymentStatusId:   order.nftPaymentStatusId   ?? "",
      merchPaymentMethodId: order.merchPaymentMethodId ?? "",
      merchAmountTwd:       order.merchAmountTwd ? String(order.merchAmountTwd) : "",
      merchAmountEth:       order.merchAmountEth ? String(order.merchAmountEth) : "",
      merchPaymentStatusId: order.merchPaymentStatusId ?? "",
      notes:                order.notes ?? "",
      nftItems: [], productItems: [],
    });
    setFormError(null); setShowModal(true);
  };

  const EMPTY_NFT_ROW: NftLineItem = {
    nftRecordId: "", serialNumber: "", effectivePriceEth: null,
    walletAddress: "", unitPriceTwd: "", unitPriceEth: "",
    imageIpfsHash: null, stageName: "", typeName: "", waveNumber: null, waveName: null,
  };
  const EMPTY_PRODUCT_ROW: ProductLineItem = {
    productId: "", productName: "", retailPrice: null, presalePrice: null,
    quantity: "1", unitPrice: "", imageUrl: null, description: null, stockQty: null,
  };

  const addNftRow    = () => setF({ nftItems: [...form.nftItems, { ...EMPTY_NFT_ROW }] });
  const removeNftItem = (i: number) => setF({ nftItems: form.nftItems.filter((_, idx) => idx !== i) });
  const updateNftItem = (i: number, patch: Partial<NftLineItem>) =>
    setF({ nftItems: form.nftItems.map((item, idx) => idx === i ? { ...item, ...patch } : item) });

  const selectNftInRow = (i: number, nftRecordId: string) => {
    const rec = nftRecords.find(r => r.id === nftRecordId);
    updateNftItem(i, {
      nftRecordId,
      serialNumber:      rec?.serialNumber ?? "",
      effectivePriceEth: rec?.effectivePriceEth ?? null,
      unitPriceEth:      rec?.effectivePriceEth != null ? String(rec.effectivePriceEth) : "",
      imageIpfsHash:     rec?.imageIpfsHash ?? null,
      stageName:         rec?.stageName ?? "",
      typeName:          rec?.typeName ?? "",
      waveNumber:        rec?.waveNumber ?? null,
      waveName:          rec?.waveName ?? null,
    });
  };

  const addProductRow    = () => setF({ productItems: [...form.productItems, { ...EMPTY_PRODUCT_ROW }] });
  const removeProductItem = (i: number) => setF({ productItems: form.productItems.filter((_, idx) => idx !== i) });
  const updateProductItem = (i: number, patch: Partial<ProductLineItem>) =>
    setF({ productItems: form.productItems.map((item, idx) => idx === i ? { ...item, ...patch } : item) });

  const selectProductInRow = (i: number, productId: string) => {
    const prod = productRecords.find(p => p.id === productId);
    updateProductItem(i, {
      productId,
      productName:  prod?.name ?? "",
      retailPrice:  prod?.retailPrice ?? null,
      presalePrice: prod?.presalePrice ?? null,
      unitPrice:    prod?.presalePrice != null ? String(prod.presalePrice) : "",
      imageUrl:     prod?.imageUrl ?? null,
      description:  prod?.description ?? null,
      stockQty:     prod?.stockQty ?? null,
    });
  };

  const handleSave = async () => {
    setSaving(true); setFormError(null);
    const hasNft   = form.orderType === "nft"     || form.orderType === "mixed";
    const hasMerch = form.orderType === "product" || form.orderType === "mixed";
    try {
      const body: Record<string, unknown> = {
        orderNumber:  form.orderNumber || undefined,  // pre-filled from next-number; SP auto-generates if missing
        purchaseDate: form.purchaseDate,
        notes:        form.notes || undefined,
      };
      if (!editOrder && form.customerId) body.customerId = form.customerId;

      if (hasNft) {
        if (form.nftPaymentMethodId)  body.nftPaymentMethodId  = form.nftPaymentMethodId;
        if (form.nftAmountTwd)        body.nftAmountTwd        = Number(form.nftAmountTwd);
        if (form.nftAmountEth)        body.nftAmountEth        = Number(form.nftAmountEth);
        if (form.nftPaymentStatusId)  body.nftPaymentStatusId  = form.nftPaymentStatusId;
      }
      if (hasMerch) {
        if (form.merchPaymentMethodId) body.merchPaymentMethodId = form.merchPaymentMethodId;
        if (form.merchAmountTwd)       body.merchAmountTwd       = Number(form.merchAmountTwd);
        if (form.merchAmountEth)       body.merchAmountEth       = Number(form.merchAmountEth);
        if (form.merchPaymentStatusId) body.merchPaymentStatusId = form.merchPaymentStatusId;
      }

      if (!editOrder) {
        const validNftItems = form.nftItems.filter(item => item.nftRecordId);
        if (validNftItems.length > 0) {
          body.nftItems = validNftItems.map(item => ({
            nftRecordId:   item.nftRecordId,
            walletAddress: item.walletAddress || undefined,
            unitPriceTwd:  item.unitPriceTwd ? Number(item.unitPriceTwd) : undefined,
            unitPriceEth:  item.unitPriceEth ? Number(item.unitPriceEth) : undefined,
          }));
        }
        const validProductItems = form.productItems.filter(item => item.productId);
        if (validProductItems.length > 0) {
          body.productItems = validProductItems.map(item => ({
            productId: item.productId,
            quantity:  item.quantity ? Number(item.quantity) : 1,
            unitPrice: item.unitPrice ? Number(item.unitPrice) : undefined,
          }));
        }
      }

      const url = editOrder ? `/api/orders/${editOrder.id}` : "/api/orders";
      const res = await fetch(url, {
        method: editOrder ? "PUT" : "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? "Save failed."); return; }
      setShowModal(false); setOffset(0);
      loadOrders(search, 0, statusFilter, sortKey, sortDir);
    } catch { setFormError("Network error."); }
    finally { setSaving(false); }
  };

  const openConfirm = (order: Order, type: "nft" | "merch") => {
    setConfirmModal({ orderId: order.id, type });
    setConfirmStatusId(type === "nft" ? (order.nftPaymentStatusId ?? "") : (order.merchPaymentStatusId ?? ""));
    setConfirmError(null);
  };

  const handleConfirmPayment = async () => {
    if (!confirmModal || !confirmStatusId) return;
    setConfirming(true); setConfirmError(null);
    try {
      const body = confirmModal.type === "nft"
        ? { action: "confirm_nft",   nftPaymentStatusId:   confirmStatusId }
        : { action: "confirm_merch", merchPaymentStatusId: confirmStatusId };
      const res = await fetch(`/api/orders/${confirmModal.orderId}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setConfirmError(d.error ?? "Confirmation failed."); return; }
      setConfirmModal(null);
      loadOrders(search, offset, statusFilter, sortKey, sortDir);
    } catch { setConfirmError("Network error."); }
    finally { setConfirming(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Delete failed."); return; }
      setDeleteId(null);
      loadOrders(search, offset, statusFilter, sortKey, sortDir);
    } catch { setError("Network error."); }
  };

  // ── Table columns ────────────────────────────────────────────────────────────

  const selectStyle: React.CSSProperties = { padding: "7px 12px", borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "13px", background: "white", outline: "none" };
  const activeFilters = statusFilter ? 1 : 0;

  const columns: ColumnDef<Order>[] = [
    {
      key: "orderNumber", header: "Order #", sortKey: "order_number",
      render: o => <span className="font-mono font-semibold text-xs" style={{ color: "#24315f" }}>{o.orderNumber}</span>,
    },
    {
      key: "type", header: "Type",
      render: o => <OrderTypeBadge type={inferOrderType(o)} />,
    },
    {
      key: "customer", header: "Customer", sortKey: "customer",
      render: o => (
        <div>
          <div className="font-medium text-sm" style={{ color: "#111827" }}>{o.customerName ?? "—"}</div>
          {o.customerPhone && <div className="text-xs" style={{ color: "#9bafc5" }}>{o.customerPhone}</div>}
        </div>
      ),
    },
    {
      key: "date", header: "Date", sortKey: "purchase_date",
      render: o => <span className="text-xs" style={{ color: "#6b7280" }}>{o.purchaseDate ? new Date(o.purchaseDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>,
    },
    {
      key: "nft", header: "NFT Payment", sortKey: "nft_amount_twd", align: "right",
      render: o => (Number(o.nftAmountTwd) > 0 || Number(o.nftAmountEth) > 0) ? (
        <div className="text-right space-y-0.5">
          {Number(o.nftAmountTwd) > 0 && <div className="text-xs font-semibold" style={{ color: "#111827" }}>TWD {Number(o.nftAmountTwd).toLocaleString()}</div>}
          {Number(o.nftAmountEth) > 0 && <div className="text-xs" style={{ color: "#7c3aed" }}>{o.nftAmountEth} ETH</div>}
          {o.nftPaymentMethodName && <div className="text-[10px]" style={{ color: "#9bafc5" }}>{o.nftPaymentMethodName}</div>}
        </div>
      ) : <span style={{ color: "#e5e7eb" }}>—</span>,
    },
    {
      key: "merch", header: "Product Payment", sortKey: "merch_amount_twd", align: "right",
      render: o => (Number(o.merchAmountTwd) > 0 || Number(o.merchAmountEth) > 0) ? (
        <div className="text-right space-y-0.5">
          {Number(o.merchAmountTwd) > 0 && <div className="text-xs font-semibold" style={{ color: "#111827" }}>TWD {Number(o.merchAmountTwd).toLocaleString()}</div>}
          {Number(o.merchAmountEth) > 0 && <div className="text-xs" style={{ color: "#059669" }}>{o.merchAmountEth} ETH</div>}
          {o.merchPaymentMethodName && <div className="text-[10px]" style={{ color: "#9bafc5" }}>{o.merchPaymentMethodName}</div>}
        </div>
      ) : <span style={{ color: "#e5e7eb" }}>—</span>,
    },
    {
      key: "paymentStatus", header: "Payment Status",
      render: o => {
        const hasNftStatus   = !!o.nftPaymentStatusCode;
        const hasMerchStatus = !!o.merchPaymentStatusCode;
        const isMixed = hasNftStatus && hasMerchStatus;
        if (!hasNftStatus && !hasMerchStatus) return <span style={{ color: "#e5e7eb" }}>—</span>;
        return (
          <div className="flex flex-col gap-1.5">
            {hasNftStatus && (
              <div className="flex flex-col gap-0.5">
                {isMixed && <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#7c3aed" }}>NFT Payment</span>}
                <StatusBadge code={o.nftPaymentStatusCode} name={o.nftPaymentStatusName} />
              </div>
            )}
            {hasMerchStatus && (
              <div className="flex flex-col gap-0.5">
                {isMixed && <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#059669" }}>Product Payment</span>}
                <StatusBadge code={o.merchPaymentStatusCode} name={o.merchPaymentStatusName} />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "actions", header: "Actions", align: "center",
      render: o => {
        const hasNft   = Number(o.nftAmountTwd)   > 0 || Number(o.nftAmountEth)   > 0;
        const hasMerch = Number(o.merchAmountTwd) > 0 || Number(o.merchAmountEth) > 0;
        return (
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {hasNft && (
              <button onClick={() => openConfirm(o, "nft")}
                className="px-2 py-1 rounded text-[10px] font-bold"
                title="Confirm NFT payment"
                style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,58,237,0.2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(124,58,237,0.1)")}>
                ✓ NFT
              </button>
            )}
            {hasMerch && (
              <button onClick={() => openConfirm(o, "merch")}
                className="px-2 py-1 rounded text-[10px] font-bold"
                title="Confirm product payment"
                style={{ background: "rgba(5,150,105,0.1)", color: "#059669", border: "1px solid rgba(5,150,105,0.2)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(5,150,105,0.2)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(5,150,105,0.1)")}>
                ✓ Product
              </button>
            )}
            <button onClick={() => openEdit(o)} className="p-1.5 rounded-lg" style={{ color: "#41afeb" }} title="Edit"
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(65,175,235,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button onClick={() => setDeleteId(o.id)} className="p-1.5 rounded-lg" style={{ color: "#dc2626" }} title="Delete"
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(220,38,38,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        );
      },
    },
  ];

  // ── Derived form state ────────────────────────────────────────────────────────

  const showNft   = form.orderType === "nft"     || form.orderType === "mixed";
  const showMerch = form.orderType === "product" || form.orderType === "mixed";
  const nftIsCrypto   = master ? isCrypto(master.paymentMethods, form.nftPaymentMethodId)   : false;
  const merchIsCrypto = master ? isCrypto(master.paymentMethods, form.merchPaymentMethodId) : false;

  // Per-row helpers — each row may only pick NFTs not already in another row
  const availableNftsForRow = (rowIndex: number) => {
    const taken = form.nftItems.map((item, i) => i !== rowIndex ? item.nftRecordId : "").filter(Boolean);
    return nftRecords.filter(r => !taken.includes(r.id));
  };

  const validNftCount     = form.nftItems.filter(i => i.nftRecordId).length;
  const validProductCount = form.productItems.filter(i => i.productId).length;

  const nftSubtotalTwd = form.nftItems.filter(i => i.nftRecordId).reduce((s, i) => s + (Number(i.unitPriceTwd) || 0), 0);
  const nftSubtotalEth = form.nftItems.filter(i => i.nftRecordId).reduce((s, i) => s + (Number(i.unitPriceEth) || 0), 0);
  const prodSubtotal   = form.productItems.filter(i => i.productId).reduce((s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.quantity) || 1), 0);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>Bearth Orders</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            {total.toLocaleString()} order{total !== 1 ? "s" : ""}
            {activeFilters > 0 && <span style={{ color: "#41afeb" }}> · {activeFilters} filter active</span>}
          </p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
          style={{ background: "#41afeb" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#2e9fd8")}
          onMouseLeave={e => (e.currentTarget.style.background = "#41afeb")}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Order
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search orders, customers…" value={search}
            onChange={e => handleSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl text-sm outline-none bg-white placeholder:text-[#c4d0de]"
            style={{ border: "1px solid #e5e7eb", color: "#111827", minWidth: 220 }} />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); applyFilter(e.target.value); }}
          style={{ ...selectStyle, color: statusFilter ? "#111827" : "#9bafc5" }}>
          <option value="">All Payment Status</option>
          {master?.paymentStatuses.map(s => <option key={s.id} value={s.code}>{s.name}</option>)}
        </select>
        {activeFilters > 0 && (
          <button onClick={() => { setStatusFilter(""); applyFilter(""); }}
            className="px-3 py-2 text-xs rounded-xl bg-white" style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <DataTable columns={columns} data={orders} total={total} offset={offset}
        pageSize={PAGE_SIZE} onPageChange={off => setOffset(off)}
        loading={loading} error={error} emptyText="No orders found"
        keyExtractor={o => o.id} sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />

      {/* ── Create / Edit Modal ───────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)", padding: modalMaximized ? 0 : 16 }}>
          <div className="bg-white flex flex-col"
            style={{
              width: "100%",
              maxWidth:     modalMaximized ? "100%" : 980,
              height:       modalMaximized ? "100vh" : "auto",
              maxHeight:    modalMaximized ? "100vh" : "92vh",
              borderRadius: modalMaximized ? 0 : 16,
              border:       "1px solid #e5e7eb",
              boxShadow:    "0 25px 60px rgba(0,0,0,0.18)",
            }}>

            {/* Modal header */}
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: "1px solid #e5e7eb" }}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(65,175,235,0.1)" }}>
                  <svg className="w-4 h-4" fill="none" stroke="#41afeb" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold" style={{ color: "#24315f" }}>
                    {editOrder ? "Edit Order" : "New Order"}
                  </h2>
                  {editOrder && (
                    <p className="text-[11px] font-mono font-semibold" style={{ color: "#9bafc5" }}>
                      {editOrder.orderNumber}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setModalMaximized(v => !v)}
                  title={modalMaximized ? "Restore" : "Maximize"}
                  className="p-1.5 rounded-lg"
                  style={{ color: "#9bafc5" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  {modalMaximized ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 9V4.5M9 9H4.5M15 9h4.5M15 9V4.5M15 15H4.5m10.5 0v4.5M9 15H4.5M9 15v4.5" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                  )}
                </button>
                <button onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg"
                  style={{ color: "#9bafc5" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f3f4f6")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
              {formError && (
                <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>{formError}</div>
              )}

              {/* ── Step 1: Order Details ── */}
              <div className="space-y-4">
                <StepHeader step={1} title="Order Details" />

                <div>
                  <label style={labelStyle}>Order Type</label>
                  <div className="flex gap-2 mt-1">
                    {(["nft", "product", "mixed"] as OrderType[]).map(t => {
                      const labels = { nft: "NFT Only", product: "Product Only", mixed: "NFT + Product" };
                      const colors = { nft: "#7c3aed", product: "#059669", mixed: "#3b82f6" };
                      const active = form.orderType === t;
                      return (
                        <button key={t} type="button" onClick={() => setF({ orderType: t })}
                          className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                          style={{
                            background: active ? colors[t] : "#f9fafb",
                            color: active ? "#fff" : "#6b7280",
                            border: `1px solid ${active ? colors[t] : "#e5e7eb"}`,
                          }}>
                          {labels[t]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label style={labelStyle}>Order Number</label>
                    <input value={form.orderNumber} readOnly
                      style={{ ...inputStyle, background: "#f8fafc", color: "#24315f", fontWeight: 700, fontFamily: "monospace", cursor: "default" }}
                      placeholder="Loading…" />
                    <p className="text-[10px] mt-0.5" style={{ color: "#9bafc5" }}>Auto-assigned · read-only</p>
                  </div>
                  <div>
                    <label style={labelStyle}>Purchase Date</label>
                    <input type="date" value={form.purchaseDate} onChange={e => setF({ purchaseDate: e.target.value })} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Notes</label>
                    <input value={form.notes} onChange={e => setF({ notes: e.target.value })}
                      style={inputStyle} placeholder="Optional notes…" />
                  </div>
                </div>

                {!editOrder && (
                  <div>
                    <label style={labelStyle}>Customer *</label>
                    <select value={form.customerId} onChange={e => setF({ customerId: e.target.value })} style={inputStyle}>
                      <option value="">Select customer…</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* ── Step 2: Line Items (create only) ── */}
              {!editOrder && (showNft || showMerch) && (
                <div className="space-y-4">
                  <StepHeader step={2} title="Line Items"
                    subtitle={(validNftCount + validProductCount) > 0
                      ? `${validNftCount + validProductCount} item${(validNftCount + validProductCount) !== 1 ? "s" : ""} · TWD ${(nftSubtotalTwd + prodSubtotal).toLocaleString()}`
                      : "Select NFTs and/or products"} />

                  {/* NFT Items */}
                  {showNft && (
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(124,58,237,0.2)" }}>
                      <div className="flex items-center justify-between px-4 py-2.5"
                        style={{ background: "rgba(124,58,237,0.06)", borderBottom: "1px solid rgba(124,58,237,0.15)" }}>
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 rounded-full" style={{ background: "#7c3aed" }} />
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#7c3aed" }}>NFT Items</span>
                          {validNftCount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: "#7c3aed" }}>
                              {validNftCount}
                            </span>
                          )}
                          {nftSubtotalTwd > 0 && <span className="text-[10px] font-semibold" style={{ color: "#7c3aed" }}>· TWD {nftSubtotalTwd.toLocaleString()}</span>}
                          {nftSubtotalEth > 0 && <span className="text-[10px] font-semibold" style={{ color: "#7c3aed" }}>· {Number(nftSubtotalEth.toFixed(8))} ETH</span>}
                        </div>
                        <button onClick={addNftRow}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white"
                          style={{ background: "#7c3aed" }}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                          </svg>
                          Add NFT
                        </button>
                      </div>

                      {form.nftItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ background: "rgba(124,58,237,0.02)" }}>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(124,58,237,0.1)" }}>
                            <svg className="w-5 h-5" fill="none" stroke="#7c3aed" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <p className="text-xs font-medium" style={{ color: "#9bafc5" }}>No NFTs added yet</p>
                          <button onClick={addNftRow}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold"
                            style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed" }}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add first NFT
                          </button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                        <>
                          <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: "#9bafc5", background: "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                            <div style={{ width: 48, flexShrink: 0 }} />
                            <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: "2fr 1.5fr 1.1fr 1.1fr 28px" }}>
                              <span>NFT Record</span><span>Wallet Address</span><span>Sell (TWD)</span><span>Sell (ETH)</span><span />
                            </div>
                          </div>

                          {form.nftItems.map((item, i) => (
                            <div key={i} className="flex items-start gap-3 px-4 py-3"
                              style={{ borderBottom: i < form.nftItems.length - 1 ? "1px solid #f3f4f6" : "none",
                                       background: i % 2 === 0 ? "rgba(124,58,237,0.015)" : "white" }}>
                              <NftThumbnail hash={item.imageIpfsHash} size={48} />
                              <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: "2fr 1.5fr 1.1fr 1.1fr 28px", alignItems: "start" }}>
                                <div>
                                  <select value={item.nftRecordId} onChange={e => selectNftInRow(i, e.target.value)}
                                    style={{ ...inputStyle, padding: "6px 8px", fontSize: 12, color: item.nftRecordId ? "#111827" : "#9bafc5" }}>
                                    <option value="">Choose NFT…</option>
                                    {availableNftsForRow(i).map(r => (
                                      <option key={r.id} value={r.id}>
                                        {r.serialNumber}{r.stageName ? ` · ${r.stageName}` : ""}{r.typeName ? ` · ${r.typeName}` : ""}
                                      </option>
                                    ))}
                                  </select>
                                  {item.nftRecordId && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {item.waveNumber != null && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                          style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed" }}>
                                          Wave {item.waveNumber}{item.waveName ? ` · ${item.waveName}` : ""}
                                        </span>
                                      )}
                                      {item.stageName && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                          style={{ background: "rgba(59,130,246,0.08)", color: "#3b82f6" }}>
                                          {item.stageName}
                                        </span>
                                      )}
                                      {item.typeName && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                          style={{ background: "rgba(16,185,129,0.08)", color: "#059669" }}>
                                          {item.typeName}
                                        </span>
                                      )}
                                      {item.effectivePriceEth != null && (
                                        <span className="text-[9px] font-semibold" style={{ color: "#9bafc5" }}>
                                          Base: {item.effectivePriceEth} ETH
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <input value={item.walletAddress} onChange={e => updateNftItem(i, { walletAddress: e.target.value })}
                                  style={{ ...inputStyle, padding: "6px 8px", fontSize: 11, fontFamily: "monospace" }} placeholder="0x…" />
                                <input type="number" min="0" value={item.unitPriceTwd}
                                  onChange={e => updateNftItem(i, { unitPriceTwd: e.target.value })}
                                  style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }} placeholder="0" />
                                <input type="number" min="0" step="0.00000001" value={item.unitPriceEth}
                                  onChange={e => updateNftItem(i, { unitPriceEth: e.target.value })}
                                  style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }} placeholder="0.0000" />
                                <button onClick={() => removeNftItem(i)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold"
                                  style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", flexShrink: 0 }}>×</button>
                              </div>
                            </div>
                          ))}

                          <div className="px-4 py-2" style={{ borderTop: "1px dashed rgba(124,58,237,0.15)", background: "rgba(124,58,237,0.02)" }}>
                            <button onClick={addNftRow} className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "#7c3aed" }}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                              </svg>
                              Add another NFT
                            </button>
                          </div>
                        </>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Product Items */}
                  {showMerch && (
                    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(5,150,105,0.2)" }}>
                      <div className="flex items-center justify-between px-4 py-2.5"
                        style={{ background: "rgba(5,150,105,0.06)", borderBottom: "1px solid rgba(5,150,105,0.15)" }}>
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 rounded-full" style={{ background: "#059669" }} />
                          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#059669" }}>Product Items</span>
                          {validProductCount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: "#059669" }}>
                              {validProductCount}
                            </span>
                          )}
                          {prodSubtotal > 0 && <span className="text-[10px] font-semibold" style={{ color: "#059669" }}>· TWD {prodSubtotal.toLocaleString()}</span>}
                        </div>
                        <button onClick={addProductRow}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white"
                          style={{ background: "#059669" }}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                          </svg>
                          Add Product
                        </button>
                      </div>

                      {form.productItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ background: "rgba(5,150,105,0.02)" }}>
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(5,150,105,0.1)" }}>
                            <svg className="w-5 h-5" fill="none" stroke="#059669" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                          </div>
                          <p className="text-xs font-medium" style={{ color: "#9bafc5" }}>No products added yet</p>
                          <button onClick={addProductRow}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold"
                            style={{ background: "rgba(5,150,105,0.08)", color: "#059669" }}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Add first product
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: "#9bafc5", background: "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                            <div style={{ width: 48, flexShrink: 0 }} />
                            <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: "2.5fr 0.7fr 1.2fr 28px" }}>
                              <span>Product</span><span>Qty</span><span>Sell Price (TWD)</span><span />
                            </div>
                          </div>

                          {form.productItems.map((item, i) => (
                            <div key={i} className="flex items-start gap-3 px-4 py-3"
                              style={{ borderBottom: i < form.productItems.length - 1 ? "1px solid #f3f4f6" : "none",
                                       background: i % 2 === 0 ? "rgba(5,150,105,0.015)" : "white" }}>
                              <ProductThumbnail url={item.imageUrl} size={48} />
                              <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: "2.5fr 0.7fr 1.2fr 28px", alignItems: "start" }}>
                                <div>
                                  <select value={item.productId} onChange={e => selectProductInRow(i, e.target.value)}
                                    style={{ ...inputStyle, padding: "6px 8px", fontSize: 12, color: item.productId ? "#111827" : "#9bafc5" }}>
                                    <option value="">Choose product…</option>
                                    {productRecords.map(p => (
                                      <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>
                                    ))}
                                  </select>
                                  {item.productId && (
                                    <div className="mt-1 space-y-0.5">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {item.retailPrice != null && (
                                          <span className="text-[9px] line-through" style={{ color: "#9bafc5" }}>
                                            MRP TWD {Number(item.retailPrice).toLocaleString()}
                                          </span>
                                        )}
                                        {item.presalePrice != null && (
                                          <span className="text-[9px] font-bold" style={{ color: "#059669" }}>
                                            → TWD {Number(item.presalePrice).toLocaleString()}
                                          </span>
                                        )}
                                        {item.stockQty != null && (
                                          <span className="text-[9px] px-1 py-0.5 rounded font-semibold"
                                            style={{
                                              background: item.stockQty <= 0 ? "rgba(220,38,38,0.08)" : item.stockQty <= 10 ? "rgba(217,119,6,0.08)" : "rgba(5,150,105,0.08)",
                                              color: item.stockQty <= 0 ? "#dc2626" : item.stockQty <= 10 ? "#d97706" : "#059669",
                                            }}>
                                            {item.stockQty <= 0 ? "Out of stock" : `${item.stockQty} in stock`}
                                          </span>
                                        )}
                                      </div>
                                      {item.description && (
                                        <p className="text-[9px] leading-tight" style={{ color: "#9bafc5" }}>
                                          {item.description.length > 70 ? item.description.slice(0, 70) + "…" : item.description}
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <input type="number" min="1" value={item.quantity}
                                  onChange={e => updateProductItem(i, { quantity: e.target.value })}
                                  style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }} />
                                <div>
                                  <input type="number" min="0" value={item.unitPrice}
                                    onChange={e => updateProductItem(i, { unitPrice: e.target.value })}
                                    style={{ ...inputStyle, padding: "6px 8px", fontSize: 12 }} placeholder="0" />
                                  {item.unitPrice && item.quantity && Number(item.unitPrice) > 0 && (
                                    <p className="text-[9px] mt-0.5 font-semibold" style={{ color: "#059669" }}>
                                      Subtotal: TWD {(Number(item.unitPrice) * Number(item.quantity)).toLocaleString()}
                                    </p>
                                  )}
                                </div>
                                <button onClick={() => removeProductItem(i)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-sm font-bold mt-0.5"
                                  style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626", flexShrink: 0 }}>×</button>
                              </div>
                            </div>
                          ))}

                          <div className="px-4 py-2" style={{ borderTop: "1px dashed rgba(5,150,105,0.15)", background: "rgba(5,150,105,0.02)" }}>
                            <button onClick={addProductRow} className="flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: "#059669" }}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                              </svg>
                              Add another product
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Step 3: Payment ── */}
              <div className="space-y-4">
                <StepHeader step={editOrder ? 2 : 3} title="Payment"
                  subtitle={!editOrder && (nftSubtotalTwd > 0 || prodSubtotal > 0) ? "Auto-calculated from items above · you may adjust" : undefined} />

                <div className={`gap-4 ${showNft && showMerch ? "grid grid-cols-2" : "flex flex-col"}`}>

                {showNft && master && (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(124,58,237,0.04)", border: "1px solid rgba(124,58,237,0.15)" }}>
                    <SectionHeader color="#7c3aed" title="NFT Payment" subtitle="Cryptocurrency · Bank · Cash · LINE Pay" />
                    <div>
                      <label style={labelStyle}>Payment Method</label>
                      <PaymentMethodSelect value={form.nftPaymentMethodId} onChange={id => setF({ nftPaymentMethodId: id })}
                        methods={master.paymentMethods}
                        onMethodAdded={m => setMaster(prev => prev ? { ...prev, paymentMethods: [...prev.paymentMethods, { ...m, category: m.category ?? "local" }] } : prev)}
                        style={inputStyle} placeholder="Select payment method…" />
                    </div>
                    <div className={`grid gap-3 ${nftIsCrypto ? "grid-cols-2" : "grid-cols-1"}`}>
                      <div>
                        <label style={labelStyle}>Total Amount (TWD)</label>
                        <input type="number" min="0" value={form.nftAmountTwd}
                          onChange={e => setF({ nftAmountTwd: e.target.value })} style={inputStyle} placeholder="0" />
                        {nftIsCrypto && ethTwdRate && form.nftAmountTwd && Number(form.nftAmountTwd) > 0 && (
                          <p className="text-[10px] mt-1" style={{ color: "#7c3aed" }}>
                            ≈ {(Number(form.nftAmountTwd) / ethTwdRate).toFixed(6)} ETH
                          </p>
                        )}
                      </div>
                      {nftIsCrypto && (
                        <div>
                          <label style={labelStyle}>Total Amount (ETH)</label>
                          <input type="number" min="0" step="0.00000001" value={form.nftAmountEth}
                            onChange={e => setF({ nftAmountEth: e.target.value })} style={inputStyle} placeholder="0.0000" />
                          {ethTwdRate && form.nftAmountEth && Number(form.nftAmountEth) > 0 && (
                            <p className="text-[10px] mt-1" style={{ color: "#7c3aed" }}>
                              ≈ TWD {(Number(form.nftAmountEth) * ethTwdRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {nftIsCrypto && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: "rgba(124,58,237,0.05)", border: "1px solid rgba(124,58,237,0.1)" }}>
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#7c3aed" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        {ethTwdRate ? (
                          <span className="text-[10px] font-semibold" style={{ color: "#7c3aed" }}>
                            1 ETH ≈ TWD {ethTwdRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        ) : (
                          <span className="text-[10px]" style={{ color: "#9bafc5" }}>Fetching live rate…</span>
                        )}
                        {rateUpdated && (
                          <span className="text-[9px] ml-auto" style={{ color: "#9bafc5" }}>
                            Updated {rateUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    )}
                    <div>
                      <label style={labelStyle}>Payment Status</label>
                      <select value={form.nftPaymentStatusId} onChange={e => setF({ nftPaymentStatusId: e.target.value })} style={inputStyle}>
                        <option value="">Select status…</option>
                        {master.paymentStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {showMerch && master && (
                  <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(5,150,105,0.04)", border: "1px solid rgba(5,150,105,0.15)" }}>
                    <SectionHeader color="#059669" title="Product Payment" subtitle="Cryptocurrency · Bank · Cash · LINE Pay" />
                    <div>
                      <label style={labelStyle}>Payment Method</label>
                      <PaymentMethodSelect value={form.merchPaymentMethodId} onChange={id => setF({ merchPaymentMethodId: id })}
                        methods={master.paymentMethods}
                        onMethodAdded={m => setMaster(prev => prev ? { ...prev, paymentMethods: [...prev.paymentMethods, { ...m, category: m.category ?? "local" }] } : prev)}
                        style={inputStyle} placeholder="Select payment method…" />
                    </div>
                    <div className={`grid gap-3 ${merchIsCrypto ? "grid-cols-2" : "grid-cols-1"}`}>
                      <div>
                        <label style={labelStyle}>Total Amount (TWD)</label>
                        <input type="number" min="0" value={form.merchAmountTwd}
                          onChange={e => setF({ merchAmountTwd: e.target.value })} style={inputStyle} placeholder="0" />
                        {merchIsCrypto && ethTwdRate && form.merchAmountTwd && Number(form.merchAmountTwd) > 0 && (
                          <p className="text-[10px] mt-1" style={{ color: "#059669" }}>
                            ≈ {(Number(form.merchAmountTwd) / ethTwdRate).toFixed(6)} ETH
                          </p>
                        )}
                      </div>
                      {merchIsCrypto && (
                        <div>
                          <label style={labelStyle}>Total Amount (ETH)</label>
                          <input type="number" min="0" step="0.00000001" value={form.merchAmountEth}
                            onChange={e => setF({ merchAmountEth: e.target.value })} style={inputStyle} placeholder="0.0000" />
                          {ethTwdRate && form.merchAmountEth && Number(form.merchAmountEth) > 0 && (
                            <p className="text-[10px] mt-1" style={{ color: "#059669" }}>
                              ≈ TWD {(Number(form.merchAmountEth) * ethTwdRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    {merchIsCrypto && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                        style={{ background: "rgba(5,150,105,0.05)", border: "1px solid rgba(5,150,105,0.1)" }}>
                        <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#059669" }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        {ethTwdRate ? (
                          <span className="text-[10px] font-semibold" style={{ color: "#059669" }}>
                            1 ETH ≈ TWD {ethTwdRate.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </span>
                        ) : (
                          <span className="text-[10px]" style={{ color: "#9bafc5" }}>Fetching live rate…</span>
                        )}
                        {rateUpdated && (
                          <span className="text-[9px] ml-auto" style={{ color: "#9bafc5" }}>
                            Updated {rateUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    )}
                    <div>
                      <label style={labelStyle}>Payment Status</label>
                      <select value={form.merchPaymentStatusId} onChange={e => setF({ merchPaymentStatusId: e.target.value })} style={inputStyle}>
                        <option value="">Select status…</option>
                        {master.paymentStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
              </div>

            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderTop: "1px solid #e5e7eb" }}>
              <div className="text-xs" style={{ color: "#9bafc5" }}>
                {!editOrder && (validNftCount + validProductCount) > 0 && (
                  <span className="flex items-center gap-2">
                    <span>
                      {validNftCount > 0 && `${validNftCount} NFT`}
                      {validNftCount > 0 && validProductCount > 0 && " + "}
                      {validProductCount > 0 && `${validProductCount} product`}
                      {(validNftCount + validProductCount) > 0 && ` item${(validNftCount + validProductCount) !== 1 ? "s" : ""}`}
                    </span>
                    {(nftSubtotalTwd + prodSubtotal) > 0 && (
                      <span className="font-bold" style={{ color: "#24315f" }}>
                        · TWD {(nftSubtotalTwd + prodSubtotal).toLocaleString()}
                        {nftSubtotalEth > 0 && ` + ${Number(nftSubtotalEth.toFixed(8))} ETH`}
                      </span>
                    )}
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium rounded-lg"
                  style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50"
                  style={{ background: "#41afeb" }}>
                  {saving ? "Saving…" : editOrder ? "Save Changes" : "Create Order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Payment Modal ─────────────────────────────────────────────── */}
      {confirmModal && master && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: confirmModal.type === "nft" ? "rgba(124,58,237,0.1)" : "rgba(5,150,105,0.1)" }}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  style={{ color: confirmModal.type === "nft" ? "#7c3aed" : "#059669" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>
                  Confirm {confirmModal.type === "nft" ? "NFT" : "Product"} Payment
                </h2>
                <p className="text-[11px]" style={{ color: "#9bafc5" }}>
                  {confirmModal.type === "merch" ? "This will reserve stock and create a fulfillment record." : "This will mark the NFT payment as confirmed."}
                </p>
              </div>
            </div>
            {confirmError && (
              <div className="p-3 rounded-lg text-xs mb-3" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>{confirmError}</div>
            )}
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: "#6b7280" }}>Set Payment Status</label>
              <select value={confirmStatusId} onChange={e => setConfirmStatusId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                style={{ border: "1px solid #e5e7eb", color: confirmStatusId ? "#111827" : "#9bafc5" }}>
                <option value="">Select status…</option>
                {master.paymentStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmModal(null)} className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button onClick={handleConfirmPayment} disabled={confirming || !confirmStatusId}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50"
                style={{ background: confirmModal.type === "nft" ? "#7c3aed" : "#059669" }}>
                {confirming ? "Confirming…" : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ────────────────────────────────────────────────────── */}
      {deleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-base font-bold mb-2" style={{ color: "#24315f" }}>Delete Order</h2>
            <p className="text-sm mb-6" style={{ color: "#6b7280" }}>This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm font-medium rounded-lg"
                style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteId)} className="px-4 py-2 text-sm font-bold text-white rounded-lg"
                style={{ background: "#dc2626" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return <Suspense><OrdersPageInner /></Suspense>;
}
