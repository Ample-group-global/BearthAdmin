"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import DataTable, { type ColumnDef } from "@/components/DataTable";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NftRecord {
  id: string;
  serialNumber: string;
  tokenId: number | null;
  imageIpfsHash: string | null;
  metadataUri: string | null;
  blindBoxUri: string | null;
  isRevealed: boolean;
  revealedAt: string | null;
  stageName: string;
  stageId: string;
  typeName: string;
  nftTypeId: string;
  deliveryStatusCode: string;
  deliveryStatusName: string;
  deliveredAt: string | null;
  notes: string | null;
  traits: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
  totalCount: number;
  // wave + pricing (new)
  waveId: string | null;
  waveNumber: number | null;
  waveName: string | null;
  priceEth: number | null;
  effectivePriceEth: number | null;
}

interface Master {
  nftStages:        Array<{ id: string; name: string; code: string }>;
  nftTypes:         Array<{ id: string; name: string; code: string }>;
  deliveryStatuses: Array<{ id: string; name: string; code: string }>;
}

const PAGE_SIZE    = 20;
const IPFS_GATEWAY = "https://amgbearth.myfilebase.com/ipfs";

function parseCsv(text: string): Array<Record<string, string>> {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map(line => {
    const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NftImage({ hash, size = 52 }: { hash?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = hash ? `${IPFS_GATEWAY}/${hash}` : null;
  if (url && !failed) {
    return (
      <img src={url} alt="NFT" loading="lazy"
        style={{ width: size, height: size, objectFit: "cover", borderRadius: 8, display: "block", flexShrink: 0 }}
        onError={() => setFailed(true)} />
    );
  }
  return (
    <div style={{ width: size, height: size, background: "#f3f4f6", borderRadius: 8,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      border: "1.5px dashed #d1d5db", flexShrink: 0 }}>
      <svg style={{ width: size * 0.36, height: size * 0.36, color: "#d1d5db" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  );
}

function DeliveryBadge({ code, name }: { code: string; name: string }) {
  const color = code === "delivered" ? "#16a34a" : code === "pending" ? "#d97706" : "#6b7280";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}18`, color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      {name}
    </span>
  );
}

function RevealBadge({ revealed }: { revealed: boolean }) {
  return revealed
    ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: "rgba(124,58,237,0.1)", color: "#7c3aed" }}>
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#7c3aed" }} />
        Revealed
      </span>
    : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: "rgba(217,119,6,0.1)", color: "#d97706" }}>
        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: "#d97706" }} />
        Blind Box
      </span>;
}

function ActionBtn({ icon, label, color, onClick }: { icon: string; label: string; color: string; onClick: () => void }) {
  const paths: Record<string, string> = {
    view:    "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
    deliver: "M5 13l4 4L19 7",
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NftPage() {
  const [records, setRecords]   = useState<NftRecord[]>([]);
  const [total, setTotal]       = useState(0);
  const [offset, setOffset]     = useState(0);
  const [search, setSearch]     = useState("");
  const [statusFilter, setStatusFilter]   = useState("");
  const [stageFilter, setStageFilter]     = useState("");
  const [revealFilter, setRevealFilter]   = useState("");
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [master, setMaster]     = useState<Master | null>(null);
  const [myRole, setMyRole]     = useState<string | null>(null);

  // Modals
  const [showModal, setShowModal]             = useState(false);
  const [saving, setSaving]                   = useState(false);
  const [formError, setFormError]             = useState<string | null>(null);
  const [confirmDeliveryId, setConfirmDeliveryId] = useState<string | null>(null);
  const [showImport, setShowImport]           = useState(false);
  const [csvText, setCsvText]                 = useState("");
  const [csvFile, setCsvFile]                 = useState<File | null>(null);
  const [importing, setImporting]             = useState(false);
  const [importResult, setImportResult]       = useState<{ created: number; failed: number } | null>(null);
  const [viewRecord, setViewRecord]           = useState<NftRecord | null>(null);

  const fileRef     = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    serialNumber: "", stageId: "", nftTypeId: "", deliveryStatusId: "", notes: "",
  });

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: "8px",
    border: "1px solid #e5e7eb", fontSize: "13px", color: "#111827", outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: "11px", fontWeight: 700,
    color: "#9bafc5", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em",
  };

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadRecords = useCallback((q: string, off: number, status: string, stage: string, revealed: string) => {
    setLoading(true); setError(null);
    const params = new URLSearchParams({ search: q, limit: String(PAGE_SIZE), offset: String(off) });
    if (status)  params.set("delivery_status", status);
    if (stage)   params.set("stage", stage);
    if (revealed) params.set("revealed", revealed);
    fetch(`/api/presale/nft?${params}`, { credentials: "include" })
      .then(r => { if (!r.ok) throw new Error("API error"); return r.json(); })
      .then(data => { setRecords(data.nftRecords ?? []); setTotal(data.total ?? 0); setLoading(false); })
      .catch(e => { setError(e.message ?? "Failed to load NFT records."); setLoading(false); });
  }, []);

  useEffect(() => {
    fetch("/api/presale/master", { credentials: "include" })
      .then(r => r.json()).then(d => setMaster(d)).catch(() => {});
    fetch("/api/presale/me", { credentials: "include" })
      .then(r => r.json()).then(d => setMyRole(d.role ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    loadRecords(search, offset, statusFilter, stageFilter, revealFilter);
  }, [offset, statusFilter, stageFilter, revealFilter]);

  const handleSearch = (v: string) => {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setOffset(0); loadRecords(v, 0, statusFilter, stageFilter, revealFilter); }, 300);
  };

  const applyFilter = (status = statusFilter, stage = stageFilter, revealed = revealFilter) => {
    setOffset(0);
    loadRecords(search, 0, status, stage, revealed);
  };

  // ── Column definitions ─────────────────────────────────────────────────────
  const columns: ColumnDef<NftRecord>[] = [
    {
      key: "serial",
      header: "Serial / Token",
      render: r => (
        <div>
          <div className="font-mono font-bold text-sm" style={{ color: "#24315f" }}>{r.serialNumber}</div>
          {r.tokenId != null && (
            <div className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>Token #{r.tokenId}</div>
          )}
        </div>
      ),
    },
    {
      key: "image",
      header: "Image",
      width: 68,
      align: "center",
      render: r => <NftImage hash={r.imageIpfsHash} size={52} />,
    },
    {
      key: "wave",
      header: "Wave",
      render: r => r.waveNumber != null ? (
        <div>
          <span className="text-xs font-semibold" style={{ color: "#24315f" }}>W{r.waveNumber}</span>
          {r.waveName && <div className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{r.waveName.split("—")[0]?.trim()}</div>}
        </div>
      ) : <span style={{ color: "#9bafc5" }}>—</span>,
    },
    {
      key: "price",
      header: "Price (ETH)",
      align: "right",
      render: r => {
        const eff = r.effectivePriceEth;
        const hasOverride = r.priceEth != null;
        return eff != null ? (
          <div className="text-right">
            <span className="text-xs font-bold" style={{ color: hasOverride ? "#7c3aed" : "#24315f" }}>
              {Number(eff)} ETH
            </span>
            {hasOverride && (
              <div className="text-xs" style={{ color: "#9bafc5" }}>custom</div>
            )}
          </div>
        ) : <span className="text-xs font-semibold" style={{ color: "#16a34a" }}>Free</span>;
      },
    },
    {
      key: "stage",
      header: "Stage",
      render: r => <span className="text-xs" style={{ color: "#6b7280" }}>{r.stageName ?? "—"}</span>,
    },
    {
      key: "type",
      header: "Type",
      render: r => <span className="text-xs" style={{ color: "#6b7280" }}>{r.typeName ?? "—"}</span>,
    },
    {
      key: "reveal",
      header: "Reveal",
      align: "center",
      render: r => <RevealBadge revealed={r.isRevealed} />,
    },
    {
      key: "delivery",
      header: "Delivery",
      align: "center",
      render: r => r.deliveryStatusCode
        ? <DeliveryBadge code={r.deliveryStatusCode} name={r.deliveryStatusName} />
        : <span style={{ color: "#9bafc5" }}>—</span>,
    },
    {
      key: "deliveredAt",
      header: "Delivered At",
      render: r => (
        <span className="text-xs" style={{ color: "#6b7280", whiteSpace: "nowrap" }}>
          {r.deliveredAt ? new Date(r.deliveredAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "center",
      render: r => (
        <div className="flex items-center justify-center gap-1">
          <ActionBtn icon="view" label="View Details" color="#41afeb" onClick={() => setViewRecord(r)} />
          {r.deliveryStatusCode?.toLowerCase() !== "delivered" && (
            <ActionBtn icon="deliver" label="Confirm Delivery" color="#16a34a" onClick={() => setConfirmDeliveryId(r.id)} />
          )}
        </div>
      ),
    },
  ];

  // ── Stats ──────────────────────────────────────────────────────────────────
  const blindCount     = records.filter(r => !r.isRevealed).length;
  const revealedCount  = records.filter(r => r.isRevealed).length;
  const deliveredCount = records.filter(r => r.deliveryStatusCode === "delivered").length;

  // ── CSV export ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ["Sr.", "Serial #", "Token ID", "Stage", "Type", "Reveal Status", "Delivery", "Delivered At", "Notes"];
    const rows = records.map((r, i) => [
      offset + i + 1,
      r.serialNumber, r.tokenId ?? "", r.stageName ?? "", r.typeName ?? "",
      r.isRevealed ? "Revealed" : "Blind Box",
      r.deliveryStatusName ?? "",
      r.deliveredAt ? new Date(r.deliveredAt).toLocaleDateString() : "",
      r.notes ?? "",
    ]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `bearth-nft-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  // ── NFT CRUD ───────────────────────────────────────────────────────────────
  const openCreate = () => {
    setForm({ serialNumber: "", stageId: master?.nftStages[0]?.id ?? "", nftTypeId: "", deliveryStatusId: "", notes: "" });
    setFormError(null); setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true); setFormError(null);
    try {
      const body: Record<string, unknown> = { serialNumber: form.serialNumber, notes: form.notes || undefined };
      if (form.stageId)          body.stageId          = form.stageId;
      if (form.nftTypeId)        body.nftTypeId        = form.nftTypeId;
      if (form.deliveryStatusId) body.deliveryStatusId = form.deliveryStatusId;
      const res = await fetch("/api/presale/nft", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? "Save failed."); return; }
      setShowModal(false);
      loadRecords(search, offset, statusFilter, stageFilter, revealFilter);
    } catch { setFormError("Network error."); }
    finally { setSaving(false); }
  };

  const handleConfirmDelivery = async (id: string) => {
    const res = await fetch(`/api/presale/nft/${id}/delivery`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
    }).catch(() => null);
    if (!res || !res.ok) {
      const msg = res ? (await res.json().catch(() => ({}))).error : "Network error";
      setError(msg ?? "Delivery confirmation failed."); return;
    }
    setConfirmDeliveryId(null);
    loadRecords(search, offset, statusFilter, stageFilter, revealFilter);
  };

  // ── CSV import ─────────────────────────────────────────────────────────────
  const openImport = () => { setCsvText(""); setCsvFile(null); setImportResult(null); setFormError(null); setShowImport(true); };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setCsvFile(f);
    const reader = new FileReader();
    reader.onload = ev => setCsvText(ev.target?.result as string ?? "");
    reader.readAsText(f);
  };
  const handleImport = async () => {
    const rows = parseCsv(csvText);
    if (!rows.length) { setFormError("No valid rows found."); return; }
    setImporting(true); setFormError(null); setImportResult(null);
    try {
      const payload = rows.map(r => ({
        serialNumber: r.serial_number ?? r.serialnumber ?? r.serial ?? "",
        stageName: r.stage_name || undefined, stageCode: r.stage_code || undefined,
        nftTypeName: r.nft_type_name || undefined,
        deliveryStatusCode: r.delivery_status_code || undefined,
        notes: r.notes || undefined,
      })).filter(r => r.serialNumber);
      const res = await fetch("/api/presale/nft/bulk", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) { setFormError(d.error ?? "Import failed."); return; }
      setImportResult({ created: d.created ?? 0, failed: d.failed ?? 0 });
      loadRecords(search, offset, statusFilter, stageFilter, revealFilter);
    } catch { setFormError("Network error."); }
    finally { setImporting(false); }
  };

  return (
    <div className="p-5 space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-lg font-bold" style={{ color: "#24315f" }}>Bearth NFT Lists</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>606 Genesis NFTs — blind box, pre-reveal</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          <button onClick={openImport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: "#f0f9ff", color: "#0284c7", border: "1px solid #bae6fd" }}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import CSV
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
            style={{ background: "#41afeb" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#2e9fd8")}
            onMouseLeave={e => (e.currentTarget.style.background = "#41afeb")}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New NFT
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total NFTs",   value: String(total),          color: "#41afeb" },
          { label: "Blind Box",    value: String(blindCount),     color: "#d97706" },
          { label: "Revealed",     value: String(revealedCount),  color: "#7c3aed" },
          { label: "Delivered",    value: String(deliveredCount), color: "#16a34a" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48 max-w-64">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9bafc5" }}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" placeholder="Search serial # or token ID…" value={search}
            onChange={e => handleSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm outline-none bg-white"
            style={{ border: "1px solid #e5e7eb", color: "#111827" }} />
        </div>
        {master && (
          <>
            <select value={stageFilter}
              onChange={e => { setStageFilter(e.target.value); applyFilter(statusFilter, e.target.value, revealFilter); }}
              className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
              style={{ border: "1px solid #e5e7eb", color: stageFilter ? "#111827" : "#9bafc5" }}>
              <option value="">All Stages</option>
              {master.nftStages.map(s => <option key={s.id} value={s.code}>{s.name}</option>)}
            </select>
            <select value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); applyFilter(e.target.value, stageFilter, revealFilter); }}
              className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
              style={{ border: "1px solid #e5e7eb", color: statusFilter ? "#111827" : "#9bafc5" }}>
              <option value="">All Delivery</option>
              {master.deliveryStatuses.map(s => <option key={s.id} value={s.code}>{s.name}</option>)}
            </select>
          </>
        )}
        <select value={revealFilter}
          onChange={e => { setRevealFilter(e.target.value); applyFilter(statusFilter, stageFilter, e.target.value); }}
          className="py-2 px-3 rounded-xl text-sm bg-white outline-none"
          style={{ border: "1px solid #e5e7eb", color: revealFilter ? "#111827" : "#9bafc5" }}>
          <option value="">All Reveal Status</option>
          <option value="false">Blind Box</option>
          <option value="true">Revealed</option>
        </select>
      </div>

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={records}
        total={total}
        offset={offset}
        pageSize={PAGE_SIZE}
        onPageChange={setOffset}
        loading={loading}
        error={error}
        emptyText="No NFT records found"
        keyExtractor={r => r.id}
      />

      {/* ══ New NFT Modal ════════════════════════════════════════════════════════ */}
      {showModal && (
        <ModalWrap title="New NFT Record" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            {formError && <ErrBanner msg={formError} />}
            <div>
              <label style={labelStyle}>Serial Number *</label>
              <input value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })}
                style={inputStyle} placeholder="#607, #608 …" />
            </div>
            {master && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Stage</label>
                    <select value={form.stageId} onChange={e => setForm({ ...form, stageId: e.target.value })} style={inputStyle}>
                      <option value="">Select…</option>
                      {master.nftStages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>NFT Type</label>
                    <select value={form.nftTypeId} onChange={e => setForm({ ...form, nftTypeId: e.target.value })} style={inputStyle}>
                      <option value="">Select…</option>
                      {master.nftTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Delivery Status</label>
                  <select value={form.deliveryStatusId} onChange={e => setForm({ ...form, deliveryStatusId: e.target.value })} style={inputStyle}>
                    <option value="">Select…</option>
                    {master.deliveryStatuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </>
            )}
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} placeholder="Optional notes…" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg"
              style={{ background: saving ? "#9bafc5" : "#41afeb" }}>
              {saving ? "Saving…" : "Create NFT"}
            </button>
          </div>
        </ModalWrap>
      )}

      {/* ══ View Record Modal — shows traits when revealed ══════════════════════ */}
      {viewRecord && (
        <ModalWrap title={`NFT ${viewRecord.serialNumber}`} onClose={() => setViewRecord(null)} wide>
          <div className="flex gap-5">
            {/* Left: image */}
            <div className="flex-shrink-0">
              <NftImage hash={viewRecord.imageIpfsHash} size={120} />
              <div className="mt-2 text-center">
                <RevealBadge revealed={viewRecord.isRevealed} />
              </div>
            </div>

            {/* Right: details */}
            <div className="flex-1 min-w-0 space-y-3">
              {/* Core info grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {[
                  { label: "TOKEN ID",  val: viewRecord.tokenId != null ? `#${viewRecord.tokenId}` : "—" },
                  { label: "STAGE",     val: viewRecord.stageName    ?? "—" },
                  { label: "TYPE",      val: viewRecord.typeName     ?? "—" },
                  { label: "DELIVERY",  val: viewRecord.deliveryStatusName ?? "—" },
                  { label: "DELIVERED AT", val: viewRecord.deliveredAt ? new Date(viewRecord.deliveredAt).toLocaleDateString() : "—" },
                  { label: "CREATED",   val: new Date(viewRecord.createdAt).toLocaleDateString() },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#9bafc5" }}>{label}</p>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: "#24315f" }}>{val}</p>
                  </div>
                ))}
              </div>

              {/* Wave & Pricing */}
              {(viewRecord.waveNumber != null || viewRecord.effectivePriceEth != null) && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-2"
                  style={{ borderTop: "1px solid #f3f4f6" }}>
                  {viewRecord.waveNumber != null && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#9bafc5" }}>Wave</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "#24315f" }}>
                        Wave {viewRecord.waveNumber}{viewRecord.waveName ? ` — ${viewRecord.waveName}` : ""}
                      </p>
                    </div>
                  )}
                  {viewRecord.effectivePriceEth != null ? (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#9bafc5" }}>
                        Price {viewRecord.priceEth != null ? "(Custom)" : "(Wave Default)"}
                      </p>
                      <p className="text-sm font-bold mt-0.5"
                        style={{ color: viewRecord.priceEth != null ? "#7c3aed" : "#24315f" }}>
                        {Number(viewRecord.effectivePriceEth)} ETH
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#9bafc5" }}>Price</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: "#16a34a" }}>Free Mint</p>
                    </div>
                  )}
                </div>
              )}

              {/* Traits — shown when revealed */}
              {viewRecord.isRevealed && viewRecord.traits && Object.keys(viewRecord.traits).length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#9bafc5" }}>Attributes</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(viewRecord.traits).map(([trait, value]) => (
                      <div key={trait} className="px-3 py-1.5 rounded-xl text-center"
                        style={{ background: "rgba(65,175,235,0.08)", border: "1px solid rgba(65,175,235,0.2)" }}>
                        <div className="text-xs font-bold uppercase tracking-wide" style={{ color: "#9bafc5" }}>{trait}</div>
                        <div className="text-sm font-semibold mt-0.5" style={{ color: "#24315f" }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Blind box + Metadata URI — tech/admin only */}
              {(myRole === "tech" || myRole === "admin") && (
                <>
                  {!viewRecord.isRevealed && (
                    <div className="p-3 rounded-xl flex items-center gap-3"
                      style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)" }}>
                      <svg className="w-5 h-5 flex-shrink-0" style={{ color: "#d97706" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <div>
                        <p className="text-xs font-bold" style={{ color: "#d97706" }}>Sealed — Blind Box</p>
                        <p className="text-xs mt-0.5" style={{ color: "#92400e" }}>
                          Attributes and actual artwork will be shown after the reveal event.
                        </p>
                      </div>
                    </div>
                  )}

                  {viewRecord.metadataUri && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#9bafc5" }}>Metadata URI</p>
                      <p className="text-xs font-mono break-all px-3 py-2 rounded-lg"
                        style={{ background: "#f9fafb", color: "#6b7280", border: "1px solid #e5e7eb" }}>
                        {viewRecord.metadataUri}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Notes */}
              {viewRecord.notes && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "#9bafc5" }}>Notes</p>
                  <p className="text-sm" style={{ color: "#6b7280" }}>{viewRecord.notes}</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex justify-end pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => setViewRecord(null)} className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Close</button>
          </div>
        </ModalWrap>
      )}

      {/* ══ Confirm Delivery Modal ══════════════════════════════════════════════ */}
      {confirmDeliveryId && (
        <ModalWrap title="Confirm Delivery" onClose={() => setConfirmDeliveryId(null)} small>
          <p className="text-sm mb-6" style={{ color: "#6b7280" }}>
            Mark this NFT as delivered? This will set the delivery date to today.
          </p>
          <div className="flex justify-end gap-3">
            <button onClick={() => setConfirmDeliveryId(null)} className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
            <button onClick={() => handleConfirmDelivery(confirmDeliveryId)}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg"
              style={{ background: "#16a34a" }}>Confirm Delivery</button>
          </div>
        </ModalWrap>
      )}

      {/* ══ CSV Import Modal ════════════════════════════════════════════════════ */}
      {showImport && (
        <ModalWrap title="Import NFT Records (CSV)" onClose={() => setShowImport(false)}>
          <p className="text-xs mb-4" style={{ color: "#9bafc5" }}>
            Required: <code>serial_number</code>. Optional: <code>stage_name</code>, <code>nft_type_name</code>, <code>delivery_status_code</code>, <code>notes</code>
          </p>
          <div className="space-y-4">
            {formError && <ErrBanner msg={formError} />}
            {importResult && (
              <div className="p-3 rounded-lg text-sm" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a" }}>
                Import complete: <strong>{importResult.created}</strong> created
                {importResult.failed > 0 && <>, <strong className="text-red-600">{importResult.failed}</strong> failed</>}
              </div>
            )}
            <div className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer"
              style={{ borderColor: "#e5e7eb" }} onClick={() => fileRef.current?.click()}>
              <p className="text-sm font-medium" style={{ color: "#374151" }}>
                {csvFile ? csvFile.name : "Click to select a CSV file"}
              </p>
              <p className="text-xs mt-1" style={{ color: "#9bafc5" }}>or paste CSV text below</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
            </div>
            <textarea value={csvText} onChange={e => setCsvText(e.target.value)}
              placeholder={"serial_number,stage_name,notes\n#607,Genesis,New NFT"}
              rows={5} className="w-full text-xs font-mono px-3 py-2 rounded-lg outline-none resize-y"
              style={{ border: "1px solid #e5e7eb", color: "#374151" }} />
            <p className="text-xs" style={{ color: "#9bafc5" }}>
              {csvText ? `${parseCsv(csvText).length} row(s) detected` : "No data"}
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: "1px solid #e5e7eb", marginTop: 16 }}>
            <button onClick={() => setShowImport(false)} className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}>Cancel</button>
            <button onClick={handleImport} disabled={importing || !csvText.trim()}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg"
              style={{ background: importing || !csvText.trim() ? "#9bafc5" : "#0284c7" }}>
              {importing ? "Importing…" : `Import ${parseCsv(csvText).length || 0} records`}
            </button>
          </div>
        </ModalWrap>
      )}

    </div>
  );
}

// ─── Shared modal wrapper ─────────────────────────────────────────────────────

function ModalWrap({ children, onClose, title, small, wide }:
  { children: React.ReactNode; onClose: () => void; title: string; small?: boolean; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl flex flex-col"
        style={{ width: "100%", maxWidth: wide ? 700 : small ? 400 : 560, maxHeight: "90vh", border: "1px solid #e5e7eb" }}>
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

function ErrBanner({ msg }: { msg: string }) {
  return (
    <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
      {msg}
    </div>
  );
}
