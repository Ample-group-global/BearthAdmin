"use client";

import { useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OSEvent {
  eventType: string;
  chain: string;
  contractAddress: string;
  tokenId: string;
  fromAddress: string;
  toAddress: string;
  price: string;
  priceCurrency: string;
  transactionHash: string;
  eventTimestamp: string;
}

type FilterMode = "collection" | "nft" | "account" | "general";

const EVENT_TYPES = ["All", "sale", "transfer", "offer", "cancel", "list", "mint"] as const;

const EVENT_BADGE: Record<string, { color: string; bg: string }> = {
  sale:     { color: "#16a34a", bg: "#dcfce7" },
  transfer: { color: "#2563eb", bg: "#dbeafe" },
  offer:    { color: "#7c3aed", bg: "#ede9fe" },
  cancel:   { color: "#dc2626", bg: "#fee2e2" },
  list:     { color: "#d97706", bg: "#fef3c7" },
  mint:     { color: "#0891b2", bg: "#cffafe" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function badge(type: string) {
  const s = EVENT_BADGE[type.toLowerCase()] ?? { color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span
      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
      style={{ color: s.color, background: s.bg }}
    >
      {type}
    </span>
  );
}

function truncate(addr: string, chars = 8) {
  if (!addr || addr.length <= chars * 2 + 2) return addr;
  return `${addr.slice(0, chars)}…${addr.slice(-4)}`;
}

function fmtPrice(raw: string, currency: string) {
  if (!raw || raw === "0") return "—";
  try {
    const eth = parseFloat(raw) / 1e18;
    return `${eth.toFixed(4)} ${currency}`;
  } catch {
    return raw;
  }
}

function fmtTs(ts: string) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString();
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="w-5 h-5 animate-spin" style={{ color: "#9bafc5" }} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

function Input({
  placeholder,
  value,
  onChange,
  style,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
}) {
  return (
    <input
      className="text-xs px-3 py-1.5 rounded border outline-none"
      style={{ border: "1px solid #e4e7ed", color: "#374151", background: "#fff", ...style }}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventsPage() {
  const [mode, setMode] = useState<FilterMode>("collection");

  // Collection
  const [slug, setSlug] = useState("");
  // NFT
  const [chain, setChain] = useState("ethereum");
  const [contract, setContract] = useState("");
  const [tokenId, setTokenId] = useState("");
  // Account
  const [accountAddress, setAccountAddress] = useState("");
  // General
  const [generalAddress, setGeneralAddress] = useState("");
  // Shared
  const [eventType, setEventType] = useState<string>("All");

  const [events, setEvents] = useState<OSEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [syncMsg, setSyncMsg] = useState("");

  const typeParam = eventType === "All" ? "" : eventType;

  const buildUrl = useCallback(() => {
    const q = typeParam ? `event_type=${typeParam}` : "";
    switch (mode) {
      case "collection":
        return `/api/opensea/Events/collection/${encodeURIComponent(slug)}${q ? `?${q}` : ""}`;
      case "nft":
        return `/api/opensea/Events/chain/${encodeURIComponent(chain)}/contract/${encodeURIComponent(contract)}/nft/${encodeURIComponent(tokenId)}${q ? `?${q}` : ""}`;
      case "account":
        return `/api/opensea/Events/account/${encodeURIComponent(accountAddress)}${q ? `?${q}` : ""}`;
      case "general": {
        const addr = generalAddress ? `address=${encodeURIComponent(generalAddress)}` : "";
        const parts = [q, addr].filter(Boolean).join("&");
        return `/api/opensea/Events${parts ? `?${parts}` : ""}`;
      }
    }
  }, [mode, slug, chain, contract, tokenId, accountAddress, generalAddress, typeParam]);

  const load = async () => {
    setError("");
    setSyncMsg("");
    const url = buildUrl();
    setLoading(true);
    try {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) {
        const t = await r.text();
        setError(`Error ${r.status}: ${t}`);
        setEvents([]);
        return;
      }
      const d = await r.json();
      setEvents(Array.isArray(d) ? d : d.events ?? d.data ?? []);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const sync = async () => {
    if (!slug) return;
    setSyncing(true);
    setSyncMsg("");
    setError("");
    try {
      const q = typeParam ? `?event_type=${typeParam}` : "";
      const r = await fetch(
        `/api/opensea/Events/collection/${encodeURIComponent(slug)}/sync${q}`,
        { method: "POST", credentials: "include" }
      );
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(`Sync error ${r.status}: ${d.message ?? ""}`); return; }
      setSyncMsg(d.message ?? "Sync complete");
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setSyncing(false);
    }
  };

  const MODES: { key: FilterMode; label: string }[] = [
    { key: "collection", label: "Collection" },
    { key: "nft",        label: "NFT"        },
    { key: "account",    label: "Account"    },
    { key: "general",    label: "General"    },
  ];

  return (
    <div className="p-5">

      {/* Page header */}
      <div className="mb-5">
        <h1 className="text-base font-bold" style={{ color: "#24315f" }}>OpenSea Events</h1>
        <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
          Query on-chain events by collection, NFT, account or address
        </p>
      </div>

      {/* Filter card */}
      <div className="bg-white rounded-lg p-4 mb-4" style={{ border: "1px solid #e4e7ed" }}>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
          {MODES.map(m => (
            <button
              key={m.key}
              onClick={() => { setMode(m.key); setEvents([]); setError(""); setSyncMsg(""); }}
              className="px-3 py-1.5 rounded text-xs font-semibold transition-all"
              style={mode === m.key
                ? { background: "#fff", color: "#24315f", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
                : { color: "#9bafc5" }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Mode-specific inputs */}
        <div className="flex flex-wrap items-end gap-2">

          {mode === "collection" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>
                Collection Slug
              </label>
              <Input placeholder="e.g. boredapeyachtclub" value={slug} onChange={setSlug} style={{ width: 220 }} />
            </div>
          )}

          {mode === "nft" && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>Chain</label>
                <Input placeholder="ethereum" value={chain} onChange={setChain} style={{ width: 120 }} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>Contract</label>
                <Input placeholder="0x…" value={contract} onChange={setContract} style={{ width: 220 }} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>Token ID</label>
                <Input placeholder="1" value={tokenId} onChange={setTokenId} style={{ width: 80 }} />
              </div>
            </>
          )}

          {mode === "account" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>
                Wallet Address
              </label>
              <Input placeholder="0x…" value={accountAddress} onChange={setAccountAddress} style={{ width: 320 }} />
            </div>
          )}

          {mode === "general" && (
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>
                Address (optional)
              </label>
              <Input placeholder="0x… (leave blank for all)" value={generalAddress} onChange={setGeneralAddress} style={{ width: 300 }} />
            </div>
          )}

          {/* Event type dropdown */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#9bafc5" }}>
              Event Type
            </label>
            <select
              value={eventType}
              onChange={e => setEventType(e.target.value)}
              className="text-xs px-3 py-1.5 rounded border outline-none bg-white"
              style={{ border: "1px solid #e4e7ed", color: "#374151", width: 130 }}
            >
              {EVENT_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white transition-opacity"
            style={{ background: "#24315f", opacity: loading ? 0.65 : 1, alignSelf: "flex-end" }}
          >
            {loading ? <Spinner /> : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            Load
          </button>

          {mode === "collection" && (
            <button
              onClick={sync}
              disabled={syncing || !slug}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold text-white transition-opacity"
              style={{ background: "#41afeb", opacity: (syncing || !slug) ? 0.65 : 1, alignSelf: "flex-end" }}
            >
              {syncing ? <Spinner /> : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              Sync
            </button>
          )}
        </div>

        {/* Feedback messages */}
        {error && (
          <p className="mt-3 text-xs px-3 py-2 rounded" style={{ background: "#fee2e2", color: "#dc2626" }}>
            {error}
          </p>
        )}
        {syncMsg && (
          <p className="mt-3 text-xs px-3 py-2 rounded" style={{ background: "#dcfce7", color: "#16a34a" }}>
            {syncMsg}
          </p>
        )}
      </div>

      {/* Results table */}
      <div className="bg-white rounded-lg overflow-hidden" style={{ border: "1px solid #e4e7ed" }}>
        <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
          <span className="text-xs font-bold" style={{ color: "#24315f" }}>Events</span>
          {events.length > 0 && (
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded"
              style={{ background: "#f0f2f7", color: "#9bafc5" }}>
              {events.length} record{events.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid #e4e7ed", background: "#f8f9fb" }}>
                {["Event Type", "Chain", "Contract", "Token ID", "Price", "From", "To", "Timestamp"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 font-semibold whitespace-nowrap"
                    style={{ color: "#6b7280" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr>
                  <td colSpan={8} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2" style={{ color: "#9bafc5" }}>
                      <Spinner />
                      <span className="text-xs">Loading events…</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && events.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-xs" style={{ color: "#9bafc5" }}>
                    No events to display. Use the filters above and click Load.
                  </td>
                </tr>
              )}
              {!loading && events.map((ev, i) => (
                <tr key={i} style={{ color: "#374151" }}>
                  <td className="px-4 py-2.5 whitespace-nowrap">{badge(ev.eventType)}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="font-mono text-[10px]" style={{ color: "#9bafc5" }}>{ev.chain}</span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span className="font-mono text-[10px]" title={ev.contractAddress} style={{ color: "#374151" }}>
                      {truncate(ev.contractAddress)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono">
                    {ev.tokenId ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap font-semibold" style={{ color: "#24315f" }}>
                    {fmtPrice(ev.price, ev.priceCurrency)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-[10px]" title={ev.fromAddress} style={{ color: "#6b7280" }}>
                      {truncate(ev.fromAddress)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-[10px]" title={ev.toAddress} style={{ color: "#6b7280" }}>
                      {truncate(ev.toAddress)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "#9bafc5" }}>
                    {fmtTs(ev.eventTimestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
