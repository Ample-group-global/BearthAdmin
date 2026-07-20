"use client";

import { useEffect, useState } from "react";

interface NftEvent {
  id: string;
  name: string;
  event_date: string;
  location: string | null;
  wave_id: string | null;
  max_attendees: number | null;
  notes: string | null;
  created_at: string;
  checkin_count?: number;
}

interface Checkin {
  id: string;
  wallet_address: string;
  customer_id: string | null;
  is_eligible: boolean;
  checked_in_at: string;
  notes: string | null;
}

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
  textTransform: "uppercase", letterSpacing: "0.06em",
  padding: "10px 14px", borderBottom: "1px solid #e5e7eb",
  background: "#f9fafb", whiteSpace: "nowrap",
};

export default function EventsPage() {
  const [events, setEvents]       = useState<NftEvent[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<NftEvent | null>(null);
  const [checkins, setCheckins]   = useState<Checkin[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showCheckin, setShowCheckin] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [err, setErr]             = useState<string | null>(null);
  const [ok, setOk]               = useState<string | null>(null);

  const emptyForm = { name: "", event_date: "", location: "", max_attendees: "", notes: "" };
  const [form, setForm] = useState(emptyForm);
  const [checkinForm, setCheckinForm] = useState({ wallet_address: "", notes: "" });
  const [tagIds, setTagIds] = useState("");
  const [tagging, setTagging] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch("/api/nft-sell/events", { credentials: "include" });
      const d = await r.json();
      setEvents(d.events ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function loadCheckins(eventId: string) {
    const r = await fetch(`/api/nft-sell/events/${eventId}/checkins`, { credentials: "include" });
    const d = await r.json();
    setCheckins(d.checkins ?? []);
  }

  async function selectEvent(ev: NftEvent) {
    setSelected(ev);
    await loadCheckins(ev.id);
  }

  async function createEvent() {
    setSaving(true); setErr(null);
    try {
      const r = await fetch("/api/nft-sell/events", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name, event_date: form.event_date,
          location: form.location || undefined,
          max_attendees: form.max_attendees ? parseInt(form.max_attendees) : undefined,
          notes: form.notes || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to create event");
      setOk("Event created"); setShowCreate(false); setForm(emptyForm); load();
    } finally { setSaving(false); }
  }

  async function addCheckin() {
    if (!selected) return;
    setSaving(true); setErr(null);
    try {
      const r = await fetch(`/api/nft-sell/events/${selected.id}/checkins`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet_address: checkinForm.wallet_address, notes: checkinForm.notes || undefined }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to add check-in");
      setOk("Check-in registered"); setShowCheckin(false); setCheckinForm({ wallet_address: "", notes: "" });
      await loadCheckins(selected.id);
    } finally { setSaving(false); }
  }

  async function tagBatch() {
    if (!selected) return;
    const ids = tagIds.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
    if (!ids.length) return;
    setTagging(true);
    try {
      const r = await fetch(`/api/nft-sell/events/${selected.id}/tag-batch`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nft_record_ids: ids }),
      });
      const d = await r.json();
      if (!r.ok) return setErr(d.error ?? "Failed to tag NFTs");
      setOk(`Tagged ${d.tagged} NFT record(s) as event-exclusive`); setTagIds("");
    } finally { setTagging(false); }
  }

  const Overlay = ({ children }: { children: React.ReactNode }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#24315f" }}>Physical Event Exclusives</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage events, check-ins, and event-exclusive NFT tagging</p>
        </div>
        <button onClick={() => { setShowCreate(true); setForm(emptyForm); setErr(null); }}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: "#41afeb" }}>
          + New Event
        </button>
      </div>

      {ok && <div className="px-3 py-2 rounded-lg text-xs text-green-700" style={{ background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.3)" }}>{ok}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Events List */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1px solid #e5e7eb" }}>
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Events ({events.length})</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-sm text-gray-400">Loading…</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {events.length === 0 ? (
                <div className="p-6 text-center text-sm text-gray-400">No events yet</div>
              ) : events.map(ev => (
                <div key={ev.id}
                  onClick={() => selectEvent(ev)}
                  className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  style={selected?.id === ev.id ? { background: "rgba(65,175,235,0.06)" } : {}}>
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-sm" style={{ color: "#24315f" }}>{ev.name}</div>
                    <span className="text-xs text-gray-400">{ev.checkin_count ?? 0} check-ins</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {ev.event_date ? new Date(ev.event_date).toLocaleDateString() : "—"}
                    {ev.location ? ` · ${ev.location}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Event Detail */}
        <div className="space-y-4">
          {selected ? (
            <>
              <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>Check-ins — {selected.name}</h2>
                  <button onClick={() => { setShowCheckin(true); setErr(null); }}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#41afeb" }}>
                    + Check In
                  </button>
                </div>
                <table className="w-full">
                  <thead>
                    <tr>
                      {["Wallet", "Eligible", "Time"].map(h => (
                        <th key={h} style={{ ...thStyle, padding: "6px 10px" }} className="text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {checkins.length === 0 ? (
                      <tr><td colSpan={3} className="text-center py-4 text-xs text-gray-400">No check-ins yet</td></tr>
                    ) : checkins.map(c => (
                      <tr key={c.id} className="border-b border-gray-50">
                        <td className="px-2 py-2 text-xs font-mono text-gray-600">{c.wallet_address.slice(0, 12)}…</td>
                        <td className="px-2 py-2">
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                            style={{ background: c.is_eligible ? "rgba(22,163,74,0.1)" : "rgba(220,38,38,0.08)", color: c.is_eligible ? "#16a34a" : "#dc2626" }}>
                            {c.is_eligible ? "Yes" : "No"}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-400">
                          {new Date(c.checked_in_at).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tag NFT Batch */}
              <div className="bg-white rounded-2xl shadow-sm p-4" style={{ border: "1px solid #e5e7eb" }}>
                <h2 className="text-sm font-bold mb-3" style={{ color: "#24315f" }}>Tag NFT Records as Event-Exclusive</h2>
                <label style={labelStyle}>NFT Record UUIDs (comma or newline separated)</label>
                <textarea value={tagIds} onChange={e => setTagIds(e.target.value)}
                  rows={3} placeholder="uuid1, uuid2, uuid3…"
                  style={{ ...inputStyle, resize: "vertical", marginBottom: "8px" }} />
                <button onClick={tagBatch} disabled={tagging || !tagIds.trim()}
                  className="w-full py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "#d97706", opacity: tagging ? 0.6 : 1 }}>
                  {tagging ? "Tagging…" : "Tag NFTs"}
                </button>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400" style={{ border: "1px solid #e5e7eb" }}>
              Select an event to view check-ins
            </div>
          )}
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreate && (
        <Overlay>
          <h2 className="text-base font-bold mb-4" style={{ color: "#24315f" }}>New Physical Event</h2>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Event Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Bearth NFT Launch Night" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Event Date</label>
              <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Location</label>
              <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Venue or City" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Max Attendees</label>
              <input type="number" value={form.max_attendees} onChange={e => setForm(f => ({ ...f, max_attendees: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
            </div>
          </div>
          {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={createEvent} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Creating…" : "Create Event"}
            </button>
          </div>
        </Overlay>
      )}

      {/* Check-in Modal */}
      {showCheckin && (
        <Overlay>
          <h2 className="text-base font-bold mb-4" style={{ color: "#24315f" }}>Register Check-In</h2>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Wallet Address</label>
              <input type="text" value={checkinForm.wallet_address}
                onChange={e => setCheckinForm(f => ({ ...f, wallet_address: e.target.value }))}
                placeholder="0x..." style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Notes (optional)</label>
              <input type="text" value={checkinForm.notes}
                onChange={e => setCheckinForm(f => ({ ...f, notes: e.target.value }))}
                style={inputStyle} />
            </div>
          </div>
          {err && <div className="mt-3 text-xs text-red-600">{err}</div>}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowCheckin(false)} className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-600">Cancel</button>
            <button onClick={addCheckin} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background: "#41afeb", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Registering…" : "Check In"}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}
