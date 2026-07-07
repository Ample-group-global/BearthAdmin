"use client";

import { useState } from "react";

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  category?: string;
  isActive?: boolean;
}

interface Props {
  value: string;
  onChange: (id: string) => void;
  methods: PaymentMethod[];
  onMethodAdded?: (method: PaymentMethod) => void;
  style?: React.CSSProperties;
  placeholder?: string;
}

export default function PaymentMethodSelect({
  value, onChange, methods, onMethodAdded, style, placeholder = "Select...",
}: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const autoCode = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true); setErr(null);
    try {
      const res = await fetch("/api/presale/payment-methods", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), code: autoCode(newName), sortOrder: 99 }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "Failed to add"); return; }
      const created: PaymentMethod = data.paymentMethod;
      onMethodAdded?.(created);
      onChange(created.id);
      setNewName(""); setAdding(false);
    } finally { setSaving(false); }
  };

  const activeFilter = methods.filter(m => m.isActive !== false);

  const CATEGORY_GROUPS: Array<{ key: string; label: string }> = [
    { key: "crypto", label: "Cryptocurrency" },
    { key: "bank",   label: "Bank / Wire Transfer" },
    { key: "local",  label: "Local / Instant" },
  ];

  const grouped = CATEGORY_GROUPS.map(g => ({
    ...g,
    methods: activeFilter.filter(m => m.category === g.key),
  })).filter(g => g.methods.length > 0);

  const ungrouped = activeFilter.filter(m => !m.category);

  return (
    <div>
      <div className="flex items-center gap-1">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...style, flex: 1 }}>
          <option value="">{placeholder}</option>
          {grouped.length > 0
            ? grouped.map(g => (
                <optgroup key={g.key} label={g.label}>
                  {g.methods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </optgroup>
              ))
            : activeFilter.map(m => <option key={m.id} value={m.id}>{m.name}</option>)
          }
          {ungrouped.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <button
          type="button"
          title="Add new payment method"
          onClick={() => setAdding(v => !v)}
          className="flex-shrink-0 flex items-center justify-center rounded-lg transition-colors hover:opacity-80"
          style={{ width: 32, height: 32, background: adding ? "#24315f" : "#f3f4f6",
                   color: adding ? "#fff" : "#6b7280", border: "1px solid #e5e7eb" }}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={adding ? "M6 18L18 6M6 6l12 12" : "M12 4v16m8-8H4"} />
          </svg>
        </button>
      </div>

      {adding && (
        <div className="mt-2 p-3 rounded-lg space-y-2" style={{ background: "#f8fafc", border: "1px solid #e5e7eb" }}>
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#9bafc5" }}>
            Add New Payment Method
          </p>
          {err && <p className="text-xs" style={{ color: "#dc2626" }}>{err}</p>}
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              placeholder="Method name (e.g. USDT)"
              className="flex-1 text-sm"
              style={{ padding: "6px 8px", border: "1px solid #e5e7eb", borderRadius: 6,
                       outline: "none", fontSize: 12 }}
              autoFocus
            />
            <button
              onClick={handleAdd}
              disabled={saving || !newName.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "#24315f", whiteSpace: "nowrap" }}>
              {saving ? "…" : "Add"}
            </button>
          </div>
          <p className="text-[10px]" style={{ color: "#9bafc5" }}>
            Code: <span className="font-mono">{autoCode(newName) || "auto"}</span>
          </p>
        </div>
      )}
    </div>
  );
}
