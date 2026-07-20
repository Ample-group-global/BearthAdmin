"use client";

import { useEffect, useState, useCallback, Fragment } from "react";

type PaymentCategory = "crypto" | "bank" | "local";

interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  category: PaymentCategory;
  isActive: boolean;
  sortOrder: number;
}

const CATEGORY_META: Record<PaymentCategory, { label: string; color: string; bg: string }> = {
  crypto: { label: "Cryptocurrency", color: "#7c3aed", bg: "rgba(124,58,237,0.08)" },
  bank:   { label: "Bank / Wire",    color: "#2563eb", bg: "rgba(37,99,235,0.08)"  },
  local:  { label: "Local / Instant",color: "#059669", bg: "rgba(5,150,105,0.08)" },
};

function Badge({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: active ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.08)",
               color: active ? "#16a34a" : "#dc2626" }}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl flex flex-col"
        style={{ width: "100%", maxWidth: 480, border: "1px solid #e5e7eb" }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #e5e7eb" }}>
          <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>{title}</h2>
          <button onClick={onClose} style={{ color: "#9bafc5" }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb",
  borderRadius: 8, fontSize: 13, color: "#24315f", outline: "none",
};

export default function PaymentMethodsPage() {
  const [methods, setMethods]       = useState<PaymentMethod[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [editMethod, setEditMethod] = useState<PaymentMethod | null>(null);
  const [saving, setSaving]         = useState(false);

  // All categories expanded by default
  const [expanded, setExpanded] = useState<Record<PaymentCategory, boolean>>({ crypto: true, bank: true, local: true });

  // Add form
  const [addName, setAddName]           = useState("");
  const [addCode, setAddCode]           = useState("");
  const [addCategory, setAddCategory]   = useState<PaymentCategory>("local");

  // Edit form
  const [editName, setEditName]         = useState("");
  const [editCategory, setEditCategory] = useState<PaymentCategory>("local");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/payment-methods", { credentials: "include" })
      .then(r => r.json())
      .then(d => { setMethods(d.paymentMethods ?? []); setError(null); })
      .catch(() => setError("Failed to load payment methods"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const autoCode = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  const handleAdd = async () => {
    if (!addName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/payment-methods", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: addName.trim(), code: addCode.trim() || autoCode(addName), category: addCategory }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to create"); return; }
      setShowAdd(false); setAddName(""); setAddCode(""); setAddCategory("local");
      load();
    } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editMethod) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/payment-methods/${editMethod.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), category: editCategory }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed to update"); return; }
      setEditMethod(null);
      load();
    } finally { setSaving(false); }
  };

  const handleToggle = async (m: PaymentMethod) => {
    await fetch(`/api/payment-methods/${m.id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !m.isActive }),
    });
    load();
  };

  const openEdit = (m: PaymentMethod) => {
    setEditMethod(m); setEditName(m.name); setEditCategory(m.category ?? "local");
  };

  const toggleCategory = (cat: PaymentCategory) =>
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }));

  const CATEGORIES = Object.keys(CATEGORY_META) as PaymentCategory[];

  return (
    <div className="p-6 space-y-6" style={{ maxWidth: 760, margin: "0 auto" }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: "#24315f" }}>Payment Methods</h1>
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            Manage accepted payment modes across the Bearth platform
          </p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "#24315f" }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Method
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
          {error}
        </div>
      )}

      {/* Single table with collapsible category rows */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
        {loading ? (
          <div className="flex items-center justify-center h-32 text-sm" style={{ color: "#9bafc5" }}>Loading…</div>
        ) : methods.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm" style={{ color: "#9bafc5" }}>No payment methods found</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb" }}>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Code</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Status</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map(catKey => {
                const meta  = CATEGORY_META[catKey];
                const group = methods.filter(m => (m.category ?? "local") === catKey);
                if (group.length === 0) return null;
                const isOpen = expanded[catKey];
                return (
                  <Fragment key={catKey}>
                    {/* Category header row — clickable */}
                    <tr
                      onClick={() => toggleCategory(catKey)}
                      className="cursor-pointer select-none"
                      style={{ background: meta.bg, borderTop: "1px solid #e5e7eb", borderBottom: isOpen ? `1px solid ${meta.color}20` : "none" }}>
                      <td colSpan={4} className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <svg className="w-3.5 h-3.5 transition-transform" style={{ color: meta.color, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: meta.color }}>
                            {meta.label}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: meta.color, color: "#fff" }}>
                            {group.length}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Method rows — shown only when expanded */}
                    {isOpen && group.map((m, i) => (
                      <tr key={m.id} style={{ borderBottom: i < group.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                        <td className="px-4 py-3 pl-10 font-semibold" style={{ color: "#24315f" }}>{m.name}</td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: "#6b7280" }}>{m.code}</td>
                        <td className="px-4 py-3 text-center"><Badge active={m.isActive} /></td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => openEdit(m)}
                              className="px-2 py-1 rounded text-xs font-semibold hover:opacity-80"
                              style={{ background: "rgba(65,175,235,0.1)", color: "#41afeb" }}>
                              Edit
                            </button>
                            <button onClick={() => handleToggle(m)}
                              className="px-2 py-1 rounded text-xs font-semibold hover:opacity-80"
                              style={{ background: m.isActive ? "rgba(220,38,38,0.08)" : "rgba(22,163,74,0.1)",
                                       color: m.isActive ? "#dc2626" : "#16a34a" }}>
                              {m.isActive ? "Disable" : "Enable"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <Modal title="Add Payment Method" onClose={() => setShowAdd(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7280" }}>Name *</label>
              <input value={addName} onChange={e => { setAddName(e.target.value); if (!addCode) setAddCode(autoCode(e.target.value)); }}
                style={inputStyle} placeholder="e.g. USDT" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7280" }}>Code</label>
              <input value={addCode} onChange={e => setAddCode(e.target.value)}
                style={inputStyle} placeholder="auto-generated from name" />
              <p className="text-[10px] mt-0.5" style={{ color: "#9bafc5" }}>Unique identifier (lowercase, underscores only)</p>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7280" }}>Category *</label>
              <div className="flex gap-2">
                {(Object.entries(CATEGORY_META) as Array<[PaymentCategory, typeof CATEGORY_META[PaymentCategory]]>).map(([key, meta]) => (
                  <button key={key} type="button" onClick={() => setAddCategory(key)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                    style={{ background: addCategory === key ? meta.color : "#f9fafb", color: addCategory === key ? "#fff" : "#6b7280", border: `1px solid ${addCategory === key ? meta.color : "#e5e7eb"}` }}>
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#f3f4f6", color: "#6b7280" }}>
                Cancel
              </button>
              <button onClick={handleAdd} disabled={saving || !addName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#24315f" }}>
                {saving ? "Saving…" : "Add Method"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Modal */}
      {editMethod && (
        <Modal title={`Edit: ${editMethod.name}`} onClose={() => setEditMethod(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7280" }}>Name</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7280" }}>Code</label>
              <input value={editMethod.code} disabled
                style={{ ...inputStyle, background: "#f9fafb", color: "#9bafc5" }} />
              <p className="text-[10px] mt-0.5" style={{ color: "#9bafc5" }}>Code cannot be changed after creation</p>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: "#6b7280" }}>Category</label>
              <div className="flex gap-2">
                {(Object.entries(CATEGORY_META) as Array<[PaymentCategory, typeof CATEGORY_META[PaymentCategory]]>).map(([key, meta]) => (
                  <button key={key} type="button" onClick={() => setEditCategory(key)}
                    className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                    style={{ background: editCategory === key ? meta.color : "#f9fafb", color: editCategory === key ? "#fff" : "#6b7280", border: `1px solid ${editCategory === key ? meta.color : "#e5e7eb"}` }}>
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setEditMethod(null)}
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: "#f3f4f6", color: "#6b7280" }}>
                Cancel
              </button>
              <button onClick={handleEdit} disabled={saving || !editName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "#24315f" }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
